/**
 * Enkelhetspass: gå igenom nyckelresorna med färska ögon.
 * Samlar konsolfel, trasiga bilder och sidor utan huvudinnehåll -
 * det som sviterna inte fångar därför att de letar efter närvaro,
 * inte frånvaro av skräp.
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
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 160)}`));

const routesAnon = ["/", "/om", "/marketplace", "/kunskap", "/login", "/lank/okand", "/api", "/for-radgivare", "/kontakt"];
for (const r of routesAnon) {
  await page.goto(`${BASE}${r}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  const text = (await page.innerText("body")).trim();
  check(`anon ${r} har innehåll`, text.length > 80, `len=${text.length}`);
}

// Logga in som företaget och gå igenom hela menyn.
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.click('button:has-text("Demo – Företag")');
await page.waitForTimeout(1800);
const routesAuth = [
  "/dashboard/samtal", "/dashboard", "/dashboard/alternativ", "/wizard",
  "/dashboard/liquidity", "/dashboard/dokument", "/dashboard/deltagare",
  "/dashboard/meddelanden", "/dashboard/kreditunderlag", "/dashboard/handelser",
  "/dashboard/installningar", "/kbr",
];
for (const r of routesAuth) {
  await page.goto(`${BASE}${r}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1100);
  const text = (await page.innerText("body")).trim();
  check(`företag ${r} har innehåll`, text.length > 80, `len=${text.length}`);
  const broken = await page.evaluate(() =>
    Array.from(document.images).filter((i) => i.complete && i.naturalWidth === 0 && i.src.startsWith("http")).length
  );
  check(`företag ${r} utan trasiga bilder`, broken === 0, `broken=${broken}`);
}

// Samtalet: ett helt flöde utan friktion.
await page.goto(`${BASE}/dashboard/samtal`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.fill("#samtal-input", "Skatteverket kräver 150000 kr");
await page.keyboard.press("Enter");
await page.waitForTimeout(1200);
let body = await page.innerText("body");
check("samtalet svarar direkt på skattefrågan", /skatteskuld|Skatteverket/i.test(body));

// Jurist och admin: landningsvyerna.
for (const [btn, route, expect] of [
  ["Demo – Jurist/Revisor", "/arenden", /portfölj|klient|ärende/i],
  ["Demo – Systemadministratör", "/admin", /drift|nyckel|Företag/i],
]) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await page.click(`button:has-text("${btn}")`);
  await page.waitForTimeout(1800);
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  body = await page.innerText("body");
  check(`${btn} landar rätt`, expect.test(body));
}

const realErrors = consoleErrors.filter(
  (e) => !/favicon|manifest|X-Frame|net::ERR_|Failed to load resource/i.test(e)
);
check("inga konsolfel under hela vandringen", realErrors.length === 0, JSON.stringify(realErrors.slice(0, 5)));

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
