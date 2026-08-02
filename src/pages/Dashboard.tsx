import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CaseDocuments } from "@/components/documents/CaseDocuments";
import { ReportButton } from "@/components/reports/ReportButton";
import { buildCrisisReport } from "@/lib/reports/builders";
import { analyseCrisis } from "@/lib/crisisAnalysis";
import { buildCaseBundle, timelineToIcs } from "@/lib/integrations/caseBundle";
import { downloadTextFile } from "@/lib/integrations/download";
import { InsightList } from "@/components/financial/InsightList";
import { analyseSnapshot } from "@/lib/financial/insights";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
  FolderDown,
  Plus,
  Loader2,
} from "lucide-react";
import { data } from "@/data";
import { useAuth } from "@/hooks/useAuth";
import type { CaseRecord } from "@/data/types";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { LockedFeature, useEntitlements } from "@/components/billing/LockedFeature";
import { ActionPlan } from "@/components/dashboard/ActionPlan";
import { ControlStatus } from "@/components/dashboard/ControlStatus";
import { AiBriefing } from "@/components/dashboard/AiBriefing";
import {
  CaseExitSection,
  ClosedCaseBanner,
  HealthDashboard,
} from "@/components/dashboard/CaseExit";
import { AdvisorTools } from "@/components/dashboard/AdvisorTools";
import { analysisInputFromCase, parseAmount } from "@/lib/caseAnalysis";



const recommendationCopy: Record<
  NonNullable<CaseRecord["recommendationType"]>,
  { icon: typeof AlertCircle; className: string }
