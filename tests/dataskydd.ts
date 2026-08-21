/**
 * DATASKYDDET SOM KOD.
 *
 * GDPR-kraven som går att bygga in i produkten prövas här - inte för att
 * ersätta en DPIA, utan för att det som ÄR byggt inte tyst ska sluta gälla.
 * En regel som inte testas är en åsikt.
 *
 *  1. DATAMINIMERING VID FRITEXT (art. 9): påminnelsen finns, är konkret,
 *     och står faktiskt där fritext skrivs - samtalet och onboardingen.
 *  2. GALLRINGEN (art. 5.1 e): policyn, brytdatumen och skuggläget.
 *  3. REGISTERUTDRAGET (art. 15 och 20): formen och innehållet.
 *  4. RADERING OCH RÄTTELSE (art. 16 och 17): att LÖFTET OCH KODEN SÄGER
 *     SAMMA SAK. Manifestet i src/lib/erasure.ts lovar vad som raderas,
 *     anonymiseras och behålls; app.erase_user() i migrationen utför det.
 *     Avsnitt 4 läser båda och kräver att de täcker varandra - annars kan
 *     sidan lova en sak och databasen göra en annan, och den skillnaden
 *     upptäcks först av någon som begärt radering och fått behålla sina
 *     uppgifter.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_MINIMERING_HINT } from "../src/lib/dataMinimering";
import {
  DEFAULT_RETENTION,
  isExpired,
  mergeRetentionPolicy,
  retentionCutoff,
  retentionOverrideProblems,
  retentionSummary,
  type RetentionOverride,
} from "../src/lib/retention";
import { buildMyDataExport } from "../src/lib/dataExport";
import {
  ERASURE_MANIFEST,
  KARENSDAGAR,
  RECTIFICATION_MAP,
  erasureSummary,
} from "../src/lib/erasure";

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

/* --- 2b. Driftparametern får inte kunna göra gallringen farlig -------- */

// VARFÖR AVSNITTET FINNS. Policyn är JSON i app_settings, skriven av en
// människa. Skriver den -6 i stället för 6 pekar brytdatumet FRAMÅT, och ett
// brytdatum i framtiden matchar allt: gallringen slutar vara gallring och
// blir en tömning. Skriver den "6" som sträng blir datumet ogiltigt och
// kastar mitt i nattjobbet, före raderingarna (art. 17). Ingetdera fick
// tidigare något motstånd - overriden lästes rakt in.
const fientliga: { namn: string; over: RetentionOverride[]; falt: string }[] = [
  { namn: "negativa månader", over: [{ id: "notiser_lasta", months: -6 }], falt: "months" },
  { namn: "månader som sträng", over: [{ id: "notiser_lasta", months: "6" as unknown as number }], falt: "months" },
  { namn: "decimalmånader", over: [{ id: "notiser_lasta", months: 1.5 }], falt: "months" },
  { namn: "orimligt många månader", over: [{ id: "notiser_lasta", months: 100000 }], falt: "months" },
  { namn: "ingen tidsgräns på en raderande kategori", over: [{ id: "notiser_lasta", months: null }], falt: "months" },
  { namn: "okänd åtgärd", over: [{ id: "notiser_lasta", action: "nuke" as never }], falt: "action" },
  { namn: "aktiv som sträng", over: [{ id: "notiser_lasta", aktiv: "ja" as unknown as boolean }], falt: "aktiv" },
  { namn: "okänt id", over: [{ id: "notiser_last", months: 12 }], falt: "id" },
  { namn: "samma kategori två gånger", over: [{ id: "notiser_lasta", months: 12 }, { id: "notiser_lasta", months: 1 }], falt: "id" },
  { namn: "posten är inte ett objekt", over: ["notiser_lasta" as unknown as RetentionOverride], falt: "post" },
];

for (const f of fientliga) {
  const problem = retentionOverrideProblems(DEFAULT_RETENTION, f.over);
  check(`avvisas: ${f.namn}`, problem.some((p) => p.falt === f.falt), JSON.stringify(problem));
  check(
    `avvisandet har ett skäl: ${f.namn}`,
    problem.every((p) => p.skal.trim().length > 10),
    JSON.stringify(problem),
  );
}

// Att avvisa räcker inte: sammanslagningen måste också vägra släppa igenom
// värdet, för app_settings går att skriva direkt i databasen.
const giftig = mergeRetentionPolicy(DEFAULT_RETENTION, [{ id: "notiser_lasta", months: -6, aktiv: true }]);
const giftigNotiser = giftig.find((c) => c.id === "notiser_lasta")!;
check("negativa månader slår inte igenom", giftigNotiser.months === 6, String(giftigNotiser.months));
check(
  "resten av samma post slår igenom",
  giftigNotiser.aktiv === true,
  "aktiv sattes inte, trots att bara months var trasigt",
);

