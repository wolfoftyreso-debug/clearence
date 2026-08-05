/**
 * MIKROUTBILDNING: små återkommande förklaringar i stället för en manual.
 *
 * "Det här kallas ett kontrollområde." Två sekunder senare: "Här ser du
 * de viktigaste nyckeltalen." Tre minuter senare: "Kommer du ihåg
 * kontrollområdet? Där kommer även framtida varningar att visas."
 *
 * Uppdelningen är hela poängen. En genomgång vid första inloggningen
 * hamnar i det ögonblick användaren har minst nytta av den - hen vet
 * ännu inte vad frågan är. Samma innehåll utspritt över de första
 * dagarna, med en påminnelse när ytan blir relevant, fastnar.
 *
 * TVÅ REGLER SOM INTE FÅR BÖJAS:
 *
 *  1. En lektion visas EN gång. Minnet ligger i localStorage och
 *     konsulteras innan något visas. En produkt som upprepar sig blir
 *     något man klickar bort utan att läsa, och då är även det viktiga
 *     bortklickat.
 *  2. En lektion visas ALDRIG när läget är akut. Den som inte kan betala
 *     lönerna på fredag ska inte få veta vad ett kontrollområde heter.
 *     Undervisning i fel ögonblick är inte omtanke, den är i vägen.
 */

export interface MicroLesson {
  id: string;
  /** Ytan lektionen hör till. Samma ankarnamn som guiden använder. */
  anchor: string;
  /** Den korta förklaringen. En mening, inte ett stycke. */
  text: string;
  /**
   * Påminnelsen, som kommer långt senare och knyter an till något nytt.
   * Null när lektionen inte har någon uppföljning.
   */
  followUp: string | null;
  /**
   * Hur länge efter första visningen påminnelsen får komma, i minuter.
   * Tre minuter i exemplet - men den bör landa i ett senare BESÖK, inte
   * i samma andetag.
   */
  followUpAfterMinutes: number;
  /**
   * Ordningen lektionerna kommer i. Låg först. Två lektioner med samma
   * ordning är ett fel som testet fäller.
   */
  order: number;
}

export const MICRO_LESSONS: MicroLesson[] = [
  {
    id: "kontrollomrade",
    anchor: "kontrollomrade",
    text: "Det här kallas kontrolläget. Här ser du vad systemet bevakar åt dig.",
    followUp:
      "Kommer du ihåg kontrolläget? Det är också där framtida varningar dyker upp – du behöver inte leta efter dem.",
    followUpAfterMinutes: 3,
    order: 1,
  },
  {
    id: "handlingsplan",
    anchor: "handlingsplan",
    text: "Handlingsplanen står i fristernas ordning, inte i den ordning punkterna skapades.",
    followUp:
      "Handlingsplanen sorterar om sig själv när ett datum närmar sig. Den översta raden är alltid den som brådskar mest.",
    followUpAfterMinutes: 5,
    order: 2,
  },
  {
    id: "dokument",
    anchor: "dokumentvyn",
    text: "Allt som produceras i ärendet sparas här automatiskt. Du behöver aldrig leta efter en rapport.",
    followUp:
      "Dokumenten ligger kvar även efter att ärendet avslutats – det är ofta då någon frågar efter dem.",
    followUpAfterMinutes: 8,
    order: 3,
  },
  {
    id: "handelselogg",
    anchor: "handelseloggen",
    text: "Händelseloggen skrivs av databasen och går inte att ändra i efterhand.",
    followUp:
      "Loggen är det som visar NÄR ni insåg något och när ni agerade. Det är ofta den frågan som ställs efteråt.",
    followUpAfterMinutes: 12,
    order: 4,
  },
  {
    id: "likviditet",
    anchor: "likviditetsvyn",
    text: "Kurvan visar bara utbetalningar. Den är ett golv, inte en prognos.",
    followUp:
      "Nyckeltalen i likviditetsvyn går att klicka på – då ser du vad talet räknats fram ur och vad det inte säger.",
    followUpAfterMinutes: 6,
    order: 5,
  },
];

const KEY = "clearance-mikrolektioner";

interface LessonMemory {
  /** id → tidpunkten lektionen visades, som ISO. */
  shown: Record<string, string>;
  /** id:n vars påminnelse också är avklarad. */
  reminded: string[];
}

const emptyMemory = (): LessonMemory => ({ shown: {}, reminded: [] });

export const readMemory = (): LessonMemory => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyMemory();
    const parsed = JSON.parse(raw) as Partial<LessonMemory>;
    return {
      shown: parsed.shown && typeof parsed.shown === "object" ? parsed.shown : {},
      reminded: Array.isArray(parsed.reminded) ? parsed.reminded : [],
    };
  } catch {
    return emptyMemory();
  }
};

const writeMemory = (memory: LessonMemory): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // Privat läge eller fullt. Det värsta som händer är en förklaring
    // för mycket - aldrig en utebliven varning, eftersom lektionerna
    // aldrig bär något tidskritiskt.
  }
};

export const rememberShown = (id: string, now: Date): void => {
  const memory = readMemory();
  memory.shown[id] = now.toISOString();
  writeMemory(memory);
};

export const rememberReminded = (id: string): void => {
  const memory = readMemory();
  if (!memory.reminded.includes(id)) memory.reminded.push(id);
  writeMemory(memory);
};

export interface LessonDue {
  lesson: MicroLesson;
  /** "forsta" = den korta förklaringen, "paminnelse" = uppföljningen. */
  phase: "forsta" | "paminnelse";
  text: string;
}

/**
 * Nästa lektion som ska visas, om någon.
 *
 * `visibleAnchors` är de ytor som faktiskt syns just nu - en lektion om
 * händelseloggen får inte visas på likviditetssidan. `acute` stänger av
 * undervisningen helt.
 */
export const dueLesson = (input: {
  visibleAnchors: string[];
  acute: boolean;
  now: Date;
  memory?: LessonMemory;
}): LessonDue | null => {
  if (input.acute) return null;
  const memory = input.memory ?? readMemory();
  const visible = new Set(input.visibleAnchors);
  const candidates = [...MICRO_LESSONS].sort((a, b) => a.order - b.order);

  // Påminnelserna först: en uppföljning som förfallit är mer värd än en
  // ny lektion, eftersom den knyter ihop något användaren redan sett.
  for (const lesson of candidates) {
    if (!lesson.followUp || memory.reminded.includes(lesson.id)) continue;
    const shownAt = memory.shown[lesson.id];
    if (!shownAt || !visible.has(lesson.anchor)) continue;
    const elapsed = input.now.getTime() - new Date(shownAt).getTime();
    if (Number.isNaN(elapsed)) continue;
    if (elapsed >= lesson.followUpAfterMinutes * 60_000) {
      return { lesson, phase: "paminnelse", text: lesson.followUp };
    }
  }

  for (const lesson of candidates) {
    if (memory.shown[lesson.id] || !visible.has(lesson.anchor)) continue;
    return { lesson, phase: "forsta", text: lesson.text };
  }
  return null;
};

/** Nollställer minnet. Finns för att kunna se introduktionen igen. */
export const forgetLessons = (): void => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Se ovan.
  }
};
