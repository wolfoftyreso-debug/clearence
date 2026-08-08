/**
 * GALLRING: hur länge uppgifter sparas, och vad som händer sen.
 *
 * GDPR art. 5.1 e säger att personuppgifter inte får sparas längre än
 * nödvändigt. docs/dataskydd.md §6 hade det som en ÖPPEN punkt - "sätt
 * gallringstider". Det här är den punkten, satt: en policy med en tid och
 * en åtgärd per kategori.
 *
 * TVÅ SAKER GÖR DEN HÄR FILEN ÄRLIG.
 *
 *  1. TIDERNA ÄR DRIFTPARAMETRAR, inte kodrader. Standarderna nedan gäller
 *     tills drift sätter andra i app_settings (nyckeln retention_policy),
 *     precis som priset. En gallringstid som kräver en ny release för att
 *     ändras är en gallringstid som aldrig ändras.
 *
 *  2. GALLRINGEN STARTAR I SKUGGLÄGE. Varje kategori bär `aktiv`. Är den
 *     false RÄKNAS det som skulle gallras, men ingenting raderas - samma
 *     hållning som skuggdebiteringen: mekaniken syns och kan granskas innan
 *     den får röra något. En människa slår på den per kategori, inte ett
 *     skript av misstag. Att radera fel, eller radera det spårbarheten
 *     kräver, är värre än att spara en månad för länge.
 *
 * Åtgärden är medvetet inte alltid "radera". Händelseloggen ska överleva
 * ärendet (spårbarhet väger tyngre), så där är åtgärden `behall`. Ett
 * krissamtal kan däremot `anonymiseras` - posten finns kvar för statistik,
 * men fritexten som kan bära personuppgifter tas bort.
 */

export type RetentionAction = "radera" | "anonymisera" | "behall";

export interface RetentionCategory {
  /** Stabil nyckel - används av gallringsjobbet och av driftparametern. */
  id: string;
  /** Läsbart namn för driftpanelen. */
  label: string;
  /** Vad kategorin är och varför just den här åtgärden. */
  description: string;
  /**
   * Månader posten sparas innan åtgärden. `null` = gallras aldrig på tid
   * (t.ex. händelseloggen, som behålls för spårbarhet).
   */
  months: number | null;
  /** Vad som händer när tiden gått: radera helt, anonymisera, eller behåll. */
  action: RetentionAction;
  /**
   * Skuggläge tills en människa slår på det. false = räkna, gallra inte.
   */
  aktiv: boolean;
}

/**
 * Standardpolicyn. Siffrorna är förslag som drift kan ändra; åtgärderna är
 * medvetna och bör inte ändras utan skäl.
 */
export const DEFAULT_RETENTION: RetentionCategory[] = [
  {
    id: "hastighetsgrans",
    label: "Hastighetsgränsens loggrader",
    description:
      "IP-adress är en personuppgift. Raderna behövs bara en kort stund för att " +
      "räkna anrop, och städas redan i dag varje timme.",
    months: 0,
    action: "radera",
    // Den enda som är aktiv från start: den raderar bara sekundfärska
    // teknikrader, aldrig ärende- eller personuppgifter, och körs redan.
    aktiv: true,
  },
  {
    id: "notiser_lasta",
    label: "Lästa notiser",
    description: "En läst och kvitterad notis behöver inte sparas i åratal.",
    months: 6,
    action: "radera",
    aktiv: false,
  },
  {
    id: "delningslankar_utgangna",
    label: "Utgångna delningslänkar",
    description:
      "En återkallad eller utgången live-länk fyller ingen funktion; " +
      "åtkomstloggen som hör till den behålls dock (se händelseloggen).",
    months: 3,
    action: "radera",
    aktiv: false,
  },
  {
    id: "samtalsjournal_avslutad",
    label: "Samtalsfritext i avslutade ärenden",
    description:
      "Fritext från samtalet kan bära känsliga uppgifter. I ett sedan länge " +
      "avslutat ärende anonymiseras den – posten och tidslinjen finns kvar, " +
      "men innehållet som kan peka ut en person tas bort.",
    months: 24,
    action: "anonymisera",
    aktiv: false,
  },
  {
    id: "kontakt_avslutade_konton",
    label: "Kontaktuppgifter på stängda konton",
    description:
      "Namn, e-post och telefon på ett konto som varit stängt länge " +
      "anonymiseras. Fakturor och bokföringsunderlag berörs inte – de har " +
      "egna lagringskrav.",
    months: 24,
    action: "anonymisera",
    aktiv: false,
  },
  {
    id: "handelselogg",
    label: "Händelseloggen (spårbarhet)",
    description:
      "Ärendets svarta låda. Den ska överleva ärendet – spårbarheten väger " +
      "tyngre än gallring – så den gallras inte på tid.",
    months: null,
    action: "behall",
    aktiv: false,
  },
];

