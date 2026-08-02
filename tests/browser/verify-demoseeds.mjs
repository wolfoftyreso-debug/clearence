/**
 * Demoföretaget kommer FÄRDIGT: kontrollbalansbedömningen är gjord och
 * likviditetsplanen ifylld. Den som klickar in ska se svaren, inte tomma
 * formulär.
 *
 *  1. /kbr öppnar på resultatsteget med Demobolagets siffror och kritiskt
 *     läge + åtgärdslistan (ABL 25 kap.).
 *  2. /likviditetsplan öppnar på resultatsteget med prognosen.
 *  3. KBR-läget syns som notis (bedömningen finns i state).
 *  4. Rollbyte ärver inte utkasten: juristen får tomma guider.
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

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.click('button:has-text("Demo – Företag")');
await page.waitForTimeout(1800);

// 1. KBR: resultatsteget direkt.
await page.goto(`${BASE}/kbr`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
let body = await page.innerText("body");
check("KBR öppnar på resultatet", /Steg 4 av 4|kontrollbalansräkning/i.test(body), body.slice(0, 200));
check("KBR: kritiskt läge ur Demobolagets siffror", /kritisk/i.test(body));
check("KBR: åtgärdslistan med lagrummen", /25:13|ABL/i.test(body));

// 2. Likviditetsplanen: resultatsteget direkt, prognosen räknad.
await page.goto(`${BASE}/likviditetsplan`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("likviditetsplanen öppnar på resultatet", /Din likviditetsplan/i.test(body), body.slice(0, 200));
const norm = body.replace(/ /g, " ");
check("prognosen räknar på de ifyllda posterna",
  /Pengarna tar slut om/.test(norm) && /930 000/.test(norm), norm.slice(0, 300));

// 3. KBR-bedömningen finns i systemet: notisen i klockan.
await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.click("button[aria-label^='Notiser']");
await page.waitForTimeout(600);
body = await page.innerText("body");
check("KBR-notisen finns", /Kontrollbalans/i.test(body));

// 4. Rollbytet ärver inte utkasten.
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.click('button:has-text("Demo – Jurist/Revisor")');
await page.waitForTimeout(1800);
const drafts = await page.evaluate(() => ({
  kbr: localStorage.getItem("clearance-kbr-draft"),
  liq: localStorage.getItem("clearance-liquidity-draft"),
}));
check("juristen ärver inga guideutkast", drafts.kbr === null && drafts.liq === null);

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
