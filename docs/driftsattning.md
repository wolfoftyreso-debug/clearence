# Driftsättning

Körordningen från tomt AWS-konto till en tjänst som svarar. Skriven för att
följas uppifrån och ned, en gång, av en människa som inte har hela systemet
i huvudet.

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
- AWS-adaptern är delvis migrerad → resten delegeras öppet till Supabase.

### DU: fyra beslut som ska vara fattade först

| Beslut | Var det landar |
|---|---|
| Domänen `clearance.se` delegerad till Route 53? | `hosted_zone_id` i tfvars |
| Vilken adress skickar vi e-post ifrån? | `mail_from_address` |
| Vart går driftlarmen? | `alert_email` |
| Staging först, eller direkt prod? | `environment` |

Kör staging först. Det kostar en kvälls väntan och sparar den första
riktiga incidenten.

---

## 1. AWS-kontot och terraform-tillståndet

Terraform behöver en plats att lägga sitt tillstånd. Den platsen kan inte
skapas av terraform självt — därför en gång för hand:

```bash
aws s3api create-bucket --bucket clearance-tfstate \
  --region eu-north-1 \
  --create-bucket-configuration LocationConstraint=eu-north-1
aws s3api put-bucket-versioning --bucket clearance-tfstate \
  --versioning-configuration Status=Enabled
aws dynamodb create-table --table-name clearance-tflock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST --region eu-north-1
```

Versionering på hinken är inte en detalj: ett förlorat terraform-tillstånd
betyder att infrastrukturen finns men att terraform inte längre vet om den,
och vägen tillbaka är import av varje resurs för hand.

---

## 2. Variablerna

```bash
cp infra/terraform.tfvars.example infra/terraform.tfvars
```

Filen är kommenterad fält för fält. Den innehåller **inga hemligheter** —
lösenord och nycklar bor i Secrets Manager och skapas av terraform.

Låt `enable_compute = false` stå kvar. API och arbetare startar först i
steg 5, när avbilderna finns i ECR.

---

## 3. Första apply — nät, databas, hinkar

```bash
terraform -chdir=infra init
terraform -chdir=infra plan -out=plan.tfplan   # LÄS DENNA
terraform -chdir=infra apply plan.tfplan
```

**Läs planen.** Det är enda gången du ser exakt vad som skapas innan det
kostar pengar, och den tar tio minuter att läsa.

Certifikatet väntar på DNS-validering. Har du inte delegerat domänen ännu
skriver terraform ut vilka CNAME-poster som ska läggas in hos nuvarande
DNS-leverantör; certifikatet blir giltigt inom några minuter efter det.

---

## 4. Migrationerna

Databasen ligger i ett privat subnät och nås inte utifrån. Öppna en tunnel
via bastionen:

```bash
aws ssm start-session --target "$(terraform -chdir=infra output -raw bastion_instance_id)" \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters "host=$(terraform -chdir=infra output -raw db_endpoint),portNumber=5432,localPortNumber=55432"
```

I ett annat fönster:

```bash
export DATABASE_URL="postgres://clearance:LÖSENORD@127.0.0.1:55432/clearance?sslmode=require"
scripts/migrera.sh --torrkor    # visa vad som skulle köras
scripts/migrera.sh              # kör
```

Lösenordet hämtas ur Secrets Manager:

```bash
aws secretsmanager get-secret-value \
  --secret-id "$(terraform -chdir=infra output -raw db_secret_arn)" \
  --query SecretString --output text
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

## 5. Avbilderna och beräkningen

```bash
REG="$(aws sts get-caller-identity --query Account --output text).dkr.ecr.eu-north-1.amazonaws.com"
aws ecr get-login-password --region eu-north-1 | docker login --username AWS --password-stdin "$REG"
TAGG="sha-$(git rev-parse --short HEAD)"

docker build -f api/Dockerfile -t "$REG/clearance-api:$TAGG" .
docker build -f db/Dockerfile  -t "$REG/clearance-worker:$TAGG" .
docker push "$REG/clearance-api:$TAGG"
docker push "$REG/clearance-worker:$TAGG"

