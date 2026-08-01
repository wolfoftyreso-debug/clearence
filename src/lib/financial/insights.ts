/**
 * The insight engine behind the reconstruction assistant.
 *
 * WHY THIS IS NOT A LANGUAGE MODEL.
 *
 * Almost every insight the assistant is meant to produce is arithmetic:
 *
 *   "Likviditeten tar slut om 47 dagar."          -> a projection
 *   "13 leverantörer står för 82 % av skulderna." -> a sorted cumulative sum
 *   "Tre kundfordringar över 500 000 kr är försenade." -> a filter
 *   "Nästa lagstadgade deadline är om fem dagar." -> a date comparison
 *   "Följande rapport saknas inför nästa steg."   -> a set difference
 *
 * Running those through a language model would make them slower, unrepeatable,
 * impossible to unit test, and capable of stating a number that is not in the
 * data. In a product that tells someone whether their company is insolvent,
 * a hallucinated figure is the worst defect available. So these are pure
 * functions, every one of them carries the numbers it was derived from, and
 * every one is covered by a test.
 *
 * What a language model is genuinely good for here is the residue: phrasing a
 * covering letter, summarising a month of variances in prose, drafting a reply
 * to a creditor. Those go elsewhere, are always marked as drafts, and never
 * set a status or a figure.
 */

import {
  daysBetween,
  isOverdue,
  totalCash,
  type FinancialSnapshot,
  type OpenItem,
} from "./model";

export type InsightSeverity = "critical" | "warning" | "info";

export interface Insight {
  id: string;
  severity: InsightSeverity;
  /** One line, written for someone under stress. No hedging, no jargon. */
  title: string;
  /** Two or three sentences of context and what to do about it. */
  detail: string;
  /**
   * The figures behind the claim, so it can be checked rather than believed.
   * Rendered next to the insight, not hidden behind a disclosure.
   */
  evidence: { label: string; value: string }[];
  /** Where the user should go to act on it. */
  action?: { label: string; href: string };
  /** Always "deterministic" for everything in this file. */
  basis: "deterministic";
}

const sek = (value: number): string =>
  `${Math.round(value).toLocaleString("sv-SE")} kr`;

const pct = (ratio: number): string => `${Math.round(ratio * 100)} %`;

const today = (now: Date): string => now.toISOString().slice(0, 10);

/* -------------------------------------------------------------------------- */
/* Concentration                                                              */
/* -------------------------------------------------------------------------- */

export interface Concentration {
  /** Counterparties needed to reach the threshold share. */
  count: number;
  /** Share of the total those counterparties represent. */
  share: number;
  total: number;
  top: { name: string; amount: number; share: number }[];
}

/**
 * How few counterparties make up most of the exposure.
 *
 * This is the number that changes behaviour: negotiating with 13 suppliers is
 * a week's work, negotiating with 400 is not a plan. Returns the smallest set
 * reaching `threshold` of the total.
 */
export const concentration = (
  items: OpenItem[],
  threshold = 0.8,
): Concentration | null => {
  if (items.length === 0) return null;

  const byCounterparty = new Map<string, { name: string; amount: number }>();
  for (const item of items) {
    const existing = byCounterparty.get(item.counterpartyId);
    if (existing) existing.amount += item.outstandingAmount;
    else
      byCounterparty.set(item.counterpartyId, {
        name: item.counterpartyName,
        amount: item.outstandingAmount,
      });
  }

  const sorted = [...byCounterparty.values()].sort((a, b) => b.amount - a.amount);
  const total = sorted.reduce((sum, c) => sum + c.amount, 0);
  if (total <= 0) return null;

  let running = 0;
  let count = 0;
  for (const entry of sorted) {
    running += entry.amount;
    count += 1;
    if (running / total >= threshold) break;
  }

  return {
    count,
    share: running / total,
    total,
    top: sorted.slice(0, 10).map((c) => ({
      name: c.name,
      amount: c.amount,
      share: c.amount / total,
    })),
  };
};

/* -------------------------------------------------------------------------- */
/* Ageing                                                                     */
/* -------------------------------------------------------------------------- */

export interface AgeingBucket {
  label: string;
  /** Inclusive lower bound in days overdue. */
  fromDays: number;
  /** Exclusive upper bound, or null for open-ended. */
  toDays: number | null;
  count: number;
  amount: number;
}

