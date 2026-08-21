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
- [Supabase](https://supabase.com/) (Postgres + Edge Functions) for the
  professionals marketplace

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
| `npm test` | Hela nodbatteriet: lint, typecheck och ~50 sviter. Sekunder. |
| `npm run test:webblasare` | De fyrtio webbläsarproven i `tests/browser/`. Bygger i demoläge, startar en förhandsserver och kör alla. Minuter. |

**Webbläsarproven ingår INTE i `npm test`**, och det är ett medvetet val:
de kräver ett bygge, en server och en webbläsare. Priset för det valet var
att ingen körde dem - när de till slut kördes var nio sviter röda, de
flesta sedan länge, för att de letade efter knappar och texter som bytts
ut. Kör dem före en release, och efter varje ändring i en yta de rör.

Databasproven kräver ett Postgres-kluster och körs för sig:
`bash db/tests/run.sh` (självhostat) och `bash supabase/tests/run.sh`
(Supabase-skalet). Samma påståenden ska gälla i båda - en skillnad mellan
miljöerna ska synas där och inte i produktion.

## Project structure

```
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
