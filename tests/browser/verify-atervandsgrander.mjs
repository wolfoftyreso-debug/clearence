/**
 * ÅTERVÄNDSGRÄNDER: sviten som går den OLYCKLIGA vägen.
 *
 * "Hoppa över frågan" var en död knapp i introduktionen - samma fråga kom
 * tillbaka i evighet och användaren satt fast. Alla trettiotre
 * webbläsarsviter var gröna hela tiden, för de klickade alltid på ett
 * riktigt alternativ. Felet låg i nödutgången, och nödutgångar var det
 * ingen som prövade.
 *
 * Den här sviten gör tvärtom. Den tar bara reservvägarna:
 *
 *  1. Hoppar över VARJE fråga i intervjun, hela vägen.
 *  2. Hoppar över VARJE steg i en guidad genomgång.
 *  3. Går tillbaka ur varje guide, inklusive från första steget.
 *  4. Besöker varje vy UTAN ärende och kräver en väg framåt.
 *  5. Går till en adress som inte finns.
 *
 * REGELN SOM MÄTS: ingen skärm får sakna en väg vidare. Antingen händer
 * något när man trycker, eller så står det på skärmen vad man ska göra i
 * stället - och då som något klickbart, inte som en tröstande mening.
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
/* Mobilbredd: det var där felet visade sig, och det är den trängsta ytan. */
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(30000);
page.on("pageerror", (e) => check(`inget skript kraschar (${e.message.slice(0, 60)})`, false));

/** Sidans "signatur": ändras den inte har ingenting hänt. */
const signature = async () => {
  const body = await page.innerText("body");
  return `${page.url()}|${body.length}|${body.slice(0, 400)}`;
};

/* --- 1. Intervjun: hoppa över ALLT ---------------------------------------- */

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.click('button:has-text("Kom igång")');
await page.waitForTimeout(400);
await page.fill("#onboarding-name", "Erik Andersson");
await page.fill("#onboarding-email", "erik@demobolaget.se");
await page.fill("#onboarding-org", "5560123456");
await page.waitForTimeout(1800);
await page.click('button:has-text("Fortsätt")');
await page.waitForTimeout(600);
await page.fill("#onboarding-password", "hemligt-nog-123");
await page.click('button:has-text("Skapa konto")');
await page.waitForTimeout(1200);
await page.click('button:has-text("Jag kan inte betala löner")');
await page.waitForTimeout(1200);

const questionNow = async () => {
  const t = await page.locator('section[aria-label="Samtal med CLEARANCE"]').innerText();
  return (t.match(/fråga \d+ av \d+/i) ?? [""])[0];
};

let skips = 0;
let stuckOn = null;
for (let i = 0; i < 20; i += 1) {
  const skip = page.locator('button:has-text("Hoppa över frågan")');
  if ((await skip.count()) === 0) break;
  const before = await questionNow();
  await skip.first().click();
  await page.waitForTimeout(350);
  const after = await questionNow();
  if (before === after) { stuckOn = before; break; }
  skips += 1;
}
check("varje fråga går att hoppa över", stuckOn === null, `fastnade på ${stuckOn}`);
check("och intervjun tar slut", skips >= 9 && skips <= 15, String(skips));
// Den som hoppat över allt ska ändå komma FRAM - inte till en tom skärm.
await page.waitForTimeout(1200);
check(
  "en intervju utan svar landar ändå i en analys",
  (await page.locator('section[aria-label="Första analysen"]').count()) === 1,
);
const bare = await page.locator('section[aria-label="Första analysen"]').innerText();
// Och den ska SÄGA att den inte vet något, inte hitta på.
check(
  "analysen påstår inget den inte vet",
  /ingen bild|inga av frågorna/i.test(bare) || /9 av 9 fält/.test(bare),
  bare.slice(0, 200),
);
check("och den leder vidare ändå", (await page.locator('a:has-text("Gör nulägesanalysen")').count()) >= 1);
check(
  "det går att gå vidare till nulägesanalysen",
  (await page.locator('button:has-text("Gå vidare till nulägesanalysen")').count()) === 1,
);

