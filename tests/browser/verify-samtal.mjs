/**
 * Samtalet med krisrådgivaren: dialogen är gränssnittet, journalen minnet.
 *
 *  1. Översikten har samtalsingången; frågan följer med till /dashboard/samtal.
 *  2. "Jag kan inte betala momsen" känns igen → skatteflödets frågor ställs.
 *  3. Svaren (belopp, ja/nej) tar samtalet till en bedömning med
 *     användarens siffror, lagrum och handlingar med interna länkar.
 *  4. Beslutet protokollförs med premiss och syns under Fattade beslut.
 *  5. Omprövningen stämplas - beslutet skrivs aldrig över.
 *  6. Journalen: samtalet och beslutet syns i händelseloggen.
 *  7. Fritext utan träff får den ärliga fallbacken, inte en gissning.
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
await page.waitForTimeout(1800);

// 1. Ingången på översikten.
let body = await page.innerText("body");
check("översikten har samtalsingången", /Fråga rådgivaren/i.test(body));
await page.fill("#advisor-entry", "Jag kan inte betala momsen den här månaden");
await page.click('button:has-text("Fråga rådgivaren")');
await page.waitForTimeout(1500);
check("frågan följer med till samtalsvyn", page.url().includes("/dashboard/samtal"));

// 2. Flödet känns igen och första frågan ställs.
body = await page.innerText("body");
check("skatteflödet känns igen", /Skatten kan inte betalas/i.test(body), body.slice(0, 300));
check("första frågan ställs", /Hur mycket saknas/i.test(body));

// 3. Svara genom hela flödet.
await page.fill("#samtal-input", "150 000");
await page.click('button[aria-label="Skicka"]');
await page.waitForTimeout(600);
await page.click('button:has-text("Ja")'); // löner inom 30 dagar
await page.waitForTimeout(600);
await page.fill("#samtal-input", "0");
await page.click('button[aria-label="Skicka"]');
await page.waitForTimeout(600);
await page.click('button:has-text("Nej")'); // ingen KBR
await page.waitForTimeout(1200);
body = await page.innerText("body");
check("bedömningen återger beloppet", /150 000 kr/.test(body));
check("lagrummet nämns", /59 kap/.test(body));
check("rådgivningsgränsen står i svaret", /stäm av med/i.test(body));
check("KBR-handlingen länkas", (await page.locator('a[href*="/kbr"]').count()) > 0);
check("allvarsgraden visas", /Kritiskt läge/i.test(body));

// 3b. Konstitutionen i gränssnittet: bekräftelsen kom före frågorna,
// motiveringen ligger bakom en länk, aldrig fler än tre steg.
check("bekräftelsen kom före frågorna", /pressande situation/i.test(body));
check("hela motiveringen ligger bakom en länk", /Visa hela motiveringen/i.test(body));

// 4. Protokollför beslutet.
await page.click('button:has-text("Protokollför med premiss")');
await page.waitForTimeout(1000);
body = await page.innerText("body");
check("beslutet bekräftas", /protokollfört/i.test(body));
check("beslutet listas med premiss", /Fattade beslut/i.test(body) && /Beslutet vilar på uppgifterna i samtalet/i.test(body));

// 4b. Minnet: Clara följer upp beslutet mot premissen vid nästa besök.
await page.goto(`${BASE}/dashboard/samtal`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("Clara följer upp beslutet", /Är det fortfarande planen\?/.test(body) && /150 000 kr/.test(body));
await page.click('button:has-text("Ja, planen står fast")');
await page.waitForTimeout(600);
body = await page.innerText("body");
check("planen bekräftas lugnt", /fortsätter vi enligt plan/i.test(body));

// 5. Ompröva.
await page.click('button:has-text("Ompröva beslutet")');
await page.fill('input[aria-label="Skäl för omprövning"]', "Kunden betalade oväntat hela fordran.");
await page.click('button:has-text("Ompröva"):not(:has-text("beslutet"))');
await page.waitForTimeout(1000);
body = await page.innerText("body");
check("omprövningen stämplas", /omprövat/i.test(body) && /Kunden betalade oväntat/i.test(body));

// 6. Journalen i händelseloggen.
await page.goto(`${BASE}/dashboard/handelser`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("samtalet journalförs", /samtal med rådgivaren/i.test(body));
check("beslutet journalförs", /beslut: /i.test(body));
check("omprövningen journalförs", /omprövades/i.test(body));

// 7. Ärlig fallback för okänd fritext.
await page.goto(`${BASE}/dashboard/samtal`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
await page.fill("#samtal-input", "kan ni skriva min affärsplan");
await page.click('button[aria-label="Skicka"]');
await page.waitForTimeout(800);
body = await page.innerText("body");
check("fallbacken pekar på nulägesanalysen", /nulägesanalys/i.test(body));
check("snabbvalen finns för nästa försök", /Kan inte betala skatten/i.test(body) || /Brev från Kronofogden/i.test(body));

// 8. Onboardingen: en ny användare möts av Clara, inte av ett dashboard.
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.fill("#email", "clara-onboarding@example.invalid");
await page.fill("#password", "demo123");
await page.click('button[type="submit"]:has-text("Logga in")');
await page.waitForTimeout(1800);
// Demon seedar ett exempelärende åt alla - töm det för att nå det äkta
// nya-användare-läget (i produktion är det här utgångsläget).
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem("clearance-demo-state"));
  raw.cases = [];
  raw.caseMembers = [];
  raw.kbrAssessments = [];
  localStorage.setItem("clearance-demo-state", JSON.stringify(raw));
});
await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("tomt läge pekar på Clara", /Prata med Clara/i.test(body));
await page.click('button:has-text("Prata med Clara")');
await page.waitForTimeout(1200);
body = await page.innerText("body");
check("Clara presenterar sig", /Jag heter Clara/i.test(body));
check("första frågan är namnet", /Vad heter du\?/.test(body));
await page.fill("#onboarding-input", "Erik Andersson");
await page.click('button[aria-label="Skicka"]');
await page.waitForTimeout(600);
body = await page.innerText("body");
check("namnet används sparsamt (förnamn, en gång)", /Tack Erik\./.test(body) && !/Erik Erik/.test(body));
check("nästa fråga är företaget", /Vilket företag gäller det\?/.test(body));
await page.fill("#onboarding-input", "Eriks Bygg AB");
await page.click('button[aria-label="Skicka"]');
await page.waitForTimeout(600);
body = await page.innerText("body");
check("situationsvalen visas", /Vilket av följande stämmer bäst\?/.test(body) && /orolig för ekonomin/i.test(body));
await page.click('button:has-text("Jag kan inte betala vissa fakturor")');
await page.waitForTimeout(800);
body = await page.innerText("body");
check("Clara navigerar själv", /Jag öppnar nu nulägesanalysen/i.test(body));
await page.waitForTimeout(3000);
check("nulägesanalysen öppnades", page.url().includes("/wizard"));

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
