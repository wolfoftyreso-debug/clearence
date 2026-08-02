/**
 * Händelseloggens läsbarhet: detaljraden och systemsammanfattningen.
 *
 * "Uppgift i handlingsplanen skapades" utan att säga VILKEN uppgift är en
 * logg som ser ut som underlag men inte duger som det. Detaljraden härleds
 * ur radens before/after-innehåll - uppgiftens text, dokumentets filnamn,
 * deltagarens roll - så att loggen går att läsa som ett förlopp, inte bara
 * som en räkning.
 *
 * Systemsammanfattningen överst är samma mönster som övriga analyser:
 * deterministisk, testbar mening för mening. Den svarar på frågorna en
 * läsare (styrelsen, revisorn, en förvaltare) ställer först: vilken period
 * täcker loggen, hur mycket har hänt, vilka juridiska milstolpar är
 * dokumenterade, och när hände något senast.
 */

import { CASE_ROLE_LABELS, type CaseRole } from "@/lib/caseRoles";
import type { AuditEventRecord } from "@/data/types";

type Payload = Record<string, unknown> | null;

const str = (payload: Payload, key: string): string | null => {
  const value = payload?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};

/**
 * Detaljraden: vad exakt händelsen gällde. null när innehållet inte bär
 * något läsbart - hellre ingen rad än en rad som gissar.
 */
export const deriveAuditDetail = (
  objectType: string,
  action: string,
  before: Payload,
  after: Payload,
): string | null => {
  const row = after ?? before;
  if (!row) return null;

  switch (objectType) {
    case "case_tasks": {
      const label = str(row, "label");
      if (!label) return null;
      if (action === "update") {
        const doneNow = (after?.done_at ?? null) !== null;
        const doneBefore = (before?.done_at ?? null) !== null;
        if (doneNow && !doneBefore) return `"${label}" bockades av`;
        if (!doneNow && doneBefore) return `"${label}" återöppnades`;
      }
      return `"${label}"`;
    }
    case "case_documents": {
      const name = str(row, "file_name");
      const note = str(row, "note");
      return name ? (note ? `${name} (${note.toLowerCase()})` : name) : null;
    }
    case "case_invitations": {
      const email = str(row, "email");
      const role = str(row, "role") as CaseRole | null;
      const roleLabel = role ? CASE_ROLE_LABELS[role]?.toLowerCase() : null;
      if (!email) return null;
      if (action === "update") {
        if ((after?.accepted_at ?? null) !== null && (before?.accepted_at ?? null) === null)
          return `${email} tackade ja`;
        if ((after?.revoked_at ?? null) !== null && (before?.revoked_at ?? null) === null)
          return `inbjudan till ${email} återkallades`;
        if ((after?.email_enqueued_at ?? null) !== null && (before?.email_enqueued_at ?? null) === null)
          return `inbjudningsmejlet till ${email} skickades`;
      }
      return roleLabel ? `${email} som ${roleLabel}` : email;
    }
    case "case_members": {
      const role = str(row, "role") as CaseRole | null;
      const roleLabel = role ? CASE_ROLE_LABELS[role] : null;
      if (action === "update" && (after?.revoked_at ?? null) !== null)
        return roleLabel ? `${roleLabel.toLowerCase()}ens åtkomst återkallades` : "åtkomst återkallades";
      return roleLabel ? `roll: ${roleLabel.toLowerCase()}` : null;
    }
    case "conversations": {
      const title = str(row, "title");
      const kind = str(row, "kind");
      if ((after?.merged_into ?? null) !== null && (before?.merged_into ?? null) === null)
        return title ? `"${title}" slogs ihop med en annan tråd` : "tråden slogs ihop";
      if (title) return `gruppen "${title}"`;
      return kind === "direct" ? "direkt tråd" : null;
    }
    case "kbr_assessments": {
      const status = str(row, "status");
      const statusLabel: Record<string, string> = {
        not_required: "ej påkallad",
        warning: "varningszon",
        required: "krävs",
        critical: "kritisk",
      };
      return status ? `bedömning: ${statusLabel[status] ?? status}` : null;
    }
    case "payments": {
      const label = str(row, "label");
      const amount = row?.["amount"];
      const kr =
        typeof amount === "number"
          ? `${String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`
          : null;
      if (label && kr) return `${label}, ${kr}`;
      return label ?? kr;
    }
    case "invoices": {
      const label = str(row, "description") ?? str(row, "label");
      return label;
    }
    case "cases": {
      const company = str(row, "company_name");
      const org = str(row, "org_number");
      return company ? `${company}${org ? ` (${org})` : ""}` : org;
    }
    default:
      return null;
  }
};

