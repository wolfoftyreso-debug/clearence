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
if VITE_DEMO_MODE=false npx vite build >/dev/null 2>&1; then ok "frontend byggs"; else stopp "frontend byggs inte"; fi
npm run build:api --silent >/dev/null 2>&1 && ok "API byggs" || stopp "API byggs inte"
npm run build:worker --silent >/dev/null 2>&1 && ok "arbetaren byggs" || stopp "arbetaren byggs inte"

echo
echo "== Bunten =="
# En produktionsbunt som bär demoläget är en bunt som kan visa påhittade
# siffror för en riktig kund.
if grep -rq "DEMOLÄGE" dist/assets/*.js 2>/dev/null; then
  stopp "demoläget finns i produktionsbunten"
else
  ok "inget demoläge i bunten"
fi

echo
echo "== Infrastrukturen =="
if command -v terraform >/dev/null; then
  terraform -chdir=infra fmt -check -recursive >/dev/null 2>&1 && ok "terraform fmt" || stopp "terraform fmt"
  terraform -chdir=infra validate >/dev/null 2>&1 && ok "terraform validate" || varning "terraform validate (kräver init)"
else
  varning "terraform saknas i PATH - infra kunde inte prövas"
fi
# Hälsokontrollen måste peka på en rutt API:t faktiskt svarar på. Att de
# glider isär märks annars först som en driftsättning som aldrig blir klar.
HK=$(grep -oE 'path *= *"[^"]+"' infra/compute.tf | head -1 | grep -oE '"[^"]+"' | tr -d '"')
if grep -q "\"$HK\"" api/server/index.ts; then
  ok "ALB:ns hälsokontroll ($HK) finns i API:t"
else
  stopp "ALB kontrollerar $HK men API:t har ingen sådan rutt"
fi
# Hastighetsbegränsningen räknas i databasen sedan 20260811100000, och
# API:t STÄNGER när räkningen inte går att göra. Det är rätt beteende vid en
# störning - men saknas funktionen svarar tjänsten 503 på allt, från första
# sekunden, och felet ser då ut som en trasig databas i stället för en
# migration som inte följt med.
if grep -q "app.rate_limit_hit" api/server/rateLimit.ts; then
  if grep -rq "function app.rate_limit_hit" supabase/migrations/; then
    ok "hastighetsgränsens funktion finns i migrationerna"
  else
    stopp "API:t räknar mot app.rate_limit_hit men ingen migration skapar den"
  fi
fi
[ -f api/Dockerfile ] && ok "api/Dockerfile finns" || stopp "api/Dockerfile saknas"
[ -f db/Dockerfile ] && ok "db/Dockerfile finns" || stopp "db/Dockerfile saknas"
[ -f infra/terraform.tfvars ] && ok "terraform.tfvars finns" || varning "terraform.tfvars saknas (kopiera .example)"

echo
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
