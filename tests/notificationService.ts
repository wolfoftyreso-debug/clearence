/**
 * Aviseringstjänstens vakt.
 *
 * Fyra löften prövas här, och alla fyra går att bryta av misstag:
 *
 *  1. ENGÅNGSGARANTIN. Samma händelse upptäckt tio gånger får ge ett
 *     utskick. Nyckeln byggs av VAD saken gäller, aldrig av när den
 *     upptäcktes - och just den skillnaden är lätt att slarva bort.
 *  2. PLANGRÄNSEN. SMS är betalt; klockan i appen är det aldrig.
 *  3. TYST TID, och undantaget från den. Ett besked om en granskad
 *     handling får inte väcka någon 03:00; en frist som löper ut får.
 *  4. SEKRETESSEN I SMS:ET. Texten som landar på en låst skärm får inte
 *     avslöja att bolaget är i kris.
 *
 * Utöver det: numret. Ett felskrivet nummer skickar besked om en kris
 * till en främling, så normaliseringen prövas mot både det som ska
 * godtas och det som inte får godtas.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  CHANNELS,
  DEFAULT_QUIET_HOURS,
  EVENTS,
  LEVELS,
  REASON_TEXT,
  channelInPlan,
  channelSpec,
  decideDelivery,
  eventSpec,
  inQuietHours,
  levelAllows,
  localHour,
  nextQuietEnd,
  planGateReason,
  severityOf,
  type Channel,
  type DeliveryContext,
  type EventKind,
  type PlanId,
} from "../src/lib/notifications/events";
import {
  DEADLINE_THRESHOLDS,
  SMS_SEGMENT_LIMIT,
  buildMessage,
  daysLeftPhrase,
  dedupeKey,
  thresholdFor,
} from "../src/lib/notifications/messages";
import {
  VERIFICATION_CODE_LENGTH,
  VERIFICATION_TTL_MINUTES,
  formatPhone,
  isMobileNumber,
  isVerificationCode,
  maskPhone,
  normalisePhone,
  verificationSms,
} from "../src/lib/notifications/phone";
import { emptyPraiseIn, sentimentalIn } from "../src/lib/advisor/tone";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (ok) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${name}${extra === undefined ? "" : `\n     ${JSON.stringify(extra)}`}`);
  }
};

const KINDS = EVENTS.map((e) => e.kind);

/* --- 1. Engångsgarantin --------------------------------------------------- */

const base = { kind: "atgard-kravs" as EventKind, userId: "u1", caseId: "c1", subjectId: "t9" };

check("samma händelse ger samma nyckel", dedupeKey(base) === dedupeKey({ ...base }));
check(
  "nyckeln innehåller inte tidpunkten",
  !/\d{4}-\d{2}-\d{2}|T\d{2}:/.test(dedupeKey(base)),
  dedupeKey(base),
);
check("olika ärenden ger olika nycklar", dedupeKey(base) !== dedupeKey({ ...base, caseId: "c2" }));
check("olika användare ger olika nycklar", dedupeKey(base) !== dedupeKey({ ...base, userId: "u2" }));
check("olika saker ger olika nycklar", dedupeKey(base) !== dedupeKey({ ...base, subjectId: "t8" }));
check(
  "olika sorters händelse ger olika nycklar",
  dedupeKey(base) !== dedupeKey({ ...base, kind: "analys-klar" }),
);

