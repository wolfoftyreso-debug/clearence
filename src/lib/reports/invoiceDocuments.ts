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
import { formatOre, lineTotalOre } from "../invoice";
import { formatAddress, paymentAccounts } from "../company";
import type { ReportModel, TableRow } from "./types";

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
export const buildInvoiceDocument = (invoice: Invoice): ReportModel => {
  const accounts = paymentAccounts(invoice.seller);
  const vatPercent = `${Math.round(invoice.totals.vatRate * 100)} %`;

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
