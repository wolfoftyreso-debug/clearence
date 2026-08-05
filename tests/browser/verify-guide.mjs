/**
 * "VISA, BERÄTTA INTE" - i en riktig webbläsare.
 *
 * tests/guide.ts vaktar kontraktet: att varje funktion har en adress,
 * ett ankare och fyra svar. Det här testet vaktar det som bara går att
 * se när det körs:
 *
 *  1. Att guiden FAKTISKT styr gränssnittet - byter vy, rullar fram och
 *     ritar ringen kring rätt element.
 *  2. Att förklaringen bär alla fyra svaren, på skärmen.
 *  3. Att guiden INTE låser skärmen. Det är den enda av punkterna som
 *     kan göra produkten sämre om den går fel: en rundtur man inte kan
 *     gå ifrån är en fälla, och målgruppen har bråttom.
 *  4. Att guidat arbetsläge VÄNTAR på användarens klick i stället för
 *     att klicka åt hen.
 *  5. Att kvitteringen visar var något sparades.
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
await page.waitForTimeout(900);
await page.click('button:has-text("Demo – Företag")');
await page.waitForTimeout(2500);

/* --- 0. Ankarna finns i gränssnittet ------------------------------------- */

await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
check("kontrollägets ankare finns", (await page.locator('[data-guide="kontrollomrade"]').count()) === 1);
check("handlingsplanens ankare finns", (await page.locator('[data-guide="handlingsplan"]').count()) === 1);
check("menyvalen bär ankare", (await page.locator('[data-guide^="nav-"]').count()) >= 5);

/* --- 1. "Visa mig" leder faktiskt dit ------------------------------------ */

