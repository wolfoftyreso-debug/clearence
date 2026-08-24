/**
 * DEMOARTEFAKTEN: hela appen i EN fil, byggd ur repot varje gång.
 *
 * Artefakten är produkten som en enda HTML-fil, publicerad så att någon kan
 * klicka runt i den utan konto, utan server och utan installation.
 *
 * DEN HÄR FILEN FINNS FÖR ATT DEN FÖRRA INTE FANNS.
 *
 * Bygget bodde i en handpassad kopia av repot vid sidan om: samma källkod,
 * plus två ändringar någon gjort för hand en gång. Kopian åldrades. När den
 * synkades om försvann ändringarna utan att något sa ifrån, och bygget blev
 * en sida som svarade "Sidan finns inte" på varje adress. Det upptäcktes
 * först när någon försökte använda demon.
 *
 * Ändringarna görs därför här, i kod, vid varje bygge - och skriptet ligger
 * i repot i stället för i en tillfällig katalog, av samma skäl: ett verktyg
 * som inte överlever sin arbetskatalog är inget verktyg.
 *
 * TRE SAKER SKILJER ARTEFAKTEN FRÅN APPEN.
 *
 *  1. HashRouter i stället för BrowserRouter. Artefakten ligger på en
 *     adress som inte är appens - sökvägen tillhör värden. Med
 *     BrowserRouter läser routern värdens sökväg och svarar "Sidan finns
 *     inte" på varje vy.
 *
 *  2. VITE_DEMO_MODE=true. Artefakten når ingen server. Utan demoläget
 *     ringer den det riktiga API:et och varje inloggning slutar i "Vi
 *     kunde inte nå servern".
 *
 *  3. Sidan blir KROPPSINNEHÅLL. Artefakten bäddas in i ett eget
 *     dokumentskal, så doctype, <html>, <head> och <body> ska bort - men
 *     allt som låg i huvudet (titel, stil, skript) måste följa med ned i
 *     kroppen, annars är sidan tom.
 *
 * Körs som: node scripts/bygg-artefakt.mjs [utfil]
 */
import { execSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const REPO = process.cwd();
const UT = path.resolve(process.argv[2] ?? "clearance-artifact.html");

/* --- 1. En egen byggkatalog, kastas efteråt ------------------------------- */

/*
 * Bygget sker på en KOPIA. HashRouter-bytet skriver i App.tsx, och att
 * skriva i repot under ett bygge är hur man råkar checka in en ändring
 * ingen bad om. Kopian tar bara det vite behöver.
 */
const BYGG = mkdtempSync(path.join(tmpdir(), "clearance-artefakt-"));
const KOPIERAS = [
  "src",
  "public",
  // Utvecklarsidan (/api) läser kontraktet direkt: ApiDocs.tsx importerar
  // ../../api/openapi.json, och utan den filen stannar bygget.
  //
  // BARA kontraktet, inte hela api/. Katalogen innehåller numera
  // serverfunktionerna (Vercel-ingången och cron-jobben); de har inget i
  // en frontend-artefakt att göra, och "kopian tar bara det vite behöver"
  // ska vara sant och inte ungefär sant.
  "api/openapi.json",
  "index.html",
  "tailwind.config.ts",
  "postcss.config.js",
  "components.json",
  "tsconfig.json",
  "tsconfig.app.json",
  "tsconfig.node.json",
  // Rotens tsconfig REFERERAR den. Utan filen faller vite på
  // "parsing tsconfig.server.json failed" - ett bygge som gick sönder av
  // en referens till något som inte kopierades med.
  "tsconfig.server.json",
  "package.json",
  "node_modules",
];

try {
  for (const post of KOPIERAS) {
    cpSync(path.join(REPO, post), path.join(BYGG, post), { recursive: true, verbatimSymlinks: true });
  }

  /* --- 2. HashRouter ------------------------------------------------------ */

  const appFil = path.join(BYGG, "src/App.tsx");
  const app = readFileSync(appFil, "utf8");
  if (!/\bBrowserRouter\b/.test(app)) {
    throw new Error("App.tsx innehåller ingen BrowserRouter - bytet är inte längre det som behövs.");
  }
  writeFileSync(appFil, app.replaceAll("BrowserRouter", "HashRouter"));

  /* --- 3. Enfilsbygget ---------------------------------------------------- */

  /*
   * Ingen manualChunks: enfilsbygget måste bädda in ALLT, inklusive
   * diagramchunken som appbygget medvetet håller separat.
   */
  writeFileSync(
    path.join(BYGG, "vite.config.ts"),
    `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig(() => ({
  plugins: [react(), viteSingleFile()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
}));
`,
  );

  /* --- 3b. Miljön: demoläge, och INGA riktiga uppgifter ------------------- */

  /*
   * ARTEFAKTEN ÄR EN PUBLICERAD FIL. Allt som byggs in i den är läsbart för
   * var och en som öppnar den.
   *
   * Supabase-klienten skapas när modulen laddas, även i demoläge, och
   * kräver en adress. Den tidigare byggkatalogen hade en .env med
   * projektets RIKTIGA adress och anon-nyckel - och de följde alltså med
   * ut i den publicerade demon. Anon-nyckeln är publik av konstruktion,
   * men adressen pekar ut ett skarpt projekt där radskyddet är hela
   * skyddet, och det finns ingen anledning att bjuda in till det från en
   * demo.
   *
   * Här skrivs i stället platshållare. Demoadaptern rör aldrig klienten,
   * så de används aldrig till något - de finns för att konstruktorn ska
   * ha något att svälja.
   */
  writeFileSync(
    path.join(BYGG, ".env"),
    [
      "VITE_DEMO_MODE=true",
      'VITE_SUPABASE_URL="https://demo.invalid"',
      'VITE_SUPABASE_PUBLISHABLE_KEY="demo-ingen-riktig-nyckel"',
      'VITE_SUPABASE_PROJECT_ID="demo"',
      "",
    ].join("\n"),
  );

  execSync("npx vite build", {
    cwd: BYGG,
    stdio: "inherit",
    env: { ...process.env, VITE_DEMO_MODE: "true" },
  });

  /* --- 4. Dokument -> kroppsinnehåll -------------------------------------- */

  const dist = readFileSync(path.join(BYGG, "dist/index.html"), "utf8");

  /*
   * ANKARNA TAS I ÄNDARNA AV FILEN, inte framifrån.
   *
   * Det inlinade skriptet bär både "<body>" och "</head>" som TEXT -
   * utskriftshjälpen bygger ett eget dokument i en sträng. En sökning
   * framifrån efter "<body>" hamnar alltså mitt i skriptet: första
   * försöket gav en 3,3 MB fil där bygget var 2,25 MB, för att kroppen
   * började inne i huvudet och allt kom med två gånger.
   */
  const efterForsta = (marko) => {
    const i = dist.indexOf(marko);
    if (i < 0) throw new Error(`hittade inte ${marko} i bygget`);
    return i + marko.length;
  };
  const sista = (marko) => {
    const i = dist.lastIndexOf(marko);
    if (i < 0) throw new Error(`hittade inte ${marko} i bygget`);
    return i;
  };

  const huvud = dist.slice(efterForsta("<head>"), sista("</head>"));
  const kropp = dist.slice(sista("<body>") + "<body>".length, sista("</body>"));
  const ut = `${huvud.trim()}\n${kropp.trim()}\n`;

  /*
   * Att SÖKA efter "<!DOCTYPE" i hela texten går inte, av samma skäl som
   * ovan: skriptet bär den strängen. Det som kan gå fel här är att ankarna
   * glider, och det syns i ändarna.
   */
  const start = ut.trimStart().slice(0, 40).toLowerCase();
  const slut = ut.trimEnd().slice(-40).toLowerCase();
  if (start.startsWith("<!doctype") || start.startsWith("<html")) {
    throw new Error(`dokumentskalet ligger kvar i början: ${ut.trimStart().slice(0, 60)}`);
  }
  if (slut.endsWith("</html>") || slut.endsWith("</body>")) {
    throw new Error(`dokumentskalet ligger kvar i slutet: ${ut.trimEnd().slice(-60)}`);
  }
  if (!ut.includes('<div id="root">')) throw new Error("roten saknas - sidan skulle bli tom");
  if (!/<script[^>]*type="module"/.test(ut)) throw new Error("appskriptet saknas");
  if (!ut.includes("<title>")) throw new Error("titeln saknas - artefakten får sitt namn ur den");

  /*
   * INGENTING SKARPT FÅR FÖLJA MED UT. Filen publiceras; det som ligger i
   * den är läst av var och en som öppnar den. Kontrollen är en rad kod och
   * ersätter ett antagande som en gång var fel.
   */
  const skarpt = [
    [/[a-z0-9-]+\.supabase\.co/i, "en riktig Supabase-adress"],
    [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./, "en JWT (Supabase anon-nyckel?)"],
    [/sk-ant-api[0-9]{2}-/, "en Anthropic-nyckel"],
    [/\bAKIA[0-9A-Z]{16}\b/, "ett AWS-nyckel-id"],
    [/\bclr_[A-Za-z0-9]{8,}/, "en Clearance API-nyckel"],
  ];
  for (const [monster, vad] of skarpt) {
    const traff = ut.match(monster);
    if (traff) throw new Error(`${vad} följde med ut i artefakten: ${traff[0].slice(0, 40)}`);
  }
  if (!/DEMOLÄGE|Demoläge/.test(ut)) {
    throw new Error("demobannern saknas - bygget kan ha missat VITE_DEMO_MODE");
  }

  writeFileSync(UT, ut);
  console.log(`\n${UT}: ${(ut.length / 1024 / 1024).toFixed(2)} MB`);
} finally {
  rmSync(BYGG, { recursive: true, force: true });
}
