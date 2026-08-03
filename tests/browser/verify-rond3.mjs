/**
 * Excellence rond 3 (kraven 8-9): första sekunden efter inloggning.
 *
 *  1. Överst på översikten står EN rad med det viktigaste nästa steget
 *     (NÄRMAST + frist + nedräkning) - före banner, samtalsingång och plan.
 *  2. Raden länkar in i planen (ankaret finns på sidan).
 *  3. "Ny utvärdering" är degraderad (ghost, inte accent) när ett ärende
 *     pågår - "fortsätt där du är" ska inte ha en konkurrent.
 * (Kraven 6-7 - spacing-skalan och kortkompositionen - vaktas statiskt
 *  av tests/spacing.ts.)
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

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.click('button:has-text("Demo – Företag")');
await page.waitForTimeout(1800);
await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);

// 1. Närmast-raden finns och står överst i innehållet.
const strip = page.locator('a[href="#frister"], a[href="#nasta-steg"]').first();
check("närmast-raden finns", (await strip.count()) > 0);
const stripText = await strip.innerText();
check("raden bär NÄRMAST-etiketten", /närmast/i.test(stripText), stripText);
check("raden visar nedräkning eller uppgift", stripText.trim().length > 15, stripText);
const stripBox = await strip.boundingBox();
const planBox = await page.locator("#nasta-steg").boundingBox();
check("raden står före planen", !!stripBox && !!planBox && stripBox.y < planBox.y);

// 2. Ankaret leder in i planen.
await strip.click();
await page.waitForTimeout(600);
check("ankarmålet finns på sidan", (await page.locator("#frister, #nasta-steg").count()) > 0);

// 3. "Ny utvärdering" är degraderad vid pågående ärende.
const newEval = page.locator('a:has-text("Ny utvärdering")').first();
const cls = (await newEval.getAttribute("class")) ?? "";
check("Ny utvärdering är inte en accentknapp", !/bg-accent|variant-accent/.test(cls), cls);
check("Ny utvärdering är nedtonad", /muted/.test(cls), cls);

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
