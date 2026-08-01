import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WizardCard } from "@/components/wizard/WizardCard";
import { useAuth } from "@/hooks/useAuth";
import { translateAuthError } from "@/lib/authErrors";
import { Loader2 } from "lucide-react";

interface SaveWithAccountPromptProps {
  title?: string;
  description?: string;
  /** Called once after sign-in/sign-up produces a live, authenticated session. */
  onAuthenticated: () => void;
}

/**
 * Inline login/signup used where navigating away to /login would lose
 * in-progress form state (e.g. mid-wizard). Watches the auth context and
 * fires onAuthenticated as soon as a session exists, rather than trying to
 * chain off the signIn/signUp call directly.
 */
export const SaveWithAccountPrompt = ({
  title = "Skapa konto för att spara",
  description = "Ett konto sparar ditt ärende så du kan återkomma till det senare.",
  onAuthenticated,
}: SaveWithAccountPromptProps) => {
  const { user, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    if (user && !firedRef.current) {
      firedRef.current = true;
      onAuthenticated();
    }
  }, [user, onAuthenticated]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    if (mode === "login") {
      const result = await signIn(email, password);
      setLoading(false);
      if (result.error) setError(translateAuthError(result.error));
      return;
    }

    const result = await signUp(email, password);
    setLoading(false);
    if (result.error) {
      setError(translateAuthError(result.error));
      return;
    }
    if (result.needsEmailConfirmation) {
      setInfo("Kontot är skapat. Kontrollera din e-post för att bekräfta adressen, logga sedan in nedan.");
      setMode("login");
    }
  };

  return (
    <WizardCard>
      <div className="mb-5">
        <h3 className="text-lg font-display font-semibold text-foreground mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="save-prompt-email" className="block text-sm font-medium text-foreground">
            E-post
          </label>
          <Input
            id="save-prompt-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="namn@foretag.se"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="save-prompt-password" className="block text-sm font-medium text-foreground">
            Lösenord
          </label>
          <Input
            id="save-prompt-password"
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
          {mode === "login" ? "Logga in och spara" : "Skapa konto och spara"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-muted-foreground">
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
  );
};
