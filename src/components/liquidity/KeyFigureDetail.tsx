import type { KeyFigure } from "@/lib/liquidityKeyFigures";
import { AlertTriangle, Calculator, X } from "lucide-react";

/**
 * Nyckeltalet uppfällt: posterna, formeln - och gränserna.
 *
 * Ordningen är inte godtycklig. Först VAD talet är räknat på, för det är
 * frågan man klickade för att få svar på. Sedan vad det BETYDER. Sist,
 * och tydligast markerat, vad det INTE säger.
 *
 * Att lägga förbehållen sist är ett medvetet val framför att gömma dem i
 * en fotnot: den som scrollar förbi dem har åtminstone sett dem passera,
 * och den som läser hela vägen får svaret på den fråga hen borde ha
 * ställt men inte visste fanns.
 */
export const KeyFigureDetail = ({
  figure,
  onClose,
}: {
  figure: KeyFigure;
  onClose: () => void;
}) => (
  <section
    aria-label={`Så räknas ${figure.label}`}
    className="mt-4 rounded-md border border-border bg-secondary/40 p-4"
  >
    <div className="flex items-start justify-between gap-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Calculator className="h-4 w-4 text-accent" aria-hidden="true" />
        Så räknas {figure.label.toLowerCase()}
      </p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Stäng"
        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>

    <p className="mt-2 text-sm leading-relaxed text-foreground/85">{figure.formula}</p>

    {figure.rows.length > 0 && (
      <dl className="mt-3 divide-y divide-border rounded-md border border-border bg-card">
        {figure.rows.map((row) => (
          <div key={`${row.label}-${row.value}`} className="flex items-baseline justify-between gap-3 px-3 py-2">
            <dt className="min-w-0 text-sm text-foreground">
              {row.label}
              {row.note && (
                <span className="ml-1.5 text-xs text-muted-foreground">({row.note})</span>
              )}
            </dt>
            <dd className="flex-shrink-0 font-mono text-sm font-medium text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    )}

    <p className="mt-3 text-sm leading-relaxed text-foreground/85">{figure.meaning}</p>

    <div className="mt-3 rounded-md border border-warning/40 bg-warning/5 p-3">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-foreground">
        <AlertTriangle className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
        Det här säger talet inte
      </p>
      <ul className="mt-1.5 space-y-1">
        {figure.limits.map((limit) => (
          <li key={limit.slice(0, 40)} className="text-xs leading-relaxed text-foreground/80">
            {limit}
          </li>
        ))}
      </ul>
    </div>
  </section>
);
