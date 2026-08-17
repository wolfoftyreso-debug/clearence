/**
 * Verifierar rapportvisarens två lägen och att dubbelbudskapet är borta:
 * i visaren finns EN utskriftsknapp och ingen banner inne i dokumentet;
 * inbäddat visas PDF:en i lagret i stället för en tyst nedladdning.
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
await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);

// 1. Öppna visaren: en utskriftsknapp, ingen dokumentbanner.
await page.click('button:has-text("Skapa rapport")');
await page.waitForTimeout(1000);
const toolbar = await page.locator('[role="dialog"]').innerText();
check("verktygsraden: EN utskriftsknapp (Skriv ut, inte Skriv ut / PDF)", /Skriv ut(?!\s*\/)/.test(toolbar) && !/Skriv ut \/ PDF/.test(toolbar), toolbar);
check("verktygsraden: Ladda ner PDF finns", /Ladda ner PDF/.test(toolbar));
const frame = page.frameLocator('[role="dialog"] iframe');
const bannerVisible = await frame.locator(".print-bar").isVisible().catch(() => false);
check("dokumentbannern är dold i visaren (inget dubbelbudskap)", !bannerVisible);

/*
 * 2. I toppfönster: Ladda ner PDF laddar ner (ingen vy-växling).
 *
 * DEN ÄR EN LÄNK HÄR, EN KNAPP DÄR, och det är hela poängen med den här
 * filen. I toppfönstret förgenereras PDF:en och nedladdningen är ett
 * <a download> till den - ett klick, ingen andra vy. Inbäddat går det
 * inte, och då är det en knapp som öppnar lagret med förklaringen.
 *
 * Provet letade efter en knapp i båda lägena. I toppfönstret fanns ingen,
 * så det stod trettio sekunder och väntade på en nedladdning som ingen
 * hade bett om - och steg 3, hela det inbäddade läget, kördes aldrig.
 */
const NEDLADDNING = '[role="dialog"] button:has-text("Ladda ner PDF"), [role="dialog"] a:has-text("Ladda ner PDF")';
check(
  "toppfönster: nedladdningen är en riktig länk till en färdig fil",
  (await page.locator('[role="dialog"] a:has-text("Ladda ner PDF")').count()) === 1,
);
const [dl] = await Promise.all([
  page.waitForEvent("download"),
  page.locator(NEDLADDNING).first().click(),
]);
check("toppfönster: nedladdningen startar", (dl.suggestedFilename() ?? "").endsWith(".pdf"), dl.suggestedFilename());
await page.click('button:has-text("Stäng")');
await page.waitForTimeout(400);

// 3. Inbäddat läge (window.self !== window.top simuleras via en iframe-sida):
//    PDF-knappen ska VISA PDF:en i lagret med förklaringen.
await page.setContent(`<iframe src="${BASE}/login" style="width:1200px;height:800px"></iframe>`);
const inner = page.frameLocator("iframe");
await inner.locator('button:has-text("Demo – Företag")').click();
await page.waitForTimeout(1500);
await page.evaluate((base) => {
  const f = document.querySelector("iframe");
  f.src = `${base}/dashboard`;
}, BASE);
await page.waitForTimeout(1800);
await inner
  .locator('button:has-text("Ladda ner PDF"), a:has-text("Ladda ner PDF")')
  .first()
  .click();
await page.waitForTimeout(1200);
const dialogText = await inner.locator('[role="dialog"]').innerText().catch(() => "");
/*
 * KORTET LOVAR EN FÄRDIG FIL, INTE EN VISNING.
 *
 * Den ursprungliga versionen visade PDF:en i ett <object> med en egen
 * reservruta, eftersom webbläsare blockerar inbäddade PDF:er och
 * produkten annars påstod något användaren kunde se var fel. Kortet är
 * sedan dess ETT steg enklare: ingen inbäddad visning alls, bara beskedet
 * att filen finns och en riktig länk till den. Då kan ingen visning
 * blockeras, och löftet kan inte bli fel.
 *
 * Kontrollerna nedan prövar det som betyder något och som gäller i båda
 * versionerna: att kortet kommer upp, att det INTE lovar en
 * förhandsvisning, att det namnger filen, och att vägen till filen är en
 * riktig länk med filnamn - inte en knapp som ska öppna ännu en vy.
 */
check("inbäddat: PDF-kortet öppnas", /PDF:en är klar/i.test(dialogText), dialogText.slice(0, 150));
check(
  "inbäddat: den lovar inte en förhandsvisning som kan blockeras",
  !/visas nedan/i.test(dialogText) && !/visas här/i.test(dialogText),
  dialogText.slice(0, 150),
);
check(
  "inbäddat: filen namnges",
  /\.pdf/i.test(dialogText),
  dialogText.slice(0, 200),
);
const sparaLank = inner.locator('[role="dialog"] a:has-text("PDF")');
check("inbäddat: vägen till filen är en riktig länk", (await sparaLank.count()) >= 1);
check(
  "inbäddat: och länken bär filnamnet",
  /\.pdf$/.test((await sparaLank.first().getAttribute("download")) ?? ""),
  (await sparaLank.first().getAttribute("download")) ?? "(inget)",
);
check(
  "inbäddat: länken pekar på en blob, inte på en adress som kan försvinna",
  ((await sparaLank.first().getAttribute("href")) ?? "").startsWith("blob:"),
  ((await sparaLank.first().getAttribute("href")) ?? "").slice(0, 40),
);

/* --- 4. Inbäddat läge, MEN UR VISARENS VERKTYGSRAD ------------------------ */

/*
 * STEG 3 KLICKAR DASHBOARDENS EGEN KNAPP, inte visarens.
 *
 * Det syntes när fixen nedan muterades bort: provet förblev grönt fast
 * verktygsraden var trasig igen. Dashboardens knapp går via openPdf och
 * har alltid haft rätt beteende; verktygsraden i den öppnade rapporten är
 * en annan väg, och det var DEN som blev en <a download> när
 * nedladdningen gjordes om till en riktig länk.
 *
 * En länk kan en inbäddad sida som regel inte följa - artefaktvisaren
 * tillåter det aldrig - så knappen såg levande ut och gjorde ingenting.
 * Här prövas därför just den vägen.
 */
await inner.locator('button:has-text("Stäng")').first().click().catch(() => {});
await page.waitForTimeout(600);
await inner.locator('button:has-text("Skapa rapport")').first().click();
await page.waitForTimeout(1500);

const verktygsrad = inner.locator('[role="dialog"]');
check(
  "inbäddat: visarens nedladdning är en KNAPP, inte en länk som inte får följas",
  (await verktygsrad.locator('button:has-text("Ladda ner PDF")').count()) === 1
    && (await verktygsrad.locator('a:has-text("Ladda ner PDF")').count()) === 0,
);
await verktygsrad.locator('button:has-text("Ladda ner PDF")').first().click();
await page.waitForTimeout(1500);
const efterVisaren = await inner.locator('[role="dialog"]').innerText().catch(() => "");
check(
  "inbäddat: och den lägger fram filen i stället för att göra ingenting",
  /PDF:en är klar/i.test(efterVisaren),
  efterVisaren.slice(0, 150),
);

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
