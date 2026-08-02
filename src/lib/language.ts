/**
 * Adaptivt språk: samma innebörd, olika förutsättningar hos läsaren.
 *
 * Grundregeln, ordagrant ur produktkravet: systemet får ALDRIG förenkla
 * innehållet så att innebörden ändras - bara göra det lättare att förstå.
 * Om en text är svår är det systemet som ska anpassa sig, inte användaren.
 *
 * Fyra nivåer:
 *
 *  legal        Juridiskt språk. Originaltexten, för professionella läsare.
 *  standard     Klarspråk. Facktermer används men kan klickas och förklaras.
 *               Detta är standardläget - och samma text som legal, eftersom
 *               produktens originaltexter redan är skrivna i klarspråk.
 *  simple       Förenklad svenska: facktermer förklaras direkt i texten,
 *               långa meningar delas.
 *  very_simple  Mycket enkel svenska: korta meningar, ett budskap per
 *               mening, svåra ord utbytta mot vanliga.
 *
 * Motorn är deterministisk: en ordlista med förklaringar (samma ordlista
 * som de klickbara begreppen), en ordbok med enklare synonymer och
 * regelstyrd meningsdelning. Ingen extern tjänst, ingen omskrivning som
 * kan glida i betydelse - och siffror, belopp och datum lämnas alltid
 * orörda, vilket testerna kontrollerar tecken för tecken.
 */

export type LanguageLevel = "legal" | "standard" | "simple" | "very_simple";

export const LANGUAGE_LEVELS: { id: LanguageLevel; label: string; description: string }[] = [
  {
    id: "legal",
    label: "Juridiskt språk",
    description: "Originaltexterna, för jurister, rekonstruktörer och andra professionella läsare.",
  },
  {
    id: "standard",
    label: "Standardsvenska",
    description: "Klarspråk. Facktermer används när de behövs och kan alltid klickas för en förklaring.",
  },
  {
    id: "simple",
    label: "Förenklad svenska",
    description: "Enklare ord och kortare meningar. Juridiska begrepp förklaras direkt i texten.",
  },
  {
    id: "very_simple",
    label: "Mycket enkel svenska",
    description: "Mycket korta meningar. Ett budskap i taget. Inga onödiga fackuttryck.",
  },
];

const STORAGE_KEY = "clearance-language-level";
const CLICK_KEY = "clearance-glossary-clicks";
const DISMISS_KEY = "clearance-language-suggestion-dismissed";
export const LANGUAGE_EVENT = "clearance-language-change";

export const getLanguageLevel = (): LanguageLevel => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "legal" || raw === "standard" || raw === "simple" || raw === "very_simple") return raw;
  } catch {
    /* utan lagring: standard */
  }
  return "standard";
};

export const setLanguageLevel = (level: LanguageLevel): void => {
  try {
    localStorage.setItem(STORAGE_KEY, level);
    window.dispatchEvent(new CustomEvent(LANGUAGE_EVENT));
  } catch {
    /* utan lagring går valet inte att spara - inget att göra */
  }
};

/* --- ordlistan: klickbara juridiska begrepp -------------------------------- */

export interface GlossaryEntry {
  /** Grundformen som visas i förklaringsrutan. */
  term: string;
  /** Böjningar och varianter som ska kännas igen i löptext. */
  variants: string[];
  /** Förklaringen i klarspråk. Ändrar aldrig innebörden - förklarar den. */
  explanation: string;
}

/**
 * Ordlistan är kurerad för hand, inte genererad: varje förklaring ska tåla
 * att läsas av en jurist utan invändning OCH av en läsare utan förkunskaper
 * utan ordbok. Sakligt, aldrig skrämmande - vi säljer kontroll.
 */
