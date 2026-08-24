/**
 * SIMULERINGSARBETAREN. Körs i driftmiljön som schemalagd uppgift:
 *
 *   node db/dist/simulation-worker.cjs            var minut
 *
 * VARFÖR DEN FINNS ÖVER HUVUD TAGET.
 *
 * API:t är EN process. En körning på en miljon iterationer tar dryga två
 * sekunder på en modern maskin - i en HTTP-handler betyder det två
 * sekunders kö för varje annan användares anrop, inklusive inloggningar
 * och hälsokontroller. Motorn har därför en tröskel (TROSKEL_FOR_KO):
 * lätta körningar sker i förfrågans egen tur, tunga hamnar här.
 *
 * Utan den här filen hade den köade vägen varit ett löfte utan täckning -
 * en rad som säger "queued" i all evighet. Det är precis den sortens tysta
 * halvfärdighet som gör ett system opålitligt.
 *
 * TRE REGLER, SAMMA SOM DE ANDRA ARBETARNAS:
 *
 *  1. claim_simulation_runs() är enda vägen in i kön. Den låser med
 *     `for update skip locked`, så två arbetare kan köra samtidigt utan att
 *     ta samma rad, och den räknar upp attempts - en körning som kraschar
 *     arbetaren plockas inte i all evighet.
 *  2. RESULTATET SKRIVS ALLTID TILLBAKA, även vid krasch. En rad som lämnas
 *     i 'running' är en körning ingen väntar på och ingen kan avbryta.
 *  3. Räknandet görs av SAMMA motor som API:t och webbläsaren använder
 *     (src/lib/montecarlo/motor.ts). Två implementationer hade gett två
 *     svar på samma fråga, och frågan är om ett bolag ska rekonstrueras.
 *
 * Miljövariabler:
 *   DATABASE_URL      postgres://app_worker:...@host/db - ALDRIG superanvändare
 *   SIM_BATCH         antal körningar per varv (standard 2)
 *   SIM_MAX_MS        tak för en enskild körning i millisekunder (standard 120000)
 */

import { Client } from "pg";
import { arbetarUrl, kravArbetarroll } from "./roll";
import {
  Avbruten,
  kor,
  MOTORVERSION,
  type Simuleringsspec,
} from "../../src/lib/montecarlo/motor";

interface Korad {
  id: string;
  seed: string | number;
  spec: unknown;
  iterations: number;
  engine_version: string;
}

const heltalUrMiljon = (namn: string, standard: number, min: number, max: number): number => {
  const v = Number(process.env[namn] ?? standard);
  return Number.isInteger(v) && v >= min && v <= max ? v : standard;
};

/**
 * Kör en rad och skriv tillbaka utfallet.
 *
 * Returnerar aldrig ett fel uppåt: en körning som misslyckas ska markeras
 * som misslyckad och inte stoppa resten av kön.
 */
