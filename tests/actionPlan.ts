/**
 * Tester för handlingsplanens nedräkning.
 *
 * Formuleringen testas, inte bara talet: "idag" mot "om 0 dagar" är
 * skillnaden mellan en varning som läses och en som skummas förbi, och en
 * frist som visas fel är ett fel med rättslig innebörd.
 */

import { countdownTo } from "../src/lib/actionPlan";

let passed = 0;
let failed = 0;
const check = (name: string, actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${name}\n     fick      ${JSON.stringify(actual)}\n     förväntat ${JSON.stringify(expected)}`);
  }
};

// Kvällen den 11:e: fristen den 12:e är "imorgon" oavsett klockslag -
// kalenderdagar, inte 24-timmarsperioder.
const eveningBefore = new Date("2026-08-11T22:30:00");

check("imorgon även sent på kvällen", countdownTo("2026-08-12", eveningBefore), {
  daysLeft: 1,
  label: "imorgon",
  tone: "soon",
});

const noon = new Date("2026-08-12T12:00:00");
check("förfallodagen är idag, hela dagen", countdownTo("2026-08-12", noon), {
  daysLeft: 0,
  label: "idag",
  tone: "today",
});
check("tre dagar kvar varnar", countdownTo("2026-08-15", noon).tone, "soon");
check("fyra dagar kvar är lugnt", countdownTo("2026-08-16", noon).tone, "later");
check("fyra dagar formuleras", countdownTo("2026-08-16", noon).label, "om 4 dagar");

// Passerade frister är olösta problem, inte historia.
check("igår heter igår", countdownTo("2026-08-11", noon), {
  daysLeft: -1,
  label: "igår",
  tone: "passed",
});
check("längre tillbaka räknas ut", countdownTo("2026-08-01", noon).label, "för 11 dagar sedan");
check("passerad ton", countdownTo("2026-08-01", noon).tone, "passed");

// Tidsstämplar med klockslag klipps till dagen.
check(
  "ISO med klockslag hanteras",
  countdownTo("2026-08-14T09:00:00.000Z", noon).label,
  "om 2 dagar",
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
