/**
 * Assertions for the Financial Domain Model and the insight engine.
 *
 * The insights are what the assistant tells a company in crisis, so each one
 * is pinned to an exact expected figure. If a calculation drifts, this fails
 * rather than the user being told a wrong number.
 */

import {
  analyseSnapshot, ageing, concentration, costOutliers, prioritisePayments,
} from "../src/lib/financial/insights";
import {
  daysBetween, isOverdue, totalCash, totalOutstanding,
} from "../src/lib/financial/model";
import type {
  FinancialSnapshot, OpenItem, Provenance, Voucher,
} from "../src/lib/financial/model";
import { PROVIDER_REGISTRY, manualDatasets } from "../src/lib/financial/ports";

const norm = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");
let pass = 0, fail = 0;
const ok = (n: string, c: boolean, extra?: string) => {
  if (c) pass++; else { fail++; console.log(`FAIL ${n}${extra ? `\n  ${extra}` : ""}`); }
};
const eq = (n: string, a: unknown, b: unknown) => {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x === y) pass++; else { fail++; console.log(`FAIL ${n}\n  got      ${x}\n  expected ${y}`); }
};

const prov: Provenance = {
  origin: { kind: "accounting", provider: "fortnox", endpoint: "/invoices" },
  fetchedAt: "2026-08-01T08:00:00.000Z",
  sourceRef: "1",
};

const payable = (id: string, name: string, amount: number, dueDate: string): OpenItem => ({
  id, kind: "payable", counterpartyId: `c-${name}`, counterpartyName: name,
  documentNumber: id, issueDate: "2026-05-01", dueDate,
  totalAmount: amount, outstandingAmount: amount, currency: "SEK", provenance: prov,
});
const receivable = (id: string, name: string, amount: number, dueDate: string): OpenItem => ({
  ...payable(id, name, amount, dueDate), kind: "receivable",
});

// --- date helpers ---
eq("daysBetween forward", daysBetween("2026-08-01", "2026-08-11"), 10);
eq("daysBetween backward", daysBetween("2026-08-11", "2026-08-01"), -10);
eq("daysBetween junk", daysBetween("nope", "2026-08-01"), 0);
eq("daysBetween over month end", daysBetween("2026-01-31", "2026-03-01"), 29);
ok("isOverdue true", isOverdue(payable("a","X",100,"2026-07-01"), "2026-08-01"));
ok("isOverdue false on due date", !isOverdue(payable("a","X",100,"2026-08-01"), "2026-08-01"));

// --- totals ---
const items = [payable("1","A",1000,"2026-08-10"), payable("2","B",500,"2026-08-10"), receivable("3","C",2000,"2026-08-10")];
eq("total payable", totalOutstanding(items, "payable"), 1500);
eq("total receivable", totalOutstanding(items, "receivable"), 2000);
eq("totalCash excludes credit", totalCash([
  { id:"b1", name:"Företagskonto", accountNumber:null, balance: 120000, currency:"SEK", asOf:"2026-08-01", creditLimit: 500000, provenance: prov },
]), 120000);

// --- concentration ---
const many = [
  payable("p1","Stor AB",800000,"2026-08-10"),
  payable("p2","Mellan AB",150000,"2026-08-10"),
  payable("p3","Liten AB",30000,"2026-08-10"),
  payable("p4","Minst AB",20000,"2026-08-10"),
];
const conc = concentration(many, 0.8)!;
eq("concentration count", conc.count, 1);
eq("concentration total", conc.total, 1000000);
ok("concentration share >= 0.8", conc.share >= 0.8, String(conc.share));
eq("concentration top name", conc.top[0].name, "Stor AB");
// same counterparty across two invoices aggregates
const split = [payable("p1","Stor AB",500000,"2026-08-10"), payable("p2","Stor AB",300000,"2026-08-10"), payable("p3","Liten AB",200000,"2026-08-10")];
eq("concentration aggregates by counterparty", concentration(split, 0.8)!.count, 1);
eq("concentration empty", concentration([], 0.8), null);

// --- ageing ---
const aged = ageing([
  payable("a1","A",1000,"2026-08-15"),  // not due
  payable("a2","B",2000,"2026-07-20"),  // 12 d
  payable("a3","C",3000,"2026-06-15"),  // 47 d
  payable("a4","D",4000,"2026-04-01"),  // 122 d
], "2026-08-01");
eq("ageing not due", [aged[0].count, aged[0].amount], [1, 1000]);
eq("ageing 1-30", [aged[1].count, aged[1].amount], [1, 2000]);
eq("ageing 31-60", [aged[2].count, aged[2].amount], [1, 3000]);
eq("ageing over 90", [aged[4].count, aged[4].amount], [1, 4000]);

