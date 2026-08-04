/**
 * NYCKELTALEN, MED SITT UNDERLAG.
 *
 * "Runway: 8 dagar" är ett av de mest ingripande påståenden produkten gör.
 * Någon kan fatta beslut om personal, om att ansöka om rekonstruktion,
 * eller om att lägga ner - på den siffran. Då räcker det inte att visa
 * den. Den ska gå att öppna, och den som öppnar ska se posterna, formeln,
 * och framför allt VAD SIFFRAN INTE SÄGER.
 *
 * Den sista delen är den viktigaste här, och skälet är konkret: kurvan
 * räknar bara pengar UT. Obetalda kundfakturor beräknas på sidan men når
 * aldrig grafen. "Runway 8 dagar" förutsätter alltså noll intäkter under
 * hela horisonten - ett medvetet försiktigt antagande, men ett antagande.
 * Den som inte får veta det läser siffran som en prognos i stället för
 * som ett golv.
 *
 * Regeln, som gäller varje nyckeltal produkten visar: ett tal utan
 * underlag är ett påstående, och ett påstående som inte går att granska
 * är sämre än inget tal alls.
 */

import type { PaymentRecord } from "@/data/types";

export type FigureId = "kassa" | "vantande" | "prognos" | "runway";

export interface FigureRow {
  label: string;
  value: string;
  /** Kort förtydligande när raden behöver ett. */
  note?: string;
}

export interface KeyFigure {
  id: FigureId;
  label: string;
  /** Talet som står på rutan, formaterat. */
  value: string;
  /** Hur talet räknas fram, i en mening. */
  formula: string;
  /** Posterna som ingår. Tom lista när talet är inmatat och inte räknat. */
  rows: FigureRow[];
  /** Vad talet betyder för ett beslut. */
  meaning: string;
  /** Vad talet INTE säger. Aldrig tom - varje siffra har en gräns. */
  limits: string[];
}

export const kr = (value: number): string => `${Math.round(value).toLocaleString("sv-SE")} kr`;

const CATEGORY_LABEL: Record<string, string> = {
  salary: "Löner",
  tax: "Skatt och avgifter",
  rent: "Hyra",
  supplier: "Leverantörer",
  loan: "Lån och räntor",
  other: "Övrigt",
};

export interface KeyFigureInput {
  startingBalance: number;
  /** Alla registrerade betalningar i planen. */
  payments: PaymentRecord[];
  horizonDays: number;
  /** Saldot vid horisontens slut i det valda scenariot. */
  finalBalance: number;
  /** Dag då saldot först går under noll, eller null. */
  daysToNegative: number | null;
  /** Scenariots namn, så att detaljen inte förklarar fel kurva. */
  scenarioLabel: string;
  /** Obetalda kundfakturor. Räknas INTE in - och det ska stå. */
  incomingUnpaidTotal: number;
  incomingUnpaidCount: number;
}

/** Betalningarna som faktiskt drar ner kurvan. */
const draining = (payments: PaymentRecord[]): PaymentRecord[] =>
  payments.filter((p) => p.status === "pending" || p.status === "critical");

/** Summa per kategori, störst först. En lista på trettio rader läses inte. */
const byCategory = (payments: PaymentRecord[]): FigureRow[] => {
  const sums = new Map<string, { total: number; count: number }>();
  for (const p of payments) {
    const key = p.category ?? "other";
    const current = sums.get(key) ?? { total: 0, count: 0 };
    sums.set(key, { total: current.total + p.amount, count: current.count + 1 });
  }
  return [...sums.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([key, { total, count }]) => ({
      label: CATEGORY_LABEL[key] ?? key,
      value: kr(total),
      note: count === 1 ? "1 post" : `${count} poster`,
    }));
};

