/**
 * DET AVBRUTNA SAMTALET.
 *
 * Guiderna fick autospar av ett skäl som står i useAutosavedState: en
 * företagare som fyllt i tre steg och råkade uppdatera sidan förlorade
 * allt, mitt i sitt livs mest stressade vecka. De flesta stänger fliken
 * där och kommer inte tillbaka.
 *
 * Introduktionssamtalet - produktens ytterdörr, femton frågor, tre till
 * fem minuter, oftast i en telefon - var det enda flödet som aldrig fick
 * det. Ett fliksbyte, en skärmlåsning eller en webbläsare som återvinner
 * fliken räckte för att kasta bort varje svar. Sidan mötte sedan
 * användaren med "fortsätt samtalet där ni slutade", ett löfte om något
 * som inte fanns kvar. Ett brutet löfte är värre än inget löfte: det
 * lär användaren att ingenting som sägs i samtalet får konsekvenser.
 *
 * Två saker ligger medvetet UTANFÖR posten:
 *
 *  - Lösenordet. Det går till inloggningen och ingen annanstans.
 *    localStorage är läsbart för allt som kör i fliken.
 *  - E-postadressen. Den behövs bara i kontosteget, och posten skrivs
 *    först när kontot finns. Ett fält som inte behövs ska inte lagras.
 *
 * Posten skrivs alltså tidigast när kontot är skapat - efter den punkt
 * där användaren själv valt att bli sparad. Den raderas när samtalet
 * lämnas över till nulägesanalysen, så att nästa besök börjar rent i
 * stället för i ett gammalt halvfärdigt läge.
 */

import type { CompanyProfile } from "./companyProfile";

const KEY = "clearance-onboarding-pagaende";

/** Bumpas när postens form ändras, så gammal data inte tolkas fel. */
const VERSION = 1;

/** De stadier som går att återuppta. Före kontot finns inget att spara. */
export type ResumableStage = "situation" | "intervju" | "analys";

export interface ResumeEntry {
  who: "user" | "radgivare";
  text: string;
  kind?: "text" | "steps" | "confirm";
}

export interface OnboardingResume {
  stage: ResumableStage;
  entries: ResumeEntry[];
  name: string;
  company: string;
  orgNumber: string;
  situationId: string | null;
  answers: Record<string, string>;
  profile: CompanyProfile;
  signals: {
    concentration: "låg" | "medel" | "hög" | null;
    trend: "upp" | "stabil" | "ner" | "kraftigt ner" | null;
  };
  savedAt: string;
}

interface Envelope {
  version: number;
  value: OnboardingResume;
}

const STAGES: ResumableStage[] = ["situation", "intervju", "analys"];

const isRecordOfStrings = (v: unknown): v is Record<string, string> =>
  !!v && typeof v === "object" && !Array.isArray(v)
    && Object.values(v as Record<string, unknown>).every((x) => typeof x === "string");

/**
 * Hur många frågor som faktiskt är besvarade i posten.
 *
 * Överhoppade frågor lagras som tom sträng och räknas inte - samma regel
 * som i analysen. "Sex svar" när tre av dem var överhoppningar är en
 * överdrift om hur mycket vi vet, och siffran visas för användaren.
 */
export const resumeAnswerCount = (resume: OnboardingResume): number =>
  Object.values(resume.answers).filter((v) => v !== "").length;

export const saveResume = (value: OnboardingResume): void => {
  try {
    const envelope: Envelope = { version: VERSION, value };
    localStorage.setItem(KEY, JSON.stringify(envelope));
  } catch {
    // Fullt eller privat läge. Att kunna återuppta är en förbättring,
    // inte ett krav: samtalet fungerar precis som förut utan lagringen.
  }
};

/**
 * Posten, eller null.
 *
 * Vid trasig, föråldrad eller ofullständig data returneras null tyst.
 * Ett felmeddelande om en lagring användaren inte vet finns hjälper
 * ingen - och en halvläst post som resulterar i ett samtal utan frågor
 * hade varit en ny återvändsgränd.
 */
export const readResume = (): OnboardingResume | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Envelope>;
    if (!parsed || parsed.version !== VERSION) return null;
    const v = parsed.value;
    if (!v || typeof v !== "object") return null;
    if (!STAGES.includes(v.stage)) return null;
    if (!Array.isArray(v.entries)) return null;
    if (!isRecordOfStrings(v.answers)) return null;
    if (!v.profile || typeof v.profile !== "object") return null;
    if (typeof v.name !== "string" || typeof v.company !== "string") return null;
    const entries = v.entries.filter(
      (e): e is ResumeEntry =>
        !!e && typeof e === "object"
        && (e.who === "user" || e.who === "radgivare")
        && typeof e.text === "string",
    );
    // Ett samtal utan repliker är inget samtal att återuppta.
    if (entries.length === 0) return null;
    return {
      stage: v.stage,
      entries,
      name: v.name,
      company: v.company,
      orgNumber: typeof v.orgNumber === "string" ? v.orgNumber : "",
      situationId: typeof v.situationId === "string" ? v.situationId : null,
      answers: v.answers,
      profile: v.profile as CompanyProfile,
      signals: {
        concentration: v.signals?.concentration ?? null,
        trend: v.signals?.trend ?? null,
      },
      savedAt: typeof v.savedAt === "string" ? v.savedAt : "",
    };
  } catch {
    return null;
  }
};

export const clearResume = (): void => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Se ovan: det värsta som händer är en återupptagning för mycket,
    // och den går alltid att tacka nej till.
  }
};

/**
 * Finns det ett avbrutet samtal att återuppta?
 *
 * Startsidan frågar innan den erbjuder en återvändande användare att
 * "fortsätta samtalet". Finns posten ska samtalet återupptas på riktigt,
 * inte ersättas av en knapp som leder någon annanstans.
 */
export const hasResume = (): boolean => readResume() !== null;
