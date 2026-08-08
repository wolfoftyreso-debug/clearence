/**
 * HÄMTNINGEN AV BOLAGETS EGEN WEBBPLATS.
 *
 * Tolkningen (robots, utvinning, källmärkning) bor i src/lib/sources/website.ts
 * och är prövad utan nät. Det här är biten som saknades: själva hämtningen.
 *
 * TVÅ SAKER GÖR DEN HÄR FILEN VIKTIGARE ÄN EN VANLIG FETCH.
 *
 *  1. ROBOTS.TXT FÖRST. Sidan är publicerad för att läsas, och vi läser den -
 *     men vi frågar först om vi får. En produkt som säljer krishantering kan
 *     inte ha en skrapa som struntar i motpartens villkor i sin leveranskedja.
 *
 *  2. SSRF-SKYDD. En server som hämtar en URL användaren pekar ut kan luras
 *     att hämta INTERNA adresser - molnets metadata-endpoint (169.254.169.254),
 *     databasen på 10.x, localhost. Det är en av de vanligaste och värsta
 *     serverbuggarna. Därför slår vi upp värdnamnet och VÄGRAR om det pekar på
 *     en privat, loopback- eller länklokal adress. Bara publika http/https-
 *     värdar hämtas.
 *
 * Ingen nyckel behövs - det är en publik sida. Men rutten kräver ändå
 * inloggning (som Google), så den inte blir en öppen proxy på vår server.
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import {
  extractWebsiteFacts,
  mayFetch,
  parseRobots,
  websiteNote,
  type WebsiteFacts,
} from "../../src/lib/sources/website";

/** Vår user-agent - vi säger vilka vi är, som robots-etiketten kräver. */
const USER_AGENT = "ClearanceBot/1.0 (+https://clearance.se/bot)";
const AGENT_TOKEN = "ClearanceBot";
const TIMEOUT_MS = 8_000;
/** Läs inte en oändligt stor sida - ett tak på det vi läser in. */
const MAX_BYTES = 2_000_000;

export type WebsiteResult =
  | { status: "traff"; facts: WebsiteFacts; note: string }
  | { status: "forbjuden"; reason: string }
  | { status: "ingen-traff"; reason: string }
  | { status: "fel"; reason: string };

/** Privata, loopback-, länklokala och metadata-adresser - hämtas ALDRIG. */
export const isPrivateAddress = (ip: string): boolean => {
  if (/^127\./.test(ip) || ip === "0.0.0.0") return true; // loopback / any
  if (/^10\./.test(ip) || /^192\.168\./.test(ip)) return true; // privat
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true; // privat 172.16–31
  if (/^169\.254\./.test(ip)) return true; // länklokal, inkl. molnmetadata
  if (ip === "::1") return true; // ipv6 loopback
  const low = ip.toLowerCase();
  if (low.startsWith("fe80:") || low.startsWith("fc") || low.startsWith("fd")) return true; // ipv6 länklokal/ULA
  return false;
};

/** Slår upp värdnamnet och kräver att ALLA svar är publika. */
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

const medTidsgrans = async (
  hamta: typeof fetch,
  url: string,
): Promise<Response> => {
  const avbryt = new AbortController();
  const klocka = setTimeout(() => avbryt.abort(), TIMEOUT_MS);
  try {
    return await hamta(url, { headers: { "user-agent": USER_AGENT }, signal: avbryt.signal, redirect: "follow" });
  } finally {
    clearTimeout(klocka);
  }
};

/**
 * Alltid true: sidan är publik, ingen nyckel behövs. Finns ändå för att
 * /health ska kunna rapportera källan på samma sätt som de andra.
 */
export const websiteConfigured = (): boolean => true;

/**
 * Hämtar och tolkar bolagets webbplats.
 *
 * `hamta` och `slaUpp` är injicerbara så sviten kan pröva hela kedjan -
 * robots, SSRF-skydd, utvinning - utan att röra nätet eller DNS.
 */
export const fetchWebsite = async (
  rawUrl: string,
  hamta: typeof fetch = fetch,
  slaUpp: (host: string) => Promise<string[]> = defaultResolve,
): Promise<WebsiteResult> => {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { status: "fel", reason: "Ogiltig webbadress." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { status: "fel", reason: "Bara http och https hämtas." };
  }
  if (!(await hostArSaker(url.hostname, slaUpp))) {
    // Samma svar oavsett varför - vi röjer inte om en intern adress finns.
    return { status: "fel", reason: "Adressen går inte att hämta." };
  }

  // 1. robots.txt. Saknas den (t.ex. 404) tolkar vi det som tillåtet, vilket
  //    är hur robots-standarden fungerar. Går den inte att nå alls: avstå.
  const robotsUrl = `${url.protocol}//${url.host}/robots.txt`;
  let regler;
  try {
    const rSvar = await medTidsgrans(hamta, robotsUrl);
    regler = rSvar.ok ? parseRobots(await rSvar.text(), AGENT_TOKEN) : parseRobots("", AGENT_TOKEN);
  } catch {
    return { status: "fel", reason: "Kunde inte läsa robots.txt." };
  }
  if (!mayFetch(url.pathname, regler)) {
    return { status: "forbjuden", reason: "Sidans robots.txt tillåter inte hämtning." };
  }

  // 2. Själva sidan.
  let svar: Response;
  try {
    svar = await medTidsgrans(hamta, url.href);
  } catch (error) {
    return {
      status: "fel",
      reason:
        error instanceof Error && error.name === "AbortError"
          ? "Sidan svarade inte inom tidsgränsen."
          : "Sidan gick inte att nå.",
    };
  }
  if (!svar.ok) {
    return { status: "fel", reason: `Sidan svarade ${svar.status}.` };
  }
  const typ = svar.headers.get("content-type") ?? "";
  if (typ && !/text\/html|application\/xhtml/i.test(typ)) {
    return { status: "ingen-traff", reason: "Adressen är inte en webbsida." };
  }

  const html = (await svar.text()).slice(0, MAX_BYTES);
  const facts = extractWebsiteFacts(html);
  const nagot =
    facts.description || facts.name || facts.contact.email || facts.contact.phone || facts.socials.length > 0;
  if (!nagot) {
    return { status: "ingen-traff", reason: "Sidan gick att hämta men innehöll inget vi kunde stå för." };
  }
  return { status: "traff", facts, note: websiteNote(facts) };
};
