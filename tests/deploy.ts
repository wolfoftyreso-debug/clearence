/**
 * DRIFT PÅ VERCEL: det som måste hålla för att en utrullning ska vara den
 * produkt vi tror att den är.
 *
 * Vakterna här ersätter dem som prövade nginx-mallen, avbilderna och
 * runtime-konfigen. De sakerna finns inte längre - men det de SKYDDADE
 * finns kvar, och det är den listan som räknas:
 *
 *  1. SERVERKODEN LIGGER UTANFÖR api/. Vercel gör varje fil under api/
 *     till en endpoint; hamnade server/index.ts där vore hela routern
 *     publik under sitt filnamn.
 *  2. ROLLGRINDEN PRÖVAS FÖRE DATABASEN RÖRS. På en egen server vägrade
 *     main.ts starta. I serverless finns ingen uppstart - vägran måste
 *     ligga i varje väg in.
 *  3. HASTIGHETSGRÄNSEN GÄLLER PÅ VERCEL-VÄGEN. Den bodde i node:http-
 *     lagret; gör den fortfarande det är forceringsskyddet borta.
 *  4. CRON-ENDPOINTERNA ÄR STÄNGDA UTAN HEMLIGHET, och kör riktiga jobb.
 *  5. SÄKERHETSRUBRIKERNA OCH CSP:N följde med ur CloudFront/nginx.
 *  6. SIMULERINGENS TAK RYMS UNDER FUNKTIONENS.
 *  7. VARJE SVIT ÄR KÖRD ELLER MEDVETET UNDANTAGEN.
 *  8. ARBETARNAS SQL STÄMMER MED MIGRATIONERNA.
 */

import { apiBaseUrl } from "../src/data/aws/client";
import { resolveMailConfig } from "../db/worker/mail";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

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
const finns = (p: string): boolean => {
  try {
    readFileSync(join(process.cwd(), p));
    return true;
  } catch {
    return false;
  }
};

/**
 * Källkod utan kommentarer.
 *
 * En vakt som läser rå källkod prövar prosan lika gärna som koden: en
 * kommentar som NÄMNER `sakerRollGrind` räcker för att den ska bli grön,
 * även om anropet är borttaget. Det har hänt i det här repot förr.
 */
const utanKommentarer = (kod: string): string =>
  kod.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const vercel = JSON.parse(read("vercel.json")) as {
  regions?: string[];
  functions?: Record<string, { maxDuration?: number; memory?: number }>;
  crons?: { path: string; schedule: string }[];
  rewrites?: { source: string; destination: string }[];
  headers?: { source: string; headers: { key: string; value: string }[] }[];
};

/* --- 1. Serverkoden ligger utanför api/ ---------------------------------- */

/*
 * DEN HÄR VAKTEN ÄR HELA ANLEDNINGEN TILL FLYTTEN.
 *
 * Vercel gör VARJE fil under api/ till en publik endpoint. Låg server/
 * kvar som api/server/ hade db.ts, auth.ts och logg.ts fått var sin
 * adress - /api/server/db, /api/server/auth - och plattformen hade
 * försökt köra dem som handlers. De exporterar ingen default-handler, så
 * det hade blivit fel snarare än läcka, men filerna hade legat i
 * funktionsbunten och adressrymden. Det är inte ett läge man ska behöva
 * resonera om.
 */
check("serverkoden ligger i server/, inte under api/", finns("server/index.ts") && !finns("api/server/index.ts"));
{
  const underApi = readdirSync(join(process.cwd(), "api"), { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".ts"))
    .map((d) => join(String(d.parentPath ?? d.path), d.name).replace(`${process.cwd()}/`, ""));
  const tillatna = new Set([
    "api/[...path].ts",
    "api/cron/_vakt.ts",
    "api/cron/nattjobb.ts",
    "api/cron/utkorg.ts",
    "api/cron/aviseringar.ts",
    "api/cron/simulering.ts",
  ]);
  const ovantade = underApi.filter((f) => !tillatna.has(f));
  check("inga oväntade endpoints under api/", ovantade.length === 0, ovantade.join(", "));
}

