/**
 * Tonalitetsvakten.
 *
 * Två regler ur konstitutionen, gjorda mätbara:
 *
 *  1. Bekräftelser ska vara förankrade i vad användaren faktiskt har
 *     gjort eller bidragit med. Tom beröm ("Bra jobbat!", "Perfekt!")
 *     säger ingenting om arbetet och kostar förtroende hos någon som är
 *     här för att det är allvar.
 *  2. Empati utan sentimentalitet. "Du är inte ensam" och "det kan
 *     kännas överväldigande" är välmenande - och talar om känslan i
 *     stället för om arbetet.
 *
 * Regel 1 och 2 kontrolleras inte bara på konstanterna utan på ALL egen
 * källkod: en förbjuden fras hjälper ingen om den bara är förbjuden i
 * den fil som förbjuder den.
 *
 * Plus onboardingens form: tre fält, sex steg i fast ordning, och en
 * bekräftelse som faktiskt nämner personen och bolaget.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  EMPTY_PRAISE,
  GROUNDED_CONFIRMATION,
  GROUNDING_ANCHORS,
  PERSONALITY,
  SENTIMENTAL,
  confirmContribution,
  emptyPraiseIn,
  insteadOf,
  isGrounded,
  sentimentalIn,
} from "../src/lib/advisor/tone";
import { ONBOARDING } from "../src/lib/advisor/dialog";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (ok) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${name}${extra === undefined ? "" : `\n     ${JSON.stringify(extra)}`}`);
  }
};

/* --- 1. Bekräftelserna är förankrade ------------------------------------- */

const confirmations = Object.entries(GROUNDED_CONFIRMATION);
check("det finns bekräftelser för varje sorts bidrag", confirmations.length >= 5, confirmations.length);

for (const [kind, text] of confirmations) {
  check(`bekräftelsen för ${kind} är inte tom beröm`, emptyPraiseIn(text) === null, text);
  check(`bekräftelsen för ${kind} pekar på arbetet`, isGrounded(text), text);
  check(`bekräftelsen för ${kind} är en mening, inte ett utrop`, !text.includes("!"), text);
}

check(
  "confirmContribution ger de fyra ersättarna användaren bad om",
  confirmContribution("uppgift") === "Det här är värdefull information." &&
    confirmContribution("siffror") === "Nu har vi ett betydligt bättre beslutsunderlag." &&
    confirmContribution("beslut") === "Det här minskar osäkerheten i den fortsatta analysen." &&
    confirmContribution("beskrivning").startsWith("Du beskriver verksamheten med en detaljnivå"),
);

check("förankringsorden pekar på underlaget, inte på personen", GROUNDING_ANCHORS.length >= 5);
check("en bekräftelse om personen räknas inte som förankrad", !isGrounded("Du verkar väldigt duktig."));

/* --- 2. Tom beröm fångas, och har en ersättare --------------------------- */

const banned = ["Bra jobbat!", "Perfekt!", "Du gör rätt.", "Du verkar väldigt kunnig."];
for (const phrase of banned) {
  check(`"${phrase}" fångas som tom beröm`, emptyPraiseIn(phrase) !== null);
  const alternative = insteadOf(phrase);
  check(`"${phrase}" har en ersättare`, alternative !== null && alternative.length > 0);
  check(`ersättaren för "${phrase}" är själv inte tom beröm`, emptyPraiseIn(alternative ?? "") === null);
}
check("varje förbjuden fras har en ersättare", EMPTY_PRAISE.every((p) => p.instead.length > 0));
check("en vanlig mening flaggas inte", emptyPraiseIn("Jag har lagt in beloppet i planen.") === null);
check("ordet perfektion är inte förbjudet", emptyPraiseIn("typografisk perfektion") === null);

/* --- 3. Sentimentaliteten är borta --------------------------------------- */

check("den gamla empatifrasen fångas", sentimentalIn("Du är inte ensam.") !== null);
check("överväldigande fångas", sentimentalIn("Det kan kännas överväldigande.") !== null);
check("sakliga meningar flaggas inte", sentimentalIn("Vi tar en fråga i taget.") === null);
check("det finns minst fyra sentimentala mönster", SENTIMENTAL.length >= 4);

/* --- 4. Personligheten --------------------------------------------------- */

check("personligheten har sex drag", PERSONALITY.length === 6, PERSONALITY.length);
check(
  "empatin är avgränsad i själva formuleringen",
  PERSONALITY.some((p) => /empatisk utan att bli känslosam/i.test(p)),
);
check(
  "frågor ska ha ett syfte",
  PERSONALITY.some((p) => /tydligt syfte/i.test(p)),
);

