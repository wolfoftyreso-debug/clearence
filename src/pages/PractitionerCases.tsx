import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { data } from "@/data";
import { countdownTo } from "@/lib/actionPlan";
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
  FolderDown,
  Loader2,
  Plug,
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

  const openTaskCount = (index: number): number | null => {
    const q = taskQueries[index];
    if (!q || !q.data) return null;
    return q.data.filter((t) => !t.doneAt).length;
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

  const openCase = (record: CaseRecord) => {
    data.cases.select(record.id);
    navigate("/dashboard");
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
              {(cases ?? []).map((record, index) => {
                const nextEvent = timelineForCase(record)[0] ?? null;
                const tasks = openTaskCount(index);
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
                        {kbrQueries[index]?.data && (
                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${KBR_BADGE[kbrQueries[index].data.status].tone}`}
                          >
                            {KBR_BADGE[kbrQueries[index].data.status].label}
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
                        {nextEvent
                          ? `Nästa frist: ${nextEvent.label} ${countdownTo(nextEvent.iso, now).label}`
                          : "Inga kommande frister"}
                        {tasks !== null && ` · ${tasks} öppna uppgifter`}
                      </p>
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
