-- DEN SKARPA GALLRINGEN, GREN FÖR GREN (GDPR art. 5.1 e).
--
-- Varför det här provet finns: app.gallra() har sex grenar, och FEM AV DEM
-- HADE ALDRIG KÖRTS. Bara 'hastighetsgrans' prövades (radering.sql, ok 16).
-- En gren som raderar rader ur produktionens tabeller - en av dem skriver
-- till och med om auth.users - är inte prövad av att den kompilerar.
--
-- Varje gren prövas med SAMMA FRÅGA, ställd två gånger:
--
--   Försvann det som skulle försvinna?   (annars gallrar den inte)
--   Står det kvar som skulle stå kvar?   (annars gallrar den för mycket)
--
-- Den andra frågan är den viktiga. Ett prov som bara räknar borttagna rader
-- är grönt även för en gren som tömmer hela tabellen, och en gallring som
-- tar för mycket är den dyraste buggen i hela produkten: den syns först när
-- någon letar efter något som inte finns kvar.
--
-- Skuggläget prövas per gren av samma skäl som i radering.sql: siffran
-- skuggläget visar ska vara siffran den skarpa körningen tar.
--
-- Körs som tabellägare i en transaktion som rullas tillbaka.

begin;

insert into auth.users (id, email, password_hash) values
  ('e0000000-0000-0000-0000-000000000001', 'gammal@exempel.se', 'scrypt$1$2$3$abc$def'),
  ('e0000000-0000-0000-0000-000000000002', 'fersk@exempel.se', 'scrypt$1$2$3$abc$def'),
  ('e0000000-0000-0000-0000-000000000003', 'oppen@exempel.se', 'scrypt$1$2$3$abc$def');

insert into public.user_profiles (user_id, role, display_name, phone) values
  ('e0000000-0000-0000-0000-000000000001', 'company', 'Gammal Gustafsson', '+46701111111'),
  ('e0000000-0000-0000-0000-000000000002', 'company', 'Färsk Fredriksson', '+46702222222'),
  ('e0000000-0000-0000-0000-000000000003', 'company', 'Öppen Olsson', '+46703333333');

insert into public.cases (id, user_id, org_number, company_name) values
  ('f0000000-0000-0000-0000-000000000001',
   'e0000000-0000-0000-0000-000000000001', '556700-0001', 'Gallringsbolaget AB');

/* -------------------------------------------------------------------------- */
/* 1. notiser_lasta                                                           */
/* -------------------------------------------------------------------------- */

-- Tre notiser: en läst för länge sedan, en läst nyss, en olÄst och gammal.
-- Bara den första ska försvinna. Den olästa är fällan: läser grenen på
-- created_at i stället för read_at tas den med.
insert into public.notification_events
  (user_id, case_id, kind, severity, title, body, href, dedupe_key, created_at, read_at)
values
  ('e0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001',
   'atgard-kravs', 'atgard', 'Gammal och läst', 'text', '/dashboard', 'g:1',
   now() - interval '3 years', now() - interval '2 years'),
  ('e0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001',
   'atgard-kravs', 'atgard', 'Läst nyss', 'text', '/dashboard', 'g:2',
   now() - interval '3 years', now() - interval '1 day'),
  ('e0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001',
   'atgard-kravs', 'atgard', 'Gammal men oläst', 'text', '/dashboard', 'g:3',
   now() - interval '3 years', null);

do $$
declare
  v_torr integer;
  v_skarp integer;
begin
  v_torr := app.gallra('notiser_lasta', now() - interval '6 months', true);
  if v_torr <> 1 then
    raise exception 'FAIL  skuggan räknade % lästa notiser, väntade 1', v_torr;
  end if;
  if (select count(*) from public.notification_events) <> 3 then
    raise exception 'FAIL  skuggläget tog bort notiser';
  end if;
  v_skarp := app.gallra('notiser_lasta', now() - interval '6 months', false);
  if v_skarp <> v_torr then
    raise exception 'FAIL  skarp körning tog % notiser, skuggan sa %', v_skarp, v_torr;
  end if;
  if exists (select 1 from public.notification_events where title = 'Gammal och läst') then
    raise exception 'FAIL  den gamla lästa notisen finns kvar';
  end if;
  if not exists (select 1 from public.notification_events where title = 'Läst nyss') then
    raise exception 'FAIL  en nyss läst notis gallrades';
  end if;
  if not exists (select 1 from public.notification_events where title = 'Gammal men oläst') then
    raise exception 'FAIL  en oläst notis gallrades - grenen läser fel kolumn';
  end if;
  raise notice 'ok 1: lästa notiser gallras, olästa och nyss lästa står kvar';
end $$;

/* -------------------------------------------------------------------------- */
/* 2. delningslankar_utgangna                                                 */
/* -------------------------------------------------------------------------- */

