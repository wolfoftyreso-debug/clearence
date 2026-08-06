/**
 * BOLAGETS EGEN WEBBPLATS: hämtningen som faktiskt är tillåten.
 *
 * Av de sex källor som stod som "ingen källa ansluten" är det här den enda
 * som går att använda idag utan avtal - se registry.ts för varför de andra
 * inte gör det.
 *
 * Filen innehåller BARA REN UTVINNING. Inga nätanrop: de hör hemma i
 * API:et, dels för att webbläsaren ändå inte får ringa tredje part (det
 * vaktas av tests/browser/no-external-requests.mjs), dels för att en ren
 * funktion går att pröva mot verkliga sidor utan att hämta något.
 *
 * TRE REGLER SOM UTVINNINGEN FÖLJER:
 *
 *  1. INGET GISSAS. Saknas en uppgift saknas den. En beskrivning som
 *     "troligen ett byggföretag" härledd ur ett ord i en rubrik är precis
 *     den sortens uppgift som ser användbar ut och inte går att stå för.
 *  2. INGA PERSONUPPGIFTER PLOCKAS UT. Namn och personliga adresser på
 *     en kontaktsida är personuppgifter, och analysen behöver dem inte.
 *     Bolagets växel och info-adress räcker.
 *  3. STRUKTURERAD DATA FÖRE TEXT. JSON-LD och OpenGraph är publicerade
 *     för att läsas maskinellt. Att i stället tolka brödtext är att gissa
 *     med extra steg.
 */

/* -------------------------------------------------------------------------- */
/* robots.txt                                                                 */
/* -------------------------------------------------------------------------- */

export interface RobotsRules {
  /** Sökvägsprefix som är förbjudna för oss. */
  disallow: string[];
  /** Sekunder mellan hämtningar, om sajten ber om det. */
  crawlDelay: number | null;
}

/**
 * Tolkar robots.txt för VÅR user-agent.
 *
 * En grupp som pekar ut oss vid namn vinner över `*`. Saknas filen helt
 * gäller inga regler - det är vad frånvaron betyder, inte "förbjudet".
 *
 * `Disallow:` utan värde betyder uttryckligen "allt tillåtet" och ska inte
 * bli ett tomt prefix som matchar varje sökväg. Den detaljen är skillnaden
 * mellan att hämta en sida och att aldrig hämta någonting.
 */
export const parseRobots = (text: string, agent: string): RobotsRules => {
  const rader = text.split(/\r?\n/).map((r) => r.replace(/#.*$/, "").trim());
  const grupper: { agents: string[]; disallow: string[]; delay: number | null }[] = [];
  let aktuell: (typeof grupper)[number] | null = null;
  let forraVarAgent = false;

  for (const rad of rader) {
    const [nyckelDel, ...restDel] = rad.split(":");
    if (restDel.length === 0) continue;
    const nyckel = nyckelDel.trim().toLowerCase();
    const varde = restDel.join(":").trim();

    if (nyckel === "user-agent") {
      if (!aktuell || !forraVarAgent) {
        aktuell = { agents: [], disallow: [], delay: null };
        grupper.push(aktuell);
      }
      aktuell.agents.push(varde.toLowerCase());
      forraVarAgent = true;
      continue;
    }
    forraVarAgent = false;
    if (!aktuell) continue;
    if (nyckel === "disallow" && varde !== "") aktuell.disallow.push(varde);
    if (nyckel === "crawl-delay") {
      const n = Number.parseFloat(varde);
      if (Number.isFinite(n)) aktuell.delay = n;
    }
  }

  const namn = agent.toLowerCase();
  const egen = grupper.find((g) => g.agents.some((a) => namn.includes(a) && a !== "*"));
  const alla = grupper.find((g) => g.agents.includes("*"));
  const vald = egen ?? alla;
  return { disallow: vald?.disallow ?? [], crawlDelay: vald?.delay ?? null };
};

/** Sant när sökvägen får hämtas enligt reglerna. */
export const mayFetch = (path: string, rules: RobotsRules): boolean =>
  !rules.disallow.some((d) => path.startsWith(d));

/* -------------------------------------------------------------------------- */
/* Utvinningen                                                                */
/* -------------------------------------------------------------------------- */

export interface WebsiteFacts {
  /** Bolagets egen beskrivning av sig självt. */
  description: string | null;
  /** Namnet som sajten själv anger. */
  name: string | null;
  /** Konton bolaget SJÄLVT länkar till. Plattformarna rörs aldrig. */
  socials: { platform: string; url: string }[];
  /** Företagets egna kontaktvägar - aldrig namngivna personers. */
  contact: { email: string | null; phone: string | null };
  /** Var varje uppgift kom ifrån, för att kunna svara på "hur vet ni det?". */
  basis: string[];
}

const attr = (tag: string, name: string): string | null => {
  const m = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag);
  return m ? m[1] : null;
};

const metaContent = (html: string, matcher: RegExp): string | null => {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const nyckel = attr(tag, "property") ?? attr(tag, "name");
    if (nyckel && matcher.test(nyckel)) {
      const v = attr(tag, "content");
      if (v && v.trim()) return v.trim();
    }
  }
  return null;
};

