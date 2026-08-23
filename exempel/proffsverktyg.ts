/**
 * PROFFSVERKTYGET - ETT KÖRBART EXEMPEL PÅ ATT BYGGA VID SIDAN AV.
 *
 * Det här är startpunkten för ett verktyg för praktiker (jurist,
 * rekonstruktör, konkursförvaltare) byggt på SAMMA motor som produkten -
 * utan att importera en enda produktmodul. Allt kommer ur den extraherade
 * filen clearance-motor.ts:
 *
 *   import { ... } from "../clearance-motor";
 *
 * TRE SAKER EXEMPLET VISAR, för de är hela arkitekturpoängen:
 *
 *  1. MOTORNS FUNKTIONER ÄR RENA. analyseCrisis, buildExecutiveSummary,
 *     playbookForTask och countdownTo tar poster in och ger bedömningar ut.
 *     Verktyget äger sin egen lagring - här en enkel ärendemapp i minnet;
 *     i ett riktigt verktyg byråns ärendesystem eller en egen databas.
 *
 *  2. DÄR MOTORN BEHÖVER NÅGOT UTIFRÅN TAR DEN EMOT EN PORT. lookupCompany
 *     kräver en CompanyLookupPort - verktyget skickar in sin egen. Porten
 *     får inte hitta på: null betyder "kunde inte slås upp", och det är ett
 *     ärligt svar, inte ett misslyckande.
 *
 *  3. SAMMA DATAMODELL, PRAKTIKERNS VY. buildExecutiveSummary med
 *     audience: "practitioner" ger den juridiska analysen med lagrum -
 *     samma regel som produkten lovar: en datamodell, rollanpassad
 *     presentation. Exemplet KRÄVER att vyerna skiljer sig; blir de lika
 *     har någon brutit löftet, och då ska körningen bli röd.
 *
 * Körs med: npm run exempel:proffsverktyg
 * Prövas av: npm run test:motor (körningen ingår, och får inte vara tyst)
 */
import {
  analyseCrisis,
  buildExecutiveSummary,
  countdownTo,
  compareByUrgency,
  playbookForTask,
  lookupCompany,
  validateOrgNumber,
  type AnalysisInput,
  type CaseRecord,
  type CaseTask,
  type CaseMemberRecord,
  type PaymentRecord,
  type CompanyInfo,
  type CompanyLookupPort,
  type TaskContext,
} from "../clearance-motor";

/* --- Kontrollerna: exemplet ska kunna bli rött ---------------------------- */

let roda = 0;
const kontroll = (namn: string, ok: boolean, extra?: unknown): void => {
  if (!ok) {
    roda += 1;
    console.error(`FEL  ${namn}${extra === undefined ? "" : `  ${JSON.stringify(extra)}`}`);
  }
};

/* --- 1. Verktygets egen lagring: byråns ärende ---------------------------- */

const NU = new Date();
const iso = (dagar: number): string =>
  new Date(NU.getTime() + dagar * 86_400_000).toISOString().slice(0, 10);

const arende: CaseRecord = {
  id: "byra-2026-114",
  orgNumber: "556677-8899",
  companyName: "Sundins Måleri AB",
  employees: "6-10",
  canPaySalary: true,
  salaryAmount: "310000",
  salaryDay: 25,
  canPayTax: false,
  taxAmount: "285000",
  taxDay: 12,
  canPayRent: true,
  rentAmount: "62000",
  rentDay: 1,
  canPaySuppliers: false,
  totalDebt: "1900000",
  quickLiquidationValue: "700000",
  recommendationType: null,
  recommendationTitle: null,
  recommendationDescription: null,
  recommendationReasons: [],
  recommendationNextSteps: [],
  createdAt: iso(-14),
  updatedAt: iso(0),
  closedAt: null,
  exitReason: null,
  healthMode: false,
  planApprovedAt: null,
  planApprovedBy: null,
};

const medlemmar: CaseMemberRecord[] = [
  { id: "m1", caseId: arende.id, userId: "u1", role: "owner", displayName: "Eva Sundin", email: "eva@sundinsmaleri.se", createdAt: arende.createdAt, revokedAt: null },
  { id: "m2", caseId: arende.id, userId: "u2", role: "legal_advisor", displayName: "Advokat Berg", email: "berg@byran.se", createdAt: arende.createdAt, revokedAt: null },
];

const betalningar: PaymentRecord[] = [
  { id: "p1", caseId: arende.id, label: "Arbetsgivaravgifter och skatt", amount: 285000, category: "tax", status: "critical", dueDate: iso(-4), recurring: true },
  { id: "p2", caseId: arende.id, label: "Löner", amount: 310000, category: "salary", status: "pending", dueDate: iso(6), recurring: true },
  { id: "p3", caseId: arende.id, label: "Hyra kvartal 3", amount: 62000, category: "rent", status: "pending", dueDate: iso(11), recurring: true },
];

const uppgifter: CaseTask[] = [
  { id: "t1", caseId: arende.id, label: "Upprätta kontrollbalansräkning", dueDate: iso(7), doneAt: null, doneBy: null, source: "recommendation", createdAt: arende.createdAt, assignedTo: "u2" },
  { id: "t2", caseId: arende.id, label: "Ansök om anstånd med skatten", dueDate: iso(2), doneAt: null, doneBy: null, source: "recommendation", createdAt: arende.createdAt, assignedTo: null },
];

/* --- 2. Verktygets egen port: byråns bolagsregister ----------------------- */

