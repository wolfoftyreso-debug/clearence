/**
 * RADERING OCH RÄTTELSE (GDPR art. 16 och 17).
 *
 * Utdraget (art. 15 och 20) fanns redan i dataExport.ts. Radering fanns
 * som en LÄNK TILL ETT KONTAKTFORMULÄR, och rättelse som en mening om att
 * namn och telefon ändras under Dina uppgifter. Det första är inte en
 * rättighet, det är en förhoppning om att någon läser mejlen. Det andra
 * var sant men outtalat: ingenstans stod vilka uppgifter som finns, var
 * var och en ändras, och vad som INTE går att ändra själv.
 *
 * Den här filen är löftet, i kod:
 *
 *  - ERASURE_MANIFEST säger post för post vad som raderas, vad som
 *    anonymiseras och vad som BEHÅLLS - med den rättsliga grunden utsatt
 *    för varje sak vi behåller. Ett raderingslöfte utan undantagen
 *    utskrivna är ett löfte som bryts vid första bokföringsrevisionen.
 *  - RECTIFICATION_MAP säger var varje uppgift rättas, och vilka som
 *    kräver att någon annan gör det.
 *
 * VARFÖR MANIFESTET ÄR EN DATASTRUKTUR OCH INTE EN TEXT PÅ EN SIDA.
 * Databasfunktionen app.erase_user() gör det som står här. tests/dataskydd.ts
 * läser BÅDA och kräver att varje post i manifestet nämner sin tabell i
 * SQL:en - annars kan sidan lova en sak och databasen göra en annan, och
 * den skillnaden hade ingen upptäckt förrän någon begärde radering och
 * fick behålla sina uppgifter.
 */

export type ErasureAction = "raderas" | "anonymiseras" | "behalls";

export interface ErasurePost {
  /** Stabil nyckel. */
  id: string;
  /** Vad den registrerade känner igen: "Ditt mobilnummer", inte "verified_phones". */
  label: string;
  /**
   * Tabellerna posten rör. Finns här för att SQL:en ska gå att jämföra med
   * löftet - inte för att visas för användaren.
   */
  tabeller: string[];
  action: ErasureAction;
  /** Vad som faktiskt händer, i klartext. */
  vad: string;
  /**
   * Den rättsliga grunden för att BEHÅLLA. Obligatorisk för `behalls` -
   * det är hela poängen: undantag utan grund är godtycke.
   */
  grund?: string;
  /**
   * Bara för `behalls`: raderna står kvar, men en AVGRÄNSAD ändring görs
   * ändå. Fältet är inte kosmetiskt - det avgör vad tests/dataskydd.ts
   * tillåter SQL:en att göra med tabellen. Utan det får en behålld tabell
   * inte ändras över huvud taget; med det får den uppdateras på just det
   * sätt värdet namnger, men aldrig raderas.
   *
   *   atkomst-aterkallas    behörighetsraden markeras som återkallad
   */
  andring?: "atkomst-aterkallas";
}

/**
 * KARENSTIDEN.
 *
 * Begäran verkställs inte på sekunden. Sju dagar, av ett enda skäl: den
 * som sitter mitt i en kris och trycker fel ska hinna ångra sig innan
 * ärendet är borta. Tiden är ett TAK för ångerrätten, inte en fördröjning
 * vi tar oss - GDPR art. 12.3 ger en månad att svara, och sju dagar ligger
 * med god marginal inom den. Begäran kan återkallas fram till att den
 * verkställs, aldrig efteråt.
 */
export const KARENSDAGAR = 7;

/**
 * Vad radering av kontot betyder, post för post.
 *
 * Ordningen är avsiktlig: det som försvinner först, det som blir kvar
 * sist. Den som läser ska mötas av rättigheten, inte av undantagen - men
 * ska inte kunna sluta läsa innan undantagen kommit.
 */
