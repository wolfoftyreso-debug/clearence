import type { TimeEntryRecord } from "@/data/types";
import type { ReportModel, TableRow } from "./types";

/**
 * Fakturaunderlaget ur tidsposterna: byråns loggade tid i ett ärende som
 * ett strukturerat underlag för byråns EGEN fakturering.
 *
 * Viktig gräns: detta är ett underlag, inte en faktura. CLEARANCE ställer
 * inte ut byråns kundfakturor och sätter inte byråns priser - timpriset
 * och momssatsen är byråns egna inmatningar, aldrig plattformens
 * parametrar. Därför skrivs de ut i dokumentet: en granskare ska kunna se
 * exakt vilka antaganden beloppen bygger på.
 */

export interface TimeBasisInput {
  companyName: string | null;
  orgNumber: string | null;
  caseId: string;
  /** Byråns namn, som avsändare på underlaget. */
  firmName: string | null;
  entries: TimeEntryRecord[];
  /** Byråns eget timpris i kronor. */
  hourlyRateSek: number;
  /** Momssats i procent, t.ex. 25. Byråns egen uppgift. */
  vatRatePercent: number;
  generatedAt: string;
}

const kr = (value: number): string =>
  `${Math.round(value).toLocaleString("sv-SE")} kr`;

const hours = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
};

const svDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });

export const buildTimeBasisReport = (input: TimeBasisInput): ReportModel => {
  const entries = [...input.entries].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));
  const totalMinutes = entries.reduce((sum, e) => sum + e.minutes, 0);
  const net = (totalMinutes / 60) * input.hourlyRateSek;
  const vat = net * (input.vatRatePercent / 100);

  const rows: TableRow[] = entries.map((e) => ({
    cells: [
      svDate(e.occurredOn),
      e.note ?? "Arbete i ärendet",
      hours(e.minutes),
      kr((e.minutes / 60) * input.hourlyRateSek),
    ],
  }));

  return {
    meta: {
      documentTitle: "Fakturaunderlag – nedlagd tid",
      companyName: input.companyName,
      orgNumber: input.orgNumber,
      reference: input.caseId,
      generatedAt: input.generatedAt,
    },
    lead: [
      {
        kind: "paragraph",
        text: `Nedlagd tid i ärendet${input.firmName ? `, registrerad av ${input.firmName}` : ""}. Underlaget är byråns eget faktureringsunderlag – fakturan ställs ut av byrån, i byråns eget system.`,
      },
      {
        kind: "figures",
        items: [
          { value: hours(totalMinutes), label: "Total tid" },
          { value: kr(net), label: "Belopp exkl. moms" },
          { value: kr(net + vat), label: `Inkl. moms ${input.vatRatePercent} %` },
        ],
      },
    ],
    sections: [
      {
        title: "Specifikation",
        blocks: [
          {
            kind: "table",
            columns: [
              { label: "Datum" },
              { label: "Arbete" },
              { label: "Tid", align: "right", numeric: true },
              { label: "Belopp", align: "right", numeric: true },
            ],
            rows,
            totals: ["", "Summa", hours(totalMinutes), kr(net)],
            emptyText: "Inga tidsposter i ärendet.",
          },
          {
            kind: "keyValues",
            items: [
              { label: "Timpris (byråns egen uppgift)", value: `${input.hourlyRateSek.toLocaleString("sv-SE")} kr/h` },
              { label: "Belopp exkl. moms", value: kr(net) },
              { label: `Moms ${input.vatRatePercent} %`, value: kr(vat) },
              { label: "Att fakturera inkl. moms", value: kr(net + vat) },
            ],
          },
        ],
      },
    ],
    disclaimer:
      "Detta är ett underlag för byråns egen fakturering, inte en faktura. Timpris och momssats är byråns egna uppgifter och har inte kontrollerats av CLEARANCE. Beloppen är beräknade ur registrerade tidsposter vid genereringstillfället.",
  };
};
