/**
 * NYHETER OM BOLAGET: den fjärde källan som faktiskt går att koppla på.
 *
 * Stod som "ingen källa ansluten" med noten "en namngiven nyhetskälla".
 * Den noten var korrekt men gjorde ingenting, och det här är den byggd.
 *
 * VARFÖR RSS OCH INGENTING ANNAT. Ett RSS-flöde publiceras för att
 * prenumereras på - att hämta det är dess syfte, och det kräver inget
 * avtal. Djup svensk mediebevakning (Retriever, Meltwater) kräver
 * abonnemang och är fortfarande inte kopplad; det står kvar i registret.
 * Att i stället skrapa söksidor hade varit avtalsbrott och hade slutat
 * fungera vid nästa layoutändring - se resonemanget i registry.ts.
 *
 * TRE REGLER SOM STYR FILEN.
 *
 *  1. RUBRIK, DATUM, LÄNK OCH KÄLLA - INGET MER. Artikeltexten är
 *     upphovsrättsskyddad. Vi lagrar den inte, sammanfattar den inte och
 *     visar den inte. Den som vill läsa artikeln följer länken till den
 *     som skrev den.
 *  2. EN TRÄFF SKA GÅ ATT FÖRSVARA. Matchningen kräver bolagsnamnet som
 *     en sammanhängande fras eller organisationsnumret - aldrig lösa ord.
 *     "Bygg" i en rubrik är inte en nyhet om Bygg AB.
 *  3. ETT FÖR ALLMÄNT NAMN MATCHAS INTE ALLS. Ett bolag som heter
 *     "Bygg AB" eller "Service AB" går inte att skilja från branschen i en
 *     rubrik. Då säger produkten det, i stället för att leverera brus som
 *     ser ut som bevakning. Det är hela skillnaden mellan en källa och en
 *     sökmotor.
 *
 * Filen är ren: inga nätanrop. Hämtningen bor i server/news.ts, dels
 * för att webbläsaren inte får ringa tredje part (vaktat av
 * tests/browser/no-external-requests.mjs), dels för att tolkningen ska gå
 * att pröva mot verkliga flöden utan att hämta något.
 */

export interface NewsItem {
  title: string;
  /** Absolut länk till artikeln hos den som publicerade den. */
  link: string;
  /** ISO-datum, eller null när flödet inte angav något. */
  publishedAt: string | null;
  /** Flödets namn, så att varje rad kan svara på "var kommer det ifrån?". */
  source: string;
}

export interface NewsHit extends NewsItem {
  /** Varför raden räknas som en träff. Visas för läsaren. */
  matchedOn: "namn" | "orgnr";
}

/* -------------------------------------------------------------------------- */
/* Tolkningen av flödet                                                       */
/* -------------------------------------------------------------------------- */

/** Vanliga XML-entiteter plus numeriska. Flöden är fulla av dem. */
const avkoda = (s: string): string =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number.parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    // Ampersanden sist: annars avkodas &amp;lt; till < i två steg.
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

/** Innehållet i första <tagg> ... </tagg>, oavsett namnrymdsprefix. */
const taggInnehall = (xml: string, tagg: string): string | null => {
  const m = new RegExp(`<(?:\\w+:)?${tagg}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tagg}>`, "i").exec(xml);
  return m ? avkoda(m[1]) : null;
};

/**
 * Länken.
 *
 * RSS lägger den i elementets text, Atom i ett href-attribut - och Atom
 * kan ha flera <link> där bara `rel="alternate"` (eller inget rel) pekar
 * på artikeln. Att ta den första bästa ger ibland en länk till flödet
 * självt.
 */
const lasLank = (xml: string): string | null => {
  /*
   * Atom först: href i ett attribut. Ett <link rel="self"> pekar på flödet
   * och inte på artikeln, så bara `alternate` - eller inget rel alls -
   * räknas.
   *
   * Att försöka läsa båda formerna i ETT uttryck var den första versionen,
   * och den var trasig: en lat grupp följd av en valfri sluttagg matchar
   * tomma strängen, så RSS-länken hittades aldrig och bevakningen blev
   * tom utan att något gick sönder. Formerna läses därför var för sig.
   */
  for (const m of xml.matchAll(/<(?:\w+:)?link\b([^>]*?)\/?>/gi)) {
    const attrDel = m[1] ?? "";
    const href = /href\s*=\s*["']([^"']*)["']/i.exec(attrDel)?.[1];
    if (!href) continue;
    const rel = /rel\s*=\s*["']([^"']*)["']/i.exec(attrDel)?.[1]?.toLowerCase();
    if (rel && rel !== "alternate") continue;
    return avkoda(href);
  }
  // RSS: adressen står som elementets text.
  const text = taggInnehall(xml, "link");
  return text && /^https?:\/\//i.test(text) ? text : null;
};

