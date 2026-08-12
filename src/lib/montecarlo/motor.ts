/**
 * SIMULERINGSMOTORN.
 *
 * Kedjan, i den ordning den körs:
 *
 *   spec -> validering -> sampling -> beräkning -> statistik
 *        -> känslighet -> konvergens -> kvalitetskontroll
 *
 * Fyra beslut i den här filen är värda att kunna försvara, för de styr
 * vad som är sant om resultatet:
 *
 * 1. MINNET VÄXER INTE MED ANTALET INPUTS. Outputserierna sparas i sin
 *    helhet (percentiler kräver sorterade sampel), men INPUTSAMPLEN sparas
 *    bara som ett begränsat urval - se URVAL_FOR_KANSLIGHET. Vid en miljon
 *    iterationer och tio inputs hade fullständiga inputserier kostat 80 MB
 *    utan att göra känslighetsanalysen mätbart bättre: en rangkorrelation
 *    på 20 000 par har ett standardfel kring 0,007, vilket är långt under
 *    den upplösning en rangordning behöver.
 *
 * 2. AVBROTT OCH FRAMSTEG KRÄVER BATCHAR. Slingan lämnar ifrån sig
 *    kontrollen mellan batchar. Utan det kan en körning varken avbrytas
 *    eller rapportera framsteg, och i en webbläsare fryser fliken.
 *
 * 3. OGILTIGA TAL FÅR ALDRIG BLI ETT RESULTAT. En division med noll ger
 *    Infinity, som sedan förorenar medelvärdet. Varje beräknat värde prövas,
 *    och en körning med ogiltiga tal RAPPORTERAR dem i stället för att
 *    tyst leverera en fördelning som ser rimlig ut.
 *
 * 4. KONVERGENS MÄTS UNDER KÖRNINGEN, inte efteråt. Delsummor tas vid
 *    bestämda avstämningspunkter, så att frågan "räckte antalet
 *    iterationer?" kan besvaras utan att köra om.
 */

import { Slumpstrom, nyttFro } from "./slump";
import { sampla, validera as validerarFordelning, type Fordelning } from "./fordelningar";
import {
  histogram,
  percentil,
  rangkorrelation,
  sammanfatta,
  sannolikhetMinst,
  sannolikhetUnder,
  type Histogram,
  type Statistik,
} from "./statistik";
import { berakna, tolka, variablerI, UttrycksFel, type Nod } from "./uttryck";

/**
 * MOTORNS VERSION.
 *
 * Sparas med varje körning. Ändras samplingen, ordningen dragningar sker i,
 * eller någon fördelnings implementation, så ändras den här - och då är ett
 * gammalt resultat inte längre reproducerbart med den nya koden. Att låtsas
 * annat vore att lova något som inte håller.
 */
export const MOTORVERSION = "1.0.0";

/** Så många inputsampel behålls för känslighetsanalysen. Se filens punkt 1. */
export const URVAL_FOR_KANSLIGHET = 20000;

/** Iterationer mellan varje avbrotts- och framstegskontroll. */
const BATCH = 25000;

/* -------------------------------------------------------------------------- */
/* Specifikationen                                                            */
/* -------------------------------------------------------------------------- */

export interface Inputvariabel {
  /** Namnet som används i uttrycken. Måste vara ett giltigt variabelnamn. */
  namn: string;
  /** Läsbar etikett för gränssnittet. */
  etikett?: string;
  fordelning: Fordelning;
  /** Enhet, t.ex. "kr" eller "st". Visas, räknas aldrig med. */
  enhet?: string;
  /** Var siffran kommer ifrån. Ett antagande utan källa är en gissning. */
  kalla?: string;
  /** Hur säker uppgiften är. Påverkar inget i räkningen - den ska synas. */
  tilltro?: "hog" | "medel" | "lag";
  beskrivning?: string;
}

export interface Outputdefinition {
  namn: string;
  etikett?: string;
  /** Uttrycket, som text. Se uttryck.ts. */
  uttryck: string;
  enhet?: string;
  /** Målvärdet, om ett finns. Sannolikheten att nå det räknas ut. */
  mal?: number | null;
  /** Kritisk gräns. Sannolikheten att hamna UNDER den räknas ut. */
  kritiskGrans?: number | null;
}

