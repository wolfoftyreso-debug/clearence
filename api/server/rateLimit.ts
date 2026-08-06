/**
 * HASTIGHETSBEGRÄNSNING.
 *
 * Utan den kan vem som helst pröva lösenord mot /v1/auth/login så fort
 * nätet orkar. Ett bolag i rekonstruktion har sin samlade ekonomiska
 * dokumentation här, och ett konto som forceras är hela ärendet.
 *
 * VAD DEN HÄR ÄR, OCH VAD DEN INTE ÄR
 *
 * Räknaren bor I MINNET, per container. Kör tjänsten på tre uppgifter
 * blir den effektiva gränsen tre gånger den angivna. Det är en verklig
 * begränsning och den ska stå utskriven här i stället för att upptäckas
 * av någon som trodde att taket var absolut.
 *
 * Den duger ändå, av två skäl: den stoppar den enkla forceringen från en
 * enskild källa, som är det överlägset vanligaste, och den kostar
 * ingenting att ha. Ett verkligt tak över alla containrar kräver delad
 * lagring - databasen har redan mönstret ("fem koder per timme och
 * nummer" i notifications), och det är dit det här ska flytta när
 * inloggningen får riktig trafik.
 *
 * SVARET ÄR 429 MED Retry-After. En klient som får veta när den får
 * försöka igen kan vänta; en som bara blir avvisad försöker direkt igen
 * och gör saken värre.
 */

interface Fonster {
  antal: number;
  /** Millisekunder sedan epok när fönstret nollställs. */
  nollstalls: number;
}

const rakning = new Map<string, Fonster>();

/**
 * Städning av utgångna rader.
 *
 * Utan den växer kartan med varje ny IP tills processen dör - en
 * minnesläcka som ser ut som en långsam container. Städningen sker vid
 * anrop och inte på en timer: en timer håller processen vid liv och gör
 * en ren avstängning svårare.
 */
const stada = (nu: number): void => {
  if (rakning.size < 5000) return;
  for (const [nyckel, f] of rakning) {
    if (f.nollstalls <= nu) rakning.delete(nyckel);
  }
};

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

export interface Utfall {
  tillaten: boolean;
  /** Sekunder tills klienten får försöka igen. Bara vid avslag. */
  retryAfter: number;
}

export const provaGrans = (
  nyckel: string,
  grans: Gransvarde,
  nu: number = Date.now(),
): Utfall => {
  stada(nu);
  const f = rakning.get(nyckel);
  if (!f || f.nollstalls <= nu) {
    rakning.set(nyckel, { antal: 1, nollstalls: nu + grans.fonsterSek * 1000 });
    return { tillaten: true, retryAfter: 0 };
  }
  f.antal += 1;
  if (f.antal > grans.tak) {
    return { tillaten: false, retryAfter: Math.ceil((f.nollstalls - nu) / 1000) };
  }
  return { tillaten: true, retryAfter: 0 };
};

/**
 * Vem anropet kommer ifrån.
 *
 * Bakom lastbalanseraren är socketens adress ALLTID balanserarens, så
 * utan x-forwarded-for delar hela världen en enda räknare - och första
 * klienten som slår i taket stänger ute alla andra. Den FÖRSTA adressen
 * i listan är klientens; resten är mellanled.
 *
 * Rubriken går att förfalska av den som når API:et direkt. Just därför
 * ska ALB:n vara enda vägen in - vilket den är i infra/network.tf, där
 * uppgifterna bara tar emot från lastbalanserarens säkerhetsgrupp.
 */
export const klientNyckel = (
  headers: Record<string, string | string[] | undefined>,
  fallback: string,
): string => {
  const xff = headers["x-forwarded-for"];
  const rad = Array.isArray(xff) ? xff[0] : xff;
  const forsta = rad?.split(",")[0]?.trim();
  return forsta && forsta.length > 0 ? forsta : fallback;
};

/** Nollställer räkningen. Endast för tester. */
export const nollstallGranser = (): void => rakning.clear();
