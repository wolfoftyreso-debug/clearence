import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { parsePremiseWatch } from "../premise";
import { parseSie } from "@/lib/financial/sie";
import {
  MOTORVERSION,
  kor as korSimulering,
  nyttFro,
  valideraSpec,
  type Simuleringsspec,
} from "@/lib/montecarlo/motor";
import type { SimulationRecord, SimulationRun } from "../types";
import { snapshotFromSie } from "@/lib/financial/fromSie";
import type { FinancialSnapshot } from "@/lib/financial/model";
import type { NotificationDeliveryRecord, NotificationPrefsRecord } from "../types";
import {
  VERIFICATION_TTL_MINUTES,
  isVerificationCode,
  maskPhone,
  normalisePhone,
} from "@/lib/notifications/phone";
import { invoiceEmail, receiptEmail } from "@/lib/email/messages";
import { COMPANY } from "@/lib/company";
import { deriveAuditDetail } from "@/lib/auditDetail";
import { DEFAULT_RETENTION, mergeRetentionPolicy, type RetentionOverride } from "@/lib/retention";
import type { DataPort } from "../ports";
import type {
  AccountBillingRecord,
  AdvisorSessionRecord,
  SharedCaseView,
  ApplicationForReview,
  ApplicationRecord,
  CaseExitReason,
  CaseMessage,
  CaseRecord,
  CaseTask,
  ContactMessageRecord,
  CustomerInvoiceRecord,
  ErasureRequestRecord,
  CustomerOverview,
  OutboundEmailRecord,
  DocumentRecord,
  FixedPrice,
  InvoiceRecord,
  PaymentRecord,
  ContactRequestRecord,
  LeadPreviewRecord,
  ProfessionalRecord,
  ProfileClaimRecord,
  UsageChargeRecord,
  RatingRecord,
  ReferralRecord,
  SecretInfo,
} from "../types";

/**
 * Supabase implementation of DataPort.
 *
 * Every Supabase-specific detail in the application lives here: the
 * PostgREST query shapes, the snake_case column names, and the reliance on
 * row-level security to scope results to the signed-in user.
 */

const asFixedPrices = (value: unknown): FixedPrice[] =>
  Array.isArray(value) ? (value as FixedPrice[]) : [];

/**
 * Serialisation boundary for jsonb columns. The generated Json type requires
 * an index signature that the domain types deliberately do not carry - the
 * application's own model should not be shaped by one backend's codegen - so
 * the cast belongs here, at the edge, rather than in src/data/types.ts.
 */
const toJson = (value: unknown): Json => value as Json;

const DOCUMENT_BUCKET = "case-documents";

/** Praktikerns valda ärende. Rent gränssnittsval - åtkomsten prövas i databasen. */
const ACTIVE_CASE_KEY = "clearance-active-case";

type MessageRow = {
  id: string;
  case_id: string;
  conversation_id: string | null;
  author_user_id: string | null;
  body: string;
  attachment_document_id: string | null;
  expects_reply_from: string | null;
  created_at: string;
  read_at: string | null;
};

/** Hänger på kvittenserna. Två frågor i stället för en join per meddelande. */
const withAcks = async (rows: MessageRow[]): Promise<CaseMessage[]> => {
  const ids = rows.map((r) => r.id);
  const acks =
    ids.length === 0
      ? []
      : ((await supabase.from("message_acks").select("*").in("message_id", ids)).data ?? []);
  return rows.map((row) => ({
    id: row.id,
    caseId: row.case_id,
    conversationId: row.conversation_id,
    authorUserId: row.author_user_id,
    body: row.body,
    attachmentDocumentId: row.attachment_document_id,
    expectsReplyFrom: row.expects_reply_from,
    acks: acks
      .filter((a) => a.message_id === row.id)
      .map((a) => ({ userId: a.user_id, ackedAt: a.acked_at })),
    createdAt: row.created_at,
    readAt: row.read_at,
  }));
};

/** Medlemslistan, behörighetsprövad i databasen. Delas av members och messages. */
const dataMembersList = async (caseId: string) => {
  const { data, error } = await supabase.rpc("list_case_members", { p_case_id: caseId });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    caseId,
    userId: row.user_id,
    role: row.role,
    displayName: row.display_name,
    email: row.email,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
  }));
};

/**
 * Object keys are built from a user-supplied filename, so strip anything that
 * could climb out of the user's prefix or confuse the storage API. The
 * original name is kept in the table for display.
 */
const sanitiseFileName = (name: string): string => {
  const cleaned = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+/, "");
  return (cleaned || "fil").slice(-120);
};

const toBilling = (row: {
  user_id: string;
  plan_id?: string | null;
  started_at: string;
  due_at: string | null;
  paid_at: string | null;
  closed_at: string | null;
  note: string | null;
}): AccountBillingRecord => ({
  userId: row.user_id,
  // Reserven är standard, samma som kolumnens default. Ett okänt värde
  // ska falla NEDÅT: att gissa fel uppåt vore att dela ut en betald
  // kanal gratis.
  planId:
    row.plan_id === "start" || row.plan_id === "business" || row.plan_id === "enterprise"
      ? row.plan_id
      : "standard",
  startedAt: row.started_at,
  dueAt: row.due_at,
  paidAt: row.paid_at,
  closedAt: row.closed_at,
  note: row.note,
});

const toCustomerInvoice = (row: {
  id: string;
  user_id: string;
  invoice_number: string;
  issued_at: string;
  due_at: string;
  net_ore: number | string;
  vat_ore: number | string;
  gross_ore: number | string;
  vat_rate: number | string;
  description: string;
  status: CustomerInvoiceRecord["status"];
  paid_at: string | null;
  payment_reference: string | null;
  receipt_number: string | null;
  customer_name?: string | null;
  customer_org_number?: string | null;
  customer_address?: string | null;
  period_start?: string | null;
  period_end?: string | null;
}): CustomerInvoiceRecord => ({
  id: row.id,
  userId: row.user_id,
  invoiceNumber: row.invoice_number,
  issuedAt: row.issued_at,
  dueAt: row.due_at,
  // Null på rader som skapades innan formkravsfälten fanns. Fakturan
  // visar då det den kan; nya rader kan inte sakna dem.
  customerName: row.customer_name ?? null,
  customerOrgNumber: row.customer_org_number ?? null,
  customerAddress: row.customer_address ?? null,
  periodStart: row.period_start ?? null,
  periodEnd: row.period_end ?? null,
  // bigint kommer som sträng genom PostgREST. Number() här, en gång, i
  // stället för överallt i gränssnittet.
  netOre: Number(row.net_ore),
  vatOre: Number(row.vat_ore),
  grossOre: Number(row.gross_ore),
  vatRate: Number(row.vat_rate),
  description: row.description,
  status: row.status,
  paidAt: row.paid_at,
  paymentReference: row.payment_reference,
  receiptNumber: row.receipt_number,
});

/**
 * Lägger ett mejl i utkorgen.
 *
 * Anropas direkt efter att fakturan skrivits, så att raden hör ihop med det
 * den handlar om. Går kön inte att skriva till kastas felet vidare - en
 * faktura som skapats utan att mejlet köats är sämre än ingen faktura alls,
 * eftersom kunden då aldrig får veta att den finns.
 */
const enqueueEmail = async (
  message: { recipient: string; subject: string; bodyText: string; bodyHtml: string; kind: string },
  invoiceId: string | null,
) => {
  const { error } = await supabase.from("outbound_emails").insert({
    recipient: message.recipient,
    subject: message.subject,
    body_text: message.bodyText,
    body_html: message.bodyHtml,
    kind: message.kind,
    related_invoice_id: invoiceId,
  });
  if (error) throw error;
};

const toContactMessage = (row: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  topic: ContactMessageRecord["topic"];
  message: string;
  user_id: string | null;
  status: ContactMessageRecord["status"];
  handled_by: string | null;
  handled_at: string | null;
  internal_note: string | null;
  created_at: string;
}): ContactMessageRecord => ({
  id: row.id,
  name: row.name,
  email: row.email,
  phone: row.phone,
  company: row.company,
  topic: row.topic,
  message: row.message,
  userId: row.user_id,
  status: row.status,
  handledBy: row.handled_by,
  handledAt: row.handled_at,
  internalNote: row.internal_note,
  createdAt: row.created_at,
});

const toDocument = (row: {
  id: string;
  case_id: string;
  kind: DocumentRecord["kind"];
  file_name: string;
  file_size: number | string;
  mime_type: string;
  storage_path: string;
  source: DocumentRecord["source"];
  note: string | null;
  created_at: string;
  review_status?: string | null;
  review_requested_at?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
}): DocumentRecord => ({
  id: row.id,
  caseId: row.case_id,
  kind: row.kind,
  fileName: row.file_name,
  fileSize: Number(row.file_size),
  mimeType: row.mime_type,
  storagePath: row.storage_path,
  source: row.source,
  note: row.note,
  createdAt: row.created_at,
  reviewStatus:
    row.review_status === "in_review" || row.review_status === "approved"
      ? row.review_status
      : "draft",
  reviewRequestedAt: row.review_requested_at ?? null,
  reviewedBy: row.reviewed_by ?? null,
  reviewedAt: row.reviewed_at ?? null,
});

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

type CaseRow = {
  id: string;
  org_number: string;
  company_name: string | null;
  employees: string | null;
  can_pay_salary: boolean | null;
  salary_amount: string | null;
  salary_day: number | null;
  can_pay_tax: boolean | null;
  tax_amount: string | null;
  tax_day: number | null;
  can_pay_rent: boolean | null;
  rent_amount: string | null;
  rent_day: number | null;
  can_pay_suppliers: boolean | null;
  total_debt: string | null;
  quick_liquidation_value: string | null;
  recommendation_type: CaseRecord["recommendationType"];
  recommendation_title: string | null;
  recommendation_description: string | null;
  recommendation_reasons: unknown;
  recommendation_next_steps: unknown;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  exit_reason: string | null;
  health_mode: boolean;
  plan_approved_at: string | null;
  plan_approved_by: string | null;
};

