/**
 * Turns each of the product's analyses into a ReportModel.
 *
 * Pure functions, so what a report says can be tested without rendering it.
 * They deliberately restate the caveats that are visible on screen: a report
 * gets emailed on and read by someone who never saw the interface, so it has
 * to carry its own context.
 */

import type { CrisisAnalysis } from "../crisisAnalysis";
import type { LiquidityPlan, ProjectionResult } from "../liquidityPlan";
import { EMPLOYER_CONTRIBUTION_RATE } from "../officialFigures";
import type { ReportBlock, ReportModel, Tone } from "./types";

const sek = (value: number): string => `${Math.round(value).toLocaleString("sv-SE")} kr`;

const swedishDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });
};

const SHARED_DISCLAIMER =
  "CLEARANCE tillhandahåller administrativt stöd och allmän information, inte juridisk rådgivning. " +
  "Innehållet bygger helt på de uppgifter användaren själv har lämnat och har inte stämts av mot " +
  "bokföring, register eller någon annan källa. Rapporten ersätter inte juridisk, ekonomisk eller " +
  "skatterättslig rådgivning och bör stämmas av med en behörig rådgivare innan beslut fattas.";

const severityTone = (severity: string): Tone =>
  severity === "critical" ? "critical" : severity === "warning" ? "warning" : "neutral";

/* -------------------------------------------------------------------------- */
/* Crisis analysis                                                            */
/* -------------------------------------------------------------------------- */

export interface CrisisReportInput {
  analysis: CrisisAnalysis;
  companyName: string | null;
  orgNumber: string | null;
  reference: string | null;
  employees: string | null;
  totalDebt: number;
  quickLiquidationValue: number;
  generatedAt: string;
}

const verdictTone = (type: CrisisAnalysis["type"]): Tone =>
  type === "bankruptcy" ? "critical" : type === "reconstruction" ? "warning" : "good";

export const buildCrisisReport = (input: CrisisReportInput): ReportModel => {
  const { analysis } = input;

  const lead: ReportBlock[] = [
    {
      kind: "callout",
      tone: verdictTone(analysis.type),
      title: analysis.title,
      body: analysis.description,
    },
  ];

  const sections: ReportModel["sections"] = [];

  if (analysis.reasons.length > 0) {
    sections.push({
      title: "Vad bedömningen bygger på",
      blocks: [{ kind: "list", items: analysis.reasons.map((text) => ({ text })) }],
    });
  }

  sections.push({
    title: "Ekonomisk ställning",
    blocks: [
      {
        kind: "figures",
        items: [
          { value: sek(input.totalDebt), label: "Totala skulder" },
          { value: sek(input.quickLiquidationValue), label: "Snabbt avyttringsvärde" },
          {
            value:
              analysis.coverage.ratio === null
                ? "–"
                : `${Math.round(analysis.coverage.ratio * 100)} %`,
            label: "Täckningsgrad",
            note: "Avyttringsvärde delat med skulder",
            tone:
              analysis.coverage.ratio === null
                ? "neutral"
                : analysis.coverage.ratio < 0.5
                  ? "critical"
                  : "warning",
          },
        ],
      },
      { kind: "paragraph", text: analysis.coverage.explanation },
      { kind: "paragraph", text: analysis.solvency.explanation },
    ],
  });

  if (analysis.timeline.length > 0) {
    sections.push({
      title: "Tidslinje",
      intro: "Datumen kommer från de förfallodagar som angetts.",
      blocks: [
        {
          kind: "table",
          columns: [
            { label: "Datum" },
            { label: "Händelse" },
            { label: "Belopp", align: "right", numeric: true },
          ],
          rows: analysis.timeline.map((event) => ({
            tone: severityTone(event.severity),
            cells: [
              `${swedishDate(event.iso)} (om ${event.daysAway} d)`,
              event.note ? `${event.label} – ${event.note}` : event.label,
              event.amount === null ? "–" : sek(event.amount),
            ],
          })),
        },
      ],
    });
  }

  if (analysis.riskFlags.length > 0) {
    sections.push({
      title: "Risker att känna till",
      blocks: analysis.riskFlags.map((flag) => ({
        kind: "callout" as const,
        tone: severityTone(flag.severity),
        title: flag.title,
        body: flag.body,
        legalRef: flag.legalRef,
      })),
    });
  }

  if (analysis.nextSteps.length > 0) {
    sections.push({
      title: "Nästa steg",
      blocks: [
        {
          kind: "list",
          ordered: true,
          items: analysis.nextSteps.map((step) => ({
            text: step.text,
            note: step.deadline,
            emphasis: step.urgent,
          })),
        },
      ],
    });
  }

  return {
    meta: {
      documentTitle: "Krisanalys",
      companyName: input.companyName,
      orgNumber: input.orgNumber,
      reference: input.reference,
      generatedAt: input.generatedAt,
    },
    lead,
    sections,
    disclaimer: SHARED_DISCLAIMER,
  };
};

