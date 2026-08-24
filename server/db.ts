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

/**
 * MILJÖVARIABELN SOM SAKNAS SKA SÄGA SITT NAMN.
 *
 * Utan DATABASE_URL bygger `pg` en anslutning ur sina egna standardvärden
 * och försöker nå Postgres på localhost. På Vercel finns ingen sådan, så
 * felet blev `ECONNREFUSED 127.0.0.1:5432` - ett besked som pekar på en
 * server som aldrig var meningen, och inte med ett ord på den variabel
 * som faktiskt fattas. Den som läser loggen börjar leta efter en databas
 * i stället för efter en inställning.
 */
export const kravDatabasUrl = (): string => {
  const url = (process.env.DATABASE_URL ?? "").trim();
  if (url) return url;
  throw new Error(
    [
      "DATABASE_URL är inte satt.",
      "",
      "  API:t har ingen databas att fråga. Sätt variabeln i Vercel-projektets",
      "  inställningar, per miljö. Den ska peka på en egen login-roll som är",
      "  medlem i authenticated och varken äger tabeller eller har BYPASSRLS -",
      "  se docs/vercel.md. De schemalagda jobben använder WORKER_DATABASE_URL",
      "  och har motsatt krav.",
    ].join("\n"),
  );
};

export const getPool = (): Pool => {
  if (!pool) {
    pool = new Pool({
      connectionString: kravDatabasUrl(),
      max: Number(process.env.PGPOOL_MAX ?? 2),
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

/* --- Rollen API:t faktiskt ansluter med ---------------------------------- */

export interface RollBesked {
  roll: string;
  saker: boolean;
  skal: string[];
}

/**
 * PRÖVAR ATT ANSLUTNINGENS ROLL INTE STÄNGER AV RADSKYDDET.
 *
 * Det här är produktens farligaste felkonfiguration, och den enda som
 * FAILAR ÖPPET: pekas DATABASE_URL på superanvändaren, på tabellernas ägare
 * eller på en roll med BYPASSRLS, så fortsätter varje fråga att fungera -
 * den börjar bara returnera andra bolags insolvensdata. Ingenting kraschar,
 * ingen logg blir röd, och felet syns först när någon läser fel akt.
 *
 * Tre skäl att vägra starta:
 *
 *  1. SUPERANVÄNDARE. Kringgår allt, alltid.
 *  2. BYPASSRLS. Rollens hela syfte är att gå förbi radskyddet.
 *  3. ÄGARSKAP. En tabells ägare är undantagen sin egen RLS om inte
 *     FORCE ROW LEVEL SECURITY är satt - och det är det inte här.
 *
 * withUser() byter visserligen till `authenticated` i varje transaktion,
 * men withAnon() gör det inte: den kör som anslutningens EGEN roll (för att
 * de funktionerna är SECURITY DEFINER och prövar behörighet själva). Är den
 * rollen ägaren, så skriver kontaktformuläret förbi kolumnrättigheterna.
 * Kontrollen gäller alltså på riktigt, inte bara i teorin.
 */
export const provaDatabasroll = async (tx?: Tx): Promise<RollBesked> => {
  const fraga = async (t: Tx): Promise<RollBesked> => {
    const { rows } = await t.query(
      `select current_user as roll,
              r.rolsuper,
              r.rolbypassrls,
              (select count(*)::int
                 from pg_class c
                 join pg_namespace n on n.oid = c.relnamespace
                where n.nspname in ('public', 'auth', 'app')
                  and c.relkind in ('r', 'p')
                  and c.relowner = r.oid) as agda_tabeller
         from pg_roles r
        where r.rolname = current_user`,
    );
    const rad = rows[0];
    if (!rad) return { roll: "okänd", saker: false, skal: ["rollen gick inte att slå upp"] };
    const skal: string[] = [];
    if (rad.rolsuper === true) skal.push("rollen är superanvändare");
    if (rad.rolbypassrls === true) skal.push("rollen har BYPASSRLS");
    if (Number(rad.agda_tabeller) > 0) {
      skal.push(`rollen äger ${rad.agda_tabeller} tabeller och är undantagen deras radskydd`);
    }
    return { roll: String(rad.roll), saker: skal.length === 0, skal };
  };
  if (tx) return fraga(tx);
  // EGEN ANSLUTNING, INTE withAnon(): withAnon väntar numera på grinden,
  // och grinden anropar den här funktionen. Via withAnon blir det en
  // oändlig rekursion vid varje kallstart.
  const client = await getPool().connect();
  try {
    return await fraga(client);
  } finally {
    client.release();
  }
};

/**
 * Samma prövning, men den STOPPAR uppstarten.
 *
 * Undantaget finns för sviterna, som ansluter som superanvändaren med flit
 * (fixturerna ska inte bero på de policyer som är under test). Det måste
 * sättas UTTRYCKLIGEN - en tyst standard hade gjort hela kontrollen till en
 * artighet. tests/sakerhet.ts vaktar att chartet aldrig sätter flaggan.
 */
export const kravSakerDatabasroll = async (): Promise<RollBesked> => {
  const besked = await provaDatabasroll();
  if (besked.saker) return besked;

  const tillaten = process.env.ALLOW_UNSAFE_DB_ROLE === "1";
  const rader = [
    "",
    "  DATABASROLLEN STÄNGER AV RADSKYDDET",
    "",
    `  Rollen "${besked.roll}" duger inte som API-roll:`,
    ...besked.skal.map((s) => `    - ${s}`),
    "",
    "  Radskyddet är produktens säkerhetsmodell. Med den här rollen",
    "  fortsätter alla frågor att fungera - de börjar bara returnera",
    "  andra bolags data. Peka DATABASE_URL på en egen login-roll som är",
    "  medlem i authenticated och varken äger tabeller eller har BYPASSRLS.",
    "",
  ];
  if (!tillaten) {
    console.error(rader.join("\n"));
    throw new Error("osäker databasroll: API:t vägrar starta");
  }
  console.warn(rader.join("\n"));
  console.warn("  ALLOW_UNSAFE_DB_ROLE=1 är satt - fortsätter ändå (endast för test).\n");
  return besked;
};

export type Tx = Pick<PoolClient, "query">;

/**
 * SAMMA VÄGRAN SOM FÖRR, FLYTTAD DIT DEN FORTFARANDE BITER.
 *
 * På en egen server prövades rollen EN gång, i main.ts, innan porten
 * öppnades. I serverless finns ingen sådan plats: varje instans
 * kallstartar för sig, och en modul som körs vid import kan inte vägra
 * något - Vercel har redan tagit emot requesten.
 *
 * Alltså prövas rollen i stället FÖRE den första databasfrågan i varje
 * instans, och resultatet delas av alla efterföljande requests i samma
 * instans. Kostnaden är en extra fråga per kallstart. Priset för att
 * hoppa över den är att en felpekad DATABASE_URL börjar returnera andra
 * bolags insolvensdata utan att något går sönder.
 *
 * Ett MISSLYCKANDE cachas INTE. Rättar drift sin DATABASE_URL ska nästa
 * request fungera, utan omdeploy - därför nollställs löftet i catch.
 */
let rollGrind: Promise<RollBesked> | null = null;

export const sakerRollGrind = (): Promise<RollBesked> => {
  if (!rollGrind) {
    rollGrind = kravSakerDatabasroll().catch((fel: unknown) => {
      rollGrind = null;
      throw fel;
    });
  }
  return rollGrind;
};

/** Endast för sviterna: tvinga fram en ny prövning. */
export const nollstallRollGrind = (): void => {
  rollGrind = null;
};

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
  await sakerRollGrind();
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
  await sakerRollGrind();
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
