/**
 * Driftens undersidor: Företag, Rådgivare och Statistik.
 *
 *  - Menylänkarna finns i driftsektionen och leder rätt.
 *  - Företag: ärendeläget (North Star-tal) + företagskontona.
 *  - Rådgivare: kategorikorten filtrerar, plan och verifiering visas.
 *  - Statistik: North Star, konton/katalog och faktureringsraden.
 *
 * Gränsen vyerna respekterar: driften ser konton och aggregat, aldrig in
 * i bolagens ärenden - sidorna bygger enbart på admin-gateade frågor.
 */
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const { chromium } = pw;
const BASE = "http://127.0.0.1:4310";
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
await page.click('button:has-text("Demo – Systemadministratör")');
await page.waitForTimeout(1800);

// Menylänkarna i driftsektionen.
let body = await page.innerText("body");
check("driftmenyn har undersidorna",
  /Företag/.test(body) && /Rådgivare/.test(body) && /Statistik/.test(body));

// 1. Företag.
await page.goto(`${BASE}/admin/foretag`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("Företag: ärendeläget visas",
  /öppna ärenden/i.test(body) && /i hälsoläget/i.test(body) && /återhämtade/i.test(body));
check("Företag: kontolistan visas", /Företagskonton/.test(body) && /Clearance Drift/.test(body));
check("Företag: länk till fakturering", /Fakturering och åtgärder/.test(body));

// 2. Rådgivare.
await page.goto(`${BASE}/admin/radgivare`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("Rådgivare: kategorikorten visas", /rekonstruktörer/i.test(body) && /revisorer/i.test(body));
check("Rådgivare: byråer med plan visas",
  /Exempel Rekonstruktion AB/.test(body) && /Per ärende/.test(body));
check("Rådgivare: verifieringsläget syns",
  /Verifierad/.test(body) && /Förifylld – ej bekräftad/.test(body));
// Kategorifiltret.
await page.click('button[aria-pressed]:has-text("Revisorer")');
await page.waitForTimeout(500);
body = await page.innerText("body");
check("kategorikortet filtrerar", /Testrevisorerna/.test(body) && !/Exempel Rekonstruktion AB/.test(body));

// 3. Statistik.
await page.goto(`${BASE}/admin/statistik`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("Statistik: North Star visas", /North Star/.test(body) && /återhämtade/i.test(body));
check("Statistik: konton och katalog", /företagskonton/i.test(body) && /byråer i katalogen/i.test(body));
check("Statistik: faktureringsraden", /fakturerat/i.test(body) && /misslyckade utskick/i.test(body));

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
