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
/*
 * BYPASSRLS GÅR INTE ATT DELA UT UTAN ATT SJÄLV HA DET.
 *
 * Postgres: "Only roles with the BYPASSRLS attribute may create roles with
 * the BYPASSRLS attribute." På ett managed Postgres (Neon, Vercel Postgres)
 * är ägarrollen inte superanvändare och har inte BYPASSRLS - alltså föll
 * den här filen på sin FÖRSTA sats vid en repetition mot en riktig databas.
 *
 * Blocket är därför villkorat. Går det inte skapas ingen app_worker, och
 * arbetaren kör i stället som schemats ÄGARE, som är undantagen sin egen
 * RLS. db/worker/roll.ts godtar båda vägarna och vägrar köra om ingen av
 * dem gäller - så valet syns, och en tyst nolla blir omöjlig.
 */
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_worker') then
    begin
      create role app_worker nologin bypassrls;
    exception when insufficient_privilege then
      raise notice 'app_worker skapades INTE: rollen som kör saknar BYPASSRLS (normalt på managed Postgres). Låt arbetaren ansluta som schemats ägare i stället, via WORKER_DATABASE_URL.';
    end;
  else
    begin
      alter role app_worker bypassrls;
    exception when insufficient_privilege then
      raise notice 'app_worker fanns men gick inte att ändra: rollen som kör saknar BYPASSRLS.';
    end;
  end if;
end $$;

do $$ begin if exists (select 1 from pg_roles where rolname='app_worker') then execute $q$grant usage on schema app, public, auth to app_worker$q$; end if; end $$;

-- Arbetaren äger rättigheten genom sin egen roll (se 20260819100000): den får
-- köra alla funktioner och röra tabellerna. Inte via authenticated.
do $$ begin if exists (select 1 from pg_roles where rolname='app_worker') then execute $q$grant execute on all functions in schema public to app_worker$q$; end if; end $$;
do $$ begin if exists (select 1 from pg_roles where rolname='app_worker') then execute $q$grant select, insert, update, delete on all tables in schema public to app_worker$q$; end if; end $$;
do $$ begin if exists (select 1 from pg_roles where rolname='app_worker') then execute $q$grant usage, select on all sequences in schema public to app_worker$q$; end if; end $$;
-- Aviseringsarbetaren läser mottagarens e-post ur auth.users (revoked från
-- klientroller). Bara SELECT, inget mer.
do $$ begin if exists (select 1 from pg_roles where rolname='app_worker') then execute $q$grant select on auth.users to app_worker$q$; end if; end $$;

-- För allt migrationerna skapar EFTER den här körningen (om den körs före en
-- senare migration i en annan ordning): standardrättigheter.
do $$ begin if exists (select 1 from pg_roles where rolname='app_worker') then execute $q$alter default privileges in schema public grant execute on functions to app_worker$q$; end if; end $$;
do $$ begin if exists (select 1 from pg_roles where rolname='app_worker') then execute $q$alter default privileges in schema public grant select, insert, update, delete on tables to app_worker$q$; end if; end $$;
do $$ begin if exists (select 1 from pg_roles where rolname='app_worker') then execute $q$alter default privileges in schema public grant usage, select on sequences to app_worker$q$; end if; end $$;

/* -------------------------------------------------------------------------- */
/* app_api: rollen API:t ANSLUTER som                                         */
/* -------------------------------------------------------------------------- */

