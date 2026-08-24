-- Aviseringstjänsten: händelser med identitet, leveranser per kanal.
--
-- Notiscentret i appen HÄRLEDER sitt innehåll ur nuläget. Det duger för
-- en klocka, men inte för ett utskick: ett SMS är oåterkalleligt, och en
-- härledning som körs var femte minut skickar samma besked var femte
-- minut. En avisering måste därför ha en IDENTITET, och identiteten är
-- det unika indexet på dedupe_key nedan.
--
-- Kanalerna ligger i en egen tabell med flit. SMS är den första betalda
-- kanalen; push tillkommer utan att någonting här skrivs om.
--
-- Reglerna för OM ett utskick ska gå bor i src/lib/notifications/events.ts,
-- inte här. Två uppsättningar villkor - en i SQL och en i TypeScript -
-- hinner glida isär, och då får den som frågar "varför fick jag inget
-- SMS" två olika svar. Databasen köar och kvitterar; arbetaren beslutar.

/* --- Nivån på abonnemanget ------------------------------------------------ */

-- Nivåerna fanns hittills bara i gränssnittet (src/lib/pricing.ts). Utan
-- en lagrad nivå går ingen kanal att grinda, och "SMS ingår i Business"
-- vore ett påstående utan täckning.
alter table public.account_billing
  add column plan_id text not null default 'standard';

alter table public.account_billing
  add constraint account_billing_plan_known
    check (plan_id in ('start', 'standard', 'business', 'enterprise'));

comment on column public.account_billing.plan_id is
  'Abonnemangsnivån. Styr vilka aviseringskanaler som är öppna - se src/lib/notifications/events.ts.';

/* --- Typerna -------------------------------------------------------------- */

create type public.notification_channel as enum ('inapp', 'email', 'sms', 'push');

create type public.notification_delivery_status as enum (
  'pending',    -- köad, väntar på arbetaren
  'sent',       -- levererad
  'failed',     -- gav upp efter upprepade försök
  'suppressed'  -- avsiktligt inte skickad; skälet står i suppressed_reason
);

/* --- Händelserna ---------------------------------------------------------- */

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  case_id uuid references public.cases (id) on delete cascade,

  kind text not null,
  severity text not null,

  title text not null,
  body text not null,
  href text not null,

  -- Identiteten. Byggd av VAD händelsen gäller, aldrig av när den
  -- upptäcktes - se dedupeKey() i src/lib/notifications/messages.ts.
  dedupe_key text not null,

  created_at timestamptz not null default now(),
  -- När användaren läste den i appen. Null = oläst.
  read_at timestamptz,

  constraint notification_events_severity_known
    check (severity in ('tidskritisk', 'atgard', 'information')),
  constraint notification_events_kind_known
    check (kind in (
      'frist-narmar-sig', 'atgard-kravs', 'analys-klar', 'dokument-granskat',
      'radgivare-kommenterat', 'arende-status', 'steg-framat'
    )),
  constraint notification_events_texts_present
    check (char_length(title) between 1 and 200 and char_length(body) between 1 and 2000)
);

-- Engångsgarantin, i ett index. Utan det här indexet är resten av filen
-- en förhoppning.
create unique index notification_events_dedupe on public.notification_events (dedupe_key);
create index notification_events_user_time on public.notification_events (user_id, created_at desc);

comment on table public.notification_events is
  'En avisering, en gång. dedupe_key gör om till en no-op vad som annars blivit ett andra SMS.';

alter table public.notification_events enable row level security;

create policy notification_events_own_read
  on public.notification_events for select to authenticated
  using (user_id = auth.uid() or public.is_platform_admin());

-- Ingen insert-policy: händelser skapas ENDAST genom enqueue_notification().
-- En klient som kunde skriva egna händelser kunde skicka SMS i någon
-- annans namn.

create policy notification_events_own_mark_read
  on public.notification_events for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

/* --- Leveranserna --------------------------------------------------------- */

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.notification_events (id) on delete cascade,
  channel public.notification_channel not null,

  status public.notification_delivery_status not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  suppressed_reason text,

  -- Tyst tid SKJUTER UPP, den slänger inte. Ett besked som kommer 07:00
  -- är fortfarande användbart; ett besked som aldrig kommer är det inte.
  deferred_until timestamptz,

  created_at timestamptz not null default now(),
  sent_at timestamptz,

  -- Samma kanal två gånger för samma händelse vore två SMS.
  constraint notification_deliveries_once unique (event_id, channel),
  constraint notification_deliveries_sent_has_time
    check ((status <> 'sent') or sent_at is not null),
  constraint notification_deliveries_suppressed_has_reason
    check ((status <> 'suppressed') or suppressed_reason is not null)
);