export const ageing = (
  items: OpenItem[],
  asOf: string,
): AgeingBucket[] => {
  const buckets: AgeingBucket[] = [
    { label: "Ej förfallet", fromDays: -Infinity, toDays: 1, count: 0, amount: 0 },
    { label: "1–30 dagar", fromDays: 1, toDays: 31, count: 0, amount: 0 },
    { label: "31–60 dagar", fromDays: 31, toDays: 61, count: 0, amount: 0 },
    { label: "61–90 dagar", fromDays: 61, toDays: 91, count: 0, amount: 0 },
    { label: "Över 90 dagar", fromDays: 91, toDays: null, count: 0, amount: 0 },
  ];

  for (const item of items) {
    const overdueDays = daysBetween(item.dueDate, asOf);
    const bucket = buckets.find(
      (b) => overdueDays >= b.fromDays && (b.toDays === null || overdueDays < b.toDays),
    );
    if (bucket) {
      bucket.count += 1;
      bucket.amount += item.outstandingAmount;
    }
  }

  return buckets;
};

/* -------------------------------------------------------------------------- */
/* Cost outliers                                                              */
/* -------------------------------------------------------------------------- */

export interface CostOutlier {
  accountNumber: string;
  accountName: string;
  period: string;
  amount: number;
  /** Typical amount for this account, as a median. */
  typical: number;
  /** How many robust deviations above typical. */
  deviations: number;
}

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

/**
 * Finds unusually large costs by comparing each month against the same
 * account's own history.
 *
 * Uses median and median absolute deviation rather than mean and standard
 * deviation: a single enormous month would drag a mean upwards and hide
 * itself, which is precisely the month worth finding.
 *
 * Requires at least `minPeriods` of history; with less, there is no such
 * thing as unusual and the function says nothing rather than guessing.
 */
export const costOutliers = (
  snapshot: FinancialSnapshot,
  { minPeriods = 4, threshold = 3 }: { minPeriods?: number; threshold?: number } = {},
): CostOutlier[] => {
  if (!snapshot.vouchers || snapshot.vouchers.length === 0) return [];

  const accountNames = new Map(
    (snapshot.chartOfAccounts ?? []).map((a) => [a.number, a.name]),
  );
  // Distinguish "no chart of accounts supplied" from "chart supplied, and it
  // says these are not costs". Falling back to "count everything" in the
  // second case treats revenue accounts as expenses.
  const hasChart = (snapshot.chartOfAccounts ?? []).length > 0;
  const expenseAccounts = new Set(
    (snapshot.chartOfAccounts ?? [])
      .filter((a) => a.type === "expense")
      .map((a) => a.number),
  );

  // account -> period (yyyy-MM) -> summed amount
  const byAccountPeriod = new Map<string, Map<string, number>>();
  for (const voucher of snapshot.vouchers) {
    const period = voucher.date.slice(0, 7);
    for (const row of voucher.rows) {
      if (hasChart && !expenseAccounts.has(row.accountNumber)) continue;
      // Expenses are debits, i.e. positive in this model.
      if (row.amount <= 0) continue;
      let periods = byAccountPeriod.get(row.accountNumber);
      if (!periods) {
        periods = new Map();
        byAccountPeriod.set(row.accountNumber, periods);
      }
      periods.set(period, (periods.get(period) ?? 0) + row.amount);
    }
  }

  const outliers: CostOutlier[] = [];

  for (const [accountNumber, periods] of byAccountPeriod) {
    if (periods.size < minPeriods) continue;
    const amounts = [...periods.values()];
    const typical = median(amounts);
    if (typical <= 0) continue;

    const mad = median(amounts.map((a) => Math.abs(a - typical)));
    // A perfectly regular account has zero spread; fall back to a share of
    // the typical amount so a genuine jump is still detectable.
    const spread = mad > 0 ? mad : typical * 0.1;

    for (const [period, amount] of periods) {
      const deviations = (amount - typical) / spread;
      if (deviations >= threshold) {
        outliers.push({
          accountNumber,
          accountName: accountNames.get(accountNumber) ?? accountNumber,
          period,
          amount,
          typical,
          deviations: Math.round(deviations * 10) / 10,
        });
      }
    }
  }

  return outliers.sort((a, b) => b.amount - a.amount);
};

/* -------------------------------------------------------------------------- */
/* Payment priority                                                           */
/* -------------------------------------------------------------------------- */

export type PriorityReason =
  | "personal_liability"
  | "wage_guarantee"
  | "critical_supplier"
  | "overdue"
  | "ordinary";

export interface PrioritisedPayment {
  label: string;
  amount: number;
  dueDate: string;
  reason: PriorityReason;
  /** Lower sorts first. */
  rank: number;
  note: string;
}

