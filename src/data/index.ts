import type { DataPort } from "./ports";
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
 * VILKEN BACKEND BYGGET PRATAR MED.
 *
 * Två lägen, och det ena är bara till för visningar. Här stod tre en gång:
 * `supabase` var standard, `aws` krävde en byggflagga, och det som inte
 * flyttats gick över en bro till Supabase. Migreringen är klar - alla 156
 * portmetoder i DataPort går mot CLEARANCE eget API - och då finns ingen
 * väg till en annan backend härifrån. Inte för att den är avstängd, utan
 * för att den inte längre är skriven.
 *
 * Det som en gång var `VITE_DATA_ADAPTER` är borta med samma resonemang:
 * en flagga som bara har ett giltigt värde är inte ett val, den är en
 * fälla för den som stavar fel.
 *
 * Vill man byta backend igen är vägen densamma som förut: skriv en adapter
 * som uppfyller DataPort (se ./ports.ts för hela kontraktet) och peka
 * `data` på den. Ingenting ovanför det här lagret importerar en backend-SDK
 * - tests/sakerhet.ts vaktar det.
 */
export type Backend = "demo" | "api";

export const BACKEND: Backend = IS_DEMO ? "demo" : "api";

export const data: DataPort = BACKEND === "demo" ? demoAdapter : awsAdapter;

if (IS_DEMO) {
  // Loud on purpose. Anyone seeing this in a console on a real deployment is
  // looking at a misbuilt bundle serving fictional data.
  console.warn(
    "CLEARANCE kör i DEMOLÄGE. All data är påhittad, sparas bara i din webbläsare och lösenordet kontrolleras inte.",
  );
}

export type { DataPort } from "./ports";
export * from "./types";
