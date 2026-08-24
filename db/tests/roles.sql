-- Den självhostade rollmodellen, prövad. Förutsätter att
-- db/roles-selfhosted.sql redan körts (run.sh gör det före den här).
--
-- Två löften vaktas, och det andra är det som kostar mest om det bryts:
--  1. Arbetaren KAN röra utkorgen och köra arbetarfunktionerna - annars
--     faller nattjobbet på 42501, eller värre: returnerar noll utan att fela.
--  2. authenticated (API-rollens grund) går ALDRIG förbi radskyddet. Samma
--     insert som arbetaren får göra måste authenticated nekas.
--
-- ARBETAREN ÄR INTE ALLTID app_worker.
--
-- Provet krävde tidigare att app_worker fanns och hade BYPASSRLS. På ett
-- managed Postgres (Neon, Vercel Postgres) går BYPASSRLS inte att dela ut -
-- ägarrollen har det inte själv - och rollen skapas därför inte alls. Då kör
-- arbetaren som schemats ÄGARE, som är undantagen sin egen RLS. Båda
-- vägarna är giltiga; db/worker/roll.ts godtar båda och vägrar om ingen
-- gäller. Provet gör likadant.

-- 1. Attributen.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'app_worker')
     and (select rolbypassrls from pg_roles where rolname = 'app_worker') is distinct from true then
    raise exception 'app_worker finns men saknar bypassrls - arbetaren kan inte röra utkorgen';
  end if;
  if (select coalesce(rolbypassrls, false) from pg_roles where rolname = 'authenticated') then
    raise exception 'authenticated har bypassrls - radskyddet är avstängt för API-rollen';
  end if;
end $$;

-- 2. Arbetaren rör utkorgen och kör en arbetarfunktion. Som app_worker om
--    den finns, annars som ägaren (vilket sessionen redan är).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'app_worker') then
    execute 'set role app_worker';
  end if;
end $$;
insert into public.outbound_emails (recipient, subject, body_text, body_html, kind)
  values ('roletest@x.se', 's', 't', 'h', 'worker-can');
select public.claim_outbound_emails(1) is not null as claimed;
reset role;

-- 3. authenticated nekas SAMMA insert av radskyddet (42501).
set role authenticated;
select set_config('app.user_id', gen_random_uuid()::text, true);
do $$
begin
  begin
    insert into public.outbound_emails (recipient, subject, body_text, body_html, kind)
      values ('x@x.se', 's', 't', 'h', 'should-fail');
    raise exception 'authenticated fick skriva i utkorgen - radskyddet gäller inte';
  exception
    when insufficient_privilege then null;  -- förväntat: RLS blockerar
  end;
end $$;
reset role;

/* -------------------------------------------------------------------------- */
/* 4. app_api: rollen API:t ANSLUTER som                                      */
/* -------------------------------------------------------------------------- */

/*
 * DET HÄR AVSNITTET FINNS FÖR ATT INLOGGNINGEN INTE GICK.
 *
 * `withUser()` kör `set local role authenticated` och opererar som
 * klientrollen. `withAnon()` byter ALDRIG roll - den kör som anslutningens
 * egen roll, och den vägen bär inloggningen, sessionsuppslaget,
 * utloggningen, den nyckelautentiserade journalen och live-länken.
 *
 * auth.users och auth.sessions är med flit revoke:ade från klientrollerna.
 * Anslutningsrollen är en annan sak, och den saknade sina rättigheter helt:
 * det byggda API:t startade, svarade på /v1/health, och gav 403 på varje
 * inloggningsförsök med 42501 i loggen.
 *
 * Sviterna kunde inte se det: server/tests/run.sh ansluter som ÄGAREN, som
 * går förbi allt. Harnesset motiverar det med att withUser() alltid byter
 * roll först - sant för withUser, falskt för withAnon.
 *
 * Kontrollerna nedan prövar rättigheterna direkt i katalogen, så att de
 * gäller oavsett vilken roll sviten själv råkar köra som.
 */

do $$
declare
  v_saknas text;
begin
  if not exists (select 1 from pg_roles where rolname = 'app_api') then
    raise exception 'app_api finns inte - API:t har ingen anslutningsroll och kan inte logga in någon';
  end if;

  -- Samma krav som server/db.ts vägrar starta utan.
  if (select rolsuper from pg_roles where rolname = 'app_api') then
    raise exception 'app_api är superanvändare - radskyddet gäller inte för API:t';
  end if;
  if (select rolbypassrls from pg_roles where rolname = 'app_api') then
    raise exception 'app_api har bypassrls - radskyddet gäller inte för API:t';
  end if;
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relowner = (select oid from pg_roles where rolname = 'app_api')
      and n.nspname in ('public', 'auth', 'app')
  ) then
    raise exception 'app_api äger tabeller - ägaren är undantagen sitt eget radskydd';
  end if;

  -- Medlem i authenticated, annars faller `set local role authenticated`.
  if not pg_has_role('app_api', 'authenticated', 'member') then
    raise exception 'app_api är inte medlem i authenticated - withUser() kan inte byta roll';
  end if;

  -- DE TVÅ TABELLERNA SOM VAR HELA SKILLNADEN.
  v_saknas := null;
  if not has_table_privilege('app_api', 'auth.users', 'select') then
    v_saknas := coalesce(v_saknas || ', ', '') || 'select on auth.users';
  end if;
  for i in 1..3 loop
    if not has_table_privilege('app_api', 'auth.sessions',
          (array['select','insert','update'])[i]) then
      v_saknas := coalesce(v_saknas || ', ', '') ||
                  (array['select','insert','update'])[i] || ' on auth.sessions';
    end if;
  end loop;
  if v_saknas is not null then
    raise exception 'app_api saknar % - inloggningen faller på 42501 i drift', v_saknas;
  end if;

  raise notice 'ok    app_api kan bära inloggningen utan att gå förbi radskyddet';
