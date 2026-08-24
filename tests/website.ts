/**
 * HÄMTNINGEN AV BOLAGETS WEBBPLATS (server/website.ts).
 *
 * Tolkningen prövas i tests/sources.ts. Här prövas det som bara den
 * nätvända biten kan ha fel i, och det farligaste av det står först:
 *
 *  1. SSRF-SKYDDET. En server som hämtar en URL användaren pekar ut får
 *     ALDRIG luras att hämta en intern adress - molnets metadata-endpoint,
 *     databasen på 10.x, localhost. Testet skjuter in en DNS-uppslagare som
 *     pekar ut privata adresser och kräver att hämtningen vägrar INNAN den
 *     rör nätet.
 *  2. ROBOTS.TXT FÖRST. Säger sidans robots nej blir svaret "forbjuden",
 *     inte ett tyst tomt resultat.
 *  3. ATT DE FYRA UTFALLEN HÅLLS ISÄR: traff, forbjuden, ingen-traff, fel.
 *
 * Både fetch och DNS-uppslagaren är inskjutna, så hela kedjan prövas utan
 * att röra nät eller namnuppslag.
 */

import { fetchWebsite, isPrivateAddress, websiteConfigured } from "../server/website";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra = "") => {
  if (ok) passed++;
  else {
    failed++;
    console.log(`FAIL ${name} ${extra}`);
  }
};

/* --- 1. SSRF: privata adresser känns igen ------------------------------ */

for (const ip of [
  "127.0.0.1",
  "10.0.0.5",
  "192.168.1.1",
  "172.16.0.1",
  "172.31.255.255",
  "169.254.169.254", // molnets metadata-endpoint - den farligaste
  "0.0.0.0",
  "::1",
  "fe80::1",
  "fc00::1",
  "fd12:3456::1",
]) {
  check(`privat adress vägras: ${ip}`, isPrivateAddress(ip) === true);
}
for (const ip of ["8.8.8.8", "93.184.216.34", "2606:2800:220:1::1"]) {
  check(`publik adress släpps: ${ip}`, isPrivateAddress(ip) === false);
}

/* --- Hjälpare: en fetch som svarar olika på robots.txt och sidan ------- */

const svarFran = (
  sidor: Record<string, { status?: number; contentType?: string; body?: string }>,
): { f: typeof fetch; besokta: string[] } => {
  const besokta: string[] = [];
  const f = (async (url: string | URL | Request) => {
    const s = String(url);
    besokta.push(s);
    const rad = sidor[s];
    if (!rad) return new Response("", { status: 404 });
    return new Response(rad.body ?? "", {
      status: rad.status ?? 200,
      headers: { "content-type": rad.contentType ?? "text/html; charset=utf-8" },
    });
  }) as unknown as typeof fetch;
  return { f, besokta };
};

/** En uppslagare som pekar ut givna adresser för varje värdnamn. */
const slarUpp = (adress: string) => async () => [adress];
const publikt = slarUpp("93.184.216.34");

const SIDA_MED_FAKTA = `<html><head>
<script type="application/ld+json">
{"@type":"Organization","name":"Nordbygg AB","description":"Vi bygger stommar i trä."}
</script></head><body><a href="mailto:info@nordbygg.se">Skriv</a></body></html>`;

/* --- 2. websiteConfigured är alltid true (publik sida, ingen nyckel) --- */

check("källan är alltid konfigurerad", websiteConfigured() === true);

/* --- 3. SSRF-skyddet stoppar innan nätet rörs -------------------------- */

{
  const { f, besokta } = svarFran({});
  const r = await fetchWebsite("http://internt.example", f, slarUpp("10.0.0.5"));
  check("privat DNS-svar ger fel", r.status === "fel", JSON.stringify(r));
  check("och ingen hämtning gjordes", besokta.length === 0, besokta.join(","));
  check("felet röjer inte att en intern adress finns",
    r.status === "fel" && !/10\.0\.0\.5|intern/i.test(r.reason), r.status === "fel" ? r.reason : "");
}

{
  const { f, besokta } = svarFran({});
  const r = await fetchWebsite("http://169.254.169.254/latest/meta-data/", f, publikt);
  check("metadata-adressen som IP vägras", r.status === "fel", JSON.stringify(r));
  check("och rörde inte nätet", besokta.length === 0);
}