export const GLOSSARY: GlossaryEntry[] = [
  {
    term: "kontrollbalansräkning",
    variants: ["kontrollbalansräkningen", "kontrollbalansräkning", "kontrollbalans"],
    explanation:
      "En särskild balansräkning som styrelsen ska upprätta när det finns skäl att anta att bolagets egna kapital är mindre än hälften av det registrerade aktiekapitalet. Den visar om bolaget får fortsätta som vanligt eller om styrelsen måste följa särskilda steg.",
  },
  {
    term: "kontrollstämma",
    variants: ["kontrollstämman", "kontrollstämma"],
    explanation:
      "En bolagsstämma som hålls när kontrollbalansräkningen visar kapitalbrist. Ägarna beslutar där om bolaget ska försöka läka bristen eller avvecklas under ordnade former.",
  },
  {
    term: "företagsrekonstruktion",
    variants: ["företagsrekonstruktionen", "företagsrekonstruktion", "rekonstruktionen", "rekonstruktion"],
    explanation:
      "Det betyder att företaget försöker lösa sina ekonomiska problem och fortsätta verksamheten i stället för att gå i konkurs. Processen sker under domstolens skydd med hjälp av en rekonstruktör.",
  },
  {
    term: "konkurs",
    variants: ["konkursen", "konkurs"],
    explanation:
      "En domstolsprocess där ett företag som inte kan betala sina skulder avvecklas. En konkursförvaltare tar över och fördelar det som finns till dem som ska ha betalt.",
  },
  {
    term: "obestånd",
    variants: ["obeståndet", "obestånd", "insolvens"],
    explanation:
      "Att inte kunna betala sina skulder i tid, och att problemet inte är tillfälligt. Obestånd är den juridiska gränsen för när konkurs kan bli aktuell.",
  },
  {
    term: "personligt betalningsansvar",
    variants: ["personligt betalningsansvar", "personligt ansvar", "företrädaransvar", "medansvar"],
    explanation:
      "Om vissa regler inte följs kan personer i företagets ledning i vissa situationer bli personligt ansvariga för vissa av bolagets skulder. Därför är det viktigt att agera i tid - den som följer stegen skyddar sig.",
  },
  {
    term: "borgenär",
    variants: ["borgenärerna", "borgenärer", "borgenären", "borgenär"],
    explanation: "Någon som företaget är skyldigt pengar - till exempel en leverantör, banken eller Skatteverket.",
  },
  {
    term: "ackord",
    variants: ["ackordet", "ackord", "skulduppgörelse"],
    explanation:
      "En uppgörelse där de som företaget är skyldigt pengar går med på att få en del av sin fordran betald, så att företaget kan leva vidare.",
  },
  {
    term: "likviditet",
    variants: ["likviditeten", "likviditet"],
    explanation: "Pengarna som finns tillgängliga att betala med just nu - inte samma sak som om bolaget går med vinst.",
  },
  {
    term: "kapitalbrist",
    variants: ["kapitalbristen", "kapitalbrist", "förbrukat eget kapital"],
    explanation:
      "När bolagets egna kapital är mindre än hälften av aktiekapitalet. Då kräver aktiebolagslagen att styrelsen följer bestämda steg, med bestämda tidsfrister.",
  },
  {
    term: "frist",
    variants: ["fristerna", "frister", "fristen", "frist", "tidsfrist", "tidsfrister"],
    explanation: "Ett sista datum som lagen eller en myndighet satt. Efter det datumet kan möjligheter stängas eller ansvar skärpas.",
  },
  {
    term: "likvidation",
    variants: ["likvidationen", "likvidation", "tvångslikvidation"],
    explanation:
      "En ordnad avveckling av bolaget: tillgångarna säljs, skulderna betalas så långt det går och bolaget upphör. Tvångslikvidation är när domstol beslutar det för att reglerna inte följts.",
  },
];

/** Längsta varianten först, så "kontrollbalansräkning" vinner över "kontroll". */
const ALL_VARIANTS: { variant: string; entry: GlossaryEntry }[] = GLOSSARY.flatMap((entry) =>
  entry.variants.map((variant) => ({ variant, entry })),
).sort((a, b) => b.variant.length - a.variant.length);

export const findGlossaryEntry = (word: string): GlossaryEntry | null =>
  ALL_VARIANTS.find(({ variant }) => variant.toLowerCase() === word.toLowerCase())?.entry ?? null;

/**
 * Delar en text i vanliga segment och klickbara begrepp, för rendering.
 * Varje förekomst markeras - läsaren ska inte behöva minnas var ordet
 * förklarades första gången.
 */
export const segmentText = (text: string): { text: string; entry: GlossaryEntry | null }[] => {
  const pattern = new RegExp(`(${ALL_VARIANTS.map(({ variant }) => variant).join("|")})`, "gi");
  return text
    .split(pattern)
    .filter((part) => part.length > 0)
    .map((part) => ({ text: part, entry: findGlossaryEntry(part) }));
};

/* --- förenklingsmotorn ----------------------------------------------------- */

/**
 * Enklare synonymer för mycket enkel svenska. Ordboken byter bara ord vars
 * betydelse är densamma i våra texter - aldrig juridiska termer (de
 * förklaras i stället) och aldrig något som ändrar sak eller siffra.
 */