// Fristen ska få komma igen när det blivit mer bråttom - men inte varje dag.
check(
  "en snävare tröskel ger en ny avisering",
  dedupeKey({ ...base, kind: "frist-narmar-sig", threshold: 14 }) !==
    dedupeKey({ ...base, kind: "frist-narmar-sig", threshold: 7 }),
);
check(
  "samma tröskel ger samma avisering",
  dedupeKey({ ...base, kind: "frist-narmar-sig", threshold: 7 }) ===
    dedupeKey({ ...base, kind: "frist-narmar-sig", threshold: 7 }),
);
check("åtta dagar hör till fjortondagarsbeskedet", thresholdFor(8) === 14, thresholdFor(8));
check("sju dagar hör till sjudagarsbeskedet", thresholdFor(7) === 7, thresholdFor(7));
check("en dag hör till endagsbeskedet", thresholdFor(1) === 1, thresholdFor(1));
check("noll dagar hör till endagsbeskedet", thresholdFor(0) === 1, thresholdFor(0));
check("tjugo dagar ger inget besked än", thresholdFor(20) === null, thresholdFor(20));
check("tre trösklar, inte fjorton", DEADLINE_THRESHOLDS.length === 3, DEADLINE_THRESHOLDS.length);

/* --- 2. Plangränsen -------------------------------------------------------- */

const PLANS: PlanId[] = ["start", "standard", "business", "enterprise"];

for (const plan of PLANS) {
  check(`${plan}: klockan i appen är alltid öppen`, channelInPlan("inapp", plan));
  check(`${plan}: push är inte i drift`, !channelInPlan("push", plan));
}
check("SMS ingår i Business", channelInPlan("sms", "business"));
check("SMS ingår i Enterprise", channelInPlan("sms", "enterprise"));
check("SMS ingår INTE i Standard", !channelInPlan("sms", "standard"));
check("SMS ingår INTE i Start", !channelInPlan("sms", "start"));
check("e-post ingår från Standard", channelInPlan("email", "standard"));
check("e-post ingår inte i Start", !channelInPlan("email", "start"));

check("den öppna kanalen har inget låsskäl", planGateReason("sms", "business") === null);
check(
  "den låsta kanalen säger vad som öppnar den",
  (planGateReason("sms", "standard") ?? "").includes("Business"),
  planGateReason("sms", "standard"),
);
check(
  "push säger att den inte finns än",
  (planGateReason("push", "enterprise") ?? "").includes("inte"),
  planGateReason("push", "enterprise"),
);
check(
  "push är märkt som inte i drift",
  CHANNELS.filter((c) => !c.live).map((c) => c.id).join() === "push",
);

/* --- 3. Nivåerna ----------------------------------------------------------- */

check("tre nivåer, inte sju kryssrutor", LEVELS.length === 3, LEVELS.length);
for (const level of LEVELS) {
  check(
    `nivån ${level.id} släpper igenom något`,
    KINDS.some((k) => levelAllows(level.id, k)),
  );
}
check("alla släpper igenom allt", KINDS.every((k) => levelAllows("alla", k)));
check("tidskritiska släpper bara igenom fristen", KINDS.filter((k) => levelAllows("tidskritiska", k)).length === 1);
check("åtgärdsnivån släpper igenom fristen också", levelAllows("atgard", "frist-narmar-sig"));
check("åtgärdsnivån stoppar rena informationsbesked", !levelAllows("atgard", "steg-framat"));
check("en okänd händelse släpps aldrig igenom", !levelAllows("alla", "hittepa" as EventKind));

check(
  "varje händelse har en allvarlighetsgrad",
  KINDS.every((k) => severityOf(k) !== null),
);
check("exakt en händelse är tidskritisk", KINDS.filter((k) => severityOf(k) === "tidskritisk").length === 1);
check("en okänd händelse har ingen grad", severityOf("hittepa" as EventKind) === null);
check("eventSpec svarar null på okänt", eventSpec("hittepa" as EventKind) === null);

/* --- 4. Tyst tid ----------------------------------------------------------- */

const night = DEFAULT_QUIET_HOURS; // 21 -> 7
check("23 är tyst", inQuietHours(23, night));
check("03 är tyst", inQuietHours(3, night));
check("21 är tyst (början räknas)", inQuietHours(21, night));
check("07 är inte tyst (slutet räknas inte)", !inQuietHours(7, night));
check("14 är inte tyst", !inQuietHours(14, night));
// Ett intervall som inte passerar midnatt.
check("13-15: 14 är tyst", inQuietHours(14, { startHour: 13, endHour: 15 }));
check("13-15: 16 är inte tyst", !inQuietHours(16, { startHour: 13, endHour: 15 }));
// Lika värden = ingen tyst tid alls, inte dygnet runt.
check("samma timme betyder ingen tyst tid", !inQuietHours(3, { startHour: 8, endHour: 8 }));

