/**
 * Bron mellan ett sparat ärende och krisanalysen.
 *
 * Fanns tidigare som lokala hjälpare i Dashboard - men praktikervyn räknar
 * på många ärenden samtidigt, och två ställen som tolkar samma ärende var
 * för sig är två ställen som kan säga olika saker om samma bolag. En
 * tolkning, delad.
 */

import { analyseCrisis, type AnalysisInput, type TimelineEvent } from "@/lib/crisisAnalysis";
import type { CaseRecord } from "@/data/types";

/** "1 200 000", "1,2 mkr"-fritt: siffrorna ur ett beloppsfält, annars 0. */
export const parseAmount = (value: string | null): number => {
  if (!value) return 0;
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
};

export const analysisInputFromCase = (record: CaseRecord): AnalysisInput => ({
  canPaySalary: record.canPaySalary,
  canPayTax: record.canPayTax,
  canPayRent: record.canPayRent,
  canPaySuppliers: record.canPaySuppliers,
  salaryAmount: parseAmount(record.salaryAmount),
  salaryDay: record.salaryDay ?? 25,
  taxAmount: parseAmount(record.taxAmount),
  taxDay: record.taxDay ?? 12,
  rentAmount: parseAmount(record.rentAmount),
  rentDay: record.rentDay ?? 1,
  totalDebt: parseAmount(record.totalDebt),
  quickLiquidationValue: parseAmount(record.quickLiquidationValue),
  employees: record.employees ?? "",
});

export const timelineForCase = (record: CaseRecord): TimelineEvent[] =>
  analyseCrisis(analysisInputFromCase(record)).timeline;

export const slugName = (record: CaseRecord): string =>
  (record.companyName ?? record.orgNumber).toLowerCase().replace(/[^a-z0-9åäö]+/gi, "-");
