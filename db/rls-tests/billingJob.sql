-- Tester för close_overdue_accounts() och accounts_due_soon().
--
-- Körs efter migrationerna, som superanvändare: det som testas är jobbets
-- logik, inte radskyddet - det täcks av rls.sql. Datumen är fasta så att
-- varje gränsfall är exakt det gränsfall det utger sig för att vara.

do $$
declare
  v_user_trial_active uuid;
  v_user_trial_expired uuid;
  v_user_invoiced_open uuid;
  v_user_invoiced_overdue uuid;
  v_user_paid_overdue uuid;
  v_user_already_closed uuid;
  v_now timestamptz := '2026-08-20T12:00:00Z';
  v_closed integer;
  v_count integer;
begin
  -- Fixtur. En användare per gränsfall, namngivna efter vad de bevisar.
  -- password_hash sätts för att den självhostade auth.users kräver den
  -- (not null) - shimmen bryr sig inte. Samma fixtur måste ladda i båda.
  insert into auth.users (id, email, password_hash) values
    (gen_random_uuid(), 'trial-active@test.se', 'x'),
    (gen_random_uuid(), 'trial-expired@test.se', 'x'),
    (gen_random_uuid(), 'invoiced-open@test.se', 'x'),
    (gen_random_uuid(), 'invoiced-overdue@test.se', 'x'),
    (gen_random_uuid(), 'paid-overdue@test.se', 'x'),
    (gen_random_uuid(), 'already-closed@test.se', 'x');

  select id into v_user_trial_active from auth.users where email = 'trial-active@test.se';
  select id into v_user_trial_expired from auth.users where email = 'trial-expired@test.se';
  select id into v_user_invoiced_open from auth.users where email = 'invoiced-open@test.se';
  select id into v_user_invoiced_overdue from auth.users where email = 'invoiced-overdue@test.se';
  select id into v_user_paid_overdue from auth.users where email = 'paid-overdue@test.se';
  select id into v_user_already_closed from auth.users where email = 'already-closed@test.se';

  insert into public.account_billing (user_id, started_at, due_at, paid_at, closed_at) values
    -- Gratisveckan löper: startade 18 aug, "nu" är 20 aug. Ska inte röras.
    (v_user_trial_active, '2026-08-18T09:00:00Z', null, null, null),
    -- Gratisveckan slut 12 aug + hela förfallodagen. Ska stängas.
    (v_user_trial_expired, '2026-08-05T09:00:00Z', null, null, null),
    -- Fakturerad, förfaller 25 aug. Ska inte röras.
    (v_user_invoiced_open, '2026-08-01T09:00:00Z', '2026-08-25T09:00:00Z', null, null),
    -- Fakturerad, förföll 15 aug. Ska stängas.
    (v_user_invoiced_overdue, '2026-08-01T09:00:00Z', '2026-08-15T09:00:00Z', null, null),
    -- Förföll 15 aug MEN är betald. Får aldrig stängas.
    (v_user_paid_overdue, '2026-08-01T09:00:00Z', '2026-08-15T09:00:00Z', '2026-08-14T09:00:00Z', null),
    -- Redan stängd 16 aug. Ska inte få nytt datum.
    (v_user_already_closed, '2026-08-01T09:00:00Z', '2026-08-10T09:00:00Z', null, '2026-08-16T09:00:00Z');

  /* ---------------------------------------------------------------------- */

  select count(*) into v_closed from public.close_overdue_accounts(v_now);
  if v_closed <> 2 then
    raise exception 'FAIL: jobbet stängde % konton, förväntade 2 (trial-expired och invoiced-overdue)', v_closed;
  end if;
  raise notice 'ok 1: jobbet stängde exakt de två förfallna kontona';

  if exists (select 1 from public.account_billing where user_id = v_user_trial_active and closed_at is not null) then
    raise exception 'FAIL: löpande gratisperiod stängdes';
  end if;
  raise notice 'ok 2: löpande gratisperiod rörs inte';

  if not exists (select 1 from public.account_billing where user_id = v_user_trial_expired and closed_at = v_now) then
    raise exception 'FAIL: utgången gratisperiod utan faktura stängdes inte';
  end if;
  raise notice 'ok 3: utgången gratisperiod stängs även utan faktura';

  if exists (select 1 from public.account_billing where user_id = v_user_invoiced_open and closed_at is not null) then
    raise exception 'FAIL: konto med öppen betalningsfrist stängdes';
  end if;
  raise notice 'ok 4: öppen betalningsfrist rörs inte';

  -- Det viktigaste: ett betalt konto får aldrig stängas, oavsett datum.
  if exists (select 1 from public.account_billing where user_id = v_user_paid_overdue and closed_at is not null) then
    raise exception 'FAIL: BETALT konto stängdes - detta är det värsta felet jobbet kan göra';
  end if;
  raise notice 'ok 5: betalt konto rörs aldrig';

  if not exists (select 1 from public.account_billing where user_id = v_user_already_closed and closed_at = '2026-08-16T09:00:00Z') then
    raise exception 'FAIL: redan stängt konto fick nytt stängningsdatum';
  end if;
  raise notice 'ok 6: redan stängt konto behåller sitt datum';

  -- Idempotens: en andra körning gör ingenting.
  select count(*) into v_closed from public.close_overdue_accounts(v_now);
  if v_closed <> 0 then
    raise exception 'FAIL: andra körningen stängde % konton, förväntade 0', v_closed;
  end if;
  raise notice 'ok 7: jobbet är idempotent';

  -- Gränsen i tiden. Förfallodagen är den svenska kalenderdagen - det är den
  -- som står på fakturan - så gränsen går vid svensk midnatt, inte UTC.
  -- 2026-08-20T21:59:59Z är 23:59:59 den 20:e i Stockholm (UTC+2):
  -- fortfarande förfallodagen, inget stängs...
  update public.account_billing set closed_at = null, due_at = '2026-08-20T09:00:00Z'
  where user_id = v_user_invoiced_overdue;
  select count(*) into v_closed from public.close_overdue_accounts('2026-08-20T21:59:59Z');
  if v_closed <> 0 then
    raise exception 'FAIL: konto stängdes på förfallodagen - fristen ska gälla hela svenska dygnet';
  end if;
  raise notice 'ok 8: hela förfallodagen respekteras, i svensk tid';

  -- ...men 22:00:01Z är 00:00:01 den 21:e i Stockholm, och då stängs det.
  -- Klockslaget fakturan ställdes ut (09:00) ska inte spela någon roll -
  -- första versionen av jobbet hade det felet.
  select count(*) into v_closed from public.close_overdue_accounts('2026-08-20T22:00:01Z');
  if v_closed <> 1 then
    raise exception 'FAIL: konto stängdes inte dagen efter förfall (fick %)', v_closed;
  end if;
  raise notice 'ok 9: dagen efter förfall stängs kontot, oberoende av fakturans klockslag';

  /* ---------------------------------------------------------------------- */

  -- reminder_candidates: samma varsel som gränssnittet, med dubblettskydd.
  update public.account_billing set closed_at = null, paid_at = null, due_at = '2026-08-22T09:00:00Z'
  where user_id = v_user_invoiced_overdue;
  insert into public.customer_invoices
    (user_id, invoice_number, due_at, net_ore, vat_ore, gross_ore, vat_rate, description)
  values
    (v_user_invoiced_overdue, '2026-0099', '2026-08-22T09:00:00Z', 200000, 50000, 250000, 0.25, 'Test');

  select count(*) into v_count from public.reminder_candidates('2026-08-20T12:00:00Z')
  where user_id = v_user_invoiced_overdue;
  if v_count <> 1 then
    raise exception 'FAIL: konto som förfaller om två dagar syns inte bland påminnelserna';
  end if;
  raise notice 'ok 10: påminnelsen fångar konton inom varselfönstret';

  select count(*) into v_count from public.reminder_candidates('2026-08-10T12:00:00Z')
  where user_id = v_user_invoiced_overdue;
  if v_count <> 0 then
    raise exception 'FAIL: konto långt från förfall dök upp bland påminnelserna';
  end if;
  raise notice 'ok 11: påminnelsen tjatar inte i förtid';

  select count(*) into v_count from public.reminder_candidates('2026-08-20T12:00:00Z')
  where user_id = v_user_paid_overdue;
  if v_count <> 0 then
    raise exception 'FAIL: betalt konto fick påminnelse';
  end if;
  raise notice 'ok 12: betalt konto får ingen påminnelse';

  -- Dubblettskyddet: en köad påminnelse samma dag tystar kandidaten...
  insert into public.outbound_emails
    (recipient, subject, body_text, body_html, kind, related_user_id, created_at)
  values
    ('invoiced-overdue@test.se', 'Påminnelse', 'x', '<p>x</p>', 'payment_reminder',
     v_user_invoiced_overdue, '2026-08-20T08:00:00Z');

  select count(*) into v_count from public.reminder_candidates('2026-08-20T12:00:00Z')
  where user_id = v_user_invoiced_overdue;
  if v_count <> 0 then
    raise exception 'FAIL: mottagare med dagsfärsk påminnelse fick en till';
  end if;
  raise notice 'ok 13: högst en påminnelse per mottagare och dag';

  -- ...men nästa dag är kandidaten tillbaka.
  select count(*) into v_count from public.reminder_candidates('2026-08-21T12:00:00Z')
  where user_id = v_user_invoiced_overdue;
  if v_count <> 1 then
    raise exception 'FAIL: dubblettskyddet tystar även nästa dag';
  end if;
  raise notice 'ok 14: nästa dag påminns det igen';

  -- Stängningen ska berätta vem, med adress och fakturanummer, så att
  -- beskedet kan skickas. En stängning utan besked är den överraskning
  -- texterna finns för att förhindra.
  update public.account_billing set closed_at = null, due_at = '2026-08-15T09:00:00Z'
  where user_id = v_user_invoiced_overdue;
  if not exists (
    select 1 from public.close_overdue_accounts('2026-08-20T12:00:00Z')
    where email = 'invoiced-overdue@test.se' and invoice_number = '2026-0099'
  ) then
    raise exception 'FAIL: stängningen returnerar inte mottagare och fakturanummer';
  end if;
  raise notice 'ok 15: stängningen berättar vem som ska få beskedet';
