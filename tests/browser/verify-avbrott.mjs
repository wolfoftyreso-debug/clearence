/**
 * SVITEN SOM AVBRYTER.
 *
 * De andra sviterna kör flöden i ett svep, från första klicket till
 * sista. Ingen av dem laddar om sidan mitt i - och därför märkte ingen
 * av dem att introduktionssamtalet, produktens längsta sammanhängande
 * arbete, saknade autospar. Femton frågor i en telefon, och en
 * skärmlåsning räckte för att kasta bort alltihop.
 *
 * Den här sviten gör bara en sak: den avbryter. Den laddar om mitt i
 * intervjun och mitt i nulägesanalysen, och kräver att arbetet finns
 * kvar - och att användaren FÅR VETA att det finns kvar. Mobilvyn,
 * eftersom det är där avbrotten sker.
 *
 * Den vaktar också två löften till:
 *  - startsidans "fortsätt samtalet där ni slutade" måste leda tillbaka
 *    till samtalet, inte till en tom vy,
 *  - och utloggningen måste städa det avbrutna samtalet, som innehåller
 *    ett personnamn, ett organisationsnummer och svar om ett bolags
 *    ekonomiska problem.
 *
 * Varje avsnitt kör i en EGEN flik. Ett avsnitt som ärver föregående
 * inloggning testar inte det det tror sig testa.
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

/** Ny flik i mobilvy - det är där en flik låser sig, byter app eller återvinns. */
const nyFlik = async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(30000);
  return p;
};

const samtalet = (p) => p.locator('section[aria-label="Samtal med CLEARANCE"]');
/* Svarsknapparna i intervjun. Att sikta på "alla knappar i main" hade
   träffat menyn och footern - och en svit som klickar fel hittar inget. */
const alternativ = (p) => samtalet(p).locator("div.mt-2\\.5 button");

/** Kör onboardingen fram till första intervjufrågan. */
const tillIntervjun = async (p) => {
  await p.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1200);
  await p.click('button:has-text("Kom igång")');
  await p.waitForTimeout(500);
  await p.fill("#onboarding-name", "Erik Andersson");
  await p.fill("#onboarding-email", "erik@demobolaget.se");
  await p.fill("#onboarding-org", "5560123456");
  await p.waitForTimeout(1800);
  await p.click('button:has-text("Fortsätt")');
  await p.waitForTimeout(700);
  await p.fill("#onboarding-password", "hemligt-nog-123");
  await p.click('button:has-text("Skapa konto")');
  await p.waitForTimeout(1600);
  await samtalet(p).locator('button:has-text("Jag är orolig för ekonomin")').first().click();
  await p.waitForTimeout(1000);
};

/**
 * Svara på n frågor. Returnerar hur många som faktiskt BESVARADES.
 *
 * Skillnaden mellan klick och svar är hela poängen med räknaren. Flera
 * svar får vara sanna samtidigt - en bilverkstad säljer ofta halva arbete
 * och halva reservdelar - och ett flerval bekräftas med en egen knapp. Ett
 * klick på alternativet växlar bara valet.
 *
 * Utan bekräftelsen räknade den här hjälparen fem KLICK som fem svar,
 * medan posten bara innehöll två. Provet blev grönt på "fem frågor
 * besvarade" och rött först på siffran användaren får se efter
 * omladdningen - alltså rätt larm, men på fel rad.
 */
const svara = async (p, n) => {
  let given = 0;
  for (let i = 0; i < n; i++) {
    if (!(await alternativ(p).count())) break;
    await alternativ(p).first().click();
    await p.waitForTimeout(300);
    const bekrafta = samtalet(p).locator('button:has-text("Svara")');
    if (await bekrafta.count()) {
      await bekrafta.first().click();
    }
    await p.waitForTimeout(700);
    given++;
  }
  return given;
};

const fragan = (text) => (text.match(/fråga (\d+) av (\d+)/i) ?? [])[0];

/* --- 1. Omladdning mitt i intervjun --------------------------------------- */

const a = await nyFlik();
await tillIntervjun(a);
const given = await svara(a, 5);
check("fem frågor besvarade före avbrottet", given === 5, String(given));
const innan = await samtalet(a).innerText();
const fragaInnan = fragan(innan);
check("intervjun hade kommit till en fråga", !!fragaInnan, innan.slice(-200));

// Avbrottet: precis det en låst skärm eller en återvunnen flik gör.
await a.reload({ waitUntil: "domcontentloaded" });
await a.waitForTimeout(2000);

const efter = (await samtalet(a).count()) ? await samtalet(a).innerText() : "";
check("samtalet finns kvar efter omladdningen", efter.length > 0);
check(
  "välkomsten möter INTE den som var mitt i intervjun",
  !/Kom igång/i.test(efter),
  efter.slice(0, 200),
);
check("frågan är densamma som före avbrottet", fragan(efter) === fragaInnan,
  `${fragaInnan} → ${fragan(efter)}`);

// Att arbetet finns kvar räcker inte: användaren ska se det.
check("användaren får veta att samtalet sparats", /sparat samtalet/i.test(efter), efter.slice(0, 200));
check("och var det sparats", /lokalt i din webbläsare/i.test(efter));
check("och hur många svar som finns kvar", /Dina 5 svar finns kvar/i.test(efter), efter.slice(0, 300));
check("profilen är också kvar", /förstått hittills \([1-9] av 9\)/i.test(efter), efter.slice(-300));

