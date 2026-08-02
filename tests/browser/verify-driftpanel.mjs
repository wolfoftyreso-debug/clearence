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
page.setDefaultNavigationTimeout(30000);

const goto = async (path) => {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
};

// Fri demoadress via formuläret: behåller adminrätten i demon, så att
// sviten kan korsa företags- och driftflöden i en och samma inloggning.
// Rollkontona (företag/jurist) är avsiktligt INTE drift.
await goto("/login");
await page.fill("#email", "drift@example.invalid");
await page.fill("#password", "demo123");
await page.click('button[type="submit"]:has-text("Logga in")');
await page.waitForTimeout(1200);
check("demo-inloggning når dashboard", page.url().includes("/dashboard"));

// 1. KBR steg 0: förvalt vägval från utvärderingen. Demoföretaget har ett
// färdigt utkast på resultatsteget - den här sviten testar själva guiden
// och börjar därför om från början.
await page.evaluate(() => localStorage.removeItem("clearance-kbr-draft"));
await goto("/kbr");
const body = await page.innerText("body");
check("KBR visar förvalt vägval", /Förvalt utifrån din utvärdering/i.test(body), body.slice(0, 200));
check("KBR-badge 'Föreslås för dig'", /Föreslås för dig/i.test(body));

// 2. Gå vidare till steg 1 och slå upp demo-orgnumret
const suggested = await page.locator("text=Föreslås för dig").count();
check("badge finns exakt en gång", suggested === 1, `antal: ${suggested}`);
await page.click('button:has-text("Nästa")');
await page.waitForTimeout(600);
const orgInput = page.locator('input[placeholder="XXXXXX-XXXX"]').first();
await orgInput.fill("556012-3456");
await page.waitForTimeout(1200);
const step1 = await page.innerText("body");
check("556012-3456 ger Demobolaget AB", /Demobolaget AB/i.test(step1), step1.slice(0, 300));

// 3. Driftpanelen
await goto("/dashboard");
const nav = await page.innerText("body");
check("menyn har Driftpanel", /Driftpanel/i.test(nav));
await goto("/admin");
const admin = await page.innerText("body");
check("driftpanelen laddar", /Systemets läge just nu/i.test(admin));
check("statuskort: nya meddelanden", /Nya meddelanden/i.test(admin));
check("statuskort: väntande ansökningar", /Väntande ansökningar/i.test(admin));
check("statuskort: misslyckade utskick", /Misslyckade utskick/i.test(admin));
check("statuskort: stängda konton", /Stängda konton/i.test(admin));
check("API-nyckelsektionen finns", /API-nycklar/i.test(admin));
check("Creditsafe listas", /Creditsafe/i.test(admin));

// 4. Spara en nyckel → maskeras, kan tas bort
await page.fill('input[aria-label="API-nyckel för Creditsafe"]', "demo-nyckel-ABCD1234");
await page.click('li:has-text("Creditsafe") button:has-text("Spara")');
await page.waitForTimeout(900);
const afterSet = await page.innerText('li:has-text("Creditsafe")');
check("nyckel maskeras till ••••1234", /••••1234/.test(afterSet), afterSet);
check("hela nyckeln syns aldrig", !afterSet.includes("demo-nyckel"), afterSet);
check("bytesdatum visas", /bytt/i.test(afterSet));

page.on("dialog", (d) => d.accept());
await page.click('li:has-text("Creditsafe") button[aria-label="Ta bort nyckeln för Creditsafe"]');
await page.waitForTimeout(900);
const afterDelete = await page.innerText('li:has-text("Creditsafe")');
check("borttagen nyckel försvinner", /Ingen nyckel sparad/i.test(afterDelete), afterDelete);

// 5. Creditsafe under "Inom kort" i integrationsöversikten
await goto("/dashboard/dokument");
const docs = await page.innerText("body");
check("Creditsafe under Inom kort", /Creditsafe/i.test(docs), docs.slice(0, 200));

// 6. Utan ärende: KBR visar guiden i stället för förvalet
await page.evaluate(() => localStorage.clear());
await goto("/login");
await page.fill("#email", "drift@example.invalid");
await page.fill("#password", "demo123");
await page.click('button[type="submit"]:has-text("Logga in")');
await page.waitForTimeout(1000);
// töm ärendena direkt i demolagret - och guideutkastet, som annars
// återupptar på resultatsteget i stället för vägvalet
await page.evaluate(() => {
  localStorage.removeItem("clearance-kbr-draft");
  const key = Object.keys(localStorage).find((k) => /demo/i.test(k) && localStorage.getItem(k)?.includes('"cases"'));
  if (key) {
    const state = JSON.parse(localStorage.getItem(key));
    state.cases = [];
    localStorage.setItem(key, JSON.stringify(state));
  }
});
await goto("/kbr");
const kbrNoCase = await page.innerText("body");
check("utan utvärdering: vägvalsguiden visas", /Osäker på vilket alternativ|Gör utvärderingen först/i.test(kbrNoCase), kbrNoCase.slice(0, 300));
check("utan utvärdering: 'Jag vet redan mitt vägval'", /Jag vet redan mitt vägval/i.test(kbrNoCase));

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
