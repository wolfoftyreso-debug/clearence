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

import type { UserRole } from "@/data/types";

/**
 * Vem en funktion finns för.
 *
 * "ops" är INTE en användarroll i datamodellen - behörigheten kommer ur
 * `app.is_admin()`, inte ur profilen, och en driftanvändare är dessutom
 * alltid också företagare eller rådgivare. Katalogen behöver ändå kunna
 * skilja driftvyerna från produkten, och därför är publiken ett eget
 * begrepp här i stället för en påhittad tredje UserRole. Att låtsas att
 * det finns en admin-roll i datamodellen hade varit en lögn som förr
 * eller senare hamnat i en behörighetskontroll.
 */
export type GuideAudience = UserRole | "ops";

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
   * Menyvalet som leder dit, PER ROLL. Ringas in på vägen, så att
   * användaren ser vilken väg som togs och kan gå den själv nästa gång.
   *
   * Per roll, för att menyerna skiljer sig åt: en jurist når
   * likviditeten och handlingarna genom det aktiva ärendet, men har
   * inga egna menyval för dem. Ett menyval som ringas in för någon som
   * inte har det pekar på ingenting - och det är precis den sortens
   * tomma anvisning principen finns för att förhindra. Saknas rollen i
   * posten hoppar guiden över menysteget och går rakt till vyn.
   */
  navAnchor: Partial<Record<GuideAudience, string>>;
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
  /**
   * Rollerna funktionen finns för.
   *
   * Utan det här fältet hade katalogen blivit sämre av att växa: en
   * företagare som skriver "visa mig mina klienter" hade letts till
   * juristens ärendelista och landat på en tom sida. Att peka någon mot
   * en yta hen inte kan använda är precis det principen finns för att
   * förhindra - guiden ska ta bort letandet, inte flytta det.
   */
  roles: GuideAudience[];
}

const BOTH: GuideAudience[] = ["company", "advisor"];

