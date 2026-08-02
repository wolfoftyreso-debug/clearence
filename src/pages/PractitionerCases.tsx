import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { data } from "@/data";
import { countdownTo } from "@/lib/actionPlan";
import { buildExecutiveSummary } from "@/lib/executiveSummary";
import { buildPortfolioSummary } from "@/lib/portfolioSummary";
import { timelineForCase, slugName } from "@/lib/caseAnalysis";
import { buildCaseBundle, timelineToIcs } from "@/lib/integrations/caseBundle";
import { downloadTextFile } from "@/lib/integrations/download";
import type { CaseRecord } from "@/data/types";
import type { TimelineEvent } from "@/lib/crisisAnalysis";
import type { KbrStatus } from "@/data/types";
import {
  ArrowRight,
  AtSign,
  Briefcase,
  CalendarClock,
  CalendarPlus,
  ChevronDown,
  FolderDown,
  Loader2,
  Plug,
  Activity,
} from "lucide-react";

/**
 * Praktikervyn: alla ärenden på en skärm, för rekonstruktören och
 * konkursförvaltaren.
 *
 * En praktiker jonglerar tio bolag samtidigt och lever i två system som
 * inte är våra: byråns ärendesystem och kalendern. Vyn är byggd efter det:
 *
 *  1. FRISTERNA FÖRST, PÅ TVÄRS. Den fråga en förvaltare vaknar med är
 *     inte "hur mår bolag X?" utan "vad förfaller NÄRMAST, i vilket
 *     ärende?". Därför ligger den samlade fristlistan överst - alla
 *     ärendens klockor i en enda lista, och en enda ICS-fil med allt, som
 *     prenumereras in i Outlook där fristerna faktiskt bevakas.
 *
 *  2. ETT KLICK IN I ÄRENDET. "Öppna" väljer ärendet och hela inloggade
 *     läget följer med - handlingsplan, meddelanden, dokument,
 *     händelselogg visar det valda bolaget tills något annat väljs.
 *
 *  3. AKTEN ÄR EXPORTEN. Integration med befintliga ärendesystem börjar
 *     med fil, inte med avtal: akten (JSON) och fristkalendern (ICS) är
 *     format byråsystemen kan läsa in idag. API-synk står som "inom kort"
 *     i integrationsöversikten och kräver partneravtal - tills dess ljuger
 *     vi inte om knappar som inte finns.
 */

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short" });

const toneClass: Record<string, string> = {
  passed: "text-frist",
  today: "text-frist",
  soon: "text-warning",
  later: "text-muted-foreground",
};

interface CrossCaseEvent extends TimelineEvent {
  caseRecord: CaseRecord;
}

