/**
 * Tester för integrationslagret: skattekontoparsern, aktexporten med
 * iCalendar-frister och kreditunderlaget.
 *
 * Skattekontot testas hårdast. Beloppen därifrån styr bedömningen av
 * personligt ansvar, och en parser som gissar fel där är farligare än en
 * som vägrar.
 */

import { parseSwedishAmount, parseSwedishDate, parseTaxAccount } from "../src/lib/integrations/skattekonto";
import { buildCaseBundle, timelineToIcs } from "../src/lib/integrations/caseBundle";
import { buildCreditDossier } from "../src/lib/integrations/creditDossier";
import { INTEGRATION_REGISTRY, availableNow, blocked } from "../src/lib/integrations/registry";
import type { CaseRecord } from "../src/data/types";

let passed = 0;
let failed = 0;
const check = (name: string, actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${name}\n     fick      ${JSON.stringify(actual)}\n     förväntat ${JSON.stringify(expected)}`);
  }
};

/* -------------------------------------------------------------------------- */
/* Svenska belopp och datum                                                   */
/* -------------------------------------------------------------------------- */

check("enkelt belopp", parseSwedishAmount("1234"), 1234);
check("decimalkomma", parseSwedishAmount("1234,56"), 1234.56);
check("tusentalsmellanslag", parseSwedishAmount("1 234,56"), 1234.56);
check("hårt mellanslag", parseSwedishAmount("1 234"), 1234);
check("punkt som tusental med komma", parseSwedishAmount("1.234,56"), 1234.56);
check("punkt som decimal utan komma", parseSwedishAmount("1.5"), 1.5);
check("minustecken", parseSwedishAmount("-500"), -500);
check("typografiskt minus", parseSwedishAmount("−500"), -500);
check("efterställt minus", parseSwedishAmount("500-"), -500);
check("kr-suffix", parseSwedishAmount("500 kr"), 500);
check("skräp ger null", parseSwedishAmount("abc"), null);
check("tomt ger null", parseSwedishAmount(""), null);

check("ISO-datum", parseSwedishDate("2026-08-12"), "2026-08-12");
check("ÅÅÅÅMMDD", parseSwedishDate("20260812"), "2026-08-12");
check("ÅÅMMDD blir 20xx", parseSwedishDate("260812"), "2026-08-12");
check("skräpdatum ger null", parseSwedishDate("12/08/26"), null);

/* -------------------------------------------------------------------------- */
/* Skattekontoutdraget                                                        */
/* -------------------------------------------------------------------------- */

const TODAY = new Date("2026-08-01T12:00:00Z");

const utdrag = [
  "Skattekonto för 556012-3456",
  "Period: 2026-06-01 - 2026-09-15",
  "",
  "Bokföringsdag;Specifikation;Belopp;Saldo",
  "2026-06-12;Inbetalning bokförd;50 000;−12 000",
  "2026-07-12;Debiterad preliminärskatt;−35 000;−47 000",
  "2026-07-14;Intäktsränta;12,50;−46 987,50",
  "2026-08-12;Arbetsgivaravgift augusti;−62 500;",
  "2026-09-12;Debiterad preliminärskatt;−35 000;",
  "detta är ingen datarad",
].join("\n");

const parsed = parseTaxAccount(utdrag, TODAY);
if (!parsed.ok) {
  failed += 1;
  console.log("FAIL skattekontot gick inte att tolka:", parsed.error);
} else {
  const a = parsed.account;
  check("fem rader tolkade", a.entries.length, 5);
  check("skräprad rapporterad, inte gissad", a.skipped.length, 1);
  check("rubrikraden hittades trots ingress", a.columns.date, "bokföringsdag");
  // Sista raden med saldo är 14 juli - senare rader saknar saldo och får
  // inte skriva över med null.
  check("utgående saldo från sista rad som har ett", a.closingBalance, -46987.5);
  check(
    "kommande förfall är debiteringarna efter idag",
    a.upcomingCharges.map((e) => e.date),
    ["2026-08-12", "2026-09-12"],
  );
  check("kommande förfall summerar rätt", a.upcomingCharges.reduce((s, e) => s + e.amount, 0), -97500);
  check("typografiskt minus i saldo tolkat", a.entries[0].balance, -12000);
}

check(
  "fil utan rubrikrad vägras med instruktion",
  (() => {
    const r = parseTaxAccount("bara\ntext\nhelt\nutan\nstruktur", TODAY);
    return !r.ok && r.error.includes("rubrikrad");
  })(),
  true,
);

/* -------------------------------------------------------------------------- */
/* Aktexporten                                                                */
/* -------------------------------------------------------------------------- */

const caseRecord: CaseRecord = {
  id: "aaaaaaaa-0000-0000-0000-000000000000",
  orgNumber: "556012-3456",
  companyName: "Exempelbolaget AB",
  employees: "6-10",
  canPaySalary: false,
  salaryAmount: "180000",
  salaryDay: 25,
  canPayTax: false,
  taxAmount: "97500",
  taxDay: 12,
  canPayRent: true,
  rentAmount: null,
  rentDay: null,
  canPaySuppliers: false,
  totalDebt: "1400000",
  quickLiquidationValue: "600000",
  recommendationType: "reconstruction",
  recommendationTitle: "Företagsrekonstruktion bör prövas",
  recommendationDescription: null,
  recommendationReasons: ["Skatt kan inte betalas"],
  recommendationNextSteps: ["Kontakta rekonstruktör"],
  createdAt: "2026-08-01T09:00:00.000Z",
  updatedAt: "2026-08-01T09:00:00.000Z",
};

const timeline = [
  {
    iso: "2026-08-12",
    daysAway: 11,
    label: "Skatt förfaller; risk för personligt ansvar",
    amount: 97500,
    severity: "critical" as const,
    note: "SFL 59 kap.",
  },
  { iso: "2026-08-25", daysAway: 24, label: "Löner förfaller", amount: 180000, severity: "warning" as const },
];

const bundle = buildCaseBundle({
  caseRecord,
  timeline,
  payments: [
    { id: "p1", caseId: caseRecord.id, label: "Skatt", amount: 97500, category: "tax", status: "critical", dueDate: "2026-08-12", recurring: false },
  ],
  documents: [
    { id: "d1", caseId: caseRecord.id, kind: "bank_statement", fileName: "kontoutdrag-juli.csv", fileSize: 4211, mimeType: "text/csv", storagePath: "x", source: "manual", note: null, createdAt: "2026-07-30T10:00:00.000Z" },
  ],
  messages: [
    { id: "m1", caseId: caseRecord.id, authorUserId: "owner-1", body: "Kan vi ses på torsdag?", createdAt: "2026-07-30T11:00:00.000Z", readAt: null },
    { id: "m2", caseId: caseRecord.id, authorUserId: "advisor-9", body: "Torsdag 14 fungerar.", createdAt: "2026-07-30T12:00:00.000Z", readAt: null },
  ],
  ownerUserId: "owner-1",
  exportedAt: "2026-08-01T12:00:00.000Z",
});

check("akten är versionsmärkt", bundle.formatVersion, 1);
check("fristerna följer med", bundle.deadlines.length, 2);
check("dokumentlistan är innehållsförteckning", bundle.documents[0].fileName, "kontoutdrag-juli.csv");
check(
  "korrespondens klassas utan att namnge",
  bundle.correspondence.map((c) => c.author),
  ["company", "counterpart"],
);
check("inga användar-id i akten", JSON.stringify(bundle).includes("advisor-9"), false);

/* -------------------------------------------------------------------------- */
/* iCalendar                                                                  */
/* -------------------------------------------------------------------------- */

const ics = timelineToIcs(timeline, {
  companyName: "Exempelbolaget AB",
  orgNumber: "556012-3456",
  generatedAt: "2026-08-01T12:00:00.000Z",
});

check("kalender med två händelser", (ics.match(/BEGIN:VEVENT/g) ?? []).length, 2);
check("heldagsfrist, inte klockslag", ics.includes("DTSTART;VALUE=DATE:20260812"), true);
check("semikolon i rubrik escapat", ics.includes("Skatt förfaller\\; risk"), true);
check("kritisk frist får prioritet", ics.includes("PRIORITY:1"), true);
check("varsel tre dagar före, som produkten", ics.includes("TRIGGER:-P3D"), true);
check("CRLF-radslut enligt RFC 5545", ics.includes("\r\n"), true);
check(
  "deterministiskt UID - omimport dubblerar inte",
  (ics.match(/UID:5560123456-20260812/g) ?? []).length,
  1,
);
// Radvikning: ingen rad över 75 oktetter.
const overlong = ics.split("\r\n").filter((l) => new TextEncoder().encode(l).length > 75);
check("alla rader vikta under 76 oktetter", overlong.length, 0);

/* -------------------------------------------------------------------------- */
/* Kreditunderlaget                                                           */
/* -------------------------------------------------------------------------- */

const dossierInput = {
  caseRecord,
  liquidity: {
    openingBalance: 214000,
    daysUntilNegative: 37,
    horizonDays: 90,
    monthlyIn: 410000,
    monthlyOut: 585000,
  },
  kbr: { shareCapital: 50000, equity: 12000, required: true },
  request: { amount: 750000, purpose: "Överbrygga ackordsförhandling under rekonstruktionens första tre månader.", kind: "brygglån" },
  generatedAt: "2026-08-01T12:00:00.000Z",
};

const dossier = buildCreditDossier(dossierInput);
if (!dossier.ok) {
  failed += 1;
  console.log("FAIL kreditunderlaget byggdes inte:", dossier.missing);
} else {
  const text = JSON.stringify(dossier.report);
  check("dag kassan tar slut redovisas", text.includes("Om 37 dagar"), true);
  check("KBR-plikten döljs inte", text.includes("ABL 25 kap. 13"), true);
  check("skulden redovisas", text.includes("1 400 000 kr"), true);
  check(
    "friskrivningen säger ingen förmedling",
    dossier.report.disclaimer.includes("förmedlar inte krediter"),
    true,
  );
  check("paketet bär samma friskrivning", dossier.package.disclaimer, dossier.report.disclaimer);
  check("paketet är versionsmärkt", dossier.package.formatVersion, 1);
}

check(
  "utan likviditetsplan vägrar byggaren",
  (() => {
    const r = buildCreditDossier({ ...dossierInput, liquidity: null });
    return !r.ok && r.missing.some((m) => m.includes("likviditetsplan"));
  })(),
  true,
);
check(
  "utan ändamål vägrar byggaren",
  (() => {
    const r = buildCreditDossier({ ...dossierInput, request: { ...dossierInput.request, purpose: "kort" } });
    return !r.ok && r.missing.some((m) => m.includes("ändamål"));
  })(),
  true,
);

/* -------------------------------------------------------------------------- */
/* Registret                                                                  */
/* -------------------------------------------------------------------------- */

check(
  "kreditförmedling är blockerad, inte planerad",
  blocked().some((t) => t.id === "kreditformedling"),
  true,
);
check(
  "PSD2 är blockerad tills undantag beslutats",
  blocked().some((t) => t.id === "psd2"),
  true,
);
check(
  "det som påstås fungera pekar på byggd kod",
  availableNow().every((t) => t.builtToday.includes("src/lib/")),
  true,
);
check(
  "varje mål har ett nästa steg",
  INTEGRATION_REGISTRY.every((t) => t.nextStep.trim().length > 0),
  true,
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
