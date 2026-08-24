# Dataskydd — underlag för DPIA, behandlingsregister och underbiträden

> **STATUS: UNDERLAG.** Det här är ett tekniskt/organisatoriskt underlag skrivet av utvecklingen för att ge DPO/jurist ett försprång. Det är **inte** en färdig DPIA och **inte** juridisk rådgivning. Innan driftsättning ska en jurist/DPO granska, komplettera och besluta. Punkter märkta **[ÖPPET]** kräver beslut eller avtal.

## 1. Roller
- **Personuppgiftsansvarig:** Landvex AB (org.nr 559141-7042), produkt Clearance.
- **Personuppgiftsbiträden (underbiträden):** se avsnitt 4.

## 2. Varför en DPIA sannolikt krävs
Behandlingen når flera av kriterierna för hög risk: (a) **känslig och utsatt målgrupp** — företrädare för bolag i akut ekonomisk kris, (b) **ekonomiska uppgifter** och ärendehistorik som kan skada den registrerade om de röjs, (c) **ny teknik** (modell-driven samtalsmotor), (d) potentiellt **storskalig** och systematisk behandling. Slutsats i underlaget: **DPIA bör genomföras före skarp pilot.** [ÖPPET: DPO bekräftar.]

## 3. Behandlingsregister (utkast)
| Kategori av registrerade | Personuppgifter | Ändamål | Rättslig grund (förslag) |
|---|---|---|---|
| Företrädare (ägare/VD/styrelse) | Namn, e-post, telefon, roll | Konto, ärendehantering, avisering | Avtal (art. 6.1.b) |
| Användare i samtalet | Fritext de själva skriver (kan innehålla känsliga uppgifter om ekonomi/personer) | Vägledning i samtalet | Avtal / berättigat intresse (art. 6.1.b/f) |
| Rådgivare/praktiker | Kontakt- och yrkesuppgifter, tidsposter | Katalog, samarbete, fakturering | Avtal / berättigat intresse |
| Mottagare av delade ärenden | E-post, åtkomstlogg | Säker delning, spårbarhet | Berättigat intresse |

Särskilda kategorier (art. 9) samlas inte in avsiktligt; fritextfält kan dock råka innehålla sådant → se dataminimering och användarinstruktion. [ÖPPET: bedöm art. 9-risk i fritext.]

## 4. Underbiträden (subprocessors) — att avtala (DPA) före drift
> Detaljerat register med per-part-krav, dataregion, ZDR/retention och en signeringskolumn: **`docs/subprocessors-dpa.md`**. Tabellen nedan är sammanfattningen.
| Underbiträde | Funktion | Dataregion (att bekräfta) | Krav |
|---|---|---|---|
| **Vercel** | Hosting: app, API och schemalagda jobb | Funktionerna i Stockholm (`arn1`), satt i `vercel.json` | DPA; bekräfta var loggar och kontrollplan behandlas |
| **Databasleverantören** | All ärende- och kontodata i vila | **[ÖPPET]** — väljs vid driftsättningen, ska vara EU | DPA, EU-region, kryptering i vila, prövad återställning |
| **AWS (S3)** | Dokumentlagring | EU (`eu-north-1`) **[ÖPPET — bekräfta]** | DPA, EU-region, privat hink |
| **Anthropic** | Samtalsmotorn (CLEARANCE) | **[ÖPPET: EU-residens/ZDR]** | Signerad DPA, **nolldataretention (ZDR)** på kontonivå, ingen träning på våra data |
| **Google (Places API)** | Bolagsuppslag (adress/omdömen/status) | **[ÖPPET]** | Villkor: cache ≤30 dagar, attribution. Skickar bolagsnamn/ort — undvik personuppgifter i frågan |
| SMS-leverantör | Premium-aviseringar | **[ÖPPET]** | DPA; skicka minsta möjliga i meddelandet |
| Kreditupplysning (Creditsafe e.d.) | Kreditunderlag | SE/EU | Avtal + rättslig grund; kreditupplysningslagen |
| Supabase (om kvar som brygga) | Datalager i övergången | **[ÖPPET]** | DPA; fasas ut mot det egna API:t |

