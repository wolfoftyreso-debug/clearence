/**
 * REKOMMENDATIONEN ÄR EN DÖRR.
 *
 * "Gör en likviditetsprognos för de kommande 90 dagarna" stod som död
 * text i systemanalysen. Användaren läste vad hen borde göra, och fick
 * sedan själv leta rätt på verktyget som gör det. Det är den vanligaste
 * sortens övergivande i en produkt som ska leda någon genom en kris: rådet
 * gavs, men vägen fanns inte.
 *
 * Tre regler:
 *
 * 1. DESTINATIONEN KOMMER UR SPELBOKEN. `playbookForTask` vet redan vad en
 *    uppgift kräver och var det görs. Att skriva en andra tabell över
 *    "var hamnar man" hade gett två sanningar som glider isär - och då
 *    kan handlingsplanen och systemanalysen peka åt olika håll för samma
 *    mening.
 * 2. INGEN DÖRR SOM INTE LEDER NÅGONSTANS. Saknar spelboken steg finns
 *    ingen dörr, och raden förblir text. Ett klick som landar på en sida
 *    utan koppling till det man läste är värre än ingen länk alls.
 * 3. DEN SOM KOM SKA VETA VARFÖR. Ankomsten bär med sig VAD man kom för,
 *    VARFÖR det behövs och vad SLUTFÖRT betyder - och en väg tillbaka som
 *    bockar av uppgiften. Se docs/design-system.md, "Förbered användaren".
 */

import type { TaskContext, TaskPlaybook } from "./taskIntelligence";
import { playbookForTask } from "./taskIntelligence";

/** Frågeparametern som bär med sig var man kom ifrån. */
export const ORIGIN_PARAM = "fran";

export interface Destination {
  /** Vart klicket leder, inklusive ursprunget. */
  href: string;
  /** Spelboken bakom, så att ankomsten kan säga varför. */
  playbook: TaskPlaybook;
}

/**
 * Ursprunget som en sträng i adressen.
 *
 * Uppgiftens id när den kommer ur handlingsplanen; annars spelbokens id.
 * Det senare räcker för att kunna säga "du kom hit för att göra
 * likviditetsprognosen" även när raden inte är en sparad uppgift - och
 * bara det förra kan bockas av.
 */
export const withOrigin = (href: string, origin: string): string => {
  const [path, hash] = href.split("#");
  const joined = `${path}${path.includes("?") ? "&" : "?"}${ORIGIN_PARAM}=${encodeURIComponent(origin)}`;
  return hash ? `${joined}#${hash}` : joined;
};

export const readOrigin = (search: string): string | null => {
  try {
    const value = new URLSearchParams(search).get(ORIGIN_PARAM);
    return value && value.trim() ? value : null;
  } catch {
    return null;
  }
};

/**
 * Dörren bakom en rekommendation, eller null.
 *
 * Det FÖRSTA steget i spelboken är destinationen: spelböckerna är skrivna
 * i ordning, och det första steget är det som faktiskt går att börja med.
 * Ett steg som redan är gjort hoppas över - att skicka någon till en sida
 * där arbetet är klart är att slösa deras enda uppmärksamhet.
 */
export const destinationFor = (
  label: string,
  ctx: TaskContext,
  origin?: string,
): Destination | null => {
  const playbook = playbookForTask(label, ctx);
  if (playbook.steps.length === 0) return null;
  const next = playbook.steps.find((step) => !step.done) ?? playbook.steps[0];
  return {
    href: origin ? withOrigin(next.href, origin) : next.href,
    playbook,
  };
};

/* --- Ankomsten ------------------------------------------------------------ */

export interface Arrival {
  /** Uppgiften man kom för att göra. */
  task: string;
  /** Varför den behövs - spelbokens motivering, oförändrad. */
  why: string;
  /** Vad som räknas som klart här. */
  doneMeans: string;
  /** Vad som händer när man är klar. */
  afterwards: string;
}

/**
 * Vad "klart" betyder på den sida man landat på.
 *
 * Skrivet per destination och inte per uppgift: det är SIDAN som avgör
 * vad man kan bli färdig med där. En text som lovar mer än sidan kan
 * leverera skickar tillbaka användaren utan att något blivit gjort.
 */
const DONE_MEANS: { pattern: RegExp; text: string }[] = [
  { pattern: /^\/likviditetsplan/, text: "Planen är klar när posterna för de kommande 90 dagarna är inlagda och kurvan visar när det blir tight." },
  { pattern: /^\/kbr/, text: "Bedömningen är klar när balansposterna är ifyllda och du fått ett daterat besked." },
  { pattern: /^\/dashboard\/dokument/, text: "Underlaget räcker när kontoutdrag och senaste bokslut ligger i akten." },
  { pattern: /^\/dashboard\/deltagare/, text: "Klart när inbjudan är skickad - deltagaren ser ärendet så snart den accepteras." },
  { pattern: /^\/marketplace/, text: "Klart när förfrågan är skickad till minst en rådgivare." },
  { pattern: /^\/kunskap/, text: "Klart när du läst igenom och vet vad som gäller i ditt fall." },
  { pattern: /^\/dashboard/, text: "Klart när ändringen är registrerad i ärendet." },
];

export const doneMeansFor = (href: string): string =>
  DONE_MEANS.find((d) => d.pattern.test(href))?.text ??
  "Klart när du gjort det uppgiften beskriver.";

export const buildArrival = (task: string, playbook: TaskPlaybook, href: string): Arrival => ({
  task,
  why: playbook.why,
  doneMeans: doneMeansFor(href),
  afterwards:
    "När du är klar bockar du av uppgiften här nedanför och kommer tillbaka till handlingsplanen.",
});
