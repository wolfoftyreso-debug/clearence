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

## 6. Lagring & gallring (förslag — [ÖPPET])
- Aktiva ärenden: bevaras under uppdraget.
- Avslutade ärenden: föreslå gallringstid (t.ex. X månader) vägt mot bokförings-/preskriptionskrav. [ÖPPET]
- Samtalsloggar/journal: bevaras för spårbarhet men minimeras. [ÖPPET]
- Modell-leverantör: **ZDR** så inget innehåll lagras hos underbiträdet. [ÖPPET: aktivera på kontonivå]

## 7. Den registrerades rättigheter
Rutiner för registerutdrag, rättelse, radering, dataportabilitet och invändning ska finnas och testas före drift. [ÖPPET: process + ansvarig.]

## 8. Öppna punkter före deploy (sammanfattning)
1. Signera DPA med Anthropic, Google, AWS, SMS- och kreditupplysningsleverantör.
2. Bekräfta **EU-dataregion** för varje underbiträde; aktivera **ZDR** hos modell-leverantören.
3. Genomför och dokumentera **DPIA**.
4. Fastställ **gallringstider** och rättighetsprocesser.
5. Bedöm art. 9-risk i fritext och skriv en kort användarinstruktion ("skriv inte in mer personuppgifter än nödvändigt").
