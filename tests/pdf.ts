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
import { boardMinutesKbr, templateToPdf } from "../src/lib/documentTemplates";
import type { ReportModel } from "../src/lib/reports/types";

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

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
