/**
 * Tester för systemanalysens lägesrapport.
 *
 * Det som testas är rapportens LÖFTEN: att allvarsgraden speglar datan,
 * att prioriteringen sätter det passerade först, att möjlighetsavsnittet
 * aldrig är tomt (rapporten får aldrig vara uppgiven), att rekommendationen
 * alltid motiveras, och att tonen håller - ingen panik, inget automatiskt
 * personligt ansvar.
 */

import { buildExecutiveSummary, type SummaryInput } from "../src/lib/executiveSummary";
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

const baseCase = (over: Partial<CaseRecord>): CaseRecord => ({
  id: "c1",
  orgNumber: "556012-3456",
  companyName: "Demobolaget AB",
  employees: "5",
  canPaySalary: true,
  salaryAmount: "180 000",
  salaryDay: 25,
  canPayTax: true,
  taxAmount: "90 000",
  taxDay: 12,
  canPayRent: true,
  rentAmount: "58 000",
  rentDay: 1,
  canPaySuppliers: true,
  totalDebt: "1 200 000",
  quickLiquidationValue: "800 000",
  recommendationType: null,
  recommendationTitle: null,
  recommendationDescription: null,
  recommendationReasons: [],
  recommendationNextSteps: [],
  createdAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-01T10:00:00.000Z",
  ...over,
});

const input = (over: Partial<SummaryInput>): SummaryInput => ({
  caseRecord: baseCase({}),
  timeline: [],
  tasks: [],
  members: [],
  kbr: null,
  documentCount: 0,
  payments: [],
  now: new Date("2026-08-02T09:00:00.000Z"),
  ...over,
});

/* --- allvarsgrad ------------------------------------------------------------ */
const calm = buildExecutiveSummary(input({}));
check("stabilt läge utan varningssignaler", calm.severity === "stable", calm.severity);

const taxTrouble = buildExecutiveSummary(
  input({ caseRecord: baseCase({ canPayTax: false }) }),
);
check("obetalbar skatt ger kritiskt läge", taxTrouble.severity === "critical");
check(
  "företrädaransvaret formuleras som 'kan', aldrig 'kommer att'",
  JSON.stringify(taxTrouble).includes("kan i vissa situationer bli personligt") &&
    !/kommer att bli personligt/.test(JSON.stringify(taxTrouble)),
);
check(
  "skatteåtgärden prioriteras till idag eller tidigare",
  taxTrouble.actions.some(
    (a) => a.label.includes("skattens förfallodag") && (a.horizon === "idag" || a.horizon === "omedelbart"),
  ),
);

/* --- prioritering ------------------------------------------------------------ */
const withPassed = buildExecutiveSummary(
  input({
    timeline: [
      { iso: "2026-07-28", daysAway: -5, label: "Skatt/moms förfaller", amount: 90000, severity: "critical", note: undefined },
      { iso: "2026-08-04", daysAway: 2, label: "Löner förfaller", amount: 180000, severity: "info", note: undefined },
    ],
  }),
);
check("passerat datum hamnar under omedelbart", withPassed.actions[0]?.horizon === "omedelbart");
check(
  "kommande frist inom veckan hamnar under denna vecka",
  withPassed.actions.some((a) => a.label === "Löner förfaller" && a.horizon === "denna vecka"),
);
check("passerade frister syns i riskanalysen", JSON.stringify(withPassed.sections).includes("redan passerat"));

/* --- möjligheter: aldrig uppgiven -------------------------------------------- */
const worst = buildExecutiveSummary(
  input({
    caseRecord: baseCase({
      canPaySalary: false,
      canPayTax: false,
      canPayRent: false,
      canPaySuppliers: false,
      recommendationType: "bankruptcy",
    }),
  }),
);
const opp = worst.sections.find((s) => s.id === "mojligheter");
check("möjlighetsavsnittet finns även i värsta läget", (opp?.paragraphs.length ?? 0) > 0);
check("strukturen lyfts som styrka", JSON.stringify(opp).includes("styrka"));
check("lönegarantin nämns när lönerna är i fara", JSON.stringify(worst.sections).includes("lönegaranti"));

/* --- brådskan sitter i läget, inte bara i kalendern --------------------------- */
// Rapporten satte tidigare "omedelbart" enbart på passerade datum. Ett
// konkursnära bolag utan en enda passerad frist fick därför noll punkter
// överst - fast analysen bredvid sa "omgående". Två svar om samma dygn.
check(
  "konkursläget får punkter under omedelbart utan passerade datum",
  worst.actions.some((a) => a.horizon === "omedelbart"),
  JSON.stringify(worst.actions.map((a) => a.horizon)),
);
check(
  "den omedelbara punkten är samtalet, inte formalian",
  worst.actions[0]?.horizon === "omedelbart" && /konkursförvaltare|affärsjurist/.test(worst.actions[0].label),
  worst.actions[0]?.label,
);
check(
  "den omedelbara punkten leder någonstans",
  worst.actions[0]?.href === "/marketplace",
  String(worst.actions[0]?.href),
);

// Löner OCH skatt stoppar samtidigt: analysen kallar det immediate även när
// bedömningen blir rekonstruktion. Rapporten ska följa med.
const bothStop = buildExecutiveSummary(
  input({
    caseRecord: baseCase({
      canPaySalary: false,
      canPayTax: false,
      recommendationType: "reconstruction",
    }),
  }),
);
check(
  "löner och skatt samtidigt ger omedelbar prioritet",
  bothStop.actions.some((a) => a.horizon === "omedelbart"),
  JSON.stringify(bothStop.actions.map((a) => a.horizon)),
);
check(
  "rekonstruktionsläget kallar inte in en konkursförvaltare",
  !/konkursförvaltare/.test(bothStop.actions[0]?.label ?? ""),
  bothStop.actions[0]?.label,
);

// Och lika viktigt: ordet ska inte devalveras. Ett läge som analysen kallar
// weeks får inte ha något överst.
const oneStop = buildExecutiveSummary(input({ caseRecord: baseCase({ canPaySuppliers: false }) }));
check(
  "en enda utebliven betalning ger ingen omedelbar punkt",
  !oneStop.actions.some((a) => a.horizon === "omedelbart"),
  JSON.stringify(oneStop.actions.map((a) => a.horizon)),
);

/* --- rekommendationen motiveras ---------------------------------------------- */
for (const [type, marker] of [
  ["stabilize", "Motivet är"],
  ["reconstruction", "Motivet är"],
  ["bankruptcy", "Motivet är"],
] as const) {
  const s = buildExecutiveSummary(input({ caseRecord: baseCase({ recommendationType: type }) }));
  check(`strategin för ${type} är motiverad`, s.strategy.includes(marker));
}
check(
  "utan utvärdering pekar strategin på utvärderingen",
  buildExecutiveSummary(input({})).strategy.includes("gör utvärderingen") ||
    buildExecutiveSummary(input({})).strategy.includes("utvärderingen"),
);

/* --- ton och determinism ------------------------------------------------------ */
const all = JSON.stringify(worst) + JSON.stringify(taxTrouble) + JSON.stringify(calm);
check("ingen domedagsretorik", !/katastrof|panik|kört|hopplöst/i.test(all));
check(
  "determinism: samma indata ger samma rapport",
  JSON.stringify(buildExecutiveSummary(input({}))) === JSON.stringify(buildExecutiveSummary(input({}))),
);
check(
  "kontrollbalansräkningen förklaras på vanlig svenska",
  JSON.stringify(worst.sections).includes("en särskild balansräkning"),
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
