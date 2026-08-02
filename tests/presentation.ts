/**
 * Tester för presentationsformerna.
 *
 * Kärnlöftet: formerna är transformer av SAMMA rapport. Punktlistan får
 * inte tappa eller skriva om en enda mening, tidslinjen får inte hitta på
 * händelser och den korta versionen är en delmängd - aldrig en
 * omskrivning. Testas mot en riktig rapport ur motorn, inte en fixtur som
 * råkar passa transformerna.
 */

import { buildExecutiveSummary } from "../src/lib/executiveSummary";
import { analyseCrisis } from "../src/lib/crisisAnalysis";
import { analysisInputFromCase } from "../src/lib/caseAnalysis";
import {
  PRESENTATION_MODES,
  toBullets,
  toCompact,
  toTimelineRows,
} from "../src/lib/presentation";
import type { CaseRecord } from "../src/data/types";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra = "") => {
  if (ok) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${name} ${extra}`);
  }
};

const NOW = new Date("2026-08-02T09:00:00");

const caseRecord: CaseRecord = {
  id: "case-1",
  orgNumber: "556012-3456",
  companyName: "Demobolaget AB",
  employees: "6-10",
  canPaySalary: false,
  salaryAmount: "420000",
  salaryDay: 25,
  canPayTax: false,
  taxAmount: "165000",
  taxDay: 12,
  canPayRent: true,
  rentAmount: "58000",
  rentDay: 1,
  canPaySuppliers: false,
  totalDebt: "3200000",
  quickLiquidationValue: "950000",
  recommendationType: "reconstruction",
  recommendationTitle: null,
  recommendationDescription: null,
  recommendationReasons: [],
  recommendationNextSteps: [],
  createdAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-01T10:00:00.000Z",
};

const analysis = analyseCrisis(analysisInputFromCase(caseRecord));
const summary = buildExecutiveSummary({
  caseRecord,
  timeline: analysis.timeline,
  tasks: [],
  members: [],
  kbr: null,
  documentCount: 2,
  payments: [],
  now: NOW,
  audience: "company",
});

check("tre presentationsformer", PRESENTATION_MODES.map((m) => m.id).join(",") === "text,bullets,timeline");

/* --- punktlistan: ingen mening tappas eller ändras ------------------------- */
const bullets = toBullets(summary);
check("punktlistan har rapportens alla sektioner", bullets.length === summary.sections.length);
check(
  "sektionsrubrikerna är desamma",
  bullets.every((b, i) => b.title === summary.sections[i].title),
);

const originalText = summary.sections.flatMap((s) => s.paragraphs).join(" ");
const bulletText = bullets.flatMap((b) => b.items).join(" ");
const strip = (s: string) => s.replace(/\s+/g, " ").trim();
check("ingen mening tappas eller skrivs om", strip(bulletText) === strip(originalText));
check(
  "varje punkt är en hel mening",
  bullets.flatMap((b) => b.items).every((item) => /[.!?]$/.test(item)),
);
check(
  "punkterna är fler än styckena (delningen gör något)",
  bullets.flatMap((b) => b.items).length > summary.sections.flatMap((s) => s.paragraphs).length,
);
check(
  "belopp delas aldrig",
  bullets.flatMap((b) => b.items).every((item) => !/^\d{3}\s/.test(item)),
);

/* --- tidslinjen: rapportens fakta i kronologisk ordning -------------------- */
const rows = toTimelineRows(summary, analysis.timeline, NOW);
check("tidslinjen innehåller fristerna", analysis.timeline.every((e) => rows.some((r) => r.label === e.label)));
check("tidslinjen innehåller åtgärderna", summary.actions.every((a) => rows.some((r) => r.label === a.label)));
check("inget hittas på", rows.length === analysis.timeline.length + summary.actions.length);
check(
  "kronologin håller: sorterad på ordningsnyckeln",
  rows.every((r, i) => i === 0 || rows[i - 1].order <= r.order),
);
const immediateIdx = rows.findIndex((r) => r.when === "omedelbart");
const canWaitIdx = rows.findIndex((r) => r.when === "kan vänta");
check(
  "omedelbart före kan vänta",
  immediateIdx === -1 || canWaitIdx === -1 || immediateIdx < canWaitIdx,
);
const passedRows = rows.filter((r) => r.when === "passerad");
check("passerade frister ligger först", passedRows.every((r) => rows.indexOf(r) < Math.max(1, immediateIdx + 1)) || passedRows.length === 0);

/* --- korta versionen: delmängd, inte omskrivning --------------------------- */
const compact = toCompact(summary);
check("kort: rubriken ordagrann", compact.headline === summary.headline);
check("kort: strategin ordagrann", compact.strategy === summary.strategy);
check("kort: högst tre åtgärder", compact.topActions.length <= 3);
check(
  "kort: åtgärderna är rapportens egna objekt",
  compact.topActions.every((a) => summary.actions.includes(a)),
);
check(
  "kort: de mest akuta valdes",
  compact.topActions.every(
    (a) =>
      summary.actions.filter(
        (other) =>
          ["omedelbart", "idag", "denna vecka", "kan vänta"].indexOf(other.horizon) <
          ["omedelbart", "idag", "denna vecka", "kan vänta"].indexOf(a.horizon),
      ).length < 3,
  ),
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
