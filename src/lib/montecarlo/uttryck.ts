/**
 * BERÄKNINGSMODELLEN SOM TEXT - OCH VARFÖR INTE SOM KOD.
 *
 * En simulering är inte klar för att den räknat. Den ska gå att SPARA,
 * SKICKA, KÖRA OM och GRANSKA: "vilken modell gav det här resultatet?"
 * ska ha ett svar som går att läsa i efterhand.
 *
 * Det utesluter en JavaScript-funktion. En funktion går inte att lagra i
 * en databas på ett meningsfullt sätt, går inte över ett API, och kan inte
 * köras på servern utan att servern kör kod som en klient skickat. Att
 * göra det med `eval` eller `new Function` vore att ge varje inloggad
 * användare exekvering i API-processen - alltså den värsta sårbarhet ett
 * system av det här slaget kan ha.
 *
 * Därför ett eget, litet uttrycksspråk:
 *
 *     Resultat = Kunder * Snittintakt - Kostnader
 *     Marginal = if(Resultat > 0, Resultat / Intakter, 0)
 *
 * SÄKERHETEN ÄR STRUKTURELL, inte en filtrering. Parsern bygger ett träd
 * av ett fåtal nodtyper och evaluatorn kan bara räkna på dem. Det finns
 * ingen väg från en sträng till en funktionsanrop, ingen punktnotation,
 * ingen åtkomst till globala objekt - inte för att de spärras, utan för
 * att grammatiken inte kan uttrycka dem. En svartlista går att gå runt;
 * en grammatik som saknar konstruktionen gör det inte.
 *
 * ORDNINGEN följer den matematiska: jämförelser lägst, sedan + -, sedan
 * * / %, sedan potens (högerassociativ), högst unärt minus och anrop.
 */

/* -------------------------------------------------------------------------- */
/* Trädet                                                                     */
/* -------------------------------------------------------------------------- */

export type Nod =
  | { sort: "tal"; varde: number }
  | { sort: "variabel"; namn: string }
  | { sort: "unar"; operator: "-" | "!"; av: Nod }
  | { sort: "binar"; operator: BinarOperator; vanster: Nod; hoger: Nod }
  | { sort: "anrop"; funktion: string; argument: Nod[] };

type BinarOperator =
  | "+" | "-" | "*" | "/" | "%" | "^"
  | "<" | "<=" | ">" | ">=" | "==" | "!="
  | "&&" | "||";

export class UttrycksFel extends Error {
  constructor(
    message: string,
    /** Teckenposition i uttrycket, så att gränssnittet kan peka. */
    readonly position: number,
  ) {
    super(message);
    this.name = "UttrycksFel";
  }
}

/* -------------------------------------------------------------------------- */
/* Funktionsbiblioteket                                                       */
/* -------------------------------------------------------------------------- */

/**
 * De enda funktioner som finns.
 *
 * Listan är medvetet kort. Varje tillägg är en ny yta att pröva, och en
 * modell som behöver mer än det här är förmodligen två modeller.
 *
 * `if` är villkorlig och utvärderar BÅDA grenarna innan den väljer - det
 * går bra eftersom inget uttryck kan ha sidoeffekter. Det gör evaluatorn
 * enklare och ger samma svar.
 */
const FUNKTIONER: Record<string, { arg: number | "minst1"; f: (a: number[]) => number }> = {
  min: { arg: "minst1", f: (a) => Math.min(...a) },
  max: { arg: "minst1", f: (a) => Math.max(...a) },
  abs: { arg: 1, f: (a) => Math.abs(a[0]) },
  sqrt: { arg: 1, f: (a) => Math.sqrt(a[0]) },
  ln: { arg: 1, f: (a) => Math.log(a[0]) },
  log10: { arg: 1, f: (a) => Math.log10(a[0]) },
  exp: { arg: 1, f: (a) => Math.exp(a[0]) },
  round: { arg: 1, f: (a) => Math.round(a[0]) },
  floor: { arg: 1, f: (a) => Math.floor(a[0]) },
  ceil: { arg: 1, f: (a) => Math.ceil(a[0]) },
  // Tredje argumentet är villkorets falska gren.
  if: { arg: 3, f: (a) => (a[0] !== 0 ? a[1] : a[2]) },
  /**
   * Klamrar värdet till [min, max]. Finns för att en modell ofta behöver
   * uttrycka "kan inte bli negativ" utan att skriva en if kring varje led.
   */
  clamp: { arg: 3, f: (a) => Math.min(Math.max(a[0], a[1]), a[2]) },
};

