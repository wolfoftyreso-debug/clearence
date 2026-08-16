/**
 * Designvakten för spacing-skalan och kortkompositionen
 * (docs/design-system.md, Excellence-kraven 6-7).
 *
 * Vaktar tre regler i all egen kod (vendorerade src/components/ui
 * undantaget):
 *  1. Inga frihandsvärden i spacing-utilities (p-[18px], mt-[13px]).
 *  2. Inga förbjudna steg: 7, 9, 10, 11, 14 (28/36/40/44/56 px).
 *     (14 var frizonen under startsidans bottennavigering - naven är
 *     borttagen, så undantaget är det också.)
 *  3. Hörnradien är rounded-md: rounded-lg/xl/2xl är städade och
 *     återinförs inte utanför ui-biblioteket.
 *
 * Plus typografirevisionen (Excellence-krav 10):
 *  4. Uppercase har exakt två recept - etiketten
 *     (font-semibold + tracking-wider) och chipen
 *     (font-bold + tracking-wide). Inga tredje varianter.
 *  5. Shellen äger sidans h1: en sida som använder DashboardShell
 *     renderar aldrig en egen <h1> - innehållsrubriker är h2.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (ok) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${name}${extra === undefined ? "" : `\n     ${JSON.stringify(extra)}`}`);
  }
};

const files: string[] = [];
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      // Vendorerade primitiver bär bibliotekets egna mått.
      if (full.includes(join("components", "ui"))) continue;
      walk(full);
    } else if (/\.tsx$/.test(name)) {
      files.push(full);
    }
  }
};
walk(join(process.cwd(), "src"));
check("källfilerna hittades", files.length > 50, files.length);

const SPACING = "(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y)";
const freehand = new RegExp(`\\b${SPACING}-\\[`);
const banned = new RegExp(`\\b${SPACING}-(?:7|9|10|11|14)\\b`);
const radius = /\brounded-(?:lg|xl|2xl)\b/;

const offenders: Record<string, string[]> = {
  freehand: [],
  banned: [],
  radius: [],
  uppercase: [],
  doubleH1: [],
};
for (const file of files) {
  const rel = file.slice(file.indexOf("src"));
  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");
  lines.forEach((line, i) => {
    if (/className/.test(line) || /^\s*["'`]/.test(line.trim())) {
      if (freehand.test(line)) offenders.freehand.push(`${rel}:${i + 1}`);
      if (banned.test(line)) offenders.banned.push(`${rel}:${i + 1}`);
      if (radius.test(line)) offenders.radius.push(`${rel}:${i + 1}`);
      if (/\buppercase\b/.test(line)) {
        const label = /font-semibold/.test(line) && /tracking-wider/.test(line);
        const chip = /font-bold/.test(line) && /tracking-wide\b/.test(line);
        if (!label && !chip) offenders.uppercase.push(`${rel}:${i + 1}`);
      }
    }
  });
  if (
    /from "@\/components\/dashboard\/DashboardShell"/.test(content) &&
    /<h1[\s>]/.test(content)
  ) {
    offenders.doubleH1.push(rel);
  }
}

/*
 * DET FASTA FÅR INTE TÄCKA DET KLICKBARA.
 *
 * DemoBanner ligger fast längst ner och publicerar sin uppmätta höjd som
 * --app-bottom-inset. Ett överlägg som centreras mot HELA fönstret hamnar
 * då delvis under den - och det hände: knappen "Ja, aktivera" i
 * erbjudandet gick inte att klicka, så erbjudandet gick inte att tacka ja
 * till. Felet syns inte i en typkontroll och inte i ett bygge; det syns
 * bara för den som försöker klicka.
 *
 * Varje fil som själv målar ett fast helskärmsöverlägg måste därför
 * räkna med insetet. Undantagen är de som ligger ÖVER bannern med flit
 * (bannern själv) eller som inte har något klickbart i botten.
 */
