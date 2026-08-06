/**
 * INTEGRITETSPOLICYN OCH VILLKOREN, SOM DATA.
 *
 * Texterna ligger här och inte i JSX av samma skäl som all annan
 * användartext i produkten: en mening som ska granskas av en jurist ska
 * gå att läsa utan att läsa runt taggar, och testerna ska kunna pröva vad
 * som faktiskt står.
 *
 * TVÅ SAKER SOM MÅSTE SÄGAS RAKT UT:
 *
 * 1. Det här är ett UTKAST skrivet av den som byggt systemet, inte av en
 *    jurist. Det beskriver sanningsenligt vad koden faktiskt gör - vilka
 *    uppgifter som samlas in, var de hamnar och hur länge de ligger kvar -
 *    men formuleringarna är inte granskade mot dataskyddsförordningen av
 *    någon med den kompetensen. Sidan säger det själv, överst, och det
 *    ska stå kvar tills granskningen är gjord.
 *
 * 2. Flera uppgifter är ännu inte bestämda: personuppgiftsbiträdesavtalet
 *    med driftleverantören, gallringsfristerna och kontaktvägen för
 *    registerutdrag. De står som ÖPPNA, inte som påhittade svar. En
 *    policy som anger "vi sparar uppgifterna i 24 månader" när ingen
 *    bestämt något är värre än en som säger att frågan är öppen: den
 *    första är ett löfte till användaren som ingen kan hålla.
 */

export interface LegalSection {
  title: string;
  /** Brödtext. Varje stycke en sträng. */
  body: string[];
  /** Punktlista under brödtexten. */
  points?: string[];
  /** Sant när avsnittet beskriver ett beslut som inte är fattat. */
  open?: boolean;
}

export const DRAFT_NOTICE =
  "Det här är ett utkast, skrivet av oss som byggt tjänsten och ännu inte granskat av jurist. " +
  "Det beskriver vad systemet faktiskt gör. Punkter som ännu inte är beslutade är markerade som öppna " +
  "i stället för att fyllas med ett svar vi inte har.";

