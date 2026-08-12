/**
 * LÄGESBILDEN: bokföringsfilen blir siffror någon ska fatta beslut på.
 *
 * `snapshotFromSie` står mellan en uppladdad SIE-fil och den analysmotor
 * som säger "din största kund är 62 % av omsättningen" eller "betala
 * skatten före hyran". Blir översättningen fel blir rådet fel, och rådet
 * gäller om ett bolag ska rekonstrueras eller sättas i konkurs.
 *
 * Sviten prövar tre saker, i den ordningen:
 *
 *  1. TECKNEN. Skulder och eget kapital står i kredit i bokföringen,
 *     alltså negativt. Vänds de inte visar produkten "-1 200 000 kr i
 *     skulder", och vänds de två gånger visar den ett bolag som går med
 *     vinst när det blöder. Båda felen är tysta.
 *
 *  2. ATT LUCKOR ÄR LUCKOR. Det SIE inte bär - motparter, förfallodagar,
 *     skattekontot - får aldrig bli nollor. "Du har inga obetalda
 *     leverantörsfakturor" och "vi vet inte om du har några" leder till
 *     olika beslut, och bara det ena är sant.
 *
 *  3. ATT ANALYSMOTORN FAKTISKT KAN LÄSA RESULTATET. En översättning som
 *     är korrekt men som insights.ts inte känner igen är lika värdelös
 *     som en felaktig. Därför körs den riktiga motorn på slutet.
 */

import { parseSie } from "../src/lib/financial/sie";
import { snapshotFromSie } from "../src/lib/financial/fromSie";
import { analyseSnapshot } from "../src/lib/financial/insights";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (ok) passed++;
  else {
    failed++;
    console.log(`FAIL ${name}${extra === undefined ? "" : `\n     ${JSON.stringify(extra)}`}`);
  }
};

const utf8 = (s: string) => new TextEncoder().encode(s);
const NU = "2026-08-12T09:00:00.000Z";

/*
 * En liten men fullständig SIE 4-fil för ett bolag som går dåligt:
 * tillgångar 700 000, skulder 1 200 000, alltså negativt eget kapital.
 * Precis det läge produkten finns för.
 */
const SIE = [
  '#FLAGGA 0',
  '#PROGRAM "Testbokföring" 1.0',
  '#FORMAT PC8',
  '#SIETYP 4',
  '#FNAMN "Krisbolaget AB"',
  '#ORGNR 556012-3456',
  '#RAR 0 20250101 20251231',
  '#KONTO 1510 "Kundfordringar"',
  '#KONTO 1930 "Företagskonto"',
  '#KONTO 2440 "Leverantörsskulder"',
  '#KONTO 2081 "Aktiekapital"',
  '#KONTO 3011 "Försäljning"',
  '#KONTO 5010 "Lokalhyra"',
  '#IB 0 1510 300000.00',
  '#IB 0 1930 250000.00',
  '#UB 0 1510 450000.00',
  '#UB 0 1930 250000.00',
  '#UB 0 2440 -1200000.00',
  '#UB 0 2081 -25000.00',
  '#RES 0 3011 -900000.00',
  '#RES 0 5010 480000.00',
  '#VER "A" "1" 20251115 "Hyra november"',
  '{',
  '#TRANS 5010 {} 40000.00',
  '#TRANS 1930 {} -40000.00',
  '}',
  '#VER "A" "2" 20251201 "Kundfaktura 101"',
  '{',
  '#TRANS 1510 {} 150000.00',
  '#TRANS 3011 {} -150000.00',
  '}',
].join('\n');

const utfall = parseSie(utf8(SIE));
check("filen går att tolka", utfall.ok, utfall.ok ? "" : utfall.error);
if (!utfall.ok) {
  console.log(`\n${passed} passed, ${failed + 1} failed`);
  process.exit(1);
}

const bild = snapshotFromSie(utfall.sie, { fileName: "krisbolaget.se", capturedAt: NU });

/* --- 1. Identitet och ursprung -------------------------------------------- */

check("bolagsnamnet följer med", bild.companyName === "Krisbolaget AB", bild.companyName);
check("organisationsnumret följer med", bild.orgNumber === "556012-3456", bild.orgNumber);
check("tidpunkten är den som skickades in", bild.capturedAt === NU, bild.capturedAt);
// capturedAt får ALDRIG komma ur klockan inne i funktionen - då går den
// inte att pröva, och en lägesbild går inte att återskapa.
check("providern är generisk (SIE, inte ett systemavtal)", bild.provider === "generic");

