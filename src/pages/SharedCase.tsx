import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { data } from "@/data";
import { analyseCrisis } from "@/lib/crisisAnalysis";
import { countdownTo } from "@/lib/actionPlan";
import { parseAmount } from "@/lib/caseAnalysis";
import { buildCaseSnapshot } from "@/lib/advisor/dialog";
import { downloadTextFile } from "@/lib/integrations/download";
import type { SharedCaseView } from "@/data/types";
import { FileDown, Loader2, RadioTower } from "lucide-react";

/**
 * Live ärendelänken, mottagarens vy: länken ÄR ärendet, alltid aktuell.
 *
 * Ingen rapport som skapats manuellt - sidan bygger nuläget ur ärendets
 * data vid varje öppning, med samma deterministiska motorer som resten
 * av produkten. Länken levererar strukturerad, spårbar ärendedata -
 * ALDRIG automatiska bedömningar: mottagarens system (eller mottagarens
 * huvud) drar sina egna slutsatser. Det maskinläsbara formatet är
 * exakt samma datamodell som den mänskliga vyn.
 *
 * Sidan är publik: mottagaren har ingen inloggning. Skyddet ligger i
 * länken själv - tidsbegränsad, återkallbar och åtkomstloggad - och i
 * att svaret är lika tyst för okända, utgångna och återkallade länkar.
 */

const DOT: Record<string, string> = {
  critical: "bg-destructive",
  warning: "bg-warning",
  success: "bg-success",
};

const REVIEW_LABEL: Record<string, string> = {
  approved: "Godkänt",
  in_review: "För granskning",
  draft: "Utkast",
};

const SharedCase = () => {
  const { token } = useParams<{ token: string }>();

  const { data: view, isLoading } = useQuery<SharedCaseView | null>({
    queryKey: ["shared-case", token],
    queryFn: () => data.shares.fetch(token ?? ""),
    retry: false,
    // Live: nuläget hämtas om medan mottagaren har sidan öppen.
    refetchInterval: 30000,
  });

  const now = new Date();
  const derived = view
    ? (() => {
        const timeline = analyseCrisis({
          employees: "",
          canPaySalary: view.canPaySalary,
          canPayTax: view.canPayTax,
          canPayRent: view.canPayRent,
          canPaySuppliers: view.canPaySuppliers,
          salaryAmount: parseAmount(view.salaryAmount),
          salaryDay: view.salaryDay ?? 25,
          taxAmount: parseAmount(view.taxAmount),
          taxDay: view.taxDay ?? 12,
          rentAmount: parseAmount(view.rentAmount),
          rentDay: view.rentDay ?? 1,
          totalDebt: parseAmount(view.totalDebt),
          quickLiquidationValue: parseAmount(view.quickLiquidationValue),
        }).timeline;
        const counted = timeline.map((e) => ({ label: e.label, iso: e.iso, countdown: countdownTo(e.iso, now) }));
        const upcoming = counted
          .filter((c) => c.countdown.tone !== "passed")
          .sort((a, b) => a.countdown.daysLeft - b.countdown.daysLeft);
        const totalDebt = parseAmount(view.totalDebt);
        const liquidation = parseAmount(view.quickLiquidationValue);
        const coverageRatio = totalDebt > 0 ? Math.round((liquidation / totalDebt) * 100) : null;
        return {
          counted,
          rows: buildCaseSnapshot({
            coverageRatio,
            passedDeadlines: counted.filter((c) => c.countdown.tone === "passed").length,
            daysToNextDeadline: upcoming.length ? upcoming[0].countdown.daysLeft : null,
            kbrDone: false,
          }).slice(0, 2),
        };
      })()
    : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex items-center gap-3 px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-accent">
            <span className="text-sm font-bold text-accent-foreground">C</span>
          </div>
          <span className="font-display text-lg tracking-tight text-foreground">CLEARANCE</span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-foreground">
            <RadioTower className="h-3.5 w-3.5 text-success" aria-hidden="true" />
            Live ärendelänk
          </span>
        </div>
      </header>

      <main className="container max-w-3xl px-4 py-8">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden="true" />
          </div>
        ) : !view ? (
          <div className="rounded-md border border-border bg-card p-6">
            <h1 className="font-display text-xl text-foreground">Länken är inte längre giltig</h1>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              Den kan ha återkallats av ärendets ägare eller passerat sin
              giltighetstid. Kontakta den som delade länken för en ny.
            </p>
          </div>
        ) : (
          <>
            <h1 className="font-display text-2xl text-foreground">
              {view.companyName ?? view.orgNumber}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {view.orgNumber} · {view.scope === "full" ? "Fullständig vy" : "Översiktsvy"} ·
              visar ärendets nuläge varje gång sidan öppnas · giltig till{" "}
              {view.expiresAt.slice(0, 10)}
            </p>

            {view.recommendationTitle && (
              <p className="mt-4 rounded-md border border-border bg-card p-4 text-sm leading-relaxed text-foreground">
                <span className="font-semibold">Systemets lägesbedömning: </span>
                {view.recommendationTitle}
              </p>
            )}

            {derived && (
              <section aria-label="Lägesbild" className="mt-5">
                <h2 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Läget just nu
                </h2>
                <ul className="mt-2 space-y-1.5">
                  {derived.rows.map((row) => (
                    <li key={row.label} className="flex items-start gap-2.5 rounded-md border border-border bg-card p-2.5">
                      <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${DOT[row.tone]}`} aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground">{row.label}</span>
                        <span className="block text-xs leading-relaxed text-muted-foreground">{row.note}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {derived && derived.counted.length > 0 && (
              <section aria-label="Bevakade datum" className="mt-5">
                <h2 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Bevakade datum
                </h2>
                <ul className="mt-2 space-y-1.5">
                  {derived.counted.map((row) => (
                    <li key={row.iso + row.label} className="flex items-baseline justify-between gap-3 rounded-md border border-border bg-card p-2.5 text-sm">
                      <span className="min-w-0 font-medium text-foreground">{row.label}</span>
                      <span className={`flex-shrink-0 text-xs ${row.countdown.tone === "passed" ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
                        {row.countdown.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {view.documents && (
              <section aria-label="Handlingar" className="mt-5">
                <h2 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Handlingar ({view.documents.length})
                </h2>
                <ul className="mt-2 space-y-1.5">
                  {view.documents.map((doc) => (
                    <li key={doc.fileName + doc.createdAt} className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-2.5 text-sm">
                      <span className="min-w-0 truncate font-medium text-foreground">{doc.fileName}</span>
                      <span className="flex-shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {REVIEW_LABEL[doc.reviewStatus] ?? doc.reviewStatus}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Maskinläsbart: exakt samma datamodell som vyn ovan. */}
            <div className="mt-6">
              <Button
                variant="outline"
                onClick={() =>
                  downloadTextFile(
                    JSON.stringify(view, null, 2),
                    `arende-${view.orgNumber.replace(/[^0-9]/g, "")}.json`,
                    "application/json;charset=utf-8",
                  )
                }
              >
                <FileDown className="h-4 w-4" aria-hidden="true" />
                Hämta som JSON (maskinläsbart)
              </Button>
            </div>

            <p className="mt-6 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
              Länken visar strukturerad ärendedata - inga automatiska
              bedömningar. Slutsatser dras av mottagaren. Varje öppning loggas
              och länken kan när som helst återkallas av ärendets ägare.
              Innehållet är underlag, inte juridisk eller ekonomisk rådgivning.
            </p>
          </>
        )}
      </main>
    </div>
  );
};

export default SharedCase;
