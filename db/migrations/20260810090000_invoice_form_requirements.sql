/*
 * FAKTURAN UPPFYLLER FORMKRAVEN, OCH SERIEN KAN INTE KROCKA.
 *
 * Två fel som båda var osynliga tills någon granskar en faktura:
 *
 * 1. KÖPAREN OCH PERIODEN SAKNADES.
 *    17 kap. 24 § mervärdesskattelagen (2023:200) kräver bland annat
 *    båda parternas namn och adress (punkt 5) och datum då
 *    tillhandahållandet utförts eller slutförts när det skiljer sig från
 *    fakturadatumet (punkt 7). Tabellen hade varken köparens adress eller
 *    någon period. Fakturadokumentet kunde rendera adressen - men inget
 *    fyllde den, så varje faktura gick ut utan.
 *
 *    Uppgifterna AVBILDAS vid utställandet i stället för att slås upp vid
 *    utskrift. En faktura som skrivs ut om ett år ska visa vem som
 *    fakturerades då och vart den gick, inte var bolaget sitter idag.
 *    Samma regel som beloppen redan följer.
 *
 * 2. LÖPNUMRET RÄKNADES FRAM PÅ TRE STÄLLEN, UTAN LÅS.
 *    Klienten, förmedlingsjobbet och användningsjobbet gjorde var sin
 *    "max + 1" och skrev in. Skatteverket kräver en obruten stigande
 *    serie; unikhetsvillkoret hindrade dubbletter men två samtidiga
 *    utställanden gav ett ogenomskinligt fel, och i jobbens fall en
 *    avbruten körning mitt i en månadsfakturering.
 *
 *    app.next_invoice_number() tar ett transaktionslokalt rådgivande lås
 *    innan den räknar. Två samtidiga anrop köar i stället för att krocka,
 *    och låset släpps när transaktionen tar slut - även om den rullas
 *    tillbaka. MAX och inte COUNT, av samma skäl som förut: en makulerad
 *    faktura får aldrig leda till att ett nummer återanvänds.
 */

/* -------------------------------------------------------------------------- */
/* 1. Köparen och perioden                                                    */
/* -------------------------------------------------------------------------- */

alter table public.customer_invoices
  add column if not exists customer_name text,
  add column if not exists customer_org_number text,
  add column if not exists customer_address text,
  add column if not exists period_start date,
  add column if not exists period_end date;

comment on column public.customer_invoices.customer_name is
  'Köparens namn vid utställandet. Formkrav enligt 17 kap. 24 § 5 ML.';
comment on column public.customer_invoices.customer_address is
  'Köparens adress vid utställandet. Formkrav enligt 17 kap. 24 § 5 ML.';
comment on column public.customer_invoices.period_start is
  'Tillhandahållandets början. Formkrav enligt 17 kap. 24 § 7 ML när det skiljer sig från fakturadatum.';

-- En period som slutar före den börjar är en felskrivning, inte en period.
alter table public.customer_invoices
  drop constraint if exists customer_invoices_period_is_ordered;
alter table public.customer_invoices
  add constraint customer_invoices_period_is_ordered check (
    period_start is null or period_end is null or period_end >= period_start
  );

-- Perioden anges antingen helt eller inte alls. En halv period är en uppgift
-- som ser fullständig ut på fakturan men inte är det.
alter table public.customer_invoices
  drop constraint if exists customer_invoices_period_is_whole;
alter table public.customer_invoices
  add constraint customer_invoices_period_is_whole check (
    (period_start is null) = (period_end is null)
  );

/* -------------------------------------------------------------------------- */
/* 2. Löpnumret, serialiserat                                                 */
/* -------------------------------------------------------------------------- */

/*
 * Låsnyckeln. Ett godtyckligt men fast tal: alla som allokerar ett
 * fakturanummer måste ta SAMMA lås, annars serialiserar det ingenting.
 */
create or replace function app.next_invoice_number(p_now timestamptz default now())
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_year text := to_char((p_now at time zone 'Europe/Stockholm')::date, 'YYYY');
  v_seq int;
begin
  -- Transaktionslokalt: släpps vid commit ELLER rollback, aldrig kvarglömt.
  perform pg_advisory_xact_lock(hashtext('clearance.invoice_number'));

  select coalesce(max(substring(ci.invoice_number from '^\d{4}-(\d+)$')::int), 0)
  into v_seq
  from public.customer_invoices ci
  where ci.invoice_number like v_year || '-%';

  return v_year || '-' || lpad((v_seq + 1)::text, 4, '0');
end;
$$;

comment on function app.next_invoice_number(timestamptz) is
  'Nästa löpnummer i årets serie. Tar ett transaktionslokalt lås: två samtidiga utställanden köar i stället för att krocka.';

