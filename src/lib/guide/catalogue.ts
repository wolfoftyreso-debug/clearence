/**
 * FUNKTIONSKATALOGEN - kontraktet bakom "visa, berätta inte".
 *
 * Designprincipen för hela plattformen:
 *
 *   Användaren ska aldrig behöva leta efter en funktion som CLEARANCE
 *   känner till. Nämner CLEARANCE en funktion ska den samtidigt kunna
 *   VISA exakt var den finns, förklara VARFÖR den används, visa VAD som
 *   sparats där, och hur användaren SJÄLV administrerar den sedan.
 *
 * En princip som bara står i en designguide är en åsikt. Den här filen
 * gör den till ett kontrakt: varje funktion CLEARANCE får nämna står
 * här, med alla fyra svaren och med en adress som går att navigera till.
 * tests/guide.ts vaktar att adressen finns i App.tsx, att ankaret finns
 * som ett `data-guide`-attribut någonstans i källträdet, och att inget
 * av de fyra svaren saknas.
 *
 * Konsekvensen är avsiktlig och obekväm: den som lägger till en ny vy
 * och vill att CLEARANCE ska kunna prata om den måste också kunna svara
 * på varför den finns och hur användaren sköter den. Kan man inte det
 * är funktionen inte färdig.
 *
 * ANKARE, INTE SELEKTORER. Målen pekas ut med `data-guide="namn"` och
 * aldrig med en CSS-klass eller en position. En klass byter namn vid
 * nästa designrond utan att någon märker att guiden slutat peka; ett
 * ankare som försvinner fäller testet.
 */

export interface GuideEntry {
  id: string;
  /** Vad funktionen heter i gränssnittet. Exakt samma ord som på skärmen. */
  label: string;
  /** Adressen. Måste finnas som route i App.tsx. */
  route: string;
  /**
   * Elementet som ska ringas in när användaren kommit fram. Måste finnas
   * som data-guide i källträdet.
   */
  anchor: string;
  /**
   * Menyvalet som leder dit, om något gör det. Ringas in PÅ VÄGEN, så
   * att användaren ser vilken väg som togs och kan gå den själv nästa
   * gång. Null för funktioner som inte har ett eget menyval.
   */
  navAnchor: string | null;
  /** Varför funktionen används. Ett skäl, inte en beskrivning. */
  why: string;
  /** Vad som sparas där. Det här är svaret på "vart tog mina uppgifter vägen?". */
  saves: string;
  /** Hur användaren själv ändrar eller sköter det sedan. */
  manage: string;
  /**
   * Ord som ska leda hit när användaren skriver "visa mig ...".
   * Skrivna som en människa säger dem, inte som de heter i menyn.
   */
  synonyms: string[];
}

