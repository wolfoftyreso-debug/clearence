-- Stängningsjobbet berättar vilka som stängdes, och påminnelser kan köas
-- utan dubbletter.
--
-- Bakgrund: close_overdue_accounts() returnerade en siffra. Det räckte för
-- att stänga, men inte för att säga till - stängningsbeskedet gick aldrig ut,
-- och kunden upptäckte avstängningen genom att mötas av låset. Exakt den
-- överraskning texterna skrevs för att förhindra.
--
-- Mejlens innehåll komponeras i TypeScript (src/lib/email/messages.ts), inte
-- i SQL - en källa för formuleringarna, som testas som text. Databasens jobb
-- är att svara på VEM som ska ha VILKET besked, och att se till att samma
-- besked inte går två gånger.

/* -------------------------------------------------------------------------- */
/* Utkorgen får en mottagarkolumn                                             */
/* -------------------------------------------------------------------------- */

-- Påminnelser om gratisperiodens slut hör inte till någon faktura, så
-- dubblettskyddet kan inte hänga på related_invoice_id. Kolumnen gör varje
-- rad spårbar till sin mottagare oavsett ärendetyp.
alter table public.outbound_emails
  add column related_user_id uuid references auth.users (id) on delete set null;

create index outbound_emails_user_kind_idx
  on public.outbound_emails (related_user_id, kind, created_at desc);

/* -------------------------------------------------------------------------- */
/* Stängningen returnerar vilka                                               */
/* -------------------------------------------------------------------------- */

drop function public.close_overdue_accounts(timestamptz);

/**
 * Stänger förfallna konton och returnerar vilka det blev, med det som
 * behövs för att skriva stängningsbeskedet: adress, namn och den senaste
 * obetalda fakturans nummer.
 *
 * Samma tre garantier som tidigare: idempotent, rör aldrig ett betalt konto,
 * raderar ingenting. Jämför svenska kalenderdagar - fristen ska inte bero på
 * vilket klockslag fakturan råkade ställas ut.
 */
create or replace function public.close_overdue_accounts(p_now timestamptz default now())
returns table (user_id uuid, email text, display_name text, invoice_number text)
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  with closed as (
    update public.account_billing b
    set closed_at = p_now
    where b.paid_at is null
      and b.closed_at is null
      and (p_now at time zone 'Europe/Stockholm')::date
          > (coalesce(b.due_at, b.started_at + interval '7 days') at time zone 'Europe/Stockholm')::date
    returning b.user_id
  )
  select
    c.user_id,
    u.email,
    p.display_name,
    (
      select i.invoice_number
      from public.customer_invoices i
      where i.user_id = c.user_id and i.status = 'issued'
      order by i.issued_at desc
      limit 1
    )
  from closed c
  join auth.users u on u.id = c.user_id
  left join public.user_profiles p on p.user_id = c.user_id;
$$;

comment on function public.close_overdue_accounts(timestamptz) is
  'Dygnsjobb. Returnerar de stängda kontona så att arbetaren kan köa stängningsbeskedet - en stängning utan besked är den överraskning texterna finns för att förhindra.';

/* -------------------------------------------------------------------------- */
/* Påminnelsekandidater                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Vilka som ska påminnas just nu, med dubblettskydd inbyggt.
 *
 * Samma tre dagars varsel som gränssnittet visar (WARNING_DAYS i
 * src/lib/billing.ts). Låt inte de två glida isär: ett jobb som påminner
 * på andra dagar än bannern räknar ned gör avstängningen till en
 * överraskning trots att båda "fungerade".
 *
 * Dubblettskyddet: högst en påminnelse per mottagare och svensk kalenderdag,
 * kontrollerat mot utkorgen. Arbetaren kan därmed köras hur ofta som helst
 * utan att tjata.
 */
create or replace function public.reminder_candidates(p_now timestamptz default now())
returns table (
  user_id uuid,
  email text,
  display_name text,
  invoice_id uuid,
  invoice_number text,
  gross_ore bigint,
  due_at timestamptz,
  days_left integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    b.user_id,
    u.email,
    p.display_name,
    i.id,
    i.invoice_number,
    i.gross_ore,
    coalesce(b.due_at, b.started_at + interval '7 days') as due_at,
    ((coalesce(b.due_at, b.started_at + interval '7 days') at time zone 'Europe/Stockholm')::date
      - (p_now at time zone 'Europe/Stockholm')::date) as days_left
  from public.account_billing b
  join auth.users u on u.id = b.user_id
  left join public.user_profiles p on p.user_id = b.user_id
  left join lateral (
    select id, invoice_number, gross_ore
    from public.customer_invoices ci
    where ci.user_id = b.user_id and ci.status = 'issued'
    order by ci.issued_at desc
    limit 1
  ) i on true
  where b.paid_at is null
    and b.closed_at is null
    and (coalesce(b.due_at, b.started_at + interval '7 days') at time zone 'Europe/Stockholm')::date
        between (p_now at time zone 'Europe/Stockholm')::date
        and (p_now at time zone 'Europe/Stockholm')::date + 3
    and not exists (
      select 1
      from public.outbound_emails e
      where e.related_user_id = b.user_id
        and e.kind = 'payment_reminder'
        and (e.created_at at time zone 'Europe/Stockholm')::date
            = (p_now at time zone 'Europe/Stockholm')::date
    );
$$;

comment on function public.reminder_candidates(timestamptz) is
  'Vilka som ska påminnas, högst en gång per mottagare och dag. Varselfönstret är samma tre dagar som gränssnittet visar.';

-- Den gamla hjälpen ersätts av reminder_candidates, som bär dubblettskyddet.
drop function if exists public.accounts_due_soon(timestamptz, integer);
