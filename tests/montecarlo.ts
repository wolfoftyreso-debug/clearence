/**
 * MONTE CARLO-MOTORN, PRÖVAD.
 *
 * Sviten är indelad som kraven är: slumpen, fördelningarna, statistiken,
 * uttrycksspråket, motorn, kanterna och prestandan.
 *
 * TVÅ SAKER GÖR DEN HÄR SVITEN ANNORLUNDA ÄN DE ANDRA I PROJEKTET.
 *
 * 1. DEN ÄR STATISTISK. En samplare går inte att pröva med ett likhetstecken
 *    - den ska ge RÄTT FÖRDELNING, inte rätt tal. Kontrollerna drar därför
 *    hundratusen sampel och jämför mot fördelningens teoretiska moment inom
 *    en tolerans. Toleranserna är satta så att en korrekt implementation
 *    passerar med marginal och en förväxlad parameter faller. Fröet är
 *    fast, så ingen kontroll är flaxig: samma körning ger samma tal varje
 *    gång, och en röd svit är ett fel, inte otur.
 *
 * 2. DEN PRÖVAR ATT FEL UPPTÄCKS. Ungefär hälften av kontrollerna matar in
 *    något ogiltigt och kräver att motorn SÄGER IFRÅN. En simuleringsmotor
 *    som tyst räknar vidare på en omöjlig fördelning producerar ett
 *    underlag som ser giltigt ut - och det är farligare än ett fel.
 */

import { Slumpstrom, nyttFro } from "../src/lib/montecarlo/slump";
import { beloppKort, beloppMedEnhet, procentAv } from "../src/lib/montecarlo/format";
import {
  FORDELNINGAR,
  moment,
  sampla,
  validera,
  type Fordelning,
} from "../src/lib/montecarlo/fordelningar";
import {
  histogram,
  percentil,
  rangkorrelation,
  sammanfatta,
  sannolikhetMinst,
  sannolikhetUnder,
} from "../src/lib/montecarlo/statistik";
import { berakna, tolka, variablerI, UttrycksFel } from "../src/lib/montecarlo/uttryck";
import {
  Avbruten,
  korDirekt,
  kor,
  MOTORVERSION,
  TROSKEL_FOR_KO,
  valideraSpec,
  type Simuleringsspec,
} from "../src/lib/montecarlo/motor";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (ok) passed++;
  else {
    failed++;
    console.log(`FAIL ${name}${extra === undefined ? "" : `\n     ${JSON.stringify(extra)}`}`);
  }
};
const nara = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

/* ========================================================================== */
/* 1. Slumpen                                                                 */
/* ========================================================================== */

{
  const a = new Slumpstrom(42);
  const b = new Slumpstrom(42);
  const c = new Slumpstrom(43);
  const dragA = Array.from({ length: 200 }, () => a.nasta());
  const dragB = Array.from({ length: 200 }, () => b.nasta());
  const dragC = Array.from({ length: 200 }, () => c.nasta());
  check("samma frö ger identisk sekvens", dragA.every((v, i) => v === dragB[i]));
  check("olika frö ger olika sekvens", dragA.some((v, i) => v !== dragC[i]));

  // Ett frö på 1 och ett på 2 ska INTE ge sekvenser som ligger nära
  // varandra - annars är fröblandningen otillräcklig, och två närliggande
  // simuleringar blir korrelerade utan att någon märker det.
  const ett = new Slumpstrom(1);
  const tva = new Slumpstrom(2);
  const skillnad = Math.abs(ett.nasta() - tva.nasta());
  check("närliggande frön ger osläktade strömmar", skillnad > 0.01, skillnad);

  const s = new Slumpstrom(7);
  const N = 200000;
  const hinkar = new Array(20).fill(0);
  let min = 1;
  let max = 0;
  for (let i = 0; i < N; i++) {
    const u = s.nasta();
    if (u < min) min = u;
    if (u > max) max = u;
    hinkar[Math.floor(u * 20)]++;
  }
  check("varje dragning ligger i [0,1)", min >= 0 && max < 1, { min, max });
  const vantat = N / 20;
  const chi2 = hinkar.reduce((acc, o) => acc + (o - vantat) ** 2 / vantat, 0);
  // 19 frihetsgrader, kritiskt värde 43,82 vid 0,1 %. En generator som
  // klumpar ihop sig faller här.
  check("likformigheten klarar chi-två", chi2 < 43.82, chi2);

  // Seriell korrelation. En linjär kongruens med dåliga parametrar syns
  // direkt här, och just den sortens korrelation gör en simulering för
  // smal - alltså riskerna för låga.
  const s2 = new Slumpstrom(11);
  let sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0;
  let forra = s2.nasta();
  for (let i = 0; i < N; i++) {
    const nu = s2.nasta();
    sx += forra; sy += nu; sxy += forra * nu; sxx += forra * forra; syy += nu * nu;
    forra = nu;
  }
  const r = (N * sxy - sx * sy) / Math.sqrt((N * sxx - sx * sx) * (N * syy - sy * sy));
  check("ingen seriell korrelation", Math.abs(r) < 0.01, r);

  // Normalfördelningen ur Box-Muller.
  const s3 = new Slumpstrom(13);
  let sum = 0, sum2 = 0, inomEtt = 0, inomTva = 0;
  for (let i = 0; i < N; i++) {
    const v = s3.normal();
    sum += v; sum2 += v * v;
    if (Math.abs(v) <= 1) inomEtt++;
    if (Math.abs(v) <= 2) inomTva++;
  }
  check("normal har väntevärde 0", nara(sum / N, 0, 0.01), sum / N);
  check("normal har varians 1", nara(sum2 / N, 1, 0.02), sum2 / N);
  // 68-95-regeln: inte bara momenten ska stämma utan formen.
  check("68 % inom en standardavvikelse", nara(inomEtt / N, 0.6827, 0.005), inomEtt / N);
  check("95 % inom två", nara(inomTva / N, 0.9545, 0.005), inomTva / N);

  check("nastaOppen ger aldrig 0 eller 1", (() => {
    const s4 = new Slumpstrom(17);
    for (let i = 0; i < 50000; i++) {
      const u = s4.nastaOppen();
      if (u <= 0 || u >= 1) return false;
    }
    return true;
  })());

  check("nyttFro ger ett heltal inom intervallet", (() => {
    const f = nyttFro(() => 0.5);
    return Number.isInteger(f) && f >= 0 && f <= 0x7fffffff;
  })());
}

