import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { ProUpgradeOffer } from "@/components/pricing/ProUpgradeOffer";
import { markProOfferSeen, proOfferSeen } from "@/lib/proOffer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { data } from "@/data";
import { ONBOARDING } from "@/lib/advisor/dialog";
import { saveOnboarding } from "@/lib/advisor/onboardingHandoff";
import {
  clearResume,
  readResume,
  resumeAnswerCount,
  saveResume,
  type ResumableStage,
} from "@/lib/advisor/onboardingResume";
import { formatOrgNumber, lookupCompany, validateOrgNumber } from "@/lib/orgNumber";
import { WAITS, waitText } from "@/lib/advisor/prepare";
import { TransitionNotice } from "@/components/advisor/TransitionNotice";
import { BackgroundPanel } from "@/components/advisor/BackgroundPanel";
import { FirstAnalysisCard } from "@/components/advisor/FirstAnalysisCard";
import {
  applyAnswer,
  deriveRiskLevel,
  emptyProfile,
  profileFilled,
  profileRows,
  type CompanyProfile,
} from "@/lib/advisor/companyProfile";
import { interviewProgress, nextQuestion } from "@/lib/advisor/interview";
import { buildFirstAnalysis } from "@/lib/advisor/firstAnalysis";
import { DataMinimeringHint } from "@/components/privacy/DataMinimeringHint";
import type { CompanyInfo } from "@/data/types";
import { Check, ChevronDown } from "lucide-react";

/**
 * Det första mötet med Clearance ÄR samtalet - men ett samtal som
 * börjar arbeta, inte ett som pratar färdigt först.
 *
 * Ordningen är: välkomst med tidsangivelse, konto, och sedan arbete.
 * Kontot ligger tidigt av ett skäl som inte är produktens utan
 * användarens: allt som lämnas efter den punkten är sparat. Ett samtal
 * som samlar tjugo svar och sedan ber om ett konto riskerar att kasta
 * bort dem, och den som just berättat om sitt bolags problem ska inte
 * behöva göra det två gånger.
 *
 * Direkt efter kontot startar bakgrundsarbetet OCH intervjun, samtidigt.
 * Det är hela poängen: när sista frågan är besvarad finns redan en
 * analys att visa, i stället för en spinner.
 *
 * Grunduppgifterna visas SAMTIDIGT - fyra fält i ett svep - medan
 * intervjufrågorna kommer en i taget. Skillnaden är avsiktlig: namn och
 * organisationsnummer kan man fylla i från minnet, "vad är den största
 * utmaningen just nu" kräver eftertanke.
 *
 * Lösenordet har ett eget steg och ett maskerat fält. Det ekas aldrig
 * tillbaka i samtalet.
 *
 * Premiumfunktionerna kommer SIST, efter att analysen visats. Ingen
 * fråga om telefonnummer ställs dessförinnan - se ONBOARDING.premium.
 *
 * Komponenten bor här för att den används på två ställen: startsidan
 * (före inloggning) och samtalsvyn för en inloggad användare utan
 * ärende. Den som redan har konto får inte kontostegen - `hasAccount`.
 *
 * Samtalet ÖVERLEVER en siduppdatering från och med kontosteget - se
 * onboardingResume. Femton frågor i en telefon är för mycket arbete för
 * att en skärmlåsning ska få kasta bort det.
 */

interface ChatEntry {
  who: "user" | "radgivare";
  text: string;
  /** Processöversikten är en lista, inte en mening - eget uttryck. */
  kind?: "text" | "steps" | "confirm";
}

type Stage =
  | "valkommen"
  | "form"
  | "losenord"
  | "situation"
  | "intervju"
  | "analys"
  | "done";

