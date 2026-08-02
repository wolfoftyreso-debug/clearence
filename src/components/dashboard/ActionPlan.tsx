import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { data } from "@/data";
import { countdownTo, type Countdown } from "@/lib/actionPlan";
import type { CaseRecord } from "@/data/types";
import type { TimelineEvent } from "@/lib/crisisAnalysis";
import { matchProfessionals, playbookForTask, type TaskContext } from "@/lib/taskIntelligence";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarClock, CheckCircle2, ChevronDown, ListTodo, Loader2, Plus, Wand2 } from "lucide-react";

/**
 * Handlingsplanen: ärendets klockor och dess checklista, överst på
 * översikten.
 *
 * Fram tills nu dog utvärderingens "nästa steg" som text på resultatsidan,
 * och fristerna levde bara inne i rapporten. Det här är produktens hjärta i
 * inloggat läge: det enda stället där frågan "vad ska jag göra, och före
 * vilket datum?" besvaras varje gång man loggar in.
 *
 * Två delar, medvetet olika till sin natur:
 *
 *  - FRISTERNA räknas fram ur ärendets data vid varje rendering. De går
 *    inte att bocka av - en lagstadgad frist försvinner inte för att man
 *    känner sig klar med den. Passerade frister ligger KVAR överst, i
 *    fristfärg: de är olösta problem, inte historia.
 *
 *  - UPPGIFTERNA är avbockningsbara och sparas i ärendet, synliga för alla
 *    med ärendeåtkomst. Vem som bockade av och när revisionsloggas - i en
 *    ABL 25 kap.-process är "vi gjorde X den Y" något styrelsen vill kunna
 *    belägga.
 */

const toneClass: Record<Countdown["tone"], string> = {
  passed: "border-frist/40 bg-frist/10 text-frist",
  today: "border-frist/40 bg-frist/10 text-frist",
  soon: "border-warning/40 bg-warning/10 text-foreground",
  later: "border-border bg-secondary/40 text-muted-foreground",
};

const sek = (value: number) =>
  `${String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`;

interface ActionPlanProps {
  caseRecord: CaseRecord;
  timeline: TimelineEvent[];
}

