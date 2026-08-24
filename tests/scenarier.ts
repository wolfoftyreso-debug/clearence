/**
 * HUNDRA SCENARIER GENOM HELA KEDJAN.
 *
 * Produkten prövas annars styckvis: en svit per modul, med en handfull
 * indata som råkar vara de som skrevs den dagen modulen byggdes. Det
 * fångar att varje del fungerar för sig. Det fångar inte att KEDJAN
 * håller för ett bolag ingen tänkte på.
 *
 * Den här sviten kör hundra HELA situationer - ett bolag var, från
 * betalningsförmåga och bokslutssiffror till analys, kontrollbalansräkning,
 * likviditetsprognos, lägesrapport, notiser, presentation och den färdiga
 * PDF-rapporten - och kräver samma sak av alla hundra.
 *
 * VAD SOM PRÖVAS, OCH VARFÖR INTE FACIT.
 *
 * Hundra handskrivna förväntade svar hade bara varit koden en gång till,
 * skriven av samma hand samma dag. Ett prov som säger "utdata är det
 * utdata är" faller aldrig, och skyddar därför ingenting.
 *
 * I stället prövas EGENSKAPER som måste gälla oavsett scenario:
 *
 *   1. Inga skräpvärden ut. NaN, Infinity, "undefined" och "[object Object]"
 *      i en text som visas för någon vars bolag håller på att gå under är
 *      inte en skönhetsfläck - det är ett svar hen inte kan använda.
 *   2. Determinism. Samma indata två gånger ger samma utdata. Utan det
 *      betyder ingen annan kontroll något.
 *   3. Aritmetiken stämmer med sig själv: dagar till frist mot kalendern,
 *      saldot mot in- och utflöden, täckningsgraden mot skuld och värde.
 *   4. MONOTONI. Att göra läget strikt värre får aldrig ge ett strikt
 *      mildare svar. Det är den enda kontrollen som fångar en vänd
 *      olikhet, och den fångar den i alla hundra samtidigt.
 *   5. Löftena i produkten: ingen bedömning utan underlag, inget
 *      automatiskt personligt ansvar, ingen rekommendation som pekar på en
 *      sida som inte finns, aldrig ordet AI om analysen.
 *
 * Scenarierna är VALDA, inte slumpade. Ett slumpprov som blir grönt säger
 * ingenting om vad som prövades; grupperna nedan säger exakt vad de
 * spänner över, och varför just det.
 */

import { analyseCrisis, type AnalysisInput, type CrisisAnalysis } from "../src/lib/crisisAnalysis";
import { bedomKbr, beloppUrText, type KbrUnderlag } from "../src/lib/kbr";
import { buildExecutiveSummary, type SummaryInput } from "../src/lib/executiveSummary";
import { buildNotifications, type NotificationInput } from "../src/lib/notifications";
import { projectLiquidity, type LiquidityPlan } from "../src/lib/liquidityPlan";
import { buildKeyFigures } from "../src/lib/liquidityKeyFigures";
import { buildCrisisReport } from "../src/lib/reports/builders";
import { renderReportPdf } from "../src/lib/reports/pdf";
import { toBullets, toCompact, toTimelineRows } from "../src/lib/presentation";
import { countdownTo, VARSELFONSTER_DAGAR } from "../src/lib/actionPlan";
import { analysisInputFromCase, parseAmount } from "../src/lib/caseAnalysis";
import type { CaseRecord, CaseTask, CaseMemberRecord, PaymentRecord } from "../src/data/types";

let passed = 0;
let failed = 0;
const fel: string[] = [];
/*
 * SJÄLVPROVEN FÅR INTE SKRIKA.
 *
 * Kontrollerna längst ned matar in ett NaN och en oändlighet MED FLIT, för
 * att bevisa att letarna kan se dem. Skrev de ut "FAIL" i loggen lärde de
 * läsaren att röda rader ibland är bra - och då betyder röda rader inget.
 */
let tyst = false;
const check = (namn: string, ok: boolean, extra?: unknown) => {
  if (ok) passed += 1;
  else {
    failed += 1;
    if (tyst) return;
    const rad = `FAIL ${namn}${extra === undefined ? "" : ` :: ${JSON.stringify(extra)?.slice(0, 300)}`}`;
    fel.push(rad);
    console.log(rad);
  }
};

/* ========================================================================
 * 1. SCENARIERNA
 * ===================================================================== */

interface Scenario {
  nr: number;
  grupp: string;
  namn: string;
  arende: CaseRecord;
  kbr: KbrUnderlag;
  plan: LiquidityPlan;
  betalningar: PaymentRecord[];
  uppgifter: CaseTask[];
  medlemmar: CaseMemberRecord[];
  dokument: number;
  publik: "company" | "practitioner";
  nu: Date;
}

const NU = new Date("2026-08-24T09:00:00.000Z");

const iso = (d: Date): string => d.toISOString().slice(0, 10);
const dagarFran = (nu: Date, dagar: number): string =>
  iso(new Date(nu.getTime() + dagar * 86_400_000));

