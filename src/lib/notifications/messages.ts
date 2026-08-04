/**
 * Aviseringarnas text - och identitet.
 *
 * Två regler styr hur ett SMS från CLEARANCE är skrivet, och båda
 * kommer ur vad produkten handlar om.
 *
 * 1. DET STÅR ALDRIG VAD SOM ÄR FEL.
 *    Ett SMS landar på en låst skärm. "Ditt bolag riskerar konkurs" kan
 *    läsas av vem som helst som råkar titta ner på bordet under ett möte
 *    - en kund, en anställd, en långivare. Aviseringen säger därför ATT
 *    något behöver uppmärksamhet och VAR det finns, aldrig VAD det är.
 *    Detaljerna kräver inloggning. Det är inte försiktighet för dess
 *    egen skull: en produkt som läcker sitt eget ämne i förbifarten är
 *    inte användbar för den som har mest att förlora.
 *
 * 2. INGA SIFFROR OM PENGAR, INGA BOLAGSNAMN, INGA PERSONNAMN.
 *    Samma skäl. Ärendets referens räcker för att veta vilket ärende det
 *    gäller, för den som har flera.
 *
 * Till det kommer det praktiska: ett SMS är 160 tecken. Längre än så
 * delas det i flera, och flera kostar mer utan att säga mer.
 */

import type { EventKind } from "./events";

/** Taket för ett SMS-segment i GSM-7. Över det delas meddelandet. */
export const SMS_SEGMENT_LIMIT = 160;

export interface NotificationMessage {
  /** Klockan i appen och e-postens ärenderad. */
  title: string;
  /** Klockan i appen och e-postens brödtext. Får vara utförlig. */
  body: string;
  /** SMS:et. Kort, utan detaljer om vad saken gäller. */
  sms: string;
  /** Var i produkten svaret finns. */
  href: string;
}

export interface MessageInput {
  kind: EventKind;
  /**
   * Ärendets korta referens, t.ex. "A-241". Utelämnas när mottagaren
   * bara har ett ärende - då säger den ingenting.
   */
  caseReference?: string | null;
  /** Antal dagar kvar, för fristhändelsen. */
  daysLeft?: number | null;
}

const suffix = (ref: string | null | undefined): string => (ref ? ` (${ref})` : "");

/**
 * Nedräkningen i klartext. "0 dagar" är fel ord för i dag, och "1 dagar"
 * är fel ord för i morgon - och en avisering som skriver fel om tiden är
 * svår att lita på om resten.
 */
export const daysLeftPhrase = (days: number): string => {
  if (days <= 0) return "i dag";
  if (days === 1) return "i morgon";
  return `om ${days} dagar`;
};

export const buildMessage = (input: MessageInput): NotificationMessage => {
  const ref = suffix(input.caseReference);
  const when = typeof input.daysLeft === "number" ? daysLeftPhrase(input.daysLeft) : null;

  switch (input.kind) {
    case "frist-narmar-sig":
      return {
        title: "En tidsfrist närmar sig",
        body: when
          ? `En frist i ärendet löper ut ${when}. Öppna handlingsplanen för att se vilken och vad som återstår.`
          : "En frist i ärendet närmar sig. Öppna handlingsplanen för att se vilken.",
        sms: `CLEARANCE: en tidsfrist i ditt ärende${ref} löper ut ${when ?? "snart"}. Logga in för detaljer.`,
        href: "/dashboard#frister",
      };

    case "atgard-kravs":
      return {
        title: "Något kräver din åtgärd",
        body: "Ärendet står stilla tills du gjort något. Öppna handlingsplanen för att se vad.",
        sms: `CLEARANCE: ditt ärende${ref} väntar på en åtgärd från dig. Logga in för detaljer.`,
        href: "/dashboard",
      };

    case "dokument-granskat":
      return {
        title: "En handling har granskats",
        body: "En handling i ärendet har fått ett granskningsbeslut. Öppna handlingarna för att se vilket.",
        sms: `CLEARANCE: en handling i ditt ärende${ref} har granskats. Logga in för detaljer.`,
        href: "/dashboard/handlingar",
      };

    case "radgivare-kommenterat":
      return {
        title: "En rådgivare har kommenterat",
        body: "Det finns ett nytt meddelande i ärendet som väntar på dig.",
        sms: `CLEARANCE: nytt meddelande i ditt ärende${ref}. Logga in för att läsa.`,
        href: "/dashboard/meddelanden",
      };

    case "analys-klar":
      return {
        title: "En ny analys är klar",
        body: "Systemanalysen har räknat om läget utifrån de senaste uppgifterna.",
        sms: `CLEARANCE: en ny analys av ditt ärende${ref} är klar. Logga in för att läsa.`,
        href: "/dashboard",
      };

    case "arende-status":
      return {
        title: "Ärendet har bytt status",
        body: "Ärendets status har ändrats. Öppna översikten för att se den nya.",
        sms: `CLEARANCE: statusen på ditt ärende${ref} har ändrats. Logga in för detaljer.`,
        href: "/dashboard",
      };

    case "steg-framat":
      return {
        title: "Processen har gått vidare",
        body: "Ärendet har gått vidare till nästa steg. Öppna översikten för att se var ni står.",
        sms: `CLEARANCE: ditt ärende${ref} har gått vidare till nästa steg. Logga in för detaljer.`,
        href: "/dashboard",
      };
  }
};

/* --- Identiteten ---------------------------------------------------------- */

export interface DedupeInput {
  kind: EventKind;
  userId: string;
  caseId: string;
  /**
   * Vad händelsen gäller: fristens id, dokumentets id, meddelandets id.
   * Det är DEN som gör att samma upptäckt gjord tio gånger blir en
   * avisering - inte tidpunkten, för tidpunkten är olika varje gång.
   */
  subjectId: string;
  /**
   * Fristhändelsen ska få komma igen när det blivit mer bråttom: sju
   * dagar kvar är ett annat besked än en dag kvar. Tröskeln - inte
   * antalet dagar - är därför en del av identiteten.
   */
  threshold?: number | null;
}

/**
 * Nyckeln som gör utskicket engångs. Databasen har ett unikt index på
 * den; en andra insättning med samma nyckel gör ingenting.
 *
 * Ordningen är avsiktlig och får inte ändras utan migrering: nycklarna
 * som redan ligger i tabellen skulle sluta matcha, och då skickas allt
 * en gång till.
 */
export const dedupeKey = (input: DedupeInput): string =>
  [
    input.kind,
    input.userId,
    input.caseId,
    input.subjectId,
    input.threshold === null || input.threshold === undefined ? "-" : String(input.threshold),
  ].join(":");

/**
 * Trösklarna för fristpåminnelsen. Tre besked, inte ett per dag: den
 * som får SMS varje dag i fjorton dagar slutar läsa dem, och då är
 * kanalen förbrukad när det verkligen gäller.
 */
export const DEADLINE_THRESHOLDS = [14, 7, 1] as const;

/**
 * Vilken tröskel ett antal dagar hör till - den snävaste som passerats.
 * Åtta dagar kvar hör till fjortondagarsbeskedet, sju till sjudagars.
 */
export const thresholdFor = (daysLeft: number): number | null => {
  for (const t of [...DEADLINE_THRESHOLDS].sort((a, b) => a - b)) {
    if (daysLeft <= t) return t;
  }
  return null;
};
