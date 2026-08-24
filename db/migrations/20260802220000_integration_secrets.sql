-- API-nycklar för integrationerna, hanterade från driftpanelen.
--
-- Grundregeln som styr hela utformningen: EN NYCKEL SOM SPARATS KAN ALDRIG
-- LÄSAS TILLBAKA AV KLIENTEN. Tabellen har ingen select-policy alls;
-- driftpanelen ser bara att en nyckel finns, dess fyra sista tecken och när
-- den byttes. Skulle en administratörssession kapas är bytet av nycklar det
-- värsta som kan hända - inte att de läses ut.
--
-- Arbetaren (db/worker) läser tabellen direkt med sin egen databasroll, som
-- inte går genom PostgREST.

create table public.integration_secrets (
  provider text primary key,
  secret text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,

  constraint integration_secrets_provider_known check (
    provider in ('creditsafe', 'fortnox', 'visma', 'bolagsverket', 'bankid', 'ses')
  ),
  constraint integration_secrets_secret_length check (char_length(secret) between 8 and 4096)
);

comment on table public.integration_secrets is
  'API-nycklar. Ingen select-policy: sparade nycklar kan aldrig läsas tillbaka av klienten - bara bytas. Arbetaren läser med egen databasroll.';

alter table public.integration_secrets enable row level security;
-- Inga policyer alls: all klientåtkomst går genom funktionerna nedan.

/**
 * Sätter eller byter en nyckel. Endast drift.
 */
create or replace function public.set_integration_secret(p_provider text, p_secret text)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Kräver driftbehörighet';
  end if;

  insert into public.integration_secrets (provider, secret, updated_by)
  values (p_provider, p_secret, auth.uid())
  on conflict (provider)
  do update set secret = excluded.secret, updated_at = now(), updated_by = excluded.updated_by;
end;
$$;

/**
 * Vad driftpanelen får veta: att nyckeln finns, dess fyra sista tecken och
 * när den byttes. Aldrig mer än så.
 */
create or replace function public.list_integration_secrets()
returns table (provider text, last4 text, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Kräver driftbehörighet';
  end if;

  return query
  select s.provider, right(s.secret, 4), s.updated_at
  from public.integration_secrets s
  order by s.provider;
end;
$$;

/** Tar bort en nyckel, t.ex. vid uppsagt avtal. Endast drift. */
create or replace function public.delete_integration_secret(p_provider text)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Kräver driftbehörighet';
  end if;
  delete from public.integration_secrets where provider = p_provider;
end;
$$;
