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

const offenders: Record<string, string[]> = { freehand: [], banned: [], radius: [] };
for (const file of files) {
  const rel = file.slice(file.indexOf("src"));
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (!/className/.test(line) && !/^\s*["'`]/.test(line.trim())) return;
    if (freehand.test(line)) offenders.freehand.push(`${rel}:${i + 1}`);
    if (banned.test(line)) offenders.banned.push(`${rel}:${i + 1}`);
    if (radius.test(line)) offenders.radius.push(`${rel}:${i + 1}`);
  });
}

check("inga frihandsvärden i spacing", offenders.freehand.length === 0, offenders.freehand);
check("inga förbjudna steg (7/9/10/11/14)", offenders.banned.length === 0, offenders.banned);
check("hörnradien är rounded-md utanför ui-biblioteket", offenders.radius.length === 0, offenders.radius);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
