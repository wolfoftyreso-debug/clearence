/**
 * KONTROLLBALANSRÄKNINGEN PÅ SKÄRMEN.
 *
 * ABL 25:13 är produktens tyngsta bedömning, och den hade ingen egen
 * webbläsarsvit. Regeln bodde dessutom i komponenten, så den gick inte att
 * pröva utanför en webbläsare heller - den var alltså den minst provade
 * delen av hela produkten.
 *
 * DET SOM FANNS BAKOM DEN LUCKAN:
 *
 * Panelen visade "KBR ej nödvändig" med en grön bock så fort de tre
 * fälten hade något i sig. Regeln svarar "not_required" också när
 * underlaget INTE RÄCKER - och ett bolag med noll i tillgångar och
 * 400 000 i skulder (eget kapital minus 400 000, det mest kritiska läge
 * som finns) fick därför ett godkännande.
 *
 * "Vi vet inte" och "allt är bra" är olika besked. Sviten nedan kräver att
 * de ser olika ut, och att stegen i lagen visas i rätt ordning.
 */
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const { chromium } = pw;
const BASE = process.argv[2] ?? "http://127.0.0.1:4310";

let passed = 0;
let failed = 0;
const check = (namn, ok, extra = "") => {
  if (ok) {
    passed += 1;
    console.log(`PASS ${namn}`);
  } else {
    failed += 1;
    console.log(`FAIL ${namn} ${extra}`);
  }
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
page.setDefaultTimeout(30000);
await page.goto(`${BASE}/kbr`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1800);

/*
 * SIDAN ÄR EN GUIDE I FYRA STEG, och balansräkningen är det tredje.
 *
 * Ett prov som går rakt till /kbr och letar efter beloppsfält hittar noll,
 * och blir grönt på varje "detta ska INTE synas"-rad - för ingenting syns.
 * Just den fällan gillrade sig själv här: raden "noll i tillgångar ger
 * inget godkännande" var grön på en tom sida.
 */
check("steg 1 är målvalet", /Steg 1 av 4/.test(await page.innerText("body")));
await page.click('button:has-text("Ordna upp och fortsätta")');
await page.waitForTimeout(400);
await page.click('button:has-text("Nästa")');
await page.waitForTimeout(800);

check("steg 2 är företagsidentiteten", /Steg 2 av 4/.test(await page.innerText("body")));
await page.fill('input[placeholder="XXXXXX-XXXX"]', "5560123456");
await page.waitForTimeout(1800);
await page.click('button:has-text("Nästa")');
await page.waitForTimeout(900);

check("steg 3 är balansräkningen", /Steg 3 av 4/.test(await page.innerText("body")));

/** Fyller de tre fälten och läser panelen. */
const provaMed = async (aktiekapital, tillgangar, skulder) => {
  const falt = page.locator('input[inputmode="numeric"]');
  const antal = await falt.count();
  if (antal < 3) return { text: "", antal };
  // Fälten står i ordningen aktiekapital, tillgångar, skulder.
  for (const [i, varde] of [aktiekapital, tillgangar, skulder].entries()) {
    await falt.nth(i).fill("");
    await falt.nth(i).type(varde, { delay: 5 });
  }
  await page.waitForTimeout(700);
  return { text: await page.innerText("body"), antal };
};

const forst = await provaMed("50 000", "500 000", "100 000");
check("KBR-sidan har de tre beloppsfälten", forst.antal >= 3, `hittade ${forst.antal}`);

/* --- Stegen i ABL 25:13 ------------------------------------------------- */

check(
  "eget kapital över aktiekapitalet: ingen KBR krävs",
  /KBR ej nödvändig/.test(forst.text),
  forst.text.slice(0, 200),
);

// Eget kapital 30 000, aktiekapital 50 000: över hälften, under helt.
const bevaka = await provaMed("50 000", "130 000", "100 000");
check("mellan hälften och helt: bevaka situationen", /Bevaka situationen/.test(bevaka.text));

// Eget kapital 20 000 av 50 000: under hälften.
const kravs = await provaMed("50 000", "120 000", "100 000");
check("under hälften: KBR krävs", /KBR krävs/.test(kravs.text));
check("och lagrummet står utskrivet", /25 kap\. 13 §/.test(kravs.text));

// Negativt eget kapital.
const kritiskt = await provaMed("50 000", "80 000", "100 000");
check("negativt eget kapital: kritiskt läge", /Kritiskt läge/.test(kritiskt.text));

/* --- Och det som faktiskt var trasigt ----------------------------------- */

/*
 * NOLL TILLGÅNGAR ÄR INTE ETT GODKÄNNANDE.
 *
 * Det här är fallet som visade grön bock. Bolaget har inga tillgångar och
 * 400 000 i skulder; regeln kan inte räkna, och då ska produkten säga att
 * den inte kan räkna - inte att allt är i sin ordning.
 */
const utanUnderlag = await provaMed("50 000", "0", "400 000");
check(
  "noll i tillgångar ger INGET godkännande",
  !/KBR ej nödvändig/.test(utanUnderlag.text),
  utanUnderlag.text.slice(0, 300),
);
check(
  "utan underlag säger produkten det rakt ut",
  /Underlaget räcker inte för en bedömning/.test(utanUnderlag.text),
  utanUnderlag.text.slice(0, 300),
);

// Samma sak när aktiekapitalet saknas.
const utanAktiekapital = await provaMed("0", "500 000", "100 000");
check(
  "noll i aktiekapital ger inget godkännande heller",
  !/KBR ej nödvändig/.test(utanAktiekapital.text) &&
    /Underlaget räcker inte/.test(utanAktiekapital.text),
  utanAktiekapital.text.slice(0, 300),
);

/*
 * OCH ATT SVITEN KAN SE SKILLNAD.
 *
 * Blev varje läge "Underlaget räcker inte" hade raderna ovan varit gröna
 * på en trasig sida.
 */
const igen = await provaMed("50 000", "500 000", "100 000");
check(
  "med underlag kommer bedömningen tillbaka",
  /KBR ej nödvändig/.test(igen.text) && !/Underlaget räcker inte/.test(igen.text),
  igen.text.slice(0, 200),
);

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
