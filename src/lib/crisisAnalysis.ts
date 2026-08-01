/**
 * Crisis triage logic for the CLEARANCE wizard.
 *
 * Kept as a pure module so the reasoning can be reviewed and tested on its
 * own - this drives what a company in distress is told to do, so it should
 * not be tangled up in rendering code.
 *
 * IMPORTANT: the legal references below point to the rules a Swedish company
 * is actually judged by, so the output can be checked against them. They are
 * signposts for the user to verify with a professional, not legal advice, and
 * the UI must keep saying so.
 */

import {
  LEGAL_REFS,
  WAGE_GUARANTEE_CEILING,
  WAGE_GUARANTEE_MAX_MONTHS,
  FIGURES_YEAR,
  formatSek,
} from "./officialFigures";

export type RecommendationType = "bankruptcy" | "reconstruction" | "stabilize";
export type Urgency = "immediate" | "weeks" | "months";
export type Severity = "critical" | "warning" | "info";

export interface AnalysisInput {
  canPaySalary: boolean | null;
  canPayTax: boolean | null;
  canPayRent: boolean | null;
  canPaySuppliers: boolean | null;
  salaryAmount: number;
  salaryDay: number;
  taxAmount: number;
  taxDay: number;
  rentAmount: number;
  rentDay: number;
  totalDebt: number;
  quickLiquidationValue: number;
  employees: string;
}

export interface RiskFlag {
  id: string;
  severity: Severity;
  title: string;
  body: string;
  legalRef?: string;
}

export interface TimelineEvent {
  iso: string;
  daysAway: number;
  label: string;
  amount: number | null;
  severity: Severity;
  note?: string;
}

export interface NextStep {
  text: string;
  /** Free-text deadline, e.g. "Före 12 aug". */
  deadline?: string;
  urgent?: boolean;
}

export interface CrisisAnalysis {
  type: RecommendationType;
  title: string;
  description: string;
  urgency: Urgency;
  solvency: {
    indication: "likely_insolvent" | "at_risk" | "no_indication";
    explanation: string;
  };
  coverage: {
    ratio: number | null;
    explanation: string;
  };
  reasons: string[];
  riskFlags: RiskFlag[];
  timeline: TimelineEvent[];
  nextSteps: NextStep[];
}

const MONTHS = [
  "januari", "februari", "mars", "april", "maj", "juni",
  "juli", "augusti", "september", "oktober", "november", "december",
];

const startOfToday = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Next time this day-of-month falls, clamped into short months. */
export const nextOccurrence = (dayOfMonth: number, from: Date = startOfToday()): Date => {
  const clampInto = (year: number, month: number) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(dayOfMonth, daysInMonth));
  };
  let candidate = clampInto(from.getFullYear(), from.getMonth());
  if (candidate < from) {
    candidate = clampInto(from.getFullYear(), from.getMonth() + 1);
  }
  return candidate;
};

const daysBetween = (a: Date, b: Date): number =>
  Math.round((b.getTime() - a.getTime()) / 86_400_000);

const toIso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const formatSwedishDate = (iso: string): string => {
  const parts = iso.split("-").map(Number);
  return `${parts[2]} ${MONTHS[parts[1] - 1]}`;
};

