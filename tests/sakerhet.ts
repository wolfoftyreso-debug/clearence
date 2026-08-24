/**
 * SÄKERHETSSVITEN: attacker, och beviset att de blockeras.
 *
 * Varje kontroll här motsvarar en väg in som en angripare faktiskt skulle
 * pröva. Sviten är skriven som angriparen, inte som utvecklaren: den
 * lyckade vägen är INTE det som prövas - det är den blockerade.
 *
 * Reglerna sviten vaktar, och varför var och en finns:
 *
 *  1. SSRF genom omdirigering. Att pröva värdnamnet i adressen och sedan
 *     låta fetch följa vart som helst är inget skydd alls. Angriparen pekar
 *     på sin egen publika server och svarar 302 mot molnets metadata.
 *  2. Hastighetsgränsens nyckel. Tas den ur klientens egen del av
 *     x-forwarded-for får angriparen en färsk räknare per anrop, och
 *     spärren mot lösenordsforcering finns inte längre.
 *  3. Adresslistan. En privat adress i IPv6-avbildad form är samma adress.
 *  4. Källkodsvakter för sådant som inte får återinföras.
 */

import { isPrivateAddress, fetchWebsite } from "../server/website";
import { klientNyckel } from "../server/rateLimit";
import { loggaFel, maskera, maskeraText } from "../server/logg";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (ok) passed++;
  else {
    failed++;
    console.log(`FAIL ${name}${extra === undefined ? "" : `\n     ${JSON.stringify(extra)}`}`);
  }
};

/* --- 1. SSRF: adresslistan ------------------------------------------------ */

const privata = [
  "127.0.0.1",
  "127.1.2.3",
  "10.0.0.1",
  "192.168.1.1",
  "172.16.0.1",
  "172.31.255.255",
  "169.254.169.254", // molnets metadata
  "0.0.0.0",
  "0.1.2.3",
  "100.64.0.1", // CGNAT
  "100.127.255.255",
  "::1",
  "::",
  "fe80::1",
  "fd00::1",
  "fc00::1",
  "::ffff:169.254.169.254", // IPv4 avbildad i IPv6 - samma adress
  "::ffff:127.0.0.1",
  "::ffff:10.0.0.1",
];
for (const ip of privata) {
  check(`privat adress blockeras: ${ip}`, isPrivateAddress(ip) === true, ip);
}

const publika = ["8.8.8.8", "1.1.1.1", "93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"];
for (const ip of publika) {
  check(`publik adress tillåts: ${ip}`, isPrivateAddress(ip) === false, ip);
}

/* --- 2. SSRF: omdirigeringen är en NY begäran ---------------------------- */

/** DNS-attrapp: allt utom de utpekade interna namnen är publikt. */
const slaUpp = async (host: string): Promise<string[]> => {
  if (host === "internt.example") return ["10.0.0.5"];
  if (host === "metadata.example") return ["169.254.169.254"];
  return ["93.184.216.34"];
};

const svarMed = (status: number, headers: Record<string, string>, body = ""): Response =>
  new Response(body, { status, headers });

// Angreppet: en publik värd som omdirigerar till molnets metadata.
{
  const besokta: string[] = [];
  const hamta = (async (url: string | URL) => {
    const u = String(url);
    besokta.push(u);
    if (u.endsWith("/robots.txt")) return svarMed(404, {});
    if (u.startsWith("https://angripare.example/")) {
      return svarMed(302, { location: "http://169.254.169.254/latest/meta-data/" });
    }
    return svarMed(200, { "content-type": "text/html" }, "<title>hemligt</title>");
  }) as unknown as typeof fetch;

  const res = await fetchWebsite("https://angripare.example/start", hamta, slaUpp);
  check("omdirigering mot molnmetadata följs INTE", res.status === "fel", res);
  check(
    "och metadata-adressen hämtades aldrig",
    !besokta.some((u) => u.includes("169.254.169.254")),
    besokta,
  );
  check(
    "svaret röjer inte varför (ingen intern adress i texten)",
    res.status === "fel" && !/169\.254|intern|metadata/i.test(res.reason),
    res,
  );
}

