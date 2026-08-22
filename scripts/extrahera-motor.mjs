/**
 * EXTRAHERAR MOTORN TILL EN ENDA FIL.
 *
 * Vad "motorn" är: allt i src/lib - domänlogiken, samtalsmotorn som
 * vägleder, analyserna, guiderna, verktygen, rapportbyggarna, källorna,
 * simuleringen, gallringspolicyn - plus de två filer som bär kontraktet,
 * src/data/types.ts och src/data/ports.ts. Det är den del av CLEARANCE som
 * inte vet något om React, om vilken databas som ligger under eller om hur
 * sidan ser ut, och därmed den del ett annat verktyg kan byggas ovanpå.
 *
 * TRE SAKER GÖR DEN HÄR FILEN ÄRLIG I STÄLLET FÖR UNGEFÄRLIG.
 *
 *  1. ORDNINGEN ÄR TOPOLOGISK, uträknad ur modulernas egna importer. En
 *     cykel avbryter körningen i stället för att gissa - en cykel som tyst
 *     plattas ut blir ett fel som visar sig först vid körning.
 *
 *  2. NAMNBYTEN GÖRS MED TYPESCRIPTS EGEN PARSER, inte med reguljära
 *     uttryck. 18 namn deklareras i mer än en modul (swedishDate, sek, kr,
 *     daysBetween ...). Ett textbyte hade träffat samma bokstäver inne i
 *     strängar, i egenskapsnamn och i andra scopes; här bytts bara de
 *     identifierarnoder som faktiskt syftar på deklarationen - och bytet
 *     följer med till varje modul som importerade namnet.
 *
 *  3. INGET UTELÄMNAS TYST. Uteslutna filer, omdöpta namn och yttre
 *     beroenden står uppräknade i huvudet på den genererade filen.
 *
 * Kontrollen som betyder något är inte att skriptet gick igenom, utan att
 * resultatet kompilerar fristående och att motorn går att köra ur det. Se
 * scripts/prova-motorfilen.sh.
 */
import ts from "typescript";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, dirname, resolve } from "node:path";

const rot = process.cwd();
const UTESLUTNA = new Map([
  ["src/lib/utils.ts", "Tailwind-hjälpare (clsx + tailwind-merge). Hör till ytan, inte motorn."],
]);

const filer = [];
const ga = (d) => {
  for (const e of readdirSync(d).sort()) {
    const f = join(d, e);
    statSync(f).isDirectory() ? ga(f) : (/\.ts$/.test(e) && filer.push(f));
  }
};
ga(join(rot, "src/lib"));
filer.push(join(rot, "src/data/types.ts"), join(rot, "src/data/ports.ts"));

const modul = new Map();
for (const f of filer) {
  const nyckel = relative(rot, f);
  if (UTESLUTNA.has(nyckel)) continue;
  const kod = readFileSync(f, "utf8");
  modul.set(nyckel, { fil: f, kod, sf: ts.createSourceFile(f, kod, ts.ScriptTarget.ES2020, true) });
}

/** "@/lib/x", "./x" -> nyckeln i modulkartan, {saknas} när den ligger utanför, null när den är yttre. */
const losUpp = (spec, franFil) => {
  let bana;
  if (spec.startsWith("@/")) bana = join(rot, "src", spec.slice(2));
  else if (spec.startsWith(".")) bana = resolve(dirname(franFil), spec);
  else return null;
  for (const kandidat of [`${bana}.ts`, join(bana, "index.ts")]) {
    const n = relative(rot, kandidat);
    if (modul.has(n)) return n;
  }
  return { saknas: relative(rot, bana) };
};

// --- Vad varje modul deklarerar och vad den importerar -----------------------
const namnUr = (n, ut) => {
  if (ts.isIdentifier(n)) ut.add(n.text);
  else if (ts.isObjectBindingPattern(n) || ts.isArrayBindingPattern(n))
    for (const e of n.elements) if (ts.isBindingElement(e)) namnUr(e.name, ut);
};

