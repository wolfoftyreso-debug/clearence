/**
 * KÄLLREGISTRET: var uppgifterna om bolaget faktiskt kan komma ifrån.
 *
 * Bakgrundspanelen sa "ingen källa ansluten" på sex moment. Den var ärlig
 * men tom, och frågan blev: kan vi skrapa det här?
 *
 * SVARET ÄR NEJ FÖR DE FLESTA AV DEM, och det är inte en teknisk
 * begränsning utan ett medvetet val. Skillnaden mellan hämtningssätten är
 * hela poängen med den här filen:
 *
 *  - "hamta"          Vi hämtar en sida som är publicerad för att läsas,
 *                     och följer robots.txt. Bolagets egen webbplats är
 *                     det tydliga fallet: användaren äger den.
 *  - "rss"            Ett flöde som finns till för att prenumereras på.
 *  - "api-avtal"      Officiellt gränssnitt som kräver avtal eller nyckel.
 *                     Koden är meningslös innan avtalet finns.
 *  - "agarmedgivande" API som kräver att bolaget själv ger oss åtkomst.
 *                     Det är genomförbart just här - kunden ÄR ägaren.
 *  - "harledd"        Ingen hämtning alls: räknas fram ur uppgifter vi
 *                     redan har.
 *  - "forbjuden"      Får inte hämtas. Motpartens villkor förbjuder det,
 *                     och en produkt som bygger på att bryta mot dem tappar
 *                     källan den dag någon märker det - mitt i ett ärende.
 *
 * VARFÖR INTE BARA SKRAPA ÄNDÅ
 *
 * Tre skäl, i den ordning de kostar:
 *
 *  1. Det slutar fungera. En skrapa mot en sajt som inte vill bli skrapad
 *     är trasig efter nästa layoutändring eller blockering. Ett bolag i
 *     rekonstruktion får då en analys som tyst blivit tunnare, utan att
 *     någon sagt det.
 *  2. Det är ett avtalsbrott. LinkedIn, Meta och Google förbjuder det i
 *     sina villkor. Ett bolag som säljer krishantering till andra bolag
 *     kan inte ha den risken i sin egen leveranskedja.
 *  3. Det gör uppgifterna omöjliga att stå för. "Var kommer det här
 *     ifrån?" måste gå att besvara för varje rad i en analys som används
 *     som beslutsunderlag.
 *
 * Det som ÄR skrapbart - bolagets egen webbplats - hämtas därför ordentligt:
 * robots.txt först, tydlig user-agent, en sida i taget, och ingenting
 * påhittat när svaret uteblir.
 */

export type Acquisition =
  | "hamta"
  | "rss"
  | "api-avtal"
  | "agarmedgivande"
  | "harledd"
  | "forbjuden";

export interface SourceSpec {
  /** Samma id som BackgroundSource i advisor/backgroundWork. */
  id: string;
  label: string;
  acquisition: Acquisition;
  /** Sant när källan går att använda i den här versionen, utan nytt avtal. */
  live: boolean;
  /** Vad den ger analysen. Skrivet för en läsare, inte för en logg. */
  value: string;
  /** Vad som krävs för att den ska bli live. Tom sträng när den redan är det. */
  needs: string;
  /**
   * Sant när källans tillgänglighet avgörs vid KÖRNING och inte av
   * konfigurationen.
   *
   * Företagsregistret är det enda fallet: uppslaget går genom dataporten
   * och kan svara eller inte svara för ett givet organisationsnummer.
   * Panelen visar då utfallet - "hämtat ur företagsregistret" eller
   * "gav inget svar på det här numret" - och det är riktigare än vad ett
   * statiskt register kan säga.
   *
   * `live` beskriver för sådana källor PRODUKTIONSLÄGET: finns ett avtal
   * som gör uppslaget meningsfullt utanför demoläget.
   */
  runtime?: boolean;
  /**
   * Den rättsliga eller praktiska grunden. Fylls i för ALLA källor, även
   * de som är live: den som frågar var en uppgift kommer ifrån ska få
   * svaret ur registret och inte ur någons minne.
   */
  basis: string;
}

