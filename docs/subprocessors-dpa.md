# Underbiträdesregister & DPA-checklista

> **STATUS: UNDERLAG.** Skrivet av utvecklingen för att ge DPO/jurist ett försprång inför drift. **Inte** juridisk rådgivning och **inte** ett färdigt avtal. Varje rad märkt **[ÖPPET]** kräver en underskrift, ett konto-/avtalsbeslut eller en myndighet — sånt kan inte byggas i kod. Det som är byggt i koden är utskrivet och pekar på filen som vaktar det.
>
> **Personuppgiftsansvarig:** Landvex AB (org.nr 559141-7042), produkt Clearance. Detta register hör ihop med `docs/dataskydd.md` (DPIA-underlag, behandlingsregister) och `docs/deploy-compliance.md` (P0/P1-checklistan).

## Hur registret används

1. För **varje** underbiträde nedan: teckna DPA, bekräfta dataregion, sätt retention/ZDR, och fyll i datum + ansvarig i kolumnen **Signerat**.
2. Ett underbiträde utan tecknad DPA får **inte** tas i skarp drift med riktiga personuppgifter. Flaggan/nyckeln i koden hålls av tills dess (se varje rad).
3. Registret ska hållas aktuellt: läggs ett nytt underbiträde till, läggs en rad till här *innan* det kopplas in.

Legend: 🟢 klart · 🟡 förberett i kod, avtal saknas · 🔴 ej påbörjat

---

## A. Var datan ligger

Tjänsten kör på **Vercel**. Funktionerna är låsta till Stockholm — `"regions": ["arn1"]` i `vercel.json`, vaktat av `tests/deploy.ts`. Databasen och dokumenthinken väljs vid driftsättningen och **ska sättas i EU**; det är ett konfigurationsbeslut, inte något koden kan tvinga fram. Transporten är TLS hela vägen.

> **ÄNDRING SEDAN FÖRRA VERSIONEN.** Registret sade tidigare att regionen var EU-låst i Terraform (`infra/variables.tf`, utdatan `data_residency_posture`). Terraform-beskrivningen är borttagen i och med flytten till Vercel. Det som nu **är** enforced i kod är funktionernas region; databasens och lagringens region kontrolleras för hand vid driftsättningen och ska bekräftas i tabellen nedan.

## B. Underbiträden — en rad per part

### 1. Vercel (hosting: appen, API:t, de schemalagda jobben, loggar)
- **Behandlar:** all ärende- och kontodata **i transit** genom funktionerna; funktionsloggar. Ingen kunddata lagras hos Vercel — den bor i databasen och i dokumenthinken.
- **Dataregion:** funktionerna kör i Stockholm (`arn1`), satt i `vercel.json` och vaktat av `tests/deploy.ts`. 🟢 (region) / 🔴 (DPA-underskrift)
- **Krav:** Vercel DPA accepterad på kontonivå; SCC:er för det Vercel behandlar utanför EU (kontroll- och loggplan kan ligga utanför — **bekräfta**); loggretention satt.
- **Kodhållhake:** ingen. Plattformen är förutsättningen, inte en valfri integration — därför är det här den rad som måste vara klar först. **[ÖPPET: acceptera Vercel DPA, bekräfta var loggar och kontrollplan behandlas.]**
- **Signerat:** _____ (datum / ansvarig)

### 1b. Databasleverantören (Vercel Postgres, Neon eller motsvarande)
- **Behandlar:** **all** ärende- och kontodata i vila. Det här är den känsligaste raden i registret.
- **Dataregion:** **[ÖPPET]** — väljs vid driftsättningen. Ska vara EU, helst Stockholm, av latensskäl såväl som dataskyddsskäl.
- **Krav:** DPA; EU-region bekräftad; kryptering i vila; säkerhetskopiering och point-in-time recovery påslaget och prövat.
- **Kodhållhake:** `sakerRollGrind()` i `server/db.ts` vägrar köra om `DATABASE_URL` pekar på en roll som kringgår radskyddet — men den kan inte veta *var* databasen står. 🔴
- **Signerat:** _____

### 1c. AWS S3 (dokumentlagring)
- **Behandlar:** uppladdade dokument — årsredovisningar, bokföring, avtal.
- **Dataregion:** sätts med `AWS_REGION` vid driftsättningen. Ska vara `eu-north-1`. **[ÖPPET: bekräfta.]**
- **Krav:** AWS DPA (GDPR-tillägget) accepterad på kontonivå; EU-region; privat hink; kryptering i vila.
- **Kodhållhake:** `storage_path` lämnar aldrig servern; klienten får en signerad, kortlivad URL och bara efter att `app.may_read_document()` sagt ja (`server/storage.ts`, prövat i `tests/lagring.ts`). En publik hink gör hela den modellen meningslös. 🟡
- **Signerat:** _____