create index notification_deliveries_queue
  on public.notification_deliveries (status, deferred_until, created_at)
  where status = 'pending';

comment on table public.notification_deliveries is
  'Ett försök per kanal och händelse. suppressed_reason besvarar frågan "varför fick jag inget".';

alter table public.notification_deliveries enable row level security;

create policy notification_deliveries_own_read
  on public.notification_deliveries for select to authenticated
  using (
    exists (
      select 1 from public.notification_events e
      where e.id = event_id and (e.user_id = auth.uid() or public.is_platform_admin())
    )
  );

/* --- Användarens val ------------------------------------------------------ */

create table public.notification_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,

  -- Förvalet är "bara när något krävs av dig". Inte "alla": den som är
  -- mitt i en kris ska inte behöva stänga av oss för att stå ut med oss.
  level text not null default 'atgard',

  email_enabled boolean not null default true,
  sms_enabled boolean not null default false,

  quiet_start_hour smallint not null default 21,
  quiet_end_hour smallint not null default 7,

  updated_at timestamptz not null default now(),

  constraint notification_prefs_level_known check (level in ('alla', 'atgard', 'tidskritiska')),
  constraint notification_prefs_quiet_range
    check (quiet_start_hour between 0 and 23 and quiet_end_hour between 0 and 23)
);

comment on table public.notification_prefs is
  'Nivå, kanaler och tyst tid. Tidskritiska händelser bryter tyst tid med flit - se events.ts.';

alter table public.notification_prefs enable row level security;

create policy notification_prefs_own_all
  on public.notification_prefs for all to authenticated
  using (user_id = auth.uid() or public.is_platform_admin())
  with check (user_id = auth.uid());

/* --- Det verifierade numret ----------------------------------------------- */

-- user_profiles.phone finns redan, men är en KONTAKTUPPGIFT: fritext som
-- ingen prövat. Ett utskick får inte gå på den. Ett nummer som skrivits
-- fel skickar besked om en kris till en främling.
create table public.verified_phones (
  user_id uuid primary key references auth.users (id) on delete cascade,

  -- E.164, normaliserat av normalisePhone() innan det når hit.
  e164 text not null,

  -- Koden lagras som SHA-256, aldrig i klartext. Samma regel som för
  -- API-nycklar: den som läser tabellen ska inte kunna verifiera någon
  -- annans nummer.
  code_sha256 text,
  code_expires_at timestamptz,
  code_attempts integer not null default 0,

  verified_at timestamptz,
  created_at timestamptz not null default now(),

  constraint verified_phones_e164_shape check (e164 ~ '^\+467\d{8}$'),
  constraint verified_phones_code_shape
    check (code_sha256 is null or code_sha256 ~ '^[0-9a-f]{64}$'),
  -- Ett verifierat nummer har ingen kod kvar att gissa på.
  constraint verified_phones_verified_has_no_code
    check (verified_at is null or code_sha256 is null)
);

comment on table public.verified_phones is
  'Numret som SMS faktiskt går till. Koden lagras som SHA-256, aldrig i klartext.';

alter table public.verified_phones enable row level security;

-- Läsning ja, skrivning nej: numret sätts genom funktionerna nedan, så
-- att verified_at aldrig kan sättas av den som ska bevisa något.
create policy verified_phones_own_read
  on public.verified_phones for select to authenticated
  using (user_id = auth.uid() or public.is_platform_admin());

/* --- Köandet -------------------------------------------------------------- */

/**
 * Köar en avisering. Idempotent på dedupe_key: samma händelse upptäckt
 * tio gånger blir en rad och ett utskick.
 *
 * Returnerar händelsens id, eller null när den redan fanns. Null är
 * INTE ett fel - det är hela poängen.
 *
 * Kanalvalet: klockan i appen skapas som levererad direkt, för den ÄR
 * levererad i samma stund raden finns; den kan varken väcka någon eller
 * tjata. E-post och SMS köas som pending och avgörs av arbetaren, som
 * äger regelverket.
 */
