/**
 * BELOPP OCH ANDELAR I SIMULERINGENS SPRÅK.
 *
 * Låg i SimulationPanel som en lokal hjälpare, och hade två fel som bara
 * syns när man faktiskt läser skärmen:
 *
 *  1. "−500 tkr kr". Formateraren satte redan ut ett skalord (tkr, mn) och
 *     panelen la på enheten en gång till. Tusen kronor är redan kronor.
 *  2. "2.29 mn". Decimalpunkt i en svensk siffra. Resten av produkten
 *     skriver 2,29.
 *
 * Enheten hör därför ihop med talet och formateras med det - inte bredvid.
 * Funktionen är ren och prövas i tests/montecarlo.ts.
 */

/** Svenskt tal: mellanslag som tusentalsavskiljare, komma som decimaltecken. */
const tal = (v: number, decimaler = 0): string =>
  v.toLocaleString("sv-SE", { minimumFractionDigits: decimaler, maximumFractionDigits: decimaler });

/**
 * Ett belopp med sin enhet, i ett stycke.
 *
 * Kronor skalas, eftersom en likviditetssiffra annars blir en rad siffror
 * ingen läser: 1 234 kr, 500 tkr, 2,29 mkr. Andra enheter skalas INTE -
 * "40 st" ska stå som 40 st, och "0,08" som andel ska inte bli "0 st".
 */
export const beloppMedEnhet = (v: number, enhet: string | null): string => {
  if (enhet === "kr") {
    const abs = Math.abs(v);
    if (abs >= 1e6) return `${tal(v / 1e6, 2)} mkr`;
    if (abs >= 1e4) return `${tal(Math.round(v / 1000))} tkr`;
    return `${tal(Math.round(v))} kr`;
  }
  // Små tal (andelar) tappar allt om de rundas till heltal.
  const avrundat = Math.abs(v) < 10 && !Number.isInteger(v) ? tal(v, 2) : tal(Math.round(v));
  return enhet ? `${avrundat} ${enhet}` : avrundat;
};

/**
 * En andel som procent: "12,3 %".
 *
 * En decimal, för att en sannolikhet med två decimaler låtsas om en
 * precision Monte Carlo inte har vid tiotusen iterationer. Null blir ett
 * tankstreck och inte "0 %" - "vet inte" och "aldrig" är olika svar.
 */
export const procentAv = (v: number | null | undefined): string =>
  v === null || v === undefined ? "\u2013" : `${tal(v * 100, 1)} %`;

/**
 * Kompakt belopp för axlar och nyckeltalskort, där enheten står i
 * rubriken och inte får upprepas per etikett.
 */
export const beloppKort = (v: number): string => {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${tal(v / 1e9, 1)} mdr`;
  if (abs >= 1e6) return `${tal(v / 1e6, 2)} mn`;
  if (abs >= 1e4) return `${tal(Math.round(v / 1000))} tkr`;
  return tal(Math.round(v));
};
