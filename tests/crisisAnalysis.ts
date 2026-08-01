/**
 * Assertions for the triage engine.
 *
 * This is the module with the highest stakes in the product: it tells a
 * company whether it looks insolvent and when a director becomes personally
 * liable. It had no tests until the audit on 2026-08-01.
 *
 * The emphasis is on internal consistency. A verdict that contradicts its own
 * stated reasons is worse than a wrong verdict, because the reader cannot see
 * which half to trust.
 */

import { analyseCrisis } from "../src/lib/crisisAnalysis";
import type { CrisisAnalysis } from "../src/lib/crisisAnalysis";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, extra?: string) => {
  if (c) pass++; else { fail++; console.log(`FAIL ${n}${extra ? `\n  ${extra}` : ""}`); }
};
const eq = (n: string, a: unknown, b: unknown) => {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x === y) pass++; else { fail++; console.log(`FAIL ${n}\n  got      ${x}\n  expected ${y}`); }
};

const base = {
  canPaySalary: true, canPayTax: true, canPayRent: true, canPaySuppliers: true,
  salaryAmount: 200000, salaryDay: 25,
  taxAmount: 80000, taxDay: 12,
  rentAmount: 50000, rentDay: 1,
  totalDebt: 1000000, quickLiquidationValue: 500000,
  employees: "6-10",
};
const run = (over: Partial<typeof base>): CrisisAnalysis =>
  analyseCrisis({ ...base, ...over } as never);

/* --- healthy ------------------------------------------------------------- */

const healthy = run({});
eq("all payable -> stabilize", healthy.type, "stabilize");
eq("all payable -> no insolvency indication", healthy.solvency.indication, "no_indication");

/* --- the bug this file was written for ----------------------------------- */
// Obestånd requires the inability NOT to be merely temporary. Assets that
// cover the debts in full are evidence that it may be. Before the fix the
// engine said "mycket talar för obestånd" while also reporting 100 % cover.

const fullyCovered = run({
  canPaySalary: false, canPayTax: false,
  totalDebt: 500000, quickLiquidationValue: 500000,
});
eq("100 % cover is not called likely insolvent", fullyCovered.solvency.indication, "at_risk");
ok("100 % cover explanation names the tension",
  /tillfällig/.test(fullyCovered.solvency.explanation),
  fullyCovered.solvency.explanation);

const halfCovered = run({
  canPaySalary: false, canPayTax: false,
  totalDebt: 1000000, quickLiquidationValue: 700000,
});
eq("70 % cover is at risk, not insolvent", halfCovered.solvency.indication, "at_risk");

const barelyCovered = run({
  canPaySalary: false, canPayTax: false, canPaySuppliers: false,
  totalDebt: 1000000, quickLiquidationValue: 100000,
});
eq("10 % cover is likely insolvent", barelyCovered.solvency.indication, "likely_insolvent");
eq("10 % cover and nothing payable -> bankruptcy", barelyCovered.type, "bankruptcy");

/* --- no self-contradiction ----------------------------------------------- */

const cases: [string, Partial<typeof base>][] = [
  ["allt betalbart", {}],
  ["lön ej betalbar", { canPaySalary: false }],
  ["skatt ej betalbar", { canPayTax: false }],
  ["lön+skatt, hög täckning", { canPaySalary: false, canPayTax: false, totalDebt: 500000, quickLiquidationValue: 600000 }],
  ["lön+skatt, låg täckning", { canPaySalary: false, canPayTax: false, canPaySuppliers: false, totalDebt: 2000000, quickLiquidationValue: 50000 }],
  ["inget betalbart", { canPaySalary: false, canPayTax: false, canPayRent: false, canPaySuppliers: false, totalDebt: 3000000, quickLiquidationValue: 200000 }],
  ["ingen skuld angiven", { totalDebt: 0, quickLiquidationValue: 0 }],
  ["inga anställda", { employees: "0", canPaySalary: false }],
];

