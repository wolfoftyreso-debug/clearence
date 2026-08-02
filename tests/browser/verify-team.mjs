/**
 * Byråteamet: flera inloggningar per byrå.
 *
 *  1. Juristen ser Teamet på /byraprofil: kopplat konto, kollega, öppen
 *     inbjudan.
 *  2. Ny inbjudan skapas; dubblett avvisas med begripligt fel.
 *  3. Deltagare: kollega-genvägen fyller i adressfältet med ett klick.
 *  4. Kollegan (annan inloggning) ser SIN inbjudan på /byraprofil och går
 *     med i teamet - adressen är nyckeln.
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

// 1. Juristen in → byråprofilen → Teamet.
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.click('button:has-text("Demo – Jurist/Revisor")');
await page.waitForTimeout(1800);
await page.goto(`${BASE}/byraprofil`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
let body = await page.innerText("body");
check("teamsektionen finns", /Teamet/.test(body));
check("kopplade kontot visas", /jurist@clearance\.demo/.test(body) && /byråns kopplade konto/.test(body));
check("kollegan visas", /kollega@clearance\.demo/.test(body));
check("öppen inbjudan visas", /ny\.kollega@clearance\.demo/.test(body) && /Väntar på svar/.test(body));
check("gränsen sägs rakt ut", /ger INTE åtkomst till klienters ärenden/.test(body));

// 2. Bjud in en tredje kollega; dubbletten avvisas.
await page.fill('input[aria-label="Kollegans e-postadress"]', "tredje@clearance.demo");
await page.click('button:has-text("Bjud in kollega")');
await page.waitForTimeout(900);
body = await page.innerText("body");
check("ny inbjudan skapas", /tredje@clearance\.demo/.test(body));
await page.fill('input[aria-label="Kollegans e-postadress"]', "tredje@clearance.demo");
await page.click('button:has-text("Bjud in kollega")');
await page.waitForTimeout(900);
body = await page.innerText("body");
check("dubblettinbjudan avvisas begripligt", /redan en öppen inbjudan/.test(body));

// 3. Deltagare: kollega-genvägen fyller i adressen.
await page.goto(`${BASE}/arenden`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.click('article:has-text("Demo Bygg AB") button:has-text("Öppna")');
await page.waitForTimeout(1500);
await page.goto(`${BASE}/dashboard/deltagare`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("kollega-genvägen visas", /Från teamet:/.test(body) && /kollega@clearance\.demo/.test(body));
await page.click('button:has-text("kollega@clearance.demo")');
await page.waitForTimeout(400);
const filled = await page.inputValue("#invite-email");
check("klicket fyller i adressen", filled === "kollega@clearance.demo", filled);

// 4. Kollegan loggar in med sin adress och går med.
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.fill("#email", "ny.kollega@clearance.demo");
await page.fill("#password", "demo123");
await page.click('button[type="submit"]:has-text("Logga in")');
await page.waitForTimeout(1500);
await page.goto(`${BASE}/byraprofil`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("kollegan ser sin inbjudan", /Du är inbjuden till Demo Obeståndsjuridik/.test(body));
await page.click('button:has-text("Gå med i teamet")');
await page.waitForTimeout(1200);
const memberCount = await page.evaluate(() => {
  const raw = localStorage.getItem("clearance-demo-state");
  return raw ? JSON.parse(raw).firmMembers.length : -1;
});
check("kollegan är nu med i teamet", memberCount === 2, String(memberCount));
body = await page.innerText("body");
check("inbjudningskortet försvinner", !/Du är inbjuden till/.test(body));

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
