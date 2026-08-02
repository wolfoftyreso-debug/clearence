/**
 * Exitorsak och hälsoläget: hela kedjan i demoläget.
 *
 *  1. Avslutssektionen finns men tränger sig inte på.
 *  2. Misslyckat utfall erbjuder INTE hälsoläget; lyckat gör det.
 *  3. Stabiliserat + hälsoläge → hälsovyn med bevakning och årshjul.
 *  4. Driftpanelens North Star räknar det återhämtade bolaget.
 *  5. Tillbaka till krisläget → ordinarie översikt igen.
 *  6. Helt avslut → banderoll med datum och orsak → Återuppta → krisläget.
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
await page.click('button:has-text("Demo – Företag")');
await page.waitForTimeout(1500);

// 1. Hopfälld avslutslänk längst ner - inte en skrikande sektion.
let body = await page.innerText("body");
check("krisvyn visas", /Kommande deadlines/i.test(body));
check("avslutslänken finns", /Avsluta ärendet/i.test(body));
check("avslutsformuläret är hopfällt", !/Stabiliserat/.test(body));

await page.click('button:has-text("Avsluta ärendet")');
await page.waitForTimeout(500);
body = await page.innerText("body");
check("formuläret öppnas med alla orsaker",
  /Stabiliserat/.test(body) && /Rekonstruktion genomförd/.test(body) &&
  /Konkurs/.test(body) && /Likviderat/.test(body) && /Annan orsak/.test(body));

// 2. Konkurs erbjuder inte hälsoläget.
await page.click('label:has-text("Konkurs") input[type="radio"]');
await page.waitForTimeout(300);
body = await page.innerText("body");
check("konkurs erbjuder inte hälsoläget", !/Fortsätt i hälsoläget/.test(body));

// Lyckat utfall gör det.
await page.click('label:has-text("Stabiliserat") input[type="radio"]');
await page.waitForTimeout(300);
body = await page.innerText("body");
check("stabiliserat erbjuder hälsoläget", /Fortsätt i hälsoläget/.test(body));

// 3. Avsluta till hälsoläget.
await page.fill('textarea[aria-label="Anteckning om avslutet"]', "Betalningsförmågan återställd.");
await page.click('button:has-text("Avsluta krisfasen och gå till hälsoläget")');
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("hälsovyn visas", /är i hälsoläget/.test(body), body.slice(0, 300));
check("bevakning finns", /Bevakning/.test(body) && /Kreditbevakning/.test(body));
check("årshjulet finns", /Årshjul/.test(body) && /Årsstämma/.test(body));
check("krislarmen är borta", !/Kommande deadlines/.test(body));

// 4. North Star i driftpanelen.
await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const nsTile = await page.locator('div:has(> span:text-is("Återhämtade bolag"))').innerText();
body = await page.innerText("body");
// Kortens etiketter renderas med CSS uppercase - innerText följer det.
check("North Star-sektionen finns", /North Star/.test(body) && /återhämtade bolag/i.test(body),
  body.slice(0, 200));
check("återhämtade bolag räknas", /1/.test(nsTile), nsTile);
const healthTile = await page.locator('div:has(> span:text-is("I hälsoläget"))').innerText();
check("hälsoläget räknas", /1/.test(healthTile), healthTile);

// 5. Tillbaka till krisläget.
await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
await page.click('button:has-text("Tillbaka till krisläget")');
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("krisvyn är tillbaka", /Kommande deadlines/i.test(body));

// 6. Helt avslut (likviderat) → banderoll → återuppta.
await page.click('button:has-text("Avsluta ärendet")');
await page.waitForTimeout(500);
await page.click('label:has-text("Likviderat") input[type="radio"]');
await page.waitForTimeout(300);
await page.click('button:has-text("Avsluta ärendet"):not(:has-text("…"))');
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("avslutsbanderollen visas", /Ärendet avslutades/.test(body) && /Likviderat/.test(body), body.slice(0, 300));
check("akten består i avslutad vy", /dokument/i.test(body));

await page.click('button:has-text("Återuppta ärendet")');
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("återupptaget ärende visar krisvyn", /Kommande deadlines/i.test(body));

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
