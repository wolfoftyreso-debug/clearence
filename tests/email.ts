/**
 * Tester för utgående e-post.
 *
 * Ett mejl går inte att ta tillbaka. Det som testas här är därför inte att
 * funktionen returnerar något, utan att den returnerar rätt sak: att beloppen
 * stämmer, att kontonumret står med, att inget externt hämtas, och att löftet
 * om att inget raderas faktiskt står i texten.
 */

import {
  accountClosedEmail,
  caseInvitationEmail,
  invoiceEmail,
  paymentReminderEmail,
  receiptEmail,
} from "../src/lib/email/messages";
import { COMPANY, type CompanyIdentity } from "../src/lib/company";
import type { Invoice } from "../src/lib/invoice";

let passed = 0;
let failed = 0;

const check = (name: string, actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${name}\n     fick      ${JSON.stringify(actual)}\n     förväntat ${JSON.stringify(expected)}`);
  }
};

const seller: CompanyIdentity = { ...COMPANY };

const invoice: Invoice = {
  invoiceNumber: "2026-0007",
  issuedAt: "2026-08-02T09:00:00.000Z",
  dueAt: "2026-08-12T09:00:00.000Z",
  seller,
  customer: {
    name: "Exempelbolaget AB",
    orgNumber: "556012-3456",
    email: "ekonomi@exempelbolaget.se",
    address: null,
  },
  lines: [{ description: "Integration Fortnox", quantity: 1, unitPriceOre: 200000 }],
  note: null,
  totals: { netOre: 200000, vatOre: 50000, grossOre: 250000, vatRate: 0.25 },
};

/* -------------------------------------------------------------------------- */
/* Fakturamejlet                                                              */
/* -------------------------------------------------------------------------- */

const inv = invoiceEmail(invoice);

check("går till kundens adress", inv.recipient, "ekonomi@exempelbolaget.se");
check("fakturanumret står i ämnesraden", inv.subject.includes("2026-0007"), true);
check("sorteras som faktura", inv.kind, "invoice");

// Alla tre beloppen måste stå i ren text. En mottagare som blockerar HTML ska
// kunna bokföra fakturan ändå.
check("netto i ren text", inv.bodyText.includes("2 000,00 kr"), true);
check("moms i ren text", inv.bodyText.includes("500,00 kr"), true);
check("att betala i ren text", inv.bodyText.includes("2 500,00 kr"), true);
check("momssatsen anges", inv.bodyText.includes("Moms 25 %"), true);
check("förfallodagen i ren text", inv.bodyText.includes("12 augusti 2026"), true);
check("referens att ange", inv.bodyText.includes("Ange 2026-0007 som referens"), true);

// Plusgirot finns; bankgirot är tomt och ska då inte skrivas ut alls.
check("plusgirot står med", inv.bodyText.includes(COMPANY.plusgiro), true);
check("inget tomt bankgiro", /Bankgiro:\s*$/m.test(inv.bodyText), false);

check("säljarens orgnr står med", inv.bodyText.includes(COMPANY.orgNumber), true);

// Inga externa anrop, ingen spårning. Samma gräns som resten av produkten.
check("ingen extern resurs i html", /https?:\/\//.test(inv.bodyHtml), false);
check("ingen bild i html", inv.bodyHtml.includes("<img"), false);
check("inget skript i html", inv.bodyHtml.includes("<script"), false);

// Fälten kommer från kunden och måste escapas.
const nasty = invoiceEmail({
  ...invoice,
  customer: { ...invoice.customer, name: 'Bolaget "A" & <B>' },
});
check("kundnamn escapas i html", nasty.bodyHtml.includes("&amp;"), true);
check("ingen rå vinkelparentes från kunddata", nasty.bodyHtml.includes("<B>"), false);
check("ren text lämnas orörd", nasty.bodyText.includes('Bolaget "A" & <B>'), true);

/* -------------------------------------------------------------------------- */
/* Kvittot                                                                    */
/* -------------------------------------------------------------------------- */

const rec = receiptEmail(invoice, { paidAt: "2026-08-10T14:00:00.000Z", receiptNumber: "K-2026-0007" });

check("kvittonumret i ämnesraden", rec.subject.includes("K-2026-0007"), true);
check("kvittot sorteras rätt", rec.kind, "receipt");
check("kvittot anger totalen", rec.bodyText.includes("2 500,00 kr"), true);
check("kvittot särredovisar moms", rec.bodyText.includes("varav moms 500,00 kr"), true);
check("kvittot pekar på fakturan", rec.bodyText.includes("2026-0007"), true);
check("kvittot anger betalningsdagen", rec.bodyText.includes("10 augusti 2026"), true);

/* -------------------------------------------------------------------------- */
/* Påminnelsen                                                                */
/* -------------------------------------------------------------------------- */

const remind = (daysLeft: number) =>
  paymentReminderEmail({
    recipient: "ekonomi@exempelbolaget.se",
    customerName: "Exempelbolaget AB",
    invoiceNumber: "2026-0007",
    dueAt: "2026-08-12T09:00:00.000Z",
    grossOre: 250000,
    daysLeft,
  });

check("noll dagar heter idag", remind(0).subject.includes("förfaller idag"), true);
check("en dag heter imorgon", remind(1).subject.includes("förfaller imorgon"), true);
check("tre dagar räknas ut", remind(3).subject.includes("om 3 dagar"), true);

// Det viktigaste i påminnelsen: att inget raderas. Utan den meningen läser
// mottagaren avstängningen som att materialet är borta.
const reminderBody = remind(2).bodyText;
check("påminnelsen säger att inget raderas", reminderBody.includes("inte att något raderas"), true);
check("påminnelsen säger hur man får tillbaka det", reminderBody.includes("blir\ntillgängligt igen"), true);
check("påminnelsen anger beloppet", reminderBody.includes("2 500,00 kr"), true);
check("påminnelsen anger kontot", reminderBody.includes(COMPANY.plusgiro), true);

/* -------------------------------------------------------------------------- */
/* Stängningen                                                                */
/* -------------------------------------------------------------------------- */

const closed = accountClosedEmail({
  recipient: "ekonomi@exempelbolaget.se",
  customerName: "Exempelbolaget AB",
  invoiceNumber: "2026-0007",
});

check("ämnesraden lovar att inget är raderat", closed.subject.includes("inget är raderat"), true);
check("texten upprepar löftet", closed.bodyText.includes("Ingenting är raderat"), true);
check("texten namnger vad som finns kvar", closed.bodyText.includes("likviditetsplan"), true);
check("texten säger hur kontot öppnas", closed.bodyText.includes("betalningen är"), true);

/* -------------------------------------------------------------------------- */
/* Ingen tom platshållare                                                     */
/* -------------------------------------------------------------------------- */

// Alla fyra mejlen ska klara ett bolag utan betalkonton alls, utan att lämna
// en rad som säger "Betala till:" och sedan ingenting.
const noAccounts = { ...seller, plusgiro: "", bankgiro: "" };
const originalPlusgiro = COMPANY.plusgiro;
const originalBankgiro = COMPANY.bankgiro;
(COMPANY as { plusgiro: string }).plusgiro = noAccounts.plusgiro;
(COMPANY as { bankgiro: string }).bankgiro = noAccounts.bankgiro;

const bare = invoiceEmail(invoice);
check("ingen hängande rubrik utan konton", bare.bodyText.includes("Betala till:"), false);
check("referensen står kvar ändå", bare.bodyText.includes("Ange 2026-0007 som referens"), true);

(COMPANY as { plusgiro: string }).plusgiro = originalPlusgiro;
(COMPANY as { bankgiro: string }).bankgiro = originalBankgiro;

/* --- inbjudan till ärendet ------------------------------------------------ */

const invitation = caseInvitationEmail({
  recipient: "styrelse@bolaget.se",
  inviterName: "Anna Andersson",
  companyName: "Bolag & Söner AB",
  roleLabel: "Styrelseledamot",
  roleDescription: "Ser hela ärendet, ändrar ingenting.",
  acceptUrl: "https://clearance.se/inbjudan/abc-123",
  expiresAt: "2026-09-01T00:00:00.000Z",
});

check("inbjudans ämne bär bolagsnamnet",
  invitation.subject, "Inbjudan till ärendet för Bolag & Söner AB");
check("inbjudans kind", invitation.kind, "case_invitation");
check("länken står i ren text", invitation.bodyText.includes("https://clearance.se/inbjudan/abc-123"), true);
check("adressbindningen förklaras",
  invitation.bodyText.includes("fungerar bara tillsammans med ett konto"), true);
check("mottagaradressen namnges i texten",
  invitation.bodyText.includes("styrelse@bolaget.se"), true);
check("rollens innebörd står med",
  invitation.bodyText.includes("Ser hela ärendet, ändrar ingenting."), true);
check("sista giltighetsdag i klartext", invitation.bodyText.includes("1 september 2026"), true);
check("lugnande rad för fel mottagare",
  invitation.bodyText.includes("kan du bortse från det här mejlet"), true);
check("bolagsnamnets &-tecken escapas i HTML",
  invitation.bodyHtml.includes("Bolag &amp; Söner AB"), true);
check("HTML-varianten saknar spårning och bilder",
  /<img|http[^"']*\.(png|gif|jpg)/i.test(invitation.bodyHtml), false);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
