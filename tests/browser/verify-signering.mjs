/**
 * Signeringen: ett godkännande som lämnar bevis efter sig.
 *
 *  1. Ett utkast går inte att signera - knappen finns inte.
 *  2. Panelen visar intygstexten HEL, både vad signaturen bevisar och
 *     vad den inte gör, och namnet måste skrivas.
 *  3. Signeringen ger namn, tidpunkt och "innehållet är oförändrat".
 *  4. Signeringsintyget öppnas och bär kontrollsumman och eIDAS-grunden.
 *  5. Signeringen står i händelseloggen.
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
await page.goto(`${BASE}/dashboard/dokument`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);

// Ladda upp en handling att signera.
await page.setInputFiles('input[type="file"]', {
  name: "styrelseprotokoll.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4 Styrelseprotokoll 2026-03-01 Beslut om kontrollbalansrakning"),
});
await page.waitForTimeout(1800);
let body = await page.innerText("body");
check("handlingen laddades upp som utkast", /styrelseprotokoll\.pdf/.test(body) && /Utkast/.test(body));

// 1. Ett utkast kan inte signeras.
check("utkastet har ingen signera-knapp", (await page.locator('button:has-text("Signera")').count()) === 0);

await page.click('button:has-text("Skicka för granskning")');
await page.waitForTimeout(1200);
check("signera-knappen finns när utkastet lämnat utkaststadiet",
  (await page.locator('button:has-text("Signera")').first().count()) > 0);

// 2. Panelen: intygstexten hel, styrkor och begränsningar, namnkrav.
await page.locator('button:has-text("Signera")').first().click();
await page.waitForTimeout(1200);
body = await page.innerText("body");
check("intygstexten står framme i sin helhet",
  /läst handlingen i sin helhet/.test(body) && /uppgifterna i den är riktiga/.test(body));
check("det som bevisas står uppräknat", /Det här bevisar signaturen/.test(body) && /Tidpunkten sätts av servern/i.test(body));
check("begränsningarna står lika tydligt", /Det här gör den inte/.test(body) && /inte BankID/i.test(body));
check("enkel elektronisk signatur sägs rakt ut", /enkel elektronisk signatur/i.test(body));
check("innehållet förseglas med en synlig kontrollsumma", /Innehållet förseglas som [0-9A-F]{8} /.test(body), body.match(/Innehållet förseglas som.{0,60}/)?.[0]);

const signButton = page.locator('button:has-text("Signera handlingen")');
check("knappen är låst utan namn", await signButton.isDisabled());

// 3. Signera.
const input = page.locator('input[id^="signer-"]');
await input.fill("Erik Lindqvist");
await page.waitForTimeout(300);
check("knappen öppnas när namnet är skrivet", !(await signButton.isDisabled()));
await signButton.click();
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("signaturen visas med namn", /Signerad av Erik Lindqvist/.test(body));
check("tidpunkten visas läsbart", /Signerad av Erik Lindqvist.{0,80}\d{4} kl\. \d{2}:\d{2}/s.test(body), body.match(/Signerad av.{0,90}/s)?.[0]);
check("innehållskontrollen säger oförändrat", /Innehållet är oförändrat sedan signeringen/.test(body));
check("förseglingen visas som fingeravtryck", /försegling [0-9A-F]{8} [0-9A-F]{8}/.test(body));

// 4. Signeringsintyget.
await page.click('button:has-text("Signeringsintyg")');
await page.waitForTimeout(1200);
const dialog = await page.locator('[role="dialog"][aria-label="Rapport"]').innerText();
check("intyget öppnas", /Signeringsintyg/.test(dialog));
const doc = await page.frameLocator('[role="dialog"] iframe').locator("body").innerText();
check("intyget bär undertecknaren och handlingen", /Erik Lindqvist/.test(doc) && /styrelseprotokoll\.pdf/.test(doc));
check("intyget bär hela kontrollsumman", /[0-9a-f]{64}/.test(doc));
check("intyget anger eIDAS-grunden", /3\.10/.test(doc));
check("intyget säger att det inte styrker identiteten", /styrker inte undertecknarens identitet/.test(doc.replace(/\s+/g, " ")));
await page.keyboard.press("Escape");
await page.click('button:has-text("Stäng")').catch(() => {});
await page.waitForTimeout(600);

// 5. Journalen.
await page.goto(`${BASE}/dashboard/handelser`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("signeringen står i händelseloggen", /signer/i.test(body) || /Signerad/i.test(body), body.slice(0, 200));

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
