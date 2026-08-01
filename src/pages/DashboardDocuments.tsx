import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CaseDocuments } from "@/components/documents/CaseDocuments";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { data } from "@/data";
import { FolderOpen, Loader2 } from "lucide-react";

/**
 * Ärendets handlingar.
 *
 * Menyvalet fanns men var märkt "Snart" och gick inte att klicka på.
 * Komponenten som gör jobbet fanns redan - den satt inne i guiden, där man
 * bara nådde den mitt i ett flöde. Nu har den en egen adress.
 */
const DashboardDocuments = () => {
  const { user } = useAuth();

  const { data: latestCase, isLoading } = useQuery({
    queryKey: ["latest-case", user?.id],
    queryFn: () => data.cases.getLatest(),
    enabled: !!user,
  });

  return (
    <DashboardShell title="Dokument">
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
        </div>
      )}
    </DashboardShell>
  );
};

export default DashboardDocuments;
