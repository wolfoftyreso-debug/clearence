# Var allt bor

Kartan över repot: en rad per katalog, vad den är, och om den följer med
till drift. `tests/vercelredo.ts` läser den här filen och jämför mot det
riktiga katalogträdet — en katalog som saknas i tabellen, eller en rad som
pekar på ingenting, gör provet rött. Kartan kan alltså inte tyst bli
inaktuell.

## Katalogerna

| Katalog | Vad det är | Till drift |
| --- | --- | --- |
| `src/` | Webbappen. React, TypeScript, Tailwind. Ingen backend-SDK ovanför datalagret | ja |
| `server/` | API:t. Transportlöst — `handle()` vet inget om HTTP-servern över sig | ja |
| `api/` | Vercels ingångar. Varje fil här blir en endpoint; därför bor koden i `server/` | ja |
| `db/` | Databasen: schema (`migrations/`), radskyddsprov (`rls-tests/`, `tests/`) och arbetarna. `db/worker/` körs av cron och måste följa med; resten inte | delvis |
| `public/` | Statiska filer som serveras som de är | ja |
| `tests/` | Provsviterna. 54 stycken, körda av `npm test` | nej |

| `docs/` | Den här filen och resten av underlaget | nej |
| `design/` | Designunderlag för Claude Design | nej |
| `exempel/` | Fristående exempel på hur motorn används | nej |
| `scripts/` | Verktyg som körs för hand eller i CI | nej |
| `.github/` | CI-konfiguration | nej |

Vad som inte följer med styrs av `.vercelignore`, och den listan provkörs:
sviten bygger repot med exakt de raderna borttagna, så en ignorerad fil som
bygget faktiskt behöver blir röd här i stället för vid driftsättningen.

## Riktningen genom lagren

```
src/            data.<port>.<metod>()      ingen komponent känner en backend
  └─ src/data/  DataPort — kontraktet
       ├─ aws/        → eget API över HTTP     ← allt går hit
       └─ demo/       → påhittad data, bara för visningar
api/[...path].ts      → server/index.ts handle()
server/               → server/db.ts withUser() / withAnon()
db/                   → Postgres, radskydd
```

Regeln uppåt: **ingenting ovanför `src/data/` importerar en backend-SDK.**
Regeln nedåt: **ingenting under `server/` känner till HTTP-transporten.**

## De två lägena

| Läge | Vad som händer |
| --- | --- |
| *normalt* | **Eget API.** Alla 156 portmetoder i `DataPort` går hit |
| `VITE_DEMO_MODE=true` | Påhittad data i webbläsaren. Bara för visningar |

Här stod tre lägen en gång, valda med `VITE_DATA_ADAPTER`: Supabase var
standard, eget API krävde en byggflagga, och det som inte flyttats gick
över en bro. Migreringen är klar, bron är riven och flaggan borttagen — en
flagga med bara ett giltigt värde är inte ett val, den är en fälla för den
som stavar fel.

## Att det stämmer, prövat

`tests/awsAdapter.ts` läser demoadaptern som facit för kontraktets yta och
kräver att adaptern mot eget API täcker varje port och varje metod. Den
söker dessutom igenom **hela** `src/` efter en backend-SDK — det var inte
`src/data/` som importerade Supabase, utan `src/integrations/`, och en vakt
som bara tittat i datalagret hade missat det.

## Var driftsläget står skrivet

| Fråga | Svar |
| --- | --- |
| Vilka miljövariabler? | [docs/vercel.md](vercel.md#miljövariabler) |
| Hur sätter jag upp det första gången? | [docs/driftsattning.md](driftsattning.md) |
| Vad hindrar en driftsättning just nu? | [docs/vercel.md](vercel.md#vad-som-återstår) |
| Vad gör jag härnäst? | [docs/nasta-steg.md](nasta-steg.md) |
