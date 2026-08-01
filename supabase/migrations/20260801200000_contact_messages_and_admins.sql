-- Kontaktmeddelanden och driftadministratörer.
--
-- Bakgrund: e-postadressen är borttagen från sajten. Meddelanden lämnas i ett
-- formulär och landar här, där de går att följa upp och där det syns vem som
-- har läst och besvarat vad.
--
-- Två saker skiljer den här tabellen från allt annat i schemat:
--
--   1. Vem som helst får skriva till den, även utan konto. Ett företag som
--      håller på att gå omkull ska inte behöva registrera sig för att ställa
--      en fråga.
--   2. Ingen får läsa den utom driftadministratörerna. Det är ett inflöde,
--      inte en delad brevlåda.
--
-- Att insert är öppen gör tabellen till sajtens enda skrivbara yta för
-- oinloggade. Därför sitter begränsningarna i CHECK-villkor i databasen och
-- inte bara i formuläret - en klientvalidering skyddar mot slarv, inte mot
-- den som postar direkt mot API:et.

/* -------------------------------------------------------------------------- */
/* Driftadministratörer                                                       */
/* -------------------------------------------------------------------------- */

-- Medvetet en egen tabell och inte en kolumn på auth.users: administratörskap
-- är en tilldelning som ska gå att spåra bakåt, inte en flagga någon råkar
-- sätta. Den fylls i av en driftansvarig direkt mot databasen - det finns
-- ingen väg genom applikationen att göra sig själv till administratör.
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Fritext: "drift", "support", "ekonomi". Styr ingenting idag, men gör en
  -- senare uppdelning möjlig utan att behöva gissa varför någon lades till.
  note text,
  created_at timestamptz not null default now(),
  -- Behörighet tas bort genom att sätta den här, inte genom att radera raden.
  revoked_at timestamptz
);

comment on table public.platform_admins is
  'Driftadministratörer. Fylls i direkt mot databasen; applikationen har ingen väg att lägga till en administratör.';

-- SECURITY DEFINER så att en policy på contact_messages kan fråga den här
-- tabellen utan att tabellens egen policy behöver vara läsbar för den som
-- frågar. Samma mönster som has_case_access().
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.platform_admins a
    where a.user_id = auth.uid()
      and a.revoked_at is null
  );
$$;

alter table public.platform_admins enable row level security;

-- En administratör får se vilka administratörer som finns. Ingen annan får
-- veta ens att tabellen har rader.
create policy platform_admins_admin_read
  on public.platform_admins
  for select
  to authenticated
  using (public.is_platform_admin());

-- Ingen insert-, update- eller delete-policy. Utan policy nekar RLS allt, och
-- det är avsikten: behörighet tilldelas utanför applikationen.

/* -------------------------------------------------------------------------- */
/* Kontaktmeddelanden                                                         */
/* -------------------------------------------------------------------------- */

create type public.contact_topic as enum (
  'question',      -- allmän fråga om tjänsten
  'company',       -- företag i kris som söker hjälp
  'advisor',       -- rådgivare som vill ansluta sig
  'invoice',       -- faktura- och betalningsfråga
  'privacy',       -- personuppgifter, registerutdrag, radering
  'bug',           -- något fungerar inte
  'other'
);

create type public.contact_status as enum (
  'new',
  'in_progress',
  'answered',
  'closed'
);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),

  -- Ifyllt av avsändaren.
  name text not null,
  email text not null,
  phone text,
  company text,
  topic public.contact_topic not null default 'question',
  message text not null,

  -- Sätts av databasen, inte av klienten. En avsändare ska inte kunna påstå
  -- att meddelandet kommer från någon annans konto.
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),

  -- Handläggning.
  status public.contact_status not null default 'new',
  handled_by uuid references auth.users (id) on delete set null,
  handled_at timestamptz,
  internal_note text,

  -- Längderna är ett tak, inte en form. En för lång text är i praktiken alltid
  -- klistrad eller automatgenererad, och en tom är alltid ett misstag.
  constraint contact_messages_name_length check (char_length(name) between 1 and 200),
  constraint contact_messages_email_length check (char_length(email) between 3 and 320),
  -- Grov formkontroll. Att en adress ser rätt ut säger inget om att den
  -- fungerar - därför står det i formuläret att svaret går till adressen.
  constraint contact_messages_email_shape check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint contact_messages_phone_length check (phone is null or char_length(phone) <= 40),
  constraint contact_messages_company_length check (company is null or char_length(company) <= 200),
  constraint contact_messages_message_length check (char_length(message) between 10 and 5000),
  constraint contact_messages_note_length check (internal_note is null or char_length(internal_note) <= 5000),
  -- Handläggningsspåret ska hänga ihop: antingen är båda satta eller ingen.
  constraint contact_messages_handled_pair check (
    (handled_by is null and handled_at is null)
    or (handled_by is not null and handled_at is not null)
  )
);

comment on table public.contact_messages is
  'Inflöde från kontaktformuläret. Öppen för insert, läsbar bara för driftadministratörer.';

comment on column public.contact_messages.user_id is
  'Sätts av kolumnens default från auth.uid(). Klienten skickar aldrig detta - annars kan en avsändare tillskriva sig någon annans konto.';

create index contact_messages_open_idx
  on public.contact_messages (created_at desc)
  where status <> 'closed';

create index contact_messages_created_idx on public.contact_messages (created_at desc);

alter table public.contact_messages enable row level security;

-- Vem som helst får skicka, inloggad eller inte.
--
-- WITH CHECK (true) är avsiktligt: CHECK-villkoren ovan är den faktiska
-- gränsen, och de gäller oavsett vem som skriver. Det som INTE går är att
-- sätta status, handled_by eller user_id till något eget - kolumnernas
-- defaultvärden och grant-listan nedan avgör det.
create policy contact_messages_anyone_may_write
  on public.contact_messages
  for insert
  to anon, authenticated
  with check (true);

-- Bara administratörer läser.
create policy contact_messages_admin_read
  on public.contact_messages
  for select
  to authenticated
  using (public.is_platform_admin());

-- Bara administratörer handlägger.
create policy contact_messages_admin_update
  on public.contact_messages
  for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Ingen delete-policy. Ett inkommet meddelande raderas inte via
-- applikationen; gallring är en driftåtgärd med egen motivering.

/* -------------------------------------------------------------------------- */
/* Rättigheter                                                                */
/* -------------------------------------------------------------------------- */

-- Kolumnnivå på insert: det är den här raden, inte policyn, som gör att en
-- avsändare inte kan skicka med status = 'closed' eller peka user_id på någon
-- annan. En policy kan bara säga ja eller nej till hela raden.
grant insert (name, email, phone, company, topic, message)
  on public.contact_messages to anon, authenticated;

grant select on public.contact_messages to authenticated;
grant update (status, handled_by, handled_at, internal_note)
  on public.contact_messages to authenticated;

grant select on public.platform_admins to authenticated;
