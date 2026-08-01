/**
 * Import av skattekontoutdrag från Skatteverkets e-tjänst.
 *
 * Skattekontot är i praktiken krisens viktigaste enskilda datakälla: en
 * obetald skatteskuld på förfallodagen är det som utlöser företrädaransvaret
 * (SFL 59 kap.), och saldot avgör hur nära den klockan står. Idag skrivs
 * uppgifterna av för hand.
 *
 * Ingen API-koppling finns för den här nivån av åtkomst, och det är inte
 * flaskhalsen: e-tjänsten låter användaren exportera kontohändelserna som
 * fil. Den filen läses här - lokalt i webbläsaren, precis som kontoutdragen
 * i src/lib/bankStatement.ts, och ingenting skickas någonstans.
 *
 * ANTAGANDE, markerat även i integrationsregistret: formatet är avläst ur
 * e-tjänstens utdrag (semikolonseparerad text med rubrikrad, svensk
 * talformatering, datum som ÅÅÅÅ-MM-DD alternativt ÅÅMMDD). Skatteverket kan
 * ändra det utan förvarning, så parsern matchar RUBRIKER, inte
 * kolumnpositioner, och rapporterar varje rad den inte förstår i stället för
 * att gissa. En gissad skatterad är farligare än en saknad: beloppen här
 * styr bedömningen av personligt ansvar.
 */

export interface TaxAccountEntry {
  /** ISO-datum, yyyy-MM-dd. */
  date: string;
  /** Skatteverkets specifikationstext, t.ex. "Debiterad preliminärskatt". */
  specification: string;
  /** Positivt = kreditering (inbetalning/beslut till godo), negativt = debitering. */
  amount: number;
  /** Saldo efter händelsen, när utdraget innehåller det. */
  balance: number | null;
}

export interface ParsedTaxAccount {
  entries: TaxAccountEntry[];
  /** Sista kända saldot, den siffra likviditetsplanen behöver. */
  closingBalance: number | null;
  /** Summan av debiteringar med framtida datum = kommande förfall. */
  upcomingCharges: TaxAccountEntry[];
  skipped: { line: number; reason: string }[];
  /** Vilka rubriker fälten lästes ur, så användaren kan kontrollera. */
  columns: { date: string; specification: string; amount: string; balance: string | null };
}

export type TaxAccountOutcome =
  | { ok: true; account: ParsedTaxAccount }
  | { ok: false; error: string };

/* -------------------------------------------------------------------------- */

/** Rangordnade rubriknycklar, samma teknik som bankparsern. */
const DATE_KEYS = ["bokföringsdag", "bokforingsdag", "datum", "dag"];
const SPEC_KEYS = ["specifikation", "text", "händelse", "handelse", "beskrivning"];
const AMOUNT_KEYS = ["belopp", "summa"];
const BALANCE_KEYS = ["saldo", "ställning", "stallning"];

