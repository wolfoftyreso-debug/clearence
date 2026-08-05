import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { downloadReport, reportFileName } from "@/lib/reports/deliver";
import { renderReport } from "@/lib/reports/render";
import { renderReportPdf } from "@/lib/reports/pdf";
import type { ReportModel } from "@/lib/reports/types";
import { Download, FileText, Printer, X } from "lucide-react";

/**
 * Rapportvisaren: ett helskärmslager INUTI appen, aldrig en ny flik.
 *
 * Beslutet kom från verkligheten: i inbäddade vyer (mobil, den publicerade
 * demon, strikta företagsmiljöer) blockeras window.open tyst och
 * nedladdningar kan blockeras lika tyst - rapportknappen såg trasig ut
 * precis för den som behövde rapporten som mest. Ett lager i samma
 * dokument kan ingen sandlåda stoppa.
 *
 * PDF-VÄGEN HAR TVÅ LÄGEN, ETT BUDSKAP VARDERA:
 *  - I en vanlig flik laddas PDF-filen ner direkt. Punkt.
 *  - Inbäddat (window.self !== window.top) kan nedladdningen blockeras
 *    tyst; då VISAS den färdiga PDF:en i visaren i stället, med
 *    webbläsarens egen spara-knapp. Funktionen gör alltid något synligt.
 *
 * Utskriftsbannern som ligger inne i rapportens HTML är till för den
 * NEDLADDADE fristående filen - i visaren döljs den, för här är
 * verktygsraden budskapet. Dubbla utskriftsbudskap var ett verkligt fel.
 *
 * En krok i stället för en komponent per sida: alla ställen som visar
 * rapporter eller levererar PDF (ärenderapporten, fakturor, kvitton,
 * kreditunderlaget, dokumentmallarna) ska gå genom SAMMA väg.
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
  /** Levererar rapporten som PDF: nedladdning, eller inbäddat visning. */
  openPdf: (model: ReportModel) => void;
  /** Samma leverans för färdiga PDF-byte (dokumentmallarna). */
  deliverPdfBytes: (bytes: Uint8Array, fileName: string, title: string) => void;
  viewer: ReactNode;
} => {
  const [model, setModel] = useState<ReportModel | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [pdf, setPdf] = useState<{ url: string; title: string; blob: Blob; fileName: string } | null>(
    null,
  );
  const frameRef = useRef<HTMLIFrameElement>(null);

  const open = (next: ReportModel) => {
    setPdf((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setModel(next);
    // Bannern i dokumentet hör till den sparade fristående filen; i
    // visaren är verktygsraden budskapet. Ett budskap per funktion.
    setHtml(renderReport(next).replace("</head>", "<style>.print-bar{display:none !important}</style></head>"));
  };

  const deliverPdfBytes = (bytes: Uint8Array, fileName: string, title: string) => {
    const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
    if (!isEmbedded()) {
      triggerDownload(blob, fileName);
      return;
    }
    const url = URL.createObjectURL(blob);
    setModel(null);
    setHtml(null);
    setPdf((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return { url, title, blob, fileName };
    });
  };

  /**
   * "Spara filen" i inbäddat läge. iOS-fallet från verkligheten: PDF:en
   * VISAS i lagret, men iOS ritar den utan egen spara-knapp - "det går
   * inte att spara". Delningsmenyn (Web Share med fil) är den väg iOS
   * faktiskt erbjuder: därifrån finns "Spara i Filer", AirDrop och
   * e-post. Där delning med fil inte stöds försöker vi vanlig
   * nedladdning - alltid en synlig väg, aldrig en död knapp.
   */
  const savePdf = async (current: { blob: Blob; fileName: string; title: string }) => {
    const file = new File([current.blob], current.fileName, { type: "application/pdf" });
    const nav = navigator as Navigator & {
      canShare?: (data: { files: File[] }) => boolean;
      share?: (data: { files: File[]; title?: string }) => Promise<void>;
    };
    if (nav.canShare?.({ files: [file] }) && nav.share) {
      try {
        await nav.share({ files: [file], title: current.title });
        return;
      } catch {
        // Avbruten delning är ett val, inte ett fel - och faller
        // delningen ändå, står nedladdningsförsöket nedanför.
      }
    }
    triggerDownload(current.blob, current.fileName);
  };

  const openPdf = (next: ReportModel) => {
    deliverPdfBytes(
      renderReportPdf(next),
      reportFileName(next).replace(/\.html$/, ".pdf"),
      next.meta.documentTitle,
    );
  };

  const close = () => {
    setPdf((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setHtml(null);
    setModel(null);
  };

  const viewer =
    html === null && pdf === null ? null : (
      <div
        className="panel-reveal fixed inset-0 z-50 flex flex-col bg-background"
        role="dialog"
        aria-modal="true"
        aria-label="Rapport"
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3">
          <p className="min-w-0 flex-1 truncate font-medium text-foreground">
            {pdf?.title ?? model?.meta.documentTitle ?? "Rapport"}
          </p>
          {pdf !== null && (
            <Button type="button" variant="accent" size="sm" onClick={() => void savePdf(pdf)}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Spara filen
            </Button>
          )}
          {html !== null && model !== null && (
            <>
              <Button type="button" variant="accent" size="sm" onClick={() => openPdf(model)}>
                <Download className="h-4 w-4" aria-hidden="true" />
                Ladda ner PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => frameRef.current?.contentWindow?.print()}
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                Skriv ut
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => downloadReport(model)}>
                Spara HTML
              </Button>
            </>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={close} aria-label="Stäng rapporten">
            <X className="h-4 w-4" aria-hidden="true" />
            Stäng
          </Button>
        </div>

        {pdf !== null && (
          /* Texten säger vad som ÄR sant: filen är skapad, och knappen
             levererar den. Den lovar INTE en förhandsvisning - den
             lovade det förut, och när webbläsaren blockerade den stod
             produkten och påstod något användaren kunde se var fel.
             Det är värre än att inte visa något alls. */
          <p className="border-b border-border bg-secondary/40 px-4 py-2 text-xs leading-relaxed text-muted-foreground">
            PDF:en är skapad. Tryck på{" "}
            <span className="font-medium text-foreground">Spara filen</span> så laddas den ner –
            eller öppnas i delningsmenyn, där du kan välja t.ex. "Spara i Filer".
          </p>
        )}

        {/* srcDoc i samma dokument: fungerar även där popupfönster och
            nedladdningar blockeras. Innehållet är vår egen rendering. */}
        {html !== null ? (
          <iframe
            ref={frameRef}
            srcDoc={html}
            title={model?.meta.documentTitle ?? "Rapport"}
            className="w-full flex-1 border-0 bg-white"
          />
        ) : pdf !== null ? (
          /*
           * <object> och inte <iframe>: en <object> som inte kan visa sin
           * typ renderar sina BARN i stället. Det är webbens egen
           * inbyggda reservväg, och den behövs här - inbäddat i en
           * sandlåda (den publicerade demon, en app-webbvy) blockerar
           * Chrome PDF-visaren och en iframe blir en grå ruta med
           * "Den här sidan har blockerats". En produkt som visar en
           * blockerad sida ser trasig ut även när filen är helt färdig.
           */
          <object data={pdf.url} type="application/pdf" className="w-full flex-1 bg-white">
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <FileText className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <p className="text-base font-semibold text-foreground">Filen är klar</p>
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                Webbläsaren visar inte inbäddade PDF:er här, så förhandsvisningen uteblir.
                Det påverkar inte filen – den är färdig och innehåller allt.
              </p>
              <Button type="button" variant="accent" onClick={() => void savePdf(pdf)}>
                <Download className="h-4 w-4" aria-hidden="true" />
                Spara filen
              </Button>
              <p className="text-xs text-muted-foreground">{pdf.fileName}</p>
            </div>
          </object>
        ) : null}
      </div>
    );

  return { open, openPdf, deliverPdfBytes, viewer };
};
