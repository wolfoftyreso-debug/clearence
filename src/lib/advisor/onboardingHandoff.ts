/**
 * Överlämningen från onboardingen till nulägesanalysen.
 *
 * Löftet i introduktionen är att grunduppgifterna sparar tid. Ett löfte
 * som bryts i nästa vy - genom att guiden frågar om organisationsnumret
 * en gång till - är värre än inget löfte alls: det lär användaren att
 * ingenting som sägs i samtalet får konsekvenser.
 *
 * Bara localStorage, av samma skäl som autosparet: onboardingen körs
 * utan konto, och ofärdiga uppgifter ska inte lämna datorn förrän
 * användaren själv väljer att spara.
 */

const KEY = "clearance-onboarding";

export interface OnboardingHandoff {
  name: string;
  company: string;
  orgNumber: string;
  situation: string;
  savedAt: string;
  /**
   * Intervjusvaren och företagsprofilen, så att nulägesanalysen kan
   * bygga vidare i stället för att fråga om samma sak igen. Frivilliga:
   * en överlämning som sparats före intervjun saknar dem, och den ska
   * fortfarande gå att läsa.
   *
   * Lösenordet finns INTE här och ska aldrig hamna här. Det går till
   * inloggningen och ingen annanstans - localStorage är läsbart för allt
   * som kör i fliken.
   */
  answers?: Record<string, string>;
  profile?: Record<string, string | null>;
}

export const saveOnboarding = (
  input: Omit<OnboardingHandoff, "savedAt">,
): void => {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...input, savedAt: new Date().toISOString() }),
    );
  } catch {
    // Fullt eller privat läge. Överlämningen är en förbättring, inte ett
    // krav - guiden fungerar precis som förut när lagringen inte gör det.
  }
};

export const readOnboarding = (): OnboardingHandoff | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OnboardingHandoff>;
    if (!parsed || typeof parsed.name !== "string") return null;
    return {
      name: parsed.name,
      company: typeof parsed.company === "string" ? parsed.company : "",
      orgNumber: typeof parsed.orgNumber === "string" ? parsed.orgNumber : "",
      situation: typeof parsed.situation === "string" ? parsed.situation : "",
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : "",
      answers: parsed.answers && typeof parsed.answers === "object" ? parsed.answers : undefined,
      profile: parsed.profile && typeof parsed.profile === "object" ? parsed.profile : undefined,
    };
  } catch {
    return null;
  }
};

export const clearOnboarding = (): void => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Se ovan: det värsta som händer är en förifyllning för mycket.
  }
};

/**
 * Onboardingens storleksintervall → nulägesanalysens.
 *
 * De två frågorna använde olika trappor: onboardingen frågar
 * "1 / 2–5 / 6–20 / 21–50 / fler än 50", nulägesanalysen
 * "0 / 1-5 / 6-10 / 11-25 / 26-50 / 50+". Just den skillnaden gjorde att
 * antalet anställda frågades EN GÅNG TILL fast det redan var lämnat - och
 * ett löfte om att grunduppgifterna sparar tid, som bryts i nästa vy, är
 * värre än inget löfte alls.
 *
 * Bryggan mappar på intervallets mittpunkt. Den är inte exakt (6–20 kan
 * vara 6 eller 20), men ett förifyllt och ändringsbart svar slår att fråga
 * om samma sak igen med tom ruta. Okänt eller tomt ger null - då står
 * analysens egen fråga kvar, som förut.
 */
export const wizardEmployees = (fromOnboarding: string | null | undefined): string | null => {
  switch ((fromOnboarding ?? "").trim()) {
    case "1 person":
      return "1-5";
    case "2–5":
      return "1-5";
    case "6–20":
      return "11-25";
    case "21–50":
      return "26-50";
    case "Fler än 50":
      return "50+";
    default:
      return null;
  }
};