/* --- 5. Beslutet ----------------------------------------------------------- */

const ctx = (over: Partial<DeliveryContext> = {}): DeliveryContext => ({
  kind: "atgard-kravs",
  channel: "sms",
  level: "atgard",
  plan: "business",
  enabledChannels: ["inapp", "email", "sms"],
  quiet: night,
  hour: 14,
  hasVerifiedPhone: true,
  ...over,
});

check("ett normalt fall går fram", decideDelivery(ctx()).send);

const cases: { name: string; over: Partial<DeliveryContext>; reason: string }[] = [
  { name: "avstängd kanal", over: { enabledChannels: ["inapp"] }, reason: "kanal-avstangd" },
  { name: "utanför nivån", over: { level: "tidskritiska" }, reason: "utanfor-niva" },
  { name: "fel plan", over: { plan: "standard" }, reason: "ingar-inte-i-planen" },
  { name: "tyst tid", over: { hour: 3 }, reason: "tyst-tid" },
  { name: "overifierat nummer", over: { hasVerifiedPhone: false }, reason: "saknar-verifierat-nummer" },
  { name: "kanal ur drift", over: { channel: "push" }, reason: "kanalen-ar-inte-i-drift" },
];
for (const c of cases) {
  const decision = decideDelivery(ctx(c.over));
  check(`${c.name}: skickas inte`, !decision.send, decision);
  check(`${c.name}: skälet är "${c.reason}"`, decision.reason === c.reason, decision.reason);
  check(`${c.name}: skälet har en läsbar text`, !!REASON_TEXT[c.reason as keyof typeof REASON_TEXT]);
}

// Undantaget, och att det ÄR ett undantag.
check(
  "en frist bryter tyst tid",
  decideDelivery(ctx({ hour: 3, kind: "frist-narmar-sig", level: "alla" })).send,
);
check(
  "en granskad handling bryter INTE tyst tid",
  !decideDelivery(ctx({ hour: 3, kind: "dokument-granskat" })).send,
);

// Klockan i appen lyder varken under nivå eller tyst tid.
check(
  "klockan i appen får allt, även utanför nivån",
  decideDelivery(ctx({ channel: "inapp", level: "tidskritiska", kind: "steg-framat", hour: 3 })).send,
);
check(
  "klockan i appen fungerar även på gratisnivån",
  decideDelivery(ctx({ channel: "inapp", plan: "start" })).send,
);

/* --- 6. Uppskjutningen ----------------------------------------------------- */

// Tyst tid skjuter upp; den slänger inte. Klockan räknas i svensk tid.
const atNight = new Date("2026-08-04T01:30:00Z"); // 03:30 svensk sommartid
check("timmen räknas i svensk tid", localHour(atNight) === 3, localHour(atNight));
const resume = nextQuietEnd(atNight, night);
check("uppskjutet till efter tystnaden", localHour(resume) === night.endHour, localHour(resume));
check("uppskjutet framåt, aldrig bakåt", resume.getTime() > atNight.getTime());
const daytime = new Date("2026-08-04T12:00:00Z");
check("mitt på dagen skjuts ingenting upp", nextQuietEnd(daytime, night).getTime() === daytime.getTime());

/* --- 7. Sekretessen i SMS:et ---------------------------------------------- */

// Ord som avslöjar ämnet. Ett SMS på en låst skärm ska inte tala om för
// omgivningen att bolaget är i kris.
const REVEALING = /konkurs|obestånd|insolven|rekonstruktion|kontrollbalans|skuld|likvid|kris|personligt ansvar/i;

