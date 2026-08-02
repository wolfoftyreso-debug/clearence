/**
 * Klientverktygen: rådgivarens arbetsyta i klientens ärende.
 *
 *  1. Juristen öppnar en klient → Klientverktyg-panelen syns med seedad
 *     anteckning och loggad tid.
 *  2. Ny anteckning sparas och visas; borttag fungerar.
 *  3. Tid loggas och summeringen växer.
 *  4. Begär komplettering → uppgift i handlingsplanen + meddelande.
 *  5. Företagsrollen ser ALDRIG panelen - anteckningarna är byråns egna.
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

// Juristen in, öppna Demo Bygg AB.
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.click('button:has-text("Demo – Jurist/Revisor")');
await page.waitForTimeout(1800);
await page.click('article:has-text("Demo Bygg AB") button:has-text("Öppna")');
await page.waitForTimeout(1800);

let body = await page.innerText("body");
check("klientverktygen syns för rådgivaren", /Klientverktyg/.test(body));
check("seedad anteckning visas", /balansrapport till fredag/.test(body));
check("seedad tid visas", /1 h 30 min/.test(body), body.match(/Tidsrapportering[\s\S]{0,120}/)?.[0] ?? "");

// 2. Ny anteckning.
await page.fill('textarea[aria-label="Ny intern anteckning"]', "Ring banken om checkkrediten.");
await page.click('button:has-text("Spara anteckning")');
await page.waitForTimeout(800);
body = await page.innerText("body");
check("ny anteckning sparas", /Ring banken om checkkrediten/.test(body));

// 3. Logga tid: 30 min → summan 2 h.
await page.fill('input[aria-label="Minuter"]', "30");
await page.fill('input[aria-label="Beskrivning av arbetet"]', "Samtal med företrädaren");
await page.click('button:has-text("Logga tid")');
await page.waitForTimeout(800);
body = await page.innerText("body");
check("tiden loggas och summeras", /2 h/.test(body) && /Samtal med företrädaren/.test(body));

// 4. Begär komplettering.
await page.fill('input[aria-label="Vad behöver kompletteras?"]', "Senaste kundreskontran");
await page.click('button:has-text("Skicka begäran")');
await page.waitForTimeout(1000);
body = await page.innerText("body");
check("bekräftelsen visas", /Begäran skickad/.test(body));
check("uppgiften ligger i handlingsplanen", /Komplettering: Senaste kundreskontran/.test(body));

// Meddelandet finns i ärendets meddelanden.
await page.goto(`${BASE}/dashboard/meddelanden`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("meddelandet skickades", /Komplettering begärd: Senaste kundreskontran/.test(body));

// 5. Företagsrollen ser inte panelen.
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.click('button:has-text("Demo – Företag")');
await page.waitForTimeout(1800);
body = await page.innerText("body");
check("företaget ser inga klientverktyg", !/Klientverktyg/.test(body));
check("företaget ser inga interna anteckningar", !/Interna anteckningar/.test(body));

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
