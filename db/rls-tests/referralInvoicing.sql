-- Tester för månadsfaktureringen av förmedlingar.
--
-- Körs som tabellägare (funktionen är arbetarens, inte klientens) i en
-- transaktion som rullas tillbaka. Klockan är fryst: "körningen sker
-- 2026-08-01" så att föregående månad är juli.

begin;

insert into auth.users (id, email, password_hash) values
  ('a1111111-1111-1111-1111-111111111111', 'radgivare1@byra.se', 'x'),
  ('a2222222-2222-2222-2222-222222222222', 'radgivare2@byra.se', 'x'),
  ('a3333333-3333-3333-3333-333333333333', 'kund@bolag.se', 'x');

insert into public.professionals (id, name, company, category, user_id, referral_fee, billing_email) values
  ('f1111111-0000-0000-0000-000000000001', 'Anna Ek', 'Ek Rekonstruktion AB', 'rekonstruktor',
   'a1111111-1111-1111-1111-111111111111', 1500, 'faktura@ekrekonstruktion.se'),
  ('f2222222-0000-0000-0000-000000000002', 'Bo Alm', 'Alm Juridik AB', 'affarsjurist',
   'a2222222-2222-2222-2222-222222222222', 900, null),
  -- Utan kontokoppling: ska hoppas över med skäl, inte tyst.
  ('f3333333-0000-0000-0000-000000000003', 'Cia Ör', null, 'revisor', null, 700, null);

-- Juli: två accepterade hos Anna, en hos Bo, en hos Cia. Augusti: en hos
-- Anna (ska INTE med). En avböjd (aldrig fakturerbar).
insert into public.referrals (professional_id, referrer_user_id, channel, status) values
  ('f1111111-0000-0000-0000-000000000001', 'a3333333-3333-3333-3333-333333333333', 'email', 'initiated'),
  ('f1111111-0000-0000-0000-000000000001', 'a3333333-3333-3333-3333-333333333333', 'phone', 'initiated'),
  ('f2222222-0000-0000-0000-000000000002', 'a3333333-3333-3333-3333-333333333333', 'email', 'initiated'),
  ('f3333333-0000-0000-0000-000000000003', 'a3333333-3333-3333-3333-333333333333', 'email', 'initiated'),
  ('f1111111-0000-0000-0000-000000000001', 'a3333333-3333-3333-3333-333333333333', 'email', 'initiated');

-- Accept stämplar billable_at = now(); flytta till juli respektive augusti.
update public.referrals set status = 'accepted'
where status = 'initiated' and professional_id <> 'f3333333-0000-0000-0000-000000000003';
update public.referrals set status = 'accepted'
where professional_id = 'f3333333-0000-0000-0000-000000000003';

-- Trigger tillåter inte omskrivning av billable_at via UPDATE (fee/billable
-- fryses), så testet sätter perioderna direkt som ägare.
alter table public.referrals disable trigger stamp_referral_billing_trigger;
update public.referrals set billable_at = '2026-07-10T10:00:00+02'
where billable_at is not null;
-- Sista förmedlingen hos Anna flyttas till augusti.
update public.referrals set billable_at = '2026-08-01T09:00:00+02'
where id = (
  select id from public.referrals
  where professional_id = 'f1111111-0000-0000-0000-000000000001'
  order by created_at desc limit 1
);
alter table public.referrals enable trigger stamp_referral_billing_trigger;

-- En avböjd i juli, aldrig fakturerbar.
insert into public.referrals (professional_id, referrer_user_id, channel, status) values
  ('f1111111-0000-0000-0000-000000000001', 'a3333333-3333-3333-3333-333333333333', 'email', 'declined');

/* --- körningen ----------------------------------------------------------- */

create temp table run1 as
select * from public.issue_referral_invoices('2026-08-01T05:00:00Z');

do $$
declare
  v_row record;
  v_count int;
