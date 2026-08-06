#!/usr/bin/env bash
# Applies the harness, every migration and the RLS tests to a throwaway
# database. Fails on the first error, so this is safe to run in CI.
set -euo pipefail

PSQL="psql -h ${PGHOST:-/tmp} -p ${PGPORT:-55432} -U ${PGUSER:-postgres} -q -v ON_ERROR_STOP=1"
DB="${PGDATABASE:-clearance_rls_test}"

$PSQL -d postgres -c "drop database if exists $DB;" -c "create database $DB;" >/dev/null
$PSQL -d "$DB" -f supabase/tests/harness.sql >/dev/null

for f in supabase/migrations/*.sql; do
  $PSQL -d "$DB" -f "$f" >/dev/null
done

$PSQL -d "$DB" -f supabase/tests/rls.sql 2>&1 | grep -E "^(NOTICE|ERROR|psql:)|ALL RLS" | sed 's/^NOTICE:  //'

# Jobblogiken: stängning av förfallna konton och utkorgen. Körs i båda
# miljöerna av samma skäl som RLS-sviten - en skillnad ska synas här,
# inte i produktion.
$PSQL -d "$DB" -f supabase/tests/billingJob.sql 2>&1 | grep -E "^(NOTICE|ERROR|psql:)|ALL BILLING" | sed 's/^NOTICE:  //'

$PSQL -d "$DB" -f supabase/tests/referralInvoicing.sql 2>&1 | grep -E "^(NOTICE|ERROR|psql:)|ALL REFERRAL" | sed 's/^NOTICE:  //'

$PSQL -d "$DB" -f supabase/tests/usageInvoicing.sql 2>&1 | grep -E "^(NOTICE|ERROR|psql:)|ALL USAGE" | sed 's/^NOTICE:  //'

$PSQL -d "$DB" -f supabase/tests/invoiceNumbering.sql 2>&1 | grep -E "^(NOTICE|ERROR|psql:)|ALL INVOICE NUMBERING" | sed 's/^NOTICE:  //'

$PSQL -d "$DB" -f supabase/tests/notifications.sql 2>&1 | grep -E "^(NOTICE|ERROR|psql:)|ALL NOTIFICATION" | sed 's/^NOTICE:  //'
