/**
 * Omprövningsbevakningen: premissen som något som faktiskt bevakas.
 *
 * Beslutsminnet har haft premissen sedan v1, och gränssnittet har lovat
 * att beslut "omprövas när läget ändras". Ingenting bevakade. Ett löfte
 * som produkten inte håller är värre än inget löfte - särskilt det här,
 * eftersom hela poängen med att protokollföra premissen är att veta NÄR
 * beslutet ska upp igen.
 *
 * Varför villkor och inte tolkning av fritexten: premissen är skriven på
 * svenska av en människa. Att gissa vad "prognosen visade positivt
 * kassaflöde inom sex veckor" betyder i siffror vore att hitta på - och
 * ett beslutsunderlag som hittar på är sämre än inget. I stället får
 * premissen ett MÄTBART villkor, valt ur de storheter ärendet faktiskt
 * mäter, och det villkoret räknas om deterministiskt.
 *
 * Tre tillstånd, aldrig fyra: villkoret HÅLLER, det är MOTSAGT, eller så
 * går det inte att avgöra för att uppgiften saknas. "Vet inte" sägs rakt
 * ut i stället för att tolkas som "allt är bra".
 *
 * Och: CLEARANCE omprövar aldrig ett beslut självt. Den flaggar, citerar
 * premissen och visar vad som ändrats. Beslutet är användarens.
 */

import type { PremiseWatch, PremiseComparator, PremiseSignal } from "@/data/types";

/* --- Storheterna som går att bevaka --------------------------------------- */

/**
 * Underlaget bevakningen läser. Samma siffror som lägesbilden och
 * handlingsplanen visar - bevakningen får aldrig ha en egen sanning om
 * ärendet.
 */
export interface PremiseFacts {
  /** Snabba avyttringsvärdet i procent av skulderna. */
  coverageRatio: number | null;
  totalDebt: number | null;
  canPaySalary: boolean | null;
  canPayTax: boolean | null;
  canPayRent: boolean | null;
  canPaySuppliers: boolean | null;
  passedDeadlines: number;
}

type SignalKind = "number" | "boolean";

interface SignalSpec {
  id: PremiseSignal;
  /** Hur storheten benämns mitt i en mening. */
  label: string;
  kind: SignalKind;
  /** Enhet efter talet, inklusive mellanrum om det behövs. */
  unit?: string;
  read: (facts: PremiseFacts) => number | boolean | null;
  /** Sant när ett HÖGRE tal är sämre (skuld, passerade frister). */
  higherIsWorse?: boolean;
  /**
   * Ordningen CLEARANCE föreslår i. Löner före skatt före likviditet:
   * det är allvarsordningen, samma som i handlingsplanen.
   */
  rank: number;
}

export const PREMISE_SIGNALS: readonly SignalSpec[] = [
  {
    id: "loner",
    label: "att lönerna går att betala",
    kind: "boolean",
    read: (f) => f.canPaySalary,
    rank: 1,
  },
  {
    id: "skatt",
    label: "att skatten går att betala",
    kind: "boolean",
    read: (f) => f.canPayTax,
    rank: 2,
  },
  {
    id: "skuldtackning",
    label: "skuldtäckningen",
    kind: "number",
    unit: " %",
    read: (f) => f.coverageRatio,
    rank: 3,
  },
  {
    id: "passerade_frister",
    label: "antalet passerade frister",
    kind: "number",
    unit: "",
    read: (f) => f.passedDeadlines,
    higherIsWorse: true,
    rank: 4,
  },
  {
    id: "hyra",
    label: "att hyran går att betala",
    kind: "boolean",
    read: (f) => f.canPayRent,
    rank: 5,
  },
  {
    id: "leverantorer",
    label: "att leverantörerna går att betala",
    kind: "boolean",
    read: (f) => f.canPaySuppliers,
    rank: 6,
  },
  {
    id: "skuld",
    label: "den totala skulden",
    kind: "number",
    unit: " kr",
    read: (f) => f.totalDebt,
    higherIsWorse: true,
    rank: 7,
  },
] as const;

