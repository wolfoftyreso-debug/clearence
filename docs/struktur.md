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
| `db/` | Databasen. `db/worker/` körs av cron och måste följa med; schemat och proven gör det inte | delvis |
| `public/` | Statiska filer som serveras som de är | ja |
| `tests/` | Provsviterna. 54 stycken, körda av `npm test` | nej |
| `supabase/` | Migrationerna och det som är kvar av Supabase-skalet | nej |
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
       ├─ aws/        → eget API över HTTP     ← standard
       ├─ supabase/   → bron, för det som inte flyttat än
       └─ demo/       → påhittad data, bara för visningar
api/[...path].ts      → server/index.ts handle()
server/               → server/db.ts withUser() / withAnon()
db/                   → Postgres, radskydd
```

Regeln uppåt: **ingenting ovanför `src/data/` importerar en backend-SDK.**
Regeln nedåt: **ingenting under `server/` känner till HTTP-transporten.**

## De tre backendlägena

Väljs vid **byggtid** med `VITE_DATA_ADAPTER`. En bunt byggd utan flaggan
kan inte pratas över till en annan backend i efterhand.

| Värde | Vad som händer |
| --- | --- |
| *osatt* | **Eget API.** Standard. Det som ännu inte flyttat går över Supabase-bron |
| `supabase` | Allt går till Supabase. Ett medvetet val, inte ett standardvärde |
| `VITE_DEMO_MODE=true` | Påhittad data i webbläsaren. Bara för visningar |

## Migreringens läge, mätt och inte påstått

`MIGRATED_PORTS` i `src/data/aws/adapter.ts` säger vad som går mot eget API.
`delegeradePortar()` säger vad som går över bron. `tests/awsAdapter.ts`
räknar båda på **två oberoende sätt** — ur listan och ur funktionsidentitet
— och blir röd om de går isär.

Rörs en port som ännu inte flyttat, i en drift utan Supabase-variabler,
kastas ett fel som **namnger porten**. Ingen tyst omväg.

## Var driftsläget står skrivet

| Fråga | Svar |
| --- | --- |
| Vilka miljövariabler? | [docs/vercel.md](vercel.md#miljövariabler) |
| Hur sätter jag upp det första gången? | [docs/driftsattning.md](driftsattning.md) |
| Vad hindrar en driftsättning just nu? | [docs/vercel.md](vercel.md#vad-som-återstår) |
