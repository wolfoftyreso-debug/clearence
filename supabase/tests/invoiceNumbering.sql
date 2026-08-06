-- NUMMERSERIEN HÅLLER ÄVEN NÄR NÅGON ANNAN STÄLLER UT MITT I KÖRNINGEN.
--
-- Fönstret som stängdes i 20260811090000: månadsjobbet läste sitt max EN
-- gång, före loopen, och räknade sedan uppåt själv. Ett utställande som
-- landade mellan läsningen och en senare infogning tog numret jobbet redan
-- tänkt sig. Unikhetsvillkoret fångade det - som ett AVBRUTET MÅNADSJOBB,
-- mitt i en körning som redan fakturerat halva listan.
--
-- Att prova det kräver något som infogar mitt i loopen. En riktig
-- samtidig session går inte att ha inne i en testtransaktion, så testet
-- använder en trigger som gör exakt samma sak vid exakt fel tillfälle:
-- när jobbets FÖRSTA faktura landar ställs ytterligare en faktura ut, som
-- om en drifthandläggare tryckt på knappen i samma sekund.
--
-- Med den gamla koden kolliderar jobbets andra rad med triggerns faktura
-- och körningen faller. Med numret hämtat inne i loopen finns ingen
-- föråldrad räknare att kollidera med.
--
-- Körs som tabellägare, i en transaktion som rullas tillbaka.

begin;

insert into auth.users (id, email, password_hash) values
  ('b1111111-1111-1111-1111-111111111111', 'nummer1@byra.se', 'x'),
  ('b2222222-2222-2222-2222-222222222222', 'nummer2@byra.se', 'x'),
  ('b3333333-3333-3333-3333-333333333333', 'nummerkund@bolag.se', 'x');

insert into public.professionals (id, name, company, category, user_id, referral_fee, billing_email) values
  ('e1111111-0000-0000-0000-000000000001', 'Ada Nord', 'Nord Rekonstruktion AB', 'rekonstruktor',
   'b1111111-1111-1111-1111-111111111111', 1000, 'faktura@nord.se'),
  ('e2222222-0000-0000-0000-000000000002', 'Bea Syd', 'Syd Juridik AB', 'affarsjurist',
   'b2222222-2222-2222-2222-222222222222', 2000, 'faktura@syd.se');

-- En fakturerbar förmedling var. Två rådgivare = loopen kör två varv, och
-- det är först på det andra varvet den gamla koden går sönder.
insert into public.referrals (professional_id, referrer_user_id, channel, status) values
  ('e1111111-0000-0000-0000-000000000001', 'b3333333-3333-3333-3333-333333333333', 'email', 'initiated'),
  ('e2222222-0000-0000-0000-000000000002', 'b3333333-3333-3333-3333-333333333333', 'email', 'initiated');

update public.referrals set status = 'accepted'
where professional_id in (
  'e1111111-0000-0000-0000-000000000001',
  'e2222222-0000-0000-0000-000000000002'
);

alter table public.referrals disable trigger stamp_referral_billing_trigger;
update public.referrals set billable_at = '2026-07-10T10:00:00+02'
where professional_id in (
  'e1111111-0000-0000-0000-000000000001',
  'e2222222-0000-0000-0000-000000000002'
);
alter table public.referrals enable trigger stamp_referral_billing_trigger;

/* --- den samtidiga utställaren ------------------------------------------- */

-- Fyra saker gör triggern trovärdig som stand-in för en annan session:
-- den infogar i samma tabell, den hämtar numret ur samma funktion, den
-- gör det MELLAN jobbets varv, och den gör det bara en gång (annars
-- rekurserar den i all oändlighet).
create or replace function pg_temp.samtidigt_utstallande()
returns trigger
language plpgsql
as $$
begin
  if current_setting('test.interloper', true) = 'klar' then
    return null;
  end if;
  if new.description not like 'Förmedlade förfrågningar%' then
    return null;
  end if;
  perform set_config('test.interloper', 'klar', true);

  insert into public.customer_invoices
    (user_id, invoice_number, due_at, net_ore, vat_ore, gross_ore, vat_rate, description)
  values
    ('b3333333-3333-3333-3333-333333333333', app.next_invoice_number('2026-08-01T05:00:00Z'),
     '2026-08-11T05:00:00Z', 10000, 2500, 12500, 0.25, 'Utställd av drift mitt i körningen');
  return null;
end;
$$;

create trigger samtidigt_utstallande_trigger
after insert on public.customer_invoices
for each row execute function pg_temp.samtidigt_utstallande();

/* --- körningen ----------------------------------------------------------- */

