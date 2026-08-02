/**
 * Driftens Analysövervakning och Loggar.
 *
 *  - Analysövervakningen kör motorernas självtest i webbläsaren och alla
 *    är gröna (fixtur → känt svar, determinism, sifferbevarande,
 *    avidentifiering, PDF-struktur).
 *  - Loggar visar utkorgen och säger gränsen rakt ut: driften ser aldrig
 *    in i ärendenas händelseloggar.
 *  - Båda nås ur driftmenyn, endast för adminrollen.
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

let body = await page.innerText("body");
check("driftmenyn har Analysövervakning och Loggar",
  /Analysövervakning/.test(body) && /Loggar/.test(body));

// 1. Analysövervakningen: alla självtest gröna.
await page.goto(`${BASE}/admin/analys`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("självtesten körs och alla är gröna", /6 av 6 gröna/.test(body), body.match(/\d+ av \d+|\d+ röda/)?.[0] ?? "");
check("motorerna listas",
  /Krisanalysen/.test(body) && /Språkmotorn/.test(body) &&
  /Avidentifieringen/.test(body) && /PDF-skrivaren/.test(body));
check("principerna sägs rakt ut",
  /Inga anrop till externa AI-tjänster/.test(body) && /Ingen ärendedata lämnar miljön/.test(body));
check("determinismen bevisas", /identiskt resultat/.test(body));

// 2. Loggar: utkorgen + gränsen.
await page.goto(`${BASE}/admin/loggar`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("utkorgen visas", /Utkorgen/.test(body));
check("gränsen mot ärendeloggarna sägs rakt ut",
  /Ärendenas händelseloggar är inte driftens/.test(body) && /aldrig in i bolagens akter/.test(body));

// 3. Företagsrollen ser inte driftmenyn.
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.click('button:has-text("Demo – Företag")');
await page.waitForTimeout(1800);
body = await page.innerText("body");
check("företaget ser ingen Analysövervakning i menyn", !/Analysövervakning/.test(body));

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