const byranBolagsregister: CompanyLookupPort = {
  async lookup(orgNumber: string): Promise<CompanyInfo | null> {
    // Byråns eget klientregister. Finns bolaget inte där är svaret null -
    // porten hittar aldrig på, för motorn presenterar svaret som registerdata.
    if (orgNumber.replace(/\D/g, "") !== arende.orgNumber.replace(/\D/g, "")) return null;
    return {
      name: "Sundins Måleri AB",
      legalForm: "Aktiebolag",
      address: "Verkstadsgatan 4, 135 40 Tyresö",
      sniCode: "43.341",
      sniDescription: "Måleriarbeten",
      registrationYear: "2011",
    };
  },
};

/* --- 3. Motorn arbetar ---------------------------------------------------- */

const analysUnderlag: AnalysisInput = {
  canPaySalary: arende.canPaySalary,
  canPayTax: arende.canPayTax,
  canPayRent: arende.canPayRent,
  canPaySuppliers: arende.canPaySuppliers,
  salaryAmount: Number(arende.salaryAmount),
  salaryDay: arende.salaryDay ?? 25,
  taxAmount: Number(arende.taxAmount),
  taxDay: arende.taxDay ?? 12,
  rentAmount: Number(arende.rentAmount),
  rentDay: arende.rentDay ?? 1,
  totalDebt: Number(arende.totalDebt),
  quickLiquidationValue: Number(arende.quickLiquidationValue),
  employees: arende.employees ?? "",
};

const main = async (): Promise<void> => {
  kontroll("organisationsnumret klarar Luhn-kontrollen", validateOrgNumber(arende.orgNumber));

  const bolag = await lookupCompany(arende.orgNumber, byranBolagsregister);
  kontroll("porten svarar med byråns registerpost", bolag?.name === "Sundins Måleri AB", bolag);
  kontroll("ett okänt bolag ger null, inte en gissning", (await lookupCompany("556012-3456", byranBolagsregister)) === null);

  const analys = analyseCrisis(analysUnderlag);
  kontroll("bedömningen vilar på fullständigt underlag", analys.basis === "complete", analys.basis);
  kontroll("analysen ger en rekommendation", ["bankruptcy", "reconstruction", "stabilize"].includes(analys.type), analys.type);
  kontroll("tidslinjen har händelser att bevaka", analys.timeline.length > 0, analys.timeline.length);

  const tidslinje = [...analys.timeline].sort(compareByUrgency);
  const narmast = tidslinje.map((h) => ({ h, n: countdownTo(h.iso, NU) })).find(({ n }) => n.tone !== "passed");

  const praktikerRapport = buildExecutiveSummary({
    caseRecord: arende, timeline: analys.timeline, tasks: uppgifter, members: medlemmar,
    kbr: { status: "required", createdAt: iso(-3) }, documentCount: 2, payments: betalningar,
    now: NU, audience: "practitioner",
  });
  const bolagsRapport = buildExecutiveSummary({
    caseRecord: arende, timeline: analys.timeline, tasks: uppgifter, members: medlemmar,
    kbr: { status: "required", createdAt: iso(-3) }, documentCount: 2, payments: betalningar,
    now: NU, audience: "company",
  });
  kontroll("rapporten har avsnitt", praktikerRapport.sections.length > 0);
  kontroll(
    "praktikerns vy skiljer sig från bolagets - rollanpassningen lever",
    JSON.stringify(praktikerRapport.sections) !== JSON.stringify(bolagsRapport.sections),
  );

  const sammanhang: TaskContext = {
    caseRecord: arende, members: medlemmar, documents: [], payments: betalningar,
    kbr: { status: "required", createdAt: iso(-3) },
  };
  const spelbok = playbookForTask("Upprätta kontrollbalansräkning", sammanhang);
  kontroll("spelboken förklarar varför", spelbok.why.trim().length > 20, spelbok.why);
  kontroll("spelboken har steg att följa", spelbok.steps.length > 0, spelbok.steps.length);

  /* --- 4. Praktikerns utskrift ------------------------------------------- */

  const kr = (v: number): string => `${String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`;
  console.log("=".repeat(72));
  console.log(`ÄRENDE ${arende.id} · ${bolag?.name} · ${arende.orgNumber} · ${bolag?.sniDescription}`);
  console.log("=".repeat(72));
  console.log(`\nBEDÖMNING (underlag: ${analys.basis}): ${analys.title}`);
  console.log(`  ${analys.description}`);
  console.log(`\nSKULD ${kr(Number(arende.totalDebt))} · SNABBVÄRDE ${kr(Number(arende.quickLiquidationValue))}`);
  if (narmast) console.log(`\nNÄRMAST: ${narmast.h.label} - ${narmast.n.label}`);
  console.log(`\nPRAKTIKERRAPPORT: ${praktikerRapport.headline} [${praktikerRapport.severityLabel}]`);
  for (const avsnitt of praktikerRapport.sections.slice(0, 4)) console.log(`  · ${avsnitt.title}`);
  console.log(`\nSPELBOK "Upprätta kontrollbalansräkning": ${spelbok.steps.length} steg`);
  for (const steg of spelbok.steps) console.log(`  ${steg.done ? "[x]" : "[ ]"} ${steg.label}`);

  console.log(`\n${roda === 0 ? "EXEMPLET HÅLLER: alla kontroller gröna." : `${roda} kontroller RÖDA.`}`);
  if (roda > 0) process.exit(1);
};

main().catch((fel) => { console.error(fel); process.exit(1); });
