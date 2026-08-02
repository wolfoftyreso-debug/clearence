/**
 * Godkännandeflödet: Utkast -> För granskning -> Godkänt.
 *
 *  1. Företaget laddar upp ett dokument: status Utkast, knappen
 *     "Skicka för granskning" finns.
 *  2. Efter begäran: För granskning - och företagets försök att godkänna
 *     avvisas ärligt (rådgivarstämpeln är aldrig ens egen).
 *  3. Journalen visar granskningsbegäran.
 *  4. Juristen (rådgivarroll) godkänner ett dokument i sitt klientärende:
 *     Godkänt-badge och journalrad.
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
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(30000);

/* 1-3: företagssidan. */
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.click('button:has-text("Demo – Företag")');
await page.waitForTimeout(1800);
await page.goto(`${BASE}/dashboard/dokument`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);

// Ladda upp en fil.
const fileInput = page.locator('input[type="file"]').first();
await fileInput.setInputFiles({
  name: "likviditetsprognos.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4 demo"),
});
await page.waitForTimeout(1500);
let body = await page.innerText("body");
check("uppladdat dokument är Utkast", /likviditetsprognos\.pdf/.test(body) && /Utkast/.test(body));
check("skicka för granskning finns", /Skicka för granskning/.test(body));

await page.click('button:has-text("Skicka för granskning")');
await page.waitForTimeout(1000);
body = await page.innerText("body");
check("statusen blir För granskning", /För granskning/.test(body));

// Företaget kan inte godkänna sitt eget underlag - felet är information.
await page.click('button:has-text("Godkänn (rådgivarroll)")');
await page.waitForTimeout(800);
body = await page.innerText("body");
check("företaget kan inte godkänna själv", /Endast en rådgivarroll/i.test(body));

await page.goto(`${BASE}/dashboard/handelser`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("granskningsbegäran journalförs", /skickades för granskning/i.test(body));

/* 4: rådgivarsidan - juristen godkänner i sitt klientärende. */
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.click('button:has-text("Demo – Jurist")');
await page.waitForTimeout(2000);
await page.goto(`${BASE}/dashboard/dokument`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const advisorInput = page.locator('input[type="file"]').first();
await advisorInput.setInputFiles({
  name: "rekonstruktionsplan.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4 demo"),
});
await page.waitForTimeout(1500);
await page.click('button:has-text("Skicka för granskning")');
await page.waitForTimeout(1000);
await page.click('button:has-text("Godkänn (rådgivarroll)")');
await page.waitForTimeout(1000);
body = await page.innerText("body");
check("rådgivarrollen godkänner", /Godkänt/.test(body) && /Återställ till utkast/.test(body));

await page.goto(`${BASE}/dashboard/handelser`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("godkännandet journalförs", /godkändes/i.test(body));

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
