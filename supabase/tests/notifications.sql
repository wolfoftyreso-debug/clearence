-- Aviseringstjänstens databaslöften.
--
-- Fyra saker som databasen - och bara databasen - kan garantera:
--
--   1. ENGÅNGSGARANTIN. Samma dedupe_key två gånger ger EN händelse.
--      Regelmotorn i TypeScript kan inte lova det; ett unikt index kan.
--   2. Kön går inte att förbigå. Verifieringskoden är inte läsbar för
--      någon klient, och händelser går inte att skapa utifrån.
--   3. Koden är gissningssäker: fem försök, en livslängd, och ett byte
--      av nummer nollställer verifieringen.
--   4. Tyst tid SKJUTER UPP utan att bränna försöksräknaren.
--
-- Körs som tabellägare i en transaktion som rullas tillbaka.

begin;

insert into auth.users (id, email, password_hash) values
  ('a0000000-0000-0000-0000-000000000001', 'agnes@bolaget.se', 'x'),
  ('a0000000-0000-0000-0000-000000000002', 'bertil@annat.se', 'x');

insert into public.cases (id, user_id, org_number, company_name)
values ('c0000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000001', '556012-3456', 'Agnes Bygg AB');

/* --- 1. Engångsgarantin --------------------------------------------------- */

do $$
declare
  v_first uuid;
  v_second uuid;
  v_events int;
  v_deliveries int;
begin
  v_first := public.enqueue_notification(
    'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
    'atgard-kravs', 'atgard', 'Något kräver din åtgärd', 'Ärendet står stilla.', '/dashboard',
    'atgard-kravs:a0000000-0000-0000-0000-000000000001:c0000000-0000-0000-0000-000000000001:t1:-');

  if v_first is null then
    raise exception 'FAIL  första köandet gav ingen händelse';
  end if;
  raise notice 'ok 1: en avisering köas';

  -- Samma upptäckt igen. Ska bli en no-op, inte ett andra SMS.
  v_second := public.enqueue_notification(
    'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
    'atgard-kravs', 'atgard', 'Något kräver din åtgärd', 'Ärendet står stilla.', '/dashboard',
    'atgard-kravs:a0000000-0000-0000-0000-000000000001:c0000000-0000-0000-0000-000000000001:t1:-');

  if v_second is not null then
    raise exception 'FAIL  samma händelse köades två gånger';
  end if;

  select count(*) into v_events from public.notification_events;
  if v_events <> 1 then
    raise exception 'FAIL  % händelser, förväntat 1', v_events;
  end if;

  select count(*) into v_deliveries from public.notification_deliveries;
  if v_deliveries <> 3 then
    raise exception 'FAIL  % leveranser, förväntat 3 (app, e-post, sms)', v_deliveries;
  end if;
  raise notice 'ok 2: samma händelse en gång till ger ingen ny rad och inga nya utskick';
end $$;

do $$
declare
  v_status public.notification_delivery_status;
begin
  -- Klockan i appen ÄR levererad i samma stund raden finns.
  select status into v_status from public.notification_deliveries d
  join public.notification_events e on e.id = d.event_id
  where d.channel = 'inapp';
  if v_status <> 'sent' then
    raise exception 'FAIL  klockan i appen står som %, förväntat sent', v_status;
  end if;
  raise notice 'ok 3: klockan i appen kräver ingen arbetare';
end $$;

/* --- 2. Kön går inte att förbigå ------------------------------------------ */

do $$
declare
  v_count int;
begin
  -- Samma kanal två gånger för samma händelse vore två SMS.
  begin
    insert into public.notification_deliveries (event_id, channel)
    select id, 'sms' from public.notification_events limit 1;
    raise exception 'FAIL  samma kanal kunde läggas till två gånger';
  exception when unique_violation then
    raise notice 'ok 4: en kanal kan bara ha ett försök per händelse';
  end;

  -- En avslutad rad måste ha en tidsstämpel, och en undertryckt ett skäl.
  begin
    update public.notification_deliveries set status = 'sent' where channel = 'email';
    raise exception 'FAIL  sent utan tidsstämpel godtogs';
  exception when check_violation then
    raise notice 'ok 5: skickad utan tidpunkt går inte att skriva';
  end;

  begin
    update public.notification_deliveries set status = 'suppressed' where channel = 'email';
    raise exception 'FAIL  undertryckt utan skäl godtogs';
  exception when check_violation then
    raise notice 'ok 6: undertryckt utan skäl går inte att skriva';
  end;

  select count(*) into v_count from pg_policies
  where schemaname = 'public' and tablename = 'notification_events' and cmd = 'INSERT';
  if v_count <> 0 then
    raise exception 'FAIL  det finns % insert-policy på händelserna', v_count;
  end if;
  raise notice 'ok 7: ingen klient kan skapa en avisering utifrån';

  select count(*) into v_count from pg_policies
  where schemaname = 'public' and tablename = 'outbound_sms';
  if v_count <> 0 then
    raise exception 'FAIL  verifieringskön har % policyer - den ska vara helt stängd', v_count;
  end if;
  raise notice 'ok 8: verifieringskön är oläsbar för klienten';
