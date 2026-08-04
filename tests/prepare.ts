/**
 * FÖRBERED ANVÄNDAREN - vakten.
 *
 * Övergångsprincipen är en designregel, och en regel som inte testas är
 * en åsikt. Här görs de fyra reglerna mätbara:
 *
 *   1. Ingen ny fråga utan en kort introduktion om ämnet.
 *   2. Ingen ny sektion utan ett övergångsmeddelande.
 *   3. Ingen extern kontroll eller datainsamling utan att användaren får
 *      veta vad som sker.
 *   4. Ingen väntetid utan att användaren får veta vad systemet arbetar
 *      med.
 *
 * Regel 1 och 2 kontrolleras på övergångarna: varje övergång ska ha alla
 * fyra delar, en KONKRET tidsangivelse och ett syfte som inte bara
 * upprepar nästa steg. Regel 3 och 4 kontrolleras på väntebeskeden, och
 * dessutom på hela källträdet - ett besked som bara säger att något
 * hämtas svarar inte på någon av användarens fyra frågor, och ska därför
 * inte gå att skriva någon annanstans än i prepare.ts.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  PREPARE_HEADINGS,
  PREPARE_RULES,
  TRANSITIONS,
  WAITS,
  hasConcreteEffort,
  isComplete,
  explainsPurpose,
  prepareLines,
  waitText,
  type Transition,
  type TransitionId,
} from "../src/lib/advisor/prepare";
import { emptyPraiseIn, sentimentalIn } from "../src/lib/advisor/tone";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (ok) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${name}${extra === undefined ? "" : `\n     ${JSON.stringify(extra)}`}`);
  }
};

const ids = Object.keys(TRANSITIONS) as TransitionId[];

/* --- 1. Varje övergång är hel -------------------------------------------- */

check("det finns övergångar att pröva", ids.length >= 5, ids.length);

for (const id of ids) {
  const t: Transition = TRANSITIONS[id];

  check(`${id}: alla fyra delar finns`, isComplete(t), t);
  check(`${id}: tidsangivelsen är konkret`, hasConcreteEffort(t), t.effort);
  check(`${id}: motiveringen säger vad svaret används till`, explainsPurpose(t), t.why);

  // Del 1 ska säga vad som blev gjort. En bekräftelse som i stället
  // berömmer användaren bryter mot konstitutionens tonalitetsregel, och
  // den regeln gäller även här.
  check(`${id}: bekräftelsen är inte tom beröm`, emptyPraiseIn(t.done) === null, t.done);
  for (const line of prepareLines(t)) {
    check(`${id}: "${line.slice(0, 32)}…" är inte sentimental`, sentimentalIn(line) === null, line);
    check(`${id}: "${line.slice(0, 32)}…" kallar inget för AI`, !/\bAI\b/i.test(line), line);
    check(`${id}: "${line.slice(0, 32)}…" är en mening, inte ett utrop`, !line.includes("!"), line);
  }

  // Delarna ska säga olika saker. Två identiska rader är fyra delar på
  // pappret och två i praktiken.
  const distinct = new Set(prepareLines(t).map((l) => l.trim()));
  check(`${id}: delarna upprepar inte varandra`, distinct.size === prepareLines(t).length, prepareLines(t));

  // Del 2 är nästa steg i EN mening.
  check(`${id}: nästa steg är en mening`, (t.next.match(/\.\s|\.$/g) ?? []).length <= 1, t.next);
}

/* --- 2. Ordningen är fast ------------------------------------------------ */

const sample = TRANSITIONS["bedomning-till-arende"];
check(
  "raderna kommer i ordningen klart, härnäst, varför, hur länge",
  prepareLines(sample)[0] === sample.done &&
    prepareLines(sample)[1] === sample.next &&
    prepareLines(sample)[2] === sample.why &&
    prepareLines(sample)[3] === sample.effort,
);
check(
  "den femte delen tas med när någon annan ser uppgifterna",
  prepareLines(sample).length === 5 && prepareLines(sample)[4] === sample.audience,
);
check(
  "den femte delen utelämnas när ingen annan ser något",
  prepareLines(TRANSITIONS["nulage-betalningar-till-skulder"]).length === 4,
);

check(
  "rubrikerna svarar mot användarens fyra frågor",
  PREPARE_HEADINGS.done.includes("klart") &&
    PREPARE_HEADINGS.next.includes("Nu händer") &&
    PREPARE_HEADINGS.why.includes("frågar") &&
    PREPARE_HEADINGS.effort.includes("tid"),
);

/* --- 3. En ofullständig övergång FÅR falla ------------------------------- */