export interface Simuleringsspec {
  namn: string;
  inputs: Inputvariabel[];
  outputs: Outputdefinition[];
  iterationer: number;
  /** Fröet. Utan det går körningen inte att upprepa. */
  fro: number;
  /** Konstanter som uttrycken får läsa, utöver inputvariablerna. */
  konstanter?: Record<string, number>;
}

/* -------------------------------------------------------------------------- */
/* Resultatet                                                                 */
/* -------------------------------------------------------------------------- */

export interface Sannolikheter {
  /** Sannolikheten att nå eller överträffa målet. null när mål saknas. */
  narMal: number | null;
  /** Sannolikheten att hamna under den kritiska gränsen. */
  underKritisk: number | null;
  /** Sannolikheten för ett negativt utfall. Alltid meningsfull. */
  negativt: number;
}

export interface Kanslighet {
  input: string;
  /** Spearmans rangkorrelation mot outputen. -1..1. */
  rangkorrelation: number;
  /**
   * Andel av den förklarade variationen, 0..1. Kvadrerad korrelation
   * normaliserad över alla inputs - det som visas som procent i listan.
   */
  andelAvVariation: number;
}

export interface Konvergenspunkt {
  iterationer: number;
  medel: number;
  p10: number;
  median: number;
  p90: number;
}

export interface Outputresultat {
  namn: string;
  etikett: string;
  enhet: string | null;
  statistik: Statistik;
  sannolikheter: Sannolikheter;
  histogram: Histogram;
  kanslighet: Kanslighet[];
  konvergens: Konvergenspunkt[];
  /**
   * Sant när de sista avstämningarna ligger stilla. Falskt = kör fler
   * iterationer innan resultatet används som underlag.
   */
  stabil: boolean;
  mal: number | null;
  kritiskGrans: number | null;
}

export interface Kvalitetsanmarkning {
  allvar: "fel" | "varning";
  kod: string;
  meddelande: string;
}

export interface Simuleringsresultat {
  motorversion: string;
  fro: number;
  iterationer: number;
  /** Millisekunder. Mäts av anroparen och skickas in - ren funktion här. */
  varaktighetMs: number;
  outputs: Outputresultat[];
  anmarkningar: Kvalitetsanmarkning[];
  /** Antal iterationer som gav ogiltiga tal och uteslöts. */
  forkastadeIterationer: number;
}

export interface Korningsval {
  /** Anropas mellan batchar. Returnerar false för att avbryta. */
  framsteg?: (klart: number, av: number) => boolean | void;
  /** Avbryter körningen. Prövas mellan batchar. */
  avbrutet?: () => boolean;
}

export class Avbruten extends Error {
  constructor() {
    super("Simuleringen avbröts.");
    this.name = "Avbruten";
  }
}

/* -------------------------------------------------------------------------- */
/* Validering                                                                 */
/* -------------------------------------------------------------------------- */

export interface Specfel {
  var: string;
  meddelande: string;
}

/** Ett giltigt variabelnamn: bokstav eller _, sedan bokstäver/siffror/_. */
const NAMNFORM = /^[A-Za-zÅÄÖåäö_][A-Za-zÅÄÖåäö0-9_]*$/;

/**
 * Prövar hela specifikationen INNAN en enda dragning sker.
 *
 * Tom lista = kör. Allt annat ska visas för användaren, för det finns
 * ingen körning som kan rädda en modell som refererar en variabel som
 * inte finns.
 */
