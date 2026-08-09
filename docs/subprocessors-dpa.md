# Underbiträdesregister & DPA-checklista

> **STATUS: UNDERLAG.** Skrivet av utvecklingen för att ge DPO/jurist ett försprång inför drift. **Inte** juridisk rådgivning och **inte** ett färdigt avtal. Varje rad märkt **[ÖPPET]** kräver en underskrift, ett konto-/avtalsbeslut eller en myndighet — sånt kan inte byggas i kod. Det som är byggt i koden är utskrivet och pekar på filen som vaktar det.
>
> **Personuppgiftsansvarig:** Landvex AB (org.nr 559141-7042), produkt Clearance. Detta register hör ihop med `docs/dataskydd.md` (DPIA-underlag, behandlingsregister) och `docs/deploy-compliance.md` (P0/P1-checklistan). Terraform-utdatan `data_residency_posture` speglar avsnitt A nedan.

## Hur registret används

1. För **varje** underbiträde nedan: teckna DPA, bekräfta dataregion, sätt retention/ZDR, och fyll i datum + ansvarig i kolumnen **Signerat**.
2. Ett underbiträde utan tecknad DPA får **inte** tas i skarp drift med riktiga personuppgifter. Flaggan/nyckeln i koden hålls av tills dess (se varje rad).
3. Registret ska hållas aktuellt: läggs ett nytt underbiträde till, läggs en rad till här *innan* det kopplas in.

Legend: 🟢 klart · 🟡 förberett i kod, avtal saknas · 🔴 ej påbörjat

---

## A. Vår egen infrastruktur (styrs av Terraform, inte av avtal)

Beräkning, databas, lagring, e-post och loggar reser alla i `var.aws_region`, som Terraform **validerar till EU** (`infra/variables.tf`: `startswith(aws_region, "eu-")`, standard `eu-north-1`). Kryptering i vila via KMS (`infra/kms.tf`), i transit via TLS. AWS är i sig ett underbiträde (rad 1 nedan), men *var* datan ligger är vår egen konfiguration, inte AWS beslut. Terraform-utdatan `data_residency_posture` skriver ut detta för granskning.

## B. Underbiträden — en rad per part

### 1. AWS (hosting, databas, lagring, e-post, hemligheter)
- **Behandlar:** all ärende- och kontodata (i vila och transit), utkorgens e-post, hemligheter.
- **Dataregion:** EU (`eu-north-1`), enforced i Terraform. 🟢 (region) / 🔴 (DPA-underskrift)
- **Krav:** AWS DPA (GDPR-tillägget) accepterat på kontonivå; EU-region; kryptering i vila/transit (byggt). SCC:er om något stödsystem ligger utanför EU. **[ÖPPET: acceptera AWS DPA, dokumentera.]**
- **Signerat:** _____ (datum / ansvarig)

### 2. Anthropic (samtalsmotorn bakom CLEARANCE)
- **Behandlar:** ENBART det synliga samtalet + systemprompten. **Ingen** metadata/user_id, **ingen** ärendedata, inget innehåll loggas. Byggt och vaktat i `api/server/anthropic.ts` / `tests/anthropic.ts`. 🟢 (dataminimering)
- **Dataregion / retention:** **[ÖPPET]** — EU-residens och **nolldataretention (ZDR)** sätts på **kontonivå**, inte i kod eller Terraform.
- **Krav:** signerad DPA; **ZDR aktiverad** (inget innehåll lagras hos underbiträdet); ingen träning på våra data; EU-endpoint där det erbjuds; annars SCC:er.
- **Kodhållhake:** motorn är fail-closed utan nyckel (`ANTHROPIC_API_KEY` i Secrets Manager). Slå inte på samtalet i skarp drift förrän DPA + ZDR är på plats. 🟡
- **Signerat:** _____

### 3. Google (Places API — webbadress, omdömen, verksamhetsstatus)
- **Behandlar:** bolagsnamn + ort i frågan (undvik personuppgifter i frågan); tar aldrig in recensenters namn/bilder (byggt, `src/lib/sources/google.ts`). Cache **≤30 dagar** och attribution i koden. 🟢 (dataminimering/villkor i kod)
- **Dataregion:** **[ÖPPET]** enligt Google Maps Platform-villkoren.
- **Krav:** acceptera Google Maps Platform-villkor + databehandlingsvillkor; bekräfta region/överföringsgrund.
- **Kodhållhake:** `enable_google_source = false` tills nyckeln finns (`infra/variables.tf`). Med flaggan av redovisas källan som ej ansluten, tjänsten fungerar. 🟡
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
- **Krav:** DPA; EU-region; **fasas ut mot AWS** (målarkitekturen är "inte Supabase — AWS"; `MIGRATED_PORTS` mäter hur långt migreringen kommit).
- **Signerat:** _____

---

## C. Att göra före skarp drift (sammanfattning)

- [ ] AWS: acceptera DPA, dokumentera EU-region. **[ÖPPET]**
- [ ] Anthropic: signera DPA + **aktivera ZDR** på kontot, ingen träning på våra data. **[ÖPPET]**
- [ ] Google: acceptera Maps Platform-villkor, bekräfta region. **[ÖPPET]**
- [ ] SMS: välj leverantör, teckna DPA, EU-region. **[ÖPPET]**
- [ ] Creditsafe: avtal + rättslig grund (kreditupplysningslagen). **[ÖPPET]**
- [ ] Supabase: DPA + EU-projekt, eller fasa ut före drift. **[ÖPPET]**
- [ ] Uppdatera `data_residency_posture`-utdatan om något flyttar.
- [ ] Publicera en aktuell underbiträdeslista för de registrerade (transparens).

## D. Det kod redan gör åt saken

- **Dataminimering mot varje part** (bara det nödvändiga skickas; inget innehåll loggas) — `api/server/anthropic.ts`, `src/lib/sources/google.ts`.
- **Fail-closed / flaggat av** tills nyckel/avtal finns — `enable_google_source`, `ANTHROPIC_API_KEY`, `integration_secrets`.
- **EU-region enforced** för egen infrastruktur — `infra/variables.tf` + utdatan `data_residency_posture`.
- **Gallring** som driftparameter i skuggläge — `src/lib/retention.ts`, worker `--gallra` (schemalagd i `infra/main.tf`).
- **De registrerades rättigheter** i produkten — dataskyddssektionen (`src/pages/DashboardSettings.tsx`), `src/lib/dataExport.ts`.
