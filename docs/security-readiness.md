# Security Readiness Report — CLEARANCE

**Datum:** 2026-08-10 · **Omfattning:** hela systemet (frontend, API, databas,
arbetare, chart/deployment, CI) · **Metod:** audit först, därefter åtgärd med
regressionstest per fynd.

## Slutstatus

> ## SECURITY NOT READY
>
> Fyra blockerande krav går **inte** att verifiera i den här miljön, och ett
> arkitekturvillkor är ouppfyllt (se *Kvarvarande risker*). Allt som gick att
> pröva är prövat och grönt — men "SECURITY READY" får enligt uppdraget bara
> användas när **alla** blockerande krav är verifierade med faktiska tester.
> Det är de inte.

Det som ÄR gjort: **elva** sårbarheter hittade och åtgärdade, varav fyra
allvarliga (SSRF-bypass, en verkningslös spärr mot lösenordsforcering, en
databasroll som kunde stänga av radskyddet tyst, en filuppladdning som litade
på klientens påstående) och en till som var värre än den såg ut: **en
telefonverifiering som inte verifierade något** (H-5). Var och en har ett
regressionstest som bevisar att angreppet blockeras. Sammanlagt 100
säkerhetskontroller och 349 API-kontroller mot riktig Postgres, alla gröna.

Ett mönster går igen i tre av fynden, och det är värt att skriva ut: **ett test
som kodifierar en sårbarhet är sämre än inget test alls.** Spärren mot
lösenordsforcering hade tre gröna kontroller som krävde exakt det beteende som
gjorde den kringgåbar. Telefonverifieringen hade en grön SQL-svit som matade in
svaret den skulle pröva. Och två av mina egna nya vakter var avstängda av ett
felaktigt escape-tecken. Grönt är inte samma sak som prövat.

---

## 1. Identifierade problem, severity, orsak, åtgärd, test

### F-1 · SSRF genom omdirigering — **HIGH** — ÅTGÄRDAD

| | |
|---|---|
| **Attackvektor** | Inloggad användare anger sin "webbplats". Servern slår upp värdnamnet, ser en publik adress, och hämtar. Angriparen pekar på sin **egen publika** server som svarar `302 Location: http://169.254.169.254/latest/meta-data/`. |
| **Komponent** | `api/server/website.ts`, `POST /v1/sources/website` |
| **Root cause** | SSRF-kontrollen kördes på den adress användaren angav; själva hämtningen gjordes med `redirect: "follow"`, som följer vidare **utan ny prövning**. Kontrollen gällde alltså en annan adress än den som faktiskt hämtades. |
| **Åtgärd** | `redirect: "manual"` + egen hoppkedja (max 5). Varje `Location` prövas mot `hostArSaker()` med samma regel som första adressen; protokollbyte utanför http/https vägras; blockerad omdirigering ger samma neutrala fel som "gick inte att nå". |
| **Regressionstest** | `tests/sakerhet.ts`: omdirigering → molnmetadata, → internt värdnamn, → `file://`, slinga, samt att en **laglig** omdirigering mellan publika värdar fortfarande fungerar. Källkodsvakt: `redirect: "follow"` får inte återinföras. |

### F-2 · Hastighetsgränsen gick att kringgå — **HIGH** — ÅTGÄRDAD

| | |
|---|---|
| **Attackvektor** | Angriparen skickar `X-Forwarded-For: <slumpvärde>` och får en **färsk räknare per anrop**. Spärren på inloggningen (10 försök / 5 min) upphör i praktiken att finnas → obegränsad lösenordsforcering och credential stuffing. |
| **Komponent** | `api/server/rateLimit.ts` (`klientNyckel`) |
| **Root cause** | Funktionen tog **första** posten i `x-forwarded-for`. nginx sätter `$proxy_add_x_forwarded_for`, som **lägger till** den observerade adressen **sist** — den första posten är alltså exakt det klienten själv skrev. Nätverksisolering hjälper inte: anropet kommer via den betrodda proxyn. |
| **Åtgärd** | Räkna **från höger**, `TRUSTED_PROXY_HOPS` steg in (default 1 = nginx-sidovagnen). `0` ignorerar rubriken helt. En kedja kortare än antalet hopp faller tillbaka på socketadressen i stället för att gissa. Driftparametern kopplad i Helm (configmap + values). |
| **Regressionstest** | `tests/sakerhet.ts`: 50 förfalskade adresser ger **en** räknare, inte 50; 1 och 2 hopp; kort kedja; `hops=0`. `tests/rateLimit.ts` rättad — se anmärkning nedan. |

