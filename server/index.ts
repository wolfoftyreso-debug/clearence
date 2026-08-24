/**
 * CLEARANCE API v1 - egen server mot egen Postgres.
 *
 * Det här är delen infrakartan har stått och pekat på: klienten pratar
 * PostgREST via Supabase-klienten, och så länge den gör det är "inte
 * Supabase" en avsikt och inte ett faktum. DataPort är hela kontraktet,
 * och det här är serversidan av det.
 *
 * Vad som är byggt i den här omgången: identitetslagret (som är det som
 * inte får bli fel), sessionerna, och den första lodräta skivan av
 * kontraktet - ärenden, journalen och beslutsminnet inklusive
 * omprövningsbevakningen. Resten av DataPort är samma mönster igen; det
 * som var osäkert är avklarat.
 *
 * Kör: DATABASE_URL=... node api/dist/server.cjs (se main.ts)
 */

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import {
  ApiError,
  Router,
  badRequest,
  forbidden,
  notFound,
  readBody,
  sendJson,
  unauthorized,
  type ApiRequest,
} from "./http";
import { ALLMAN, BEKRAFTELSE, klientNyckel, LOGIN, provaGrans, type Utfall } from "./rateLimit";
import { googleConfigured, lookupCompany } from "./google";
import { fetchWebsite, websiteConfigured } from "./website";
import { DEFAULT_FEEDS, fetchNews, newsConfigured, parseFeedSetting } from "./news";
import {
  DOCUMENT_URL_TTL_SECONDS,
  UPLOAD_URL_TTL_SECONDS,
  laesForstaBytes,
  laesHuvud,
  presignDocument,
  presignUpload,
  storageConfigured,
  taBortObjekt,
} from "./storage";
import { MAX_FILSTORLEK, provaFil, provaMetadata, sakerLagringsvag } from "./filtyper";
import { anthropicConfigured, clearanceReply, type AdvisorMessage } from "./anthropic";
import { deriveAuditDetail } from "../src/lib/auditDetail";
import { DEFAULT_COMPANY_PLAN } from "../src/lib/pricing";
import { parseSie } from "../src/lib/financial/sie";
import { snapshotFromSie } from "../src/lib/financial/fromSie";
import {
  MOTORVERSION,
  korDirekt,
  kor as korSimulering,
  nyttFro,
  valideraSpec,
  type Simuleringsspec,
} from "../src/lib/montecarlo/motor";
import {
  DEFAULT_RETENTION,
  mergeRetentionPolicy,
  retentionOverrideProblems,
  type RetentionOverride,
} from "../src/lib/retention";
import { withAnon, withUser, type Tx } from "./db";
import { loggaFel } from "./logg";
import { hashPassword, issueToken, sessionTtlHours, sha256, verifyPassword } from "./auth";

/* --- Identiteten bakom en request ----------------------------------------- */

interface Caller {
  userId: string;
  sessionId: string;
}

const bearer = (req: ApiRequest): string | null => {
  const header = req.headers.authorization;
  if (typeof header !== "string") return null;
  const [scheme, ...rest] = header.split(" ");
  if (scheme.toLowerCase() !== "bearer" || rest.length === 0) return null;
  const token = rest.join(" ").trim();
  return token.length > 0 ? token : null;
};

/**
 * Slår upp sessionen. Kör som anslutningens roll och INTE som någon
 * användare: identiteten är det vi håller på att ta reda på, och att
 * sätta den innan den är känd är hur man bygger en behörighetsbugg.
 */
const authenticate = async (req: ApiRequest): Promise<Caller> => {
  const token = bearer(req);
  if (!token) throw unauthorized();
  const hash = sha256(token);
  const row = await withAnon(async (tx) => {
    const { rows } = await tx.query(
      `select s.id, s.user_id
         from auth.sessions s
         join auth.users u on u.id = s.user_id
        where s.token_hash = $1
          and s.revoked_at is null
          and s.expires_at > now()
          and u.disabled_at is null`,
      [hash],
    );
    return rows[0] ?? null;
  });
  // Samma svar för "finns inte", "återkallad" och "utgången". Skillnaden
  // hjälper bara den som gissar.
  if (!row) throw unauthorized("Sessionen är ogiltig eller har gått ut.");
  return { userId: row.user_id, sessionId: row.id };
};

/**
 * Som authenticate(), men KRÄVER ingen token.
 *
 * Kontaktformuläret ska fungera oinloggat - ett bolag som håller på att gå
 * omkull ska inte behöva ett konto för att ställa en fråga. Är avsändaren
 * ändå inloggad fästs meddelandet vid kontot (kolumnens default läser
 * app.user_id). En ogiltig token behandlas som ingen alls, inte som ett
 * fel: den här ytan hänger inte på en identitet.
 */
const optionalCaller = async (req: ApiRequest): Promise<Caller | null> => {
  if (!bearer(req)) return null;
  try {
    return await authenticate(req);
  } catch {
    return null;
  }
};

/* --- Serialisering: kontraktets namn, aldrig kolumnnamnen ----------------- */

/**
 * Tidsstämplar som ISO-strängar, alltid.
 *
 * `pg` ger tillbaka JS-Date för timestamptz. JSON.stringify hade råkat
 * göra rätt på vägen ut, men då hade handlerns returvärde inte varit
 * samma sak som det klienten ser - och kontraktet säger `date-time`, en
 * sträng. Det som är sant på tråden ska vara sant i koden också.
 */
const iso = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

/**
 * ETT DATUM ÄR INTE EN TIDSSTÄMPEL, och det här är skillnaden på en dag.
 *
 * `pg` ger tillbaka JS-Date även för en `date`-kolumn, satt till LOKAL
 * midnatt. Körs iso() på den blir 2026-08-12 i svensk drift
 * "2026-08-11T22:00:00.000Z" - fel dag, i en produkt vars hela poäng är
 * att räkna ner till en frist. Utvecklingscontainern kör UTC, så felet
 * syns inte här; det uppstår först när tjänsten står i den tidszon den
 * ska stå i.
 *
 * Kontraktet säger `date` (yyyy-MM-dd). Kolumnen castas därför till text
 * redan i frågan, och den här funktionen är säkerhetsnätet för den som
 * glömmer casten: en Date reduceras till sitt LOKALA datum, aldrig till
 * sitt UTC-datum.
 */
export const datum = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    const ar = value.getFullYear();
    const man = String(value.getMonth() + 1).padStart(2, "0");
    const dag = String(value.getDate()).padStart(2, "0");
    return `${ar}-${man}-${dag}`;
  }
  // Redan text (kolumnen castades i frågan). Klipp bort en eventuell
  // tidsdel så att formen blir densamma oavsett väg hit.
  return String(value).slice(0, 10);
};

/**
 * Ärendet, HELT.
 *
 * Den här funktionen returnerade tidigare nio fält av trettio. Adaptern
 * castar svaret rakt till CaseRecord, så ett utelämnat fält blir inte ett
 * saknat värde utan ett LÖFTE SOM INTE HÅLLS: resten av produkten läser
 * recommendationReasons[0] och canPayTax som om de fanns. Översikten
 * kraschade på första raden i systemanalysen.
 *
 * Regeln som följer: den som lägger till ett fält i CaseRecord måste
 * lägga till det här. tests/apiSpec.ts jämför de två listorna och faller
 * annars - ett kontrakt som bara hålls av vaksamhet hålls inte.
 */
const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

const toCase = (row: Record<string, unknown>) => ({
  id: row.id,
  orgNumber: row.org_number,
  companyName: row.company_name,
  employees: row.employees ?? null,
  canPaySalary: row.can_pay_salary ?? null,
  salaryAmount: row.salary_amount ?? null,
  salaryDay: row.salary_day ?? null,
  canPayTax: row.can_pay_tax ?? null,
  taxAmount: row.tax_amount ?? null,
  taxDay: row.tax_day ?? null,
  canPayRent: row.can_pay_rent ?? null,
  rentAmount: row.rent_amount ?? null,
  rentDay: row.rent_day ?? null,
  canPaySuppliers: row.can_pay_suppliers ?? null,
  totalDebt: row.total_debt ?? null,
  quickLiquidationValue: row.quick_liquidation_value ?? null,
  recommendationType: row.recommendation_type ?? null,
  recommendationTitle: row.recommendation_title ?? null,
  recommendationDescription: row.recommendation_description ?? null,
  // Listorna får ALDRIG vara undefined: läsaren gör [0] på dem.
  recommendationReasons: asStringArray(row.recommendation_reasons),
  recommendationNextSteps: asStringArray(row.recommendation_next_steps),
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
  closedAt: iso(row.closed_at),
  exitReason: row.exit_reason ?? null,
  healthMode: row.health_mode ?? false,
  planApprovedAt: iso(row.plan_approved_at),
  planApprovedBy: row.plan_approved_by ?? null,
});

const toDecision = (row: Record<string, unknown>) => ({
  id: row.id,
  title: row.title,
  rationale: row.rationale,
  premise: row.premise,
  decidedAt: iso(row.decided_at),
  status: row.status,
  reconsideredAt: iso(row.reconsidered_at),
  reconsiderNote: row.reconsider_note,
  watch:
    row.watch_signal && row.watch_comparator
      ? {
          signal: row.watch_signal,
          comparator: row.watch_comparator,
          threshold: row.watch_threshold === null ? null : Number(row.watch_threshold),
        }
      : null,
  watchAckObservation: row.watch_ack_observation ?? null,
  watchAckAt: iso(row.watch_ack_at),
});

/**
 * En journalpost, HELT.
 *
 * Den här returnerade sex av tio fält, och `audit.listByCase` är en
 * MIGRERAD port som castar svaret rakt till AuditEventRecord. Följden var
 * samma sort som toCase varnar för några rader upp: caseId, actorUserId
 * och framför allt `detail` saknades - "vad händelsen gällde, läsbart".
 *
 * Utan detail blir hela händelseloggen "update, update, insert" för den
 * som kör mot eget API, medan samma logg via den gamla adaptern säger
 * "\"Ring revisorn\" bockades av". Det är inte ett saknat fält, det är en
 * borttappad funktion - och den syns bara för den som jämför två
 * adaptrar.
 *
 * Texten härleds med samma rena funktion som den gamla adaptern använder,
 * så att de två inte kan glida isär.
 */
const toEvent = (row: Record<string, unknown>) => ({
  id: Number(row.id),
  caseId: row.case_id ?? null,
  actorUserId: row.actor_user_id ?? null,
  actorRole: row.actor_role ?? null,
  action: row.action,
  objectType: row.object_type,
  objectId: row.object_id ?? null,
  detail: deriveAuditDetail(
    String(row.object_type),
    String(row.action),
    (row.before ?? null) as Record<string, unknown> | null,
    (row.after ?? null) as Record<string, unknown> | null,
  ),
  occurredAt: iso(row.occurred_at),
});

const toTask = (row: Record<string, unknown>) => ({
  id: row.id,
  caseId: row.case_id,
  label: row.label,
  // due_date är ett DATE. Se datum() ovan - iso() hade flyttat fristen en
  // dag bakåt i varje drift öster om Greenwich.
  dueDate: datum(row.due_date),
  doneAt: iso(row.done_at),
  doneBy: row.done_by,
  source: row.source,
  createdAt: iso(row.created_at),
  assignedTo: row.assigned_to,
});

const toDocument = (row: Record<string, unknown>) => ({
  id: row.id,
  caseId: row.case_id,
  kind: row.kind,
  fileName: row.file_name,
  fileSize: Number(row.file_size),
  mimeType: row.mime_type,
  source: row.source,
  reviewStatus: row.review_status,
  createdAt: iso(row.created_at),
  // storage_path lämnas AVSIKTLIGT ute: den är nyckeln till hinken, och
  // vägen till innehållet går genom en signerad URL efter
  // app.may_read_document() - aldrig genom att klienten får sökvägen.
});

const toPayment = (row: Record<string, unknown>) => ({
  id: row.id,
  caseId: row.case_id,
  label: row.label,
  amount: Number(row.amount),
  category: row.category,
  status: row.status,
  dueDate: datum(row.due_date),
  recurring: row.recurring === true,
});

/** En faktura in eller ut. issue_date och due_date är DATE, inte tidsstämplar. */
const toInvoice = (row: Record<string, unknown>) => ({
  id: row.id,
  caseId: row.case_id,
  label: row.label,
  amount: Number(row.amount),
  direction: row.direction,
  status: row.status,
  issueDate: datum(row.issue_date),
  dueDate: datum(row.due_date),
  counterpart: row.counterpart ?? null,
});

/**
 * Ett meddelande, HELT.
 *
 * Den här bar tidigare sex fält av tio. Adaptern castar rakt till
 * CaseMessage, så de fyra som saknades blev `undefined` i klienten -
 * och `acks` är en lista som gränssnittet räknar på. Ett halvt löfte i
 * en serialiserare är ett fel som inte syns förrän i vyn.
 *
 * `acks` kommer med som aggregat ur frågan (json_agg), inte som en extra
 * rundtur per meddelande: en tråd med hundra rader hade annars blivit
 * hundra frågor.
 */
const toMessage = (row: Record<string, unknown>) => ({
  id: row.id,
  caseId: row.case_id,
  conversationId: row.conversation_id ?? null,
  body: row.body,
  authorUserId: row.author_user_id ?? null,
  attachmentDocumentId: row.attachment_document_id ?? null,
  expectsReplyFrom: row.expects_reply_from ?? null,
  acks: Array.isArray(row.acks)
    ? (row.acks as Record<string, unknown>[]).map((a) => ({
        userId: a.user_id,
        ackedAt: iso(a.acked_at),
      }))
    : [],
  createdAt: iso(row.created_at),
  readAt: iso(row.read_at),
});

/**
 * Meddelandets kolumner plus kvittenserna.
 *
 * Radskyddet på message_acks säger "ser man meddelandet ser man vilka som
 * kvitterat det" (can_see_message), så den vänstra kopplingen behöver
 * ingen egen behörighetsfråga - den kan inte returnera mer än raden får
 * visa.
 */
const MEDDELANDE_KOLUMNER = `
  m.id, m.case_id, m.conversation_id, m.body, m.author_user_id,
  m.attachment_document_id, m.expects_reply_from, m.created_at, m.read_at,
  coalesce(
    (select json_agg(json_build_object('user_id', a.user_id, 'acked_at', a.acked_at)
                     order by a.acked_at)
       from public.message_acks a where a.message_id = m.id),
    '[]'::json
  ) as acks`;

const toConversation = (row: Record<string, unknown>) => ({
  id: row.id,
  caseId: row.case_id,
  kind: row.kind,
  title: row.title ?? null,
  createdBy: row.created_by ?? null,
  createdAt: iso(row.created_at),
  mergedInto: row.merged_into ?? null,
  participants: Array.isArray(row.participants)
    ? (row.participants as Record<string, unknown>[]).map((p) => ({
        userId: p.user_id,
        displayName: (p.display_name as string | null) ?? null,
      }))
    : [],
});

const toMention = (row: Record<string, unknown>) => ({
  messageId: row.message_id,
  caseId: row.case_id,
  conversationId: row.conversation_id ?? null,
  conversationTitle: row.conversation_title ?? null,
  authorName: row.author_name ?? null,
  body: row.body,
  createdAt: iso(row.created_at),
});

/**
 * Ett kontaktmeddelande, HELT. Fälten är ContactMessageRecord i
 * src/data/types.ts; adaptern castar rakt till den, så ett utelämnat fält
 * blir ett löfte som inte hålls (samma regel som toCase). handled_at och
 * created_at är timestamptz - iso() eller kontraktet ljuger om formen.
 */
const toContactMessage = (row: Record<string, unknown>) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  phone: row.phone ?? null,
  company: row.company ?? null,
  topic: row.topic,
  message: row.message,
  userId: row.user_id ?? null,
  status: row.status,
  handledBy: row.handled_by ?? null,
  handledAt: iso(row.handled_at),
  internalNote: row.internal_note ?? null,
  createdAt: iso(row.created_at),
});

/** Kontaktformulärets ämnen och handläggningsstatusar - kontraktets enum:er. */
const CONTACT_TOPICS = ["question", "company", "advisor", "invoice", "privacy", "bug", "other"];
const CONTACT_STATUSES = ["new", "in_progress", "answered", "closed"];

/** Ärendets roller (public.case_role). 'owner'/'creditor' delas inte ut per mejl. */
const CASE_ROLES = [
  "owner",
  "company_staff",
  "reconstructor",
  "trustee",
  "auditor",
  "legal_advisor",
  "board_member",
  "creditor",
  "observer",
];

/** En ärendemedlem, som list_case_members lämnar ut den (caseId ur rutten). */
const toMember = (row: Record<string, unknown>, caseId: string) => ({
  id: row.id,
  caseId,
  userId: row.user_id,
  role: row.role,
  displayName: row.display_name ?? null,
  email: row.email ?? null,
  createdAt: iso(row.created_at),
  revokedAt: iso(row.revoked_at),
});

const toInvitation = (row: Record<string, unknown>) => ({
  id: row.id,
  caseId: row.case_id,
  email: row.email,
  role: row.role,
  createdAt: iso(row.created_at),
  expiresAt: iso(row.expires_at),
  acceptedAt: iso(row.accepted_at),
  revokedAt: iso(row.revoked_at),
});

/** Vad den inbjudna får se INNAN accept - bara om adressen matchar. */
const toInvitationPeek = (row: Record<string, unknown>) => ({
  id: row.id,
  companyName: row.company_name ?? null,
  orgNumber: row.org_number,
  role: row.role,
  inviterName: row.inviter_name ?? null,
  expiresAt: iso(row.expires_at),
  acceptedAt: iso(row.accepted_at),
  revokedAt: iso(row.revoked_at),
});

/** Byråns egna arbetsmaterial: intern anteckning och tidspost. */
const toNote = (row: Record<string, unknown>) => ({
  id: row.id,
  caseId: row.case_id,
  body: row.body,
  createdAt: iso(row.created_at),
});

const toTimeEntry = (row: Record<string, unknown>) => ({
  id: row.id,
  caseId: row.case_id,
  minutes: Number(row.minutes),
  note: row.note ?? null,
  // occurred_on är ett date - läses som text (YYYY-MM-DD), inte en tidsstämpel.
  occurredOn: row.occurred_on === null || row.occurred_on === undefined ? null : String(row.occurred_on),
  createdAt: iso(row.created_at),
});

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Ett rådgivarsamtal (journal): frågor, svar och bedömning i ordning. */
const toSession = (row: Record<string, unknown>) => ({
  id: row.id,
  caseId: row.case_id,
  flowId: row.flow_id,
  flowTitle: row.flow_title,
  startedAt: iso(row.started_at),
  closedAt: iso(row.closed_at),
  // entries är jsonb - pg ger tillbaka en färdig array.
  entries: Array.isArray(row.entries) ? row.entries : [],
});

/* --- Drift: nyckelvalv, avgifter, planer, gallring, North Star ------------ */

/** En hemlighet som den FÅR visas: leverantör, fyra sista, bytesdatum. Aldrig värdet. */
const toSecretInfo = (row: Record<string, unknown>) => ({
  provider: row.provider,
  last4: row.last4,
  updatedAt: iso(row.updated_at),
});

const toProfessionalTerms = (row: Record<string, unknown>) => ({
  professionalId: row.professional_id,
  name: row.name,
  company: row.company ?? null,
  billingEmail: row.billing_email ?? null,
  referralFeeSek: row.referral_fee === null || row.referral_fee === undefined ? null : Number(row.referral_fee),
  uninvoicedBillable: Number(row.uninvoiced_billable ?? 0),
});