export const analyseCrisis = (input: AnalysisInput): CrisisAnalysis => {
  const today = startOfToday();
  const {
    canPaySalary, canPayTax, canPayRent, canPaySuppliers,
    totalDebt, quickLiquidationValue, employees,
  } = input;

  const cannotPayCount = [canPaySalary, canPayTax, canPayRent, canPaySuppliers]
    .filter((v) => v === false).length;

  const ratio = totalDebt > 0 ? quickLiquidationValue / totalDebt : null;
  const hasEmployees = employees !== "" && employees !== "0";

  // ---- Timeline -----------------------------------------------------------
  const timeline: TimelineEvent[] = [];
  const pushEvent = (
    day: number,
    amount: number,
    label: string,
    canPay: boolean | null,
    note?: string,
  ) => {
    if (!day) return;
    const date = nextOccurrence(day, today);
    timeline.push({
      iso: toIso(date),
      daysAway: daysBetween(today, date),
      label,
      amount: amount || null,
      severity: canPay === false ? "critical" : canPay === true ? "info" : "warning",
      note,
    });
  };

  pushEvent(
    input.taxDay, input.taxAmount, "Skatt/moms förfaller", canPayTax,
    canPayTax === false
      ? "Sista dagen att ha vidtagit åtgärd för att undvika personligt betalningsansvar."
      : undefined,
  );
  pushEvent(
    input.salaryDay, input.salaryAmount, "Löneutbetalning", canPaySalary,
    canPaySalary === false && hasEmployees
      ? "Anställda berörs. Lönegarantin gäller först vid konkurs eller rekonstruktion."
      : undefined,
  );
  pushEvent(input.rentDay, input.rentAmount, "Hyra förfaller", canPayRent);
  timeline.sort((a, b) => a.daysAway - b.daysAway);

  // ---- Solvency indication ------------------------------------------------
  // Obestånd per KonkL 1:2 = oförmåga att betala skulder i takt med att de
  // förfaller, och att oförmågan inte är endast tillfällig.
  let solvency: CrisisAnalysis["solvency"];
  if (canPaySalary === false && canPayTax === false) {
    // Obestånd has two limbs, and the second one is the one that gets
    // forgotten: the inability must not be merely temporary. Assets that can
    // be realised quickly and cover the debts are direct evidence that it may
    // be. Calling that obestånd would push a company with a solvable squeeze
    // towards bankruptcy, which is the most costly direction to be wrong in.
    if (ratio !== null && ratio >= 1) {
      solvency = {
        indication: "at_risk",
        explanation:
          `Varken löner eller skatt kan betalas på förfallodagen, vilket är allvarligt. Samtidigt uppger du att tillgångar som snabbt kan avyttras täcker skulderna i sin helhet. Obestånd förutsätter att betalningsoförmågan inte bara är tillfällig, och den uppgiften talar emot att så är fallet – det ser mer ut som ett likviditetsproblem än som obestånd. Avgörande blir om tillgångarna faktiskt går att omsätta i tid (${LEGAL_REFS.bankruptcy}).`,
      };
    } else if (ratio !== null && ratio >= 0.5) {
      solvency = {
        indication: "at_risk",
        explanation:
          `Varken löner eller skatt kan betalas på förfallodagen. Tillgångarna täcker en betydande del av skulderna, så det är inte givet att betalningsoförmågan är varaktig – och obestånd förutsätter att den inte bara är tillfällig. Läget behöver bedömas av någon som kan värdera hur snabbt tillgångarna går att omsätta (${LEGAL_REFS.bankruptcy}).`,
      };
    } else {
      solvency = {
        indication: "likely_insolvent",
        explanation:
          `När varken löner eller skatt kan betalas på förfallodagen, och tillgångarna inte täcker skulderna, talar mycket för obestånd – alltså att bolaget inte kan betala sina skulder i takt med att de förfaller och att det inte bara är tillfälligt (${LEGAL_REFS.bankruptcy}).`,
      };
    }
  } else if (cannotPayCount >= 2) {
    solvency = {
      indication: "at_risk",
      explanation:
        "Flera betalningar kan inte hållas. Det kan vara en tillfällig likviditetsbrist, men bedöms situationen som varaktig kan det räknas som obestånd.",
    };
  } else {
    solvency = {
      indication: "no_indication",
      explanation:
        "Utifrån dina svar finns inget tydligt tecken på obestånd, men läget är ansträngt och bör följas noga.",
    };
  }

  // ---- Coverage -----------------------------------------------------------
  let coverage: CrisisAnalysis["coverage"];
  if (ratio === null) {
    coverage = { ratio: null, explanation: "Ingen skuld angiven, så täckningsgrad kan inte beräknas." };
  } else {
    const pct = Math.round(ratio * 100);
    // Bands are set so the wording stays consistent with the verdict: a
    // company being told bankruptcy should not simultaneously read that its
    // assets give it "room to manoeuvre".
    if (ratio < 0.2) {
      coverage = {
        ratio,
        explanation: `Det du snabbt kan sälja täcker bara omkring ${pct} % av skulderna. Även om allt avyttras återstår merparten av skulden.`,
      };
    } else if (ratio < 0.5) {
      coverage = {
        ratio,
        explanation: `Det du snabbt kan sälja täcker omkring ${pct} % av skulderna. Det ger visst manöverutrymme men löser inte hela situationen.`,
      };
    } else {
      coverage = {
        ratio,
        explanation: `Det du snabbt kan sälja täcker omkring ${pct} % av skulderna, vilket är en förhållandevis stark position i det här läget.`,
      };
    }
  }

  // ---- Recommendation -----------------------------------------------------
  // Unlike the earlier version, the balance-sheet figures now actually move
  // the outcome: strong asset coverage points toward reconstruction rather
  // than bankruptcy even when payments are being missed.
  let type: RecommendationType;
  let title: string;
  let description: string;
  let urgency: Urgency;

  const decentCoverage = ratio !== null && ratio >= 0.5;

  if (canPaySalary === false && canPayTax === false) {
    if (decentCoverage || canPaySuppliers === true) {
      type = "reconstruction";
      urgency = "immediate";
      title = "Rekonstruktion bör utredas omgående";
      description =
        "Du kan inte betala varken löner eller skatt, vilket är allvarligt. Samtidigt finns tillgångar eller leverantörsrelationer kvar som talar för att verksamheten kan vara värd att rädda. En rekonstruktör bör bedöma det här inom dagar, inte veckor.";
    } else {
      type = "bankruptcy";
      urgency = "immediate";
      title = "Konkurs bör övervägas";
      description =
        "Varken löner eller skatt kan betalas, och tillgångarna täcker bara en mindre del av skulderna. Det talar för obestånd. Sök juridisk hjälp omgående – att fortsätta driva verksamheten vidare kan öka ditt personliga ansvar.";
    }
  } else if (cannotPayCount >= 2) {
    type = "reconstruction";
    urgency = "weeks";
    title = "Företagsrekonstruktion kan vara möjlig";
    description =
      "Du har betalningssvårigheter men verksamheten kan ha förutsättningar att överleva. Rekonstruktion ger skydd mot utmätning och möjlighet att förhandla ned skulder, men kräver att verksamheten bedöms livskraftig.";
  } else if (cannotPayCount === 1) {
    type = "stabilize";
    urgency = "weeks";
    title = "Åtgärda innan det växer";
    description =
      "En betalning kan inte hållas. Det är hanterbart nu, men den här typen av problem sprider sig snabbt om likviditeten inte stärks. Agera medan du fortfarande har handlingsutrymme.";
  } else {
    type = "stabilize";
    urgency = "months";
    title = "Stabilisering och likviditetsåtgärder";
    description =
      "Din situation är pressad men inte akut. Med rätt åtgärder finns goda chanser att stabilisera verksamheten. Fokusera på kassaflödet och håll dialogen igång med borgenärer.";
  }

  // ---- Reasons ------------------------------------------------------------
  const reasons: string[] = [];
  if (canPaySalary === false) reasons.push("Löner kan inte betalas i tid – anställdas trygghet påverkas direkt.");
  if (canPayTax === false) reasons.push("Skatt/moms kan inte betalas i tid – detta utlöser en frist för personligt ansvar.");
  if (canPayRent === false) reasons.push("Hyra kan inte betalas – risk för uppsägning av lokalen.");
  if (canPaySuppliers === false) reasons.push("Leverantörer kan inte betalas – risk för stoppade leveranser.");
  if (canPaySalary === true && canPayTax === true) reasons.push("Både löner och skatt kan betalas – en viktig grund att bygga vidare på.");
  if (coverage.ratio !== null) reasons.push(coverage.explanation);

  // ---- Risk flags ---------------------------------------------------------
  const riskFlags: RiskFlag[] = [];
  const taxEvent = timeline.find((e) => e.label.startsWith("Skatt"));

  if (canPayTax === false) {
    riskFlags.push({
      id: "foretradaransvar",
      severity: "critical",
      title: taxEvent
        ? `Personligt betalningsansvar för skatten – frist ${formatSwedishDate(taxEvent.iso)}`
        : "Personligt betalningsansvar för skatten",
      body:
        "Om bolaget inte betalar skatt eller moms på förfallodagen kan du som företrädare bli personligen betalningsskyldig för beloppet. Ansvaret kan undvikas om du senast på förfallodagen har vidtagit en verksam åtgärd – i praktiken ansökt om konkurs eller företagsrekonstruktion, eller träffat en uppgörelse med Skatteverket. Att vänta och hoppas är den kostsamma vägen här.",
      legalRef: LEGAL_REFS.representativeLiability,
    });
  }

  if (canPaySalary === false && hasEmployees) {
    riskFlags.push({
      id: "lonegaranti",
      severity: "warning",
      title: "Anställdas löner och lönegarantin",
      body:
        `Den statliga lönegarantin täcker anställdas löner upp till ${formatSek(WAGE_GUARANTEE_CEILING)} per anställd (fyra prisbasbelopp, ${FIGURES_YEAR}) och i högst ${WAGE_GUARANTEE_MAX_MONTHS} månader. Den träder in först vid konkurs eller företagsrekonstruktion – inte bara för att bolaget saknar pengar. Dröjer du med beslutet kan personalen bli stående utan både lön och garanti. Det belopp som gäller är det som är fastställt när beslutet fattas.`,
      legalRef: LEGAL_REFS.wageGuarantee,
    });
  }

  if (type === "bankruptcy" || solvency.indication === "likely_insolvent") {
    riskFlags.push({
      id: "atervinning",
      severity: "warning",
      title: "Var försiktig med vem du betalar nu",
      body:
        "Betalningar som gynnar en enskild borgenär framför andra kan återvinnas till konkursboet i efterhand, och att prioritera fel kan öka ditt eget ansvar. Gör inga större eller ovanliga betalningar utan att först stämma av med en förvaltare eller jurist.",
      legalRef: LEGAL_REFS.clawback,
    });
    riskFlags.push({
      id: "kbr",
      severity: "warning",
      title: "Kontrollbalansräkning kan redan krävas",
      body:
        "Finns skäl att anta att det egna kapitalet understiger halva det registrerade aktiekapitalet ska styrelsen genast upprätta en kontrollbalansräkning. Görs inte det kan styrelseledamöterna bli personligt ansvariga för skulder som uppkommer därefter.",
      legalRef: LEGAL_REFS.controlBalanceSheet,
    });
  }

  // ---- Next steps ---------------------------------------------------------
  const nextSteps: NextStep[] = [];
  const taxDeadline = taxEvent ? `Före ${formatSwedishDate(taxEvent.iso)}` : undefined;

  if (type === "bankruptcy") {
    nextSteps.push({
      text: "Kontakta en insolvensjurist eller advokat med konkursvana för en inledande genomgång. Konkursförvaltaren utses av tingsrätten först när konkursen är beslutad – den du talar med nu är alltså ett ombud, inte den som kommer att förvalta boet.",
      deadline: taxDeadline,
      urgent: true,
    });
    if (canPayTax === false) {
      nextSteps.push({
        text: "Vidta en verksam åtgärd före skattens förfallodag för att begränsa ditt personliga ansvar.",
        deadline: taxDeadline,
        urgent: true,
      });
    }
    nextSteps.push({ text: "Sammanställ underlag: skuldlista, tillgångsförteckning, senaste bokslut och aktuella kontoutdrag." });
    if (hasEmployees) nextSteps.push({ text: "Informera personalen. De omfattas av lönegarantin när konkursen är beslutad." });
    nextSteps.push({ text: "Gör inga selektiva betalningar till enskilda borgenärer innan du stämt av med en jurist." });
  } else if (type === "reconstruction") {
    nextSteps.push({
      text: `Kontakta en rekonstruktör för att bedöma om verksamheten anses livskraftig – det är kravet för att en ansökan ska gå igenom (${LEGAL_REFS.reconstruction}).`,
      deadline: taxDeadline,
      urgent: urgency === "immediate",
    });
    if (canPayTax === false) {
      nextSteps.push({
        text: "En rekonstruktionsansökan före skattens förfallodag räknas som verksam åtgärd och begränsar ditt personliga ansvar.",
        deadline: taxDeadline,
        urgent: true,
      });
    }
    nextSteps.push({ text: "Ta fram en likviditetsbudget för minst 90 dagar – den behövs både för din egen bedömning och för ansökan." });
    nextSteps.push({ text: "Kontakta nyckelleverantörer innan de hör det från någon annan. Öppenhet ger oftast bättre villkor." });
  } else {
    nextSteps.push({ text: "Gör en likviditetsprognos för de kommande 90 dagarna så du ser exakt när det blir tight." });
    nextSteps.push({ text: "Förhandla betalningsplaner med leverantörer medan du fortfarande betalar i tid – förhandlingsläget är bäst nu." });
    if (canPayTax === false) {
      nextSteps.push({
        text: "Ansök om anstånd hos Skatteverket innan förfallodagen om skatten inte kan betalas.",
        deadline: taxDeadline,
        urgent: true,
      });
    }
    nextSteps.push({ text: "Se över fakturabelåning eller checkkredit för att jämna ut kassaflödet." });
    nextSteps.push({ text: "Överväg att avyttra tillgångar som inte är kritiska för driften." });
  }

  return {
    type, title, description, urgency,
    solvency, coverage, reasons, riskFlags, timeline, nextSteps,
  };
};
