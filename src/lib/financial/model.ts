/**
 * Financial Domain Model.
 *
 * Clearance's own description of a company's finances, deliberately owned by
 * this application rather than borrowed from any accounting system. Fortnox,
 * Visma, Bokio, Björn Lundén, PE Accounting and Business Central all model
 * the same reality differently; the difference belongs in an adapter, not in
 * every screen and calculation downstream.
 *
 * Two rules run through everything here.
 *
 * 1. EVERY FIGURE CARRIES ITS ORIGIN. A number in an insolvency assessment is
 *    only as good as the answer to "where did that come from, and when?".
 *    `Provenance` is not optional metadata - it is what makes the figure
 *    usable in a document that goes to a rekonstruktör or a court.
 *
 * 2. LEDGER AND BANK ARE DIFFERENT THINGS. A supplier invoice in the ledger is
 *    what is owed; a bank debit is what has been paid. Merging them naively
 *    double-counts and makes the liquidity projection wrong in the direction
 *    that hurts - it makes the company look worse or better than it is,
 *    depending on which side gets duplicated. Sources stay labelled all the
 *    way through so a projection can decide what to count.
 */

/* -------------------------------------------------------------------------- */
/* Provenance                                                                 */
/* -------------------------------------------------------------------------- */

export type ProviderId =
  | "fortnox"
  | "visma"
  | "bjornlunden"
  | "bokio"
  | "peaccounting"
  | "businesscentral"
  | "generic";

/** Where a figure came from. Never inferred; always recorded at ingestion. */
export type DataOrigin =
  /** Read from an accounting system through an adapter. */
  | { kind: "accounting"; provider: ProviderId; endpoint: string }
  /** Parsed from a bank statement the user uploaded. */
  | { kind: "bank_statement"; fileName: string }
  /** Typed in by a person. */
  | { kind: "manual"; enteredBy: string | null }
  /** Computed by Clearance from other data. */
  | { kind: "derived"; from: string };

export interface Provenance {
  origin: DataOrigin;
  /** ISO timestamp when the value was read or entered. */
  fetchedAt: string;
  /** Identifier in the source system, so a figure can be traced back. */
  sourceRef: string | null;
}

/** Anything that can be shown to a third party carries this. */
export interface Sourced<T> {
  value: T;
  provenance: Provenance;
}

/* -------------------------------------------------------------------------- */
/* Chart of accounts and ledger                                               */
/* -------------------------------------------------------------------------- */

export type AccountType =
  | "asset"
  | "liability"
  | "equity"
  | "income"
  | "expense";

export interface Account {
  /** Account number as the company uses it, e.g. "1930". */
  number: string;
  name: string;
  type: AccountType;
  /** True when the account is a bank or cash account. */
  isCashAccount?: boolean;
  vatCode?: string | null;
}

export interface VoucherRow {
  accountNumber: string;
  /** Positive debit, negative credit. One signed figure, not two columns. */
  amount: number;
  description: string | null;
  costCenterId?: string | null;
  projectId?: string | null;
}

export interface Voucher {
  id: string;
  /** Series and number as the source system shows them, e.g. "A" / 142. */
  series: string | null;
  number: string | null;
  /** ISO date, yyyy-MM-dd */
  date: string;
  description: string | null;
  rows: VoucherRow[];
  provenance: Provenance;
}

/* -------------------------------------------------------------------------- */
/* Statements                                                                 */
/* -------------------------------------------------------------------------- */

export interface AccountBalance {
  accountNumber: string;
  accountName: string;
  type: AccountType;
  /** Closing balance for the period, signed per accounting convention. */
  balance: number;
  /** Same account in the comparison period, when available. */
  previousBalance?: number | null;
}

export interface BalanceSheet {
  /** ISO date the balance refers to. */
  asOf: string;
  accounts: AccountBalance[];
  totalAssets: number;
  totalLiabilities: number;
  equity: number;
  provenance: Provenance;
}

export interface IncomeStatement {
  /** ISO dates. */
  from: string;
  to: string;
  accounts: AccountBalance[];
  revenue: number;
  operatingExpenses: number;
  result: number;
  provenance: Provenance;
}

/* -------------------------------------------------------------------------- */
/* Counterparties and open items                                              */
/* -------------------------------------------------------------------------- */

export interface Counterparty {
  id: string;
  name: string;
  orgNumber: string | null;
  email: string | null;
  phone: string | null;
  provenance: Provenance;
}

export type OpenItemKind = "receivable" | "payable";

/**
 * An unpaid invoice. Both directions share a shape because everything
 * downstream - ageing, concentration, prioritisation - treats them the same
 * way apart from the sign.
 */
export interface OpenItem {
  id: string;
  kind: OpenItemKind;
  counterpartyId: string;
  counterpartyName: string;
  documentNumber: string | null;
  /** ISO date. */
  issueDate: string;
  /** ISO date. */
  dueDate: string;
  /** Original amount including VAT, always positive. */
  totalAmount: number;
  /** What is still outstanding, always positive. */
  outstandingAmount: number;
  currency: string;
  /** Set when the company disputes it. */
  disputed?: boolean;
  provenance: Provenance;
}