### 2. Anthropic (samtalsmotorn bakom CLEARANCE)
- **Behandlar:** ENBART det synliga samtalet + systemprompten. **Ingen** metadata/user_id, **ingen** ärendedata, inget innehåll loggas. Byggt och vaktat i `server/anthropic.ts` / `tests/anthropic.ts`. 🟢 (dataminimering)
- **Dataregion / retention:** **[ÖPPET]** — EU-residens och **nolldataretention (ZDR)** sätts på **kontonivå**, inte i kod.
- **Krav:** signerad DPA; **ZDR aktiverad** (inget innehåll lagras hos underbiträdet); ingen träning på våra data; EU-endpoint där det erbjuds; annars SCC:er.
- **Kodhållhake:** motorn är fail-closed utan nyckel (`ANTHROPIC_API_KEY` som miljövariabel i Vercel). Slå inte på samtalet i skarp drift förrän DPA + ZDR är på plats. 🟡
- **Signerat:** _____

### 3. Google (Places API — webbadress, omdömen, verksamhetsstatus)
- **Behandlar:** bolagsnamn + ort i frågan (undvik personuppgifter i frågan); tar aldrig in recensenters namn/bilder (byggt, `src/lib/sources/google.ts`). Cache **≤30 dagar** och attribution i koden. 🟢 (dataminimering/villkor i kod)
- **Dataregion:** **[ÖPPET]** enligt Google Maps Platform-villkoren.
- **Krav:** acceptera Google Maps Platform-villkor + databehandlingsvillkor; bekräfta region/överföringsgrund.
- **Kodhållhake:** utan `GOOGLE_MAPS_API_KEY` är källan inte ansluten. Med flaggan av redovisas källan som ej ansluten, tjänsten fungerar. 🟡
- **Signerat:** _____

### 4. SMS-leverantör (premium-aviseringar)
- **Behandlar:** mottagarens telefonnummer + ett kort meddelande (skicka minsta möjliga). Numret lagras hos oss hashat vid verifiering, aldrig i klartext (byggt). 🟢 (minimering)
- **Dataregion:** **[ÖPPET]** — beror på vald leverantör.
- **Krav:** välj leverantör; teckna DPA; bekräfta EU-region; minimera meddelandeinnehållet.
- **Kodhållhake:** SMS-kanalen kräver en sparad leverantörsnyckel i driftpanelen; utan den är kanalen inte ansluten. 🟡
- **Signerat:** _____

### 5. Creditsafe (eller motsvarande kreditupplysning)
- **Behandlar:** organisationsnummer i frågan; kreditutfall sparas i `credit_monitoring`. Rör juridiska personer, men kan indirekt röra företrädare.
- **Dataregion:** SE/EU.
- **Krav:** avtal + rättslig grund; **kreditupplysningslagen** (bl.a. omfrågningskopia där den gäller); DPA om personuppgifter behandlas.
- **Kodhållhake:** daglig körning kräver `creditsafe`-nyckel i `integration_secrets`; utan den hoppas körningen tyst över (byggt, `db/worker/email-worker.ts`). 🟡
- **Signerat:** _____

### 6. Supabase (om kvar som brygga i övergången)
- **Behandlar:** datalager i övergången innan allt flyttat till egen server/AWS.
- **Dataregion:** **[ÖPPET]** — bekräfta EU-projekt.
- **Krav:** DPA; EU-region; **fasas ut** mot det egna API:t och den egna databasen (`MIGRATED_PORTS` mäter hur långt migreringen kommit).
- **Signerat:** _____

---

## C. Att göra före skarp drift (sammanfattning)

- [ ] **Vercel: acceptera DPA, bekräfta var loggar och kontrollplan behandlas. [ÖPPET — plattformen, gör den först]**
- [ ] **Databasleverantören: teckna DPA, bekräfta EU-region, prova återställning. [ÖPPET]**
- [ ] AWS (S3): acceptera DPA, bekräfta `eu-north-1`, kontrollera att hinken är privat. **[ÖPPET]**
- [ ] Anthropic: signera DPA + **aktivera ZDR** på kontot, ingen träning på våra data. **[ÖPPET]**
- [ ] Google: acceptera Maps Platform-villkor, bekräfta region. **[ÖPPET]**
- [ ] SMS: välj leverantör, teckna DPA, EU-region. **[ÖPPET]**
- [ ] Creditsafe: avtal + rättslig grund (kreditupplysningslagen). **[ÖPPET]**
- [ ] Supabase: DPA + EU-projekt, eller fasa ut före drift. **[ÖPPET]**
- [ ] Publicera en aktuell underbiträdeslista för de registrerade (transparens).

## D. Det kod redan gör åt saken

- **Dataminimering mot varje part** (bara det nödvändiga skickas; inget innehåll loggas) — `server/anthropic.ts`, `src/lib/sources/google.ts`.
- **Fail-closed / avstängt** tills nyckel/avtal finns — `GOOGLE_MAPS_API_KEY`, `ANTHROPIC_API_KEY`, `integration_secrets`. Samma hållning i `CRON_SECRET`: utan den svarar de schemalagda jobben 503 i stället för att köra.
- **Funktionernas region enforced** — `"regions": ["arn1"]` i `vercel.json`, vaktat av `tests/deploy.ts`. Databasens och lagringens region är däremot ett driftbeslut som koden inte kan tvinga fram.
- **Gallring** som driftparameter i skuggläge — `src/lib/retention.ts`, körd av `api/cron/nattjobb.ts`.
- **De registrerades rättigheter** i produkten — dataskyddssektionen (`src/pages/DashboardSettings.tsx`), `src/lib/dataExport.ts`.
