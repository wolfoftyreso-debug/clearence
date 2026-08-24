/**
 * HÄMTNINGEN FRÅN GOOGLE.
 *
 * Tolkningen bor i src/lib/sources/google.ts och är prövad utan nät. Det
 * här är det som saknades för att den ska göra nytta: själva anropet.
 *
 * VARFÖR SERVERSIDAN OCH INTE KLIENTEN
 *
 * En Google-nyckel i en webbläsarbunt är en nyckel vem som helst kan
 * läsa ur bunten och sedan använda på vår faktura. Places debiteras per
 * anrop. Nyckeln stannar därför i containern och klienten ser aldrig
 * något annat än resultatet.
 *
 * VARFÖR MILJÖVARIABEL OCH INTE DRIFTPANELEN
 *
 * Produkten har redan en nyckelhantering: integration_secrets, som
 * arbetaren läser med sin egen databasroll. API:et kan inte gå den vägen.
 * Tabellen saknar policyer med flit, och den funktion som skulle behövas
 * för att läsa den måste i så fall vara körbar av API:ets databasroll -
 * som är medlem i `authenticated`. Allt `authenticated` kan köra kan en
 * klient köra genom PostgREST. Att öppna den dörren för att slippa en
 * miljövariabel vore fel byte.
 *
 * GOOGLE_MAPS_API_KEY sätts alltså som DATABASE_URL sätts. Saknas den är
 * källan inte ansluten, och det säger API:et rakt ut i stället för att
 * svara med ett tomt resultat som ser ut som "hittade inget".
 */

import {
  extractGoogleFacts,
  matchPlace,
  placeQuery,
  type GoogleFacts,
  type PlaceCandidate,
} from "../src/lib/sources/google";

/**
 * Fälten vi ber om, och inga andra.
 *
 * Places debiterar efter vilken fältgrupp man rör. Att be om allt är
 * dyrare och ger dessutom uppgifter vi inte tänker använda - som
 * recensenternas namn och profilbilder, vilka är personuppgifter om
 * tredje man.
 */
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.businessStatus",
  "places.rating",
  "places.userRatingCount",
  "places.reviews",
].join(",");

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

/** Anropet tar den tid det tar - men inte längre än så här. */
const TIMEOUT_MS = 6_000;

export type GoogleResult =
  | { status: "traff"; facts: GoogleFacts }
  | { status: "ingen-traff"; reason: string }
  | { status: "ingen-kalla"; reason: string }
  | { status: "fel"; reason: string };

export const googleConfigured = (): boolean =>
  (process.env.GOOGLE_MAPS_API_KEY ?? "").trim().length > 0;

/**
 * Slår upp bolaget hos Google.
 *
 * `hamta` finns som parameter för att sviterna ska kunna pröva hela
 * kedjan - fältmask, matchning, utvinning - utan att röra nätet. I drift
 * utelämnas den.
 */
export const lookupCompany = async (
  companyName: string,
  ort?: string,
  hamta: typeof fetch = fetch,
): Promise<GoogleResult> => {
  const key = (process.env.GOOGLE_MAPS_API_KEY ?? "").trim();
  if (key.length === 0) {
    return {
      status: "ingen-kalla",
      reason: "Ingen Google-nyckel är konfigurerad (GOOGLE_MAPS_API_KEY).",
    };
  }
  const fraga = placeQuery(companyName, ort);
  if (fraga.trim().length === 0) {
    return { status: "ingen-traff", reason: "Inget bolagsnamn att söka på." };
  }

  const avbryt = new AbortController();
  const klocka = setTimeout(() => avbryt.abort(), TIMEOUT_MS);
  let svar: Response;
  try {
    svar = await hamta(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": key,
        "x-goog-fieldmask": FIELD_MASK,
      },
      // languageCode och regionCode: svenska svar om svenska verksamheter.
      // Utan dem svarar Google på engelska och rankar globalt, vilket gör
      // att ett litet svenskt bolag hamnar under ett stort utländskt med
      // liknande namn.
      body: JSON.stringify({ textQuery: fraga, languageCode: "sv", regionCode: "SE" }),
      signal: avbryt.signal,
    });
  } catch (error) {
    // Nätet, tidsgränsen eller en avbruten begäran. Ett uteblivet svar är
    // inte "hittade inget" - att blanda ihop dem gör ett driftfel till en
    // uppgift om bolaget.
    return {
      status: "fel",
      reason: error instanceof Error && error.name === "AbortError"
        ? "Google svarade inte inom tidsgränsen."
        : "Google gick inte att nå.",
    };
  } finally {
    clearTimeout(klocka);
  }

  if (!svar.ok) {
    // Nyckelfel, kvotfel och adressfel ser olika ut för driften men lika
    // ut för användaren. Statuskoden loggas; texten från Google gör det
    // INTE - den kan innehålla nyckeln.
    return { status: "fel", reason: `Google svarade ${svar.status}.` };
  }

  const data = (await svar.json()) as { places?: PlaceCandidate[] };
  const traff = matchPlace(data.places ?? [], companyName);
  if (!traff.ok) return { status: "ingen-traff", reason: traff.reason };
  return { status: "traff", facts: extractGoogleFacts(traff.place) };
};
