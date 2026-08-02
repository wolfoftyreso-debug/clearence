/**
 * Startsidan ÄR samtalet: en besökare möts av Clara direkt - inte av en
 * meny, inte av "Vad vill du göra?". Hela onboardingen går att köra utan
 * konto och slutar i nulägesanalysen. En inloggad användare med ärende
 * presenteras inte för Clara igen - hen fortsätter där samtalet slutade.
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

// 1. Anonym besökare: Clara direkt på startsidan.
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(30000);
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
let body = await page.innerText("body");
check("Clara möter besökaren direkt", /Jag heter Clara/i.test(body));
check("första frågan är namnet", /Vad heter du\?/.test(body));
check("gamla portalfrågan är borta", !/Vad vill du göra\?/.test(body));
await page.fill("#onboarding-input", "Erik");
await page.click('button[aria-label="Skicka"]');
await page.waitForTimeout(500);
await page.fill("#onboarding-input", "Eriks Bygg AB");
await page.click('button[aria-label="Skicka"]');
await page.waitForTimeout(500);
body = await page.innerText("body");
check("situationsvalen visas utan konto", /Vilket av följande stämmer bäst\?/.test(body));
await page.click('button:has-text("Jag är orolig för ekonomin")');
await page.waitForTimeout(3400);
check("Clara öppnar nulägesanalysen", page.url().includes("/wizard"));

// 2. Inloggad med ärende: fortsätt samtalet, ingen ny presentation.
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.click('button:has-text("Demo – Företag")');
await page.waitForTimeout(1800);
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
body = await page.innerText("body");
check("inloggad ser Fortsätt samtalet", /Fortsätt samtalet/i.test(body));
check("ingen ny presentation för den som redan har ärende", !/Vad heter du\?/.test(body));
await page.click('a:has-text("Fortsätt samtalet")');
await page.waitForTimeout(1500);
check("knappen leder till samtalsvyn", page.url().includes("/dashboard/samtal"));

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