// Angreppet igen, mot ett internt värdnamn i stället för en IP.
{
  const besokta: string[] = [];
  const hamta = (async (url: string | URL) => {
    const u = String(url);
    besokta.push(u);
    if (u.endsWith("/robots.txt")) return svarMed(404, {});
    if (u.startsWith("https://angripare.example/")) {
      return svarMed(301, { location: "https://internt.example/admin" });
    }
    return svarMed(200, { "content-type": "text/html" }, "<title>hemligt</title>");
  }) as unknown as typeof fetch;

  const res = await fetchWebsite("https://angripare.example/start", hamta, slaUpp);
  check("omdirigering mot intern värd följs INTE", res.status === "fel", res);
  check("och den interna värden hämtades aldrig", !besokta.some((u) => u.includes("internt.example")), besokta);
}

// Omdirigering till en ANNAN PUBLIK värd ska fortfarande fungera - skyddet
// får inte vara så trubbigt att det bryter vanliga sajter.
{
  const hamta = (async (url: string | URL) => {
    const u = String(url);
    if (u.endsWith("/robots.txt")) return svarMed(404, {});
    if (u === "https://bolaget.example/start") {
      return svarMed(302, { location: "https://bolaget.example/hem" });
    }
    return svarMed(200, { "content-type": "text/html" }, "<title>Bolaget AB</title><meta name='description' content='Vi bygger saker'>");
  }) as unknown as typeof fetch;

  const res = await fetchWebsite("https://bolaget.example/start", hamta, slaUpp);
  check("omdirigering mellan publika adresser följs som vanligt", res.status === "traff", res);
}

// En slinga ska ta slut, inte hänga.
{
  const hamta = (async (url: string | URL) => {
    const u = String(url);
    if (u.endsWith("/robots.txt")) return svarMed(404, {});
    return svarMed(302, { location: "https://bolaget.example/varv" });
  }) as unknown as typeof fetch;
  const res = await fetchWebsite("https://bolaget.example/varv", hamta, slaUpp);
  check("en omdirigeringsslinga avbryts", res.status === "fel", res);
}

// Protokollbyte (http(s) -> file/gopher) får aldrig följas.
{
  const hamta = (async (url: string | URL) => {
    const u = String(url);
    if (u.endsWith("/robots.txt")) return svarMed(404, {});
    return svarMed(302, { location: "file:///etc/passwd" });
  }) as unknown as typeof fetch;
  const res = await fetchWebsite("https://bolaget.example/x", hamta, slaUpp);
  check("omdirigering till file:// följs INTE", res.status === "fel", res);
}

// Direkt angrepp utan omdirigering ska fortfarande blockeras (regression).
{
  const hamta = (async () => svarMed(200, { "content-type": "text/html" })) as unknown as typeof fetch;
  const res = await fetchWebsite("http://169.254.169.254/latest/meta-data/", hamta, slaUpp);
  check("direkt adress till molnmetadata blockeras", res.status === "fel", res);
  const res2 = await fetchWebsite("http://localhost:8080/admin", hamta, slaUpp);
  check("localhost blockeras", res2.status === "fel", res2);
}

/* --- 3. Hastighetsgränsens nyckel går inte att förfalska ---------------- */

const utanProxy = { ...process.env };
process.env.TRUSTED_PROXY_HOPS = "1";

check(
  "utan x-forwarded-for används socketens adress",
  klientNyckel({}, "203.0.113.9") === "203.0.113.9",
);

// nginx sätter "$proxy_add_x_forwarded_for" = "<klientens text>, <sedd adress>".
// Den SISTA posten är den enda proxyn själv observerat.
check(
  "med ETT betrott mellanled tas adressen proxyn såg (sist), inte klientens text",
  klientNyckel({ "x-forwarded-for": "1.2.3.4, 198.51.100.7" }, "10.0.0.1") === "198.51.100.7",
);

