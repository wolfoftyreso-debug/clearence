/**
 * "VISA MIG" - fritext in, en plats i gränssnittet ut.
 *
 * Användaren ska kunna skriva "visa mig var rapporterna finns" och bli
 * ledd dit. Matchningen är deterministisk och sker mot katalogens
 * synonymer, inte mot en språkmodell: en guide som ibland pekar fel är
 * värre än ingen guide, eftersom den lär ut fel väg med auktoritet.
 *
 * Träffar den inget säger den det rakt ut och räknar upp vad den KAN
 * visa. Att gissa på den närmaste posten vore att svara på en annan
 * fråga än den som ställdes.
 */

import { GUIDE_CATALOGUE, type GuideEntry } from "./catalogue";

/**
 * Orden som bara inleder en fråga och inte pekar ut något.
 *
 * De rensas bort före matchningen så att "var finns rapporterna" och
 * "rapporter" hamnar på samma ställe.
 */
const FILLER = [
  "visa", "mig", "var", "finns", "hittar", "jag", "du", "kan", "man",
  "vad", "är", "det", "den", "de", "som", "en", "ett", "och", "på",
  "i", "in", "till", "för", "om", "hur", "vill", "se", "gå", "min",
  "mitt", "mina", "vi", "oss", "vår", "vårt",
];

/**
 * Normalisering före jämförelse.
 *
 * Skiftläge och skiljetecken bort. Å, ä och ö lämnas ORÖRDA - att
 * translitterera dem hade gjort "för" till "for" och därmed till ett
 * annat ord. Samma fälla som i tonvakterna: svenska bokstäver är
 * bokstäver.
 */
const normalise = (text: string): string =>
  text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();

const meaningfulWords = (text: string): string[] =>
  normalise(text)
    .split(" ")
    .filter((w) => w.length > 1 && !FILLER.includes(w));

export interface ShowMeResult {
  entry: GuideEntry | null;
  /** Vad guiden förstod. Visas när den inte hittade något. */
  understood: string[];
  /** Alternativen att erbjuda när träffen uteblev. */
  alternatives: GuideEntry[];
}

/**
 * Poängen för en post mot de sökta orden.
 *
 * En hel synonymfras som förekommer i frågan väger tyngst - "var sparas
 * rapporterna" ska slå igenom även om orden var för sig är vaga. Sedan
 * räknas enskilda ord.
 */
const scoreFor = (entry: GuideEntry, query: string, words: string[]): number => {
  const haystack = normalise(query);
  let score = 0;
  for (const synonym of entry.synonyms) {
    const s = normalise(synonym);
    if (s.includes(" ") && haystack.includes(s)) score += 10;
  }
  // Dubbletter bort. Etiketten är ofta också en synonym, och utan den
  // här raden räknades samma träff två gånger - vilket räckte för att
  // "in" i "bjuder in" skulle väga tyngre än ordet "revisor".
  const terms = [...new Set([...entry.synonyms, entry.label].map(normalise))];
  for (const word of words) {
    for (const term of terms) {
      if (term === word) score += 4;
      // Böjningar: "rapporter" mot "rapport", "dokumenten" mot "dokument".
      // Minst fyra tecken krävs för en prefixträff: kortare ord är
      // stavelser, inte begrepp, och "in" ska inte leda till
      // Inställningar.
      else if (word.length >= 4 && term.length > 3 && (term.startsWith(word) || word.startsWith(term))) {
        score += 2;
      }
    }
  }
  return score;
};

export const resolveShowMe = (query: string): ShowMeResult => {
  const words = meaningfulWords(query);
  if (words.length === 0) {
    return { entry: null, understood: [], alternatives: GUIDE_CATALOGUE.slice(0, 4) };
  }
  const ranked = GUIDE_CATALOGUE.map((entry) => ({ entry, score: scoreFor(entry, query, words) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    return { entry: null, understood: words, alternatives: GUIDE_CATALOGUE.slice(0, 4) };
  }
  // En tvetydig träff är ingen träff. Står två poster lika har frågan
  // inte pekat ut någon av dem, och då ska guiden fråga i stället för
  // att singla slant åt användaren.
  if (ranked.length > 1 && ranked[0].score === ranked[1].score) {
    return {
      entry: null,
      understood: words,
      alternatives: ranked.slice(0, 4).map((r) => r.entry),
    };
  }
  return { entry: ranked[0].entry, understood: words, alternatives: [] };
};

/** Svaret när guiden inte hittade något. Aldrig en tyst återvändsgränd. */
export const noMatchMessage = (result: ShowMeResult): string =>
  result.understood.length === 0
    ? "Skriv vad du letar efter, så visar jag var det finns."
    : `Jag hittar ingen entydig funktion för ${result.understood.map((w) => `"${w}"`).join(", ")}. Menar du någon av de här?`;
