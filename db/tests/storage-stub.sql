-- Stubs so migrations written against Supabase Storage still parse.
--
-- Self-hosted, files live in S3 and Postgres holds only metadata in
-- public.case_documents. These objects exist so the historical migrations
-- apply unchanged; nothing in the application reads them. The storage
-- policies they carry are inert here - authorisation happens in the API via
-- app.may_read_document() before a presigned URL is issued.
create schema if not exists storage;

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

create or replace function storage.foldername(name text)
returns text[] language sql immutable as $$
  select string_to_array(name, '/');
$$;

grant usage on schema storage to app_anon, app_user, anon, authenticated;
