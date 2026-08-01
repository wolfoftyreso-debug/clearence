/**
 * Parsing of bank statement exports (kontoutdrag).
 *
 * Swedish banks all export CSV, but none of them agree on the columns, the
 * delimiter, the number format or the text encoding. Rather than hard-code one
 * layout per bank - which breaks the moment a bank renames a column - this
 * resolves the columns by matching the header against ranked keyword lists.
 * That covers the common exports from Swedbank, SEB, Nordea, Handelsbanken and
 * Länsförsäkringar without knowing which one it is looking at.
 *
 * Everything here is pure and runs in the browser: an uploaded statement is
 * read and interpreted locally, and nothing is sent anywhere unless the user
 * separately chooses to save the file.
 */

export type StatementDirection = "in" | "out";

export interface BankTransaction {
  /** ISO date, yyyy-MM-dd */
  date: string;
  description: string;
  /** Negative for money leaving the account. */
  amount: number;
  /** Account balance after the transaction, when the export includes it. */
  balance: number | null;
}

export interface SkippedRow {
  /** 1-based line number in the uploaded file. */
  line: number;
  reason: string;
}

export interface ColumnMapping {
  date: string;
  description: string;
  amount: string;
  balance: string | null;
}

export interface ParsedStatement {
  transactions: BankTransaction[];
  /** Which header each field was read from, so the user can check the mapping. */
  columns: ColumnMapping;
  delimiter: string;
  skipped: SkippedRow[];
}

export type ParseOutcome =
  | { ok: true; statement: ParsedStatement }
  | { ok: false; error: string };

/* -------------------------------------------------------------------------- */
/* Text decoding                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Bank exports are about as likely to be Windows-1252 as UTF-8, and decoding
 * the wrong one turns every "å ä ö" into replacement characters. Try UTF-8
 * strictly first; fall back to Windows-1252 when it is not valid UTF-8.
 */
export const decodeStatementBytes = (bytes: ArrayBuffer): string => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
};

/* -------------------------------------------------------------------------- */
/* CSV tokenising                                                             */
/* -------------------------------------------------------------------------- */

const DELIMITERS = [";", ",", "\t", "|"] as const;

/** Splits one CSV line, honouring double-quoted fields and "" escapes. */
export const splitCsvLine = (line: string, delimiter: string): string[] => {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
};

/** Picks the delimiter that yields the most columns on the candidate header. */
const detectDelimiter = (line: string): string => {
  let best = ";";
  let bestCount = 0;

  for (const delimiter of DELIMITERS) {
    const count = splitCsvLine(line, delimiter).length;
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }

  return best;
};

/* -------------------------------------------------------------------------- */
/* Value parsing                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Parses the amount formats that turn up in Swedish exports: "1 234,56",
 * "1.234,56", "1234.56", "-1 234,56", "1 234,56-" (trailing sign) and
 * "(1 234,56)". Non-breaking spaces are common and are treated as separators.
 * Returns null when the cell is not a number at all.
 */
export const parseAmount = (raw: string): number | null => {
  let value = raw.trim();
  if (!value) return null;

  let negative = false;

  // Accounting-style parentheses.
  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1);
  }

  // Trailing sign, as used by some ledger exports.
  if (value.endsWith("-")) {
    negative = true;
    value = value.slice(0, -1);
  }

  // Strip currency codes, symbols, and all flavours of space.
  value = value
    .replace(/\u2212/g, "-") // unicode minus
    .replace(/[\s\u00a0\u202f]/g, "")
    .replace(/(?:kr|sek|:-)/gi, "");

  if (value.startsWith("-")) {
    negative = true;
    value = value.slice(1);
  } else if (value.startsWith("+")) {
    value = value.slice(1);
  }

  if (!value) return null;

  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    // Whichever comes last is the decimal separator; the other groups digits.
    if (lastComma > lastDot) {
      value = value.replace(/\./g, "").replace(",", ".");
    } else {
      value = value.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    // A single comma is a decimal separator unless it groups exactly three
    // trailing digits with more than one group ("1,234,567").
    const decimals = value.length - lastComma - 1;
    value = decimals === 3 && value.split(",").length > 2
      ? value.replace(/,/g, "")
      : value.replace(",", ".");
  } else if (lastDot >= 0) {
    const decimals = value.length - lastDot - 1;
    if (decimals === 3 && value.split(".").length > 2) {
      value = value.replace(/\./g, "");
    }
  }

  if (!/^\d*\.?\d+$/.test(value)) return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;

  return negative ? -parsed : parsed;
};