export const valideraSpec = (spec: Simuleringsspec): Specfel[] => {
  const fel: Specfel[] = [];

  if (!spec.namn || spec.namn.trim().length === 0) {
    fel.push({ var: "namn", meddelande: "Simuleringen behöver ett namn." });
  }
  if (!Number.isInteger(spec.iterationer) || spec.iterationer < 100) {
    fel.push({
      var: "iterationer",
      meddelande:
        "Antalet iterationer måste vara ett heltal på minst 100. Under det är percentilerna för skakiga för att visa.",
    });
  }
  if (!Number.isInteger(spec.fro)) {
    fel.push({ var: "fro", meddelande: "Fröet måste vara ett heltal - annars går körningen inte att upprepa." });
  }
  if (spec.inputs.length === 0) {
    fel.push({ var: "inputs", meddelande: "Simuleringen behöver minst en inputvariabel." });
  }
  if (spec.outputs.length === 0) {
    fel.push({ var: "outputs", meddelande: "Simuleringen behöver minst ett resultat att räkna fram." });
  }

  const namn = new Set<string>();
  for (const [i, inp] of spec.inputs.entries()) {
    if (!NAMNFORM.test(inp.namn ?? "")) {
      fel.push({
        var: `inputs[${i}].namn`,
        meddelande: `"${inp.namn}" är inte ett giltigt variabelnamn. Använd bokstäver, siffror och understreck, och börja inte med en siffra.`,
      });
      continue;
    }
    if (namn.has(inp.namn)) {
      fel.push({ var: `inputs[${i}].namn`, meddelande: `Variabelnamnet "${inp.namn}" används mer än en gång.` });
    }
    namn.add(inp.namn);
    for (const f of validerarFordelning(inp.fordelning)) {
      fel.push({ var: `inputs[${i}].fordelning.${f.parameter}`, meddelande: `${inp.namn}: ${f.meddelande}` });
    }
  }
  for (const konstant of Object.keys(spec.konstanter ?? {})) {
    if (!NAMNFORM.test(konstant)) {
      fel.push({ var: `konstanter.${konstant}`, meddelande: `"${konstant}" är inte ett giltigt namn.` });
    }
    if (namn.has(konstant)) {
      fel.push({ var: `konstanter.${konstant}`, meddelande: `"${konstant}" är både input och konstant.` });
    }
    const v = (spec.konstanter ?? {})[konstant];
    if (!Number.isFinite(v)) {
      fel.push({ var: `konstanter.${konstant}`, meddelande: `Konstanten "${konstant}" är inte ett ändligt tal.` });
    }
    namn.add(konstant);
  }

  const outputnamn = new Set<string>();
  for (const [i, ut] of spec.outputs.entries()) {
    if (!NAMNFORM.test(ut.namn ?? "")) {
      fel.push({ var: `outputs[${i}].namn`, meddelande: `"${ut.namn}" är inte ett giltigt namn.` });
    }
    if (outputnamn.has(ut.namn)) {
      fel.push({ var: `outputs[${i}].namn`, meddelande: `Resultatnamnet "${ut.namn}" används mer än en gång.` });
    }
    outputnamn.add(ut.namn);

    let trad: Nod;
    try {
      trad = tolka(ut.uttryck ?? "");
    } catch (e) {
      fel.push({
        var: `outputs[${i}].uttryck`,
        meddelande:
          e instanceof UttrycksFel
            ? `${ut.namn}: ${e.message} (tecken ${e.position + 1})`
            : `${ut.namn}: uttrycket kunde inte tolkas.`,
      });
      continue;
    }
    // Ett tidigare resultat får användas som led i ett senare - men bara
    // ett som redan räknats, annars vore modellen cirkulär.
    for (const anvand of variablerI(trad)) {
      if (!namn.has(anvand) && !outputnamn.has(anvand)) {
        fel.push({
          var: `outputs[${i}].uttryck`,
          meddelande: `${ut.namn}: variabeln "${anvand}" finns varken som input, konstant eller tidigare resultat.`,
        });
      }
      if (anvand === ut.namn) {
        fel.push({ var: `outputs[${i}].uttryck`, meddelande: `${ut.namn} refererar till sig själv.` });
      }
    }
  }
  return fel;
};

/* -------------------------------------------------------------------------- */
/* Körningen                                                                  */
/* -------------------------------------------------------------------------- */

/** Avstämningspunkter för konvergens, som andelar av hela körningen. */
const KONVERGENSSTEG = [0.05, 0.1, 0.25, 0.5, 0.75, 1];

