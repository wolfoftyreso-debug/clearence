import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useInlineReport } from "./useInlineReport";
import type { ReportModel } from "@/lib/reports/types";
import { Download, FileText } from "lucide-react";

interface ReportButtonProps {
  /** Built lazily so a large report is only assembled when asked for. */
  build: () => ReportModel;
  label?: string;
  variant?: "accent" | "outline" | "hero";
  className?: string;
}

/**
 * The single way a report leaves the application.
 *
 * Rapporten visas i appens eget helskärmslager (useInlineReport), aldrig i
 * en ny flik - se kroken för varför. "Spara fil" finns kvar för arkivet
 * och mejlbilagan.
 */
export const ReportButton = ({
  build,
  label = "Skapa rapport",
  variant = "accent",
  className,
}: ReportButtonProps) => {
  const [error, setError] = useState<string | null>(null);
  const { open, openPdf, viewer } = useInlineReport();

  const show = () => {
    setError(null);
    try {
      open(build());
    } catch {
      setError("Rapporten kunde inte skapas. Försök igen.");
    }
  };

  const save = () => {
    setError(null);
    try {
      // Laddar ner i en vanlig flik; inbäddat visas PDF:en i visaren i
      // stället för att en blockerad nedladdning ser ut som ingenting.
      openPdf(build());
    } catch {
      setError("Rapporten kunde inte sparas. Försök igen.");
    }
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant={variant} onClick={show}>
          <FileText className="h-4 w-4" aria-hidden="true" />
          {label}
        </Button>
        <Button type="button" variant="outline" onClick={save}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Ladda ner PDF
        </Button>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Rapporten visas här i appen och kan laddas ner som PDF direkt – för
        arkivet, mejlbilagan eller mötet med rådgivaren.
      </p>
      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {viewer}
    </div>
  );
};
