/**
 * GOOGLE SOM KÄLLA: vad vi faktiskt kan hämta, och vad vi inte kan.
 *
 * Frågan var "det här ska vi kunna hämta från Google". Svaret är delvis
 * ja, och den här filen är där gränsen dras - för gränsen är inte
 * uppenbar, och att ta fel på den är dyrare än att inte hämta något alls.
 *
 * VAD GOOGLE GER (Places API, Place Details):
 *
 *  - Bolagets webbadress. Det är den uppgift som saknades för att
 *    webbplatsläsaren skulle kunna köra. Vi behövde be användaren om
 *    den; nu behöver vi inte.
 *  - Telefon, besöksadress, öppettider.
 *  - Betyg, antal omdömen och de senaste recensionerna.
 *  - VERKSAMHETSSTATUS. Google vet om ett ställe är permanent eller
 *    tillfälligt stängt. För den här produkten är det inte en detalj -
 *    det är en av de starkaste yttre signalerna som finns om ett bolag i
 *    kris, och den kommer från en källa som inte är användarens egen bild.
 *
 * VAD GOOGLE INTE GER, och det är den viktigaste raden i filen:
 *
 *  - ORGANISATIONSNUMMER, STYRELSE, F-SKATT OCH MOMSREGISTRERING finns
 *    inte hos Google. Det är Bolagsverket och Skatteverket. Google Places
 *    känner till PLATSER och verksamheter, inte juridiska personer. Raden
 *    "Offentlig företagsinformation" i bakgrundspanelen går alltså INTE
 *    att lösa den här vägen, hur gärna man än vill.
 *  - Sociala medier. Att skrapa Googles sökresultat för att komma åt
 *    LinkedIn-sidor bryter mot Googles egna villkor, och löser dessutom
 *    inte plattformarnas.
 *  - SCB:s branschtal.
 *
 * MATCHNINGEN ÄR DEN FARLIGA DELEN.
 *
 * Google har inget organisationsnummer att matcha på. En sökning på
 * "Nordbygg AB" kan lika gärna träffa ett annat bolag med nästan samma
 * namn i en annan stad. Att då visa NÅGON ANNANS två stjärnor i en analys
 * av det här bolagets läge vore ett fel som ser ut som en uppgift.
 *
 * Därför matchar den här koden inte ungefär. Den normaliserar namnet,
 * kräver en exakt träff efter normalisering, och vägrar när det finns
 * fler än en sådan. Ett uteblivet svar är ett hederligt utfall; ett
 * gissat svar är det inte.
 */

/** Vad ett fält vilar på. Följer med varje uppgift ut i analysen. */
export interface GoogleBasis {
  field: string;
  source: string;
}

export interface GoogleReviewSummary {
  /** Snittbetyg 1-5, eller null när inga omdömen finns. */
  rating: number | null;
  /** Antal omdömen betyget vilar på. */
  count: number;
  /**
   * De senaste omdömenas text, förkortade.
   *
   * UTAN FÖRFATTARE. Google returnerar namn, profilbild och länk för
   * varje recensent. Det är personuppgifter om tredje man som analysen
   * inte behöver för någonting - vi läser omdömet om bolaget, inte om
   * människan som skrev det.
   */
  excerpts: string[];
}

export type GoogleStatus = "oppet" | "tillfalligt-stangt" | "permanent-stangt" | "okant";

export interface GoogleFacts {
  /** Googles eget id för platsen. Får sparas utan tidsgräns; se CACHE_MAX_DAYS. */
  placeId: string | null;
  name: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  status: GoogleStatus;
  reviews: GoogleReviewSummary;
  basis: GoogleBasis[];
}

/**
 * Hur länge Googles innehåll får ligga kvar.
 *
 * Places-villkoren tillåter cachning i högst 30 dagar för innehållet;
 * platsens id får däremot sparas utan tidsgräns, just för att kunna slå
 * upp på nytt. Den skillnaden är inte en petitess: den är skillnaden
 * mellan att förnya en uppgift och att bygga ett eget register av
 * någon annans data, vilket villkoren förbjuder.
 */
