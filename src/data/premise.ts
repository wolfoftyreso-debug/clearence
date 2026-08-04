/**
 * Gränskontrollen för det mätbara premissvillkoret.
 *
 * Databasen lagrar signal och jämförelse som text - den kan inte annat,
 * eftersom villkoren ska gå att utöka utan en migrering per storhet.
 * Domänen har däremot en sluten uppräkning, och skillnaden däremellan är
 * precis där ett påhittat värde skulle kunna smita in.
 *
 * Regeln är densamma som i läsningen av besluten: hellre "bevakas ej" än
 * ett villkor vi inte kan räkna på. Känner vi inte igen signalen eller
 * jämförelsen faller hela villkoret bort - halva villkoret är inget
 * villkor.
 */

import type { PremiseComparator, PremiseSignal, PremiseWatch } from "./types";

const SIGNALS: readonly PremiseSignal[] = [
  "loner",
  "skatt",
  "skuldtackning",
  "passerade_frister",
  "hyra",
  "leverantorer",
  "skuld",
];

const COMPARATORS: readonly PremiseComparator[] = ["minst", "hogst", "sant", "falskt"];

const isSignal = (v: unknown): v is PremiseSignal =>
  typeof v === "string" && (SIGNALS as readonly string[]).includes(v);

const isComparator = (v: unknown): v is PremiseComparator =>
  typeof v === "string" && (COMPARATORS as readonly string[]).includes(v);

/**
 * Gör om tre lagrade fält till ett villkor - eller till null.
 *
 * Tröskeln kommer ur en numeric-kolumn, och drivrutinen kan lämna den
 * som sträng. Den tvättas därför här och inte hos varje anropare.
 */
export const parsePremiseWatch = (
  signal: unknown,
  comparator: unknown,
  threshold: unknown,
): PremiseWatch | null => {
  if (!isSignal(signal) || !isComparator(comparator)) return null;
  const numeric = threshold === null || threshold === undefined ? null : Number(threshold);
  return {
    signal,
    comparator,
    threshold: numeric === null || Number.isNaN(numeric) ? null : numeric,
  };
};
