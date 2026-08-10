/**
 * TELEFONVERIFIERINGEN BEVISADE INGENTING.
 *
 * Så här såg flödet ut innan den här migrationen:
 *
 *     klienten          slumpar koden
 *     klienten          hashar koden
 *     klienten  ->  db  start_phone_verification(nummer, HASHEN)
 *     klienten  ->  db  queue_verification_sms(TEXTEN MED KODEN)
 *     ...
 *     klienten  ->  db  confirm_phone_verification(HASHEN IGEN)
 *
 * Koden föddes alltså hos den som skulle bevisa något med den. Den som
 * kunde anropa API:t - vilket är var och en med ett konto, eftersom hela
 * frontendens implementation är läsbar - kunde välja koden själv, hoppa
 * över SMS:et helt och bekräfta direkt. Verifieringen sa "det här numret
 * tillhör användaren"; den visste bara att användaren kan räkna till sex.
 *
 * Det är inte en teoretisk brist. Numret används sedan för aviseringar
 * som säger att någon har ett ärende hos CLEARANCE, och CLEARANCE finns
 * bara för bolag i kris. Ett verifierat nummer som tillhör någon annan är
 * en läcka av just den uppgift produkten är byggd för att skydda.
 *
 * SKÄLET SOM ANGAVS var att databasen aldrig skulle se klartexten. Det
 * skälet höll inte ens i den gamla koden: SMS:ets text skickades in som
 * argument till queue_verification_sms och landade i outbound_sms.body -
 * med koden i sig. Databasen såg alltså redan klartexten, bara på ett
 * ställe där ingen letade efter den.
 *
 * EFTER DEN HÄR MIGRATIONEN föds koden här inne, i samma funktion som
 * köar SMS:et, och lämnar aldrig databasen åt något annat håll än till
 * telefonen. Anroparen får `void` tillbaka. Det finns ingen väg för en
 * klient att välja, läsa eller gissa koden - och därmed betyder ett
 * verifierat nummer äntligen att någon höll telefonen i handen.
 *
 * Rättningen görs i DATABASEN, inte i API:t, därför att den då gäller
 * varje väg in: eget API, PostgREST och psql. En kontroll som bara finns
 * i ett av lagren är en kontroll man kan gå runt.
 */

/* --- Ut med den gamla formen ---------------------------------------------- */

-- Signaturen ändras (hashen bort), så det räcker inte med create or
-- replace: den hade lämnat kvar den gamla funktionen bredvid den nya, och
-- klienten hade kunnat fortsätta anropa exakt den väg som just stängdes.
drop function if exists public.start_phone_verification(text, text, integer);

-- Den här behövs inte längre: SMS:et köas av funktionen nedan, i samma
-- transaktion som koden sätts. En separat "köa den här texten till mitt
-- eget nummer"-funktion är en text angriparen skriver.
drop function if exists public.queue_verification_sms(text);

/* --- In med den nya -------------------------------------------------------- */

/**
 * Steg 1: numret sparas overifierat, en kod föds här inne, och SMS:et köas.
 *
 * Allt i en transaktion. Antingen finns raden och kön har posten, eller så
 * finns ingetdera - ett halvvägs tillstånd hade betytt ett nummer som
 * väntar på en kod som aldrig skickas.
 *
 * Taket per nummer och timme bodde förut i queue_verification_sms och
 * följer med hit oförändrat: varje SMS kostar pengar, och den som ville
 * kunde annars begära om och om.
 */
create or replace function public.start_phone_verification(
  p_e164 text,
  p_ttl_minutes integer default 10
)
returns void
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_slump bytea;
  v_kod text;
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

  if (select count(*) from public.outbound_sms
      where recipient = p_e164 and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'För många koder begärda. Försök igen om en stund.';
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
  'Föder verifieringskoden, sparar hashen och köar SMS:et - i en transaktion. '
  'Koden returneras aldrig: anroparen ska behöva telefonen för att få veta den.';

revoke all on function public.start_phone_verification(text, integer) from public;
grant execute on function public.start_phone_verification(text, integer) to authenticated;

/* --- Steg 2 tar koden, inte hashen ---------------------------------------- */

/**
 * Prövningen tar numera KLARTEXTKODEN.
 *
 * Att låta klienten hasha var meningsfullt så länge klienten också ägde
 * koden - men just det ägandet var bristen. När koden föds här inne är
 * det hashen som är hemligheten, och den som kan skicka rätt hash har
 * redan bevisat exakt lika mycket som den som kan skicka rätt kod. Att
 * ta klartexten gör i stället kontraktet läsbart: in går det användaren
 * skrev av från sin telefon, jämförelsen sker där hashen bor.
 *
 * Räknaren höjs FÖRE jämförelsen, så att ett avbrutet anrop inte ger ett
 * gratis försök. Fem fel bränner koden - den som gissar ska behöva börja
 * om och få ett nytt SMS, vilket både kostar och syns.
 */
drop function if exists public.confirm_phone_verification(text);

create or replace function public.confirm_phone_verification(p_code text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_row public.verified_phones;
begin
  if auth.uid() is null then
    raise exception 'Kräver inloggning';
  end if;

  -- Formen prövas innan raden låses: en kod som inte kan vara rätt ska
  -- inte kosta ett av de fem försöken.
  if p_code is null or p_code !~ '^\d{6}$' then
    return false;
  end if;

  select * into v_row from public.verified_phones where user_id = auth.uid() for update;
  if v_row is null or v_row.code_sha256 is null then
    return false;
  end if;
  if v_row.code_expires_at < now() or v_row.code_attempts >= 5 then
    return false;
  end if;

  update public.verified_phones
  set code_attempts = code_attempts + 1
  where user_id = auth.uid();

  if v_row.code_sha256 <> encode(digest(p_code, 'sha256'), 'hex') then
    return false;
  end if;

  update public.verified_phones
  set verified_at = now(), code_sha256 = null, code_expires_at = null
  where user_id = auth.uid();

  return true;
end;
$$;

comment on function public.confirm_phone_verification(text) is
  'Prövar koden användaren skrev av från sitt SMS. Fem försök, sedan bränns den.';

revoke all on function public.confirm_phone_verification(text) from public;
grant execute on function public.confirm_phone_verification(text) to authenticated;
