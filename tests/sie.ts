/**
 * Tester för SIE-importen.
 *
 * Kodningen testas hårdast: SIE:s DOS-arv (CP437) är exakt den sortens fel
 * som ser ut att fungera - siffrorna blir rätt, bara kontonamnen blir
 * skräp - och kontonamnen är det användaren verifierar mappningen mot.
 */

import { decodeSieBytes, parseSie, summariseSie, tokenizeSieLine } from "../src/lib/financial/sie";

let passed = 0;
let failed = 0;
const check = (name: string, actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${name}\n     fick      ${JSON.stringify(actual)}\n     förväntat ${JSON.stringify(expected)}`);
  }
};

const utf8 = (s: string) => new TextEncoder().encode(s);

/* -------------------------------------------------------------------------- */
/* Tokenisering                                                               */
/* -------------------------------------------------------------------------- */

check(
  "citerad sträng med mellanslag hålls ihop",
  tokenizeSieLine('#KONTO 1930 "Företagskonto SEB"'),
  ["#KONTO", "1930", "Företagskonto SEB"],
);
check("tomt objektfält", tokenizeSieLine("#TRANS 1930 {} -1000"), ["#TRANS", "1930", "{}", "-1000"]);
check("tabbar som avgränsare", tokenizeSieLine("#UB\t0\t1930\t250000"), ["#UB", "0", "1930", "250000"]);

/* -------------------------------------------------------------------------- */
/* Teckenkodning                                                              */
/* -------------------------------------------------------------------------- */

check("giltig UTF-8 används rakt av", decodeSieBytes(utf8("Företagskonto")).encoding, "utf-8");

// "Företagskonto" i CP437: F=0x46, ö=0x94, r=0x72 ... å=0x86, ä=0x84.
const cp437Bytes = new Uint8Array([0x46, 0x94, 0x72, 0x65, 0x74, 0x61, 0x67]);
const decoded = decodeSieBytes(cp437Bytes);
check("ogiltig UTF-8 faller till CP437", decoded.encoding, "cp437");
check("CP437 ö avkodas rätt", decoded.text, "Företag");

/* -------------------------------------------------------------------------- */
/* Hel fil                                                                    */
/* -------------------------------------------------------------------------- */

const SIE = [
  "#FLAGGA 0",
  "#SIETYP 4",
  '#FNAMN "Exempelbolaget AB"',
  "#ORGNR 556012-3456",
  "#RAR 0 20260101 20261231",
  "#RAR -1 20250101 20251231",
  '#KONTO 1930 "Företagskonto"',
  '#KONTO 2081 "Aktiekapital"',
  '#KONTO 2091 "Balanserad vinst"',
  '#KONTO 3010 "Försäljning"',
  "#IB 0 1930 250000",
  "#UB 0 1930 -47000",
  "#UB 0 2081 -50000",
  "#UB 0 2091 -10000",
  "#UB -1 1930 250000",
  "#RES 0 3010 -1200000",
  "#RES 0 7010 1150000",
  '#VER A 12 20260415 "Hyra april"',
  "{",
  "#TRANS 5010 {} 25000",
  "#TRANS 1930 {} -25000",
  "}",
  "#TRANS 9999 {} 1",
  "detta är skräp utan brädgård",
].join("\n");

const outcome = parseSie(utf8(SIE));
if (!outcome.ok) {
  failed += 1;
  console.log("FAIL SIE-filen gick inte att tolka:", outcome.error);
} else {
  const sie = outcome.sie;
  check("företagsnamn", sie.companyName, "Exempelbolaget AB");
  check("orgnr", sie.orgNumber, "556012-3456");
  check("räkenskapsår 0, inte -1", sie.fiscalYear, { start: "2026-01-01", end: "2026-12-31" });
  check("UB för år -1 läses inte", sie.accounts.find((a) => a.number === 1930)?.closingBalance, -47000);
  check("IB läses", sie.accounts.find((a) => a.number === 1930)?.openingBalance, 250000);
  check("kontonamn med citat", sie.accounts.find((a) => a.number === 1930)?.name, "Företagskonto");
  check("verifikatet fångas", sie.verifications.length, 1);
  check("verifikatets datum", sie.verifications[0].date, "2026-04-15");
  check(
    "verifikatets transaktioner",
    sie.verifications[0].transactions,
    [{ account: 5010, amount: 25000 }, { account: 1930, amount: -25000 }],
  );
  check("#TRANS utanför verifikat rapporteras", sie.skipped.some((s) => s.reason.includes("utanför")), true);

  const summary = summariseSie(sie);
  check("kassa = UB 19xx", summary.cash, -47000);
  // Eget kapital: -(UB 2081 + UB 2091 + årets resultat) = -(-50000 - 10000 + (-1200000 + 1150000)) = 110000
  check("eget kapital tecknvänt inkl. resultat", summary.equity, 110000);
  check("aktiekapital från 2081", summary.shareCapital, 50000);
  check("årets resultat tecknvänt (vinst positiv)", summary.result, 50000);
  check("kontona som användes redovisas", summary.accountsUsed.equity, [2081, 2091]);
}

check(
  "fil utan #-poster vägras med instruktion",
  (() => {
    const r = parseSie(utf8("hej\nhopp"));
    return !r.ok && r.error.includes("SIE 4");
  })(),
  true,
);

// CP437-fil med svenska kontonamn: hela raden byggs som bytes.
const cp437File = new Uint8Array([
  ...utf8('#KONTO 1930 "F'),
  0x94, // ö i CP437
  ...utf8('retagskonto"\n#UB 0 1930 100\n'),
]);
const cpOutcome = parseSie(cp437File);
check(
  "CP437-fil ger läsbart kontonamn",
  cpOutcome.ok && cpOutcome.sie.accounts[0].name,
  "Företagskonto",
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
