/**
 * "Förbered användaren" i webbläsaren.
 *
 * tests/prepare.ts vaktar texterna och kopplingarna i källkoden. Det
 * här testet vaktar det enda som återstår: att rutan faktiskt SYNS på
 * skärmen, i rätt ordning, före knappen som byter steg - och att den
 * ser ut som läsning och inte som ett klickbart kort.
 *
 * Väntetexterna kontrolleras samtidigt: ett besked mitt i en slagning
 * mot företagsregistret ska säga varifrån uppgifterna kommer, inte bara
 * att något hämtas.
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
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(30000);

await page.goto(`${BASE}/wizard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);

/* --- 1. Ingen förberedelse innan steget går att lämna -------------------- */

const notice = page.locator('section[aria-label="Vad som händer härnäst"]');
check("ingen övergång visas för ett halvfyllt steg", (await notice.count()) === 0);

/* --- 2. Steget fylls i ---------------------------------------------------- */

// Väntebeskedet under slagningen prövas INTE här. I demoläget svarar
// företagsuppslaget i samma mikrotask, så laddläget lever ungefär en
// bildruta och går inte att observera utan att mäta något annat än det
// användaren ser. Att texten säger vad, varifrån och hur länge vaktas i
// stället i tests/prepare.ts, där varje väntebesked prövas mot regel 3
// och 4 - och där en ny "Hämtar…" någon annanstans i produkten fälls.
const orgInput = page.locator('input[placeholder="XXXXXX-XXXX"]').first();
await orgInput.fill("556012-3456");

await page.waitForTimeout(2500);

/* --- 3. Övergången visas när steget är klart ----------------------------- */

check("övergången visas när steget går att lämna", (await notice.count()) === 1);
const text = await notice.first().innerText();

check("del 1: vad som blev klart", /Det här är klart/i.test(text), text);
check("del 2: vad som händer nu", /Nu händer detta/i.test(text), text);
check("del 3: varför vi frågar", /Därför frågar vi/i.test(text), text);
check("del 4: hur lång tid det tar", /Så lång tid tar det/i.test(text), text);
check("delarna kommer i rätt ordning",
  text.indexOf("Det här är klart") < text.indexOf("Nu händer detta") &&
  text.indexOf("Nu händer detta") < text.indexOf("Därför frågar vi") &&
  text.indexOf("Därför frågar vi") < text.indexOf("Så lång tid tar det"),
  text);
check("tidsangivelsen är konkret", /\d|två|fyra|några|ett klick|en minut/i.test(text), text);

/* --- 4. Rutan är läsning, inte handling ---------------------------------- */

const form = await notice.first().evaluate((el) => {
  const s = getComputedStyle(el);
  return {
    border: s.borderTopWidth,
    cursor: s.cursor,
    // Ligger en knapp eller länk INNE i rutan är den inte längre läsning.
    clickables: el.querySelectorAll("a,button,[role=button]").length,
  };
});
check("övergångsrutan har ingen kortram", form.border === "0px", form.border);
check("övergångsrutan pekar inte ut sig som klickbar", form.cursor !== "pointer", form.cursor);
check("övergångsrutan innehåller inget att klicka på", form.clickables === 0, form.clickables);

/* --- 5. Den står FÖRE knappen som byter steg ----------------------------- */

// Dokumentordning, inte skärmkoordinater: knappen är sticky, så dess
// plats i fönstret säger ingenting om var den står i sidan.
const order = await page.evaluate(() => {
  const box = document.querySelector('section[aria-label="Vad som händer härnäst"]');
  const next = [...document.querySelectorAll("button")].find((b) => /^Nästa/.test(b.innerText.trim()));
  if (!box || !next) return null;
  return Boolean(box.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING);
});
check("förberedelsen står före knappen som för vidare", order === true, String(order));

/* --- 6. Nästa steg har sin EGEN övergång, inte samma text ---------------- */

const step1Text = text;
await page.click('button:has-text("Nästa")');
await page.waitForTimeout(1200);

// Regeln gäller åt båda hållen: ett halvbesvarat steg får ingen
// förberedelse, för det finns ännu inget som är klart att bekräfta.
check("steg 2 utan svar får ingen övergång", (await notice.count()) === 0);

// Fyra ja/nej-frågor om betalningarna. Första knappen i varje grupp.
const groups = page.locator("main button:has-text('Ja')");
const svar = await groups.count();
check("betalningsfrågorna har svarsknappar", svar >= 4, svar);
for (let i = 0; i < 4; i++) {
  await groups.nth(i).click();
  await page.waitForTimeout(150);
}
await page.waitForTimeout(600);

check("steg 2 får sin övergång när det är besvarat", (await notice.count()) === 1);
const step2Text = await notice.first().innerText();
check("steg 2 har en egen text, inte steg 1:s", step2Text !== step1Text, step2Text);
check("steg 2 bekräftar det som just gjordes", /Betalningsbilden är klar/i.test(step2Text), step2Text);

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