/* -------------------------------------------------------------------------- */
/* Cash, tax and payroll                                                      */
/* -------------------------------------------------------------------------- */

export interface BankAccountBalance {
  id: string;
  name: string;
  accountNumber: string | null;
  balance: number;
  currency: string;
  /** ISO date the balance refers to. */
  asOf: string;
  /** Agreed overdraft facility, when known. Not counted as cash. */
  creditLimit?: number | null;
  provenance: Provenance;
}

/**
 * Skatteverket's tax account.
 *
 * ASSUMPTION, and an important one: there is no general third-party API for
 * a company's skattekonto. Accounting systems hold what the company itself
 * has booked, which is not the same as the authority's balance and is
 * routinely out of step with it. Treat any value here as the company's own
 * bookkeeping unless the origin says otherwise, and never present it as
 * Skatteverket's figure.
 */
export interface TaxAccountPosition {
  balance: number;
  asOf: string;
  /** Upcoming declared amounts and their due dates, when known. */
  upcoming: { label: string; amount: number; dueDate: string }[];
  provenance: Provenance;
}

export interface PayrollSummary {
  /** ISO dates for the period the figures cover. */
  from: string;
  to: string;
  grossSalaries: number;
  employerContributions: number;
  employeeCount: number | null;
  provenance: Provenance;
}

/* -------------------------------------------------------------------------- */
/* Dimensions and budget                                                      */
/* -------------------------------------------------------------------------- */

export interface CostCenter {
  id: string;
  code: string;
  name: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  status?: string | null;
}

export interface BudgetLine {
  accountNumber: string;
  /** ISO date for the first day of the period. */
  periodStart: string;
  amount: number;
}

/* -------------------------------------------------------------------------- */
/* Snapshot                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Everything Clearance read from one source at one moment.
 *
 * A snapshot is immutable and kept. Two things depend on that: the ability to
 * show a rekonstruktör exactly what the figures looked like when a decision
 * was taken, and the ability to diff two snapshots to see what moved.
 *
 * Fields are optional because providers differ enormously in what they
 * expose. Absence means "this provider did not supply it", which is different
 * from zero - see `FinancialCapabilities`.
 */
export interface FinancialSnapshot {
  id: string;
  provider: ProviderId;
  /** ISO timestamp. */
  capturedAt: string;
  /** Organisation number as the source system holds it. */
  orgNumber: string | null;
  companyName: string | null;

  chartOfAccounts?: Account[];
  balanceSheet?: BalanceSheet;
  incomeStatement?: IncomeStatement;
  vouchers?: Voucher[];
  counterparties?: Counterparty[];
  openItems?: OpenItem[];
  bankAccounts?: BankAccountBalance[];
  taxAccount?: TaxAccountPosition;
  payroll?: PayrollSummary;
  costCenters?: CostCenter[];
  projects?: Project[];
  budget?: BudgetLine[];

  /** Datasets the adapter tried and failed to fetch, with the reason. */
  gaps: { dataset: FinancialDataset; reason: string }[];
}

/* -------------------------------------------------------------------------- */
/* Capabilities                                                               */
/* -------------------------------------------------------------------------- */

export type FinancialDataset =
  | "chartOfAccounts"
  | "balanceSheet"
  | "incomeStatement"
  | "vouchers"
  | "counterparties"
  | "openItems"
  | "bankAccounts"
  | "taxAccount"
  | "payroll"
  | "costCenters"
  | "projects"
  | "budget";

/**
 * What a given provider can actually supply.
 *
 * This exists so the interface can say "your accounting system does not give
 * us supplier invoices, enter them here" instead of silently showing an empty
 * list. An empty list and an unavailable dataset look identical on screen and
 * mean opposite things - one is "you owe nobody", the other is "we do not
 * know what you owe". In an insolvency product that difference is the whole
 * assessment.
 */
export type FinancialCapabilities = Record<FinancialDataset, boolean>;

export const NO_CAPABILITIES: FinancialCapabilities = {
  chartOfAccounts: false,
  balanceSheet: false,
  incomeStatement: false,
  vouchers: false,
  counterparties: false,
  openItems: false,
  bankAccounts: false,
  taxAccount: false,
  payroll: false,
  costCenters: false,
  projects: false,
  budget: false,
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

export const totalOutstanding = (items: OpenItem[], kind: OpenItemKind): number =>
  items
    .filter((item) => item.kind === kind)
    .reduce((sum, item) => sum + item.outstandingAmount, 0);

/** Cash actually available. Credit facilities are deliberately excluded. */
export const totalCash = (accounts: BankAccountBalance[]): number =>
  accounts.reduce((sum, account) => sum + account.balance, 0);

/** Days between two ISO dates; negative when `to` is before `from`. */
export const daysBetween = (from: string, to: string): number => {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
};

export const isOverdue = (item: OpenItem, today: string): boolean =>
  daysBetween(item.dueDate, today) > 0 && item.outstandingAmount > 0;