revoke all on function app.next_invoice_number(timestamptz) from public;

/*
 * Utställandet, i ett enda anrop.
 *
 * Klienten räknade förut fram numret själv och skickade in det. Det gav
 * dels kapplöpningen ovan, dels att en klient kunde ange vilket nummer som
 * helst. Numret sätts nu här, bakom låset, och klienten får det tillbaka.
 *
 * Behörigheten prövas i funktionen och inte i vyn: security definer kringgår
 * radsäkerheten, så kontrollen måste stå här.
 */
create or replace function app.issue_customer_invoice(
  p_user_id uuid,
  p_description text,
  p_net_ore bigint,
  p_vat_ore bigint,
  p_vat_rate numeric,
  p_due_at timestamptz,
  p_customer_name text,
  p_customer_org_number text,
  p_customer_address text,
  p_period_start date default null,
  p_period_end date default null
)
returns public.customer_invoices
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.customer_invoices;
begin
  if not public.is_platform_admin() then
    raise exception 'endast drift får ställa ut fakturor'
      using errcode = '42501';
  end if;

  -- Formkraven, prövade där de inte går att kringgå. Vyn prövar samma sak
  -- för att kunna säga det i tid; databasen prövar det för att det ska
  -- vara sant.
  if coalesce(btrim(p_customer_name), '') = '' then
    raise exception 'köparens namn saknas' using errcode = '23514';
  end if;
  if coalesce(btrim(p_customer_address), '') = '' then
    raise exception 'köparens adress saknas' using errcode = '23514';
  end if;

  insert into public.customer_invoices (
    user_id, invoice_number, due_at,
    net_ore, vat_ore, gross_ore, vat_rate, description,
    customer_name, customer_org_number, customer_address,
    period_start, period_end
  )
  values (
    p_user_id, app.next_invoice_number(), p_due_at,
    p_net_ore, p_vat_ore, p_net_ore + p_vat_ore, p_vat_rate, p_description,
    btrim(p_customer_name), nullif(btrim(coalesce(p_customer_org_number, '')), ''),
    btrim(p_customer_address),
    p_period_start, p_period_end
  )
  returning * into v_row;

  return v_row;
end;
$$;

comment on function app.issue_customer_invoice is
  'Ställer ut en kundfaktura. Numret sätts bakom låset, formkraven prövas här, behörigheten likaså.';

revoke all on function app.issue_customer_invoice from public;
grant execute on function app.issue_customer_invoice to authenticated;

/* -------------------------------------------------------------------------- */
/* 3. Månadsjobben tar samma lås                                              */
/* -------------------------------------------------------------------------- */

/*
 * app.invoice_referrals() och app.invoice_case_usage() räknar fram sitt
 * eget v_seq före loopen och trycker in numren. Att skriva om båda
 * funktionerna här hade dubblerat ett nittiotal rader vardera - två
 * kopior av samma logik är hur nästa ändring hamnar i bara den ena.
 *
 * I stället tar den här triggern LÅSET vid varje infogning i tabellen,
 * oavsett väg in. Effekten: så snart ett jobb infogar sin första faktura
 * håller det låset till commit, och en klient som vill allokera under
 * tiden köar. Omvänt kan ett jobb inte börja infoga mitt i en klients
 * utställande.
 *
 * Vad som ÅTERSTÅR: ett jobb som läser sitt max, står stilla en stund och
 * först därefter infogar kan fortfarande hinna bli omsprunget. Fönstret
 * är litet men inte noll, och unikhetsvillkoret är då det som fångar det
 * - som ett avbrutet jobb, inte som en dubblett. Rätt lösning är att
 * jobben anropar app.next_invoice_number() inne i sin loop, vilket kräver
 * att deras definitioner skrivs om. Det är inte gjort här.
 *
 * EFTERSKRIFT: det är gjort i 20260811090000_jobben_tar_samma_lopnummer.sql.
 * Båda jobben hämtar numret inne i loopen, fönstret ovan finns inte längre,
 * och triggern är kvar som sista skydd. Raderna ovan står oförändrade för
 * att migrationen redan är körd - den här efterskriften är för den som
 * läser filen, inte för databasen.
 */
create or replace function app.lock_invoice_series()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(hashtext('clearance.invoice_number'));
  return new;
end;
$$;

drop trigger if exists customer_invoices_serialize on public.customer_invoices;
create trigger customer_invoices_serialize
  before insert on public.customer_invoices
  for each row execute function app.lock_invoice_series();

comment on function app.lock_invoice_series() is
  'Tar seriens lås vid varje infogning, så att ingen väg in kan allokera ett nummer parallellt med en annan.';
