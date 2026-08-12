/**
 * DET SOM SER UT ATT GÅ ATT ÖPPNA SKA ÖPPNAS.
 *
 * Två löften prövas här, och de har samma grund: ett påstående som inte
 * går att granska är sämre än inget påstående alls.
 *
 *  1. REKOMMENDATIONEN ÄR EN DÖRR. Varje råd analysen faktiskt skickar ut
 *     ska leda in i verktyget som gör saken - och destinationen ska
 *     finnas. En länk till en sida som inte existerar är värre än text.
 *  2. NYCKELTALET BÄR SITT UNDERLAG. "Runway 8 dagar" ska gå att öppna
 *     och visa posterna, formeln - och framför allt vad talet INTE säger.
 *     Kurvan räknar bara pengar ut; den som inte får veta det läser ett
 *     golv som om det vore en prognos.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { analyseCrisis } from "../src/lib/crisisAnalysis";
import { playbookForTask, type TaskContext } from "../src/lib/taskIntelligence";
import {
  ORIGIN_PARAM,
  buildArrival,
  destinationFor,
  doneMeansFor,
  readOrigin,
  withOrigin,
} from "../src/lib/guidedArrival";
import { buildKeyFigures, figureById, kr } from "../src/lib/liquidityKeyFigures";
import { KNOWLEDGE_ARTICLES } from "../src/lib/knowledge";
import { invoiceFromCustomerRecord } from "../src/lib/reports/invoiceDocuments";
import {
  buildInvoiceSpecification,
  forwardMessage,
  invoiceFileName,
} from "../src/lib/invoiceSpecification";
import type { CaseRecord, PaymentRecord } from "../src/data/types";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (ok) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${name}${extra === undefined ? "" : `\n     ${JSON.stringify(extra)}`}`);
  }
};

/* --- Vilka destinationer som faktiskt finns ------------------------------- */

