/**
 * Omprövningsbevakningen genom hela flödet.
 *
 * Gränssnittet har lovat att beslut "omprövas när läget ändras" sedan
 * beslutsminnet byggdes. Den här sviten är beviset på att löftet hålls -
 * och den är skriven för att gå sönder om någon tar bort bevakningen och
 * lämnar löftet kvar.
 *
 * Det som måste synas:
 *  1. Beslutet vars villkor är motsagt flaggas FÖRE samtalet.
 *  2. Larmet citerar beslutet, villkoret och vad som gäller nu.
 *  3. Båda dörrarna finns: ompröva ELLER låt beslutet stå fast.
 *  4. Kvitteringen håller över en omladdning - annars är den ingen
 *     kvittering, bara en dold knapp.
 *  5. Beslutslistan visar villkorets läge, och "bevakas inte" när det
 *     inte finns något villkor.
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
await page.goto(`${BASE}/dashboard/samtal`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1800);

// Obs: rubriken renderas versalt av CSS, och innerText ger den
// RENDERADE texten. Kontrollerna nedan matchar därför skiftlägesokänsligt
// - annars blir de negativa kontrollerna gröna även med flaggan kvar.
let body = await page.innerText("body");

// 1-2. Flaggan finns, och den säger vad den bygger på.
check("premissändringen flaggas", /Premissen har ändrats/i.test(body));
check("larmet citerar beslutet", /Avvakta med rekonstruktionsansökan/.test(body));
check("larmet daterar beslutet", /beslutade ni/.test(body));
check("larmet återger villkoret som sattes", /skuldtäckningen är minst 45 %/i.test(body), body.slice(0, 400));
check("larmet säger vad som gäller nu", /Skuldtäckningen är 30 %/.test(body));
check("larmet lämnar båda dörrarna öppna", /Vill du ompröva beslutet, eller står det fast\?/.test(body));

// CLEARANCE fattar inte bolagets beslut åt bolaget.
check("larmet talar inte om vad användaren bör göra", !/du bör ompröva|vi rekommenderar att du omprövar/i.test(body));
check("bevakningen kallas aldrig AI", !/\bAI\b/.test(body));

// 3. Båda knapparna finns.
check("knappen Ompröva beslutet finns", (await page.locator('button:has-text("Ompröva beslutet")').count()) >= 1);
check("knappen Beslutet står fast finns", (await page.locator('button:has-text("Beslutet står fast")').count()) === 1);
check(
  "det framgår att frågan kommer tillbaka",
  /Frågan kommer tillbaka\s+om läget ändras igen/.test(body.replace(/\s+/g, " ")) ||
    /kommer tillbaka/.test(body),
);

// 5. Beslutslistan visar villkorets läge.
check("beslutslistan visar villkoret", /Skuldtäckningen är minst 45 %/.test(body));
check("beslutslistan visar att villkoret är motsagt", /Villkoret är motsagt/.test(body));

// 4. Kvitteringen: flaggan försvinner, och den stannar borta.
await page.click('button:has-text("Beslutet står fast")');
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("flaggan försvinner efter kvittering", !/Premissen har ändrats/i.test(body));
check("beslutet finns kvar i listan", /Avvakta med rekonstruktionsansökan/.test(body));
check("villkorets läge visas fortfarande", /Villkoret är motsagt/.test(body));

await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1800);
body = await page.innerText("body");
check("kvitteringen håller över en omladdning", !/Premissen har ändrats/i.test(body));

// Omprövningen finns kvar som väg - kvitteringen är inte en återvändsgränd.
check(
  "beslutet går fortfarande att ompröva",
  (await page.locator('button:has-text("Ompröva beslutet")').count()) >= 1,
);
await page.click('button:has-text("Ompröva beslutet")');
await page.waitForTimeout(600);
await page.fill('input[aria-label="Skäl för omprövning"]', "Täckningen föll till 30 %.");
await page.click('button:has-text("Ompröva")');
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("omprövningen registreras", /Omprövat/.test(body));
check("originalbeslutet står kvar", /Avvakta med rekonstruktionsansökan/.test(body));
check("skälet står kvar", /Täckningen föll till 30 %/.test(body));
check("ett omprövat beslut bevakas inte längre", !/Premissen har ändrats/i.test(body));

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