-- Fyra länkar: utgången för länge sedan, återkallad för länge sedan,
-- utgången nyss, och en levande. De två första ska bort.
insert into public.case_share_links (case_id, created_by, label, expires_at, revoked_at) values
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001',
   'utgången länge sedan', now() - interval '2 years', null),
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001',
   'återkallad länge sedan', now() + interval '1 year', now() - interval '2 years'),
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001',
   'utgången nyss', now() - interval '1 day', null),
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001',
   'levande', now() + interval '30 days', null);

do $$
declare
  v_torr integer;
  v_skarp integer;
begin
  v_torr := app.gallra('delningslankar_utgangna', now() - interval '3 months', true);
  if v_torr <> 2 then
    raise exception 'FAIL  skuggan räknade % länkar, väntade 2', v_torr;
  end if;
  if (select count(*) from public.case_share_links) <> 4 then
    raise exception 'FAIL  skuggläget tog bort länkar';
  end if;
  v_skarp := app.gallra('delningslankar_utgangna', now() - interval '3 months', false);
  if v_skarp <> v_torr then
    raise exception 'FAIL  skarp körning tog % länkar, skuggan sa %', v_skarp, v_torr;
  end if;
  if not exists (select 1 from public.case_share_links where label = 'levande') then
    raise exception 'FAIL  en levande delningslänk gallrades';
  end if;
  if not exists (select 1 from public.case_share_links where label = 'utgången nyss') then
    raise exception 'FAIL  en nyss utgången länk gallrades före sin tid';
  end if;
  if (select count(*) from public.case_share_links) <> 2 then
    raise exception 'FAIL  fel antal länkar kvar';
  end if;
  raise notice 'ok 2: utgångna och återkallade länkar gallras, levande står kvar';
end $$;

/* -------------------------------------------------------------------------- */
/* 3. samtalsjournal_avslutad                                                 */
/* -------------------------------------------------------------------------- */

-- Anonymisering, inte radering: raden ska stå kvar med tom fritext.
insert into public.advisor_sessions (id, case_id, flow_id, flow_title, started_at, closed_at, entries) values
  ('11110000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001',
   'kris', 'Avslutat för länge sedan', now() - interval '4 years', now() - interval '3 years',
   '[{"fraga":"Vem är borgenären?","svar":"Anna Andersson, 070-1234567"}]'::jsonb),
  ('11110000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001',
   'kris', 'Avslutat nyss', now() - interval '1 month', now() - interval '2 days',
   '[{"fraga":"Vem är borgenären?","svar":"Bertil Bok"}]'::jsonb),
  ('11110000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001',
   'kris', 'Fortfarande öppet', now() - interval '4 years', null,
   '[{"fraga":"Vem är borgenären?","svar":"Cecilia Carlsson"}]'::jsonb);

do $$
declare
  v_torr integer;
  v_skarp integer;
begin
  v_torr := app.gallra('samtalsjournal_avslutad', now() - interval '24 months', true);
  if v_torr <> 1 then
    raise exception 'FAIL  skuggan räknade % samtal, väntade 1', v_torr;
  end if;
  if (select entries from public.advisor_sessions
       where id = '11110000-0000-0000-0000-000000000001') = '[]'::jsonb then
    raise exception 'FAIL  skuggläget tömde fritexten';
  end if;
  v_skarp := app.gallra('samtalsjournal_avslutad', now() - interval '24 months', false);
  if v_skarp <> v_torr then
    raise exception 'FAIL  skarp körning tog % samtal, skuggan sa %', v_skarp, v_torr;
  end if;
  if (select count(*) from public.advisor_sessions) <> 3 then
    raise exception 'FAIL  en session raderades - åtgärden är anonymisera, inte radera';
  end if;
  if (select entries from public.advisor_sessions
       where id = '11110000-0000-0000-0000-000000000001') <> '[]'::jsonb then
    raise exception 'FAIL  fritexten i det gamla samtalet står kvar';
  end if;
  if (select entries from public.advisor_sessions
       where id = '11110000-0000-0000-0000-000000000002') = '[]'::jsonb then
    raise exception 'FAIL  ett nyss avslutat samtal anonymiserades';
  end if;
  if (select entries from public.advisor_sessions
       where id = '11110000-0000-0000-0000-000000000003') = '[]'::jsonb then
    raise exception 'FAIL  ett ÖPPET samtal anonymiserades';
  end if;
  -- En andra körning ska inte räkna om samma rad: den är redan tom.
  if app.gallra('samtalsjournal_avslutad', now() - interval '24 months', true) <> 0 then
    raise exception 'FAIL  ett redan anonymiserat samtal räknas igen';
  end if;
  raise notice 'ok 3: fritext i gamla avslutade samtal töms, raden och de övriga står kvar';
end $$;

/* -------------------------------------------------------------------------- */
/* 4. kontakt_avslutade_konton                                                */
/* -------------------------------------------------------------------------- */