const utanfor = [];
const yttreImporter = new Map();
for (const [nyckel, m] of modul) {
  m.deklarerar = new Set();
  m.importerar = [];          // { lokalt, ursprung, fran }
  m.importSatser = [];
  m.exportSatser = [];
  m.beroenden = new Set();
  // Vad modulen deklarerar SJÄLV, läst i förväg: export-satserna nedan
  // behöver veta det innan de kan avgöra vad som är en återexport.
  m.deklarerarRa = new Set();
  for (const st of m.sf.statements) {
    if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) namnUr(d.name, m.deklarerarRa);
    else if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isInterfaceDeclaration(st)
      || ts.isTypeAliasDeclaration(st) || ts.isEnumDeclaration(st)) && st.name) m.deklarerarRa.add(st.name.text);
  }
  for (const st of m.sf.statements) {
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) namnUr(d.name, m.deklarerar);
    } else if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isInterfaceDeclaration(st)
      || ts.isTypeAliasDeclaration(st) || ts.isEnumDeclaration(st)) && st.name) {
      m.deklarerar.add(st.name.text);
    } else if (ts.isExportDeclaration(st)) {
      // `export { X }` utan `from` är antingen en lokal exportlista eller en
      // återexport av något modulen importerat. Det senare blir en dubblett i
      // en platt fil: namnet exporteras redan där det deklareras.
      if (st.moduleSpecifier) {
        utanfor.push(`${nyckel} -> export ... from (återexport stöds inte i en platt fil)`);
      } else if (st.exportClause && ts.isNamedExports(st.exportClause)) {
        const behall = st.exportClause.elements.filter((e) => m.deklarerarRa.has((e.propertyName ?? e.name).text));
        const text = behall.length === 0
          ? ""
          : `export ${st.isTypeOnly ? "type " : ""}{ ${behall.map((e) => e.getText(m.sf)).join(", ")} };`;
        m.exportSatser.push({ start: st.getStart(m.sf), slut: st.getEnd(), text });
      }
    } else if (ts.isImportDeclaration(st)) {
      const spec = st.moduleSpecifier.text;
      const traff = losUpp(spec, m.fil);
      // Alla importsatser klipps ur kroppen. De interna försvinner helt (allt
      // ligger i samma fil), de yttre hissas till toppen - lämnas de kvar
      // dyker samma namn upp två gånger.
      m.importSatser.push({ start: st.getStart(m.sf), slut: st.getEnd() });
      if (traff === null) {
        if (!yttreImporter.has(spec)) yttreImporter.set(spec, new Set());
        yttreImporter.get(spec).add(st.getText(m.sf).trim());
        continue;
      }
      if (typeof traff !== "string") { utanfor.push(`${nyckel} -> ${spec}`); continue; }
      if (traff !== nyckel) m.beroenden.add(traff);
      const c = st.importClause;
      if (!c) continue;
      if (c.name) m.importerar.push({ lokalt: c.name.text, ursprung: "default", fran: traff });
      if (c.namedBindings && ts.isNamedImports(c.namedBindings)) {
        for (const e of c.namedBindings.elements) {
          m.importerar.push({ lokalt: e.name.text, ursprung: (e.propertyName ?? e.name).text, fran: traff });
        }
      }
      if (c.namedBindings && ts.isNamespaceImport(c.namedBindings)) {
        utanfor.push(`${nyckel} -> import * as ${c.namedBindings.name.text} (stjärnimport stöds inte i en platt fil)`);
      }
    }
  }
}

if (utanfor.length > 0) {
  console.error("AVBRYTER: moduler når utanför motorn:\n  " + utanfor.join("\n  "));
  process.exit(1);
}

// --- Topologisk ordning -----------------------------------------------------
const ordning = [];
const laget = new Map();
const stig = [];
const besok = (n) => {
  if (laget.get(n) === "klar") return;
  if (laget.get(n) === "pagar") {
    console.error("AVBRYTER: cykel i beroendena:\n  " + [...stig, n].join(" -> "));
    process.exit(1);
  }
  laget.set(n, "pagar");
  stig.push(n);
  for (const b of [...modul.get(n).beroenden].sort()) besok(b);
  stig.pop();
  laget.set(n, "klar");
  ordning.push(n);
};
for (const n of [...modul.keys()].sort()) besok(n);

// --- Krockar: vem behåller namnet, vem byter --------------------------------
const agare = new Map();
const nyttNamnFor = new Map();   // "modul::namn" -> nytt namn
const dopLista = [];
const modulTagg = (n) => n.replace(/^src\/(lib\/|data\/)?/, "").replace(/\.ts$/, "").replace(/[/-]/g, "_");
for (const n of ordning) {
  for (const namn of [...modul.get(n).deklarerar].sort()) {
    if (!agare.has(namn)) { agare.set(namn, n); continue; }
    const nytt = `${namn}__${modulTagg(n)}`;
    nyttNamnFor.set(`${n}::${namn}`, nytt);
    dopLista.push({ namn, nytt, modul: n, forst: agare.get(namn) });
  }
}