/**
 * Orders upcoming payments by consequence rather than by size.
 *
 * The ordering is legally informed, which is the whole point: unpaid tax on
 * its due date can make a company representative personally liable
 * (Skatteförfarandelagen 59 kap. 12–13 §§), and that consequence does not
 * scale with the amount. A 40 000 kr tax payment outranks a 400 000 kr
 * supplier invoice.
 *
 * IMPORTANT: this is a suggestion for planning, not advice on whom to pay.
 * Selective payments to individual creditors before an insolvency can be
 * recovered by the estate (Konkurslagen 4 kap.) and can increase personal
 * exposure. The interface must carry that warning wherever this is shown -
 * see `PRIORITY_WARNING`.
 */
export const PRIORITY_WARNING =
  "Det här är en planeringsordning, inte ett råd om vem du ska betala. Att betala enskilda borgenärer före andra när bolaget är på obestånd kan återvinnas i efterhand och kan öka ditt personliga ansvar. Stäm av med en jurist innan du prioriterar bort någon.";

const RANK: Record<PriorityReason, number> = {
  personal_liability: 1,
  wage_guarantee: 2,
  critical_supplier: 3,
  overdue: 4,
  ordinary: 5,
};

const TAX_PATTERN = /(skatteverket|skattekonto|moms|arbetsgivaravgift|preliminärskatt|f-skatt)/i;
const SALARY_PATTERN = /(lön|löner|lönekörning|salary|payroll)/i;

export const prioritisePayments = (
  payments: { label: string; amount: number; dueDate: string }[],
  options: { criticalSupplierIds?: string[]; asOf: string } = { asOf: "" },
): PrioritisedPayment[] =>
  payments
    .map((payment) => {
      let reason: PriorityReason = "ordinary";
      let note = "Vanlig betalning.";

      if (TAX_PATTERN.test(payment.label)) {
        reason = "personal_liability";
        note =
          "Skatt och moms. Uteblir betalningen på förfallodagen kan du bli personligen betalningsskyldig om ingen verksam åtgärd vidtagits.";
      } else if (SALARY_PATTERN.test(payment.label)) {
        reason = "wage_guarantee";
        note =
          "Löner. Lönegarantin träder in först vid konkurs eller rekonstruktion, inte för att pengarna saknas.";
      } else if (options.asOf && daysBetween(payment.dueDate, options.asOf) > 0) {
        reason = "overdue";
        note = "Redan förfallen.";
      }

      return { ...payment, reason, rank: RANK[reason], note };
    })
    .sort((a, b) => a.rank - b.rank || a.dueDate.localeCompare(b.dueDate));

/* -------------------------------------------------------------------------- */
/* The assistant                                                              */
/* -------------------------------------------------------------------------- */

export interface AssistantOptions {
  /** Injected so the output is deterministic and testable. */
  now: Date;
  /** Receivables above this are called out individually. */
  largeReceivableThreshold?: number;
  /** Days ahead to look for upcoming payments. */
  horizonDays?: number;
}

/**
 * Turns a snapshot into the list the dashboard shows.
 *
 * Ordered by severity, then by size of consequence. Says nothing when it
 * knows nothing - a missing dataset produces an explicit "we cannot see this"
 * insight rather than a reassuring silence.
 */