/**
 * Källan utan kommentarer.
 *
 * Den första versionen av vakterna nedan läste hela filen - och blev
 * gröna av att MIN EGEN KOMMENTAR nämnde --app-bottom-inset. Två mutanter
 * som tog bort själva hänsynen gick rakt igenom. En vakt som prövar
 * prosan i stället för koden är sämre än ingen vakt: den intygar något
 * den inte kontrollerat.
 */
const utanKommentarer = (kalla: string): string =>
  kalla.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

{
  /*
   * Skärmar och dimmare räknas inte: en genomskinlig ruta utan klickbart
   * innehåll SKA täcka hela ytan, bannern inkluderad. Det som räknas är
   * överlägg som själva lägger ut innehåll - de kan gömma en knapp.
   */
  const utan: string[] = [];
  for (const file of files) {
    const rel = file.slice(file.indexOf("src"));
    if (rel === "src/components/DemoBanner.tsx") continue; // bannern ÄR elementet
    const content = readFileSync(file, "utf8");
    if (/--app-bottom-inset/.test(utanKommentarer(content))) continue;
    for (const m of content.matchAll(/"[^"]*fixed inset-0[^"]*"/g)) {
      const klasser = m[0];
      // En dimmare släpper igenom klick; en skärm har ingen egen layout.
      if (/pointer-events-none/.test(klasser)) continue;
      if (!/\bflex\b|\bgrid\b/.test(klasser)) continue;
      utan.push(`${rel}: ${klasser.slice(1, 60)}`);
    }
  }
  check("fasta överlägg ger plats åt den fasta bannern", utan.length === 0, utan);
}

// De delade dialogprimitiverna ska bära samma hänsyn - en gång, för alla.
for (const [fil, vad] of [
  ["src/components/ui/dialog.tsx", "dialogen"],
  ["src/components/ui/alert-dialog.tsx", "varningsdialogen"],
  ["src/components/ui/sheet.tsx", "panelen"],
] as const) {
  const kalla = readFileSync(join(process.cwd(), fil), "utf8");
  check(
    `${vad} centreras ovanför den fasta bannern`,
    /--app-bottom-inset/.test(utanKommentarer(kalla)),
    fil,
  );
}

check("inga frihandsvärden i spacing", offenders.freehand.length === 0, offenders.freehand);
check("inga förbjudna steg (7/9/10/11/14)", offenders.banned.length === 0, offenders.banned);
check("hörnradien är rounded-md utanför ui-biblioteket", offenders.radius.length === 0, offenders.radius);
check("uppercase följer etikett- eller chipreceptet", offenders.uppercase.length === 0, offenders.uppercase);
check("shellen äger h1 - sidorna använder h2", offenders.doubleH1.length === 0, offenders.doubleH1);


/* --- 6. Inga råa fragmentankare -------------------------------------------
 *
 * `href="#nasta-steg"` ser oskyldigt ut och fungerar i utvecklingsläget.
 * I demon kör appen HashRouter, och då ÄR hashen rutten: webbläsaren
 * byter adress till "#nasta-steg", routern läser det som sidan
 * "/nasta-steg" och visar 404 i stället för att rulla.
 *
 * Felet har inträffat två gånger - först på "Så fungerar tjänsten",
 * sedan på NÄRMAST-raden på översikten. Första gången löstes det med en
 * komponent (SectionLink), men ingenting hindrade nästa råa ankare från
 * att skrivas. Nu gör den här kontrollen det.
 */