/* ========================================================================== */
/* 2. Fördelningarna: momenten mot teorin                                     */
/* ========================================================================== */

check("elva fördelningar är registrerade", FORDELNINGAR.length === 11, FORDELNINGAR.length);
check(
  "varje fördelning har namn och en förklaring av när den passar",
  FORDELNINGAR.every((f) => f.namn.length > 0 && f.narAnvands.length > 20),
);

{
  const N = 150000;
  const fall: { namn: string; f: Fordelning; tolMedel: number; tolVar: number }[] = [
    { namn: "normal", f: { typ: "normal", parametrar: { mu: 100, sigma: 15 } }, tolMedel: 0.01, tolVar: 0.03 },
    { namn: "lognormal", f: { typ: "lognormal", parametrar: { mu: 2, sigma: 0.5 } }, tolMedel: 0.02, tolVar: 0.06 },
    { namn: "uniform", f: { typ: "uniform", parametrar: { min: 10, max: 50 } }, tolMedel: 0.01, tolVar: 0.03 },
    { namn: "triangular", f: { typ: "triangular", parametrar: { min: 0, mode: 30, max: 60 } }, tolMedel: 0.01, tolVar: 0.03 },
    { namn: "beta", f: { typ: "beta", parametrar: { alpha: 2, beta: 5 } }, tolMedel: 0.01, tolVar: 0.04 },
    { namn: "exponential", f: { typ: "exponential", parametrar: { lambda: 0.25 } }, tolMedel: 0.02, tolVar: 0.06 },
    { namn: "poisson", f: { typ: "poisson", parametrar: { lambda: 4 } }, tolMedel: 0.02, tolVar: 0.04 },
    { namn: "poisson stor λ", f: { typ: "poisson", parametrar: { lambda: 60 } }, tolMedel: 0.01, tolVar: 0.05 },
    { namn: "bernoulli", f: { typ: "bernoulli", parametrar: { p: 0.3 } }, tolMedel: 0.02, tolVar: 0.03 },
    { namn: "binomial", f: { typ: "binomial", parametrar: { n: 20, p: 0.4 } }, tolMedel: 0.01, tolVar: 0.03 },
    {
      namn: "discrete",
      f: { typ: "discrete", parametrar: {}, punkter: [{ varde: 1, vikt: 1 }, { varde: 5, vikt: 3 }, { varde: 9, vikt: 1 }] },
      tolMedel: 0.02,
      tolVar: 0.04,
    },
  ];

  for (const { namn, f, tolMedel, tolVar } of fall) {
    check(`${namn}: fördelningen är giltig`, validera(f).length === 0, validera(f));
    const s = new Slumpstrom(2026);
    let sum = 0;
    let sum2 = 0;
    for (let i = 0; i < N; i++) {
      const v = sampla(f, s);
      sum += v;
      sum2 += v * v;
    }
    const m = sum / N;
    const va = sum2 / N - m * m;
    const t = moment(f);
    const relM = Math.abs(m - (t.vantevarde as number)) / Math.max(1e-9, Math.abs(t.vantevarde as number));
    const relV = Math.abs(va - (t.varians as number)) / Math.max(1e-9, t.varians as number);
    check(`${namn}: väntevärdet stämmer med teorin`, relM < tolMedel, { matt: m, teori: t.vantevarde });
    check(`${namn}: variansen stämmer med teorin`, relV < tolVar, { matt: va, teori: t.varians });
  }

  // Formen, inte bara momenten: en fördelning kan ha rätt medel och rätt
  // varians och ändå vara fel sort.
  const s = new Slumpstrom(99);
  let utanfor = 0;
  for (let i = 0; i < 20000; i++) {
    const v = sampla({ typ: "triangular", parametrar: { min: 5, mode: 7, max: 11 } }, s);
    if (v < 5 || v > 11) utanfor++;
  }
  check("triangulär håller sig inom sina gränser", utanfor === 0, utanfor);

  let utanforBeta = 0;
  for (let i = 0; i < 20000; i++) {
    const v = sampla({ typ: "beta", parametrar: { alpha: 2, beta: 5 } }, s);
    if (v < 0 || v > 1) utanforBeta++;
  }
  check("beta håller sig i [0,1]", utanforBeta === 0, utanforBeta);

  let negativ = 0;
  for (let i = 0; i < 20000; i++) {
    if (sampla({ typ: "lognormal", parametrar: { mu: 1, sigma: 1 } }, s) < 0) negativ++;
  }
  check("lognormal blir aldrig negativ", negativ === 0, negativ);

  let ejHeltal = 0;
  for (let i = 0; i < 5000; i++) {
    const v = sampla({ typ: "poisson", parametrar: { lambda: 3 } }, s);
    if (!Number.isInteger(v) || v < 0) ejHeltal++;
  }
  check("poisson ger icke-negativa heltal", ejHeltal === 0, ejHeltal);

  let ejBinart = 0;
  for (let i = 0; i < 5000; i++) {
    const v = sampla({ typ: "bernoulli", parametrar: { p: 0.5 } }, s);
    if (v !== 0 && v !== 1) ejBinart++;
  }
  check("bernoulli ger bara 0 eller 1", ejBinart === 0, ejBinart);
}

/* ========================================================================== */
/* 3. Valideringen avvisar det ogiltiga                                       */
/* ========================================================================== */

