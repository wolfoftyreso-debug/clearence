import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { reportFileName } from "@/lib/reports/deliver";
import { renderReport } from "@/lib/reports/render";
import { renderReportPdf } from "@/lib/reports/pdf";
import type { ReportModel } from "@/lib/reports/types";
import { Download, FileText, Printer, X } from "lucide-react";

/**
 * Rapportvisaren: ett helskärmslager INUTI appen.
 *
 * EN VY, INTE TVÅ. Förut öppnades rapporten som HTML, och "Ladda ner PDF"
 * bytte sedan till en ANDRA helskärmsvy med en egen spara-knapp och en egen
 * banner - man klickade fram fakturan, tryckte ladda ner, och hamnade i
 * ännu en vy som sa samma sak igen. Det var dubbla budskap och ett steg för
 * mycket.
 *
 * Nu är nedladdningen en RIKTIG LÄNK i verktygsraden. PDF:en förgenereras
 * när rapporten öppnas, så knappen är en `<a href download>` - ett
 * användarklick på en verklig länk, vilket är det enda som pålitligt tar
 * sig förbi en sandlådas blockering av popup och programmerad nedladdning.
 * Inget vybyte, ingen andra spara-knapp, inget upprepat budskap.
 *
 * Direkt-PDF utan HTML-vy (dokumentmallarna) levereras likadant: i en
 * vanlig flik laddas den ner direkt; inbäddat visas ETT litet kort med EN
 * riktig länk. Aldrig en död knapp, aldrig ett dubbelt budskap.
 */

const isEmbedded = (): boolean => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

const triggerDownload = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

export const useInlineReport = (): {
  open: (model: ReportModel) => void;
  /** Levererar rapporten som PDF direkt (utan HTML-vy först). */
  openPdf: (model: ReportModel) => void;
  /** Samma leverans för färdiga PDF-byte (dokumentmallarna). */
  deliverPdfBytes: (bytes: Uint8Array, fileName: string, title: string) => void;
  viewer: ReactNode;
} => {
  const [model, setModel] = useState<ReportModel | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  /** Den färdiga PDF:en för den öppna HTML-rapporten - som en riktig länk. */
  const [pdf, setPdf] = useState<{ url: string; fileName: string } | null>(null);
  /** Fristående PDF-leverans (dokumentmallar) i inbäddat läge. */
  const [standalone, setStandalone] = useState<{ url: string; fileName: string; title: string } | null>(
    null,
  );
  const frameRef = useRef<HTMLIFrameElement>(null);

  const clearPdf = () =>
    setPdf((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  const clearStandalone = () =>
    setStandalone((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });

  const open = (next: ReportModel) => {
    clearStandalone();
    setModel(next);
    // Bannern i dokumentet hör till den sparade fristående filen; i
    // visaren är verktygsraden budskapet. Ett budskap per funktion.
    setHtml(
      renderReport(next).replace(
        "</head>",
        "<style>.print-bar{display:none !important}</style></head>",
      ),
    );
    // Förgenerera PDF:en så "Ladda ner PDF" är en riktig länk - ett klick,
    // ingen vybytesdans.
    const fileName = reportFileName(next).replace(/\.html$/, ".pdf");
    const blob = new Blob([renderReportPdf(next) as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    setPdf((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return { url, fileName };
    });
  };

  const deliverPdf = (bytes: Uint8Array, fileName: string, title: string) => {
    const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
    // Vanlig flik: ladda ner direkt, ingen vy behövs.
    if (!isEmbedded()) {
      triggerDownload(blob, fileName);
      return;
    }
    // Inbäddat: ETT litet kort med EN riktig länk.
    const url = URL.createObjectURL(blob);
    setModel(null);
    setHtml(null);
    clearPdf();
    setStandalone((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return { url, fileName, title };
    });
  };

  const openPdf = (next: ReportModel) => {
    deliverPdf(
      renderReportPdf(next),
      reportFileName(next).replace(/\.html$/, ".pdf"),
      next.meta.documentTitle,
    );
  };

  const deliverPdfBytes = (bytes: Uint8Array, fileName: string, title: string) => {
    deliverPdf(bytes, fileName, title);
  };

  const close = () => {
    clearPdf();
    clearStandalone();
    setHtml(null);
    setModel(null);
  };

  const title = standalone?.title ?? model?.meta.documentTitle ?? "Rapport";

  const viewer =
    html === null && standalone === null ? null : (
      <div
        className="panel-reveal fixed inset-0 z-50 flex flex-col bg-background"
        // Rapportvisaren täcker skärmen; verktygsraden och innehållet ska
        // inte hamna under den fasta bannern.
        style={{ paddingBottom: "var(--app-bottom-inset, 0px)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Rapport"
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3">
          <p className="min-w-0 flex-1 truncate font-medium text-foreground">{title}</p>

          {/* HTML-vyn: nedladdningen är en RIKTIG LÄNK till den redan
              skapade PDF:en. Ett klick, ingen andra vy.

              INBÄDDAT ÄR DET INTE EN LÄNK, och det är inte en detalj.
              En sida i en iframe får som regel inte starta en nedladdning
              själv - artefaktvisaren tillåter det aldrig - så ett <a
              download> där gör ingenting alls. Knappen såg levande ut och
              var död, vilket är precis det den här filen finns för att
              inte göra ("Aldrig en död knapp").

              Produkten HAR ett svar för det läget: openPdf lägger fram
              PDF:en i ett eget lager med "PDF:en är skapad" och en
              Spara filen-knapp. Länken gick förbi det svaret. Nu väljs
              vägen efter var vi står. */}
          {html !== null && pdf !== null && (
            <>
              {isEmbedded() ? (
                <Button
                  type="button"
                  variant="accent"
                  size="sm"
                  onClick={() => {
                    if (model) openPdf(model);
                  }}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Ladda ner PDF
                </Button>
              ) : (
                <Button asChild variant="accent" size="sm">
                  <a href={pdf.url} download={pdf.fileName} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Ladda ner PDF
                  </a>
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => frameRef.current?.contentWindow?.print()}
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                Skriv ut
              </Button>
            </>
          )}

          <Button type="button" variant="ghost" size="sm" onClick={close} aria-label="Stäng rapporten">
            <X className="h-4 w-4" aria-hidden="true" />
            Stäng
          </Button>
        </div>

        {/* srcDoc i samma dokument: fungerar även där popupfönster och
            nedladdningar blockeras. Innehållet är vår egen rendering. */}
        {html !== null ? (
          <iframe
            ref={frameRef}
            srcDoc={html}
            title={title}
            className="w-full flex-1 border-0 bg-white"
          />
        ) : standalone !== null ? (
          /* Fristående PDF utan HTML-vy (dokumentmallar). ETT kort, EN
             rubrik, EN riktig länk. Ingen andra spara-knapp, inget upprepat
             budskap - det var precis det som gjorde fakturaflödet rörigt. */
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="max-w-sm text-center">
              <FileText className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <p className="mt-2 text-base font-semibold text-foreground">PDF:en är klar</p>
              <p className="mt-1 text-xs text-muted-foreground">{standalone.fileName}</p>
              <Button asChild variant="accent" className="mt-3">
                <a
                  href={standalone.url}
                  download={standalone.fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Öppna eller spara PDF
                </a>
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    );

  return { open, openPdf, deliverPdfBytes, viewer };
};
