-- SJÄLVHOSTADE ROLLER: arbetarens roll och inloggningsrollerna.
--
-- db/bootstrap.sql skapar app_user/authenticated som NOLOGIN och nämner en
-- arbetarroll (app_worker) - men skapar den aldrig, och migration
-- 20260819100000 REVOKE:ar arbetarfunktionerna från alla klientroller "för
-- att arbetaren äger rättigheten genom sin egen roll". Den rollen fanns
-- alltså i texten men inte i databasen: en arbetare som anslöt som app_worker
-- hade fallit på 42501 vid första funktionsanropet. Den här filen skapar den,
-- och de inloggningsroller ett självhostat kluster faktiskt ansluter med.
--
-- Körs EFTER migrationerna (scripts/migrera.sh), idempotent.

/* -------------------------------------------------------------------------- */
/* app_worker: den betrodda batch-rollen                                      */
/* -------------------------------------------------------------------------- */

-- BYPASSRLS är MEDVETET här, och bara här. Skillnaden mot API:t är hela
-- poängen: API:ets roll (authenticated) betjänar OtroDDA klientfrågor och får
-- därför ALDRIG gå förbi radskyddet. app_worker är en betrodd bakgrunds-
-- process som per sin natur arbetar över alla tenants - den skickar allas
-- utgående post och kontrollerar allas krediter. Att den läser tvärsnitt är
-- funktionen, inte ett läckage. Den exponeras aldrig för en klient.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_worker') then
    create role app_worker nologin bypassrls;
  else
    alter role app_worker bypassrls;
  end if;
end $$;

grant usage on schema app, public, auth to app_worker;

-- Arbetaren äger rättigheten genom sin egen roll (se 20260819100000): den får
-- köra alla funktioner och röra tabellerna. Inte via authenticated.
grant execute on all functions in schema public to app_worker;
grant select, insert, update, delete on all tables in schema public to app_worker;
grant usage, select on all sequences in schema public to app_worker;
-- Aviseringsarbetaren läser mottagarens e-post ur auth.users (revoked från
-- klientroller). Bara SELECT, inget mer.
grant select on auth.users to app_worker;

-- För allt migrationerna skapar EFTER den här körningen (om den körs före en
-- senare migration i en annan ordning): standardrättigheter.
alter default privileges in schema public grant execute on functions to app_worker;
alter default privileges in schema public grant select, insert, update, delete on tables to app_worker;
alter default privileges in schema public grant usage, select on sequences to app_worker;
