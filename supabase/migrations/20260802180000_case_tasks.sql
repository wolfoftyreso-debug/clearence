-- Ärendets uppgifter: handlingsplanens checklista.
--
-- Utvärderingen slutade i en textlista med nästa steg som dog på
-- resultatsidan. Det här är samma steg som levande, avbockningsbara
-- uppgifter i ärendet - och därmed synliga för rekonstruktören och
-- revisorn, inte bara för den som råkade se resultatvyn.
--
-- Vem som bockade av vad, och när, sparas och revisionsloggas. I en process
-- där styrelsens aktivitet i sig har rättslig betydelse (ABL 25 kap.) är
-- "vi gjorde X den Y" en uppgift man vill kunna belägga, inte minnas.

create table public.case_tasks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  label text not null,
  -- Frivillig koppling till ett datum, t.ex. en frist uppgiften hör till.
  due_date date,
  done_at timestamptz,
  done_by uuid references auth.users (id) on delete set null,
  -- Varifrån uppgiften kom: utvärderingens rekommendation eller manuellt
  -- tillagd. Styr ingenting, men gör listan begriplig i efterhand.
  source text not null default 'manual',
  created_at timestamptz not null default now(),

  constraint case_tasks_label_length check (char_length(label) between 3 and 500),
  constraint case_tasks_source_known check (source in ('recommendation', 'manual')),
  -- Avbockad kräver båda: tidpunkt utan person, eller person utan tidpunkt,
  -- är ett halvt svar på frågan "vem gjorde vad när".
  constraint case_tasks_done_pair check (
    (done_at is null and done_by is null) or (done_at is not null and done_by is not null)
  )
);

comment on table public.case_tasks is
  'Handlingsplanens uppgifter. Avbockning sparar vem och när - i en ABL 25 kap.-process är styrelsens aktivitet något man vill kunna belägga.';

-- Sådd från rekommendationen sker med upsert mot det här: två flikar som
-- sår samtidigt ska ge en lista, inte två.
create unique index case_tasks_unique_label on public.case_tasks (case_id, label);

create index case_tasks_case_idx on public.case_tasks (case_id, created_at);

alter table public.case_tasks enable row level security;

-- Samma gränser som resten av ärendet: medlemmar läser (borgenärer är inte
-- medlemmar i den meningen - has_case_access utesluter dem), skrivroller
-- skriver.
create policy case_tasks_members_read
  on public.case_tasks for select to authenticated
  using (public.has_case_access(case_id));

create policy case_tasks_writers_insert
  on public.case_tasks for insert to authenticated
  with check (public.can_write_case(case_id));

create policy case_tasks_writers_update
  on public.case_tasks for update to authenticated
  using (public.can_write_case(case_id))
  with check (public.can_write_case(case_id));

-- Ingen delete-policy: en felaktig uppgift bockas av eller lämnas, historik
-- ska inte gå att sudda.

grant select, insert, update on public.case_tasks to authenticated;

-- Revisionsloggen följer uppgifterna - avbockningen ÄR beviset.
create trigger case_tasks_audit
  after insert or update or delete on public.case_tasks
  for each row execute function public.record_audit_event();
