import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { data } from "@/data";
import { useAuth } from "@/hooks/useAuth";
import { analysisInputFromCase } from "@/lib/caseAnalysis";
import { analyseCrisis } from "@/lib/crisisAnalysis";
import { buildLeadPreview, buildLeadSummary } from "@/lib/leadSummary";
import type { CaseRecord, ProfessionalRecord } from "@/data/types";
import { CheckCircle2, Loader2, Send, ShieldCheck } from "lucide-react";

/**
 * "Kontakta via CLEARANCE" på rådgivarkortet.
 *
 * Transparensen ÄR flödet: innan något skickas ser företrädaren exakt vad
 * rådgivaren får se före upplåsning (den avidentifierade förhandsvisningen)
 * och vad som låses upp efteråt (identiteten och sammanfattningen), och
 * godkänner delningen uttryckligen. Ingenting delas utan det godkännandet -
 * regeln bor i databasen, den här komponenten visar bara sanningen om den.
 */

interface ContactRequestSectionProps {
  professional: ProfessionalRecord;
  caseRecord: CaseRecord | null;
  alreadyContacted: boolean;
}

export const ContactRequestSection = ({ professional, caseRecord, alreadyContacted }: ContactRequestSectionProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [consent, setConsent] = useState(false);

  const { data: documents } = useQuery({
    queryKey: ["case-documents", caseRecord?.id],
    queryFn: () => data.documents.listByCase(caseRecord?.id as string),
    enabled: open && !!caseRecord,
  });

  const send = useMutation({
    mutationFn: () => {
      if (!caseRecord) throw new Error("Inget ärende");
      const analysis = analyseCrisis(analysisInputFromCase(caseRecord));
      const names = (documents ?? []).map((d) => d.fileName);
      return data.leads.create({
        caseId: caseRecord.id,
        professionalId: professional.id,
        preview: buildLeadPreview(caseRecord, analysis, names),
        summary: buildLeadSummary(caseRecord, analysis, names, user?.email ?? null, reason.trim()),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case-shares"] });
      queryClient.invalidateQueries({ queryKey: ["my-leads"] });
    },
  });

  if (!user) {
    return (
      <p className="rounded-md bg-secondary/40 p-3 text-xs leading-relaxed text-muted-foreground">
        <Link to="/login" className="underline">Logga in</Link> för att kontakta{" "}
        {professional.company ?? professional.name} med en strukturerad
        ärendesammanfattning via CLEARANCE.
      </p>
    );
  }
  if (!caseRecord) {
    return (
      <p className="rounded-md bg-secondary/40 p-3 text-xs leading-relaxed text-muted-foreground">
        <Link to="/wizard" className="underline">Gör den kostnadsfria nulägesanalysen</Link>{" "}
        först - kontaktförfrågan byggs på ärendet, så rådgivaren får ett
        underlag i stället för ett tomt mejl.
      </p>
    );
  }
  if (send.isSuccess || alreadyContacted) {
    return (
      <p className="flex items-start gap-2 rounded-md bg-secondary/40 p-3 text-xs leading-relaxed text-muted-foreground">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-success" aria-hidden="true" />
        Förfrågan är skickad. Rådgivaren ser en avidentifierad förhandsvisning
        och du ser status under Deltagare &amp; delning i ärendet.
      </p>
    );
  }

  if (!open) {
    return (
      <Button type="button" variant="accent" size="sm" className="w-full" onClick={() => setOpen(true)}>
        <Send className="h-4 w-4" aria-hidden="true" />
        Kontakta via CLEARANCE
      </Button>
    );
  }

  const analysis = analyseCrisis(analysisInputFromCase(caseRecord));
  const preview = buildLeadPreview(caseRecord, analysis, (documents ?? []).map((d) => d.fileName));

  return (
    <div className="rounded-md border border-border bg-secondary/30 p-3 text-left">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        Detta delas - och när
      </p>
      <ul className="mt-2 space-y-1 text-xs leading-relaxed text-muted-foreground">
        <li>
          <span className="font-medium text-foreground">Direkt (avidentifierat):</span>{" "}
          {preview.problemType.toLowerCase()}, {preview.sizeBand ?? "storlek ej angiven"},
          komplexitet {preview.complexity}, {preview.documentCount} dokument
          ({preview.documentKinds.join(", ") || "inga"}). Aldrig namn eller
          organisationsnummer.
        </li>
        <li>
          <span className="font-medium text-foreground">Efter att rådgivaren låst upp ärendet:</span>{" "}
          {caseRecord.companyName ?? "bolaget"} ({caseRecord.orgNumber}), din
          kontaktväg, nyckeltalen, systemanalysen och dokumentlistan.
        </li>
      </ul>
      <label className="mt-3 block text-xs font-medium text-foreground">
        Varför tar du kontakt? (följer med sammanfattningen)
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="t.ex. Vi behöver hjälp att bedöma rekonstruktion före lönekörningen."
          className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      <label className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-foreground">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Jag företräder bolaget och godkänner att informationen ovan delas
          med {professional.company ?? professional.name} enligt beskrivningen.
        </span>
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!consent || !reason.trim() || send.isPending}
          onClick={() => send.mutate()}
        >
          {send.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Skicka förfrågan
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Avbryt
        </Button>
      </div>
      {send.isError && (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {send.error instanceof Error ? send.error.message : "Kunde inte skicka förfrågan."}
        </p>
      )}
    </div>
  );
};
