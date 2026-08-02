-- Godkännandeflödet för dokument: Utkast -> För granskning -> Godkänt.
--
-- Dokumentarkivet är ett projektrum, inte ett filsystem: ett dokument
-- bär sin status, och godkännandet är en RÅDGIVARSTÄMPEL - samma regel
-- som handlingsplanens godkännande. Företrädaren kan aldrig godkänna
-- sitt eget underlag; det är hela poängen med granskningen.
--
-- Statusövergångarna går genom EN funktion. Radskyddets generella
-- "Writers update" på case_documents gäller filens metadata; review-
-- kolumnerna sätts här, med rollprövningen i databasen. Varje övergång
-- journalförs automatiskt av den befintliga audit-triggern.

alter table public.case_documents
  add column review_status text not null default 'draft'
    check (review_status in ('draft', 'in_review', 'approved')),
  add column review_requested_at timestamptz,
  add column reviewed_by uuid,
  add column reviewed_at timestamptz;

comment on column public.case_documents.review_status is
  'Utkast/För granskning/Godkänt. Sätts endast via set_document_review().';

create or replace function public.set_document_review(p_document_id uuid, p_action text)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_case_id uuid;
  v_status text;
begin
  select case_id, review_status into v_case_id, v_status
  from public.case_documents where id = p_document_id;
  if v_case_id is null then
    raise exception 'Dokumentet finns inte';
  end if;

  if p_action = 'request' then
    if not public.can_write_case(v_case_id) then
      raise exception 'Endast en skrivroll i ärendet kan begära granskning';
    end if;
    update public.case_documents
    set review_status = 'in_review',
        review_requested_at = now(),
        reviewed_by = null,
        reviewed_at = null
    where id = p_document_id;

  elsif p_action = 'approve' then
    -- Rådgivarstämpeln: samma rollkrets som handlingsplanens
    -- godkännande. Företrädaren godkänner aldrig sitt eget underlag.
    if not public.has_case_role(v_case_id, array[
      'reconstructor', 'trustee', 'auditor', 'legal_advisor'
    ]::public.case_role[]) then
      raise exception 'Endast en rådgivarroll i ärendet kan godkänna dokument';
    end if;
    if v_status <> 'in_review' then
      raise exception 'Dokumentet är inte skickat för granskning';
    end if;
    update public.case_documents
    set review_status = 'approved',
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where id = p_document_id;

  elsif p_action = 'reset' then
    -- Tillbaka till utkast - t.ex. när innehållet ändrats efter ett
    -- godkännande. Stämpeln nollas; historiken står kvar i journalen.
    if not public.can_write_case(v_case_id) then
      raise exception 'Endast en skrivroll i ärendet kan återställa statusen';
    end if;
    update public.case_documents
    set review_status = 'draft',
        review_requested_at = null,
        reviewed_by = null,
        reviewed_at = null
    where id = p_document_id;

  else
    raise exception 'Okänd åtgärd';
  end if;
end;
$$;

comment on function public.set_document_review(uuid, text) is
  'Statusövergångarna för dokumentgranskning: request/approve/reset. Godkännande kräver rådgivarroll - aldrig företrädarens egen stämpel.';

revoke all on function public.set_document_review(uuid, text) from public;
grant execute on function public.set_document_review(uuid, text) to authenticated;
