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
