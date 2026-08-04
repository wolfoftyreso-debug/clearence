/**
 * Företagsabonnemanget och betalväggen.
 *
 * Prismodellen är beslutad för betan: EN plan, månadsfaktura, ingen
 * bindningstid, uppsägning när som helst, tillgång under den betalda
 * perioden - och alla data sparas även om abonnemanget pausas.
 *
 * Beloppet är en DRIFTPARAMETER, aldrig en kodrad: gränssnittet läser
 * alltid planen via dataporten, och drift kan ändra den utan release.
 * Konstanten här är bara reservvärdet när ingen parameter är satt.
 *
 * Betalväggens princip: användaren blir aldrig inlåst och förlorar
 * aldrig sitt arbete. Allt skapande är öppet från början - analysen,
 * samtalet, dokumenten, handlingsplanen. Det som väntar på första
 * betalningen är vägarna UT och RUNT: export och delning. En naturlig
 * uppgradering, inte en gisslansituation.
 */

import type { AccountBillingRecord } from "@/data/types";

export interface CompanyPlan {
  /** Standard-nivåns månadsavgift i SEK, exklusive moms. Sätts av drift. */
  monthlyExVatSek: number;
  /** Business-nivån. Null = visas som "kontakta oss". */
  businessExVatSek?: number | null;
  /** Enterprise-nivån. Offert är alltid ett alternativ. */
  enterpriseExVatSek?: number | null;
}

/** Reservvärdena tills drift satt parametrarna. Beslutade betapriser. */
export const DEFAULT_COMPANY_PLAN: CompanyPlan = {
  monthlyExVatSek: 985,
  businessExVatSek: 2780,
  enterpriseExVatSek: 4500,
};

/**
 * Nivåerna. "Start" heter aldrig provversion - en provversion förväntas
 * vara gratis eller hårt begränsad, och det ska sägas rakt: Start ÄR
 * gratis, för att uppleva produkten. Nivåerna knyts till funktioner och
 * användare - aldrig till omsättning, för två bolag med samma omsättning
 * kan ha helt olika behov.
 */
export const PLAN_TIERS = [
  {
    id: "start",
    name: "Clearance Start",
    audience: "För att uppleva produkten",
    includes: [
      "Samtalet med rådgivaren",
      "Grundläggande analys och lägesbild",
      "Skapa dokument och handlingsplan",
    ],
    excludes: [
      "Ingen export",
      "Ingen delning",
      "Ingen ekonomisystemskoppling",
      "Inga aviseringar utanför appen",
    ],
  },
  {
    id: "standard",
    name: "Clearance Standard",
    audience: "Små och medelstora företag",
    includes: [
      "Obegränsad dialog och full handlingsplan",
      "Dokumentgenerering, arkiv och ärendehistorik",
      "Export, delning och e-post till rådgivare",
    ],
    // Ekonomisystemskopplingen bor i Business och Enterprise - ENDAST
    // där, på uttrycklig begäran. Flytta inte ner den igen.
    excludes: ["Ingen ekonomisystemskoppling", "Inga SMS-aviseringar"],
  },
  {
    id: "business",
    name: "Clearance Business",
    audience: "Företag med större komplexitet",
    includes: [
      "Flera användare och flera bolag",
      "Ekonomisystemskoppling (Fortnox/Visma när avtalen är på plats)",
      "Behörighetsstyrning och styrelseportal",
      "SMS-aviseringar vid frister och åtgärder",
      "Avancerade arbetsflöden och utökade integrationer",
      "Prioriterad support",
    ],
    excludes: [],
  },
  {
    id: "enterprise",
    name: "Clearance Enterprise",
    audience: "Större bolag med särskilda krav",
    includes: [
      "Ekonomisystemskoppling, anpassade integrationer och API",
      "Fler användare och roller",
      "Avancerad loggning",
      "SMS-aviseringar vid frister och åtgärder",
      "Dedikerad onboarding och anpassad support",
    ],
    excludes: [],
  },
] as const;

/** "985 kr/mån + moms" - alltid exklusive moms mot aktiebolag. */
export const formatMonthly = (sek: number): string =>
  `${String(Math.round(sek)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr/mån + moms`;

export const formatPlanPrice = (plan: CompanyPlan): string => formatMonthly(plan.monthlyExVatSek);

/** Villkoren i klartext - samma ord överallt där planen visas. */
export const PLAN_TERMS = [
  "Månadsvis faktura",
  "Ingen bindningstid – uppsägning när som helst",
  "Tillgång till tjänsten under den betalda perioden",
  "Alla data sparas även om abonnemanget pausas",
] as const;

/* --- betalväggen ----------------------------------------------------------- */

/**
 * Nyckelfrågan är EN: har första fakturan betalats? Före den är allt
 * skapande öppet men export och delning väntar. Efter den är de öppna.
 * Ett pausat abonnemang raderar aldrig data - frysningen är läsbar.
 */
export const firstPaymentDone = (billing: AccountBillingRecord | null | undefined): boolean =>
  !!billing?.paidAt;

/** Vad som väntar på första betalningen - listan är kommunikationen. */
export const LOCKED_UNTIL_FIRST_PAYMENT = [
  "Export av dokument och ärendehistorik",
  "Delning med externa rådgivare",
  "Fristkalender till eget kalenderprogram",
] as const;

/**
 * Låstexten som visas vid varje stängd funktion. Priset kommer ur
 * planen (driftparametern), aldrig ur en strängkonstant i en vy.
 */
export const lockMessage = (plan: CompanyPlan): string =>
  `Aktiveras när första fakturan är betald. ${formatPlanPrice(plan)} – ingen bindningstid, avsluta när som helst. Allt du skapat finns kvar.`;
