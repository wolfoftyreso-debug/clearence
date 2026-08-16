/**
 * DEN FÖRSTA ANALYSEN, direkt efter intervjun.
 *
 * Det här är första gången användaren får något TILLBAKA. Fram till nu
 * har hen bara lämnat uppgifter. Vad som står här avgör om resten av
 * produkten får en chans.
 *
 * Två krav styr innehållet. Det ska vara SPECIFIKT - varje observation
 * ska gå att spåra till ett svar användaren själv lämnade, och den
 * kopplingen skrivs ut. Och det ska vara ÄRLIGT om vad det inte är: det
 * här är en bild av verksamheten, inte en bedömning av betalningsförmågan.
 * Den bedömningen kräver siffror som ingen ännu lämnat, och att antyda
 * något annat vore att sälja en trygghet som inte finns täckning för.
 *
 * Motorn är deterministisk, som resten av analyskedjan.
 */

import type { CompanyProfile } from "./companyProfile";
import { profileFilled, profilInnehaller } from "./companyProfile";
import { svarSomText } from "./interview";

export interface Observation {
  /** Vad vi ser. */
  text: string;
  /** Vilket svar det vilar på - alltid utskrivet, aldrig underförstått. */
  basis: string;
}

export interface FirstAnalysis {
  headline: string;
  /** Det systemet har förstått, i löptext. */
  understanding: string;
  risks: Observation[];
  opportunities: Observation[];
  /** Vad analysen INTE säger. Obligatorisk, aldrig tom. */
  limits: string[];
  /** Nästa steg, med sin dörr. */
  nextStep: { label: string; href: string; why: string };
}

export interface FirstAnalysisInput {
  companyName: string;
  profile: CompanyProfile;
  answers: Record<string, string>;
  situationId: string | null;
  /** Sant när företagsregistret svarade. */
  registryHit: boolean;
}

const joinSwedish = (parts: string[]): string =>
  parts.join(", ").replace(/, ([^,]*)$/, " och $1");

