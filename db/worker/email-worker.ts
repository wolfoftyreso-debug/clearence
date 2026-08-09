/**
 * E-postarbetaren. Körs i driftmiljön som cron:
 *
 *   node db/dist/email-worker.cjs            var 5:e minut: skicka kön
 *   node db/dist/email-worker.cjs --remind   per timme: köa påminnelser
 *   node db/dist/email-worker.cjs --close    per dygn: stäng + köa besked
 *   node db/dist/email-worker.cjs --credit   per dygn: kreditbevakning
 *   node db/dist/email-worker.cjs --gallra   per dygn: gallring (skuggläge)
 *   node db/dist/email-worker.cjs --invoice-referrals   1:a varje månad
 *   node db/dist/email-worker.cjs --invoice-usage       1:a varje månad
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
import { makeMailSender, resolveMailConfig } from "./mail";
import {
  accountClosedEmail,
  caseInvitationEmail,
  invoiceEmail,
  paymentReminderEmail,
  type EmailMessage,
} from "../../src/lib/email/messages";
import { COMPANY, missingInvoiceFields } from "../../src/lib/company";
import {
  DEFAULT_RETENTION,
  mergeRetentionPolicy,
  retentionSummary,
  type RetentionOverride,
} from "../../src/lib/retention";
import {
  CASE_ROLE_DESCRIPTIONS,
  CASE_ROLE_LABELS,
  type CaseRole,
} from "../../src/lib/caseRoles";

const DATABASE_URL = process.env.DATABASE_URL;
const MAIL_FROM = process.env.MAIL_FROM;
/** Bas för länkar i mejl, t.ex. inbjudans acceptlänk. */
const APP_BASE_URL = (process.env.APP_BASE_URL ?? "https://clearance.se").replace(/\/$/, "");

if (!DATABASE_URL || !MAIL_FROM) {
  console.error("DATABASE_URL och MAIL_FROM måste vara satta.");
  process.exit(1);
}

const db = new Client({ connectionString: DATABASE_URL });
// Transporten (SES eller SMTP) väljs av MAIL_TRANSPORT. Se db/worker/mail.ts.
const mailConfig = resolveMailConfig(process.env);

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

/**
 * Kreditbevakningen: hämtar dagens kandidater, slår mot Creditsafe och
 * skriver resultatet till credit_monitoring. Körs som eget läge - inga mejl
 * skickas härifrån.
 *
 * Två regler ärvda från databasen:
 *  - Dubblettskyddet bor i credit_check_candidates(): bolag kontrollerade
 *    det senaste dygnet kommer inte med. Läget går att köra hur ofta som
 *    helst utan att elda upplysningar i onödan - varje slagning kostar.
 *  - Nyckeln läses ur integration_secrets med arbetarens databasroll.
 *    Saknas nyckel loggas det och läget avslutas lugnt: att panelen inte
 *    fått en nyckel än är ett normalläge, inte ett fel.
 */
