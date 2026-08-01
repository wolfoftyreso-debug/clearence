/**
 * SIE-import: standardformatet varje svenskt bokföringsprogram exporterar.
 *
 * SIE typ 4 är filvägen till bokföringen som inte kräver något API-avtal:
 * Fortnox, Visma, Bokio, BL - alla har "exportera SIE" i menyn. Det här är
 * därför den första bokföringskopplingen som fungerar för alla kunder på
 * dag ett, och API-adaptrarna byggs sedan ovanpå samma resultat.
 *
 * Formatet (SIE-gruppens specifikation, rev. 4B):
 *   #FNAMN "Bolaget AB"          företagsnamn
 *   #ORGNR 556012-3456           organisationsnummer
 *   #RAR 0 20260101 20261231     räkenskapsår (0 = innevarande, -1 = förra)
 *   #KONTO 1930 "Företagskonto"  kontoplan
 *   #IB 0 1930 250000            ingående balans
 *   #UB 0 1930 -47000            utgående balans
 *   #RES 0 3010 -1200000         resultatkontots saldo
 *   #VER A 12 20260415 "Text"    verifikat, följt av { #TRANS ... }-block
 *
 * TECKENKODNINGEN är formatets försåtligaste egenskap: specifikationen
 * föreskriver IBM PC 8-bitars (CP437) - ett DOS-arv - medan vissa moderna
 * program exporterar UTF-8. Läses CP437 som UTF-8 blir "Företagskonto"
 * "F�retagskonto", och kontonamn är det användaren verifierar mappningen
 * mot. Därför avkodas bytes: giltig UTF-8 används som den är, annars
 * tillämpas CP437-tabellen.
 *
 * Beloppen i SIE är i kronor med punkt som decimaltecken (spec), inte
 * svensk formatering - en egen parser, inte parseSwedishAmount.
 *
 * Härledda nyckeltal (eget kapital, kassa) bygger på BAS-kontoplanens
 * intervall och är märkta ANTAGANDE i koden: BAS är konvention, inte lag,
 * och ett bolag med egen kontoplan kan avvika. Därför returneras alltid
 * kontona själva - siffran ska gå att kontrollera mot sin källa.
 */

export interface SieAccount {
  number: number;
  name: string;
  /** Utgående balans för valt räkenskapsår, i kronor. Null = ej angiven. */
  closingBalance: number | null;
  openingBalance: number | null;
  /** Saldo från #RES (resultatkonton), i kronor. */
  result: number | null;
}

export interface SieVerification {
  series: string;
  number: string;
  date: string; // ISO
  text: string;
  transactions: { account: number; amount: number }[];
}

export interface ParsedSie {
  companyName: string | null;
  orgNumber: string | null;
  /** Räkenskapsårets gränser för år 0, ISO. */
  fiscalYear: { start: string; end: string } | null;
  accounts: SieAccount[];
  verifications: SieVerification[];
  /** Rader som inte gick att tolka, med skäl. Rapporterade, aldrig gissade. */
  skipped: { line: number; reason: string }[];
  encoding: "utf-8" | "cp437";
}

export type SieOutcome = { ok: true; sie: ParsedSie } | { ok: false; error: string };

/* -------------------------------------------------------------------------- */
/* Teckenkodning                                                              */
/* -------------------------------------------------------------------------- */

/**
 * CP437:s övre halva (0x80-0xFF). Tabellen är hela poängen: webbläsarens
 * TextDecoder stödjer inte cp437, så mappningen måste ligga här.
 */
const CP437_HIGH =
  "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";

const decodeCp437 = (bytes: Uint8Array): string => {
  let out = "";
  for (const b of bytes) {
    out += b < 0x80 ? String.fromCharCode(b) : CP437_HIGH[b - 0x80];
  }
  return out;
};

export const decodeSieBytes = (bytes: Uint8Array): { text: string; encoding: "utf-8" | "cp437" } => {
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "utf-8" };
  } catch {
    return { text: decodeCp437(bytes), encoding: "cp437" };
  }
};