const PractitionerCases = () => {
  const navigate = useNavigate();
  const now = new Date();

  const { data: cases, isLoading } = useQuery({
    queryKey: ["my-cases"],
    queryFn: () => data.cases.listMine(),
  });

  const taskQueries = useQueries({
    queries: (cases ?? []).map((c) => ({
      queryKey: ["case-tasks", c.id],
      queryFn: () => data.tasks.listByCase(c.id),
    })),
  });

  // Taggnotiserna på korten: "N väntar på DITT svar" per ärende. Samma
  // källa som notisklockan, så siffrorna kan inte säga olika saker.
  const { data: mentions } = useQuery({
    queryKey: ["open-mentions"],
    queryFn: () => data.messages.myOpenMentions(),
    retry: false,
  });
  const mentionCount = (caseId: string): number =>
    (mentions ?? []).filter((m) => m.caseId === caseId).length;

  const kbrQueries = useQueries({
    queries: (cases ?? []).map((c) => ({
      queryKey: ["kbr-latest", c.id],
      queryFn: () => data.kbr.getLatestByCase(c.id),
    })),
  });

  const [exportingAll, setExportingAll] = useState(false);

  // Portföljrapporten: arbetsledarens rader och rangordningen "vilket
  // ärende kräver mig först". Byggd ur samma motorer som ärenderapporten,
  // så siffrorna aldrig kan säga olika saker.
  const portfolioCases = (cases ?? []).map((c, index) => {
    const caseTimeline = timelineForCase(c);
    const caseTasks = taskQueries[index]?.data ?? [];
    const summary = buildExecutiveSummary({
      caseRecord: c,
      timeline: caseTimeline,
      tasks: caseTasks,
      members: [],
      kbr: kbrQueries[index]?.data ?? null,
      documentCount: 0,
      payments: [],
      now,
    });
    return {
      caseRecord: c,
      severity: summary.severity,
      timeline: caseTimeline,
      openTasks: caseTasks.filter((t) => !t.doneAt).length,
      openMentions: (mentions ?? []).filter((m) => m.caseId === c.id).length,
    };
  });
  const portfolio = buildPortfolioSummary(portfolioCases, now);
  const byCaseId = new Map(portfolioCases.map((pc) => [pc.caseRecord.id, pc]));

  // Klientfältet: rådgivarens dag i fyra tal. Samma källor som korten
  // nedanför - listan och siffrorna kan aldrig säga olika saker.
  const clientStats = {
    active: (cases ?? []).filter((c) => !c.closedAt || c.healthMode).length,
    critical: portfolioCases.filter((pc) => pc.severity === "critical").length,
    openTasks: portfolioCases.reduce((sum, pc) => sum + pc.openTasks, 0),
    waiting: (mentions ?? []).length,
  };

  // Varje kort i klientfältet fäller ut sin fördjupning: siffran är
  // rubriken, listan under är svaret på "vilka?". Raderna leder in i
  // ärendet - ett tal man inte kan agera på är bara dekoration.
  type StatDetail = "active" | "critical" | "tasks" | "waiting";
  const [statDetail, setStatDetail] = useState<StatDetail | null>(null);

  // Alla öppna uppgifter på tvärs, närmast förfallodag först.
  const allOpenTasks = (cases ?? [])
    .flatMap((c, index) =>
      (taskQueries[index]?.data ?? [])
        .filter((t) => !t.doneAt)
        .map((t) => ({ task: t, record: c })),
    )
    .sort((a, b) => (a.task.dueDate ?? "9999").localeCompare(b.task.dueDate ?? "9999"));

  const caseById = new Map((cases ?? []).map((c) => [c.id, c]));

  /** Risknivån per klient, ur samma bedömning som prioritetsordningen. */
  const RISK_BADGE: Record<string, { label: string; tone: string }> = {
    critical: { label: "Kritisk", tone: "border-frist/50 bg-frist/10 text-frist" },
    serious: { label: "Hög", tone: "border-warning/50 bg-warning/10 text-foreground" },
    elevated: { label: "Medel", tone: "border-border bg-secondary text-foreground" },
    stable: { label: "Låg", tone: "border-border text-muted-foreground" },
  };

  /** Ärendetypen som klientlistans statuskolumn. */
  const caseStatus = (record: CaseRecord): string => {
    if (record.healthMode) return "Hälsoläge";
    if (record.closedAt) return "Avslutat";
    if (record.recommendationType === "reconstruction") return "Rekonstruktion";
    if (record.recommendationType === "bankruptcy") return "Konkursansökan";
    const kbr = kbrForCard(record.id);
    if (kbr && (kbr.status === "required" || kbr.status === "critical")) return "Kontrollbalans";
    return "Stabilisering";
  };
  const orderedCases = portfolio.ranked
    .map((r) => ({ ...r, pc: byCaseId.get(r.caseId) }))
    .filter((r) => r.pc !== undefined);

  const kbrForCard = (caseId: string) => {
    const index = (cases ?? []).findIndex((c) => c.id === caseId);
    return index >= 0 ? (kbrQueries[index]?.data ?? null) : null;
  };

  /** Närmaste öppna uppgift i ärendet - klientlistans "nästa aktivitet". */
  const nextTaskFor = (caseId: string) => {
    const index = (cases ?? []).findIndex((c) => c.id === caseId);
    const tasks = index >= 0 ? (taskQueries[index]?.data ?? []) : [];
    return (
      tasks
        .filter((t) => !t.doneAt)
        .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))[0] ?? null
    );
  };

  /**
   * KBR-läget som badge. Tonerna följer produktens regel: fristfärgen är
   * reserverad för lagstadgat allvar - 'krävs' och 'kritisk' - inte för
   * information.
   */
  const KBR_BADGE: Record<KbrStatus, { label: string; tone: string }> = {
    not_required: { label: "KBR ej påkallad", tone: "border-border text-muted-foreground" },
    warning: { label: "KBR: varningszon", tone: "border-warning/50 bg-warning/10 text-foreground" },
    required: { label: "KBR krävs", tone: "border-frist/50 bg-frist/10 text-frist" },
    critical: { label: "KBR: kritisk", tone: "border-frist/50 bg-frist/10 text-frist" },
  };

  /**
   * Massexporten: samtliga akter i EN fil. Sekventiellt per ärende - tio
   * bolags underlag hämtas på någon sekund, och en fil är vad ett
   * byråsystem eller en pärm förväntar sig, inte tio nedladdningar.
   */
  const exportAllBundles = async () => {
    if (!cases || cases.length === 0) return;
    setExportingAll(true);
    try {
      const exportedAt = new Date().toISOString();
      const bundles = [];
      for (const record of cases) {
        const [payments, documents, messages] = await Promise.all([
          data.payments.listByCase(record.id),
          data.documents.listByCase(record.id),
          data.messages.listByCase(record.id),
        ]);
        bundles.push(
          buildCaseBundle({
            caseRecord: record,
            timeline: timelineForCase(record),
            payments,
            documents,
            messages,
            ownerUserId: null,
            exportedAt,
          }),
        );
      }
      downloadTextFile(
        JSON.stringify({ format: "clearance-akt-samling", formatVersion: 1, exportedAt, bundles }, null, 2),
        `akter-alla-arenden-${exportedAt.slice(0, 10)}.json`,
        "application/json",
      );
    } finally {
      setExportingAll(false);
    }
  };

  // Alla ärendens frister i en lista, närmast först.
  const allEvents: CrossCaseEvent[] = (cases ?? [])
    .flatMap((c) => timelineForCase(c).map((event) => ({ ...event, caseRecord: c })))
    .sort((a, b) => a.iso.localeCompare(b.iso));

  const exportAllIcs = () => {
    // Bolagsnamnet in i etiketten: i en samlad kalender är "Skatt/moms
    // förfaller" utan bolag värre än ingen kalender alls.
    const labelled = allEvents.map((e) => ({
      ...e,
      label: `${e.caseRecord.companyName ?? e.caseRecord.orgNumber}: ${e.label}`,
    }));
    downloadTextFile(
      timelineToIcs(labelled, {
        companyName: "Samtliga ärenden",
        orgNumber: "clearance",
        generatedAt: new Date().toISOString(),
      }),
      `frister-alla-arenden-${new Date().toISOString().slice(0, 10)}.ics`,
      "text/calendar;charset=utf-8",
    );
  };

  const exportCaseIcs = (record: CaseRecord) => {
    downloadTextFile(
      timelineToIcs(timelineForCase(record), {
        companyName: record.companyName,
        orgNumber: record.orgNumber,
        generatedAt: new Date().toISOString(),
      }),
      `frister-${slugName(record)}.ics`,
      "text/calendar;charset=utf-8",
    );
  };

  const openCase = (record: CaseRecord, path = "/dashboard") => {
    data.cases.select(record.id);
    navigate(path);
  };

  return (
    <DashboardShell title="Ärendeöversikt">
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <h1 className="text-2xl font-semibold text-foreground">Ärendeöversikt</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Alla ärenden du har åtkomst till, med fristerna på tvärs. Byggd för
            rekonstruktörens och förvaltarens vardag: närmaste klocka först,
            oavsett bolag.
          </p>
        </header>

        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden="true" />
        ) : (cases ?? []).length === 0 ? (
          <div className="rounded-md border border-border bg-card p-6">
            <Briefcase className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Inga ärenden än. Du får åtkomst genom att bolaget bjuder in dig
              som rekonstruktör eller förvaltare – be dem gå till Deltagare i
              sitt ärende och skicka en inbjudan till din e-postadress.
            </p>
          </div>
        ) : (
          <>
            {/* Klientfältet: dagen i fyra tal, före all analys. Varje kort
                fäller ut sin fördjupning med klickbara rader in i ärendet. */}
            <section aria-label="Mina klienter">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(
                  [
                    { key: "active", label: "Aktiva", value: clientStats.active, tone: "text-foreground" },
                    {
                      key: "critical",
                      label: "Kritiska",
                      value: clientStats.critical,
                      tone: clientStats.critical > 0 ? "text-frist" : "text-foreground",
                    },
                    { key: "tasks", label: "Åtgärder", value: clientStats.openTasks, tone: "text-foreground" },
                    {
                      key: "waiting",
                      label: "Väntar på svar",
                      value: clientStats.waiting,
                      tone: clientStats.waiting > 0 ? "text-warning" : "text-foreground",
                    },
                  ] as { key: StatDetail; label: string; value: number; tone: string }[]
                ).map((stat) => {
                  const open = statDetail === stat.key;
                  return (
                    <button
                      key={stat.key}
                      type="button"
                      aria-expanded={open}
                      onClick={() => setStatDetail(open ? null : stat.key)}
                      className={`rounded-md border p-3 text-left transition-colors ${
                        open
                          ? "border-accent bg-accent/5"
                          : "border-border bg-card hover:border-accent/60"
                      }`}
                    >
                      <p className="flex items-center justify-between gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {stat.label}
                        <ChevronDown
                          className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                          aria-hidden="true"
                        />
                      </p>
                      <p className={`mt-0.5 text-2xl font-semibold tabular-nums ${stat.tone}`}>
                        {stat.value}
                      </p>
                    </button>
                  );
                })}
              </div>

              {statDetail && (
                <div className="mt-2 rounded-md border border-accent/40 bg-card p-1">
                  {statDetail === "active" || statDetail === "critical" ? (
                    (() => {
                      const rows = portfolioCases.filter((pc) =>
                        statDetail === "critical"
                          ? pc.severity === "critical"
                          : !pc.caseRecord.closedAt || pc.caseRecord.healthMode,
                      );
                      return rows.length === 0 ? (
                        <p className="p-3 text-sm text-muted-foreground">
                          {statDetail === "critical"
                            ? "Inget bolag är i kritiskt läge just nu."
                            : "Inga aktiva ärenden."}
                        </p>
                      ) : (
                        <ul className="divide-y divide-border">
                          {rows.map((pc) => (
                            <li key={pc.caseRecord.id}>
                              <button
                                type="button"
                                onClick={() => openCase(pc.caseRecord)}
                                className="flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-secondary/50"
                              >
                                <span className="min-w-0">
                                  <span className="block text-sm font-medium text-foreground">
                                    {pc.caseRecord.companyName ?? pc.caseRecord.orgNumber}
                                  </span>
                                  <span className="block text-xs text-muted-foreground">
                                    {caseStatus(pc.caseRecord)} · Risk:{" "}
                                    {RISK_BADGE[pc.severity]?.label ?? "Låg"}
                                    {pc.timeline[0] &&
                                      ` · Nästa frist ${countdownTo(pc.timeline[0].iso, now).label}`}
                                  </span>
                                </span>
                                <ArrowRight className="h-4 w-4 flex-shrink-0 text-accent" aria-hidden="true" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      );
                    })()
                  ) : statDetail === "tasks" ? (
                    allOpenTasks.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">
                        Inga öppna uppgifter i ärendena.
                      </p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {allOpenTasks.map(({ task, record }) => (
                          <li key={task.id}>
                            <button
                              type="button"
                              onClick={() => openCase(record)}
                              className="flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-secondary/50"
                            >
                              <span className="min-w-0">
                                <span className="block text-sm font-medium text-foreground">
                                  {task.label}
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                  {record.companyName ?? record.orgNumber}
                                  {task.dueDate &&
                                    ` · ${countdownTo(task.dueDate, now).label}`}
                                </span>
                              </span>
                              <ArrowRight className="h-4 w-4 flex-shrink-0 text-accent" aria-hidden="true" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )
                  ) : (mentions ?? []).length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">
                      Ingen väntar på ditt svar just nu.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {(mentions ?? []).map((mention) => {
                        const record = caseById.get(mention.caseId);
                        if (!record) return null;
                        return (
                          <li key={mention.messageId}>
                            <button
                              type="button"
                              onClick={() => openCase(record, "/dashboard/meddelanden")}
                              className="flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-secondary/50"
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-foreground">
                                  {mention.body}
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                  {record.companyName ?? record.orgNumber}
                                  {mention.authorName && ` · ${mention.authorName}`}
                                </span>
                              </span>
                              <ArrowRight className="h-4 w-4 flex-shrink-0 text-accent" aria-hidden="true" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </section>

            {/* Portföljrapporten */}
            <section className="rounded-md border border-border bg-card p-5 shadow-soft">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Activity className="h-5 w-5 text-accent" aria-hidden="true" />
                Portföljanalys
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Bygger på samtliga öppna ärenden och uppdateras automatiskt när
                något ändras.
              </p>
              <ul className="mt-3 space-y-1.5">
                {portfolio.lines.map((line) => (
                  <li key={line} className="text-sm leading-relaxed text-foreground">
                    {line}
                  </li>
                ))}
              </ul>
            </section>

            {/* Samlade frister */}
            <section aria-labelledby="deadlines-heading">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2
                  id="deadlines-heading"
                  className="flex items-center gap-2 text-lg font-semibold text-foreground"
                >
                  <CalendarClock className="h-5 w-5 text-accent" aria-hidden="true" />
                  Närmaste frister – alla ärenden
                </h2>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={allEvents.length === 0}
                    onClick={exportAllIcs}
                  >
                    <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                    Hela kalendern (ICS)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={exportingAll}
                    onClick={() => void exportAllBundles()}
                  >
                    {exportingAll ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <FolderDown className="h-4 w-4" aria-hidden="true" />
                    )}
                    Alla akter (JSON)
                  </Button>
                </div>
              </div>
              {allEvents.length === 0 ? (
                <p className="mt-3 rounded-md bg-secondary/40 p-4 text-sm text-muted-foreground">
                  Inga kommande frister i ärendena.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-border rounded-md border border-border">
                  {allEvents.slice(0, 8).map((event) => {
                    const countdown = countdownTo(event.iso, now);
                    return (
                      <li
                        key={`${event.caseRecord.id}-${event.iso}-${event.label}`}
                        className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-3"
                      >
                        <span className="min-w-0 flex-1 text-sm text-foreground">
                          <span className="font-medium">
                            {event.caseRecord.companyName ?? event.caseRecord.orgNumber}
                          </span>{" "}
                          · {event.label}
                        </span>
                        <span
                          className={`flex-shrink-0 text-sm font-semibold tabular-nums ${toneClass[countdown.tone]}`}
                        >
                          {formatDate(event.iso)} · {countdown.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Ärendekorten */}
            <section aria-label="Ärenden" className="space-y-3">
              {orderedCases.map(({ pc, reason }) => {
                const record = pc!.caseRecord;
                const nextEvent = pc!.timeline[0] ?? null;
                const tasks = pc!.openTasks;
                return (
                  <article
                    key={record.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-border bg-card p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-foreground">
                          {record.companyName ?? record.orgNumber}
                        </h3>
                        <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-foreground">
                          {caseStatus(record)}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${RISK_BADGE[pc!.severity]?.tone ?? RISK_BADGE.stable.tone}`}
                        >
                          Risk: {RISK_BADGE[pc!.severity]?.label ?? "Låg"}
                        </span>
                        {byCaseId.get(record.id) && kbrForCard(record.id) && (
                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${KBR_BADGE[kbrForCard(record.id)!.status].tone}`}
                          >
                            {KBR_BADGE[kbrForCard(record.id)!.status].label}
                          </span>
                        )}
                        {mentionCount(record.id) > 0 && (
                          <span className="flex items-center gap-1 rounded-full border border-frist/50 bg-frist/10 px-2 py-0.5 text-xs font-medium text-frist">
                            <AtSign className="h-3 w-3" aria-hidden="true" />
                            {mentionCount(record.id)} väntar på ditt svar
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {record.orgNumber}
                        {record.recommendationTitle && ` · ${record.recommendationTitle}`}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/80">Prioritet: {reason}.</span>{" "}
                        {nextEvent
                          ? `Nästa frist: ${nextEvent.label} ${countdownTo(nextEvent.iso, now).label}`
                          : "Inga kommande frister"}
                        {` · ${tasks} öppna uppgifter`}
                      </p>
                      {nextTaskFor(record.id) && (
                        <p className="mt-0.5 text-xs text-foreground/80">
                          Nästa aktivitet: {nextTaskFor(record.id)!.label}
                          {nextTaskFor(record.id)!.dueDate &&
                            ` – ${countdownTo(nextTaskFor(record.id)!.dueDate!, now).label}`}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => exportCaseIcs(record)}>
                        Frister (ICS)
                      </Button>
                      <Button size="sm" onClick={() => openCase(record)}>
                        Öppna
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </article>
                );
              })}
            </section>

            {/* Integrationsvägen */}
            <section className="rounded-md bg-secondary/40 p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Plug className="h-4 w-4 text-accent" aria-hidden="true" />
                Ditt ärendesystem
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Integrationen börjar med fil, inte med avtal: akten (JSON, från
                ärendets översikt) och fristkalendern (ICS, ovan) läses in av
                de flesta byråsystem idag. Direktsynk via API till system som
                Saturnus, Advokatit m.fl. kräver partneravtal och står som
                &quot;Inom kort&quot; i integrationsöversikten på dokumentsidan
                – vi visar inga knappar som inte fungerar.
              </p>
            </section>
          </>
        )}
      </div>
    </DashboardShell>
  );
};

export default PractitionerCases;
