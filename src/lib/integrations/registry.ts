/**
 * Registret över externa kopplingar.
 *
 * Samma princip som PROVIDER_REGISTRY i src/lib/financial/ports.ts: varje
 * mål är beskrivet med ärlig status INNAN någon integration byggs, så att
 * ordningen väljs på fakta och inte på vilken logotyp som ser bäst ut på en
 * bild. Tre statusnivåer, och skillnaden mellan dem är hela poängen:
 *
 *  - "fil": fungerar idag, utan avtal. Användaren exporterar en fil ur
 *    motpartens system och läser in den här (eller tvärtom). Ingen part
 *    behöver ge oss någonting.
 *  - "avtal": tekniken finns (API, OAuth) men kräver partneravtal,
 *    API-nycklar eller registrering hos motparten innan en rad kod är
 *    meningsfull att skriva.
 *  - "blockerad": får inte byggas förrän ett namngivet beslut är fattat -
 *    tillstånd, juridisk bedömning eller ett uttryckligt undantag från
 *    principen om inga yttre beroenden. Se docs/VISION.md.
 *
 * Fält märkta ANTAGANDE är inte verifierade mot motparten och ska stämmas
 * av innan de används i avtal eller marknadsföring.
 */

export type IntegrationStatus = "fil" | "avtal" | "blockerad";

export type IntegrationCategory =
  | "bokforing"
  | "kreditgivare"
  | "advokatsystem"
  | "myndighet"
  | "bank"
  | "identitet";

export interface IntegrationTarget {
  id: string;
  name: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  /** Vad kopplingen konkret gör för användaren. */
  value: string;
  /** Vad som är byggt idag. Tom sträng = ingenting. */
  builtToday: string;
  /** Vad som krävs för nästa steg, med den som äger beslutet. */
  nextStep: string;
  assumptions?: string[];
}