/**
 * Datumet som ISO, eller null.
 *
 * Ett flöde utan datum är inte ogiltigt - men en nyhet utan datum går
 * inte att sortera eller bedöma färskhet på, och då säger vi null i
 * stället för att sätta dagens datum och låtsas.
 */
const lasDatum = (xml: string): string | null => {
  for (const tagg of ["pubDate", "published", "updated", "date"]) {
    const rått = taggInnehall(xml, tagg);
    if (!rått) continue;
    const t = Date.parse(rått);
    if (Number.isFinite(t)) return new Date(t).toISOString();
  }
  return null;
};

/**
 * Läser ut posterna ur ett RSS 2.0- eller Atom-flöde.
 *
 * Poster utan rubrik eller utan länk hoppas över: en rad som inte går att
 * öppna är inte en nyhet, den är en påstådd nyhet.
 */
export const parseFeed = (xml: string, source: string): NewsItem[] => {
  const poster: NewsItem[] = [];
  const block = /<(?:\w+:)?(item|entry)\b[^>]*>([\s\S]*?)<\/(?:\w+:)?\1>/gi;
  for (const m of xml.matchAll(block)) {
    const kropp = m[2];
    const title = taggInnehall(kropp, "title");
    const link = lasLank(kropp);
    if (!title || !link || !/^https?:\/\//i.test(link)) continue;
    poster.push({ title, link, publishedAt: lasDatum(kropp), source });
  }
  return poster;
};

/* -------------------------------------------------------------------------- */
/* Matchningen                                                                */
/* -------------------------------------------------------------------------- */

/** Bolagsformer som inte hjälper någon att känna igen bolaget i en rubrik. */
const BOLAGSFORMER =
  /\b(aktiebolag|ab|hb|kb|ekonomisk förening|ek\.? för\.?|publ|holding|group|sverige)\b/gi;

/**
 * Namnet som det går att leta efter: utan bolagsform, utan skiljetecken,
 * gemener, ett mellanslag mellan orden.
 */
export const normaliseraNamn = (namn: string): string =>
  namn
    .toLowerCase()
    .replace(/[.,()]/g, " ")
    .replace(BOLAGSFORMER, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Namn som inte går att matcha på utan att dra in halva branschen.
 *
 * Listan är avsiktligt kort och konkret. Regeln som gör mest jobb är den
 * som INTE står i listan: ett namn under fyra tecken, eller ett enda
 * vanligt ord, matchas inte heller.
 */
const FOR_ALLMANNA = new Set([
  "bygg", "service", "handel", "konsult", "transport", "el", "vvs", "data",
  "media", "fastighet", "fastigheter", "invest", "trading", "produktion",
]);

/**
 * Går bolagsnamnet att söka på utan att träffa fel bolag?
 *
 * Svaret används för att SÄGA något, inte bara för att tiga: panelen
 * skriver ut att namnet är för allmänt, och att bevakningen därför vilar
 * på organisationsnumret. Ett tyst nollresultat hade lästs som "inget har
 * hänt", vilket är ett helt annat påstående.
 */
export const namnGarAttMatcha = (companyName: string): boolean => {
  const n = normaliseraNamn(companyName);
  if (n.length < 4) return false;
  const ord = n.split(" ").filter(Boolean);
  if (ord.length === 0) return false;
  if (ord.length === 1 && FOR_ALLMANNA.has(ord[0])) return false;
  return true;
};

/** Organisationsnumret i alla former det brukar skrivas. */
const orgnrVarianter = (orgNumber: string): string[] => {
  const siffror = orgNumber.replace(/\D/g, "");
  if (siffror.length !== 10) return [];
  return [siffror, `${siffror.slice(0, 6)}-${siffror.slice(6)}`];
};

/**
 * Matchar en post mot bolaget, eller null.
 *
 * Namnet måste förekomma som en SAMMANHÄNGANDE FRAS med ordgränser i
 * början och slutet. "Nordisk Bygg" matchar inte "Nordiska Byggvaror",
 * och det är avsikten - en felaktig träff i ett krisärende är värre än
 * ingen träff alls.
 */
export const matchaPost = (
  post: NewsItem,
  bolag: { companyName: string; orgNumber: string },
): NewsHit | null => {
  const rubrik = post.title.toLowerCase();

  for (const variant of orgnrVarianter(bolag.orgNumber)) {
    if (rubrik.includes(variant)) return { ...post, matchedOn: "orgnr" };
  }

  if (!namnGarAttMatcha(bolag.companyName)) return null;
  const namn = normaliseraNamn(bolag.companyName);
  const rubrikNorm = normaliseraNamn(post.title);
  // Ordgräns i båda ändar, på den normaliserade texten.
  const monster = new RegExp(
    `(^|\\s)${namn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|\\s)`,
  );
  if (monster.test(rubrikNorm)) return { ...post, matchedOn: "namn" };
  return null;
};

/* -------------------------------------------------------------------------- */
/* Sammanställningen                                                          */
/* -------------------------------------------------------------------------- */

/** Samma artikel syndikeras. Två rader om en händelse är inte två händelser. */
const nyckel = (h: NewsHit): string => {
  try {
    const u = new URL(h.link);
    // Spårningsparametrar gör två identiska länkar olika.
    return `${u.host}${u.pathname}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return h.link.toLowerCase();
  }
};

/**
 * Träffarna, avdubblerade och nyast först.
 *
 * Poster utan datum hamnar sist: de går inte att tidsätta, och en odaterad
 * rad högst upp hade sett ut som den färskaste.
 */
export const sammanstall = (traffar: NewsHit[], max = 10): NewsHit[] => {
  const sedda = new Set<string>();
  const rubriker = new Set<string>();
  const ut: NewsHit[] = [];

  const sorterade = [...traffar].sort((a, b) => {
    if (a.publishedAt && b.publishedAt) return b.publishedAt.localeCompare(a.publishedAt);
    if (a.publishedAt) return -1;
    if (b.publishedAt) return 1;
    return 0;
  });

  for (const h of sorterade) {
    const k = nyckel(h);
    const r = normaliseraNamn(h.title);
    if (sedda.has(k) || rubriker.has(r)) continue;
    sedda.add(k);
    rubriker.add(r);
    ut.push(h);
    if (ut.length >= max) break;
  }
  return ut;
};

/* -------------------------------------------------------------------------- */
/* Vad panelen säger                                                          */
/* -------------------------------------------------------------------------- */

export interface FeedOutcome {
  name: string;
  /** "svarade" | "svarade-inte" - per flöde, så att en död länk syns. */
  status: "svarade" | "svarade-inte";
  /** Antal poster i flödet, inte antal träffar. */
  items: number;
}

/**
 * Noten som visas för användaren.
 *
 * Den ska kunna svara på tre frågor utan att någon behöver fråga: hur
 * många flöden som lästes, hur många som svarade, och varför resultatet
 * blev som det blev. Ett flöde som inte svarade döljs aldrig - en
 * bevakning som tyst blivit tunnare är den farligaste sortens tomrum.
 */
export const newsNote = (
  hits: NewsHit[],
  utfall: FeedOutcome[],
  bolag: { companyName: string },
): string => {
  const svarade = utfall.filter((u) => u.status === "svarade");
  const tysta = utfall.filter((u) => u.status !== "svarade");

  if (utfall.length === 0) {
    return "Ingen nyhetskälla är angiven i driften ännu.";
  }

  const kallor = `${svarade.length} av ${utfall.length} ${
    utfall.length === 1 ? "flöde" : "flöden"
  } svarade`;
  const tystnad = tysta.length > 0 ? ` (${tysta.map((t) => t.name).join(", ")} svarade inte)` : "";

  if (!namnGarAttMatcha(bolag.companyName)) {
    return (
      `${kallor}${tystnad}. Bolagsnamnet är för allmänt för att sökas på utan att ` +
      "träffa andra bolag, så bevakningen vilar på organisationsnumret."
    );
  }

  if (hits.length === 0) {
    return `${kallor}${tystnad}. Ingen artikel nämnde bolaget vid namn eller organisationsnummer.`;
  }

  return (
    `${kallor}${tystnad}. ${hits.length} ${hits.length === 1 ? "artikel" : "artiklar"} ` +
    "nämner bolaget. Bara rubrik, datum och länk sparas - artikeltexten är upphovsrättsskyddad."
  );
};
