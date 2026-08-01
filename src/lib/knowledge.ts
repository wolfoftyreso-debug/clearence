/**
 * Kunskapsmotorn: strukturerad kunskap om företagskrisens juridik.
 *
 * INFORMATION, INTE RÅDGIVNING. Gränsen är produktens viktigaste
 * kunskapsregel och den bor i datan: varje artikel bär samma
 * gränsmarkering, och sidorna renderar den - de bestämmer inte den.
 * Artiklarna beskriver vad reglerna SÄGER och hänvisar till lagrummen;
 * vad ett enskilt bolag BÖR göra är rådgivarens fråga, och dit pekar
 * varje artikel.
 *
 * Innehållet är en ren datamodul av samma skäl som dokumentmallarna:
 * en felaktig paragraf i en kunskapsartikel är ett fel med rättslig
 * innebörd, och lagrummen testas ordagrant i tests/knowledge.ts.
 */

export interface KnowledgeSection {
  heading: string;
  paragraphs: string[];
}

export interface KnowledgeArticle {
  slug: string;
  title: string;
  /** En mening som säger vad läsaren får veta. */
  summary: string;
  sections: KnowledgeSection[];
  /** Lagrummen artikeln vilar på. Aldrig tom - kunskap utan källa är åsikt. */
  sources: string[];
  related: string[];
}

/** Gränsmarkeringen, ordagrant densamma överallt. */
export const KNOWLEDGE_DISCLAIMER =
  "Det här är allmän information om vad reglerna säger, inte rådgivning om " +
  "ditt bolag. Vad som är rätt i ett enskilt fall beror på omständigheterna - " +
  "stäm av med revisor eller juridisk rådgivare innan beslut fattas.";

