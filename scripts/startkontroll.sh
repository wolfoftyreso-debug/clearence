#!/usr/bin/env bash
#
# STARTKONTROLLEN: körs FÖRE varje driftsättning.
#
#   scripts/startkontroll.sh
#
# Den prövar det som annars upptäcks först i produktion, och den skiljer
# på två sorters fynd:
#
#   STOPP   - driftsätt inte. Något är trasigt eller osant.
#   VARNING - driftsätt om du vet varför. Något är ofärdigt med flit.
#
# Skillnaden är hela poängen. En kontroll som stoppar på allt lär folk
# att köra förbi den.

set -uo pipefail
ROT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROT"

STOPP=0
VARNINGAR=0
ok()      { printf '  \033[32mOK\033[0m      %s\n' "$1"; }
stopp()   { printf '  \033[31mSTOPP\033[0m   %s\n' "$1"; STOPP=$((STOPP+1)); }
varning() { printf '  \033[33mVARNING\033[0m %s\n' "$1"; VARNINGAR=$((VARNINGAR+1)); }

echo
echo "== Kod och tester =="
npm run lint --silent >/dev/null 2>&1 && ok "eslint" || stopp "eslint klagar"
npm run typecheck --silent >/dev/null 2>&1 && ok "typecheck" || stopp "typecheck klagar"
if npm test --silent >/dev/null 2>&1; then ok "hela enhetsbatteriet"; else stopp "enhetstester faller"; fi

echo
echo "== Bygget =="
# BYGGER TILL EN EGEN KATALOG, INTE TILL dist/.
#
# Den här raden skrev tidigare över dist/ med ett produktionsbygge. Det
# kostade en hel felsökning: startkontrollen kördes medan webbläsarsvepet
# pågick, dist/ byttes ut mot ett bygge UTAN demoläget, och tjugo sviter
# blev röda med "Timeout 30000ms exceeded" - som såg ut som ett trasigt
# gränssnitt men var en kontroll som förstörde det den kontrollerade.
BYGGUT="$(mktemp -d)"
if VITE_DEMO_MODE=false npx vite build --outDir "$BYGGUT" --emptyOutDir >/dev/null 2>&1; then
  ok "frontend byggs"
else
  stopp "frontend byggs inte"
fi
# Serverkoden byggs av Vercel, inte här. Men den ska gå att TYPKONTROLLERA -
# esbuild transpilerar utan att kontrollera typer, så ett typfel i server/
# eller api/ skulle annars synas först i drift.
npx tsc --noEmit -p tsconfig.server.json >/dev/null 2>&1 \
  && ok "server, api och arbetarna typkontrollerar" \
  || stopp "typfel i server/, api/ eller db/worker/"
npm run build:worker --silent >/dev/null 2>&1 && ok "arbetaren byggs" || stopp "arbetaren byggs inte"

