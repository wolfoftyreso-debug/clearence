# Drift på Vercel

CLEARANCE kör uteslutande på Vercel. Containervägen — Docker, Helm,
Terraform, nginx — är borttagen, inte parkerad. Ett halvt underhållet spår
är sämre än inget: det beskriver en drift som inte finns, och nästa person
som läser det tror att det gäller.

## Vad som ligger var

| Sökväg | Vad Vercel gör med den |
| --- | --- |
| `index.html`, `src/` | Byggs av Vite till `dist/` och serveras statiskt |
| `api/[...path].ts` | **Hela API:t**, en enda funktion. Tar emot allt under `/api` |
| `api/cron/*.ts` | Ett schemalagt jobb per fil |
| `api/cron/_vakt.ts` | Understrecket gör att Vercel *inte* ser den som en endpoint |
| `api/openapi.json` | Kontraktet. Publikt med flit — `/api`-sidan renderar det |
| `server/` | Routern, auth, lagring, loggen. **Utanför `api/`** |
| `db/worker/` | Jobbens riktiga kod. Cron-endpointerna importerar härifrån |
| `supabase/migrations/` | Schemat. Körs med `scripts/migrera.sh`, inte av Vercel |

### Varför serverkoden inte ligger under `api/`

Vercel gör **varje** fil under `api/` till en publik endpoint. Låg routern
kvar som `api/server/index.ts` hade `db.ts`, `auth.ts` och `logg.ts` fått var
sin adress och hamnat i funktionsbunten. `tests/deploy.ts` räknar upp de
tillåtna filerna under `api/` och faller på allt annat.

### Varför API:t är *en* funktion och inte 112

En delad instans ger en delad pool. 112 funktioner hade blivit 112 pooler mot
samma databas, var och en med sitt eget tak. Kallstarten betalas dessutom en
gång per instans i stället för en gång per resurs. `handle()` i
`server/index.ts` är transportlös med flit — det var förberedelsen för exakt
det här.

## Miljövariabler

Sätts i Vercel-projektets inställningar, per miljö.

| Namn | Krävs | Vad den gör |
| --- | --- | --- |
| `DATABASE_URL` | ja | Postgres. **Måste peka på en roll utan `BYPASSRLS` och utan tabellägarskap** — se nedan |
| `PGPOOL_MAX` | nej | Anslutningar per instans. Standard `2` |
| `TRUSTED_PROXY_HOPS` | nej | `1` på Vercel (plattformen sätter `x-forwarded-for`) |
| `CRON_SECRET` | ja | Delad hemlighet för cron-endpointerna. Minst 16 tecken |
| `MAIL_FROM` | ja | Avsändaradress |
| `MAIL_TRANSPORT` | nej | `smtp` (standard) eller `ses` |
| `SMTP_HOST`/`PORT`/`USER`/`PASS` | vid smtp | `SMTP_HOST` krävs; port 587 = STARTTLS, 465 = implicit TLS |
| `DOCUMENTS_BUCKET` | ja | S3-hinken för dokument. `storage_path` lämnar aldrig servern |
| `SIM_MAX_MS` | nej | Tak per simulering. Kapas alltid av funktionens gräns |
| `SIM_BATCH` | nej | Simuleringar per varv. Standard `2` |
| `APP_BASE_URL` | nej | Bas för länkar i mejl. Standard `https://clearance.se` |

`VITE_API_BASE_URL` sätts **inte** i produktion. Appen och API:t delar
ursprung; en relativ `fetch` mot `/v1/...` går rätt via rewriten i
`vercel.json`. Variabeln finns kvar för utvecklingsläget, där Vite och den
egna servern kör på olika portar.

## Databasrollen — den enda felkonfiguration som failar öppet

Pekas `DATABASE_URL` på superanvändaren, på tabellernas ägare eller på en
roll med `BYPASSRLS` **stängs radskyddet av tyst**. Varje fråga fortsätter
fungera; de börjar bara returnera andra bolags insolvensdata. Inget kraschar,
ingen logg blir röd, och felet upptäcks först när någon läser fel akt.

På en egen server vägrade `main.ts` starta. I serverless finns ingen sådan
plats — varje instans kallstartar för sig, och en modul som körs vid import
kan inte vägra något: Vercel har redan tagit emot requesten.