const toCase = (row: CaseRow): CaseRecord => ({
  id: row.id,
  orgNumber: row.org_number,
  companyName: row.company_name,
  employees: row.employees,
  canPaySalary: row.can_pay_salary,
  salaryAmount: row.salary_amount,
  salaryDay: row.salary_day,
  canPayTax: row.can_pay_tax,
  taxAmount: row.tax_amount,
  taxDay: row.tax_day,
  canPayRent: row.can_pay_rent,
  rentAmount: row.rent_amount,
  rentDay: row.rent_day,
  canPaySuppliers: row.can_pay_suppliers,
  totalDebt: row.total_debt,
  quickLiquidationValue: row.quick_liquidation_value,
  recommendationType: row.recommendation_type,
  recommendationTitle: row.recommendation_title,
  recommendationDescription: row.recommendation_description,
  recommendationReasons: asStringArray(row.recommendation_reasons),
  recommendationNextSteps: asStringArray(row.recommendation_next_steps),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  closedAt: row.closed_at,
  exitReason: (row.exit_reason as CaseExitReason | null) ?? null,
  healthMode: row.health_mode,
  planApprovedAt: row.plan_approved_at,
  planApprovedBy: row.plan_approved_by,
});

const toPayment = (row: {
  id: string;
  case_id: string;
  label: string;
  amount: number;
  category: PaymentRecord["category"];
  status: PaymentRecord["status"];
  due_date: string;
  recurring: boolean;
}): PaymentRecord => ({
  id: row.id,
  caseId: row.case_id,
  label: row.label,
  amount: Number(row.amount),
  category: row.category,
  status: row.status,
  dueDate: row.due_date,
  recurring: row.recurring,
});

/** Raden -> SimulationRecord. Delas av list, get, create och update. */
/** Radbilden ur erasure_requests, i produktens språk. */
const toErasureRequest = (row: Record<string, unknown>): ErasureRequestRecord => ({
  id: String(row.id),
  requestedAt: String(row.requested_at),
  effectiveAt: String(row.effective_at),
  status: row.status as ErasureRequestRecord["status"],
  executedAt: row.executed_at ? String(row.executed_at) : null,
  cancelledAt: row.cancelled_at ? String(row.cancelled_at) : null,
  result: (row.result as Record<string, number> | null) ?? null,
});

const toSimulation = (row: Record<string, unknown>): SimulationRecord => ({
  id: row.id as string,
  caseId: row.case_id as string,
  name: row.name as string,
  description: (row.description as string | null) ?? null,
  spec: row.spec,
  specVersion: Number(row.spec_version ?? 1),
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
});

const toRun = (row: Record<string, unknown>): SimulationRun => ({
  id: row.id as string,
  simulationId: row.simulation_id as string,
  status: row.status as SimulationRun["status"],
  seed: Number(row.seed),
  engineVersion: row.engine_version as string,
  specVersion: Number(row.spec_version ?? 1),
  iterations: Number(row.iterations ?? 0),
  discardedIterations: Number(row.discarded_iterations ?? 0),
  durationMs: row.duration_ms === null || row.duration_ms === undefined ? null : Number(row.duration_ms),
  error: (row.error as string | null) ?? null,
  notes: (row.notes as SimulationRun["notes"]) ?? null,
  queuedAt: row.queued_at as string,
  startedAt: (row.started_at as string | null) ?? null,
  finishedAt: (row.finished_at as string | null) ?? null,
  results: (row.results as SimulationRun["results"]) ?? null,
  spec: row.spec,
});

/** Specen ur databasen plus det körningen bidrar med: iterationer och frö. */
const specMed = (spec: unknown, namn: string, iterationer: number, fro: number): Simuleringsspec => {
  const rå = (spec ?? {}) as Record<string, unknown>;
  return {
    namn,
    inputs: (rå.inputs ?? []) as Simuleringsspec["inputs"],
    outputs: (rå.outputs ?? []) as Simuleringsspec["outputs"],
    konstanter: (rå.konstanter ?? {}) as Record<string, number>,
    iterationer,
    fro,
  };
};

const toInvoice = (row: {
  id: string;
  case_id: string;
  label: string;
  amount: number;
  direction: InvoiceRecord["direction"];
  status: InvoiceRecord["status"];
  issue_date: string;
  due_date: string;
  counterpart: string | null;
}): InvoiceRecord => ({
  id: row.id,
  caseId: row.case_id,
  label: row.label,
  amount: Number(row.amount),
  direction: row.direction,
  status: row.status,
  issueDate: row.issue_date,
  dueDate: row.due_date,
  counterpart: row.counterpart,
});