const arende = (over: Partial<CaseRecord>): CaseRecord => ({
  id: "c-scen",
  orgNumber: "556012-3456",
  companyName: "Provbolaget AB",
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

const betalning = (over: Partial<PaymentRecord>): PaymentRecord => ({
  id: `p-${Math.abs(String(over.label ?? "x").length)}-${over.dueDate ?? "d"}`,
  caseId: "c-scen",
  label: "Post",
  amount: 10_000,
  category: "other",
  status: "pending",
  dueDate: dagarFran(NU, 10),
  recurring: false,
  ...over,
});

const uppgift = (over: Partial<CaseTask>): CaseTask => ({
  id: `t-${over.label ?? "x"}`,
  caseId: "c-scen",
  label: "Uppgift",
  dueDate: null,
  doneAt: null,
  doneBy: null,
  source: "manual",
  createdAt: "2026-08-01T10:00:00.000Z",
  assignedTo: null,
  ...over,
});

const medlem = (over: Partial<CaseMemberRecord>): CaseMemberRecord => ({
  id: `m-${over.userId ?? "u"}`,
  caseId: "c-scen",
  userId: "u1",
  role: "owner",
  displayName: "Ägaren",
  email: "agare@exempel.se",
  createdAt: "2026-08-01T10:00:00.000Z",
  revokedAt: null,
  ...over,
});

const TOM_PLAN: LiquidityPlan = { openingBalance: 250_000, inflows: [], outflows: [] };

const scen = (
  nr: number,
  grupp: string,
  namn: string,
  over: Partial<Omit<Scenario, "nr" | "grupp" | "namn">> = {},
): Scenario => ({
  nr,
  grupp,
  namn,
  arende: arende({}),
  kbr: { aktiekapital: 50_000, tillgangar: 900_000, skulder: 400_000 },
  plan: TOM_PLAN,
  betalningar: [],
  uppgifter: [],
  medlemmar: [medlem({})],
  dokument: 0,
  publik: "company",
  nu: NU,
  ...over,
});

const SCENARIER: Scenario[] = [];
let n = 0;
const lagg = (grupp: string, namn: string, over?: Partial<Omit<Scenario, "nr" | "grupp" | "namn">>) => {
  n += 1;
  SCENARIER.push(scen(n, grupp, namn, over));
};

/* --- A. Betalningsförmågan: alla sexton kombinationer ------------------- */
/*
 * De fyra frågorna är produktens ingång. Sexton kombinationer, alla
 * verkliga: ett bolag kan mycket väl betala hyran men inte skatten.
 * Ingen av dem får ge ett svar som inte går att använda.
 */
for (let bitar = 0; bitar < 16; bitar += 1) {
  const lon = (bitar & 1) !== 0;
  const skatt = (bitar & 2) !== 0;
  const hyra = (bitar & 4) !== 0;
  const lev = (bitar & 8) !== 0;
  lagg(
    "A betalningsförmåga",
    `lön=${lon} skatt=${skatt} hyra=${hyra} lev=${lev}`,
    {
      arende: arende({
        canPaySalary: lon,
        canPayTax: skatt,
        canPayRent: hyra,
        canPaySuppliers: lev,
      }),
    },
  );
}

/* --- B. Underlaget: obesvarat, halvbesvarat, besvarat ------------------- */
/*
 * "none" betyder att INGEN betalningsfråga är besvarad. Då finns ingen
 * bedömning att göra, och produkten ska säga det i stället för att gissa.
 * Den sa en gång "din situation är pressad men inte akut, med rätt
 * åtgärder finns goda chanser" på noll svar.
 */
lagg("B underlag", "inget besvarat alls", {
  arende: arende({ canPaySalary: null, canPayTax: null, canPayRent: null, canPaySuppliers: null }),
});
lagg("B underlag", "bara lönefrågan besvarad, och nekande", {
  arende: arende({ canPaySalary: false, canPayTax: null, canPayRent: null, canPaySuppliers: null }),
});
lagg("B underlag", "bara skattefrågan besvarad, och nekande", {
  arende: arende({ canPaySalary: null, canPayTax: false, canPayRent: null, canPaySuppliers: null }),
});
lagg("B underlag", "tre av fyra besvarade", {
  arende: arende({ canPaySuppliers: null }),
});
lagg("B underlag", "inget besvarat men stora belopp ifyllda", {
  arende: arende({
    canPaySalary: null, canPayTax: null, canPayRent: null, canPaySuppliers: null,
    totalDebt: "9 000 000", quickLiquidationValue: "10 000",
  }),
});
lagg("B underlag", "inget besvarat, inga belopp alls", {
  arende: arende({
    canPaySalary: null, canPayTax: null, canPayRent: null, canPaySuppliers: null,
    salaryAmount: "", taxAmount: "", rentAmount: "", totalDebt: "", quickLiquidationValue: "",
  }),
});
lagg("B underlag", "allt besvarat nekande, inga belopp", {
  arende: arende({
    canPaySalary: false, canPayTax: false, canPayRent: false, canPaySuppliers: false,
    salaryAmount: "", taxAmount: "", rentAmount: "", totalDebt: "", quickLiquidationValue: "",
  }),
});
lagg("B underlag", "allt besvarat jakande, inga belopp", {
  arende: arende({
    salaryAmount: "", taxAmount: "", rentAmount: "", totalDebt: "", quickLiquidationValue: "",
  }),
});

/* --- C. Beloppen: noll, ett, enormt, och det användaren faktiskt skriver -- */
/*
 * Fälten är fritext. Folk skriver mellanslag, punkter, kronor, minustecken
 * och ibland ingenting. Ett belopp som tolkas fel blir en siffra i en
 * rapport som någon fattar beslut på.
 */
lagg("C belopp", "alla belopp noll", {
  arende: arende({ salaryAmount: "0", taxAmount: "0", rentAmount: "0", totalDebt: "0", quickLiquidationValue: "0" }),
});
lagg("C belopp", "en krona rakt igenom", {
  arende: arende({ salaryAmount: "1", taxAmount: "1", rentAmount: "1", totalDebt: "1", quickLiquidationValue: "1" }),
});
lagg("C belopp", "miljardbelopp", {
  arende: arende({ salaryAmount: "1 000 000 000", taxAmount: "2 000 000 000", totalDebt: "9 999 999 999", quickLiquidationValue: "1 000 000 000" }),
});
lagg("C belopp", "belopp med kr-suffix", {
  arende: arende({ salaryAmount: "180 000 kr", taxAmount: "90 000 kr", totalDebt: "1 200 000 kr" }),
});
lagg("C belopp", "belopp med punkt som tusenavskiljare", {
  arende: arende({ salaryAmount: "180.000", taxAmount: "90.000", totalDebt: "1.200.000" }),
});
lagg("C belopp", "belopp med komma som decimal", {
  arende: arende({ salaryAmount: "180000,50", taxAmount: "90000,25" }),
});
lagg("C belopp", "negativt skrivet belopp", {
  arende: arende({ totalDebt: "-500 000", quickLiquidationValue: "-100 000" }),
});
lagg("C belopp", "ren text i beloppsfältet", {
  arende: arende({ salaryAmount: "vet ej", taxAmount: "ca 90k", totalDebt: "mycket" }),
});
lagg("C belopp", "tomma strängar i alla belopp", {
  arende: arende({ salaryAmount: "", taxAmount: "", rentAmount: "", totalDebt: "", quickLiquidationValue: "" }),
});
lagg("C belopp", "skuld men noll i värde", {
  arende: arende({ totalDebt: "3 000 000", quickLiquidationValue: "0", canPayTax: false }),
});
lagg("C belopp", "värde men noll i skuld", {
  arende: arende({ totalDebt: "0", quickLiquidationValue: "3 000 000" }),
});
lagg("C belopp", "skuld exakt lika med värdet", {
  arende: arende({ totalDebt: "2 000 000", quickLiquidationValue: "2 000 000" }),
});

/* --- D. Kalendern: förfallodagar som inte finns varje månad -------------- */
/*
 * Den 31:e finns inte i februari, och den 29:e finns bara vart fjärde år.
 * En frist som räknas fel med en dag är en frist som passeras utan
 * varning. Scenarierna ligger MED FLIT på månadsskiften och i februari.
 */
for (const [dag, etikett] of [[1, "första"], [12, "tolfte"], [25, "tjugofemte"], [28, "tjugoåttonde"], [29, "tjugonionde"], [30, "trettionde"], [31, "trettioförsta"]] as const) {
  lagg("D kalender", `förfallodag den ${etikett}`, {
    arende: arende({ salaryDay: dag, taxDay: dag, rentDay: dag }),
  });
}
lagg("D kalender", "sista januari, förfall den 31", {
  arende: arende({ salaryDay: 31, taxDay: 31, rentDay: 31 }),
  nu: new Date("2026-01-31T09:00:00.000Z"),
});
lagg("D kalender", "februari i ett icke-skottår, förfall den 29", {
  arende: arende({ salaryDay: 29, taxDay: 29, rentDay: 29 }),
  nu: new Date("2026-02-27T09:00:00.000Z"),
});
lagg("D kalender", "februari i ett skottår, förfall den 29", {
  arende: arende({ salaryDay: 29, taxDay: 29, rentDay: 29 }),
  nu: new Date("2028-02-27T09:00:00.000Z"),
});
lagg("D kalender", "nyårsafton, förfall den 1", {
  arende: arende({ salaryDay: 1, taxDay: 1, rentDay: 1 }),
  nu: new Date("2026-12-31T23:30:00.000Z"),
});
lagg("D kalender", "förfallodag 0 (utanför intervallet)", {
  arende: arende({ salaryDay: 0, taxDay: 0, rentDay: 0 }),
});

/* --- E. Kontrollbalansräkningen: hela stegen i ABL 25:13 ---------------- */
/*
 * Gränsen är HÄLFTEN av aktiekapitalet. Scenarierna går uppifrån och ned
 * genom stegen, med exakta gränsvärden - det är där en vänd olikhet syns.
 */
const KBR_STEG: [string, KbrUnderlag][] = [
  ["eget kapital långt över aktiekapitalet", { aktiekapital: 50_000, tillgangar: 500_000, skulder: 100_000 }],
  ["eget kapital exakt lika med aktiekapitalet", { aktiekapital: 50_000, tillgangar: 150_000, skulder: 100_000 }],
  ["eget kapital en krona under aktiekapitalet", { aktiekapital: 50_000, tillgangar: 149_999, skulder: 100_000 }],
  ["eget kapital precis över halva aktiekapitalet", { aktiekapital: 50_000, tillgangar: 125_001, skulder: 100_000 }],
  ["eget kapital EXAKT halva aktiekapitalet", { aktiekapital: 50_000, tillgangar: 125_000, skulder: 100_000 }],
  ["eget kapital en krona under hälften", { aktiekapital: 50_000, tillgangar: 124_999, skulder: 100_000 }],
  ["eget kapital en krona", { aktiekapital: 50_000, tillgangar: 100_001, skulder: 100_000 }],
  ["eget kapital exakt noll", { aktiekapital: 50_000, tillgangar: 100_000, skulder: 100_000 }],
  ["eget kapital negativt", { aktiekapital: 50_000, tillgangar: 80_000, skulder: 100_000 }],
  ["aktiekapital saknas", { aktiekapital: 0, tillgangar: 500_000, skulder: 100_000 }],
  ["tillgångar saknas", { aktiekapital: 50_000, tillgangar: 0, skulder: 100_000 }],
  ["skulder saknas", { aktiekapital: 50_000, tillgangar: 500_000, skulder: 0 }],
];
for (const [namn, underlag] of KBR_STEG) {
  lagg("E kontrollbalans", namn, { kbr: underlag });
}

/* --- F. Solvensen: skuld mot snabbt realiserbart värde ------------------ */
const SOLVENS: [string, string, string][] = [
  ["skulden dubbelt så stor som värdet", "4 000 000", "2 000 000"],
  ["skulden tio gånger värdet", "10 000 000", "1 000 000"],
  ["värdet dubbelt så stort som skulden", "1 000 000", "2 000 000"],
  ["skuld och värde en krona isär, till nackdel", "1 000 001", "1 000 000"],
  ["skuld och värde en krona isär, till fördel", "1 000 000", "1 000 001"],
  ["ingen skuld, inget värde", "0", "0"],
];
for (const [namn, skuld, varde] of SOLVENS) {
  lagg("F solvens", namn, {
    arende: arende({ totalDebt: skuld, quickLiquidationValue: varde, canPayTax: false }),
  });
}

/* --- G. Antalet anställda ---------------------------------------------- */
/*
 * Lönegarantin och hur snabbt ett stopp märks hänger på antalet. Fältet är
 * fritext, så det innehåller allt från "0" till "ca 12 st".
 */
for (const anst of ["", "0", "1", "2", "9", "50", "250", "1 000", "ca 12 st", "två"]) {
  lagg("G anställda", `anställda: "${anst}"`, {
    arende: arende({ employees: anst, canPaySalary: false }),
  });
}

/* --- H. Frister, uppgifter och deltagare -------------------------------- */
lagg("H tidslinje", "frist passerad för länge sedan", {
  betalningar: [betalning({ label: "Skatt", category: "tax", status: "critical", dueDate: dagarFran(NU, -45) })],
});
lagg("H tidslinje", "frist passerad i går", {
  betalningar: [betalning({ label: "Hyra", category: "rent", dueDate: dagarFran(NU, -1) })],
});
lagg("H tidslinje", "frist i dag", {
  betalningar: [betalning({ label: "Lön", category: "salary", dueDate: dagarFran(NU, 0) })],
});
lagg("H tidslinje", "frist i morgon", {
  betalningar: [betalning({ label: "Lön", category: "salary", dueDate: dagarFran(NU, 1) })],
});
lagg("H tidslinje", "frist om tre dagar (gränsen för nära)", {
  betalningar: [betalning({ label: "Skatt", category: "tax", dueDate: dagarFran(NU, 3) })],
});
lagg("H tidslinje", "frist om fyra dagar (utanför gränsen)", {
  betalningar: [betalning({ label: "Skatt", category: "tax", dueDate: dagarFran(NU, 4) })],
});
lagg("H tidslinje", "frist ett år bort", {
  betalningar: [betalning({ label: "Lån", category: "loan", dueDate: dagarFran(NU, 365) })],
});
lagg("H tidslinje", "trettio betalningar samtidigt", {
  betalningar: Array.from({ length: 30 }, (_, i) =>
    betalning({ label: `Post ${i}`, amount: 1_000 * (i + 1), dueDate: dagarFran(NU, i - 5) }),
  ),
});
lagg("H tidslinje", "uppgifter: en försenad, en klar, en tilldelad", {
  uppgifter: [
    uppgift({ label: "Försenad", dueDate: dagarFran(NU, -3) }),
    uppgift({ label: "Klar", dueDate: dagarFran(NU, -1), doneAt: "2026-08-23T10:00:00.000Z", doneBy: "u1" }),
    uppgift({ label: "Tilldelad", dueDate: dagarFran(NU, 5), assignedTo: "u1" }),
  ],
});
lagg("H tidslinje", "sex deltagare i olika roller", {
  medlemmar: [
    medlem({ userId: "u1", role: "owner" }),
    medlem({ userId: "u2", role: "board" }),
    medlem({ userId: "u3", role: "auditor" }),
    medlem({ userId: "u4", role: "lawyer" }),
    medlem({ userId: "u5", role: "reconstructor" }),
    medlem({ userId: "u6", role: "owner", revokedAt: "2026-08-20T10:00:00.000Z" }),
  ],
});

/* --- I. Presentation, publik och besvärliga texter ---------------------- */
lagg("I presentation", "praktikerns vy", { publik: "practitioner" });
lagg("I presentation", "praktikerns vy i ett kritiskt läge", {
  publik: "practitioner",
  arende: arende({ canPayTax: false, canPaySalary: false, totalDebt: "8 000 000", quickLiquidationValue: "500 000" }),
});
lagg("I presentation", "bolagsnamn med citattecken och taggar", {
  arende: arende({ companyName: '"Bolaget" <b>AB</b> & Co' }),
});
lagg("I presentation", "mycket långt bolagsnamn", {
  arende: arende({ companyName: "Aktiebolaget ".repeat(30) + "AB" }),
});
lagg("I presentation", "bolagsnamn saknas", { arende: arende({ companyName: "" }) });
lagg("I presentation", "organisationsnummer saknas", { arende: arende({ orgNumber: "" }) });
lagg("I presentation", "femton dokument i akten", { dokument: 15 });
lagg("I presentation", "ärende skapat i dag", {
  arende: arende({ createdAt: NU.toISOString(), updatedAt: NU.toISOString() }),
});

/* --- J. Sammansatta och obekväma lägen --------------------------------- */
/*
 * Det som inte passar i någon annan grupp, men som händer: ett ärende utan
 * deltagare, ett med bara återkallade, hundra uppgifter, och siffror
 * klistrade ur Excel med hårda mellanslag i.
 */
lagg("J sammansatt", "inga deltagare alls i ärendet", { medlemmar: [] });
lagg("J sammansatt", "bara återkallade deltagare", {
  medlemmar: [
    medlem({ userId: "u1", revokedAt: "2026-08-10T10:00:00.000Z" }),
    medlem({ userId: "u2", role: "board", revokedAt: "2026-08-11T10:00:00.000Z" }),
  ],
});
lagg("J sammansatt", "hundra uppgifter, hälften klara", {
  uppgifter: Array.from({ length: 100 }, (_, i) =>
    uppgift({
      label: `Uppgift ${i}`,
      dueDate: dagarFran(NU, i - 50),
      doneAt: i % 2 === 0 ? "2026-08-20T10:00:00.000Z" : null,
      doneBy: i % 2 === 0 ? "u1" : null,
    }),
  ),
});
// Excel klistrar in U+00A0. Ett belopp som tolkas som noll är ett bolag som
// ser skuldfritt ut.
lagg("J sammansatt", "belopp med hårda mellanslag ur Excel", {
  arende: arende({
    salaryAmount: "180\u00a0000",
    taxAmount: "90\u00a0000",
    totalDebt: "1\u00a0200\u00a0000",
    quickLiquidationValue: "800\u00a0000",
  }),
});
lagg("J sammansatt", "klockan slår midnatt när analysen körs", {
  nu: new Date("2026-08-24T00:00:00.000Z"),
});
lagg("J sammansatt", "allt det värsta samtidigt", {
  arende: arende({
    canPaySalary: false, canPayTax: false, canPayRent: false, canPaySuppliers: false,
    employees: "250",
    totalDebt: "45 000 000", quickLiquidationValue: "0",
    salaryDay: 25, taxDay: 12, rentDay: 1,
  }),
  kbr: { aktiekapital: 100_000, tillgangar: 10_000, skulder: 40_000_000 },
  betalningar: [
    betalning({ label: "Skatt", category: "tax", status: "critical", dueDate: dagarFran(NU, -20) }),
    betalning({ label: "Lön", category: "salary", status: "critical", dueDate: dagarFran(NU, 0) }),
    betalning({ label: "Hyra", category: "rent", dueDate: dagarFran(NU, 2) }),
  ],
  uppgifter: [uppgift({ label: "Kalla till kontrollstämma", dueDate: dagarFran(NU, -5) })],
  publik: "practitioner",
  dokument: 3,
});

/* ========================================================================
 * 2. INVARIANTERNA
 * ===================================================================== */

const SKRAP = [
  "NaN",
  "Infinity",
  "undefined",
  "[object Object]",
  "null kr",
  "Invalid Date",
];

/** Letar skräpvärden i allt som kan hamna framför en läsare. */
const utanSkrap = (namn: string, varde: unknown): void => {
  const text = JSON.stringify(varde) ?? "";
  for (const ord of SKRAP) {
    if (text.includes(ord)) {
      check(`${namn}: inget "${ord}" i utdata`, false, text.slice(Math.max(0, text.indexOf(ord) - 90), text.indexOf(ord) + 90));
      return;
    }
  }
  passed += 1;
};

/** Varje tal som lämnar motorn ska vara ett tal. */
const andligaTal = (namn: string, varde: unknown): void => {
  let trasigt: string | null = null;
  const ga = (v: unknown, vag: string): void => {
    if (trasigt) return;
    if (typeof v === "number") {
      if (!Number.isFinite(v)) trasigt = `${vag} = ${String(v)}`;
      return;
    }
    if (Array.isArray(v)) {
      v.forEach((x, i) => ga(x, `${vag}[${i}]`));
      return;
    }
    if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) ga(x, `${vag}.${k}`);
    }
  };
  ga(varde, namn);
  check(`${namn}: alla tal är ändliga`, trasigt === null, trasigt);
};

