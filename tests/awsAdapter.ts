/**
 * Migreringsmätaren.
 *
 * `awsAdapter` är en HALVFÄRDIG migrering: de portar som flyttat går mot
 * eget API, resten delegeras till supabase-adaptern. Det är avsiktligt
 * och tillfälligt - men bara om det syns. En halvfärdig migrering som
 * ingen mäter blir permanent.
 *
 * Sviten prövar tre saker:
 *
 *  1. MIGRATED_PORTS beskriver VERKLIGHETEN. Varje post ska peka på en
 *     metod som faktiskt finns, och varje metod som skiljer sig från
 *     supabase-adapterns ska stå i listan. Den som flyttar en port men
 *     glömmer listan får rött.
 *  2. Adaptern uppfyller hela DataPort - inga hål.
 *  3. Det som INTE går att flytta ännu är rätt saker, och av rätt skäl:
 *     dokumentuppladdning kräver en hink att signera mot.
 */

import {
  MIGRATED_PORTS,
  awsAdapter,
  awsAdapterUtanBro,
  delegeradePortar,
  broaPort,
} from "../src/data/aws/adapter";
import { supabaseAdapter } from "../src/data/supabase/adapter";
import { demoAdapter } from "../src/data/demo/adapter";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (ok) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${name}${extra === undefined ? "" : `\n     ${JSON.stringify(extra)}`}`);
  }
};

type Port = Record<string, unknown>;
const ports = (adapter: Record<string, unknown>) =>
  Object.entries(adapter).filter(([, v]) => v && typeof v === "object") as [string, Port][];

/* --- 1. Listan mot verkligheten ------------------------------------------- */

// Vad som FAKTISKT skiljer: en metod som inte är samma funktionsobjekt
// som supabase-adapterns är per definition omskriven, alltså flyttad.
const actuallyMigrated: string[] = [];
for (const [portName, port] of ports(awsAdapterUtanBro)) {
  const original = (supabaseAdapter as Record<string, Port>)[portName];
  if (!original) continue;
  for (const [method, fn] of Object.entries(port)) {
    if (typeof fn !== "function") continue;
    if (original[method] !== fn) actuallyMigrated.push(`${portName}.${method}`);
  }
}

const listed = new Set<string>(MIGRATED_PORTS);
const missingFromList = actuallyMigrated.filter((m) => !listed.has(m)).sort();
const listedButNotMigrated = [...listed].filter((m) => !actuallyMigrated.includes(m)).sort();

check("adaptern flyttar minst tio portmetoder", actuallyMigrated.length >= 10, actuallyMigrated.length);
check(
  "allt som är flyttat står i MIGRATED_PORTS",
  missingFromList.length === 0,
  missingFromList,
);
check(
  "inget i MIGRATED_PORTS är bara en ambition",
  listedButNotMigrated.length === 0,
  listedButNotMigrated,
);

/* --- 2. Inga hål i kontraktet --------------------------------------------- */

// Demoadaptern är facit för kontraktets YTA: den implementerar hela
// DataPort utan nätverk, så den listar varje port och metod som måste
// finnas. tsc garanterar typerna; det här fångar en port som råkat bli
// en tom platshållare.
const holes: string[] = [];
for (const [portName, port] of ports(demoAdapter)) {
  const target = (awsAdapter as Record<string, Port>)[portName];
  if (!target) {
    holes.push(portName);
    continue;
  }
  for (const [method, fn] of Object.entries(port)) {
    if (typeof fn !== "function") continue;
    if (typeof target[method] !== "function") holes.push(`${portName}.${method}`);
  }
}
check("adaptern har inga hål mot DataPort", holes.length === 0, holes);

/* --- 3. Det som återstår, och varför -------------------------------------- */

const remaining: string[] = [];
for (const [portName, port] of ports(demoAdapter)) {
  const target = (awsAdapterUtanBro as Record<string, Port>)[portName] ?? {};
  const original = (supabaseAdapter as Record<string, Port>)[portName] ?? {};
  for (const [method, fn] of Object.entries(port)) {
    if (typeof fn !== "function") continue;
    if (target[method] === original[method]) remaining.push(`${portName}.${method}`);
  }
}

// Dokumentens innehåll kan inte flytta förrän det finns en hink att
// signera mot - det är en ärlig blockering, inte en glömska.
check(
  "dokumentuppladdningen ligger kvar, som infrakartan säger",
  remaining.includes("documents.upload"),
  remaining.filter((r) => r.startsWith("documents.")),
);
check("det finns fortfarande arbete kvar att mäta", remaining.length > 0);

/* --- 4. Bron: två oberoende mätningar ska säga samma sak ----------------- */

/*
 * `delegeradePortar()` räknar ur MIGRATED_PORTS. `remaining` ovan räknar ur
 * FUNKTIONSIDENTITET och rör inte listan alls. Två oberoende vägar till
 * samma svar - går de isär är antingen listan fel eller bron fel, och
 * båda är fel som annars syns först i drift.
 */
const viaListan = delegeradePortar().sort();
const viaIdentitet = [...remaining].sort();
check(
  "listan och verkligheten räknar samma delegerade portar",
  JSON.stringify(viaListan) === JSON.stringify(viaIdentitet),
  { viaListan: viaListan.length, viaIdentitet: viaIdentitet.length, skillnad: viaListan.filter((p) => !viaIdentitet.includes(p)).concat(viaIdentitet.filter((p) => !viaListan.includes(p))) },
);

/*
 * Och bron ska SÄGA IFRÅN. En delegerad port som anropas utan att
 * Supabase-variablerna är satta ska kasta ett fel som namnger porten -
 * inte "supabaseUrl is required" ur ett SDK.
 */
{
  // Testbygget SÄTTER Supabase-variablerna (annars går supabase-adaptern
  // inte att ladda alls), så nej-grenen prövas genom seamen i stället.
  const utanBro = broaPort(
    "auth",
    (awsAdapterUtanBro as unknown as Record<string, object>).auth,
    () => false,
  ) as unknown as Record<string, () => unknown>;

  let besked = "";
  try {
    // Synkront kast: bron prövar FÖRE den släpper vidare till Supabase.
    utanBro.getCurrentUser();
  } catch (fel) {
    besked = fel instanceof Error ? fel.message : String(fel);
  }
  check("en delegerad port utan bro namnger sig själv", besked.includes("auth.getCurrentUser"), besked.slice(0, 160));
  check("och säger vad som saknas", /VITE_SUPABASE|Supabase-bron/.test(besked), besked.slice(0, 200));

  // Och en FLYTTAD port ska gå rakt igenom bron, även när den är nere.
  let flyttadKastade = false;
  try {
    const flyttad = broaPort(
      "contact",
      (awsAdapterUtanBro as unknown as Record<string, object>).contact,
      () => false,
    ) as unknown as Record<string, () => unknown>;
    void flyttad.amIAdmin;
  } catch {
    flyttadKastade = true;
  }
  check("en flyttad port bryr sig inte om bron", !flyttadKastade);
}

console.log(`\nMigrerat: ${actuallyMigrated.length} metoder. Kvar att flytta: ${remaining.length}.`);
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
