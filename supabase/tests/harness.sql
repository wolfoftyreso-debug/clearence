-- Minimal stand-in for the parts of Supabase the migrations depend on.
--
-- This exists so row-level security can be tested for real against Postgres
-- rather than reasoned about. RLS that is only reasoned about is the failure
-- mode this project cannot afford: losing row scoping fails open - queries
-- keep working and start returning other companies' insolvency data.
--
-- Only the surface the migrations actually touch is emulated: auth.users,
-- auth.uid(), the three Supabase roles, and enough of the storage schema for
-- the bucket policies to be created and exercised.

create schema if not exists auth;
create schema if not exists storage;

-- Supabase's three roles. Policies are written for `authenticated`; `anon`
-- must reach nothing.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  -- Present only so the shared fixture in rls.sql loads under both this shim
  -- and the self-hosted schema in db/bootstrap.sql.
  password_hash text
);

-- Reads the signed-in user the same way Supabase does: from a request-scoped
-- setting. Tests set it with `set local request.jwt.claim.sub`.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets (id),
  name text not null,
  owner uuid,
  created_at timestamptz not null default now()
);

alter table storage.objects enable row level security;

-- Splits an object key into path segments, as Supabase's helper does.
create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select string_to_array(name, '/');
$$;

grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant usage on schema public to postgres;
