/**
 * SIMULERINGARNA: antagandena, körningarna och spåret mellan dem.
 *
 * En Monte Carlo-körning är inte ett diagram. Den är ett UNDERLAG - något
 * någon fattar beslut om rekonstruktion eller konkurs på - och då gäller
 * samma krav som för resten av ärendets data: den ska gå att läsa om, köra
 * om och granska i efterhand.
 *
 * TVÅ TABELLER, OCH SKÄLET ÄR ATT DE ÄNDRAS I OLIKA TAKT.
 *
 *   simulations       antagandena. Vilka variabler, vilka fördelningar,
 *                     vilken modell. Redigeras av användaren.
 *   simulation_runs   en körning av dem. Frö, motorversion, resultat.
 *                     Skrivs en gång och ändras aldrig.
 *
 * Att slå ihop dem hade gjort det omöjligt att svara på den enda fråga som
 * betyder något i efterhand: "vilka antaganden gällde när DEN HÄR siffran
 * togs fram?" En redigering av specen hade skrivit över historien.
 *
 * DÄRFÖR BÄR VARJE KÖRNING SIN EGEN KOPIA AV SPECEN (`spec`), inte bara en
 * pekare till simuleringen. Det är avsiktlig redundans: en pekare hade
 * pekat på något som hunnit ändras.
 *
 * RÅDATA SPARAS ALDRIG. En miljon iterationer gånger åtta byte gånger
 * antalet resultat är tiotals megabyte per körning, och de behövs inte:
 * percentilerna, histogrammet, känsligheten och konvergensen är vad någon
 * läser, och med samma frö och samma motorversion går rådata att återskapa
 * exakt. Det är hela poängen med reproducerbarheten.
 */

/* -------------------------------------------------------------------------- */
/* Antagandena                                                                */
/* -------------------------------------------------------------------------- */

create table public.simulations (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,

  name text not null,
  description text,

  /*
   * Specen: inputs, fördelningar, konstanter och resultatuttryck.
   * Formen är Simuleringsspec i src/lib/montecarlo/motor.ts.
   *
   * jsonb och inte normaliserade tabeller: en ny fördelningstyp eller ett
   * nytt fält på en inputvariabel ska inte kräva en migration, och specen
   * läses alltid i sin helhet - det finns ingen fråga som vill ha "alla
   * simuleringar som använder betafördelning".
   */
  spec jsonb not null,

  /*
   * VERSIONEN AV ANTAGANDENA. Höjs vid varje ändring av specen, av en
   * trigger - inte av klienten, som annars kunde återanvända ett nummer
   * och göra två olika antaganden omöjliga att skilja åt.
   */
  spec_version integer not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint simulations_name_length check (char_length(name) between 1 and 200),
  constraint simulations_spec_is_object check (jsonb_typeof(spec) = 'object')
);

comment on table public.simulations is
  'Monte Carlo: antagandena. En rad är en uppsättning inputs, fördelningar och resultatuttryck.';
comment on column public.simulations.spec_version is
  'Höjs av trigger vid varje ändring av spec. Varje körning sparar vilken version den kördes på.';

create index simulations_case_idx on public.simulations (case_id, updated_at desc);

/* -------------------------------------------------------------------------- */
/* Körningarna                                                                */
/* -------------------------------------------------------------------------- */

create type public.simulation_status as enum ('queued', 'running', 'done', 'failed', 'cancelled');

create table public.simulation_runs (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null references public.simulations (id) on delete cascade,
  -- Dubblerat från simuleringen så att radskyddet kan pröva ärendet utan
  -- att gå via en join. En policy som kräver en join blir långsam och lätt
  -- att skriva fel.
  case_id uuid not null references public.cases (id) on delete cascade,
  started_by uuid not null references auth.users (id) on delete cascade,

  /* --- Det som gör körningen reproducerbar ---------------------------- */

  -- Fröet. Utan det går körningen inte att upprepa, och då är den inte ett
  -- underlag utan en anekdot.
  seed bigint not null,
  -- Motorns version. Ändras samplingen är ett gammalt resultat inte längre
  -- reproducerbart med ny kod, och det ska gå att SE i stället för att
  -- upptäckas.
  engine_version text not null,
  -- Specen som den såg ut vid körningen. Se filens inledning.
  spec jsonb not null,
  spec_version integer not null,
  iterations integer not null,

  /* --- Utfallet -------------------------------------------------------- */

  status public.simulation_status not null default 'queued',
  -- Statistik, sannolikheter, histogram, känslighet och konvergens.
  -- ALDRIG rådata: se filens inledning.
  results jsonb,
  -- Kvalitetsanmärkningar. En körning med anmärkningar är fortfarande en
  -- körning - den ska visas, inte döljas.
  notes jsonb,
  error text,

  queued_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer,
  -- Antalet iterationer som gav ogiltiga tal och uteslöts.
  discarded_iterations integer not null default 0,

  -- Arbetaren räknar upp det här när den plockar raden; en körning som
  -- misslyckas om och om ska inte plockas för evigt.
  attempts integer not null default 0,

  constraint simulation_runs_iterations_sane
    check (iterations between 100 and 10000000),
  constraint simulation_runs_seed_sane
    check (seed >= 0 and seed <= 4294967295),
  -- En färdig körning MÅSTE ha ett resultat. En rad som säger 'done' utan
  -- results är precis den sortens tysta halvfärdighet som gör ett underlag
  -- opålitligt.
  constraint simulation_runs_done_has_results
    check (status <> 'done' or results is not null),
  constraint simulation_runs_failed_has_error
    check (status <> 'failed' or error is not null),
  constraint simulation_runs_finished_has_time
    check (status not in ('done', 'failed', 'cancelled') or finished_at is not null)
);

