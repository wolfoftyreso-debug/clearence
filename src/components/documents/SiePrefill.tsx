import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { parseSie, summariseSie, type SieSummary } from "@/lib/financial/sie";
import { AlertCircle, BookOpenCheck, CheckCircle2, FileUp, Loader2 } from "lucide-react";

/**
 * Förifyllnad ur en SIE-fil.
 *
 * Bokföringsprogrammet har redan siffrorna som kontrollbalansfrågan behöver
 * - aktiekapital, tillgångar, skulder - och varje svenskt program kan
 * exportera SIE. Komponenten läser filen lokalt och erbjuder värdena som
 * FÖRSLAG: användaren ser vilka konton siffran kom ur och bekräftar själv,
 * för BAS-intervallen är en konvention, inte en garanti, och ett förifyllt
 * fält som är fel är farligare än ett tomt.
 */

export interface SiePrefillValues {
  shareCapital: number;
  totalAssets: number;
  totalLiabilities: number;
  companyName: string | null;
}

interface SiePrefillProps {
  onApply: (values: SiePrefillValues) => void;
}

const sek = (value: number) =>
  `${String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`;

export const SiePrefill = ({ onApply }: SiePrefillProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SieSummary | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const handleFile = async (file: File) => {
    setError(null);
    setApplied(false);
    setSummary(null);
    setReading(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const outcome = parseSie(bytes);
      if (!outcome.ok) {
        setError(outcome.error);
        return;
      }
      setSummary(summariseSie(outcome.sie));
      setCompanyName(outcome.sie.companyName);
    } finally {
      setReading(false);
    }
  };

  return (
    <div className="rounded-md border border-accent/30 bg-accent/5 p-4">
      <div className="flex items-start gap-3">
        <BookOpenCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            Hämta siffrorna ur bokföringen
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Exportera en SIE-fil från bokföringsprogrammet (Fortnox, Visma, Bokio
            – alla har det under Export) så fylls beloppen i härifrån. Filen läses
            i din webbläsare och skickas ingenstans.
          </p>
        </div>
      </div>

      <div className="mt-3">
        <input
          ref={inputRef}
          type="file"
          accept=".se,.si,.sie,.txt"
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
          size="sm"
          disabled={reading}
          onClick={() => inputRef.current?.click()}
        >
          {reading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <FileUp className="h-4 w-4" aria-hidden="true" />
          )}
          Välj SIE-fil
        </Button>
      </div>

      {error && (
        <p className="mt-3 flex gap-2 text-sm text-destructive" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {summary && !applied && (
        <div className="mt-3 space-y-3">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Aktiekapital (konto 2081)</dt>
              <dd className="font-medium tabular-nums text-foreground">
                {sek(summary.shareCapital)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                Tillgångar ({summary.accountsUsed.assets.length} konton)
              </dt>
              <dd className="font-medium tabular-nums text-foreground">
                {sek(summary.totalAssets)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                Skulder ({summary.accountsUsed.liabilities.length} konton)
              </dt>
              <dd className="font-medium tabular-nums text-foreground">
                {sek(summary.totalLiabilities)}
              </dd>
            </div>
          </dl>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {companyName ? `Ur bokföringen för ${companyName}. ` : ""}
            Beloppen följer BAS-kontoplanens intervall och är ett förslag –
            kontrollera dem mot din senaste balansrapport innan du går vidare.
          </p>
          <Button
            type="button"
            variant="accent"
            size="sm"
            onClick={() => {
              onApply({
                shareCapital: Math.round(summary.shareCapital),
                totalAssets: Math.round(summary.totalAssets),
                totalLiabilities: Math.round(summary.totalLiabilities),
                companyName,
              });
              setApplied(true);
            }}
          >
            Fyll i fälten
          </Button>
        </div>
      )}

      {applied && (
        <p className="mt-3 flex items-center gap-2 text-sm text-success" role="status">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Ifyllt. Kontrollera beloppen – det är du som intygar dem.
        </p>
      )}
    </div>
  );
};
