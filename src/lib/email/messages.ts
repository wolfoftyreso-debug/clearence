/**
 * Vad som faktiskt står i mejlen.
 *
 * Rena funktioner: ett mejl är något som lämnar huset och inte går att ta
 * tillbaka, så innehållet ska gå att läsa i ett test i stället för att
 * kontrolleras genom att skicka ett.
 *
 * Tre regler som styr utformningen:
 *
 *  1. **Allt väsentligt står i ren text.** HTML-varianten är en bonus. En
 *     ekonomifunktion som blockerar HTML ska ändå se belopp, förfallodag och
 *     kontonummer.
 *  2. **Inga bilder, inga externa anrop, ingen spårpixel.** Samma gräns som
 *     resten av produkten. Ett spårat mejl till ett bolag i kris är precis
 *     den sortens uppgift som inte ska lämna vår server.
 *  3. **Ingen länk är nödvändig för att betala.** Kontonummer och belopp står
 *     i texten. Ett mejl om pengar som kräver att man klickar sig vidare ser
 *     ut som bedrägeri, och en ekonomiassistent som blivit lärd att inte
 *     klicka gör helt rätt i att inte göra det.
 */

import { COMPANY, formatAddress, paymentAccounts } from "../company";
import { formatOre, type Invoice } from "../invoice";

export interface EmailMessage {
  recipient: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  /** Vad mejlet gäller. Lagras med raden så en rad går att spåra. */
  kind: "invoice" | "receipt" | "payment_reminder" | "account_closed" | "case_invitation";
}

const swedishDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });
};

/**
 * Escapar text som ska in i HTML-varianten.
 *
 * Fälten kommer från kunden - ett bolagsnamn med ett &-tecken eller en
 * beskrivning någon klistrat in. Utan det här blir mejlet trasigt i bästa
 * fall och en injektionsyta i värsta.
 */
const esc = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Avsändaren, som den ska stå i varje mejl. */
const signature = (): string =>
  [
    COMPANY.legalName,
    `Org.nr ${COMPANY.orgNumber}`,
    COMPANY.vatNumber ? `Momsreg.nr ${COMPANY.vatNumber}` : null,
    formatAddress(),
  ]
    .filter(Boolean)
    .join("\n");

const accountLines = (): string[] =>
  paymentAccounts().map((a) => `${a.label}: ${a.number}`);

/** Enkel inramning. Inga typsnitt, ingen CSS som hämtas någon annanstans. */
const wrapHtml = (title: string, blocks: string[]): string =>
  [
    `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;`,
    `line-height:1.6;color:#15191e;max-width:600px">`,
    `<h1 style="font-size:20px;margin:0 0 16px">${esc(title)}</h1>`,
    ...blocks,
    `<hr style="border:none;border-top:1px solid #e4e2dd;margin:24px 0">`,
    `<p style="font-size:12px;color:#5b6470;white-space:pre-line">${esc(signature())}</p>`,
    `</div>`,
  ].join("");

const p = (text: string): string =>
  `<p style="margin:0 0 12px">${esc(text)}</p>`;

/* -------------------------------------------------------------------------- */
/* Fakturan                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Momsfakturan till kundens e-post.
 *
 * Beloppen är specificerade netto, moms och att betala. En faktura som bara
 * anger totalen går inte att bokföra hos mottagaren.
 */
