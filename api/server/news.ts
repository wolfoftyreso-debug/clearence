/**
 * HÄMTNINGEN AV NYHETSFLÖDENA.
 *
 * Tolkningen (flödesformat, matchning, avdubblering, noten) bor i
 * src/lib/sources/news.ts och är prövad utan nät. Det här är hämtningen.
 *
 * TRE SAKER SOM SKILJER DEN FRÅN EN VANLIG FETCH.
 *
 *  1. SAMMA SSRF-SKYDD SOM WEBBPLATSLÄSAREN. Flödena kommer ur en
 *     driftparameter, och en driftparameter är något en människa skriver.
 *     En felskrivning - eller en illvillig administratör - ska inte kunna
 *     få servern att hämta molnets metadata-endpoint. Skyddet återanvänds
 *     från website.ts i stället för att skrivas en gång till: två kopior av
 *     ett säkerhetsskydd är en som glöms bort.
 *
 *  2. INGEN ROBOTS.TXT-FRÅGA. Det är avsiktligt och inte en genväg. Ett
 *     RSS-flöde ÄR publicerat för att hämtas maskinellt - det är hela dess
 *     syfte, till skillnad från en webbsida som är publicerad för att läsas
 *     av människor. Vi identifierar oss ändå med samma user-agent.
 *
 *  3. ETT FLÖDE SOM INTE SVARAR DÖLJS ALDRIG. Utfallet redovisas per flöde
 *     hela vägen ut till användaren. En bevakning som tyst blivit tunnare
 *     är värre än ingen bevakning: den läses som "inget har hänt".
 *
 * FLÖDENA ÄR EN DRIFTPARAMETER, inte en kodrad. Listan nedan är en
 * UTGÅNGSPUNKT som drift ändrar i app_settings (nyckeln news_feeds), av
 * samma skäl som priset och gallringstiderna: en källa som kräver en ny
 * release för att bytas är en källa som aldrig byts. Adresserna är valda
 * för att de publicerar RSS öppet - de har INTE kunnat provhämtas i den
 * miljö koden skrevs i, och därför är utfallet per flöde synligt i
 * gränssnittet från första körningen.
 */

import {
  matchaPost,
  newsNote,
  parseFeed,
  sammanstall,
  type FeedOutcome,
  type NewsHit,
} from "../../src/lib/sources/news";
import { isPrivateAddress } from "./website";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export interface FeedSpec {
  name: string;
  url: string;
}

/**
 * Utgångslistan. Drift byter den utan release; se filhuvudet.
 *
 * Fyra flöden och inte fyrtio: varje flöde är en hämtning per körning, och
 * en bevakning som tar en halv minut används inte av någon som har en kris
 * att hantera.
 */
export const DEFAULT_FEEDS: FeedSpec[] = [
  { name: "Dagens industri", url: "https://www.di.se/rss" },
  { name: "SVT Nyheter Ekonomi", url: "https://www.svt.se/nyheter/ekonomi/rss.xml" },
  { name: "Sveriges Radio Ekot", url: "https://api.sr.se/api/rss/program/83" },
  { name: "Breakit", url: "https://www.breakit.se/feed/artiklar" },
];

const USER_AGENT = "ClearanceBot/1.0 (+https://clearance.se/bot)";
const TIMEOUT_MS = 8_000;
/** Ett flöde är rubriker. Behöver det mer än så är det inte ett flöde. */
const MAX_BYTES = 1_000_000;

export type NewsResult =
  | { status: "traff"; hits: NewsHit[]; feeds: FeedOutcome[]; note: string }
  | { status: "ingen-traff"; hits: []; feeds: FeedOutcome[]; note: string }
  | { status: "ingen-kalla"; hits: []; feeds: []; note: string };

/** Sant när minst ett flöde är angivet - annars är källan inte ansluten. */
export const newsConfigured = (feeds: FeedSpec[] = DEFAULT_FEEDS): boolean => feeds.length > 0;

/**
 * Läser driftparameterns lista, med utgångslistan som förval.
 *
 * En trasig eller halvskriven parameter ska INTE tysta bevakningen utan
 * att någon märker det - då faller den tillbaka på förvalet, och det syns
 * i utfallet vilka flöden som faktiskt lästes.
 */