const PLATTFORMAR: { platform: string; test: RegExp }[] = [
  { platform: "LinkedIn", test: /linkedin\.com\/(company|in)\//i },
  { platform: "Facebook", test: /facebook\.com\//i },
  { platform: "Instagram", test: /instagram\.com\//i },
  { platform: "X", test: /(twitter|x)\.com\//i },
  { platform: "YouTube", test: /youtube\.com\//i },
];

/**
 * Läser ut det som går att stå för ur en sida.
 *
 * JSON-LD först: `Organization` är en struktur publicerad för att läsas
 * maskinellt, och det som står där är bolagets eget påstående om sig
 * självt. Sedan OpenGraph, sedan vanliga metataggar. Brödtext tolkas
 * aldrig.
 */
export const extractWebsiteFacts = (html: string): WebsiteFacts => {
  const basis: string[] = [];
  let name: string | null = null;
  let description: string | null = null;
  const contact: WebsiteFacts["contact"] = { email: null, phone: null };

  for (const m of html.matchAll(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const data = JSON.parse(m[1].trim()) as unknown;
      const noder = Array.isArray(data) ? data : [data];
      for (const nod of noder) {
        if (!nod || typeof nod !== "object") continue;
        const o = nod as Record<string, unknown>;
        const typ = String(o["@type"] ?? "");
        if (!/Organization|LocalBusiness|Corporation/i.test(typ)) continue;
        if (!name && typeof o.name === "string" && o.name.trim()) {
          name = o.name.trim();
          basis.push("Namnet står i sidans strukturerade data (JSON-LD).");
        }
        if (!description && typeof o.description === "string" && o.description.trim()) {
          description = o.description.trim();
          basis.push("Beskrivningen står i sidans strukturerade data (JSON-LD).");
        }
        if (!contact.email && typeof o.email === "string" && o.email.includes("@")) {
          contact.email = o.email.trim();
        }
        if (!contact.phone && typeof o.telephone === "string" && o.telephone.trim()) {
          contact.phone = o.telephone.trim();
        }
      }
    } catch {
      // Trasig JSON-LD är vanligt. Den ignoreras; sidan har fler källor.
    }
  }

  if (!description) {
    const og = metaContent(html, /^og:description$/i);
    const meta = metaContent(html, /^description$/i);
    if (og) {
      description = og;
      basis.push("Beskrivningen är sidans egen OpenGraph-text.");
    } else if (meta) {
      description = meta;
      basis.push("Beskrivningen är sidans egen metabeskrivning.");
    }
  }
  if (!name) {
    const og = metaContent(html, /^og:site_name$/i);
    if (og) {
      name = og;
      basis.push("Namnet är sidans eget og:site_name.");
    }
  }

  /*
   * Sociala konton: bara det bolaget SJÄLVT länkar till. Vi rör aldrig
   * plattformarna - se registry.ts. Att veta VILKA kanaler som finns är
   * ändå det mesta av värdet, och det står på deras egen sida.
   */
  const socials: WebsiteFacts["socials"] = [];
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    const url = m[1];
    const traff = PLATTFORMAR.find((p) => p.test.test(url));
    if (traff && !socials.some((s) => s.platform === traff.platform)) {
      socials.push({ platform: traff.platform, url });
    }
  }
  if (socials.length > 0) {
    basis.push("De sociala kontona är länkade från bolagets egen sida.");
  }

  /*
   * Kontaktvägar: bara bolagets egna. En adress som ser ut att tillhöra en
   * namngiven person plockas inte upp - det är en personuppgift analysen
   * inte behöver, och integritetspolicyn lovar att vi inte samlar mer än
   * vi behöver.
   */
  if (!contact.email) {
    for (const m of html.matchAll(/mailto:([^"'?\s>]+)/gi)) {
      const adress = m[1].toLowerCase();
      const lokal = adress.split("@")[0];
      if (/^(info|kontakt|hej|order|ekonomi|faktura|support|kundtjanst|kundtjänst)$/.test(lokal)) {
        contact.email = adress;
        basis.push("E-postadressen är bolagets egen, länkad från sidan.");
        break;
      }
    }
  }

  return { description, name, socials, contact, basis };
};

/**
 * Vad panelen ska skriva när webbplatsen lästs.
 *
 * Meningen ska tåla att kontrolleras: den räknar bara det som faktiskt
 * hittades, och säger ingenting när ingenting hittades.
 */
export const websiteNote = (facts: WebsiteFacts): string => {
  const delar: string[] = [];
  if (facts.description) delar.push("bolagets egen beskrivning");
  if (facts.socials.length === 1) delar.push("ett socialt konto");
  if (facts.socials.length > 1) delar.push(`${facts.socials.length} sociala konton`);
  if (facts.contact.email || facts.contact.phone) delar.push("kontaktväg");
  if (delar.length === 0) return "Sidan gick att läsa, men innehöll inget vi kunde använda.";
  const sista = delar.pop();
  const lista = delar.length > 0 ? `${delar.join(", ")} och ${sista}` : sista;
  return `Läst från bolagets webbplats: ${lista}.`;
};
