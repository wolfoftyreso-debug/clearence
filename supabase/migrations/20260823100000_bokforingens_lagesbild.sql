/**
 * LÄGESBILDEN FÅR EN PLATS ATT BO.
 *
 * `financial.getLatestSnapshot()` returnerade `null` rakt av, med
 * kommentaren att ingen bokföringsadapter var driftsatt. Effekten var
 * större än kommentaren lät påskina: hela analysmotorn i
 * src/lib/financial/insights.ts - koncentration, åldersfördelning,
 * kostnadsavvikelser, betalningsprioritering - kördes aldrig mot något,
 * och översiktens insiktslista var permanent tom i skarp drift.
 *
 * Tabellen nedan är det som saknades. En rad är en lägesbild: en
 * bokföringsfil, tolkad och översatt, med tidpunkt och ursprung.
 *
 * VARFÖR JSONB OCH INTE TRETTIO TABELLER. `FinancialSnapshot` är ett
 * DOKUMENT: det som gick att läsa ur källan vid ett tillfälle, inklusive
 * `gaps` - det som INTE gick att läsa. Normaliserat i relationer hade
 * varje ny datamängd (motparter, skattekonto, lönekörning) krävt en
 * migration, och luckorna hade blivit svåra att skilja från nollor.
 * De fält som SÖKS PÅ - ärendet, tidpunkten, organisationsnumret - är
 * däremot egna kolumner, för de ska vara indexerbara och läsbara utan
 * att packa upp dokumentet.
 *
 * RADSKYDDET är samma som för resten av ärendets data: läsning för
 * ärendets deltagare, skrivning för den som får skriva. En lägesbild ur
 * bokföringen är bland det känsligaste produkten hanterar - den visar
 * exakt hur illa det står till - och den ska aldrig kunna läsas av någon
 * som inte redan har tillträde till ärendet.
 */

create table public.financial_snapshots (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  -- Vem som förde in den. Sätts av servern ur den prövade sessionen.
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Källan. 'generic' är SIE-filen; leverantörsnamnen finns för den dag
  -- en riktig bokföringsintegration ansluts vid sidan av.
  provider text not null default 'generic',
  -- När uppgifterna LÄSTES ur källan, inte när raden skrevs. En fil kan
  -- laddas upp långt efter att den exporterades.
  captured_at timestamptz not null,

  org_number text,
  company_name text,
  -- Räkenskapsåret filen avser. Null när #RAR saknades - det står då även
  -- som en lucka i dokumentet.
  fiscal_year_start date,
  fiscal_year_end date,

  -- Filen den kom ur, så att siffran går att spåra till en uppladdning.
  source_file_name text not null,
  source_document_id uuid references public.case_documents (id) on delete set null,

  -- Hela FinancialSnapshot enligt src/lib/financial/model.ts.
  payload jsonb not null,

  created_at timestamptz not null default now(),

  constraint financial_snapshots_provider_known
    check (provider in ('fortnox', 'visma', 'bjornlunden', 'bokio',
                        'peaccounting', 'businesscentral', 'generic')),
  constraint financial_snapshots_payload_is_object
    check (jsonb_typeof(payload) = 'object'),
  -- Räkenskapsåret ska inte kunna sluta innan det börjat.
  constraint financial_snapshots_fiscal_year_ordered
    check (fiscal_year_start is null or fiscal_year_end is null
           or fiscal_year_start <= fiscal_year_end)
);

comment on table public.financial_snapshots is
  'Bokföringen som lägesbild: en tolkad SIE-fil (eller framtida systemexport) med tidpunkt, ursprung och luckor.';
comment on column public.financial_snapshots.payload is
  'FinancialSnapshot, inklusive gaps - det som INTE gick att läsa. En lucka är inte en nolla.';

-- Läsningen är alltid "senaste för det här ärendet".
create index financial_snapshots_case_idx
  on public.financial_snapshots (case_id, captured_at desc);

alter table public.financial_snapshots enable row level security;

create policy "Case members read financial snapshots"
  on public.financial_snapshots for select
  using (public.has_case_access(case_id));

create policy "Writers insert financial snapshots"
  on public.financial_snapshots for insert
  with check (public.can_write_case(case_id));

create policy "Writers delete financial snapshots"
  on public.financial_snapshots for delete
  using (public.can_write_case(case_id));

/*
 * INGEN UPDATE-POLICY, med flit.
 *
 * En lägesbild är en observation vid en tidpunkt. Att kunna skriva om den
 * i efterhand hade gjort den värdelös som underlag - den som visar
 * balansräkningen för en bank ska kunna säga "så här såg det ut den
 * dagen", inte "så här ser det ut nu i fältet som heter den dagen".
 * En ny läsning blir en ny rad.
 */

-- Tabellrättigheterna delas ut till rollen API:t kör som. Utan det faller
-- första frågan på 42501 långt innan radskyddet ens prövas.
grant select, insert, delete on public.financial_snapshots to authenticated;

/*
 * Revisionsspåret följer samma mönster som ärendets övriga tabeller: den
 * som förde in en lägesbild ska synas i journalen, för siffrorna därifrån
 * ligger sedan till grund för beslut om rekonstruktion eller konkurs.
 */
create trigger financial_snapshots_audit
  after insert or delete on public.financial_snapshots
  for each row execute function public.record_audit_event();
