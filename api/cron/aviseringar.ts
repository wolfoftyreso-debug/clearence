/**
 * AVISERINGSKÖN: verifieringar och notiser, mejl och SMS.
 *
 * Körde var femte minut i containern och gör det fortsatt. En avisering
 * som dröjer är i det här systemet en fristvarning som kommer försent -
 * takten är därför inte förhandlingsbar nedåt.
 */

import { korEttVarv } from "../../db/worker/notification-worker";
import { slappIn, utforJobb, type Fraga, type Svar } from "./_vakt";

export default async function handler(req: Fraga, res: Svar): Promise<void> {
  if (!slappIn(req, res)) return;
  /*
   * Aviseringsarbetaren öppnar och stänger sin egen anslutning inuti
   * korEttVarv - därför inga öppna/stäng-steg här.
   */
  await utforJobb(res, "aviseringar", async () => {}, async () => {}, [
    { namn: "aviseringskon", gor: korEttVarv },
  ]);
}
