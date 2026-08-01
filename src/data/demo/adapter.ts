/**
 * In-memory implementation of DataPort, for demonstrations.
 *
 * The point of the port was that the application should not care which
 * backend is behind it. This is the proof: the whole product runs against
 * this file with no network at all, which is what makes it possible to show
 * the signed-in pages in a sandbox that blocks outbound requests.
 *
 * THIS MUST NEVER BE THE ACTIVE ADAPTER IN PRODUCTION. It accepts any
 * password, stores everything in localStorage, and serves invented advisors.
 * Selection happens in ../index.ts and is gated on an explicit build flag.
 *
 * Everything it returns is fictional and the UI says so via DemoBanner. That
 * matters more here than usual: this is a product about insolvency, and a
 * user must never mistake seeded numbers for an assessment of their company.
 */

import type { DataPort } from "../ports";
import type {
  AccountBillingRecord,
  ApplicationForReview,
  AuthUser,
  CaseMessage,
  CaseRecord,
  CaseTask,
  ContactMessageRecord,
  CustomerInvoiceRecord,
  OutboundEmailRecord,
  DocumentRecord,
  UserProfile,
  InvoiceRecord,
  PaymentRecord,
  ProfessionalRecord,
  RatingRecord,
  ReferralRecord,
} from "../types";
import type { FinancialSnapshot, OpenItem, Voucher } from "@/lib/financial/model";
import { nextInvoiceNumber } from "@/lib/invoice";
import { accountClosedEmail, invoiceEmail, receiptEmail } from "@/lib/email/messages";
import { COMPANY } from "@/lib/company";

const STORAGE_KEY = "clearance-demo-state";

interface DemoState {
  user: AuthUser | null;
  cases: CaseRecord[];
  payments: PaymentRecord[];
  invoices: InvoiceRecord[];
  documents: DocumentRecord[];
  referrals: ReferralRecord[];
  application: ApplicationForReview | null;
  contactMessages: ContactMessageRecord[];
  profile: UserProfile | null;
  caseMessages: CaseMessage[];
  caseTasks: CaseTask[];
  billing: AccountBillingRecord | null;
  customerInvoices: CustomerInvoiceRecord[];
  outbox: OutboundEmailRecord[];
}

const emptyState = (): DemoState => ({
  user: null,
  cases: [],
  payments: [],
  invoices: [],
  documents: [],
  referrals: [],
  application: null,
  contactMessages: [],
  profile: null,
  caseMessages: [],
  caseTasks: [],
  billing: null,
  customerInvoices: [],
  outbox: [],
});

/** Files cannot go in localStorage, so they live for the session only. */
const fileStore = new Map<string, File>();

let state: DemoState = emptyState();
const listeners = new Set<(user: AuthUser | null) => void>();

const load = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = { ...emptyState(), ...(JSON.parse(raw) as DemoState) };
  } catch {
    state = emptyState();
  }
};

const save = () => {
  try {
    // Documents are kept, but their blobs are not; on reload the metadata
    // still lists them and the download simply reports the file is gone.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private browsing, quota, whatever. The demo still works in memory.
  }
};

load();

const notify = () => {
  for (const listener of listeners) listener(state.user);
};

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `demo-${Math.floor(Number(String(Date.now()).slice(-9)))}-${listeners.size}`;

const now = () => new Date().toISOString();

/** Fakturaraden som fakturamodell, så att e-postbyggarna kan användas. */
const demoInvoice = (record: CustomerInvoiceRecord, email: string) => ({
  invoiceNumber: record.invoiceNumber,
  issuedAt: record.issuedAt,
  dueAt: record.dueAt,
  seller: COMPANY,
  customer: { name: email, orgNumber: null, email, address: null },
  lines: [{ description: record.description, quantity: 1, unitPriceOre: record.netOre }],
  note: null,
  totals: {
    netOre: record.netOre,
    vatOre: record.vatOre,
    grossOre: record.grossOre,
    vatRate: record.vatRate,
  },
});

