/**
 * Assertions for report rendering.
 *
 * Reports leave the product - they get saved, emailed and read by advisors -
 * so escaping and structure are worth pinning down.
 */

import { renderReport, escapeHtml } from "../src/lib/reports/render";
import { reportFileName } from "../src/lib/reports/deliver";
import { buildCrisisReport, buildKbrReport, buildLiquidityReport } from "../src/lib/reports/builders";
import { analyseCrisis } from "../src/lib/crisisAnalysis";
import { projectLiquidity } from "../src/lib/liquidityPlan";
import type { ReportModel } from "../src/lib/reports/types";

/**
 * toLocaleString("sv-SE") separates thousands with U+00A0, so comparing
 * against a literal typed with a normal space fails on correct output.
 * Normalise before asserting rather than weakening the assertion.
 */
const norm = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra?: string) => {
  if (cond) pass++;
  else { fail++; console.log(`FAIL ${name}${extra ? `\n  ${extra}` : ""}`); }
};
const eq = (name: string, a: unknown, b: unknown) => {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x === y) pass++; else { fail++; console.log(`FAIL ${name}\n  got      ${x}\n  expected ${y}`); }
};

// --- escaping ---
eq("escape", escapeHtml(`<script>&"'`), "&lt;script&gt;&amp;&quot;&#039;");

// A company name is user- or register-supplied and must not be able to inject.
const injected: ReportModel = {
  meta: {
    documentTitle: "Krisanalys",
    companyName: '<img src=x onerror="alert(1)">',
    orgNumber: "556000-0000",
    reference: null,
    generatedAt: "2026-07-31T10:00:00.000Z",
  },
  lead: [{ kind: "paragraph", text: "</style><script>alert(2)</script>" }],
  sections: [{
    title: "T",
    blocks: [
      { kind: "table", columns: [{ label: "A" }], rows: [{ cells: ['"><b>x</b>'] }] },
      { kind: "list", items: [{ text: "<b>li</b>", note: "<i>n</i>" }] },
      { kind: "callout", tone: "critical", title: "<h1>", body: "<p>", legalRef: "<a>" },
      { kind: "keyValues", items: [{ label: "<k>", value: "<v>" }] },
      { kind: "figures", items: [{ value: "<f>", label: "<l>" }] },
    ],
  }],
  disclaimer: "Test <b>",
};
const html = norm(renderReport(injected));
ok("no raw <script> from content", !html.includes("<script>alert(2)</script>"));
ok("no onerror attribute", !html.includes('onerror="alert(1)"'));
ok("no injected <img", !html.includes("<img src=x"));
ok("no injected <b>", !html.includes("<b>x</b>") && !html.includes("<b>li</b>"));
ok("escaped forms present", html.includes("&lt;img src=x") && html.includes("&lt;b&gt;li&lt;/b&gt;"));
ok("doctype", html.startsWith("<!DOCTYPE html>"));
ok("lang sv", html.includes('<html lang="sv">'));
ok("has print css", html.includes("@page") && html.includes("@media print"));
ok("disclaimer rendered", html.includes("Ansvarsfriskrivning"));
ok("no unresolved template", !html.includes("${"));

// --- crisis report ---
const analysis = analyseCrisis({
  canPaySalary: false, canPayTax: false, canPayRent: true, canPaySuppliers: false,
  salaryAmount: 420000, salaryDay: 25, taxAmount: 165000, taxDay: 12,
  rentAmount: 58000, rentDay: 1, totalDebt: 3200000, quickLiquidationValue: 950000,
  employees: "6-10",
});
const crisis = buildCrisisReport({
  analysis, companyName: "Demobolaget AB", orgNumber: "556000-0000",
  reference: "abc-123", employees: "6-10",
  totalDebt: 3200000, quickLiquidationValue: 950000,
  generatedAt: "2026-07-31T10:00:00.000Z",
});
eq("crisis title", crisis.meta.documentTitle, "Krisanalys");
ok("crisis has sections", crisis.sections.length >= 3, `fick ${crisis.sections.length}`);
ok("crisis has risk section", crisis.sections.some(s => s.title === "Risker att känna till"));
ok("crisis has timeline", crisis.sections.some(s => s.title === "Tidslinje"));
const crisisHtml = norm(renderReport(crisis));
ok("crisis renders verdict", crisisHtml.includes(analysis.title));
ok("crisis renders legal ref", crisisHtml.includes("Skatteförfarandelagen"));
ok("crisis renders company", crisisHtml.includes("Demobolaget AB"));
ok("crisis coverage 30 %", crisisHtml.includes("30 %"), "täckningsgrad 950000/3200000");