const SIMPLER_WORDS: [RegExp, string][] = [
  [/\bupprätta\b/gi, "ta fram"],
  [/\bupprättas\b/gi, "tas fram"],
  [/\berfordras\b/gi, "behövs"],
  [/\bavseende\b/gi, "om"],
  [/\bsamtliga\b/gi, "alla"],
  [/\bytterligare\b/gi, "fler"],
  [/\bhandlingsutrymme\b/gi, "möjligheter att agera"],
  [/\bdokumentera\b/gi, "skriva ner"],
  [/\bdokumenteras\b/gi, "skrivas ner"],
  [/\bprioritera\b/gi, "ta först"],
  [/\bindikerar\b/gi, "tyder på"],
  [/\bbedömningen\b/gi, "vår genomgång"],
];

/** Ord med versal i behåll när meningen börjar med det utbytta ordet. */
const capitalise = (s: string): string => (s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * Första förekomsten av varje juridiskt begrepp får sin förklaring direkt i
 * texten: "kontrollbalansräkning (det betyder: ...)". Övriga förekomster
 * lämnas - förklaringen ska hjälpa, inte dränka.
 */
const explainTermsInline = (text: string): string => {
  const explained = new Set<string>();
  return segmentText(text)
    .map(({ text: part, entry }) => {
      if (!entry || explained.has(entry.term)) return part;
      explained.add(entry.term);
      // Förklaringens första mening räcker i löptext.
      const firstSentence = entry.explanation.split(/(?<=\.)\s/)[0];
      return `${part} (det betyder: ${firstSentence.replace(/\.$/, "").toLowerCase()})`;
    })
    .join("");
};

/** Meningsdelning: ett budskap per mening. Delar vid semikolon, tankstreck
 *  och " och " i långa meningar - aldrig inne i tal eller belopp. */
const splitLongSentences = (text: string, maxWords: number): string => {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const out: string[] = [];
  for (const sentence of sentences) {
    if (sentence.split(/\s+/).length <= maxWords) {
      out.push(sentence);
      continue;
    }
    let parts = sentence.split(/\s*[;–]\s+/);
    if (parts.length === 1) {
      // Sista utvägen: dela vid ", och " / ", men " - tydliga satsgränser.
      parts = sentence.split(/,\s+(?=(?:och|men|vilket|så)\s)/);
    }
    out.push(
      ...parts.map((part, i) => {
        let cleaned = part.trim().replace(/^(och|men|vilket|så)\s+/i, "");
        cleaned = capitalise(cleaned);
        if (!/[.!?]$/.test(cleaned)) cleaned += i < parts.length - 1 ? "." : ".";
        return cleaned;
      }),
    );
  }
  return out.join(" ").replace(/\.\.+/g, ".");
};

/**
 * Anpassar en text till vald nivå. Innebörden är densamma - testerna
 * kontrollerar att siffror, belopp och datum är orörda tecken för tecken.
 */
export const adaptText = (text: string, level: LanguageLevel): string => {
  if (level === "legal" || level === "standard") return text;
  let adapted = explainTermsInline(text);
  if (level === "very_simple") {
    for (const [pattern, replacement] of SIMPLER_WORDS) {
      adapted = adapted.replace(pattern, (match) =>
        match[0] === match[0].toUpperCase() ? capitalise(replacement) : replacement,
      );
    }
    adapted = splitLongSentences(adapted, 14);
  } else {
    adapted = splitLongSentences(adapted, 26);
  }
  return adapted;
};

/* --- förslaget om enklare språk -------------------------------------------- */

/**
 * Upprepade klick på begreppsförklaringar är en signal, inte ett betyg:
 * systemet föreslår enklare språk EN gång, och ett nej respekteras.
 * Designprincipen står i produktkravet: CLEARANCE ska aldrig få användaren
 * att känna sig dum - det är texten som ska anpassa sig.
 */
export const recordGlossaryClick = (): void => {
  try {
    const count = Number(localStorage.getItem(CLICK_KEY) ?? "0") + 1;
    localStorage.setItem(CLICK_KEY, String(count));
    window.dispatchEvent(new CustomEvent(LANGUAGE_EVENT));
  } catch {
    /* utan lagring: ingen räkning */
  }
};

export const shouldSuggestSimpler = (): boolean => {
  try {
    const level = getLanguageLevel();
    if (level === "simple" || level === "very_simple") return false;
    if (localStorage.getItem(DISMISS_KEY) === "1") return false;
    return Number(localStorage.getItem(CLICK_KEY) ?? "0") >= 3;
  } catch {
    return false;
  }
};

export const dismissSimplerSuggestion = (): void => {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
    window.dispatchEvent(new CustomEvent(LANGUAGE_EVENT));
  } catch {
    /* inget att göra */
  }
};

export const acceptSimplerSuggestion = (): void => {
  setLanguageLevel("simple");
  dismissSimplerSuggestion();
};
