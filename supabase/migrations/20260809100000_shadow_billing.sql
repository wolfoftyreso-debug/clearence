-- Skuggdebiteringen: pilotens spår A.
--
-- En byrå i skuggläge får sina avgifter REGISTRERADE och VISADE precis
-- som vanligt - varje upplåsning prissätts enligt planen och syns i
-- debiteringsöversikten med sitt belopp - men raderna FAKTURERAS ALDRIG.
-- Så prövas betalningsviljan mot en synlig siffra ("detta hade kostat")
-- innan faktureringsgaten (momsregistrering, F-skatt, bankgiro) är öppen.
--
-- Två regler som inte får kompromissas:
--
--  1. Skuggan stämplas PÅ RADEN vid händelsen, ur planens läge just då.
--     Slår driften av skuggläget senare förblir gamla rader skugga -
--     ingenting efterfaktureras. Samma princip som avgiftsstämplingen:
--     historik skrivs aldrig om av ett nytt avtal.
--  2. Månadsjobbet hoppar över skuggrader HELT: de får aldrig invoice_id
--     och räknas aldrig in i någon faktura.

alter table public.billing_plans
  add column shadow boolean not null default false;

comment on column public.billing_plans.shadow is
  'Skuggläge (pilotens spår A): avgifter registreras och visas men faktureras aldrig. Sätts av driften via set_billing_shadow().';

alter table public.usage_charges
  add column shadow boolean not null default false;

comment on column public.usage_charges.shadow is
  'Stämplad vid händelsen ur planens dåvarande skuggläge. En skuggrad faktureras aldrig och efterfaktureras aldrig.';

