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
  -- Argon2id or bcrypt, produced by the API. The database never sees a
  -- password and has no function that could hash or verify one, so a database
  -- compromise does not hand over a verification oracle.
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
