import { PREPARE_HEADINGS, TRANSITIONS, type TransitionId } from "@/lib/advisor/prepare";
import { ArrowDown } from "lucide-react";

/**
 * Övergångsrutan: "Förbered användaren" som ett synligt element.
 *
 * Fyra delar i fast ordning - klart, härnäst, varför, hur länge - så att
 * den som läser vet var svaret på sin fråga står utan att leta. Den femte
 * delen, vem som ser uppgifterna, visas bara när någon annan faktiskt
 * gör det; en rad som säger "ingen annan ser detta" på varje steg blir
 * brus, och brus läses inte alls.
 *
 * Rutan är LÄSNING, inte handling: ingen ram som liknar de klickbara
 * korten, ingen accentkulör som konkurrerar med knappen som faktiskt för
 * användaren vidare. Samma regel som lägesbilden på översikten.
 */
export const TransitionNotice = ({ id }: { id: TransitionId }) => {
  const t = TRANSITIONS[id];
  const rows: { heading: string; body: string }[] = [
    { heading: PREPARE_HEADINGS.done, body: t.done },
    { heading: PREPARE_HEADINGS.next, body: t.next },
    { heading: PREPARE_HEADINGS.why, body: t.why },
    { heading: PREPARE_HEADINGS.effort, body: t.effort },
  ];
  if (t.audience) rows.push({ heading: PREPARE_HEADINGS.audience, body: t.audience });

  return (
    <section
      aria-label="Vad som händer härnäst"
      className="cursor-default rounded-md bg-secondary/50 p-4"
    >
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
        Vad som händer härnäst
      </p>
      <dl className="mt-2.5 space-y-2">
        {rows.map((row) => (
          <div key={row.heading} className="text-sm leading-relaxed">
            <dt className="inline font-semibold text-foreground">{row.heading}: </dt>
            <dd className="inline text-foreground/75">{row.body}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};
