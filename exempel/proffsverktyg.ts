/**
 * PROFFSVERKTYGET - ETT KÖRBART EXEMPEL PÅ ATT BYGGA VID SIDAN AV.
 *
 * Ett verktyg för praktiker (jurist, rekonstruktör, konkursförvaltare)
 * byggt på SAMMA motor som produkten - utan att importera en enda
 * produktmodul. Allt kommer ur den extraherade filen:
 *
 *   import { ... } from "../clearance-motor";
 *
 * Verktyget har två lägen:
 *
 *   npm run exempel:proffsverktyg              demonstrationen: två seedade
 *                                              akter, alla kontroller körs
 *   npm run exempel:proffsverktyg -- <katalog> byråns ärendemapp: läser
 *                                              varje akt (JSON-fil) och
 *                                              skriver portfölj + rapporter
 *
 * FYRA SAKER EXEMPLET VISAR, för de är hela arkitekturpoängen:
 *
 *  1. MOTORNS FUNKTIONER ÄR RENA. analyseCrisis, buildExecutiveSummary,
 *     playbookForTask och countdownTo tar poster in och ger bedömningar ut.
 *     Verktyget äger sin lagring själv - se exempel/lager.ts: en port, två
 *     adaptrar (minne för prov, JSON-mapp för byrån), och den dag byrån
 *     vill ha Postgres är det EN adapter till, inte en omskrivning.
 *
 *  2. DÄR MOTORN BEHÖVER NÅGOT UTIFRÅN TAR DEN EMOT EN PORT. lookupCompany
 *     kräver en CompanyLookupPort - verktyget skickar in sin egen. Porten
 *     får inte hitta på: null betyder "kunde inte slås upp".
 *
 *  3. SAMMA DATAMODELL, PRAKTIKERNS VY. buildExecutiveSummary med
 *     audience: "practitioner" ger den juridiska analysen. Exemplet KRÄVER
 *     att vyerna skiljer sig; blir de lika har någon brutit löftet.
 *
 *  4. PORTFÖLJEN RÄKNAS UR SAMMA MOTORER SOM ÄRENDET. severity per ärende
 *     kommer ur buildExecutiveSummary - samma väg som produktens
 *     praktikervy - så portföljens rangordning och ärenderapporten aldrig
 *     kan säga olika saker. Exemplet kräver att det akuta ärendet rankas
 *     före det stabila.
 *
 * Prövas av: npm run test:motor (körningen ingår, och får inte vara tyst)
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  analyseCrisis,
  buildExecutiveSummary,
  buildPortfolioSummary,
  countdownTo,
  compareByUrgency,
  playbookForTask,
  lookupCompany,
  validateOrgNumber,
  type AnalysisInput,
  type CaseRecord,
  type CompanyInfo,
  type CompanyLookupPort,
  type ExecutiveSummary,
  type TaskContext,
} from "../clearance-motor";
import { filLager, minnesLager, type ArendeAkt, type ArendeLager } from "./lager";

/* --- Kontrollerna: exemplet ska kunna bli rött ---------------------------- */

let roda = 0;
const kontroll = (namn: string, ok: boolean, extra?: unknown): void => {
  if (!ok) {
    roda += 1;
    console.error(`FEL  ${namn}${extra === undefined ? "" : `  ${JSON.stringify(extra)}`}`);
  }
};

const NU = new Date();
const iso = (dagar: number): string =>
  new Date(NU.getTime() + dagar * 86_400_000).toISOString().slice(0, 10);
const kr = (v: number): string =>
  `${String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`;

/* --- Demonstrationens akter ----------------------------------------------- */

const stomme = (over: Partial<CaseRecord>): CaseRecord => ({
  id: "", orgNumber: "", companyName: null, employees: "1-5",
  canPaySalary: null, salaryAmount: null, salaryDay: 25,
  canPayTax: null, taxAmount: null, taxDay: 12,
  canPayRent: null, rentAmount: null, rentDay: 1,
  canPaySuppliers: null, totalDebt: null, quickLiquidationValue: null,
  recommendationType: null, recommendationTitle: null, recommendationDescription: null,
  recommendationReasons: [], recommendationNextSteps: [],
  createdAt: iso(-14), updatedAt: iso(0), closedAt: null, exitReason: null,
  healthMode: false, planApprovedAt: null, planApprovedBy: null,
  ...over,
});