/** Lägger i utkorgen. Demoläget skickar aldrig - raden visas bara i driften. */
const queue = (
  message: { recipient: string; subject: string; kind: string },
  invoiceId: string | null,
) => {
  void invoiceId;
  state.outbox.unshift({
    id: uid(),
    recipient: message.recipient,
    subject: message.subject,
    kind: message.kind,
    status: "pending",
    attempts: 0,
    lastError: null,
    createdAt: now(),
    sentAt: null,
  });
};

/** Stable per-address id that does not contain the address itself. */
const demoUserId = (email: string): string => {
  let hash = 0;
  for (let i = 0; i < email.length; i += 1) {
    hash = (hash * 31 + email.charCodeAt(i)) | 0;
  }
  return `demo-${Math.abs(hash).toString(36)}`;
};

const isoDaysFromNow = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/* -------------------------------------------------------------------------- */
/* Seed data                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Invented advisors. The names are deliberately generic and the org numbers
 * are from the 556000-serie used for examples - nothing here should be
 * mistakable for a real firm, because a reader in trouble might call one.
 */
const DEMO_PROFESSIONALS: ProfessionalRecord[] = [
  {
    id: "demo-pro-1",
    name: "Exempel Rekonstruktion AB",
    company: "Exempel Rekonstruktion AB",
    category: "rekonstruktor",
    description:
      "Påhittad byrå i demoläget. Arbetar enligt exemplet med företagsrekonstruktion för mindre bolag.",
    location: "Stockholm",
    email: "demo@example.invalid",
    phone: null,
    website: null,
    fixedPrices: [
      { service: "Inledande genomgång", price: 0 },
      { service: "Ansökan om rekonstruktion", price: 45000 },
    ],
    specializations: ["Aktiebolag", "Tjänsteföretag"],
    verified: true,
  },
  {
    id: "demo-pro-2",
    name: "Demo Obeståndsjuridik",
    company: "Demo Obeståndsjuridik HB",
    category: "affarsjurist",
    description:
      "Påhittad byrå i demoläget. Rådgivning om företrädaransvar och kontrollbalansräkning.",
    location: "Göteborg",
    email: "demo@example.invalid",
    phone: null,
    website: null,
    fixedPrices: [{ service: "Första rådgivningstimme", price: 2500 }],
    specializations: ["Obeståndsfrågor", "Styrelseansvar"],
    verified: true,
  },
  {
    id: "demo-pro-3",
    name: "Testrevisorerna",
    company: "Testrevisorerna AB",
    category: "revisor",
    description:
      "Påhittad byrå i demoläget. Granskar kontrollbalansräkningar och upprättar underlag.",
    location: "Malmö",
    email: "demo@example.invalid",
    phone: null,
    website: null,
    fixedPrices: [{ service: "Granskning av kontrollbalansräkning", price: 12000 }],
    specializations: ["Kontrollbalansräkning"],
    verified: true,
  },
];

const DEMO_RATINGS: RatingRecord[] = [];

/** A case with figures that put the company in a recognisably tight spot. */
const seedCase = (userId: string): CaseRecord => ({
  id: `demo-case-${userId}`,
  orgNumber: "556012-3456",
  companyName: "Demobolaget AB",
  employees: "6-10",
  canPaySalary: false,
  salaryAmount: "420000",
  salaryDay: 25,
  canPayTax: false,
  taxAmount: "165000",
  taxDay: 12,
  canPayRent: true,
  rentAmount: "58000",
  rentDay: 1,
  canPaySuppliers: false,
  totalDebt: "3200000",
  quickLiquidationValue: "950000",
  recommendationType: "reconstruction",
  recommendationTitle: "Företagsrekonstruktion bör utredas",
  recommendationDescription:
    "Exempelärende i demoläget. Siffrorna är påhittade och beskriver inte något verkligt bolag.",
  recommendationReasons: [
    "Varken löner eller skatt kan betalas på förfallodagen",
    "Tillgångarna täcker knappt en tredjedel av skulderna",
  ],
  recommendationNextSteps: [
    "Kontakta en rekonstruktör för bedömning av livskraft",
    "Vidta verksam åtgärd före skattens förfallodag",
  ],
  createdAt: now(),
  updatedAt: now(),
});

