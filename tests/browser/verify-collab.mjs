/**
 * Verifierar deltagarflödet och meddelanden 2.0 mot demobygget.
 *
 * Kedjan som testas är den en verklig användare går: bjud in en kollega →
 * öppna en grupptråd → skicka med tagg → dubblettgrupp → slå ihop →
 * kvittera. Demo-adaptern accepterar inbjudningar direkt i webbläsaren, så
 * hela kedjan går att köra utan server.
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
page.setDefaultNavigationTimeout(30000);

const goto = async (path) => {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
};

await goto("/login");
await page.click('button:has-text("Gå in i demon")');
await page.waitForTimeout(1200);

// 1. Deltagarsidan: bjud in en revisor
await goto("/dashboard/deltagare");
let body = await page.innerText("body");
check("deltagarsidan laddar", /Vilka som ser ärendet/i.test(body));
check("ägaren listas", /Företrädare/i.test(body));
check("borgenärsgränsen förklaras", /Borgenärer kan inte bjudas in/i.test(body));

await page.fill("#invite-email", "revisor@byran.se");
await page.click('label:has-text("Revisor")');
await page.click('button:has-text("Skicka inbjudan")');
await page.waitForTimeout(900);
body = await page.innerText("body");
check("inbjudan syns som väntande", /revisor@byran\.se/.test(body) && /Väntar på svar/i.test(body));

// 2. Acceptera inbjudan (demo: hämta id ur localStorage)
const invitationId = await page.evaluate(() => {
  const raw = localStorage.getItem("clearance-demo-state");
  const state = JSON.parse(raw);
  return state.caseInvitations[0]?.id ?? null;
});
check("inbjudan sparad i demolagret", Boolean(invitationId));
await goto(`/inbjudan/${invitationId}`);
body = await page.innerText("body");
check("acceptsidan visar bolag och roll", /bjudit in dig till ärendet/i.test(body), body.slice(0, 200));
await page.click('button:has-text("Tacka ja")');
await page.waitForTimeout(1000);
check("accept ger bekräftelse", /Du är nu med i ärendet/i.test(await page.innerText("body")));

// 3. Meddelanden: grupptråd med den nya deltagaren
await goto("/dashboard/meddelanden");
body = await page.innerText("body");
check("trådväljaren finns", /Hela ärendet/i.test(body));
await page.click('button:has-text("Ny tråd")');
await page.waitForTimeout(400);
check("direkt förklaras som privat", /ser bara ni två/i.test(await page.innerText("body")));
await page.click('button:has-text("Grupp")');
await page.fill("#group-title", "Bankfrågor");
await page.click('input[type="checkbox"]');
await page.click('button:has-text("Starta tråden")');
await page.waitForTimeout(900);
check("gruppen öppnas som flik", /Bankfrågor/.test(await page.innerText("body")));

// 4. Skicka med tagg
await page.fill("#message-body", "Kan du ta fram engagemangsbeskedet från banken?");
const tagSelect = page.locator('select[aria-label="Förväntar svar av"]');
await tagSelect.selectOption({ index: 1 });
check("taggförklaringen visas", /släcks först när hen kvitterar/i.test(await page.innerText("body")));
await page.click('button:has-text("Skicka")');
await page.waitForTimeout(900);
body = await page.innerText("body");
check("meddelandet skickades", /engagemangsbeskedet/.test(body));
check("taggen visas på meddelandet", /Svar väntas av/i.test(body));

// 5. Dubblettgrupp → sammanslagning
await page.click('button:has-text("Ny tråd")');
await page.waitForTimeout(300);
await page.click('button:has-text("Grupp")');
await page.fill("#group-title", "bankfrågor");
await page.click('form input[type="checkbox"]');
await page.click('button:has-text("Starta tråden")');
await page.waitForTimeout(900);
body = await page.innerText("body");
check("dubblettvarningen visas", /finns två gånger/i.test(body), body.slice(0, 300));
await page.click('button:has-text("Slå ihop")');
await page.waitForTimeout(900);
body = await page.innerText("body");
check("efter sammanslagning: en grupp kvar", !/finns två gånger/i.test(body));
check("meddelandena ligger kvar i målgruppen", /engagemangsbeskedet/.test(body));

// 6. Uppfattat-kvittens (skicka som "motpart" går inte i demon - kvittera
//    i stället ett meddelande någon annan skrivit: demo-användaren är
//    författare, så kvittensknappen ska INTE visas på egna meddelanden)
check("egna meddelanden saknar kvittensknapp", !/^Uppfattat$/m.test(body));

// 7. Bilaga
await page.setInputFiles('input[type="file"]', {
  name: "engagemangsbesked.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4 demo"),
});
await page.fill("#message-body", "Här är beskedet.");
await page.click('button:has-text("Skicka")');
await page.waitForTimeout(1200);
body = await page.innerText("body");
check("bilagan syns som chip", /engagemangsbesked\.pdf/.test(body), body.slice(0, 400));

// 8. Notiscentret finns i skalet. Sedan Notiscenter 2.0 aggregerar klockan
//    alla källor - den egna taggen är redan kvitterad (rätt beteende), så
//    panelen ska visa ärendets läge, inte den släckta taggen.
const bell = await page.locator('button[aria-label^="Notiser"]').count();
check("notisklockan finns i sidhuvudet", bell >= 1);
await page.click('button[aria-label^="Notiser"]');
await page.waitForTimeout(400);
check(
  "notiscentret öppnas med ärendets läge",
  /Läget kräver|Förfaller|frist|Kontrollbalans/i.test(await page.innerText("body")),
);

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
