/**
 * Handlingsalternativen: vilka vägar som finns kvar, och vad de kräver.
 *
 * Det finns ingen modul som heter "Konkurs" i den här produkten. Det
 * finns vägar framåt, och var och en har en status som uppdateras när
 * ärendet ändras: öppen, smalnar, brådskande eller stängd. Fokus ligger
 * på beslut och möjligheter - inte på en förutbestämd utgång.
 *
 * Konstitutionen gäller: vägarna presenteras som möjligheter att pröva
 * mot just det här bolagets läge, aldrig som universella sanningar.
 * Statusarna härleds deterministiskt ur ärendets registrerade uppgifter
 * - samma läge ger samma bild, och bilden kan alltid förklaras.
 */

export type PathStatus = "open" | "narrowing" | "urgent" | "closed";

export interface OptionsInput {
  /** Snabbt avyttringsvärde delat med totala skulder, i procent. Null när skulder saknas. */
  coverageRatio: number | null;
  /** Antal frister som redan passerat obehandlade. */
  passedDeadlines: number;
  /** Dagar till närmaste kommande frist. Null när ingen finns. */
  daysToNextDeadline: number | null;
  canPayTax: boolean;
  canPaySalary: boolean;
  /** Systemets rekommendation ur nulägesanalysen, om någon. */
  recommendationType: "bankruptcy" | "reconstruction" | "stabilize" | null;
  /** Är kontrollbalansbedömningen gjord? */
  kbrDone: boolean;
}

export interface ActionPath {
  id: string;
  title: string;
  status: PathStatus;
  /** En mening: vad vägen är. */
  summary: string;
  /** Vad vägen kräver - kraven är vägens pris, utskrivet. */
  requires: string[];
  /** Varför statusen är den den är, ur ärendets data. */
  statusReason: string;
}

export const PATH_STATUS_LABELS: Record<PathStatus, string> = {
  open: "Öppen",
  narrowing: "Smalnar",
  urgent: "Brådskande",
  closed: "Kräver mer än läget medger",
};

const STATUS_ORDER: Record<PathStatus, number> = { urgent: 0, open: 1, narrowing: 2, closed: 3 };

export const buildActionPaths = (input: OptionsInput): ActionPath[] => {
  const paths: ActionPath[] = [];
  const coverage = input.coverageRatio;

  /* Stabilisering i egen drift - den operativa återhämtningen. */
  {
    const pressured = !input.canPayTax || !input.canPaySalary || input.passedDeadlines > 0;
    paths.push({
      id: "stabilisering",
      title: "Stabilisering i egen drift",
      status: pressured ? "narrowing" : "open",
      summary:
        "Vänd kassaflödet med det bolaget redan har: snabbare fakturering, indrivna fordringar, omförhandlade villkor och en plan som följs upp varje vecka.",
      requires: [
        "En realistisk likviditetsplan som visar att pengarna räcker under vändningen",
        "Veckovis uppföljning mot planen - avvikelser hanteras direkt",
        "Att inga skyddade frister hinner passera under tiden",
      ],
      statusReason: pressured
        ? "Skatter, löner eller frister är redan under press - varje vecka utan plan smalnar den här vägen."
        : "Inga frister har passerat och de löpande betalningarna klaras ännu.",
    });
  }

  /* Skatteanstånd. */
  {
    const urgent = !input.canPayTax && (input.daysToNextDeadline ?? 99) <= 14;
    paths.push({
      id: "anstand",
      title: "Anstånd hos Skatteverket",
      status: !input.canPayTax ? (urgent ? "urgent" : "open") : "open",
      summary:
        "Flyttar skattens förfallodag och köper tid - och flyttar samtidigt den dag företrädaransvaret prövas mot.",
      requires: [
        "Ansökan FÖRE förfallodagen - efteråt är verkan en annan",
        "En förklaring till betalningssvårigheterna och en plan för betalning",
      ],
      statusReason: !input.canPayTax
        ? urgent
          ? "Skatten kan inte betalas och förfallodagen är nära - ansökan brådskar."
          : "Skatten är under press - ansökan bör förberedas nu."
        : "Ingen akut skattebrist är registrerad, men vägen finns om läget ändras.",
    });
  }

  /* Frivillig uppgörelse med borgenärerna. */
  {
    const trustEroding = input.passedDeadlines > 0;
    paths.push({
      id: "uppgorelse",
      title: "Frivillig uppgörelse med borgenärerna",
      status: trustEroding ? "narrowing" : "open",
      summary:
        "Förhandlade betalningsplaner eller nedskrivningar utan domstol - snabbast och billigast när förtroendet finns kvar.",
      requires: [
        "Borgenärernas förtroende - ett genomarbetat underlag är halva förhandlingen",
        "Likabehandling av borgenärerna i praktiken, annars faller uppgörelsen",
        "Att bolaget klarar den plan som erbjuds",
      ],
      statusReason: trustEroding
        ? "Passerade frister tär på förtroendet - ju längre väntan, desto svagare förhandlingsläge."
        : "Inga frister har passerat - förhandlingsläget är fortfarande gott.",
    });
  }

  /* Företagsrekonstruktion. */
  {
    const viable = input.recommendationType !== "bankruptcy";
    const wagesPressed = !input.canPaySalary;
    paths.push({
      id: "rekonstruktion",
      title: "Företagsrekonstruktion",
      status: !viable ? "narrowing" : wagesPressed ? "urgent" : "open",
      summary:
        "Ett domstolsförfarande som ger andrum: betalningsstopp mot borgenärerna, statlig lönegaranti för de anställda och en plan som kan skriva ned skulder.",
      requires: [
        "Livskraft i kärnverksamheten - rekonstruktion räddar bärkraftiga bolag, inte affärsmodeller som inte bär",
        "Ansökan till tingsrätten och pengar att driva förfarandet",
        "En rekonstruktör - och ett underlag som håller för prövningen",
      ],
      statusReason: !viable
        ? "Nulägesanalysen pekar mot att kärnan kan sakna bärkraft - då är rekonstruktionens krav svåra att möta."
        : wagesPressed
          ? "Lönerna är under press - vid rekonstruktion kan lönegarantin träda in, men ansökan måste hinna före konkursansökningar."
          : "Verksamheten bedöms ha en kärna att rekonstruera kring.",
    });
  }

  /* Ordnad avveckling - likvidation. */
  {
    const solvent = coverage !== null && coverage >= 100;
    paths.push({
      id: "avveckling",
      title: "Ordnad avveckling (likvidation)",
      status: solvent ? "open" : "closed",
      summary:
        "Bolaget avvecklas under kontroll: tillgångarna säljs, skulderna betalas och det som blir över skiftas ut. Ett slut man väljer, inte ett som väljer en.",
      requires: [
        "Att skulderna kan betalas fullt ut - annars är vägen konkurs eller uppgörelse",
        "Bolagsstämmans beslut och en likvidator",
      ],
      statusReason: solvent
        ? "Det snabba avyttringsvärdet täcker skulderna - frivillig likvidation är möjlig."
        : `Skuldtäckningen är ${coverage === null ? "okänd" : `${coverage} %`} - frivillig likvidation kräver full täckning, så vägen kräver mer än läget medger just nu.`,
    });
  }

  /* Konkurs - en väg bland de andra, sakligt beskriven. */
  {
    paths.push({
      id: "konkurs",
      title: "Konkurs",
      status: "open",
      summary:
        "Det ordnade avslutet när skulderna inte kan bäras: en förvaltare tar över, lönegarantin skyddar de anställda och rätt hanterad begränsar den styrelsens risker i stället för att öka dem.",
      requires: [
        "Beslut och egen ansökan - den som väntar tills en borgenär ansöker förlorar kontrollen över tidpunkten",
        "Dokumenterat agerande fram till beslutet - det är underlaget som skyddar styrelsen",
      ],
      statusReason:
        "Vägen är alltid öppen. Poängen är att den ska vara ett aktivt val i rätt tid - inte något som hinner ikapp.",
    });
  }

  return paths.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
};