for (const [label, over] of cases) {
  const r = run(over);

  ok(`[${label}] har titel och beskrivning`, r.title.length > 0 && r.description.length > 0);
  ok(`[${label}] varje riskflagga har text`, r.riskFlags.every(f => f.title && f.body));
  ok(`[${label}] varje nästa steg har text`, r.nextSteps.every(s => s.text.length > 0));

  // likely_insolvent must never coexist with cover at or above 100 %.
  if (r.solvency.indication === "likely_insolvent" && r.coverage.ratio !== null) {
    ok(`[${label}] obestånd påstås inte vid full täckning`, r.coverage.ratio < 1,
      `ratio=${r.coverage.ratio}`);
  }

  // A bankruptcy verdict must not be paired with a reassuring cover reading.
  if (r.type === "bankruptcy" && r.coverage.ratio !== null) {
    ok(`[${label}] konkursverdikt paras inte med hög täckning`, r.coverage.ratio < 0.5,
      `ratio=${r.coverage.ratio}`);
  }

  // Every timeline event must be dated and ordered.
  const days = r.timeline.map(e => e.daysAway);
  ok(`[${label}] tidslinjen är sorterad`, days.every((d, i) => i === 0 || days[i - 1] <= d));
  ok(`[${label}] tidslinjens datum är ISO`, r.timeline.every(e => /^\d{4}-\d{2}-\d{2}$/.test(e.iso)));
}

/* --- personal liability -------------------------------------------------- */

const taxUnpaid = run({ canPayTax: false });
const taxFlag = taxUnpaid.riskFlags.find(f => f.id === "foretradaransvar");
ok("obetald skatt ger företrädaransvarsflagga", !!taxFlag);
ok("flaggan är kritisk", taxFlag?.severity === "critical");
ok("flaggan hänvisar till SFL 59 kap",
  /Skatteförfarandelagen \(2011:1244\) 59 kap/.test(taxFlag?.legalRef ?? ""),
  taxFlag?.legalRef);
ok("flaggan nämner verksam åtgärd", /verksam åtgärd/.test(taxFlag?.body ?? ""));

const taxPaid = run({ canPayTax: true });
ok("betald skatt ger ingen företrädaransvarsflagga",
  !taxPaid.riskFlags.some(f => f.id === "foretradaransvar"));

/* --- wage guarantee ------------------------------------------------------ */

const salaryUnpaid = run({ canPaySalary: false, employees: "6-10" });
const wageFlag = salaryUnpaid.riskFlags.find(f => f.id === "lonegaranti");
ok("obetald lön med anställda ger lönegarantiflagga", !!wageFlag);
ok("lönegarantins takbelopp är konkret",
  /236[\u00a0\u202f ]?800/.test(wageFlag?.body ?? ""),
  wageFlag?.body?.slice(0, 100));

const noEmployees = run({ canPaySalary: false, employees: "0" });
ok("utan anställda ingen lönegarantiflagga",
  !noEmployees.riskFlags.some(f => f.id === "lonegaranti"));

/* --- legal references are qualified -------------------------------------- */

const everything = run({
  canPaySalary: false, canPayTax: false, canPayRent: false, canPaySuppliers: false,
  totalDebt: 3000000, quickLiquidationValue: 100000,
});
const refs = everything.riskFlags.map(f => f.legalRef).filter(Boolean) as string[];
ok("alla lagrum bär SFS-nummer", refs.every(r => /\(\d{4}:\d+\)/.test(r)), refs.join(" | "));
ok("minst tre lagrum i värsta läget", refs.length >= 3, String(refs.length));

// Reconstruction advice must name the current act, since two share the name.
const reconstruction = run({
  canPaySalary: false, canPayTax: false,
  totalDebt: 1000000, quickLiquidationValue: 600000,
});
const stepsText = reconstruction.nextSteps.map(s => s.text).join(" ");
ok("rekonstruktionssteget anger 2022:964",
  !/1996:764/.test(stepsText) && (stepsText.includes("2022:964") || reconstruction.type !== "reconstruction"),
  stepsText.slice(0, 160));

/* --- deadlines are real dates -------------------------------------------- */

ok("brådskande steg har deadline",
  everything.nextSteps.filter(s => s.urgent).every(s => !!s.deadline),
  JSON.stringify(everything.nextSteps.filter(s => s.urgent && !s.deadline)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