-- Den vassaste grenen: den skriver om auth.users. Ett konto stängt för
-- länge sedan ska anonymiseras; ett nyss stängt och ett öppet ska inte.
insert into public.account_billing (user_id, closed_at) values
  ('e0000000-0000-0000-0000-000000000001', now() - interval '3 years'),
  ('e0000000-0000-0000-0000-000000000002', now() - interval '1 month'),
  ('e0000000-0000-0000-0000-000000000003', null);

insert into public.verified_phones (user_id, e164, verified_at) values
  ('e0000000-0000-0000-0000-000000000001', '+46701111111', now() - interval '3 years'),
  ('e0000000-0000-0000-0000-000000000002', '+46702222222', now() - interval '1 month');

do $$
declare
  v_torr integer;
  v_skarp integer;
begin
  v_torr := app.gallra('kontakt_avslutade_konton', now() - interval '24 months', true);
  if v_torr <> 1 then
    raise exception 'FAIL  skuggan räknade % konton, väntade 1', v_torr;
  end if;
  if (select email from auth.users where id = 'e0000000-0000-0000-0000-000000000001')
     <> 'gammal@exempel.se' then
    raise exception 'FAIL  skuggläget skrev om ett konto';
  end if;

  v_skarp := app.gallra('kontakt_avslutade_konton', now() - interval '24 months', false);
  if v_skarp <> v_torr then
    raise exception 'FAIL  skarp körning tog % konton, skuggan sa %', v_skarp, v_torr;
  end if;

  -- Det gamla kontot: namn, telefon och e-post borta, raden kvar och låst.
  if (select display_name from public.user_profiles
       where user_id = 'e0000000-0000-0000-0000-000000000001') is not null then
    raise exception 'FAIL  namnet står kvar på det stängda kontot';
  end if;
  if (select phone from public.user_profiles
       where user_id = 'e0000000-0000-0000-0000-000000000001') is not null then
    raise exception 'FAIL  telefonnumret står kvar på det stängda kontot';
  end if;
  if exists (select 1 from public.verified_phones
              where user_id = 'e0000000-0000-0000-0000-000000000001') then
    raise exception 'FAIL  det verifierade numret står kvar';
  end if;
  if (select email from auth.users where id = 'e0000000-0000-0000-0000-000000000001')
     not like '%@borttaget.invalid' then
    raise exception 'FAIL  e-postadressen står kvar';
  end if;
  if (select disabled_at from auth.users where id = 'e0000000-0000-0000-0000-000000000001')
     is null then
    raise exception 'FAIL  kontot går fortfarande att logga in på';
  end if;
  if (select password_hash from auth.users where id = 'e0000000-0000-0000-0000-000000000001')
     like 'scrypt$%' then
    raise exception 'FAIL  lösenordshashen står kvar';
  end if;

  -- Ärendet rörs inte: det här är kontaktuppgifter, inte radering på begäran.
  if not exists (select 1 from public.cases where id = 'f0000000-0000-0000-0000-000000000001') then
    raise exception 'FAIL  ärendet raderades - grenen är smalare än art. 17 med avsikt';
  end if;

  -- De två andra kontona ska vara orörda.
  if (select display_name from public.user_profiles
       where user_id = 'e0000000-0000-0000-0000-000000000002') is null then
    raise exception 'FAIL  ett nyss stängt konto anonymiserades';
  end if;
  if (select display_name from public.user_profiles
       where user_id = 'e0000000-0000-0000-0000-000000000003') is null then
    raise exception 'FAIL  ett ÖPPET konto anonymiserades';
  end if;
  if (select email from auth.users where id = 'e0000000-0000-0000-0000-000000000003')
     <> 'oppen@exempel.se' then
    raise exception 'FAIL  ett öppet konto skrevs om';
  end if;

  -- Andra körningen ska inte hitta samma konto igen (e-posten är redan bytt).
  if app.gallra('kontakt_avslutade_konton', now() - interval '24 months', true) <> 0 then
    raise exception 'FAIL  ett redan anonymiserat konto räknas igen';
  end if;
  raise notice 'ok 4: gamla stängda konton anonymiseras; nyss stängda, öppna och ärendet står kvar';
end $$;

/* -------------------------------------------------------------------------- */
/* 5. Brytdatumet                                                             */
/* -------------------------------------------------------------------------- */

do $$
begin
  -- Utan brytdatum gallras ingenting, oavsett kategori. Det är den gren som
  -- gjorde en trasig driftparameter till en tyst nolla; nu avvisar
  -- retentionOverrideProblems() den kombinationen innan den når hit.
  if app.gallra('notiser_lasta', null, false) <> 0 then
    raise exception 'FAIL  gallring utan brytdatum rörde rader';
  end if;
  raise notice 'ok 5: utan brytdatum rörs ingenting';
end $$;

do $$
begin
  raise notice 'ALL RETENTION TESTS PASSED';
end $$;

rollback;
