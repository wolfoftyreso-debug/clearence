/**
 * Assertions for the bank statement parser.
 *
 * These cover money and date handling on files the application cannot control
 * the shape of, so they are worth having even though the project carries no
 * test runner: `npm test` compiles this with esbuild and runs it under node.
 */

import {
  parseAmount,
  parseStatementDate,
  splitCsvLine,
  parseBankStatement,
  summariseStatement,
} from "../src/lib/bankStatement";

let pass = 0;
let fail = 0;
const eq = (name: string, actual: unknown, expected: unknown) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { pass++; }
  else { fail++; console.log(`FAIL ${name}\n  got      ${a}\n  expected ${e}`); }
};

// --- parseAmount ---
eq("plain", parseAmount("1234.56"), 1234.56);
eq("swedish", parseAmount("1 234,56"), 1234.56);
eq("nbsp", parseAmount("1 234,56"), 1234.56);
eq("dot-group", parseAmount("1.234,56"), 1234.56);
eq("us-group", parseAmount("1,234.56"), 1234.56);
eq("negative", parseAmount("-1 234,56"), -1234.56);
eq("unicode minus", parseAmount("−1 234,56"), -1234.56);
eq("trailing sign", parseAmount("1 234,56-"), -1234.56);
eq("parens", parseAmount("(1 234,56)"), -1234.56);
eq("kr suffix", parseAmount("1 234,56 kr"), 1234.56);
eq("plus", parseAmount("+500,00"), 500);
eq("integer thousands comma", parseAmount("1,234,567"), 1234567);
eq("bare comma decimals", parseAmount("1,50"), 1.5);
eq("empty", parseAmount("   "), null);
eq("text", parseAmount("Saldo"), null);
eq("zero", parseAmount("0,00"), 0);

// --- parseStatementDate ---
eq("iso", parseStatementDate("2024-01-15"), "2024-01-15");
eq("iso slash", parseStatementDate("2024/01/15"), "2024-01-15");
eq("iso with time", parseStatementDate("2024-01-15 00:00:00"), "2024-01-15");
eq("dmy dots", parseStatementDate("15.01.2024"), "2024-01-15");
eq("dmy ambiguous", parseStatementDate("05.01.2024"), "2024-01-05");
eq("dmy swapped", parseStatementDate("01/15/2024"), "2024-01-15");
eq("compact", parseStatementDate("240115"), "2024-01-15");
eq("invalid feb 30", parseStatementDate("2024-02-30"), null);
eq("leap day ok", parseStatementDate("2024-02-29"), "2024-02-29");
eq("non leap", parseStatementDate("2023-02-29"), null);
eq("junk", parseStatementDate("Bokföringsdag"), null);

// --- splitCsvLine ---
eq("quoted delim", splitCsvLine('a;"b;c";d', ";"), ["a", "b;c", "d"]);
eq("escaped quote", splitCsvLine('a;"say ""hi""";c', ";"), ["a", 'say "hi"', "c"]);

// --- SEB-style statement ---
const seb = [
  'Bokföringsdatum;Valutadatum;Verifikationsnummer;Text;Belopp;Saldo',
  '2024-01-25;2024-01-25;123;Löner januari;-185 000,00;315 000,00',
  '2024-01-12;2024-01-12;124;Skatteverket;-58 118,00;500 000,00',
  '2024-01-05;2024-01-05;125;Hyra lokal;-42 000,00;558 118,00',
  '2024-02-25;2024-02-25;126;Löner februari;-185 000,00;130 000,00',
  '2024-02-12;2024-02-12;127;Skatteverket;-58 118,00;315 000,00',
  '2024-02-05;2024-02-05;128;Hyra lokal;-42 000,00;373 000,00',
].join("\n");

