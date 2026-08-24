-- Delegering och godkännande av handlingsplanen.
--
-- DELEGERING: en uppgift kan tilldelas en deltagare i ärendet. Kolumnen är
-- avsiktligt bara en pekare - vem som får ändra den styrs av samma
-- skrivregel som resten av uppgiften (can_write_case), och tilldelningen
-- syns för alla medlemmar. Ingen egen behörighetsvärld för en dropdown.
--
-- GODKÄNNANDE: handlingsplanen kan stämplas som granskad och godkänd av en
-- rådgivarroll i ärendet. Det är en professionell bedömning, inte en
-- självbetjäning: företrädaren kan inte godkänna sin egen plan, och
-- stämpeln sätts genom en funktion så att vem och när alltid följs åt.

alter table public.case_tasks
  add column assigned_to uuid references auth.users (id) on delete set null;

comment on column public.case_tasks.assigned_to is
  'Deltagaren uppgiften är delegerad till. Ändras av skrivroller; null = ingen tilldelning.';

alter table public.cases
  add column plan_approved_at timestamptz,
  add column plan_approved_by uuid references auth.users (id) on delete set null;

comment on column public.cases.plan_approved_at is
  'När handlingsplanen senast godkändes av en rådgivarroll. Sätts endast via set_plan_approval().';

create or replace function public.set_plan_approval(p_case_id uuid, p_approved boolean)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_case_role(p_case_id, array[
    'reconstructor', 'trustee', 'auditor', 'legal_advisor'
  ]::public.case_role[]) then
    raise exception 'Endast en rådgivarroll i ärendet kan godkänna handlingsplanen';
  end if;
  update public.cases
  set plan_approved_at = case when p_approved then now() end,
      plan_approved_by = case when p_approved then auth.uid() end,
      updated_at = now()
  where id = p_case_id;
  if not found then
    raise exception 'Ärendet finns inte';
  end if;
end;
$$;

comment on function public.set_plan_approval(uuid, boolean) is
  'Rådgivarens gransknings-stämpel på handlingsplanen: vem och när, eller återtagen. Aldrig företrädarens egen.';

revoke all on function public.set_plan_approval(uuid, boolean) from public;
grant execute on function public.set_plan_approval(uuid, boolean) to authenticated;
