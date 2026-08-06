import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { data } from "@/data";
import { ArrowRight, BadgeCheck, Scale } from "lucide-react";

/**
 * Driftens rådgivarvy: katalogen per kategori, med avtalsläget bredvid.
 *
 * Frågan vyn svarar på är "vilka byråer finns i systemet, i vilket skick?"
 * - verifierad eller förifylld, vilken prisplan, vilken förmedlingsavgift.
 * Själva redigeringen (planer, avgifter, anspråk) bor kvar i driftpanelen;
 * det här är registret man läser innan man agerar.
 */

const CATEGORY_LABEL: Record<string, string> = {
  rekonstruktor: "Rekonstruktörer",
  affarsjurist: "Jurister",
  revisor: "Revisorer",
  konkursforvaltare: "Konkursförvaltare",
};

const PLAN_LABEL: Record<string, string> = {
  per_case: "Per ärende",
  subscription: "Abonnemang",
  usage: "Användning",
  enterprise: "Licens",
};

const AdminAdvisors = () => {
  const [filter, setFilter] = useState<string | null>(null);

  const { data: professionals } = useQuery({
    queryKey: ["professionals"],
    queryFn: () => data.professionals.listActive(),
  });
  const { data: plans } = useQuery({
    queryKey: ["billing-plans"],
    queryFn: () => data.ops.listBillingPlans(),
  });
  const { data: terms } = useQuery({
    queryKey: ["professional-terms"],
    queryFn: () => data.ops.listProfessionalTerms(),
  });

  const all = professionals ?? [];
  const categories = [...new Set(all.map((p) => p.category))];
  const rows = filter ? all.filter((p) => p.category === filter) : all;
  const planFor = (id: string) => (plans ?? []).find((p) => p.professionalId === id);
  const termsFor = (id: string) => (terms ?? []).find((t) => t.professionalId === id);

  return (
    <DashboardShell title="Rådgivare">
      <div data-guide="radgivarvyn" className="mx-auto max-w-3xl space-y-6">
        <header>
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Scale className="h-6 w-6 text-accent" aria-hidden="true" />
            Rådgivare
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Katalogen per kategori, med verifiering och avtalsläge. Planer,
            avgifter och anspråk ändras i{" "}
            <Link to="/admin" className="text-accent underline-offset-4 hover:underline">
              driftpanelen
            </Link>
            .
          </p>
        </header>

        <section aria-label="Kategorier" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {categories.map((cat) => {
            const count = all.filter((p) => p.category === cat).length;
            const active = filter === cat;
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(active ? null : cat)}
                className={`rounded-md border p-3 text-left transition-colors ${
                  active ? "border-accent bg-accent/5" : "border-border bg-card hover:border-accent/60"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {CATEGORY_LABEL[cat] ?? cat}
                </p>
                <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{count}</p>
              </button>
            );
          })}
        </section>

        <section aria-labelledby="advisors-heading">
          <h2 id="advisors-heading" className="text-lg font-semibold text-foreground">
            {filter ? (CATEGORY_LABEL[filter] ?? filter) : "Alla byråer"}
          </h2>
          {rows.length === 0 ? (
            <p className="mt-3 rounded-md bg-secondary/40 p-4 text-sm text-muted-foreground">
              Inga byråer i kategorin.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-md border border-border">
              {rows.map((p) => {
                const plan = planFor(p.id);
                const t = termsFor(p.id);
                return (
                  <li key={p.id} className="p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{p.company ?? p.name}</p>
                      {p.verified ? (
                        <span className="flex items-center gap-1 rounded-full border border-success/50 bg-success/10 px-2 py-0.5 text-xs font-medium text-foreground">
                          <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                          Verifierad
                        </span>
                      ) : (
                        <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          Förifylld – ej bekräftad
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {CATEGORY_LABEL[p.category] ?? p.category}
                      {p.location && ` · ${p.location}`}
                      {plan
                        ? ` · Plan: ${PLAN_LABEL[plan.planKind]}${
                            plan.unlockFeeSek ? ` (${plan.unlockFeeSek} kr/ärende)` : ""
                          }${plan.monthlyFeeSek ? ` (${plan.monthlyFeeSek} kr/mån)` : ""}`
                        : " · Ingen prisplan – upplåsning kostnadsfri"}
                      {t?.referralFeeSek != null && ` · Förmedlingsavgift ${t.referralFeeSek} kr`}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <Link
          to="/admin/ansokningar"
          className="flex items-center gap-1 text-sm text-accent underline-offset-4 hover:underline"
        >
          Väntande ansökningar
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </DashboardShell>
  );
};

export default AdminAdvisors;
