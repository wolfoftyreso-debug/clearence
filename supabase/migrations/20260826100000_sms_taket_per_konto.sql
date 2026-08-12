/**
 * SMS-TAKET SOM FAKTISKT BINDER.
 *
 * Taket var fem koder per NUMMER och timme. Det stoppade den som tjatade
 * på samma nummer, och ingen annan: ett konto som byter nummer mellan
 * varje begäran fick fem nya försök per nummer, och antalet svenska
 * mobilnummer är tio miljoner. Kostnaden per SMS är verklig och betalas av
 * oss, så ett tak med den luckan är inget tak - det är en fördröjning.
 *
 * HÄR LÄGGS ETT ANDRA TAK: per KONTO och dygn. De två mäter olika saker
 * och behövs båda.
 *
 *   per nummer, per timme   skyddar MOTTAGAREN. Ett nummer ska inte kunna
 *                           bombarderas, oavsett hur många konton som
 *                           begär det.
 *   per konto, per dygn     skyddar KOSTNADEN. Ett konto ska inte kunna
 *                           beställa obegränsat med SMS genom att rotera
 *                           mottagare.
 *
 * Räkningen görs i app.rate_limits genom app.rate_limit_hit() - samma
 * delade räknare som API:ets hastighetsbegränsning, och därmed samma
 * städning och samma gallringskategori. En egen tabell för det här hade
 * varit en andra mekanik att underhålla och glömma.
 *
 * ORDNINGEN ÄR INTE GODTYCKLIG. Nummertaket prövas FÖRST, med en ren
 * räkning som inte förbrukar något. rate_limit_hit både räknar och ökar,
 * så hade den körts först skulle en begäran som ändå nekas av nummertaket
 * ha ätit av kontots dygnskvot. Man ska inte straffas dubbelt för samma
 * nekade försök.
 *
 * TAKET ÄR EN KONSTANT, inte en driftparameter, av samma skäl som femman
 * per nummer och timme: det är en säkerhets- och kostnadsspärr, inte ett
 * pris. Behöver den ändras ska det synas som en ändring i schemat.
 */

create or replace function public.start_phone_verification(
  p_e164 text,
  p_ttl_minutes integer default 10
)
returns void
language plpgsql
volatile
security definer
set search_path = public, extensions, app, pg_temp
as $$
declare
  v_slump bytea;
  v_kod text;
  v_ryms boolean;
begin
  if auth.uid() is null then
    raise exception 'Kräver inloggning';
  end if;

  -- Formen prövas här och inte bara i klienten. Tabellens check fångar
  -- den också, men ett tydligt fel är bättre än ett constraint-brott.
  if p_e164 !~ '^\+467\d{8}$' then
    raise exception 'Skriv ett svenskt mobilnummer, till exempel 070-123 45 67.';
  end if;

  if p_ttl_minutes is null or p_ttl_minutes < 1 or p_ttl_minutes > 60 then
    raise exception 'Giltighetstiden ska vara mellan 1 och 60 minuter';
  end if;

  -- 1. Mottagarens skydd. Ren räkning, förbrukar ingen kvot.
  if (select count(*) from public.outbound_sms
      where recipient = p_e164 and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'För många koder begärda. Försök igen om en stund.';
  end if;

  -- 2. Kostnadens skydd. Tio per konto och dygn räcker med god marginal
  -- för den som skriver fel nummer ett par gånger, och stoppar den som
  -- roterar mottagare för att komma runt taket ovan.
  select tillaten into v_ryms
  from app.rate_limit_hit('sms-verifiering:' || auth.uid()::text, 10, 86400);

  if not v_ryms then
    raise exception
      'Du har begärt för många verifieringskoder i dag. Försök igen i morgon, eller hör av dig till oss.';
  end if;

  /*
   * Sex siffror ur gen_random_bytes, inte ur random(). random() är en
   * förutsägbar generator: den som sett några utfall kan räkna ut nästa,
   * och då är vi tillbaka i att koden inte bevisar något.
   *
   * Fem byte läses som ett 40-bitarstal och tas modulo en miljon. Snedheten
   * av det är i storleksordningen 10^6/2^40 - omätbar - medan att ta en byte
   * per siffra modulo tio (som klienten gjorde) snedvrider varje siffra med
   * knappt en procent.
   */
  v_slump := gen_random_bytes(5);
  -- lpad tar text, inte bigint: talet gjuts därför innan det fylls ut.
  v_kod := lpad(
    ((
      (get_byte(v_slump, 0)::bigint << 32) |
      (get_byte(v_slump, 1)::bigint << 24) |
      (get_byte(v_slump, 2)::bigint << 16) |
      (get_byte(v_slump, 3)::bigint << 8) |
       get_byte(v_slump, 4)::bigint
    ) % 1000000)::text,
    6, '0');

  -- Ett byte av nummer nollställer verifieringen. Annars hade man kunnat
  -- verifiera sitt eget nummer och sedan byta till någon annans.
  insert into public.verified_phones (user_id, e164, code_sha256, code_expires_at, code_attempts)
  values (
    auth.uid(),
    p_e164,
    encode(digest(v_kod, 'sha256'), 'hex'),
    now() + make_interval(mins => p_ttl_minutes),
    0
  )
  on conflict (user_id) do update
    set e164 = excluded.e164,
        code_sha256 = excluded.code_sha256,
        code_expires_at = excluded.code_expires_at,
        code_attempts = 0,
        verified_at = null;

  -- Texten hålls likalydande med verificationSms() i
  -- src/lib/notifications/phone.ts. tests/notificationService.ts läser båda
  -- källorna och kräver att de säger samma sak.
  insert into public.outbound_sms (recipient, body, kind)
  values (
    p_e164,
    v_kod || ' är din kod för att slå på SMS-aviseringar. Koden gäller i '
          || p_ttl_minutes || ' minuter.',
    'verifiering'
  );
end;
$$;

comment on function public.start_phone_verification(text, integer) is
  'Sparar numret overifierat, föder en kod och köar SMS:et - i en transaktion. Två tak: fem per nummer och timme (skyddar mottagaren), tio per konto och dygn (skyddar kostnaden).';
