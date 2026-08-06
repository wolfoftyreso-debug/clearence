import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WizardCard } from "@/components/wizard/WizardCard";
import { useAuth } from "@/hooks/useAuth";
import { data, IS_DEMO } from "@/data";
import { translateAuthError } from "@/lib/authErrors";
import type { UserRole } from "@/data/types";
import { Briefcase, Building2, Loader2, Scale, SlidersHorizontal } from "lucide-react";

/**
 * Rollen väljs en gång, vid registrering.
 *
 * Företagare och rådgivare ska mötas av olika saker vid inloggning. Att låta
 * det vara en inställning man byter i efterhand vore fel: en rådgivare är
 * rådgivare först när behörigheten är kontrollerad, och den kontrollen sker i
 * ansökan - inte i en rullgardin.
 */
const ROLES: { value: UserRole; label: string; description: string; icon: typeof Building2 }[] = [
  {
    value: "company",
    label: "Jag driver företaget",
    description: "Utvärdering, likviditetsplan, kontrollbalansräkning och dokument.",
    icon: Building2,
  },
  {
    value: "advisor",
    label: "Jag är rådgivare",
    description: "Rekonstruktör, konkursförvaltare, revisor eller jurist som tar uppdrag.",
    icon: Briefcase,
  },
];

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [role, setRole] = useState<UserRole>("company");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  /**
   * One click into the signed-in product, from the perspective that matters
   * to the viewer: the company in crisis, the advisor with a client list, or
   * the operator. Demo builds accept any credentials, so the only thing
   * typing them achieves is a chance to get stuck - each role lands directly
   * in its own start view.
   */
  const enterDemo = async (demoEmail: string, landing: string) => {
    setError(null);
    setInfo(null);
    setLoading(true);
    const result = await signIn(demoEmail, "demo123");
    setLoading(false);
    if (result.error) {
      setError(translateAuthError(result.error));
      return;
    }
    navigate(landing, { replace: true });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    if (mode === "reset") {
      const result = await data.auth.requestPasswordReset(email.trim());
      setLoading(false);
      if (result.error) {
        setError(translateAuthError(result.error));
        return;
      }
      // Samma besked oavsett om adressen finns. Ett formulär som svarar
      // olika är ett register över vilka bolag som är kunder här.
      setInfo(
        "Om adressen har ett konto hos oss skickar vi en återställningslänk dit inom någon minut. Titta även i skräpposten.",
      );
      setMode("login");
      return;
    }

    if (mode === "login") {
      const result = await signIn(email, password);
      setLoading(false);
      if (result.error) {
        setError(translateAuthError(result.error));
        return;
      }
      navigate(redirectTo, { replace: true });
      return;
    }

    const result = await signUp(email, password);
    if (result.error) {
      setLoading(false);
      setError(translateAuthError(result.error));
      return;
    }

    // Profilen skapas direkt, medan sessionen finns. Skjuts det upp till
    // första inloggningen hamnar användaren i fel gränssnitt en gång, och
    // rollen är just det som avgör vad hen ser.
    if (!result.needsEmailConfirmation) {
      try {
        await data.profile.create({ role, displayName: null });
      } catch {
        // Profilen kan skapas i efterhand; rollen faller tillbaka på
        // "company", vilket är det ofarliga alternativet. Att stoppa
        // inloggningen här vore värre än att visa fel meny.
      }
    }

    setLoading(false);
    if (result.needsEmailConfirmation) {
      setInfo("Kontot är skapat. Kontrollera din e-post för att bekräfta adressen, logga sedan in.");
      setMode("login");
      return;
    }
    navigate(redirectTo, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-sm surface-accent flex items-center justify-center">
            <span className="text-accent-foreground font-bold text-sm">C</span>
          </div>
          <span className="font-display text-xl text-foreground">CLEARANCE</span>
        </Link>

        {IS_DEMO && (
          <div className="mb-4 rounded-md border border-warning/40 bg-warning/10 p-4">
            <p className="text-sm font-semibold text-foreground">Testa Clearance</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Välj vilket perspektiv du vill uppleva – varje konto landar i sin
              egen startvy med egna exempeldata.
            </p>
            <div className="mt-3 space-y-2">
              {([
                {
                  email: "foretag@clearance.demo",
                  label: "Demo – Företag",
                  description: "Så hanterar ett bolag sin ekonomiska situation.",
                  icon: Building2,
                  landing: "/dashboard",
                },
                {
                  email: "jurist@clearance.demo",
                  label: "Demo – Jurist/Revisor",
                  description: "Rådgivarens klientlista med flera bolag samtidigt.",
                  icon: Scale,
                  landing: "/arenden",
                },
                {
                  email: "admin@clearance.demo",
                  label: "Demo – Systemadministratör",
                  description: "Drift, övervakning och plattformens statistik.",
                  icon: SlidersHorizontal,
                  landing: "/admin",
                },
              ] as const).map((account) => {
                const Icon = account.icon;
                return (
                  <button
                    key={account.email}
                    type="button"
                    disabled={loading}
                    onClick={() => void enterDemo(account.email, account.landing)}
                    className="flex w-full items-start gap-3 rounded-md border border-border bg-card p-3 text-left transition-colors hover:border-accent disabled:opacity-60"
                  >
                    <Icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">
                        {account.label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {account.description}
                      </span>
                      <span className="mt-0.5 block break-all text-xs font-medium text-accent">
                        {account.email}
                      </span>
                    </span>
                    {loading && (
                      <Loader2 className="ml-auto h-4 w-4 animate-spin text-accent" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Lösenord: <span className="font-medium text-foreground">demo123</span> – demon
              accepterar vilka uppgifter som helst i formuläret nedan.
            </p>
          </div>
        )}

        <WizardCard>
          <div className="mb-6 text-center">
            <h1 className="text-xl font-display font-semibold text-foreground mb-1">
              {mode === "login" ? "Logga in" : mode === "signup" ? "Skapa konto" : "Återställ lösenord"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {mode === "login"
                ? "Logga in för att se dina sparade ärenden."
                : mode === "signup"
                  ? "Ett konto sparar din utvärdering så du kan återkomma till den."
                  : "Ange din e-postadress så skickar vi en länk för att välja ett nytt lösenord."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <fieldset className="space-y-2">
                <legend className="mb-2 block text-sm font-medium text-foreground">
                  Vem är du?
                </legend>
                {ROLES.map((option) => {
                  const Icon = option.icon;
                  const selected = role === option.value;
                  return (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer gap-3 rounded-md border p-3 transition-colors ${
                        selected
                          ? "border-accent bg-accent/5"
                          : "border-border hover:border-accent/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={option.value}
                        checked={selected}
                        onChange={() => setRole(option.value)}
                        className="sr-only"
                      />
                      <Icon
                        className={`mt-0.5 h-5 w-5 flex-shrink-0 ${selected ? "text-accent" : "text-muted-foreground"}`}
                        aria-hidden="true"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground">
                          {option.label}
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                          {option.description}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                E-post
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="namn@foretag.se"
              />
            </div>

            {mode !== "reset" && (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <label htmlFor="password" className="block text-sm font-medium text-foreground">
                    Lösenord
                  </label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("reset");
                        setError(null);
                        setInfo(null);
                      }}
                      className="text-sm text-accent underline-offset-4 hover:underline"
                    >
                      Glömt lösenordet?
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minst 6 tecken"
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            {info && (
              <p className="text-sm text-success" role="status">
                {info}
              </p>
            )}

            <Button type="submit" variant="accent" size="lg" className="w-full" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "login" ? "Logga in" : mode === "signup" ? "Skapa konto" : "Skicka återställningslänk"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "reset" ? (
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                  setInfo(null);
                }}
                className="text-accent font-medium hover:underline"
              >
                Tillbaka till inloggningen
              </button>
            ) : (
              <>
                {mode === "login" ? "Inget konto än?" : "Har du redan ett konto?"}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === "login" ? "signup" : "login");
                    setError(null);
                    setInfo(null);
                  }}
                  className="text-accent font-medium hover:underline"
                >
                  {mode === "login" ? "Skapa ett" : "Logga in"}
                </button>
              </>
            )}
          </p>
        </WizardCard>
      </div>
    </div>
  );
};

export default Login;
