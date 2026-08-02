/**
 * Ärendeminnet: den aktuella och verifierade arbetsmodellen av företaget.
 *
 * Två löften bor här. Det första: Clara frågar aldrig om sådant hon
 * redan vet - kunskapen i modellen används tills användaren ändrar den.
 * Det andra: modellen är ÖPPEN. "Vad jag vet om ditt företag" visar
 * exakt vad systemet arbetar utifrån, med källa per uppgift - en
 * arbetsmodell, aldrig en övervakningsakt.
 *
 * Allt härleds ur journalen och ärendets registrerade uppgifter.
 * Ingenting i modellen är gissat, och därför kan varje rad förklaras.
 */

import type { AuditEventRecord, CaseDecisionRecord, CaseMemberRecord, CaseRecord } from "@/data/types";
import { CASE_ROLE_LABELS } from "@/lib/caseRoles";
import { parseAmount } from "@/lib/caseAnalysis";

export interface WorkingModelRow {
  label: string;
  value: string;
  /** Var uppgiften kommer ifrån - transparensens kärna. */
  source: string;
}

export interface WorkingModelSection {
  id: string;
  title: string;
  rows: WorkingModelRow[];
}

const GOAL_BY_RECOMMENDATION: Record<string, string> = {
  stabilize: "Stabilisera ekonomin och undvika insolvens",
  reconstruction: "Pröva rekonstruktion och säkra fortsatt drift",
  bankruptcy: "Skydda värden och hantera avvecklingsfrågan ordnat",
};

export const buildWorkingModel = (input: {
  caseRecord: CaseRecord;
  decisions: CaseDecisionRecord[];
  members: CaseMemberRecord[];
  nextDeadline: { label: string; daysLeft: number } | null;
  kbrDone: boolean;
}): WorkingModelSection[] => {
  const { caseRecord, decisions, members, nextDeadline, kbrDone } = input;
  const activeDecisions = decisions.filter((d) => d.status === "active");
  const totalDebt = parseAmount(caseRecord.totalDebt);
  const liquidation = parseAmount(caseRecord.quickLiquidationValue);
  const coverage = totalDebt > 0 ? Math.round((liquidation / totalDebt) * 100) : null;

  const sections: WorkingModelSection[] = [
    {
      id: "foretag",
      title: "Företaget",
      rows: [
        {
          label: "Bolag",
          value: caseRecord.companyName
            ? `${caseRecord.companyName} (${caseRecord.orgNumber})`
            : caseRecord.orgNumber,
          source: "ur nulägesanalysen",
        },
        ...(caseRecord.employees
          ? [{ label: "Anställda", value: String(caseRecord.employees), source: "ur nulägesanalysen" }]
          : []),
        ...(coverage !== null
          ? [{ label: "Skuldtäckning", value: `${coverage} % vid snabb avyttring`, source: "ur registrerade skulder och tillgångar" }]
          : []),
      ],
    },
    {
      id: "arbete",
      title: "Arbetet just nu",
      rows: [
        {
          label: "Mål",
          value:
            (caseRecord.recommendationType && GOAL_BY_RECOMMENDATION[caseRecord.recommendationType]) ??
            "Skapa struktur och full bild av läget",
          source: "ur systemets rekommendation",
        },
        {
          label: "Närmast i tiden",
          value: nextDeadline
            ? `${nextDeadline.label} (om ${nextDeadline.daysLeft} dagar)`
            : "Inga bevakade datum framför oss",
          source: "ur fristbevakningen",
        },
        {
          label: "Kontrollbalansbedömningen",
          value: kbrDone ? "Gjord och journalförd" : "Inte gjord än",
          source: "ur ärendets journal",
        },
      ],
    },
    {
      id: "beslut",
      title: "Fattade beslut",
      rows: activeDecisions.length
        ? activeDecisions.slice(0, 3).map((d) => ({
            label: new Date(d.decidedAt).toLocaleDateString("sv-SE", { day: "numeric", month: "short" }),
            value: d.title,
            source: "ur beslutsminnet, med premiss",
          }))
        : [{ label: "–", value: "Inga aktiva beslut protokollförda än", source: "ur beslutsminnet" }],
    },
    {
      id: "personer",
      title: "Personerna kring bolaget",
      rows: members
        .filter((m) => !m.revokedAt)
        .slice(0, 6)
        .map((m) => ({
          label: m.displayName || m.email || "Utan namn",
          value: CASE_ROLE_LABELS[m.role],
          source: "ur deltagarlistan",
        })),
    },
  ];

  return sections.filter((s) => s.rows.length > 0);
};

/* --- sedan sist ------------------------------------------------------------ */

/**
 * "Sedan vi pratades vid har följande hänt" - byggd ur journalen,
 * aldrig påhittad. Händelser efter senaste samtalet översätts till
 * läsbara rader; det egna samtalet räknas inte som nyhet.
 */
const EVENT_LABEL: Record<string, (e: AuditEventRecord) => string | null> = {
  case_documents: (e) => (e.action === "insert" ? `Nytt dokument: ${e.detail ?? "utan namn"}` : null),
  case_decisions: (e) =>
    e.action === "insert" ? `Beslut protokollfört: ${e.detail?.replace(/^beslut: /, "") ?? ""}` : `Ett beslut omprövades`,
  case_tasks: (e) =>
    e.action === "update" && e.detail?.includes("bockades av") ? `Uppgift klar: ${e.detail.replace(" bockades av", "")}` : null,
  case_invitations: (e) =>
    e.action === "update" && e.detail?.includes("tackade ja") ? `${e.detail}` : null,
  conversations: (e) => (e.action === "insert" ? `Ny meddelandetråd startad` : null),
  kbr_assessments: (e) => (e.action === "insert" ? `Kontrollbalansbedömning registrerad` : null),
};

export const sinceLastVisit = (events: AuditEventRecord[], lastVisit: string | null): string[] => {
  if (!lastVisit) return [];
  const lines: string[] = [];
  for (const event of events) {
    if (event.occurredAt <= lastVisit) continue;
    if (event.objectType === "advisor_sessions") continue;
    const translate = EVENT_LABEL[event.objectType];
    const line = translate?.(event);
    if (line && !lines.includes(line)) lines.push(line);
  }
  return lines.slice(0, 4);
};
