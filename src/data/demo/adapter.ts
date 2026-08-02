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
  AuditEventRecord,
  ApplicationForReview,
  AuthUser,
  CaseInvitationRecord,
  CaseMemberRecord,
  CaseMessage,
  CaseNoteRecord,
  CaseRecord,
  FirmMemberRecord,
  ConversationRecord,
  CaseTask,
  TimeEntryRecord,
  KbrStatus,
  ContactMessageRecord,
  CustomerInvoiceRecord,
  SecretInfo,
  OutboundEmailRecord,
  DocumentRecord,
  UserProfile,
  InvoiceRecord,
  PaymentRecord,
  ContactRequestRecord,
  MyProfessionalProfile,
  ProfessionalProfileUpdate,
  ProfessionalRecord,
  ProfileClaimRecord,
  UsageChargeRecord,
  RatingRecord,
  ReferralRecord,
} from "../types";
import type { FinancialSnapshot, OpenItem, Voucher } from "@/lib/financial/model";
import { nextInvoiceNumber } from "@/lib/invoice";
import { accountClosedEmail, caseInvitationEmail, invoiceEmail, receiptEmail } from "@/lib/email/messages";
import { COMPANY } from "@/lib/company";
import { CASE_ROLE_DESCRIPTIONS, CASE_ROLE_LABELS, type CaseRole } from "@/lib/caseRoles";

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
  secrets: SecretInfo[];
  outbox: OutboundEmailRecord[];
  caseMembers: CaseMemberRecord[];
  caseInvitations: CaseInvitationRecord[];
  conversations: ConversationRecord[];
  kbrAssessments: { caseId: string | null; status: KbrStatus; createdAt: string }[];
  profileClaims: (ProfileClaimRecord & {
    userId: string;
    claimantEmail: string;
    motivation: string;
    contact: string;
  })[];
  contactRequests: (ContactRequestRecord & { preview: unknown; summary: unknown })[];
  usageCharges: UsageChargeRecord[];
  caseNotes: (CaseNoteRecord & { authorUserId: string })[];
  timeEntries: (TimeEntryRecord & { userId: string })[];
  firmMembers: (FirmMemberRecord & { id: string; professionalId: string })[];
  firmInvitations: {
    id: string;
    professionalId: string;
    email: string;
    role: "admin" | "member";
    createdAt: string;
    acceptedAt: string | null;
    revokedAt: string | null;
  }[];
  /** Byråns egna profiländringar, lagda ovanpå demodatat per profil-id. */
  professionalEdits: Record<string, ProfessionalProfileUpdate>;
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
  secrets: [],
  outbox: [],
  caseMembers: [],
  caseInvitations: [],
  conversations: [],
  kbrAssessments: [],
  profileClaims: [],
  contactRequests: [],
  usageCharges: [],
  caseNotes: [],
  timeEntries: [],
  firmMembers: [],
  firmInvitations: [],
  professionalEdits: {},
});

/** Files cannot go in localStorage, so they live for the session only. */
const fileStore = new Map<string, File>();

let state: DemoState = emptyState();
const listeners = new Set<(user: AuthUser | null) => void>();

const load = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = { ...emptyState(), ...(JSON.parse(raw) as DemoState) };
    // Meddelanden sparade före utbyggnaden saknar de nya fälten.
    for (const m of state.caseMessages) {
      m.acks = m.acks ?? [];
      m.conversationId = m.conversationId ?? null;
      m.attachmentDocumentId = m.attachmentDocumentId ?? null;
      m.expectsReplyFrom = m.expectsReplyFrom ?? null;
    }
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
    source: "application",
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
    source: "application",
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
    source: "application",
  },
  {
    // En förifylld, EJ verifierad post - för att kunna visa hela
    // anspråksflödet i demon: "Är detta din profil?" → drift → Verifierad.
    id: "demo-pro-4",
    name: "Demobyrån Nordkvist",
    company: "Demobyrån Nordkvist AB",
    category: "rekonstruktor",
    description:
      "Förifylld profil från offentliga källor. Uppgifterna är inte bekräftade av byrån - kontaktvägar kan vara inaktuella.",
    location: "Västerås",
    email: null,
    phone: null,
    website: null,
    fixedPrices: [],
    specializations: ["Företagsrekonstruktion"],
    verified: false,
    source: "public_register",
  },
];

const DEMO_RATINGS: RatingRecord[] = [];

/** Avtalade avgifter i demon. Sessionsminne räcker - inget avtal är på riktigt. */
const demoFees = new Map<string, number>();

/**
 * Prisplaner i demon: per-ärende-avgift som exempeldata (samma slags
 * påhittade siffror som byråernas fasta priser ovan). Driftpanelen kan
 * ändra dem under sessionen.
 */
const demoPlans = new Map<
  string,
  { planKind: "per_case" | "subscription" | "usage" | "enterprise"; unlockFeeSek: number | null; monthlyFeeSek: number | null }
>([
  ["demo-pro-1", { planKind: "per_case", unlockFeeSek: 995, monthlyFeeSek: null }],
  ["demo-pro-2", { planKind: "per_case", unlockFeeSek: 995, monthlyFeeSek: null }],
  ["demo-pro-3", { planKind: "subscription", unlockFeeSek: null, monthlyFeeSek: 4900 }],
]);
const demoHolds = new Map<string, string>();

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
  closedAt: null,
  exitReason: null,
  healthMode: false,
  planApprovedAt: null,
  planApprovedBy: null,
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
  // Demoföretaget har redan gjort kontrollbalansbedömningen - siffrorna är
  // Demobolagets (tillgångar 950 000, skulder 3 200 000) och ger kritiskt
  // läge, samma bild som krisanalysen. Badgen, notisen och hälsovyn har
  // därmed något att visa direkt.
  state.kbrAssessments = [{ caseId: demoCase.id, status: "critical", createdAt: now() }];
};

/**
 * Guideutkasten: demoföretaget har redan fyllt i kontrollbalansräkningen
 * och likviditetsplanen. Utkasten läggs på resultatsteget med Demobolagets
 * siffror, så den som öppnar guiderna ser SVAREN - inte tomma formulär.
 * Samma lagringsformat som useAutosavedState skriver.
 */