> **Anmärkning som hör till fyndet:** `tests/rateLimit.ts` **kodifierade buggen
> som förväntat beteende** ("klienten läses ur x-forwarded-for" → första
> posten). Sviten var grön medan spärren inte fanns. Tre assertions är
> omskrivna till korrekt beteende. Ett test som beskriver buggen är värre än
> inget test, eftersom det ger falsk trygghet.

### F-3 · Säkerhetsrubriker tappades på appdokumentet — **MEDIUM** — ÅTGÄRDAD

| | |
|---|---|
| **Attackvektor** | Klickkapning: hela appen (inklusive driftpanelen) gick att rama in på en främmande sajt. MIME-sniffning på `/assets/`. |
| **Komponent** | `deploy/frontend/nginx.conf.template` |
| **Root cause** | nginx **ärver inte** `add_header` ned i ett `location`-block som har egna `add_header`. `location = /index.html` och `location /assets/` sätter `Cache-Control` — och tappade därmed `X-Frame-Options`, `X-Content-Type-Options` och `Referrer-Policy`. Eftersom SPA-routingen internt omdirigerar till `/index.html` gällde det **det dokument användaren faktiskt laddar**. |
| **Åtgärd** | Rubrikerna upprepade i båda blocken, med `always`. |
| **Regressionstest** | `tests/sakerhet.ts` parsar nginx-mallen per `location`-block och kräver rubrikerna i vart och ett. |

### F-4 · CSP, HSTS och Permissions-Policy saknades — **MEDIUM** — ÅTGÄRDAD

| | |
|---|---|
| **Root cause** | CSP var medvetet uppskjuten ("ingressen äger den"), men ingressen satte den inte heller — alltså fanns den ingenstans. HSTS saknades helt. |
| **Åtgärd** | CSP med `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`. `'unsafe-inline'` tillåts för **stil** (Tailwind) och för den runtime-konfig nginx skjuter in — **inte** för fjärrskript. HSTS 2 år med `includeSubDomains`. Permissions-Policy stänger kamera/mikrofon/plats/betalning/USB. |
| **Regressionstest** | `tests/sakerhet.ts` kräver CSP, `frame-ancestors`, HSTS och Permissions-Policy i mallen. |

### F-5 · Luckor i adresslistan för SSRF — **MEDIUM** — ÅTGÄRDAD

| | |
|---|---|
| **Attackvektor** | `::ffff:169.254.169.254` (IPv4 avbildad i IPv6) passerade som "publik" — samma metadata-endpoint, annan stavning. Även CGNAT `100.64/10` och `0.0.0.0/8` (bara exakt `0.0.0.0` fångades). |
| **Åtgärd** | Avbildad IPv4 normaliseras till sin IPv4-form före prövning. Tillagt: `0/8`, `100.64/10`, `192.0.0/24`, `192.0.2/24`, `198.18/15`, multicast `224+`, IPv6 `::`. ULA-kontrollen skärpt till `fc00::/7`-mönster i stället för prefixmatchning på sträng. |
| **Regressionstest** | `tests/sakerhet.ts`: 19 privata adresser blockeras, 4 publika tillåts. |

### F-6 · Oanvänd XSS-sänka i trädet — **LOW** — ÅTGÄRDAD

| | |
|---|---|
| **Komponent** | `src/components/ui/chart.tsx` (shadcn-ställning) |
| **Root cause** | `dangerouslySetInnerHTML` i en komponent **ingen sida importerade**. Innehållet kom från utvecklarkonfig, inte användardata — men en oanvänd sänka är en sänka som väntar på sin första användare. |
| **Åtgärd** | Filen borttagen (samma resonemang som `react-day-picker`/`vaul` tidigare). Bygget verifierat efteråt. |
| **Regressionstest** | `tests/sakerhet.ts` kräver att filen är borta. |

