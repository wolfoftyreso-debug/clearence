/*
 * ARBETARFUNKTIONERNA VAR ÖPPNA FÖR VEM SOM HELST. DE STÄNGS NU.
 *
 * Hittat i en kodrevision, och det är den allvarligaste sorten: ett hål
 * som inte syns som ett fel. Åtta security definer-funktioner från de
 * äldsta migrationerna hade kvar Postgres förvalsrättighet - execute till
 * public - OCH den extra grant till anon/authenticated som
 * db/bootstrap.sql delar ut via default privileges. Alltså kunde vilken
 * inloggad användare som helst, och i det självhostade läget även en
 * oinloggad, anropa dem direkt.
 *
 * VAD DET INNEBAR, konkret:
 *
 *  - public.close_overdue_accounts() STÄNGER konton. En inloggad
 *    användare kunde köra den och stänga varje förfallet konto i hela
 *    systemet - en driftstörning byggd med ett enda anrop.
 *  - public.credit_check_candidates() och reminder_candidates()
 *    RETURNERAR andra bolags user_id, e-post och fakturanummer.
 *    Funktionen kör som ägare och går förbi radskyddet; en klient som
 *    anropade den läste ut ett tvärsnitt av kundregistret.
 *  - claim_outbound_emails() och mark_email_sent/failed() lät en klient
 *    plocka och kvittera utgående post - alltså förfalska leveransstatus
 *    och röra kön.
 *
 * INTE MED I LISTAN, och det är en viktig skillnad: retry_outbound_email()
 * är också security definer och anropas från klienten - men den prövar
 * is_platform_admin() SJÄLV, så en icke-admin får nej redan där. Den är en
 * riktig driftfunktion i utkorgs-vyn och ska förbli anropbar. De sex nedan
 * har ingen sådan inre prövning; deras enda skydd var att ingen råkade
 * anropa dem.
 *
 * VARFÖR DET INTE UPPTÄCKTS: ingen KLIENT anropar dem - arbetaren gör det,
 * och arbetaren ansluter som sin egen roll (app_worker, se
 * email-worker.ts). Rättigheten fanns men användes aldrig av produkten,
 * och en oanvänd öppen dörr syns inte i något flöde. Den syns bara när
 * någon läser grants.
 *
 * ÅTGÄRDEN är EXAKT samma mönster som notifikationstjänsten redan
 * använder för sina arbetarfunktioner (20260818100000, revoke-blocket):
 * ta bort execute från public och från var och en av de fyra RLS-roller
 * som bootstrappen delar ut till. Ingen grant tillbaka - arbetaren äger
 * rättigheten genom sin egen roll, inte genom authenticated.
 *
 * VARFÖR DE FYRA ROLLERNA RÄKNAS UPP: en grant till en roll tas INTE bort
 * av en revoke från public. anon och authenticated fick execute direkt
 * via default privileges, och app_anon/app_user är rollerna de ärver
 * från. Alla fyra måste därför nämnas var för sig, precis som förebilden
 * gör.
 *
 * Att sviterna (billingJob.sql m.fl.) fortsätter passera beror på att de
 * anropar funktionerna som tabellägaren i testet, inte som authenticated
 * - vilket är samma väg arbetaren tar i drift.
 */

do $$
declare
  v_funcs text := '
    public.claim_outbound_emails(integer),
    public.mark_email_sent(uuid),
    public.mark_email_failed(uuid, text),
    public.close_overdue_accounts(timestamptz),
    public.reminder_candidates(timestamptz),
    public.credit_check_candidates(timestamptz)';
  v_role text;
begin
  execute format('revoke execute on function %s from public', v_funcs);
  foreach v_role in array array['anon', 'authenticated', 'app_anon', 'app_user'] loop
    if exists (select 1 from pg_roles where rolname = v_role) then
      execute format('revoke execute on function %s from %I', v_funcs, v_role);
    end if;
  end loop;
end $$;

comment on function public.close_overdue_accounts(timestamptz) is
  'Arbetarens kontostängning. INTE anropbar av klienten - endast ägaren/arbetaren. Stänger förfallna konton och returnerar vad som behövs för stängningsbeskedet.';
comment on function public.credit_check_candidates(timestamptz) is
  'Arbetarens kreditbevakning. INTE anropbar av klienten - returnerar bolag över alla tenants och går förbi radskyddet.';
