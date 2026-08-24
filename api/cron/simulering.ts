/**
 * SIMULERINGSKÖN, ETT VARV.
 *
 * TAKET SÄNKS HÄR, OCH DET ÄR EN MEDVETEN AVVÄGNING.
 *
 * På en egen server fick en tung Monte Carlo-körning ta upp till femton
 * minuter (SIM_MAX_MS tillät 900 000 ms). En Vercel-funktion får inte
 * leva så länge - taket är 300 sekunder. En körning som spränger det
 * dödas av plattformen MITT I, alltså utan att skriva tillbaka något, och
 * raden blir kvar i 'running' tills attempts tar slut. Det är precis det
 * som regel 2 i simulation-worker.ts finns för att förhindra.
 *
 * Därför sätts taket till funktionens gräns minus marginal, INNAN
 * arbetaren läser miljön. Sätter drift ett högre SIM_MAX_MS vinner det
 * här - ett tak som går att konfigurera förbi är inget tak.
 *
 * KONSEKVENSEN, RAKT UT: en körning som skulle tagit mer än ~4,5 minut
 * blir markerad som misslyckad med tidsgränsbeskedet i stället för att
 * levereras. Alternativet - att den dör tyst - är sämre.
 *
 * Kön töms i stället oftare: var femte minut, SIM_BATCH rader per varv.
 */

import { korEttVarv } from "../../db/worker/simulation-worker";
import { slappIn, utforJobb, type Fraga, type Svar } from "./_vakt";

/** Vercels tak för en funktion, i millisekunder. Speglas i vercel.json. */
const FUNKTIONENS_TAK_MS = 300_000;
/** Utrymme för anslutning, plockning och återskrivning. */
const MARGINAL_MS = 20_000;

export default async function handler(req: Fraga, res: Svar): Promise<void> {
  if (!slappIn(req, res)) return;

  const utrymme = FUNKTIONENS_TAK_MS - MARGINAL_MS;
  const onskat = Number(process.env.SIM_MAX_MS ?? 0);
  const tak = Math.min(onskat > 0 ? onskat : utrymme, utrymme);
  process.env.SIM_MAX_MS = String(tak);

  // korEttVarv sköter sin egen anslutning.
  await utforJobb(res, "simulering", async () => {}, async () => {}, [
    {
      namn: "simuleringskon",
      gor: async () => {
        await korEttVarv();
      },
    },
  ]);
}
