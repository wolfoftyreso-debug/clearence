import { addDays, format, startOfDay } from "date-fns";
import type { PaymentCategory } from "@/data/types";

export type { PaymentCategory };

/**
 * Re-exported so existing callers keep working; the value and the reasoning
 * behind it live in officialFigures.ts with everything else that changes
 * with the calendar.
 */
import { EMPLOYER_CONTRIBUTION_RATE } from "./officialFigures";

export { EMPLOYER_CONTRIBUTION_RATE };

export interface PlanOutflow {
  id: string;
  label: string;
  amount: number;
  category: PaymentCategory;
  /** Day of month (1-31) when recurring, otherwise ignored. */
  dayOfMonth: number;
  /** ISO date (yyyy-MM-dd) when non-recurring. */
  date: string;
  recurring: boolean;
}

export interface PlanInflow {
  id: string;
  label: string;
  amount: number;
  counterpart: string;
  dayOfMonth: number;
  date: string;
  recurring: boolean;
}

export interface LiquidityPlan {
  openingBalance: number;
  inflows: PlanInflow[];
  outflows: PlanOutflow[];
}

export interface ProjectionDay {
  /** ISO date, yyyy-MM-dd */
  iso: string;
  /** Short human label, e.g. "3 mar" */
  label: string;
  balance: number;
  inflow: number;
  outflow: number;
  events: { label: string; amount: number; direction: "in" | "out" }[];
}

export interface ProjectionResult {
  days: ProjectionDay[];
  /** Days from today until the balance first goes negative, or null. */
  daysUntilNegative: number | null;
  /** ISO date the balance first goes negative, or null. */
  dateOfShortfall: string | null;
  lowestBalance: number;
  closingBalance: number;
  totalInflow: number;
  totalOutflow: number;
}

/**
 * Expands a monthly-recurring item into every date it falls on inside the
 * horizon. A day-of-month past the end of a short month clamps to that
 * month's last day, so "the 31st" still lands once in February.
 */
const recurringDatesInHorizon = (dayOfMonth: number, start: Date, horizonDays: number): string[] => {
  const dates: string[] = [];
  const end = addDays(start, horizonDays);
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);

  while (cursor <= end) {
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const day = Math.min(dayOfMonth, daysInMonth);
    const occurrence = new Date(cursor.getFullYear(), cursor.getMonth(), day);
    if (occurrence >= start && occurrence <= end) {
      dates.push(format(occurrence, "yyyy-MM-dd"));
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return dates;
};

export const projectLiquidity = (plan: LiquidityPlan, horizonDays = 90): ProjectionResult => {
  const today = startOfDay(new Date());

  // Bucket every inflow/outflow occurrence onto its date first, so the
  // day-by-day walk below is a simple accumulation.
  const byDate = new Map<string, ProjectionDay["events"]>();
  const push = (iso: string, event: ProjectionDay["events"][number]) => {
    const existing = byDate.get(iso);
    if (existing) existing.push(event);
    else byDate.set(iso, [event]);
  };

  for (const item of plan.outflows) {
    if (item.amount <= 0) continue;
    const dates = item.recurring
      ? recurringDatesInHorizon(item.dayOfMonth, today, horizonDays)
      : [item.date];
    for (const iso of dates) {
      if (!iso) continue;
      push(iso, { label: item.label, amount: item.amount, direction: "out" });
    }
  }

  for (const item of plan.inflows) {
    if (item.amount <= 0) continue;
    const dates = item.recurring
      ? recurringDatesInHorizon(item.dayOfMonth, today, horizonDays)
      : [item.date];
    for (const iso of dates) {
      if (!iso) continue;
      push(iso, { label: item.label, amount: item.amount, direction: "in" });
    }
  }

  const days: ProjectionDay[] = [];
  let balance = plan.openingBalance;
  let lowestBalance = plan.openingBalance;
  let totalInflow = 0;
  let totalOutflow = 0;
  let daysUntilNegative: number | null = null;
  let dateOfShortfall: string | null = null;

  for (let i = 0; i <= horizonDays; i++) {
    const date = addDays(today, i);
    const iso = format(date, "yyyy-MM-dd");
    const events = byDate.get(iso) ?? [];

    let inflow = 0;
    let outflow = 0;
    for (const event of events) {
      if (event.direction === "in") inflow += event.amount;
      else outflow += event.amount;
    }

    balance += inflow - outflow;
    totalInflow += inflow;
    totalOutflow += outflow;
    if (balance < lowestBalance) lowestBalance = balance;
    if (balance < 0 && daysUntilNegative === null) {
      daysUntilNegative = i;
      dateOfShortfall = iso;
    }

    days.push({
      iso,
      label: format(date, "d MMM"),
      balance: Math.round(balance),
      inflow,
      outflow,
      events,
    });
  }

  return {
    days,
    daysUntilNegative,
    dateOfShortfall,
    lowestBalance: Math.round(lowestBalance),
    closingBalance: Math.round(balance),
    totalInflow,
    totalOutflow,
  };
};

export const employerContribution = (grossSalary: number): number =>
  Math.round(grossSalary * EMPLOYER_CONTRIBUTION_RATE);

export const emptyPlan = (): LiquidityPlan => ({
  openingBalance: 0,
  inflows: [],
  outflows: [],
});