{
  const ogiltiga: { namn: string; f: Fordelning }[] = [
    { namn: "normal med sigma 0", f: { typ: "normal", parametrar: { mu: 1, sigma: 0 } } },
    { namn: "normal med negativ sigma", f: { typ: "normal", parametrar: { mu: 1, sigma: -2 } } },
    { namn: "normal med NaN", f: { typ: "normal", parametrar: { mu: Number.NaN, sigma: 1 } } },
    { namn: "normal med Infinity", f: { typ: "normal", parametrar: { mu: Number.POSITIVE_INFINITY, sigma: 1 } } },
    { namn: "uniform där max < min", f: { typ: "uniform", parametrar: { min: 5, max: 1 } } },
    { namn: "uniform där max = min", f: { typ: "uniform", parametrar: { min: 5, max: 5 } } },
    { namn: "omöjlig triangel (topp utanför)", f: { typ: "triangular", parametrar: { min: 0, mode: 100, max: 10 } } },
    { namn: "triangel med max < min", f: { typ: "triangular", parametrar: { min: 10, mode: 5, max: 1 } } },
    { namn: "beta med alpha <= 0", f: { typ: "beta", parametrar: { alpha: 0, beta: 2 } } },
    { namn: "beta med negativ beta", f: { typ: "beta", parametrar: { alpha: 2, beta: -1 } } },
    { namn: "exponential med lambda 0", f: { typ: "exponential", parametrar: { lambda: 0 } } },
    { namn: "poisson med negativ lambda", f: { typ: "poisson", parametrar: { lambda: -3 } } },
    { namn: "bernoulli med p > 1", f: { typ: "bernoulli", parametrar: { p: 1.5 } } },
    { namn: "bernoulli med p < 0", f: { typ: "bernoulli", parametrar: { p: -0.1 } } },
    { namn: "binomial med n som decimaltal", f: { typ: "binomial", parametrar: { n: 2.5, p: 0.5 } } },
    { namn: "binomial med negativt n", f: { typ: "binomial", parametrar: { n: -5, p: 0.5 } } },
    { namn: "binomial med orimligt n", f: { typ: "binomial", parametrar: { n: 5000000, p: 0.5 } } },
    { namn: "diskret utan utfall", f: { typ: "discrete", parametrar: {}, punkter: [] } },
    { namn: "diskret med bara nollvikter", f: { typ: "discrete", parametrar: {}, punkter: [{ varde: 1, vikt: 0 }] } },
    { namn: "diskret med negativ vikt", f: { typ: "discrete", parametrar: {}, punkter: [{ varde: 1, vikt: -1 }] } },
    { namn: "egen med en enda punkt", f: { typ: "custom", parametrar: {}, punkter: [{ varde: 1, vikt: 1 }] } },
    { namn: "saknad parameter", f: { typ: "normal", parametrar: {} } },
    { namn: "okänd fördelningstyp", f: { typ: "hittepa" as never, parametrar: {} } },
  ];
  for (const { namn, f } of ogiltiga) {
    const fel = validera(f);
    check(`avvisas: ${namn}`, fel.length > 0, fel);
    check(`  och felet är läsbart`, fel.length > 0 && fel[0].meddelande.length > 15, fel[0]?.meddelande);
  }
}

/* ========================================================================== */
/* 4. Statistiken                                                             */
/* ========================================================================== */

{
  // En känd serie 1..100 har percentiler man kan räkna för hand.
  const serie = new Float64Array(100);
  for (let i = 0; i < 100; i++) serie[i] = i + 1;
  const st = sammanfatta(serie);
  check("antalet stämmer", st.antal === 100);
  check("medelvärdet stämmer", nara(st.medel, 50.5, 1e-9), st.medel);
  check("min och max stämmer", st.min === 1 && st.max === 100);
  check("medianen är mitten", nara(st.median, 50.5, 1e-9), st.median);
  // Typ 7-interpolation: P10 av 1..100 = 1 + 0,1*99 = 10,9.
  check("P10 följer typ 7-interpolationen", nara(st.percentiler.p10, 10.9, 1e-9), st.percentiler.p10);
  check("P90 följer typ 7-interpolationen", nara(st.percentiler.p90, 90.1, 1e-9), st.percentiler.p90);
  check("stickprovsvariansen stämmer", nara(st.varians, 841.6667, 0.001), st.varians);
  check(
    "percentilerna är ordnade",
    st.percentiler.p5 <= st.percentiler.p10 &&
      st.percentiler.p10 <= st.percentiler.p25 &&
      st.percentiler.p25 <= st.percentiler.p50 &&
      st.percentiler.p50 <= st.percentiler.p75 &&
      st.percentiler.p75 <= st.percentiler.p90 &&
      st.percentiler.p90 <= st.percentiler.p95 &&
      st.percentiler.p95 <= st.percentiler.p99,
  );
  check(
    "konfidensintervallet omsluter medelvärdet",
    st.medelvardetsKonfidensintervall.nedre < st.medel && st.medel < st.medelvardetsKonfidensintervall.ovre,
  );
  // Standardfelet krymper som roten ur n - det är hela skälet att fler
  // iterationer hjälper, och att de hjälper allt mindre.
  const stor = new Float64Array(400);
  for (let i = 0; i < 400; i++) stor[i] = serie[i % 100];
  stor.sort();
  check("standardfelet halveras när n fyrdubblas", nara(sammanfatta(stor).standardfel, st.standardfel / 2, st.standardfel * 0.05));

  // NUMERISK STABILITET: stor nivå, liten spridning. Den naiva formeln
  // E[X²]-E[X]² kan här ge en NEGATIV varians.
  const kanslig = new Float64Array(10000);
  for (let i = 0; i < 10000; i++) kanslig[i] = 50000000 + (i % 100) * 0.001;
  kanslig.sort();
  const stKanslig = sammanfatta(kanslig);
  check("variansen blir aldrig negativ vid stor nivå och liten spridning", stKanslig.varians >= 0, stKanslig.varians);
  check("och standardavvikelsen är ett tal", Number.isFinite(stKanslig.standardavvikelse), stKanslig.standardavvikelse);

  // Sannolikheter.
  check("sannolikheten att nå 51 av 1..100 är 50 %", nara(sannolikhetMinst(serie, 51), 0.5, 1e-9), sannolikhetMinst(serie, 51));
  check("under 51 är också 50 %", nara(sannolikhetUnder(serie, 51), 0.5, 1e-9));
  check("en tröskel under allt ger 100 %", sannolikhetMinst(serie, -5) === 1);
  check("en tröskel över allt ger 0 %", sannolikhetMinst(serie, 500) === 0);

  // Histogram.
  const h = histogram(serie, 10);
  check("histogrammet har rätt antal staplar", h.antal.length === 10, h.antal.length);
  check("kanterna är en fler än staplarna", h.kanter.length === 11);
  check("alla sampel hamnar i en stapel", h.antal.reduce((a, b) => a + b, 0) === 100, h.antal);
  const platt = new Float64Array(50).fill(7);
  const hPlatt = histogram(platt);
  check("en serie utan spridning ger en stapel med allt", hPlatt.antal.length === 1 && hPlatt.antal[0] === 50, hPlatt);
  check("och inga NaN-kanter", hPlatt.kanter.every((k) => Number.isFinite(k)), hPlatt.kanter);

  // Percentil på gränsfall.
  check("percentil av en enda punkt är punkten", percentil(new Float64Array([42]), 0.9) === 42);
  check("percentil av tom serie är NaN", Number.isNaN(percentil(new Float64Array(0), 0.5)));
  let kastade = false;
  try { sammanfatta(new Float64Array(0)); } catch { kastade = true; }
  check("statistik på noll sampel kastar i stället för att ljuga", kastade);
}