// Angreppet: rotera det första värdet för att få en färsk räknare per anrop.
{
  const nycklar = new Set<string>();
  for (let i = 0; i < 50; i++) {
    nycklar.add(klientNyckel({ "x-forwarded-for": `9.9.9.${i}, 198.51.100.7` }, "10.0.0.1"));
  }
  check(
    "50 förfalskade adresser ger EN räknare, inte 50",
    nycklar.size === 1 && nycklar.has("198.51.100.7"),
    [...nycklar].slice(0, 5),
  );
}

process.env.TRUSTED_PROXY_HOPS = "2";
check(
  "med TVÅ betrodda mellanled räknas två steg från höger",
  klientNyckel({ "x-forwarded-for": "1.2.3.4, 198.51.100.7, 10.0.0.2" }, "10.0.0.1") === "198.51.100.7",
);
check(
  "en kedja som är kortare än antalet hopp faller tillbaka på socketen",
  klientNyckel({ "x-forwarded-for": "1.2.3.4" }, "203.0.113.9") === "203.0.113.9",
);

process.env.TRUSTED_PROXY_HOPS = "0";
check(
  "utan betrodda mellanled ignoreras rubriken helt",
  klientNyckel({ "x-forwarded-for": "1.2.3.4" }, "203.0.113.9") === "203.0.113.9",
);
process.env.TRUSTED_PROXY_HOPS = utanProxy.TRUSTED_PROXY_HOPS ?? "1";

/* --- 4. Källkodsvakter: det som inte får återinföras -------------------- */

/** Kod utan kommentarer - en vakt ska läsa vad koden GÖR, inte vad den beskriver. */
const utanKommentarer = (kod: string): string =>
  kod.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const web = utanKommentarer(readFileSync(join(process.cwd(), "server/website.ts"), "utf8"));
