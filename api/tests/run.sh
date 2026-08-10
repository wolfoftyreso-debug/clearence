#!/usr/bin/env bash
# Reser en ren databas med hela schemat och kör API:t mot den.
#
# Samma bootstrap som db/tests/run.sh: ren Postgres, ingen Supabase, och
# identiteten levererad så som API:t faktiskt levererar den. Skillnaden är
# att den här sviten går genom HTTP-lagret i stället för genom psql - det
# är där behörighetsbuggarna bor i en riktig drift.
set -euo pipefail

PSQL="psql -h ${PGHOST:-/tmp} -p ${PGPORT:-55432} -U ${PGUSER:-postgres} -q -v ON_ERROR_STOP=1"
DB="${PGDATABASE:-clearance_api_test}"

$PSQL -d postgres -c "drop database if exists $DB;" -c "create database $DB;" >/dev/null
$PSQL -d "$DB" -c "create extension if not exists citext;" >/dev/null
$PSQL -d "$DB" -f db/bootstrap.sql >/dev/null
$PSQL -d "$DB" -f db/tests/storage-stub.sql >/dev/null
for f in supabase/migrations/*.sql; do
  $PSQL -d "$DB" -f "$f" >/dev/null
done

# Rollen app_user är nologin och sätts med SET LOCAL ROLE inne i varje
# transaktion. Anslutningen sker som superanvändaren i testet - i drift är
# det en egen login-roll som INTE äger tabellerna. Att testet ansluter som
# ägaren är ofarligt just för att withUser() alltid byter roll först, och
# det är precis den mekanismen sviten prövar.
export DATABASE_URL="postgres://${PGUSER:-postgres}@localhost:${PGPORT:-55432}/${DB}?host=${PGHOST:-/tmp}"

# Dokumentlagringen MÅSTE se ansluten ut här, annars kortsluter
# /v1/documents/{id}/url på "lagringen är inte ansluten" och
# behörighetsprövningen (app.may_read_document) körs aldrig i sviten - den
# skulle vara oprövad och se grön ut. Ingen nyckel behövs: den som nekas
# får 404 långt innan något signeras.
export DOCUMENTS_BUCKET="clearance-test-bucket"

# Hastighetsgränsens nyckel prövas mot ETT betrott mellanled, som i driften.
export TRUSTED_PROXY_HOPS="1"

# AWS SDK:n lämnas extern: den lastas bara när dokumentlagringen faktiskt
# används, och dess CJS-interna dynamic require("node:https") går inte att
# bunta till ESM. Node löser den ur node_modules vid körning.
npx esbuild api/tests/integration.ts \
  --bundle --platform=node --format=esm --target=node20 \
  --external:pg \
  --external:@aws-sdk/client-s3 --external:@aws-sdk/s3-request-presigner \
  --outfile=node_modules/.cache/api-integration.mjs --log-level=error

node node_modules/.cache/api-integration.mjs