/* --- åtgärdskatalogen ------------------------------------------------------ */

export interface ActionCategory {
  id: string;
  title: string;
  /** Vad kategorin angriper. */
  intro: string;
  items: string[];
}

/**
 * Katalogen är en verktygslåda, inte en föreskrift. CLEARANCE resonerar:
 * "Det finns flera vägar framåt. Vi ska först förstå varför kassaflödet
 * är negativt, och därefter bedöma vilka åtgärder som är mest
 * realistiska för just ditt företag."
 */
export const ACTION_CATALOG: ActionCategory[] = [
  {
    id: "kassaflode",
    title: "Kassaflöde",
    intro: "Få in pengarna snabbare och ut dem långsammare - utan nya åtaganden.",
    items: [
      "Förhandla betalningsvillkor med leverantörer",
      "Påskynda kundinbetalningar - påminn, ring, erbjud delbetalning",
      "Fakturera snabbare: samma dag som arbetet är klart",
      "Minska kapitalbindningen i lager och pågående arbeten",
    ],
  },
  {
    id: "intakter",
    title: "Intäkter",
    intro: "Sälj mer av det som redan bär sig - kris är inte skäl att sluta sälja.",
    items: [
      "Kampanjer mot befintliga kunder",
      "Återaktivera gamla kunder",
      "Sälj serviceavtal - återkommande intäkter lugnar också banken",
      "Prisjusteringar där marknaden medger det",
    ],
  },
  {
    id: "finansiering",
    title: "Finansiering",
    intro: "Köp tid till rätt pris - och pröva behovet mot likviditetsplanen först.",
    items: [
      "Anstånd hos Skatteverket",
      "Bryggfinansiering mot säkerheter eller fordringar",
      "Ägartillskott eller aktieägarlån",
      "Rekonstruktion med skulduppgörelse, när det är lämpligt",
    ],
  },
  {
    id: "kostnader",
    title: "Kostnader",
    intro: "Skär där det inte blöder - kostnader som bär intäkter är inte besparingar.",
    items: [
      "Omförhandla hyror, leasing och abonnemang",
      "Effektivisera flöden innan tjänster sägs upp",
      "Tillfälliga besparingar med tydligt slutdatum",
    ],
  },
];

/** CLEARANCE:s hållning när alternativen efterfrågas - konstitutionens formulering. */
export const OPTIONS_STANCE =
  "Det finns flera vägar framåt. Vi ska först förstå varför kassaflödet är negativt, och därefter bedöma vilka åtgärder som är mest realistiska för just ditt företag.";
