/**
 * Domain types for CLEARANCE.
 *
 * Deliberately hand-written rather than re-exported from a backend's
 * generated types: the application should describe its own data, so that
 * swapping the backend is a change behind the data layer rather than a
 * rename across every page.
 */

import type { CaseRole } from "@/lib/caseRoles";

export type RecommendationType = "bankruptcy" | "reconstruction" | "stabilize";
export type KbrStatus = "not_required" | "warning" | "required" | "critical";
export type PaymentStatus = "pending" | "paid" | "postponed" | "critical";
export type PaymentCategory = "salary" | "tax" | "rent" | "supplier" | "loan" | "other";
export type InvoiceDirection = "in" | "out";
export type InvoiceStatus = "unpaid" | "paid" | "overdue";
export type ProfessionalCategory =
  | "konkursforvaltare"
  | "rekonstruktor"
  | "revisor"
  | "affarsjurist"
  | "kreditbolag";
export type ApplicationStatus = "pending" | "needs_info" | "approved" | "rejected";
export type ReferralChannel = "email" | "phone" | "website";
export type ReferralStatus = "initiated" | "accepted" | "declined" | "completed";

export interface AuthUser {
  id: string;
  email: string | null;
}

/**
 * Krisfasens utfall. stabilized/reconstruction_completed är North
 * Star-utfallen (bra churn). Sätts endast genom cases.close().
 */
export type CaseExitReason =
  | "stabilized"
  | "reconstruction_completed"
  | "bankruptcy"
  | "liquidated"
  | "other";

export interface CaseRecord {
  id: string;
  orgNumber: string;
  companyName: string | null;
  employees: string | null;
  canPaySalary: boolean | null;
  salaryAmount: string | null;
  salaryDay: number | null;
  canPayTax: boolean | null;
  taxAmount: string | null;
  taxDay: number | null;
  canPayRent: boolean | null;
  rentAmount: string | null;
  rentDay: number | null;
  canPaySuppliers: boolean | null;
  totalDebt: string | null;
  quickLiquidationValue: string | null;
  recommendationType: RecommendationType | null;
  recommendationTitle: string | null;
  recommendationDescription: string | null;
  recommendationReasons: string[];
  recommendationNextSteps: string[];
  createdAt: string;
  updatedAt: string;
  /** Krisfasens slut. Null = pågående kris (eller hälsoläge, se healthMode). */
  closedAt: string | null;
  exitReason: CaseExitReason | null;
  /** Ärendet lever vidare i hälsoläget efter en lyckad krisfas. */
  healthMode: boolean;
  /** Rådgivarens gransknings-stämpel på handlingsplanen. Null = ej godkänd. */
  planApprovedAt: string | null;
  planApprovedBy: string | null;
}

export type NewCase = Omit<
  CaseRecord,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "closedAt"
  | "exitReason"
  | "healthMode"
  | "planApprovedAt"
  | "planApprovedBy"
>;

export interface KbrAssessmentInput {
  caseId?: string | null;
  orgNumber: string | null;
  companyName: string | null;
  ambitionLevel: string | null;
  hasRelatedCompanies: boolean | null;
  isPartOfLargerStructure: boolean | null;
  shareCapital: number;
  totalAssets: number;
  totalLiabilities: number;
  status: KbrStatus;
}

export interface PaymentRecord {
  id: string;
  caseId: string;
  label: string;
  amount: number;
  category: PaymentCategory;
  status: PaymentStatus;
  /** ISO date, yyyy-MM-dd */
  dueDate: string;
  recurring: boolean;
}

export type NewPayment = Omit<PaymentRecord, "id">;

export interface InvoiceRecord {
  id: string;
  caseId: string;
  label: string;
  amount: number;
  direction: InvoiceDirection;
  status: InvoiceStatus;
  /** ISO date, yyyy-MM-dd */
  issueDate: string;
  /** ISO date, yyyy-MM-dd */
  dueDate: string;
  counterpart: string | null;
}

export type NewInvoice = Omit<InvoiceRecord, "id">;

export interface FixedPrice {
  service: string;
  price: number;
}

/**
 * Varifrån en katalogpost kommer. "application" = rådgivaren ansökte själv
 * och granskades; "public_register" = förifylld från offentliga källor och
 * inte bekräftad av byrån förrän ett profilanspråk godkänts.
 */
