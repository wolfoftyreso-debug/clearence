/**
 * SPÅREN I WEBBLÄSAREN, OCH NÄR DE STÄDAS.
 *
 * Flera flöden sparar arbete lokalt: guidernas autospar, det avbrutna
 * introduktionssamtalet, valet av aktivt ärende, byråns timpris. Det är
 * medvetet - guiderna ska fungera utan konto, och ofärdiga uppgifter ska
 * inte lämna datorn förrän användaren själv väljer att spara.
 *
 * Men det som ligger kvar efter en utloggning är inte längre ett stöd,
 * det är ett läckage. Ett halvfärdigt introduktionssamtal innehåller ett
 * personnamn, ett organisationsnummer och femton svar om ett bolags
 * ekonomiska problem. Nästa person som loggar in på samma dator - en
 * kollega, en familjemedlem, nästa användare av en delad enhet - ska
 * inte kunna läsa det.
 *
 * Därför två listor, och skillnaden mellan dem är hela poängen:
 *
 *  - ARBETE OCH ÄRENDE städas vid utloggning. Uppgifter om ett bolag
 *    eller en person hör till den som loggade in.
 *  - LÄSINSTÄLLNINGAR står kvar. Språknivå, presentationsläge och
 *    avbockade mikrolektioner säger något om hur en människa vill läsa,
 *    inte något om ett bolag - och att nollställa dem vid varje
 *    utloggning hade varit att straffa den som delar dator.
 *
 * Listan är avsiktligt uttömmande och avsiktligt handskriven. Att städa
 * allt som börjar med "clearance-" hade tagit demoläget med sig, och att
 * städa efter gissning hade lämnat kvar det som glömdes bort. En ny
 * nyckel som bär uppgifter om ett bolag ska läggas till HÄR, och testet
 * i tests/avbrott.ts vaktar att listan inte krymper.
 */

/** Nycklar som bär arbete eller uppgifter om ett bolag. Städas vid utloggning. */
export const WORK_KEYS = [
  // Introduktionssamtalet: namn, organisationsnummer, intervjusvar.
  "clearance-onboarding-pagaende",
  "clearance-onboarding",
  // Guidernas autospar: ekonomi, skulder, förfallodagar.
  "clearance-wizard-draft",
  "clearance-kbr-draft",
  "clearance-liquidity-draft",
  // Vilket ärende som var öppet, och vad som lästs i det.
  "clearance-active-case",
  "clearance-notifications-read",
  // Akter, samlingsexporter och kreditunderlag.
  "clearance-akt",
  "clearance-akt-samling",
  "clearance-kreditunderlag",
  // Byråns eget timpris och momssats.
  "clearance-time-rate",
  "clearance-time-vat",
] as const;

/**
 * Nycklar som ÖVERLEVER en utloggning, med skälet utskrivet.
 *
 * Finns här för att vara läsbar bredvid listan ovan: den som lägger till
 * en nyckel ska behöva placera den i en av dem, inte i tystnad.
 */
export const PREFERENCE_KEYS = [
  "clearance-language-level",
  "clearance-language-change",
  "clearance-language-suggestion-dismissed",
  "clearance-glossary-clicks",
  "clearance-presentation-mode",
  "clearance-presentation-scope",
  "clearance-mikrolektioner",
  "clearance-notification-prefs",
  // Att engångserbjudandet redan visats. BEVARAS med flit över utloggning:
  // en "sista chans" som återkommer varje gång vore just den falska
  // brådska erbjudandet är byggt för att undvika.
  "clearance-pro-offer-seen",
] as const;

/**
 * Städa arbetsspåren.
 *
 * Anropas EFTER att utloggningen gått igenom, aldrig före: sessionstoken
 * behövs för att logga ut, och en halvt städad webbläsare med en levande
 * session vore sämre än ingen städning alls.
 */
export const clearWorkTraces = (): void => {
  for (const key of WORK_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Privat läge eller blockerad lagring. Fanns inget att städa
      // fanns heller inget att läcka.
    }
  }
};