export const GUIDE_CATALOGUE: GuideEntry[] = [
  {
    id: "kontrollomrade",
    label: "Kontrolläget",
    route: "/dashboard",
    anchor: "kontrollomrade",
    navAnchor: { company: "nav-oversikt", advisor: "nav-oversikt" },
    why: "Det största hotet i en företagskris är sällan siffrorna i sig – det är att missa ett datum eller att inte kunna visa att man agerat. Panelen svarar på om systemet håller uppsikt åt dig.",
    saves: "Vad som bevakas, vad som saknas, och spåret som visar att du agerat.",
    manage: "Raderna under Detta saknas länkar dit saken åtgärdas. Bevakningen sköter sig själv.",
    synonyms: ["kontrollområde", "kontrolläge", "bevakning", "vad bevakas", "håller ni koll"],
    roles: BOTH,
  },
  {
    id: "handlingsplan",
    label: "Handlingsplanen",
    route: "/dashboard",
    anchor: "handlingsplan",
    navAnchor: { company: "nav-oversikt", advisor: "nav-oversikt" },
    why: "Den samlar det som ska göras i den ordning fristerna kräver, så att du slipper hålla ordningen i huvudet.",
    saves: "Uppgifterna, vem de är delegerade till, och när de bockades av.",
    manage: "Varje rad leder in i verktyget som löser den. Du kan lägga till egna punkter och delegera dem.",
    synonyms: ["handlingsplan", "att göra", "uppgifter", "vad ska jag göra", "nästa steg"],
    roles: BOTH,
  },
  {
    id: "likviditet",
    label: "Likviditet",
    route: "/dashboard/liquidity",
    anchor: "likviditetsvyn",
    navAnchor: { company: "nav-likviditet" },
    why: "Kassan avgör vilka alternativ som finns kvar. En rekonstruktion kräver likviditet för driften under processen – därför är dagen kassan tar slut den viktigaste siffran i hela ärendet.",
    saves: "Prognosen, de bevakade betalningarna och nyckeltalen med sina förbehåll.",
    manage: "Lägg till eller ändra betalningar i planeraren; kurvan och nyckeltalen räknas om direkt.",
    synonyms: ["likviditet", "kassa", "prognos", "runway", "pengar", "kassaflöde"],
    roles: BOTH,
  },
  {
    id: "dokument",
    label: "Dokument",
    route: "/dashboard/dokument",
    anchor: "dokumentvyn",
    navAnchor: { company: "nav-dokument" },
    why: "Allt som produceras i ärendet hamnar här automatiskt. Att kunna visa handlingarna är halva tryggheten i en process.",
    saves: "Rapporter, protokoll, fakturor och underlag du laddat upp – med källa och datum.",
    manage: "Du kan ladda upp fler, byta status på ett dokument och ladda ner allt som PDF.",
    synonyms: ["dokument", "rapporter", "handlingar", "filer", "underlag", "akten", "var sparas rapporterna"],
    roles: BOTH,
  },
  {
    id: "handelselogg",
    label: "Händelseloggen",
    route: "/dashboard/handelser",
    anchor: "handelseloggen",
    navAnchor: { company: "nav-handelselogg" },
    why: "Loggen är tidsstämplad av databasen och går inte att ändra i efterhand. Den visar när styrelsen insåg något och när den agerade – användbart som bevisning.",
    saves: "Varje beslut, varje utskick och varje ändring i ärendet, i tidsordning.",
    manage: "Loggen kan inte redigeras – det är själva poängen. Den kan exporteras.",
    synonyms: ["händelselogg", "logg", "historik", "vad har hänt", "spår", "bevisning"],
    roles: BOTH,
  },
  {
    id: "deltagare",
    label: "Deltagare",
    route: "/dashboard/deltagare",
    anchor: "deltagarvyn",
    navAnchor: { company: "nav-deltagare" },
    why: "Rätt kompetens tidigt minskar risken för kostsamma felbeslut, och alla i ärendet ser samma underlag i stället för varsin version.",
    saves: "Vilka som är inbjudna, i vilken roll, och vad varje roll får se.",
    manage: "Bjud in fler, ändra roll eller återkalla en behörighet – allt härifrån.",
    synonyms: ["deltagare", "bjuda in", "revisor", "styrelse", "vem ser", "dela ärendet"],
    roles: BOTH,
  },
  {
    id: "meddelanden",
    label: "Meddelanden",
    route: "/dashboard/meddelanden",
    anchor: "meddelandevyn",
    navAnchor: { company: "nav-meddelanden", advisor: "nav-meddelanden" },
    why: "Samtalen om ärendet hålls i ärendet. Ett beslut som fattats i en mejltråd går inte att hitta när det behövs.",
    saves: "Alla meddelanden, bilagor och vem som uppfattat vad.",
    manage: "Skriv till en enskild deltagare eller hela gruppen; du kan tagga någon för att kalla in dem.",
    synonyms: ["meddelanden", "chatt", "skriva till", "kontakta deltagare"],
    roles: BOTH,
  },
  {
    id: "installningar",
    label: "Inställningar",
    route: "/dashboard/installningar",
    anchor: "installningsvyn",
    navAnchor: { company: "nav-installningar", advisor: "nav-installningar" },
    why: "Här styr du vad systemet gör åt dig utan att fråga – aviseringar, kanaler och abonnemang.",
    saves: "Dina val av aviseringsnivå och kanal, din profil och dina fakturor.",
    manage: "Allt på sidan går att ändra när som helst. Ett avstängt SMS slår igenom direkt.",
    // Aviseringsorden hör till posten nedan, inte hit. Två poster som
    // gör anspråk på samma ord kan inte skilja sig åt vid en sökning -
    // då blir träffen tvetydig och guiden tvingas fråga i stället för
    // att visa. Sidan är densamma; den specifika posten leder rätt.
    synonyms: ["inställningar", "abonnemang", "faktura", "mitt konto", "prenumeration"],
    roles: BOTH,
  },
  {
    id: "aviseringar",
    label: "Aviseringar",
    route: "/dashboard/installningar",
    anchor: "aviseringskanaler",
    navAnchor: { company: "nav-installningar", advisor: "nav-installningar" },
    why: "Ett datum som passerar medan du inte är inloggad är den vanligaste orsaken till att handlingsutrymme går förlorat. Aviseringarna finns för att det inte ska hända.",
    saves: "Vilken nivå du valt och vilka kanaler som är på – e-post, in-app och SMS.",
    manage: "Byt nivå eller stäng av en kanal här. SMS kräver Professional eller Enterprise.",
    synonyms: ["avisering", "sms", "notiser", "påminnelser", "larm", "sms-aviseringar"],
    roles: BOTH,
  },
  {
    id: "kontrollbalans",
    label: "Kontrollbalansräkning",
    route: "/kbr",
    anchor: "kbr-modulen",
    navAnchor: {},
    why: "Skyldigheten inträder redan vid skäl att anta att mer än halva aktiekapitalet är förbrukat – alltså innan det syns i betalningarna. Ett daterat beslut är i sig ett skydd för styrelsen.",
    saves: "Bedömningen, siffrorna den vilar på och datumet den gjordes.",
    manage: "Du kan göra om bedömningen när siffrorna ändrats; den gamla ligger kvar i loggen.",
    synonyms: ["kontrollbalansräkning", "kbr", "aktiekapital", "kapitalbrist", "styrelseansvar"],
    roles: BOTH,
  },
  {
    id: "radgivare",
    label: "Rådgivare",
    route: "/marketplace",
    anchor: "radgivarkatalogen",
    navAnchor: {},
    why: "Vissa beslut kräver någon som får rådge – CLEARANCE strukturerar och dokumenterar, men lämnar inte juridiska råd.",
    saves: "Dina förfrågningar och vilka rådgivare som svarat.",
    manage: "Du väljer själv vem du kontaktar; en förfrågan kan dras tillbaka.",
    synonyms: ["rådgivare", "jurist", "advokat", "rekonstruktör", "hjälp", "hitta hjälp"],
    roles: BOTH,
  },
  {
    id: "alternativ",
    label: "Handlingsalternativ",
    route: "/dashboard/alternativ",
    anchor: "alternativvyn",
    navAnchor: {},
    why: "Alternativen krymper i takt med kassan. Att se dem bredvid varandra, med vad var och en kräver, gör valet till ett beslut i stället för en följd av att tiden gick ut.",
    saves: "Vilka vägar som är öppna, vad de kräver och vad de kostar i tid.",
    manage: "Listan räknas om när siffrorna ändras – den speglar alltid dagens läge.",
    synonyms: ["alternativ", "vägar", "vad kan jag göra", "rekonstruktion eller konkurs", "möjligheter"],
    roles: BOTH,
  },
  {
    id: "samtalet",
    label: "Samtalet med CLEARANCE",
    route: "/dashboard/samtal",
    anchor: "samtalet",
    navAnchor: {},
    why: "Det är här du beskriver vad som hänt och får en bedömning tillbaka. Samtalet journalförs i ärendet, så en fråga du ställde i mars går att hitta i september.",
    saves: "Hela samtalet som journal, och de bedömningar du valt att protokollföra som beslut.",
    manage: "Du kan avsluta en session när som helst; journalen ligger kvar och nästa samtal börjar med en sammanfattning av vad som hänt sedan sist.",
    synonyms: ["samtal", "prata", "fråga clearance", "rådgivaren", "krisrådgivare"],
    roles: BOTH,
  },
  {
    id: "nulagesanalys",
    label: "Nulägesanalysen",
    route: "/wizard",
    anchor: "wizard-start",
    navAnchor: {},
    why: "Fyra frågor om löner, skatt, hyra och leverantörer avgör vilka verktyg som finns kvar. Utan dem vilar allt annat i produkten på antaganden i stället för på ditt bolag.",
    saves: "Svaren, beloppen, förfallodagarna och den bedömning de leder till.",
    manage: "Gör om analysen när siffrorna ändrats – den gamla ligger kvar i händelseloggen så att förändringen syns.",
    synonyms: ["nulägesanalys", "utvärdering", "guiden", "analysen", "börja om"],
    roles: BOTH,
  },
  {
    id: "systemanalysen",
    label: "Systemanalysen",
    route: "/dashboard",
    anchor: "systemanalysen",
    navAnchor: { company: "nav-oversikt", advisor: "nav-oversikt" },
    why: "Rapporten som en erfaren rekonstruktör hade skrivit efter att ha satt sig in i bolaget: hur allvarligt det är, vad det betyder, vad som måste göras nu och vilken väg som rekommenderas – alltid motiverad.",
    saves: "Lägesbilden, riskerna, möjligheterna och den rekommenderade strategin, byggda ur ärendets egna uppgifter.",
    manage: "Rapporten räknas om varje gång underlaget ändras. Den kan tas ut som PDF och delas.",
    synonyms: ["systemanalys", "lägesrapport", "rapporten", "sammanfattning", "hur ser det ut"],
    roles: BOTH,
  },
  {
    id: "likviditetsplan",
    label: "Likviditetsplaneraren",
    route: "/likviditetsplan",
    anchor: "likviditetsplaneraren",
    navAnchor: {},
    why: "Det är här kurvan får sina siffror. En prognos som ingen matat är bara en rak linje, och en rak linje ger inga beslut.",
    saves: "Startsaldo, väntade in- och utbetalningar och de scenarier du lagt in.",
    manage: "Planen sparas medan du fyller i och går att ändra när som helst – kurvan och nyckeltalen räknas om direkt.",
    synonyms: ["likviditetsplanering", "lägga in betalningar", "budget", "planera kassan"],
    roles: ["company"],
  },
  {
    id: "kreditunderlag",
    label: "Kreditunderlag",
    route: "/dashboard/kreditunderlag",
    anchor: "kreditunderlagsvyn",
    navAnchor: { company: "nav-dokument" },
    why: "En bank eller finansiär vill se siffror, säkerheter och plan i ett dokument, inte i sex bilagor. Att kunna lämna det samma dag är ofta skillnaden mellan ett besked och en väntan.",
    saves: "Sammanställningen och när den togs fram.",
    manage: "Ta fram ett nytt underlag när siffrorna ändrats; varje version hamnar bland handlingarna.",
    synonyms: ["kreditunderlag", "underlag till banken", "finansiär", "låna", "kreditansökan"],
    roles: ["company"],
  },
  {
    id: "dokumentmallar",
    label: "Dokumentmallar",
    route: "/dashboard/dokument",
    anchor: "dokumentmallar",
    navAnchor: { company: "nav-dokument" },
    why: "Styrelseprotokoll och kallelser måste se ut på ett visst sätt för att hålla. Mallarna är ifyllda med ärendets uppgifter, så att formen inte blir det som fördröjer beslutet.",
    saves: "De handlingar du skapar, med status och datum.",
    manage: "En handling kan gå från utkast till granskning till godkänd, och en rådgivare i ärendet kan stämpla den.",
    synonyms: ["mallar", "protokoll", "kallelse", "styrelseprotokoll", "upprätta handling"],
    roles: ["company"],
  },
  {
    id: "skattekonto",
    label: "Skattekontoutdrag",
    route: "/dashboard/dokument",
    anchor: "skattekontoutdrag",
    navAnchor: { company: "nav-dokument" },
    why: "Skatten har egna förfallodagar och det är dem företrädaransvaret hänger på. Läser du in utdraget hamnar de i bevakningen i stället för i minnet.",
    saves: "De kommande debiteringarna som betalningar i likviditetsplanen.",
    manage: "Filen tolkas i din webbläsare och skickas ingenstans. Läs in ett nytt utdrag när det kommit fler poster.",
    synonyms: ["skattekonto", "skatteverket", "kontoutdrag", "importera skatt"],
    roles: ["company"],
  },
  {
    id: "arendelank",
    label: "Live ärendelänk",
    route: "/dashboard/deltagare",
    anchor: "arendelank",
    navAnchor: { company: "nav-deltagare" },
    why: "En rådgivare som ska titta snabbt ska inte behöva ett konto. Länken visar en levande vy av ärendet på den nivå du bestämmer, och varje öppning loggas.",
    saves: "Vilka länkar som finns, vad de visar och vem som öppnat dem när.",
    manage: "En länk kan när som helst stängas av. Nivån bestämmer du när du skapar den.",
    synonyms: ["ärendelänk", "dela länk", "visa för någon utan konto", "extern granskare"],
    roles: ["company"],
  },
  {
    id: "avsluta-arendet",
    label: "Avsluta ärendet",
    route: "/dashboard",
    anchor: "avsluta-arendet",
    navAnchor: { company: "nav-oversikt" },
    why: "Ett ärende som aldrig avslutas fortsätter bevaka datum som inte längre gäller. Att stänga det med en angiven orsak gör dessutom att bevakningen kan fortsätta i ett lugnare läge om bolaget klarade sig.",
    saves: "Avslutsdatumet, orsaken och om ärendet går över i hälsobevakning.",
    manage: "Ett avslutat ärende kan öppnas igen. Handlingarna och loggen ligger kvar oavsett.",
    synonyms: ["avsluta", "stänga ärendet", "klar", "avslut"],
    roles: ["company"],
  },
  {
    id: "fakturor",
    label: "Fakturor och kvitton",
    route: "/dashboard/installningar",
    anchor: "fakturor",
    navAnchor: { company: "nav-installningar", advisor: "nav-installningar" },
    why: "Fakturorna ligger kvar i tjänsten så att du aldrig behöver leta i mejlen efter ett kvitto till bokföringen.",
    saves: "Varje faktura med specifikation, moms och betalningsreferens.",
    manage: "Öppna som PDF, lägg i ärendets handlingar eller skicka vidare till den som bokför.",
    synonyms: ["kvitton", "mina fakturor", "vad har jag betalat", "bokföringsunderlag"],
    roles: BOTH,
  },
  {
    id: "api-nycklar",
    label: "API-nycklar",
    route: "/dashboard/installningar",
    anchor: "api-nycklar",
    navAnchor: { company: "nav-installningar", advisor: "nav-installningar" },
    why: "För den som vill läsa ärendet från ett eget system i stället för att logga in. Nyckeln visas en enda gång när den skapas.",
    saves: "Nyckelns namn och när den skapades – aldrig nyckeln själv.",
    manage: "En nyckel kan bytas ut eller återkallas när som helst; den gamla slutar gälla direkt.",
    synonyms: ["api", "nyckel", "integration", "koppla eget system"],
    roles: BOTH,
  },
  {
    id: "kunskap",
    label: "Kunskap",
    route: "/kunskap",
    anchor: "kunskapsbanken",
    navAnchor: {},
    why: "Reglerna förklarade med källhänvisningar: vad lagen säger, vilka datum som styr och vad vägarna innebär. Att förstå en frist är att kunna prioritera den.",
    saves: "Ingenting – det är läsning. Det du gör med den hamnar i ärendet.",
    manage: "Artiklarna uppdateras med lagändringar; varje påstående bär sitt lagrum så att du kan kontrollera det.",
    synonyms: ["kunskap", "läsa om", "vad säger lagen", "regler", "artiklar"],
    roles: BOTH,
  },
  {
    id: "klienter",
    label: "Klienter",
    route: "/arenden",
    anchor: "klientlistan",
    navAnchor: { advisor: "nav-klienter" },
    why: "Uppdragen sorterade efter vad som brådskar, inte efter när de kom in. Den klient vars frist går ut först ligger överst.",
    saves: "Vilka ärenden du har tillgång till, deras läge och när något ändrades.",
    manage: "Välj ett ärende för att göra det aktivt – hela inloggade läget följer då med dit.",
    synonyms: ["klienter", "uppdrag", "mina ärenden", "klientlista"],
    roles: ["advisor"],
  },
  {
    id: "forfragningar",
    label: "Mina förfrågningar",
    route: "/mina-forfragningar",
    anchor: "forfragningarna",
    navAnchor: { advisor: "nav-forfragningar" },
    why: "Bolag som söker hjälp landar här. En förfrågan du inte svarat på syns tydligt, eftersom den som frågar oftast har bråttom.",
    saves: "Förfrågningarna, vilka du låst upp och månadens förmedlingsfaktura.",
    manage: "Lås upp ett ärende för att se det i sin helhet; fakturan specificeras per förmedling.",
    synonyms: ["förfrågningar", "leads", "nya uppdrag", "förmedlingar"],
    roles: ["advisor"],
  },
  {
    id: "byraprofil",
    label: "Byråprofil och team",
    route: "/byraprofil",
    anchor: "byraprofilen",
    navAnchor: { advisor: "nav-byraprofil" },
    why: "Profilen är det bolagen ser när de väljer rådgivare. Den som beskriver sin inriktning konkret får färre men mer relevanta förfrågningar.",
    saves: "Byråns beskrivning, inriktning, kontaktuppgifter och vilka i teamet som har tillgång.",
    manage: "Redigera profilen och bjud in kollegor härifrån; varje inbjudan kan återkallas.",
    synonyms: ["byråprofil", "min profil", "teamet", "kollegor", "vår presentation"],
    roles: ["advisor"],
  },
  {
    id: "driftpanel",
    label: "Driftpanel",
    route: "/admin",
    anchor: "driftpanelen",
    navAnchor: { ops: "nav-drift" },
    why: "Tjänstens eget nuläge på en yta: vad som körts, vad som fastnat och vad som väntar. Ett fel i en bakgrundskörning märks annars först när en kund hör av sig.",
    saves: "Körningarnas status och de nycklar som integrationerna använder.",
    manage: "Kör om en misslyckad körning eller byt ut en nyckel härifrån.",
    synonyms: ["driftpanel", "drift", "systemstatus", "körningar"],
    roles: ["ops"],
  },
  {
    id: "inkorg",
    label: "Inkorg",
    route: "/admin/inkorg",
    anchor: "inkorgen",
    navAnchor: { ops: "nav-inkorg" },
    why: "Kontaktförfrågningar som kommit in utan att gå via ett ärende. En obesvarad rad här är oftast någon som just nu letar efter hjälp någon annanstans.",
    saves: "Meddelandet, avsändaren och när det togs om hand.",
    manage: "Markera som hanterad eller svara direkt; åtgärden hamnar i loggen.",
    synonyms: ["inkorg", "kontaktförfrågningar", "obesvarade meddelanden"],
    roles: ["ops"],
  },
  {
    id: "ansokningar",
    label: "Ansökningar",
    route: "/admin/ansokningar",
    anchor: "ansokningarna",
    navAnchor: { ops: "nav-ansokningar" },
    why: "Rådgivare som vill in i katalogen granskas innan de syns för bolag. Det är den kontrollen som gör katalogen värd något.",
    saves: "Ansökan, underlaget och beslutet med datum.",
    manage: "Godkänn eller avslå; ett avslag kan motiveras och skickas till den sökande.",
    synonyms: ["ansökningar", "granska rådgivare", "verifiering", "nya byråer"],
    roles: ["ops"],
  },
  {
    id: "driftkunder",
    label: "Kunder",
    route: "/admin/kunder",
    anchor: "kundvyn",
    navAnchor: { ops: "nav-kunder" },
    why: "Abonnemangen och deras läge. En kund vars konto håller på att låsas ska upptäckas här, inte av kunden själv.",
    saves: "Abonnemang, fakturor och betalningsstatus per kund.",
    manage: "Justera abonnemang och registrera betalningar – ett låst konto låses upp härifrån.",
    // "abonnemang" ägs av användarens EGNA inställningar. Driftvyn
    // handlar om alla kunders abonnemang, och två poster som gör
    // anspråk på samma ord kan inte skiljas åt vid en sökning.
    synonyms: ["kundregister", "betalande kunder", "kundlista", "vem betalar"],
    roles: ["ops"],
  },
  {
    id: "driftforetag",
    label: "Företag",
    route: "/admin/foretag",
    anchor: "foretagsvyn",
    navAnchor: { ops: "nav-foretag" },
    why: "Alla bolag i tjänsten med sitt läge. Ger svaret på hur många som faktiskt är i kris just nu, och hur det förändras.",
    saves: "Bolagen, deras ärendestatus och när de senast var aktiva.",
    manage: "Vyn är läsande. Ändringar görs i ärendet, inte här.",
    synonyms: ["företag", "alla bolag", "bolagslista"],
    roles: ["ops"],
  },
  {
    id: "driftradgivare",
    label: "Rådgivare",
    route: "/admin/radgivare",
    anchor: "radgivarvyn",
    navAnchor: { ops: "nav-driftradgivare" },
    why: "Katalogens innehåll och hur den används: vilka som är verifierade, vilka som får förfrågningar och vilka som inte svarar.",
    saves: "Profilerna, verifieringsstatus och förmedlingshistoriken.",
    manage: "Verifiera, pausa eller ta bort en profil ur katalogen.",
    synonyms: ["rådgivarregister", "katalogen", "verifierade byråer"],
    roles: ["ops"],
  },
  {
    id: "statistik",
    label: "Statistik",
    route: "/admin/statistik",
    anchor: "statistikvyn",
    navAnchor: { ops: "nav-statistik" },
    why: "Hur tjänsten faktiskt används, inte hur den var tänkt att användas. Skillnaden mellan de två är det mesta av produktarbetet.",
    saves: "Ingenting nytt – vyn räknar på det som redan finns.",
    manage: "Perioden går att ändra; siffrorna räknas om direkt.",
    synonyms: ["statistik", "användning", "siffror om tjänsten", "nyckeltal drift"],
    roles: ["ops"],
  },
  {
    id: "analysovervakning",
    label: "Analysövervakning",
    route: "/admin/analys",
    anchor: "analysovervakningen",
    navAnchor: { ops: "nav-analys" },
    why: "Analysmotorn är deterministisk, men underlaget är det inte. Här syns ärenden där bedömningen vilar på tunt eller motstridigt underlag – innan någon fattar beslut på den.",
    saves: "Vilka ärenden som flaggats och varför.",
    manage: "Vyn är läsande. Åtgärden är att komplettera underlaget i ärendet.",
    synonyms: ["analysövervakning", "bevaka analyser", "tunt underlag"],
    roles: ["ops"],
  },
  {
    id: "loggar",
    label: "Loggar",
    route: "/admin/loggar",
    anchor: "loggvyn",
    navAnchor: { ops: "nav-loggar" },
    why: "Systemets egna spår: utskick, integrationsanrop och fel. Skiljt från ärendets händelselogg, som är bolagets och inte vår.",
    saves: "Tekniska händelser med tidsstämpel och resultat.",
    manage: "Loggen är läsande och kan filtreras på typ och period.",
    synonyms: ["systemloggar", "tekniska fel", "utskickslogg", "felsökning"],
    roles: ["ops"],
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
