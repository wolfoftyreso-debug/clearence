/**
 * ÄR AVISERINGARNA PÅSLAGNA?
 *
 * Tjänsten är byggd hel: tabeller, kö, beslutsregler, arbetare, kvitton och
 * en betald SMS-kanal. Ett enda led saknas - INGEN SKAPAR HÄNDELSER.
 * `enqueue_notification()` är den enda vägen in i kön, och den är oanropad
 * från produktionskod. Utan producent är klockan tom, inget mejl går ut och
 * inget SMS skickas, hur rätt allt annat än beter sig.
 *
 * Varje lager är grönt var för sig, och det är därför det här inte syntes:
 * SQL-provet anropar enqueue_notification själv, beslutsreglerna prövas som
 * ren funktion, och webbläsarproven kör demoläget, som hittar på händelser.
 * Ingen av dem ställer frågan om kedjan hänger ihop.
 *
 * DEN HÄR FLAGGAN FÅR INTE VARA EN ÅSIKT. tests/aviseringar.ts läser
 * produktionskoden (utan kommentarer - texten ovan nämner funktionen, och
 * det är inte ett anrop) och kräver att flaggan säger samma sak som koden.
 * Kopplas en producent in blir provet rött tills flaggan och texterna i
 * gränssnittet ändras. Det är avsikten: löftet och verkligheten ska inte
 * kunna glida isär i tysthet.
 */
export const AVISERINGAR_HAR_PRODUCENT = false;

/**
 * Vad användaren får läsa så länge. Formulerad för den som står i valet
 * eller framför prislappen: valen sparas, men ingenting skickas än.
 */
export const AVISERINGAR_INTE_LIVE =
  "Aviseringar utanför appen är inte påslagna än: ingen händelse skapas, så varken " +
  "klockan, mejlen eller SMS:en går i gång ännu. Dina val sparas och gäller den dag " +
  "de slås på.";