export const buildFirstAnalysis = (input: FirstAnalysisInput): FirstAnalysis => {
  const { profile, answers, companyName } = input;
  const filled = profileFilled(profile);

  /* --- vad vi förstått ---------------------------------------------------- */
  const traits: string[] = [];
  if (profile.industry) traits.push(`verkar inom ${profile.industry.toLowerCase()}`);
  if (profile.employees) {
    traits.push(profile.employees === "1 person" ? "drivs av dig ensam" : `har ${profile.employees} anställda`);
  }
  if (profile.customers) {
    const who = { B2B: "andra företag", B2C: "privatpersoner", "Offentlig sektor": "offentlig sektor" }[
      profile.customers
    ] ?? "både företag och privatpersoner";
    traits.push(`säljer till ${who}`);
  }
  if (profile.geography) traits.push(`med kunder ${profile.geography.toLowerCase()}`);

  const understanding =
    traits.length > 0
      ? `${companyName} ${joinSwedish(traits)}.`
      : `Jag har ännu ingen bild av vad ${companyName} gör – inga av frågorna om verksamheten är besvarade.`;

  /* --- risker: var och en förankrad i ett svar ---------------------------- */
  const risks: Observation[] = [];
  if (answers.beroende === "Mer än hälften" || answers.beroende === "Ungefär hälften") {
    risks.push({
      text: "En enda kund står för en stor del av intäkterna. Om den kunden försvinner eller dröjer med betalningen slår det igenom direkt i kassan.",
      basis: `Du svarade "${svarSomText(answers.beroende)}" på frågan om största kundens andel.`,
    });
  }
  if (profile.growthPhase === "Kraftigt vikande" || profile.growthPhase === "Vikande") {
    risks.push({
      text: "Omsättningen går åt fel håll. Det gör att varje månad som passerar utan åtgärd minskar handlingsutrymmet, även om kassan räcker just nu.",
      basis: `Du svarade "${svarSomText(answers.utveckling)}" om det senaste året.`,
    });
  }
  if (profilInnehaller(profile.digitalMaturity, "Låg")) {
    risks.push({
      text: "Utan ekonomisystem tar det längre tid att få fram siffrorna – och i ett läge där datum styr är fördröjningen i sig en risk.",
      basis: `Du svarade "${svarSomText(answers.system)}" om ekonomisystem.`,
    });
  }
  if (profilInnehaller(profile.businessModel, "Engångsaffärer")) {
    risks.push({
      text: "Utan återkommande intäkter måste varje månads omsättning byggas på nytt. Det gör prognoser svårare och svackor brantare.",
      basis: `Du svarade "${svarSomText(answers.aterkommande)}" om återkommande kunder.`,
    });
  }
  if (profilInnehaller(profile.businessModel, "Projekt")) {
    risks.push({
      text: "Projektaffärer binder pengar innan de betalar tillbaka. Kassan är därför känsligast mitt i ett projekt, inte i slutet.",
      basis: `Du svarade "${svarSomText(answers.erbjudande)}" om vad ni säljer.`,
    });
  }
  if (answers.utmaning) {
    risks.push({
      text: `Du pekar själv ut ${svarSomText(answers.utmaning).toLowerCase()} som den största utmaningen. Den styr vad analysen börjar med.`,
      basis: `Du svarade "${svarSomText(answers.utmaning)}" på frågan om största utmaningen.`,
    });
  }

  /* --- möjligheter: obligatoriskt avsnitt, aldrig uppgivet ---------------- */
  const opportunities: Observation[] = [];
  if (
    profilInnehaller(profile.businessModel, "Återkommande intäkter") ||
    profilInnehaller(profile.businessModel, "Abonnemang")
  ) {
    opportunities.push({
      text: "Återkommande intäkter är den starkaste tillgången i ett ansträngt läge: de gör en likviditetsprognos meningsfull och ger en förhandling med borgenärer något att luta sig mot.",
      basis: `Du svarade "${answers.aterkommande ?? answers.erbjudande}" om intäkterna.`,
    });
  }
  if (profilInnehaller(profile.customers, "Offentlig sektor")) {
    opportunities.push({
      text: "Offentliga kunder betalar sent men de betalar. Fordringar på offentlig sektor är därför lättare att belåna än andra kundfordringar.",
      basis: `Du svarade "${svarSomText(answers.kunder)}" om vem som köper.`,
    });
  }
  if (profile.growthPhase === "Tillväxt") {
    opportunities.push({
      text: "Ett bolag med växande omsättning och ansträngd kassa har oftast ett finansieringsproblem, inte ett lönsamhetsproblem. Det är den lättare av de två att lösa.",
      basis: `Du svarade "${svarSomText(answers.utveckling)}" om det senaste året.`,
    });
  }
  if (
    profilInnehaller(profile.digitalMaturity, "Hög") ||
    profilInnehaller(profile.digitalMaturity, "Medel")
  ) {
    opportunities.push({
      text: "Siffrorna finns redan i ett system. Det gör att underlaget till en prognos eller en kontrollbalansräkning kan tas fram på timmar i stället för veckor.",
      basis: `Du svarade "${svarSomText(answers.system)}" om ekonomisystem.`,
    });
  }
  opportunities.push({
    text: "Att du gör det här nu, innan något förfallit, är i sig det som ger flest alternativ. Nästan alla verktyg i en företagskris kräver framförhållning för att fungera.",
    basis: "Gäller alla som kommer hit i tid.",
  });

  /* --- gränserna: vad detta INTE är --------------------------------------- */
  const limits: string[] = [
    "Det här är en bild av verksamheten, inte en bedömning av betalningsförmågan. Den bedömningen kräver siffror – löner, skatt, hyra, skulder – som ännu inte är lämnade.",
  ];
  if (filled < 9) {
    limits.push(
      `${9 - filled} av 9 fält i profilen står fortfarande som okända, och observationerna nedan säger ingenting om dem.`,
    );
  }
  if (!input.registryHit) {
    limits.push(
      "Företagsregistret gav inget svar på organisationsnumret, så inget här är kontrollerat mot en offentlig källa.",
    );
  }

  const headline =
    filled === 0
      ? `Jag har ingen bild av ${companyName} än`
      : `Så här ser jag ${companyName} efter ${Object.keys(answers).length} svar`;

  return {
    headline,
    understanding,
    risks,
    opportunities,
    limits,
    nextStep: {
      label: "Gör nulägesanalysen",
      href: "/wizard",
      why: "Där lämnar du siffrorna – löner, skatt, hyra, skulder – och då kan bilden ovan bli en bedömning av vad som faktiskt går att göra.",
    },
  };
};