const seedGuideDrafts = () => {
  const envelope = (value: unknown) =>
    JSON.stringify({ version: 1, value, savedAt: new Date().toISOString() });
  localStorage.setItem(
    "clearance-kbr-draft",
    envelope({
      step: 3,
      form: {
        orgNumber: "556012-3456",
        companyInfo: null,
        companyLookupStatus: "idle",
        shareCapital: "100000",
        totalAssets: "950000",
        totalLiabilities: "3200000",
        hasRelatedCompanies: false,
        isPartOfLargerStructure: false,
        ambitionLevel: "stabilize",
      },
    }),
  );
  const recurring = (id: string, label: string, amount: number, dayOfMonth: number) => ({
    id,
    label,
    amount,
    recurring: true,
    dayOfMonth,
    date: isoDaysFromNow(7),
  });
  localStorage.setItem(
    "clearance-liquidity-draft",
    envelope({
      step: 6,
      openingBalance: "185000",
      items: {
        income: [recurring("demo-lp-1", "Kundfakturor", 310000, 15)],
        salary: [recurring("demo-lp-2", "Löner", 420000, 25)],
        tax: [recurring("demo-lp-3", "Skatt och moms", 165000, 12)],
        fixed: [recurring("demo-lp-4", "Hyra", 58000, 1)],
        supplier: [
          {
            id: "demo-lp-5",
            label: "Underleverantör mars",
            amount: 96000,
            recurring: false,
            dayOfMonth: 1,
            date: isoDaysFromNow(21),
          },
        ],
      },
      addEmployerFee: true,
    }),
  );
};

/**
 * De tre demokontona - ett perspektiv per målgrupp. Företaget i kris,
 * juristen/revisorn med en klientportfölj, och driften. Inloggning med ett
 * av dem sår om demons tillstånd för just den rollen; annars skulle ett
 * rollbyte visa förra rollens data.
 */
export const DEMO_ACCOUNTS = {
  company: "foretag@clearance.demo",
  advisor: "jurist@clearance.demo",
  admin: "admin@clearance.demo",
} as const;

/** En klient i rådgivarens portfölj: samma stomme som seedCase, egna siffror. */
const clientCase = (
  userId: string,
  overrides: Partial<CaseRecord> & { id: string; companyName: string; orgNumber: string },
): CaseRecord => ({
  ...seedCase(userId),
  recommendationReasons: [],
  recommendationNextSteps: [],
  recommendationDescription:
    "Exempelklient i demoläget. Siffrorna är påhittade och beskriver inte något verkligt bolag.",
  ...overrides,
});

/**
 * Juristens/revisorns demo: fyra klientbolag i olika lägen, så att
 * klientlistan visar hela spannet - rekonstruktion, kontrollbalansfråga,
 * konkursansökan och ett hanterbart skatteärende. Namnen är uppenbart
 * påhittade av samma skäl som byråerna ovan.
 */
