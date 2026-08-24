# Driftsättning

Körordningen från tomt Vercel-konto till en tjänst som svarar. Skriven för
att följas uppifrån och ned, en gång, av en människa som inte har hela
systemet i huvudet.

Referensen för *vad som ligger var* är [docs/vercel.md](vercel.md). Det här
är ordningen att göra det i.

Allt som inte går att automatisera står som **DU**: det är beslut eller
uppgifter som bara ägaren kan lämna.

---

## 0. Innan du börjar

Kör startkontrollen. Den prövar det som annars upptäcks först i produktion.

```bash
scripts/startkontroll.sh
```

Den skiljer på **STOPP** (driftsätt inte) och **VARNING** (driftsätt om du
vet varför). Varningarna nedan är väntade i det här läget och hindrar inte
en driftsättning — de hindrar bara att du börjar ta betalt:

- F-skatt, momsregistrering, bankgiro och avsändaradress obekräftade →
  faktureringen är spärrad i koden tills de fylls i.
- Policy och villkor är ogranskade utkast → sidorna säger det själva.

### DU: fyra beslut som ska vara fattade först

| Beslut | Var det landar |
|---|---|
| Vilken Postgres? | `DATABASE_URL` — se steg 1 |
| Vilken avsändaradress för e-post? | `MAIL_FROM` |
| SMTP-relä eller SES? | `MAIL_TRANSPORT` |
| Förhandsmiljö först, eller direkt produktion? | Vercel-miljön du sätter variablerna i |

Kör en förhandsmiljö först. Det kostar en kvälls väntan och sparar den
första riktiga incidenten.

### Planen

`vercel.json` deklarerar `maxDuration` upp till 300 sekunder och cron var
femte minut. Båda kräver **Pro**. På Hobby är taket 60 sekunder och crons
körs en gång om dygnet — nattjobbet fungerar, men utkorgen och
aviseringarna skulle dröja ett dygn, och det är fristvarningar och fakturor.

---

## 1. Databasen

Vilken Postgres som helst duger, så länge den går att nå över nätet och
kan hålla två roller isär. Vercel Postgres och Neon är båda vanlig
Postgres — radskyddet prövas på precis det med `npm run test:selfhosted`.

**Två roller, inte en.** Det här är inte en formalitet:

| Roll | Används av | Får |
|---|---|---|
| Ägaren | `scripts/migrera.sh` | Ändra schemat |
| API-rollen | `DATABASE_URL` i Vercel | Läsa och skriva **under radskyddet** |

Pekas `DATABASE_URL` på ägaren eller på en roll med `BYPASSRLS` **stängs
radskyddet av tyst**: varje fråga fortsätter fungera och börjar returnera
andra bolags insolvensdata. Ingenting kraschar. `sakerRollGrind()` i
`server/db.ts` vägrar därför köra på en sådan roll, före den första
databasfrågan i varje instans.

`db/roles-selfhosted.sql` skapar API-rollen.

**Poolning:** identiteten sätts transaktionslokalt, så *transaction
mode*-poolning fungerar. Använd poolar-URL:en, inte den direkta.

---

## 2. Migrationerna

Kör dem som **ägaren**, inte som API-rollen:

```bash
export DATABASE_URL="postgres://ägaren:LÖSENORD@värden/clearance?sslmode=require"
scripts/migrera.sh --torrkor    # visa vad som skulle köras
scripts/migrera.sh              # kör
```

Skriptet kör en migration per transaktion och bokför vilka som gått
igenom i `schema_migrations`. En avbruten körning kan alltid köras om.

### DU: den första administratören

Det finns ingen registrering som ger driftbehörighet — den sätts i
databasen, med flit:

```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = 'din@adress.se';
```

---

## 3. Dokumentlagringen

Dokumenten ligger i S3. Det är den enda AWS-tjänst som är kvar, och den är
kvar för att `storage_path` **aldrig lämnar servern**: klienten får en
signerad URL, och bara efter att `app.may_read_document()` sagt ja.

