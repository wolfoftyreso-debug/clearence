-- Kreditbevakning: daglig status från kreditupplysningsföretag.
--
-- Beslut: Creditsafe kopplas på så att ärendet alltid har färsk
-- kreditstatus. Tabellen är leverantörsneutral (provider-kolumn) - byts
-- eller kompletteras leverantören är det en ny rad, inte en ny tabell.
--
-- Skrivningen görs ENBART av det dagliga jobbet, aldrig av klienten: en
-- kreditstatus användaren kan skriva själv är ingen kreditstatus. Därför
-- finns ingen insert- eller update-policy för authenticated - jobbet
-- ansluter med sin egen databasroll.

create table public.credit_monitoring (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  org_number text not null,
  provider text not null default 'creditsafe',
  -- Leverantörens bedömning som text ("A", "40", "Kreditvärdig"). Text, inte
  -- tal: skalorna skiljer mellan leverantörer och får inte räknas på som om
  -- de vore jämförbara.
  rating text,
  score integer,
  credit_limit_sek bigint,
  /** Hela svaret, för spårbarhet och för fält vi inte modellerat än. */
  raw jsonb,
  checked_at timestamptz not null default now()
);

comment on table public.credit_monitoring is
  'Daglig kreditstatus från kreditupplysning. Skrivs bara av jobbet (db/worker, --credit) - aldrig av klienten.';

create index credit_monitoring_case_idx on public.credit_monitoring (case_id, checked_at desc);

alter table public.credit_monitoring enable row level security;

-- Ärendets medlemmar läser; borgenärer utesluts som vanligt via
-- has_case_access. Ingen skrivpolicy alls för klientroller.
create policy credit_monitoring_members_read
  on public.credit_monitoring for select to authenticated
  using (public.has_case_access(case_id));

grant select on public.credit_monitoring to authenticated;

/**
 * Jobbet frågar: vilka bolag ska kontrolleras idag?
 *
 * Ett ärende per organisationsnummer, och bara ärenden som inte redan
 * kontrollerats det senaste dygnet - jobbet ska gå att köra hur ofta som
 * helst utan att elda upplysningar i onödan, för varje slagning kostar
 * pengar hos leverantören.
 */
create or replace function public.credit_check_candidates(p_now timestamptz default now())
returns table (case_id uuid, org_number text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select distinct on (c.org_number) c.id, c.org_number
  from public.cases c
  where not exists (
    select 1 from public.credit_monitoring m
    where m.case_id = c.id
      and m.checked_at > p_now - interval '24 hours'
  )
  order by c.org_number, c.created_at desc;
$$;
