/**
 * De tre demorollerna: varje konto ska landa i sin egen värld.
 *
 *  Företag  → krisöversikten med Demobolaget.
 *  Jurist   → klientlistan med fyra bolag, klientfält, risk och status.
 *  Admin    → driftpanelen med plattformsrad och North Star ≥ 1
 *             (det seedade återhämtade bolaget).
 *
 *  Dessutom: rollbyte sår om tillståndet - juristens klienter får inte
 *  läcka in i företagsvyn.
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

const login = async (label) => {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await page.click(`button:has-text("${label}")`);
  await page.waitForTimeout(1800);
};

// Panelen på inloggningssidan.
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
let body = await page.innerText("body");
check("Testa Clearance-panelen finns", /Testa Clearance/.test(body));
check("alla tre kontona listas",
  /foretag@clearance\.demo/.test(body) &&
  /jurist@clearance\.demo/.test(body) &&
  /admin@clearance\.demo/.test(body));
check("lösenordet visas", /demo123/.test(body));

// 1. Företag → krisöversikten.
await page.click('button:has-text("Demo – Företag")');
await page.waitForTimeout(1800);
body = await page.innerText("body");
check("företag landar på översikten", page.url().includes("/dashboard"), page.url());
check("företagets ärende visas", /Nästa steg/i.test(body));

// 2. Jurist → klientlistan.
await login("Demo – Jurist/Revisor");
body = await page.innerText("body");
check("jurist landar i ärendeöversikten", page.url().includes("/arenden"), page.url());
check("klientfältet visas",
  /aktiva/i.test(body) && /kritiska/i.test(body) && /åtgärder/i.test(body));
check("fyra klienter listas",
  /Demo Bygg AB/.test(body) && /Taxi Syd Demo AB/.test(body) &&
  /Restaurang Milano Demo AB/.test(body) && /Elservice Demo Sverige AB/.test(body));
check("statusar visas",
  /Rekonstruktion/.test(body) && /Konkursansökan/.test(body) && /Kontrollbalans/.test(body));
check("risknivåer visas", /Risk: Kritisk/.test(body) && /Risk:/.test(body));
check("nästa aktivitet visas", /Nästa aktivitet:/.test(body));

// Klientfältets kort är knappar: Åtgärder fäller ut alla öppna uppgifter,
// och en rad leder in i rätt ärende.
await page.click('button[aria-expanded]:has-text("Åtgärder")');
await page.waitForTimeout(600);
body = await page.innerText("body");
check("åtgärdskortet fäller ut uppgiftslistan",
  /Ring företrädaren om konkursansökan/.test(body) && /Skicka yttrande till Skatteverket/.test(body));
await page.click('button:has-text("Förbered borgenärsmöte")');
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("uppgiftsraden öppnar rätt ärende",
  page.url().includes("/dashboard") && /Demo Bygg AB/.test(body), page.url());
await page.goto(`${BASE}/arenden`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);

// Kritiska-kortet visar bara bolagen i kritiskt läge.
await page.click('button[aria-expanded]:has-text("Kritiska")');
await page.waitForTimeout(600);
const panel = await page.locator("div.border-accent\\/40").innerText();
check("kritiska-kortet fördjupar med rätt bolag",
  /Restaurang Milano Demo AB/.test(panel), panel.slice(0, 200));
check("fördjupningen visar risk och nästa frist", /Risk:/.test(panel) && /Nästa frist/.test(panel));

// Klick in i en klient ger företagsvyn för det bolaget.
await page.click('article:has-text("Demo Bygg AB") button:has-text("Öppna")');
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("öppna klient visar bolagets översikt",
  page.url().includes("/dashboard") && /Demo Bygg AB|Företagsrekonstruktion pågår/.test(body));

// 3. Admin → driftpanelen.
await login("Demo – Systemadministratör");
body = await page.innerText("body");
check("admin landar i driftpanelen", page.url().includes("/admin"), page.url());
check("plattformsraden finns", /Plattformen just nu/.test(body) && /företagskonton/i.test(body));
const nsTile = await page.locator('div:has(> span:text-is("Återhämtade bolag"))').innerText();
check("North Star räknar det seedade återhämtade bolaget", /1/.test(nsTile), nsTile);

// 4. Rollbyte sår om: tillbaka till företaget - juristens klienter borta.
await login("Demo – Företag");
body = await page.innerText("body");
check("företagsvyn efter rollbyte visar Demobolaget", /Demobolaget|556012-3456/.test(body));
check("juristens klienter läcker inte", !/Demo Bygg AB/.test(body));

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
