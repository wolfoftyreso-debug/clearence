/**
 * FÖRBERED ANVÄNDAREN.
 *
 * Produktens övergångsprincip, och en bindande designregel: ingen ny vy
 * ska någonsin kännas oväntad.
 *
 * Skälet är målgruppen. För någon mitt i en ekonomisk kris är
 * FÖRUTSÄGBARHET viktigare än hastighet. Fyra frågor får aldrig lämnas
 * obesvarade när något ändras på skärmen:
 *
 *   Varför händer det här? · Vem ska se informationen? ·
 *   Vad kommer att hända nu? · Hur lång tid tar nästa steg?
 *
 * En övergång har därför fyra delar, alltid i den här ordningen:
 *
 *   1. DET HÄR ÄR KLART   - bekräfta vad som just slutfördes
 *   2. NU HÄNDER DETTA    - nästa steg i EN mening
 *   3. VARFÖR VI FRÅGAR   - syftet, så uppgiften inte känns godtycklig
 *   4. HUR LÅNG TID       - "cirka två minuter", "fyra steg kvar"
 *
 * Delarna 1 och 3 är de som skiljer principen från en vanlig
 * förloppsindikator: den som vet VAD som blev klart och VARFÖR nästa
 * fråga ställs upplever att systemet leder - inte att processen händer
 * med hen.
 *
 * Bekräftelsen i del 1 lyder under tonalitetsreglerna (tone.ts): den
 * säger vad som blev gjort, aldrig att någon var duktig.
 */

export interface Transition {
  /** 1. Vad som just slutfördes. Konkret, aldrig beröm. */
  done: string;
  /** 2. Nästa steg, i en mening. */
  next: string;
  /** 3. Varför uppgiften behövs - syftet, inte processen. */
  why: string;
  /** 4. Vad det kostar användaren: tid eller antal steg. */
  effort: string;
  /**
   * 5. Vem som får se det, när svaret delas med någon annan än
   * användaren själv. Utelämnas när ingen annan ser något - att skriva
   * "ingen annan ser detta" på varje steg blir brus som ingen läser.
   */
  audience?: string;
}

export const PREPARE_HEADINGS = {
  done: "Det här är klart",
  next: "Nu händer detta",
  why: "Därför frågar vi",
  effort: "Så lång tid tar det",
  audience: "Vem ser uppgifterna",
} as const;

/**
 * Övergången som text, i ordning. Används av gränssnittet och av
 * testerna - samma källa, så en regel inte kan hållas på ett ställe och
 * brytas på ett annat.
 */
export const prepareLines = (t: Transition): string[] =>
  [t.done, t.next, t.why, t.effort, t.audience].filter((line): line is string => !!line);

/* --- Övergångarna i produkten ---------------------------------------------- */

export type TransitionId =
  | "onboarding-till-nulage"
  | "nulage-foretag-till-betalningar"
  | "nulage-betalningar-till-skulder"
  | "nulage-skulder-till-bedomning"
  | "bedomning-till-arende";

export const TRANSITIONS: Record<TransitionId, Transition> = {
  "onboarding-till-nulage": {
    done: "Grunduppgifterna är på plats: kontaktperson, bolag och organisationsnummer.",
    next: "Nu går vi igenom ekonomin - betalningar, skulder och tillgångar.",
    why: "Utan siffrorna går det inte att säga vilka alternativ som faktiskt är öppna för just det här bolaget.",
    effort: "Det tar ungefär fem minuter, och du kan pausa när som helst.",
    audience: "Uppgifterna stannar hos dig tills du själv väljer att dela dem.",
  },
  "nulage-foretag-till-betalningar": {
    done: "Företagsuppgifterna är registrerade.",
    next: "Härnäst frågar vi vad som ska betalas den närmaste tiden: löner, skatt och hyra.",
    why: "Ordningen mellan betalningarna avgör både handlingsutrymmet och när ett personligt ansvar kan börja löpa.",
    effort: "Fyra frågor, ungefär två minuter.",
  },
  "nulage-betalningar-till-skulder": {
    done: "Betalningsbilden är klar.",
    next: "Nu handlar det om skulderna och vad tillgångarna är värda vid en snabb avyttring.",
    why: "Förhållandet mellan de två avgör om kontrollbalansräkning aktualiseras - och vilka vägar som står öppna.",
    effort: "Två frågor, under en minut.",
  },
  "nulage-skulder-till-bedomning": {
    done: "Alla uppgifter är inne.",
    next: "Systemet räknar nu igenom läget och visar en bedömning med de frister som gäller.",
    why: "Bedömningen är underlag för beslut - den räknas fram ur dina svar och går att följa steg för steg.",
    effort: "Det tar några sekunder.",
  },
  "bedomning-till-arende": {
    done: "Bedömningen är klar.",
    next: "Nästa steg är att spara den som ett ärende, så att frister bevakas och allt journalförs.",
    why: "Ett sparat ärende är det som gör att vi kan följa bolaget över tid i stället för att börja om vid varje besök.",
    effort: "Det tar ett klick.",
    audience: "Ärendet är ditt. Rådgivare ser det först när du bjuder in dem.",
  },
};

