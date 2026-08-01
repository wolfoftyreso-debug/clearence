/**
 * Landvex AB:s uppgifter — en enda källa.
 *
 * Clearance är en produkt från Landvex AB. Uppgifterna nedan hamnar i sidfoten,
 * i rapporternas dokumenthuvud, i villkoren och på fakturor.
 *
 * Uppgifterna delas i tre nivåer, för de har olika krav på sig:
 *
 *  1. `legalIdentityIsComplete()` — firma, organisationsnummer och säte. Det
 *     är vad ABL 28 kap. kräver att ett aktiebolag anger på sin webbplats och
 *     i sin korrespondens. Den nivån är uppfylld och visas.
 *  2. `companyInfoIsComplete()` — ovanstående plus en publik kontaktväg.
 *  3. `missingInvoiceFields()` — allt som måste stämma innan en faktura går
 *     ut: plusgiro, momsregistrering och F-skatt.
 *
 * Tomma fält är tomma med flit. En påhittad siffra i en sidfot blir en
 * påhittad siffra på en faktura, och en påhittad e-postadress i sidfoten är
 * en kontaktväg som tyst inte fungerar.
 */

export interface CompanyIdentity {
  /** Registrerad firma. */
  legalName: string;
  /** Produktens namn. */
  productName: string;
  /** MÅSTE FYLLAS I. Format XXXXXX-XXXX. */
  orgNumber: string;
  /** MÅSTE FYLLAS I. Styrelsens säte, t.ex. "Stockholm". */
  registeredOffice: string;
  /** MÅSTE FYLLAS I. Format SE + 12 siffror. */
  vatNumber: string;
  /**
   * Plusgiro, format XX XX XX-X. Bekräftat från Nordea-kontot.
   *
   * Bolaget har både plusgiro och bankgiro. Att jag först skrev om "bankgiro"
   * till "plusgiro" var fel: jag hade bara sett plusgirokontot och behandlade
   * det som en rättelse i stället för som ett val. Båda finns här nu, och
   * `invoiceGiro` avgör vilket som trycks på fakturan - inte den som råkar
   * skriva texten.
   */
  plusgiro: string;
  /** Bankgiro, format XXX-XXXX. */
  bankgiro: string;
  /**
   * Vilket konto som står FÖRST på fakturan. Båda skrivs ut - det är
   * beslutat - men ordningen säger vilket vi helst vill ha betalt till.
   */
  invoiceGiro: "plusgiro" | "bankgiro";
  /** För utländska betalningar. */
  iban: string;
  bic: string;
  /**
   * Publiceras inte. Sajten har ingen e-postadress utskriven - meddelanden
   * lämnas i formuläret på /kontakt och landar i driftinkorgen. Adressen här
   * används bara som avsändare på utgående fakturor och svar.
   */
  email: string;
  /** Frivilligt. */
  phone: string | null;
  /** MÅSTE FYLLAS I. */
  address: {
    street: string;
    postalCode: string;
    city: string;
    country: string;
  };
  /**
   * Sant när bolaget är godkänt för F-skatt. Ska anges på faktura.
   * MÅSTE BEKRÄFTAS mot Skatteverket innan första fakturan.
   */
  hasFSkatt: boolean;
  /**
   * Sant när bolaget är momsregistrerat. MÅSTE BEKRÄFTAS: ett bolag som inte
   * är momsregistrerat får inte ange moms på en faktura, och numret nedan är
   * härlett ur organisationsnumret enligt standardformeln - inte hämtat ur
   * ett register.
   */
  vatRegistered: boolean;
}

export const COMPANY: CompanyIdentity = {
  legalName: "Landvex AB",
  productName: "Clearance",
  orgNumber: "559141-7042",
  // Adressorten enligt Bolagsverket. Säte ska stämmas av mot
  // registreringsbeviset - adress och säte är formellt olika uppgifter.
  registeredOffice: "Tyresö",
  // SE + organisationsnumret utan bindestreck + 01, enligt standardformeln.
  // Se vatRegistered ovan.
  vatNumber: "SE559141704201",
  plusgiro: "87 53 07-1",
  // TOM I VÄNTAN PÅ NUMRET. Bankgirot ska skrivas ut bredvid plusgirot, men
  // jag har inte sett numret. paymentAccounts() utelämnar det tills det
  // fylls i - ett gissat bankgironummer är ett konto pengarna inte kommer
  // fram till, och felet syns först när betalningen uteblir.
  bankgiro: "",
  invoiceGiro: "plusgiro",
  iban: "SE30 9500 0099 6026 0875 3071",
  bic: "NDEASESS",
  email: "",
  phone: null,
  address: {
    street: "Antennvägen 2",
    postalCode: "135 48",
    city: "Tyresö",
    country: "Sverige",
  },
  hasFSkatt: false,
  vatRegistered: false,
};

