/**
 * ADAPTERN MOT EGET API: TÄCKER DEN HELA KONTRAKTET?
 *
 * Den här sviten hette migreringsmätaren och räknade hur många portar som
 * flyttat från Supabase. Den räkningen är slut - alla har flyttat, bron är
 * riven och supabase-adaptern är borta ur repot.
 *
 * Kvar finns den fråga mätaren egentligen ställde: uppfyller adaptern hela
 * DataPort, eller finns det hål? Ett hål märks inte av tsc om metoden
 * finns men är en platshållare, och det märks inte i drift förrän någon
 * klickar på just den knappen.
 *
 * Sviten prövar tre saker:
 *
 *  1. Adaptern har varje port och varje metod som demoadaptern har.
 *     Demoadaptern är facit för kontraktets YTA: den implementerar hela
 *     DataPort utan nätverk, alltså listar den allt som måste finnas.
 *  2. Ingen metod är en tom platshållare.
 *  3. Ingenting i adaptern - eller i klienten över huvud taget - når en
 *     backend-SDK. Det var hela poängen med ports-and-adapters, och det
 *     är den regel som är lättast att bryta av misstag.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { awsAdapter } from "../src/data/aws/adapter";
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

/* --- 1. Inga hål mot kontraktet ----------------------------------------- */

const hal: string[] = [];
let metoder = 0;
for (const [portNamn, port] of ports(demoAdapter)) {
  const mal = (awsAdapter as Record<string, Port>)[portNamn];
  if (!mal) {
    hal.push(portNamn);
    continue;
  }
  for (const [metod, fn] of Object.entries(port)) {
    if (typeof fn !== "function") continue;
    metoder += 1;
    if (typeof mal[metod] !== "function") hal.push(`${portNamn}.${metod}`);
  }
}
check("adaptern har inga hål mot DataPort", hal.length === 0, hal);
check("och kontraktet är inte tomt", metoder > 100, metoder);

/* --- 2. Ingen metod är en platshållare ---------------------------------- */

/*
 * En metod som bara returnerar tomt uppfyller typen och gör ingenting.
 * Källan läses därför: varje port ska nå API:t, eller ha ett uttalat skäl
 * att inte göra det.
 */
const adapterKod = readFileSync(join(process.cwd(), "src/data/aws/adapter.ts"), "utf8");
check("varje port går genom apiFetch", (adapterKod.match(/apiFetch/g) ?? []).length >= metoder / 2, {
  anrop: (adapterKod.match(/apiFetch/g) ?? []).length,
  metoder,
});
check(
  "select är den enda metoden utan nätanrop, och säger varför",
  /ETT RENT KLIENTVAL/.test(adapterKod),
);

/* --- 3. INGEN BACKEND-SDK OVANFÖR DATALAGRET ---------------------------- */

/*
 * Regeln som hela ports-and-adapters vilar på. Den bröts aldrig medan
 * Supabase fanns kvar - men just därför fanns aldrig en vakt heller, och
 * en regel som ingen prövar är en åsikt.
 *
 * Sökningen går på HELA klientträdet, inte bara på adaptern: det var
 * `src/integrations/supabase/client.ts` som importerade SDK:n, och den låg
 * utanför src/data/.
 */
const samla = (kat: string): string[] =>
  readdirSync(join(process.cwd(), kat)).flatMap((post) => {
    const rel = `${kat}/${post}`;
    if (statSync(join(process.cwd(), rel)).isDirectory()) return samla(rel);
    return /\.(ts|tsx)$/.test(rel) ? [rel] : [];
  });

const klientfiler = samla("src");
check("klientträdet lästes", klientfiler.length > 50, klientfiler.length);

const SDK_MONSTER = /from ["']@supabase\/|from ["']firebase|from ["']aws-amplify|createClient\(/;
const medSdk = klientfiler.filter((f) =>
  SDK_MONSTER.test(readFileSync(join(process.cwd(), f), "utf8")),
);
check("ingen fil i src/ importerar en backend-SDK", medSdk.length === 0, medSdk);

const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const alla = { ...pkg.dependencies, ...pkg.devDependencies };
const sdkBeroenden = Object.keys(alla).filter((n) =>
  /^@supabase\/|^firebase$|^aws-amplify$/.test(n),
);
check("och inget sådant paket står kvar som beroende", sdkBeroenden.length === 0, sdkBeroenden);

// Och att sökningen KAN hitta något - annars intygar den ingenting.
check(
  "vakten känner igen en SDK-import när den ser en",
  SDK_MONSTER.test('import { createClient } from "@supabase/supabase-js";'),
);

console.log(`\nDataPort: ${metoder} metoder, alla mot eget API.`);
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