const seedPayments = (caseId: string): PaymentRecord[] => [
  {
    id: "demo-pay-1",
    caseId,
    label: "Löner",
    amount: 420000,
    category: "salary",
    status: "critical",
    dueDate: isoDaysFromNow(9),
    recurring: true,
  },
  {
    id: "demo-pay-2",
    caseId,
    label: "Skatt och moms",
    amount: 165000,
    category: "tax",
    status: "critical",
    dueDate: isoDaysFromNow(3),
    recurring: true,
  },
  {
    id: "demo-pay-3",
    caseId,
    label: "Lokalhyra",
    amount: 58000,
    category: "rent",
    status: "pending",
    dueDate: isoDaysFromNow(14),
    recurring: true,
  },
  {
    id: "demo-pay-4",
    caseId,
    label: "Leverantörsfaktura 4021",
    amount: 96000,
    category: "supplier",
    status: "postponed",
    dueDate: isoDaysFromNow(21),
    recurring: false,
  },
];

const seedInvoices = (caseId: string): InvoiceRecord[] => [
  {
    id: "demo-inv-1",
    caseId,
    label: "Faktura 3120",
    amount: 185000,
    direction: "in",
    status: "unpaid",
    issueDate: isoDaysFromNow(-24),
    dueDate: isoDaysFromNow(6),
    counterpart: "Exempelkund AB",
  },
  {
    id: "demo-inv-2",
    caseId,
    label: "Faktura 3121",
    amount: 74000,
    direction: "in",
    status: "overdue",
    issueDate: isoDaysFromNow(-52),
    dueDate: isoDaysFromNow(-8),
    counterpart: "Sen Betalare AB",
  },
  {
    id: "demo-inv-3",
    caseId,
    label: "Underleverantör mars",
    amount: 96000,
    direction: "out",
    status: "unpaid",
    issueDate: isoDaysFromNow(-10),
    dueDate: isoDaysFromNow(21),
    counterpart: "Demo Underleverantör AB",
  },
];

/** Populates a fresh account so the signed-in pages have something to show. */
const seedForUser = (userId: string) => {
  const demoCase = seedCase(userId);
  state.cases = [demoCase];
  state.payments = seedPayments(demoCase.id);
  state.invoices = seedInvoices(demoCase.id);
  state.documents = [];
  state.referrals = [];
  state.application = null;
};

/**
 * A snapshot shaped like something a real accounting system would return, so
 * the insight engine has something to chew on in the demo. Same rules as the
 * rest of the demo data: obviously invented names, and the tax account is
 * absent because no provider supplies it.
 */
