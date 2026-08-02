import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { data } from "@/data";
import { useAuth } from "@/hooks/useAuth";
import {
  DIALOG_FLOWS,
  FALLBACK_REPLY,
  answerLabel,
  matchFlow,
  type DialogAssessment,
  type DialogFlow,
} from "@/lib/advisor/dialog";
import type { AdvisorSessionRecord } from "@/data/types";
import { ArrowRight, Compass, Gavel, RotateCcw, Send } from "lucide-react";

/**
 * Samtalet med krisrådgivaren: produktens framsida i dialogform.
 *
 * Användaren beskriver vad som hänt; motorn känner igen situationen,
 * ställer sina frågor en i taget och svarar med en bedömning och
 * konkreta handlingar. Allt är deterministiskt (src/lib/advisor/dialog.ts)
 * - ingen språkmodell, inga gissningar, samma svar på samma frågor.
 *
 * Samtalet journalförs som ärendejournal och bedömningen kan
 * protokollföras som beslut MED premiss - omprövningsvillkoret som gör
 * att systemet senare kan säga "beslutet vilade på X; X har ändrats,
 * vill ni ompröva?". Det är kontinuiteten en generell chatt inte har.
 */

interface ChatEntry {
  who: "user" | "radgivare";
  text: string;
}

const SEVERITY_TONE: Record<DialogAssessment["severity"], string> = {
  critical: "border-frist/50 bg-frist/10 text-frist",
  serious: "border-warning/60 bg-warning/15 text-foreground",
  elevated: "border-warning/50 bg-warning/10 text-foreground",
};