const runCreditChecks = async (): Promise<void> => {
  const { rows: keyRows } = await db.query(
    "select secret from public.integration_secrets where provider = 'creditsafe'",
  );
  if (keyRows.length === 0) {
    console.log("kreditbevakning: ingen Creditsafe-nyckel sparad i driftpanelen, hoppar över.");
    return;
  }
  const apiKey: string = keyRows[0].secret;

  const { rows: candidates } = await db.query(
    "select case_id, org_number from public.credit_check_candidates()",
  );
  if (candidates.length === 0) {
    console.log("kreditbevakning: alla bolag kontrollerade det senaste dygnet.");
    return;
  }

  let checked = 0;
  let failedChecks = 0;
  for (const candidate of candidates) {
    try {
      // ANTAGANDE: Connect-API:ets svarsform (rating/score/creditLimit) är
      // modellerad efter dokumentationen, inte verifierad mot ett riktigt
      // konto - avtalet med Creditsafe är inte tecknat än. Fältet raw sparar
      // hela svaret, så det vi inte modellerat rätt går att läsa ut i
      // efterhand utan ny slagning.
      const response = await fetch(
        `https://connect.creditsafe.com/v1/companies/SE/${encodeURIComponent(candidate.org_number)}/creditreport`,
        { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" } },
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const report = (await response.json()) as {
        rating?: { value?: string };
        score?: number;
        creditLimit?: { value?: number };
      };
      await db.query(
        `insert into public.credit_monitoring
           (case_id, org_number, provider, rating, score, credit_limit_sek, raw)
         values ($1, $2, 'creditsafe', $3, $4, $5, $6)`,
        [
          candidate.case_id,
          candidate.org_number,
          report.rating?.value ?? null,
          typeof report.score === "number" ? report.score : null,
          typeof report.creditLimit?.value === "number" ? Math.round(report.creditLimit.value) : null,
          JSON.stringify(report),
        ],
      );
      checked += 1;
    } catch (error) {
      // Ett misslyckat bolag stoppar inte de övriga; det förblir kandidat
      // och plockas upp igen vid nästa körning.
      const message = error instanceof Error ? error.message : String(error);
      console.error(`kreditbevakning ${candidate.org_number}: ${message}`);
      failedChecks += 1;
    }
  }
  console.log(`kreditbevakning: kontrollerade ${checked}, misslyckade ${failedChecks}`);
};

/**
 * GALLRINGEN (GDPR art. 5.1 e). Körs t.ex. dagligen.
 *
 * Policyn - en tid och en åtgärd per kategori - bor i src/lib/retention.ts
 * (samma byggare som testas), och drift kan lägga en override i app_settings
 * (nyckeln retention_policy). Här läses den, slås ihop, och en plan loggas.
 *
 * SKUGGLÄGE ÄR MEDVETET. Precis som skuggdebiteringen registreras vad som
 * SKULLE gallras utan att något raderas, tills en människa slår på en
 * kategori (aktiv=true). Den skarpa, destruktiva gallringen per kategori
 * kopplas in när respektive DB-funktion är skriven och prövad i
 * db/tests-sviten - att radera fel, eller det spårbarheten kräver, är värre
 * än att spara en månad för länge. Den här körningen rör därför ingen rad
 * ännu; den gör mekaniken och planen synlig och granskningsbar först.
 */
const runGallring = async (): Promise<void> => {
  const { rows } = await db.query(
    "select value from public.app_settings where key = 'retention_policy'",
  );
  const override = ((rows[0]?.value as { overrides?: RetentionOverride[] } | undefined)?.overrides) ?? [];
  const policy = mergeRetentionPolicy(DEFAULT_RETENTION, override);

  console.log(`gallring (skuggläge): ${retentionSummary(policy)}`);
  for (const cat of policy) {
    if (cat.action === "behall") {
      console.log(`  ${cat.id}: behålls för spårbarhet, gallras inte på tid.`);
      continue;
    }
    const nar = cat.months === null ? "ingen tidsgräns" : `efter ${cat.months} mån`;
    const lage = cat.aktiv
      ? "AKTIV – skarp gallring kopplas in via DB-funktion (ännu ej driftsatt)"
      : "skuggläge – räknas, gallras inte";
    console.log(`  ${cat.id}: ${cat.action} ${nar} · ${lage}`);
  }
};

/**
 * Månadsfaktureringen av förmedlingar.
 *
 * Själva faktureringen bor i databasen (issue_referral_invoices):
 * nummerserie, öresbelopp, moms och engångsmärkning sker i EN transaktion
 * där. Här görs två saker: bolagsspärren prövas (samma regel som
 * kundfakturorna - inga fakturor utan momsregistrering, F-skatt och
 * betalkonto), och mejlen byggs ur samma byggare som allt annat.
 */
const runReferralInvoicing = async (): Promise<void> => {
  const blockers = missingInvoiceFields();
  if (blockers.length > 0) {
    console.log(`förmedlingsfakturering blockerad: ${blockers.join("; ")}`);
    return;
  }

  const { rows } = await db.query("select * from public.issue_referral_invoices()");
  let issued = 0;
  for (const row of rows) {
    if (row.skipped_reason) {
      console.log(`hoppade över ${row.customer_name}: ${row.skipped_reason} (${row.referral_count} förmedlingar väntar)`);
      continue;
    }
    const netOre = Number(row.net_ore);
    await enqueue(
      invoiceEmail({
        invoiceNumber: row.invoice_number,
        issuedAt: row.issued_at.toISOString(),
        dueAt: row.due_at.toISOString(),
        seller: COMPANY,
        customer: { name: row.customer_name, orgNumber: null, email: row.recipient, address: null },
        lines: [
          {
            description: `Förmedlade förfrågningar ${row.period_start.toISOString().slice(0, 7)} (${row.referral_count} st)`,
            quantity: 1,
            unitPriceOre: netOre,
          },
        ],
        note: null,
        totals: {
          netOre,
          vatOre: Number(row.vat_ore),
          grossOre: Number(row.gross_ore),
          vatRate: 0.25,
        },
      }),
      { userId: row.user_id, invoiceId: row.invoice_id },
    );
    issued += 1;
  }
  console.log(`förmedlingsfakturor: ${issued} utställda, ${rows.length - issued} överhoppade`);
};

/**
 * Samlingsfakturan för användningsavgifter: en faktura per byrå för
 * föregående månads upplåsta ärenden och abonnemang. Specifikationen bor i
 * usage_charges (kopplade via invoice_id) och visas rad för rad i byråns
 * fakturacentral - mejlet bär summan, systemet bär detaljerna.
 */
const runUsageInvoicing = async (): Promise<void> => {
  const blockers = missingInvoiceFields();
  if (blockers.length > 0) {
    console.log(`användningsfakturering blockerad: ${blockers.join("; ")}`);
    return;
  }

  const { rows } = await db.query("select * from public.issue_usage_invoices()");
  let issued = 0;
  for (const row of rows) {
    if (row.skipped_reason) {
      console.log(`hoppade över ${row.customer_name}: ${row.skipped_reason} (${row.charge_count} poster väntar)`);
      continue;
    }
    const netOre = Number(row.net_ore);
    await enqueue(
      invoiceEmail({
        invoiceNumber: row.invoice_number,
        issuedAt: row.issued_at.toISOString(),
        dueAt: row.due_at.toISOString(),
        seller: COMPANY,
        customer: { name: row.customer_name, orgNumber: null, email: row.recipient, address: null },
        lines: [
          {
            description: `Användningsavgifter ${row.period_start.toISOString().slice(0, 7)} (${row.charge_count} poster, specifikation i fakturacentralen)`,
            quantity: 1,
            unitPriceOre: netOre,
          },
        ],
        note: null,
        totals: {
          netOre,
          vatOre: Number(row.vat_ore),
          grossOre: Number(row.gross_ore),
          vatRate: 0.25,
        },
      }),
      { userId: row.user_id, invoiceId: row.invoice_id },
    );
    issued += 1;
  }
  console.log(`samlingsfakturor: ${issued} utställda, ${rows.length - issued} överhoppade`);
};

const main = async () => {
  await db.connect();

  if (process.argv.includes("--invoice-referrals")) {
    await runReferralInvoicing();
    await db.end();
    return;
  }

  if (process.argv.includes("--invoice-usage")) {
    await runUsageInvoicing();
    await db.end();
    return;
  }

  if (process.argv.includes("--credit")) {
    await runCreditChecks();
    await db.end();
    return;
  }

  if (process.argv.includes("--gallra")) {
    await runGallring();
    await db.end();
    return;
  }

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

  // Inbjudningar som ännu inte mejlats. Klienten kan inte skriva i utkorgen
  // (det vore en spamkanal med vårt avsändarrykte), så mejlet byggs här, ur
  // samma byggare som allt annat, och bockas av i samma transaktion som det
  // köas - kraschar något mellan stegen plockas inbjudan om, inte dubblas.
  await db.query("begin");
  try {
    const { rows: invitations } = await db.query(
      `select i.id, i.email, i.role, i.expires_at,
              coalesce(c.company_name, 'bolaget') as company_name,
              coalesce(p.display_name, 'En kollega') as inviter_name
       from public.case_invitations i
       join public.cases c on c.id = i.case_id
       left join public.user_profiles p on p.user_id = i.invited_by
       where i.email_enqueued_at is null
         and i.accepted_at is null
         and i.revoked_at is null
         and i.expires_at > now()
       for update of i skip locked`,
    );
    for (const invitation of invitations) {
      const role = invitation.role as CaseRole;
      await enqueue(
        caseInvitationEmail({
          recipient: invitation.email,
          inviterName: invitation.inviter_name,
          companyName: invitation.company_name,
          roleLabel: CASE_ROLE_LABELS[role] ?? invitation.role,
          roleDescription: CASE_ROLE_DESCRIPTIONS[role] ?? "",
          acceptUrl: `${APP_BASE_URL}/inbjudan/${invitation.id}`,
          expiresAt: invitation.expires_at.toISOString(),
        }),
        { userId: null, invoiceId: null },
      );
      await db.query(
        "update public.case_invitations set email_enqueued_at = now() where id = $1",
        [invitation.id],
      );
    }
    await db.query("commit");
    if (invitations.length > 0) console.log(`inbjudningar köade: ${invitations.length}`);
  } catch (error) {
    await db.query("rollback");
    throw error;
  }

  const { rows: batch } = await db.query(
    "select id, recipient, subject, body_text, body_html from public.claim_outbound_emails($1)",
    [20],
  );

  let sent = 0;
  let failed = 0;

  // Sändaren byggs en gång per körning (öppnar SMTP-transporten / SES-klienten).
  const sender = await makeMailSender(mailConfig);

  for (const row of batch) {
    try {
      await sender({
        recipient: row.recipient,
        subject: row.subject,
        bodyText: row.body_text,
        bodyHtml: row.body_html,
      });
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