export const FUNKTIONSNAMN = Object.keys(FUNKTIONER).sort();

/* -------------------------------------------------------------------------- */
/* Tokenisering                                                               */
/* -------------------------------------------------------------------------- */

interface Token {
  typ: "tal" | "namn" | "operator" | "(" | ")" | ",";
  text: string;
  position: number;
}

const OPERATORTECKEN = new Set(["+", "-", "*", "/", "%", "^", "<", ">", "=", "!", "&", "|"]);

const tokenisera = (kalla: string): Token[] => {
  const tokens: Token[] = [];
  let i = 0;
  while (i < kalla.length) {
    const c = kalla[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }
    if (c === "(" || c === ")" || c === ",") {
      tokens.push({ typ: c === "," ? "," : c, text: c, position: i });
      i++;
      continue;
    }
    if (c >= "0" && c <= "9") {
      const start = i;
      while (i < kalla.length && kalla[i] >= "0" && kalla[i] <= "9") i++;
      if (kalla[i] === ".") {
        i++;
        while (i < kalla.length && kalla[i] >= "0" && kalla[i] <= "9") i++;
      }
      // Exponentform (1e6) är vanlig i ekonomiska modeller.
      if (kalla[i] === "e" || kalla[i] === "E") {
        const spar = i;
        i++;
        if (kalla[i] === "+" || kalla[i] === "-") i++;
        if (kalla[i] >= "0" && kalla[i] <= "9") {
          while (i < kalla.length && kalla[i] >= "0" && kalla[i] <= "9") i++;
        } else {
          i = spar; // "1e" utan siffror är inte en exponent.
        }
      }
      tokens.push({ typ: "tal", text: kalla.slice(start, i), position: start });
      continue;
    }
    // Ett namn: bokstav eller understreck först, sedan även siffror.
    // Svenska tecken tillåts - variabeln får heta "Intäkter".
    if (/[A-Za-zÅÄÖåäö_]/.test(c)) {
      const start = i;
      while (i < kalla.length && /[A-Za-zÅÄÖåäö0-9_]/.test(kalla[i])) i++;
      tokens.push({ typ: "namn", text: kalla.slice(start, i), position: start });
      continue;
    }
    if (OPERATORTECKEN.has(c)) {
      const start = i;
      const tva = kalla.slice(i, i + 2);
      if (["<=", ">=", "==", "!=", "&&", "||"].includes(tva)) {
        i += 2;
      } else {
        // Ett ensamt = är nästan alltid ett menat ==. Säg det.
        if (c === "=") throw new UttrycksFel('Använd "==" för jämförelse, inte "=".', i);
        if (c === "&" || c === "|") {
          throw new UttrycksFel(`Använd "${c}${c}" för logiskt ${c === "&" ? "och" : "eller"}.`, i);
        }
        i += 1;
      }
      tokens.push({ typ: "operator", text: kalla.slice(start, i), position: start });
      continue;
    }
    throw new UttrycksFel(`Tecknet "${c}" hör inte hemma i ett uttryck.`, i);
  }
  return tokens;
};

/* -------------------------------------------------------------------------- */
/* Parsern                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Tolkar ett uttryck till ett träd. Kastar UttrycksFel med position.
 *
 * Rekursiv nedstigning, en nivå per prioritet. Ingen `eval`, ingen
 * `new Function`, ingen konstruktion som kan nå omvärlden.
 */
