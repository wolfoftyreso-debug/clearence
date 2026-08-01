/**
 * The shape of a CLEARANCE report.
 *
 * Reports are described as data, not assembled as HTML at each call site.
 * That keeps every report in the product looking like the same document,
 * makes the rendering testable without a browser, and means a change to the
 * document design happens in one file rather than four.
 */

export type Tone = "neutral" | "good" | "warning" | "critical";

export interface ReportMeta {
  /** What this document is, e.g. "Krisanalys". */
  documentTitle: string;
  companyName: string | null;
  orgNumber: string | null;
  /** Case or plan reference, printed so a reader can cite the document. */
  reference: string | null;
  /** ISO timestamp. */
  generatedAt: string;
}

export interface KeyValue {
  label: string;
  value: string;
  tone?: Tone;
  /** Smaller line under the value. */
  note?: string;
}

export interface TableColumn {
  label: string;
  align?: "left" | "right";
  /** Renders with tabular figures so columns of money line up. */
  numeric?: boolean;
}

export interface TableRow {
  cells: string[];
  tone?: Tone;
}

export interface ListItem {
  text: string;
  /** Deadline, legal reference or similar. */
  note?: string;
  emphasis?: boolean;
}

export type ReportBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "keyValues"; items: KeyValue[] }
  | {
      kind: "table";
      columns: TableColumn[];
      rows: TableRow[];
      /** Rendered as a bold summary row under the rule. */
      totals?: string[];
      /** Shown instead of the table when there are no rows. */
      emptyText?: string;
    }
  | { kind: "list"; ordered?: boolean; items: ListItem[] }
  | { kind: "callout"; tone: Tone; title: string; body: string; legalRef?: string }
  | { kind: "figures"; items: { value: string; label: string; note?: string; tone?: Tone }[] };

export interface ReportSection {
  title: string;
  intro?: string;
  blocks: ReportBlock[];
}

export interface ReportModel {
  meta: ReportMeta;
  /** Blocks above the first section heading - the reader's summary. */
  lead: ReportBlock[];
  sections: ReportSection[];
  /**
   * Printed in full at the end of every report. Required, not optional: a
   * document that leaves the building has to carry it.
   */
  disclaimer: string;
}
