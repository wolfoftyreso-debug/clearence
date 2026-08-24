/**
 * VERCEL-REDO: driftlägets egen svit.
 *
 * Skillnaden mellan "testerna är gröna" och "det går att driftsätta" är
 * en lista med saker ingen svit tittade på: en fil som inte följer med
 * upp, en funktion som inte står i vercel.json, en miljövariabel vars
 * frånvaro ger ECONNREFUSED i stället för sitt eget namn.
 *
 * Den här sviten tittar på just dem. Den prövar KONFIGURATIONEN mot
 * VERKLIGHETEN - inte mot en beskrivning av verkligheten.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { kravDatabasUrl } from "../server/db";
import { arbetarUrl } from "../db/worker/roll";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (ok) passed++;
  else {
    failed++;
    console.log(`FAIL ${name}${extra === undefined ? "" : `\n     ${JSON.stringify(extra)}`}`);
  }
};

const rot = process.cwd();
const las = (p: string): string => readFileSync(join(rot, p), "utf8");
const finns = (p: string): boolean => {
  try {
    statSync(join(rot, p));
    return true;
  } catch {
    return false;
  }
};

type VercelKonfig = {
  framework?: string;
  buildCommand?: string;
  outputDirectory?: string;
  regions?: string[];
  functions?: Record<string, { maxDuration?: number; memory?: number }>;
  crons?: { path: string; schedule: string }[];
  rewrites?: { source: string; destination: string }[];
  headers?: { source: string; headers: { key: string; value: string }[] }[];
};

const vercel = JSON.parse(las("vercel.json")) as VercelKonfig;
const pkg = JSON.parse(las("package.json")) as {
  engines?: { node?: string };
  scripts: Record<string, string>;
  dependencies?: Record<string, string>;
};

/* --- 1. Bygget: Vercel ska veta hur, utan att gissa --------------------- */

check("ramverket är utpekat", vercel.framework === "vite", vercel.framework);
check("byggkommandot är utpekat", vercel.buildCommand === "npm run build", vercel.buildCommand);
check("utkatalogen är utpekad", vercel.outputDirectory === "dist", vercel.outputDirectory);
check("byggkommandot finns som skript", typeof pkg.scripts[vercel.buildCommand?.replace("npm run ", "") ?? ""] === "string");
check("regionen är Stockholm", JSON.stringify(vercel.regions) === '["arn1"]', vercel.regions);

/*
 * NODVERSIONEN SKA VARA VALD, INTE ÄRVD.
 *
 * Utan engines.node väljer Vercel den version projektinställningen råkar
 * stå på, och den ändras när Vercel pensionerar en runtime. Ett bygge som
 * fungerade i går slutar då fungera utan att en enda rad kod ändrats.
 */
check("nodversionen är pinnad i package.json", /^\d+\.x$/.test(pkg.engines?.node ?? ""), pkg.engines);

/* --- 2. Funktionerna: allt under api/ ska vara redovisat ---------------- */

/*
 * VERCEL GÖR VARJE FIL UNDER api/ TILL EN ENDPOINT.
 *
 * Det är hela skälet till att serverkoden flyttades till server/. Kvar
 * under api/ ska bara ligga saker som ÄR endpoints - plus filer Vercel
 * hoppar över: understrecksprefix och sådant som inte är körbar kod.
 *
 * Listan nedan byggs ur katalogen, inte ur vercel.json, så en ny fil som
 * ingen redovisat gör provet rött.
 */
const apiFiler: string[] = [];
const gaIgenom = (kat: string) => {
  for (const post of readdirSync(join(rot, kat))) {
    const rel = `${kat}/${post}`;
    if (statSync(join(rot, rel)).isDirectory()) gaIgenom(rel);
    else apiFiler.push(rel);
  }
};
gaIgenom("api");

const KOD = /\.(ts|tsx|js|mjs|cjs)$/;
const HOPPAS_OVER = (p: string): boolean =>
  p.split("/").some((led) => led.startsWith("_")) || !KOD.test(p);

const endpoints = apiFiler.filter((p) => !HOPPAS_OVER(p)).sort();
const redovisade = Object.keys(vercel.functions ?? {}).sort();
check(
  "varje endpoint under api/ står i vercel.json functions",
  JSON.stringify(endpoints) === JSON.stringify(redovisade),
  { iKatalogen: endpoints, iKonfigen: redovisade },
);