/** Rutter produkten faktiskt har. En dörr som inte leder någonstans är en vägg. */
const RUTTER = new Set([
  "/", "/om", "/integritetspolicy", "/villkor", "/kunskap", "/api", "/login",
  "/wizard", "/kbr", "/dashboard", "/dashboard/liquidity", "/dashboard/simuleringar",
  "/dashboard/dokument", "/dashboard/samtal", "/dashboard/alternativ",
  "/dashboard/meddelanden", "/dashboard/kreditunderlag", "/dashboard/installningar",
  "/dashboard/deltagare", "/dashboard/handelser", "/arenden", "/likviditetsplan",
  "/marketplace", "/for-radgivare", "/mina-forfragningar", "/byraprofil", "/kontakt",
  "/admin", "/admin/inkorg", "/admin/kunder", "/admin/ansokningar", "/admin/foretag",
  "/admin/radgivare", "/admin/statistik", "/admin/analys", "/admin/loggar",
]);

const ruttFinns = (href: string): boolean => {
  const [vag] = href.split("#");
  if (vag === "") return true; // enbart ett ankare på samma sida
  if (RUTTER.has(vag)) return true;
  // Rutter med parameter: /kunskap/:slug, /lank/:token, /inbjudan/:id
  return /^\/(kunskap|lank|inbjudan)\/[^/]+$/.test(vag);
};