export const ERASURE_MANIFEST: ErasurePost[] = [
  {
    id: "inloggning",
    label: "Inloggningen",
    tabeller: ["auth.users", "auth.sessions"],
    action: "anonymiseras",
    vad:
      "E-postadressen och lösenordet ersätts med en död platshållare och kontot " +
      "stängs. Alla inloggade sessioner - med IP-adress och webbläsare - raderas. " +
      "Kontoraden i sig finns kvar utan namn eller adress, så att spårbarheten i " +
      "delade ärenden inte spricker.",
  },
  {
    id: "profil",
    label: "Namn och telefon",
    tabeller: ["public.user_profiles", "public.verified_phones"],
    action: "raderas",
    vad: "Namn, telefonnummer och det verifierade mobilnumret tas bort helt.",
  },
  {
    id: "aviseringar",
    label: "Aviseringar",
    tabeller: [
      "public.notification_prefs",
      "public.notification_events",
      "public.outbound_sms",
    ],
    action: "raderas",
    vad:
      "Aviseringsvalen, notiserna och de SMS som skickats till numret raderas. " +
      "Notistexterna bär ärendets innehåll och hör därför till dig, inte till loggen.",
  },
  {
    id: "korrespondens",
    label: "Kontaktformulär och inbjudningar",
    tabeller: ["public.contact_messages", "public.case_invitations", "public.outbound_emails"],
    action: "anonymiseras",
    vad:
      "Meddelanden du skickat till oss töms på namn, adress, telefon och text. " +
      "Obesvarade inbjudningar till din adress raderas. Mejl som hör till en " +
      "faktura är undantagna - de följer fakturan.",
  },
  {
    id: "nycklar",
    label: "API-nycklar",
    tabeller: ["public.api_keys"],
    action: "raderas",
    vad: "Nycklar du skapat raderas och slutar fungera omedelbart.",
  },
  {
    id: "radgivarroll",
    label: "Rådgivarroll och byråkoppling",
    tabeller: [
      "public.professional_members",
      "public.professional_invitations",
      "public.profile_claims",
    ],
    action: "raderas",
    vad:
      "Din koppling till en rådgivarbyrå tas bort, liksom obesvarade inbjudningar " +
      "till din adress och anspråk du gjort på en profil i katalogen. Byråns egen " +
      "katalogpost berörs inte - den är bolagets uppgift, inte din.",
  },
  {
    id: "ensamma-arenden",
    label: "Ärenden ingen annan har tillgång till",
    tabeller: ["public.cases"],
    action: "raderas",
    vad:
      "Ett ärende där du var ensam kvar raderas i sin helhet - med analys, " +
      "likviditetsplan, dokument, samtal och beslut. Ingen kan nå det efter dig, " +
      "och då ska det inte finnas.",
  },
  {
    id: "delade-arenden",
    label: "Ärenden du delar med någon annan",
    tabeller: ["public.case_members", "public.case_notes", "public.case_messages"],
    action: "behalls",
    andring: "atkomst-aterkallas",
    vad:
      "Din behörighet återkallas och du kommer inte in längre. Ärendets innehåll " +
      "står kvar för dem som är kvar - din koppling till det du skrivit finns bara " +
      "som ett konto-id utan namn.",
    grund:
      "Uppgifterna avser bolaget, en juridisk person, och skyddas inte av " +
      "dataskyddsförordningen. Att radera dem hade tagit rekonstruktörens " +
      "underlag mitt i ett pågående ärende.",
  },
  {
    id: "handelselogg",
    label: "Händelseloggen",
    tabeller: ["public.audit_events"],
    action: "behalls",
    vad:
      "Vem som gjorde vad och när står kvar, med ditt konto-id men utan namn " +
      "eller adress. Loggen sparar en före- och efterbild av varje ändrad rad, " +
      "och där maskeras namn, e-postadress och telefonnummer redan när de " +
      "skrivs - loggen går inte att ändra i efterhand, och ska inte göra det.",
    grund:
      "Art. 17.3 e: nödvändig för att kunna fastställa, göra gällande eller " +
      "försvara rättsliga anspråk. Ärendets svarta låda är det enda som kan visa " +
      "vad som faktiskt beslutades, och när.",
  },
  {
    id: "signaturer",
    label: "Underskrifter",
    tabeller: ["public.document_signatures"],
    action: "behalls",
    vad: "Namn och adress i en underskrift står kvar på det dokument du signerat.",
    grund:
      "Art. 17.3 e. En underskrift utan namn bevisar ingenting - den hade " +
      "förvandlat ett undertecknat styrelsebeslut till ett papper.",
  },
  {
    id: "bokforing",
    label: "Fakturor och bokföringsunderlag",
    tabeller: ["public.customer_invoices", "public.usage_charges", "public.time_entries"],
    action: "behalls",
    vad:
      "Fakturor, kvitton, debiteringsunderlag och de tidsposter en faktura vilar " +
      "på står kvar oförändrade.",
    grund:
      "Art. 17.3 b: rättslig förpliktelse. Bokföringslagen (1999:1078) 7 kap. 2 § " +
      "kräver att räkenskapsinformation bevaras i sju år efter räkenskapsåret.",
  },
];

