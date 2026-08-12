/**
 * FÖRDELNINGARNA: osäkerheten uttryckt som något man kan räkna på.
 *
 * En Monte Carlo-simulering är inte bättre än sina antaganden. Den här
 * filen är där antagandena bor, och därför gäller tre regler i den:
 *
 *  1. EN OGILTIG FÖRDELNING SKA ALDRIG GÅ ATT SAMPLA. `validera()` körs
 *     innan en enda dragning sker, och den beskriver felet på svenska för
 *     den som ska rätta det. En triangulär fördelning med topp utanför
 *     [min, max] är inte "nästan rätt" - den saknar mening, och en motor
 *     som ändå ger tal producerar ett underlag som ser giltigt ut.
 *
 *  2. VARJE FÖRDELNING BÄR SINA TEORETISKA MOMENT. `moment()` säger vad
 *     väntevärdet och variansen SKA bli. Det är inte dekoration: sviten
 *     drar hundratusen sampel och jämför mot dem, och det är enda sättet
 *     att veta att en samplare faktiskt implementerar den fördelning den
 *     påstår sig vara. En felvänd parameter ger annars en helt rimlig
 *     kurva av fel sort.
 *
 *  3. SAMPLINGEN TAR EN STRÖM, ALDRIG Math.random(). Reproducerbarheten
 *     är hela produktens löfte om att ett resultat går att granska.
 *
 * PARAMETRARNAS NAMN är de gängse i statistiken (mu, sigma, lambda) och
 * inte översatta: den som läser en lärobok eller kontrollerar mot en
 * annan implementation ska känna igen sig.
 */

import type { Slumpstrom } from "./slump";

/* -------------------------------------------------------------------------- */
/* Formen                                                                     */
/* -------------------------------------------------------------------------- */

export type FordelningsTyp =
  | "normal"
  | "lognormal"
  | "uniform"
  | "triangular"
  | "beta"
  | "exponential"
  | "poisson"
  | "bernoulli"
  | "binomial"
  | "discrete"
  | "custom";

/**
 * En fördelning som den lagras och skickas över nätet.
 *
 * Parametrarna ligger i en namngiven karta i stället för som positionella
 * fält: det gör en sparad simulering läsbar utan att man känner ordningen,
 * och en ny fördelning kräver ingen schemaändring.
 */
export interface Fordelning {
  typ: FordelningsTyp;
  parametrar: Record<string, number>;
  /**
   * För `discrete`: värdena och deras vikter. För `custom`: stödpunkter i
   * en empirisk fördelning, som samplas med linjär interpolation.
   */
  punkter?: { varde: number; vikt: number }[];
}

export interface Moment {
  /** Väntevärdet. null när fördelningen saknar ett ändligt sådant. */
  vantevarde: number | null;
  /** Variansen. null när den inte är ändlig. */
  varians: number | null;
}

export interface FordelningsFel {
  parameter: string;
  meddelande: string;
}

/* -------------------------------------------------------------------------- */
/* Registret                                                                  */
/* -------------------------------------------------------------------------- */

interface Definition {
  typ: FordelningsTyp;
  /** Namnet som visas i gränssnittet. */
  namn: string;
  /** En rad som förklarar NÄR fördelningen är rätt val. */
  narAnvands: string;
  /** Parametrarna i den ordning de ska visas. */
  parametrar: { nyckel: string; etikett: string; beskrivning: string }[];
  /** Sant för fördelningar som bara ger heltal. */
  diskret: boolean;
  validera: (f: Fordelning) => FordelningsFel[];
  sampla: (f: Fordelning, s: Slumpstrom) => number;
  moment: (f: Fordelning) => Moment;
}

const tal = (f: Fordelning, nyckel: string): number => f.parametrar[nyckel];

