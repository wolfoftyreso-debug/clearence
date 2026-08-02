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

/* --- varje flöde: komplett väg till bedömning ------------------------------ */

const SAMPLE_ANSWERS: Record<string, Record<string, string>> = {
  skatt: { saknas: "150 000 kr", loner: "ja", fordringar: "80 000", kbr: "nej" },
  loner: { saknas: "200 000", antal: "8", skatt: "ja" },
  kundforlust: { belopp: "100 000", forsenad: "45", paminnelse: "ja" },
  kronofogden: { belopp: "75 000", bestrider: "ja", fler: "nej" },
  banken: { vad: "nej till utökad kredit", belopp: "500 000", sakerheter: "ja" },
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

check("Clara hälsar med förnamn, sparsamt", CLARA.greeting("Erik Andersson").startsWith("Hej Erik."));
check("Clara hälsar utan namn när det saknas", CLARA.greeting(null).startsWith("Hej."));
check("onboardingen har fem situationsval", ONBOARDING.situations.length === 5);
check("onboardingen frågar EN sak i taget", ONBOARDING.intro[ONBOARDING.intro.length - 1].includes("Vad heter du?"));
check("Clara navigerar själv till nulägesanalysen", ONBOARDING.closing.join(" ").includes("Jag öppnar nu nulägesanalysen"));

const checkIn = decisionCheckIn({
  title: "Hantera skattebristen före förfallodagen",
  premise: "Beslutet vilar på att 150 000 kr saknas.",
  decidedAt: "2026-08-01T09:00:00Z",
});
check("beslutsuppföljningen citerar premissen", checkIn.includes("150 000 kr saknas"));
check("beslutsuppföljningen frågar om planen står fast", checkIn.includes("Är det fortfarande planen?"));
check("beslutsuppföljningen anger datumet", /Den 1 augusti/.test(checkIn));

/* --- svarsformatering för journalen ---------------------------------------- */

check("answerLabel: ja/nej normaliseras", answerLabel({ id: "x", prompt: "", kind: "yesno" }, "JA, tyvärr") === "Ja");
check("answerLabel: belopp formateras svenskt", answerLabel({ id: "x", prompt: "", kind: "amount" }, "150000") === "150 000");
check("answerLabel: fritext trimmas", answerLabel({ id: "x", prompt: "", kind: "text" }, "  hej  ") === "hej");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
