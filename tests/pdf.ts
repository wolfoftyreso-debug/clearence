/**
 * Tester för PDF-skrivaren.
 *
 * Strukturen testas hårt: en fil som lämnar huset måste vara en giltig
 * PDF som en läsare öppnar. Header, xref-offsetar, objekträkning,
 * WinAnsi-kodning av svenska tecken, escapening av parenteser,
 * sidbrytning och determinism.
 */

import { PdfWriter, measure, wrapText } from "../src/lib/pdf";
import { renderReportPdf } from "../src/lib/reports/pdf";
import { boardMinutesKbr, TEMPLATES, templateToPdf } from "../src/lib/documentTemplates";
import { buildCrisisReport, buildKbrReport, buildLiquidityReport } from "../src/lib/reports/builders";
import { buildInvoiceDocument, buildReceiptDocument } from "../src/lib/reports/invoiceDocuments";
import { buildInvoice, missingBuyerFields } from "../src/lib/invoice";
import { COMPANY } from "../src/lib/company";
import { buildTimeBasisReport } from "../src/lib/reports/timeBasis";
import { analyseCrisis } from "../src/lib/crisisAnalysis";
import { projectLiquidity } from "../src/lib/liquidityPlan";
import type { ReportModel } from "../src/lib/reports/types";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra = "") => {
  if (ok) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${name} ${extra}`);
  }
};

const latin = (bytes: Uint8Array): string => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return s;
};

/* --- radbrytningen -------------------------------------------------------- */
check("wrap: kort text bryts inte", wrapText("Hej världen", 10, "regular", 500).length === 1);
const wrapped = wrapText(
  "Styrelsen beslutade att genast upprätta en kontrollbalansräkning i enlighet med aktiebolagslagen",
  10.5,
  "regular",
  200,
);
check("wrap: lång text bryts", wrapped.length > 1);
check("wrap: inga ord tappas", wrapped.join(" ").split(" ").length === 11, wrapped.join("|"));
check("wrap: varje rad ryms", wrapped.every((l) => measure(l, 10.5, "regular") <= 200));

/* --- filstrukturen -------------------------------------------------------- */
const pdf = new PdfWriter("Clearance · Test");
pdf.text("Rubrik med åäö", { font: "bold", size: 16 });
pdf.text("Ett stycke med (parenteser) och \\ bakstreck – och tankstreck.");
pdf.row("Att betala", "12 500 kr", { font: "bold" });
const bytes = pdf.toBytes();
const raw = latin(bytes);

check("header: %PDF-1.4", raw.startsWith("%PDF-1.4"));
check("avslut: %%EOF", raw.trimEnd().endsWith("%%EOF"));
check("xref finns", raw.includes("xref\n"));
check("katalog och sidträd", raw.includes("/Type /Catalog") && raw.includes("/Type /Pages"));
check("Helvetica med WinAnsi", raw.includes("/BaseFont /Helvetica") && raw.includes("/WinAnsiEncoding"));
check("åäö kodas som CP1252-byte", raw.includes("\xe5\xe4\xf6"));
check("parenteser escapas", raw.includes("\\(parenteser\\)"));
check("tankstrecket mappas", raw.includes("\x96"));

// xref-offsetarna ska peka på rätt objekt.
const xrefAt = raw.indexOf("xref\n");
const entries = raw.slice(xrefAt).split("\n").filter((l) => /^\d{10} \d{5} n/.test(l));
check(
  "xref-offsetar pekar på objekten",
  entries.every((entry, i) => raw.slice(Number(entry.slice(0, 10))).startsWith(`${i + 1} 0 obj`)),
);

/* --- sidbrytningen -------------------------------------------------------- */
const long = new PdfWriter("Clearance · Långt");
for (let i = 0; i < 120; i += 1) long.text(`Stycke ${i + 1}: en rad text som fyller dokumentet nedåt.`);
const longRaw = latin(long.toBytes());
const pageCount = (longRaw.match(/\/Type \/Page /g) ?? []).length;
check("långt innehåll bryter till flera sidor", pageCount >= 3, String(pageCount));
check("sidfoten räknar sidor", longRaw.includes(`sida 1 \\(${pageCount}\\)`) || longRaw.includes(`sida 1 (${pageCount})`));

/* --- rapport- och mallrendering ------------------------------------------- */
const model: ReportModel = {
  meta: { documentTitle: "Krisanalys", companyName: "Demobolaget AB", orgNumber: "556012-3456", reference: "A-1", generatedAt: "2026-08-02T10:00:00.000Z" },
  lead: [{ kind: "paragraph", text: "Läget kräver beslut." }],
  sections: [
    {
      title: "Belopp",
      blocks: [
        { kind: "table", columns: [{ label: "Post" }, { label: "Belopp", align: "right" }], rows: [{ cells: ["Skatt", "90 000 kr"] }], totals: ["Summa", "90 000 kr"] },
        { kind: "list", items: [{ text: "Gör detta först" }] },
      ],
    },
  ],
  disclaimer: "Underlag, inte rådgivning.",
};
const reportRaw = latin(renderReportPdf(model));
check("rapport: giltig PDF", reportRaw.startsWith("%PDF-1.4") && reportRaw.includes("%%EOF"));
check("rapport: innehållet med", reportRaw.includes("Krisanalys") && reportRaw.includes("90 000 kr"));
check("rapport: disclaimern med", reportRaw.includes("Underlag, inte r\xe5dgivning."));

const mall = templateToPdf(boardMinutesKbr({ companyName: "Demobolaget AB", orgNumber: "556012-3456", place: "Tyresö", date: "2026-08-02", attendees: [{ name: "Anna", role: "Företrädare" }] }));
const mallRaw = latin(mall);
check("mall: giltig PDF", mallRaw.startsWith("%PDF-1.4") && mallRaw.includes("%%EOF"));
check("mall: lagrummet med", mallRaw.includes("25 kap. 13 \xa7"));
check("mall: utkastmarkeringen med", mallRaw.includes("UTKAST"));

check("determinism", latin(renderReportPdf(model)) === reportRaw);

/* --- ALLA produktionsdokument genom motorn --------------------------------- */
// Varje dokumenttyp produkten kan producera ska ge en strukturellt giltig
// PDF: rätt huvud och avslut, xref-offsetar som pekar på sina objekt,
// minst en sida och det egna innehållet i filen. Ingen dokumenttyp får
// kunna gå sönder utan att det syns här.

const validatePdf = (name: string, bytes: Uint8Array, mustContain: string[]) => {
  const s = latin(bytes);
  check(`${name}: PDF-huvud`, s.startsWith("%PDF-1.4"));
  check(`${name}: EOF`, s.trimEnd().endsWith("%%EOF"));
  const pages = (s.match(/\/Type \/Page /g) ?? []).length;
  check(`${name}: minst en sida`, pages >= 1, String(pages));
  const at = s.indexOf("xref\n");
  const offsets = s.slice(at).split("\n").filter((l) => /^\d{10} \d{5} n/.test(l));
  check(
    `${name}: xref-offsetar giltiga`,
    at > 0 && offsets.length > 0 && offsets.every((entry, i) => s.slice(Number(entry.slice(0, 10))).startsWith(`${i + 1} 0 obj`)),
  );
  // Tusentalsavgränsaren kan vara vanligt mellanslag eller U+00A0
  // (CP1252-byte \xa0) beroende på vilken formatterare som byggde talet -
  // ibland blandat i samma tal. Normalisera före jämförelsen i stället
  // för att gissa kombinationen.
  const sNorm = s.replace(/\xa0/g, " ");
  for (const needle of mustContain) {
    check(`${name}: innehåller "${needle}"`, sNorm.includes(needle));
  }
};

// Krisanalysen - samma fixtur som rapporttesterna.
const fullAnalysis = analyseCrisis({
  canPaySalary: false, canPayTax: false, canPayRent: true, canPaySuppliers: false,
  salaryAmount: 420000, salaryDay: 25, taxAmount: 165000, taxDay: 12,
  rentAmount: 58000, rentDay: 1, totalDebt: 3200000, quickLiquidationValue: 950000,
  employees: "6-10",
});
validatePdf(
  "krisanalys",
  renderReportPdf(buildCrisisReport({
    analysis: fullAnalysis, companyName: "Demobolaget AB", orgNumber: "556000-0000",
    reference: "abc-123", employees: "6-10",
    totalDebt: 3200000, quickLiquidationValue: 950000,
    generatedAt: "2026-07-31T10:00:00.000Z",
  })),
  ["Krisanalys", "Demobolaget AB"],
);

// Kontrollbalansbedömningen.
validatePdf(
  "kbr-rapport",
  renderReportPdf(buildKbrReport({
    status: "required", message: "Eget kapital understiger hälften.",
    shareCapital: 100000, totalAssets: 400000, totalLiabilities: 370000,
    equity: 30000, threshold: 50000,
    companyName: null, orgNumber: "556000-0000", reference: null,
    actions: ["Upprätta KBR", "Kalla till kontrollstämma"],
    generatedAt: "2026-07-31T10:00:00.000Z",
  })),
  ["30 000 kr", "25 kap. 13 \xa7"],
);

// Likviditetsplanen.
const liqPlan = {
  openingBalance: 238400,
  inflows: [{ id: "i1", label: "Kundfaktura", amount: 181500, counterpart: "", dayOfMonth: 3, date: "2026-08-03", recurring: true }],
  outflows: [{ id: "o1", label: "Hyra", amount: 58000, counterpart: "", dayOfMonth: 1, date: "2026-08-01", recurring: true, category: "rent" as const }],
};
validatePdf(
  "likviditetsplan",
  renderReportPdf(buildLiquidityReport({
    plan: liqPlan, projection: projectLiquidity(liqPlan, 90), horizonDays: 90,
    companyName: "Demobolaget AB", orgNumber: null, reference: null,
    employerFeeApplied: true, generatedAt: "2026-07-31T10:00:00.000Z",
  })),
  ["238 400 kr"],
);

// Fakturan och kvittot - samma sifferunderlag genom hela kedjan.
const invoiceFixture = {
  invoiceNumber: "2026-0042",
  issuedAt: "2026-08-01T10:00:00.000Z",
  dueAt: "2026-08-11T10:00:00.000Z",
  seller: COMPANY,
  customer: { name: "Demobolaget AB", orgNumber: null, email: "vd@demo.se", address: null },
  lines: [{ description: "Ärendeavgift", quantity: 1, unitPriceOre: 99500 }],
  note: null,
  totals: { netOre: 99500, vatOre: 24875, grossOre: 124375, vatRate: 0.25 },
};
validatePdf("faktura", renderReportPdf(buildInvoiceDocument(invoiceFixture)), ["Faktura 2026-0042", "1 243,75 kr"]);
validatePdf(
  "kvitto",
  renderReportPdf(buildReceiptDocument(invoiceFixture, {
    paidAt: "2026-08-05T10:00:00.000Z", reference: "OCR 42", receiptNumber: "K-2026-0042",
  })),
  ["Kvitto K-2026-0042"],
);

// Samtliga dokumentmallar - inte bara styrelseprotokollet.
for (const template of TEMPLATES) {
  validatePdf(
    `mall: ${template.id}`,
    templateToPdf(template.build({
      companyName: "Demobolaget AB", orgNumber: "556012-3456", place: "Tyresö",
      date: "2026-08-02", attendees: [{ name: "Anna", role: "Företrädare" }],
    })),
    ["UTKAST"],
  );
}

/* --- fakturaunderlaget ur tidsposterna ------------------------------------ */
const timeBasis = buildTimeBasisReport({
  companyName: "Demobolaget AB",
  orgNumber: "556012-3456",
  caseId: "demo-case-1",
  firmName: "Demo Juristbyrå",
  entries: [
    { id: "t1", caseId: "demo-case-1", minutes: 90, note: "Genomgång av rekonstruktionsplanen", occurredOn: "2026-08-01", createdAt: "2026-08-01T10:00:00.000Z" },
    { id: "t2", caseId: "demo-case-1", minutes: 30, note: null, occurredOn: "2026-08-02", createdAt: "2026-08-02T10:00:00.000Z" },
  ],
  hourlyRateSek: 1800,
  vatRatePercent: 25,
  generatedAt: "2026-08-02T12:00:00.000Z",
});
// 120 min à 1800 kr/h = 3600 kr netto; moms 25 % = 900 kr; brutto 4500 kr.
const tbText = JSON.stringify(timeBasis).replace(/\u00A0/g, " ")  // NBSP explicit: osynliga tecken i en regex är en bugg som väntar;
check("tidsunderlag: nettot beräknas ur minuter och timpris", tbText.includes("3 600 kr"));
check("tidsunderlag: moms och brutto stämmer", tbText.includes("4 500 kr"));
check("tidsunderlag: timpriset skrivs ut som byråns egen uppgift",
  tbText.includes("byråns egen uppgift"));
check("tidsunderlag: underlaget kallar sig inte faktura",
  timeBasis.disclaimer.includes("inte en faktura"));
check("tidsunderlag: post utan beskrivning får standardtext",
  tbText.includes("Arbete i ärendet"));
validatePdf("tidsunderlag", renderReportPdf(timeBasis), ["Fakturaunderlag"]);

/* -------------------------------------------------------------------------- */
/* Fakturans formkrav                                                         */
/* -------------------------------------------------------------------------- */

/*
 * 17 kap. 24 § mervärdesskattelagen (2023:200) räknar upp vad en faktura
 * MÅSTE innehålla. Två av punkterna saknades helt: köparens adress
 * (punkt 5, som gäller båda parterna) och datum då tillhandahållandet
 * utförts när det skiljer sig från fakturadatumet (punkt 7).
 *
 * Blockeringen var dessutom ensidig - säljarens brister stoppade fakturan,
 * köparens gjorde det inte.
 */
{
  // Säljaruppgifterna kompletta: testet prövar KÖPARSIDAN. Landvex egna
  // fält är avsiktligt tomma tills de bekräftats, se company.ts.
  const komplettBolag = {
    ...COMPANY,
    email: "faktura@exempel.test",
    bankgiro: "123-4567",
    hasFSkatt: true,
    vatRegistered: true,
  };

  const kund = {
    name: "Demobolaget AB",
    orgNumber: "556012-3456",
    email: "ekonomi@demobolaget.se",
    address: "Verkstadsgatan 12, 118 20 Stockholm",
  };

  check(
    "köparens adress är ett formkrav",
    missingBuyerFields({ ...kund, address: null }).includes("köparens adress"),
  );
  check(
    "köparens namn är ett formkrav",
    missingBuyerFields({ ...kund, name: "  " }).includes("köparens namn"),
  );
  check("en fullständig köpare blockerar inget", missingBuyerFields(kund).length === 0);

  // Perioden: samma dag = leveransdatum, olika dagar = period.
  const doc = buildInvoiceDocument({
    invoiceNumber: "2026-0001",
    issuedAt: "2026-08-01T09:00:00.000Z",
    dueAt: "2026-08-11T09:00:00.000Z",
    seller: komplettBolag,
    customer: kund,
    period: { start: "2026-07-01", end: "2026-07-31" },
    lines: [{ description: "Clearance Standard", quantity: 1, unitPriceOre: 98500 }],
    note: null,
    totals: { netOre: 98500, vatOre: 24625, grossOre: 123125, vatRate: 0.25 },
  });
  const doctext = JSON.stringify(doc);
  check("perioden står på fakturan", /Avser perioden/.test(doctext));
  check("köparens adress står på fakturan", /Verkstadsgatan 12/.test(doctext));
  check("köparens org.nr står på fakturan", /556012-3456/.test(doctext));

  const engang = buildInvoiceDocument({
    invoiceNumber: "2026-0002",
    issuedAt: "2026-08-01T09:00:00.000Z",
    dueAt: "2026-08-11T09:00:00.000Z",
    seller: komplettBolag,
    customer: kund,
    period: { start: "2026-07-15", end: "2026-07-15" },
    lines: [{ description: "Engångsavgift", quantity: 1, unitPriceOre: 50000 }],
    note: null,
    totals: { netOre: 50000, vatOre: 12500, grossOre: 62500, vatRate: 0.25 },
  });
  check(
    "en dag blir leveransdatum, inte period",
    /Leveransdatum/.test(JSON.stringify(engang)) &&
      !/Avser perioden/.test(JSON.stringify(engang)),
  );

  // Och blockeringen: en faktura utan köparadress får inte byggas.
  const utan = buildInvoice(
    {
      invoiceNumber: "2026-0003",
      issuedAt: "2026-08-01T09:00:00.000Z",
      customer: { ...kund, address: null },
      lines: [{ description: "Avgift", quantity: 1, unitPriceOre: 1000 }],
    },
    komplettBolag,
  );
  check("faktura utan köparadress byggs inte", utan.ok === false);
  check(
    "och den säger vad som saknas",
    utan.ok === false && utan.blockedBy.includes("köparens adress"),
  );
}


/* --- Rapportvisaren: EN knapp, ETT budskap ------------------------------- */

/*
 * Felet som togs ner var två stackade "Spara filen": verktygsradens knapp
 * OCH en egen knapp inne i <object>-reservvyn, plus rubriken "Filen är
 * klar" - samma uppmaning två gånger (dubbla budskap). Reservvyn ska i
 * stället peka UPP mot den enda knappen. Och knappen får inte vara död i
 * demons ram: den måste ha vägen som räddar det inbäddade fallet
 * (window.open i ny flik) när nedladdningen blockeras tyst.
 *
 * Kontrollen läser komponentens källa som text. En regel som inte testas
 * är en åsikt, och den här regeln syntes bara för ögon förut.
 */
const visareKod = readFileSync(
  join(process.cwd(), "src/components/reports/useInlineReport.tsx"),
  "utf8",
);
const sparaKnappar = (visareKod.match(/onClick=\{\(\) => void savePdf\(/g) ?? []).length;
check("rapportvisaren har exakt EN spara-knapp", sparaKnappar === 1, `hittade ${sparaKnappar}`);
check("spara-knappen har vägen för inbäddat läge (ny flik)", visareKod.includes("window.open("));
const objektIndex = visareKod.indexOf("<object");
check("reservvyn <object> finns kvar", objektIndex !== -1);
check(
  "reservvyn har ingen egen knapp - den pekar upp",
  objektIndex !== -1 && !visareKod.slice(objektIndex).includes("void savePdf("),
);
// Den RENDERADE rubriken (>...</p>), inte förklaringen i kommentaren som
// citerar det gamla felet. Det är headingen som var det dubbla budskapet.
check(
  "den dubbla rubriken 'Filen är klar' är borta ur vyn",
  !visareKod.includes("Filen är klar</p>"),
);


console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