// Det som ska hålla: inget brytdatum ur en sammanslagen policy får peka
// framåt, oavsett vad någon skrivit i inställningen.
const nuKontroll = new Date("2026-08-08T00:00:00.000Z");
const framatDatum = fientliga
  .flatMap((f) => mergeRetentionPolicy(DEFAULT_RETENTION, f.over))
  .map((c) => retentionCutoff(c, nuKontroll))
  .filter((d): d is string => d !== null)
  .filter((d) => new Date(d).getTime() > nuKontroll.getTime());
check("ingen fientlig override ger ett brytdatum i framtiden", framatDatum.length === 0, framatDatum.join(","));

const ogiltigaDatum = fientliga
  .flatMap((f) => mergeRetentionPolicy(DEFAULT_RETENTION, f.over))
  .map((c) => retentionCutoff(c, nuKontroll))
  .filter((d) => d !== null && Number.isNaN(new Date(d).getTime()));
check("ingen fientlig override ger ett ogiltigt datum", ogiltigaDatum.length === 0, String(ogiltigaDatum.length));

// Och spärren får inte vara så bred att den stoppar en riktig ändring.
check("en giltig policy passerar utan anmärkning",
  retentionOverrideProblems(DEFAULT_RETENTION, [
    { id: "notiser_lasta", months: 12, aktiv: true },
    { id: "handelselogg", months: null, action: "behall" },
    { id: "delningslankar_utgangna", months: 0 },
  ]).length === 0);

// API:et ska avvisa den trasiga policyn, inte spara den.
const apiKalla = read("api/server/index.ts");
const policyBlock = apiKalla.slice(
  apiKalla.indexOf('router.post("/v1/ops/retention-policy"'),
  apiKalla.indexOf('router.get("/v1/ops/audit"'),
);
check("skrivvägen prövar policyn", /retentionOverrideProblems/.test(policyBlock));
check(
  "en avvisad policy sparas inte",
  policyBlock.indexOf("retentionOverrideProblems") < policyBlock.indexOf("insert into public.app_settings"),
);

// Och workern ska säga till när standarden gäller i stället för det drift tror.
check(
  "workern skriver ut en avvisad driftparameter",
  /retentionOverrideProblems/.test(worker) && /avvisad/.test(worker),
);

