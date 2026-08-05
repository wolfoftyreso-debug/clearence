import { Link } from "react-router-dom";
import { GuidedArrival } from "@/components/GuidedArrival";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CaseDocuments } from "@/components/documents/CaseDocuments";
import { TaxAccountImport } from "@/components/documents/TaxAccountImport";
import { DocumentTemplates } from "@/components/documents/DocumentTemplates";
import { IntegrationStatus } from "@/components/integrations/IntegrationStatus";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { data } from "@/data";
import { ArrowRight, Banknote, FolderOpen, Loader2 } from "lucide-react";

/**
 * Ärendets handlingar.
 *
 * Menyvalet fanns men var märkt "Snart" och gick inte att klicka på.
 * Komponenten som gör jobbet fanns redan - den satt inne i guiden, där man
 * bara nådde den mitt i ett flöde. Nu har den en egen adress.
 */
const DashboardDocuments = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: latestCase, isLoading } = useQuery({
    queryKey: ["latest-case", user?.id],
    queryFn: () => data.cases.getLatest(),
    enabled: !!user,
  });

  // Kommande skattedebiteringar in som betalningar. Kategorin är alltid
  // skatt - det är hela poängen med källan - och statusen kritisk, eftersom
  // en obetald skattedebitering är fristen som styr företrädaransvaret.
  const importTaxCharges = useMutation({
    mutationFn: (charges: { date: string; label: string; amount: number }[]) =>
      data.payments.createMany(
        charges.map((c) => ({
          userId: user!.id,
          caseId: latestCase!.id,
          label: c.label,
          amount: c.amount,
          category: "tax" as const,
          status: "critical" as const,
          dueDate: c.date,
          recurring: false,
        })),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments", latestCase?.id] });
    },
  });

  return (
    <DashboardShell title="Dokument">
      <div data-guide="dokumentvyn">
      <GuidedArrival />
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden="true" />
        </div>
      ) : !latestCase ? (
        <div className="max-w-xl rounded-md border border-border bg-card p-6">
          <FolderOpen className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-4 font-display text-xl text-foreground">Inget ärende än</h2>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            Handlingar hör till ett ärende. Gör utvärderingen först, så finns det
            någonstans att lägga dem – och så vet vi vilka handlingar som är
            relevanta för just din situation.
          </p>
          <Button variant="accent" className="mt-6" asChild>
            <Link to="/wizard">Starta utvärderingen</Link>
          </Button>
        </div>
      ) : (
        <div className="max-w-3xl space-y-6">
          <div>
            <h2 className="font-display text-2xl text-foreground">
              {latestCase.companyName || "Ditt ärende"}
            </h2>
            <p className="mt-1 text-muted-foreground">
              Kontoutdrag, balans- och resultatrapporter, avtal och korrespondens.
              Filerna ligger krypterade och delas aldrig med en publik adress.
            </p>
          </div>
          <CaseDocuments caseId={latestCase.id} userId={user?.id ?? ""} />

          <DocumentTemplates caseRecord={latestCase} />

          {/* Kreditunderlaget bor här och inte i menyn: det är en handling
              man tar fram ur ärendet, inte en yta man arbetar i dagligen. */}
          <Link
            to="/dashboard/kreditunderlag"
            className="flex items-center gap-4 rounded-md border border-border bg-card p-5 shadow-soft transition-colors hover:border-accent/50"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-accent/10">
              <Banknote className="h-5 w-5 text-accent" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground">Kreditunderlag</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Sammanställ ärendet till ett underlag för bank eller finansiär –
                siffror, säkerheter och plan i ett dokument.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>

          <TaxAccountImport
            onImport={(selection) => {
              if (selection.charges.length > 0) {
                importTaxCharges.mutate(selection.charges);
              }
            }}
          />
          {importTaxCharges.isError && (
            <p className="text-sm text-destructive" role="alert">
              Kunde inte lägga in betalningarna. Försök igen.
            </p>
          )}

          <IntegrationStatus />
        </div>
      )}
      </div>
    </DashboardShell>
  );
};

export default DashboardDocuments;
