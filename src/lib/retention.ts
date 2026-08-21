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

/** Övre gräns för en gallringstid: 50 år. Bortom det är det ett skrivfel. */
export const MAX_RETENTION_MONTHS = 600;

/** En avvisad del av driftparametern - vilken kategori, vilket fält, varför. */
export interface RetentionProblem {
  id: string;
  falt: string;
  skal: string;
}

const arHeltal = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v);

/**
 * VARFÖR DEN HÄR FUNKTIONEN FINNS.
 *
 * Driftparametern är JSON i app_settings. Den skrivs av en människa, och
 * en människa kan skriva -6 i stället för 6. Ett negativt antal månader ger
 * ett brytdatum i FRAMTIDEN, och ett brytdatum i framtiden matchar allt -
 * gallringen slutar vara gallring och blir en tömning. Ett månadsvärde som
 * inte är ett tal ger ett ogiltigt datum, och det kastar mitt i nattjobbet
 * så att raderingarna efter gallringen aldrig körs.
 *
 * Tre saker avvisas därför, var och en med skäl:
 *
 *  1. Ogiltiga värden (negativa, decimaltal, strängar, fel typ).
 *  2. `months: null` på en kategori som ska radera eller anonymisera. Utan
 *     tidsgräns händer ingenting - men loggen hade skrivit "0 rad(er)
 *     raderade", vilket ser ut som att det fungerade.
 *  3. Ett id som inte finns i koden. Utan det här blir en felstavning ett
 *     sparat värde som aldrig gör någon skillnad, och drift tror att de
 *     slagit på något.
 */
export const retentionOverrideProblems = (
  defaults: RetentionCategory[],
  overrides: RetentionOverride[] | null | undefined,
): RetentionProblem[] => {
  const problem: RetentionProblem[] = [];
  const kanda = new Map(defaults.map((c) => [c.id, c]));
  const sedda = new Set<string>();

  for (const rad of overrides ?? []) {
    if (typeof rad !== "object" || rad === null || Array.isArray(rad)) {
      problem.push({ id: "(okänd)", falt: "post", skal: "posten är inte ett objekt" });
      continue;
    }
    const o = rad as RetentionOverride & Record<string, unknown>;
    if (typeof o.id !== "string" || !kanda.has(o.id)) {
      problem.push({ id: String(o.id ?? "(saknas)"), falt: "id", skal: "okänd kategori" });
      continue;
    }
    if (sedda.has(o.id)) {
      problem.push({ id: o.id, falt: "id", skal: "kategorin står två gånger" });
      continue;
    }
    sedda.add(o.id);
    const standard = kanda.get(o.id)!;

    if (o.action !== undefined && !["radera", "anonymisera", "behall"].includes(o.action as string)) {
      problem.push({ id: o.id, falt: "action", skal: `okänd åtgärd "${String(o.action)}"` });
    }
    const atgard = ["radera", "anonymisera", "behall"].includes(o.action as string)
      ? (o.action as RetentionAction)
      : standard.action;

    if (o.months !== undefined) {
      if (o.months === null) {
        if (atgard !== "behall") {
          problem.push({
            id: o.id,
            falt: "months",
            skal: "utan tidsgräns gallras ingenting, men loggen hade sagt 0 rader " +
              `${ACTION_LABEL[atgard]} - sätt en tid eller åtgärden "behall"`,
          });
        }
      } else if (!arHeltal(o.months)) {
        problem.push({ id: o.id, falt: "months", skal: "månader ska vara ett heltal" });
      } else if (o.months < 0) {
        problem.push({
          id: o.id,
          falt: "months",
          skal: "negativa månader ger ett brytdatum i framtiden - det hade gallrat allt",
        });
      } else if (o.months > MAX_RETENTION_MONTHS) {
        problem.push({ id: o.id, falt: "months", skal: `högst ${MAX_RETENTION_MONTHS} månader` });
      }
    }

    if (o.aktiv !== undefined && typeof o.aktiv !== "boolean") {
      problem.push({ id: o.id, falt: "aktiv", skal: "ska vara true eller false" });
    }
  }
  return problem;
};

/**
 * Lägger driftparametern ovanpå standarden.
 *
 * Sammanslagningen är sista försvaret, inte det första: API:et avvisar en
 * trasig policy med 400, men app_settings går att skriva direkt i databasen
 * och gallringen får inte bli farlig av det. Varje fält som
 * retentionOverrideProblems underkänner FALLER TILLBAKA på standarden i
 * stället för att slås igenom. Det gör det omöjligt att få ut ett
 * brytdatum i framtiden ur en inställning.
 */
export const mergeRetentionPolicy = (
  defaults: RetentionCategory[],
  overrides: RetentionOverride[] | null | undefined,
): RetentionCategory[] => {
  const trasiga = new Set(
    retentionOverrideProblems(defaults, overrides).map((p) => `${p.id}:${p.falt}`),
  );
  const byId = new Map<string, RetentionOverride>();
  for (const o of overrides ?? []) {
    if (typeof o === "object" && o !== null && typeof o.id === "string" && !byId.has(o.id)) {
      byId.set(o.id, o);
    }
  }
  return defaults.map((cat) => {
    const o = byId.get(cat.id);
    if (!o || trasiga.has(`${cat.id}:id`)) return cat;
    const ta = (falt: string) => !trasiga.has(`${cat.id}:${falt}`);
    return {
      ...cat,
      months: o.months === undefined || !ta("months") ? cat.months : o.months,
      action: o.action !== undefined && ta("action") ? o.action : cat.action,
      aktiv: o.aktiv === undefined || !ta("aktiv") ? cat.aktiv : o.aktiv,
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