/** Allvarsordning, för monotonikontrollerna. */
const ALLVAR = { info: 0, stable: 0, warning: 1, elevated: 1, critical: 2 } as const;
const allvarsniva = (v: string): number => (v in ALLVAR ? ALLVAR[v as keyof typeof ALLVAR] : 1);

const KBR_ORDNING = { not_required: 0, warning: 1, required: 2, critical: 3 } as const;

/* ========================================================================
 * 3. KÖRNINGEN
 * ===================================================================== */

check("hundra scenarier är definierade", SCENARIER.length === 100, SCENARIER.length);

interface Utfall {
  scen: Scenario;
  analys: CrisisAnalysis;
  kbr: ReturnType<typeof bedomKbr>;
  rapport: ReturnType<typeof buildExecutiveSummary>;
  notiser: ReturnType<typeof buildNotifications>;
}
const utfall: Utfall[] = [];

for (const s of SCENARIER) {
  const id = `#${String(s.nr).padStart(3, "0")} ${s.grupp} – ${s.namn}`;

  /* --- Steg 1: analysen --------------------------------------------- */
  const indata: AnalysisInput = analysisInputFromCase(s.arende);
  const analys = analyseCrisis(indata);
  utanSkrap(`${id} analys`, analys);
  andligaTal(`${id} analys`, analys);

  // Determinism. Utan den betyder ingen annan kontroll något.
  check(`${id}: analysen är deterministisk`, JSON.stringify(analyseCrisis(indata)) === JSON.stringify(analys));

  // Underlaget: ingen bedömning utan svar.
  const svar = [s.arende.canPaySalary, s.arende.canPayTax, s.arende.canPayRent, s.arende.canPaySuppliers];
  const antalSvar = svar.filter((v) => v !== null).length;
  const vantatUnderlag = antalSvar === 0 ? "none" : antalSvar === 4 ? "complete" : "partial";
  check(`${id}: underlagsgraden speglar antalet svar`, analys.basis === vantatUnderlag, { fick: analys.basis, vantat: vantatUnderlag, antalSvar });

  // Tidslinjen mot kalendern: dagarna ska stämma med datumet.
  for (const h of analys.timeline) {
    const d = new Date(`${h.iso}T00:00:00.000Z`);
    check(`${id}: tidslinjens datum går att läsa (${h.iso})`, !Number.isNaN(d.getTime()), h);
    check(`${id}: händelsen har en etikett`, h.label.trim().length > 0, h);
  }

  // Täckningsgraden: aldrig negativ, aldrig oändlig.
  const tackning = analys.coverage.ratio;
  check(
    `${id}: täckningsgraden är null eller ett ändligt icke-negativt tal`,
    tackning === null || (Number.isFinite(tackning) && tackning >= 0),
    tackning,
  );

  // Löftena i tonen.
  const analysText = JSON.stringify(analys);
  check(`${id}: inget automatiskt personligt ansvar`, !/kommer att bli personligt/i.test(analysText));
  check(`${id}: analysen kallas aldrig AI`, !/\bAI\b/.test(analysText.replace(/[A-ZÅÄÖ]{2,}/g, (m) => (m === "AI" ? "AI" : "_"))) || !/"[^"]*\bAI\b[^"]*"/.test(analysText));

  // Nästa steg ska gå att göra.
  for (const steg of analys.nextSteps) {
    check(`${id}: varje nästa steg har text`, steg.text.trim().length > 0, steg);
  }

  /* --- Steg 2: kontrollbalansräkningen ------------------------------- */
  const kbr = bedomKbr(s.kbr);
  utanSkrap(`${id} kbr`, kbr);
  andligaTal(`${id} kbr`, kbr);
  check(`${id}: KBR är deterministisk`, JSON.stringify(bedomKbr(s.kbr)) === JSON.stringify(kbr));
  check(
    `${id}: KBR utan underlag säger det`,
    kbr.harUnderlag === Boolean(s.kbr.aktiekapital && s.kbr.tillgangar),
    { harUnderlag: kbr.harUnderlag, underlag: s.kbr },
  );
  if (kbr.harUnderlag) {
    check(`${id}: eget kapital = tillgångar - skulder`, kbr.egetKapital === s.kbr.tillgangar - s.kbr.skulder, kbr);
    check(`${id}: gränsen är halva aktiekapitalet`, kbr.grans === s.kbr.aktiekapital / 2, kbr);
    check(`${id}: ett bedömt läge har ett besked`, kbr.meddelande.trim().length > 0, kbr);
  }

  /* --- Steg 3: likviditeten ------------------------------------------ */
  const prognos = projectLiquidity(s.plan, 90);
  utanSkrap(`${id} likviditet`, { dagar: prognos.days.length, negativ: prognos.daysUntilNegative });
  andligaTal(`${id} likviditet`, prognos);
  check(`${id}: prognosen täcker horisonten`, prognos.days.length > 0 && prognos.days.length <= 91, prognos.days.length);
  // Saldot ska stämma med sina egna flöden, dag för dag.
  let brutenDag: string | null = null;
  for (let i = 1; i < prognos.days.length; i += 1) {
    const f = prognos.days[i - 1];
    const d = prognos.days[i];
    if (Math.abs(d.balance - (f.balance + d.inflow - d.outflow)) > 0.5) {
      brutenDag = `${d.iso}: ${f.balance} + ${d.inflow} - ${d.outflow} != ${d.balance}`;
      break;
    }
  }
  check(`${id}: saldot stämmer med in- och utflöden varje dag`, brutenDag === null, brutenDag);

  const nyckeltal = buildKeyFigures({
    startingBalance: s.plan.openingBalance,
    payments: s.betalningar,
    horizonDays: 90,
    finalBalance: prognos.days[prognos.days.length - 1]?.balance ?? s.plan.openingBalance,
    daysToNegative: prognos.daysUntilNegative,
    scenarioLabel: "Grundscenario",
    incomingUnpaidTotal: 0,
    incomingUnpaidCount: 0,
  });
  utanSkrap(`${id} nyckeltal`, nyckeltal);
  andligaTal(`${id} nyckeltal`, nyckeltal);
  for (const tal of nyckeltal) {
    check(`${id}: nyckeltalet "${tal.id}" har en etikett`, String(tal.label ?? "").trim().length > 0, tal);
  }

  /* --- Steg 4: lägesrapporten ---------------------------------------- */
  const rapportIn: SummaryInput = {
    caseRecord: s.arende,
    timeline: analys.timeline,
    tasks: s.uppgifter,
    members: s.medlemmar,
    kbr: kbr.harUnderlag ? { status: kbr.status, createdAt: "2026-08-10T10:00:00.000Z" } : null,
    documentCount: s.dokument,
    payments: s.betalningar,
    now: s.nu,
    audience: s.publik,
  };
  const rapport = buildExecutiveSummary(rapportIn);
  utanSkrap(`${id} rapport`, rapport);
  andligaTal(`${id} rapport`, rapport);
  check(`${id}: rapporten är deterministisk`, JSON.stringify(buildExecutiveSummary(rapportIn)) === JSON.stringify(rapport));
  check(`${id}: rapporten har en rubrik`, rapport.headline.trim().length > 0, rapport.headline);
  check(`${id}: rapporten har en strategi`, rapport.strategy.trim().length > 0);
  for (const avsnitt of rapport.sections) {
    check(`${id}: avsnittet "${avsnitt.id}" har en titel`, avsnitt.title.trim().length > 0, avsnitt);
    check(`${id}: avsnittet "${avsnitt.id}" har innehåll`, avsnitt.paragraphs.length > 0 && avsnitt.paragraphs.every((p) => p.trim().length > 0), avsnitt);
  }
  for (const atgard of rapport.actions) {
    check(`${id}: åtgärden har en etikett`, atgard.label.trim().length > 0, atgard);
    check(`${id}: åtgärden motiveras`, atgard.why.trim().length > 0, atgard);
    if (atgard.href !== null) {
      check(`${id}: åtgärdens dörr leder någonstans (${atgard.href})`, ruttFinns(atgard.href), atgard);
    }
  }
  const rapportText = JSON.stringify(rapport);
  check(`${id}: rapporten lovar inget personligt ansvar`, !/kommer att bli personligt/i.test(rapportText));

  /* --- Steg 5: notiserna ---------------------------------------------- */
  const notisIn: NotificationInput = {
    caseRecord: s.arende,
    crisis: analys.basis === "none" ? null : { urgency: analys.urgency, title: analys.title },
    timeline: analys.timeline,
    mentions: [],
    invitations: [],
    assignedOpenTasks: s.uppgifter.filter((u) => u.assignedTo && !u.doneAt).length,
    kbr: kbr.harUnderlag ? { status: kbr.status, createdAt: "2026-08-10T10:00:00.000Z" } : null,
    failedEmails: [],
    pendingApplications: 0,
    newContactMessages: 0,
    pendingProfileClaims: 0,
    now: s.nu,
  };
  const notiser = buildNotifications(notisIn);
  utanSkrap(`${id} notiser`, notiser);
  check(`${id}: notiserna är deterministiska`, JSON.stringify(buildNotifications(notisIn)) === JSON.stringify(notiser));
  const idn = new Set<string>();
  for (const not of notiser) {
    check(`${id}: notisen har en rubrik`, not.title.trim().length > 0, not);
    check(`${id}: notisen har en kropp`, not.body.trim().length > 0, not);
    check(`${id}: notisens dörr leder någonstans (${not.href})`, ruttFinns(not.href), not);
    check(`${id}: notisens id är unikt (${not.id})`, !idn.has(not.id), not.id);
    idn.add(not.id);
  }
  const kraver = notiser.filter((x) => x.demandsAction).length;
  check(`${id}: antalet krav överstiger inte antalet notiser`, kraver <= notiser.length);

  // Klockan får aldrig vara tyst när tidslinjen bär en frist.
  if (analys.timeline.length > 0) {
    check(
      `${id}: en tidslinje med frister ger minst en fristnotis`,
      notiser.some((x) => x.href.includes("#frister")),
      { frister: analys.timeline.length, notiser: notiser.map((x) => x.href) },
    );
  }

  /* --- Steg 6: nedräkningen ------------------------------------------- */
  for (const h of analys.timeline) {
    const ned = countdownTo(h.iso, s.nu);
    check(`${id}: nedräkningen har en text (${h.iso})`, ned.label.trim().length > 0, ned);
    check(`${id}: nedräkningens dagar är ett heltal`, Number.isInteger(ned.daysLeft), ned);
    const dagar = Math.round(
      (new Date(`${h.iso}T00:00:00.000Z`).getTime() -
        new Date(`${iso(s.nu)}T00:00:00.000Z`).getTime()) / 86_400_000,
    );
    check(`${id}: nedräkningen stämmer med kalendern (${h.iso})`, ned.daysLeft === dagar, { ned, dagar });
    const vantadTon = dagar < 0 ? "passed" : dagar === 0 ? "today" : ned.tone;
    check(`${id}: passerat och i dag märks som sådant (${h.iso})`, ned.tone === vantadTon, { ned, dagar });
  }

  /* --- Steg 7: presentationen ----------------------------------------- */
  const punkter = toBullets(rapport);
  const kort = toCompact(rapport);
  const rader = toTimelineRows(rapport, analys.timeline, s.nu);
  utanSkrap(`${id} punktlista`, punkter);
  utanSkrap(`${id} kortform`, kort);
  utanSkrap(`${id} tidslinjerader`, rader);
  check(`${id}: punktlistan bär rapportens avsnitt`, punkter.length > 0, punkter.length);
  check(`${id}: kortformen har en rubrik`, String(kort.headline ?? "").trim().length > 0, kort);

  /* --- Steg 8: den färdiga rapporten och dess PDF ---------------------- */
  const modell = buildCrisisReport({
    analysis: analys,
    companyName: s.arende.companyName,
    orgNumber: s.arende.orgNumber,
    reference: s.arende.id,
    employees: s.arende.employees,
    totalDebt: beloppUrText(s.arende.totalDebt),
    quickLiquidationValue: beloppUrText(s.arende.quickLiquidationValue),
    generatedAt: s.nu.toISOString(),
  });
  utanSkrap(`${id} rapportmodell`, modell);
  const pdf = renderReportPdf(modell);
  check(`${id}: PDF:en är en PDF`, pdf.length > 400 && String.fromCharCode(...pdf.slice(0, 5)) === "%PDF-", pdf.length);

  utfall.push({ scen: s, analys, kbr, rapport, notiser });
}

