# infra/ — driftmiljön som kod

Terraform för hela AWS-miljön. Besluten bakom finns i `db/README.md`;
kartan över hur delarna hänger ihop med produkten finns i
`docs/infrastructure.md`. Den här filen är bara körinstruktionen.

## Filerna, i läsordning

| Fil | Vad den reser |
|---|---|
| `versions.tf` | Terraform- och providerversioner, fjärrstate (kommenterad tills kontot finns) |
| `variables.tf` | Allt som går att ställa in, med skälet i beskrivningen |
| `main.tf` | Namn, taggar, zoner — och arbetarens sex körningar som data |
| `network.tf` | VPC, tre subnätslager, NAT, S3-endpoint, brandväggsregler |
| `kms.tf` | Fyra nycklar: databas, dokument, hemligheter, loggar |
| `database.tf` | RDS PostgreSQL 16, `force_ssl`, PITR, förbättrad övervakning |
| `storage.tf` | S3: handlingar (privat, KMS, versionerad), webbapp, åtkomstloggar |
| `frontend.tf` | CloudFront + OAC, ACM, WAF, säkerhetsrubriker, DNS |
| `compute.tf` | ECS-kluster, API-tjänst bakom ALB, arbetaren på schema |
| `email.tf` | SES: domänidentitet, DKIM, SPF, DMARC, studsbevakning |
| `secrets.tf` | Secrets Manager: anslutningssträngar och platsen för integrationsnycklar |
| `observability.tf` | Loggrupper, larm, CloudTrail |
| `outputs.tf` | Det man behöver för utrullning — aldrig en hemlighet |

## Kör

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars   # fyll i domän och adress
terraform init
terraform plan -out=plan.out                    # LÄS planen
terraform apply plan.out
```

`terraform plan` ska läsas, inte scrollas förbi. Det som reses här bär
insolvensdata för riktiga bolag.

## Ordningen som gäller

1. **Terraform först** — nät, databas, lagring, e-post.
2. **`db/bootstrap.sql`** — skapar `app_user` (utan `BYPASSRLS`, äger
   ingen tabell) och `app_worker`. Terraform äger maskinen, migrationerna
   äger innehållet.
3. **Migrationerna** — `supabase/migrations/*.sql` i filnamnsordning.
4. **`npm run test:selfhosted`** mot den nya databasen. Går den inte
   igenom är radskyddet inte på plats, och då finns det inget att rulla
   ut.
5. **Webbappen** — `terraform output deploy_command` ger de tre stegen.
6. **`enable_compute = true`** när avbilderna finns i ECR.

## Vad som är verifierat här, och vad som inte är det

* `terraform fmt` går igenom — filerna parsas av Terraform 1.9.8.
* `terraform validate` (schemakontroll mot AWS-providern) har **inte**
  körts: utvecklingsmiljön når inte `registry.terraform.io`, så providern
  går inte att hämta. Kör det första gången i en miljö med nätåtkomst.
* Ingenting är applicerat. Det finns inget AWS-konto kopplat till repot
  ännu — den här katalogen är kartan och beställningen, inte ett kvitto.

## Kostnad, ungefärlig grundnivå

Med `enable_compute = false` (nät, databas, lagring, CDN, e-post):
databasen dominerar. `db.t4g.small` multi-AZ + 50 GB gp3 + en NAT +
CloudFront-trafik för en pilot landar i storleksordningen **150–250
USD/månad**. Med API-tjänsten igång (två Fargate-uppgifter à 0,5 vCPU)
tillkommer ungefär 35 USD/månad. Siffrorna är en storleksordning för
budgetsamtalet, inte en offert.