// Och den skarpa gallringen prövas gren för gren mot en riktig databas.
const gallringsprov = read("supabase/tests/gallring.sql");
for (const kategori of DEFAULT_RETENTION.filter((c) => c.action !== "behall").map((c) => c.id)) {
  // Skarpt = tredje argumentet false, med ett brytdatum (inte null): det är
  // den körning som faktiskt rör rader. now() innehåller parenteser, så
  // mönstret får inte stanna vid första ")".
  const skarpt = new RegExp(`app\\.gallra\\('${kategori}',(?![^,]*null)[\\s\\S]{0,80}?false\\s*\\)`);
  const provad = skarpt.test(gallringsprov) || skarpt.test(read("supabase/tests/radering.sql"));
  check(`gallringsgrenen körs skarpt i ett prov: ${kategori}`, provad);
}
check(
  "gallringsprovet körs i båda databasmiljöerna",
  /gallring\.sql/.test(read("supabase/tests/run.sh")) && /gallring\.sql/.test(read("db/tests/run.sh")),
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

// Sidan: exporten laddas ned lokalt, och rättigheterna har en egen sektion.
const settings = read("src/pages/DashboardSettings.tsx");
check("inställningarna har en dataskyddssektion", /DataskyddSection/.test(settings));
check("registerutdraget laddas ned lokalt", /buildMyDataExport/.test(settings) && /downloadTextFile/.test(settings));
check("radering och rättelse har en egen sektion", /ErasureSection/.test(settings));

/* --- 4. Radering och rättelse (art. 16-17) -------------------------------- */

/**
 * Den GÄLLANDE migrationen för en funktion - inte den som råkar heta rätt.
 *
 * Här stod filnamnet. Det höll så länge app.erase_user bara definierades
 * en gång, men det är inte ett villkor någon har lovat: en senare
 * migration som gör om raderingen skulle lämna vakten kvar på den GAMLA
 * texten, och den skulle intyga ett löfte databasen inte längre håller.
 * Samma fälla fanns i säkerhetssviten för start_phone_verification, och
 * den upptäcktes bara för att någon råkade läsa filen.
 *
 * Migrationerna körs i namnordning, så den sista som definierar
 * funktionen är den som gäller.
 */
const gallandeMigration = (funktion: string): string => {
  const katalog = join(process.cwd(), "supabase/migrations");
  const monster = new RegExp(
    `create or replace function ${funktion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
  );
  let senast = "";
  for (const fil of readdirSync(katalog).filter((f) => f.endsWith(".sql")).sort()) {
    const text = readFileSync(join(katalog, fil), "utf8");
    if (monster.test(text)) senast = text;
  }
  return senast;
};

const sql = gallandeMigration("app.erase_user");
check("den gällande raderingsmigrationen hittades", sql.length > 0);
// Bara kroppen i app.erase_user(): det är DEN som utför löftet. Övriga
// funktioner i filen rör begäran och gallringen, och ska inte räknas in.
const eraseKropp = sql.slice(
  sql.indexOf("create or replace function app.erase_user"),
  sql.indexOf("comment on function app.erase_user"),
);
check("app.erase_user hittades i migrationen", eraseKropp.length > 1000, String(eraseKropp.length));

// (a) Allt manifestet lovar RÖRA ska SQL:en faktiskt röra.
const olovade = ERASURE_MANIFEST.filter((p) => p.action !== "behalls")
  .flatMap((p) => p.tabeller)
  .filter((t) => !eraseKropp.includes(t));
check("varje utlovad radering finns i SQL:en", olovade.length === 0, olovade.join(", "));

// (b) Och allt SQL:en rör ska stå i manifestet. Den här riktningen är den
// viktiga: en tyst radering av en tabell ingen berättat om är exakt vad
// ett manifest finns för att omöjliggöra.
const alla = new Set(ERASURE_MANIFEST.flatMap((p) => p.tabeller));
const rorda = [
  ...eraseKropp.matchAll(/\b(?:delete\s+from|update)\s+((?:public|auth|app)\.[a-z_]+)/g),
].map((m) => m[1]);
const oanmalda = [...new Set(rorda)].filter((t) => !alla.has(t));
check("ingen tabell rörs utan att stå i manifestet", oanmalda.length === 0, oanmalda.join(", "));

// (c) Det som BEHÅLLS får inte raderas, och får bara ändras om posten
// uttryckligen säger på vilket sätt.
const behallna = ERASURE_MANIFEST.filter((p) => p.action === "behalls");
const raderade = behallna.flatMap((p) =>
  p.tabeller.filter((t) => new RegExp(`delete\\s+from\\s+${t}\\b`).test(eraseKropp)),
);
check("inget som ska behållas raderas", raderade.length === 0, raderade.join(", "));
const andrade = behallna
  .filter((p) => !p.andring)
  .flatMap((p) => p.tabeller.filter((t) => new RegExp(`update\\s+${t}\\b`).test(eraseKropp)));
check("inget som ska stå oförändrat ändras", andrade.length === 0, andrade.join(", "));

// (d) Varje undantag bär sin rättsliga grund. Ett undantag utan grund är
// inte ett undantag, det är godtycke.
const utanGrund = behallna.filter((p) => !p.grund || p.grund.length < 30).map((p) => p.id);
check("varje undantag har en rättslig grund", utanGrund.length === 0, utanGrund.join(", "));
check(
  "bokföringsundantaget hänvisar till lagen",
  behallna.some((p) => /[Bb]okföringslagen/.test(p.grund ?? "")),
);
check(
  "loggen och underskrifterna hänvisar till art. 17.3",
  behallna.filter((p) => /17\.3/.test(p.grund ?? "")).length >= 2,
);

// (e) Karenstiden i koden och i databasen är samma tid.
check(
  "karenstiden är densamma i koden och i SQL:en",
  new RegExp(`interval '${KARENSDAGAR} days'`).test(sql),
  String(KARENSDAGAR),
);

// (f) Loggen ska inte gå att städa i efterhand - masken sätts vid skrivning.
check("händelseloggen maskeras vid skrivning", /maska_personuppgifter/.test(sql));
check(
  "raderingen försöker inte ändra i händelseloggen",
  !/update\s+public\.audit_events/.test(eraseKropp),
);

// (g) Kontoraden får inte raderas: kaskaden hade tagit delade ärenden.
check(
  "kontoraden raderas aldrig",
  !/delete\s+from\s+auth\.users/.test(eraseKropp) && /update auth\.users/.test(eraseKropp),
);

// (h) Rättelsekartan: varje uppgift har antingen en plats eller ett skäl
// OCH en väg. "Går inte att ändra" utan förklaring är inget svar.
const otydliga = RECTIFICATION_MAP.filter(
  (r) => !r.plats && (!r.varfor || !r.vag),
).map((r) => r.uppgift);
check("varje uppgift har en plats eller ett skäl och en väg", otydliga.length === 0, otydliga.join(", "));
check("rättelsekartan täcker de självbetjänade fälten", RECTIFICATION_MAP.filter((r) => r.plats).length >= 3);
check("och är ärlig om det som inte går", RECTIFICATION_MAP.filter((r) => !r.plats).length >= 2);

// (i) Sammanfattningen ska nämna BÅDE det som försvinner och det som blir
// kvar. "Vi raderar dina uppgifter" utan undantagen är osant.
const sammanfattning = erasureSummary();
check("sammanfattningen räknar både bort och kvar", /raderas eller anonymiseras/.test(sammanfattning) && /behålls/.test(sammanfattning));

// (j) Vägen in för en användare rör bara det egna kontot. erase_user tar
// ett konto-id och kör som ägare - den får aldrig nås av en inloggad.
check(
  "arbetarfunktionerna är stängda för klientrollerna",
  /revoke all on function app\.erase_user\(uuid\) from public, anon, authenticated;/.test(sql) &&
    /revoke all on function app\.gallra\(text, timestamptz, boolean\) from public, anon, authenticated;/.test(sql),
);
check(
  "men den egna begäran är öppen för den inloggade",
  /grant execute on function public\.request_account_erasure\(\) to authenticated;/.test(sql),
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
