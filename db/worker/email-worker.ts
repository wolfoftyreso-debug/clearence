/**
 * E-postarbetaren. Körs i driftmiljön som cron:
 *
 *   node db/dist/email-worker.cjs            var 5:e minut: skicka kön
 *   node db/dist/email-worker.cjs --remind   per timme: köa påminnelser
 *   node db/dist/email-worker.cjs --close    per dygn: stäng + köa besked
 *   node db/dist/email-worker.cjs --credit   per dygn: kreditbevakning
 *   node db/dist/email-worker.cjs --gallra   per dygn: gallring + raderingar
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
import { arbetarUrl, kravArbetarroll } from "./roll";
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
  retentionCutoff,
  retentionOverrideProblems,
  retentionSummary,
  type RetentionOverride,
} from "../../src/lib/retention";
import {
  CASE_ROLE_DESCRIPTIONS,
  CASE_ROLE_LABELS,
  type CaseRole,
} from "../../src/lib/caseRoles";

/*
 * MILJÖN LÄSES NÄR DEN ANVÄNDS, INTE VID IMPORT.
 *
 * `const DATABASE_URL = process.env.DATABASE_URL` fångade värdet i det
 * ögonblick modulen lästes. Det höll för ett kommando som startade med
 * miljön redan satt, men gör två saker fel här: en rättad DATABASE_URL
 * kräver en ny process i stället för en ny körning, och den kan inte
 * prövas - server/tests/cron.ts pekade om den och fick samma anslutning
 * tillbaka, alltså ett prov som inte kunde misslyckas.
 */

/** Bas för länkar i mejl, t.ex. inbjudans acceptlänk. */
const APP_BASE_URL = (process.env.APP_BASE_URL ?? "https://clearance.se").replace(/\/$/, "");

/*
 * KRAVET PÅ MILJÖN PRÖVAS NÄR JOBBET KÖRS, INTE NÄR FILEN LÄSES.
 *
 * `process.exit(1)` vid import dödade processen. Det var rätt för ett
 * kommando i en container - fel för en modul som importeras av en
 * Vercel-funktion, där import sker inuti en request som redan tagits emot
 * och det enda som händer är att jobbet försvinner utan svar. Ett kastat
 * fel går att fånga, rapportera och svara 500 på.
 */
const kravMiljo = (): void => {
  const saknas = [
    !arbetarUrl() ? "WORKER_DATABASE_URL eller DATABASE_URL" : null,
    !process.env.MAIL_FROM ? "MAIL_FROM" : null,
  ].filter((v): v is string => v !== null);
  if (saknas.length > 0) throw new Error(`${saknas.join(" och ")} måste vara satta.`);
};

/*
 * KLIENTEN GÅR ATT ÖPPNA OM.
 *
 * En pg-Client som en gång fått end() kan inte återanslutas. På en egen
 * server spelade det ingen roll - processen dog ändå efter körningen. En
 * Vercel-instans återanvänds mellan cron-körningar, och den andra
 * körningen hade fått "Client was already connected"-fel på en död
 * anslutning. Därför skapas en NY klient vid varje anslut().
 *
 * `db` är en tunn fasad så att de nitton anropen nedan står kvar
 * oförändrade och inte behöver veta något om det här.
 */
let klient: Client | null = null;

const db = {
  query: (text: string, values?: unknown[]) => {
    if (!klient) throw new Error("workern är inte ansluten - anslut() först");
    return values === undefined ? klient.query(text) : klient.query(text, values);
  },
};

export const anslut = async (): Promise<void> => {
  kravMiljo();
  if (klient) return;
  const ny = new Client({ connectionString: arbetarUrl() });
  await ny.connect();
  // ROLLEN PRÖVAS INNAN JOBBET BÖRJAR. En arbetare som inte ser något
  // rapporterar inte fel - den rapporterar noll. Se db/worker/roll.ts.
  try {
    await kravArbetarroll(ny);
  } catch (fel) {
    await ny.end().catch(() => {});
    throw fel;
  }
  klient = ny;
};

export const koppla_ner = async (): Promise<void> => {
  if (!klient) return;
  const gammal = klient;
  klient = null;
  await gammal.end();
};
// Transporten (SES eller SMTP) väljs av MAIL_TRANSPORT. Se db/worker/mail.ts.
/*
 * MEJLKONFIGURATIONEN LÄSES NÄR MEJL SKA SKICKAS, INTE VID IMPORT.
 *
 * Här stod `const mailConfig = resolveMailConfig(process.env)` på modulnivå.
 * resolveMailConfig KASTAR på en ofullständig konfiguration (t.ex.
 * MAIL_TRANSPORT=smtp utan SMTP_HOST), och ett kast vid import stoppade då
 * hela filen - alltså också gallringen, raderingen, kreditkontrollerna och
 * de två faktureringarna, som inte skickar ett enda mejl.
 *
 * I containern spelade det mindre roll: kommandot dog, någon läste loggen.
 * På Vercel importeras filen av api/cron/nattjobb.ts inuti en request, och
 * en saknad SMTP_HOST hade tagit natten med sig.
 */
