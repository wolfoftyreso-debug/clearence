/**
 * Databaslagret: det enda stället där identitet sätts.
 *
 * Hela produktens säkerhetsmodell bor i radskyddet, och radskyddet vet vem
 * som frågar genom EN sak - `app.user_id` i den pågående transaktionen.
 * Blir den fel returnerar frågorna fortfarande rader; de returnerar bara
 * ett annat bolags insolvensdata. Felet syns aldrig som ett fel.
 *
 * Därför är det här filens enda uppgift, och därför finns ingen väg förbi
 * den: `withUser()` och `withAnon()` är de enda exporterade sätten att
 * röra databasen.
 *
 * Tre regler, alla från db/README.md och docs/infrastructure.md:
 *
 *  1. **`set_config(..., true)` - transaktionslokalt.** Sessionslokalt på
 *     en poolad anslutning läcker föregående requests identitet till
 *     nästa. Det är den farligaste buggen i hela systemet eftersom den
 *     bara syns under last.
 *  2. **`set local role authenticated`.** Rollen äger inga tabeller och
 *     har inte BYPASSRLS. Kör man som ägaren stängs radscopingen av TYST
 *     - frågorna fortsätter fungera och börjar returnera andra bolags
 *     data.
 *
 *     Varför `authenticated` och inte `app_user`: tabellrättigheterna i
 *     migrationerna är skrivna till `authenticated`, och `authenticated`
 *     är MEDLEM i `app_user` (bootstrap.sql) - alltså ärver den nedåt,
 *     inte uppåt. `app_user` ensamt saknar select på tabellerna, vilket
 *     ger 42501 på första frågan. `app_user` är kvar som den roll som
 *     definierar begränsningen; `authenticated` är den som används.
 *  3. **Allt i en transaktion.** Identiteten och frågorna måste dela
 *     transaktion, annars gäller den inte när frågan körs.
 */

import { Pool, type PoolClient } from "pg";

let pool: Pool | null = null;

export const getPool = (): Pool => {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PGPOOL_MAX ?? 10),
      // En request som väntar på en anslutning i en minut är redan
      // förlorad för användaren; bättre ett ärligt fel än en hängning.
      connectionTimeoutMillis: 5_000,
      idle_in_transaction_session_timeout: 10_000,
    } as never);
  }
  return pool;
};

export const closePool = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};

export type Tx = Pick<PoolClient, "query">;

/**
 * Kör arbetet som den inloggade användaren.
 *
 * `userId` null betyder "ingen inloggad" - och då sätts `app.user_id` till
 * tomma strängen, vilket `app.current_user_id()` läser som null. Varje
 * policy är skriven så att en null-identitet matchar noll rader: att
 * misslyckas STÄNGT är hela poängen.
 */
export const withUser = async <T>(
  userId: string | null,
  work: (tx: Tx) => Promise<T>,
): Promise<T> => {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    // Rollen först: sätts den efter frågorna har de redan körts som
    // anslutningens egen roll, som kan vara ägaren.
    await client.query("set local role authenticated");
    await client.query("select set_config('app.user_id', $1, true)", [userId ?? ""]);
    // Kvar för de policyer som skrevs mot Supabase och läser JWT-anspråket.
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {
      // Rollbacken kan misslyckas om anslutningen redan är trasig. Det
      // ursprungliga felet är det intressanta - kasta det, inte detta.
    });
    throw error;
  } finally {
    // ALLTID tillbaka till poolen. En läckt anslutning tar med sig sin
    // roll och sina inställningar in i nästa request.
    client.release();
  }
};

/**
 * Arbete utan inloggad användare: inloggningen själv, och uppslag med
 * API-nyckel där nyckeln - inte en session - är behörigheten.
 *
 * Kör som anslutningens egen roll, eftersom de funktionerna är
 * SECURITY DEFINER och gör sin egen behörighetsprövning. Ingen
 * användaridentitet sätts, så inget radskydd kan råka släppa igenom
 * något på en identitet som ligger kvar.
 */
export const withAnon = async <T>(work: (tx: Tx) => Promise<T>): Promise<T> => {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.user_id', '', true)");
    await client.query("select set_config('request.jwt.claim.sub', '', true)");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};