/* ========================================================================== */
/* 5. Rangkorrelationen                                                       */
/* ========================================================================== */

{
  const n = 500;
  const x = new Float64Array(n);
  const yUpp = new Float64Array(n);
  const yNer = new Float64Array(n);
  const yKurva = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = i;
    yUpp[i] = i * 3 + 7;
    yNer[i] = -i;
    // Monotont men kraftigt olinjärt. Pearson skulle underskatta det här.
    yKurva[i] = Math.exp(i / 100);
  }
  check("perfekt stigande samband ger +1", nara(rangkorrelation(x, yUpp), 1, 1e-9), rangkorrelation(x, yUpp));
  check("perfekt fallande ger -1", nara(rangkorrelation(x, yNer), -1, 1e-9), rangkorrelation(x, yNer));
  check(
    "olinjärt men monotont samband fångas ändå",
    nara(rangkorrelation(x, yKurva), 1, 1e-9),
    rangkorrelation(x, yKurva),
  );
  const konstant = new Float64Array(n).fill(5);
  check("en konstant serie ger 0, inte NaN", rangkorrelation(x, konstant) === 0);
  // Lika värden ska få medelrang; utan det blir binära variabler
  // systematiskt felskattade.
  const binar = new Float64Array(n);
  for (let i = 0; i < n; i++) binar[i] = i < n / 2 ? 0 : 1;
  const rBinar = rangkorrelation(binar, x);
  check("binär input korrelerar starkt med sin ordning", rBinar > 0.85, rBinar);
}

/* ========================================================================== */
/* 6. Uttrycksspråket                                                         */
/* ========================================================================== */

{
  const v = new Map(Object.entries({ a: 10, b: 3, c: 2 }));
  const rakna = (u: string) => berakna(tolka(u), v);
  const fall: [string, number][] = [
    ["a + b", 13],
    ["a - b * c", 4],
    ["(a - b) * c", 14],
    ["a / c", 5],
    ["a % b", 1],
    ["2 ^ 10", 1024],
    ["2 ^ 3 ^ 2", 512],
    ["-a", -10],
    ["- a + b", -7],
    ["min(a, b, c)", 2],
    ["max(a, b)", 10],
    ["abs(0 - a)", 10],
    ["sqrt(a * 10)", 10],
    ["round(a / b)", 3],
    ["floor(a / b)", 3],
    ["ceil(a / b)", 4],
    ["if(a > b, 1, 0)", 1],
    ["if(a < b, 1, 0)", 0],
    ["clamp(a, 0, 5)", 5],
    ["a > b && b > c", 1],
    ["a < b || b > c", 1],
    ["!(a > b)", 0],
    ["1e3", 1000],
    ["1.5 * 2", 3],
  ];
  for (const [u, vantat] of fall) {
    check(`uttryck: ${u} = ${vantat}`, nara(rakna(u), vantat, 1e-9), rakna(u));
  }

  /*
   * DET HÄR ÄR SÄKERHETSKONTROLLEN.
   *
   * Grammatiken saknar punktnotation, hakparenteser, strängar och
   * satsavskiljare. Det går alltså inte att UTTRYCKA ett anrop mot
   * omvärlden - inte för att sådant filtreras bort, utan för att
   * konstruktionen inte finns. En svartlista går att gå runt.
   */
  const farliga = [
    "process.exit(1)",
    "globalThis",
    "a.constructor",
    "a['x']",
    "eval('1+1')",
    "new Function('return 1')",
    "(() => 1)()",
    "a; process.exit()",
    "require('fs')",
    "import('fs')",
    "`${a}`",
    "a = 5",
    "__proto__",
    "this",
  ];
  for (const u of farliga) {
    let stoppat = false;
    let hur = "";
    try {
      const t = tolka(u);
      // Även om det tolkas ska evalueringen inte kunna nå något: ett okänt
      // namn är en variabel som inte finns.
      berakna(t, v);
    } catch (e) {
      stoppat = true;
      hur = e instanceof Error ? e.name : "";
    }
    check(`farligt uttryck stoppas: ${u}`, stoppat, hur);
  }

  // Syntaxfel ska ha en position, så gränssnittet kan peka.
  for (const trasigt of ["a +", "(a + b", "a b", "okand(1)", "max()", "if(a)", ""]) {
    let fel: unknown = null;
    try { tolka(trasigt); } catch (e) { fel = e; }
    check(`syntaxfel fångas: "${trasigt}"`, fel instanceof UttrycksFel || fel instanceof Error, String(fel));
    if (fel instanceof UttrycksFel) {
      check(`  och bär en position`, Number.isInteger(fel.position) && fel.position >= 0, fel.position);
    }
  }

  let okantNamn = false;
  try { berakna(tolka("Finnsinte + 1"), v); } catch { okantNamn = true; }
  check("ett okänt variabelnamn kastar i stället för att räknas som noll", okantNamn);

  check("variablerI hittar alla namn", (() => {
    const namn = [...variablerI(tolka("a + max(b, c * 2) - if(a > b, a, c)"))].sort();
    return JSON.stringify(namn) === JSON.stringify(["a", "b", "c"]);
  })());
}