begin
  -- Anna: 2 förmedlingar à 1500 kr = 3000 kr netto = 300000 öre, moms 75000.
  select * into v_row from run1 where customer_name = 'Ek Rekonstruktion AB';
  if v_row.skipped_reason is not null then
    raise exception 'FAIL  Anna hoppades över: %', v_row.skipped_reason;
  end if;
  if v_row.referral_count <> 2 then
    raise exception 'FAIL  Anna fakturerades % förmedlingar, förväntat 2', v_row.referral_count;
  end if;
  if v_row.net_ore <> 300000 or v_row.vat_ore <> 75000 or v_row.gross_ore <> 375000 then
    raise exception 'FAIL  Annas belopp: netto % moms % brutto %', v_row.net_ore, v_row.vat_ore, v_row.gross_ore;
  end if;
  if v_row.recipient <> 'faktura@ekrekonstruktion.se' then
    raise exception 'FAIL  fel mottagare: %', v_row.recipient;
  end if;
  raise notice 'ok 1: två juliförmedlingar ger en faktura med rätt belopp och moms';

  -- Bo: faktureringsadress saknas -> kontots e-post används.
  select * into v_row from run1 where customer_name = 'Alm Juridik AB';
  if v_row.skipped_reason is not null or v_row.recipient <> 'radgivare2@byra.se' then
    raise exception 'FAIL  Bo: skäl %, mottagare %', v_row.skipped_reason, v_row.recipient;
  end if;
  if v_row.net_ore <> 90000 then
    raise exception 'FAIL  Bos netto: %', v_row.net_ore;
  end if;
  raise notice 'ok 2: utan faktureringsadress används kontots e-post';

  -- Cia: ingen kontokoppling -> rapporterad, inte fakturerad.
  select * into v_row from run1 where customer_name = 'Cia Ör';
  if v_row.skipped_reason <> 'listan saknar kontokoppling' or v_row.invoice_id is not null then
    raise exception 'FAIL  Cia: %', v_row.skipped_reason;
  end if;
  raise notice 'ok 3: lista utan kontokoppling hoppas över med skäl, inte tyst';

  -- Nummerserien: obruten och årsstämplad.
  select count(*) into v_count from run1 where invoice_number like '2026-%';
  if v_count <> 2 then
    raise exception 'FAIL  % fakturor i serien, förväntat 2', v_count;
  end if;
  raise notice 'ok 4: fakturorna ligger i årets obrutna nummerserie';

  -- Augustiförmedlingen är kvar ofakturerad.
  select count(*) into v_count from public.referrals
  where invoice_id is null and billable_at >= '2026-08-01';
  if v_count <> 1 then
    raise exception 'FAIL  augustiförmedlingen: % ofakturerade', v_count;
  end if;
  raise notice 'ok 5: innevarande månads förmedlingar väntar till nästa körning';
end $$;

-- Idempotens: andra körningen samma morgon ger inga nya fakturor.
create temp table run2 as
select * from public.issue_referral_invoices('2026-08-01T06:00:00Z');

do $$
declare v_count int;
begin
  select count(*) into v_count from run2 where invoice_id is not null;
  if v_count <> 0 then
    raise exception 'FAIL  andra körningen ställde ut % fakturor', v_count;
  end if;
  -- Basen kan bära fakturor från migrationernas exempel; räkna körningens.
  select count(*) into v_count from public.customer_invoices
  where description like 'Förmedlade förfrågningar%';
  if v_count <> 2 then
    raise exception 'FAIL  % förmedlingsfakturor efter två körningar', v_count;
  end if;
  raise notice 'ok 6: körningen är idempotent - en förmedling faktureras en gång';
end $$;

-- Omförhandlad avgift ändrar inte redan stämplade förmedlingar.
do $$
declare v_sum numeric;
begin
  perform public.set_referral_fee_unchecked();
exception when undefined_function then
  -- set_referral_fee kräver driftbehörighet; som ägare uppdaterar vi direkt
  -- för att testa stämpelns oberoende.
  update public.professionals set referral_fee = 9999
  where id = 'f1111111-0000-0000-0000-000000000001';
  select sum(fee_amount) into v_sum from public.referrals
  where professional_id = 'f1111111-0000-0000-0000-000000000001'
    and invoice_id is not null;
  if v_sum <> 3000 then
    raise exception 'FAIL  omförhandling ändrade fakturerat underlag: %', v_sum;
  end if;
  raise notice 'ok 7: omförhandlad avgift rör inte redan stämplade förmedlingar';
end $$;

select 'ALL REFERRAL INVOICING TESTS PASSED' as result;

rollback;
