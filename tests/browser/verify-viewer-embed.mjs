/**
 * Verifierar rapportvisarens två lägen och att dubbelbudskapet är borta:
 * i visaren finns EN utskriftsknapp och ingen banner inne i dokumentet;
 * inbäddat visas PDF:en i lagret i stället för en tyst nedladdning.
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
await page.waitForTimeout(1500);
await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);

// 1. Öppna visaren: en utskriftsknapp, ingen dokumentbanner.
await page.click('button:has-text("Skapa rapport")');
await page.waitForTimeout(1000);
const toolbar = await page.locator('[role="dialog"]').innerText();
check("verktygsraden: EN utskriftsknapp (Skriv ut, inte Skriv ut / PDF)", /Skriv ut(?!\s*\/)/.test(toolbar) && !/Skriv ut \/ PDF/.test(toolbar), toolbar);
check("verktygsraden: Ladda ner PDF finns", /Ladda ner PDF/.test(toolbar));
const frame = page.frameLocator('[role="dialog"] iframe');
const bannerVisible = await frame.locator(".print-bar").isVisible().catch(() => false);
check("dokumentbannern är dold i visaren (inget dubbelbudskap)", !bannerVisible);

// 2. I toppfönster: Ladda ner PDF laddar ner (ingen vy-växling).
const [dl] = await Promise.all([
  page.waitForEvent("download"),
  page.click('[role="dialog"] button:has-text("Ladda ner PDF")'),
]);
check("toppfönster: nedladdningen startar", (dl.suggestedFilename() ?? "").endsWith(".pdf"), dl.suggestedFilename());
await page.click('button:has-text("Stäng")');
await page.waitForTimeout(400);

// 3. Inbäddat läge (window.self !== window.top simuleras via en iframe-sida):
//    PDF-knappen ska VISA PDF:en i lagret med förklaringen.
await page.setContent(`<iframe src="${BASE}/login" style="width:1200px;height:800px"></iframe>`);
const inner = page.frameLocator("iframe");
await inner.locator('button:has-text("Demo – Företag")').click();
await page.waitForTimeout(1500);
await page.evaluate((base) => {
  const f = document.querySelector("iframe");
  f.src = `${base}/dashboard`;
}, BASE);
await page.waitForTimeout(1800);
await inner.locator('button:has-text("Ladda ner PDF")').first().click();
await page.waitForTimeout(1200);
const dialogText = await inner.locator('[role="dialog"]').innerText().catch(() => "");
check("inbäddat: PDF-läget öppnas med förklaring", /PDF:en är skapad och visas nedan/i.test(dialogText), dialogText.slice(0, 150));
const pdfFrame = await inner.locator('[role="dialog"] iframe').getAttribute("src").catch(() => null);
check("inbäddat: visaren pekar på PDF-blobben", (pdfFrame ?? "").startsWith("blob:"), String(pdfFrame));
// iOS-fallet: PDF-lagret utan spara-väg är en död knapp. "Spara filen"
// öppnar delningsmenyn (Web Share med fil) eller faller till nedladdning.
check("inbäddat: Spara filen-knappen finns i PDF-läget",
  (await inner.locator('[role="dialog"] button:has-text("Spara filen")').count()) > 0);
check("inbäddat: förklaringen pekar på Spara filen",
  /Spara filen/.test(dialogText) && /delningsmenyn/i.test(dialogText), dialogText.slice(0, 200));

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
