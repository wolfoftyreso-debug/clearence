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

Det som ÄR gjort: sex sårbarheter hittade och åtgärdade, varav två allvarliga
(SSRF-bypass och en verkningslös spärr mot lösenordsforcering), alla med
regressionstest som bevisar att angreppet blockeras. 59 nya säkerhetskontroller
och 34 nya adversariella API-kontroller, alla gröna.

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
| Övriga sviter | gröna (se nedan) |

**Två pre-existerande fel, orörda av det här arbetet och utan säkerhetsbetydelse:**
`test:spacing` — 2 designtoken-kontroller (hörnradie, versaler). Verifierat att de
föll likadant före ändringarna.

---

## 4. Kvarvarande risker

| # | Risk | Severity | Status |
|---|---|---|---|
| R-1 | **Ingen körande miljö har prövats.** All verifiering är gjord mot källkod, mallar och en lokal Postgres. Ingress-TLS, faktiska svarsrubriker, HSTS-leverans och nätverkspolicyer är **NOT VERIFIED** mot ett riktigt kluster. | HIGH | Blockerande |
| R-2 | **Filuppladdningens innehållskontroll saknas** (magic bytes, storlek, arkiv) server-side. Uppladdning går ännu mot Supabase Storage. | MEDIUM | Blockerande |
| R-3 | **`TRUSTED_PROXY_HOPS` måste matcha den faktiska kedjan.** Sätts fel (t.ex. 1 när det finns två mellanled) blir hastighetsgränsen antingen kringgåbar eller för trubbig. Default 1 stämmer med chartet; en extra ingress-hop kräver 2. | MEDIUM | Kräver driftbeslut |
| R-4 | **Halvmigrerad datamodell.** 70 av 139 `DataPort`-metoder går fortfarande mot Supabase med anon-nyckel i frontend. Säkerheten vilar där helt på RLS (253 gröna kontroller), men två backends innebär två uppsättningar policyer att hålla i synk. | MEDIUM | Arkitekturskuld |
| R-5 | **Ingen MFA och ingen omautentisering** för känsliga driftåtgärder (nyckelvalv, prisplaner, kontostängning). Punkt 21 i uppdraget kräver det "där lämpligt". | MEDIUM | Ej byggt |
| R-6 | **Ingen loggredaktion är verifierad.** `console.error("api error", error)` skriver hela databasfelet till loggen. Databasfel bär normalt inte lösenord, men parametervärden kan förekomma. | LOW | Ej granskat i drift |
| R-7 | Claude-API-nyckeln från den här sessionen **ska roteras**. | MEDIUM | Organisatoriskt |
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