const behandla = async (klient: Client, rad: Korad): Promise<"klar" | "misslyckad"> => {
  const takMs = heltalUrMiljon("SIM_MAX_MS", 120000, 1000, 900000);
  const start = Date.now();

  try {
    /*
     * MOTORVERSIONEN MÅSTE STÄMMA.
     *
     * Raden skrevs av ett API som körde en viss version. Har arbetaren
     * hunnit rullas till en nyare är resultatet inte längre det som
     * beställdes - samplingen kan ha ändrats, och då är fröet inte längre
     * en garanti. Bättre att säga det rakt ut än att leverera siffror som
     * ser rätt ut men inte går att reproducera med den version som står på
     * raden.
     */
    if (rad.engine_version !== MOTORVERSION) {
      throw new Error(
        `Körningen beställdes med motorversion ${rad.engine_version}, arbetaren kör ${MOTORVERSION}. ` +
          "Starta om körningen så att frö och version hör ihop.",
      );
    }

    const rå = (rad.spec ?? {}) as Record<string, unknown>;
    const spec: Simuleringsspec = {
      namn: "Köad körning",
      inputs: (rå.inputs ?? []) as Simuleringsspec["inputs"],
      outputs: (rå.outputs ?? []) as Simuleringsspec["outputs"],
      konstanter: (rå.konstanter ?? {}) as Record<string, number>,
      iterationer: rad.iterations,
      fro: Number(rad.seed),
    };

    const resultat = kor(spec, {
      /*
       * TVÅ SKÄL ATT AVBRYTA MELLAN BATCHAR.
       *
       * Användaren kan ha tryckt avbryt - då står raden inte längre som
       * 'running', och att fortsätta räkna vore att bränna processorkraft
       * på ett svar ingen vill ha.
       *
       * Och ett tak i tid: en modell kan vara långsam på sätt ingen
       * förutsåg, och en arbetare som mal i en timme är en arbetare som
       * inte tar hand om kön.
       */
      framsteg: () => {
        if (Date.now() - start > takMs) {
          throw new Error(
            `Körningen överskred tidsgränsen på ${Math.round(takMs / 1000)} sekunder. ` +
              "Minska antalet iterationer eller förenkla modellen.",
          );
        }
        return true;
      },
    });

    await klient.query(
      `select public.finish_simulation_run($1::uuid, 'done'::public.simulation_status,
              $2::jsonb, $3::jsonb, null, $4::integer, $5::integer)`,
      [
        rad.id,
        JSON.stringify({ outputs: resultat.outputs }),
        JSON.stringify(resultat.anmarkningar),
        resultat.varaktighetMs,
        resultat.forkastadeIterationer,
      ],
    );
    return "klar";
  } catch (fel) {
    const meddelande =
      fel instanceof Avbruten
        ? "Körningen avbröts."
        : fel instanceof Error
          ? fel.message
          : "Okänt fel i simuleringen.";
    // Skrivs ALLTID. Se regel 2 i filens inledning.
    await klient.query(
      `select public.finish_simulation_run($1::uuid, 'failed'::public.simulation_status,
              null, null, $2::text, $3::integer, 0)`,
      [rad.id, meddelande.slice(0, 2000), Date.now() - start],
    );
    return "misslyckad";
  }
};

/**
 * Ett varv genom kön. Exporterad så att cron-endpointen kör SAMMA kod som
 * kommandot gjorde - inte en andra, snarlik implementation.
 */
export const korEttVarv = async (): Promise<{
  plockade: number;
  klara: number;
  misslyckade: number;
}> => {
  const url = arbetarUrl();
  // Kastar i stället för process.exit(): filen importeras numera av en
  // Vercel-funktion, där ett exit river hela instansen utan svar.
  if (!url) throw new Error("WORKER_DATABASE_URL eller DATABASE_URL måste vara satt.");
  const batch = heltalUrMiljon("SIM_BATCH", 2, 1, 10);

  const klient = new Client({ connectionString: url });
  await klient.connect();
  await kravArbetarroll(klient);

  let klara = 0;
  let misslyckade = 0;
  try {
    const { rows } = await klient.query<Korad>(
      "select id, seed, spec, iterations, engine_version from public.claim_simulation_runs($1)",
      [batch],
    );
    for (const rad of rows) {
      const utfall = await behandla(klient, rad);
      if (utfall === "klar") klara++;
      else misslyckade++;
    }

    /*
     * Observerbarheten går samma väg som resten av driften: en rad
     * strukturerad JSON på stdout, som loggsamlaren plockar upp. Ett eget
     * mätsystem för just simuleringar hade varit ett andra ställe att
     * titta på när något är fel.
     */
    console.log(
      JSON.stringify({
        handelse: "simuleringar_behandlade",
        plockade: rows.length,
        klara,
        misslyckade,
        motorversion: MOTORVERSION,
      }),
    );
    return { plockade: rows.length, klara, misslyckade };
  } finally {
    await klient.end();
  }
};

// Körs bara som kommando - se samma resonemang i email-worker.ts.
if (/simulation-worker/.test(process.argv[1] ?? "")) {
  void korEttVarv().catch((fel) => {
    console.error(
      JSON.stringify({
        handelse: "simuleringsarbetaren_kraschade",
        fel: fel instanceof Error ? fel.message : String(fel),
      }),
    );
    process.exit(1);
  });
}
