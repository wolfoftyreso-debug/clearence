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
- **`app_api`** — rättighetssamling, NOLOGIN. Bär de **två** tabeller
  anonymvägen behöver: `select` på `auth.users` och `select/insert/update` på
  `auth.sessions`. Inget `delete` — en session återkallas, den raderas inte.
- **`clearance_api`** — API:ets roll: LOGIN, medlem i `authenticated` **och
  `app_api`**, **aldrig** BYPASSRLS. Radskyddet gäller varje klientfråga.

**Varför `app_api` behövs, och hur det upptäcktes.** `withUser()` växlar till
`authenticated`; `withAnon()` byter aldrig roll och kör som anslutningens egen.
Anonymvägen bär inloggningen, sessionsuppslaget och utloggningen — och
`auth.users`/`auth.sessions` är med flit revoke:ade från klientrollerna. Utan
medlemskapet i `app_api` svarar API:t därför **403 på varje inloggningsförsök**
(42501 i loggen), trots att `/v1/health` är grönt. Det syntes inte i sviterna:
`api/tests/run.sh` ansluter som ägaren, som går förbi allt. Det hittades genom
att starta den **byggda** artefakten mot en icke-ägande roll.

Migrations-jobbet sätter deras lösenord ur `selfhost-*-password`. Modellen är
vaktad i `db/tests/roles.sql` (körs i CI-jobbet `databas`): app_worker får röra
utkorgen, `authenticated` nekas samma insert av radskyddet, `app_api` har exakt
de rättigheter inloggningen kräver och varken mer eller mindre, och
`authenticated` når fortfarande varken lösenordshashar eller sessioner.

## Installera

```sh
helm upgrade --install clearance deploy/helm/clearance \
  -n clearance --create-namespace \
  -f deploy/helm/clearance/values-prod.example.yaml \
  --set image.tag=$GIT_SHA
```

Migrations-Jobbet kör `scripts/migrera.sh` som en `pre-install,pre-upgrade`-hook
före API:t rullas. Det är idempotent (`schema_migrations`).

## Dokumentlagringen

API:t signerar kortlivade nedladdnings-URL:er mot MinIO/S3
(`api/server/storage.ts`) efter `app.may_read_document()` — `storage_path`
lämnar aldrig servern. När `minio.enabled=true` pekas API:t hit automatiskt
(`documents.*`); sätt `documents.endpoint`/`region`/`credentials` för att peka
på AWS S3 eller extern MinIO i stället. `/v1/health` rapporterar `storage:
true` när en hink är konfigurerad; tom hink ⇒ `/v1/documents/{id}/url` svarar
404 (byggt, men ej anslutet).

## Vad som INTE är byggt än (ärligt)

- Delar av `DataPort` går ännu mot Supabase (halvmigrerat) — en ren
  självhostad körning kräver att migreringen slutförs.