> = {
  bankruptcy: { icon: AlertCircle, className: "bg-destructive/10 border-destructive/30" },
  reconstruction: { icon: AlertTriangle, className: "bg-warning/10 border-warning/30" },
  stabilize: { icon: CheckCircle2, className: "bg-success/10 border-success/30" },
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { exportAndSharing } = useEntitlements();

  const { data: latestCase, isLoading } = useQuery({
    queryKey: ["latest-case", user?.id],
    queryFn: () => data.cases.getLatest(),
    enabled: !!user,
  });

  const { data: snapshot } = useQuery({
    queryKey: ["financial-snapshot", latestCase?.id],
    queryFn: () => data.financial.getLatestSnapshot(latestCase!.id),
    enabled: !!latestCase,
  });

  // Recomputed only when the snapshot changes; `now` is passed in so the
  // result is stable within a render rather than drifting per call.
  const insights = useMemo(
    () => (snapshot ? analyseSnapshot(snapshot, { now: new Date() }) : []),
    [snapshot],
  );
  // Tre insikter räcker som lägesbild; resten på begäran (Excellence rond 2).
  const [allInsights, setAllInsights] = useState(false);
  const [advisorQuestion, setAdvisorQuestion] = useState("");
  const visibleInsights = allInsights ? insights : insights.slice(0, 3);

  const totalDebt = latestCase ? parseAmount(latestCase.totalDebt) : 0;

  // En enda analysinput för rapport, aktexport och fristkalender. Tre
  // ställen som räknar var för sig är tre ställen som kan säga olika saker
  // om samma ärende.
  const analysisInput = analysisInputFromCase;

  const slugName = (record: CaseRecord): string =>
    (record.companyName ?? record.orgNumber).toLowerCase().replace(/[^a-z0-9åäö]+/gi, "-");

  const exportIcs = async (record: CaseRecord) => {
    const timeline = analyseCrisis(analysisInput(record)).timeline;
    downloadTextFile(
      timelineToIcs(timeline, {
        companyName: record.companyName,
        orgNumber: record.orgNumber,
        generatedAt: new Date().toISOString(),
      }),
      `frister-${slugName(record)}.ics`,
      "text/calendar;charset=utf-8",
    );
  };

  const exportBundle = async (record: CaseRecord) => {
    // Hämtas vid klicket, inte vid sidladdning: akten ska spegla ärendet i
    // exportögonblicket, och översikten ska inte betala för frågorna i förväg.
    const [payments, documents, messages] = await Promise.all([
      data.payments.listByCase(record.id),
      data.documents.listByCase(record.id),
      data.messages.listByCase(record.id),
    ]);
    const bundle = buildCaseBundle({
      caseRecord: record,
      timeline: analyseCrisis(analysisInput(record)).timeline,
      payments,
      documents,
      messages,
      ownerUserId: user?.id ?? null,
      exportedAt: new Date().toISOString(),
    });
    downloadTextFile(
      JSON.stringify(bundle, null, 2),
      `akt-${slugName(record)}.json`,
      "application/json;charset=utf-8",
    );
  };
  const liquidationValue = latestCase ? parseAmount(latestCase.quickLiquidationValue) : 0;



  return (
    <DashboardShell
      title="Översikt"
      actions={
        <Button variant="accent" size="sm" asChild>
          <Link to="/wizard">
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Ny utvärdering</span>
          </Link>
        </Button>
      }
    >
      <div className="mx-auto max-w-5xl">
          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
            </div>
          ) : !latestCase ? (
            /* Första mötet är ett samtal, inte ett tomt dashboard: CLEARANCE
               tar hand om namnet, företaget och situationen - en fråga i
               taget - och öppnar sedan nulägesanalysen själv. */
            <div className="text-center py-16 px-4 rounded-md bg-card border border-border shadow-soft">
              <h2 className="text-xl font-display font-semibold text-foreground mb-2">
                Vi tar det steg för steg
              </h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                CLEARANCE hjälper dig skapa struktur, förstå dina alternativ och
                dokumentera allt längs vägen. Börja med ett kort samtal.
              </p>
              <Button variant="accent" size="lg" onClick={() => navigate("/dashboard/samtal")}>
                Prata med CLEARANCE
              </Button>
            </div>
          ) : latestCase.healthMode ? (
            /* Hälsoläget: krisen är över men ärendet lever vidare - lugn
               bevakning i stället för frister och larm. */
            <HealthDashboard caseRecord={latestCase} />
          ) : latestCase.closedAt ? (
            /* Helt avslutat: banderollen med utfallet, och akten under -
               frysning, aldrig radering. */
            <>
              <ClosedCaseBanner caseRecord={latestCase} />
              {user && <CaseDocuments caseId={latestCase.id} userId={user.id} />}
            </>
          ) : (
            <>
              {/* Status banner */}
              {latestCase.recommendationType && (
                <div
                  className={`mb-6 p-4 rounded-md border flex items-start gap-4 ${
                    recommendationCopy[latestCase.recommendationType].className
                  }`}
                >
                  <div className="w-10 h-10 rounded-md bg-foreground/10 flex items-center justify-center flex-shrink-0">
                    {(() => {
                      const Icon = recommendationCopy[latestCase.recommendationType].icon;
                      return <Icon className="w-5 h-5 text-foreground" />;
                    })()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">
                      {latestCase.recommendationTitle}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {latestCase.recommendationDescription}
                    </p>
                  </div>
                </div>
              )}

              {/* Samtalsingången: en rad, inte en yta. Frågan följer med i
                  adressen så rådgivaren svarar direkt - dialogen ÄR
                  gränssnittet, översikten är journalens läsvy. */}
              <form
                className="mb-6 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const q = advisorQuestion.trim();
                  navigate(q ? `/dashboard/samtal?q=${encodeURIComponent(q)}` : "/dashboard/samtal");
                }}
              >
                <label htmlFor="advisor-entry" className="sr-only">
                  Fråga rådgivaren
                </label>
                <input
                  id="advisor-entry"
                  value={advisorQuestion}
                  onChange={(e) => setAdvisorQuestion(e.target.value)}
                  placeholder="Vad behöver du ta tag i? Skriv t.ex. ”jag kan inte betala momsen” …"
                  autoComplete="off"
                  className="h-10 min-w-0 flex-1 rounded-md border border-border bg-card px-3.5 text-sm text-foreground shadow-soft placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <Button type="submit" variant="accent">
                  Fråga rådgivaren
                </Button>
              </form>

              {/* Handlingsplanen först: frågan "vad gör jag, före vilket
                  datum" ska besvaras före all statistik. */}
              <div className="mb-6">
                <AiBriefing
                  caseRecord={latestCase}
                  timeline={analyseCrisis(analysisInput(latestCase)).timeline}
                />
                <ControlStatus caseRecord={latestCase} />
                <ActionPlan
                  caseRecord={latestCase}
                  timeline={analyseCrisis(analysisInput(latestCase)).timeline}
                />
              </div>

              {/* Fristerna bor i handlingsplanen ("Datum som räknas ned")
                  och INGEN annanstans - översikten sa samma sak två gånger
                  och blev tio mobilskärmar hög. Samma regel för "senaste
                  aktivitet": Händelseloggen är loggen. Återinför inte
                  dubbletterna. */}

              {/* Financial insights */}
              <div className="mt-6">
                <div className="mb-3 flex items-baseline justify-between gap-4">
                  <h2 className="font-semibold text-foreground">Vad siffrorna säger</h2>
                  {snapshot && (
                    <span className="text-xs text-muted-foreground">
                      Från {snapshot.provider}, hämtat{" "}
                      {format(new Date(snapshot.capturedAt), "d MMM HH:mm", { locale: sv })}
                    </span>
                  )}
                </div>
                {snapshot ? (
                  <>
                    <InsightList insights={visibleInsights} />
                    {insights.length > 3 && !allInsights && (
                      <button
                        type="button"
                        onClick={() => setAllInsights(true)}
                        className="mt-2 text-sm font-medium text-accent underline-offset-4 hover:underline"
                      >
                        Visa alla {insights.length} insikter
                      </button>
                    )}
                  </>
                ) : (
                  <div className="rounded-md border border-border bg-card p-5">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Inget bokföringssystem är kopplat, så det här bygger bara på det du
                      matat in själv. Koppling mot Fortnox, Visma och andra system är under
                      arbete – tills dess kan du importera ett kontoutdrag i
                      likviditetsplaneringen.
                    </p>
                  </div>
                )}
              </div>

              {/* Report */}
              <div className="mt-6 rounded-md border border-border bg-card p-5 shadow-soft">
                <h2 className="font-semibold text-foreground">Rapport</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Hela ärendet i ett dokument – ta med till mötet med rådgivaren.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                <ReportButton
                  build={() =>
                    buildCrisisReport({
                      analysis: analyseCrisis(analysisInput(latestCase)),
                      companyName: latestCase.companyName,
                      orgNumber: latestCase.orgNumber,
                      reference: latestCase.id,
                      employees: latestCase.employees,
                      totalDebt,
                      quickLiquidationValue: liquidationValue,
                      generatedAt: new Date().toISOString(),
                    })
                  }
                />
                  {/* Fristkalendern: ärendets lagstadgade datum till Outlook,
                      Google eller byråns system. Aktexporten: hela ärendet
                      som strukturerad akt - även vägen UT ur plattformen.
                      Betalväggen: export väntar på första betalningen -
                      arbetet finns kvar, ingenting raderas. */}
                  {exportAndSharing ? (
                    <>
                      <Button variant="outline" onClick={() => void exportIcs(latestCase)}>
                        <CalendarClock className="h-4 w-4" aria-hidden="true" />
                        Fristkalender (.ics)
                      </Button>
                      <Button variant="outline" onClick={() => void exportBundle(latestCase)}>
                        <FolderDown className="h-4 w-4" aria-hidden="true" />
                        Exportera akt
                      </Button>
                    </>
                  ) : (
                    <LockedFeature title="Export av akt och fristkalender" />
                  )}
                </div>
              </div>

              {/* Handlingarna bor på Dokument-sidan - menyvalet är vägen.
                  Samma regel som för snabbknapparna: en yta, en väg.
                  (I avslutade ärenden visas akten här, för då är översikten
                  arkivet.) */}

              {/* Klientverktygen: bara för rådgivarrollen - komponenten
                  gatear sig själv. */}
              <AdvisorTools caseRecord={latestCase} />

              {/* Snabbknapparna som dubblerade menyn är borttagna -
                  menyn ÄR vägen till guiderna. En yta, en väg. */}

              {/* Krisfasens slut: en stillsam väg ut, med orsak. */}
              <CaseExitSection caseRecord={latestCase} />
            </>
          )}
      </div>
    </DashboardShell>
  );
};

export default Dashboard;
