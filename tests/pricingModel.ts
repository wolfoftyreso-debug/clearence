/**
 * Tester för prismodellen och betalväggen.
 *
 * Två löften prövas: beloppet är en parameter (formatterare och
 * låstext tar planen som argument - inget belopp lever i en vy), och
 * betalväggen är en inbjudan, inte en inlåsning (texten lovar att
 * arbetet finns kvar, och villkoren säger ingen bindningstid).
 */

import {
  DEFAULT_COMPANY_PLAN,
  LOCKED_UNTIL_FIRST_PAYMENT,
  PLAN_TERMS,
  firstPaymentDone,
  formatPlanPrice,
  lockMessage,
} from "../src/lib/pricing";
import type { AccountBillingRecord } from "../src/data/types";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (ok) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${name}${extra === undefined ? "" : `\n     ${JSON.stringify(extra)}`}`);
  }
};

const billing = (paidAt: string | null): AccountBillingRecord => ({
  userId: "u1",
  startedAt: "2026-08-01T00:00:00Z",
  dueAt: null,
  paidAt,
  closedAt: null,
  note: null,
});

/* --- betalväggens enda fråga ----------------------------------------------- */

check("före första betalningen: låst", firstPaymentDone(billing(null)) === false);
check("efter första betalningen: öppet", firstPaymentDone(billing("2026-08-02T10:00:00Z")) === true);
check("inget kontounderlag: låst, inte krasch", firstPaymentDone(null) === false && firstPaymentDone(undefined) === false);

/* --- beloppet är en parameter ---------------------------------------------- */

check("beslutat betapris som reserv", DEFAULT_COMPANY_PLAN.monthlyExVatSek === 985);
check("formatteringen: exklusive moms, svenskt tusental", formatPlanPrice({ monthlyExVatSek: 985 }) === "985 kr/mån + moms");
check("formatteringen följer parametern", formatPlanPrice({ monthlyExVatSek: 1200 }) === "1 200 kr/mån + moms");
check("låstexten bär parameterns belopp", lockMessage({ monthlyExVatSek: 1200 }).includes("1 200 kr/mån + moms"));

/* --- nivåerna -------------------------------------------------------------- */

import { PLAN_TIERS, formatMonthly } from "../src/lib/pricing";

check("fyra nivåer", PLAN_TIERS.length === 4);
check("nivånamnen", PLAN_TIERS.map((t) => t.id).join(",") === "start,standard,business,enterprise");
check("ordet provversion förekommer aldrig", !/provversion/i.test(JSON.stringify(PLAN_TIERS)));
check("Start säger vad som INTE ingår", PLAN_TIERS[0].excludes.length >= 3);
check("reservvärden för alla nivåer", DEFAULT_COMPANY_PLAN.businessExVatSek === 2780 && DEFAULT_COMPANY_PLAN.enterpriseExVatSek === 4500);
check("nivåbelopp formateras svenskt", formatMonthly(2780) === "2 780 kr/mån + moms");
check("nivåerna knyts aldrig till omsättning", !/omsättning/i.test(JSON.stringify(PLAN_TIERS)));

/* --- tonen: inbjudan, inte inlåsning --------------------------------------- */

const msg = lockMessage(DEFAULT_COMPANY_PLAN);
check("låstexten lovar att arbetet finns kvar", msg.includes("Allt du skapat finns kvar"));
check("låstexten säger ingen bindningstid", msg.includes("ingen bindningstid"));
check("villkoren: uppsägning när som helst", PLAN_TERMS.some((t) => t.includes("uppsägning när som helst")));
check("villkoren: data sparas vid paus", PLAN_TERMS.some((t) => t.includes("sparas även om abonnemanget pausas")));
check("låslistan täcker export och delning", LOCKED_UNTIL_FIRST_PAYMENT.some((i) => i.includes("Export")) && LOCKED_UNTIL_FIRST_PAYMENT.some((i) => i.includes("Delning")));
check("ordet AI förekommer inte", !/\bAI\b/i.test(msg + PLAN_TERMS.join(" ") + LOCKED_UNTIL_FIRST_PAYMENT.join(" ")));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
