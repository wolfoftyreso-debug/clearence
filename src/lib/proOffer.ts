/**
 * ENGÅNGSERBJUDANDET: uppgradera till nivån som låser upp SMS, med första
 * veckan gratis - visat EN gång, med en nedräkning som FAKTISKT tar slut.
 *
 * Det här är medvetet byggt för att vara äkta, inte ett mörkt mönster.
 * Skillnaden är hela poängen:
 *
 *  - Det visas EN gång (en sparad flagga), inte varje gång sidan laddas.
 *    En "sista chans" som dyker upp om och om igen är en lögn, och en lögn
 *    i en produkt som säljer krishantering till pressade företag är precis
 *    det som förstör förtroendet i det ögonblick kunden behöver det mest.
 *  - Nedräkningen tar slut på riktigt: när den når noll dras
 *    gratisveckan tillbaka i vyn. Eftersom erbjudandet ändå bara visas en
 *    gång ÄR fönstret verkligt - brådskan är sann, inte påhittad.
 *  - Priset är ingen hårdkodad siffra. Det kommer ur prisparametrarna
 *    (pricing.ts), som drift sätter.
 *
 * Falsk brådska (en timer som nollställs, ett "endast idag" som gäller
 * varje dag) är dessutom otillbörlig marknadsföring. Den här varianten är
 * det inte.
 */

import { PLAN_TIERS } from "@/lib/pricing";

const SEEN_KEY = "clearance-pro-offer-seen";

/** Sant när erbjudandet redan visats en gång - då ska det aldrig visas igen. */
export const proOfferSeen = (): boolean => {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    // Privat läge: hellre visa en gång för mycket än att anta att vi visat.
    return false;
  }
};

/** Märk erbjudandet som visat. Kallas i samma stund det öppnas. */
export const markProOfferSeen = (): void => {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Se ovan: det värsta som händer är att det inte visas alls.
  }
};

/**
 * Nivån erbjudandet gäller: den som FAKTISKT låser upp SMS, läst ur
 * prislistan i stället för hårdkodad. SMS-kortet råkade kalla den
 * "Professional"; den heter Clearance Business, och det är den som ger SMS.
 */
export const smsTier = PLAN_TIERS.find((tier) =>
  tier.includes.some((rad) => /SMS/i.test(rad)),
)!;

/** Nedräkningens längd i sekunder. En minut - tydligt, inte utdraget. */
export const OFFER_SECONDS = 60;