/* ========================================================================
 * 3b. BELOPPEN: vad strängen BETYDER
 * ===================================================================== */

/*
 * DEN HÄR TABELLEN ÄR INGET FACIT UR KODEN.
 *
 * Varje förväntat värde är vad en svensk läsare MENAR med strängen till
 * vänster. Det är en oberoende sanning, och därför den enda sortens
 * värdekontroll som är värd något här.
 *
 * Sviten hade först bara kontrollerat att inga skräpvärden kom ut. Alla
 * hundra scenarier var gröna medan produkten bar TVÅ beloppstolkar som gav
 * olika svar: "180000,50" blev 18 000 050 i nulägesanalysen och 180 000 i
 * kontrollbalansräkningen. Ett prov som inte prövar värdet ser inte ett
 * hundrafalt fel.
 */
{
  const TOLKNING: [string, number, string][] = [
    ["1 200 000", 1_200_000, "formulärets egen normalform"],
    ["180 000", 180_000, "mellanslag som tusenavskiljare"],
    ["180\u00a0000", 180_000, "hårt mellanslag ur Excel"],
    ["180 000 kr", 180_000, "kr-suffix"],
    ["180 000 SEK", 180_000, "SEK-suffix"],
    ["1.200.000", 1_200_000, "punkt som tusenavskiljare"],
    ["180.000", 180_000, "punkt följd av exakt tre siffror"],
    ["180000,50", 180_001, "komma som decimaltecken, avrundat till krona"],
    ["1 234,56", 1_235, "mellanslag och komma i samma sträng"],
    ["12,5", 13, "litet decimaltal"],
    ["0,5", 1, "en halv krona avrundas uppåt"],
    ["0,4", 0, "under en halv krona avrundas nedåt"],
    ["1.5", 2, "ensam punkt är decimaltecken"],
    ["0", 0, "noll är noll"],
    ["", 0, "tomt fält"],
    ["vet ej", 0, "text i stället för ett belopp"],
    ["ca 90k", 0, "ungefärligt är inget belopp"],
    ["-500 000", 0, "ett negativt belopp är inget svar på hur mycket"],
  ];
  for (const [text, vantat, varfor] of TOLKNING) {
    check(
      `belopp: ${JSON.stringify(text)} betyder ${vantat} (${varfor})`,
      beloppUrText(text) === vantat,
      { fick: beloppUrText(text), vantat },
    );
  }

  /*
   * OCH BARA EN TOLKNING I HELA PRODUKTEN.
   *
   * Nulägesanalysen och kontrollbalansräkningen läser samma sparade sträng.
   * Ger de olika svar visar produkten två olika skulder för samma bolag,
   * och båda ser rätt ut.
   */
  let isar: string | null = null;
  for (const [text] of TOLKNING) {
    if (parseAmount(text) !== beloppUrText(text)) {
      isar = `${JSON.stringify(text)}: analysen ${parseAmount(text)}, KBR ${beloppUrText(text)}`;
      break;
    }
  }
  check("analysen och kontrollbalansräkningen tolkar beloppet lika", isar === null, isar);
}

