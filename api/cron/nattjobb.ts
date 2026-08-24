/**
 * NATTJOBBET: det som containern körde med cron.
 *
 * Gallring, radering, kreditkontroller, förfallna konton, påminnelser och
 * de två faktureringarna. Ett steg som kastar stoppar inte de andra - se
 * kor() i _vakt.ts.
 *
 * FAKTURERINGARNA KÖRS VARJE NATT, INTE BARA DEN FÖRSTA.
 * Funktionerna i workern väljer själva vilka rader som är mogna; att köra
 * dem dagligen är ofarligt och gör att en missad natt tas igen nästa.
 */

import {
  anslut,
  koppla_ner,
  runCreditChecks,
  runGallring,
  runPaminnelser,
  runRaderingar,
  runReferralInvoicing,
  runStangning,
  runUsageInvoicing,
} from "../../db/worker/email-worker";
import { slappIn, utforJobb, type Fraga, type Svar } from "./_vakt";

export default async function handler(req: Fraga, res: Svar): Promise<void> {
  if (!slappIn(req, res)) return;

  await utforJobb(res, "nattjobb", anslut, koppla_ner, [
    { namn: "gallring", gor: runGallring },
    { namn: "raderingar", gor: runRaderingar },
    { namn: "kreditkontroller", gor: runCreditChecks },
    { namn: "stangning", gor: runStangning },
    { namn: "paminnelser", gor: runPaminnelser },
    { namn: "formedlingsfakturor", gor: runReferralInvoicing },
    { namn: "anvandningsfakturor", gor: runUsageInvoicing },
  ]);
}