/* -------------------------------------------------------------------------- */
/* Control balance sheet assessment                                           */
/* -------------------------------------------------------------------------- */

export interface KbrReportInput {
  status: "not_required" | "warning" | "required" | "critical";
  message: string;
  shareCapital: number;
  totalAssets: number;
  totalLiabilities: number;
  equity: number;
  /** Half the registered share capital - the threshold in ABL 25:13. */
  threshold: number;
  companyName: string | null;
  orgNumber: string | null;
  reference: string | null;
  actions: string[];
  generatedAt: string;
}

const kbrTone = (status: KbrReportInput["status"]): Tone =>
  status === "not_required" ? "good" : status === "warning" ? "warning" : "critical";

export const buildKbrReport = (input: KbrReportInput): ReportModel => ({
  meta: {
    documentTitle: "Bedömning av kontrollbalansräkning",
    companyName: input.companyName,
    orgNumber: input.orgNumber,
    reference: input.reference,
    generatedAt: input.generatedAt,
  },
  lead: [
    {
      kind: "callout",
      tone: kbrTone(input.status),
      title:
        input.status === "not_required"
          ? "Kontrollbalansräkning krävs inte utifrån dessa siffror"
          : input.status === "warning"
            ? "Eget kapital närmar sig gränsen"
            : "Kontrollbalansräkning krävs",
      body: input.message,
      legalRef: "Aktiebolagslagen (2005:551) 25 kap. 13 §",
    },
    {
      kind: "paragraph",
      text:
        "Detta är en beräkning, inte en kontrollbalansräkning. Själva handlingen ska upprättas " +
        "enligt särskilda värderingsregler, skrivas under av hela styrelsen och granskas av " +
        "revisorn om bolaget har en.",
    },
  ],
  sections: [
    {
      title: "Underlag",
      blocks: [
        {
          kind: "keyValues",
          items: [
            { label: "Registrerat aktiekapital", value: sek(input.shareCapital) },
            { label: "Totala tillgångar", value: sek(input.totalAssets) },
            { label: "Totala skulder", value: sek(input.totalLiabilities) },
            {
              label: "Eget kapital",
              value: sek(input.equity),
              tone: input.equity < 0 ? "critical" : input.equity < input.threshold ? "warning" : "good",
              note: "Tillgångar minus skulder",
            },
            {
              label: "Halva aktiekapitalet",
              value: sek(input.threshold),
              note: "Gränsen i ABL 25 kap. 13 §",
            },
          ],
        },
      ],
    },
    {
      title: "Åtgärder",
      blocks: [
        input.actions.length > 0
          ? { kind: "list", ordered: true, items: input.actions.map((text) => ({ text })) }
          : { kind: "paragraph", text: "Inga särskilda åtgärder föreslås utifrån dessa siffror." },
      ],
    },
  ],
  disclaimer: SHARED_DISCLAIMER,
});

/* -------------------------------------------------------------------------- */
/* Liquidity plan                                                             */
/* -------------------------------------------------------------------------- */

export interface LiquidityReportInput {
  plan: LiquidityPlan;
  projection: ProjectionResult;
  horizonDays: number;
  companyName: string | null;
  orgNumber: string | null;
  reference: string | null;
  employerFeeApplied: boolean;
  generatedAt: string;
}

