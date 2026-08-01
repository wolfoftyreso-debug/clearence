-- Månadsfakturering av förmedlingar.
--
-- Underlaget har funnits sedan förmedlingsmigrationen: avgiften stämplas på
-- raden när förfrågan skapas och blir fakturerbar när rådgivaren accepterar.
-- Det här är steget från underlag till faktura: en körning i månadsskiftet
-- som ställer ut EN faktura per rådgivare för föregående månads accepterade
-- förfrågningar, i samma obrutna nummerserie som kundfakturorna.
--
-- Tre regler:
--
--  1. EN FÖRMEDLING FAKTURERAS EN GÅNG. Raden märks med fakturans id i
--     samma transaktion som fakturan skapas. Körningen är därmed idempotent
--     - kör den tio gånger och det blir en faktura.
--
--  2. DET SOM INTE KAN FAKTURERAS RAPPORTERAS, TYST HOPPAS INGET ÖVER. En
--     lista utan kontokoppling eller utan avtalad avgift returneras som
--     överhoppad med skäl, så att driften ser det - intäkter som försvinner
--     ljudlöst är värre än intäkter som väntar.
--
--  3. BELOPPEN RÄKNAS I ÖREN, MOMSEN AVRUNDAS EN GÅNG. Samma regler som
--     kundfakturorna i src/lib/invoice.ts - två avrundningar ger fakturor
--     som inte summerar.

alter table public.referrals
  add column invoice_id uuid references public.customer_invoices (id) on delete set null;

comment on column public.referrals.invoice_id is
  'Satt när förmedlingen tagits med på en månadsfaktura. En förmedling faktureras en gång.';

create index referrals_uninvoiced_idx
  on public.referrals (billable_at)
  where billable_at is not null and invoice_id is null;

/**
 * Avgiften per förmedling, i kronor. Endast drift - avgiften är en
 * avtalsuppgift, inte något rådgivaren ställer in själv. Ändringen gäller
 * FRAMÅT: redan skapade förmedlingar behåller sin stämplade avgift.
 */
create or replace function public.set_referral_fee(p_professional_id uuid, p_fee_sek numeric)
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
  if p_fee_sek is not null and (p_fee_sek < 0 or p_fee_sek > 100000) then
    raise exception 'Orimlig avgift';
  end if;
  update public.professionals set referral_fee = p_fee_sek where id = p_professional_id;
end;
$$;

/**
 * Driftens vy över rådgivarnas villkor och ofakturerade underlag.
 */
