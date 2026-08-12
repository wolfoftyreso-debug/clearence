/**
 * BOKFÖRINGSFILEN BLIR EN LÄGESBILD.
 *
 * `FinancialSnapshot` (model.ts) och analysmotorn (insights.ts) har funnits
 * hela tiden. Det som saknades var något som FYLLDE dem: `getLatestSnapshot`
 * returnerade `null` rakt av, med kommentaren att ingen bokföringsadapter var
 * driftsatt. Följden var att översiktens insiktslista var permanent tom i
 * skarp drift - motorn fanns, men fick aldrig något att räkna på.
 *
 * SIE-filen är den bokföringsadaptern. Varje svenskt bokföringsprogram
 * exporterar SIE, den ligger redan i produkten (`sie.ts`, med egen svit), och
 * den kräver ingen leverantörsintegration, ingen API-nyckel och inget avtal.
 *
 * Den här modulen är översättningen, och bara den: in kommer `ParsedSie`, ut
 * kommer en `FinancialSnapshot`. Ingen I/O, inga beroenden - därför går den
 * att köra i webbläsaren, i API:t och i ett test.
 *
 * TVÅ REGLER STYR ÖVERSÄTTNINGEN.
 *
 * 1. INGET GISSAS. Det SIE-filen inte säger blir en rad i `gaps` med ett
 *    läsbart skäl, inte en nolla. En nolla ser ut som ett svar; en lucka ser
 *    ut som en lucka. I ett insolvensunderlag är skillnaden avgörande - "du
 *    har inga skulder" och "vi vet inte vad du har för skulder" leder till
 *    olika beslut.
 *
 * 2. VARJE SIFFRA BÄR SITT URSPRUNG. `Provenance` sätts vid översättningen,
 *    inte i efterhand: filnamn, tidpunkt och vilket verifikat siffran kom
 *    ifrån. Det som visas för en bank eller en rekonstruktör ska gå att spåra
 *    tillbaka till en rad i bokföringen.
 *
 * TECKENKONVENTIONEN är bokföringens: tillgångar och kostnader i debet
 * (positiva), skulder, eget kapital och intäkter i kredit (negativa). Det som
 * VISAS vänds till det en människa förväntar sig - "skulder: 1 200 000", inte
 * "-1 200 000" - och det är därför vändningen görs här, en gång, i stället
 * för i varje vy.
 */

import type {
  Account,
  AccountBalance,
  AccountType,
  BalanceSheet,
  FinancialDataset,
  FinancialSnapshot,
  IncomeStatement,
  Provenance,
  Voucher,
} from "./model";
import type { ParsedSie, SieAccount } from "./sie";

/**
 * BAS-kontoplanens intervall.
 *
 * BAS är konvention, inte lag. Ett bolag kan ha en egen kontoplan, och då
 * blir klassningen fel. Därför följer kontonumret med varje rad hela vägen
 * ut i vyn: siffran går att kontrollera mot bokföringen i stället för att
 * litas på blint. Samma antagande, och samma reservation, som summariseSie().
 */
const kontotyp = (nummer: number): AccountType => {
  if (nummer >= 1000 && nummer <= 1999) return "asset";
  if (nummer >= 2000 && nummer <= 2099) return "equity";
  if (nummer >= 2100 && nummer <= 2999) return "liability";
  if (nummer >= 3000 && nummer <= 3999) return "income";
  // 4000-8999 är kostnader och finansiella poster. 8xxx bär även skatt och
  // årets resultat, men de är kostnadssidan i den här grovindelningen.
  return "expense";
};

/** Likvida medel: 19xx enligt BAS. Kassa och bank. */
const arLikvidkonto = (nummer: number): boolean => nummer >= 1900 && nummer <= 1999;

/**
 * Utgående balans, eller null.
 *
 * `closingBalance` är balansräkningens post; `result` är resultatkontots.
 * Ett konto som saknar båda har inte förekommit i filens #UB/#RES - det är
 * en lucka, inte en nolla, och returneras som null.
 */