export const invoiceEmail = (invoice: Invoice): EmailMessage => {
  const vatPercent = `${Math.round(invoice.totals.vatRate * 100)} %`;
  const accounts = accountLines();

  const lines = [
    `Hej ${invoice.customer.name},`,
    ``,
    `Här kommer faktura ${invoice.invoiceNumber} från ${COMPANY.legalName}.`,
    ``,
    `Avser:        ${invoice.lines.map((l) => l.description).join(", ")}`,
    `Fakturadatum: ${swedishDate(invoice.issuedAt)}`,
    `Förfallodag:  ${swedishDate(invoice.dueAt)}`,
    ``,
    `Belopp exkl. moms: ${formatOre(invoice.totals.netOre)}`,
    `Moms ${vatPercent}:${" ".repeat(Math.max(1, 13 - vatPercent.length))}${formatOre(invoice.totals.vatOre)}`,
    `Att betala:        ${formatOre(invoice.totals.grossOre)}`,
    ``,
    ...(accounts.length > 0
      ? [`Betala till:`, ...accounts.map((a) => `  ${a}`), ``]
      : []),
    `Ange ${invoice.invoiceNumber} som referens.`,
    ``,
    `Fakturan finns också under Inställningar när du är inloggad, tillsammans`,
    `med kvittot när betalningen är registrerad.`,
    ``,
    signature(),
  ];

  return {
    recipient: invoice.customer.email,
    subject: `Faktura ${invoice.invoiceNumber} från ${COMPANY.legalName}`,
    kind: "invoice",
    bodyText: lines.join("\n"),
    bodyHtml: wrapHtml(`Faktura ${invoice.invoiceNumber}`, [
      p(`Hej ${invoice.customer.name},`),
      p(`Här kommer faktura ${invoice.invoiceNumber} från ${COMPANY.legalName}.`),
      `<table style="border-collapse:collapse;margin:0 0 16px;font-size:14px">`,
      `<tr><td style="padding:4px 16px 4px 0;color:#5b6470">Avser</td>`,
      `<td style="padding:4px 0">${esc(invoice.lines.map((l) => l.description).join(", "))}</td></tr>`,
      `<tr><td style="padding:4px 16px 4px 0;color:#5b6470">Förfallodag</td>`,
      `<td style="padding:4px 0"><strong>${esc(swedishDate(invoice.dueAt))}</strong></td></tr>`,
      `<tr><td style="padding:4px 16px 4px 0;color:#5b6470">Exkl. moms</td>`,
      `<td style="padding:4px 0">${esc(formatOre(invoice.totals.netOre))}</td></tr>`,
      `<tr><td style="padding:4px 16px 4px 0;color:#5b6470">Moms ${esc(vatPercent)}</td>`,
      `<td style="padding:4px 0">${esc(formatOre(invoice.totals.vatOre))}</td></tr>`,
      `<tr><td style="padding:4px 16px 4px 0;color:#5b6470">Att betala</td>`,
      `<td style="padding:4px 0"><strong>${esc(formatOre(invoice.totals.grossOre))}</strong></td></tr>`,
      `</table>`,
      ...(accounts.length > 0
        ? [p(`Betala till ${accounts.join(" eller ")}. Ange ${invoice.invoiceNumber} som referens.`)]
        : [p(`Ange ${invoice.invoiceNumber} som referens.`)]),
      p("Fakturan finns också under Inställningar när du är inloggad."),
    ]),
  };
};

/* -------------------------------------------------------------------------- */
/* Kvittot                                                                    */
/* -------------------------------------------------------------------------- */

export const receiptEmail = (
  invoice: Invoice,
  payment: { paidAt: string; receiptNumber: string },
): EmailMessage => {
  const lines = [
    `Hej ${invoice.customer.name},`,
    ``,
    `Vi har tagit emot din betalning. Tack.`,
    ``,
    `Kvitto:       ${payment.receiptNumber}`,
    `Avser faktura ${invoice.invoiceNumber}`,
    `Betalt:       ${swedishDate(payment.paidAt)}`,
    `Belopp:       ${formatOre(invoice.totals.grossOre)} varav moms ${formatOre(invoice.totals.vatOre)}`,
    ``,
    `Kvittot ligger kvar under Inställningar i din inloggning.`,
    ``,
    signature(),
  ];

  return {
    recipient: invoice.customer.email,
    subject: `Kvitto ${payment.receiptNumber} – betalning mottagen`,
    kind: "receipt",
    bodyText: lines.join("\n"),
    bodyHtml: wrapHtml(`Kvitto ${payment.receiptNumber}`, [
      p(`Hej ${invoice.customer.name},`),
      p("Vi har tagit emot din betalning. Tack."),
      p(
        `${formatOre(invoice.totals.grossOre)} mottaget ${swedishDate(payment.paidAt)} ` +
          `avseende faktura ${invoice.invoiceNumber}, varav moms ${formatOre(invoice.totals.vatOre)}.`,
      ),
      p("Kvittot ligger kvar under Inställningar i din inloggning."),
    ]),
  };
};

