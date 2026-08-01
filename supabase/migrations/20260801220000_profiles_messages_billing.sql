-- Roller, meddelanden och kontots ekonomi.
--
-- Tre saker som hänger ihop mer än de ser ut att göra:
--
--   1. En användare är antingen företagare eller rådgivare. De ska se olika
--      saker vid inloggning, och skillnaden måste finnas i databasen - inte
--      bara i vilken meny klienten råkar rita ut.
--   2. Företag och rådgivare måste kunna skriva till varandra inne i ärendet,
--      så att korrespondensen ligger kvar när någon slutar och e-postlådan
--      försvinner.
--   3. Kontot är gratis i en vecka och stängs sedan om betalning uteblir.
--      Stängt betyder utestängd, aldrig raderad.

/* -------------------------------------------------------------------------- */
/* Roller                                                                     */
/* -------------------------------------------------------------------------- */

create type public.user_role as enum (
  'company',   -- företagare
  'advisor'    -- rådgivare, jurist, revisor, rekonstruktör
);

create table public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'company',
  display_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_profiles_name_length check (display_name is null or char_length(display_name) <= 200)
);

comment on table public.user_profiles is
  'Vem användaren är. Rollen styr vad som visas vid inloggning och kontrolleras i policyer - inte bara i menyn.';

alter table public.user_profiles enable row level security;

create policy user_profiles_own_read
  on public.user_profiles for select to authenticated
  using (user_id = auth.uid() or public.is_platform_admin());

create policy user_profiles_own_write
  on public.user_profiles for insert to authenticated
  with check (user_id = auth.uid());

create policy user_profiles_own_update
  on public.user_profiles for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Rollen som funktion, så att policyer kan fråga utan att läsa tabellen
-- direkt och utan att fastna i sin egen policy.
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select p.role from public.user_profiles p where p.user_id = auth.uid()),
    'company'::public.user_role
  );
$$;

/* -------------------------------------------------------------------------- */
/* Meddelanden i ärendet                                                      */
/* -------------------------------------------------------------------------- */

create table public.case_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  author_user_id uuid references auth.users (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  -- Sätts när mottagaren öppnat tråden. Per läsare hade krävt en egen tabell;
  -- här räcker det att avsändaren ser att något har lästs.
  read_at timestamptz,

  constraint case_messages_body_length check (char_length(body) between 1 and 10000)
);

comment on table public.case_messages is
  'Korrespondens inne i ärendet. Ligger kvar när en e-postlåda försvinner, och syns bara för ärendets medlemmar.';

create index case_messages_case_idx on public.case_messages (case_id, created_at desc);

alter table public.case_messages enable row level security;

-- Samma gräns som allt annat i ärendet. has_case_access() utesluter
-- borgenärer, vilket är avsikten: en borgenär ska inte läsa bolagets
-- korrespondens med sin rekonstruktör.
create policy case_messages_members_read
  on public.case_messages for select to authenticated
  using (public.has_case_access(case_id));

create policy case_messages_members_write
  on public.case_messages for insert to authenticated
  with check (public.has_case_access(case_id) and author_user_id = auth.uid());

-- Uppdatering endast för att markera som läst. Ingen får ändra en skickad
-- text: en korrespondens som går att skriva om i efterhand är värdelös som
-- underlag.
create policy case_messages_mark_read
  on public.case_messages for update to authenticated
  using (public.has_case_access(case_id))
  with check (public.has_case_access(case_id));

create or replace function public.case_messages_are_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.body is distinct from old.body
     or new.author_user_id is distinct from old.author_user_id
     or new.case_id is distinct from old.case_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Ett skickat meddelande kan inte ändras. Endast read_at får sättas.';
  end if;
  return new;
end;
$$;

create trigger case_messages_no_edit
  before update on public.case_messages
  for each row execute function public.case_messages_are_immutable();

/* -------------------------------------------------------------------------- */
/* Kontots ekonomi                                                            */
/* -------------------------------------------------------------------------- */