export const signalSpec = (id: PremiseSignal): SignalSpec | null =>
  PREMISE_SIGNALS.find((s) => s.id === id) ?? null;

/* --- Formatering ---------------------------------------------------------- */

/**
 * Tal i svensk form, med hårt mellanrum så beloppet aldrig bryts över en
 * radbrytning.
 *
 * Både mönstret och ersättningen skrivs som \u00A0, aldrig som det
 * literala tecknet: en osynlig NBSP i källkoden ser ut som ett vanligt
 * mellanslag och har redan lurat den här kodbasen mer än en gång.
 * toLocaleString("sv-SE") kan dessutom ge antingen NBSP eller smalt NBSP
 * beroende på ICU-version, så båda normaliseras till samma tecken.
 */
export const formatSignalValue = (spec: SignalSpec, value: number | boolean): string => {
  if (typeof value === "boolean") return value ? "ja" : "nej";
  const grouped = Math.round(value)
    .toLocaleString("sv-SE")
    .replace(/[\u00A0\u202F\u2009]/g, "\u00A0");
  return `${grouped}${spec.unit ?? ""}`;
};

/**
 * Villkoret som mening. Skrivs så att den går att läsa högt i ett
 * styrelserum: "skuldtäckningen är minst 55 %".
 */
export const describeWatch = (watch: PremiseWatch): string => {
  const spec = signalSpec(watch.signal);
  if (!spec) return "Okänt villkor";
  if (watch.comparator === "sant") return `${capitalise(spec.label)}`;
  if (watch.comparator === "falskt") return `INTE ${spec.label}`;
  const word = watch.comparator === "minst" ? "minst" : "högst";
  return `${capitalise(spec.label)} är ${word} ${formatSignalValue(spec, watch.threshold ?? 0)}`;
};

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/* --- Utvärderingen -------------------------------------------------------- */

export type PremiseState = "holds" | "contradicted" | "unknown";

export interface PremiseEvaluation {
  state: PremiseState;
  /**
   * Vad som gäller NU, som mening. Används både i texten till användaren
   * och som kvitteringens fingeravtryck: ändras observationen kommer
   * frågan tillbaka, annars inte.
   */
  observation: string;
}

export const evaluatePremise = (
  watch: PremiseWatch | null,
  facts: PremiseFacts,
): PremiseEvaluation => {
  if (!watch) return { state: "unknown", observation: "Inget villkor är kopplat till premissen" };
  const spec = signalSpec(watch.signal);
  if (!spec) return { state: "unknown", observation: "Villkoret går inte att tolka" };

  const value = spec.read(facts);
  if (value === null || value === undefined) {
    return { state: "unknown", observation: `${capitalise(spec.label)} saknas i underlaget` };
  }

  const observation =
    spec.kind === "boolean"
      ? `${capitalise(spec.label)}: ${formatSignalValue(spec, value)}`
      : `${capitalise(spec.label)} är ${formatSignalValue(spec, value)}`;

  let holds: boolean;
  switch (watch.comparator) {
    case "sant":
      holds = value === true;
      break;
    case "falskt":
      holds = value === false;
      break;
    case "minst":
      holds = typeof value === "number" && value >= (watch.threshold ?? 0);
      break;
    case "hogst":
      holds = typeof value === "number" && value <= (watch.threshold ?? 0);
      break;
    default:
      return { state: "unknown", observation };
  }
  return { state: holds ? "holds" : "contradicted", observation };
};

/* --- Förslaget vid beslutstillfället -------------------------------------- */

/**
 * Villkor CLEARANCE kan föreslå, byggda ur det som gäller NU.
 *
 * Det är den avgörande finessen: vid beslutstillfället VET vi ärendets
 * värden, så användaren behöver inte hitta på ett tröskelvärde - hen
 * bekräftar det som redan är sant. Ett villkor som är motsagt redan när
 * det sätts vore meningslöst och föreslås aldrig.
 */