/* ========================================================================== */
/* 7. Motorn                                                                  */
/* ========================================================================== */

const grundspec = (over: Partial<Simuleringsspec> = {}): Simuleringsspec => ({
  namn: "Prov",
  fro: 20260812,
  iterationer: 20000,
  konstanter: { Fasta: 400000 },
  inputs: [
    { namn: "Kunder", fordelning: { typ: "poisson", parametrar: { lambda: 40 } } },
    { namn: "Snittintakt", fordelning: { typ: "lognormal", parametrar: { mu: 9.5, sigma: 0.4 } } },
    { namn: "Rorlig", fordelning: { typ: "triangular", parametrar: { min: 200000, mode: 350000, max: 700000 } } },
  ],
  outputs: [
    { namn: "Intakter", uttryck: "Kunder * Snittintakt" },
    { namn: "Resultat", uttryck: "Intakter - Rorlig - Fasta", mal: 0, kritiskGrans: -500000 },
  ],
  ...over,
});

{
  check("specen är giltig", valideraSpec(grundspec()).length === 0, valideraSpec(grundspec()));

  const r = kor(grundspec());
  check("motorversionen följer med", r.motorversion === MOTORVERSION);
  check("alla iterationer kördes", r.iterationer === 20000, r.iterationer);
  check("båda resultaten räknades", r.outputs.length === 2);

  const res = r.outputs[1];
  check("ett senare resultat får läsa ett tidigare", Number.isFinite(res.statistik.medel));
  check("sannolikheten att nå målet är en andel", res.sannolikheter.narMal! >= 0 && res.sannolikheter.narMal! <= 1);
  check("sannolikheten under kritisk gräns räknas", res.sannolikheter.underKritisk !== null);
  check("sannolikheten för negativt utfall räknas alltid", res.sannolikheter.negativt >= 0);
  check("känsligheten rankar alla inputs", res.kanslighet.length === 3);
  check(
    "andelarna summerar till 1",
    nara(res.kanslighet.reduce((a, k) => a + k.andelAvVariation, 0), 1, 1e-9),
  );
  check(
    "känslighetslistan är sorterad",
    res.kanslighet.every((k, i) => i === 0 || res.kanslighet[i - 1].andelAvVariation >= k.andelAvVariation),
  );
  check("konvergensen har flera avstämningar", res.konvergens.length >= 4, res.konvergens.length);
  check(
    "konvergensen slutar på hela körningen",
    res.konvergens[res.konvergens.length - 1].iterationer === 20000,
  );
  check("körningen bedöms stabil", res.stabil);
  check("histogrammet täcker alla sampel", res.histogram.antal.reduce((a, b) => a + b, 0) === 20000);
  check("inga anmärkningar på en frisk körning", r.anmarkningar.length === 0, r.anmarkningar);
  check("inga iterationer förkastades", r.forkastadeIterationer === 0);

  /* --- DETERMINISM ---------------------------------------------------- */

  const r2 = kor(grundspec());
  check(
    "samma frö ger exakt samma percentiler",
    JSON.stringify(r2.outputs[1].statistik.percentiler) === JSON.stringify(res.statistik.percentiler),
  );
  check("och samma känslighetsordning", JSON.stringify(r2.outputs[1].kanslighet) === JSON.stringify(res.kanslighet));
  const r3 = kor(grundspec({ fro: 20260813 }));
  check("ett annat frö ger ett annat utfall", r3.outputs[1].statistik.median !== res.statistik.median);

  // Ordningen på inputs är en del av reproducerbarheten: strömmen är
  // sekventiell, så en omkastning ger andra tal med samma frö. Det ska
  // vara sant, och det ska vara känt.
  const omkastad = grundspec();
  [omkastad.inputs[0], omkastad.inputs[1]] = [omkastad.inputs[1], omkastad.inputs[0]];
  check(
    "inputordningen påverkar strömmen (och är därför en del av specen)",
    kor(omkastad).outputs[1].statistik.median !== res.statistik.median,
  );

  /* --- Avbrott och framsteg -------------------------------------------- */

  let varv = 0;
  let avbrots = false;
  try {
    kor(grundspec({ iterationer: 500000 }), { framsteg: () => { varv++; return varv < 2; } });
  } catch (e) {
    avbrots = e instanceof Avbruten;
  }
  check("körningen går att avbryta mitt i", avbrots);

  let avbrotsFlagga = false;
  try {
    kor(grundspec({ iterationer: 500000 }), { avbrutet: () => true });
  } catch (e) {
    avbrotsFlagga = e instanceof Avbruten;
  }
  check("avbrottsflaggan fungerar också", avbrotsFlagga);

  const steg: number[] = [];
  kor(grundspec({ iterationer: 100000 }), { framsteg: (k, av) => { steg.push(k / av); } });
  check("framsteg rapporteras flera gånger", steg.length >= 3, steg.length);
  check("och slutar på 100 %", nara(steg[steg.length - 1], 1, 1e-9), steg[steg.length - 1]);

  /* --- Routing: vad som körs var --------------------------------------- */

  check("små körningar körs direkt", korDirekt(10000));
  check("körningar på tröskeln körs direkt", korDirekt(TROSKEL_FOR_KO));
  check("större körningar köas", !korDirekt(TROSKEL_FOR_KO + 1));
  check("en miljon köas", !korDirekt(1000000));
}

