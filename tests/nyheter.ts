/**
 * NYHETSKÄLLAN: tolkningen, matchningen och hela hämtningskedjan.
 *
 * Två saker prövas, och de är olika slags påståenden:
 *
 *  1. TOLKNINGEN (src/lib/sources/news.ts) mot verkliga flödesformat -
 *     RSS 2.0 med CDATA och entiteter, Atom med link-attribut och flera
 *     rel-varianter. Ett flöde som tolkas fel ger en tom bevakning som ser
 *     ut som "inget har hänt".
 *  2. HÄMTNINGEN (api/server/news.ts) med injicerad fetch och injicerad
 *     DNS-uppslagning. Hela kedjan går alltså att pröva utan nät: SSRF-
 *     skyddet, tidsgränsen, innehållstypen och utfallet per flöde.
 *
 * VAD PROVET INTE KAN SÄGA: att de FÖRVALDA flödesadresserna svarar. Den
 * miljö koden skrevs i når inte svenska mediesajter (gatewayen svarar 403),
 * så ingen skarp hämtning har gjorts. Det är också därför utfallet
 * redovisas per flöde ända ut i gränssnittet - en död adress ska synas
 * första gången någon kör, inte tigas ihjäl.
 */

import {
  matchaPost,
  namnGarAttMatcha,
  newsNote,
  normaliseraNamn,
  parseFeed,
  sammanstall,
  type NewsHit,
} from "../src/lib/sources/news";
import { DEFAULT_FEEDS, fetchNews, newsConfigured, parseFeedSetting } from "../api/server/news";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (ok) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${name}${extra === undefined ? "" : `\n     ${JSON.stringify(extra)}`}`);
  }
};

const BOLAG = { companyName: "Nordisk Bygg AB", orgNumber: "556012-3456" };

/* --- 1. RSS 2.0 ----------------------------------------------------------- */

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Exempeltidningen</title>
  <item>
    <title><![CDATA[Nordisk Bygg AB varslar 40 anställda]]></title>
    <link>https://exempel.se/artikel/1?utm_source=rss</link>
    <pubDate>Tue, 12 Aug 2026 07:30:00 GMT</pubDate>
    <description>Ska inte läsas.</description>
  </item>
  <item>
    <title>Byggbranschen v&#228;ntar sig t&amp;uml;ffare h&#xF6;st</title>
    <link>https://exempel.se/artikel/2</link>
    <pubDate>Mon, 11 Aug 2026 09:00:00 GMT</pubDate>
  </item>
  <item>
    <title>Utan länk</title>
  </item>
</channel></rss>`;

const rss = parseFeed(RSS, "Exempeltidningen");
check("två poster läses ut, den utan länk hoppas över", rss.length === 2, rss.length);
check("CDATA avkodas", rss[0].title === "Nordisk Bygg AB varslar 40 anställda", rss[0].title);
check("numeriska entiteter avkodas", /väntar/.test(rss[1].title), rss[1].title);
check("hexadecimala entiteter avkodas", /höst/.test(rss[1].title), rss[1].title);
check("ampersanden avkodas sist och inte i två steg", /t&uml;ffare/.test(rss[1].title), rss[1].title);
check("datumet blir ISO", rss[0].publishedAt === "2026-08-12T07:30:00.000Z", rss[0].publishedAt);
check("källan följer med varje post", rss.every((p) => p.source === "Exempeltidningen"));
check("beskrivningen läses aldrig ut", !JSON.stringify(rss).includes("Ska inte läsas"));

/* --- 2. Atom -------------------------------------------------------------- */

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Ekot</title>
  <entry>
    <title>Nordisk Bygg ansöker om rekonstruktion</title>
    <link rel="self" href="https://exempel.se/flode.xml"/>
    <link rel="alternate" href="https://exempel.se/atom/1"/>
    <published>2026-08-10T12:00:00Z</published>
  </entry>
  <entry>
    <title>En annan nyhet</title>
    <link href="https://exempel.se/atom/2"/>
    <updated>2026-08-09T12:00:00Z</updated>
  </entry>
