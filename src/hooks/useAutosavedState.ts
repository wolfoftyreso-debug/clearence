import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useState som överlever en siduppdatering.
 *
 * Guiderna höll allt i minnet. En företagare som fyllt i skulder och
 * förfallodagar i tre steg och råkade uppdatera sidan förlorade allt - i en
 * produkt vars användare är mitt i sitt livs mest stressade vecka. De flesta
 * stänger fliken där, och kommer inte tillbaka.
 *
 * Värdet skrivs till localStorage en kort stund efter varje ändring och läses
 * tillbaka vid nästa besök. `clear()` anropas när flödet slutförts, så att
 * nästa besök börjar rent i stället för i ett gammalt halvfärdigt läge.
 *
 * Två medvetna avgränsningar:
 *
 *  - Endast localStorage, ingen server. Guiderna fungerar utan konto, och
 *    ofärdiga svar är känsligt material som inte ska lämna datorn förrän
 *    användaren själv väljer att spara.
 *  - Vid trasig eller föråldrad lagrad data används startvärdet tyst. Ett
 *    felmeddelande om en cache användaren inte vet finns hjälper ingen.
 */

interface Envelope<T> {
  /** Bumpas när formens struktur ändras, så gammal data inte tolkas fel. */
  version: number;
  value: T;
  savedAt: string;
}

const DEBOUNCE_MS = 400;

const read = <T>(key: string, version: number): T | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Envelope<T>;
    if (parsed.version !== version) return null;
    return parsed.value;
  } catch {
    return null;
  }
};

export interface AutosavedState<T> {
  value: T;
  setValue: (next: T | ((prev: T) => T)) => void;
  /** Sant när sidan öppnades med återupptagen data - visa det för användaren. */
  restored: boolean;
  /** Rensa lagringen: flödet är klart eller avsiktligt börjat om. */
  clear: () => void;
}

export const useAutosavedState = <T>(
  key: string,
  initial: T,
  version = 1,
): AutosavedState<T> => {
  // Läses en gång, vid mount. `initial` som funktion undviks med flit -
  // enkelheten är värd mer än lat init här.
  const [restoredValue] = useState<T | null>(() => read<T>(key, version));
  const [value, setValueRaw] = useState<T>(restoredValue ?? initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleared = useRef(false);

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      cleared.current = false;
      setValueRaw(next);
    },
    [],
  );

  useEffect(() => {
    if (cleared.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        const envelope: Envelope<T> = { version, value, savedAt: new Date().toISOString() };
        localStorage.setItem(key, JSON.stringify(envelope));
      } catch {
        // Fullt eller privat läge. Autospar är en förbättring, inte ett krav;
        // guiden ska fungera precis som förut när lagringen inte gör det.
      }
    }, DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [key, value, version]);

  const clear = useCallback(() => {
    cleared.current = true;
    try {
      localStorage.removeItem(key);
    } catch {
      // Samma sak: kan lagringen inte rensas är det värsta som händer att
      // nästa besök erbjuder en återupptagning användaren tackar nej till.
    }
  }, [key]);

  return { value, setValue, restored: restoredValue !== null, clear };
};