/* --- 5. Onboardingens form ----------------------------------------------- */

check("onboardingen visar tre fält", ONBOARDING.fields.length === 3, ONBOARDING.fields.map((f) => f.label));
check(
  "fälten är namn, företag och organisationsnummer",
  ONBOARDING.fields.map((f) => f.label).join("|") ===
    "Ditt namn|Företagsnamn|Organisationsnummer",
);
check("knappen heter Fortsätt", ONBOARDING.submitLabel === "Fortsätt");
check("introduktionen presenterar CLEARANCE", ONBOARDING.intro[0].includes("Jag heter CLEARANCE"));
check("introduktionen ber om grunduppgifter", ONBOARDING.intro[0].includes("grunduppgifter"));
check(
  "introduktionen frågar inte längre en sak i taget",
  !ONBOARDING.intro.join(" ").includes("Vad heter du?"),
);
check(
  "introduktionen är inte sentimental",
  sentimentalIn(ONBOARDING.intro.join(" ")) === null,
  ONBOARDING.intro.join(" "),
);
check(
  "introduktionen normaliserar situationen utan att omhänderta",
  ONBOARDING.intro.join(" ").includes("Många företag hamnar någon gång"),
);

const confirm = ONBOARDING.confirm("Erik Andersson", "Trygg Bil Stockholm AB", "556012-3456");
check("bekräftelsen använder förnamnet", confirm.startsWith("Tack Erik."));
check("bekräftelsen nämner bolaget", confirm.includes("Trygg Bil Stockholm AB"));
check("bekräftelsen nämner organisationsnumret", confirm.includes("556012-3456"));
check("bekräftelsen lovar struktur och dokumentation", /struktur/.test(confirm) && /dokumentera/.test(confirm));
check("bekräftelsen säger att man kan pausa", /pausa/.test(confirm));
check("bekräftelsen är inte tom beröm", emptyPraiseIn(confirm) === null);
check(
  "utan organisationsnummer blir det ingen tom parentes",
  !ONBOARDING.confirm("Erik", "Eriks Bygg AB", "").includes("()"),
);

check("processen har sex steg", ONBOARDING.steps.length === 6);
check(
  "stegen står i den bestämda ordningen",
  ONBOARDING.steps.map((s) => s.label).join("|") ===
    "Kontaktperson|Företagsuppgifter|Kort nuläge|Prioriterade problem|Tidskritiska händelser|Dokumentinsamling",
  ONBOARDING.steps.map((s) => s.label),
);
check("stegen är numrerade 1-6", ONBOARDING.steps.every((s, i) => s.n === i + 1));
check("varje steg har ett syfte", ONBOARDING.steps.every((s) => s.purpose.length > 10));

check(
  "uppslaget bekräftas först när det har hänt",
  ONBOARDING.lookupDone.includes("Jag har identifierat företaget"),
);
check(
  "ett misslyckat uppslag stoppar ingenting",
  /stoppar ingenting|kompletterar/.test(ONBOARDING.lookupMiss),
);
check("nulägesfrågan är märkt med sitt steg", ONBOARDING.askSituation.includes("Steg 3 av 6"));
check("det finns fem lägesval", ONBOARDING.situations.length === 5);
check(
  "avslutet är förankrat i det användaren lämnade",
  ONBOARDING.closing[0].includes("underlag") && emptyPraiseIn(ONBOARDING.closing[0]) === null,
);
check(
  "CLEARANCE navigerar själv till nulägesanalysen",
  ONBOARDING.closing.join(" ").includes("Jag öppnar nu nulägesanalysen"),
);

/* --- 6. Reglerna gäller ALL egen källkod --------------------------------- */

const files: string[] = [];
const walk = (dir: string) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      // Vendorerade primitiver bär bibliotekets egen text.
      if (full.includes(join("components", "ui"))) continue;
      walk(full);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      // tone.ts är undantagen med flit: det är där fraserna får stå,
      // just för att de ska gå att förbjuda någon annanstans.
      if (full.endsWith(join("advisor", "tone.ts"))) continue;
      files.push(full);
    }
  }
};
walk(join(process.cwd(), "src"));
check("källfilerna hittades", files.length > 50, files.length);

const praiseHits: string[] = [];
const sentimentHits: string[] = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  const praise = emptyPraiseIn(text);
  if (praise) praiseHits.push(`${file}: ${praise}`);
  const sentiment = sentimentalIn(text);
  if (sentiment) sentimentHits.push(`${file}: ${sentiment}`);
}
check("ingen tom beröm i produkten", praiseHits.length === 0, praiseHits);
check("ingen sentimentalitet i produkten", sentimentHits.length === 0, sentimentHits);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
