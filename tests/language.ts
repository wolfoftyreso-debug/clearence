/**
 * Tester för det adaptiva språket.
 *
 * Det viktigaste löftet är negativt: förenklingen får ALDRIG ändra
 * innebörden. Testerna kontrollerar att siffror, belopp och datum är
 * orörda tecken för tecken på alla nivåer, att begrepp förklaras i stället
 * för att bytas ut, och att ordlistans förklaringar håller tonen - saklig,
 * aldrig skrämmande.
 */

import { adaptText, GLOSSARY, LANGUAGE_LEVELS, segmentText, findGlossaryEntry } from "../src/lib/language";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra = "") => {
  if (ok) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${name} ${extra}`);
  }
};

/** Alla siffror i en text, i ordning - förenklingens invariant. */
const digitsOf = (text: string): string => (text.match(/\d+/g) ?? []).join(",");

check("fyra nivåer finns", LANGUAGE_LEVELS.length === 4);
check(
  "nivåernas ordning: juridiskt → standard → förenklad → mycket enkel",
  LANGUAGE_LEVELS.map((l) => l.id).join(",") === "legal,standard,simple,very_simple",
);

/* --- ordlistan ------------------------------------------------------------- */
check("ordlistan täcker kärnbegreppen", ["kontrollbalansräkning", "företagsrekonstruktion", "konkurs", "obestånd", "personligt betalningsansvar", "borgenär", "frist"].every(
  (term) => GLOSSARY.some((e) => e.term === term),
));
check(
  "produktkravets exempel: personligt ansvar förklaras med 'agera i tid', inte skräck",
  GLOSSARY.find((e) => e.term === "personligt betalningsansvar")!.explanation.includes("agera i tid"),
);
check(
  "ingen förklaring skränar",
  GLOSSARY.every((e) => !e.explanation.includes("!") && !/hotas|katastrof|panik/i.test(e.explanation)),
);
check(
  "rekonstruktion förklaras som produktkravet skriver den",
  GLOSSARY.find((e) => e.term === "företagsrekonstruktion")!.explanation.startsWith(
    "Det betyder att företaget försöker lösa sina ekonomiska problem och fortsätta verksamheten i stället för att gå i konkurs",
  ),
);

/* --- segmentering ---------------------------------------------------------- */
const segments = segmentText("Styrelsen ska upprätta en kontrollbalansräkning före fristen.");
check("segmentering hittar begreppen", segments.filter((s) => s.entry).length === 2);
check(
  "längsta varianten vinner: kontrollbalansräkning delas inte",
  segments.some((s) => s.entry?.term === "kontrollbalansräkning" && s.text === "kontrollbalansräkning"),
);
check("versaler känns igen", segmentText("Konkurs är en domstolsprocess.")[0].entry?.term === "konkurs");
check("okända ord får ingen post", findGlossaryEntry("styrelsen") === null);

/* --- nivåerna: legal och standard är orörda -------------------------------- */
const original =
  "Kontrollbalansräkningen ska upprättas skyndsamt; underlåtenhet kan medföra personligt betalningsansvar för styrelsen, och fristen löper från den 12 augusti 2026 med 165 000 kr i obetald skatt.";
check("legal: originaltexten", adaptText(original, "legal") === original);
check("standard: originaltexten", adaptText(original, "standard") === original);

/* --- förenklad svenska ----------------------------------------------------- */
const simple = adaptText(original, "simple");
check("simple: begreppet förklaras direkt i texten", simple.includes("(det betyder:"));
check("simple: siffrorna är orörda", digitsOf(simple) === digitsOf(original), digitsOf(simple));
check("simple: beloppet exakt kvar", simple.includes("165 000 kr"));
check("simple: datumet exakt kvar", simple.includes("12 augusti 2026"));

const twice = adaptText("En frist är viktig. Missa aldrig en frist.", "simple");
check(
  "simple: bara första förekomsten förklaras",
  (twice.match(/\(det betyder:/g) ?? []).length === 1,
  twice,
);

/* --- mycket enkel svenska -------------------------------------------------- */
const verySimple = adaptText(original, "very_simple");
check("very_simple: siffrorna är orörda", digitsOf(verySimple) === digitsOf(original), digitsOf(verySimple));
check("very_simple: semikolonmeningen är delad", !verySimple.includes(";"));
check(
  "very_simple: kortare meningar än originalet",
  verySimple.split(/(?<=[.!?])\s+/).length > original.split(/(?<=[.!?])\s+/).length,
);
check("very_simple: 'upprättas' har blivit 'tas fram'", /tas fram/.test(verySimple), verySimple);
check("very_simple: förklaringen finns med", verySimple.includes("(det betyder:"));

const swap = adaptText("Samtliga dokument ska dokumenteras.", "very_simple");
check("very_simple: ordbyten med versal i behåll", swap.startsWith("Alla"), swap);

/* --- innebörden består ----------------------------------------------------- */
check(
  "inga juridiska termer raderas - de förklaras",
  simple.toLowerCase().includes("kontrollbalansräkning") &&
    simple.toLowerCase().includes("personligt betalningsansvar"),
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