/* ========================================================================== */
/* 8. Specvalidering och kanter                                               */
/* ========================================================================== */

{
  const trasiga: { namn: string; spec: Simuleringsspec }[] = [
    { namn: "utan namn", spec: grundspec({ namn: "" }) },
    { namn: "för få iterationer", spec: grundspec({ iterationer: 5 }) },
    { namn: "iterationer som decimaltal", spec: grundspec({ iterationer: 1000.5 }) },
    { namn: "frö som inte är heltal", spec: grundspec({ fro: 1.5 }) },
    { namn: "utan inputs", spec: grundspec({ inputs: [] }) },
    { namn: "utan outputs", spec: grundspec({ outputs: [] }) },
    {
      namn: "okänd variabel i uttrycket",
      spec: grundspec({ outputs: [{ namn: "X", uttryck: "Finnsinte * 2" }] }),
    },
    {
      namn: "uttryck som refererar sig själv",
      spec: grundspec({ outputs: [{ namn: "X", uttryck: "X + 1" }] }),
    },
    {
      namn: "två inputs med samma namn",
      spec: grundspec({
        inputs: [
          { namn: "A", fordelning: { typ: "normal", parametrar: { mu: 1, sigma: 1 } } },
          { namn: "A", fordelning: { typ: "normal", parametrar: { mu: 2, sigma: 1 } } },
        ],
        outputs: [{ namn: "Y", uttryck: "A" }],
      }),
    },
    {
      namn: "ogiltigt variabelnamn",
      spec: grundspec({
        inputs: [{ namn: "2fel", fordelning: { typ: "normal", parametrar: { mu: 1, sigma: 1 } } }],
        outputs: [{ namn: "Y", uttryck: "1" }],
      }),
    },
    {
      namn: "input med omöjlig fördelning",
      spec: grundspec({
        inputs: [{ namn: "A", fordelning: { typ: "triangular", parametrar: { min: 0, mode: 99, max: 1 } } }],
        outputs: [{ namn: "Y", uttryck: "A" }],
      }),
    },
    {
      namn: "konstant som krockar med en input",
      spec: grundspec({ konstanter: { Kunder: 5 } }),
    },
    {
      namn: "konstant som inte är ett tal",
      spec: grundspec({ konstanter: { X: Number.NaN } }),
    },
    { namn: "trasig syntax i uttrycket", spec: grundspec({ outputs: [{ namn: "X", uttryck: "1 +" }] }) },
  ];
  for (const { namn, spec } of trasiga) {
    const fel = valideraSpec(spec);
    check(`spec avvisas: ${namn}`, fel.length > 0, fel);
    check(`  med ett läsbart besked`, fel.length > 0 && fel[0].meddelande.length > 15, fel[0]?.meddelande);
    let kastade = false;
    try { kor(spec); } catch { kastade = true; }
    check(`  och kor() vägrar köra den`, kastade);
  }

  /* --- Numeriska kanter ------------------------------------------------ */

  // Division med noll. Modellen är giltig, men iterationerna blir det inte.
  const nolldelning = kor(
    grundspec({
      inputs: [{ namn: "N", fordelning: { typ: "bernoulli", parametrar: { p: 0.5 } } }],
      outputs: [{ namn: "Y", uttryck: "100 / N" }],
      iterationer: 5000,
    }),
  );
  check("iterationer med division med noll förkastas", nolldelning.forkastadeIterationer > 0, nolldelning.forkastadeIterationer);
  check("och de RÄKNAS, inte göms", nolldelning.anmarkningar.some((a) => a.kod === "ogiltiga_iterationer"));
  check("anmärkningen är ett fel, inte bara en varning", nolldelning.anmarkningar.some((a) => a.allvar === "fel"));
  check("de giltiga iterationerna används ändå", nolldelning.iterationer > 0);
  check("och statistiken bär bara giltiga tal", Number.isFinite(nolldelning.outputs[0].statistik.medel));

  // En modell där ALLT blir ogiltigt ska kasta, inte leverera tomhet.
  let alltOgiltigt = false;
  try {
    kor(
      grundspec({
        inputs: [{ namn: "N", fordelning: { typ: "normal", parametrar: { mu: 0, sigma: 1 } } }],
        outputs: [{ namn: "Y", uttryck: "N / 0" }],
        iterationer: 1000,
      }),
    );
  } catch {
    alltOgiltigt = true;
  }
  check("en modell där varje iteration är ogiltig kastar", alltOgiltigt);

  // Noll varians: en modell som inte använder osäkerheten.
  const utanSpridning = kor(
    grundspec({
      inputs: [{ namn: "A", fordelning: { typ: "normal", parametrar: { mu: 5, sigma: 1 } } }],
      outputs: [{ namn: "Y", uttryck: "Fasta" }],
      iterationer: 2000,
    }),
  );
  check("en output utan spridning flaggas", utanSpridning.anmarkningar.some((a) => a.kod === "ingen_spridning"));
  check("och statistiken går ändå att räkna", utanSpridning.outputs[0].statistik.standardavvikelse === 0);

  // Mycket stora och mycket små tal.
  const extremt = kor(
    grundspec({
      inputs: [
        { namn: "Stor", fordelning: { typ: "uniform", parametrar: { min: 1e12, max: 1e13 } } },
        { namn: "Liten", fordelning: { typ: "uniform", parametrar: { min: 1e-12, max: 1e-11 } } },
      ],
      outputs: [{ namn: "Y", uttryck: "Stor * Liten" }],
      iterationer: 5000,
    }),
  );
  check("extrema storleksordningar ger ändliga tal", Number.isFinite(extremt.outputs[0].statistik.medel), extremt.outputs[0].statistik.medel);
  check("och inga förkastade iterationer", extremt.forkastadeIterationer === 0);

  // Negativa värden ska gå igenom orörda - ett bolag KAN gå back.
  const negativt = kor(
    grundspec({
      inputs: [{ namn: "A", fordelning: { typ: "normal", parametrar: { mu: -1000, sigma: 100 } } }],
      outputs: [{ namn: "Y", uttryck: "A" }],
      iterationer: 5000,
    }),
  );
  check("negativa utfall bevaras", negativt.outputs[0].statistik.medel < 0, negativt.outputs[0].statistik.medel);
  check("och sannolikheten för negativt är nära 1", negativt.outputs[0].sannolikheter.negativt > 0.99);

  // Ett mål utanför utfallsrymden ska ge 0 eller 1, inte NaN.
  const omojligtMal = kor(grundspec({ outputs: [{ namn: "Y", uttryck: "Kunder", mal: 1e9 }], iterationer: 2000 }));
  check("ett ouppnåeligt mål ger sannolikhet 0", omojligtMal.outputs[0].sannolikheter.narMal === 0);
  const sakertMal = kor(grundspec({ outputs: [{ namn: "Y", uttryck: "Kunder", mal: -1e9 }], iterationer: 2000 }));
  check("ett garanterat mål ger sannolikhet 1", sakertMal.outputs[0].sannolikheter.narMal === 1);

  // Få iterationer ska varna, inte tiga.
  const fa = kor(grundspec({ iterationer: 200 }));
  check("för få iterationer ger en varning", fa.anmarkningar.some((a) => a.kod === "fa_iterationer"));
}

