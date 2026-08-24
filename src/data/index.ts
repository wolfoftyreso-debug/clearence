import type { DataPort } from "./ports";
import { supabaseAdapter } from "./supabase/adapter";
import { demoAdapter } from "./demo/adapter";
import { awsAdapter } from "./aws/adapter";

/**
 * Whether this build runs entirely in the browser against invented data.
 *
 * Set VITE_DEMO_MODE=true only for previews and demonstrations. The check is
 * a strict comparison against the string "true" so a stray value cannot
 * switch it on, and the flag is read at build time, so a production bundle
 * built without it cannot be talked into demo mode at runtime.
 */
export const IS_DEMO = import.meta.env.VITE_DEMO_MODE === "true";

/**
 * The active backend.
 *
 * This is the single line to change when moving to another backend: write an
 * adapter satisfying DataPort (see ./ports.ts for the full contract) and
 * point `data` at it. Nothing above this layer imports a backend SDK.
 *
 * If that backend is plain Postgres rather than Supabase, read the note in
 * ports.ts first - the current row scoping is enforced by row-level security
 * using auth.uid(), which does not exist outside Supabase. Losing it fails
 * open: queries keep working and start returning other users' data.
 */
/**
 * Vilken backend bygget pratar med.
 *
 * STANDARD ÄR CLEARANCE EGET API. Det var det inte förut: default var
 * `supabase`, och `aws` krävde att VITE_DATA_ADAPTER sattes vid bygget.
 * En Vercel-drift där någon glömde den variabeln hade alltså sett helt
 * normal ut och pratat med Supabase - tyst, och med produktens egen
 * databas orörd. Standardvärdet ska vara det man vill ha, inte det man
 * råkar få.
 *
 * `supabase` finns kvar som ett MEDVETET val (VITE_DATA_ADAPTER=supabase),
 * och som bro under aws-adaptern för de portar som ännu inte flyttat -
 * se MIGRATED_PORTS i src/data/aws/adapter.ts. Rörs en sådan port utan
 * att bron är uppspänd kastas ett fel som namnger porten.
 *
 * Läses vid byggtid, som demoflaggan: en bunt byggd utan flaggan kan
 * inte pratas över till en annan backend i efterhand.
 */
export type Backend = "demo" | "aws" | "supabase";

export const BACKEND: Backend = IS_DEMO
  ? "demo"
  : import.meta.env.VITE_DATA_ADAPTER === "supabase"
    ? "supabase"
    : "aws";

export const data: DataPort =
  BACKEND === "demo" ? demoAdapter : BACKEND === "aws" ? awsAdapter : supabaseAdapter;

if (IS_DEMO) {
  // Loud on purpose. Anyone seeing this in a console on a real deployment is
  // looking at a misbuilt bundle serving fictional data.
  console.warn(
    "CLEARANCE kör i DEMOLÄGE. All data är påhittad, sparas bara i din webbläsare och lösenordet kontrolleras inte.",
  );
}

/**
 * VAD SOM ÄNNU GÅR ÖVER BRON.
 *
 * Exponerad så att driften kan läsa den, inte bara koden. En tom lista
 * betyder att `...supabaseAdapter` kan tas bort ur aws-adaptern.
 */
export { delegeradePortar, MIGRATED_PORTS } from "./aws/adapter";
export { supabaseConfigured } from "@/integrations/supabase/client";

export type { DataPort } from "./ports";
export * from "./types";
