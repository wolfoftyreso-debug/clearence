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
import { beloppUrText } from "@/lib/belopp";

/**
 * Beloppet ur ett fritextfält.
 *
 * DEN HÄR FUNKTIONEN HADE EN EGEN TOLKNING, och den var fel: den strök
 * allt utom siffror. "180000,50" blev då 18 000 050 - hundra gånger för
 * mycket - och "-500 000" blev en verklig skuld på 500 000. Samma sparade
 * sträng gav ett annat belopp i kontrollbalansräkningen, som hade sin egen
 * tolk. Reglerna bor numera på ETT ställe; se src/lib/belopp.ts.
 *
 * Namnet står kvar eftersom hela ärendelagret anropar det.
 */
export const parseAmount = (value: string | null): number => beloppUrText(value);

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
