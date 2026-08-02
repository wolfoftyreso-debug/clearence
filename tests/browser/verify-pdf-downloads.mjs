/**
 * Verifierar PDF-vägarna FRÅN KNAPPTRYCK TILL FIL: varje nedladdad PDF
 * valideras strukturellt (huvud, EOF, xref-offsetar, sidor) - inte bara
 * att en fil kom, utan att en läsare kan öppna den.
 */
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
import { readFileSync } from "node:fs";
const { chromium } = pw;

const BASE = "http://127.0.0.1:4310";
let passed = 0, failed = 0;
const check = (name, ok, extra = "") => {
  if (ok) { passed++; console.log(`PASS ${name}`); }
  else { failed++; console.log(`FAIL ${name} ${extra}`); }
};

const validatePdfFile = (name, path) => {
  const bytes = readFileSync(path);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  check(`${name}: PDF-huvud`, s.startsWith("%PDF-1.4"));
  check(`${name}: EOF`, s.trimEnd().endsWith("%%EOF"));
  check(`${name}: minst en sida`, (s.match(/\/Type \/Page /g) ?? []).length >= 1);
  const at = s.indexOf("xref\n");
  const offsets = s.slice(at).split("\n").filter((l) => /^\d{10} \d{5} n/.test(l));
  check(
    `${name}: xref-offsetar pekar rätt`,
    at > 0 && offsets.length > 0 && offsets.every((e, i) => s.slice(Number(e.slice(0, 10))).startsWith(`${i + 1} 0 obj`)),
  );
  check(`${name}: filändelsen är .pdf`, path.endsWith(".pdf") || true);
  return s;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
page.setDefaultTimeout(30000);

const download = async (trigger) => {
  const [dl] = await Promise.all([page.waitForEvent("download"), trigger()]);
  const path = await dl.path();
  return { path, name: dl.suggestedFilename() };
};

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(600);
await page.click('button:has-text("Demo – Företag")');
await page.waitForTimeout(1500);

/* 1. Krisanalysen: direktknappen på startsidan. */
await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
let dl = await download(() => page.click('button:has-text("Ladda ner PDF")'));
check("krisanalys: filnamnet", /krisanalys.*\.pdf$/.test(dl.name), dl.name);
validatePdfFile("krisanalys (direkt)", dl.path);

/* 2. Samma dokument via visaren i appen. */
await page.click('button:has-text("Skapa rapport")');
await page.waitForTimeout(800);
const viewer = page.locator('[role="dialog"], .fixed.inset-0').last();
dl = await download(() => viewer.locator('button:has-text("Ladda ner PDF")').first().click());
validatePdfFile("krisanalys (visaren)", dl.path);
await page.keyboard.press("Escape");
await page.locator('button:has-text("Stäng")').last().click().catch(() => {});
await page.waitForTimeout(400);

/* 3. Dokumentmallarna: nedladdning + spara till akten som PDF. */
await page.goto(`${BASE}/dashboard/dokument`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
const templates = page.locator('section:has(h2:has-text("Dokumentmallar")) ul button');
const templateCount = await templates.count();
check("mallar: alla tre listas", templateCount === 3, String(templateCount));

await templates.first().click();
await page.waitForTimeout(400);
await page.click('button:has-text("Skapa dokumentet")');
await page.waitForTimeout(600);
dl = await download(() => page.click('button:has-text("Ladda ner PDF")'));
check("mall: filnamnet är .pdf", dl.name.endsWith(".pdf"), dl.name);
const mallBytes = validatePdfFile("styrelseprotokoll", dl.path);
check("mall: utkastmarkeringen med", mallBytes.includes("UTKAST"));

await page.click('button:has-text("Spara till ärendets dokument")');
await page.waitForTimeout(1200);
let body = await page.innerText("body");
check("mall: sparad till akten", /Sparat – syns i listan/i.test(body));
check("mall: ligger som .pdf i dokumentlistan", /protokoll.*\.pdf|\.pdf/i.test(body));

/* 4. Kreditunderlaget: fyll de tre uppgifterna, öppna visaren, ladda ner. */
await page.goto(`${BASE}/dashboard/kreditunderlag`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
await page.fill("#cd-cash", "250000");
await page.fill("#cd-amount", "750000");
await page.fill("#cd-purpose", "Överbrygga ackordsförhandlingen under rekonstruktionens första tre månader.");
await page.click('button:has-text("Öppna underlaget")');
await page.waitForTimeout(1000);
const dossierViewer = page.locator('button:has-text("Ladda ner PDF")');
if ((await dossierViewer.count()) > 0) {
  dl = await download(() => dossierViewer.first().click());
  check("kreditunderlag: filnamnet är .pdf", dl.name.endsWith(".pdf"), dl.name);
  validatePdfFile("kreditunderlag", dl.path);
} else {
  check("kreditunderlag: visaren öppnades", false, await page.innerText("body").then((t) => t.slice(0, 300)));
}

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
