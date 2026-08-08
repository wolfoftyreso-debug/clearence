/**
 * DATASKYDDET SOM KOD.
 *
 * GDPR-kraven som går att bygga in i produkten prövas här - inte för att
 * ersätta en DPIA, utan för att det som ÄR byggt inte tyst ska sluta gälla.
 * En regel som inte testas är en åsikt.
 *
 *  1. DATAMINIMERING VID FRITEXT (art. 9): påminnelsen finns, är konkret,
 *     och står faktiskt där fritext skrivs - samtalet och onboardingen.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_MINIMERING_HINT } from "../src/lib/dataMinimering";
import {
  DEFAULT_RETENTION,
  isExpired,
  mergeRetentionPolicy,
  retentionCutoff,
  retentionSummary,
} from "../src/lib/retention";
import { buildMyDataExport } from "../src/lib/dataExport";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra = "") => {
  if (ok) passed++;
  else {
    failed++;
    console.log(`FAIL ${name} ${extra}`);
  }
};

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/* --- 1. Dataminimering vid fritext (art. 9) ------------------------------ */

check("påminnelsen är skriven", DATA_MINIMERING_HINT.trim().length > 20);
// Den ska peka på just det som är känsligt: personnummer och tredje person.
check("den nämner personnummer", /personnummer/i.test(DATA_MINIMERING_HINT));
check("den nämner namngivna privatpersoner", /privatpersoner|tredje/i.test(DATA_MINIMERING_HINT));
// Den ska mana till mindre, inte skrämma. Ingen jargong, inget "förbjudet".
check("den formuleras som en uppmaning, inte ett förbud", !/förbjud|olagligt|straff/i.test(DATA_MINIMERING_HINT));

// Och den ska stå DÄR texten skrivs - annars är den en policy ingen läser.
const hintComp = read("src/components/privacy/DataMinimeringHint.tsx");
check("hint-komponenten använder den enda sanningen", /DATA_MINIMERING_HINT/.test(hintComp));

const samtal = read("src/pages/DashboardSamtal.tsx");
check("samtalet visar påminnelsen vid fritextfältet", /DataMinimeringHint/.test(samtal));

const onboarding = read("src/components/advisor/ClaraIntro.tsx");
check("onboardingen visar påminnelsen vid grunduppgifterna", /DataMinimeringHint/.test(onboarding));

/* --- 2. Gallring: en tid och en åtgärd per kategori (art. 5.1 e) --------- */

check("policyn har kategorier", DEFAULT_RETENTION.length >= 4);
check("varje kategori säger vad den är", DEFAULT_RETENTION.every((c) => c.description.trim().length > 20));
check("varje kategori har en åtgärd", DEFAULT_RETENTION.every((c) => ["radera", "anonymisera", "behall"].includes(c.action)));

// Skuggläge är default: det enda som gallrar skarpt från start är de
// sekundfärska teknikraderna (hastighetsgränsen), aldrig ärende- eller
// personuppgifter. Att slå på resten är ett medvetet beslut.
const aktivaFranStart = DEFAULT_RETENTION.filter((c) => c.aktiv && c.action !== "behall");
check("bara en kategori gallrar skarpt från start", aktivaFranStart.length === 1, aktivaFranStart.map((c) => c.id).join(","));
check("och det är hastighetsgränsens teknikrader", aktivaFranStart[0]?.id === "hastighetsgrans");
check(
  "känsliga kategorier startar i skuggläge",
  ["samtalsjournal_avslutad", "kontakt_avslutade_konton"].every(
    (id) => DEFAULT_RETENTION.find((c) => c.id === id)?.aktiv === false,
  ),
);
// Händelseloggen ska ÖVERLEVA ärendet - spårbarhet väger tyngre än gallring.
const logg = DEFAULT_RETENTION.find((c) => c.id === "handelselogg");
check("händelseloggen behålls, gallras inte på tid", logg?.action === "behall" && logg?.months === null);

// Tiderna är driftparametrar: en override läggs ovanpå, okända id:n ignoreras.
const merged = mergeRetentionPolicy(DEFAULT_RETENTION, [
  { id: "notiser_lasta", months: 12, aktiv: true },
  { id: "finns-inte", months: 1 },
]);
check("override ändrar tiden", merged.find((c) => c.id === "notiser_lasta")?.months === 12);
check("override kan slå på en kategori", merged.find((c) => c.id === "notiser_lasta")?.aktiv === true);
check("okänt id i override skapar ingen kategori", !merged.some((c) => c.id === "finns-inte"));
check("kategorier utan override är oförändrade", merged.find((c) => c.id === "handelselogg")?.action === "behall");

