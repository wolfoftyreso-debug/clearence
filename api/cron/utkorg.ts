/**
 * UTKORGEN: bygger inbjudningsmejlen och skickar det som ligger i kön.
 *
 * Kör var femte minut. Ett mejl som ligger kvar i kön är ett besked som
 * inte nått fram - och i det här systemet är beskeden fristvarningar och
 * fakturor, alltså sådant där dröjsmålet i sig är skadan.
 *
 * Kön plockas 20 rader i taget (claim_outbound_emails). Är det fler kvar
 * tar nästa körning dem - det är därför femminuterstakten är vald och
 * inte en timme.
 */

import { anslut, koppla_ner, runUtkorg } from "../../db/worker/email-worker";
import { slappIn, utforJobb, type Fraga, type Svar } from "./_vakt";

export default async function handler(req: Fraga, res: Svar): Promise<void> {
  if (!slappIn(req, res)) return;

  await utforJobb(res, "utkorg", anslut, koppla_ner, [{ namn: "utkorg", gor: runUtkorg }]);
}
