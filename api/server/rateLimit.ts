/**
 * HASTIGHETSBEGRÄNSNING.
 *
 * Utan den kan vem som helst pröva lösenord mot /v1/auth/login så fort
 * nätet orkar. Ett bolag i rekonstruktion har sin samlade ekonomiska
 * dokumentation här, och ett konto som forceras är hela ärendet.
 *
 * RÄKNINGEN BOR I DATABASEN, INTE I MINNET.
 *
 * Den bodde i minnet, per container, och den här filen skrev ut vad det
 * innebar: "Kör tjänsten på tre uppgifter blir den effektiva gränsen tre
 * gånger den angivna." Det gjorde taket till en funktion av hur många
 * containrar driften råkade köra - tio försök blev trettio vid tre
 * uppgifter, sextio vid sex, utan att någon ändrat en siffra.
 *
 * Nu räknas anropet av app.rate_limit_hit() (migration 20260811100000):
 * en enda INSERT ... ON CONFLICT DO UPDATE, serialiserad på radlåset, delad
 * mellan alla uppgifter. Taket är taket.
 *
 * DET KOSTAR EN DATABASFRÅGA PER ANROP. Det är avsiktligt. Frågan är ett
 * indexuppslag och en uppdatering på en rad; API:et kan ändå inte svara på
 * något utan databasen, så beroendet är inte nytt - bara tidigarelagt.
 *
 * VID FEL STÄNGER VI. Går räkningen inte att göra vet vi inte om anropet
 * ryms, och att då släppa igenom det gör en databasstörning till ett öppet
 * fönster för forcering. Anroparen får 503; se createApiServer.
 *
 * SVARET ÄR 429 MED Retry-After. En klient som får veta när den får
 * försöka igen kan vänta; en som bara blir avvisad försöker direkt igen
 * och gör saken värre.
 */

import { withAnon, type Tx } from "./db";

export interface Gransvarde {
  /** Antal tillåtna anrop per fönster. */
  tak: number;
  /** Fönstrets längd i sekunder. */
  fonsterSek: number;
}

/**
 * Inloggningen är hårdast satt: den är den enda ytan där ett gissat
 * värde ger åtkomst. Tio försök på fem minuter räcker gott för en
 * människa som stavar fel, och stoppar en maskin som gissar.
 */
export const LOGIN: Gransvarde = { tak: 10, fonsterSek: 300 };

/** Övriga anrop. Satt så att normal användning aldrig märker det. */
export const ALLMAN: Gransvarde = { tak: 600, fonsterSek: 60 };

/**
 * Lösenordsbekräftelsen före det som inte går att ångra.
 *
 * Inloggningens tak räknas per klientadress. Det duger inte här: den som
 * bekräftar sitter redan innanför med en giltig session, och en angripare
 * som har kapat den kan byta utgående adress mellan försöken. Räkningen
 * ligger därför på KONTOT.
 *
 * Fem försök på en kvart. En människa som stavar fel på sitt eget
 * lösenord får flera chanser; en som gissar kommer ingen vart.
 */
export const BEKRAFTELSE: Gransvarde = { tak: 5, fonsterSek: 900 };

export interface Utfall {
  tillaten: boolean;
  /** Sekunder tills klienten får försöka igen. Bara vid avslag. */
  retryAfter: number;
}

/**
 * Räknar anropet och svarar om det ryms.
 *
 * `tx` finns för sviterna, som kör flera anrop i följd och vill se
 * räkningen utan att gå genom poolen varje gång. I drift utelämnas den och
 * varje prövning får sin egen transaktion - det är hela poängen: räkningen
 * ska stå kvar även när det anrop den gällde rullas tillbaka.
 */
export const provaGrans = async (
  nyckel: string,
  grans: Gransvarde,
  tx?: Tx,
): Promise<Utfall> => {
  const fraga = async (t: Tx): Promise<Utfall> => {
    const { rows } = await t.query(
      "select tillaten, retry_after from app.rate_limit_hit($1, $2, $3)",
      [nyckel, grans.tak, grans.fonsterSek],
    );
    const rad = rows[0];
    // Ett svar utan rad är inte "tillåtet" - det är ett fel som ska
    // behandlas som ett fel.
    if (!rad) throw new Error("hastighetsgränsen svarade inte");
    return { tillaten: rad.tillaten === true, retryAfter: Number(rad.retry_after) || 0 };
  };
  return tx ? fraga(tx) : withAnon(fraga);
};

/**
 * Antal BETRODDA mellanled framför API:et. Driftparameter, inte gissning.
 *
 * 1 = en proxy (nginx-sidovagnen i deploy/frontend, eller ALB:n).
 * 0 = API:et tar emot direkt; då ignoreras x-forwarded-for HELT.
 */
const betroddaHopp = (): number => {
  const n = Number(process.env.TRUSTED_PROXY_HOPS ?? 1);
  return Number.isInteger(n) && n >= 0 ? n : 1;
};

/**
 * Vem anropet kommer ifrån.
 *
 * Bakom lastbalanseraren är socketens adress ALLTID balanserarens, så
 * utan x-forwarded-for delar hela världen en enda räknare - och första
 * klienten som slår i taket stänger ute alla andra.
 *
 * DEN FÖRSTA ADRESSEN I LISTAN ÄR INTE KLIENTENS. Den här funktionen tog
 * tidigare `[0]`, och det var en hastighetsgräns som inte gick att lita
 * på: nginx sätter `$proxy_add_x_forwarded_for`, alltså
 * "<det klienten skickade>, <den adress nginx såg>". En angripare som går
 * in genom rätt ytterdörr kan därför skriva vad som helst först och få en
 * FÄRSK räknare för varje anrop - vilket tar bort hela spärren mot
 * lösenordsforcering. Nätverksisolering hjälper inte mot det, eftersom
 * anropet kommer via den betrodda proxyn.
 *
 * Rätt adress är den som det SISTA betrodda mellanledet självt observerade:
 * räkna hopp FRÅN HÖGER. Allt till vänster om den punkten är skrivet av
 * någon vi inte litar på och får aldrig avgöra vilken räknare som används.
 */
export const klientNyckel = (
  headers: Record<string, string | string[] | undefined>,
  fallback: string,
): string => {
  const hopp = betroddaHopp();
  // Inga betrodda mellanled: rubriken är helt klientstyrd. Använd socketen.
  if (hopp === 0) return fallback;

  const xff = headers["x-forwarded-for"];
  const rad = Array.isArray(xff) ? xff.join(",") : xff;
  const delar = (rad ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter((d) => d.length > 0);
  if (delar.length === 0) return fallback;

  // Kortare lista än antalet hopp betyder att kedjan inte ser ut som vi
  // tror. Falla tillbaka på socketen i stället för att gissa - att gissa
  // fel här är att dela ut en gratis räknare.
  if (delar.length < hopp) return fallback;
  return delar[delar.length - hopp];
};

/**
 * Nollställer räkningen. Endast för tester.
 *
 * Raderar allt UTOM bokföringsraden: den styr bara hur ofta städningen
 * körs, och att nollställa den hade fått nästa prövning att städa i
 * onödan mitt i en svit.
 */
export const nollstallGranser = async (tx?: Tx): Promise<void> => {
  const rensa = async (t: Tx) => {
    await t.query("delete from app.rate_limits where nyckel <> '__stadning__'");
  };
  return tx ? rensa(tx) : withAnon(rensa);
};
