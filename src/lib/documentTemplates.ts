/**
 * Dokumentmallarna: styrelseprotokoll och kallelser, byggda ur ärendets
 * data.
 *
 * Rena funktioner - samma indata ger samma dokument, tecken för tecken.
 * Det är vad som gör dem testbara: ett styrelseprotokoll med fel
 * laghänvisning är ett fel med rättslig innebörd, och det ska fångas i ett
 * test, inte hos tingsrätten.
 *
 * Tre regler:
 *
 *  1. MALLEN SÄGER VAD DEN ÄR. Varje dokument inleds med en markering om
 *     att det är ett utkast som ska granskas innan det används. Produkten
 *     ger struktur, inte juridisk rådgivning - den gränsen står i
 *     dokumentet självt, inte bara i gränssnittet.
 *
 *  2. INGET HITTAS PÅ. Fält som saknas skrivs som tydliga luckor
 *     ("[ORT]"), aldrig som gissningar. Ett protokoll med påhittad ort är
 *     värre än ett med en synlig lucka.
 *
 *  3. LAGHÄNVISNINGARNA ÄR DEL AV TEXTEN och därmed av testerna:
 *     ABL 25 kap. 13-16 §§ för kontrollbalansprocessen, lagen (2022:964)
 *     om företagsrekonstruktion för rekonstruktionsansökan.
 */

import { PdfWriter } from "@/lib/pdf";

export interface TemplatePerson {
  name: string;
  role: string;
}

export interface TemplateInput {
  companyName: string;
  orgNumber: string;
  /** Ort för sammanträdet/stämman. Tom sträng ger en synlig lucka. */
  place: string;
  /** ISO-datum (YYYY-MM-DD). */
  date: string;
  attendees: TemplatePerson[];
}

export interface GeneratedDocument {
  id: string;
  title: string;
  fileName: string;
  body: string;
}

const DRAFT_NOTICE =
  "UTKAST FRÅN CLEARANCE – GRANSKA INNAN ANVÄNDNING\n" +
  "Mallen är ett strukturerat underlag, inte juridisk rådgivning. Stäm av\n" +
  "innehållet med bolagets revisor eller juridiska rådgivare innan det\n" +
  "undertecknas.";

const gap = (value: string, label: string): string => (value.trim() ? value.trim() : `[${label}]`);

const swedishDate = (iso: string): string => {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "[DATUM]";
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });
};

const attendeeLines = (attendees: TemplatePerson[]): string[] =>
  attendees.length > 0
    ? attendees.map((a) => `  ${a.name}${a.role ? `, ${a.role.toLowerCase()}` : ""}`)
    : ["  [NÄRVARANDE]"];

const signatureLines = (attendees: TemplatePerson[]): string[] => {
  const names = attendees.length > 0 ? attendees.map((a) => a.name) : ["[NAMN]"];
  return names.flatMap((name) => ["", "", "________________________________", name]);
};

const header = (input: TemplateInput, title: string): string[] => [
  DRAFT_NOTICE,
  "",
  "================================================================",
  title.toUpperCase(),
  "================================================================",
  "",
  `Bolag:   ${gap(input.companyName, "BOLAGSNAMN")}`,
  `Org.nr:  ${gap(input.orgNumber, "ORGANISATIONSNUMMER")}`,
  `Ort:     ${gap(input.place, "ORT")}`,
  `Datum:   ${swedishDate(input.date)}`,
  "",
];

/**
 * Styrelseprotokoll: beslut att upprätta kontrollbalansräkning.
 * ABL 25 kap. 13 § - skyldigheten inträder redan vid SKÄL ATT ANTA.
 */
export const boardMinutesKbr = (input: TemplateInput): GeneratedDocument => {
  const lines = [
    ...header(input, "Protokoll fört vid styrelsesammanträde"),
    "Närvarande:",
    ...attendeeLines(input.attendees),
    "",
    "§ 1  Sammanträdets öppnande och protokollförare",
    "Sammanträdet öppnades. Till protokollförare utsågs [NAMN].",
    "",
    "§ 2  Bolagets ekonomiska ställning",
    "Styrelsen konstaterade att det finns skäl att anta att bolagets eget",
    "kapital understiger hälften av det registrerade aktiekapitalet.",
    "",
    "§ 3  Beslut om kontrollbalansräkning",
    "Styrelsen beslutade att genast upprätta en kontrollbalansräkning i",
    "enlighet med 25 kap. 13 § aktiebolagslagen (2005:551) och att låta",
    "bolagets revisor granska den, i förekommande fall enligt 25 kap. 14 §.",
    "",
    "§ 4  Fortsatt hantering",
    "Styrelsen beslutade att följa likviditeten löpande och att kalla till",
    "kontrollstämma enligt 25 kap. 15 § aktiebolagslagen om",
    "kontrollbalansräkningen visar att kapitalet understiger den kritiska",
    "gränsen.",
    "",
    "§ 5  Sammanträdets avslutande",
    "Sammanträdet förklarades avslutat.",
    "",
    "Underskrifter:",
    ...signatureLines(input.attendees),
  ];
  return {
    id: "protokoll-kbr",
    title: "Styrelseprotokoll – beslut om kontrollbalansräkning",
    fileName: `styrelseprotokoll-kbr-${input.date}.txt`,
    body: lines.join("\n"),
  };
};

/**
 * Kallelse till extra bolagsstämma - första kontrollstämman,
 * ABL 25 kap. 15 §.
 */
