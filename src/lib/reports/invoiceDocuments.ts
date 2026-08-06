/**
 * Fakturan och kvittot som dokument.
 *
 * Bygger på samma ReportModel som övriga rapporter, så att de skrivs ut genom
 * samma väg och ser ut som resten av det bolaget skickar ifrån sig.
 *
 * Den generella ansvarsfriskrivningen hör inte hemma här. Den handlar om att
 * analyserna bygger på användarens egna uppgifter; en faktura är ett krav på
 * betalning och ska bära sina egna villkor, inte en text om att beloppen kan
 * vara osäkra.
 */

import type { Invoice } from "../invoice";
import { formatOre, lineTotalOre, VAT_RATE } from "../invoice";
import { COMPANY, formatAddress, paymentAccounts } from "../company";
import type { CustomerInvoiceRecord } from "@/data/types";
import type { ReportModel, TableRow } from "./types";

/**
 * Bygger fakturamodellen ur den lagrade kundfakturan - delad av
 * Inställningar och samtalets fakturakort, så att samma faktura aldrig
 * kan se olika ut på två ställen. Beloppen läses från raden och räknas
 * inte om: en faktura som skrivs ut om ett år måste visa vad som
 * fakturerades då, inte vad samma tjänst hade kostat idag.
 */
export const invoiceFromCustomerRecord = (
  record: CustomerInvoiceRecord,
  customer: { name: string; email: string },
): Invoice => ({
  invoiceNumber: record.invoiceNumber,
  issuedAt: record.issuedAt,
  dueAt: record.dueAt,
  seller: COMPANY,
  // Namnet på fakturan är det som stod där när den ställdes ut. Den
  // inloggades nuvarande namn används bara på rader som skapades innan
  // avbildningen fanns - då är det den enda uppgift vi har.
  customer: {
    name: record.customerName ?? customer.name,
    orgNumber: record.customerOrgNumber,
    email: customer.email,
    address: record.customerAddress,
  },
  period:
    record.periodStart && record.periodEnd
      ? { start: record.periodStart, end: record.periodEnd }
      : null,
  lines: [
    {
      description: record.description,
      quantity: 1,
      unitPriceOre: record.netOre,
    },
  ],
  note: null,
  totals: {
    netOre: record.netOre,
    vatOre: record.vatOre,
    grossOre: record.grossOre,
    vatRate: record.vatRate || VAT_RATE,
  },
});

const swedishDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });
};

const sellerBlock = (invoice: Invoice) => {
  const { seller } = invoice;
  const accounts = paymentAccounts(seller);
  return [
    { label: "Säljare", value: seller.legalName, note: formatAddress(seller) },
    { label: "Organisationsnummer", value: seller.orgNumber },
    { label: "Momsreg.nr", value: seller.vatNumber },
    ...accounts.map((a) => ({ label: a.label, value: a.number })),
  ];
};

const lineRows = (invoice: Invoice): TableRow[] =>
  invoice.lines.map((line) => ({
    cells: [
      line.description,
      String(line.quantity).replace(".", ","),
      formatOre(line.unitPriceOre),
      formatOre(lineTotalOre(line)),
    ],
  }));

/**
 * Fakturan.
 *
 * Ordningen är den som en mottagares ekonomifunktion läser i: vad det gäller,
 * vad det kostar, när det ska betalas, vart. Betalningsuppgifterna står både
 * i huvudet och sist, eftersom den som betalar ofta bara tittar på slutet.
 */
/**
 * Raden som uppfyller 17 kap. 24 § 7: när tillhandahållandet skedde.
 *
 * Är start och slut samma dag är det en engångsleverans och rubriken ska
 * säga leveransdatum. Skiljer de sig är det en period, och då är det
 * perioden mottagaren behöver för att periodisera kostnaden rätt.
 */
const deliveryRow = (invoice: Invoice): { label: string; value: string } | null => {
  if (!invoice.period) return null;
  const { start, end } = invoice.period;
  if (start === end) return { label: "Leveransdatum", value: swedishDate(start) };
  return { label: "Avser perioden", value: `${swedishDate(start)} – ${swedishDate(end)}` };
};

