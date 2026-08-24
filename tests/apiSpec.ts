/**
 * Kontraktstester för det öppna API:t.
 *
 * Specen är ett löfte, så den vaktas som kod: giltig struktur, ärlig
 * statusmärkning (live/beta), unika operations-id:n, fyra objekten +
 * ärendet som resurser, webhooks för realtiden, strukturerade felkoder
 * - och datagränsen (aldrig automatiska bedömningar) utskriven.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (ok) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${name}${extra === undefined ? "" : `\n     ${JSON.stringify(extra)}`}`);
  }
};

// Körs alltid från repo-roten (npm-skriptet) - bundlens __dirname
// pekar på cache-katalogen och duger inte som utgångspunkt.
const raw = readFileSync(join(process.cwd(), "api", "openapi.json"), "utf8");
const spec = JSON.parse(raw) as {
  openapi: string;
  info: { version: string; description: string };
  servers: { url: string; description: string }[];
  paths: Record<string, Record<string, unknown>>;
  webhooks: Record<string, unknown>;
  components: { schemas: Record<string, unknown>; securitySchemes: Record<string, unknown> };
};

check("giltig JSON och OpenAPI 3.1", spec.openapi === "3.1.0");
check("versionerad med beta-märkning", spec.info.version === "1.0.0-beta");
check("sandbox-miljön finns", spec.servers.some((s) => s.url.includes("sandbox")));
check("datagränsen står i kontraktet", spec.info.description.includes("aldrig automatiska bedömningar"));
check("bakåtkompatibiliteten lovas", spec.info.description.includes("fält läggs till, aldrig bort"));

/* Resurserna: fyra objekten + ärendet + rapport + delning. */
const paths = Object.keys(spec.paths);
for (const required of [
  "/cases",
  "/cases/{caseId}",
  "/cases/{caseId}/close",
  "/cases/{caseId}/journal",
  "/cases/{caseId}/documents",
  "/documents/{documentId}/review",
  "/cases/{caseId}/decisions",
  "/decisions/{decisionId}/reconsider",
  "/cases/{caseId}/tasks",
  "/cases/{caseId}/report",
  "/cases/{caseId}/share-links",
  "/shared/{token}",
]) {
  check(`resursen ${required} finns`, paths.includes(required));
}

/*
 * Varje operation: operationId, sammanfattning och ÄRLIG statusmärkning.
 *
 * TRE LÄGEN. "live" är byggt och verifierat, "beta" är byggt och
 * kontrakt-först, "planerad" är BESKRIVET MEN INTE BYGGT - egna API:t
 * svarar 405. Det tredje läget saknades, och fyra resurser stod därför
 * som beta på den publika sidan trots att de inte gick att anropa.
 */
const STATUSAR = new Set(["live", "beta", "planerad"]);
const ops: { id: string; status: string }[] = [];
for (const [path, methods] of Object.entries(spec.paths)) {
  for (const [method, def] of Object.entries(methods)) {
    if (method === "parameters") continue;
    const operation = def as { operationId?: string; summary?: string; "x-status"?: string };
    check(`${method.toUpperCase()} ${path} har operationId`, !!operation.operationId);
    check(`${method.toUpperCase()} ${path} har statusmärkning`, STATUSAR.has(operation["x-status"] ?? ""), operation["x-status"]);
    ops.push({ id: operation.operationId ?? "", status: operation["x-status"] ?? "" });
  }
}
check("operations-id:na är unika", new Set(ops.map((o) => o.id)).size === ops.length);
check("live-länkens läsning är live idag", (spec.paths["/shared/{token}"].get as { "x-status": string })["x-status"] === "live");
/* Journalen är den första nyckelburna resursen i drift (api_journal). */
const journalOp = spec.paths["/cases/{caseId}/journal"].get as { "x-status": string; description?: string };
check("journalens läsning är live idag", journalOp["x-status"] === "live");
check("journalens datagräns är utskriven", /utan before\/after|aldrig automatiska bedömningar/i.test(journalOp.description ?? ""));
check("journalens tystnadsprincip är utskriven", /samma tystnad/i.test(journalOp.description ?? ""));

/* Realtiden: webhooks för journalens händelser. */
for (const event of [
  "document.created",
  "document.review_changed",
  "case.status_changed",
  "decision.recorded",
  "decision.reconsidered",
  "report.generated",
  "task.completed",
]) {
  check(`webhooken ${event} är deklarerad`, event in spec.webhooks);
}