comment on table public.simulation_runs is
  'Monte Carlo: en körning. Frö, motorversion och specen som gällde - allt som krävs för att köra om den.';
comment on column public.simulation_runs.results is
  'Aggregat: statistik, sannolikheter, histogram, känslighet, konvergens. Aldrig rådata - den återskapas ur fröet.';

create index simulation_runs_simulation_idx
  on public.simulation_runs (simulation_id, queued_at desc);
-- Arbetarens kö: bara det som väntar, äldst först.
create index simulation_runs_queue_idx
  on public.simulation_runs (queued_at)
  where status = 'queued';

/* -------------------------------------------------------------------------- */
/* Radskyddet                                                                 */
/* -------------------------------------------------------------------------- */

alter table public.simulations enable row level security;
alter table public.simulation_runs enable row level security;

create policy "Case members read simulations"
  on public.simulations for select using (public.has_case_access(case_id));
create policy "Writers insert simulations"
  on public.simulations for insert with check (public.can_write_case(case_id));
create policy "Writers update simulations"
  on public.simulations for update using (public.can_write_case(case_id))
  with check (public.can_write_case(case_id));
create policy "Writers delete simulations"
  on public.simulations for delete using (public.can_write_case(case_id));

create policy "Case members read runs"
  on public.simulation_runs for select using (public.has_case_access(case_id));
create policy "Writers insert runs"
  on public.simulation_runs for insert with check (public.can_write_case(case_id));

/*
 * UPDATE ÄR BEGRÄNSAD TILL ATT AVBRYTA.
 *
 * En körning som är klar får aldrig skrivas om - resultatet är en
 * observation, och ett underlag som går att redigera i efterhand är inget
 * underlag. Det enda en användare får göra är att avbryta något som ännu
 * inte hunnit bli klart, och WITH CHECK nedan låser det till just den
 * övergången. Arbetaren skriver resultat genom en SECURITY DEFINER-funktion,
 * inte genom den här policyn.
 */
create policy "Writers may only cancel a pending run"
  on public.simulation_runs for update
  using (public.can_write_case(case_id) and status in ('queued', 'running'))
  with check (public.can_write_case(case_id) and status = 'cancelled');

grant select, insert, update, delete on public.simulations to authenticated;
grant select, insert, update on public.simulation_runs to authenticated;

/* -------------------------------------------------------------------------- */
/* Versionen höjs av databasen                                                */
/* -------------------------------------------------------------------------- */

/**
 * Varje ändring av specen är en ny version.
 *
 * I databasen och inte i klienten: två flikar som sparar samtidigt skulle
 * annars kunna skriva samma nummer, och då pekar två körningar på "version
 * 3" som betyder olika saker.
 */
create or replace function public.bump_simulation_version()
returns trigger
language plpgsql
as $$
begin
  if new.spec is distinct from old.spec then
    new.spec_version := old.spec_version + 1;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger simulations_version
  before update on public.simulations
  for each row execute function public.bump_simulation_version();

-- Journalen: vem som skapade och körde vad. Simuleringar ligger till grund
-- för beslut, och besluten ska gå att härleda.
create trigger simulations_audit
  after insert or update or delete on public.simulations
  for each row execute function public.record_audit_event();
create trigger simulation_runs_audit
  after insert on public.simulation_runs
  for each row execute function public.record_audit_event();

/* -------------------------------------------------------------------------- */
/* Kön: arbetaren plockar de tunga körningarna                                */
/* -------------------------------------------------------------------------- */

/**
 * Plockar köade körningar åt arbetaren.
 *
 * Samma mönster som claim_outbound_emails och claim_notification_deliveries:
 * `for update skip locked` så att två arbetare aldrig tar samma rad, och
 * försöksräknaren höjs vid plockningen så att en körning som kraschar
 * arbetaren inte plockas i all evighet.
 *
 * BARA ARBETAREN. Funktionen är revoked från klientrollerna nedan - den
 * sätter status utan att fråga om ärendet, vilket är rätt för en betrodd
 * batchprocess och fel för allt annat.
 */