{
  const { f, besokta } = svarFran({});
  const r = await fetchWebsite("http://localhost:8080/", f, publikt);
  check("localhost vägras utan att ens slå upp", r.status === "fel", JSON.stringify(r));
  check("och rörde inte nätet", besokta.length === 0);
}

/* --- 4. Protokoll och adress ------------------------------------------- */

{
  const { f } = svarFran({});
  const r = await fetchWebsite("ftp://nordbygg.se/fil", f, publikt);
  check("bara http och https hämtas", r.status === "fel" && /http/.test(r.reason), JSON.stringify(r));
}
{
  const { f } = svarFran({});
  const r = await fetchWebsite("inte en url", f, publikt);
  check("en trasig adress är ett fel", r.status === "fel", JSON.stringify(r));
}

/* --- 5. robots.txt först ----------------------------------------------- */

{
  const { f } = svarFran({
    "https://nordbygg.se/robots.txt": { body: "User-agent: *\nDisallow: /" },
    "https://nordbygg.se/": { body: SIDA_MED_FAKTA },
  });
  const r = await fetchWebsite("https://nordbygg.se/", f, publikt);
  check("robots som säger nej ger forbjuden", r.status === "forbjuden", JSON.stringify(r));
}

{
  // robots.txt saknas (404) = allt tillåtet enligt standarden.
  const { f, besokta } = svarFran({
    "https://nordbygg.se/": { body: SIDA_MED_FAKTA },
  });
  const r = await fetchWebsite("https://nordbygg.se/", f, publikt);
  check("saknad robots.txt tolkas som tillåtet", r.status === "traff", JSON.stringify(r));
  check("sidan lästes efter robots", besokta.some((u) => u.endsWith("/robots.txt")) && besokta.includes("https://nordbygg.se/"));
  check("träffen bär fakta ur sidan", r.status === "traff" && r.facts.name === "Nordbygg AB", JSON.stringify(r));
  check("träffen bär en läsbar not", r.status === "traff" && r.note.length > 10, r.status === "traff" ? r.note : "");
}

{
  // robots.txt går inte att nå alls (kastar) - då avstår vi hellre.
  const trasig = (async (url: string | URL) => {
    if (String(url).endsWith("/robots.txt")) throw new Error("nätet");
    return new Response(SIDA_MED_FAKTA, { status: 200, headers: { "content-type": "text/html" } });
  }) as unknown as typeof fetch;
  const r = await fetchWebsite("https://nordbygg.se/", trasig, publikt);
  check("oåtkomlig robots.txt ger fel, inte hämtning ändå", r.status === "fel", JSON.stringify(r));
}

/* --- 6. Själva sidan: de tre utfallen ---------------------------------- */

{
  const { f } = svarFran({
    "https://nordbygg.se/": { status: 500, body: "" },
  });
  const r = await fetchWebsite("https://nordbygg.se/", f, publikt);
  check("en felkod från sidan är ett fel", r.status === "fel" && /500/.test(r.reason), JSON.stringify(r));
}

{
  const { f } = svarFran({
    "https://nordbygg.se/": { contentType: "application/pdf", body: "%PDF-1.4" },
  });
  const r = await fetchWebsite("https://nordbygg.se/", f, publikt);
  check("en PDF är inte en webbsida", r.status === "ingen-traff", JSON.stringify(r));
}

{
  const { f } = svarFran({
    "https://nordbygg.se/": { body: "<html><body><p>Hej</p></body></html>" },
  });
  const r = await fetchWebsite("https://nordbygg.se/", f, publikt);
  check("en sida utan uppgifter ger ingen-traff, inte påhitt", r.status === "ingen-traff", JSON.stringify(r));
}

/* --- 7. Rätt user-agent skickas --------------------------------------- */

{
  let seddInit: RequestInit | undefined;
  const f = (async (url: string | URL, init?: RequestInit) => {
    if (String(url).endsWith("/")) seddInit = init;
    return new Response(SIDA_MED_FAKTA, { status: 200, headers: { "content-type": "text/html" } });
  }) as unknown as typeof fetch;
  await fetchWebsite("https://nordbygg.se/", f, publikt);
  const h = (seddInit?.headers ?? {}) as Record<string, string>;
  check("vi säger vilka vi är i user-agent", /ClearanceBot/.test(h["user-agent"] ?? ""), h["user-agent"]);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
