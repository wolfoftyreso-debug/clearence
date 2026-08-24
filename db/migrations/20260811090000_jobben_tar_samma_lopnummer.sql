/*
 * MÅNADSJOBBEN SLUTAR RÄKNA SITT EGET LÖPNUMMER.
 *
 * 20260810090000 införde app.next_invoice_number(): ett transaktionslokalt
 * rådgivande lås, och sedan MAX + 1. Klientens utställande gick över till
 * den. Jobben gjorde det inte, och migrationen skrev ut varför:
 *
 *     "Vad som ÅTERSTÅR: ett jobb som läser sitt max, står stilla en stund
 *      och först därefter infogar kan fortfarande hinna bli omsprunget.
 *      [...] Rätt lösning är att jobben anropar app.next_invoice_number()
 *      inne i sin loop, vilket kräver att deras definitioner skrivs om.
 *      Det är inte gjort här."
 *
 * Det görs här.
 *
 * VARFÖR DET INTE RÄCKTE MED TRIGGERN
 *
 * Triggern app.lock_invoice_series() tar låset vid varje infogning. Den
 * stänger fönstret mellan två JOBB, eftersom det första jobbet håller låset
 * från sin första infogning till commit. Den stänger INTE fönstret mellan
 * jobbets läsning och dess första infogning: körningen läser max = 41 vid
 * 03:00:00, klienten ställer ut 2026-0042 vid 03:00:01, och jobbet infogar
 * sin egen 2026-0042 vid 03:00:02. Unikhetsvillkoret fångar det, men som
 * ett avbrutet månadsjobb - mitt i en körning som redan hunnit fakturera
 * halva rådgivarlistan. Resten faktureras inte den månaden.
 *
 * Med anropet inne i loopen finns ingen läsning att bli omsprungen: numret
 * hämtas i samma ögonblick som raden skrivs, bakom samma lås som alla
 * andra tar.
 *
 * SIDOVINSTEN: v_seq försvinner ur båda funktionerna. Två kopior av
 * "räkna fram nästa nummer" är hur nästa ändring hamnar i bara den ena -
 * vilket är precis vad som hände förra gången.
 *
 * VAD SOM INTE ÄNDRAS: urvalet, beloppen, momsen, märkningen av
 * underlaget, skälen för överhoppade rådgivare, returens form. Bara
 * numrets ursprung. Sviterna referralInvoicing.sql och usageInvoicing.sql
 * gäller därför oförändrade, och en ny svit prövar det som tillkommit.
 */

/* -------------------------------------------------------------------------- */
/* 1. Förmedlingsfakturorna                                                   */
/* -------------------------------------------------------------------------- */

