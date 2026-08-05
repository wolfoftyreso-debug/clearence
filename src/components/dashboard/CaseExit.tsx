import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import {
  Activity,
  ArchiveX,
  CalendarClock,
  CheckCircle2,
  HeartPulse,
  RotateCcw,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { data } from "@/data";
import type { CaseExitReason, CaseRecord } from "@/data/types";

/**
 * Krisfasens slut - och det som händer efter.
 *
 * Detta är North Star-mätningen i produkten: utan registrerad exitorsak går
 * det inte att skilja ett bolag som stabiliserats från ett som tyst gett
 * upp. Avslutet är därför ett aktivt företrädarbeslut med orsak, aldrig ett
 * konto som bara slutar användas. Lyckade utfall kan fortsätta i
 * hälsoläget: bevakning och årshjul i stället för krisstyrning, med en
 * snabb väg tillbaka om läget försämras. Ingenting raderas - akten består.
 */

export const EXIT_REASONS: {
  value: CaseExitReason;
  label: string;
  description: string;
  successful: boolean;
}[] = [
  {
    value: "stabilized",
    label: "Stabiliserat",
    description: "Bolaget är ur den akuta krisen och betalar i tid igen.",
    successful: true,
  },
  {
    value: "reconstruction_completed",
    label: "Rekonstruktion genomförd",
    description: "Rekonstruktionen är fastställd och avslutad.",
    successful: true,
  },
  {
    value: "bankruptcy",
    label: "Konkurs",
    description: "Bolaget har försatts i konkurs.",
    successful: false,
  },
  {
    value: "liquidated",
    label: "Likviderat",
    description: "Bolaget har avvecklats under ordnade former.",
    successful: false,
  },
  {
    value: "other",
    label: "Annan orsak",
    description: "Något annat - beskriv gärna kort i anteckningen.",
    successful: false,
  },
];

export const exitReasonLabel = (reason: CaseExitReason | null): string =>
  EXIT_REASONS.find((r) => r.value === reason)?.label ?? "Okänd orsak";

const swedishDate = (iso: string) =>
  format(new Date(iso), "d MMMM yyyy", { locale: sv });

/** Ogiltigförklarar allt som visar ärendets läge. */
const useRefreshCase = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries();
};

/**
 * "Avsluta ärendet" - längst ner i översikten, hopfälld tills den behövs.
 * Avslutet ska finnas där när det är dags, inte pocka på uppmärksamhet
 * mitt i en pågående kris.
 */
