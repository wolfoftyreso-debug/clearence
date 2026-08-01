import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { nextInvoiceNumber } from "@/lib/invoice";
import type { DataPort } from "../ports";
import type {
  AccountBillingRecord,
  ApplicationRecord,
  CaseMessage,
  CaseRecord,
  ContactMessageRecord,
  CustomerInvoiceRecord,
  CustomerOverview,
  DocumentRecord,
  FixedPrice,
  InvoiceRecord,
  PaymentRecord,
  ProfessionalRecord,
  RatingRecord,
  ReferralRecord,
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
  started_at: string;
  due_at: string | null;
  paid_at: string | null;
  closed_at: string | null;
  note: string | null;
}): AccountBillingRecord => ({
  userId: row.user_id,
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
}): CustomerInvoiceRecord => ({
  id: row.id,
  userId: row.user_id,
  invoiceNumber: row.invoice_number,
  issuedAt: row.issued_at,
  dueAt: row.due_at,
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

  messages: {
    async listByCase(caseId) {
      const { data, error } = await supabase
        .from("case_messages")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(
        (row): CaseMessage => ({
          id: row.id,
          caseId: row.case_id,
          authorUserId: row.author_user_id,
          body: row.body,
          createdAt: row.created_at,
          readAt: row.read_at,
        }),
      );
    },
    async send(caseId, body) {
      const { data: session } = await supabase.auth.getSession();
      const { error } = await supabase.from("case_messages").insert({
        case_id: caseId,
        author_user_id: session.session?.user.id ?? null,
        body,
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
      const { data: existing, error: readError } = await supabase
        .from("customer_invoices")
        .select("invoice_number");
      if (readError) throw readError;

      const number = nextInvoiceNumber(
        (existing ?? []).map((r) => r.invoice_number),
        new Date(),
      );

      const { data, error } = await supabase
        .from("customer_invoices")
        .insert({
          user_id: input.userId,
          invoice_number: number,
          due_at: input.dueAt,
          net_ore: input.netOre,
          vat_ore: input.vatOre,
          gross_ore: input.netOre + input.vatOre,
          vat_rate: input.vatRate,
          description: input.description,
        })
        .select()
        .single();
      if (error) throw error;

      await supabase
        .from("account_billing")
        .update({ due_at: input.dueAt })
        .eq("user_id", input.userId);

      return toCustomerInvoice(data);
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
    },
    async closeAccount(userId) {
      const { error } = await supabase
        .from("account_billing")
        .update({ closed_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (error) throw error;
    },
  },

  cases: {
    async getLatest() {
      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? toCase(data as CaseRow) : null;
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
  },

  financial: {
    async getLatestSnapshot() {
      // No accounting-system adapter is deployed yet. Returning null makes the
      // interface say "not connected" rather than showing an empty balance
      // sheet, which would read as "you owe nothing".
      return null;
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
        return {
          name: data.name,
          legalForm: data.legalForm || "",
          address: data.address || "",
          sniCode: data.sniCode || "",
          sniDescription: data.sniDescription || "",
        };
      } catch {
        return null;
      }
    },
  },
};