/*
 * DEN HÄR ROLLEN SAKNADES, OCH UTAN DEN GICK DET INTE ATT LOGGA IN.
 *
 * Filens rubrik har hela tiden lovat "inloggningsrollerna", men bara
 * app_worker skapades. Följden upptäcktes först när det byggda API:t
 * startades mot en icke-ägande roll, så som drift ska köra det:
 *
 *     POST /v1/auth/login  ->  403
 *     42501: permission denied for table users
 *
 * Skälet är att `withUser()` och `withAnon()` gör olika saker.
 * `withUser()` kör `set local role authenticated` och opererar därefter
 * som klientrollen - den fungerade. `withAnon()` byter ALDRIG roll: den
 * kör som anslutningens egen roll, och den vägen bär inloggningen,
 * sessionsuppslaget, utloggningen, den nyckelautentiserade journalen och
 * live-länken.
 *
 * auth.users och auth.sessions är med flit REVOKE:ade från alla
 * klientroller i db/bootstrap.sql - "det finns ingen policy att göra fel
 * på, för det finns ingen grant att börja med". Den regeln är riktig och
 * står kvar. Det som fattades var att API:ts EGEN anslutningsroll är en
 * annan sak än klientrollen den växlar till.
 *
 * Att bristen inte syntes i testerna har samma orsak som den gamla
 * grant-luckan ovan: server/tests/run.sh ansluter som ägaren. Harnesset
 * motiverar det med att `withUser()` alltid byter roll först - vilket
 * stämmer för withUser, men inte för withAnon, som aldrig gör det.
 */
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_api') then
    -- NOLOGIN: rollen är en RÄTTIGHETSSAMLING. Klustret skapar en egen
    -- inloggningsroll med eget lösenord och gör den till medlem här, så
    -- att lösenordet aldrig behöver stå i en migration.
    create role app_api nologin;
  end if;
end $$;

-- INGEN BYPASSRLS, INGET ÄGANDE. Rollen betjänar otrodda klientfrågor;
-- går den förbi radskyddet börjar frågorna returnera andra bolags
-- insolvensdata utan att något fallerar. server/db.ts vägrar starta
-- om rollen bryter mot det (kravSakerDatabasroll).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'app_api' and rolbypassrls) then
    alter role app_api nobypassrls;
  end if;
end $$;

-- Medlem i authenticated, så att `set local role authenticated` i
-- withUser() är tillåtet och tabellrättigheterna ärvs nedåt.
grant authenticated to app_api;

grant usage on schema app, public, auth to app_api;

/*
 * DE TVÅ TABELLER SOM ÄR HELA SKILLNADEN.
 *
 * Rättigheterna är de minsta som flödena kräver, och inte en mer:
 *
 *   auth.users     SELECT          - slå upp e-post och lösenordshash vid
 *                                    inloggning. Aldrig insert eller update:
 *                                    konton skapas inte den här vägen.
 *   auth.sessions  SELECT          - pröva poletten vid varje anrop
 *                  INSERT          - utfärda en session vid inloggning
 *                  UPDATE          - återkalla den vid utloggning
 *
 * DELETE saknas med flit: en session återkallas (revoked_at) och raderas
 * inte, för spårbarheten är löftet.
 */
grant select on auth.users to app_api;
grant select, insert, update on auth.sessions to app_api;

-- Anonymvägens funktioner: den nyckelautentiserade journalen och
-- live-länken. Båda är SECURITY DEFINER och grindar sig själva.
grant execute on all functions in schema public to app_api;
alter default privileges in schema public grant execute on functions to app_api;

/*
 * OCH SEDAN TILLBAKA MED ARBETARENS FUNKTIONER.
 *
 * Raden ovan är ett SVEP: "alla funktioner i public". Bland dem ligger de
 * sex som migration 20260819100000 uttryckligen tog bort från varje
 * klientroll, med motiveringen "ingen grant tillbaka - arbetaren äger
 * rättigheten genom sin egen roll". Den migrationen räknar upp fyra roller
 * vid namn; app_api skapas HÄR, efteråt, och stod därför inte med.
 *
 * Följden var inte teoretisk. Repetitionen mot en riktig databas läste ett
 * annat bolags fakturamejl som API-rollen:
 *
 *   select ... from public.claim_outbound_emails(5)
 *   -> offer@bolag-x.se | Din faktura 2026-114 | Hemligt belopp 48 500 kr
 *
 * Funktionerna är SECURITY DEFINER och ägs av schemats ägare, så
 * radskyddet hjälper inte: den som får anropa dem ser allt. Ingen endpoint
 * anropar dem i dag - men API:ts anslutningsroll ska inte bära en rättighet
 * som produkten uttryckligen beslutat att den inte ska ha. Och anropet
 * MARKERAR dessutom raderna som plockade, så den riktiga arbetaren hade
 * aldrig skickat dem.
 */
revoke execute on function
  public.claim_outbound_emails(integer),
  public.mark_email_sent(uuid),
  public.mark_email_failed(uuid, text),
  public.close_overdue_accounts(timestamptz),
  public.reminder_candidates(timestamptz),
  public.credit_check_candidates(timestamptz)
from app_api;
