-- Bootstrap for a self-hosted Postgres. No Supabase.
--
-- This file stands up everything the migrations expect that Supabase used to
-- provide: the identity of the calling user, the users table, and the two
-- database roles. Run it once before the migrations, on a fresh database.
--
-- WHY THE SCHEMA IS STILL CALLED `auth`
--
-- The 43 policy expressions written against `auth.uid()` are plain Postgres;
-- only the identity source was ever vendor-specific. Keeping the schema name
-- means the entire tested security model - 45 assertions covering creditor
-- isolation, revoked access and the append-only trail - carries over
-- unchanged rather than being rewritten under time pressure. The schema is
-- ours now; the name is history.
--
-- `app.current_user_id()` is the canonical accessor for new code.
--
-- HOW IDENTITY REACHES THE DATABASE
--
-- The API verifies the session, then sets a transaction-local setting before
-- running the user's queries:
--
--     BEGIN;
--     SELECT set_config('app.user_id', $1, true);   -- true = transaction-local
--     ... queries ...
--     COMMIT;
--
-- `true` matters. A session-local setting on a pooled connection leaks the
-- previous request's identity to the next one, which in this product means
-- showing one company's insolvency data to another. See db/README.md.

create schema if not exists app;
create schema if not exists auth;

/* -------------------------------------------------------------------------- */
/* Roles                                                                      */
/* -------------------------------------------------------------------------- */

-- `app_user` is what the API connects as for user-driven queries. It must not
-- own any table and must not have BYPASSRLS, or row-level security stops
-- applying and every isolation guarantee silently disappears.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_anon') then
    create role app_anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user nologin;
  end if;
  -- Kept for the migrations and tests written against Supabase's role names.
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin in role app_anon;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin in role app_user;
  end if;
end $$;

/* -------------------------------------------------------------------------- */
/* Identity                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The signed-in user for the current transaction, or null.
 *
 * Returns null rather than raising when unset: every policy is written so
 * that a null identity matches no rows. Failing closed is the whole point.
 */
create or replace function app.current_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.user_id', true), '')::uuid;
$$;

/** Deprecated alias. New policies should call app.current_user_id(). */
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select app.current_user_id();
$$;

comment on function auth.uid() is
  'Alias för app.current_user_id(). Finns kvar för att de policyer som skrevs mot Supabase ska fungera oförändrade. Ny kod ska anropa app.current_user_id().';

/* -------------------------------------------------------------------------- */
/* Users                                                                      */
/* -------------------------------------------------------------------------- */

-- Our own users table. Supabase's auth.users had columns we never used; this
-- carries what the application actually needs and nothing else.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email citext unique not null,
  -- Producerad av API:et (server/auth.ts), i formatet
  -- `scrypt$N$r$p$salt$hash`. Databasen ser aldrig ett lösenord och har
  -- ingen funktion som kan hasha eller verifiera ett, så ett intrång i
  -- databasen delar inte ut ett verifieringsorakel på köpet.
  --
  -- scrypt och inte Argon2id: Argon2 kräver en nativ modul som ska byggas
  -- vid installation, och API:et har med flit exakt ett beroende. Hashen
  -- bär sina egna parametrar, så en höjd kostnad - eller ett byte till
  -- Argon2id - blir ett nytt prefix och inte en migrering.
  password_hash text not null,
  email_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Set instead of deleting the row, so audit trails and case membership keep
  -- resolving to a real person.
  disabled_at timestamptz
);

create table if not exists auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- SHA-256 of the token. The token itself is never stored: a database dump
  -- must not be a set of working sessions.
  token_hash text not null unique,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  user_agent text,
  ip inet
);

create index if not exists sessions_user_idx on auth.sessions (user_id)
  where revoked_at is null;
create index if not exists sessions_expiry_idx on auth.sessions (expires_at)
  where revoked_at is null;

-- Neither table is reachable from the client role at all. Sessions and
-- password hashes are the API's business; there is no policy to get wrong
-- because there is no grant to begin with.
revoke all on auth.users, auth.sessions from public, app_anon, app_user, anon, authenticated;

grant usage on schema app, auth, public to app_anon, app_user, anon, authenticated;

