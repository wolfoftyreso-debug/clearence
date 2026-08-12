/**
 * SLUMPEN, OCH VARFÖR DEN INTE ÄR Math.random().
 *
 * En simulering som inte går att köra om är inte ett underlag. Den som
 * visar en fördelning för en bank, en rekonstruktör eller en styrelse
 * måste kunna svara på frågan "hur fick du fram den?" - och svaret ska
 * vara ett frö, inte "det gick inte att återskapa".
 *
 * `Math.random()` har inget frö. Den går inte att styra, inte att spara
 * och inte att köra om. Därför en egen generator.
 *
 * VALET: PCG32 (O'Neill 2014). Skälen, i tur och ordning:
 *
 *  - Den har ett FRÖ som helt bestämmer sekvensen.
 *  - Den klarar statistiska testsviter som en linjär kongruens faller på.
 *    En dålig generator ger korrelationer mellan på varandra följande tal,
 *    och i en Monte Carlo-simulering blir de korrelationerna till ett
 *    utfall som ser säkrare ut än det är. Det är det farligaste felet den
 *    här filen kan göra: en för smal fördelning läses som låg risk.
 *  - Perioden är 2^64. Vid en miljon iterationer och tio variabler är det
 *    tio miljoner dragningar - perioden ska vara ofattbart mycket större,
 *    annars börjar simuleringen upprepa sig själv.
 *  - Tillståndet är 64 bitar och går att spara som två 32-bitarsord, vilket
 *    är precis vad JavaScript kan räkna på exakt.
 *
 * IMPLEMENTATIONEN räknar 64-bitars aritmetik i 32-bitarshalvor, för
 * JavaScripts `number` är en double: heltal över 2^53 är inte längre
 * exakta, och en generator som tappar bitar tappar sin period. `BigInt`
 * hade varit enklare att läsa men är storleksordningar långsammare, och
 * den här koden körs tio miljoner gånger.
 */

/** 64-bitarsmultiplikatorn ur PCG-referensen, som två 32-bitarshalvor. */
const MULT_HI = 0x5851f42d;
const MULT_LO = 0x4c957f2d;
/** Ökningen (måste vara udda). Referensvärdet. */
const INC_HI = 0x14057b7e;
const INC_LO = 0xf767814f;

/**
 * En slumpström med sparbart tillstånd.
 *
 * Två strömmar med samma frö ger IDENTISKA sekvenser. Det är hela poängen
 * och prövas i tests/montecarlo.ts.
 */
export class Slumpstrom {
  /** Tillståndets höga 32 bitar. */
  private hi: number;
  /** Tillståndets låga 32 bitar. */
  private lo: number;
  /** Sparad andra normalvariabel ur Box-Muller. Se normal(). */
  private sparadNormal: number | null = null;