const toBillingPlan = (row: Record<string, unknown>) => ({
  professionalId: row.professional_id,
  planKind: row.plan_kind,
  unlockFeeSek: row.unlock_fee_sek === null || row.unlock_fee_sek === undefined ? null : Number(row.unlock_fee_sek),
  monthlyFeeSek: row.monthly_fee_sek === null || row.monthly_fee_sek === undefined ? null : Number(row.monthly_fee_sek),
  shadow: row.shadow === true,
});

const PLAN_KINDS = ["per_case", "subscription", "usage", "enterprise"];
const SECRET_PROVIDER = /^[a-z0-9_-]{1,60}$/;

/** Kontots faktureringsstatus. Ett okänt planId faller NEDÅT till standard. */
const toBilling = (row: Record<string, unknown>) => ({
  userId: row.user_id,
  planId:
    row.plan_id === "start" || row.plan_id === "business" || row.plan_id === "enterprise"
      ? row.plan_id
      : "standard",
  startedAt: iso(row.started_at),
  dueAt: iso(row.due_at),
  paidAt: iso(row.paid_at),
  closedAt: iso(row.closed_at),
  note: row.note ?? null,
});

/** En kundfaktura. bigint-öre kommer som sträng ur pg - Number() en gång här. */
const toCustomerInvoice = (row: Record<string, unknown>) => ({
  id: row.id,
  userId: row.user_id,
  invoiceNumber: row.invoice_number,
  issuedAt: iso(row.issued_at),
  dueAt: iso(row.due_at),
  customerName: row.customer_name ?? null,
  customerOrgNumber: row.customer_org_number ?? null,
  customerAddress: row.customer_address ?? null,
  periodStart: row.period_start === null || row.period_start === undefined ? null : String(row.period_start),
  periodEnd: row.period_end === null || row.period_end === undefined ? null : String(row.period_end),
  netOre: Number(row.net_ore),
  vatOre: Number(row.vat_ore),
  grossOre: Number(row.gross_ore),
  vatRate: Number(row.vat_rate),
  description: row.description,
  status: row.status,
  paidAt: iso(row.paid_at),
  paymentReference: row.payment_reference ?? null,
  receiptNumber: row.receipt_number ?? null,
});

const toOutbox = (row: Record<string, unknown>) => ({
  id: row.id,
  recipient: row.recipient,
  subject: row.subject,
  kind: row.kind,
  status: row.status,
  attempts: Number(row.attempts ?? 0),
  lastError: row.last_error ?? null,
  createdAt: iso(row.created_at),
  sentAt: iso(row.sent_at),
});

/** En API-nyckel som den får visas: prefix och metadata, ALDRIG hemligheten. */
const toApiKey = (row: Record<string, unknown>) => ({
  id: row.id,
  label: row.label,
  keyPrefix: row.key_prefix,
  createdAt: iso(row.created_at),
  lastUsedAt: iso(row.last_used_at),
  revokedAt: iso(row.revoked_at),
});

/* --- Läshjälp -------------------------------------------------------------- */

const str = (body: unknown, field: string, opts: { max?: number; required?: boolean } = {}): string => {
  const value = (body as Record<string, unknown> | undefined)?.[field];
  if (value === undefined || value === null || value === "") {
    if (opts.required === false) return "";
    throw badRequest(`Fältet "${field}" saknas.`);
  }
  if (typeof value !== "string") throw badRequest(`Fältet "${field}" ska vara text.`);
  const trimmed = value.trim();
  if (opts.max && trimmed.length > opts.max) {
    throw badRequest(`Fältet "${field}" är längre än ${opts.max} tecken.`);
  }
  return trimmed;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ett id i kroppen som får utebli.
 *
 * Skillnaden mot att skicka värdet vidare orört: ett id som inte är ett id
 * ska ge 400 med ett begripligt besked, inte ett kastat typfel ur
 * drivrutinen mitt i en insert. Utelämnat och null blir båda null - i de
 * fält som använder den betyder "inte satt" och "ingen" samma sak.
 */
const valfrittId = (body: unknown, field: string): string | null => {
  const value = (body as Record<string, unknown> | undefined)?.[field];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !UUID.test(value)) {
    throw badRequest(`Fältet "${field}" är inte ett giltigt id.`);
  }
  return value;
};
const uuidParam = (req: ApiRequest, name: string): string => {
  const value = req.params[name];
  // Prövas här och inte i databasen: ett trasigt id ska ge 400 med ett
  // begripligt besked, inte ett kastat typfel ur drivrutinen.
  if (!UUID.test(value)) throw badRequest(`"${name}" är inte ett giltigt id.`);
  return value;
};

/* --- Rutterna -------------------------------------------------------------- */

export const router = new Router();

/*
 * Hälsan säger också vilka YTTRE källor den här driften har.
 *
 * En källa som är ansluten i utvecklarens container och inte i
 * produktion ger en analys som tyst blir tunnare - utan att någon sagt
 * det. `sources` gör skillnaden avläsbar utifrån. Bara namn och ja/nej;
 * aldrig en nyckel eller ens dess längd.
 */
router.get("/v1/health", async () => ({
  status: 200,
  body: {
    status: "ok",
    version: "1.0",
    sources: { google: googleConfigured(), website: websiteConfigured(), news: newsConfigured() },
    storage: storageConfigured(),
    advisor: anthropicConfigured(),
  },
}));

/**
 * Uppslag av bolaget hos Google.
 *
 * KRÄVER INLOGGNING, trots att uppgifterna är offentliga. Skälet är inte
 * sekretess utan pengar: Places debiteras per anrop, och en öppen rutt är
 * någon annans gratis Google-konto på vår faktura. Den allmänna
 * hastighetsgränsen gäller dessutom före den här handlern.
 *
 * Svaret bär ALLTID ett status-fält som skiljer på "hittade inget",
 * "källan är inte ansluten" och "det gick fel". Panelen visar olika saker
 * för de tre, och att slå ihop dem till ett tomt resultat är precis den
 * sortens tystnad produkten är byggd för att undvika.
 */
router.post("/v1/sources/google", async (req) => {
  await authenticate(req);
  const body = (req.body ?? {}) as { companyName?: unknown; ort?: unknown };
  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
  if (companyName.length === 0) throw badRequest("companyName krävs.");
  const ort = typeof body.ort === "string" ? body.ort.trim() : undefined;
  return { status: 200, body: await lookupCompany(companyName, ort) };
});

/**
 * Hämtning av bolagets EGEN webbplats.
 *
 * KRÄVER INLOGGNING, inte för att sidan är hemlig - den är publik - utan för
 * att en öppen rutt som hämtar en URL åt vem som helst är en öppen proxy. Med
 * inloggning bakom och SSRF-skyddet i website.ts (privata adresser vägras) kan
 * den inte lockas att hämta något internt.
 *
 * Svaret bär samma sorts status-fält som Google: "traff", "forbjuden" (sidans
 * robots.txt säger nej), "ingen-traff" och "fel" hålls isär i stället för att
 * tyst bli ett tomt resultat.
 */
router.post("/v1/sources/website", async (req) => {
  await authenticate(req);
  const body = (req.body ?? {}) as { url?: unknown };
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (url.length === 0) throw badRequest("url krävs.");
  return { status: 200, body: await fetchWebsite(url) };
});

/**
 * Nyheter om bolaget, ur namngivna RSS-flöden.
 *
 * KRÄVER INLOGGNING, av samma skäl som webbplatsläsaren: en rutt som
 * hämtar en lista med URL:er åt vem som helst är en öppen proxy, hur
 * publika flödena än är.
 *
 * FLÖDENA KOMMER UR DRIFTPARAMETERN, aldrig ur anropet. En klient som
 * fick peka ut flöden hade varit precis den öppna proxyn - och dessutom
 * kunnat mata in en "nyhetskälla" som säger vad som helst om bolaget.
 *
 * Svaret bär utfallet PER FLÖDE. Ett flöde som inte svarade döljs aldrig:
 * en bevakning som tyst blivit tunnare läses som "inget har hänt", och det
 * är ett helt annat påstående.
 */
router.post("/v1/sources/news", async (req) => {
  const caller = await authenticate(req);
  const body = (req.body ?? {}) as { companyName?: unknown; orgNumber?: unknown };
  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
  const orgNumber = typeof body.orgNumber === "string" ? body.orgNumber.trim() : "";
  if (companyName.length === 0 && orgNumber.length === 0) {
    throw badRequest("companyName eller orgNumber krävs.");
  }
  const feeds = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query("select value from public.app_settings where key = 'news_feeds'");
    return parseFeedSetting((rows[0]?.value as { feeds?: unknown } | undefined)?.feeds);
  });
  return { status: 200, body: await fetchNews({ companyName, orgNumber }, feeds) };
});

/**
 * Driftens lista över nyhetsflöden.
 *
 * Läsbar för den inloggade - vilka källor en bevakning vilar på är inte en
 * hemlighet, det är själva svaret på "hur vet ni det?". Skrivningen kräver
 * administratör, vilket radskyddet på app_settings avgör; ingen egen
 * kontroll behövs här, av samma skäl som gallringspolicyn ovan.
 */
router.get("/v1/ops/news-feeds", async (req) => {
  const caller = await authenticate(req);
  const feeds = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query("select value from public.app_settings where key = 'news_feeds'");
    return parseFeedSetting((rows[0]?.value as { feeds?: unknown } | undefined)?.feeds);
  });
  return { status: 200, body: { feeds, standard: DEFAULT_FEEDS } };
});

