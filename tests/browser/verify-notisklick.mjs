/** Notisklick ska alltid göra något synligt: navigera och rulla till målet. */
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
await page.click('button:has-text("Gå in i demon")');
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
await page.click("button[aria-label^='Notiser']");
await page.waitForTimeout(500);
await page.click("button:has-text('Nästa frist'), button:has-text('frist')");
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

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
