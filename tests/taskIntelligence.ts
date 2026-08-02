/**
 * Tester för de intelligenta uppgifterna.
 *
 * Spelböckerna testas mot löftena: varje uppgift vet varför den finns,
 * vad som ligger bakom, vad som står på spel och när den är klar. Okända
 * uppgifter får inga påhittade steg. Matchningen väljer inte slumpmässigt
 * och säger alltid varför.
 */

import { matchProfessionals, playbookForTask, type TaskContext } from "../src/lib/taskIntelligence";
import type { CaseRecord, ProfessionalRecord } from "../src/data/types";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra = "") => {
  if (ok) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${name} ${extra}`);
  }
};

const mkCase = (over: Partial<CaseRecord> = {}): CaseRecord => ({
  id: "c1", orgNumber: "556012-3456", companyName: "Demobolaget AB", employees: "5",
  canPaySalary: true, salaryAmount: null, salaryDay: 25,
  canPayTax: false, taxAmount: null, taxDay: 12,
  canPayRent: true, rentAmount: null, rentDay: 1,
  canPaySuppliers: true, totalDebt: null, quickLiquidationValue: null,
  recommendationType: "reconstruction",
  recommendationTitle: "Företagsrekonstruktion bör utredas",
  recommendationDescription: null, recommendationReasons: [], recommendationNextSteps: [],
  createdAt: "2026-08-01T10:00:00.000Z", updatedAt: "2026-08-01T10:00:00.000Z",
  ...over,
});

const ctx = (over: Partial<TaskContext> = {}): TaskContext => ({
  caseRecord: mkCase(),
  members: [],
  documents: [],
  payments: [],
  kbr: null,
  ...over,
});

/* --- kontakta rådgivare -------------------------------------------------------- */
const contact = playbookForTask("Kontakta en rekonstruktör för att bedöma om verksamheten anses livskraftig", ctx());
check("kontakt: rätt spelbok", contact.id === "kontakta-radgivare");
check("kontakt: varför förklaras med livskraftskravet", contact.why.includes("livskraftig"));
check("kontakt: underlagen bakom bedömningen visas", contact.basis.some((b) => b.includes("skatten")));
check("kontakt: konsekvensen är saklig", contact.consequence.includes("kan få långtgående") && !/kommer att/.test(contact.consequence));
check("kontakt: erbjuder matchning", contact.offersMatching);
check("kontakt: inte klar utan rådgivare", !contact.complete);

const withAdvisor = playbookForTask("Kontakta en rekonstruktör", ctx({
  members: [{ id: "m1", caseId: "c1", userId: "u2", role: "reconstructor", displayName: "R", email: null, createdAt: "2026-08-01T10:00:00.000Z", revokedAt: null }],
}));
check("kontakt: klar när rekonstruktören är i ärendet", withAdvisor.complete);
check("kontakt: steget bockas i processen", withAdvisor.steps[0].done);

/* --- verksam åtgärd ------------------------------------------------------------- */
const shield = playbookForTask("Vidta en verksam åtgärd före skattens förfallodag", ctx());
check("verksam åtgärd: fristprincipen i varför", shield.why.includes("senast på skattens förfallodag"));
check("verksam åtgärd: KBR-steget pekar på /kbr", shield.steps.some((s) => s.href === "/kbr"));
const shieldDone = playbookForTask("Vidta en verksam åtgärd", ctx({
  kbr: { status: "required", createdAt: "2026-08-01T10:00:00.000Z" },
  documents: [{ id: "d1", caseId: "c1", kind: "other", fileName: "protokoll.txt", fileSize: 1, mimeType: "text/plain", storagePath: "x", source: "manual", note: "Genererad mall: KBR-beslut", createdAt: "2026-08-01T10:00:00.000Z" }],
}));
check("verksam åtgärd: klar när KBR + protokoll finns", shieldDone.complete);

/* --- likviditet + underlag ------------------------------------------------------ */
check("likviditet: klar när planen finns", playbookForTask("Ta fram en likviditetsbudget för minst 90 dagar", ctx({
  payments: [{ id: "p1", caseId: "c1", label: "Hyra", amount: 58000, category: "rent", status: "pending", dueDate: "2026-08-05", userId: "u1" } as never],
})).complete);
check("underlag: två handlingar räcker", playbookForTask("Sammanställ underlag: skuldlista...", ctx({
  documents: [
    { id: "d1", caseId: "c1", kind: "bank_statement", fileName: "a.csv", fileSize: 1, mimeType: "text/csv", storagePath: "x", source: "manual", note: null, createdAt: "2026-08-01T10:00:00.000Z" },
    { id: "d2", caseId: "c1", kind: "annual_report", fileName: "b.pdf", fileSize: 1, mimeType: "application/pdf", storagePath: "y", source: "manual", note: null, createdAt: "2026-08-01T10:00:00.000Z" },
  ],
})).complete);

/* --- okänd uppgift: inga påhittade steg ---------------------------------------- */
const generic = playbookForTask("Ring farbror Gustav", ctx());
check("okänd uppgift: generisk spelbok", generic.id === "generisk");
check("okänd uppgift: inga steg hittas på", generic.steps.length === 0);
check("okänd uppgift: aldrig autoklar", !generic.complete);

/* --- matchningen ---------------------------------------------------------------- */
const pros: ProfessionalRecord[] = [
  { id: "a", name: "Rekon AB", company: "Rekon AB", category: "rekonstruktor", description: "", location: "Stockholm", email: null, phone: null, website: null, fixedPrices: [{ service: "Genomgång", price: 0 }], specializations: ["Obeståndsfrågor"], verified: true },
  { id: "b", name: "Revisor X", company: null, category: "revisor", description: "", location: "Malmö", email: null, phone: null, website: null, fixedPrices: [], specializations: ["Kontrollbalansräkning"], verified: true },
  { id: "c", name: "Jurist Y", company: null, category: "affarsjurist", description: "", location: "Göteborg", email: null, phone: null, website: null, fixedPrices: [], specializations: ["Styrelseansvar"], verified: false },
];
const matches = matchProfessionals(mkCase(), pros);
check("matchning: rekonstruktören först vid rekonstruktion", matches[0].professional.id === "a");
check("matchning: varje förslag motiveras", matches.every((m) => m.reasons.length > 0));
check("matchning: motivet nämner rekonstruktion", matches[0].reasons.some((r) => r.includes("företagsrekonstruktion")));
const bankruptcyMatches = matchProfessionals(mkCase({ recommendationType: "bankruptcy" }), pros);
check("matchning: juristen först vid konkurs", bankruptcyMatches[0].professional.id === "c" || bankruptcyMatches[0].professional.category === "affarsjurist");
check("matchning: determinism", JSON.stringify(matchProfessionals(mkCase(), pros)) === JSON.stringify(matches));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