export const noticeControlMeeting = (input: TemplateInput): GeneratedDocument => {
  const lines = [
    ...header(input, "Kallelse till extra bolagsstämma (första kontrollstämma)"),
    `Aktieägarna i ${gap(input.companyName, "BOLAGSNAMN")} kallas härmed till`,
    "extra bolagsstämma.",
    "",
    "Stämman hålls med anledning av att styrelsen har upprättat en",
    "kontrollbalansräkning enligt 25 kap. 13 § aktiebolagslagen (2005:551)",
    "som utvisar att bolagets eget kapital understiger hälften av det",
    "registrerade aktiekapitalet.",
    "",
    "Förslag till dagordning:",
    "  1. Stämmans öppnande och val av ordförande",
    "  2. Upprättande och godkännande av röstlängd",
    "  3. Godkännande av dagordning",
    "  4. Val av justerare",
    "  5. Prövning av om stämman blivit behörigen sammankallad",
    "  6. Framläggande av kontrollbalansräkningen och, i förekommande",
    "     fall, revisorns yttrande över den (25 kap. 15 § aktiebolagslagen)",
    "  7. Beslut om bolaget ska gå i likvidation eller driva verksamheten",
    "     vidare",
    "  8. Stämmans avslutande",
    "",
    "Kontrollbalansräkningen och revisorns yttrande hålls tillgängliga hos",
    "bolaget och sänds till de aktieägare som begär det.",
    "",
    "OBS: Kontrollera kallelsetid och kallelsesätt mot bolagsordningen och",
    "7 kap. aktiebolagslagen innan kallelsen skickas.",
    "",
    "Styrelsen",
    `${gap(input.companyName, "BOLAGSNAMN")}`,
  ];
  return {
    id: "kallelse-kontrollstamma",
    title: "Kallelse till första kontrollstämman",
    fileName: `kallelse-kontrollstamma-${input.date}.txt`,
    body: lines.join("\n"),
  };
};

/**
 * Styrelseprotokoll: beslut att ansöka om företagsrekonstruktion enligt
 * lagen (2022:964) om företagsrekonstruktion.
 */
export const boardMinutesReconstruction = (input: TemplateInput): GeneratedDocument => {
  const lines = [
    ...header(input, "Protokoll fört vid styrelsesammanträde"),
    "Närvarande:",
    ...attendeeLines(input.attendees),
    "",
    "§ 1  Sammanträdets öppnande och protokollförare",
    "Sammanträdet öppnades. Till protokollförare utsågs [NAMN].",
    "",
    "§ 2  Bolagets ekonomiska ställning",
    "Styrelsen konstaterade att bolaget har ekonomiska svårigheter men att",
    "det finns grundad anledning att anta att verksamhetens livskraft kan",
    "säkras genom en rekonstruktion.",
    "",
    "§ 3  Beslut om ansökan om företagsrekonstruktion",
    "Styrelsen beslutade att ansöka hos tingsrätten om",
    "företagsrekonstruktion enligt lagen (2022:964) om",
    "företagsrekonstruktion, och att i ansökan föreslå rekonstruktör.",
    "",
    "§ 4  Bemyndigande",
    "Styrelsen bemyndigade [NAMN] att underteckna och ge in ansökan samt",
    "att vidta de åtgärder som krävs för dess handläggning.",
    "",
    "§ 5  Sammanträdets avslutande",
    "Sammanträdet förklarades avslutat.",
    "",
    "Underskrifter:",
    ...signatureLines(input.attendees),
  ];
  return {
    id: "protokoll-rekonstruktion",
    title: "Styrelseprotokoll – ansökan om företagsrekonstruktion",
    fileName: `styrelseprotokoll-rekonstruktion-${input.date}.txt`,
    body: lines.join("\n"),
  };
};

/**
 * Mallen som PDF: den förformaterade texten sätts rad för rad - radbrytningar
 * och understreckslinjer i mallen är del av dokumentet och bevaras.
 */
export const templateToPdf = (doc: GeneratedDocument): Uint8Array => {
  const pdf = new PdfWriter(`Clearance · ${doc.title}`);
  pdf.text(doc.title, { font: "bold", size: 15, spaceAfter: 4 });
  pdf.rule();
  pdf.space(4);
  for (const line of doc.body.split("\n")) {
    if (line.trim() === "") {
      pdf.space(6);
    } else if (/^=+$/.test(line.trim())) {
      pdf.rule(0.7);
    } else if (/^§ \d/.test(line) ) {
      pdf.text(line, { font: "bold", size: 10.5, spaceAfter: 1 });
    } else if (line.startsWith("UTKAST")) {
      pdf.text(line, { font: "bold", size: 9, gray: 0.35, spaceAfter: 1 });
    } else {
      pdf.text(line, { size: 10, spaceAfter: 1 });
    }
  }
  return pdf.toBytes();
};

export const TEMPLATES = [
  {
    id: "protokoll-kbr",
    name: "Styrelseprotokoll – beslut om kontrollbalansräkning",
    description:
      "Beslutet som startar kontrollbalansprocessen (ABL 25 kap. 13 §). Upprättas när det finns skäl att anta att halva aktiekapitalet är förbrukat.",
    build: boardMinutesKbr,
  },
  {
    id: "kallelse-kontrollstamma",
    name: "Kallelse till första kontrollstämman",
    description:
      "Kallelse till extra bolagsstämma där kontrollbalansräkningen läggs fram (ABL 25 kap. 15 §). Stäm av kallelsetid mot bolagsordningen.",
    build: noticeControlMeeting,
  },
  {
    id: "protokoll-rekonstruktion",
    name: "Styrelseprotokoll – ansökan om företagsrekonstruktion",
    description:
      "Beslutet att ansöka hos tingsrätten enligt lagen (2022:964) om företagsrekonstruktion, med bemyndigande att ge in ansökan.",
    build: boardMinutesReconstruction,
  },
] as const;
