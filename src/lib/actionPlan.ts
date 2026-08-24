/**
 * Handlingsplanens nedräkning.
 *
 * Ren logik för "hur långt är det kvar till det här datumet, och hur ska
 * det sägas". Bor i lib och inte i komponenten av samma skäl som allt annat
 * datumberoende: en frist som visas fel är ett fel med rättslig innebörd,
 * och då ska formuleringen gå att testa utan webbläsare.
 *
 * Tonerna mappar på designsystemets betydelser: "frist" är reserverad för
 * en klocka som går (fristfärgen), "critical" för en som redan ringt.
 */

export interface Countdown {
  /** Hela dagar kvar. Negativt när datumet passerat. */
  daysLeft: number;
  /** "idag", "imorgon", "om 5 dagar", "för 3 dagar sedan". */
  label: string;
  tone: "passed" | "today" | "soon" | "later";
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Kalenderdagar, inte 24-timmarsperioder: en frist den 12:e är "imorgon"
 * hela den 11:e, oavsett klockslag. Samma princip som stängningsjobbet.
 */
/**
 * VARSELFÖNSTRET: hur många dagar före en frist läget räknas som nära.
 *
 * Ett system som varnar på olika dagar på olika ställen lär användaren att
 * ignorera varningarna. Siffran stod skriven som "3" på tre ställen -
 * här, i notifications.ts och i presentation.ts - med en kommentar som
 * sa att de MÅSTE vara lika. Tre kopior av ett måste är inget måste.
 *
 * tests/scenarier.ts kräver att alla tre lagren växlar på samma dag.
 */
export const VARSELFONSTER_DAGAR = 3;

export const countdownTo = (iso: string, now: Date): Countdown => {
  const target = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysLeft = Math.round((target.getTime() - today.getTime()) / DAY_MS);

  if (daysLeft < 0) {
    const abs = Math.abs(daysLeft);
    return {
      daysLeft,
      label: abs === 1 ? "igår" : `för ${abs} dagar sedan`,
      tone: "passed",
    };
  }
  if (daysLeft === 0) return { daysLeft, label: "idag", tone: "today" };
  if (daysLeft === 1) return { daysLeft, label: "imorgon", tone: "soon" };
  return {
    daysLeft,
    label: `om ${daysLeft} dagar`,
    tone: daysLeft <= VARSELFONSTER_DAGAR ? "soon" : "later",
  };
};

/**
 * Sorteringsordning för handlingsplanen: passerade frister överst - de är
 * inte historia utan olösta problem - därefter närmast i tiden.
 */
export const compareByUrgency = (a: { iso: string }, b: { iso: string }): number =>
  a.iso.localeCompare(b.iso);
