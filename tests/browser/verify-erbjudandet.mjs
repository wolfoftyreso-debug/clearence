/**
 * ERBJUDANDET, PRÖVAT SOM EN MÄNNISKA MÖTER DET.
 *
 * Tre fel rapporterades av någon som försökte använda rutan: knappen låg
 * under demobannern, priset stod dubbelt ("2 780 kr/mån + moms exkl.
 * moms"), och texten lät som att beloppet var priset för SMS.
 *
 * Källvakter kan se att strängarna finns. De kan INTE se om knappen går
 * att träffa - och det var det felet som gjorde rutan oanvändbar. Därför
 * mäter den här filen geometri: den rullar fram knappen och frågar
 * elementFromPoint vad som faktiskt ligger på den punkten.
 *
 * INGEN GENVÄG GENOM LAGRINGEN. Samtalet körs hela vägen - konto,
 * välkomst, tre fält, situationsval, femton frågor - tills analysen står
 * där. Det är också vägen felet rapporterades i, och den vägen bär sin
 * egen upptäckt: erbjudandet gick en period inte att nå alls i demon,
 * eftersom registreringen sådde ett färdigt ärende och samtalsvyn då
 * visar ärendet i stället för introduktionen.
 *
 * Körs som: node tests/browser/verify-erbjudandet.mjs <artefakt.html>
 * Bygg artefakten först: node scripts/bygg-artefakt.mjs <artefakt.html>
 */
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const { chromium } = pw;
const ARTEFAKT = path.resolve(process.argv[2] ?? "clearance-artifact.html");
const ARBETE = path.join(path.dirname(ARTEFAKT), "wrapped-test.html");
const BILDER = path.join(process.cwd(), "shots");
mkdirSync(BILDER, { recursive: true });

/*
 * Artefakten är kroppsinnehåll, inte ett dokument (se scripts/bygg-artefakt.mjs).
 * Här sätts skalet tillbaka, precis som publiceringen gör.
 */
writeFileSync(
  ARBETE,
  `<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(ARTEFAKT, "utf8")}</body></html>`,
);
const base = `file://${ARBETE}`;

let passed = 0;
let failed = 0;
const check = (namn, ok, extra = "") => {
  if (ok) {
    passed++;
    console.log(`PASS ${namn}`);
  } else {
    failed++;
    console.log(`FAIL ${namn} ${extra}`);
  }
};

