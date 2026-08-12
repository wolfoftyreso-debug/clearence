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

# SJÄLVHOSTADE ROLLER. bootstrap.sql skapar app_user/authenticated som NOLOGIN
# och en migration REVOKE:ar arbetarfunktionerna "för att app_worker äger dem"
# - men app_worker skapades aldrig. Den här filen skapar den (betrodd batch-
# roll, bypassrls) med sina grants. Idempotent, körs varje gång.
if [[ $TORRKOR -eq 0 ]]; then
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$ROT/db/roles-selfhosted.sql"

  # Inloggningsrollerna som klustret ANSLUTER med, med lösenord ur miljön.
  # Sätts bara när lösenorden angetts - annars förblir rollerna NOLOGIN och
  # ingen kan logga in på dem (rätt för t.ex. CI:s migreringssteg).
  #   app_worker            arbetaren ansluter som den (bypassrls)
  #   clearance_api         API:t ansluter som den (medlem i authenticated
  #                         OCH app_api, ALDRIG bypassrls - den betjänar
  #                         klientfrågor och bär anonymvägens inloggning)
  # Heredoc (stdin) så psql tolkar :'var' säkert - lösenordet citeras av
  # psql och kan inte injiceras, oavsett tecken.
  if [[ -n "${SELFHOST_WORKER_PASSWORD:-}" ]]; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -v wpw="$SELFHOST_WORKER_PASSWORD" <<'SQL'
alter role app_worker login password :'wpw';
SQL
    echo "  app_worker: inloggning påslagen."
  fi
  if [[ -n "${SELFHOST_API_PASSWORD:-}" ]]; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -v apw="$SELFHOST_API_PASSWORD" <<'SQL'
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'clearance_api') then
    create role clearance_api login;
  end if;
end $$;
grant authenticated to clearance_api;
-- OCH app_api: rättighetssamlingen som bär ANONYMVÄGEN.
--
-- withUser() växlar till authenticated och fungerade utan detta.
-- withAnon() byter aldrig roll - den kör som anslutningens egen roll, och
-- den vägen bär inloggningen, sessionsuppslaget och utloggningen.
-- auth.users/auth.sessions är revoke:ade från klientrollerna med flit, så
-- utan medlemskapet här svarar API:t 403 på VARJE inloggningsförsök
-- (42501). Det upptäcktes genom att starta den byggda artefakten mot en
-- icke-ägande roll; sviterna kunde inte se det, för de ansluter som ägaren.
grant app_api to clearance_api;
alter role clearance_api login password :'apw';
SQL
    echo "  clearance_api: inloggning påslagen."
  fi
fi
