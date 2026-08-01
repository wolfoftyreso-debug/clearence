/**
 * E-postarbetaren. Körs som cron eller systemd-timer i AWS-miljön, varje
 * minut eller var femte: den plockar väntande rader ur utkorgen, skickar via
 * SES och skriver tillbaka resultatet.
 *
 *   node db/email-worker.mjs            # skicka det som väntar
 *   node db/email-worker.mjs --close    # kör dessutom dygnsjobbet som
 *                                       # stänger förfallna konton
 *
 * Miljövariabler:
 *   DATABASE_URL   postgres://app_user:...@host/db  (ALDRIG en superanvändare)
 *   SES_REGION     eu-north-1
 *   MAIL_FROM      avsändaradressen, t.ex. faktura@<domän>
 *
 * Tre saker som inte är förhandlingsbara, och varför:
 *
 *  1. **claim_outbound_emails() är enda vägen in i kön.** Den låser raderna
 *     med `for update skip locked`, så två samtidiga arbetare skickar aldrig
 *     samma mejl. Läs aldrig tabellen direkt.
 *
 *  2. **Resultatet skrivs alltid tillbaka**, även när sändningen kraschar.
 *     En rad som varken märks sent eller failed plockas igen nästa varv, och
 *     kunden får samma faktura två gånger.
 *
 *  3. **Arbetaren komponerar ingenting.** Innehållet skrevs när raden
 *     köades, i samma transaktion som fakturan. Arbetaren är dum med flit:
 *     den flyttar färdiga mejl, det är allt.
 *
 * SES-klienten (@aws-sdk/client-ses) och pg installeras i driftmiljön, inte
 * i webbapplikationens beroenden - webbklienten ska inte bära en SDK för
 * e-post den aldrig får använda.
 */

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const { Client } = require("pg");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

const DATABASE_URL = process.env.DATABASE_URL;
const SES_REGION = process.env.SES_REGION ?? "eu-north-1";
const MAIL_FROM = process.env.MAIL_FROM;

if (!DATABASE_URL || !MAIL_FROM) {
  console.error("DATABASE_URL och MAIL_FROM måste vara satta.");
  process.exit(1);
}

const db = new Client({ connectionString: DATABASE_URL });
const ses = new SESClient({ region: SES_REGION });

await db.connect();

// Dygnsjobbet först när det begärts: stäng förfallna konton. Idempotent,
// rör aldrig ett betalt konto, raderar ingenting - se migrationen.
if (process.argv.includes("--close")) {
  const { rows } = await db.query("select public.close_overdue_accounts() as closed");
  console.log(`stängda konton: ${rows[0].closed}`);
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
    // Alltid tillbaka till databasen, aldrig bara till loggen. Raden blir
    // failed vid femte försöket och syns då i driftvyn.
    const message = error instanceof Error ? error.message : String(error);
    await db.query("select public.mark_email_failed($1, $2)", [row.id, message.slice(0, 500)]);
    failed += 1;
    console.error(`${row.id} -> ${row.recipient}: ${message}`);
  }
}

console.log(`skickade: ${sent}, misslyckade: ${failed}, kvar i kön syns i driftvyn`);
await db.end();