/** Sant om manifestet lovar något om tabellen. Används av SQL-granskningen. */
export const manifestTables = (): string[] =>
  [...new Set(ERASURE_MANIFEST.flatMap((p) => p.tabeller))].sort();

export const ERASURE_ACTION_LABEL: Record<ErasureAction, string> = {
  raderas: "Raderas",
  anonymiseras: "Anonymiseras",
  behalls: "Behålls",
};

/**
 * En rak sammanfattning: hur många poster som försvinner och hur många som
 * står kvar. Den som inte orkar läsa manifestet ska ändå få veta att det
 * FINNS undantag - att bara säga "vi raderar dina uppgifter" är osant.
 */
export const erasureSummary = (): string => {
  const bort = ERASURE_MANIFEST.filter((p) => p.action !== "behalls").length;
  const kvar = ERASURE_MANIFEST.filter((p) => p.action === "behalls").length;
  return (
    `${bort} av ${ERASURE_MANIFEST.length} kategorier raderas eller anonymiseras. ` +
    `${kvar} behålls, var och en med rättslig grund utskriven nedan.`
  );
};

/* --- Rättelse (art. 16) ---------------------------------------------------- */

export interface RectificationEntry {
  /** Uppgiften, som den heter för den registrerade. */
  uppgift: string;
  /**
   * Var den ändras. `null` betyder att den inte går att ändra själv - och
   * då MÅSTE `varfor` säga varför, och `vag` hur man får den ändrad.
   */
  plats: string | null;
  /** Länk till platsen, när den finns i produkten. */
  href?: string;
  varfor?: string;
  vag?: string;
}

/**
 * Var varje personuppgift rättas.
 *
 * Listan speglar registerutdraget: allt som kommer ut i art. 15-filen ska
 * finnas här med en väg till rättelse. tests/dataskydd.ts prövar det -
 * annars hade en ny uppgift kunnat läggas till i utdraget utan att någon
 * sa hur den rättas.
 */
export const RECTIFICATION_MAP: RectificationEntry[] = [
  {
    uppgift: "Namn",
    plats: "Dina uppgifter",
    href: "/dashboard/installningar",
  },
  {
    uppgift: "Telefonnummer",
    plats: "Dina uppgifter",
    href: "/dashboard/installningar",
  },
  {
    uppgift: "Aviseringsval",
    plats: "Aviseringar",
    href: "/dashboard/installningar",
  },
  {
    uppgift: "Uppgifterna om bolaget i ett ärende",
    plats: "Ärendet",
    href: "/dashboard",
  },
  {
    uppgift: "E-postadressen",
    plats: null,
    varfor:
      "Adressen är inloggningen. Att byta den är att byta konto, och det ska " +
      "inte gå att göra av misstag eller av någon annan än du.",
    vag: "Begär bytet via kontaktformuläret. Vi bekräftar från den gamla adressen först.",
  },
  {
    uppgift: "Uppgifter i händelseloggen",
    plats: null,
    varfor:
      "Loggen är ärendets svarta låda. En logg som går att skriva om i " +
      "efterhand är ingen logg.",
    vag:
      "Är en uppgift i loggen felaktig rättas den inte - den kompletteras med " +
      "en ny händelse som säger vad som var fel. Begär det via kontaktformuläret.",
  },
  {
    uppgift: "Namn och belopp på en faktura",
    plats: null,
    varfor: "En bokförd faktura får inte ändras i efterhand.",
    vag: "En felaktig faktura rättas med en kreditfaktura. Hör av dig så gör vi det.",
  },
];
