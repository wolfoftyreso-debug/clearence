/**
 * HTML:EN I AVISERINGSMEJLET.
 *
 * Aviseringsmejlet är den enda vägen ut ur systemet som bygger sin egen
 * HTML; allt annat går via src/lib/email/messages.ts, där varje värde
 * flyktas. Titel, brödtext och länk kommer ur notification_events, och den
 * tabellen ska fyllas av produktionskod med ärendenamn, dokumenttitlar och
 * avsändarnamn - text en användare har skrivit.
 *
 * VARFÖR DE HÄR TVÅ RADERNA BOR I EN EGEN MODUL i stället för i arbetaren:
 * en regel som bara finns inne i en arbetare går inte att pröva utan att
 * starta arbetaren, och ett prov som skriver av regeln prövar sin egen
 * avskrift. Det upptäcktes på det hårda sättet - en mutation som tog bort
 * länkkontrollen i arbetaren lämnade provet grönt.
 */

/** Flykt för text som ska stå i HTML. Samma uppsättning som mejlbyggarna. */
export const escHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Länken i mejlet får bara peka IN i produkten: en enkel snedstreckssökväg.
 *
 * Allt annat byts mot startsidan - javascript: och data: är angrepp, och
 * "//någon.annan" och "https://..." är utgångar ur produkten. Att säga "det
 * kan inte hända, vi skriver href själva" håller precis tills någon fyller
 * href ur ett användarfält.
 */
export const SAKER_LANK = /^\/[^/\\]/;

export const trygLank = (href: string): string => (SAKER_LANK.test(href) ? href : "/dashboard");