/* --- 2. Kontoplanen -------------------------------------------------------- */

const konton = bild.chartOfAccounts ?? [];
check("alla sex kontona kom med", konton.length === 6, konton.length);
const typAv = (nr: string) => konton.find((k) => k.number === nr)?.type;
check("1510 är en tillgång", typAv("1510") === "asset", typAv("1510"));
check("2440 är en skuld", typAv("2440") === "liability", typAv("2440"));
check("2081 är eget kapital", typAv("2081") === "equity", typAv("2081"));
check("3011 är en intäkt", typAv("3011") === "income", typAv("3011"));
check("5010 är en kostnad", typAv("5010") === "expense", typAv("5010"));
// Likvidkontot måste vara utpekat: analysmotorn räknar kassa på det.
check(
  "1930 är märkt som likvidkonto",
  konton.find((k) => k.number === "1930")?.isCashAccount === true,
);
check(
  "1510 är INTE ett likvidkonto",
  konton.find((k) => k.number === "1510")?.isCashAccount === false,
);

/* --- 3. Balansräkningen och tecknen ---------------------------------------- */

const br = bild.balanceSheet;
check("balansräkningen finns", br !== undefined);
check("balansdagen är räkenskapsårets slut", br?.asOf === "2025-12-31", br?.asOf);
check("tillgångarna summeras", br?.totalAssets === 700000, br?.totalAssets);
// DET HÄR ÄR KONTROLLEN SOM BETYDER MEST. Skulder står i kredit (-1 200 000
// i filen) och ska visas som 1 200 000. Vänds de inte visar produkten en
// negativ skuld; vänds de två gånger ser bolaget skuldfritt ut.
check("skulderna vänds till positivt tal", br?.totalLiabilities === 1200000, br?.totalLiabilities);
check("eget kapital vänds likadant", br?.equity === 25000, br?.equity);
check(
  "ingående balans följer med där den finns",
  br?.accounts.find((a) => a.accountNumber === "1510")?.previousBalance === 300000,
  br?.accounts.find((a) => a.accountNumber === "1510")?.previousBalance,
);
// Resultatkonton hör inte hemma i balansräkningen.
check(
  "resultatkonton ligger inte i balansräkningen",
  !br?.accounts.some((a) => a.accountNumber === "3011" || a.accountNumber === "5010"),
  br?.accounts.map((a) => a.accountNumber),
);

/* --- 4. Resultaträkningen -------------------------------------------------- */

const rr = bild.incomeStatement;
check("resultaträkningen finns", rr !== undefined);
check("perioden är räkenskapsåret", rr?.from === "2025-01-01" && rr?.to === "2025-12-31", {
  from: rr?.from,
  to: rr?.to,
});
check("omsättningen vänds till positivt tal", rr?.revenue === 900000, rr?.revenue);
check("kostnaderna står kvar positiva", rr?.operatingExpenses === 480000, rr?.operatingExpenses);
check("resultatet är omsättning minus kostnad", rr?.result === 420000, rr?.result);

/* --- 5. Verifikaten -------------------------------------------------------- */

const ver = bild.vouchers ?? [];
check("båda verifikaten kom med", ver.length === 2, ver.length);
const hyran = ver.find((v) => v.description === "Hyra november");
check("verifikatets datum är ISO", hyran?.date === "2025-11-15", hyran?.date);
check("verifikatets rader kom med", hyran?.rows.length === 2, hyran?.rows.length);
check(
  "debet är positivt och kredit negativt i samma kolumn",
  hyran?.rows.find((r) => r.accountNumber === "5010")?.amount === 40000 &&
    hyran?.rows.find((r) => r.accountNumber === "1930")?.amount === -40000,
  hyran?.rows,
);
// Ett verifikat ska gå att spåra till raden i filen.
check(
  "verifikatet bär sin källhänvisning",
  hyran?.provenance.sourceRef === "#VER A 1",
  hyran?.provenance.sourceRef,
);
check(
  "och filnamnet, så siffran går att härleda till en uppladdning",
  hyran?.provenance.origin.kind === "accounting" &&
    hyran.provenance.origin.endpoint === "sie:krisbolaget.se",
  hyran?.provenance.origin,
);