/* -------------------------------------------------------------------------- */
/* Radtolkning                                                                */
/* -------------------------------------------------------------------------- */

/**
 * SIE-rader är mellanslagsseparerade fält där citerade strängar kan
 * innehålla mellanslag: `#KONTO 1930 "Företagskonto SEB"`. En naiv split
 * klipper kontonamnet - därför en riktig tokeniserare.
 */
export const tokenizeSieLine = (line: string): string[] => {
  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') inQuotes = false;
      else current += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === " " || ch === "\t") {
      if (current !== "") {
        tokens.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current !== "") tokens.push(current);
  return tokens;
};

const sieDate = (raw: string): string | null => {
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

/** SIE-belopp: kronor med punktdecimal enligt spec. */
const sieAmount = (raw: string): number | null => {
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};

/* -------------------------------------------------------------------------- */
/* Parsern                                                                    */
/* -------------------------------------------------------------------------- */

export const parseSie = (bytes: Uint8Array): SieOutcome => {
  const { text, encoding } = decodeSieBytes(bytes);
  const lines = text.split(/\r?\n/);

  if (!lines.some((l) => l.trimStart().startsWith("#"))) {
    return {
      ok: false,
      error:
        "Filen ser inte ut som en SIE-fil (inga #-poster). Exportera med " +
        "'SIE 4' från bokföringsprogrammet och ladda upp filen oförändrad.",
    };
  }

  let companyName: string | null = null;
  let orgNumber: string | null = null;
  let fiscalYear: { start: string; end: string } | null = null;
  const accounts = new Map<number, SieAccount>();
  const verifications: SieVerification[] = [];
  const skipped: { line: number; reason: string }[] = [];

  const account = (num: number): SieAccount => {
    let a = accounts.get(num);
    if (!a) {
      a = { number: num, name: "", closingBalance: null, openingBalance: null, result: null };
      accounts.set(num, a);
    }
    return a;
  };

  let currentVer: SieVerification | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "" || line === "{") continue;
    if (line === "}") {
      if (currentVer) {
        verifications.push(currentVer);
        currentVer = null;
      }
      continue;
    }
    if (!line.startsWith("#")) continue;

    const tokens = tokenizeSieLine(line);
    const tag = tokens[0].toUpperCase();

    switch (tag) {
      case "#FNAMN":
        companyName = tokens[1] ?? null;
        break;
      case "#ORGNR":
        orgNumber = tokens[1] ?? null;
        break;
      case "#RAR": {
        // År 0 är det innevarande - tidigare år (-1, -2) läses inte in som
        // årets gränser.
        if (tokens[1] === "0") {
          const start = sieDate(tokens[2] ?? "");
          const end = sieDate(tokens[3] ?? "");
          if (start && end) fiscalYear = { start, end };
          else skipped.push({ line: i + 1, reason: "#RAR med ogiltiga datum" });
        }
        break;
      }
      case "#KONTO": {
        const num = Number(tokens[1]);
        if (!Number.isInteger(num)) {
          skipped.push({ line: i + 1, reason: "#KONTO utan kontonummer" });
          break;
        }
        account(num).name = tokens[2] ?? "";
        break;
      }
      case "#IB":
      case "#UB":
      case "#RES": {
        // Endast år 0. Fält: årsindex, konto, belopp.
        if (tokens[1] !== "0") break;
        const num = Number(tokens[2]);
        const amount = sieAmount(tokens[3] ?? "");
        if (!Number.isInteger(num) || amount === null) {
          skipped.push({ line: i + 1, reason: `${tag} med ogiltigt konto eller belopp` });
          break;
        }
        const a = account(num);
        if (tag === "#IB") a.openingBalance = amount;
        else if (tag === "#UB") a.closingBalance = amount;
        else a.result = amount;
        break;
      }
      case "#VER": {
        const date = sieDate(tokens[3] ?? "");
        if (!date) {
          skipped.push({ line: i + 1, reason: "#VER med ogiltigt datum" });
          break;
        }
        currentVer = {
          series: tokens[1] ?? "",
          number: tokens[2] ?? "",
          date,
          text: tokens[4] ?? "",
          transactions: [],
        };
        break;
      }
      case "#TRANS": {
        if (!currentVer) {
          skipped.push({ line: i + 1, reason: "#TRANS utanför verifikat" });
          break;
        }
        // Fält: konto, {objektlista}, belopp. Objektlistan är redan
        // borttokeniserad som "{...}" eller "{}" - beloppet är nästa
        // numeriska fält efter kontot.
        const num = Number(tokens[1]);
        const amountToken = tokens.find((t, idx) => idx >= 2 && !t.startsWith("{") && sieAmount(t) !== null);
        const amount = amountToken !== undefined ? sieAmount(amountToken) : null;
        if (!Number.isInteger(num) || amount === null) {
          skipped.push({ line: i + 1, reason: "#TRANS med ogiltigt konto eller belopp" });
          break;
        }
        currentVer.transactions.push({ account: num, amount });
        break;
      }
      default:
        // Okända poster (#GEN, #SIETYP, #DIM ...) är ofarliga och hoppas
        // över tyst - de är metadata, inte siffror.
        break;
    }
  }

  if (accounts.size === 0 && verifications.length === 0) {
    return { ok: false, error: "Filen innehöll varken kontosaldon eller verifikat." };
  }

  return {
    ok: true,
    sie: {
      companyName,
      orgNumber,
      fiscalYear,
      accounts: [...accounts.values()].sort((a, b) => a.number - b.number),
      verifications,
      skipped,
      encoding,
    },
  };
};