end $$;

/* --- 3. Numret och koden -------------------------------------------------- */

/*
 * KODEN FÖDS I DATABASEN, OCH TESTET FÅR INTE VETA DEN I FÖRVÄG.
 *
 * Den här sektionen prövade förut ett flöde där testet självt valde koden
 * och skickade in dess hash - precis som klienten gjorde, och precis
 * därför bevisade verifieringen ingenting (se migration 20260822100000).
 * Ett test som matar in svaret prövar inte något.
 *
 * Nu läses koden ur outbound_sms, alltså ur det som faktiskt skickas till
 * telefonen. Det bevisar två saker på en gång: att SMS:et bär en riktig
 * kod, och att hashen på raden hör ihop med just den koden.
 */

do $$
declare
  v_ok boolean;
  v_row public.verified_phones;
  v_kod text;
  v_annan text;
begin
  -- Båda nycklarna: Supabase-harnessen läser request.jwt.claim.sub, den
  -- självhostade bootstrappen läser app.user_id. Samma grepp som rls.sql.
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
  perform set_config('app.user_id', 'a0000000-0000-0000-0000-000000000001', true);

  perform public.start_phone_verification('+46701234567', 10);
  select * into v_row from public.verified_phones where user_id = auth.uid();
  if v_row.verified_at is not null then
    raise exception 'FAIL  numret var verifierat direkt';
  end if;
  raise notice 'ok 9: numret läggs in overifierat';

  -- Koden hämtas ur kön, för det är enda stället den finns i klartext.
  select substring(body from '(\d{6})') into v_kod
  from public.outbound_sms
  where recipient = '+46701234567'
  order by created_at desc limit 1;
  if v_kod is null then
    raise exception 'FAIL  inget SMS köades med en kod';
  end if;
  if v_row.code_sha256 <> encode(digest(v_kod, 'sha256'), 'hex') then
    raise exception 'FAIL  hashen på raden hör inte ihop med koden i SMS:et';
  end if;
  raise notice 'ok 10: SMS:ets kod och radens hash hör ihop';

  v_ok := public.confirm_phone_verification(case when v_kod = '999999' then '111111' else '999999' end);
  if v_ok then
    raise exception 'FAIL  fel kod godtogs';
  end if;
  raise notice 'ok 11: fel kod ger nej';

  v_ok := public.confirm_phone_verification(v_kod);
  if not v_ok then
    raise exception 'FAIL  rätt kod godtogs inte';
  end if;
  select * into v_row from public.verified_phones where user_id = auth.uid();
  if v_row.verified_at is null or v_row.code_sha256 is not null then
    raise exception 'FAIL  verifieringen städade inte upp efter sig';
  end if;
  raise notice 'ok 12: rätt kod verifierar, och koden brinner upp';

  -- Ett verifierat nummer har ingen kod kvar att gissa på.
  v_ok := public.confirm_phone_verification(v_kod);
  if v_ok then
    raise exception 'FAIL  koden gick att använda igen';
  end if;
  raise notice 'ok 13: en förbrukad kod går inte att återanvända';

  -- Två begäranden ska inte ge samma kod. En fast kod hade varit exakt
  -- lika värdelös som en kod klienten själv väljer.
  perform public.start_phone_verification('+46702222222', 10);
  select substring(body from '(\d{6})') into v_kod
  from public.outbound_sms where recipient = '+46702222222' order by created_at desc limit 1;
  perform public.start_phone_verification('+46703333333', 10);
  select substring(body from '(\d{6})') into v_annan
  from public.outbound_sms where recipient = '+46703333333' order by created_at desc limit 1;
  if v_kod = v_annan then
    raise exception 'FAIL  två begäranden gav samma kod (%)', v_kod;
  end if;
  raise notice 'ok 14: koden är inte densamma två gånger';
end $$;

do $$
declare
  v_ok boolean;
  v_row public.verified_phones;
  v_kod text;