// Ett återupptaget samtal går att komma ur. Utan det vore
// återupptagningen en låsning i stället för en tjänst.
check("det går att börja om",
  (await samtalet(a).locator('button:has-text("Börja om från början")').count()) === 1);
check("det går att bara fortsätta",
  (await samtalet(a).locator('button:has-text("Fortsätt")').count()) >= 1);

// Och samtalet fungerar vidare: nästa svar landar där det ska.
await alternativ(a).first().click();
await a.waitForTimeout(800);
check("intervjun går vidare efter avbrottet",
  fragan(await samtalet(a).innerText()) !== fragaInnan);

/* --- 2. Startsidans löfte -------------------------------------------------- */

// Den som laddar om är inloggad. Rutan "fortsätt samtalet där ni
// slutade" fick förr företräde och ledde till en vy utan spår av
// intervjun - ett löfte sidan inte kunde hålla.
const body = await a.innerText("body");
check(
  "återvändarrutan tar inte över ett pågående samtal",
  !/CLEARANCE har läget klart/i.test(body),
  (body.match(/.{0,60}läget klart.{0,60}/i) ?? [""])[0],
);

/* --- 3. Börja om raderar posten -------------------------------------------- */

await a.reload({ waitUntil: "domcontentloaded" });
await a.waitForTimeout(1800);
await samtalet(a).locator('button:has-text("Börja om från början")').first().click();
await a.waitForTimeout(600);
const omstart = await samtalet(a).innerText();
check("börja om leder till välkomsten", /Kom igång/i.test(omstart), omstart.slice(0, 200));
check("de gamla svaren är borta ur samtalet", !/Dina \d+ svar finns kvar/i.test(omstart));
check("och posten är raderad",
  await a.evaluate(() => localStorage.getItem("clearance-onboarding-pagaende") === null));

/* --- 4. Utloggningen städar spåren ----------------------------------------- */

const b = await nyFlik();
await tillIntervjun(b);
await svara(b, 3);
await b.waitForTimeout(400);
check("samtalet ligger i webbläsaren medan det pågår",
  await b.evaluate(() => localStorage.getItem("clearance-onboarding-pagaende") !== null));

// Läsinställningen ska däremot överleva: den säger något om hur en
// människa vill läsa, inte något om ett bolag.
await b.evaluate(() => localStorage.setItem("clearance-language-level", "enkel"));

/*
 * UTLOGGNINGEN GÖRS FRÅN INSTÄLLNINGARNA, inte från sidhuvudets meny.
 *
 * Menyn låg tidigare i vägen: samtalets helskärmsläge täcker sidhuvudet,
 * och fyra försök att ta sig förbi överlägget - fälla ihop, rulla till
 * toppen, klicka i DOM:en - gav alla samma resultat. Att fortsätta slåss
 * med den ytan hade varit att låta testet handla om något annat än det
 * det heter.
 *
 * Det här testet handlar om att UTLOGGNINGEN STÄDAR POSTEN. Inställningarna
 * har en egen utloggningsknapp, på en sida utan överlägg, och den kör
 * samma signOut. Påståendet blir därmed prövat på riktigt i stället för
 * att vara rött av ett skäl som inte rör det.
 */
await b.goto(`${BASE}/dashboard/installningar`, { waitUntil: "domcontentloaded" });
await b.waitForTimeout(1600);
check(
  "posten finns kvar när inställningarna öppnas",
  await b.evaluate(() => localStorage.getItem("clearance-onboarding-pagaende") !== null),
);
await b.locator('button:visible:has-text("Logga ut")').first().click();
await b.waitForTimeout(1800);
check("utloggningen städar det avbrutna samtalet",
  await b.evaluate(() => localStorage.getItem("clearance-onboarding-pagaende") === null));
check("men läsinställningen står kvar",
  await b.evaluate(() => localStorage.getItem("clearance-language-level") === "enkel"));

/* --- 5. Omladdning i nulägesanalysen (autosparet som redan fanns) ---------- */

const c = await nyFlik();
await c.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await c.waitForTimeout(900);
await c.click('button:has-text("Demo – Företag")');
await c.waitForTimeout(2200);
await c.goto(`${BASE}/wizard`, { waitUntil: "domcontentloaded" });
await c.waitForTimeout(1500);
await c.locator('main button:has-text("6-10")').first().click();
await c.waitForTimeout(900);
await c.reload({ waitUntil: "domcontentloaded" });
await c.waitForTimeout(1800);
const wizard = await c.locator("main").innerText();
check("nulägesanalysen sparar också", /sparat det du fyllde i/i.test(wizard), wizard.slice(0, 200));
check("och erbjuder att börja om", /Börja om från början/i.test(wizard));

// Ett avbrott får inte lämna en skärm där man inte kan göra något och
// inte får veta varför. Samma regel som i verify-atervandsgrander.
const nasta = c.locator('main button:has-text("Nästa")').first();
if ((await nasta.count()) && (await nasta.isDisabled())) {
  check("den låsta knappen säger varför", /för att gå vidare/i.test(wizard), wizard.slice(0, 400));
} else {
  check("knappen är öppen efter återupptagningen", true);
}

console.log(`\n${passed} passed, ${failed} failed`);
await browser.close();
if (failed > 0) process.exit(1);