/** Ett ändligt tal, inte NaN och inte oändligt. */
const arTal = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const kravTal = (f: Fordelning, nyckel: string, etikett: string): FordelningsFel[] =>
  arTal(f.parametrar[nyckel])
    ? []
    : [{ parameter: nyckel, meddelande: `${etikett} saknas eller är inte ett ändligt tal.` }];

const REGISTER: Definition[] = [
  {
    typ: "normal",
    namn: "Normal",
    narAnvands:
      "Symmetrisk osäkerhet kring ett väntevärde. Passar när avvikelser åt båda håll är lika troliga.",
    parametrar: [
      { nyckel: "mu", etikett: "Väntevärde (μ)", beskrivning: "Fördelningens mitt." },
      { nyckel: "sigma", etikett: "Standardavvikelse (σ)", beskrivning: "Spridningen. Måste vara > 0." },
    ],
    diskret: false,
    validera: (f) => {
      const fel = [...kravTal(f, "mu", "Väntevärdet"), ...kravTal(f, "sigma", "Standardavvikelsen")];
      if (fel.length === 0 && tal(f, "sigma") <= 0) {
        fel.push({
          parameter: "sigma",
          meddelande:
            "Standardavvikelsen måste vara större än noll. Ett värde utan spridning är en konstant, inte en fördelning.",
        });
      }
      return fel;
    },
    sampla: (f, s) => tal(f, "mu") + tal(f, "sigma") * s.normal(),
    moment: (f) => ({ vantevarde: tal(f, "mu"), varians: tal(f, "sigma") ** 2 }),
  },

  {
    typ: "lognormal",
    namn: "Lognormal",
    narAnvands:
      "Storheter som inte kan bli negativa och har en lång svans uppåt - intäkter, priser, tider.",
    parametrar: [
      { nyckel: "mu", etikett: "μ (av logaritmen)", beskrivning: "Väntevärdet för ln(X)." },
      { nyckel: "sigma", etikett: "σ (av logaritmen)", beskrivning: "Standardavvikelsen för ln(X). > 0." },
    ],
    diskret: false,
    validera: (f) => {
      const fel = [...kravTal(f, "mu", "μ"), ...kravTal(f, "sigma", "σ")];
      if (fel.length === 0 && tal(f, "sigma") <= 0) {
        fel.push({ parameter: "sigma", meddelande: "σ måste vara större än noll." });
      }
      return fel;
    },
    sampla: (f, s) => Math.exp(tal(f, "mu") + tal(f, "sigma") * s.normal()),
    moment: (f) => {
      const mu = tal(f, "mu");
      const s2 = tal(f, "sigma") ** 2;
      const m = Math.exp(mu + s2 / 2);
      return { vantevarde: m, varians: (Math.exp(s2) - 1) * Math.exp(2 * mu + s2) };
    },
  },

  {
    typ: "uniform",
    namn: "Likformig",
    narAnvands:
      "Allt inom ett intervall är lika troligt. Ärligast när man bara känner ytterligheterna.",
    parametrar: [
      { nyckel: "min", etikett: "Minimum", beskrivning: "Nedre gräns." },
      { nyckel: "max", etikett: "Maximum", beskrivning: "Övre gräns. Måste vara > minimum." },
    ],
    diskret: false,
    validera: (f) => {
      const fel = [...kravTal(f, "min", "Minimum"), ...kravTal(f, "max", "Maximum")];
      if (fel.length === 0 && tal(f, "max") <= tal(f, "min")) {
        fel.push({ parameter: "max", meddelande: "Maximum måste vara större än minimum." });
      }
      return fel;
    },
    sampla: (f, s) => {
      const a = tal(f, "min");
      return a + (tal(f, "max") - a) * s.nasta();
    },
    moment: (f) => {
      const a = tal(f, "min");
      const b = tal(f, "max");
      return { vantevarde: (a + b) / 2, varians: (b - a) ** 2 / 12 };
    },
  },

  {
    typ: "triangular",
    namn: "Triangulär",
    narAnvands:
      "Lägsta, troligaste och högsta värde. Den fördelning en människa faktiskt kan uppskatta.",
    parametrar: [
      { nyckel: "min", etikett: "Lägsta", beskrivning: "Absolut nedre gräns." },
      { nyckel: "mode", etikett: "Troligaste", beskrivning: "Toppen. Måste ligga i [lägsta, högsta]." },
      { nyckel: "max", etikett: "Högsta", beskrivning: "Absolut övre gräns." },
    ],
    diskret: false,
    validera: (f) => {
      const fel = [
        ...kravTal(f, "min", "Lägsta"),
        ...kravTal(f, "mode", "Troligaste"),
        ...kravTal(f, "max", "Högsta"),
      ];
      if (fel.length > 0) return fel;
      const a = tal(f, "min");
      const c = tal(f, "mode");
      const b = tal(f, "max");
      if (b <= a) fel.push({ parameter: "max", meddelande: "Högsta måste vara större än lägsta." });
      if (c < a || c > b) {
        fel.push({
          parameter: "mode",
          meddelande:
            "Det troligaste värdet måste ligga mellan lägsta och högsta. En topp utanför intervallet beskriver ingen fördelning.",
        });
      }
      return fel;
    },
    sampla: (f, s) => {
      const a = tal(f, "min");
      const c = tal(f, "mode");
      const b = tal(f, "max");
      const u = s.nasta();
      const brytpunkt = (c - a) / (b - a);
      return u < brytpunkt
        ? a + Math.sqrt(u * (b - a) * (c - a))
        : b - Math.sqrt((1 - u) * (b - a) * (b - c));
    },
    moment: (f) => {
      const a = tal(f, "min");
      const c = tal(f, "mode");
      const b = tal(f, "max");
      return {
        vantevarde: (a + b + c) / 3,
        varians: (a * a + b * b + c * c - a * b - a * c - b * c) / 18,
      };
    },
  },

  {
    typ: "beta",
    namn: "Beta",
    narAnvands:
      "Andelar och sannolikheter mellan 0 och 1 - konverteringsgrad, andel som betalar i tid.",
    parametrar: [
      { nyckel: "alpha", etikett: "α", beskrivning: "Formparameter. > 0." },
      { nyckel: "beta", etikett: "β", beskrivning: "Formparameter. > 0." },
    ],
    diskret: false,
    validera: (f) => {
      const fel = [...kravTal(f, "alpha", "α"), ...kravTal(f, "beta", "β")];
      if (fel.length === 0) {
        if (tal(f, "alpha") <= 0) fel.push({ parameter: "alpha", meddelande: "α måste vara större än noll." });
        if (tal(f, "beta") <= 0) fel.push({ parameter: "beta", meddelande: "β måste vara större än noll." });
      }
      return fel;
    },
    sampla: (f, s) => {
      // Beta(a,b) = X/(X+Y) med X~Gamma(a), Y~Gamma(b). Båda ur samma ström.
      const x = s.gamma(tal(f, "alpha"));
      const y = s.gamma(tal(f, "beta"));
      const summa = x + y;
      // Två underflödade gamma ger 0/0. Mitten är den enda meningsfulla
      // utvägen, och den inträffar bara vid extrema parametrar.
      return summa === 0 ? 0.5 : x / summa;
    },
    moment: (f) => {
      const a = tal(f, "alpha");
      const b = tal(f, "beta");
      return {
        vantevarde: a / (a + b),
        varians: (a * b) / ((a + b) ** 2 * (a + b + 1)),
      };
    },
  },

  {
    typ: "exponential",
    namn: "Exponential",
    narAnvands: "Väntetider mellan händelser. Minneslös: det som gått spelar ingen roll.",
    parametrar: [
      { nyckel: "lambda", etikett: "Intensitet (λ)", beskrivning: "Händelser per tidsenhet. > 0." },
    ],
    diskret: false,
    validera: (f) => {
      const fel = kravTal(f, "lambda", "Intensiteten");
      if (fel.length === 0 && tal(f, "lambda") <= 0) {
        fel.push({ parameter: "lambda", meddelande: "Intensiteten måste vara större än noll." });
      }
      return fel;
    },
    // Inversmetoden. nastaOppen() och inte nasta(): log(0) är -oändligt.
    sampla: (f, s) => -Math.log(s.nastaOppen()) / tal(f, "lambda"),
    moment: (f) => {
      const l = tal(f, "lambda");
      return { vantevarde: 1 / l, varians: 1 / (l * l) };
    },
  },

  {
    typ: "poisson",
    namn: "Poisson",
    narAnvands: "Antal händelser under en period - inkommande ärenden, avhopp, reklamationer.",
    parametrar: [{ nyckel: "lambda", etikett: "Väntat antal (λ)", beskrivning: "Genomsnittligt antal. > 0." }],
    diskret: true,
    validera: (f) => {
      const fel = kravTal(f, "lambda", "Väntat antal");
      if (fel.length === 0 && tal(f, "lambda") <= 0) {
        fel.push({ parameter: "lambda", meddelande: "Väntat antal måste vara större än noll." });
      }
      return fel;
    },
    sampla: (f, s) => {
      const lambda = tal(f, "lambda");
      if (lambda < 30) {
        // Knuths metod. Exakt, och snabb för små λ.
        const grans = Math.exp(-lambda);
        let k = 0;
        let p = 1;
        do {
          k++;
          p *= s.nasta();
        } while (p > grans);
        return k - 1;
      }
      /*
       * För stora λ blir Knuth långsam (den drar i snitt λ tal per sampel)
       * OCH numeriskt osäker: exp(-λ) underflödar till noll runt λ≈745, och
       * då blir slingan oändlig. Normalapproximationen med kontinuitets-
       * korrigering är noggrann långt under λ=30 och kostar en dragning.
       */
      const v = Math.round(lambda + Math.sqrt(lambda) * s.normal());
      return v < 0 ? 0 : v;
    },
    moment: (f) => ({ vantevarde: tal(f, "lambda"), varians: tal(f, "lambda") }),
  },

  {
    typ: "bernoulli",
    namn: "Bernoulli",
    narAnvands: "Inträffar eller inte. En kund som betalar, en ansökan som beviljas.",
    parametrar: [{ nyckel: "p", etikett: "Sannolikhet (p)", beskrivning: "Mellan 0 och 1." }],
    diskret: true,
    validera: (f) => {
      const fel = kravTal(f, "p", "Sannolikheten");
      if (fel.length === 0 && (tal(f, "p") < 0 || tal(f, "p") > 1)) {
        fel.push({ parameter: "p", meddelande: "Sannolikheten måste ligga mellan 0 och 1." });
      }
      return fel;
    },
    sampla: (f, s) => (s.nasta() < tal(f, "p") ? 1 : 0),
    moment: (f) => {
      const p = tal(f, "p");
      return { vantevarde: p, varians: p * (1 - p) };
    },
  },

  {
    typ: "binomial",
    namn: "Binomial",
    narAnvands: "Antal lyckade av n oberoende försök - hur många av 200 fakturor som betalas i tid.",
    parametrar: [
      { nyckel: "n", etikett: "Antal försök (n)", beskrivning: "Heltal ≥ 0." },
      { nyckel: "p", etikett: "Sannolikhet (p)", beskrivning: "Mellan 0 och 1." },
    ],
    diskret: true,
    validera: (f) => {
      const fel = [...kravTal(f, "n", "Antal försök"), ...kravTal(f, "p", "Sannolikheten")];
      if (fel.length > 0) return fel;
      if (!Number.isInteger(tal(f, "n")) || tal(f, "n") < 0) {
        fel.push({ parameter: "n", meddelande: "Antal försök måste vara ett heltal som inte är negativt." });
      }
      if (tal(f, "p") < 0 || tal(f, "p") > 1) {
        fel.push({ parameter: "p", meddelande: "Sannolikheten måste ligga mellan 0 och 1." });
      }
      // Ett tak: n dragningar per sampel gånger en miljon iterationer blir
      // ogenomförbart långt innan det blir fel. Bättre ett tydligt nej.
      if (tal(f, "n") > 100000) {
        fel.push({
          parameter: "n",
          meddelande: "Antal försök över 100 000 är för dyrt att simulera exakt. Använd en normalapproximation i stället.",
        });
      }
      return fel;
    },
    sampla: (f, s) => {
      const n = tal(f, "n");
      const p = tal(f, "p");
      let k = 0;
      for (let i = 0; i < n; i++) if (s.nasta() < p) k++;
      return k;
    },
    moment: (f) => {
      const n = tal(f, "n");
      const p = tal(f, "p");
      return { vantevarde: n * p, varians: n * p * (1 - p) };
    },
  },

  {
    typ: "discrete",
    namn: "Diskret",
    narAnvands: "Ett fåtal namngivna utfall med var sin vikt - tre scenarier, fyra utfall i en tvist.",
    parametrar: [],
    diskret: true,
    validera: (f) => {
      const p = f.punkter ?? [];
      if (p.length === 0) {
        return [{ parameter: "punkter", meddelande: "En diskret fördelning behöver minst ett utfall." }];
      }
      const fel: FordelningsFel[] = [];
      for (const [i, punkt] of p.entries()) {
        if (!arTal(punkt.varde)) {
          fel.push({ parameter: `punkter[${i}].varde`, meddelande: "Utfallet är inte ett ändligt tal." });
        }
        if (!arTal(punkt.vikt) || punkt.vikt < 0) {
          fel.push({ parameter: `punkter[${i}].vikt`, meddelande: "Vikten måste vara ett tal som inte är negativt." });
        }
      }
      if (fel.length === 0 && p.reduce((a, x) => a + x.vikt, 0) <= 0) {
        fel.push({
          parameter: "punkter",
          meddelande: "Vikterna summerar till noll - då finns inget utfall som kan inträffa.",
        });
      }
      return fel;
    },
    sampla: (f, s) => {
      const p = f.punkter ?? [];
      const summa = p.reduce((a, x) => a + x.vikt, 0);
      let u = s.nasta() * summa;
      for (const punkt of p) {
        u -= punkt.vikt;
        if (u <= 0) return punkt.varde;
      }
      // Avrundningsfel i summan kan lämna ett hårstrå över.
      return p[p.length - 1].varde;
    },
    moment: (f) => {
      const p = f.punkter ?? [];
      const summa = p.reduce((a, x) => a + x.vikt, 0);
      if (summa <= 0) return { vantevarde: null, varians: null };
      const m = p.reduce((a, x) => a + (x.vikt / summa) * x.varde, 0);
      const v = p.reduce((a, x) => a + (x.vikt / summa) * (x.varde - m) ** 2, 0);
      return { vantevarde: m, varians: v };
    },
  },

  {
    typ: "custom",
    namn: "Egen (empirisk)",
    narAnvands:
      "Historiska utfall som fördelning. Stödpunkterna tolkas som en kurva och samplas med interpolation.",
    parametrar: [],
    diskret: false,
    validera: (f) => {
      const p = f.punkter ?? [];
      if (p.length < 2) {
        return [
          {
            parameter: "punkter",
            meddelande: "En egen fördelning behöver minst två stödpunkter för att kunna interpoleras.",
          },
        ];
      }
      const fel: FordelningsFel[] = [];
      for (const [i, punkt] of p.entries()) {
        if (!arTal(punkt.varde)) {
          fel.push({ parameter: `punkter[${i}].varde`, meddelande: "Stödpunkten är inte ett ändligt tal." });
        }
        if (!arTal(punkt.vikt) || punkt.vikt < 0) {
          fel.push({ parameter: `punkter[${i}].vikt`, meddelande: "Vikten måste vara ett tal som inte är negativt." });
        }
      }
      if (fel.length === 0 && p.reduce((a, x) => a + x.vikt, 0) <= 0) {
        fel.push({ parameter: "punkter", meddelande: "Vikterna summerar till noll." });
      }
      return fel;
    },
    sampla: (f, s) => {
      // Stödpunkterna sorteras och tolkas som en styckvis linjär täthet.
      const p = [...(f.punkter ?? [])].sort((a, b) => a.varde - b.varde);
      const summa = p.reduce((a, x) => a + x.vikt, 0);
      let u = s.nasta() * summa;
      for (let i = 0; i < p.length; i++) {
        u -= p[i].vikt;
        if (u <= 0) {
          // Interpolera mot grannen, annars blir "egen fördelning" bara en
          // diskret fördelning med finare steg.
          const granne = i + 1 < p.length ? p[i + 1] : p[i === 0 ? 0 : i - 1];
          const andel = s.nasta();
          return p[i].varde + (granne.varde - p[i].varde) * andel;
        }
      }
      return p[p.length - 1].varde;
    },
    moment: (f) => {
      const p = f.punkter ?? [];
      const summa = p.reduce((a, x) => a + x.vikt, 0);
      if (summa <= 0) return { vantevarde: null, varians: null };
      const m = p.reduce((a, x) => a + (x.vikt / summa) * x.varde, 0);
      // Interpolationen breddar fördelningen jämfört med de rena punkterna,
      // så variansen nedan är en UNDRE gräns. Sviten prövar därför bara
      // väntevärdet mot den här funktionen.
      const v = p.reduce((a, x) => a + (x.vikt / summa) * (x.varde - m) ** 2, 0);
      return { vantevarde: m, varians: v };
    },
  },
];