/** Det akuta ärendet: obetald skatt, leverantörer väntar, KBR krävs. */
const aktSundin: ArendeAkt = {
  arende: stomme({
    id: "byra-2026-114", orgNumber: "556677-8899", companyName: "Sundins Måleri AB",
    employees: "6-10", canPaySalary: true, salaryAmount: "310000",
    canPayTax: false, taxAmount: "285000", canPayRent: true, rentAmount: "62000",
    canPaySuppliers: false, totalDebt: "1900000", quickLiquidationValue: "700000",
  }),
  medlemmar: [
    { id: "m1", caseId: "byra-2026-114", userId: "u1", role: "owner", displayName: "Eva Sundin", email: "eva@sundinsmaleri.se", createdAt: iso(-14), revokedAt: null },
    { id: "m2", caseId: "byra-2026-114", userId: "u2", role: "legal_advisor", displayName: "Advokat Berg", email: "berg@byran.se", createdAt: iso(-14), revokedAt: null },
  ],
  betalningar: [
    { id: "p1", caseId: "byra-2026-114", label: "Arbetsgivaravgifter och skatt", amount: 285000, category: "tax", status: "critical", dueDate: iso(-4), recurring: true },
    { id: "p2", caseId: "byra-2026-114", label: "Löner", amount: 310000, category: "salary", status: "pending", dueDate: iso(6), recurring: true },
  ],
  uppgifter: [
    { id: "t1", caseId: "byra-2026-114", label: "Upprätta kontrollbalansräkning", dueDate: iso(7), doneAt: null, doneBy: null, source: "recommendation", createdAt: iso(-14), assignedTo: "u2" },
    { id: "t2", caseId: "byra-2026-114", label: "Ansök om anstånd med skatten", dueDate: iso(2), doneAt: null, doneBy: null, source: "recommendation", createdAt: iso(-14), assignedTo: null },
  ],
  kbr: { status: "required", createdAt: iso(-3) },
};

/** Det lugnare ärendet: allt betalas, bevakning snarare än brandkår. */
const aktHamnen: ArendeAkt = {
  arende: stomme({
    id: "byra-2026-121", orgNumber: "556036-0793", companyName: "Hamnens Rederi AB",
    canPaySalary: true, salaryAmount: "180000", canPayTax: true, taxAmount: "95000",
    canPayRent: true, rentAmount: "40000", canPaySuppliers: true,
    totalDebt: "400000", quickLiquidationValue: "900000",
  }),
  medlemmar: [], betalningar: [], uppgifter: [], kbr: null,
};

/* --- Verktygets egen port: byråns bolagsregister -------------------------- */

const byranBolagsregister: CompanyLookupPort = {
  async lookup(orgNumber: string): Promise<CompanyInfo | null> {
    if (orgNumber.replace(/\D/g, "") !== "5566778899") return null;
    return {
      name: "Sundins Måleri AB", legalForm: "Aktiebolag",
      address: "Verkstadsgatan 4, 135 40 Tyresö",
      sniCode: "43.341", sniDescription: "Måleriarbeten", registrationYear: "2011",
    };
  },
};

/* --- Motorn på en akt ------------------------------------------------------ */

const analysUnderlag = (a: CaseRecord): AnalysisInput => ({
  canPaySalary: a.canPaySalary, canPayTax: a.canPayTax, canPayRent: a.canPayRent,
  canPaySuppliers: a.canPaySuppliers,
  salaryAmount: Number(a.salaryAmount ?? 0), salaryDay: a.salaryDay ?? 25,
  taxAmount: Number(a.taxAmount ?? 0), taxDay: a.taxDay ?? 12,
  rentAmount: Number(a.rentAmount ?? 0), rentDay: a.rentDay ?? 1,
  totalDebt: Number(a.totalDebt ?? 0), quickLiquidationValue: Number(a.quickLiquidationValue ?? 0),
  employees: a.employees ?? "",
});

