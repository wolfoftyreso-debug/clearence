/**
 * RADERING, RÄTTELSE OCH SKARP GALLRING.
 *
 * Registerutdraget (art. 15 och 20) fanns. Radering (art. 17) fanns som en
 * länk till ett kontaktformulär, och gallringen (art. 5.1 e) fanns som en
 * policy i skuggläge utan en enda funktion som kunde utföra den. Bägge var
 * alltså PÅSTÅENDEN. Det här är utförandet.
 *
 * TRE BESLUT SOM STYR HELA FILEN.
 *
 *  1. KONTORADEN RADERAS ALDRIG. auth.users bär `disabled_at` just för
 *     det: en rad som försvinner tar med sig ärendet den skapade
 *     (cases.user_id har on delete cascade), och därmed rekonstruktörens
 *     underlag mitt i ett pågående ärende. Identifikatorerna - e-post och
 *     lösenord - byts mot en död platshållare i stället. Det som blir kvar
 *     är ett konto-id utan person.
 *
 *  2. ETT ÄRENDE INGEN KAN NÅ SKA INTE FINNAS. Var den raderade ensam kvar
 *     i ärendet raderas hela ärendet - analys, plan, dokument, samtal. Ett
 *     ärende utan behöriga är inte "bevarad information", det är kvarglömda
 *     personuppgifter. Finns det någon kvar behålls ärendet och behörigheten
 *     återkallas i stället.
 *
 *  3. UNDANTAGEN STÅR UTSKRIVNA MED GRUND. Fakturor (bokföringslagen 7 kap.
 *     2 §), händelseloggen och underskrifter (art. 17.3 e) behålls. Löftet
 *     står i src/lib/erasure.ts, och tests/dataskydd.ts kräver att den här
 *     filen rör exakt de tabeller löftet nämner - varken fler eller färre.
 *     Ett löfte som inte går att jämföra med koden är en broschyr.
 *
 * KARENSTIDEN är sju dagar och finns för ångerrätten, inte för vår skull:
 * den som sitter i en kris och trycker fel ska hinna ta tillbaka det.
 */

/* -------------------------------------------------------------------------- */
/* Begäran                                                                    */
/* -------------------------------------------------------------------------- */

create table public.erasure_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  requested_at timestamptz not null default now(),
  /** Först då får den verkställas. Karenstiden, satt av databasen. */
  effective_at timestamptz not null,

  status text not null default 'begard'
    check (status in ('begard', 'genomford', 'aterkallad')),

  executed_at timestamptz,
  cancelled_at timestamptz,

  /** Vad som faktiskt gjordes: antal rader per kategori. Fylls vid utförandet. */
  result jsonb,

  constraint erasure_requests_done_has_time
    check ((status <> 'genomford') or executed_at is not null),
  constraint erasure_requests_cancelled_has_time
    check ((status <> 'aterkallad') or cancelled_at is not null)
);

/*
 * EN ÖPPEN BEGÄRAN PER KONTO. Två samtidiga hade gjort återkallelsen
 * tvetydig: vilken av dem tog användaren tillbaka?
 */
create unique index erasure_requests_one_open
  on public.erasure_requests (user_id)
  where status = 'begard';

create index erasure_requests_due_idx
  on public.erasure_requests (effective_at)
  where status = 'begard';

comment on table public.erasure_requests is
  'Begäran om radering enligt GDPR art. 17. Verkställs av arbetaren efter karenstiden; kan återkallas fram till dess.';

alter table public.erasure_requests enable row level security;

/*
 * Den registrerade ser SIN begäran och ingen annans. Skrivvägarna går via
 * funktionerna nedan - ingen insert- eller update-policy, för då hade en
 * klient kunnat sätta effective_at till nu och hoppa över karenstiden, eller
 * stämpla en begäran som genomförd utan att något raderats.
 */
create policy erasure_requests_select_own on public.erasure_requests
  for select using (user_id = auth.uid());

grant select on public.erasure_requests to authenticated;

/* -------------------------------------------------------------------------- */
/* Begära och återkalla                                                       */
/* -------------------------------------------------------------------------- */