end $$;

/*
 * ok 16: ARBETARENS FUNKTIONER ÄR STÄNGDA FÖR KLIENTEN.
 *
 * Samma vakt som notifikationstjänsten har (notifications.sql ok 24), men
 * för de äldre arbetarfunktionerna. De hade kvar execute till public och
 * till anon/authenticated - en inloggad kunde stänga andras konton med
 * close_overdue_accounts() och läsa andra bolags e-post ur
 * credit_check_candidates(). 20260819100000 tog bort rättigheten; den här
 * kontrollen ser till att den inte kommer tillbaka.
 */
do $$
declare
  v_bad text;
begin
  select string_agg(p.proname, ', ') into v_bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    -- retry_outbound_email står MEDVETET inte här: den prövar
    -- is_platform_admin() själv och är en klientanropbar driftfunktion.
    and p.proname in (
      'claim_outbound_emails', 'mark_email_sent', 'mark_email_failed',
      'close_overdue_accounts', 'reminder_candidates', 'credit_check_candidates')
    and (has_function_privilege('authenticated', p.oid, 'execute')
         or has_function_privilege('anon', p.oid, 'execute'));
  if v_bad is not null then
    raise exception 'FAIL  klienten kan anropa arbetarfunktionen: %', v_bad;
  end if;
  raise notice 'ok 16: de äldre arbetarfunktionerna är stängda för klienten';

  raise notice 'ALL BILLING JOB TESTS PASSED';
end $$;