export const CaseExitSection = ({ caseRecord }: { caseRecord: CaseRecord }) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<CaseExitReason | null>(null);
  const [note, setNote] = useState("");
  const [enterHealth, setEnterHealth] = useState(true);
  const refresh = useRefreshCase();

  const successful = reason
    ? EXIT_REASONS.find((r) => r.value === reason)?.successful ?? false
    : false;

  const close = useMutation({
    mutationFn: () =>
      data.cases.close({
        caseId: caseRecord.id,
        reason: reason!,
        note: note.trim() || undefined,
        enterHealth: successful ? enterHealth : false,
      }),
    onSuccess: refresh,
  });

  if (!open) {
    return (
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Avsluta ärendet …
        </button>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="case-exit-heading"
      data-guide="avsluta-arendet"
      className="mt-6 rounded-md border border-border bg-card p-5 shadow-soft"
    >
      <h2 id="case-exit-heading" className="font-semibold text-foreground">
        Avsluta ärendet
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Krisfasen stämplas med sitt utfall. Ingenting raderas – akten,
        dokumenten och händelseloggen finns kvar, och ärendet kan återupptas
        om läget förändras.
      </p>

      <fieldset className="mt-4">
        <legend className="sr-only">Utfall</legend>
        <div className="space-y-2">
          {EXIT_REASONS.map((r) => (
            <label
              key={r.value}
              className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                reason === r.value
                  ? "border-accent bg-accent/5"
                  : "border-border hover:border-accent/50"
              }`}
            >
              <input
                type="radio"
                name="exit-reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                className="mt-1 accent-[hsl(var(--accent))]"
              />
              <span>
                <span className="block text-sm font-medium text-foreground">{r.label}</span>
                <span className="block text-xs text-muted-foreground">{r.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {successful && (
        <label className="mt-4 flex items-start gap-3 rounded-md border border-success/40 bg-success/5 p-3">
          <input
            type="checkbox"
            checked={enterHealth}
            onChange={(e) => setEnterHealth(e.target.checked)}
            className="mt-1 accent-[hsl(var(--success))]"
          />
          <span>
            <span className="block text-sm font-medium text-foreground">
              Fortsätt i hälsoläget
            </span>
            <span className="block text-xs text-muted-foreground">
              Bevakning och årshjul i stället för krisstyrning – och en snabb
              väg tillbaka om läget försämras.
            </span>
          </span>
        </label>
      )}

      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Anteckning (valfritt) – t.ex. vad som avgjorde utfallet"
        aria-label="Anteckning om avslutet"
        className="mt-4"
        rows={2}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          variant="accent"
          disabled={!reason || close.isPending}
          onClick={() => close.mutate()}
        >
          {successful && enterHealth ? "Avsluta krisfasen och gå till hälsoläget" : "Avsluta ärendet"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Avbryt
        </Button>
      </div>
      {close.isError && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          Ärendet kunde inte avslutas. Försök igen.
        </p>
      )}
    </section>
  );
};

/**
 * Ett helt avslutat ärende: banderollen säger vad som hände och när, och
 * vägen tillbaka är ett klick. Akten under består - frysning, aldrig
 * radering.
 */
export const ClosedCaseBanner = ({ caseRecord }: { caseRecord: CaseRecord }) => {
  const refresh = useRefreshCase();
  const reopen = useMutation({
    mutationFn: () => data.cases.reopen(caseRecord.id),
    onSuccess: refresh,
  });
  const meta = EXIT_REASONS.find((r) => r.value === caseRecord.exitReason);

  return (
    <div
      className={`mb-6 rounded-md border p-5 ${
        meta?.successful ? "border-success/40 bg-success/5" : "border-border bg-card"
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-foreground/10">
          {meta?.successful ? (
            <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
          ) : (
            <ArchiveX className="h-5 w-5 text-foreground" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-foreground">
            Ärendet avslutades{" "}
            {caseRecord.closedAt ? swedishDate(caseRecord.closedAt) : ""} –{" "}
            {exitReasonLabel(caseRecord.exitReason)}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Akten, dokumenten och händelseloggen finns kvar och kan exporteras
            när som helst. Förändras läget kan ärendet återupptas – allt är
            kvar där det var.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={reopen.isPending}
              onClick={() => reopen.mutate()}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Återuppta ärendet
            </Button>
          </div>
          {reopen.isError && (
            <p className="mt-2 text-sm text-destructive" role="alert">
              Ärendet kunde inte återupptas. Försök igen.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

/** Årshjulet: de återkommande punkter som håller ett friskt bolag friskt. */
const YEAR_WHEEL: { label: string; timing: string }[] = [
  { label: "Likviditetskoll", timing: "Varje månad" },
  { label: "Omprövning av kontrollbalansfrågan", timing: "Varje kvartal" },
  { label: "Bokslut och årsredovisning", timing: "Efter räkenskapsårets slut" },
  { label: "Årsstämma", timing: "Inom sex månader från räkenskapsårets slut" },
];

/**
 * Hälsoläget: den lugna vyn för ett bolag som klarat krisen. Samma ärende,
 * samma akt - men bevakning och årshjul i stället för frister och larm.
 * Detta är G6 i produktform: plattformen är som mest värdefull när kunden
 * mår bra, inte när den blöder.
 */
export const HealthDashboard = ({ caseRecord }: { caseRecord: CaseRecord }) => {
  const refresh = useRefreshCase();
  const [confirmFullClose, setConfirmFullClose] = useState(false);

  const reopen = useMutation({
    mutationFn: () => data.cases.reopen(caseRecord.id),
    onSuccess: refresh,
  });
  // Helt avslut från hälsoläget: krisfasens orsak behålls, men ärendet
  // lämnar bevakningen. Datamodellen kräver öppet ärende för close_case,
  // så vägen är återuppta-och-avsluta i en följd.
  const closeFully = useMutation({
    mutationFn: async () => {
      await data.cases.reopen(caseRecord.id);
      await data.cases.close({
        caseId: caseRecord.id,
        reason: caseRecord.exitReason ?? "stabilized",
        enterHealth: false,
      });
    },
    onSuccess: refresh,
  });

  const { data: kbr } = useQuery({
    queryKey: ["kbr-latest", caseRecord.id],
    queryFn: () => data.kbr.getLatestByCase(caseRecord.id),
  });

  const kbrLabel: Record<string, string> = {
    not_required: "Ingen kontrollbalansräkning krävs",
    warning: "Bevakas – nära gränsen",
    required: "Kontrollbalansräkning krävs",
    critical: "Kritiskt läge",
  };

  return (
    <div>
      <div className="mb-6 rounded-md border border-success/40 bg-success/5 p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-success/15">
            <HeartPulse className="h-5 w-5 text-success" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">
              {caseRecord.companyName ?? caseRecord.orgNumber} är i hälsoläget
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Krisfasen avslutades
              {caseRecord.closedAt ? ` ${swedishDate(caseRecord.closedAt)}` : ""} –{" "}
              {exitReasonLabel(caseRecord.exitReason).toLowerCase()}. Nu handlar
              det om att hålla läget: bevakning, årshjul och en snabb väg
              tillbaka om något förändras.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section
          aria-labelledby="health-watch-heading"
          className="rounded-md border border-border bg-card shadow-soft"
        >
          <div className="border-b border-border p-5">
            <h2 id="health-watch-heading" className="flex items-center gap-2 font-semibold text-foreground">
              <ShieldCheck className="h-5 w-5 text-accent" aria-hidden="true" />
              Bevakning
            </h2>
          </div>
          <ul className="divide-y divide-border">
            <li className="flex items-start gap-3 p-4">
              <Activity className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-foreground">Kreditbevakning</p>
                <p className="text-xs text-muted-foreground">
                  Bolagets kreditbild följs löpande. Försämras den får du veta det direkt.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3 p-4">
              <Scale className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-foreground">Kontrollbalansfrågan</p>
                <p className="text-xs text-muted-foreground">
                  {kbr
                    ? `Senaste bedömningen ${swedishDate(kbr.createdAt)}: ${
                        kbrLabel[kbr.status] ?? kbr.status
                      }.`
                    : "Ingen bedömning gjord ännu."}{" "}
                  <Link to="/kbr" className="text-accent underline-offset-4 hover:underline">
                    Gör en ny bedömning
                  </Link>
                </p>
              </div>
            </li>
          </ul>
        </section>

        <section
          aria-labelledby="year-wheel-heading"
          className="rounded-md border border-border bg-card shadow-soft"
        >
          <div className="border-b border-border p-5">
            <h2 id="year-wheel-heading" className="flex items-center gap-2 font-semibold text-foreground">
              <CalendarClock className="h-5 w-5 text-accent" aria-hidden="true" />
              Årshjul
            </h2>
          </div>
          <ul className="divide-y divide-border">
            {YEAR_WHEEL.map((item) => (
              <li key={item.label} className="flex items-center justify-between gap-4 p-4">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="whitespace-nowrap text-xs text-muted-foreground">{item.timing}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-6 rounded-md border border-border bg-card p-5 shadow-soft">
        <h2 className="font-semibold text-foreground">Om läget förändras</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Krisläget kan återupptas med ett klick – hela akten, handlingsplanen
          och fristbevakningen är kvar där de var. Vill du i stället lämna
          bevakningen avslutas ärendet helt; ingenting raderas då heller.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            disabled={reopen.isPending}
            onClick={() => reopen.mutate()}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Tillbaka till krisläget
          </Button>
          {confirmFullClose ? (
            <Button
              variant="destructive"
              disabled={closeFully.isPending}
              onClick={() => closeFully.mutate()}
            >
              Bekräfta: avsluta helt
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmFullClose(true)}>
              Avsluta ärendet helt …
            </Button>
          )}
        </div>
        {(reopen.isError || closeFully.isError) && (
          <p className="mt-2 text-sm text-destructive" role="alert">
            Åtgärden kunde inte genomföras. Försök igen.
          </p>
        )}
      </div>
    </div>
  );
};