// --- Bytena, nod för nod ----------------------------------------------------
const arEgenskapsnamn = (nod) => {
  const p = nod.parent;
  if (!p) return false;
  if (ts.isPropertyAccessExpression(p) && p.name === nod) return true;
  if (ts.isQualifiedName(p) && p.right === nod) return true;
  if (ts.isPropertyAssignment(p) && p.name === nod) return true;
  if ((ts.isPropertySignature(p) || ts.isMethodSignature(p) || ts.isPropertyDeclaration(p) || ts.isMethodDeclaration(p) || ts.isEnumMember(p)) && p.name === nod) return true;
  if (ts.isImportSpecifier(p) || ts.isExportSpecifier(p)) return true;
  return false;
};

const byggModul = (nyckel) => {
  const m = modul.get(nyckel);
  // Vilka namn ska bytas i just den här modulen: egna omdöpta + importerade
  // namn som döptes om i sin ursprungsmodul.
  const byten = new Map();
  for (const namn of m.deklarerar) {
    const nytt = nyttNamnFor.get(`${nyckel}::${namn}`);
    if (nytt) byten.set(namn, nytt);
  }
  // Ett importerat namn kan skilja sig från deklarationens på två sätt: det
  // kan vara aliasat vid importen (`validera as validerarFordelning`), och
  // deklarationen kan ha döpts om för att den krockade. Båda leder till
  // samma sak - det lokala namnet ska bli det namn deklarationen har i den
  // här filen. Utan det pekar kroppen på ett namn som inte finns.
  for (const imp of m.importerar) {
    const slutligt = nyttNamnFor.get(`${imp.fran}::${imp.ursprung}`) ?? imp.ursprung;
    if (slutligt !== imp.lokalt && !byten.has(imp.lokalt)) byten.set(imp.lokalt, slutligt);
  }

  const klipp = [];
  for (const s of m.importSatser) klipp.push({ start: s.start, slut: s.slut, text: "" });
  for (const e of m.exportSatser) klipp.push({ start: e.start, slut: e.slut, text: e.text });

  if (byten.size > 0) {
    const ga2 = (nod) => {
      if (ts.isIdentifier(nod) && byten.has(nod.text) && !arEgenskapsnamn(nod)) {
        // Kortform i objektliteral: { sek } -> { sek: sek__nyttnamn }
        const p = nod.parent;
        if (p && ts.isShorthandPropertyAssignment(p) && p.name === nod) {
          klipp.push({ start: nod.getStart(m.sf), slut: nod.getEnd(), text: `${nod.text}: ${byten.get(nod.text)}` });
        } else {
          klipp.push({ start: nod.getStart(m.sf), slut: nod.getEnd(), text: byten.get(nod.text) });
        }
      }
      nod.forEachChild(ga2);
    };
    m.sf.forEachChild(ga2);
  }

  let kod = m.kod;
  for (const k of klipp.sort((a, b) => b.start - a.start)) {
    kod = kod.slice(0, k.start) + k.text + kod.slice(k.slut);
  }
  return kod.replace(/\n{3,}/g, "\n\n").trim();
};

// --- Skriv filen ------------------------------------------------------------
const yttreRader = [...new Set([...yttreImporter.values()].flatMap((s) => [...s]))].sort();
const kroppar = [];
for (const n of ordning) kroppar.push({ modul: n, kod: byggModul(n) });