// Rutterna läses ur App.tsx, inte ur en avskrift: en avskrift blir fel
// den dag någon döper om en sida, och då pekar råden ut i tomma intet.
const appSource = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
const ROUTES = [...appSource.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
check("rutterna hittades i App.tsx", ROUTES.length > 20, ROUTES.length);

const ARTICLE_SLUGS = KNOWLEDGE_ARTICLES.map((a) => a.slug);
check("kunskapsartiklarna hittades", ARTICLE_SLUGS.length >= 5, ARTICLE_SLUGS.length);

/** Finns sidan på riktigt? Fragment och frågedel hör inte till rutten. */
const routeExists = (href: string): boolean => {
  const path = href.split("#")[0].split("?")[0];
  if (path.startsWith("/kunskap/")) return ARTICLE_SLUGS.includes(path.slice("/kunskap/".length));
  return ROUTES.includes(path);
};

/* --- Underlag för spelböckerna --------------------------------------------- */

const caseRecord = {
  id: "c1",
  userId: "u1",
  orgNumber: "556012-3456",
  companyName: "Exempel AB",
  canPaySalary: false,
  canPayTax: false,
  canPayRent: true,
  canPaySuppliers: false,
  totalDebt: 3_200_000,
  assetValue: 950_000,
  employeeCount: 4,
  recommendationType: "reconstruction",
  recommendationTitle: "Ansök om företagsrekonstruktion",
  createdAt: "2026-08-01T09:00:00Z",
} as unknown as CaseRecord;

const ctx: TaskContext = {
  caseRecord,
  members: [],
  documents: [],
  payments: [],
  kbr: null,
};

/* --- 1. Varje rekommendation har en dörr, och dörren finns ---------------- */

// Alla råd analysen kan skicka ut, för varje utfall den kan komma fram
// till. Det är den listan som räknas - inte den delmängd som råkar synas
// i demon.
const recommendations = new Set<string>();
for (const type of ["bankruptcy", "reconstruction", "stabilize"] as const) {
  for (const employees of [0, 4]) {
    const analysis = analyseCrisis({
      canPaySalary: type !== "stabilize" ? false : true,
      canPayTax: false,
      canPayRent: type === "bankruptcy" ? false : true,
      canPaySuppliers: false,
      totalDebt: type === "bankruptcy" ? 9_000_000 : 3_200_000,
      assetValue: type === "bankruptcy" ? 200_000 : 950_000,
      employeeCount: employees,
      salaryDay: 25,
      taxDay: 12,
      rentDay: 1,
    } as Parameters<typeof analyseCrisis>[0]);
    for (const step of analysis.nextSteps) recommendations.add(step.text);
  }
}
check("analysen gav rekommendationer att pröva", recommendations.size >= 8, recommendations.size);

const doorless: string[] = [];
const brokenDoors: string[] = [];
for (const text of recommendations) {
  const destination = destinationFor(text, ctx);
  if (!destination) {
    doorless.push(text.slice(0, 60));
    continue;
  }
  if (!routeExists(destination.href)) brokenDoors.push(`${text.slice(0, 40)} -> ${destination.href}`);
}
check("varje rekommendation leder någonstans", doorless.length === 0, doorless);
check("och destinationen finns på riktigt", brokenDoors.length === 0, brokenDoors);

// Varje steg i varje spelbok, inte bara det första: ett trasigt steg tre
// är lika mycket en återvändsgränd som ett trasigt steg ett.
const brokenSteps: string[] = [];
for (const text of recommendations) {
  for (const step of playbookForTask(text, ctx).steps) {
    if (!routeExists(step.href)) brokenSteps.push(`${step.label} -> ${step.href}`);
  }
}
check("inget steg i någon spelbok pekar fel", brokenSteps.length === 0, brokenSteps);

// Den kända destinationen, uttryckligen: rådet om likviditetsprognos ska
// leda in i planeraren och ingen annanstans.
const liquidity = destinationFor(
  "Gör en likviditetsprognos för de kommande 90 dagarna så du ser exakt när det blir tight.",
  ctx,
);
check("likviditetsrådet leder till planeraren", liquidity?.href === "/likviditetsplan", liquidity?.href);

// En text produkten inte känner igen ska INTE få en påhittad dörr.
check("okänt råd får ingen dörr", destinationFor("Ring farbror Nils om saken", ctx) === null);

/* --- 2. Ursprunget följer med, och går att läsa tillbaka ------------------ */

check("ursprunget läggs till", withOrigin("/likviditetsplan", "t1") === `/likviditetsplan?${ORIGIN_PARAM}=t1`);
check(
  "ett fragment överlever",
  withOrigin("/dashboard#frister", "t1") === `/dashboard?${ORIGIN_PARAM}=t1#frister`,
);
check(
  "en befintlig frågedel behålls",
  withOrigin("/x?a=1", "t1") === `/x?a=1&${ORIGIN_PARAM}=t1`,
);
check("ursprunget läses tillbaka", readOrigin(`?${ORIGIN_PARAM}=t1`) === "t1");
check("utan ursprung: null", readOrigin("?annat=1") === null);
check("tomt ursprung räknas inte", readOrigin(`?${ORIGIN_PARAM}=`) === null);

const withId = destinationFor("Gör en likviditetsprognos för 90 dagar", ctx, "task-9");
check("destinationen bär ursprunget", withId?.href.includes("task-9") === true, withId?.href);

/* --- 3. Ankomsten säger varför, och vad klart betyder --------------------- */

const playbook = playbookForTask("Gör en likviditetsprognos för 90 dagar", ctx);
const arrival = buildArrival("Gör en likviditetsprognos för 90 dagar", playbook, "/likviditetsplan");
check("ankomsten säger vad man kom för", arrival.task.length > 5);
check("ankomsten säger varför", arrival.why === playbook.why);
check("ankomsten säger vad klart betyder", /Planen är klar när/.test(arrival.doneMeans), arrival.doneMeans);
check("ankomsten säger vad som händer sedan", /bockar/.test(arrival.afterwards), arrival.afterwards);

check("varje destination har en klart-text", ["/likviditetsplan", "/kbr", "/marketplace", "/dashboard/dokument", "/kunskap/konkurs"].every((h) => doneMeansFor(h).length > 20));
check("okänd sida får ett ärligt allmänt svar", doneMeansFor("/nagot-annat").length > 10);
check(
  "klart-texten är olika för olika sidor",
  new Set(["/likviditetsplan", "/kbr", "/marketplace"].map(doneMeansFor)).size === 3,
);

/* --- 4. Nyckeltalen bär sitt underlag ------------------------------------- */

const payment = (amount: number, status: PaymentRecord["status"], category: string): PaymentRecord =>
  ({ id: `p${amount}${status}`, caseId: "c1", label: category, amount, dueDate: "2026-08-20", status, category } as unknown as PaymentRecord);

const figures = buildKeyFigures({
  startingBalance: 0,
  payments: [
    payment(800_000, "pending", "salary"),
    payment(300_000, "critical", "tax"),
    payment(180_000, "pending", "rent"),
    payment(90_000, "postponed", "supplier"),
    payment(50_000, "paid", "supplier"),
  ],
  horizonDays: 45,
  finalBalance: -1_080_000,
  daysToNegative: 8,
  scenarioLabel: "Fortsatt drift",
  incomingUnpaidTotal: 420_000,
  incomingUnpaidCount: 3,
});

check("fyra nyckeltal", figures.length === 4, figures.length);
for (const figure of figures) {
  check(`${figure.id}: har ett värde`, figure.value.trim().length > 0);
  check(`${figure.id}: säger hur det räknas`, figure.formula.length > 25, figure.formula);
  check(`${figure.id}: säger vad det betyder`, figure.meaning.length > 25);
  // Varje siffra har en gräns. En ruta utan förbehåll är en ruta som
  // påstår mer än den vet.
  check(`${figure.id}: har minst ett förbehåll`, figure.limits.length >= 1, figure.limits);
  check(`${figure.id}: inget kallas AI`, !/\bAI\b/i.test(`${figure.formula} ${figure.meaning} ${figure.limits.join(" ")}`));
}

const pending = figureById(figures, "vantande")!;
check("väntande räknar bara pending och kritisk", pending.value === kr(1_280_000), pending.value);
check(
  "uppskjutna redovisas som utanför summan",
  pending.rows.some((r) => /Uppskjutna/.test(r.label) && /INTE/.test(r.note ?? "")),
  pending.rows,
);
check(
  "betalda redovisas som utanför summan",
  pending.rows.some((r) => /betalda/i.test(r.label) && /INTE/.test(r.note ?? "")),
);
check(
  "kategorierna kommer störst först",
  pending.rows[0].label === "Löner",
  pending.rows.map((r) => r.label),
);

const runway = figureById(figures, "runway")!;
check("runway visar dagarna", runway.value === "8 dagar", runway.value);
// Det viktigaste förbehållet i hela produkten: kurvan har inga intäkter.
check(
  "runway säger att inga inbetalningar räknas",
  runway.limits.some((l) => /Inga inbetalningar räknas med/.test(l)),
  runway.limits,
);
check(
  // kr() formaterar med sv-SE, som ger HÅRT blanksteg. Ett vanligt
  // mellanslag i testet matchar inte - samma fälla som fällt tre tester
  // tidigare i produkten. Jämför därför mot samma formaterare.
  "och nämner de obetalda kundfakturorna med belopp",
  runway.limits.some((l) => l.includes(kr(420_000)) && l.includes("3 obetalda")),
  runway.limits,
);
check(
  "runway kallar sig ett golv, inte en prognos",
  runway.limits.some((l) => /GOLV/.test(l)),
);

const forecast = figureById(figures, "prognos")!;
check("prognosen namnger scenariot", forecast.formula.includes("Fortsatt drift"), forecast.formula);
check("prognosen säger var horisonten slutar", forecast.limits.some((l) => /dag 46 syns inte/.test(l)), forecast.limits);
check(
  "ett negativt saldo förklaras som pengabrist, inte som obestånd",
  /inte att bolaget är insolvent/.test(forecast.meaning),
  forecast.meaning,
);

// Utan kundfakturor ska förbehållet fortfarande finnas - bara utan siffra.
const noInvoices = buildKeyFigures({
  startingBalance: 100_000, payments: [], horizonDays: 45, finalBalance: 100_000,
  daysToNegative: null, scenarioLabel: "Fortsatt drift",
  incomingUnpaidTotal: 0, incomingUnpaidCount: 0,
});
check(
  "förbehållet står kvar utan kundfakturor",
  figureById(noInvoices, "runway")!.limits.some((l) => /Inga inbetalningar räknas med/.test(l)),
);
check(
  "utan kundfakturor hittas inget belopp på",
  !figureById(noInvoices, "runway")!.limits.some((l) => /obetalda kundfakturor/.test(l)),
);
check("runway utan brist visar horisonten", figureById(noInvoices, "runway")!.value === "45+ dagar");


/* --- 5. Fakturan går att läsa i sin helhet -------------------------------- */

// En faktura som bara går att ladda ner är inte öppnad - den är flyttad.
// Underlaget byggs ur SAMMA modell som PDF:en, så att skärmen och filen
// inte kan säga olika saker om samma belopp.
const record = {
  id: "inv1",
  userId: "u1",
  invoiceNumber: "CL-2026-0141",
  description: "Clearance Standard - månadsavgift",
  issuedAt: "2026-07-15T09:00:00Z",
  dueAt: "2026-08-14T09:00:00Z",
  netOre: 98_500,
  vatOre: 24_625,
  grossOre: 123_125,
  vatRate: 0.25,
  status: "issued",
  paidAt: null,
  paymentReference: null,
  receiptNumber: null,
} as unknown as import("../src/data/types").CustomerInvoiceRecord;

const invoiceModel = invoiceFromCustomerRecord(record, { name: "Exempel AB", email: "ekonomi@exempel.se" });
const spec = buildInvoiceSpecification(invoiceModel, record.paymentReference);

check("fakturanumret står med", spec.invoiceNumber === "CL-2026-0141");
check("säljaren är namngiven med org.nr", spec.seller.orgNumber === "559141-7042", spec.seller.orgNumber);
check("momsregistreringsnumret står med", /^SE\d{12}$/.test(spec.seller.vatNumber), spec.seller.vatNumber);
check("köparen står med", spec.customer.name === "Exempel AB");
check("villkoren räknas ur datumen", spec.terms === "30 dagar netto", spec.terms);

check("beloppet exklusive moms visas", spec.net.startsWith("985,00"), spec.net);
check("momsen visas som eget belopp", spec.vat.startsWith("246,25"), spec.vat);
check("att betala visas", spec.gross.startsWith("1 231,25") || spec.gross.startsWith("1 231,25"), spec.gross);

// Momsen per SATS, inte som klumpsumma: en faktura som blandar satser
// måste kunna redovisa båda.
check("momsen redovisas per sats", spec.vatBands.length === 1 && spec.vatBands[0].rate === "25 %", spec.vatBands);
check("satsen har ett underlag", spec.vatBands[0].base === spec.net);
check("satsens belopp stämmer med totalen", spec.vatBands[0].amount === spec.vat);

// Summorna ska hänga ihop. Ett öre fel gör fakturan obokförbar.
const parse = (s: string): number => Number(s.replace(/[^\d,]/g, "").replace(",", "."));
check(
  "netto plus moms blir brutto",
  Math.abs(parse(spec.net) + parse(spec.vat) - parse(spec.gross)) < 0.005,
  [spec.net, spec.vat, spec.gross],
);

check("det finns ett konto att betala till", spec.paymentAccounts.length >= 1, spec.paymentAccounts);
check(
  "inget tomt konto listas",
  spec.paymentAccounts.every((a) => a.number.trim().length > 0),
  spec.paymentAccounts,
);
check("referens saknas aldrig", spec.reference === "CL-2026-0141", spec.reference);
check("skattskyldigheten står med", /mervärdesskattelag/.test(spec.vatNote));

// Filnamnet ska gå att sortera på och inte innehålla otillåtna tecken.
check("filnamnet bär fakturanumret", invoiceFileName("CL-2026-0141") === "Faktura-CL-2026-0141.pdf");
check("filnamnet tål udda tecken", !/[/\\:*?"<>|]/.test(invoiceFileName("CL/2026:0141")));

// Vidarebefordran: mottagaren är oftast en bokförare som inte vet vad
// CLEARANCE är. Allt de behöver ska stå i mejlet.
const forward = forwardMessage(spec);
check("ämnesraden bär nummer och belopp", forward.subject.includes("CL-2026-0141") && forward.subject.includes(spec.gross));
check("brödtexten säger vad som ska betalas", forward.body.includes(spec.gross));
check("brödtexten säger när", forward.body.includes(spec.due));
check("brödtexten säger till vilket konto", spec.paymentAccounts.every((a) => forward.body.includes(a.number)));
check("brödtexten ger referensen", forward.body.includes(spec.reference));
check("brödtexten nämner bilagan", /bifogad som PDF/.test(forward.body));
check("brödtexten namnger säljaren med org.nr", forward.body.includes(spec.seller.orgNumber));

/* --- 6. Det som är byggt ska gå att nå ------------------------------------ */

/*
 * VARFÖR DEN HÄR VAKTEN FINNS.
 *
 * En komponent kan vara färdig, testad och korrekt - och ändå värdelös,
 * för att ingen sida importerar den. Det hände: hela simuleringspanelen
 * fanns, med motor, databas och 289 gröna kontroller bakom sig, men var
 * inte nåbar från något håll i appen. Typkontrollen var nöjd, bygget var
 * nöjt, testerna var nöjda. Bara användaren hade märkt det.
 *
 * Vakten läser importgrafen från src/main.tsx och kräver att varje
 * komponent går att komma fram till. Undantagen står i UNDANTAG nedan och
 * ska motiveras där - inte tyst utökas.
 */

const SRC = join(process.cwd(), "src");

/** Läser ut varje modul en fil importerar - statiskt, lazy eller re-export. */
const importsIn = (source: string): string[] => [
  ...[...source.matchAll(/(?:^|[\s;{(=])(?:import|export)\s[^;]*?from\s*["']([^"']+)["']/g)].map((m) => m[1]),
  ...[...source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]),
  ...[...source.matchAll(/(?:^|[\s;])import\s*["']([^"']+)["']/g)].map((m) => m[1]),
];

/** Löser ett modulnamn till en fil i src/, eller null för paket. */
const resolveModule = (spec: string, fromFile: string): string | null => {
  let base: string;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith("./") || spec.startsWith("../")) base = join(fromFile, "..", spec);
  else return null; // ett paket i node_modules
  for (const candidate of [base, `${base}.tsx`, `${base}.ts`, join(base, "index.tsx"), join(base, "index.ts")]) {
    try {
      if (readFileSync(candidate, "utf8")) return candidate;
    } catch {
      /* nästa kandidat */
    }
  }
  return null;
};

const reachable = new Set<string>();
const queue = [join(SRC, "main.tsx")];
while (queue.length > 0) {
  const file = queue.pop()!;
  if (reachable.has(file)) continue;
  reachable.add(file);
  let source: string;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const spec of importsIn(source)) {
    const resolved = resolveModule(spec, file);
    if (resolved && !reachable.has(resolved)) queue.push(resolved);
  }
}
check("importgrafen gick att gå igenom", reachable.size > 100, reachable.size);

/**
 * Komponenter som med avsikt inte nås från main.tsx.
 *
 * Tom lista är det normala. Varje post ska bära ett skäl - och skälet
 * "vi hann inte koppla in den" är inte ett skäl, det är just det den här
 * vakten finns för att hitta.
 */
const UNDANTAG: Record<string, string> = {};

const readDir = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...readDir(full));
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
};

