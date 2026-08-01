-- The audit trail must outlive what it is evidence about.
--
-- Found in the audit on 2026-08-01. Two faults, both from the same line:
-- audit_events.case_id was declared `references public.cases on delete
-- cascade`.
--
-- 1. Deleting a case would have destroyed its entire audit trail. An audit
--    trail that disappears together with its subject answers no question
--    anyone would ask it. "Show me what happened in that case" is asked
--    precisely about cases that are gone.
--
-- 2. Because audit_events refuses DELETE by trigger, the cascade could not
--    run and the delete failed outright. The owner's delete policy existed
--    but the operation always errored.
--
-- The fix is the standard one for audit logs: keep the identifier, drop the
-- foreign key. The trail is no longer a child of the case; it is a record
-- about it.

alter table public.audit_events
  drop constraint if exists audit_events_case_id_fkey;

comment on column public.audit_events.case_id is
  'Ärendets id. Medvetet utan främmande nyckel: revisionsspåret ska överleva att ärendet raderas. Radens before/after innehåller uppgifterna som fanns, så posten går att identifiera även när ärendet är borta.';

-- The actor reference is dropped for the same reason. A user who deletes
-- their account must not be able to erase who did what, and `set null` would
-- quietly turn an identified action into an anonymous one.
alter table public.audit_events
  drop constraint if exists audit_events_actor_user_id_fkey;

comment on column public.audit_events.actor_user_id is
  'Den som utförde åtgärden. Utan främmande nyckel av samma skäl som case_id: identiteten får inte försvinna för att kontot tas bort.';

-- Retaining the trail after the case is gone is a deliberate decision with a
-- data-protection consequence, so record it where it will be found.
comment on table public.audit_events is
  'Append-only revisionsspår. Bevaras när ärendet raderas. ANTAGANDE som måste bekräftas juridiskt: hur länge spåret får och ska bevaras efter avslutat ärende, och hur det förhåller sig till en begäran om radering enligt GDPR. Gallringsregler ska sättas per ärendetyp innan skarp drift.';
