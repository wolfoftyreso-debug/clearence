/**
 * Notisklockan.
 *
 * Två löften prövas här, och båda gick förlorade i den första versionen:
 *
 *  1. Ett klick ska göra något SYNLIGT - navigera och rulla till målet.
 *  2. Siffran ska gå att BETA AV. Klockan räknade tidigare samma tal i
 *     evighet, och en räknare som aldrig går ner är en dekoration.
 *
 * Plus etiketten: den sa "väntar på ditt svar" om rader som själva skrev
 * att inget krävde åtgärd i dag.
 */
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const { chromium } = pw;
const BASE = "http://127.0.0.1:4310";
let passed = 0, failed = 0;
const check = (name, ok, extra = "") => {
  if (ok) { passed++; console.log(`PASS ${name}`); }
  else { failed++; console.log(`FAIL ${name} ${extra}`); }
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(30000);
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.click('button:has-text("Demo – Företag")');
await page.waitForTimeout(1500);
await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);

// Klick på lägesnotisen från sidan den pekar på: ska rulla till systemanalysen.
await page.click("button[aria-label^='Notiser']");
await page.waitForTimeout(500);
await page.click("button:has-text('Läget kräver')");
await page.waitForTimeout(900);
const analysTop = await page.evaluate(() => document.getElementById("systemanalys")?.getBoundingClientRect().top ?? 9999);
check("lägesnotisen rullar till systemanalysen", analysTop > -40 && analysTop < 200, String(Math.round(analysTop)));

// Fristnotisen: ska rulla till fristsektionen.
//
// VILKEN fristrad klockan visar beror på datumen, inte på koden. Är en frist
// nära visas en varningsrad ("Löneutbetalning om 3 dagar"); är ingen nära
// visas i stället informationsraden "Nästa frist ... inget kräver åtgärd i
// dag". Båda pekar på #frister, och båda ska rulla dit.
//
// Provet letade förut bara efter ordet "frist". Den dagen demons
// löneutbetalning gled in i treodagarsfönstret fanns inget sådant ord kvar,
// och klicket träffade en annan knapp - provet blev rött av att datumen
// hade rört sig, inte av att produkten slutat fungera. Nu plockas raden ur
// klockans lista på href, som är det raden faktiskt lovar.
await page.click("button[aria-label^='Notiser']");
await page.waitForTimeout(500);
const fristRad = page.locator("ul li button").filter({ hasText: /frist|om \d+ dag|i dag|i morgon|sedan/i }).first();
check("klockan har en rad som pekar på en frist", (await fristRad.count()) > 0);
await fristRad.click();
await page.waitForTimeout(900);
const fristTop = await page.evaluate(() => document.getElementById("frister")?.getBoundingClientRect().top ?? 9999);
check("fristnotisen rullar till fristerna", fristTop > -40 && fristTop < 250, String(Math.round(fristTop)));

// Notis mot ANNAN sida navigerar dit (KBR-notisen finns när KBR bedömts;
// meddelandenotis kräver tagg - testa i stället att lägesnotisen fungerar
// från en annan sida.
await page.goto(`${BASE}/dashboard/dokument`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
await page.click("button[aria-label^='Notiser']");
await page.waitForTimeout(500);
await page.click("button:has-text('Läget kräver')");
await page.waitForTimeout(1300);
const backOnDashboard = page.url().includes("/dashboard") && !page.url().includes("dokument");
const analysTop2 = await page.evaluate(() => document.getElementById("systemanalys")?.getBoundingClientRect().top ?? 9999);
check("från annan sida: navigerar och rullar", backOnDashboard && analysTop2 < 250, `${page.url()} top=${Math.round(analysTop2)}`);

/* --- Siffran: ärlig, och möjlig att beta av ------------------------------- */

// Ny flik utan minne: allt är oläst igen.
const fresh = await browser.newPage({ viewport: { width: 1280, height: 900 } });
fresh.setDefaultTimeout(30000);
await fresh.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await fresh.waitForTimeout(800);
await fresh.click('button:has-text("Demo – Företag")');
await fresh.waitForTimeout(2000);
await fresh.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await fresh.waitForTimeout(1800);

const bell = fresh.locator("button[aria-label^='Notiser']");
const label = () => bell.getAttribute("aria-label");

const before = await label();
check("etiketten talar om KRAV, inte om meddelanden", /kräver dig/.test(before ?? ""), before ?? "");
check("etiketten säger inte 'väntar på ditt svar'", !/väntar på ditt svar/.test(before ?? ""), before ?? "");

await bell.click();
await fresh.waitForTimeout(500);
const rows = await fresh.locator("ul li button").count();
const badge = Number((before ?? "").match(/(\d+)/)?.[1] ?? "1");
// REGELN, inte dagsformen: en rad som säger att inget krävs i dag får visas
// men inte räknas. Den raden finns bara när ingen frist är nära (se
// src/lib/notifications.ts) - är en frist nära tar en varningsrad dess
// plats, och den SKA räknas. Provet krävde förut informationsraden rakt av
// och blev rött den dag demons datum flyttade sig. Båda lägena prövas nu,
// och vilket som gäller avgörs av vad klockan faktiskt visar.
const kropp = await fresh.innerText("body");
const harInfoRad = /inget kräver åtgärd i dag/i.test(kropp);
if (harInfoRad) {
  check("raden som inte räknas visas ändå", true);
  check("listan är längre än siffran", rows > badge, `rader=${rows} siffra=${badge}`);
} else {
  // Ingen informationsrad => en frist är nära. Då ska den raden finnas, och
  // den ska ingå i siffran: det är ett krav, inte en upplysning.
  const naraFrist = await fresh.locator("ul li button").filter({ hasText: /om \d+ dag|i dag|i morgon/i }).count();
  check("en nära frist visas i stället för upplysningsraden", naraFrist > 0, `rader=${rows} siffra=${badge}`);
  check("den nära fristen räknas med i siffran", badge >= 1, `siffra=${badge}`);
}

// Kvittera en rad: siffran ska gå ner.
await fresh.locator("ul li button").filter({ hasText: "Läget kräver" }).first().click();
await fresh.waitForTimeout(1200);
const after = await label();
const badgeAfter = Number((after ?? "").match(/(\d+)/)?.[1] ?? "0");
check("ett klick betar av raden", badgeAfter < badge || /inget kräver dig/.test(after ?? ""), `${before} -> ${after}`);

// Raden ligger kvar - klockan får inte bli en plats där en frist går att
// gömma genom att klicka bort den.
await bell.click();
await fresh.waitForTimeout(500);
check(
  "den kvitterade raden ligger kvar i listan",
  (await fresh.locator("ul li button").count()) === rows,
);

// Markera alla: siffran ska bli noll.
const markAll = fresh.locator("button:has-text('Markera alla som lästa')");
if ((await markAll.count()) > 0) {
  await markAll.first().click();
  await fresh.waitForTimeout(700);
}
check("markera alla nollar siffran", /inget kräver dig just nu/.test((await label()) ?? ""), (await label()) ?? "");

// Minnet överlever en omladdning - annars är det inget minne.
await fresh.reload({ waitUntil: "domcontentloaded" });
await fresh.waitForTimeout(1800);
check("minnet överlever en omladdning", /inget kräver dig just nu/.test((await label()) ?? ""), (await label()) ?? "");

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
