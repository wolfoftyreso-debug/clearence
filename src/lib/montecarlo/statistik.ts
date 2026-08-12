/**
 * STATISTIKEN: från en miljon tal till något en människa kan besluta på.
 *
 * Filen är ren aritmetik utan I/O, och den bär tre ställningstaganden som
 * är värda att skriva ut, för de påverkar vad användaren får se.
 *
 * 1. PERCENTILER RÄKNAS PÅ SORTERADE SAMPEL, inte på en antagen
 *    normalfördelning. Hela poängen med Monte Carlo är att utfallet INTE
 *    behöver vara normalfördelat - att sedan räkna P90 som "medel + 1,28σ"
 *    hade kastat bort just det. Interpolationen är den vanliga (typ 7,
 *    samma som R och numpy använder som standard), så en siffra går att
 *    kontrollera mot ett annat verktyg.
 *
 * 2. VARIANSEN RÄKNAS MED WELFORDS METOD. Den naiva formeln
 *    E[X²] - E[X]² subtraherar två stora och nästan lika tal, och tappar
 *    då nästan all precision när spridningen är liten i förhållande till
 *    nivån. Ett bolag med 50 miljoner i omsättning och 200 000 i
 *    osäkerhet är precis det fallet, och den naiva formeln kan där ge en
 *    NEGATIV varians. Welford gör en genomgång och är numeriskt stabil.
 *
 * 3. KONFIDENSINTERVALLET GÄLLER MEDELVÄRDET, inte utfallet. Det är
 *    simuleringsosäkerhet - "hur säkra är vi på var mitten ligger, givet
 *    att vi bara körde N gånger" - och inte "här hamnar resultatet med
 *    95 % sannolikhet". Att blanda ihop de två är det vanligaste sättet
 *    att läsa en Monte Carlo-analys fel, och därför heter fältet
 *    `medelvardetsKonfidensintervall` och inget kortare.
 */

/* -------------------------------------------------------------------------- */
/* Formen                                                                     */
/* -------------------------------------------------------------------------- */

