/**
 * Tester för krisrådgivarens dialogmotor.
 *
 * Determinismen ÄR produkten: samma svar på samma frågor ska ge samma
 * bedömning, siffrorna användaren angav ska stå i svaret, och varje
 * handling ska peka på en adress som finns. Rådgivningsgränsen testas
 * som text: bedömningarna säger "underlag för beslut", aldrig "AI".
 */

import {
  CLARA,
  DIALOG_FLOWS,
  FALLBACK_REPLY,
  ONBOARDING,
  answerLabel,
  buildCaseSnapshot,
  decisionCheckIn,
  matchFlow,
} from "../src/lib/advisor/dialog";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (ok) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${name}${extra === undefined ? "" : `\n     ${JSON.stringify(extra)}`}`);
  }
};

/* --- intentmatchningen ----------------------------------------------------- */

check("moms → skatteflödet", matchFlow("Jag kan inte betala momsen den här månaden")?.id === "skatt");
check("arbetsgivaravgift → skatteflödet", matchFlow("arbetsgivaravgifterna förfaller på fredag")?.id === "skatt");
check("löner → löneflödet", matchFlow("vi klarar inte lönerna nästa vecka")?.id === "loner");
check("kundfaktura → kundflödet", matchFlow("en stor faktura är obetald sedan i somras")?.id === "kundforlust");
check("kronofogden → kfm-flödet", matchFlow("det kom ett brev från Kronofogden idag")?.id === "kronofogden");
check("banken → bankflödet", matchFlow("banken har sagt upp checkkrediten")?.id === "banken");
check("skatt vinner över kund när båda nämns", matchFlow("kan inte betala momsen eftersom kunden inte betalat")?.id === "skatt");
check("okänd fritext → null (ärlig fallback)", matchFlow("hjälp mig med någonting helt annat") === null);
check("fallbacken pekar på nulägesanalysen", FALLBACK_REPLY.join(" ").includes("nulägesanalys"));
check("fallbacken guidar och öppnar själv - skickar aldrig iväg", FALLBACK_REPLY.join(" ").includes("Jag guidar dig") && FALLBACK_REPLY.join(" ").includes("Jag öppnar nulägesanalysen"));

/* --- likviditetsflödet: "jag har slut på pengar" --------------------------- */

check("slut på pengar → likviditetsflödet", matchFlow("Jag har slut på pengar")?.id === "likviditet");
check("pengarna räcker inte → likviditetsflödet", matchFlow("pengarna räcker inte i november")?.id === "likviditet");
check("tomt på kontot → likviditetsflödet", matchFlow("det är tomt på kontot")?.id === "likviditet");
const liq = DIALOG_FLOWS.find((f) => f.id === "likviditet")!;
const LIQ_ANSWERS = { konto: "100 000", behov: "300 000", storst: "Skatt", inbet: "50 000" };
const liqA = liq.assess(LIQ_ANSWERS);
check("likviditet: mätaren räknar rätt (150/300 = 50 %)", liqA.meter?.percent === 50, liqA.meter);
check("likviditet: bristen skrivs ut", liqA.paragraphs.join(" ").includes("150 000 kr"));
check("likviditet: största posten styr planen", !!liqA.plan?.some((r) => r.label.includes("anståndsansökan")));
check("likviditet: skatt som störst ger anståndshandling", liqA.actions.some((a) => a.label.includes("anstånd")));
check("likviditet: beslutsförslag med sifferpremiss", !!liqA.decisionSuggestion && liqA.decisionSuggestion.premise.includes("300 000 kr"));
check("likviditet: full täckning ger inget beslutsförslag", liq.assess({ konto: "400 000", behov: "300 000", storst: "Löner", inbet: "0" }).decisionSuggestion === null);

/* --- varje flöde: komplett väg till bedömning ------------------------------ */

const SAMPLE_ANSWERS: Record<string, Record<string, string>> = {
  skatt: { saknas: "150 000 kr", loner: "ja", fordringar: "80 000", kbr: "nej" },
  loner: { saknas: "200 000", antal: "8", skatt: "ja" },
  kundforlust: { belopp: "100 000", forsenad: "45", paminnelse: "ja" },
  kronofogden: { belopp: "75 000", bestrider: "ja", fler: "nej" },
  banken: { vad: "nej till utökad kredit", belopp: "500 000", sakerheter: "ja" },
  likviditet: { konto: "100 000", behov: "300 000", storst: "Skatt", inbet: "50 000" },
};

for (const flow of DIALOG_FLOWS) {
  const answers = SAMPLE_ANSWERS[flow.id];
  check(`${flow.id}: har provsvar i testet`, !!answers);
  if (!answers) continue;
  const a = flow.assess(answers);
  const text = a.paragraphs.join(" ");
  check(`${flow.id}: bedömningen har minst två stycken`, a.paragraphs.length >= 2);
  check(`${flow.id}: minst två handlingar`, a.actions.length >= 2);
  check(
    `${flow.id}: alla handlingslänkar är interna adresser`,
    a.actions.every((x) => x.href.startsWith("/") && x.why.length > 10),
    a.actions.map((x) => x.href),
  );
  check(`${flow.id}: ordet AI förekommer inte`, !/\bAI\b/i.test(text + a.actions.map((x) => x.label + x.why).join(" ")));
  check(`${flow.id}: deterministisk (två körningar identiska)`, JSON.stringify(a) === JSON.stringify(flow.assess(answers)));
  check(`${flow.id}: allvarsgraden har etikett`, a.severityLabel.length > 3);
}

/* --- siffertrohet: beloppen användaren angav står i svaret ----------------- */

const tax = DIALOG_FLOWS.find((f) => f.id === "skatt")!;
const taxA = tax.assess(SAMPLE_ANSWERS.skatt);
check("skatt: bristbeloppet återges", taxA.paragraphs.join(" ").includes("150 000 kr"));
check("skatt: kundinbetalningarna återges", taxA.paragraphs.join(" ").includes("80 000 kr"));
check("skatt: lagrumet företrädaransvar nämns", taxA.paragraphs.join(" ").includes("59 kap"));
check("skatt: KBR-handling när bedömning saknas", taxA.actions.some((x) => x.href === "/kbr"));
check("skatt: beslutsförslag med premiss", !!taxA.decisionSuggestion && taxA.decisionSuggestion.premise.includes("150 000 kr"));

const taxDone = tax.assess({ ...SAMPLE_ANSWERS.skatt, kbr: "ja" });
check("skatt: ingen KBR-handling när bedömningen är gjord", !taxDone.actions.some((x) => x.href === "/kbr"));

const kfm = DIALOG_FLOWS.find((f) => f.id === "kronofogden")!;
const kfmMany = kfm.assess({ ...SAMPLE_ANSWERS.kronofogden, fler: "ja" });
check("kfm: fler krav höjer allvarsgraden till kritisk", kfmMany.severity === "critical");
check("kfm: enstaka krav är allvarligt, inte kritiskt", kfm.assess(SAMPLE_ANSWERS.kronofogden).severity === "serious");
check("kfm: bestridande ger beslutsförslag", !!kfm.assess(SAMPLE_ANSWERS.kronofogden).decisionSuggestion);
check("kfm: utan bestridande inget beslutsförslag", kfm.assess({ ...SAMPLE_ANSWERS.kronofogden, bestrider: "nej" }).decisionSuggestion === null);

/* --- rådgivningsgränsen ---------------------------------------------------- */

for (const flow of ["skatt", "loner", "kronofogden"] as const) {
  const f = DIALOG_FLOWS.find((x) => x.id === flow)!;
  const text = f.assess(SAMPLE_ANSWERS[flow]).paragraphs.join(" ");
  check(`${flow}: rådgivningsgränsen står i bedömningen`, /stäm av med/i.test(text));
}

/* --- konstitutionen i kod (Conversation Constitution) ---------------------- */

const countSentences = (s: string) => (s.match(/[.!?](\s|$)/g) ?? []).length;

for (const flow of DIALOG_FLOWS) {
  // Steg 1-2: bekräftelse och trygghet FÖRE frågorna - aldrig juridik i öppningen.
  check(`${flow.id}: bekräftelsen finns och är 1-3 meningar`, countSentences(flow.ack) >= 1 && countSentences(flow.ack) <= 3, flow.ack);
  check(`${flow.id}: öppningen bekräftar (jag förstår)`, /^Jag förstår/i.test(flow.ack));
  check(`${flow.id}: ingen juridik i öppningen`, !/\bkap\.|\blag\b|\bansvar|\bkonkurs/i.test(flow.ack), flow.ack);
  // Hård regel: aldrig fler än tre rekommenderade nästa steg.
  const answers = SAMPLE_ANSWERS[flow.id];
  if (answers) {
    check(`${flow.id}: max tre rekommendationer`, flow.assess(answers).actions.length <= 3);
  }
  // En fråga per tur: varje steg är EN fråga, inte flera.
  check(`${flow.id}: en fråga per steg`, flow.steps.every((s) => (s.prompt.match(/\?/g) ?? []).length === 1));
}

check("CLEARANCE hälsar med förnamn, sparsamt", CLARA.greeting("Erik Andersson").startsWith("Hej Erik."));
check("CLEARANCE hälsar utan namn när det saknas", CLARA.greeting(null).startsWith("Hej."));
check("onboardingen har fem situationsval", ONBOARDING.situations.length === 5);
check("onboardingen frågar EN sak i taget", ONBOARDING.intro[ONBOARDING.intro.length - 1].includes("Vad heter du?"));
check("CLEARANCE navigerar själv till nulägesanalysen", ONBOARDING.closing.join(" ").includes("Jag öppnar nu nulägesanalysen"));

const checkIn = decisionCheckIn({
  title: "Hantera skattebristen före förfallodagen",
  premise: "Beslutet vilar på att 150 000 kr saknas.",
  decidedAt: "2026-08-01T09:00:00Z",
});
check("beslutsuppföljningen citerar premissen", checkIn.includes("150 000 kr saknas"));
check("beslutsuppföljningen frågar om planen står fast", checkIn.includes("Är det fortfarande planen?"));
check("beslutsuppföljningen anger datumet", /Den 1 augusti/.test(checkIn));

/* --- Conversation UI: blocken är deterministiska delar av bedömningen ------ */

const taxUi = tax.assess(SAMPLE_ANSWERS.skatt);
check("skatt: mätaren räknar rätt (80/150 = 53 %)", taxUi.meter?.percent === 53, taxUi.meter);
check("skatt: mätarens not har båda beloppen", !!taxUi.meter && taxUi.meter.note.includes("80 000 kr") && taxUi.meter.note.includes("150 000 kr"));
check("skatt: lägesbilden har tre områden", taxUi.snapshot?.length === 3);
check("skatt: lönepressen syns i lägesbilden", !!taxUi.snapshot?.some((r) => r.label === "Löner" && r.tone === "warning"));
check("skatt: tidslinjen börjar idag och följer upp", !!taxUi.plan && taxUi.plan[0].when === "Idag" && taxUi.plan.some((r) => r.when.includes("7 dagar")));

const wages = DIALOG_FLOWS.find((f) => f.id === "loner")!;
check("löner: antalet är ett svarskort med fyra val", wages.steps.find((s) => s.id === "antal")?.kind === "choice" && wages.steps.find((s) => s.id === "antal")?.options?.length === 4);
const wagesUi = wages.assess({ saknas: "200 000", antal: "6–20", skatt: "ja" });
check("löner: valet återges i bedömningen", wagesUi.paragraphs[0].includes("6–20 anställda"));
check("löner: lönegarantin i lägesbilden som trygghet", !!wagesUi.snapshot?.some((r) => r.label === "Lönegarantin" && r.tone === "success"));

const kfmUi = kfm.assess(SAMPLE_ANSWERS.kronofogden);
check("kfm: tidslinjen anpassas efter bestridandet", !!kfmUi.plan?.some((r) => r.label.includes("Bestrid")));
check("kfm: utan bestridande föreslås avbetalningsplan", !!kfm.assess({ ...SAMPLE_ANSWERS.kronofogden, bestrider: "nej" }).plan?.some((r) => r.label.includes("avbetalningsplan")));

const snapshotRows = buildCaseSnapshot({ coverageRatio: 34, passedDeadlines: 1, daysToNextDeadline: 4, kbrDone: false });
check("lägesbilden: tre rader alltid", snapshotRows.length === 3);
check("lägesbilden: låg täckning är kritisk och citeras", snapshotRows[0].tone === "critical" && snapshotRows[0].note.includes("34 %"));
check("lägesbilden: passerad frist är kritisk", snapshotRows[1].tone === "critical");
check("lägesbilden: ogjord KBR varnar", snapshotRows[2].tone === "warning");
check("lägesbilden: lugnt läge är grönt", buildCaseSnapshot({ coverageRatio: 120, passedDeadlines: 0, daysToNextDeadline: 30, kbrDone: true }).every((r) => r.tone === "success"));

/* --- ärendeminnet: arbetsmodellen och sedan sist --------------------------- */

import { buildWorkingModel, sinceLastVisit } from "../src/lib/advisor/memory";
import type { AuditEventRecord, CaseDecisionRecord, CaseMemberRecord, CaseRecord } from "../src/data/types";

const CASE: CaseRecord = {
  id: "c1",
  companyName: "Trygg Bil Stockholm AB",
  orgNumber: "556000-0001",
  employees: 12,
  totalDebt: "1 200 000",
  quickLiquidationValue: "400 000",
  recommendationType: "reconstruction",
} as unknown as CaseRecord;

const DECISIONS: CaseDecisionRecord[] = [
  {
    id: "d1", caseId: "c1", title: "Avvakta rekonstruktion", rationale: "r",
    premise: "Positivt kassaflöde inom sex veckor", decidedAt: "2026-08-01T09:00:00Z",
    status: "active", reconsideredAt: null, reconsiderNote: null,
  },
];

const MEMBERS: CaseMemberRecord[] = [
  { id: "m1", caseId: "c1", userId: "u1", role: "owner", displayName: "Erik", email: "erik@x.se", createdAt: "2026-08-01", revokedAt: null } as CaseMemberRecord,
  { id: "m2", caseId: "c1", userId: "u2", role: "auditor", displayName: "Björn", email: "bjorn@x.se", createdAt: "2026-08-01", revokedAt: null } as CaseMemberRecord,
];

const model = buildWorkingModel({
  caseRecord: CASE,
  decisions: DECISIONS,
  members: MEMBERS,
  nextDeadline: { label: "Skattens förfallodag", daysLeft: 9 },
  kbrDone: false,
});
const flat = JSON.stringify(model);

check("modellen: bolaget med org.nr", flat.includes("Trygg Bil Stockholm AB (556000-0001)"));
check("modellen: skuldtäckningen räknad (33 %)", flat.includes("33 % vid snabb avyttring"));
check("modellen: målet ur rekommendationen", flat.includes("rekonstruktion och säkra fortsatt drift"));
check("modellen: närmaste fristen med dagar", flat.includes("Skattens förfallodag (om 9 dagar)"));
check("modellen: beslutet ur beslutsminnet", flat.includes("Avvakta rekonstruktion"));
check("modellen: relationsminnet vet vem Björn är", flat.includes("Björn") && /Björn[^}]*[Rr]evisor/.test(flat));
check("modellen: varje rad har källa", model.every((s) => s.rows.every((r) => r.source.startsWith("ur "))));

const EVENTS: AuditEventRecord[] = [
  { id: 1, caseId: "c1", actorUserId: null, actorRole: null, action: "insert", objectType: "case_documents", objectId: null, detail: "likviditetsprognos.pdf", occurredAt: "2026-08-02T10:00:00Z" },
  { id: 2, caseId: "c1", actorUserId: null, actorRole: null, action: "insert", objectType: "case_decisions", objectId: null, detail: "beslut: \"Avvakta rekonstruktion\"", occurredAt: "2026-08-02T11:00:00Z" },
  { id: 3, caseId: "c1", actorUserId: null, actorRole: null, action: "insert", objectType: "advisor_sessions", objectId: null, detail: "samtal", occurredAt: "2026-08-02T12:00:00Z" },
  { id: 4, caseId: "c1", actorUserId: null, actorRole: null, action: "insert", objectType: "case_documents", objectId: null, detail: "gammal.pdf", occurredAt: "2026-07-01T10:00:00Z" },
];

const since = sinceLastVisit(EVENTS, "2026-08-01T00:00:00Z");
check("sedan sist: nya dokument rapporteras", since.some((l) => l.includes("likviditetsprognos.pdf")));
check("sedan sist: beslut rapporteras", since.some((l) => l.includes("Avvakta rekonstruktion")));
check("sedan sist: egna samtal räknas inte som nytt", !since.some((l) => l.includes("samtal")));
check("sedan sist: gamla händelser filtreras bort", !since.some((l) => l.includes("gammal.pdf")));
check("sedan sist: första besöket är tomt (inget att påstå)", sinceLastVisit(EVENTS, null).length === 0);

/* --- källmärkningen -------------------------------------------------------- */

for (const flow of DIALOG_FLOWS) {
  const a = flow.assess(SAMPLE_ANSWERS[flow.id]);
  check(`${flow.id}: bedömningen bär källmärkning`, a.confidence.level === "medium" && a.confidence.note.length > 20);
}

/* --- Det viktigaste nu ------------------------------------------------------ */

import { buildPriorities } from "../src/lib/advisor/dialog";

const crisisPrio = buildPriorities({ coverageRatio: 28, passedDeadlines: 1, daysToNextDeadline: 10, nextDeadlineLabel: "Skattens förfallodag", kbrDone: false });
check("prioriteringar: aldrig fler än tre", crisisPrio.length === 3);
check("prioriteringar: passerad frist överst", crisisPrio[0].label.includes("passerade fristen"));
check("prioriteringar: nästa frist med dagar", crisisPrio[1].label.includes("skattens förfallodag") && crisisPrio[1].label.includes("10 dagar"));
check("prioriteringar: KBR som tredje", crisisPrio[2].href === "/kbr");
check("prioriteringar: lugnt läge ger ändå ett nästa steg", buildPriorities({ coverageRatio: 120, passedDeadlines: 0, daysToNextDeadline: 40, nextDeadlineLabel: "Årsstämman", kbrDone: true }).length === 1);
check("prioriteringar: alla vägar är interna", crisisPrio.every((p) => p.href.startsWith("/")));

/* --- Action Contract: inbjudan --------------------------------------------- */

import { EMAIL_SHAPE, INVITE_CONTRACT, inviteIntent } from "../src/lib/advisor/dialog";

check("intent: 'jag behöver min revisor' → revisor", inviteIntent("Jag behöver min revisor") === "auditor");
check("intent: 'kan vi koppla in en jurist' → jurist", inviteIntent("kan vi koppla in en jurist?") === "legal_advisor");
check("intent: 'bjud in advokaten' → jurist", inviteIntent("bjud in advokaten") === "legal_advisor");
check("intent: att bara nämna revisorn räcker inte", inviteIntent("revisorn var nöjd i fjol") === null);
check("intent: krisflödena krockar inte", inviteIntent("jag kan inte betala momsen") === null);

check("kontraktet: förstå-steget citerar adress och roll", INVITE_CONTRACT.understand("bjorn@revision.se", "Revisor").includes("bjorn@revision.se"));
check("kontraktet: kontrollera-steget säger vad som INTE händer", INVITE_CONTRACT.control("beskrivning").some((l) => l.includes("Jag ändrar ingenting")));
check("kontraktet: länkregeln står i frågan", INVITE_CONTRACT.askEmail("Revisor").includes("exakt den adressen"));
check("kontraktet: verifieringen är journalmedveten", INVITE_CONTRACT.verifySuccess("a@b.se").includes("journalförd"));
check("kontraktet: misslyckande ljuger inte", INVITE_CONTRACT.verifyFailure("adressen har redan en inbjudan.").includes("Ingenting har journalförts som skickat"));
check("kontraktet: e-postformen prövas", EMAIL_SHAPE.test("namn@byran.se") && !EMAIL_SHAPE.test("inte en adress"));
check("kontraktet: ordet AI förekommer inte", !/\bAI\b/i.test(JSON.stringify(INVITE_CONTRACT.control("x")) + INVITE_CONTRACT.askEmail("Revisor")));

/* --- svarsformatering för journalen ---------------------------------------- */

check("answerLabel: ja/nej normaliseras", answerLabel({ id: "x", prompt: "", kind: "yesno" }, "JA, tyvärr") === "Ja");
check("answerLabel: belopp formateras svenskt", answerLabel({ id: "x", prompt: "", kind: "amount" }, "150000") === "150 000");
check("answerLabel: fritext trimmas", answerLabel({ id: "x", prompt: "", kind: "text" }, "  hej  ") === "hej");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
