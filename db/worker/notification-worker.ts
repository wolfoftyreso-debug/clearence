/**
 * Aviseringsarbetaren. Körs i driftmiljön som cron:
 *
 *   node db/dist/notification-worker.cjs           var 5:e minut
 *
 * Arbetaren gör tre saker, i ordning:
 *
 *   1. Skickar verifieringskoder (kön till OVERIFIERADE nummer).
 *   2. Tar hand om aviseringskön: beslutar per rad, skickar, skjuter upp
 *      eller undertrycker med skäl.
 *
 * Beslutet fattas av decideDelivery() i src/lib/notifications/events.ts -
 * samma funktion som gränssnittet använder för att förklara vad som
 * kommer att hända. Två uppsättningar villkor hade gett två svar på
 * frågan "varför fick jag inget SMS", och den frågan ska ha ett svar.
 *
 * Tre regler, samma som e-postarbetarens:
 *  1. claim_notification_deliveries() är enda vägen in i kön - den låser
 *     med `for update skip locked`.
 *  2. Resultatet skrivs ALLTID tillbaka, även vid krasch. En rad utan
 *     resultat plockas om, och mottagaren får samma SMS två gånger.
 *  3. Innehållet kommer från src/lib/notifications/messages.ts, som
 *     testas. En arbetare med egna formuleringar vore en andra sanning
 *     om vad vi skriver till kunden.
 *
 * Miljövariabler:
 *   DATABASE_URL   postgres://app_worker:...@host/db - ALDRIG superanvändare
 *   SES_REGION     eu-north-1
 *   MAIL_FROM      avsändaradress
 */

import { Client } from "pg";
import { arbetarUrl, kravArbetarroll } from "./roll";
import { makeMailSender, resolveMailConfig, type MailSender } from "./mail";
import {
  decideDelivery,
  localHour,
  nextQuietEnd,
  REASON_TEXT,
  type Channel,
  type EventKind,
  type Level,
  type PlanId,
} from "../../src/lib/notifications/events";
import { buildMessage } from "../../src/lib/notifications/messages";
import { escHtml, trygLank } from "../../src/lib/notifications/mailHtml";
import { SMS_SECRET_PROVIDER, providerFromSecret, type SmsProvider } from "./sms";

const DATABASE_URL = process.env.DATABASE_URL;
const MAIL_FROM = process.env.MAIL_FROM;

// Prövas när jobbet körs, inte när filen läses: process.exit() vid import
// river en Vercel-instans mitt i en request. Samma resonemang som i
// email-worker.ts.
const kravMiljo = (): void => {
  if (!DATABASE_URL || !MAIL_FROM) {
    throw new Error("DATABASE_URL och MAIL_FROM måste vara satta.");
  }
};

// Mejltransporten (SES eller SMTP) väljs av MAIL_TRANSPORT, som i
// e-postarbetaren. Byggs en gång och återanvänds.
let mailSender: MailSender | null = null;
const getMailSender = async (): Promise<MailSender> => {
  if (!mailSender) mailSender = await makeMailSender(resolveMailConfig(process.env));
  return mailSender;
};

interface ClaimedRow {
  delivery_id: string;
  channel: Channel;
  user_id: string;
  kind: EventKind;
  severity: string;
  title: string;
  body: string;
  href: string;
  case_id: string | null;
  level: Level;
  email_enabled: boolean;
  sms_enabled: boolean;
  quiet_start_hour: number;
  quiet_end_hour: number;
  plan_id: PlanId;
  phone_e164: string | null;
  phone_verified: boolean;
}

/**
 * Leverantören hämtas en gång per körning, inte en gång per rad.
 *
 * Arbetaren vet inte VEM leverantören är - den frågar db/worker/sms om
 * den konfigurerade, och det är hela kontraktet.
 */
const loadSmsProvider = async (db: Client): Promise<SmsProvider> => {
  const { rows } = await db.query<{ secret: string }>(
    "select secret from public.integration_secrets where provider = $1",
    [SMS_SECRET_PROVIDER],
  );
  return providerFromSecret(rows[0]?.secret ?? null);
};

/** Adressen hämtas ur auth-tabellen; e-postkanalen har ingen egen adress. */
const emailFor = async (db: Client, userId: string): Promise<string | null> => {
  const { rows } = await db.query<{ email: string | null }>(
    "select email from auth.users where id = $1",
    [userId],
  );
  return rows[0]?.email ?? null;
};

