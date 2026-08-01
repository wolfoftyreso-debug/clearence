/**
 * E-postarbetaren. Körs i driftmiljön som cron:
 *
 *   node db/dist/email-worker.cjs            var 5:e minut: skicka kön
 *   node db/dist/email-worker.cjs --remind   per timme: köa påminnelser
 *   node db/dist/email-worker.cjs --close    per dygn: stäng + köa besked
 *
 * Byggs med `npm run build:worker` - källan är TypeScript just för att
 * mejlens innehåll ska komma från src/lib/email/messages.ts, samma byggare
 * som testas i tests/email.ts. En arbetare med egna formuleringar hade varit
 * en andra sanning om vad vi lovar kunden.
 *
 * Miljövariabler:
 *   DATABASE_URL   postgres://app_worker:...@host/db - ALDRIG en superanvändare
 *   SES_REGION     eu-north-1
 *   MAIL_FROM      avsändaradress, t.ex. faktura@<domän>
 *
 * Tre regler:
 *  1. claim_outbound_emails() är enda vägen in i kön - den låser med
 *     `for update skip locked`, så två arbetare aldrig skickar samma rad.
 *  2. Resultatet skrivs alltid tillbaka, även vid krasch. En rad utan
 *     resultat plockas om, och kunden får samma faktura två gånger.
 *  3. Dubblettskyddet för påminnelser bor i databasen
 *     (reminder_candidates), inte här. Arbetaren ska gå att köra hur ofta
 *     som helst utan att tjata.
 */

import { Client } from "pg";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import {
  accountClosedEmail,
  paymentReminderEmail,
  type EmailMessage,
} from "../../src/lib/email/messages";

const DATABASE_URL = process.env.DATABASE_URL;
const SES_REGION = process.env.SES_REGION ?? "eu-north-1";
const MAIL_FROM = process.env.MAIL_FROM;

if (!DATABASE_URL || !MAIL_FROM) {
  console.error("DATABASE_URL och MAIL_FROM måste vara satta.");
  process.exit(1);
}

const db = new Client({ connectionString: DATABASE_URL });
const ses = new SESClient({ region: SES_REGION });

const enqueue = async (
  message: EmailMessage,
  related: { userId: string | null; invoiceId: string | null },
) => {
  await db.query(
    `insert into public.outbound_emails
       (recipient, subject, body_text, body_html, kind, related_user_id, related_invoice_id)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      message.recipient,
      message.subject,
      message.bodyText,
      message.bodyHtml,
      message.kind,
      related.userId,
      related.invoiceId,
    ],
  );
};

const main = async () => {
  await db.connect();

  if (process.argv.includes("--close")) {
    const { rows } = await db.query(
      "select user_id, email, display_name, invoice_number from public.close_overdue_accounts()",
    );
    for (const row of rows) {
      await enqueue(
        accountClosedEmail({
          recipient: row.email,
          customerName: row.display_name ?? row.email,
          invoiceNumber: row.invoice_number,
        }),
        { userId: row.user_id, invoiceId: null },
      );
    }
    console.log(`stängda konton: ${rows.length}, besked köade: ${rows.length}`);
  }

  if (process.argv.includes("--remind")) {
    const { rows } = await db.query(
      `select user_id, email, display_name, invoice_id, invoice_number, gross_ore, due_at, days_left
       from public.reminder_candidates()`,
    );
    for (const row of rows) {
      // Utan faktura finns inget belopp att påminna om - då gäller
      // gratisperiodens slut, och det beskedet bär fakturan när den ställs
      // ut. Kandidater utan faktura hoppas därför över här.
      if (!row.invoice_number) continue;
      await enqueue(
        paymentReminderEmail({
          recipient: row.email,
          customerName: row.display_name ?? row.email,
          invoiceNumber: row.invoice_number,
          dueAt: row.due_at.toISOString(),
          grossOre: Number(row.gross_ore),
          daysLeft: Number(row.days_left),
        }),
        { userId: row.user_id, invoiceId: row.invoice_id },
      );
    }
    console.log(`påminnelser köade: ${rows.filter((r) => r.invoice_number).length}`);
  }

  const { rows: batch } = await db.query(
    "select id, recipient, subject, body_text, body_html from public.claim_outbound_emails($1)",
    [20],
  );

  let sent = 0;
  let failed = 0;

  for (const row of batch) {
    try {
      await ses.send(
        new SendEmailCommand({
          Source: MAIL_FROM,
          Destination: { ToAddresses: [row.recipient] },
          Message: {
            Subject: { Data: row.subject, Charset: "UTF-8" },
            Body: {
              Text: { Data: row.body_text, Charset: "UTF-8" },
              Html: { Data: row.body_html, Charset: "UTF-8" },
            },
          },
        }),
      );
      await db.query("select public.mark_email_sent($1)", [row.id]);
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db.query("select public.mark_email_failed($1, $2)", [row.id, message.slice(0, 500)]);
      failed += 1;
      console.error(`${row.id} -> ${row.recipient}: ${message}`);
    }
  }

  console.log(`skickade: ${sent}, misslyckade: ${failed}`);
  await db.end();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
