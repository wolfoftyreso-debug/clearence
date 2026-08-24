/*
 * HASTIGHETSBEGRÄNSNINGEN FLYTTAR TILL DELAD LAGRING.
 *
 * Räknaren bodde i minnet, per container. server/rateLimit.ts skrev ut
 * begränsningen själv: "Kör tjänsten på tre uppgifter blir den effektiva
 * gränsen tre gånger den angivna." Tio inloggningsförsök per fem minuter
 * blev alltså trettio, och blir sextio den dagen tjänsten skalas till sex
 * uppgifter - utan att någon ändrat en siffra. En gräns som tyst ändras när
 * driften växer är ingen gräns.
 *
 * Databasen är redan den delade lagring som behövs, och mönstret finns
 * redan: "fem koder per timme och nummer" i aviseringarna räknas här.
 *
 * VARFÖR EN UPSERT OCH INTE LÄS-SEDAN-SKRIV
 *
 * Läs-räkna-skriv förlorar under exakt den last begränsningen finns för:
 * tio parallella försök läser alla samma värde och skriver alla samma
 * uppräkning. En enda INSERT ... ON CONFLICT DO UPDATE gör läsningen,
 * beslutet och skrivningen till en operation, och Postgres serialiserar
 * dem på radlåset. Det är hela mekanismen.
 *
 * FÖNSTRET ÄR FAST, INTE GLIDANDE. Första anropet öppnar ett fönster som
 * stängs efter fonster_sek sekunder; därefter börjar räkningen om. Ett
 * glidande fönster är rättvisare men kräver en rad per anrop i stället för
 * en rad per nyckel. Skillnaden i praktiken är att någon kan göra
 * 2 × taket över en fönstergräns. För tio inloggningsförsök på fem minuter
 * är tjugo på tio minuter fortfarande långt från en forcering.
 *
 * INGA PERSONUPPGIFTER. Nyckeln är "login:<ip>" eller "allman:<ip>". En
 * IP-adress är en personuppgift i sig, och därför städas raderna bort en
 * timme efter att fönstret stängts - de fyller ingen funktion efter det.
 */

create table if not exists app.rate_limits (
  nyckel text primary key,
  antal integer not null,
  /** När fönstret stängs och räkningen börjar om. */
  nollstalls timestamptz not null
);

comment on table app.rate_limits is
  'Delad räkning för API:ets hastighetsbegränsning. En rad per nyckel, inte per anrop. Städas en timme efter att fönstret stängts.';

-- Städningen frågar på nollstalls. Utan index blir den en full genomsökning
-- av just den tabell som är störst när det är som mest bråttom.
create index if not exists rate_limits_nollstalls_idx on app.rate_limits (nollstalls);

/*
 * Tabellen ligger i app-schemat och nås BARA genom funktionerna nedan.
 * Ingen radsäkerhet: schemat är inte klientens, och funktionerna är
 * security definer. Att lägga policyer på en tabell ingen klient når hade
 * varit ceremoni utan verkan.
 */
revoke all on table app.rate_limits from public;

/**
 * Städningen.
 *
 * Sker i anropet och inte på en timer: en timer kräver en schemaläggare vi
 * inte har, och en tabell som växer med varje ny IP tills disken tar slut
 * är en driftstörning som ser ut som något annat.
 *
 * En bokföringsrad hindrar att varje anrop städar. Flera samtidiga anrop
 * kan råka städa samtidigt - det är ofarligt, bara bortkastat arbete, och
 * att låsa mot det hade kostat mer än det sparar.
 */
create or replace function app.rate_limit_stada(p_nu timestamptz)
returns void
language plpgsql
volatile
security definer
set search_path = app, pg_temp
as $$
declare
  v_nasta timestamptz;
begin
  select nollstalls into v_nasta from app.rate_limits where nyckel = '__stadning__';
  if v_nasta is not null and v_nasta > p_nu then
    return;
  end if;

  insert into app.rate_limits (nyckel, antal, nollstalls)
  values ('__stadning__', 0, p_nu + interval '5 minutes')
  on conflict (nyckel) do update set nollstalls = excluded.nollstalls;

  -- En timmes marginal efter stängt fönster. Att radera precis vid
  -- stängningen hade gjort ingen skada, men marginalen gör det möjligt att
  -- felsöka en spärr någon just klagat på.
  delete from app.rate_limits
  where nyckel <> '__stadning__'
    and nollstalls <= p_nu - interval '1 hour';
end;
$$;

/**
 * Ett anrop mot en gräns.
 *
 * Returnerar om anropet ryms, och när klienten får försöka igen om det
 * inte gör det. Retry-After är inte artighet: en klient som får veta när
 * den får försöka igen väntar, och en som bara avvisas försöker direkt
 * igen och gör saken värre.
 */
create or replace function app.rate_limit_hit(
  p_nyckel text,
  p_tak integer,
  p_fonster_sek integer
)
returns table (tillaten boolean, retry_after integer)
language plpgsql
volatile
security definer
set search_path = app, pg_temp
as $$
declare
  -- clock_timestamp() och inte now(): now() är transaktionens starttid, och
  -- fönstret ska mätas från anropet.
  v_nu timestamptz := clock_timestamp();
  v_antal integer;
  v_nollstalls timestamptz;
begin
  if p_nyckel = '__stadning__' then
    raise exception 'reserverad nyckel' using errcode = '22023';
  end if;

  insert into app.rate_limits as rl (nyckel, antal, nollstalls)
  values (p_nyckel, 1, v_nu + make_interval(secs => p_fonster_sek))
  on conflict (nyckel) do update
    set antal = case when rl.nollstalls <= v_nu then 1 else rl.antal + 1 end,
        nollstalls = case
          when rl.nollstalls <= v_nu then v_nu + make_interval(secs => p_fonster_sek)
          else rl.nollstalls
        end
  returning rl.antal, rl.nollstalls into v_antal, v_nollstalls;

  perform app.rate_limit_stada(v_nu);

  return query select
    v_antal <= p_tak,
    case
      when v_antal <= p_tak then 0
      -- Minst en sekund: "försök igen om 0 sekunder" är ett svar som
      -- inbjuder till att försöka igen omedelbart.
      else greatest(1, ceil(extract(epoch from (v_nollstalls - v_nu)))::integer)
    end;
end;
$$;

comment on function app.rate_limit_hit(text, integer, integer) is
  'Räknar ett anrop mot en gräns och svarar om det ryms. Delad mellan alla uppgifter - taket är taket oavsett hur många containrar tjänsten kör på.';

/*
 * Behörigheten.
 *
 * API:ets inloggningsroll är med nödvändighet medlem i `authenticated` -
 * withUser() gör `set local role authenticated`, vilket kräver medlemskap.
 * Därför räcker det att ge rätten dit; att gissa på ytterligare roller
 * hade bara gjort listan längre utan att göra den säkrare.
 *
 * `public` får den INTE: den som kan räkna upp godtyckliga nycklar kan
 * stänga ute andras IP-adresser.
 */
revoke all on function app.rate_limit_hit(text, integer, integer) from public;
revoke all on function app.rate_limit_stada(timestamptz) from public;
grant execute on function app.rate_limit_hit(text, integer, integer) to authenticated, anon;