/* -------------------------------------------------------------------------- */
/* Integritetspolicy                                                          */
/* -------------------------------------------------------------------------- */

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: "Vem som ansvarar för uppgifterna",
    body: [
      "Landvex AB är personuppgiftsansvarig för de uppgifter du lämnar i Clearance. " +
        "Organisationsnummer och adress står i sidfoten på varje sida.",
      "Frågor om dina uppgifter lämnas via kontaktformuläret. Vi svarar till den adress du anger.",
    ],
  },
  {
    title: "Vad vi samlar in, och varför",
    body: [
      "Tjänsten är byggd för att strukturera ett bolags ekonomiska läge. Det innebär att " +
        "uppgifterna är känsliga i praktisk mening även när de inte är det i lagens mening: " +
        "att ett bolag utreder rekonstruktion är information som kan skada bolaget om den sprids.",
    ],
    points: [
      "Kontouppgifter: namn, e-postadress och lösenord. Lösenordet lagras aldrig i klartext.",
      "Bolagsuppgifter: företagsnamn och organisationsnummer, samt det som hämtas ur offentliga register på det numret.",
      "Det du berättar: svaren i introduktionssamtalet, nulägesanalysen, kontrollbalansräkningen och likviditetsplanen.",
      "Dokument du laddar upp, till exempel kontoutdrag och bokföringsfiler.",
      "Telefonnummer – endast om du själv väljer att aktivera SMS-aviseringar.",
      "Händelselogg: vem som gjorde vad i ärendet och när. Den är en del av produkten, inte spårning – ett krisärende ska gå att rekonstruera i efterhand.",
    ],
  },
  {
    title: "Rättslig grund",
    body: [
      "Behandlingen av kontot och ärendet vilar på avtalet med dig (art. 6.1 b). " +
        "Händelseloggen och säkerhetsloggarna vilar på vårt berättigade intresse av att kunna " +
        "visa vad som skett i ett ärende och att skydda tjänsten mot missbruk (art. 6.1 f).",
      "SMS-aviseringar bygger på ditt samtycke (art. 6.1 a) och går att återkalla när som helst " +
        "under Inställningar. Numret raderas då.",
    ],
  },
  {
    title: "Vad vi INTE gör",
    body: [
      "Analyserna räknas fram i vår egen miljö. Ingen ärendedata skickas till någon extern " +
        "modelltjänst för analys, och det är en teknisk egenskap hos systemet, inte en policy " +
        "vi kan ändra i tysthet – motorerna är deterministiska och prövas i din egen webbläsare " +
        "under Analysövervakning.",
      "Vi säljer inga uppgifter. Vi använder inga annonsnätverk och lägger inga spårningsskript " +
        "på sidorna; att inga anrop går till tredje part kontrolleras av en testsvit vid varje ändring.",
    ],
  },
  {
    title: "Vem mer som ser uppgifterna",
    body: [
      "Du bestämmer vilka som får åtkomst till ditt ärende. Bjuder du in en revisor, jurist, " +
        "rekonstruktör eller kollega ser de det du delar med dem, och varje åtkomst loggas.",
      "Vår drift kan se administrativa uppgifter – konto, fakturor och utskick – för att kunna " +
        "sköta tjänsten. Databasens åtkomstregler prövas vid varje ändring av en egen testsvit.",
    ],
  },
  {
    title: "Var uppgifterna finns",
    body: [
      "Driftmiljön är konfigurerad för en region inom EU (Stockholm). Ingen del av tjänsten är " +
        "avsedd att flytta uppgifter ut ur EU/EES.",
    ],
  },
  {
    title: "Personuppgiftsbiträden",
    body: [
      "Tjänsten drivs hos en molnleverantör och skickar e-post och SMS via leverantörer. " +
        "Vilka de är, och de biträdesavtal som krävs enligt art. 28, är inte klara ännu.",
      "Den fullständiga förteckningen publiceras här innan tjänsten öppnas för betalande kunder.",
    ],
    open: true,
  },
  {
    title: "Hur länge uppgifterna sparas",
    body: [
      "Vi raderar aldrig ditt material för att en faktura är obetald – ett stängt konto är " +
        "utestängt, inte tömt. Det är ett medvetet beslut: ett bolag mitt i en rekonstruktion " +
        "har ofta sin enda samlade dokumentation här.",
      "Fakturaunderlag måste sparas i sju år enligt bokföringslagen. Gallringsfristerna för " +
        "ärendematerial och konton är däremot inte fastställda ännu.",
    ],
    open: true,
  },
  {
    title: "Dina rättigheter",
    body: [
      "Du har rätt att få veta vilka uppgifter vi har om dig, att få dem rättade, att få dem " +
        "raderade när vi inte längre har grund att spara dem, att invända mot behandling som " +
        "vilar på berättigat intresse, och att få ut dina uppgifter i ett maskinläsbart format.",
      "Ärendets händelselogg går redan att exportera från Händelser i din inloggning.",
      "Är du inte nöjd med hur vi hanterar dina uppgifter kan du klaga hos Integritetsskyddsmyndigheten (IMY).",
    ],
  },
  {
    title: "Kakor och lokal lagring",
    body: [
      "Vi använder inga kakor för analys eller annonsering. Det som lagras i din webbläsare är " +
        "din inloggningssession och ditt påbörjade arbete: halvfärdiga guider och ett avbrutet " +
        "introduktionssamtal sparas lokalt så att en omladdning inte kastar bort det.",
      "Det lokala arbetsmaterialet raderas när du loggar ut. Dina läsinställningar, som språknivå, " +
        "ligger kvar – de säger något om hur du vill läsa, inte något om ditt bolag.",
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Användarvillkor                                                            */
/* -------------------------------------------------------------------------- */

export const TERMS_SECTIONS: LegalSection[] = [
  {
    title: "Vad Clearance är – och inte är",
    body: [
      "Clearance är ett administrativt hjälpmedel. Tjänsten hjälper dig att strukturera " +
        "bolagets läge, räkna på det, bevaka frister och samla dokumentationen.",
      "Tjänsten lämnar INTE juridisk, ekonomisk eller skatterättslig rådgivning. Bedömningarna " +
        "bygger på de uppgifter du själv anger och är ett underlag för beslut, inte ett beslut. " +
        "Du ansvarar för de beslut du fattar, och för att stämma av din situation med behörig " +
        "rådgivare innan du fattar dem.",
      "Att en beräkning i tjänsten pekar åt ett håll ersätter inte styrelsens eget ansvar enligt " +
        "aktiebolagslagen.",
    ],
  },
  {
    title: "Ditt konto",
    body: [
      "Kontot är personligt. Du ansvarar för ditt lösenord och för vilka du bjuder in till ditt ärende.",
      "Du ansvarar för att de uppgifter du lämnar är riktiga. En analys som vilar på fel siffror " +
        "blir fel, och det är inte något tjänsten kan upptäcka åt dig.",
    ],
  },
  {
    title: "Priser och betalning",
    body: [
      "Aktuella priser visas i tjänsten. Alla belopp anges exklusive moms om inget annat framgår.",
      "Fakturan har tio dagars betalningsvillkor. Dröjsmålsränta enligt räntelagen (1975:635) 6 § " +
        "utgår efter förfallodagen.",
      "Betalas fakturan inte pausas åtkomsten till innehållet. Vi raderar ingenting – materialet " +
        "blir tillgängligt igen så snart betalningen registrerats.",
    ],
  },
  {
    title: "Uppsägning",
    body: [
      "Det finns ingen bindningstid. Du kan säga upp abonnemanget när som helst och behåller " +
        "åtkomsten under den period du betalat för.",
      "Innan du avslutar bör du exportera det du vill behålla. Rapporterna går att spara som PDF " +
        "och händelseloggen går att exportera.",
    ],
  },
  {
    title: "Tillgänglighet",
    body: [
      "Vi strävar efter att tjänsten ska vara tillgänglig, men lämnar ingen garanti om drifttid. " +
        "Planerade avbrott aviseras i förväg när det är möjligt.",
      "Tjänsten befinner sig i en tidig fas. Funktioner kan ändras, och sådant som ännu inte är " +
        "kopplat till en riktig källa är märkt som det i gränssnittet i stället för att visas som klart.",
    ],
  },
  {
    title: "Ansvarsbegränsning",
    body: [
      "Vårt ansvar är begränsat till vad som följer av tvingande lag. Vi ansvarar inte för " +
        "indirekt skada, utebliven vinst eller följder av beslut du fattat med tjänsten som underlag.",
      "Den här punkten är särskilt beroende av juridisk granskning innan tjänsten öppnas för " +
        "betalande kunder.",
    ],
    open: true,
  },
  {
    title: "Tillämplig lag",
    body: [
      "Svensk lag tillämpas. Tvist prövas av svensk allmän domstol.",
    ],
  },
];
