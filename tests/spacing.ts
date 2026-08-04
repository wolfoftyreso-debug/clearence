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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