const isValidYmd = (year: number, month: number, day: number): boolean => {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
};

const toIso = (year: number, month: number, day: number): string =>
  `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/**
 * Parses the date formats banks export: 2024-01-15, 2024/01/15, 15.01.2024,
 * 240115, optionally followed by a time. Ambiguous day/month order is only
 * resolved when one of the two values is above 12; otherwise the leading
 * value is taken as the day, which is the Swedish convention.
 */
export const parseStatementDate = (raw: string): string | null => {
  const value = raw.trim().split(/[T ]/)[0];
  if (!value) return null;

  const iso = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    return isValidYmd(year, month, day) ? toIso(year, month, day) : null;
  }

  const dmy = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    const [, a, b, y] = dmy;
    const year = Number(y);
    let day = Number(a);
    let month = Number(b);
    if (day <= 12 && month > 12) {
      [day, month] = [month, day];
    }
    return isValidYmd(year, month, day) ? toIso(year, month, day) : null;
  }

  const compact = value.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (compact) {
    const [, y, m, d] = compact;
    // Statements are historical documents; a two-digit year is this century.
    const year = 2000 + Number(y);
    const month = Number(m);
    const day = Number(d);
    return isValidYmd(year, month, day) ? toIso(year, month, day) : null;
  }

  return null;
};

/* -------------------------------------------------------------------------- */
/* Column resolution                                                          */
/* -------------------------------------------------------------------------- */

const normaliseHeader = (header: string): string =>
  header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

/**
 * Ranked candidates, most specific first. "bokforingsdag" beats a bare
 * "datum", and "valutadag" is last because it is the settlement date rather
 * than the date the money moved.
 */
const HEADER_CANDIDATES = {
  date: [
    "bokforingsdag",
    "bokforingsdatum",
    "transaktionsdag",
    "transaktionsdatum",
    "reskontradatum",
    "bookingdate",
    "datum",
    "date",
    "valutadag",
    "valutadatum",
  ],
  description: [
    "beskrivning",
    "rubrik",
    "text",
    "meddelande",
    "narrative",
    "description",
    "referens",
    "reference",
    "mottagare",
    "avsandare",
    "namn",
    "motpart",
    "payee",
  ],
  amount: ["belopp", "amount", "summa", "transaktionsbelopp", "value"],
  balance: ["bokfortsaldo", "saldo", "balance", "bokfortsaldoefter"],
} as const;

const resolveColumn = (
  headers: string[],
  candidates: readonly string[],
): number => {
  const normalised = headers.map(normaliseHeader);

  // Exact match on the highest-ranked candidate wins.
  for (const candidate of candidates) {
    const index = normalised.indexOf(candidate);
    if (index >= 0) return index;
  }

  // Then a containment match, still in candidate rank order.
  for (const candidate of candidates) {
    const index = normalised.findIndex((header) => header.includes(candidate));
    if (index >= 0) return index;
  }

  return -1;
};

/* -------------------------------------------------------------------------- */
/* Parsing                                                                    */
/* -------------------------------------------------------------------------- */

const MAX_ROWS = 20000;

/**
 * Reads a bank statement CSV. Returns a message rather than throwing when the
 * file cannot be interpreted - the caller shows it to the user, who then has
 * the option of entering the figures by hand.
 */
export const parseBankStatement = (text: string): ParseOutcome => {
  const lines = text
    .split(/\r\n|\n|\r/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return {
      ok: false,
      error: "Filen innehåller inga rader att läsa. Kontrollera att du laddat upp ett CSV-utdrag.",
    };
  }

  // Banks put account details above the table, so look for the header row
  // rather than assuming it is first.
  let headerIndex = -1;
  let delimiter = ";";
  let headers: string[] = [];

  for (let i = 0; i < Math.min(lines.length, 25); i += 1) {
    const candidateDelimiter = detectDelimiter(lines[i]);
    const cells = splitCsvLine(lines[i], candidateDelimiter);
    if (cells.length < 2) continue;

    const dateIndex = resolveColumn(cells, HEADER_CANDIDATES.date);
    const amountIndex = resolveColumn(cells, HEADER_CANDIDATES.amount);
    if (dateIndex >= 0 && amountIndex >= 0) {
      headerIndex = i;
      delimiter = candidateDelimiter;
      headers = cells;
      break;
    }
  }

  if (headerIndex < 0) {
    return {
      ok: false,
      error:
        "Kunde inte hitta en rubrikrad med datum och belopp. Exportera kontoutdraget som CSV från din bank och försök igen.",
    };
  }

  const dateIndex = resolveColumn(headers, HEADER_CANDIDATES.date);
  const amountIndex = resolveColumn(headers, HEADER_CANDIDATES.amount);
  const balanceIndex = resolveColumn(headers, HEADER_CANDIDATES.balance);
  let descriptionIndex = resolveColumn(headers, HEADER_CANDIDATES.description);

  // Never read the description out of a column already used for something
  // else - "Referens" and "Belopp" can both match loosely.
  if (
    descriptionIndex === dateIndex ||
    descriptionIndex === amountIndex ||
    descriptionIndex === balanceIndex
  ) {
    descriptionIndex = -1;
  }

  const transactions: BankTransaction[] = [];
  const skipped: SkippedRow[] = [];

  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    if (transactions.length >= MAX_ROWS) {
      skipped.push({
        line: i + 1,
        reason: `Filen är längre än ${MAX_ROWS} rader – resten lästes inte in.`,
      });
      break;
    }

    const cells = splitCsvLine(lines[i], delimiter);
    const date = parseStatementDate(cells[dateIndex] ?? "");
    if (!date) {
      skipped.push({ line: i + 1, reason: "Ogiltigt datum" });
      continue;
    }

    const amount = parseAmount(cells[amountIndex] ?? "");
    if (amount === null) {
      skipped.push({ line: i + 1, reason: "Ogiltigt belopp" });
      continue;
    }

    const balance = balanceIndex >= 0 ? parseAmount(cells[balanceIndex] ?? "") : null;
    const description =
      descriptionIndex >= 0 ? (cells[descriptionIndex] ?? "").trim() : "";

    transactions.push({
      date,
      description: description || "Ingen beskrivning",
      amount,
      balance,
    });
  }

  if (transactions.length === 0) {
    return {
      ok: false,
      error:
        "Rubrikraden hittades men ingen rad kunde läsas som en transaktion. Kontrollera att filen inte är tom eller filtrerad.",
    };
  }

  return {
    ok: true,
    statement: {
      transactions,
      columns: {
        date: headers[dateIndex],
        description: descriptionIndex >= 0 ? headers[descriptionIndex] : "(ingen)",
        amount: headers[amountIndex],
        balance: balanceIndex >= 0 ? headers[balanceIndex] : null,
      },
      delimiter,
      skipped,
    },
  };
};

/* -------------------------------------------------------------------------- */
/* Summary and recurring-payment detection                                    */
/* -------------------------------------------------------------------------- */

export type SuggestedCategory =
  | "salary"
  | "tax"
  | "rent"
  | "loan"
  | "supplier"
  | "income"
  | "other";

export interface RecurringSuggestion {
  label: string;
  /** Positive magnitude; use `direction` for the sign. */
  amount: number;
  direction: StatementDirection;
  /** Typical day of the month the transaction lands on. */
  dayOfMonth: number;
  /** How many distinct months it appeared in. */
  months: number;
  category: SuggestedCategory;
}

export interface StatementSummary {
  /** ISO date of the earliest transaction. */
  from: string;
  /** ISO date of the latest transaction. */
  to: string;
  transactionCount: number;
  /** Balance before the first transaction, when the export includes balances. */
  openingBalance: number | null;
  /** Balance after the last transaction, when the export includes balances. */
  closingBalance: number | null;
  totalIn: number;
  totalOut: number;
  /** Distinct calendar months covered by the statement. */
  monthsCovered: number;
  recurring: RecurringSuggestion[];
}

const CATEGORY_KEYWORDS: { category: SuggestedCategory; patterns: RegExp }[] = [
  { category: "salary", patterns: /\b(lon|loner|lonekorning|salary|payroll)\b/ },
  {
    category: "tax",
    patterns: /(skatteverket|skattekonto|moms|arbetsgivaravgift|preliminarskatt|f-skatt|fskatt|arbetsgivardeklaration)/,
  },
  { category: "rent", patterns: /(hyra|lokalhyra|hyresavi|fastighet)/ },
  {
    category: "loan",
    patterns: /(amortering|ranta|lan\b|leasing|kredit|avbetalning)/,
  },
];

/**
 * Month names and periods, stripped before grouping. Without this, "L\u00f6ner
 * januari" and "L\u00f6ner februari" are two different payments and the salary
 * run - usually the largest recurring cost in the statement - is never
 * detected. Short forms are included because banks truncate descriptions.
 */
const PERIOD_WORDS =
  /\b(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|okt|nov|dec|kvartal|kv|vecka|manad|halvar|ar)\b/g;

/** Strips the parts of a bank description that change every month. */
const normaliseDescription = (description: string): string =>
  description
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\d/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(PERIOD_WORDS, " ")
    .replace(/\s+/g, " ")
    .trim();

const guessCategory = (
  description: string,
  direction: StatementDirection,
): SuggestedCategory => {
  if (direction === "in") return "income";

  const normalised = normaliseDescription(description);
  for (const { category, patterns } of CATEGORY_KEYWORDS) {
    if (patterns.test(normalised)) return category;
  }

  return "supplier";
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

/** How far an individual amount may deviate from the group median. */
const AMOUNT_TOLERANCE = 0.25;

/**
 * Summarises a statement and proposes which payments look recurring, so the
 * liquidity plan can be pre-filled instead of typed from scratch.
 *
 * A payment counts as recurring when the same normalised description appears
 * in at least two different calendar months with amounts within 25% of the
 * median. That is deliberately conservative: a wrong suggestion the user has
 * to notice and delete is worse than a missing one they add themselves.
 */
export const summariseStatement = (
  transactions: BankTransaction[],
): StatementSummary | null => {
  if (transactions.length === 0) return null;

  const sorted = [...transactions].sort((a, b) =>
    a.date === b.date ? 0 : a.date < b.date ? -1 : 1,
  );

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const totalIn = sorted
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  const totalOut = sorted
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum - t.amount, 0);

  const months = new Set(sorted.map((t) => t.date.slice(0, 7)));

  // The opening balance is the balance after the first transaction, less that
  // transaction - the export only records balances after each movement.
  const openingBalance =
    first.balance === null ? null : first.balance - first.amount;

  // Group by normalised description and direction.
  const groups = new Map<string, BankTransaction[]>();
  for (const transaction of sorted) {
    const key = `${transaction.amount < 0 ? "out" : "in"}|${normaliseDescription(
      transaction.description,
    )}`;
    if (!key.endsWith("|")) {
      const existing = groups.get(key);
      if (existing) existing.push(transaction);
      else groups.set(key, [transaction]);
    }
  }

  const recurring: RecurringSuggestion[] = [];

  for (const group of groups.values()) {
    const groupMonths = new Set(group.map((t) => t.date.slice(0, 7)));
    if (groupMonths.size < 2) continue;

    const magnitudes = group.map((t) => Math.abs(t.amount));
    const typical = median(magnitudes);
    if (typical <= 0) continue;

    const consistent = magnitudes.every(
      (value) => Math.abs(value - typical) <= typical * AMOUNT_TOLERANCE,
    );
    if (!consistent) continue;

    const direction: StatementDirection = group[0].amount < 0 ? "out" : "in";
    const dayOfMonth = Math.round(
      median(group.map((t) => Number(t.date.slice(8, 10)))),
    );

    recurring.push({
      // Show the description as the bank wrote it, not the normalised key.
      label: group[group.length - 1].description,
      amount: Math.round(typical),
      direction,
      dayOfMonth: Math.min(Math.max(dayOfMonth, 1), 31),
      months: groupMonths.size,
      category: guessCategory(group[0].description, direction),
    });
  }

  recurring.sort((a, b) => b.amount - a.amount);

  return {
    from: first.date,
    to: last.date,
    transactionCount: sorted.length,
    openingBalance,
    closingBalance: last.balance,
    totalIn: Math.round(totalIn),
    totalOut: Math.round(totalOut),
    monthsCovered: months.size,
    recurring,
  };
};
