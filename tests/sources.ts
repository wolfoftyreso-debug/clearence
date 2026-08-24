/**
 * KÄLLORNA: vad som får hämtas, och vad utvinningen vågar påstå.
 *
 * Två saker prövas, och den första är viktigare än den andra:
 *
 *  1. ATT REGISTRET OCH PANELEN INTE KAN SÄGA OLIKA SAKER. Panelen visar
 *     för användaren vilka källor som är anslutna. Registret säger vilka
 *     som FÅR vara det. Glider de isär påstår produkten något om sin egen
 *     insamling som inte stämmer - och det är precis den sortens fel som
 *     ingen upptäcker förrän någon frågar var en uppgift kom ifrån.
 *  2. ATT UTVINNINGEN INTE GISSAR. En beskrivning som inte stod på sidan,
 *     en e-postadress som tillhör en namngiven person, ett socialt konto
 *     som inte var länkat - allt sådant ser användbart ut och går inte att
 *     stå för.
 */

import {
  SOURCES,
  forbiddenSources,
  liveSources,
  sourceById,
} from "../src/lib/sources/registry";
import {
  extractWebsiteFacts,
  mayFetch,
  parseRobots,
  websiteNote,
} from "../src/lib/sources/website";
import { backgroundTasks } from "../src/lib/advisor/backgroundWork";
import fs from "node:fs";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra = "") => {
  if (ok) passed++;
  else {
    failed++;
    console.log(`FAIL ${name} ${extra}`);
  }
};

/* --- 1. Registret är fullständigt och ärligt ------------------------------ */

check("alla källor har ett hämtningssätt", SOURCES.every((s) => !!s.acquisition));
check("alla källor säger vad de ger", SOURCES.every((s) => s.value.trim().length > 10));
check(
  "alla källor har en angiven grund",
  SOURCES.every((s) => s.basis.trim().length > 20),
  SOURCES.filter((s) => s.basis.trim().length <= 20).map((s) => s.id).join(", "),
);
// En källa som inte är live MÅSTE säga vad som krävs. Utan det blir
// "ingen källa ansluten" ett konstaterande i stället för en åtgärd.
check(
  "varje icke-ansluten källa säger vad som krävs",
  SOURCES.filter((s) => !s.live).every((s) => s.needs.trim().length > 10),
  SOURCES.filter((s) => !s.live && s.needs.trim().length <= 10).map((s) => s.id).join(", "),
);
// Och tvärtom: en live-källa som säger att den kräver något har fastnat i
// ett halvt tillstånd som ingen kan tolka.
check(
  "en ansluten källa kräver ingenting",
  liveSources().every((s) => s.needs === ""),
);

// Sociala medier får ALDRIG bli live utan att någon uttryckligen ändrar
// hämtningssättet. Testet finns för att fånga den dagen det görs av misstag.
check("sociala medier är märkta som förbjudna", sourceById("sociala-medier")?.acquisition === "forbjuden");
check("en förbjuden källa är aldrig live", forbiddenSources().every((s) => !s.live));

/* --- 2. Panelen och registret säger samma sak ----------------------------- */

const ctx = {
  companyName: "Demobolaget AB",
  orgNumber: "556012-3456",
  registryHit: true,
  answered: 3,
  profileFields: 4,
};
const tasks = backgroundTasks(ctx, 99_000);

for (const spec of SOURCES) {
  const rader = tasks.filter((t) => t.source === spec.id);
  if (rader.length === 0) continue;
  if (spec.runtime) {
    /*
     * Körningsberoende källor jämförs inte statiskt: företagsregistret
     * svarar eller svarar inte för ett givet nummer, och panelen visar
     * utfallet. Det som däremot ska gälla är att en sådan källa är
     * MÄRKT som körningsberoende - annars är en avvikelse mellan register
     * och panel ett fel och inte en förklaring.
     */
    check(`${spec.id}: körningsberoende är utmärkt i registret`, spec.runtime === true);
    continue;
  }
  const anslutna = rader.every((t) => t.state === "klar");
  if (spec.live) {
    check(`${spec.id}: live i registret betyder klar i panelen`, anslutna, rader.map((r) => r.state).join(","));
  } else {
    check(
      `${spec.id}: ej live i registret betyder ingen-kalla i panelen`,
      rader.every((t) => t.state === "ingen-kalla"),
      rader.map((r) => r.state).join(","),
    );
    // Och skälet som visas ska vara registrets, inte en generisk mening.
    check(
      `${spec.id}: panelen visar registrets skäl`,
      rader.every((t) => t.note === spec.needs),
      rader[0]?.note.slice(0, 60),
    );
  }
}

/* --- 3. robots.txt respekteras ------------------------------------------- */

const robots = `
User-agent: *
Disallow: /admin
Disallow: /kundzon

User-agent: ClearanceBot
Disallow: /internt
Crawl-delay: 2
`;
const forOss = parseRobots(robots, "ClearanceBot/1.0");
check("egen grupp vinner över stjärnan", forOss.disallow.join(",") === "/internt", forOss.disallow.join(","));
check("crawl-delay läses", forOss.crawlDelay === 2);
check("förbjuden sökväg avvisas", !mayFetch("/internt/sidan", forOss));
check("tillåten sökväg släpps igenom", mayFetch("/om-oss", forOss));

const forAlla = parseRobots(robots, "NågonAnnan/1.0");
check("stjärnan gäller för andra", forAlla.disallow.length === 2, forAlla.disallow.join(","));

// Ingen robots.txt betyder inga regler - inte "förbjudet".
check("saknad robots.txt förbjuder ingenting", mayFetch("/vad-som-helst", parseRobots("", "ClearanceBot")));

