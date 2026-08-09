# clearance (Helm-chart)

Helt egenhostad CLEARANCE på Kubernetes: API, frontend (nginx som servar
SPA:n och proxar `/v1`), e-postarbetarens sju CronJobs, självhostad Postgres
(CloudNativePG), MinIO och ett migrations-Job som Helm-hook. Arkitekturen och
besluten står i `docs/selfhosted-kubernetes.md`.

## Förkrav i klustret

- **CloudNativePG-operatorn** (för `postgres.enabled=true`).
- **ingress-nginx** (ingressklassen) och **cert-manager** (för automatisk TLS).
- En **container-registry** som klustret kan dra från (Giteas inbyggda).

## Hemligheter (skapas utanför chartet i drift)

En Secret (peka ut med `secret.existingSecret`) med nycklarna:

| Nyckel | Roll | Notis |
|---|---|---|
| `database-url` | clearance_api (LOGIN) | medlem i `authenticated`, **aldrig** BYPASSRLS |
| `worker-database-url` | app_worker (LOGIN) | betrodd batch-roll, BYPASSRLS |
| `migrate-database-url` | superanvändare | skapar roller/extensions |
| `selfhost-api-password` | — | lösenord migrera.sh sätter på clearance_api |
| `selfhost-worker-password` | — | lösenord migrera.sh sätter på app_worker |
| `anthropic-api-key` | — | valfri (tom = samtalet ej anslutet) |
| `google-maps-api-key` | — | valfri |

`selfhost-*-password` måste matcha lösenorden i `database-url`/`worker-database-url`.
Håll värdena utanför git (SOPS/age eller Sealed Secrets).

## Rollmodellen (byggd och prövad)

`db/bootstrap.sql` skapar `app_user`/`authenticated` som NOLOGIN, och en
migration revoke:ar arbetarfunktionerna "för att app_worker äger dem" — men
`app_worker` skapades aldrig. `db/roles-selfhosted.sql` (kör av `migrera.sh`
efter migrationerna) tätar det:

- **`app_worker`** — betrodd batch-roll med **BYPASSRLS**. Den arbetar per sin
  natur över alla tenants (skickar allas post, kontrollerar allas krediter);
  BYPASSRLS är rätt här och **bara** här.
- **`clearance_api`** — API:ets roll: LOGIN, medlem i `authenticated`, **aldrig**
  BYPASSRLS. Radskyddet gäller varje klientfråga.

Migrations-jobbet sätter deras lösenord ur `selfhost-*-password`. Modellen är
vaktad i `db/tests/roles.sql` (körs i CI-jobbet `databas`): app_worker får röra
utkorgen, `authenticated` nekas samma insert av radskyddet.

## Installera

```sh
helm upgrade --install clearance deploy/helm/clearance \
  -n clearance --create-namespace \
  -f deploy/helm/clearance/values-prod.example.yaml \
  --set image.tag=$GIT_SHA
```

Migrations-Jobbet kör `scripts/migrera.sh` som en `pre-install,pre-upgrade`-hook
före API:t rullas. Det är idempotent (`schema_migrations`).

## Vad som INTE är byggt än (ärligt)

- **Dokumentens presignering** i API:t (MinIO reses, men S3-signeringskoden
  saknas — se `db/README.md`).
- Delar av `DataPort` går ännu mot Supabase (halvmigrerat) — en ren
  självhostad körning kräver att migreringen slutförs.