export type ProfessionalSource = "application" | "public_register";

export interface ProfessionalRecord {
  id: string;
  name: string;
  company: string | null;
  category: string;
  description: string | null;
  location: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  fixedPrices: FixedPrice[];
  specializations: string[] | null;
  verified: boolean | null;
  source: ProfessionalSource;
}

/**
 * Innehavarens egen bild av sin katalogprofil, inklusive
 * faktureringsadressen som aldrig visas publikt. Identitetsfälten (namn,
 * byrå, kategori) och verifieringen är läsvärden här - de ändras av
 * driften, aldrig av byrån själv.
 */
export interface MyProfessionalProfile {
  id: string;
  name: string;
  company: string | null;
  category: string;
  verified: boolean;
  description: string | null;
  location: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  specializations: string[];
  fixedPrices: FixedPrice[];
  billingEmail: string | null;
}

/** Fälten byrån själv råder över. Hela tillståndet skickas varje gång. */
export interface ProfessionalProfileUpdate {
  description: string | null;
  location: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  specializations: string[];
  fixedPrices: FixedPrice[];
  billingEmail: string | null;
}

export type ProfileClaimStatus = "pending" | "approved" | "rejected";

/** Den sökandes egen bild av sitt anspråk på en katalogprofil. */
export interface ProfileClaimRecord {
  id: string;
  professionalId: string;
  status: ProfileClaimStatus;
  reviewNote: string | null;
  createdAt: string;
}

/** Anspråket som driften granskar det: med profil, sökande och underlag. */
export interface ProfileClaimForReview extends ProfileClaimRecord {
  professionalName: string;
  claimantEmail: string;
  motivation: string;
  contact: string;
}

/* --- kontaktförfrågan och upplåsning ------------------------------------- */

export type ContactRequestStatus = "sent" | "unlocked" | "declined" | "withdrawn";

/** Företagets bild av en förfrågan: full insyn i vad som delats med vem. */
export interface ContactRequestRecord {
  id: string;
  caseId: string;
  professionalId: string;
  status: ContactRequestStatus;
  createdAt: string;
  consentAt: string;
  unlockedAt: string | null;
  declinedAt: string | null;
  declineNote: string | null;
}

/** Rådgivarens bild FÖRE upplåsning: avidentifierad, med priset synligt. */
export interface LeadPreviewRecord {
  id: string;
  professionalId: string;
  status: ContactRequestStatus;
  createdAt: string;
  unlockedAt: string | null;
  /** LeadPreview från src/lib/leadSummary.ts, lagrad som json. */
  preview: unknown;
  planKind: "per_case" | "subscription" | "usage" | "enterprise";
  unlockFeeSek: number | null;
}

/** En rad i den löpande debiteringsöversikten och på samlingsfakturan. */
export interface UsageChargeRecord {
  id: string;
  serviceCode: "case_unlock" | "subscription";
  serviceLabel: string;
  caseType: string | null;
  companyName: string | null;
  orgNumber: string | null;
  amountOre: number;
  vatRate: number;
  createdAt: string;
  invoiceId: string | null;
  contactRequestId: string | null;
  /** Skuggdebitering (pilotens spår A): visas med belopp, faktureras aldrig. */
  shadow: boolean;
}

export interface RatingRecord {
  professionalId: string;
  communicationScore: number | null;
  expertiseScore: number | null;
  priceTransparencyScore: number | null;
  responseTimeScore: number | null;
  overallScore: number | null;
}

export interface ApplicationRecord {
  id: string;
  category: ProfessionalCategory;
  status: ApplicationStatus;
  reviewNote: string | null;
  createdAt: string;
}

/**
 * Hela ansökan, som granskaren ser den. Skild från ApplicationRecord med
 * flit: den sökandes egen vy behöver inte sina inskickade fält i retur, och
 * granskarens vy får aldrig sakna behörighetsuppgifterna - det är dem
 * granskningen består i att kontrollera.
 */
export interface ApplicationForReview extends ApplicationRecord {
  contactName: string;
  email: string;
  phone: string | null;
  company: string | null;
  orgNumber: string | null;
  location: string | null;
  description: string | null;
  website: string | null;
  specializations: string[];
  fixedPrices: FixedPrice[];
  credentialAuthority: string | null;
  credentialReference: string | null;
  credentialNote: string | null;
  reviewedAt: string | null;
}

