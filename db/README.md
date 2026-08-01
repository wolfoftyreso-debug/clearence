# Självhostad drift på AWS

Beslut: allt körs i egen AWS-miljö. Inga externa beroenden utanför den om det inte är oundvikligt.

## Vad som redan är bevisat

`npm run test:selfhosted` reser en **ren Postgres utan en rad Supabase** — ingen `storage`-vidhäftning som används, ingen Supabase-auth, identiteten levererad som vårt eget API kommer att leverera den — applicerar samtliga migrationer och kör hela RLS-sviten.

```
Självhostat:   45/45
Supabase-shim: 45/45   (regression, samma svit)
```

Det betyder att flytten **inte försvagar radscopingen**. Det är den enda garanti som räknas här, eftersom felet annars är osynligt: förlorad radscoping *fails open* — frågorna fortsätter fungera och börjar returnera andra bolags insolvensdata.

Samma testfil körs mot båda. Den sätter både `request.jwt.claim.sub` och `app.user_id`, så en skillnad mellan miljöerna syns direkt i stället för i produktion.

## Vad Supabase gjorde, och vad som ersätter det

| Supabase | Självhostat | Status |
|---|---|---|
| Postgres | RDS for PostgreSQL, eller Postgres på EC2 | Migrationer klara och körda |
| `auth.uid()` | `app.current_user_id()`, läser `app.user_id` | **Klart**, `auth.uid()` kvar som alias |
| `auth.users` | Egen tabell med `password_hash` | **Klart** i `db/bootstrap.sql` |
| Sessioner | `auth.sessions`, token lagras som SHA-256 | Schema klart, API saknas |
| Row Level Security | Oförändrad — det var alltid vanlig Postgres | **Klart, 45 tester** |
| Storage-bucket | S3, privat bucket | Metadata klar, signering saknas |
| Signerade URL:er | S3 presigned URLs | `app.may_read_document()` klar |
| Edge function `lookup-company` | Endpoint i eget API | Saknas |
| PostgREST | Eget API | Saknas — se nedan |

## Det som måste byggas

### 1. API:et

Klienten pratar idag PostgREST via Supabase-klienten. Självhostat behövs ett eget API. `DataPort` i `src/data/ports.ts` är redan hela kontraktet — en `awsAdapter` som uppfyller det är enda ändringen ovanför datalagret, plus en rad i `src/data/index.ts`.

**Den enda regel som får API:et att bevara säkerhetsmodellen:**

```sql
BEGIN;
SELECT set_config('app.user_id', $1, true);   -- true = transaktionslokal
-- användarens frågor här
COMMIT;
```

`true` är inte en detalj. En sessionslokal inställning på en poolad anslutning läcker föregående requests identitet till nästa. I den här produkten betyder det att ett bolag ser ett annat bolags insolvensdata. Sätt den transaktionslokalt, i samma transaktion som frågorna, alltid.

API:et ansluter som `app_user`. Den rollen får **aldrig** äga en tabell och **aldrig** ha `BYPASSRLS` — båda stänger av radscopingen tyst.

### 2. Autentisering

Egen. Lösenordshash med argon2id (eller bcrypt) i API:et; databasen har ingen funktion som kan hasha eller verifiera ett lösenord, så en databaskompromiss ger ingen verifieringsorakel. Sessionstoken lagras bara som SHA-256 — en databasdump får inte vara en uppsättning fungerande sessioner.

BankID hör hemma här när signering byggs, och är då ett externt beroende som är oundvikligt.

### 3. Filer

S3, privat bucket, SSE-KMS. Nyckelprefix är ärendets id, som idag.

**Signera aldrig en URL utan att först ha frågat `app.may_read_document(id)`.** En signerad URL kringgår all databasbehörighet — det är hela poängen med den. Kort giltighet, 60 sekunder som idag.

### 4. Utgående e-post

SES. Det är AWS, alltså innanför gränsen. Alternativet, egen SMTP-server, kostar leveransbarhet utan att köpa något i gengäld: e-post till borgenärer måste komma fram, och en egen avsändare utan uppvärmt rykte hamnar i skräpposten.

**Byggt:** mejlen går genom en utkorg (`public.outbound_emails`), inte genom direktanrop. Raden skapas i samma transaktion som fakturan, så det kan inte finnas ett mejl om en faktura som inte finns, eller en faktura vars mejl tyst försvann. Arbetaren är `db/email-worker.mjs`:

```
# crontab i driftmiljön
*/5 * * * *  node db/email-worker.mjs           # skicka det som väntar
15 3 * * *   node db/email-worker.mjs --close   # stäng förfallna konton
```

`claim_outbound_emails()` låser med `for update skip locked`, så två arbetare skickar aldrig samma rad. Efter fem misslyckade försök blir raden `failed` och syns i driftvyn under Kunder - den plockas aldrig om automatiskt, för en adress som studsar studsar även försök sextio.

Stängningsjobbet `close_overdue_accounts()` är idempotent, jämför svenska kalenderdagar (fristen ska inte bero på vilket klockslag fakturan råkade ställas ut), rör aldrig ett betalt konto och raderar ingenting. Testat i `supabase/tests/billingJob.sql`, i båda miljöerna.

## Externa beroenden, och varför

| Beroende | Oundvikligt? | Motivering |
|---|---|---|
| AWS (EC2/RDS/S3/SES/KMS) | Ja | Det är plattformen |
| BankID | Ja, för signering | Finns ingen självhostad motsvarighet |
| Fortnox/Visma m.fl. | Bara om kunden vill | Frivillig integration, en per adapter |
| Bolagsverket | Nej, men | Ersätter manuell inmatning av företagsuppgifter |

**Inget annat.** Ingen SaaS-analys, ingen extern felrapportering, ingen extern AI-tjänst — insiktsmotorn i `src/lib/financial/insights.ts` är deterministisk och anropar ingenting.

**Inga CDN-typsnitt.** Det här påståendet var osant fram till att typsnitten lades i repot: `src/index.css` hämtade DM Sans från Googles CDN vid varje sidladdning. Det innebar att besökarens IP-adress gick till tredje part innan sidan ritades ut — och besökaren här är ett bolag som håller på att gå omkull. LG München I (3 O 17493/20) har slagit fast att just det upplägget kräver samtycke enligt GDPR. Typsnitten ligger nu i `src/assets/fonts/` (SIL OFL 1.1) och bygget gör noll externa anrop, vilket verifieras av `npm run test:external`.

## Datalagring

Region `eu-north-1` (Stockholm) eller `eu-central-1`. Kryptering i vila via KMS med egen nyckel, i transit via TLS. Backup med point-in-time recovery.

**ANTAGANDE som måste avgöras juridiskt:** hur länge revisionsspåret ska bevaras efter avslutat ärende, och hur det förhåller sig till en begäran om radering. Se kommentaren på `public.audit_events`. Gallringsregler ska sättas per dokumenttyp innan skarp drift.

## Kör testerna

```bash
# Postgres måste vara igång; se db/tests/run.sh för anslutningsvariabler
npm run test:selfhosted   # ren Postgres, ingen Supabase
npm run test:rls          # Supabase-shim, regression
```

Båda ska ge `ALL RLS TESTS PASSED` och 45 `ok`. Går de isär har radscopingen ändrats i den ena miljön, och det ska stoppa en release.
