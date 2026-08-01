#!/usr/bin/env bash
# Proves the security model holds on plain self-hosted Postgres, with no
# Supabase involved: no storage schema, no Supabase auth, identity supplied
# the way our own API will supply it.
#
# The same 45 assertions run here as against the Supabase shim. If they pass
# in both, the migration off Supabase does not weaken row scoping - which is
# the failure this project cannot detect at runtime, because it fails open.
set -euo pipefail

PSQL="psql -h ${PGHOST:-/tmp} -p ${PGPORT:-55432} -U ${PGUSER:-postgres} -q -v ON_ERROR_STOP=1"
DB="${PGDATABASE:-clearance_selfhosted_test}"

$PSQL -d postgres -c "drop database if exists $DB;" -c "create database $DB;" >/dev/null
$PSQL -d "$DB" -c "create extension if not exists citext;" >/dev/null
$PSQL -d "$DB" -f db/bootstrap.sql >/dev/null

# The storage schema was Supabase's. Files live in S3 now, so only the stubs
# the old migrations need to parse are created - nothing depends on them.
$PSQL -d "$DB" -f db/tests/storage-stub.sql >/dev/null

for f in supabase/migrations/*.sql; do
  $PSQL -d "$DB" -f "$f" >/dev/null
done

$PSQL -d "$DB" -f supabase/tests/rls.sql 2>&1 \
  | grep -E "^(NOTICE|ERROR|psql:)|ALL RLS" | sed 's/^NOTICE:  //'
