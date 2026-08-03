/**
 * Startsidan ÄR samtalet: en besökare möts av CLEARANCE direkt - inte av en
 * meny, inte av "Vad vill du göra?". Hela onboardingen går att köra utan
 * konto och slutar i nulägesanalysen. En inloggad användare med ärende
 * presenteras inte för CLEARANCE igen - hen fortsätter där samtalet slutade.
 *
 * Sviten vaktar också att samtalet BÖRJAR ARBETA i stället för att prata
 * färdigt först:
 *  - de tre grunduppgifterna visas samtidigt, inte i tre turer,
 *  - organisationsnumret slår mot registret och fyller i namnet,
 *  - uppgifterna följer med till nulägesanalysen i stället för att
 *    frågas en gång till,
 *  - och tonen är saklig, inte omhändertagande.
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

// 1. Anonym besökare: CLEARANCE direkt på startsidan.
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(30000);
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
let body = await page.innerText("body");
check("CLEARANCE möter besökaren direkt", /Jag heter CLEARANCE/i.test(body));
check("den ber om grunduppgifter, inte om ett namn i taget", /grunduppgifter/i.test(body));
check("gamla portalfrågan är borta", !/Vad vill du göra\?/.test(body));
check("gamla en-fråga-i-taget-rutan är borta", (await page.locator("#onboarding-input").count()) === 0);

// Tre fält, samtidigt.
check("fältet för namn finns", (await page.locator("#onboarding-name").count()) === 1);
check("fältet för företagsnamn finns", (await page.locator("#onboarding-company").count()) === 1);
check("fältet för organisationsnummer finns", (await page.locator("#onboarding-org").count()) === 1);
check("knappen heter Fortsätt", (await page.locator('button:has-text("Fortsätt")').count()) >= 1);

// Tonen: saklig, inte omhändertagande.
check("den gamla empatifrasen är borta", !/Du är inte ensam/i.test(body));
check("ingen talar om att det är överväldigande", !/överväldigande/i.test(body));
check("situationen normaliseras sakligt", /Många företag hamnar någon gång/.test(body));

// Fortsätt är låst tills det finns något att fortsätta med.
check("Fortsätt är låst utan uppgifter", await page.locator('button:has-text("Fortsätt")').first().isDisabled());

// 2. Organisationsnumret slår mot registret och fyller i.
await page.fill("#onboarding-name", "Erik Andersson");
await page.fill("#onboarding-org", "5560123456");
await page.waitForTimeout(1800);
body = await page.innerText("body");
const companyValue = await page.inputValue("#onboarding-company");
check("uppslaget fyller i företagsnamnet", companyValue === "Demobolaget AB", companyValue);
check("uppslaget bekräftas i samtalet", /Jag har identifierat företaget/.test(body));
check("registeruppgifterna visas", /Bolagsform/.test(body) && /Registreringsår/.test(body));
check("F-skatt och moms visas", /F-skatt/.test(body) && /Momsregistrering/.test(body));
check("styrelsen visas", /Styrelseledamöter/.test(body));
check("statusen visas", /Status/.test(body) && /Aktivt/.test(body));

// Ett felaktigt nummer stoppar - men först när tio siffror finns.
await page.fill("#onboarding-org", "5560123457");
await page.waitForTimeout(700);
body = await page.innerText("body");
check("kontrollsiffran granskas", /Kontrollsiffran stämmer inte/.test(body));
check("Fortsätt är låst vid felaktigt nummer", await page.locator('button:has-text("Fortsätt")').first().isDisabled());
await page.fill("#onboarding-org", "5560123456");
await page.waitForTimeout(1500);

// 3. Fortsätt: bekräftelse, process och EN fråga.
await page.click('button:has-text("Fortsätt")');
await page.waitForTimeout(700);
body = await page.innerText("body");
check("bekräftelsen använder förnamnet", /Tack Erik\./.test(body));
check("bekräftelsen nämner bolaget och numret", /Demobolaget AB \(556012-3456\)/.test(body));
check("bekräftelsen lovar struktur, inte tröst", /skapa struktur/.test(body) && /dokumentera situationen/.test(body));
check("man får veta att man kan pausa", /pausa/.test(body));
check("processen visas i fast ordning", /Kontaktperson/.test(body) && /Företagsuppgifter/.test(body)
  && /Kort nuläge/.test(body) && /Prioriterade problem/.test(body)
  && /Tidskritiska händelser/.test(body) && /Dokumentinsamling/.test(body));
check("steg 1 är avbockat", /Kontaktperson\s*–\s*klart/.test(body));
check("nu ställs EN fråga, märkt med sitt steg", /Steg 3 av 6/.test(body));
check("situationsvalen visas utan konto", /Jag är orolig för ekonomin/.test(body));

await page.click('button:has-text("Jag är orolig för ekonomin")');
await page.waitForTimeout(900);
body = await page.innerText("body");
check("avslutet är förankrat i det användaren lämnade", /har vi ett underlag att arbeta vidare från/.test(body));
check("inget tomt beröm i avslutet", !/Bra jobbat|Perfekt!|Du gör rätt/i.test(body));
await page.waitForTimeout(2800);
check("CLEARANCE öppnar nulägesanalysen", page.url().includes("/wizard"));

// 4. Löftet hålls: uppgifterna följer med, guiden frågar inte igen.
await page.waitForTimeout(1800);
const wizardOrg = await page.inputValue('input[placeholder="XXXXXX-XXXX"]');
check("organisationsnumret följde med till guiden", wizardOrg.replace(/\D/g, "") === "5560123456", wizardOrg);
body = await page.innerText("body");
check("guiden har redan bolaget", /Demobolaget AB/.test(body));

// 5. Inloggad med ärende: fortsätt samtalet, ingen ny presentation.
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.click('button:has-text("Demo – Företag")');
await page.waitForTimeout(1800);
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
body = await page.innerText("body");
check("inloggad ser Fortsätt samtalet", /Fortsätt samtalet/i.test(body));
check("ingen ny presentation för den som redan har ärende", !/Jag heter CLEARANCE/.test(body));
await page.click('a:has-text("Fortsätt samtalet")');
await page.waitForTimeout(1500);
check("knappen leder till samtalsvyn", page.url().includes("/dashboard/samtal"));

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