terraform -chdir=infra apply \
  -var="enable_compute=true" \
  -var="api_image=$REG/clearance-api:$TAGG" \
  -var="worker_image=$REG/clearance-worker:$TAGG"
```

Avbilderna byggs **från repots rot**, inte från `api/` — bygget behöver
`package.json` och källan tillsammans.

Kontrollera att API:t lever innan du går vidare:

```bash
curl -s https://api.clearance.se/v1/health
```

> ALB:n hälsokontrollerar `/v1/health`. Att den en gång pekade på
> `/health` är värt att minnas: varje uppgift underkändes och dödades i en
> loop, och det enda symtomet var en driftsättning som aldrig blev klar.
> Startkontrollen jämför numera de två.

---

## 6. Frontenden

```bash
VITE_API_BASE_URL=https://api.clearance.se \
VITE_DATA_ADAPTER=aws \
VITE_DEMO_MODE=false \
npx vite build

BUCKET="$(terraform -chdir=infra output -raw frontend_bucket)"
aws s3 sync dist/ "s3://$BUCKET/" --delete \
  --exclude index.html --exclude sw.js \
  --cache-control "public,max-age=31536000,immutable"
aws s3 cp dist/index.html "s3://$BUCKET/index.html" --cache-control "no-cache,must-revalidate"
aws s3 cp dist/sw.js      "s3://$BUCKET/sw.js"      --cache-control "no-cache,must-revalidate"
aws cloudfront create-invalidation \
  --distribution-id "$(terraform -chdir=infra output -raw cloudfront_distribution_id)" --paths "/*"
```

**`index.html` och `sw.js` får aldrig cachas.** Hashade tillgångar är
oföränderliga och cachas ett år; `index.html` pekar ut vilken version som
gäller, och en cachad `index.html` låser besökare vid ett gammalt bygge.
Cachas service-workern kan dessutom en trasig worker aldrig ersättas.

`VITE_DEMO_MODE=false` är inte valfritt. Startkontrollen och CI faller
båda om ordet DEMOLÄGE hittas i en produktionsbunt.

---

## 7. E-post

SES startar i sandlådan och skickar bara till verifierade adresser.

1. Verifiera domänen (terraform lägger DKIM-posterna om zonen är känd).
2. **DU:** begär utträde ur sandlådan i SES-konsolen. Tar ett par dagar.
3. Prova skarpt genom att köra arbetaren en gång och titta i utkorgen
   under `/admin/inkorg`.

Tills utträdet är klart går inga mejl fram till riktiga kunder. Utkorgen
visar det — den skiljer på *skickat* och *misslyckat fem gånger*.

---

## 7b. Google som källa (valfritt)

Ger tre saker analysen annars saknar: **bolagets webbadress** (som gör att
webbplatsläsaren kan köra utan att fråga användaren), **omdömen och betyg**,
och **verksamhetsstatus** — om Google visar bolaget som öppet, tillfälligt
stängt eller permanent stängt.

Det Google *inte* ger: organisationsnummer, styrelse, F-skatt eller
momsregistrering. Places känner till platser och verksamheter, inte
juridiska personer. Den raden i bakgrundspanelen kräver fortfarande
Bolagsverket eller en kreditupplysare.

**ORDNINGEN ÄR INTE VALFRI.** Slås flaggan på innan nyckeln finns kan ECS
inte läsa hemligheten, och API-uppgifterna startar om i evighet — samma
felklass som en hälsokontroll mot fel sökväg.

1. **DU:** skapa ett Google Cloud-projekt, aktivera **Places API (New)**
   och slå på fakturering. Places debiteras per anrop.
2. **DU:** begränsa nyckeln till Places API. En obegränsad nyckel som
   läcker är någon annans trafik på din faktura.
3. **DU:** lägg in nyckeln i integrationshemligheten, under fältet
   `google_maps_api_key`:

   ```bash
   aws secretsmanager put-secret-value \
     --secret-id clearance-prod/integrations \
     --secret-string '{"google_maps_api_key":"..."}'
   ```

4. Sätt `enable_google_source = true` i tfvars och kör `terraform apply`.
5. Kontrollera: `curl https://api.<domän>/v1/health` ska svara
   `"sources":{"google":true}`.

