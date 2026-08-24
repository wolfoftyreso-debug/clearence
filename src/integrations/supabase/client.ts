/**
 * SUPABASE-KLIENTEN - LAT, INTE IVRIG.
 *
 * Den här filen skapade tidigare klienten direkt vid inläsning:
 *
 *     export const supabase = createClient(SUPABASE_URL, KEY, ...)
 *
 * Det såg oskyldigt ut och var produktens värsta driftfälla. `createClient`
 * kastar "supabaseUrl is required" när variabeln saknas, och kastet skedde
 * medan modulen laddades - alltså innan React hann rendera något alls.
 * Resultatet i ett bygge utan VITE_SUPABASE_URL var en HELVIT SIDA med ett
 * engelskt fel i konsolen. Inte en trasig funktion: ingen produkt.
 *
 * Det spelade roll för att CLEARANCE inte längre KÖR på Supabase. Eget API
 * är standardbackenden (se src/data/index.ts); Supabase är kvar som en bro
 * för de portar som ännu inte flyttat. En drift som aldrig rör de portarna
 * ska inte behöva sätta variablerna - och framför allt inte krascha på dem.
 *
 * Nu skapas klienten VID FÖRSTA ANVÄNDNINGEN. Saknas variablerna kastas ett
 * läsbart, svenskt fel som säger exakt vilken variabel som fattas och vad
 * alternativet är - och det kastas där anropet sker, så stacken pekar på
 * porten som behövde Supabase i stället för på en modulinläsning.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? '';

/** Sant när bron ÄR uppspänd. Läses av src/data/index.ts. */
export const supabaseConfigured = (): boolean =>
  SUPABASE_URL.length > 0 && SUPABASE_PUBLISHABLE_KEY.length > 0;

/** Vilka variabler som fattas. Tom lista = allt finns. */
export const supabaseSaknade = (): string[] => {
  const saknas: string[] = [];
  if (!SUPABASE_URL) saknas.push('VITE_SUPABASE_URL');
  if (!SUPABASE_PUBLISHABLE_KEY) saknas.push('VITE_SUPABASE_PUBLISHABLE_KEY');
  return saknas;
};

export class SupabaseSaknasError extends Error {
  constructor(vad: string) {
    super(
      [
        `Den här funktionen (${vad}) går fortfarande genom Supabase-bron, och bron är inte uppspänd i den här driften.`,
        '',
        `Saknade byggvariabler: ${supabaseSaknade().join(', ')}.`,
        '',
        'CLEARANCE kör mot sitt eget API. Supabase är kvar bara för de portar',
        'som ännu inte flyttats (se MIGRATED_PORTS i src/data/aws/adapter.ts).',
        'Antingen sätts variablerna vid bygget, eller så flyttas porten.',
      ].join('\n'),
    );
    this.name = 'SupabaseSaknasError';
  }
};

let klient: SupabaseClient<Database> | null = null;

const hamtaKlient = (): SupabaseClient<Database> => {
  if (!klient) {
    if (!supabaseConfigured()) throw new SupabaseSaknasError('okänd port');
    klient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return klient;
};

/**
 * Import the supabase client like this:
 * import { supabase } from "@/integrations/supabase/client";
 *
 * En Proxy, inte en klient. Skillnaden är att `supabase.from(...)` kastar
 * först när NÅGON RÖR den - inte när filen läses in. Namnet på det som rördes
 * (`from`, `rpc`, `auth`, `storage`) följer med in i felmeddelandet.
 */
export const supabase: SupabaseClient<Database> = new Proxy(
  {} as SupabaseClient<Database>,
  {
    get(_mål, egenskap) {
      if (!supabaseConfigured()) throw new SupabaseSaknasError(`supabase.${String(egenskap)}`);
      const varde = Reflect.get(hamtaKlient(), egenskap) as unknown;
      return typeof varde === 'function' ? varde.bind(hamtaKlient()) : varde;
    },
  },
);