// src/components/ui/ är shadcn-primitiv: de levereras som ett komplett
// bibliotek och alla används inte samtidigt. Resten är vår egen kod, och
// vår egen kod ska ha en användare.
const ownComponents = readDir(join(SRC, "components")).filter((f) => !f.includes(`${sep}ui${sep}`));
check("komponenterna hittades", ownComponents.length > 30, ownComponents.length);

const unreachable = ownComponents
  .filter((f) => !reachable.has(f))
  .map((f) => f.slice(SRC.length + 1))
  .filter((rel) => !(rel in UNDANTAG));
check("varje komponent går att nå från appen", unreachable.length === 0, unreachable);

// Samma sak för sidorna, men strängare: en sida som App.tsx importerar
// utan att ge en rutt är en sida ingen kan öppna.
const pageSource = readFileSync(join(SRC, "App.tsx"), "utf8");
const pageNames = [...pageSource.matchAll(/const\s+(\w+)\s*=\s*lazy\(\s*\(\)\s*=>\s*import\(/g)].map((m) => m[1]);
check("de lata sidorna hittades", pageNames.length > 20, pageNames.length);

// Sidan kan sitta djupt: element={<ProtectedRoute><Dashboard /></ProtectedRoute>}.
// Klammerräkning i stället för ett mönster som bara tål det enkla fallet -
// annars hade vakten missat varenda skyddad sida i produkten.
const renderedInRoutes = new Set<string>();
for (const match of pageSource.matchAll(/element=\{/g)) {
  let djup = 1;
  let i = match.index! + match[0].length;
  for (; i < pageSource.length && djup > 0; i += 1) {
    if (pageSource[i] === "{") djup += 1;
    else if (pageSource[i] === "}") djup -= 1;
  }
  for (const tag of pageSource.slice(match.index!, i).matchAll(/<([A-Z]\w*)[\s/>]/g)) {
    renderedInRoutes.add(tag[1]);
  }
}
check("rutternas element gick att läsa", renderedInRoutes.size > 20, renderedInRoutes.size);
const routeless = pageNames.filter((name) => !renderedInRoutes.has(name));
check("varje inläst sida har en rutt", routeless.length === 0, routeless);

// Och den lucka som gav upphov till vakten, uttryckligen namngiven: om
// någon tar bort sidan eller rutten ska det synas här och inte först hos
// en användare som letar efter simuleringarna.
check(
  "simuleringspanelen nås från appen",
  reachable.has(join(SRC, "components/simulation/SimulationPanel.tsx")),
);
check("och sidan har en rutt", ROUTES.includes("/dashboard/simuleringar"), ROUTES.length);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
