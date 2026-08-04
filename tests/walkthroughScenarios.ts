/**
 * GENOMGÅNG: nio bolagsupplägg genom hela kedjan.
 *
 * Inte ett test med rätt svar, utan en RAPPORT: samma nio situationer
 * körs genom analysen, sammanfattningen, notiserna, dörrarna och
 * nyckeltalen, och resultatet skrivs ut för granskning. Det som ett
 * enhetstest inte kan säga - om helheten är rimlig - syns bara så här.
 *
 * Rapporten larmar ändå på det som är objektivt fel: ett råd utan dörr,
 * en dörr till en sida som inte finns, en tom lista där det ska stå
 * något. De raderna märks med AVVIKELSE.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyseCrisis, type AnalysisInput } from "../src/lib/crisisAnalysis";
import { buildExecutiveSummary } from "../src/lib/executiveSummary";
import { buildNotifications } from "../src/lib/notifications";
import { badgeCount } from "../src/lib/notificationsRead";
import { destinationFor } from "../src/lib/guidedArrival";
import type { TaskContext } from "../src/lib/taskIntelligence";
import { buildKeyFigures } from "../src/lib/liquidityKeyFigures";
import { KNOWLEDGE_ARTICLES } from "../src/lib/knowledge";
import type { CaseRecord } from "../src/data/types";

const appSource = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
const ROUTES = [...appSource.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
const SLUGS = KNOWLEDGE_ARTICLES.map((a) => a.slug);
const routeExists = (href: string): boolean => {
  const path = href.split("#")[0].split("?")[0];
  if (path.startsWith("/kunskap/")) return SLUGS.includes(path.slice("/kunskap/".length));
  return ROUTES.includes(path);
};

const NOW = new Date("2026-08-04T09:00:00");
let avvikelser = 0;
const flag = (text: string) => { avvikelser += 1; console.log(`   AVVIKELSE  ${text}`); };

interface Scenario {
  name: string;
  note: string;
  input: AnalysisInput;
}

const base: AnalysisInput = {
  canPaySalary: true, canPayTax: true, canPayRent: true, canPaySuppliers: true,
  salaryAmount: 0, salaryDay: 25, taxAmount: 0, taxDay: 12,
  rentAmount: 0, rentDay: 1, totalDebt: 0, quickLiquidationValue: 0, employees: "0",
};

const SCENARIOS: Scenario[] = [
  {
    name: "1. Vilande enmansbolag",
    note: "Allt kan betalas, ingen skuld. Systemet ska INTE larma.",
    input: { ...base, employees: "0" },
  },
  {
    name: "2. Tillfällig svacka",
    note: "Leverantörerna får vänta, löner och skatt går. Klassisk likviditetsstress.",
    input: { ...base, canPaySuppliers: false, salaryAmount: 180_000, taxAmount: 60_000, rentAmount: 40_000, totalDebt: 900_000, quickLiquidationValue: 1_400_000, employees: "3" },
  },
  {
    name: "3. Skatten först",
    note: "Bara skatten kan inte betalas. Företrädaransvaret är hela frågan.",
    input: { ...base, canPayTax: false, salaryAmount: 220_000, taxAmount: 165_000, rentAmount: 58_000, totalDebt: 1_200_000, quickLiquidationValue: 1_500_000, employees: "4" },
  },
  {
    name: "4. Lönerna i fara, tolv anställda",
    note: "Personal berörs. Lönegarantin gäller först vid beslut - får inte utlovas.",
    input: { ...base, canPaySalary: false, salaryAmount: 640_000, taxAmount: 210_000, rentAmount: 95_000, totalDebt: 2_800_000, quickLiquidationValue: 1_900_000, employees: "12" },
  },
  {
    name: "5. Rekonstruktionskandidat",
    note: "Skatt och leverantörer stoppar. Skulden större än snabbvärdet.",
    input: { ...base, canPayTax: false, canPaySuppliers: false, salaryAmount: 420_000, taxAmount: 165_000, rentAmount: 58_000, totalDebt: 3_200_000, quickLiquidationValue: 950_000, employees: "8" },
  },
  {
    name: "6. Konkursnära",
    note: "Ingenting kan betalas. Skuld 9 Mkr mot 200 tkr i snabbvärde.",
    input: { ...base, canPaySalary: false, canPayTax: false, canPayRent: false, canPaySuppliers: false, salaryAmount: 800_000, taxAmount: 400_000, rentAmount: 150_000, totalDebt: 9_000_000, quickLiquidationValue: 200_000, employees: "22" },
  },
  {
    name: "7. Kapitalbrist utan betalningsproblem",
    note: "Allt betalas i tid, men skulden överstiger tillgångarna. KBR-fallet.",
    input: { ...base, totalDebt: 4_000_000, quickLiquidationValue: 1_200_000, salaryAmount: 300_000, taxAmount: 90_000, rentAmount: 50_000, employees: "6" },
  },
  {
    name: "8. Ofullständigt underlag",
    note: "Användaren har hoppat över frågorna. Systemet får inte gissa.",
    input: { ...base, canPaySalary: null, canPayTax: null, canPayRent: null, canPaySuppliers: null, employees: "" },
  },
  {
    name: "9. Extremvärden",
    note: "Mycket stora tal. Ska inte spilla över eller ge nonsens.",
    input: { ...base, canPayTax: false, canPaySuppliers: false, salaryAmount: 98_000_000, taxAmount: 45_000_000, rentAmount: 12_000_000, totalDebt: 890_000_000, quickLiquidationValue: 4_000_000, employees: "1400" },
  },
];

const caseFrom = (s: Scenario): CaseRecord =>
  ({
    id: "c1", orgNumber: "556012-3456", companyName: "Testbolaget AB",
    employees: s.input.employees,
    canPaySalary: s.input.canPaySalary, canPayTax: s.input.canPayTax,
    canPayRent: s.input.canPayRent, canPaySuppliers: s.input.canPaySuppliers,
    salaryAmount: String(s.input.salaryAmount), taxAmount: String(s.input.taxAmount),
    rentAmount: String(s.input.rentAmount), totalDebt: String(s.input.totalDebt),
    salaryDay: s.input.salaryDay, taxDay: s.input.taxDay, rentDay: s.input.rentDay,
    recommendationType: null, recommendationTitle: null,
    recommendationDescription: null, recommendationReasons: [], recommendationNextSteps: [],
    quickLiquidationValue: String(s.input.quickLiquidationValue),
    createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
    closedAt: null, exitReason: null, planApprovedAt: null, planApprovedBy: null,
  } as unknown as CaseRecord);

console.log("=".repeat(78));
console.log("GENOMGÅNG AV HELA KEDJAN - nio upplägg");
console.log("Klockan är fryst till", NOW.toLocaleDateString("sv-SE"), "så nedräkningarna är jämförbara.");
console.log("=".repeat(78));

for (const scenario of SCENARIOS) {
  const analysis = analyseCrisis(scenario.input);
  const caseRecord = { ...caseFrom(scenario), recommendationType: analysis.type, recommendationTitle: analysis.title } as CaseRecord;
  const ctx: TaskContext = { caseRecord, members: [], documents: [], payments: [], kbr: null };

  console.log(`\n${"-".repeat(78)}`);
  console.log(scenario.name);
  console.log(`   ${scenario.note}`);
  console.log("-".repeat(78));

  /* Analysen */
  console.log(`   Bedömning        ${analysis.type} - ${analysis.title}`);
  console.log(`   Brådska          ${analysis.urgency}`);
  console.log(`   Betalningsförmåga ${analysis.solvency.indication}`);
  console.log(`   Täckningsgrad    ${analysis.coverage.ratio === null ? "kan inte räknas" : `${Math.round(analysis.coverage.ratio * 100)} %`}`);
  console.log(`   Riskflaggor      ${analysis.riskFlags.length}${analysis.riskFlags.length ? ": " + analysis.riskFlags.map((f) => f.id).join(", ") : ""}`);
  console.log(`   Datum som bevakas ${analysis.timeline.length}`);

  if (analysis.type === null || !analysis.title) flag("bedömningen saknar typ eller rubrik");
  if (analysis.nextSteps.length === 0) flag("inga nästa steg alls");

  /* Dörrarna */
  const doors = analysis.nextSteps.map((s) => ({ text: s.text, door: destinationFor(s.text, ctx) }));
  const withDoor = doors.filter((d) => d.door);
  console.log(`   Rekommendationer ${doors.length}, varav ${withDoor.length} med dörr`);
  for (const d of doors) {
    if (!d.door) { flag(`utan dörr: "${d.text.slice(0, 58)}"`); continue; }
    if (!routeExists(d.door.href)) flag(`dörr till okänd sida: ${d.door.href}`);
  }
  for (const d of withDoor.slice(0, 3)) {
    console.log(`      → ${d.door!.href.padEnd(26)} ${d.text.slice(0, 44)}`);
  }

  /* Sammanfattningen */
  const summary = buildExecutiveSummary({
    caseRecord, timeline: analysis.timeline, tasks: [], members: [], kbr: null,
    documentCount: 0, payments: [], now: NOW, audience: "company",
  });
  console.log(`   Rapportrubrik    ${summary.headline.slice(0, 62)}`);
  console.log(`   Prioriterade    ${summary.actions.length} åtgärder, ${summary.actions.filter((a) => a.horizon === "omedelbart").length} omedelbara`);
  if (!summary.headline.trim()) flag("rapporten saknar rubrik");
  const badHref = summary.actions.filter((a) => a.href && !routeExists(a.href));
  if (badHref.length) flag(`åtgärd pekar på okänd sida: ${badHref.map((a) => a.href).join(", ")}`);

  /* Klockan */
  const notifications = buildNotifications({
    caseRecord, crisis: { urgency: analysis.urgency, title: analysis.title },
    timeline: analysis.timeline, mentions: [], invitations: [], kbr: null,
    failedEmails: [], pendingApplications: 0, newContactMessages: 0, pendingProfileClaims: 0,
    now: NOW,
  });
  const demanding = notifications.filter((n) => n.demandsAction).length;
  console.log(`   Klockan          ${notifications.length} rader, ${badgeCount(notifications, new Set())} räknas`);
  if (notifications.length > 0 && demanding === 0 && analysis.urgency !== "months") {
    flag("klockan visar rader men räknar noll trots brådska");
  }
  for (const n of notifications) {
    if (!routeExists(n.href)) flag(`notis pekar på okänd sida: ${n.href}`);
  }

  /* Nyckeltalen, med scenariots betalningar som utflöde */
  const out = scenario.input.salaryAmount + scenario.input.taxAmount + scenario.input.rentAmount;
  const figures = buildKeyFigures({
    startingBalance: Math.round(out * 0.4), payments: [], horizonDays: 45,
    finalBalance: Math.round(out * 0.4) - out, daysToNegative: out > 0 ? 12 : null,
    scenarioLabel: "Fortsatt drift", incomingUnpaidTotal: 0, incomingUnpaidCount: 0,
  });
  const runway = figures.find((f) => f.id === "runway")!;
  console.log(`   Runway           ${runway.value}, ${runway.limits.length} förbehåll`);
  if (runway.limits.length === 0) flag("nyckeltalet saknar förbehåll");
}

console.log(`\n${"=".repeat(78)}`);
console.log(avvikelser === 0 ? "INGA AVVIKELSER" : `${avvikelser} AVVIKELSER`);
console.log("=".repeat(78));
if (avvikelser > 0) process.exit(1);
