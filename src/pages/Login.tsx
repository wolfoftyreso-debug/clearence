import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WizardCard } from "@/components/wizard/WizardCard";
import { useAuth } from "@/hooks/useAuth";
import { IS_DEMO } from "@/data";
import { translateAuthError } from "@/lib/authErrors";
import { Loader2 } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  /**
   * One click into the signed-in product. Demo builds accept any credentials,
   * so the only thing typing them achieves is a chance to get stuck.
   */
  const enterDemo = async () => {
    setError(null);
    setInfo(null);
    setLoading(true);
    const result = await signIn("demo@example.invalid", "demo-losenord");
    setLoading(false);
    if (result.error) {
      setError(translateAuthError(result.error));
      return;
    }
    navigate(redirectTo, { replace: true });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

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
    setLoading(false);
    if (result.error) {
      setError(translateAuthError(result.error));
      return;
    }
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
            <p className="text-sm font-semibold text-foreground">Demoläge</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Ingen riktig inloggning. Klicka nedan så kommer du direkt in i ett
              exempelärende – eller skriv vilken e-post och vilket lösenord som helst.
            </p>
            <Button
              type="button"
              variant="accent"
              size="lg"
              className="mt-3 w-full"
              disabled={loading}
              onClick={() => void enterDemo()}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Gå in i demon
            </Button>
          </div>
        )}

        <WizardCard>
          <div className="mb-6 text-center">
            <h1 className="text-xl font-display font-semibold text-foreground mb-1">
              {mode === "login" ? "Logga in" : "Skapa konto"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {mode === "login"
                ? "Logga in för att se dina sparade ärenden."
                : "Ett konto sparar din utvärdering så du kan återkomma till den."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                Lösenord
              </label>
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
              {mode === "login" ? "Logga in" : "Skapa konto"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
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
          </p>
        </WizardCard>
      </div>
    </div>
  );
};

export default Login;
