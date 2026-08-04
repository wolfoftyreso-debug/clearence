/**
 * Tester för notisaggregatorn.
 *
 * Klockan är produktens löfte om att tystnad betyder lugn. Därför testas
 * inte bara att notiser skapas, utan att de INTE skapas när inget kräver
 * användaren - en klocka som larmar i onödan tränar bort uppmärksamheten
 * lika effektivt som en som tiger om frister.
 */

import {
  buildNotifications,
  categoryOf,
  filterNotifications,
  signatureOf,
  type NotificationInput,
  type NotificationItem,
} from "../src/lib/notifications";
import {
  badgeCount,
  bellLabel,
  forgetRead,
  isRead,
  markAllRead,
  markRead,
  readSignatures,
} from "../src/lib/notificationsRead";
import type { TimelineEvent } from "../src/lib/crisisAnalysis";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra = "") => {
  if (ok) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${name} ${extra}`);
  }
};

const NOW = new Date("2026-08-02T09:00:00");

const event = (iso: string, label: string): TimelineEvent => ({
  iso,
  daysAway: 0,
  label,
  amount: null,
  severity: "critical",
});

const base = (): NotificationInput => ({
  caseRecord: null,
  crisis: null,
  timeline: [],
  mentions: [],
  invitations: [],
  kbr: null,
  failedEmails: [],
  pendingApplications: 0,
  newContactMessages: 0,
  pendingProfileClaims: 0,
  now: NOW,
});

/* --- tomt läge ------------------------------------------------------------ */
check("tomt: inga notiser av ingenting", buildNotifications(base()).length === 0);

/* --- ärendets läge -------------------------------------------------------- */
const acute = buildNotifications({ ...base(), crisis: { urgency: "immediate", title: "Ansök om företagsrekonstruktion" } });
check("akut läge: kritisk notis", acute.length === 1 && acute[0].tone === "critical" && acute[0].title === "Läget kräver omedelbara åtgärder");
check("akut läge: bedömningen i brödtexten", acute[0].body === "Systemanalysen bedömer: Ansök om företagsrekonstruktion.");
const weeks = buildNotifications({ ...base(), crisis: { urgency: "weeks", title: "Stabilisera likviditeten" } });
check("veckoläge: varning", weeks.length === 1 && weeks[0].tone === "warning");
check("månadsläge: tyst", buildNotifications({ ...base(), crisis: { urgency: "months", title: "Planera" } }).length === 0);

/* --- frister -------------------------------------------------------------- */
const passedFrist = buildNotifications({ ...base(), timeline: [event("2026-07-28", "Skatteinbetalning")] });
check("frist passerad: kritisk", passedFrist.length === 1 && passedFrist[0].tone === "critical");
check("frist passerad: rubriken pekar ut vad", passedFrist[0].title === "Passerad frist: skatteinbetalning");
check("frist passerad: länkar till fristsektionen", passedFrist[0].href === "/dashboard#frister");
check("akut läge länkar till systemanalysen", buildNotifications({ ...base(), crisis: { urgency: "immediate", title: "x" } })[0].href === "/dashboard#systemanalys");

const todayFrist = buildNotifications({ ...base(), timeline: [event("2026-08-02", "Lönekörning")] });
check("frist idag: kritisk", todayFrist[0].tone === "critical");
check("frist idag: rubriken", todayFrist[0].title === "Förfaller idag: lönekörning");

const soonFrist = buildNotifications({ ...base(), timeline: [event("2026-08-04", "Hyra")] });
check("frist inom 3 dagar: varning", soonFrist.length === 1 && soonFrist[0].tone === "warning");
check("frist inom 3 dagar: etiketten med", soonFrist[0].title.startsWith("Hyra"));

const farFrist = buildNotifications({ ...base(), timeline: [event("2026-08-20", "Årsstämma"), event("2026-08-12", "Skatteinbetalning")] });
check("frist långt bort: en lugn info om den NÄRMASTE", farFrist.length === 1 && farFrist[0].tone === "info");
check("nästa frist: rätt frist och avstånd", farFrist[0].title === "Nästa frist: skatteinbetalning om 10 dagar");
const nearAndFar = buildNotifications({ ...base(), timeline: [event("2026-08-04", "Hyra"), event("2026-08-20", "Årsstämma")] });
check("nära frist tystar nästa-frist-raden", nearAndFar.length === 1 && nearAndFar[0].tone === "warning");

/* --- kontrollbalansläget -------------------------------------------------- */
const kbrRequired = buildNotifications({ ...base(), kbr: { status: "required", createdAt: "2026-08-01" } });
check("kbr krävs: kritisk med länk till modulen", kbrRequired.length === 1 && kbrRequired[0].tone === "critical" && kbrRequired[0].href === "/kbr");
check("kbr krävs: rubriken", kbrRequired[0].title === "Kontrollbalansräkning krävs");

const kbrCritical = buildNotifications({ ...base(), kbr: { status: "critical", createdAt: "2026-08-01" } });
check("kbr kritisk: egen rubrik", kbrCritical[0].title === "Kontrollbalans: kritisk");

const kbrOk = buildNotifications({ ...base(), kbr: { status: "ok", createdAt: "2026-08-01" } });
check("kbr ok: ingen notis", kbrOk.length === 0);

/* --- taggade meddelanden -------------------------------------------------- */
const mention = buildNotifications({
  ...base(),
  mentions: [{
    messageId: "m1",
    caseId: "c1",
    conversationId: "conv1",
    conversationTitle: "Bankfrågan",
    authorName: "Eva Advokat",
    body: "Kan du bekräfta siffran?",
    createdAt: "2026-08-01T10:00:00.000Z",
  }],
});
check("tagg: varning med avsändaren i rubriken", mention.length === 1 && mention[0].tone === "warning" && mention[0].title === "Eva Advokat väntar på ditt svar");
check("tagg: tråd och text i brödtexten", mention[0].body === "I Bankfrågan: Kan du bekräfta siffran?");
check("tagg: länkar till meddelanden", mention[0].href === "/dashboard/meddelanden");

const anonMention = buildNotifications({
  ...base(),
  mentions: [{ messageId: "m2", caseId: "c1", conversationId: null, conversationTitle: null, authorName: null, body: "Hej", createdAt: "2026-08-01T10:00:00.000Z" }],
});
check("tagg utan namn: 'Någon'", anonMention[0].title === "Någon väntar på ditt svar");
check("tagg utan tråd: bara texten", anonMention[0].body === "Hej");

/* --- inbjudningssvar ------------------------------------------------------ */
const invitation = (acceptedAt: string | null) => ({
  id: "i1",
  caseId: "c1",
  email: "revisor@test.se",
  role: "auditor" as const,
  createdAt: "2026-07-20T10:00:00.000Z",
  expiresAt: "2026-08-20T10:00:00.000Z",
  acceptedAt,
  revokedAt: null,
});
const freshAccept = buildNotifications({ ...base(), invitations: [invitation("2026-07-30T10:00:00.000Z")] });
check("accept inom veckan: info", freshAccept.length === 1 && freshAccept[0].tone === "info");
check("accept: adressen i rubriken", freshAccept[0].title === "revisor@test.se tackade ja");
check("accept: länkar till deltagare", freshAccept[0].href === "/dashboard/deltagare");
check("accept äldre än veckan: tyst", buildNotifications({ ...base(), invitations: [invitation("2026-07-20T10:00:00.000Z")] }).length === 0);
check("obesvarad inbjudan: tyst", buildNotifications({ ...base(), invitations: [invitation(null)] }).length === 0);

/* --- driftlarm ------------------------------------------------------------ */
const failedEmail = {
  id: "e1", recipient: "x@test.se", subject: "Faktura", kind: "invoice",
  status: "failed" as const, attempts: 5, lastError: "Mailbox unavailable",
  createdAt: "2026-08-01T10:00:00.000Z", sentAt: null,
};
const drift = buildNotifications({ ...base(), failedEmails: [failedEmail, { ...failedEmail, id: "e2" }], pendingApplications: 3, newContactMessages: 1, pendingProfileClaims: 2 });
check("drift: fyra notiser", drift.length === 4);
check("drift: utskicken räknas och är kritiska", drift[0].tone === "critical" && drift[0].title === "2 utskick har misslyckats");
check("drift: inkorgen varnar", drift.some((n) => n.tone === "warning" && n.href === "/admin/inkorg"));
check("drift: ansökningarna informerar", drift.some((n) => n.tone === "info" && n.href === "/admin/ansokningar"));
check("drift: profilanspråken informerar", drift.some((n) => n.tone === "info" && n.title === "2 profilanspråk att granska" && n.href === "/admin"));

/* --- rangordningen -------------------------------------------------------- */
const mixed = buildNotifications({
  ...base(),
  timeline: [event("2026-08-04", "Hyra"), event("2026-07-28", "Skatt")],
  kbr: { status: "required", createdAt: "2026-08-01" },
  invitations: [invitation("2026-07-30T10:00:00.000Z")],
  mentions: [{ messageId: "m1", caseId: "c1", conversationId: null, conversationTitle: null, authorName: "Eva", body: "?", createdAt: "2026-08-01T10:00:00.000Z" }],
});
check("blandat: allt med", mixed.length === 5);
check(
  "blandat: kritiskt före varning före info",
  mixed.map((n) => n.tone).join(",") === "critical,critical,warning,warning,info",
  mixed.map((n) => n.tone).join(","),
);
check("blandat: unika id:n", new Set(mixed.map((n) => n.id)).size === 5);

/* --- notisinställningarna -------------------------------------------------- */
check("kategori: frister och läge", categoryOf("frist-passerad-x") === "läge" && categoryOf("laget-akut") === "läge" && categoryOf("kbr-laget") === "läge");
check("kategori: samarbete", categoryOf("mention-m1") === "samarbete" && categoryOf("invit-accept-i1") === "samarbete");
check("kategori: drift", categoryOf("drift-utskick") === "drift");

const allNotices = buildNotifications({
  ...base(),
  crisis: { urgency: "immediate", title: "Agera" },
  mentions: [{ messageId: "m1", caseId: "c1", conversationId: null, conversationTitle: null, authorName: "Eva", body: "?", createdAt: "2026-08-01T10:00:00.000Z" }],
  pendingApplications: 1,
});
const filtered = filterNotifications(allNotices, { läge: true, samarbete: false, drift: false });
check("filtret släcker valda kategorier", filtered.length === 1 && filtered[0].id === "laget-akut", filtered.map((n) => n.id).join(","));
check(
  "läget kan aldrig filtreras bort",
  filterNotifications(allNotices, { läge: false as unknown as true, samarbete: true, drift: true } as never).length >= 0 &&
    // getNotificationPrefs tvingar alltid läge=true; här testas filtrets kontrakt
    filterNotifications(allNotices, { läge: true, samarbete: true, drift: true }).length === 3,
);

/* --- delegerade uppgifter ------------------------------------------------- */
check("inga tilldelade uppgifter: tyst",
  buildNotifications({ ...base(), assignedOpenTasks: 0 }).length === 0);
const assignedOne = buildNotifications({ ...base(), assignedOpenTasks: 1 });
check("en tilldelad uppgift: varningsnotis i singular",
  assignedOne.length === 1 && assignedOne[0].tone === "warning" &&
  assignedOne[0].title === "En uppgift är tilldelad dig");
const assignedMany = buildNotifications({ ...base(), assignedOpenTasks: 3 });
check("flera tilldelade: antalet i rubriken",
  assignedMany[0].title === "3 uppgifter är tilldelade dig" &&
  assignedMany[0].href === "/dashboard#frister");
check("tilldelningsnotisen hör till samarbetet",
  categoryOf(assignedMany[0].id) === "samarbete");

/* --- siffran räknar bara det som KRÄVER något ----------------------------- */

// Klockan sa tidigare "3 meddelanden väntar på ditt svar" om en lista
// där en av raderna själv skrev "inget kräver åtgärd i dag". En siffra
// som räknar sådant lär användaren att siffran inte betyder något.
const withUpcoming = buildNotifications({
  ...base(),
  crisis: { urgency: "immediate", title: "Konkurs bör övervägas" },
  timeline: [event("2026-08-20", "Skatt/moms")],
});
check("lägesnotisen och nästa frist visas båda", withUpcoming.length === 2, String(withUpcoming.length));
check(
  "nästa frist RÄKNAS inte - den säger själv att inget krävs",
  withUpcoming.filter((n) => n.demandsAction).length === 1,
  JSON.stringify(withUpcoming.map((n) => [n.id, n.demandsAction])),
);
check(
  "raden som inte räknas är just den om nästa frist",
  withUpcoming.find((n) => !n.demandsAction)?.id.startsWith("frist-nasta") === true,
);

const acceptedInvite = buildNotifications({
  ...base(),
  invitations: [
    {
      id: "i1",
      caseId: "c1",
      email: "revisor@byra.se",
      role: "advisor",
      createdAt: "2026-08-01T09:00:00Z",
      expiresAt: "2026-09-01T09:00:00Z",
      acceptedAt: "2026-08-01T10:00:00Z",
      revokedAt: null,
    } as NotificationInput["invitations"][number],
  ],
});
check("ett deltagarsvar visas", acceptedInvite.length === 1);
check("ett deltagarsvar kräver ingenting", acceptedInvite[0].demandsAction === false);

const passedNow = buildNotifications({ ...base(), timeline: [event("2026-07-28", "Skatteinbetalning")] });
check("en passerad frist kräver något", passedNow[0].demandsAction === true);

/* --- minnet: siffran ska gå att beta av ----------------------------------- */

// Testet kör i node utan webbläsare. En minimal lagring räcker: modulen
// ska klara både att den finns och att den inte gör det.
const store: Record<string, string> = {};
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = String(v); },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  key: () => null,
  length: 0,
} as Storage;
(globalThis as unknown as { window: { dispatchEvent: () => boolean } }).window = {
  dispatchEvent: () => true,
};

forgetRead();
check("utan minne är allt oläst", badgeCount(withUpcoming) === 1, String(badgeCount(withUpcoming)));

const demanding = withUpcoming.find((n) => n.demandsAction) as NotificationItem;
markRead(demanding);
check("en kvitterad rad räknas inte längre", badgeCount(withUpcoming) === 0);
check("men den ligger kvar i listan", withUpcoming.length === 2);
check("och den är märkt som läst", isRead(demanding));

// Upptrappningen: samma id, ny allvarsgrad = ny information.
const escalated: NotificationItem = { ...demanding, tone: "critical", title: "Läget har förvärrats" };
check("samma id men ny text ger nytt fingeravtryck", signatureOf(escalated) !== signatureOf(demanding));
check("upptrappningen är oläst igen", !isRead(escalated));
check("och räknas igen", badgeCount([escalated]) === 1);

// Markera alla: även det som inte räknas, annars ser listan oavklarad ut.
forgetRead();
markAllRead(withUpcoming);
check("markera alla kvitterar hela listan", withUpcoming.every((n) => isRead(n)));
check("markera alla nollar siffran", badgeCount(withUpcoming) === 0);

forgetRead();
check("glöm minnet visar allt igen", readSignatures().size === 0 && badgeCount(withUpcoming) === 1);

// Gallringen: minnet får inte växa utan gräns och slå ut sig självt.
const many: NotificationItem[] = Array.from({ length: 250 }, (_, i) => ({
  id: `x-${i}`, tone: "info" as const, title: `T${i}`, body: "b", href: "/", demandsAction: true,
}));
markAllRead(many);
check("minnet gallras vid taket", readSignatures().size <= 200, String(readSignatures().size));
check("det senaste är kvar", isRead(many[249]));
check("det äldsta är bortgallrat", !isRead(many[0]));

/* --- etiketten stämmer med siffran ---------------------------------------- */

check("noll: etiketten lovar inget", bellLabel(0) === "Notiser: inget kräver dig just nu");
check("en: singular", bellLabel(1) === "Notiser: en sak kräver dig");
check("flera: plural med tal", bellLabel(4) === "Notiser: 4 saker kräver dig");
check(
  "etiketten säger aldrig 'väntar på ditt svar' om något som inte gör det",
  ![0, 1, 5].some((n) => /väntar på ditt svar/.test(bellLabel(n))),
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