for (const kind of KINDS) {
  const msg = buildMessage({ kind, caseReference: "A-241", daysLeft: 3 });

  check(`${kind}: SMS:et ryms i ett segment`, msg.sms.length <= SMS_SEGMENT_LIMIT, msg.sms.length);
  check(`${kind}: SMS:et avslöjar inte ämnet`, !REVEALING.test(msg.sms), msg.sms);
  check(`${kind}: SMS:et pekar tillbaka in i produkten`, /logga in/i.test(msg.sms), msg.sms);
  check(`${kind}: SMS:et nämner avsändaren`, msg.sms.startsWith("CLEARANCE"), msg.sms);
  check(`${kind}: SMS:et innehåller inga belopp`, !/\d[\d\s]{3,}\s*(kr|sek)/i.test(msg.sms), msg.sms);

  check(`${kind}: rubriken är inte tom beröm`, emptyPraiseIn(msg.title) === null, msg.title);
  check(`${kind}: texten är inte sentimental`, sentimentalIn(msg.body) === null, msg.body);
  check(`${kind}: inget kallas AI`, !/\bAI\b/i.test(`${msg.title} ${msg.body} ${msg.sms}`), msg.sms);
  check(`${kind}: det finns en väg vidare`, msg.href.startsWith("/"), msg.href);
  check(`${kind}: rubrik och text säger olika saker`, msg.title !== msg.body);
}

// Ärendereferensen är valfri och ska försvinna helt när den saknas.
const withoutRef = buildMessage({ kind: "atgard-kravs", caseReference: null });
check("utan referens blir det inga tomma parenteser", !withoutRef.sms.includes("()"), withoutRef.sms);

// Tiden i klartext.
check("noll dagar är i dag", daysLeftPhrase(0) === "i dag");
check("en dag är i morgon", daysLeftPhrase(1) === "i morgon");
check("tre dagar räknas ut", daysLeftPhrase(3) === "om 3 dagar");
check("passerad frist skriver inte minus", daysLeftPhrase(-2) === "i dag");

/* --- 8. Numret ------------------------------------------------------------- */

const ACCEPTED = [
  "070-123 45 67",
  "0701234567",
  "+46701234567",
  "0046701234567",
  "46701234567",
  "  070 123 45 67  ",
  "(070) 123-4567",
];
for (const raw of ACCEPTED) {
  check(`"${raw}" normaliseras`, normalisePhone(raw) === "+46701234567", normalisePhone(raw));
}

const REJECTED = [
  "08-123 45 67", // fast nummer
  "070-123 45 6", // för kort
  "070-123 45 678", // för långt
  "",
  "   ",
  "hej",
  "070-123 45 6a",
  "+4470123456789", // fel land
  "+46",
];
for (const raw of REJECTED) {
  check(`"${raw}" avvisas`, normalisePhone(raw) === null, normalisePhone(raw));
}

check("isMobileNumber följer normaliseringen", isMobileNumber("070-1234567") && !isMobileNumber("08-123456"));
check("numret visas svenskt grupperat", formatPhone("+46701234567") === "+46 701 23 45 67", formatPhone("+46701234567"));
check("maskeringen döljer mitten", maskPhone("+46701234567") === "+46 701 •• •• 67", maskPhone("+46701234567"));
check("maskeringen visar inte hela numret", !maskPhone("+46701234567").includes("2345"));
check("ett trasigt nummer maskeras ändå", maskPhone("skräp") === "•••");

check("koden är sex siffror", isVerificationCode("123456"));
check("fem siffror räcker inte", !isVerificationCode("12345"));
check("bokstäver är inte en kod", !isVerificationCode("12a456"));
check("kodlängden och kontrollen håller ihop", VERIFICATION_CODE_LENGTH === 6);