const KARTA = new Map<FordelningsTyp, Definition>(REGISTER.map((d) => [d.typ, d]));

/* -------------------------------------------------------------------------- */
/* Den publika ytan                                                           */
/* -------------------------------------------------------------------------- */

/** Alla fördelningar, i visningsordning. Gränssnittet läser den här listan. */
export const FORDELNINGAR: readonly Omit<Definition, "validera" | "sampla" | "moment">[] =
  REGISTER.map(({ typ, namn, narAnvands, parametrar, diskret }) => ({
    typ,
    namn,
    narAnvands,
    parametrar,
    diskret,
  }));

export const fordelningsDefinition = (typ: FordelningsTyp) => KARTA.get(typ);

/**
 * Prövar en fördelning. Tom lista = giltig.
 *
 * ANROPAS FÖRE VARJE KÖRNING. En ogiltig fördelning får aldrig samplas:
 * resultatet hade sett ut som ett svar.
 */
export const validera = (f: Fordelning): FordelningsFel[] => {
  const def = KARTA.get(f.typ);
  if (!def) {
    return [{ parameter: "typ", meddelande: `Okänd fördelning: ${String(f.typ)}.` }];
  }
  if (f.parametrar === null || typeof f.parametrar !== "object") {
    return [{ parameter: "parametrar", meddelande: "Parametrarna saknas." }];
  }
  return def.validera(f);
};

/**
 * Drar ett värde. FÖRUTSÄTTER att fördelningen redan validerats.
 *
 * Att validera per dragning hade kostat en miljon valideringar per
 * variabel och körning; kontrollen hör hemma före slingan, inte i den.
 */
export const sampla = (f: Fordelning, s: Slumpstrom): number => {
  const def = KARTA.get(f.typ);
  if (!def) throw new Error(`Okänd fördelning: ${String(f.typ)}`);
  return def.sampla(f, s);
};

/** Teoretiskt väntevärde och varians. Sviten mäter samplingen mot den här. */
export const moment = (f: Fordelning): Moment => {
  const def = KARTA.get(f.typ);
  if (!def) return { vantevarde: null, varians: null };
  return def.moment(f);
};