</feed>`;

const atom = parseFeed(ATOM, "Ekot");
check("atom-poster läses ut", atom.length === 2, atom.length);
check(
  "rel=self tas inte som artikellänk",
  atom[0].link === "https://exempel.se/atom/1",
  atom[0].link,
);
check("link utan rel duger", atom[1].link === "https://exempel.se/atom/2", atom[1].link);
check("published läses som datum", atom[0].publishedAt === "2026-08-10T12:00:00.000Z", atom[0].publishedAt);
check("updated duger när published saknas", atom[1].publishedAt === "2026-08-09T12:00:00.000Z", atom[1].publishedAt);

check("skräp ger inga poster i stället för att kasta", parseFeed("<html>nej</html>", "X").length === 0);
check("tomt flöde ger tom lista", parseFeed("", "X").length === 0);

/* --- 3. Matchningen: den som avgör om bevakningen är värd något ----------- */

check("bolagsformen räknas inte in i namnet", normaliseraNamn("Nordisk Bygg AB") === "nordisk bygg");
check("publ och holding räknas inte heller", normaliseraNamn("Acme Holding AB (publ)") === "acme");

const traff = matchaPost(rss[0], BOLAG);
check("namnet i rubriken ger träff", traff?.matchedOn === "namn", traff);
check("och bara branschordet ger ingen träff", matchaPost(rss[1], BOLAG) === null);

// Den viktigaste kontrollen i filen: en fras som BÖRJAR med namnet men
// fortsätter är ett annat bolag.
check(
  "delordsträff avvisas",
  matchaPost({ title: "Nordisk Byggvaror expanderar", link: "https://x.se/a", publishedAt: null, source: "X" }, BOLAG) === null,
);
check(
  "omvänt också: namnet får inte sitta inuti ett längre ord",
  matchaPost({ title: "Stornordisk Bygg köper mark", link: "https://x.se/b", publishedAt: null, source: "X" }, BOLAG) === null,
);

// Organisationsnumret, i båda skrivsätten.
for (const [rubrik, form] of [
  ["Beslut i mål mot 556012-3456", "med bindestreck"],
  ["Konkursbeslut 5560123456 meddelat", "utan bindestreck"],
]) {
  const t = matchaPost({ title: rubrik, link: "https://x.se/c", publishedAt: null, source: "X" }, BOLAG);
  check(`organisationsnumret ${form} ger träff`, t?.matchedOn === "orgnr", t);
}

// Ett för allmänt namn matchas inte alls - och det SÄGS.
check("ett enda branschord är för allmänt", !namnGarAttMatcha("Bygg AB"));
check("ett kort namn är för allmänt", !namnGarAttMatcha("El AB"));
check("två ord räcker", namnGarAttMatcha("Nordisk Bygg AB"));
check("ett eget ord räcker", namnGarAttMatcha("Kvarnholmen AB"));
check(
  "för allmänt namn ger ingen namnträff",
  matchaPost({ title: "Bygg går bra i Norrland", link: "https://x.se/d", publishedAt: null, source: "X" },
    { companyName: "Bygg AB", orgNumber: "556000-0000" }) === null,
);

/* --- 4. Sammanställningen ------------------------------------------------- */

const h = (title: string, link: string, publishedAt: string | null, source = "A"): NewsHit => ({
  title, link, publishedAt, source, matchedOn: "namn",
});

const samlade = sammanstall([
  h("Gammal nyhet", "https://a.se/1", "2026-08-01T00:00:00.000Z"),
  h("Ny nyhet", "https://a.se/2", "2026-08-12T00:00:00.000Z"),
  h("Odaterad", "https://a.se/3", null),
  // Samma artikel, olika spårningsparametrar och avslutande snedstreck.
  h("Ny nyhet", "https://a.se/2?utm_campaign=x", "2026-08-12T00:00:00.000Z"),
  h("Ny nyhet", "https://a.se/2/", "2026-08-12T00:00:00.000Z"),
  // Samma rubrik hos en annan tidning: en händelse, inte två.
  h("Ny nyhet", "https://b.se/9", "2026-08-11T00:00:00.000Z", "B"),
]);
check("dubbletter på länk faller bort", samlade.length === 3, samlade.map((x) => x.link));
check("nyast först", samlade[0].title === "Ny nyhet", samlade[0]);
check("odaterat hamnar sist", samlade[samlade.length - 1].title === "Odaterad", samlade);
check("taket hålls", sammanstall(Array.from({ length: 40 }, (_, i) => h(`N${i}`, `https://a.se/${i}`, null)), 10).length === 10);