export const buildLiquidityReport = (input: LiquidityReportInput): ReportModel => {
  const { plan, projection } = input;

  const runsOut = projection.daysUntilNegative !== null;

  const lead: ReportBlock[] = [
    {
      kind: "figures",
      items: [
        { value: sek(plan.openingBalance), label: "Kassa vid start" },
        {
          value: runsOut ? `${projection.daysUntilNegative} dagar` : `${input.horizonDays}+ dagar`,
          label: "Pengarna räcker",
          note: projection.dateOfShortfall
            ? `Slut ${swedishDate(projection.dateOfShortfall)}`
            : `Inom prognosens ${input.horizonDays} dagar`,
          tone: runsOut ? "critical" : "good",
        },
        {
          value: sek(projection.lowestBalance),
          label: "Lägsta saldo",
          tone: projection.lowestBalance < 0 ? "critical" : "neutral",
        },
        {
          value: sek(projection.closingBalance),
          label: `Saldo efter ${input.horizonDays} dagar`,
          tone: projection.closingBalance < 0 ? "critical" : "neutral",
        },
      ],
    },
  ];

  const inflowRows = plan.inflows.map((item) => ({
    cells: [
      item.label,
      item.recurring ? `Varje månad, den ${item.dayOfMonth}:e` : swedishDate(item.date),
      sek(item.amount),
    ],
  }));

  const outflowRows = plan.outflows.map((item) => ({
    cells: [
      item.label,
      item.recurring ? `Varje månad, den ${item.dayOfMonth}:e` : swedishDate(item.date),
      sek(item.amount),
    ],
  }));

  const sections: ReportModel["sections"] = [
    {
      title: "Pengar in",
      blocks: [
        {
          kind: "table",
          columns: [
            { label: "Post" },
            { label: "När" },
            { label: "Belopp", align: "right", numeric: true },
          ],
          rows: inflowRows,
          totals: ["Summa in under perioden", "", sek(projection.totalInflow)],
          emptyText: "Inga inbetalningar angivna.",
        },
      ],
    },
    {
      title: "Pengar ut",
      intro: input.employerFeeApplied
        ? `Arbetsgivaravgift på ${(EMPLOYER_CONTRIBUTION_RATE * 100)
            .toFixed(2)
            .replace(".", ",")} % är inräknad i de löner som angetts som bruttolön.`
        : undefined,
      blocks: [
        {
          kind: "table",
          columns: [
            { label: "Post" },
            { label: "När" },
            { label: "Belopp", align: "right", numeric: true },
          ],
          rows: outflowRows,
          totals: ["Summa ut under perioden", "", sek(projection.totalOutflow)],
          emptyText: "Inga utbetalningar angivna.",
        },
      ],
    },
  ];

  // Only the days where something actually happens; a 90-row table of
  // unchanged balances is not a report anyone reads.
  const eventDays = projection.days.filter((day) => day.events.length > 0);
  if (eventDays.length > 0) {
    sections.push({
      title: "Dag för dag",
      intro: "Endast dagar med en händelse visas.",
      blocks: [
        {
          kind: "table",
          columns: [
            { label: "Datum" },
            { label: "Händelse" },
            { label: "Belopp", align: "right", numeric: true },
            { label: "Saldo efter", align: "right", numeric: true },
          ],
          rows: eventDays.flatMap((day) =>
            day.events.map((event, index) => ({
              tone: (day.balance < 0 ? "critical" : "neutral") as Tone,
              cells: [
                index === 0 ? swedishDate(day.iso) : "",
                event.label,
                `${event.direction === "in" ? "+" : "−"}${sek(event.amount)}`,
                index === day.events.length - 1 ? sek(day.balance) : "",
              ],
            })),
          ),
        },
      ],
    });
  }

  return {
    meta: {
      documentTitle: "Likviditetsplan",
      companyName: input.companyName,
      orgNumber: input.orgNumber,
      reference: input.reference,
      generatedAt: input.generatedAt,
    },
    lead,
    sections,
    disclaimer:
      SHARED_DISCLAIMER +
      " Prognosen antar att angivna belopp betalas på angivna datum och tar inte hänsyn till " +
      "outnyttjade krediter, säsongsvariation eller händelser som inte matats in.",
  };
};