/* -------------------------------------------------------------------------- */
/* Påminnelsen                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Skickas innan kontot stängs.
 *
 * Tonen är avsiktligt saklig. Mottagaren är ofta ett bolag som redan har det
 * svårt, och ett hotfullt kravbrev från oss är varken hjälpsamt eller
 * effektivt. Det som får någon att betala är att veta exakt vad, vart och
 * när - och att veta att inget försvinner om de är sena.
 */
export const paymentReminderEmail = (input: {
  recipient: string;
  customerName: string;
  invoiceNumber: string;
  dueAt: string;
  grossOre: number;
  daysLeft: number;
}): EmailMessage => {
  const accounts = accountLines();
  const when =
    input.daysLeft === 0
      ? "idag"
      : input.daysLeft === 1
        ? "imorgon"
        : `om ${input.daysLeft} dagar`;

  const lines = [
    `Hej ${input.customerName},`,
    ``,
    `Faktura ${input.invoiceNumber} på ${formatOre(input.grossOre)} förfaller ${when},`,
    `den ${swedishDate(input.dueAt)}.`,
    ``,
    ...(accounts.length > 0 ? [`Betala till:`, ...accounts.map((a) => `  ${a}`), ``] : []),
    `Ange ${input.invoiceNumber} som referens.`,
    ``,
    `Kommer ingen betalning in stängs kontot. Det betyder att du inte kommer åt`,
    `tjänsten – inte att något raderas. Allt du lagt in ligger kvar och blir`,
    `tillgängligt igen så snart betalningen är registrerad.`,
    ``,
    `Har du frågor om fakturan, svara på det här mejlet.`,
    ``,
    signature(),
  ];

  return {
    recipient: input.recipient,
    subject: `Påminnelse: faktura ${input.invoiceNumber} förfaller ${when}`,
    kind: "payment_reminder",
    bodyText: lines.join("\n"),
    bodyHtml: wrapHtml(`Faktura ${input.invoiceNumber} förfaller ${when}`, [
      p(`Hej ${input.customerName},`),
      p(
        `Faktura ${input.invoiceNumber} på ${formatOre(input.grossOre)} förfaller ` +
          `${swedishDate(input.dueAt)}.`,
      ),
      ...(accounts.length > 0
        ? [p(`Betala till ${accounts.join(" eller ")}. Ange ${input.invoiceNumber} som referens.`)]
        : []),
      p(
        "Kommer ingen betalning in stängs kontot. Det betyder att du inte kommer åt " +
          "tjänsten – inte att något raderas. Allt ligger kvar och blir tillgängligt " +
          "igen så snart betalningen är registrerad.",
      ),
    ]),
  };
};

/* -------------------------------------------------------------------------- */
/* Stängningen                                                                */
/* -------------------------------------------------------------------------- */

