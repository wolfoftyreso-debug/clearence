/**
 * Guidens företagsslagning får inte loopa.
 *
 * Slagningen mot företagsuppgifterna ligger i en effekt som beror på
 * organisationsnumret. Om någon av funktionerna i kedjan
 * (setValue -> setFormData -> updateField) får ny identitet vid varje
 * rendering kör effekten om varje gång den sätter status - och då slår
 * guiden mot registret i en oändlig loop utan att någon ser det.
 *
 * Testet mäter det enda som betyder något: att sidan LUGNAR SIG. Ett
 * fast antal renderingar efter att numret är ifyllt, och en slagning -
 * inte femtio.
 */
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const { chromium } = pw;
const BASE = process.argv[2] ?? "http://127.0.0.1:4310";
let passed = 0, failed = 0;
const check = (name, ok, extra = "") => {
  if (ok) { passed++; console.log(`PASS ${name}`); }
  else { failed++; console.log(`FAIL ${name} ${extra}`); }
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(30000);

await page.goto(`${BASE}/wizard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);

// Räknar DOM-mutationer som ombud för renderingar: en loop syns som en
// ström som aldrig tar slut.
await page.evaluate(() => {
  window.__mutations = 0;
  new MutationObserver((records) => {
    window.__mutations += records.length;
  }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
});

const orgInput = page.locator('input[placeholder="XXXXXX-XXXX"]').first();
check("guiden frågar efter organisationsnummer", (await orgInput.count()) > 0);
await orgInput.fill("556000-0001");

// Låt slagningen bli klar och allt sätta sig.
await page.waitForTimeout(2500);
const settled = await page.evaluate(() => {
  const before = window.__mutations;
  return new Promise((resolve) =>
    setTimeout(() => resolve({ before, after: window.__mutations }), 2500),
  );
});

const drift = settled.after - settled.before;
check("sidan lugnar sig efter slagningen", drift < 50, `${drift} mutationer under 2,5 s i vila`);

const body = await page.innerText("body");
check("slagningen fastnar inte i laddläge", !/Hämtar företagsuppgifter…?\s*$/.test(body.trim()));
check("guiden är fortfarande användbar", body.length > 200);

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