/**
 * Kör simuleringen.
 *
 * SYNKRON MED FRIVILLIGA ANDNINGSPAUSER: anroparen får kontrollen mellan
 * batchar genom `framsteg`/`avbrutet` och kan där välja att lämna över till
 * eventloopen. Att göra funktionen själv asynkron hade tvingat på varje
 * anropare ett await per batch utan att ge något - och gjort den svårare
 * att pröva.
 */
export const kor = (
  spec: Simuleringsspec,
  val: Korningsval = {},
): Simuleringsresultat => {
  const fel = valideraSpec(spec);
  if (fel.length > 0) {
    throw new Error(
      `Simuleringen kan inte köras: ${fel.map((f) => f.meddelande).join(" ")}`,
    );
  }

  const start = Date.now();
  const N = spec.iterationer;
  const strom = new Slumpstrom(spec.fro);
  const trad = spec.outputs.map((o) => tolka(o.uttryck));

  // Outputserierna i sin helhet - percentiler kräver sorterade sampel.
  const utserier = spec.outputs.map(() => new Float64Array(N));
  // Inputurvalet för känslighet. Se filens punkt 1.
  const urvalStorlek = Math.min(N, URVAL_FOR_KANSLIGHET);
  const insamplade = spec.inputs.map(() => new Float64Array(urvalStorlek));
  const urvalUt = spec.outputs.map(() => new Float64Array(urvalStorlek));
  // Var n:te iteration sparas, jämnt fördelat över hela körningen - inte de
  // första 20 000, som hade missat allt en senare del av strömmen gör.
  const urvalSteg = Math.max(1, Math.floor(N / urvalStorlek));

  const konvergenspunkter: number[] = KONVERGENSSTEG.map((andel) =>
    Math.max(100, Math.min(N, Math.floor(N * andel))),
  ).filter((v, i, a) => a.indexOf(v) === i);
  const konvergens: Konvergenspunkt[][] = spec.outputs.map(() => []);

  const varden = new Map<string, number>();
  for (const [k, v] of Object.entries(spec.konstanter ?? {})) varden.set(k, v);

  let forkastade = 0;
  let skrivna = 0;
  let urvalSkrivna = 0;
  let naJamforKonvergens = 0;

  for (let block = 0; block < N; block += BATCH) {
    const slut = Math.min(N, block + BATCH);
    for (let i = block; i < slut; i++) {
      // 1. Dra alla inputs. ALLTID i samma ordning - ordningen är en del av
      //    reproducerbarheten, för strömmen är sekventiell.
      let giltig = true;
      for (let k = 0; k < spec.inputs.length; k++) {
        const v = sampla(spec.inputs[k].fordelning, strom);
        if (!Number.isFinite(v)) giltig = false;
        varden.set(spec.inputs[k].namn, v);
      }

      // 2. Räkna resultaten i ordning. Ett senare får läsa ett tidigare.
      if (giltig) {
        for (let k = 0; k < trad.length; k++) {
          let v: number;
          try {
            v = berakna(trad[k], varden);
          } catch {
            v = Number.NaN;
          }
          if (!Number.isFinite(v)) {
            giltig = false;
            break;
          }
          varden.set(spec.outputs[k].namn, v);
        }
      }

      if (!giltig) {
        // Iterationen kastas, men RÄKNAS. En körning där hälften föll bort
        // är inte samma sak som en där allt gick igenom, och skillnaden
        // ska synas i anmärkningarna.
        forkastade++;
        continue;
      }

      for (let k = 0; k < trad.length; k++) {
        utserier[k][skrivna] = varden.get(spec.outputs[k].namn) as number;
      }
      if (urvalSkrivna < urvalStorlek && i % urvalSteg === 0) {
        for (let k = 0; k < spec.inputs.length; k++) {
          insamplade[k][urvalSkrivna] = varden.get(spec.inputs[k].namn) as number;
        }
        for (let k = 0; k < trad.length; k++) {
          urvalUt[k][urvalSkrivna] = varden.get(spec.outputs[k].namn) as number;
        }
        urvalSkrivna++;
      }
      skrivna++;

      // Konvergensavstämning: en sortering av det som skrivits hittills.
      if (
        naJamforKonvergens < konvergenspunkter.length &&
        skrivna >= konvergenspunkter[naJamforKonvergens]
      ) {
        for (let k = 0; k < trad.length; k++) {
          const hittills = utserier[k].slice(0, skrivna);
          hittills.sort();
          let summa = 0;
          for (let j = 0; j < hittills.length; j++) summa += hittills[j];
          konvergens[k].push({
            iterationer: skrivna,
            medel: summa / hittills.length,
            p10: percentil(hittills, 0.1),
            median: percentil(hittills, 0.5),
            p90: percentil(hittills, 0.9),
          });
        }
        naJamforKonvergens++;
      }
    }

    if (val.avbrutet?.()) throw new Avbruten();
    if (val.framsteg?.(slut, N) === false) throw new Avbruten();
  }

  if (skrivna === 0) {
    throw new Error(
      "Alla iterationer gav ogiltiga tal. Kontrollera modellen - en division med noll eller en logaritm av ett negativt tal är de vanligaste orsakerna.",
    );
  }

  /* --- Statistik, sannolikheter, känslighet ------------------------------ */

  const outputs: Outputresultat[] = spec.outputs.map((def, k) => {
    const serie = utserier[k].slice(0, skrivna);
    serie.sort();

    const statistik = sammanfatta(serie);
    const mal = def.mal ?? null;
    const kritisk = def.kritiskGrans ?? null;

    const urvalUtK = urvalUt[k].slice(0, urvalSkrivna);
    const rakor = spec.inputs.map((inp, j) => ({
      input: inp.namn,
      rangkorrelation:
        urvalSkrivna >= 3 ? rangkorrelation(insamplade[j].slice(0, urvalSkrivna), urvalUtK) : 0,
      andelAvVariation: 0,
    }));
    // Andelen räknas på kvadrerad korrelation: det är den storhet som är
    // additiv i "förklarad variation". Summan normaliseras till 1 så att
    // listan går att läsa som procent - och den summan gäller BARA de
    // inputs som finns med, inte all variation i världen.
    const summaKvad = rakor.reduce((a, r) => a + r.rangkorrelation ** 2, 0);
    for (const r of rakor) {
      r.andelAvVariation = summaKvad > 0 ? r.rangkorrelation ** 2 / summaKvad : 0;
    }
    rakor.sort((a, b) => b.andelAvVariation - a.andelAvVariation);

    return {
      namn: def.namn,
      etikett: def.etikett ?? def.namn,
      enhet: def.enhet ?? null,
      statistik,
      sannolikheter: {
        narMal: mal === null ? null : sannolikhetMinst(serie, mal),
        underKritisk: kritisk === null ? null : sannolikhetUnder(serie, kritisk),
        negativt: sannolikhetUnder(serie, 0),
      },
      histogram: histogram(serie),
      kanslighet: rakor,
      konvergens: konvergens[k],
      stabil: arStabil(konvergens[k]),
      mal,
      kritiskGrans: kritisk,
    };
  });

  return {
    motorversion: MOTORVERSION,
    fro: spec.fro,
    iterationer: skrivna,
    varaktighetMs: Date.now() - start,
    outputs,
    anmarkningar: granska(spec, outputs, skrivna, forkastade),
    forkastadeIterationer: forkastade,
  };
};

