/**
 * Publika utvecklarsidan /api: specen ÄR sidan.
 *
 *  1. Sidan renderar kontraktets resurser med metod och ärlig
 *     live/beta-märkning (live-länkens läsning är Live).
 *  2. Datagränsen och bakåtkompatibiliteten står ut.
 *  3. Webhooks och felkoder (inkl. betalväggens payment_required) listas.
 *  4. Kontraktet går att hämta som JSON och är giltig OpenAPI 3.1.
 *  5. Fotlänken leder hit. Ordet AI förekommer inte.
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

await page.goto(`${BASE}/api`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const body = await page.innerText("body");

check("sidan bär rubriken Öppet API", /Öppet API/i.test(body));
check("resurserna listas med metod", /GET/.test(body) && /POST/.test(body) && /\/cases/.test(body));
check("live-länkens läsning är Live", /\/shared\/\{token\}/.test(body));
const sharedRow = await page.locator('li:has-text("/shared/{token}")').first().innerText();
check("delade vyn är märkt Live", /live/i.test(sharedRow), sharedRow);
check("beta-märkning finns (ärlighet)", /beta/i.test(body));
check("datagränsen står ut", /aldrig automatiska\s*bedömningar/i.test(body));
check("bakåtkompatibiliteten lovas", /fält läggs till, aldrig bort/i.test(body));
check("webhooks listas", /decision\.recorded/.test(body) && /document\.review_changed/.test(body));
check("felkoderna listas med betalväggens kod", /payment_required/.test(body));
check("sandbox-miljön visas", /sandbox/i.test(body));
check("ordet AI förekommer inte", !/\bAI\b/.test(body.replace(/API/g, "")));

// 4. JSON-nedladdningen är det riktiga kontraktet.
const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.click('button:has-text("Hämta kontraktet")'),
]);
const path = await download.path();
const { readFileSync } = await import("node:fs");
const downloaded = JSON.parse(readFileSync(path, "utf8"));
check("nedladdningen är giltig OpenAPI 3.1", downloaded.openapi === "3.1.0");
check("nedladdningen bär versionen", downloaded.info.version === "1.0.0-beta");

// 5. Fotlänken från startsidan.
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
await page.click('footer a:has-text("Öppet API för utvecklare")');
await page.waitForTimeout(1000);
check("fotlänken leder till /api", page.url().includes("/api"));

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
