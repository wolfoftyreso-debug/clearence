/**
 * SMS-leverantören, som ett gränssnitt.
 *
 * Resten av produkten känner inte till någon leverantör. Den vet att det
 * finns en `SmsProvider` med en metod, och det är hela kontraktet.
 *
 * Skälet är inte principiell renhet utan att leverantörsbyten sker: en
 * höjd prislista, en driftstörning som varar för länge, eller ett krav på
 * att trafiken stannar inom EU. Ligger leverantörens namn i tjugo filer
 * blir bytet ett projekt; ligger det i en blir det en eftermiddag.
 */

export interface SmsResult {
  /** Leverantörens id för meddelandet. Sparas för spårning. */
  id: string;
}

export interface SmsProvider {
  /** Namnet, för loggen. */
  readonly name: string;
  /**
   * Skickar ett meddelande. Kastar vid fel - anroparen skriver alltid
   * tillbaka ett resultat, även vid krasch, annars plockas raden om och
   * mottagaren får meddelandet två gånger.
   */
  send(to: string, body: string): Promise<SmsResult>;
}

/**
 * Leverantören som inte skickar något.
 *
 * Används när nyckeln saknas. Alternativet - att låta arbetaren krascha
 * - hade tagit ner även e-postkön, och att tyst låtsas skicka hade varit
 * värre än båda: en kö som ser tom och lyckad ut fast ingenting kommit
 * fram är det enda felet ingen upptäcker.
 *
 * Den här kastar, med ett begripligt skäl, så att raden hamnar i
 * driftpanelen som misslyckad med orsaken utskriven.
 */
export const missingProvider = (reason: string): SmsProvider => ({
  name: "ingen",
  async send() {
    throw new Error(reason);
  },
});
