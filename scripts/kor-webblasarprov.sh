#!/usr/bin/env bash
#
# WEBBLÄSARPROVEN, KÖRDA SOM EN SVIT.
#
# De fyrtio filerna i tests/browser/ ligger utanför `npm test` med flit:
# de kräver en byggd app, en server och en webbläsare, och de tar minuter
# i stället för sekunder. Priset för det var att INGEN körde dem. När de
# till slut kördes var nio röda - de flesta sedan länge, för att de letade
# efter knappar och texter som bytts ut. Ett prov som letar efter något
# som inte finns prövar ingenting alls; det ser bara ut att göra det.
#
# Det här skriptet gör dem körbara med ett kommando: `npm run test:webblasare`.
#
# Bygget sker i DEMOLÄGE eftersom proven loggar in som demoroller och inte
# ska tala med någon server. Platshållarna för Supabase finns för att
# klienten skapas när modulen laddas; de används aldrig.
set -uo pipefail

ROT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROT"

PORT="${PORT:-4310}"
BAS="http://127.0.0.1:${PORT}"

if [ "${HOPPA_BYGG:-0}" != "1" ]; then
  echo "Bygger i demoläge..."
  TMPENV="$(mktemp)"
  [ -f .env ] && cp .env "$TMPENV"
  cat > .env <<'ENV'
VITE_DEMO_MODE=true
VITE_SUPABASE_URL="https://demo.invalid"
VITE_SUPABASE_PUBLISHABLE_KEY="demo-ingen-riktig-nyckel"
VITE_SUPABASE_PROJECT_ID="demo"
ENV
  npm run build > /dev/null 2>&1
  BYGG=$?
  if [ -s "$TMPENV" ]; then cp "$TMPENV" .env; else rm -f .env; fi
  rm -f "$TMPENV"
  [ $BYGG -eq 0 ] || { echo "BYGGET MISSLYCKADES"; exit 1; }
fi

# Artefaktproven serverar enfilsdemon själva och hittar den bredvid repot.
# Utan ett färskt bygge prövar de en gammal fil - det har hänt.
if [ "${HOPPA_ARTEFAKT:-0}" != "1" ]; then
  echo "Bygger enfilsdemon..."
  node scripts/bygg-artefakt.mjs ../../clearance-artifact.html > /dev/null 2>&1 \
    || echo "  (artefaktbygget misslyckades - artefaktproven hoppar över sig själva)"
fi

npx vite preview --port "$PORT" --host 127.0.0.1 --strictPort > /tmp/clearance-preview.log 2>&1 &
PREVIEW=$!
trap 'kill $PREVIEW 2>/dev/null' EXIT

for _ in $(seq 1 30); do
  curl -sf -o /dev/null "$BAS/" && break
  sleep 1
done
curl -sf -o /dev/null "$BAS/" || { echo "FÖRHANDSSERVERN STARTADE INTE"; exit 1; }

RODA=0
for f in tests/browser/*.mjs; do
  namn="$(basename "$f" .mjs)"
  ut="$(timeout "${PROV_TIMEOUT:-240}" node "$f" "$BAS" 2>&1)"
  kod=$?
  sammanfattning="$(echo "$ut" | grep -E 'passed,' | tail -1)"
  if [ $kod -ne 0 ]; then
    RODA=$((RODA + 1))
    printf '%-34s RÖD  %s\n' "$namn" "${sammanfattning:-$(echo "$ut" | grep -E 'Error|Timeout' | head -1 | cut -c1-70)}"
    echo "$ut" | grep -E '^FAIL' | head -5 | sed 's/^/    /'
  else
    printf '%-34s ok   %s\n' "$namn" "$sammanfattning"
  fi
done

echo
if [ $RODA -eq 0 ]; then
  echo "ALLA WEBBLÄSARPROV GRÖNA"
else
  echo "$RODA svit(er) röda"
fi
exit $RODA
