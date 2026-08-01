-- Utgående e-post och det jobb som stänger förfallna konton.
--
-- Två saker som måste hända utan att någon sitter och trycker på en knapp:
-- fakturan ska ut till kundens e-post, och kontot ska stängas när
-- betalningsfristen gått ut.
--
-- E-POSTEN LIGGER I EN UTKORG, INTE I ETT DIREKTANROP.
--
-- Frestelsen är att låta applikationen ringa SES direkt när fakturan skapas.
-- Det ger två fel som båda är svåra att upptäcka:
--
--   1. Skickas mejlet inuti transaktionen och transaktionen rullas tillbaka,
--      har kunden ett mejl om en faktura som inte finns.
--   2. Skickas det efter commit och anropet fallerar, finns fakturan men
--      inget mejl - och ingenting i systemet vet om det.
--
-- Utkorgen gör raden till en del av samma transaktion som fakturan. En
-- arbetare plockar den sedan, försöker skicka, och skriver tillbaka
-- resultatet. Misslyckas det ligger raden kvar och syns.

/* -------------------------------------------------------------------------- */
/* Utkorg                                                                     */
/* -------------------------------------------------------------------------- */

create type public.outbound_email_status as enum (
  'pending',
  'sent',
  'failed'      -- gav upp efter max antal försök; kräver en människa
);

