/**
 * DET SOM SER UT ATT GÅ ATT ÖPPNA SKA ÖPPNAS.
 *
 * tests/openable.ts vaktar reglerna - att varje råd har en destination
 * och att destinationen finns. Det här testet vaktar det som bara syns
 * på skärmen:
 *
 *  1. Handlingsplanens rad leder med en HANDLING, inte med en kryssruta.
 *     En kryssruta ber användaren intyga att något är gjort innan hen
 *     fått hjälp att göra det.
 *  2. Klicket landar i verktyget, och ankomsten säger varför man är där
 *     och vad KLART betyder.
 *  3. Nyckeltalen går att öppna, och underlaget säger vad talet INTE
 *     säger. "Runway 8 dagar" utan det förbehållet läses som en prognos
 *     när det är ett golv.
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
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
page.setDefaultTimeout(30000);

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
await page.click('button:has-text("Demo – Företag")');
await page.waitForTimeout(2500);
await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

/* --- 1. Raden leder med en handling -------------------------------------- */

// Kryssrutan var radens första element och därmed dess erbjudande.
const taskBoxes = await page.locator('input[type="checkbox"][id^="task-"]').count();
check("uppgiftsraden har ingen kryssruta längre", taskBoxes === 0, String(taskBoxes));

const ctas = await page.locator('a:has-text("Hitta rådgivare"), a:has-text("Gör prognosen"), a:has-text("Läs vad som gäller"), a:has-text("Ladda upp underlagen"), a:has-text("Se betalningarna")').count();
check("minst en uppgift har en knapp in i verktyget", ctas >= 1, String(ctas));
check(
  "att bocka av finns kvar, men sekundärt",
  (await page.locator('button:has-text("Markera som klar")').count()) >= 1,
);

// Knappen ska säga vad man ska GÖRA, inte "Öppna".
const body = await page.innerText("body");
check("knapptexten bär uppgiftens verb", /Hitta rådgivare|Gör prognosen|Läs vad som gäller/.test(body));

/* --- 2. Klicket landar rätt, och ankomsten förbereder -------------------- */

const door = page.locator('a:has-text("Hitta rådgivare")').first();
await door.scrollIntoViewIfNeeded();
await door.click();
await page.waitForTimeout(2500);

check("klicket lämnade översikten", !page.url().endsWith("/dashboard"), page.url());
check("ursprunget följde med i adressen", /[?&]fran=/.test(page.url()), page.url());

const arrival = await page.innerText("body");
// Rubriken är versaliserad i CSS - jämför skiftlägesokänsligt.
check("ankomstrutan visas", /därför är du här/i.test(arrival));
check("den säger vad man kom för", /Du kom för att:/.test(arrival));
check("den säger varför det behövs", /Därför behövs det:/.test(arrival));
check("den säger vad klart betyder", /Klart betyder:/.test(arrival));
check("den säger vad som händer sedan", /Sedan:/.test(arrival));
check(
  "klart-texten hör till DEN HÄR sidan",
  /förfrågan är skickad till minst en rådgivare/.test(arrival),
  (arrival.match(/Klart betyder:[^\n]{0,90}/) ?? [""])[0],
);
check("det går att bocka av härifrån", (await page.locator('button:has-text("Klar")').count()) >= 1);
check("det går att gå tillbaka utan att bocka av", /Tillbaka utan att bocka av/.test(arrival));

// Den som inte kom via en rekommendation ska INTE mötas av en förklaring
// till varför de är någonstans de själva valde att gå.
await page.goto(`${BASE}/marketplace`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
check(
  "ingen ankomstruta för den som navigerat själv",
  !/därför är du här/i.test(await page.innerText("body")),
);

/* --- 3. Nyckeltalen bär sitt underlag ------------------------------------ */

await page.goto(`${BASE}/dashboard/liquidity`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

const runway = page.locator('button:has-text("Runway")').first();
check("runway går att klicka på", (await runway.count()) === 1);
check(
  "ingen detaljruta innan man klickat",
  (await page.locator('section[aria-label^="Så räknas"]').count()) === 0,
);

await runway.click();
await page.waitForTimeout(800);
const detail = await page.locator('section[aria-label^="Så räknas"]').first().innerText();

check("formeln står först", /Antal dagar tills saldot/.test(detail), detail.slice(0, 120));
check("posterna visas", /Startsaldo/.test(detail) && /Går under noll/.test(detail));
check("betydelsen står med", /Dagen då kassan tar slut|Kassan håller horisonten/.test(detail));
// Det viktigaste förbehållet i produkten: kurvan har inga intäkter alls.
check("förbehållen har en egen rubrik", /det här säger talet inte/i.test(detail));
check(
  "det står att inga inbetalningar räknas",
  /Inga inbetalningar räknas med/.test(detail),
  detail.slice(-200),
);
check("talet kallar sig ett golv", /GOLV/.test(detail));

// Rutan stängs, och en annan ruta öppnar sitt eget underlag.
await page.locator('section[aria-label^="Så räknas"] button[aria-label="Stäng"]').click();
await page.waitForTimeout(500);
check("rutan går att stänga", (await page.locator('section[aria-label^="Så räknas"]').count()) === 0);

const pending = page.locator('button:has-text("Väntande betalningar")').first();
await pending.click();
await page.waitForTimeout(700);
const pendingDetail = await page.locator('section[aria-label^="Så räknas"]').first().innerText();
check("väntande betalningar har eget underlag", /Väntande eller Kritisk/.test(pendingDetail));
check(
  "uppskjutna och betalda redovisas som utanför summan",
  /ingår INTE i summan/.test(pendingDetail),
  pendingDetail.slice(0, 200),
);

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