/** Systemsammanfattningens rader, i läsordning. */
export const summarizeAuditTrail = (events: AuditEventRecord[], now: Date): string[] => {
  if (events.length === 0) return ["Inga händelser är loggade ännu."];

  const lines: string[] = [];
  const byTime = [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const first = byTime[0];
  const last = byTime[byTime.length - 1];

  const day = (iso: string) =>
    new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });

  lines.push(
    first.occurredAt.slice(0, 10) === last.occurredAt.slice(0, 10)
      ? `Loggen omfattar ${events.length} händelser, samtliga den ${day(first.occurredAt)}.`
      : `Loggen omfattar ${events.length} händelser mellan ${day(first.occurredAt)} och ${day(last.occurredAt)}.`,
  );

  // Volym per område, i fallande ordning.
  const CATEGORY: Record<string, string> = {
    case_tasks: "uppgifter",
    case_documents: "dokument",
    case_members: "deltagare",
    case_invitations: "inbjudningar",
    case_messages: "meddelanden",
    conversations: "trådar",
    kbr_assessments: "kontrollbalans",
    payments: "betalningar",
    invoices: "fakturor",
    cases: "ärendet",
  };
  const counts = new Map<string, number>();
  for (const e of events) {
    const label = CATEGORY[e.objectType] ?? e.objectType;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const breakdown = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, n]) => `${n} ${label}`)
    .join(", ");
  lines.push(`Fördelning: ${breakdown}.`);

  // Juridiska milstolpar - det en granskare letar efter först.
  const milestones: string[] = [];
  if (events.some((e) => e.objectType === "kbr_assessments"))
    milestones.push("kontrollbalansbedömning är registrerad");
  if (events.some((e) => e.objectType === "case_documents" && e.detail?.includes("genererad mall")))
    milestones.push("styrelsebeslut är protokollfört och sparat i akten");
  if (events.some((e) => e.objectType === "case_invitations"))
    milestones.push("deltagare har bjudits in till ärendet");
  if (milestones.length > 0) {
    lines.push(
      `Dokumenterade milstolpar: ${milestones.join("; ")}.`,
    );
  } else {
    lines.push(
      "Inga juridiska milstolpar är dokumenterade ännu – kontrollbalansbedömningen och protokollförda beslut syns här när de görs.",
    );
  }

  // Vem har agerat.
  const roles = new Map<string, number>();
  for (const e of events) {
    if (!e.actorRole) continue;
    const label = CASE_ROLE_LABELS[e.actorRole] ?? e.actorRole;
    roles.set(label, (roles.get(label) ?? 0) + 1);
  }
  if (roles.size > 0) {
    lines.push(
      `Aktivitet per roll: ${[...roles.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([label, n]) => `${label.toLowerCase()} ${n}`)
        .join(", ")}.`,
    );
  }

  // Senaste aktivitet, relativt.
  const daysSince = Math.floor(
    (now.getTime() - new Date(last.occurredAt).getTime()) / (24 * 60 * 60 * 1000),
  );
  lines.push(
    daysSince <= 0
      ? "Senaste händelsen loggades idag."
      : daysSince === 1
        ? "Senaste händelsen loggades igår."
        : `Senaste händelsen loggades för ${daysSince} dagar sedan.`,
  );

  return lines;
};
