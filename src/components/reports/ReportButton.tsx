import { useState } from "react";
import { Button } from "@/components/ui/button";
import { downloadReport } from "@/lib/reports/deliver";
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
  const { open, viewer } = useInlineReport();

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
      const result = downloadReport(build());
      if (!result.ok) setError(result.reason);
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
          Spara fil
        </Button>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Rapporten visas här i appen. Välj <strong>Skriv ut</strong> och sedan{" "}
        <strong>Spara som PDF</strong> om du vill ha den som PDF, eller spara
        den som fil för att bifoga i ett mejl.
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
