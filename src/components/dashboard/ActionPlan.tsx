import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { data } from "@/data";
import { countdownTo, type Countdown } from "@/lib/actionPlan";
import type { CaseRecord } from "@/data/types";
import type { TimelineEvent } from "@/lib/crisisAnalysis";
import { CalendarClock, CheckCircle2, ListTodo, Loader2, Plus } from "lucide-react";

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
        Handlingsplan
      </h2>

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
                {open.map((task) => (
                  <li key={task.id} className="flex items-start gap-3 rounded-md border border-border p-3">
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
                  </li>
                ))}
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