/* -------------------------------------------------------------------------- */
/* Härledda nyckeltal                                                         */
/* -------------------------------------------------------------------------- */

export interface SieSummary {
  /** Likvida medel: UB på 19xx. Positivt = pengar finns. */
  cash: number;
  /**
   * Eget kapital: UB på 2010-2099 plus årets resultat, tecknvänt (skulder
   * och eget kapital står i kredit i bokföringen).
   */
  equity: number;
  /** Aktiekapital: UB på konto 2081, tecknvänt. */
  shareCapital: number;
  /** Årets resultat enligt resultatkontona (3000-8999), tecknvänt: positivt = vinst. */
  result: number;
  /** Vilka konton som ingick, för kontroll mot källan. */
  accountsUsed: { cash: number[]; equity: number[]; shareCapital: number[] };
}

/**
 * ANTAGANDE: intervallen följer BAS-kontoplanen (19xx likvida medel,
 * 2010-2099 eget kapital, 2081 aktiekapital, 3000-8999 resultat). BAS är
 * konvention, inte lag - därför returneras kontonumren som användes, så att
 * siffran kan kontrolleras mot bokföringen i stället för att litas på blint.
 * Nyckeltalen är UNDERLAG till KBR-bedömningen, inte bedömningen själv.
 */
export const summariseSie = (sie: ParsedSie): SieSummary => {
  const used = { cash: [] as number[], equity: [] as number[], shareCapital: [] as number[] };
  let cash = 0;
  let equityCredit = 0;
  let shareCapitalCredit = 0;
  let resultCredit = 0;

  for (const a of sie.accounts) {
    if (a.number >= 1900 && a.number <= 1999 && a.closingBalance !== null) {
      cash += a.closingBalance;
      used.cash.push(a.number);
    }
    if (a.number >= 2010 && a.number <= 2099 && a.closingBalance !== null) {
      equityCredit += a.closingBalance;
      used.equity.push(a.number);
      if (a.number === 2081) {
        shareCapitalCredit += a.closingBalance;
        used.shareCapital.push(a.number);
      }
    }
    if (a.number >= 3000 && a.number <= 8999 && a.result !== null) {
      resultCredit += a.result;
    }
  }

  return {
    cash,
    // Kredit är negativt i SIE; tecknvänt så att "eget kapital 50 000" är
    // positivt när det finns.
    equity: -(equityCredit + resultCredit),
    shareCapital: -shareCapitalCredit,
    result: -resultCredit,
    accountsUsed: used,
  };
};
