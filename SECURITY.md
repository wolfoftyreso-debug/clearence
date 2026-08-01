# Säkerhetsnoteringar

## Kända rådgivningar som är utvärderade och accepterade

### react-router GHSA-qwww-vcr4-c8h2 (high)

`npm audit` flaggar react-router 7.12.0–8.2.0 för "RSC Mode CSRF Bypass".

**Bedömning: gäller inte den här applikationen.** Sårbarheten kräver React
Server Components. Clearance är en ren klientapplikation som använder
`BrowserRouter` med `<Routes>`/`<Route>` och inga data-router-API:er — ingen
`createBrowserRouter`, ingen `RouterProvider`, inga `loader`/`action`, ingen
`useFetcher`. Kontrollera med:

```
grep -rn "createBrowserRouter\|RouterProvider\|useFetcher\|unstable_" src/
```

**Kör inte `npm audit fix --force` här.** Den föreslår nedgradering till
react-router-dom 7.11.0, vilket testades i juli 2026 och visade sig
återinföra den ursprungliga sårbarheten plus ett dussin till. Nuvarande
version 7.18.2 är den rätta.

Omvärdera när en 8.x utan rådgivningen finns och migrationen är gjord.

## Sådant som måste granskas innan skarp drift

- Insolvenslogiken i `src/lib/crisisAnalysis.ts` och KBR-modulen har inte
  granskats av jurist. Den anger frister som rör personligt betalningsansvar.
- Migrationerna är körda mot en lokal Postgres via `npm run test:rls`, men
  aldrig mot ett riktigt Supabase-projekt med skarp auth.