Med flaggan av fungerar tjänsten precis som förut — källan redovisas som
ej ansluten i bakgrundspanelen, och analysen blir tunnare. Det är ett
giltigt läge, inte ett fel.

**Om ett bolag inte matchar:** uppslaget kräver att exakt en verksamhet
hos Google heter samma sak som bolaget. Två träffar med samma namn ger
inget svar alls — Google har inget organisationsnummer att skilja dem åt
med, och fel bolags omdömen i en analys är värre än inga omdömen.

---

## 8. Automatiken

När första driftsättningen gått igenom för hand tar `.github/workflows/`
över.

- **`ci.yml`** — körs på varje push: enhetsbatteriet, byggen, migrationer
  på tom databas, databas- och API-sviterna, alla webbläsarsviter.
- **`driftsatt.yml`** — startas **för hand** via *Run workflow*.

Driftsättningen använder **OIDC**, inte lagrade AWS-nycklar. Skapa rollen
en gång:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com
```

Förtroendepolicyn ska begränsa till just det här repot och gärna till
miljön — annars kan vilket repo som helst i världen anta rollen:

```json
{
  "Condition": {
    "StringEquals": {
      "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
      "token.actions.githubusercontent.com:sub": "repo:wolfoftyreso-debug/rekonstruktion:environment:prod"
    }
  }
}
```

### DU: i GitHub

| Typ | Namn | Värde |
|---|---|---|
| Variable | `AWS_DEPLOY_ROLE_ARN` | rollens ARN |
| Variable | `VITE_API_BASE_URL` | `https://api.clearance.se` |
| Secret | `DATABASE_URL` | anslutningen för migrationerna |
| Environment | `prod` | med *required reviewers* = du |

Kravet på granskare är inte byråkrati. Det är det som gör att en
driftsättning mot prod inte kan ske av misstag klockan halv tolv på
kvällen.

---

## 9. Innan första betalande kund

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
- [ ] **DU:** personuppgiftsbiträdesavtal med AWS undertecknat
- [ ] Månadsjobbens fakturanummer flyttade till `app.next_invoice_number()`

Fakturaspärren i `missingInvoiceFields()` är på tills de fyra första är
gjorda. Den är avsiktlig: att ta ut moms utan registrering är inte ett
formfel, det är att kräva in en skatt man inte får kräva in.

---

## Om något går fel

**Rulla tillbaka koden** — avbilderna ligger kvar i ECR med sin
commit-tagg:

```bash
terraform -chdir=infra apply -var="api_image=$REG/clearance-api:sha-FÖRRA"
```

**Rulla inte tillbaka migrationer.** Det finns inga nedåtmigrationer, med
flit: en nedåtmigration som körs i panik raderar oftast data som inte går
att få tillbaka. Rätta framåt med en ny migration.

**Databasen** har automatiska ögonblicksbilder med den retention som står
i tfvars, plus point-in-time recovery. En återställning skapar en *ny*
instans — den skriver inte över den trasiga, så du hinner jämföra.

**Loggarna** finns i CloudWatch under `/clearance/`. Larmen går till
`alert_email`.

**Om API:t svarar 503 på allt** — leta efter `hastighetsgränsen kunde inte
prövas` i loggen innan du misstänker något annat. Varje anrop räknas mot
`app.rate_limit_hit()` i databasen, och API:t **stänger** när räkningen
inte går att göra: att i stället släppa igenom anropen hade gjort en
databasstörning till ett öppet fönster för lösenordsforcering. Två orsaker,
i den ordning de är sannolika:

1. Migrationerna har inte körts mot den här databasen (funktionen kommer
   ur `20260811100000_hastighetsgrans_i_databasen.sql`). `scripts/startkontroll.sh`
   fångar det som ett STOPP före driftsättning.
2. Databasen är faktiskt nere — och då är 503 rätt svar ändå.

Gränsen är delad mellan alla uppgifter. Skalar du upp tjänsten ändras
alltså inte taket, vilket var hela poängen med att flytta räkningen hit.