/**
 * Vad ABL 28 kap. kräver: firma, organisationsnummer och säte. Adressen tas
 * med här därför att den visas i samma stycke — utan ort blir raden
 * missvisande, inte bara ofullständig.
 */
export const missingLegalIdentityFields = (c: CompanyIdentity = COMPANY): string[] => {
  const missing: string[] = [];
  if (!c.legalName.trim()) missing.push("firma");
  if (!c.orgNumber.trim()) missing.push("organisationsnummer");
  if (!c.registeredOffice.trim()) missing.push("säte");
  if (!c.address.street.trim() || !c.address.city.trim()) missing.push("adress");
  return missing;
};

export const legalIdentityIsComplete = (c: CompanyIdentity = COMPANY): boolean =>
  missingLegalIdentityFields(c).length === 0;

/**
 * Den legala identiteten plus en avsändaradress för utgående post. Adressen
 * publiceras inte på sajten - den behövs för att kunna skicka svar och
 * fakturor.
 */
export const missingCompanyFields = (c: CompanyIdentity = COMPANY): string[] => {
  const missing = missingLegalIdentityFields(c);
  if (!c.email.trim()) missing.push("avsändaradress för e-post");
  return missing;
};

export const companyInfoIsComplete = (c: CompanyIdentity = COMPANY): boolean =>
  missingCompanyFields(c).length === 0;

/** Extra fält som krävs innan en faktura får skickas. */
export const missingInvoiceFields = (c: CompanyIdentity = COMPANY): string[] => {
  const missing = missingCompanyFields(c);
  if (!c.vatNumber.trim()) missing.push("momsregistreringsnummer");
  // Båda ska stå på fakturan, så båda måste finnas.
  if (!c.plusgiro.trim()) missing.push("plusgiro");
  if (!c.bankgiro.trim()) missing.push("bankgiro");
  if (!c.hasFSkatt) missing.push("bekräftat godkännande för F-skatt");
  if (!c.vatRegistered) missing.push("bekräftad momsregistrering");
  return missing;
};

export const formatAddress = (c: CompanyIdentity = COMPANY): string =>
  [c.address.street, `${c.address.postalCode} ${c.address.city}`.trim(), c.address.country]
    .filter((line) => line.trim().length > 0)
    .join(", ");

/**
 * Betalkontona som ska skrivas ut, i den ordning de ska stå.
 *
 * Båda anges - det är beslutat. Betalaren väljer det konto den egna banken
 * hanterar enklast, och ett bolag som bara har bankgiro upplagt i sin
 * leverantörsregister slipper lägga upp ett nytt.
 *
 * Ett konto vars nummer saknas tas bort ur listan i stället för att skrivas
 * ut tomt. `invoiceGiro` styr vilket som står först, alltså vilket vi helst
 * vill ha betalt till.
 */
export const paymentAccounts = (
  c: CompanyIdentity = COMPANY,
): { label: string; number: string }[] => {
  const accounts = [
    { key: "plusgiro" as const, label: "Plusgiro", number: c.plusgiro },
    { key: "bankgiro" as const, label: "Bankgiro", number: c.bankgiro },
  ].filter((a) => a.number.trim().length > 0);

  return accounts
    .sort((a, b) => (a.key === c.invoiceGiro ? -1 : b.key === c.invoiceGiro ? 1 : 0))
    .map(({ label, number }) => ({ label, number }));
};

/** Kortform för löptext: "plusgiro 87 53 07-1 eller bankgiro 123-4567". */
export const paymentAccountsSentence = (c: CompanyIdentity = COMPANY): string => {
  const parts = paymentAccounts(c).map((a) => `${a.label.toLowerCase()} ${a.number}`);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} eller ${parts[parts.length - 1]}`;
};