const sebResult = parseBankStatement(seb);
eq("seb ok", sebResult.ok, true);
if (sebResult.ok) {
  eq("seb count", sebResult.statement.transactions.length, 6);
  eq("seb delimiter", sebResult.statement.delimiter, ";");
  eq("seb date col", sebResult.statement.columns.date, "Bokföringsdatum");
  eq("seb desc col", sebResult.statement.columns.description, "Text");
  eq("seb amount col", sebResult.statement.columns.amount, "Belopp");
  eq("seb balance col", sebResult.statement.columns.balance, "Saldo");
  eq("seb skipped", sebResult.statement.skipped.length, 0);

  const s = summariseStatement(sebResult.statement.transactions)!;
  eq("seb from", s.from, "2024-01-05");
  eq("seb to", s.to, "2024-02-25");
  eq("seb months", s.monthsCovered, 2);
  eq("seb totalOut", s.totalOut, 570236);
  eq("seb totalIn", s.totalIn, 0);
  // first sorted txn is 2024-01-05 hyra, balance 558118 after -42000 => opening 600118
  eq("seb opening", s.openingBalance, 600118);
  eq("seb closing", s.closingBalance, 130000);
  eq("seb recurring count", s.recurring.length, 3);
  eq("seb recurring top", s.recurring.map(r => [r.category, r.amount, r.dayOfMonth, r.months]),
     [["salary",185000,25,2],["tax",58118,12,2],["rent",42000,5,2]]);
}

// --- Swedbank-style, comma delimiter, preamble rows, quoted text ---
const swedbank = [
  'Kontoutdrag',
  'Konto:,1234-5 678 901 234',
  'Radnummer,Bokföringsdag,Transaktionsdag,Valutadag,Referens,Beskrivning,Belopp,Bokfört saldo',
  '1,2024-03-25,2024-03-25,2024-03-25,REF1,"LÖN, mars",-185000.00,120000.00',
  '2,2024-03-01,2024-03-01,2024-03-01,REF2,Kundinbetalning AB,95000.00,305000.00',
  '3,ogiltigt,2024-03-01,2024-03-01,REF3,Trasig rad,1000.00,0.00',
].join("\n");

const swed = parseBankStatement(swedbank);
eq("swedbank ok", swed.ok, true);
if (swed.ok) {
  eq("swedbank delimiter", swed.statement.delimiter, ",");
  eq("swedbank count", swed.statement.transactions.length, 2);
  eq("swedbank date col", swed.statement.columns.date, "Bokföringsdag");
  eq("swedbank desc col", swed.statement.columns.description, "Beskrivning");
  eq("swedbank quoted desc", swed.statement.transactions[0].description, "LÖN, mars");
  eq("swedbank skipped", swed.statement.skipped, [{ line: 6, reason: "Ogiltigt datum" }]);
}

// --- failure modes ---
eq("empty file", parseBankStatement("").ok, false);
eq("no header", parseBankStatement("hej\nsvejs\n").ok, false);
const headerOnly = parseBankStatement("Datum;Text;Belopp\n");
eq("header only", headerOnly.ok, false);

// --- recurring must not fire on a single month ---
const oneMonth = parseBankStatement([
  'Datum;Text;Belopp',
  '2024-01-25;Löner;-185000,00',
  '2024-01-26;Löner;-185000,00',
].join("\n"));
if (oneMonth.ok) {
  const s = summariseStatement(oneMonth.statement.transactions)!;
  eq("one month no recurring", s.recurring.length, 0);
  eq("no balance column", s.openingBalance, null);
}

// --- amounts too variable are not recurring ---
const variable = parseBankStatement([
  'Datum;Text;Belopp',
  '2024-01-15;Leverantör X;-10000,00',
  '2024-02-15;Leverantör X;-95000,00',
].join("\n"));
if (variable.ok) {
  const s = summariseStatement(variable.statement.transactions)!;
  eq("variable not recurring", s.recurring.length, 0);
}

// --- description varies only by digits => still grouped ---
const digits = parseBankStatement([
  'Datum;Text;Belopp',
  '2024-01-15;Faktura 1001 Elbolaget;-4000,00',
  '2024-02-15;Faktura 1042 Elbolaget;-4100,00',
].join("\n"));
if (digits.ok) {
  const s = summariseStatement(digits.statement.transactions)!;
  eq("digits normalised", s.recurring.length, 1);
  eq("digits label is raw", s.recurring[0]?.label, "Faktura 1042 Elbolaget");
  eq("digits category", s.recurring[0]?.category, "supplier");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