export const supabaseAdapter: DataPort = {
  auth: {
    async getCurrentUser() {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      return user ? { id: user.id, email: user.email ?? null } : null;
    },
    onAuthChange(callback) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        const user = session?.user;
        callback(user ? { id: user.id, email: user.email ?? null } : null);
      });
      return () => subscription.unsubscribe();
    },
    async signUp(email, password) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      // signUp succeeds without a session when email confirmation is on;
      // the caller must not assume the user is authenticated.
      return { error: error?.message ?? null, needsEmailConfirmation: !error && !data.session };
    },
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    async signOut() {
      await supabase.auth.signOut();
    },
    async requestPasswordReset(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      // "User not found" och liknande sväljs: svaret får inte avslöja vilka
      // adresser som har konto. Supabase svarar redan enhetligt, men den här
      // raden ska hålla även om det ändras.
      if (error && /not found|user/i.test(error.message)) return { error: null };
      return { error: error?.message ?? null };
    },
    async updatePassword(newPassword) {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      return { error: error?.message ?? null };
    },
  },

  contact: {
    async submit(input) {
      // Endast avsändarens egna fält skickas. status, handled_by och user_id
      // sätts av databasen; skickas de härifrån kan en avsändare tillskriva
      // sig någon annans konto eller stänga sitt eget ärende.
      const { error } = await supabase.from("contact_messages").insert({
        name: input.name,
        email: input.email,
        phone: input.phone,
        company: input.company,
        topic: input.topic,
        message: input.message,
      });
      if (error) throw error;
    },
    async amIAdmin() {
      const { data, error } = await supabase.rpc("is_platform_admin");
      // Fel läses som "inte administratör". Den riktiga gränsen är RLS - om
      // det här svaret vore fel skulle inkorgen ändå vara tom.
      if (error) return false;
      return data === true;
    },
    async listAll() {
      const { data, error } = await supabase
        .from("contact_messages")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(toContactMessage);
    },
    async updateStatus(id, status, internalNote) {
      const { data: session } = await supabase.auth.getSession();
      const adminId = session.session?.user.id ?? null;
      const closing = status !== "new";
      const { error } = await supabase
        .from("contact_messages")
        .update({
          status,
          // CHECK-villkoret kräver att handled_by och handled_at sätts
          // tillsammans eller inte alls.
          handled_by: closing ? adminId : null,
          handled_at: closing ? new Date().toISOString() : null,
          ...(internalNote === undefined ? {} : { internal_note: internalNote }),
        })
        .eq("id", id);
      if (error) throw error;
    },
  },

  profile: {
    async getMine() {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data
        ? {
            userId: data.user_id,
            role: data.role,
            displayName: data.display_name,
            phone: data.phone,
          }
        : null;
    },
    async create(input) {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) throw new Error("Inte inloggad");
      const { data, error } = await supabase
        .from("user_profiles")
        .insert({ user_id: userId, role: input.role, display_name: input.displayName })
        .select()
        .single();
      if (error) throw error;
      return {
        userId: data.user_id,
        role: data.role,
        displayName: data.display_name,
        phone: data.phone,
      };
    },
    async update(input) {
      const { error } = await supabase
        .from("user_profiles")
        .update({ display_name: input.displayName, phone: input.phone })
        .eq("user_id", (await supabase.auth.getSession()).data.session?.user.id ?? "");
      if (error) throw error;
    },
  },

  tasks: {
    async listByCase(caseId) {
      const { data, error } = await supabase
        .from("case_tasks")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(
        (row): CaseTask => ({
          id: row.id,
          caseId: row.case_id,
          label: row.label,
          dueDate: row.due_date,
          doneAt: row.done_at,
          doneBy: row.done_by,
          // CHECK-villkoret i migrationen begränsar värdemängden; kolumnen
          // är text i schemat, därav förträngningen här vid gränsen.
          source: row.source as CaseTask["source"],
          createdAt: row.created_at,
          assignedTo: row.assigned_to,
        }),
      );
    },
    async seed(caseId, labels) {
      if (labels.length === 0) return;
      // ignoreDuplicates mot det unika indexet: två flikar som sår
      // samtidigt ger en lista, inte två.
      const { error } = await supabase.from("case_tasks").upsert(
        labels.map((label) => ({ case_id: caseId, label, source: "recommendation" as const })),
        { onConflict: "case_id,label", ignoreDuplicates: true },
      );
      if (error) throw error;
    },
    async add(caseId, label, dueDate) {
      const { error } = await supabase
        .from("case_tasks")
        .insert({ case_id: caseId, label, due_date: dueDate, source: "manual" });
      if (error) throw error;
    },
    async setDone(id, done) {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id ?? null;
      const { error } = await supabase
        .from("case_tasks")
        .update(
          done
            ? { done_at: new Date().toISOString(), done_by: userId }
            : { done_at: null, done_by: null },
        )
        .eq("id", id);
      if (error) throw error;
    },
    async assign(id, userId) {
      const { error } = await supabase
        .from("case_tasks")
        .update({ assigned_to: userId })
        .eq("id", id);
      if (error) throw error;
    },
  },

  advisorTools: {
    // Radskyddet begränsar redan urvalet till författarens/ägarens egna
    // rader - frågorna här filtrerar bara på ärende.
    async listNotes(caseId) {
      const { data, error } = await supabase
        .from("case_notes")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        caseId: row.case_id,
        body: row.body,
        createdAt: row.created_at,
      }));
    },
    async addNote(caseId, body) {
      const { error } = await supabase.from("case_notes").insert({ case_id: caseId, body });
      if (error) throw error;
    },
    async removeNote(id) {
      const { error } = await supabase.from("case_notes").delete().eq("id", id);
      if (error) throw error;
    },
    async listTime(caseId) {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("case_id", caseId)
        .order("occurred_on", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        caseId: row.case_id,
        minutes: Number(row.minutes),
        note: row.note,
        occurredOn: row.occurred_on,
        createdAt: row.created_at,
      }));
    },
    async logTime({ caseId, minutes, note, occurredOn }) {
      const { error } = await supabase.from("time_entries").insert({
        case_id: caseId,
        minutes,
        note: note?.trim() || null,
        ...(occurredOn ? { occurred_on: occurredOn } : {}),
      });
      if (error) throw error;
    },
    async removeTime(id) {
      const { error } = await supabase.from("time_entries").delete().eq("id", id);
      if (error) throw error;
    },
  },

  notificationSettings: {
    async getPrefs() {
      const { data: rows, error } = await supabase
        .from("notification_prefs")
        .select("level, email_enabled, sms_enabled, quiet_start_hour, quiet_end_hour")
        .maybeSingle();
      if (error) throw error;
      if (!rows) return null;
      return {
        level: rows.level as NotificationPrefsRecord["level"],
        emailEnabled: rows.email_enabled,
        smsEnabled: rows.sms_enabled,
        quietStartHour: rows.quiet_start_hour,
        quietEndHour: rows.quiet_end_hour,
      };
    },
    async savePrefs(input) {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Inte inloggad");
      const { error } = await supabase.from("notification_prefs").upsert({
        user_id: userId,
        level: input.level,
        email_enabled: input.emailEnabled,
        sms_enabled: input.smsEnabled,
        quiet_start_hour: input.quietStartHour,
        quiet_end_hour: input.quietEndHour,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    async getPhone() {
      const { data: row, error } = await supabase
        .from("verified_phones")
        .select("e164, verified_at, code_expires_at")
        .maybeSingle();
      if (error) throw error;
      if (!row) return null;
      return {
        // Maskerat, alltid. Hela numret lämnar aldrig databasen till en vy.
        masked: maskPhone(row.e164),
        verified: row.verified_at !== null,
        awaitingCode:
          row.verified_at === null &&
          row.code_expires_at !== null &&
          new Date(row.code_expires_at) > new Date(),
      };
    },
    async startPhoneVerification(rawPhone: string) {
      const e164 = normalisePhone(rawPhone);
      if (!e164) throw new Error("Skriv ett svenskt mobilnummer, till exempel 070-123 45 67.");
      // Koden föds i databasen, inte här. Klienten skickar numret och får
      // ingenting tillbaka - det är hela poängen: den som ska bevisa att
      // numret är hens får veta koden av telefonen, inte av oss.
      const { error } = await supabase.rpc("start_phone_verification", {
        p_e164: e164,
        p_ttl_minutes: VERIFICATION_TTL_MINUTES,
      });
      if (error) throw error;
    },
    async confirmPhoneVerification(code: string) {
      if (!isVerificationCode(code)) return false;
      // Koden går in som klartext och jämförs mot hashen inne i
      // funktionen. Att hasha i klienten hade inte skyddat någonting:
      // hashen ÄR beviset när den är det som prövas, och den som kan
      // skicka en hash behöver aldrig ha sett koden.
      const { data, error } = await supabase.rpc("confirm_phone_verification", {
        p_code: code.trim(),
      });
      if (error) throw error;
      return data === true;
    },
    async removePhone() {
      const { error } = await supabase.rpc("remove_phone");
      if (error) throw error;
    },
    async listRecentDeliveries(limit = 20) {
      const { data: rows, error } = await supabase
        .from("notification_deliveries")
        .select("id, channel, status, suppressed_reason, last_error, created_at, sent_at, notification_events(title)")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (rows ?? []).map((r) => ({
        id: r.id,
        channel: r.channel,
        status: r.status,
        title: (r.notification_events as { title: string } | null)?.title ?? "Avisering",
        createdAt: r.created_at,
        sentAt: r.sent_at,
        reason: r.suppressed_reason ?? r.last_error ?? null,
      })) as NotificationDeliveryRecord[];
    },
  },

  apiKeys: {
    async listMine() {
      const { data: rows, error } = await supabase
        .from("api_keys")
        .select("id, label, key_prefix, created_at, last_used_at, revoked_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (rows ?? []).map((r) => ({
        id: r.id,
        label: r.label,
        keyPrefix: r.key_prefix,
        createdAt: r.created_at,
        lastUsedAt: r.last_used_at,
        revokedAt: r.revoked_at,
      }));
    },
    async create(label: string) {
      // RPC:n genererar och hashar i databasen - hemligheten passerar
      // aldrig nagon annan lagring och returneras EN gang.
      const { data: rows, error } = await supabase.rpc("create_api_key", { p_label: label });
      if (error) throw error;
      const row = (rows as { id: string; key_prefix: string; secret: string; created_at: string }[])[0];
      return {
        record: {
          id: row.id,
          label,
          keyPrefix: row.key_prefix,
          createdAt: row.created_at,
          lastUsedAt: null,
          revokedAt: null,
        },
        secret: row.secret,
      };
    },
    async revoke(id: string) {
      const { error } = await supabase
        .from("api_keys")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
  },

  shares: {
    async list(caseId) {
      const { data: links, error } = await supabase
        .from("case_share_links")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (links ?? []).map((l) => l.id);
      const { data: accesses } = ids.length
        ? await supabase.from("share_link_access").select("link_id").in("link_id", ids)
        : { data: [] as { link_id: string }[] };
      return (links ?? []).map((l) => ({
        id: l.id,
        caseId: l.case_id,
        scope: l.scope === "full" ? ("full" as const) : ("overview" as const),
        label: l.label,
        createdAt: l.created_at,
        expiresAt: l.expires_at,
        revokedAt: l.revoked_at,
        accessCount: (accesses ?? []).filter((a) => a.link_id === l.id).length,
      }));
    },
    async create({ caseId, scope, label, validDays }) {
      const days = Math.min(Math.max(Math.round(validDays), 1), 365);
      const { data: row, error } = await supabase
        .from("case_share_links")
        .insert({
          case_id: caseId,
          scope,
          label: label?.trim() || null,
          expires_at: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select("*")
        .single();
      if (error) throw error;
      return {
        id: row.id,
        caseId: row.case_id,
        scope: row.scope === "full" ? ("full" as const) : ("overview" as const),
        label: row.label,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        revokedAt: row.revoked_at,
        accessCount: 0,
      };
    },
    async revoke(id) {
      const { error } = await supabase
        .from("case_share_links")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    async fetch(token) {
      const { data: payload, error } = await supabase.rpc("fetch_shared_case", {
        p_token: token,
      });
      if (error || !payload) return null;
      const raw = payload as Record<string, unknown>;
      return {
        scope: raw.scope === "full" ? ("full" as const) : ("overview" as const),
        expiresAt: String(raw.expires_at),
        companyName: (raw.company_name as string | null) ?? null,
        orgNumber: String(raw.org_number ?? ""),
        recommendationType: (raw.recommendation_type as SharedCaseView["recommendationType"]) ?? null,
        recommendationTitle: (raw.recommendation_title as string | null) ?? null,
        totalDebt: (raw.total_debt as string | null) ?? null,
        quickLiquidationValue: (raw.quick_liquidation_value as string | null) ?? null,
        canPaySalary: (raw.can_pay_salary as boolean | null) ?? null,
        canPayTax: (raw.can_pay_tax as boolean | null) ?? null,
        canPayRent: (raw.can_pay_rent as boolean | null) ?? null,
        canPaySuppliers: (raw.can_pay_suppliers as boolean | null) ?? null,
        salaryAmount: (raw.salary_amount as string | null) ?? null,
        salaryDay: (raw.salary_day as number | null) ?? null,
        taxAmount: (raw.tax_amount as string | null) ?? null,
        taxDay: (raw.tax_day as number | null) ?? null,
        rentAmount: (raw.rent_amount as string | null) ?? null,
        rentDay: (raw.rent_day as number | null) ?? null,
        closedAt: (raw.closed_at as string | null) ?? null,
        healthMode: Boolean(raw.health_mode),
        updatedAt: String(raw.updated_at ?? ""),
        documents: Array.isArray(raw.documents)
          ? (raw.documents as { file_name: string; kind: string; review_status: string; created_at: string }[]).map((d) => ({
              fileName: d.file_name,
              kind: d.kind,
              reviewStatus: d.review_status,
              createdAt: d.created_at,
            }))
          : null,
      };
    },
  },

  dialogue: {
    // Radskyddet i databasen avgör vem som ser vad; frågorna filtrerar
    // bara på ärende. Sessioner sparas med upsert - samma samtal skrivs
    // flera gånger medan det pågår.
    async listSessions(caseId) {
      const { data, error } = await supabase
        .from("advisor_sessions")
        .select("*")
        .eq("case_id", caseId)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        caseId: row.case_id,
        flowId: row.flow_id,
        flowTitle: row.flow_title,
        startedAt: row.started_at,
        closedAt: row.closed_at,
        entries: (Array.isArray(row.entries)
          ? row.entries
          : []) as AdvisorSessionRecord["entries"],
      }));
    },
    async saveSession(session) {
      const { error } = await supabase.from("advisor_sessions").upsert({
        id: session.id,
        case_id: session.caseId,
        flow_id: session.flowId,
        flow_title: session.flowTitle,
        started_at: session.startedAt,
        closed_at: session.closedAt,
        entries: session.entries,
      });
      if (error) throw error;
    },
    async listDecisions(caseId) {
      const { data, error } = await supabase
        .from("case_decisions")
        .select("*")
        .eq("case_id", caseId)
        .order("decided_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        caseId: row.case_id,
        title: row.title,
        rationale: row.rationale,
        premise: row.premise,
        decidedAt: row.decided_at,
        status: row.status === "reconsidered" ? ("reconsidered" as const) : ("active" as const),
        reconsideredAt: row.reconsidered_at,
        reconsiderNote: row.reconsider_note,
        // Halva villkoret är inget villkor: databasen har ett check som
        // ser till att de tre fälten följs åt, och läsningen litar inte
        // på det ändå - ett premature "bevakat" är värre än "bevakas ej".
        watch: parsePremiseWatch(row.watch_signal, row.watch_comparator, row.watch_threshold),
        watchAckObservation: row.watch_ack_observation ?? null,
        watchAckAt: row.watch_ack_at ?? null,
      }));
    },
    async recordDecision({ caseId, title, rationale, premise, watch }) {
      const { error } = await supabase.from("case_decisions").insert({
        case_id: caseId,
        title: title.trim(),
        rationale: rationale.trim(),
        premise: premise?.trim() || null,
        watch_signal: watch?.signal ?? null,
        watch_comparator: watch?.comparator ?? null,
        watch_threshold: watch?.threshold ?? null,
      });
      if (error) throw error;
    },
    async reconsiderDecision(id, note) {
      const { error } = await supabase
        .from("case_decisions")
        .update({
          status: "reconsidered",
          reconsidered_at: new Date().toISOString(),
          reconsider_note: note.trim() || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    // Genom funktionen, aldrig genom en uppdatering: kvitteringen ska
    // journalföras i samma transaktion som den sätts.
    async acknowledgePremise(id, observation) {
      const { error } = await supabase.rpc("acknowledge_premise", {
        p_decision_id: id,
        p_observation: observation,
      });
      if (error) throw error;
    },
  },

  audit: {
    async listByCase(caseId) {
      const { data, error } = await supabase
        .from("audit_events")
        .select("id, case_id, actor_user_id, actor_role, action, object_type, object_id, before, after, occurred_at")
        .eq("case_id", caseId)
        .order("occurred_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        caseId: row.case_id,
        actorUserId: row.actor_user_id,
        actorRole: row.actor_role,
        action: row.action,
        objectType: row.object_type,
        objectId: row.object_id,
        detail: deriveAuditDetail(
          row.object_type,
          row.action,
          row.before as Record<string, unknown> | null,
          row.after as Record<string, unknown> | null,
        ),
        occurredAt: row.occurred_at,
      }));
    },
  },

  members: {
    // Medlemslistan går genom list_case_members: profiltabellen låter var
    // och en läsa bara sin egen rad, men i ett ärende man tillhör måste man
    // kunna se vem de andra är. Funktionen lämnar ut namn och adress för
    // ärendets medlemmar, inget mer.
    async listMembers(caseId) {
      return dataMembersList(caseId);
    },
    async listInvitations(caseId) {
      const { data, error } = await supabase
        .from("case_invitations")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        caseId: row.case_id,
        email: row.email,
        role: row.role,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        acceptedAt: row.accepted_at,
        revokedAt: row.revoked_at,
      }));
    },
    async invite(caseId, email, role) {
      const { error } = await supabase.rpc("invite_to_case", {
        p_case_id: caseId,
        p_email: email,
        p_role: role,
      });
      if (error) throw error;
    },
    async revokeInvitation(invitationId) {
      const { error } = await supabase.rpc("revoke_case_invitation", {
        p_invitation_id: invitationId,
      });
      if (error) throw error;
    },
    async peekInvitation(invitationId) {
      const { data, error } = await supabase.rpc("peek_case_invitation", {
        p_invitation_id: invitationId,
      });
      if (error) throw error;
      const row = (data ?? [])[0];
      if (!row) return null;
      return {
        id: row.id,
        companyName: row.company_name,
        orgNumber: row.org_number,
        role: row.role,
        inviterName: row.inviter_name,
        expiresAt: row.expires_at,
        acceptedAt: row.accepted_at,
        revokedAt: row.revoked_at,
      };
    },
    async acceptInvitation(invitationId) {
      const { data, error } = await supabase.rpc("accept_case_invitation", {
        p_invitation_id: invitationId,
      });
      if (error) throw error;
      return data as string;
    },
  },

  messages: {
    async listByCase(caseId) {
      // Grundtråden: meddelanden utan tråd-id. Trådade meddelanden hämtas
      // per tråd - synligheten avgörs av radskyddet, inte av filtret här.
      const { data, error } = await supabase
        .from("case_messages")
        .select("*")
        .eq("case_id", caseId)
        .is("conversation_id", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return withAcks(data ?? []);
    },
    async listByConversation(conversationId) {
      const { data, error } = await supabase
        .from("case_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return withAcks(data ?? []);
    },
    async send(caseId, body, opts) {
      const { data: session } = await supabase.auth.getSession();
      const { error } = await supabase.from("case_messages").insert({
        case_id: caseId,
        author_user_id: session.session?.user.id ?? null,
        body,
        conversation_id: opts?.conversationId ?? null,
        attachment_document_id: opts?.attachmentDocumentId ?? null,
        expects_reply_from: opts?.expectsReplyFrom ?? null,
      });
      if (error) throw error;
    },
    async markRead(id) {
      const { error } = await supabase
        .from("case_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id)
        .is("read_at", null);
      if (error) throw error;
    },

    async listConversations(caseId) {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = data ?? [];
      if (rows.length === 0) return [];
      const { data: participants, error: pError } = await supabase
        .from("conversation_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", rows.map((r) => r.id));
      if (pError) throw pError;
      // Namnen kommer ur medlemslistan, som redan är behörighetsprövad.
      const members = await dataMembersList(caseId);
      const nameOf = new Map(members.map((m) => [m.userId, m.displayName ?? m.email]));
      return rows.map((row) => ({
        id: row.id,
        caseId: row.case_id,
        kind: row.kind as "direct" | "group",
        title: row.title,
        createdBy: row.created_by,
        createdAt: row.created_at,
        mergedInto: row.merged_into,
        participants: (participants ?? [])
          .filter((p) => p.conversation_id === row.id)
          .map((p) => ({ userId: p.user_id, displayName: nameOf.get(p.user_id) ?? null })),
      }));
    },
    async createDirect(caseId, otherUserId) {
      const { data: session } = await supabase.auth.getSession();
      const me = session.session?.user.id;
      if (!me) throw new Error("Inte inloggad");
      const { data, error } = await supabase
        .from("conversations")
        .insert({ case_id: caseId, kind: "direct", created_by: me })
        .select("id")
        .single();
      if (error) throw error;
      const { error: pError } = await supabase.from("conversation_participants").insert([
        { conversation_id: data.id, user_id: me, added_by: me },
        { conversation_id: data.id, user_id: otherUserId, added_by: me },
      ]);
      if (pError) throw pError;
      return data.id;
    },
    async createGroup(caseId, title, participantUserIds) {
      const { data: session } = await supabase.auth.getSession();
      const me = session.session?.user.id;
      if (!me) throw new Error("Inte inloggad");
      const { data, error } = await supabase
        .from("conversations")
        .insert({ case_id: caseId, kind: "group", title, created_by: me })
        .select("id")
        .single();
      if (error) throw error;
      const ids = Array.from(new Set([me, ...participantUserIds]));
      const { error: pError } = await supabase.from("conversation_participants").insert(
        ids.map((userId) => ({ conversation_id: data.id, user_id: userId, added_by: me })),
      );
      if (pError) throw pError;
      return data.id;
    },
    async merge(fromConversationId, toConversationId) {
      const { error } = await supabase.rpc("merge_conversations", {
        p_from: fromConversationId,
        p_to: toConversationId,
      });
      if (error) throw error;
    },

    async ack(messageId) {
      const { data: session } = await supabase.auth.getSession();
      const me = session.session?.user.id;
      if (!me) throw new Error("Inte inloggad");
      const { error } = await supabase
        .from("message_acks")
        .insert({ message_id: messageId, user_id: me });
      // Dubbelklick mot primärnyckeln är ingen nyhet att rapportera.
      if (error && !error.message.includes("duplicate")) throw error;
    },
    async myOpenMentions() {
      const { data, error } = await supabase.rpc("my_open_mentions");
      if (error) throw error;
      return (data ?? []).map((row) => ({
        messageId: row.message_id,
        caseId: row.case_id,
        conversationId: row.conversation_id,
        conversationTitle: row.conversation_title,
        authorName: row.author_name,
        body: row.body,
        createdAt: row.created_at,
      }));
    },
  },

  billing: {
    async getMine() {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) throw new Error("Inte inloggad");

      const { data, error } = await supabase
        .from("account_billing")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (data) return toBilling(data);

      // Gratisveckan börjar när kontot först används, inte när någon kör ett
      // skript. Raden skapas därför lat, av kunden själv.
      const { data: created, error: insertError } = await supabase
        .from("account_billing")
        .insert({ user_id: userId })
        .select()
        .single();
      if (insertError) throw insertError;
      return toBilling(created);
    },
    async listMyInvoices() {
      const { data, error } = await supabase
        .from("customer_invoices")
        .select("*")
        .order("issued_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(toCustomerInvoice);
    },
    async getCompanyPlan() {
      // Driftparametern i app_settings; beslutat betapris som reserv.
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "company_plan")
        .maybeSingle();
      if (error) throw error;
      const raw = (data?.value as {
        monthly_ex_vat_sek?: number;
        business_ex_vat_sek?: number | null;
        enterprise_ex_vat_sek?: number | null;
      } | null) ?? null;
      return {
        monthlyExVatSek: raw?.monthly_ex_vat_sek ?? 985,
        businessExVatSek: raw?.business_ex_vat_sek ?? 2780,
        enterpriseExVatSek: raw?.enterprise_ex_vat_sek ?? 4500,
      };
    },
    async listCustomers() {
      // RLS filtrerar: den som inte är administratör får sina egna rader,
      // vilket är rätt svar och inte ett fel.
      const [profiles, billing, invoices] = await Promise.all([
        supabase.from("user_profiles").select("*"),
        supabase.from("account_billing").select("*"),
        supabase.from("customer_invoices").select("*").order("issued_at", { ascending: false }),
      ]);
      if (profiles.error) throw profiles.error;
      if (billing.error) throw billing.error;
      if (invoices.error) throw invoices.error;

      const billingByUser = new Map(
        (billing.data ?? []).map((b) => [b.user_id, toBilling(b)]),
      );
      const invoicesByUser = new Map<string, CustomerInvoiceRecord[]>();
      for (const row of invoices.data ?? []) {
        const list = invoicesByUser.get(row.user_id) ?? [];
        list.push(toCustomerInvoice(row));
        invoicesByUser.set(row.user_id, list);
      }

      return (profiles.data ?? []).map(
        (p): CustomerOverview => ({
          userId: p.user_id,
          // Adressen ligger i auth.users, som klienten inte får läsa. Drift
          // ser den i inkorgen och i fakturan i stället.
          email: null,
          displayName: p.display_name,
          role: p.role,
          billing: billingByUser.get(p.user_id) ?? null,
          invoices: invoicesByUser.get(p.user_id) ?? [],
        }),
      );
    },
    async issueInvoice(input) {
      /*
       * Numret sätts i databasen, inte här.
       *
       * Förut lästes alla befintliga nummer hit, max + 1 räknades fram i
       * webbläsaren och skrevs in. Två samtidiga utställanden läste då
       * samma max och båda försökte skriva samma nummer - unikhets-
       * villkoret räddade datan men gav ett ogenomskinligt fel, och
       * serien Skatteverket kräver ska vara obruten låg i händerna på en
       * klient. app.issue_customer_invoice tar seriens lås, prövar
       * formkraven och behörigheten, och returnerar den skapade raden.
       */
      const { data, error } = await supabase
        .rpc("issue_customer_invoice", {
          p_user_id: input.userId,
          p_description: input.description,
          p_net_ore: input.netOre,
          p_vat_ore: input.vatOre,
          p_vat_rate: input.vatRate,
          p_due_at: input.dueAt,
          p_customer_name: input.customerName,
          p_customer_org_number: input.customerOrgNumber,
          p_customer_address: input.customerAddress,
          p_period_start: input.periodStart,
          p_period_end: input.periodEnd,
        })
        .single();
      if (error) throw error;

      await supabase
        .from("account_billing")
        .update({ due_at: input.dueAt })
        .eq("user_id", input.userId);

      const invoice = toCustomerInvoice(data);

      // Momsfakturan till kundens e-post. Adressen hämtas ur profilen; finns
      // ingen går fakturan ändå att hämta i inloggningen, och drift ser i
      // utkorgen att inget mejl köades.
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("display_name")
        .eq("user_id", input.userId)
        .maybeSingle();

      if (input.recipientEmail) {
        await enqueueEmail(
          invoiceEmail({
            invoiceNumber: invoice.invoiceNumber,
            issuedAt: invoice.issuedAt,
            dueAt: invoice.dueAt,
            seller: COMPANY,
            customer: {
              name: profile?.display_name ?? input.recipientEmail,
              orgNumber: null,
              email: input.recipientEmail,
              address: null,
            },
            lines: [{ description: invoice.description, quantity: 1, unitPriceOre: invoice.netOre }],
            note: null,
            totals: {
              netOre: invoice.netOre,
              vatOre: invoice.vatOre,
              grossOre: invoice.grossOre,
              vatRate: invoice.vatRate,
            },
          }),
          invoice.id,
        );
      }

      return invoice;
    },
    async registerPayment(input) {
      const { data: invoice, error: readError } = await supabase
        .from("customer_invoices")
        .select("*")
        .eq("id", input.invoiceId)
        .single();
      if (readError) throw readError;

      const { error } = await supabase
        .from("customer_invoices")
        .update({
          status: "paid",
          paid_at: input.paidAt,
          payment_reference: input.reference,
          receipt_number: `K-${invoice.invoice_number}`,
        })
        .eq("id", input.invoiceId);
      if (error) throw error;

      // Betalning öppnar kontot igen. Lämnas closed_at kvar hålls en
      // betalande kund utelåst, vilket är det värsta felet i hela kedjan.
      const { error: billingError } = await supabase
        .from("account_billing")
        .update({ paid_at: input.paidAt, closed_at: null })
        .eq("user_id", invoice.user_id);
      if (billingError) throw billingError;

      if (input.recipientEmail) {
        const record = toCustomerInvoice(invoice);
        await enqueueEmail(
          receiptEmail(
            {
              invoiceNumber: record.invoiceNumber,
              issuedAt: record.issuedAt,
              dueAt: record.dueAt,
              seller: COMPANY,
              customer: {
                name: input.recipientEmail,
                orgNumber: null,
                email: input.recipientEmail,
                address: null,
              },
              lines: [
                { description: record.description, quantity: 1, unitPriceOre: record.netOre },
              ],
              note: null,
              totals: {
                netOre: record.netOre,
                vatOre: record.vatOre,
                grossOre: record.grossOre,
                vatRate: record.vatRate,
              },
            },
            { paidAt: input.paidAt, receiptNumber: `K-${record.invoiceNumber}` },
          ),
          record.id,
        );
      }
    },
    async closeAccount(userId) {
      const { error } = await supabase
        .from("account_billing")
        .update({ closed_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (error) throw error;
    },
    async listOutbox() {
      const { data, error } = await supabase
        .from("outbound_emails")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []).map(
        (row): OutboundEmailRecord => ({
          id: row.id,
          recipient: row.recipient,
          subject: row.subject,
          kind: row.kind,
          status: row.status,
          attempts: row.attempts,
          lastError: row.last_error,
          createdAt: row.created_at,
          sentAt: row.sent_at,
        }),
      );
    },
    async retryEmail(id) {
      const { error } = await supabase.rpc("retry_outbound_email", { p_id: id });
      if (error) throw error;
    },
  },

  ops: {
    async listSecrets() {
      const { data, error } = await supabase.rpc("list_integration_secrets");
      if (error) throw error;
      return (data ?? []).map(
        (row: { provider: string; last4: string; updated_at: string }): SecretInfo => ({
          provider: row.provider,
          last4: row.last4,
          updatedAt: row.updated_at,
        }),
      );
    },
    async setSecret(provider, secret) {
      const { error } = await supabase.rpc("set_integration_secret", {
        p_provider: provider,
        p_secret: secret,
      });
      if (error) throw error;
    },
    async deleteSecret(provider) {
      const { error } = await supabase.rpc("delete_integration_secret", {
        p_provider: provider,
      });
      if (error) throw error;
    },

    async listProfessionalTerms() {
      const { data, error } = await supabase.rpc("list_professional_terms");
      if (error) throw error;
      return (data ?? []).map((row) => ({
        professionalId: row.professional_id,
        name: row.name,
        company: row.company,
        billingEmail: row.billing_email,
        referralFeeSek: row.referral_fee === null ? null : Number(row.referral_fee),
        uninvoicedBillable: Number(row.uninvoiced_billable),
      }));
    },
    async setReferralFee(professionalId, feeSek) {
      const { error } = await supabase.rpc("set_referral_fee", {
        p_professional_id: professionalId,
        p_fee_sek: feeSek,
      });
      if (error) throw error;
    },
    async listBillingPlans() {
      const { data, error } = await supabase.from("billing_plans").select("*");
      if (error) throw error;
      return (data ?? []).map((row) => ({
        professionalId: row.professional_id,
        planKind: row.plan_kind as "per_case" | "subscription" | "usage" | "enterprise",
        unlockFeeSek: row.unlock_fee_sek === null ? null : Number(row.unlock_fee_sek),
        monthlyFeeSek: row.monthly_fee_sek === null ? null : Number(row.monthly_fee_sek),
        shadow: row.shadow,
      }));
    },
    async setBillingPlan({ professionalId, planKind, unlockFeeSek, monthlyFeeSek }) {
      const { error } = await supabase.rpc("set_billing_plan", {
        p_professional_id: professionalId,
        p_plan_kind: planKind,
        p_unlock_fee_sek: unlockFeeSek,
        p_monthly_fee_sek: monthlyFeeSek,
      });
      if (error) throw error;
    },
    async setBillingHold(professionalId, hold, reason) {
      const { error } = await supabase.rpc("set_billing_hold", {
        p_professional_id: professionalId,
        p_hold: hold,
        p_reason: reason ?? null,
      });
      if (error) throw error;
    },
    async setBillingShadow(professionalId, shadow) {
      const { error } = await supabase.rpc("set_billing_shadow", {
        p_professional_id: professionalId,
        p_shadow: shadow,
      });
      if (error) throw error;
    },
    async setCompanyPlan({ monthlyExVatSek, businessExVatSek, enterpriseExVatSek }) {
      if (!Number.isFinite(monthlyExVatSek) || monthlyExVatSek <= 0) {
        throw new Error("Ogiltigt belopp");
      }
      const { error } = await supabase.from("app_settings").upsert({
        key: "company_plan",
        value: {
          monthly_ex_vat_sek: Math.round(monthlyExVatSek),
          business_ex_vat_sek: businessExVatSek == null ? null : Math.round(businessExVatSek),
          enterprise_ex_vat_sek: enterpriseExVatSek == null ? null : Math.round(enterpriseExVatSek),
        },
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    async getRetentionPolicy() {
      // Driftparametern i app_settings; standarden i koden som reserv.
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "retention_policy")
        .maybeSingle();
      if (error) throw error;
      const raw = (data?.value as { overrides?: RetentionOverride[] } | null) ?? null;
      return mergeRetentionPolicy(DEFAULT_RETENTION, raw?.overrides ?? []);
    },
    async setRetentionPolicy(overrides) {
      const { error } = await supabase.from("app_settings").upsert({
        key: "retention_policy",
        value: toJson({ overrides }),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    async northStarCounts() {
      const { data, error } = await supabase.rpc("north_star_counts");
      if (error) throw error;
      const row = (data ?? [])[0];
      return {
        recovered: Number(row?.recovered ?? 0),
        inHealth: Number(row?.in_health ?? 0),
        badChurn: Number(row?.bad_churn ?? 0),
        openCases: Number(row?.open_cases ?? 0),
      };
    },
  },

  cases: {
    async getLatest() {
      const selected = localStorage.getItem(ACTIVE_CASE_KEY);
      if (selected) {
        const { data, error } = await supabase
          .from("cases").select("*").eq("id", selected).maybeSingle();
        if (error) throw error;
        // Raden kan ha försvunnit eller åtkomsten återkallats - radskyddet
        // svarar då tomt, och valet faller tillbaka till senaste.
        if (data) return toCase(data as CaseRow);
        localStorage.removeItem(ACTIVE_CASE_KEY);
      }
      // Helt avslutade ärenden (stängda utan hälsoläge) ska inte tränga sig
      // före ett pågående - men finns inget annat visas det senaste ändå,
      // så att avslutsbanderollen och "Återuppta" är nåbara.
      const active = await supabase
        .from("cases")
        .select("*")
        .or("closed_at.is.null,health_mode.eq.true")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (active.error) throw active.error;
      if (active.data) return toCase(active.data as CaseRow);
      const latest = await supabase
        .from("cases")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest.error) throw latest.error;
      return latest.data ? toCase(latest.data as CaseRow) : null;
    },
    async listMine() {
      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => toCase(row as CaseRow));
    },
    select(caseId) {
      if (caseId) localStorage.setItem(ACTIVE_CASE_KEY, caseId);
      else localStorage.removeItem(ACTIVE_CASE_KEY);
    },
    async create(input) {
      const { data, error } = await supabase
        .from("cases")
        .insert({
          user_id: input.userId,
          org_number: input.orgNumber,
          company_name: input.companyName,
          employees: input.employees,
          can_pay_salary: input.canPaySalary,
          salary_amount: input.salaryAmount,
          salary_day: input.salaryDay,
          can_pay_tax: input.canPayTax,
          tax_amount: input.taxAmount,
          tax_day: input.taxDay,
          can_pay_rent: input.canPayRent,
          rent_amount: input.rentAmount,
          rent_day: input.rentDay,
          can_pay_suppliers: input.canPaySuppliers,
          total_debt: input.totalDebt,
          quick_liquidation_value: input.quickLiquidationValue,
          recommendation_type: input.recommendationType,
          recommendation_title: input.recommendationTitle,
          recommendation_description: input.recommendationDescription,
          recommendation_reasons: input.recommendationReasons,
          recommendation_next_steps: input.recommendationNextSteps,
        })
        .select()
        .single();
      if (error) throw error;
      return toCase(data as CaseRow);
    },
    async createMinimal(userId) {
      const { data, error } = await supabase
        .from("cases")
        .insert({ user_id: userId, org_number: "" })
        .select()
        .single();
      if (error) throw error;
      return toCase(data as CaseRow);
    },
    async close({ caseId, reason, note, enterHealth }) {
      const { error } = await supabase.rpc("close_case", {
        p_case_id: caseId,
        p_reason: reason,
        p_note: note ?? null,
        p_enter_health: enterHealth ?? false,
      });
      if (error) throw error;
    },
    async reopen(caseId) {
      const { error } = await supabase.rpc("reopen_case", { p_case_id: caseId });
      if (error) throw error;
    },
    async setPlanApproval(caseId, approved) {
      const { error } = await supabase.rpc("set_plan_approval", {
        p_case_id: caseId,
        p_approved: approved,
      });
      if (error) throw error;
    },
  },

  kbr: {
    async create(input) {
      const { error } = await supabase.from("kbr_assessments").insert({
        user_id: input.userId,
        case_id: input.caseId ?? null,
        org_number: input.orgNumber,
        company_name: input.companyName,
        ambition_level: input.ambitionLevel,
        has_related_companies: input.hasRelatedCompanies,
        is_part_of_larger_structure: input.isPartOfLargerStructure,
        share_capital: input.shareCapital,
        total_assets: input.totalAssets,
        total_liabilities: input.totalLiabilities,
        status: input.status,
      });
      if (error) throw error;
    },
    async getLatestByCase(caseId) {
      const { data, error } = await supabase
        .from("kbr_assessments")
        .select("status, created_at")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? { status: data.status, createdAt: data.created_at } : null;
    },
  },

  payments: {
    async listByCase(caseId) {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("case_id", caseId)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(toPayment);
    },
    async createMany(rows) {
      if (rows.length === 0) return [];
      const { data, error } = await supabase
        .from("payments")
        .insert(
          rows.map((r) => ({
            case_id: r.caseId,
            user_id: r.userId,
            label: r.label,
            amount: r.amount,
            category: r.category,
            status: r.status,
            due_date: r.dueDate,
            recurring: r.recurring,
          })),
        )
        .select("*");
      if (error) throw error;
      return (data ?? []).map(toPayment);
    },
    async updateStatus(id, status) {
      const { error } = await supabase.from("payments").update({ status }).eq("id", id);
      if (error) throw error;
    },
  },

  invoices: {
    async listByCase(caseId) {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("case_id", caseId)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(toInvoice);
    },
    async createMany(rows) {
      if (rows.length === 0) return [];
      const { data, error } = await supabase
        .from("invoices")
        .insert(
          rows.map((r) => ({
            case_id: r.caseId,
            user_id: r.userId,
            label: r.label,
            amount: r.amount,
            direction: r.direction,
            status: r.status,
            issue_date: r.issueDate,
            due_date: r.dueDate,
            counterpart: r.counterpart,
          })),
        )
        .select("*");
      if (error) throw error;
      return (data ?? []).map(toInvoice);
    },
    async updateStatus(id, status) {
      const { error } = await supabase.from("invoices").update({ status }).eq("id", id);
      if (error) throw error;
    },
  },

  professionals: {
    async listActive() {
      const { data, error } = await supabase.from("professionals").select("*").eq("active", true);
      if (error) throw error;
      return (data ?? []).map(
        (row): ProfessionalRecord => ({
          id: row.id,
          name: row.name,
          company: row.company,
          category: row.category,
          description: row.description,
          location: row.location,
          email: row.email,
          phone: row.phone,
          website: row.website,
          fixedPrices: asFixedPrices(row.fixed_prices),
          specializations: row.specializations,
          verified: row.verified,
          source: row.source === "public_register" ? "public_register" : "application",
        }),
      );
    },
    async listRatings() {
      const { data, error } = await supabase.from("professional_ratings").select("*");
      if (error) throw error;
      return (data ?? []).map(
        (row): RatingRecord => ({
          professionalId: row.professional_id,
          communicationScore: row.communication_score,
          expertiseScore: row.expertise_score,
          priceTransparencyScore: row.price_transparency_score,
          responseTimeScore: row.response_time_score,
          overallScore: row.overall_score,
        }),
      );
    },

    async getMyProfile() {
      const { data, error } = await supabase.rpc("get_my_professional_profile");
      if (error) throw error;
      const row = (data ?? [])[0];
      if (!row) return null;
      return {
        id: row.id,
        name: row.name,
        company: row.company,
        category: row.category,
        verified: row.verified,
        description: row.description,
        location: row.location,
        email: row.email,
        phone: row.phone,
        website: row.website,
        specializations: row.specializations ?? [],
        fixedPrices: asFixedPrices(row.fixed_prices),
        billingEmail: row.billing_email,
      };
    },
    async updateMyProfile(input) {
      const { error } = await supabase.rpc("update_my_professional_profile", {
        p_description: input.description,
        p_location: input.location,
        p_email: input.email,
        p_phone: input.phone,
        p_website: input.website,
        p_specializations: input.specializations,
        p_fixed_prices: input.fixedPrices as unknown as Json,
        p_billing_email: input.billingEmail,
      });
      if (error) throw error;
    },
    async claimProfile({ professionalId, motivation, contact }) {
      const { error } = await supabase.rpc("claim_professional_profile", {
        p_professional_id: professionalId,
        p_motivation: motivation,
        p_contact: contact,
      });
      if (error) throw error;
    },
    async listMyClaims() {
      // RLS visar även allas anspråk för en administratör, så listan
      // avgränsas uttryckligen till det egna kontot här.
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) return [];
      const { data, error } = await supabase
        .from("profile_claims")
        .select("id, professional_id, status, review_note, created_at")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        professionalId: row.professional_id,
        status: row.status as ProfileClaimRecord["status"],
        reviewNote: row.review_note,
        createdAt: row.created_at,
      }));
    },
    async listTeam(professionalId) {
      const { data, error } = await supabase.rpc("list_firm_team", {
        p_professional_id: professionalId,
      });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        email: row.email,
        role: row.role as "admin" | "member",
        createdAt: row.created_at,
      }));
    },
    async listTeamInvitations(professionalId) {
      const { data, error } = await supabase
        .from("professional_invitations")
        .select("*")
        .eq("professional_id", professionalId)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role as "admin" | "member",
        createdAt: row.created_at,
      }));
    },
    async inviteTeamMember(professionalId, email, role) {
      const { error } = await supabase.rpc("invite_firm_member", {
        p_professional_id: professionalId,
        p_email: email,
        p_role: role,
      });
      if (error) throw error;
    },
    async revokeTeamInvitation(invitationId) {
      const { error } = await supabase.rpc("revoke_firm_invitation", {
        p_invitation_id: invitationId,
      });
      if (error) throw error;
    },
    async removeTeamMember(memberId) {
      const { error } = await supabase.rpc("remove_firm_member", { p_member_id: memberId });
      if (error) throw error;
    },
    async myFirmInvitations() {
      const { data, error } = await supabase.rpc("my_firm_invitations");
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        professionalId: row.professional_id,
        firmName: row.firm_name,
        role: row.role as "admin" | "member",
        createdAt: row.created_at,
      }));
    },
    async acceptFirmInvitation(invitationId) {
      const { error } = await supabase.rpc("accept_firm_invitation", {
        p_invitation_id: invitationId,
      });
      if (error) throw error;
    },
    async listClaims() {
      const { data, error } = await supabase.rpc("list_profile_claims");
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        professionalId: row.professional_id,
        professionalName: row.professional_name,
        claimantEmail: row.claimant_email,
        motivation: row.motivation,
        contact: row.contact,
        status: row.status as ProfileClaimRecord["status"],
        reviewNote: row.review_note,
        createdAt: row.created_at,
      }));
    },
    async reviewClaim(id, approve, note) {
      const { error } = await supabase.rpc("review_profile_claim", {
        p_claim_id: id,
        p_approve: approve,
        p_note: note ?? null,
      });
      if (error) throw error;
    },
  },

  leads: {
    async create({ caseId, professionalId, preview, summary }) {
      const { error } = await supabase.rpc("create_contact_request", {
        p_case_id: caseId,
        p_professional_id: professionalId,
        p_preview: preview as Json,
        p_summary: summary as Json,
      });
      if (error) throw error;
    },
    async listForCase(caseId) {
      const { data, error } = await supabase
        .from("contact_requests")
        .select("id, case_id, professional_id, status, created_at, consent_at, unlocked_at, declined_at, decline_note")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        caseId: row.case_id,
        professionalId: row.professional_id,
        status: row.status as ContactRequestRecord["status"],
        createdAt: row.created_at,
        consentAt: row.consent_at,
        unlockedAt: row.unlocked_at,
        declinedAt: row.declined_at,
        declineNote: row.decline_note,
      }));
    },
    async listMyLeads() {
      const { data, error } = await supabase.rpc("list_lead_previews");
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        professionalId: row.professional_id,
        status: row.status as ContactRequestRecord["status"],
        createdAt: row.created_at,
        unlockedAt: row.unlocked_at,
        preview: row.preview,
        planKind: (row.plan_kind ?? "per_case") as LeadPreviewRecord["planKind"],
        unlockFeeSek: row.unlock_fee_sek === null ? null : Number(row.unlock_fee_sek),
      }));
    },
    async unlock(requestId, termsVersion) {
      const { data, error } = await supabase.rpc("unlock_case_lead", {
        p_request_id: requestId,
        p_terms_version: termsVersion,
      });
      if (error) throw error;
      return data;
    },
    async getUnlocked(requestId) {
      const { data, error } = await supabase.rpc("get_unlocked_lead", {
        p_request_id: requestId,
      });
      if (error) throw error;
      return data;
    },
    async decline(requestId, note) {
      const { error } = await supabase.rpc("decline_case_lead", {
        p_request_id: requestId,
        p_note: note ?? null,
      });
      if (error) throw error;
    },
    async listMyCharges() {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) return [];
      const { data, error } = await supabase
        .from("usage_charges")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        serviceCode: row.service_code as UsageChargeRecord["serviceCode"],
        serviceLabel: row.service_label,
        caseType: row.case_type,
        companyName: row.company_name,
        orgNumber: row.org_number,
        amountOre: Number(row.amount_ore),
        vatRate: Number(row.vat_rate),
        shadow: row.shadow,
        createdAt: row.created_at,
        invoiceId: row.invoice_id,
        contactRequestId: row.contact_request_id,
      }));
    },
  },

  applications: {
    async getMine() {
      const { data, error } = await supabase
        .from("professional_applications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        category: data.category,
        status: data.status,
        reviewNote: data.review_note,
        createdAt: data.created_at,
      } satisfies ApplicationRecord;
    },
    async create(input) {
      const { error } = await supabase.from("professional_applications").insert({
        user_id: input.userId,
        contact_name: input.contactName,
        email: input.email,
        phone: input.phone,
        company: input.company,
        org_number: input.orgNumber,
        category: input.category,
        location: input.location,
        description: input.description,
        website: input.website,
        specializations: input.specializations,
        fixed_prices: toJson(input.fixedPrices),
        credential_authority: input.credentialAuthority,
        credential_reference: input.credentialReference,
        credential_note: input.credentialNote,
        terms_accepted_at: input.termsAcceptedAt,
      });
      if (error) throw error;
    },
    async listAll() {
      const { data, error } = await supabase
        .from("professional_applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(
        (row): ApplicationForReview => ({
          id: row.id,
          category: row.category,
          status: row.status,
          reviewNote: row.review_note,
          createdAt: row.created_at,
          contactName: row.contact_name,
          email: row.email,
          phone: row.phone,
          company: row.company,
          orgNumber: row.org_number,
          location: row.location,
          description: row.description,
          website: row.website,
          specializations: row.specializations ?? [],
          fixedPrices: asFixedPrices(row.fixed_prices),
          credentialAuthority: row.credential_authority,
          credentialReference: row.credential_reference,
          credentialNote: row.credential_note,
          reviewedAt: row.reviewed_at,
        }),
      );
    },
    async approve(id) {
      const { data, error } = await supabase.rpc("approve_professional_application", {
        p_application_id: id,
      });
      if (error) throw error;
      return data as string;
    },
    async review(id, status, note) {
      const { error } = await supabase.rpc("review_professional_application", {
        p_application_id: id,
        p_status: status,
        p_note: note,
      });
      if (error) throw error;
    },
  },

  referrals: {
    async listMine() {
      const { data, error } = await supabase
        .from("referrals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(
        (row): ReferralRecord => ({
          id: row.id,
          professionalId: row.professional_id,
          channel: row.channel,
          status: row.status,
          feeAmount: row.fee_amount === null ? null : Number(row.fee_amount),
          billableAt: row.billable_at,
          createdAt: row.created_at,
        }),
      );
    },
    async create(input) {
      const { error } = await supabase.from("referrals").insert({
        professional_id: input.professionalId,
        referrer_user_id: input.userId,
        case_id: input.caseId,
        channel: input.channel,
      });
      if (error) throw error;
    },
    async updateStatus(id, status) {
      const { error } = await supabase.from("referrals").update({ status }).eq("id", id);
      if (error) throw error;
    },
  },

  documents: {
    async listByCase(caseId) {
      const { data, error } = await supabase
        .from("case_documents")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(toDocument);
    },

    async upload(input) {
      // The case id leads the path. It used to be the uploader's user id,
      // which made a document unreachable for every other party on the case -
      // the rekonstruktör could not open what the company uploaded. Both the
      // table constraint and the storage policies key off this first segment.
      const path = `${input.caseId}/${crypto.randomUUID()}-${sanitiseFileName(
        input.file.name,
      )}`;

      const { error: uploadError } = await supabase.storage
        .from(DOCUMENT_BUCKET)
        .upload(path, input.file, {
          contentType: input.file.type || "application/octet-stream",
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from("case_documents")
        .insert({
          case_id: input.caseId,
          user_id: input.userId,
          kind: input.kind,
          file_name: input.file.name,
          file_size: input.file.size,
          mime_type: input.file.type || "application/octet-stream",
          storage_path: path,
          source: input.source,
          note: input.note,
        })
        .select()
        .single();

      if (error) {
        // Don't leave the object behind with no row pointing at it.
        await supabase.storage.from(DOCUMENT_BUCKET).remove([path]);
        throw error;
      }

      return toDocument(data);
    },

    async remove(id) {
      const { data, error } = await supabase
        .from("case_documents")
        .select("storage_path")
        .eq("id", id)
        .single();
      if (error) throw error;

      // Row first: if the object delete fails we are left with an orphaned
      // file rather than a row pointing at nothing.
      const { error: deleteError } = await supabase
        .from("case_documents")
        .delete()
        .eq("id", id);
      if (deleteError) throw deleteError;

      await supabase.storage.from(DOCUMENT_BUCKET).remove([data.storage_path]);
    },

    async getDownloadUrl(id, expiresInSeconds) {
      const { data, error } = await supabase
        .from("case_documents")
        .select("storage_path")
        .eq("id", id)
        .single();
      if (error || !data) return null;

      const { data: signed, error: signError } = await supabase.storage
        .from(DOCUMENT_BUCKET)
        .createSignedUrl(data.storage_path, expiresInSeconds);
      if (signError || !signed) return null;

      return signed.signedUrl;
    },
    async listSignatures(documentId: string) {
      const { data: rows, error } = await supabase
        .from("document_signatures")
        .select("*")
        .eq("document_id", documentId)
        .order("signed_at", { ascending: true });
      if (error) throw error;
      return (rows ?? []).map((r) => ({
        id: r.id,
        documentId: r.document_id,
        signerUserId: r.signer_user_id,
        signerName: r.signer_name,
        signerEmail: r.signer_email,
        statementVersion: r.statement_version,
        statementText: r.statement_text,
        contentSha256: r.content_sha256,
        signedAt: r.signed_at,
      }));
    },
    async sign(input) {
      // Tidpunkten och behörighetsprövningen bor i funktionen. En
      // signatur vars tidsstämpel klienten satt bevisar ingenting.
      const { data: row, error } = await supabase
        .rpc("sign_document", {
          p_document_id: input.documentId,
          p_signer_name: input.signerName,
          p_content_sha256: input.contentSha256,
          p_statement_version: input.statementVersion,
          p_statement_text: input.statementText,
        })
        .single();
      if (error) throw error;
      const r = row as {
        id: string; document_id: string; signer_user_id: string; signer_name: string;
        signer_email: string; statement_version: string; statement_text: string;
        content_sha256: string; signed_at: string;
      };
      return {
        id: r.id,
        documentId: r.document_id,
        signerUserId: r.signer_user_id,
        signerName: r.signer_name,
        signerEmail: r.signer_email,
        statementVersion: r.statement_version,
        statementText: r.statement_text,
        contentSha256: r.content_sha256,
        signedAt: r.signed_at,
      };
    },

    async setReview(id, action) {
      // Rollprövningen bor i funktionen: godkännande kräver rådgivarroll.
      const { error } = await supabase.rpc("set_document_review", {
        p_document_id: id,
        p_action: action,
      });
      if (error) throw error;
    },
  },

  /**
   * Simuleringarna.
   *
   * KÖRNINGEN SKER I KLIENTEN HÄR, och det är en känd skillnad mot
   * aws-adaptern - inte ett förbiseende. PostgREST har ingen serverprocess att
   * lägga motorn i. Motorn är densamma (src/lib/montecarlo/motor.ts), så siffrorna blir
   * identiska för samma frö; det som skiljer är VEM som räknar dem, och
   * därmed hur mycket en klient i teorin kan påverka. Radskyddet begränsar
   * det till det egna ärendet.
   *
   * Det finns ingen kö: allt körs direkt, och en riktigt tung körning
   * belastar då webbläsaren i stället för att köas.
   */
  /**
   * De yttre källorna: PostgREST-bryggan har ingen plats att lägga hämtaren i.
   *
   * Hämtningarna kräver en serverdel med nycklar och SSRF-skydd. Den finns
   * inte här, och därför hämtas ingenting - `null` säger just det. Att
   * hitta på ett resultat hade varit att påstå att vi kollat.
   */
  sources: {
    async google() {
      return null;
    },
    async website() {
      return null;
    },
    async news() {
      return null;
    },
  },

  /**
   * Radering via bryggan.
   *
   * Allt ligger i databasfunktionerna, och det är avsiktligt: en klient som
   * raderar tabell för tabell lämnar halvvägs-tillstånd så fort den tappar
   * nätet. Här finns bara anropen.
   */
  privacy: {
    async getErasureRequest() {
      const { data, error } = await supabase
        .from("erasure_requests")
        .select("*")
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? toErasureRequest(data) : null;
    },
    async requestErasure() {
      const { data, error } = await supabase.rpc("request_account_erasure");
      if (error) throw error;
      return toErasureRequest(data);
    },
    async cancelErasure() {
      const { data, error } = await supabase.rpc("cancel_account_erasure");
      if (error) throw error;
      return toErasureRequest(data);
    },
  },

  simulations: {
    async listByCase(caseId) {
      const { data, error } = await supabase
        .from("simulations")
        .select("*")
        .eq("case_id", caseId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(toSimulation);
    },
    async get(simulationId) {
      const { data, error } = await supabase
        .from("simulations").select("*").eq("id", simulationId).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: runs } = await supabase
        .from("simulation_runs").select("*").eq("simulation_id", simulationId)
        .order("queued_at", { ascending: false }).limit(25);
      return { ...toSimulation(data), runs: (runs ?? []).map(toRun) };
    },
    async create(input) {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Inte inloggad");
      const fel = valideraSpec(specMed(input.spec, input.name, 10000, 1));
      if (fel.length > 0) throw new Error(fel.map((f) => f.meddelande).join(" "));
      const { data, error } = await supabase.from("simulations").insert({
        case_id: input.caseId, created_by: userId, name: input.name,
        description: input.description ?? null, spec: input.spec as Json,
      }).select().single();
      if (error) throw error;
      return toSimulation(data);
    },
    async update(input) {
      const fel = valideraSpec(specMed(input.spec, input.name, 10000, 1));
      if (fel.length > 0) throw new Error(fel.map((f) => f.meddelande).join(" "));
      const { data, error } = await supabase.from("simulations").update({
        name: input.name, description: input.description ?? null, spec: input.spec as Json,
      }).eq("id", input.simulationId).select().single();
      if (error) throw error;
      return toSimulation(data);
    },
    async remove(simulationId) {
      const { error } = await supabase.from("simulations").delete().eq("id", simulationId);
      if (error) throw error;
    },
    async run(input) {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Inte inloggad");
      const { data: sim, error: simFel } = await supabase
        .from("simulations").select("*").eq("id", input.simulationId).maybeSingle();
      if (simFel) throw simFel;
      if (!sim) throw new Error("Simuleringen finns inte.");

      // Fröet väljs EN gång och skrivs ned - annars går körningen inte att
      // upprepa, och då är den inte ett underlag.
      const fro = input.seed ?? nyttFro();
      const spec = specMed(sim.spec, sim.name, input.iterations, fro);
      const { data: rad, error } = await supabase.from("simulation_runs").insert({
        simulation_id: sim.id, case_id: sim.case_id, started_by: userId,
        seed: fro, engine_version: MOTORVERSION, spec: sim.spec as Json,
        spec_version: sim.spec_version, iterations: input.iterations,
        status: "running", started_at: new Date().toISOString(),
      }).select().single();
      if (error) throw error;

      try {
        const resultat = korSimulering(spec);
        const { data: klar, error: uppdFel } = await supabase.from("simulation_runs").update({
          status: "done",
          results: { outputs: resultat.outputs } as unknown as Json,
          notes: resultat.anmarkningar as unknown as Json,
          duration_ms: resultat.varaktighetMs,
          discarded_iterations: resultat.forkastadeIterationer,
          finished_at: new Date().toISOString(),
        }).eq("id", rad.id).select().single();
        if (uppdFel) throw uppdFel;
        return toRun(klar);
      } catch (e) {
        await supabase.from("simulation_runs").update({
          status: "failed", error: e instanceof Error ? e.message : "Okänt fel",
          finished_at: new Date().toISOString(),
        }).eq("id", rad.id);
        throw e;
      }
    },
    async cancel(simulationId) {
      const { data, error } = await supabase.from("simulation_runs")
        .update({ status: "cancelled", finished_at: new Date().toISOString() })
        .eq("simulation_id", simulationId).in("status", ["queued", "running"]).select("id");
      if (error) throw error;
      return (data ?? []).length;
    },
    async latestRun(simulationId) {
      const { data, error } = await supabase.from("simulation_runs").select("*")
        .eq("simulation_id", simulationId).order("queued_at", { ascending: false })
        .limit(1).maybeSingle();
      if (error) throw error;
      return data ? toRun(data) : null;
    },
    async getRun(runId) {
      const { data, error } = await supabase.from("simulation_runs").select("*").eq("id", runId).maybeSingle();
      if (error) throw error;
      return data ? toRun(data) : null;
    },
  },

  financial: {
    async getLatestSnapshot(caseId) {
      // Radskyddet avgör vem som får se den. Ingen where-sats på användaren.
      const { data, error } = await supabase
        .from("financial_snapshots")
        .select("payload")
        .eq("case_id", caseId)
        .order("captured_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      // null = "vi har inte läst något", inte "det finns inget". Skillnaden
      // är hela poängen med FinancialPort - se kommentaren i ports.ts.
      return data ? (data.payload as unknown as FinancialSnapshot) : null;
    },
    async importSie(input) {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Inte inloggad");

      /*
       * HÄR TOLKAS FILEN I KLIENTEN, och det är en känd skillnad mot
       * aws-adaptern - inte ett förbiseende.
       *
       * Supabase har ingen egen serverprocess att lägga tolkningen i;
       * PostgREST skriver till tabellen, och det är klienten som anropar.
       * Den som kör den här adaptern kan alltså i teorin skriva en
       * lägesbild som inte motsvarar någon fil. Radskyddet begränsar det
       * till det EGNA ärendet, så det är inte en väg till någon annans
       * data - men det är skälet till att aws-adaptern skickar bytesen
       * och låter servern tolka. Supabase är en brygga, inte målet.
       */
      const outcome = parseSie(input.bytes);
      if (!outcome.ok) throw new Error(`Filen kunde inte tolkas som SIE: ${outcome.error}`);
      const capturedAt = new Date().toISOString();
      const snapshot = snapshotFromSie(outcome.sie, {
        fileName: input.fileName,
        capturedAt,
      });
      const { error } = await supabase.from("financial_snapshots").insert({
        case_id: input.caseId,
        user_id: userId,
        provider: "generic",
        captured_at: capturedAt,
        org_number: outcome.sie.orgNumber,
        company_name: outcome.sie.companyName,
        fiscal_year_start: outcome.sie.fiscalYear?.start ?? null,
        fiscal_year_end: outcome.sie.fiscalYear?.end ?? null,
        source_file_name: input.fileName,
        payload: snapshot as unknown as Json,
      });
      if (error) throw error;
      return snapshot;
    },
  },

  companyLookup: {
    async lookup(orgNumber) {
      const digits = orgNumber.replace(/\D/g, "");
      try {
        const { data, error } = await supabase.functions.invoke("lookup-company", {
          body: { orgNumber: digits },
        });
        if (error || !data?.name) return null;
        // De valfria fälten skickas vidare BARA när källan lämnade dem.
        // Ett tomt registerfält som fylls med "" eller false blir en
        // uppgift användaren tror är kontrollerad - vi lämnar det
        // odefinierat i stället, och gränssnittet visar det inte alls.
        return {
          name: data.name,
          legalForm: data.legalForm || "",
          address: data.address || "",
          sniCode: data.sniCode || "",
          sniDescription: data.sniDescription || "",
          ...(data.registrationYear ? { registrationYear: String(data.registrationYear) } : {}),
          ...(Array.isArray(data.boardMembers) && data.boardMembers.length > 0
            ? { boardMembers: data.boardMembers.map(String) }
            : {}),
          ...(typeof data.fTax === "boolean" ? { fTax: data.fTax } : {}),
          ...(typeof data.vatRegistered === "boolean" ? { vatRegistered: data.vatRegistered } : {}),
          ...(data.status ? { status: String(data.status) } : {}),
        };
      } catch {
        return null;
      }
    },
  },
};
