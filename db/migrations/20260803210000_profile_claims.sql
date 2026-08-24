-- Partnerregistret: förifyllda profiler och "Är detta din profil?".
--
-- Katalogen ska kunna innehålla rådgivare som inte själva ansökt: profiler
-- förifyllda från offentliga källor (hemsidor, domstolarnas förordnande-
-- listor, branschregister). En sådan profil är EJ VERIFIERAD och märks så i
-- katalogen - transparens om vad plattformen vet och inte vet är hela
-- skillnaden mellan ett register och ett ryktesbibliotek.
--
-- ANTAGANDE, dokumenterat med flit: det finns inget myndighets-API med en
-- färdig lista över rekonstruktörer eller konkursförvaltare. Källorna för
-- förifyllnad är därför pluggbara (kolumnen source), och den enda källa som
-- ger märket "Verifierad" är vår egen granskning. Identifiering sker i dag
-- genom manuell kontroll av företrädarrätt (KYC); BankID-legitimering
-- kopplas på när avtalet finns, utan att flödet byggs om.
--
-- Anspråksflödet: den som känner igen sin byrå klickar "Är detta din
-- profil?", motiverar och lämnar kontaktväg. Anspråket hamnar hos driften,
-- som granskar och godkänner eller avslår. Godkännande kopplar profilen
-- till användarkontot och sätter verified - därefter kan innehavaren
-- uppdatera uppgifterna och ta emot förfrågningar som en ansökt rådgivare.

-- Varifrån en katalogpost kommer. 'application' = rådgivaren ansökte själv
-- och granskades; 'public_register' = förifylld från offentliga källor och
-- ännu inte bekräftad av byrån.
alter table public.professionals
  add column if not exists source text not null default 'application'
  check (source in ('application', 'public_register'));

comment on column public.professionals.source is
  'application = egen ansökan (granskad). public_register = förifylld från offentliga källor; verified sätts först när ett profilanspråk godkänts.';

-- Förifyllda, ej verifierade exempelposter. Uppenbart fiktiva namn av samma
-- skäl som demodatat: ingen i kris ska kunna ringa fel på grund av oss.
insert into public.professionals
  (name, company, category, description, location, email, phone, website, fixed_prices, specializations, verified, source)
values
  ('Nordqvist Rekonstruktion', 'Nordqvist Rekonstruktion AB', 'rekonstruktor',
   'Förifylld profil från offentliga källor. Uppgifterna är inte bekräftade av byrån - kontaktvägar kan vara inaktuella.',
   'Västerås', null, null, null, '[]'::jsonb, array['Företagsrekonstruktion'], false, 'public_register'),
  ('Advokatbyrån Ek & Söner', 'Advokatbyrån Ek & Söner KB', 'konkursforvaltare',
   'Förifylld profil från offentliga källor. Uppgifterna är inte bekräftade av byrån - kontaktvägar kan vara inaktuella.',
   'Örebro', null, null, null, '[]'::jsonb, array['Konkursförvaltning'], false, 'public_register');

-- Anspråken. Skrivs bara genom claim_professional_profile() så att
-- kontrollerna inte kan kringgås med en rå insert.
create table public.profile_claims (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Vem påstår sig vara företrädare, och hur kan påståendet kontrolleras?
  -- Fritext räcker: granskningen är manuell och underlaget arkiveras här.
  motivation text not null,
  contact text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_profile_claims_professional on public.profile_claims(professional_id);
create index idx_profile_claims_user on public.profile_claims(user_id);

alter table public.profile_claims enable row level security;

-- Den som gjort anspråket följer sitt eget ärende. Driften ser allt.
-- Inga insert/update/delete-policyer: allt skrivande går genom funktionerna.
create policy profile_claims_own_read
  on public.profile_claims
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_platform_admin());

