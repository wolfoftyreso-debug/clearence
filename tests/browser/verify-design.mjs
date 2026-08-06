/**
 * Designvakten: innehåll får aldrig ligga dolt under fasta element.
 *
 * Felklassen som fångades på kunskapssidan: sidhuvudet är fast, och en
 * sida utan toppmarginal renderar sin rubrik BAKOM det - läsaren ser en
 * halv rubrik och sidan ser trasig ut. Osynligt på desktop med musen på
 * rätt ställe, uppenbart på en telefon. Så det asserteras i stället för
 * att synas: på varje rutt får sidans första rubrik (h1) inte skära det
 * fasta sidhuvudets ruta, och sidans sista innehåll ska gå att nå ovanför
 * demobannern (kroppens bottenmarginal minst bannerns höjd).
 *
 * Usage: node tests/browser/verify-design.mjs [baseUrl]
 */

import pw from "/opt/node22/lib/node_modules/playwright/index.js";

const BASE = process.argv[2] ?? "http://127.0.0.1:4173";
const ROUTES = [
  "/", "/wizard", "/kbr", "/likviditetsplan", "/marketplace",
  "/for-radgivare", "/login", "/dashboard", "/dashboard/liquidity",
  "/mina-forfragningar", "/om", "/kontakt", "/integritetspolicy", "/villkor", "/admin", "/admin/inkorg", "/admin/kunder", "/admin/ansokningar", "/admin/foretag", "/admin/radgivare", "/admin/statistik", "/admin/analys", "/admin/loggar",
  "/dashboard/dokument", "/dashboard/meddelanden", "/dashboard/installningar", "/dashboard/kreditunderlag",
  "/dashboard/deltagare", "/dashboard/handelser", "/dashboard/samtal", "/dashboard/alternativ", "/lank/ogiltig-lank", "/arenden", "/api", "/kunskap", "/kunskap/kontrollbalansrakning", "/byraprofil",
];

try {
  await fetch(BASE, { signal: AbortSignal.timeout(3000) });
} catch {
  console.error(`Ingen server svarar på ${BASE}. Bygg och kör preview först.`);
  process.exit(1);
}

const { chromium } = pw;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.setDefaultTimeout(30000);

// Demoinloggning så att skyddade rutter går att granska.
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
const demoButton = page.locator('button:has-text("Demo – Företag")');
if ((await demoButton.count()) > 0) {
  await demoButton.click();
  await page.waitForTimeout(1200);
}

let failures = 0;
let checks = 0;

for (const route of ROUTES) {
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);

  const result = await page.evaluate(() => {
    const fixedBars = [...document.querySelectorAll("header, nav, div")]
      .filter((el) => {
        const style = getComputedStyle(el);
        return style.position === "fixed" && el.getBoundingClientRect().top <= 1 && el.getBoundingClientRect().height > 20;
      })
      .map((el) => el.getBoundingClientRect());
    const heading = document.querySelector("main h1, h1");
    if (!heading) return { ok: true, note: "ingen h1" };
    const h = heading.getBoundingClientRect();
    if (h.height === 0) return { ok: true, note: "h1 utan höjd" };
    for (const bar of fixedBars) {
      const overlap = h.top < bar.bottom - 1 && h.bottom > bar.top + 1;
      if (overlap) {
        return { ok: false, note: `h1 "${heading.textContent?.slice(0, 30)}" skär det fasta sidhuvudet (h1.top ${Math.round(h.top)} < bar.bottom ${Math.round(bar.bottom)})` };
      }
    }
    return { ok: true, note: "" };
  });

  checks += 1;
  if (!result.ok) {
    failures += 1;
    console.log(`FAIL ${route}: ${result.note}`);
  }
}

await browser.close();
if (failures === 0) console.log(`${checks}/${checks} sidor utan innehåll dolt under fasta element`);
process.exit(failures > 0 ? 1 : 0);