export const tolka = (kalla: string): Nod => {
  const tokens = tokenisera(kalla);
  if (tokens.length === 0) throw new UttrycksFel("Uttrycket är tomt.", 0);

  let pos = 0;
  const kika = (): Token | undefined => tokens[pos];
  const ta = (): Token => tokens[pos++];
  const slutet = () => (tokens.length > 0 ? tokens[tokens.length - 1].position + 1 : 0);

  const forvantaOperator = (...texter: string[]): boolean => {
    const t = kika();
    return t !== undefined && t.typ === "operator" && texter.includes(t.text);
  };

  // Lägst prioritet: ||
  const eller = (): Nod => {
    let v = och();
    while (forvantaOperator("||")) {
      ta();
      v = { sort: "binar", operator: "||", vanster: v, hoger: och() };
    }
    return v;
  };
  const och = (): Nod => {
    let v = jamforelse();
    while (forvantaOperator("&&")) {
      ta();
      v = { sort: "binar", operator: "&&", vanster: v, hoger: jamforelse() };
    }
    return v;
  };
  const jamforelse = (): Nod => {
    let v = summa();
    while (forvantaOperator("<", "<=", ">", ">=", "==", "!=")) {
      const op = ta().text as BinarOperator;
      v = { sort: "binar", operator: op, vanster: v, hoger: summa() };
    }
    return v;
  };
  const summa = (): Nod => {
    let v = produkt();
    while (forvantaOperator("+", "-")) {
      const op = ta().text as BinarOperator;
      v = { sort: "binar", operator: op, vanster: v, hoger: produkt() };
    }
    return v;
  };
  const produkt = (): Nod => {
    let v = unar();
    while (forvantaOperator("*", "/", "%")) {
      const op = ta().text as BinarOperator;
      v = { sort: "binar", operator: op, vanster: v, hoger: unar() };
    }
    return v;
  };
  const unar = (): Nod => {
    if (forvantaOperator("-")) {
      ta();
      return { sort: "unar", operator: "-", av: unar() };
    }
    if (forvantaOperator("+")) {
      ta();
      return unar();
    }
    if (forvantaOperator("!")) {
      ta();
      return { sort: "unar", operator: "!", av: unar() };
    }
    return potens();
  };
  // Potens binder hårdast och är HÖGERassociativ: 2^3^2 är 2^9, inte 8^2.
  const potens = (): Nod => {
    const bas = atom();
    if (forvantaOperator("^")) {
      ta();
      return { sort: "binar", operator: "^", vanster: bas, hoger: unar() };
    }
    return bas;
  };
  const atom = (): Nod => {
    const t = kika();
    if (t === undefined) throw new UttrycksFel("Uttrycket slutar mitt i.", slutet());

    if (t.typ === "tal") {
      ta();
      const v = Number(t.text);
      if (!Number.isFinite(v)) throw new UttrycksFel(`"${t.text}" är inte ett giltigt tal.`, t.position);
      return { sort: "tal", varde: v };
    }
    if (t.typ === "(") {
      ta();
      const inre = eller();
      const stang = kika();
      if (stang === undefined || stang.typ !== ")") {
        throw new UttrycksFel("En parentes öppnades men stängdes aldrig.", t.position);
      }
      ta();
      return inre;
    }
    if (t.typ === "namn") {
      ta();
      // Ett namn följt av "(" är ett funktionsanrop, annars en variabel.
      if (kika()?.typ === "(") {
        ta();
        const argument: Nod[] = [];
        if (kika()?.typ !== ")") {
          for (;;) {
            argument.push(eller());
            if (kika()?.typ === ",") {
              ta();
              continue;
            }
            break;
          }
        }
        const stang = kika();
        if (stang === undefined || stang.typ !== ")") {
          throw new UttrycksFel(`Anropet till ${t.text}() stängdes aldrig.`, t.position);
        }
        ta();
        const def = FUNKTIONER[t.text];
        if (!def) {
          throw new UttrycksFel(
            `Funktionen ${t.text}() finns inte. Tillgängliga: ${FUNKTIONSNAMN.join(", ")}.`,
            t.position,
          );
        }
        if (def.arg === "minst1" ? argument.length < 1 : argument.length !== def.arg) {
          throw new UttrycksFel(
            `${t.text}() tar ${def.arg === "minst1" ? "minst ett" : String(def.arg)} argument, fick ${argument.length}.`,
            t.position,
          );
        }
        return { sort: "anrop", funktion: t.text, argument };
      }
      return { sort: "variabel", namn: t.text };
    }
    throw new UttrycksFel(`"${t.text}" kan inte stå här.`, t.position);
  };

  const trad = eller();
  if (pos < tokens.length) {
    throw new UttrycksFel(`"${tokens[pos].text}" står löst efter uttryckets slut.`, tokens[pos].position);
  }
  return trad;
};