export const ActionPlan = ({ caseRecord, timeline }: ActionPlanProps) => {
  const queryClient = useQueryClient();
  const [newLabel, setNewLabel] = useState("");
  const now = new Date();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["case-tasks", caseRecord.id],
    queryFn: () => data.tasks.listByCase(caseRecord.id),
  });

  // Sådden: rekommendationens nästa steg blir uppgifter, en gång.
  // Idempotent i backend (unikt index + ignorerade dubbletter), så en
  // kapplöpning mellan två flikar ger ändå EN lista.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || isLoading || !tasks) return;
    if (tasks.length === 0 && caseRecord.recommendationNextSteps.length > 0) {
      setSeeded(true);
      void data.tasks
        .seed(caseRecord.id, caseRecord.recommendationNextSteps)
        .then(() => queryClient.invalidateQueries({ queryKey: ["case-tasks", caseRecord.id] }));
    }
  }, [seeded, isLoading, tasks, caseRecord, queryClient]);

  // Optimistiskt: rutan bockas i samma ögonblick som klicket, inte när
  // omfrågningen hunnit runt. En kryssruta som inte reagerar på klicket
  // läses som trasig, och nästa klick blir en dubbelväxling.
  const [pendingDone, setPendingDone] = useState<string | null>(null);
  const toggle = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => data.tasks.setDone(id, done),
    onMutate: ({ id, done }) => setPendingDone(done ? id : null),
    onSettled: () => {
      setPendingDone(null);
      queryClient.invalidateQueries({ queryKey: ["case-tasks", caseRecord.id] });
    },
  });

  // Spelbokskontexten: det systemet vet om ärendet, för att kunna öppna en
  // process bakom varje uppgift och se när den är genomförd.
  const { data: members } = useQuery({
    queryKey: ["case-members", caseRecord.id],
    queryFn: () => data.members.listMembers(caseRecord.id),
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
  const { data: kbr } = useQuery({
    queryKey: ["kbr-latest", caseRecord.id],
    queryFn: () => data.kbr.getLatestByCase(caseRecord.id),
    retry: false,
  });
  const { data: professionals } = useQuery({
    queryKey: ["professionals"],
    queryFn: () => data.professionals.listActive(),
    retry: false,
  });
  const taskCtx: TaskContext = {
    caseRecord,
    members: members ?? [],
    documents: documents ?? [],
    payments: payments ?? [],
    kbr: kbr ?? null,
  };
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  // Autoslutförandet: när spelboken ser att processen är genomförd bockas
  // uppgiften av av systemet - och avbockningen hamnar i händelseloggen som
  // allt annat. En gång per uppgift, aldrig i en löpande loop.
  const autoCompleted = useRef(new Set<string>());
  useEffect(() => {
    for (const task of tasks ?? []) {
      if (task.doneAt || autoCompleted.current.has(task.id)) continue;
      if (playbookForTask(task.label, taskCtx).complete) {
        autoCompleted.current.add(task.id);
        void data.tasks.setDone(task.id, true).then(() =>
          queryClient.invalidateQueries({ queryKey: ["case-tasks", caseRecord.id] }),
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, members, documents, payments, kbr]);

  const add = useMutation({
    mutationFn: (label: string) => data.tasks.add(caseRecord.id, label, null),
    onSuccess: () => {
      setNewLabel("");
      queryClient.invalidateQueries({ queryKey: ["case-tasks", caseRecord.id] });
    },
  });

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    const label = newLabel.trim();
    if (label.length < 3) return;
    add.mutate(label);
  };

  const sortedDeadlines = [...timeline].sort((a, b) => a.iso.localeCompare(b.iso));
  const open = (tasks ?? []).filter((t) => !t.doneAt);
  const done = (tasks ?? []).filter((t) => t.doneAt);

  return (
    <section className="rounded-md border border-border bg-card p-5 shadow-soft">
      <h2 className="flex items-center gap-2 font-semibold text-foreground">
        <ListTodo className="h-5 w-5 text-accent" aria-hidden="true" />
        Nästa steg
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Vad som ska göras, när och varför – så att inget viktigt missas.
      </p>

      {/* Fristerna */}
      {sortedDeadlines.length > 0 && (
        <div className="mt-4">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
            Datum som räknas ned
          </h3>
          <ul className="mt-2 space-y-2">
            {sortedDeadlines.map((event) => {
              const countdown = countdownTo(event.iso, now);
              return (
                <li
                  key={`${event.iso}-${event.label}`}
                  className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md border p-3 ${toneClass[countdown.tone]}`}
                >
                  <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
                    {event.label}
                    {event.amount !== null && (
                      <span className="ml-2 font-normal text-muted-foreground">
                        {sek(event.amount)}
                      </span>
                    )}
                    {event.note && (
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        {event.note}
                      </span>
                    )}
                  </span>
                  <span className="flex-shrink-0 text-sm font-semibold tabular-nums">
                    {new Date(event.iso).toLocaleDateString("sv-SE", {
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    · {countdown.label}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Fristerna går inte att bocka av – en lagstadgad frist försvinner inte
            för att man känner sig klar med den. Passerade datum ligger kvar tills
            uppgifterna bakom dem är lösta.
          </p>
        </div>
      )}

      {/* Uppgifterna */}
      <div className="mt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Att göra
        </h3>
        {isLoading ? (
          <Loader2 className="mt-3 h-5 w-5 animate-spin text-accent" aria-hidden="true" />
        ) : (
          <>
            {open.length === 0 && done.length === 0 && (
              <p className="mt-2 rounded-md bg-secondary/40 p-3 text-sm text-muted-foreground">
                Inga uppgifter än. Lägg till en nedan, eller gör utvärderingen så
                föreslår den nästa steg.
              </p>
            )}
            {open.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {open.map((task) => {
                  const playbook = playbookForTask(task.label, taskCtx);
                  const expanded = expandedTask === task.id;
                  const matches = playbook.offersMatching
                    ? matchProfessionals(caseRecord, professionals ?? [])
                    : [];
                  return (
                    <li key={task.id} className="rounded-md border border-border p-3">
                      <div className="flex items-start gap-3">
                        <input
                          id={`task-${task.id}`}
                          type="checkbox"
                          checked={pendingDone === task.id}
                          disabled={toggle.isPending}
                          onChange={() => toggle.mutate({ id: task.id, done: true })}
                          className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-border accent-accent"
                        />
                        <label
                          htmlFor={`task-${task.id}`}
                          className="min-w-0 flex-1 cursor-pointer text-sm leading-relaxed text-foreground"
                        >
                          {task.label}
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedTask(expanded ? null : task.id)}
                          aria-expanded={expanded}
                          aria-label={expanded ? "Stäng processen" : "Öppna processen"}
                          className="flex flex-shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-accent hover:text-foreground"
                        >
                          <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Så gör du
                          <ChevronDown
                            className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
                            aria-hidden="true"
                          />
                        </button>
                      </div>

                      {expanded && (
                        <div className="mt-3 space-y-3 rounded-md bg-secondary/40 p-3">
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Varför
                            </h4>
                            <p className="mt-1 text-sm leading-relaxed text-foreground/90">
                              {playbook.why}
                            </p>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Underlaget bakom bedömningen
                            </h4>
                            <ul className="mt-1 space-y-0.5">
                              {playbook.basis.map((b) => (
                                <li key={b} className="text-xs leading-relaxed text-muted-foreground">
                                  {b}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            <span className="font-semibold text-foreground/80">Om den inte utförs: </span>
                            {playbook.consequence}
                          </p>

                          {playbook.steps.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Steg för steg
                              </h4>
                              <ul className="mt-1.5 space-y-1">
                                {playbook.steps.map((step) => (
                                  <li key={step.label}>
                                    <Link
                                      to={step.href}
                                      className="group flex items-center gap-2 rounded-md border border-border bg-card p-2 text-sm transition-colors hover:border-accent"
                                    >
                                      <CheckCircle2
                                        className={`h-4 w-4 flex-shrink-0 ${step.done ? "text-success" : "text-border"}`}
                                        aria-hidden="true"
                                      />
                                      <span className={`min-w-0 flex-1 ${step.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                                        {step.label}
                                      </span>
                                      <ArrowRight
                                        className="h-3.5 w-3.5 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                                        aria-hidden="true"
                                      />
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                                När stegen är genomförda slutför systemet uppgiften automatiskt.
                              </p>
                            </div>
                          )}

                          {matches.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Föreslagna rådgivare
                              </h4>
                              <ul className="mt-1.5 space-y-1">
                                {matches.map((m) => (
                                  <li key={m.professional.id} className="rounded-md border border-border bg-card p-2">
                                    <p className="text-sm font-medium text-foreground">
                                      {m.professional.company ?? m.professional.name}
                                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                                        {m.professional.location}
                                      </span>
                                    </p>
                                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                                      Föreslås för att den {m.reasons.join(", ")}.
                                    </p>
                                  </li>
                                ))}
                              </ul>
                              <Link
                                to="/marketplace"
                                className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-accent underline underline-offset-4"
                              >
                                Se alla och skicka förfrågan
                                <ArrowRight className="h-3 w-3" aria-hidden="true" />
                              </Link>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {done.length > 0 && (
              <ul className="mt-2 space-y-1">
                {done.map((task) => (
                  <li key={task.id} className="flex items-start gap-3 px-3 py-1.5">
                    <button
                      type="button"
                      disabled={toggle.isPending}
                      onClick={() => toggle.mutate({ id: task.id, done: false })}
                      aria-label={`Ångra: ${task.label}`}
                      title="Klicka för att ångra"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" aria-hidden="true" />
                    </button>
                    <span className="min-w-0 flex-1 text-sm leading-relaxed text-muted-foreground line-through">
                      {task.label}
                    </span>
                    {task.doneAt && (
                      <span className="flex-shrink-0 text-xs text-muted-foreground">
                        {new Date(task.doneAt).toLocaleDateString("sv-SE", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={handleAdd} className="mt-3 flex gap-2">
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Lägg till en uppgift"
                aria-label="Ny uppgift"
              />
              <Button
                type="submit"
                variant="outline"
                disabled={newLabel.trim().length < 3 || add.isPending}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Lägg till
              </Button>
            </form>
            {(toggle.isError || add.isError) && (
              <p className="mt-2 text-sm text-destructive" role="alert">
                Kunde inte spara. Försök igen.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
};