const fragmentAnchors: string[] = [];
for (const file of files) {
  // Komponenten som ÄR lösningen får innehålla mönstret - det är där
  // ankaret hör hemma, med preventDefault och rullning i kod.
  if (file.endsWith("HowItWorksLink.tsx")) continue;
  const text = readFileSync(file, "utf8");
  for (const line of text.split("\n")) {
    if (/href=(?:"#|\{`#|\{"#)/.test(line)) {
      fragmentAnchors.push(`${file.split("/src/")[1]}: ${line.trim().slice(0, 80)}`);
    }
  }
}
check(
  "inga råa fragmentankare - de blir 404 i hash-läget, använd SectionLink",
  fragmentAnchors.length === 0,
  fragmentAnchors,
);

/* --- 6. Pixelrevisionens vakter -------------------------------------------- */

/*
 * Tre fel som sviterna inte kunde se, hittade med ögon i skärmdumpar.
 * Vakterna är textuella och trubbiga - men de fångar exakt den
 * återkomst som annars sker när någon "städar" en klass eller lägger
 * till en leverantör.
 */

// Startsidans största siffra var dess minst läsbara: text-accent
// (mörkblå) på surface-brand (marinblå) gav kontrast 1,4:1. Stor text
// kräver 3:1. Kontrast mäts inte av designsviten, så regeln står här.
const rot = process.cwd();
const statsKalla = readFileSync(join(rot, "src/components/landing/Stats.tsx"), "utf8");
check(
  "Stats: ingen text-accent på den mörka ytan (kontrast 1,4:1)",
  // Klassanvändningen, inte prosan: kommentaren som förklarar regeln
  // nämner klassen och får göra det.
  !/className="[^"]*\btext-accent\b/.test(statsKalla),
);

// "Från fortnox": det råa leverantörs-id:t i användarens gränssnitt.
const oversikt = readFileSync(join(rot, "src/pages/Dashboard.tsx"), "utf8");
check(
  "översikten visar leverantörens namn, aldrig snapshot.provider rått",
  !/Från \{snapshot\.provider\}/.test(oversikt),
);

// Driftpanelens leverantörsrader: varje id i PROVIDERS ska ha ett märke i
// ProviderLogo. Saknas det visas reservrutan - en tom grå kvadrat i en
// lista där alla andra rader har innehåll, vilket läses som "trasig".
const adminKalla = readFileSync(join(rot, "src/pages/AdminOverview.tsx"), "utf8");
const logoKalla = readFileSync(join(rot, "src/components/integrations/ProviderLogo.tsx"), "utf8");
const adminIdn = [...adminKalla.matchAll(/\{ id: "([a-z0-9]+)"/g)].map((m) => m[1]);
// SMS-leverantören refereras via konstant - även här: literalen är
// inkapslad, och vakten läser deklarationen i stället för att upprepa den.
const eventsKalla = readFileSync(join(rot, "src/lib/notifications/events.ts"), "utf8");
const smsId = /export const SMS_SECRET_PROVIDER = "([^"]+)"/.exec(eventsKalla)?.[1];
if (/id: SMS_SECRET_PROVIDER/.test(adminKalla) && smsId) adminIdn.push(smsId);
check("driftpanelens leverantörslista gick att läsa", adminIdn.length >= 6, adminIdn);
for (const id of adminIdn) {
  check(
    `ProviderLogo har ett märke för ${id} - ingen tom ruta i driftpanelen`,
    new RegExp(`^\\s*"?${id}"?:`, "m").test(logoKalla) ||
      // Konstantnyckeln: [SMS_SECRET_PROVIDER] i stället för literalen.
      (id === smsId && /\[SMS_SECRET_PROVIDER\]:/.test(logoKalla)),
  );
}

// En uppercase-etikett i smal kolumn med break-words bryter ord mitt i:
// "OMEDELBART" blev "OMEDELBA / RT" på en telefon och lästes som stavfel.
// Radbryt vid mellanslag är rätt; ordbryt är aldrig det för etiketter.
const ordbryt: string[] = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const line of text.split("\n")) {
    if (/className="[^"]*break-words[^"]*uppercase|className="[^"]*uppercase[^"]*break-words/.test(line)) {
      ordbryt.push(`${file.split("/src/")[1]}: ${line.trim().slice(0, 80)}`);
    }
  }
}
check("inga uppercase-etiketter med break-words - ord bryts aldrig mitt i", ordbryt.length === 0, ordbryt);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