const rapportFor = (akt: ArendeAkt, publik: "practitioner" | "company"): ExecutiveSummary => {
  const analys = analyseCrisis(analysUnderlag(akt.arende));
  return buildExecutiveSummary({
    caseRecord: akt.arende, timeline: analys.timeline, tasks: akt.uppgifter,
    members: akt.medlemmar, kbr: akt.kbr, documentCount: 0,
    payments: akt.betalningar, now: NU, audience: publik,
  });
};

/** Portföljen: severity per ärende ur SAMMA rapportbygge som ärendevyn. */
const byggPortfolj = async (lager: ArendeLager) => {
  const akter: ArendeAkt[] = [];
  for (const id of await lager.lista()) {
    const akt = await lager.hamta(id);
    if (akt) akter.push(akt);
  }
  const poster = akter.map((akt) => ({
    caseRecord: akt.arende,
    severity: rapportFor(akt, "practitioner").severity,
    timeline: analyseCrisis(analysUnderlag(akt.arende)).timeline,
    openTasks: akt.uppgifter.filter((t) => !t.doneAt).length,
    openMentions: 0,
  }));
  return { akter, portfolj: buildPortfolioSummary(poster, NU) };
};

const skrivPortfolj = async (lager: ArendeLager): Promise<void> => {
  const { akter, portfolj } = await byggPortfolj(lager);
  console.log("=".repeat(72));
  console.log("PORTFÖLJEN - arbetsledarens rader");
  console.log("=".repeat(72));
  for (const rad of portfolj.lines) console.log(`  ${rad}`);
  console.log(`\nRANGORDNING (vem kräver dig först):`);
  for (const r of portfolj.ranked) {
    const akt = akter.find((a) => a.arende.id === r.caseId);
    console.log(`  ${r.caseId}  ${akt?.arende.companyName ?? "?"}  - ${r.reason}`);
  }
  console.log(`\nUppskattad insats i dag: ~${portfolj.estimatedHours} h (uppskattning, inte mätning)`);
};

/* --- Demonstrationen (och kontrollerna) ------------------------------------ */