// Vakten är värdelös om den godkänner allt. De här tre ska falla.
const tom: Transition = { done: "Klart.", next: "Vi går vidare.", why: "", effort: "Snabbt." };
check("en övergång utan motivering underkänns", !isComplete(tom));
check(
  "en luddig tidsangivelse underkänns",
  !hasConcreteEffort({ ...tom, why: "Det behövs.", effort: "Det går snabbt." }),
);
check(
  "en motivering som bara upprepar nästa steg underkänns",
  !explainsPurpose({ ...tom, effort: "Två minuter.", why: "Vi går vidare." }),
);

/* --- 4. Reglerna står skrivna -------------------------------------------- */

check("de fyra reglerna finns", PREPARE_RULES.length === 4, PREPARE_RULES.length);
check(
  "regel 1 handlar om introduktionen före frågan",
  PREPARE_RULES[0] === "Ingen ny fråga utan en kort introduktion om ämnet.",
);
check(
  "regel 2 handlar om övergången före sektionen",
  PREPARE_RULES[1] === "Ingen ny sektion utan ett övergångsmeddelande.",
);
check(
  "regel 3 handlar om den externa kontrollen",
  PREPARE_RULES[2] ===
    "Ingen extern kontroll eller datainsamling utan att användaren får veta vad som sker.",
);
check(
  "regel 4 handlar om väntetiden",
  PREPARE_RULES[3] === "Ingen väntetid utan att användaren får veta vad systemet arbetar med.",
);

/* --- 5. Väntebeskeden säger vad, varifrån och hur länge ------------------- */

const waits = Object.entries(WAITS);
check("det finns väntebesked", waits.length >= 4, waits.length);

for (const [key, w] of waits) {
  const text = waitText(w);
  check(`${key}: beskedet säger vad systemet gör`, w.doing.trim().length > 0, w);
  check(`${key}: beskedet säger ungefär hur länge`, /sekund|ögonblick|minut/i.test(w.duration), w.duration);
  check(`${key}: hela texten innehåller båda delarna`, text.includes(w.doing) && text.includes(w.duration), text);
  // Regel 3: lämnar uppgiften produkten ska källan stå i klartext.
  if (w.source) {
    check(`${key}: den externa källan namnges`, text.includes(w.source), text);
  } else {
    check(`${key}: ingen källa hittas på`, !/hämtas från/i.test(text), text);
  }
  check(`${key}: beskedet kallar inget för AI`, !/\bAI\b/i.test(text), text);
}

/* --- 6. Regeln gäller ALL egen källkod ----------------------------------- */

const files: string[] = [];
const walk = (dir: string) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      // Vendorerade primitiver bär bibliotekets egen text.
      if (full.includes(join("components", "ui"))) continue;
      walk(full);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      // prepare.ts är undantagen med flit: det är där väntebeskeden får
      // stå, just för att de ska gå att förbjuda någon annanstans.
      if (full.endsWith(join("advisor", "prepare.ts"))) continue;
      files.push(full);
    }
  }
};
walk(join(process.cwd(), "src"));
check("källfilerna hittades", files.length > 50, files.length);

/**
 * Kommentarerna bort före sökningen. En kommentar som FÖRKLARAR varför
 * ett naket väntebesked är fel ska inte fällas för att den citerar det.
 */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

/** Verben som inleder en väntetext. Träffar dem söker vi. */
const WAIT_VERB = /^(Hämtar|Laddar|Läser in|Förbereder|Beräknar|Förseglar|Analyserar)\b/;
const STRING_LITERAL = /"([^"\\\n]{2,120})"|'([^'\\\n]{2,120})'|`([^`\\\n$]{2,120})`/g;

const bareWaits: string[] = [];
for (const file of files) {
  const source = withoutComments(readFileSync(file, "utf8"));
  for (const m of source.matchAll(STRING_LITERAL)) {
    const literal = (m[1] ?? m[2] ?? m[3] ?? "").trim();
    if (!WAIT_VERB.test(literal)) continue;
    bareWaits.push(`${file}: ${literal}`);
  }
}
check(
  "inget naket väntebesked utanför prepare.ts",
  bareWaits.length === 0,
  bareWaits,
);

/* --- 7. Övergångarna är faktiskt inkopplade ------------------------------ */

const allSource = files.map((f) => readFileSync(f, "utf8")).join("\n");
for (const id of ids) {
  check(`övergången ${id} används i gränssnittet`, allSource.includes(`"${id}"`), id);
}
check(
  "övergångsrutan renderas i guiden",
  readFileSync(join(process.cwd(), "src/pages/CrisisWizard.tsx"), "utf8").includes("<TransitionNotice"),
);
check(
  "väntetexterna byggs av waitText, inte för hand",
  ["src/pages/KBRModule.tsx", "src/pages/Marketplace.tsx", "src/components/documents/CaseDocuments.tsx"].every(
    (f) => readFileSync(join(process.cwd(), f), "utf8").includes("waitText(WAITS."),
  ),
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