await page.goto(`${BASE}/dashboard/samtal`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
check("Visa mig-rutan finns i samtalet", (await page.locator('section[aria-label="Visa mig"]').count()) === 1);
const bar = await page.locator('section[aria-label="Visa mig"]').innerText();
check("den erbjuder sig att leda, inte beskriva", /leder jag dig dit i gränssnittet/.test(bar), bar.slice(0, 200));

await page.fill('[data-guide="visa-mig-falt"]', "var sparas rapporterna");
await page.click('button:has-text("Visa mig")');

// Ringen ska dyka upp på menyvalet FÖRE vybytet: användaren ska se
// vilken väg som togs, inte bara landa någonstans.
await page.waitForTimeout(1900);
check(
  "menyvalet ringas in på vägen",
  (await page.locator('[data-guide-ring="nav-dokument"]').count()) === 1,
  page.url(),
);

// Vänta på att sekvensen når fram i stället för att gissa en tid: en
// rundtur som blir en halv sekund längre får inte fälla testet. Vi
// väntar på FÖRKLARINGEN, inte bara på rutan: mellan ringen och orden
// finns ett ögonblick då rutan är tom, och det är avsiktligt.
await page.locator('[data-guide-callout="dokumentvyn"]:has-text("Vad som sparas här")').waitFor({ timeout: 20000 });
check("guiden bytte vy själv", page.url().includes("/dashboard/dokument"), page.url());
check(
  "målet ringas in när man kommit fram",
  (await page.locator('[data-guide-ring="dokumentvyn"]').count()) === 1,
);
// Menyns förklaring får inte hänga kvar och sätta fel etikett på målet.
check(
  "vägvisningen till menyn hänger inte kvar på målet",
  !/nås härifrån/.test(await page.locator('[data-guide-callout="dokumentvyn"]').innerText()),
);

const callout = await page.locator('[data-guide-callout="dokumentvyn"]').innerText();
// De fyra svaren, på skärmen: vad det är, varför det finns, vad som
// sparas, hur man ändrar det.
// Rubriken är versaliserad i CSS - innerText återger det renderade
// skiftläget, så jämförelsen måste vara skiftlägesokänslig.
check("förklaringen namnger funktionen", /Dokument/i.test(callout), callout.slice(0, 120));
check("den säger varför det finns", /Varför det finns/.test(callout));
check("den säger vad som sparas där", /Vad som sparas här/.test(callout));
check("den säger hur användaren ändrar det", /Hur du ändrar det/.test(callout));
check(
  "innehållet är det som står i katalogen",
  /hamnar här automatiskt/.test(callout) && /ladda upp fler/.test(callout),
  callout.slice(-200),
);

/* --- 2. Guiden låser inte skärmen ---------------------------------------- */

// Overlayen får inte ta emot klick. Går det inte att klicka på ett
// menyval bakom ringen är rundturen en fälla.
const overlayBlocks = await page.evaluate(() => {
  const nav = document.querySelector('[data-guide="nav-likviditet"]');
  if (!nav) return "menyvalet saknas";
  const r = nav.getBoundingClientRect();
  const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return nav.contains(top) || top === nav ? null : (top?.className ?? "okänt element");
});
check("gränssnittet går att klicka på under guiden", overlayBlocks === null, String(overlayBlocks));

// Escape avbryter.
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
check("Escape avbryter guiden", (await page.locator("[data-guide-ring]").count()) === 0);

/* --- 3. Ingen entydig träff blir en fråga, inte en gissning --------------- */

await page.goto(`${BASE}/dashboard/samtal`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.fill('[data-guide-falt="x"]', "").catch(() => {});
await page.fill('[data-guide="visa-mig-falt"]', "qqq wxyz");
await page.click('button:has-text("Visa mig")');
await page.waitForTimeout(600);
const miss = await page.locator('section[aria-label="Visa mig"]').innerText();
check("obegripligt ger ingen gissning", (await page.locator("[data-guide-ring]").count()) === 0);
check("den säger vad den förstod", /qqq/.test(miss), miss.slice(-200));
check("och erbjuder alternativ i stället för en återvändsgränd", /Kontrolläget|Likviditet|Dokument/.test(miss));

/* --- 4. Guidat arbetsläge: guiden väntar på användaren -------------------- */

await page.click('[data-guide="flode-sa-hittar-du-tillbaka"]');
await page.waitForTimeout(3000);
check("flödet öppnade första vyn", page.url().includes("/dashboard"), page.url());
const flowBox = await page.locator("[data-guide-callout]").first().innerText();
check("guiden säger att den väntar", /jag väntar/i.test(flowBox), flowBox.slice(0, 200));
check("och varför just den här ytan", /håller uppsikt/.test(flowBox), flowBox.slice(0, 200));
check(
  "guiden klickar inte åt användaren",
  (await page.locator('[data-guide-ring="kontrollomrade"]').count()) === 1,
);

// Användaren klickar själv - då, och först då, går flödet vidare.
await page.click('[data-guide="kontrollomrade"]');
await page.waitForTimeout(3500);
check("flödet gick vidare efter användarens klick", page.url().includes("/dashboard/liquidity"), page.url());
await page.keyboard.press("Escape");

/* --- 5. Mikroutbildningen: TYST NÄR DET BRINNER --------------------------- */

// Demobolaget kan varken betala löner eller skatt - analysen kallar det
// "immediate". Då ska ingen lektion visas alls. Det är den viktigaste
// av mikroutbildningens regler: undervisning i fel ögonblick är i
// vägen, inte omtanke, och målgruppen är per definition i kris.
await page.evaluate(() => localStorage.removeItem("clearance-mikrolektioner"));
await page.goto(`${BASE}/dashboard/liquidity`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(7000);
check(
  "ingen lektion när läget är akut",
  (await page.locator("[data-guide-callout]").count()) === 0,
  await page.locator("[data-guide-callout]").count().then(String),
);

/* --- 6. ...men de kommer i ett lugnt läge, en i taget --------------------- */

// Samma bolag, men med betalningarna i ordning. Då - och först då -
// finns det utrymme att lära sig något.
await page.evaluate(() => {
  const state = JSON.parse(localStorage.getItem("clearance-demo-state"));
  for (const c of state.cases) {
    c.canPaySalary = true;
    c.canPayTax = true;
    c.canPayRent = true;
    c.canPaySuppliers = true;
    c.recommendationType = "stabilize";
  }
  localStorage.setItem("clearance-demo-state", JSON.stringify(state));
  localStorage.removeItem("clearance-mikrolektioner");
});
await page.goto(`${BASE}/dashboard/liquidity`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(8000);
const lesson = await page.locator("[data-guide-callout]").count();
check("en mikrolektion dyker upp av sig själv", lesson === 1, String(lesson));
if (lesson === 1) {
  const text = await page.locator("[data-guide-callout]").first().innerText();
  check("den förklarar den yta man står på", /golv|utbetalningar/i.test(text), text.slice(0, 160));
  check("den är märkt som en kort förklaring", /Kort förklaring/i.test(text), text.slice(0, 80));
  check("och den är kort", text.length < 400, String(text.length));
}
// Och den upprepas inte vid nästa besök. En produkt som säger samma sak
// igen blir något man klickar bort utan att läsa.
await page.keyboard.press("Escape");
await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
await page.goto(`${BASE}/dashboard/liquidity`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(7000);
const repeatText = (await page.locator("[data-guide-callout]").count()) === 0
  ? ""
  : await page.locator("[data-guide-callout]").first().innerText();
check(
  "samma lektion upprepas inte",
  !/golv, inte en prognos/.test(repeatText),
  repeatText.slice(0, 160),
);

/* --- 7. Katalogen växte: en av de nya posterna, hela vägen ---------------- */

await page.goto(`${BASE}/dashboard/samtal`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.fill('[data-guide="visa-mig-falt"]', "underlag till banken");
await page.click('button:has-text("Visa mig")');
await page.locator('[data-guide-callout="kreditunderlagsvyn"]:has-text("Vad som sparas här")').waitFor({ timeout: 20000 });
check("guiden hittar kreditunderlaget", page.url().includes("/dashboard/kreditunderlag"), page.url());
const credit = await page.locator('[data-guide-callout="kreditunderlagsvyn"]').innerText();
check("och förklarar varför det finns", /bank eller finansiär|siffror, säkerheter/.test(credit), credit.slice(0, 200));
await page.keyboard.press("Escape");

/* --- 8. ROLLEN STYR VAD GUIDEN KAN VISA ---------------------------------- */

// Företagaren ska INTE ledas till juristens ärendelista. Att peka någon
// mot en yta hen inte har är precis det principen finns för att
// förhindra - guiden ska ta bort letandet, inte flytta det.
await page.goto(`${BASE}/dashboard/samtal`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.fill('[data-guide="visa-mig-falt"]', "mina klienter");
await page.click('button:has-text("Visa mig")');
await page.waitForTimeout(2500);
check(
  "företagaren leds inte till juristens klientlista",
  !page.url().includes("/arenden"),
  page.url(),
);
await page.keyboard.press("Escape");

// Juristen ska hitta den. Samma fråga, annan roll, annat svar.
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
await page.click('button:has-text("Demo – Jurist")');
await page.waitForTimeout(2500);
await page.goto(`${BASE}/dashboard/samtal`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
if ((await page.locator('[data-guide="visa-mig-falt"]').count()) === 0) {
  check("juristen har Visa mig i samtalet", false, "rutan saknas");
} else {
  const advisorBar = await page.locator('section[aria-label="Visa mig"]').innerText();
  check(
    "juristen erbjuds sitt eget guidade flöde",
    /klientärende/i.test(advisorBar),
    advisorBar.slice(-300),
  );
  check(
    "och inte företagarens",
    !/Gör din första analys/.test(advisorBar),
    advisorBar.slice(-300),
  );
  await page.fill('[data-guide="visa-mig-falt"]', "mina klienter");
  await page.click('button:has-text("Visa mig")');
  await page.locator('[data-guide-callout="klientlistan"]').waitFor({ timeout: 20000 });
  check("juristen leds till klientlistan", page.url().includes("/arenden"), page.url());
  await page.keyboard.press("Escape");
}

/* --- 9. DRIFTVYERNA: bara för den som administrerar tjänsten ------------- */

// Först det som INTE får hända. En kund som får se "Analysövervakning"
// i en lista har fått veta att vi övervakar hens analys - att röja
// tjänstens insida för en kund är värre än att inte kunna visa den.
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
await page.click('button:has-text("Demo – Företag")');
await page.waitForTimeout(2500);
await page.goto(`${BASE}/dashboard/samtal`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.fill('[data-guide="visa-mig-falt"]', "analysövervakning");
await page.click('button:has-text("Visa mig")');
await page.waitForTimeout(2500);
check("företagaren leds inte in i driften", !page.url().includes("/admin"), page.url());
const custMiss = await page.locator('section[aria-label="Visa mig"]').innerText();
check(
  "och driftvyerna erbjuds inte ens som alternativ",
  !/Analysövervakning|Driftpanel|Loggar/.test(custMiss),
  custMiss.slice(-260),
);
check("företagaren har ingen driftmeny", (await page.locator('[data-guide="nav-drift"]').count()) === 0);
await page.keyboard.press("Escape");

// Och så det som SKA hända: adminen hittar dem, och behåller sina egna
// produktytor - driftbehörigheten ersätter inte rollen.
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
await page.click('button:has-text("Demo – Systemadministratör")');
await page.waitForTimeout(2500);
await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
check("adminen har en driftmeny med ankare", (await page.locator('[data-guide^="nav-"]').count()) >= 14);
check("driftpanelens menyval bär ankare", (await page.locator('[data-guide="nav-drift"]').count()) === 1);

await page.goto(`${BASE}/dashboard/samtal`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.fill('[data-guide="visa-mig-falt"]', "tekniska fel");
await page.click('button:has-text("Visa mig")');
await page.locator('[data-guide-callout="loggvyn"]:has-text("Vad som sparas här")').waitFor({ timeout: 20000 });
check("adminen leds till systemloggarna", page.url().includes("/admin/loggar"), page.url());
const opsCallout = await page.locator('[data-guide-callout="loggvyn"]').innerText();
check(
  "och får veta varför de är skilda från ärendets logg",
  /bolagets och inte vår|Systemets egna spår/.test(opsCallout),
  opsCallout.slice(0, 240),
);
await page.keyboard.press("Escape");

// Driftbehörigheten tar inte bort produktens ytor.
await page.goto(`${BASE}/dashboard/samtal`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.fill('[data-guide="visa-mig-falt"]', "var sparas rapporterna");
await page.click('button:has-text("Visa mig")');
await page.waitForTimeout(9000);
check("adminen når fortfarande produktens ytor", page.url().includes("/dashboard/dokument"), page.url());
await page.keyboard.press("Escape");

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
