-- Den självhostade rollmodellen, prövad. Förutsätter att
-- db/roles-selfhosted.sql redan körts (run.sh gör det före den här).
--
-- Två löften vaktas, och det andra är det som kostar mest om det bryts:
--  1. app_worker (den betrodda batch-rollen) KAN röra utkorgen och köra
--     arbetarfunktionerna - annars faller arbetaren på 42501 i drift.
--  2. authenticated (API-rollens grund) går ALDRIG förbi radskyddet. Samma
--     insert som app_worker får göra måste authenticated nekas.

-- 1. Attributen.
do $$
begin
  if (select rolbypassrls from pg_roles where rolname = 'app_worker') is distinct from true then
    raise exception 'app_worker saknar bypassrls - arbetaren kan inte röra utkorgen';
  end if;
  if (select coalesce(rolbypassrls, false) from pg_roles where rolname = 'authenticated') then
    raise exception 'authenticated har bypassrls - radskyddet är avstängt för API-rollen';
  end if;
end $$;

-- 2. app_worker rör utkorgen och kör en arbetarfunktion.
set role app_worker;
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
 * Sviterna kunde inte se det: api/tests/run.sh ansluter som ÄGAREN, som
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

  -- Samma krav som api/server/db.ts vägrar starta utan.
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

do $$ begin raise notice 'ALL ROLE TESTS PASSED'; end $$;
