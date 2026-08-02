-- Tester för samlingsfaktureringen av användningsavgifter.
--
-- Körs som tabellägare (funktionen är arbetarens, inte klientens) i en
-- transaktion som rullas tillbaka. Klockan är fryst: "körningen sker
-- 2026-08-01" så att föregående månad är juli.

begin;

insert into auth.users (id, email, password_hash) values
  ('b1111111-1111-1111-1111-111111111111', 'byra1@advokat.se', 'x'),
  ('b2222222-2222-2222-2222-222222222222', 'byra2@revision.se', 'x');

insert into public.professionals (id, name, company, category, user_id, billing_email) values
  ('e1111111-0000-0000-0000-000000000001', 'Advokat Ek', 'Ek Advokatbyrå AB', 'rekonstruktor',
   'b1111111-1111-1111-1111-111111111111', 'ekonomi@ekadvokat.se'),
  ('e2222222-0000-0000-0000-000000000002', 'Alm Revision', 'Alm Revision AB', 'revisor',
   'b2222222-2222-2222-2222-222222222222', null);

-- Ek: per-ärende-plan. Alm: abonnemang med månadsavgift.
insert into public.billing_plans (professional_id, plan_kind, unlock_fee_sek, monthly_fee_sek) values
  ('e1111111-0000-0000-0000-000000000001', 'per_case', 995, null),
  ('e2222222-0000-0000-0000-000000000002', 'subscription', null, 4900);

-- Juli hos Ek: två upplåsningar. Augusti: en (ska INTE med).
insert into public.usage_charges
  (professional_id, user_id, service_code, service_label, case_type, company_name, org_number, amount_ore, created_at)
values
  ('e1111111-0000-0000-0000-000000000001', 'b1111111-1111-1111-1111-111111111111',
   'case_unlock', 'Ärende upplåst', 'reconstruction', 'Exempel AB', '556123-4567', 99500, '2026-07-05T10:00:00+02'),
  ('e1111111-0000-0000-0000-000000000001', 'b1111111-1111-1111-1111-111111111111',
   'case_unlock', 'Ärende upplåst', 'bankruptcy', 'Demo AB', '559987-6543', 99500, '2026-07-18T14:30:00+02'),
  ('e1111111-0000-0000-0000-000000000001', 'b1111111-1111-1111-1111-111111111111',
   'case_unlock', 'Ärende upplåst', 'reconstruction', 'Augusti AB', '556999-0001', 99500, '2026-08-01T08:00:00+02');

/* --- körningen ----------------------------------------------------------- */

create temp table run1 as
select * from public.issue_usage_invoices('2026-08-01T05:00:00Z');

do $$
declare
  v_row record;
  v_count int;
  v_charge record;
begin
  -- Ek: 2 upplåsningar à 995 kr = 199000 öre netto, moms 49750.
  select * into v_row from run1 where customer_name = 'Ek Advokatbyrå AB';
  if v_row.skipped_reason is not null then
    raise exception 'FAIL  Ek hoppades över: %', v_row.skipped_reason;
  end if;
  if v_row.charge_count <> 2 then
    raise exception 'FAIL  Ek fakturerades % poster, förväntat 2', v_row.charge_count;
  end if;
  if v_row.net_ore <> 199000 or v_row.vat_ore <> 49750 or v_row.gross_ore <> 248750 then
    raise exception 'FAIL  Eks belopp: netto % moms % brutto %', v_row.net_ore, v_row.vat_ore, v_row.gross_ore;
  end if;
  if v_row.recipient <> 'ekonomi@ekadvokat.se' then
    raise exception 'FAIL  fel mottagare: %', v_row.recipient;
  end if;
  raise notice 'ok 1: två juliupplåsningar ger EN samlingsfaktura med rätt belopp';

  -- Alm: abonnemangsraden skapades av körningen och fakturerades direkt.
  select * into v_row from run1 where customer_name = 'Alm Revision AB';
  if v_row.skipped_reason is not null or v_row.recipient <> 'byra2@revision.se' then
    raise exception 'FAIL  Alm: skäl %, mottagare %', v_row.skipped_reason, v_row.recipient;
  end if;
  if v_row.charge_count <> 1 or v_row.net_ore <> 490000 then
    raise exception 'FAIL  Alms abonnemang: % poster, % öre', v_row.charge_count, v_row.net_ore;
  end if;
  raise notice 'ok 2: abonnemangsavgiften blir en rad i samlingsfakturan';

  -- Specifikationen: raderna pekar på sin faktura och bär sammanhanget.
  select * into v_charge from public.usage_charges
  where company_name = 'Exempel AB';
  if v_charge.invoice_id is null then
    raise exception 'FAIL  raden saknar fakturakoppling';
  end if;
  if v_charge.org_number <> '556123-4567' or v_charge.service_label <> 'Ärende upplåst' then
    raise exception 'FAIL  radens sammanhang: % %', v_charge.org_number, v_charge.service_label;
  end if;
  raise notice 'ok 3: varje rad spårar till faktura, bolag och tjänst';

  -- Augustiupplåsningen väntar.
  select count(*) into v_count from public.usage_charges
  where invoice_id is null and service_code = 'case_unlock';
  if v_count <> 1 then
    raise exception 'FAIL  % ofakturerade upplåsningar, förväntat 1', v_count;
  end if;
  raise notice 'ok 4: innevarande månads poster väntar till nästa körning';
end $$;

-- Idempotens: andra körningen ger inga nya fakturor och ingen ny
-- abonnemangsrad för samma period.
create temp table run2 as
select * from public.issue_usage_invoices('2026-08-01T06:00:00Z');

do $$
declare v_count int;
begin
  select count(*) into v_count from run2 where invoice_id is not null;
  if v_count <> 0 then
    raise exception 'FAIL  andra körningen ställde ut % fakturor', v_count;
  end if;
  select count(*) into v_count from public.usage_charges
  where service_code = 'subscription' and period_start = '2026-07-01';
  if v_count <> 1 then
    raise exception 'FAIL  % abonnemangsrader för juli', v_count;
  end if;
  select count(*) into v_count from public.customer_invoices
  where description like 'Användningsavgifter%';
  if v_count <> 2 then
    raise exception 'FAIL  % samlingsfakturor efter två körningar', v_count;
  end if;
  raise notice 'ok 5: körningen är idempotent - en post faktureras en gång';
end $$;

select 'ALL USAGE INVOICING TESTS PASSED' as result;

rollback;
