/**
 * Betalväggen: rättvis, aldrig inlåsande, och priset är en driftparameter.
 *
 *  1. Startsidan visar priset och villkoren (ingen bindningstid, data
 *     sparas vid paus) - hämtat ur parametern.
 *  2. Betalande kund (demoseeden): export och inbjudningar är öppna.
 *  3. Obetald kund (paidAt nollställs): exporten ersätts av låskortet
 *     med pris, Deltagares inbjudningsformulär gatas, och rådgivaren
 *     svarar ärligt på "jag behöver min revisor".
 *  4. Drift ändrar beloppet - låstexterna visar det nya beloppet direkt.
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

// 1. Priset på startsidan.
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
let body = await page.innerText("body");
check("priset visas på startsidan", /985 kr\/mån \+ moms/.test(body));
check("villkoren är rättviseorden", /Ingen bindningstid/i.test(body) && /sparas även om abonnemanget pausas/i.test(body));
check("fyra nivåer utan ordet provversion", /Clearance Start/i.test(body) && /Clearance Standard/i.test(body) && /Clearance Business/i.test(body) && /Clearance Enterprise/i.test(body) && !/provversion/i.test(body));
check("Start är gratis", /Gratis/.test(body));
check("Business och Enterprise ur parametrarna", /2 780 kr\/mån \+ moms/.test(body) && /4 500 kr\/mån \+ moms eller offert/.test(body));
check("sökrutan är borta från startsidan", !/Sök på clearance\.se/i.test(body));

// 2. Betalande kund: allt öppet.
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.fill("#email", "betalvagg@example.invalid");
await page.fill("#password", "demo123");
await page.click('button[type="submit"]:has-text("Logga in")');
await page.waitForTimeout(1800);
body = await page.innerText("body");
check("betalande kund ser exportknapparna", /Exportera akt/i.test(body) && /Fristkalender/i.test(body));

// 3. Obetald kund: låskorten, med arbetet kvar.
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem("clearance-demo-state"));
  raw.billing.paidAt = null;
  localStorage.setItem("clearance-demo-state", JSON.stringify(raw));
});
await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("exporten är låst före första betalningen", !/Exportera akt/i.test(body) && /Export av akt och fristkalender/i.test(body));
check("låstexten bär pris och löfte", /985 kr\/mån \+ moms/.test(body) && /Allt du skapat finns kvar/i.test(body));
check("skapandet är fortfarande öppet", /Ny utvärdering/i.test(body) && /Nästa steg/i.test(body));

await page.goto(`${BASE}/dashboard/deltagare`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
body = await page.innerText("body");
check("inbjudningarna gatas under Deltagare", /Bjud in revisor, jurist och styrelse/i.test(body) && !/Skicka inbjudan/i.test(body));

await page.goto(`${BASE}/dashboard/samtal`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
await page.fill("#samtal-input", "Jag behöver min revisor");
await page.click('button[aria-label="Skicka"]');
await page.waitForTimeout(700);
body = await page.innerText("body");
check("rådgivaren svarar ärligt om betalväggen", /Delning med externa rådgivare aktiveras när första fakturan är betald/i.test(body));

// 4. Driftparametern: nytt belopp slår igenom i låstexterna.
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.fill("#email", "drift-pris@example.invalid");
await page.fill("#password", "demo123");
await page.click('button[type="submit"]:has-text("Logga in")');
await page.waitForTimeout(1800);
await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("driftpanelen visar företagsabonnemanget", /Företagsabonnemanget/i.test(body) && /Standard 985/.test(body) && /Business 2780/.test(body));
await page.fill('input[aria-label="Ny månadsavgift exklusive moms"]', "1200");
await page.click('button:has-text("Spara")');
await page.waitForTimeout(1000);
body = await page.innerText("body");
check("nytt belopp sparas", /Standard 1200/.test(body));
// Obetald kund ser det nya beloppet i låstexten.
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem("clearance-demo-state"));
  raw.billing.paidAt = null;
  localStorage.setItem("clearance-demo-state", JSON.stringify(raw));
});
await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("låstexten följer driftparametern", /1 200 kr\/mån \+ moms/.test(body));

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
