-- Driftens parametrar: nyckel/värde med skarpa regler.
--
-- Företagsplanens månadsavgift är den första posten. Regeln som gör
-- tabellen möjlig: inga hemligheter här - allt i app_settings är
-- publikt läsbart (priset står på startsidan). Hemligheter bor i
-- valvet (secrets), ingenting annanstans. Skrivning kräver drift.

create table public.app_settings (
  key text primary key check (length(key) between 1 and 64),
  value jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table public.app_settings is
  'Publika driftparametrar (t.ex. företagsplanens pris). ALDRIG hemligheter - de bor i valvet.';

alter table public.app_settings enable row level security;

-- Publikt läsbar: priset visas för utloggade besökare på startsidan.
create policy "Settings are readable by everyone"
  on public.app_settings for select
  to anon, authenticated
  using (true);

create policy "Platform admin writes settings"
  on public.app_settings for insert
  to authenticated
  with check (public.is_platform_admin());

create policy "Platform admin updates settings"
  on public.app_settings for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Ingen delete-policy: en parameter nollställs genom att sättas om,
-- inte genom att försvinna med okänd verkan.
