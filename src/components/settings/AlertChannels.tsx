import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { WizardCard, WizardCardHeader } from "@/components/wizard/WizardCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IS_DEMO, data } from "@/data";
import {
  CHANNELS,
  LEVELS,
  DEFAULT_QUIET_HOURS,
  planGateReason,
  channelInPlan,
  type Channel,
  type Level,
} from "@/lib/notifications/events";
import { VERIFICATION_CODE_LENGTH, isVerificationCode } from "@/lib/notifications/phone";
import { AVISERINGAR_HAR_PRODUCENT, AVISERINGAR_INTE_LIVE } from "@/lib/notifications/status";
import { Lock, MessageSquare, ShieldCheck } from "lucide-react";
import { DEMO_VERIFICATION_CODE } from "@/data/demo/adapter";
import type { NotificationPrefsRecord } from "@/data/types";

/**
 * Aviseringskanalerna.
 *
 * Tre beslut syns i formen och är värda att förklara, för de kommer att
 * ifrågasättas:
 *
 * 1. NIVÅN ÄR ETT VAL AV TRE, inte sju kryssrutor per händelsetyp. Den
 *    som är mitt i en kris orkar inte konfigurera, och en sida ingen
 *    orkar fylla i blir kvar på förvalet. Tre val går att fatta på tio
 *    sekunder.
 *
 * 2. TYST TID BRYTS AV DET TIDSKRITISKA, och det STÅR framme. Att tyst
 *    göra undantag hade varit att bryta ett löfte; att inte göra
 *    undantag hade varit att låta någon sova genom det vi finns till för
 *    att förhindra.
 *
 * 3. DEN LÅSTA KANALEN VISAS, låst, med skälet utskrivet. En funktion
 *    som bara försvinner för den som inte betalat lär ingen något om
 *    vad den missar.
 */

const DEFAULT_PREFS: NotificationPrefsRecord = {
  level: "atgard",
  emailEnabled: true,
  smsEnabled: false,
  quietStartHour: DEFAULT_QUIET_HOURS.startHour,
  quietEndHour: DEFAULT_QUIET_HOURS.endHour,
};

