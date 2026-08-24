# CLEARANCE

CLEARANCE is a web app that guides Swedish companies through financial
crisis: it evaluates a company's situation (bankruptcy, reconstruction, or
stabilization), walks through the ABL 25-kap. *kontrollbalansräkning* (KBR)
requirement, projects day-by-day liquidity, and connects the company with
verified insolvency professionals.

> Administrative support and information only — this is not legal advice.

## Tech stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) + TypeScript
- [shadcn/ui](https://ui.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/)
- [TanStack Query](https://tanstack.com/query) for data fetching
- Own HTTP API on `node:http` against Postgres — one runtime dependency
  (`pg`). Lives in `server/`, served by `api/[...path].ts`.
- [Supabase](https://supabase.com/) as a bridge adapter only, while the
  remaining ports move to the own API

## Where this runs

**Vercel, exclusively.** The Vite build is served statically, `api/[...path].ts`
is the whole API as one function, and `api/cron/*.ts` are the scheduled jobs.
Functions run in Stockholm (`arn1`).

- [docs/vercel.md](docs/vercel.md) — what lives where, environment
  variables, and why the database role matters.
- [docs/driftsattning.md](docs/driftsattning.md) — the ordered runbook from
  an empty Vercel account to a service that answers.

The container path — Docker, Helm, Terraform, nginx — was removed, not
parked. `tests/deploy.ts` checks that it is actually gone: a half-maintained
second path describes a deployment that does not exist, and the next person
to read it believes it.

## Getting started

Requires Node.js (see `.nvmrc`/`package.json` engines if pinned) and npm.

```sh
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
# then fill in your Supabase project URL and anon/publishable key

# 3. Start the dev server
npm run dev
```

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run build:dev` | Development-mode build |
| `npm run preview` | Preview a production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Hela nodbatteriet: lint, typecheck (including `server/`, `api/`, `db/worker/`) and ~51 suites. Seconds. |
| `npm run test:webblasare` | De fyrtio webbläsarproven i `tests/browser/`. Bygger i demoläge, startar en förhandsserver och kör alla. Minuter. |
| `npm run motor` | Bygger `clearance-motor.ts` – hela domänlagret i en fil, för ett verktyg som ska byggas vid sidan av. |
| `npm run test:motor` | Bygger om motorfilen, kräver att den var färsk, och kör 28 av produktens egna sviter MOT den extraherade filen. |

**Webbläsarproven ingår INTE i `npm test`**, och det är ett medvetet val:
de kräver ett bygge, en server och en webbläsare. Priset för det valet var
att ingen körde dem - när de till slut kördes var nio sviter röda, de
flesta sedan länge, för att de letade efter knappar och texter som bytts
ut. Kör dem före en release, och efter varje ändring i en yta de rör.

Databasproven kräver ett Postgres-kluster och körs för sig:

| Kommando | Vad det bevisar |
| --- | --- |
| `npm run test:selfhosted` | Radskyddet och rollerna på en **vanlig Postgres** - alltså det Vercel Postgres och Neon är. 324 kontroller. |
| `npm run test:rls` | Samma påståenden mot Supabase-skalet. En skillnad mellan miljöerna ska synas här, inte i produktion. |
| `npm run test:api` | Hela API:t över riktig HTTP mot en riktig databas, inklusive Vercel-ingången `api/[...path].ts`. 577 kontroller. |

## Project structure

```
server/           Routern, auth, lagring, loggen. UTANFÖR api/ med flit:
                  Vercel gör varje fil under api/ till en publik endpoint.
api/
  [...path].ts    Hela API:t, en funktion
  cron/           Ett schemalagt jobb per fil (_vakt.ts är ingen endpoint)
db/
  worker/         Jobbens riktiga kod. Cron-endpointerna importerar den.
src/
  components/
    landing/       Marketing site sections (hero, features, footer, ...)
    marketplace/    Professional listing card
    wizard/         Shared crisis-wizard form controls
    ui/             shadcn/ui primitives
  hooks/            Reusable React hooks
  integrations/     Supabase client + generated database types
  lib/              Org-number validation, PDF/HTML export, utilities
  pages/            Route-level views (Index, CrisisWizard, KBRModule,
                     Dashboard, LiquidityTimeline, Marketplace)
supabase/
  functions/        Edge Functions (e.g. lookup-company)
  migrations/        SQL schema + RLS policies
```

## Supabase

The `professionals` and `professional_ratings` tables back the
`/marketplace` page. Row-Level Security is enabled with public read-only
policies — writes require the Supabase service role. The `lookup-company`
edge function looks up a Swedish organization number and falls back to
built-in demo data if the external lookup fails or is unavailable.

To develop against your own Supabase project, run the migration in
`supabase/migrations/` against it and point `.env` at its URL and anon key.

## Motorn i en fil

`npm run motor` skriver `clearance-motor.ts`: hela domänlagret – samtalsmotorn
som vägleder, analyserna, guiderna, verktygen, rapportbyggarna, källorna,
simuleringen och gallringen – plus kontraktet (`types.ts`, `ports.ts`) som
säger vad en värd måste tillhandahålla. 88 moduler, ett enda yttre beroende,
ingen React och ingen kunskap om vilken databas som ligger under.

Den finns för att ett annat verktyg ska kunna byggas på samma motor utan att
kopiera den för hand. `clearance-motor.register.json` säger vilken modul varje
exporterat namn kom ur, och vad det heter i den platta filen – 33 namn
deklarerades i mer än en modul (det finns fyra olika `daysBetween`, med olika
signaturer) och de senare fick modulsuffix.

TVÅ SAKER GÖR FILEN TROVÄRDIG, och de är hela poängen:

* `npm run test:motor` bygger om filen och **avbryter om den inte var färsk** –
  en genererad fil som ligger kvar medan källan ändras är värre än ingen alls,
  för den ser aktuell ut.
* Samma kommando kör sedan 28 av produktens egna sviter mot den extraherade
  filen i stället för mot originalmodulerna, via en skuggmodul per importerad
  sökväg. Går de gröna kommer varje funktion de rör ur den platta filen. Att
  den kompilerar bevisar bara att den är syntaktiskt hel.

Sju sviter körs inte den vägen och står uppräknade med skäl i skriptet – de
prövar webbläsarlagret, API-kontraktet eller bygget, inte motorn.

`exempel/` är verktyget vid sidan av, i miniatyr men på riktigt:

* `exempel/lager.ts` – verktygets EGEN lagringsport med två adaptrar: minne
  för prov och en JSON-ärendemapp för byrån (en fil per akt, ingen databas).
  Postgres den dag byrån vill är EN adapter till, inte en omskrivning. En akt
  som inte går att läsa är ett fel med filnamn i – aldrig en tyst överhoppning.
* `exempel/proffsverktyg.ts` – bygger ENBART på den platta filen. Utan
  argument: demonstrationen med alla kontroller (disk-varv, egen
  `CompanyLookupPort`, `analyseCrisis` → praktikerrapport → spelbok →
  portfölj). Med en katalog som argument: byråns ärendemapp – portföljens
  arbetsledarrader, rangordningen och en praktikerrapport per akt.

`npm run exempel:proffsverktyg` kör det; `npm run test:motor` kräver att det
fortsätter fungera. Kontrollerna är krav, inte utskrifter: praktikerns vy
måste skilja sig från bolagets (rollanpassningen är ett löfte), det akuta
ärendet måste rankas före det stabila (severity räknas ur samma rapportbygge
som ärendevyn, så siffrorna aldrig kan säga olika saker), och ett lager som
tappar en akt tyst fälls av tre kontroller.
