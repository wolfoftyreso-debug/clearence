# Deploy-compliance — checklista före driftsättning

> **STATUS: UNDERLAG.** Skriven av utvecklingen som beslutsunderlag inför drift. **Inte** juridisk rådgivning. En jurist/DPO ska granska och besluta. Varje rad är märkt **[KOD]** (går att bygga och testa i produkten – utvecklingens ansvar) eller **[EXTERNT]** (kräver avtal, konto­beslut, myndighet eller jurist – kan inte byggas bort i kod).
>
> Underlaget svarar mot djupsökets Del 4 (P0/P1/P2) och compliance-matrisen i T3. Det som är **[KOD]** och grönt nedan är byggt och vaktat med tester i den här kodbasen; det som är **[EXTERNT]** är förberett så långt kod kan förbereda det, men beslutet/underskriften ligger hos en människa.

Legend: 🟢 klart · 🟡 påbörjat/underlag finns · 🔴 ej gjort

## P0 — blockerare (får inte gå live utan)

| # | Krav | Typ | Status | Var / hur |
|---|---|---|---|---|
| P0-1 | DPA (personuppgiftsbiträdesavtal) med Anthropic, Google, AWS, SMS- och kreditupplysningsleverantör | [EXTERNT] | 🔴 | Register + per-part-checklista med signeringskolumn: `docs/subprocessors-dpa.md`. Signeras av bolaget. |
| P0-2 | EU-dataregion bekräftad för varje underbiträde; **nolldataretention (ZDR)** aktiverad hos modell-leverantören | [EXTERNT] | 🔴 | Konto-/avtalsbeslut, spårat i `docs/subprocessors-dpa.md`. Egen infra är EU-låst i Terraform (`data_residency_posture`); koden skickar dataminimerat (P0-6). |
| P0-3 | DPIA genomförd och dokumenterad före skarp pilot | [EXTERNT] | 🟡 | Underlag klart i `docs/dataskydd.md` §2–7. DPO slutför. |
| P0-4 | Rättslig grund för behandlingen fastställd per kategori | [EXTERNT] | 🟡 | Förslag i behandlingsregistret, `docs/dataskydd.md` §3. |
| P0-5 | Säkerhetsinvarianter verifierade i skarp miljö (RLS, roller, signerade URL:er, SHA-256-nycklar) | [KOD] | 🟡 | Byggt och testat i demo/self-hosted; ska köras om i produktionsmiljön. RLS-tester: `supabase/tests`, `db/tests`. |
| P0-6 | Dataminimering mot modell-leverantören (inget user_id/metadata, inget innehåll loggas) | [KOD] | 🟢 | `api/server/anthropic.ts`, vaktat i `tests/anthropic.ts`. |
| P0-7 | Ansvarsgräns: eskalering på höga insatser, aldrig säkert juridiskt besked, regelaktualitet | [KOD] | 🟢 | Systemprompt-konstitutionen, vaktat i `tests/anthropic.ts`. |

## P1 — före publik lansering (första kund)

| # | Krav | Typ | Status | Var / hur |
|---|---|---|---|---|
| P1-1 | Gallringstider fastställda (driftparameter) och tekniskt genomförda (worker) | [KOD] | 🟢 | `src/lib/retention.ts` (policy), driftpanelens RetentionSection, `app.gallra()` (utförande, en gren per kategori, stängd för klientrollerna), worker `--gallra`. Skuggläget är en **torrkörning av samma fråga**, så skuggsiffran är den siffra som gallras när kategorin slås på - prövat i `supabase/tests/radering.sql` i båda databasmiljöerna. Kvarstår: DBA bekräftar tiderna och aktiverar kategorierna. |
| P1-2 | Den registrerades rättigheter: registerutdrag, dataportabilitet, rättelse, radering | [KOD] | 🟢 | Dataskyddssektion i `src/pages/DashboardSettings.tsx` + `src/components/settings/ErasureSection.tsx`. Utdrag/portabilitet: `src/lib/dataExport.ts`. Rättelse: `RECTIFICATION_MAP`. Radering: självbetjänad med sju dagars karenstid via `GET/POST/DELETE /v1/me/erasure` → `app.erase_user()` i en transaktion (migration `20260825100000`). `ERASURE_MANIFEST` lovar vad som raderas, anonymiseras och behålls med rättslig grund; `tests/dataskydd.ts` kräver att manifestet och SQL:en täcker varandra i båda riktningarna, och `supabase/tests/radering.sql` söker efter kvarvarande personuppgifter i **varje textkolumn i varje tabell**. |
| P1-3 | Art. 9-risk i fritext hanterad: dataminimeringsinstruktion vid fritextfält | [KOD] | 🟢 | `src/lib/dataMinimering.ts` + `DataMinimeringHint` i samtalet och onboardingen. Vaktat i `tests/dataskydd.ts`. |
| P1-4 | E-signeringens beviskedja (vem/vad/när, oföränderlig länkad kedja, ärliga eIDAS-gränser) | [KOD] | 🟢 | `src/lib/signing.ts`, vaktat i `tests/signing.ts`. |
| P1-5 | Webbhämtaren live med robots.txt + SSRF-skydd (halvtomma källpaneler undvikna) | [KOD] | 🟢 | `api/server/website.ts`, vaktat i `tests/website.ts`. |
| P1-6 | Avtal för företagsregister (Bolagsverket/kreditupplysare) | [EXTERNT] | 🔴 | Registret märker källan som ej-live tills avtal finns (`src/lib/sources/registry.ts`). |

## P2 — tidig iteration

| # | Krav | Typ | Status | Var / hur |
|---|---|---|---|---|
| P2-1 | Marknadsvalidering av betapriser (985/2 780/4 500 kr/mån) | [EXTERNT] | 🔴 | Priser är driftparametrar; ingen kodändring krävs för att justera. |
| P2-2 | Marknadsföringsetik: engångserbjudandet som äkta tidsfönster (grundaren har beslutat behålla mekaniken) | [KOD] | 🟢 | `src/components/pricing/ProUpgradeOffer.tsx` – visas en gång, äkta 60 s. |
| P2-3 | GTM-plan och pilotmätning | [EXTERNT] | 🟡 | Pilotprogram v1.0 dokumenterat i `docs/`. |

## Det kod inte kan göra

DPA-underskrifter, val av dataregion, aktivering av ZDR på leverantörskonto, DPIA-beslut, avtal med Bolagsverket/kreditupplysare och prissättningens marknadsvalidering är **affärs- och juridikbeslut**. Produkten är byggd så att den *förbereder* dem (dataminimering, ärlig källmärkning, driftparametrar i stället för hårdkodning, underlag i `docs/`), men den kan inte fatta besluten. De raderna ovan förblir 🔴/🟡 tills en människa stänger dem.