/* --- 5. Noten: den ska kunna svara på "hur vet ni det?" ------------------- */

const utfall = [
  { name: "Alfa", status: "svarade" as const, items: 20 },
  { name: "Beta", status: "svarade-inte" as const, items: 0 },
];
const noten = newsNote([samlade[0]], utfall, BOLAG);
check("noten räknar flödena", /1 av 2 flöden svarade/.test(noten), noten);
check("och namnger det som tystnade", /Beta svarade inte/.test(noten), noten);
check("och säger att artikeltexten inte sparas", /upphovsrättsskyddad/.test(noten), noten);
check(
  "utan träffar sägs det rakt ut",
  /Ingen artikel nämnde bolaget/.test(newsNote([], utfall, BOLAG)),
);
check(
  "ett för allmänt namn förklaras i stället för att tiga",
  /för allmänt/.test(newsNote([], utfall, { companyName: "Bygg AB" })),
);
check("utan angiven källa sägs det också", /Ingen nyhetskälla är angiven/.test(newsNote([], [], BOLAG)));

/* --- 6. Driftparametern --------------------------------------------------- */

check("förvalet används när parametern saknas", parseFeedSetting(undefined).length === DEFAULT_FEEDS.length);
check("en trasig parameter faller tillbaka på förvalet", parseFeedSetting("nej").length === DEFAULT_FEEDS.length);
check("en tom lista faller tillbaka på förvalet", parseFeedSetting([]).length === DEFAULT_FEEDS.length);
check(
  "rader utan namn eller adress sållas bort",
  parseFeedSetting([{ name: "A", url: "https://a.se/rss" }, { name: "B" }, { url: "https://c.se" }]).length === 1,
);
check(
  "en adress som inte är http avvisas",
  parseFeedSetting([{ name: "Fil", url: "file:///etc/passwd" }]).length === DEFAULT_FEEDS.length,
);
check("källan är ansluten när det finns ett flöde", newsConfigured([{ name: "A", url: "https://a.se" }]));
check("och inte ansluten utan flöden", !newsConfigured([]));

/* --- 7. Hämtningen, hela kedjan utan nät ---------------------------------- */

const svar = (kropp: string, typ = "application/rss+xml", ok = true): Response =>
  ({
    ok,
    status: ok ? 200 : 500,
    headers: { get: (n: string) => (n.toLowerCase() === "content-type" ? typ : null) },
    text: async () => kropp,
  }) as unknown as Response;

const publikDns = async () => ["93.184.216.34"];