const normalise = (value: string): string =>
  value.toLowerCase().replace(/^\ufeff/, "").replace(/"/g, "").trim();

const findColumn = (headers: string[], keys: string[]): number => {
  for (const key of keys) {
    const exact = headers.findIndex((h) => h === key);
    if (exact !== -1) return exact;
  }
  for (const key of keys) {
    const partial = headers.findIndex((h) => h.includes(key));
    if (partial !== -1) return partial;
  }
  return -1;
};

/**
 * Svenska belopp: "1 234,56", "−1 234", "1.234,56 kr". Minustecknet kommer
 * i tre varianter (bindestreck, typografiskt minus, efterställt), och
 * tusentalsavgränsaren kan vara mellanslag, hårt mellanslag eller punkt.
 */
export const parseSwedishAmount = (raw: string): number | null => {
  let s = raw.replace(/["\s\u00a0\u202f]/g, "").replace(/kr$/i, "");
  if (s === "") return null;
  let negative = false;
  if (/^[-−–]/.test(s)) {
    negative = true;
    s = s.slice(1);
  }
  if (/[-−–]$/.test(s)) {
    negative = true;
    s = s.slice(0, -1);
  }
  // Punkt som tusentalsavgränsare bara när ett decimalkomma också finns -
  // annars är "1.5" en decimal.
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const value = Number(s);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
};

/** ÅÅÅÅ-MM-DD, ÅÅÅÅMMDD eller ÅÅMMDD till ISO. */
export const parseSwedishDate = (raw: string): string | null => {
  const s = raw.replace(/"/g, "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})(\d{2})(\d{2})$/);
  // ANTAGANDE: tvåsiffriga år är 20xx. Skattekontot fanns inte före 2000.
  if (m) return `20${m[1]}-${m[2]}-${m[3]}`;
  return null;
};

const pickDelimiter = (headerLine: string): string => {
  const semis = (headerLine.match(/;/g) ?? []).length;
  const tabs = (headerLine.match(/\t/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  if (semis >= tabs && semis >= commas) return ";";
  if (tabs >= commas) return "\t";
  return ",";
};

/**
 * @param text filens innehåll
 * @param today "idag" för klassning av kommande förfall - skickas in så att
 *              tester kan resa i tiden, samma princip som billing.ts
 */
export const parseTaxAccount = (text: string, today: Date): TaxAccountOutcome => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { ok: false, error: "Filen är tom." };

  // Rubrikraden är inte alltid rad ett: utdraget inleds ofta med
  // organisationsnummer och period. Leta efter första raden som innehåller
  // både en datumrubrik och en belopprubrik.
  let headerIndex = -1;
  let delimiter = ";";
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const d = pickDelimiter(lines[i]);
    const cells = lines[i].split(d).map(normalise);
    if (findColumn(cells, DATE_KEYS) !== -1 && findColumn(cells, AMOUNT_KEYS) !== -1) {
      headerIndex = i;
      delimiter = d;
      break;
    }
  }
  if (headerIndex === -1) {
    return {
      ok: false,
      error:
        "Hittade ingen rubrikrad med datum och belopp. Exportera skattekontots " +
        "kontohändelser från e-tjänsten och ladda upp filen oförändrad.",
    };
  }

  const headers = lines[headerIndex].split(delimiter).map(normalise);
  const dateCol = findColumn(headers, DATE_KEYS);
  const specCol = findColumn(headers, SPEC_KEYS);
  const amountCol = findColumn(headers, AMOUNT_KEYS);
  const balanceCol = findColumn(headers, BALANCE_KEYS);

  const entries: TaxAccountEntry[] = [];
  const skipped: { line: number; reason: string }[] = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const cells = lines[i].split(delimiter);
    const date = parseSwedishDate(cells[dateCol] ?? "");
    if (!date) {
      skipped.push({ line: i + 1, reason: "Ogiltigt eller saknat datum" });
      continue;
    }
    const amount = parseSwedishAmount(cells[amountCol] ?? "");
    if (amount === null) {
      skipped.push({ line: i + 1, reason: "Ogiltigt eller saknat belopp" });
      continue;
    }
    entries.push({
      date,
      specification: (cells[specCol] ?? "").replace(/"/g, "").trim() || "Okänd händelse",
      amount,
      balance: balanceCol === -1 ? null : parseSwedishAmount(cells[balanceCol] ?? ""),
    });
  }

  if (entries.length === 0) {
    return { ok: false, error: "Ingen rad i filen gick att tolka som en kontohändelse." };
  }

  entries.sort((a, b) => a.date.localeCompare(b.date));

  const todayIso = today.toISOString().slice(0, 10);
  const withBalance = [...entries].reverse().find((e) => e.balance !== null);

  return {
    ok: true,
    account: {
      entries,
      closingBalance: withBalance?.balance ?? null,
      // Debiteringar med framtida datum är kommande förfall - det är de
      // raderna som hör hemma i likviditetsplanen och fristbevakningen.
      upcomingCharges: entries.filter((e) => e.amount < 0 && e.date > todayIso),
      skipped,
      columns: {
        date: headers[dateCol],
        specification: specCol === -1 ? "" : headers[specCol],
        amount: headers[amountCol],
        balance: balanceCol === -1 ? null : headers[balanceCol],
      },
    },
  };
};
