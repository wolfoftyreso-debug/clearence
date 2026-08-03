# Kopplingar mot omvärlden

Sanningskällan är koden: **`src/lib/integrations/registry.ts`** beskriver
varje mål med status (`fil` / `avtal` / `blockerad`), vad som faktiskt är
byggt och vad nästa steg kräver. Testet `tests/integrations.ts` kontrollerar
bland annat att allt registret påstår fungerar pekar på byggd kod - det här
dokumentet är bara kartan.

## Principen

Filvägar först, API:er sen. En fil användaren själv exporterar och läser in
kräver inga avtal, inga nycklar och ingen tredje part som ser bolagets kris -
och den fungerar för varje motpart oavsett vilket system den kör. API-vägarna
byggs när partneravtalen finns, ovanpå samma domänmodeller.

## Byggt och testat (filvägen)

| Koppling | Kod | Vad den gör |
|---|---|---|
| Skatteverket, skattekontot | `skattekonto.ts` | Läser e-tjänstens utdrag lokalt: saldo, historik och **kommande förfall** - raderna som styr företrädaransvaret. Rubrikmatchning, inte kolumnpositioner; oförstådda rader rapporteras, aldrig gissas. |
| Advokatbyråer, akten | `caseBundle.ts` | Hela ärendet som versionsmärkt JSON-akt: ärende, frister, betalningar, dokumentförteckning, korrespondens (avsändare klassad, aldrig namngiven). Även dataexporten som gör "svarta lådan" verklig. |
| Advokatbyråer, frister | `caseBundle.ts` | Fristerna som RFC 5545-korrekt iCalendar: heldagshändelser, varsel tre dagar före (samma som produkten), deterministiska UID:n så omimport inte dubblerar. Importeras av Outlook, Google och varje advokatsystem. |
| Kreditgivare, underlaget | `creditDossier.ts` | Kreditunderlag som dokument + maskinläsbart paket. Redovisar även det som talar emot (skuld, KBR-plikt, dag kassan tar slut) och **vägrar byggas** utan likviditetsplan. |

## Kräver avtal innan kod skrivs

Fortnox, Visma (developer-avtal + OAuth), Bolagsverket (API-registrering),
Creditsafe (avtal). Domänmodellerna och portarna är redan byggda -
avtalen är flaskhalsen, och de ägs av Landvex.

## Blockerat tills namngivet beslut

- **Kreditförmedling**: juridisk bedömning av tillståndsfrågor (FI) och
  medverkansansvar. Plattformen producerar underlag, rekommenderar aldrig
  kredit. Se docs/VISION.md.
- **PSD2/bankdata**: kräver AISP-tillstånd eller licensierad aggregator -
  yttre beroende som kräver uttryckligt undantag från grundprincipen.

## Nästa byggsteg (utan att vänta på någon)

1. SIE-import (`src/lib/financial/`) - standardformatet varje svenskt
   bokföringsprogram exporterar. Registret markerar den som obyggd.
2. Gränssnittsknappar för skattekontoimport (bredvid kontoutdragsimporten),
   aktexport och fristkalender i ärendevyn.
3. Kreditunderlagsformuläret (belopp + ändamål) ovanpå `buildCreditDossier`.