/* --- 6. LUCKORNA: det som INTE gick att läsa ------------------------------- */

const luckor = bild.gaps.map((g) => g.dataset);
for (const saknad of ["counterparties", "openItems", "bankAccounts", "taxAccount", "payroll"]) {
  check(`${saknad} är redovisad som en LUCKA, inte som tom lista`, luckor.includes(saknad as never), luckor);
}
check(
  "varje lucka har ett läsbart skäl",
  bild.gaps.every((g) => g.reason.length > 20),
  bild.gaps.filter((g) => g.reason.length <= 20),
);
// Och de datamängder filen FAKTISKT bar får inte stå som luckor.
for (const fanns of ["balanceSheet", "incomeStatement", "vouchers"]) {
  check(`${fanns} står inte som lucka när filen bar den`, !luckor.includes(fanns as never), luckor);
}

/* --- 7. En balansfil utan verifikat och utan räkenskapsår ------------------ */

const TUNN = [
  '#FLAGGA 0',
  '#SIETYP 1',
  '#FNAMN "Tunnbolaget AB"',
  '#KONTO 1930 "Bank"',
  '#UB 0 1930 5000.00',
].join('\n');
const tunt = parseSie(utf8(TUNN));
check("den tunna filen går att tolka", tunt.ok, tunt.ok ? "" : tunt.error);
if (tunt.ok) {
  const b2 = snapshotFromSie(tunt.sie, { fileName: "tunn.se", capturedAt: NU });
  check("verifikaten redovisas som lucka när de saknas", b2.gaps.some((g) => g.dataset === "vouchers"));
  check("och vouchers är undefined, inte en tom lista", b2.vouchers === undefined, b2.vouchers);
  check(
    "resultaträkningen redovisas som lucka",
    b2.gaps.some((g) => g.dataset === "incomeStatement"),
  );
  check("och incomeStatement är undefined", b2.incomeStatement === undefined);
  // Utan #RAR sätts balansdagen till importdagen - och DET SÄGS.
  check("saknat räkenskapsår blir en lucka med förklaring", b2.gaps.some(
    (g) => g.dataset === "balanceSheet" && /RAR/.test(g.reason),
  ), b2.gaps);
  check("balansdagen faller tillbaka på importdagen", b2.balanceSheet?.asOf === "2026-08-12", b2.balanceSheet?.asOf);
}

/* --- 8. Analysmotorn ska kunna läsa det som kommer ut ---------------------- */

/*
 * En översättning som är korrekt men som insights.ts inte känner igen är
 * lika oanvändbar som en felaktig. Motorn körs därför på riktigt - det är
 * den enda kontrollen som bevisar att kedjan fil -> lägesbild -> insikt
 * faktiskt håller ihop.
 */
const insikter = analyseSnapshot(bild, { now: new Date(NU) });
check("analysmotorn tar emot lägesbilden utan att kasta", Array.isArray(insikter), typeof insikter);
check(
  "varje insikt har allvarlighetsgrad och rubrik",
  insikter.every((i) => ["critical", "warning", "info"].includes(i.severity) && i.title.length > 0),
  insikter.map((i) => ({ s: i.severity, t: i.title })),
);
// Bolaget har negativt eget kapital i sak (700 000 i tillgångar mot
// 1 200 000 i skulder). Att motorn KÖRS mot riktiga siffror är poängen;
// vilken exakt insikt den fäller är dess ensak och prövas i sin egen svit.
check(
  "balansräkningen som motorn ser har rätt storleksordning",
  (bild.balanceSheet?.totalLiabilities ?? 0) > (bild.balanceSheet?.totalAssets ?? 0),
  { skulder: bild.balanceSheet?.totalLiabilities, tillgangar: bild.balanceSheet?.totalAssets },
);

/* --- 9. Trasig fil ger fel, inte en tom lägesbild -------------------------- */

const skrap = parseSie(utf8("det här är inte en SIE-fil\nbara text"));
check("skräp avvisas av parsern", !skrap.ok);
// Och det är parsern som avvisar - snapshotFromSie ska aldrig behöva
// gissa om indata är rimlig, för den anropas bara efter ett ok-utfall.

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