begin
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
  perform set_config('app.user_id', 'a0000000-0000-0000-0000-000000000001', true);

  -- Byte av nummer nollställer verifieringen. Annars kunde man verifiera
  -- sitt eget nummer och sedan byta till någon annans.
  perform public.start_phone_verification('+46709999999', 10);
  select * into v_row from public.verified_phones where user_id = auth.uid();
  if v_row.verified_at is not null then
    raise exception 'FAIL  det nya numret ärvde verifieringen';
  end if;
  raise notice 'ok 15: ett nytt nummer måste verifieras på nytt';

  select substring(body from '(\d{6})') into v_kod
  from public.outbound_sms where recipient = '+46709999999' order by created_at desc limit 1;

  -- Fem fel bränner koden.
  for i in 1..5 loop
    v_ok := public.confirm_phone_verification(
      lpad(((v_kod::int + i) % 1000000)::text, 6, '0'));
  end loop;
  v_ok := public.confirm_phone_verification(v_kod);
  if v_ok then
    raise exception 'FAIL  rätt kod godtogs efter fem felförsök';
  end if;
  raise notice 'ok 16: fem gissningar bränner koden';
end $$;

do $$
begin
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
  perform set_config('app.user_id', 'a0000000-0000-0000-0000-000000000001', true);

  -- Ett fast nummer kan inte ta emot SMS. Ett tyst misslyckande vore
  -- värre än ett nej.
  begin
    perform public.start_phone_verification('+46812345678', 10);
    raise exception 'FAIL  ett fast nummer godtogs';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok 17: bara mobilnummer godtas';
  end;

  -- DEN GAMLA VÄGEN SKA VARA STÄNGD. Så länge treargumentsformen finns
  -- kvar kan en klient fortsätta välja koden själv, hur bra den nya
  -- funktionen än är.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'start_phone_verification'
      and pg_get_function_identity_arguments(p.oid) = 'text, text, integer'
  ) then
    raise exception 'FAIL  den gamla signaturen med klientvald kodhash finns kvar';
  end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'queue_verification_sms'
  ) then
    raise exception 'FAIL  queue_verification_sms finns kvar som egen yta';
  end if;
  raise notice 'ok 18: den gamla vägen där klienten valde koden är borta';
end $$;

/* --- 4. Kön, uppskjutningen och taket ------------------------------------- */

do $$
declare
  v_id uuid;
  v_attempts int;
  v_rows int;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('app.user_id', '', true);

  select id into v_id from public.notification_deliveries where channel = 'sms';

  -- Hämtningen räknar upp försöket.
  select count(*) into v_rows from public.claim_notification_deliveries(50);
  if v_rows < 2 then
    raise exception 'FAIL  hämtningen gav % rader, förväntat minst 2', v_rows;
  end if;
  select attempts into v_attempts from public.notification_deliveries where id = v_id;
  if v_attempts <> 1 then
    raise exception 'FAIL  försöket räknades inte upp (%)', v_attempts;
  end if;
  raise notice 'ok 17: hämtningen räknar upp försöket';

  -- Uppskjutning ska INTE bränna ett försök: annars äter tyst tid upp
  -- taket, och beskedet kastas efter fem nätter.
  perform public.defer_notification(v_id, now() + interval '4 hours');
  select attempts into v_attempts from public.notification_deliveries where id = v_id;
  if v_attempts <> 0 then
    raise exception 'FAIL  uppskjutningen brände ett försök (%)', v_attempts;
  end if;
  raise notice 'ok 18: tyst tid kostar inget försök';

  -- Och den uppskjutna raden plockas inte upp igen förrän tiden är inne.
  select count(*) into v_rows from public.claim_notification_deliveries(50)
  where delivery_id = v_id;
  if v_rows <> 0 then
    raise exception 'FAIL  en uppskjuten rad plockades upp för tidigt';
  end if;
  raise notice 'ok 19: den uppskjutna raden ligger kvar tills tiden är inne';
end $$;

do $$
declare
  v_id uuid;
  v_status public.notification_delivery_status;
begin
  select id into v_id from public.notification_deliveries where channel = 'email';

  -- Nollställt utgångsläge. Raden har redan plockats upp av kontrollerna
  -- ovan, och det här blocket räknar försök - inte historik.
  update public.notification_deliveries set attempts = 0 where id = v_id;

  -- Fyra fel: raden lever, för en tillfällig störning ska inte döda den.
  for i in 1..4 loop
    perform public.claim_notification_deliveries(50);
    perform public.mark_notification_failed(v_id, 'tillfälligt fel');
  end loop;
  select status into v_status from public.notification_deliveries where id = v_id;
  if v_status <> 'pending' then
    raise exception 'FAIL  raden gav upp för tidigt (%)', v_status;
  end if;
  raise notice 'ok 20: ett par misslyckanden dödar inte raden';

  -- Femte: nu ger vi upp. En adress som studsar studsar även försök sextio.
  perform public.claim_notification_deliveries(50);
  perform public.mark_notification_failed(v_id, 'permanent fel');
  select status into v_status from public.notification_deliveries where id = v_id;
  if v_status <> 'failed' then
    raise exception 'FAIL  raden gav inte upp vid taket (%)', v_status;
  end if;
  raise notice 'ok 21: vid taket ger raden upp, med felet kvar';