/* -------------------------------------------------------------------------- */
/* Table privileges                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Rättigheterna som Supabase delade ut åt oss.
 *
 * Radskyddet avgör VILKA RADER en roll ser. Innan dess måste rollen ha
 * rätt att röra tabellen över huvud taget - och de rättigheterna kom i
 * Supabase från plattformens default privileges, inte från vår kod.
 * Självhostat fanns de ingenstans: första frågan hade fallit på 42501,
 * och migrationerna hade sett ut att fungera ända tills något faktiskt
 * försökte läsa.
 *
 * Att bristen inte syntes i testerna är själva lärdomen: RLS-sviten
 * delar med flit ut en blank grant för att pröva att append-only-löftena
 * inte vilar på en revoke (supabase/tests/rls.sql). Den grantsen lagade
 * i praktiken produktionskonfigurationen åt oss, varje körning. Det som
 * upptäckte det var det egna API:t - första riktiga klienten som gick
 * mot databasen utan att en testfil hade städat före den.
 *
 * `alter default privileges` och inte `grant on all tables`: bootstrap
 * körs FÖRE migrationerna, så det finns inga tabeller att grantera ännu.
 * Raderna nedan gäller allt som migrationerna sedan skapar.
 *
 * Att `delete` ingår är avsiktligt: journalen, besluten och signaturerna
 * skyddas av att det saknas delete-POLICY och av triggrar, inte av en
 * utebliven grant. Det prövas i båda miljöerna.
 */
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant execute on functions to anon, authenticated;

-- Och för det som redan finns när bootstrap körs om mot en befintlig
-- databas. Idempotent, och gör om-körningen ofarlig.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

/* -------------------------------------------------------------------------- */
/* Kontot: registrering, lösenordsbyte, återställning                         */
/* -------------------------------------------------------------------------- */

/*
 * VARFÖR DET HÄR ÄR FUNKTIONER OCH INTE GRANTS.
 *
 * `app_api` har SELECT på auth.users och ingenting mer - inget INSERT,
 * inget UPDATE. Det är med flit: rollen som tar emot varje anrop från
 * internet ska inte kunna skriva om vem som helsts lösenord om en enda
 * SQL-injektion slinker igenom.
 *
 * Registrering, lösenordsbyte och återställning behöver ändå skriva. De
 * ligger därför som SECURITY DEFINER-funktioner: en smal, namngiven väg
 * med reglerna INNE i databasen, i stället för en bred grant med reglerna
 * i applikationskoden.
 *
 * Lösenordet självt passerar aldrig hit. API:et hashar (server/auth.ts,
 * scrypt) och skickar hashen. Databasen har ingen funktion som kan hasha
 * eller verifiera ett lösenord, så ett intrång i databasen delar inte ut
 * ett verifieringsorakel på köpet.
 */

create table if not exists auth.password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- SHA-256 av poletten, precis som sessionerna. En databasdump ska inte
  -- vara en samling fungerande återställningslänkar.
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists password_resets_user_idx
  on auth.password_resets (user_id) where used_at is null;
create index if not exists password_resets_expiry_idx
  on auth.password_resets (expires_at) where used_at is null;

revoke all on auth.password_resets from public, app_anon, app_user, anon, authenticated;

/*
 * REGISTRERING.
 *
 * Returnerar användarens id, eller null om adressen redan finns. Ingen
 * profilrad skapas här: profilen (roll, namn) sätts i onboardingen, och
 * en tom platshållare hade gjort "har användaren fyllt i något?" till en
 * fråga utan svar.
 */
create or replace function app.registrera_konto(p_email citext, p_password_hash text)
returns uuid
language plpgsql
security definer
set search_path = auth, public, pg_temp
as $$
declare
  v_id uuid;