**DU:** skapa hinken, en IAM-användare med rätt att läsa och skriva i
just den, och sätt i Vercel:

```
DOCUMENTS_BUCKET=clearance-dokument
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

Hinken ska vara privat. Signeringen är hela behörighetsmodellen; en publik
hink gör den meningslös.

---

## 4. Miljövariablerna i Vercel

Hela listan står i [docs/vercel.md](vercel.md#miljövariabler). Sätt dem per
miljö, och kontrollera särskilt:

- `CRON_SECRET` — minst 16 tecken. **Utan den svarar cron-endpointerna
  503**, alltså kör inga jobb alls. Det är avsiktligt: en glömd variabel
  ska inte bli en öppen knapp för att köra faktureringen.
- `TRUSTED_PROXY_HOPS=1` — Vercel sätter `x-forwarded-for`. Med fel värde
  delar hela världen en räknare i hastighetsgränsen, eller så får varje
  anrop en färsk.
- `VITE_API_BASE_URL` — sätt den **inte**. Appen och API:t delar ursprung.

---

## 5. Första utrullningen

Koppla repot till Vercel-projektet. Ramverket är Vite; `vercel.json` bär
byggkommandot, utdatakatalogen, regionen (`arn1`, Stockholm), funktionernas
livslängd, cron-schemat och säkerhetsrubrikerna.

Kontrollera efteråt:

```bash
curl https://clearance.se/v1/health
```

Svarar den inte, läs loggen för funktionen `api/[...path]`. Två fel är
mycket vanligare än alla andra:

1. `osäker databasroll: API:t vägrar starta` → `DATABASE_URL` pekar på
   ägaren. Se steg 1.
2. `hastighetsgränsen kunde inte prövas` → migrationerna är inte körda mot
   den här databasen. Se steg 2.

---

## 6. E-post

Standardtransporten är **SMTP**. Sätt `SMTP_HOST` och, om reläet kräver
det, `SMTP_USER`/`SMTP_PASS`. Port 587 ger STARTTLS, 465 implicit TLS.

Vill du köra SES i stället: `MAIL_TRANSPORT=ses`, `SES_REGION`, AWS-uppgifter
i miljön — och `npm install @aws-sdk/client-ses`, som **inte** är ett
beroende i dag. Utan paketet får du ett läsbart fel vid första mejlet, inte
en tyst tystnad.

Prova skarpt genom att köra utkorgen en gång och titta under
`/admin/inkorg`. Utkorgen skiljer på *skickat* och *misslyckat fem gånger*.

---

## 6b. Google som källa (valfritt)

Ger tre saker analysen annars saknar: **bolagets webbadress** (som gör att
webbplatsläsaren kan köra utan att fråga användaren), **omdömen och betyg**,
och **verksamhetsstatus** — om Google visar bolaget som öppet, tillfälligt
stängt eller permanent stängt.

Det Google *inte* ger: organisationsnummer, styrelse, F-skatt eller
momsregistrering. Places känner till platser och verksamheter, inte
juridiska personer. Den raden i bakgrundspanelen kräver fortfarande
Bolagsverket eller en kreditupplysare.

1. **DU:** skapa ett Google Cloud-projekt, aktivera **Places API (New)**
   och slå på fakturering. Places debiteras per anrop.
2. **DU:** begränsa nyckeln till Places API. En obegränsad nyckel som
   läcker är någon annans trafik på din faktura.
3. **DU:** sätt `GOOGLE_MAPS_API_KEY` i Vercel och rulla ut.
4. Kontrollera: `curl https://clearance.se/v1/health` ska svara
   `"sources":{"google":true}`.

Utan nyckeln fungerar tjänsten precis som förut — källan redovisas som ej
ansluten i bakgrundspanelen, och analysen blir tunnare. Det är ett giltigt
läge, inte ett fel.