export interface Percentiler {
  p5: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface Statistik {
  antal: number;
  medel: number;
  median: number;
  min: number;
  max: number;
  standardavvikelse: number;
  varians: number;
  percentiler: Percentiler;
  /**
   * 95 % konfidensintervall FÖR MEDELVÄRDET (simuleringsosäkerheten).
   * Inte ett intervall för utfallet - det är P5..P95.
   */
  medelvardetsKonfidensintervall: { nedre: number; ovre: number };
  /** Standardfelet för medelvärdet: σ/√n. Krymper som roten ur N. */
  standardfel: number;
}

export interface Histogram {
  /** Nedre kant för varje stapel. */
  kanter: number[];
  /** Antal sampel i varje stapel. kanter.length === antal.length + 1. */
  antal: number[];
  /** Stapelbredden. Konstant. */
  bredd: number;
}

/* -------------------------------------------------------------------------- */
/* Percentiler                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Percentil ur en SORTERAD stigande array.
 *
 * Linjär interpolation mellan grannar (typ 7). Kravet att indata redan är
 * sorterad är avsiktligt: funktionen anropas åtta gånger per output, och
 * att sortera om varje gång hade gjort en miljon sampel till åtta
 * sorteringar i stället för en.
 */
export const percentil = (sorterad: ArrayLike<number>, p: number): number => {
  const n = sorterad.length;
  if (n === 0) return Number.NaN;
  if (n === 1) return sorterad[0];
  const pos = (n - 1) * Math.min(1, Math.max(0, p));
  const lag = Math.floor(pos);
  const hog = Math.ceil(pos);
  if (lag === hog) return sorterad[lag];
  const andel = pos - lag;
  return sorterad[lag] * (1 - andel) + sorterad[hog] * andel;
};

/* -------------------------------------------------------------------------- */
/* Sammanfattningen                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Hela statistiken för en outputserie.
 *
 * `sorterad` MÅSTE vara stigande sorterad - anroparen sorterar en gång och
 * återanvänder resultatet för både percentiler och sannolikheter.
 */
export const sammanfatta = (sorterad: Float64Array): Statistik => {
  const n = sorterad.length;
  if (n === 0) {
    throw new Error("Statistik kan inte räknas på noll sampel.");
  }

  // Welford i en genomgång. Se filens inledning för varför inte E[X²]-E[X]².
  let medel = 0;
  let m2 = 0;
  for (let i = 0; i < n; i++) {
    const x = sorterad[i];
    const delta = x - medel;
    medel += delta / (i + 1);
    m2 += delta * (x - medel);
  }
  // Stickprovsvarians (n-1). Vid n=1 finns ingen spridning att skatta.
  const varians = n > 1 ? m2 / (n - 1) : 0;
  const std = Math.sqrt(Math.max(0, varians));
  const standardfel = n > 0 ? std / Math.sqrt(n) : 0;

  return {
    antal: n,
    medel,
    median: percentil(sorterad, 0.5),
    min: sorterad[0],
    max: sorterad[n - 1],
    standardavvikelse: std,
    varians,
    percentiler: {
      p5: percentil(sorterad, 0.05),
      p10: percentil(sorterad, 0.1),
      p25: percentil(sorterad, 0.25),
      p50: percentil(sorterad, 0.5),
      p75: percentil(sorterad, 0.75),
      p90: percentil(sorterad, 0.9),
      p95: percentil(sorterad, 0.95),
      p99: percentil(sorterad, 0.99),
    },
    // 1,959964 = normalfördelningens 97,5-percentil. Centrala gränsvärdes-
    // satsen gäller för MEDELVÄRDET även när utfallet är skevt, vilket är
    // varför normalapproximationen är rimlig just här och inte för P90.
    medelvardetsKonfidensintervall: {
      nedre: medel - 1.959964 * standardfel,
      ovre: medel + 1.959964 * standardfel,
    },
    standardfel,
  };
};

/* -------------------------------------------------------------------------- */
/* Sannolikheter                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Andelen sampel som är >= troskeln. Binärsökning i den sorterade serien.
 *
 * Linjär genomsökning hade kostat en miljon jämförelser per fråga, och
 * gränssnittet frågar om flera trösklar samtidigt medan användaren drar i
 * ett reglage.
 */
export const sannolikhetMinst = (sorterad: ArrayLike<number>, troskel: number): number => {
  const n = sorterad.length;
  if (n === 0) return Number.NaN;
  // Första index med värde >= troskel.
  let lag = 0;
  let hog = n;
  while (lag < hog) {
    const mid = (lag + hog) >>> 1;
    if (sorterad[mid] < troskel) lag = mid + 1;
    else hog = mid;
  }
  return (n - lag) / n;
};

/** Andelen sampel som är < troskeln. Komplementet till sannolikhetMinst. */
export const sannolikhetUnder = (sorterad: ArrayLike<number>, troskel: number): number =>
  1 - sannolikhetMinst(sorterad, troskel);

/* -------------------------------------------------------------------------- */
/* Histogram                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Binnar serien för visualisering.
 *
 * ANTALET STAPLAR ÄR EN VISNINGSPARAMETER, inte en statistisk. För få
 * staplar gömmer en tvåpucklig fördelning - och en tvåpucklig fördelning
 * betyder att två olika utfall är troliga, vilket är precis det en
 * beslutsfattare måste se. Standarden är därför 50, inte 10.
 *
 * En serie utan spridning (alla värden lika) får EN stapel med hela
 * massan. Att dela med noll hade gett NaN-kanter och en tom graf.
 */
export const histogram = (sorterad: Float64Array, staplar = 50): Histogram => {
  const n = sorterad.length;
  if (n === 0) return { kanter: [], antal: [], bredd: 0 };
  const min = sorterad[0];
  const max = sorterad[n - 1];

  if (max === min) {
    return { kanter: [min, min], antal: [n], bredd: 0 };
  }

  const antalStaplar = Math.max(1, Math.min(500, Math.floor(staplar)));
  const bredd = (max - min) / antalStaplar;
  const kanter = new Array<number>(antalStaplar + 1);
  for (let i = 0; i <= antalStaplar; i++) kanter[i] = min + i * bredd;
  // Sista kanten sätts exakt, så att maxvärdet garanterat ryms.
  kanter[antalStaplar] = max;

  const antal = new Array<number>(antalStaplar).fill(0);
  for (let i = 0; i < n; i++) {
    let idx = Math.floor((sorterad[i] - min) / bredd);
    // Maxvärdet hamnar annars i en stapel som inte finns.
    if (idx >= antalStaplar) idx = antalStaplar - 1;
    if (idx < 0) idx = 0;
    antal[idx]++;
  }
  return { kanter, antal, bredd };
};

/* -------------------------------------------------------------------------- */
/* Rangkorrelation - grunden för känslighetsanalysen                          */
/* -------------------------------------------------------------------------- */

/**
 * Spearmans rangkorrelation mellan två serier.
 *
 * RANG och inte Pearson, av ett skäl som betyder mycket i praktiken:
 * Pearson mäter LINJÄRT samband. En input som påverkar resultatet kraftigt
 * men inte rätlinjigt - en kostnad som slår till först över en tröskel,
 * en ränta som slår igenom multiplikativt - får då ett lågt värde och
 * hamnar sist i känslighetslistan trots att den styr utfallet. Spearman
 * mäter MONOTONT samband och fångar båda.
 *
 * Lika värden (vanligt vid diskreta fördelningar som bernoulli) får
 * medelrang. Utan det blir korrelationen systematiskt fel för just de
 * variabler som bara har två utfall.
 */
export const rangkorrelation = (a: Float64Array, b: Float64Array): number => {
  const n = a.length;
  if (n !== b.length) throw new Error("Serierna måste vara lika långa.");
  if (n < 3) return 0;

  const rangA = rangera(a);
  const rangB = rangera(b);

  let medelA = 0;
  let medelB = 0;
  for (let i = 0; i < n; i++) {
    medelA += rangA[i];
    medelB += rangB[i];
  }
  medelA /= n;
  medelB /= n;

  let tal = 0;
  let kvadA = 0;
  let kvadB = 0;
  for (let i = 0; i < n; i++) {
    const da = rangA[i] - medelA;
    const db = rangB[i] - medelB;
    tal += da * db;
    kvadA += da * da;
    kvadB += db * db;
  }
  // Noll varians i någon serie = ingen rang att korrelera. Det inträffar
  // när en input satts till en konstant, och svaret är då 0, inte NaN.
  if (kvadA === 0 || kvadB === 0) return 0;
  return tal / Math.sqrt(kvadA * kvadB);
};

/** Rangerar en serie, med medelrang vid lika värden. */
const rangera = (v: Float64Array): Float64Array => {
  const n = v.length;
  const idx = new Int32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  // Sortera index efter värde.
  const arr = Array.from(idx);
  arr.sort((x, y) => v[x] - v[y]);

  const rang = new Float64Array(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && v[arr[j + 1]] === v[arr[i]]) j++;
    // Medelrangen för hela gruppen av lika värden (1-indexerat).
    const medel = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) rang[arr[k]] = medel;
    i = j + 1;
  }
  return rang;
};