### F-7 · Presigneringens behörighetskontroll var otestad — **MEDIUM (testgap)** — ÅTGÄRDAD

| | |
|---|---|
| **Root cause** | `api/tests/run.sh` satte inte `DOCUMENTS_BUCKET`. Rutten `GET /v1/documents/{id}/url` kortslöt därför på "lagringen är inte ansluten" **innan** `app.may_read_document()` — behörighetsprövningen på den farligaste rutten i API:t kördes aldrig, och såg grön ut. |
| **Åtgärd** | `DOCUMENTS_BUCKET` sätts i testkörningen; hälsokontrollen i sviten kräver `storage: true` så att gapet inte kan återuppstå tyst. |
| **Regressionstest** | `api/tests/integration.ts`: utomstående får 404 utan URL och utan `storage_path`; oinloggad får 401. |


### H-1 · Databasrollen kunde stänga av radskyddet tyst — **HIGH** — ÅTGÄRDAD (rond 2)

| | |
|---|---|
| **Attackvektor** | Ingen angripare behövs — en felpekad `DATABASE_URL` räcker. Pekas den på superanvändaren, på tabellernas ägare eller på en roll med `BYPASSRLS` **fortsätter varje fråga att fungera** och börjar returnera andra bolags insolvensdata. Ingenting kraschar, ingen logg blir röd. |
| **Root cause** | Ingenting prövade rollen. `withUser()` byter till `authenticated` per transaktion, men `withAnon()` gör det **inte** — den kör som anslutningens egen roll (funktionerna där är SECURITY DEFINER). Är den rollen ägaren skriver t.ex. kontaktformuläret förbi kolumnrättigheterna. |
| **Åtgärd** | `provaDatabasroll()` frågar `pg_roles`/`pg_class`: superanvändare, `BYPASSRLS`, ägda tabeller i `public`/`auth`/`app`. `kravSakerDatabasroll()` körs i `main.ts` **före `listen()`** och avslutar processen med kod 1 och ett besked om vad som ska ändras. Undantag endast via uttrycklig `ALLOW_UNSAFE_DB_ROLE=1` (sviterna) — chartet får aldrig sätta den. |
| **Regressionstest** | `api/tests/integration.ts` mot **riktig Postgres**, båda utfallen: superanvändaren nekas med skäl, en driftlik roll (login, medlem i `authenticated`, äger inget) godkänns, `app_worker` (BYPASSRLS) nekas. `tests/sakerhet.ts` vaktar ordningen i `main.ts` och att chartet aldrig sätter undantaget. |
| **Verifierat i drift** | Ja, end-to-end mot byggd `server.cjs`: superanvändare → vägrar starta, exit 1, tre skäl utskrivna. Driftlik roll → startar, loggar rollnamnet, `/v1/health` svarar 200. |

### H-2 · Loggen skrev frågans parametervärden — **MEDIUM** — ÅTGÄRDAD (rond 2)

| | |
|---|---|
| **Attackvektor** | Ingen direkt — men loggen är en kopia av produktionen som hamnar på ställen produktionen inte gör (filer, insamlare, supportbilagor) och bevakas sällan lika hårt. |
| **Root cause** | `console.error("api error", error)` skrev hela felobjektet. Ett `pg`-fel bär `query` **och** `parameters` — alltså den SQL som kördes och de **värden** som skickades in. Ett fel i inloggningen kunde därmed skriva ett lösenordsförsök till loggen; ett fel i sessionsuppslaget en token-hash. |
| **Åtgärd** | `api/server/logg.ts`: strukturen behålls (felkod, villkor, tabell — det som faktiskt hjälper vid felsökning), värdena maskeras. Fältnamn (`password`, `token`, `parameters`, …) maskeras på alla djup; mönster (våra `clr_`-nycklar, Anthropic-nycklar, AWS-id, JWT, sha256, anslutningssträngar, e-postadresser) maskeras även mitt i fritext. Djupgräns så en cyklisk struktur inte kan hänga loggningen. |
| **Regressionstest** | `tests/sakerhet.ts`: felkod och villkor finns kvar, medan parametervärden, lösenordshash och e-postadress är borta; cykliska objekt hanteras; källkodsvakt mot att ett rått felobjekt loggas igen. |