export const GUIDE_CATALOGUE: GuideEntry[] = [
  {
    id: "kontrollomrade",
    label: "Kontrolläget",
    route: "/dashboard",
    anchor: "kontrollomrade",
    navAnchor: "nav-oversikt",
    why: "Det största hotet i en företagskris är sällan siffrorna i sig – det är att missa ett datum eller att inte kunna visa att man agerat. Panelen svarar på om systemet håller uppsikt åt dig.",
    saves: "Vad som bevakas, vad som saknas, och spåret som visar att du agerat.",
    manage: "Raderna under Detta saknas länkar dit saken åtgärdas. Bevakningen sköter sig själv.",
    synonyms: ["kontrollområde", "kontrolläge", "bevakning", "vad bevakas", "håller ni koll"],
  },
  {
    id: "handlingsplan",
    label: "Handlingsplanen",
    route: "/dashboard",
    anchor: "handlingsplan",
    navAnchor: "nav-oversikt",
    why: "Den samlar det som ska göras i den ordning fristerna kräver, så att du slipper hålla ordningen i huvudet.",
    saves: "Uppgifterna, vem de är delegerade till, och när de bockades av.",
    manage: "Varje rad leder in i verktyget som löser den. Du kan lägga till egna punkter och delegera dem.",
    synonyms: ["handlingsplan", "att göra", "uppgifter", "vad ska jag göra", "nästa steg"],
  },
  {
    id: "likviditet",
    label: "Likviditet",
    route: "/dashboard/liquidity",
    anchor: "likviditetsvyn",
    navAnchor: "nav-likviditet",
    why: "Kassan avgör vilka alternativ som finns kvar. En rekonstruktion kräver likviditet för driften under processen – därför är dagen kassan tar slut den viktigaste siffran i hela ärendet.",
    saves: "Prognosen, de bevakade betalningarna och nyckeltalen med sina förbehåll.",
    manage: "Lägg till eller ändra betalningar i planeraren; kurvan och nyckeltalen räknas om direkt.",
    synonyms: ["likviditet", "kassa", "prognos", "runway", "pengar", "kassaflöde"],
  },
  {
    id: "dokument",
    label: "Dokument",
    route: "/dashboard/dokument",
    anchor: "dokumentvyn",
    navAnchor: "nav-dokument",
    why: "Allt som produceras i ärendet hamnar här automatiskt. Att kunna visa handlingarna är halva tryggheten i en process.",
    saves: "Rapporter, protokoll, fakturor och underlag du laddat upp – med källa och datum.",
    manage: "Du kan ladda upp fler, byta status på ett dokument och ladda ner allt som PDF.",
    synonyms: ["dokument", "rapporter", "handlingar", "filer", "underlag", "akten", "var sparas rapporterna"],
  },
  {
    id: "handelselogg",
    label: "Händelseloggen",
    route: "/dashboard/handelser",
    anchor: "handelseloggen",
    navAnchor: "nav-handelselogg",
    why: "Loggen är tidsstämplad av databasen och går inte att ändra i efterhand. Den visar när styrelsen insåg något och när den agerade – användbart som bevisning.",
    saves: "Varje beslut, varje utskick och varje ändring i ärendet, i tidsordning.",
    manage: "Loggen kan inte redigeras – det är själva poängen. Den kan exporteras.",
    synonyms: ["händelselogg", "logg", "historik", "vad har hänt", "spår", "bevisning"],
  },
  {
    id: "deltagare",
    label: "Deltagare",
    route: "/dashboard/deltagare",
    anchor: "deltagarvyn",
    navAnchor: "nav-deltagare",
    why: "Rätt kompetens tidigt minskar risken för kostsamma felbeslut, och alla i ärendet ser samma underlag i stället för varsin version.",
    saves: "Vilka som är inbjudna, i vilken roll, och vad varje roll får se.",
    manage: "Bjud in fler, ändra roll eller återkalla en behörighet – allt härifrån.",
    synonyms: ["deltagare", "bjuda in", "revisor", "styrelse", "vem ser", "dela ärendet"],
  },
  {
    id: "meddelanden",
    label: "Meddelanden",
    route: "/dashboard/meddelanden",
    anchor: "meddelandevyn",
    navAnchor: "nav-meddelanden",
    why: "Samtalen om ärendet hålls i ärendet. Ett beslut som fattats i en mejltråd går inte att hitta när det behövs.",
    saves: "Alla meddelanden, bilagor och vem som uppfattat vad.",
    manage: "Skriv till en enskild deltagare eller hela gruppen; du kan tagga någon för att kalla in dem.",
    synonyms: ["meddelanden", "chatt", "skriva till", "kontakta deltagare"],
  },
  {
    id: "installningar",
    label: "Inställningar",
    route: "/dashboard/installningar",
    anchor: "installningsvyn",
    navAnchor: "nav-installningar",
    why: "Här styr du vad systemet gör åt dig utan att fråga – aviseringar, kanaler och abonnemang.",
    saves: "Dina val av aviseringsnivå och kanal, din profil och dina fakturor.",
    manage: "Allt på sidan går att ändra när som helst. Ett avstängt SMS slår igenom direkt.",
    // Aviseringsorden hör till posten nedan, inte hit. Två poster som
    // gör anspråk på samma ord kan inte skilja sig åt vid en sökning -
    // då blir träffen tvetydig och guiden tvingas fråga i stället för
    // att visa. Sidan är densamma; den specifika posten leder rätt.
    synonyms: ["inställningar", "abonnemang", "faktura", "mitt konto", "prenumeration"],
  },
  {
    id: "aviseringar",
    label: "Aviseringar",
    route: "/dashboard/installningar",
    anchor: "aviseringskanaler",
    navAnchor: "nav-installningar",
    why: "Ett datum som passerar medan du inte är inloggad är den vanligaste orsaken till att handlingsutrymme går förlorat. Aviseringarna finns för att det inte ska hända.",
    saves: "Vilken nivå du valt och vilka kanaler som är på – e-post, in-app och SMS.",
    manage: "Byt nivå eller stäng av en kanal här. SMS kräver Professional eller Enterprise.",
    synonyms: ["avisering", "sms", "notiser", "påminnelser", "larm", "sms-aviseringar"],
  },
  {
    id: "kontrollbalans",
    label: "Kontrollbalansräkning",
    route: "/kbr",
    anchor: "kbr-modulen",
    navAnchor: null,
    why: "Skyldigheten inträder redan vid skäl att anta att mer än halva aktiekapitalet är förbrukat – alltså innan det syns i betalningarna. Ett daterat beslut är i sig ett skydd för styrelsen.",
    saves: "Bedömningen, siffrorna den vilar på och datumet den gjordes.",
    manage: "Du kan göra om bedömningen när siffrorna ändrats; den gamla ligger kvar i loggen.",
    synonyms: ["kontrollbalansräkning", "kbr", "aktiekapital", "kapitalbrist", "styrelseansvar"],
  },
  {
    id: "radgivare",
    label: "Rådgivare",
    route: "/marketplace",
    anchor: "radgivarkatalogen",
    navAnchor: null,
    why: "Vissa beslut kräver någon som får rådge – CLEARANCE strukturerar och dokumenterar, men lämnar inte juridiska råd.",
    saves: "Dina förfrågningar och vilka rådgivare som svarat.",
    manage: "Du väljer själv vem du kontaktar; en förfrågan kan dras tillbaka.",
    synonyms: ["rådgivare", "jurist", "advokat", "rekonstruktör", "hjälp", "hitta hjälp"],
  },
  {
    id: "alternativ",
    label: "Handlingsalternativ",
    route: "/dashboard/alternativ",
    anchor: "alternativvyn",
    navAnchor: null,
    why: "Alternativen krymper i takt med kassan. Att se dem bredvid varandra, med vad var och en kräver, gör valet till ett beslut i stället för en följd av att tiden gick ut.",
    saves: "Vilka vägar som är öppna, vad de kräver och vad de kostar i tid.",
    manage: "Listan räknas om när siffrorna ändras – den speglar alltid dagens läge.",
    synonyms: ["alternativ", "vägar", "vad kan jag göra", "rekonstruktion eller konkurs", "möjligheter"],
  },
];

export const guideEntry = (id: string): GuideEntry | null =>
  GUIDE_CATALOGUE.find((e) => e.id === id) ?? null;

/**
 * De fyra svaren, som text.
 *
 * Ordningen är principens: vad som hände, varför, var det finns, hur du
 * ändrar det. Att bryta ordningen är att svara på en fråga användaren
 * inte hunnit ställa.
 */
export const entryBriefing = (entry: GuideEntry): { label: string; text: string }[] => [
  { label: "Vad det är", text: entry.label },
  { label: "Varför det finns", text: entry.why },
  { label: "Vad som sparas här", text: entry.saves },
  { label: "Hur du ändrar det", text: entry.manage },
];