/* ========================================================================== */
/* 9. Konvergens                                                              */
/* ========================================================================== */

{
  // Medianen ska röra sig MINDRE ju fler iterationer som körts. Det är
  // hela argumentet för att fler iterationer hjälper - och för att man
  // kan sluta.
  const spec = grundspec({ iterationer: 200000 });
  const r = kor(spec);
  const k = r.outputs[1].konvergens;
  check("konvergensen mäts vid flera punkter", k.length >= 5, k.length);
  check("punkterna är stigande i antal", k.every((p, i) => i === 0 || p.iterationer > k[i - 1].iterationer));

  const tidigtHopp = Math.abs(k[1].median - k[0].median);
  const sentHopp = Math.abs(k[k.length - 1].median - k[k.length - 2].median);
  check("medianen rör sig mindre mot slutet", sentHopp <= tidigtHopp, { tidigt: tidigtHopp, sent: sentHopp });
  check("den långa körningen bedöms stabil", r.outputs[1].stabil);

  // Och en körning som är för kort ska INTE påstås vara stabil.
  const kort = kor(grundspec({ iterationer: 300 }));
  check(
    "en kort körning flaggas som ostabil eller som för få iterationer",
    !kort.outputs[1].stabil || kort.anmarkningar.some((a) => a.kod === "fa_iterationer"),
    { stabil: kort.outputs[1].stabil, anm: kort.anmarkningar.map((a) => a.kod) },
  );
}

/* ========================================================================== */
/* 10. Känsligheten pekar ut rätt variabel                                    */
/* ========================================================================== */

{
  /*
   * Konstruerat så att svaret är känt: A har tio gånger B:s spridning och
   * går in i modellen med samma vikt. En känslighetsanalys som INTE sätter
   * A först är trasig, och det är just den listan en beslutsfattare
   * använder för att veta var osäkerheten sitter.
   */
  const r = kor({
    namn: "Känslighet",
    fro: 5,
    iterationer: 50000,
    inputs: [
      { namn: "A", fordelning: { typ: "normal", parametrar: { mu: 100, sigma: 50 } } },
      { namn: "B", fordelning: { typ: "normal", parametrar: { mu: 100, sigma: 5 } } },
      { namn: "C", fordelning: { typ: "normal", parametrar: { mu: 100, sigma: 1 } } },
    ],
    outputs: [{ namn: "Y", uttryck: "A + B + C" }],
  });
  const rank = r.outputs[0].kanslighet;
  check("den mest spridda variabeln hamnar först", rank[0].input === "A", rank.map((k) => k.input));
  check("och den minst spridda sist", rank[2].input === "C", rank.map((k) => k.input));
  check("den dominerande variabeln får störst andel", rank[0].andelAvVariation > 0.8, rank[0].andelAvVariation);
  check("korrelationen är positiv för en additiv term", rank[0].rangkorrelation > 0.9, rank[0].rangkorrelation);

  // En variabel som inte används alls ska hamna på noll.
  const oanvand = kor({
    namn: "Oanvänd",
    fro: 5,
    iterationer: 20000,
    inputs: [
      { namn: "A", fordelning: { typ: "normal", parametrar: { mu: 100, sigma: 50 } } },
      { namn: "Oanvand", fordelning: { typ: "normal", parametrar: { mu: 100, sigma: 50 } } },
    ],
    outputs: [{ namn: "Y", uttryck: "A" }],
  });
  const oanvandRank = oanvand.outputs[0].kanslighet.find((k) => k.input === "Oanvand");
  check("en variabel utan påverkan får nära noll", Math.abs(oanvandRank!.rangkorrelation) < 0.05, oanvandRank);

  // Negativt samband ska synas som negativ korrelation men positiv andel:
  // riktningen och styrkan är olika frågor.
  const negativt = kor({
    namn: "Negativ",
    fro: 5,
    iterationer: 20000,
    inputs: [{ namn: "Kostnad", fordelning: { typ: "normal", parametrar: { mu: 100, sigma: 30 } } }],
    outputs: [{ namn: "Vinst", uttryck: "1000 - Kostnad" }],
  });
  const kostnad = negativt.outputs[0].kanslighet[0];
  check("ett negativt samband ger negativ korrelation", kostnad.rangkorrelation < -0.9, kostnad.rangkorrelation);
  check("men andelen av variationen är positiv", kostnad.andelAvVariation > 0.99, kostnad.andelAvVariation);
}