const huvud = [];
const nu = new Date().toISOString().slice(0, 10);
const totalRader = kroppar.reduce((a, k) => a + k.kod.split("\n").length, 0);
huvud.push("/**");
huvud.push(" * CLEARANCE - MOTORN, I EN FIL.");
huvud.push(" *");
huvud.push(` * Genererad ${nu} av scripts/extrahera-motor.mjs ur arbetsträdet.`);
huvud.push(" * REDIGERA INTE HÄR. Ändringar hör hemma i modulerna filen byggs av;");
huvud.push(" * annars glider originalet och kopian isär, och kopian vinner aldrig.");
huvud.push(" *");
huvud.push(" * INNEHÅLLER: hela domänlagret - samtalsmotorn som vägleder, analyserna,");
huvud.push(" * guiderna, verktygen, rapportbyggarna, källorna, simuleringen och");
huvud.push(" * gallringen - plus kontraktet (types.ts, ports.ts) som säger vad en värd");
huvud.push(" * måste tillhandahålla för att motorn ska gå att köra.");
huvud.push(" *");
huvud.push(" * INNEHÅLLER INTE, och varför:");
huvud.push(" *   React-komponenter och sidor  - ytan, inte motorn.");
huvud.push(" *   Adaptrarna (demo/supabase/aws) - motorn talar med DataPort; ett annat");
huvud.push(" *     verktyg skriver sin egen adapter mot samma kontrakt.");
huvud.push(" *   API-servern, arbetarna, migrationerna - driften.");
for (const [fil, skal] of UTESLUTNA) huvud.push(` *   ${fil} - ${skal}`);
huvud.push(" *");
huvud.push(` * OMFATTNING: ${ordning.length} moduler, ${totalRader} rader kod.`);
huvud.push(` * YTTRE BEROENDEN: ${yttreRader.length === 0 ? "inga" : yttreRader.length + " (överst i filen)"}.`);
if (dopLista.length > 0) {
  huvud.push(" *");
  huvud.push(` * OMDÖPTA NAMN (${dopLista.length}). Namnet deklarerades i mer än en modul;`);
  huvud.push(" * den första behåller det, de senare får modulsuffix. Bytet gjordes med");
  huvud.push(" * TypeScripts parser, så bara riktiga referenser träffades:");
  for (const d of dopLista) huvud.push(` *   ${d.namn} -> ${d.nytt}   (i ${d.modul}; originalet i ${d.forst})`);
}
huvud.push(" *");
huvud.push(" * INNEHÅLL - modulerna i beroendeordning:");
huvud.push(" */");
huvud.push("");
if (yttreRader.length) huvud.push(...yttreRader, "");

const delar = [huvud.join("\n") + "\n"];
const innehall = [];
let radnr = delar[0].split("\n").length - 1;
for (const k of kroppar) {
  const rubrik = `/* ${"=".repeat(74)}\n   ${k.modul}\n   ${"=".repeat(74)} */\n\n`;
  const bit = rubrik + k.kod + "\n\n";
  innehall.push({ modul: k.modul, rad: radnr + 2 });
  delar.push(bit);
  radnr += bit.split("\n").length - 1;
}

// Innehållsförteckningen får sina radnummer först nu, och skjuter ned allt
// med lika många rader som den själv är - därför räknas den in i förväg.
const tocRader = innehall.map((i) => ` *   RAD  ${i.modul}`);
const forskjutning = tocRader.length;
const toc = innehall.map((i) => ` *   ${String(i.rad + forskjutning).padStart(6)}  ${i.modul}`);
delar[0] = delar[0].replace(" * INNEHÅLL - modulerna i beroendeordning:\n */",
  " * INNEHÅLL - modulerna i beroendeordning:\n" + toc.join("\n") + "\n */");

const ut = join(rot, "clearance-motor.ts");
writeFileSync(ut, delar.join(""));

/*
 * REGISTRET: vilken modul som exporterade vad, och vad namnet heter nu.
 *
 * Det behövs på två håll. Provet i scripts/prova-motorfilen.mjs använder det
 * för att låta produktens egna sviter fråga efter t.ex. billing.daysBetween
 * och få rätt funktion - fyra moduler deklarerar det namnet, med olika
 * signaturer, och utan registret hade provet råkat pröva fel funktion och
 * sett grönt eller rött av fel skäl. Och den som bygger ett verktyg ovanpå
 * filen behöver kunna slå upp var en funktion kom ifrån.
 */
const register = { genererad: nu, fil: "clearance-motor.ts", moduler: [] };
for (const n of ordning) {
  const m = modul.get(n);
  const exporterade = {};
  for (const st of m.sf.statements) {
    const harExport = ts.canHaveModifiers(st) && ts.getModifiers(st)?.some((x) => x.kind === ts.SyntaxKind.ExportKeyword);
    if (!harExport) continue;
    const namn = new Set();
    if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) namnUr(d.name, namn);
    else if (st.name && ts.isIdentifier(st.name)) namn.add(st.name.text);
    for (const x of namn) exporterade[x] = nyttNamnFor.get(`${n}::${x}`) ?? x;
  }
  for (const e of m.exportSatser) {
    for (const bit of (e.text.match(/{([^}]*)}/)?.[1] ?? "").split(",").map((x) => x.trim()).filter(Boolean)) {
      const rent = bit.replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
      if (rent) exporterade[rent] = nyttNamnFor.get(`${n}::${rent}`) ?? rent;
    }
  }
  register.moduler.push({ modul: n, exporterar: exporterade });
}
writeFileSync(join(rot, "clearance-motor.register.json"), JSON.stringify(register, null, 2) + "\n");
console.log(`clearance-motor.ts: ${ordning.length} moduler, ${delar.join("").split("\n").length} rader, ${dopLista.length} omdöpta namn, ${yttreRader.length} yttre importrader`);
