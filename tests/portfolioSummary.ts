/**
 * Tester för AI-portföljrapporten och den rollanpassade ärenderapporten.
 *
 * Arbetsledarens rader testas ordagrant, rangordningen mot regeln
 * "passerat och idag först", och rollprincipen: praktikern får juridisk
 * analys med lagrum, bolaget får den inte - samma datamodell, olika vy.
 */

import { buildPortfolioSummary, type PortfolioCase } from "../src/lib/portfolioSummary";
import { buildExecutiveSummary } from "../src/lib/executiveSummary";
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

const now = new Date("2026-08-02T09:00:00.000Z");

const mkCase = (id: string, name: string, over: Partial<CaseRecord> = {}): CaseRecord => ({
  id,
  orgNumber: "556000-000" + id,
  companyName: name,
  employees: "5",
  canPaySalary: true, salaryAmount: null, salaryDay: 25,
  canPayTax: true, taxAmount: null, taxDay: 12,
  canPayRent: true, rentAmount: null, rentDay: 1,
  canPaySuppliers: true,
  totalDebt: null, quickLiquidationValue: null,
  recommendationType: null, recommendationTitle: null, recommendationDescription: null,
  recommendationReasons: [], recommendationNextSteps: [],
  createdAt: "2026-08-01T10:00:00.000Z", updatedAt: "2026-08-01T10:00:00.000Z",
  ...over,
});

const event = (iso: string, label: string) => ({
  iso, daysAway: 0, label, amount: null, severity: "info" as const, note: undefined,
});

const portfolio: PortfolioCase[] = [
  {
    caseRecord: mkCase("1", "Lugnt AB"),
    severity: "stable",
    timeline: [],
    openTasks: 0,
    openMentions: 0,
  },
  {
    caseRecord: mkCase("2", "Idag AB"),
    severity: "serious",
    timeline: [event("2026-08-02", "Skatt/moms förfaller")],
    openTasks: 2,
    openMentions: 1,
  },
  {
    caseRecord: mkCase("3", "Passerat AB"),
    severity: "critical",
    timeline: [event("2026-07-28", "Löner förfaller")],
    openTasks: 1,
    openMentions: 0,
  },
];

const summary = buildPortfolioSummary(portfolio, now);
const text = summary.lines.join(" ");

check("antalet ärenden", text.includes("Du ansvarar för 3 aktiva ärenden."));
check("åtgärd idag räknas", text.includes("2 ärenden kräver åtgärd idag."));
check("kritisk frist inom 24 timmar", /kritisk[a]? tidsfrist(er)? inom 24 timmar/.test(text));
check("väntar på ditt svar", text.includes("Ett meddelande väntar på ditt svar."));
check("kritiskt bolag lyfts", /kritiskt läge/.test(text));
check("arbetsinsatsen är en uppskattning", text.includes("uppskattade arbetsinsatsen"));
check("timmar med decimal", /cirka \d+(,\d)? timmar/.test(text), text);

check("passerad frist rankas först", summary.ranked[0].caseId === "3" && summary.ranked[0].reason === "passerad frist");
check("frist idag rankas tvåa", summary.ranked[1].caseId === "2");
check("lugnt ärende sist", summary.ranked[2].caseId === "1");

const empty = buildPortfolioSummary(
  [{ caseRecord: mkCase("9", "Ensamt AB"), severity: "stable", timeline: [], openTasks: 0, openMentions: 0 }],
  now,
);
check("singular", empty.lines[0] === "Du ansvarar för 1 aktivt ärende.");
check("lugn portfölj sägs vara under kontroll", empty.lines.join(" ").includes("under kontroll"));
check("determinism", JSON.stringify(buildPortfolioSummary(portfolio, now)) === JSON.stringify(summary));

/* --- rollanpassningen --------------------------------------------------------- */
const base = {
  caseRecord: mkCase("5", "Rollbolaget AB", { canPayTax: false, recommendationType: "reconstruction" as const }),
  timeline: [], tasks: [], members: [], kbr: null, documentCount: 0, payments: [], now,
};
const companyView = buildExecutiveSummary({ ...base, audience: "company" });
const practitionerView = buildExecutiveSummary({ ...base, audience: "practitioner" });

check("bolaget får ingen juridisk analys-sektion", !companyView.sections.some((s) => s.id === "juridik"));
check("praktikern får juridisk analys", practitionerView.sections.some((s) => s.id === "juridik"));
check("praktikern får processläge", practitionerView.sections.some((s) => s.id === "process"));
check(
  "praktikerns analys bär lagrummen rakt",
  JSON.stringify(practitionerView.sections).includes("59 kap. 12–13 §§ SFL") &&
    JSON.stringify(practitionerView.sections).includes("ABL 25 kap. 13 §"),
);
check(
  "händelseloggen lyfts som bevisläge",
  JSON.stringify(practitionerView.sections).includes("append-only"),
);
check(
  "samma datamodell: rubrik och strategi är gemensamma",
  companyView.headline === practitionerView.headline && companyView.strategy === practitionerView.strategy,
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
