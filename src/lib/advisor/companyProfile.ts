/**
 * FÖRETAGSPROFILEN: det systemet har förstått, uppdaterat efter varje svar.
 *
 * Profilen är arbetsminnet under introduktionssamtalet. Den fyller två
 * syften: den styr vilken fråga som kommer härnäst (en fråga vars svar
 * redan är känt ska inte ställas), och den är det underlag den första
 * analysen vilar på.
 *
 * Fälten är precis de nio som en lägesbedömning behöver för att inte bli
 * generisk. Varje fält är null tills något faktiskt sagt något om det -
 * "okänd" är ett ärligt värde, en gissning är det inte. Ett bolag vars
 * omsättning ingen frågat om ska stå som okänd, inte som noll.
 *
 * Användaren behöver inte se profilen, men får göra det. Ett system som
 * bygger en bild av någons bolag och håller den dold ber om ett
 * förtroende det inte förtjänat; ett som visar den kan rättas.
 */

export interface CompanyProfile {
  industry: string | null;
  employees: string | null;
  revenue: string | null;
  customers: string | null;
  geography: string | null;
  businessModel: string | null;
  growthPhase: string | null;
  riskLevel: string | null;
  digitalMaturity: string | null;
}

/** Etiketterna användaren ser. Ordningen är den profilen visas i. */
export const PROFILE_LABELS: { key: keyof CompanyProfile; label: string }[] = [
  { key: "industry", label: "Bransch" },
  { key: "employees", label: "Anställda" },
  { key: "revenue", label: "Omsättning" },
  { key: "customers", label: "Kunder" },
  { key: "geography", label: "Geografi" },
  { key: "businessModel", label: "Affärsmodell" },
  { key: "growthPhase", label: "Tillväxtfas" },
  { key: "riskLevel", label: "Risknivå" },
  { key: "digitalMaturity", label: "Digital mognad" },
];

export const emptyProfile = (): CompanyProfile => ({
  industry: null,
  employees: null,
  revenue: null,
  customers: null,
  geography: null,
  businessModel: null,
  growthPhase: null,
  riskLevel: null,
  digitalMaturity: null,
});

/**
 * Ett svar läggs till profilen.
 *
 * Senare svar skriver över tidigare för samma fält - en fråga som
 * förfinar en tidigare bild ska få göra det. Det som ALDRIG händer är
 * att ett känt värde nollställs: `null` i en uppdatering betyder "den
 * här frågan sa inget om det fältet", inte "glöm det du visste".
 */
export const applyAnswer = (
  profile: CompanyProfile,
  fills: Partial<CompanyProfile>,
): CompanyProfile => {
  const next = { ...profile };
  for (const [key, value] of Object.entries(fills) as [keyof CompanyProfile, string | null][]) {
    if (value !== null && value !== undefined && value !== "") next[key] = value;
  }
  return next;
};

/**
 * ETT PROFILFÄLT KAN BÄRA FLERA VÄRDEN.
 *
 * Sedan intervjun tillåter flerval kan ett fält vara "Varuförsäljning och
 * Projekt" - en bilverkstad säljer arbete och reservdelar, och den
 * blandningen ÄR uppgiften. Varje `profile.businessModel === "Projekt"`
 * blev då tyst falsk, och analysen tappade sina observationer utan att
 * något gick sönder.
 *
 * Jämförelser mot profilfält som kan slås ihop ska därför gå genom den
 * här funktionen. tests/onboarding.ts vaktar att de gör det.
 */
export const profilInnehaller = (varde: string | null | undefined, del: string): boolean =>
  typeof varde === "string" && varde.split(" och ").some((d) => d.trim() === del);

/** Profilen som rader, med okända fält utskrivna som okända. */
export const profileRows = (profile: CompanyProfile): { label: string; value: string }[] =>
  PROFILE_LABELS.map(({ key, label }) => ({ label, value: profile[key] ?? "okänd" }));

/** Hur mycket av profilen som vilar på ett faktiskt svar. */
export const profileFilled = (profile: CompanyProfile): number =>
  PROFILE_LABELS.filter(({ key }) => profile[key] !== null).length;

/**
 * Risknivån härleds, den frågas inte.
 *
 * Ingen företagare svarar "hög" på en rak fråga om sin egen risknivå, och
 * en profil som frågar efter den mäter viljan att erkänna, inte läget.
 * Den räknas därför ur svar som var och en är lätta att lämna.
 */
export const deriveRiskLevel = (signals: {
  /** Situationsvalet från introduktionen, om det finns. */
  situationId: string | null;
  /** Största kundens andel av intäkterna, om frågan ställts. */
  concentration: "låg" | "medel" | "hög" | null;
  /** Omsättningens riktning senaste året. */
  trend: "upp" | "stabil" | "ner" | "kraftigt ner" | null;
}): string => {
  // Ett akut betalningsläge slår ut allt annat: det är inte en
  // sammanvägning, det är ett faktum.
  if (signals.situationId === "loner" || signals.situationId === "ansvar") return "Hög";
  let score = 0;
  if (signals.situationId === "fakturor") score += 2;
  if (signals.situationId === "oro") score += 1;
  if (signals.concentration === "hög") score += 2;
  if (signals.concentration === "medel") score += 1;
  if (signals.trend === "kraftigt ner") score += 2;
  if (signals.trend === "ner") score += 1;
  if (score >= 3) return "Hög";
  if (score >= 1) return "Medel";
  return "Låg";
};