end $$;

/* --- 5. Nivån på abonnemanget --------------------------------------------- */

do $$
begin
  insert into public.account_billing (user_id) values ('a0000000-0000-0000-0000-000000000002');
  -- Förvalet ska vara standard, inte business: att gissa fel uppåt vore
  -- att dela ut en betald kanal gratis.
  if (select plan_id from public.account_billing
      where user_id = 'a0000000-0000-0000-0000-000000000002') <> 'standard' then
    raise exception 'FAIL  fel förvald nivå';
  end if;
  raise notice 'ok 22: nivån förvalas till standard';

  begin
    update public.account_billing set plan_id = 'platinum'
    where user_id = 'a0000000-0000-0000-0000-000000000002';
    raise exception 'FAIL  en påhittad nivå godtogs';
  exception when check_violation then
    raise notice 'ok 23: bara de fyra nivåerna finns';
  end;
end $$;

/* --- 6. Vem som får anropa vad -------------------------------------------- */

-- SECURITY DEFINER kringgår radskyddet. Ett hål här syns inte i någon
-- policy, så det måste prövas på rättigheten.
do $$
declare
  v_bad text;
begin
  select string_agg(p.proname, ', ') into v_bad
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'enqueue_notification', 'claim_notification_deliveries', 'mark_notification_sent',
      'mark_notification_suppressed', 'defer_notification', 'mark_notification_failed',
      'claim_outbound_sms', 'mark_sms_sent', 'mark_sms_failed')
    and (has_function_privilege('authenticated', p.oid, 'execute')
         or has_function_privilege('anon', p.oid, 'execute'));

  if v_bad is not null then
    raise exception 'FAIL  klienten kan anropa arbetarens funktioner: %', v_bad;
  end if;
  raise notice 'ok 24: arbetarens funktioner är stängda för klienten';
end $$;

do $$
declare
  v_missing text;
begin
  select string_agg(p.proname, ', ') into v_missing
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('start_phone_verification', 'confirm_phone_verification',
                      'remove_phone')
    and not has_function_privilege('authenticated', p.oid, 'execute');

  if v_missing is not null then
    raise exception 'FAIL  användaren kan inte verifiera sitt nummer: %', v_missing;
  end if;
  raise notice 'ok 25: användarens egna funktioner är öppna';
end $$;

/*
 * SMS:ET KÖAS AV FUNKTIONEN SJÄLV, INTE AV ANROPAREN.
 *
 * queue_verification_sms(p_body) fanns förut som egen yta: klienten
 * skickade in TEXTEN, alltså den sträng som skulle nå telefonen. En
 * "skicka det här till mitt nummer"-funktion är en text angriparen
 * skriver, och kostar dessutom pengar per anrop. Den är borta; kön fylls
 * nu i samma transaktion som koden föds.
 *
 * Taket - fem per nummer och timme - följde med hit, och prövas här mot
 * den enda väg som finns kvar.
 */
do $$
declare
  v_count int;
begin
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);
  perform set_config('app.user_id', 'a0000000-0000-0000-0000-000000000002', true);

  perform public.start_phone_verification('+46705555555', 10);
  select count(*) into v_count from public.outbound_sms where recipient = '+46705555555';
  if v_count <> 1 then
    raise exception 'FAIL  % SMS köade, förväntat 1', v_count;
  end if;
  raise notice 'ok 26: koden går till numret användaren just angav, i ett enda SMS';

  -- Taket: fem per nummer och timme. Utan det kan samma nummer begäras
  -- om och om, och varje begäran kostar.
  for i in 1..4 loop
    perform public.start_phone_verification('+46705555555', 10);
  end loop;
  begin
    perform public.start_phone_verification('+46705555555', 10);
    raise exception 'FAIL  taket höll inte';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok 27: fem koder per timme och nummer, inte fler';
  end;
end $$;

do $$
begin
  raise notice 'ALL NOTIFICATION TESTS PASSED';
end $$;

rollback;
