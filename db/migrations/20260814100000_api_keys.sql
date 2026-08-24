-- API-nycklar per organisation, för det öppna API:t.
--
-- Samma regler som driftens nyckelvalv, uttryckta i schemat:
--   * Hemligheten LAGRAS ALDRIG - bara en SHA-256-hash och ett synligt
--     prefix. Nyckeln visas EN gång, i skapandeögonblicket, och kan
--     därefter aldrig läsas igen - bara bytas ut.
--   * Nycklar raderas inte - de återkallas. Spårbarheten är löftet:
--     en nyckel som funnits ska alltid gå att redogöra för.
--   * Skapandet går genom en RPC (create_api_key) så att generering
--     och hashning sker i databasen och hemligheten aldrig behöver
--     passera någon annan lagring.

-- Slumpen och hashen kommer ur pgcrypto. På Supabase ligger den i
-- extensions-schemat (och finns redan); lokalt skapas den här. RPC:ns
-- search_path täcker båda placeringarna.
create extension if not exists pgcrypto;

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid(),
  label text not null check (char_length(label) between 3 and 80),
  key_prefix text not null,
  key_hash text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

comment on table public.api_keys is
  'API-nycklar för det öppna API:t: hash + prefix, aldrig hemligheten. Visas en gång, återkallas i stället för raderas.';

create index api_keys_owner_idx on public.api_keys (owner_user_id, created_at desc);

alter table public.api_keys enable row level security;

create policy "Owners read their keys"
  on public.api_keys for select
  using (owner_user_id = auth.uid());

-- Insert sker ENDAST via RPC:n (security definer). Ingen direkt insert-
-- policy: en klient som själv väljer hash kunde annars smuggla in en
-- nyckel vars hemlighet den redan känner utan att skapandet loggats rätt.

create policy "Owners revoke their keys"
  on public.api_keys for update
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- Återkallelsen är det ENDA ägaren får ändra - etiketten, hashen och
-- prefixet är frysta, och en återkallad nyckel kan inte väckas igen.
create or replace function public.guard_api_key_immutability()
returns trigger
language plpgsql
as $$
begin
  if new.owner_user_id is distinct from old.owner_user_id
     or new.label is distinct from old.label
     or new.key_prefix is distinct from old.key_prefix
     or new.key_hash is distinct from old.key_hash
     or new.created_at is distinct from old.created_at then
    raise exception 'Bara återkallelse och senast använd får ändras på en API-nyckel';
  end if;
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'En återkallad nyckel förblir återkallad';
  end if;
  return new;
end;
$$;

create trigger api_keys_immutability
  before update on public.api_keys
  for each row execute function public.guard_api_key_immutability();

-- Skapandet: genererar hemligheten, lagrar hash + prefix, returnerar
-- hemligheten EN gång. Formatet clr_<hex> gör nyckeln igenkännbar i
-- loggar utan att avslöja något.
create or replace function public.create_api_key(p_label text)
returns table (id uuid, key_prefix text, secret text, created_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
  v_prefix text;
  v_row public.api_keys;
begin
  if auth.uid() is null then
    raise exception 'Inte inloggad';
  end if;
  v_secret := 'clr_' || encode(gen_random_bytes(24), 'hex');
  v_prefix := left(v_secret, 12);
  insert into public.api_keys (owner_user_id, label, key_prefix, key_hash)
  values (auth.uid(), p_label, v_prefix, encode(digest(v_secret, 'sha256'), 'hex'))
  returning * into v_row;
  return query select v_row.id, v_row.key_prefix, v_secret, v_row.created_at;
end;
$$;

revoke all on function public.create_api_key(text) from public;
grant execute on function public.create_api_key(text) to authenticated;