/* -------------------------------------------------------------------------- */
/* Evaluering                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Räknar ut trädet mot en namnkarta.
 *
 * `varden` är en vanlig array plus ett index, inte ett objekt: funktionen
 * anropas en gång per iteration och output, alltså miljontals gånger, och
 * en objektuppslagning per variabel är mätbart dyrare.
 *
 * OKÄNT NAMN KASTAR. Att tyst räkna med noll för en variabel som stavats
 * fel är precis den sortens fel som ger ett rimligt utseende resultat.
 */
export const berakna = (nod: Nod, varden: ReadonlyMap<string, number>): number => {
  switch (nod.sort) {
    case "tal":
      return nod.varde;
    case "variabel": {
      const v = varden.get(nod.namn);
      if (v === undefined) throw new Error(`Variabeln "${nod.namn}" finns inte i modellen.`);
      return v;
    }
    case "unar": {
      const v = berakna(nod.av, varden);
      return nod.operator === "-" ? -v : v === 0 ? 1 : 0;
    }
    case "anrop": {
      const def = FUNKTIONER[nod.funktion];
      return def.f(nod.argument.map((a) => berakna(a, varden)));
    }
    case "binar": {
      const a = berakna(nod.vanster, varden);
      const b = berakna(nod.hoger, varden);
      switch (nod.operator) {
        case "+": return a + b;
        case "-": return a - b;
        case "*": return a * b;
        // Division med noll ger Infinity i JavaScript, som sedan förorenar
        // varje summa. Motorn fångar det per iteration (se motor.ts) - här
        // returneras det oförändrat, för att felet ska gå att se.
        case "/": return a / b;
        case "%": return a % b;
        case "^": return Math.pow(a, b);
        case "<": return a < b ? 1 : 0;
        case "<=": return a <= b ? 1 : 0;
        case ">": return a > b ? 1 : 0;
        case ">=": return a >= b ? 1 : 0;
        case "==": return a === b ? 1 : 0;
        case "!=": return a !== b ? 1 : 0;
        case "&&": return a !== 0 && b !== 0 ? 1 : 0;
        case "||": return a !== 0 || b !== 0 ? 1 : 0;
      }
    }
  }
};

/**
 * Namnen ett uttryck läser.
 *
 * Används för att pröva en modell INNAN den körs: refererar den en
 * variabel som inte finns ska det sägas vid sparandet, inte upptäckas på
 * iteration 1 av en miljon.
 */
export const variablerI = (nod: Nod, ut = new Set<string>()): Set<string> => {
  switch (nod.sort) {
    case "variabel":
      ut.add(nod.namn);
      break;
    case "unar":
      variablerI(nod.av, ut);
      break;
    case "binar":
      variablerI(nod.vanster, ut);
      variablerI(nod.hoger, ut);
      break;
    case "anrop":
      for (const a of nod.argument) variablerI(a, ut);
      break;
    case "tal":
      break;
  }
  return ut;
};