export const buildKeyFigures = (input: KeyFigureInput): KeyFigure[] => {
  const pending = draining(input.payments);
  const postponed = input.payments.filter((p) => p.status === "postponed");
  const paid = input.payments.filter((p) => p.status === "paid");
  const total = pending.reduce((sum, p) => sum + p.amount, 0);

  /**
   * Gäller alla fyra: kurvan har inga inbetalningar. Formuleringen är
   * densamma överallt med flit - ett förbehåll som skrivs om för varje
   * ruta läses som fyra olika förbehåll.
   */
  const noIncome =
    input.incomingUnpaidCount > 0
      ? `Inga inbetalningar räknas med. Du har ${input.incomingUnpaidCount} obetalda kundfakturor på ${kr(input.incomingUnpaidTotal)} som inte ingår i kurvan.`
      : "Inga inbetalningar räknas med. Kurvan visar bara vad som går ut.";

  return [
    {
      id: "kassa",
      label: "Aktuell kassa",
      value: kr(input.startingBalance),
      formula: "Det belopp du själv har skrivit in. Systemet hämtar det inte från banken.",
      rows: [{ label: "Ingående saldo", value: kr(input.startingBalance), note: "inmatat" }],
      meaning: "Startpunkten för hela kurvan. Är den fel är allt nedanför fel.",
      limits: [
        "Uppgiften är inte avstämd mot något konto - den är lika aktuell som senast du ändrade den.",
        "Beviljad men outnyttjad checkkredit ingår inte om du inte räknat in den själv.",
      ],
    },
    {
      id: "vantande",
      label: "Väntande betalningar",
      value: kr(total),
      formula:
        "Summan av alla registrerade betalningar med status Väntande eller Kritisk. Betalda och uppskjutna räknas inte.",
      rows: [
        ...byCategory(pending),
        ...(postponed.length > 0
          ? [{
              label: "Uppskjutna",
              value: kr(postponed.reduce((s, p) => s + p.amount, 0)),
              note: `${postponed.length} poster, ingår INTE i summan`,
            }]
          : []),
        ...(paid.length > 0
          ? [{
              label: "Redan betalda",
              value: kr(paid.reduce((s, p) => s + p.amount, 0)),
              note: `${paid.length} poster, ingår INTE i summan`,
            }]
          : []),
      ],
      meaning:
        "Det som ska ut ur kassan om ingenting förhandlas om. En uppskjuten betalning flyttar beloppet, den tar inte bort det.",
      limits: [
        "Bara det som är registrerat här. Det som inte lagts in syns inte i någon siffra på sidan.",
        "Dröjsmålsräntor och påminnelseavgifter ingår inte.",
      ],
    },
    {
      id: "prognos",
      label: `Prognos ${input.horizonDays} dagar`,
      value: kr(input.finalBalance),
      formula: `Aktuell kassa minus de betalningar som förfaller inom ${input.horizonDays} dagar, dag för dag, i scenariot "${input.scenarioLabel}".`,
      rows: [
        { label: "Aktuell kassa", value: kr(input.startingBalance) },
        { label: "Betalningar inom horisonten", value: `−${kr(total)}` },
        { label: `Saldo dag ${input.horizonDays}`, value: kr(input.finalBalance) },
      ],
      meaning:
        input.finalBalance < 0
          ? "Ett negativt tal betyder att pengarna tar slut före horisonten - inte att bolaget är insolvent. Skillnaden avgörs av vad som går att förhandla om."
          : "Kassan räcker horisonten ut om ingenting oväntat inträffar och inget nytt tillkommer.",
      limits: [
        noIncome,
        `Horisonten är ${input.horizonDays} dagar. Vad som händer dag ${input.horizonDays + 1} syns inte här.`,
        "Scenariot styr vilka poster som räknas. Byter du scenario ändras talet.",
      ],
    },
    {
      id: "runway",
      label: "Runway",
      value:
        input.daysToNegative === null
          ? `${input.horizonDays}+ dagar`
          : `${input.daysToNegative} dagar`,
      formula:
        "Antal dagar tills saldot första gången går under noll, räknat från i dag med de registrerade betalningarna.",
      rows: [
        { label: "Startsaldo", value: kr(input.startingBalance) },
        { label: "Ska betalas inom horisonten", value: kr(total) },
        {
          label: "Går under noll",
          value:
            input.daysToNegative === null
              ? `Inte inom ${input.horizonDays} dagar`
              : `Dag ${input.daysToNegative}`,
        },
      ],
      meaning:
        input.daysToNegative === null
          ? "Kassan håller horisonten ut med det som är inlagt. Det är ett golv, inte ett löfte."
          : "Dagen då kassan tar slut med nuvarande plan. Det är den dagen besluten ska vara fattade före, inte den dag de ska fattas.",
      limits: [
        noIncome,
        "Talet är ett GOLV, inte en prognos: med inbetalningar räcker kassan längre, med oväntade utgifter kortare.",
        "En uppskjuten betalning flyttar dagen framåt utan att skulden minskar.",
      ],
    },
  ];
};

export const figureById = (figures: KeyFigure[], id: FigureId): KeyFigure | null =>
  figures.find((f) => f.id === id) ?? null;
