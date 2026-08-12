-- RADERINGENS DATABASLÖFTEN (GDPR art. 17).
--
-- Det här provet är byggt kring en enda fråga: FINNS PERSONEN KVAR
-- NÅGONSTANS EFTERÅT? Den går inte att svara på genom att räkna rader i de
-- tabeller man råkar komma på - den som glömmer en tabell skriver ett prov
-- som är grönt av just det skälet.
--
-- Därför söker avsnitt 5 igenom VARJE textkolumn i VARJE tabell i public,
-- auth och app efter namnet, adressen och telefonnumret, ur katalogen.
-- Lägger någon till en tabell som lagrar en e-postadress hittas den
-- automatiskt, utan att provet skrivits om. Det är skillnaden mellan att
-- pröva raderingen och att pröva sin egen minneslista.
--
-- Övriga avsnitt prövar det sökningen INTE kan se: att karenstiden håller,
-- att ensamma ärenden går men delade står kvar, att den som är kvar i ett
-- delat ärende fortfarande kommer in, och att undantagen - fakturan,
-- loggen, underskriften - faktiskt är kvar.
--
-- Körs som tabellägare i en transaktion som rullas tillbaka.

begin;

-- Agnes raderas. Bertil är kvar och delar ett ärende med henne.
insert into auth.users (id, email, password_hash) values
  ('a0000000-0000-0000-0000-000000000001', 'agnes.ek@exempel.se', 'scrypt$1$2$3$abc$def'),
  ('a0000000-0000-0000-0000-000000000002', 'bertil@annat.se', 'scrypt$1$2$3$abc$def');

insert into public.user_profiles (user_id, role, display_name, phone) values
  ('a0000000-0000-0000-0000-000000000001', 'company', 'Agnes Ek', '+46701234567'),
  ('a0000000-0000-0000-0000-000000000002', 'advisor', 'Bertil Boo', '+46709999999');

insert into public.verified_phones (user_id, e164, verified_at)
values ('a0000000-0000-0000-0000-000000000001', '+46701234567', now());

insert into public.notification_prefs (user_id, sms_enabled)
values ('a0000000-0000-0000-0000-000000000001', true);

-- Två ärenden: ett där Agnes är ensam, ett hon delar med Bertil.
insert into public.cases (id, user_id, org_number, company_name) values
  ('c0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001', '556012-3456', 'Agnes Bygg AB'),
  ('c0000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000001', '556099-9999', 'Delat Bolag AB');

-- Ägarskapet läggs till av triggern cases_add_creator_as_owner. Bara
-- rekonstruktören behöver skrivas in för hand.
insert into public.case_members (case_id, user_id, role) values
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'reconstructor');

-- Spår av Agnes spridda över produkten.
insert into public.notification_events
  (user_id, case_id, kind, severity, title, body, href, dedupe_key)
values ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002',
        'atgard-kravs', 'atgard', 'Något kräver din åtgärd',
        'Agnes Ek måste svara på frågan.', '/dashboard', 'test:1');

insert into public.outbound_sms (recipient, body, kind)
values ('+46701234567', '123456 är din kod för att slå på SMS-aviseringar.', 'verifiering');

insert into public.outbound_emails (recipient, subject, body_text, body_html, kind)
values ('agnes.ek@exempel.se', 'Välkommen', 'Hej Agnes Ek', '<p>Hej Agnes Ek</p>', 'valkomst');

insert into public.contact_messages (name, email, phone, company, message, user_id)
values ('Agnes Ek', 'agnes.ek@exempel.se', '+46701234567', 'Agnes Bygg AB',
        'Jag undrar hur en rekonstruktion går till i praktiken.',
        'a0000000-0000-0000-0000-000000000001');

insert into public.case_invitations (case_id, email, role, invited_by)
values ('c0000000-0000-0000-0000-000000000002', 'agnes.ek@exempel.se', 'company_staff',
        'a0000000-0000-0000-0000-000000000002');

insert into public.api_keys (owner_user_id, label, key_prefix, key_hash)
values ('a0000000-0000-0000-0000-000000000001', 'Agnes integration', 'clr_test',
        repeat('a', 64));

-- Undantagen: det som SKA överleva.
insert into public.customer_invoices
  (user_id, invoice_number, due_at, net_ore, vat_ore, gross_ore, vat_rate, description)
values ('a0000000-0000-0000-0000-000000000001', 'CL-2026-0001', now() + interval '30 days',
        98500, 24625, 123125, 0.250, 'Clearance Standard');

insert into public.audit_events
  (case_id, actor_user_id, actor_role, action, object_type, object_id)
values ('c0000000-0000-0000-0000-000000000002',
        'a0000000-0000-0000-0000-000000000001', 'owner', 'case.updated', 'cases',
        'c0000000-0000-0000-0000-000000000002');