### H-3 · Driftåtgärder lämnade inga spår — **MEDIUM** — ÅTGÄRDAD (rond 2)

| | |
|---|---|
| **Attackvektor** | En komprometterad eller illojal driftsession kunde byta Creditsafe-nyckeln, ändra en byrås prisplan, slå på kreditspärren eller stänga ett konto — **utan att något gick att härleda efteråt**. "Vem bytte nyckeln i tisdags?" gick inte att svara på. |
| **Root cause** | Ärendenivån var spårad (triggers på uppgifter, inbjudningar, beslut), men de mest privilegierade operationerna skrev ingenting till `audit_events`. En behörighet utan spår är en behörighet ingen kan granska. |
| **Åtgärd** | `app.logga_driftatgard()` (SECURITY DEFINER, kräver `is_platform_admin`) skriver till `audit_events` med `case_id null` i **samma transaktion** som åtgärden — en åtgärd utan spår, och ett spår utan åtgärd, är båda omöjliga. Nio åtgärder kopplade. Namnrymden `drift.*` skiljer dem från trigger-händelser som råkar sakna ärende. Ny läsrutt `GET /v1/ops/audit`. Spåret bär **aldrig** hemligheten — bara leverantörsnamnet och vad som ändrades. |
| **Regressionstest** | `api/tests/integration.ts` mot riktig Postgres: åtgärden syns, **hemligheten finns inte i spåret**, vem och när står där, en icke-administratör ser ett tomt spår och kan inte skriva i det, och en skriven rad går inte att ändra eller radera — inte ens av drift. |


### H-4 · Filuppladdningen litade på klientens påstående — **HIGH** — ÅTGÄRDAD (rond 4)

| | |
|---|---|
| **Attackvektor** | En uppladdning bär tre påståenden från avsändaren: filnamnet, ändelsen och Content-Type. Alla tre är fritext hen väljer. En Linux-binär (`ELF`) eller Windows-exe (`MZ`) som heter `arsredovisning.pdf` och skickas som `application/pdf` såg i alla tre likadan ut som en årsredovisning. Även SVG med `<script>`, polyglotter och dubbla ändelser (`rapport.pdf.exe`) passerade. |
| **Root cause** | Ingen innehållskontroll fanns någonstans. Saneringen av filnamnet skedde dessutom i **webbläsaren** — alltså hos den som angriper. Den enda server-side-gränsen var storage-policyns sökvägsprefix, som säger *var* filen får ligga men ingenting om *vad* den är. |
| **Åtgärd** | `api/server/filtyper.ts`: **tillåtelselista** med magiska bytes (PDF, PNG, JPEG, XLSX, DOCX + textformat som prövas tvärtom — inga styrbytes, ingen märkspråksinledning). SVG, arkiv, körbara filer och okända ändelser avvisas. Uppladdningen sker i **två steg**: servern väljer sökvägen och signerar en kortlivad PUT (klienten kan bara skriva till sitt eget ärendes prefix), och i steg 2 **läser servern tillbaka filens första bytes ur lagringen** och prövar signaturen mot utlovad typ samt den **lagrade** storleken. Godkänns den inte tas filen bort och raden raderas. Ny kolumn `confirmed_at`: en obekräftad fil syns inte i listan och `app.may_read_document()` säger nej till den — annars hade steg 2 varit valfritt. |
| **Regressionstest** | `tests/filtyper.ts` (45 kontroller): ELF/PE med `.pdf`, SVG i tre förklädnader, polyglott, dubbla ändelser, csv som är HTML eller binärt, zip/tar.gz, storleksgränsen, samt att de **sex riktiga formaten fortfarande går igenom**. Sökvägsbyggaren prövas mot `../`, absoluta sökvägar och backslash. `api/tests/integration.ts`: obekräftad fil ger ingen signerad URL och syns inte i listan, en utomstående kan varken påbörja eller bekräfta, och SVG/skalskript/orimlig storlek nekas redan i steg 1. |
| **S3-vägen (rond 5)** | **VERIFIERAD mot den riktiga AWS-SDK:n över riktig HTTP** (`tests/lagring.ts`, 28 kontroller): en S3-kompatibel server reses i processen, och hela kedjan körs — presignerad PUT (signerad, kortlivad, path-style), HEAD som ger den **lagrade** storleken, intervall-GET som ger **exakt de bytes som skrevs**, och DELETE. Det avgörande fallet körs skarpt: en Linux-binär laddas upp genom en giltig presignerad URL som `arsredovisning.pdf` → **avvisas och tas bort ur hinken**. Ett riktigt PDF går hela vägen, och nedladdnings-URL:en (60 s, med `content-disposition`) returnerar filen byte för byte. |
| **Kvar** | **MinIO:s egna egenheter är NOT VERIFIED** — en S3-dubbel är inte MinIO, och den skillnaden går bara att stänga genom att köra mot en riktig MinIO. Miljön här har varken docker-daemon eller nätåtkomst till `dl.min.io`. Klientadaptern går ännu den gamla vägen; cutover är ett driftbeslut. |