const b = await chromium.launch();
const fel = [];
// 375x667: den minsta vanliga telefonen, alltså värsta läget för en fast banner.
const p = await b.newPage({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
p.on("pageerror", (e) => fel.push(e.message));

/* --- Ett nytt konto ------------------------------------------------------- */

await p.goto(`${base}#/login`, { waitUntil: "load" });
await p.waitForTimeout(1200);
await p.click('button:has-text("Skapa ett")');
await p.waitForTimeout(600);
await p.locator("text=Jag driver företaget").click();
await p.fill("#email", "erbjudandet@exempel.se");
await p.fill("#password", "hemligt123");
await p.click('button:has-text("Skapa konto")');
await p.waitForTimeout(2500);

await p.evaluate(() => localStorage.removeItem("clearance-pro-offer-seen"));
await p.goto(`${base}#/dashboard/samtal`, { waitUntil: "load" });
await p.waitForTimeout(2000);

/* --- Genom samtalet, som en människa -------------------------------------- */

// Knappar som INTE är svar: de leder ut ur samtalet eller tillbaka i det.
const KANDA = [
  "Visa mig",
  "Starta",
  "Ompröva beslutet",
  "Beslutet står fast",
  "Börja om från början",
  "Ändra",
  "Behåll mitt tidigare svar",
  "Hoppa över",
  "Ändra föregående svar",
  "Nej tack",
];

// Fälten fylls efter sin ledtext. Ett organisationsnummer i namnfältet hade
// stoppat samtalet på en valideringsrad i stället för på en fråga.
const svarPaFalt = (ph) =>
  /Förnamn/i.test(ph)
    ? "Erik Andersson"
    : /Bolagets namn|Företagsnamn/i.test(ph)
      ? "Demobolaget AB"
      : /XXXXXX/i.test(ph)
        ? "556012-3456"
        : /kr/i.test(ph)
          ? "100000"
          : "Pengarna räcker inte till nästa löneutbetalning";

let steg = 0;
while (steg < 60) {
  if ((await p.locator('button:has-text("Ja, visa hur")').count()) > 0) break;

  // Bara samtalet. Utanför det ligger notisklockan och menyn - en förare som
  // klickar på klockan fyrtio gånger tror sig ha svarat.
  const samtal = p.locator('section[aria-label="Samtal med CLEARANCE"]');
  if (steg === 0 && (await samtal.count()) === 0) {
    console.log("introduktionssamtalet visas inte alls");
    break;
  }

  const falt = samtal.locator("input:visible, textarea:visible");
  const antalFalt = await falt.count();
  for (let f = 0; f < antalFalt; f++) {
    const ruta = falt.nth(f);
    if ((await ruta.inputValue()) !== "") continue;
    await ruta.fill(svarPaFalt((await ruta.getAttribute("placeholder")) ?? ""));
  }

  const knappar = samtal.locator("button:visible");
  const etiketter = await knappar.evaluateAll((es) => es.map((e) => e.textContent.trim()));

  // FLERVALSFRÅGOR bekräftas med en egen knapp. Utan den här raden klickar
  // föraren samma alternativ av och på i all evighet.
  const bekraftelse = etiketter.findIndex((t) => /^Svara( med \d+ val)?$/.test(t));
  const i =
    bekraftelse >= 0
      ? bekraftelse
      : etiketter.findIndex((t) => t && !KANDA.includes(t) && t.length < 60);
  if (i < 0) {
    console.log("inget svar att välja vid steg", steg, JSON.stringify(etiketter));
    break;
  }
  await knappar.nth(i).click();
  await p.waitForTimeout(500);
  steg++;
}
console.log(`steg genom samtalet: ${steg}`);

const smsJa = p.locator('button:has-text("Ja, visa hur")').first();
check("SMS-kortet nås", (await smsJa.count()) > 0, (await p.locator("body").innerText()).slice(0, 300));
if ((await smsJa.count()) === 0) {
  await b.close();
  process.exit(1);
}
await smsJa.scrollIntoViewIfNeeded();
await smsJa.click();
await p.waitForTimeout(900);

await p.screenshot({ path: path.join(BILDER, "erbjudandet-375.png") });
const text = await p.locator("body").innerText();
check("erbjudandet öppnas", /Provvecka/.test(text), text.slice(0, 200));

/* --- Vad rutan SÄGER ------------------------------------------------------ */

check("skälet står i rutan", /bjuder vi på en veckas prov/.test(text));
check("användaren tar ställning själv efteråt", /tar du ställning själv/.test(text));
check("ingenting förlängs automatiskt", /förlängs automatiskt/.test(text));
check("det är inte SMS man betalar för", /inte SMS du betalar för/.test(text));
check("klockans innebörd sägs", /Klockan gäller den gratis provveckan/.test(text));
check(
  "priset står inte dubbelt",
  !/moms.{0,20}exkl\. moms/s.test(text),
  (text.match(/.{0,40}exkl\. moms.{0,20}/g) ?? []).join(" | "),
);
check("första veckan är 0 kr", /Första veckan 0 kr/.test(text));

/* --- Går knapparna att TRÄFFA? -------------------------------------------- */

const traffbar = async (namn) => {
  const knapp = p.locator(`button:has-text("${namn}")`).first();
  if ((await knapp.count()) === 0) return { finns: false };
  /*
   * Rutan är högre än en telefonskärm och rullar. Att mäta utan att rulla
   * fram knappen mäter en punkt utanför fönstret - och elementFromPoint
   * svarar null där, vilket ser ut som "täckt" fast det är "inte framme".
   */
  await knapp.scrollIntoViewIfNeeded();
  await p.waitForTimeout(250);
  const r = await knapp.boundingBox();
  if (!r) return { finns: true, synlig: false };
  const x = Math.round(r.x + r.width / 2);
  const y = Math.round(r.y + r.height / 2);
  const traff = await p.evaluate(([px, py]) => {
    const el = document.elementFromPoint(px, py);
    return {
      tag: el?.tagName ?? null,
      text: (el?.textContent ?? "").trim().slice(0, 40),
      iKnapp: !!el?.closest("button"),
    };
  }, [x, y]);
  return { finns: true, synlig: true, ...traff, y };
};

const ja = await traffbar("Ja, aktivera");
const nej = await traffbar("Nej tack");
check("ja-knappen ligger fritt, inget täcker den", ja.iKnapp === true, JSON.stringify(ja));
check("nej-knappen ligger fritt, inget täcker den", nej.iKnapp === true, JSON.stringify(nej));
await p.screenshot({ path: path.join(BILDER, "erbjudandet-375-knappar.png") });

// Och den går faktiskt att klicka utan att Playwright måste tvinga.
let klickOk = true;
await p
  .locator('button:has-text("Nej tack")')
  .first()
  .click({ timeout: 3000 })
  .catch((e) => {
    klickOk = false;
    console.log("  klickfel:", String(e).slice(0, 120));
  });
check("det går att tacka nej", klickOk);
await p.waitForTimeout(800);
check("rutan stängs efter nej", !/Provvecka/.test(await p.locator("body").innerText()));

check("inga sidfel", fel.length === 0, fel.join("\n"));
await b.close();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
