/**
 * REGISTERUTDRAG OCH DATAPORTABILITET (GDPR art. 15 och 20).
 *
 * Den registrerade har rätt att få veta vilka uppgifter vi har om hen, och
 * att få med sig dem i ett maskinläsbart format. Det här bygger just det:
 * en enda JSON med det kontot faktiskt äger, hämtat ur samma läsvägar som
 * appen själv använder - ingen skuggkopia, inget påhittat.
 *
 * Ren funktion, medvetet: den tar färdiga uppgifter och formar dem, så att
 * den går att pröva utan konto och utan nät. Sidan (DashboardSettings)
 * hämtar delarna och lämnar dem hit.
 */

export interface MyDataParts {
  /** Inloggningsadressen. */
  epost: string | null;
  /** Profilen: namn och telefon som användaren själv fyllt i. */
  profil: unknown;
  /** Kontots ekonomiska läge (start, status) - inte fakturorna, de är egna. */
  ekonomi: unknown;
  /** Aviseringsvalen. */
  aviseringar: unknown;
  /** Ärendena användaren är med i, i sammandrag. */
  arenden: unknown[];
}

export interface MyDataExport {
  /** Stabil formatstämpel, så en mottagare vet vad filen är. */
  format: "clearance-personuppgifter-v1";
  /** När utdraget togs (ISO). Sätts av anroparen, inte av en klocka här. */
  uttaget: string;
  /** Klartext om vad filen är och vilken rätt den svarar mot. */
  om: string;
  konto: { epost: string | null };
  profil: unknown;
  ekonomi: unknown;
  aviseringar: unknown;
  arenden: unknown[];
}

const OM =
  "Det här är ett registerutdrag enligt dataskyddsförordningen (GDPR art. 15) " +
  "i ett maskinläsbart format för dataportabilitet (art. 20). Det innehåller " +
  "de personuppgifter kontot äger. Fakturor och bokföringsunderlag har egna " +
  "lagringskrav och laddas ned separat under Fakturor och kvitton.";

/** Formar utdraget och ett filnamn. `uttagetIso` sätts av anroparen. */
export const buildMyDataExport = (
  parts: MyDataParts,
  uttagetIso: string,
): { data: MyDataExport; fileName: string } => {
  const data: MyDataExport = {
    format: "clearance-personuppgifter-v1",
    uttaget: uttagetIso,
    om: OM,
    konto: { epost: parts.epost },
    profil: parts.profil ?? null,
    ekonomi: parts.ekonomi ?? null,
    aviseringar: parts.aviseringar ?? null,
    arenden: parts.arenden ?? [],
  };
  // Datumdel ur ISO utan att tolka tidszon: filnamnet ska bara vara läsbart.
  const dag = uttagetIso.slice(0, 10);
  return { data, fileName: `clearance-mina-uppgifter-${dag}.json` };
};
