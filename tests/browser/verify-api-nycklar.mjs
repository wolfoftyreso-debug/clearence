/**
 * API-nycklarna: valvets regler i användarens händer.
 *
 *  1. Betalande kund skapar en nyckel under Inställningar - hemligheten
 *     visas EN gång (clr_-format) med kopieringsknapp.
 *  2. Efter "Jag har sparat den" syns bara prefixet i listan.
 *  3. Återkallelsen är omedelbar och slutgiltig (badge i listan).
 *  4. Före första betalningen är sektionen bakom betalväggen.
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
const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
const page = await context.newPage();
page.setDefaultTimeout(30000);

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.click('button:has-text("Demo – Företag")');
await page.waitForTimeout(1800);
await page.goto(`${BASE}/dashboard/installningar`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
let body = await page.innerText("body");
check("sektionen finns med engångslöftet", /API-nycklar/i.test(body) && /visas en enda gång/i.test(body));
check("utvecklarsidan länkas", (await page.locator('a[href*="/api"]:has-text("utvecklarsidan")').count()) > 0);

// 1. Skapa nyckeln.
await page.fill("#api-key-label", "Byråsystemet");
await page.click('button:has-text("Skapa nyckel")');
await page.waitForTimeout(1000);
const secret = (await page.locator("[data-fresh-secret]").innerText()).trim();
check("hemligheten visas en gång i clr-format", /^clr_[0-9a-f]{48}$/.test(secret), secret);
body = await page.innerText("body");
check("varningen om att den aldrig visas igen", /visas den aldrig igen/i.test(body));

// 2. Stäng - bara prefixet kvar.
await page.click('button:has-text("Jag har sparat den")');
await page.waitForTimeout(600);
body = await page.innerText("body");
check("hemligheten är borta ur vyn", !body.includes(secret));
check("prefixet listas med etiketten", body.includes(`${secret.slice(0, 12)}…`) && /Byråsystemet/.test(body));

// 3. Återkalla.
await page.click('button:has-text("Återkalla")');
await page.waitForTimeout(800);
body = await page.innerText("body");
check("nyckeln är återkallad", /Återkallad/.test(body));

// 4. Betalväggen.
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem("clearance-demo-state"));
  raw.billing.paidAt = null;
  localStorage.setItem("clearance-demo-state", JSON.stringify(raw));
});
await page.goto(`${BASE}/dashboard/installningar`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
body = await page.innerText("body");
check("nycklarna är bakom betalväggen", /API-nycklar för det öppna API:t/i.test(body) && (await page.locator("#api-key-label").count()) === 0);

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
