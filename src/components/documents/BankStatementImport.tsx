import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  decodeStatementBytes,
  parseBankStatement,
  summariseStatement,
  type RecurringSuggestion,
  type StatementSummary,
  type SuggestedCategory,
} from "@/lib/bankStatement";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";

export interface StatementImportSelection {
  /** Closing balance from the statement, when the user chose to apply it. */
  balance: number | null;
  items: RecurringSuggestion[];
}

interface BankStatementImportProps {
  onImport: (selection: StatementImportSelection) => void;
  /** Called with the raw file so the caller can offer to store it. */
  onFileRead?: (file: File) => void;
}

const MAX_BYTES = 10 * 1024 * 1024;

const CATEGORY_LABEL: Record<SuggestedCategory, string> = {
  salary: "Lön",
  tax: "Skatt",
  rent: "Lokal och fast kostnad",
  loan: "Lån",
  supplier: "Leverantör",
  income: "Inbetalning",
  other: "Övrigt",
};

const sek = (value: number) => `${Math.round(value).toLocaleString("sv-SE")} kr`;

export const BankStatementImport = ({ onImport, onFileRead }: BankStatementImportProps) => {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [summary, setSummary] = useState<StatementSummary | null>(null);
  const [skippedCount, setSkippedCount] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [useBalance, setUseBalance] = useState(true);
  const [imported, setImported] = useState(false);

  const reset = () => {
    setError(null);
    setFileName(null);
    setSummary(null);
    setSkippedCount(0);
    setSelected(new Set());
    setImported(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    reset();
    setReading(true);

    try {
      if (file.size > MAX_BYTES) {
        setError("Filen är större än 10 MB. Exportera en kortare period och försök igen.");
        return;
      }

      const bytes = await file.arrayBuffer();
      const outcome = parseBankStatement(decodeStatementBytes(bytes));

      if (!outcome.ok) {
        setError(outcome.error);
        return;
      }

      const result = summariseStatement(outcome.statement.transactions);
      if (!result) {
        setError("Inga transaktioner kunde läsas ur filen.");
        return;
      }

      setFileName(file.name);
      setSummary(result);
      setSkippedCount(outcome.statement.skipped.length);
      // Nothing is pre-selected: the user should look at each suggestion
      // before it lands in their plan.
      setSelected(new Set());
      onFileRead?.(file);
    } catch {
      setError("Filen kunde inte läsas. Kontrollera att det är en CSV-fil från din bank.");
    } finally {
      setReading(false);
    }
  };

  const toggle = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    // The selection changed, so there is something new to add.
    setImported(false);
  };

  const handleImport = () => {
    if (!summary) return;
    onImport({
      balance: useBalance ? summary.closingBalance : null,
      items: summary.recurring.filter((_, index) => selected.has(index)),
    });
    setImported(true);
  };

  return (
    <div className="rounded-md border border-border bg-card">
      <div className="border-b border-border p-5">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent" aria-hidden="true" />
          <div>
            <h3 className="font-semibold text-foreground">Har du ett kontoutdrag?</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Ladda upp ett kontoutdrag som CSV från din internetbank, så läser vi ut
              saldo och återkommande betalningar åt dig. Filen läses i din webbläsare
              och skickas ingenstans.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={reading}
            onClick={() => inputRef.current?.click()}
          >
            {reading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="h-4 w-4" aria-hidden="true" />
            )}
            {fileName ? "Välj en annan fil" : "Välj CSV-fil"}
          </Button>
          {fileName && (
            <span className="ml-3 text-sm text-muted-foreground">{fileName}</span>
          )}
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          I internetbanken heter det oftast &quot;Exportera&quot;, &quot;Ladda ner&quot;
          eller &quot;Spara som fil&quot; på kontohistoriken. Välj CSV om du får välja
          format. Ta gärna med minst två månader – då hittar vi de återkommande
          posterna.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 border-b border-border bg-destructive/5 p-5">
          <AlertTriangle
            className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm text-foreground">{error}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Du kan alltid fylla i posterna för hand nedan i stället.
            </p>
          </div>
        </div>
      )}

      {summary && (
        <div className="p-5">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Period</dt>
              <dd className="font-medium text-foreground">
                {summary.from} – {summary.to}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Transaktioner</dt>
              <dd className="font-medium text-foreground">{summary.transactionCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">In under perioden</dt>
              <dd className="font-medium text-success">{sek(summary.totalIn)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Ut under perioden</dt>
              <dd className="font-medium text-destructive">{sek(summary.totalOut)}</dd>
            </div>
          </dl>

          {skippedCount > 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              {skippedCount} rad{skippedCount === 1 ? "" : "er"} kunde inte tolkas och
              hoppades över. Det är oftast rubrik- eller summeringsrader.
            </p>
          )}

          {summary.closingBalance !== null && (
            <label className="mt-5 flex items-start gap-3 rounded-md border border-border p-4 text-sm">
              <input
                type="checkbox"
                checked={useBalance}
                onChange={(e) => {
                  setUseBalance(e.target.checked);
                  setImported(false);
                }}
                className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[hsl(var(--accent))]"
              />
              <span>
                <span className="font-medium text-foreground">
                  Använd saldot {sek(summary.closingBalance)} som utgångspunkt
                </span>
                <span className="mt-0.5 block text-muted-foreground">
                  Saldot efter sista transaktionen den {summary.to}. Stämmer det inte
                  med dagens saldo kan du ändra det efteråt.
                </span>
              </span>
            </label>
          )}

          <div className="mt-6">
            <h4 className="font-medium text-foreground">
              Återkommande poster vi hittade
            </h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Kryssa i det som ska med i planen. Vi föreslår bara poster som kommit
              tillbaka minst två månader i rad med ungefär samma belopp – gå igenom
              listan, den är en gissning och inte en sanning.
            </p>

            {summary.recurring.length === 0 ? (
              <p className="mt-4 rounded-md border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
                Vi hittade inga tydligt återkommande poster. Det betyder oftast att
                utdraget bara täcker en månad. Fyll i posterna för hand nedan.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-border overflow-hidden rounded-md border border-border">
                {summary.recurring.map((item, index) => (
                  <li key={`${item.label}-${item.amount}-${index}`}>
                    <label className="flex cursor-pointer items-start gap-3 p-4 text-sm hover:bg-secondary/40">
                      <input
                        type="checkbox"
                        checked={selected.has(index)}
                        onChange={() => toggle(index)}
                        className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[hsl(var(--accent))]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">
                          {item.label}
                        </span>
                        <span className="mt-0.5 block text-muted-foreground">
                          {CATEGORY_LABEL[item.category]} · den {item.dayOfMonth}:e ·
                          sedd i {item.months} månader
                        </span>
                      </span>
                      <span
                        className={
                          item.direction === "in"
                            ? "flex-shrink-0 font-medium text-success"
                            : "flex-shrink-0 font-medium text-destructive"
                        }
                      >
                        {item.direction === "in" ? "+" : "−"}
                        {sek(item.amount)}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="accent"
              onClick={handleImport}
              disabled={
                imported ||
                (selected.size === 0 && !(useBalance && summary.closingBalance !== null))
              }
            >
              {imported ? "Tillagt" : "Lägg till i planen"}
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>
              <X className="h-4 w-4" aria-hidden="true" />
              Rensa
            </Button>
            {imported && (
              <span className="inline-flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Tillagt. Kontrollera posterna nedan.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
