/**
 * DATASKYDDET SOM KOD.
 *
 * GDPR-kraven som går att bygga in i produkten prövas här - inte för att
 * ersätta en DPIA, utan för att det som ÄR byggt inte tyst ska sluta gälla.
 * En regel som inte testas är en åsikt.
 *
 *  1. DATAMINIMERING VID FRITEXT (art. 9): påminnelsen finns, är konkret,
 *     och står faktiskt där fritext skrivs - samtalet och onboardingen.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_MINIMERING_HINT } from "../src/lib/dataMinimering";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra = "") => {
  if (ok) passed++;
  else {
    failed++;
    console.log(`FAIL ${name} ${extra}`);
  }
};

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/* --- 1. Dataminimering vid fritext (art. 9) ------------------------------ */

check("påminnelsen är skriven", DATA_MINIMERING_HINT.trim().length > 20);
// Den ska peka på just det som är känsligt: personnummer och tredje person.
check("den nämner personnummer", /personnummer/i.test(DATA_MINIMERING_HINT));
check("den nämner namngivna privatpersoner", /privatpersoner|tredje/i.test(DATA_MINIMERING_HINT));
// Den ska mana till mindre, inte skrämma. Ingen jargong, inget "förbjudet".
check("den formuleras som en uppmaning, inte ett förbud", !/förbjud|olagligt|straff/i.test(DATA_MINIMERING_HINT));

// Och den ska stå DÄR texten skrivs - annars är den en policy ingen läser.
const hintComp = read("src/components/privacy/DataMinimeringHint.tsx");
check("hint-komponenten använder den enda sanningen", /DATA_MINIMERING_HINT/.test(hintComp));

const samtal = read("src/pages/DashboardSamtal.tsx");
check("samtalet visar påminnelsen vid fritextfältet", /DataMinimeringHint/.test(samtal));

const onboarding = read("src/components/advisor/ClaraIntro.tsx");
check("onboardingen visar påminnelsen vid grunduppgifterna", /DataMinimeringHint/.test(onboarding));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
