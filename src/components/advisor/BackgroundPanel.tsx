import { useEffect, useState } from "react";
import {
  BACKGROUND_STEPS,
  backgroundSummary,
  backgroundTasks,
  DISCLOSURE,
  type BackgroundContext,
} from "@/lib/advisor/backgroundWork";
import { WAITS, waitText } from "@/lib/advisor/prepare";
import { Check, Loader2, MinusCircle, PlugZap } from "lucide-react";

/**
 * Panelen som visar att något faktiskt pågår medan användaren svarar.
 *
 * Den tickar fram ett moment i sekunden. Det är inte en falsk
 * förloppsindikator: varje moment motsvarar ett verkligt steg i
 * analysen, och de som inte kan utföras säger det rakt ut i stället för
 * att bli gröna. En panel där allt blir grönt oavsett vad som hänt är
 * värre än ingen panel, eftersom den lär användaren att bocken inte
 * betyder något.
 */
export const BackgroundPanel = ({ ctx }: { ctx: BackgroundContext }) => {
  const [reached, setReached] = useState(0);

  useEffect(() => {
    if (reached >= BACKGROUND_STEPS) return;
    const t = window.setTimeout(() => setReached((n) => n + 1), 900);
    return () => window.clearTimeout(t);
  }, [reached]);

  const tasks = backgroundTasks(ctx, reached);
  const running = reached < BACKGROUND_STEPS;

  return (
    <section
      aria-label="Bakgrundsanalys"
      className="rounded-md border border-border bg-secondary/30 p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">
          {running ? "Jag arbetar med företagsbilden" : "Företagsbilden så här långt"}
        </p>
        <span className="text-xs tabular-nums text-muted-foreground">
          {Math.min(reached, BACKGROUND_STEPS)}/{BACKGROUND_STEPS}
        </span>
      </div>

      {/* Regel 4: ingen väntetid utan att användaren får veta vad
          systemet arbetar med. Beskedet byggs av waitText, som alla
          andra i produkten. */}
      {running && (
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {waitText(WAITS.backgroundAnalysis)}
        </p>
      )}
      {/* Vad som samlas in och varifrån. Står här, inte i ett villkor
          någon annanstans - den som ser panelen ska se meningen. */}
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{DISCLOSURE}</p>

      <ol className="mt-3 space-y-1.5">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-start gap-2 text-xs leading-relaxed">
            <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center" aria-hidden="true">
              {task.state === "klar" && <Check className="h-3.5 w-3.5 text-success" />}
              {task.state === "pagar" && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              {task.state === "ingen-kalla" && <MinusCircle className="h-3.5 w-3.5 text-muted-foreground" />}
              {task.state === "i-drift" && <PlugZap className="h-3.5 w-3.5 text-primary" />}
            </span>
            <span className={task.state === "pagar" ? "text-muted-foreground" : "text-foreground"}>
              {task.label}
              {task.state === "ingen-kalla" && (
                <span className="text-muted-foreground"> – ingen källa ansluten</span>
              )}
              {task.state === "i-drift" && (
                <span className="text-primary"> – blir live i drift</span>
              )}
              {task.note && <span className="block text-muted-foreground">{task.note}</span>}
            </span>
          </li>
        ))}
      </ol>

      {!running && (
        <p className="mt-3 border-t border-border pt-2 text-xs leading-relaxed text-muted-foreground">
          {backgroundSummary(tasks)}
        </p>
      )}
    </section>
  );
};