create table public.account_billing (
  user_id uuid primary key references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  -- Sista dag att betala. Null medan gratisveckan löper.
  due_at timestamptz,
  paid_at timestamptz,
  -- Sätts när kontot faktiskt stängdes. Åtkomst, inte innehåll: raderas
  -- ingenting.
  closed_at timestamptz,
  note text
);

comment on table public.account_billing is
  'Gratis en vecka, därefter stängt utan betalning. Stängt = utestängd, aldrig raderad - se src/lib/billing.ts.';

alter table public.account_billing enable row level security;

create policy account_billing_own_read
  on public.account_billing for select to authenticated
  using (user_id = auth.uid() or public.is_platform_admin());

create policy account_billing_own_insert
  on public.account_billing for insert to authenticated
  with check (user_id = auth.uid());

-- Bara drift ändrar betalstatus. En kund som kunde sätta paid_at själv vore
-- inte en kund utan en gäst.
create policy account_billing_admin_update
  on public.account_billing for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

/* -------------------------------------------------------------------------- */
/* Kundfakturor och kvitton                                                   */
/* -------------------------------------------------------------------------- */

create type public.customer_invoice_status as enum ('issued', 'paid', 'cancelled');

create table public.customer_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,

  -- Obruten stigande serie per år. Unik i hela tabellen: ett återanvänt
  -- nummer är det första en granskare hittar.
  invoice_number text not null unique,
  issued_at timestamptz not null default now(),
  due_at timestamptz not null,

  -- Belopp i ören. Heltal, aldrig flyttal: en faktura som är ett öre fel är
  -- en faktura någon får reda ut för hand.
  net_ore bigint not null,
  vat_ore bigint not null,
  gross_ore bigint not null,
  vat_rate numeric(4, 3) not null,

  description text not null,
  status public.customer_invoice_status not null default 'issued',

  paid_at timestamptz,
  payment_reference text,
  receipt_number text unique,

  constraint customer_invoices_amounts_positive check (net_ore >= 0 and vat_ore >= 0),
  -- Summan måste stämma i databasen också. En vy som räknar fel ska inte
  -- kunna lagra ett dokument som inte går ihop.
  constraint customer_invoices_total_adds_up check (gross_ore = net_ore + vat_ore),
  -- Betalt kräver både datum och kvittonummer.
  constraint customer_invoices_paid_is_complete check (
    (status <> 'paid')
    or (paid_at is not null and receipt_number is not null)
  )
);

comment on table public.customer_invoices is
  'Fakturor till kunder, belopp i ören. Kvittot skapas när betalningen registreras och ligger kvar i kundens inloggning.';

create index customer_invoices_user_idx on public.customer_invoices (user_id, issued_at desc);
create index customer_invoices_open_idx on public.customer_invoices (due_at) where status = 'issued';

alter table public.customer_invoices enable row level security;

-- Kunden ser sina egna. Det är hela poängen: kvittot ska finnas i
-- inloggningen, inte bara i ett mejl som försvinner.
create policy customer_invoices_own_read
  on public.customer_invoices for select to authenticated
  using (user_id = auth.uid() or public.is_platform_admin());

create policy customer_invoices_admin_write
  on public.customer_invoices for insert to authenticated
  with check (public.is_platform_admin());

create policy customer_invoices_admin_update
  on public.customer_invoices for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Ingen delete-policy. En utställd faktura makuleras genom status
-- 'cancelled', den försvinner inte ur serien.

/* -------------------------------------------------------------------------- */
/* Rättigheter                                                                */
/* -------------------------------------------------------------------------- */

grant select, insert, update on public.user_profiles to authenticated;
grant select, insert, update on public.case_messages to authenticated;
grant select, insert, update on public.account_billing to authenticated;
grant select, insert, update on public.customer_invoices to authenticated;

-- Revisionsspåret ska följa pengarna och korrespondensen, inte bara ärendet.
do $$
declare
  t text;
begin
  foreach t in array array['case_messages', 'customer_invoices', 'account_billing']
  loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
       for each row execute function public.record_audit_event()',
      t || '_audit', t);
  end loop;
end $$;
