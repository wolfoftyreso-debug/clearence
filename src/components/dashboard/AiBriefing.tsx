import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { data } from "@/data";
import { buildExecutiveSummary, type ActionHorizon } from "@/lib/executiveSummary";
import { GlossaryText, SimplerLanguageSuggestion, useLanguageLevel } from "@/components/language/GlossaryText";
import { LANGUAGE_LEVELS, setLanguageLevel } from "@/lib/language";
import {
  PRESENTATION_MODES,
  getCompactScope,
  getPresentationMode,
  setCompactScope,
  setPresentationMode,
  toBullets,
  toCompact,
  toTimelineRows,
  type PresentationMode,
} from "@/lib/presentation";
import type { CaseRecord } from "@/data/types";
import type { TimelineEvent } from "@/lib/crisisAnalysis";
import { ArrowRight, Compass, Activity } from "lucide-react";

/**
 * Systemanalysen: det första som möter användaren efter inloggning.
 *
 * Ingen lista, ingen chatbot - en ledningssammanfattning skriven som om en
 * erfaren rekonstruktör just satt sig in i bolaget. Innehållet byggs av
 * den deterministiska motorn i src/lib/executiveSummary.ts ur ärendets
 * samtliga registrerade uppgifter, och uppdateras automatiskt varje gång
 * någon uppgift ändras - det är därför informationsraden kan lova det.
 *
 * Känslan som eftersträvas: "Nu förstår jag exakt var vi står."
 */

const SEVERITY_TONE: Record<string, string> = {
  stable: "border-success/40 bg-success/10 text-foreground",
  elevated: "border-warning/50 bg-warning/10 text-foreground",
  serious: "border-warning/60 bg-warning/15 text-foreground",
  critical: "border-frist/50 bg-frist/10 text-frist",
};

const HORIZON_TONE: Record<ActionHorizon, string> = {
  omedelbart: "border-frist/50 bg-frist/10 text-frist",
  idag: "border-frist/40 bg-frist/5 text-foreground",
  "denna vecka": "border-warning/50 bg-warning/10 text-foreground",
  "kan vänta": "border-border bg-secondary/40 text-muted-foreground",
};

interface AiBriefingProps {
  caseRecord: CaseRecord;
  timeline: TimelineEvent[];
}

