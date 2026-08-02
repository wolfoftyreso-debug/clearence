import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ONBOARDING } from "@/lib/advisor/dialog";
import { Send } from "lucide-react";

/**
 * Det första mötet med Clearance ÄR samtalet - inte en meny, inte ett
 * dashboard, inte en sökruta. CLEARANCE frågar en sak i taget - namn,
 * företag, situation - och öppnar sedan nulägesanalysen själv.
 *
 * Komponenten bor här för att den används på två ställen: startsidan
 * (före inloggning - därför krävs inget konto för att prata) och
 * samtalsvyn för en inloggad användare utan ärende. Samma CLEARANCE, samma
 * ord, oavsett dörr.
 */

interface ChatEntry {
  who: "user" | "radgivare";
  text: string;
}

export const ClaraIntro = ({ onDone }: { onDone: (name: string | null) => void }) => {
  const [entries, setEntries] = useState<ChatEntry[]>(
    ONBOARDING.intro.map((text) => ({ who: "radgivare" as const, text })),
  );
  const [stage, setStage] = useState<"name" | "company" | "situation" | "done">("name");
  const [name, setName] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [entries.length]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = input.trim();
    if (!value) return;
    setInput("");
    if (stage === "name") {
      setName(value);
      setEntries((prev) => [
        ...prev,
        { who: "user", text: value },
        { who: "radgivare", text: ONBOARDING.askCompany(value) },
      ]);
      setStage("company");
    } else if (stage === "company") {
      setEntries((prev) => [
        ...prev,
        { who: "user", text: value },
        { who: "radgivare", text: ONBOARDING.askSituation },
      ]);
      setStage("situation");
    }
  };

  const chooseSituation = (label: string) => {
    setEntries((prev) => [
      ...prev,
      { who: "user", text: label },
      ...ONBOARDING.closing.map((text) => ({ who: "radgivare" as const, text })),
    ]);
    setStage("done");
    // CLEARANCE navigerar - efter en paus lång nog att hinna läsa avslutet.
    window.setTimeout(() => onDone(name), 2600);
  };

  return (
    <section aria-label="Samtal med CLEARANCE" className="rounded-md border border-border bg-card p-5 shadow-soft">
      <ol className="space-y-3" aria-live="polite">
        {entries.map((entry, i) => (
          <li key={i} className={entry.who === "user" ? "flex justify-end" : "flex items-start gap-2"}>
            {entry.who === "radgivare" && (
              <span
                className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground"
                aria-hidden="true"
              >
                C
              </span>
            )}
            <p
              className={`max-w-[85%] whitespace-pre-wrap rounded-md px-3.5 py-2.5 text-sm leading-relaxed ${
                entry.who === "user" ? "bg-accent text-accent-foreground" : "bg-secondary/60 text-foreground"
              }`}
            >
              {entry.text}
            </p>
          </li>
        ))}
      </ol>

      {stage === "situation" && (
        <div className="mt-4 flex flex-col items-start gap-2">
          {ONBOARDING.situations.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => chooseSituation(s.label)}
              className="rounded-full border border-border bg-card px-3.5 py-1.5 text-left text-sm font-medium text-foreground transition-colors hover:border-accent"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {(stage === "name" || stage === "company") && (
        <form onSubmit={submit} className="mt-4 flex gap-2">
          <label htmlFor="onboarding-input" className="sr-only">
            {stage === "name" ? "Vad heter du?" : "Vilket företag gäller det?"}
          </label>
          <Input
            id="onboarding-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={stage === "name" ? "Ditt namn" : "Företagets namn"}
            autoComplete="off"
          />
          <Button type="submit" variant="accent" disabled={!input.trim()} aria-label="Skicka">
            <Send className="h-4 w-4" aria-hidden="true" />
          </Button>
        </form>
      )}
      <div ref={bottomRef} />
    </section>
  );
};
