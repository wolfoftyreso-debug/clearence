import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { data } from "@/data";
import { BarChart3 } from "lucide-react";

/**
 * Driftens statistikvy: plattformens tal på en skärm, grupperade efter
 * vad de styr - North Star först, sedan flödet in (konton, ansökningar)
 * och ekonomin (fakturerat, betalt, utkorgen).
 *
 * Allt räknas ur samma admin-gateade frågor som de operativa vyerna;
 * ingen siffra har en egen väg in. Det som inte går att räkna ärligt ur
 * datamodellen än (matchningar över tid, intäkt per månad bakåt) visas
 * inte - en tom kolumn är bättre än en gissad.
 */

const kr = (ore: number) => `${Math.round(ore / 100).toLocaleString("sv-SE")} kr`;

const StatGrid = ({ tiles }: { tiles: { label: string; value: string | number | undefined; note?: string }[] }) => (
  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
    {tiles.map((tile) => (
      <div key={tile.label} className="rounded-md border border-border bg-card p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {tile.label}
        </p>
        <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">
          {tile.value ?? "–"}
        </p>
        {tile.note && <p className="mt-0.5 text-xs text-muted-foreground">{tile.note}</p>}
      </div>
    ))}
  </div>
);

const AdminStats = () => {
  const { data: counts } = useQuery({
    queryKey: ["north-star"],
    queryFn: () => data.ops.northStarCounts(),
  });
  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: () => data.billing.listCustomers(),
  });
  const { data: professionals } = useQuery({
    queryKey: ["professionals"],
    queryFn: () => data.professionals.listActive(),
  });
  const { data: applications } = useQuery({
    queryKey: ["admin-applications"],
    queryFn: () => data.applications.listAll(),
  });
  const { data: outbox } = useQuery({
    queryKey: ["outbox"],
    queryFn: () => data.billing.listOutbox(),
  });

  // Makulerade fakturor är varken intäkt eller fordran - de räknas inte.
  const invoices = (customers ?? []).flatMap((c) => c.invoices).filter((i) => i.status !== "cancelled");
  const invoicedOre = invoices.reduce((sum, i) => sum + i.grossOre, 0);
  const paidOre = invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.grossOre, 0);
  const unpaid = invoices.filter((i) => i.status === "issued").length;

  return (
    <DashboardShell title="Statistik">
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <BarChart3 className="h-6 w-6 text-accent" aria-hidden="true" />
            Statistik
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Plattformens tal, ur samma källor som de operativa vyerna. North
            Star överst – det är det driften styr mot.
          </p>
        </header>

        <section aria-labelledby="ns-heading">
          <h2 id="ns-heading" className="text-lg font-semibold text-foreground">
            North Star: återhämtning
          </h2>
          <StatGrid
            tiles={[
              { label: "Återhämtade", value: counts?.recovered, note: "Stabiliserade + genomförd rekonstruktion." },
              { label: "I hälsoläget", value: counts?.inHealth, note: "Stannade efter lyckad krisfas." },
              { label: "Dålig churn", value: counts?.badChurn, note: "Konkurs eller likvidation." },
              { label: "Öppna ärenden", value: counts?.openCases, note: "Pågående krisfaser." },
            ]}
          />
        </section>

        <section aria-labelledby="inflow-heading">
          <h2 id="inflow-heading" className="text-lg font-semibold text-foreground">
            Konton och katalog
          </h2>
          <StatGrid
            tiles={[
              {
                label: "Företagskonton",
                value: customers ? customers.filter((c) => c.role === "company").length : undefined,
              },
              {
                label: "Rådgivarkonton",
                value: customers ? customers.filter((c) => c.role === "advisor").length : undefined,
              },
              {
                label: "Byråer i katalogen",
                value: professionals?.length,
                note: professionals
                  ? `${professionals.filter((p) => p.verified).length} verifierade`
                  : undefined,
              },
              {
                label: "Väntande ansökningar",
                value: applications
                  ? applications.filter((a) => a.status === "pending").length
                  : undefined,
              },
            ]}
          />
        </section>

        <section aria-labelledby="econ-heading">
          <h2 id="econ-heading" className="text-lg font-semibold text-foreground">
            Fakturering och utskick
          </h2>
          <StatGrid
            tiles={[
              { label: "Fakturerat", value: customers ? kr(invoicedOre) : undefined, note: "Samtliga kundfakturor, brutto." },
              { label: "Betalt", value: customers ? kr(paidOre) : undefined },
              { label: "Obetalda fakturor", value: customers ? unpaid : undefined },
              {
                label: "Misslyckade utskick",
                value: outbox ? outbox.filter((e) => e.status === "failed").length : undefined,
                note: "Mejl som inte gått fram.",
              },
            ]}
          />
        </section>
      </div>
    </DashboardShell>
  );
};

export default AdminStats;