echo
echo "== Bunten =="
# En produktionsbunt som bär demoläget är en bunt som kan visa påhittade
# siffror för en riktig kund.
# Prövas mot bygget OVAN, inte mot dist/: dist/ kan bära vad som helst -
# ett demobygge från webbläsarsvepet, till exempel - och då hade den här
# kontrollen svarat på en annan fråga än den ställer.
if [ -d "$BYGGUT/assets" ] && grep -rq "DEMOLÄGE" "$BYGGUT"/assets/*.js 2>/dev/null; then
  stopp "demoläget finns i produktionsbunten"
elif [ -d "$BYGGUT/assets" ]; then
  ok "inget demoläge i bunten"
else
  varning "ingen bunt att pröva - bygget gick inte igenom"
fi
rm -rf "$BYGGUT"

echo
echo "== Driften =="
# Vercel gör VARJE fil under api/ till en publik endpoint. Serverkoden ska
# därför ligga i server/, utanför api/.
if [ -d api/server ]; then
  stopp "api/server/ finns - varje fil där blir en publik endpoint på Vercel"
else
  ok "serverkoden ligger utanför api/"
fi
[ -f vercel.json ] && ok "vercel.json finns" || stopp "vercel.json saknas"
[ -f "api/[...path].ts" ] && ok "API-funktionen finns" || stopp "api/[...path].ts saknas"

# Varje schemalagt jobb i vercel.json ska ha en fil som svarar. Ett cron
# som pekar på ingenting kör inte, och tystnaden ser ut som "inga fakturor
# att ställa ut".
saknade_cron=""
for c in $(grep -oE '"/api/cron/[a-z]+"' vercel.json | tr -d '"' | sort -u); do
  [ -f ".${c}.ts" ] || saknade_cron="$saknade_cron $c"
done
if [ -n "$saknade_cron" ]; then
  stopp "schemalagda jobb utan fil:$saknade_cron"
else
  ok "varje schemalagt jobb har en fil"
fi

# Hastighetsbegränsningen räknas i databasen sedan 20260811100000, och
# API:t STÄNGER när räkningen inte går att göra. Det är rätt beteende vid en
# störning - men saknas funktionen svarar tjänsten 503 på allt, från första
# sekunden, och felet ser då ut som en trasig databas i stället för en
# migration som inte följt med.
if grep -q "app.rate_limit_hit" server/rateLimit.ts; then
  if grep -rq "function app.rate_limit_hit" db/migrations/; then
    ok "hastighetsgränsens funktion finns i migrationerna"
  else
    stopp "API:t räknar mot app.rate_limit_hit men ingen migration skapar den"
  fi
fi

# Gränsen måste gälla på den väg Vercel faktiskt använder. Låg den kvar i
# node:http-lagret vore forceringsskyddet borta i drift medan sviterna som
# reser den egna servern fortsatt vore gröna.
if grep -q "provaHastighet" "api/[...path].ts"; then
  ok "hastighetsgränsen gäller på Vercel-vägen"
else
  stopp "api/[...path].ts prövar inte hastighetsgränsen"
fi

# Rollgrinden i serverless: vägran måste ligga i varje väg in, inte i en
# uppstart som inte finns.
if grep -q "await sakerRollGrind()" server/db.ts; then
  ok "rollgrinden prövas före databasen rörs"
else
  stopp "server/db.ts prövar inte databasrollen"
fi

# ALLOW_UNSAFE_DB_ROLE stänger av den grinden. Det får stå i sviterna och
# ingen annanstans.
if grep -rq "ALLOW_UNSAFE_DB_ROLE" vercel.json api/ 2>/dev/null; then
  stopp "ALLOW_UNSAFE_DB_ROLE står i driftkonfigurationen"
else
  ok "ALLOW_UNSAFE_DB_ROLE står inte i det som rullas ut"
fi

echo "== Juridik och fakturering =="
# Fakturaspärren är MENAD att vara på tills uppgifterna bekräftats. Den
# är därför en varning, inte ett stopp: tjänsten går att driftsätta utan
# att kunna fakturera.
if grep -q "hasFSkatt: false" src/lib/company.ts; then varning "F-skatt inte bekräftad - fakturering spärrad"; else ok "F-skatt bekräftad"; fi
if grep -q "vatRegistered: false" src/lib/company.ts; then varning "momsregistrering inte bekräftad - fakturering spärrad"; else ok "momsregistrering bekräftad"; fi
if grep -qE 'bankgiro: ""' src/lib/company.ts; then varning "bankgiro saknas"; else ok "bankgiro ifyllt"; fi
if grep -qE '^  email: ""' src/lib/company.ts; then varning "avsändaradress för e-post saknas"; else ok "avsändaradress ifylld"; fi
if grep -q "Utkast – inte juridiskt granskat" src/pages/LegalPage.tsx; then
  varning "policy och villkor är ogranskade utkast - sidan säger det själv"
else
  ok "policy och villkor märks inte längre som utkast"
fi

echo
echo "== Backend =="
MIGRERADE=$(grep -c '^  "' src/data/aws/adapter.ts 2>/dev/null || echo 0)
varning "AWS-adaptern: $MIGRERADE operationer migrerade, resten delegeras till Supabase"

echo
if [ $STOPP -gt 0 ]; then
  printf '\033[31mDRIFTSÄTT INTE.\033[0m %d stopp, %d varningar.\n\n' "$STOPP" "$VARNINGAR"
  exit 1
fi
printf '\033[32mKLART ATT DRIFTSÄTTA.\033[0m 0 stopp, %d varningar - läs dem först.\n\n' "$VARNINGAR"
