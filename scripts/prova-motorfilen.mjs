/**
 * PROVAR DEN EXTRAHERADE MOTORFILEN MED PRODUKTENS EGNA SVITER.
 *
 * Att clearance-motor.ts kompilerar bevisar att den är syntaktiskt hel. Det
 * bevisar inte att motorn FUNGERAR ur den - att ett namnbyte inte pekade
 * fel, att den topologiska ordningen inte lade en konstant efter sin
 * användning, att en aliasad import inte tappades.
 *
 * Det enda provet som avgör det är att köra riktiga tester mot filen. Här
 * byggs sviterna om med en esbuild-plugin som styr om VARJE import av en
 * motormodul (@/lib/..., ../src/lib/..., @/data/types, @/data/ports) till
 * den extraherade filen. Går sviterna gröna då kommer varje funktion de
 * rör ur den platta filen, inte ur originalen.
 *
 * Sviter som inte kan köras så här hoppas över MED SKÄL utskrivet - en
 * tyst överhoppning är hur ett prov slutar bevisa något.
 */
import esbuild from "esbuild";
import { execFileSync } from "node:child_process";
import { join, resolve, dirname, relative } from "node:path";
import { existsSync, readFileSync } from "node:fs";

const rot = process.cwd();
const MOTOR = join(rot, "clearance-motor.ts");

const SVITER = [
  "crisisAnalysis", "financial", "bankStatement", "sie", "actionPlan", "templates",
  "knowledge", "executiveSummary", "portfolioSummary", "auditDetail", "taskIntelligence",
  "billing", "email", "integrations", "leadSummary", "presentation", "advisor",
  "options", "premiseWatch", "prepare", "tone", "signing", "notificationService",
  "montecarlo", "guide", "reports", "sources", "dataskydd",
];

const HOPPAS_OVER = {
  language: "läser localStorage vid import; kräver webbläsarstubbe som inte hör hit",
  onboarding: "samma sak - localStorage vid import",
  avbrott: "samma sak - localStorage vid import",
  pricingModel: "läser källkodsfiler och kräver deras sökvägar, inte deras funktioner",
  apiSpec: "prövar API-kontraktet, inte motorn",
  deploy: "prövar bygget och kedjan, inte motorn",
  sakerhet: "prövar API-servern och lagringen, inte motorn",
};

/*
 * FÖRST: ÄR FILEN FÄRSK?
 *
 * En genererad fil som ligger kvar medan källan ändras är värre än ingen
 * fil alls - den ser aktuell ut. Provet kör därför extraktorn på nytt och
 * jämför. Skiljer sig något har någon ändrat i modulerna utan att bygga om,
 * eller ändrat direkt i den genererade filen; båda ska stoppa här.
 */
{
  const fore = existsSync(join(rot, "clearance-motor.ts")) ? readFileSync(join(rot, "clearance-motor.ts"), "utf8") : "";
  execFileSync("node", [join(rot, "scripts/extrahera-motor.mjs")], { stdio: "ignore" });
  const efter = readFileSync(join(rot, "clearance-motor.ts"), "utf8");
  if (fore !== efter) {
    console.error("AVBRYTER: clearance-motor.ts var inte färsk. Den är nu ombyggd ur modulerna –");
    console.error("granska diffen och kör om provet.");
    process.exit(1);
  }
}

const register = JSON.parse(readFileSync(join(rot, "clearance-motor.register.json"), "utf8"));
const exportKarta = new Map(register.moduler.map((m) => [m.modul, m.exporterar]));

/** "@/lib/billing" / "../src/lib/billing" -> "src/lib/billing.ts" */
const tillModulnyckel = (spec, importer) => {
  let bana;
  if (spec.startsWith("@/")) bana = join(rot, "src", spec.slice(2));
  else if (spec.startsWith(".")) bana = resolve(dirname(importer), spec);
  else return null;
  const n = relative(rot, bana) + ".ts";
  return exportKarta.has(n) ? n : null;
};

/*
 * VARFÖR EN SKUGGMODUL OCH INTE BARA EN OMSTYRNING TILL FILEN.
 *
 * Fyra moduler deklarerar `daysBetween`, med olika signaturer. I den platta
 * filen behåller en av dem namnet och de andra får suffix. En svit som
 * importerar daysBetween från billing måste alltså få daysBetween__billing -
 * annars provar den fel funktion. Första försöket styrde bara om sökvägen,
 * och då blev billing- och bankStatement-sviterna röda av precis det skälet:
 * provet, inte filen, var trasigt. Här byggs i stället en liten modul per
 * importerad sökväg som exporterar den plattas namn under modulens egna.
 */
const styrOm = {
  name: "styr-om-till-motorfilen",
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => {
      if (args.namespace === "motorskugga") return undefined;
      const nyckel = tillModulnyckel(args.path, args.importer);
      if (nyckel) return { path: nyckel, namespace: "motorskugga" };
      if (args.path.startsWith("@/")) return { path: resolve(rot, "src", args.path.slice(2)) + ".ts" };
      return undefined;
    });
    build.onLoad({ filter: /.*/, namespace: "motorskugga" }, (args) => {
      const karta = exportKarta.get(args.path) ?? {};
      const bitar = Object.entries(karta).map(([ute, inne]) => (ute === inne ? ute : `${inne} as ${ute}`));
      const kod = bitar.length
        ? `export { ${bitar.join(", ")} } from ${JSON.stringify(MOTOR)};`
        : `export {};`;
      return { contents: kod, loader: "ts", resolveDir: rot };
    });
  },
};

let gronna = 0, roda = 0;
const rott = [];
for (const svit of SVITER) {
  const kalla = join(rot, "tests", `${svit}.ts`);
  if (!existsSync(kalla)) { console.log(`  ${svit.padEnd(22)} SAKNAS  tests/${svit}.ts finns inte`); rott.push(svit); roda++; continue; }
  const ut = join(rot, "node_modules/.cache", `motorprov-${svit}.cjs`);
  try {
    await esbuild.build({
      entryPoints: [kalla], bundle: true, platform: "node", format: "cjs",
      outfile: ut, logLevel: "silent", plugins: [styrOm],
    });
  } catch (e) {
    console.log(`  ${svit.padEnd(22)} BYGGFEL ${String(e.message).split("\n")[0].slice(0, 90)}`);
    rott.push(svit); roda++; continue;
  }
  try {
    const utdata = execFileSync("node", [ut], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const rad = utdata.trim().split("\n").filter((r) => /passed/.test(r)).pop() ?? "";
    console.log(`  ${svit.padEnd(22)} ok      ${rad}`);
    gronna++;
  } catch (e) {
    const utdata = `${e.stdout ?? ""}${e.stderr ?? ""}`;
    const fel = utdata.split("\n").filter((r) => /^FAIL|Error|passed/.test(r)).slice(0, 2).join(" | ");
    console.log(`  ${svit.padEnd(22)} RÖD     ${fel.slice(0, 110)}`);
    rott.push(svit); roda++;
  }
}

console.log(`\n${gronna} sviter gröna mot den extraherade filen, ${roda} röda.`);
if (Object.keys(HOPPAS_OVER).length) {
  console.log("\nÖverhoppade, med skäl:");
  for (const [s, skal] of Object.entries(HOPPAS_OVER)) console.log(`  ${s.padEnd(22)} ${skal}`);
}
if (roda > 0) { console.log(`\nRÖDA: ${rott.join(", ")}`); process.exit(1); }