**Om ett bolag inte matchar:** uppslaget kräver att exakt en verksamhet
hos Google heter samma sak som bolaget. Två träffar med samma namn ger
inget svar alls — Google har inget organisationsnummer att skilja dem åt
med, och fel bolags omdömen i en analys är värre än inga omdömen.

---

## 7. De schemalagda jobben

Cron deklareras i `vercel.json` och startar av sig självt vid utrullningen.
Kontrollera i Vercels cron-vy att alla fyra har kört en gång.

Ett jobb som misslyckas svarar **500**, inte 200 — Vercel märker
körningen som misslyckad. Nattjobbets steg körs oberoende av varandra:
kastar gallringen körs faktureringen ändå.

Att köra ett jobb för hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://clearance.se/api/cron/utkorg
```

---

## 8. Innan första betalande kund

Tekniskt går tjänsten att driftsätta utan det här. Att **ta betalt** gör
den inte.

- [ ] **DU:** F-skatt bekräftad mot Skatteverket → `hasFSkatt: true`
- [ ] **DU:** momsregistrering bekräftad — numret i koden är *härlett ur
      organisationsnumret*, inte hämtat ur ett register → `vatRegistered: true`
- [ ] **DU:** bankgironumret ifyllt
- [ ] **DU:** avsändaradress för e-post ifylld
- [ ] **DU:** jurist har granskat policy och villkor, och de tre öppna
      punkterna är beslutade (biträdesavtal, gallringsfrister,
      ansvarsbegränsning)
- [ ] **DU:** personuppgiftsbiträdesavtal med Vercel, databasleverantören
      och AWS (S3) undertecknade — se [docs/subprocessors-dpa.md](subprocessors-dpa.md)
- [ ] **DU:** `CRON_SECRET` satt. Utan den körs inga jobb, alltså ställs
      inga fakturor ut.

Fakturaspärren i `missingInvoiceFields()` är på tills de fyra första är
gjorda. Den är avsiktlig: att ta ut moms utan registrering är inte ett
formfel, det är att kräva in en skatt man inte får kräva in.

---

## Om något går fel

**Rulla tillbaka koden** — Vercel behåller varje utrullning. Använd
*Promote to Production* på den föregående.

**Rulla inte tillbaka migrationer.** Det finns inga nedåtmigrationer, med
flit: en nedåtmigration som körs i panik raderar oftast data som inte går
att få tillbaka. Rätta framåt med en ny migration.

**En kodrullbakåt tar inte tillbaka en migration.** Kör därför aldrig en
migration som tar bort något i samma utrullning som koden som slutar
använda det. Två utrullningar, i den ordningen.

**Databasen** — säkerhetskopieringen är leverantörens. Kontrollera att
point-in-time recovery faktiskt är påslaget innan första kunden, inte
efter.

**Loggarna** finns per funktion i Vercel. En cron-körning som misslyckas
syns som 500 i cron-vyn.

**Om API:t svarar 503 på allt** — leta efter `hastighetsgränsen kunde inte
prövas` i loggen innan du misstänker något annat. Varje anrop räknas mot
`app.rate_limit_hit()` i databasen, och API:t **stänger** när räkningen
inte går att göra: att i stället släppa igenom anropen hade gjort en
databasstörning till ett öppet fönster för lösenordsforcering. Två orsaker,
i den ordning de är sannolika:

1. Migrationerna har inte körts mot den här databasen (funktionen kommer
   ur `20260811100000_hastighetsgrans_i_databasen.sql`).
   `scripts/startkontroll.sh` fångar det som ett STOPP före driftsättning.
2. Databasen är faktiskt nere — och då är 503 rätt svar ändå.

Gränsen är delad mellan alla instanser. Skalar Vercel upp ändras alltså
inte taket, vilket var hela poängen med att flytta räkningen till
databasen.

**Om API:t svarar 401 på varje cron-anrop** — `CRON_SECRET` i Vercel och
det du skickar är inte samma sträng. Svarar den 503 är variabeln inte satt
alls, eller kortare än 16 tecken.
