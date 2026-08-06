#!/usr/bin/env bash
#
# Kör migrationerna mot en databas, i namnordning, en i taget.
#
#   DATABASE_URL="postgres://..." scripts/migrera.sh          # kör
#   DATABASE_URL="postgres://..." scripts/migrera.sh --torrkor # visar bara
#
# TRE REGLER SOM SKRIPTET INTE BÖJER PÅ:
#
#  1. VARJE MIGRATION KÖRS I EN EGEN TRANSAKTION, och en som misslyckas
#     rullas tillbaka. Halvt applicerade scheman är hur en databas hamnar
#     i ett läge ingen kan resonera om.
#  2. EN MIGRATION KÖRS EN GÅNG. Vilka som körts står i tabellen
#     schema_migrations, som skriptet skapar själv vid första körningen.
#  3. NAMNORDNING ÄR KÖRORDNING. Filnamnen börjar med tidsstämpel, och
#     `sort` ger då rätt ordning. Byt aldrig namn på en migration som
#     körts - då körs den igen.
#
# Skriptet rör aldrig data, bara schema. Ta en ögonblicksbild av RDS före
# första körningen i en miljö som har riktiga kunder i sig.

set -euo pipefail

TORRKOR=0
[[ "${1:-}" == "--torrkor" ]] && TORRKOR=1

: "${DATABASE_URL:?DATABASE_URL måste vara satt}"

ROT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KATALOG="$ROT/supabase/migrations"

command -v psql >/dev/null || { echo "psql saknas i PATH"; exit 1; }

# GRUNDPLÅTEN FÖRST.
#
# Migrationerna är skrivna för Supabase och förutsätter schemat `auth`
# med users-tabellen och rollerna. På en ren RDS finns inget av det, och
# den andra migrationen faller på "schema auth does not exist" - vilket
# är precis vad som hände första gången det här skriptet kördes.
#
# db/bootstrap.sql reser det Supabase brukade tillhandahålla. Den är
# idempotent och körs varje gång: en miljö som redan har den påverkas
# inte, och en ny miljö kan inte glömma bort den.
# Tilläggen först: bootstrap.sql använder citext, och pgcrypto behövs för
# gen_random_uuid() på Postgres före 13. Båda finns i RDS standardutbud.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q \
  -c "create extension if not exists citext" \
  -c "create extension if not exists pgcrypto"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$ROT/db/bootstrap.sql"

# Lagringsschemat var Supabases. Filerna ligger i S3 nu, men de gamla
# migrationerna refererar till det och måste kunna tolkas.
if [ -f "$ROT/db/tests/storage-stub.sql" ]; then
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$ROT/db/tests/storage-stub.sql"
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
create table if not exists public.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);
SQL

KORDA=$(psql "$DATABASE_URL" -tAc "select version from public.schema_migrations")

antal=0
for fil in $(ls "$KATALOG"/*.sql | sort); do
  version="$(basename "$fil")"
  if grep -qxF "$version" <<<"$KORDA"; then
    printf '  redan körd  %s\n' "$version"
    continue
  fi
  if [[ $TORRKOR -eq 1 ]]; then
    printf '  SKULLE KÖRA %s\n' "$version"
    antal=$((antal + 1))
    continue
  fi
  printf '  kör         %s ... ' "$version"
  # En transaktion per fil. Migrationen och dess bokföring commitas
  # tillsammans, så en avbruten körning aldrig kan bokföra en migration
  # som inte gick igenom.
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q --single-transaction \
    -f "$fil" \
    -c "insert into public.schema_migrations (version) values ('$version')"
  printf 'klart\n'
  antal=$((antal + 1))
done

if [[ $antal -eq 0 ]]; then
  echo "Inget att göra - databasen är i fas."
else
  echo "$antal migration(er) $([[ $TORRKOR -eq 1 ]] && echo 'skulle köras' || echo 'körda')."
fi