/** Registerraderna som faktiskt kom tillbaka. Tomma fält visas inte. */
const registryRows = (info: CompanyInfo): { label: string; value: string }[] => {
  const rows: { label: string; value: string }[] = [
    { label: "Företagsnamn", value: info.name },
  ];
  if (info.legalForm) rows.push({ label: "Bolagsform", value: info.legalForm });
  if (info.registrationYear) rows.push({ label: "Registreringsår", value: info.registrationYear });
  if (info.boardMembers?.length) {
    rows.push({ label: "Styrelseledamöter", value: info.boardMembers.join(", ") });
  }
  if (info.fTax !== undefined) {
    rows.push({ label: "F-skatt", value: info.fTax ? "Godkänd" : "Ej godkänd" });
  }
  if (info.vatRegistered !== undefined) {
    rows.push({ label: "Momsregistrering", value: info.vatRegistered ? "Registrerad" : "Ej registrerad" });
  }
  if (info.status) rows.push({ label: "Status", value: info.status });
  return rows;
};

export const ClaraIntro = ({
  onDone,
  onStart,
  hasAccount = false,
}: {
  onDone: (name: string | null) => void;
  /**
   * Sägs till när samtalet startar. Kontot skapas mitt i flödet, och
   * den som visar komponenten behöver veta att inloggningen inte får
   * byta ut vyn under fötterna på användaren.
   */
  onStart?: () => void;
  /** Den som redan är inloggad ska inte skapa ett konto till. */
  hasAccount?: boolean;
}) => {
  // Läses EN gång, vid mount. Finns ingen post är allt som förut.
  const [resumed] = useState(() => readResume());

  const [entries, setEntries] = useState<ChatEntry[]>(() => resumed?.entries ?? []);
  const [stage, setStage] = useState<Stage>(() => resumed?.stage ?? "valkommen");
  const [name, setName] = useState(() => resumed?.name ?? "");
  const [company, setCompany] = useState(() => resumed?.company ?? "");
  const [orgNumber, setOrgNumber] = useState(() => resumed?.orgNumber ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountError, setAccountError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [lookupStatus, setLookupStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);

  const [situationId, setSituationId] = useState<string | null>(() => resumed?.situationId ?? null);
  const [answers, setAnswers] = useState<Record<string, string>>(() => resumed?.answers ?? {});
  const [profile, setProfile] = useState<CompanyProfile>(() => resumed?.profile ?? emptyProfile());
  const [signals, setSignals] = useState<{
    concentration: "låg" | "medel" | "hög" | null;
    trend: "upp" | "stabil" | "ner" | "kraftigt ner" | null;
  }>(() => resumed?.signals ?? { concentration: null, trend: null });
  /** Notisen om att samtalet återupptogs. Går att stänga - den har gjort sitt. */
  const [resumeNoticeOpen, setResumeNoticeOpen] = useState(resumed !== null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [smsChoice, setSmsChoice] = useState<"none" | "yes" | "no">("none");
  const [proOfferOpen, setProOfferOpen] = useState(false);
  const navigate = useNavigate();

  /**
   * "Ja, visa hur" på SMS-kortet. Förut bar den rakt in i inställningarna.
   * Nu tar den vägen förbi engångserbjudandet - en enda gång. Har det redan
   * visats går vi direkt vidare; ingen ska mötas av samma "sista chans" två
   * gånger (det vore den falska brådska produkten inte ägnar sig åt).
   */
  const SMS_SETTINGS = "/dashboard/installningar";
  const handleSmsYes = () => {
    setSmsChoice("yes");
    if (proOfferSeen()) {
      navigate(SMS_SETTINGS);
      return;
    }
    markProOfferSeen();
    setProOfferOpen(true);
  };
  const leaveOffer = () => {
    setProOfferOpen(false);
    navigate(SMS_SETTINGS);
  };

  const bottomRef = useRef<HTMLDivElement | null>(null);
  // Namnet räknas som "vårt" så länge användaren inte själv har skrivit i
  // fältet: då får uppslaget skriva över det. Har hen skrivit något eget
  // rör vi det aldrig - registret vinner inte över en människa.
  const companyTouched = useRef(false);
  const lookupRequest = useRef(0);
  const handoffTimer = useRef<number | null>(null);

  // Lämnar användaren sidan mitt i pausen ska timern dö med komponenten.
  useEffect(
    () => () => {
      if (handoffTimer.current !== null) window.clearTimeout(handoffTimer.current);
    },
    [],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [entries.length]);

  /**
   * Ett återupptaget samtal är ett pågående samtal. Utan det här hade
   * startsidan bytt ut vyn under fötterna på användaren i samma ögonblick
   * som inloggningen laddats klart - allt hen just sett, borta igen.
   */
  useEffect(() => {
    if (resumed) onStart?.();
    // Körs en gång, vid mount, och bara om det fanns något att återuppta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Samtalet skrivs ned efter varje ändring, från kontosteget och framåt.
   *
   * Inget debounce: till skillnad från guidernas textfält ändras det här
   * tillståndet bara när användaren klickar, alltså några gånger per
   * minut. Att vänta 400 ms hade bara skapat ett fönster där ett svar
   * gick förlorat.
   */
  useEffect(() => {
    const resumable: Stage[] = ["situation", "intervju", "analys"];
    if (!resumable.includes(stage)) return;
    saveResume({
      stage: stage as ResumableStage,
      entries,
      name,
      company,
      orgNumber,
      situationId,
      answers,
      profile,
      signals,
      savedAt: new Date().toISOString(),
    });
  }, [stage, entries, name, company, orgNumber, situationId, answers, profile, signals]);

  // Uppslaget mot företagsregistret. Effekten beror ENBART på numret;
  // allt annat den behöver ligger i refs eller i uppdateringsfunktioner.
  // Samma fälla som i guiden: ett beroende som byter identitet vid varje
  // rendering blir en oändlig slagning som ingen ser.
  useEffect(() => {
    const digits = orgNumber.replace(/\D/g, "");
    if (digits.length !== 10 || !validateOrgNumber(orgNumber)) {
      lookupRequest.current += 1;
      setLookupStatus("idle");
      setCompanyInfo(null);
      return;
    }
    const requestId = ++lookupRequest.current;
    setLookupStatus("loading");
    void lookupCompany(orgNumber).then((info) => {
      if (lookupRequest.current !== requestId) return;
      if (!info) {
        setLookupStatus("error");
        setEntries((prev) =>
          prev.some((e) => e.text === ONBOARDING.lookupMiss)
            ? prev
            : [...prev, { who: "radgivare", text: ONBOARDING.lookupMiss }],
        );
        return;
      }
      setCompanyInfo(info);
      setLookupStatus("success");
      if (!companyTouched.current) setCompany(info.name);
      setEntries((prev) =>
        prev.some((e) => e.text === ONBOARDING.lookupDone)
          ? prev
          : [...prev, { who: "radgivare", text: ONBOARDING.lookupDone }],
      );
    });
  }, [orgNumber]);

  const orgNumberInvalid =
    orgNumber.replace(/\D/g, "").length === 10 && !validateOrgNumber(orgNumber);
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canContinue =
    name.trim().length > 0 &&
    company.trim().length > 0 &&
    !orgNumberInvalid &&
    (hasAccount || emailLooksValid);

  const say = (...texts: string[]) =>
    setEntries((prev) => [...prev, ...texts.map((text) => ({ who: "radgivare" as const, text }))]);

  /* --- steg 1: välkomsten -------------------------------------------------- */
  const startConversation = () => {
    setEntries(ONBOARDING.intro.map((text) => ({ who: "radgivare" as const, text })));
    setStage("form");
    onStart?.();
  };

  /* --- steg 2: grunduppgifterna, sedan lösenordet -------------------------- */
  const submitDetails = (e: FormEvent) => {
    e.preventDefault();
    if (!canContinue) return;
    const summary = [name.trim(), company.trim(), orgNumber.trim(), hasAccount ? "" : email.trim()]
      .filter(Boolean)
      .join(" · ");
    setEntries((prev) => [
      ...prev,
      { who: "user", text: summary },
      { who: "radgivare", text: ONBOARDING.confirm(name, company, orgNumber) },
    ]);
    if (hasAccount) {
      afterAccount();
      return;
    }
    say(ONBOARDING.password.lead);
    setStage("losenord");
  };

  /** Kvitteringen och starten på arbetet. Samma väg oavsett om ett konto skapades. */
  const afterAccount = () => {
    setEntries((prev) => [
      ...prev,
      { who: "radgivare", text: "", kind: "steps" },
      ...ONBOARDING.afterAccount.map((text) => ({ who: "radgivare" as const, text })),
      { who: "radgivare", text: ONBOARDING.askSituation },
    ]);
    setStage("situation");
  };

  const createAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8 || creating) return;
    setCreating(true);
    setAccountError(null);
    const result = await data.auth.signUp(email.trim(), password);
    setCreating(false);
    if (result.error) {
      setAccountError(result.error);
      return;
    }
    // Namnet är det användaren skrev, inte det som går att gissa ur
    // adressen. Att spara det direkt gör att nästa vy kan hälsa rätt.
    void data.profile.update({ displayName: name.trim(), phone: null }).catch(() => {
      // Profilen är en förbättring, inte ett villkor för att fortsätta.
    });
    // Lösenordet lämnar tillståndet i samma andetag som det använts.
    setPassword("");
    setEntries((prev) => [
      ...prev,
      { who: "radgivare", text: ONBOARDING.password.created, kind: "confirm" },
    ]);
    afterAccount();
  };

  /* --- steg 3: nuläget i korthet ------------------------------------------- */
  const chooseSituation = (id: string, label: string) => {
    setSituationId(id);
    setEntries((prev) => [
      ...prev,
      { who: "user", text: label },
      { who: "radgivare", text: ONBOARDING.interviewLead.body },
    ]);
    setProfile((p) =>
      applyAnswer(p, {
        riskLevel: deriveRiskLevel({ situationId: id, concentration: null, trend: null }),
      }),
    );
    setStage("intervju");
  };

  /* --- steg 4: intervjun ---------------------------------------------------- */
  const question = useMemo(
    () => (stage === "intervju" ? nextQuestion(profile, situationId, answers) : null),
    [stage, profile, situationId, answers],
  );
  const progress = useMemo(
    () => interviewProgress(profile, situationId, answers),
    [profile, situationId, answers],
  );

  // Intervjun är slut när ingen fråga återstår. Analysen byggs då och
  // visas - inget extra klick emellan, användaren har redan sagt ja
  // genom att svara på sista frågan.
  useEffect(() => {
    if (stage !== "intervju" || question !== null) return;
    const filled = profileFilled(profile);
    // Överhoppade frågor räknas inte som svar. "Tolv svar" när fyra av
    // dem var överhoppningar är en överdrift om hur mycket vi vet.
    const given = Object.values(answers).filter((v) => v !== "").length;
    say(ONBOARDING.interviewDone(given, filled));
    setStage("analys");
    saveOnboarding({
      name: name.trim(),
      company: company.trim(),
      orgNumber: orgNumber.trim(),
      situation: situationId ?? "",
      answers,
      profile: { ...profile },
    });
    // Vi vill köra exakt när frågorna tar slut. Att lyssna på hela
    // profilen här hade kört om varje gång ett fält ändrades.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, question]);

  const answerQuestion = (label: string) => {
    if (!question) return;
    const option = question.options.find((o) => o.label === label);
    const nextAnswers = { ...answers, [question.id]: label };
    const nextSignals = {
      concentration: option?.signal?.concentration ?? signals.concentration,
      trend: option?.signal?.trend ?? signals.trend,
    };
    setEntries((prev) => [...prev, { who: "user", text: label }]);
    setSignals(nextSignals);
    setAnswers(nextAnswers);
    setProfile((p) =>
      applyAnswer(applyAnswer(p, option?.fills ?? {}), {
        riskLevel: deriveRiskLevel({
          situationId,
          concentration: nextSignals.concentration,
          trend: nextSignals.trend,
        }),
      }),
    );
  };

  /** Att hoppa över en fråga är ett svar: "inget svar" fyller inget fält. */
  const skipQuestion = () => {
    if (!question) return;
    setAnswers((prev) => ({ ...prev, [question.id]: "" }));
  };

  const analysis = useMemo(
    () =>
      buildFirstAnalysis({
        companyName: company.trim() || "bolaget",
        profile,
        // Överhoppade frågor ska inte citeras som svar i analysen.
        answers: Object.fromEntries(Object.entries(answers).filter(([, v]) => v !== "")),
        situationId,
        registryHit: lookupStatus === "success",
      }),
    [company, profile, answers, situationId, lookupStatus],
  );

  /* --- steg 5: vidare ------------------------------------------------------- */
  const finish = () => {
    say(...ONBOARDING.closing);
    // Samtalet är överlämnat till nulägesanalysen. Nästa besök ska börja
    // rent i stället för att erbjuda en återupptagning av något som är
    // klart - det hade varit ett erbjudande som pekar bakåt.
    clearResume();
    setStage("done");
    handoffTimer.current = window.setTimeout(() => onDone(name.trim() || null), 5200);
  };

  /** Hoppa över resten av pausen. Städar timern så vi inte navigerar två gånger. */
  const goNow = () => {
    if (handoffTimer.current !== null) window.clearTimeout(handoffTimer.current);
    handoffTimer.current = null;
    clearResume();
    onDone(name.trim() || null);
  };

  /**
   * Börja om.
   *
   * Den som återupptas ska kunna säga nej. Utan den här knappen vore
   * återupptagningen en låsning: ett gammalt halvfärdigt samtal som inte
   * går att komma ur annat än genom att svara sig igenom det.
   *
   * Namnet, bolaget och organisationsnumret står kvar. De är uppgifter om
   * kontot, inte svar i intervjun, och de går att ändra i formuläret som
   * välkomsten leder till. Att tvinga fram dem en gång till hade varit
   * friktion utan syfte.
   */
  const startOver = () => {
    clearResume();
    setEntries([]);
    setStage("valkommen");
    setSituationId(null);
    setAnswers({});
    setProfile(emptyProfile());
    setSignals({ concentration: null, trend: null });
    setResumeNoticeOpen(false);
  };

  const currentStep =
    stage === "form" || stage === "losenord" ? 1 : stage === "situation" ? 2 : stage === "intervju" ? 3 : 4;

  return (
    <section
      aria-label="Samtal med CLEARANCE"
      className="flex min-h-[24rem] flex-col rounded-md border border-border bg-card p-5 shadow-soft"
    >
      {stage === "valkommen" ? (
        /* Välkomsten: två meningar, en tidsangivelse och en knapp. Allt
           annat på den här skärmen hade varit i vägen. */
        <div className="my-auto text-center">
          <h2 className="text-xl font-semibold text-foreground">{ONBOARDING.welcome.title}</h2>
          {ONBOARDING.welcome.body.map((line) => (
            <p key={line} className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              {line}
            </p>
          ))}
          <Button variant="accent" size="lg" onClick={startConversation} className="mt-5">
            {ONBOARDING.welcome.cta}
          </Button>
        </div>
      ) : (
        <>
          {resumed && resumeNoticeOpen && (
            /* Samma besked som guiderna ger efter en siduppdatering, av
               samma skäl: den som kommer tillbaka ska se ATT arbetet finns
               kvar och HUR MYCKET, inte behöva gissa av samtalet ovanför.
               Överhoppade frågor räknas inte - siffran ska tåla att
               kontrolleras mot analysen. */
            <div className="mb-4 rounded-md border border-border bg-secondary/60 p-3.5">
              <p className="text-sm leading-relaxed text-foreground">
                Vi har sparat samtalet, lokalt i din webbläsare.{" "}
                {resumeAnswerCount(resumed) > 0
                  ? `Dina ${resumeAnswerCount(resumed)} svar finns kvar och du fortsätter där du var.`
                  : "Du fortsätter där du var."}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                <button
                  type="button"
                  onClick={() => setResumeNoticeOpen(false)}
                  className="text-sm font-medium text-accent underline underline-offset-2"
                >
                  Fortsätt
                </button>
                <button
                  type="button"
                  onClick={startOver}
                  className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Börja om från början
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
                {entry.kind === "steps" ? (
                  /* Processen i fast ordning: den som ser hela vägen vet att
                     den tar slut, och vet var hen är just nu. */
                  <div className="max-w-[85%] rounded-md bg-secondary/60 px-3.5 py-3">
                    <p className="text-sm font-medium text-foreground">Så här går vi vidare</p>
                    <ol className="mt-2 space-y-1.5">
                      {ONBOARDING.steps.map((step) => {
                        const done = step.n < currentStep;
                        return (
                          <li key={step.n} className="flex items-start gap-2 text-sm leading-relaxed">
                            <span
                              className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                                done ? "bg-success text-success-foreground" : "bg-card text-muted-foreground"
                              }`}
                              aria-hidden="true"
                            >
                              {done ? <Check className="h-3 w-3" /> : step.n}
                            </span>
                            <span className={done ? "text-muted-foreground" : "text-foreground"}>
                              {step.label}
                              {done ? " – klart" : ""}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                ) : entry.kind === "confirm" ? (
                  /* Kvitteringen är inte ett yttrande utan ett kvitto -
                     och ska se ut som ett. */
                  <p className="flex max-w-[85%] items-center gap-2 rounded-md bg-success/10 px-3.5 py-2.5 text-sm font-medium leading-relaxed text-foreground">
                    <Check className="h-4 w-4 flex-shrink-0 text-success" aria-hidden="true" />
                    {entry.text}
                  </p>
                ) : (
                  <p
                    className={`max-w-[85%] whitespace-pre-wrap rounded-md px-3.5 py-2.5 text-sm leading-relaxed ${
                      entry.who === "user" ? "bg-accent text-accent-foreground" : "bg-secondary/60 text-foreground"
                    }`}
                  >
                    {entry.text}
                  </p>
                )}
              </li>
            ))}
          </ol>

          {stage === "situation" && (
            <div className="mt-4 flex flex-col items-start gap-2">
              {ONBOARDING.situations.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => chooseSituation(s.id, s.label)}
                  className="rounded-full border border-border bg-card px-3.5 py-1.5 text-left text-sm font-medium text-foreground transition-colors hover:border-accent"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {(stage === "intervju" || stage === "analys") && (
            /* Bakgrundsarbetet löper medan frågorna ställs - det är hela
               poängen med att starta det här och inte efteråt. */
            <div className="mt-4">
              <BackgroundPanel
                ctx={{
                  companyName: company.trim() || "Bolaget",
                  orgNumber: orgNumber.trim() || "utan nummer",
                  registryHit: lookupStatus === "success",
                  answered: Object.keys(answers).filter((k) => answers[k] !== "").length,
                  profileFields: profileFilled(profile),
                }}
              />
            </div>
          )}

          {stage === "intervju" && question && (
            <div className="mt-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {ONBOARDING.interviewLead.heading} · fråga {progress.current} av {progress.total}
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">{question.text}</p>
              {/* Ingen ny fråga utan en kort introduktion om ämnet. */}
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{question.why}</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {question.options.map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    onClick={() => answerQuestion(o.label)}
                    className="rounded-full border border-border bg-card px-3.5 py-1.5 text-left text-sm font-medium text-foreground transition-colors hover:border-accent"
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={skipQuestion}
                className="mt-2 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                {ONBOARDING.interviewLead.skipLabel}
              </button>
            </div>
          )}

          {(stage === "intervju" || stage === "analys") && profileFilled(profile) > 0 && (
            /* Profilen behöver inte visas, men den ska gå att öppna. Ett
               system som bygger en bild av någons bolag och håller den
               dold ber om ett förtroende det inte förtjänat. */
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                aria-expanded={profileOpen}
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${profileOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
                Det här har jag förstått hittills ({profileFilled(profile)} av 9)
              </button>
              {profileOpen && (
                <dl className="mt-2 rounded-md border border-border p-3">
                  {profileRows(profile).map((row) => (
                    <div key={row.label} className="flex flex-wrap justify-between gap-x-3 py-0.5 text-xs">
                      <dt className="text-muted-foreground">{row.label}</dt>
                      <dd className={row.value === "okänd" ? "text-muted-foreground" : "font-medium text-foreground"}>
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}

          {stage === "analys" && (
            <div className="mt-4 space-y-4">
              {/* Kortet visar analysen, inte en egen "gå vidare"-knapp:
                  nästa steg är en enda knapp längst ned. Två knappar mot
                  samma vy, med SMS-erbjudandet inklämt emellan, blev dubbla
                  budskap. */}
              <FirstAnalysisCard analysis={analysis} showNextStep={false} />

              {/* PREMIUM SIST. Först nu har användaren sett vad tjänsten
                  gör - och först nu är ett telefonnummer en uppgradering
                  i stället för en insamling. */}
              <section aria-label="SMS-aviseringar" className="rounded-md border border-border p-4">
                <p className="text-sm font-semibold text-foreground">{ONBOARDING.premium.heading}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{ONBOARDING.premium.lead}</p>
                <ul className="mt-2 space-y-0.5">
                  {ONBOARDING.premium.examples.map((x) => (
                    <li key={x} className="text-sm text-foreground">
                      • {x}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">{ONBOARDING.premium.tiers}</p>
                {smsChoice === "none" ? (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-foreground">{ONBOARDING.premium.question}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button variant="accent" size="sm" onClick={handleSmsYes}>
                        {ONBOARDING.premium.yes}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setSmsChoice("no")}>
                        {ONBOARDING.premium.no}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">{ONBOARDING.premium.declined}</p>
                )}
              </section>

              {/* Det enda nästa steget - med sin förklaring intill, den som
                  förut bodde inne i analyskortet. En knapp, ett budskap. */}
              <div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {analysis.nextStep.why}
                </p>
                <Button variant="accent" size="lg" onClick={finish} className="mt-2.5 w-full sm:w-auto">
                  Gå vidare till nulägesanalysen
                </Button>
              </div>
            </div>
          )}

          {stage === "done" && (
            /* Övergången till nulägesanalysen. Vyn byts av sig själv efter
               ett par sekunder, och ett vybyte som användaren inte bad om är
               precis det tillfälle då förberedelsen behövs mest. */
            <div className="mt-4">
              <TransitionNotice id="onboarding-till-nulage" />
              <Button variant="accent" onClick={goNow} className="mt-3">
                Öppna nulägesanalysen
              </Button>
            </div>
          )}

          {stage === "form" && (
            /* Fyra fält på en gång. Att stycka dem i fyra turer hade lagt
               till friktion utan att lägga till förståelse. */
            <form onSubmit={submitDetails} className="mt-auto space-y-3 pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Etiketterna kommer ur ONBOARDING.fields, inte ur JSX:
                    testet som räknar fälten vaktar då den text användaren
                    faktiskt ser. */}
                <div>
                  <label htmlFor="onboarding-name" className="mb-1 block text-sm font-medium text-foreground">
                    {ONBOARDING.fields[0].label}
                  </label>
                  <Input
                    id="onboarding-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={ONBOARDING.fields[0].placeholder}
                    autoComplete={ONBOARDING.fields[0].autoComplete}
                    className="h-12 text-base"
                  />
                </div>
                <div>
                  <label htmlFor="onboarding-company" className="mb-1 block text-sm font-medium text-foreground">
                    {ONBOARDING.fields[1].label}
                  </label>
                  <Input
                    id="onboarding-company"
                    value={company}
                    onChange={(e) => {
                      companyTouched.current = true;
                      setCompany(e.target.value);
                    }}
                    placeholder={ONBOARDING.fields[1].placeholder}
                    autoComplete={ONBOARDING.fields[1].autoComplete}
                    className="h-12 text-base"
                  />
                </div>
                <div>
                  <label htmlFor="onboarding-org" className="mb-1 block text-sm font-medium text-foreground">
                    {ONBOARDING.fields[2].label}
                  </label>
                  <Input
                    id="onboarding-org"
                    value={orgNumber}
                    onChange={(e) => setOrgNumber(formatOrgNumber(e.target.value))}
                    placeholder={ONBOARDING.fields[2].placeholder}
                    inputMode="numeric"
                    maxLength={11}
                    autoComplete={ONBOARDING.fields[2].autoComplete}
                    aria-invalid={orgNumberInvalid}
                    aria-describedby={orgNumberInvalid ? "onboarding-org-fel" : undefined}
                    className="h-12 text-base"
                  />
                </div>
                {!hasAccount && (
                  <div>
                    <label htmlFor="onboarding-email" className="mb-1 block text-sm font-medium text-foreground">
                      {ONBOARDING.fields[3].label}
                    </label>
                    <Input
                      id="onboarding-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={ONBOARDING.fields[3].placeholder}
                      autoComplete={ONBOARDING.fields[3].autoComplete}
                      className="h-12 text-base"
                    />
                  </div>
                )}
              </div>

              {orgNumberInvalid && (
                <p id="onboarding-org-fel" className="text-sm text-destructive">
                  Kontrollsiffran stämmer inte. Kontrollera numret – eller lämna fältet tomt så tar vi det senare.
                </p>
              )}
              {lookupStatus === "loading" && !orgNumberInvalid && (
                <p className="text-sm text-muted-foreground">{waitText(WAITS.companyLookup)}</p>
              )}

              {companyInfo && lookupStatus === "success" && (
                /* Vad registret svarade, ord för ord. Bara fälten som faktiskt
                   kom tillbaka - ett registerfält som gissas är värre än ett
                   som saknas, eftersom användaren litar på det. */
                <div className="rounded-md border border-border bg-secondary/30 p-3 text-sm">
                  <p className="mb-2 text-sm font-medium text-foreground">Hämtat från företagsregistret</p>
                  <dl>
                    {registryRows(companyInfo).map((row) => (
                      <div key={row.label} className="flex flex-wrap gap-x-2 py-0.5">
                        <dt className="text-muted-foreground">{row.label}:</dt>
                        <dd className="font-medium text-foreground">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {/* Dataminimering redan i onboardingen: fälten ber om företag
                  och kontakt, inte om känsliga privatuppgifter. */}
              <DataMinimeringHint />

              <Button type="submit" variant="accent" size="lg" disabled={!canContinue} className="w-full sm:w-auto">
                {ONBOARDING.submitLabel}
              </Button>
            </form>
          )}

          {stage === "losenord" && (
            /* Maskerat fält, eget steg. Ett lösenord som skrivs i en
               chattruta syns för alla som står bakom, och blir kvar i
               samtalet. */
            <form onSubmit={createAccount} className="mt-auto space-y-3 pt-4">
              <div>
                <label htmlFor="onboarding-password" className="mb-1 block text-sm font-medium text-foreground">
                  {ONBOARDING.password.label}
                </label>
                <Input
                  id="onboarding-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={ONBOARDING.password.placeholder}
                  autoComplete="new-password"
                  className="h-12 max-w-sm text-base"
                />
                <p className="mt-1 text-xs text-muted-foreground">{ONBOARDING.password.hint}</p>
              </div>
              {accountError && (
                <p className="text-sm text-destructive" role="alert">
                  {accountError}
                </p>
              )}
              <Button
                type="submit"
                variant="accent"
                size="lg"
                disabled={password.length < 8 || creating}
                className="w-full sm:w-auto"
              >
                {creating ? "Skapar kontot…" : ONBOARDING.password.submitLabel}
              </Button>
            </form>
          )}
        </>
      )}
      <div ref={bottomRef} />

      {/* Engångserbjudandet: visas en gång, med en nedräkning som tar slut
          på riktigt. Accept och avböj landar båda i inställningarna - det
          var dit "Ja, visa hur" var på väg. */}
      <ProUpgradeOffer open={proOfferOpen} onAccept={leaveOffer} onDismiss={leaveOffer} />
    </section>
  );
};
