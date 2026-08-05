import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { data } from "@/data";
import { clearWorkTraces } from "@/lib/localTraces";
import type { AuthUser } from "@/data/types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe before the initial fetch so an auth event firing during
    // startup cannot be missed.
    const unsubscribe = data.auth.onAuthChange((next) => {
      setUser(next);
      setLoading(false);
    });

    data.auth.getCurrentUser().then((current) => {
      setUser(current);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  /**
   * Utloggningen städar det som ligger kvar i webbläsaren.
   *
   * Här och inte i adaptrarna: alla tre backends ska bete sig likadant,
   * och en ny adapter ska inte kunna glömma bort städningen. Ordningen
   * är avsiktlig - först loggas användaren ut (sessionstoken behövs för
   * det), sedan städas spåren.
   *
   * Vad som städas och vad som står kvar avgörs i localTraces: arbete
   * och uppgifter om bolaget går, läsinställningar stannar.
   */
  const signOut = async () => {
    try {
      await data.auth.signOut();
    } finally {
      clearWorkTraces();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signUp: data.auth.signUp,
        signIn: data.auth.signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
