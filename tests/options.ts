/**
 * Tester för handlingsalternativen.
 *
 * Kärnlöftet testas: det finns ingen förutbestämd utgång. Konkurs är en
 * väg bland andra, sakligt beskriven, och statusarna svarar på ärendets
 * data - samma läge ger samma bild.
 */

import {
  ACTION_CATALOG,
  OPTIONS_STANCE,
  PATH_STATUS_LABELS,
  buildActionPaths,
  type OptionsInput,
} from "../src/lib/advisor/options";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (ok) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${name}${extra === undefined ? "" : `\n     ${JSON.stringify(extra)}`}`);
  }
};

const CALM: OptionsInput = {
  coverageRatio: 120,
  passedDeadlines: 0,
  daysToNextDeadline: 30,
  canPayTax: true,
  canPaySalary: true,
  recommendationType: "stabilize",
  kbrDone: true,
};

const CRISIS: OptionsInput = {
  coverageRatio: 34,
  passedDeadlines: 2,
  daysToNextDeadline: 5,
  canPayTax: false,
  canPaySalary: false,
  recommendationType: "reconstruction",
  kbrDone: false,
};

const calm = buildActionPaths(CALM);
const crisis = buildActionPaths(CRISIS);
const byId = (paths: ReturnType<typeof buildActionPaths>, id: string) =>
  paths.find((p) => p.id === id)!;

/* --- grundformen ----------------------------------------------------------- */

check("sex vägar, alltid", calm.length === 6 && crisis.length === 6);
check("varje väg har krav och statusskäl", calm.every((p) => p.requires.length >= 2 && p.statusReason.length > 10));
check("deterministisk", JSON.stringify(buildActionPaths(CRISIS)) === JSON.stringify(crisis));
check("ordet AI förekommer inte", !/\bAI\b/i.test(JSON.stringify(calm) + JSON.stringify(crisis)));
check("alla statusar har etikett", Object.values(PATH_STATUS_LABELS).every((l) => l.length > 2));

/* --- konkurs: en väg, inte en dom ------------------------------------------ */

const konkursCalm = byId(calm, "konkurs");
check("konkurs finns som väg även i lugnt läge", konkursCalm.status === "open");
check("konkurs beskrivs som aktivt val", konkursCalm.statusReason.includes("aktivt val"));
check("konkurs nämner lönegarantin sakligt", konkursCalm.summary.includes("lönegarantin"));

/* --- statusarna svarar på läget -------------------------------------------- */

check("solvent bolag kan välja likvidation", byId(calm, "avveckling").status === "open");
check("34 % täckning stänger frivillig likvidation", byId(crisis, "avveckling").status === "closed");
check("täckningsgraden citeras i skälet", byId(crisis, "avveckling").statusReason.includes("34 %"));

check("obetalbar skatt + nära frist gör anstånd brådskande", byId(crisis, "anstand").status === "urgent");
check("utan skattepress är anstånd bara öppen", byId(calm, "anstand").status === "open");

check("passerade frister smalnar uppgörelsen", byId(crisis, "uppgorelse").status === "narrowing");
check("intakt förtroende håller uppgörelsen öppen", byId(calm, "uppgorelse").status === "open");

check("lönepress gör rekonstruktionen brådskande", byId(crisis, "rekonstruktion").status === "urgent");
check(
  "konkursrekommendation smalnar rekonstruktionen",
  byId(buildActionPaths({ ...CRISIS, recommendationType: "bankruptcy" }), "rekonstruktion").status === "narrowing",
);

check("brådskande vägar sorteras först", crisis[0].status === "urgent");

/* --- katalogen ------------------------------------------------------------- */

check("fyra kategorier", ACTION_CATALOG.length === 4);
check(
  "kategorierna är kassaflöde/intäkter/finansiering/kostnader",
  ACTION_CATALOG.map((c) => c.id).join(",") === "kassaflode,intakter,finansiering,kostnader",
);
check("varje kategori har minst tre åtgärder", ACTION_CATALOG.every((c) => c.items.length >= 3));
check("hållningen är konstitutionens", OPTIONS_STANCE.includes("flera vägar framåt") && OPTIONS_STANCE.includes("just ditt företag"));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