Vägran ligger därför i `sakerRollGrind()` i `server/db.ts`, som körs **före
den första databasfrågan i varje instans**. Både `withUser()` och `withAnon()`
väntar på den. Kostnaden är en extra fråga per kallstart. Ett misslyckande
cachas inte — rättar drift sin `DATABASE_URL` fungerar nästa request, utan
omdeploy.

Rollen ska vara en egen login-roll som är medlem i `authenticated` och varken
äger tabeller eller har `BYPASSRLS`. `db/roles-selfhosted.sql` skapar den.

### Poolning

`withUser()` sätter identiteten transaktionslokalt
(`set_config('app.user_id', …, true)` och `set local role authenticated`).
Allt är transaktionsscopat, vilket är precis vad **transaction mode**-poolning
kräver. Säkerhetsmodellen överlever alltså en pooler framför databasen.
Sessionslokalt hade läckt föregående requests identitet till nästa — den
farligaste buggen i systemet, och den syns bara under last.

## Schemalagda jobb

Deklareras i `vercel.json` och skyddas av `CRON_SECRET`.

| Adress | Takt | Vad den gör |
| --- | --- | --- |
| `/api/cron/utkorg` | var 5:e minut | Bygger inbjudningsmejl, tömmer utkorgen |
| `/api/cron/aviseringar` | var 5:e minut | Verifieringar och notiser, mejl och SMS |
| `/api/cron/simulering` | var 5:e minut | Ett varv genom Monte Carlo-kön |
| `/api/cron/nattjobb` | 03:15 | Gallring, radering, kreditkontroller, stängning, påminnelser, båda faktureringarna |

Nattjobbets steg körs oberoende: kastar gallringen körs faktureringen ändå.
Svaret blir 500 om något steg misslyckades, så Vercel märker körningen som
misslyckad i stället för att en trasig fakturering blir en rad i en logg
ingen läser.

**Utan `CRON_SECRET` svarar endpointerna 503, inte 200.** En glömd
miljövariabel ska inte bli en öppen knapp för att köra faktureringen.

## Avvägningen i simuleringen

En Vercel-funktion får leva i högst 300 sekunder. På en egen server fick en
tung körning ta upp till femton minuter. En körning som spränger
funktionsgränsen dödas **mitt i**, alltså utan att skriva tillbaka något, och
raden blir kvar i `running`.

`api/cron/simulering.ts` sätter därför taket till funktionens gräns minus
marginal, innan arbetaren läser miljön — och `Math.min` gör att ett högre
`SIM_MAX_MS` inte vinner. Ett tak som går att konfigurera förbi är inget tak.

**Konsekvensen, rakt ut:** en körning som skulle tagit mer än ~4,5 minut
markeras som misslyckad med tidsgränsbeskedet i stället för att levereras.
Alternativet — att den dör tyst — är sämre. Kön töms i stället oftare.

## Planen spelar roll

`vercel.json` deklarerar `maxDuration` upp till 300 sekunder och cron var
femte minut. Båda kräver **Pro**. På Hobby är taket 60 sekunder och crons
körs en gång om dygnet — nattjobbet fungerar, men utkorgen och aviseringarna
skulle dröja ett dygn, och det är fristvarningar och fakturor.

## Migrationerna

Vercel kör dem inte. `scripts/migrera.sh` mot `DATABASE_URL` som en roll med
rätt att ändra schemat — alltså **inte** samma roll som API:t använder.

## Det som inte längre finns

- `deploy/` — Dockerfiles, nginx-mallen, Helm-chartet
- `infra/` — Terraform för AWS
- `docs/infrastructure.md`, `docs/selfhosted-kubernetes.md`
- `.gitea/workflows/`, `.github/workflows/driftsatt.yml`
- `npm run build:api` — Vercel bygger serverkoden själv
- Runtime-konfigen (`window.__CLEARANCE_CONFIG__`) — appen och API:t delar
  ursprung, så det problem den löste finns inte

`tests/deploy.ts` kontrollerar att de faktiskt är borta.

## Kontroller

```
npm test                  # lint, typer (inkl. server/) och 51 sviter
npm run test:selfhosted   # radskyddet på en vanlig Postgres — det Neon är
npm run test:api          # hela API:t över HTTP mot en riktig databas
npm run test:webblasare   # bygget i en webbläsare
```

De tre sista kräver Postgres respektive en webbläsare och ligger utanför
`npm test`. `tests/deploy.ts` kräver att varje svit antingen står i kedjan
eller i undantagslistan med ett skäl.
