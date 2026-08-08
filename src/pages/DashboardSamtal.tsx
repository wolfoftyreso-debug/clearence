import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { data } from "@/data";
import { useAuth } from "@/hooks/useAuth";
import {
  CLARA,
  DIALOG_FLOWS,
  EMAIL_SHAPE,
  FALLBACK_REPLY,
  INVITE_CONTRACT,
  answerLabel,
  buildCaseSnapshot,
  buildPriorities,
  decisionCheckIn,
  inviteIntent,
  invoiceIntent,
  matchFlow,
  type InviteRole,
  type DialogAssessment,
  type DialogFlow,
  type DialogMeter,
  type PlanRow,
  type SnapshotRow,
} from "@/lib/advisor/dialog";
import { OPTIONS_STANCE } from "@/lib/advisor/options";
import {
  NO_WATCH_LABEL,
  WATCH_STATE_LABEL,
  describeWatch,
  evaluatePremise,
  premiseFlags,
  proposeWatches,
  type PremiseFacts,
} from "@/lib/advisor/premiseWatch";
import { buildWorkingModel, sinceLastVisit } from "@/lib/advisor/memory";
import { ClaraIntro } from "@/components/advisor/ClaraIntro";
import { ShowMeBar } from "@/components/guide/ShowMeBar";
import { useEntitlements } from "@/components/billing/LockedFeature";
import { lockMessage } from "@/lib/pricing";
import { caseInvitationEmail } from "@/lib/email/messages";
import { CASE_ROLE_DESCRIPTIONS, CASE_ROLE_LABELS } from "@/lib/caseRoles";
import { analyseCrisis } from "@/lib/crisisAnalysis";
import { analysisInputFromCase, parseAmount } from "@/lib/caseAnalysis";
import { countdownTo } from "@/lib/actionPlan";
import type { AdvisorSessionRecord } from "@/data/types";
import { useInlineReport } from "@/components/reports/useInlineReport";
import { DataMinimeringHint } from "@/components/privacy/DataMinimeringHint";
import { buildInvoiceDocument, invoiceFromCustomerRecord } from "@/lib/reports/invoiceDocuments";
import { ArrowRight, ChevronDown, Compass, FileCheck2, FileText, Gavel, RotateCcw, Send } from "lucide-react";

/* --- Conversation UI-blocken: rätt medium för budskapet -------------------- */

const SNAPSHOT_DOT: Record<SnapshotRow["tone"], string> = {
  critical: "bg-destructive",
  warning: "bg-warning",
  success: "bg-success",
};

/**
 * Lägesbilden: områden med ton och not.
 *
 * Det här är NULÄGE ATT LÄSA. Handlingarna bor under "Det viktigaste nu"
 * och ser klickbara ut - de två uttrycken får aldrig likna varandra.
 *
 * Tre saker fick tidigare raderna att se klickbara ut, och alla tre är
 * borta nu:
 *
 *  1. Noten var `text-muted-foreground`, som i den här paletten är
 *     blågrå (hue 220) - alltså nästan accentens kulör. Blå text läser
 *     som länk. Nu neutral mörk.
 *  2. `divide-y` gav raderna formen av en lista man tappar i. Borta.
 *  3. Blocket saknade egen yta och svävade i samma vita fält som de
 *     klickbara raderna direkt under. Nu en egen, ramlös läsyta.
 *
 * `<dl>` och inte `<ul>`: det ÄR uppgift och värde, och en definitions-
 * lista säger det både för skärmläsaren och för den som läser koden.
 */