router.post("/v1/ops/news-feeds", async (req) => {
  const caller = await authenticate(req);
  const raw = (req.body ?? {}) as Record<string, unknown>;
  if (!Array.isArray(raw.feeds)) throw badRequest('Fältet "feeds" ska vara en lista.');
  const feeds = parseFeedSetting(raw.feeds);
  await withUser(caller.userId, async (tx) => {
    await tx.query(
      `insert into public.app_settings (key, value) values ('news_feeds', $1::jsonb)
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [JSON.stringify({ feeds })],
    );
    await tx.query("select app.logga_driftatgard($1, $2, $3, $4::jsonb)", [
      "drift.news_feeds.set", "app_settings", "news_feeds", JSON.stringify({ feeds }),
    ]);
  });
  return { status: 200, body: { feeds } };
});

/**
 * CLEARANCE-samtalet, drivet av modellen.
 *
 * KRÄVER INLOGGNING, av samma skäl som Google-uppslaget: varje anrop
 * kostar pengar per token, och en öppen rutt vore någon annans gratis
 * körning på vår faktura. Den allmänna hastighetsgränsen gäller dessutom
 * före den här handlern.
 *
 * Klienten skickar hela det synliga samtalet (user/assistant), aldrig en
 * systemprompt - konstitutionen bor på servern (anthropic.ts) och kan inte
 * skrivas om från en webbläsare. Svaret bär ett status-fält som skiljer
 * "svar", "källan inte ansluten" och "det gick fel", precis som Google.
 */
router.post("/v1/advisor/reply", async (req) => {
  await authenticate(req);
  const body = (req.body ?? {}) as { messages?: unknown };
  if (!Array.isArray(body.messages)) throw badRequest("messages (en lista) krävs.");
  const messages: AdvisorMessage[] = [];
  for (const rad of body.messages) {
    const m = rad as { role?: unknown; content?: unknown };
    const role = m.role === "assistant" ? "assistant" : m.role === "user" ? "user" : null;
    if (role === null) throw badRequest('varje meddelande måste ha role "user" eller "assistant".');
    if (typeof m.content !== "string") throw badRequest("varje meddelande måste ha content som text.");
    messages.push({ role, content: m.content });
  }
  if (messages.length === 0) throw badRequest("messages får inte vara tom.");
  // Ett tak även på antalet: ett helt samtal, inte en oändlig historik.
  if (messages.length > 100) throw badRequest("samtalet är för långt (max 100 meddelanden).");
  return { status: 200, body: await clearanceReply(messages) };
});

/**
 * Inloggning.
 *
 * Fel lösenord och okänd adress ger SAMMA svar, och båda kostar samma tid:
 * en verifiering körs även när användaren inte finns, mot en attrapphash.
 * Utan det talar svarstiden om vilka adresser som har konton.
 */
const DUMMY_HASH_PROMISE = hashPassword("ingen-anvandare-har-det-har-losenordet");

router.post("/v1/auth/login", async (req) => {
  const email = str(req.body, "email", { max: 320 }).toLowerCase();
  const password = str(req.body, "password", { max: 400 });

  const user = await withAnon(async (tx) => {
    const { rows } = await tx.query(
      "select id, password_hash from auth.users where email = $1 and disabled_at is null",
      [email],
    );
    return rows[0] ?? null;
  });

  const stored = user?.password_hash ?? (await DUMMY_HASH_PROMISE);
  const ok = await verifyPassword(password, stored);
  if (!user || !ok) throw unauthorized("Fel e-postadress eller lösenord.");

  const { token, hash } = issueToken();
  const session = await withAnon(async (tx) => {
    const { rows } = await tx.query(
      `insert into auth.sessions (user_id, token_hash, expires_at, user_agent)
       values ($1, $2, now() + make_interval(hours => $3), $4)
       returning id, expires_at`,
      [user.id, hash, sessionTtlHours(), String(req.headers["user-agent"] ?? "").slice(0, 300)],
    );
    return rows[0];
  });

  return {
    status: 200,
    // Token visas EN gång. Den lagras aldrig i klartext någonstans.
    body: { token, expiresAt: iso(session.expires_at), userId: user.id },
  };
});

/**
 * LÖSENORDET IGEN, FÖRE DET SOM INTE GÅR ATT ÅNGRA.
 *
 * En session är ett bevis på att någon loggade in en gång - inte på att
 * det är samma människa som sitter där nu. En olåst dator, en glömd
 * utloggning på en delad maskin, en stulen token: alla ger en angripare
 * exakt de rättigheter kontot har. Fram till den här funktionen räckte
 * det för att RADERA kontot och för att MYNTA en API-nyckel som gäller
 * långt efter att sessionen återkallats.
 *
 * Kravet är därför inte "var inloggad" utan "visa att du kan lösenordet,
 * nu". Två saker följer av det:
 *
 *  - Bekräftelsen gäller ETT anrop. Ett tidsfönster ("bekräftat för nio
 *    minuter sedan") hade låtit en angripare som råkar titta på när
 *    ägaren bekräftar en åtgärd åka snålskjuts på den andra. Det är
 *    också en regel som är svårare att pröva än den här: det finns inget
 *    tillstånd att komma i otakt med.
 *  - Räkningen ligger på kontot, inte på adressen. Se BEKRAFTELSE.
 *
 * Att svara "fel lösenord" är säkert HÄR, till skillnad från vid
 * inloggningen: anroparen har redan en giltig session för kontot, så
 * svaret röjer ingenting den inte redan visste.
 */
const confirmPassword = async (caller: Caller, req: ApiRequest): Promise<void> => {
  const password = str(req.body, "password", { max: 400 });

  const grans = await provaGrans(`bekraftelse:${caller.userId}`, BEKRAFTELSE);
  if (!grans.tillaten) {
    throw new ApiError(
      429,
      "rate_limited",
      `För många felaktiga försök. Försök igen om ${grans.retryAfter} sekunder.`,
    );
  }

  /*
   * Uppslaget körs som anslutningens roll och inte som användaren:
   * auth.users är inte nåbar för klientrollerna alls, och identiteten är
   * redan känd ur sessionen. En rad utan hash kan inte hända för ett
   * inloggat konto, men jämförelsen görs ändå mot attrappen - koden ska
   * inte ha en gren som hoppar över kontrollen.
   */
  const stored = await withAnon(async (tx) => {
    const { rows } = await tx.query(
      "select password_hash from auth.users where id = $1 and disabled_at is null",
      [caller.userId],
    );
    return (rows[0]?.password_hash as string | undefined) ?? null;
  });

  const ok = await verifyPassword(password, stored ?? (await DUMMY_HASH_PROMISE));
  if (!stored || !ok) throw forbidden("Fel lösenord.");
};

router.post("/v1/auth/logout", async (req) => {
  const caller = await authenticate(req);
  await withAnon(async (tx) => {
    await tx.query("update auth.sessions set revoked_at = now() where id = $1 and revoked_at is null", [
      caller.sessionId,
    ]);
  });
  return { status: 200, body: { revoked: true } };
});

router.get("/v1/auth/me", async (req) => {
  const caller = await authenticate(req);
  const profile = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      "select user_id, role, display_name, phone from public.user_profiles where user_id = $1",
      [caller.userId],
    );
    return rows[0] ?? null;
  });
  return {
    status: 200,
    body: {
      userId: caller.userId,
      role: profile?.role ?? null,
      displayName: profile?.display_name ?? null,
      phone: profile?.phone ?? null,
    },
  };
});

router.get("/v1/cases", async (req) => {
  const caller = await authenticate(req);
  // Ingen where-sats på användaren: radskyddet gör urvalet. Skulle vi
  // filtrera här också dolde vi ett trasigt radskydd bakom applikationen.
  const rows = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `select id, org_number, company_name, employees,
              can_pay_salary, salary_amount, salary_day,
              can_pay_tax, tax_amount, tax_day,
              can_pay_rent, rent_amount, rent_day,
              can_pay_suppliers, total_debt, quick_liquidation_value,
              recommendation_type, recommendation_title, recommendation_description,
              recommendation_reasons, recommendation_next_steps,
              created_at, updated_at, closed_at, exit_reason,
              health_mode, plan_approved_at, plan_approved_by
         from public.cases order by created_at desc limit 100`,
    );
    return rows;
  });
  return { status: 200, body: { cases: rows.map(toCase) } };
});

router.get("/v1/cases/:caseId", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `select id, org_number, company_name, employees,
              can_pay_salary, salary_amount, salary_day,
              can_pay_tax, tax_amount, tax_day,
              can_pay_rent, rent_amount, rent_day,
              can_pay_suppliers, total_debt, quick_liquidation_value,
              recommendation_type, recommendation_title, recommendation_description,
              recommendation_reasons, recommendation_next_steps,
              created_at, updated_at, closed_at, exit_reason,
              health_mode, plan_approved_at, plan_approved_by
         from public.cases where id = $1`,
      [caseId],
    );
    return rows[0] ?? null;
  });
  // Radskyddet filtrerar tyst: noll rader betyder "finns inte, för dig".
  // Vi skiljer inte på "finns inte" och "får inte se" - annars blir
  // svaret ett sätt att kartlägga vilka ärenden som existerar.
  if (!row) throw notFound("Ärendet finns inte, eller är inte ditt.");
  return { status: 200, body: toCase(row) };
});

/**
 * Journalen. Läses antingen med session ELLER med API-nyckel.
 *
 * Nyckelvägen går genom `api_journal()`, som gör sin egen prövning och
 * loggar användningen. Den vägen sätter aldrig någon användaridentitet:
 * nyckeln ÄR behörigheten.
 */
router.get("/v1/cases/:caseId/journal", async (req) => {
  const caseId = uuidParam(req, "caseId");

  // Kontraktet deklarerar EN säkerhetsmekanism: Authorization: Bearer.
  // Servern läste tidigare nyckeln ur x-api-key, alltså ett huvud som
  // inte stod någonstans i det publicerade kontraktet - en integration
  // byggd på dokumentationen hade fått 401 utan att förstå varför.
  // Nyckeln känns igen på sitt prefix (clr_, satt av create_api_key);
  // allt annat är en sessionstoken.
  const credential = bearer(req);
  if (credential?.startsWith("clr_")) {
    // api_journal returnerar JSONB, inte en radmängd. Den här raden löd
    // tidigare `select * from ...` och gav klienten ett svar i formen
    // [{ api_journal: {...} }] - alltså fel form på hela nyckelvägen.
    // Ingen märkte det, eftersom ingen kontroll gick den vägen. Nu gör
    // två av dem det.
    const payload = await withAnon(async (tx) => {
      const { rows } = await tx.query<{ journal: unknown }>(
        "select public.api_journal($1, $2) as journal",
        [credential, caseId],
      );
      return rows[0]?.journal ?? null;
    });
    // Funktionen svarar med null både för okänd nyckel och för ärende
    // utan åtkomst - samma tystnad, med flit: skillnaden hjälper bara
    // den som gissar. HTTP-lagret får inte återinföra skillnaden.
    if (payload === null) throw notFound("Ärendet finns inte, eller så ger nyckeln ingen åtkomst.");
    return { status: 200, body: payload };
  }

  const caller = await authenticate(req);
  const events = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `select id, case_id, actor_user_id, actor_role, action, object_type, object_id,
              before, after, occurred_at
         from public.audit_events where case_id = $1
        order by occurred_at desc limit 500`,
      [caseId],
    );
    return rows.map(toEvent);
  });
  return { status: 200, body: { events } };
});

router.get("/v1/cases/:caseId/decisions", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const rows = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      "select * from public.case_decisions where case_id = $1 order by decided_at desc",
      [caseId],
    );
    return rows;
  });
  return { status: 200, body: { decisions: rows.map(toDecision) } };
});

const SIGNALS = ["loner", "skatt", "skuldtackning", "passerade_frister", "hyra", "leverantorer", "skuld"];
const COMPARATORS = ["minst", "hogst", "sant", "falskt"];

router.post("/v1/cases/:caseId/decisions", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const title = str(req.body, "title", { max: 200 });
  const rationale = str(req.body, "rationale", { max: 4000 });
  const premise = str(req.body, "premise", { max: 2000, required: false }) || null;

  // Villkoret prövas här OCH i databasen. Dubbelt med flit: kontrollen
  // här ger ett begripligt fel, kontrollen där gör regeln sann även för
  // den som inte går genom det här API:t.
  const raw = (req.body as Record<string, unknown> | undefined)?.watch;
  let watch: { signal: string; comparator: string; threshold: number | null } | null = null;
  if (raw !== undefined && raw !== null) {
    if (typeof raw !== "object") throw badRequest('Fältet "watch" ska vara ett objekt.');
    const w = raw as Record<string, unknown>;
    if (typeof w.signal !== "string" || !SIGNALS.includes(w.signal)) {
      throw badRequest(`"watch.signal" ska vara en av: ${SIGNALS.join(", ")}.`);
    }
    if (typeof w.comparator !== "string" || !COMPARATORS.includes(w.comparator)) {
      throw badRequest(`"watch.comparator" ska vara en av: ${COMPARATORS.join(", ")}.`);
    }
    const numeric = w.comparator === "minst" || w.comparator === "hogst";
    const threshold = w.threshold;
    if (numeric && typeof threshold !== "number") {
      throw badRequest('"watch.threshold" krävs för villkoret minst/högst.');
    }
    if (!numeric && threshold !== undefined && threshold !== null) {
      throw badRequest('"watch.threshold" hör inte till ett ja/nej-villkor.');
    }
    watch = { signal: w.signal, comparator: w.comparator, threshold: numeric ? (threshold as number) : null };
  }

  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `insert into public.case_decisions
         (case_id, decided_by, title, rationale, premise, watch_signal, watch_comparator, watch_threshold)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning *`,
      [caseId, caller.userId, title, rationale, premise, watch?.signal ?? null, watch?.comparator ?? null, watch?.threshold ?? null],
    );
    return rows[0];
  });
  return { status: 201, body: toDecision(row) };
});

router.post("/v1/decisions/:decisionId/reconsider", async (req) => {
  const caller = await authenticate(req);
  const decisionId = uuidParam(req, "decisionId");
  const note = str(req.body, "note", { max: 2000 });
  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `update public.case_decisions
          set status = 'reconsidered', reconsidered_at = now(), reconsider_note = $2
        where id = $1 returning *`,
      [decisionId, note],
    );
    return rows[0] ?? null;
  });
  if (!row) throw notFound("Beslutet finns inte, eller är inte ditt.");
  return { status: 200, body: toDecision(row) };
});

router.post("/v1/decisions/:decisionId/acknowledge-premise", async (req) => {
  const caller = await authenticate(req);
  const decisionId = uuidParam(req, "decisionId");
  const observation = str(req.body, "observation", { max: 500 });
  await withUser(caller.userId, async (tx) => {
    await tx.query("select public.acknowledge_premise($1, $2)", [decisionId, observation]);
  });
  return { status: 200, body: { acknowledged: true } };
});

/* --- Översiktens data ------------------------------------------------------
 *
 * Ingen av frågorna nedan filtrerar på användare. Radskyddet gör urvalet,
 * och att lägga en where-sats här ovanpå hade dolt ett trasigt radskydd
 * bakom applikationen - felet hade slutat synas utan att sluta finnas.
 * Ett ärende man inte når ger därför en tom lista, inte ett fel: samma
 * tystnad som resten av produkten.
 */

const caseScoped = (
  path: string,
  query: string,
  map: (row: Record<string, unknown>) => unknown,
  key: string,
) =>
  router.get(path, async (req) => {
    const caller = await authenticate(req);
    const caseId = uuidParam(req, "caseId");
    const rows = await withUser(caller.userId, async (tx) => {
      const { rows } = await tx.query(query, [caseId]);
      return rows;
    });
    return { status: 200, body: { [key]: rows.map(map) } };
  });

caseScoped(
  "/v1/cases/:caseId/tasks",
  `select id, case_id, label, due_date::text as due_date, done_at, done_by,
          source, created_at, assigned_to
     from public.case_tasks where case_id = $1 order by created_at asc`,
  toTask,
  "tasks",
);
caseScoped(
  "/v1/cases/:caseId/documents",
  `select id, case_id, kind, file_name, file_size, mime_type, source, review_status, created_at
     from public.case_documents
    where case_id = $1 and confirmed_at is not null
    order by created_at desc`,
  toDocument,
  "documents",
);
caseScoped(
  "/v1/cases/:caseId/payments",
  `select id, case_id, label, amount, category, status,
          due_date::text as due_date, recurring
     from public.payments where case_id = $1 order by due_date asc`,
  toPayment,
  "payments",
);
caseScoped(
  // Grundtråden: meddelanden utan tråd-id. Trådade hämtas per tråd, och
  // synligheten avgörs av radskyddet - inte av filtret här.
  "/v1/cases/:caseId/messages",
  `select ${MEDDELANDE_KOLUMNER}
     from public.case_messages m where m.case_id = $1 and m.conversation_id is null
    order by m.created_at asc`,
  toMessage,
  "messages",
);

caseScoped(
  "/v1/cases/:caseId/invoices",
  `select id, case_id, label, amount, direction, status,
          issue_date::text as issue_date, due_date::text as due_date, counterpart
     from public.invoices where case_id = $1 order by due_date asc`,
  toInvoice,
  "invoices",
);

router.get("/v1/cases/:caseId/kbr", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `select status, created_at from public.kbr_assessments
        where case_id = $1 order by created_at desc limit 1`,
      [caseId],
    );
    return rows[0] ?? null;
  });
  // Null och inte 404: "ingen bedömning gjord" är ett giltigt svar om
  // ärendet, inte ett fel. 404 hade blandat ihop de två.
  return {
    status: 200,
    body: row ? { status: row.status, createdAt: iso(row.created_at) } : null,
  };
});

/* --- Skrivvägarna ----------------------------------------------------------
 *
 * Samma princip som läsningarna: ingen where-sats på användaren.
 * Radskyddets INSERT- och UPDATE-policyer avgör om skrivningen får ske,
 * och en skrivning som inte får ske träffar noll rader. Därför prövas
 * utfallet - "ändrades något?" - och inte vilket lager som sa nej.
 */

router.post("/v1/cases/:caseId/tasks", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const label = str(req.body, "label", { max: 300 });
  const dueDateRaw = (req.body as Record<string, unknown> | undefined)?.dueDate;
  if (dueDateRaw !== undefined && dueDateRaw !== null && typeof dueDateRaw !== "string") {
    throw badRequest('Fältet "dueDate" ska vara ett datum som text, eller utelämnas.');
  }
  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `insert into public.case_tasks (case_id, label, due_date, source)
       values ($1, $2, $3, 'manual')
       returning id, case_id, label, due_date::text as due_date, done_at, done_by,
                 source, created_at, assigned_to`,
      [caseId, label, (dueDateRaw as string | undefined) ?? null],
    );
    return rows[0] ?? null;
  });
  if (!row) throw forbidden("Uppgiften kunde inte läggas till i det här ärendet.");
  return { status: 201, body: toTask(row) };
});

/* --- Monte Carlo: simuleringarna ----------------------------------------- */

/*
 * TRE BESLUT SOM STYR HELA DEN HÄR YTAN.
 *
 * 1. TUNGA KÖRNINGAR KÖAS, LÄTTA KÖRS DIREKT. API:t är EN process. En
 *    miljon iterationer tar dryga två sekunder - i en handler betyder det
 *    två sekunders kö för alla andras anrop. Tröskeln bor i motorn
 *    (korDirekt); köade körningar plockas av den betrodda arbetaren, samma
 *    mönster som utkorgen och aviseringarna.
 *
 * 2. MODELLEN ÄR ETT UTTRYCK, INTE KOD. Klienten skickar text som tolkas
 *    till ett träd av ett fåtal nodtyper (src/lib/montecarlo/uttryck.ts).
 *    Det finns ingen eval och ingen new Function någonstans i kedjan -
 *    annars vore varje inloggad användare en steg från exekvering i
 *    API-processen.
 *
 * 3. RÅDATA LÄMNAR ALDRIG MOTORN. Det som sparas och skickas är aggregat:
 *    statistik, sannolikheter, histogram, känslighet, konvergens. Med samma
 *    frö och samma motorversion går rådata att återskapa exakt, och en
 *    miljon flyttal per resultat har ingen i ett svar att göra.
 */

/** Taket per körning. Över det säger vi nej i stället för att ta emot en order vi inte kan hålla. */
const MAX_ITERATIONER = 1000000;

const toSimulation = (row: Record<string, unknown>) => ({
  id: row.id,
  caseId: row.case_id,
  name: row.name,
  description: row.description ?? null,
  spec: row.spec,
  specVersion: Number(row.spec_version ?? 1),
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

/**
 * En körning. `results` utelämnas i listvyer - ett histogram per körning
 * gånger femtio körningar är ett svar ingen bad om.
 */
const toRun = (row: Record<string, unknown>, medResultat = false) => ({
  id: row.id,
  simulationId: row.simulation_id,
  status: row.status,
  seed: Number(row.seed),
  engineVersion: row.engine_version,
  specVersion: Number(row.spec_version ?? 1),
  iterations: Number(row.iterations ?? 0),
  discardedIterations: Number(row.discarded_iterations ?? 0),
  durationMs: row.duration_ms === null || row.duration_ms === undefined ? null : Number(row.duration_ms),
  error: row.error ?? null,
  notes: row.notes ?? null,
  queuedAt: iso(row.queued_at),
  startedAt: iso(row.started_at),
  finishedAt: iso(row.finished_at),
  ...(medResultat ? { results: row.results ?? null, spec: row.spec } : {}),
});

/** Läser och prövar en spec ur kroppen. Kastar 400 med varje fel uppräknat. */
const lasSpec = (varde: unknown, namn: string, iterationer: number, fro: number): Simuleringsspec => {
  if (varde === null || typeof varde !== "object" || Array.isArray(varde)) {
    throw badRequest('Fältet "spec" ska vara ett objekt.');
  }
  const rå = varde as Record<string, unknown>;
  const spec: Simuleringsspec = {
    namn,
    inputs: Array.isArray(rå.inputs) ? (rå.inputs as Simuleringsspec["inputs"]) : [],
    outputs: Array.isArray(rå.outputs) ? (rå.outputs as Simuleringsspec["outputs"]) : [],
    konstanter:
      rå.konstanter && typeof rå.konstanter === "object" && !Array.isArray(rå.konstanter)
        ? (rå.konstanter as Record<string, number>)
        : {},
    iterationer,
    fro,
  };
  const fel = valideraSpec(spec);
  if (fel.length > 0) {
    // ALLA fel på en gång. Att bara visa det första gör rättningen till en
    // serie omtag, och specen kan ha tio variabler.
    throw badRequest(`Simuleringen kan inte köras: ${fel.map((f) => f.meddelande).join(" ")}`);
  }
  return spec;
};

const heltal = (body: unknown, falt: string, standard: number, min: number, max: number): number => {
  const v = (body as Record<string, unknown> | undefined)?.[falt];
  if (v === undefined || v === null) return standard;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw badRequest(`Fältet "${falt}" ska vara ett heltal mellan ${min} och ${max}.`);
  }
  return n;
};

router.get("/v1/cases/:caseId/simulations", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const rows = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `select id, case_id, name, description, spec, spec_version, created_at, updated_at
         from public.simulations where case_id = $1::uuid order by updated_at desc`,
      [caseId],
    );
    return rows;
  });
  return { status: 200, body: { simulations: rows.map(toSimulation) } };
});

router.post("/v1/cases/:caseId/simulations", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const name = str(req.body, "name", { max: 200 });
  const description = str(req.body, "description", { max: 2000, required: false }) || null;
  // Specen prövas redan här. En sparad modell som inte går att köra är en
  // fälla som ställs ut åt nästa person som öppnar ärendet.
  const spec = lasSpec((req.body as Record<string, unknown>)?.spec, name, 10000, 1);

  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `insert into public.simulations (case_id, created_by, name, description, spec)
       values ($1::uuid, $2::uuid, $3, $4, $5::jsonb)
       returning id, case_id, name, description, spec, spec_version, created_at, updated_at`,
      [
        caseId,
        caller.userId,
        name,
        description,
        JSON.stringify({ inputs: spec.inputs, outputs: spec.outputs, konstanter: spec.konstanter }),
      ],
    );
    return rows[0] ?? null;
  });
  if (!row) throw forbidden("Simuleringen kunde inte sparas i det här ärendet.");
  return { status: 201, body: toSimulation(row) };
});

router.get("/v1/simulations/:simulationId", async (req) => {
  const caller = await authenticate(req);
  const simulationId = uuidParam(req, "simulationId");
  const data = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `select id, case_id, name, description, spec, spec_version, created_at, updated_at
         from public.simulations where id = $1::uuid`,
      [simulationId],
    );
    if (!rows[0]) return null;
    const { rows: runs } = await tx.query(
      `select id, simulation_id, status, seed, engine_version, spec_version, iterations,
              discarded_iterations, duration_ms, error, notes, queued_at, started_at, finished_at
         from public.simulation_runs where simulation_id = $1::uuid
        order by queued_at desc limit 25`,
      [simulationId],
    );
    return { sim: rows[0], runs };
  });
  if (!data) throw notFound("Simuleringen finns inte.");
  return {
    status: 200,
    body: { ...toSimulation(data.sim), runs: data.runs.map((r) => toRun(r)) },
  };
});

router.patch("/v1/simulations/:simulationId", async (req) => {
  const caller = await authenticate(req);
  const simulationId = uuidParam(req, "simulationId");
  const name = str(req.body, "name", { max: 200 });
  const description = str(req.body, "description", { max: 2000, required: false }) || null;
  const spec = lasSpec((req.body as Record<string, unknown>)?.spec, name, 10000, 1);
  const row = await withUser(caller.userId, async (tx) => {
    // spec_version höjs av triggern, inte här. Två flikar som sparar
    // samtidigt skulle annars kunna skriva samma nummer.
    const { rows } = await tx.query(
      `update public.simulations set name = $2, description = $3, spec = $4::jsonb
        where id = $1::uuid
       returning id, case_id, name, description, spec, spec_version, created_at, updated_at`,
      [
        simulationId,
        name,
        description,
        JSON.stringify({ inputs: spec.inputs, outputs: spec.outputs, konstanter: spec.konstanter }),
      ],
    );
    return rows[0] ?? null;
  });
  if (!row) throw notFound("Simuleringen finns inte, eller får inte ändras.");
  return { status: 200, body: toSimulation(row) };
});

router.del("/v1/simulations/:simulationId", async (req) => {
  const caller = await authenticate(req);
  const simulationId = uuidParam(req, "simulationId");
  await withUser(caller.userId, async (tx) => {
    await tx.query("delete from public.simulations where id = $1::uuid", [simulationId]);
  });
  return { status: 200, body: { deleted: true } };
});

/**
 * Kör simuleringen.
 *
 * Fröet får anges - det är hela reproducerbarheten - och väljs annars av
 * SERVERN, en gång, och skrivs ned. Ett frö klienten slumpar per anrop hade
 * varit lika oåterskapligt som inget frö alls.
 */
router.post("/v1/simulations/:simulationId/run", async (req) => {
  const caller = await authenticate(req);
  const simulationId = uuidParam(req, "simulationId");
  const iterationer = heltal(req.body, "iterations", 10000, 100, MAX_ITERATIONER);
  const angivetFro = (req.body as Record<string, unknown> | undefined)?.seed;
  const fro =
    angivetFro === undefined || angivetFro === null
      ? nyttFro()
      : heltal(req.body, "seed", 0, 0, 4294967295);

  const sim = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      "select id, case_id, name, spec, spec_version from public.simulations where id = $1::uuid",
      [simulationId],
    );
    return rows[0] ?? null;
  });
  if (!sim) throw notFound("Simuleringen finns inte.");

  const spec = lasSpec(sim.spec, String(sim.name), iterationer, fro);
  const direkt = korDirekt(iterationer);

  const run = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `insert into public.simulation_runs
         (simulation_id, case_id, started_by, seed, engine_version, spec, spec_version,
          iterations, status, started_at)
       values ($1::uuid, $2::uuid, $3::uuid, $4::bigint, $5, $6::jsonb, $7::integer,
               $8::integer, $9::public.simulation_status, case when $9 = 'running' then now() else null end)
       returning id, simulation_id, status, seed, engine_version, spec_version, iterations,
                 discarded_iterations, duration_ms, error, notes, queued_at, started_at, finished_at`,
      [
        simulationId,
        sim.case_id,
        caller.userId,
        fro,
        MOTORVERSION,
        JSON.stringify(sim.spec),
        sim.spec_version,
        iterationer,
        direkt ? "running" : "queued",
      ],
    );
    return rows[0] ?? null;
  });
  if (!run) throw forbidden("Körningen kunde inte startas i det här ärendet.");

  if (!direkt) {
    // Köad. Arbetaren plockar den; klienten pollar GET .../results.
    return { status: 202, body: { ...toRun(run), queued: true } };
  }

  // Direktkörning. Motorn kastar bara på en spec som redan prövats, men
  // ett fel här får inte lämna raden i 'running' för evigt.
  try {
    const resultat = korSimulering(spec);
    const klar = await withUser(caller.userId, async (tx) => {
      const { rows } = await tx.query(
        // complete_own_simulation_run och inte arbetarens finish_*: den
        // här vägen körs som användaren, och funktionen grindar därför på
        // can_write_case OCH på att det är samma person som startade.
        `select public.complete_own_simulation_run($1::uuid, 'done'::public.simulation_status,
                 $2::jsonb, $3::jsonb, null, $4::integer, $5::integer) as klar`,
        [
          run.id,
          JSON.stringify({ outputs: resultat.outputs }),
          JSON.stringify(resultat.anmarkningar),
          resultat.varaktighetMs,
          resultat.forkastadeIterationer,
        ],
      );
      return rows[0]?.klar === true;
    });
    if (!klar) throw new ApiError(409, "conflict", "Körningen hann avbrytas.");
    return {
      status: 201,
      body: {
        ...toRun(run),
        status: "done",
        durationMs: resultat.varaktighetMs,
        discardedIterations: resultat.forkastadeIterationer,
        notes: resultat.anmarkningar,
        results: { outputs: resultat.outputs },
      },
    };
  } catch (error) {
    const meddelande = error instanceof Error ? error.message : "Okänt fel";
    await withUser(caller.userId, async (tx) => {
      await tx.query(
        `select public.complete_own_simulation_run($1::uuid, 'failed'::public.simulation_status,
                 null, null, $2::text, null, 0)`,
        [run.id, meddelande.slice(0, 2000)],
      );
    });
    if (error instanceof ApiError) throw error;
    throw badRequest(`Simuleringen misslyckades: ${meddelande}`);
  }
});

/**
 * Avbryter en körning som inte hunnit bli klar.
 *
 * Policyn tillåter bara övergången queued/running -> cancelled; en färdig
 * körning kan alltså inte "avbrytas" i efterhand och därmed inte heller
 * göras om till något annat än det den var.
 */
router.post("/v1/simulations/:simulationId/cancel", async (req) => {
  const caller = await authenticate(req);
  const simulationId = uuidParam(req, "simulationId");
  const antal = await withUser(caller.userId, async (tx) => {
    const { rowCount } = await tx.query(
      `update public.simulation_runs
          set status = 'cancelled', finished_at = now()
        where simulation_id = $1::uuid and status in ('queued', 'running')`,
      [simulationId],
    );
    return rowCount ?? 0;
  });
  return { status: 200, body: { cancelled: antal } };
});

/** Den senaste körningen MED resultat. Det gränssnittet ritar. */
router.get("/v1/simulations/:simulationId/results", async (req) => {
  const caller = await authenticate(req);
  const simulationId = uuidParam(req, "simulationId");
  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `select * from public.simulation_runs
        where simulation_id = $1::uuid order by queued_at desc limit 1`,
      [simulationId],
    );
    return rows[0] ?? null;
  });
  // null och inte 404: "ingen körning ännu" är ett giltigt läge om en
  // simulering, inte ett fel.
  return { status: 200, body: row ? toRun(row, true) : null };
});

/**
 * En enskild körning, i sin helhet.
 *
 * Det HÄR är granskningsvägen: frö, motorversion, specen som gällde och
 * resultatet, i ett svar. Räcker för att köra om körningen och jämföra.
 */
router.get("/v1/simulation-runs/:runId", async (req) => {
  const caller = await authenticate(req);
  const runId = uuidParam(req, "runId");
  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query("select * from public.simulation_runs where id = $1::uuid", [runId]);
    return rows[0] ?? null;
  });
  if (!row) throw notFound("Körningen finns inte.");
  return { status: 200, body: toRun(row, true) };
});

/* --- Bokföringen som lägesbild ------------------------------------------- */

/*
 * SIE-FILEN TOLKAS PÅ SERVERN, INTE I WEBBLÄSAREN.
 *
 * Klienten kan redan tolka SIE - den gör det för att förifylla ett
 * formulär, och det är rätt plats för just det. Men lägesbilden som SPARAS
 * är underlag: den ligger till grund för insikterna på översikten, för
 * rapporten som visas för en bank och för bedömningen av om bolaget ska
 * rekonstrueras eller sättas i konkurs. Ett underlag som klienten själv
 * sätter ihop är ett underlag klienten kan skriva vad som helst i.
 *
 * Servern får därför FILEN, inte lägesbilden. Den tolkar den, översätter
 * den och skriver resultatet. Det som lagras går alltid att härleda till
 * bytesen som skickades in.
 *
 * Parsern (src/lib/financial/sie.ts) är beroendefri och delas därför rakt
 * av - samma mönster som auditDetail, retention och källorna.
 */

/** Filen får väga lika mycket som en uppladdning. Samma tak, samma skäl. */
const MAX_SIE_BYTES = 25 * 1024 * 1024;

router.post("/v1/cases/:caseId/financial/sie", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const b = (req.body ?? {}) as Record<string, unknown>;

  const fileName = str(req.body, "fileName", { max: 260 });
  if (typeof b.content !== "string" || b.content.length === 0) {
    throw badRequest('Fältet "content" saknas (filens innehåll, base64-kodat).');
  }
  // Base64 växer 4/3; taket prövas på den avkodade storleken, som är den
  // som betyder något.
  if (b.content.length > Math.ceil((MAX_SIE_BYTES * 4) / 3) + 16) {
    throw badRequest("Filen är för stor.");
  }
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(Buffer.from(b.content, "base64"));
  } catch {
    throw badRequest('Fältet "content" är inte giltig base64.');
  }
  if (bytes.length === 0) throw badRequest("Filen är tom.");
  if (bytes.length > MAX_SIE_BYTES) throw badRequest("Filen är för stor.");

  const utfall = parseSie(bytes);
  if (!utfall.ok) {
    // Parserns egen förklaring går vidare ordagrant. Den är skriven för en
    // människa som ska förstå vad som är fel med sin fil.
    throw badRequest(`Filen kunde inte tolkas som SIE: ${utfall.error}`);
  }

  // Tidpunkten sätts av servern. En capturedAt klienten väljer hade gjort
  // det möjligt att backdatera en lägesbild.
  const capturedAt = new Date().toISOString();
  const snapshot = snapshotFromSie(utfall.sie, { fileName, capturedAt });
  const sourceDocumentId = valfrittId(req.body, "sourceDocumentId");

  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `insert into public.financial_snapshots
         (case_id, user_id, provider, captured_at, org_number, company_name,
          fiscal_year_start, fiscal_year_end, source_file_name,
          source_document_id, payload)
       values ($1::uuid, $2::uuid, 'generic', $3::timestamptz, $4, $5,
               $6::date, $7::date, $8, $9::uuid, $10::jsonb)
       returning id, captured_at, payload`,
      [
        caseId,
        caller.userId,
        capturedAt,
        utfall.sie.orgNumber,
        utfall.sie.companyName,
        utfall.sie.fiscalYear?.start ?? null,
        utfall.sie.fiscalYear?.end ?? null,
        fileName,
        sourceDocumentId,
        JSON.stringify(snapshot),
      ],
    );
    return rows[0] ?? null;
  });
  if (!row) throw forbidden("Lägesbilden kunde inte sparas i det här ärendet.");

  return {
    status: 201,
    body: {
      id: row.id,
      capturedAt: iso(row.captured_at),
      snapshot: row.payload,
      // Vad som INTE gick att läsa, sagt rakt ut i svaret och inte bara
      // begravt i dokumentet.
      skippedLines: utfall.sie.skipped.length,
    },
  };
});

router.get("/v1/cases/:caseId/financial/snapshot", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `select payload from public.financial_snapshots
        where case_id = $1::uuid order by captured_at desc limit 1`,
      [caseId],
    );
    return rows[0] ?? null;
  });
  // null betyder "vi har inte läst något", inte "det finns inget".
  // Kontraktet måste kunna säga skillnaden - se FinancialPort.
  return { status: 200, body: row ? row.payload : null };
});

/* --- Likviditeten: betalningar och fakturor ------------------------------ */

/*
 * TVÅ SAKER SERVERN ÄGER I DE HÄR RUTTERNA.
 *
 * 1. user_id. Klienten skickade det förut som ett fält i varje rad
 *    (`NewPayment & { userId }`), vilket är ett fält att ljuga i. Det tas
 *    numera ur den prövade sessionen. Radskyddet hade ändå stoppat en
 *    skrivning i annans ärende - can_write_case(case_id) - men user_id är
 *    den kolumn som säger VEM som förde in raden, och den ska inte gå att
 *    peka om.
 *
 * 2. case_id. Det står i sökvägen, inte i kroppen. En lista där rad tre
 *    bär ett annat ärende än rutten hade varit en skrivning på två ställen
 *    i ett anrop.
 *
 * Beloppen och datumen prövas här och inte bara i formuläret: ett datum i
 * fel form når annars databasen som ett kastat typfel mitt i en insert,
 * och ett NaN-belopp blir en rad ingen kan tolka.
 */

const PAYMENT_KATEGORIER = ["salary", "tax", "rent", "supplier", "loan", "other"] as const;
const PAYMENT_STATUSAR = ["pending", "paid", "overdue"] as const;
const INVOICE_RIKTNINGAR = ["in", "out"] as const;
const INVOICE_STATUSAR = ["unpaid", "paid", "overdue"] as const;

/** Ett belopp i kronor: ändligt, inte negativt, och avrundat till ören. */
const belopp = (rad: Record<string, unknown>, falt: string): number => {
  const n = Number(rad[falt]);
  if (!Number.isFinite(n) || n < 0) throw badRequest(`Fältet "${falt}" ska vara ett tal ≥ 0.`);
  return Math.round(n * 100) / 100;
};

const datumFalt = (rad: Record<string, unknown>, falt: string): string => {
  const v = rad[falt];
  if (typeof v !== "string" || !ISO_DATE.test(v)) {
    throw badRequest(`Fältet "${falt}" ska vara ett datum på formen yyyy-MM-dd.`);
  }
  return v;
};

const text = (rad: Record<string, unknown>, falt: string, max: number): string => {
  const v = rad[falt];
  if (typeof v !== "string" || v.trim().length === 0) {
    throw badRequest(`Fältet "${falt}" saknas.`);
  }
  if (v.trim().length > max) throw badRequest(`Fältet "${falt}" är längre än ${max} tecken.`);
  return v.trim();
};

const ettAv = <T extends string>(rad: Record<string, unknown>, falt: string, giltiga: readonly T[]): T => {
  const v = rad[falt];
  if (typeof v !== "string" || !(giltiga as readonly string[]).includes(v)) {
    throw badRequest(`Fältet "${falt}" ska vara en av: ${giltiga.join(", ")}.`);
  }
  return v as T;
};

/** Raderna ur kroppen. Ett tak, för en lista utan tak är en gratis minnesattack. */
const rader = (body: unknown, max = 200): Record<string, unknown>[] => {
  const v = (body as Record<string, unknown> | undefined)?.rows;
  if (!Array.isArray(v)) throw badRequest('Fältet "rows" ska vara en lista.');
  if (v.length > max) throw badRequest(`Högst ${max} rader per anrop.`);
  return v.map((r) => {
    if (typeof r !== "object" || r === null) throw badRequest('"rows" ska innehålla objekt.');
    return r as Record<string, unknown>;
  });
};

router.post("/v1/cases/:caseId/payments", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const inRader = rader(req.body);
  if (inRader.length === 0) return { status: 201, body: { payments: [] } };
  const rows = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `insert into public.payments (case_id, user_id, label, amount, category, status, due_date, recurring)
       select $1::uuid, $2::uuid, x.label, x.amount, x.category::payment_category,
              x.status::payment_status, x.due_date::date, x.recurring
         from jsonb_to_recordset($3::jsonb)
              as x(label text, amount numeric, category text, status text,
                   due_date text, recurring boolean)
       returning id, case_id, label, amount, category, status,
                 due_date::text as due_date, recurring`,
      [
        caseId,
        caller.userId,
        JSON.stringify(
          inRader.map((r) => ({
            label: text(r, "label", 300),
            amount: belopp(r, "amount"),
            category: ettAv(r, "category", PAYMENT_KATEGORIER),
            status: ettAv(r, "status", PAYMENT_STATUSAR),
            due_date: datumFalt(r, "dueDate"),
            recurring: r.recurring === true,
          })),
        ),
      ],
    );
    return rows;
  });
  // Noll rader = radskyddet sa nej. Utfallet prövas, inte vilket lager.
  if (rows.length === 0) throw forbidden("Betalningarna kunde inte skrivas i det här ärendet.");
  return { status: 201, body: { payments: rows.map(toPayment) } };
});

router.patch("/v1/payments/:paymentId", async (req) => {
  const caller = await authenticate(req);
  const paymentId = uuidParam(req, "paymentId");
  const status = ettAv((req.body ?? {}) as Record<string, unknown>, "status", PAYMENT_STATUSAR);
  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `update public.payments set status = $2::payment_status where id = $1::uuid
       returning id, case_id, label, amount, category, status,
                 due_date::text as due_date, recurring`,
      [paymentId, status],
    );
    return rows[0] ?? null;
  });
  if (!row) throw notFound("Betalningen finns inte, eller får inte ändras.");
  return { status: 200, body: toPayment(row) };
});

router.post("/v1/cases/:caseId/invoices", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const inRader = rader(req.body);
  if (inRader.length === 0) return { status: 201, body: { invoices: [] } };
  const rows = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `insert into public.invoices (case_id, user_id, label, amount, direction, status,
                                    issue_date, due_date, counterpart)
       select $1::uuid, $2::uuid, x.label, x.amount, x.direction::invoice_direction,
              x.status::invoice_status, x.issue_date::date, x.due_date::date, x.counterpart
         from jsonb_to_recordset($3::jsonb)
              as x(label text, amount numeric, direction text, status text,
                   issue_date text, due_date text, counterpart text)
       returning id, case_id, label, amount, direction, status,
                 issue_date::text as issue_date, due_date::text as due_date, counterpart`,
      [
        caseId,
        caller.userId,
        JSON.stringify(
          inRader.map((r) => ({
            label: text(r, "label", 300),
            amount: belopp(r, "amount"),
            direction: ettAv(r, "direction", INVOICE_RIKTNINGAR),
            status: ettAv(r, "status", INVOICE_STATUSAR),
            issue_date: datumFalt(r, "issueDate"),
            due_date: datumFalt(r, "dueDate"),
            counterpart:
              r.counterpart === null || r.counterpart === undefined || r.counterpart === ""
                ? null
                : text(r, "counterpart", 200),
          })),
        ),
      ],
    );
    return rows;
  });
  if (rows.length === 0) throw forbidden("Fakturorna kunde inte skrivas i det här ärendet.");
  return { status: 201, body: { invoices: rows.map(toInvoice) } };
});

router.patch("/v1/invoices/:invoiceId", async (req) => {
  const caller = await authenticate(req);
  const invoiceId = uuidParam(req, "invoiceId");
  const status = ettAv((req.body ?? {}) as Record<string, unknown>, "status", INVOICE_STATUSAR);
  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `update public.invoices set status = $2::invoice_status where id = $1::uuid
       returning id, case_id, label, amount, direction, status,
                 issue_date::text as issue_date, due_date::text as due_date, counterpart`,
      [invoiceId, status],
    );
    return rows[0] ?? null;
  });
  if (!row) throw notFound("Fakturan finns inte, eller får inte ändras.");
  return { status: 200, body: toInvoice(row) };
});

/**
 * Kontrollbalansbedömningen sparas PÅ ETT ÄRENDE.
 *
 * DEN HÄR RUTTEN FINNS FÖR ATT DET INTE GICK ATT SPARA ALLS.
 * kbr_assessments radskydd är can_write_case(case_id), och klienten
 * skickade case_id som null - can_write_case(null) är falskt, så varje
 * sparning avvisades. Vyn fångade felet och skrev "Kunde inte spara
 * analysen just nu. Försök igen." Varje gång, för alla. Demoadaptern är
 * lokal och gjorde rätt, så ingen såg det.
 *
 * Att lägga ärendet i SÖKVÄGEN är rättningen som inte kan glömmas bort:
 * det finns ingen väg att anropa den utan att ange vilket ärende
 * bedömningen gäller.
 */
router.post("/v1/cases/:caseId/kbr", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const b = (req.body ?? {}) as Record<string, unknown>;
  const valfriText = (falt: string, max: number): string | null => {
    const v = b[falt];
    if (v === null || v === undefined || v === "") return null;
    if (typeof v !== "string") throw badRequest(`Fältet "${falt}" ska vara text.`);
    if (v.trim().length > max) throw badRequest(`Fältet "${falt}" är längre än ${max} tecken.`);
    return v.trim();
  };
  const valfriFlagga = (falt: string): boolean | null => {
    const v = b[falt];
    if (v === null || v === undefined) return null;
    if (typeof v !== "boolean") throw badRequest(`Fältet "${falt}" ska vara sant, falskt eller null.`);
    return v;
  };
  const status = ettAv(b, "status", ["not_required", "warning", "required", "critical"] as const);

  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `insert into public.kbr_assessments
         (user_id, case_id, org_number, company_name, ambition_level,
          has_related_companies, is_part_of_larger_structure,
          share_capital, total_assets, total_liabilities, status)
       values ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11::kbr_status)
       returning id, status, created_at`,
      [
        caller.userId,
        caseId,
        valfriText("orgNumber", 20),
        valfriText("companyName", 200),
        valfriText("ambitionLevel", 40),
        valfriFlagga("hasRelatedCompanies"),
        valfriFlagga("isPartOfLargerStructure"),
        belopp(b, "shareCapital"),
        belopp(b, "totalAssets"),
        belopp(b, "totalLiabilities"),
        status,
      ],
    );
    return rows[0] ?? null;
  });
  if (!row) throw forbidden("Bedömningen kunde inte sparas i det här ärendet.");
  return { status: 201, body: { id: row.id, status: row.status, createdAt: iso(row.created_at) } };
});

router.post("/v1/cases/:caseId/tasks/seed", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const raw = (req.body ?? {}) as Record<string, unknown>;
  if (!Array.isArray(raw.labels)) throw badRequest('Fältet "labels" ska vara en lista.');
  const labels = raw.labels.filter((l): l is string => typeof l === "string" && l.trim().length > 0);
  if (labels.length > 0) {
    // on conflict do nothing mot det unika indexet (case_id, label): två
    // flikar som sår rekommendationerna samtidigt ger EN lista, inte två.
    await withUser(caller.userId, async (tx) => {
      await tx.query(
        `insert into public.case_tasks (case_id, label, source)
         select $1, unnest($2::text[]), 'recommendation'
         on conflict (case_id, label) do nothing`,
        [caseId, labels],
      );
    });
  }
  return { status: 200, body: { seeded: labels.length } };
});

router.post("/v1/tasks/:taskId/done", async (req) => {
  const caller = await authenticate(req);
  const taskId = uuidParam(req, "taskId");
  const doneRaw = (req.body as Record<string, unknown> | undefined)?.done;
  if (typeof doneRaw !== "boolean") throw badRequest('Fältet "done" ska vara true eller false.');
  const row = await withUser(caller.userId, async (tx) => {
    // Tidpunkten sätts av SERVERN, aldrig av klienten: en tidsstämpel som
    // den som bockar av får välja är inte bevis på när något gjordes.
    // Vem OCH när sätts tillsammans - ett halvt svar på "vem gjorde vad
    // när" är inget svar (samma regel som tabellens check-villkor).
    const { rows } = await tx.query(
      doneRaw
        ? `update public.case_tasks set done_at = now(), done_by = $2 where id = $1 returning *`
        : `update public.case_tasks set done_at = null, done_by = null where id = $1 returning *`,
      doneRaw ? [taskId, caller.userId] : [taskId],
    );
    return rows[0] ?? null;
  });
  if (!row) throw notFound("Uppgiften finns inte, eller är inte din.");
  return { status: 200, body: toTask(row) };
});

router.post("/v1/tasks/:taskId/assign", async (req) => {
  const caller = await authenticate(req);
  const taskId = uuidParam(req, "taskId");
  const raw = (req.body as Record<string, unknown> | undefined)?.userId;
  if (raw !== null && typeof raw !== "string") {
    throw badRequest('Fältet "userId" ska vara ett id, eller null för att ta bort tilldelningen.');
  }
  if (typeof raw === "string" && !UUID.test(raw)) throw badRequest('"userId" är inte ett giltigt id.');
  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      "update public.case_tasks set assigned_to = $2 where id = $1 returning *",
      [taskId, raw],
    );
    return rows[0] ?? null;
  });
  if (!row) throw notFound("Uppgiften finns inte, eller är inte din.");
  return { status: 200, body: toTask(row) };
});

router.post("/v1/cases/:caseId/messages", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const body = str(req.body, "body", { max: 8000 });
  // De tre valfria: tråden, bilagan och den som förväntas svara.
  // author_user_id sätts av servern ur den prövade sessionen - att låta
  // klienten skriva det fältet vore att låta vem som helst signera i
  // någon annans namn i ett ärende de redan har tillträde till.
  const conversationId = valfrittId(req.body, "conversationId");
  const attachmentDocumentId = valfrittId(req.body, "attachmentDocumentId");
  const expectsReplyFrom = valfrittId(req.body, "expectsReplyFrom");
  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `with ny as (
         insert into public.case_messages
           (case_id, author_user_id, body, conversation_id, attachment_document_id, expects_reply_from)
         values ($1::uuid, $2::uuid, $3::text, $4::uuid, $5::uuid, $6::uuid)
         returning *
       )
       select ${MEDDELANDE_KOLUMNER} from ny m`,
      [caseId, caller.userId, body, conversationId, attachmentDocumentId, expectsReplyFrom],
    );
    return rows[0] ?? null;
  });
  if (!row) throw forbidden("Meddelandet kunde inte skickas i det här ärendet.");
  return { status: 201, body: toMessage(row) };
});

/* --- Trådarna: direkt, grupp, kvittens och notiscentret ------------------- */

/*
 * INGEN AV RUTTERNA HÄR GÖR SIN EGEN BEHÖRIGHETSKONTROLL, och det är
 * avsiktligt. Gränsen bor i databasen: conversations och
 * conversation_participants har policyer byggda på
 * is_conversation_participant() och has_case_access(), merge_conversations
 * är SECURITY DEFINER och självgrindad, och message_acks styrs av
 * can_see_message(). En skrivning som inte får ske träffar noll rader, och
 * det är utfallet som prövas - inte vilket lager som sa nej.
 */

router.get("/v1/conversations/:conversationId/messages", async (req) => {
  const caller = await authenticate(req);
  const conversationId = uuidParam(req, "conversationId");
  const rows = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `select ${MEDDELANDE_KOLUMNER}
         from public.case_messages m where m.conversation_id = $1::uuid
        order by m.created_at asc`,
      [conversationId],
    );
    return rows;
  });
  // En tråd man inte deltar i ger TOMT, inte 403: skillnaden mellan
  // "finns inte" och "får inte se" är i sig en uppgift.
  return { status: 200, body: { messages: rows.map(toMessage) } };
});

router.post("/v1/messages/:messageId/read", async (req) => {
  const caller = await authenticate(req);
  const messageId = uuidParam(req, "messageId");
  // Tidpunkten sätts av servern. Ett läskvitto klienten daterar själv är
  // inget kvitto.
  await withUser(caller.userId, async (tx) => {
    await tx.query(
      "update public.case_messages set read_at = now() where id = $1::uuid and read_at is null",
      [messageId],
    );
  });
  return { status: 200, body: { read: true } };
});

router.post("/v1/messages/:messageId/ack", async (req) => {
  const caller = await authenticate(req);
  const messageId = uuidParam(req, "messageId");
  await withUser(caller.userId, async (tx) => {
    // on conflict do nothing: ett dubbelklick är ingen nyhet att
    // rapportera. Kvittensen kan ALDRIG tas tillbaka - det finns med flit
    // ingen väg att radera raden här.
    await tx.query(
      `insert into public.message_acks (message_id, user_id)
       values ($1::uuid, $2::uuid) on conflict do nothing`,
      [messageId, caller.userId],
    );
  });
  return { status: 200, body: { acked: true } };
});

router.get("/v1/cases/:caseId/conversations", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const rows = await withUser(caller.userId, async (tx) => {
    // Namnen hämtas i samma fråga. Supabase-adaptern gör tre rundturer
    // (trådar, deltagare, medlemslista) och sätter ihop dem i klienten;
    // här räcker en, och den kan inte visa mer än radskyddet släpper fram.
    const { rows } = await tx.query(
      `select c.id, c.case_id, c.kind, c.title, c.created_by, c.created_at, c.merged_into,
              coalesce(
                (select json_agg(json_build_object(
                          'user_id', p.user_id,
                          'display_name', up.display_name)
                        order by p.created_at)
                   from public.conversation_participants p
                   left join public.user_profiles up on up.user_id = p.user_id
                  where p.conversation_id = c.id),
                '[]'::json
              ) as participants
         from public.conversations c
        where c.case_id = $1::uuid
        order by c.created_at asc`,
      [caseId],
    );
    return rows;
  });
  return { status: 200, body: { conversations: rows.map(toConversation) } };
});

router.post("/v1/cases/:caseId/conversations", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const kind = str(req.body, "kind");
  if (kind !== "direct" && kind !== "group") {
    throw badRequest('Fältet "kind" ska vara "direct" eller "group".');
  }

  const deltagare: string[] = [];
  let title: string | null = null;
  if (kind === "direct") {
    const otherUserId = valfrittId(req.body, "otherUserId");
    if (!otherUserId) throw badRequest('Fältet "otherUserId" saknas.');
    if (otherUserId === caller.userId) throw badRequest("En direkt tråd behöver en motpart.");
    deltagare.push(otherUserId);
  } else {
    title = str(req.body, "title", { max: 120 });
    if (title.length < 2) throw badRequest('Fältet "title" ska vara minst 2 tecken.');
    const raw = (req.body as Record<string, unknown> | undefined)?.participantUserIds;
    if (!Array.isArray(raw)) throw badRequest('Fältet "participantUserIds" ska vara en lista.');
    if (raw.length > 50) throw badRequest("En grupptråd tar högst 50 deltagare.");
    for (const value of raw) {
      if (typeof value !== "string" || !UUID.test(value)) {
        throw badRequest('"participantUserIds" ska innehålla id:n.');
      }
      deltagare.push(value);
    }
  }

  const id = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `insert into public.conversations (case_id, kind, title, created_by)
       values ($1::uuid, $2::text, $3::text, $4::uuid) returning id`,
      [caseId, kind, title, caller.userId],
    );
    const nyId = rows[0]?.id as string | undefined;
    if (!nyId) return null;
    // Skaparen är alltid med. En tråd man inte själv deltar i går inte att
    // läsa efteråt - och då hade skrivningen varit ett tyst tapp.
    const unika = Array.from(new Set([caller.userId, ...deltagare]));
    await tx.query(
      `insert into public.conversation_participants (conversation_id, user_id, added_by)
       select $1::uuid, x, $2::uuid from unnest($3::uuid[]) as x
       on conflict do nothing`,
      [nyId, caller.userId, unika],
    );
    return nyId;
  });
  if (!id) throw forbidden("Tråden kunde inte skapas i det här ärendet.");
  return { status: 201, body: { id } };
});

router.post("/v1/conversations/:conversationId/merge", async (req) => {
  const caller = await authenticate(req);
  const from = uuidParam(req, "conversationId");
  const to = valfrittId(req.body, "into");
  if (!to) throw badRequest('Fältet "into" saknas.');
  // merge_conversations prövar själv att båda är grupptrådar i samma
  // ärende och att anroparen deltar. Den kastar; felmappningen gör 409.
  await withUser(caller.userId, async (tx) => {
    await tx.query("select public.merge_conversations($1::uuid, $2::uuid)", [from, to]);
  });
  return { status: 200, body: { merged: true } };
});

router.get("/v1/mentions", async (req) => {
  const caller = await authenticate(req);
  const rows = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query("select * from public.my_open_mentions()");
    return rows;
  });
  return { status: 200, body: { mentions: rows.map(toMention) } };
});

/**
 * En kortlivad, signerad nedladdnings-URL för ett dokument.
 *
 * DEN ENDA behörighetsfrågan är app.may_read_document(): en signerad URL
 * kringgår all databasbehörighet, så den får aldrig signeras utan ett `true`
 * därifrån. storage_path lämnar ALDRIG servern - bara den signerade URL:en,
 * och den går ut på 60 sekunder. Okänt dokument och dokument man inte får se
 * ger samma svar (404), så rutten inte röjer vilka id:n som finns.
 */
router.get("/v1/documents/:documentId/url", async (req) => {
  const caller = await authenticate(req);
  const documentId = uuidParam(req, "documentId");
  if (!storageConfigured()) {
    throw notFound("Dokumentlagringen är inte ansluten i den här driften.");
  }
  const row = await withUser(caller.userId, async (tx) => {
    const may = await tx.query("select app.may_read_document($1) as ok", [documentId]);
    if (may.rows[0]?.ok !== true) return null;
    const doc = await tx.query(
      "select storage_path, file_name from public.case_documents where id = $1",
      [documentId],
    );
    return doc.rows[0] ?? null;
  });
  if (!row) throw notFound("Dokumentet finns inte, eller är inte ditt.");
  const url = await presignDocument(String(row.storage_path), String(row.file_name ?? "dokument"));
  return { status: 200, body: { url, fileName: row.file_name, expiresInSeconds: DOCUMENT_URL_TTL_SECONDS } };
});


/* --- Uppladdning: servern prövar vad som FAKTISKT lagrades ------------- */

/*
 * Uppladdningen sker i två steg, och det andra är hela poängen.
 *
 * STEG 1 ger en kortlivad, signerad PUT-URL för en sökväg SERVERN valt.
 * Klienten kan alltså bara skriva till sitt eget ärendes prefix - aldrig
 * till någon annans, och aldrig till en sökväg den hittat på själv.
 *
 * STEG 2 läser tillbaka filens första bytes ur lagringen och prövar dem.
 * Det är skillnaden mellan en kontroll och en artighet: filnamnet,
 * ändelsen och Content-Type är allt sådant avsändaren själv skriver, och
 * en .pdf som egentligen är en Linux-binär ser likadan ut i alla tre. Bara
 * bytesen avslöjar den, och bara de bytes som verkligen hamnade i hinken.
 *
 * Godkänns den inte TAS DEN BORT, och dokumentraden blir aldrig synlig.
 * En avvisad fil ska inte ligga kvar och vänta på någon som glömmer varför.
 */

router.post("/v1/cases/:caseId/documents", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  if (!storageConfigured()) throw notFound("Dokumentlagringen är inte ansluten i den här driften.");

  const fileName = str(req.body, "fileName", { max: 300 });
  const mimeType = str(req.body, "mimeType", { max: 200, required: false }) || "application/octet-stream";
  const raw = (req.body ?? {}) as Record<string, unknown>;
  const uppgivenStorlek = Number(raw.fileSize);
  if (!Number.isFinite(uppgivenStorlek) || uppgivenStorlek <= 0 || uppgivenStorlek > MAX_FILSTORLEK) {
    throw badRequest(`Filen måste vara mellan 1 byte och ${Math.floor(MAX_FILSTORLEK / 1024 / 1024)} MB.`);
  }
  // Ändelsen och den utlovade typen prövas REDAN HÄR - inte för att det är
  // ett skydd (det är det inte), utan för att slippa be om en uppladdning
  // vi ändå kommer att avvisa. Den riktiga prövningen sker i steg 2.
  const forhandsbesked = provaMetadata({
    filnamn: fileName,
    mimetyp: mimeType,
    storlek: uppgivenStorlek,
  });
  if (!forhandsbesked.ok) throw badRequest(forhandsbesked.skal);

  const storagePath = sakerLagringsvag(caseId, fileName, randomUUID());
  // Raden skapas som EJ BEKRÄFTAD. Radskyddet avgör om den får skapas alls
  // (can_write_case via case_documents-policyn) - ingen egen bedömning här.
  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `insert into public.case_documents
         (case_id, user_id, kind, file_name, file_size, mime_type, storage_path, source, confirmed_at)
       values ($1, $2, 'other', $3, $4, $5, $6, 'manual', null)
       returning id, storage_path`,
      [caseId, caller.userId, fileName, uppgivenStorlek, mimeType, storagePath],
    );
    return rows[0] ?? null;
  });
  if (!row) throw forbidden("Dokumentet kunde inte läggas till i det här ärendet.");

  const url = await presignUpload(storagePath, mimeType);
  return {
    status: 201,
    body: { documentId: row.id, uploadUrl: url, expiresInSeconds: UPLOAD_URL_TTL_SECONDS },
  };
});

router.post("/v1/documents/:documentId/confirm", async (req) => {
  const caller = await authenticate(req);
  const documentId = uuidParam(req, "documentId");
  if (!storageConfigured()) throw notFound("Dokumentlagringen är inte ansluten i den här driften.");

  // Samma fråga som nedladdningen ställer: får den här läsaren röra
  // dokumentet? Utan den kunde vem som helst bekräfta någon annans rad.
  const dok = await withUser(caller.userId, async (tx) => {
    // true = även obekräftade: det är precis den raden som ska prövas här.
    const may = await tx.query("select app.may_read_document($1, true) as ok", [documentId]);
    if (may.rows[0]?.ok !== true) return null;
    const r = await tx.query(
      "select id, storage_path, file_name, mime_type, confirmed_at from public.case_documents where id = $1",
      [documentId],
    );
    return r.rows[0] ?? null;
  });
  if (!dok) throw notFound("Dokumentet finns inte, eller är inte ditt.");
  if (dok.confirmed_at) return { status: 200, body: { confirmed: true, typ: null } };

  const huvud = await laesHuvud(String(dok.storage_path));
  if (!huvud) throw badRequest("Filen har inte laddats upp.");
  const bytes = await laesForstaBytes(String(dok.storage_path));
  if (!bytes) throw badRequest("Filen gick inte att läsa.");

  const besked = provaFil({
    filnamn: String(dok.file_name),
    mimetyp: String(dok.mime_type ?? ""),
    // DEN LAGRADE storleken, inte den uppgivna.
    storlek: huvud.storlek,
    bytes,
  });

  if (!besked.ok) {
    // Bort ur hinken OCH ur tabellen. En avvisad fil får inte ligga kvar.
    await taBortObjekt(String(dok.storage_path)).catch(() => undefined);
    await withUser(caller.userId, async (tx) => {
      await tx.query("delete from public.case_documents where id = $1", [documentId]);
    });
    throw badRequest(besked.skal);
  }

  await withUser(caller.userId, async (tx) => {
    await tx.query(
      "update public.case_documents set confirmed_at = now(), file_size = $2 where id = $1",
      [documentId, huvud.storlek],
    );
  });
  return { status: 200, body: { confirmed: true, typ: besked.typ } };
});

router.post("/v1/documents/:documentId/review", async (req) => {
  const caller = await authenticate(req);
  const documentId = uuidParam(req, "documentId");
  const action = str(req.body, "action", { max: 20 });
  if (!["request", "approve", "reset"].includes(action)) {
    throw badRequest('Fältet "action" ska vara request, approve eller reset.');
  }
  // Genom funktionen: rollprövningen (godkännande kräver rådgivarroll)
  // bor där, inte här. Ett API som gör sin egen bedömning vid sidan om
  // blir en andra sanning som glider isär från den första.
  await withUser(caller.userId, async (tx) => {
    await tx.query("select public.set_document_review($1, $2)", [documentId, action]);
  });
  return { status: 200, body: { reviewed: true } };
});

/* --- Kontaktinkorgen ------------------------------------------------------- */

/*
 * Kontaktformuläret är sajtens ENDA skrivbara yta för oinloggade, och
 * inkorgen bakom det är läsbar bara för driftadministratörer. Båda
 * gränserna bor i databasen (contact_messages: öppen insert på utvalda
 * kolumner, RLS-läsning via is_platform_admin) - rutterna här sätter aldrig
 * status, user_id eller handläggare från klientens data. Det är själva
 * poängen: en avsändare ska inte kunna tillskriva sig ett annat konto eller
 * stänga sitt eget ärende genom att posta direkt mot API:et.
 */

router.post("/v1/contact", async (req) => {
  // Får ske utan inloggning. Är avsändaren ändå inloggad fäster kolumnens
  // default meddelandet vid kontot - därför withUser när vi har en identitet
  // (då läser auth.uid() app.user_id), annars withAnon (då blir user_id null).
  const caller = await optionalCaller(req);
  const topic = str(req.body, "topic", { max: 40, required: false }) || "question";
  if (!CONTACT_TOPICS.includes(topic)) {
    throw badRequest(`Fältet "topic" ska vara en av: ${CONTACT_TOPICS.join(", ")}.`);
  }
  const values = [
    str(req.body, "name", { max: 200 }),
    str(req.body, "email", { max: 320 }),
    str(req.body, "phone", { max: 40, required: false }) || null,
    str(req.body, "company", { max: 200, required: false }) || null,
    topic,
    str(req.body, "message", { max: 5000 }),
  ];
  // BARA avsändarens egna kolumner. status, user_id och handled_* utelämnas
  // med flit - kolumnrättigheten (grant insert (...)) skulle neka dem ändå.
  const insert = (tx: Tx) =>
    tx.query(
      `insert into public.contact_messages (name, email, phone, company, topic, message)
       values ($1, $2, $3, $4, $5, $6)`,
      values,
    );
  if (caller) await withUser(caller.userId, insert);
  else await withAnon(insert);
  return { status: 201, body: { submitted: true } };
});

router.get("/v1/contact/admin-status", async (req) => {
  const caller = await authenticate(req);
  // Gränssnittsbeslut, inte säkerhetsgräns: den riktiga gränsen är RLS. Om
  // det här svaret vore fel vore inkorgen ändå tom för en icke-administratör.
  const isAdmin = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query("select public.is_platform_admin() as ok");
    return rows[0]?.ok === true;
  });
  return { status: 200, body: { isAdmin } };
});

router.get("/v1/contact", async (req) => {
  const caller = await authenticate(req);
  // Ingen egen administratörskontroll: RLS ger en icke-administratör noll
  // rader, och det är rätt svar. Behörigheten hålls i databasen, inte av att
  // rutten gissar rätt.
  const rows = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      "select * from public.contact_messages order by created_at desc",
    );
    return rows;
  });
  return { status: 200, body: { messages: rows.map(toContactMessage) } };
});

router.post("/v1/contact/:id/status", async (req) => {
  const caller = await authenticate(req);
  const id = uuidParam(req, "id");
  const status = str(req.body, "status", { max: 20 });
  if (!CONTACT_STATUSES.includes(status)) {
    throw badRequest(`Fältet "status" ska vara en av: ${CONTACT_STATUSES.join(", ")}.`);
  }
  // Handläggaren sätts av SERVERN till den inloggade, aldrig av klienten -
  // och bara när ärendet tas ur "new". CHECK-villkoret kräver att handled_by
  // och handled_at sätts tillsammans eller inte alls.
  const closing = status !== "new";
  const handledBy = closing ? caller.userId : null;
  // "internalNote" i kroppen = uppdatera anteckningen (även till null för att
  // rensa den). Saknas fältet lämnas den orörd.
  const touchNote = req.body !== null && typeof req.body === "object" && "internalNote" in req.body;
  const note = touchNote ? (str(req.body, "internalNote", { max: 5000, required: false }) || null) : null;

  const updated = await withUser(caller.userId, async (tx) => {
    const { rowCount } = touchNote
      ? await tx.query(
          `update public.contact_messages
              set status = $2,
                  handled_by = $3,
                  handled_at = case when $4 then now() else null end,
                  internal_note = $5
            where id = $1`,
          [id, status, handledBy, closing, note],
        )
      : await tx.query(
          `update public.contact_messages
              set status = $2,
                  handled_by = $3,
                  handled_at = case when $4 then now() else null end
            where id = $1`,
          [id, status, handledBy, closing],
        );
    return (rowCount ?? 0) > 0;
  });
  // 0 rader = finns inte ELLER så är den som frågar inte administratör. Samma
  // tystnad: en icke-administratör ska inte kunna avläsa att inkorgen finns.
  if (!updated) throw notFound("Meddelandet finns inte, eller är inte ditt att handlägga.");
  return { status: 200, body: { updated: true } };
});

/* --- Ärendets deltagare och inbjudningar ---------------------------------- */

/*
 * Deltagarna och inbjudningarna. Behörigheten bor i SECURITY DEFINER-
 * funktionerna (invite_to_case, accept_case_invitation m.fl.): rutterna
 * gör ingen egen bedömning, de anropar funktionen och låter has_case_role
 * avgöra. Inbjudans säkerhetsmodell är att ADRESSEN är nyckeln, inte
 * länken - peek och accept lyckas bara när den inloggades adress matchar,
 * och svarar med samma neutrala tystnad som lösenordsåterställningen för
 * alla andra.
 */

router.get("/v1/cases/:caseId/members", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  // list_case_members prövar has_case_access själv och ger noll rader åt den
  // som inte tillhör ärendet - ingen egen kontroll behövs här.
  const rows = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query("select * from public.list_case_members($1)", [caseId]);
    return rows;
  });
  return { status: 200, body: { members: rows.map((r) => toMember(r, caseId)) } };
});

router.get("/v1/cases/:caseId/invitations", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const rows = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      "select * from public.case_invitations where case_id = $1 order by created_at desc",
      [caseId],
    );
    return rows;
  });
  return { status: 200, body: { invitations: rows.map(toInvitation) } };
});

router.post("/v1/cases/:caseId/invitations", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const email = str(req.body, "email", { max: 320 }).toLowerCase();
  const role = str(req.body, "role", { max: 40 });
  // Prövas här bara för att ett skräpvärde ska ge 400, inte ett enum-kast.
  // Att 'owner'/'creditor' inte får bjudas in är databasens constraint (400).
  if (!CASE_ROLES.includes(role)) throw badRequest('Fältet "role" ska vara en giltig ärenderoll.');
  const invitationId = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query("select public.invite_to_case($1, $2, $3) as id", [caseId, email, role]);
    return rows[0]?.id ?? null;
  });
  return { status: 201, body: { invitationId } };
});

router.post("/v1/invitations/:invitationId/revoke", async (req) => {
  const caller = await authenticate(req);
  const invitationId = uuidParam(req, "invitationId");
  await withUser(caller.userId, async (tx) => {
    await tx.query("select public.revoke_case_invitation($1)", [invitationId]);
  });
  return { status: 200, body: { revoked: true } };
});

router.get("/v1/invitations/:invitationId", async (req) => {
  const caller = await authenticate(req);
  const invitationId = uuidParam(req, "invitationId");
  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query("select * from public.peek_case_invitation($1)", [invitationId]);
    return rows[0] ?? null;
  });
  // null = finns inte, är utgången, eller ställd till en annan adress. Ett
  // giltigt svar, inte ett fel - samma neutrala tystnad för alla andra.
  return { status: 200, body: { invitation: row ? toInvitationPeek(row) : null } };
});

router.post("/v1/invitations/:invitationId/accept", async (req) => {
  const caller = await authenticate(req);
  const invitationId = uuidParam(req, "invitationId");
  // Adressen avgör: funktionen kastar om den inloggades adress inte matchar,
  // om inbjudan är återkallad, använd eller utgången (blir 409).
  const caseId = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query("select public.accept_case_invitation($1) as case_id", [invitationId]);
    return rows[0]?.case_id ?? null;
  });
  return { status: 200, body: { caseId } };
});

/* --- Rådgivarens klientverktyg: anteckningar och tidsposter --------------- */

/*
 * Byråns EGNA arbetsmaterial, inte ärendekommunikation: en anteckning är
 * synlig bara för sin författare, en tidspost bara för den som lade den -
 * inte för bolaget, inte för andra deltagare, inte ens för en annan
 * rådgivare i samma ärende. Hela den gränsen bor i radskyddet
 * (author_user_id = auth.uid()); rutterna filtrerar bara på ärende och
 * skrivningen kräver aktivt deltagande (has_case_role). Ska något delas
 * finns meddelandena.
 */

router.get("/v1/cases/:caseId/notes", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const rows = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      "select * from public.case_notes where case_id = $1 order by created_at desc",
      [caseId],
    );
    return rows;
  });
  return { status: 200, body: { notes: rows.map(toNote) } };
});

router.post("/v1/cases/:caseId/notes", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const body = str(req.body, "body", { max: 4000 });
  // author_user_id sätts av kolumnens default (auth.uid()), aldrig av
  // klienten - RLS kräver dessutom att den matchar den inloggade.
  const noteId = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      "insert into public.case_notes (case_id, body) values ($1, $2) returning id",
      [caseId, body],
    );
    return rows[0]?.id ?? null;
  });
  return { status: 201, body: { noteId } };
});

router.del("/v1/notes/:noteId", async (req) => {
  const caller = await authenticate(req);
  const noteId = uuidParam(req, "noteId");
  // Idempotent: RLS släpper bara författarens egen rad, och en delete som
  // inte träffar något är inget fel - anteckningen är borta hur som helst.
  await withUser(caller.userId, async (tx) => {
    await tx.query("delete from public.case_notes where id = $1", [noteId]);
  });
  return { status: 200, body: { deleted: true } };
});

router.get("/v1/cases/:caseId/time-entries", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const rows = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `select id, case_id, minutes, note, occurred_on::text as occurred_on, created_at
         from public.time_entries where case_id = $1 order by occurred_on desc`,
      [caseId],
    );
    return rows;
  });
  return { status: 200, body: { entries: rows.map(toTimeEntry) } };
});

router.post("/v1/cases/:caseId/time-entries", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const raw = (req.body ?? {}) as Record<string, unknown>;
  const minutes = typeof raw.minutes === "number" ? raw.minutes : Number(raw.minutes);
  if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 1440) {
    throw badRequest('Fältet "minutes" ska vara ett heltal mellan 1 och 1440.');
  }
  const note = str(req.body, "note", { max: 500, required: false }) || null;
  const occurredOn = str(req.body, "occurredOn", { max: 10, required: false }) || null;
  if (occurredOn && !ISO_DATE.test(occurredOn)) {
    throw badRequest('Fältet "occurredOn" ska vara ett datum på formen ÅÅÅÅ-MM-DD.');
  }
  const entryId = await withUser(caller.userId, async (tx) => {
    const { rows } = occurredOn
      ? await tx.query(
          "insert into public.time_entries (case_id, minutes, note, occurred_on) values ($1, $2, $3, $4) returning id",
          [caseId, minutes, note, occurredOn],
        )
      : await tx.query(
          "insert into public.time_entries (case_id, minutes, note) values ($1, $2, $3) returning id",
          [caseId, minutes, note],
        );
    return rows[0]?.id ?? null;
  });
  return { status: 201, body: { entryId } };
});

router.del("/v1/time-entries/:entryId", async (req) => {
  const caller = await authenticate(req);
  const entryId = uuidParam(req, "entryId");
  await withUser(caller.userId, async (tx) => {
    await tx.query("delete from public.time_entries where id = $1", [entryId]);
  });
  return { status: 200, body: { deleted: true } };
});

/* --- Rådgivarsamtalen (journal) ------------------------------------------- */

/*
 * Samtalen med krisrådgivaren är ärendets berättelse, inte privat kladd:
 * de LÄSES av alla med ärendeåtkomst (has_case_access) och SKRIVS av dem
 * som får arbeta i ärendet (can_write_case) - observatörer läser men
 * skriver inte. Samma samtal sparas flera gånger medan det pågår, därför
 * en upsert på klientens session-id.
 */

router.get("/v1/cases/:caseId/sessions", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const rows = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      "select * from public.advisor_sessions where case_id = $1 order by started_at desc",
      [caseId],
    );
    return rows;
  });
  return { status: 200, body: { sessions: rows.map(toSession) } };
});

router.post("/v1/cases/:caseId/sessions", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const raw = (req.body ?? {}) as Record<string, unknown>;
  const id = typeof raw.id === "string" && UUID.test(raw.id) ? raw.id : null;
  if (!id) throw badRequest('Fältet "id" ska vara ett giltigt id (samtalet äger sitt eget id).');
  const flowId = str(req.body, "flowId", { max: 40 });
  const flowTitle = str(req.body, "flowTitle", { max: 120 });
  const startedAt = str(req.body, "startedAt", { max: 40 });
  const closedAt = str(req.body, "closedAt", { max: 40, required: false }) || null;
  if (!Array.isArray(raw.entries)) throw badRequest('Fältet "entries" ska vara en lista.');
  // Upsert på samtalets id: RLS kräver can_write_case både för insert och
  // update, så en observatör (läsrätt utan skrivrätt) blockeras av radskyddet.
  await withUser(caller.userId, async (tx) => {
    await tx.query(
      `insert into public.advisor_sessions (id, case_id, flow_id, flow_title, started_at, closed_at, entries)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb)
       on conflict (id) do update set
         flow_id = excluded.flow_id,
         flow_title = excluded.flow_title,
         started_at = excluded.started_at,
         closed_at = excluded.closed_at,
         entries = excluded.entries`,
      [id, caseId, flowId, flowTitle, startedAt, closedAt, JSON.stringify(raw.entries)],
    );
  });
  return { status: 200, body: { saved: true, sessionId: id } };
});

/* --- API-nycklar för det öppna API:t -------------------------------------- */

/*
 * Nyckelvalvets regler, som schemat redan bär: hemligheten LAGRAS ALDRIG -
 * bara en SHA-256-hash och ett synligt prefix, och den visas EN gång i
 * skapandeögonblicket. Nycklar raderas inte, de återkallas (spårbarheten är
 * löftet). Skapandet går genom create_api_key (security definer) så att
 * generering och hashning sker i databasen; hemligheten passerar aldrig
 * någon annan lagring.
 */

router.get("/v1/api-keys", async (req) => {
  const caller = await authenticate(req);
  const rows = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `select id, label, key_prefix, created_at, last_used_at, revoked_at
         from public.api_keys order by created_at desc`,
    );
    return rows;
  });
  return { status: 200, body: { keys: rows.map(toApiKey) } };
});

/*
 * Att mynta en nyckel kräver lösenordet. Nyckeln överlever sessionen:
 * den som loggar ut, byter lösenord och återkallar sina sessioner har
 * fortfarande en giltig nyckel liggande hos den som hann skapa den.
 * Skapandet är därför en farligare åtgärd än det ser ut som.
 */
router.post("/v1/api-keys", async (req) => {
  const caller = await authenticate(req);
  await confirmPassword(caller, req);
  const label = str(req.body, "label", { max: 80 });
  if (label.length < 3) throw badRequest('Fältet "label" ska vara minst 3 tecken.');
  const created = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query("select * from public.create_api_key($1)", [label]);
    return rows[0] ?? null;
  });
  if (!created) throw new ApiError(500, "internal_error", "Nyckeln kunde inte skapas.");
  // Hemligheten returneras EN gång och lagras aldrig. Prefixet är det enda
  // som går att läsa igen.
  return {
    status: 201,
    body: {
      record: {
        id: created.id,
        label,
        keyPrefix: created.key_prefix,
        createdAt: iso(created.created_at),
        lastUsedAt: null,
        revokedAt: null,
      },
      secret: created.secret,
    },
  };
});

/*
 * Återkallandet kräver INTE lösenordet, med flit. Bekräftelser hör hemma
 * före det som ökar en angripares räckvidd, inte före det som minskar
 * den. Den som misstänker att en nyckel läckt ska kunna stänga den på en
 * sekund, även från en telefon där lösenordet ligger i en lösenordsapp
 * hen inte kommer åt just då. Skadan en angripare kan göra här är att
 * stänga av kontots egna integrationer - obehagligt, men reparerbart, och
 * hen kan ändå göra det genom att låta bli att skydda nyckeln.
 */
router.post("/v1/api-keys/:keyId/revoke", async (req) => {
  const caller = await authenticate(req);
  const keyId = uuidParam(req, "keyId");
  // Idempotent och trigger-vänligt: rör bara en icke-återkallad nyckel. RLS
  // ser till att det bara är den egna nyckeln.
  await withUser(caller.userId, async (tx) => {
    await tx.query(
      "update public.api_keys set revoked_at = now() where id = $1 and revoked_at is null",
      [keyId],
    );
  });
  return { status: 200, body: { revoked: true } };
});

/* --- Aviseringsinställningarna -------------------------------------------- */

/*
 * TVÅ SAKER SOM INTE LÄMNAR SERVERN.
 *
 * 1. HELA MOBILNUMRET. GET /v1/notifications/phone svarar med `masked`,
 *    aldrig med e164. En skärmdump av inställningarna ska inte lämna ut
 *    numret, och maskningen görs här - inte i webbläsaren, där den bara
 *    hade varit en kosmetika ovanpå ett svar som redan bar hela numret.
 *
 * 2. VERIFIERINGSKODEN. POST /v1/notifications/phone svarar `{ sent: true }`
 *    och ingenting mer. Koden föds i start_phone_verification, hashas där,
 *    och går ut som SMS. Klienten kan varken välja den eller läsa den -
 *    vilket är hela skälet till att ett verifierat nummer betyder något.
 *    Se migration 20260822100000.
 */

const AVISERINGSNIVAER = ["alla", "atgard", "tidskritiska"] as const;

const toNotificationPrefs = (row: Record<string, unknown>) => ({
  level: row.level,
  emailEnabled: row.email_enabled === true,
  smsEnabled: row.sms_enabled === true,
  quietStartHour: Number(row.quiet_start_hour ?? 0),
  quietEndHour: Number(row.quiet_end_hour ?? 0),
});

const toDelivery = (row: Record<string, unknown>) => ({
  id: row.id,
  channel: row.channel,
  status: row.status,
  title: (row.title as string | null) ?? "Avisering",
  createdAt: iso(row.created_at),
  sentAt: iso(row.sent_at),
  // Ett kvitto utan skäl är ett kvitto som ljuger genom att tiga: den
  // undertryckta raden ska säga varför den inte gick ut.
  reason: (row.suppressed_reason as string | null) ?? (row.last_error as string | null) ?? null,
});

/**
 * Numret till E.164, eller null.
 *
 * Samma regel som normalisePhone() i klienten, med avsikt skriven en gång
 * till här i stället för delad: klientens version finns för att kunna säga
 * till i inmatningsfältet medan någon skriver, serverns för att avgöra vad
 * som faktiskt sparas. Den som tar bort den här och litar på klientens har
 * flyttat en regel till en plats där angriparen skriver koden.
 *
 * Fasta nummer godtas inte: ett SMS till en fast telefon kommer aldrig
 * fram, och ett tyst misslyckande är värre än ett nej.
 */
const normaliseraSvensktMobilnummer = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^[+\d\s()-]+$/.test(trimmed)) return null;
  let siffror = trimmed.replace(/[^\d+]/g, "");
  if (siffror.startsWith("+46")) siffror = siffror.slice(3);
  else if (siffror.startsWith("0046")) siffror = siffror.slice(4);
  else if (siffror.startsWith("46") && !siffror.startsWith("460")) siffror = siffror.slice(2);
  else if (siffror.startsWith("0")) siffror = siffror.slice(1);
  else return null;
  if (siffror.includes("+")) return null;
  if (!/^7\d{8}$/.test(siffror)) return null;
  return `+46${siffror}`;
};

/** Maskerat nummer. Samma form som maskPhone() i klienten, men här är det bindande. */
const maskeraNummer = (e164: string): string => {
  const m = /^\+46(\d{3})\d{4}(\d{2})$/.exec(e164);
  if (!m) return "•••";
  return `+46 ${m[1]} •• •• ${m[2]}`;
};

const timme = (body: unknown, field: string): number => {
  const value = (body as Record<string, unknown> | undefined)?.[field];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 23) {
    throw badRequest(`Fältet "${field}" ska vara ett heltal 0-23.`);
  }
  return value;
};

const flagga = (body: unknown, field: string): boolean => {
  const value = (body as Record<string, unknown> | undefined)?.[field];
  if (typeof value !== "boolean") throw badRequest(`Fältet "${field}" ska vara sant eller falskt.`);
  return value;
};

router.get("/v1/notifications/prefs", async (req) => {
  const caller = await authenticate(req);
  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `select level, email_enabled, sms_enabled, quiet_start_hour, quiet_end_hour
         from public.notification_prefs limit 1`,
    );
    return rows[0] ?? null;
  });
  // null och inte ett påhittat standardvärde: gränssnittet skiljer på
  // "har inte valt" och "har valt precis det som råkar vara standard".
  return { status: 200, body: row ? toNotificationPrefs(row) : null };
});

router.put("/v1/notifications/prefs", async (req) => {
  const caller = await authenticate(req);
  const level = str(req.body, "level");
  if (!(AVISERINGSNIVAER as readonly string[]).includes(level)) {
    throw badRequest(`"level" ska vara en av: ${AVISERINGSNIVAER.join(", ")}.`);
  }
  const emailEnabled = flagga(req.body, "emailEnabled");
  const smsEnabled = flagga(req.body, "smsEnabled");
  const quietStartHour = timme(req.body, "quietStartHour");
  const quietEndHour = timme(req.body, "quietEndHour");

  await withUser(caller.userId, async (tx) => {
    // user_id sätts av servern ur den prövade sessionen, aldrig ur kroppen.
    // Den som fick skriva raden åt någon annan hade kunnat stänga av deras
    // aviseringar - och en avisering som inte kommer är den tystnad hela
    // produkten finns för att förhindra.
    await tx.query(
      `insert into public.notification_prefs
         (user_id, level, email_enabled, sms_enabled, quiet_start_hour, quiet_end_hour, updated_at)
       values ($1::uuid, $2, $3, $4, $5, $6, now())
       on conflict (user_id) do update
         set level = excluded.level,
             email_enabled = excluded.email_enabled,
             sms_enabled = excluded.sms_enabled,
             quiet_start_hour = excluded.quiet_start_hour,
             quiet_end_hour = excluded.quiet_end_hour,
             updated_at = now()`,
      [caller.userId, level, emailEnabled, smsEnabled, quietStartHour, quietEndHour],
    );
  });
  return { status: 200, body: { saved: true } };
});

router.get("/v1/notifications/phone", async (req) => {
  const caller = await authenticate(req);
  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      "select e164, verified_at, code_expires_at from public.verified_phones limit 1",
    );
    return rows[0] ?? null;
  });
  if (!row) return { status: 200, body: null };
  return {
    status: 200,
    body: {
      masked: maskeraNummer(String(row.e164)),
      verified: row.verified_at !== null,
      awaitingCode:
        row.verified_at === null &&
        row.code_expires_at !== null &&
        new Date(String(row.code_expires_at)) > new Date(),
    },
  };
});

router.post("/v1/notifications/phone", async (req) => {
  const caller = await authenticate(req);
  const phone = str(req.body, "phone", { max: 32 });
  // Normaliseringen görs här också. Klienten gör den för att kunna säga
  // till i fältet; servern gör den för att den är det som faktiskt gäller.
  const e164 = normaliseraSvensktMobilnummer(phone);
  if (!e164) throw badRequest("Skriv ett svenskt mobilnummer, till exempel 070-123 45 67.");
  await withUser(caller.userId, async (tx) => {
    await tx.query("select public.start_phone_verification($1::text, $2::integer)", [e164, 10]);
  });
  // Ingen kod i svaret. Inte ens maskerad, inte ens dess längd.
  return { status: 200, body: { sent: true } };
});

router.post("/v1/notifications/phone/confirm", async (req) => {
  const caller = await authenticate(req);
  const code = str(req.body, "code", { max: 12 });
  // En kod som inte kan vara rätt kostar inget försök - varken här eller
  // i funktionen. Att bränna ett av fem försök på en felskrivning hade
  // gjort spärren till ett hinder för användaren i stället för för gissaren.
  if (!/^\d{6}$/.test(code)) return { status: 200, body: { verified: false } };
  const ok = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query("select public.confirm_phone_verification($1::text) as ok", [
      code,
    ]);
    return rows[0]?.ok === true;
  });
  return { status: 200, body: { verified: ok } };
});

router.del("/v1/notifications/phone", async (req) => {
  const caller = await authenticate(req);
  await withUser(caller.userId, async (tx) => {
    await tx.query("select public.remove_phone()");
  });
  return { status: 200, body: { removed: true } };
});

router.get("/v1/notifications/deliveries", async (req) => {
  const caller = await authenticate(req);
  const raw = Number(req.query.get("limit") ?? 20);
  // Taket är serverns, inte klientens. `limit=100000` är annars en väg att
  // dra hela tabellen genom en enda request.
  const limit = Number.isInteger(raw) && raw > 0 ? Math.min(raw, 100) : 20;
  const rows = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `select d.id, d.channel, d.status, d.suppressed_reason, d.last_error,
              d.created_at, d.sent_at, e.title
         from public.notification_deliveries d
         left join public.notification_events e on e.id = d.event_id
        order by d.created_at desc
        limit $1`,
      [limit],
    );
    return rows;
  });
  return { status: 200, body: { deliveries: rows.map(toDelivery) } };
});

/* --- Drift (/ops): allt admin-gatat i databasen --------------------------- */

/*
 * Driftpanelens skrivvägar. INGEN av rutterna gör sin egen
 * administratörskontroll: gränsen bor i databasen - RPC:erna kastar
 * "Kräver driftbehörighet" om is_platform_admin() är falskt (blir 409), och
 * app_settings har admin-only skrivpolicyer (blir 403). Nyckelvalvets regel
 * är hårdast: en sparad hemlighet kan ALDRIG läsas tillbaka, bara de fyra
 * sista tecknen och bytesdatum.
 */

// Nyckelvalvet
router.get("/v1/ops/secrets", async (req) => {
  const caller = await authenticate(req);
  const rows = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query("select * from public.list_integration_secrets()");
    return rows;
  });
  return { status: 200, body: { secrets: rows.map(toSecretInfo) } };
});

router.post("/v1/ops/secrets", async (req) => {
  const caller = await authenticate(req);
  const provider = str(req.body, "provider", { max: 60 });
  if (!SECRET_PROVIDER.test(provider)) throw badRequest('Fältet "provider" ska vara en enkel leverantörsnyckel.');
  const secret = str(req.body, "secret", { max: 4000 });
  await withUser(caller.userId, async (tx) => {
    await tx.query("select public.set_integration_secret($1, $2)", [provider, secret]);
    // Spåret bär leverantören, aldrig hemligheten - annars flyttas valvet
    // till loggen.
    await tx.query("select app.logga_driftatgard($1, $2, $3, $4::jsonb)", [
      "drift.secret.set", "integration_secret", provider, JSON.stringify({ provider }),
    ]);
  });
  return { status: 200, body: { saved: true } };
});

router.del("/v1/ops/secrets/:provider", async (req) => {
  const caller = await authenticate(req);
  const provider = req.params.provider;
  if (!SECRET_PROVIDER.test(provider)) throw badRequest("Ogiltig leverantörsnyckel.");
  await withUser(caller.userId, async (tx) => {
    await tx.query("select public.delete_integration_secret($1)", [provider]);
    await tx.query("select app.logga_driftatgard($1, $2, $3, $4::jsonb)", [
      "drift.secret.delete", "integration_secret", provider, JSON.stringify({ provider }),
    ]);
  });
  return { status: 200, body: { deleted: true } };
});

// Rådgivarnas avgifter och planer
router.get("/v1/ops/professional-terms", async (req) => {
  const caller = await authenticate(req);
  const rows = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query("select * from public.list_professional_terms()");
    return rows;
  });
  return { status: 200, body: { terms: rows.map(toProfessionalTerms) } };
});

router.post("/v1/ops/professionals/:professionalId/referral-fee", async (req) => {
  const caller = await authenticate(req);
  const professionalId = uuidParam(req, "professionalId");
  const raw = (req.body ?? {}) as Record<string, unknown>;
  // null = avgiften nollställs (faktureras ej). Ett tal = avtalad avgift i kr.
  let feeSek: number | null = null;
  if (raw.feeSek !== null && raw.feeSek !== undefined) {
    const n = Number(raw.feeSek);
    if (!Number.isFinite(n) || n < 0) throw badRequest('Fältet "feeSek" ska vara ett tal ≥ 0 eller null.');
    feeSek = Math.round(n);
  }
  await withUser(caller.userId, async (tx) => {
    await tx.query("select public.set_referral_fee($1, $2)", [professionalId, feeSek]);
    await tx.query("select app.logga_driftatgard($1, $2, $3, $4::jsonb)", [
      "drift.referral_fee.set", "professional", professionalId, JSON.stringify({ feeSek }),
    ]);
  });
  return { status: 200, body: { saved: true } };
});

router.get("/v1/ops/billing-plans", async (req) => {
  const caller = await authenticate(req);
  const rows = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query("select * from public.billing_plans");
    return rows;
  });
  return { status: 200, body: { plans: rows.map(toBillingPlan) } };
});

router.post("/v1/ops/billing-plans", async (req) => {
  const caller = await authenticate(req);
  const raw = (req.body ?? {}) as Record<string, unknown>;
  const professionalId = typeof raw.professionalId === "string" && UUID.test(raw.professionalId) ? raw.professionalId : null;
  if (!professionalId) throw badRequest('Fältet "professionalId" ska vara ett giltigt id.');
  const planKind = str(req.body, "planKind", { max: 20 });
  if (!PLAN_KINDS.includes(planKind)) throw badRequest(`Fältet "planKind" ska vara en av: ${PLAN_KINDS.join(", ")}.`);
  const num = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) throw badRequest("Avgifterna ska vara tal ≥ 0 eller null.");
    return Math.round(n);
  };
  const unlockFeeSek = num(raw.unlockFeeSek);
  const monthlyFeeSek = num(raw.monthlyFeeSek);
  await withUser(caller.userId, async (tx) => {
    await tx.query("select public.set_billing_plan($1, $2, $3, $4)", [
      professionalId,
      planKind,
      unlockFeeSek,
      monthlyFeeSek,
    ]);
    await tx.query("select app.logga_driftatgard($1, $2, $3, $4::jsonb)", [
      "drift.billing_plan.set", "professional", professionalId,
      JSON.stringify({ planKind, unlockFeeSek, monthlyFeeSek }),
    ]);
  });
  return { status: 200, body: { saved: true } };
});

router.post("/v1/ops/professionals/:professionalId/billing-hold", async (req) => {
  const caller = await authenticate(req);
  const professionalId = uuidParam(req, "professionalId");
  const raw = (req.body ?? {}) as Record<string, unknown>;
  if (typeof raw.hold !== "boolean") throw badRequest('Fältet "hold" ska vara true eller false.');
  const reason = str(req.body, "reason", { max: 500, required: false }) || null;
  await withUser(caller.userId, async (tx) => {
    await tx.query("select public.set_billing_hold($1, $2, $3)", [professionalId, raw.hold, reason]);
    await tx.query("select app.logga_driftatgard($1, $2, $3, $4::jsonb)", [
      "drift.billing_hold.set", "professional", professionalId,
      JSON.stringify({ hold: raw.hold, reason }),
    ]);
  });
  return { status: 200, body: { saved: true } };
});

router.post("/v1/ops/professionals/:professionalId/billing-shadow", async (req) => {
  const caller = await authenticate(req);
  const professionalId = uuidParam(req, "professionalId");
  const raw = (req.body ?? {}) as Record<string, unknown>;
  if (typeof raw.shadow !== "boolean") throw badRequest('Fältet "shadow" ska vara true eller false.');
  await withUser(caller.userId, async (tx) => {
    await tx.query("select public.set_billing_shadow($1, $2)", [professionalId, raw.shadow]);
    await tx.query("select app.logga_driftatgard($1, $2, $3, $4::jsonb)", [
      "drift.billing_shadow.set", "professional", professionalId, JSON.stringify({ shadow: raw.shadow }),
    ]);
  });
  return { status: 200, body: { saved: true } };
});

// Företagsplanens pris (driftparameter i app_settings)
router.post("/v1/ops/company-plan", async (req) => {
  const caller = await authenticate(req);
  const raw = (req.body ?? {}) as Record<string, unknown>;
  const monthly = Number(raw.monthlyExVatSek);
  if (!Number.isFinite(monthly) || monthly <= 0) throw badRequest('Fältet "monthlyExVatSek" ska vara ett tal > 0.');
  const opt = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) throw badRequest("Beloppen ska vara tal ≥ 0 eller null.");
    return Math.round(n);
  };
  const value = {
    monthly_ex_vat_sek: Math.round(monthly),
    business_ex_vat_sek: opt(raw.businessExVatSek),
    enterprise_ex_vat_sek: opt(raw.enterpriseExVatSek),
  };
  // app_settings-skrivning kräver is_platform_admin (RLS) → 403 för andra.
  await withUser(caller.userId, async (tx) => {
    await tx.query(
      `insert into public.app_settings (key, value) values ('company_plan', $1::jsonb)
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [JSON.stringify(value)],
    );
    await tx.query("select app.logga_driftatgard($1, $2, $3, $4::jsonb)", [
      "drift.company_plan.set", "app_settings", "company_plan", JSON.stringify(value),
    ]);
  });
  return { status: 200, body: { saved: true } };
});

