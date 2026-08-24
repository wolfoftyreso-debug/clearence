-- Omskick i utkorgen.
--
-- En rad som misslyckats fem gånger stannar som misslyckad tills en
-- människa tittar - det var beslutet, och det står kvar. Men "en människa
-- tittar" måste leda någonstans: när orsaken är åtgärdad (felstavad adress
-- rättad hos mottagaren, DNS lagat, SES-kvot höjd) ska driften kunna säga
-- "försök igen" utan att gå in i databasen för hand.
--
-- Omskicket ÅTERSTÄLLER FÖRSÖKSRÄKNAREN men RADERAR INTE FELET: last_error
-- ligger kvar tills nästa försök skriver över det, så historiken inte
-- försvinner i samma klick som beslutet. Endast misslyckade rader kan
-- skickas om - att köa om ett redan skickat mejl vore att skicka kunden
-- samma faktura två gånger.

create or replace function public.retry_outbound_email(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_status public.outbound_email_status;
begin
  if not public.is_platform_admin() then
    raise exception 'Kräver driftbehörighet';
  end if;

  select status into v_status from public.outbound_emails where id = p_id for update;
  if v_status is null then
    raise exception 'Raden finns inte';
  end if;
  if v_status <> 'failed' then
    raise exception 'Endast misslyckade utskick kan skickas om';
  end if;

  update public.outbound_emails
  set status = 'pending', attempts = 0
  where id = p_id;
end;
$$;

comment on function public.retry_outbound_email(uuid) is
  'Drift: köar om ett misslyckat utskick. Räknaren nollställs, felet ligger kvar tills nästa försök. Skickade rader rörs aldrig.';
