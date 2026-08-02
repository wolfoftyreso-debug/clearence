-- Kontaktförfrågan, ärendeförhandsvisning och "Lås upp ärendet".
--
-- Modellskiftet: företaget VÄLJER rådgivare och godkänner uttryckligen vad
-- som delas. Rådgivaren ser först en avidentifierad förhandsvisning
-- (bransch, storlek, område, problemtyp, komplexitet, dokumentlista) och
-- låser upp ärendet mot plattformens villkor - först då syns bolagets
-- identitet, kontaktvägar och den fulla sammanfattningen, och först då
-- registreras en avgift. Det gör plattformen attraktiv för byrån (inga
-- kostnader för irrelevanta ärenden) och ren mot företaget (ingenting
-- delas utan samtycke, och delningen är spårbar).
--
-- AFFÄRSMODELLEN ÄR PARAMETRAR, INTE KOD: per-ärende-avgift, abonnemang,
-- användningsdebitering eller företagslicens sätts av driften per byrå i
-- billing_plans. Inga belopp är hårdkodade någonstans.
--
-- FAKTURA FÖRST: avgifter registreras som usage_charges och samlas till EN
-- månadsfaktura per byrå (issue_usage_invoices). Kredit- och spärrlagret
-- (billing_hold) finns från dag ett men är AVSTÄNGT som standard - regeln
-- kan aktiveras per byrå utan ombyggnad, i linje med "förtroende först".

/* --- prisplaner ----------------------------------------------------------- */

create table public.billing_plans (
  professional_id uuid primary key references public.professionals(id) on delete cascade,
  plan_kind text not null default 'per_case'
    check (plan_kind in ('per_case', 'subscription', 'usage', 'enterprise')),
  -- Kronor. Null = ingen avgift avtalad än; upplåsning är då kostnadsfri
  -- och driften ser det i sin översikt i stället för att systemet gissar.
  unlock_fee_sek numeric check (unlock_fee_sek is null or (unlock_fee_sek >= 0 and unlock_fee_sek <= 100000)),
  monthly_fee_sek numeric check (monthly_fee_sek is null or (monthly_fee_sek >= 0 and monthly_fee_sek <= 1000000)),
  included_cases int check (included_cases is null or included_cases >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.billing_plans is
  'Byråns avtalade prismodell. per_case/usage: avgift per upplåst ärende. subscription: månadsavgift, per-ärende-avgift 0. enterprise: allt enligt separat avtal, inga automatiska avgifter.';

alter table public.billing_plans enable row level security;

-- Byrån ser sin egen plan (villkoren ska synas INNAN upplåsning), driften allt.
create policy billing_plans_read
  on public.billing_plans
  for select
  to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1 from public.professionals p
      where p.id = professional_id and p.user_id = auth.uid()
    )
  );
-- Inga skrivpolicyer: planen sätts av driften genom set_billing_plan().

/* --- kredit- och spärrlagret ---------------------------------------------- */

-- Byggt nu, avstängt nu: grundprincipen är faktura och förtroende. Spärren
-- prövas i unlock_case_lead, så en aktivering kräver ingen ombyggnad.
alter table public.professionals
  add column billing_hold boolean not null default false,
  add column billing_hold_reason text;

comment on column public.professionals.billing_hold is
  'Spärr för nya avgiftsbelagda köp (t.ex. vid upprepade sena betalningar). Standard av - förtroende först.';

/* --- kontaktförfrågningar -------------------------------------------------- */

create table public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'sent' check (status in ('sent', 'unlocked', 'declined', 'withdrawn')),
  -- Avidentifierad förhandsvisning: det rådgivaren ser FÖRE upplåsning.
  -- Byggd i klienten ur ärendet; innehåller aldrig namn, orgnr eller
  -- kontaktvägar - kontrollen av det är UI:ts och granskas i test.
  preview jsonb not null,
  -- Den fulla strukturerade ärendesammanfattningen: situation, nyckeltal,
  -- systemanalys, dokumentlista och skälet till kontakten. Visas för
  -- rådgivaren först efter upplåsning.
  summary jsonb not null,
  -- Samtycket: stämplas när företrädaren skickar förfrågan. Ingen rad
  -- utan samtycke - kolumnen är not null med flit.
  consent_at timestamptz not null default now(),
  unlocked_at timestamptz,
  unlocked_terms_version text,
  declined_at timestamptz,
  decline_note text,
  created_at timestamptz not null default now()
);

create index contact_requests_case_idx on public.contact_requests (case_id);
create index contact_requests_professional_idx on public.contact_requests (professional_id, status);

alter table public.contact_requests enable row level security;

-- Företagssidan följer sina egna förfrågningar med full insyn: vem som
-- kontaktats, vad som delats, när och med vilket samtycke.
-- Rådgivaren läser ALDRIG tabellen direkt - kolumnerna case_id och summary
-- skulle avslöja identiteten före upplåsning. Rådgivarens läsning går genom
-- list_lead_previews() och get_unlocked_lead(), som skiljer på före/efter.
create policy contact_requests_company_read
  on public.contact_requests
  for select
  to authenticated
  using (public.has_case_access(case_id));
