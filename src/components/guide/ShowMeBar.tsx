import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGuide } from "@/components/guide/GuideProvider";
import { GUIDED_FLOWS } from "@/lib/guide/actions";
import { noMatchMessage, resolveShowMe, type ShowMeResult } from "@/lib/guide/showMe";
import { Compass, Play } from "lucide-react";

/**
 * "VISA MIG."
 *
 * Användaren skriver vad hen letar efter och blir LEDD dit - menyn
 * öppnas, valet ringas in, vyn byts, målet markeras. Ingen
 * skärminspelning, ingen video: användaren är redan i systemet, och det
 * hen ser är sitt eget gränssnitt med sina egna uppgifter i.
 *
 * Uteblir träffen erbjuds alternativ i stället för ett tomt svar. En
 * ruta som säger "jag förstod inte" och inget mer är en återvändsgränd,
 * och produkten har inga sådana.
 */
export const ShowMeBar = () => {
  const guide = useGuide();
  const [query, setQuery] = useState("");
  const [miss, setMiss] = useState<ShowMeResult | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    const result = resolveShowMe(query);
    if (result.entry) {
      setMiss(null);
      setQuery("");
      guide.showMe(result.entry.id);
      return;
    }
    setMiss(result);
  };

  return (
    <section aria-label="Visa mig" className="rounded-md border border-border bg-card p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Compass className="h-4 w-4 text-accent" aria-hidden="true" />
        Visa mig
      </p>
      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
        Skriv vad du letar efter, så leder jag dig dit i gränssnittet i stället för att beskriva
        vägen.
      </p>

      <form onSubmit={submit} className="mt-2.5 flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setMiss(null);
          }}
          placeholder="Var sparas rapporterna?"
          aria-label="Vad vill du att jag visar?"
          data-guide="visa-mig-falt"
          className="w-64"
        />
        <Button type="submit" variant="accent" size="sm" disabled={!query.trim()}>
          Visa mig
        </Button>
      </form>

      {miss && (
        <div className="mt-2.5 rounded-md bg-secondary/50 p-3">
          <p className="text-xs leading-relaxed text-foreground">{noMatchMessage(miss)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {miss.alternatives.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  setMiss(null);
                  setQuery("");
                  guide.showMe(entry.id);
                }}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-accent"
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Guidat arbetsläge: hela flödet, steg för steg, med handen kvar
          hos användaren. */}
      <div className="mt-3 border-t border-border pt-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Eller låt mig gå igenom det med dig
        </p>
        <div className="mt-1.5 space-y-1.5">
          {GUIDED_FLOWS.map((flow) => (
            <div key={flow.id} className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{flow.label}</p>
                {/* Vad flödet leder till, sagt INNAN det börjar. Ingen ska
                    behöva klicka för att få veta vad de tackat ja till. */}
                <p className="text-xs leading-relaxed text-muted-foreground">{flow.outcome}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => guide.runFlow(flow.id)}
                data-guide={`flode-${flow.id}`}
              >
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                Starta
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
