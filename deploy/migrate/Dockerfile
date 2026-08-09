# CLEARANCE migrations-jobb.
#
# Kör scripts/migrera.sh mot klustrets Postgres, i namnordning, en migration
# per transaktion. Körs som ett k8s Job FÖRE API:t rullas, med en
# SUPERANVÄNDAR-DATABASE_URL - skriptet skapar extensions, roller och scheman
# (bootstrap.sql), inte bara tabeller. Den runtime-rollen app_user duger inte.
#
# Byggs från REPOTS ROT:
#   docker build -f deploy/migrate/Dockerfile -t clearance-migrate .
#
# Körs:
#   docker run --rm -e DATABASE_URL="postgres://<superuser>@db/clearance" clearance-migrate
#   (--torrkor som argument visar bara vad som skulle köras)

FROM postgres:16-alpine
# psql följer med postgres-avbilden; migrera.sh är bash (BASH_SOURCE, [[ ]]).
RUN apk add --no-cache bash
WORKDIR /migrate

# Exakt de sökvägar migrera.sh förväntar sig relativt repo-roten:
#   db/bootstrap.sql, db/tests/storage-stub.sql, supabase/migrations/*.sql
COPY db ./db
COPY supabase/migrations ./supabase/migrations
COPY scripts/migrera.sh ./scripts/migrera.sh
RUN chmod +x scripts/migrera.sh

# Postgres-avbildens egen ickeroot-användare.
USER postgres
ENTRYPOINT ["bash", "scripts/migrera.sh"]
