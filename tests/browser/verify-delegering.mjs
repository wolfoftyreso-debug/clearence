/**
 * Delegering och godkännande av handlingsplanen.
 *
 *  1. Juristen öppnar en klient → godkännandekortet finns i klientverktygen.
 *  2. Godkänn → grön stämpel "Granskad av rådgivare" i Nästa steg; Återta
 *     tar bort den.
 *  3. En uppgift tilldelas juristen själv → notisklockan visar "tilldelad
 *     dig", och tilldelningen syns i uppgiftsraden.
 *  4. Företagsrollen har inget godkännandekort (och kan inte godkänna).
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

// Juristen in i Demo Bygg AB.
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.click('button:has-text("Demo – Jurist/Revisor")');
await page.waitForTimeout(1800);
await page.click('article:has-text("Demo Bygg AB") button:has-text("Öppna")');
await page.waitForTimeout(1800);

let body = await page.innerText("body");
check("godkännandekortet finns", /Godkännande av handlingsplanen/.test(body));
// Kortets förklaringstext nämner frasen - stämpeln känns igen på datumet efter.
check("planen är ännu inte godkänd", !/Granskad av rådgivare \d/.test(body));

// 2. Godkänn → stämpeln syns i Nästa steg.
await page.click('button:has-text("Godkänn handlingsplanen")');
await page.waitForTimeout(1200);
body = await page.innerText("body");
check("stämpeln syns i Nästa steg", /Granskad av rådgivare \d/.test(body));
check("kortet visar godkänt läge", /Planen godkändes/.test(body));

// Återta → stämpeln försvinner.
await page.click('button:has-text("Återta godkännandet")');
await page.waitForTimeout(1200);
body = await page.innerText("body");
check("återtaget tar bort stämpeln", !/Granskad av rådgivare \d/.test(body));

// 3. Delegera en uppgift till sig själv via handlingsplanens dropdown.
const select = page.locator("select[id^='assign-']").first();
await select.selectOption({ label: "Demo Juristbyrå" });
await page.waitForTimeout(1200);
const value = await select.inputValue();
check("tilldelningen sparas", value !== "", value);

// Notisen i klockan.
await page.click("button[aria-label^='Notiser']");
await page.waitForTimeout(600);
body = await page.innerText("body");
check("notis om tilldelad uppgift", /uppgift är tilldelad dig|uppgifter är tilldelade dig/i.test(body));
await page.keyboard.press("Escape");

// 4. Företagsrollen: inget godkännandekort, men stämpeln skulle synas.
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.click('button:has-text("Demo – Företag")');
await page.waitForTimeout(1800);
body = await page.innerText("body");
check("företaget ser inget godkännandekort", !/Godkännande av handlingsplanen/.test(body));

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
