/**
 * Live ärendelänken: länken ÄR ärendet, alltid aktuell.
 *
 *  1. Företaget (betald demo) skapar en fullständig länk under Deltagare.
 *  2. Mottagaren öppnar länken: bolaget, lägesbilden, bevakade datum,
 *     handlingarna och JSON-knappen - plus dataprincipen i foten.
 *  3. Öppningen loggas och syns i hanteringsvyn.
 *  4. Återkallelsen är omedelbar: länken möts av samma tystnad.
 *  5. Före första betalningen är länkskapandet bakom betalväggen.
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

// 1. Skapa länken.
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.click('button:has-text("Demo – Företag")');
await page.waitForTimeout(1800);
await page.goto(`${BASE}/dashboard/deltagare`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
let body = await page.innerText("body");
check("sektionen finns med dataprincipen", /Live ärendelänk/i.test(body) && /bedömningarna gör\s*mottagaren själv/i.test(body));
await page.selectOption('select[aria-label="Länkens nivå"]', "full");
await page.click('button:has-text("Skapa länk")');
await page.waitForTimeout(1200);
const url = (await page.locator("[data-share-url]").first().innerText()).trim();
check("länken skapades med adress", /#\/lank\/|\/lank\//.test(url), url);
check("giltighet och åppningsräknare visas", /giltig till/i.test(await page.innerText("body")));

// 2. Mottagaren öppnar länken.
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("mottagaren ser bolaget live", /Demobolaget AB/i.test(body) && /Live ärendelänk/i.test(body));
check("nulägesprincipen står ut", /visar ärendets nuläge varje gång sidan öppnas/i.test(body));
check("lägesbilden och bevakade datum", /Läget just nu/i.test(body) && /Bevakade datum/i.test(body));
check("fullständig vy visar handlingarna", /Handlingar \(/i.test(body));
check("maskinläsbart format finns", /Hämta som JSON/i.test(body));
check("data - inte bedömningar", /inga automatiska\s*bedömningar/i.test(body) && /Slutsatser dras av mottagaren/i.test(body));
check("åtkomstloggningen deklareras", /Varje öppning loggas/i.test(body));

// 3. Öppningen loggades.
await page.goto(`${BASE}/dashboard/deltagare`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("öppningen syns i hanteringsvyn", /öppnad 1 gång/i.test(body));

// 4. Återkalla - länken tystnar.
await page.click('button:has-text("Återkalla länken")');
await page.waitForTimeout(1000);
body = await page.innerText("body");
check("återkallelsen visas", /Återkallad/i.test(body));
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
body = await page.innerText("body");
check("en återkallad länk är tyst", /inte längre giltig/i.test(body) && !/Demobolaget/i.test(body));

// 5. Betalväggen: utan första betalningen är delningen låst.
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem("clearance-demo-state"));
  raw.billing.paidAt = null;
  localStorage.setItem("clearance-demo-state", JSON.stringify(raw));
});
await page.goto(`${BASE}/dashboard/deltagare`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
body = await page.innerText("body");
check("länkskapandet är bakom betalväggen", /Live ärendelänk till bank och finansiär/i.test(body) && !/Skapa länk/i.test(body));

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