const DashboardSamtal = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();

  const { data: latestCase, isLoading } = useQuery({
    queryKey: ["latest-case", user?.id],
    queryFn: () => data.cases.getLatest(),
    enabled: !!user,
  });
  const { data: decisions } = useQuery({
    queryKey: ["case-decisions", latestCase?.id],
    queryFn: () => data.dialogue.listDecisions(latestCase!.id),
    enabled: !!latestCase,
  });

  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [flow, setFlow] = useState<DialogFlow | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [assessment, setAssessment] = useState<DialogAssessment | null>(null);
  const [input, setInput] = useState("");
  const [decisionSaved, setDecisionSaved] = useState(false);
  const sessionRef = useRef<AdvisorSessionRecord | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const startedFromQuery = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [entries.length, assessment]);

  const currentStep = flow && !assessment ? flow.steps[stepIndex] : null;

  /** Journalför samtalet - varje rad, i den ordning den föll. */
  const persist = (allEntries: ChatEntry[], closed: boolean) => {
    if (!latestCase || !sessionRef.current) return;
    sessionRef.current = {
      ...sessionRef.current,
      closedAt: closed ? new Date().toISOString() : sessionRef.current.closedAt,
      entries: allEntries.map((e) => ({ at: new Date().toISOString(), who: e.who, text: e.text })),
    };
    void data.dialogue.saveSession(sessionRef.current);
  };

  const say = (added: ChatEntry[], closed = false) => {
    setEntries((prev) => {
      const next = [...prev, ...added];
      persist(next, closed);
      return next;
    });
  };

  const startFlow = (chosen: DialogFlow, userText: string) => {
    if (!latestCase) return;
    sessionRef.current = {
      id: crypto.randomUUID(),
      caseId: latestCase.id,
      flowId: chosen.id,
      flowTitle: chosen.title,
      startedAt: new Date().toISOString(),
      closedAt: null,
      entries: [],
    };
    setFlow(chosen);
    setStepIndex(0);
    setAnswers({});
    setAssessment(null);
    setDecisionSaved(false);
    say([
      { who: "user", text: userText },
      { who: "radgivare", text: `Jag förstår – ${chosen.title.toLowerCase()}. Jag behöver ställa några frågor för att bedöma situationen.` },
      { who: "radgivare", text: chosen.steps[0].prompt },
    ]);
  };

  const handleFreeText = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const matched = matchFlow(trimmed);
    if (matched) {
      startFlow(matched, trimmed);
    } else {
      say([{ who: "user", text: trimmed }, ...FALLBACK_REPLY.map((t) => ({ who: "radgivare" as const, text: t }))]);
    }
  };

  const answerStep = (raw: string) => {
    if (!flow || !currentStep) return;
    const nextAnswers = { ...answers, [currentStep.id]: raw };
    setAnswers(nextAnswers);
    const shown = answerLabel(currentStep, raw);
    if (stepIndex + 1 < flow.steps.length) {
      setStepIndex(stepIndex + 1);
      say([
        { who: "user", text: shown },
        { who: "radgivare", text: flow.steps[stepIndex + 1].prompt },
      ]);
    } else {
      const result = flow.assess(nextAnswers);
      setAssessment(result);
      say(
        [
          { who: "user", text: shown },
          ...result.paragraphs.map((p) => ({ who: "radgivare" as const, text: p })),
        ],
        true,
      );
      queryClient.invalidateQueries({ queryKey: ["case-audit", latestCase?.id] });
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = input;
    setInput("");
    if (currentStep) answerStep(value);
    else handleFreeText(value);
  };

  // Ingången från översikten: frågan följer med i adressen och samtalet
  // börjar direkt - ingen tom sida mellan tanken och svaret.
  useEffect(() => {
    const q = params.get("q");
    if (q && latestCase && !startedFromQuery.current && entries.length === 0) {
      startedFromQuery.current = true;
      handleFreeText(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, latestCase]);

  const recordDecision = useMutation({
    mutationFn: () =>
      data.dialogue.recordDecision({
        caseId: latestCase!.id,
        title: assessment!.decisionSuggestion!.title,
        rationale: `Beslut efter samtal med rådgivaren (${flow?.title.toLowerCase() ?? "samtal"}). ${assessment!.paragraphs[0]}`,
        premise: assessment!.decisionSuggestion!.premise,
      }),
    onSuccess: () => {
      setDecisionSaved(true);
      queryClient.invalidateQueries({ queryKey: ["case-decisions", latestCase?.id] });
    },
  });

  const [reconsiderFor, setReconsiderFor] = useState<string | null>(null);
  const [reconsiderNote, setReconsiderNote] = useState("");
  const reconsider = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => data.dialogue.reconsiderDecision(id, note),
    onSuccess: () => {
      setReconsiderFor(null);
      setReconsiderNote("");
      queryClient.invalidateQueries({ queryKey: ["case-decisions", latestCase?.id] });
    },
  });

  const swedishDateTime = useMemo(
    () => (iso: string) =>
      new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" }),
    [],
  );

  return (
    <DashboardShell title="Rådgivaren">
      <div className="mx-auto max-w-3xl">
        {isLoading ? null : !latestCase ? (
          <div className="rounded-md border border-border bg-card p-6">
            <h2 className="font-display text-xl text-foreground">Vi börjar med läget</h2>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              Rådgivaren arbetar i ett ärende. Gör den fria nulägesanalysen först –
              den skapar ärendet och ger samtalet något att stå på.
            </p>
            <Button variant="accent" className="mt-6" onClick={() => navigate("/wizard")}>
              Starta utvärderingen
            </Button>
          </div>
        ) : (
          <>
            {/* Samtalet */}
            <section aria-label="Samtal med rådgivaren" className="rounded-md border border-border bg-card p-5 shadow-soft">
              {entries.length === 0 && (
                <div>
                  <p className="text-base leading-relaxed text-foreground">
                    Hej! Beskriv vad som har hänt, så tar vi det därifrån – eller
                    välj en situation nedan.
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Samtalet journalförs i ärendets händelselogg. Bedömningarna är
                    systemets analys av det du anger – underlag för beslut, inte
                    juridisk rådgivning.
                  </p>
                </div>
              )}

              {/* Snabbvalen står kvar tills ett flöde faktiskt börjat - även
                  efter fallbacken ska nästa steg vara ett klick bort. */}
              {!flow && !assessment && (
                <div className={`flex flex-wrap gap-2 ${entries.length === 0 ? "mt-4" : "mt-4 border-t border-border pt-4"}`}>
                  {DIALOG_FLOWS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => startFlow(f, f.chip)}
                      className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-accent"
                    >
                      {f.chip}
                    </button>
                  ))}
                </div>
              )}

              <ol className="space-y-3" aria-live="polite">
                {entries.map((entry, i) => (
                  <li key={i} className={entry.who === "user" ? "flex justify-end" : "flex"}>
                    <p
                      className={`max-w-[85%] whitespace-pre-wrap rounded-md px-3.5 py-2.5 text-sm leading-relaxed ${
                        entry.who === "user"
                          ? "bg-accent text-accent-foreground"
                          : "bg-secondary/60 text-foreground"
                      }`}
                    >
                      {entry.text}
                    </p>
                  </li>
                ))}
              </ol>

              {/* Bedömningen: handlingarna och beslutsförslaget. */}
              {assessment && (
                <div className="mt-4 space-y-3">
                  <span
                    className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${SEVERITY_TONE[assessment.severity]}`}
                  >
                    {assessment.severityLabel}
                  </span>
                  <ul className="space-y-1.5">
                    {assessment.actions.map((action) => (
                      <li key={action.label}>
                        <Link
                          to={action.href}
                          className="group flex items-start gap-3 rounded-md border border-border p-2.5 transition-colors hover:border-accent"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-foreground">{action.label}</span>
                            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{action.why}</span>
                          </span>
                          <ArrowRight className="mt-1 h-4 w-4 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {assessment.decisionSuggestion && !decisionSaved && (
                    <div className="rounded-md border border-accent/30 bg-accent/5 p-4">
                      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
                        <Gavel className="h-3.5 w-3.5" aria-hidden="true" />
                        Protokollför beslutet
                      </h3>
                      <p className="mt-2 text-sm font-medium text-foreground">{assessment.decisionSuggestion.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{assessment.decisionSuggestion.premise}</p>
                      <Button
                        size="sm"
                        variant="accent"
                        className="mt-3"
                        disabled={recordDecision.isPending}
                        onClick={() => recordDecision.mutate()}
                      >
                        Protokollför med premiss
                      </Button>
                    </div>
                  )}
                  {decisionSaved && (
                    <p className="rounded-md border border-success/40 bg-success/10 p-3 text-sm text-foreground" role="status">
                      Beslutet är protokollfört med sin premiss. Ändras förutsättningarna
                      finns det här nedan att ompröva.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setFlow(null);
                      setAssessment(null);
                      setStepIndex(0);
                      setEntries([]);
                      sessionRef.current = null;
                      setDecisionSaved(false);
                    }}
                    className="text-sm font-medium text-accent underline-offset-4 hover:underline"
                  >
                    Nytt samtal
                  </button>
                </div>
              )}

              {/* Inmatningen: ja/nej som knappar, annars fritt fält. */}
              {!assessment && currentStep?.kind === "yesno" ? (
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" onClick={() => answerStep("ja")}>Ja</Button>
                  <Button variant="outline" onClick={() => answerStep("nej")}>Nej</Button>
                </div>
              ) : !assessment ? (
                <form onSubmit={submit} className="mt-4 flex gap-2">
                  <label htmlFor="samtal-input" className="sr-only">
                    {currentStep ? currentStep.prompt : "Beskriv vad som har hänt"}
                  </label>
                  <Input
                    id="samtal-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={currentStep?.hint ?? "Beskriv vad som har hänt …"}
                    inputMode={currentStep?.kind === "amount" ? "numeric" : "text"}
                    autoComplete="off"
                  />
                  <Button type="submit" variant="accent" disabled={!input.trim()} aria-label="Skicka">
                    <Send className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </form>
              ) : null}
              <div ref={bottomRef} />
            </section>

            {/* Beslutsminnet */}
            {(decisions ?? []).length > 0 && (
              <section aria-labelledby="beslut-heading" className="mt-6">
                <h2 id="beslut-heading" className="flex items-center gap-2 font-semibold text-foreground">
                  <Compass className="h-5 w-5 text-accent" aria-hidden="true" />
                  Fattade beslut
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Varje beslut står kvar med sin premiss. När verkligheten ändras
                  omprövas beslutet – det gamla skrivs aldrig över.
                </p>
                <ul className="mt-3 space-y-2">
                  {(decisions ?? []).map((d) => (
                    <li key={d.id} className="rounded-md border border-border bg-card p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <p className="font-medium text-foreground">{d.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {swedishDateTime(d.decidedAt)}
                          {d.status === "reconsidered" && d.reconsideredAt
                            ? ` · omprövat ${swedishDateTime(d.reconsideredAt)}`
                            : ""}
                        </p>
                      </div>
                      {d.premise && (
                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{d.premise}</p>
                      )}
                      {d.status === "reconsidered" ? (
                        <p className="mt-2 rounded-md bg-secondary/40 p-2.5 text-xs leading-relaxed text-muted-foreground">
                          Omprövat{d.reconsiderNote ? `: ${d.reconsiderNote}` : "."}
                        </p>
                      ) : reconsiderFor === d.id ? (
                        <form
                          className="mt-2 flex flex-col gap-2 sm:flex-row"
                          onSubmit={(e) => {
                            e.preventDefault();
                            reconsider.mutate({ id: d.id, note: reconsiderNote });
                          }}
                        >
                          <Input
                            value={reconsiderNote}
                            onChange={(e) => setReconsiderNote(e.target.value)}
                            placeholder="Vad har ändrats?"
                            aria-label="Skäl för omprövning"
                          />
                          <Button type="submit" size="sm" variant="outline" disabled={reconsider.isPending}>
                            Ompröva
                          </Button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setReconsiderFor(d.id)}
                          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-accent underline-offset-4 hover:underline"
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                          Ompröva beslutet
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
};

export default DashboardSamtal;