const seedForAdvisor = (userId: string) => {
  const bygg = clientCase(userId, {
    id: "demo-klient-bygg",
    companyName: "Demo Bygg AB",
    orgNumber: "556012-1111",
    recommendationType: "reconstruction",
    recommendationTitle: "Företagsrekonstruktion pågår",
    canPaySalary: false,
    salaryAmount: "380000",
    salaryDay: 25,
    canPayTax: false,
    taxAmount: "140000",
    taxDay: 12,
    canPayRent: true,
    rentAmount: "45000",
    rentDay: 1,
    totalDebt: "2900000",
    quickLiquidationValue: "800000",
  });
  const taxi = clientCase(userId, {
    id: "demo-klient-taxi",
    companyName: "Taxi Syd Demo AB",
    orgNumber: "556012-2222",
    recommendationType: "stabilize",
    recommendationTitle: "Kontrollbalansfrågan utreds",
    canPaySalary: true,
    salaryAmount: "260000",
    salaryDay: 25,
    canPayTax: false,
    taxAmount: "90000",
    taxDay: 12,
    canPayRent: true,
    rentAmount: "30000",
    rentDay: 1,
    totalDebt: "1100000",
    quickLiquidationValue: "700000",
  });
  const milano = clientCase(userId, {
    id: "demo-klient-milano",
    companyName: "Restaurang Milano Demo AB",
    orgNumber: "556012-3333",
    recommendationType: "bankruptcy",
    recommendationTitle: "Konkursansökan förbereds",
    canPaySalary: false,
    salaryAmount: "310000",
    salaryDay: 25,
    canPayTax: false,
    taxAmount: "185000",
    taxDay: 12,
    canPayRent: false,
    rentAmount: "72000",
    rentDay: 1,
    canPaySuppliers: false,
    totalDebt: "4600000",
    quickLiquidationValue: "500000",
  });
  const elservice = clientCase(userId, {
    id: "demo-klient-elservice",
    companyName: "Elservice Demo Sverige AB",
    orgNumber: "556012-4444",
    recommendationType: "stabilize",
    recommendationTitle: "Skatteärende – anstånd söks",
    canPaySalary: true,
    salaryAmount: "190000",
    salaryDay: 25,
    canPayTax: false,
    taxAmount: "210000",
    taxDay: 12,
    canPayRent: true,
    rentAmount: "22000",
    rentDay: 1,
    canPaySuppliers: true,
    totalDebt: "900000",
    quickLiquidationValue: "850000",
  });

  state.cases = [bygg, taxi, milano, elservice];
  state.payments = seedPayments(bygg.id);
  // Kontrollbalansfrågan är taxiklientens ärendetyp - bedömningen syns
  // som badge i klientlistan.
  state.kbrAssessments = [{ caseId: taxi.id, status: "required", createdAt: now() }];
  // Öppna uppgifter i olika ärenden - klientfältets "åtgärder".
  const task = (caseId: string, label: string, dueInDays: number | null): CaseTask => ({
    id: uid(),
    caseId,
    label,
    dueDate: dueInDays === null ? null : isoDaysFromNow(dueInDays),
    doneAt: null,
    doneBy: null,
    source: "manual",
    createdAt: now(),
    assignedTo: null,
  });
  state.caseTasks = [
    task(bygg.id, "Förbered borgenärsmöte", 1),
    task(taxi.id, "Begär kompletterande balansrapport", 2),
    task(milano.id, "Ring företrädaren om konkursansökan", 0),
    task(elservice.id, "Skicka yttrande till Skatteverket", 3),
  ];
  // Klientverktygen förifyllda: en intern anteckning och loggad tid, så
  // vyn visar hur arbetsmaterialet ser ut i bruk.
  state.caseNotes = [
    {
      id: uid(),
      caseId: bygg.id,
      authorUserId: userId,
      body: "Företrädaren lovade uppdaterad balansrapport till fredag. Följ upp annars.",
      createdAt: now(),
    },
  ];
  state.timeEntries = [
    {
      id: uid(),
      caseId: bygg.id,
      userId,
      minutes: 90,
      note: "Genomgång av rekonstruktionsplanen",
      occurredOn: isoDaysFromNow(-1),
      createdAt: now(),
    },
    {
      id: uid(),
      caseId: taxi.id,
      userId,
      minutes: 45,
      note: "Avstämning kontrollbalansfrågan",
      occurredOn: isoDaysFromNow(0),
      createdAt: now(),
    },
  ];
  // Deltagare per klientärende: företrädaren och rådgivaren själv, så
  // delegeringen har någon att peka på.
  state.caseMembers = [bygg, taxi, milano, elservice].flatMap((c) => [
    {
      id: uid(),
      caseId: c.id,
      userId: `demo-foretradare-${c.id}`,
      role: "owner" as const,
      displayName: "Företrädaren (demo)",
      email: "foretradare@example.invalid",
      createdAt: now(),
      revokedAt: null,
    },
    {
      id: uid(),
      caseId: c.id,
      userId,
      role: "reconstructor" as const,
      displayName: "Demo Juristbyrå",
      email: DEMO_ACCOUNTS.advisor,
      createdAt: now(),
      revokedAt: null,
    },
  ]);
  // Byråkopplingen: juristen driver Demo Obeståndsjuridik (godkänt anspråk
  // = kopplad administratör). En kollega i teamet och en öppen inbjudan,
  // så teamvyn visar hela flödet direkt.
  state.profileClaims = [
    {
      id: uid(),
      professionalId: "demo-pro-2",
      status: "approved",
      reviewNote: null,
      createdAt: now(),
      userId,
      claimantEmail: DEMO_ACCOUNTS.advisor,
      motivation: "Demobyråns egen profil.",
      contact: DEMO_ACCOUNTS.advisor,
    },
  ];
  state.firmMembers = [
    {
      id: uid(),
      professionalId: "demo-pro-2",
      userId: "demo-kollega-1",
      email: "kollega@clearance.demo",
      role: "member",
      createdAt: now(),
    },
  ];
  state.firmInvitations = [
    {
      id: uid(),
      professionalId: "demo-pro-2",
      email: "ny.kollega@clearance.demo",
      role: "member",
      createdAt: now(),
      acceptedAt: null,
      revokedAt: null,
    },
  ];
};

/**
 * Driftens demo: rådgivarportföljen som underlag för statistiken, plus ett
 * återhämtat bolag i hälsoläget - North Star ska inte stå på noll när
 * plattformen visas upp.
 */