export const AiBriefing = ({ caseRecord, timeline }: AiBriefingProps) => {
  // Läsarens språknivå styr presentationen av HELA rapporten. Innehållet
  // är detsamma - motorn i src/lib/language.ts anpassar bara språket, och
  // begreppen förblir klickbara på alla nivåer.
  const level = useLanguageLevel();
  // Presentationsformen och omfånget: samma rapport som text, punktlista
  // eller tidslinje, kort eller utförlig. Rena transformer - formerna kan
  // aldrig säga emot varandra.
  const [mode, setMode] = useState<PresentationMode>(getPresentationMode);
  const [compact, setCompact] = useState<boolean>(getCompactScope);
  const chooseMode = (next: PresentationMode) => {
    setMode(next);
    setPresentationMode(next);
  };
  const chooseCompact = (next: boolean) => {
    setCompact(next);
    setCompactScope(next);
  };
  const { data: tasks } = useQuery({
    queryKey: ["case-tasks", caseRecord.id],
    queryFn: () => data.tasks.listByCase(caseRecord.id),
    retry: false,
  });
  const { data: members } = useQuery({
    queryKey: ["case-members", caseRecord.id],
    queryFn: () => data.members.listMembers(caseRecord.id),
    retry: false,
  });
  const { data: kbr } = useQuery({
    queryKey: ["kbr-latest", caseRecord.id],
    queryFn: () => data.kbr.getLatestByCase(caseRecord.id),
    retry: false,
  });
  const { data: documents } = useQuery({
    queryKey: ["case-documents", caseRecord.id],
    queryFn: () => data.documents.listByCase(caseRecord.id),
    retry: false,
  });
  const { data: payments } = useQuery({
    queryKey: ["case-payments", caseRecord.id],
    queryFn: () => data.payments.listByCase(caseRecord.id),
    retry: false,
  });
  // Samma ärende, olika vy: rådgivarrollen får juridisk analys och
  // processläge utöver bolagets rapport. En datamodell, rollanpassad
  // presentation.
  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => data.profile.getMine(),
    retry: false,
  });

  const summary = buildExecutiveSummary({
    caseRecord,
    timeline,
    tasks: tasks ?? [],
    members: members ?? [],
    kbr: kbr ?? null,
    documentCount: (documents ?? []).length,
    payments: payments ?? [],
    now: new Date(),
    audience: profile?.role === "advisor" ? "practitioner" : "company",
  });

  const horizons: ActionHorizon[] = ["omedelbart", "idag", "denna vecka", "kan vänta"];

  return (
    <section id="systemanalys" className="mb-6 scroll-mt-20 rounded-md border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Activity className="h-5 w-5 text-accent" aria-hidden="true" />
          Systemanalys
        </h2>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${SEVERITY_TONE[summary.severity]}`}
        >
          {summary.severityLabel}
        </span>
      </div>
      {/* Ihopfälld (default): analysen svarar först och fördjupar på
          begäran - inga reglage förrän läsaren bett om hela rapporten. */}
      {!compact && (
      <>
      <p className="mt-1 text-xs text-muted-foreground">
        Rapporten uppdaterades nyss och bygger på all information som finns
        registrerad i ditt ärende. Den uppdateras automatiskt när nya uppgifter
        tillkommer.
      </p>

      {/* Språkväxlingen: samma rapport, fyra språknivåer. */}
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Språknivå för rapporten">
        {LANGUAGE_LEVELS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setLanguageLevel(option.id)}
            aria-pressed={level === option.id}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              level === option.id
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border bg-card text-muted-foreground hover:border-accent/50"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Formväxlingen: text, punktlista eller tidslinje - och omfånget. */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Visningsform för rapporten">
        <span className="text-xs text-muted-foreground">Visning:</span>
        {PRESENTATION_MODES.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => chooseMode(option.id)}
            aria-pressed={mode === option.id}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              mode === option.id
                ? "border-foreground/70 bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:border-accent/50"
            }`}
          >
            {option.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => chooseCompact(!compact)}
          aria-pressed={compact}
          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            compact
              ? "border-foreground/70 bg-foreground text-background"
              : "border-border bg-card text-muted-foreground hover:border-accent/50"
          }`}
        >
          Kort version
        </button>
      </div>

      <div className="mt-3">
        <SimplerLanguageSuggestion />
      </div>
      </>
      )}

      <GlossaryText
        text={summary.headline}
        className="mt-4 text-base font-medium leading-relaxed text-foreground"
      />

      {/* Kort version: de tre viktigaste åtgärderna. En delmängd av
          rapporten, aldrig en omskrivning. */}
      {compact && (
        <>
          <ul className="mt-4 space-y-1.5">
            {toCompact(summary).topActions.map((action) => (
              <li key={`kort-${action.label}`} className="flex items-start gap-3 rounded-md border border-border p-2.5">
                <span className="mt-0.5 w-16 flex-shrink-0 break-words text-[11px] font-bold uppercase leading-tight tracking-wide text-muted-foreground sm:w-24">
                  {action.horizon}
                </span>
                <GlossaryText as="span" text={action.label} className="min-w-0 flex-1 text-sm font-medium text-foreground" />
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => chooseCompact(false)}
            className="mt-3 text-sm font-medium text-accent underline-offset-4 hover:underline"
          >
            Visa hela analysen
          </button>
        </>
      )}

      {!compact && mode === "text" &&
        summary.sections.map((section) => (
          <div key={section.id} className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </h3>
            {section.paragraphs.map((paragraph) => (
              <GlossaryText
                key={paragraph.slice(0, 48)}
                text={paragraph}
                className="mt-2 text-sm leading-relaxed text-foreground/90"
              />
            ))}
          </div>
        ))}

      {!compact && mode === "bullets" &&
        toBullets(summary).map((section) => (
          <div key={section.id} className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {section.items.map((item) => (
                <li key={item.slice(0, 48)}>
                  <GlossaryText as="span" text={item} className="text-sm leading-relaxed text-foreground/90" />
                </li>
              ))}
            </ul>
          </div>
        ))}

      {!compact && mode === "timeline" && (
        <ol className="mt-5 space-y-1.5">
          {toTimelineRows(summary, timeline, new Date()).map((row, index) => (
            <li key={`${row.label}-${index}`} className="flex items-start gap-3 rounded-md border border-border p-2.5">
              <span
                className={`mt-0.5 w-20 flex-shrink-0 break-words text-[11px] font-bold uppercase leading-tight tracking-wide sm:w-24 ${
                  row.tone === "critical" ? "text-frist" : row.tone === "warning" ? "text-warning" : "text-muted-foreground"
                }`}
              >
                {row.when}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{row.label}</span>
                {row.detail && (
                  <GlossaryText as="span" text={row.detail} className="mt-0.5 block text-xs leading-relaxed text-muted-foreground" />
                )}
              </span>
            </li>
          ))}
        </ol>
      )}

      {/* Prioriterad handlingsplan. I tidslinjeformen är åtgärderna redan
          invävda i kronologin och i korta versionen är urvalet gjort. */}
      {!compact && mode !== "timeline" && summary.actions.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Vad måste göras nu?
          </h3>
          <ul className="mt-2 space-y-1.5">
            {horizons.flatMap((horizon) =>
              summary.actions
                .filter((a) => a.horizon === horizon)
                .map((action) => (
                  <li key={`${action.horizon}-${action.label}`}>
                    <Link
                      to={action.href ?? "/dashboard"}
                      className={`group flex items-start gap-3 rounded-md border p-2.5 transition-colors hover:border-accent ${HORIZON_TONE[action.horizon]}`}
                    >
                      <span className="mt-0.5 w-16 flex-shrink-0 break-words text-[11px] font-bold uppercase leading-tight tracking-wide sm:w-24">
                        {action.horizon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground">
                          {action.label}
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                          {action.why}
                        </span>
                      </span>
                      <ArrowRight
                        className="mt-1 h-4 w-4 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                )),
            )}
          </ul>
        </div>
      )}

      {/* Rekommenderad strategi. I korta versionen ligger den bakom
          "Visa hela analysen" - länken ersätter utfälld text, inget raderas. */}
      {!compact && (
        <div className="mt-5 rounded-md border border-accent/30 bg-accent/5 p-4">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
            <Compass className="h-3.5 w-3.5" aria-hidden="true" />
            Rekommenderad strategi
          </h3>
          <GlossaryText text={summary.strategy} className="mt-2 text-sm leading-relaxed text-foreground" />
        </div>
      )}

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Rapporten är systemets analys av ärendets registrerade uppgifter –
        besluten stäms av med revisor eller juridisk rådgivare.
      </p>
    </section>
  );
};