// --- cost outliers ---
const voucher = (date: string, account: string, amount: number): Voucher => ({
  id: `v-${date}-${account}`, series: "A", number: null, date, description: null,
  rows: [{ accountNumber: account, amount, description: null }], provenance: prov,
});
const snapshotBase: FinancialSnapshot = {
  id: "s1", provider: "fortnox", capturedAt: "2026-08-01T08:00:00.000Z",
  orgNumber: "556000-0000", companyName: "Testbolaget AB", gaps: [],
  chartOfAccounts: [
    { number: "5010", name: "Lokalhyra", type: "expense" },
    { number: "1930", name: "Företagskonto", type: "asset", isCashAccount: true },
  ],
};
const steady = ["2026-01","2026-02","2026-03","2026-04","2026-05"].map(m => voucher(`${m}-05`, "5010", 50000));
const withSpike = [...steady, voucher("2026-06-05", "5010", 400000)];
const spikes = costOutliers({ ...snapshotBase, vouchers: withSpike });
eq("outlier found", spikes.length, 1);
eq("outlier period", spikes[0]?.period, "2026-06");
eq("outlier amount", spikes[0]?.amount, 400000);
eq("outlier typical is median not mean", spikes[0]?.typical, 50000);
eq("no outlier in steady series", costOutliers({ ...snapshotBase, vouchers: steady }).length, 0);
eq("too little history says nothing", costOutliers({ ...snapshotBase, vouchers: [voucher("2026-01-05","5010",50000), voucher("2026-06-05","5010",900000)] }).length, 0);
// a mean would be dragged up by the spike and hide it; median must not be
ok("median resists the spike", spikes[0]!.typical < 100000, `typical=${spikes[0]?.typical}`);
// income accounts are not costs
eq("ignores non-expense accounts", costOutliers({
  ...snapshotBase,
  chartOfAccounts: [{ number: "3010", name: "Försäljning", type: "income" }],
  vouchers: [...steady, voucher("2026-06-05","5010",400000)],
}).length, 0);

// --- payment priority ---
const prioritised = prioritisePayments([
  { label: "Leverantörsfaktura Stor AB", amount: 400000, dueDate: "2026-08-05" },
  { label: "Skatteverket moms", amount: 40000, dueDate: "2026-08-12" },
  { label: "Löner augusti", amount: 300000, dueDate: "2026-08-25" },
], { asOf: "2026-08-01" });
eq("tax outranks a ten times larger supplier invoice", prioritised[0].label, "Skatteverket moms");
eq("tax reason", prioritised[0].reason, "personal_liability");
eq("salary second", prioritised[1].reason, "wage_guarantee");
eq("supplier last", prioritised[2].reason, "ordinary");

// --- assistant ---
const fullSnapshot: FinancialSnapshot = {
  ...snapshotBase,
  vouchers: withSpike,
  bankAccounts: [{ id:"b1", name:"Företagskonto", accountNumber:"1234", balance: 120000, currency:"SEK", asOf:"2026-08-01", provenance: prov }],
  openItems: [
    payable("p1","Stor AB",800000,"2026-08-10"),
    payable("p2","Liten AB",50000,"2026-04-01"),
    receivable("r1","Kund AB",600000,"2026-07-01"),
    receivable("r2","Kund BB",20000,"2026-07-01"),
  ],
  gaps: [{ dataset: "taxAccount", reason: "Stöds inte av leverantören" }],
};
const insights = analyseSnapshot(fullSnapshot, { now: new Date("2026-08-01T09:00:00Z") });
const byId = Object.fromEntries(insights.map(i => [i.id, i]));

ok("shortfall detected", !!byId["cash-shortfall"]);
// 800 000 due in 9 days + 50 000 already 122 days overdue = 850 000 against
// 120 000 in cash. Already-overdue items belong in the window.
ok("shortfall figure correct", norm(byId["cash-shortfall"].detail).includes("730 000 kr"),
   norm(byId["cash-shortfall"]?.detail ?? ""));
ok("concentration insight", !!byId["creditor-concentration"]);
ok("large overdue receivable named", norm(byId["large-overdue-receivables"].title).includes("En kundfordran över"),
   norm(byId["large-overdue-receivables"]?.title ?? ""));
ok("small overdue receivable excluded", byId["large-overdue-receivables"].evidence.length === 1);
ok("over-90 payables flagged", !!byId["payables-over-90"]);
ok("gaps surfaced", !!byId["missing-datasets"]);
ok("critical sorts first", insights[0].severity === "critical", insights[0]?.id);
ok("every insight is deterministic", insights.every(i => i.basis === "deterministic"));
ok("every insight carries evidence", insights.every(i => i.evidence.length > 0),
   insights.filter(i => i.evidence.length === 0).map(i => i.id).join(","));

// an empty snapshot must not invent reassurance
const empty = analyseSnapshot(
  { id:"s0", provider:"generic", capturedAt:"2026-08-01T08:00:00.000Z", orgNumber:null, companyName:null, gaps: [] },
  { now: new Date("2026-08-01T09:00:00Z") },
);
eq("empty snapshot says nothing", empty.length, 0);

// --- provider registry ---
ok("six providers", PROVIDER_REGISTRY.length === 6, String(PROVIDER_REGISTRY.length));
ok("no provider claims skattekonto", PROVIDER_REGISTRY.every(p => !p.capabilities.taxAccount));
ok("every provider warns about skattekonto", PROVIDER_REGISTRY.every(p => !!p.notes?.taxAccount));
eq("manualDatasets flags the gap",
   manualDatasets(PROVIDER_REGISTRY.find(p => p.id === "bokio")!, ["openItems","counterparties","taxAccount"]),
   ["counterparties","taxAccount"]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