const utgaende = (konto: SieAccount): number | null => {
  if (konto.closingBalance !== null) return konto.closingBalance;
  if (konto.result !== null) return konto.result;
  return null;
};

const proveniens = (filnamn: string, tidpunkt: string, sourceRef: string | null): Provenance => ({
  origin: { kind: "accounting", provider: "generic", endpoint: `sie:${filnamn}` },
  fetchedAt: tidpunkt,
  sourceRef,
});

export interface SieSnapshotInput {
  /** Filnamnet som laddades upp. Följer med i varje siffras proveniens. */
  fileName: string;
  /** ISO-tidpunkt för när filen lästes. Skickas in, aldrig hämtad ur klockan. */
  capturedAt: string;
}

/**
 * Översätter en tolkad SIE-fil till en lägesbild.
 *
 * `capturedAt` skickas in i stället för att läsas ur `Date.now()`: en ren
 * funktion går att pröva, en som frågar klockan gör det inte.
 */
export const snapshotFromSie = (
  sie: ParsedSie,
  input: SieSnapshotInput,
): FinancialSnapshot => {
  const { fileName, capturedAt } = input;
  const gaps: { dataset: FinancialDataset; reason: string }[] = [];

  /* --- Kontoplanen ------------------------------------------------------- */

  const chartOfAccounts: Account[] = sie.accounts.map((k) => ({
    number: String(k.number),
    name: k.name,
    type: kontotyp(k.number),
    isCashAccount: arLikvidkonto(k.number),
    vatCode: null,
  }));

  if (chartOfAccounts.length === 0) {
    gaps.push({
      dataset: "chartOfAccounts",
      reason: "Filen innehöll inga #KONTO-rader.",
    });
  }

  /* --- Balansräkningen --------------------------------------------------- */

  const balansPoster: AccountBalance[] = [];
  let totalAssets = 0;
  let totalLiabilitiesCredit = 0;
  let equityCredit = 0;

  for (const konto of sie.accounts) {
    const typ = kontotyp(konto.number);
    if (typ !== "asset" && typ !== "liability" && typ !== "equity") continue;
    const ub = konto.closingBalance;
    if (ub === null) continue;

    balansPoster.push({
      accountNumber: String(konto.number),
      accountName: konto.name,
      type: typ,
      balance: ub,
      previousBalance: konto.openingBalance,
    });

    if (typ === "asset") totalAssets += ub;
    // Skulder och eget kapital står i kredit, alltså negativt i filen. De
    // vänds här - en gång - så att vyerna slipper göra det var för sig.
    else if (typ === "liability") totalLiabilitiesCredit += ub;
    else equityCredit += ub;
  }

  const balansProveniens = proveniens(fileName, capturedAt, "#UB");
  const balanceSheet: BalanceSheet | undefined =
    balansPoster.length === 0
      ? undefined
      : {
          asOf: sie.fiscalYear?.end ?? capturedAt.slice(0, 10),
          accounts: balansPoster,
          totalAssets,
          totalLiabilities: -totalLiabilitiesCredit,
          equity: -equityCredit,
          provenance: balansProveniens,
        };

  if (!balanceSheet) {
    gaps.push({
      dataset: "balanceSheet",
      reason: "Filen saknade utgående balanser (#UB) för balanskontona.",
    });
  }
  if (!sie.fiscalYear) {
    gaps.push({
      dataset: "balanceSheet",
      reason:
        "Filen angav inget räkenskapsår (#RAR). Balansdagen är satt till importdagen och bör kontrolleras.",
    });
  }

  /* --- Resultaträkningen -------------------------------------------------- */

  const resultatPoster: AccountBalance[] = [];
  let intaktKredit = 0;
  let kostnadDebet = 0;

  for (const konto of sie.accounts) {
    const typ = kontotyp(konto.number);
    if (typ !== "income" && typ !== "expense") continue;
    const saldo = utgaende(konto);
    if (saldo === null) continue;

    resultatPoster.push({
      accountNumber: String(konto.number),
      accountName: konto.name,
      type: typ,
      balance: saldo,
      previousBalance: null,
    });

    if (typ === "income") intaktKredit += saldo;
    else kostnadDebet += saldo;
  }

  const incomeStatement: IncomeStatement | undefined =
    resultatPoster.length === 0
      ? undefined
      : {
          from: sie.fiscalYear?.start ?? capturedAt.slice(0, 10),
          to: sie.fiscalYear?.end ?? capturedAt.slice(0, 10),
          accounts: resultatPoster,
          // Intäkter står i kredit; vänds till det en människa läser som omsättning.
          revenue: -intaktKredit,
          operatingExpenses: kostnadDebet,
          // Positivt = vinst.
          result: -intaktKredit - kostnadDebet,
          provenance: proveniens(fileName, capturedAt, "#RES"),
        };

  if (!incomeStatement) {
    gaps.push({
      dataset: "incomeStatement",
      reason: "Filen saknade resultatposter (#RES) för resultatkontona.",
    });
  }

  /* --- Verifikaten -------------------------------------------------------- */

  const vouchers: Voucher[] = sie.verifications.map((v) => ({
    id: `${v.series}${v.number}`,
    series: v.series || null,
    number: v.number || null,
    date: v.date,
    description: v.text || null,
    rows: v.transactions.map((t) => ({
      accountNumber: String(t.account),
      amount: t.amount,
      description: null,
    })),
    provenance: proveniens(fileName, capturedAt, `#VER ${v.series} ${v.number}`),
  }));

  if (vouchers.length === 0) {
    gaps.push({
      dataset: "vouchers",
      reason:
        "Filen innehöll inga verifikat (#VER). En balansfil (SIE typ 1-3) bär bara saldon; verifikat kräver typ 4.",
    });
  }

  /*
   * DET SIE INTE BÄR, sagt rakt ut.
   *
   * En SIE-fil är bokföringen, inte hela bilden. Motparter med kontaktuppgifter,
   * obetalda poster med förfallodag, banksaldon i realtid, skattekontots
   * ställning och lönekörningen finns inte i den - och den som ser en tom
   * lista ska veta om det är för att posten saknas eller för att vi aldrig
   * hade källan.
   */
  const UTANFOR_SIE: { dataset: FinancialDataset; reason: string }[] = [
    { dataset: "counterparties", reason: "SIE bär inte kund- och leverantörsregister med kontaktuppgifter." },
    { dataset: "openItems", reason: "SIE bär inte obetalda poster med förfallodag. Ladda upp kontoutdrag eller anslut bokföringssystemet." },
    { dataset: "bankAccounts", reason: "SIE bär bokförda saldon, inte bankens aktuella ställning." },
    { dataset: "taxAccount", reason: "Skattekontots ställning hämtas från Skatteverket, inte ur bokföringen." },
    { dataset: "payroll", reason: "SIE bär lönekostnaden som konto, inte lönekörningen per anställd." },
  ];
  gaps.push(...UTANFOR_SIE);

  /* --- Rader filen själv inte kunde tolka --------------------------------- */

  // parseSie rapporterar överhoppade rader i stället för att tiga om dem.
  // De följer med hit, så att den som läser lägesbilden ser att källan var
  // ofullständig - inte bara att en siffra ser låg ut.
  for (const rad of sie.skipped.slice(0, 20)) {
    gaps.push({
      dataset: "chartOfAccounts",
      reason: `Rad ${rad.line} kunde inte tolkas: ${rad.reason}`,
    });
  }
  if (sie.skipped.length > 20) {
    gaps.push({
      dataset: "chartOfAccounts",
      reason: `Ytterligare ${sie.skipped.length - 20} rader kunde inte tolkas.`,
    });
  }

  return {
    id: `sie:${capturedAt}`,
    provider: "generic",
    capturedAt,
    orgNumber: sie.orgNumber,
    companyName: sie.companyName,
    chartOfAccounts: chartOfAccounts.length > 0 ? chartOfAccounts : undefined,
    balanceSheet,
    incomeStatement,
    vouchers: vouchers.length > 0 ? vouchers : undefined,
    gaps,
  };
};