/* --- 1. Begäran och karenstiden ------------------------------------------- */

do $$
declare
  v_rad public.erasure_requests;
  v_igen public.erasure_requests;
  v_resultat jsonb;
begin
  -- Identiteten sätts på BÅDA sätten. Supabase-skalet läser
  -- request.jwt.claim.sub, det självhostade läser app.user_id, och ett
  -- prov som bara sätter det ena är grönt i en miljö och rött i den andra.
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
  perform set_config('app.user_id', 'a0000000-0000-0000-0000-000000000001', true);

  v_rad := public.request_account_erasure();
  if v_rad.status <> 'begard' then
    raise exception 'FAIL  begäran fick status %', v_rad.status;
  end if;
  if v_rad.effective_at <= now() then
    raise exception 'FAIL  karenstiden är redan ute vid begäran';
  end if;
  if v_rad.effective_at > now() + interval '8 days' then
    raise exception 'FAIL  karenstiden är längre än sju dagar';
  end if;
  raise notice 'ok 1: begäran registreras med karenstid framåt i tiden';

  -- Ett andra klick ska ge samma begäran, inte en ny karenstid. Att
  -- förlänga vid varje klick hade gjort raderingen omöjlig att nå.
  v_igen := public.request_account_erasure();
  if v_igen.id <> v_rad.id or v_igen.effective_at <> v_rad.effective_at then
    raise exception 'FAIL  en andra begäran skapade en ny rad eller flyttade karenstiden';
  end if;
  raise notice 'ok 2: en andra begäran ger samma rad och samma karenstid';

  -- Innan tiden gått ut får ingenting hända.
  v_resultat := app.execute_due_erasures();
  if (v_resultat ->> 'utforda')::int <> 0 then
    raise exception 'FAIL  raderingen verkställdes före karenstiden';
  end if;
  if not exists (select 1 from auth.users
                 where id = 'a0000000-0000-0000-0000-000000000001'
                   and email = 'agnes.ek@exempel.se') then
    raise exception 'FAIL  kontot rördes trots att karenstiden löpte';
  end if;
  raise notice 'ok 3: ingenting verkställs innan karenstiden gått ut';
end $$;

/* --- 2. Återkallelsen ----------------------------------------------------- */

do $$
declare
  v_rad public.erasure_requests;
begin
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
  perform set_config('app.user_id', 'a0000000-0000-0000-0000-000000000001', true);

  v_rad := public.cancel_account_erasure();
  if v_rad.status <> 'aterkallad' or v_rad.cancelled_at is null then
    raise exception 'FAIL  återkallelsen tog inte';
  end if;
  raise notice 'ok 4: begäran går att återkalla';

  begin
    perform public.cancel_account_erasure();
    raise exception 'FAIL  gick att återkalla två gånger';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok 5: det finns inget att återkalla en andra gång';
  end;

  -- Och en ny begäran ska gå att göra efteråt: ångrandet får inte låsa
  -- ute den som ändrar sig tillbaka.
  v_rad := public.request_account_erasure();
  if v_rad.status <> 'begard' then
    raise exception 'FAIL  gick inte att begära igen efter återkallelse';
  end if;
  raise notice 'ok 6: en ny begäran går att göra efter en återkallelse';
end $$;

/* --- 3. Ingen kan begära radering av någon annan -------------------------- */

do $$
begin
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);
  perform set_config('app.user_id', 'a0000000-0000-0000-0000-000000000002', true);
  perform public.request_account_erasure();

  if exists (
    select 1 from public.erasure_requests
    where user_id = 'a0000000-0000-0000-0000-000000000002' and status = 'begard'
  ) then
    raise notice 'ok 7: begäran gäller alltid det egna kontot';
  else
    raise exception 'FAIL  Bertils begäran hamnade inte på Bertil';
  end if;

  -- Och Bertils begäran ska inte ha rört Agnes rad.
  if (select count(*) from public.erasure_requests where status = 'begard') <> 2 then
    raise exception 'FAIL  fel antal öppna begäranden';
  end if;

  perform public.cancel_account_erasure();
end $$;

/* --- 4. Verkställandet ---------------------------------------------------- */

do $$
declare
  v_resultat jsonb;
begin
  -- Backa karenstiden i stället för att vänta en vecka.
  update public.erasure_requests
  set effective_at = now() - interval '1 minute'
  where user_id = 'a0000000-0000-0000-0000-000000000001' and status = 'begard';

  v_resultat := app.execute_due_erasures();
  if (v_resultat ->> 'utforda')::int <> 1 then
    raise exception 'FAIL  % raderingar utförda, förväntat 1', v_resultat ->> 'utforda';
  end if;

  if not exists (
    select 1 from public.erasure_requests
    where user_id = 'a0000000-0000-0000-0000-000000000001'
      and status = 'genomford' and executed_at is not null and result is not null
  ) then
    raise exception 'FAIL  begäran stämplades inte som genomförd med resultat';
  end if;
  raise notice 'ok 8: begäran verkställs när karenstiden gått ut, och stämplas';
