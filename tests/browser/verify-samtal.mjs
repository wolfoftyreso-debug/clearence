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
await page.waitForTimeout(1200);
body = await page.innerText("body");
// Ärendeminnet: KBR är gjord i demoseeden, så CLEARANCE hoppar över frågan.
check("minnet hoppar över KBR-frågan", /hoppar jag över/i.test(body));
check("bedömningen återger beloppet", /150 000 kr/.test(body));
check("lagrummet nämns", /59 kap/.test(body));
check("rådgivningsgränsen står i svaret", /stäm av med/i.test(body));
check("källmärkningen visar underlaget", /Tolkning utifrån uppgifterna du lämnat/i.test(body));
check("allvarsgraden visas", /Kritiskt läge/i.test(body));

// 3b. Konstitutionen i gränssnittet: bekräftelsen kom före frågorna,
// motiveringen ligger bakom en länk, aldrig fler än tre steg.
check("bekräftelsen kom före frågorna", /pressande situation/i.test(body));
check("hela motiveringen ligger bakom en länk", /Visa hela motiveringen/i.test(body));

// 3c. Conversation UI: bedömningen bär lägesbild, mätare och tidslinje.
check("lägesbilden i bedömningen", /Skattefristen/i.test(body) && /Företrädaransvaret prövas mot förfallodagen/i.test(body));
check("mätaren med stapel och tal", /Väntade kundinbetalningar mot bristen/i.test(body) && /0 %/.test(body));
check("processtidslinjen", /Före förfallodagen/i.test(body) && /Uppföljning mot likviditetsplanen/i.test(body));

// 4. Protokollför beslutet.
await page.click('button:has-text("Protokollför med premiss")');
await page.waitForTimeout(1000);
body = await page.innerText("body");
check("beslutet bekräftas", /protokollfört/i.test(body));
check("beslutet listas med premiss", /Fattade beslut/i.test(body) && /Beslutet vilar på uppgifterna i samtalet/i.test(body));

// 4a. Sessionsavslutet: kvittot på vad som gjordes.
await page.click('button:has-text("Avsluta samtalet")');
await page.waitForTimeout(600);
body = await page.innerText("body");
// Kvittot ska räkna upp vad som GJORDES - inte berömma den som gjorde
// det. Kontrollen är därför formulerad som principen, inte som en exakt
// mening: den ska överleva en omskrivning men fånga att berömmet smyger
// tillbaka. Se docs/conversation-constitution.md och tests/tone.ts.
check("avslutet kvitterar arbetet", /vad vi har gjort/i.test(body) && /protokollfört beslutet/i.test(body));
check("avslutet berömmer inte användaren", !/bra (jobbat|arbetat)|du gör rätt|duktig/i.test(body));
check("avslutet lovar kontinuitet", /börjar vi där vi slutade/i.test(body));