/* -------------------------------------------------------------------------- */
/* Konvergens och kvalitet                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Har medianen och svansarna lagt sig?
 *
 * Jämför de två sista avstämningarna. Rör sig medianen eller P90 mer än en
 * procent av spannet mellan dem, räknas körningen som ostabil - då är
 * antalet iterationer för lågt för att percentilerna ska betyda något.
 *
 * En PROCENT AV SPANNET och inte av värdet: ett resultat som pendlar kring
 * noll hade annars alltid sett ostabilt ut, eftersom en relativ ändring mot
 * ett värde nära noll är godtyckligt stor.
 */
const arStabil = (punkter: Konvergenspunkt[]): boolean => {
  if (punkter.length < 2) return false;
  const sista = punkter[punkter.length - 1];
  const nastSista = punkter[punkter.length - 2];
  const spann = Math.abs(sista.p90 - sista.p10);
  if (spann === 0) return true; // Ingen spridning alls: inget att stabilisera.
  const rorMedian = Math.abs(sista.median - nastSista.median) / spann;
  const rorP90 = Math.abs(sista.p90 - nastSista.p90) / spann;
  const rorP10 = Math.abs(sista.p10 - nastSista.p10) / spann;
  return rorMedian < 0.01 && rorP90 < 0.02 && rorP10 < 0.02;
};

