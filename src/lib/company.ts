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
   * Vilket konto som anges på faktura. Två konton på samma faktura är den
   * vanligaste orsaken till att betalningen bokförs fel eller uteblir.
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
  // TOM MED FLIT: numret finns men jag har inte sett det. Ett bankgironummer
  // jag gissar fram är ett konto pengarna inte kommer fram till.
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
  const giro = c.invoiceGiro === "bankgiro" ? c.bankgiro : c.plusgiro;
  if (!giro.trim()) missing.push(c.invoiceGiro);
  if (!c.hasFSkatt) missing.push("bekräftat godkännande för F-skatt");
  if (!c.vatRegistered) missing.push("bekräftad momsregistrering");
  return missing;
};

export const formatAddress = (c: CompanyIdentity = COMPANY): string =>
  [c.address.street, `${c.address.postalCode} ${c.address.city}`.trim(), c.address.country]
    .filter((line) => line.trim().length > 0)
    .join(", ");

/**
 * Kontot som ska stå på fakturan, med rätt benämning.
 *
 * Returnerar null när numret saknas. Anropande kod ska då inte skriva ut
 * något alls - en faktura utan betalningsuppgift är ett fel som syns, en
 * faktura med fel kontotyp är ett fel som inte syns förrän betalningen
 * uteblir.
 */
export const invoiceAccount = (
  c: CompanyIdentity = COMPANY,
): { label: string; number: string } | null => {
  const number = c.invoiceGiro === "bankgiro" ? c.bankgiro : c.plusgiro;
  if (!number.trim()) return null;
  return { label: c.invoiceGiro === "bankgiro" ? "Bankgiro" : "Plusgiro", number };
};