// Gallringspolicyn: standarden i koden, driftens override ovanpå
router.get("/v1/ops/retention-policy", async (req) => {
  const caller = await authenticate(req);
  // Läsbar utan admin - policyn är transparens, inte en hemlighet. app_settings
  // är publikt läsbar; standarden bor i koden och overriden läggs ovanpå.
  const overrides = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query("select value from public.app_settings where key = 'retention_policy'");
    const raw = rows[0]?.value as { overrides?: RetentionOverride[] } | undefined;
    return Array.isArray(raw?.overrides) ? raw!.overrides : [];
  });
  return { status: 200, body: { policy: mergeRetentionPolicy(DEFAULT_RETENTION, overrides) } };
});

router.post("/v1/ops/retention-policy", async (req) => {
  const caller = await authenticate(req);
  const raw = (req.body ?? {}) as Record<string, unknown>;
  if (!Array.isArray(raw.overrides)) throw badRequest('Fältet "overrides" ska vara en lista.');
  // EN TRASIG GALLRINGSPOLICY SPARAS INTE. Negativa månader ger ett brytdatum
  // i framtiden, och ett brytdatum i framtiden gallrar allt; ett felstavat id
  // sparas i dag som "saved: true" utan att någonsin göra något. Båda avvisas
  // med skäl, så drift ser vad som var fel i stället för att tro att det gick.
  const problem = retentionOverrideProblems(DEFAULT_RETENTION, raw.overrides as RetentionOverride[]);
  if (problem.length > 0) {
    throw new ApiError(400, "bad_request", `Gallringspolicyn avvisades: ${problem
      .map((p) => `${p.id}.${p.falt} - ${p.skal}`)
      .join("; ")}`);
  }
  // Skrivningen kräver is_platform_admin (app_settings RLS). Att slå på skarp
  // gallring är ett medvetet beslut - därför en admin-gatad skrivväg.
  await withUser(caller.userId, async (tx) => {
    await tx.query(
      `insert into public.app_settings (key, value) values ('retention_policy', $1::jsonb)
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [JSON.stringify({ overrides: raw.overrides })],
    );
    await tx.query("select app.logga_driftatgard($1, $2, $3, $4::jsonb)", [
      "drift.retention_policy.set", "app_settings", "retention_policy",
      JSON.stringify({ overrides: raw.overrides }),
    ]);
  });
  return { status: 200, body: { saved: true } };
});

// Driftens revisionsspår: vem gjorde vad, på plattformsnivå.
router.get("/v1/ops/audit", async (req) => {
  const caller = await authenticate(req);
  // case_id is null = driftåtgärd. Radskyddet ger en icke-administratör noll
  // rader; ingen egen kontroll behövs här.
  const rows = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `select id, actor_user_id, action, object_type, object_id, after, occurred_at
         from public.audit_events
        -- Namnrymden "drift." skiljer driftåtgärder från de trigger-skrivna
        -- händelser som råkar sakna ärende (t.ex. en profiluppdatering).
        -- Utan den blir "driftens revisionsspår" en blandning.
        where case_id is null and action like 'drift.%'
        order by occurred_at desc
        limit 200`,
    );
    return rows;
  });
  return {
    status: 200,
    body: {
      events: rows.map((r) => ({
        id: String(r.id),
        actorUserId: r.actor_user_id ?? null,
        action: r.action,
        objectType: r.object_type,
        objectId: r.object_id ?? null,
        detaljer: r.after ?? null,
        occurredAt: iso(r.occurred_at),
      })),
    },
  };
});

// North Star och churn
router.get("/v1/ops/north-star", async (req) => {
  const caller = await authenticate(req);
  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query("select * from public.north_star_counts()");
    return rows[0] ?? {};
  });
  return {
    status: 200,
    body: {
      recovered: Number(row.recovered ?? 0),
      inHealth: Number(row.in_health ?? 0),
      badChurn: Number(row.bad_churn ?? 0),
      openCases: Number(row.open_cases ?? 0),
    },
  };
});

/* --- Fakturering och kontostatus ------------------------------------------ */

/*
 * Kundens egen kontostatus och fakturor, plus driftens kundöversikt och
 * utkorg. Radskyddet bär gränsen: en kund ser BARA sina egna rader,
 * administratören ser alla. Företagsplanens pris är en driftparameter
 * (app_settings), aldrig en kodrad - reserven är betabeslutet.
 *
 * OBS: issueInvoice och registerPayment ligger ännu kvar hos den gamla
 * adaptern - de köar dessutom en momsfaktura/kvitto i utkorgen, vilket
 * kräver att e-postmallarna flyttas till serversidan. Det är nästa steg
 * för den här porten (MIGRATED_PORTS listar exakt vad som är flyttat).
 */

router.get("/v1/billing/mine", async (req) => {
  const caller = await authenticate(req);
  // Gratisveckan börjar när kontot först ANVÄNDS, inte när ett skript körs -
  // därför skapas raden lat, av kunden själv, vid första anropet.
  const row = await withUser(caller.userId, async (tx) => {
    const got = await tx.query("select * from public.account_billing where user_id = $1", [caller.userId]);
    if (got.rows[0]) return got.rows[0];
    const ins = await tx.query("insert into public.account_billing (user_id) values ($1) returning *", [caller.userId]);
    return ins.rows[0];
  });
  return { status: 200, body: { billing: toBilling(row) } };
});

router.get("/v1/billing/invoices", async (req) => {
  const caller = await authenticate(req);
  const rows = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      "select * from public.customer_invoices order by issued_at desc",
    );
    return rows;
  });
  return { status: 200, body: { invoices: rows.map(toCustomerInvoice) } };
});

/*
 * PRISLISTAN ÄR PUBLICERAD, OCH MÅSTE NÅ DEN SOM INTE ÄR INLOGGAD.
 *
 * Den här rutten krävde en session. Landningssidan visar priset för
 * utloggade besökare (src/components/landing/Pricing.tsx), så på
 * AWS-vägen fick de 401 och sidan föll tillbaka på DEFAULT_COMPANY_PLAN -
 * det inkompilerade betabeslutet. Driften kunde alltså ändra priset i
 * /admin utan att en enda utloggad besökare såg ändringen, tyst, och
 * regeln "priset är en driftparameter" gällde bara innanför inloggningen.
 *
 * Frågan är låst till EN nyckel, och det är avsiktligt. withAnon är inte
 * anonym i databasen: den kör som API:ets egen roll, som ärver
 * `authenticated` och därför ser hela app_settings. Det som avgränsar
 * svaret här är alltså frågans text, inte radskyddet - så den ska vara
 * smal och stå kvar smal.
 */
router.get("/v1/billing/company-plan", async () => {
  const raw = await withAnon(async (tx) => {
    const { rows } = await tx.query("select value from public.app_settings where key = 'company_plan'");
    return rows[0]?.value as
      | { monthly_ex_vat_sek?: number; business_ex_vat_sek?: number | null; enterprise_ex_vat_sek?: number | null }
      | undefined;
  });
  /*
   * RESERVEN KOMMER UR DEN ENDA KÄLLAN, inte ur tre kopior.
   *
   * Här stod 985/2780/4500 skrivna rakt av - och samma tre tal stod i
   * demoadaptern och i supabase-adaptern. DEFAULT_COMPANY_PLAN i
   * src/lib/pricing.ts var alltså kanonisk bara för ytan; datavägen hade
   * sina egna siffror. Ändrades betabeslutet på ett ställe fortsatte de
   * andra två leverera det gamla priset, tyst, och regeln "inga
   * hårdkodade priser" var uppfylld på pappret men inte i praktiken.
   */
  return {
    status: 200,
    body: {
      monthlyExVatSek: raw?.monthly_ex_vat_sek ?? DEFAULT_COMPANY_PLAN.monthlyExVatSek,
      businessExVatSek: raw?.business_ex_vat_sek ?? DEFAULT_COMPANY_PLAN.businessExVatSek ?? null,
      enterpriseExVatSek: raw?.enterprise_ex_vat_sek ?? DEFAULT_COMPANY_PLAN.enterpriseExVatSek ?? null,
    },
  };
});

router.get("/v1/billing/customers", async (req) => {
  const caller = await authenticate(req);
  // Radskyddet filtrerar: en icke-admin får sina egna rader, vilket är rätt
  // svar och inte ett fel. E-post ligger i auth.users som klienten aldrig
  // läser - drift ser den i utkorgen och på fakturan i stället.
  const { profiles, billing, invoices } = await withUser(caller.userId, async (tx) => {
    const profiles = (await tx.query("select user_id, display_name, role from public.user_profiles")).rows;
    const billing = (await tx.query("select * from public.account_billing")).rows;
    const invoices = (await tx.query("select * from public.customer_invoices order by issued_at desc")).rows;
    return { profiles, billing, invoices };
  });
  const billingByUser = new Map(billing.map((b) => [String(b.user_id), toBilling(b)]));
  const invoicesByUser = new Map<string, ReturnType<typeof toCustomerInvoice>[]>();
  for (const row of invoices) {
    const list = invoicesByUser.get(String(row.user_id)) ?? [];
    list.push(toCustomerInvoice(row));
    invoicesByUser.set(String(row.user_id), list);
  }
  const customers = profiles.map((p) => ({
    userId: p.user_id,
    email: null,
    displayName: p.display_name ?? null,
    role: p.role,
    billing: billingByUser.get(String(p.user_id)) ?? null,
    invoices: invoicesByUser.get(String(p.user_id)) ?? [],
  }));
  return { status: 200, body: { customers } };
});

router.post("/v1/billing/accounts/:userId/close", async (req) => {
  const caller = await authenticate(req);
  const userId = uuidParam(req, "userId");
  // Behörigheten bor i radskyddet på account_billing; en icke-admin träffar
  // ingen rad. Raderar ingenting - sätter bara closed_at.
  await withUser(caller.userId, async (tx) => {
    await tx.query("update public.account_billing set closed_at = now() where user_id = $1", [userId]);
    await tx.query("select app.logga_driftatgard($1, $2, $3, $4::jsonb)", [
      "drift.account.close", "account_billing", userId, JSON.stringify({ userId }),
    ]);
  });
  return { status: 200, body: { closed: true } };
});

router.get("/v1/billing/outbox", async (req) => {
  const caller = await authenticate(req);
  const rows = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      "select * from public.outbound_emails order by created_at desc limit 100",
    );
    return rows;
  });
  return { status: 200, body: { emails: rows.map(toOutbox) } };
});

router.post("/v1/billing/outbox/:emailId/retry", async (req) => {
  const caller = await authenticate(req);
  const emailId = uuidParam(req, "emailId");
  await withUser(caller.userId, async (tx) => {
    await tx.query("select public.retry_outbound_email($1)", [emailId]);
  });
  return { status: 200, body: { queued: true } };
});

/* --- Servern --------------------------------------------------------------- */

/**
 * Databasfel som ska bli ett vettigt HTTP-svar.
 *
 * Allt annat blir 500 med ett anonymt besked - ett databasmeddelande som
 * läcker ut i ett svar berättar för fel person hur schemat ser ut.
 */
const asHttpError = (error: unknown): ApiError => {
  if (error instanceof ApiError) return error;
  const err = error as { code?: string; message?: string };
  // Radskyddet nekade skrivningen.
  if (err.code === "42501") return forbidden("Behörighet saknas för åtgärden.");
  // Check-villkor, unikhet, främmande nyckel: klientens data, inte vårt fel.
  if (err.code === "23514" || err.code === "23505" || err.code === "23503") {
    return badRequest("Uppgifterna bryter mot en regel i ärendemodellen.");
  }
  // Våra egna raise exception i funktionerna.
  if (err.code === "P0001") return new ApiError(409, "conflict", err.message ?? "Åtgärden gick inte att utföra.");
  return new ApiError(500, "internal_error", "Något gick fel. Försök igen.");
};

/* --- Profilen -------------------------------------------------------------- */

/*
 * Profilen är det första varje inloggad vy frågar efter: rollen avgör
 * vilken startsida användaren möter. Den låg kvar hos den gamla adaptern
 * och gjorde därmed att ingen inloggning kunde köras helt mot eget API.
 */
const toProfile = (row: Record<string, unknown>) => ({
  userId: row.user_id,
  role: row.role,
  displayName: row.display_name ?? null,
  phone: row.phone ?? null,
});

/* -------------------------------------------------------------------------- */
/* Den registrerades rättigheter (GDPR art. 16-17)                            */
/* -------------------------------------------------------------------------- */

/**
 * Radbilden ur erasure_requests. `result` skickas med: den som begärt
 * radering ska kunna se vad som faktiskt hände, inte bara att det hände.
 */
const toErasureRequest = (row: Record<string, unknown>) => ({
  id: row.id,
  requestedAt: iso(row.requested_at),
  effectiveAt: iso(row.effective_at),
  status: row.status,
  executedAt: row.executed_at ? iso(row.executed_at) : null,
  cancelledAt: row.cancelled_at ? iso(row.cancelled_at) : null,
  result: row.result ?? null,
});

/*
 * Ingen where-sats på användaren, av samma skäl som profilen ovan:
 * radskyddet gör urvalet, och en klient som skickar ett annat konto-id
 * får ändå bara sitt eget.
 */
router.get("/v1/me/erasure", async (req) => {
  const caller = await authenticate(req);
  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      "select * from public.erasure_requests order by requested_at desc limit 1",
    );
    return rows[0] ?? null;
  });
  return { status: 200, body: row ? toErasureRequest(row) : null };
});

/*
 * Begäran kräver lösenordet. Karenstiden på sju dagar är ett skydd mot
 * ånger, inte mot en angripare: den som har sessionen kan återkalla
 * begäran lika lätt som hen gjorde den, och kan begära om den dagen efter.
 * Det som stoppar en kapad session är att den inte kan svara på frågan
 * "vad är lösenordet".
 */
router.post("/v1/me/erasure", async (req) => {
  const caller = await authenticate(req);
  await confirmPassword(caller, req);
  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query("select * from public.request_account_erasure()");
    return rows[0];
  });
  return { status: 200, body: toErasureRequest(row) };
});

/*
 * DELETE på begäran, inte på kontot. Verbet gäller resursen i sökvägen -
 * begäran - och att återkalla den är att ta bort den. Att lägga
 * verkställandet bakom DELETE hade varit att göra den farligaste
 * operationen i produkten till den lättaste att råka anropa.
 */
router.del("/v1/me/erasure", async (req) => {
  const caller = await authenticate(req);
  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query("select * from public.cancel_account_erasure()");
    return rows[0];
  });
  return { status: 200, body: toErasureRequest(row) };
});

router.get("/v1/profile", async (req) => {
  const caller = await authenticate(req);
  const row = await withUser(caller.userId, async (tx) => {
    // Ingen where-sats på användaren: radskyddet gör urvalet. Se
    // resonemanget vid översiktens frågor.
    const { rows } = await tx.query("select * from public.user_profiles limit 1");
    return rows[0] ?? null;
  });
  // Ingen profil är ett giltigt läge - den skapas vid första inloggningen.
  // 404 hade fått klienten att tro att något gått sönder.
  return { status: 200, body: { profile: row ? toProfile(row) : null } };
});

router.post("/v1/profile", async (req) => {
  const caller = await authenticate(req);
  const role = str(req.body, "role", { max: 40 });
  /*
   * ROLLEN VÄLJS EN GÅNG. En företagare som vill bli rådgivare ska gå
   * genom ansökan, inte genom att posta om sin profil - därför skapar den
   * här rutten bara, och uppdateringen nedan rör aldrig role.
   */
  if (!["company", "advisor", "admin"].includes(role)) {
    throw badRequest('Fältet "role" ska vara company, advisor eller admin.');
  }
  const displayName = str(req.body, "displayName", { max: 120, required: false });
  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `insert into public.user_profiles (user_id, role, display_name)
       values ($1, $2, $3)
       on conflict (user_id) do nothing
       returning *`,
      [caller.userId, role, displayName || null],
    );
    if (rows[0]) return rows[0];
    const { rows: befintlig } = await tx.query("select * from public.user_profiles limit 1");
    return befintlig[0] ?? null;
  });
  if (!row) throw forbidden("Profilen kunde inte skapas.");
  return { status: 201, body: toProfile(row) };
});

router.patch("/v1/profile", async (req) => {
  const caller = await authenticate(req);
  const displayName = str(req.body, "displayName", { max: 120, required: false });
  const phone = str(req.body, "phone", { max: 40, required: false });
  await withUser(caller.userId, async (tx) => {
    await tx.query(
      "update public.user_profiles set display_name = $1, phone = $2",
      [displayName || null, phone || null],
    );
  });
  return { status: 200, body: { updated: true } };
});

/* --- Ärendets livscykel ---------------------------------------------------- */

const EXIT_REASONS = ["stabilized", "reconstruction_completed", "bankruptcy", "liquidated", "other"];

router.post("/v1/cases/:caseId/close", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const reason = str(req.body, "reason", { max: 40 });
  if (!EXIT_REASONS.includes(reason)) {
    throw badRequest(`Fältet "reason" ska vara en av: ${EXIT_REASONS.join(", ")}.`);
  }
  const note = str(req.body, "note", { max: 2000, required: false });
  const enterHealth = (req.body as Record<string, unknown> | undefined)?.enterHealth === true;
  // Genom funktionen: den skriver händelseloggen och sätter hälsoläget i
  // samma transaktion. Att göra delarna här hade gett ett avslut utan
  // spår om något gick fel mitt i.
  await withUser(caller.userId, async (tx) => {
    await tx.query("select public.close_case($1, $2, $3, $4)", [
      caseId,
      reason,
      note || null,
      enterHealth,
    ]);
  });
  return { status: 200, body: { closed: true } };
});

router.post("/v1/cases/:caseId/reopen", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  await withUser(caller.userId, async (tx) => {
    await tx.query("select public.reopen_case($1)", [caseId]);
  });
  return { status: 200, body: { reopened: true } };
});

router.post("/v1/cases/:caseId/plan-approval", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const approved = (req.body as Record<string, unknown> | undefined)?.approved;
  if (typeof approved !== "boolean") {
    throw badRequest('Fältet "approved" ska vara true eller false.');
  }
  // Att bara en rådgivarroll i ärendet får stämpla prövas i funktionen.
  await withUser(caller.userId, async (tx) => {
    await tx.query("select public.set_plan_approval($1, $2)", [caseId, approved]);
  });
  return { status: 200, body: { approved } };
});

/* --- Live ärendelänkar ----------------------------------------------------- */

const toShareLink = (row: Record<string, unknown>) => ({
  id: row.id,
  caseId: row.case_id,
  scope: row.scope === "full" ? "full" : "overview",
  label: row.label ?? null,
  createdAt: iso(row.created_at),
  expiresAt: iso(row.expires_at),
  revokedAt: iso(row.revoked_at),
  accessCount: Number(row.access_count ?? 0),
});

router.get("/v1/cases/:caseId/share-links", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const rows = await withUser(caller.userId, async (tx) => {
    // Öppningarna räknas i frågan i stället för i två anrop. Den gamla
    // vägen hämtade länkarna, sedan alla åtkomstrader, och räknade i
    // klienten - vilket blir fel så fort någon läser mellan de två.
    const { rows } = await tx.query(
      `select l.*, (select count(*) from public.share_link_access a where a.link_id = l.id) as access_count
         from public.case_share_links l
        where l.case_id = $1
        order by l.created_at desc`,
      [caseId],
    );
    return rows;
  });
  return { status: 200, body: { shareLinks: rows.map(toShareLink) } };
});

router.post("/v1/cases/:caseId/share-links", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const scope = str(req.body, "scope", { max: 20 });
  if (!["overview", "full"].includes(scope)) {
    throw badRequest('Fältet "scope" ska vara overview eller full.');
  }
  const label = str(req.body, "label", { max: 120, required: false });
  const rawDays = (req.body as Record<string, unknown> | undefined)?.validDays;
  if (typeof rawDays !== "number" || !Number.isFinite(rawDays)) {
    throw badRequest('Fältet "validDays" ska vara ett tal.');
  }
  /*
   * Giltighetstiden KLÄMS, den avvisas inte. En länk utan bortre gräns är
   * en läcka som ingen minns, och samma klämning finns i den gamla
   * adaptern - att de två räknade olika hade gett länkar med olika
   * livslängd beroende på vilken väg in klienten råkade ta.
   */
  const days = Math.min(Math.max(Math.round(rawDays), 1), 365);
  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `insert into public.case_share_links (case_id, scope, label, expires_at)
       values ($1, $2, $3, now() + make_interval(days => $4))
       returning *`,
      [caseId, scope, label || null, days],
    );
    return rows[0] ?? null;
  });
  if (!row) throw forbidden("Länken kunde inte skapas i det här ärendet.");
  return { status: 201, body: toShareLink({ ...row, access_count: 0 }) };
});

router.del("/v1/share-links/:linkId", async (req) => {
  const caller = await authenticate(req);
  const linkId = uuidParam(req, "linkId");
  // Återkallas, raderas inte: en borttagen rad tar med sig åtkomstloggen,
  // och då går det inte längre att svara på vem som läst vad.
  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      "update public.case_share_links set revoked_at = now() where id = $1 and revoked_at is null returning id",
      [linkId],
    );
    return rows[0] ?? null;
  });
  // Redan återkallad ska inte bli ett fel: den som trycker två gånger har
  // fått det den ville ha.
  return { status: 200, body: { revoked: true, alreadyRevoked: !row } };
});

/**
 * Live-länkens läsning. ANONYM, precis som kontraktet säger.
 *
 * Funktionen prövar token, giltighetstid och återkallelse, loggar
 * öppningen och returnerar bara det som ryms i länkens scope. Ingen
 * autentisering här är alltså inte en glömd kontroll - det är hela
 * poängen med en delningslänk, och prövningen ligger där den inte går
 * att kringgå.
 */
router.get("/v1/shared/:token", async (req) => {
  const token = uuidParam(req, "token");
  const payload = await withAnon(async (tx) => {
    const { rows } = await tx.query("select public.fetch_shared_case($1) as data", [token]);
    return (rows[0]?.data ?? null) as Record<string, unknown> | null;
  });
  // Ogiltig, utgången och återkallad ger SAMMA svar. Skillnaden hjälper
  // bara den som gissar tokens.
  if (!payload) throw notFound("Länken är ogiltig, har gått ut eller är återkallad.");
  return {
    status: 200,
    body: {
      scope: payload.scope,
      expiresAt: iso(payload.expires_at),
      companyName: payload.company_name ?? null,
      orgNumber: payload.org_number,
      recommendationType: payload.recommendation_type ?? null,
      recommendationTitle: payload.recommendation_title ?? null,
      totalDebt: payload.total_debt ?? null,
      quickLiquidationValue: payload.quick_liquidation_value ?? null,
      canPaySalary: payload.can_pay_salary ?? null,
      canPayTax: payload.can_pay_tax ?? null,
      canPayRent: payload.can_pay_rent ?? null,
      canPaySuppliers: payload.can_pay_suppliers ?? null,
      salaryAmount: payload.salary_amount ?? null,
      salaryDay: payload.salary_day ?? null,
      taxAmount: payload.tax_amount ?? null,
      taxDay: payload.tax_day ?? null,
      rentAmount: payload.rent_amount ?? null,
      rentDay: payload.rent_day ?? null,
      closedAt: iso(payload.closed_at),
      healthMode: payload.health_mode === true,
      updatedAt: iso(payload.updated_at),
      documents: Array.isArray(payload.documents)
        ? (payload.documents as Record<string, unknown>[]).map((d) => ({
            fileName: d.file_name,
            kind: d.kind,
            reviewStatus: d.review_status,
            createdAt: iso(d.created_at),
          }))
        : null,
    },
  };
});

export const handle = async (
  method: string,
  path: string,
  headers: ApiRequest["headers"],
  body: unknown,
  query: URLSearchParams,
): Promise<{ status: number; body: unknown }> => {
  try {
    const matched = router.match(method, path);
    if (!matched) throw notFound("Okänd resurs.");
    return await matched.handler({ method, path, params: matched.params, query, headers, body });
  } catch (error) {
    const api = asHttpError(error);
    // Maskerat: ett pg-fel bär query OCH parameters - alltså de värden
    // som skickades in. Ett fel i inloggningen hade annars skrivit ett
    // lösenordsförsök till loggen.
    if (api.status >= 500) loggaFel("api_fel", error, { rutt: path, metod: method });
    return { status: api.status, body: { error: { code: api.code, message: api.message } } };
  }
};

/**
 * HASTIGHETSGRÄNSEN, LYFT UR TRANSPORTEN.
 *
 * Den bodde inne i createApiServer, alltså i node:http-lagret. Det höll så
 * länge det fanns exakt en väg in. Det gör det inte längre: på Vercel går
 * varje anrop genom api/[...path].ts, och en gräns som bara gäller den väg
 * ingen använder är ingen gräns alls - forceringsskyddet på inloggningen
 * hade följt med containern ut ur produkten, tyst.
 *
 * Returnerar null när anropet ryms, annars det svar som ska skickas.
 * Anroparen ska alltså INTE gå vidare till handle() när svaret inte är
 * null.
 *
 * Prövas FÖRE kroppen läses. Ordningen är inte likgiltig: läser vi kroppen
 * först har vi redan lagt tid och minne på ett anrop vi tänker avvisa, och
 * en forcering blir billigare för angriparen än för oss. På Vercel läses
 * kroppen av plattformen innan vår kod körs - där går det inte att styra,
 * men på den egna servern gör vi det ändå.
 */
export const provaHastighet = async (
  path: string,
  headers: ApiRequest["headers"],
  fallbackAdress: string,
): Promise<{ status: number; headers: Record<string, string>; body: unknown } | null> => {
  // Inloggningen har eget, hårdare tak - den är den enda ytan där ett
  // gissat värde ger åtkomst.
  const inloggning = path === "/v1/auth/login";
  const nyckel = klientNyckel(headers, fallbackAdress);
  let grans: Utfall;
  try {
    grans = await provaGrans(
      `${inloggning ? "login" : "allman"}:${nyckel}`,
      inloggning ? LOGIN : ALLMAN,
    );
  } catch (error) {
    /*
     * VI STÄNGER VID FEL.
     *
     * Räkningen ligger i databasen sedan 20260811100000. Går den inte att
     * göra vet vi inte om anropet ryms - och att släppa igenom det ändå
     * gör en databasstörning till ett öppet fönster för forcering av
     * inloggningen.
     *
     * Att stänga kostar ingenting utöver det som ändå är förlorat: API:et
     * kan inte svara på någonting utan databasen. 503 och inte 500,
     * eftersom det är ett läge som går över.
     */
    loggaFel("hastighetsgransen_kunde_inte_provas", error);
    return {
      status: 503,
      headers: { "retry-after": "5" },
      body: {
        error: {
          code: "tjansten_ar_upptagen",
          message: "Tjänsten kan inte ta emot anropet just nu. Försök igen om en stund.",
        },
      },
    };
  }
  if (!grans.tillaten) {
    return {
      status: 429,
      headers: { "retry-after": String(grans.retryAfter) },
      body: {
        error: {
          code: "for_manga_forsok",
          message: `För många försök. Försök igen om ${grans.retryAfter} sekunder.`,
        },
      },
    };
  }
  return null;
};

export const createApiServer = () =>
  createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://localhost");

      // Gränsen prövas före kroppen läses - se provaHastighet.
      const avvisat = await provaHastighet(
        url.pathname,
        req.headers,
        req.socket.remoteAddress ?? "okand",
      );
      if (avvisat) {
        for (const [namn, varde] of Object.entries(avvisat.headers)) res.setHeader(namn, varde);
        sendJson(res, avvisat.status, avvisat.body);
        return;
      }

      let body: unknown;
      try {
        body = await readBody(req);
      } catch (error) {
        const api = error instanceof ApiError ? error : badRequest("Kroppen gick inte att läsa.");
        sendJson(res, api.status, { error: { code: api.code, message: api.message } });
        return;
      }
      const result = await handle(req.method ?? "GET", url.pathname, req.headers, body, url.searchParams);
      sendJson(res, result.status, result.body);
    })();
  });