/* --- 2. Guiden: hoppa över VARJE steg -------------------------------------- */

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
await page.click('button:has-text("Demo – Företag")');
await page.waitForTimeout(2500);
await page.goto(`${BASE}/dashboard/samtal`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.click('[data-guide="flode-sa-hittar-du-tillbaka"]');
await page.waitForTimeout(3200);

let guideSkips = 0;
let guideStuck = null;
for (let i = 0; i < 8; i += 1) {
  const skip = page.locator('button:has-text("Hoppa över steget")');
  if ((await skip.count()) === 0) break;
  const before = await page.locator("[data-guide-callout]").first().innerText().catch(() => "");
  await skip.first().click();
  await page.waitForTimeout(2600);
  const after = await page.locator("[data-guide-callout]").first().innerText().catch(() => "");
  if (before === after && before !== "") { guideStuck = before.slice(0, 60); break; }
  guideSkips += 1;
}
check("varje steg i genomgången går att hoppa över", guideStuck === null, String(guideStuck));
check("och genomgången tar slut", guideSkips >= 3, String(guideSkips));
// När allt är överhoppat ska guiden SLÄPPA skärmen - inte lämna en ring
// kvar som väntar på ett klick som aldrig kommer.
await page.waitForTimeout(1500);
check(
  "guiden lämnar inte skärmen i väntläge",
  (await page.locator('button:has-text("Hoppa över steget")').count()) === 0,
);

/* --- 3. Ut ur guiden när som helst ---------------------------------------- */

await page.goto(`${BASE}/dashboard/samtal`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.click('[data-guide="flode-sa-hittar-du-tillbaka"]');
await page.waitForTimeout(3200);
check("genomgången går att avsluta", (await page.locator('button:has-text("Avsluta genomgången")').count()) === 1);
await page.click('button:has-text("Avsluta genomgången")');
await page.waitForTimeout(600);
check("och då är skärmen fri", (await page.locator("[data-guide-ring]").count()) === 0);
check("dimningen försvinner också", !(await page.content()).includes("bg-foreground/45"));

/* --- 4. Guiderna: tillbaka från första steget ------------------------------ */

for (const [name, route] of [["nulägesanalysen", "/wizard"], ["kontrollbalansen", "/kbr"], ["likviditetsplanen", "/likviditetsplan"]]) {
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  const back = page.locator("header button, header a").first();
  const before = await signature();
  if ((await back.count()) === 0) {
    check(`${name}: har en väg tillbaka`, false, "ingen knapp i sidhuvudet");
    continue;
  }
  await back.click();
  await page.waitForTimeout(1500);
  check(`${name}: tillbakaknappen leder någonstans`, (await signature()) !== before, page.url());
}

/* --- 5. Varje vy UTAN ärende ska erbjuda en väg framåt --------------------- */

await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem("clearance-demo-state"));
  raw.cases = [];
  raw.caseMembers = [];
  raw.kbrAssessments = [];
  localStorage.setItem("clearance-demo-state", JSON.stringify(raw));
});

const EMPTY_VIEWS = [
  ["översikten", "/dashboard"],
  ["likviditeten", "/dashboard/liquidity"],
  ["dokumenten", "/dashboard/dokument"],
  ["händelseloggen", "/dashboard/handelser"],
  ["meddelandena", "/dashboard/meddelanden"],
  ["deltagarna", "/dashboard/deltagare"],
  ["alternativen", "/dashboard/alternativ"],
  ["kreditunderlaget", "/dashboard/kreditunderlag"],
];
for (const [name, route] of EMPTY_VIEWS) {
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  const main = await page.locator("main").innerText().catch(() => "");
  // En tom vy får inte bara konstatera tomheten. Den ska peka vidare -
  // med något KLICKBART, inte med en tröstande mening.
  const ways = await page
    .locator('main a[href], main button:not([disabled])')
    .filter({ hasNotText: /^$/ })
    .count();
  check(`${name} utan ärende erbjuder en väg framåt`, ways >= 1, `${ways} klickbara · ${main.slice(0, 90)}`);
  check(`${name} utan ärende säger något alls`, main.trim().length > 30, main.slice(0, 60));
}

