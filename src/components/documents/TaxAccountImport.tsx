import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { parseTaxAccount, type ParsedTaxAccount } from "@/lib/integrations/skattekonto";
import { AlertCircle, CheckCircle2, FileUp, Landmark, Loader2 } from "lucide-react";

/**
 * Import av skattekontoutdrag.
 *
 * Samma mönster som kontoutdragsimporten: filen läses lokalt i webbläsaren
 * och ingenting lämnar datorn förrän användaren själv väljer att lägga in
 * något i ärendet. Skattekontot är krisens viktigaste enskilda datakälla -
 * de kommande debiteringarna är fristerna som styr företrädaransvaret - så
 * det komponenten erbjuder är att lägga in just dem som betalningar i
 * likviditetsplanen, förbockade men avbockningsbara.
 */

export interface TaxImportSelection {
  /** Skattekontots saldo, när utdraget innehöll ett. */
  balance: number | null;
  /** Kommande debiteringar användaren valt att lägga in. */
  charges: { date: string; label: string; amount: number }[];
}

interface TaxAccountImportProps {
  onImport: (selection: TaxImportSelection) => void;
  onFileRead?: (file: File) => void;
}

const MAX_BYTES = 5 * 1024 * 1024;

const sek = (value: number) =>
  `${String(Math.round(Math.abs(value))).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`;

const swedishDate = (iso: string) =>
  new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short" });

export const TaxAccountImport = ({ onImport, onFileRead }: TaxAccountImportProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [account, setAccount] = useState<ParsedTaxAccount | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [useBalance, setUseBalance] = useState(true);
  const [imported, setImported] = useState(false);

  const handleFile = async (file: File) => {
    setError(null);
    setImported(false);
    setAccount(null);
    if (file.size > MAX_BYTES) {
      setError("Filen är större än 5 MB. Exportera en kortare period.");
      return;
    }
    setReading(true);
    setFileName(file.name);
    try {
      const text = await file.text();
      const outcome = parseTaxAccount(text, new Date());
      if (!outcome.ok) {
        setError(outcome.error);
        return;
      }
      setAccount(outcome.account);
      // Kommande förfall förbockade: det är dem man importerar utdraget för.
      setSelected(new Set(outcome.account.upcomingCharges.map((_, i) => i)));
      onFileRead?.(file);
    } finally {
      setReading(false);
    }
  };

  const confirm = () => {
    if (!account) return;
    onImport({
      balance: useBalance ? account.closingBalance : null,
      charges: account.upcomingCharges
        .filter((_, i) => selected.has(i))
        .map((c) => ({
          date: c.date,
          label: `Skattekonto: ${c.specification}`,
          amount: Math.abs(c.amount),
        })),
    });
    setImported(true);
  };

  return (
    <section data-guide="skattekontoutdrag" className="rounded-md border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <Landmark className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-foreground">Skattekontoutdrag</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Exportera kontohändelserna från Skatteverkets e-tjänst och läs in dem
            här. Filen tolkas i din webbläsare – ingenting skickas någonstans.
            Kommande debiteringar kan läggas in som betalningar i
            likviditetsplanen.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt,.skv,text/csv,text/plain"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
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
            <FileUp className="h-4 w-4" aria-hidden="true" />
          )}
          Välj fil från skattekontot
        </Button>
        {fileName && !error && (
          <span className="ml-3 text-sm text-muted-foreground">{fileName}</span>
        )}
      </div>

      {error && (
        <p className="mt-3 flex gap-2 text-sm text-destructive" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {account && !imported && (
        <div className="mt-4 space-y-4">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4 border-b border-border pb-2">
              <dt className="text-muted-foreground">Rader tolkade</dt>
              <dd className="font-medium tabular-nums text-foreground">
                {account.entries.length}
                {account.skipped.length > 0 && (
                  <span className="text-muted-foreground"> ({account.skipped.length} överhoppade)</span>
                )}
              </dd>
            </div>
            {account.closingBalance !== null && (
              <div className="flex justify-between gap-4 border-b border-border pb-2">
                <dt className="text-muted-foreground">Saldo enligt utdraget</dt>
                <dd
                  className={`font-medium tabular-nums ${account.closingBalance < 0 ? "text-frist" : "text-foreground"}`}
                >
                  {account.closingBalance < 0 ? "−" : ""}
                  {sek(account.closingBalance)}
                </dd>
              </div>
            )}
          </dl>

          {account.upcomingCharges.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-foreground">
                Kommande debiteringar – läggs in som betalningar
              </p>
              <ul className="mt-2 divide-y divide-border rounded-md border border-border">
                {account.upcomingCharges.map((charge, i) => (
                  <li key={`${charge.date}-${i}`} className="flex items-center gap-3 p-3 text-sm">
                    <input
                      id={`tax-charge-${i}`}
                      type="checkbox"
                      checked={selected.has(i)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(i);
                        else next.delete(i);
                        setSelected(next);
                      }}
                      className="h-4 w-4 rounded border-border accent-accent"
                    />
                    <label htmlFor={`tax-charge-${i}`} className="min-w-0 flex-1 cursor-pointer">
                      <span className="block truncate text-foreground">{charge.specification}</span>
                      {/* Fristfärg: det här är datum som räknas ned. */}
                      <span className="text-frist">{swedishDate(charge.date)}</span>
                    </label>
                    <span className="flex-shrink-0 font-medium tabular-nums text-foreground">
                      {sek(charge.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="rounded-md bg-secondary/40 p-3 text-sm text-muted-foreground">
              Utdraget innehåller inga debiteringar med framtida datum.
            </p>
          )}

          {account.closingBalance !== null && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={useBalance}
                onChange={(e) => setUseBalance(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-accent"
              />
              Notera skattekontots saldo i ärendet
            </label>
          )}

          <Button
            type="button"
            variant="accent"
            onClick={confirm}
            disabled={selected.size === 0 && !(useBalance && account.closingBalance !== null)}
          >
            Lägg in i ärendet
          </Button>
        </div>
      )}

      {imported && (
        <p className="mt-4 flex items-center gap-2 text-sm text-success" role="status">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Inlagt. Betalningarna syns i likviditetsvyn.
        </p>
      )}
    </section>
  );
};
