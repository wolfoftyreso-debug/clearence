/**
 * Asserts that no page scrolls sideways on a phone.
 *
 * Horizontal overflow is the defect that made the dashboard unreadable on a
 * 320 px screen: the layout grew past the viewport, and the user saw content
 * with its left edge cut off. It is invisible on a desktop browser and easy
 * to reintroduce with one non-wrapping flex row, so it is asserted rather
 * than eyeballed.
 *
 * `overflow-x: hidden` on the body would silence this test while leaving the
 * content unreachable. Fix the element, not the symptom.
 *
 * Usage: node tests/browser/mobile.mjs [baseUrl]
 */

import pw from "/opt/node22/lib/node_modules/playwright/index.js";

const BASE = process.argv[2] ?? "http://127.0.0.1:4173";
const WIDTHS = [320, 375, 414];
const ROUTES = [
  "/", "/wizard", "/kbr", "/likviditetsplan", "/marketplace",
  "/for-radgivare", "/login", "/dashboard", "/dashboard/liquidity",
  "/mina-forfragningar", "/om", "/kontakt", "/admin/inkorg", "/admin/kunder", "/admin/ansokningar",
  "/dashboard/dokument", "/dashboard/meddelanden", "/dashboard/installningar", "/dashboard/kreditunderlag",
];

/** A couple of pixels of rounding is not a layout defect. */
const TOLERANCE = 2;

// Utan server svarar page.goto aldrig, och sviten hänger tills något utifrån
// dödar den - fem minuters väntan i stället för en rad som säger vad som
// saknas. Fråga först, med kort tidsgräns.
try {
  await fetch(BASE, { signal: AbortSignal.timeout(3000) });
} catch {
  console.error(
    `Ingen server svarar på ${BASE}.\n\n` +
      "Sviten testar en byggd sida, inte utvecklingsservern. Kör:\n" +
      "  npm run build && npm run preview &\n" +
      "  npm run test:mobile\n\n" +
      "Vill du testa mot något annat: node tests/browser/mobile.mjs <baseUrl>",
  );
  process.exit(1);
}

const { chromium } = pw;
const browser = await chromium.launch();
let failures = 0;
let checks = 0;

for (const width of WIDTHS) {
  const ctx = await browser.newContext({
    viewport: { width, height: 800 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();

  // Demo builds expose a one-click sign-in; without it the protected routes
  // just redirect and the test would silently check nothing.
  // Enkelsidesbygget är 1,3 MB och tar flera sekunder att tolka på en belastad
  // maskin. Gränsen ska fånga en trasig rutt, inte en långsam burk.
  page.setDefaultTimeout(30_000);
  page.setDefaultNavigationTimeout(30_000);
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.click('button:has-text("Gå in i demon")').catch(() => {});
  await page.waitForTimeout(900);

  for (const route of ROUTES) {
    // domcontentloaded + fast väntan i stället för networkidle: networkidle
    // återvänder aldrig på en sida som håller en anslutning öppen, och sviten
    // hängde då i det oändliga i stället för att svara.
    await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);
    checks += 1;

    // En 404-sida spiller aldrig. Utan den här kontrollen godkänns en rutt
    // som inte finns - och en gammal dist i preview-servern ger då grönt för
    // sidor som inte ens är byggda. Det hände.
    const notFound = await page.evaluate(() =>
      document.body.innerText.includes("Sidan finns inte") ||
      document.body.innerText.includes("404"),
    );
    if (notFound) {
      failures += 1;
      console.log(`FAIL ${width}px ${route} — rutten renderar 404, inget testat`);
      continue;
    }

    const result = await page.evaluate((tolerance) => {
      const de = document.documentElement;
      const overflow = de.scrollWidth - de.clientWidth;
      if (overflow <= tolerance) return { overflow, culprits: [] };

      // Report the deepest offenders: a parent is wide because a child is.
      const over = [...document.querySelectorAll("body *")].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.right > de.clientWidth + tolerance;
      });
      const leaves = over.filter(
        (el) =>
          ![...el.children].some((c) => {
            const r = c.getBoundingClientRect();
            return r.width > 0 && r.right > de.clientWidth + tolerance;
          }),
      );
      return {
        overflow,
        culprits: leaves.slice(0, 3).map((el) => ({
          tag: el.tagName.toLowerCase(),
          cls: String(el.className).slice(0, 80),
          text: (el.textContent || "").trim().slice(0, 40),
        })),
      };
    }, TOLERANCE);

    if (result.overflow > TOLERANCE) {
      failures += 1;
      console.log(`FAIL ${width}px ${route} — spiller ${result.overflow}px`);
      for (const c of result.culprits) {
        console.log(`       <${c.tag} class="${c.cls}"> "${c.text}"`);
      }
    }
  }
  await ctx.close();
}

await browser.close();
console.log(`\n${checks - failures}/${checks} sidor utan horisontell spill`);
process.exit(failures ? 1 : 0);
