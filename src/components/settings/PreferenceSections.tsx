import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WizardCard, WizardCardHeader } from "@/components/wizard/WizardCard";
import { data } from "@/data";
import { useAuth } from "@/hooks/useAuth";
import {
  getCompactScope,
  getPresentationMode,
  PRESENTATION_MODES,
  setCompactScope,
  setPresentationMode,
  type PresentationMode,
} from "@/lib/presentation";
import {
  getNotificationPrefs,
  OPTIONAL_CATEGORIES,
  setNotificationPref,
} from "@/lib/notifications";
import { forgetRead } from "@/lib/notificationsRead";
import { CheckCircle2, Download, Loader2, LogOut } from "lucide-react";

/**
 * Inställningarna utöver språkprofilen: visning, aktivt ärende, notiser
 * och kontosäkerhet.
 *
 * Två principer styr vad som ÄR en inställning här:
 *
 *  1. BARA VERKLIGA VAL. Varje reglage styr något som faktiskt händer -
 *     inga toggles för funktioner som inte finns. Val som sparas lokalt
 *     (visning, notiser) märks "på den här enheten" så ingen tror att
 *     mobilen ärver datorns val.
 *
 *  2. DET JURIDISKT KRITISKA GÅR INTE ATT STÄNGA AV. Notisvalen kan tysta
 *     samarbete och drift, aldrig frister och läge - en klocka som kan
 *     tystas om det som ger personligt ansvar vore ett brutet löfte.
 */