/** En driftparameter-override: bara fälten drift faktiskt satt, per id. */
export interface RetentionOverride {
  id: string;
  months?: number | null;
  action?: RetentionAction;
  aktiv?: boolean;
}

/**
 * Lägger driftparametern ovanpå standarden. Okända id:n i overriden
 * ignoreras (en kategori som inte finns i koden ska inte kunna uppstå ur en
 * inställning), och kategorier utan override behåller sina standardvärden.
 */
export const mergeRetentionPolicy = (
  defaults: RetentionCategory[],
  overrides: RetentionOverride[] | null | undefined,
): RetentionCategory[] => {
  const byId = new Map((overrides ?? []).map((o) => [o.id, o]));
  return defaults.map((cat) => {
    const o = byId.get(cat.id);
    if (!o) return cat;
    return {
      ...cat,
      months: o.months === undefined ? cat.months : o.months,
      action: o.action ?? cat.action,
      aktiv: o.aktiv === undefined ? cat.aktiv : o.aktiv,
    };
  });
};

/**
 * Brytdatumet: allt som är äldre än så här ska gallras. `null` months ger
 * `null` - kategorin gallras aldrig på tid.
 */
export const retentionCutoff = (category: RetentionCategory, now: Date): string | null => {
  if (category.months === null) return null;
  const d = new Date(now.getTime());
  d.setMonth(d.getMonth() - category.months);
  return d.toISOString();
};

/** Sant när en post med given tidsstämpel har passerat sin gallringstid. */
export const isExpired = (
  category: RetentionCategory,
  recordIso: string,
  now: Date,
): boolean => {
  const cutoff = retentionCutoff(category, now);
  if (cutoff === null) return false;
  const rec = new Date(recordIso).getTime();
  if (Number.isNaN(rec)) return false;
  return rec <= new Date(cutoff).getTime();
};

export const ACTION_LABEL: Record<RetentionAction, string> = {
  radera: "raderas",
  anonymisera: "anonymiseras",
  behall: "behålls (gallras inte på tid)",
};

/**
 * En ärlig sammanfattning för driftpanelen: hur många kategorier som
 * faktiskt gallrar och hur många som ännu bara räknar i skuggläge.
 */
export const retentionSummary = (policy: RetentionCategory[]): string => {
  const aktiva = policy.filter((c) => c.aktiv && c.action !== "behall").length;
  const skugga = policy.filter((c) => !c.aktiv && c.action !== "behall").length;
  const behall = policy.filter((c) => c.action === "behall").length;
  const delar: string[] = [];
  delar.push(`${aktiva} ${aktiva === 1 ? "kategori gallrar" : "kategorier gallrar"} skarpt`);
  if (skugga > 0) delar.push(`${skugga} i skuggläge (räknas, gallras inte)`);
  if (behall > 0) delar.push(`${behall} behålls för spårbarhet`);
  return `${delar.join(", ")}.`;
};

/** Förklaring av skuggläget, för den som undrar varför en rad inte gallrar. */
export const SKUGGLAGE_NOTE =
  "Gallring slås på per kategori av drift, inte automatiskt. I skuggläge " +
  "räknas det som skulle gallras utan att något raderas – samma försiktighet " +
  "som skuggdebiteringen.";
