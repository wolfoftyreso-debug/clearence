/**
 * AI-portföljrapporten: praktikerns personliga arbetsledare.
 *
 * Juristen, rekonstruktören eller förvaltaren ska aldrig behöva fundera på
 * "vad ska jag göra nu?". Rapporten svarar på arbetsledarens frågor: hur
 * många ärenden, vilka kräver åtgärd idag, vad väntar på mig, vad riskerar
 * att bli försenat, och vilket ärende kräver min uppmärksamhet FÖRST.
 *
 * Samma regler som lägesrapporten: deterministisk (samma portfölj ger
 * samma rapport, testbar mening för mening), saklig ton, och
 * arbetsbelastningen är en UPPSKATTNING och sägs vara det - en gissning
 * som låtsas vara mätning är värre än ingen siffra alls.
 */

import { countdownTo } from "@/lib/actionPlan";
import type { Severity } from "@/lib/executiveSummary";
import type { CaseRecord } from "@/data/types";
import type { TimelineEvent } from "@/lib/crisisAnalysis";

export interface PortfolioCase {
  caseRecord: CaseRecord;
  severity: Severity;
  timeline: TimelineEvent[];
  openTasks: number;
  openMentions: number;
}

export interface PortfolioSummary {
  /** Arbetsledarens rader, i den ordning de ska läsas. */
  lines: string[];
  /** Ärendena sorterade efter vad som kräver uppmärksamhet först. */
  ranked: { caseId: string; score: number; reason: string }[];
  /** Uppskattad arbetsinsats idag, i timmar med en decimal. */
  estimatedHours: number;
}

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 400,
  serious: 200,
  elevated: 80,
  stable: 0,
};

export const buildPortfolioSummary = (
  cases: PortfolioCase[],
  now: Date,
): PortfolioSummary => {
  const lines: string[] = [];

  const total = cases.length;
  lines.push(
    total === 1
      ? "Du ansvarar för 1 aktivt ärende."
      : `Du ansvarar för ${total} aktiva ärenden.`,
  );

  // Per ärende: närmaste frist och dess läge.
  const analysed = cases.map((c) => {
    const sorted = [...c.timeline].sort((a, b) => a.iso.localeCompare(b.iso));
    const countdowns = sorted.map((e) => ({ event: e, countdown: countdownTo(e.iso, now) }));
    const passed = countdowns.filter((x) => x.countdown.tone === "passed").length;
    const dueToday = countdowns.filter((x) => x.countdown.tone === "today").length;
    const within24h = countdowns.filter((x) => x.countdown.daysLeft >= 0 && x.countdown.daysLeft <= 1).length;
    const thisWeek = countdowns.filter((x) => x.countdown.daysLeft > 1 && x.countdown.daysLeft <= 7).length;
    return { ...c, passed, dueToday, within24h, thisWeek, next: countdowns[0] ?? null };
  });

  const needsActionToday = analysed.filter((c) => c.passed > 0 || c.dueToday > 0).length;
  if (needsActionToday > 0) {
    lines.push(
      needsActionToday === 1
        ? "Ett ärende kräver åtgärd idag."
        : `${needsActionToday} ärenden kräver åtgärd idag.`,
    );
  }

  const critical24 = analysed.filter((c) => c.within24h > 0).length;
  if (critical24 > 0) {
    lines.push(
      critical24 === 1
        ? "Ett ärende har en kritisk tidsfrist inom 24 timmar."
        : `${critical24} ärenden har kritiska tidsfrister inom 24 timmar.`,
    );
  }

  const waitingOnYou = analysed.filter((c) => c.openMentions > 0);
  if (waitingOnYou.length > 0) {
    const msgs = waitingOnYou.reduce((sum, c) => sum + c.openMentions, 0);
    lines.push(
      msgs === 1
        ? "Ett meddelande väntar på ditt svar."
        : `${msgs} meddelanden väntar på ditt svar, i ${waitingOnYou.length} ${waitingOnYou.length === 1 ? "ärende" : "ärenden"}.`,
    );
  }

  const worsening = analysed.filter((c) => c.severity === "critical").length;
  if (worsening > 0) {
    lines.push(
      worsening === 1
        ? "Ett bolag befinner sig i kritiskt läge – dess frister ligger överst nedan."
        : `${worsening} bolag befinner sig i kritiskt läge – deras frister ligger överst nedan.`,
    );
  }

  const calm = analysed.filter(
    (c) => c.severity === "stable" && c.passed === 0 && c.openTasks === 0 && c.openMentions === 0,
  ).length;
  if (calm > 0 && total > 1) {
    lines.push(
      calm === 1
        ? "Ett ärende är i stabilt läge utan öppna punkter."
        : `${calm} ärenden är i stabilt läge utan öppna punkter.`,
    );
  }

  // Uppskattad arbetsbelastning: 45 min per punkt som kräver åtgärd idag,
  // 20 min per öppen uppgift, 10 min per obesvarat meddelande. En grov
  // schablon, och den presenteras som en uppskattning.
  const minutes = analysed.reduce(
    (sum, c) => sum + (c.passed + c.dueToday) * 45 + c.openTasks * 20 + c.openMentions * 10,
    0,
  );
  const estimatedHours = Math.round((minutes / 60) * 10) / 10;
  if (minutes > 0) {
    lines.push(`Den uppskattade arbetsinsatsen för de öppna punkterna är cirka ${String(estimatedHours).replace(".", ",")} timmar.`);
  } else if (total > 0) {
    lines.push("Inga öppna punkter kräver dig just nu – portföljen är under kontroll.");
  }

  // Rangordningen: vilket ärende kräver uppmärksamhet FÖRST.
  const ranked = analysed
    .map((c) => {
      let score = SEVERITY_WEIGHT[c.severity];
      score += c.passed * 300 + c.dueToday * 250 + c.within24h * 150 + c.thisWeek * 40;
      score += c.openMentions * 60 + c.openTasks * 10;
      const reason =
        c.passed > 0
          ? "passerad frist"
          : c.dueToday > 0
            ? "frist idag"
            : c.openMentions > 0
              ? "väntar på ditt svar"
              : c.next
                ? `nästa frist ${c.next.countdown.label}`
                : "inga öppna frister";
      return { caseId: c.caseRecord.id, score, reason };
    })
    .sort((a, b) => b.score - a.score);

  return { lines, ranked, estimatedHours };
};
