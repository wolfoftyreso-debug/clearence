/**
 * GOOGLE SOM KÄLLA.
 *
 * Två saker prövas, och den första är den som kan göra verklig skada:
 *
 *  1. ATT MATCHNINGEN VÄGRAR NÄR DEN INTE VET. Google har inget
 *     organisationsnummer. En sökning på ett vanligt bolagsnamn träffar
 *     flera verksamheter, och att då välja en av dem betyder att ett
 *     annat bolags omdömen och öppettider hamnar i en analys som ligger
 *     till grund för beslut om det här bolaget. Ingen uppgift är bättre
 *     än fel uppgift, och det är den regeln testerna vaktar.
 *
 *  2. ATT UTVINNINGEN INTE TAR MER ÄN DEN BEHÖVER. Google returnerar
 *     recensenternas namn, profilbilder och länkar. Det är personuppgifter
 *     om tredje man som analysen inte har någon användning för.
 *
 * Sist prövas hämtaren utan nät: fältmask, rubriker och de tre utfall som
 * inte får blandas ihop - hittade inget, ingen nyckel, det gick fel.
 */

import {
  ATTRIBUTION,
  CACHE_MAX_DAYS,
  extractGoogleFacts,
  googleNote,
  matchPlace,
  normalizeName,
  placeQuery,
  reviewSignal,
  statusNote,
  type PlaceCandidate,
} from "../src/lib/sources/google";
import { lookupCompany } from "../server/google";
import { sourceById } from "../src/lib/sources/registry";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra = "") => {
  if (ok) passed++;
  else {
    failed++;
    console.log(`FAIL ${name} ${extra}`);
  }
};

/* --- 1. Namnet, avskalat till det jämförbara --------------------------- */

check("bolagsformen påverkar inte jämförelsen",
  normalizeName("Nordbygg AB") === normalizeName("Nordbygg Aktiebolag"),
  `${normalizeName("Nordbygg AB")} / ${normalizeName("Nordbygg Aktiebolag")}`);
check("och inte heller versaler eller punkter",
  normalizeName("NORD.BYGG AB") === normalizeName("nord bygg ab"),
  normalizeName("NORD.BYGG AB"));
// Två OLIKA bolag får aldrig normaliseras till samma sträng.
check("olika namn förblir olika", normalizeName("Nordbygg AB") !== normalizeName("Sydbygg AB"));

/* --- 2. Matchningen vägrar hellre än gissar ---------------------------- */

const nord: PlaceCandidate = { id: "a", displayName: { text: "Nordbygg AB" } };
const syd: PlaceCandidate = { id: "b", displayName: { text: "Sydbygg AB" } };
const nordKopia: PlaceCandidate = { id: "c", displayName: { text: "Nordbygg Aktiebolag" } };

const enTraff = matchPlace([nord, syd], "Nordbygg AB");
check("en entydig träff används", enTraff.ok && enTraff.place.id === "a");

// Det här är testets kärna. Två verksamheter med samma namn - i Sverige
// helt vanligt - får INTE leda till att en av dem väljs.
const tva = matchPlace([nord, nordKopia], "Nordbygg AB");
check("två med samma namn ger ingen träff", !tva.ok);
check("och skälet säger varför, inte bara att det misslyckades",
  !tva.ok && /Flera verksamheter/.test(tva.reason), !tva.ok ? tva.reason : "");

const ingen = matchPlace([syd], "Nordbygg AB");
check("ingen liknande-nog-logik", !ingen.ok);
// Att inte finnas på Google är vanligt och odramatiskt - särskilt för
// bolag utan besöksadress, vilket ofta är just dessa bolag.
check("och det formuleras utan dramatik",
  !ingen.ok && /Hittade ingen verksamhet/.test(ingen.reason), !ingen.ok ? ingen.reason : "");

check("tom kandidatlista ger ingen träff", !matchPlace([], "Nordbygg AB").ok);
check("tomt bolagsnamn ger ingen träff", !matchPlace([nord], "   ").ok);

/* --- 3. Sökfrågan ------------------------------------------------------ */

// Organisationsnumret hör inte hemma i frågan: Google indexerar det inte,
// och det gör bara att träffen på namnet försvinner.
check("orten tas med när den finns", placeQuery("Nordbygg AB", "Tyresö") === "Nordbygg AB Tyresö");
check("och utelämnas när den saknas", placeQuery("Nordbygg AB") === "Nordbygg AB");
check("tom ort ger inget hängande mellanslag", placeQuery("Nordbygg AB", "  ") === "Nordbygg AB");

/* --- 4. Utvinningen tar inte mer än den behöver ------------------------ */

const svar: PlaceCandidate = {
  id: "ChIJ-exempel",
  displayName: { text: "Nordbygg AB" },
  formattedAddress: "Antennvägen 2, 135 48 Tyresö",
  nationalPhoneNumber: "08-123 45 67",
  websiteUri: "https://nordbygg.se",
  businessStatus: "CLOSED_PERMANENTLY",
  rating: 4.2,
  userRatingCount: 37,
  reviews: [
    { text: { text: "Kom i tid och gjorde ett bra jobb." } },
    { text: { text: "   " } },
  ],
};