export const accountClosedEmail = (input: {
  recipient: string;
  customerName: string;
  invoiceNumber: string | null;
}): EmailMessage => {
  const accounts = accountLines();
  const lines = [
    `Hej ${input.customerName},`,
    ``,
    `Vi har inte fått in betalningen, så kontot är nu stängt.`,
    ``,
    `Ingenting är raderat. Din utvärdering, din likviditetsplan och dina`,
    `handlingar ligger kvar och blir tillgängliga igen så snart betalningen är`,
    `registrerad.`,
    ``,
    ...(input.invoiceNumber ? [`Det gäller faktura ${input.invoiceNumber}.`, ``] : []),
    ...(accounts.length > 0 ? [`Betala till:`, ...accounts.map((a) => `  ${a}`), ``] : []),
    `Stämmer inte det här, svara på det här mejlet så reder vi ut det.`,
    ``,
    signature(),
  ];

  return {
    recipient: input.recipient,
    subject: "Ditt konto är stängt – inget är raderat",
    kind: "account_closed",
    bodyText: lines.join("\n"),
    bodyHtml: wrapHtml("Ditt konto är stängt", [
      p(`Hej ${input.customerName},`),
      p("Vi har inte fått in betalningen, så kontot är nu stängt."),
      p(
        "Ingenting är raderat. Din utvärdering, din likviditetsplan och dina handlingar " +
          "ligger kvar och blir tillgängliga igen så snart betalningen är registrerad.",
      ),
      ...(accounts.length > 0 ? [p(`Betala till ${accounts.join(" eller ")}.`)] : []),
    ]),
  };
};

/* -------------------------------------------------------------------------- */
/* Inbjudan till ärendet                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Inbjudningsmejlet.
 *
 * Det viktigaste i texten är säkerhetsmodellen, uttryckt så att en icke-
 * tekniker förstår den: länken fungerar bara tillsammans med ett konto på
 * EXAKT den här adressen. Utan den meningen vidarebefordras länken "till
 * rätt person" och slutar i ett obegripligt fel.
 *
 * Bolagsnamn och inbjudarens namn kommer från användare - de escapas i
 * HTML-varianten som allt annat.
 */
export const caseInvitationEmail = (input: {
  recipient: string;
  inviterName: string;
  companyName: string;
  roleLabel: string;
  roleDescription: string;
  acceptUrl: string;
  expiresAt: string;
}): EmailMessage => {
  const lines = [
    `Hej,`,
    ``,
    `${input.inviterName} har bjudit in dig till ärendet för ${input.companyName}`,
    `på Clearance, som ${input.roleLabel.toLowerCase()}.`,
    ``,
    `Rollen innebär: ${input.roleDescription}`,
    ``,
    `Så här tackar du ja:`,
    ``,
    `  ${input.acceptUrl}`,
    ``,
    `Länken fungerar bara tillsammans med ett konto på just den här`,
    `e-postadressen (${input.recipient}). Har du inget konto skapar du ett`,
    `med samma adress först - att skicka länken vidare till någon annan ger`,
    `alltså ingen åtkomst.`,
    ``,
    `Inbjudan gäller till ${swedishDate(input.expiresAt)}. Känner du inte igen`,
    `avsändaren kan du bortse från det här mejlet - ingenting händer om du`,
    `inte klickar.`,
    ``,
    signature(),
  ];

  return {
    recipient: input.recipient,
    subject: `Inbjudan till ärendet för ${input.companyName}`,
    kind: "case_invitation",
    bodyText: lines.join("\n"),
    bodyHtml: wrapHtml(`Inbjudan till ärendet för ${input.companyName}`, [
      p(
        `${input.inviterName} har bjudit in dig till ärendet för ` +
          `${input.companyName} på Clearance, som ${input.roleLabel.toLowerCase()}.`,
      ),
      p(`Rollen innebär: ${input.roleDescription}`),
      `<p style="margin:0 0 12px"><a href="${esc(input.acceptUrl)}">Tacka ja till inbjudan</a></p>`,
      p(
        `Länken fungerar bara tillsammans med ett konto på just den här ` +
          `e-postadressen (${input.recipient}). Har du inget konto skapar du ett ` +
          `med samma adress först.`,
      ),
      p(
        `Inbjudan gäller till ${swedishDate(input.expiresAt)}. Känner du inte igen ` +
          `avsändaren kan du bortse från det här mejlet.`,
      ),
    ]),
  };
};
