import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { data } from "@/data";
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

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signUp: data.auth.signUp,
        signIn: data.auth.signIn,
        signOut: data.auth.signOut,
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
