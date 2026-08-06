import { Link, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { data } from "@/data";
import { useAuth } from "@/hooks/useAuth";
import { analyseCrisis } from "@/lib/crisisAnalysis";
import { analysisInputFromCase, parseAmount } from "@/lib/caseAnalysis";
import { countdownTo } from "@/lib/actionPlan";
import {
  ACTION_CATALOG,
  OPTIONS_STANCE,
  PATH_STATUS_LABELS,
  buildActionPaths,
  type PathStatus,
} from "@/lib/advisor/options";
import { Compass, Loader2 } from "lucide-react";

/**
 * Handlingsalternativen: vilka vägar som finns kvar och vad de kräver.
 *
 * Det här är produktens svar på "hur illa är det egentligen?" - inte en
 * modul som heter Konkurs, utan en levande bild där varje väg har en
 * status som uppdateras när ärendet ändras. Fokus på beslut och
 * möjligheter, aldrig på en förutbestämd utgång.
 */

const STATUS_TONE: Record<PathStatus, string> = {
  urgent: "border-frist/50 bg-frist/10 text-frist",
  open: "border-success/40 bg-success/10 text-foreground",
  narrowing: "border-warning/50 bg-warning/10 text-foreground",
  closed: "border-border bg-secondary/40 text-muted-foreground",
};

const DashboardAlternativ = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: latestCase, isLoading } = useQuery({
    queryKey: ["latest-case", user?.id],
    queryFn: () => data.cases.getLatest(),
    enabled: !!user,
  });
  const { data: kbr } = useQuery({
    queryKey: ["kbr-latest", latestCase?.id],
    queryFn: () => data.kbr.getLatestByCase(latestCase!.id),
    retry: false,
    enabled: !!latestCase,
  });

  const now = new Date();
  const paths = latestCase
    ? (() => {
        const timeline = analyseCrisis(analysisInputFromCase(latestCase)).timeline;
        const countdowns = timeline.map((e) => countdownTo(e.iso, now));
        const upcoming = countdowns.filter((c) => c.tone !== "passed");
        const totalDebt = parseAmount(latestCase.totalDebt);
        const liquidation = parseAmount(latestCase.quickLiquidationValue);
        return buildActionPaths({
          coverageRatio: totalDebt > 0 ? Math.round((liquidation / totalDebt) * 100) : null,
          passedDeadlines: countdowns.filter((c) => c.tone === "passed").length,
          daysToNextDeadline: upcoming.length
            ? Math.min(...upcoming.map((c) => c.daysLeft))
            : null,
          canPayTax: latestCase.canPayTax !== false,
          canPaySalary: latestCase.canPaySalary !== false,
          recommendationType: latestCase.recommendationType ?? null,
          kbrDone: !!kbr,
        });
      })()
    : [];

  return (
    <DashboardShell title="Handlingsalternativ">
      <div data-guide="alternativvyn" className="mx-auto max-w-3xl">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden="true" />
          </div>
        ) : !latestCase ? (
          <div className="rounded-md border border-border bg-card p-6">
            <p className="leading-relaxed text-muted-foreground">
              Alternativen bedöms mot ett ärende. Börja med ett samtal, så
              skapar vi bilden tillsammans.
            </p>
            <Button variant="accent" className="mt-4" onClick={() => navigate("/dashboard/samtal")}>
              Prata med CLEARANCE
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {OPTIONS_STANCE} Statusarna nedan bygger på det som är
              registrerat i ärendet och uppdateras när läget ändras.
            </p>

            {/* Vägarna */}
            <ul className="mt-5 space-y-3">
              {paths.map((path) => (
                <li key={path.id} className="rounded-md border border-border bg-card p-4 shadow-soft">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-semibold text-foreground">{path.title}</h2>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[path.status]}`}
                    >
                      {PATH_STATUS_LABELS[path.status]}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{path.summary}</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-foreground/80">Läget:</span> {path.statusReason}
                  </p>
                  <details className="mt-2">
                    <summary className="cursor-pointer list-none text-sm font-medium text-accent underline-offset-4 hover:underline">
                      Vad vägen kräver
                    </summary>
                    <ul className="mt-2 space-y-1 pl-4">
                      {path.requires.map((req) => (
                        <li key={req} className="list-disc text-sm leading-relaxed text-foreground/90">
                          {req}
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>

            {/* Åtgärdskatalogen */}
            <section aria-labelledby="katalog-heading" className="mt-8">
              <h2 id="katalog-heading" className="flex items-center gap-2 font-semibold text-foreground">
                <Compass className="h-5 w-5 text-accent" aria-hidden="true" />
                Åtgärder att pröva mot läget
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                En verktygslåda, inte en föreskrift – vad som är realistiskt
                beror på bransch, likviditet och efterfrågan. Pröva mot{" "}
                <Link to="/dashboard/liquidity" className="font-medium text-accent underline underline-offset-4">
                  likviditetsplanen
                </Link>{" "}
                innan något genomförs.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {ACTION_CATALOG.map((category) => (
                  <div key={category.id} className="rounded-md border border-border bg-card p-4">
                    <h3 className="font-medium text-foreground">{category.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{category.intro}</p>
                    <ul className="mt-2 space-y-1 pl-4">
                      {category.items.map((item) => (
                        <li key={item} className="list-disc text-sm leading-relaxed text-foreground/90">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
              Det här är underlag för beslut – vilken väg som är rätt för just
              ert bolag stäms av med revisor eller juridisk rådgivare.
            </p>
          </>
        )}
      </div>
    </DashboardShell>
  );
};

export default DashboardAlternativ;