create temp table korning as
select * from public.issue_referral_invoices('2026-08-01T05:00:00Z');

drop trigger samtidigt_utstallande_trigger on public.customer_invoices;

do $$
declare
  v_count int;
  v_skipped int;
begin
  select count(*), count(*) filter (where skipped_reason is not null)
  into v_count, v_skipped from korning;
  if v_count <> 2 or v_skipped <> 0 then
    raise exception 'FAIL  körningen gav % rader varav % överhoppade', v_count, v_skipped;
  end if;
  raise notice 'ok 1: båda rådgivarna fakturerades trots utställandet mitt i';
end $$;

do $$
declare
  v_row record;
begin
  select * into v_row from korning where customer_name = 'Nord Rekonstruktion AB';
  if v_row.invoice_number is null then
    raise exception 'FAIL  första fakturan fick inget nummer';
  end if;
  -- Numret ska ha årets form. En serie som byter form mitt i året är
  -- lika trasig som en som hoppar.
  if v_row.invoice_number !~ '^2026-\d{4}$' then
    raise exception 'FAIL  fel nummerform: %', v_row.invoice_number;
  end if;
  raise notice 'ok 2: numret har årets form';
end $$;

do $$
declare
  v_dubbletter int;
  v_serie int;
  v_rader int;
begin
  -- Inga dubbletter i hela tabellen. Unikhetsvillkoret säger samma sak,
  -- men det som prövas här är att körningen inte BEHÖVDE villkoret.
  select count(*) into v_dubbletter from (
    select invoice_number from public.customer_invoices
    group by invoice_number having count(*) > 1
  ) d;
  if v_dubbletter <> 0 then
    raise exception 'FAIL  % dubblerade fakturanummer', v_dubbletter;
  end if;

  -- Tre fakturor ur den här transaktionen: jobbets två och den samtidiga.
  select count(*) into v_rader from public.customer_invoices
  where description like 'Förmedlade förfrågningar%'
     or description = 'Utställd av drift mitt i körningen';
  if v_rader <> 3 then
    raise exception 'FAIL  % fakturor, förväntat 3', v_rader;
  end if;

  -- Och de tre numren ligger i en obruten stigande följd. Skatteverket
  -- kräver serien; hoppen är det man ska kunna förklara.
  select count(distinct substring(invoice_number from '^\d{4}-(\d+)$')::int)
  into v_serie
  from public.customer_invoices
  where description like 'Förmedlade förfrågningar%'
     or description = 'Utställd av drift mitt i körningen';
  if v_serie <> 3 then
    raise exception 'FAIL  bara % skilda löpnummer på 3 fakturor', v_serie;
  end if;
  raise notice 'ok 3: tre fakturor, tre skilda nummer, ingen dubblett';
end $$;

do $$
declare
  v_jobb1 int;
  v_jobb2 int;
  v_mellan int;
begin
  select substring(invoice_number from '^\d{4}-(\d+)$')::int into v_jobb1
  from korning where customer_name = 'Nord Rekonstruktion AB';
  select substring(invoice_number from '^\d{4}-(\d+)$')::int into v_jobb2
  from korning where customer_name = 'Syd Juridik AB';
  select substring(invoice_number from '^\d{4}-(\d+)$')::int into v_mellan
  from public.customer_invoices where description = 'Utställd av drift mitt i körningen';

  -- Det här är hela poängen: den samtidiga fakturan ligger MELLAN jobbets
  -- två. Jobbet läste alltså inte sin räknare i förväg - det hämtade
  -- numret när raden skrevs.
  if not (v_jobb1 < v_mellan and v_mellan < v_jobb2) then
    raise exception 'FAIL  ordningen blev %, % och % - jobbet räknade i förväg',
      v_jobb1, v_mellan, v_jobb2;
  end if;
  raise notice 'ok 4: det samtidiga utställandet fick numret mellan jobbets två';
end $$;

/* --- klientens väg in tar samma nummer ----------------------------------- */

do $$
declare
  v_nasta text;
  v_hogsta int;
begin
  select max(substring(invoice_number from '^\d{4}-(\d+)$')::int) into v_hogsta
  from public.customer_invoices where invoice_number like '2026-%';
  v_nasta := app.next_invoice_number('2026-08-01T05:00:00Z');
  if v_nasta <> '2026-' || lpad((v_hogsta + 1)::text, 4, '0') then
    raise exception 'FAIL  nästa nummer blev % med högsta %', v_nasta, v_hogsta;
  end if;
  raise notice 'ok 5: nästa nummer fortsätter serien jobbet lämnade';
end $$;

select 'ALL INVOICE NUMBERING TESTS PASSED' as result;

rollback;