// "Disallow:" utan värde betyder uttryckligen ALLT TILLÅTET. Blir det ett
// tomt prefix matchar det varje sökväg, och vi slutar hämta överhuvudtaget.
const tomtDisallow = parseRobots("User-agent: *\nDisallow:", "ClearanceBot");
check("tomt Disallow betyder allt tillåtet", mayFetch("/startsidan", tomtDisallow), tomtDisallow.disallow.join(","));

/* --- 4. Utvinningen gissar inte ------------------------------------------- */

const sida = `
<html><head>
<script type="application/ld+json">
{"@type":"Organization","name":"Demobolaget AB","description":"Vi bygger stommar i trä.","telephone":"08-123 45 67"}
</script>
<meta property="og:description" content="Något annat">
</head><body>
<a href="https://www.linkedin.com/company/demobolaget">LinkedIn</a>
<a href="https://www.instagram.com/demobolaget">Instagram</a>
<a href="mailto:info@demobolaget.se">Skriv till oss</a>
<a href="mailto:anna.andersson@demobolaget.se">Anna</a>
<p>Vi är förmodligen bäst i branschen.</p>
</body></html>`;

const facts = extractWebsiteFacts(sida);
check("beskrivningen tas ur strukturerad data först", facts.description === "Vi bygger stommar i trä.", String(facts.description));
check("namnet läses", facts.name === "Demobolaget AB", String(facts.name));
check("telefonnumret läses ur JSON-LD", facts.contact.phone === "08-123 45 67");
check("länkade sociala konton hittas", facts.socials.length === 2, JSON.stringify(facts.socials));
check("plattformarna namnges", facts.socials.some((s) => s.platform === "LinkedIn"));
// En personlig adress är en personuppgift analysen inte behöver.
check("bolagets adress väljs, inte personens", facts.contact.email === "info@demobolaget.se", String(facts.contact.email));
// Brödtext tolkas aldrig: "förmodligen bäst i branschen" är inte ett faktum.
check("brödtext blir aldrig ett påstående", !JSON.stringify(facts).includes("bäst i branschen"));
check("varje uppgift har en angiven grund", facts.basis.length >= 3, JSON.stringify(facts.basis));

const tom = extractWebsiteFacts("<html><head></head><body><p>Hej</p></body></html>");
check("en tom sida ger inga påhittade uppgifter",
  tom.description === null && tom.name === null && tom.socials.length === 0 && tom.contact.email === null);
check("och panelen säger det rakt ut", /innehöll inget vi kunde använda/.test(websiteNote(tom)), websiteNote(tom));

// Notisen räknar bara det som faktiskt hittades.
check("notisen räknar rätt", /2 sociala konton/.test(websiteNote(facts)), websiteNote(facts));

/* --- 5. CSP:n tillåter det appen faktiskt gör ----------------------------- */

/*
 * Innehållspolicyn står i driftkonfigurationen och gäller först i
 * produktion. Den kan därför motsäga appen utan att någon märker det förrän
 * en kund gör det - vilket den gjorde: object-src var 'none' medan
 * rapportvisaren bäddar in PDF:en med <object data={blob-url}>.
 *
 * Testet läser policyn ur vercel.json och jämför med vad koden använder.
 * Det är trubbigt, men det fångar just den klass av fel som annars bara
 * syns i drift.
 */
{
  // process.cwd(), inte __dirname: bunten hamnar i node_modules/.cache
  // och __dirname pekar då dit, inte på repot. Sviterna körs från roten.
  const rot = process.cwd();
  const vercel = JSON.parse(fs.readFileSync(`${rot}/vercel.json`, "utf8")) as {
    headers?: { headers: { key: string; value: string }[] }[];
  };
  const visaren = fs.readFileSync(`${rot}/src/components/reports/useInlineReport.tsx`, "utf8");

  const csp =
    (vercel.headers ?? [])
      .flatMap((h) => h.headers)
      .find((h) => h.key.toLowerCase() === "content-security-policy")?.value ?? "";

  const direktiv = (namn: string): string => {
    const d = csp
      .split(";")
      .map((x) => x.trim())
      .find((x) => x === namn || x.startsWith(`${namn} `));
    return d ? d.slice(namn.length).trim() : "";
  };

  check("CSP:n finns i driftkonfigurationen", csp.length > 0);
  check("frame-ancestors är låst", direktiv("frame-ancestors") === "'none'");
  check("base-uri är låst", direktiv("base-uri") === "'self'");

  /*
   * DEN HÄR UPPSLAGNINGEN HAR HAFT FEL FÖRR.
   *
   * Läses direktiven med en regexp som matchar var som helst i strängen
   * kan "font-src" träffa i "font-src 'self'" OCH i ingenting alls -
   * en tom träff blir en tom sträng, och en tom sträng innehåller varken
   * 'self' eller blob:, alltså rött. Värre är motsatsen: en uppslagning
   * som råkar returnera default-src:s värde för ett direktiv som inte
   * finns gör kontrollen nedan grön utan täckning. Därför prövas
   * mekanismen här.
   */
  check("uppslagningen hittar ett direktiv som finns", direktiv("default-src") === "'self'");
  check("och ger tomt för ett som inte finns", direktiv("finns-inte-src") === "");

  if (/<object\b/.test(visaren)) {
    const o = direktiv("object-src");
    check("visaren använder <object> - då måste object-src tillåta det", o.includes("'self'"), o);
    if (/blob:/.test(visaren) || /pdf\.url/.test(visaren)) {
      check("och blob: eftersom PDF:en är en blob-URL", o.includes("blob:"), o);
    }
  }
  if (/<iframe\b/.test(visaren)) {
    const f = direktiv("frame-src");
    check("visaren använder <iframe> - frame-src måste tillåta det", f.includes("'self'"), f);
  }
}


console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