const demonstration = async (): Promise<void> => {
  // Akterna genom ett RIKTIGT lager på disk: spara, läs tillbaka, jämför.
  // En lagring som bara provats i minnet har aldrig provats.
  const katalog = mkdtempSync(join(tmpdir(), "byra-akter-"));
  const disk = filLager(katalog);
  await disk.spara(aktSundin);
  await disk.spara(aktHamnen);
  const tillbaka = await disk.hamta(aktSundin.arende.id);
  kontroll("akten överlever disk-varvet oförändrad", JSON.stringify(tillbaka) === JSON.stringify(aktSundin));
  kontroll("ärendemappen listar båda akterna", (await disk.lista()).length === 2, await disk.lista());

  kontroll("organisationsnumret klarar Luhn-kontrollen", validateOrgNumber(aktSundin.arende.orgNumber));
  const bolag = await lookupCompany(aktSundin.arende.orgNumber, byranBolagsregister);
  kontroll("porten svarar med byråns registerpost", bolag?.name === "Sundins Måleri AB", bolag);
  kontroll("ett okänt bolag ger null, inte en gissning", (await lookupCompany("556012-3456", byranBolagsregister)) === null);

  const analys = analyseCrisis(analysUnderlag(aktSundin.arende));
  kontroll("bedömningen vilar på fullständigt underlag", analys.basis === "complete", analys.basis);
  kontroll("tidslinjen har händelser att bevaka", analys.timeline.length > 0);

  const praktiker = rapportFor(aktSundin, "practitioner");
  const bolagsvy = rapportFor(aktSundin, "company");
  kontroll("rapporten har avsnitt", praktiker.sections.length > 0);
  kontroll(
    "praktikerns vy skiljer sig från bolagets - rollanpassningen lever",
    JSON.stringify(praktiker.sections) !== JSON.stringify(bolagsvy.sections),
  );

  const sammanhang: TaskContext = {
    caseRecord: aktSundin.arende, members: aktSundin.medlemmar, documents: [],
    payments: aktSundin.betalningar, kbr: aktSundin.kbr,
  };
  const spelbok = playbookForTask("Upprätta kontrollbalansräkning", sammanhang);
  kontroll("spelboken förklarar varför", spelbok.why.trim().length > 20);
  kontroll("spelboken har steg att följa", spelbok.steps.length > 0);

  // Portföljen: det akuta ärendet ska rankas före det stabila. Det är
  // rangordningens hela uppgift, så det är ett krav och inte en utskrift.
  const { portfolj } = await byggPortfolj(disk);
  kontroll("portföljen har en rangordning", portfolj.ranked.length === 2, portfolj.ranked.length);
  kontroll(
    "det akuta ärendet rankas före det stabila",
    portfolj.ranked[0]?.caseId === aktSundin.arende.id,
    portfolj.ranked.map((r) => r.caseId),
  );

  // Adapterekvivalensen: samma akter genom minnet ska ge SAMMA portfölj som
  // genom disken. Det är samma skäl som produkten kör radskyddssviten mot
  // båda databasmiljöerna - en skillnad mellan adaptrarna ska falla här,
  // inte upptäckas av en praktiker vars rangordning beror på lagringsvalet.
  const { portfolj: urMinnet } = await byggPortfolj(minnesLager([aktSundin, aktHamnen]));
  kontroll(
    "minnes- och fillagret ger samma portfölj",
    JSON.stringify(urMinnet) === JSON.stringify(portfolj),
  );

  /* --- Utskriften -------------------------------------------------------- */
  const tidslinje = [...analys.timeline].sort(compareByUrgency);
  const narmast = tidslinje.map((h) => ({ h, n: countdownTo(h.iso, NU) })).find(({ n }) => n.tone !== "passed");

  console.log("=".repeat(72));
  console.log(`ÄRENDE ${aktSundin.arende.id} · ${bolag?.name} · ${aktSundin.arende.orgNumber} · ${bolag?.sniDescription}`);
  console.log("=".repeat(72));
  console.log(`\nBEDÖMNING (underlag: ${analys.basis}): ${analys.title}`);
  console.log(`  ${analys.description}`);
  console.log(`\nSKULD ${kr(Number(aktSundin.arende.totalDebt))} · SNABBVÄRDE ${kr(Number(aktSundin.arende.quickLiquidationValue))}`);
  if (narmast) console.log(`\nNÄRMAST: ${narmast.h.label} - ${narmast.n.label}`);
  console.log(`\nPRAKTIKERRAPPORT: ${praktiker.headline} [${praktiker.severityLabel}]`);
  for (const avsnitt of praktiker.sections.slice(0, 4)) console.log(`  · ${avsnitt.title}`);
  console.log(`\nSPELBOK "Upprätta kontrollbalansräkning": ${spelbok.steps.length} steg`);
  for (const steg of spelbok.steps) console.log(`  ${steg.done ? "[x]" : "[ ]"} ${steg.label}`);
  console.log("");
  await skrivPortfolj(disk);

  rmSync(katalog, { recursive: true, force: true });
  console.log(`\n${roda === 0 ? "EXEMPLET HÅLLER: alla kontroller gröna." : `${roda} kontroller RÖDA.`}`);
  if (roda > 0) process.exit(1);
};

/* --- Byråläget: en riktig ärendemapp --------------------------------------- */

const byralage = async (katalog: string): Promise<void> => {
  const lager = filLager(katalog);
  const idn = await lager.lista();
  if (idn.length === 0) {
    console.log(`Ärendemappen ${katalog} är tom. Lägg en akt som <id>.json - formatet är`);
    console.log(`ArendeAkt i exempel/lager.ts - och kör igen.`);
    return;
  }
  await skrivPortfolj(lager);
  for (const id of idn) {
    const akt = await lager.hamta(id);
    if (!akt) continue;
    const rapport = rapportFor(akt, "practitioner");
    console.log(`\n${"-".repeat(72)}`);
    console.log(`${akt.arende.companyName ?? akt.arende.id} · ${rapport.headline} [${rapport.severityLabel}]`);
    for (const avsnitt of rapport.sections) console.log(`  · ${avsnitt.title}`);
  }
};

const katalog = process.argv[2];
(katalog ? byralage(katalog) : demonstration()).catch((fel) => {
  console.error(fel);
  process.exit(1);
});