export const PresentationSection = () => {
  const [mode, setMode] = useState<PresentationMode>(getPresentationMode);
  const [compact, setCompact] = useState<boolean>(getCompactScope);

  return (
    <WizardCard>
      <WizardCardHeader
        title="Visning av systemanalysen"
        description="Standardform för rapporten på översikten. Gäller på den här enheten och går alltid att växla direkt i rapporten."
      />
      <div className="space-y-1.5">
        {PRESENTATION_MODES.map((option) => (
          <label
            key={option.id}
            className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors ${
              mode === option.id ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"
            }`}
          >
            <input
              type="radio"
              name="presentation-mode"
              checked={mode === option.id}
              onChange={() => {
                setMode(option.id);
                setPresentationMode(option.id);
              }}
              className="h-4 w-4 accent-accent"
            />
            <span className="text-sm font-medium text-foreground">{option.label}</span>
          </label>
        ))}
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 transition-colors hover:border-accent/50">
          <input
            type="checkbox"
            checked={compact}
            onChange={(e) => {
              setCompact(e.target.checked);
              setCompactScope(e.target.checked);
            }}
            className="mt-0.5 h-4 w-4 accent-accent"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">Kort version som standard</span>
            <span className="block text-xs leading-relaxed text-muted-foreground">
              Rubriken, de tre viktigaste åtgärderna och strategin. Samma innehåll – bara urvalet.
            </span>
          </span>
        </label>
      </div>
    </WizardCard>
  );
};

export const ActiveCaseSection = () => {
  const queryClient = useQueryClient();
  const { data: cases } = useQuery({
    queryKey: ["my-cases"],
    queryFn: () => data.cases.listMine(),
    retry: false,
  });
  const { data: activeCase } = useQuery({
    queryKey: ["latest-case"],
    queryFn: () => data.cases.getLatest(),
    retry: false,
  });

  if (!cases || cases.length < 2) return null;
  return (
    <WizardCard>
      <WizardCardHeader
        title="Aktivt ärende"
        description="Hela inloggade läget – analys, frister, dokument, meddelanden – följer det ärende du valt."
      />
      <ul className="space-y-1.5">
        {cases.map((record) => {
          const active = record.id === activeCase?.id;
          return (
            <li key={record.id}>
              <button
                type="button"
                onClick={() => {
                  data.cases.select(record.id);
                  // Allt inloggat innehåll hänger på valet - töm hela cachen.
                  queryClient.invalidateQueries();
                }}
                aria-pressed={active}
                className={`flex w-full items-center justify-between gap-3 rounded-md border p-3 text-left transition-colors ${
                  active ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">
                    {record.companyName ?? record.orgNumber}
                  </span>
                  <span className="block text-xs text-muted-foreground">{record.orgNumber}</span>
                </span>
                {active && <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-accent" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ul>
    </WizardCard>
  );
};

export const NotificationSection = () => {
  const [prefs, setPrefs] = useState(getNotificationPrefs);
  const [forgotten, setForgotten] = useState(false);

  return (
    <WizardCard>
      <WizardCardHeader
        title="Notiser på den här enheten"
        description="Frister, kontrollbalansläget och ärendets läge visas alltid – det juridiskt kritiska går inte att stänga av. Resten väljer du."
      />
      <div className="space-y-1.5">
        {OPTIONAL_CATEGORIES.map((category) => (
          <label
            key={category.id}
            className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 transition-colors hover:border-accent/50"
          >
            <input
              type="checkbox"
              checked={prefs[category.id]}
              onChange={(e) => {
                setNotificationPref(category.id, e.target.checked);
                setPrefs(getNotificationPrefs());
              }}
              className="mt-0.5 h-4 w-4 accent-accent"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">{category.label}</span>
              <span className="block text-xs leading-relaxed text-muted-foreground">
                {category.description}
              </span>
            </span>
          </label>
        ))}
      </div>

      {/* Minnet går att släppa. En kvittering är ett val, och ett val som
          inte går att ta tillbaka är en fälla - särskilt i en produkt där
          det man kvitterade bort kan vara en frist. */}
      <div className="mt-4 border-t border-border pt-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Klockan minns vad du kvitterat, på den här enheten. Trappas något upp - en frist
          som går från "om tre dagar" till "förfaller idag" - räknas det som nytt och dyker
          upp igen.
        </p>
        <button
          type="button"
          onClick={() => {
            forgetRead();
            setForgotten(true);
          }}
          className="mt-2 text-sm font-medium text-accent underline-offset-4 hover:underline"
        >
          Visa alla notiser igen
        </button>
        {forgotten && (
          <span className="ml-2 text-xs text-muted-foreground" role="status">
            Minnet är rensat.
          </span>
        )}
      </div>
    </WizardCard>
  );
};

export const AccountSecuritySection = () => {
  const { signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");

  const change = useMutation({
    mutationFn: async () => {
      if (password.length < 8) throw new Error("Minst 8 tecken.");
      if (password !== repeat) throw new Error("Lösenorden stämmer inte överens.");
      const { error } = await data.auth.updatePassword(password);
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      setPassword("");
      setRepeat("");
    },
  });

  return (
    <WizardCard>
      <WizardCardHeader
        title="Konto och säkerhet"
        description="Byt lösenord eller logga ut. Hela akten kan alltid laddas ner under Dokument."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          change.mutate();
        }}
        className="space-y-3"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-foreground">Nytt lösenord</span>
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-foreground">Upprepa lösenordet</span>
            <Input
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              className="mt-1"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            variant="outline"
            disabled={password.length < 8 || change.isPending}
          >
            {change.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Byt lösenord
          </Button>
          {change.isSuccess && (
            <span className="flex items-center gap-1 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Lösenordet är bytt
            </span>
          )}
        </div>
        {change.isError && (
          <p className="text-sm text-destructive" role="alert">
            {change.error instanceof Error ? change.error.message : "Kunde inte byta lösenordet."}
          </p>
        )}
      </form>
      <div className="mt-4 flex flex-wrap gap-3 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={signOut}>
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Logga ut
        </Button>
        <Button type="button" variant="ghost" asChild>
          <Link to="/dashboard/dokument">
            <Download className="h-4 w-4" aria-hidden="true" />
            Ladda ner hela akten
          </Link>
        </Button>
      </div>
    </WizardCard>
  );
};
