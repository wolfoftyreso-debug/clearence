/**
 * Startsidan ÄR samtalet: en besökare möts av CLEARANCE direkt - inte av en
 * meny, inte av "Vad vill du göra?". Hela onboardingen går att köra utan
 * konto och slutar i nulägesanalysen. En inloggad användare med ärende
 * presenteras inte för CLEARANCE igen - hen fortsätter där samtalet slutade.
 *
 * Sviten vaktar också att samtalet BÖRJAR ARBETA i stället för att prata
 * färdigt först:
 *  - de fyra grunduppgifterna visas samtidigt, inte i fyra turer,
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

// Steg 1: välkomsten, med en tidsangivelse. Den som inte vet om det tar
// en kvart eller en eftermiddag stänger fliken.
check("välkomsten möter besökaren", /Välkommen!/.test(body));
check("den säger vad tjänsten gör", /analysera företagets situation/.test(body));
check("den säger hur lång tid det tar", /3–5 minuter/.test(body), body.slice(0, 300));
await page.click('button:has-text("Kom igång")');
await page.waitForTimeout(600);
body = await page.innerText("body");
check("CLEARANCE möter besökaren direkt", /Jag heter CLEARANCE/i.test(body));
check("den ber om grunduppgifter, inte om ett namn i taget", /grunduppgifter/i.test(body));
check("gamla portalfrågan är borta", !/Vad vill du göra\?/.test(body));
check("gamla en-fråga-i-taget-rutan är borta", (await page.locator("#onboarding-input").count()) === 0);

// Tre fält, samtidigt.
check("fältet för namn finns", (await page.locator("#onboarding-name").count()) === 1);
check("fältet för företagsnamn finns", (await page.locator("#onboarding-company").count()) === 1);
check("fältet för organisationsnummer finns", (await page.locator("#onboarding-org").count()) === 1);
check("fältet för e-post finns", (await page.locator("#onboarding-email").count()) === 1);
// Lösenordet hör till nästa steg och ska inte ligga bland de fyra.
check("lösenordsfältet kommer först senare", (await page.locator("#onboarding-password").count()) === 0);
check("knappen heter Fortsätt", (await page.locator('button:has-text("Fortsätt")').count()) >= 1);

// Tonen: saklig, inte omhändertagande.
check("den gamla empatifrasen är borta", !/Du är inte ensam/i.test(body));
check("ingen talar om att det är överväldigande", !/överväldigande/i.test(body));
check("situationen normaliseras sakligt", /Många företag hamnar någon gång/.test(body));

// Fortsätt är låst tills det finns något att fortsätta med.
check("Fortsätt är låst utan uppgifter", await page.locator('button:has-text("Fortsätt")').first().isDisabled());

// 2. Organisationsnumret slår mot registret och fyller i.
await page.fill("#onboarding-name", "Erik Andersson");
await page.fill("#onboarding-email", "erik@demobolaget.se");
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

// 3. Fortsätt: bekräftelse, sedan lösenordet i ett eget, maskerat fält.
await page.click('button:has-text("Fortsätt")');
await page.waitForTimeout(700);
body = await page.innerText("body");
check("bekräftelsen använder förnamnet", /Tack Erik\./.test(body));
check("bekräftelsen nämner bolaget och numret", /Demobolaget AB \(556012-3456\)/.test(body));
check("bekräftelsen lovar struktur, inte tröst", /skapa struktur/.test(body) && /dokumentera situationen/.test(body));
check("man får veta att man kan pausa", /pausa/.test(body));
check("nu ombeds man välja ett lösenord", /Välj ett lösenord/.test(body));
check("lösenordsfältet finns", (await page.locator("#onboarding-password").count()) === 1);
// Ett lösenord i en chattbubbla syns för alla som står bakom.
check(
  "lösenordet maskeras",
  (await page.getAttribute("#onboarding-password", "type")) === "password",
);
check(
  "kontot skapas inte med ett för kort lösenord",
  await page.locator('button:has-text("Skapa konto")').first().isDisabled(),
);

await page.fill("#onboarding-password", "hemligt-nog-123");
await page.click('button:has-text("Skapa konto")');
await page.waitForTimeout(1200);
body = await page.innerText("body");
check("kontot kvitteras", /Konto skapat/.test(body));
check("lösenordet ekas aldrig tillbaka i samtalet", !/hemligt-nog-123/.test(body));
check("arbetet börjar direkt", /Jag börjar nu skapa en bild av företaget/.test(body));
check("processen visas i fast ordning", /Konto och företagsuppgifter/.test(body)
  && /Nuläget i korthet/.test(body) && /Om verksamheten/.test(body)
  && /Första analysen/.test(body)
  && /Tidskritiska händelser/.test(body) && /Dokumentinsamling/.test(body));
check("steg 1 är avbockat", /Konto och företagsuppgifter\s*–\s*klart/.test(body));
check("nu ställs EN fråga, märkt med sitt steg", /Steg 2 av 6/.test(body));
check("situationsvalen visas", /Jag är orolig för ekonomin/.test(body));

await page.click('button:has-text("Jag är orolig för ekonomin")');
await page.waitForTimeout(900);
body = await page.innerText("body");
check("intervjun börjar med en förklaring", /gör att analysen handlar om ert bolag/.test(body));
check("inget tomt beröm i introduktionen", !/Bra jobbat|Du gör rätt/i.test(body));

// 3b. Bakgrundsarbetet: pågår parallellt, och ljuger inte.
check("bakgrundspanelen visas", (await page.locator('section[aria-label="Bakgrundsanalys"]').count()) === 1);
const disclosure = await page.locator('section[aria-label="Bakgrundsanalys"]').innerText();
check(
  "insamlingen beskrivs med den avtalade meningen",
  /Jag samlar in relevant offentlig information om företaget och kombinerar den med det du berättar/.test(disclosure),
  disclosure.slice(0, 200),
);
check(
  "ingenstans står att systemet tar in all information det kan",
  !/all(?:\s+den)?\s+information\s+(?:den|som)\s+kan/i.test(body),
);

// 3c. Intervjun: en fråga i taget, med ett skäl, och en profil som fylls.
check("intervjun märker var man är", /fråga 1 av \d+/i.test(body), (body.match(/fråga \d+ av \d+/i) ?? [""])[0]);
check("första frågan är antalet personer", /Hur många personer arbetar i företaget\?/.test(body));
check("frågan säger varför den ställs", /Antalet styr vad som händer/.test(body));
check("det går att hoppa över en fråga", /Hoppa över frågan/.test(body));

// ATT HOPPA ÖVER MÅSTE FAKTISKT GÅ VIDARE.
//
// Knappen lagrade tomt svar, och motorn läste tomt som obesvarat: samma
// fråga kom tillbaka i evighet och användaren satt fast. En återvändsgränd
// mitt i introduktionen, alltså precis det produkten inte får ha.
const questionNow = async () => {
  const t = await page.locator('section[aria-label="Samtal med CLEARANCE"]').innerText();
  return (t.match(/fråga \d+ av \d+/i) ?? [""])[0];
};
{
  const before = await questionNow();
  await page.click('button:has-text("Hoppa över frågan")');
  await page.waitForTimeout(500);
  const after = await questionNow();
  check("att hoppa över en fråga går vidare", before !== after, `${before} -> ${after}`);
  // Och den överhoppade frågan får inte dyka upp igen längre fram.
  await page.click('button:has-text("Hoppa över frågan")');
  await page.waitForTimeout(500);
  const third = await questionNow();
  check("två hopp i rad går också vidare", after !== third, `${after} -> ${third}`);
  check(
    "den första frågan kommer inte tillbaka",
    !/Hur många personer arbetar/.test(await page.innerText("body")),
  );
}

// Två frågor är överhoppade; nu står vi på den tredje.
await page.click('button:has-text("Varor")');
await page.waitForTimeout(400);
body = await page.innerText("body");
check("nästa fråga kommer", /fråga 4 av/i.test(body), (body.match(/fråga \d+ av \d+/i) ?? [""])[0]);
check("profilen går att öppna", /Det här har jag förstått hittills/.test(body));
await page.click('button:has-text("Det här har jag förstått hittills")');
await page.waitForTimeout(300);
body = await page.innerText("body");
check("profilen visar de nio fälten", /Bransch/.test(body) && /Digital mognad/.test(body) && /Tillväxtfas/.test(body));
check("okända fält står som okända", /okänd/.test(body));

// Svara resten: klicka första alternativet tills frågorna tar slut.
for (let i = 0; i < 20; i++) {
  const remaining = await page.locator("text=/fråga \\d+ av \\d+/").count();
  if (remaining === 0) break;
  const chips = page.locator('section[aria-label="Samtal med CLEARANCE"] .flex.flex-wrap.gap-2 > button');
  if ((await chips.count()) === 0) break;
  await chips.first().click();
  await page.waitForTimeout(250);
}
await page.waitForTimeout(600);
body = await page.innerText("body");

// 3d. Första analysen: förankrad, och ärlig om vad den inte är.
check("första analysen visas", (await page.locator('section[aria-label="Första analysen"]').count()) === 1);
const first = await page.locator('section[aria-label="Första analysen"]').innerText();
check("den säger vad den förstått", /Demobolaget AB/.test(first), first.slice(0, 160));
check("observationerna är förankrade i svaren", /Du svarade/.test(first));
check("möjlighetsavsnittet finns", /Det som talar för er/i.test(first));
check("den säger vad den INTE är", /Det här säger analysen inte/i.test(first));
check(
  "den lovar ingen bedömning av betalningsförmågan",
  /inte en bedömning av betalningsförmågan/.test(first),
);
check("den leder vidare", (await page.locator('a:has-text("Gör nulägesanalysen")').count()) >= 1);

// 3e. Premium sist. Numret efterfrågades aldrig under intervjun.
check("SMS-erbjudandet kommer efter analysen", /SMS-aviseringar/.test(body));
check("det säger vilka nivåer det ingår i", /Professional och Enterprise/.test(body));
check("det går att tacka nej", /Inte nu/.test(body));
await page.click('button:has-text("Inte nu")');
await page.waitForTimeout(300);
body = await page.innerText("body");
check("ett nej möts utan påtryckning", /Ingen fara/.test(body));

await page.click('button:has-text("Gå vidare till nulägesanalysen")');
await page.waitForTimeout(700);
body = await page.innerText("body");
check("avslutet är förankrat i det användaren lämnade", /har vi ett underlag att arbeta vidare från/.test(body));

// "Förbered användaren": vybytet sker av sig självt, och då ska de fyra
// frågorna vara besvarade INNAN vyn byts - inte efteråt.
check("övergången säger vad som blev klart", /Det här är klart/i.test(body));
check("övergången säger vad som händer nu", /Nu händer detta/i.test(body));
check("övergången säger varför vi frågar", /Därför frågar vi/i.test(body));
check("övergången säger hur lång tid det tar", /Så lång tid tar det/i.test(body));
check("övergången säger vem som ser uppgifterna", /Vem ser uppgifterna/i.test(body));
check("tidsangivelsen är konkret, inte 'det går snabbt'", /fem minuter/i.test(body));
check(
  "den som redan läst kan gå vidare direkt",
  (await page.locator('button:has-text("Öppna nulägesanalysen")').count()) === 1,
);

// Pausen före nulägesanalysen rymmer nu även övergångsrutan.
await page.waitForTimeout(5400);
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
