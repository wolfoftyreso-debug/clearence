-- Krisrådgivarens journal och beslutsminnet.
--
-- Samtalen med rådgivaren är ärendets berättelse, inte privat kladd:
-- de läses av alla med ärendeåtkomst (borgenärer har ingen sådan - de
-- ser aldrig mer än sin egen fordran) och skrivs av dem som får arbeta
-- i ärendet. Observatörer läser men skriver inte - samma gräns som för
-- ärendets uppgifter.
--
-- Besluten är protokollrader: de får ändras EN gång, och bara på ett
-- sätt - från aktivt till omprövat, med tidsstämpel och not. Vad som
-- beslutades, när och på vilken premiss står kvar för alltid. Premissen
-- är omprövningsvillkoret: när verkligheten motsäger den ska beslutet
-- upp igen, och då ska det gå att se exakt vad som gällde när det togs.

create table public.advisor_sessions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  flow_id text not null check (length(flow_id) between 1 and 40),
  flow_title text not null check (length(flow_title) between 1 and 120),
  started_at timestamptz not null default now(),
  closed_at timestamptz,
  entries jsonb not null default '[]'::jsonb
);

comment on table public.advisor_sessions is
  'Samtal med krisrådgivaren: frågor, svar och bedömning i ordning. Ärendejournal, inte chatthistorik.';

create index advisor_sessions_case_idx on public.advisor_sessions (case_id, started_at desc);

alter table public.advisor_sessions enable row level security;

create policy "Case participants read sessions"
  on public.advisor_sessions for select
  using (public.has_case_access(case_id));

create policy "Case writers create sessions"
  on public.advisor_sessions for insert
  with check (public.can_write_case(case_id));

create policy "Case writers update sessions"
  on public.advisor_sessions for update
  using (public.can_write_case(case_id))
  with check (public.can_write_case(case_id));

create table public.case_decisions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  decided_by uuid not null default auth.uid(),
  title text not null check (length(trim(title)) between 1 and 200),
  rationale text not null check (length(trim(rationale)) between 1 and 4000),
  premise text check (premise is null or length(premise) <= 2000),
  decided_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'reconsidered')),
  reconsidered_at timestamptz,
  reconsider_note text check (reconsider_note is null or length(reconsider_note) <= 2000)
);

comment on table public.case_decisions is
  'Beslutsminnet: protokollförda beslut med premiss (omprövningsvillkor). Ändras aldrig - omprövning är en markering ovanpå.';

create index case_decisions_case_idx on public.case_decisions (case_id, decided_at desc);

alter table public.case_decisions enable row level security;

create policy "Case participants read decisions"
  on public.case_decisions for select
  using (public.has_case_access(case_id));

create policy "Case writers record decisions"
  on public.case_decisions for insert
  with check (decided_by = auth.uid() and public.can_write_case(case_id));

-- Uppdatering är HÅRT begränsad: enda tillåtna övergången är
-- active -> reconsidered, och beslutets innehåll är fryst. Triggern
-- vaktar innehållet eftersom radskyddets with check inte kan jämföra
-- gammalt mot nytt.
create policy "Case writers reconsider decisions"
  on public.case_decisions for update
  using (public.can_write_case(case_id))
  with check (public.can_write_case(case_id) and status = 'reconsidered');

create or replace function public.guard_decision_immutability()
returns trigger
language plpgsql
as $$
begin
  if old.title is distinct from new.title
    or old.rationale is distinct from new.rationale
    or old.premise is distinct from new.premise
    or old.decided_at is distinct from new.decided_at
    or old.decided_by is distinct from new.decided_by
    or old.case_id is distinct from new.case_id then
    raise exception 'Ett fattat beslut ändras inte - det omprövas';
  end if;
  if old.status = 'reconsidered' then
    raise exception 'Beslutet är redan omprövat';
  end if;
  return new;
end;
$$;

create trigger case_decisions_immutable
  before update on public.case_decisions
  for each row execute function public.guard_decision_immutability();

-- Inga delete-policyer: journal och beslut raderas inte. Ärendets
-- frysning vid avslut gäller även här.