const demoSnapshot = (caseId: string): FinancialSnapshot => {
  const prov = (endpoint: string, ref: string | null = null) => ({
    origin: { kind: "accounting" as const, provider: "fortnox" as const, endpoint },
    fetchedAt: now(),
    sourceRef: ref,
  });

  const supplier = (
    id: string,
    name: string,
    amount: number,
    dueInDays: number,
  ): OpenItem => ({
    id,
    kind: "payable",
    counterpartyId: `demo-cp-${name}`,
    counterpartyName: name,
    documentNumber: id,
    issueDate: isoDaysFromNow(dueInDays - 30),
    dueDate: isoDaysFromNow(dueInDays),
    totalAmount: amount,
    outstandingAmount: amount,
    currency: "SEK",
    provenance: prov("/supplierinvoices", id),
  });

  const customer = (
    id: string,
    name: string,
    amount: number,
    dueInDays: number,
  ): OpenItem => ({
    ...supplier(id, name, amount, dueInDays),
    kind: "receivable",
    provenance: prov("/invoices", id),
  });

  const rentVoucher = (monthsAgo: number, amount: number): Voucher => {
    const d = new Date();
    d.setMonth(d.getMonth() - monthsAgo);
    const date = `${d.toISOString().slice(0, 8)}05`;
    return {
      id: `demo-v-${monthsAgo}`,
      series: "A",
      number: String(100 + monthsAgo),
      date,
      description: "Lokalhyra",
      rows: [{ accountNumber: "5010", amount, description: "Lokalhyra" }],
      provenance: prov("/vouchers", `A-${100 + monthsAgo}`),
    };
  };

  return {
    id: `demo-snapshot-${caseId}`,
    provider: "fortnox",
    capturedAt: now(),
    orgNumber: "556012-3456",
    companyName: "Demobolaget AB",
    chartOfAccounts: [
      { number: "1930", name: "Företagskonto", type: "asset", isCashAccount: true },
      { number: "2440", name: "Leverantörsskulder", type: "liability" },
      { number: "3010", name: "Försäljning", type: "income" },
      { number: "5010", name: "Lokalhyra", type: "expense" },
      { number: "5410", name: "Förbrukningsinventarier", type: "expense" },
    ],
    bankAccounts: [
      {
        id: "demo-bank-1",
        name: "Företagskonto",
        accountNumber: "1234-56 789",
        balance: 238400,
        currency: "SEK",
        asOf: isoDaysFromNow(0),
        creditLimit: 0,
        provenance: prov("/accounts"),
      },
    ],
    openItems: [
      supplier("LF-4021", "Storleverantören AB", 620000, 9),
      supplier("LF-4022", "Mellanleverantör AB", 180000, 14),
      supplier("LF-3980", "Sen Leverantör AB", 96000, -120),
      supplier("LF-4030", "Liten Leverantör AB", 24000, 25),
      customer("KF-3120", "Exempelkund AB", 610000, -32),
      customer("KF-3121", "Liten Kund AB", 18000, -8),
    ],
    // Five steady months then a jump, so the outlier detector has something
    // real to find rather than being demonstrated on noise.
    vouchers: [
      rentVoucher(6, 58000),
      rentVoucher(5, 58000),
      rentVoucher(4, 58000),
      rentVoucher(3, 58000),
      rentVoucher(2, 58000),
      rentVoucher(1, 402000),
    ],
    gaps: [
      {
        dataset: "taxAccount",
        reason: "Skattekontots saldo hos Skatteverket går inte att hämta via bokföringssystemet.",
      },
    ],
  };
};

/* -------------------------------------------------------------------------- */
/* Adapter                                                                    */
/* -------------------------------------------------------------------------- */