-- Inga direkta skrivpolicyer: create/unlock/decline går genom funktionerna.

/* --- användningsavgifter --------------------------------------------------- */

create table public.usage_charges (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_request_id uuid references public.contact_requests(id) on delete set null,
  service_code text not null check (service_code in ('case_unlock', 'subscription')),
  service_label text not null,
  -- Fakturaradens sammanhang: ärendetyp, bolag och orgnr. Fylls i vid
  -- upplåsningen - då är identiteten redan delad med samtycke, och
  -- samlingsfakturan får inte innehålla mer än mottagaren redan vet.
  case_type text,
  company_name text,
  org_number text,
  amount_ore bigint not null check (amount_ore >= 0),
  vat_rate numeric not null default 0.25,
  -- För abonnemangsrader: vilken period avgiften avser (idempotensnyckel).
  period_start date,
  invoice_id uuid references public.customer_invoices(id) on delete set null,
  created_at timestamptz not null default now()
);

create index usage_charges_uninvoiced_idx
  on public.usage_charges (user_id, created_at)
  where invoice_id is null;
create unique index usage_charges_subscription_once
  on public.usage_charges (professional_id, period_start)
  where service_code = 'subscription';

comment on table public.usage_charges is
  'Löpande debiteringar. Varje rad spårar till en konkret aktivitet (upplåsning eller abonnemangsperiod) och samlas till en månadsfaktura av issue_usage_invoices(). invoice_id sätts i samma transaktion som fakturan - en rad faktureras en gång.';

alter table public.usage_charges enable row level security;

-- Byrån ser sina egna debiteringar löpande - det är debiteringsöversikten.
create policy usage_charges_own_read
  on public.usage_charges
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_platform_admin());
-- Inga skrivpolicyer: rader skapas av unlock_case_lead och månadsjobbet.

/* --- funktioner ------------------------------------------------------------ */

/**
 * Företagets kontaktförfrågan. Kräver skrivbehörighet i ärendet - att dela
 * bolagets kris utåt är ett företrädarbeslut. Samtycket stämplas i raden.
 */