/** Driften slår på eller av skuggläget för en byrå. */
create or replace function public.set_billing_shadow(
  p_professional_id uuid,
  p_shadow boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Kräver driftbehörighet';
  end if;
  insert into public.billing_plans (professional_id, shadow)
  values (p_professional_id, p_shadow)
  on conflict (professional_id)
  do update set shadow = excluded.shadow, updated_at = now();
end;
$$;

comment on function public.set_billing_shadow(uuid, boolean) is
  'Skuggläget per byrå (pilotens spår A). Påverkar endast FRAMTIDA avgifter - redan stämplade rader behåller sitt läge.';

revoke all on function public.set_billing_shadow(uuid, boolean) from public;
grant execute on function public.set_billing_shadow(uuid, boolean) to authenticated;

-- Upplåsningen stämplar skuggan ur planens läge i samma transaktion.
create or replace function public.unlock_case_lead(
  p_request_id uuid,
  p_terms_version text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_req record;
  v_pro record;
  v_plan record;
  v_case record;
  v_fee numeric;
begin
  select r.* into v_req from public.contact_requests r where r.id = p_request_id for update;
  if not found then
    raise exception 'Förfrågan finns inte';
  end if;
  select p.* into v_pro from public.professionals p
  where p.id = v_req.professional_id and p.user_id = auth.uid();
  if not found then
    raise exception 'Förfrågan gäller inte din profil';
  end if;
  if v_req.status <> 'sent' then
    raise exception 'Förfrågan är redan hanterad';
  end if;
  if coalesce(trim(p_terms_version), '') = '' then
    raise exception 'Villkoren måste accepteras';
  end if;
  if v_pro.billing_hold then
    raise exception 'Kontot är spärrat för nya köp. Kontakta driften: %',
      coalesce(v_pro.billing_hold_reason, 'se din senaste faktura');
  end if;

  select coalesce(b.plan_kind, 'per_case') as plan_kind,
         b.unlock_fee_sek,
         coalesce(b.shadow, false) as shadow
  into v_plan
  from (select 1) one
  left join public.billing_plans b on b.professional_id = v_req.professional_id;

  update public.contact_requests
  set status = 'unlocked', unlocked_at = now(), unlocked_terms_version = trim(p_terms_version)
  where id = p_request_id;

  -- Avgift per upplåst ärende gäller planerna per_case och usage.
  -- Abonnemang och företagslicens debiterar inte per ärende här.
  v_fee := case when v_plan.plan_kind in ('per_case', 'usage') then v_plan.unlock_fee_sek else null end;
  if v_fee is not null and v_fee > 0 then
    select c.company_name, c.org_number, c.recommendation_type::text as recommendation_type
    into v_case
    from public.cases c where c.id = v_req.case_id;
    insert into public.usage_charges
      (professional_id, user_id, contact_request_id, service_code, service_label,
       case_type, company_name, org_number, amount_ore, shadow)
    values
      (v_req.professional_id, auth.uid(), p_request_id, 'case_unlock', 'Ärende upplåst',
       v_case.recommendation_type, v_case.company_name, v_case.org_number,
       round(v_fee * 100), v_plan.shadow);
  end if;

  return v_req.summary;
end;
$$;

-- Månadsjobbet: skuggrader skapas (abonnemang) och visas, men varken
-- faktureras eller stämplas med invoice_id.
create or replace function public.issue_usage_invoices(p_now timestamptz default now())
returns table (
  invoice_id uuid,
  user_id uuid,
  recipient text,
  customer_name text,
  invoice_number text,
  issued_at timestamptz,
  due_at timestamptz,
  net_ore bigint,
  vat_ore bigint,
  gross_ore bigint,
  charge_count bigint,
  period_start date,
  skipped_reason text
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_period_start date := (date_trunc('month', (p_now at time zone 'Europe/Stockholm')::date) - interval '1 month')::date;
  v_period_end date := date_trunc('month', (p_now at time zone 'Europe/Stockholm')::date)::date;
  v_year text := to_char(v_period_end, 'YYYY');
  v_seq int;
  v_candidate record;
  v_invoice_id uuid;
  v_number text;
  v_net bigint;
  v_vat bigint;
  v_email text;
begin
  -- Abonnemangsraderna för perioden, en per byrå, idempotent via det unika
  -- indexet (professional_id, period_start). Skuggläget stämplas på raden.
  insert into public.usage_charges
    (professional_id, user_id, service_code, service_label, amount_ore, period_start, shadow)
  select b.professional_id, p.user_id, 'subscription',
         'Abonnemang ' || to_char(v_period_start, 'YYYY-MM'),
         round(b.monthly_fee_sek * 100), v_period_start, b.shadow
  from public.billing_plans b
  join public.professionals p on p.id = b.professional_id
  where b.plan_kind = 'subscription'
    and b.monthly_fee_sek is not null
    and b.monthly_fee_sek > 0
    and p.user_id is not null
  on conflict do nothing;

  -- Nästa löpnummer i årets obrutna serie - samma serie som alla fakturor.
  select coalesce(max(substring(ci.invoice_number from '^\d{4}-(\d+)$')::int), 0)
  into v_seq
  from public.customer_invoices ci
  where ci.invoice_number like v_year || '-%';

  for v_candidate in
    select c.user_id as advisor_user_id,
           coalesce(p.company, p.name) as advisor_name,
           p.billing_email,
           count(*) as n_charges,
           sum(c.amount_ore) as total_ore
    from public.usage_charges c
    join public.professionals p on p.id = c.professional_id
    where c.invoice_id is null
      and not c.shadow
      and (
        (c.period_start is not null and c.period_start = v_period_start)
        or (c.period_start is null
            and (c.created_at at time zone 'Europe/Stockholm')::date >= v_period_start
            and (c.created_at at time zone 'Europe/Stockholm')::date < v_period_end)
      )
    group by c.user_id, p.company, p.name, p.billing_email
    order by coalesce(p.company, p.name)
  loop
    v_email := coalesce(
      v_candidate.billing_email,
      (select u.email from auth.users u where u.id = v_candidate.advisor_user_id)
    );
    if v_email is null then
      return query select null::uuid, v_candidate.advisor_user_id, null::text,
        v_candidate.advisor_name, null::text, null::timestamptz, null::timestamptz,
        null::bigint, null::bigint, null::bigint, v_candidate.n_charges,
        v_period_start, 'faktureringsadress saknas'::text;
      continue;
    end if;

    v_net := v_candidate.total_ore;
    v_vat := round(v_net * 0.25);
    v_seq := v_seq + 1;
    v_number := v_year || '-' || lpad(v_seq::text, 4, '0');

    insert into public.customer_invoices
      (user_id, invoice_number, due_at, net_ore, vat_ore, gross_ore, vat_rate, description)
    values (
      v_candidate.advisor_user_id, v_number,
      p_now + interval '10 days',
      v_net, v_vat, v_net + v_vat, 0.25,
      'Användningsavgifter ' || to_char(v_period_start, 'YYYY-MM') ||
        ' (' || v_candidate.n_charges || ' poster)'
    )
    returning id into v_invoice_id;

    update public.usage_charges c
    set invoice_id = v_invoice_id
    where c.user_id = v_candidate.advisor_user_id
      and c.invoice_id is null
      and not c.shadow
      and (
        (c.period_start is not null and c.period_start = v_period_start)
        or (c.period_start is null
            and (c.created_at at time zone 'Europe/Stockholm')::date >= v_period_start
            and (c.created_at at time zone 'Europe/Stockholm')::date < v_period_end)
      );

    return query select v_invoice_id, v_candidate.advisor_user_id, v_email,
      v_candidate.advisor_name, v_number, p_now, p_now + interval '10 days',
      v_net, v_vat, v_net + v_vat, v_candidate.n_charges, v_period_start, null::text;
  end loop;
end;
$$;

revoke execute on function public.issue_usage_invoices(timestamptz) from public, anon, authenticated;