  constructor(readonly fro: number) {
    // Fröet blandas innan det används. Ett frö på 1 och ett på 2 ska ge
    // sekvenser som inte liknar varandra; utan blandningen börjar de nära.
    let h = Math.imul(fro ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
    let l = Math.imul(fro + 0x165667b1, 0xc2b2ae35) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    l = (l ^ (l >>> 16)) >>> 0;
    this.hi = h;
    this.lo = l;
    // Två varv för att komma bort från startvärdet.
    this.nastaUint32();
    this.nastaUint32();
  }

  /**
   * Nästa 32-bitars heltal, 0 .. 2^32-1.
   *
   * LCG-steget i 64 bitar, följt av PCG:s utgångsfunktion (XSH RR). Det är
   * utgångsfunktionen som gör skillnaden mot en vanlig LCG: den kastar bort
   * de svagaste bitarna och roterar resten med ett varv som självt beror på
   * tillståndet.
   */
  nastaUint32(): number {
    const hi = this.hi;
    const lo = this.lo;

    // 64-bitars multiplikation i 16-bitarsbitar, så att inget mellanled
    // överskrider 2^53 och tappar precision.
    const lo0 = lo & 0xffff;
    const lo1 = lo >>> 16;
    const m0 = MULT_LO & 0xffff;
    const m1 = MULT_LO >>> 16;

    const p00 = lo0 * m0;
    const p01 = lo0 * m1;
    const p10 = lo1 * m0;
    const p11 = lo1 * m1;

    const mellan = (p00 >>> 16) + (p01 & 0xffff) + (p10 & 0xffff);
    const nyLoUtanInc = (((mellan & 0xffff) << 16) | (p00 & 0xffff)) >>> 0;
    const bar = (mellan >>> 16) + (p01 >>> 16) + (p10 >>> 16) + p11;
    // De höga 32 bitarna: bäringen plus korstermerna.
    const nyHiUtanInc =
      (bar + Math.imul(lo, MULT_HI) + Math.imul(hi, MULT_LO)) >>> 0;

    // Addera ökningen, med bäring från låg till hög.
    const summaLo = (nyLoUtanInc + INC_LO) >>> 0;
    const bering = summaLo < nyLoUtanInc >>> 0 ? 1 : 0;
    this.lo = summaLo;
    this.hi = (nyHiUtanInc + INC_HI + bering) >>> 0;

    // XSH RR: xorshift ned, sedan rotation styrd av de fem översta bitarna.
    const xorshifted = (((hi >>> 13) ^ ((lo >>> 27) | (hi << 5))) >>> 0) >>> 0;
    const rot = hi >>> 27;
    return rot === 0
      ? xorshifted
      : (((xorshifted >>> rot) | (xorshifted << (32 - rot))) >>> 0);
  }

  /**
   * Likformig i [0, 1).
   *
   * 53 bitar ur två dragningar, alltså hela mantissan i en double. Att
   * bara dela ett 32-bitarstal med 2^32 hade gett drygt fyra miljarder
   * möjliga värden - vid en miljon iterationer syns det som synliga steg i
   * en tät fördelningskurva.
   */
  nasta(): number {
    const hog = this.nastaUint32() >>> 5; // 27 bitar
    const lag = this.nastaUint32() >>> 6; // 26 bitar
    return (hog * 67108864 + lag) / 9007199254740992;
  }

  /**
   * Likformig i (0, 1).
   *
   * Flera fördelningar (lognormal, exponential) tar logaritmen av talet,
   * och log(0) är -oändligt. Noll skulle alltså tyst förvandla ett utfall
   * till -Infinity, som sedan förorenar varje summa det ingår i. Därför
   * dras om i stället för att klippas: en klippning hade snedvridit
   * fördelningens svans, en omdragning gör det inte.
   */
  nastaOppen(): number {
    for (let i = 0; i < 10; i++) {
      const u = this.nasta();
      if (u > 0 && u < 1) return u;
    }
    // Praktiskt taget oåtkomligt (sannolikheten är ~2^-530), men en
    // returnerad nolla här hade blivit en tyst -Infinity längre ned.
    return 0.5;
  }

  /**
   * Standardnormalfördelad, N(0,1). Box-Muller i polär form (Marsaglia).
   *
   * Polärformen slipper sin och cos, som är dyra och dessutom en av de
   * platser där olika JavaScript-motorer ger olika sista bit - och då är
   * simuleringen inte längre reproducerbar mellan webbläsare och server.
   *
   * Metoden ger TVÅ oberoende värden per varv. Det andra sparas; att kasta
   * det hade fördubblat arbetet för varje normalfördelad variabel.
   */
  normal(): number {
    if (this.sparadNormal !== null) {
      const v = this.sparadNormal;
      this.sparadNormal = null;
      return v;
    }
    let u: number;
    let v: number;
    let s: number;
    do {
      u = this.nasta() * 2 - 1;
      v = this.nasta() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const faktor = Math.sqrt((-2 * Math.log(s)) / s);
    this.sparadNormal = v * faktor;
    return u * faktor;
  }

  /**
   * Gammafördelad med formparameter k >= 0, skala 1.
   *
   * Marsaglia-Tsang. Behövs av beta (som är en kvot av två gamma) och
   * ligger här för att den kräver både normal- och likformiga dragningar
   * ur SAMMA ström - annars bryts reproducerbarheten.
   */
  gamma(k: number): number {
    if (k < 1) {
      // Boost-tricket: gamma(k) = gamma(k+1) * U^(1/k).
      const u = this.nastaOppen();
      return this.gamma(k + 1) * Math.pow(u, 1 / k);
    }
    const d = k - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x: number;
      let v: number;
      do {
        x = this.normal();
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const u = this.nastaOppen();
      if (u < 1 - 0.0331 * x * x * x * x) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }
}

/**
 * Fröet som en användare kan ange, eller ett som väljs åt hen.
 *
 * Ett frö MÅSTE alltid finnas och alltid sparas - annars går körningen
 * inte att upprepa, och då är den inte ett underlag. Väljs det åt
 * användaren väljs det EN gång och skrivs ned; det får aldrig läsas ur
 * klockan vid själva körningen.
 */
export const nyttFro = (slump: () => number = Math.random): number =>
  Math.floor(slump() * 0x7fffffff) >>> 0;