create or replace function public.list_professional_terms()
returns table (
  professional_id uuid,
  name text,
  company text,
  billing_email text,
  referral_fee numeric,
  uninvoiced_billable bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Kräver driftbehörighet';
  end if;
  return query
  select p.id, p.name, p.company, p.billing_email, p.referral_fee,
         count(r.id) filter (where r.billable_at is not null and r.invoice_id is null)
  from public.professionals p
  left join public.referrals r on r.professional_id = p.id
  group by p.id, p.name, p.company, p.billing_email, p.referral_fee
  order by p.name;
end;
$$;

/**
 * Månadskörningen. Fakturerar föregående svenska kalendermånads
 * accepterade förmedlingar, en faktura per rådgivare.
 *
 * Returnerar både utställda fakturor (skipped_reason null) och överhoppade
 * rådgivare med skäl. Arbetaren bygger mejlen ur returen - innehållet ska
 * komma från samma mejlbyggare som allt annat, inte från SQL.
 */
create or replace function public.issue_referral_invoices(p_now timestamptz default now())
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
  referral_count bigint,
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
  -- Nästa löpnummer i årets serie, samma serie som kundfakturorna. MAX, inte
  -- COUNT: en makulerad faktura får aldrig göra att ett nummer återanvänds.
  select coalesce(max(substring(ci.invoice_number from '^\d{4}-(\d+)$')::int), 0)
  into v_seq
  from public.customer_invoices ci
  where ci.invoice_number like v_year || '-%';

  for v_candidate in
    select p.id as professional_id, p.user_id as advisor_user_id,
           coalesce(p.company, p.name) as advisor_name,
           p.billing_email,
           count(*) as n_billable,
           count(*) filter (where r.fee_amount is null) as n_missing_fee,
           sum(r.fee_amount) as total_fee_sek
    from public.referrals r
    join public.professionals p on p.id = r.professional_id
    where r.billable_at is not null
      and r.invoice_id is null
      and (r.billable_at at time zone 'Europe/Stockholm')::date >= v_period_start
      and (r.billable_at at time zone 'Europe/Stockholm')::date < v_period_end
    group by p.id, p.user_id, p.company, p.name, p.billing_email
    order by coalesce(p.company, p.name)
  loop
    v_email := coalesce(
      v_candidate.billing_email,
      (select u.email from auth.users u where u.id = v_candidate.advisor_user_id)
    );

    if v_candidate.advisor_user_id is null then
      return query select null::uuid, null::uuid, v_email, v_candidate.advisor_name,
        null::text, null::timestamptz, null::timestamptz, null::bigint, null::bigint,
        null::bigint, v_candidate.n_billable, v_period_start,
        'listan saknar kontokoppling'::text;
      continue;
    end if;
    if v_candidate.n_missing_fee > 0 then
      return query select null::uuid, v_candidate.advisor_user_id, v_email,
        v_candidate.advisor_name, null::text, null::timestamptz, null::timestamptz,
        null::bigint, null::bigint, null::bigint, v_candidate.n_billable,
        v_period_start, 'avtalad avgift saknas'::text;
      continue;
    end if;
    if v_email is null then
      return query select null::uuid, v_candidate.advisor_user_id, null::text,
        v_candidate.advisor_name, null::text, null::timestamptz, null::timestamptz,
        null::bigint, null::bigint, null::bigint, v_candidate.n_billable,
        v_period_start, 'faktureringsadress saknas'::text;
      continue;
    end if;

    -- Ören, momsen avrundad EN gång - samma regler som src/lib/invoice.ts.
    v_net := round(v_candidate.total_fee_sek * 100);
    v_vat := round(v_net * 0.25);
    v_seq := v_seq + 1;
    v_number := v_year || '-' || lpad(v_seq::text, 4, '0');

    insert into public.customer_invoices
      (user_id, invoice_number, due_at, net_ore, vat_ore, gross_ore, vat_rate, description)
    values (
      v_candidate.advisor_user_id, v_number,
      p_now + interval '10 days',
      v_net, v_vat, v_net + v_vat, 0.25,
      'Förmedlade förfrågningar ' || to_char(v_period_start, 'YYYY-MM') ||
        ' (' || v_candidate.n_billable || ' st)'
    )
    returning id into v_invoice_id;

    -- Märkningen i samma transaktion: en förmedling faktureras en gång.
    update public.referrals r
    set invoice_id = v_invoice_id
    where r.professional_id = v_candidate.professional_id
      and r.billable_at is not null
      and r.invoice_id is null
      and (r.billable_at at time zone 'Europe/Stockholm')::date >= v_period_start
      and (r.billable_at at time zone 'Europe/Stockholm')::date < v_period_end;

    return query select v_invoice_id, v_candidate.advisor_user_id, v_email,
      v_candidate.advisor_name, v_number, p_now, p_now + interval '10 days',
      v_net, v_vat, v_net + v_vat, v_candidate.n_billable, v_period_start, null::text;
  end loop;
end;
$$;

-- Körningen är arbetarens och driftens, inte klientens: en inloggad
-- användare ska inte kunna trigga faktureringen i förtid.
revoke execute on function public.issue_referral_invoices(timestamptz) from public, anon, authenticated;

comment on function public.issue_referral_invoices(timestamptz) is
  'Månadsjobb (db/worker --invoice-referrals). Idempotent: fakturerade förmedlingar märks i samma transaktion. Överhoppade rådgivare returneras med skäl.';
