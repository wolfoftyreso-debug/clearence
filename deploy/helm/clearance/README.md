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
| `database-url` | app_user (LOGIN) | icke-ägare, ingen BYPASSRLS |
| `worker-database-url` | app_worker (LOGIN) | arbetaren |
| `migrate-database-url` | superanvändare | skapar roller/extensions |
| `anthropic-api-key` | — | valfri (tom = samtalet ej anslutet) |
| `google-maps-api-key` | — | valfri |

Håll värdena utanför git (SOPS/age eller Sealed Secrets).

## ⚠️ Roll-wiringen (den enda biten som inte är turnkey)

`db/bootstrap.sql` skapar `app_user`/`app_worker` som **NOLOGIN** (och
`app_worker` skapas i själva verket inte alls — se `docs/selfhosted-kubernetes.md`).
Egenhostat måste därför **LOGIN-roller** finnas — en medlem i `authenticated`
för API:t och en i `app_worker` för arbetaren — med lösenord som matchar
`database-url`/`worker-database-url`. Det är load-bearing SQL som ska prövas
mot en riktig Postgres (CI-jobbet `databas`), inte gissas i YAML. Tills den
körts loggar API:t anslutningsfel. Chartet reser allt annat; den här raden är
det medvetet lämnade steget.

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
- **SMTP-transporten** i e-postarbetaren (`mailTransport: smtp`) — kopplas in
  i nästa steg; tills dess är SES-vägen den byggda.
- **Aviseringsarbetarens avbild** (`worker.notification.enabled`) — behöver en
  egen build (`db/Dockerfile` bygger bara e-postarbetaren).
- Delar av `DataPort` går ännu mot Supabase (halvmigrerat) — en ren
  självhostad körning kräver att migreringen slutförs.
