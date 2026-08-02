import { useMemo } from "react";
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
  TrendingDown,
  Scale,
  Users,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  CalendarClock,
  FolderDown,
  Plus,
  Loader2,
} from "lucide-react";
import { data } from "@/data";
import { useAuth } from "@/hooks/useAuth";
import type { CaseRecord } from "@/data/types";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ActionPlan } from "@/components/dashboard/ActionPlan";
import { ControlStatus } from "@/components/dashboard/ControlStatus";
import { AiBriefing } from "@/components/dashboard/AiBriefing";
import { analysisInputFromCase, parseAmount } from "@/lib/caseAnalysis";



const nextOccurrence = (day: number): Date => {
  const today = new Date();
  const candidate = new Date(today.getFullYear(), today.getMonth(), day);
  if (candidate < today) {
    candidate.setMonth(candidate.getMonth() + 1);
  }
  return candidate;
};

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

  const deadlines = useMemo(() => {
    if (!latestCase) return [];
    const items: { key: string; date: Date; label: string; amount: number; status: "critical" | "warning" | "normal" }[] = [];
    const pushIfPresent = (
      day: number | null,
      amount: string | null,
      label: string,
      canPay: boolean | null,
    ) => {
      if (!day || !amount) return;
      items.push({
        key: label,
        date: nextOccurrence(day),
        label,
        amount: parseAmount(amount),
        status: canPay === false ? "critical" : canPay === true ? "normal" : "warning",
      });
    };
    pushIfPresent(latestCase.salaryDay, latestCase.salaryAmount, "Lön", latestCase.canPaySalary);
    pushIfPresent(latestCase.taxDay, latestCase.taxAmount, "Skatt/moms", latestCase.canPayTax);
    pushIfPresent(latestCase.rentDay, latestCase.rentAmount, "Hyra", latestCase.canPayRent);
    return items.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [latestCase]);

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
  const coverageRatio = totalDebt > 0 ? Math.round((liquidationValue / totalDebt) * 100) : null;



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
            <div className="text-center py-16 px-4 rounded-md bg-card border border-border shadow-soft">
              <h2 className="text-xl font-display font-semibold text-foreground mb-2">
                Inget ärende ännu
              </h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Gör en krisutvärdering för att skapa ditt första ärende och se det här.
              </p>
              <Button variant="accent" size="lg" onClick={() => navigate("/wizard")}>
                Starta utvärdering
              </Button>
            </div>
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

              {/* Handlingsplanen först: frågan "vad gör jag, före vilket
                  datum" ska besvaras före all statistik. */}
              <div className="mb-6">
                <AiBriefing
                  caseRecord={latestCase}
                  timeline={analyseCrisis(analysisInput(latestCase)).timeline}
                />
                <ControlStatus
                  caseRecord={latestCase}
                  timeline={analyseCrisis(analysisInput(latestCase)).timeline}
                />
                <ActionPlan
                  caseRecord={latestCase}
                  timeline={analyseCrisis(analysisInput(latestCase)).timeline}
                />
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="p-5 rounded-md bg-card border border-border shadow-soft">
                  <p className="text-sm text-muted-foreground mb-1">Totala skulder</p>
                  <p className="text-2xl font-display font-semibold text-foreground">
                    {totalDebt.toLocaleString("sv-SE")} kr
                  </p>
                </div>
                <div className="p-5 rounded-md bg-card border border-border shadow-soft">
                  <p className="text-sm text-muted-foreground mb-1">Snabbt avyttringsvärde</p>
                  <p className="text-2xl font-display font-semibold text-foreground">
                    {liquidationValue.toLocaleString("sv-SE")} kr
                  </p>
                </div>
                <div className="p-5 rounded-md bg-card border border-border shadow-soft">
                  <p className="text-sm text-muted-foreground mb-1">Täckningsgrad</p>
                  <p className={`text-2xl font-display font-semibold ${
                    coverageRatio !== null && coverageRatio < 30 ? "text-destructive" : "text-foreground"
                  }`}>
                    {coverageRatio !== null ? `${coverageRatio}%` : "–"}
                  </p>
                </div>
              </div>

              {/* Two column layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Upcoming deadlines */}
                <div className="lg:col-span-2 rounded-md bg-card border border-border shadow-soft">
                  <div className="p-5 border-b border-border flex items-center justify-between">
                    <h2 className="font-semibold text-foreground flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-accent" />
                      Kommande deadlines
                    </h2>
                  </div>
                  {deadlines.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">
                      Inga deadlines registrerade för det här ärendet.
                    </p>
                  ) : (
                    <div className="divide-y divide-border">
                      {deadlines.map((deadline) => (
                        <div
                          key={deadline.key}
                          className="p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`w-12 h-12 rounded-md flex items-center justify-center ${
                                deadline.status === "critical"
                                  ? "bg-destructive/10 text-destructive"
                                  : deadline.status === "warning"
                                  ? "bg-warning/10 text-warning"
                                  : "bg-secondary text-foreground"
                              }`}
                            >
                              <span className="text-xs font-semibold">
                                {format(deadline.date, "d MMM", { locale: sv })}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{deadline.label}</p>
                              <p className="text-sm text-muted-foreground">
                                {deadline.amount.toLocaleString("sv-SE")} kr
                              </p>
                            </div>
                          </div>
                          <div
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              deadline.status === "critical"
                                ? "bg-destructive/10 text-destructive"
                                : deadline.status === "warning"
                                ? "bg-warning/10 text-warning"
                                : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            {deadline.status === "critical"
                              ? "Kritiskt"
                              : deadline.status === "warning"
                              ? "Osäkert"
                              : "Planerad"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent activity */}
                <div className="rounded-md bg-card border border-border shadow-soft">
                  <div className="p-5 border-b border-border">
                    <h2 className="font-semibold text-foreground">Senaste aktivitet</h2>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-accent mt-2 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-foreground">Ärendet skapades</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(latestCase.createdAt), "d MMMM yyyy, HH:mm", { locale: sv })}
                        </p>
                      </div>
                    </div>
                    {latestCase.updatedAt !== latestCase.createdAt && (
                      <div className="flex gap-3">
                        <div className="w-2 h-2 rounded-full bg-accent mt-2 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-foreground">Ärendet uppdaterades</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(latestCase.updatedAt), "d MMMM yyyy, HH:mm", { locale: sv })}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

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
                  <InsightList insights={insights} />
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
                  Hela ärendet i ett dokument: bedömningen, tidslinjen, riskerna med
                  lagrum och nästa steg. Ta med det till mötet med rådgivaren.
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
                      som strukturerad akt - även vägen UT ur plattformen,
                      utan att fråga någon om lov. */}
                  <Button variant="outline" onClick={() => void exportIcs(latestCase)}>
                    <CalendarClock className="h-4 w-4" aria-hidden="true" />
                    Fristkalender (.ics)
                  </Button>
                  <Button variant="outline" onClick={() => void exportBundle(latestCase)}>
                    <FolderDown className="h-4 w-4" aria-hidden="true" />
                    Exportera akt
                  </Button>
                </div>
              </div>

              {/* Documents */}
              {user && (
                <div className="mt-6">
                  <CaseDocuments caseId={latestCase.id} userId={user.id} />
                </div>
              )}

              {/* Quick actions */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {([
                  { icon: TrendingDown, label: "Likviditetsplan", description: "Bygg en plan steg för steg", href: "/likviditetsplan" },
                  { icon: Scale, label: "Kontrollbalansräkning", description: "Räkna på om en KBR krävs", href: "/kbr" },
                  { icon: Users, label: "Hitta rådgivare", description: "Sök i katalogen", href: "/marketplace" },
                ] as { icon: typeof TrendingDown; label: string; description: string; href?: string; comingSoon?: boolean }[]).map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      onClick={() => action.href && navigate(action.href)}
                      disabled={action.comingSoon}
                      title={action.comingSoon ? "Kommer snart" : undefined}
                      className={`p-5 rounded-md bg-card border border-border shadow-soft transition-colors text-left group ${
                        action.comingSoon
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:border-accent/50 hover:shadow-card"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-md bg-accent/10 flex items-center justify-center mb-3 group-hover:bg-accent/20 transition-colors">
                        <Icon className="w-5 h-5 text-accent" />
                      </div>
                      <h3 className="font-medium text-foreground mb-1">{action.label}</h3>
                      <p className="text-sm text-muted-foreground">{action.description}</p>
                    </button>
                  );
                })}
              </div>
            </>
          )}
      </div>
    </DashboardShell>
  );
};

export default Dashboard;
