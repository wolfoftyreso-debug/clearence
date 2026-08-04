/**
 * FAKTURAN, SPECIFICERAD PÅ SKÄRMEN.
 *
 * Fakturaraden gick att fälla ut, men det som kom fram var en lista över
 * användningsavgifter - och för en faktura som inte hade några stod det
 * bara att specifikationen låg "utanför". Det är att svara på en fråga
 * med att säga att frågan inte hör hit.
 *
 * En faktura ska gå att läsa i sin helhet: vem som fakturerar, vem som
 * faktureras, vad som ingår, moms per sats, och hur den betalas. Det är
 * inte pynt - det är de uppgifter en faktura måste innehålla för att
 * kunna bokföras, och den som ska betala har rätt att se dem utan att
 * först ladda ner en fil.
 *
 * Underlaget byggs ur SAMMA modell som PDF:en (invoiceFromCustomerRecord
 * i src/lib/reports/invoiceDocuments.ts). Skärmen och filen kan därmed
 * inte säga olika saker - och en faktura som säger två saker om samma
 * belopp är oanvändbar för båda parter.
 */

import type { Invoice } from "./invoice";
import { COMPANY, paymentAccounts } from "./company";

export interface SpecLine {
  description: string;
  quantity: number;
  /** À-pris exklusive moms. */
  unitPrice: string;
  /** Radsumma exklusive moms. */
  net: string;
}

export interface VatBand {
  /** Satsen i procent, t.ex. "25 %". */
  rate: string;
  /** Underlaget som momsen räknas på. */
  base: string;
  /** Momsbeloppet. */
  amount: string;
}

export interface InvoiceSpecification {
  invoiceNumber: string;
  issued: string;
  due: string;
  /** Betalningsvillkor i dagar, räknat ur datumen. */
  terms: string;
  seller: { name: string; orgNumber: string; vatNumber: string; office: string };
  customer: { name: string; orgNumber: string | null; email: string };
  lines: SpecLine[];
  net: string;
  vatBands: VatBand[];
  vat: string;
  gross: string;
  /** Kontona att betala till. Tomma poster utelämnas av paymentAccounts. */
  paymentAccounts: { label: string; number: string }[];
  /** Referensen som ska anges vid betalning. */
  reference: string;
  /** Skattskyldighetsraden - en faktura utan den är inte fullständig. */
  vatNote: string;
}

const kr = (ore: number): string =>
  `${(ore / 100).toLocaleString("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`;

const swedishDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });
};

const daysBetween = (from: string, to: string): number | null => {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
};

/**
 * Specifikationen ur fakturamodellen.
 *
 * Momsen redovisas PER SATS och inte som en klumpsumma. I dag har
 * produkten en sats, men en faktura som blandar 25 och 6 procent måste
 * kunna visa båda - och en struktur som antar en sats behöver skrivas om
 * just den dagen någon ska bokföra den.
 */
export const buildInvoiceSpecification = (
  invoice: Invoice,
  reference: string | null,
): InvoiceSpecification => {
  const lines: SpecLine[] = invoice.lines.map((line) => ({
    description: line.description,
    quantity: line.quantity,
    unitPrice: kr(line.unitPriceOre),
    net: kr(Math.round(line.unitPriceOre * line.quantity)),
  }));

  const days = daysBetween(invoice.issuedAt, invoice.dueAt);

  return {
    invoiceNumber: invoice.invoiceNumber,
    issued: swedishDate(invoice.issuedAt),
    due: swedishDate(invoice.dueAt),
    terms: days === null ? "Enligt avtal" : `${days} dagar netto`,
    seller: {
      name: COMPANY.legalName,
      orgNumber: COMPANY.orgNumber,
      vatNumber: COMPANY.vatNumber,
      office: COMPANY.registeredOffice,
    },
    customer: {
      name: invoice.customer.name,
      orgNumber: invoice.customer.orgNumber,
      email: invoice.customer.email,
    },
    lines,
    net: kr(invoice.totals.netOre),
    vatBands: [
      {
        rate: `${Math.round(invoice.totals.vatRate * 100)} %`,
        base: kr(invoice.totals.netOre),
        amount: kr(invoice.totals.vatOre),
      },
    ],
    vat: kr(invoice.totals.vatOre),
    gross: kr(invoice.totals.grossOre),
    paymentAccounts: paymentAccounts(COMPANY),
    // Fakturanumret är referensen när ingen annan angetts. Att lämna
    // fältet tomt gör betalningen omöjlig att stämma av.
    reference: reference ?? invoice.invoiceNumber,
    vatNote: `Moms redovisas enligt svensk mervärdesskattelag. Momsregistreringsnummer ${COMPANY.vatNumber}.`,
  };
};

/**
 * Filnamnet när fakturan bifogas eller skickas vidare.
 *
 * Fakturanumret först: den som får tio filer i en mapp ska kunna sortera
 * dem utan att öppna någon.
 */
export const invoiceFileName = (invoiceNumber: string): string =>
  `Faktura-${invoiceNumber.replace(/[^\w-]+/g, "-")}.pdf`;

/**
 * Meddelandet som följer med när fakturan skickas vidare.
 *
 * Skrivet för mottagaren - oftast en bokförare som får den vidarebefordrad
 * och inte vet vad CLEARANCE är. Den behöver veta vad det gäller, vad som
 * ska betalas, när, och till vilket konto.
 */
export const forwardMessage = (spec: InvoiceSpecification): { subject: string; body: string } => ({
  subject: `Faktura ${spec.invoiceNumber} från ${spec.seller.name} - ${spec.gross}`,
  body: [
    `Faktura ${spec.invoiceNumber} från ${spec.seller.name} (org.nr ${spec.seller.orgNumber}).`,
    "",
    `Belopp att betala: ${spec.gross} (varav moms ${spec.vat}).`,
    `Förfallodag: ${spec.due}. Villkor: ${spec.terms}.`,
    `Betalningsreferens: ${spec.reference}.`,
    ...spec.paymentAccounts.map((a) => `${a.label}: ${a.number}`),
    "",
    "Fakturan i sin helhet är bifogad som PDF.",
  ].join("\n"),
});