end $$;

/* --- 5. Finns personen kvar någonstans? ----------------------------------- */

-- Sökningen som inte bygger på minneslistor: varje text-, citext- och
-- jsonb-kolumn i varje tabell, ur katalogen.
do $$
declare
  v_kol record;
  v_traff bigint;
  v_fynd text[] := '{}';
  v_nal text;
begin
  foreach v_nal in array array['agnes.ek@exempel.se', 'Agnes Ek', '+46701234567']
  loop
    for v_kol in
      select c.table_schema, c.table_name, c.column_name
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
      where c.table_schema in ('public', 'auth', 'app')
        and t.table_type = 'BASE TABLE'
        and c.data_type in ('text', 'character varying', 'jsonb', 'USER-DEFINED')
    loop
      begin
        execute format(
          'select count(*) from %I.%I where %I::text like %L',
          v_kol.table_schema, v_kol.table_name, v_kol.column_name, '%' || v_nal || '%'
        ) into v_traff;
      exception when others then
        -- Kolumner som inte går att gjuta till text (enum-arrayer och
        -- liknande) hoppas över hellre än att fälla provet på fel grund.
        continue;
      end;

      if v_traff > 0 then
        v_fynd := v_fynd || format('%s.%s.%s (%s st, "%s")',
          v_kol.table_schema, v_kol.table_name, v_kol.column_name, v_traff, v_nal);
      end if;
    end loop;
  end loop;

  if array_length(v_fynd, 1) > 0 then
    raise exception 'FAIL  personuppgifter kvar efter radering: %',
      array_to_string(v_fynd, '; ');
  end if;
  raise notice 'ok 9: varken namn, e-postadress eller telefonnummer finns kvar i någon tabell';
end $$;

/* --- 6. Vad som gick, och vad som står kvar ------------------------------- */

do $$
declare
  v_epost text;
  v_hash text;
begin
  -- Kontoraden finns kvar, men som platshållare.
  select email, password_hash into v_epost, v_hash
  from auth.users where id = 'a0000000-0000-0000-0000-000000000001';

  if v_epost is null then
    raise exception 'FAIL  kontoraden raderades - då tar kaskaden delade ärenden med sig';
  end if;
  if v_epost not like '%@borttaget.invalid' then
    raise exception 'FAIL  e-postadressen byttes inte mot en död platshållare: %', v_epost;
  end if;
  if v_hash like 'scrypt$%' then
    raise exception 'FAIL  lösenordshashen ser fortfarande verifierbar ut';
  end if;
  if (select disabled_at from auth.users
      where id = 'a0000000-0000-0000-0000-000000000001') is null then
    raise exception 'FAIL  kontot stängdes inte';
  end if;
  raise notice 'ok 10: kontoraden står kvar som stängd platshållare';

  -- Ensamt ärende: borta. Delat ärende: kvar.
  if exists (select 1 from public.cases where id = 'c0000000-0000-0000-0000-000000000001') then
    raise exception 'FAIL  ärendet ingen annan kunde nå finns kvar';
  end if;
  if not exists (select 1 from public.cases where id = 'c0000000-0000-0000-0000-000000000002') then
    raise exception 'FAIL  det delade ärendet raderades - Bertil förlorade sitt underlag';
  end if;
  raise notice 'ok 11: ensamt ärende raderas, delat ärende står kvar';

  -- Bertil kommer fortfarande in.
  if not exists (
    select 1 from public.case_members
    where case_id = 'c0000000-0000-0000-0000-000000000002'
      and user_id = 'a0000000-0000-0000-0000-000000000002'
      and revoked_at is null
  ) then
    raise exception 'FAIL  Bertils behörighet drogs in av någon annans radering';
  end if;
  -- Agnes gör inte det.
  if exists (
    select 1 from public.case_members
    where user_id = 'a0000000-0000-0000-0000-000000000001' and revoked_at is null
  ) then
    raise exception 'FAIL  den raderade har kvar aktiv behörighet';
  end if;
  raise notice 'ok 12: behörigheten återkallas, och bara den raderades';

  -- Undantagen står kvar, och de står kvar OFÖRÄNDRADE.
  if not exists (
    select 1 from public.customer_invoices
    where user_id = 'a0000000-0000-0000-0000-000000000001'
      and invoice_number = 'CL-2026-0001' and gross_ore = 123125
  ) then
    raise exception 'FAIL  fakturan försvann - bokföringslagen 7 kap. 2 § kräver sju år';
  end if;
  raise notice 'ok 13: fakturan står kvar oförändrad';

  if not exists (
    select 1 from public.audit_events
    where actor_user_id = 'a0000000-0000-0000-0000-000000000001'
      and action = 'case.updated'
  ) then
    raise exception 'FAIL  händelseloggen tappade sin aktör';
  end if;
  if not exists (
    select 1 from public.audit_events where action = 'gdpr.radering.genomford'
  ) then
    raise exception 'FAIL  raderingen lämnade inget spår i loggen';
  end if;
  raise notice 'ok 14: loggen behåller sin aktör, och raderingen syns i den';

  -- Och det som skulle bort ÄR borta, inte bara osynligt.
  if exists (select 1 from public.api_keys
             where owner_user_id = 'a0000000-0000-0000-0000-000000000001') then
    raise exception 'FAIL  API-nyckeln finns kvar och fungerar';
  end if;
  if exists (select 1 from public.notification_prefs
             where user_id = 'a0000000-0000-0000-0000-000000000001') then
    raise exception 'FAIL  aviseringsvalen finns kvar';
  end if;
  raise notice 'ok 15: nycklar och aviseringsval är borta';
