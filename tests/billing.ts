/**
 * Tester för kontots livscykel.
 *
 * Det som testas hårdast är gränserna. En avstängning som inträffar en dag
 * för tidigt låser ute ett bolag som fortfarande hade tid på sig, och en som
 * inträffar en dag för sent är den sortens fel ingen upptäcker.
 */

import {
  TRIAL_DAYS,
  WARNING_DAYS,
  billingMessage,
  billingState,
  daysBetween,
  trialEndsAt,
  type AccountBilling,
} from "../src/lib/billing";

let passed = 0;
let failed = 0;

const check = (name: string, actual: unknown, expected: unknown) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed += 1;
  } else {
    failed += 1;
    console.log(`FAIL ${name}\n     fick      ${a}\n     förväntat ${e}`);
  }
};

const day = (iso: string) => new Date(`${iso}T09:00:00.000Z`);
const account = (over: Partial<AccountBilling> = {}): AccountBilling => ({
  startedAt: "2026-08-01T09:00:00.000Z",
  dueAt: null,
  paidAt: null,
  closedAt: null,
  ...over,
});

/* -------------------------------------------------------------------------- */
/* Datumräkning                                                               */
/* -------------------------------------------------------------------------- */

check("samma dag = 0 dagar kvar", daysBetween(day("2026-08-01"), day("2026-08-01")), 0);
check("nästa dag = 1", daysBetween(day("2026-08-01"), day("2026-08-02")), 1);
check("igår = -1", daysBetween(day("2026-08-02"), day("2026-08-01")), -1);

check(
  "gratisperioden är sju dagar",
  trialEndsAt("2026-08-01T09:00:00.000Z").toISOString().slice(0, 10),
  "2026-08-08",
);

/* -------------------------------------------------------------------------- */
/* Gratisperioden                                                             */
/* -------------------------------------------------------------------------- */

check("dag 1: trial, ingen varning", billingState(account(), day("2026-08-01")).status, "trial");
check("dag 1: ingen varning", billingState(account(), day("2026-08-01")).shouldWarn, false);
check("dag 1: sju dagar kvar", billingState(account(), day("2026-08-01")).daysLeft, TRIAL_DAYS);
check("dag 1: inte låst", billingState(account(), day("2026-08-01")).isLocked, false);

// Varningen ska börja exakt på gränsen, inte dagen efter.
check(
  `varning börjar vid ${WARNING_DAYS} dagar kvar`,
  billingState(account(), day("2026-08-05")).shouldWarn,
  true,
);
check(
  "ingen varning vid fyra dagar kvar",
  billingState(account(), day("2026-08-04")).shouldWarn,
  false,
);

// Sista dagen ska fortfarande ge åtkomst. Att låsa på dag noll vore att ta
// en dag från någon som betalar samma kväll.
check("sista dagen: noll kvar", billingState(account(), day("2026-08-08")).daysLeft, 0);
check("sista dagen: inte låst", billingState(account(), day("2026-08-08")).isLocked, false);

// Dagen efter är den första som låser.
check("dagen efter: stängt", billingState(account(), day("2026-08-09")).status, "closed");
check("dagen efter: låst", billingState(account(), day("2026-08-09")).isLocked, true);

/* -------------------------------------------------------------------------- */
/* Fakturerat                                                                 */
/* -------------------------------------------------------------------------- */

const invoiced = account({ dueAt: "2026-08-20T09:00:00.000Z" });

check("fakturerat innan förfall", billingState(invoiced, day("2026-08-10")).status, "invoiced");
check("förfallodagen räknas ned mot", billingState(invoiced, day("2026-08-18")).daysLeft, 2);
check("förfallodagen låser inte", billingState(invoiced, day("2026-08-20")).isLocked, false);
check("dagen efter förfall låser", billingState(invoiced, day("2026-08-21")).isLocked, true);

// Förfallodagen tar över från gratisperioden. Utan det skulle en faktura med
// längre kredittid ändå stängas på dag åtta.
check(
  "förfallodagen slår gratisperiodens slut",
  billingState(invoiced, day("2026-08-12")).status,
  "invoiced",
);

/* -------------------------------------------------------------------------- */
/* Betalt och återöppning                                                     */
/* -------------------------------------------------------------------------- */

check(
  "betalt = aktivt",
  billingState(account({ paidAt: "2026-08-05T09:00:00.000Z" }), day("2026-08-05")).status,
  "active",
);
check(
  "betalt låser aldrig",
  billingState(account({ paidAt: "2026-08-05T09:00:00.000Z" }), day("2026-09-30")).isLocked,
  false,
);

// Det viktiga fallet: någon betalar efter att kontot stängts. Då ska det
// öppnas, inte fortsätta vara stängt för att closedAt ligger kvar.
check(
  "betalning efter stängning öppnar igen",
  billingState(
    account({ closedAt: "2026-08-09T09:00:00.000Z", paidAt: "2026-08-15T09:00:00.000Z" }),
    day("2026-08-16"),
  ).isLocked,
  false,
);

check(
  "uttryckligt closedAt låser",
  billingState(account({ closedAt: "2026-08-03T09:00:00.000Z" }), day("2026-08-04")).isLocked,
  true,
);
// En stängning som är daterad i framtiden gäller inte än.
check(
  "framtida closedAt låser inte",
  billingState(account({ closedAt: "2026-08-07T09:00:00.000Z" }), day("2026-08-04")).isLocked,
  false,
);

/* -------------------------------------------------------------------------- */
/* Texterna                                                                   */
/* -------------------------------------------------------------------------- */

check(
  "aktivt konto får ingen text",
  billingMessage(billingState(account({ paidAt: "2026-08-05T09:00:00.000Z" }), day("2026-08-06"))),
  null,
);
check(
  "tyst tidigt i gratisperioden",
  billingMessage(billingState(account(), day("2026-08-02"))),
  null,
);
check(
  "sista dagen har egen formulering",
  billingMessage(billingState(account(), day("2026-08-08")))?.title,
  "Sista dagen på din gratisperiod",
);

// Löftet om att inget raderas måste stå i texten om stängning. Det är hela
// skillnaden mellan utestängd och förlorad.
const closedBody = billingMessage(billingState(account(), day("2026-08-09")))?.body ?? "";
check("stängningstexten lovar att inget raderas", closedBody.includes("raderar ingenting"), true);
check(
  "stängningstexten säger hur man får tillbaka det",
  closedBody.includes("betalningen registreras"),
  true,
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