## 5. Dataminimering & tekniska skydd (implementerat i koden)
- **Samtalsmotorn skickar ENBART** det synliga samtalet + systemprompten till modellen. **Ingen** `metadata`/user_id, **ingen** ärendedata, inget om bolaget utöver det användaren själv skrivit. (`server/anthropic.ts`, vaktat i `tests/anthropic.ts`.)
- **Innehållet loggas aldrig** server-sidan — bara statuskoder. (Vaktat i test.)
- **`storage_path` lämnar aldrig servern** — dokument nås via signerad URL efter `app.may_read_document()`.
- **API-nycklar lagras endast som SHA-256**; sessionstokens aldrig i klartext.
- **Lösenordet krävs igen före det som inte går att ångra.** En session bevisar att någon loggade in en gång, inte att det är samma människa som sitter där nu. `POST /v1/me/erasure` (radering) och `POST /v1/api-keys` (mynta en nyckel som överlever sessionen) prövar lösenordet mot hashen i databasen, per anrop, med ett eget tak räknat på **kontot** och inte på klientadressen. Att återkalla en nyckel kräver det däremot inte - bekräftelser hör hemma före det som ökar en angripares räckvidd, inte före det som minskar den. (`confirmPassword` i `server/index.ts`, vaktat i `tests/sakerhet.ts`.)
- **Transaktionslokal identitet** + **RLS** i databasen; API kör som `authenticated`, aldrig ägare/BYPASSRLS.
- Hemligheter (`ANTHROPIC_API_KEY`, `GOOGLE_MAPS_API_KEY`, `DATABASE_URL`, `CRON_SECRET`) som **miljövariabler i Vercel**, aldrig i frontend-bunten. Utan `CRON_SECRET` är de schemalagda jobben avstängda - stängt, inte öppet.
- **Dataminimering vid fritext:** en kort påminnelse står intill fritextfälten (samtalet, onboardingen) om att inte dela fler personuppgifter än läget kräver — motmedel mot art. 9-uppgifter i fritext. (`src/lib/dataMinimering.ts`, vaktat i `tests/dataskydd.ts`.)
- **Regelaktualitet i samtalet:** modellen får aldrig påstå en specifik frist, ett belopp eller ett gränsvärde som säkert gällande, utan hänvisar till primärkälla eller en människa. (`server/anthropic.ts`, vaktat i `tests/anthropic.ts`.)

## 6. Lagring & gallring — policy satt i kod
Gallringspolicyn är **satt och utförd**: en tid och en åtgärd per kategori i `src/lib/retention.ts`, med tiderna som **driftparametrar** (app_settings, nyckeln `retention_policy`) och åtgärden (radera / anonymisera / behåll) medveten per kategori. Utförandet ligger i `app.gallra(kategori, brytdatum, torrkörning)` (migration `20260825100000`), en gren per kategori, stängd för klientrollerna och prövad i `db/rls-tests/gallring.sql` och `db/rls-tests/radering.sql` i båda databasmiljöerna — varje gren körs skarpt mot riktiga rader, och proven kräver både att det som skulle försvinna försvann OCH att resten står kvar. Driftpanelen visar policyn ärligt (RetentionSection), och workern kör den via `--gallra`.

Driftparametern valideras innan den sparas (`retentionOverrideProblems`): negativa eller icke-heltaliga månader avvisas med 400, liksom en raderande kategori utan tidsgräns och ett kategori-id som inte finns. Skälet är konkret: ett negativt antal månader ger ett brytdatum i **framtiden**, och ett brytdatum i framtiden matchar allt. Sammanslagningen faller dessutom tillbaka på standarden för varje fält den underkänner, så inte heller en rad skriven direkt i databasen kan göra gallringen till en tömning; workern skriver ut vad som avvisades i stället för att tyst köra standarden.
- **Skuggläge som default:** en kategori som inte är påslagen körs som **torrkörning** — samma fråga, raderna räknas, ingenting ändras. Skuggsiffran är därför den siffra som faktiskt kommer att gallras den dag kategorin slås på, och det prövas: provet kräver att torrkörningen och den skarpa körningen ger samma tal. Bara hastighetsgränsens sekundfärska teknikrader gallras skarpt från start.
- Aktiva ärenden: bevaras under uppdraget.
- Avslutade ärenden: kontaktuppgifter anonymiseras efter satt tid (standard 24 mån, driftparameter). **[ÖPPET: DBA bekräftar tid mot bokförings-/preskriptionskrav och aktiverar kategorin.]** Funktionen finns och är prövad; det som återstår är beslutet om tiden.
- Samtalsloggar/journal: anonymiseras i sedan länge avslutade ärenden (fritexten bort, posten/tidslinjen kvar). **[ÖPPET: DBA aktiverar kategorin.]**
- Händelseloggen: **behålls** för spårbarhet, gallras inte på tid (medvetet val i policyn).
- Modell-leverantör: **ZDR** så inget innehåll lagras hos underbiträdet. **[ÖPPET: aktivera på kontonivå.]**

