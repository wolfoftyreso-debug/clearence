#!/bin/sh
# Skjuter in runtime-konfigen i index.html vid start.
#
# Kör i nginx-avbildens /docker-entrypoint.d/ FÖRE nginx startar. Byter
# platshållarkommentaren i index.html mot en inline <script> som sätter
# window.__CLEARANCE_CONFIG__ ur miljön. Så fungerar SAMMA avbild i alla
# miljöer - API-basen sätts vid start (API_BASE_URL), inte vid bygget.
#
# API_BASE_URL tom sträng = samma origin (nginx proxar /v1). Det är
# standardläget här och det som klienten tolkar som relativ fetch.
set -eu

HTML=/usr/share/nginx/html/index.html
ORIG=/usr/share/nginx/html/index.html.orig

# Spara originalet en gång, så omstarter inte dubbelinjicerar.
[ -f "$ORIG" ] || cp "$HTML" "$ORIG"

BASE="${API_BASE_URL:-}"
# Ett minimalt, giltigt JSON-objekt. apiBaseUrl kan vara tom (samma origin).
SCRIPT="<script>window.__CLEARANCE_CONFIG__={\"apiBaseUrl\":\"${BASE}\"};</script>"

# '#' som avgränsare eftersom en URL kan innehålla '/'. En '#' i basen vore
# ogiltigt (fragment) och förekommer inte i en API-bas.
sed "s#<!--CLEARANCE_RUNTIME_CONFIG-->#${SCRIPT}#" "$ORIG" > "$HTML"

echo "clearance: runtime-konfig injicerad (apiBaseUrl='${BASE}')"