create or replace function public.request_account_erasure()
returns public.erasure_requests
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_rad public.erasure_requests;
begin
  if v_user is null then
    raise exception 'Ingen inloggad användare.' using errcode = '42501';
  end if;

  -- En andra begäran ska inte bli ett fel i gränssnittet: den befintliga
  -- returneras oförändrad, med sin ursprungliga karenstid. Att förlänga
  -- karenstiden vid varje klick hade gjort raderingen omöjlig att nå.
  select * into v_rad
  from public.erasure_requests
  where user_id = v_user and status = 'begard';

  if found then
    return v_rad;
  end if;

  insert into public.erasure_requests (user_id, effective_at)
  values (v_user, now() + interval '7 days')
  returning * into v_rad;

  insert into public.audit_events (
    case_id, actor_user_id, actor_role, action, object_type, object_id, before, after
  )
  values (
    null, v_user, null, 'gdpr.radering.begard', 'erasure_requests', v_rad.id::text,
    null, jsonb_build_object('effective_at', v_rad.effective_at)
  );

  return v_rad;
end;
$$;

comment on function public.request_account_erasure() is
  'Begär radering av det egna kontot. Verkställs tidigast efter karenstiden och kan återkallas fram till dess.';

create or replace function public.cancel_account_erasure()
returns public.erasure_requests
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_rad public.erasure_requests;
begin
  if v_user is null then
    raise exception 'Ingen inloggad användare.' using errcode = '42501';
  end if;

  update public.erasure_requests
  set status = 'aterkallad', cancelled_at = now()
  where user_id = v_user and status = 'begard'
  returning * into v_rad;

  if not found then
    raise exception 'Det finns ingen begäran att återkalla.' using errcode = 'P0002';
  end if;

  insert into public.audit_events (
    case_id, actor_user_id, actor_role, action, object_type, object_id, before, after
  )
  values (
    null, v_user, null, 'gdpr.radering.aterkallad', 'erasure_requests', v_rad.id::text,
    jsonb_build_object('status', 'begard'), jsonb_build_object('status', 'aterkallad')
  );

  return v_rad;
end;
$$;

comment on function public.cancel_account_erasure() is
  'Återkallar en begäran om radering. Går bara så länge den inte verkställts.';

revoke all on function public.request_account_erasure() from public, anon;
revoke all on function public.cancel_account_erasure() from public, anon;
grant execute on function public.request_account_erasure() to authenticated;
grant execute on function public.cancel_account_erasure() to authenticated;

/* -------------------------------------------------------------------------- */
/* Utförandet                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * MASKEN PÅ VÄG IN I LOGGEN - INTE EN SUDDGUMMI EFTERÅT.
 *
 * KONFLIKTEN, OCH VARFÖR DEN LÖSTES SÅ HÄR. Revisionstriggern lägger en
 * ögonblicksbild av hela den ändrade raden i before/after. En inbjudan bär
 * en e-postadress, en profil ett namn - och de följde med in i loggen.
 * Värre: en radering LOGGAR sin egen före-bild, så själva utförandet av
 * art. 17 skrev tillbaka adressen den nyss tagit bort.
 *
 * Den uppenbara lösningen - att städa loggen efteråt - går inte, och ska
 * inte gå: audit_events är append-only, med en trigger som vägrar UPDATE
 * för varje roll inklusive ägaren, just för att "en granskningslogg som
 * går att redigera är ingen granskningslogg". Att öppna ett GDPR-format
 * hål i den garantin hade gjort den villkorad, och en villkorad garanti
 * är ingen garanti.
 *
 * Alltså maskeras identifikatorerna INNAN de skrivs. Loggen behåller vad
 * som hände, när och av vem (konto-id), men inte en andra kopia av namnet
 * eller adressen - den kopian fanns i tabellen ändå, och där går den att
 * radera.
 *
 * VAD SOM INTE MASKERAS: bolagsnamn och organisationsnummer. De avser en
 * juridisk person, de behövs för att läsa spåret, och de skyddas inte av
 * dataskyddsförordningen.
 *
 * RADER SKRIVNA FÖRE DEN HÄR MIGRATIONEN skrivs inte om - loggen är
 * append-only, och det gäller även oss. I en miljö som redan har sådana
 * rader är det en kvarvarande brist och ska hanteras som en, inte döljas.
 */