// Och åt andra hållet: en post i functions som pekar på ingenting.
const spoken = redovisade.filter((p) => !finns(p));
check("ingen funktionspost pekar på en fil som inte finns", spoken.length === 0, spoken);

// Filer som Vercel hoppar över ska hoppas över av RÄTT skäl.
for (const p of apiFiler.filter(HOPPAS_OVER)) {
  check(
    `${p} hoppas över av ett känt skäl`,
    p.split("/").some((led) => led.startsWith("_")) || /\.(json|md|txt)$/.test(p),
    p,
  );
}

/* --- 3. Cron: varje schema ska peka på en funktion som finns ------------ */

for (const jobb of vercel.crons ?? []) {
  const fil = `${jobb.path.replace(/^\//, "")}.ts`;
  check(`cron ${jobb.path} har en funktion`, finns(fil), fil);
  check(
    `cron ${jobb.path} har ett tak i functions`,
    typeof (vercel.functions ?? {})[fil]?.maxDuration === "number",
    fil,
  );
  check(`cron ${jobb.path} har ett giltigt schema`, jobb.schedule.trim().split(/\s+/).length === 5, jobb.schedule);
}

/* --- 4. Rewrites: API:t och SPA:n ska inte trampa på varandra ----------- */

const rewrites = vercel.rewrites ?? [];
check(
  "/v1/* går till catch-all-funktionen",
  rewrites.some((r) => r.source === "/v1/:path*" && r.destination === "/api/v1/:path*"),
);
const spa = rewrites.find((r) => r.destination === "/index.html");
check("SPA-fallbacken finns", spa !== undefined);
check(
  "och den undantar api/, assets/ och _vercel/",
  !!spa && /\(\?!api\/\|assets\/\|_vercel\/\)/.test(spa.source),
  spa?.source,
);

/* --- 5. CSP: landminan under uppladdningsvägen -------------------------- */

/*
 * DEN HÄR VAKTEN FINNS FÖR EN BUGG SOM ÄNNU INTE ÄR SKRIVEN.
 *
 * connect-src 'self' är rätt idag: klienten hämtar bara från sitt eget
 * ursprung, och nedladdningen av ett dokument är en NAVIGERING (ett
 * ankarklick), som CSP:n inte styr.
 *
 * Uppladdningen är en annan sak. Den är en `fetch(..., {method:"PUT"})`
 * mot Vercel Blobs kontroll-API - alltså ett annat ursprung, alltså
 * connect-src. Den dagen klienten får den vägen kommer webbläsaren att
 * blockera den, tyst, i en drift som testerna säger är grön.
 *
 * Provet: finns uppladdningsanropet i klienten MÅSTE connect-src ha
 * vidgats. Finns det inte ska policyn förbli smal.
 */
const csp =
  (vercel.headers ?? [])
    .flatMap((h) => h.headers)
    .find((h) => h.key === "Content-Security-Policy")?.value ?? "";
check("CSP finns", csp.length > 50);

const klientkalla = ["src"].flatMap(function samla(kat: string): string[] {
  return readdirSync(join(rot, kat)).flatMap((post) => {
    const rel = `${kat}/${post}`;
    return statSync(join(rot, rel)).isDirectory() ? samla(rel) : /\.(ts|tsx)$/.test(rel) ? [las(rel)] : [];
  });
}).join("\n");