// Brytdatum och utgång, med fasta datum (ingen Date.now i testet).
const now = new Date("2026-08-08T00:00:00.000Z");
const notiser = DEFAULT_RETENTION.find((c) => c.id === "notiser_lasta")!;
check("brytdatumet ligger rätt antal månader bakåt", retentionCutoff(notiser, now)?.startsWith("2026-02-08") === true, String(retentionCutoff(notiser, now)));
check("en gammal post har passerat sin tid", isExpired(notiser, "2026-01-01T00:00:00.000Z", now));
check("en färsk post har inte det", !isExpired(notiser, "2026-08-01T00:00:00.000Z", now));
check("en behåll-kategori löper aldrig ut", !isExpired(logg!, "2000-01-01T00:00:00.000Z", now));
check("null-månad ger inget brytdatum", retentionCutoff(logg!, now) === null);

check("sammanfattningen nämner skuggläget", /skuggläge/.test(retentionSummary(DEFAULT_RETENTION)), retentionSummary(DEFAULT_RETENTION));

// Mekaniken är synlig men rör inga rader ännu: workern gallrar i skuggläge.
const worker = read("db/worker/email-worker.ts");
check("workern har ett gallringskommando", /--gallra/.test(worker) && /runGallring/.test(worker));
const gallringBlock = worker.slice(
  worker.indexOf("const runGallring"),
  worker.indexOf("const runReferralInvoicing"),
);
check("gallringsblocket hittades", gallringBlock.length > 100);
check(
  "gallringen är skuggläge, inte destruktiv ännu",
  /skuggläge/i.test(gallringBlock) && !/\bdelete\b|\bupdate .*\bset\b/i.test(gallringBlock),
);

// Och driftpanelen visar policyn ärligt.
const admin = read("src/pages/AdminOverview.tsx");
check("driftpanelen visar gallringspolicyn", /RetentionSection/.test(admin) && /getRetentionPolicy/.test(admin));

/* --- 3. Den registrerades rättigheter (art. 15, 16, 17, 20) ------------- */

const utdrag = buildMyDataExport(
  {
    epost: "erik@demobolaget.se",
    profil: { displayName: "Erik", phone: "070-1234567" },
    ekonomi: { startedAt: "2026-01-01", status: "trial" },
    aviseringar: { email: true },
    arenden: [{ id: "c1", companyName: "Demobolaget AB" }],
  },
  "2026-08-08T09:30:00.000Z",
);
check("utdraget bär en stabil formatstämpel", utdrag.data.format === "clearance-personuppgifter-v1");
check("utdraget ekar tidpunkten det togs", utdrag.data.uttaget === "2026-08-08T09:30:00.000Z");
check("utdraget förklarar vilken rätt det svarar mot", /art\. 15/.test(utdrag.data.om) && /portabilitet/i.test(utdrag.data.om));
check("utdraget bär kontots e-post", utdrag.data.konto.epost === "erik@demobolaget.se");
check("utdraget bär profil, ekonomi, aviseringar och ärenden",
  utdrag.data.profil !== null && utdrag.data.ekonomi !== null &&
  utdrag.data.aviseringar !== null && (utdrag.data.arenden as unknown[]).length === 1);
check("filnamnet bär datumet och är en json", /clearance-mina-uppgifter-2026-08-08\.json/.test(utdrag.fileName));
// Tomma delar ska ge tomma värden, inte krascha.
const tomtUtdrag = buildMyDataExport(
  { epost: null, profil: null, ekonomi: null, aviseringar: null, arenden: [] },
  "2026-08-08T00:00:00.000Z",
);
check("ett tomt utdrag är fortfarande giltigt", tomtUtdrag.data.konto.epost === null && Array.isArray(tomtUtdrag.data.arenden));

// Sidan: exporten laddas ned, rättelse pekar på profilen, radering går via
// dataskyddskanalen. Och det står rakt ut vad som ändå måste sparas.
const settings = read("src/pages/DashboardSettings.tsx");
check("inställningarna har en dataskyddssektion", /DataskyddSection/.test(settings));
check("registerutdraget laddas ned lokalt", /buildMyDataExport/.test(settings) && /downloadTextFile/.test(settings));
check("raderingen går via dataskyddskanalen", /amne=dataskydd/.test(settings));
check(
  "raderingen är ärlig om vad som måste sparas",
  /bokföringsunderlag|bokföring/i.test(settings) && /spårbarhet/i.test(settings),
);
// Kontaktsidan förväljer Personuppgifter när dataskyddslänken följs.
const kontakt = read("src/pages/Contact.tsx");
check("kontaktsidan förväljer personuppgifter från länken", /amne.*dataskydd/.test(kontakt) && /setTopic\("privacy"\)/.test(kontakt));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