begin
  -- TVÅ FÖRSVAR, INGET AV DEM ÖVERFLÖDIGT.
  --
  -- Förhandskontrollen ger det rena fallet ett rent svar. Undantaget
  -- längst ned tar kapplöpningen: två samtidiga registreringar av samma
  -- adress hinner båda förbi kontrollen, och då är det unikhetsindexet
  -- som avgör.
  --
  -- Tas BARA förhandskontrollen bort ändras ingenting utåt - det gör den
  -- lätt att läsa som död kod. Tas båda bort svarar rutten 400 i stället
  -- för 409, vilket sviten fångar. Behåll dem båda.
  if exists (select 1 from auth.users where email = p_email) then
    return null;
  end if;
  insert into auth.users (email, password_hash)
  values (p_email, p_password_hash)
  returning id into v_id;
  return v_id;
exception
  -- Två samtidiga registreringar av samma adress. Den som förlorar
  -- kapplöpningen ska få samma svar som den som kom för sent.
  when unique_violation then
    return null;
end $$;

/*
 * LÖSENORDSBYTE FÖR EN INLOGGAD.
 *
 * Anroparens nuvarande lösenord är REDAN prövat av API:et (confirmPassword
 * i server/index.ts) - den prövningen kräver hashen, och hashning hör inte
 * hemma i databasen. Det som ligger här är följden av bytet, och den är
 * hela poängen: ALLA sessioner dör.
 *
 * Den som byter lösenord gör det ofta för att någon annan kan det gamla.
 * Att låta den andres session leva vidare vore att göra bytet till en
 * gest.
 */
create or replace function app.satt_losenord(p_user_id uuid, p_password_hash text)
returns void
language plpgsql
security definer
set search_path = auth, public, pg_temp
as $$
begin
  update auth.users
     set password_hash = p_password_hash, updated_at = now()
   where id = p_user_id and disabled_at is null;
  if not found then
    raise exception 'okänt konto';
  end if;
  update auth.sessions
     set revoked_at = now()
   where user_id = p_user_id and revoked_at is null;
end $$;

/*
 * BEGÄRAN OM ÅTERSTÄLLNING.
 *
 * Returnerar INGENTING - med flit. Ett svar som skiljer på "adressen finns"
 * och "adressen finns inte" gör formuläret till ett register över vilka
 * bolag som är kunder i en insolvenstjänst. API:et svarar alltid likadant,
 * och den här funktionen ger den inget att råka läcka.
 *
 * Tidigare obrukade begäranden makuleras: en ny länk ska döda den gamla.
 */
create or replace function app.begar_aterstallning(
  p_email citext,
  p_token_hash text,
  p_expires_at timestamptz,
  p_subject text,
  p_body_text text,
  p_body_html text
)
returns void
language plpgsql
security definer
set search_path = auth, public, pg_temp
as $$
declare
  v_user uuid;
begin
  select id into v_user from auth.users
   where email = p_email and disabled_at is null;
  if v_user is null then
    return;
  end if;

  update auth.password_resets set used_at = now()
   where user_id = v_user and used_at is null;

  insert into auth.password_resets (user_id, token_hash, expires_at)
  values (v_user, p_token_hash, p_expires_at);

  insert into public.outbound_emails (recipient, subject, body_text, body_html, kind)
  values (p_email::text, p_subject, p_body_text, p_body_html, 'losenordsaterstallning');
end $$;

/*
 * INLÖSEN AV EN ÅTERSTÄLLNING.
 *
 * `for update` på raden: två samtidiga inlösen av samma polett ska ge en
 * vinnare, inte två lösenordsbyten. Poletten brinner oavsett utfall.
 */
create or replace function app.los_in_aterstallning(p_token_hash text, p_password_hash text)
returns boolean
language plpgsql
security definer
set search_path = auth, public, pg_temp
as $$
declare
  v_user uuid;
begin
  select user_id into v_user
    from auth.password_resets
   where token_hash = p_token_hash
     and used_at is null
     and expires_at > now()
   for update;
  if v_user is null then
    return false;
  end if;

  update auth.password_resets set used_at = now() where token_hash = p_token_hash;
  perform app.satt_losenord(v_user, p_password_hash);
  return true;
end $$;

-- Bara API:t kallar dem. Klientrollerna når dem inte.
revoke all on function
  app.registrera_konto(citext, text),
  app.satt_losenord(uuid, text),
  app.begar_aterstallning(citext, text, timestamptz, text, text, text),
  app.los_in_aterstallning(text, text)
from public, app_anon, app_user, anon, authenticated;