const f = extractGoogleFacts(svar);
check("webbadressen läses - det var den som saknades", f.website === "https://nordbygg.se", String(f.website));
check("telefonen läses", f.phone === "08-123 45 67", String(f.phone));
check("besöksadressen läses", f.address?.includes("Tyresö") === true, String(f.address));
check("platsens id sparas", f.placeId === "ChIJ-exempel", String(f.placeId));
check("verksamhetsstatus tolkas", f.status === "permanent-stangt", f.status);
check("betyget läses", f.reviews.rating === 4.2 && f.reviews.count === 37, JSON.stringify(f.reviews));
check("tomma recensioner tas inte med", f.reviews.excerpts.length === 1, JSON.stringify(f.reviews.excerpts));
check("varje uppgift har en angiven grund", f.basis.length >= 6, JSON.stringify(f.basis));

// PERSONUPPGIFTER OM TREDJE MAN. Google skickar med namn, profilbild och
// länk för varje recensent. Ingenting av det får finnas kvar.
const medForfattare: PlaceCandidate = {
  displayName: { text: "Nordbygg AB" },
  userRatingCount: 1,
  rating: 5,
  reviews: [{ text: { text: "Bra!" } }],
};
const medF = extractGoogleFacts(medForfattare);
check("recensenten finns inte i utfallet",
  !JSON.stringify(medF).includes("authorAttribution") && !JSON.stringify(medF).includes("photoUri"),
  JSON.stringify(medF.reviews));

const tomt = extractGoogleFacts({ displayName: { text: "Nordbygg AB" } });
check("en tom träff hittar inte på uppgifter",
  tomt.website === null && tomt.phone === null && tomt.address === null &&
  tomt.reviews.rating === null && tomt.reviews.count === 0);
check("och statusen blir okänd, inte öppen", tomt.status === "okant", tomt.status);
// Betyg utan omdömen är inget betyg.
check("betyg utan omdömen räknas inte",
  extractGoogleFacts({ rating: 5, userRatingCount: 0 }).reviews.rating === null);

/* --- 5. Vad siffrorna får sägas betyda --------------------------------- */

check("ett tunt betyg säger att det är tunt",
  /för få för att säga något/.test(reviewSignal({ rating: 4.5, count: 3, excerpts: [] })),
  reviewSignal({ rating: 4.5, count: 3, excerpts: [] }));
check("ett tjockare betyg redovisas rakt",
  /4\.2 i betyg på 37 omdömen/.test(reviewSignal({ rating: 4.2, count: 37, excerpts: [] })),
  reviewSignal({ rating: 4.2, count: 37, excerpts: [] }));
check("inga omdömen sägs rakt ut",
  /Inga omdömen/.test(reviewSignal({ rating: null, count: 0, excerpts: [] })));

/*
 * "Permanent stängt" är den starkaste yttre signalen i hela uppslaget, och
 * den formuleras som något att ÅTGÄRDA. Uppgiften kan vara felaktig och
 * inlagd av någon annan - men den syns för varje kund och leverantör som
 * söker på bolaget, och det är en sak bolaget behöver veta.
 */
check("permanent stängt formuleras som något att rätta",
  /rättas/.test(statusNote("permanent-stangt")), statusNote("permanent-stangt"));
check("och säger vem som ser det",
  /kunder och leverantörer/.test(statusNote("permanent-stangt")));
check("okänd status påstår ingenting", /säger inget/.test(statusNote("okant")));

/* --- 6. Panelraden räknar bara det som kom med ------------------------- */

check("notisen anger källan", googleNote(f).startsWith(ATTRIBUTION), googleNote(f));
check("och räknar det som faktiskt fanns", /37 omdömen/.test(googleNote(f)), googleNote(f));
check("en tom träff säger det", /ingen användbar uppgift/.test(googleNote(tomt)), googleNote(tomt));

/* --- 7. Villkoren står i koden, inte i någons minne -------------------- */

// Places tillåter cachning i högst 30 dagar. Ligger talet fel är det ett
// avtalsbrott som ingen upptäcker förrän någon granskar.
check("cachningstaket är 30 dagar", CACHE_MAX_DAYS === 30, String(CACHE_MAX_DAYS));
check("attributionen finns och nämner Google", /Google/.test(ATTRIBUTION), ATTRIBUTION);

/* --- 8. Registret och koden säger samma sak ---------------------------- */

const spec = sourceById("recensioner");
check("recensioner är körningsberoende i registret", spec?.runtime === true);
// Grunden är för den som ska koppla in källan: där hör nyckeln och
// flaggan hemma.
check("grunden pekar ut nyckeln och flaggan",
  /GOOGLE_MAPS_API_KEY/.test(spec?.basis ?? "") && /enable_google_source/.test(spec?.basis ?? ""),
  spec?.basis?.slice(0, 90));