**Tre buggar i mitt eget arbete, hittade av sviten och rättade:** `create or replace` med ny signatur **ersatte inte** den gamla `may_read_document(uuid)` utan skapade en andra — anropet blev tvetydigt (42725) och fyra rutter slutade fungera. Förhandskontrollen i steg 1 körde `provaFil()` med tom byteslista, vilket gav "Filen är tom" på allt och gjorde sållet verkningslöst (nu `provaMetadata()`). Och två testfixturer skapade dokument utan `confirmed_at` och blev därmed osynliga — vilket var filtret som fungerade, inte ett fel i det.

---

### H-5 · Telefonverifieringen bevisade ingenting — **HIGH** — ÅTGÄRDAD (rond 6)

| | |
|---|---|
| **Attackvektor** | Ett vanligt konto, DevTools öppna. Verifieringskoden **slumpades i webbläsaren**, hashades i webbläsaren, och både hashen och den färdiga SMS-texten skickades in som argument (`start_phone_verification(nummer, HASH)` + `queue_verification_sms(TEXT)`). Angriparen kunde alltså välja koden själv, aldrig läsa något SMS, och bekräfta direkt. Utfallet: ett "verifierat" nummer som tillhör **någon annan** — och som därefter får SMS om att någon har ett ärende hos CLEARANCE. Det är precis den uppgift produkten finns för att skydda. |
| **Root cause** | En rimligt klingande regel drev fram fel protokoll: *"databasen ska aldrig se klartexten"*. Den höll inte ens i den gamla koden — SMS-texten, med koden i sig, gick in som argument och landade i `outbound_sms.body`. Databasen såg alltså redan klartexten, bara på ett ställe där ingen letade. Och när koden föds hos den som ska bevisa något med den, bevisar den ingenting. Detta är exakt "frontend-säkerhet är inte en säkerhetsmekanism", i sin renaste form. |
| **Åtgärd** | Migration `20260822100000`: `start_phone_verification(p_e164, p_ttl_minutes)` **föder koden i databasen** (`gen_random_bytes`, inte `random()`), lagrar bara SHA-256-hashen, komponerar SMS-texten och köar den — allt i **en** transaktion. Anroparen får `void`. Gamla treargumentsformen **droppas** (inte `create or replace` — en ny signatur hade lämnat den gamla vägen öppen bredvid den nya), och `queue_verification_sms(p_body)` tas bort helt: en "skicka den här texten till mitt nummer"-funktion är en text angriparen skriver. `confirm_phone_verification` tar numera klartexten och jämför mot hashen inne i funktionen. Taket (fem koder per nummer och timme) flyttade med. **Rättningen ligger i databasen, inte i API:t** — den gäller därför varje väg in: eget API, PostgREST och psql. `generateCode()`/`hashCode()` är borta ur det delade klientbiblioteket. |
| **Regressionstest** | `supabase/tests/notifications.sql`: koden läses **ur `outbound_sms`** — testet får inte veta den i förväg (det gamla testet matade in svaret och prövade därför ingenting). Bevisar att SMS:ets kod och radens hash hör ihop, att fel kod nekas, att rätt kod verifierar och bränns, att två begäranden ger **olika** koder, att fem fel bränner koden, och att den gamla signaturen samt `queue_verification_sms` **inte finns kvar i katalogen**. `api/tests/integration.ts` kör hela flödet genom API:t: koden finns ingenstans i svaret, numret kommer tillbaka maskerat, fast nummer/felformat nekas server-side, alla sju rutter kräver inloggning. `tests/sakerhet.ts`: källvakter mot återfall (inget `getRandomValues`/`subtle.digest` i telefonbiblioteket, ingen `p_code_sha256` i någon adapter, svarskropparna ordagrant `{ sent: true }` och `{ verified }`). |