// --- kbr report ---
const kbr = buildKbrReport({
  status: "required", message: "Eget kapital understiger hälften.",
  shareCapital: 100000, totalAssets: 400000, totalLiabilities: 370000,
  equity: 30000, threshold: 50000,
  companyName: null, orgNumber: "556000-0000", reference: null,
  actions: ["Upprätta KBR", "Kalla till kontrollstämma"],
  generatedAt: "2026-07-31T10:00:00.000Z",
});
const kbrHtml = norm(renderReport(kbr));
ok("kbr equity shown", kbrHtml.includes("30 000 kr"));
ok("kbr threshold shown", kbrHtml.includes("50 000 kr"));
ok("kbr cites ABL", kbrHtml.includes("25 kap. 13 §"));
ok("kbr says not the document itself", kbrHtml.includes("inte en kontrollbalansräkning"));

// --- liquidity report ---
const plan = {
  openingBalance: 238400,
  inflows: [{ id: "i1", label: "Kundfaktura", amount: 181500, counterpart: "", dayOfMonth: 3, date: "2026-08-03", recurring: true }],
  outflows: [
    { id: "o1", label: "Löner", amount: 142000, category: "salary" as const, dayOfMonth: 25, date: "2026-08-25", recurring: true },
    { id: "o2", label: "Skatt", amount: 61250, category: "tax" as const, dayOfMonth: 12, date: "2026-08-12", recurring: true },
  ],
};
const projection = projectLiquidity(plan, 90);
const liq = buildLiquidityReport({
  plan, projection, horizonDays: 90,
  companyName: "Demobolaget AB", orgNumber: null, reference: null,
  employerFeeApplied: true, generatedAt: "2026-07-31T10:00:00.000Z",
});
const liqHtml = norm(renderReport(liq));
ok("liq opening balance", liqHtml.includes("238 400 kr"));
ok("liq mentions employer fee", liqHtml.includes("31,42 %"));
ok("liq has in and out sections", liq.sections.some(s => s.title === "Pengar in") && liq.sections.some(s => s.title === "Pengar ut"));
ok("liq day-by-day only event days", liq.sections.some(s => s.title === "Dag för dag"));
ok("liq disclaimer mentions assumptions", liq.disclaimer.includes("outnyttjade krediter"));

// empty plan must not crash and must say so
const emptyLiq = buildLiquidityReport({
  plan: { openingBalance: 0, inflows: [], outflows: [] },
  projection: projectLiquidity({ openingBalance: 0, inflows: [], outflows: [] }, 90),
  horizonDays: 90, companyName: null, orgNumber: null, reference: null,
  employerFeeApplied: false, generatedAt: "2026-07-31T10:00:00.000Z",
});
const emptyHtml = norm(renderReport(emptyLiq));
ok("empty plan renders", emptyHtml.includes("Inga inbetalningar angivna."));
ok("empty plan no day section", !emptyLiq.sections.some(s => s.title === "Dag för dag"));

// --- file name ---
eq("filename", reportFileName(crisis), "krisanalys-demobolaget-ab-2026-07-31.html");
eq("filename without company", reportFileName({ ...crisis, meta: { ...crisis.meta, companyName: null, orgNumber: null } }),
   "krisanalys-clearance-2026-07-31.html");
ok("filename strips diacritics", reportFileName({ ...crisis, meta: { ...crisis.meta, companyName: "Åkeri & Söner AB" } })
   === "krisanalys-akeri-soner-ab-2026-07-31.html",
   reportFileName({ ...crisis, meta: { ...crisis.meta, companyName: "Åkeri & Söner AB" } }));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