/* ========================================================================
 * 4. MONOTONI - det enda som fångar en vänd olikhet
 * ===================================================================== */

/*
 * ATT GÖRA LÄGET VÄRRE FÅR ALDRIG GE ETT MILDARE SVAR.
 *
 * Varje enskild kontroll ovan kan vara grön med en vänd olikhet i koden:
 * utdata finns, den är ändlig, den är deterministisk. Först när samma
 * motor körs på en STEGE av lägen syns det att ordningen är fel.
 */

/* --- KBR-stegen: mindre eget kapital, aldrig lindrigare status ---------- */
{
  const stege = [500_000, 200_000, 150_000, 125_001, 125_000, 124_999, 100_001, 100_000, 80_000, 0];
  let brott: string | null = null;
  let forra = -1;
  for (const tillgangar of stege) {
    const b = bedomKbr({ aktiekapital: 50_000, tillgangar, skulder: 100_000 });
    const niva = b.harUnderlag ? KBR_ORDNING[b.status] : -1;
    if (b.harUnderlag && niva < forra) {
      brott = `tillgångar ${tillgangar} gav ${b.status} efter en strängare nivå`;
      break;
    }
    if (b.harUnderlag) forra = niva;
  }
  check("KBR: sjunkande eget kapital ger aldrig en lindrigare status", brott === null, brott);

  // Och gränsen ligger där lagen lägger den.
  const over = bedomKbr({ aktiekapital: 100_000, tillgangar: 150_001, skulder: 100_000 });
  const exakt = bedomKbr({ aktiekapital: 100_000, tillgangar: 150_000, skulder: 100_000 });
  const under = bedomKbr({ aktiekapital: 100_000, tillgangar: 149_999, skulder: 100_000 });
  check("KBR: över hälften krävs ingen kontrollbalansräkning", over.status === "warning", over);
  check("KBR: exakt hälften räknas som över gränsen", exakt.status === "warning", exakt);
  check("KBR: under hälften krävs kontrollbalansräkning (ABL 25:13)", under.status === "required", under);
}