check(
  'website.ts använder aldrig redirect: "follow"',
  !/redirect:\s*["']follow["']/.test(web),
  web.match(/redirect:\s*["'][a-z]+["']/g),
);
check('website.ts följer omdirigeringar manuellt', /redirect:\s*["']manual["']/.test(web));

const rl = readFileSync(join(process.cwd(), "server/rateLimit.ts"), "utf8");
check(
  "rateLimit.ts tar inte längre den FÖRSTA posten ur x-forwarded-for",
  !/split\(","\)\[0\]/.test(rl) && !/\[0\]\?\.trim\(\)/.test(rl),
);

const httpKod = readFileSync(join(process.cwd(), "server/http.ts"), "utf8");
check(
  "API:t sätter aldrig Access-Control-Allow-Origin: *",
  !/access-control-allow-origin/i.test(httpKod),
);
check("svaren bär nosniff", /x-content-type-options/i.test(httpKod));
check("ärendedata cachas aldrig av mellanled", /no-store/.test(httpKod));

const indexKod = readFileSync(join(process.cwd(), "server/index.ts"), "utf8");
check(
  "inga råa databasfel läcker ut (generiskt 500-svar finns)",
  /internal_error/.test(indexKod) && /Något gick fel/.test(indexKod),
);

// Frontend får aldrig bära en serversecret.
const frontendKallor = ["src/data/aws/client.ts"];
for (const f of frontendKallor) {
  let kod = "";
  try {
    kod = readFileSync(join(process.cwd(), f), "utf8");
  } catch {
    continue;
  }
  check(
    `${f} bär ingen serversecret`,
    !/ANTHROPIC_API_KEY|SERVICE_ROLE|service_role|SECRET_ACCESS_KEY|SMTP_PASS/.test(kod),
  );
}

/*
 * SÄKERHETSRUBRIKERNA.
 *
 * Här stod en kontroll av nginx-mallen: add_header ÄRVS INTE ned i ett
 * location-block som har egna add_header, så rubrikerna måste upprepas i
 * varje sådant block. Det var en verklig bugg en gång - index.html och
 * /assets/ saknade både nosniff och klickkapningsskydd.
 *
 * Nginx finns inte längre. Rubrikerna sätts av vercel.json, och den fällan
 * finns inte där. En annan gör det: rubriker som bara gäller EN sökväg. En
 * regel vars source inte matchar allt lämnar resten av produkten utan
 * skydd, och det syns inte förrän någon läser konfigurationen.
 */
{
  const vercel = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as {
    headers?: { source: string; headers: { key: string; value: string }[] }[];
  };
  const regler = vercel.headers ?? [];
  // Regeln som gäller ALLA sökvägar. Utan en sådan är skyddet fläckvis.
  const allaVagar = regler.filter((r) => r.source === "/(.*)" || r.source === "/:path*");
  check("det finns en rubrikregel som gäller varje sökväg", allaVagar.length > 0);

  const satta = new Set(
    allaVagar.flatMap((r) => r.headers.map((h) => h.key.toLowerCase())),
  );
  for (const rubrik of [
    "x-content-type-options",
    "x-frame-options",
    "referrer-policy",
    "strict-transport-security",
    "content-security-policy",
    "permissions-policy",
  ]) {
    check(`${rubrik} gäller hela produkten`, satta.has(rubrik));
  }

  const csp =
    allaVagar
      .flatMap((r) => r.headers)
      .find((h) => h.key.toLowerCase() === "content-security-policy")?.value ?? "";
  check("CSP:n förbjuder inramning", /frame-ancestors 'none'/.test(csp), csp);

  /*
   * OCH INGEN SMALARE REGEL FÅR TA BORT DEM.
   *
   * Vercel slår ihop matchande header-regler, och en senare regel med
   * samma nyckel VINNER. En regel för /assets/ som sätter en slappare CSP
   * hade alltså tyst öppnat just den sökvägen. Kontrollen kräver att varje
   * smalare regel som rör en säkerhetsrubrik är ett medvetet tillägg, inte
   * en försvagning - i praktiken: den får inte röra dem alls.
   */
  const smalare = regler.filter((r) => !allaVagar.includes(r));
  const overskrivna = smalare.flatMap((r) =>
    r.headers.filter((h) => satta.has(h.key.toLowerCase())).map((h) => `${r.source}: ${h.key}`),
  );
  check("ingen smalare regel skriver över en säkerhetsrubrik", overskrivna.length === 0, overskrivna.join(", "));
}

// Den döda XSS-sänkan ska vara borta ur trädet.
let harChart = true;
try {
  readFileSync(join(process.cwd(), "src/components/ui/chart.tsx"), "utf8");
} catch {
  harChart = false;
}
check("den oanvända dangerouslySetInnerHTML-komponenten är borttagen", harChart === false);

/* --- 5. Loggen: tillräckligt för att felsöka, aldrig nog för att stjäla -- */

/*
 * `console.error("api error", error)` skrev hela felobjektet rakt ut. Ett
 * pg-fel bär `query` OCH `parameters` - alltså den SQL som kördes och de
 * VÄRDEN som skickades in. Ett fel i inloggningen kunde därmed skriva ett
 * lösenordsförsök till loggen.
 */

// Ett pg-liknande fel med allt det farliga i sig.
const pgFel = Object.assign(new Error('duplicate key value violates unique constraint'), {
  code: "23505",
  constraint: "auth_users_email_key",
  table: "users",
  query: "insert into auth.users (email, password_hash) values ($1, $2)",
  parameters: ["agnes@bolag-a.se", "scrypt$32768$8$1$aGVq$c2Vjcg"],
});

{
  const rader: unknown[] = [];
  loggaFel("api_fel", pgFel, { rutt: "/v1/auth/login" }, (...a) => rader.push(...a));
  const text = rader.join(" ");
  check("loggen bär felkoden (annars är den värdelös)", /23505/.test(text), text.slice(0, 200));
  check("loggen bär villkoret som brast", /auth_users_email_key/.test(text));
  check("men INTE frågans parametervärden", !/scrypt\$32768/.test(text), text.slice(0, 300));
  check("och inte lösenordshashen", !/c2Vjcg/.test(text));
  check("e-postadressen maskeras (personuppgift, inte felsökningsdata)", !/agnes@bolag-a\.se/.test(text), text.slice(0, 300));
  check("loggraden är en giltig JSON-rad", (() => { try { JSON.parse(String(rader[0])); return true; } catch { return false; } })());
}

// Mönster som är hemliga var de än står.
check("en API-nyckel maskeras i fritext", !maskeraText("nyckeln clr_abcdef123456 användes").includes("clr_abcdef123456"));
check("en Anthropic-nyckel maskeras", !maskeraText("sk-ant-api03-AbCdEf_123456").includes("sk-ant-api03-AbCdEf"));
check("en sha256-hash (token/nyckel) maskeras", !maskeraText(`hash ${"a".repeat(64)}`).includes("a".repeat(64)));
check("en anslutningssträng maskeras", !maskeraText("postgres://user:hemligt@db:5432/x").includes("hemligt"));
check("ett JWT maskeras", !maskeraText("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdef").includes("eyJhbGciOiJIUzI1NiJ9"));

// Fältnamn vars värde aldrig får skrivas.
{
  const ut = JSON.stringify(maskera({
    password: "hemligt",
    token: "abc123",
    authorization: "Bearer xyz",
    api_key: "clr_x",
    nested: { password_hash: "h", ofarligt: "syns" },
  }));
  check("hemliga fältnamn maskeras oavsett djup", !/hemligt|abc123|Bearer xyz/.test(ut), ut);
  check("och ofarliga fält står kvar", /syns/.test(ut), ut);
}

check("maskeringen hänger sig inte på cykliska objekt", (() => {
  const a: Record<string, unknown> = {}; a.sig = a;
  try { JSON.stringify(maskera(a)); return true; } catch { return false; }
})());

const loggKod = utanKommentarer(readFileSync(join(process.cwd(), "server/index.ts"), "utf8"));
check(
  "index.ts loggar aldrig ett rått felobjekt igen",
  !/console\.error\(\s*["'][^"']*["']\s*,\s*error\s*\)/.test(loggKod),
  loggKod.match(/console\.error\([^)]*\)/g),
);

/* --- 6. Databasrollen: uppstarten vägrar om radskyddet är avstängt ------ */

/*
 * Produktens farligaste felkonfiguration failar ÖPPET: pekas DATABASE_URL
 * på superanvändaren, på ägaren eller på en roll med BYPASSRLS fortsätter
 * varje fråga att fungera - den börjar bara returnera andra bolags data.
 * Kontrollen körs före första requesten och stoppar uppstarten.
 */

const dbKod = utanKommentarer(readFileSync(join(process.cwd(), "server/db.ts"), "utf8"));
check("db.ts prövar superanvändare", /rolsuper/.test(dbKod));
check("db.ts prövar BYPASSRLS", /rolbypassrls/.test(dbKod));
check("db.ts prövar tabellägarskap", /relowner/.test(dbKod));
check("och en osäker roll KASTAR (vägrar starta)", /throw new Error\("osäker databasroll/.test(dbKod));

const mainKod = utanKommentarer(readFileSync(join(process.cwd(), "server/main.ts"), "utf8"));
check("uppstarten prövar rollen FÖRE listen()", (() => {
  const i = mainKod.indexOf("kravSakerDatabasroll");
  const j = mainKod.indexOf(".listen(");
  return i > 0 && j > 0 && i < j;
})(), { krav: mainKod.indexOf("kravSakerDatabasroll"), listen: mainKod.indexOf(".listen(") });
check("och avslutar processen om den inte går att starta", /process\.exit\(1\)/.test(mainKod));

/*
 * OCH SAMMA VÄGRAN I SERVERLESS, DÄR DEN FAKTISKT GÄLLER.
 *
 * main.ts kör bara den egna servern (utvecklingsläget och test:api). I
 * drift går varje anrop genom api/[...path].ts, där ingen uppstart finns
 * att vägra i. Höll bara kontrollen ovan vore rollgrinden intygad av ett
 * prov på en väg som inte används.
 */
{
  const efter = (namn: string): string => {
    const i = dbKod.indexOf(`export const ${namn} = async`);
    return i < 0 ? "" : dbKod.slice(i, i + 900);
  };
  const grindenForePoolen = (kropp: string): boolean => {
    const grind = kropp.indexOf("await sakerRollGrind()");
    const pool = kropp.indexOf("getPool().connect()");
    return grind >= 0 && pool >= 0 && grind < pool;
  };
  check("withUser prövar rollen före databasen", grindenForePoolen(efter("withUser")));
  check("withAnon gör det också", grindenForePoolen(efter("withAnon")));
  // -1 < allt: en kontroll skriven som ren indexjämförelse hade godkänt
  // kod UTAN grind. Prövas här så att den inte skrivs om till det.
  check("kontrollen godkänner inte en saknad grind", !grindenForePoolen("await getPool().connect();"));
}

/*
 * UNDANTAGET FÅR FINNAS FÖR SVITERNA - ALDRIG I DRIFTKONFIGURATIONEN.
 *
 * ALLOW_UNSAFE_DB_ROLE=1 stänger av vägran mot en roll som kringgår
 * radskyddet. Det står här för att sviterna ansluter som superanvändaren
 * med flit (fixturerna ska inte bero på de policyer som är under test).
 * Hamnar det i det som rullas ut är hela grinden en artighet.
 *
 * Chartet vaktades förut. Chartet finns inte längre - vercel.json och
 * cron-endpointerna är det som rullas ut, och de vaktas i stället.
 */
for (const f of ["vercel.json", "api/[...path].ts", "api/cron/nattjobb.ts", "api/cron/utkorg.ts", "api/cron/aviseringar.ts", "api/cron/simulering.ts", "api/cron/_vakt.ts"]) {
  let kod = "";
  try { kod = readFileSync(join(process.cwd(), f), "utf8"); } catch { continue; }
  check(`${f} sätter aldrig ALLOW_UNSAFE_DB_ROLE`, !/ALLOW_UNSAFE_DB_ROLE/.test(kod));
}

/* --- 5. Telefonverifieringen: koden får inte födas hos den som ska bevisa - */

/*
 * ANGREPPET: skaffa ett konto, läs frontendens kod (den är läsbar för alla
 * som kan öppna DevTools), och se att verifieringskoden slumpas i
 * webbläsaren. Välj då koden själv, skicka in dess hash, hoppa över SMS:et
 * och bekräfta direkt. Resultatet: ett "verifierat" nummer som tillhör
 * någon annan - och som därefter får SMS om att någon har ett ärende hos
 * CLEARANCE, vilket är precis den uppgift produkten finns för att skydda.
 *
 * ÅTGÄRDEN: koden föds i start_phone_verification (migration
 * 20260822100000), i samma transaktion som SMS:et köas, och returneras
 * aldrig. Rättningen ligger i DATABASEN och inte i API:t, så att den
 * gäller varje väg in - eget API, PostgREST och psql.
 *
 * Kontrollerna nedan läser källorna, för det är där återfallet skulle ske.
 */

const telefonKod = utanKommentarer(
  readFileSync(join(process.cwd(), "src/lib/notifications/phone.ts"), "utf8"),
);
check(
  "det delade telefonbiblioteket myntar ingen verifieringskod",
  !/getRandomValues|generateCode/.test(telefonKod),
  telefonKod.match(/getRandomValues|generateCode/g),
);
check(
  "och hashar ingen heller - en hash klienten kan räkna fram ÄR beviset",
  !/subtle\.digest|hashCode/.test(telefonKod),
  telefonKod.match(/subtle\.digest|hashCode/g),
);

const awsKod = utanKommentarer(
  readFileSync(join(process.cwd(), "src/data/aws/adapter.ts"), "utf8"),
);
for (const [namn, kod] of [["aws", awsKod]] as const) {
  check(
    `${namn}-adaptern skickar aldrig in en kodhash till verifieringen`,
    !/p_code_sha256/.test(kod),
    kod.match(/p_code_sha256/g),
  );
  check(
    `${namn}-adaptern köar aldrig SMS-texten själv`,
    !/queue_verification_sms/.test(kod),
  );
}

/**
 * Den GÄLLANDE definitionen av start_phone_verification.
 *
 * Filnamnet står inte här, och det är avsiktligt: funktionen har redan
 * skrivits om en gång (taket per konto och dygn, migration 20260826100000),
 * och ett prov som pekar på ett filnamn hade då granskat en definition
 * databasen inte längre använder - grönt, och meningslöst. Sista
 * migrationen som definierar funktionen är den som gäller.
 */
const gallandeVerifieringsSql = (): string => {
  const katalog = join(process.cwd(), "db/migrations");
  const filer = readdirSync(katalog)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  let senast = "";
  for (const fil of filer) {
    const text = readFileSync(join(katalog, fil), "utf8");
    if (/create or replace function public\.start_phone_verification/.test(text)) senast = text;
  }
  return senast;
};

const verifieringSql = gallandeVerifieringsSql();
check("den gällande verifieringsdefinitionen hittades", verifieringSql.length > 500, verifieringSql.length);

/*
 * De två kontrollerna nedan är påståenden om en HÄNDELSE - att den gamla
 * signaturen och queue_verification_sms faktiskt togs bort - och den
 * händelsen ligger i sin migration för alltid. Därför läses den vid namn.
 * Kontrollerna efter dem gäller hur funktionen ser ut NU, och följer
 * därför den senaste definitionen.
 */
const ursprungsMigrationen = readFileSync(
  join(process.cwd(), "db/migrations/20260822100000_verifieringskoden_fods_i_databasen.sql"),
  "utf8",
);
check(
  "migrationen DROPPAR den gamla signaturen i stället för att lämna den kvar",
  /drop function if exists public\.start_phone_verification\(text, text, integer\)/.test(
    ursprungsMigrationen,
  ),
);
check(
  "queue_verification_sms finns inte kvar som egen yta",
  /drop function if exists public\.queue_verification_sms\(text\)/.test(ursprungsMigrationen),
);
check(
  "koden slumpas med gen_random_bytes, inte med random()",
  // Kommentarerna nämner random() just för att förklara varför den INTE
  // används; vakten ska läsa koden, inte prosan runt den.
  /gen_random_bytes\(5\)/.test(verifieringSql) &&
    !/\brandom\(\)/.test(utanKommentarer(verifieringSql)),
);
check(
  "den nya funktionen tar bara nummer och giltighetstid - ingen hash",
  /create or replace function public\.start_phone_verification\(\s*p_e164 text,\s*p_ttl_minutes integer default 10\s*\)/.test(
    verifieringSql,
  ),
);
check(
  "och returnerar void: koden lämnar aldrig databasen åt klientens håll",
  /p_ttl_minutes integer default 10\s*\)\s*returns void/.test(verifieringSql),
);

const aviseringsRutter = indexKod.slice(
  indexKod.indexOf("/v1/notifications/prefs"),
  indexKod.indexOf("Drift (/ops)"),
);
/*
 * Svarskropparna, ordagrant.
 *
 * En bredare vakt ("ordet code får inte förekomma") gick inte att skriva
 * ärligt: bekräftelserutten TAR EMOT en kod, och den ska den göra. Det som
 * betyder något är vad som går UT, så det är returraderna som prövas.
 */
check(
  "begäran om kod svarar exakt { sent: true } - inget mer",
  /return \{ status: 200, body: \{ sent: true \} \};/.test(aviseringsRutter),
);
check(
  "bekräftelsen svarar exakt { verified } - aldrig koden tillbaka",
  /return \{ status: 200, body: \{ verified: ok \} \};/.test(aviseringsRutter),
);
check(
  "API:t normaliserar numret själv i stället för att lita på klienten",
  /normaliseraSvensktMobilnummer\(phone\)/.test(indexKod),
);
check(
  "GET /v1/notifications/phone lämnar aldrig ut hela numret",
  /masked: maskeraNummer\(String\(row\.e164\)\)/.test(indexKod) &&
    !/e164: row\.e164/.test(indexKod),
);
check(
  "kvittolistans tak sätts av servern, inte av frågesträngen",
  /Math\.min\(raw, 100\)/.test(indexKod),
);


/* --- 9. Lösenordet igen, före det som inte går att ångra ----------------- */

/*
 * EN SESSION ÄR INGET BEVIS PÅ ATT DET ÄR SAMMA MÄNNISKA SOM SITTER DÄR.
 *
 * En olåst dator, en glömd utloggning på en delad maskin, en stulen token:
 * alla ger exakt de rättigheter kontot har. Fram till bekräftelsen räckte
 * det för att RADERA kontot och för att MYNTA en API-nyckel som gäller
 * långt efter att sessionen återkallats.
 *
 * Karenstiden på sju dagar räcker inte som skydd mot det: den som har
 * sessionen kan återkalla begäran lika lätt som hen gjorde den, och begära
 * om den dagen efter. Det enda som stoppar en kapad session är en fråga
 * den inte kan svara på.
 *
 * Vakten läser KODEN, inte kommentarerna - och den prövar handlern för
 * RÄTT METOD. En sökvägsträff hade läst GET-handlern på samma sökväg och
 * gått grön på en POST utan bekräftelse.
 */
const serverUtanPrat = utanKommentarer(indexKod);

const handlareFor = (metod: string, rutt: string): string => {
  const start = serverUtanPrat.search(
    new RegExp(`router\\.${metod}\\(\\s*"${rutt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`),
  );
  if (start === -1) return "";
  const nasta = serverUtanPrat.slice(start + 1).search(/\n(?:router\.[a-z]+\(|caseScoped\()/);
  return serverUtanPrat.slice(start, nasta === -1 ? undefined : start + 1 + nasta);
};

// De två åtgärderna som ökar en angripares räckvidd bortom sessionen.
for (const [metod, rutt, varfor] of [
  ["post", "/v1/me/erasure", "raderingen går inte att ångra efter karenstiden"],
  ["post", "/v1/api-keys", "nyckeln överlever sessionen som skapade den"],
] as const) {
  const kropp = handlareFor(metod, rutt);
  check(`${metod.toUpperCase()} ${rutt} hittades i servern`, kropp.length > 0);
  check(
    `${metod.toUpperCase()} ${rutt} kräver lösenordet - ${varfor}`,
    /await confirmPassword\(caller, req\)/.test(kropp),
    kropp.slice(0, 200),
  );
}

// Och bekräftelsen ska faktiskt PRÖVA lösenordet, inte bara ta emot det.
const bekraftelsen = serverUtanPrat.slice(
  serverUtanPrat.indexOf("const confirmPassword"),
  serverUtanPrat.indexOf("router.post(\"/v1/auth/logout\""),
);
check("bekräftelsen finns", bekraftelsen.length > 0);
check(
  "bekräftelsen jämför mot lösenordshashen i databasen",
  /verifyPassword\(password, stored/.test(bekraftelsen),
);
check(
  "bekräftelsen avvisar när hashen saknas - ingen gren hoppar över kontrollen",
  /if \(!stored \|\| !ok\) throw forbidden/.test(bekraftelsen),
);
check(
  "bekräftelsen räknas på KONTOT, inte på klientadressen",
  /provaGrans\(`bekraftelse:\$\{caller\.userId\}`, BEKRAFTELSE\)/.test(bekraftelsen),
  bekraftelsen.match(/provaGrans\([^\n]*/)?.[0],
);
check(
  "och ett överskridet tak stoppar anropet i stället för att bara noteras",
  /if \(!grans\.tillaten\) \{[\s\S]{0,200}throw new ApiError\(\s*429/.test(bekraftelsen),
);

// Återkallandet av en nyckel ska INTE kräva lösenordet: den som misstänker
// en läcka ska kunna stänga nyckeln direkt. Vakten låser fast det valet så
// att ingen "harmoniserar" bort det i en städrunda.
check(
  "att återkalla en nyckel kräver INTE lösenordet",
  !/await confirmPassword/.test(handlareFor("post", "/v1/api-keys/:keyId/revoke")),
);

// Lösenordet får aldrig ta vägen genom en logg.
check(
  "lösenordsfältet maskeras i loggen",
  /"password"/.test(utanKommentarer(readFileSync(join(process.cwd(), "server/logg.ts"), "utf8"))),
);


console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