create or replace function public.create_contact_request(
  p_case_id uuid,
  p_professional_id uuid,
  p_preview jsonb,
  p_summary jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Kräver inloggning';
  end if;
  if not public.can_write_case(p_case_id) then
    raise exception 'Kräver företrädarbehörighet i ärendet';
  end if;
  if not exists (select 1 from public.professionals where id = p_professional_id and active = true) then
    raise exception 'Rådgivaren finns inte i katalogen';
  end if;
  if exists (
    select 1 from public.contact_requests
    where case_id = p_case_id
      and professional_id = p_professional_id
      and status in ('sent', 'unlocked')
  ) then
    raise exception 'Rådgivaren är redan kontaktad i det här ärendet';
  end if;

  insert into public.contact_requests (case_id, professional_id, created_by, preview, summary)
  values (p_case_id, p_professional_id, auth.uid(), p_preview, p_summary)
  returning id into v_id;
  return v_id;
end;
$$;

comment on function public.create_contact_request(uuid, uuid, jsonb, jsonb) is
  'Företaget väljer rådgivare och godkänner delningen. Förhandsvisningen är avidentifierad; sammanfattningen låses upp först mot villkor.';

/**
 * Rådgivarens inkorg: förhandsvisningar av förfrågningar till de profiler
 * kontot företräder. FÖRE upplåsning returneras bara preview - aldrig
 * case_id, aldrig summary. Avgiften som gäller vid upplåsning följer med,
 * så beslutet fattas med priset synligt.
 */
create or replace function public.list_lead_previews()
returns table (
  id uuid,
  professional_id uuid,
  status text,
  created_at timestamptz,
  unlocked_at timestamptz,
  preview jsonb,
  plan_kind text,
  unlock_fee_sek numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.id, r.professional_id, r.status, r.created_at, r.unlocked_at, r.preview,
         coalesce(b.plan_kind, 'per_case'), b.unlock_fee_sek
  from public.contact_requests r
  join public.professionals p on p.id = r.professional_id
  left join public.billing_plans b on b.professional_id = p.id
  where p.user_id = auth.uid()
    and r.status <> 'withdrawn'
  order by (r.status = 'sent') desc, r.created_at desc;
$$;

/**
 * Upplåsningen: rådgivaren accepterar villkoren och får den fulla
 * sammanfattningen. Avgiften registreras i samma transaktion, enligt
 * byråns plan. Spärrlagret prövas här - avstängt som standard.
 */
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

  select coalesce(b.plan_kind, 'per_case') as plan_kind, b.unlock_fee_sek
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
       case_type, company_name, org_number, amount_ore)
    values
      (v_req.professional_id, auth.uid(), p_request_id, 'case_unlock', 'Ärende upplåst',
       v_case.recommendation_type, v_case.company_name, v_case.org_number,
       round(v_fee * 100));
  end if;

  return v_req.summary;
end;
$$;

comment on function public.unlock_case_lead(uuid, text) is
  'Rådgivaren accepterar villkoren; sammanfattningen låses upp och avgiften registreras enligt byråns plan i samma transaktion. billing_hold prövas här.';

/**
 * Rådgivaren avböjer. Kostar ingenting; företaget ser beskedet.
 */
create or replace function public.decline_case_lead(p_request_id uuid, p_note text default null)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_req record;
begin
  select r.* into v_req from public.contact_requests r where r.id = p_request_id for update;
  if not found then
    raise exception 'Förfrågan finns inte';
  end if;
  if not exists (
    select 1 from public.professionals p
    where p.id = v_req.professional_id and p.user_id = auth.uid()
  ) then
    raise exception 'Förfrågan gäller inte din profil';
  end if;
  if v_req.status <> 'sent' then
    raise exception 'Förfrågan är redan hanterad';
  end if;
  update public.contact_requests
  set status = 'declined', declined_at = now(), decline_note = nullif(trim(coalesce(p_note, '')), '')
  where id = p_request_id;
end;
$$;

/**
 * Den upplåsta sammanfattningen, för återbesök efter upplåsningen.
 */
create or replace function public.get_unlocked_lead(p_request_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.summary
  from public.contact_requests r
  join public.professionals p on p.id = r.professional_id
  where r.id = p_request_id
    and p.user_id = auth.uid()
    and r.status = 'unlocked';
$$;

/**
 * Driftens plansättning. Avtalsuppgift: byrån ställer aldrig in den själv.
 */
create or replace function public.set_billing_plan(
  p_professional_id uuid,
  p_plan_kind text,
  p_unlock_fee_sek numeric default null,
  p_monthly_fee_sek numeric default null,
  p_included_cases int default null
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
  insert into public.billing_plans (professional_id, plan_kind, unlock_fee_sek, monthly_fee_sek, included_cases, updated_at)
  values (p_professional_id, p_plan_kind, p_unlock_fee_sek, p_monthly_fee_sek, p_included_cases, now())
  on conflict (professional_id) do update
  set plan_kind = excluded.plan_kind,
      unlock_fee_sek = excluded.unlock_fee_sek,
      monthly_fee_sek = excluded.monthly_fee_sek,
      included_cases = excluded.included_cases,
      updated_at = now();
end;
$$;

/**
 * Driftens spärrknapp. Prövas vid nästa avgiftsbelagda köp, inget mer:
 * pågående ärenden och läsning påverkas inte.
 */
create or replace function public.set_billing_hold(
  p_professional_id uuid,
  p_hold boolean,
  p_reason text default null
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
  if p_hold and coalesce(trim(p_reason), '') = '' then
    raise exception 'En spärr kräver ett skäl';
  end if;
  update public.professionals
  set billing_hold = p_hold,
      billing_hold_reason = case when p_hold then trim(p_reason) else null end
  where id = p_professional_id;
end;
$$;

/**
 * Månadsjobbet: EN samlingsfaktura per byrå för föregående svenska
 * kalendermånads debiteringar. Abonnemangsavgifter läggs till som rader
 * först (idempotent per period), sedan faktureras allt ofakturerat i
 * perioden. Raderna behåller sin koppling via invoice_id - det är
 * specifikationen i byråns fakturacentral.
 */
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
  -- indexet (professional_id, period_start).
  insert into public.usage_charges
    (professional_id, user_id, service_code, service_label, amount_ore, period_start)
  select b.professional_id, p.user_id, 'subscription',
         'Abonnemang ' || to_char(v_period_start, 'YYYY-MM'),
         round(b.monthly_fee_sek * 100), v_period_start
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

comment on function public.issue_usage_invoices(timestamptz) is
  'Månadsjobb (db/worker --invoice-usage). En samlingsfaktura per byrå; raderna behåller kopplingen via invoice_id och blir fakturans digitala specifikation.';

/* --- behörigheter ---------------------------------------------------------- */

revoke all on function public.create_contact_request(uuid, uuid, jsonb, jsonb) from public;
revoke all on function public.list_lead_previews() from public;
revoke all on function public.unlock_case_lead(uuid, text) from public;
revoke all on function public.decline_case_lead(uuid, text) from public;
revoke all on function public.get_unlocked_lead(uuid) from public;
revoke all on function public.set_billing_plan(uuid, text, numeric, numeric, int) from public;
revoke all on function public.set_billing_hold(uuid, boolean, text) from public;
grant execute on function public.create_contact_request(uuid, uuid, jsonb, jsonb) to authenticated;
grant execute on function public.list_lead_previews() to authenticated;
grant execute on function public.unlock_case_lead(uuid, text) to authenticated;
grant execute on function public.decline_case_lead(uuid, text) to authenticated;
grant execute on function public.get_unlocked_lead(uuid) to authenticated;
grant execute on function public.set_billing_plan(uuid, text, numeric, numeric, int) to authenticated;
grant execute on function public.set_billing_hold(uuid, boolean, text) to authenticated;