const sendEmail = async (db: Client, row: ClaimedRow): Promise<void> => {
  const to = await emailFor(db, row.user_id);
  if (!to) throw new Error("Mottagaren saknar e-postadress.");
  const sender = await getMailSender();
  const href = trygLank(row.href);
  await sender({
    recipient: to,
    subject: `CLEARANCE: ${row.title}`,
    bodyText: `${row.body}\n\n${href}`,
    bodyHtml: `<p>${escHtml(row.body)}</p><p><a href="${escHtml(href)}">Öppna i CLEARANCE</a></p>`,
  });
};

const runVerificationQueue = async (db: Client, sms: SmsProvider): Promise<void> => {
  const { rows } = await db.query<{ id: string; recipient: string; body: string }>(
    "select id, recipient, body from public.claim_outbound_sms($1)",
    [20],
  );
  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await sms.send(row.recipient, row.body);
      await db.query("select public.mark_sms_sent($1)", [row.id]);
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db.query("select public.mark_sms_failed($1, $2)", [row.id, message.slice(0, 500)]);
      failed += 1;
      console.error(`verifiering ${row.id}: ${message}`);
    }
  }
  if (rows.length > 0) console.log(`verifieringskoder: ${sent} skickade, ${failed} misslyckade`);
};

const runNotificationQueue = async (db: Client, sms: SmsProvider): Promise<void> => {
  const { rows } = await db.query<ClaimedRow>(
    "select * from public.claim_notification_deliveries($1)",
    [50],
  );

  let sent = 0;
  let suppressed = 0;
  let deferred = 0;
  let failed = 0;
  const now = new Date();

  for (const row of rows) {
    const quiet = { startHour: row.quiet_start_hour, endHour: row.quiet_end_hour };
    const enabled: Channel[] = ["inapp"];
    if (row.email_enabled) enabled.push("email");
    if (row.sms_enabled) enabled.push("sms");

    const decision = decideDelivery({
      kind: row.kind,
      channel: row.channel,
      level: row.level,
      plan: row.plan_id,
      enabledChannels: enabled,
      quiet,
      hour: localHour(now),
      hasVerifiedPhone: row.phone_verified,
    });

    if (!decision.send) {
      // Tyst tid är det ENDA skälet som skjuter upp. Alla andra är
      // permanenta: en kanal som inte ingår i planen kommer inte att
      // börja ingå för att vi väntar en timme.
      if (decision.reason === "tyst-tid") {
        await db.query("select public.defer_notification($1, $2)", [
          row.delivery_id,
          nextQuietEnd(now, quiet).toISOString(),
        ]);
        deferred += 1;
      } else {
        await db.query("select public.mark_notification_suppressed($1, $2)", [
          row.delivery_id,
          REASON_TEXT[decision.reason ?? "kanal-avstangd"],
        ]);
        suppressed += 1;
      }
      continue;
    }

    try {
      if (row.channel === "email") {
        await sendEmail(db, row);
      } else if (row.channel === "sms") {
        if (!row.phone_e164) throw new Error("Numret saknas trots verifiering.");
        // Texten byggs här och inte i databasen: den ska komma från
        // samma modul som testerna läser.
        const message = buildMessage({ kind: row.kind, caseReference: null });
        await sms.send(row.phone_e164, message.sms);
      } else {
        // inapp skapas redan som levererad av enqueue_notification.
        await db.query("select public.mark_notification_sent($1)", [row.delivery_id]);
        continue;
      }
      await db.query("select public.mark_notification_sent($1)", [row.delivery_id]);
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db.query("select public.mark_notification_failed($1, $2)", [
        row.delivery_id,
        message.slice(0, 500),
      ]);
      failed += 1;
      console.error(`${row.delivery_id} (${row.channel}): ${message}`);
    }
  }

  console.log(
    `aviseringar: ${sent} skickade, ${deferred} uppskjutna, ${suppressed} undertryckta, ${failed} misslyckade`,
  );
};

/**
 * Ett varv genom verifierings- och aviseringskön. Exporterad så att
 * cron-endpointen kör samma kod som kommandot.
 */
export const korEttVarv = async (): Promise<void> => {
  kravMiljo();
  const db = new Client({ connectionString: arbetarUrl() });
  await db.connect();
  await kravArbetarroll(db);
  try {
    const sms = await loadSmsProvider(db);
    await runVerificationQueue(db, sms);
    await runNotificationQueue(db, sms);
  } finally {
    await db.end();
  }
};

// Körs bara som kommando - annars startar en import ett varv i kön.
if (/notification-worker/.test(process.argv[1] ?? "")) {
  korEttVarv().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