const SnapshotList = ({ rows }: { rows: SnapshotRow[] }) => (
  <dl className="cursor-default space-y-2 rounded-md bg-secondary/50 p-3.5">
    {rows.map((row) => (
      <div key={row.label} className="flex items-start gap-2.5">
        <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${SNAPSHOT_DOT[row.tone]}`} aria-hidden="true" />
        <div className="min-w-0 flex-1 text-sm leading-relaxed">
          <dt className="inline font-semibold text-foreground">{row.label}</dt>
          <dd className="inline text-foreground/75"> – {row.note}</dd>
        </div>
      </div>
    ))}
  </dl>
);

/** Mätaren: stapel + tal, för det som mäts. */
const MeterBar = ({ meter }: { meter: DialogMeter }) => (
  <div className="rounded-md border border-border p-3">
    <div className="flex items-baseline justify-between gap-3">
      <p className="text-sm font-medium text-foreground">{meter.label}</p>
      <p className="text-sm font-semibold tabular-nums text-foreground">{meter.percent} %</p>
    </div>
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary" role="img" aria-label={`${meter.label}: ${meter.percent} procent`}>
      <div
        className={`h-full rounded-full ${meter.percent < 50 ? "bg-destructive" : meter.percent < 100 ? "bg-warning" : "bg-success"}`}
        style={{ width: `${Math.max(4, meter.percent)}%` }}
      />
    </div>
    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{meter.note}</p>
  </div>
);

/** Processtidslinjen: ordningen, som punkter på en linje. */
const PlanTimeline = ({ rows }: { rows: PlanRow[] }) => (
  <ol className="space-y-0">
    {rows.map((row, i) => (
      <li key={`${row.when}-${row.label}`} className="relative flex gap-3 pb-3 last:pb-0">
        <span className="flex flex-col items-center" aria-hidden="true">
          <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full border-2 border-accent bg-card" />
          {i < rows.length - 1 && <span className="w-px flex-1 bg-border" />}
        </span>
        <span className="min-w-0 pb-1">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{row.when}</span>
          <span className="block text-sm leading-relaxed text-foreground">{row.label}</span>
        </span>
      </li>
    ))}
  </ol>
);

/**
 * Samtalet med krisrådgivaren: produktens framsida i dialogform.
 *
 * Användaren beskriver vad som hänt; motorn känner igen situationen,
 * ställer sina frågor en i taget och svarar med en bedömning och
 * konkreta handlingar. Allt är deterministiskt (src/lib/advisor/dialog.ts)
 * - ingen språkmodell, inga gissningar, samma svar på samma frågor.
 *
 * Samtalet journalförs som ärendejournal och bedömningen kan
 * protokollföras som beslut MED premiss - omprövningsvillkoret som gör
 * att systemet senare kan säga "beslutet vilade på X; X har ändrats,
 * vill ni ompröva?". Det är kontinuiteten en generell chatt inte har.
 */

interface ChatEntry {
  who: "user" | "radgivare";
  text: string;
}

const SEVERITY_TONE: Record<DialogAssessment["severity"], string> = {
  critical: "border-frist/50 bg-frist/10 text-frist",
  serious: "border-warning/60 bg-warning/15 text-foreground",
  elevated: "border-warning/50 bg-warning/10 text-foreground",
};

const DashboardSamtal = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const { exportAndSharing: inviteEntitled, plan } = useEntitlements();

  const { data: latestCase, isLoading } = useQuery({
    queryKey: ["latest-case", user?.id],
    queryFn: () => data.cases.getLatest(),
    enabled: !!user,
  });
  const { data: decisions } = useQuery({
    queryKey: ["case-decisions", latestCase?.id],
    queryFn: () => data.dialogue.listDecisions(latestCase!.id),
    enabled: !!latestCase,
  });
  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => data.profile.getMine(),
    retry: false,
  });
  const { data: kbr } = useQuery({
    queryKey: ["kbr-latest", latestCase?.id],
    queryFn: () => data.kbr.getLatestByCase(latestCase!.id),
    retry: false,
    enabled: !!latestCase,
  });
  const { data: members } = useQuery({
    queryKey: ["case-members", latestCase?.id],
    queryFn: () => data.members.listMembers(latestCase!.id),
    retry: false,
    enabled: !!latestCase,
  });
  const { data: pastSessions } = useQuery({
    queryKey: ["advisor-sessions", latestCase?.id],
    queryFn: () => data.dialogue.listSessions(latestCase!.id),
    retry: false,
    enabled: !!latestCase,
  });
  const { data: auditEvents } = useQuery({
    queryKey: ["case-audit", latestCase?.id],
    queryFn: () => data.audit.listByCase(latestCase!.id),
    retry: false,
    enabled: !!latestCase,
  });

  // Sedan sist: journalens händelser efter senaste AVSLUTADE samtalet -
  // ett påbörjat men oavslutat samtal är inget "senast vi pratades vid".
  const lastVisit = pastSessions?.find((s) => s.closedAt)?.closedAt ?? null;
  const sinceLines = useMemo(
    () => sinceLastVisit(auditEvents ?? [], lastVisit),
    [auditEvents, lastVisit],
  );

  // Lägesbilden i hälsningen: byggd ur ärendets egna siffror.
  const caseSnapshot = useMemo(() => {
    if (!latestCase) return null;
    const timeline = analyseCrisis(analysisInputFromCase(latestCase)).timeline;
    const counted = timeline.map((e) => ({ label: e.label, countdown: countdownTo(e.iso, new Date()) }));
    const upcoming = counted
      .filter((c) => c.countdown.tone !== "passed")
      .sort((a, b) => a.countdown.daysLeft - b.countdown.daysLeft);
    const totalDebt = parseAmount(latestCase.totalDebt);
    const liquidation = parseAmount(latestCase.quickLiquidationValue);
    const coverageRatio = totalDebt > 0 ? Math.round((liquidation / totalDebt) * 100) : null;
    const passedDeadlines = counted.filter((c) => c.countdown.tone === "passed").length;
    const daysToNextDeadline = upcoming.length ? upcoming[0].countdown.daysLeft : null;
    return {
      coverageRatio,
      // Underlaget omprövningsbevakningen räknar mot. Byggt HÄR, ur samma
      // siffror som lägesbilden - bevakningen får aldrig ha en egen
      // sanning om ärendet.
      facts: {
        coverageRatio,
        totalDebt: totalDebt > 0 ? totalDebt : null,
        canPaySalary: latestCase.canPaySalary,
        canPayTax: latestCase.canPayTax,
        canPayRent: latestCase.canPayRent,
        canPaySuppliers: latestCase.canPaySuppliers,
        passedDeadlines,
      } as PremiseFacts,
      nextDeadline: upcoming.length
        ? { label: upcoming[0].label, daysLeft: upcoming[0].countdown.daysLeft }
        : null,
      rows: buildCaseSnapshot({ coverageRatio, passedDeadlines, daysToNextDeadline, kbrDone: !!kbr }),
      // "Det viktigaste nu": högst tre numrerade steg ur samma underlag.
      priorities: buildPriorities({
        coverageRatio,
        passedDeadlines,
        daysToNextDeadline,
        nextDeadlineLabel: upcoming.length ? upcoming[0].label : null,
        kbrDone: !!kbr,
      }),
    };
  }, [latestCase, kbr]);

  // Arbetsmodellen: öppen för användaren, med källa per uppgift.
  const workingModel = useMemo(
    () =>
      latestCase
        ? buildWorkingModel({
            caseRecord: latestCase,
            decisions: decisions ?? [],
            members: members ?? [],
            nextDeadline: caseSnapshot?.nextDeadline ?? null,
            kbrDone: !!kbr,
          })
        : null,
    [latestCase, decisions, members, caseSnapshot, kbr],
  );

  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [flow, setFlow] = useState<DialogFlow | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [assessment, setAssessment] = useState<DialogAssessment | null>(null);
  const [input, setInput] = useState("");
  const [decisionSaved, setDecisionSaved] = useState(false);
  const sessionRef = useRef<AdvisorSessionRecord | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const startedFromQuery = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [entries.length, assessment]);

  const currentStep = flow && !assessment ? flow.steps[stepIndex] : null;

  /** Journalför samtalet - varje rad, i den ordning den föll. */
  const persist = (allEntries: ChatEntry[], closed: boolean) => {
    if (!latestCase || !sessionRef.current) return;
    sessionRef.current = {
      ...sessionRef.current,
      closedAt: closed ? new Date().toISOString() : sessionRef.current.closedAt,
      entries: allEntries.map((e) => ({ at: new Date().toISOString(), who: e.who, text: e.text })),
    };
    void data.dialogue.saveSession(sessionRef.current);
  };

  const say = (added: ChatEntry[], closed = false) => {
    setEntries((prev) => {
      const next = [...prev, ...added];
      persist(next, closed);
      return next;
    });
  };

  /* Ärendeminnets regel: CLEARANCE frågar aldrig om sådant den redan vet.
     Svar som finns i ärendet fylls i före första frågan - och den säger
     att den hoppar över dem, så minnet syns i stället för att anas. */
  const knownAnswers = (chosen: DialogFlow): { answers: Record<string, string>; notes: string[] } => {
    const known: Record<string, string> = {};
    const notes: string[] = [];
    if (chosen.steps.some((s) => s.id === "kbr") && kbr) {
      known.kbr = "ja";
      notes.push("Kontrollbalansbedömningen är redan gjord i ärendet, så den frågan hoppar jag över.");
    }
    return { answers: known, notes };
  };

  const nextUnanswered = (chosen: DialogFlow, from: number, ans: Record<string, string>): number => {
    let i = from;
    while (i < chosen.steps.length && ans[chosen.steps[i].id] !== undefined) i += 1;
    return i;
  };

  const startFlow = (chosen: DialogFlow, userText: string) => {
    if (!latestCase) return;
    sessionRef.current = {
      id: crypto.randomUUID(),
      caseId: latestCase.id,
      flowId: chosen.id,
      flowTitle: chosen.title,
      startedAt: new Date().toISOString(),
      closedAt: null,
      entries: [],
    };
    const known = knownAnswers(chosen);
    const first = nextUnanswered(chosen, 0, known.answers);
    setFlow(chosen);
    setStepIndex(first);
    setAnswers(known.answers);
    setAssessment(null);
    setDecisionSaved(false);
    // Konstitutionen: först bekräftelsen och tryggheten, sedan EN fråga.
    say([
      { who: "user", text: userText },
      { who: "radgivare", text: chosen.ack },
      ...known.notes.map((text) => ({ who: "radgivare" as const, text })),
      { who: "radgivare", text: chosen.steps[first].prompt },
    ]);
  };

  /* "Vilka alternativ har jag?" är ingen frågeserie - det är en vy.
     CLEARANCE svarar med hållningen och öppnar handlingsalternativen själv:
     användaren ska aldrig behöva tänka "var ska jag klicka?". */
  const openOptions = (userText: string) => {
    say([
      { who: "user", text: userText },
      { who: "radgivare", text: `${OPTIONS_STANCE} Jag öppnar nu handlingsalternativen.` },
    ]);
    window.setTimeout(() => navigate("/dashboard/alternativ"), 1600);
  };

  const handleFreeText = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    /* Åtgärdsintention före analysintention: "jag behöver min revisor"
       startar Action Contract, inte en frågeserie. */
    const role = inviteIntent(trimmed);
    if (role && latestCase) {
      // Betalväggen: delning med externa väntar på första betalningen.
      // Rådgivaren säger det ärligt - inget arbete går förlorat.
      if (!inviteEntitled) {
        say([
          { who: "user", text: trimmed },
          { who: "radgivare", text: `Delning med externa rådgivare ${lockMessage(plan).charAt(0).toLowerCase()}${lockMessage(plan).slice(1)}` },
        ]);
        return;
      }
      setInvite({ role, stage: "ask" });
      say([
        { who: "user", text: trimmed },
        { who: "radgivare", text: INVITE_CONTRACT.askEmail(CASE_ROLE_LABELS[role]) },
      ]);
      return;
    }
    if (/alternativ|vägar framåt|vad kan jag göra/i.test(trimmed)) {
      openOptions(trimmed);
      return;
    }
    /* Abonnemangsfakturan - före krisflödena, annars äter kundflödet
       ordet "faktura". Kortet visas i samtalet; allt finns också under
       Inställningar. */
    if (invoiceIntent(trimmed)) {
      say([{ who: "user", text: trimmed }]);
      void data.billing.listMyInvoices().then((invoices) => {
        const latest = invoices[0] ?? null;
        setInvoiceCard(latest);
        say([
          {
            who: "radgivare",
            text: latest
              ? `Här är din senaste faktura. Alla fakturor och kvitton finns samlade under Inställningar.`
              : "Ingen faktura är utställd ännu. När abonnemanget startar skapas månadsfakturan automatiskt och landar under Inställningar – jag säger till här när den finns.",
          },
        ]);
      });
      return;
    }
    const matched = matchFlow(trimmed);
    if (matched) {
      startFlow(matched, trimmed);
    } else {
      // Ingen återvändsgränd: rådgivaren guidar genom nulägesanalysen
      // och öppnar den själv - användaren skickas aldrig iväg.
      say([{ who: "user", text: trimmed }, ...FALLBACK_REPLY.map((t) => ({ who: "radgivare" as const, text: t }))]);
      window.setTimeout(() => navigate("/wizard"), 2600);
    }
  };

  const answerStep = (raw: string) => {
    if (!flow || !currentStep) return;
    const nextAnswers = { ...answers, [currentStep.id]: raw };
    setAnswers(nextAnswers);
    const shown = answerLabel(currentStep, raw);
    const next = nextUnanswered(flow, stepIndex + 1, nextAnswers);
    if (next < flow.steps.length) {
      setStepIndex(next);
      say([
        { who: "user", text: shown },
        { who: "radgivare", text: flow.steps[next].prompt },
      ]);
    } else {
      const result = flow.assess(nextAnswers);
      setAssessment(result);
      // Konstitutionen: det korta svaret i flödet - kärnan och gränsen.
      // Hela motiveringen ligger ett klick bort i bedömningsblocket.
      const lead = result.paragraphs[0];
      const boundary = result.paragraphs[result.paragraphs.length - 1];
      say(
        [
          { who: "user", text: shown },
          { who: "radgivare", text: lead },
          ...(boundary !== lead ? [{ who: "radgivare" as const, text: boundary }] : []),
        ],
        true,
      );
      queryClient.invalidateQueries({ queryKey: ["case-audit", latestCase?.id] });
    }
  };

  /* Action Contract, steg för steg. Adressen tas emot, mejlet byggs med
     SAMMA byggare som utskicket använder, och visas i sin helhet före
     bekräftelsen. Användaren ska aldrig bli överraskad. */
  const [invite, setInvite] = useState<null | {
    role: InviteRole;
    stage: "ask" | "confirm";
    email?: string;
    preview?: { recipient: string; subject: string; bodyText: string };
  }>(null);

  const handleInviteEmail = (raw: string) => {
    if (!invite || !latestCase) return;
    const email = raw.trim().toLowerCase();
    if (!EMAIL_SHAPE.test(email)) {
      say([
        { who: "user", text: raw.trim() },
        { who: "radgivare", text: INVITE_CONTRACT.invalidEmail },
      ]);
      return;
    }
    const message = caseInvitationEmail({
      recipient: email,
      inviterName: profile?.displayName ?? user?.email ?? "Du",
      companyName: latestCase.companyName ?? "bolaget",
      roleLabel: CASE_ROLE_LABELS[invite.role],
      roleDescription: CASE_ROLE_DESCRIPTIONS[invite.role],
      acceptUrl: "[personlig länk – skapas vid utskicket]",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    setInvite({
      ...invite,
      stage: "confirm",
      email,
      preview: { recipient: message.recipient, subject: message.subject, bodyText: message.bodyText },
    });
    say([
      { who: "user", text: email },
      { who: "radgivare", text: INVITE_CONTRACT.understand(email, CASE_ROLE_LABELS[invite.role]) },
    ]);
  };

  const sendInvite = useMutation({
    mutationFn: () => data.members.invite(latestCase!.id, invite!.email!, invite!.role),
    onSuccess: () => {
      say([{ who: "radgivare", text: INVITE_CONTRACT.verifySuccess(invite!.email!) }]);
      setInvite(null);
      queryClient.invalidateQueries({ queryKey: ["case-invitations", latestCase?.id] });
      queryClient.invalidateQueries({ queryKey: ["case-audit", latestCase?.id] });
    },
    onError: (error) => {
      say([
        {
          who: "radgivare",
          text: INVITE_CONTRACT.verifyFailure(
            error instanceof Error ? error.message : "okänt fel.",
          ),
        },
      ]);
      setInvite(null);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = input;
    setInput("");
    if (invite?.stage === "ask") handleInviteEmail(value);
    else if (currentStep) answerStep(value);
    else handleFreeText(value);
  };

  // Ingången från översikten: frågan följer med i adressen och samtalet
  // börjar direkt - ingen tom sida mellan tanken och svaret.
  useEffect(() => {
    const q = params.get("q");
    if (q && latestCase && !startedFromQuery.current && entries.length === 0) {
      startedFromQuery.current = true;
      handleFreeText(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, latestCase]);

  // Villkoret som ska bevakas. CLEARANCE föreslår det som ÄR sant nu, så
  // användaren bekräftar i stället för att hitta på ett tröskelvärde -
  // men valet är hens, och "bevaka inte" är ett riktigt alternativ som
  // sägs rakt ut i stället för att döljas.
  const watchOptions = useMemo(
    () => (caseSnapshot ? proposeWatches(caseSnapshot.facts) : []),
    [caseSnapshot],
  );
  const [watchChoice, setWatchChoice] = useState<number>(0);

  const recordDecision = useMutation({
    mutationFn: () =>
      data.dialogue.recordDecision({
        caseId: latestCase!.id,
        title: assessment!.decisionSuggestion!.title,
        rationale: `Beslut efter samtal med rådgivaren (${flow?.title.toLowerCase() ?? "samtal"}). ${assessment!.paragraphs[0]}`,
        premise: assessment!.decisionSuggestion!.premise,
        watch: watchOptions[watchChoice] ?? null,
      }),
    onSuccess: () => {
      setDecisionSaved(true);
      queryClient.invalidateQueries({ queryKey: ["case-decisions", latestCase?.id] });
    },
  });

  const [reconsiderFor, setReconsiderFor] = useState<string | null>(null);
  const [reconsiderNote, setReconsiderNote] = useState("");
  const [checkInDone, setCheckInDone] = useState<"stands" | "changed" | null>(null);
  const [invoiceCard, setInvoiceCard] = useState<import("@/data/types").CustomerInvoiceRecord | null>(null);
  // Fakturans PDF öppnas direkt i samtalet - samma dokumentbygge som
  // Inställningar, så samma faktura aldrig kan se olika ut på två ställen.
  const { open: openInline, viewer: reportViewer } = useInlineReport();
  const activeDecision = (decisions ?? []).find((d) => d.status === "active") ?? null;
  const reconsider = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => data.dialogue.reconsiderDecision(id, note),
    onSuccess: () => {
      setReconsiderFor(null);
      setReconsiderNote("");
      queryClient.invalidateQueries({ queryKey: ["case-decisions", latestCase?.id] });
    },
  });

  // Omprövningsbevakningen: de beslut vars villkor inte längre håller.
  // Härledd, aldrig lagrad - en flagga som sparas blir en flagga som
  // ligger kvar efter att läget rättat till sig.
  const flags = useMemo(
    () => (caseSnapshot ? premiseFlags(decisions ?? [], caseSnapshot.facts) : []),
    [decisions, caseSnapshot],
  );
  /** Besluten som redan har en egen fråga längst upp i vyn. */
  const flaggedDecisionIds = useMemo(
    () => new Set(flags.map((f) => f.decisionId)),
    [flags],
  );
  const acknowledge = useMutation({
    mutationFn: ({ id, observation }: { id: string; observation: string }) =>
      data.dialogue.acknowledgePremise(id, observation),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case-decisions", latestCase?.id] });
    },
  });

  const swedishDateTime = useMemo(
    () => (iso: string) =>
      new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" }),
    [],
  );

  return (
    <DashboardShell title="CLEARANCE – din krisrådgivare">
      <div className="mx-auto max-w-4xl">
        {isLoading ? null : !latestCase ? (
          /* Första upplevelsen är ett samtal, inte ett dashboard: CLEARANCE
             frågar en sak i taget och öppnar sedan nulägesanalysen själv. */
          <ClaraIntro
            // Den som redan är inloggad har ett konto: kontostegen hoppas
            // över, resten av introduktionen är densamma.
            hasAccount
            onDone={(name) => {
              if (name) void data.profile.update({ displayName: name, phone: profile?.phone ?? null });
              navigate("/wizard");
            }}
          />
        ) : (
          <>
            {/* "Visa mig": användaren ska aldrig behöva leta efter en
                funktion CLEARANCE känner till. Ligger i samtalet, för
                det är där man frågar. */}
            <div className="mb-4">
              <ShowMeBar />
            </div>

            {/* Omprövningen ligger FÖRE samtalet, inte i en lista längre
                ned: ett beslut som vilar på en premiss som inte längre
                gäller är det viktigaste CLEARANCE vet om ärendet just nu.
                Två dörrar, båda öppna - CLEARANCE omprövar aldrig
                bolagets beslut åt bolaget. */}
            {flags.length > 0 && (
              <section
                aria-labelledby="omprovning-heading"
                className="mb-4 rounded-md border border-warning/50 bg-warning/5 p-5"
              >
                <h2
                  id="omprovning-heading"
                  className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-warning"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Premissen har ändrats
                </h2>
                <ul className="mt-3 space-y-4">
                  {flags.map((flag) => (
                    <li key={flag.decisionId}>
                      <p className="text-sm leading-relaxed text-foreground">{flag.message}</p>
                      {reconsiderFor === flag.decisionId ? (
                        <form
                          className="mt-3 flex flex-col gap-2 sm:flex-row"
                          onSubmit={(e) => {
                            e.preventDefault();
                            reconsider.mutate({ id: flag.decisionId, note: reconsiderNote });
                          }}
                        >
                          <Input
                            value={reconsiderNote}
                            onChange={(e) => setReconsiderNote(e.target.value)}
                            placeholder="Vad har ändrats?"
                            aria-label="Skäl för omprövning"
                          />
                          <Button type="submit" size="sm" variant="accent" disabled={reconsider.isPending}>
                            Ompröva
                          </Button>
                        </form>
                      ) : (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" variant="accent" onClick={() => setReconsiderFor(flag.decisionId)}>
                            Ompröva beslutet
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={acknowledge.isPending}
                            onClick={() =>
                              acknowledge.mutate({
                                id: flag.decisionId,
                                observation: flag.evaluation.observation,
                              })
                            }
                          >
                            Beslutet står fast
                          </Button>
                        </div>
                      )}
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        Står beslutet fast noteras det i journalen. Frågan kommer tillbaka
                        om läget ändras igen – inte däremellan.
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Samtalet */}
            {/* Samtalet fyller ytan: minsta höjd nära hela fönstret och
                inmatningen längst ned - en arbetsyta, inte en widget. */}
            <section aria-label="Samtal med rådgivaren" data-guide="samtalet" className="flex min-h-[calc(100vh-14rem)] flex-col rounded-md border border-border bg-card p-5 shadow-soft">
              {entries.length === 0 && (
                <div>
                  {/* Aldrig "hur kan jag hjälpa dig idag?" - läget först.
                      Sedan sist-raderna kommer ur journalen, inte ur luften. */}
                  {sinceLines.length > 0 && (
                    <div className="mb-4 rounded-md border border-border bg-secondary/30 p-3">
                      <p className="text-sm font-medium text-foreground">
                        Sedan vi pratades vid har följande hänt:
                      </p>
                      <ul className="mt-1.5 space-y-1">
                        {sinceLines.map((line) => (
                          <li key={line} className="flex items-start gap-2 text-sm leading-relaxed text-foreground/90">
                            <span className="mt-0.5 text-success" aria-hidden="true">✓</span>
                            <span className="min-w-0">{line}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-base leading-relaxed text-foreground">
                    {CLARA.greeting(profile?.displayName ?? null)}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Samtalet journalförs i ärendets händelselogg. Bedömningarna är
                    systemets analys av det du anger – underlag för beslut, inte
                    juridisk rådgivning.
                  </p>
                  {/* Lägesbilden: visad, inte påstådd - med analysen som
                      panel i samtalet, inte som ny sida. */}
                  {caseSnapshot && (
                    <div className="mt-5 space-y-5">
                      <div>
                        {/* Rubrikerna bär skillnaden i FÄRG, inte bara i ord:
                            nuläget är dämpat (något att läsa), handlingarna
                            är i accent (något att göra). Två sektioner som
                            ser likadana ut läses som samma sorts sak. */}
                        <div className="flex items-baseline justify-between gap-3">
                          <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                            Läget just nu
                          </h3>
                          <span className="text-xs text-muted-foreground">
                            ur ärendets registrerade uppgifter
                          </span>
                        </div>
                        <div className="mt-2">
                          <SnapshotList rows={caseSnapshot.rows} />
                        </div>
                      </div>

                      {/* Morgonbriefingens kärna: högst tre numrerade steg.
                          Det här är samtalets HANDLINGAR och ska se klickbara
                          ut - accentram, accentsiffra och alltid synlig pil.
                          Nuläget ovanför är medvetet platt; håll kontrasten. */}
                      <div>
                        <div className="flex items-baseline justify-between gap-3">
                          <h3 className="text-[11px] font-bold uppercase tracking-wide text-accent">
                            Det viktigaste nu
                          </h3>
                          <span className="text-xs text-muted-foreground">att göra härnäst</span>
                        </div>
                        <ol className="mt-2 space-y-1.5">
                          {caseSnapshot.priorities.map((item, i) => (
                            <li key={item.label}>
                              <Link
                                to={item.href}
                                className="group flex items-center gap-3 rounded-md border border-accent/40 bg-accent/5 p-2.5 transition-colors hover:bg-accent/10"
                              >
                                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                                  {i + 1}
                                </span>
                                <span className="min-w-0 flex-1 text-sm font-medium text-foreground underline-offset-4 group-hover:underline">
                                  {item.label}
                                </span>
                                <ArrowRight className="h-4 w-4 flex-shrink-0 text-accent" aria-hidden="true" />
                              </Link>
                            </li>
                          ))}
                        </ol>
                      </div>

                      {caseSnapshot.coverageRatio !== null && (
                        <details className="group rounded-md border border-border">
                          <summary className="flex cursor-pointer items-center justify-between gap-3 p-3 [&::-webkit-details-marker]:hidden">
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-foreground">Visa analys</span>
                              <span className="block text-xs text-muted-foreground">
                                Skuldtäckningen som stapel, direkt här i samtalet
                              </span>
                            </span>
                            {/* Chevron, inte ordet "Öppna": panelen fälls ut
                                HÄR i samtalet, och "Öppna" i accentfärg läser
                                som en länk till en annan sida. */}
                            <ChevronDown
                              className="h-4 w-4 flex-shrink-0 text-accent transition-transform group-open:rotate-180"
                              aria-hidden="true"
                            />
                          </summary>
                          <div className="px-3 pb-3">
                            <MeterBar
                              meter={{
                                label: "Skuldtäckning vid snabb avyttring",
                                percent: caseSnapshot.coverageRatio,
                                note:
                                  caseSnapshot.coverageRatio < 100
                                    ? "Under 100 % innebär att skulderna inte täcks fullt ut - vägvalen finns under Handlingsalternativ."
                                    : "Tillgångarna täcker skulderna - fler vägar står öppna.",
                              }}
                            />
                          </div>
                        </details>
                      )}
                      {/* Arbetsmodellen: öppen, med källa per uppgift.
                          Transparens är skillnaden mellan en arbetsmodell
                          och en övervakningsakt. */}
                      {workingModel && (
                        <details className="group rounded-md border border-border">
                          <summary className="flex cursor-pointer items-center justify-between gap-3 p-3 [&::-webkit-details-marker]:hidden">
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-foreground">
                                Vad jag vet om ditt företag
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                Arbetsmodellen jag utgår ifrån – med källa för varje uppgift
                              </span>
                            </span>
                            {/* Chevron, inte ordet "Öppna": panelen fälls ut
                                HÄR i samtalet, och "Öppna" i accentfärg läser
                                som en länk till en annan sida. */}
                            <ChevronDown
                              className="h-4 w-4 flex-shrink-0 text-accent transition-transform group-open:rotate-180"
                              aria-hidden="true"
                            />
                          </summary>
                          <div className="space-y-3 px-3 pb-3">
                            {workingModel.map((section) => (
                              <div key={section.id}>
                                <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                                  {section.title}
                                </h3>
                                <dl className="mt-1 space-y-1">
                                  {section.rows.map((row) => (
                                    <div key={`${row.label}-${row.value}`} className="text-sm leading-relaxed">
                                      <dt className="inline font-medium text-foreground">{row.label}: </dt>
                                      <dd className="inline text-foreground/90">
                                        {row.value}{" "}
                                        <span className="text-xs text-muted-foreground">({row.source})</span>
                                      </dd>
                                    </div>
                                  ))}
                                </dl>
                              </div>
                            ))}
                            <p className="text-xs leading-relaxed text-muted-foreground">
                              Det här är arbetsmodellen jag utgår ifrån. Stämmer
                              något inte längre – säg till, så uppdaterar vi den.
                            </p>
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Minnet: det senaste aktiva beslutet följs upp mot sin
                  premiss. En rådgivare som följer bolaget - ingen chatbot.
                  MEN: har omprövningsbevakningen redan flaggat just det
                  beslutet ställs frågan där, ovanför samtalet, med det
                  konkreta skälet. Två rutor som frågar om samma beslut i
                  samma vy gör båda otydliga - den specifika vinner. */}
              {entries.length === 0 && !checkInDone && activeDecision && !flaggedDecisionIds.has(activeDecision.id) && (
                <div className="mt-4 rounded-md border border-accent/30 bg-accent/5 p-4">
                  <p className="text-sm leading-relaxed text-foreground">
                    {decisionCheckIn(activeDecision)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setCheckInDone("stands")}>
                      Ja, planen står fast
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setCheckInDone("changed");
                        setReconsiderFor(activeDecision.id);
                      }}
                    >
                      Nej, läget har ändrats
                    </Button>
                  </div>
                </div>
              )}
              {checkInDone === "stands" && entries.length === 0 && (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground" role="status">
                  Bra. Då fortsätter vi enligt plan – säg till om något ändras.
                </p>
              )}
              {checkInDone === "changed" && entries.length === 0 && (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground" role="status">
                  Då omprövar vi beslutet. Skriv vad som har ändrats under Fattade
                  beslut nedan, så stämplas omprövningen i journalen.
                </p>
              )}

              {/* Snabbvalen står kvar tills ett flöde faktiskt börjat - även
                  efter fallbacken ska nästa steg vara ett klick bort. */}
              {!flow && !assessment && !invite && (
                <div className={entries.length === 0 ? "mt-5" : "mt-4 border-t border-border pt-4"}>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    Eller välj det som stämmer bäst
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                  {DIALOG_FLOWS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => startFlow(f, f.chip)}
                      className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-accent"
                    >
                      {f.chip}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => openOptions("Vilka alternativ har jag?")}
                    className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-accent"
                  >
                    Vilka alternativ har jag?
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFreeText("Jag behöver min revisor")}
                    className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-accent"
                  >
                    Bjud in min revisor
                  </button>
                  </div>
                </div>
              )}

              <ol className="space-y-3" aria-live="polite">
                {entries.map((entry, i) => (
                  <li key={i} className={entry.who === "user" ? "flex justify-end" : "flex items-start gap-2"}>
                    {entry.who === "radgivare" && (
                      <span
                        className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground"
                        aria-hidden="true"
                      >
                        C
                      </span>
                    )}
                    <p
                      className={`max-w-[85%] whitespace-pre-wrap rounded-md px-3.5 py-2.5 text-sm leading-relaxed ${
                        entry.who === "user"
                          ? "bg-accent text-accent-foreground"
                          : "bg-secondary/60 text-foreground"
                      }`}
                    >
                      {entry.text}
                    </p>
                  </li>
                ))}
              </ol>

              {/* Fakturakortet: det rådgivaren tar fram hamnar också på
                  rätt plats - Inställningar - utan att användaren sorterar. */}
              {invoiceCard && (
                <div className="mt-4 rounded-md border border-border bg-card p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      Faktura {invoiceCard.invoiceNumber}
                    </p>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        invoiceCard.paidAt
                          ? "border-success/40 bg-success/10 text-foreground"
                          : "border-warning/50 bg-warning/10 text-foreground"
                      }`}
                    >
                      {invoiceCard.paidAt ? "Betald" : "Väntar på betalning"}
                    </span>
                  </div>
                  <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Belopp</dt>
                      <dd className="font-medium tabular-nums text-foreground">
                        {(invoiceCard.netOre / 100).toLocaleString("sv-SE")} kr + moms
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Förfallodatum</dt>
                      <dd className="font-medium text-foreground">{invoiceCard.dueAt.slice(0, 10)}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <button
                      type="button"
                      onClick={() =>
                        openInline(
                          buildInvoiceDocument(
                            invoiceFromCustomerRecord(invoiceCard, {
                              name: profile?.displayName || user?.email || "Kund",
                              email: user?.email ?? "",
                            }),
                          ),
                        )
                      }
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-accent underline-offset-4 hover:underline"
                    >
                      <FileText className="h-4 w-4" aria-hidden="true" />
                      Öppna PDF
                    </button>
                    <Link
                      to="/dashboard/installningar"
                      className="text-sm font-medium text-accent underline-offset-4 hover:underline"
                    >
                      Alla fakturor och kvitton
                    </Link>
                  </div>
                </div>
              )}

              {/* Action Contract: kontrollera + bekräfta. Hela mejlet,
                  mottagaren och behörigheten - FÖRE, aldrig efter. */}
              {invite?.stage === "confirm" && invite.preview && (
                <div className="mt-4 space-y-3 rounded-md border border-accent/30 bg-accent/5 p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-accent">
                    Innan något skickas
                  </h3>
                  <ul className="space-y-1">
                    {INVITE_CONTRACT.control(CASE_ROLE_DESCRIPTIONS[invite.role]).map((line) => (
                      <li key={line.slice(0, 32)} className="flex gap-2 text-sm leading-relaxed text-foreground/90">
                        <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-accent" aria-hidden="true" />
                        <span className="min-w-0">{line}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="rounded-md border border-border bg-card p-3">
                    <p className="text-xs text-muted-foreground">Till: {invite.preview.recipient}</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{invite.preview.subject}</p>
                    <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground/90">
                      {invite.preview.bodyText}
                    </pre>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="accent"
                      size="sm"
                      disabled={sendInvite.isPending}
                      onClick={() => sendInvite.mutate()}
                    >
                      {INVITE_CONTRACT.confirmLabel}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setInvite(null);
                        say([{ who: "radgivare", text: INVITE_CONTRACT.cancelReply }]);
                      }}
                    >
                      Avbryt
                    </Button>
                  </div>
                </div>
              )}

              {/* Bedömningen: handlingarna och beslutsförslaget. */}
              {assessment && (
                <div className="mt-4 space-y-3">
                  <span
                    className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${SEVERITY_TONE[assessment.severity]}`}
                  >
                    {assessment.severityLabel}
                  </span>
                  {/* Källmärkningen: vad bedömningen bygger på, synligt. */}
                  <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                    <span
                      className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${
                        assessment.confidence.level === "high"
                          ? "bg-success"
                          : assessment.confidence.level === "medium"
                            ? "bg-warning"
                            : "bg-destructive"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0">{assessment.confidence.note}</span>
                  </p>
                  {/* Rätt medium för budskapet: lägesbild för prioritering,
                      mätare för det som mäts, tidslinje för processen. */}
                  {assessment.snapshot && <SnapshotList rows={assessment.snapshot} />}
                  {assessment.meter && <MeterBar meter={assessment.meter} />}
                  {assessment.plan && (
                    <div className="rounded-md border border-border p-3">
                      <PlanTimeline rows={assessment.plan} />
                    </div>
                  )}
                  {assessment.paragraphs.length > 2 && (
                    <details className="rounded-md border border-border p-3">
                      <summary className="cursor-pointer list-none text-sm font-medium text-accent underline-offset-4 hover:underline">
                        Visa hela motiveringen
                      </summary>
                      <div className="mt-2 space-y-2">
                        {assessment.paragraphs.slice(1, -1).map((p) => (
                          <p key={p.slice(0, 40)} className="text-sm leading-relaxed text-foreground/90">
                            {p}
                          </p>
                        ))}
                      </div>
                    </details>
                  )}
                  <ul className="space-y-1.5">
                    {assessment.actions.map((action) => (
                      <li key={action.label}>
                        <Link
                          to={action.href}
                          className="group flex items-start gap-3 rounded-md border border-border p-2.5 transition-colors hover:border-accent"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-foreground">{action.label}</span>
                            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{action.why}</span>
                          </span>
                          <ArrowRight className="mt-1 h-4 w-4 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {assessment.decisionSuggestion && !decisionSaved && (
                    <div className="rounded-md border border-accent/30 bg-accent/5 p-4">
                      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
                        <Gavel className="h-3.5 w-3.5" aria-hidden="true" />
                        Protokollför beslutet
                      </h3>
                      <p className="mt-2 text-sm font-medium text-foreground">{assessment.decisionSuggestion.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{assessment.decisionSuggestion.premise}</p>
                      {watchOptions.length > 0 && (
                        /* Villkoret gör premissen bevakningsbar. Förslagen
                           är de som ÄR sanna nu, så det som ska bekräftas
                           är verkligheten - inte en gissad tröskel. */
                        <div className="mt-3">
                          <label
                            htmlFor="premiss-villkor"
                            className="block text-xs font-medium text-foreground"
                          >
                            Bevaka premissen mot
                          </label>
                          <select
                            id="premiss-villkor"
                            value={watchChoice}
                            onChange={(e) => setWatchChoice(Number(e.target.value))}
                            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
                          >
                            {watchOptions.map((option, i) => (
                              <option key={`${option.signal}-${option.comparator}`} value={i}>
                                {describeWatch(option)}
                              </option>
                            ))}
                            <option value={-1}>{NO_WATCH_LABEL}</option>
                          </select>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {watchOptions[watchChoice]
                              ? "Stämmer i dag. CLEARANCE hör av sig när det inte längre gör det."
                              : "Beslutet sparas med sin premiss, men ingen bevakning kopplas till den."}
                          </p>
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant="accent"
                        className="mt-3"
                        disabled={recordDecision.isPending}
                        onClick={() => recordDecision.mutate()}
                      >
                        Protokollför med premiss
                      </Button>
                    </div>
                  )}
                  {decisionSaved && assessment.decisionSuggestion && (
                    /* Dokumentkortet: det som skapades, direkt i samtalet. */
                    <div className="flex items-center gap-3 rounded-md border border-success/40 bg-success/5 p-3" role="status">
                      <FileCheck2 className="h-5 w-5 flex-shrink-0 text-success" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground">
                          Protokollfört beslut: {assessment.decisionSuggestion.title}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          Sparat med premiss – omprövas under Fattade beslut när läget ändras
                        </span>
                      </span>
                      <Link
                        to="/dashboard/handelser"
                        className="flex-shrink-0 text-sm font-medium text-accent underline-offset-4 hover:underline"
                      >
                        Visa journalen
                      </Link>
                    </div>
                  )}
                  {/* Sessionsavslutet: kvittot på vad som gjordes, och
                      löftet att nästa samtal börjar där detta slutade. */}
                  <button
                    type="button"
                    onClick={() => {
                      const done = [`✓ gått igenom: ${flow?.title.toLowerCase() ?? "läget"}`];
                      if (decisionSaved) done.push("✓ protokollfört beslutet med dess premiss");
                      say([
                        {
                          who: "radgivare",
                          // Avslutet berömde tidigare användaren. En
                          // bekräftelse ska säga vad arbetet gav, inte
                          // att någon var duktig - se tests/tone.ts.
                          text: `Det här är vad vi har gjort:\n${done.join("\n")}\nAllt är journalfört, så nästa gång börjar vi där vi slutade i stället för om.`,
                        },
                      ]);
                      setFlow(null);
                      setAssessment(null);
                      setStepIndex(0);
                      setDecisionSaved(false);
                    }}
                    className="text-sm font-medium text-accent underline-offset-4 hover:underline"
                  >
                    Avsluta samtalet
                  </button>
                </div>
              )}

              {/* Inmatningen: ja/nej som knappar, annars fritt fält. */}
              {!assessment && currentStep?.kind === "yesno" ? (
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" onClick={() => answerStep("ja")}>Ja</Button>
                  <Button variant="outline" onClick={() => answerStep("nej")}>Nej</Button>
                </div>
              ) : !assessment && currentStep?.kind === "choice" ? (
                /* Svarskortet: välja, inte skriva. */
                <div className="mt-4 flex flex-wrap gap-2">
                  {(currentStep.options ?? []).map((option) => (
                    <Button key={option} variant="outline" onClick={() => answerStep(option)}>
                      {option}
                    </Button>
                  ))}
                </div>
              ) : !assessment && invite?.stage !== "confirm" ? (
                <form onSubmit={submit} className="mt-auto flex gap-2 pt-4">
                  <label htmlFor="samtal-input" className="sr-only">
                    {invite?.stage === "ask"
                      ? "Rådgivarens e-postadress"
                      : currentStep
                        ? currentStep.prompt
                        : "Beskriv vad som har hänt"}
                  </label>
                  <Input
                    id="samtal-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      invite?.stage === "ask"
                        ? "namn@byran.se"
                        : currentStep?.hint ?? "Beskriv vad som har hänt …"
                    }
                    inputMode={currentStep?.kind === "amount" ? "numeric" : "text"}
                    autoComplete="off"
                    className="h-12 text-base"
                  />
                  <Button type="submit" variant="accent" size="lg" disabled={!input.trim()} aria-label="Skicka">
                    <Send className="h-5 w-5" aria-hidden="true" />
                  </Button>
                </form>
              ) : null}
              {/* Dataminimering vid fritext (GDPR art. 9): en känslig
                  krissituation drar åt sig personuppgifter fältet inte
                  behöver. Påminnelsen står där texten skrivs. */}
              {!assessment && invite?.stage !== "confirm" && currentStep?.kind !== "amount" && (
                <DataMinimeringHint className="mt-2" />
              )}
              <div ref={bottomRef} />
            </section>

            {/* Beslutsminnet */}
            {(decisions ?? []).length > 0 && (
              <section aria-labelledby="beslut-heading" className="mt-6">
                <h2 id="beslut-heading" className="flex items-center gap-2 font-semibold text-foreground">
                  <Compass className="h-5 w-5 text-accent" aria-hidden="true" />
                  Fattade beslut
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Varje beslut står kvar med sin premiss. När verkligheten ändras
                  omprövas beslutet – det gamla skrivs aldrig över.
                </p>
                <ul className="mt-3 space-y-2">
                  {(decisions ?? []).map((d) => (
                    <li key={d.id} className="rounded-md border border-border bg-card p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <p className="font-medium text-foreground">{d.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {swedishDateTime(d.decidedAt)}
                          {d.status === "reconsidered" && d.reconsideredAt
                            ? ` · omprövat ${swedishDateTime(d.reconsideredAt)}`
                            : ""}
                        </p>
                      </div>
                      {d.premise && (
                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{d.premise}</p>
                      )}
                      {/* Bevakningens läge, per beslut. Tre lägen, aldrig
                          fyra: "går inte att avgöra" är ett eget svar och
                          döljs inte bakom "villkoret håller". */}
                      {d.status === "active" && caseSnapshot && (() => {
                        if (!d.watch) {
                          return (
                            <p className="mt-1.5 text-xs text-muted-foreground">{NO_WATCH_LABEL}</p>
                          );
                        }
                        const evaluation = evaluatePremise(d.watch, caseSnapshot.facts);
                        const tone =
                          evaluation.state === "contradicted"
                            ? "text-warning"
                            : evaluation.state === "holds"
                              ? "text-success"
                              : "text-muted-foreground";
                        return (
                          <p className={`mt-1.5 text-xs ${tone}`}>
                            {describeWatch(d.watch)} · {WATCH_STATE_LABEL[evaluation.state]}
                            <span className="text-muted-foreground"> ({evaluation.observation.toLowerCase()})</span>
                          </p>
                        );
                      })()}
                      {d.status === "reconsidered" ? (
                        <p className="mt-2 rounded-md bg-secondary/40 p-2.5 text-xs leading-relaxed text-muted-foreground">
                          Omprövat{d.reconsiderNote ? `: ${d.reconsiderNote}` : "."}
                        </p>
                      ) : reconsiderFor === d.id ? (
                        <form
                          className="mt-2 flex flex-col gap-2 sm:flex-row"
                          onSubmit={(e) => {
                            e.preventDefault();
                            reconsider.mutate({ id: d.id, note: reconsiderNote });
                          }}
                        >
                          <Input
                            value={reconsiderNote}
                            onChange={(e) => setReconsiderNote(e.target.value)}
                            placeholder="Vad har ändrats?"
                            aria-label="Skäl för omprövning"
                          />
                          <Button type="submit" size="sm" variant="outline" disabled={reconsider.isPending}>
                            Ompröva
                          </Button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setReconsiderFor(d.id)}
                          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-accent underline-offset-4 hover:underline"
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                          Ompröva beslutet
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
      {reportViewer}
    </DashboardShell>
  );
};

export default DashboardSamtal;