create or replace function public.enqueue_notification(
  p_user_id uuid,
  p_case_id uuid,
  p_kind text,
  p_severity text,
  p_title text,
  p_body text,
  p_href text,
  p_dedupe_key text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id uuid;
begin
  insert into public.notification_events
    (user_id, case_id, kind, severity, title, body, href, dedupe_key)
  values
    (p_user_id, p_case_id, p_kind, p_severity, p_title, p_body, p_href, p_dedupe_key)
  on conflict (dedupe_key) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return null;
  end if;

  insert into public.notification_deliveries (event_id, channel, status, sent_at)
  values (v_event_id, 'inapp', 'sent', now());

  insert into public.notification_deliveries (event_id, channel)
  values (v_event_id, 'email'), (v_event_id, 'sms');

  return v_event_id;
end;
$$;

comment on function public.enqueue_notification(uuid, uuid, text, text, text, text, text, text) is
  'Köar en avisering en gång. Null tillbaka = fanns redan, och det är avsikten.';

/**
 * Arbetarens hämtning.
 *
 * Tar med mottagarens val, nivå och nummer i samma svar: arbetaren ska
 * kunna fatta hela beslutet utan att fråga databasen sju gånger per rad,
 * och en läsning som spänner över flera anrop kan hinna se två olika
 * sanningar.
 *
 * Uppskjutna rader (tyst tid) hoppas över tills tiden är inne.
 */
create or replace function public.claim_notification_deliveries(p_limit integer default 50)
returns table (
  delivery_id uuid,
  channel public.notification_channel,
  user_id uuid,
  kind text,
  severity text,
  title text,
  body text,
  href text,
  case_id uuid,
  level text,
  email_enabled boolean,
  sms_enabled boolean,
  quiet_start_hour smallint,
  quiet_end_hour smallint,
  plan_id text,
  phone_e164 text,
  phone_verified boolean
)
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  with claimed as (
    update public.notification_deliveries d
    set attempts = attempts + 1
    where d.id in (
      select id
      from public.notification_deliveries
      where status = 'pending'
        and (deferred_until is null or deferred_until <= now())
        -- Ge upp efter fem försök. Ett nummer som studsar studsar även
        -- försök sextio, och varje försök kostar pengar.
        and attempts < 5
      order by created_at
      limit p_limit
      for update skip locked
    )
    returning d.id, d.channel, d.event_id
  )
  select
    c.id,
    c.channel,
    e.user_id,
    e.kind,
    e.severity,
    e.title,
    e.body,
    e.href,
    e.case_id,
    coalesce(p.level, 'atgard'),
    coalesce(p.email_enabled, true),
    coalesce(p.sms_enabled, false),
    coalesce(p.quiet_start_hour, 21::smallint),
    coalesce(p.quiet_end_hour, 7::smallint),
    coalesce(b.plan_id, 'standard'),
    v.e164,
    (v.verified_at is not null)
  from claimed c
  join public.notification_events e on e.id = c.event_id
  left join public.notification_prefs p on p.user_id = e.user_id
  left join public.account_billing b on b.user_id = e.user_id
  left join public.verified_phones v on v.user_id = e.user_id;
$$;

comment on function public.claim_notification_deliveries(integer) is
  'Arbetarens hämtning med hela beslutsunderlaget. skip locked hindrar dubbla utskick.';

create or replace function public.mark_notification_sent(p_id uuid)
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  update public.notification_deliveries
  set status = 'sent', sent_at = now(), last_error = null
  where id = p_id;
$$;

/**
 * Avsiktligt uteblivet utskick. Skälet sparas: frågan "varför fick jag
 * inget SMS" ska gå att besvara utan att gissa.
 */
create or replace function public.mark_notification_suppressed(p_id uuid, p_reason text)
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  update public.notification_deliveries
  set status = 'suppressed', suppressed_reason = p_reason
  where id = p_id;
$$;

/** Tyst tid: raden ligger kvar som pending och tas upp när tiden är inne. */
create or replace function public.defer_notification(p_id uuid, p_until timestamptz)
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  update public.notification_deliveries
  set status = 'pending', deferred_until = p_until, attempts = greatest(attempts - 1, 0)
  where id = p_id;
$$;

comment on function public.defer_notification(uuid, timestamptz) is
  'Uppskjutet, inte slängt. Försöket räknas inte - annars bränner tyst tid taket.';

create or replace function public.mark_notification_failed(p_id uuid, p_error text)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_attempts integer;
begin
  select attempts into v_attempts from public.notification_deliveries where id = p_id;
  update public.notification_deliveries
  set status = case when v_attempts >= 5 then 'failed'::public.notification_delivery_status
                    else 'pending'::public.notification_delivery_status end,
      last_error = p_error
  where id = p_id;
end;
$$;

/* --- Telefonverifieringen ------------------------------------------------- */

/**
 * Steg 1: numret sparas overifierat och en kod köas.
 *
 * Koden kommer INIFRÅN anroparen som färdig hash. Databasen ska aldrig
 * ha sett klartexten - hade den det kunde den läckas ur en logg, en
 * backup eller en felutskrift.
 *
 * Ett byte av nummer nollställer verifieringen. Annars hade man kunnat
 * verifiera sitt eget nummer och sedan byta till någon annans.
 */
create or replace function public.start_phone_verification(
  p_e164 text,
  p_code_sha256 text,
  p_ttl_minutes integer default 10
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Kräver inloggning';
  end if;

  insert into public.verified_phones (user_id, e164, code_sha256, code_expires_at, code_attempts)
  values (auth.uid(), p_e164, p_code_sha256, now() + make_interval(mins => p_ttl_minutes), 0)
  on conflict (user_id) do update
    set e164 = excluded.e164,
        code_sha256 = excluded.code_sha256,
        code_expires_at = excluded.code_expires_at,
        code_attempts = 0,
        verified_at = null;
end;
$$;

/**
 * Steg 2: koden prövas.
 *
 * Räknaren höjs FÖRE jämförelsen, så att ett avbrutet anrop inte ger ett
 * gratis försök. Fem fel bränner koden - den som gissar ska behöva börja
 * om och få ett nytt SMS, vilket både kostar och syns.
 */
create or replace function public.confirm_phone_verification(p_code_sha256 text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.verified_phones;
begin
  if auth.uid() is null then
    raise exception 'Kräver inloggning';
  end if;

  select * into v_row from public.verified_phones where user_id = auth.uid() for update;
  if v_row is null or v_row.code_sha256 is null then
    return false;
  end if;
  if v_row.code_expires_at < now() or v_row.code_attempts >= 5 then
    return false;
  end if;

  update public.verified_phones
  set code_attempts = code_attempts + 1
  where user_id = auth.uid();

  if v_row.code_sha256 <> p_code_sha256 then
    return false;
  end if;

  update public.verified_phones
  set verified_at = now(), code_sha256 = null, code_expires_at = null
  where user_id = auth.uid();

  return true;
end;
$$;

create or replace function public.remove_phone()
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  delete from public.verified_phones where user_id = auth.uid();
$$;

comment on function public.remove_phone() is
  'Användaren tar bort sitt nummer. Raderas helt - ett avstängt SMS ska inte lämna numret kvar.';

/* --- Kön för verifierings-SMS --------------------------------------------- */

-- Verifieringskoden är det ENDA utskick som går till ett overifierat
-- nummer, och därför det enda som inte kan hänga i notification_events:
-- det finns ingen händelse i ett ärende att hänga den på.
create table public.outbound_sms (
  id uuid primary key default gen_random_uuid(),
  recipient text not null,
  body text not null,
  kind text not null,

  status public.notification_delivery_status not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,

  constraint outbound_sms_recipient_shape check (recipient ~ '^\+467\d{8}$'),
  constraint outbound_sms_kind_known check (kind in ('verifiering')),
  constraint outbound_sms_body_length check (char_length(body) between 1 and 320),
  constraint outbound_sms_sent_has_time check ((status <> 'sent') or sent_at is not null)
);

comment on table public.outbound_sms is
  'Verifierings-SMS. Enda utskicket till ett overifierat nummer, därför utan ärendekoppling.';

alter table public.outbound_sms enable row level security;

-- Ingen policy alls: kön är driftens, och den nås bara av funktionerna
-- nedan och av arbetaren. En klient som kunde läsa den kunde läsa någon
-- annans verifieringskod på väg ut.

/**
 * Köar verifierings-SMS:et.
 *
 * Numret kommer INTE som argument. En funktion som skickar till valfritt
 * nummer på begäran är en SMS-bombare med inloggning: den som ville
 * kunde tömma vårt leverantörssaldo mot vilken telefon som helst.
 * Numret läses därför ur anroparens egen rad, som just satts av
 * start_phone_verification - och den raden kan bara vara anroparens.
 *
 * Ett redan verifierat nummer får ingen ny kod. Det finns ingenting kvar
 * att bevisa, och en kod utan syfte är bara en kostnad.
 */
create or replace function public.queue_verification_sms(p_body text)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_e164 text;
begin
  if auth.uid() is null then
    raise exception 'Kräver inloggning';
  end if;

  select e164 into v_e164
  from public.verified_phones
  where user_id = auth.uid() and verified_at is null and code_sha256 is not null;

  if v_e164 is null then
    raise exception 'Ingen påbörjad verifiering';
  end if;

  -- Ett tak per nummer och timme. Utan det kan samma nummer begäras om
  -- och om, och varje begäran kostar pengar.
  if (select count(*) from public.outbound_sms
      where recipient = v_e164 and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'För många koder begärda. Försök igen om en stund.';
  end if;

  insert into public.outbound_sms (recipient, body, kind)
  values (v_e164, p_body, 'verifiering');
end;
$$;

create or replace function public.claim_outbound_sms(p_limit integer default 20)
returns setof public.outbound_sms
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  update public.outbound_sms
  set attempts = attempts + 1
  where id in (
    select id from public.outbound_sms
    where status = 'pending' and attempts < 5
    order by created_at
    limit p_limit
    for update skip locked
  )
  returning *;
$$;

create or replace function public.mark_sms_sent(p_id uuid)
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  update public.outbound_sms
  set status = 'sent', sent_at = now(), last_error = null
  where id = p_id;
$$;

create or replace function public.mark_sms_failed(p_id uuid, p_error text)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_attempts integer;
begin
  select attempts into v_attempts from public.outbound_sms where id = p_id;
  update public.outbound_sms
  set status = case when v_attempts >= 5 then 'failed'::public.notification_delivery_status
                    else 'pending'::public.notification_delivery_status end,
      last_error = p_error
  where id = p_id;
end;
$$;

/* --- Leverantören --------------------------------------------------------- */

-- 46elks skickar SMS:en. Nyckeln bor i samma valv som de andra, bakom
-- samma funktioner - se db/migrations/20260802220000.
alter table public.integration_secrets
  drop constraint integration_secrets_provider_known;

alter table public.integration_secrets
  add constraint integration_secrets_provider_known
    check (provider in (
      'creditsafe', 'fortnox', 'visma', 'bolagsverket', 'bankid', 'ses', '46elks'
    ));

/* --- Vem som får anropa vad ----------------------------------------------- */

-- SECURITY DEFINER kringgår radskyddet. En sådan funktion som alla får
-- anropa ÄR ett hål, oavsett hur policyerna ser ut: enqueue_notification
-- hade låtit vem som helst skapa en avisering åt vem som helst - och
-- därmed skicka SMS i någons namn.
--
-- Postgres ger `execute` till public som förval. Det tas bort här, och
-- delas ut igen bara till den som faktiskt ska ha det.

-- Från PUBLIC räcker inte. Den självhostade bootstrappen delar dessutom
-- ut `execute` direkt till anon och authenticated via default privileges
-- (db/bootstrap.sql), och en grant till en roll tas inte bort av en
-- revoke från public. Rollerna räknas därför upp, var och en som finns.
do $$
declare
  v_funcs text := '
    public.enqueue_notification(uuid, uuid, text, text, text, text, text, text),
    public.claim_notification_deliveries(integer),
    public.mark_notification_sent(uuid),
    public.mark_notification_suppressed(uuid, text),
    public.defer_notification(uuid, timestamptz),
    public.mark_notification_failed(uuid, text),
    public.claim_outbound_sms(integer),
    public.mark_sms_sent(uuid),
    public.mark_sms_failed(uuid, text)';
  v_role text;
begin
  execute format('revoke execute on function %s from public', v_funcs);
  foreach v_role in array array['anon', 'authenticated', 'app_anon', 'app_user'] loop
    if exists (select 1 from pg_roles where rolname = v_role) then
      execute format('revoke execute on function %s from %I', v_funcs, v_role);
    end if;
  end loop;
end $$;

-- Klientens tre: de rör bara anroparens egen rad, och prövar auth.uid()
-- själva.
grant execute on function
  public.start_phone_verification(text, text, integer),
  public.confirm_phone_verification(text),
  public.remove_phone(),
  public.queue_verification_sms(text)
to authenticated;

comment on function public.enqueue_notification(uuid, uuid, text, text, text, text, text, text) is
  'Köar en avisering en gång. Null tillbaka = fanns redan, och det är avsikten. Endast ägaren och arbetaren får anropa den.';