export const parseFeedSetting = (varde: unknown): FeedSpec[] => {
  if (!Array.isArray(varde)) return DEFAULT_FEEDS;
  const ut: FeedSpec[] = [];
  for (const rad of varde) {
    if (!rad || typeof rad !== "object") continue;
    const r = rad as { name?: unknown; url?: unknown };
    if (typeof r.name !== "string" || typeof r.url !== "string") continue;
    if (!/^https?:\/\//i.test(r.url.trim())) continue;
    ut.push({ name: r.name.trim().slice(0, 80), url: r.url.trim() });
  }
  return ut.length > 0 ? ut : DEFAULT_FEEDS;
};

const defaultResolve = async (host: string): Promise<string[]> => {
  const svar = await lookup(host, { all: true });
  return svar.map((s) => s.address);
};

const hostArSaker = async (
  host: string,
  slaUpp: (host: string) => Promise<string[]>,
): Promise<boolean> => {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) {
    return false;
  }
  if (isIP(host)) return !isPrivateAddress(host);
  try {
    const adresser = await slaUpp(host);
    return adresser.length > 0 && adresser.every((a) => !isPrivateAddress(a));
  } catch {
    return false;
  }
};

const medTidsgrans = async (hamta: typeof fetch, url: string): Promise<Response> => {
  const avbryt = new AbortController();
  const klocka = setTimeout(() => avbryt.abort(), TIMEOUT_MS);
  try {
    return await hamta(url, {
      headers: { "user-agent": USER_AGENT, accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
      signal: avbryt.signal,
      redirect: "follow",
    });
  } finally {
    clearTimeout(klocka);
  }
};

/** Ett flöde: hämta, tolka, räkna. Kastar aldrig - utfallet är svaret. */
const hamtaFlode = async (
  flode: FeedSpec,
  hamta: typeof fetch,
  slaUpp: (host: string) => Promise<string[]>,
): Promise<{ utfall: FeedOutcome; poster: ReturnType<typeof parseFeed> }> => {
  const tyst = { utfall: { name: flode.name, status: "svarade-inte" as const, items: 0 }, poster: [] };

  let url: URL;
  try {
    url = new URL(flode.url);
  } catch {
    return tyst;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return tyst;
  if (!(await hostArSaker(url.hostname, slaUpp))) return tyst;

  try {
    const svar = await medTidsgrans(hamta, url.href);
    if (!svar.ok) return tyst;
    const typ = svar.headers.get("content-type") ?? "";
    // Ett flöde är XML. Får vi HTML är det en felsida eller en samtyckesruta.
    if (typ && !/xml|rss|atom/i.test(typ)) return tyst;
    const xml = (await svar.text()).slice(0, MAX_BYTES);
    const poster = parseFeed(xml, flode.name);
    return {
      utfall: { name: flode.name, status: poster.length > 0 ? "svarade" : "svarade-inte", items: poster.length },
      poster,
    };
  } catch {
    return tyst;
  }
};

/**
 * Hämtar alla flöden och plockar ut det som nämner bolaget.
 *
 * Flödena hämtas PARALLELLT: de är oberoende, och fyra hämtningar i följd
 * med åtta sekunders tak vardera är trettiotvå sekunders väntan i värsta
 * fall - för någon som sitter mitt i en kris.
 *
 * `hamta` och `slaUpp` är injicerbara så att hela kedjan - SSRF-skydd,
 * tidsgräns, innehållstyp, tolkning, matchning - går att pröva utan nät.
 */
export const fetchNews = async (
  bolag: { companyName: string; orgNumber: string },
  feeds: FeedSpec[] = DEFAULT_FEEDS,
  hamta: typeof fetch = fetch,
  slaUpp: (host: string) => Promise<string[]> = defaultResolve,
): Promise<NewsResult> => {
  if (feeds.length === 0) {
    return {
      status: "ingen-kalla",
      hits: [],
      feeds: [],
      note: newsNote([], [], bolag),
    };
  }

  const svar = await Promise.all(feeds.map((f) => hamtaFlode(f, hamta, slaUpp)));
  const utfall = svar.map((s) => s.utfall);
  const traffar: NewsHit[] = [];
  for (const s of svar) {
    for (const post of s.poster) {
      const traff = matchaPost(post, bolag);
      if (traff) traffar.push(traff);
    }
  }

  const hits = sammanstall(traffar);
  const note = newsNote(hits, utfall, bolag);
  return hits.length > 0
    ? { status: "traff", hits, feeds: utfall, note }
    : { status: "ingen-traff", hits: [], feeds: utfall, note };
};