const codeSms = verificationSms("123456");
check("verifierings-SMS:et innehåller koden", codeSms.includes("123456"));
check("verifierings-SMS:et säger hur länge den gäller", /\d+ minuter/.test(codeSms), codeSms);
check(
  "verifierings-SMS:et avslöjar ingenting om ärendet",
  !REVEALING.test(codeSms) && !/ärende/i.test(codeSms),
  codeSms,
);
check("verifierings-SMS:et ryms i ett segment", codeSms.length <= SMS_SEGMENT_LIMIT, codeSms.length);

/*
 * TEXTEN OVAN SKICKAS INTE HÄRIFRÅN.
 *
 * Sedan verifieringskoden flyttade in i databasen (migration
 * 20260822100000) sätts SMS:et ihop inne i start_phone_verification, i
 * samma transaktion som koden föds. verificationSms() finns kvar för att
 * texten ska gå att läsa, prova och granska som språk - kontrollerna
 * ovanför prövar just det.
 *
 * Två källor som säger samma sak glider isär om ingen tvingar dem. Den
 * som skriver om texten i den ena ska få rött tills den andra följer med.
 */
{
  const sql = readFileSync(
    "supabase/migrations/20260822100000_verifieringskoden_fods_i_databasen.sql",
    "utf8",
  );
  const rad = /v_kod \|\| '([^']*)'\s*\|\| p_ttl_minutes \|\| '([^']*)'/.exec(sql);
  const franSql = rad ? `123456${rad[1]}10${rad[2]}` : "";
  const franKod = verificationSms("123456").replace(
    String(VERIFICATION_TTL_MINUTES),
    "10",
  );
  check("SMS-texten i databasen är likalydande med den i koden", franSql === franKod, {
    sql: franSql,
    kod: franKod,
  });
}

/* --- 9. Kanalregistret ----------------------------------------------------- */

const ids = CHANNELS.map((c) => c.id);
check("fyra kanaler är registrerade", ids.length === 4, ids);
check("kanalerna är unika", new Set(ids).size === ids.length);
check("varje kanal har en beskrivning", CHANNELS.every((c) => c.description.length > 10));
check("okänd kanal faller tillbaka på klockan", channelSpec("hittepa" as Channel).id === "inapp");

/* --- 10. Regeln gäller ALL egen källkod ----------------------------------- */

// Klartextkoden får bara finnas i demoadaptern (som saknar telefon att
// skicka till) och i testet. Skulle någon logga den eller spara den vore
// hela verifieringen teater.
const files: string[] = [];
const walk = (dir: string) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (full.includes(join("components", "ui"))) continue;
      walk(full);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(full);
    }
  }
};
walk(join(process.cwd(), "src"));
walk(join(process.cwd(), "db", "worker"));

const codeLeaks: string[] = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  // En kod som skickas till loggen, eller sparas utan att hashas.
  if (/console\.(log|info|warn|error)\([^)]*\bcode\b/.test(text)) codeLeaks.push(`${file}: loggar koden`);
  if (/code_sha256:\s*code\b/.test(text)) codeLeaks.push(`${file}: sparar koden ohashad`);
}
check("verifieringskoden loggas eller sparas aldrig i klartext", codeLeaks.length === 0, codeLeaks);

// Leverantörens namn får stå på TVÅ ställen: i kapslingen som talar med
// den, och i konstanten SMS_SECRET_PROVIDER som namnger raden i valvet.
// Överallt annars importeras konstanten. Ligger namnet i tjugo filer är
// ett leverantörsbyte ett projekt; ligger det i två är det en eftermiddag.
const providerHits = files.filter((f) => {
  const text = readFileSync(f, "utf8");
  if (!/46elks/i.test(text)) return false;
  if (f.includes(join("worker", "sms"))) return false;
  // Konstantens egen fil: namnet får stå i deklarationen, ingen annanstans.
  if (f.endsWith(join("notifications", "events.ts"))) {
    return text.split("\n").filter((line) => /46elks/i.test(line) &&
      !/export const SMS_SECRET_PROVIDER/.test(line)).length > 0;
  }
  return true;
});
check("leverantörens namn är inkapslat", providerHits.length === 0, providerHits);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
