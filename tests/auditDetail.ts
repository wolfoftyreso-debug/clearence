/**
 * Tester för händelseloggens detaljrader och systemsammanfattning.
 *
 * Detaljraden testas fall för fall: en logg som säger "Uppgift skapades"
 * utan att säga vilken duger inte som underlag. Sammanfattningen testas
 * mening för mening, som övriga analyser.
 */

import { deriveAuditDetail, summarizeAuditTrail } from "../src/lib/auditDetail";
import type { AuditEventRecord } from "../src/data/types";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra = "") => {
  if (ok) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${name} ${extra}`);
  }
};

/* --- detaljraden -------------------------------------------------------------- */
check(
  "uppgift: texten citeras",
  deriveAuditDetail("case_tasks", "insert", null, { label: "Boka möte med revisorn" }) ===
    '"Boka möte med revisorn"',
);
check(
  "uppgift: avbockning berättas",
  deriveAuditDetail(
    "case_tasks",
    "update",
    { label: "Boka möte", done_at: null },
    { label: "Boka möte", done_at: "2026-08-02T10:00:00Z" },
  ) === '"Boka möte" bockades av',
);
check(
  "dokument: filnamn och not",
  deriveAuditDetail("case_documents", "insert", null, {
    file_name: "styrelseprotokoll-kbr.txt",
    note: "Genererad mall: KBR-beslut",
  }) === "styrelseprotokoll-kbr.txt (genererad mall: kbr-beslut)",
);
check(
  "inbjudan: adress och roll",
  deriveAuditDetail("case_invitations", "insert", null, {
    email: "revisor@byran.se",
    role: "auditor",
  }) === "revisor@byran.se som revisor",
);
check(
  "inbjudan: accept berättas",
  deriveAuditDetail(
    "case_invitations",
    "update",
    { email: "revisor@byran.se", accepted_at: null },
    { email: "revisor@byran.se", accepted_at: "2026-08-02T10:00:00Z" },
  ) === "revisor@byran.se tackade ja",
);
check(
  "deltagare: rollen skrivs ut",
  deriveAuditDetail("case_members", "insert", null, { role: "board_member" }) ===
    "roll: styrelseledamot",
);
check(
  "tråd: gruppnamnet citeras",
  deriveAuditDetail("conversations", "insert", null, { kind: "group", title: "Bankfrågor" }) ===
    'gruppen "Bankfrågor"',
);
check(
  "sammanslagning berättas",
  deriveAuditDetail(
    "conversations",
    "update",
    { title: "Bankfrågor", merged_into: null },
    { title: "Bankfrågor", merged_into: "abc" },
  ) === '"Bankfrågor" slogs ihop med en annan tråd',
);
check(
  "KBR: status på svenska",
  deriveAuditDetail("kbr_assessments", "insert", null, { status: "required" }) ===
    "bedömning: krävs",
);
check(
  "betalning: etikett och belopp",
  deriveAuditDetail("payments", "insert", null, { label: "Lokalhyra", amount: 58000 }) ===
    "Lokalhyra, 58 000 kr",
);
check(
  "okänt innehåll ger ingen gissning",
  deriveAuditDetail("case_tasks", "insert", null, {}) === null,
);

/* --- systemsammanfattningen ---------------------------------------------------- */
const ev = (
  objectType: string,
  occurredAt: string,
  detail: string | null = null,
  actorRole: AuditEventRecord["actorRole"] = "owner",
): AuditEventRecord => ({
  id: Math.random(),
  caseId: "c1",
  actorUserId: "u1",
  actorRole,
  action: "insert",
  objectType,
  objectId: null,
  detail,
  occurredAt,
});

const now = new Date("2026-08-02T12:00:00.000Z");
const events = [
  ev("cases", "2026-07-20T09:00:00Z"),
  ev("case_tasks", "2026-07-21T09:00:00Z", '"Boka möte"'),
  ev("case_tasks", "2026-07-22T09:00:00Z", '"Ring banken"'),
  ev("case_documents", "2026-07-25T09:00:00Z", "styrelseprotokoll-kbr.txt (genererad mall: kbr-beslut)"),
  ev("case_invitations", "2026-07-26T09:00:00Z", "revisor@byran.se som revisor"),
  ev("kbr_assessments", "2026-07-30T09:00:00Z", "bedömning: krävs", "auditor"),
];
const lines = summarizeAuditTrail(events, now);
const text = lines.join(" ");

check("perioden anges", /omfattar 6 händelser mellan 20 juli 2026 och 30 juli 2026/.test(text), text);
check("fördelningen räknas", /2 uppgifter/.test(text) && /1 dokument/.test(text));
check("milstolpe: KBR", /kontrollbalansbedömning är registrerad/.test(text));
check("milstolpe: protokollet", /protokollfört/.test(text));
check("milstolpe: inbjudningar", /deltagare har bjudits in/.test(text));
check("aktivitet per roll", /företrädare 5/.test(text) && /revisor 1/.test(text));
check("senaste aktiviteten relativt", /för 3 dagar sedan/.test(text));
check("tom logg sägs vara tom", summarizeAuditTrail([], now)[0] === "Inga händelser är loggade ännu.");
check(
  "utan milstolpar förklaras vad som kommer synas",
  summarizeAuditTrail([ev("case_tasks", "2026-08-01T09:00:00Z")], now).join(" ").includes("Inga juridiska milstolpar"),
);
check(
  "determinism",
  JSON.stringify(summarizeAuditTrail(events, now)) === JSON.stringify(summarizeAuditTrail(events, now)),
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
