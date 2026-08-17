/**
 * Menyerna i ARTEFAKTLÄGET (den publicerade enfilsdemon, mobil viewport).
 *
 * Vaktar att varje meny faktiskt gör något synligt i exakt den fil som
 * publiceras - samma princip som notisklickssviten: testbygget kan dölja
 * fel som bara finns i hash-läget eller med demobannerns bottninset.
 *
 *  1. Startsidan: bottennavigeringen är BORTA (på uttrycklig begäran) -
 *     headerns hamburgermeny bär navigeringen: den öppnas, länkarna
 *     navigerar och Logga in leder till inloggningen.
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
/*
 * ARTEFAKTEN ÄR KROPPSINNEHÅLL, INTE ETT DOKUMENT.
 *
 * Publiceringen bäddar in filen i ett eget dokumentskal, så bygget lämnar
 * doctype, <html>, <head> och <body> därhän (se scripts/bygg-artefakt.mjs).
 * Den här servern skickade innehållet rått: webbläsaren fick en fil utan
 * skal, ingenting renderades, och provet stod och väntade i trettio
 * sekunder på en knapp som aldrig kunde dyka upp. Skalet sätts därför på
 * här, precis som publiceringen gör.
 */
const SKAL = (kropp) =>
  `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${kropp}</body></html>`;

const server = createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(SKAL(html));
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

// 1. Startsidan: bottennaven är borta, headermenyn bär navigeringen.
await page.goto(`${BASE}#/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);

const bottomNavCount = await page.locator('nav button:has-text("Tjänster")').count();
check("bottennavigeringen är borta", bottomNavCount === 0, String(bottomNavCount));

await page.locator('header button[aria-label="Toggle menu"]').click();
await page.waitForTimeout(600);
// .last(): desktopnavens dolda tvilling matchar också - mobilmenyn
// renderas sist.
const omLink = page.locator('header nav a:has-text("Om oss")').last();
check("headermenyn öppnas", await omLink.isVisible());
await omLink.click();
await page.waitForTimeout(1100);
check("menylänken navigerar", (await page.evaluate(() => location.hash)).startsWith("#/om"));

await page.goto(`${BASE}#/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);
await page.locator('header button[aria-label="Toggle menu"]').click();
await page.waitForTimeout(600);
await page.locator('header nav a:has-text("Logga in")').last().click();
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
