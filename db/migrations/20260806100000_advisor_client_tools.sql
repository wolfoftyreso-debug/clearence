-- Rådgivarens klientverktyg: interna anteckningar och tidsrapportering.
--
-- Anteckningarna är BYRÅNS EGNA arbetsmaterial, inte ärendekommunikation.
-- Därför är de synliga endast för sin författare - inte för bolaget, inte
-- för andra deltagare, inte ens för en annan rådgivare i samma ärende. Ska
-- något delas finns meddelandena, som är byggda för just det. Regeln bor i
-- radskyddet, inte i klienten.
--
-- Tidsposterna är underlag för byråns egen fakturering. Samma princip:
-- var och en ser och rår över sina egna poster. Summering över byrån är
-- ett senare team-bygge - tills dess ljuger vi inte med en delad vy som
-- egentligen bara visar den inloggades tid.

create table public.case_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  author_user_id uuid not null default auth.uid(),
  body text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

comment on table public.case_notes is
  'Interna anteckningar i ett ärende. Synliga endast för författaren - delning sker via meddelanden.';

create index case_notes_case_idx on public.case_notes (case_id, created_at desc);

alter table public.case_notes enable row level security;

create policy "Author reads own notes"
  on public.case_notes for select
  using (author_user_id = auth.uid());

-- Skrivrätt kräver aktivt deltagande i ärendet. Borgenärer och observatörer
-- är utanför: den isolerade rollen ska inte kunna lägga arbetsmaterial i
-- akter den bara har insyn i en flik av.
create policy "Participants write their own notes"
  on public.case_notes for insert
  with check (
    author_user_id = auth.uid()
    and public.has_case_role(case_id, array[
      'owner', 'company_staff', 'reconstructor', 'trustee',
      'auditor', 'legal_advisor', 'board_member'
    ]::public.case_role[])
  );

create policy "Author deletes own notes"
  on public.case_notes for delete
  using (author_user_id = auth.uid());

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  minutes integer not null check (minutes > 0 and minutes <= 1440),
  note text check (note is null or length(note) <= 500),
  occurred_on date not null default current_date,
  created_at timestamptz not null default now()
);

comment on table public.time_entries is
  'Nedlagd tid per ärende och person. Byråns faktureringsunderlag - var och en rår över sina egna poster.';

create index time_entries_case_idx on public.time_entries (case_id, occurred_on desc);

alter table public.time_entries enable row level security;

create policy "Own time entries are readable"
  on public.time_entries for select
  using (user_id = auth.uid());

create policy "Participants log their own time"
  on public.time_entries for insert
  with check (
    user_id = auth.uid()
    and public.has_case_role(case_id, array[
      'owner', 'company_staff', 'reconstructor', 'trustee',
      'auditor', 'legal_advisor', 'board_member'
    ]::public.case_role[])
  );

create policy "Own time entries are deletable"
  on public.time_entries for delete
  using (user_id = auth.uid());
