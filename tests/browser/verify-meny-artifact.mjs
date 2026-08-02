/**
 * Menyerna i ARTEFAKTLÄGET (den publicerade enfilsdemon, mobil viewport).
 *
 * Vaktar att varje meny faktiskt gör något synligt i exakt den fil som
 * publiceras - samma princip som notisklickssviten: testbygget kan dölja
 * fel som bara finns i hash-läget eller med demobannerns bottninset.
 *
 *  1. Startsidans bottennav: Meny-panelen öppnas ovanför bannern och
 *     länkarna navigerar; Inställningar visar språkvalet; Logga in leder
 *     till inloggningen.
 *  2. Inloggat läge: hamburgermenyn öppnar sidomenyn, länkarna navigerar
 *     och menyn stängs efter klick.
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
await new Promise((resolve) => server.listen(4326, "127.0.0.1", resolve));
const BASE = "http://127.0.0.1:4326/demo.html";

let passed = 0, failed = 0;
const check = (name, ok, extra = "") => {
  if (ok) { passed++; console.log(`PASS ${name}`); }
  else { failed++; console.log(`FAIL ${name} ${extra}`); }
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(20000);

// 1. Startsidans bottennav.
await page.goto(`${BASE}#/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);

await page.locator('nav button:has-text("Meny")').click();
await page.waitForTimeout(600);
const menuPanel = await page.evaluate(() => {
  const heading = [...document.querySelectorAll("h2")].find((h) => h.textContent?.trim() === "Meny");
  const rect = heading?.closest("div")?.getBoundingClientRect();
  return rect ? { top: rect.top, visible: rect.top > 0 && rect.top < window.innerHeight } : null;
});
check("Meny-panelen öppnas synligt", Boolean(menuPanel?.visible), JSON.stringify(menuPanel));
await page.click('a:has-text("Kunskapsbank")');
await page.waitForTimeout(1100);
check("menylänken navigerar", (await page.evaluate(() => location.hash)).startsWith("#/kunskap"));

await page.goto(`${BASE}#/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);
await page.locator('nav button:has-text("Inställningar")').click();
await page.waitForTimeout(600);
// Rubriken renderas med CSS uppercase - innerText följer det.
let body = await page.innerText("body");
check("Inställningar visar språkvalet", /inställningar · språk/i.test(body));

await page.locator('nav button:has-text("Logga in")').click();
await page.waitForTimeout(1100);
check("Logga in leder till inloggningen", (await page.evaluate(() => location.hash)).startsWith("#/login"));

// 2. Inloggat: hamburgermeny → sidomeny → navigering → stängd meny.
await page.click('button:has-text("Demo – Företag")');
await page.waitForTimeout(1800);
await page.locator("header button").first().click();
await page.waitForTimeout(600);
const dokLink = page.locator('aside a:has-text("Dokument")');
check("sidomenyn öppnas", await dokLink.isVisible());
await dokLink.click();
await page.waitForTimeout(1200);
check("sidomenylänken navigerar", (await page.evaluate(() => location.hash)).startsWith("#/dashboard/dokument"));
const asideHidden = await page.evaluate(() => {
  const aside = document.querySelector("aside");
  return aside ? getComputedStyle(aside).transform.includes("-256") || aside.getBoundingClientRect().right <= 0 : false;
});
check("sidomenyn stängs efter klick", asideHidden);

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
