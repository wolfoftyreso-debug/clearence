import { useState } from "react";
import { Button } from "@/components/ui/button";
import { downloadReport, openReport } from "@/lib/reports/deliver";
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
 * The primary action opens the report so the user can save it as a PDF from
 * the print dialog; the secondary saves the file. Both are offered because
 * they are different jobs - one is for the meeting, the other is for the
 * archive - and because a popup blocker must not leave the user with nothing.
 */
export const ReportButton = ({
  build,
  label = "Skapa rapport",
  variant = "accent",
  className,
}: ReportButtonProps) => {
  const [error, setError] = useState<string | null>(null);

  const handle = (action: typeof openReport) => {
    setError(null);
    try {
      const result = action(build());
      if (!result.ok) setError(result.reason);
    } catch {
      setError("Rapporten kunde inte skapas. Försök igen.");
    }
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant={variant} onClick={() => handle(openReport)}>
          <FileText className="h-4 w-4" aria-hidden="true" />
          {label}
        </Button>
        <Button type="button" variant="outline" onClick={() => handle(downloadReport)}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Spara fil
        </Button>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Rapporten öppnas i en ny flik. Välj <strong>Spara som PDF</strong> i
        utskriftsdialogen om du vill ha den som PDF, eller spara den som fil för att
        bifoga i ett mejl.
      </p>
      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