create or replace function public.issue_referral_invoices(p_now timestamptz default now())
returns table (
  invoice_id uuid,
  user_id uuid,
  recipient text,
  customer_name text,
  invoice_number text,
  issued_at timestamptz,
  due_at timestamptz,
  net_ore bigint,
  vat_ore bigint,
  gross_ore bigint,
  referral_count bigint,
  period_start date,
  skipped_reason text
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_period_start date := (date_trunc('month', (p_now at time zone 'Europe/Stockholm')::date) - interval '1 month')::date;
  v_period_end date := date_trunc('month', (p_now at time zone 'Europe/Stockholm')::date)::date;
  v_candidate record;
  v_invoice_id uuid;
  v_number text;
  v_net bigint;
  v_vat bigint;
  v_email text;
begin
  for v_candidate in
    select p.id as professional_id, p.user_id as advisor_user_id,
           coalesce(p.company, p.name) as advisor_name,
           p.billing_email,
           count(*) as n_billable,
           count(*) filter (where r.fee_amount is null) as n_missing_fee,
           sum(r.fee_amount) as total_fee_sek
    from public.referrals r
    join public.professionals p on p.id = r.professional_id
    where r.billable_at is not null
      and r.invoice_id is null
      and (r.billable_at at time zone 'Europe/Stockholm')::date >= v_period_start
      and (r.billable_at at time zone 'Europe/Stockholm')::date < v_period_end
    group by p.id, p.user_id, p.company, p.name, p.billing_email
    order by coalesce(p.company, p.name)
  loop
    v_email := coalesce(
      v_candidate.billing_email,
      (select u.email from auth.users u where u.id = v_candidate.advisor_user_id)
    );

    if v_candidate.advisor_user_id is null then
      return query select null::uuid, null::uuid, v_email, v_candidate.advisor_name,
        null::text, null::timestamptz, null::timestamptz, null::bigint, null::bigint,
        null::bigint, v_candidate.n_billable, v_period_start,
        'listan saknar kontokoppling'::text;
      continue;
    end if;
    if v_candidate.n_missing_fee > 0 then
      return query select null::uuid, v_candidate.advisor_user_id, v_email,
        v_candidate.advisor_name, null::text, null::timestamptz, null::timestamptz,
        null::bigint, null::bigint, null::bigint, v_candidate.n_billable,
        v_period_start, 'avtalad avgift saknas'::text;
      continue;
    end if;
    if v_email is null then
      return query select null::uuid, v_candidate.advisor_user_id, null::text,
        v_candidate.advisor_name, null::text, null::timestamptz, null::timestamptz,
        null::bigint, null::bigint, null::bigint, v_candidate.n_billable,
        v_period_start, 'faktureringsadress saknas'::text;
      continue;
    end if;

    -- Ören, momsen avrundad EN gång - samma regler som src/lib/invoice.ts.
    v_net := round(v_candidate.total_fee_sek * 100);
    v_vat := round(v_net * 0.25);

    -- Numret hämtas HÄR, i samma ögonblick som raden skrivs. Ingen läsning
    -- att bli omsprungen mellan, och samma lås som klientens utställande.
    v_number := app.next_invoice_number(p_now);

    insert into public.customer_invoices
      (user_id, invoice_number, due_at, net_ore, vat_ore, gross_ore, vat_rate, description)
    values (
      v_candidate.advisor_user_id, v_number,
      p_now + interval '10 days',
      v_net, v_vat, v_net + v_vat, 0.25,
      'Förmedlade förfrågningar ' || to_char(v_period_start, 'YYYY-MM') ||
        ' (' || v_candidate.n_billable || ' st)'
    )
    returning id into v_invoice_id;

    -- Märkningen i samma transaktion: en förmedling faktureras en gång.
    update public.referrals r
    set invoice_id = v_invoice_id
    where r.professional_id = v_candidate.professional_id
      and r.billable_at is not null
      and r.invoice_id is null
      and (r.billable_at at time zone 'Europe/Stockholm')::date >= v_period_start
      and (r.billable_at at time zone 'Europe/Stockholm')::date < v_period_end;

    return query select v_invoice_id, v_candidate.advisor_user_id, v_email,
      v_candidate.advisor_name, v_number, p_now, p_now + interval '10 days',
      v_net, v_vat, v_net + v_vat, v_candidate.n_billable, v_period_start, null::text;
  end loop;
end;
$$;

revoke execute on function public.issue_referral_invoices(timestamptz) from public, anon, authenticated;

comment on function public.issue_referral_invoices(timestamptz) is
  'Månadsjobb (db/worker --invoice-referrals). Idempotent: fakturerade förmedlingar märks i samma transaktion. Numret hämtas ur app.next_invoice_number() inne i loopen.';

/* -------------------------------------------------------------------------- */
/* 2. Användningsfakturorna (samlingsfakturan per byrå)                       */
/* -------------------------------------------------------------------------- */

/*
 * Den gällande definitionen är skuggversionen ur 20260809100000: skuggrader
 * skapas och visas men faktureras aldrig. Villkoret `not c.shadow` står
 * kvar oförändrat i både urvalet och märkningen - det är pilotens spår A
 * och inte något den här migrationen har med att göra.
 */
create or replace function public.issue_usage_invoices(p_now timestamptz default now())
returns table (
  invoice_id uuid,
  user_id uuid,
  recipient text,
  customer_name text,
  invoice_number text,
  issued_at timestamptz,
  due_at timestamptz,
  net_ore bigint,
  vat_ore bigint,
  gross_ore bigint,
  charge_count bigint,
  period_start date,
  skipped_reason text
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_period_start date := (date_trunc('month', (p_now at time zone 'Europe/Stockholm')::date) - interval '1 month')::date;
  v_period_end date := date_trunc('month', (p_now at time zone 'Europe/Stockholm')::date)::date;
  v_candidate record;
  v_invoice_id uuid;
  v_number text;
  v_net bigint;
  v_vat bigint;
  v_email text;
begin
  -- Abonnemangsraderna för perioden, en per byrå, idempotent via det unika
  -- indexet (professional_id, period_start). Skuggläget stämplas på raden.
  insert into public.usage_charges
    (professional_id, user_id, service_code, service_label, amount_ore, period_start, shadow)
  select b.professional_id, p.user_id, 'subscription',
         'Abonnemang ' || to_char(v_period_start, 'YYYY-MM'),
         round(b.monthly_fee_sek * 100), v_period_start, b.shadow
  from public.billing_plans b
  join public.professionals p on p.id = b.professional_id
  where b.plan_kind = 'subscription'
    and b.monthly_fee_sek is not null
    and b.monthly_fee_sek > 0
    and p.user_id is not null
  on conflict do nothing;

  for v_candidate in
    select c.user_id as advisor_user_id,
           coalesce(p.company, p.name) as advisor_name,
           p.billing_email,
           count(*) as n_charges,
           sum(c.amount_ore) as total_ore
    from public.usage_charges c
    join public.professionals p on p.id = c.professional_id
    where c.invoice_id is null
      and not c.shadow
      and (
        (c.period_start is not null and c.period_start = v_period_start)
        or (c.period_start is null
            and (c.created_at at time zone 'Europe/Stockholm')::date >= v_period_start
            and (c.created_at at time zone 'Europe/Stockholm')::date < v_period_end)
      )
    group by c.user_id, p.company, p.name, p.billing_email
    order by coalesce(p.company, p.name)
  loop
    v_email := coalesce(
      v_candidate.billing_email,
      (select u.email from auth.users u where u.id = v_candidate.advisor_user_id)
    );
    if v_email is null then
      return query select null::uuid, v_candidate.advisor_user_id, null::text,
        v_candidate.advisor_name, null::text, null::timestamptz, null::timestamptz,
        null::bigint, null::bigint, null::bigint, v_candidate.n_charges,
        v_period_start, 'faktureringsadress saknas'::text;
      continue;
    end if;

    v_net := v_candidate.total_ore;
    v_vat := round(v_net * 0.25);
    v_number := app.next_invoice_number(p_now);

    insert into public.customer_invoices
      (user_id, invoice_number, due_at, net_ore, vat_ore, gross_ore, vat_rate, description)
    values (
      v_candidate.advisor_user_id, v_number,
      p_now + interval '10 days',
      v_net, v_vat, v_net + v_vat, 0.25,
      'Användningsavgifter ' || to_char(v_period_start, 'YYYY-MM') ||
        ' (' || v_candidate.n_charges || ' poster)'
    )
    returning id into v_invoice_id;

    update public.usage_charges c
    set invoice_id = v_invoice_id
    where c.user_id = v_candidate.advisor_user_id
      and c.invoice_id is null
      and not c.shadow
      and (
        (c.period_start is not null and c.period_start = v_period_start)
        or (c.period_start is null
            and (c.created_at at time zone 'Europe/Stockholm')::date >= v_period_start
            and (c.created_at at time zone 'Europe/Stockholm')::date < v_period_end)
      );

    return query select v_invoice_id, v_candidate.advisor_user_id, v_email,
      v_candidate.advisor_name, v_number, p_now, p_now + interval '10 days',
      v_net, v_vat, v_net + v_vat, v_candidate.n_charges, v_period_start, null::text;
  end loop;
end;
$$;

revoke execute on function public.issue_usage_invoices(timestamptz) from public, anon, authenticated;

comment on function public.issue_usage_invoices(timestamptz) is
  'Månadsjobb (db/worker --invoice-usage). En samlingsfaktura per byrå; skuggrader faktureras aldrig. Numret hämtas ur app.next_invoice_number() inne i loopen.';

/* -------------------------------------------------------------------------- */
/* 3. Triggern står kvar, med en ärlig beskrivning                            */
/* -------------------------------------------------------------------------- */

/*
 * app.lock_invoice_series() behålls. Den behövs inte längre för jobben,
 * men den är billig och den gäller VARJE väg in i tabellen - även en
 * framtida infogning som någon skriver utan att läsa den här filen. Det
 * är hela poängen med ett skydd i databasen i stället för i anroparen.
 *
 * Kommentaren däremot pekade på ett kvarstående fönster som inte finns
 * längre, och en beskrivning som beskriver ett gammalt läge är sämre än
 * ingen alls.
 */
comment on function app.lock_invoice_series() is
  'Tar det gemensamma låset vid varje infogning i customer_invoices. Sista skyddet: samtliga kända vägar in hämtar numret ur app.next_invoice_number(), som tar samma lås.';