export const KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  {
    slug: "kontrollbalansrakning",
    title: "Kontrollbalansräkning - när, hur och varför",
    summary:
      "Styrelsens skyldigheter när halva aktiekapitalet kan vara förbrukat, och vad som händer om de inte fullgörs.",
    sections: [
      {
        heading: "När skyldigheten inträder",
        paragraphs: [
          "Styrelsen ska genast upprätta en kontrollbalansräkning när det finns skäl att ANTA att bolagets eget kapital understiger hälften av det registrerade aktiekapitalet (25 kap. 13 § aktiebolagslagen). Tröskeln är alltså misstanken, inte visshet - att vänta på ett bokslut som bekräftar saken är i sig ett sätt att missa fristen.",
          "Samma skyldighet inträder om bolaget vid utmätning visat sig sakna utmätningsbara tillgångar.",
        ],
      },
      {
        heading: "Vad kontrollbalansräkningen är",
        paragraphs: [
          "En balansräkning upprättad enligt särskilda värderingsregler (25 kap. 14 §): tillgångar får bland annat tas upp till försäljningsvärde i stället för bokfört värde. Den ska granskas av bolagets revisor, om bolaget har en.",
          "Visar den att kapitalet understiger den kritiska gränsen ska styrelsen snarast kalla till bolagsstämma - den första kontrollstämman (25 kap. 15 §) - som prövar om bolaget ska gå i likvidation eller driva verksamheten vidare.",
        ],
      },
      {
        heading: "Åtta månader och den andra kontrollstämman",
        paragraphs: [
          "Beslutar stämman att driva vidare har bolaget åtta månader på sig att läka kapitalbristen. Inom den tiden ska en andra kontrollstämma hållas och en ny, revisorsgranskad kontrollbalansräkning läggas fram (25 kap. 16 §). Visar den inte att kapitalet är återställt ska styrelsen ansöka om likvidation hos tingsrätten (25 kap. 17 §).",
        ],
      },
      {
        heading: "Det personliga ansvaret",
        paragraphs: [
          "Underlåter styrelsen något av stegen svarar ledamöterna solidariskt för de förpliktelser som uppkommer under underlåtenhetsperioden (25 kap. 18 §). Ansvaret gäller framåt från försummelsen - det är därför tidpunkterna dokumenteras: ett styrelseprotokoll som visar när beslutet fattades är ledamotens skydd.",
        ],
      },
    ],
    sources: [
      "25 kap. 13 § aktiebolagslagen (2005:551)",
      "25 kap. 14 § aktiebolagslagen (2005:551)",
      "25 kap. 15-17 §§ aktiebolagslagen (2005:551)",
      "25 kap. 18 § aktiebolagslagen (2005:551)",
    ],
    related: ["foretradaransvar", "foretagsrekonstruktion", "likviditetskris-forsta-steg"],
  },
  {
    slug: "foretagsrekonstruktion",
    title: "Företagsrekonstruktion - andrum för livskraftiga bolag",
    summary:
      "Vad 2022 års rekonstruktionslag kräver, vad förfarandet ger och vad det kostar i tid och pengar.",
    sections: [
      {
        heading: "Vem kan få rekonstruktion",
        paragraphs: [
          "Ett bolag som har ekonomiska svårigheter kan beviljas företagsrekonstruktion om det finns grundad anledning att anta att verksamhetens livskraft kan säkras genom rekonstruktionen (lagen (2022:964) om företagsrekonstruktion). Livskraftstestet är 2022 års stora skärpning: rekonstruktion är till för bolag med en affär som bär, men en balansräkning som inte gör det.",
        ],
      },
      {
        heading: "Vad förfarandet ger",
        paragraphs: [
          "Under rekonstruktionen gäller ett verkställighetsförbud - utmätning och konkursansökningar från borgenärer stoppas som huvudregel. Bolaget driver verksamheten vidare under ledning av en rekonstruktör som tingsrätten utser.",
          "Målet är en rekonstruktionsplan som kan innefatta skuldnedskrivning. Planen antas genom omröstning i borgenärsklasser och kan under vissa förutsättningar fastställas även mot en klass som röstat emot.",
        ],
      },
      {
        heading: "Vad det kräver av bolaget",
        paragraphs: [
          "Rekonstruktörens arvode och ansökningskostnaderna bärs av bolaget - likviditet för driften under förfarandet måste finnas. Lönegarantin kan täcka löner under rekonstruktionen, vilket i praktiken är en väsentlig del av finansieringen.",
          "Ansökan ges in till tingsrätten av bolaget självt (styrelsebeslut) eller av en borgenär med bolagets samtycke.",
        ],
      },
    ],
    sources: [
      "Lagen (2022:964) om företagsrekonstruktion",
      "Lönegarantilagen (1992:497)",
    ],
    related: ["konkurs", "lonegaranti", "kontrollbalansrakning"],
  },
  {
    slug: "konkurs",
    title: "Konkurs - vad som händer, steg för steg",
    summary:
      "Förfarandet när fortsatt drift inte är möjlig: förvaltarens roll, ordningen mellan borgenärer och vad som händer med de anställda.",
    sections: [
      {
        heading: "Obestånd är grunden",
        paragraphs: [
          "Konkurs beslutas av tingsrätten när bolaget är på obestånd: det kan inte betala sina skulder i rätt tid och oförmågan är inte endast tillfällig (1 kap. 2 § konkurslagen). Ansökan kan göras av bolaget självt eller av en borgenär.",
        ],
      },
      {
        heading: "Förvaltaren tar över",
        paragraphs: [
          "I och med konkursbeslutet förlorar styrelsen rådigheten över bolagets egendom. En konkursförvaltare utses av tingsrätten och tar hand om boet: säljer tillgångarna, granskar transaktioner bakåt i tiden (återvinning) och utreder om styrelsen fullgjort sina skyldigheter.",
          "Styrelsens skyldighet att medverka består - bland annat att beediga bouppteckningen.",
        ],
      },
      {
        heading: "De anställda och lönegarantin",
        paragraphs: [
          "Anställdas lönefordringar skyddas av den statliga lönegarantin upp till ett tak. Förvaltaren beslutar om garantibelopp; utbetalningen sköts av länsstyrelsen. Anställningarna upphör inte automatiskt - förvaltaren tar ställning till driften och uppsägningar.",
        ],
      },
      {
        heading: "Konkurs är inte alltid slutet",
        paragraphs: [
          "En verksamhet kan leva vidare genom att förvaltaren säljer den - inkråmet, varumärket, personalen - till en ny ägare. Det bolaget som juridisk person upplöses, men affären kan fortsätta i annan form.",
        ],
      },
    ],
    sources: [
      "1 kap. 2 § konkurslagen (1987:672)",
      "Konkurslagen (1987:672)",
      "Lönegarantilagen (1992:497)",
    ],
    related: ["lonegaranti", "foretagsrekonstruktion", "foretradaransvar"],
  },
  {
    slug: "foretradaransvar",
    title: "Företrädaransvar för skatter - fristen få känner till",
    summary:
      "Styrelsens personliga ansvar för bolagets obetalda skatter, och varför förfallodagen är den dag som räknas.",
    sections: [
      {
        heading: "Huvudregeln",
        paragraphs: [
          "En företrädare som uppsåtligen eller av grov oaktsamhet låter bli att betala bolagets skatt kan bli personligt betalningsansvarig för den (59 kap. 12-13 §§ skatteförfarandelagen). I praxis bedöms passivitet strängt: att fortsätta driften efter förfallodagen utan åtgärd räknas i regel som grov oaktsamhet.",
        ],
      },
      {
        heading: "Verksam åtgärd senast på förfallodagen",
        paragraphs: [
          "Ansvar undviks om företrädaren SENAST på skattens förfallodag vidtar verksamma åtgärder för att avveckla bolagets skulder med hänsyn till samtliga borgenärers intressen - i praktiken konkursansökan, ansökan om företagsrekonstruktion eller betalningsinställelse. Det är den frist som gör skattekontots datum till styrelsens viktigaste kalender.",
        ],
      },
      {
        heading: "Befrielse och nyansering",
        paragraphs: [
          "Det finns utrymme för hel eller delvis befrielse när särskilda skäl talar för det (59 kap. 15 §). Skatteverket ansöker om ansvar hos förvaltningsrätten; det prövas alltså i domstol, inte av verket ensamt.",
        ],
      },
    ],
    sources: [
      "59 kap. 12-13 §§ skatteförfarandelagen (2011:1244)",
      "59 kap. 15 § skatteförfarandelagen (2011:1244)",
    ],
    related: ["kontrollbalansrakning", "likviditetskris-forsta-steg", "konkurs"],
  },
  {
    slug: "lonegaranti",
    title: "Lönegarantin - de anställdas skyddsnät",
    summary:
      "Vem som betalar lönerna vid konkurs och rekonstruktion, hur mycket som täcks och hur det går till.",
    sections: [
      {
        heading: "Vad som täcks",
        paragraphs: [
          "Vid konkurs och företagsrekonstruktion träder den statliga lönegarantin in för anställdas lönefordringar (lönegarantilagen (1992:497)). Garantin täcker lön för viss tid före och under förfarandet samt uppsägningslön, upp till ett tak om fyra prisbasbelopp per anställd.",
        ],
      },
      {
        heading: "Hur det går till",
        paragraphs: [
          "Konkursförvaltaren respektive rekonstruktören beslutar om garantibelopp för varje anställd; länsstyrelsen betalar ut. Den anställde behöver i normalfallet inte själv ansöka - men ska anmäla sina fordringar till förvaltaren.",
          "För bolaget i rekonstruktion är garantin i praktiken en del av finansieringen: den lyfter lönekostnaden under förfarandets inledning. Utbetald garanti blir en statlig regressfordran mot bolaget.",
        ],
      },
    ],
    sources: ["Lönegarantilagen (1992:497)"],
    related: ["konkurs", "foretagsrekonstruktion"],
  },
  {
    slug: "likviditetskris-forsta-steg",
    title: "Likviditetskris - de första stegen i rätt ordning",
    summary:
      "Vad reglerna kräver av styrelsen de första veckorna, och vilka datum som styr.",
    sections: [
      {
        heading: "Skaffa en sann bild, daterad",
        paragraphs: [
          "Allt ansvar i krisjuridiken hänger på tidpunkter: när styrelsen insåg eller borde ha insett läget. Första steget är därför en daterad sammanställning - likviditet vecka för vecka, förfallna skulder, skattekontots saldo och kommande förfallodagar. Det är den bilden övriga beslut ska kunna härledas ur.",
        ],
      },
      {
        heading: "Datumen som styr",
        paragraphs: [
          "Skattens förfallodag styr företrädaransvaret: verksam åtgärd senast den dagen. Misstanke om att halva aktiekapitalet är förbrukat utlöser kontrollbalansplikten: genast. Lönedagen styr personalens förtroende och lönegarantifrågan. De tre klockorna går oberoende av varandra - en handlingsplan som inte visar alla tre är inte en handlingsplan.",
        ],
      },
      {
        heading: "Dokumentera besluten",
        paragraphs: [
          "Styrelsebeslut i kris ska gå att belägga i efterhand: protokollför bedömningarna, även beslutet att INTE agera och skälen för det. I en senare prövning är ett daterat protokoll skillnaden mellan en dokumenterad bedömning och en efterhandskonstruktion.",
        ],
      },
      {
        heading: "Ta in rätt kompetens tidigt",
        paragraphs: [
          "Revisorn, en rekonstruktör eller en obeståndsjurist ser mönster styrelsen möter för första gången. Alternativen - rekonstruktion, underhandsackord, kontrollerad avveckling, konkurs - har olika fönster som stängs i olika takt, och valet mellan dem är rådgivning, inte information.",
        ],
      },
    ],
    sources: [
      "25 kap. 13 § aktiebolagslagen (2005:551)",
      "59 kap. 12-13 §§ skatteförfarandelagen (2011:1244)",
    ],
    related: ["kontrollbalansrakning", "foretradaransvar", "foretagsrekonstruktion"],
  },
];

export const findArticle = (slug: string): KnowledgeArticle | null =>
  KNOWLEDGE_ARTICLES.find((a) => a.slug === slug) ?? null;
