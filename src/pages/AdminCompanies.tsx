import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { data } from "@/data";
import { billingState } from "@/lib/billing";
import { ArrowRight, Building2 } from "lucide-react";

/**
 * Driftens företagsvy: alla företagskonton och ärendeläget i stort.
 *
 * Viktig gräns: driften ser KONTON och AGGREGAT, aldrig in i ärendena.
 * Radskyddet ger inte administratören läsrätt till ett bolags siffror, och
 * den här vyn låtsas inte annat - ärendeläget visas som North Star-tal,
 * inte som en lista över bolagens kriser. Fakturaåtgärderna bor i
 * Kunder-vyn; det här är översikten per målgrupp.
 */

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  trial: { label: "Gratisvecka", tone: "border-border text-muted-foreground" },
  invoiced: { label: "Fakturerad", tone: "border-border text-muted-foreground" },
  active: { label: "Aktivt", tone: "border-success/50 bg-success/10 text-foreground" },
  overdue: { label: "Förfallen faktura", tone: "border-warning/50 bg-warning/10 text-foreground" },
  closed: { label: "Stängt", tone: "border-frist/50 bg-frist/10 text-frist" },
};

const AdminCompanies = () => {
  const now = new Date();
  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: () => data.billing.listCustomers(),
  });
  const { data: counts } = useQuery({
    queryKey: ["north-star"],
    queryFn: () => data.ops.northStarCounts(),
  });

  const companies = (customers ?? []).filter((c) => c.role === "company");

  return (
    <DashboardShell title="Företag">
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Building2 className="h-6 w-6 text-accent" aria-hidden="true" />
            Företag
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Företagskontona och ärendeläget i stort. Driften ser konton och
            aggregat – aldrig in i bolagens ärenden; den gränsen sätter
            radskyddet i databasen.
          </p>
        </header>

        <section aria-label="Ärendeläget" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Öppna ärenden", value: counts?.openCases },
            { label: "I hälsoläget", value: counts?.inHealth },
            { label: "Återhämtade", value: counts?.recovered },
            { label: "Dålig churn", value: counts?.badChurn },
          ].map((stat) => (
            <div key={stat.label} className="rounded-md border border-border bg-card p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </p>
              <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">
                {stat.value ?? "–"}
              </p>
            </div>
          ))}
        </section>

        <section aria-labelledby="companies-heading">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="companies-heading" className="text-lg font-semibold text-foreground">
              Företagskonton
            </h2>
            <Link
              to="/admin/kunder"
              className="flex items-center gap-1 text-sm text-accent underline-offset-4 hover:underline"
            >
              Fakturering och åtgärder
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
          {companies.length === 0 ? (
            <p className="mt-3 rounded-md bg-secondary/40 p-4 text-sm text-muted-foreground">
              Inga företagskonton ännu.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-md border border-border">
              {companies.map((c) => {
                const state = c.billing ? billingState(c.billing, now) : null;
                const badge = state ? STATUS_LABEL[state.status] : null;
                const unpaid = c.invoices.filter((i) => i.status === "issued").length;
                return (
                  <li key={c.userId} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {c.displayName ?? c.email ?? c.userId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.email ?? "ingen e-post"}
                        {` · ${c.invoices.length} fakturor`}
                        {unpaid > 0 && ` · ${unpaid} obetalda`}
                      </p>
                    </div>
                    {badge && (
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badge.tone}`}>
                        {badge.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </DashboardShell>
  );
};

export default AdminCompanies;
