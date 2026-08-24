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

## Vad som återstår

Läget, mätt och inte påstått. Siffrorna kommer ur `tests/awsAdapter.ts`,
som räknar migreringen på två oberoende sätt.

| Hinder | Läge |
| --- | --- |
| **41 av 156 portmetoder på bron** | Resten går mot eget API — inklusive HELA auth-gruppen, som var det som gjorde Supabase oundgängligt. `delegeradePortar()` listar dem; en delegerad port utan bro kastar ett fel som namnger sig själv |
| **Dokumentuppladdning saknas i klienten** | API:t har hela tvåstegsvägen. Klienten har bara nedladdning. Den dagen uppladdningen kopplas in måste `connect-src` i CSP:n vidgas — `tests/vercelredo.ts` blir röd om det glöms |
| **Blob inte körd mot riktig butik** | Kontroll-API:t är prövat mot en dubbel över riktig HTTP. Objektvärden är hårdkodad i SDK:n och går inte att peka om härifrån |

Det som **inte** står här är prövat och grönt: bygget, funktionerna, cron,
rollgrindarna, rubrikerna, rewrites och miljövariablernas felbesked.

## Miljövariabler

Sätts i Vercel-projektets inställningar, per miljö.

| Namn | Krävs | Vad den gör |
| --- | --- | --- |
| `DATABASE_URL` | ja | Postgres för **API:t**. **Måste peka på en roll utan `BYPASSRLS` och utan tabellägarskap** — se nedan |
| `WORKER_DATABASE_URL` | ja | Postgres för **de schemalagda jobben**. Motsatt krav: rollen måste kunna arbeta över alla bolag |
| `PGPOOL_MAX` | nej | Anslutningar per instans. Standard `2` |
| `TRUSTED_PROXY_HOPS` | nej | `1` på Vercel (plattformen sätter `x-forwarded-for`) |
| `CRON_SECRET` | ja | Delad hemlighet för cron-endpointerna. Minst 16 tecken |
| `MAIL_FROM` | ja | Avsändaradress |
| `MAIL_TRANSPORT` | nej | `smtp` (standard) eller `ses` |
| `SMTP_HOST`/`PORT`/`USER`/`PASS` | vid smtp | `SMTP_HOST` krävs; port 587 = STARTTLS, 465 = implicit TLS |
| `BLOB_READ_WRITE_TOKEN` | ja | Vercel Blob-butiken för dokument. Sätts automatiskt när butiken kopplas till projektet |
| `STORAGE_BACKEND` | nej | `blob` eller `s3`. Osatt = `blob` när ett Blob-kreditiv finns, annars `s3` |
| `BLOB_PREFIX` | nej | Valfritt prefix i butiken. Tomt = butikens rot |
| `DOCUMENTS_BUCKET` | vid s3 | Hinken när `STORAGE_BACKEND=s3` (AWS eller MinIO) |
| `SIM_MAX_MS` | nej | Tak per simulering. Kapas alltid av funktionens gräns |
| `SIM_BATCH` | nej | Simuleringar per varv. Standard `2` |
| `APP_BASE_URL` | nej | Bas för länkar i mejl. Standard `https://clearance.se` |

`VITE_API_BASE_URL` sätts **inte** i produktion. Appen och API:t delar
ursprung; en relativ `fetch` mot `/v1/...` går rätt via rewriten i
`vercel.json`. Variabeln finns kvar för utvecklingsläget, där Vite och den
egna servern kör på olika portar.

## Dokumenten ligger i Vercel Blob

`storage_path` lämnar aldrig servern. Det API:t skickar ut är en signerad
URL som slutar fungera efter 60 sekunder, och den signeras först efter att
`app.may_read_document()` svarat ja. Den regeln är oförändrad sedan
S3-tiden — bara leverantören under den är utbytt.

Blob-vägen ser ut så här:

| Steg | Vad som händer |
| --- | --- |
| Nedladdning | `issueSignedToken` med `operations: ["get"]` och **bara den ena sökvägen**, sedan `presignUrl` mot butikens `private`-värd |
| Uppladdning | `issueSignedToken` med `operations: ["put"]`, låst till en innehållstyp och en maxstorlek, giltig i två minuter |
| Bekräftelse | `head()` ger den **lagrade** storleken, `get()` ger strömmen — vi läser dess första 1 024 bytes och avbryter resten |
| Avvisning | `del()` — en fil som inte klarar signaturprövningen ligger inte kvar |

