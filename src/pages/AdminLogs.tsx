import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { data } from "@/data";
import { History, Lock, RefreshCw } from "lucide-react";

/**
 * Driftens loggvy: utkorgen - varje mejl systemet försökt skicka, med
 * status, antal försök och senaste felet. Ett mejl som inte gått fram ska
 * synas för en människa, inte upptäckas av kunden.
 *
 * Viktig gräns, sagd rakt ut på sidan: ärendenas händelseloggar är INTE
 * driftens. De är radskyddade per ärende och läses av ärendets deltagare,
 * under Händelselogg i ärendet. Driften ser systemets egna händelser -
 * aldrig in i bolagens akter.
 */

const STATUS_BADGE: Record<string, { label: string; tone: string }> = {
  sent: { label: "Skickat", tone: "border-success/50 bg-success/10 text-foreground" },
  pending: { label: "Väntar", tone: "border-border text-muted-foreground" },
  failed: { label: "Misslyckat", tone: "border-frist/50 bg-frist/10 text-frist" },
};

const swedishDateTime = (iso: string) =>
  new Date(iso).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const AdminLogs = () => {
  const queryClient = useQueryClient();
  const { data: outbox } = useQuery({
    queryKey: ["outbox"],
    queryFn: () => data.billing.listOutbox(),
  });
  const retry = useMutation({
    mutationFn: (id: string) => data.billing.retryEmail(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["outbox"] }),
  });

  const rows = outbox ?? [];
  const failed = rows.filter((r) => r.status === "failed").length;

  return (
    <DashboardShell title="Loggar">
      <div data-guide="loggvyn" className="mx-auto max-w-3xl space-y-8">
        <header>
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <History className="h-6 w-6 text-accent" aria-hidden="true" />
            Loggar
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Systemets egna händelser: utkorgen med varje mejl som skickats,
            väntar eller misslyckats. Misslyckade utskick köas om härifrån.
          </p>
        </header>

        <section aria-labelledby="outbox-heading">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="outbox-heading" className="text-lg font-semibold text-foreground">
              Utkorgen
            </h2>
            <span className="text-sm text-muted-foreground">
              {rows.length} utskick{failed > 0 && ` · ${failed} misslyckade`}
            </span>
          </div>
          {rows.length === 0 ? (
            <p className="mt-3 rounded-md bg-secondary/40 p-4 text-sm text-muted-foreground">
              Inga utskick ännu. Fakturor, kvitton och påminnelser hamnar här
              när arbetaren skickar dem.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-md border border-border">
              {rows.map((row) => {
                const badge = STATUS_BADGE[row.status] ?? STATUS_BADGE.pending;
                return (
                  <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{row.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.recipient} · {row.kind} ·{" "}
                        {swedishDateTime(row.sentAt ?? row.createdAt)}
                        {row.attempts > 1 && ` · ${row.attempts} försök`}
                      </p>
                      {row.status === "failed" && row.lastError && (
                        <p className="mt-0.5 text-xs text-frist">{row.lastError}</p>
                      )}
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badge.tone}`}>
                      {badge.label}
                    </span>
                    {row.status === "failed" && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={retry.isPending}
                        onClick={() => retry.mutate(row.id)}
                      >
                        <RefreshCw className="h-4 w-4" aria-hidden="true" />
                        Skicka igen
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-md bg-secondary/40 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Lock className="h-4 w-4 text-accent" aria-hidden="true" />
            Ärendenas händelseloggar är inte driftens
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Varje ärende har en egen händelselogg som inte kan skrivas om -
            vem gjorde vad, när. Den är radskyddad per ärende och läses av
            ärendets deltagare under Händelselogg. Driften ser systemets
            händelser här, aldrig in i bolagens akter; den gränsen sätter
            databasen, inte den här sidan.
          </p>
        </section>
      </div>
    </DashboardShell>
  );
};

export default AdminLogs;
