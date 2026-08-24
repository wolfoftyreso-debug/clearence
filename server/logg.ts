/**
 * LOGGEN: tillräckligt för att felsöka, aldrig nog för att stjäla.
 *
 * En logg är en kopia av produktionen som hamnar på andra ställen än
 * produktionen - i en fil, i en insamlare, i någons terminal, i en
 * supportbilaga. Allt som är hemligt i databasen är lika hemligt i loggen,
 * men bevakas sällan lika hårt.
 *
 * Den här filen hade ingen motsvarighet förut: `console.error("api error",
 * error)` skrev hela felobjektet rakt ut. Ett `pg`-fel bär `query`,
 * `parameters` och `detail` - alltså den SQL som kördes och de VÄRDEN som
 * skickades in. Ett fel i inloggningen kunde därmed skriva ett
 * lösenordsförsök till loggen, och ett fel i sessionsuppslaget en
 * token-hash.
 *
 * Två regler:
 *
 *  1. STRUKTUREN BEHÅLLS, VÄRDENA MASKERAS. En logg utan felkod är
 *     värdelös; en logg med parametervärden är farlig. Vi behåller det
 *     första och kastar det andra.
 *  2. MASKERINGEN GÄLLER ÄVEN TEXT. Ett fel som råkar bära en token i sin
 *     `message` ska maskeras där också, inte bara i ett fält vi råkade
 *     tänka på.
 */

/** Fältnamn vars VÄRDE aldrig får skrivas, oavsett var de dyker upp. */
const HEMLIGA_FALT = [
  "password",
  "losenord",
  "lösenord",
  "secret",
  "token",
  "token_hash",
  "key_hash",
  "password_hash",
  "authorization",
  "apikey",
  "api_key",
  "secretaccesskey",
  "credentials",
  "parameters", // pg: de faktiska värdena i frågan
  "values",
];

/** Mönster som är hemliga i sig, var de än står i en textsträng. */
const HEMLIGA_MONSTER: RegExp[] = [
  /\bclr_[A-Za-z0-9]{8,}/g, // våra egna API-nycklar
  /\bsk-ant-api[0-9]{2}-[A-Za-z0-9_-]{8,}/g, // Anthropic
  /\bAKIA[0-9A-Z]{16}\b/g, // AWS-nyckel-id
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g, // JWT
  /\b[0-9a-f]{64}\b/g, // sha256 - våra token- och nyckelhashar
  /postgres(?:ql)?:\/\/[^\s"']+/g, // anslutningssträngar med lösenord
  /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, // e-post: en personuppgift, inte felsökningsdata
];

const MASK = "[maskerat]";

export const maskeraText = (text: string): string =>
  HEMLIGA_MONSTER.reduce((ut, m) => ut.replace(m, MASK), text);

const arHemligtFalt = (namn: string): boolean => {
  const n = namn.toLowerCase();
  return HEMLIGA_FALT.some((h) => n === h || n.includes(h));
};

/**
 * Gör om vad som helst till något som är säkert att skriva.
 *
 * Djupet är begränsat: ett cykliskt eller absurt djupt objekt ska inte
 * kunna hänga loggningen - en logg som kraschar tar servern med sig.
 */
export const maskera = (varde: unknown, djup = 0): unknown => {
  if (djup > 6) return "[för djupt]";
  if (varde === null || varde === undefined) return varde;
  if (typeof varde === "string") return maskeraText(varde);
  if (typeof varde === "number" || typeof varde === "boolean") return varde;
  if (varde instanceof Error) {
    const e = varde as Error & { code?: unknown };
    return {
      namn: e.name,
      // Meddelandet kan bära ett värde ur en constraint - maskeras.
      meddelande: maskeraText(e.message ?? ""),
      kod: typeof e.code === "string" ? e.code : undefined,
    };
  }
  if (Array.isArray(varde)) return varde.slice(0, 20).map((v) => maskera(v, djup + 1));
  if (typeof varde === "object") {
    const ut: Record<string, unknown> = {};
    for (const [namn, v] of Object.entries(varde as Record<string, unknown>)) {
      ut[namn] = arHemligtFalt(namn) ? MASK : maskera(v, djup + 1);
    }
    return ut;
  }
  return "[okänd typ]";
};

/**
 * Det enda sättet servern skriver ett fel.
 *
 * `pg`-fel plockas isär med flit: koden och villkoret är det som faktiskt
 * hjälper klockan tre på natten, medan `query` och `parameters` är det som
 * inte får lämna processen.
 */
export const loggaFel = (
  handelse: string,
  fel: unknown,
  extra: Record<string, unknown> = {},
  skriv: (...args: unknown[]) => void = console.error,
): void => {
  const e = fel as { code?: unknown; constraint?: unknown; table?: unknown; routine?: unknown };
  skriv(
    JSON.stringify({
      handelse,
      fel: maskera(fel),
      // Databasens egna hållpunkter - inga värden, bara vad som brast.
      kod: typeof e?.code === "string" ? e.code : undefined,
      villkor: typeof e?.constraint === "string" ? e.constraint : undefined,
      tabell: typeof e?.table === "string" ? e.table : undefined,
      ...(maskera(extra) as Record<string, unknown>),
    }),
  );
};