const mailSandare = () => makeMailSender(resolveMailConfig(process.env));

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
export const runCreditChecks = async (): Promise<void> => {
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
 * (nyckeln retention_policy). Här läses den, slås ihop, och körs.
 *
 * SKUGGLÄGET FINNS KVAR, MEN ÄR INTE LÄNGRE EN GISSNING. Varje kategori
 * anropar app.gallra() - den påslagna skarpt, den avstängda som torrkörning.
 * Samma fråga i båda fallen, så siffran skuggläget visar är den siffra som
 * kommer att gallras den dag någon slår på kategorin. Förut loggades bara
 * planen; en plan utan siffra går inte att granska.
 *
 * Att slå på en kategori är fortfarande ett medvetet beslut av en människa
 * i driftpanelen, inte en default: att radera fel, eller det spårbarheten
 * kräver, är värre än att spara en månad för länge.
 */
export const runGallring = async (): Promise<void> => {
  const { rows } = await db.query(
    "select value from public.app_settings where key = 'retention_policy'",
  );
  const override = ((rows[0]?.value as { overrides?: RetentionOverride[] } | undefined)?.overrides) ?? [];
  const policy = mergeRetentionPolicy(DEFAULT_RETENTION, override);
  const nu = new Date();

  // Sammanslagningen faller tillbaka på standarden för varje fält den inte
  // godtar. Det gör körningen säker, men tyst - och en gallringstid som drift
  // tror är satt medan standarden gäller är värre än ett fel. Därför skrivs
  // det som avvisades ut, och körningen slutar grön.
  const avvisade = retentionOverrideProblems(DEFAULT_RETENTION, override);
  for (const p of avvisade) {
    console.error(`  driftparametern avvisad: ${p.id}.${p.falt} - ${p.skal} (standarden gäller)`);
    process.exitCode = 1;
  }

  console.log(`gallring: ${retentionSummary(policy)}`);
  for (const cat of policy) {
    if (cat.action === "behall") {
      console.log(`  ${cat.id}: behålls för spårbarhet, gallras inte på tid.`);
      continue;
    }
    const torrkorning = !cat.aktiv;
    try {
      // Innanför try: ett omöjligt datum ska stoppa kategorin, inte hela
      // nattjobbet. Efter gallringen kommer raderingarna (art. 17), och de
      // får inte utebli för att en inställning var trasig.
      const brytdatum = retentionCutoff(cat, nu);
      const { rows: res } = await db.query(
        "select app.gallra($1, $2::timestamptz, $3) as antal",
        [cat.id, brytdatum, torrkorning],
      );
      const antal = Number(res[0]?.antal ?? 0);
      const nar = cat.months === null ? "ingen tidsgräns" : `efter ${cat.months} mån`;
      console.log(
        torrkorning
          ? `  ${cat.id}: skuggläge - ${antal} rad(er) SKULLE ${cat.action}s ${nar}`
          : `  ${cat.id}: ${antal} rad(er) ${cat.action}de ${nar}`,
      );
    } catch (error) {
      // En kategori som fallerar ska inte stoppa de andra - men den ska
      // synas. Tyst överhoppning är hur en gallring slutar gallra.
      console.error(`  ${cat.id}: MISSLYCKADES - ${(error as Error).message}`);
      process.exitCode = 1;
    }
  }
};

/**
 * RADERINGARNA (GDPR art. 17). Körs samma dygnsrytm som gallringen.
 *
 * Karenstiden och hela utförandet bor i databasen; arbetaren gör ett anrop
 * och skriver ut vad som hände. Att lägga logiken här hade betytt att en
 * halvvägs krashad körning lämnade ett halvraderat konto - i databasen är
 * det en transaktion.
 */
export const runRaderingar = async (): Promise<void> => {
  const { rows } = await db.query("select app.execute_due_erasures() as resultat");
  const resultat = (rows[0]?.resultat ?? {}) as { utforda?: number; detaljer?: unknown[] };
  const antal = Number(resultat.utforda ?? 0);
  if (antal === 0) {
    console.log("radering: ingen begäran har passerat sin karenstid.");
    return;
  }
  console.log(`radering: ${antal} konto(n) raderade.`);
  for (const rad of resultat.detaljer ?? []) {
    console.log(`  ${JSON.stringify(rad)}`);
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
export const runReferralInvoicing = async (): Promise<void> => {
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
export const runUsageInvoicing = async (): Promise<void> => {
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

/** Stänger konton vars betalningsfrist gått ut och köar beskedet. */
export const runStangning = async (): Promise<void> => {
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
};

/** Påminner om fakturor som närmar sig förfall. */
export const runPaminnelser = async (): Promise<void> => {
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
};

/**
 * UTKORGEN: bygger inbjudningsmejlen och tömmer kön.
 *
 * Låg tidigare i svansen på main(), alltså oåtkomlig för allt utom
 * kommandoraden. Cron-endpointen api/cron/utkorg.ts anropar den här - det
 * är samma kod som containern körde, inte en ny.
 */
export const runUtkorg = async (): Promise<void> => {
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
  const sender = await mailSandare();

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
};

const main = async () => {
  await anslut();
  try {
    if (process.argv.includes("--invoice-referrals")) return await runReferralInvoicing();
    if (process.argv.includes("--invoice-usage")) return await runUsageInvoicing();
    if (process.argv.includes("--credit")) return await runCreditChecks();
    if (process.argv.includes("--gallra")) {
      await runGallring();
      return await runRaderingar();
    }
    if (process.argv.includes("--close")) await runStangning();
    if (process.argv.includes("--remind")) await runPaminnelser();
    await runUtkorg();
  } finally {
    await koppla_ner();
  }
};

/*
 * KÖRS BARA SOM KOMMANDO.
 *
 * Filen importeras numera av cron-endpointerna under api/cron/. En modul
 * som startar ett jobb bara för att den läses hade kört utkorgen en gång
 * extra vid varje import - och gjort dubbla mejl till en importbieffekt.
 */
if (/email-worker/.test(process.argv[1] ?? "")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
