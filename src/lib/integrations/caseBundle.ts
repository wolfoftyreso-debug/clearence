/**
 * Aktexport: hela ärendet som ett strukturerat paket, och fristerna som
 * kalenderfil.
 *
 * Det här är kopplingen mot advokatbyråsystem - byggd som export i stället
 * för som API-integration, av ett skäl som är värt att stå för: en byrå ska
 * kunna ta emot akten OAVSETT vilket system den kör, och företaget ska
 * kunna lämna plattformen med allt sitt material. Ett format alla kan läsa
 * slår tio partneravtal, och samma paket är dessutom dataexporten som gör
 * "svarta lådan" i visionen verklig.
 *
 * Två delar:
 *
 *  - `buildCaseBundle`: JSON-manifest med ärendet, ekonomin, fristerna,
 *    dokumentlistan och korrespondensen. Själva filerna följer inte med i
 *    manifestet (de hämtas via sina signerade URL:er); manifestet är
 *    innehållsförteckningen med filnamn och storlek, så att en mottagare
 *    kan kontrollera att akten är komplett.
 *
 *  - `timelineToIcs`: fristerna som iCalendar. Outlook, Google Calendar och
 *    varje advokatsystem med kalender kan importera .ics - en missad frist
 *    är den dyraste händelsen i hela processen, och det här flyttar
 *    bevakningen till system byrån redan tittar i varje dag.
 */

import type { CaseRecord, CaseMessage, DocumentRecord, PaymentRecord } from "@/data/types";
import type { TimelineEvent } from "../crisisAnalysis";

/** Versionsmärkt: en mottagare ska kunna avvisa ett format den inte kan läsa. */
export const BUNDLE_FORMAT_VERSION = 1;

export interface CaseBundle {
  format: "clearance-akt";
  formatVersion: number;
  exportedAt: string;
  case: {
    id: string;
    orgNumber: string;
    companyName: string | null;
    employees: string | null;
    totalDebt: string | null;
    recommendation: {
      type: CaseRecord["recommendationType"];
      title: string | null;
      reasons: string[];
      nextSteps: string[];
    };
    createdAt: string;
  };
  deadlines: {
    date: string;
    label: string;
    amount: number | null;
    severity: string;
    note: string | null;
  }[];
  payments: {
    label: string;
    amount: number;
    category: string;
    status: string;
    dueDate: string;
  }[];
  documents: {
    fileName: string;
    kind: string;
    fileSize: number;
    uploadedAt: string;
    note: string | null;
  }[];
  correspondence: {
    at: string;
    /** "company" eller "counterpart" - aldrig namn eller id. Manifest kan
     *  vidarebefordras, och vem som skrev vad i klartext hör till ärendet,
     *  inte till innehållsförteckningen. */
    author: "company" | "counterpart";
    body: string;
  }[];
}

export const buildCaseBundle = (input: {
  caseRecord: CaseRecord;
  timeline: TimelineEvent[];
  payments: PaymentRecord[];
  documents: DocumentRecord[];
  messages: CaseMessage[];
  /** Ärendets ägare, för author-klassningen i korrespondensen. */
  ownerUserId: string | null;
  exportedAt: string;
}): CaseBundle => ({
  format: "clearance-akt",
  formatVersion: BUNDLE_FORMAT_VERSION,
  exportedAt: input.exportedAt,
  case: {
    id: input.caseRecord.id,
    orgNumber: input.caseRecord.orgNumber,
    companyName: input.caseRecord.companyName,
    employees: input.caseRecord.employees,
    totalDebt: input.caseRecord.totalDebt,
    recommendation: {
      type: input.caseRecord.recommendationType,
      title: input.caseRecord.recommendationTitle,
      reasons: input.caseRecord.recommendationReasons,
      nextSteps: input.caseRecord.recommendationNextSteps,
    },
    createdAt: input.caseRecord.createdAt,
  },
  deadlines: input.timeline.map((event) => ({
    date: event.iso,
    label: event.label,
    amount: event.amount,
    severity: event.severity,
    note: event.note ?? null,
  })),
  payments: input.payments.map((p) => ({
    label: p.label,
    amount: p.amount,
    category: p.category,
    status: p.status,
    dueDate: p.dueDate,
  })),
  documents: input.documents.map((d) => ({
    fileName: d.fileName,
    kind: d.kind,
    fileSize: d.fileSize,
    uploadedAt: d.createdAt,
    note: d.note,
  })),
  correspondence: input.messages.map((m) => ({
    at: m.createdAt,
    author: m.authorUserId === input.ownerUserId ? "company" : "counterpart",
    body: m.body,
  })),
});

/* -------------------------------------------------------------------------- */
/* iCalendar                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * RFC 5545 kräver escapning av semikolon, komma och radbrytning i textfält.
 * Utan den blir "Skatt; personligt ansvar" två halva fält hos mottagaren.
 */
const escapeIcsText = (value: string): string =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

/**
 * Radvikning enligt RFC 5545: rader över 75 oktetter viks med CRLF + space.
 * Vissa kalenderklienter kastar annars hela komponenten.
 */
const foldIcsLine = (line: string): string => {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const char of line) {
    const charBytes = new TextEncoder().encode(char).length;
    const limit = parts.length === 0 ? 75 : 74; // fortsättningsrader börjar med space
    if (currentBytes + charBytes > limit) {
      parts.push(current);
      current = char;
      currentBytes = charBytes;
    } else {
      current += char;
      currentBytes += charBytes;
    }
  }
  if (current) parts.push(current);
  return parts.join("\r\n ");
};

/**
 * Fristerna som heldagshändelser.
 *
 * Heldag med flit: en lagstadgad frist gäller dagen, inte ett klockslag,
 * och en händelse 00:00 ser ut som midnatt i mottagarens kalender. VALARM
 * tre dagar före ger samma varsel som produktens egen varning - de två ska
 * inte säga olika saker.
 */
export const timelineToIcs = (
  events: TimelineEvent[],
  meta: { companyName: string | null; orgNumber: string; generatedAt: string },
): string => {
  const stamp = meta.generatedAt.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Landvex AB//Clearance//SV",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const event of events) {
    const date = event.iso.replace(/-/g, "");
    const who = meta.companyName ?? meta.orgNumber;
    const summary = `${event.label} – ${who}`;
    const description =
      (event.note ? `${event.note}. ` : "") +
      (event.amount !== null ? `Belopp: ${String(Math.round(event.amount)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr. ` : "") +
      "Exporterad från Clearance.";
    lines.push(
      "BEGIN:VEVENT",
      // Deterministiskt UID: samma frist ger samma UID, så en omimport
      // uppdaterar händelsen i stället för att dubblera den.
      `UID:${meta.orgNumber.replace(/\D/g, "")}-${date}-${event.label.replace(/\W/g, "").slice(0, 24)}@clearance`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${date}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      ...(event.severity === "critical" ? ["PRIORITY:1"] : []),
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcsText(`Om tre dagar: ${event.label}`)}`,
      "TRIGGER:-P3D",
      "END:VALARM",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
};