create or replace function public.claim_simulation_runs(p_limit integer default 1)
returns setof public.simulation_runs
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  update public.simulation_runs
  set status = 'running', started_at = now(), attempts = attempts + 1
  where id in (
    select id from public.simulation_runs
    where status = 'queued' and attempts < 3
    order by queued_at
    for update skip locked
    limit greatest(1, least(p_limit, 10))
  )
  returning *;
$$;

/**
 * Arbetaren skriver tillbaka utfallet.
 *
 * En funktion och inte en policy: arbetaren har ingen användaridentitet och
 * kan därför inte gå genom can_write_case. Att i stället ge den en
 * update-policy hade öppnat samma väg för klienterna.
 *
 * Skriver bara på en körning som ÄR igång. En avbruten körning som hinner
 * bli klar i arbetaren ska förbli avbruten - annars kan ett avbrott
 * ogöras av en kapplöpning.
 */
create or replace function public.finish_simulation_run(
  p_id uuid,
  p_status public.simulation_status,
  p_results jsonb,
  p_notes jsonb,
  p_error text,
  p_duration_ms integer,
  p_discarded integer default 0
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_rader integer;
begin
  if p_status not in ('done', 'failed') then
    raise exception 'finish_simulation_run tar bara done eller failed';
  end if;
  update public.simulation_runs
  set status = p_status,
      results = p_results,
      notes = p_notes,
      error = p_error,
      duration_ms = p_duration_ms,
      discarded_iterations = coalesce(p_discarded, 0),
      finished_at = now()
  where id = p_id and status = 'running';
  get diagnostics v_rader = row_count;
  return v_rader = 1;
end;
$$;

revoke all on function public.claim_simulation_runs(integer) from public, anon, authenticated;
revoke all on function
  public.finish_simulation_run(uuid, public.simulation_status, jsonb, jsonb, text, integer, integer)
  from public, anon, authenticated;

/**
 * Direktkörningens väg att skriva sitt eget resultat.
 *
 * finish_simulation_run ovan är ARBETARENS: den frågar inte om ärendet,
 * vilket är rätt för en betrodd batchprocess och därför revoked från alla
 * klientroller. Men lätta körningar sker i förfrågans egen tur, och då är
 * anroparen en vanlig användare - som annars fastnar på 42501.
 *
 * Att lösa det genom att grant:a arbetarfunktionen hade gett varje inloggad
 * användare rätten att stämpla vilken körning som helst som klar, med
 * vilket resultat som helst. Alltså en EGEN funktion, med tre grindar:
 *
 *   1. can_write_case på körningens ärende - samma gräns som allt annat.
 *   2. bara den som STARTADE körningen får avsluta den.
 *   3. bara en rad som fortfarande är 'running'. En avbruten körning som
 *      hinner bli klar ska förbli avbruten; annars kan ett avbrott ogöras
 *      av en kapplöpning.
 *
 * SECURITY DEFINER behövs trots grindarna: update-policyn på tabellen
 * tillåter med flit bara övergången till 'cancelled', så ingen policy kan
 * skriva ett resultat. Grinden flyttas hit i stället för att luckras upp
 * där.
 */
create or replace function public.complete_own_simulation_run(
  p_id uuid,
  p_status public.simulation_status,
  p_results jsonb,
  p_notes jsonb,
  p_error text,
  p_duration_ms integer,
  p_discarded integer default 0
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_case uuid;
  v_startade uuid;
  v_rader integer;
begin
  if auth.uid() is null then
    raise exception 'Kräver inloggning';
  end if;
  if p_status not in ('done', 'failed') then
    raise exception 'complete_own_simulation_run tar bara done eller failed';
  end if;

  select case_id, started_by into v_case, v_startade
  from public.simulation_runs where id = p_id;
  if v_case is null then
    return false;
  end if;
  if not public.can_write_case(v_case) then
    raise exception 'Behörighet saknas för ärendet';
  end if;
  if v_startade <> auth.uid() then
    raise exception 'Bara den som startade körningen kan avsluta den';
  end if;

  update public.simulation_runs
  set status = p_status,
      results = p_results,
      notes = p_notes,
      error = p_error,
      duration_ms = p_duration_ms,
      discarded_iterations = coalesce(p_discarded, 0),
      finished_at = now()
  where id = p_id and status = 'running';
  get diagnostics v_rader = row_count;
  return v_rader = 1;
end;
$$;

revoke all on function
  public.complete_own_simulation_run(uuid, public.simulation_status, jsonb, jsonb, text, integer, integer)
  from public, anon;
grant execute on function
  public.complete_own_simulation_run(uuid, public.simulation_status, jsonb, jsonb, text, integer, integer)
  to authenticated;