export const analyseSnapshot = (
  snapshot: FinancialSnapshot,
  options: AssistantOptions,
): Insight[] => {
  const { now, largeReceivableThreshold = 100_000, horizonDays = 30 } = options;
  const asOf = today(now);
  const insights: Insight[] = [];

  const openItems = snapshot.openItems ?? [];
  const payables = openItems.filter((i) => i.kind === "payable");
  const receivables = openItems.filter((i) => i.kind === "receivable");

  /* --- cash and runway ------------------------------------------------- */

  if (snapshot.bankAccounts && snapshot.bankAccounts.length > 0) {
    const cash = totalCash(snapshot.bankAccounts);
    const dueSoon = payables.filter(
      (i) => daysBetween(asOf, i.dueDate) <= horizonDays,
    );
    const dueSoonTotal = dueSoon.reduce((s, i) => s + i.outstandingAmount, 0);

    if (dueSoonTotal > cash) {
      insights.push({
        id: "cash-shortfall",
        severity: "critical",
        title: `Pengarna räcker inte till det som ska betalas den närmaste månaden`,
        detail: `Kassan är ${sek(cash)}. ${sek(dueSoonTotal)} är redan förfallet eller förfaller inom ${horizonDays} dagar. Underskottet är ${sek(dueSoonTotal - cash)}. Bygg en likviditetsplan och avgör vilka betalningar som måste omförhandlas.`,
        evidence: [
          { label: "Kassa", value: sek(cash) },
          { label: `Förfallet eller förfaller inom ${horizonDays} d`, value: sek(dueSoonTotal) },
          { label: "Antal fakturor", value: String(dueSoon.length) },
        ],
        action: { label: "Öppna likviditetsplanen", href: "/likviditetsplan" },
        basis: "deterministic",
      });
    }
  }

  /* --- supplier concentration ------------------------------------------ */

  const payableConcentration = concentration(payables, 0.8);
  if (payableConcentration && payableConcentration.count > 0) {
    insights.push({
      id: "creditor-concentration",
      severity: "info",
      title: `${payableConcentration.count} leverantörer står för ${pct(payableConcentration.share)} av skulderna`,
      detail:
        payableConcentration.count <= 20
          ? "Det är få nog att gå igenom en och en. Börja där - en uppgörelse med dem täcker merparten av skulden."
          : "Skulden är utspridd, vilket gör individuella uppgörelser tunga. Ett samlat upplägg via rekonstruktion kan vara mer realistiskt.",
      evidence: [
        { label: "Total leverantörsskuld", value: sek(payableConcentration.total) },
        { label: "Antal leverantörer", value: String(payableConcentration.count) },
        {
          label: "Största",
          value: `${payableConcentration.top[0]?.name ?? "–"} · ${sek(payableConcentration.top[0]?.amount ?? 0)}`,
        },
      ],
      basis: "deterministic",
    });
  }

  /* --- large overdue receivables --------------------------------------- */

  const largeOverdue = receivables
    .filter((i) => isOverdue(i, asOf) && i.outstandingAmount >= largeReceivableThreshold)
    .sort((a, b) => b.outstandingAmount - a.outstandingAmount);

  if (largeOverdue.length > 0) {
    const sum = largeOverdue.reduce((s, i) => s + i.outstandingAmount, 0);
    insights.push({
      id: "large-overdue-receivables",
      severity: "warning",
      title:
        largeOverdue.length === 1
          ? `En kundfordran över ${sek(largeReceivableThreshold)} är försenad`
          : `${largeOverdue.length} kundfordringar över ${sek(largeReceivableThreshold)} är försenade`,
      detail: `Sammanlagt ${sek(sum)} som redan skulle ha betalats. Det är oftast den snabbaste vägen till likviditet - snabbare än att förhandla om utgifter.`,
      evidence: largeOverdue.slice(0, 5).map((i) => ({
        label: `${i.counterpartyName} (${daysBetween(i.dueDate, asOf)} d sen)`,
        value: sek(i.outstandingAmount),
      })),
      basis: "deterministic",
    });
  }

  /* --- ageing ---------------------------------------------------------- */

  const payableAgeing = ageing(payables, asOf);
  const deeplyOverdue = payableAgeing[payableAgeing.length - 1];
  if (deeplyOverdue && deeplyOverdue.amount > 0) {
    insights.push({
      id: "payables-over-90",
      severity: "warning",
      title: `${sek(deeplyOverdue.amount)} i leverantörsskulder är över 90 dagar försenade`,
      detail:
        "Skulder som legat så länge leder ofta till inkasso eller betalningsföreläggande. Kontakta dem innan de gör det - förhandlingsläget är bättre före än efter.",
      evidence: payableAgeing
        .filter((b) => b.amount > 0)
        .map((b) => ({ label: b.label, value: `${sek(b.amount)} (${b.count} st)` })),
      basis: "deterministic",
    });
  }

  /* --- cost outliers --------------------------------------------------- */

  const outliers = costOutliers(snapshot);
  if (outliers.length > 0) {
    const worst = outliers[0];
    insights.push({
      id: "cost-outlier",
      severity: "info",
      title: `Ovanligt stor kostnad på konto ${worst.accountNumber} i ${worst.period}`,
      detail: `${sek(worst.amount)} mot normalt ${sek(worst.typical)} för samma konto. Kan vara en engångspost, en felkontering eller något som går att omförhandla - värt att titta på.`,
      evidence: outliers.slice(0, 5).map((o) => ({
        label: `${o.accountNumber} ${o.accountName} · ${o.period}`,
        value: `${sek(o.amount)} (normalt ${sek(o.typical)})`,
      })),
      basis: "deterministic",
    });
  }

  /* --- what we cannot see ---------------------------------------------- */

  if (snapshot.gaps.length > 0) {
    insights.push({
      id: "missing-datasets",
      severity: "warning",
      title: "Delar av ekonomin kunde inte hämtas",
      detail:
        "Bedömningen bygger bara på det som gick att läsa. Fyll i det som saknas för hand, annars ser läget bättre ut än det är.",
      evidence: snapshot.gaps.map((g) => ({ label: g.dataset, value: g.reason })),
      basis: "deterministic",
    });
  }

  const order: Record<InsightSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return insights.sort((a, b) => order[a.severity] - order[b.severity]);
};