**En bugg i mitt eget arbete, hittad av sviten:** `lpad()` tar text, inte `bigint` — funktionen föll på 42883 vid första riktiga anropet. Och två vakter i `tests/sakerhet.ts` var i praktiken avstängda: `\b` hade blivit ett backsteg (0x08) i regexen, så de matchade aldrig. `npm run lint` fångade kontrolltecknet; efter rättningen blev båda **röda** och fick skrivas om — den ena läste prosan i en kommentar, den andra förbjöd ordet `code` även där rutten med rätta *tar emot* en kod.

---

## 2. Revisioner per område

### Secrets
- Ingen `.env` har **någonsin** committats (`git log --diff-filter=A`, hela historiken). Endast `.env.example`.
- Mönstersökning över **alla** blobbar i historiken (Anthropic-, AWS-, GitHub-, Slack-nycklar, privata nycklar, JWT): **noll träffar**.
- Frontend bär bara `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` (anon-nyckel, publik med flit — RLS är gränsen). Inga serversecrets i `src/`.
- Nyckelvalvet: hemligheter lagras i `integration_secrets` via `set_integration_secret` (SECURITY DEFINER, admin-gatad) och kan **aldrig läsas tillbaka** — bara fyra sista tecken + bytesdatum. Verifierat i `api/tests` (21 kontroller).
- **Utestående (organisatoriskt):** Claude-API-nyckeln som klistrades in i den här sessionen ska **roteras**. Den committades aldrig, men ska betraktas som exponerad.

### Autentisering
- scrypt, OWASP-parametrar (N=2^15, r=8, p=1, 64 MiB), salt per lösenord, hashen bär sina egna parametrar. Tidskonstant jämförelse.
- Sessionstoken = 32 slumpbytes, lagras **bara** som SHA-256. En databasdump är inte en samling fungerande sessioner. Verifierat.
- Utloggning återkallar server-side. Utgångstid och `disabled_at` prövas vid varje uppslag.
- Inloggningen: samma svar för okänt konto och fel lösenord (ingen kontolista), dummy-hash mot tidsläckage, hårdare tak (10/5 min).
- Identiteten sätts **transaktionslokalt** (`set_config(..., true)`) — prövat under samtidighet: `api/tests` kör växlade requests genom samma pool och kräver noll läckage.

### Auktorisation
- 73 rutter inventerade. **3** utan autentisering, alla avsiktliga: `/v1/health`, `/v1/auth/login`, `/v1/shared/{token}` (token *är* referensen, prövas i databasfunktion). `/v1/contact` har valfri auth med flit.
- Ingen rutt gör sin egen administratörsbedömning: gränsen bor i RLS och i SECURITY DEFINER-funktioner. En icke-admin får 409/403/tom lista — aldrig data.
- **Adversariellt svep:** en angripare med giltigt konto och känt ärende-id prövas mot **14 läsvägar** och **8 skrivvägar** på ett främmande ärende. Inget läcker; ärendet är orört efteråt.
- Masstilldelning: `role`/`userId` i kroppen ignoreras (profil); `status`/`user_id`/`handled_by` sätts av servern (kontakt). Verifierat mot databasen efteråt.

### Databas / RLS
- **Noll** strängkonkatenering i SQL i `api/` och `db/worker/` — allt parametriserat.
- RLS-sviten: 253 kontroller, gröna i **båda** miljöerna (Supabase-shim och ren självhostad Postgres).
- API:t kör som `authenticated` — varken tabellägare eller `BYPASSRLS`. Endast den betrodda batchrollen `app_worker` har `BYPASSRLS`, prövat i `db/tests/roles.sql`.
- Storage: policy på `storage.objects` kräver `has_case_access`/`can_write_case` på **första sökvägssegmentet**, plus DB-constraint `storage_path like case_id || '/%'`.