/* Felkoderna: strukturerade och uppräknade. */
const errorSchema = spec.components.schemas.Error as {
  properties: { code: { enum: string[] } };
};
check("felkoderna är uppräknade", errorSchema.properties.code.enum.length >= 6);
check("betalväggen har en egen felkod", errorSchema.properties.code.enum.includes("payment_required"));

/* Fyra objekten som scheman + beslutets premiss. */
for (const schema of ["Case", "JournalEvent", "Document", "Decision", "Task", "ShareLink", "SharedCaseView", "Error"]) {
  check(`schemat ${schema} finns`, schema in spec.components.schemas);
}
const decision = spec.components.schemas.Decision as { properties: { premise: { description: string } } };
check("beslutets premiss är dokumenterad", decision.properties.premise.description.includes("Omprövningsvillkoret"));
check("ordet AI förekommer inte", !/\bAI\b/i.test(raw));

/* --- Ärendet som API:et lämnar ifrån sig måste vara HELT ----------------- */

/*
 * Adaptern castar API-svaret rakt till CaseRecord. Ett fält som saknas i
 * serialiseraren blir därför inte ett tomt värde utan ett löfte som inte
 * hålls - och läsaren som gör recommendationReasons[0] kraschar. Det tog
 * ner hela översikten en gång; kontrollen finns för att det inte ska
 * kunna hända igen.
 */
const apiSource = readFileSync(join(process.cwd(), "server/index.ts"), "utf8");
const toCaseBlock = apiSource.slice(
  apiSource.indexOf("const toCase = (row"),
  apiSource.indexOf("const toDecision = (row"),
);
const typesSource = readFileSync(join(process.cwd(), "src/data/types.ts"), "utf8");
const caseBlock = typesSource.slice(
  typesSource.indexOf("export interface CaseRecord {"),
  typesSource.indexOf("export type NewCase"),
);
const contractFields = [...caseBlock.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]);
check("CaseRecord-fälten hittades", contractFields.length > 20, contractFields.length);

const missing = contractFields.filter((f) => !new RegExp(`\\b${f}:`).test(toCaseBlock));
check(
  "API:ets toCase bär hela CaseRecord",
  missing.length === 0,
  `saknas: ${missing.join(", ")}`,
);

// Listorna får aldrig vara undefined - läsaren indexerar dem.
for (const listField of ["recommendationReasons", "recommendationNextSteps"]) {
  check(
    `${listField} normaliseras till en array`,
    new RegExp(`${listField}:\\s*asStringArray`).test(toCaseBlock),
  );
}

/* --- Servern och kontraktet får inte glida isär ------------------------ */

/*
 * DEN HÄR KONTROLLEN SAKNADES, och den saknades på precis det sätt som
 * gör en kontroll värdelös: sviten prövade att en LISTA av resurser fanns
 * i kontraktet, inte att kontraktet täcker det servern faktiskt svarar
 * på. En ny rutt kunde alltså läggas till utan att kontraktet nämnde den,
 * och allt förblev grönt - vilket är exakt vad som hände när
 * /v1/sources/google lades till.
 *
 * "API-first" betyder att kontraktet är sanningen. Då måste avvikelsen gå
 * att se. Kontrollen läser rutterna som text ur servern; det är trubbigt,
 * men det är den sortens trubbighet som håller när ingen tittar.
 */
const serverKod = readFileSync(join(process.cwd(), "server", "index.ts"), "utf8");

/** "/v1/cases/:caseId" -> "/cases/{caseId}", som kontraktet skriver det. */
const somKontraktet = (rutt: string): string =>
  rutt.replace(/^\/v1/, "").replace(/:([A-Za-z0-9_]+)/g, "{$1}");