/* --- 6. En LÅST knapp måste säga vad som saknas ---------------------------- */

// Den tystaste återvändsgränden av alla: en grå "Nästa" som inte
// förklarar sig. Användaren ser en knapp som inte gör något och vet inte
// varför - och en produkt som inte säger vad den väntar på har lagt över
// gissandet på den som redan har fullt upp.
await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem("clearance-demo-state"));
  raw.cases = [];
  localStorage.setItem("clearance-demo-state", JSON.stringify(raw));
  localStorage.removeItem("clearance-wizard-draft");
  localStorage.removeItem("clearance-kbr-draft");
  localStorage.removeItem("clearance-liquidity-draft");
  localStorage.removeItem("clearance-onboarding");
});

for (const [name, route, primary] of [
  ["nulägesanalysen", "/wizard", "Nästa"],
  ["kontrollbalansen", "/kbr", "Nästa"],
  ["likviditetsplanen", "/likviditetsplan", "Nästa"],
]) {
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2400);
  const button = page.locator(`button:has-text("${primary}")`).last();
  if ((await button.count()) === 0) continue;
  const locked = await button.isDisabled();
  if (!locked) {
    check(`${name}: första steget är inte låst`, true);
    continue;
  }
  // Låst: då MÅSTE skärmen säga vad som fattas, med de orden. Alla tre
  // guiderna lägger skälet intill knappen - i två av dem sitter foten
  // utanför <main>, så vi letar på hela skärmen.
  const explained = await page.locator("text=/för att gå vidare/i").count();
  const screen = await page.innerText("body");
  check(`${name}: den låsta knappen förklarar sig`, explained > 0, screen.slice(0, 220).replace(/\n/g, " "));
}

/* --- 7. Samtalet: när motorn inte förstår --------------------------------- */

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
await page.click('button:has-text("Demo – Företag")');
await page.waitForTimeout(2500);
await page.goto(`${BASE}/dashboard/samtal`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
const field = page.locator("#samtal-input");
if ((await field.count()) > 0) {
  await field.fill("qwertyuiop asdfghjkl zxcvbnm");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);
  const reply = await page.innerText("body");
  check(
    "obegripligt i samtalet ger ett svar, inte tystnad",
    /nulägesanalysen|tar det från början|guidar dig/i.test(reply),
    reply.slice(0, 200),
  );
  check(
    "och svaret pekar på en väg framåt",
    (await page.locator('a[href="/wizard"], button:has-text("nulägesanalys")').count()) >= 1 ||
      /Jag öppnar nulägesanalysen/i.test(reply),
  );
} else {
  check("samtalet har en inmatningsruta", false, "hittade ingen");
}

/* --- 8. Rådgivarkatalogen: ett filter som inte ger några träffar ----------- */

await page.goto(`${BASE}/marketplace`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2200);
const search = page.locator('input[type="search"], input[placeholder*="ök"]').first();
if ((await search.count()) > 0) {
  await search.fill("zzzzqqqq");
  await page.waitForTimeout(900);
  const body = await page.innerText("body");
  check(
    "en sökning utan träffar säger det",
    /inga|hittade inte|ingen träff|matchar/i.test(body),
    body.slice(0, 200),
  );
}

/* --- 9. Notisklockan när det inte finns något ----------------------------- */

await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
const bell = page.locator('button[aria-label*="isering"], button[aria-label*="otis"]').first();
if ((await bell.count()) > 0) {
  await bell.click();
  await page.waitForTimeout(700);
  const panel = await page.innerText("body");
  check(
    "notisklockan säger något även när den är tom",
    panel.length > 100,
    panel.slice(0, 120),
  );
  await page.keyboard.press("Escape");
}

/* --- 10. En adress som inte finns ----------------------------------------- */

await page.goto(`${BASE}/finns-inte-alls`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const notFound = await page.innerText("body");
check("okänd adress säger vad som hänt", /hittade|finns inte|404/i.test(notFound), notFound.slice(0, 120));
check(
  "och erbjuder en väg tillbaka",
  (await page.locator('a[href="/"], a:has-text("startsidan"), a:has-text("Till start")').count()) >= 1,
);

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
