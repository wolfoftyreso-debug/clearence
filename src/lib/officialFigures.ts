/**
 * Figures and legal references that change with the calendar.
 *
 * These live in one file on purpose. Amounts like the price base amount are
 * set annually, and a stale figure in an insolvency service is not a cosmetic
 * problem - someone can plan a payment around it. Keeping them scattered
 * through the components is how they rot without anyone noticing.
 *
 * WHEN REVIEWING: work down the list, check each value against the source
 * given with it, then move REVIEWED_ON forward. Do not move the date without
 * having checked, and do not guess a value that a source has not confirmed -
 * the UI presents these as facts about Swedish law.
 *
 * Last reviewed: 2026-07-31.
 */

/** The date the values below were last checked against their sources. */
export const REVIEWED_ON = "2026-07-31";

/** Year the annual amounts below apply to. */
export const FIGURES_YEAR = 2026;

/* -------------------------------------------------------------------------- */
/* Amounts                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Price base amount (prisbasbelopp) for 2026, set by the government.
 * Source: regeringen.se, "Prisbasbelopp för 2026 fastställt" (Sept 2025).
 */
export const PRICE_BASE_AMOUNT = 59_200;

/**
 * Standard employer contribution rate (arbetsgivaravgift).
 * 31.42% has been the full rate since 2009 and still applies in 2026.
 * Source: Skatteverket, "Arbetsgivaravgifter".
 *
 * Two reductions exist and are NOT applied by the projection, because
 * applying them needs each employee's age and monthly salary, which the
 * planner does not ask for. The planner says so where the rate is shown -
 * over-stating a cost is the safer direction, but the user should know:
 *  - 20.81% for employees who turned 18 but not 23 at the start of the year,
 *    on salary up to 25 000 kr/month (1 Apr 2026 - 30 Sep 2027).
 *  - 10.21% (retirement pension contribution only) for employees who turned
 *    67 or older at the start of the year, from 1 Jan 2026.
 */
export const EMPLOYER_CONTRIBUTION_RATE = 0.3142;

/**
 * Ceiling for the state wage guarantee (lönegaranti) per employee: four price
 * base amounts, per Lönegarantilagen (1992:497) 9 §. The amount that applies
 * is the one in force when the bankruptcy or reconstruction decision is made.
 */
export const WAGE_GUARANTEE_CEILING = PRICE_BASE_AMOUNT * 4;

/** Maximum number of months the wage guarantee can cover. */
export const WAGE_GUARANTEE_MAX_MONTHS = 8;

/**
 * Minimum share capital for a private limited company.
 * 25 000 kr applies to companies formed on or after 1 Jan 2020; companies
 * formed before that date are still on the older 50 000 kr requirement.
 * Source: Bolagsverket.
 */
export const MIN_SHARE_CAPITAL = 25_000;
export const MIN_SHARE_CAPITAL_PRE_2020 = 50_000;

/* -------------------------------------------------------------------------- */
/* Bankruptcy statistics                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Most recent complete calendar year of Swedish bankruptcy statistics.
 *
 * Only quote a full year here. A part-year figure invites a comparison the
 * reader cannot make correctly, and bankruptcies are strongly seasonal.
 *
 * Source: Tillväxtanalys, the authority responsible for the official
 * statistics on "Konkurser och offentliga ackord".
 */
export const BANKRUPTCY_STATS = {
  year: 2025,
  companies: 10_731,
  employeesAffected: 24_882,
  /** The year before, for context. */
  previousYear: 2024,
  previousYearCompanies: 10_762,
  source: "Tillväxtanalys",
  sourceUrl:
    "https://www.tillvaxtanalys.se/statistik/konkurser/konkurserochoffentligaackord.html",
} as const;

/* -------------------------------------------------------------------------- */
/* Legal references                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Cited so the reader can look the rule up rather than take our word for it.
 * Include the SFS number: there are two laws named "lag om
 * företagsrekonstruktion", and the 1996 one was repealed on 1 August 2022.
 */
export const LEGAL_REFS = {
  /** Insolvency (obestånd) and the grounds for bankruptcy. */
  bankruptcy: "Konkurslagen (1987:672) 1 kap. 2 §",
  /** Recovery of payments made before the bankruptcy. */
  clawback: "Konkurslagen (1987:672) 4 kap.",
  /** The current reconstruction act; replaced lag (1996:764). */
  reconstruction: "Lagen (2022:964) om företagsrekonstruktion",
  /** Duty to draw up a control balance sheet, and the liability for not doing so. */
  controlBalanceSheet: "Aktiebolagslagen (2005:551) 25 kap. 13 och 18 §§",
  /** Personal liability of a representative for the company's unpaid tax. */
  representativeLiability: "Skatteförfarandelagen (2011:1244) 59 kap. 12–13 §§",
  /** The state wage guarantee. */
  wageGuarantee: "Lönegarantilagen (1992:497)",
} as const;

/* -------------------------------------------------------------------------- */
/* Formatting                                                                 */
/* -------------------------------------------------------------------------- */

/** Formats an amount in kronor the Swedish way, e.g. "236 800 kr". */
export const formatSek = (amount: number): string =>
  `${Math.round(amount).toLocaleString("sv-SE")} kr`;
