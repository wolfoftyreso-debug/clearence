/**
 * INSTALLERBARHETEN OCH DE JURIDISKA SIDORNA.
 *
 * Två saker som båda är villkor för att gå live:
 *
 *  - Appen ska gå att lägga på hemskärmen, och ett tappat nät ska ge ett
 *    ärligt besked i stället för en vit skärm.
 *  - Integritetspolicyn och villkoren ska finnas, gå att hitta ur
 *    sidfoten, och SÄGA att de är ett ogranskat utkast så länge de är
 *    det. En policy som ser färdig ut är farligare än ingen alls.
 *
 * Offline-delen stänger en egen förhandsserver i stället för att använda
 * Playwrights setOffline: emuleringen serverar navigeringen ur Chromiums
 * cache, och en trasig service-worker hade fått godkänt. Det var precis
 * så det första utkastet av workern slank igenom - fetch lyckades ur
 * HTTP-cachen, catch-grenen kördes aldrig, och användaren fick appskalet
 * utan sina script. En vit skärm.
 */
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
import { spawn } from "node:child_process";
const KATALOG = process.cwd();
const B = process.argv[2] ?? "http://127.0.0.1:4310";
const b = await pw.chromium.launch();
let ok = 0, fel = 0;
const check = (n, c, x = "") => { if (c) { ok++; console.log("PASS " + n); } else { fel++; console.log("FAIL " + n + " " + x); } };

const p = await b.newPage({ viewport: { width: 390, height: 844 } });
p.setDefaultTimeout(25000);
const errs = [];
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });

// 1. Manifestet är kopplat och giltigt
await p.goto(B, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1500);
check("manifestet är länkat", (await p.locator('link[rel="manifest"]').count()) === 1);
check("temafärgen är satt", (await p.getAttribute('meta[name="theme-color"]', "content")) === "#134376");
check("apple-touch-icon finns", (await p.locator('link[rel="apple-touch-icon"]').count()) === 1);
const man = await (await p.request.get(`${B}/manifest.webmanifest`)).json();
check("manifestet är giltig JSON med namn", man.name.includes("CLEARANCE"));
check("display är standalone", man.display === "standalone", man.display);
check("språket är svenska", man.lang === "sv-SE");
check("192 och 512 finns", man.icons.some(i => i.sizes === "192x192") && man.icons.some(i => i.sizes === "512x512"));
check("maskable finns", man.icons.some(i => i.purpose === "maskable"));
check("genvägar pekar rätt", man.shortcuts.every(s => ["/wizard", "/kbr"].includes(s.url)));

// 2. Service-workern registreras och gör rätt
await p.waitForTimeout(2500);
const swState = await p.evaluate(async () => {
  const r = await navigator.serviceWorker.getRegistration();
  return r ? (r.active ? "active" : "installing") : "none";
});
check("service-workern registreras", swState !== "none", swState);

/*
 * 3. Offline: navigering ger den ärliga sidan, inte en vit skärm.
 *
 * Testet stänger en EGEN förhandsserver i stället för att använda
 * Playwrights setOffline. Emuleringen visade sig inte modellera det här:
 * den serverar navigeringen ur Chromiums egen cache, så en trasig
 * service-worker hade fått godkänt. Ett äkta serverbortfall är det enda
 * som prövar det som faktiskt händer i en tunnel.
 */
{
  const PORT = 4311;
  const server = spawn("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", String(PORT)], {
    cwd: KATALOG,
    stdio: "ignore",
    detached: true,
  });
  await new Promise((r) => setTimeout(r, 6000));

  const ctx2 = await b.newContext();
  const q = await ctx2.newPage();
  q.setDefaultTimeout(25000);
  await q.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "domcontentloaded" });
  await q.evaluate(() => navigator.serviceWorker.ready);
  await q.waitForTimeout(2500);
  check("workern kontrollerar sidan", await q.evaluate(() => !!navigator.serviceWorker.controller));

  try { process.kill(-server.pid); } catch { /* redan död */ }
  await new Promise((r) => setTimeout(r, 1500));

  await q.goto(`http://127.0.0.1:${PORT}/kunskap`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await q.waitForTimeout(1000);
  const offtext = await q.innerText("body");
  check("offline visar den ärliga sidan", /Ingen uppkoppling/.test(offtext), offtext.slice(0, 120));
  check("den lovar inte offline-tillgång", !/tillgängligt offline/i.test(offtext));
  check("den säger att arbetet finns kvar", /har gått förlorat/.test(offtext));
  await ctx2.close();
}

// 4. De juridiska sidorna
for (const [route, rubrik] of [["/integritetspolicy", "Integritetspolicy"], ["/villkor", "Användarvillkor"]]) {
  await p.goto(`${B}${route}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1500);
  const t = await p.locator("main").innerText();
  check(`${route} renderar`, new RegExp(rubrik).test(t), t.slice(0, 80));
  check(`${route} säger att det är ett utkast`, /Utkast – inte juridiskt granskat/.test(t));
  check(`${route} märker ut öppna punkter`, /Öppen punkt/i.test(t));
  check(`${route} namnger den ansvarige`, /Landvex AB/.test(t));
}
// Ingen påhittad gallringsfrist
await p.goto(`${B}/integritetspolicy`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1200);
const pol = await p.locator("main").innerText();
check("IMY nämns som tillsynsmyndighet", /Integritetsskyddsmyndigheten/.test(pol));
check("ingen påhittad gallringsfrist", !/\b(12|24|36) månader\b/.test(pol));
check("sjuårsregeln för bokföring står med", /sju år/.test(pol));

// 5. Sidfoten länkar dit
check("sidfoten länkar till policyn", (await p.locator('footer a[href="/integritetspolicy"]').count()) >= 1);
check("sidfoten länkar till villkoren", (await p.locator('footer a[href="/villkor"]').count()) >= 1);

// Nedkopplingen ovan ger med flit nätverksfel - de är testets syfte, inte
// ett fynd. Allt annat i konsolen är däremot ett fynd.
const riktigaFel = errs.filter((e) => !/favicon|ERR_INTERNET_DISCONNECTED|Failed to load resource/i.test(e));
check("inga konsolfel utöver den avsiktliga nedkopplingen", riktigaFel.length === 0, riktigaFel[0] ?? "");
console.log(`\n${ok} passed, ${fel} failed`);
await b.close();
if (fel > 0) process.exit(1);
