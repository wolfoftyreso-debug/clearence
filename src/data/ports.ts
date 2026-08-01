import type {
  ApplicationRecord,
  AuthUser,
  CaseRecord,
  CompanyInfo,
  ContactMessageRecord,
  ContactStatus,
  NewContactMessage,
  DocumentRecord,
  InvoiceRecord,
  InvoiceStatus,
  KbrAssessmentInput,
  NewApplication,
  NewCase,
  NewDocument,
  NewInvoice,
  NewPayment,
  NewReferral,
  PaymentRecord,
  PaymentStatus,
  ProfessionalRecord,
  RatingRecord,
  ReferralRecord,
  ReferralStatus,
} from "./types";
import type { FinancialSnapshot } from "@/lib/financial/model";

/**
 * Everything CLEARANCE needs from a backend.
 *
 * This is the whole surface: implement it and the application runs against
 * that backend unchanged. It exists so moving off Supabase is a matter of
 * writing one adapter and changing a single line in src/data/index.ts,
 * rather than editing every page.
 *
 * Note for any future implementation: the current Supabase adapter relies on
 * row-level security to scope reads to the signed-in user, which is why
 * several of these take no user id. An implementation without equivalent
 * per-row enforcement MUST apply that scoping itself - otherwise these
 * methods will happily return other companies' insolvency data.
 */
export interface AuthPort {
  getCurrentUser(): Promise<AuthUser | null>;
  /** Returns an unsubscribe function. */
  onAuthChange(callback: (user: AuthUser | null) => void): () => void;
  signUp(
    email: string,
    password: string,
  ): Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signIn(email: string, password: string): Promise<{ error: string | null }>;
  signOut(): Promise<void>;
}

export interface CasesPort {
  /** Most recently created case for the signed-in user, or null. */
  getLatest(): Promise<CaseRecord | null>;
  create(input: NewCase & { userId: string }): Promise<CaseRecord>;
  /** Creates a minimal case so a plan has somewhere to live. */
  createMinimal(userId: string): Promise<CaseRecord>;
}

export interface KbrPort {
  create(input: KbrAssessmentInput & { userId: string }): Promise<void>;
}

export interface PaymentsPort {
  listByCase(caseId: string): Promise<PaymentRecord[]>;
  createMany(rows: (NewPayment & { userId: string })[]): Promise<PaymentRecord[]>;
  updateStatus(id: string, status: PaymentStatus): Promise<void>;
}

export interface InvoicesPort {
  listByCase(caseId: string): Promise<InvoiceRecord[]>;
  createMany(rows: (NewInvoice & { userId: string })[]): Promise<InvoiceRecord[]>;
  updateStatus(id: string, status: InvoiceStatus): Promise<void>;
}

export interface ProfessionalsPort {
  listActive(): Promise<ProfessionalRecord[]>;
  listRatings(): Promise<RatingRecord[]>;
}

export interface ApplicationsPort {
  /** Latest application belonging to the signed-in user, or null. */
  getMine(): Promise<ApplicationRecord | null>;
  create(input: NewApplication & { userId: string }): Promise<void>;
}

export interface ReferralsPort {
  /** Referrals visible to the signed-in user, newest first. */
  listMine(): Promise<ReferralRecord[]>;
  create(input: NewReferral & { userId: string }): Promise<void>;
  updateStatus(id: string, status: ReferralStatus): Promise<void>;
}

export interface CompanyLookupPort {
  /**
   * Returns null when the company could not be looked up. Implementations
   * must not invent a placeholder: the UI presents this as data fetched from
   * public registers, so anything returned has to have come from one.
   */
  lookup(orgNumber: string): Promise<CompanyInfo | null>;
}

export interface DocumentsPort {
  /** Documents attached to a case, newest first. */
  listByCase(caseId: string): Promise<DocumentRecord[]>;
  upload(input: NewDocument & { userId: string }): Promise<DocumentRecord>;
  /** Removes both the row and the stored object. */
  remove(id: string): Promise<void>;
  /**
   * A short-lived URL for downloading the file, or null when it cannot be
   * produced. Implementations MUST NOT return a permanent public URL: these
   * are a company's bank statements and annual accounts.
   */
  getDownloadUrl(id: string, expiresInSeconds: number): Promise<string | null>;
}

export interface FinancialPort {
  /**
   * Most recent snapshot read from the company's accounting system, or null
   * when no system is connected.
   *
   * null means "we have not looked", not "there is nothing". The interface
   * must say which - see the note on FinancialCapabilities in
   * src/lib/financial/model.ts.
   */
  getLatestSnapshot(caseId: string): Promise<FinancialSnapshot | null>;
}

export interface ContactPort {
  /**
   * Skickar ett meddelande från kontaktformuläret.
   *
   * Måste fungera utan inloggning. Ett bolag som håller på att gå omkull ska
   * inte behöva registrera sig för att ställa en fråga.
   *
   * Implementationen får inte sätta status, handläggare eller avsändarens
   * användar-id från klientens data - de fälten bestäms av backend.
   */
  submit(input: NewContactMessage): Promise<void>;

  /**
   * True när den inloggade användaren är driftadministratör.
   *
   * Det här är ett gränssnittsbeslut, inte en säkerhetsgräns. Behörigheten
   * ska hålla i databasen även om den här returnerar fel svar - annars är
   * inkorgen skyddad av att knappen är dold, vilket den inte är.
   */
  amIAdmin(): Promise<boolean>;

  /** Hela inkorgen, nyast först. Endast för administratörer. */
  listAll(): Promise<ContactMessageRecord[]>;

  /** Handläggning: status och intern anteckning. Endast för administratörer. */
  updateStatus(id: string, status: ContactStatus, internalNote?: string | null): Promise<void>;
}

export interface DataPort {
  auth: AuthPort;
  contact: ContactPort;
  cases: CasesPort;
  kbr: KbrPort;
  payments: PaymentsPort;
  invoices: InvoicesPort;
  professionals: ProfessionalsPort;
  applications: ApplicationsPort;
  referrals: ReferralsPort;
  documents: DocumentsPort;
  financial: FinancialPort;
  companyLookup: CompanyLookupPort;
}