export interface NewApplication {
  contactName: string;
  email: string;
  phone: string | null;
  company: string | null;
  orgNumber: string | null;
  category: ProfessionalCategory;
  location: string | null;
  description: string | null;
  website: string | null;
  specializations: string[];
  fixedPrices: FixedPrice[];
  credentialAuthority: string | null;
  credentialReference: string | null;
  credentialNote: string | null;
  termsAcceptedAt: string;
}

export interface ReferralRecord {
  id: string;
  professionalId: string;
  channel: ReferralChannel;
  status: ReferralStatus;
  feeAmount: number | null;
  billableAt: string | null;
  createdAt: string;
}

export interface NewReferral {
  professionalId: string;
  caseId: string | null;
  channel: ReferralChannel;
}

/**
 * Vad ett uppslag mot företagsregistret ger tillbaka.
 *
 * De fem första fälten är alltid ifyllda när ett bolag hittas. De sex
 * sista är `undefined` när källan inte lämnade dem - och det är hela
 * poängen: gränssnittet visar bara det som faktiskt kom tillbaka.
 * Ett registerfält som gissas är värre än ett som saknas, eftersom
 * användaren litar på det.
 */
export interface CompanyInfo {
  name: string;
  legalForm: string;
  address: string;
  sniCode: string;
  sniDescription: string;
  /** Registreringsår, som fyrsiffrigt årtal. */
  registrationYear?: string;
  /** Styrelseledamöter, i registrets ordning. */
  boardMembers?: string[];
  /** Godkänd för F-skatt. `undefined` = källan sa inget. */
  fTax?: boolean;
  /** Registrerad för moms. `undefined` = källan sa inget. */
  vatRegistered?: boolean;
  /** Bolagets status hos registret, t.ex. "Aktivt". */
  status?: string;
}

/**
 * What a stored document is. Kept as a closed set rather than free text so
 * the case view can group by kind and tell the user what is still missing.
 */
export type DocumentKind =
  | "bank_statement"
  | "balance_sheet"
  | "income_statement"
  | "annual_report"
  | "tax_account"
  | "debt_overview"
  | "agreement"
  | "correspondence"
  | "other";

/**
 * Where the file came from. `manual` means the user uploaded it; the other
 * values exist so an accounting-system import can be told apart from a file
 * the user picked, both in the UI and in an audit trail.
 */
export type DocumentSource = "manual" | "fortnox" | "visma";