const rutter = [...new Set((serverKod.match(/"\/v1\/[^"]*"/g) ?? []).map((m) => m.slice(1, -1)))];

check("rutterna gick att läsa ur servern", rutter.length > 10, rutter.length);

for (const rutt of rutter) {
  const i = somKontraktet(rutt);
  check(`${rutt} är deklarerad i kontraktet`, Object.hasOwn(spec.paths, i), i);
}

/*
 * ETT DATUM FÅR INTE GÅ GENOM iso().
 *
 * `pg` ger tillbaka JS-Date även för en date-kolumn, satt till LOKAL
 * midnatt. iso() gör .toISOString() - och då blir 2026-10-01 till
 * "2026-09-30T22:00:00.000Z" i svensk drift. Fel dag, i en produkt vars
 * hela poäng är att räkna ner till en frist.
 *
 * Felet gick inte att se i sviterna: utvecklings- och CI-containern kör
 * UTC, där skiftet är noll. Den här vakten läser källan i stället, för
 * den är sann i varje tidszon.
 */
const DATUMKOLUMNER = ["due_date", "issue_date", "occurred_on", "period_start", "period_end"];
for (const kolumn of DATUMKOLUMNER) {
  const traffar = serverKod.match(new RegExp(`iso\\(row\\.${kolumn}\\)`, "g")) ?? [];
  check(`${kolumn} serialiseras inte med iso()`, traffar.length === 0, traffar);
}
check(
  "datum() finns och läser det LOKALA datumet ur en Date",
  /export const datum = [\s\S]{0,400}getFullYear\(\)[\s\S]{0,200}getMonth\(\)[\s\S]{0,200}getDate\(\)/.test(
    serverKod,
  ),
);

/*
 * OCH METODEN MÅSTE VARA DEKLARERAD, INTE BARA SÖKVÄGEN.
 *
 * Kontrollen ovan hade samma sorts lucka som den ersatte. Den prövade att
 * sökvägen fanns i kontraktet - så när POST /v1/cases/{caseId}/messages
 * lades till på en sökväg som redan hade en GET, förblev allt grönt medan
 * kontraktet inte sa ett ord om skrivvägen. Det upptäcktes först när
 * någon läste JSON:en för hand.
 *
 * En odeklarerad skrivväg är värre än en odeklarerad läsväg: kontraktet
 * är det enda stället där kroppens fält står skrivna, och de fälten är
 * gränsen för vad servern tar emot.
 */
const VERB: Record<string, string> = { get: "get", post: "post", put: "put", patch: "patch", del: "delete" };
const metodPar = [
  // router.get("/v1/...", ...) - även när sökvägen står på egen rad.
  ...[...serverKod.matchAll(/router\.(get|post|put|patch|del)\(\s*"(\/v1\/[^"]*)"/g)].map(
    (m) => [VERB[m[1]], m[2]] as const,
  ),
  // caseScoped(...) registrerar en GET; sökvägen är första argumentet och
  // står ofta efter en kommentarsrad.
  ...[...serverKod.matchAll(/caseScoped\(\s*(?:\/\/[^\n]*\n\s*)*"(\/v1\/[^"]*)"/g)].map(
    (m) => ["get", m[1]] as const,
  ),
];

check("metoderna gick att läsa ur servern", metodPar.length > 30, metodPar.length);

for (const [metod, rutt] of metodPar) {
  const i = somKontraktet(rutt);
  const post = (spec.paths as Record<string, Record<string, unknown>>)[i];
  check(
    `${metod.toUpperCase()} ${rutt} är deklarerad i kontraktet`,
    post !== undefined && Object.hasOwn(post, metod),
    { sokvag: i, deklarerade: post ? Object.keys(post) : null },
  );
}

/*
 * En skrivväg utan requestBody i kontraktet är ett kontrakt som inte
 * säger vad den tar emot. Rutter utan kropp finns (kvittenser,
 * återkallelser), så kravet gäller de som FAKTISKT läser fält.
 */
for (const [metod, rutt] of metodPar) {
  if (metod === "get" || metod === "delete") continue;
  const i = somKontraktet(rutt);
  const spec_ = (spec.paths as Record<string, Record<string, Record<string, unknown>>>)[i]?.[metod];
  if (!spec_) continue;
  /*
   * Läser handlern något ur req.body? Då ska kontraktet beskriva det.
   *
   * Fönstret slutar vid NÄSTA rutt och inte efter ett antal tecken: en
   * fast längd svämmar över i grannhandlern, och då anklagas en rutt utan
   * kropp (en kvittens, en återkallelse) för att sakna en beskrivning av
   * något den aldrig läser.
   */
  /*
   * FÖNSTRET SÖKS PER METOD, INTE PER SÖKVÄG.
   *
   * Här stod indexOf(`"${rutt}"`) - alltså FÖRSTA rutten med den
   * sökvägen. På en sökväg som har både en GET och en POST är det GET:en,
   * och POST:ens kropp prövades då mot GET:ens handler. GET-handlern
   * läser ingen kropp, så `laserKropp` blev falskt och kontrollen hoppade
   * över - tyst.
   *
   * Två skrivvägar i produkten hade den luckan: POST /v1/api-keys och
   * POST /v1/me/erasure läser båda fält ur kroppen och saknade
   * requestBody i kontraktet, med sviten grön. Det är exakt samma sorts
   * hål som metodkontrollen ovan finns för att täppa till, en nivå ned.
   */
  const verbKalla = Object.entries(VERB).find(([, v]) => v === metod)?.[0] ?? metod;
  const start = serverKod.search(
    new RegExp(`router\\.${verbKalla}\\(\\s*"${rutt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`),
  );
  if (start === -1) continue;
  const nasta = serverKod.slice(start + 1).search(/\n(?:router\.[a-z]+\(|caseScoped\()/);
  const handler = serverKod.slice(start, nasta === -1 ? undefined : start + 1 + nasta);
  const laserKropp = /req\.body/.test(handler);
  if (!laserKropp) continue;
  check(
    `${metod.toUpperCase()} ${rutt} beskriver sin kropp i kontraktet`,
    Object.hasOwn(spec_, "requestBody"),
    i,
  );
}

/*
 * Åt andra hållet är läget ett annat, och det ska inte påstås vara ett fel.
 *
 * Kontraktet beskriver HELA v1. Den egna servern är första lodräta skivan
 * (server/index.ts): identiteten, ärendena, journalen och
 * beslutsminnet. Resten serveras idag genom supabase-adaptern. Att kräva
 * att servern täcker kontraktet vore alltså att kräva att migreringen är
 * klar, vilket den inte är.
 *
 * Men gapet får inte växa i tysthet. Listan nedan är den skrivna
 * sanningen om vad den egna servern ännu inte svarar på. Bygger någon en
 * av dem faller kontrollen och listan ska kortas - och lägger någon till
 * ett nytt hål faller den också. Det är skillnaden mellan en känd skuld
 * och en glömd.
 */
const ANNU_INTE_I_EGNA_SERVERN = [
  /*
   * Rapporten är det som återstår, och den är inte en rutt som glömts
   * bort: den renderar en PDF, vilket kräver dokumenthinken och den
   * signering som inte finns förrän det finns en hink att signera mot.
   * Samma skäl som documents.upload ligger kvar hos den gamla adaptern.
   *
   * Listan var fem rader lång. Delningen, avslutet och profilen är
   * flyttade; den här raden är kvar.
   */
  "/cases/{caseId}/report",
];

const oimplementerade = Object.keys(spec.paths)
  .filter((i) => !rutter.some((r) => somKontraktet(r) === i))
  .sort();

check(
  "gapet mellan kontraktet och egna servern är exakt det kända",
  JSON.stringify(oimplementerade) === JSON.stringify([...ANNU_INTE_I_EGNA_SERVERN].sort()),
  { hittade: oimplementerade, forvantade: ANNU_INTE_I_EGNA_SERVERN },
);

/* --- ÅT ANDRA HÅLLET: kontraktet får inte lova mer än servern kan ------- */

/*
 * VAKTEN OVAN PRÖVADE BARA EN RIKTNING.
 *
 * "Är varje implementerad rutt deklarerad?" - ja. Men inte "kan servern
 * varje METOD kontraktet deklarerar?". Gapkontrollen jämför SÖKVÄGAR, så
 * en sökväg som finns med en metod räknas som implementerad även om
 * kontraktet lovar tre.
 *
 * Det dolde två stycken: kontraktet deklarerar POST /cases och
 * PATCH /cases/{caseId} - att SKAPA och ÄNDRA ett ärende, alltså de två
 * mest grundläggande skrivningarna i hela produkten. Egna servern svarar
 * 405 på båda. En utvecklare som läser den publika /api-sidan bygger mot
 * dem och får metodfel.
 *
 * Listan nedan gör det till ett BESLUT i stället för en överraskning. Den
 * som lägger till en metod i kontraktet utan att bygga den måste skriva
 * ned varför.
 */
{
  const ANNU_INTE_BYGGDA: Record<string, string> = {
    "PATCH /cases/{caseId}":
      "Samma sak: ändringen går genom bryggan. Fältlistan i kontraktet är bredare än det egna servern hittills tagit emot.",
    "PATCH /cases/{caseId}/tasks":
      "Uppgifter ändras i dag med POST /tasks/{taskId}/done och POST /tasks/{taskId}/assign. Kontraktets PATCH är en samlad form som ingen klient använder ännu.",
    "GET /cases/{caseId}/report":
      "Renderar en PDF på servern. Klienten bygger den redan lokalt ur samma underlag (src/lib/pdf), så rutten är en bekvämlighet för API-kunder - inte något produkten saknar.",
  };

  const implementerade = new Set(metodPar.map(([m, r]) => `${m.toUpperCase()} ${somKontraktet(r)}`));
  const loftenUtanTackning: string[] = [];
  for (const [sokvag, ops] of Object.entries(spec.paths as Record<string, Record<string, unknown>>)) {
    for (const metod of Object.keys(ops)) {
      if (!["get", "post", "put", "patch", "delete"].includes(metod)) continue;
      const nyckel = `${metod.toUpperCase()} ${sokvag}`;
      if (!implementerade.has(nyckel)) loftenUtanTackning.push(nyckel);
    }
  }
  loftenUtanTackning.sort();

  check(
    "kontraktet lovar inget servern saknar, utöver det nedskrivna",
    JSON.stringify(loftenUtanTackning) === JSON.stringify(Object.keys(ANNU_INTE_BYGGDA).sort()),
    { hittade: loftenUtanTackning, nedskrivna: Object.keys(ANNU_INTE_BYGGDA).sort() },
  );

  // Ett undantag utan skäl är ingen förklaring.
  const utanSkal = Object.entries(ANNU_INTE_BYGGDA).filter(([, s]) => s.trim().length < 40);
  check("varje obyggd metod bär ett skäl", utanSkal.length === 0, utanSkal.map(([k]) => k));

  /*
   * OCH DE SKA VARA MÄRKTA I KONTRAKTET.
   *
   * En utvecklare läser /api-sidan, inte den här filen. Står det inget om
   * att metoden inte finns ännu är listan ovan bara vår egen tröst.
   */
  const omarkta = Object.keys(ANNU_INTE_BYGGDA).filter((nyckel) => {
    const [metod, sokvag] = nyckel.split(" ");
    const op = (spec.paths as Record<string, Record<string, Record<string, unknown>>>)[sokvag]?.[metod.toLowerCase()];
    return op?.["x-status"] !== "planerad";
  });
  check("obyggda metoder är märkta \"planerad\" i kontraktet", omarkta.length === 0, omarkta);
}

/* --- Publikt i kontraktet ska vara publikt i servern -------------------- */

/*
 * KONTRAKTET HADE RÄTT OCH KODEN FEL, OCH INGENTING JÄMFÖRDE DEM.
 *
 * GET /billing/company-plan stod beskriven som "Driftparameter, publikt
 * läsbar" - men handlern anropade authenticate(req) och svarade 401 utan
 * token. Landningssidan, som möter utloggade besökare, fick alltså aldrig
 * driftens pris och föll tillbaka på det inkompilerade betabeslutet.
 * Felet var osynligt i åratal av en enda anledning: reservvärdet råkade
 * vara samma som parametern.
 *
 * Drift-vakterna ovan jämför sökväg, metod och kropp. Ingen jämförde
 * BEHÖRIGHETEN. Det gör den här.
 *
 * Åt andra hållet gäller det också: en rutt som kontraktet inte märker
 * som publik ska kräva en identitet. Annars kan en skrivväg öppnas av
 * misstag utan att kontraktet säger något om det.
 */
{
  const paths = spec.paths as Record<string, Record<string, { security?: unknown[] }>>;
  const publikaIKontraktet = new Set<string>();
  const valfriIdentitet = new Set<string>();
  for (const [sokvag, ops] of Object.entries(paths)) {
    for (const [metod, op] of Object.entries(ops)) {
      if (!Array.isArray(op?.security)) continue;
      if (op.security.length === 0) {
        publikaIKontraktet.add(`${metod} ${sokvag}`);
        continue;
      }
      /*
       * DEN TREDJE STATEN: VALFRI IDENTITET.
       *
       * `security: [{}, {session: []}]` är OpenAPI:s sätt att säga "går
       * att anropa både med och utan". Ett tomt objekt i listan betyder
       * att inget krav också duger.
       *
       * Vakten var binär förut, och den binära formen hade tvingat fram
       * en lögn åt något håll: antingen "publik" om en rutt som kan kräva
       * en session, eller "skyddad" om en rutt som fungerar utan. Båda
       * hade gjort kontraktet mindre sant än koden.
       *
       * POST /v1/auth/password är den enda rutten som är det: med polett
       * ur återställningslänken krävs ingen session (poletten ÄR beviset),
       * inloggad krävs både session och nuvarande lösenord.
       */
      if (op.security.some((s) => s !== null && typeof s === "object" && Object.keys(s as object).length === 0)) {
        valfriIdentitet.add(`${metod} ${sokvag}`);
      }
    }
  }
  check("kontraktet pekar ut några publika rutter", publikaIKontraktet.size > 0, publikaIKontraktet.size);

  /*
   * "Valfri" får inte bli en bekväm utväg för en rutt ingen orkat bestämma
   * sig om. Den ska vara sällsynt, och var och en ska stå namngiven här.
   */
  const MEDVETET_VALFRI: Record<string, string> = {
    "post /auth/password": "Två vägar in: polett ur återställningslänken (ingen session) eller inloggad med nuvarande lösenord.",
  };
  const ovantatValfria = [...valfriIdentitet].filter((r) => !(r in MEDVETET_VALFRI));
  check("varje rutt med valfri identitet står namngiven", ovantatValfria.length === 0, ovantatValfria);
  const spokenValfria = Object.keys(MEDVETET_VALFRI).filter((r) => !valfriIdentitet.has(r));
  check("och listan innehåller inga spöken", spokenValfria.length === 0, spokenValfria);

  /*
   * Handlern för EN metod och EN sökväg. Fönstret söks per metod - en
   * sökvägsträff hade läst GET-handlern på en sökväg som också har POST,
   * vilket är exakt det hål som dolde elva odeklarerade kroppar.
   */
  const handlarenFor = (metod: string, rutt: string): string => {
    const verbKalla = Object.entries(VERB).find(([, v]) => v === metod)?.[0] ?? metod;
    const start = serverKod.search(
      new RegExp(`router\\.${verbKalla}\\(\\s*"${rutt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`),
    );
    if (start === -1) return "";
    const nasta = serverKod.slice(start + 1).search(/\n(?:router\.[a-z]+\(|caseScoped\()/);
    return serverKod.slice(start, nasta === -1 ? undefined : start + 1 + nasta);
  };

  for (const [metod, rutt] of metodPar) {
    const kropp = handlarenFor(metod, rutt);
    if (!kropp) continue;
    const kraverIdentitet = /await authenticate\(req\)|apiNyckelAnropare|authenticateApiKey/.test(kropp);
    const nyckel = `${metod} ${somKontraktet(rutt)}`;
    const deklareradPublik = publikaIKontraktet.has(nyckel);

    if (valfriIdentitet.has(nyckel)) {
      /*
       * Handlern MÅSTE ha båda vägarna. En som bara autentiserar är inte
       * valfri - då ljuger kontraktet - och en som aldrig gör det är
       * publik och ska deklareras så.
       */
      check(
        `${metod.toUpperCase()} ${rutt} har en inloggad väg`,
        kraverIdentitet,
        "kontraktet säger valfri identitet, men handlern autentiserar aldrig",
      );
      check(
        `${metod.toUpperCase()} ${rutt} har också en väg utan session`,
        /return\s*\{[\s\S]{0,400}?\}[\s\S]{0,200}?await authenticate\(req\)/.test(kropp),
        "kontraktet säger valfri identitet, men handlern autentiserar innan någon annan väg kan tas",
      );
      continue;
    }

    if (deklareradPublik) {
      check(
        `${metod.toUpperCase()} ${rutt} är publik i BÅDE kontraktet och koden`,
        !kraverIdentitet,
        "kontraktet säger security: [], men handlern kräver en identitet",
      );
    } else if (!kraverIdentitet) {
      /*
       * Undantagen: rutter som medvetet saknar identitetskrav men inte är
       * märkta publika. Var och en ska ha ett skäl, annars är det en öppen
       * yta ingen beslutat om.
       */
      const MEDVETET_UTAN_IDENTITET: Record<string, string> = {
        "post /v1/contact": "Kontaktformuläret ska fungera oinloggat - ett bolag på väg omkull ska inte behöva ett konto för att ställa en fråga.",
      };
      check(
        `${metod.toUpperCase()} ${rutt} kräver en identitet, eller står som medvetet undantag`,
        `${metod} ${rutt}` in MEDVETET_UTAN_IDENTITET,
        "handlern kräver ingen identitet och kontraktet märker den inte som publik",
      );
    }
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
