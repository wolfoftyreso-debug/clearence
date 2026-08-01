/**
 * Fakturor och kvitton.
 *
 * Beräkningen är ren och sitter här, inte i en vy. En faktura är ett
 * bokföringsunderlag: samma indata måste ge samma belopp varje gång, och
 * beloppen måste gå att räkna efter för hand.
 *
 * Två regler som koden vägrar att bryta:
 *
 *  1. **Moms läggs bara på om bolaget är momsregistrerat.** Att ta ut moms
 *     utan registrering är inte ett formfel, det är att kräva in en skatt man
 *     inte får kräva in. `buildInvoice` returnerar ett fel i stället för ett
 *     belopp när registreringen inte är bekräftad.
 *
 *  2. **Ören avrundas en gång, på momsen, och summan härleds.** Räknar man
 *     netto och brutto var för sig och drar ifrån hamnar man en öre fel i
 *     ungefär vart tionde fall, och då stämmer inte fakturan mot
 *     inbetalningen.
 *
 * Belopp hålls i ören (heltal) hela vägen. Flyttal och pengar hör inte ihop:
 * 0.1 + 0.2 är inte 0.3, och en faktura som är ett öre fel är en faktura som
 * någon måste reda ut för hand.
 */

import { COMPANY, missingInvoiceFields, type CompanyIdentity } from "./company";

/** Svensk normalskattesats. */
export const VAT_RATE = 0.25;

/** Betalningsvillkor i dagar från fakturadatum. */
export const PAYMENT_TERMS_DAYS = 10;

export interface InvoiceLine {
  description: string;
  /** Antal. Heltal eller decimal, t.ex. 1 eller 2,5 timmar. */
  quantity: number;
  /** À-pris i ören, exklusive moms. */
  unitPriceOre: number;
}

export interface InvoiceInput {
  /** Löpnummer. Ska vara obrutet och stigande - se nextInvoiceNumber(). */
  invoiceNumber: string;
  /** ISO. Fakturadatum. */
  issuedAt: string;
  /** Kunden. */
  customer: {
    name: string;
    orgNumber: string | null;
    email: string;
    address: string | null;
  };
  lines: InvoiceLine[];
  /** Fritext under raderna, t.ex. vilken period avgiften avser. */
  note?: string | null;
}

export interface InvoiceTotals {
  /** Summa exklusive moms, i ören. */
  netOre: number;
  /** Momsbelopp, i ören. */
  vatOre: number;
  /** Att betala, i ören. */
  grossOre: number;
  vatRate: number;
}

export interface Invoice extends InvoiceInput {
  totals: InvoiceTotals;
  /** ISO. Förfallodag. */
  dueAt: string;
  seller: CompanyIdentity;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Ören till "1 234,50 kr". */
export const formatOre = (ore: number): string => {
  const sign = ore < 0 ? "-" : "";
  const abs = Math.abs(ore);
  const kr = Math.floor(abs / 100);
  const rest = abs % 100;
  // Egen tusentalsavgränsare: toLocaleString ger U+00A0, som ser ut som ett
  // mellanslag men inte är det, och som därför bryter jämförelser i tester
  // och sökningar i färdiga dokument.
  const grouped = String(kr).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${grouped},${String(rest).padStart(2, "0")} kr`;
};

/** Radens belopp exklusive moms, i ören. Avrundas till hel öre. */
export const lineTotalOre = (line: InvoiceLine): number =>
  Math.round(line.quantity * line.unitPriceOre);

/**
 * Summorna.
 *
 * Momsen avrundas till hel öre och bruttot är summan av netto och moms.
 * Ordningen är avsiktlig: härleds nettot ur bruttot i stället uppstår en
 * öresdifferens som inte går att förklara för en revisor.
 */
export const invoiceTotals = (lines: InvoiceLine[], vatRate: number): InvoiceTotals => {
  const netOre = lines.reduce((sum, line) => sum + lineTotalOre(line), 0);
  const vatOre = Math.round(netOre * vatRate);
  return { netOre, vatOre, grossOre: netOre + vatOre, vatRate };
};

export type InvoiceResult =
  | { ok: true; invoice: Invoice }
  | { ok: false; blockedBy: string[] };

/**
 * Bygger en faktura, eller vägrar.
 *
 * Vägran är inte en artighet. En faktura som går ut utan
 * momsregistreringsnummer, utan bekräftad F-skatt eller med ett tomt
 * bankgiro är ett dokument mottagaren inte kan bokföra och inte kan betala.
 * Bättre att den aldrig skapas än att den skickas.
 */
export const buildInvoice = (
  input: InvoiceInput,
  seller: CompanyIdentity = COMPANY,
): InvoiceResult => {
  const blockedBy = missingInvoiceFields(seller);
  if (input.lines.length === 0) blockedBy.push("minst en fakturarad");
  if (blockedBy.length > 0) return { ok: false, blockedBy };

  const issued = new Date(input.issuedAt);
  return {
    ok: true,
    invoice: {
      ...input,
      seller,
      totals: invoiceTotals(input.lines, VAT_RATE),
      dueAt: new Date(issued.getTime() + PAYMENT_TERMS_DAYS * DAY_MS).toISOString(),
    },
  };
};

/**
 * Nästa fakturanummer.
 *
 * Serien måste vara obruten och stigande - Skatteverket kräver det, och ett
 * hopp i serien är det första en granskare frågar om. Formatet är ÅR-NNNN och
 * serien börjar om vid årsskiftet, vilket är vanligast och gör en lucka lätt
 * att se.
 *
 * `existing` är alla tidigare nummer. Beräkningen utgår från det högsta för
 * innevarande år, inte från antalet: en makulerad faktura får inte leda till
 * att ett nummer återanvänds.
 */
export const nextInvoiceNumber = (existing: string[], now: Date): string => {
  const year = now.getFullYear();
  const prefix = `${year}-`;
  const highest = existing
    .filter((n) => n.startsWith(prefix))
    .map((n) => Number.parseInt(n.slice(prefix.length), 10))
    .filter((n) => Number.isFinite(n))
    .reduce((max, n) => Math.max(max, n), 0);
  return `${prefix}${String(highest + 1).padStart(4, "0")}`;
};
