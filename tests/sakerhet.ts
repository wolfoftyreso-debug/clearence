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

import { isPrivateAddress, fetchWebsite } from "../api/server/website";
import { klientNyckel } from "../api/server/rateLimit";
import { readFileSync } from "node:fs";
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

const web = utanKommentarer(readFileSync(join(process.cwd(), "api/server/website.ts"), "utf8"));
check(
  'website.ts använder aldrig redirect: "follow"',
  !/redirect:\s*["']follow["']/.test(web),
  web.match(/redirect:\s*["'][a-z]+["']/g),
);
check('website.ts följer omdirigeringar manuellt', /redirect:\s*["']manual["']/.test(web));

const rl = readFileSync(join(process.cwd(), "api/server/rateLimit.ts"), "utf8");
check(
  "rateLimit.ts tar inte längre den FÖRSTA posten ur x-forwarded-for",
  !/split\(","\)\[0\]/.test(rl) && !/\[0\]\?\.trim\(\)/.test(rl),
);

const httpKod = readFileSync(join(process.cwd(), "api/server/http.ts"), "utf8");
check(
  "API:t sätter aldrig Access-Control-Allow-Origin: *",
  !/access-control-allow-origin/i.test(httpKod),
);
check("svaren bär nosniff", /x-content-type-options/i.test(httpKod));
check("ärendedata cachas aldrig av mellanled", /no-store/.test(httpKod));

const indexKod = readFileSync(join(process.cwd(), "api/server/index.ts"), "utf8");
check(
  "inga råa databasfel läcker ut (generiskt 500-svar finns)",
  /internal_error/.test(indexKod) && /Något gick fel/.test(indexKod),
);

// Frontend får aldrig bära en serversecret.
const frontendKallor = ["src/data/aws/client.ts", "src/integrations/supabase/client.ts"];
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

// Nginx: säkerhetsrubrikerna får inte tappas i location-block. add_header
// ÄRVS INTE ned i ett block som har egna add_header - då måste de upprepas.
const nginx = readFileSync(join(process.cwd(), "deploy/frontend/nginx.conf.template"), "utf8");
const locationBlock = (namn: string): string => {
  // Leta efter DIREKTIVET (radbörjan + "{" på samma rad), inte efter texten
  // var som helst - annars träffar sökningen en kommentar som nämner den.
  const rad = new RegExp(`^[ \\t]*${namn.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}\\s*\\{`, "m");
  const traff = rad.exec(nginx);
  if (!traff) return "";
  const i = traff.index;
  const start = nginx.indexOf("{", i);
  let djup = 0;
  for (let j = start; j < nginx.length; j++) {
    if (nginx[j] === "{") djup++;
    if (nginx[j] === "}") {
      djup--;
      if (djup === 0) return nginx.slice(start, j);
    }
  }
  return "";
};
for (const block of ["location = /index.html", "location /assets/"]) {
  const kod = locationBlock(block);
  check(`${block} behåller nosniff`, /x-content-type-options/i.test(kod), block);
  check(`${block} behåller klickkapningsskyddet`, /x-frame-options/i.test(kod), block);
  check(`${block} behåller referrer-policy`, /referrer-policy/i.test(kod), block);
}
check("nginx sätter HSTS", /strict-transport-security/i.test(nginx));
check("nginx sätter en innehållspolicy (CSP)", /content-security-policy/i.test(nginx));
check("CSP:n förbjuder inramning", /frame-ancestors/i.test(nginx));
check("nginx sätter Permissions-Policy", /permissions-policy/i.test(nginx));

// Den döda XSS-sänkan ska vara borta ur trädet.
let harChart = true;
try {
  readFileSync(join(process.cwd(), "src/components/ui/chart.tsx"), "utf8");
} catch {
  harChart = false;
}
check("den oanvända dangerouslySetInnerHTML-komponenten är borttagen", harChart === false);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