end $$;

/* --- 6b. Masken satt vid skrivning, inte i efterhand ---------------------- */

do $$
declare
  v_efter jsonb;
begin
  -- Inbjudan skapades med Agnes adress. Loggen ska ha bevarat HÄNDELSEN men
  -- inte adressen - och det ska ha skett redan när raden skrevs, för loggen
  -- går inte att städa i efterhand.
  select after into v_efter
  from public.audit_events
  where object_type = 'case_invitations' and action = 'insert'
  order by id limit 1;

  if v_efter is null then
    raise exception 'FAIL  inbjudan lämnade inget spår i loggen alls';
  end if;
  if v_efter ->> 'email' <> '[personuppgift]' then
    raise exception 'FAIL  e-postadressen maskerades inte i loggen: %', v_efter ->> 'email';
  end if;
  if v_efter ->> 'case_id' is null then
    raise exception 'FAIL  masken tog med sig ärendekopplingen';
  end if;
  raise notice 'ok 15b: loggen bevarar händelsen men inte identifikatorn';

  -- Och den ska fortfarande vara omöjlig att ändra. Skulle någon lösa ett
  -- framtida problem genom att öppna loggen är det HÄR det ska gå sönder.
  begin
    update public.audit_events set object_id = 'x' where id = (
      select min(id) from public.audit_events);
    raise exception 'FAIL  händelseloggen gick att ändra';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok 15c: loggen är fortfarande append-only, även för ägaren';
  end;
end $$;

/* --- 7. Gallringen gör det den räknar ------------------------------------- */

do $$
declare
  v_torr integer;
  v_skarp integer;
begin
  insert into app.rate_limits (nyckel, antal, nollstalls)
  values ('test:gammal', 3, now() - interval '2 hours'),
         ('test:farsk', 1, now() + interval '1 hour');

  -- Torrkörningen ska räkna rätt UTAN att röra något. En skuggsiffra som
  -- inte stämmer med den skarpa körningen är värre än ingen siffra.
  v_torr := app.gallra('hastighetsgrans', now() - interval '1 hour', true);
  if v_torr <> 1 then
    raise exception 'FAIL  torrkörningen räknade %, förväntat 1', v_torr;
  end if;
  if (select count(*) from app.rate_limits where nyckel = 'test:gammal') <> 1 then
    raise exception 'FAIL  torrkörningen raderade en rad';
  end if;

  v_skarp := app.gallra('hastighetsgrans', now() - interval '1 hour', false);
  if v_skarp <> v_torr then
    raise exception 'FAIL  skarp körning gallrade % rader, skuggan sa %', v_skarp, v_torr;
  end if;
  if exists (select 1 from app.rate_limits where nyckel = 'test:gammal') then
    raise exception 'FAIL  den gamla raden finns kvar efter skarp gallring';
  end if;
  if not exists (select 1 from app.rate_limits where nyckel = 'test:farsk') then
    raise exception 'FAIL  gallringen tog en rad som inte passerat sin tid';
  end if;
  raise notice 'ok 16: skuggsiffran och den skarpa körningen är samma siffra';

  -- Kategorin utan tidsgräns gallrar aldrig.
  if app.gallra('handelselogg', null, false) <> 0 then
    raise exception 'FAIL  händelseloggen gallrades';
  end if;
  raise notice 'ok 17: kategorin utan tidsgräns rör ingenting';

  -- En kategori som inte finns är ett fel, inte en tyst nolla. En felstavad
  -- driftparameter ska inte se ut som "ingenting att gallra".
  begin
    perform app.gallra('hittepa', now(), false);
    raise exception 'FAIL  okänd kategori gav inget fel';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'ok 18: okänd gallringskategori är ett fel';
  end;
end $$;

do $$
begin
  raise notice 'ALL ERASURE TESTS PASSED';
end $$;

rollback;