end $$;

/*
 * OCH KLIENTROLLEN SKA FORTFARANDE INTE NÅ DEM.
 *
 * Rättigheten ovan gäller anslutningsrollen. Den roll API:t VÄXLAR TILL
 * för användarens egna frågor får aldrig se lösenordshashar eller andra
 * sessioner - det är hela skälet till att de två är åtskilda.
 */
do $$
begin
  if has_table_privilege('authenticated', 'auth.users', 'select') then
    raise exception 'authenticated kan läsa auth.users - lösenordshasharna är exponerade för klientfrågor';
  end if;
  if has_table_privilege('authenticated', 'auth.sessions', 'select') then
    raise exception 'authenticated kan läsa auth.sessions - andras poletter är exponerade';
  end if;
  raise notice 'ok    klientrollen når fortfarande varken lösenord eller sessioner';
end $$;

-- DELETE på sessions ska INTE finnas: en session återkallas, den raderas
-- inte, för spårbarheten är löftet.
do $$
begin
  if has_table_privilege('app_api', 'auth.sessions', 'delete') then
    raise exception 'app_api kan radera sessioner - en återkallad session ska gå att se i efterhand';
  end if;
  raise notice 'ok    en session återkallas, den raderas inte';
end $$;

/*
 * API-ROLLEN FÅR INTE NÅ ARBETARENS FUNKTIONER.
 *
 * Migration 20260819100000 tog bort execute på de sex batch-funktionerna
 * från varje klientroll, med motiveringen "ingen grant tillbaka -
 * arbetaren äger rättigheten genom sin egen roll". Den räknar upp fyra
 * roller VID NAMN. app_api skapas efteråt, i db/roles-selfhosted.sql, och
 * fick där `grant execute on all functions in schema public` - ett svep som
 * gav tillbaka precis det som tagits bort.
 *
 * Det var inte teoretiskt. En generalrepetition mot en riktig databas läste
 * ett annat bolags fakturamejl som API-rollen:
 *
 *   select ... from public.claim_outbound_emails(5)
 *   -> offer@bolag-x.se | Din faktura 2026-114 | Hemligt belopp 48 500 kr
 *
 * Funktionerna är SECURITY DEFINER och ägs av schemat, så radskyddet
 * skyddar inte: den som får anropa dem ser allt. Anropet MARKERAR dessutom
 * raderna som plockade, så den riktiga arbetaren hade aldrig skickat dem.
 *
 * Ingen endpoint anropar dem i dag. Vakten finns för att API:ts
 * anslutningsroll aldrig ska BÄRA en rättighet produkten beslutat att den
 * inte ska ha - en oanvänd öppen dörr är en dörr.
 */
do $$
declare
  v_fn text;
  v_funcs text[] := array[
    'public.claim_outbound_emails(integer)',
    'public.mark_email_sent(uuid)',
    'public.mark_email_failed(uuid, text)',
    'public.close_overdue_accounts(timestamptz)',
    'public.reminder_candidates(timestamptz)',
    'public.credit_check_candidates(timestamptz)'
  ];
begin
  foreach v_fn in array v_funcs loop
    if has_function_privilege('app_api', v_fn, 'execute') then
      raise exception 'app_api kan anropa %, arbetarens funktion - andras utgående post är nåbar från API-rollen', v_fn;
    end if;
  end loop;
  raise notice 'ok    API-rollen når inte arbetarens funktioner';
end $$;

/*
 * OCH ARBETAREN MÅSTE NÅ DEM.
 *
 * Åt andra hållet: stänger någon dörren för hårt slutar nattjobbet
 * fungera, och det märks inte heller - stegen returnerar noll i stället
 * för att kasta. Arbetaren kör antingen som app_worker (BYPASSRLS) eller
 * som schemats ägare; minst en av vägarna ska vara öppen.
 */
do $$
declare
  v_agare text;
begin
  select r.rolname into v_agare
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_roles r on r.oid = c.relowner
   where n.nspname = 'public' and c.relname = 'outbound_emails';

  if exists (select 1 from pg_roles where rolname = 'app_worker')
     and has_function_privilege('app_worker', 'public.claim_outbound_emails(integer)', 'execute') then
    raise notice 'ok    arbetarrollen når arbetarens funktioner';
  elsif v_agare is not null
     and has_function_privilege(v_agare, 'public.claim_outbound_emails(integer)', 'execute') then
    raise notice 'ok    schemats ägare (%) når arbetarens funktioner', v_agare;
  else
    raise exception 'varken app_worker eller schemats ägare kan anropa claim_outbound_emails - nattjobbet skulle rapportera noll utan att fela';
  end if;
end $$;

do $$ begin raise notice 'ALL ROLE TESTS PASSED'; end $$;