-- Anspråket. SECURITY DEFINER för att kunna låsa professionals-raden och
-- pröva villkoren atomiskt - en kapplöpning mellan två anspråk på samma
-- profil får aldrig ge två godkännanden.
create or replace function public.claim_professional_profile(
  p_professional_id uuid,
  p_motivation text,
  p_contact text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Kräver inloggning';
  end if;
  if coalesce(trim(p_motivation), '') = '' or coalesce(trim(p_contact), '') = '' then
    raise exception 'Motivering och kontaktväg krävs';
  end if;

  select user_id into v_owner
  from public.professionals
  where id = p_professional_id and active = true
  for update;
  if not found then
    raise exception 'Profilen finns inte';
  end if;
  if v_owner is not null then
    raise exception 'Profilen är redan kopplad till ett konto';
  end if;
  if exists (
    select 1 from public.profile_claims
    where professional_id = p_professional_id
      and user_id = v_user
      and status = 'pending'
  ) then
    raise exception 'Du har redan ett anspråk under granskning';
  end if;

  insert into public.profile_claims (professional_id, user_id, motivation, contact)
  values (p_professional_id, v_user, trim(p_motivation), trim(p_contact))
  returning id into v_id;
  return v_id;
end;
$$;

comment on function public.claim_professional_profile(uuid, text, text) is
  'Anspråk på en förifylld katalogprofil. Avvisar redan kopplade profiler och dubbla väntande anspråk. Granskas manuellt av driften.';

-- Driftens lista: anspråken med profilnamn och sökandens e-post. E-posten
-- hämtas ur auth.users här, i stället för att exponera tabellen.
create or replace function public.list_profile_claims()
returns table (
  id uuid,
  professional_id uuid,
  professional_name text,
  claimant_email text,
  motivation text,
  contact text,
  status text,
  review_note text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id, c.professional_id, p.name, u.email::text, c.motivation, c.contact,
         c.status, c.review_note, c.created_at
  from public.profile_claims c
  join public.professionals p on p.id = c.professional_id
  join auth.users u on u.id = c.user_id
  where public.is_platform_admin()
  order by (c.status = 'pending') desc, c.created_at desc;
$$;

comment on function public.list_profile_claims() is
  'Drift: alla profilanspråk, väntande först. Tom för icke-administratörer.';

-- Beslutet. Godkännande kopplar profilen till kontot och sätter verified,
-- och avvisar samtidigt övriga väntande anspråk på samma profil - profilen
-- kan bara ha en innehavare, och de andra ska få ett besked, inte tystnad.
create or replace function public.review_profile_claim(
  p_claim_id uuid,
  p_approve boolean,
  p_note text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_claim record;
begin
  if not public.is_platform_admin() then
    raise exception 'Kräver driftbehörighet';
  end if;
  if not p_approve and coalesce(trim(p_note), '') = '' then
    raise exception 'Avslag kräver en motivering';
  end if;

  select * into v_claim from public.profile_claims where id = p_claim_id for update;
  if not found then
    raise exception 'Anspråket finns inte';
  end if;
  if v_claim.status <> 'pending' then
    raise exception 'Anspråket är redan avgjort';
  end if;

  if p_approve then
    -- Låset på professionals-raden gör godkännandet atomiskt gentemot nya
    -- anspråk (claim_professional_profile låser samma rad).
    perform 1 from public.professionals where id = v_claim.professional_id for update;
    update public.professionals
    set user_id = v_claim.user_id, verified = true, updated_at = now()
    where id = v_claim.professional_id;

    update public.profile_claims
    set status = 'rejected',
        review_note = 'Ett annat anspråk på profilen godkändes.',
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where professional_id = v_claim.professional_id
      and id <> p_claim_id
      and status = 'pending';
  end if;

  update public.profile_claims
  set status = case when p_approve then 'approved' else 'rejected' end,
      review_note = nullif(trim(coalesce(p_note, '')), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_claim_id;
end;
$$;

comment on function public.review_profile_claim(uuid, boolean, text) is
  'Drift: avgör ett profilanspråk. Godkännande kopplar profilen till kontot, sätter verified och avvisar konkurrerande anspråk.';

revoke all on function public.claim_professional_profile(uuid, text, text) from public;
revoke all on function public.list_profile_claims() from public;
revoke all on function public.review_profile_claim(uuid, boolean, text) from public;
grant execute on function public.claim_professional_profile(uuid, text, text) to authenticated;
grant execute on function public.list_profile_claims() to authenticated;
grant execute on function public.review_profile_claim(uuid, boolean, text) to authenticated;
