import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { downloadReport, downloadReportPdf } from "@/lib/reports/deliver";
import { renderReport } from "@/lib/reports/render";
import type { ReportModel } from "@/lib/reports/types";
import { Download, Printer, X } from "lucide-react";

/**
 * Rapportvisaren: ett helskärmslager INUTI appen, aldrig en ny flik.
 *
 * Beslutet kom från verkligheten: i inbäddade vyer (mobil, den publicerade
 * demon, strikta företagsmiljöer) blockeras window.open tyst och
 * nedladdningar kan blockeras lika tyst - rapportknappen såg trasig ut
 * precis för den som behövde rapporten som mest. Ett lager i samma
 * dokument kan ingen sandlåda stoppa, och PDF görs via webbläsarens egen
 * utskriftsdialog från lagret.
 *
 * En krok i stället för en komponent per sida: alla ställen som visar
 * rapporter (ärenderapporten, fakturor, kvitton, kreditunderlaget) ska gå
 * genom SAMMA väg, annars återuppstår ny-flik-varianten någonstans.
 */
export const useInlineReport = (): {
  open: (model: ReportModel) => void;
  viewer: ReactNode;
} => {
  const [model, setModel] = useState<ReportModel | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const open = (next: ReportModel) => {
    setModel(next);
    setHtml(renderReport(next));
  };

  const viewer =
    html === null ? null : (
      <div
        className="fixed inset-0 z-50 flex flex-col bg-background"
        role="dialog"
        aria-modal="true"
        aria-label="Rapport"
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3">
          <p className="min-w-0 flex-1 truncate font-medium text-foreground">
            {model?.meta.documentTitle ?? "Rapport"}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => frameRef.current?.contentWindow?.print()}
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            Skriv ut / PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => model && downloadReportPdf(model)}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Ladda ner PDF
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => model && downloadReport(model)}
          >
            Spara HTML
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setHtml(null)}
            aria-label="Stäng rapporten"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Stäng
          </Button>
        </div>
        {/* srcDoc i samma dokument: fungerar även där popupfönster och
            nedladdningar blockeras. Innehållet är vår egen rendering. */}
        <iframe
          ref={frameRef}
          srcDoc={html}
          title={model?.meta.documentTitle ?? "Rapport"}
          className="w-full flex-1 border-0 bg-white"
        />
      </div>
    );

  return { open, viewer };
};
