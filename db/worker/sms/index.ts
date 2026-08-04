/**
 * Valet av SMS-leverantör - på ETT ställe.
 *
 * Arbetaren frågar efter "den konfigurerade leverantören" och får en
 * `SmsProvider`. Den vet inte vem det är, och ska inte veta: hela
 * poängen med kapslingen är att ett leverantörsbyte ska vara en
 * ändring i den här katalogen och ingen annanstans.
 *
 * tests/notificationService.ts vaktar det: leverantörens namn får inte
 * förekomma i någon fil utanför db/worker/sms/. Den som lägger in ett
 * anrop direkt mot leverantören någon annanstans får ett rött test.
 */

import { elksProvider } from "./elks";
import { missingProvider, type SmsProvider } from "./provider";

// Nyckelns namn ägs av domänlagret, inte av kapslingen: driftpanelen
// behöver samma sträng för att kunna spara nyckeln.
export { SMS_SECRET_PROVIDER } from "../../../src/lib/notifications/events";

/**
 * Bygger leverantören ur den lagrade hemligheten.
 *
 * Saknas nyckeln, eller är den felformad, returneras en leverantör som
 * KASTAR med skälet utskrivet. Att i stället låta arbetaren krascha hade
 * tagit ner även verifieringskön; att tyst låtsas skicka hade varit
 * värre än båda.
 */
export const providerFromSecret = (secret: string | null): SmsProvider => {
  if (!secret) return missingProvider("Ingen SMS-nyckel är satt i driftpanelen.");
  try {
    return elksProvider(secret);
  } catch (error) {
    return missingProvider(error instanceof Error ? error.message : String(error));
  }
};

export type { SmsProvider } from "./provider";
