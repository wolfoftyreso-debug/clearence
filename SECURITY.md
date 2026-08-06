# Säkerhetsnoteringar

## Åtgärdade rådgivningar

### react-router GHSA-qwww-vcr4-c8h2 (high) — **ÅTGÄRDAD**

Den här filen bar tidigare bedömningen att rådet inte gällde oss: det
kräver React Server Components, och Clearance är en ren klientapplikation
med `BrowserRouter` och `<Routes>`/`<Route>`. Bedömningen stämde. Den
slutade med raden *"Omvärdera när en 8.x utan rådgivningen finns och
migrationen är gjord."*

**Den finns, och den är gjord.** react-router 8.3.0 ligger utanför rådets
intervall (7.12.0–8.2.0). Trädet i produktion har därmed noll kända
rådgivningar. Vad som krävdes:

| Ändring | Varför |
| --- | --- |
| `react-router-dom` → `react-router` | Paketen gick ihop i version 8; `react-router-dom` finns inte längre. 58 importer i `src/`. |
| React 18 → 19 | react-router 8 kräver `react >= 19.2.7`. |
| `@types/react` 18 → 19 | Typer på 18 mot körning på 19 godkänner det som inte längre finns. |
| `next-themes` 0.3 → 0.4.6 | 0.3 deklarerade React ≤18 som peer. |
| `react-day-picker` och `vaul` borttagna | Deklarerade React ≤18 och blockerade därmed hela upplösningen. Båda var oanvänd shadcn-grund — bara `ui/calendar.tsx` och `ui/drawer.tsx`, som ingen sida importerade. De togs bort med dem. |

**Kör fortfarande inte `npm audit fix --force`.** Den föreslog nedgradering
till 7.11.0, och det var fällan: 7.11.0 bär flera egna råd, däribland öppen
omdirigering i `<Link>` och `useNavigate` — sådant den här appen faktiskt
använder. Vägen ur ett råd som inte går att nå gick uppåt, inte nedåt.

Beslutet är låst i `tests/beroenden.ts`: versionen prövas mot båda de kända
intervallen, och kontrollen faller om någon inför `createBrowserRouter`
eller en RSC-ingång — alltså det som skulle göra bedömningen ovan
inaktuell.

## Kända rådgivningar som är utvärderade och accepterade

### esbuild GHSA-67mh-4wv8-2f99 (moderate) via vite

`npm audit` flaggar esbuild ≤0.24.2, som kommer in genom vite 5.

**Bedömning: rör bara utvecklingsservern.** Sårbarheten gör det möjligt för
en webbplats du besöker att läsa svar från en `vite dev` som körs lokalt.
Den finns inte i något som driftsätts: produktionsbunten är statiska filer
bakom CloudFront, och esbuild ingår inte i den.

`npm audit --omit=dev` — alltså det som faktiskt går i drift — ger **noll**
rådgivningar.

Åtgärden är vite 8, tre huvudversioner upp, och den är inte gjord. Gör den
när något annat ändå kräver en verktygskedjeuppgradering.

## Sådant som måste granskas innan skarp drift

- Insolvenslogiken i `src/lib/crisisAnalysis.ts` och KBR-modulen har inte
  granskats av jurist. Den anger frister som rör personligt betalningsansvar.
- Migrationerna är körda mot en lokal Postgres via `npm run test:rls`, men
  aldrig mot ett riktigt Supabase-projekt med skarp auth.
