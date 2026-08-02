/**
 * Skuggdebiteringen (pilotens spår A) i gränssnittet.
 *
 *  - Byrån ser sina skuggrader under "Skuggdebitering – faktureras inte"
 *    med belopp och "Hade kostat"-summa, tydligt skilda från det som
 *    faktiskt faktureras.
 *  - Driften har skuggväxeln per byrå i prisplanraden, och juristens byrå
 *    står i skuggläge i demon.
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

// 1. Juristen: skuggkortet i debiteringsöversikten.
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.click('button:has-text("Demo – Jurist/Revisor")');
await page.waitForTimeout(1800);
await page.goto(`${BASE}/mina-forfragningar`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
let body = (await page.innerText("body")).replace(/ /g, " ");
check("skuggkortet visas", /Skuggdebitering – faktureras inte/.test(body));
check("pilotförklaringen står där", /ingenting faktureras och ingenting efterfaktureras/.test(body));
check("beloppet visas som 'hade kostat'", /Hade kostat/.test(body) && /995 kr/.test(body));
check("skuggrader blandas inte med att fakturera", !/Kommande samlingsfaktura/.test(body));

// 2. Driften: skuggväxeln per byrå.
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.click('button:has-text("Demo – Systemadministratör")');
await page.waitForTimeout(1800);
await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("skuggväxeln finns i prisplanraden", /Skuggdebitering \(pilotens spår A\)/.test(body));

const shadowBox = page
  .locator('li:has-text("Demo Obeståndsjuridik") input[type="checkbox"]')
  .last();
check("juristens byrå står i skuggläge", await shadowBox.isChecked());

// Växeln går att slå av och på.
const otherBox = page
  .locator('li:has-text("Exempel Rekonstruktion") input[type="checkbox"]')
  .last();
check("övriga byråer är inte i skuggläge", !(await otherBox.isChecked()));
// Kontrollerad checkbox: läget ändras när mutationen gått igenom och
// planerna frågats om - klicka och vänta, i stället för check().
await otherBox.click({ force: true });
await page.waitForTimeout(1200);
check("skuggläget kan slås på", await otherBox.isChecked());

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
