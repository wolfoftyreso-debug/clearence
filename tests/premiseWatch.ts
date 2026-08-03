/**
 * Tester för omprövningsbevakningen.
 *
 * Det som måste hålla, i den ordning det spelar roll:
 *
 *  1. Ett motsagt villkor flaggas. Det är hela funktionen.
 *  2. Ett villkor som HÅLLER flaggas aldrig - en bevakning som larmar i
 *     onödan slutar man läsa, och då larmar den inte alls.
 *  3. Saknad uppgift blir "går inte att avgöra", ALDRIG "allt är bra".
 *     Det är skillnaden mellan att veta och att anta.
 *  4. Kvitteringen är knuten till observationen: den som svarat vid 30 %
 *     får vara ifred vid 30 %, men hörs av vid 12 %.
 *  5. Förslagen vid beslutstillfället är sanna NÄR de föreslås. Ett
 *     villkor som är motsagt redan när det sätts är meningslöst.
 *  6. CLEARANCE talar om beslutet, aldrig i stället för det.
 */

import {
  NO_WATCH_LABEL,
  PREMISE_SIGNALS,
  WATCH_STATE_LABEL,
  describeWatch,
  evaluatePremise,
  isValidWatch,
  premiseAlert,
  premiseFlags,
  proposeWatches,
  signalSpec,
  type PremiseFacts,
  type WatchedDecision,
} from "../src/lib/advisor/premiseWatch";
import { emptyPraiseIn } from "../src/lib/advisor/tone";
import type { PremiseWatch } from "../src/data/types";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (ok) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${name}${extra === undefined ? "" : `\n     ${JSON.stringify(extra)}`}`);
  }
};

/** Demobolagets läge: löner och skatt kan inte betalas, täckning 30 %. */
const tightSpot: PremiseFacts = {
  coverageRatio: 30,
  totalDebt: 3_200_000,
  canPaySalary: false,
  canPayTax: false,
  canPayRent: true,
  canPaySuppliers: false,
  passedDeadlines: 1,
};

const healthy: PremiseFacts = {
  coverageRatio: 120,
  totalDebt: 400_000,
  canPaySalary: true,
  canPayTax: true,
  canPayRent: true,
  canPaySuppliers: true,
  passedDeadlines: 0,
};

/* --- 1-2. Motsagt flaggas, hållande flaggas inte -------------------------- */

const coverage45: PremiseWatch = { signal: "skuldtackning", comparator: "minst", threshold: 45 };
check("motsagt villkor upptäcks", evaluatePremise(coverage45, tightSpot).state === "contradicted");
check("hållande villkor flaggas inte", evaluatePremise(coverage45, healthy).state === "holds");
check(
  "observationen säger vad som gäller nu",
  evaluatePremise(coverage45, tightSpot).observation === "Skuldtäckningen är 30 %",
  evaluatePremise(coverage45, tightSpot).observation,
);

const salaryHolds: PremiseWatch = { signal: "loner", comparator: "sant", threshold: null };
check("booleskt villkor: motsagt när lönerna inte går att betala", evaluatePremise(salaryHolds, tightSpot).state === "contradicted");
check("booleskt villkor: håller när de går att betala", evaluatePremise(salaryHolds, healthy).state === "holds");

const noPassedDeadlines: PremiseWatch = { signal: "passerade_frister", comparator: "hogst", threshold: 0 };
check("högst-villkor motsägs av en passerad frist", evaluatePremise(noPassedDeadlines, tightSpot).state === "contradicted");
check("högst-villkor håller vid noll", evaluatePremise(noPassedDeadlines, healthy).state === "holds");

// Gränsvärdet: "minst 30" ska hålla vid exakt 30. Ett villkor som faller
// på likhet hade larmat dagen det sattes.
check(
  "gränsvärdet räknas med",
  evaluatePremise({ signal: "skuldtackning", comparator: "minst", threshold: 30 }, tightSpot).state === "holds",
);

/* --- 3. Saknad uppgift är inte goda nyheter ------------------------------- */

const missing: PremiseFacts = { ...tightSpot, coverageRatio: null, canPaySalary: null };
check("saknad siffra ger 'går inte att avgöra'", evaluatePremise(coverage45, missing).state === "unknown");
check("saknat ja/nej ger 'går inte att avgöra'", evaluatePremise(salaryHolds, missing).state === "unknown");
check(
  "okänt tolkas ALDRIG som att villkoret håller",
  evaluatePremise(coverage45, missing).state !== "holds",
);
check("utan villkor finns inget att avgöra", evaluatePremise(null, tightSpot).state === "unknown");
check(
  "det saknade sägs rakt ut",
  /saknas i underlaget/.test(evaluatePremise(coverage45, missing).observation),
  evaluatePremise(coverage45, missing).observation,
);

/* --- 4. Flaggorna och kvitteringen ---------------------------------------- */

const base: WatchedDecision = {
  id: "d1",
  title: "Avvakta med rekonstruktionsansökan",
  premise: "Beslutet vilar på att tillgångarna täcker minst 45 % av skulderna.",
  decidedAt: "2026-07-16T09:00:00Z",
  status: "active",
  watch: coverage45,
  watchAckObservation: null,
};

check("beslutet med motsagt villkor flaggas", premiseFlags([base], tightSpot).length === 1);
check("samma beslut flaggas inte när villkoret håller", premiseFlags([base], healthy).length === 0);
check(
  "omprövade beslut flaggas aldrig igen",
  premiseFlags([{ ...base, status: "reconsidered" }], tightSpot).length === 0,
);
check(
  "beslut utan villkor flaggas inte",
  premiseFlags([{ ...base, watch: null }], tightSpot).length === 0,
);
check(
  "kvitterad observation tystar flaggan",
  premiseFlags([{ ...base, watchAckObservation: "Skuldtäckningen är 30 %" }], tightSpot).length === 0,
);
check(
  "men flaggan kommer tillbaka när läget ändras igen",
  premiseFlags(
    [{ ...base, watchAckObservation: "Skuldtäckningen är 30 %" }],
    { ...tightSpot, coverageRatio: 12 },
  ).length === 1,
);
check(
  "en kvittering på ett annat läge tystar inte",
  premiseFlags([{ ...base, watchAckObservation: "Skuldtäckningen är 44 %" }], tightSpot).length === 1,
);

/* --- 5. Förslagen är sanna när de ges ------------------------------------- */

const proposals = proposeWatches(tightSpot);
check("det finns förslag att välja bland", proposals.length >= 5, proposals.length);
check(
  "VARJE föreslaget villkor håller i det läge det föreslogs",
  proposals.every((w) => evaluatePremise(w, tightSpot).state === "holds"),
  proposals.filter((w) => evaluatePremise(w, tightSpot).state !== "holds"),
);
check(
  "samma sak i ett friskt läge",
  proposeWatches(healthy).every((w) => evaluatePremise(w, healthy).state === "holds"),
);
check(
  "storheter som saknas föreslås inte",
  proposeWatches({ ...tightSpot, coverageRatio: null }).every((w) => w.signal !== "skuldtackning"),
);
check(
  "lönerna föreslås först - allvarsordningen, som i handlingsplanen",
  proposals[0].signal === "loner",
  proposals[0],
);
check("varje förslag är giltigt", proposals.every(isValidWatch));

// Ett booleskt villkor med tröskel, eller ett numeriskt utan, är ett halvt
// villkor - det ser bevakat ut utan att vara det.
check(
  "booleskt villkor med tröskel underkänns",
  !isValidWatch({ signal: "loner", comparator: "sant", threshold: 50 }),
);
check(
  "numeriskt villkor utan tröskel underkänns",
  !isValidWatch({ signal: "skuldtackning", comparator: "minst", threshold: null }),
);
check(
  "fel jämförelse för storheten underkänns",
  !isValidWatch({ signal: "skuldtackning", comparator: "sant", threshold: null }),
);

/* --- 6. Språket ----------------------------------------------------------- */

check(
  "villkoret går att läsa högt",
  describeWatch(coverage45) === "Skuldtäckningen är minst 45 %",
  describeWatch(coverage45),
);
check("booleskt villkor blir en mening", describeWatch(salaryHolds) === "Att lönerna går att betala");

const alert = premiseAlert({
  title: base.title,
  decidedAt: base.decidedAt,
  watch: coverage45,
  evaluation: evaluatePremise(coverage45, tightSpot),
});
check("larmet citerar beslutet", alert.includes("”Avvakta med rekonstruktionsansökan”"));
check("larmet daterar beslutet", alert.includes("16 juli"), alert);
check("larmet återger villkoret", /minst 45/.test(alert));
check("larmet säger vad som gäller nu", /30 %/.test(alert));
check("larmet lämnar BÅDA dörrarna öppna", /Vill du ompröva beslutet, eller står det fast\?/.test(alert));
check("larmet talar aldrig om för användaren vad hen bör göra", !/du bör|du måste|vi rekommenderar/i.test(alert));
check("larmet är inte tom beröm", emptyPraiseIn(alert) === null);
check("larmet kallar aldrig bevakningen AI", !/\bAI\b/i.test(alert));

check("alla tre lägen har en etikett", Object.keys(WATCH_STATE_LABEL).length === 3);
check("den obevakade premissen sägs rakt ut", /bevakas inte/i.test(NO_WATCH_LABEL));
check("varje storhet har en etikett och en läsare", PREMISE_SIGNALS.every((s) => s.label.length > 3 && typeof s.read === "function"));
check("varje storhet går att slå upp", PREMISE_SIGNALS.every((s) => signalSpec(s.id)?.id === s.id));
check("okänd storhet slås inte upp", signalSpec("hittepa" as never) === null);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