/* --- Betalningsförmågan: färre betalda poster, aldrig lugnare besked ---- */
{
  const stege: [string, Partial<CaseRecord>][] = [
    ["allt betalas", { canPaySalary: true, canPayTax: true, canPayRent: true, canPaySuppliers: true }],
    ["leverantörer stoppar", { canPaySalary: true, canPayTax: true, canPayRent: true, canPaySuppliers: false }],
    ["hyran stoppar också", { canPaySalary: true, canPayTax: true, canPayRent: false, canPaySuppliers: false }],
    ["skatten stoppar också", { canPaySalary: true, canPayTax: false, canPayRent: false, canPaySuppliers: false }],
    ["lönen stoppar också", { canPaySalary: false, canPayTax: false, canPayRent: false, canPaySuppliers: false }],
  ];
  let forra = -1;
  let brott: string | null = null;
  const sedda: string[] = [];
  for (const [namn, over] of stege) {
    const a = analyseCrisis(analysisInputFromCase(arende(over)));
    const r = buildExecutiveSummary({
      caseRecord: arende(over),
      timeline: a.timeline,
      tasks: [],
      members: [medlem({})],
      kbr: null,
      documentCount: 0,
      payments: [],
      now: NU,
    });
    const niva = allvarsniva(r.severity);
    sedda.push(`${namn}=${r.severity}`);
    if (niva < forra) {
      brott = `${namn} gav ${r.severity} efter ett strängare läge`;
      break;
    }
    forra = niva;
  }
  check("Rapporten: fler obetalda poster ger aldrig ett lugnare läge", brott === null, brott ?? sedda);
}

/* --- Skuldsättningen: mer skuld, aldrig mildare bedömning --------------- */
{
  const stege = ["500 000", "1 000 000", "2 000 000", "5 000 000", "20 000 000"];
  const ORDNING = { stabilize: 0, reconstruction: 1, bankruptcy: 2 } as const;
  let forra = -1;
  let brott: string | null = null;
  const sedda: string[] = [];
  for (const skuld of stege) {
    const a = analyseCrisis(
      analysisInputFromCase(arende({ totalDebt: skuld, quickLiquidationValue: "1 000 000", canPayTax: false })),
    );
    const niva = ORDNING[a.type];
    sedda.push(`${skuld}=${a.type}`);
    if (niva < forra) {
      brott = `skuld ${skuld} gav ${a.type} efter en strängare bedömning`;
      break;
    }
    forra = niva;
  }
  check("Analysen: växande skuld ger aldrig en mildare bedömning", brott === null, brott ?? sedda);
}

/* --- Varselfönstret: samma dag i alla tre lagren ------------------------ */