const seedForOps = (userId: string) => {
  seedForAdvisor(userId);
  state.cases = [
    ...state.cases,
    {
      ...seedCase(userId),
      id: "demo-klient-handel",
      companyName: "Demo Handel AB",
      orgNumber: "556012-5555",
      recommendationType: "stabilize",
      recommendationTitle: "Stabiliserat efter åtgärdsprogram",
      recommendationReasons: [],
      recommendationNextSteps: [],
      canPaySalary: true,
      canPayTax: true,
      canPayRent: true,
      canPaySuppliers: true,
      closedAt: `${isoDaysFromNow(-14)}T09:00:00.000Z`,
      exitReason: "stabilized",
      healthMode: true,
    },
  ];
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
      const user = { id: demoUserId(email), email };
      const account = email.trim().toLowerCase();
      // De tre rollkontona sår om hela tillståndet: ett rollbyte ska visa
      // rollens värld, inte resterna av den förra. Det gamla aktiva-ärende-
      // valet pekar då på ärenden som inte längre finns och rensas.
      if (
        account === DEMO_ACCOUNTS.company ||
        account === DEMO_ACCOUNTS.advisor ||
        account === DEMO_ACCOUNTS.admin
      ) {
        state = { ...emptyState(), user };
        localStorage.removeItem("clearance-active-case");
        // Guideutkasten hör till företagsrollen - ett rollbyte ska inte
        // ärva dem.
        localStorage.removeItem("clearance-kbr-draft");
        localStorage.removeItem("clearance-liquidity-draft");
        if (account === DEMO_ACCOUNTS.advisor) {
          seedForAdvisor(user.id);
          state.profile = { userId: user.id, role: "advisor", displayName: "Demo Juristbyrå", phone: null };
        } else if (account === DEMO_ACCOUNTS.admin) {
          seedForOps(user.id);
          state.profile = { userId: user.id, role: "company", displayName: "Clearance Drift", phone: null };
        } else {
          seedForUser(user.id);
          seedGuideDrafts();
          state.profile = { userId: user.id, role: "company", displayName: "Demobolaget AB", phone: null };
        }
      } else {
        state.user = user;
        if (state.cases.length === 0) seedForUser(user.id);
      }
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
          assignedTo: null,
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
        assignedTo: null,
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
    async assign(id, userId) {
      const task = state.caseTasks.find((t) => t.id === id);
      if (!task) return;
      task.assignedTo = userId;
      save();
    },
  },

  messages: {
    async listByCase(caseId) {
      return state.caseMessages
        .filter((m) => m.caseId === caseId && !m.conversationId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async listByConversation(conversationId) {
      return state.caseMessages
        .filter((m) => m.conversationId === conversationId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async send(caseId, body, opts) {
      state.caseMessages.push({
        id: uid(),
        caseId,
        conversationId: opts?.conversationId ?? null,
        authorUserId: state.user?.id ?? null,
        body,
        attachmentDocumentId: opts?.attachmentDocumentId ?? null,
        expectsReplyFrom: opts?.expectsReplyFrom ?? null,
        acks: [],
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

    async listConversations(caseId) {
      return state.conversations.filter((c) => c.caseId === caseId);
    },
    async createDirect(caseId, otherUserId) {
      const me = state.user?.id ?? "demo";
      const other = state.caseMembers.find((m) => m.userId === otherUserId);
      const conversation: ConversationRecord = {
        id: uid(),
        caseId,
        kind: "direct",
        title: null,
        createdBy: me,
        createdAt: now(),
        mergedInto: null,
        participants: [
          { userId: me, displayName: state.profile?.displayName ?? "Du" },
          { userId: otherUserId, displayName: other?.displayName ?? other?.email ?? "Deltagare" },
        ],
      };
      state.conversations.push(conversation);
      save();
      return conversation.id;
    },
    async createGroup(caseId, title, participantUserIds) {
      const me = state.user?.id ?? "demo";
      const ids = Array.from(new Set([me, ...participantUserIds]));
      const conversation: ConversationRecord = {
        id: uid(),
        caseId,
        kind: "group",
        title,
        createdBy: me,
        createdAt: now(),
        mergedInto: null,
        participants: ids.map((userId) => {
          if (userId === me) return { userId, displayName: state.profile?.displayName ?? "Du" };
          const member = state.caseMembers.find((m) => m.userId === userId);
          return { userId, displayName: member?.displayName ?? member?.email ?? "Deltagare" };
        }),
      };
      state.conversations.push(conversation);
      save();
      return conversation.id;
    },
    async merge(fromConversationId, toConversationId) {
      const from = state.conversations.find((c) => c.id === fromConversationId);
      const to = state.conversations.find((c) => c.id === toConversationId);
      if (!from || !to || from.kind !== "group" || to.kind !== "group") {
        throw new Error("Endast grupptrådar kan slås ihop.");
      }
      for (const m of state.caseMessages) {
        if (m.conversationId === fromConversationId) m.conversationId = toConversationId;
      }
      for (const p of from.participants) {
        if (!to.participants.some((x) => x.userId === p.userId)) to.participants.push(p);
      }
      from.mergedInto = toConversationId;
      save();
    },

    async ack(messageId) {
      const me = state.user?.id ?? "demo";
      const m = state.caseMessages.find((x) => x.id === messageId);
      if (m && !m.acks.some((a) => a.userId === me)) {
        m.acks.push({ userId: me, ackedAt: now() });
        save();
      }
    },
    async myOpenMentions() {
      const me = state.user?.id ?? "demo";
      return state.caseMessages
        .filter((m) => m.expectsReplyFrom === me && !m.acks.some((a) => a.userId === me))
        .map((m) => {
          const conversation = state.conversations.find((c) => c.id === m.conversationId);
          return {
            messageId: m.id,
            caseId: m.caseId,
            conversationId: m.conversationId,
            conversationTitle: conversation?.title ?? null,
            authorName:
              m.authorUserId === me
                ? (state.profile?.displayName ?? "Du")
                : (state.caseMembers.find((x) => x.userId === m.authorUserId)?.displayName ?? null),
            body: m.body,
            createdAt: m.createdAt,
          };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
    async retryEmail(id) {
      const row = state.outbox.find((m) => m.id === id);
      if (!row || row.status !== "failed") throw new Error("Endast misslyckade utskick kan skickas om.");
      row.status = "pending";
      row.attempts = 0;
      save();
    },
  },

  ops: {
    async listSecrets() {
      return [...state.secrets];
    },
    async setSecret(provider, secret) {
      // Samma regel som på riktigt: bara fyra sista tecknen sparas synligt.
      // Demons localStorage ska inte bära hela nycklar någon klistrar in.
      state.secrets = state.secrets.filter((s) => s.provider !== provider);
      state.secrets.push({ provider, last4: secret.slice(-4), updatedAt: now() });
      state.secrets.sort((a, b) => a.provider.localeCompare(b.provider));
      save();
    },
    async deleteSecret(provider) {
      state.secrets = state.secrets.filter((s) => s.provider !== provider);
      save();
    },
    async listProfessionalTerms() {
      // Demons rådgivare är påhittade; avgifterna lagras per session.
      return DEMO_PROFESSIONALS.map((pro) => ({
        professionalId: pro.id,
        name: pro.name,
        company: pro.company,
        billingEmail: null,
        referralFeeSek: demoFees.get(pro.id) ?? null,
        uninvoicedBillable: state.referrals.filter((r) => r.professionalId === pro.id).length,
      }));
    },
    async setReferralFee(professionalId, feeSek) {
      if (feeSek === null) demoFees.delete(professionalId);
      else demoFees.set(professionalId, feeSek);
    },
    async listBillingPlans() {
      return [...demoPlans.entries()].map(([professionalId, plan]) => ({
        professionalId,
        ...plan,
      }));
    },
    async setBillingPlan({ professionalId, planKind, unlockFeeSek, monthlyFeeSek }) {
      demoPlans.set(professionalId, { planKind, unlockFeeSek, monthlyFeeSek });
    },
    async setBillingHold(professionalId, hold, reason) {
      if (hold) demoHolds.set(professionalId, reason?.trim() || "spärrad i demon");
      else demoHolds.delete(professionalId);
    },
    async northStarCounts() {
      const cases = state.cases;
      return {
        recovered: cases.filter(
          (c) => c.exitReason === "stabilized" || c.exitReason === "reconstruction_completed",
        ).length,
        inHealth: cases.filter((c) => c.healthMode).length,
        badChurn: cases.filter(
          (c) => c.exitReason === "bankruptcy" || c.exitReason === "liquidated",
        ).length,
        openCases: cases.filter((c) => !c.closedAt).length,
      };
    },
  },

  advisorTools: {
    // Samma regler som radskyddet: bara egna anteckningar och egna
    // tidsposter, oavsett vad som ligger i tillståndet.
    async listNotes(caseId) {
      const me = state.user?.id;
      return state.caseNotes
        .filter((n) => n.caseId === caseId && n.authorUserId === me)
        .map(({ authorUserId, ...note }) => note)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async addNote(caseId, body) {
      if (!state.user) throw new Error("Inte inloggad");
      const trimmed = body.trim();
      if (!trimmed) throw new Error("Tom anteckning");
      state.caseNotes.push({
        id: uid(),
        caseId,
        authorUserId: state.user.id,
        body: trimmed,
        createdAt: now(),
      });
      save();
    },
    async removeNote(id) {
      state.caseNotes = state.caseNotes.filter(
        (n) => !(n.id === id && n.authorUserId === state.user?.id),
      );
      save();
    },
    async listTime(caseId) {
      const me = state.user?.id;
      return state.timeEntries
        .filter((t) => t.caseId === caseId && t.userId === me)
        .map(({ userId, ...entry }) => entry)
        .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
    },
    async logTime({ caseId, minutes, note, occurredOn }) {
      if (!state.user) throw new Error("Inte inloggad");
      if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) {
        throw new Error("Ogiltig tid");
      }
      state.timeEntries.push({
        id: uid(),
        caseId,
        userId: state.user.id,
        minutes: Math.round(minutes),
        note: note?.trim() || null,
        occurredOn: occurredOn ?? isoDaysFromNow(0),
        createdAt: now(),
      });
      save();
    },
    async removeTime(id) {
      state.timeEntries = state.timeEntries.filter(
        (t) => !(t.id === id && t.userId === state.user?.id),
      );
      save();
    },
  },

  audit: {
    // Demon har ingen databas med triggrar; loggen härleds ur det som finns
    // i sessionen. Poängen som visas är densamma: vem gjorde vad, när.
    async listByCase(caseId) {
      let seq = 1;
      const events: AuditEventRecord[] = [];
      const me = state.user?.id ?? null;
      const push = (
        action: string,
        objectType: string,
        objectId: string | null,
        at: string,
        detail: string | null,
        role: CaseRole | null = "owner",
      ) =>
        events.push({ id: seq++, caseId, actorUserId: me, actorRole: role, action, objectType, objectId, detail, occurredAt: at });
      const c = state.cases.find((x) => x.id === caseId);
      if (c) push("insert", "cases", c.id, c.createdAt, c.companyName ? `${c.companyName} (${c.orgNumber})` : c.orgNumber);
      for (const t of state.caseTasks.filter((t) => t.caseId === caseId)) {
        push("insert", "case_tasks", t.id, t.createdAt, `"${t.label}"`);
        if (t.doneAt) push("update", "case_tasks", t.id, t.doneAt, `"${t.label}" bockades av`);
      }
      for (const d of state.documents.filter((d) => d.caseId === caseId))
        push("insert", "case_documents", d.id, d.createdAt, d.note ? `${d.fileName} (${d.note.toLowerCase()})` : d.fileName);
      for (const i of state.caseInvitations.filter((i) => i.caseId === caseId)) {
        push("insert", "case_invitations", i.id, i.createdAt, `${i.email} som ${CASE_ROLE_LABELS[i.role].toLowerCase()}`);
        if (i.acceptedAt) push("update", "case_invitations", i.id, i.acceptedAt, `${i.email} tackade ja`);
        if (i.revokedAt) push("update", "case_invitations", i.id, i.revokedAt, `inbjudan till ${i.email} återkallades`);
      }
      for (const m of state.caseMembers.filter((m) => m.caseId === caseId))
        push("insert", "case_members", m.id, m.createdAt, `roll: ${CASE_ROLE_LABELS[m.role].toLowerCase()}`, m.role);
      for (const conv of state.conversations.filter((x) => x.caseId === caseId))
        push("insert", "conversations", conv.id, conv.createdAt, conv.title ? `gruppen "${conv.title}"` : "direkt tråd");
      for (const k of state.kbrAssessments.filter((k) => k.caseId === caseId))
        push("insert", "kbr_assessments", null, k.createdAt, `bedömning: ${k.status}`);
      return events.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    },
  },

  members: {
    async listMembers(caseId) {
      // Demoanvändaren är alltid ärendets företrädare; raden sås vid första
      // anblicken så listan aldrig är tom och obegriplig.
      if (state.user && !state.caseMembers.some((m) => m.caseId === caseId)) {
        state.caseMembers.push({
          id: uid(),
          caseId,
          userId: state.user.id,
          role: "owner",
          displayName: state.profile?.displayName ?? "Du",
          email: state.user.email,
          createdAt: now(),
          revokedAt: null,
        });
        save();
      }
      return state.caseMembers.filter((m) => m.caseId === caseId);
    },
    async listInvitations(caseId) {
      return state.caseInvitations
        .filter((i) => i.caseId === caseId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async invite(caseId, email, role) {
      const address = email.trim().toLowerCase();
      if (
        state.caseInvitations.some(
          (i) => i.caseId === caseId && i.email === address && !i.acceptedAt && !i.revokedAt,
        )
      ) {
        throw new Error("Adressen har redan en öppen inbjudan.");
      }
      const id = uid();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      state.caseInvitations.push({
        id,
        caseId,
        email: address,
        role,
        createdAt: now(),
        expiresAt,
        acceptedAt: null,
        revokedAt: null,
      });
      // Som på riktigt: mejlet hamnar i utkorgen, synligt i driftpanelen.
      const message = caseInvitationEmail({
        recipient: address,
        inviterName: state.profile?.displayName ?? state.user?.email ?? "En kollega",
        companyName:
          state.cases.find((c) => c.id === caseId)?.companyName ?? "bolaget",
        roleLabel: CASE_ROLE_LABELS[role],
        roleDescription: CASE_ROLE_DESCRIPTIONS[role],
        acceptUrl: `${window.location.origin}${window.location.pathname}#/inbjudan/${id}`,
        expiresAt,
      });
      state.outbox.unshift({
        id: uid(),
        recipient: message.recipient,
        subject: message.subject,
        kind: message.kind,
        status: "sent",
        attempts: 1,
        lastError: null,
        createdAt: now(),
        sentAt: now(),
      });
      save();
    },
    async revokeInvitation(invitationId) {
      const invitation = state.caseInvitations.find((i) => i.id === invitationId);
      if (invitation && !invitation.acceptedAt && !invitation.revokedAt) {
        invitation.revokedAt = now();
        save();
      }
    },
    async peekInvitation(invitationId) {
      const invitation = state.caseInvitations.find((i) => i.id === invitationId);
      if (!invitation) return null;
      const caseRecord = state.cases.find((c) => c.id === invitation.caseId);
      return {
        id: invitation.id,
        companyName: caseRecord?.companyName ?? null,
        orgNumber: caseRecord?.orgNumber ?? "",
        role: invitation.role,
        inviterName: state.profile?.displayName ?? null,
        expiresAt: invitation.expiresAt,
        acceptedAt: invitation.acceptedAt,
        revokedAt: invitation.revokedAt,
      };
    },
    async acceptInvitation(invitationId) {
      const invitation = state.caseInvitations.find((i) => i.id === invitationId);
      if (!invitation) throw new Error("Inbjudan finns inte eller är ställd till en annan adress.");
      if (invitation.revokedAt) throw new Error("Inbjudan är återkallad.");
      if (invitation.acceptedAt) throw new Error("Inbjudan är redan använd.");
      invitation.acceptedAt = now();
      // I demon är det samma webbläsare som "tar emot" inbjudan, men
      // medlemmen måste få ett EGET id - annars finns ingen motpart att
      // starta direkta trådar med, och hela poängen med demot försvinner.
      state.caseMembers.push({
        id: uid(),
        caseId: invitation.caseId,
        userId: demoUserId(invitation.email),
        role: invitation.role,
        displayName: invitation.email,
        email: invitation.email,
        createdAt: now(),
        revokedAt: null,
      });
      save();
      return invitation.caseId;
    },
  },

  cases: {
    async getLatest() {
      const selected = localStorage.getItem("clearance-active-case");
      if (selected) {
        const found = state.cases.find((c) => c.id === selected);
        if (found) return found;
        localStorage.removeItem("clearance-active-case");
      }
      // Ett helt avslutat ärende trängs inte före ett pågående, men visas
      // om det är allt som finns - avslutsbanderollen ska vara nåbar.
      return (
        state.cases.find((c) => !c.closedAt || c.healthMode) ?? state.cases[0] ?? null
      );
    },
    async listMine() {
      return [...state.cases];
    },
    select(caseId) {
      if (caseId) localStorage.setItem("clearance-active-case", caseId);
      else localStorage.removeItem("clearance-active-case");
    },
    async create(input) {
      const record: CaseRecord = {
        ...input,
        id: uid(),
        createdAt: now(),
        updatedAt: now(),
        closedAt: null,
        exitReason: null,
        healthMode: false,
        planApprovedAt: null,
        planApprovedBy: null,
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
    // Samma regler som close_case() i databasen: bara lyckade utfall får gå
    // vidare till hälsoläget, och ett redan avslutat ärende avslutas inte om.
    async close({ caseId, reason, note, enterHealth }) {
      const record = state.cases.find((c) => c.id === caseId);
      if (!record) throw new Error("Ärendet finns inte");
      if (record.closedAt) throw new Error("Ärendet är redan avslutat");
      const health = Boolean(enterHealth);
      if (health && reason !== "stabilized" && reason !== "reconstruction_completed") {
        throw new Error("Hälsoläget är för lyckade utfall");
      }
      record.closedAt = now();
      record.exitReason = reason;
      record.healthMode = health;
      record.updatedAt = now();
      void note;
      save();
    },
    async reopen(caseId) {
      const record = state.cases.find((c) => c.id === caseId);
      if (!record) throw new Error("Ärendet finns inte");
      record.closedAt = null;
      record.exitReason = null;
      record.healthMode = false;
      record.updatedAt = now();
      save();
    },
    // Samma regel som set_plan_approval() i databasen: godkännandet är
    // rådgivarens, aldrig företrädarens egen självbetjäning.
    async setPlanApproval(caseId, approved) {
      if (state.profile?.role !== "advisor") {
        throw new Error("Endast en rådgivarroll i ärendet kan godkänna handlingsplanen");
      }
      const record = state.cases.find((c) => c.id === caseId);
      if (!record) throw new Error("Ärendet finns inte");
      record.planApprovedAt = approved ? now() : null;
      record.planApprovedBy = approved ? (state.user?.id ?? null) : null;
      record.updatedAt = now();
      save();
    },
  },

  kbr: {
    async create(input) {
      state.kbrAssessments.push({
        caseId: input.caseId ?? null,
        status: input.status,
        createdAt: now(),
      });
      save();
    },
    async getLatestByCase(caseId) {
      const mine = state.kbrAssessments
        .filter((a) => a.caseId === caseId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return mine[0] ? { status: mine[0].status, createdAt: mine[0].createdAt } : null;
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
      // Godkända anspråk lyfter profilen till Verifierad, och byråns egna
      // ändringar läggs ovanpå - samma som katalogen i skarp drift.
      return DEMO_PROFESSIONALS.map((pro) => {
        const edits = state.professionalEdits[pro.id];
        const verified =
          pro.verified ||
          state.profileClaims.some((c) => c.professionalId === pro.id && c.status === "approved");
        return {
          ...pro,
          ...(edits
            ? {
                description: edits.description,
                location: edits.location,
                email: edits.email,
                phone: edits.phone,
                website: edits.website,
                specializations: edits.specializations,
                fixedPrices: edits.fixedPrices,
              }
            : {}),
          verified,
        };
      });
    },

    async getMyProfile() {
      if (!state.user) return null;
      const claim = state.profileClaims.find(
        (c) => c.userId === state.user?.id && c.status === "approved",
      );
      if (!claim) return null;
      const pro = DEMO_PROFESSIONALS.find((p) => p.id === claim.professionalId);
      if (!pro) return null;
      const edits = state.professionalEdits[pro.id];
      const profile: MyProfessionalProfile = {
        id: pro.id,
        name: pro.name,
        company: pro.company,
        category: pro.category,
        verified: true,
        description: edits?.description ?? pro.description,
        location: edits?.location ?? pro.location,
        email: edits?.email ?? pro.email,
        phone: edits?.phone ?? pro.phone,
        website: edits?.website ?? pro.website,
        specializations: edits?.specializations ?? pro.specializations ?? [],
        fixedPrices: edits?.fixedPrices ?? pro.fixedPrices,
        billingEmail: edits?.billingEmail ?? null,
      };
      return profile;
    },
    async updateMyProfile(input: ProfessionalProfileUpdate) {
      if (!state.user) throw new Error("Kräver inloggning");
      const claim = state.profileClaims.find(
        (c) => c.userId === state.user?.id && c.status === "approved",
      );
      if (!claim) throw new Error("Ingen byråprofil är kopplad till ditt konto");
      state.professionalEdits = { ...state.professionalEdits, [claim.professionalId]: input };
      save();
    },
    async listRatings() {
      return DEMO_RATINGS;
    },

    async claimProfile({ professionalId, motivation, contact }) {
      if (!state.user) throw new Error("Kräver inloggning");
      const pro = DEMO_PROFESSIONALS.find((p) => p.id === professionalId);
      if (!pro) throw new Error("Profilen finns inte");
      const taken = state.profileClaims.some(
        (c) => c.professionalId === professionalId && c.status === "approved",
      );
      if (pro.verified || taken) throw new Error("Profilen är redan kopplad till ett konto");
      if (
        state.profileClaims.some(
          (c) =>
            c.professionalId === professionalId &&
            c.userId === state.user?.id &&
            c.status === "pending",
        )
      ) {
        throw new Error("Du har redan ett anspråk under granskning");
      }
      state.profileClaims = [
        ...state.profileClaims,
        {
          id: uid(),
          professionalId,
          status: "pending",
          reviewNote: null,
          createdAt: now(),
          userId: state.user.id,
          claimantEmail: state.user.email ?? "",
          motivation,
          contact,
        },
      ];
      save();
    },
    // Byråteamet i demon: samma regler som funktionerna i databasen -
    // den kopplade inloggningen är implicit administratör, bara admin
    // bjuder in, accept kräver att adressen stämmer.
    async listTeam(professionalId) {
      const linked = state.profileClaims.find(
        (c) => c.professionalId === professionalId && c.status === "approved",
      );
      const isMember =
        linked?.userId === state.user?.id ||
        state.firmMembers.some(
          (m) => m.professionalId === professionalId && m.userId === state.user?.id,
        );
      if (!isMember) return [];
      const rows: FirmMemberRecord[] = [];
      if (linked) {
        rows.push({
          id: null,
          userId: linked.userId,
          email: linked.claimantEmail,
          role: "admin",
          createdAt: linked.createdAt,
        });
      }
      for (const m of state.firmMembers) {
        if (m.professionalId === professionalId) {
          rows.push({ id: m.id, userId: m.userId, email: m.email, role: m.role, createdAt: m.createdAt });
        }
      }
      return rows;
    },
    async listTeamInvitations(professionalId) {
      return state.firmInvitations
        .filter((i) => i.professionalId === professionalId && !i.acceptedAt && !i.revokedAt)
        .map(({ id, email, role, createdAt }) => ({ id, email, role, createdAt }));
    },
    async inviteTeamMember(professionalId, email, role) {
      const normalized = email.trim().toLowerCase();
      if (
        state.firmInvitations.some(
          (i) => i.professionalId === professionalId && i.email === normalized && !i.acceptedAt && !i.revokedAt,
        )
      ) {
        throw new Error("Adressen har redan en öppen inbjudan");
      }
      state.firmInvitations.push({
        id: uid(),
        professionalId,
        email: normalized,
        role,
        createdAt: now(),
        acceptedAt: null,
        revokedAt: null,
      });
      save();
    },
    async revokeTeamInvitation(invitationId) {
      const invitation = state.firmInvitations.find((i) => i.id === invitationId);
      if (invitation) {
        invitation.revokedAt = now();
        save();
      }
    },
    async removeTeamMember(memberId) {
      state.firmMembers = state.firmMembers.filter((m) => m.id !== memberId);
      save();
    },
    async myFirmInvitations() {
      const email = state.user?.email?.toLowerCase();
      if (!email) return [];
      return state.firmInvitations
        .filter((i) => i.email === email && !i.acceptedAt && !i.revokedAt)
        .map((i) => ({
          id: i.id,
          professionalId: i.professionalId,
          firmName:
            DEMO_PROFESSIONALS.find((p) => p.id === i.professionalId)?.company ?? "Byrån",
          role: i.role,
          createdAt: i.createdAt,
        }));
    },
    async acceptFirmInvitation(invitationId) {
      const invitation = state.firmInvitations.find((i) => i.id === invitationId);
      if (!invitation || !state.user?.email || invitation.email !== state.user.email.toLowerCase()) {
        throw new Error("Inbjudan finns inte eller är ställd till en annan adress");
      }
      if (invitation.acceptedAt) throw new Error("Inbjudan är redan använd");
      if (invitation.revokedAt) throw new Error("Inbjudan är återkallad");
      invitation.acceptedAt = now();
      state.firmMembers.push({
        id: uid(),
        professionalId: invitation.professionalId,
        userId: state.user.id,
        email: invitation.email,
        role: invitation.role,
        createdAt: now(),
      });
      save();
    },
    async listMyClaims() {
      if (!state.user) return [];
      return state.profileClaims
        .filter((c) => c.userId === state.user?.id)
        .map(({ id, professionalId, status, reviewNote, createdAt }) => ({
          id,
          professionalId,
          status,
          reviewNote,
          createdAt,
        }));
    },
    async listClaims() {
      return [...state.profileClaims]
        .sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending"))
        .map((c) => ({
          id: c.id,
          professionalId: c.professionalId,
          professionalName:
            DEMO_PROFESSIONALS.find((p) => p.id === c.professionalId)?.name ?? "Okänd profil",
          claimantEmail: c.claimantEmail,
          motivation: c.motivation,
          contact: c.contact,
          status: c.status,
          reviewNote: c.reviewNote,
          createdAt: c.createdAt,
        }));
    },
    async reviewClaim(id, approve, note) {
      const claim = state.profileClaims.find((c) => c.id === id);
      if (!claim || claim.status !== "pending") throw new Error("Anspråket är redan avgjort");
      if (!approve && !note?.trim()) throw new Error("Avslag kräver en motivering");
      state.profileClaims = state.profileClaims.map((c) => {
        if (c.id === id) {
          return { ...c, status: approve ? "approved" : "rejected", reviewNote: note?.trim() || null };
        }
        // Samma regel som i databasen: ett godkännande besvarar rivalerna.
        if (approve && c.professionalId === claim.professionalId && c.status === "pending") {
          return { ...c, status: "rejected", reviewNote: "Ett annat anspråk på profilen godkändes." };
        }
        return c;
      });
      save();
    },
  },

  /**
   * Demoläget spelar båda sidor: samma inloggning är företrädaren som
   * skickar förfrågan OCH byrån som ser den i sin inkorg. Det gör hela
   * kedjan förfrågan → förhandsvisning → upplåsning → debitering körbar
   * i webbläsaren utan server.
   */
  leads: {
    async create({ caseId, professionalId, preview, summary }) {
      if (!state.user) throw new Error("Kräver inloggning");
      if (
        state.contactRequests.some(
          (r) =>
            r.caseId === caseId &&
            r.professionalId === professionalId &&
            (r.status === "sent" || r.status === "unlocked"),
        )
      ) {
        throw new Error("Rådgivaren är redan kontaktad i det här ärendet");
      }
      state.contactRequests = [
        ...state.contactRequests,
        {
          id: uid(),
          caseId,
          professionalId,
          status: "sent",
          createdAt: now(),
          consentAt: now(),
          unlockedAt: null,
          declinedAt: null,
          declineNote: null,
          preview,
          summary,
        },
      ];
      save();
    },
    async listForCase(caseId) {
      return state.contactRequests
        .filter((r) => r.caseId === caseId)
        .map(({ preview: _p, summary: _s, ...rest }) => rest)
        .reverse();
    },
    async listMyLeads() {
      return [...state.contactRequests]
        .filter((r) => r.status !== "withdrawn")
        .sort((a, b) => Number(b.status === "sent") - Number(a.status === "sent"))
        .map((r) => {
          const plan = demoPlans.get(r.professionalId);
          return {
            id: r.id,
            professionalId: r.professionalId,
            status: r.status,
            createdAt: r.createdAt,
            unlockedAt: r.unlockedAt,
            preview: r.preview,
            planKind: plan?.planKind ?? "per_case",
            unlockFeeSek: plan?.unlockFeeSek ?? null,
          };
        });
    },
    async unlock(requestId, termsVersion) {
      const request = state.contactRequests.find((r) => r.id === requestId);
      if (!request) throw new Error("Förfrågan finns inte");
      if (request.status !== "sent") throw new Error("Förfrågan är redan hanterad");
      if (!termsVersion.trim()) throw new Error("Villkoren måste accepteras");
      const hold = demoHolds.get(request.professionalId);
      if (hold) throw new Error(`Kontot är spärrat för nya köp. Kontakta driften: ${hold}`);

      state.contactRequests = state.contactRequests.map((r) =>
        r.id === requestId ? { ...r, status: "unlocked", unlockedAt: now() } : r,
      );
      const plan = demoPlans.get(request.professionalId);
      const fee = plan && ["per_case", "usage"].includes(plan.planKind) ? plan.unlockFeeSek : null;
      if (fee && fee > 0) {
        const caseRecord = state.cases.find((c) => c.id === request.caseId);
        state.usageCharges = [
          {
            id: uid(),
            serviceCode: "case_unlock",
            serviceLabel: "Ärende upplåst",
            caseType: caseRecord?.recommendationType ?? null,
            companyName: caseRecord?.companyName ?? null,
            orgNumber: caseRecord?.orgNumber ?? null,
            amountOre: Math.round(fee * 100),
            vatRate: 0.25,
            createdAt: now(),
            invoiceId: null,
            contactRequestId: requestId,
          },
          ...state.usageCharges,
        ];
      }
      save();
      return request.summary;
    },
    async getUnlocked(requestId) {
      const request = state.contactRequests.find((r) => r.id === requestId);
      if (!request || request.status !== "unlocked") throw new Error("Ärendet är inte upplåst");
      return request.summary;
    },
    async decline(requestId, note) {
      const request = state.contactRequests.find((r) => r.id === requestId);
      if (!request || request.status !== "sent") throw new Error("Förfrågan är redan hanterad");
      state.contactRequests = state.contactRequests.map((r) =>
        r.id === requestId
          ? { ...r, status: "declined", declinedAt: now(), declineNote: note?.trim() || null }
          : r,
      );
      save();
    },
    async listMyCharges() {
      return state.usageCharges;
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
        source: "application",
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
    async lookup(orgNumber) {
      // Ett (1) uppslagbart testbolag, med samma nummer som demodatan, så
      // att flödena går att prova i väntan på Bolagsverkets API. Skillnaden
      // mot buggen som togs bort tidigare: detta är demoläget, där ALLT är
      // bannerförklarat påhittat - den skarpa adaptern hittar fortfarande
      // aldrig på något.
      if (orgNumber.replace(/\D/g, "") === "5560123456") {
        return {
          name: "Demobolaget AB",
          legalForm: "Aktiebolag",
          address: "Exempelgatan 1, 111 22 Stockholm",
          sniCode: "62010",
          sniDescription: "Dataprogrammering",
        };
      }
      return null;
    },
  },
};