### Filuppladdning
- Filnamn saneras till `[a-zA-Z0-9._-]`, sökvägen är `{caseId}/{uuid}-{namn}` — inget användarstyrt segment, `upsert: false`.
- Server-side gräns: storage-policy + constraint (ovan). Path traversal blockerad.
- **NOT VERIFIED:** MIME-/magic-byte-kontroll, storleksgräns och arkivskydd server-side. Uppladdning är ännu inte migrerad till eget API (`documents.upload` går mot Supabase Storage); den kontrollen hör till den migreringen.

### API
- Kroppsgräns 1 MiB. Ingen CORS-rubrik alls (samma-origin-design; nginx proxar `/v1`) — ingen `Access-Control-Allow-Origin: *` någonstans.
- Fel: generiskt 500 utåt, detaljer bara i serverloggen. Inga stackspår, sökvägar eller SQL i svaren. Kända databaskoder mappas (42501→403, 23xxx→400, P0001→409 med den avsiktliga svenska texten).
- Kontraktsdrift vaktad: varje `/v1/...`-rutt måste vara deklarerad i OpenAPI (269 kontroller).

### Webhooks
- **EJ TILLÄMPLIGT.** Systemet tar inte emot några inkommande webhooks. Utgående e-post går via en utkorgstabell, inte via inkommande anrop. Om en webhook införs gäller punkt 11 i uppdraget och måste byggas då.

### Beroenden
- 2 rådgivningar, **båda i byggkedjan**: `esbuild` (moderate, dev-server) och `vite` (high — sökvägstraversering i optimized deps, Windows-specifika `fs.deny`-bypass, launch-editor NTLM). Ingen av dem når produktionsartefakten (statiska filer + `server.cjs`).
- Produktionsberoenden: `npm audit --omit=dev --audit-level=critical` är nu **grind i CI**.
- react-router-rådet tidigare löst genom uppgradering (dokumenterat i `SECURITY.md`), låst av `tests/beroenden.ts`.

### Infrastruktur / deployment
- Podar: `runAsNonRoot`, `readOnlyRootFilesystem`, alla capabilities släppta, `seccompProfile: RuntimeDefault`. NetworkPolicy default-deny.
- TLS termineras i ingressen med cert-manager; HSTS sätts nu av ursprunget.
- Migrationsjobbet kör som superanvändare i en Helm-hook, skild från API-rollen.
- **Uppstarten vägrar en databasroll som stänger av radskyddet** (H-1) — verifierat end-to-end.
- **Driftåtgärder är spårade** (H-3): vem, vad, när — utan att hemligheten hamnar i spåret.
- CI-grinden `sakerhet` blockerar bildbygget (`needs: [prova, sakerhet, databas]`).

---

## 3. Testresultat

| Svit | Resultat |
|---|---|
| `test:sakerhet` (ny) | **59 / 59** |
| `test:api` (mot riktig Postgres) | **278 / 278** (+34 adversariella) |
| `test:granser` (rateLimit, rättad) | **9 / 9** |
| `test:apispec` (kontraktsdrift) | **269 / 269** |
| `test:webbplats` | **34 / 34** |
| `test:dataskydd` | **40 / 40** |
| RLS, båda miljöerna | **253 / 253** |
| `test:sakerhet` efter rond 2 | **84 / 84** |
| `test:api` efter rond 4 | **306 / 306** |
| `test:filtyper` (ny, rond 4) | **45 / 45** |
| `test:lagring` (ny, rond 5) | **28 / 28** — S3-vägen mot riktig SDK över riktig HTTP |
| `test:sakerhet` efter rond 6 | **100 / 100** |
| `test:api` efter rond 6 | **349 / 349** (mot riktig Postgres) |
| `test:apispec` efter rond 6 | **432 / 432** — vakten prövar numera METOD, inte bara sökväg |
| `test:api` efter rond 7 | **400 / 400** |
| `test:api` efter rond 8 | **445 / 445**, gröna även med `TZ=Europe/Stockholm` |
| `test:apispec` efter rond 8 | **461 / 461** |
| `test:aviseringar` efter rond 6 | **191 / 191** |
| RLS mot ren självhostad Postgres | **alla sviter PASSED** med de nya migrationerna |
| Uppstartsspärren, end-to-end | **verifierad** (osäker roll → exit 1; säker roll → 200) |
| Övriga sviter | gröna (se nedan) |

