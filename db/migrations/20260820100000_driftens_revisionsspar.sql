-- DRIFTENS REVISIONSSPÅR.
--
-- Ärendenivån är spårad sedan länge: uppgifter, inbjudningar och besluten
-- har triggers som skriver till public.audit_events. De mest privilegierade
-- åtgärderna i hela produkten hade INGET spår alls:
--
--   * en integrationshemlighet sattes eller togs bort ur nyckelvalvet,
--   * en byrås prisplan ändrades,
--   * kreditspärren slogs på eller av,
--   * en förmedlingsavgift skrevs om,
--   * ett konto stängdes.
--
-- Alla kräver driftbehörighet, och alla var osynliga efteråt. "Vem bytte
-- Creditsafe-nyckeln i tisdags?" gick inte att svara på. En behörighet utan
-- spår är en behörighet ingen kan granska.
--
-- TVÅ REGLER SOM STYR UTFORMNINGEN:
--
--  1. SPÅRET KAN INTE FÖRFALSKAS. audit_events har ingen insert-policy och
--     ingen insert-grant - bara SECURITY DEFINER-funktioner skriver dit.
--     Den här funktionen följer samma mönster i stället för att öppna
--     tabellen.
--  2. SPÅRET BÄR ALDRIG HEMLIGHETEN. Att logga att Creditsafe-nyckeln
--     byttes är spårbarhet; att logga nyckeln är att flytta valvet till
--     loggen. Anroparen skickar bara vad som ändrades, aldrig till vad.

create or replace function app.logga_driftatgard(
  p_action text,
  p_object_type text,
  p_object_id text default null,
  p_detaljer jsonb default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public, app, pg_temp
as $$
begin
  -- Samma gräns som åtgärderna själva. Utan den här raden hade vem som
  -- helst kunnat skriva rader i driftens revisionsspår.
  if not public.is_platform_admin() then
    raise exception 'Kräver driftbehörighet';
  end if;

  insert into public.audit_events (
    case_id, actor_user_id, actor_role, action, object_type, object_id, before, after
  )
  values (
    null,                  -- driftåtgärd, inte ärendehändelse
    auth.uid(),
    null,                  -- ärenderoll saknas: det här är plattformsnivå
    p_action,
    p_object_type,
    p_object_id,
    null,
    p_detaljer
  );
end;
$$;

comment on function app.logga_driftatgard(text, text, text, jsonb) is
  'Skriver en driftåtgärd till revisionsspåret. Kräver driftbehörighet. Detaljerna får ALDRIG bära hemligheten som ändrades - bara vad som ändrades.';

revoke all on function app.logga_driftatgard(text, text, text, jsonb) from public;
grant execute on function app.logga_driftatgard(text, text, text, jsonb) to authenticated;

-- Läsningen. Ärendehändelser läses av ärendets medlemmar (policyn finns
-- sedan tidigare); driftåtgärder har inget ärende och skulle annars vara
-- oläsbara för alla - ett spår ingen kan läsa är inget spår.
drop policy if exists "Platform admins read operations trail" on public.audit_events;
create policy "Platform admins read operations trail"
  on public.audit_events for select
  to authenticated
  using (case_id is null and public.is_platform_admin());

-- audit_events_no_update och audit_events_no_delete (20260801100000) gäller
-- redan hela tabellen: en skriven rad går inte att ändra eller ta bort,
-- inte heller av drift. Det är hela poängen med ett revisionsspår.