/*
 * Och panelraden är för någon annan: en företagare mitt i en kris. Ett
 * variabelnamn ur en containerkonfiguration säger hen ingenting, och en
 * uppmaning att "lämna webbadressen" är dessutom fel numera - den kommer
 * ur uppslaget.
 */
check("panelens text är fri från teknikinternt",
  !/GOOGLE_MAPS_API_KEY|enable_google_source|API-nyckel/i.test(spec?.needs ?? ""), spec?.needs);
check("och säger att användaren inte behöver göra något",
  /du behöver inte lämna/i.test(spec?.needs ?? ""), spec?.needs);

/*
 * Den viktigaste raden i hela sviten. Frågan "kan vi inte hämta det här
 * från Google?" kommer att ställas igen, och svaret för
 * företagsregisterraden är nej: Google känner till platser, inte
 * juridiska personer. Står det inte utskrivet i registret kommer någon
 * att bygga det ändå.
 */
const reg = sourceById("foretagsregister");
check("registret skriver ut att Google inte löser företagsuppgifterna",
  /GOOGLE LÖSER INTE/.test(reg?.basis ?? ""), reg?.basis.slice(0, 80));
check("och att organisationsnumret inte finns hos Google",
  /organisationsnummer/.test(reg?.basis ?? ""));

/* --- 9. Hämtaren, utan nät --------------------------------------------- */

const utanNyckel = process.env.GOOGLE_MAPS_API_KEY;
delete process.env.GOOGLE_MAPS_API_KEY;
const ejKonfigurerad = await lookupCompany("Nordbygg AB");
check("utan nyckel svarar hämtaren ingen-kalla, inte ingen-traff",
  ejKonfigurerad.status === "ingen-kalla", JSON.stringify(ejKonfigurerad));

process.env.GOOGLE_MAPS_API_KEY = "test-nyckel";

let sedd: { url: string; init: RequestInit } | null = null;
const attrapp = (async (url: string | URL | Request, init?: RequestInit) => {
  sedd = { url: String(url), init: init ?? {} };
  return {
    ok: true,
    status: 200,
    json: async () => ({ places: [svar] }),
  } as Response;
}) as typeof fetch;

const traffad = await lookupCompany("Nordbygg AB", "Tyresö", attrapp);
check("en entydig träff ger uppgifterna",
  traffad.status === "traff" && traffad.facts.website === "https://nordbygg.se",
  JSON.stringify(traffad));

const rubriker = (sedd!.init.headers ?? {}) as Record<string, string>;
check("nyckeln går i rubrik, aldrig i adressen",
  rubriker["x-goog-api-key"] === "test-nyckel" && !sedd!.url.includes("test-nyckel"),
  sedd!.url);
// Fältmasken är inte kosmetik: Places debiterar efter vilka fältgrupper
// man rör, och utan mask betalar vi för allt.
check("fältmasken begränsar vad vi ber om",
  /places\.websiteUri/.test(rubriker["x-goog-fieldmask"] ?? ""), rubriker["x-goog-fieldmask"]);
check("och ber inte om recensenternas namn",
  !/authorAttribution/.test(rubriker["x-goog-fieldmask"] ?? ""));
const skickat = JSON.parse(String(sedd!.init.body)) as Record<string, string>;
check("frågan ställs på svenska om Sverige",
  skickat.languageCode === "sv" && skickat.regionCode === "SE", JSON.stringify(skickat));

// De tre utfallen får inte blandas ihop: ett driftfel som ser ut som
// "hittade inget" blir ett påstående om bolaget.
const trasig = (async () => { throw new Error("nätet"); }) as typeof fetch;
check("ett nätfel är ett fel, inte en utebliven träff",
  (await lookupCompany("Nordbygg AB", undefined, trasig)).status === "fel");

const femhundra = (async () => ({ ok: false, status: 500, json: async () => ({}) }) as Response) as typeof fetch;
const femhundraSvar = await lookupCompany("Nordbygg AB", undefined, femhundra);
check("en felkod från Google är ett fel", femhundraSvar.status === "fel");
// Googles feltexter kan innehålla nyckeln. De skickas aldrig vidare.
check("och Googles egen feltext förs inte vidare",
  femhundraSvar.status === "fel" && !femhundraSvar.reason.includes("test-nyckel"),
  femhundraSvar.status === "fel" ? femhundraSvar.reason : "");

const tomtSvar = (async () => ({ ok: true, status: 200, json: async () => ({}) }) as Response) as typeof fetch;
check("ett svar utan träffar är ingen-traff",
  (await lookupCompany("Nordbygg AB", undefined, tomtSvar)).status === "ingen-traff");

if (utanNyckel === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
else process.env.GOOGLE_MAPS_API_KEY = utanNyckel;

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