/* ========================================================================== */
/* 11. Prestanda                                                              */
/* ========================================================================== */

{
  /*
   * Tröskeln är generös med flit. Kontrollen finns för att fånga en
   * REGRESSION i storleksordning - att någon råkar sortera per iteration
   * eller allokera i slingan - inte för att mäta maskinen den kör på.
   */
  for (const n of [1000, 10000, 100000]) {
    const t0 = Date.now();
    const r = kor(grundspec({ iterationer: n }));
    const ms = Math.max(1, Date.now() - t0);
    const perSekund = (n / ms) * 1000;
    check(`${n.toLocaleString("sv-SE")} iterationer klarar minst 20 000/s`, perSekund > 20000, Math.round(perSekund));
    check(`  och ger ${n} sampel`, r.iterationer === n);
  }

  const t0 = Date.now();
  const stor = kor(grundspec({ iterationer: 1000000 }));
  const ms = Date.now() - t0;
  check("en miljon iterationer går igenom", stor.iterationer === 1000000);
  check("på under 30 sekunder", ms < 30000, ms);
  check("och resultatet är stabilt", stor.outputs[1].stabil);
  // Medianen vid en miljon ska ligga nära den vid hundratusen - annars är
  // konvergensen en illusion.
  const hundratusen = kor(grundspec({ iterationer: 100000 }));
  const spann = stor.outputs[1].statistik.percentiler.p90 - stor.outputs[1].statistik.percentiler.p10;
  check(
    "medianen vid 1M ligger nära den vid 100k",
    Math.abs(stor.outputs[1].statistik.median - hundratusen.outputs[1].statistik.median) < spann * 0.05,
    { en_miljon: stor.outputs[1].statistik.median, hundratusen: hundratusen.outputs[1].statistik.median },
  );
}

/* --- 12. Beloppen som faktiskt visas ------------------------------------- */

/*
 * Felet som hittades genom att LÄSA SKÄRMEN, inte genom att köra motorn:
 * "den kritiska gränsen -500 tkr kr". Formateraren satte ut ett skalord
 * och panelen la på enheten en gång till. Tusen kronor är redan kronor.
 * Och "2.29 mn" hade decimalpunkt i en svensk siffra.
 *
 * Talen prövas med samma formatering som produkten använder, så de här
 * kontrollerna fångar även en ändrad lokal.
 */
{
  // sv-SE ger HÅRT blanksteg och ett riktigt minustecken (U+2212), inte
  // bindestreck. Att jämföra mot ASCII hade fällt provet på typografi i
  // stället för på innehåll - samma fälla som redan fällt tre tester i
  // produkten.
  const normal = (s: string) => s.replace(/\u00a0/g, " ").replace(/\u2212/g, "-");

  check("kronor under tio tusen skrivs ut", normal(beloppMedEnhet(1234, "kr")) === "1 234 kr", beloppMedEnhet(1234, "kr"));
  check("tusental blir tkr - utan ett andra kr", normal(beloppMedEnhet(-500000, "kr")) === "-500 tkr", beloppMedEnhet(-500000, "kr"));
  check("miljoner blir mkr", normal(beloppMedEnhet(2290000, "kr")) === "2,29 mkr", beloppMedEnhet(2290000, "kr"));
  check("ingen enhet dubbleras någonsin", ![1e3, 1e4, 1e5, 1e6, 1e7].some((v) => /kr\s+kr|tkr\s+kr|mkr\s+kr/.test(beloppMedEnhet(v, "kr"))));

  // Antal ska inte skalas: "40 st" är läsbart, "0 tst" är det inte.
  check("antal skalas inte", normal(beloppMedEnhet(40, "st")) === "40 st", beloppMedEnhet(40, "st"));
  check("stora antal behåller sin enhet", normal(beloppMedEnhet(40000, "st")) === "40 000 st", beloppMedEnhet(40000, "st"));
  // En andel rundas inte bort till noll.
  check("andelar överlever", normal(beloppMedEnhet(0.08, null)) === "0,08", beloppMedEnhet(0.08, null));
  check("utan enhet står talet ensamt", normal(beloppMedEnhet(12, null)) === "12", beloppMedEnhet(12, null));

  // Procenten: samma fel en rad upp på skärmen - "12.3 %" med
  // decimalpunkt i en svensk mening.
  check("procenten skrivs med komma", normal(procentAv(0.123)) === "12,3 %", procentAv(0.123));
  check("hel procent får ändå en decimal", normal(procentAv(0.2)) === "20,0 %", procentAv(0.2));
  check("okänd sannolikhet blir tankstreck, inte noll", procentAv(null) === "\u2013", procentAv(null));
  check("odefinierad likaså", procentAv(undefined) === "\u2013");
  check("ingen procent har decimalpunkt", ![0, 0.005, 0.123, 0.5, 1].some((v) => /\d\.\d/.test(procentAv(v))));

  // Axeln: skalord utan valuta, och svenskt decimaltecken.
  check("axeln skriver svenskt decimaltecken", normal(beloppKort(2290000)) === "2,29 mn", beloppKort(2290000));
  check("axeln skalar tusental", normal(beloppKort(83000)) === "83 tkr", beloppKort(83000));
  check("axeln lämnar små tal i fred", normal(beloppKort(250)) === "250", beloppKort(250));
  check(
    "axeln sätter aldrig ut en fristående valuta",
    ![250, 83000, 2290000].some((v) => /(^|\s)kr$|mkr/.test(beloppKort(v))),
    [250, 83000, 2290000].map(beloppKort),
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
