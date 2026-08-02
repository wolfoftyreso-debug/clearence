/**
 * Adaptiv presentation: samma lägesrapport i flera former.
 *
 * Fortsättningen på det adaptiva språket. Språknivån ändrar HUR meningarna
 * låter; presentationsformen ändrar HUR informationen står uppställd:
 *
 *  text        Löpande text - dagens rapport, oförändrad.
 *  bullets     Punktlista: varje mening blir en punkt under sin rubrik.
 *              Ingen mening försvinner och ingen skrivs om - testerna
 *              räknar meningarna före och efter.
 *  timeline    Tidslinje: fristerna med datum och åtgärderna i
 *              horisontordning, som en enda kronologisk lista. Svarar på
 *              "i vilken ordning händer det här?".
 *
 * Utöver formen finns omfånget: kort (rubrik, de tre viktigaste
 * åtgärderna, strategin) eller utförlig (allt). Kort är en delmängd,
 * aldrig en omskrivning - informationen är densamma, bara urvalet skiljer.
 *
 * Allt är rena transformer av den redan byggda rapporten. Ingen ny
 * sanning skapas här - då hade formerna kunnat säga emot varandra.
 */

import type { ActionHorizon, ExecutiveSummary, SummaryAction } from "@/lib/executiveSummary";
import type { TimelineEvent } from "@/lib/crisisAnalysis";
import { countdownTo } from "@/lib/actionPlan";

export type PresentationMode = "text" | "bullets" | "timeline";

export const PRESENTATION_MODES: { id: PresentationMode; label: string }[] = [
  { id: "text", label: "Text" },
  { id: "bullets", label: "Punktlista" },
  { id: "timeline", label: "Tidslinje" },
];

const MODE_KEY = "clearance-presentation-mode";
const SCOPE_KEY = "clearance-presentation-scope";

export const getPresentationMode = (): PresentationMode => {
  try {
    const raw = localStorage.getItem(MODE_KEY);
    if (raw === "text" || raw === "bullets" || raw === "timeline") return raw;
  } catch {
    /* utan lagring: text */
  }
  return "text";
};

export const setPresentationMode = (mode: PresentationMode): void => {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* går inte att spara - valet gäller ändå för vyn */
  }
};

export const getCompactScope = (): boolean => {
  try {
    // Kort version är DEFAULT (Product Excellence rond 2): analysen ska
    // svara först och fördjupa på begäran. Den som valt full behåller full.
    return localStorage.getItem(SCOPE_KEY) !== "full";
  } catch {
    return true;
  }
};

export const setCompactScope = (compact: boolean): void => {
  try {
    localStorage.setItem(SCOPE_KEY, compact ? "compact" : "full");
  } catch {
    /* som ovan */
  }
};

/* --- punktlistan ----------------------------------------------------------- */

export interface BulletSection {
  id: string;
  title: string;
  items: string[];
}

/**
 * Meningsdelningen bevarar förkortningar med punkt inte alls - våra
 * rapporttexter använder inga - och delar aldrig inne i tal: "165 000 kr."
 * avslutar en mening, "25 kap." förekommer inte i rapporterna.
 */
const sentencesOf = (paragraph: string): string[] =>
  paragraph
    .split(/(?<=[.!?])\s+(?=[A-ZÅÄÖ0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

export const toBullets = (summary: ExecutiveSummary): BulletSection[] =>
  summary.sections.map((section) => ({
    id: section.id,
    title: section.title,
    items: section.paragraphs.flatMap(sentencesOf),
  }));

/* --- tidslinjen ------------------------------------------------------------ */

export interface TimelineRow {
  /** "12 aug", "passerad", "omedelbart", "denna vecka" ... */
  when: string;
  label: string;
  detail: string | null;
  tone: "critical" | "warning" | "info";
  /** Sorteringsnyckel; lägre = tidigare/mer akut. */
  order: number;
}

const HORIZON_ORDER: Record<ActionHorizon, number> = {
  omedelbart: 0,
  idag: 1,
  "denna vecka": 2,
  "kan vänta": 3,
};

const shortDate = (iso: string): string => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const months = ["jan", "feb", "mars", "april", "maj", "juni", "juli", "aug", "sep", "okt", "nov", "dec"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
};

/**
 * En enda kronologi: passerade frister först (de är redan fakta), sedan
 * åtgärderna i horisontordning invävda med kommande frister efter dagar
 * kvar. Åtgärder utan datum sorteras på sin horisont: "omedelbart" före
 * en frist om tre dagar, "kan vänta" efter allt datumsatt.
 */
export const toTimelineRows = (
  summary: ExecutiveSummary,
  timeline: TimelineEvent[],
  now: Date,
): TimelineRow[] => {
  const rows: TimelineRow[] = [];

  for (const event of timeline) {
    const countdown = countdownTo(event.iso, now);
    if (countdown.tone === "passed") {
      rows.push({
        when: "passerad",
        label: event.label,
        detail: `Datumet var ${shortDate(event.iso)} (${countdown.label}).`,
        tone: "critical",
        order: -1,
      });
    } else {
      rows.push({
        when: countdown.tone === "today" ? "idag" : shortDate(event.iso),
        label: event.label,
        detail: countdown.tone === "today" ? "Sista dagen." : `Om ${countdown.daysLeft} dagar.`,
        tone: countdown.tone === "today" ? "critical" : countdown.daysLeft <= 3 ? "warning" : "info",
        // Datumsatta rader sorteras på dagar kvar, förskjutna så att
        // "omedelbart"-åtgärder (0.0) hamnar före dagens frister (0.5).
        order: 0.5 + countdown.daysLeft,
      });
    }
  }

  for (const action of summary.actions) {
    rows.push({
      when: action.horizon,
      label: action.label,
      detail: action.why,
      tone: action.horizon === "omedelbart" || action.horizon === "idag" ? "critical" : action.horizon === "denna vecka" ? "warning" : "info",
      order: HORIZON_ORDER[action.horizon] === 0 ? 0 : HORIZON_ORDER[action.horizon] * 3.6,
    });
  }

  return rows.sort((a, b) => a.order - b.order);
};

/* --- omfånget -------------------------------------------------------------- */

export interface CompactSummary {
  headline: string;
  topActions: SummaryAction[];
  strategy: string;
}

/** Kort version: en delmängd av rapporten, aldrig en omskrivning. */
export const toCompact = (summary: ExecutiveSummary): CompactSummary => {
  const byUrgency = [...summary.actions].sort(
    (a, b) => HORIZON_ORDER[a.horizon] - HORIZON_ORDER[b.horizon],
  );
  return {
    headline: summary.headline,
    topActions: byUrgency.slice(0, 3),
    strategy: summary.strategy,
  };
};
