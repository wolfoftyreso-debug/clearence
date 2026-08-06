import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WizardCard, WizardCardHeader } from "@/components/wizard/WizardCard";
import { useAuth } from "@/hooks/useAuth";
import { data } from "@/data";
import {
  buildCreditDossier,
  dossierLiquidityFromPayments,
} from "@/lib/integrations/creditDossier";
import { downloadTextFile } from "@/lib/integrations/download";
import { useInlineReport } from "@/components/reports/useInlineReport";
import { AlertTriangle, FileDown, FileText, Loader2 } from "lucide-react";

/**
 * Kreditunderlaget som sida.
 *
 * Företaget fyller i tre saker - kassa, belopp, ändamål - och resten hämtas
 * ur ärendet: skulden, betalningarna, prognosen. Det är visionens "fyll i
 * uppgifterna en gång" på riktigt.
 *
 * Sidan producerar ett dokument och ett datapaket. Den skickar ingenting:
 * förmedling är blockerad tills tillstånds- och ansvarsfrågorna är juridiskt
 * bedömda (docs/VISION.md), och gränsen står även i underlagets egen
 * friskrivning. Underlaget redovisar det som talar emot - det är därför det
 * är värt något hos mottagaren.
 */

const KINDS = ["rörelsekredit", "factoring", "brygglån", "rekonstruktionsfinansiering"] as const;

const CreditDossierPage = () => {
  const { open: openInline, viewer: reportViewer } = useInlineReport();
  const { user } = useAuth();

  const { data: latestCase, isLoading } = useQuery({
    queryKey: ["latest-case", user?.id],
    queryFn: () => data.cases.getLatest(),
    enabled: !!user,
  });

  const { data: payments } = useQuery({
    queryKey: ["payments", latestCase?.id],
    queryFn: () => data.payments.listByCase(latestCase!.id),
    enabled: !!latestCase,
  });

  const { data: invoices } = useQuery({
    queryKey: ["case-invoices", latestCase?.id],
    queryFn: () => data.invoices.listByCase(latestCase!.id),
    enabled: !!latestCase,
  });

  const [cashRaw, setCashRaw] = useState("");
  const [amountRaw, setAmountRaw] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("rörelsekredit");
  const [purpose, setPurpose] = useState("");
  const [blockers, setBlockers] = useState<string[] | null>(null);

  const parseKr = (raw: string): number =>
    Math.round(Number(raw.replace(/\s/g, "").replace(",", ".")) || 0);

  const buildInput = () => {
    const liquidity = dossierLiquidityFromPayments({
      openingBalance: parseKr(cashRaw),
      outflows: (payments ?? [])
        .filter((p) => p.status === "pending" || p.status === "critical")
        .map((p) => ({ amount: p.amount, dueDate: p.dueDate })),
      inflows: (invoices ?? [])
        .filter((i) => i.direction === "out" && i.status !== "paid")
        .map((i) => ({ amount: i.amount, dueDate: i.dueDate })),
      today: new Date(),
    });
    return {
      caseRecord: latestCase!,
      liquidity,
      kbr: null,
      request: { amount: parseKr(amountRaw), purpose: purpose.trim(), kind },
      generatedAt: new Date().toISOString(),
    };
  };

  const handleOpen = (e: FormEvent) => {
    e.preventDefault();
    setBlockers(null);
    const result = buildCreditDossier(buildInput());
    if (!result.ok) {
      setBlockers(result.missing);
      return;
    }
    openInline(result.report);
  };

  const handleDownloadPackage = () => {
    setBlockers(null);
    const result = buildCreditDossier(buildInput());
    if (!result.ok) {
      setBlockers(result.missing);
      return;
    }
    downloadTextFile(
      JSON.stringify(result.package, null, 2),
      `kreditunderlag-${latestCase!.orgNumber.replace(/\D/g, "")}.json`,
      "application/json;charset=utf-8",
    );
  };

  return (
    <DashboardShell title="Kreditunderlag">
      <div data-guide="kreditunderlagsvyn">
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden="true" />
        </div>
      ) : !latestCase ? (
        <div className="max-w-xl rounded-md border border-border bg-card p-6">
          <FileText className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-4 font-display text-xl text-foreground">Inget ärende än</h2>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            Underlaget byggs ur ärendets data – utvärderingen och
            likviditetsplanen. Gör utvärderingen först.
          </p>
          <Button variant="accent" className="mt-6" asChild>
            <Link to="/wizard">Starta utvärderingen</Link>
          </Button>
        </div>
      ) : (
        <div className="max-w-2xl space-y-6">
          <p className="text-muted-foreground">
            Ett underlag att skicka till bank eller finansiär: läget, prognosen
            och skuldbilden ur ditt ärende, med källorna redovisade. Du fyller i
            tre uppgifter – resten hämtas ur det du redan lagt in.
          </p>

          <form onSubmit={handleOpen} className="space-y-6">
            <WizardCard>
              <WizardCardHeader
                title="Tre uppgifter"
                description="Belopp anges i kronor. Prognosen räknas ur ärendets registrerade betalningar."
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="cd-cash" className="block text-sm font-medium text-foreground">
                    Kassa idag
                  </label>
                  <Input
                    id="cd-cash"
                    inputMode="numeric"
                    required
                    value={cashRaw}
                    onChange={(e) => setCashRaw(e.target.value)}
                    placeholder="t.ex. 250 000"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="cd-amount" className="block text-sm font-medium text-foreground">
                    Sökt belopp
                  </label>
                  <Input
                    id="cd-amount"
                    inputMode="numeric"
                    required
                    value={amountRaw}
                    onChange={(e) => setAmountRaw(e.target.value)}
                    placeholder="t.ex. 750 000"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label htmlFor="cd-kind" className="block text-sm font-medium text-foreground">
                    Typ av finansiering
                  </label>
                  <select
                    id="cd-kind"
                    value={kind}
                    onChange={(e) => setKind(e.target.value as (typeof KINDS)[number])}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label htmlFor="cd-purpose" className="block text-sm font-medium text-foreground">
                    Vad ska finansieringen användas till?
                  </label>
                  <Textarea
                    id="cd-purpose"
                    rows={3}
                    required
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="T.ex. överbrygga ackordsförhandlingen under rekonstruktionens första tre månader."
                  />
                </div>
              </div>
            </WizardCard>

            {blockers && (
              <p className="flex gap-2 rounded-md border border-warning/40 bg-warning/10 p-4 text-sm text-foreground" role="alert">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" aria-hidden="true" />
                <span>Underlaget byggs inte än. Saknas: {blockers.join("; ")}.</span>
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit" variant="accent">
                <FileText className="h-4 w-4" aria-hidden="true" />
                Öppna underlaget
              </Button>
              <Button type="button" variant="outline" onClick={handleDownloadPackage}>
                <FileDown className="h-4 w-4" aria-hidden="true" />
                Ladda ned datapaketet (JSON)
              </Button>
            </div>
          </form>

          <p className="border-l-2 border-border pl-4 text-sm leading-relaxed text-muted-foreground">
            Underlaget redovisar även det som talar emot – skulden, prognosen och
            eventuell kontrollbalansplikt. Det är det som gör det trovärdigt hos
            mottagaren. Clearance rekommenderar inte kredit och förmedlar
            ingenting: du väljer själv vem du skickar underlaget till, och ny
            skuld i ett ansträngt läge bör alltid stämmas av med din rådgivare.
          </p>
        </div>
      )}
      {reportViewer}
      </div>
    </DashboardShell>
  );
};

export default CreditDossierPage;