export const demoAdapter: DataPort = {
  auth: {
    async getCurrentUser() {
      return state.user;
    },
    onAuthChange(callback) {
      listeners.add(callback);
      // Match the real adapter, which reports the current session on subscribe.
      callback(state.user);
      return () => listeners.delete(callback);
    },
    async signUp(email) {
      // Not derived from the address: the id ends up printed as the case
      // reference in reports, and an email does not belong in a document
      // that gets forwarded.
      state.user = { id: demoUserId(email), email };
      seedForUser(state.user.id);
      save();
      notify();
      return { error: null, needsEmailConfirmation: false };
    },
    async signIn(email) {
      state.user = { id: demoUserId(email), email };
      if (state.cases.length === 0) seedForUser(state.user.id);
      save();
      notify();
      return { error: null };
    },
    async signOut() {
      state.user = null;
      save();
      notify();
    },
    async requestPasswordReset() {
      // Demon har inga lösenord. Flödet svarar som det skarpa gör, så att
      // gränssnittet går att prova - texten på sidan förklarar läget.
      return { error: null };
    },
    async updatePassword() {
      return { error: null };
    },
  },

  contact: {
    async submit(input) {
      state.contactMessages.unshift({
        id: uid(),
        name: input.name,
        email: input.email,
        phone: input.phone,
        company: input.company,
        topic: input.topic,
        message: input.message,
        userId: state.user?.id ?? null,
        status: "new",
        handledBy: null,
        handledAt: null,
        internalNote: null,
        createdAt: now(),
      });
      save();
    },
    async amIAdmin() {
      // I demoläget är varje inloggad användare administratör, så inkorgen
      // går att titta på. Det är riktigt bara här: i den skarpa adaptern
      // avgörs det av public.platform_admins, som applikationen inte kan
      // skriva till.
      return state.user !== null;
    },
    async listAll() {
      return [...state.contactMessages];
    },
    async updateStatus(id, status, internalNote) {
      const message = state.contactMessages.find((m) => m.id === id);
      if (!message) return;
      message.status = status;
      const handled = status !== "new";
      message.handledBy = handled ? (state.user?.id ?? null) : null;
      message.handledAt = handled ? now() : null;
      if (internalNote !== undefined) message.internalNote = internalNote;
      save();
    },
  },

  profile: {
    async getMine() {
      return state.profile;
    },
    async create(input) {
      if (!state.user) throw new Error("Inte inloggad");
      state.profile = {
        userId: state.user.id,
        role: input.role,
        displayName: input.displayName,
        phone: null,
      };
      save();
      return state.profile;
    },
    async update(input) {
      if (!state.profile) return;
      state.profile = { ...state.profile, ...input };
      save();
    },
  },

  tasks: {
    async listByCase(caseId) {
      return state.caseTasks
        .filter((t) => t.caseId === caseId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async seed(caseId, labels) {
      for (const label of labels) {
        if (state.caseTasks.some((t) => t.caseId === caseId && t.label === label)) continue;
        state.caseTasks.push({
          id: uid(),
          caseId,
          label,
          dueDate: null,
          doneAt: null,
          doneBy: null,
          source: "recommendation",
          createdAt: now(),
        });
      }
      save();
    },
    async add(caseId, label, dueDate) {
      state.caseTasks.push({
        id: uid(),
        caseId,
        label,
        dueDate,
        doneAt: null,
        doneBy: null,
        source: "manual",
        createdAt: now(),
      });
      save();
    },
    async setDone(id, done) {
      const task = state.caseTasks.find((t) => t.id === id);
      if (!task) return;
      task.doneAt = done ? now() : null;
      task.doneBy = done ? (state.user?.id ?? null) : null;
      save();
    },
  },

  messages: {
    async listByCase(caseId) {
      return state.caseMessages
        .filter((m) => m.caseId === caseId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async send(caseId, body) {
      state.caseMessages.push({
        id: uid(),
        caseId,
        authorUserId: state.user?.id ?? null,
        body,
        createdAt: now(),
        readAt: null,
      });
      save();
    },
    async markRead(id) {
      const m = state.caseMessages.find((x) => x.id === id);
      if (m && !m.readAt) {
        m.readAt = now();
        save();
      }
    },
  },

  billing: {
    async getMine() {
      if (!state.user) throw new Error("Inte inloggad");
      if (!state.billing) {
        // Gratisveckan börjar när kontot först används.
        state.billing = {
          userId: state.user.id,
          startedAt: now(),
          dueAt: null,
          paidAt: null,
          closedAt: null,
          note: null,
        };
        save();
      }
      return state.billing;
    },
    async listMyInvoices() {
      return [...state.customerInvoices].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
    },
    async listCustomers() {
      if (!state.user) return [];
      return [
        {
          userId: state.user.id,
          email: state.user.email,
          displayName: state.profile?.displayName ?? null,
          role: state.profile?.role ?? "company",
          billing: state.billing,
          invoices: [...state.customerInvoices],
        },
      ];
    },
    async issueInvoice(input) {
      const number = nextInvoiceNumber(
        state.customerInvoices.map((i) => i.invoiceNumber),
        new Date(),
      );
      const invoice: CustomerInvoiceRecord = {
        id: uid(),
        userId: input.userId,
        invoiceNumber: number,
        issuedAt: now(),
        dueAt: input.dueAt,
        netOre: input.netOre,
        vatOre: input.vatOre,
        grossOre: input.netOre + input.vatOre,
        vatRate: input.vatRate,
        description: input.description,
        status: "issued",
        paidAt: null,
        paymentReference: null,
        receiptNumber: null,
      };
      state.customerInvoices.unshift(invoice);
      if (state.billing) state.billing.dueAt = input.dueAt;
      if (input.recipientEmail) {
        queue(
          invoiceEmail(demoInvoice(invoice, input.recipientEmail)),
          invoice.id,
        );
      }
      save();
      return invoice;
    },
    async registerPayment(input) {
      const invoice = state.customerInvoices.find((i) => i.id === input.invoiceId);
      if (!invoice) return;
      invoice.status = "paid";
      invoice.paidAt = input.paidAt;
      invoice.paymentReference = input.reference;
      invoice.receiptNumber = `K-${invoice.invoiceNumber}`;
      if (state.billing) {
        // Betalning öppnar kontot igen. Att låta closedAt ligga kvar skulle
        // hålla en betalande kund utelåst.
        state.billing.paidAt = input.paidAt;
        state.billing.closedAt = null;
      }
      if (input.recipientEmail) {
        queue(
          receiptEmail(demoInvoice(invoice, input.recipientEmail), {
            paidAt: input.paidAt,
            receiptNumber: invoice.receiptNumber ?? `K-${invoice.invoiceNumber}`,
          }),
          invoice.id,
        );
      }
      save();
    },
    async closeAccount() {
      if (state.billing) {
        state.billing.closedAt = now();
        if (state.user?.email) {
          const open = state.customerInvoices.find((i) => i.status === "issued");
          queue(
            accountClosedEmail({
              recipient: state.user.email,
              customerName: state.profile?.displayName ?? state.user.email,
              invoiceNumber: open?.invoiceNumber ?? null,
            }),
            open?.id ?? null,
          );
        }
        save();
      }
    },
    async listOutbox() {
      return [...state.outbox];
    },
  },

  cases: {
    async getLatest() {
      return state.cases[0] ?? null;
    },
    async create(input) {
      const record: CaseRecord = {
        ...input,
        id: uid(),
        createdAt: now(),
        updatedAt: now(),
      };
      state.cases = [record, ...state.cases];
      save();
      return record;
    },
    async createMinimal(userId) {
      const record = seedCase(userId);
      state.cases = [record, ...state.cases];
      save();
      return record;
    },
  },

  kbr: {
    async create() {
      // Nothing reads KBR assessments back yet, so there is nothing to store.
    },
  },

  payments: {
    async listByCase(caseId) {
      return state.payments.filter((p) => p.caseId === caseId);
    },
    async createMany(rows) {
      const created = rows.map((row) => ({ ...row, id: uid() }));
      state.payments = [...state.payments, ...created];
      save();
      return created;
    },
    async updateStatus(id, status) {
      state.payments = state.payments.map((p) => (p.id === id ? { ...p, status } : p));
      save();
    },
  },

  invoices: {
    async listByCase(caseId) {
      return state.invoices.filter((i) => i.caseId === caseId);
    },
    async createMany(rows) {
      const created = rows.map((row) => ({ ...row, id: uid() }));
      state.invoices = [...state.invoices, ...created];
      save();
      return created;
    },
    async updateStatus(id, status) {
      state.invoices = state.invoices.map((i) => (i.id === id ? { ...i, status } : i));
      save();
    },
  },

  professionals: {
    async listActive() {
      return DEMO_PROFESSIONALS;
    },
    async listRatings() {
      return DEMO_RATINGS;
    },
  },

  applications: {
    async getMine() {
      return state.application;
    },
    async create(input) {
      state.application = {
        id: uid(),
        category: input.category,
        status: "pending",
        reviewNote: null,
        createdAt: now(),
        contactName: input.contactName,
        email: input.email,
        phone: input.phone,
        company: input.company,
        orgNumber: input.orgNumber,
        location: input.location,
        description: input.description,
        website: input.website,
        specializations: input.specializations,
        fixedPrices: input.fixedPrices,
        credentialAuthority: input.credentialAuthority,
        credentialReference: input.credentialReference,
        credentialNote: input.credentialNote,
        reviewedAt: null,
      };
      save();
    },
    async listAll() {
      return state.application ? [state.application] : [];
    },
    async approve(id) {
      const app = state.application;
      if (!app || app.id !== id) throw new Error("Ansökan finns inte");
      if (app.status === "approved") throw new Error("Ansökan är redan godkänd");
      // Samma atomära innebörd som databasfunktionen: publicering och
      // statusbyte hör ihop.
      const professionalId = uid();
      DEMO_PROFESSIONALS.unshift({
        id: professionalId,
        name: app.contactName,
        company: app.company,
        category: app.category,
        description: app.description,
        location: app.location,
        email: app.email,
        phone: app.phone,
        website: app.website,
        fixedPrices: app.fixedPrices,
        specializations: app.specializations,
        verified: true,
      });
      state.application = { ...app, status: "approved", reviewNote: null, reviewedAt: now() };
      save();
      return professionalId;
    },
    async review(id, status, note) {
      const app = state.application;
      if (!app || app.id !== id) throw new Error("Ansökan finns inte");
      if (note.trim().length < 10) {
        throw new Error("Motivering krävs - den sökande ska veta vad som saknas eller varför det blev nej");
      }
      state.application = { ...app, status, reviewNote: note.trim(), reviewedAt: now() };
      save();
    },
  },

  referrals: {
    async listMine() {
      return state.referrals;
    },
    async create(input) {
      const record: ReferralRecord = {
        id: uid(),
        professionalId: input.professionalId,
        channel: input.channel,
        status: "initiated",
        feeAmount: null,
        billableAt: null,
        createdAt: now(),
      };
      state.referrals = [record, ...state.referrals];
      save();
    },
    async updateStatus(id, status) {
      state.referrals = state.referrals.map((r) =>
        r.id === id ? { ...r, status } : r,
      );
      save();
    },
  },

  documents: {
    async listByCase(caseId) {
      return state.documents.filter((d) => d.caseId === caseId);
    },
    async upload(input) {
      const id = uid();
      const record: DocumentRecord = {
        id,
        caseId: input.caseId,
        kind: input.kind,
        fileName: input.file.name,
        fileSize: input.file.size,
        mimeType: input.file.type || "application/octet-stream",
        storagePath: `demo/${id}`,
        source: input.source,
        note: input.note,
        createdAt: now(),
      };
      fileStore.set(id, input.file);
      state.documents = [record, ...state.documents];
      save();
      return record;
    },
    async remove(id) {
      fileStore.delete(id);
      state.documents = state.documents.filter((d) => d.id !== id);
      save();
    },
    async getDownloadUrl(id) {
      const file = fileStore.get(id);
      // Uploaded before a reload: the metadata survived, the bytes did not.
      if (!file) return null;
      return URL.createObjectURL(file);
    },
  },

  financial: {
    async getLatestSnapshot(caseId) {
      return demoSnapshot(caseId);
    },
  },

  companyLookup: {
    async lookup() {
      // Same contract as the real adapter: no register to ask, so no answer.
      // Inventing a company here would be exactly the bug removed earlier.
      return null;
    },
  },
};
