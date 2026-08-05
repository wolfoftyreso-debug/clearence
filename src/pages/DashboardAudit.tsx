import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { data } from "@/data";
import { useAuth } from "@/hooks/useAuth";
import { CASE_ROLE_LABELS } from "@/lib/caseRoles";
import { downloadTextFile } from "@/lib/integrations/download";
import { summarizeAuditTrail } from "@/lib/auditDetail";
import type { AuditEventRecord } from "@/data/types";
import { Download, History, Loader2, ClipboardList } from "lucide-react";

/**
 * Händelseloggen - ärendets svarta låda, som läsfönster.
 *
 * Loggen skrivs av databasen (triggrar, append-only) och kan inte ändras av
 * någon, inklusive oss. Det är det som gör den värd att visa: i en ABL
 * 25 kap.-process är "vem gjorde vad, och när" något styrelsen ska kunna
 * BELÄGGA, inte bara påstå. Sidan översätter tabellnamn till svenska och
 * exporterar underlaget som fil - för revisorn, för tingsrätten, för en
 * tvist tre år senare.
 *
 * Exporten är avsiktligt tråkig: CSV och JSON, inga beroenden, allt bygger
 * lokalt i webbläsaren. Ingen händelse lämnar servern på någon annan väg än
 * att en behörig medlem själv laddar ner den.
 */

const OBJECT_LABELS: Record<string, string> = {
  cases: "Ärendet",
  case_members: "Deltagare",
  case_invitations: "Inbjudan",
  case_tasks: "Uppgift i handlingsplanen",
  case_documents: "Dokument",
  case_messages: "Meddelande",
  conversations: "Meddelandetråd",
  kbr_assessments: "Kontrollbalansräkning",
  payments: "Betalning",
  invoices: "Faktura",
};

const ACTION_LABELS: Record<string, string> = {
  insert: "skapades",
  update: "ändrades",
  delete: "togs bort",
};

const describe = (event: AuditEventRecord): string =>
  `${OBJECT_LABELS[event.objectType] ?? event.objectType} ${ACTION_LABELS[event.action] ?? event.action}`;

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const toCsv = (events: AuditEventRecord[]): string => {
  const esc = (v: string | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = events.map((e) =>
    [e.occurredAt, e.action, e.objectType, e.detail, e.objectId, e.actorRole, e.actorUserId]
      .map((v) => esc(v as string | null))
      .join(";"),
  );
  return ["tidpunkt;handling;objekt;detalj;objekt_id;roll;anvandare", ...rows].join("\r\n");
};

const DashboardAudit = () => {
  const { user } = useAuth();
  const { data: latestCase, isLoading: loadingCase } = useQuery({
    queryKey: ["latest-case", user?.id],
    queryFn: () => data.cases.getLatest(),
    enabled: !!user,
  });
  const { data: events, isLoading } = useQuery({
    queryKey: ["audit-events", latestCase?.id],
    queryFn: () => data.audit.listByCase(latestCase!.id),
    enabled: !!latestCase,
  });

  const stamp = latestCase ? new Date().toISOString().slice(0, 10) : "";

  return (
    <DashboardShell title="Händelselogg">
      <div data-guide="handelseloggen">
      {loadingCase ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden="true" />
        </div>
      ) : !latestCase ? (
        <div className="max-w-xl rounded-md border border-border bg-card p-6">
          <History className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-4 font-display text-xl text-foreground">Inget ärende än</h2>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            Händelseloggen hör till ett ärende.{" "}
            <Link to="/wizard" className="font-medium text-accent underline">
              Gör utvärderingen
            </Link>{" "}
            så börjar loggen skrivas från första steget.
          </p>
        </div>
      ) : (
        <div className="max-w-3xl">
          <p className="text-muted-foreground">
            Vem som gjorde vad i ärendet, och när. Loggen skrivs av databasen
            och kan inte ändras i efterhand – av någon, inklusive oss. Det är
            det som gör den användbar som underlag.
          </p>

          <section className="mt-4 rounded-md border border-border bg-card p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ClipboardList className="h-4 w-4 text-accent" aria-hidden="true" />
              Systemsammanfattning
            </h2>
            <ul className="mt-2 space-y-1">
              {summarizeAuditTrail(events ?? [], new Date()).map((line) => (
                <li key={line} className="text-sm leading-relaxed text-foreground/90">
                  {line}
                </li>
              ))}
            </ul>
          </section>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!events || events.length === 0}
              onClick={() =>
                downloadTextFile(
                  toCsv(events ?? []),
                  `handelselogg-${stamp}.csv`,
                  "text/csv;charset=utf-8",
                )
              }
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Exportera CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!events || events.length === 0}
              onClick={() =>
                downloadTextFile(
                  JSON.stringify(events ?? [], null, 2),
                  `handelselogg-${stamp}.json`,
                  "application/json",
                )
              }
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Exportera JSON
            </Button>
          </div>

          {isLoading ? (
            <Loader2 className="mt-6 h-5 w-5 animate-spin text-accent" aria-hidden="true" />
          ) : (events ?? []).length === 0 ? (
            <p className="mt-6 rounded-md border border-border bg-secondary/40 p-6 text-center text-muted-foreground">
              Inga händelser loggade än.
            </p>
          ) : (
            <ul className="mt-6 space-y-0 border-l-2 border-border pl-4">
              {(events ?? []).map((event) => (
                <li key={event.id} className="relative pb-4">
                  <span
                    className="absolute -left-[1.35rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-accent"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium text-foreground">
                    {describe(event)}
                    {event.detail && (
                      <span className="font-normal text-muted-foreground"> – {event.detail}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatWhen(event.occurredAt)}
                    {event.actorRole && ` · ${CASE_ROLE_LABELS[event.actorRole]}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      </div>
    </DashboardShell>
  );
};

export default DashboardAudit;