## 7. Den registrerades rättigheter — byggt i produkten
En dataskyddssektion under Inställningar (`src/pages/DashboardSettings.tsx`, `src/components/settings/ErasureSection.tsx`) ger den registrerade tre raka vägar, vaktade i `tests/dataskydd.ts`:
- **Registerutdrag & dataportabilitet (art. 15, 20):** "Ladda ner mina uppgifter" bygger en maskinläsbar JSON lokalt i webbläsaren ur samma läsvägar appen använder (`src/lib/dataExport.ts`).
- **Rättelse (art. 16):** `RECTIFICATION_MAP` i `src/lib/erasure.ts` säger för varje uppgift var den ändras — och för dem som inte går att ändra själv (e-postadressen, händelseloggen, en bokförd faktura) både **varför** och **vilken väg** som finns i stället. Provet kräver att varje post har antingen en plats eller ett skäl och en väg.
- **Radering (art. 17):** självbetjäning, inte en kontaktblankett. `request_account_erasure()` registrerar begäran med sju dagars karenstid, `cancel_account_erasure()` tar tillbaka den, och `app.execute_due_erasures()` verkställer via `app.erase_user()` i **en transaktion** — allt i migration `20260825100000`, exponerat som `GET/POST/DELETE /v1/me/erasure`.

**Manifestet är löftet, i kod.** `ERASURE_MANIFEST` i `src/lib/erasure.ts` säger post för post vad som raderas, anonymiseras och behålls, med rättslig grund för varje undantag (bokföringslagen 7 kap. 2 § för fakturor; art. 17.3 e för händelseloggen och underskrifterna). `tests/dataskydd.ts` läser både manifestet och SQL:en och kräver att de täcker varandra i **båda riktningarna** — ingen utlovad radering saknas i koden, och ingen tabell rörs utan att stå i manifestet.

**Två arkitekturbeslut värda att känna till:**
- **Kontoraden raderas aldrig.** `cases.user_id` har `on delete cascade`; en borttagen rad hade tagit med sig delade ärenden och därmed rekonstruktörens underlag mitt i ett pågående ärende. E-post och lösenord byts mot en död platshållare (`@borttaget.invalid`) och kontot stängs. Ett ärende där ingen annan har behörighet raderas däremot i sin helhet.
- **Händelseloggen städas inte i efterhand — den maskeras vid skrivning.** Revisionstriggern lade en ögonblicksbild av hela den ändrade raden i `before`/`after`, och identifikatorer följde med; en radering loggade dessutom sin egen före-bild och skrev tillbaka adressen den nyss tagit bort. Loggen är append-only med en trigger som vägrar UPDATE för **varje** roll inklusive ägaren, och den garantin lämnades orörd. I stället maskerar `app.maska_personuppgifter()` kända identifikatorfält innan de skrivs. Rader skrivna före migrationen skrivs inte om — i en miljö som redan har sådana rader är det en kvarvarande brist och ska hanteras som en.

**[ÖPPET: fastställ svarstid (en månad enligt art. 12.3), utpekad ansvarig och en rutin för identitetskontroll av den som begär utdrag genom annan kanal än inloggningen.]** För radering genom produkten sker identitetskontrollen i två led: begäran kan bara göras för det egna kontot, och lösenordet krävs på nytt i samma anrop. Karenstiden på sju dagar skyddar mot ånger, inte mot en kapad session - den som har sessionen kan återkalla begäran lika lätt som hen gjorde den.

## 8. Öppna punkter före deploy (sammanfattning)

**Kräver människa/jurist (externt — kan inte byggas bort i kod):**
1. Signera DPA med Vercel, databasleverantören, AWS (S3), Anthropic, Google, SMS- och kreditupplysningsleverantör.
2. Bekräfta **EU-dataregion** för varje underbiträde; aktivera **ZDR** hos modell-leverantören.
3. Genomför och dokumentera **DPIA**.
4. Rättighetsprocessen: fastställ svarstid och ansvarig för utdragsbegäran som kommer via annan kanal än inloggningen (§7).
5. Gallringen: DBA bekräftar tiderna och **aktiverar** kategorierna. Funktionen som utför dem finns, är stängd för klientrollerna och prövad i båda databasmiljöerna (§6).

**Byggt i koden i den här omgången (se `docs/deploy-compliance.md`):**
- Gallringspolicy som driftparameter + `app.gallra()` med torrkörning som skuggläge (§6).
- Registerutdrag, dataportabilitet, rättelsekarta och självbetjänad radering med karenstid, manifest och rättslig grund per undantag (§7).
- Maskering av identifikatorer på väg in i den append-only händelseloggen (§7).
- Dataminimeringspåminnelse vid fritext och regelaktualitet i samtalet (§5).
