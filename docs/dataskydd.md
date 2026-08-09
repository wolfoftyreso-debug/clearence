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
| **AWS** | Hosting, databas, Secrets Manager | EU (t.ex. eu-north-1) **[ÖPPET]** | DPA, EU-region, kryptering i vila/transit |
| **Anthropic** | Samtalsmotorn (CLEARANCE) | **[ÖPPET: EU-residens/ZDR]** | Signerad DPA, **nolldataretention (ZDR)** på kontonivå, ingen träning på våra data |
| **Google (Places API)** | Bolagsuppslag (adress/omdömen/status) | **[ÖPPET]** | Villkor: cache ≤30 dagar, attribution. Skickar bolagsnamn/ort — undvik personuppgifter i frågan |
| SMS-leverantör | Premium-aviseringar | **[ÖPPET]** | DPA; skicka minsta möjliga i meddelandet |
| Kreditupplysning (Creditsafe e.d.) | Kreditunderlag | SE/EU | Avtal + rättslig grund; kreditupplysningslagen |
| Supabase (om kvar som brygga) | Datalager i övergången | **[ÖPPET]** | DPA; fasas ut mot AWS |

## 5. Dataminimering & tekniska skydd (implementerat i koden)
- **Samtalsmotorn skickar ENBART** det synliga samtalet + systemprompten till modellen. **Ingen** `metadata`/user_id, **ingen** ärendedata, inget om bolaget utöver det användaren själv skrivit. (`api/server/anthropic.ts`, vaktat i `tests/anthropic.ts`.)
- **Innehållet loggas aldrig** server-sidan — bara statuskoder. (Vaktat i test.)
- **`storage_path` lämnar aldrig servern** — dokument nås via signerad URL efter `app.may_read_document()`.
- **API-nycklar lagras endast som SHA-256**; sessionstokens aldrig i klartext.
- **Transaktionslokal identitet** + **RLS** i databasen; API kör som `authenticated`, aldrig ägare/BYPASSRLS.
- Hemligheter (`ANTHROPIC_API_KEY`, `GOOGLE_MAPS_API_KEY`, `DATABASE_URL`) i **Secrets Manager**, aldrig i frontend-bunten.
- **Dataminimering vid fritext:** en kort påminnelse står intill fritextfälten (samtalet, onboardingen) om att inte dela fler personuppgifter än läget kräver — motmedel mot art. 9-uppgifter i fritext. (`src/lib/dataMinimering.ts`, vaktat i `tests/dataskydd.ts`.)
- **Regelaktualitet i samtalet:** modellen får aldrig påstå en specifik frist, ett belopp eller ett gränsvärde som säkert gällande, utan hänvisar till primärkälla eller en människa. (`api/server/anthropic.ts`, vaktat i `tests/anthropic.ts`.)

## 6. Lagring & gallring — policy satt i kod
Gallringspolicyn är **satt**, inte längre bara ett förslag: en tid och en åtgärd per kategori i `src/lib/retention.ts`, med tiderna som **driftparametrar** (app_settings, nyckeln `retention_policy`) och åtgärden (radera / anonymisera / behåll) medveten per kategori. Driftpanelen visar policyn ärligt (RetentionSection), och workern kör den via `--gallra`. Vaktat i `tests/dataskydd.ts`.
- **Skuggläge som default:** gallringen räknar vad som skulle tas bort men raderar inget förrän en kategori aktiveras medvetet — samma försiktighet som skuggdebiteringen. Bara hastighetsgränsens sekundfärska teknikrader gallras skarpt från start.
- Aktiva ärenden: bevaras under uppdraget.
- Avslutade ärenden: kontaktuppgifter anonymiseras efter satt tid (standard 24 mån, driftparameter). **[ÖPPET: DBA bekräftar tid mot bokförings-/preskriptionskrav och aktiverar kategorin.]**
- Samtalsloggar/journal: anonymiseras i sedan länge avslutade ärenden (fritexten bort, posten/tidslinjen kvar). **[ÖPPET: DBA aktiverar och skriver den per-kategori DB-funktion som utför raderingen, prövad i db/tests.]**
- Händelseloggen: **behålls** för spårbarhet, gallras inte på tid (medvetet val i policyn).
- Modell-leverantör: **ZDR** så inget innehåll lagras hos underbiträdet. **[ÖPPET: aktivera på kontonivå.]**

## 7. Den registrerades rättigheter — byggt i produkten
En dataskyddssektion under Inställningar (`src/pages/DashboardSettings.tsx`) ger den registrerade tre raka vägar, vaktade i `tests/dataskydd.ts`:
- **Registerutdrag & dataportabilitet (art. 15, 20):** "Ladda ner mina uppgifter" bygger en maskinläsbar JSON lokalt i webbläsaren ur samma läsvägar appen använder (`src/lib/dataExport.ts`).
- **Rättelse (art. 16):** namn och telefon i profilen; ärendefakta i ärendet.
- **Radering (art. 17):** formell begäran via dataskyddskanalen (kontakt, ämne Personuppgifter), med rakt besked om vad som ändå måste sparas (fakturor/bokföring, händelseloggens spårbarhet) och vad som gallras enligt policyn.

**[ÖPPET: fastställ svarstid (en månad enligt art. 12.3), utpekad ansvarig och en rutin för identitetskontroll av den som begär utdrag/radering.]**

## 8. Öppna punkter före deploy (sammanfattning)

**Kräver människa/jurist (externt — kan inte byggas bort i kod):**
1. Signera DPA med Anthropic, Google, AWS, SMS- och kreditupplysningsleverantör.
2. Bekräfta **EU-dataregion** för varje underbiträde; aktivera **ZDR** hos modell-leverantören.
3. Genomför och dokumentera **DPIA**.
4. Rättighetsprocessen: fastställ svarstid, ansvarig och identitetskontroll (rutinen kring den byggda funktionen i §7).
5. Gallringen: DBA bekräftar tiderna och aktiverar kategorierna, och skriver+prövar den per-kategori DB-funktion som utför anonymiseringen/raderingen (§6).

**Byggt i koden i den här omgången (se `docs/deploy-compliance.md`):**
- Gallringspolicy som driftparameter + skuggläges-worker (§6).
- Registerutdrag, dataportabilitet, rättelse- och raderingsvägar (§7).
- Dataminimeringspåminnelse vid fritext och regelaktualitet i samtalet (§5).