**De två pre-existerande designtoken-felen i `test:spacing` är rättade** (rond 6):
`ProUpgradeOffer.tsx` bröt mot projektets egna regler om hörnradie och versaler.
Hela batteriet är grönt: rena sviterna, `test:api`, RLS i **båda** miljöerna,
alla fyra byggen, `typecheck` och `lint`.

---

## 4. Kvarvarande risker

| # | Risk | Severity | Status |
|---|---|---|---|
| R-1 | **Ingen körande miljö har prövats.** All verifiering är gjord mot källkod, mallar och en lokal Postgres. Ingress-TLS, faktiska svarsrubriker, HSTS-leverans och nätverkspolicyer är **NOT VERIFIED** mot ett riktigt kluster. | HIGH | Blockerande |
| R-2 | ~~Filuppladdningens innehållskontroll saknas.~~ **BYGGD OCH PRÖVAD (H-4), S3-vägen verifierad mot riktig SDK (rond 5).** Kvar: MinIO:s egenheter, och att koppla om klientadaptern. | LOW | Byggd och prövad; cutover kvarstår |
| R-3 | **`TRUSTED_PROXY_HOPS` måste matcha den faktiska kedjan.** Sätts fel (t.ex. 1 när det finns två mellanled) blir hastighetsgränsen antingen kringgåbar eller för trubbig. Default 1 stämmer med chartet; en extra ingress-hop kräver 2. | MEDIUM | Kräver driftbeslut |
| R-4 | **Halvmigrerad datamodell.** 49 av 139 `DataPort`-metoder går fortfarande mot Supabase med anon-nyckel i frontend. Säkerheten vilar där helt på RLS (253 gröna kontroller), men två backends innebär två uppsättningar policyer att hålla i synk. | MEDIUM | Arkitekturskuld |
| R-5 | **Ingen MFA och ingen omautentisering** för känsliga driftåtgärder (nyckelvalv, prisplaner, kontostängning). Punkt 21 i uppdraget kräver det "där lämpligt". | MEDIUM | Ej byggt |
| R-6 | ~~Ingen loggredaktion.~~ **ÅTGÄRDAD (H-2).** Kvar: loggarna bör läsas i skarp drift en gång för att bekräfta att inget oväntat fält dyker upp. | LOW | Åtgärdad, drift-granskning kvarstår |
| R-7 | Claude-API-nyckeln från den här sessionen **ska roteras**. | MEDIUM | Organisatoriskt |
| R-9 | **SMS-kostnaden är taket, inte identiteten.** Verifieringen bevisar numera innehav av telefonen, men taket (fem koder per nummer och timme) är fortfarande det enda som står mellan ett konto och en räkning. Ett globalt tak per konto och per dygn bör sättas innan SMS aktiveras skarpt. | LOW | Ej byggt |
| R-8 | `vite`/`esbuild`-råden kvarstår i byggkedjan. Utvärderade som ej produktionsnära, men bygg-CI:n kör `vite build` — en komprometterad byggmiljö är en annan sak än en komprometterad produkt. | LOW | Accepterad, dokumenterad |

---

## 5. Vad som krävs för SECURITY READY

1. **R-1:** kör en skarp miljö och verifiera faktiska svarsrubriker (CSP, HSTS,
   X-Frame-Options på `/` och `/index.html`), TLS-konfiguration, HTTP→HTTPS-
   omdirigering och att API:t **inte** går att nå förbi nginx.
2. **R-2:** bygg uppladdningen i eget API med magic-byte-kontroll, storleksgräns
   och avvisning av arkiv/SVG — med test som visar att en förklädd fil nekas.
3. **R-3:** fastställ antalet mellanled i den faktiska ingressen och sätt
   `trustedProxyHops` därefter; verifiera med ett anrop som bär förfalskad rubrik.
4. **R-5:** besluta om MFA/omautentisering för driftpanelen.
5. **R-6:** granska loggarna i drift och inför redaktion.

Punkterna 1–3 är blockerande. Så länge de står öppna är slutstatus
**SECURITY NOT READY** — inte för att något känt hål står öppet, utan för att
uppdraget kräver att "kan inte verifieras" märks som just det.
