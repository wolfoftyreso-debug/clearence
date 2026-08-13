/**
 * INTRODUKTIONEN: kontot, bakgrundsarbetet, intervjun och första analysen.
 *
 * Det som testas är löftena, inte implementationen:
 *
 *  - att välkomsten säger hur lång tid det tar,
 *  - att lösenordet aldrig hamnar i en text som visas i samtalet,
 *  - att bakgrundspanelen ALDRIG markerar ett moment som klart när
 *    källan inte är ansluten - det är filens hela existensberättigande,
 *  - att formuleringen om insamlingen är den avtalade, och att
 *    "all information den kan" inte finns någonstans,
 *  - att intervjun är adaptiv och kortare när läget är akut,
 *  - att första analysen förankrar varje observation i ett svar och
 *    alltid säger vad den inte är,
 *  - att telefonnumret inte efterfrågas förrän premiumsteget.
 */

import { ONBOARDING } from "../src/lib/advisor/dialog";
import { sourceById } from "../src/lib/sources/registry";
import {
  BACKGROUND_STEPS,
  backgroundSummary,
  backgroundTasks,
  DISCLOSURE,
  type BackgroundContext,
} from "../src/lib/advisor/backgroundWork";
import {
  applyAnswer,
  deriveRiskLevel,
  emptyProfile,
  PROFILE_LABELS,
  profileFilled,
  profileRows,
} from "../src/lib/advisor/companyProfile";
import {
  applicableQuestions,
  interviewProgress,
  INTERVIEW,
  isAcute,
  isAnswered,
  nextQuestion,
} from "../src/lib/advisor/interview";
import { buildFirstAnalysis } from "../src/lib/advisor/firstAnalysis";
import { wizardEmployees } from "../src/lib/advisor/onboardingHandoff";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra: unknown = "") => {
  if (ok) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${name} ${typeof extra === "string" ? extra : JSON.stringify(extra)}`);
  }
};

/* --- 1. välkomsten --------------------------------------------------------- */

check("välkomsten hälsar", ONBOARDING.welcome.body[0].startsWith("Välkommen!"));
check(
  "välkomsten säger vad tjänsten gör",
  /analysera företagets situation/.test(ONBOARDING.welcome.body.join(" ")),
);
check(
  "välkomsten säger hur lång tid det tar",
  /3–5 minuter/.test(ONBOARDING.welcome.body.join(" ")),
  ONBOARDING.welcome.body.join(" "),
);

/* --- 2. kontot ------------------------------------------------------------- */

check("fyra grunduppgifter i ett svep", ONBOARDING.fields.length === 4, ONBOARDING.fields.length);
check(
  "fälten är namn, företag, orgnr och e-post",
  ONBOARDING.fields.map((f) => f.id).join("|") === "name|company|orgNumber|email",
  ONBOARDING.fields.map((f) => f.id),
);
// Lösenordet får inte vara ett av de fyra: de renderas som vanliga fält.
check(
  "lösenordet är inte ett av grundfälten",
  !ONBOARDING.fields.some((f) => /lösenord|password/i.test(f.id + f.label)),
);
check("lösenordssteget ber om ett lösenord", ONBOARDING.password.lead === "Välj ett lösenord.");
check("kontot kvitteras", ONBOARDING.password.created === "Konto skapat.");
check(
  "arbetet börjar direkt efter kontot",
  ONBOARDING.afterAccount[0].includes("Jag börjar nu skapa en bild av företaget"),
);
check(
  "och användaren får veta varför frågorna kommer",
  ONBOARDING.afterAccount[1].includes("lära känna verksamheten"),
);

/* --- 3. bakgrundsarbetet: får inte ljuga ----------------------------------- */

const ctx: BackgroundContext = {
  companyName: "Testbolaget AB",
  orgNumber: "556012-3456",
  registryHit: true,
  answered: 8,
  profileFields: 7,
};
const allDone = backgroundTasks(ctx, BACKGROUND_STEPS);

check("alla moment redovisas", allDone.length === BACKGROUND_STEPS && BACKGROUND_STEPS >= 10);
check(
  "inget moment står kvar som pågående när körningen är klar",
  allDone.every((t) => t.state !== "pagar"),
);

// Webbplatsläsaren är byggd OCH påslagen, men hämtar en riktig sida först
// i skarp drift. I demoläget (websiteFetched saknas) får den varken bockas
// av eller sägas sakna källa - den blir live i drift. Det är skillnaden
// mellan en ärlig tom ruta och en nedslående.
{
  const webb = allDone.find((t) => t.id === "webbplats")!;
  check(`"webbplats" påstår inte att det gjorts`, webb.state === "i-drift", webb.state);
  check(`"webbplats" ramas som byggt, inte saknat`, /Byggd och påslagen/.test(webb.note), webb.note);
  // Och när sidan FAKTISKT hämtats en körning blir den klar, inte i-drift.
  const medHamtning = backgroundTasks({ ...ctx, websiteFetched: true }, BACKGROUND_STEPS)
    .find((t) => t.id === "webbplats")!;
  check(`"webbplats" blir klar när sidan hämtats`, medHamtning.state === "klar", medHamtning.state);
}

// Nyhetsbevakningen: samma resonemang som webbplatsen, sedan RSS-källan
// kopplades på. Flödena läses mot ett riktigt bolagsnamn först i skarp
// drift, så utan hämtning är den i-drift - varken klar eller saknad.
{
  const nyheter = allDone.find((t) => t.id === "nyheter")!;
  check(`"nyheter" påstår inte att det gjorts`, nyheter.state === "i-drift", nyheter.state);
  check(`"nyheter" ramas som byggt, inte saknat`, /Byggd och påslagen/.test(nyheter.note), nyheter.note);
  // Och den ska säga vad som INTE hämtas: artikeltexten är upphovsrättsskyddad.
  check(`"nyheter" lovar inte artikeltexten`, /aldrig artikeltexten/.test(nyheter.note), nyheter.note);

  const medTraffar = backgroundTasks({ ...ctx, newsHits: 2 }, BACKGROUND_STEPS)
    .find((t) => t.id === "nyheter")!;
  check(`"nyheter" blir klar när flödena hämtats`, medTraffar.state === "klar", medTraffar.state);
  check(`"nyheter" räknar träffarna`, /2 artiklar/.test(medTraffar.note), medTraffar.note);

  // Noll träffar är ett SVAR, inte ett uteblivet svar. Raden ska bli klar
  // och säga att ingenting hittades - inte se ut som att källan saknas.
  const utanTraffar = backgroundTasks({ ...ctx, newsHits: 0 }, BACKGROUND_STEPS)
    .find((t) => t.id === "nyheter")!;
  check(`noll träffar är ett svar, inte ett tomrum`, utanTraffar.state === "klar", utanTraffar.state);
  check(
    `och säger att ingen artikel nämnde bolaget`,
    /Ingen artikel nämnde bolaget/.test(utanTraffar.note),
    utanTraffar.note,
  );
}

// Kärnan i hela filen: momenten utan ansluten källa MÅSTE redovisas som
// sådana. Blir något av dem "klar" har någon råkat lova en integration
// som inte finns.
for (const id of ["sociala", "recensioner", "konkurrenter"]) {
  const task = allDone.find((t) => t.id === id)!;
  check(`"${id}" påstår inte att det gjorts`, task.state === "ingen-kalla", task.state);
  /*
   * Kravet är oförändrat: en källa som inte är ansluten ska säga VAD som
   * saknas. Texten kommer numera ur källregistret och är specifik per
   * källa - "avtal med Bolagsverket" respektive "får inte skrapas" i
   * stället för samma generiska mening om alla. Testet prövar därför att
   * skälet finns och är konkret, inte att det är en viss formulering.
   */
  check(`"${id}" säger vad som saknas`, task.note.trim().length > 25, task.note);
  check(
    `"${id}" skälet är källregistrets`,
    task.note === (sourceById(task.source)?.needs ?? ""),
    task.note.slice(0, 50),
  );
}
check(
  "registret redovisas som klart när det svarade",
  allDone.find((t) => t.id === "register")!.state === "klar",
);
check(
  "registret redovisas INTE som klart när det inte svarade",
  backgroundTasks({ ...ctx, registryHit: false }, BACKGROUND_STEPS).find((t) => t.id === "register")!
    .state === "ingen-kalla",
);
check(
  "branschen säger att den kommer ur svaret, inte ur statistik",
  /ditt eget svar/.test(allDone.find((t) => t.id === "bransch")!.note),
);
check(
  "sammanfattningen räknar det som inte kunde göras",
  /kunde inte göras/.test(backgroundSummary(allDone)),
  backgroundSummary(allDone),
);
check(
  "inga moment är klara innan körningen hunnit dit",
  backgroundTasks(ctx, 0).every((t) => t.state === "pagar"),
);

/* --- 4. formuleringen om insamlingen --------------------------------------- */

check(
  "insamlingen beskrivs med den avtalade meningen",
  DISCLOSURE ===
    "Jag samlar in relevant offentlig information om företaget och kombinerar den med det du berättar för att skapa en så träffsäker analys som möjligt.",
  DISCLOSURE,
);
check("den säger att informationen är offentlig", /offentlig information/.test(DISCLOSURE));
check("den säger att den kombineras med det användaren berättar", /det du berättar/.test(DISCLOSURE));
// Motsatsen: den formulering som läses som obehaglig och otydlig.
const allOnboardingText = [
  DISCLOSURE,
  JSON.stringify(ONBOARDING),
  allDone.map((t) => t.label + t.note).join(" "),
].join(" ");
check(
  "ingenstans står att systemet tar in all information det kan",
  !/all(?:\s+den)?\s+information\s+(?:den|som)\s+kan/i.test(allOnboardingText),
);

/* --- 5. intervjun: adaptiv, och kortare när det brinner --------------------- */

check("frågebanken har femton frågor", INTERVIEW.length === 15, INTERVIEW.length);
check("varje fråga säger varför den ställs", INTERVIEW.every((q) => q.why.length > 20));
check("varje fråga har minst tre svarsalternativ", INTERVIEW.every((q) => q.options.length >= 3));
check("inga dubbletter bland frågornas id", new Set(INTERVIEW.map((q) => q.id)).size === INTERVIEW.length);

check("akut läge känns igen på situationsvalet", isAcute("loner", {}));
check("och på företrädaransvaret", isAcute("ansvar", {}));
check("och på användarens eget svar om likviditeten", isAcute("oro", { utmaning: "Likviditeten" }));
check("men inte i ett vanligt läge", !isAcute("oro", {}));

// Det lugna fallet: alla femton frågor är i spel för ett B2B-bolag med
// anställda.
let calm = emptyProfile();
calm = applyAnswer(calm, { employees: "6–20", customers: "B2B" });
check(
  "lugnt läge ger femton frågor",
  applicableQuestions(calm, "oro", {}).length === 15,
  applicableQuestions(calm, "oro", {}).length,
);
// Det akuta fallet: tillväxtfrågorna faller bort.
const acuteQuestions = applicableQuestions(calm, "loner", {});
check("akut läge kortar intervjun till tolv", acuteQuestions.length === 12, acuteQuestions.length);
check(
  "det är marknadsföringsfrågorna som faller bort, inte de ekonomiska",
  !acuteQuestions.some((q) => q.id === "nya-kunder") &&
    acuteQuestions.some((q) => q.id === "omsattning") &&
    acuteQuestions.some((q) => q.id === "utmaning"),
);
// Och för ett enmansbolag som säljer till privatpersoner i akut läge: tio.
let solo = emptyProfile();
solo = applyAnswer(solo, { employees: "1 person", customers: "B2C" });
check(
  "enmansbolag i akut läge får tio frågor",
  applicableQuestions(solo, "loner", {}).length === 10,
  applicableQuestions(solo, "loner", {}).length,
);
check(
  "ingen fråga om organisationen till den som driver ensam",
  !applicableQuestions(solo, "oro", {}).some((q) => q.id === "organisation"),
);
check(
  "ingen fråga om största kundens andel när kunderna är privatpersoner",
  !applicableQuestions(solo, "oro", {}).some((q) => q.id === "beroende"),
);
// Hela spannet ligger inom det utlovade 10-15.
check(
  "antalet frågor håller sig inom tio till femton",
  [
    applicableQuestions(calm, "oro", {}).length,
    applicableQuestions(calm, "loner", {}).length,
    applicableQuestions(solo, "oro", {}).length,
    applicableQuestions(solo, "loner", {}).length,
  ].every((n) => n >= 10 && n <= 15),
);

// En besvarad fråga står kvar i listan, annars räknar "fråga 4 av 12" ner
// medan användaren svarar.
const midway = { anstallda: "6–20 personer", bransch: "Bygg" };
check(
  "besvarade frågor räknas fortfarande in i totalen",
  applicableQuestions(calm, "oro", midway).length === 15,
);
check(
  "nästa fråga är den första obesvarade",
  nextQuestion(calm, "oro", midway)?.id === "erbjudande",
  nextQuestion(calm, "oro", midway)?.id,
);
check("intervjun tar slut", nextQuestion(calm, "oro", Object.fromEntries(INTERVIEW.map((q) => [q.id, "x"]))) === null);

// ATT HOPPA ÖVER ÄR ETT SVAR - svaret "det vill jag inte säga".
//
// Överhoppade frågor lagras som tom sträng, och tom sträng är falsk.
// Motorn läste därför överhoppat som obesvarat och ställde samma fråga
// igen, i evighet: knappen gjorde ingenting och användaren satt fast på
// fråga sex. Det var en riktig återvändsgränd i produkten.
{
  check("nyckeln finns = ställning tagen", isAnswered({ anstallda: "" }, "anstallda"));
  check("saknad nyckel = obesvarad", !isAnswered({}, "anstallda"));

  const skipped = { anstallda: "" };
  check(
    "en överhoppad fråga kommer inte tillbaka",
    nextQuestion(emptyProfile(), "oro", skipped)?.id !== "anstallda",
    nextQuestion(emptyProfile(), "oro", skipped)?.id,
  );
  check(
    "utan att intervjun stannar",
    nextQuestion(emptyProfile(), "oro", skipped) !== null,
  );
  check(
    "och räknaren går framåt",
    interviewProgress(emptyProfile(), "oro", skipped).current === 2,
    interviewProgress(emptyProfile(), "oro", skipped),
  );

  // Hela intervjun överhoppad ska ta slut, inte snurra.
  let prof = emptyProfile();
  const allSkipped: Record<string, string> = {};
  let rounds = 0;
  for (; rounds < 30; rounds += 1) {
    const q = nextQuestion(prof, "loner", allSkipped);
    if (!q) break;
    allSkipped[q.id] = "";
    prof = applyAnswer(prof, {});
  }
  check("en intervju där allt hoppas över tar slut", rounds < 30, rounds);
  check(
    "och den slutar efter rimligt många frågor",
    rounds >= 10 && rounds <= 15,
    rounds,
  );
}
const p = interviewProgress(calm, "oro", midway);
check("förloppet räknar rätt", p.current === 3 && p.total === 15, p);

// Räknaren får bara krympa. Går den från "av 13" till "av 15" mitt i
// intervjun läses det som att mållinjen flyttar sig - och det är det
// säkraste sättet att få någon att sluta svara.
{
  let prof = emptyProfile();
  const given: Record<string, string> = {};
  const totals: number[] = [interviewProgress(prof, "oro", given).total];
  for (let i = 0; i < 20; i += 1) {
    const q = nextQuestion(prof, "oro", given);
    if (!q) break;
    // Värsta fallet för räknaren: svaren som stryker flest frågor.
    const option =
      q.options.find((o) => o.label === "Bara jag") ??
      q.options.find((o) => o.label === "Privatpersoner") ??
      q.options[0];
    given[q.id] = option.label;
    prof = applyAnswer(prof, option.fills);
    totals.push(interviewProgress(prof, "oro", given).total);
  }
  check(
    "antalet frågor växer aldrig under intervjun",
    totals.every((t, i) => i === 0 || t <= totals[i - 1]),
    totals,
  );
  check("intervjun startar på femton", totals[0] === 15, totals[0]);
  check("och krymper när svaren stryker frågor", totals[totals.length - 1] < 15, totals);
}

/* --- 6. profilen ------------------------------------------------------------ */

check("profilen har nio fält", PROFILE_LABELS.length === 9);
check(
  "fälten är de nio som utlovats",
  PROFILE_LABELS.map((f) => f.label).join("|") ===
    "Bransch|Anställda|Omsättning|Kunder|Geografi|Affärsmodell|Tillväxtfas|Risknivå|Digital mognad",
  PROFILE_LABELS.map((f) => f.label),
);
check("en tom profil har noll ifyllda fält", profileFilled(emptyProfile()) === 0);
check(
  "okända fält skrivs ut som okända, inte som tomma",
  profileRows(emptyProfile()).every((r) => r.value === "okänd"),
);
check(
  "ett svar fyller sitt fält",
  profileFilled(applyAnswer(emptyProfile(), { industry: "Bygg" })) === 1,
);
// Det som redan är känt får inte nollställas av en senare fråga som inte
// säger något om fältet.
check(
  "en tom uppdatering raderar inte det som redan är känt",
  applyAnswer(applyAnswer(emptyProfile(), { industry: "Bygg" }), { industry: null }).industry === "Bygg",
);
check(
  "men ett nytt värde får förfina ett tidigare",
  applyAnswer(applyAnswer(emptyProfile(), { businessModel: "Projekt" }), {
    businessModel: "Återkommande intäkter",
  }).businessModel === "Återkommande intäkter",
);

check(
  "akut betalningsläge ger hög risknivå oavsett annat",
  deriveRiskLevel({ situationId: "loner", concentration: "låg", trend: "upp" }) === "Hög",
);
check(
  "friskt bolag ger låg risknivå",
  deriveRiskLevel({ situationId: null, concentration: "låg", trend: "upp" }) === "Låg",
);
check(
  "kundkoncentration och fallande omsättning väger ihop till hög",
  deriveRiskLevel({ situationId: "oro", concentration: "hög", trend: "ner" }) === "Hög",
);

/* --- 7. första analysen ----------------------------------------------------- */

let full = emptyProfile();
full = applyAnswer(full, {
  industry: "Bygg",
  employees: "6–20",
  customers: "B2B",
  geography: "Regionalt",
  businessModel: "Projekt",
  growthPhase: "Vikande",
  digitalMaturity: "Låg",
  riskLevel: "Hög",
});
const analysis = buildFirstAnalysis({
  companyName: "Testbolaget AB",
  profile: full,
  answers: {
    beroende: "Mer än hälften",
    utveckling: "Minskat",
    system: "Nej, vi gör det för hand",
    erbjudande: "Projekt och uppdrag",
    utmaning: "Likviditeten",
    kunder: "Andra företag",
  },
  situationId: "fakturor",
  registryHit: true,
});

check("analysen har en rubrik", analysis.headline.length > 10);
check(
  "den säger vad den förstått om bolaget",
  /Testbolaget AB/.test(analysis.understanding) && /bygg/.test(analysis.understanding),
  analysis.understanding,
);
check("den hittar risker i svaren", analysis.risks.length >= 4, analysis.risks.length);
// Det som skiljer en analys från en spådom: varje punkt bär sitt underlag.
check(
  "varje risk är förankrad i ett svar",
  analysis.risks.every((r) => r.basis.length > 10),
  analysis.risks.map((r) => r.basis),
);
check(
  "underlaget citerar det användaren faktiskt svarade",
  analysis.risks.some((r) => r.basis.includes("Mer än hälften")),
);
check("möjlighetsavsnittet är aldrig tomt", analysis.opportunities.length >= 1);
check(
  "varje möjlighet är också förankrad",
  analysis.opportunities.every((o) => o.basis.length > 10),
);
check("gränserna redovisas alltid", analysis.limits.length >= 1);
check(
  "den säger att det inte är en bedömning av betalningsförmågan",
  /inte en bedömning av betalningsförmågan/.test(analysis.limits.join(" ")),
);
check("den leder vidare till nulägesanalysen", analysis.nextStep.href === "/wizard");

// Tomt underlag: ingen analys ska hittas på.
const nothing = buildFirstAnalysis({
  companyName: "Testbolaget AB",
  profile: emptyProfile(),
  answers: {},
  situationId: null,
  registryHit: false,
});
check("utan svar påstås ingen bild", /ingen bild/.test(nothing.headline), nothing.headline);
check("och det står varför", /inga av frågorna/i.test(nothing.understanding), nothing.understanding);
check("inga risker hittas på ur ingenting", nothing.risks.length === 0);
check("men möjlighetsavsnittet finns ändå", nothing.opportunities.length >= 1);
check(
  "det står att nio fält saknas",
  /9 av 9 fält/.test(nothing.limits.join(" ")),
  nothing.limits,
);
check(
  "och att registret inte svarade",
  /Företagsregistret gav inget svar/.test(nothing.limits.join(" ")),
);

/* --- 8. premium sist, aldrig först ------------------------------------------ */

check("premiumsteget handlar om SMS", ONBOARDING.premium.heading === "SMS-aviseringar");
check(
  "det säger vilka nivåer det ingår i",
  /Clearance Business och Enterprise/.test(ONBOARDING.premium.tiers),
);
check("det räknar upp vad som skickas", ONBOARDING.premium.examples.length === 4);
check(
  "den dagliga VD-sammanfattningen finns med",
  ONBOARDING.premium.examples.includes("Daglig VD-sammanfattning"),
);
check("det går att tacka nej", ONBOARDING.premium.no === "Inte nu");
check("ett nej möts utan påtryckning", /Ingen fara/.test(ONBOARDING.premium.declined));

// Ordningen är hela poängen: numret får inte efterfrågas innan tjänsten
// visat vad den gör. Allt som sägs FÖRE premiumsteget granskas.
const beforePremium = JSON.stringify({
  welcome: ONBOARDING.welcome,
  intro: ONBOARDING.intro,
  fields: ONBOARDING.fields,
  password: ONBOARDING.password,
  afterAccount: ONBOARDING.afterAccount,
  steps: ONBOARDING.steps,
  askSituation: ONBOARDING.askSituation,
  situations: ONBOARDING.situations,
  interviewLead: ONBOARDING.interviewLead,
});
check(
  "inget telefonnummer efterfrågas före premiumsteget",
  !/telefon|mobilnummer|sms/i.test(beforePremium),
  (beforePremium.match(/.{0,40}(telefon|mobilnummer|sms).{0,40}/i) ?? [""])[0],
);
check(
  "och ingen av intervjufrågorna frågar efter det heller",
  !/telefon|mobilnummer/i.test(JSON.stringify(INTERVIEW)),
);

/* --- Överlämningen: fråga aldrig om samma sak två gånger ------------------ */

/*
 * Löftet i onboardingen är att grunduppgifterna sparar tid. Det bröts i
 * nulägesanalysen: den frågade om antalet anställda EN GÅNG TILL, för att
 * de två frågorna använde olika storleksintervall. Bryggan wizardEmployees
 * mappar mellan trapporna - och den här kontrollen binder ihop de två så
 * att de inte kan glida isär i tysthet.
 */

// Onboardingens intervall, direkt ur intervjufrågan (inte hårdkodade här).
const anstalldaFraga = INTERVIEW.find((q) => q.id === "anstallda")!;
const onboardingIntervall = anstalldaFraga.options
  .map((o) => o.fills.employees)
  .filter((v): v is string => typeof v === "string");
check("onboardingen har storleksintervall att lämna över", onboardingIntervall.length >= 4);

// Nulägesanalysens intervall, lästa ur dess källa - så testet ser samma
// knappar som användaren.
const wizardSource = readFileSync(join(process.cwd(), "src/pages/CrisisWizard.tsx"), "utf8");
const wizardMatch = wizardSource.match(/\[('0',[^\]]*'50\+')\]/);
check("nulägesanalysens intervall gick att läsa", wizardMatch !== null);
const wizardIntervall = (wizardMatch?.[1] ?? "")
  .split(",")
  .map((s) => s.trim().replace(/^'|'$/g, ""));
check("de sex knapparna hittades", wizardIntervall.length === 6, wizardIntervall);

// Varje onboardingsvar ska mappa till ett intervall som FAKTISKT finns som
// knapp i analysen. Annars förifylls ett värde ingen knapp kan visa.
for (const bucket of onboardingIntervall) {
  const mapped = wizardEmployees(bucket);
  check(`"${bucket}" mappas till ett analysintervall`, mapped !== null, mapped);
  check(
    `"${bucket}" → "${mapped}" finns som knapp i analysen`,
    mapped !== null && wizardIntervall.includes(mapped),
    mapped,
  );
}

// Okänt och tomt ger null - då står analysens egen fråga kvar, som förut.
check("okänt intervall ger null", wizardEmployees("något helt annat") === null);
check("tomt ger null", wizardEmployees("") === null && wizardEmployees(null) === null);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