export const SOURCES: SourceSpec[] = [
  {
    id: "foretagsregister",
    label: "Offentlig företagsinformation",
    acquisition: "api-avtal",
    live: false,
    runtime: true,
    value: "Firma, säte, bolagsform, styrelse, F-skatt och momsregistrering.",
    needs:
      "Avtal med Bolagsverket för Näringslivsregistret, eller ett abonnemang " +
      "hos en kreditupplysare (Creditsafe, Syna, Bisnode).",
    basis:
      "Uppgifterna är offentliga, men de tillhandahålls genom avtalade " +
      "gränssnitt. Att i stället skrapa allabolag.se eller ratsit vore att " +
      "ta betalt av en återförsäljares arbete utan avtal - och deras villkor " +
      "förbjuder det uttryckligen. " +
      "GOOGLE LÖSER INTE DEN HÄR RADEN, och det är värt att skriva ut " +
      "eftersom frågan kommer: Google Places känner till PLATSER och " +
      "verksamheter, inte juridiska personer. Därifrån får vi adress, " +
      "telefon och webbplats - aldrig organisationsnummer, styrelse, " +
      "F-skatt eller momsregistrering. Det är Bolagsverket och Skatteverket.",
  },
  {
    id: "webb",
    label: "Bolagets webbplats",
    acquisition: "hamta",
    /*
     * LIVE, OCH KÖRNINGSBEROENDE. Skillnaden mot förut är att hämtaren nu
     * finns: API-slutpunkten /v1/sources/website hämtar sidan på riktigt,
     * med robots.txt först och SSRF-skydd (api/server/website.ts), och
     * tolkningen är prövad (sources/website.ts, tests/sources.ts).
     *
     * Ingen nyckel och inget avtal krävs - sidan är publik och kunden äger
     * den - så till skillnad från företagsregistret och recensionerna är
     * den här live utan förbehåll. Men OM den ger något avgörs ändå vid
     * körning: en sida kan vara nere, robots.txt kan säga nej, eller sidan
     * kan sakna strukturerad data. Panelen visar då utfallet i klartext
     * (traff / robots säger nej / hämtad men tom / gick inte att nå) i
     * stället för en tyst lucka.
     */
    live: true,
    runtime: true,
    value:
      "Vad bolaget säger att det gör, kontaktvägar, och vilka sociala konton " +
      "det själv länkar till.",
    /* Byggd och påslagen. Inget kvarstår att koppla in. */
    needs: "",
    basis:
      "Sidan är publicerad för att läsas, och kunden äger den. Vi läser " +
      "robots.txt först och respekterar den, anger vem vi är i user-agent, " +
      "och hämtar ett fåtal sidor - inte hela sajten. Servern vägrar " +
      "dessutom adresser som pekar på interna nät (SSRF-skydd).",
  },
  {
    id: "sociala-medier",
    label: "Sociala medier",
    acquisition: "forbjuden",
    live: false,
    value: "Aktivitetsnivå och hur bolaget beskriver sig utåt.",
    needs:
      "Officiell API-åtkomst hos respektive plattform. LinkedIns och Metas " +
      "villkor förbjuder automatiserad insamling utan den.",
    basis:
      "Får inte skrapas. Det vi däremot gör är att läsa vilka konton bolaget " +
      "SJÄLVT länkar till från sin webbplats - den uppgiften kommer ur en " +
      "sida vi har rätt att hämta, och säger vilka kanaler som finns utan " +
      "att röra plattformarna.",
  },
  {
    id: "recensioner",
    label: "Kundrecensioner",
    acquisition: "api-avtal",
    /*
     * KÖRNINGSBEROENDE, som företagsregistret. Hämtningen är byggd
     * (api/server/google.ts) och tolkningen prövad (sources/google.ts).
     * Om källan svarar avgörs vid körning av två saker: att driften har
     * en Google-nyckel, och att bolaget går att matcha entydigt.
     *
     * Den andra är inte en teknikalitet. Google har inget
     * organisationsnummer att matcha på, så två bolag med samma namn går
     * inte att skilja åt - och då hämtar vi ingenting hellre än fel
     * bolags omdömen.
     */
    live: false,
    runtime: true,
    value:
      "Betyg, antal omdömen och verksamhetsstatus - om Google visar bolaget " +
      "som öppet, tillfälligt stängt eller permanent stängt.",
    /*
     * SKRIVEN FÖR DEN SOM LÄSER PANELEN, inte för den som driftsätter.
     * Texten här visas för en företagare mitt i en kris; ett variabelnamn
     * ur en containerkonfiguration säger hen ingenting. Det tekniska
     * (GOOGLE_MAPS_API_KEY, flaggan i Terraform) står i basis och i
     * docs/driftsattning.md, där den som ska göra jobbet letar.
     */
    needs:
      "Kopplingen mot Google är byggd men inte påslagen i den här driften. " +
      "När den är det hämtas uppgifterna automatiskt – du behöver inte lämna " +
      "något själv.",
    basis:
      "Google Places API (nyckeln GOOGLE_MAPS_API_KEY, flaggan " +
      "enable_google_source i infrastrukturen). Ett betalt, officiellt " +
      "gränssnitt - inte skrapning. " +
      "Villkoren tillåter cachning i högst 30 dagar och kräver att källan " +
      "anges där uppgiften visas; båda reglerna står i sources/google.ts. " +
      "Recensenternas namn och bilder hämtas aldrig - vi läser omdömet om " +
      "bolaget, inte om människan som skrev det.",
  },
  {
    id: "nyheter",
    label: "Nyhetsartiklar om bolaget",
    acquisition: "rss",
    live: true,
    runtime: true,
    value: "Om något hänt utåt som ärendet behöver ta höjd för.",
    needs: "",
    basis:
      "Ett RSS-flöde publiceras för att prenumereras på - att hämta det är " +
      "dess syfte, och kräver inget avtal. Vilka flöden som läses är en " +
      "driftparameter (app_settings, nyckeln news_feeds), och utfallet " +
      "redovisas PER FLÖDE: en källa som slutat svara syns i stället för " +
      "att bevakningen tyst blir tunnare. " +
      "Fulltext är upphovsrättsskyddad och lagras aldrig - rubrik, datum, " +
      "länk och källa, inget mer. " +
      "En träff kräver bolagsnamnet som sammanhängande fras eller " +
      "organisationsnumret; ett för allmänt namn matchas inte alls, och då " +
      "säger panelen det i stället för att leverera brus. " +
      "Djup mediebevakning (Retriever, Meltwater) kräver fortfarande " +
      "abonnemang och ingår inte.",
  },
  {
    id: "branschdata",
    label: "Konkurrenter och branschläge",
    acquisition: "harledd",
    live: false,
    value: "Hur bolagets läge står sig mot branschen.",
    needs:
      "SNI-koden ur företagsregistret, plus SCB:s öppna statistik-API för " +
      "branschtal. Faller alltså med företagsregistret.",
    basis:
      "Ingen hämtning om enskilda konkurrenter - den uppgiften finns inte " +
      "att hämta lagligt och skulle bli en gissning. Det som går är " +
      "branschens aggregerade tal, ur offentlig statistik.",
  },
];

export const sourceById = (id: string): SourceSpec | undefined =>
  SOURCES.find((s) => s.id === id);

/** Källor som får användas i den här versionen. */
export const liveSources = (): SourceSpec[] => SOURCES.filter((s) => s.live);

/**
 * Källor som ALDRIG får hämtas automatiskt, oavsett hur mycket någon vill.
 *
 * Egen funktion och inte bara ett fält, för att den ska gå att anropa från
 * en kontroll: det är skillnad på "inte byggt än" och "får inte byggas".
 */
export const forbiddenSources = (): SourceSpec[] =>
  SOURCES.filter((s) => s.acquisition === "forbjuden");