export const INTEGRATION_REGISTRY: IntegrationTarget[] = [
  /* ------------------------------ Myndigheter ---------------------------- */
  {
    id: "skatteverket-skattekonto",
    name: "Skatteverket – skattekontot",
    category: "myndighet",
    status: "fil",
    value:
      "Skattekontots transaktioner in i ärendet. Skatteskulden är nästan alltid " +
      "den frist som avgör företrädaransvaret, och idag skrivs den av manuellt.",
    builtToday:
      "Filimport: parsern i src/lib/integrations/skattekonto.ts läser " +
      "skattekontoutdraget som e-tjänsten exporterar, lokalt i webbläsaren.",
    nextStep:
      "Inget API finns för ombud utan Skatteverkets ombudsbehörighet " +
      "(deklarationsombud). Filvägen är den realistiska nivån tills vidare.",
    assumptions: [
      "ANTAGANDE: exportformatet (semikolonseparerad text med datum, " +
        "specifikation och belopp) är avläst ur e-tjänstens utdrag och kan " +
        "ändras av Skatteverket utan förvarning - parsern matchar därför " +
        "rubriker, inte kolumnpositioner.",
    ],
  },
  {
    id: "bolagsverket",
    name: "Bolagsverket – företagsinformation",
    category: "myndighet",
    status: "avtal",
    value:
      "Företagsuppgifter, firmateckning och registreringsstatus hämtas i " +
      "stället för att skrivas in. CompanyLookupPort i src/data/ports.ts är " +
      "redan kontraktet.",
    builtToday: "Porten finns; ingen adapter mot Bolagsverkets API.",
    nextStep:
      "Registrering för Bolagsverkets API-tjänster (vissa är avgiftsbelagda). " +
      "Ägare: Landvex.",
  },
  {
    id: "kronofogden",
    name: "Kronofogden",
    category: "myndighet",
    status: "fil",
    value:
      "Betalningsförelägganden och utmätningsuppgifter hör hemma i ärendets " +
      "tidslinje - de är ofta den verkliga klockan.",
    builtToday: "",
    nextStep:
      "Inget öppet ärende-API finns. Realistisk nivå idag: beslut och " +
      "förelägganden laddas upp som handlingar och fristerna registreras " +
      "för hand - det fungerar, men är manuellt och ska inte kallas en " +
      "koppling.",
  },

  /* ------------------------------ Advokatbyråer -------------------------- */
  {
    id: "advokatsystem-akt",
    name: "Advokatbyråsystem – aktexport",
    category: "advokatsystem",
    status: "fil",
    value:
      "Byrån får hela ärendet som en strukturerad akt i stället för en pärm: " +
      "ärendedata, frister, handlingar och korrespondens i ett paket som " +
      "deras system kan arkivera.",
    builtToday:
      "buildCaseBundle() i src/lib/integrations/caseBundle.ts: JSON-manifest " +
      "med ärende, betalningar, frister, dokumentlista och meddelanden.",
    nextStep:
      "Direktkopplingar per system kräver partneravtal med respektive " +
      "leverantör. Aktexporten är formatet de kopplingarna ska återanvända.",
    assumptions: [
      "ANTAGANDE: vilka system som dominerar bland svenska obeståndsbyråer " +
        "(t.ex. Maat, Saturnus, Kleos) är inte kartlagt mot riktiga byråer. " +
        "Fråga de första anslutna rådgivarna vad de faktiskt använder innan " +
        "något partneravtal söks.",
    ],
  },
  {
    id: "arendesystem-api",
    name: "Ärendesystem – direktsynk (API)",
    category: "advokatsystem",
    status: "avtal",
    value:
      "Akten och fristerna synkas automatiskt in i byråns befintliga " +
      "ärendesystem, i stället för att exporteras som fil.",
    builtToday:
      "Filvägen är byggd och är formatet synken ska återanvända: akten som " +
      "JSON (src/lib/integrations/caseBundle.ts) och fristkalendern som ICS, " +
      "samlad över alla ärenden i praktikervyn.",
    nextStep:
      "Partneravtal med leverantörerna av byråsystem. ANTAGANDE: vilka API:er " +
      "systemen exponerar varierar per leverantör och är inte verifierat.",
  },
  {
    id: "advokatsystem-frister",
    name: "Fristkalender (iCalendar)",
    category: "advokatsystem",
    status: "fil",
    value:
      "Ärendets lagstadgade frister som .ics-fil - importeras av Outlook, " +
      "Google Calendar och varje advokatsystem med kalender. En missad frist " +
      "är den dyraste händelsen i hela processen.",
    builtToday: "timelineToIcs() i src/lib/integrations/caseBundle.ts.",
    nextStep: "Klart att använda. Prenumerationsflöde (löpande synk) kräver API:et i AWS.",
  },

  /* ------------------------------ Kreditgivare --------------------------- */
  {
    id: "kreditunderlag",
    name: "Kreditunderlag till finansiärer",
    category: "kreditgivare",
    status: "fil",
    value:
      "Ett komplett, källmärkt kreditunderlag ur data som redan finns i " +
      "ärendet: läge, likviditetsprognos, skuldbild, säkerheter. Företaget " +
      "fyller i uppgifterna en gång.",
    builtToday:
      "buildCreditDossier() i src/lib/integrations/creditDossier.ts: " +
      "strukturerat paket plus utskrivbart dokument på rapportmotorn.",
    nextStep:
      "Underlaget är ett dokument företaget själv skickar. Se blockeringen " +
      "nedan innan någon förmedling byggs.",
  },
  {
    id: "kreditformedling",
    name: "Kreditförmedling (utskick till flera finansiärer)",
    category: "kreditgivare",
    status: "blockerad",
    value: "Ett underlag, flera mottagare, svar på ett ställe.",
    builtToday: "",
    nextStep:
      "BLOCKERAD tills juridisk bedömning av tillståndsfrågor (FI) och " +
      "medverkansansvar är gjord - ny skuld till ett bolag nära obestånd kan " +
      "skada borgenärerna, och plattformen får producera underlag men aldrig " +
      "rekommendera kredit. Beslut och dokumentation: se docs/VISION.md.",
  },

  {
    id: "creditsafe",
    name: "Creditsafe – kreditbevakning",
    category: "kreditgivare",
    status: "avtal",
    value:
      "Daglig kreditstatus på det egna bolaget, in i ärendet. Ett sänkt " +
      "kreditbetyg är ofta den första yttre signalen på att läget uppfattas " +
      "utifrån - den ska synas här före den syns hos leverantörerna.",
    builtToday:
      "Tabellen (credit_monitoring), dygnskandidaterna " +
      "(credit_check_candidates, högst en slagning per bolag och dygn - " +
      "varje slagning kostar) och arbetarens --credit-läge finns. " +
      "API-anropet aktiveras när nyckeln lagts in i driftpanelen.",
    nextStep:
      "Kundavtal med Creditsafe och API-uppgifter, som läggs in under " +
      "Drift > Driftpanel. Ägare: Landvex.",
    assumptions: [
      "ANTAGANDE: anropsformatet i arbetaren är skrivet mot Creditsafe " +
        "Connect enligt publik dokumentation och MÅSTE verifieras mot " +
        "riktiga uppgifter innan skarp körning.",
    ],
  },

  /* ------------------------------ Bokföring ------------------------------ */
  {
    id: "fortnox",
    name: "Fortnox",
    category: "bokforing",
    status: "avtal",
    value: "Huvudbok, reskontra och verifikat direkt in i FinancialPort.",
    builtToday:
      "Hela domänmodellen (src/lib/financial/model.ts) och portkontraktet " +
      "finns; kontoutdrags-CSV fungerar som filväg. SIE-import finns INTE - " +
      "den vore den naturliga filvägen för bokföringsdata och är obyggd.",
    nextStep: "Fortnox developer-avtal och OAuth-registrering. Ägare: Landvex.",
  },
  {
    id: "visma",
    name: "Visma eEkonomi",
    category: "bokforing",
    status: "avtal",
    value: "Samma som Fortnox, via Visma:s API.",
    builtToday: "Samma kontrakt; ingen adapter.",
    nextStep: "Visma developer-avtal. Ägare: Landvex.",
  },

  /* ------------------------------ Bank och identitet --------------------- */
  {
    id: "psd2",
    name: "Bankdata (PSD2/open banking)",
    category: "bank",
    status: "blockerad",
    value: "Kontosaldon och transaktioner utan manuell export.",
    builtToday: "Kontoutdrags-CSV-importen täcker behovet manuellt.",
    nextStep:
      "BLOCKERAD: kräver AISP-tillstånd hos FI eller en licensierad " +
      "aggregator - båda är yttre beroenden som bryter mot produktens " +
      "grundprincip och måste beslutas som uttryckligt undantag.",
  },
  {
    id: "bankid",
    name: "BankID (signering)",
    category: "identitet",
    status: "avtal",
    value:
      "Signering av styrelseprotokoll, fullmakter och ansökningar - de " +
      "dokument dokumentmotorn producerar.",
    builtToday: "",
    nextStep:
      "Avtal via bank eller återförsäljare. Redan noterat i db/README.md som " +
      "det oundvikliga undantaget.",
  },
];

/** Det som går att använda idag, utan att vänta på någon annan. */
export const availableNow = (): IntegrationTarget[] =>
  INTEGRATION_REGISTRY.filter((t) => t.status === "fil" && t.builtToday !== "");

/** Det som väntar på ett namngivet beslut. */
export const blocked = (): IntegrationTarget[] =>
  INTEGRATION_REGISTRY.filter((t) => t.status === "blockerad");