const klientenLaddarUpp = /\/documents["'`]\s*,\s*\{\s*method:\s*["'`]POST|uploadUrl/.test(klientkalla);
const cspTillaterBlob = /connect-src[^;]*blob\.vercel-storage\.com/.test(csp);
check(
  klientenLaddarUpp
    ? "klienten laddar upp - CSP MÅSTE tillåta Blob-värden"
    : "klienten laddar inte upp än - CSP förblir smal",
  klientenLaddarUpp ? cspTillaterBlob : !cspTillaterBlob,
  { klientenLaddarUpp, cspTillaterBlob },
);

/*
 * OCH VIDGNINGEN SKA VARA SÅ SMAL SOM DEN KAN VARA.
 *
 * `connect-src *` hade också fått raden ovan grön. Det som prövas här är
 * att undantaget gäller Blob-värdarna och ingenting annat - en jokertecken
 * i connect-src öppnar för att en injicerad skript kan skicka en hel akt
 * vart som helst.
 */
if (klientenLaddarUpp) {
  const connect = /connect-src([^;]*)/.exec(csp)?.[1] ?? "";
  check("connect-src har ingen joker", !/\*(?!\.blob)/.test(connect), connect.trim());
  check(
    "och släpper bara in Blob-värdarna utöver det egna ursprunget",
    connect
      .trim()
      .split(/\s+/)
      .every((k) => k === "'self'" || /blob\.vercel-storage\.com$/.test(k)),
    connect.trim(),
  );
}

check("CSP tillåter inga främmande skript", /script-src[^;]*'unsafe-eval'/.test(csp) === false);
check("sidan får inte ramas in", /frame-ancestors 'none'/.test(csp));

/* --- 6. .vercelignore: det som inte ska upp ----------------------------- */

check(".vercelignore finns", finns(".vercelignore"));
const ignorerat = las(".vercelignore")
  .split("\n")
  .map((r) => r.trim())
  .filter((r) => r && !r.startsWith("#"));

for (const ska of ["tests/", "supabase/", "docs/", "design/", "exempel/", "scripts/", ".github/"]) {
  check(`${ska} följer inte med till drift`, ignorerat.includes(ska), ignorerat);
}

/*
 * OCH DET SOM MÅSTE VARA KVAR.
 *
 * `db/worker/` importeras av cron-funktionerna. Ignoreras hela db/ blir
 * bygget rött - men först på Vercel, inte här. Därför en egen rad om det.
 */
check("db/ ignoreras INTE i sin helhet", !ignorerat.includes("db/"), ignorerat.filter((r) => r.startsWith("db")));
check("api/ ignoreras inte", !ignorerat.some((r) => r === "api/" || r === "api"));
check("server/ ignoreras inte", !ignorerat.some((r) => r === "server/" || r === "server"));
check("src/ ignoreras inte", !ignorerat.some((r) => r === "src/" || r === "src"));

// Cron-funktionerna importerar db/worker. Om den raden försvinner ur
// importen är den här kontrollen inte längre relevant - då ska den ändras,
// inte tas bort tyst.
const cronKalla = ["api/cron/utkorg.ts", "api/cron/aviseringar.ts", "api/cron/simulering.ts"]
  .map(las)
  .join("\n");
check("cron importerar faktiskt db/worker", /db\/worker\//.test(cronKalla));

/* --- 7. Miljövariabler: den som saknas ska säga sitt namn --------------- */

const utan = (namn: string[], fn: () => unknown): string => {
  const spar = namn.map((n) => process.env[n]);
  for (const n of namn) delete process.env[n];
  try {
    fn();
    return "";
  } catch (fel) {
    return fel instanceof Error ? fel.message : String(fel);
  } finally {
    namn.forEach((n, i) => {
      if (spar[i] !== undefined) process.env[n] = spar[i];
    });
  }
};

/*
 * `"WORKER_DATABASE_URL".includes("DATABASE_URL")` ÄR SANT.
 *
 * Ett enkelt includes() kan alltså inte skilja de två variablerna åt: ett
 * fel som bara pratar om arbetarens variabel såg ut att namnge API:ts. En
 * mutation som tog bort "DATABASE_URL är inte satt" ur beskedet överlevde
 * därför den första versionen av den här vakten. Gränsen framför namnet
 * är det som gör kontrollen till en kontroll.
 */
const namnger = (text: string, variabel: string): boolean =>
  new RegExp(`(^|[^_A-Z])${variabel}(?![_A-Z])`, "m").test(text);

check("vakten kan skilja DATABASE_URL från WORKER_DATABASE_URL", !namnger("WORKER_DATABASE_URL saknas", "DATABASE_URL"));
check("och känner igen den när den står ensam", namnger("DATABASE_URL saknas", "DATABASE_URL"));

const dbFel = utan(["DATABASE_URL"], kravDatabasUrl);
check("DATABASE_URL som saknas ger ett fel", dbFel.length > 0);
check("och felet namnger variabeln på FÖRSTA raden", namnger(dbFel.split("\n")[0] ?? "", "DATABASE_URL"), dbFel.split("\n")[0]);
check("och säger var den sätts", /Vercel/.test(dbFel));
check("och nämner arbetarens motsvarighet", dbFel.includes("WORKER_DATABASE_URL"));

const arbFel = utan(["WORKER_DATABASE_URL", "DATABASE_URL"], arbetarUrl);
check("WORKER_DATABASE_URL som saknas ger ett fel", arbFel.length > 0);
check("och felet namnger variabeln på FÖRSTA raden", (arbFel.split("\n")[0] ?? "").includes("WORKER_DATABASE_URL"), arbFel.split("\n")[0]);

// Och att de fungerar när de FINNS - annars vore vakten ovan lika glad
// åt en funktion som alltid kastar.
process.env.DATABASE_URL = "postgres://prov@localhost/prov";
check("satt DATABASE_URL lämnas tillbaka", kravDatabasUrl() === "postgres://prov@localhost/prov");
process.env.WORKER_DATABASE_URL = "postgres://arbetare@localhost/prov";
check("satt WORKER_DATABASE_URL lämnas tillbaka", arbetarUrl() === "postgres://arbetare@localhost/prov");
delete process.env.WORKER_DATABASE_URL;
check("arbetaren faller tillbaka på DATABASE_URL", arbetarUrl() === "postgres://prov@localhost/prov");

/* --- 8. Strukturkartan mot det riktiga trädet --------------------------- */

/*
 * EN KARTA SOM INGEN PRÖVAR ÄR EN TECKNING.
 *
 * docs/struktur.md har en rad per katalog med "till drift: ja/nej". Den
 * sortens tabell blir inaktuell första gången någon lägger till en
 * katalog - och då är den värre än ingen tabell alls, för den läses som
 * om den stämde.
 *
 * Kontrollen går åt BÅDA hållen: varje katalog i repot ska stå i kartan,
 * och varje rad i kartan ska peka på en katalog som finns.
 */
const karta = las("docs/struktur.md");
const kartansKataloger = new Set(
  [...karta.matchAll(/^\| `([a-z._/-]+\/)` \|/gm)].map((m) => m[1]),
);
check("kartan har rader", kartansKataloger.size >= 10, kartansKataloger.size);

// Kataloger som inte är produktens (verktyg, byggartefakter, versionshantering).
const UTANFOR = new Set(["node_modules/", ".git/", "dist/", ".vercel/", "coverage/"]);
const iRepot = readdirSync(rot, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => `${d.name}/`)
  .filter((d) => !UTANFOR.has(d))
  .sort();

const saknasIKartan = iRepot.filter((d) => !kartansKataloger.has(d));
check("varje katalog i repot står i strukturkartan", saknasIKartan.length === 0, saknasIKartan);

const spokenIKartan = [...kartansKataloger].filter((d) => !finns(d));
check("varje rad i kartan pekar på en katalog som finns", spokenIKartan.length === 0, spokenIKartan);

/*
 * OCH KOLUMNEN "TILL DRIFT" SKA STÄMMA MED .vercelignore.
 *
 * Det är den enda kolumnen som kan vara fel utan att någon märker det:
 * en katalog som står som "nej" men inte är ignorerad följer med upp
 * ändå, och tabellen ljuger utan att bygget blir rött.
 */
const kartansNej = [...karta.matchAll(/^\| `([a-z._/-]+\/)` \|[^|]*\| nej \|/gm)].map((m) => m[1]);
check('kartan har "nej"-rader', kartansNej.length >= 5, kartansNej);
const nejMenInteIgnorerad = kartansNej.filter((d) => !ignorerat.includes(d));
check(
  'varje katalog kartan säger "nej" om är faktiskt ignorerad',
  nejMenInteIgnorerad.length === 0,
  nejMenInteIgnorerad,
);

const kartansJa = [...karta.matchAll(/^\| `([a-z._/-]+\/)` \|[^|]*\| ja \|/gm)].map((m) => m[1]);
check('kartan har "ja"-rader', kartansJa.length >= 4, kartansJa);
const jaMenIgnorerad = kartansJa.filter((d) => ignorerat.includes(d));
check('ingen katalog kartan säger "ja" om är ignorerad', jaMenIgnorerad.length === 0, jaMenIgnorerad);

/*
 * "delvis" är en tredje kategori, och en sådan kan användas för att slippa
 * ta ställning. Den är sann för exakt EN katalog - db/, där db/worker/
 * måste med och resten inte - och den ska förbli det.
 */
const kartansDelvis = [...karta.matchAll(/^\| `([a-z._/-]+\/)` \|[^|]*\| delvis \|/gm)].map((m) => m[1]);
check('"delvis" används för exakt en katalog', kartansDelvis.length === 1, kartansDelvis);
check('och det är db/', kartansDelvis[0] === "db/", kartansDelvis);
check("varje katalog i kartan är kategoriserad", kartansJa.length + kartansNej.length + kartansDelvis.length === kartansKataloger.size, {
  ja: kartansJa.length, nej: kartansNej.length, delvis: kartansDelvis.length, totalt: kartansKataloger.size,
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
