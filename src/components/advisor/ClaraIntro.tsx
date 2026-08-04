import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ONBOARDING } from "@/lib/advisor/dialog";
import { saveOnboarding } from "@/lib/advisor/onboardingHandoff";
import { formatOrgNumber, lookupCompany, validateOrgNumber } from "@/lib/orgNumber";
import { WAITS, waitText } from "@/lib/advisor/prepare";
import { TransitionNotice } from "@/components/advisor/TransitionNotice";
import type { CompanyInfo } from "@/data/types";
import { Check } from "lucide-react";

/**
 * Det första mötet med Clearance ÄR samtalet - men ett samtal som
 * börjar arbeta, inte ett som pratar färdigt först.
 *
 * Den tidigare versionen frågade en sak i taget: namn, sedan företag,
 * sedan situation. Tre turer för uppgifter en företagare kan lämna i
 * ett svep. Det lät omtänksamt och kändes långsamt - och långsamt är
 * dyrt för den som är här för att hen har bråttom. Grunduppgifterna
 * visas därför SAMTIDIGT, och en fråga i taget börjar gälla först när
 * frågorna kräver eftertanke.
 *
 * Organisationsnumret gör mer än att registreras: det slår mot
 * företagsregistret och fyller i det som går att hämta, så att samtalet
 * kan handla om situationen i stället för om stavningen av bolagsnamnet.
 *
 * Komponenten bor här för att den används på två ställen: startsidan
 * (före inloggning - därför krävs inget konto för att prata) och
 * samtalsvyn för en inloggad användare utan ärende. Samma CLEARANCE,
 * samma ord, oavsett dörr.
 */

interface ChatEntry {
  who: "user" | "radgivare";
  text: string;
  /** Processöversikten är en lista, inte en mening - eget uttryck. */
  kind?: "text" | "steps";
}

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

export const ClaraIntro = ({ onDone }: { onDone: (name: string | null) => void }) => {
  const [entries, setEntries] = useState<ChatEntry[]>(
    ONBOARDING.intro.map((text) => ({ who: "radgivare" as const, text })),
  );
  const [stage, setStage] = useState<"form" | "situation" | "done">("form");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [orgNumber, setOrgNumber] = useState("");
  const [lookupStatus, setLookupStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
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
  const canContinue = name.trim().length > 0 && company.trim().length > 0 && !orgNumberInvalid;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canContinue) return;
    const summary = [name.trim(), company.trim(), orgNumber.trim()].filter(Boolean).join(" · ");
    setEntries((prev) => [
      ...prev,
      { who: "user", text: summary },
      { who: "radgivare", text: ONBOARDING.confirm(name, company, orgNumber) },
      { who: "radgivare", text: "", kind: "steps" },
      { who: "radgivare", text: ONBOARDING.askSituation },
    ]);
    setStage("situation");
  };

  const chooseSituation = (label: string) => {
    setEntries((prev) => [
      ...prev,
      { who: "user", text: label },
      ...ONBOARDING.closing.map((text) => ({ who: "radgivare" as const, text })),
    ]);
    setStage("done");
    // Grunduppgifterna följer med till nulägesanalysen. Att fråga om dem
    // igen vore att lära användaren att samtalet inte får konsekvenser.
    saveOnboarding({
      name: name.trim(),
      company: company.trim(),
      orgNumber: orgNumber.trim(),
      situation: label,
    });
    // CLEARANCE navigerar - efter en paus lång nog att hinna läsa både
    // avslutet och förberedelsen. Pausen växte när övergångsrutan kom
    // in: en förklaring som hinner försvinna innan den är läst är ingen
    // förberedelse. Den som redan läst behöver inte vänta ut den -
    // knappen nedan tar en vidare direkt.
    handoffTimer.current = window.setTimeout(() => onDone(name.trim() || null), 5200);
  };

  /** Hoppa över resten av pausen. Städar timern så vi inte navigerar två gånger. */
  const goNow = () => {
    if (handoffTimer.current !== null) window.clearTimeout(handoffTimer.current);
    handoffTimer.current = null;
    onDone(name.trim() || null);
  };

  return (
    <section
      aria-label="Samtal med CLEARANCE"
      className="flex min-h-[24rem] flex-col rounded-md border border-border bg-card p-5 shadow-soft"
    >
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
                    const done = step.n === 1;
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
              onClick={() => chooseSituation(s.label)}
              className="rounded-full border border-border bg-card px-3.5 py-1.5 text-left text-sm font-medium text-foreground transition-colors hover:border-accent"
            >
              {s.label}
            </button>
          ))}
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
        /* Tre fält på en gång. Att stycka dem i tre turer hade lagt till
           friktion utan att lägga till förståelse. */
        <form onSubmit={submit} className="mt-auto space-y-3 pt-4">
          <div className="grid gap-3 sm:grid-cols-3">
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

          <Button type="submit" variant="accent" size="lg" disabled={!canContinue} className="w-full sm:w-auto">
            {ONBOARDING.submitLabel}
          </Button>
        </form>
      )}
      <div ref={bottomRef} />
    </section>
  );
};
