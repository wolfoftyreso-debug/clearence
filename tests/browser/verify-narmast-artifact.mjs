/**
 * NÄRMAST-raden i ARTEFAKTLÄGET (HashRouter, den publicerade demon).
 *
 * Defekten: raden var ett rått fragmentankare (href="#frister"). I
 * hash-läget ÄR hashen rutten, så webbläsaren bytte adress till
 * "#frister", routern läste det som sidan "/frister" och visade 404 -
 * i stället för att rulla ned till fristerna. Preview-bygget
 * (BrowserRouter) döljer felet helt, eftersom ankaret där bara är ett
 * ankare. Därför körs den här sviten mot exakt den fil som publiceras.
 *
 * Samma defektklass träffade "Så fungerar tjänsten" en gång tidigare.
 * Det är andra gången, och det är därför kontrollen finns.
 *
 * Kräver att artefakten är byggd: scratchpad/clearance-artifact.html.
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
await new Promise((resolve) => server.listen(4323, "127.0.0.1", resolve));
const BASE = "http://127.0.0.1:4323/demo.html";

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
await page.waitForTimeout(2000);
await page.goto(`${BASE}#/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);

let body = await page.innerText("body");
check("NÄRMAST-raden visas på översikten", /NÄRMAST/i.test(body), body.slice(0, 200));
check("raden bär nedräkningen", /om \d+ dagar|idag|imorgon/i.test(body));

const before = await page.evaluate(() => window.location.hash);
await page.click("text=Visa i planen");
await page.waitForTimeout(1200);

body = await page.innerText("body");
const after = await page.evaluate(() => window.location.hash);

// Kärnan: klicket får ALDRIG landa i 404.
check("klicket ger ingen 404", !/Page not found|404/i.test(body), body.slice(0, 200));
check("översikten är kvar", /Systemanalys/i.test(body) || /Läget/i.test(body));
check("rutten är oförändrad", after === before || after.includes("/dashboard"), [before, after]);
check("adressen blev inte en påhittad sida", !/#\/?frister|#\/?nasta-steg/.test(after), after);

// Och att klicket faktiskt GJORDE något: fristerna syns i vyn efteråt.
const fristerTop = await page.evaluate(() => {
  const el = document.getElementById("frister") ?? document.getElementById("nasta-steg");
  return el ? el.getBoundingClientRect().top : null;
});
check("målsektionen finns i sidan", fristerTop !== null);
check(
  "sidan rullade dit i stället för att navigera",
  fristerTop !== null && fristerTop < 400,
  fristerTop,
);

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