/* --- De fyra reglerna, som text och som kontrollerbara påståenden ---------- */

export const PREPARE_RULES = [
  "Ingen ny fråga utan en kort introduktion om ämnet.",
  "Ingen ny sektion utan ett övergångsmeddelande.",
  "Ingen extern kontroll eller datainsamling utan att användaren får veta vad som sker.",
  "Ingen väntetid utan att användaren får veta vad systemet arbetar med.",
] as const;

/**
 * Väntebesked enligt regel 3 och 4.
 *
 * Ett besked som bara säger "Hämtar…" svarar inte på någon av de fyra
 * frågorna. Det ska stå VAD som hämtas, VARIFRÅN och ungefär hur länge -
 * särskilt när uppgiften lämnar produkten, för då är det inte längre
 * bara väntan utan en extern kontroll användaren har rätt att känna till.
 */
export interface WaitNotice {
  /** Vad systemet gör just nu. */
  doing: string;
  /** Var uppgiften hämtas ifrån. Null när ingenting lämnar produkten. */
  source: string | null;
  /** Ungefärlig väntetid, i ord. */
  duration: string;
}

export const waitText = (w: WaitNotice): string =>
  [w.doing, w.source ? `Uppgifterna hämtas från ${w.source}.` : null, w.duration]
    .filter(Boolean)
    .join(" ");

export const WAITS = {
  companyLookup: {
    doing: "Hämtar företagets grunduppgifter.",
    source: "företagsregistret",
    duration: "Det tar några sekunder.",
  },
  documents: {
    doing: "Hämtar ärendets handlingar.",
    source: null,
    duration: "Det tar ett ögonblick.",
  },
  advisors: {
    doing: "Hämtar rådgivare som matchar ärendet.",
    source: "CLEARANCE katalog",
    duration: "Det tar ett ögonblick.",
  },
  documentHash: {
    doing: "Läser handlingen och räknar fram dess kontrollsumma.",
    source: null,
    duration: "Det tar några sekunder för en större fil.",
  },
  /**
   * Bakgrundsanalysen under introduktionssamtalet. Väntetiden är den
   * längsta i produkten, och den enda där användaren har något annat
   * att göra under tiden - desto viktigare att det står vad som pågår.
   */
  backgroundAnalysis: {
    doing: "Sätter ihop en första bild av företaget.",
    source: "företagsregistret och dina svar",
    duration: "Det tar några sekunder, och du kan svara på frågorna under tiden.",
  },
} as const satisfies Record<string, WaitNotice>;

/* --- Kontroller som testerna använder -------------------------------------- */

/** En övergång är komplett när alla fyra obligatoriska delar finns. */
export const isComplete = (t: Transition): boolean =>
  [t.done, t.next, t.why, t.effort].every((part) => typeof part === "string" && part.trim().length > 0);

/**
 * Del 4 ska vara KONKRET. "Det går snabbt" är inte ett svar på hur lång
 * tid det tar - ett tal, ett räkneord eller ett antal steg är det.
 *
 * Räkneorden står utskrivna eftersom texterna är det: "fem minuter"
 * läses bättre än "5 minuter" i löpande text, och vakten ska mäta det
 * som faktiskt står i produkten.
 *
 * Gränsen före räkneordet skrivs som "inte en bokstav" med u-flaggan i
 * stället för \b. Ett ASCII-ordgränsankare ser inte å, ä och ö som
 * bokstäver, och skulle därför missa just de ord som är svenska.
 */
export const hasConcreteEffort = (t: Transition): boolean =>
  /(?:^|[^\p{L}])(?:\d+|en|ett|två|tre|fyra|fem|sex|sju|åtta|nio|tio|några)\s+(?:sekund|minut|steg|fråg|klick|ögonblick)/iu.test(
    t.effort,
  );

/**
 * Del 3 ska förklara SYFTET, inte upprepa vad som händer. Den enklaste
 * kontrollen som fångar upprepningen: motiveringen får inte vara samma
 * mening som nästa steg, och den ska säga något om vad svaret används
 * till.
 */
export const explainsPurpose = (t: Transition): boolean =>
  t.why.trim() !== t.next.trim() &&
  /avgör|används|behövs|går det inte att|går inte att|underlag|bedöm|följa|kan börja|styr/i.test(
    t.why,
  );