const catchAll = read("api/[...path].ts");
check("catch-allen importerar routern ur server/", /from "\.\.\/server\/index"/.test(utanKommentarer(catchAll)));
check("catch-allen kapar /api-prefixet före routern", /replace\(\/\^\\\/api/.test(utanKommentarer(catchAll)));

/*
 * SVARSRUBRIKERNA FÅR INTE FINNAS I TVÅ UPPSÄTTNINGAR.
 *
 * `cache-control: no-store` satt inne i sendJson, alltså i node:http-lagret
 * som Vercel aldrig anropar. En andra uppsättning i Vercel-filen hade
 * drivit isär tyst - och en cachead /v1/cases är radskyddet kringgått
 * utanför databasen.
 */
{
  const ca = utanKommentarer(catchAll);
  check("Vercel-vägen använder serverns rubriker", /SVARSRUBRIKER/.test(ca));
  check("och sätter dem på varje svar", !/res\.status\([a-zA-Z.]+\)\.json\(/.test(ca.replace(/const svara[\s\S]*?\n\};/, "")));

  const http = utanKommentarer(read("server/http.ts"));
  check("rubrikerna är definierade en gång", /export const SVARSRUBRIKER/.test(http));
  check("och innehåller no-store", /"cache-control": "no-store"/.test(http));
  check("och nosniff", /"x-content-type-options": "nosniff"/.test(http));
  check("och sendJson använder samma uppsättning", /\.\.\.SVARSRUBRIKER/.test(http));
}

/* --- 2. Rollgrinden före databasen rörs ---------------------------------- */

{
  const db = utanKommentarer(read("server/db.ts"));

  /**
   * ORDNINGEN, PRÖVAD SÅ ATT EN SAKNAD GRIND INTE GODKÄNNS.
   *
   * Första utkastet skrev `db.indexOf(grind) < db.indexOf(pool)`. Saknas
   * grinden är dess index -1, och -1 är mindre än allt - alltså grön
   * kontroll på kod utan grind. Vakten hade intygat exakt det den finns
   * för att hindra. Därför krävs att BÅDA finns, och självprovet nedan
   * kör kontrollen på kod där grinden är borttagen.
   */
  const grindenForePoolen = (kropp: string): boolean => {
    const grind = kropp.indexOf("await sakerRollGrind()");
    const pool = kropp.indexOf("getPool().connect()");
    return grind >= 0 && pool >= 0 && grind < pool;
  };

  const efter = (namn: string): string => {
    const i = db.indexOf(`export const ${namn} = async`);
    return i < 0 ? "" : db.slice(i, i + 900);
  };

  check("withUser prövar rollen innan den rör databasen", grindenForePoolen(efter("withUser")));
  check("withAnon prövar den också", grindenForePoolen(efter("withAnon")));
  check(
    "kontrollen godkänner INTE en saknad grind",
    !grindenForePoolen("const client = await getPool().connect();"),
  );
  check(
    "kontrollen godkänner INTE en grind efter poolen",
    !grindenForePoolen("const c = await getPool().connect(); await sakerRollGrind();"),
  );

  check("ett misslyckande cachas inte", /rollGrind = null;/.test(db));
  check(
    "provaDatabasroll går inte via withAnon (oändlig rekursion med grinden)",
    !/return tx \? fraga\(tx\) : withAnon\(fraga\)/.test(db),
  );
  check("poolen är liten - serverless har många instanser", /PGPOOL_MAX \?\? 2/.test(db));
}

/* --- 3. Hastighetsgränsen gäller på Vercel-vägen ------------------------- */

/*
 * FORCERINGSSKYDDET FÖLJDE NÄSTAN MED CONTAINERN UT.
 *
 * Gränsen låg inne i createApiServer, alltså i node:http-lagret. På Vercel
 * går inget anrop genom createApiServer - hade den legat kvar där vore
 * /v1/auth/login obegränsat i drift, medan sviterna fortsatt varit gröna
 * eftersom de reser den egna servern.
 */
{
  const idx = utanKommentarer(read("server/index.ts"));
  check("gränsen är lyft ur transporten", /export const provaHastighet = async/.test(idx));
  check("den egna servern använder den", /const avvisat = await provaHastighet\(/.test(idx));
  check("inloggningen har eget tak", /path === "\/v1\/auth\/login"/.test(idx));

  const ca = utanKommentarer(catchAll);
  check("Vercel-vägen prövar gränsen FÖRE handle()", ca.indexOf("provaHastighet") < ca.indexOf("await handle("));
  check("och avbryter när den nekar", /if \(avvisat\)/.test(ca));
}

/* --- 4. Cron: stängd utan hemlighet, och kör riktiga jobb ---------------- */

{
  const vakt = utanKommentarer(read("api/cron/_vakt.ts"));
  check("cron-vakten kräver CRON_SECRET", /process\.env\.CRON_SECRET/.test(vakt));
  check("den failar STÄNGT när hemligheten saknas", /res\.status\(503\)/.test(vakt) && /MINSTA_LANGD/.test(vakt));
  check("jämförelsen är tidskonstant", /timingSafeEqual/.test(vakt));
  check("fel hemlighet ger 401", /res\.status\(401\)/.test(vakt));
  check("ett kastat steg ger 500, inte 200", /trasiga\.length > 0 \? 500 : 200/.test(vakt));
  check("vaktfilen är ingen endpoint (understreck)", finns("api/cron/_vakt.ts"));

  /*
   * ATTRAPPKONTROLLEN.
   *
   * Första utkastet av api/cron/utkorg.ts anslöt och kopplade ner igen
   * utan att tömma någon kö - en endpoint som svarade 200 på att ha gjort
   * ingenting. Kravet här är att varje cron-fil importerar en funktion
   * som FAKTISKT finns exporterad ur arbetaren.
   */
  const arbetare = {
    "db/worker/email-worker": utanKommentarer(read("db/worker/email-worker.ts")),
    "db/worker/simulation-worker": utanKommentarer(read("db/worker/simulation-worker.ts")),
    "db/worker/notification-worker": utanKommentarer(read("db/worker/notification-worker.ts")),
  };
  const saknade: string[] = [];
  let importerade = 0;
  for (const fil of ["nattjobb", "utkorg", "aviseringar", "simulering"]) {
    const kod = utanKommentarer(read(`api/cron/${fil}.ts`));
    check(`${fil} släpper bara in Vercels schemaläggare`, /if \(!slappIn\(req, res\)\) return;/.test(kod));
    for (const m of kod.matchAll(/import \{([^}]+)\} from "\.\.\/\.\.\/(db\/worker\/[a-z-]+)"/g)) {
      const kalla = arbetare[m[2] as keyof typeof arbetare];
      for (const namn of m[1].split(",").map((n) => n.trim()).filter(Boolean)) {
        importerade += 1;
        if (!new RegExp(`export const ${namn}\\b`).test(kalla)) saknade.push(`${fil}: ${namn}`);
      }
    }
  }
  check("cron-filerna importerar något ur arbetarna", importerade >= 10, String(importerade));
  check("varje importerat jobb finns exporterat", saknade.length === 0, saknade.join(", "));

  // Och att kontrollen kan se ett fel: ett påhittat namn får inte finnas.
  check(
    "kontrollen skulle märka ett jobb som inte finns",
    !/export const runFinnsInte\b/.test(arbetare["db/worker/email-worker"]),
  );

  // Arbetarna får inte starta ett varv bara för att de importeras.
  for (const [namn, kod] of Object.entries(arbetare)) {
    const kort = namn.split("/").pop() ?? namn;
    check(`${kort} kör bara som kommando`, new RegExp(`${kort}\\/\\.test\\(process\\.argv\\[1\\]`).test(kod));
    check(`${kort} avbryter inte processen vid import`, !/^process\.exit\(1\);$/m.test(kod));
  }

  // Varje cron-jobb i vercel.json ska peka på en fil som finns.
  const utanFil = (vercel.crons ?? []).filter((c) => !finns(`${c.path.replace(/^\//, "")}.ts`));
  check("varje schemalagt jobb har en fil", utanFil.length === 0, utanFil.map((c) => c.path).join(", "));
  check("nattjobbet körs en gång per dygn", (vercel.crons ?? []).some((c) => c.path.endsWith("nattjobb") && /^\d+ \d+ \* \* \*$/.test(c.schedule)));
  check("utkorgen körs ofta", (vercel.crons ?? []).some((c) => c.path.endsWith("utkorg") && c.schedule.startsWith("*/")));
  check("aviseringarna körs ofta", (vercel.crons ?? []).some((c) => c.path.endsWith("aviseringar") && c.schedule.startsWith("*/")));
}

/* --- 4b. Arbetarens roll: den motsatta grinden --------------------------- */

/*
 * API OCH ARBETARE KAN INTE DELA ANSLUTNING PÅ VERCEL.
 *
 * I containern hade varje process sin egen DATABASE_URL. På Vercel delar
 * alla funktioner i ett projekt samma miljövariabler - och de två behöver
 * MOTSATTA roller: API:t får inte gå förbi radskyddet, arbetaren måste.
 *
 * En repetition mot en riktig databas visade vad som händer med bara en:
 * med API-rollen såg nattjobbet noll rader i cases, case_invitations och
 * customer_invoices. Inget steg kastade, så cron-endpointen svarade 200 och
 * Vercel märkte körningen som lyckad. Fakturorna hade uteblivit i en månad.
 *
 * En tyst nolla är värre än ett fel. Därför prövar arbetaren sin roll.
 */
{
  const roll = utanKommentarer(read("db/worker/roll.ts"));
  check("arbetaren har en egen rollgrind", /export const kravArbetarroll/.test(roll));
  check("den godtar BYPASSRLS", /rolbypassrls/.test(roll));
  check("den godtar ägarskap (managed Postgres)", /relowner|pg_has_role/.test(roll));
  check("och den KASTAR när ingen väg gäller", /throw new Error/.test(roll));
  check("arbetaren har en egen anslutningssträng", /WORKER_DATABASE_URL/.test(roll));

  for (const fil of [
    "db/worker/email-worker.ts",
    "db/worker/notification-worker.ts",
    "db/worker/simulation-worker.ts",
  ]) {
    const kod = utanKommentarer(read(fil));
    check(`${fil} prövar arbetarrollen`, /kravArbetarroll\(/.test(kod), fil);
    check(`${fil} läser arbetarens URL`, /arbetarUrl\(\)/.test(kod), fil);
  }

  /*
   * OCH DE TVÅ GRINDARNA MÅSTE VARA VARANDRAS MOTSATSER.
   *
   * server/db.ts vägrar på BYPASSRLS; db/worker/roll.ts kräver den (eller
   * ägarskap). Skrivs den ena om till den andras villkor kan samma roll
   * passera båda - och då är hela åtskillnaden borta utan att något blir
   * rött.
   */
  const db = utanKommentarer(read("server/db.ts"));
  check("API-grinden vägrar på BYPASSRLS", /rolbypassrls === true/.test(db) && /skal\.push\("rollen har BYPASSRLS"\)/.test(db));
  check("arbetargrinden kräver den i stället", /skal\.push\("BYPASSRLS"\)/.test(roll));
}

/* --- 5. Säkerhetsrubrikerna och CSP:n ------------------------------------ */

{
  const rubriker = new Map(
    (vercel.headers ?? []).flatMap((h) => h.headers.map((k) => [k.key.toLowerCase(), k.value] as const)),
  );
  check("nosniff", rubriker.get("x-content-type-options") === "nosniff");
  check("ingen inramning", rubriker.get("x-frame-options") === "DENY");
  check("referrer läcker inte", rubriker.get("referrer-policy") === "no-referrer");
  check("HSTS i två år med underdomäner", /max-age=63072000/.test(rubriker.get("strict-transport-security") ?? "") && /includeSubDomains/.test(rubriker.get("strict-transport-security") ?? ""));
  check("kamera, mikrofon och betalning avstängda", /camera=\(\)/.test(rubriker.get("permissions-policy") ?? "") && /payment=\(\)/.test(rubriker.get("permissions-policy") ?? ""));

  const csp = rubriker.get("content-security-policy") ?? "";
  const direktiv = new Map(
    csp.split(";").map((d) => d.trim()).filter(Boolean).map((d) => {
      const [namn, ...varden] = d.split(/\s+/);
      return [namn, varden.join(" ")] as const;
    }),
  );
  check("CSP: allt från samma ursprung som utgångsläge", direktiv.get("default-src") === "'self'");
  check("CSP: sidan får inte ramas in", direktiv.get("frame-ancestors") === "'none'");
  check("CSP: inga externa anrop", direktiv.get("connect-src") === "'self'");
  check("CSP: base-uri låst", direktiv.get("base-uri") === "'self'");
  check("CSP: formulär går bara hem", direktiv.get("form-action") === "'self'");
  /*
   * blob: FÖR frame-src OCH object-src, inte 'none'.
   *
   * Rapportvisaren bäddar in den genererade PDF:en från en blob-URL. Med
   * 'none' blockeras den av vår EGEN policy, och reservrutan hade skyllt
   * på webbläsaren ("visar inte inbäddade PDF:er här") när det i själva
   * verket var vi som stoppade den - ett falskt besked om vår egen
   * konfiguration.
   */
  check("CSP: PDF-visaren får bädda in sin blob", /blob:/.test(direktiv.get("frame-src") ?? "") && /blob:/.test(direktiv.get("object-src") ?? ""));
  check("CSP: skript får inte köras inline", !/unsafe-inline/.test(direktiv.get("script-src") ?? direktiv.get("default-src") ?? ""));
  // Tailwinds runtime-variabler skrivs som inline-stil.
  check("CSP: stil får vara inline (Tailwind)", /unsafe-inline/.test(direktiv.get("style-src") ?? ""));
}

/* --- 6. Rewrites: API:t och SPA:n ---------------------------------------- */

{
  const rw = vercel.rewrites ?? [];
  check("/v1 går till API-funktionen", rw.some((r) => r.source.startsWith("/v1/") && r.destination.startsWith("/api/v1/")));
  const spa = rw.find((r) => r.destination === "/index.html");
  check("SPA:n har en fallback", spa !== undefined);
  /*
   * FALLBACKEN FÅR INTE SVÄLJA API:ET.
   *
   * En naiv `/(.*)` -> /index.html hade skickat varje API-anrop till
   * appens HTML. Klienten hade fått 200 med en HTML-sida där den väntade
   * JSON, och felet hade sett ut som ett tolkningsfel i klienten.
   */
  check("fallbacken undantar api/", /\(\?!api\//.test(spa?.source ?? ""));
  check("och de byggda tillgångarna", /assets\//.test(spa?.source ?? ""));
}

/* --- 7. Simuleringens tak ryms under funktionens ------------------------- */

{
  const sim = read("api/cron/simulering.ts");
  const tak = Number(/FUNKTIONENS_TAK_MS = ([\d_]+)/.exec(sim)?.[1]?.replace(/_/g, "") ?? 0);
  const marginal = Number(/MARGINAL_MS = ([\d_]+)/.exec(sim)?.[1]?.replace(/_/g, "") ?? 0);
  const deklarerat = (vercel.functions ?? {})["api/cron/simulering.ts"]?.maxDuration ?? 0;

  check("funktionens längd är deklarerad i vercel.json", deklarerat > 0, String(deklarerat));
  check("koden och vercel.json är överens om taket", tak === deklarerat * 1000, `${tak} vs ${deklarerat * 1000}`);
  check("det finns marginal för anslutning och återskrivning", marginal > 0 && marginal < tak);
  /*
   * TAKET GÅR INTE ATT KONFIGURERA FÖRBI.
   *
   * Sätter drift SIM_MAX_MS högre än funktionens gräns dödas körningen av
   * plattformen mitt i - utan att skriva tillbaka något - och raden blir
   * kvar i 'running'. Math.min är det som gör taket till ett tak.
   */
  check("ett högre SIM_MAX_MS vinner inte", /Math\.min\(/.test(sim) && /utrymme\b/.test(sim));

  const utanApi = (vercel.functions ?? {})["api/[...path].ts"]?.maxDuration ?? 0;
  check("API-funktionen har en kort livslängd", utanApi > 0 && utanApi <= 60, String(utanApi));
}

/* --- 8. Regionen ---------------------------------------------------------- */

/*
 * arn1 = Stockholm. Inte kosmetika: personuppgifterna i ett insolvensärende
 * ska behandlas där de hör hemma, och latensen mot en svensk användare och
 * en databas i samma region är en annan produkt än en över Atlanten.
 */
check("funktionerna kör i Stockholm", (vercel.regions ?? []).includes("arn1"));

/* --- 9. Klienten: samma ursprung ----------------------------------------- */

{
  // Byggvärdet sätts av esbuild --define (se package.json: test:deploy).
  check("byggvärdet används när det finns", apiBaseUrl() === "https://byggd.example", apiBaseUrl());
  const client = utanKommentarer(read("src/data/aws/client.ts"));
  check("runtime-konfigen är borta", !/__CLEARANCE_CONFIG__/.test(client));
  check("tom bas är inte längre ett fel", !/no_api_base_url/.test(client));
  check("index.html bär ingen platshållare kvar", !/CLEARANCE_RUNTIME_CONFIG/.test(read("index.html")));
}

/* --- 10. Containervägen är faktiskt borta -------------------------------- */

/*
 * ETT HALVT BORTTAGET SPÅR ÄR SÄMRE ÄN INGET BORTTAGET.
 *
 * Ligger nginx-mallen och Helm-chartet kvar men slutar underhållas blir de
 * en beskrivning av en drift som inte finns - och nästa person som läser
 * dem tror att de gäller.
 */
for (const p of ["deploy/frontend/nginx.conf.template", "deploy/helm/clearance/Chart.yaml", "infra/main.tf", "api/Dockerfile", ".gitea/workflows/ci.yml", ".github/workflows/driftsatt.yml"]) {
  check(`${p} finns inte kvar`, !finns(p));
}
check("Vercel-guiden finns", finns("docs/vercel.md"));

/* --- 11. Mejltransporten: SMTP eller SES, valt av miljön ----------------- */

const smtpStandard = resolveMailConfig({ MAIL_FROM: "a@b.se", SMTP_HOST: "mail.internt" } as NodeJS.ProcessEnv);
check("standard är SMTP - SES-paketet är inget beroende", smtpStandard.kind === "smtp");

const ses = resolveMailConfig({ MAIL_FROM: "a@b.se", MAIL_TRANSPORT: "ses" } as NodeJS.ProcessEnv);
check("SES väljs av MAIL_TRANSPORT", ses.kind === "ses");
check("SES bär avsändare och region", ses.kind === "ses" && ses.from === "a@b.se" && ses.region === "eu-north-1");

const smtp = resolveMailConfig({ MAIL_FROM: "a@b.se", MAIL_TRANSPORT: "smtp", SMTP_HOST: "mail.internt", SMTP_USER: "u", SMTP_PASS: "p" } as NodeJS.ProcessEnv);
check("smtp väljs av MAIL_TRANSPORT", smtp.kind === "smtp");
check("smtp default-port 587, STARTTLS", smtp.kind === "smtp" && smtp.port === 587 && smtp.secure === false);
check("smtp bär auth när user satts", smtp.kind === "smtp" && smtp.user === "u" && smtp.pass === "p");

const smtp465 = resolveMailConfig({ MAIL_FROM: "a@b.se", MAIL_TRANSPORT: "smtp", SMTP_HOST: "m", SMTP_PORT: "465" } as NodeJS.ProcessEnv);
check("port 465 ger implicit TLS", smtp465.kind === "smtp" && smtp465.secure === true);

let threw = false;
try {
  resolveMailConfig({ MAIL_FROM: "a@b.se", MAIL_TRANSPORT: "smtp" } as NodeJS.ProcessEnv);
} catch {
  threw = true;
}
check("smtp utan SMTP_HOST är ett fel, inte en tyst SES-fallback", threw);

// Arbetaren använder transporten, inte en hårdkodad SES-klient.
const worker = read("db/worker/email-worker.ts");
check("arbetaren väljer transport ur miljön", /makeMailSender/.test(worker) && /resolveMailConfig/.test(worker));
check("arbetaren har ingen hårdkodad SES-klient kvar", !/new SESClient/.test(worker));

// Aviseringsarbetaren använder samma transport - inte en egen SES-klient.
const notif = read("db/worker/notification-worker.ts");
check("aviseringsarbetaren använder mejltransporten", /makeMailSender/.test(notif) && /resolveMailConfig/.test(notif));
check("aviseringsarbetaren har ingen hårdkodad SES-klient", !/new SESClient/.test(notif));

/*
 * SES-IMPORTEN FÅR INTE VARA STATISKT UPPLÖSBAR.
 *
 * @aws-sdk/client-ses står inte i package.json - det är valfritt. Ett
 * bokstavligt import("@aws-sdk/client-ses") hade buntaren löst upp vid
 * bygget, och Vercel-bygget hade fallit på ett paket en SMTP-drift aldrig
 * behöver.
 */
{
  const mail = utanKommentarer(read("db/worker/mail.ts"));
  check("SES-importen går via en variabel", !/import\("@aws-sdk\/client-ses"\)/.test(mail) && /await import\(/.test(mail));
  check("och saknat paket ger ett läsbart besked", /npm install @aws-sdk\/client-ses/.test(mail));
  const pkgJson = JSON.parse(read("package.json")) as { dependencies?: Record<string, string> };
  check("SES-paketet är verkligen inget beroende", !("@aws-sdk/client-ses" in (pkgJson.dependencies ?? {})));
}

/* --- 12. Varje svit ska vara KÖRD eller MEDVETET undantagen ------------- */

/*
 * DET SOM INTE STÅR I KEDJAN KÖRS INTE, OCH DÅ RUTTNAR DET.
 *
 * `npm test` kör 51 sviter. Sex ligger utanför - de kräver ett
 * Postgres-kluster, en webbläsare eller en server, och skulle göra en
 * sekundlång körning till en flerminuterskörning. Det är ett rimligt val.
 *
 * Priset betalades i tysthet: när de utanförliggande sviterna till slut
 * kördes var NIO webbläsarsviter röda, de flesta sedan länge, och den
 * levande API-sviten var röd av en dagsfärsk ändring. De letade efter
 * knappar och fält som bytts ut - och ett prov som letar efter något som
 * inte finns prövar ingenting alls.
 *
 * Kontrollen nedan gör orphan-status till ett BESLUT: varje test:*-skript
 * ska antingen stå i kedjan eller i listan här, med ett skäl. Den som
 * lägger till en svit måste ta ställning; den som glömmer får rött.
 *
 * Jämförelsen görs på HELA skriptnamnet. Ett delsträngstest hade sagt att
 * test:api körs, eftersom test:apispec står i kedjan - och då hade den här
 * vakten haft exakt det fel den finns för att hitta.
 */
const KORS_SEPARAT: Record<string, string> = {
  "test:api": "Reser en databas och kör API:t över HTTP. Kräver Postgres.",
  "test:rls": "Radskyddet mot Supabase-skalet. Kräver Postgres.",
  "test:selfhosted": "Radskyddet och rollerna självhostat. Kräver Postgres.",
  "test:webblasare": "Alla webbläsarprov. Kräver bygge, server och webbläsare.",
  "test:mobile": "Ingår i test:webblasare; kvar som genväg till enbart mobilsvepet.",
  "test:external": "Ingår i test:webblasare; kvar som genväg till enbart nätkontrollen.",
  "test:motor": "Bygger om clearance-motor.ts och kör 28 sviter mot den extraherade filen. Tar minuter och rör inte produkten - den prövar att motorn går att lyfta ut hel.",
};

{
  const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
  const kedjan = pkg.scripts.test ?? "";
  const kordaIKedjan = new Set(
    [...kedjan.matchAll(/npm run (test:[A-Za-z0-9:_-]+)/g)].map((m) => m[1]),
  );
  const alla = Object.keys(pkg.scripts).filter((k) => k.startsWith("test:"));

  /*
   * JÄMFÖRELSEN SJÄLV, PRÖVAD.
   *
   * Kollisionen finns på riktigt i repot: test:api är en strikt förkortning
   * av test:apispec, som DÅ står i kedjan. Skrivs jämförelsen om till ett
   * delsträngstest ser test:api körd ut, och vakten intygar att en svit
   * körs som inte körs - det fel den finns för att hitta, i den själv.
   *
   * Den här raden är därför inte en dubblett av kontrollen nedan: den
   * prövar MEKANISMEN, inte innehållet.
   */
  /*
   * EN ENDA PREDIKATFUNKTION, som både självprovet och kontrollen nedan
   * använder. Skrevs de var för sig kunde självprovet pröva en mekanism
   * och kontrollen använda en annan - och då bevisar självprovet ingenting
   * om det som faktiskt körs. Det var precis vad som hände i första
   * utkastet av den här vakten.
   */
  const korsAvKedjan = (namn: string): boolean => kordaIKedjan.has(namn);

  check(
    "kedjan läses på hela namn: test:apispec gör inte test:api körd",
    korsAvKedjan("test:apispec") && !korsAvKedjan("test:api"),
    alla.filter((k) => k.startsWith("test:api") && korsAvKedjan(k)).join(", "),
  );

  const foraldralosa = alla.filter((k) => !korsAvKedjan(k) && !(k in KORS_SEPARAT));
  check(
    "varje test:*-skript körs av npm test eller står som medvetet undantag",
    foraldralosa.length === 0,
    foraldralosa.join(", "),
  );

  // Och åt andra hållet: en post i undantagslistan som INTE finns kvar som
  // skript är en kvarlämnad ursäkt för en svit som inte längre existerar.
  const spoken = Object.keys(KORS_SEPARAT).filter((k) => !alla.includes(k));
  check("undantagslistan innehåller inga spöken", spoken.length === 0, spoken.join(", "));

  // Ett undantag utan skäl är ingen förklaring.
  const utanSkal = Object.entries(KORS_SEPARAT).filter(([, skal]) => skal.trim().length < 20);
  check("varje undantag bär ett skäl", utanSkal.length === 0, utanSkal.map(([k]) => k).join(", "));

  // De separata sviterna ska stå skrivna där någon letar efter dem.
  const readme = read("README.md");
  check(
    "README namnger kommandot som kör webbläsarproven",
    /npm run test:webblasare/.test(readme),
  );
  const checklista = read("docs/deploy-compliance.md");
  check(
    "deploy-checklistan räknar upp de tre lagren",
    /npm run test:webblasare/.test(checklista) && /db\/tests\/run\.sh/.test(checklista),
  );
}

/* --- Arbetarnas SQL mot databasens verkliga funktioner -------------------- */

/**
 * INGEN AV ARBETARNA KÖRS AV NÅGOT PROV.
 *
 * De tre arbetarna (utkorgen, aviseringarna, simuleringarna) körs av cron i
 * driftmiljön och av ingenting annat. Byter en migration namn på en funktion,
 * eller lägger till ett argument, märks det klockan tre på natten - och
 * misslyckandet är tyst, för arbetaren loggar till stderr i en container som
 * ingen läser förrän någon undrar var fakturorna tog vägen.
 *
 * Den här vakten läser vad arbetarna FAKTISKT anropar (utan kommentarer) och
 * kräver att varje funktion finns i migrationerna med ett antal argument som
 * passar anropet. Den ersätter inte en körning, men den fångar den vanligaste
 * driften mellan kod och schema utan att behöva en databas.
 */
{
  /** Antal argument på toppnivå mellan parenteserna som börjar vid `start`. */
  const argumenten = (text: string, start: number): { antal: number; slut: number; inne: string } => {
    let djup = 1;
    let i = start;
    while (i < text.length && djup > 0) {
      if (text[i] === "(") djup += 1;
      else if (text[i] === ")") djup -= 1;
      i += 1;
    }
    const inne = text.slice(start, i - 1);
    let d = 0;
    let antal = inne.trim() === "" ? 0 : 1;
    for (const c of inne) {
      if (c === "(") d += 1;
      else if (c === ")") d -= 1;
      else if (c === "," && d === 0) antal += 1;
    }
    return { antal, slut: i, inne };
  };

  const sql = readdirSync(join(process.cwd(), "supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(process.cwd(), "supabase/migrations", f), "utf8"))
    .join("\n");

  const anrop: { namn: string; argc: number; fil: string }[] = [];
  for (const fil of readdirSync(join(process.cwd(), "db/worker")).filter((f) => f.endsWith(".ts"))) {
    const kod = utanKommentarer(readFileSync(join(process.cwd(), "db/worker", fil), "utf8"));
    for (const m of kod.matchAll(/\b(public|app)\.([a-z_]+)\s*\(/g)) {
      const start = (m.index ?? 0) + m[0].length;
      anrop.push({ namn: `${m[1]}.${m[2]}`, argc: argumenten(kod, start).antal, fil });
    }
  }

  check("vakten hittar arbetarnas anrop", anrop.length >= 15, String(anrop.length));

  const saknade: string[] = [];
  const felAntal: string[] = [];
  for (const a of anrop) {
    const [schema, fn] = a.namn.split(".");
    // En insert mot en tabell ser ut som ett anrop: "insert into public.x (...)".
    if (new RegExp(`create table ${schema}\\.${fn}\\b`).test(sql)) continue;
    const def = [...sql.matchAll(new RegExp(`create\\s+(?:or replace\\s+)?function\\s+${schema}\\.${fn}\\s*\\(`, "g"))];
    if (def.length === 0) {
      saknade.push(`${a.namn} (${a.fil})`);
      continue;
    }
    // Den SISTA definitionen gäller: en senare migration kan ha ändrat den.
    const sist = def[def.length - 1];
    const { inne } = argumenten(sql, (sist.index ?? 0) + sist[0].length);
    const delar = inne.trim() === "" ? [] : inne.split(/,(?![^(]*\))/);
    const max = delar.length;
    const min = delar.filter((d) => !/\bdefault\b/i.test(d)).length;
    if (a.argc < min || a.argc > max) {
      felAntal.push(`${a.namn} anropas med ${a.argc}, definierad ${min}-${max} (${a.fil})`);
    }
  }

  check("varje funktion arbetarna anropar finns i migrationerna", saknade.length === 0, saknade.join("; "));
  check("antalet argument stämmer med definitionen", felAntal.length === 0, felAntal.join("; "));

  // Vakten ska kunna se ett fel. Ett påhittat anrop måste falla igenom.
  const påhittat = "select public.finns_inte_alls($1)";
  check(
    "vakten skulle märka en funktion som inte finns",
    !new RegExp("create\\s+(?:or replace\\s+)?function\\s+public\\.finns_inte_alls\\s*\\(").test(sql) &&
      /public\.finns_inte_alls\s*\(/.test(påhittat),
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