// 4b. Minnet: CLEARANCE följer upp beslutet mot premissen vid nästa besök.
await page.goto(`${BASE}/dashboard/samtal`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("CLEARANCE följer upp beslutet", /Är det fortfarande planen\?/.test(body) && /150 000 kr/.test(body));
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
check("fallbacken guidar genom nulägesanalysen", /Jag guidar dig genom nulägesanalysen/i.test(body));
await page.waitForTimeout(2600);
check("rådgivaren öppnar analysen själv", page.url().includes("/wizard"));

// 7a2. "Jag har slut på pengar" är inget okänt - det är likviditetsflödet.
await page.goto(`${BASE}/dashboard/samtal`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
await page.fill("#samtal-input", "Jag har slut på pengar");
await page.click('button[aria-label="Skicka"]');
await page.waitForTimeout(700);
body = await page.innerText("body");
check("slut på pengar startar likviditetsflödet", /pengarna räcker inte/i.test(body) && /Hur mycket finns tillgängligt på kontot/i.test(body));
await page.goto(`${BASE}/dashboard/samtal`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
check("snabbvalen har likviditetschippen", (await page.locator('button:has-text("Pengarna räcker inte")').count()) > 0);

// 7b2. Fakturafrågan gäller abonnemanget - inte kundflödet.
await page.goto(`${BASE}/dashboard/samtal`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
await page.fill("#samtal-input", "Visa min senaste faktura");
await page.click('button[aria-label="Skicka"]');
await page.waitForTimeout(800);
body = await page.innerText("body");
check("fakturafrågan startar inte kundflödet", !/obetalda fordran/i.test(body));
check("fakturasvaret pekar på Inställningar", /Ingen faktura är utställd ännu|Alla fakturor och kvitton/i.test(body));
// Fakturans PDF öppnas direkt i samtalet - samma dokument som Inställningar.
if (await page.locator('button:has-text("Öppna PDF")').count()) {
  await page.click('button:has-text("Öppna PDF")');
  await page.waitForTimeout(900);
  const dialog = await page.locator('[role="dialog"][aria-label="Rapport"]').innerText();
  check("fakturans PDF öppnas i samtalet", /Faktura/i.test(dialog) && /Ladda ner PDF/i.test(dialog));
  // Dokumentet renderas i en iframe (srcDoc) - läs innehållet därifrån.
  const doc = await page.frameLocator('[role="dialog"] iframe').locator("body").innerText();
  check("fakturadokumentet bär säljaren", /Landvex/i.test(doc) && /moms/i.test(doc), doc.slice(0, 120));
  await page.click('button:has-text("Stäng")').catch(() => page.keyboard.press("Escape"));
  await page.waitForTimeout(400);
} else {
  check("fakturans PDF öppnas i samtalet", false, "Öppna PDF-knappen saknas");
  check("fakturadokumentet bär säljaren", false);
}

// 7c. Lägesbilden i hälsningen: visad, inte påstådd - med analys som panel.
await page.goto(`${BASE}/dashboard/samtal`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
body = await page.innerText("body");
check("hälsningens lägesbild har områdena", /Likviditet/i.test(body) && /Frister/i.test(body) && /Dokumentation/i.test(body));
check("analysempanelen finns i samtalet", /Visa analys/.test(body));
// Tydlighetsronden: identitet, sektionsrubriker och morgonbriefingen.
check("CLEARANCE har namn i rubriken", /CLEARANCE – din krisrådgivare/i.test(body));
check("lägesbilden har rubrik och källa", /Läget just nu/i.test(body) && /ur ärendets registrerade uppgifter/i.test(body));
check("Det viktigaste nu är numrerat", /Det viktigaste nu/i.test(body) && (await page.locator('ol a:has-text("kontrollbalansbedömningen"), ol a:has-text("handlingsplanen"), ol a:has-text("pengarna räcker")').count()) > 0);
// CTA mot nuläge: lägesraderna är platta (inte klickbara kort), medan
// prioriteterna bär accentram och pil - det ska SYNAS vad som är handling.
const snapshotBordered = await page.evaluate(() => {
  const heading = [...document.querySelectorAll("h3")].find((h) => /Läget just nu/i.test(h.textContent ?? ""));
  const list = heading?.closest("div")?.parentElement?.querySelector("ul");
  if (!list) return null;
  return [...list.querySelectorAll("li")].some((li) => getComputedStyle(li).borderTopWidth !== "0px" && getComputedStyle(li).borderLeftWidth !== "0px");
});
check("nuläget är platt - inga kortramar att vilja klicka på", snapshotBordered === false, String(snapshotBordered));
const ctaAccent = await page.locator('ol a[class*="border-accent"]').count();
check("prioriteterna ser klickbara ut (accentram)", ctaAccent > 0, String(ctaAccent));
check("chipsen har ledtext", /Eller välj det som stämmer bäst/i.test(body));
// Ärendeminnet i hälsningen: sedan sist ur journalen + öppen arbetsmodell.
check("sedan sist-briefingen visas", /Sedan vi pratades vid har följande hänt/i.test(body));
check("beslutet syns i briefingen", /Beslut protokollfört/i.test(body) || /beslut omprövades/i.test(body));
await page.click('summary:has-text("Vad jag vet om ditt företag")');
await page.waitForTimeout(400);
body = await page.innerText("body");
check("arbetsmodellen visar bolaget med källa", /Demobolaget AB/i.test(body) && /ur nulägesanalysen/i.test(body));
check("arbetsmodellen visar personerna", /Personerna kring bolaget/i.test(body));
check("arbetsmodellen kan rättas", /säg till, så uppdaterar vi den/i.test(body));
await page.click('summary:has-text("Visa analys")');
await page.waitForTimeout(400);
body = await page.innerText("body");
check("panelens mätare visar täckningsgraden", /Skuldtäckning vid snabb avyttring/i.test(body) && /%/.test(body));

// 7b. Handlingsalternativen: CLEARANCE svarar med hållningen och navigerar själv.
await page.goto(`${BASE}/dashboard/samtal`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
await page.click('button:has-text("Vilka alternativ har jag?")');
await page.waitForTimeout(800);
body = await page.innerText("body");
check("CLEARANCE svarar med hållningen", /flera vägar framåt/i.test(body));
await page.waitForTimeout(2000);
check("alternativvyn öppnades", page.url().includes("/dashboard/alternativ"));
body = await page.innerText("body");
check("vägarna visas med status", /Företagsrekonstruktion/i.test(body) && /Konkurs/i.test(body) && /Brådskande|Öppen|Smalnar/i.test(body));
check("katalogens fyra kategorier", /Kassaflöde/i.test(body) && /Intäkter/i.test(body) && /Finansiering/i.test(body) && /Kostnader/i.test(body));
check("ingen förutbestämd utgång", /aktivt val/i.test(body));
check("rådgivningsgränsen står på sidan", /stäms av med revisor/i.test(body));

// 7d. Action Contract: bjuda in revisorn - hela mejlet före, kvittot efter.
await page.goto(`${BASE}/dashboard/samtal`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
await page.fill("#samtal-input", "Jag behöver min revisor");
await page.click('button[aria-label="Skicka"]');
await page.waitForTimeout(600);
body = await page.innerText("body");
check("kontraktet ber om adressen med länkregeln", /Vilken e-postadress har din revisor/i.test(body) && /exakt den adressen/i.test(body));
await page.fill("#samtal-input", "inte en adress");
await page.click('button[aria-label="Skicka"]');
await page.waitForTimeout(500);
body = await page.innerText("body");
check("ogiltig adress avvisas vänligt", /ser inte ut som en e-postadress/i.test(body));
await page.fill("#samtal-input", "bjorn@revision.se");
await page.click('button[aria-label="Skicka"]');
await page.waitForTimeout(800);
body = await page.innerText("body");
check("förstå-steget citerar adress och roll", /Jag uppfattar att du vill bjuda in bjorn@revision.se/i.test(body));
check("kontrollera-steget visar gränserna", /Jag ändrar ingenting i ärendet/i.test(body));
check("hela mejlet visas före utskick", /Till: bjorn@revision.se/i.test(body) && /Inbjudan till ärendet för Demobolaget AB/i.test(body) && /personlig länk – skapas vid utskicket/i.test(body));
await page.click('button:has-text("Skicka inbjudan")');
await page.waitForTimeout(1000);
body = await page.innerText("body");
check("verifieringen kvitterar och pekar på Deltagare", /Inbjudan är skickad till bjorn@revision.se/i.test(body) && /journalförd/i.test(body));
await page.goto(`${BASE}/dashboard/deltagare`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
body = await page.innerText("body");
check("inbjudan syns under Deltagare", /bjorn@revision\.se/.test(body) && /Väntar på svar/i.test(body));
await page.goto(`${BASE}/dashboard/handelser`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
body = await page.innerText("body");
check("åtgärden är journalförd", /bjorn@revision\.se som revisor/i.test(body));

// 8. Onboardingen: en ny användare möts av CLEARANCE, inte av ett dashboard.
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
check("tomt läge pekar på CLEARANCE", /Prata med CLEARANCE/i.test(body));
await page.click('button:has-text("Prata med CLEARANCE")');
await page.waitForTimeout(1200);
body = await page.innerText("body");
check("CLEARANCE presenterar sig", /Jag heter CLEARANCE/i.test(body));
// Grunduppgifterna tas i ETT svep: tre fält, en knapp. Att stycka dem i
// tre turer var friktion utan förståelse.
check("de tre fälten visas samtidigt", (await page.locator("#onboarding-name").count()) === 1
  && (await page.locator("#onboarding-company").count()) === 1
  && (await page.locator("#onboarding-org").count()) === 1);
check("gamla en-fråga-i-taget-rutan är borta", (await page.locator("#onboarding-input").count()) === 0);
check("empatin är nedtonad", !/Du är inte ensam/i.test(body) && !/överväldigande/i.test(body));
check("situationen normaliseras sakligt", /Många företag hamnar någon gång/.test(body));
await page.fill("#onboarding-name", "Erik Andersson");
await page.fill("#onboarding-company", "Eriks Bygg AB");
await page.click('button:has-text("Fortsätt")');
await page.waitForTimeout(600);
body = await page.innerText("body");
check("namnet används sparsamt (förnamn, en gång)", /Tack Erik\./.test(body) && !/Erik Erik/.test(body));
check("bekräftelsen nämner bolaget", /Jag ser att vi nu arbetar med Eriks Bygg AB/.test(body));
check("processen visas i fast ordning", /Kontaktperson/.test(body) && /Dokumentinsamling/.test(body));
check("situationsvalen visas", /Steg 3 av 6/.test(body) && /orolig för ekonomin/i.test(body));
await page.click('button:has-text("Jag kan inte betala vissa fakturor")');
await page.waitForTimeout(800);
body = await page.innerText("body");
check("CLEARANCE navigerar själv", /Jag öppnar nu nulägesanalysen/i.test(body));
await page.waitForTimeout(3000);
check("nulägesanalysen öppnades", page.url().includes("/wizard"));

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