/**
 * Kvalitetskontrollen.
 *
 * Motorn ska ALDRIG tyst leverera ett resultat som är statistiskt eller
 * numeriskt tvivelaktigt. Anmärkningarna följer med resultatet hela vägen
 * ut i gränssnittet.
 */
const granska = (
  spec: Simuleringsspec,
  outputs: Outputresultat[],
  skrivna: number,
  forkastade: number,
): Kvalitetsanmarkning[] => {
  const anm: Kvalitetsanmarkning[] = [];

  if (forkastade > 0) {
    const andel = forkastade / (skrivna + forkastade);
    anm.push({
      allvar: andel > 0.01 ? "fel" : "varning",
      kod: "ogiltiga_iterationer",
      meddelande:
        `${forkastade.toLocaleString("sv-SE")} av ${(skrivna + forkastade).toLocaleString("sv-SE")} iterationer ` +
        `(${(andel * 100).toFixed(1)} %) gav ogiltiga tal och uteslöts. ` +
        "Vanligast är division med noll eller logaritm av ett icke-positivt tal.",
    });
  }

  if (skrivna < 1000) {
    anm.push({
      allvar: "varning",
      kod: "fa_iterationer",
      meddelande:
        `Endast ${skrivna.toLocaleString("sv-SE")} giltiga iterationer. Svanspercentilerna (P5, P95, P99) ` +
        "vilar då på mycket få observationer och bör inte användas som beslutsunderlag.",
    });
  }

  for (const ut of outputs) {
    if (!ut.stabil) {
      anm.push({
        allvar: "varning",
        kod: "ostabil_konvergens",
        meddelande:
          `${ut.etikett}: fördelningen rörde sig fortfarande mellan de två sista avstämningarna. ` +
          "Kör fler iterationer innan resultatet används.",
      });
    }
    if (ut.statistik.standardavvikelse === 0) {
      anm.push({
        allvar: "varning",
        kod: "ingen_spridning",
        meddelande:
          `${ut.etikett} fick samma värde i varje iteration. Modellen använder ingen av de osäkra ` +
          "variablerna, eller så saknar de spridning - då tillför simuleringen ingenting.",
      });
    }
    // En input som inte påverkar något är inte fel, men det är värt att veta.
    const utanPaverkan = ut.kanslighet.filter((k) => Math.abs(k.rangkorrelation) < 0.01);
    if (utanPaverkan.length === spec.inputs.length && spec.inputs.length > 0) {
      anm.push({
        allvar: "varning",
        kod: "ingen_koppling",
        meddelande: `${ut.etikett} påverkas inte mätbart av någon av inputvariablerna.`,
      });
    }
  }

  return anm;
};

/* -------------------------------------------------------------------------- */
/* Var körningen hör hemma                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Ska körningen ske direkt eller köas?
 *
 * En körning på 25 000 iterationer tar tiotals millisekunder och kan göras
 * i förfrågans egen tur. En på en miljon tar sekunder - och API:t är EN
 * process: sekunder i en handler betyder sekunder av kö för alla andras
 * anrop. Sådana körningar hör hemma i den betrodda arbetaren, samma
 * mönster som utkorgen och aviseringarna.
 *
 * Tröskeln är en driftparameter i tanken men en konstant i koden: den
 * hänger ihop med hur motorn presterar, inte med hur produkten prissätts.
 */
export const TROSKEL_FOR_KO = 50000;

export const korDirekt = (iterationer: number): boolean => iterationer <= TROSKEL_FOR_KO;

/**
 * Ett frö att spara med körningen, när användaren inte angett ett eget.
 * Väljs EN gång, skrivs ned, och används sedan varje gång körningen
 * upprepas.
 */
export { nyttFro };