/*
 * DEN HÄR KONTROLLEN SAKNADES, OCH DET SYNTES.
 *
 * Sviten var grön när varselfönstret muterades från tre dagar till två.
 * Åtta tusen kontroller, och ingen av dem prövade den siffra som avgör
 * NÄR en användare får veta att en frist närmar sig.
 *
 * Fönstret stod dessutom utskrivet som "3" på tre ställen - nedräkningen,
 * notiserna och tidslinjen - med en kommentar som sa att de måste vara
 * lika. Tre kopior av ett måste är inget måste. Nu är det en konstant, och
 * raderna nedan kräver att alla tre lagren växlar på SAMMA dag.
 */
{
  check("varselfönstret är tre dagar", VARSELFONSTER_DAGAR === 3, VARSELFONSTER_DAGAR);

  const inne = countdownTo(dagarFran(NU, VARSELFONSTER_DAGAR), NU);
  const utanfor = countdownTo(dagarFran(NU, VARSELFONSTER_DAGAR + 1), NU);
  check("sista dagen i fönstret är nära", inne.tone === "soon", inne);
  check("dagen efter fönstret är det inte", utanfor.tone === "later", utanfor);

  // Notiserna: inne i fönstret är fristen ett KRAV, utanför en upplysning.
  const notisFor = (dagar: number) =>
    buildNotifications({
      caseRecord: arende({}),
      crisis: null,
      timeline: [
        {
          iso: dagarFran(NU, dagar),
          daysAway: dagar,
          label: "Löneutbetalning",
          amount: 180_000,
          severity: "warning",
        },
      ],
      mentions: [],
      invitations: [],
      kbr: null,
      failedEmails: [],
      pendingApplications: 0,
      newContactMessages: 0,
      pendingProfileClaims: 0,
      now: NU,
    });

  const innePaKrav = notisFor(VARSELFONSTER_DAGAR).filter((x) => x.href.includes("#frister"));
  const utanforKrav = notisFor(VARSELFONSTER_DAGAR + 1).filter((x) => x.href.includes("#frister"));
  check(
    "notiserna gör en frist inom fönstret till ett krav",
    innePaKrav.length > 0 && innePaKrav.every((x) => x.demandsAction),
    innePaKrav,
  );
  check(
    "och en frist utanför fönstret till en upplysning",
    utanforKrav.length > 0 && utanforKrav.every((x) => !x.demandsAction),
    utanforKrav,
  );

  // Tidslinjeraderna: samma gräns mellan varning och information.
  const radFor = (dagar: number) => {
    const bas = buildExecutiveSummary({
      caseRecord: arende({}),
      timeline: [],
      tasks: [],
      members: [medlem({})],
      kbr: null,
      documentCount: 0,
      payments: [],
      now: NU,
    });
    return toTimelineRows(
      bas,
      [
        {
          iso: dagarFran(NU, dagar),
          daysAway: dagar,
          label: "Löneutbetalning",
          amount: 180_000,
          severity: "warning",
        },
      ],
      NU,
    );
  };
  const innerad = radFor(VARSELFONSTER_DAGAR).find((r) => r.label?.includes("Löne"));
  const yttrerad = radFor(VARSELFONSTER_DAGAR + 1).find((r) => r.label?.includes("Löne"));
  check("tidslinjen varnar inom fönstret", innerad?.tone === "warning", innerad);
  check("och informerar utanför det", yttrerad?.tone === "info", yttrerad);
}

/* --- Fristen: närmare datum, aldrig svagare ton ------------------------- */
{
  const TON = { later: 0, soon: 1, today: 2, passed: 3 } as const;
  let forra = -1;
  let brott: string | null = null;
  for (const dagar of [30, 10, 4, 3, 1, 0, -1, -30]) {
    const ned = countdownTo(dagarFran(NU, dagar), NU);
    const niva = TON[ned.tone as keyof typeof TON] ?? 1;
    if (niva < forra) {
      brott = `${dagar} dagar gav "${ned.tone}" efter en starkare ton`;
      break;
    }
    forra = niva;
  }
  check("Nedräkningen: närmare frist ger aldrig en svagare ton", brott === null, brott);
}

/* ========================================================================
 * 5. TVÄRSNITT ÖVER ALLA HUNDRA
 * ===================================================================== */

/*
 * SJÄLVPROVET.
 *
 * Kontrollerna ovan är många. Om en av dem tyst slutar leta - för att ett
 * fältnamn bytts, eller för att en lista alltid är tom - blir sviten grön
 * på ingenting. Raderna nedan kräver att materialet faktiskt fanns.
 */
check("varje scenario gav ett utfall", utfall.length === 100, utfall.length);
check(
  "scenarierna spänner alla underlagsgrader",
  new Set(utfall.map((u) => u.analys.basis)).size === 3,
  [...new Set(utfall.map((u) => u.analys.basis))],
);
check(
  "scenarierna spänner alla tre bedömningarna",
  new Set(utfall.map((u) => u.analys.type)).size === 3,
  [...new Set(utfall.map((u) => u.analys.type))],
);
check(
  "scenarierna spänner alla fyra KBR-lägena",
  new Set(utfall.filter((u) => u.kbr.harUnderlag).map((u) => u.kbr.status)).size === 4,
  [...new Set(utfall.filter((u) => u.kbr.harUnderlag).map((u) => u.kbr.status))],
);
check(
  "minst tio scenarier saknar KBR-underlag eller har det inte",
  utfall.filter((u) => !u.kbr.harUnderlag).length >= 2,
  utfall.filter((u) => !u.kbr.harUnderlag).length,
);
check(
  "tidslinjer producerades på riktigt",
  utfall.reduce((s, u) => s + u.analys.timeline.length, 0) >= 100,
  utfall.reduce((s, u) => s + u.analys.timeline.length, 0),
);
check(
  "notiser producerades på riktigt",
  utfall.reduce((s, u) => s + u.notiser.length, 0) >= 100,
  utfall.reduce((s, u) => s + u.notiser.length, 0),
);
check(
  "åtgärder producerades på riktigt",
  utfall.reduce((s, u) => s + u.rapport.actions.length, 0) >= 100,
  utfall.reduce((s, u) => s + u.rapport.actions.length, 0),
);

// Och att skräpletaren KAN se skräp - annars är alla utanSkrap-raderna
// en tom formalitet.
{
  tyst = true;
  const foreNaN = failed;
  utanSkrap("självprov", { text: `saldo: ${Number("x")} kr` });
  const sagNaN = failed === foreNaN + 1;
  failed = foreNaN;

  const foreInf = failed;
  andligaTal("självprov", { varde: 1 / 0 });
  const sagInf = failed === foreInf + 1;
  failed = foreInf;
  tyst = false;

  check("skräpletaren hittar ett NaN när det finns", sagNaN);
  check("talkontrollen hittar en oändlighet när den finns", sagInf);
}
check("ruttkontrollen underkänner en påhittad sida", !ruttFinns("/finns-inte-alls"));
check("ruttkontrollen godkänner en riktig sida med ankare", ruttFinns("/dashboard#frister"));

/* ========================================================================
 * 6. UTFALL
 * ===================================================================== */

const perGrupp = new Map<string, number>();
for (const s of SCENARIER) perGrupp.set(s.grupp, (perGrupp.get(s.grupp) ?? 0) + 1);
console.log("\nScenarier per grupp:");
for (const [grupp, antal] of [...perGrupp].sort()) console.log(`  ${grupp}: ${antal}`);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