export const proposeWatches = (facts: PremiseFacts): PremiseWatch[] => {
  const out: PremiseWatch[] = [];
  for (const spec of [...PREMISE_SIGNALS].sort((a, b) => a.rank - b.rank)) {
    const value = spec.read(facts);
    if (value === null || value === undefined) continue;
    if (typeof value === "boolean") {
      out.push({ signal: spec.id, comparator: value ? "sant" : "falskt", threshold: null });
    } else if (spec.higherIsWorse) {
      out.push({ signal: spec.id, comparator: "hogst", threshold: value });
    } else {
      out.push({ signal: spec.id, comparator: "minst", threshold: value });
    }
  }
  return out;
};

/* --- Vad CLEARANCE säger när premissen inte längre håller ------------------ */

const MONTHS = [
  "januari", "februari", "mars", "april", "maj", "juni",
  "juli", "augusti", "september", "oktober", "november", "december",
];

export const swedishDay = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

/**
 * Larmet: citerar beslutet, citerar premissen, säger vad som ändrats -
 * och lämnar båda dörrarna öppna. Aldrig "du bör ompröva": CLEARANCE
 * fattar inte bolagets beslut.
 */
export const premiseAlert = (input: {
  title: string;
  decidedAt: string;
  watch: PremiseWatch;
  evaluation: PremiseEvaluation;
}): string =>
  [
    `Den ${swedishDay(input.decidedAt)} beslutade ni: ”${input.title}”.`,
    `Villkoret ni satte var: ${describeWatch(input.watch).toLowerCase()}.`,
    `${input.evaluation.observation}.`,
    "Vill du ompröva beslutet, eller står det fast?",
  ].join(" ");

/* --- Sammanställningen ---------------------------------------------------- */

export interface WatchedDecision {
  id: string;
  title: string;
  premise: string | null;
  decidedAt: string;
  status: "active" | "reconsidered";
  watch: PremiseWatch | null;
  watchAckObservation: string | null;
}

export interface PremiseFlag {
  decisionId: string;
  title: string;
  decidedAt: string;
  watch: PremiseWatch;
  evaluation: PremiseEvaluation;
  message: string;
}

/**
 * De beslut vars villkor är motsagt och som inte redan kvitterats för
 * exakt den observationen.
 *
 * Kvitteringen är avsiktligt kopplad till OBSERVATIONEN, inte till
 * beslutet: den som svarat "det står fast" vid 42 % ska inte tjatas på
 * igen vid 42 %, men ska höra av oss igen vid 18 %. Ett "behåll" som
 * tystar för alltid vore ett sätt att tappa bort sitt eget beslut.
 */
export const premiseFlags = (
  decisions: readonly WatchedDecision[],
  facts: PremiseFacts,
): PremiseFlag[] => {
  const flags: PremiseFlag[] = [];
  for (const decision of decisions) {
    if (decision.status !== "active" || !decision.watch) continue;
    const evaluation = evaluatePremise(decision.watch, facts);
    if (evaluation.state !== "contradicted") continue;
    if (decision.watchAckObservation === evaluation.observation) continue;
    flags.push({
      decisionId: decision.id,
      title: decision.title,
      decidedAt: decision.decidedAt,
      watch: decision.watch,
      evaluation,
      message: premiseAlert({
        title: decision.title,
        decidedAt: decision.decidedAt,
        watch: decision.watch,
        evaluation,
      }),
    });
  }
  return flags;
};

/** Etiketten i listan över fattade beslut. Tre lägen, ingen fjärde. */
export const WATCH_STATE_LABEL: Record<PremiseState, string> = {
  holds: "Villkoret håller",
  contradicted: "Villkoret är motsagt",
  unknown: "Går inte att avgöra",
};

/** Villkoret som inte går att sätta: sägs rakt ut, döljs inte. */
export const NO_WATCH_LABEL = "Premissen bevakas inte";

export const isValidWatch = (watch: PremiseWatch): boolean => {
  const spec = signalSpec(watch.signal);
  if (!spec) return false;
  const numeric: PremiseComparator[] = ["minst", "hogst"];
  if (spec.kind === "number") {
    return numeric.includes(watch.comparator) && typeof watch.threshold === "number" && Number.isFinite(watch.threshold);
  }
  return (watch.comparator === "sant" || watch.comparator === "falskt") && watch.threshold === null;
};