export const AlertChannelSection = () => {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<NotificationPrefsRecord>(DEFAULT_PREFS);
  const [error, setError] = useState<string | null>(null);

  const { data: stored } = useQuery({
    queryKey: ["notification-prefs"],
    queryFn: () => data.notificationSettings.getPrefs(),
  });
  const { data: billing } = useQuery({
    queryKey: ["account-billing"],
    queryFn: () => data.billing.getMine(),
  });
  const plan = billing?.planId ?? "standard";

  useEffect(() => {
    if (stored) setDraft(stored);
  }, [stored]);

  const save = useMutation({
    mutationFn: (next: NotificationPrefsRecord) => data.notificationSettings.savePrefs(next),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notification-prefs"] }),
    onError: (e: Error) => setError(e.message),
  });

  const update = (patch: Partial<NotificationPrefsRecord>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    setError(null);
    save.mutate(next);
  };

  return (
    <WizardCard data-guide="aviseringskanaler">
      <WizardCardHeader
        title="Aviseringar"
        description="Här väljer du vad som ska nå dig när du inte är inloggad, och hur mycket."
      />

      {/*
        ATT SÄGA DET HÖGT. Tjänsten är byggd hel utom ett led: ingenting
        skapar händelser än. Att låta någon välja kanaler, verifiera sitt
        nummer och betala för SMS utan att säga det vore att sälja en
        tystnad. Raden försvinner av sig själv den dag flaggan stämmer -
        provet i tests/aviseringar.ts läser koden, inte den här filen.
      */}
      {!AVISERINGAR_HAR_PRODUCENT ? (
        <p
          data-aviseringar-inte-live
          className="mb-4 rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground"
        >
          {AVISERINGAR_INTE_LIVE}
          {IS_DEMO ? " I demon visas exempel på hur de kommer att se ut." : ""}
        </p>
      ) : null}

      {/* Nivån */}
      <fieldset className="space-y-1.5">
        <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Hur mycket vill du bli störd
        </legend>
        {LEVELS.map((level) => (
          <label
            key={level.id}
            className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 transition-colors hover:border-accent/50"
          >
            <input
              type="radio"
              name="notification-level"
              checked={draft.level === level.id}
              onChange={() => update({ level: level.id as Level })}
              className="mt-0.5 h-4 w-4 accent-accent"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">{level.label}</span>
              <span className="block text-xs leading-relaxed text-muted-foreground">
                {level.description}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      {/* Kanalerna */}
      <fieldset className="mt-5 space-y-1.5">
        <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Var de ska nå dig
        </legend>
        {/*
          KLOCKAN VISAS, ALLTID PÅ. Den låg förut bara i kortets ingress
          ("Klockan i appen visar alltid allt"), och den meningen var
          dubbelt olycklig: den påstod dels att klockan visar något - vilket
          den inte gör förrän någon skapar händelser - dels bar den ensam
          löftet om att klockan aldrig är en betald kanal. Löftet står kvar,
          nu som en rad byggd av CHANNELS i stället för en handskriven
          mening, och med samma synlighet som den låsta kanalen får.
        */}
        {CHANNELS.filter((c) => c.id === "inapp").map((channel) => (
          <div
            key={channel.id}
            data-kanal="inapp"
            className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3"
          >
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">
                {channel.label} – ingår alltid
              </span>
              <span className="block text-xs leading-relaxed text-muted-foreground">
                {channel.description} Aldrig en betald kanal, oavsett prisnivå.
              </span>
            </span>
          </div>
        ))}
        {CHANNELS.filter((c) => c.id !== "inapp").map((channel) => {
          const locked = planGateReason(channel.id, plan);
          const checked =
            channel.id === "email" ? draft.emailEnabled : channel.id === "sms" ? draft.smsEnabled : false;
          return (
            <label
              key={channel.id}
              className={`flex items-start gap-3 rounded-md border border-border p-3 transition-colors ${
                locked ? "cursor-default opacity-70" : "cursor-pointer hover:border-accent/50"
              }`}
            >
              <input
                type="checkbox"
                disabled={!!locked}
                checked={checked && !locked}
                onChange={(e) =>
                  update(
                    channel.id === "email"
                      ? { emailEnabled: e.target.checked }
                      : { smsEnabled: e.target.checked },
                  )
                }
                className="mt-0.5 h-4 w-4 accent-accent"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  {channel.label}
                  {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
                </span>
                <span className="block text-xs leading-relaxed text-muted-foreground">
                  {locked ?? channel.description}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {/* Tyst tid */}
      <fieldset className="mt-5">
        <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Tyst tid
        </legend>
        <div className="flex flex-wrap items-center gap-2 text-sm text-foreground">
          <span>Inga utskick mellan</span>
          <HourSelect
            value={draft.quietStartHour}
            onChange={(h) => update({ quietStartHour: h })}
            label="Tyst tid börjar"
          />
          <span>och</span>
          <HourSelect
            value={draft.quietEndHour}
            onChange={(h) => update({ quietEndHour: h })}
            label="Tyst tid slutar"
          />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Ett besked som kommer under tyst tid skjuts upp till morgonen - det slängs inte.
          <span className="font-medium text-foreground">
            {" "}
            Undantag: en tidsfrist som håller på att löpa ut går fram ändå.
          </span>{" "}
          Fristen bryr sig inte om klockan, och det är det enda vi väcker någon för.
        </p>
      </fieldset>

      {channelInPlan("sms", plan) && draft.smsEnabled && <PhoneVerification />}

      {error && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </WizardCard>
  );
};

const HourSelect = ({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (hour: number) => void;
  label: string;
}) => (
  <select
    aria-label={label}
    value={value}
    onChange={(e) => onChange(Number(e.target.value))}
    className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
  >
    {Array.from({ length: 24 }, (_, h) => (
      <option key={h} value={h}>
        {String(h).padStart(2, "0")}:00
      </option>
    ))}
  </select>
);

/**
 * Numret, och beviset att det är ditt.
 *
 * Verifieringen följer förberedelseregeln (docs/design-system.md): innan
 * numret skrivs in står det VARFÖR vi frågar och vad som kommer att
 * hända - ett SMS med en kod, inom några sekunder. Ett fält som bara
 * dyker upp och begär ett mobilnummer är precis den sortens fråga som
 * känns godtycklig i en produkt man är rädd för.
 */
const PhoneVerification = () => {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: current } = useQuery({
    queryKey: ["verified-phone"],
    queryFn: () => data.notificationSettings.getPhone(),
  });

  const start = useMutation({
    mutationFn: () => data.notificationSettings.startPhoneVerification(phone),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["verified-phone"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const confirm = useMutation({
    mutationFn: () => data.notificationSettings.confirmPhoneVerification(code),
    onSuccess: (ok) => {
      if (!ok) {
        setError("Koden stämmer inte, eller har gått ut. Begär en ny.");
        return;
      }
      setError(null);
      setCode("");
      queryClient.invalidateQueries({ queryKey: ["verified-phone"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: () => data.notificationSettings.removePhone(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["verified-phone"] }),
  });

  if (current?.verified) {
    return (
      <div className="mt-5 rounded-md bg-secondary/50 p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />
          SMS går till {current.masked}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          Numret visas förkortat med flit. Vill du byta tar du bort det och lägger in ett nytt.
        </p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => remove.mutate()}>
          Ta bort numret
        </Button>
      </div>
    );
  }

  const awaiting = current?.awaitingCode ?? false;

  return (
    <div className="mt-5 rounded-md bg-secondary/50 p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <MessageSquare className="h-4 w-4" aria-hidden="true" />
        {awaiting ? "Skriv in koden" : "Vilket nummer ska SMS:en gå till"}
      </p>

      {/* Förberedelsen: varför vi frågar, vad som händer, hur lång tid. */}
      <dl className="mt-2 space-y-1.5 text-xs leading-relaxed">
        <div>
          <dt className="inline font-semibold text-foreground">Därför frågar vi: </dt>
          <dd className="inline text-foreground/75">
            {awaiting
              ? "Koden bevisar att numret är ditt. Utan det steget skulle ett feltryck skicka besked om ditt ärende till en främling."
              : "Ett SMS kan inte gå någonstans utan ett nummer, och numret måste bevisas innan vi använder det."}
          </dd>
        </div>
        <div>
          <dt className="inline font-semibold text-foreground">Nu händer detta: </dt>
          <dd className="inline text-foreground/75">
            {awaiting
              ? `Du skriver in de ${VERIFICATION_CODE_LENGTH} siffrorna, och kanalen slås på.`
              : "Vi skickar ett SMS med en kod. Ingenting annat skickas förrän koden är inskriven."}
          </dd>
        </div>
        <div>
          <dt className="inline font-semibold text-foreground">Så lång tid tar det: </dt>
          <dd className="inline text-foreground/75">Ett par minuter, och två fält.</dd>
        </div>
      </dl>

      {/* Demon har ingen telefon att skicka till. Koden står därför
          utskriven - en verifiering ingen kan klara vore en vägg mitt i
          det flöde demon finns för att visa. */}
      {IS_DEMO && awaiting && (
        <p className="mt-2 rounded-md bg-background/60 p-2 text-xs text-muted-foreground">
          Demoläge: inget SMS skickas. Koden är{" "}
          <span className="font-mono font-semibold text-foreground">{DEMO_VERIFICATION_CODE}</span>.
        </p>
      )}

      {awaiting ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            maxLength={VERIFICATION_CODE_LENGTH}
            placeholder="000000"
            aria-label="Verifieringskod"
            className="w-32 font-mono"
          />
          <Button
            variant="accent"
            disabled={!isVerificationCode(code) || confirm.isPending}
            onClick={() => confirm.mutate()}
          >
            Bekräfta
          </Button>
          <Button variant="outline" onClick={() => remove.mutate()}>
            Avbryt
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="070-123 45 67"
            aria-label="Mobilnummer"
            className="w-48"
          />
          <Button
            variant="accent"
            disabled={phone.trim().length < 6 || start.isPending}
            onClick={() => start.mutate()}
          >
            Skicka kod
          </Button>
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

/**
 * Kvittona. Svaret på "varför fick jag inget SMS", utan att någon
 * behöver fråga oss.
 */
export const AlertHistorySection = () => {
  const { data: rows } = useQuery({
    queryKey: ["notification-deliveries"],
    queryFn: () => data.notificationSettings.listRecentDeliveries(20),
  });

  if (!rows || rows.length === 0) return null;

  const label: Record<Channel, string> = {
    inapp: "I appen",
    email: "E-post",
    sms: "SMS",
    push: "Push",
  };

  return (
    <WizardCard>
      <WizardCardHeader
        title="Senaste aviseringarna"
        description="Vad som gick ut, på vilken kanal - och skälet när något inte gick ut."
      />
      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li key={row.id} className="rounded-md border border-border p-3">
            <p className="text-sm font-medium text-foreground">{row.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {label[row.channel]} ·{" "}
              {row.status === "sent"
                ? "skickad"
                : row.status === "pending"
                  ? "i kö"
                  : row.status === "suppressed"
                    ? "inte skickad"
                    : "misslyckad"}
              {row.reason ? ` · ${row.reason}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </WizardCard>
  );
};
