/**
 * Notisklick i ARTEFAKTLÄGET (HashRouter, den publicerade enfilsdemon).
 *
 * Defektklassen: i hash-läget räknades "/dashboard/handelser" som samma
 * sida som "/dashboard" (prefixmatchning), navigeringen hoppades över och
 * notisklicket blev osynligt. Preview-bygget (BrowserRouter) döljer felet,
 * så den här sviten kör mot exakt den fil som publiceras.
 *
 * Kräver att artefakten är byggd: scratchpad/clearance-artifact.html.
 * Startar en egen statisk server på 4322.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const { chromium } = pw;

const artifactPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..", "..", "..", "..", "clearance-artifact.html",
);
const html = await readFile(artifactPath).catch(() => null);
if (!html) {
  console.log(`SKIPPAD: ingen byggd artefakt på ${artifactPath} - bygg enfilsdemon först.`);
  process.exit(0);
}
const server = createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
});
await new Promise((resolve) => server.listen(4322, "127.0.0.1", resolve));
const BASE = "http://127.0.0.1:4322/demo.html";

let passed = 0, failed = 0;
const check = (name, ok, extra = "") => {
  if (ok) { passed++; console.log(`PASS ${name}`); }
  else { failed++; console.log(`FAIL ${name} ${extra}`); }
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(30000);

await page.goto(`${BASE}#/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);
await page.click('button:has-text("Demo – Företag")');
await page.waitForTimeout(1800);

// Från en UNDERSIDA till /dashboard: exakt det trasiga fallet.
await page.goto(`${BASE}#/dashboard/handelser`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.click("button[aria-label^='Notiser']");
await page.waitForTimeout(500);
await page.click("button:has-text('Läget kräver')");
await page.waitForTimeout(1500);
const hash = await page.evaluate(() => window.location.hash);
const analysTop = await page.evaluate(
  () => document.getElementById("systemanalys")?.getBoundingClientRect().top ?? 9999,
);
check("lägesnotisen navigerar från undersidan", hash.startsWith("#/dashboard") && !hash.includes("handelser"), hash);
check("och rullar till systemanalysen", analysTop > -60 && analysTop < 300, String(Math.round(analysTop)));

// Fristnotisen från samma undersida.
await page.goto(`${BASE}#/dashboard/handelser`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
await page.click("button[aria-label^='Notiser']");
await page.waitForTimeout(500);
await page.click("button:has-text('Nästa frist'), button:has-text('frist')");
await page.waitForTimeout(1500);
const fristTop = await page.evaluate(
  () => document.getElementById("frister")?.getBoundingClientRect().top ?? 9999,
);
check("fristnotisen navigerar och rullar", fristTop > -60 && fristTop < 350, String(Math.round(fristTop)));

// Sammma sida-fallet ska fortfarande rulla (ingen dubbelnavigering).
await page.click("button[aria-label^='Notiser']");
await page.waitForTimeout(500);
await page.click("button:has-text('Läget kräver')");
await page.waitForTimeout(1000);
const analysTop2 = await page.evaluate(
  () => document.getElementById("systemanalys")?.getBoundingClientRect().top ?? 9999,
);
check("från samma sida rullar klicket", analysTop2 > -60 && analysTop2 < 300, String(Math.round(analysTop2)));

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
