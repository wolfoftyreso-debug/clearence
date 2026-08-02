/**
 * Tester för ärendesammanfattningen och förhandsvisningen.
 *
 * Den viktigaste egenskapen är negativ: förhandsvisningen får ALDRIG
 * innehålla bolagets identitet. Testet serialiserar hela objektet och letar
 * efter namn, organisationsnummer, e-post och filnamn - läcker något ska
 * det upptäckas här och inte hos en rådgivare.
 */

import { buildLeadPreview, buildLeadSummary, kindOfDocument } from "../src/lib/leadSummary";
import { analyseCrisis } from "../src/lib/crisisAnalysis";
import { analysisInputFromCase } from "../src/lib/caseAnalysis";
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
const documents = ["Demobolaget-kontrollbalansrakning.pdf", "styrelseprotokoll-2026.pdf", "export.sie"];

/* --- förhandsvisningen: avidentifierad ------------------------------------ */
const preview = buildLeadPreview(caseRecord, analysis, documents);
const serialised = JSON.stringify(preview);
check("preview: inget bolagsnamn", !serialised.includes("Demobolaget"));
check("preview: inget organisationsnummer", !serialised.includes("556012"));
check("preview: inga filnamn", !serialised.includes(".pdf") && !serialised.includes(".sie"));
check("preview: ingen e-post", !serialised.includes("@"));
check("preview: storleksbandet med", preview.sizeBand === "6-10 anställda");
check(
  "preview: problemtypen på svenska, aldrig råkoden",
  ["Rekonstruktionsläge", "Konkursnära läge", "Stabilisering"].includes(preview.problemType),
  preview.problemType,
);
check("preview: komplexiteten hög (3,2 mkr skuld + tre betalningsproblem)", preview.complexity === "hög");
check("preview: dokumenten räknas", preview.documentCount === 3);
check(
  "preview: dokumenttyper, inte namn",
  preview.documentKinds.includes("Kontrollbalansräkning") &&
    preview.documentKinds.includes("Styrelseprotokoll") &&
    preview.documentKinds.includes("Bokföringsexport (SIE)"),
  preview.documentKinds.join("|"),
);

const smallCase: CaseRecord = {
  ...caseRecord,
  totalDebt: "200000",
  canPayTax: true,
  canPaySuppliers: true,
  canPaySalary: true,
};
check("preview: litet bolag får låg komplexitet", buildLeadPreview(smallCase, analysis, []).complexity === "låg");

/* --- sammanfattningen: allt rådgivaren behöver ---------------------------- */
const summary = buildLeadSummary(caseRecord, analysis, documents, "vd@demobolaget.se", "Behöver hjälp före lönekörningen.");
check("summary: identiteten med", summary.companyName === "Demobolaget AB" && summary.orgNumber === "556012-3456");
check("summary: kontaktvägen med", summary.contactEmail === "vd@demobolaget.se");
check("summary: skälet med", summary.reason === "Behöver hjälp före lönekörningen.");
check("summary: situationen ur systemanalysen", summary.situation === analysis.description);
check("summary: analysrubriken med", summary.analysisTitle === analysis.title);
check("summary: dokumentlistan komplett", summary.documents.length === 3);

const debt = summary.keyFigures.find((f) => f.label === "Total skuld");
check("summary: skulden formatterad med vanliga mellanslag", debt?.value === "3 200 000 kr", debt?.value);
check("summary: inga hårda mellanslag", !JSON.stringify(summary).includes(" "));
check(
  "summary: nyckeltalen kompletta",
  ["Total skuld", "Snabbt realiserbart värde", "Månadslöner", "Skatt denna månad", "Månadshyra"].every(
    (label) => summary.keyFigures.some((f) => f.label === label),
  ),
);

/* --- dokumenttypningen ---------------------------------------------------- */
check("dokumenttyp: kbr", kindOfDocument("KBR-utkast.pdf") === "Kontrollbalansräkning");
check("dokumenttyp: skatt", kindOfDocument("skattekonto-utdrag.pdf") === "Skatteunderlag");
check("dokumenttyp: okänt", kindOfDocument("bild.png") === "Övrigt underlag");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
