/**
 * Aviseringskanalerna i webbläsaren.
 *
 * tests/notificationService.ts vaktar reglerna, supabase/tests/notifications.sql
 * vaktar databasen. Det här testet vaktar det som bara syns på skärmen:
 *
 *  - att undantaget från tyst tid STÅR framme och inte är en tyst regel,
 *  - att verifieringen förbereder användaren innan den ber om numret,
 *  - att numret inte går att slå på utan att bevisas,
 *  - att numret därefter visas MASKERAT, aldrig helt.
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
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
page.setDefaultTimeout(30000);

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.click('button:has-text("Demo – Företag")');
await page.waitForTimeout(1800);

await page.goto(`${BASE}/dashboard/installningar`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1800);
let body = await page.innerText("body");

/* --- 1. Valen finns, och de är tre ---------------------------------------- */

check("aviseringsavsnittet finns", /Aviseringar/i.test(body));
check("nivå: alla viktiga händelser", /Alla viktiga händelser/i.test(body));
check("nivå: bara när något krävs av dig", /Bara när något krävs av dig/i.test(body));
check("nivå: bara det tidskritiska", /Bara det tidskritiska/i.test(body));
const levelRadios = await page.locator('input[name="notification-level"]').count();
check("tre nivåer, inte fler", levelRadios === 3, String(levelRadios));

check("kanalen SMS visas", /SMS/.test(body));
check("kanalen e-post visas", /E-post/i.test(body));
check("push visas som inte släppt", /Push[\s\S]{0,120}(finns inte|inte släppt)/i.test(body));

/* --- 2. Klockan i appen är aldrig en betald kanal ------------------------- */

check(
  "klockan i appen står som alltid på",
  /Klockan i appen visar alltid allt|Alltid på, för alla nivåer/i.test(body),
);

/* --- 3. Undantaget från tyst tid står framme ------------------------------ */

check("tyst tid går att ställa in", /Tyst tid/i.test(body));
check("uppskjutet, inte slängt", /skjuts upp[\s\S]{0,60}slängs inte/i.test(body));
check(
  "undantaget för fristen är utskrivet",
  /Undantag:[\s\S]{0,120}tidsfrist[\s\S]{0,60}går fram ändå/i.test(body),
  "tyst tid bryts utan att det står",
);

/* --- 4. Numret: förberedelsen, beviset, maskeringen ----------------------- */

// Demon kör Business, så SMS-kanalen går att slå på. Rutan väljs via
// sin etikett, inte via ett index: sidan har flera kryssrutor, och ett
// index som glider gör att testet mäter fel ruta utan att säga till.
const smsBox = page.locator('label:has-text("SMS")').last().locator('input[type="checkbox"]');
check("SMS går att slå på i demon", !(await smsBox.isDisabled()));
await smsBox.check();
await page.waitForTimeout(900);
body = await page.innerText("body");

check("numret efterfrågas först när SMS är på", /Vilket nummer ska SMS:en gå till/i.test(body));
// Förberedelseregeln, tillämpad på en fråga som annars känns godtycklig.
check("förberedelsen säger varför vi frågar", /Därför frågar vi/i.test(body));
check("förberedelsen säger vad som händer nu", /Nu händer detta/i.test(body));
check("förberedelsen säger hur lång tid det tar", /Så lång tid tar det/i.test(body));
check(
  "det står att inget annat skickas före koden",
  /Ingenting annat skickas förrän koden är inskriven/i.test(body),
);

await page.fill('input[aria-label="Mobilnummer"]', "070-123 45 67");
await page.click('button:has-text("Skicka kod")');
await page.waitForTimeout(900);
body = await page.innerText("body");
check("koden efterfrågas efter numret", /Skriv in koden/i.test(body));
check("numret är inte påslaget än", !/SMS går till/i.test(body));

// Fel kod ska inte släppa igenom.
await page.fill('input[aria-label="Verifieringskod"]', "999999");
await page.click('button:has-text("Bekräfta")');
await page.waitForTimeout(700);
body = await page.innerText("body");
check("fel kod avvisas", /Koden stämmer inte/i.test(body), body.slice(0, 200));
check("numret slogs inte på av fel kod", !/SMS går till/i.test(body));

// Demons kod står i src/data/demo/adapter.ts.
await page.fill('input[aria-label="Verifieringskod"]', "123456");
await page.click('button:has-text("Bekräfta")');
await page.waitForTimeout(900);
body = await page.innerText("body");
check("rätt kod slår på kanalen", /SMS går till/i.test(body));
check("numret visas maskerat", /\+46 701 •• •• 67/.test(body), body.match(/SMS går till.{0,30}/)?.[0]);
check("hela numret visas inte", !/070123 ?45 ?67|\+46701234567/.test(body));

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