export interface DocumentRecord {
  id: string;
  caseId: string;
  kind: DocumentKind;
  /** Name as the user's filesystem had it. */
  fileName: string;
  /** Bytes. */
  fileSize: number;
  mimeType: string;
  /** Opaque key in whatever object store the adapter uses. */
  storagePath: string;
  source: DocumentSource;
  note: string | null;
  createdAt: string;
  /** Utkast -> För granskning -> Godkänt. Godkännandet är en rådgivarstämpel. */
  reviewStatus: "draft" | "in_review" | "approved";
  reviewRequestedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface NewDocument {
  caseId: string;
  kind: DocumentKind;
  file: File;
  source: DocumentSource;
  note: string | null;
}

/* -------------------------------------------------------------------------- */
/* Kontaktmeddelanden                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Vad frågan gäller. En sluten uppsättning i stället för fritext, så att
 * inkorgen går att sortera och så att brådskande ärenden – ett bolag i kris –
 * går att skilja från en fakturafråga utan att någon läser allt först.
 */
export type ContactTopic =
  | "question"
  | "company"
  | "advisor"
  | "invoice"
  | "privacy"
  | "bug"
  | "other";

export type ContactStatus = "new" | "in_progress" | "answered" | "closed";

/** Vad avsändaren fyller i. Allt annat sätts av databasen. */
export interface NewContactMessage {
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  topic: ContactTopic;
  message: string;
}

export interface ContactMessageRecord {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  topic: ContactTopic;
  message: string;
  /** Satt när avsändaren var inloggad, annars null. */
  userId: string | null;
  status: ContactStatus;
  handledBy: string | null;
  handledAt: string | null;
  internalNote: string | null;
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/* Roller, meddelanden och kontots ekonomi                                    */
/* -------------------------------------------------------------------------- */

/**
 * Vem användaren är. Styr vad som visas vid inloggning.
 *
 * En sluten uppsättning och inte en uppsättning flaggor: en användare är
 * antingen företagare eller rådgivare, och ett gränssnitt som försöker vara
 * båda samtidigt blir obegripligt för båda.
 */
export type UserRole = "company" | "advisor";

export interface UserProfile {
  userId: string;
  role: UserRole;
  displayName: string | null;
  phone: string | null;
}

export interface MessageAck {
  userId: string;
  ackedAt: string;
}

export interface CaseMessage {
  id: string;
  caseId: string;
  /** null = grundtråden som alla medlemmar ser. Annars en direkt/grupptråd. */
  conversationId: string | null;
  authorUserId: string | null;
  body: string;
  /** Pekar på ett dokument i samma ärende. Bilagan är ett ärendedokument. */
  attachmentDocumentId: string | null;
  /** Den som förväntas svara. Notisen släcks av personens kvittens. */
  expectsReplyFrom: string | null;
  /** Uppfattat-kvittenser. Kan aldrig tas tillbaka. */
  acks: MessageAck[];
  createdAt: string;
  readAt: string | null;
}

export interface ConversationRecord {
  id: string;
  caseId: string;
  kind: "direct" | "group";
  /** Gruppens namn. En direkt tråd heter det motparten heter. */
  title: string | null;
  createdBy: string | null;
  createdAt: string;
  /** Satt när tråden slagits ihop in i en annan - visas inte längre. */
  mergedInto: string | null;
  participants: { userId: string; displayName: string | null }[];
}

/** En rad i notiscentret: ett meddelande som väntar på DITT svar. */
export interface OpenMention {
  messageId: string;
  caseId: string;
  conversationId: string | null;
  conversationTitle: string | null;
  authorName: string | null;
  body: string;
  createdAt: string;
}

export interface AccountBillingRecord {
  userId: string;
  /** Abonnemangsnivån. Styr vilka aviseringskanaler som är öppna. */
  planId: "start" | "standard" | "business" | "enterprise";
  startedAt: string;
  dueAt: string | null;
  paidAt: string | null;
  closedAt: string | null;
  note: string | null;
}

export type CustomerInvoiceStatus = "issued" | "paid" | "cancelled";

/** Belopp i ören. Aldrig kronor som flyttal - se src/lib/invoice.ts. */
export interface CustomerInvoiceRecord {
  id: string;
  userId: string;
  invoiceNumber: string;
  issuedAt: string;
  dueAt: string;
  netOre: number;
  vatOre: number;
  grossOre: number;
  vatRate: number;
  description: string;
  status: CustomerInvoiceStatus;
  paidAt: string | null;
  paymentReference: string | null;
  receiptNumber: string | null;
}

/** En kund som drift ser den: vem, vilket läge, vilka fakturor. */
export interface CustomerOverview {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  billing: AccountBillingRecord | null;
  invoices: CustomerInvoiceRecord[];
}

/** En rad i utkorgen. Skickas av arbetaren, inte av klienten. */
export interface OutboundEmailRecord {
  id: string;
  recipient: string;
  subject: string;
  kind: string;
  status: "pending" | "sent" | "failed";
  attempts: number;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
}

/** En uppgift i handlingsplanen. Avbockning sparar vem och när. */
export interface CaseTask {
  id: string;
  caseId: string;
  label: string;
  dueDate: string | null;
  doneAt: string | null;
  doneBy: string | null;
  source: "recommendation" | "manual";
  createdAt: string;
  /** Deltagaren uppgiften är delegerad till. Null = ingen tilldelning. */
  assignedTo: string | null;
}

/**
 * Intern anteckning i ett ärende. Byråns eget arbetsmaterial: synlig endast
 * för sin författare - delning sker via meddelanden. Regeln bor i
 * radskyddet; typen bär därför inget författarfält att visa upp.
 */
export interface CaseNoteRecord {
  id: string;
  caseId: string;
  body: string;
  createdAt: string;
}

/**
 * En rad i byråns team. id är null för den kopplade administratören - den
 * raden är byråns ägarkoppling och kan inte tas bort som en vanlig medlem.
 * Teammedlemskap ger ALDRIG ärendeåtkomst; den är per ärende via deltagarna.
 */
export interface FirmMemberRecord {
  id: string | null;
  userId: string;
  email: string | null;
  role: "admin" | "member";
  createdAt: string;
}

/** En öppen teaminbjudan, som byrån ser den. */
export interface FirmInvitationRecord {
  id: string;
  email: string;
  role: "admin" | "member";
  createdAt: string;
}

/** En inbjudan ställd till den inloggade, med byråns namn. */
export interface MyFirmInvitation {
  id: string;
  professionalId: string;
  firmName: string;
  role: "admin" | "member";
  createdAt: string;
}

/** Nedlagd tid i ett ärende. Den inloggades egna poster, aldrig andras. */
export interface TimeEntryRecord {
  id: string;
  caseId: string;
  minutes: number;
  note: string | null;
  occurredOn: string;
  createdAt: string;
}

/**
 * Ett samtal med krisrådgivaren: användarens beskrivning, frågorna,
 * svaren och bedömningen - i den ordning de föll. Sparas som journal,
 * inte som chatthistorik: raderna är ärendets berättelse.
 */
export interface AdvisorSessionRecord {
  id: string;
  caseId: string;
  flowId: string;
  flowTitle: string;
  startedAt: string;
  closedAt: string | null;
  entries: { at: string; who: "user" | "radgivare"; text: string }[];
}

export type DecisionStatus = "active" | "reconsidered";

/** Storheterna en premiss kan bevakas mot. Samma siffror som lägesbilden. */
export type PremiseSignal =
  | "loner"
  | "skatt"
  | "skuldtackning"
  | "passerade_frister"
  | "hyra"
  | "leverantorer"
  | "skuld";

export type PremiseComparator = "minst" | "hogst" | "sant" | "falskt";

/**
 * Det mätbara villkoret under premissen.
 *
 * Premissen är skriven på svenska av en människa; villkoret är den del
 * av den som går att räkna om. Att i stället gissa vad fritexten betyder
 * i siffror vore att hitta på - och ett beslutsunderlag som hittar på är
 * sämre än inget.
 */
export interface PremiseWatch {
  signal: PremiseSignal;
  comparator: PremiseComparator;
  /** Tröskeln för minst/högst. Null för de booleska villkoren. */
  threshold: number | null;
}

/**
 * Beslutsminnet: ett protokollfört beslut MED sin premiss. Premissen är
 * omprövningsvillkoret - när verkligheten motsäger den ska beslutet upp
 * igen, med hänvisning till vad som gällde när det fattades.
 */
export interface CaseDecisionRecord {
  id: string;
  caseId: string;
  title: string;
  rationale: string;
  premise: string | null;
  decidedAt: string;
  status: DecisionStatus;
  reconsideredAt: string | null;
  reconsiderNote: string | null;
  /** Villkoret som bevakas. Null = premissen bevakas inte, och det sägs. */
  watch: PremiseWatch | null;
  /**
   * Den observation användaren senast kvitterade som "beslutet står
   * fast". Kopplad till observationen, inte till beslutet: den som
   * svarat vid 42 % ska inte tjatas på vid 42 %, men ska höra av oss
   * igen vid 18 %.
   */
  watchAckObservation: string | null;
  watchAckAt: string | null;
}

/** Vad driftpanelen får veta om en sparad API-nyckel. Aldrig mer. */
export interface SecretInfo {
  provider: string;
  last4: string;
  updatedAt: string;
}

/** En medlem i ärendet, med namn ur profilen. Återkallade visas överstrukna. */
export interface CaseMemberRecord {
  id: string;
  caseId: string;
  userId: string;
  role: CaseRole;
  displayName: string | null;
  email: string | null;
  createdAt: string;
  revokedAt: string | null;
}

/** En inbjudan, som medlemmarna ser den. */
export interface CaseInvitationRecord {
  id: string;
  caseId: string;
  email: string;
  role: CaseRole;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

/**
 * Vad den inbjudna ser INNAN accept. Returneras bara när den inloggades
 * adress matchar inbjudans - för alla andra finns inbjudan inte.
 */
export interface InvitationPeek {
  id: string;
  companyName: string | null;
  orgNumber: string;
  role: CaseRole;
  inviterName: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

/** Driftens vy över en rådgivares villkor och ofakturerade underlag. */
export interface ProfessionalTerms {
  professionalId: string;
  name: string;
  company: string | null;
  billingEmail: string | null;
  /** Avtalad avgift per förmedling, i kronor. Null = inte satt, faktureras ej. */
  referralFeeSek: number | null;
  uninvoicedBillable: number;
}

/** En rad i händelseloggen - ärendets svarta låda. Bara läsning: loggen är append-only i databasen. */
/** En live ärendelänk: scopad läsning, tidsbegränsad, återkallbar, loggad. */
export interface CaseShareLinkRecord {
  id: string;
  caseId: string;
  scope: "overview" | "full";
  label: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  /** Antal loggade öppningar - varje läsning lämnar spår. */
  accessCount: number;
}

/**
 * Det en live-länk visar: ärendets NULÄGE, scopat. Data - aldrig
 * bedömningar; mottagarens system drar sina egna slutsatser.
 */
export interface SharedCaseView {
  scope: "overview" | "full";
  expiresAt: string;
  companyName: string | null;
  orgNumber: string;
  recommendationType: RecommendationType | null;
  recommendationTitle: string | null;
  totalDebt: string | null;
  quickLiquidationValue: string | null;
  canPaySalary: boolean | null;
  canPayTax: boolean | null;
  canPayRent: boolean | null;
  canPaySuppliers: boolean | null;
  salaryAmount: string | null;
  salaryDay: number | null;
  taxAmount: string | null;
  taxDay: number | null;
  rentAmount: string | null;
  rentDay: number | null;
  closedAt: string | null;
  healthMode: boolean;
  updatedAt: string;
  documents: { fileName: string; kind: string; reviewStatus: string; createdAt: string }[] | null;
}

export interface AuditEventRecord {
  id: number;
  caseId: string | null;
  actorUserId: string | null;
  actorRole: CaseRole | null;
  action: string;
  objectType: string;
  objectId: string | null;
  /** Vad händelsen gällde, läsbart: uppgiftens text, filnamnet, deltagarens roll. */
  detail: string | null;
  occurredAt: string;
}

/**
 * En API-nyckel för det öppna API:t, som ägaren ser den: prefix och
 * metadata - ALDRIG hemligheten. Den returneras EN gång vid skapandet
 * och lagras bara som hash.
 */
export interface ApiKeyRecord {
  id: string;
  label: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

/**
 * En signatur på en handling: vem, vilket innehåll (SHA-256), när, och
 * exakt vad som intygades. Oföränderlig - raden skrivs en gång.
 */
export interface DocumentSignature {
  id: string;
  documentId: string;
  signerUserId: string;
  signerName: string;
  signerEmail: string;
  statementVersion: string;
  statementText: string;
  contentSha256: string;
  signedAt: string;
}

/* --- Aviseringar ----------------------------------------------------------- */

/**
 * Användarens val. Speglar notification_prefs; typerna för nivå och
 * kanal bor i src/lib/notifications/events.ts, som äger reglerna.
 */
export interface NotificationPrefsRecord {
  level: "alla" | "atgard" | "tidskritiska";
  emailEnabled: boolean;
  smsEnabled: boolean;
  quietStartHour: number;
  quietEndHour: number;
}

export type NotificationPrefsInput = NotificationPrefsRecord;

/**
 * Numret, som gränssnittet får se det.
 *
 * `masked` och aldrig hela numret: en skärmdump av inställningarna ska
 * inte lämna ut mobilnumret. Den som vill se det får skriva in det igen.
 */
export interface VerifiedPhoneRecord {
  masked: string;
  verified: boolean;
  /** Sant medan en kod är utskickad och ännu giltig. */
  awaitingCode: boolean;
}

/** Ett kvitto: vad som gick ut, på vilken kanal, och skälet när det inte gjorde det. */
export interface NotificationDeliveryRecord {
  id: string;
  channel: "inapp" | "email" | "sms" | "push";
  status: "pending" | "sent" | "failed" | "suppressed";
  title: string;
  createdAt: string;
  sentAt: string | null;
  /** Läsbart skäl. Null när den gick fram. */
  reason: string | null;
}