export const buildInvoiceDocument = (invoice: Invoice): ReportModel => {
  const accounts = paymentAccounts(invoice.seller);
  const vatPercent = `${Math.round(invoice.totals.vatRate * 100)} %`;
  const delivery = deliveryRow(invoice);

  return {
    meta: {
      documentTitle: `Faktura ${invoice.invoiceNumber}`,
      companyName: invoice.customer.name,
      orgNumber: invoice.customer.orgNumber,
      reference: invoice.invoiceNumber,
      generatedAt: invoice.issuedAt,
    },
    lead: [
      {
        kind: "keyValues",
        items: [
          { label: "Fakturanummer", value: invoice.invoiceNumber },
          { label: "Fakturadatum", value: swedishDate(invoice.issuedAt) },
          ...(delivery ? [delivery] : []),
          {
            label: "Förfallodag",
            value: swedishDate(invoice.dueAt),
            tone: "warning",
          },
          {
            label: "Att betala",
            value: formatOre(invoice.totals.grossOre),
          },
        ],
      },
    ],
    sections: [
      {
        title: "Parter",
        blocks: [
          { kind: "keyValues", items: sellerBlock(invoice) },
          {
            kind: "keyValues",
            items: [
              {
                label: "Köpare",
                value: invoice.customer.name,
                note: invoice.customer.address ?? undefined,
              },
              ...(invoice.customer.orgNumber
                ? [{ label: "Organisationsnummer", value: invoice.customer.orgNumber }]
                : []),
              { label: "E-post", value: invoice.customer.email },
            ],
          },
        ],
      },
      {
        title: "Specifikation",
        blocks: [
          {
            kind: "table",
            columns: [
              { label: "Beskrivning" },
              { label: "Antal", align: "right", numeric: true },
              { label: "À-pris", align: "right", numeric: true },
              { label: "Belopp", align: "right", numeric: true },
            ],
            rows: lineRows(invoice),
            totals: ["Summa exkl. moms", "", "", formatOre(invoice.totals.netOre)],
          },
          {
            kind: "keyValues",
            items: [
              { label: "Summa exkl. moms", value: formatOre(invoice.totals.netOre) },
              { label: `Moms ${vatPercent}`, value: formatOre(invoice.totals.vatOre) },
              { label: "Att betala", value: formatOre(invoice.totals.grossOre) },
            ],
          },
          ...(invoice.note ? [{ kind: "paragraph" as const, text: invoice.note }] : []),
        ],
      },
      {
        title: "Betalning",
        blocks: [
          {
            kind: "callout",
            tone: "warning",
            title: `Betala senast ${swedishDate(invoice.dueAt)}`,
            body:
              accounts.length > 0
                ? `Betala till ${accounts
                    .map((a) => `${a.label.toLowerCase()} ${a.number}`)
                    .join(" eller ")}. Ange fakturanummer ${invoice.invoiceNumber} som referens.`
                : `Ange fakturanummer ${invoice.invoiceNumber} som referens.`,
          },
          {
            kind: "list",
            items: [
              {
                text: `Dröjsmålsränta enligt räntelagen (1975:635) 6 § utgår efter förfallodagen.`,
              },
              {
                text: invoice.seller.hasFSkatt
                  ? "Godkänd för F-skatt."
                  : "Uppgift om F-skatt saknas.",
              },
            ],
          },
        ],
      },
    ],
    disclaimer:
      `Faktura utställd av ${invoice.seller.legalName}, org.nr ${invoice.seller.orgNumber}, ` +
      `med säte i ${invoice.seller.registeredOffice}. Frågor om fakturan lämnas via ` +
      `kontaktformuläret på webbplatsen.`,
  };
};

/**
 * Kvittot.
 *
 * Skapas när betalningen har registrerats och lagras i kundens inloggning.
 * Det är medvetet ett eget dokument och inte en stämpel på fakturan: kunden
 * behöver kunna visa vad som betalades, när, och mot vilken faktura - utan
 * att fakturans egna villkorstexter följer med in i bokföringen.
 */
export const buildReceiptDocument = (
  invoice: Invoice,
  payment: { paidAt: string; reference: string | null; receiptNumber: string },
): ReportModel => ({
  meta: {
    documentTitle: `Kvitto ${payment.receiptNumber}`,
    companyName: invoice.customer.name,
    orgNumber: invoice.customer.orgNumber,
    reference: payment.receiptNumber,
    generatedAt: payment.paidAt,
  },
  lead: [
    {
      kind: "callout",
      tone: "good",
      title: "Betalningen är registrerad",
      body:
        `${formatOre(invoice.totals.grossOre)} mottaget ${swedishDate(payment.paidAt)} ` +
        `avseende faktura ${invoice.invoiceNumber}.`,
    },
  ],
  sections: [
    {
      title: "Uppgifter",
      blocks: [
        {
          kind: "keyValues",
          items: [
            { label: "Kvittonummer", value: payment.receiptNumber },
            { label: "Avser faktura", value: invoice.invoiceNumber },
            { label: "Betalningsdatum", value: swedishDate(payment.paidAt) },
            ...(payment.reference
              ? [{ label: "Betalningsreferens", value: payment.reference }]
              : []),
          ],
        },
        {
          kind: "keyValues",
          items: [
            { label: "Belopp exkl. moms", value: formatOre(invoice.totals.netOre) },
            {
              label: `Varav moms ${Math.round(invoice.totals.vatRate * 100)} %`,
              value: formatOre(invoice.totals.vatOre),
            },
            { label: "Totalt betalt", value: formatOre(invoice.totals.grossOre) },
          ],
        },
      ],
    },
    {
      title: "Parter",
      blocks: [
        { kind: "keyValues", items: sellerBlock(invoice) },
        {
          kind: "keyValues",
          items: [
            { label: "Betalare", value: invoice.customer.name },
            ...(invoice.customer.orgNumber
              ? [{ label: "Organisationsnummer", value: invoice.customer.orgNumber }]
              : []),
          ],
        },
      ],
    },
  ],
  disclaimer:
    `Kvitto utställt av ${invoice.seller.legalName}, org.nr ${invoice.seller.orgNumber}. ` +
    `Handlingen visar mottagen betalning och ersätter inte fakturan som bokföringsunderlag.`,
});