Delegationen är alltid smalast möjliga: en sökväg, en operation. En
läs-URL kan inte spelas om till en skrivning, och en skriv-URL kan inte
läsa.

**Filnamnet ligger sist i sökvägen.** Blob sätter `content-disposition` ur
sökvägens sista led och tar inte emot ett eget filnamn vid signeringen (som
S3:s `response-content-disposition`). Därför bygger `sakerLagringsvag()`
sökvägen som `<ärende>/<slumpid>/<sanerat namn>` — annars hade den
nedladdade filen hetat `1a2b3c-arsredovisning.pdf`.

### S3 finns kvar som alternativ

`STORAGE_BACKEND=s3` väljer den gamla vägen (AWS S3 eller MinIO). Kontraktet
i `server/storage.ts` är ett och samma; det är bara de fem seamen under det
som byts. Ett **okänt** värde ger ingen lagring alls — `/health` säger
`storage: false` och dokumentrutterna svarar 404 med en läsbar text. Hellre
det än att filer tyst hamnar i fel ände av världen.

### Vad som är prövat, och vad som inte är det

`tests/blob.ts` reser en dubbel av Blobs **kontroll-API** (den som
`VERCEL_BLOB_API_URL` pekar ut) och kör signeringen, den presignerade PUT:en,
HEAD och DELETE genom den riktiga SDK:n över riktig HTTP.

Blobs **objektvärd** (`<butik>.private.blob.vercel-storage.com`) är hårdkodad
i SDK:n och går inte att peka om. Nedladdnings-URL:en granskas därför till
sin form — värd, sökväg, signatur, utgångstid — men hämtas inte i sviten.
Detsamma gäller läsningen av de första bytesen; det som är kört där är
strömklippningen, som är den delen vi själva skrivit. Det återstår alltså
en körning mot en riktig Blob-butik innan uppladdningskedjan är sedd hela
vägen.

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

### Två anslutningar, inte en

**Den enda punkten där Vercel skiljer sig från containern på ett sätt som går
att missa.** Där hade varje process sin egen `DATABASE_URL`: API-poden fick
`app_api`, cron-jobben fick `app_worker`. På Vercel delar alla funktioner i ett
projekt samma miljövariabler — och de två behöver **motsatta** roller:

| Variabel | Används av | Krav |
| --- | --- | --- |
| `DATABASE_URL` | API:t | Får **inte** gå förbi radskyddet. `sakerRollGrind()` vägrar starta annars |
| `WORKER_DATABASE_URL` | Cron-jobben | **Måste** kunna arbeta över alla bolag: `app_worker` (BYPASSRLS) eller schemats ägare |

Det finns inget enda värde som fungerar för båda. En repetition mot en riktig
databas visade vad som händer med API-rollen i jobben:

```
select count(*) from public.cases              -> 0
select count(*) from public.case_invitations   -> 0
select count(*) from public.customer_invoices  -> 0
```

Gallringen hittar inget att gallra, faktureringen inget att fakturera,
inbjudningarna ingen att mejla. **Inget steg kastar**, så cron-endpointen
svarar 200 och Vercel märker körningen som lyckad. Fakturorna uteblir i en
månad innan någon undrar varför.

`db/worker/roll.ts` prövar därför rollen innan jobbet börjar och **kastar** om
den inte duger. En tyst nolla är värre än ett fel.

### `app_worker` går inte alltid att skapa

Postgres tillåter bara en roll som själv har `BYPASSRLS` att dela ut det. På
ett managed Postgres är ägarrollen inte superanvändare — så
`db/roles-selfhosted.sql` skapar ingen `app_worker` där, och säger det med ett
`NOTICE`. Låt då `WORKER_DATABASE_URL` peka på **schemats ägare** (samma roll
som körde migrationerna). Ägaren är undantagen sin egen RLS, vilket är precis
det jobben behöver.

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