export const CACHE_MAX_DAYS = 30;

/**
 * Texten som måste visas där Googles uppgifter visas.
 *
 * Villkoren kräver attribution. Den står här och inte i en komponent, så
 * att den följer med uppgiften och inte glöms av nästa vy som visar den.
 */
export const ATTRIBUTION = "Uppgifter från Google";

/**
 * Namnet, avskalat till det som går att jämföra.
 *
 * Bolagsformen åker bort: Google skriver "Nordbygg", Bolagsverket
 * "Nordbygg Aktiebolag", och användaren skriver "Nordbygg AB". Alla tre
 * är samma bolag, och en jämförelse som inte klarar det matchar aldrig.
 */
export const normalizeName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[.,()]/g, " ")
    .replace(/\b(aktiebolag|ab|publ|handelsbolag|hb|kommanditbolag|kb)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Sökfrågan.
 *
 * Organisationsnumret tas INTE med. Google indexerar det inte, och ett
 * nummer i frågan gör bara att textsökningen tappar den träff den hade
 * hittat på namnet. Orten tas med när vi har den - den är det enda vi kan
 * ge för att skilja två likadana namn åt.
 */
export const placeQuery = (companyName: string, ort?: string): string =>
  [companyName.trim(), ort?.trim()].filter((d) => d && d.length > 0).join(" ");

export interface PlaceCandidate {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  businessStatus?: string;
  rating?: number;
  userRatingCount?: number;
  reviews?: { text?: { text?: string }; originalText?: { text?: string } }[];
}

export type MatchResult =
  | { ok: true; place: PlaceCandidate }
  | { ok: false; reason: string };

/**
 * Väljer träffen - eller vägrar.
 *
 * Tre utfall, och de två sista är lika viktiga som det första:
 *
 *  1. Exakt en kandidat vars normaliserade namn är bolagets → träff.
 *  2. Flera sådana → VÄGRAN. Två bolag med samma namn på olika orter är
 *     vanligt i Sverige, och att välja den med flest recensioner vore att
 *     välja den som syns mest, inte den som är rätt.
 *  3. Ingen → VÄGRAN. Ingen liknande-nog-logik. Ett bolag som inte finns
 *     på Google är ett vanligt, odramatiskt utfall - särskilt för bolag
 *     utan besöksadress, vilket är precis den sortens bolag som ofta
 *     hamnar här.
 */
export const matchPlace = (
  candidates: PlaceCandidate[],
  companyName: string,
): MatchResult => {
  const want = normalizeName(companyName);
  if (want.length === 0) return { ok: false, reason: "Inget bolagsnamn att söka på." };

  const exakta = candidates.filter(
    (c) => normalizeName(c.displayName?.text ?? "") === want,
  );
  if (exakta.length === 1) return { ok: true, place: exakta[0] };
  if (exakta.length > 1) {
    return {
      ok: false,
      reason:
        `Flera verksamheter heter ${companyName}. Jag väljer ingen av dem – ` +
        "fel bolags omdömen i din analys vore värre än inga omdömen alls.",
    };
  }
  return {
    ok: false,
    reason: `Hittade ingen verksamhet som heter exakt ${companyName} hos Google.`,
  };
};

const STATUS: Record<string, GoogleStatus> = {
  OPERATIONAL: "oppet",
  CLOSED_TEMPORARILY: "tillfalligt-stangt",
  CLOSED_PERMANENTLY: "permanent-stangt",
};

/** Recensionstext, förkortad och utan författare. */
const excerpt = (r: { text?: { text?: string }; originalText?: { text?: string } }): string => {
  const raw = (r.text?.text ?? r.originalText?.text ?? "").replace(/\s+/g, " ").trim();
  return raw.length > 180 ? `${raw.slice(0, 177)}…` : raw;
};

/**
 * Uppgifterna ur en träff.
 *
 * Bara fält som stod i svaret. Ett fält som saknas blir null och inte en
 * tom sträng - skillnaden mellan "Google hade ingen webbadress" och
 * "webbadressen är tom" avgör om vi ska fråga användaren.
 */
export const extractGoogleFacts = (place: PlaceCandidate): GoogleFacts => {
  const basis: GoogleBasis[] = [];
  const note = (field: string) => basis.push({ field, source: "Google Places" });

  const name = place.displayName?.text?.trim() || null;
  if (name) note("namn");

  const website = place.websiteUri?.trim() || null;
  if (website) note("webbadress");

  const phone = (place.nationalPhoneNumber ?? place.internationalPhoneNumber)?.trim() || null;
  if (phone) note("telefon");

  const address = place.formattedAddress?.trim() || null;
  if (address) note("besöksadress");

  const status = STATUS[place.businessStatus ?? ""] ?? "okant";
  if (status !== "okant") note("verksamhetsstatus");

  const count = typeof place.userRatingCount === "number" ? place.userRatingCount : 0;
  const rating = typeof place.rating === "number" && count > 0 ? place.rating : null;
  if (rating !== null) note("betyg");

  const excerpts = (place.reviews ?? []).map(excerpt).filter((t) => t.length > 0);

  return {
    placeId: place.id?.trim() || null,
    name,
    website,
    phone,
    address,
    status,
    reviews: { rating, count, excerpts },
    basis,
  };
};

/**
 * Vad betyget får sägas betyda.
 *
 * Ett snittbetyg på fyra omdömen är inte ett omdöme om bolaget, det är
 * fyra personers dag. Den här funktionen finns för att analysen inte ska
 * behandla de två fallen lika - och för att en tunn siffra ska säga att
 * den är tunn i stället för att bara vara liten.
 */
export const reviewSignal = (r: GoogleReviewSummary): string => {
  if (r.count === 0) return "Inga omdömen hos Google.";
  if (r.count < 5) {
    return `${r.rating?.toFixed(1)} i betyg på bara ${r.count} omdömen – för få för att säga något om kundrelationerna.`;
  }
  return `${r.rating?.toFixed(1)} i betyg på ${r.count} omdömen.`;
};

/**
 * Verksamhetsstatusen i klartext.
 *
 * "Permanent stängt" hos Google medan bolaget lever är inte ett fel i
 * datan - det är ofta en uppgift NÅGON ANNAN lagt in, och det syns utåt
 * för alla kunder och leverantörer som söker på bolaget. Därför
 * formuleras det som något att åtgärda, inte som ett konstaterande om
 * bolaget.
 */
export const statusNote = (status: GoogleStatus): string => {
  switch (status) {
    case "permanent-stangt":
      return (
        "Google visar bolaget som PERMANENT STÄNGT. Stämmer det inte behöver det " +
        "rättas – alla som söker på er ser det, inklusive kunder och leverantörer."
      );
    case "tillfalligt-stangt":
      return "Google visar bolaget som tillfälligt stängt.";
    case "oppet":
      return "Google visar verksamheten som öppen.";
    default:
      return "Google säger inget om verksamhetsstatus.";
  }
};

/** Raden i bakgrundspanelen. Räknar bara det som faktiskt kom med. */
export const googleNote = (f: GoogleFacts): string => {
  const delar: string[] = [];
  if (f.website) delar.push("webbadress");
  if (f.phone) delar.push("telefon");
  if (f.address) delar.push("besöksadress");
  if (f.reviews.count > 0) delar.push(`${f.reviews.count} omdömen`);
  if (delar.length === 0) return "Google hade ingen användbar uppgift om bolaget.";
  return `${ATTRIBUTION}: ${delar.join(", ")}.`;
};
