/**
 * The Accounting Integration Hub's contract.
 *
 * One adapter per accounting system, all satisfying this interface. Nothing
 * above this layer knows that Fortnox exists. Adding Bokio is a new file and
 * a registry entry, not a change to any screen.
 *
 * WHERE THE ADAPTERS RUN: not here. Every provider on the list uses OAuth2
 * with a confidential client, and this application is a public SPA - the
 * client secret and the refresh tokens cannot live in this bundle. Adapters
 * execute server-side; the browser talks to our own backend, which holds the
 * tokens and returns a FinancialSnapshot. This file is the shape of that
 * contract on both sides of the wire.
 *
 * ASSUMPTIONS to verify against live vendor documentation before writing each
 * adapter - none of them affect this interface, which is the point:
 *  - exact scope names and endpoint paths
 *  - whether the vendor requires partner registration or app review
 *  - rate limits, and whether a full ledger fetch needs pagination or a
 *    nightly job rather than a request/response cycle
 *  - refresh token rotation and lifetime
 */

import type {
  FinancialCapabilities,
  FinancialDataset,
  FinancialSnapshot,
  ProviderId,
} from "./model";

export interface ProviderDescriptor {
  id: ProviderId;
  /** Name as the user knows it. */
  label: string;
  capabilities: FinancialCapabilities;
  /**
   * Shown when a dataset is missing, so the user is told what to enter by
   * hand rather than being left with an empty screen.
   */
  notes?: Partial<Record<FinancialDataset, string>>;
}

export interface ConnectionStatus {
  provider: ProviderId;
  connected: boolean;
  /** ISO timestamp of the last successful fetch. */
  lastSyncAt: string | null;
  /**
   * Set when the connection exists but has stopped working - an expired or
   * revoked token, a withdrawn consent, a changed subscription.
   *
   * This must never be reported as "no data". A company that sees 0 kr in
   * supplier debt because a token expired will draw exactly the wrong
   * conclusion, and it is the sort of wrong conclusion this product exists
   * to prevent.
   */
  error: string | null;
}

export interface FetchOptions {
  /** ISO date. Ledger and open items are fetched from here. */
  from?: string;
  /** ISO date. Defaults to today. */
  to?: string;
  /** Skip datasets the caller does not need, to stay inside rate limits. */
  datasets?: FinancialDataset[];
}

export type FetchResult =
  | { ok: true; snapshot: FinancialSnapshot }
  | { ok: false; error: string; reauthorisationRequired: boolean };

export interface AccountingPort {
  /** Providers this deployment has credentials configured for. */
  listProviders(): Promise<ProviderDescriptor[]>;

  /** URL to send the user to in order to grant access. */
  startAuthorisation(provider: ProviderId, returnTo: string): Promise<string>;

  status(provider: ProviderId): Promise<ConnectionStatus>;

  /**
   * Reads a snapshot. Must fail loudly rather than return an empty snapshot:
   * see the note on ConnectionStatus.error.
   */
  fetchSnapshot(provider: ProviderId, options?: FetchOptions): Promise<FetchResult>;

  /** Previously captured snapshots, newest first. Snapshots are immutable. */
  listSnapshots(caseId: string): Promise<FinancialSnapshot[]>;

  disconnect(provider: ProviderId): Promise<void>;
}

/* -------------------------------------------------------------------------- */
/* Provider registry                                                          */
/* -------------------------------------------------------------------------- */

const caps = (
  on: FinancialDataset[],
): FinancialCapabilities => ({
  chartOfAccounts: on.includes("chartOfAccounts"),
  balanceSheet: on.includes("balanceSheet"),
  incomeStatement: on.includes("incomeStatement"),
  vouchers: on.includes("vouchers"),
  counterparties: on.includes("counterparties"),
  openItems: on.includes("openItems"),
  bankAccounts: on.includes("bankAccounts"),
  taxAccount: on.includes("taxAccount"),
  payroll: on.includes("payroll"),
  costCenters: on.includes("costCenters"),
  projects: on.includes("projects"),
  budget: on.includes("budget"),
});

const NO_TAX_ACCOUNT_NOTE =
  "Skattekontots saldo hos Skatteverket går inte att hämta här. Siffran visar vad bolaget själv har bokfört, vilket ofta skiljer sig från myndighetens. Stäm av mot ditt skattekonto.";

/**
 * What each provider is expected to supply.
 *
 * MARKED AS ASSUMPTION IN FULL. These entries are a planning baseline, not
 * verified capability matrices - vendor APIs change and several of these
 * require a partner agreement before the real surface is even visible. Each
 * row must be confirmed against live documentation when its adapter is
 * written, and the descriptor updated. The interface does not depend on
 * getting them right today; the onboarding copy does.
 */
export const PROVIDER_REGISTRY: ProviderDescriptor[] = [
  {
    id: "fortnox",
    label: "Fortnox",
    capabilities: caps([
      "chartOfAccounts",
      "balanceSheet",
      "incomeStatement",
      "vouchers",
      "counterparties",
      "openItems",
      "costCenters",
      "projects",
    ]),
    notes: { taxAccount: NO_TAX_ACCOUNT_NOTE },
  },
  {
    id: "visma",
    label: "Visma eEkonomi",
    capabilities: caps([
      "chartOfAccounts",
      "balanceSheet",
      "incomeStatement",
      "vouchers",
      "counterparties",
      "openItems",
      "costCenters",
      "projects",
    ]),
    notes: { taxAccount: NO_TAX_ACCOUNT_NOTE },
  },
  {
    id: "bjornlunden",
    label: "Björn Lundén",
    capabilities: caps([
      "chartOfAccounts",
      "balanceSheet",
      "incomeStatement",
      "vouchers",
      "counterparties",
      "openItems",
    ]),
    notes: { taxAccount: NO_TAX_ACCOUNT_NOTE },
  },
  {
    id: "bokio",
    label: "Bokio",
    capabilities: caps([
      "chartOfAccounts",
      "balanceSheet",
      "incomeStatement",
      "vouchers",
      "openItems",
    ]),
    notes: {
      taxAccount: NO_TAX_ACCOUNT_NOTE,
      counterparties: "Motpartsregister kan behöva kompletteras för hand.",
    },
  },
  {
    id: "peaccounting",
    label: "PE Accounting",
    capabilities: caps([
      "chartOfAccounts",
      "balanceSheet",
      "incomeStatement",
      "vouchers",
      "counterparties",
      "openItems",
      "payroll",
      "costCenters",
      "projects",
    ]),
    notes: { taxAccount: NO_TAX_ACCOUNT_NOTE },
  },
  {
    id: "businesscentral",
    label: "Microsoft Dynamics 365 Business Central",
    capabilities: caps([
      "chartOfAccounts",
      "balanceSheet",
      "incomeStatement",
      "vouchers",
      "counterparties",
      "openItems",
      "bankAccounts",
      "costCenters",
      "projects",
      "budget",
    ]),
    notes: { taxAccount: NO_TAX_ACCOUNT_NOTE },
  },
];

/** Datasets the user must supply by hand for a given provider. */
export const manualDatasets = (
  descriptor: ProviderDescriptor,
  required: FinancialDataset[],
): FinancialDataset[] =>
  required.filter((dataset) => !descriptor.capabilities[dataset]);
