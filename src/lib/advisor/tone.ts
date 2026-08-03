/**
 * Tonaliteten: hur CLEARANCE låter, som kod i stället för som ambition.
 *
 * Två regler bor här, och båda är testade (tests/tone.ts):
 *
 *  1. **Bekräftelser ska vara förankrade i vad användaren faktiskt har
 *     gjort eller bidragit med.** "Bra jobbat!" säger ingenting om
 *     arbetet - det säger bara att någon vill vara trevlig. En
 *     företagare mitt i en kris hör skillnaden direkt, och tom beröm
 *     kostar förtroende i exakt det ögonblick förtroendet behövs.
 *  2. **Empati utan sentimentalitet.** Många företagsledare vill inte
 *     bli omhändertagna. De vill bli förstådda och sedan hjälpta.
 *
 * Skillnaden i praktiken: en förankrad bekräftelse berättar vad
 * bidraget gjorde för ARBETET ("det här minskar osäkerheten i den
 * fortsatta analysen"), inte vad det säger om PERSONEN ("du verkar
 * väldigt kunnig"). Den första går att kontrollera. Den andra är en
 * åsikt om någon vi aldrig har träffat.
 */

/** CLEARANCE:s personlighet, som lista - för att den ska gå att bryta mot. */
export const PERSONALITY = [
  "Professionell och lugn",
  "Empatisk utan att bli känslosam",
  "Tydlig och effektiv",
  "Driver processen framåt med korta, konkreta steg",
  "Ställer bara frågor som har ett tydligt syfte",
  "Bekräftar framsteg löpande",
] as const;

/**
 * Vad användaren just bidrog med. Bekräftelsen väljs efter BIDRAGET,
 * aldrig efter behovet av att säga något trevligt.
 */
export type Contribution =
  | "uppgift"
  | "siffror"
  | "beslut"
  | "beskrivning"
  | "dokument";

/**
 * De förankrade bekräftelserna. Var och en säger vad bidraget gjorde
 * för underlaget - det är det som gör den kontrollerbar.
 */
export const GROUNDED_CONFIRMATION: Record<Contribution, string> = {
  uppgift: "Det här är värdefull information.",
  siffror: "Nu har vi ett betydligt bättre beslutsunderlag.",
  beslut: "Det här minskar osäkerheten i den fortsatta analysen.",
  beskrivning:
    "Du beskriver verksamheten med en detaljnivå som ger en tydligare bild av situationen.",
  dokument: "Med handlingen på plats vilar bedömningen på underlag i stället för minne.",
};

export const confirmContribution = (kind: Contribution): string =>
  GROUNDED_CONFIRMATION[kind];

/**
 * Orden som gör en bekräftelse förankrad: den pekar på arbetet, inte på
 * personen. Testet kräver att varje bekräftelse innehåller minst ett.
 */
export const GROUNDING_ANCHORS = [
  "information",
  "beslutsunderlag",
  "underlag",
  "analys",
  "bild av situationen",
  "bedömning",
] as const;

export const isGrounded = (text: string): boolean =>
  GROUNDING_ANCHORS.some((anchor) => text.toLowerCase().includes(anchor));

/**
 * Tom beröm: fraser som berömmer utan att säga vad som var bra. Varje
 * post har en ersättare, för att en regel utan alternativ bara blir en
 * tom lucka i texten.
 *
 * Den här filen är med flit undantagen från filsökningen i tests/tone.ts -
 * det är här fraserna får stå, just för att de ska gå att förbjuda.
 */
export const EMPTY_PRAISE: readonly { pattern: RegExp; instead: string }[] = [
  { pattern: /\bbra jobbat\b/i, instead: GROUNDED_CONFIRMATION.uppgift },
  { pattern: /\bperfekt\b/i, instead: GROUNDED_CONFIRMATION.siffror },
  { pattern: /\bdu gör rätt\b/i, instead: GROUNDED_CONFIRMATION.beslut },
  { pattern: /\bdu verkar (väldigt |mycket )?kunnig\b/i, instead: GROUNDED_CONFIRMATION.beskrivning },
  { pattern: /\bvad duktig\b/i, instead: GROUNDED_CONFIRMATION.uppgift },
  { pattern: /\bsnyggt jobbat\b/i, instead: GROUNDED_CONFIRMATION.uppgift },
  { pattern: /\bkanon\b/i, instead: GROUNDED_CONFIRMATION.siffror },
  { pattern: /\bgrymt\b/i, instead: GROUNDED_CONFIRMATION.siffror },
];

/** Den första tomma berömmen i texten, eller null. Används av testet. */
export const emptyPraiseIn = (text: string): string | null => {
  for (const { pattern } of EMPTY_PRAISE) {
    const hit = text.match(pattern);
    if (hit) return hit[0];
  }
  return null;
};

/** Vad man ska säga i stället. Null när frasen inte är förbjuden. */
export const insteadOf = (phrase: string): string | null =>
  EMPTY_PRAISE.find(({ pattern }) => pattern.test(phrase))?.instead ?? null;

/**
 * Sentimentaliteten som togs bort ur onboardingen. Kvar som regel, inte
 * som minne: "du är inte ensam" och "det kan kännas överväldigande" är
 * omtanke som talar om känslan i stället för om arbetet.
 */
/*
 * Obs: \b räknar bara ASCII som ordtecken. Ett mönster som börjar på å,
 * ä eller ö får därför ALDRIG en inledande \b - gränsen finns inte, och
 * mönstret matchar tyst ingenting. Därför står "överväldigande" utan.
 */
export const SENTIMENTAL = [
  /\bdu är inte ensam\b/i,
  /överväldigande/i,
  /\bjag är så ledsen\b/i,
  /\bstackars\b/i,
] as const;

export const sentimentalIn = (text: string): string | null => {
  for (const pattern of SENTIMENTAL) {
    const hit = text.match(pattern);
    if (hit) return hit[0];
  }
  return null;
};