create or replace function app.maska_personuppgifter(p_rad jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_nyckel text;
begin
  if p_rad is null then
    return null;
  end if;

  foreach v_nyckel in array array[
    'email', 'phone', 'e164', 'display_name', 'name',
    'signer_name', 'signer_email', 'recipient', 'contact'
  ] loop
    -- Bara fält som FINNS och har ett värde maskeras. Ett null ska förbli
    -- null: skillnaden mellan "fanns ingen adress" och "adressen är dold"
    -- är läsbar information om vad som faktiskt ändrades.
    if p_rad ? v_nyckel and jsonb_typeof(p_rad -> v_nyckel) <> 'null' then
      p_rad := jsonb_set(p_rad, array[v_nyckel], '"[personuppgift]"'::jsonb);
    end if;
  end loop;

  return p_rad;
end;
$$;

comment on function app.maska_personuppgifter(jsonb) is
  'Maskerar kända identifikatorfält i en radbild innan den skrivs till händelseloggen. Loggen är append-only och kan inte städas i efterhand.';

/**
 * Revisionstriggern, med masken inkopplad.
 *
 * Identisk med originalet i 20260801100000 så när som på de två raderna
 * som maskerar. Den skrivs om i sin helhet och inte med en patch, eftersom
 * en trigger som bara delvis är läsbar på ett ställe är en trigger ingen
 * granskar.
 */
create or replace function public.record_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_case_id uuid;
  v_role public.case_role;
  v_before jsonb;
  v_after jsonb;
begin
  if tg_op = 'DELETE' then
    v_before := to_jsonb(old);
    v_after := null;
  elsif tg_op = 'INSERT' then
    v_before := null;
    v_after := to_jsonb(new);
  else
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
  end if;

  -- Ärende-id plockas ur den OMASKERADE bilden. Maskeringen rör bara
  -- identifikatorfält, men ordningen ska inte behöva bevisas på nytt varje
  -- gång någon lägger till ett fält i listan.
  v_case_id := coalesce(
    (v_after ->> 'case_id')::uuid,
    (v_before ->> 'case_id')::uuid,
    (v_after ->> 'id')::uuid,
    (v_before ->> 'id')::uuid
  );

  select m.role into v_role
  from public.case_members m
  where m.case_id = v_case_id
    and m.user_id = auth.uid()
    and m.revoked_at is null
  limit 1;

  insert into public.audit_events (
    case_id, actor_user_id, actor_role, action, object_type, object_id, before, after
  )
  values (
    v_case_id,
    auth.uid(),
    v_role,
    lower(tg_op),
    tg_table_name,
    coalesce(v_after ->> 'id', v_before ->> 'id'),
    app.maska_personuppgifter(v_before),
    app.maska_personuppgifter(v_after)
  );

  return coalesce(new, old);
end;
$$;

/**
 * app.erase_user: gör det manifestet lovar, i en transaktion.
 *
 * Returnerar antalet berörda rader per kategori. Siffrorna är inte pynt -
 * de skrivs in i begäran och i händelseloggen, och är det enda som kan
 * visa i efterhand att raderingen faktiskt rörde något.
 *
 * ORDNINGEN ÄR INTE GODTYCKLIG. Numret och adressen läses ut FÖRST, för de
 * behövs för att hitta utskicken, och är borta efteråt. Ensamma ärenden
 * raderas före behörigheterna återkallas, eftersom "fanns någon annan kvar"
 * annars hade besvarats mot en tabell vi just ändrat.
 */
create or replace function app.erase_user(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, app, pg_temp
as $$
declare
  v_epost text;
  v_nummer text;
  v_antal jsonb := '{}'::jsonb;
  n integer;
begin
  if p_user_id is null then
    raise exception 'Inget konto angivet.' using errcode = '22004';
  end if;

  select email into v_epost from auth.users where id = p_user_id;
  if v_epost is null then
    raise exception 'Kontot finns inte.' using errcode = 'P0002';
  end if;
  select e164 into v_nummer from public.verified_phones where user_id = p_user_id;

  /* --- Ärenden ingen annan har tillgång till ---------------------------- */

  -- Ensam kvar: hela ärendet går. Kaskaden tar dokument, samtal, beslut,
  -- betalningar, KBR och simuleringar med sig - det är avsikten.
  with ensamma as (
    select c.id
    from public.cases c
    where exists (
            select 1 from public.case_members m
            where m.case_id = c.id and m.user_id = p_user_id and m.revoked_at is null
          )
      and not exists (
            select 1 from public.case_members m
            where m.case_id = c.id and m.user_id <> p_user_id and m.revoked_at is null
          )
    union
    -- Ärenden utan en enda aktiv medlem, skapade av den raderade. De hade
    -- annars blivit kvar för alltid utan att någon kunde nå dem.
    select c.id
    from public.cases c
    where c.user_id = p_user_id
      and not exists (
            select 1 from public.case_members m
            where m.case_id = c.id and m.revoked_at is null
          )
  )
  delete from public.cases where id in (select id from ensamma);
  get diagnostics n = row_count;
  v_antal := v_antal || jsonb_build_object('arenden_raderade', n);

  -- Kvar: ärenden där någon annan är aktiv. Behörigheten återkallas, inte
  -- raden - vem som HADE åtkomst när ska fortsatt gå att svara på.
  update public.case_members
  set revoked_at = now()
  where user_id = p_user_id and revoked_at is null;
  get diagnostics n = row_count;
  v_antal := v_antal || jsonb_build_object('behorigheter_aterkallade', n);

  /* --- Aviseringar ------------------------------------------------------ */

  delete from public.notification_events where user_id = p_user_id;
  get diagnostics n = row_count;
  v_antal := v_antal || jsonb_build_object('notiser', n);

  delete from public.notification_prefs where user_id = p_user_id;

  if v_nummer is not null then
    delete from public.outbound_sms where recipient = v_nummer;
    get diagnostics n = row_count;
    v_antal := v_antal || jsonb_build_object('sms', n);
  end if;

  delete from public.verified_phones where user_id = p_user_id;

  /* --- Korrespondens ---------------------------------------------------- */

  update public.contact_messages
  set name = 'Raderad användare',
      email = 'raderad@borttaget.invalid',
      phone = null,
      company = null,
      message = 'Raderat på begäran av den registrerade (GDPR art. 17).',
      user_id = null
  where user_id = p_user_id;
  get diagnostics n = row_count;
  v_antal := v_antal || jsonb_build_object('kontaktmeddelanden', n);

  -- Obesvarade inbjudningar till adressen. En accepterad inbjudan är en
  -- händelse i ärendet och hör till loggen, inte hit.
  delete from public.case_invitations
  where lower(email) = lower(v_epost) and accepted_at is null;
  get diagnostics n = row_count;
  v_antal := v_antal || jsonb_build_object('inbjudningar', n);

  -- Mejl som hör till en faktura följer fakturan, resten går.
  delete from public.outbound_emails
  where lower(recipient) = lower(v_epost) and related_invoice_id is null;
  get diagnostics n = row_count;
  v_antal := v_antal || jsonb_build_object('mejl', n);

  /* --- Nycklar och rådgivarroll ----------------------------------------- */

  delete from public.api_keys where owner_user_id = p_user_id;
  get diagnostics n = row_count;
  v_antal := v_antal || jsonb_build_object('api_nycklar', n);

  delete from public.professional_members where user_id = p_user_id;
  delete from public.professional_invitations
  where lower(email) = lower(v_epost) and accepted_at is null;
  delete from public.profile_claims where user_id = p_user_id;

  /* --- Identiteten ------------------------------------------------------ */

  update public.user_profiles
  set display_name = null, phone = null, updated_at = now()
  where user_id = p_user_id;

  delete from auth.sessions where user_id = p_user_id;
  get diagnostics n = row_count;
  v_antal := v_antal || jsonb_build_object('sessioner', n);

  /*
   * Platshållaren är avsiktligt ogiltig på tre sätt: domänen .invalid kan
   * per RFC 2606 aldrig gå att nå, hashen har inget scrypt-prefix och kan
   * därför inte verifieras av server/auth.ts, och disabled_at stänger
   * kontot oavsett. Inloggning är inte "svår" efter det här - den är omöjlig.
   */
  update auth.users
  set email = 'raderad-' || p_user_id::text || '@borttaget.invalid',
      password_hash = 'raderad$ingen-inloggning-mojlig',
      disabled_at = coalesce(disabled_at, now()),
      updated_at = now()
  where id = p_user_id;

  /* --- Spåret ----------------------------------------------------------- */

  insert into public.audit_events (
    case_id, actor_user_id, actor_role, action, object_type, object_id, before, after
  )
  values (
    null, p_user_id, null, 'gdpr.radering.genomford', 'auth.users', p_user_id::text,
    null, v_antal
  );


  return v_antal;
end;
$$;

comment on function app.erase_user(uuid) is
  'Utför radering enligt GDPR art. 17 för ett konto. Kontoraden behålls som tom platshållare så att spårbarhet och delade ärenden överlever. Endast arbetaren.';

/**
 * Verkställer de begäranden vars karenstid gått ut.
 *
 * Låser med `for update skip locked` så att två samtidiga körningar av
 * arbetaren inte kan radera samma konto två gånger - den andra hoppar över
 * raden i stället för att vänta in en transaktion som redan gör jobbet.
 */
create or replace function app.execute_due_erasures(p_max integer default 25)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, app, pg_temp
as $$
declare
  v_rad record;
  v_resultat jsonb;
  v_utforda integer := 0;
  v_konton jsonb := '[]'::jsonb;
begin
  for v_rad in
    select * from public.erasure_requests
    where status = 'begard' and effective_at <= now()
    order by effective_at
    limit greatest(p_max, 0)
    for update skip locked
  loop
    v_resultat := app.erase_user(v_rad.user_id);
    update public.erasure_requests
    set status = 'genomford', executed_at = now(), result = v_resultat
    where id = v_rad.id;
    v_utforda := v_utforda + 1;
    v_konton := v_konton || jsonb_build_object('begaran', v_rad.id, 'antal', v_resultat);
  end loop;

  return jsonb_build_object('utforda', v_utforda, 'detaljer', v_konton);
end;
$$;

comment on function app.execute_due_erasures(integer) is
  'Verkställer raderingsbegäranden vars karenstid gått ut. Endast arbetaren.';

/*
 * BARA ARBETAREN. Att grant:a de här till authenticated hade gjort radering
 * av ANDRAS konton till ett API-anrop: erase_user tar ett användar-id som
 * argument och kör som ägare. Vägen in för en användare är
 * request_account_erasure(), som bara kan röra det egna kontot.
 */
revoke all on function app.erase_user(uuid) from public, anon, authenticated;
revoke all on function app.execute_due_erasures(integer) from public, anon, authenticated;

/* -------------------------------------------------------------------------- */
/* Skarp gallring                                                             */
/* -------------------------------------------------------------------------- */

/**
 * app.gallra: en kategori, ett brytdatum, en åtgärd.
 *
 * Kategorierna och tiderna bor i src/lib/retention.ts och i driftparametern
 * retention_policy - HÄR finns bara utförandet, en gren per kategori. Att
 * lägga tiderna här hade krävt en migration för att ändra dem.
 *
 * `p_torrkorning` är skuggläget: samma fråga körs, raderna räknas, ingenting
 * ändras. Arbetaren skickar true för varje kategori som inte är påslagen,
 * och det är därför skuggläget kan visa en siffra som faktiskt stämmer i
 * stället för en gissning.
 */
create or replace function app.gallra(
  p_kategori text,
  p_brytdatum timestamptz,
  p_torrkorning boolean default true
)
returns integer
language plpgsql
security definer
set search_path = public, auth, app, pg_temp
as $$
declare
  n integer := 0;
begin
  if p_brytdatum is null then
    -- Kategorier utan tidsgräns (händelseloggen) gallras aldrig på tid.
    return 0;
  end if;

  case p_kategori

    when 'hastighetsgrans' then
      if p_torrkorning then
        select count(*) into n from app.rate_limits where nollstalls <= p_brytdatum;
      else
        delete from app.rate_limits where nollstalls <= p_brytdatum;
        get diagnostics n = row_count;
      end if;

    when 'notiser_lasta' then
      if p_torrkorning then
        select count(*) into n from public.notification_events
        where read_at is not null and read_at <= p_brytdatum;
      else
        delete from public.notification_events
        where read_at is not null and read_at <= p_brytdatum;
        get diagnostics n = row_count;
      end if;

    when 'delningslankar_utgangna' then
      if p_torrkorning then
        select count(*) into n from public.case_share_links
        where expires_at <= p_brytdatum or revoked_at <= p_brytdatum;
      else
        delete from public.case_share_links
        where expires_at <= p_brytdatum or revoked_at <= p_brytdatum;
        get diagnostics n = row_count;
      end if;

    when 'samtalsjournal_avslutad' then
      -- Anonymisering, inte radering: sessionen och dess tidslinje står
      -- kvar, men fritexten som kan bära uppgifter om en person töms.
      if p_torrkorning then
        select count(*) into n from public.advisor_sessions
        where closed_at is not null and closed_at <= p_brytdatum
          and entries <> '[]'::jsonb;
      else
        update public.advisor_sessions
        set entries = '[]'::jsonb
        where closed_at is not null and closed_at <= p_brytdatum
          and entries <> '[]'::jsonb;
        get diagnostics n = row_count;
      end if;

    when 'kontakt_avslutade_konton' then
      -- SMALARE ÄN RADERING PÅ BEGÄRAN, med avsikt. Här tas namn, adress
      -- och telefon bort på ett konto som varit stängt länge; ärenden och
      -- innehåll rörs inte. Den som VILL bli raderad går via
      -- request_account_erasure() och får hela manifestet utfört.
      if p_torrkorning then
        select count(*) into n
        from public.account_billing b
        join auth.users u on u.id = b.user_id
        where b.closed_at is not null and b.closed_at <= p_brytdatum
          and u.email not like '%@borttaget.invalid';
      else
        with mogna as (
          select b.user_id
          from public.account_billing b
          join auth.users u on u.id = b.user_id
          where b.closed_at is not null and b.closed_at <= p_brytdatum
            and u.email not like '%@borttaget.invalid'
        ), profiler as (
          update public.user_profiles
          set display_name = null, phone = null, updated_at = now()
          where user_id in (select user_id from mogna)
          returning 1
        ), nummer as (
          delete from public.verified_phones
          where user_id in (select user_id from mogna)
          returning 1
        ), konton as (
          update auth.users
          set email = 'raderad-' || id::text || '@borttaget.invalid',
              password_hash = 'raderad$ingen-inloggning-mojlig',
              disabled_at = coalesce(disabled_at, now()),
              updated_at = now()
          where id in (select user_id from mogna)
          returning 1
        )
        select count(*) into n from konton;
      end if;

    when 'handelselogg' then
      -- Behålls för spårbarhet. Grenen finns för att ett okänt id ska vara
      -- ett fel, och det här id:t är känt och avsiktligt utan verkan.
      n := 0;

    else
      raise exception 'Okänd gallringskategori: %', p_kategori using errcode = '22023';
  end case;

  return coalesce(n, 0);
end;
$$;

comment on function app.gallra(text, timestamptz, boolean) is
  'Utför gallring för en kategori. Torrkörning räknar utan att ändra något. Endast arbetaren.';

revoke all on function app.gallra(text, timestamptz, boolean) from public, anon, authenticated;