create table public.outbound_emails (
  id uuid primary key default gen_random_uuid(),

  recipient text not null,
  subject text not null,
  -- Båda varianterna. Ren text är inte en artighet: en mottagare som blockerar
  -- HTML ska ändå kunna läsa vad fakturan avser och vad den ska betalas till.
  body_text text not null,
  body_html text not null,

  -- Vad mejlet gäller, så att en rad går att spåra till sitt underlag.
  related_invoice_id uuid references public.customer_invoices (id) on delete set null,
  kind text not null,

  status public.outbound_email_status not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,

  constraint outbound_emails_recipient_shape
    check (recipient ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint outbound_emails_sent_has_time
    check ((status <> 'sent') or sent_at is not null)
);

comment on table public.outbound_emails is
  'Utkorg. Raden skapas i samma transaktion som det den handlar om; en arbetare skickar via SES och skriver tillbaka resultatet.';

comment on column public.outbound_emails.attempts is
  'Räknas upp av arbetaren. Vid taket sätts status = failed, och då ska en människa titta - inte en till automatisk omgång.';

-- Arbetarens enda fråga: vad ska skickas härnäst?
create index outbound_emails_pending_idx
  on public.outbound_emails (created_at)
  where status = 'pending';

alter table public.outbound_emails enable row level security;

-- Ingen kund läser utkorgen. Den innehåller alla kunders adresser och
-- fakturauppgifter i klartext.
create policy outbound_emails_admin_read
  on public.outbound_emails for select to authenticated
  using (public.is_platform_admin());

create policy outbound_emails_admin_write
  on public.outbound_emails for insert to authenticated
  with check (public.is_platform_admin());

create policy outbound_emails_admin_update
  on public.outbound_emails for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant select, insert, update on public.outbound_emails to authenticated;

/* -------------------------------------------------------------------------- */
/* Arbetarens gränssnitt                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Hämtar och låser nästa omgång att skicka.
 *
 * `for update skip locked` gör att två arbetare kan köra samtidigt utan att
 * någon rad skickas två gånger. Utan det är dubbelutskick bara en fråga om
 * tajming, och en kund som får samma faktura två gånger ringer.
 *
 * Anropas av arbetaren, inte av klienten.
 */
create or replace function public.claim_outbound_emails(p_limit integer default 20)
returns setof public.outbound_emails
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  update public.outbound_emails
  set attempts = attempts + 1
  where id in (
    select id
    from public.outbound_emails
    where status = 'pending'
      -- Ge upp efter fem försök. En adress som studsar studsar även
      -- försök sextio.
      and attempts < 5
    order by created_at
    limit p_limit
    for update skip locked
  )
  returning *;
$$;

comment on function public.claim_outbound_emails(integer) is
  'Arbetarens hämtning. skip locked hindrar att två arbetare skickar samma rad.';

create or replace function public.mark_email_sent(p_id uuid)
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  update public.outbound_emails
  set status = 'sent', sent_at = now(), last_error = null
  where id = p_id;
$$;

/**
 * Misslyckat försök. Raden blir 'failed' först vid taket - dessförinnan
 * ligger den kvar som 'pending' och plockas igen.
 */
create or replace function public.mark_email_failed(p_id uuid, p_error text)
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  update public.outbound_emails
  set last_error = p_error,
      status = case when attempts >= 5 then 'failed'::public.outbound_email_status
                    else 'pending'::public.outbound_email_status end
  where id = p_id;
$$;

/* -------------------------------------------------------------------------- */
/* Stängning av förfallna konton                                              */
/* -------------------------------------------------------------------------- */

/**
 * Stänger konton vars betalningsfrist gått ut.
 *
 * Körs en gång per dygn. Tre egenskaper som alla är avsiktliga:
 *
 *   1. **Idempotent.** Kör den tio gånger samma dag och inget ändras efter
 *      första körningen - `closed_at is null` i villkoret.
 *   2. **Rör aldrig ett betalt konto.** `paid_at is null` står först, för
 *      att stänga ute en kund som har betalat är det värsta jobbet kan göra.
 *   3. **Ingen frist utan förfallodag.** Ett konto vars gratisvecka löpt ut
 *      men som aldrig fakturerats stängs också - annars vore gratisveckan
 *      obegränsad för den vi glömt fakturera.
 *
 * Raderar ingenting. Stängt betyder utestängd; materialet ligger kvar.
 * Returnerar antalet stängda konton så att en körning går att följa upp.
 */
create or replace function public.close_overdue_accounts(p_now timestamptz default now())
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_closed integer;
begin
  with closed as (
    update public.account_billing
    set closed_at = p_now
    where paid_at is null
      and closed_at is null
      -- Kalenderdagen, inte tidsstämpeln. Första versionen adderade ett dygn
      -- till förfallotidpunkten, vilket lät fristen bero på klockslaget
      -- fakturan råkade ställas ut - en faktura utställd 09:00 stängdes
      -- 09:00 dagen efter förfallodagen i stället för vid midnatt. Testet
      -- billingJob.sql fångade det. Jämförelsen görs därför på datum:
      -- kontot stängs första dagen EFTER förfallodagen, oavsett klockslag.
      and (p_now at time zone 'Europe/Stockholm')::date
          > (coalesce(due_at, started_at + interval '7 days') at time zone 'Europe/Stockholm')::date
    returning user_id
  )
  select count(*) into v_closed from closed;

  return v_closed;
end;
$$;

comment on function public.close_overdue_accounts(timestamptz) is
  'Dygnsjobb. Idempotent, rör aldrig ett betalt konto, raderar ingenting. Se src/lib/billing.ts för samma regler i klienten.';

/**
 * Konton som snart stängs, så att påminnelsen kan skickas.
 *
 * Samma tre dagars varsel som gränssnittet visar. Att låta jobbet och
 * gränssnittet räkna olika vore ett sätt att göra avstängningen till en
 * överraskning trots att varningen fanns.
 */
create or replace function public.accounts_due_soon(
  p_now timestamptz default now(),
  p_days integer default 3
)
returns table (user_id uuid, due_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select b.user_id,
         coalesce(b.due_at, b.started_at + interval '7 days') as due_at
  from public.account_billing b
  where b.paid_at is null
    and b.closed_at is null
    and coalesce(b.due_at, b.started_at + interval '7 days')
        between p_now and p_now + make_interval(days => p_days);
$$;
