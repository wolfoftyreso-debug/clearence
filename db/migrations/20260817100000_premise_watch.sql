-- Omprövningsbevakningen: premissens mätbara villkor.
--
-- Beslutsminnet har haft premissen sedan v1, och gränssnittet har lovat
-- att beslut "omprövas när läget ändras". Ingenting bevakade. Den här
-- migrationen ger premissen ett VILLKOR som går att räkna om, och en
-- kvittering för den som vill behålla beslutet ändå.
--
-- Utvärderingen bor medvetet INTE här. Villkoret jämförs mot ärendets
-- siffror i klienten (src/lib/advisor/premiseWatch.ts), av samma skäl som
-- bedömningarna är deterministiska funktioner: de ska gå att läsa, testa
-- och reproducera. Databasen äger regeln om vad som får LAGRAS och vem
-- som får ändra det - inte tolkningen.

alter table public.case_decisions
  add column watch_signal text
    check (watch_signal is null or watch_signal in
      ('loner', 'skatt', 'skuldtackning', 'passerade_frister', 'hyra', 'leverantorer', 'skuld')),
  add column watch_comparator text
    check (watch_comparator is null or watch_comparator in ('minst', 'hogst', 'sant', 'falskt')),
  add column watch_threshold numeric,
  add column watch_ack_observation text
    check (watch_ack_observation is null or length(watch_ack_observation) <= 500),
  add column watch_ack_at timestamptz;

-- Ett halvt villkor är värre än inget: det ser bevakat ut utan att vara
-- det. Antingen finns hela villkoret, eller så finns det inte.
alter table public.case_decisions
  add constraint case_decisions_watch_complete check (
    (watch_signal is null and watch_comparator is null and watch_threshold is null)
    or (
      watch_signal is not null and watch_comparator is not null
      and (
        (watch_comparator in ('minst', 'hogst') and watch_threshold is not null)
        or (watch_comparator in ('sant', 'falskt') and watch_threshold is null)
      )
    )
  );

-- En kvittering utan villkor är meningslös - det finns inget att kvittera.
alter table public.case_decisions
  add constraint case_decisions_ack_needs_watch check (
    watch_ack_at is null or watch_signal is not null
  );

comment on column public.case_decisions.watch_signal is
  'Storheten premissen bevakas mot. Null = premissen bevakas inte, och det sägs rakt ut i gränssnittet.';
comment on column public.case_decisions.watch_ack_observation is
  'Observationen användaren kvitterade som "beslutet står fast". Fingeravtryck: ändras läget kommer frågan tillbaka.';

-- Villkoret är en del av beslutet och fryses med det. Utan den här raden
-- hade någon kunnat flytta tröskeln i efterhand tills premissen "höll"
-- igen - vilket är exakt det beslutsminnet finns för att förhindra.
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
    or old.case_id is distinct from new.case_id
    or old.watch_signal is distinct from new.watch_signal
    or old.watch_comparator is distinct from new.watch_comparator
    or old.watch_threshold is distinct from new.watch_threshold then
    raise exception 'Ett fattat beslut ändras inte - det omprövas';
  end if;
  if old.status = 'reconsidered' then
    raise exception 'Beslutet är redan omprövat';
  end if;
  return new;
end;
$$;

-- Kvitteringen går genom en funktion, inte genom en uppdateringspolicy.
--
-- Skälet är detsamma som vid signeringen: en policy som släpper igenom
-- "status oförändrad" hade öppnat tabellen för direkta uppdateringar där
-- radskyddet inte längre kan säga vad som ändrades. Funktionen gör tre
-- saker i en transaktion - prövar behörigheten, sätter kvitteringen och
-- journalför - och en kvittering som inte syns på tidslinjen har, ur
-- användarens synvinkel, inte hänt.
create or replace function public.acknowledge_premise(
  p_decision_id uuid,
  p_observation text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case_id uuid;
  v_status text;
  v_watch text;
  v_title text;
begin
  select case_id, status, watch_signal, title
    into v_case_id, v_status, v_watch, v_title
    from public.case_decisions
   where id = p_decision_id;

  if v_case_id is null then
    raise exception 'Beslutet finns inte';
  end if;

  -- Samma krets som får protokollföra får kvittera. En borgenär kan
  -- aldrig svara å bolagets vägnar att ett beslut står fast.
  if not public.can_write_case(v_case_id) then
    raise exception 'Saknar behörighet att kvittera beslutet';
  end if;

  if v_status = 'reconsidered' then
    raise exception 'Ett omprövat beslut kvitteras inte';
  end if;

  if v_watch is null then
    raise exception 'Beslutet har inget bevakat villkor att kvittera';
  end if;

  if p_observation is null or length(trim(p_observation)) = 0 then
    raise exception 'Kvitteringen måste säga vad som gällde';
  end if;

  update public.case_decisions
     set watch_ack_observation = left(trim(p_observation), 500),
         watch_ack_at = now()
   where id = p_decision_id;

  insert into public.audit_events (case_id, actor_user_id, action, object_type, object_id, after)
  values (
    v_case_id,
    auth.uid(),
    'premise_acknowledged',
    'case_decisions',
    p_decision_id::text,
    jsonb_build_object('title', v_title, 'observation', left(trim(p_observation), 500))
  );
end;
$$;

comment on function public.acknowledge_premise(uuid, text) is
  'Beslutet står fast trots motsagt villkor. Kvitterar mot observationen och journalför - flaggan kommer tillbaka när läget ändras igen.';

revoke all on function public.acknowledge_premise(uuid, text) from public;
grant execute on function public.acknowledge_premise(uuid, text) to authenticated;
