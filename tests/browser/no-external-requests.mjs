/**
 * Asserts that the built application contacts nothing outside its own origin.
 *
 * This is a stated product requirement, not a preference: Clearance is to run
 * entirely in Landvex's own environment. It is also a data-protection
 * question. A visitor here is a company director looking up the word
 * "konkurs"; a request to a third-party host discloses that visit, and the
 * disclosure happens before the page is even drawn.
 *
 * The requirement was already written down in db/README.md and was untrue for
 * months - src/index.css pulled DM Sans from Google's CDN on every page load.
 * A claim in a README is not a control. This is the control.
 *
 * Anything not file:, data: or blob: counts as external, including
 * fonts, analytics, source maps and favicons.
 *
 * Usage: node tests/browser/no-external-requests.mjs [baseUrl]
 */

import pw from "/opt/node22/lib/node_modules/playwright/index.js";

const BASE = process.argv[2] ?? "http://127.0.0.1:4173";
const ROUTES = [
  "/", "/om", "/kontakt", "/wizard", "/kbr", "/likviditetsplan",
  "/marketplace", "/for-radgivare", "/login",
];

try {
  await fetch(BASE, { signal: AbortSignal.timeout(3000) });
} catch {
  console.error(
    `Ingen server svarar på ${BASE}.\n` +
      "Kör: npm run build && npm run preview & ; npm run test:external",
  );
  process.exit(1);
}

/**
 * Värdar som inte är tredje part.
 *
 * Applikationens egen backend räknas inte som ett externt anrop - den ÄR
 * tjänsten. Den står ändå med här, uttryckligen och med namn, av två skäl:
 * listan visar vad bygget faktiskt pratar med, och när backend flyttar från
 * Supabase till eget API i AWS ska den flytten synas som en ändring i den
 * här filen och inte passera obemärkt.
 *
 * Allt annat är ett fel. Lägg inte till en värd här för att få grönt - det
 * är precis så CDN-typsnittet kunde ligga kvar i månader.
 */
const OWN_BACKENDS = [
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_API_URL,
]
  .filter(Boolean)
  .map((u) => new URL(u).origin);

const origin = new URL(BASE).origin;
const allowed = new Set([origin, ...OWN_BACKENDS]);
const { chromium } = pw;
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.setDefaultNavigationTimeout(30_000);

/** url -> the routes that asked for it, so a finding is actionable. */
const offenders = new Map();

page.on("request", (req) => {
  const url = req.url();
  if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("file:")) return;
  if ([...allowed].some((a) => url.startsWith(a))) return;
  if (!offenders.has(url)) offenders.set(url, new Set());
  offenders.get(url).add(page.url().replace(BASE, "") || "/");
});

for (const route of ROUTES) {
  await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  // Typsnitt hämtas lat; utan den här väntan hinner en CDN-förfrågan aldrig
  // ske och testet blir grönt av fel skäl.
  await page.evaluate(() => document.fonts.ready);
}

await browser.close();

if (offenders.size === 0) {
  console.log(`${ROUTES.length}/${ROUTES.length} sidor utan anrop till tredje part`);
  if (OWN_BACKENDS.length) console.log(`egen backend (tillåten): ${OWN_BACKENDS.join(", ")}`);
  process.exit(0);
}

console.log(`${offenders.size} anrop till tredje part:\n`);
for (const [url, routes] of offenders) {
  console.log(`  ${url}\n      från ${[...routes].join(", ")}`);
}
process.exit(1);
