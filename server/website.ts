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
} from "../src/lib/sources/website";

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
  let adress = ip.trim().toLowerCase();
  // IPv4 avbildad i IPv6 (::ffff:169.254.169.254) är samma adress som den
  // IPv4 den bär. Utan den här raden gick metadata-endpointen att nå genom
  // att be om den i IPv6-form.
  const avbildad = /^(?:::ffff:)(\d+\.\d+\.\d+\.\d+)$/.exec(adress);
  if (avbildad) adress = avbildad[1];

  if (/^127\./.test(adress)) return true; // loopback 127/8
  if (/^0\./.test(adress)) return true; // "detta nät" 0/8, inkl. 0.0.0.0
  if (/^10\./.test(adress) || /^192\.168\./.test(adress)) return true; // privat
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(adress)) return true; // privat 172.16-31
  if (/^169\.254\./.test(adress)) return true; // länklokal, inkl. molnmetadata
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(adress)) return true; // CGNAT 100.64/10
  if (/^192\.0\.0\./.test(adress) || /^192\.0\.2\./.test(adress)) return true; // IETF-reserverat
  if (/^198\.(1[89])\./.test(adress)) return true; // benchmark 198.18/15
  if (/^(22[4-9]|2[3-5]\d)\./.test(adress)) return true; // multicast + reserverat 224+

  if (adress === "::1" || adress === "::") return true; // ipv6 loopback / any
  if (adress.startsWith("fe80:")) return true; // ipv6 länklokal
  // Unika lokala adresser fc00::/7 - alltså fc och fd som FÖRSTA oktett-par,
  // inte vilket värdnamn som helst som råkar börja på de bokstäverna.
  if (/^f[cd][0-9a-f]{2}:/.test(adress)) return true;
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

/** Så många omdirigeringar följer vi - fler är alltid en slinga eller en fälla. */
const MAX_HOPP = 5;

/**
 * Hämtar med tidsgräns och FÖLJER OMDIRIGERINGAR SJÄLV.
 *
 * `redirect: "follow"` var hålet i SSRF-skyddet: vi prövade värdnamnet i
 * adressen användaren angav, och lät sedan fetch följa vart som helst. En
 * angripare behövde bara peka på sin EGEN publika server och svara
 * "302 Location: http://169.254.169.254/latest/meta-data/" - kontrollen var
 * redan avklarad och gällde fel adress. Molnets metadata, databasen på 10.x
 * och allt annat internt låg öppet bakom en enda omdirigering.
 *
 * Därför "manual": varje hopp prövas mot hostArSaker() innan det följs, med
 * samma regel som första adressen. En omdirigering är en ny begäran, och en
 * ny begäran ska prövas som en ny begäran.
 */
const medTidsgrans = async (
  hamta: typeof fetch,
  url: string,
  slaUpp: (host: string) => Promise<string[]>,
): Promise<Response> => {
  let aktuell = url;
  for (let hopp = 0; hopp <= MAX_HOPP; hopp++) {
    const avbryt = new AbortController();
    const klocka = setTimeout(() => avbryt.abort(), TIMEOUT_MS);
    let svar: Response;
    try {
      svar = await hamta(aktuell, {
        headers: { "user-agent": USER_AGENT },
        signal: avbryt.signal,
        redirect: "manual",
      });
    } finally {
      clearTimeout(klocka);
    }

    if (svar.status < 300 || svar.status > 399) return svar;

    const plats = svar.headers.get("location");
    if (!plats) return svar; // 3xx utan mål: inget att följa.

    let nasta: URL;
    try {
      nasta = new URL(plats, aktuell); // relativa mål tillåts, som standarden säger
    } catch {
      throw new Error("ssrf: omdirigeringen pekade på en ogiltig adress");
    }
    if (nasta.protocol !== "https:" && nasta.protocol !== "http:") {
      throw new Error("ssrf: omdirigeringen bytte till ett protokoll vi inte hämtar");
    }
    if (!(await hostArSaker(nasta.hostname, slaUpp))) {
      // Samma tystnad som första prövningen - vi röjer inte vad som finns.
      throw new Error("ssrf: omdirigeringen pekade på en adress som inte får hämtas");
    }
    aktuell = nasta.href;
  }
  throw new Error("ssrf: för många omdirigeringar");
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
    const rSvar = await medTidsgrans(hamta, robotsUrl, slaUpp);
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
    svar = await medTidsgrans(hamta, url.href, slaUpp);
  } catch (error) {
    // En blockerad omdirigering får samma svar som "gick inte att nå": att
    // säga "den pekade på en intern adress" vore att bekräfta att den finns.
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
