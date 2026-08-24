# Överlämning

Läget just nu, och vad som står näst på tur. Skriven för att kunna öppnas
i en ny redigerare utan att någon behöver läsa historiken först.

## Var produkten står

**Supabase är borta.** `DataPort` har 156 metoder och alla går mot
CLEARANCE eget API. Adaptern, klienten, edge-funktionen, paketet,
byggvariablerna och katalogen är raderade. `tests/awsAdapter.ts` söker
igenom hela `src/` efter en backend-SDK och blir röd om någon kommer
tillbaka.

Allt körs på Vercel: appen, API:t (`api/[...path].ts`), de fyra
cron-jobben och dokumentlagringen (Vercel Blob).

| Prov | Kommando | Läge |
| --- | --- | --- |
| Hela kedjan | `npm test` | 54 sviter, 13 120 kontroller |
| Radskyddet, självhostat | `bash db/tests/run.sh` | 326 påståenden |
| Radskyddet, migrationerna | `npm run test:rls` | 321 påståenden |
| Levande API mot Postgres | `npm run test:api` | 1 308 kontroller |
| Webbläsarflödena | `npm run test:webblasare` | kräver bygge + server |

Databasen reses med `db/bootstrap.sql` följt av `db/migrations/*.sql`.

## Det du behöver göra innan första driftsättningen

1. **Rotera Anthropic-nyckeln** `sk-ant-api03-...AEQAA`. Den har legat i en
   chatt och ska betraktas som röjd.
2. **Blob-butik** i Vercel-projektet (Storage → Create → Blob). Då sätts
   `BLOB_READ_WRITE_TOKEN` automatiskt i alla miljöer.
3. **Postgres med TVÅ anslutningssträngar.** `DATABASE_URL` ska peka på en
   roll utan `BYPASSRLS` och utan tabellägarskap; `WORKER_DATABASE_URL` har
   motsatt krav. `db/roles-selfhosted.sql` skapar rollerna. Pekas den
   första fel stängs radskyddet av TYST — därför vägrar `sakerRollGrind()`
   i `server/db.ts` att köra en enda fråga innan den prövat rollen.
4. **`CRON_SECRET`**, minst 16 tecken. Utan den svarar cron-endpointerna
   503 i stället för att köra oskyddade.
5. **DPA:er**: Vercel, databasleverantören och Anthropic (begär ZDR).
6. **Fakturablocket**: F-skatt, momsregistrering, bankgiro, avsändaradress.

Hela variabellistan står i [docs/vercel.md](vercel.md#miljövariabler).

## Vad som är prövat men inte kört skarpt

Sagt rakt ut, så att ingen tror mer än vad som är sant:

- **Vercel Blob.** Kontroll-API:t är prövat mot en dubbel över riktig HTTP —
  signering, presignerad PUT, HEAD, DELETE genom den riktiga SDK:n, med
  angreppsfallet (en Linux-binär uppladdad som `arsredovisning.pdf`,
  avvisad och raderad). Blobs objektvärd är hårdkodad i SDK:n och går inte
  att peka om, så nedladdnings-URL:en är granskad till sin FORM men aldrig
  hämtad. **Kör en riktig uppladdning och nedladdning som första sak efter
  driftsättning.**
- **Bolagsuppslaget** (`server/bolag.ts`) skrapar allabolag.se. En skrapa
  slutar fungera när sidan ändras. Ett null är ett giltigt svar och
  formuläret låter användaren skriva själv, men det är inte en registerkälla
  med avtal.
- **Ingen kod är körd mot en riktig Vercel-drift.** Allt ovan är kört mot
  riktig Postgres och riktig HTTP i en container.

## Näst på tur, i ordning

1. **`GET /cases/{caseId}/report`** — den enda rutt kontraktet lovar och
   servern saknar (`ANNU_INTE_BYGGDA` i `tests/apiSpec.ts`). Klienten
   bygger redan rapporten lokalt ur samma underlag (`src/lib/pdf`), så det
   är en bekvämlighet för API-kunder, inte något produkten saknar.
2. **`PATCH /cases/{caseId}` och `PATCH /cases/{caseId}/tasks`** — samlade
   ändringsformer som kontraktet beskriver men ingen klient använder ännu.
3. **Gallringen** (uppgift 86, påbörjad): retention som driftparameter,
   arbetare och yta.
4. **Den registrerades rättigheter** (uppgift 87): utdrag, radering,
   rättelse.
5. **`docs/dataskydd.md` + deploy-checklistan** (uppgift 90).

## Regler som gäller i den här koden

Skrivna här för att de är lätta att bryta av misstag:

- **Ingen backend-SDK ovanför `src/data/`.** Prövas av `tests/awsAdapter.ts`.
- **Ingenting under `server/` känner till HTTP-transporten.** `handle()` är
  transportlös; `api/[...path].ts` och `server/main.ts` är de två
  transporterna.
- **`storage_path` lämnar aldrig servern.** Klienten får en signerad URL som
  dör efter 60 sekunder, och först efter att `app.may_read_document()` sagt
  ja.
- **API:t kör som `authenticated`, aldrig som ägaren eller med `BYPASSRLS`.**
- **"Mina" är ett urval, inte en behörighetsfråga.** För en plattformsadmin
  är radskyddet vidare än urvalet — tre rutter har därför en uttrycklig
  `where user_id = app.current_user_id()`, och var och en säger varför.
- **Aldrig märka analysen "AI".** Använd Systemanalys/Portföljanalys. Prövas.
- **Inga hårdkodade priser.** De är driftparametrar i `app_settings`.
- **En regel som inte testas är en åsikt.** Varje ny vakt ska muteras: ändra
  koden så att den borde bli röd, och kontrollera att den blir det.