await (async () => {
  // 7a. Två flöden, ett svarar med en träff, ett svarar inte.
  const besokta: string[] = [];
  const hamta = (async (url: string) => {
    besokta.push(String(url));
    if (String(url).includes("alfa")) return svar(RSS);
    throw new Error("nätfel");
  }) as unknown as typeof fetch;

  const r = await fetchNews(
    BOLAG,
    [{ name: "Alfa", url: "https://alfa.se/rss" }, { name: "Beta", url: "https://beta.se/rss" }],
    hamta,
    publikDns,
  );
  check("status blir träff", r.status === "traff", r.status);
  check("träffen är den rätta artikeln", r.hits[0]?.link.startsWith("https://exempel.se/artikel/1"), r.hits);
  check("bara rubrik, länk, datum och källa i svaret", Object.keys(r.hits[0] ?? {}).sort().join(",") === "link,matchedOn,publishedAt,source,title", Object.keys(r.hits[0] ?? {}));
  check("utfallet redovisas per flöde", r.feeds.length === 2, r.feeds);
  check("flödet som inte svarade syns", r.feeds.find((f) => f.name === "Beta")?.status === "svarade-inte", r.feeds);
  check("noten nämner det tysta flödet", /Beta svarade inte/.test(r.note), r.note);
  check("båda flödena hämtades", besokta.length === 2, besokta);

  // 7b. SSRF: en intern adress hämtas ALDRIG, och inget anrop görs.
  const anrop: string[] = [];
  const spionera = (async (url: string) => {
    anrop.push(String(url));
    return svar(RSS);
  }) as unknown as typeof fetch;
  const privatDns = async () => ["169.254.169.254"];
  const ssrf = await fetchNews(BOLAG, [{ name: "Metadata", url: "https://intern.example/rss" }], spionera, privatDns);
  check("privat adress ger inget anrop alls", anrop.length === 0, anrop);
  check("och redovisas som att flödet inte svarade", ssrf.feeds[0]?.status === "svarade-inte", ssrf.feeds);

  for (const [url, vad] of [
    ["http://localhost/rss", "localhost"],
    ["https://127.0.0.1/rss", "loopback"],
    ["file:///etc/passwd", "file"],
    ["https://nagot.internal/rss", ".internal"],
  ]) {
    const a: string[] = [];
    const h2 = (async (u: string) => { a.push(String(u)); return svar(RSS); }) as unknown as typeof fetch;
    await fetchNews(BOLAG, [{ name: vad, url }], h2, publikDns);
    check(`${vad} hämtas aldrig`, a.length === 0, a);
  }

  // 7c. HTML i stället för XML är en felsida eller en samtyckesruta.
  const html = await fetchNews(BOLAG, [{ name: "Alfa", url: "https://alfa.se/rss" }],
    (async () => svar("<html>Godkänn kakor</html>", "text/html")) as unknown as typeof fetch, publikDns);
  check("html räknas inte som ett flöde", html.feeds[0]?.status === "svarade-inte", html.feeds);

  // 7d. Ett fel svar räknas inte som tomt flöde.
  const femhundra = await fetchNews(BOLAG, [{ name: "Alfa", url: "https://alfa.se/rss" }],
    (async () => svar("", "application/xml", false)) as unknown as typeof fetch, publikDns);
  check("ett 500-svar räknas som att flödet inte svarade", femhundra.feeds[0]?.status === "svarade-inte");

  // 7e. Utan flöden är källan inte ansluten - och säger det.
  const utan = await fetchNews(BOLAG, [], (async () => svar(RSS)) as unknown as typeof fetch, publikDns);
  check("utan flöden: ingen-kalla", utan.status === "ingen-kalla", utan.status);
  check("och noten säger varför", /Ingen nyhetskälla är angiven/.test(utan.note), utan.note);

  // 7f. Flödet svarar men inget nämner bolaget. Det är ett SVAR.
  const inget = await fetchNews(
    { companyName: "Kvarnholmen AB", orgNumber: "556999-9999" },
    [{ name: "Alfa", url: "https://alfa.se/rss" }],
    (async () => svar(RSS)) as unknown as typeof fetch,
    publikDns,
  );
  check("inget om bolaget ger ingen-traff, inte fel", inget.status === "ingen-traff", inget.status);
  check("och flödet redovisas som att det svarade", inget.feeds[0]?.status === "svarade", inget.feeds);
})();

/* --- 8. Källregistret säger samma sak som koden --------------------------- */

const registry = (await import("../src/lib/sources/registry")).sourceById("nyheter")!;
check("källan är markerad som ansluten", registry.live === true);
check("och som körningsberoende", registry.runtime === true);
check("den lovar inte fulltext", /lagras aldrig|upphovsrättsskyddad/.test(registry.basis), registry.basis);
check("den nämner driftparametern vid namn", /news_feeds/.test(registry.basis), registry.basis);
check(
  "och är fortsatt ärlig om att djup mediebevakning inte ingår",
  /Retriever|Meltwater/.test(registry.basis),
  registry.basis,
);
check("inget krav står kvar när källan är ansluten", registry.needs === "", registry.needs);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
