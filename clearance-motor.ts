/**
 * CLEARANCE - MOTORN, I EN FIL.
 *
 * Genererad 2026-08-22 av scripts/extrahera-motor.mjs ur arbetsträdet.
 * REDIGERA INTE HÄR. Ändringar hör hemma i modulerna filen byggs av;
 * annars glider originalet och kopian isär, och kopian vinner aldrig.
 *
 * INNEHÅLLER: hela domänlagret - samtalsmotorn som vägleder, analyserna,
 * guiderna, verktygen, rapportbyggarna, källorna, simuleringen och
 * gallringen - plus kontraktet (types.ts, ports.ts) som säger vad en värd
 * måste tillhandahålla för att motorn ska gå att köra.
 *
 * INNEHÅLLER INTE, och varför:
 *   React-komponenter och sidor  - ytan, inte motorn.
 *   Adaptrarna (demo/supabase/aws) - motorn talar med DataPort; ett annat
 *     verktyg skriver sin egen adapter mot samma kontrakt.
 *   API-servern, arbetarna, migrationerna - driften.
 *   src/lib/utils.ts - Tailwind-hjälpare (clsx + tailwind-merge). Hör till ytan, inte motorn.
 *
 * OMFATTNING: 88 moduler, 22116 rader kod.
 * YTTRE BEROENDEN: 1 (överst i filen).
 *
 * OMDÖPTA NAMN (33). Namnet deklarerades i mer än en modul;
 * den första behåller det, de senare får modulsuffix. Bytet gjordes med
 * TypeScripts parser, så bara riktiga referenser träffades:
 *   RecommendationType -> RecommendationType__crisisAnalysis   (i src/lib/crisisAnalysis.ts; originalet i src/data/types.ts)
 *   daysBetween -> daysBetween__crisisAnalysis   (i src/lib/crisisAnalysis.ts; originalet i src/lib/financial/model.ts)
 *   KEY -> KEY__advisor_onboardingResume   (i src/lib/advisor/onboardingResume.ts; originalet i src/lib/advisor/onboardingHandoff.ts)
 *   MONTHS -> MONTHS__advisor_premiseWatch   (i src/lib/advisor/premiseWatch.ts; originalet i src/lib/crisisAnalysis.ts)
 *   parseAmount -> parseAmount__bankStatement   (i src/lib/bankStatement.ts; originalet i src/lib/caseAnalysis.ts)
 *   toIso -> toIso__bankStatement   (i src/lib/bankStatement.ts; originalet i src/lib/crisisAnalysis.ts)
 *   DAY_MS -> DAY_MS__billing   (i src/lib/billing.ts; originalet i src/lib/actionPlan.ts)
 *   daysBetween -> daysBetween__billing   (i src/lib/billing.ts; originalet i src/lib/financial/model.ts)
 *   DAY_MS -> DAY_MS__invoice   (i src/lib/invoice.ts; originalet i src/lib/actionPlan.ts)
 *   swedishDate -> swedishDate__email_messages   (i src/lib/email/messages.ts; originalet i src/lib/documentTemplates.ts)
 *   Severity -> Severity__executiveSummary   (i src/lib/executiveSummary.ts; originalet i src/lib/crisisAnalysis.ts)
 *   median -> median__financial_insights   (i src/lib/financial/insights.ts; originalet i src/lib/bankStatement.ts)
 *   sek -> sek__financial_insights   (i src/lib/financial/insights.ts; originalet i src/lib/executiveSummary.ts)
 *   KEY -> KEY__guide_microLessons   (i src/lib/guide/microLessons.ts; originalet i src/lib/advisor/onboardingHandoff.ts)
 *   sek -> sek__integrations_creditDossier   (i src/lib/integrations/creditDossier.ts; originalet i src/lib/executiveSummary.ts)
 *   normalise -> normalise__integrations_skattekonto   (i src/lib/integrations/skattekonto.ts; originalet i src/lib/guide/showMe.ts)
 *   daysBetween -> daysBetween__invoiceSpecification   (i src/lib/invoiceSpecification.ts; originalet i src/lib/financial/model.ts)
 *   kr -> kr__invoiceSpecification   (i src/lib/invoiceSpecification.ts; originalet i src/lib/advisor/dialog.ts)
 *   swedishDate -> swedishDate__invoiceSpecification   (i src/lib/invoiceSpecification.ts; originalet i src/lib/documentTemplates.ts)
 *   capitalise -> capitalise__language   (i src/lib/language.ts; originalet i src/lib/advisor/premiseWatch.ts)
 *   kr -> kr__leadSummary   (i src/lib/leadSummary.ts; originalet i src/lib/advisor/dialog.ts)
 *   DRAFT_NOTICE -> DRAFT_NOTICE__legalPages   (i src/lib/legalPages.ts; originalet i src/lib/documentTemplates.ts)
 *   kr -> kr__liquidityKeyFigures   (i src/lib/liquidityKeyFigures.ts; originalet i src/lib/advisor/dialog.ts)
 *   tal -> tal__montecarlo_format   (i src/lib/montecarlo/format.ts; originalet i src/lib/montecarlo/fordelningar.ts)
 *   Severity -> Severity__notifications_events   (i src/lib/notifications/events.ts; originalet i src/lib/crisisAnalysis.ts)
 *   KEY -> KEY__notificationsRead   (i src/lib/notificationsRead.ts; originalet i src/lib/advisor/onboardingHandoff.ts)
 *   HORIZON_ORDER -> HORIZON_ORDER__presentation   (i src/lib/presentation.ts; originalet i src/lib/executiveSummary.ts)
 *   sek -> sek__reports_builders   (i src/lib/reports/builders.ts; originalet i src/lib/executiveSummary.ts)
 *   swedishDate -> swedishDate__reports_builders   (i src/lib/reports/builders.ts; originalet i src/lib/documentTemplates.ts)
 *   swedishDate -> swedishDate__reports_pdf   (i src/lib/reports/pdf.ts; originalet i src/lib/documentTemplates.ts)
 *   renderBlock -> renderBlock__reports_render   (i src/lib/reports/render.ts; originalet i src/lib/reports/pdf.ts)
 *   swedishDate -> swedishDate__reports_invoiceDocuments   (i src/lib/reports/invoiceDocuments.ts; originalet i src/lib/documentTemplates.ts)
 *   kr -> kr__reports_timeBasis   (i src/lib/reports/timeBasis.ts; originalet i src/lib/advisor/dialog.ts)
 *
 * INNEHÅLL - modulerna i beroendeordning:
 *      154  src/lib/caseRoles.ts
 *      220  src/data/types.ts
 *     1253  src/lib/financial/model.ts
 *     1615  src/lib/retention.ts
 *     1928  src/data/ports.ts
 *     2708  src/lib/actionPlan.ts
 *     2770  src/lib/sources/registry.ts
 *     3020  src/lib/advisor/backgroundWork.ts
 *     3353  src/lib/advisor/companyProfile.ts
 *     3484  src/lib/officialFigures.ts
 *     3612  src/lib/crisisAnalysis.ts
 *     4110  src/lib/caseAnalysis.ts
 *     4152  src/lib/advisor/dialog.ts
 *     5042  src/lib/advisor/interview.ts
 *     5514  src/lib/advisor/firstAnalysis.ts
 *     5699  src/lib/advisor/memory.ts
 *     5859  src/lib/advisor/onboardingHandoff.ts
 *     5972  src/lib/advisor/onboardingResume.ts
 *     6133  src/lib/advisor/options.ts
 *     6382  src/lib/advisor/premiseWatch.ts
 *     6727  src/lib/advisor/prepare.ts
 *     6936  src/lib/advisor/tone.ts
 *     7075  src/lib/auditDetail.ts
 *     7287  src/lib/authErrors.ts
 *     7337  src/lib/bankStatement.ts
 *     7995  src/lib/billing.ts
 *     8204  src/lib/company.ts
 *     8399  src/lib/dataExport.ts
 *     8469  src/lib/dataMinimering.ts
 *     8491  src/lib/pdf.ts
 *     8777  src/lib/documentTemplates.ts
 *     9042  src/lib/invoice.ts
 *     9244  src/lib/email/messages.ts
 *     9618  src/lib/erasure.ts
 *     9922  src/lib/executiveSummary.ts
 *    10363  src/lib/financial/sie.ts
 *    10749  src/lib/financial/fromSie.ts
 *    11042  src/lib/financial/insights.ts
 *    11536  src/lib/financial/ports.ts
 *    11779  src/lib/guide/catalogue.ts
 *    12331  src/lib/guide/actions.ts
 *    12638  src/lib/guide/microLessons.ts
 *    12856  src/lib/guide/showMe.ts
 *    12992  src/lib/taskIntelligence.ts
 *    13339  src/lib/guidedArrival.ts
 *    13464  src/lib/integrations/caseBundle.ts
 *    13693  src/lib/reports/types.ts
 *    13780  src/lib/integrations/creditDossier.ts
 *    14072  src/lib/integrations/download.ts
 *    14116  src/lib/integrations/registry.ts
 *    14379  src/lib/integrations/skattekonto.ts
 *    14590  src/lib/invoiceSpecification.ts
 *    14755  src/lib/knowledge.ts
 *    15006  src/lib/language.ts
 *    15326  src/lib/leadSummary.ts
 *    15470  src/lib/legalPages.ts
 *    15694  src/lib/liquidityKeyFigures.ts
 *    15906  src/lib/liquidityPlan.ts
 *    16082  src/lib/localTraces.ts
 *    16177  src/lib/montecarlo/slump.ts
 *    16396  src/lib/montecarlo/fordelningar.ts
 *    16959  src/lib/montecarlo/format.ts
 *    17023  src/lib/montecarlo/statistik.ts
 *    17325  src/lib/montecarlo/uttryck.ts
 *    17740  src/lib/montecarlo/motor.ts
 *    18348  src/lib/notifications.ts
 *    18668  src/lib/notifications/events.ts
 *    19008  src/lib/notifications/mailHtml.ts
 *    19049  src/lib/notifications/messages.ts
 *    19234  src/lib/notifications/phone.ts
 *    19353  src/lib/notifications/status.ts
 *    19389  src/lib/notificationsRead.ts
 *    19501  src/lib/orgNumber.ts
 *    19558  src/lib/portfolioSummary.ts
 *    19709  src/lib/presentation.ts
 *    19902  src/lib/pricing.ts
 *    20066  src/lib/proOffer.ts
 *    20125  src/lib/reports/builders.ts
 *    20533  src/lib/reports/pdf.ts
 *    20653  src/lib/reports/render.ts
 *    21027  src/lib/reports/deliver.ts
 *    21116  src/lib/reports/invoiceDocuments.ts
 *    21417  src/lib/signing.ts
 *    21600  src/lib/reports/signatureDocument.ts
 *    21721  src/lib/reports/timeBasis.ts
 *    21833  src/lib/sources/google.ts
 *    22126  src/lib/sources/news.ts
 *    22457  src/lib/sources/website.ts
 */

import { addDays, format, startOfDay } from "date-fns";

/* ==========================================================================
   src/lib/caseRoles.ts
   ========================================================================== */

/**
 * Ärendets roller på svenska - EN källa för menyer, medlemslistor och
 * inbjudningsmejl.
 *
 * Beskrivningarna säger vad rollen KAN, inte vad den heter: den som bjuder
 * in väljer i praktiken en behörighetsnivå, och "revisor" säger inget om
 * huruvida personen kan ändra i ärendet. Vilka roller som får skriva avgörs
 * i databasen (case_write_roles); texterna här ska spegla den, inte ersätta
 * den.
 *
 * INVITABLE_ROLES speglar databasens constraint: 'owner' delas inte ut per
 * mejl, och 'creditor' är medvetet utesluten tills borgenärsvyn finns -
 * en inbjudan till en vy som inte finns är ett löfte som inte hålls.
 */

export type CaseRole =
  | "owner"
  | "company_staff"
  | "reconstructor"
  | "trustee"
  | "auditor"
  | "legal_advisor"
  | "board_member"
  | "creditor"
  | "observer";

export const CASE_ROLE_LABELS: Record<CaseRole, string> = {
  owner: "Företrädare",
  company_staff: "Ekonomifunktion",
  reconstructor: "Rekonstruktör",
  trustee: "Konkursförvaltare",
  auditor: "Revisor",
  legal_advisor: "Juridisk rådgivare",
  board_member: "Styrelseledamot",
  creditor: "Borgenär",
  observer: "Observatör",
};

export const CASE_ROLE_DESCRIPTIONS: Record<CaseRole, string> = {
  owner: "Företrädare för bolaget. Ser och ändrar allt, bjuder in och återkallar.",
  company_staff: "Bolagets ekonomifunktion. Ser hela ärendet och uppdaterar uppgifterna.",
  reconstructor:
    "Förordnad av tingsrätten. Ser och uppdaterar hela ärendet, kan bjuda in och återkalla.",
  trustee: "Konkursförvaltare. Ser och uppdaterar hela ärendet, kan bjuda in och återkalla.",
  auditor: "Ser hela ärendet, ändrar ingenting.",
  legal_advisor: "Ser hela ärendet, ändrar ingenting.",
  board_member: "Ser hela ärendet, ändrar ingenting.",
  creditor: "Ser bara sin egen fordran och korrespondens - aldrig ärendet i övrigt.",
  observer: "Läsåtkomst för t.ex. tillsyn. Ser hela ärendet, ändrar ingenting.",
};

/** Rollerna som går att bjuda in per mejl, i den ordning de ska föreslås. */
export const INVITABLE_ROLES: CaseRole[] = [
  "board_member",
  "auditor",
  "company_staff",
  "legal_advisor",
  "reconstructor",
  "trustee",
  "observer",
];

/* ==========================================================================
   src/data/types.ts
   ========================================================================== */

/**
 * Domain types for CLEARANCE.
 *
 * Deliberately hand-written rather than re-exported from a backend's
 * generated types: the application should describe its own data, so that
 * swapping the backend is a change behind the data layer rather than a
 * rename across every page.
 */

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

  /*
   * Köparen och perioden, avbildade när fakturan ställdes ut.
   *
   * Avbildade, inte uppslagna: en faktura som skrivs ut om ett år ska visa
   * vem som fakturerades då och vilken adress den gick till - inte var
   * bolaget råkar sitta idag. Samma regel som beloppen redan följer.
   *
   * Null bara på rader som skapades innan fälten fanns. Nya fakturor kan
   * inte ställas ut utan namn och adress; det prövas både i buildInvoice
   * och i databasen.
   */
  customerName: string | null;
  customerOrgNumber: string | null;
  customerAddress: string | null;
  /** Tillhandahållandeperioden, ISO-datum. Se InvoiceInput.period. */
  periodStart: string | null;
  periodEnd: string | null;
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

/* -------------------------------------------------------------------------- */
/* Monte Carlo                                                                */
/* -------------------------------------------------------------------------- */

/** Antagandena. Redigeras; `specVersion` höjs av databasen vid varje ändring. */
export interface SimulationRecord {
  id: string;
  caseId: string;
  name: string;
  description: string | null;
  /** Simuleringsspec utan iterationer och frö - de hör till körningen. */
  spec: unknown;
  specVersion: number;
  createdAt: string;
  updatedAt: string;
  /** De senaste körningarna, utan resultatkroppar. Bara från get(). */
  runs?: SimulationRun[];
}

export type SimulationStatus = "queued" | "running" | "done" | "failed" | "cancelled";

/**
 * En körning. Allt som krävs för att köra om den står här: fröet,
 * motorversionen och specen som gällde.
 */
export interface SimulationRun {
  id: string;
  simulationId: string;
  status: SimulationStatus;
  seed: number;
  engineVersion: string;
  specVersion: number;
  iterations: number;
  discardedIterations: number;
  durationMs: number | null;
  error: string | null;
  /** Kvalitetsanmärkningar från motorn. Visas, göms aldrig. */
  notes: { allvar: "fel" | "varning"; kod: string; meddelande: string }[] | null;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  /** Aggregat: statistik, sannolikheter, histogram, känslighet, konvergens. Aldrig rådata. */
  results?: { outputs: unknown[] } | null;
  spec?: unknown;
}

/**
 * En begäran om radering (GDPR art. 17).
 *
 * `effectiveAt` är karenstiden: begäran verkställs tidigast då, och kan
 * återkallas fram till dess. `result` fylls först vid verkställandet och
 * säger hur många rader som faktiskt rördes per kategori - siffrorna är
 * det enda som i efterhand kan visa att raderingen gjorde något.
 */
export interface ErasureRequestRecord {
  id: string;
  requestedAt: string;
  effectiveAt: string;
  status: "begard" | "genomford" | "aterkallad";
  executedAt: string | null;
  cancelledAt: string | null;
  result: Record<string, number> | null;
}

/* --- De yttre källornas svar --------------------------------------------- */

/**
 * Formerna speglar api/server/{google,website,news}.ts.
 *
 * De är medvetet MINIMALA: klienten behöver veta om något hämtades och vad
 * det blev, inte bära en kopia av serverns interna typer. Ett `status`-fält
 * som skiljer träff, ingen träff och fel är gemensamt för alla tre - de tre
 * får aldrig slås ihop till ett tomt resultat.
 */
export interface GoogleFetchResult {
  status: "traff" | "ingen-traff" | "ingen-kalla" | "fel";
  facts?: {
    name: string | null;
    website: string | null;
    phone: string | null;
    address: string | null;
    status: string;
    reviews: { rating: number | null; count: number; excerpts?: string[] };
  };
  reason?: string;
}

export interface WebsiteFetchResult {
  status: "traff" | "forbjuden" | "ingen-traff" | "fel";
  facts?: {
    description: string | null;
    name: string | null;
    socials: { platform: string; url: string }[];
    contact: { email: string | null; phone: string | null };
    basis: string[];
  };
  note?: string;
  reason?: string;
}

export interface NewsFetchResult {
  status: "traff" | "ingen-traff" | "ingen-kalla";
  hits: {
    title: string;
    link: string;
    publishedAt: string | null;
    source: string;
    matchedOn: "namn" | "orgnr";
  }[];
  feeds: { name: string; status: "svarade" | "svarade-inte"; items: number }[];
  note: string;
}

/* ==========================================================================
   src/lib/financial/model.ts
   ========================================================================== */

/**
 * Financial Domain Model.
 *
 * Clearance's own description of a company's finances, deliberately owned by
 * this application rather than borrowed from any accounting system. Fortnox,
 * Visma, Bokio, Björn Lundén, PE Accounting and Business Central all model
 * the same reality differently; the difference belongs in an adapter, not in
 * every screen and calculation downstream.
 *
 * Two rules run through everything here.
 *
 * 1. EVERY FIGURE CARRIES ITS ORIGIN. A number in an insolvency assessment is
 *    only as good as the answer to "where did that come from, and when?".
 *    `Provenance` is not optional metadata - it is what makes the figure
 *    usable in a document that goes to a rekonstruktör or a court.
 *
 * 2. LEDGER AND BANK ARE DIFFERENT THINGS. A supplier invoice in the ledger is
 *    what is owed; a bank debit is what has been paid. Merging them naively
 *    double-counts and makes the liquidity projection wrong in the direction
 *    that hurts - it makes the company look worse or better than it is,
 *    depending on which side gets duplicated. Sources stay labelled all the
 *    way through so a projection can decide what to count.
 */

/* -------------------------------------------------------------------------- */
/* Provenance                                                                 */
/* -------------------------------------------------------------------------- */

export type ProviderId =
  | "fortnox"
  | "visma"
  | "bjornlunden"
  | "bokio"
  | "peaccounting"
  | "businesscentral"
  | "generic";

/** Where a figure came from. Never inferred; always recorded at ingestion. */
export type DataOrigin =
  /** Read from an accounting system through an adapter. */
  | { kind: "accounting"; provider: ProviderId; endpoint: string }
  /** Parsed from a bank statement the user uploaded. */
  | { kind: "bank_statement"; fileName: string }
  /** Typed in by a person. */
  | { kind: "manual"; enteredBy: string | null }
  /** Computed by Clearance from other data. */
  | { kind: "derived"; from: string };

export interface Provenance {
  origin: DataOrigin;
  /** ISO timestamp when the value was read or entered. */
  fetchedAt: string;
  /** Identifier in the source system, so a figure can be traced back. */
  sourceRef: string | null;
}

/** Anything that can be shown to a third party carries this. */
export interface Sourced<T> {
  value: T;
  provenance: Provenance;
}

/* -------------------------------------------------------------------------- */
/* Chart of accounts and ledger                                               */
/* -------------------------------------------------------------------------- */

export type AccountType =
  | "asset"
  | "liability"
  | "equity"
  | "income"
  | "expense";

export interface Account {
  /** Account number as the company uses it, e.g. "1930". */
  number: string;
  name: string;
  type: AccountType;
  /** True when the account is a bank or cash account. */
  isCashAccount?: boolean;
  vatCode?: string | null;
}

export interface VoucherRow {
  accountNumber: string;
  /** Positive debit, negative credit. One signed figure, not two columns. */
  amount: number;
  description: string | null;
  costCenterId?: string | null;
  projectId?: string | null;
}

export interface Voucher {
  id: string;
  /** Series and number as the source system shows them, e.g. "A" / 142. */
  series: string | null;
  number: string | null;
  /** ISO date, yyyy-MM-dd */
  date: string;
  description: string | null;
  rows: VoucherRow[];
  provenance: Provenance;
}

/* -------------------------------------------------------------------------- */
/* Statements                                                                 */
/* -------------------------------------------------------------------------- */

export interface AccountBalance {
  accountNumber: string;
  accountName: string;
  type: AccountType;
  /** Closing balance for the period, signed per accounting convention. */
  balance: number;
  /** Same account in the comparison period, when available. */
  previousBalance?: number | null;
}

export interface BalanceSheet {
  /** ISO date the balance refers to. */
  asOf: string;
  accounts: AccountBalance[];
  totalAssets: number;
  totalLiabilities: number;
  equity: number;
  provenance: Provenance;
}

export interface IncomeStatement {
  /** ISO dates. */
  from: string;
  to: string;
  accounts: AccountBalance[];
  revenue: number;
  operatingExpenses: number;
  result: number;
  provenance: Provenance;
}

/* -------------------------------------------------------------------------- */
/* Counterparties and open items                                              */
/* -------------------------------------------------------------------------- */

export interface Counterparty {
  id: string;
  name: string;
  orgNumber: string | null;
  email: string | null;
  phone: string | null;
  provenance: Provenance;
}

export type OpenItemKind = "receivable" | "payable";

/**
 * An unpaid invoice. Both directions share a shape because everything
 * downstream - ageing, concentration, prioritisation - treats them the same
 * way apart from the sign.
 */
export interface OpenItem {
  id: string;
  kind: OpenItemKind;
  counterpartyId: string;
  counterpartyName: string;
  documentNumber: string | null;
  /** ISO date. */
  issueDate: string;
  /** ISO date. */
  dueDate: string;
  /** Original amount including VAT, always positive. */
  totalAmount: number;
  /** What is still outstanding, always positive. */
  outstandingAmount: number;
  currency: string;
  /** Set when the company disputes it. */
  disputed?: boolean;
  provenance: Provenance;
}

/* -------------------------------------------------------------------------- */
/* Cash, tax and payroll                                                      */
/* -------------------------------------------------------------------------- */

export interface BankAccountBalance {
  id: string;
  name: string;
  accountNumber: string | null;
  balance: number;
  currency: string;
  /** ISO date the balance refers to. */
  asOf: string;
  /** Agreed overdraft facility, when known. Not counted as cash. */
  creditLimit?: number | null;
  provenance: Provenance;
}

/**
 * Skatteverket's tax account.
 *
 * ASSUMPTION, and an important one: there is no general third-party API for
 * a company's skattekonto. Accounting systems hold what the company itself
 * has booked, which is not the same as the authority's balance and is
 * routinely out of step with it. Treat any value here as the company's own
 * bookkeeping unless the origin says otherwise, and never present it as
 * Skatteverket's figure.
 */
export interface TaxAccountPosition {
  balance: number;
  asOf: string;
  /** Upcoming declared amounts and their due dates, when known. */
  upcoming: { label: string; amount: number; dueDate: string }[];
  provenance: Provenance;
}

export interface PayrollSummary {
  /** ISO dates for the period the figures cover. */
  from: string;
  to: string;
  grossSalaries: number;
  employerContributions: number;
  employeeCount: number | null;
  provenance: Provenance;
}

/* -------------------------------------------------------------------------- */
/* Dimensions and budget                                                      */
/* -------------------------------------------------------------------------- */

export interface CostCenter {
  id: string;
  code: string;
  name: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  status?: string | null;
}

export interface BudgetLine {
  accountNumber: string;
  /** ISO date for the first day of the period. */
  periodStart: string;
  amount: number;
}

/* -------------------------------------------------------------------------- */
/* Snapshot                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Everything Clearance read from one source at one moment.
 *
 * A snapshot is immutable and kept. Two things depend on that: the ability to
 * show a rekonstruktör exactly what the figures looked like when a decision
 * was taken, and the ability to diff two snapshots to see what moved.
 *
 * Fields are optional because providers differ enormously in what they
 * expose. Absence means "this provider did not supply it", which is different
 * from zero - see `FinancialCapabilities`.
 */
export interface FinancialSnapshot {
  id: string;
  provider: ProviderId;
  /** ISO timestamp. */
  capturedAt: string;
  /** Organisation number as the source system holds it. */
  orgNumber: string | null;
  companyName: string | null;

  chartOfAccounts?: Account[];
  balanceSheet?: BalanceSheet;
  incomeStatement?: IncomeStatement;
  vouchers?: Voucher[];
  counterparties?: Counterparty[];
  openItems?: OpenItem[];
  bankAccounts?: BankAccountBalance[];
  taxAccount?: TaxAccountPosition;
  payroll?: PayrollSummary;
  costCenters?: CostCenter[];
  projects?: Project[];
  budget?: BudgetLine[];

  /** Datasets the adapter tried and failed to fetch, with the reason. */
  gaps: { dataset: FinancialDataset; reason: string }[];
}

/* -------------------------------------------------------------------------- */
/* Capabilities                                                               */
/* -------------------------------------------------------------------------- */

export type FinancialDataset =
  | "chartOfAccounts"
  | "balanceSheet"
  | "incomeStatement"
  | "vouchers"
  | "counterparties"
  | "openItems"
  | "bankAccounts"
  | "taxAccount"
  | "payroll"
  | "costCenters"
  | "projects"
  | "budget";

/**
 * What a given provider can actually supply.
 *
 * This exists so the interface can say "your accounting system does not give
 * us supplier invoices, enter them here" instead of silently showing an empty
 * list. An empty list and an unavailable dataset look identical on screen and
 * mean opposite things - one is "you owe nobody", the other is "we do not
 * know what you owe". In an insolvency product that difference is the whole
 * assessment.
 */
export type FinancialCapabilities = Record<FinancialDataset, boolean>;

export const NO_CAPABILITIES: FinancialCapabilities = {
  chartOfAccounts: false,
  balanceSheet: false,
  incomeStatement: false,
  vouchers: false,
  counterparties: false,
  openItems: false,
  bankAccounts: false,
  taxAccount: false,
  payroll: false,
  costCenters: false,
  projects: false,
  budget: false,
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

export const totalOutstanding = (items: OpenItem[], kind: OpenItemKind): number =>
  items
    .filter((item) => item.kind === kind)
    .reduce((sum, item) => sum + item.outstandingAmount, 0);

/** Cash actually available. Credit facilities are deliberately excluded. */
export const totalCash = (accounts: BankAccountBalance[]): number =>
  accounts.reduce((sum, account) => sum + account.balance, 0);

/** Days between two ISO dates; negative when `to` is before `from`. */
export const daysBetween = (from: string, to: string): number => {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
};

export const isOverdue = (item: OpenItem, today: string): boolean =>
  daysBetween(item.dueDate, today) > 0 && item.outstandingAmount > 0;

/* ==========================================================================
   src/lib/retention.ts
   ========================================================================== */

/**
 * GALLRING: hur länge uppgifter sparas, och vad som händer sen.
 *
 * GDPR art. 5.1 e säger att personuppgifter inte får sparas längre än
 * nödvändigt. docs/dataskydd.md §6 hade det som en ÖPPEN punkt - "sätt
 * gallringstider". Det här är den punkten, satt: en policy med en tid och
 * en åtgärd per kategori.
 *
 * TVÅ SAKER GÖR DEN HÄR FILEN ÄRLIG.
 *
 *  1. TIDERNA ÄR DRIFTPARAMETRAR, inte kodrader. Standarderna nedan gäller
 *     tills drift sätter andra i app_settings (nyckeln retention_policy),
 *     precis som priset. En gallringstid som kräver en ny release för att
 *     ändras är en gallringstid som aldrig ändras.
 *
 *  2. GALLRINGEN STARTAR I SKUGGLÄGE. Varje kategori bär `aktiv`. Är den
 *     false RÄKNAS det som skulle gallras, men ingenting raderas - samma
 *     hållning som skuggdebiteringen: mekaniken syns och kan granskas innan
 *     den får röra något. En människa slår på den per kategori, inte ett
 *     skript av misstag. Att radera fel, eller radera det spårbarheten
 *     kräver, är värre än att spara en månad för länge.
 *
 * Åtgärden är medvetet inte alltid "radera". Händelseloggen ska överleva
 * ärendet (spårbarhet väger tyngre), så där är åtgärden `behall`. Ett
 * krissamtal kan däremot `anonymiseras` - posten finns kvar för statistik,
 * men fritexten som kan bära personuppgifter tas bort.
 */

export type RetentionAction = "radera" | "anonymisera" | "behall";

export interface RetentionCategory {
  /** Stabil nyckel - används av gallringsjobbet och av driftparametern. */
  id: string;
  /** Läsbart namn för driftpanelen. */
  label: string;
  /** Vad kategorin är och varför just den här åtgärden. */
  description: string;
  /**
   * Månader posten sparas innan åtgärden. `null` = gallras aldrig på tid
   * (t.ex. händelseloggen, som behålls för spårbarhet).
   */
  months: number | null;
  /** Vad som händer när tiden gått: radera helt, anonymisera, eller behåll. */
  action: RetentionAction;
  /**
   * Skuggläge tills en människa slår på det. false = räkna, gallra inte.
   */
  aktiv: boolean;
}

/**
 * Standardpolicyn. Siffrorna är förslag som drift kan ändra; åtgärderna är
 * medvetna och bör inte ändras utan skäl.
 */
export const DEFAULT_RETENTION: RetentionCategory[] = [
  {
    id: "hastighetsgrans",
    label: "Hastighetsgränsens loggrader",
    description:
      "IP-adress är en personuppgift. Raderna behövs bara en kort stund för att " +
      "räkna anrop, och städas redan i dag varje timme.",
    months: 0,
    action: "radera",
    // Den enda som är aktiv från start: den raderar bara sekundfärska
    // teknikrader, aldrig ärende- eller personuppgifter, och körs redan.
    aktiv: true,
  },
  {
    id: "notiser_lasta",
    label: "Lästa notiser",
    description: "En läst och kvitterad notis behöver inte sparas i åratal.",
    months: 6,
    action: "radera",
    aktiv: false,
  },
  {
    id: "delningslankar_utgangna",
    label: "Utgångna delningslänkar",
    description:
      "En återkallad eller utgången live-länk fyller ingen funktion; " +
      "åtkomstloggen som hör till den behålls dock (se händelseloggen).",
    months: 3,
    action: "radera",
    aktiv: false,
  },
  {
    id: "samtalsjournal_avslutad",
    label: "Samtalsfritext i avslutade ärenden",
    description:
      "Fritext från samtalet kan bära känsliga uppgifter. I ett sedan länge " +
      "avslutat ärende anonymiseras den – posten och tidslinjen finns kvar, " +
      "men innehållet som kan peka ut en person tas bort.",
    months: 24,
    action: "anonymisera",
    aktiv: false,
  },
  {
    id: "kontakt_avslutade_konton",
    label: "Kontaktuppgifter på stängda konton",
    description:
      "Namn, e-post och telefon på ett konto som varit stängt länge " +
      "anonymiseras. Fakturor och bokföringsunderlag berörs inte – de har " +
      "egna lagringskrav.",
    months: 24,
    action: "anonymisera",
    aktiv: false,
  },
  {
    id: "handelselogg",
    label: "Händelseloggen (spårbarhet)",
    description:
      "Ärendets svarta låda. Den ska överleva ärendet – spårbarheten väger " +
      "tyngre än gallring – så den gallras inte på tid.",
    months: null,
    action: "behall",
    aktiv: false,
  },
];

/** En driftparameter-override: bara fälten drift faktiskt satt, per id. */
export interface RetentionOverride {
  id: string;
  months?: number | null;
  action?: RetentionAction;
  aktiv?: boolean;
}

/** Övre gräns för en gallringstid: 50 år. Bortom det är det ett skrivfel. */
export const MAX_RETENTION_MONTHS = 600;

/** En avvisad del av driftparametern - vilken kategori, vilket fält, varför. */
export interface RetentionProblem {
  id: string;
  falt: string;
  skal: string;
}

const arHeltal = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v);

/**
 * VARFÖR DEN HÄR FUNKTIONEN FINNS.
 *
 * Driftparametern är JSON i app_settings. Den skrivs av en människa, och
 * en människa kan skriva -6 i stället för 6. Ett negativt antal månader ger
 * ett brytdatum i FRAMTIDEN, och ett brytdatum i framtiden matchar allt -
 * gallringen slutar vara gallring och blir en tömning. Ett månadsvärde som
 * inte är ett tal ger ett ogiltigt datum, och det kastar mitt i nattjobbet
 * så att raderingarna efter gallringen aldrig körs.
 *
 * Tre saker avvisas därför, var och en med skäl:
 *
 *  1. Ogiltiga värden (negativa, decimaltal, strängar, fel typ).
 *  2. `months: null` på en kategori som ska radera eller anonymisera. Utan
 *     tidsgräns händer ingenting - men loggen hade skrivit "0 rad(er)
 *     raderade", vilket ser ut som att det fungerade.
 *  3. Ett id som inte finns i koden. Utan det här blir en felstavning ett
 *     sparat värde som aldrig gör någon skillnad, och drift tror att de
 *     slagit på något.
 */
export const retentionOverrideProblems = (
  defaults: RetentionCategory[],
  overrides: RetentionOverride[] | null | undefined,
): RetentionProblem[] => {
  const problem: RetentionProblem[] = [];
  const kanda = new Map(defaults.map((c) => [c.id, c]));
  const sedda = new Set<string>();

  for (const rad of overrides ?? []) {
    if (typeof rad !== "object" || rad === null || Array.isArray(rad)) {
      problem.push({ id: "(okänd)", falt: "post", skal: "posten är inte ett objekt" });
      continue;
    }
    const o = rad as RetentionOverride & Record<string, unknown>;
    if (typeof o.id !== "string" || !kanda.has(o.id)) {
      problem.push({ id: String(o.id ?? "(saknas)"), falt: "id", skal: "okänd kategori" });
      continue;
    }
    if (sedda.has(o.id)) {
      problem.push({ id: o.id, falt: "id", skal: "kategorin står två gånger" });
      continue;
    }
    sedda.add(o.id);
    const standard = kanda.get(o.id)!;

    if (o.action !== undefined && !["radera", "anonymisera", "behall"].includes(o.action as string)) {
      problem.push({ id: o.id, falt: "action", skal: `okänd åtgärd "${String(o.action)}"` });
    }
    const atgard = ["radera", "anonymisera", "behall"].includes(o.action as string)
      ? (o.action as RetentionAction)
      : standard.action;

    if (o.months !== undefined) {
      if (o.months === null) {
        if (atgard !== "behall") {
          problem.push({
            id: o.id,
            falt: "months",
            skal: "utan tidsgräns gallras ingenting, men loggen hade sagt 0 rader " +
              `${ACTION_LABEL[atgard]} - sätt en tid eller åtgärden "behall"`,
          });
        }
      } else if (!arHeltal(o.months)) {
        problem.push({ id: o.id, falt: "months", skal: "månader ska vara ett heltal" });
      } else if (o.months < 0) {
        problem.push({
          id: o.id,
          falt: "months",
          skal: "negativa månader ger ett brytdatum i framtiden - det hade gallrat allt",
        });
      } else if (o.months > MAX_RETENTION_MONTHS) {
        problem.push({ id: o.id, falt: "months", skal: `högst ${MAX_RETENTION_MONTHS} månader` });
      }
    }

    if (o.aktiv !== undefined && typeof o.aktiv !== "boolean") {
      problem.push({ id: o.id, falt: "aktiv", skal: "ska vara true eller false" });
    }
  }
  return problem;
};

/**
 * Lägger driftparametern ovanpå standarden.
 *
 * Sammanslagningen är sista försvaret, inte det första: API:et avvisar en
 * trasig policy med 400, men app_settings går att skriva direkt i databasen
 * och gallringen får inte bli farlig av det. Varje fält som
 * retentionOverrideProblems underkänner FALLER TILLBAKA på standarden i
 * stället för att slås igenom. Det gör det omöjligt att få ut ett
 * brytdatum i framtiden ur en inställning.
 */
export const mergeRetentionPolicy = (
  defaults: RetentionCategory[],
  overrides: RetentionOverride[] | null | undefined,
): RetentionCategory[] => {
  const trasiga = new Set(
    retentionOverrideProblems(defaults, overrides).map((p) => `${p.id}:${p.falt}`),
  );
  const byId = new Map<string, RetentionOverride>();
  for (const o of overrides ?? []) {
    if (typeof o === "object" && o !== null && typeof o.id === "string" && !byId.has(o.id)) {
      byId.set(o.id, o);
    }
  }
  return defaults.map((cat) => {
    const o = byId.get(cat.id);
    if (!o || trasiga.has(`${cat.id}:id`)) return cat;
    const ta = (falt: string) => !trasiga.has(`${cat.id}:${falt}`);
    return {
      ...cat,
      months: o.months === undefined || !ta("months") ? cat.months : o.months,
      action: o.action !== undefined && ta("action") ? o.action : cat.action,
      aktiv: o.aktiv === undefined || !ta("aktiv") ? cat.aktiv : o.aktiv,
    };
  });
};

/**
 * Brytdatumet: allt som är äldre än så här ska gallras. `null` months ger
 * `null` - kategorin gallras aldrig på tid.
 */
export const retentionCutoff = (category: RetentionCategory, now: Date): string | null => {
  if (category.months === null) return null;
  const d = new Date(now.getTime());
  d.setMonth(d.getMonth() - category.months);
  return d.toISOString();
};

/** Sant när en post med given tidsstämpel har passerat sin gallringstid. */
export const isExpired = (
  category: RetentionCategory,
  recordIso: string,
  now: Date,
): boolean => {
  const cutoff = retentionCutoff(category, now);
  if (cutoff === null) return false;
  const rec = new Date(recordIso).getTime();
  if (Number.isNaN(rec)) return false;
  return rec <= new Date(cutoff).getTime();
};

export const ACTION_LABEL: Record<RetentionAction, string> = {
  radera: "raderas",
  anonymisera: "anonymiseras",
  behall: "behålls (gallras inte på tid)",
};

/**
 * En ärlig sammanfattning för driftpanelen: hur många kategorier som
 * faktiskt gallrar och hur många som ännu bara räknar i skuggläge.
 */
export const retentionSummary = (policy: RetentionCategory[]): string => {
  const aktiva = policy.filter((c) => c.aktiv && c.action !== "behall").length;
  const skugga = policy.filter((c) => !c.aktiv && c.action !== "behall").length;
  const behall = policy.filter((c) => c.action === "behall").length;
  const delar: string[] = [];
  delar.push(`${aktiva} ${aktiva === 1 ? "kategori gallrar" : "kategorier gallrar"} skarpt`);
  if (skugga > 0) delar.push(`${skugga} i skuggläge (räknas, gallras inte)`);
  if (behall > 0) delar.push(`${behall} behålls för spårbarhet`);
  return `${delar.join(", ")}.`;
};

/** Förklaring av skuggläget, för den som undrar varför en rad inte gallrar. */
export const SKUGGLAGE_NOTE =
  "Gallring slås på per kategori av drift, inte automatiskt. I skuggläge " +
  "räknas det som skulle gallras utan att något raderas – samma försiktighet " +
  "som skuggdebiteringen.";

/* ==========================================================================
   src/data/ports.ts
   ========================================================================== */

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
  /**
   * Skickar återställningslänk. Returnerar ALLTID ok utåt sett - om adressen
   * finns eller inte får aldrig gå att avläsa här, för då är formuläret ett
   * register över vilka bolag som är kunder. Fel som inte avslöjar det
   * (nätverk, takfrekvens) returneras.
   */
  requestPasswordReset(email: string): Promise<{ error: string | null }>;
  /** Sätter nytt lösenord för den inloggade sessionen (efter återställningslänken). */
  updatePassword(newPassword: string): Promise<{ error: string | null }>;
}

export interface CasesPort {
  /**
   * Det aktiva ärendet. För en företagare är det senaste ärendet; för en
   * praktiker med många ärenden styrs det av select() nedan, så att hela
   * inloggade läget (handlingsplan, meddelanden, dokument, logg) följer
   * det ärende praktikern öppnat.
   */
  getLatest(): Promise<CaseRecord | null>;
  /** Alla ärenden den inloggade har åtkomst till, senast uppdaterat först. */
  listMine(): Promise<CaseRecord[]>;
  /**
   * Avslutar krisfasen med orsak (North Star-mätningen). Lyckade utfall
   * kan fortsätta i hälsoläget. Ingenting raderas - akten består.
   */
  close(input: {
    caseId: string;
    reason: CaseExitReason;
    note?: string;
    enterHealth?: boolean;
  }): Promise<void>;
  /** Tillbaka till krisläget, från avslut eller hälsoläge. */
  reopen(caseId: string): Promise<void>;
  /**
   * Rådgivarens gransknings-stämpel på handlingsplanen. Endast en
   * rådgivarroll i ärendet kan sätta eller återta den - regeln prövas i
   * backend, aldrig här.
   */
  setPlanApproval(caseId: string, approved: boolean): Promise<void>;
  /** Väljer aktivt ärende. null återgår till senaste. Rent klientval - åtkomsten prövas i databasen. */
  select(caseId: string | null): void;
  create(input: NewCase & { userId: string }): Promise<CaseRecord>;
  /** Creates a minimal case so a plan has somewhere to live. */
  createMinimal(userId: string): Promise<CaseRecord>;
}

export interface KbrPort {
  create(input: KbrAssessmentInput & { userId: string }): Promise<void>;
  /** Senaste bedömningen för ärendet, eller null. Praktikervyns lägesbadge. */
  getLatestByCase(caseId: string): Promise<{ status: KbrStatus; createdAt: string } | null>;
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

  /* "Är detta din profil?" - anspråk på förifyllda katalogposter. */

  /** Innehavarens egen profil, eller null utan koppling. */
  getMyProfile(): Promise<MyProfessionalProfile | null>;
  /** Uppdaterar tjänstefälten. Identitet och verifiering är driftens. */
  updateMyProfile(input: ProfessionalProfileUpdate): Promise<void>;

  /** Gör anspråk. Databasen avvisar redan kopplade profiler och dubbletter. */
  claimProfile(input: { professionalId: string; motivation: string; contact: string }): Promise<void>;
  /** Den inloggades egna anspråk, för att visa "under granskning" i katalogen. */
  listMyClaims(): Promise<ProfileClaimRecord[]>;

  /*
   * Byråteamet: flera inloggningar per byrå. Teammedlemskap ger ALDRIG
   * ärendeåtkomst - den är per ärende via deltagarna, alltid. Reglerna
   * (endast admin bjuder in, accept kräver adressmatchning) prövas i
   * backend.
   */
  listTeam(professionalId: string): Promise<FirmMemberRecord[]>;
  listTeamInvitations(professionalId: string): Promise<FirmInvitationRecord[]>;
  inviteTeamMember(professionalId: string, email: string, role: "admin" | "member"): Promise<void>;
  revokeTeamInvitation(invitationId: string): Promise<void>;
  removeTeamMember(memberId: string): Promise<void>;
  /** Inbjudningar ställda till den inloggades adress. */
  myFirmInvitations(): Promise<MyFirmInvitation[]>;
  acceptFirmInvitation(invitationId: string): Promise<void>;

  /* Drift. Behörigheten prövas i databasen, inte här. */

  /** Alla anspråk, väntande först. Tom lista för icke-administratörer. */
  listClaims(): Promise<ProfileClaimForReview[]>;
  /** Avgör: godkännande kopplar profilen till kontot och sätter Verifierad. */
  reviewClaim(id: string, approve: boolean, note?: string): Promise<void>;
}

/**
 * Kontaktförfrågan → förhandsvisning → "Lås upp ärendet".
 *
 * Företaget väljer rådgivare och godkänner delningen; rådgivaren ser en
 * avidentifierad förhandsvisning och låser upp mot villkor. Avgiften
 * registreras vid upplåsningen enligt byråns plan och samlas på en
 * månadsfaktura. Vem som får se vad avgörs i databasen, inte här.
 */
export interface LeadsPort {
  /** Företagets förfrågan. Samtycket stämplas i databasen. */
  create(input: {
    caseId: string;
    professionalId: string;
    preview: unknown;
    summary: unknown;
  }): Promise<void>;
  /** Företagets insyn: vad som delats med vem i ärendet. */
  listForCase(caseId: string): Promise<ContactRequestRecord[]>;

  /* Rådgivarsidan. */

  /** Inkorgen: avidentifierade förhandsvisningar med priset synligt. */
  listMyLeads(): Promise<LeadPreviewRecord[]>;
  /** Accepterar villkoren och låser upp. Returnerar sammanfattningen. */
  unlock(requestId: string, termsVersion: string): Promise<unknown>;
  /** Den upplåsta sammanfattningen vid återbesök. */
  getUnlocked(requestId: string): Promise<unknown>;
  /** Avböj - kostar ingenting, företaget ser beskedet. */
  decline(requestId: string, note?: string): Promise<void>;
  /** Den löpande debiteringsöversikten: alla egna avgifter, nyast först. */
  listMyCharges(): Promise<UsageChargeRecord[]>;
}

export interface ApplicationsPort {
  /** Latest application belonging to the signed-in user, or null. */
  getMine(): Promise<ApplicationRecord | null>;
  create(input: NewApplication & { userId: string }): Promise<void>;

  /* Drift. Behörigheten prövas i databasen, inte här. */

  /** Alla ansökningar, nyast först, med behörighetsuppgifterna. */
  listAll(): Promise<ApplicationForReview[]>;
  /**
   * Godkänner: publicerar rådgivaren i katalogen och märker ansökan, som EN
   * händelse i databasen. Returnerar katalogpostens id.
   */
  approve(id: string): Promise<string>;
  /** Begär komplettering eller avslår. Motiveringen är obligatorisk. */
  review(id: string, status: "needs_info" | "rejected", note: string): Promise<void>;
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
  /**
   * Granskningsflödet: request (skrivroll), approve (ENDAST rådgivarroll
   * - företrädaren stämplar aldrig sitt eget underlag), reset (skrivroll).
   * Rollprövningen sker i backend; varje övergång journalförs.
   */
  setReview(id: string, action: "request" | "approve" | "reset"): Promise<void>;
  /**
   * Signeringen: en enkel elektronisk signatur som förseglar innehållet.
   *
   * Klienten räknar fram kontrollsumman ur de bytes den faktiskt visar
   * för användaren - det är den handlingen som signeras, inte en rad i
   * en tabell. Backend prövar behörighet och status, sätter tidpunkten
   * och journalför. Ett utkast kan aldrig signeras.
   */
  listSignatures(documentId: string): Promise<DocumentSignature[]>;
  sign(input: {
    documentId: string;
    signerName: string;
    contentSha256: string;
    statementVersion: string;
    statementText: string;
  }): Promise<DocumentSignature>;
}

/**
 * Monte Carlo-simuleringarna.
 *
 * Två sorters objekt, och skillnaden är avsiktlig: `SimulationRecord` är
 * ANTAGANDENA (redigeras), `SimulationRun` är en KÖRNING av dem (skrivs en
 * gång, ändras aldrig). Att slå ihop dem hade gjort det omöjligt att svara
 * på vilka antaganden som gällde när en viss siffra togs fram.
 */
export interface SimulationsPort {
  listByCase(caseId: string): Promise<SimulationRecord[]>;
  get(simulationId: string): Promise<SimulationRecord | null>;
  create(input: { caseId: string; name: string; description?: string | null; spec: unknown }): Promise<SimulationRecord>;
  update(input: { simulationId: string; name: string; description?: string | null; spec: unknown }): Promise<SimulationRecord>;
  remove(simulationId: string): Promise<void>;
  /**
   * Kör. Körningar över motorns tröskel köas och kommer tillbaka med
   * status "queued" - anroparen får då hämta resultatet senare.
   *
   * `seed` är hela reproducerbarheten. Utelämnas det väljer SERVERN ett,
   * en gång, och skriver ned det.
   */
  run(input: { simulationId: string; iterations: number; seed?: number | null }): Promise<SimulationRun>;
  cancel(simulationId: string): Promise<number>;
  /** Senaste körningen med resultat, eller null när ingen gjorts. */
  latestRun(simulationId: string): Promise<SimulationRun | null>;
  getRun(runId: string): Promise<SimulationRun | null>;
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

  /**
   * Läser in en SIE-fil och sparar den som ärendets lägesbild.
   *
   * SIE är bokföringsadaptern som inte kräver ett leverantörsavtal: varje
   * svenskt bokföringsprogram exporterar den. Bytesen skickas in RÅA -
   * tolkningen sker på servern, för lägesbilden är underlag för beslut om
   * rekonstruktion och konkurs, och ett underlag klienten själv sätter
   * ihop är ett underlag klienten kan skriva vad som helst i.
   *
   * Returnerar lägesbilden som den sparades, så att anroparen kan visa
   * den direkt - inklusive `gaps`, det som INTE gick att läsa.
   */
  importSie(input: {
    caseId: string;
    fileName: string;
    bytes: Uint8Array;
  }): Promise<FinancialSnapshot>;
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

export interface ProfilePort {
  /** Den inloggades profil. Null innan den skapats. */
  getMine(): Promise<UserProfile | null>;
  /**
   * Skapar profilen vid första inloggningen. Rollen väljs vid registrering
   * och är inget användaren kan byta själv efteråt - en företagare som blir
   * rådgivare ska gå genom ansökan, inte genom en rullgardin.
   */
  create(input: { role: UserRole; displayName: string | null }): Promise<UserProfile>;
  update(input: { displayName: string | null; phone: string | null }): Promise<void>;
}

export interface TasksPort {
  listByCase(caseId: string): Promise<CaseTask[]>;
  /**
   * Sår rekommendationens nästa steg som uppgifter. Idempotent: dubbletter
   * på (ärende, text) ignoreras, så två flikar som sår samtidigt ger EN
   * lista. Det är därför tabellen har sitt unika index.
   */
  seed(caseId: string, labels: string[]): Promise<void>;
  add(caseId: string, label: string, dueDate: string | null): Promise<void>;
  /** Bockar av eller ångrar. Vem och när sätts av implementationen. */
  setDone(id: string, done: boolean): Promise<void>;
  /** Delegerar uppgiften till en deltagare, eller tar bort tilldelningen. */
  assign(id: string, userId: string | null): Promise<void>;
}

/**
 * Rådgivarens klientverktyg: interna anteckningar och tidsrapportering.
 *
 * Anteckningarna är byråns eget arbetsmaterial och synliga endast för sin
 * författare; tidsposterna är den inloggades egna. Båda reglerna
 * upprätthålls i backend - en implementation utan radskydd måste själv
 * filtrera på inloggad användare.
 */
export interface AdvisorToolsPort {
  listNotes(caseId: string): Promise<CaseNoteRecord[]>;
  addNote(caseId: string, body: string): Promise<void>;
  removeNote(id: string): Promise<void>;
  listTime(caseId: string): Promise<TimeEntryRecord[]>;
  logTime(input: {
    caseId: string;
    minutes: number;
    note?: string | null;
    occurredOn?: string;
  }): Promise<void>;
  removeTime(id: string): Promise<void>;
}

/**
 * Krisrådgivarens journal och beslutsminne.
 *
 * Samtalen sparas som ärendejournal (inte chatthistorik) och besluten
 * med sin premiss - omprövningsvillkoret. Åtkomsten följer ärendets
 * vanliga regler: deltagare läser, skrivbehöriga skriver, borgenärer ser
 * ingenting. Ett beslut ändras aldrig i efterhand; omprövning är en ny
 * markering med egen tidsstämpel och not.
 */
export interface DialoguePort {
  listSessions(caseId: string): Promise<AdvisorSessionRecord[]>;
  saveSession(session: AdvisorSessionRecord): Promise<void>;
  listDecisions(caseId: string): Promise<CaseDecisionRecord[]>;
  recordDecision(input: {
    caseId: string;
    title: string;
    rationale: string;
    premise?: string | null;
    /** Det mätbara villkoret. Utelämnat = premissen bevakas inte. */
    watch?: PremiseWatch | null;
  }): Promise<void>;
  reconsiderDecision(id: string, note: string): Promise<void>;
  /**
   * "Beslutet står fast" trots att villkoret är motsagt.
   *
   * Observationen sparas som kvitteringens fingeravtryck, så frågan
   * kommer tillbaka när läget ändras igen men inte däremellan. Att bara
   * tysta flaggan vore ett sätt att tappa bort sitt eget beslut.
   */
  acknowledgePremise(id: string, observation: string): Promise<void>;
}

export interface MessagesPort {
  /**
   * Meddelanden i ärendet.
   *
   * Grundtråden (conversationId null) ser alla medlemmar; en direkt- eller
   * grupptråd bara deltagarna - det upprätthålls i databasen, inte här.
   * Kvittensen ("uppfattat") är slutgiltig och släcker även taggnotisen.
   */
  listByCase(caseId: string): Promise<CaseMessage[]>;
  listByConversation(conversationId: string): Promise<CaseMessage[]>;
  send(
    caseId: string,
    body: string,
    opts?: {
      conversationId?: string | null;
      attachmentDocumentId?: string | null;
      expectsReplyFrom?: string | null;
    },
  ): Promise<void>;
  markRead(id: string): Promise<void>;

  listConversations(caseId: string): Promise<ConversationRecord[]>;
  createDirect(caseId: string, otherUserId: string): Promise<string>;
  createGroup(caseId: string, title: string, participantUserIds: string[]): Promise<string>;
  /** Slår ihop två grupptrådar: meddelanden och deltagare flyttas till målet. */
  merge(fromConversationId: string, toConversationId: string): Promise<void>;

  /** Kvitterar "uppfattat". Kan inte tas tillbaka. */
  ack(messageId: string): Promise<void>;
  /** Notiscentret: meddelanden som väntar på den inloggades svar. */
  myOpenMentions(): Promise<OpenMention[]>;
}

export interface BillingPort {
  /**
   * Den inloggades kontostatus. Skapas vid första anropet om den saknas -
   * gratisveckan börjar när kontot först används, inte när någon råkar
   * köra ett skript.
   */
  getMine(): Promise<AccountBillingRecord>;
  /** Kundens egna fakturor och kvitton, nyast först. */
  listMyInvoices(): Promise<CustomerInvoiceRecord[]>;
  /**
   * Företagsplanen: beloppet är en driftparameter, aldrig en kodrad.
   * Läsbar för alla (priset är publikt); skrivs via ops.setCompanyPlan.
   */
  getCompanyPlan(): Promise<{
    monthlyExVatSek: number;
    businessExVatSek: number | null;
    enterpriseExVatSek: number | null;
  }>;

  /* Drift. Kräver administratörsbehörighet, som prövas i databasen. */

  listCustomers(): Promise<CustomerOverview[]>;
  /** Ställer ut en faktura. Numret sätts av implementationen, inte av vyn. */
  issueInvoice(input: {
    userId: string;
    description: string;
    netOre: number;
    vatOre: number;
    vatRate: number;
    dueAt: string;
    /*
     * Köparen, avbildad vid utställandet. Namn och adress är formkrav
     * enligt 17 kap. 24 § 5 mervärdesskattelagen och prövas både här och
     * i databasen - vyn för att kunna säga det i tid, databasen för att
     * det ska vara sant.
     */
    customerName: string;
    customerOrgNumber: string | null;
    customerAddress: string;
    /** Tillhandahållandeperioden, ISO-datum. Null = samma dag som fakturan. */
    periodStart: string | null;
    periodEnd: string | null;
    /**
     * Vart momsfakturan mejlas. Null = ingen adress känd; fakturan skapas
     * ändå och finns i kundens inloggning, och utkorgen visar att inget
     * mejl gick ut. Att tyst hoppa över mejlet vore värre.
     */
    recipientEmail: string | null;
  }): Promise<CustomerInvoiceRecord>;
  /**
   * Registrerar en inbetalning. Skapar kvittonumret och öppnar kontot igen
   * om det var stängt.
   */
  registerPayment(input: {
    invoiceId: string;
    paidAt: string;
    reference: string | null;
    /** Vart kvittot mejlas. Se noten på issueInvoice. */
    recipientEmail: string | null;
  }): Promise<void>;
  /** Stänger ett konto vars faktura förfallit. Raderar ingenting. */
  closeAccount(userId: string): Promise<void>;
  /**
   * Utkorgen, för drift.
   *
   * Finns för att ett mejl som inte gått fram ska synas för en människa.
   * Utan den vyn är skillnaden mellan "skickat" och "misslyckat fem gånger"
   * osynlig tills kunden hör av sig - eller inte hör av sig.
   */
  listOutbox(): Promise<OutboundEmailRecord[]>;
  /** Köar om ett misslyckat utskick. Endast drift; skickade rader rörs aldrig. */
  retryEmail(id: string): Promise<void>;
}

export interface OpsPort {
  /**
   * API-nyckelhanteringen. Grundregeln bor i databasen, inte här: en sparad
   * nyckel kan ALDRIG läsas tillbaka av klienten - listan visar bara de
   * fyra sista tecknen och bytesdatum. Kapas en driftsession är byte av
   * nycklar det värsta som kan hända, inte utläsning.
   */
  listSecrets(): Promise<SecretInfo[]>;
  setSecret(provider: string, secret: string): Promise<void>;
  deleteSecret(provider: string): Promise<void>;

  /**
   * Rådgivarnas avgifter. Avgiften är en avtalsuppgift och sätts av drift,
   * aldrig av rådgivaren. Ändringen gäller framåt: redan skapade
   * förmedlingar behåller sin stämplade avgift.
   */
  listProfessionalTerms(): Promise<ProfessionalTerms[]>;
  setReferralFee(professionalId: string, feeSek: number | null): Promise<void>;

  /**
   * Prisplanen per byrå: per-ärende, abonnemang, användning eller licens.
   * Parametrar, inte kod - inga belopp är hårdkodade i produkten.
   */
  listBillingPlans(): Promise<
    {
      professionalId: string;
      planKind: "per_case" | "subscription" | "usage" | "enterprise";
      unlockFeeSek: number | null;
      monthlyFeeSek: number | null;
      /** Skuggläge (pilotens spår A): avgifter registreras och visas men faktureras aldrig. */
      shadow: boolean;
    }[]
  >;
  setBillingPlan(input: {
    professionalId: string;
    planKind: "per_case" | "subscription" | "usage" | "enterprise";
    unlockFeeSek: number | null;
    monthlyFeeSek: number | null;
  }): Promise<void>;
  /**
   * Kreditspärren: byggd från dag ett, avstängd som standard. Prövas vid
   * nästa avgiftsbelagda köp - pågående arbete påverkas aldrig.
   */
  setBillingHold(professionalId: string, hold: boolean, reason?: string): Promise<void>;
  /**
   * Skuggläget per byrå. Stämplas på varje avgift NÄR den uppstår -
   * att slå av läget efterfakturerar aldrig gamla skuggrader.
   */
  setBillingShadow(professionalId: string, shadow: boolean): Promise<void>;

  /**
   * Företagsabonnemangets månadsavgift (exkl. moms). En parameter, satt
   * av drift - gäller framåt och visas omedelbart i alla lås- och
   * pristexter.
   */
  setCompanyPlan(input: {
    monthlyExVatSek: number;
    businessExVatSek?: number | null;
    enterpriseExVatSek?: number | null;
  }): Promise<void>;

  /**
   * Gallringspolicyn: en tid och en åtgärd per kategori (GDPR art. 5.1 e).
   * Standarden bor i koden (src/lib/retention.ts); den här läser drifts
   * override ur app_settings (nyckeln retention_policy) och lägger den
   * ovanpå. Läsbar utan admin - policyn är transparens, inte en hemlighet.
   */
  getRetentionPolicy(): Promise<RetentionCategory[]>;
  /**
   * Sätter drift-overriden per kategori (tid, åtgärd, aktiv/skuggläge).
   * Skrivs bara av administratör, som prövas i databasen. Att slå på
   * skarp gallring för en kategori är ett medvetet beslut, inte en default.
   */
  setRetentionPolicy(overrides: RetentionOverride[]): Promise<void>;

  /** North Star och churn: återhämtade, i hälsoläge, dålig churn, öppna. */
  northStarCounts(): Promise<{
    recovered: number;
    inHealth: number;
    badChurn: number;
    openCases: number;
  }>;
}

/**
 * Live ärendelänken: länken ÄR ärendet, alltid aktuell. Skiljer sig
 * MEDVETET från inbjudningarna (medlemskap via adress): en länk ger
 * scopad LÄSNING - tidsbegränsad, återkallbar, och varje öppning
 * loggas. fetch är publik (även utloggad mottagare) och svarar med
 * samma tystnad för okända, utgångna och återkallade länkar.
 */
export interface SharesPort {
  list(caseId: string): Promise<CaseShareLinkRecord[]>;
  create(input: {
    caseId: string;
    scope: "overview" | "full";
    label?: string | null;
    validDays: number;
  }): Promise<CaseShareLinkRecord>;
  revoke(id: string): Promise<void>;
  fetch(token: string): Promise<SharedCaseView | null>;
}

/**
 * API-nycklarna för det öppna API:t. Samma regler som driftens valv:
 * hemligheten returneras EN gång vid skapandet, lagras bara som hash
 * och kan aldrig läsas igen - bara återkallas (aldrig raderas).
 */
export interface ApiKeysPort {
  listMine(): Promise<ApiKeyRecord[]>;
  /**
   * Skapar en nyckel. Lösenordet krävs och prövas på servern.
   *
   * Nyckeln överlever sessionen som skapade den: den som loggar ut och
   * återkallar sina sessioner har ändå en giltig nyckel liggande hos den
   * som hann mynta den. Därför är skapandet en av de två åtgärder i
   * produkten som kräver att anroparen visar att hen kan lösenordet -
   * inte bara att hen sitter på en session. Se PrivacyPort.requestErasure.
   */
  create(label: string, password: string): Promise<{ record: ApiKeyRecord; secret: string }>;
  /**
   * Återkallar en nyckel. Kräver INTE lösenordet, med flit: bekräftelser
   * hör hemma före det som ökar en angripares räckvidd, inte före det som
   * minskar den. Den som misstänker en läcka ska kunna stänga nyckeln
   * direkt.
   */
  revoke(id: string): Promise<void>;
}

/**
 * Aviseringarna: användarens val, numret och kvittona.
 *
 * Porten skriver aldrig händelser. De skapas av enqueue_notification() i
 * databasen och av arbetaren - en klient som kunde skapa aviseringar
 * kunde skicka SMS i någon annans namn.
 */
export interface NotificationSettingsPort {
  /** Valen. Null när användaren aldrig rört dem: då gäller förvalen. */
  getPrefs(): Promise<NotificationPrefsRecord | null>;
  savePrefs(input: NotificationPrefsInput): Promise<void>;

  /** Numret, maskerat och med verifieringsstatus. Null = inget nummer. */
  getPhone(): Promise<VerifiedPhoneRecord | null>;
  /**
   * Steg 1. Numret normaliseras och koden hashas INNAN den lämnar
   * klienten - databasen ska aldrig ha sett klartexten.
   */
  startPhoneVerification(rawPhone: string): Promise<void>;
  /** Steg 2. False = fel kod, utgången kod eller för många försök. */
  confirmPhoneVerification(code: string): Promise<boolean>;
  removePhone(): Promise<void>;

  /**
   * Kvittona för de senaste aviseringarna: vad som gick ut, på vilken
   * kanal, och skälet när något inte gjorde det. Det är svaret på
   * "varför fick jag inget SMS".
   */
  listRecentDeliveries(limit?: number): Promise<NotificationDeliveryRecord[]>;
}

export interface AuditPort {
  /**
   * Händelseloggen, nyast först. Append-only i databasen - det här är
   * läsfönstret mot ärendets svarta låda, och exporten av den.
   */
  listByCase(caseId: string): Promise<AuditEventRecord[]>;
}

export interface MembersPort {
  /**
   * Ärendets deltagare och inbjudningar.
   *
   * Säkerhetsmodellen (samma som i databasen): länken är inte nyckeln,
   * adressen är. acceptInvitation lyckas bara när den inloggades adress
   * matchar inbjudans, och peekInvitation svarar med samma neutrala
   * tystnad som lösenordsåterställningen för alla andra.
   */
  listMembers(caseId: string): Promise<CaseMemberRecord[]>;
  listInvitations(caseId: string): Promise<CaseInvitationRecord[]>;
  invite(caseId: string, email: string, role: CaseRole): Promise<void>;
  revokeInvitation(invitationId: string): Promise<void>;
  /** null om inbjudan inte finns, är utgången eller ställd till annan adress. */
  peekInvitation(invitationId: string): Promise<InvitationPeek | null>;
  /** Returnerar ärendets id vid lyckad accept. */
  acceptInvitation(invitationId: string): Promise<string>;
}

/**
 * DEN REGISTRERADES RÄTTIGHETER (GDPR kap. III).
 *
 * Utdraget (art. 15 och 20) byggs i klienten ur de portar som redan finns
 * - se src/lib/dataExport.ts - och behöver därför ingen egen metod här.
 * Radering är en annan sak: den kan inte göras av en klient som raderar
 * rad för rad, för då blir resultatet olika beroende på var den avbryts.
 * Den bor i EN transaktion i databasen, och det här är vägen dit.
 *
 * Rättelse (art. 16) sker via profile och cases - RECTIFICATION_MAP i
 * src/lib/erasure.ts säger var varje uppgift ändras, och vilka som inte
 * går att ändra själv.
 */
export interface PrivacyPort {
  /** Den öppna eller senast avslutade begäran, eller null. */
  getErasureRequest(): Promise<ErasureRequestRecord | null>;
  /**
   * Begär radering av det egna kontot. Verkställs tidigast efter
   * karenstiden. En andra begäran ger tillbaka den befintliga - att
   * förlänga karenstiden vid varje klick hade gjort raderingen omöjlig.
   *
   * LÖSENORDET KRÄVS och prövas på servern, inte i webbläsaren.
   * Karenstiden skyddar mot ånger, inte mot en angripare: den som har
   * kapat sessionen kan återkalla begäran lika lätt som hen gjorde den,
   * och begära om den dagen efter. Det som stoppar en kapad session är
   * att den inte kan svara på frågan "vad är lösenordet".
   */
  requestErasure(password: string): Promise<ErasureRequestRecord>;
  /** Återkallar begäran. Går bara innan den verkställts. */
  cancelErasure(): Promise<ErasureRequestRecord>;
}

/**
 * DE YTTRE KÄLLORNA: registret, Google, webbplatsen och nyheterna.
 *
 * Hämtningarna bor på servern (api/server/{google,website,news}.ts) - dels
 * för att webbläsaren inte får ringa tredje part, dels för att nycklar och
 * SSRF-skydd hör hemma där. Porten är vägen dit.
 *
 * `null` BETYDER "INGEN HÄMTNING GJORDES", inte "inget hittades". Det är
 * hela skillnaden: en backend utan serverdel (demoläget, PostgREST-bryggan)
 * ska säga att den inte hämtade något, och panelen visar då "blir live i
 * drift". Att i stället returnera ett tomt resultat hade läst som "vi
 * kollade, det fanns inget" - ett påstående ingen av dem kan stå för.
 */
export interface SourcesPort {
  /** Google Places: webbadress, omdömen och verksamhetsstatus. */
  google(input: { companyName: string; ort?: string }): Promise<GoogleFetchResult | null>;
  /** Bolagets egen webbplats. Adressen kommer från Google - aldrig gissad. */
  website(url: string): Promise<WebsiteFetchResult | null>;
  /** Nyheter ur driftens RSS-flöden. */
  news(input: { companyName: string; orgNumber: string }): Promise<NewsFetchResult | null>;
}

export interface DataPort {
  auth: AuthPort;
  contact: ContactPort;
  profile: ProfilePort;
  messages: MessagesPort;
  tasks: TasksPort;
  advisorTools: AdvisorToolsPort;
  dialogue: DialoguePort;
  members: MembersPort;
  audit: AuditPort;
  shares: SharesPort;
  apiKeys: ApiKeysPort;
  notificationSettings: NotificationSettingsPort;
  billing: BillingPort;
  ops: OpsPort;
  cases: CasesPort;
  kbr: KbrPort;
  payments: PaymentsPort;
  invoices: InvoicesPort;
  professionals: ProfessionalsPort;
  leads: LeadsPort;
  applications: ApplicationsPort;
  referrals: ReferralsPort;
  documents: DocumentsPort;
  financial: FinancialPort;
  simulations: SimulationsPort;
  privacy: PrivacyPort;
  companyLookup: CompanyLookupPort;
  sources: SourcesPort;
}

/* ==========================================================================
   src/lib/actionPlan.ts
   ========================================================================== */

/**
 * Handlingsplanens nedräkning.
 *
 * Ren logik för "hur långt är det kvar till det här datumet, och hur ska
 * det sägas". Bor i lib och inte i komponenten av samma skäl som allt annat
 * datumberoende: en frist som visas fel är ett fel med rättslig innebörd,
 * och då ska formuleringen gå att testa utan webbläsare.
 *
 * Tonerna mappar på designsystemets betydelser: "frist" är reserverad för
 * en klocka som går (fristfärgen), "critical" för en som redan ringt.
 */

export interface Countdown {
  /** Hela dagar kvar. Negativt när datumet passerat. */
  daysLeft: number;
  /** "idag", "imorgon", "om 5 dagar", "för 3 dagar sedan". */
  label: string;
  tone: "passed" | "today" | "soon" | "later";
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Kalenderdagar, inte 24-timmarsperioder: en frist den 12:e är "imorgon"
 * hela den 11:e, oavsett klockslag. Samma princip som stängningsjobbet.
 */
export const countdownTo = (iso: string, now: Date): Countdown => {
  const target = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysLeft = Math.round((target.getTime() - today.getTime()) / DAY_MS);

  if (daysLeft < 0) {
    const abs = Math.abs(daysLeft);
    return {
      daysLeft,
      label: abs === 1 ? "igår" : `för ${abs} dagar sedan`,
      tone: "passed",
    };
  }
  if (daysLeft === 0) return { daysLeft, label: "idag", tone: "today" };
  if (daysLeft === 1) return { daysLeft, label: "imorgon", tone: "soon" };
  return {
    daysLeft,
    label: `om ${daysLeft} dagar`,
    // Samma varselfönster som betalningspåminnelserna och kalendern: tre
    // dagar. Ett system som varnar på olika dagar på olika ställen lär
    // användaren att ignorera varningarna.
    tone: daysLeft <= 3 ? "soon" : "later",
  };
};

/**
 * Sorteringsordning för handlingsplanen: passerade frister överst - de är
 * inte historia utan olösta problem - därefter närmast i tiden.
 */
export const compareByUrgency = (a: { iso: string }, b: { iso: string }): number =>
  a.iso.localeCompare(b.iso);

/* ==========================================================================
   src/lib/sources/registry.ts
   ========================================================================== */

/**
 * KÄLLREGISTRET: var uppgifterna om bolaget faktiskt kan komma ifrån.
 *
 * Bakgrundspanelen sa "ingen källa ansluten" på sex moment. Den var ärlig
 * men tom, och frågan blev: kan vi skrapa det här?
 *
 * SVARET ÄR NEJ FÖR DE FLESTA AV DEM, och det är inte en teknisk
 * begränsning utan ett medvetet val. Skillnaden mellan hämtningssätten är
 * hela poängen med den här filen:
 *
 *  - "hamta"          Vi hämtar en sida som är publicerad för att läsas,
 *                     och följer robots.txt. Bolagets egen webbplats är
 *                     det tydliga fallet: användaren äger den.
 *  - "rss"            Ett flöde som finns till för att prenumereras på.
 *  - "api-avtal"      Officiellt gränssnitt som kräver avtal eller nyckel.
 *                     Koden är meningslös innan avtalet finns.
 *  - "agarmedgivande" API som kräver att bolaget själv ger oss åtkomst.
 *                     Det är genomförbart just här - kunden ÄR ägaren.
 *  - "harledd"        Ingen hämtning alls: räknas fram ur uppgifter vi
 *                     redan har.
 *  - "forbjuden"      Får inte hämtas. Motpartens villkor förbjuder det,
 *                     och en produkt som bygger på att bryta mot dem tappar
 *                     källan den dag någon märker det - mitt i ett ärende.
 *
 * VARFÖR INTE BARA SKRAPA ÄNDÅ
 *
 * Tre skäl, i den ordning de kostar:
 *
 *  1. Det slutar fungera. En skrapa mot en sajt som inte vill bli skrapad
 *     är trasig efter nästa layoutändring eller blockering. Ett bolag i
 *     rekonstruktion får då en analys som tyst blivit tunnare, utan att
 *     någon sagt det.
 *  2. Det är ett avtalsbrott. LinkedIn, Meta och Google förbjuder det i
 *     sina villkor. Ett bolag som säljer krishantering till andra bolag
 *     kan inte ha den risken i sin egen leveranskedja.
 *  3. Det gör uppgifterna omöjliga att stå för. "Var kommer det här
 *     ifrån?" måste gå att besvara för varje rad i en analys som används
 *     som beslutsunderlag.
 *
 * Det som ÄR skrapbart - bolagets egen webbplats - hämtas därför ordentligt:
 * robots.txt först, tydlig user-agent, en sida i taget, och ingenting
 * påhittat när svaret uteblir.
 */

export type Acquisition =
  | "hamta"
  | "rss"
  | "api-avtal"
  | "agarmedgivande"
  | "harledd"
  | "forbjuden";

export interface SourceSpec {
  /** Samma id som BackgroundSource i advisor/backgroundWork. */
  id: string;
  label: string;
  acquisition: Acquisition;
  /** Sant när källan går att använda i den här versionen, utan nytt avtal. */
  live: boolean;
  /** Vad den ger analysen. Skrivet för en läsare, inte för en logg. */
  value: string;
  /** Vad som krävs för att den ska bli live. Tom sträng när den redan är det. */
  needs: string;
  /**
   * Sant när källans tillgänglighet avgörs vid KÖRNING och inte av
   * konfigurationen.
   *
   * Företagsregistret är det enda fallet: uppslaget går genom dataporten
   * och kan svara eller inte svara för ett givet organisationsnummer.
   * Panelen visar då utfallet - "hämtat ur företagsregistret" eller
   * "gav inget svar på det här numret" - och det är riktigare än vad ett
   * statiskt register kan säga.
   *
   * `live` beskriver för sådana källor PRODUKTIONSLÄGET: finns ett avtal
   * som gör uppslaget meningsfullt utanför demoläget.
   */
  runtime?: boolean;
  /**
   * Den rättsliga eller praktiska grunden. Fylls i för ALLA källor, även
   * de som är live: den som frågar var en uppgift kommer ifrån ska få
   * svaret ur registret och inte ur någons minne.
   */
  basis: string;
}

export const SOURCES: SourceSpec[] = [
  {
    id: "foretagsregister",
    label: "Offentlig företagsinformation",
    acquisition: "api-avtal",
    live: false,
    runtime: true,
    value: "Firma, säte, bolagsform, styrelse, F-skatt och momsregistrering.",
    needs:
      "Avtal med Bolagsverket för Näringslivsregistret, eller ett abonnemang " +
      "hos en kreditupplysare (Creditsafe, Syna, Bisnode).",
    basis:
      "Uppgifterna är offentliga, men de tillhandahålls genom avtalade " +
      "gränssnitt. Att i stället skrapa allabolag.se eller ratsit vore att " +
      "ta betalt av en återförsäljares arbete utan avtal - och deras villkor " +
      "förbjuder det uttryckligen. " +
      "GOOGLE LÖSER INTE DEN HÄR RADEN, och det är värt att skriva ut " +
      "eftersom frågan kommer: Google Places känner till PLATSER och " +
      "verksamheter, inte juridiska personer. Därifrån får vi adress, " +
      "telefon och webbplats - aldrig organisationsnummer, styrelse, " +
      "F-skatt eller momsregistrering. Det är Bolagsverket och Skatteverket.",
  },
  {
    id: "webb",
    label: "Bolagets webbplats",
    acquisition: "hamta",
    /*
     * LIVE, OCH KÖRNINGSBEROENDE. Skillnaden mot förut är att hämtaren nu
     * finns: API-slutpunkten /v1/sources/website hämtar sidan på riktigt,
     * med robots.txt först och SSRF-skydd (api/server/website.ts), och
     * tolkningen är prövad (sources/website.ts, tests/sources.ts).
     *
     * Ingen nyckel och inget avtal krävs - sidan är publik och kunden äger
     * den - så till skillnad från företagsregistret och recensionerna är
     * den här live utan förbehåll. Men OM den ger något avgörs ändå vid
     * körning: en sida kan vara nere, robots.txt kan säga nej, eller sidan
     * kan sakna strukturerad data. Panelen visar då utfallet i klartext
     * (traff / robots säger nej / hämtad men tom / gick inte att nå) i
     * stället för en tyst lucka.
     */
    live: true,
    runtime: true,
    value:
      "Vad bolaget säger att det gör, kontaktvägar, och vilka sociala konton " +
      "det själv länkar till.",
    /* Byggd och påslagen. Inget kvarstår att koppla in. */
    needs: "",
    basis:
      "Sidan är publicerad för att läsas, och kunden äger den. Vi läser " +
      "robots.txt först och respekterar den, anger vem vi är i user-agent, " +
      "och hämtar ett fåtal sidor - inte hela sajten. Servern vägrar " +
      "dessutom adresser som pekar på interna nät (SSRF-skydd).",
  },
  {
    id: "sociala-medier",
    label: "Sociala medier",
    acquisition: "forbjuden",
    live: false,
    value: "Aktivitetsnivå och hur bolaget beskriver sig utåt.",
    needs:
      "Officiell API-åtkomst hos respektive plattform. LinkedIns och Metas " +
      "villkor förbjuder automatiserad insamling utan den.",
    basis:
      "Får inte skrapas. Det vi däremot gör är att läsa vilka konton bolaget " +
      "SJÄLVT länkar till från sin webbplats - den uppgiften kommer ur en " +
      "sida vi har rätt att hämta, och säger vilka kanaler som finns utan " +
      "att röra plattformarna.",
  },
  {
    id: "recensioner",
    label: "Kundrecensioner",
    acquisition: "api-avtal",
    /*
     * KÖRNINGSBEROENDE, som företagsregistret. Hämtningen är byggd
     * (api/server/google.ts) och tolkningen prövad (sources/google.ts).
     * Om källan svarar avgörs vid körning av två saker: att driften har
     * en Google-nyckel, och att bolaget går att matcha entydigt.
     *
     * Den andra är inte en teknikalitet. Google har inget
     * organisationsnummer att matcha på, så två bolag med samma namn går
     * inte att skilja åt - och då hämtar vi ingenting hellre än fel
     * bolags omdömen.
     */
    live: false,
    runtime: true,
    value:
      "Betyg, antal omdömen och verksamhetsstatus - om Google visar bolaget " +
      "som öppet, tillfälligt stängt eller permanent stängt.",
    /*
     * SKRIVEN FÖR DEN SOM LÄSER PANELEN, inte för den som driftsätter.
     * Texten här visas för en företagare mitt i en kris; ett variabelnamn
     * ur en containerkonfiguration säger hen ingenting. Det tekniska
     * (GOOGLE_MAPS_API_KEY, flaggan i Terraform) står i basis och i
     * docs/driftsattning.md, där den som ska göra jobbet letar.
     */
    needs:
      "Kopplingen mot Google är byggd men inte påslagen i den här driften. " +
      "När den är det hämtas uppgifterna automatiskt – du behöver inte lämna " +
      "något själv.",
    basis:
      "Google Places API (nyckeln GOOGLE_MAPS_API_KEY, flaggan " +
      "enable_google_source i infrastrukturen). Ett betalt, officiellt " +
      "gränssnitt - inte skrapning. " +
      "Villkoren tillåter cachning i högst 30 dagar och kräver att källan " +
      "anges där uppgiften visas; båda reglerna står i sources/google.ts. " +
      "Recensenternas namn och bilder hämtas aldrig - vi läser omdömet om " +
      "bolaget, inte om människan som skrev det.",
  },
  {
    id: "nyheter",
    label: "Nyhetsartiklar om bolaget",
    acquisition: "rss",
    live: true,
    runtime: true,
    value: "Om något hänt utåt som ärendet behöver ta höjd för.",
    needs: "",
    basis:
      "Ett RSS-flöde publiceras för att prenumereras på - att hämta det är " +
      "dess syfte, och kräver inget avtal. Vilka flöden som läses är en " +
      "driftparameter (app_settings, nyckeln news_feeds), och utfallet " +
      "redovisas PER FLÖDE: en källa som slutat svara syns i stället för " +
      "att bevakningen tyst blir tunnare. " +
      "Fulltext är upphovsrättsskyddad och lagras aldrig - rubrik, datum, " +
      "länk och källa, inget mer. " +
      "En träff kräver bolagsnamnet som sammanhängande fras eller " +
      "organisationsnumret; ett för allmänt namn matchas inte alls, och då " +
      "säger panelen det i stället för att leverera brus. " +
      "Djup mediebevakning (Retriever, Meltwater) kräver fortfarande " +
      "abonnemang och ingår inte.",
  },
  {
    id: "branschdata",
    label: "Konkurrenter och branschläge",
    acquisition: "harledd",
    live: false,
    value: "Hur bolagets läge står sig mot branschen.",
    needs:
      "SNI-koden ur företagsregistret, plus SCB:s öppna statistik-API för " +
      "branschtal. Faller alltså med företagsregistret.",
    basis:
      "Ingen hämtning om enskilda konkurrenter - den uppgiften finns inte " +
      "att hämta lagligt och skulle bli en gissning. Det som går är " +
      "branschens aggregerade tal, ur offentlig statistik.",
  },
];

export const sourceById = (id: string): SourceSpec | undefined =>
  SOURCES.find((s) => s.id === id);

/** Källor som får användas i den här versionen. */
export const liveSources = (): SourceSpec[] => SOURCES.filter((s) => s.live);

/**
 * Källor som ALDRIG får hämtas automatiskt, oavsett hur mycket någon vill.
 *
 * Egen funktion och inte bara ett fält, för att den ska gå att anropa från
 * en kontroll: det är skillnad på "inte byggt än" och "får inte byggas".
 */
export const forbiddenSources = (): SourceSpec[] =>
  SOURCES.filter((s) => s.acquisition === "forbjuden");

/* ==========================================================================
   src/lib/advisor/backgroundWork.ts
   ========================================================================== */

/**
 * BAKGRUNDSARBETET: det som pågår medan användaren svarar.
 *
 * Poängen är att intervjun och analysen ska löpa parallellt, så att det
 * finns något färdigt när sista frågan är besvarad. Panelen visar vad
 * som pågår, ett moment i taget.
 *
 * DEN HÄR FILEN FÅR INTE LJUGA. Det är hela svårigheten. En panel som
 * radar upp "analyserar sociala medier - klart" när ingen sådan koppling
 * finns är inte en trevlig detalj, det är ett påstående om att systemet
 * vet något det inte vet - och användaren fattar beslut om sitt bolag
 * med den bilden. Varje moment bär därför en KÄLLA, och ett moment vars
 * källa inte är ansluten redovisas som just det: "Ingen källa ansluten",
 * med en not om vad som skulle krävas. Momenten står kvar i listan
 * eftersom de hör till kartan över vad tjänsten ska kunna - men de
 * markeras aldrig som gjorda.
 *
 * Formuleringen om insamlingen är användarens egen, ordagrant, och den
 * står i DISCLOSURE nedan. Den säger vad som samlas in och varifrån.
 * Motsatsen - att systemet "tar in all information den kan" - är både
 * otydlig och obehaglig, och testet i tests/onboarding.ts förbjuder den.
 */

/** Vad ett moment vilar på. */
export type BackgroundSource =
  | "foretagsregister"
  | "intervjun"
  | "analysmotorn"
  | "webb"
  | "sociala-medier"
  | "recensioner"
  | "nyheter"
  | "branschdata";

/*
 * Fyra tillstånd, och "i-drift" är det som skiljer en ärlig tom ruta från en
 * nedslående. En källa kan vara BYGGD OCH PÅSLAGEN men ändå inte ha hämtat
 * något i just den här förhandsvisningen - webbplatsläsaren kör mot ett
 * riktigt bolags sida först i skarp drift. Att då skriva "ingen källa
 * ansluten" vore fel: källan FINNS. "i-drift" säger det som är sant - blir
 * live i drift - i stället för "kan inte".
 */
export type BackgroundState = "pagar" | "klar" | "ingen-kalla" | "i-drift";

export interface BackgroundTask {
  id: string;
  label: string;
  source: BackgroundSource;
  state: BackgroundState;
  /** Vad som faktiskt kom fram, eller vad som saknas för att det ska kunna göra det. */
  note: string;
}

/**
 * Meningen som beskriver insamlingen för användaren.
 *
 * Ordagrant som den ska stå. Den säger tre saker: att informationen är
 * OFFENTLIG, att den KOMBINERAS med det användaren själv berättar, och
 * varför - träffsäkerhet. Ingen av de tre får falla bort.
 */
export const DISCLOSURE =
  "Jag samlar in relevant offentlig information om företaget och kombinerar den med det du berättar för att skapa en så träffsäker analys som möjligt.";

/**
 * Källor som faktiskt är anslutna i den här versionen.
 *
 * De tre första är interna: intervjun är användarens egna svar,
 * analysmotorn räknar på dem, och företagsregistret läses genom
 * dataporten. De YTTRE källorna kommer ur src/lib/sources/registry, så att
 * panelen inte kan påstå att något är anslutet som registret säger kräver
 * ett avtal - eller tvärtom.
 */
const CONNECTED: BackgroundSource[] = [
  "foretagsregister",
  "intervjun",
  "analysmotorn",
  ...(liveSources().map((s) => s.id) as BackgroundSource[]),
];

/**
 * Vad som saknas för de källor som inte är anslutna.
 *
 * Texten kommer ur källregistret, som är den enda platsen där det står
 * VARFÖR en källa inte är ansluten. Den gamla varianten stod skriven här,
 * och sa samma sak om alla fem: "kräver en koppling". Det är sant men
 * oanvändbart - skillnaden mellan "kräver ett avtal med Bolagsverket" och
 * "får inte hämtas alls" är precis vad den som läser behöver veta.
 */
const missingNote = (source: BackgroundSource): string => {
  const spec = sourceById(source);
  if (!spec) return "";
  return spec.needs;
};

interface Plan {
  id: string;
  label: string;
  source: BackgroundSource;
  /** Texten när momentet är klart. Får bara nämna sådant källan faktiskt gav. */
  done: (ctx: BackgroundContext) => string;
}

export interface BackgroundContext {
  companyName: string;
  orgNumber: string;
  /** Sant när uppslaget mot företagsregistret gav svar. */
  registryHit: boolean;
  /**
   * Sant när webbplatsen faktiskt hämtades och lästes den här körningen.
   * I demo-/förhandsläget hämtas ingen sida - då är den false och raden
   * redovisas som "i-drift" (blir live i drift), inte som klar eller saknad.
   */
  websiteFetched?: boolean;
  /**
   * Satt när Google faktiskt tillfrågades den här körningen: antalet
   * omdömen, eller null när bolaget inte gick att matcha entydigt.
   * `undefined` = ingen hämtning gjordes.
   */
  reviewCount?: number | null;
  /**
   * Satt när nyhetsflödena faktiskt hämtades den här körningen: antalet
   * träffar. `undefined` betyder att ingen hämtning gjordes (demo- och
   * förhandsläge) - då redovisas raden som "i-drift", inte som saknad.
   */
  newsHits?: number;
  /** Antal besvarade intervjufrågor just nu. */
  answered: number;
  /** Antal ifyllda profilfält just nu. */
  profileFields: number;
}

/**
 * Momenten, i den ordning de visas.
 *
 * Listan är medvetet densamma oavsett om källan finns: den är kartan
 * över vad en företagsanalys består av. Skillnaden syns i tillståndet,
 * inte i om raden finns.
 *
 * Etiketterna är SUBSTANTIV, inte "Hämtar det", "Läser det andra". Två
 * skäl: en lista där varje rad börjar med ett nytt verb är brusigare än
 * en lista med saker, och ett naket "Hämtar X" är just den sortens
 * väntebesked som produkten förbjuder (tests/prepare.ts, regel 4) -
 * det säger vad systemet gör men inte vad användaren får. Vad som pågår
 * står i stället en gång, överst, som ett riktigt väntebesked.
 */
const PLAN: Plan[] = [
  {
    id: "register",
    label: "Offentlig företagsinformation",
    source: "foretagsregister",
    done: (c) => `${c.companyName} (${c.orgNumber}) hämtat ur företagsregistret.`,
  },
  {
    id: "webbplats",
    label: "Bolagets webbplats",
    source: "webb",
    done: () => "",
  },
  {
    id: "sociala",
    label: "Sociala medier",
    source: "sociala-medier",
    done: () => "",
  },
  {
    id: "recensioner",
    label: "Kundrecensioner",
    source: "recensioner",
    done: () => "",
  },
  {
    id: "nyheter",
    label: "Nyhetsartiklar om bolaget",
    source: "nyheter",
    done: (c) =>
      c.newsHits === undefined
        ? ""
        : c.newsHits === 0
          ? "Flödena lästes. Ingen artikel nämnde bolaget vid namn eller organisationsnummer."
          : `${c.newsHits} ${c.newsHits === 1 ? "artikel" : "artiklar"} nämner bolaget. Rubrik, datum och länk – aldrig artikeltexten.`,
  },
  {
    id: "bransch",
    label: "Branschtillhörighet",
    source: "intervjun",
    done: () => "Branschen kommer ur ditt eget svar, inte ur extern statistik.",
  },
  {
    id: "konkurrenter",
    label: "Konkurrenter",
    source: "branschdata",
    done: () => "",
  },
  {
    id: "storlek",
    label: "Bolagets storlek",
    source: "intervjun",
    done: (c) => `Bygger på ${c.answered} besvarade frågor om verksamheten.`,
  },
  {
    id: "risker",
    label: "Risker",
    source: "analysmotorn",
    done: () => "Räknas fram ur dina svar när intervjun är klar.",
  },
  {
    id: "mojligheter",
    label: "Möjligheter",
    source: "analysmotorn",
    done: () => "Räknas fram ur dina svar när intervjun är klar.",
  },
  {
    id: "profil",
    label: "Första företagsprofilen",
    source: "analysmotorn",
    done: (c) => `${c.profileFields} av 9 fält i profilen vilar på ett svar.`,
  },
];

/**
 * Momentens tillstånd just nu.
 *
 * `upTo` är hur långt körningen hunnit - panelen tickar fram ett moment i
 * taget så att det syns att något händer. Moment vars källa saknas
 * "hinns" också, men landar i ingen-kalla i stället för klar.
 */
export const backgroundTasks = (ctx: BackgroundContext, upTo: number): BackgroundTask[] =>
  PLAN.map((plan, i) => {
    const connected = CONNECTED.includes(plan.source);
    // Registret är anslutet, men det betyder inte att det svarade. Ett
    // moment som inte fick svar får inte stå som klart.
    const answered = plan.source !== "foretagsregister" || ctx.registryHit;
    if (i >= upTo) {
      return { id: plan.id, label: plan.label, source: plan.source, state: "pagar", note: "" };
    }
    /*
     * ETT SVAR SLÅR REGISTRET. Google står som "inte ansluten" i registret
     * eftersom det beror på en nyckel driften kan sakna - men om källan
     * FAKTISKT svarat i den här körningen är den bevisligen ansluten här.
     * Grenen ligger därför före !connected: registret beskriver det
     * normala, körningen beskriver verkligheten.
     */
    /*
     * Kundrecensionerna. Google har inget organisationsnummer att matcha
     * på, så två bolag med samma namn går inte att skilja åt - och då
     * hämtar vi hellre ingenting än fel bolags omdömen. Ett null-svar
     * betyder alltså "vi frågade, bolaget gick inte att matcha", vilket
     * är något helt annat än att källan saknas.
     */
    if (plan.source === "recensioner" && ctx.reviewCount !== undefined) {
      return {
        id: plan.id,
        label: plan.label,
        source: plan.source,
        state: "klar",
        note:
          ctx.reviewCount === null
            ? "Google tillfrågades. Bolaget gick inte att matcha entydigt – då hämtas ingenting hellre än fel bolags omdömen."
            : ctx.reviewCount === 0
              ? "Google svarade. Bolaget finns men har inga omdömen."
              : `${ctx.reviewCount} omdömen hämtade från Google. Recensenternas namn och bilder hämtas aldrig.`,
      };
    }

    if (!connected) {
      return {
        id: plan.id,
        label: plan.label,
        source: plan.source,
        state: "ingen-kalla",
        note: missingNote(plan.source),
      };
    }
    // Webbplatsläsaren är byggd och påslagen, men hämtar en riktig sida
    // först i skarp drift. Utan en verklig hämtning i den här körningen är
    // det varken klart eller saknat - det blir live i drift.
    if (plan.source === "webb" && !ctx.websiteFetched) {
      return {
        id: plan.id,
        label: plan.label,
        source: plan.source,
        state: "i-drift",
        note:
          "Byggd och påslagen. Läser bolagets egen webbplats när tjänsten " +
          "körs skarpt mot ett riktigt bolag – robots.txt först, aldrig något gissat.",
      };
    }
    // Nyhetsbevakningen: samma resonemang som webbplatsen. Flödena läses
    // mot ett riktigt bolagsnamn först i skarp drift.
    if (plan.source === "nyheter" && ctx.newsHits === undefined) {
      return {
        id: plan.id,
        label: plan.label,
        source: plan.source,
        state: "i-drift",
        note:
          "Byggd och påslagen. Läser namngivna RSS-flöden när tjänsten körs " +
          "skarpt mot ett riktigt bolag – rubrik, datum och länk, aldrig " +
          "artikeltexten.",
      };
    }
    if (!answered) {
      return {
        id: plan.id,
        label: plan.label,
        source: plan.source,
        state: "ingen-kalla",
        note: "Företagsregistret gav inget svar på det här numret.",
      };
    }
    return { id: plan.id, label: plan.label, source: plan.source, state: "klar", note: plan.done(ctx) };
  });

export const BACKGROUND_STEPS = PLAN.length;

/** Sammanfattningen under panelen: vad som blev gjort och vad som inte kunde göras. */
export const backgroundSummary = (tasks: BackgroundTask[]): string => {
  const done = tasks.filter((t) => t.state === "klar").length;
  const missing = tasks.filter((t) => t.state === "ingen-kalla").length;
  const iDrift = tasks.filter((t) => t.state === "i-drift").length;
  const grund = `${done} av ${tasks.length} moment klara.`;
  const driftDel =
    iDrift > 0
      ? ` ${iDrift} ${iDrift === 1 ? "moment blir" : "moment blir"} live i drift – byggt och påslaget, hämtas mot ett riktigt bolag skarpt.`
      : "";
  if (missing === 0) return `${grund}${driftDel}`;
  return `${grund}${driftDel} ${missing} kunde inte göras – källan är inte ansluten, och då säger jag hellre det än gissar.`;
};

/* ==========================================================================
   src/lib/advisor/companyProfile.ts
   ========================================================================== */

/**
 * FÖRETAGSPROFILEN: det systemet har förstått, uppdaterat efter varje svar.
 *
 * Profilen är arbetsminnet under introduktionssamtalet. Den fyller två
 * syften: den styr vilken fråga som kommer härnäst (en fråga vars svar
 * redan är känt ska inte ställas), och den är det underlag den första
 * analysen vilar på.
 *
 * Fälten är precis de nio som en lägesbedömning behöver för att inte bli
 * generisk. Varje fält är null tills något faktiskt sagt något om det -
 * "okänd" är ett ärligt värde, en gissning är det inte. Ett bolag vars
 * omsättning ingen frågat om ska stå som okänd, inte som noll.
 *
 * Användaren behöver inte se profilen, men får göra det. Ett system som
 * bygger en bild av någons bolag och håller den dold ber om ett
 * förtroende det inte förtjänat; ett som visar den kan rättas.
 */

export interface CompanyProfile {
  industry: string | null;
  employees: string | null;
  revenue: string | null;
  customers: string | null;
  geography: string | null;
  businessModel: string | null;
  growthPhase: string | null;
  riskLevel: string | null;
  digitalMaturity: string | null;
}

/** Etiketterna användaren ser. Ordningen är den profilen visas i. */
export const PROFILE_LABELS: { key: keyof CompanyProfile; label: string }[] = [
  { key: "industry", label: "Bransch" },
  { key: "employees", label: "Anställda" },
  { key: "revenue", label: "Omsättning" },
  { key: "customers", label: "Kunder" },
  { key: "geography", label: "Geografi" },
  { key: "businessModel", label: "Affärsmodell" },
  { key: "growthPhase", label: "Tillväxtfas" },
  { key: "riskLevel", label: "Risknivå" },
  { key: "digitalMaturity", label: "Digital mognad" },
];

export const emptyProfile = (): CompanyProfile => ({
  industry: null,
  employees: null,
  revenue: null,
  customers: null,
  geography: null,
  businessModel: null,
  growthPhase: null,
  riskLevel: null,
  digitalMaturity: null,
});

/**
 * Ett svar läggs till profilen.
 *
 * Senare svar skriver över tidigare för samma fält - en fråga som
 * förfinar en tidigare bild ska få göra det. Det som ALDRIG händer är
 * att ett känt värde nollställs: `null` i en uppdatering betyder "den
 * här frågan sa inget om det fältet", inte "glöm det du visste".
 */
export const applyAnswer = (
  profile: CompanyProfile,
  fills: Partial<CompanyProfile>,
): CompanyProfile => {
  const next = { ...profile };
  for (const [key, value] of Object.entries(fills) as [keyof CompanyProfile, string | null][]) {
    if (value !== null && value !== undefined && value !== "") next[key] = value;
  }
  return next;
};

/**
 * ETT PROFILFÄLT KAN BÄRA FLERA VÄRDEN.
 *
 * Sedan intervjun tillåter flerval kan ett fält vara "Varuförsäljning och
 * Projekt" - en bilverkstad säljer arbete och reservdelar, och den
 * blandningen ÄR uppgiften. Varje `profile.businessModel === "Projekt"`
 * blev då tyst falsk, och analysen tappade sina observationer utan att
 * något gick sönder.
 *
 * Jämförelser mot profilfält som kan slås ihop ska därför gå genom den
 * här funktionen. tests/onboarding.ts vaktar att de gör det.
 */
export const profilInnehaller = (varde: string | null | undefined, del: string): boolean =>
  typeof varde === "string" && varde.split(" och ").some((d) => d.trim() === del);

/** Profilen som rader, med okända fält utskrivna som okända. */
export const profileRows = (profile: CompanyProfile): { label: string; value: string }[] =>
  PROFILE_LABELS.map(({ key, label }) => ({ label, value: profile[key] ?? "okänd" }));

/** Hur mycket av profilen som vilar på ett faktiskt svar. */
export const profileFilled = (profile: CompanyProfile): number =>
  PROFILE_LABELS.filter(({ key }) => profile[key] !== null).length;

/**
 * Risknivån härleds, den frågas inte.
 *
 * Ingen företagare svarar "hög" på en rak fråga om sin egen risknivå, och
 * en profil som frågar efter den mäter viljan att erkänna, inte läget.
 * Den räknas därför ur svar som var och en är lätta att lämna.
 */
export const deriveRiskLevel = (signals: {
  /** Situationsvalet från introduktionen, om det finns. */
  situationId: string | null;
  /** Största kundens andel av intäkterna, om frågan ställts. */
  concentration: "låg" | "medel" | "hög" | null;
  /** Omsättningens riktning senaste året. */
  trend: "upp" | "stabil" | "ner" | "kraftigt ner" | null;
}): string => {
  // Ett akut betalningsläge slår ut allt annat: det är inte en
  // sammanvägning, det är ett faktum.
  if (signals.situationId === "loner" || signals.situationId === "ansvar") return "Hög";
  let score = 0;
  if (signals.situationId === "fakturor") score += 2;
  if (signals.situationId === "oro") score += 1;
  if (signals.concentration === "hög") score += 2;
  if (signals.concentration === "medel") score += 1;
  if (signals.trend === "kraftigt ner") score += 2;
  if (signals.trend === "ner") score += 1;
  if (score >= 3) return "Hög";
  if (score >= 1) return "Medel";
  return "Låg";
};

/* ==========================================================================
   src/lib/officialFigures.ts
   ========================================================================== */

/**
 * Figures and legal references that change with the calendar.
 *
 * These live in one file on purpose. Amounts like the price base amount are
 * set annually, and a stale figure in an insolvency service is not a cosmetic
 * problem - someone can plan a payment around it. Keeping them scattered
 * through the components is how they rot without anyone noticing.
 *
 * WHEN REVIEWING: work down the list, check each value against the source
 * given with it, then move REVIEWED_ON forward. Do not move the date without
 * having checked, and do not guess a value that a source has not confirmed -
 * the UI presents these as facts about Swedish law.
 *
 * Last reviewed: 2026-07-31.
 */

/** The date the values below were last checked against their sources. */
export const REVIEWED_ON = "2026-07-31";

/** Year the annual amounts below apply to. */
export const FIGURES_YEAR = 2026;

/* -------------------------------------------------------------------------- */
/* Amounts                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Price base amount (prisbasbelopp) for 2026, set by the government.
 * Source: regeringen.se, "Prisbasbelopp för 2026 fastställt" (Sept 2025).
 */
export const PRICE_BASE_AMOUNT = 59_200;

/**
 * Standard employer contribution rate (arbetsgivaravgift).
 * 31.42% has been the full rate since 2009 and still applies in 2026.
 * Source: Skatteverket, "Arbetsgivaravgifter".
 *
 * Two reductions exist and are NOT applied by the projection, because
 * applying them needs each employee's age and monthly salary, which the
 * planner does not ask for. The planner says so where the rate is shown -
 * over-stating a cost is the safer direction, but the user should know:
 *  - 20.81% for employees who turned 18 but not 23 at the start of the year,
 *    on salary up to 25 000 kr/month (1 Apr 2026 - 30 Sep 2027).
 *  - 10.21% (retirement pension contribution only) for employees who turned
 *    67 or older at the start of the year, from 1 Jan 2026.
 */
export const EMPLOYER_CONTRIBUTION_RATE = 0.3142;

/**
 * Ceiling for the state wage guarantee (lönegaranti) per employee: four price
 * base amounts, per Lönegarantilagen (1992:497) 9 §. The amount that applies
 * is the one in force when the bankruptcy or reconstruction decision is made.
 */
export const WAGE_GUARANTEE_CEILING = PRICE_BASE_AMOUNT * 4;

/** Maximum number of months the wage guarantee can cover. */
export const WAGE_GUARANTEE_MAX_MONTHS = 8;

/**
 * Minimum share capital for a private limited company.
 * 25 000 kr applies to companies formed on or after 1 Jan 2020; companies
 * formed before that date are still on the older 50 000 kr requirement.
 * Source: Bolagsverket.
 */
export const MIN_SHARE_CAPITAL = 25_000;
export const MIN_SHARE_CAPITAL_PRE_2020 = 50_000;

/* -------------------------------------------------------------------------- */
/* Bankruptcy statistics                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Most recent complete calendar year of Swedish bankruptcy statistics.
 *
 * Only quote a full year here. A part-year figure invites a comparison the
 * reader cannot make correctly, and bankruptcies are strongly seasonal.
 *
 * Source: Tillväxtanalys, the authority responsible for the official
 * statistics on "Konkurser och offentliga ackord".
 */
export const BANKRUPTCY_STATS = {
  year: 2025,
  companies: 10_731,
  employeesAffected: 24_882,
  /** The year before, for context. */
  previousYear: 2024,
  previousYearCompanies: 10_762,
  source: "Tillväxtanalys",
  sourceUrl:
    "https://www.tillvaxtanalys.se/statistik/konkurser/konkurserochoffentligaackord.html",
} as const;

/* -------------------------------------------------------------------------- */
/* Legal references                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Cited so the reader can look the rule up rather than take our word for it.
 * Include the SFS number: there are two laws named "lag om
 * företagsrekonstruktion", and the 1996 one was repealed on 1 August 2022.
 */
export const LEGAL_REFS = {
  /** Insolvency (obestånd) and the grounds for bankruptcy. */
  bankruptcy: "Konkurslagen (1987:672) 1 kap. 2 §",
  /** Recovery of payments made before the bankruptcy. */
  clawback: "Konkurslagen (1987:672) 4 kap.",
  /** The current reconstruction act; replaced lag (1996:764). */
  reconstruction: "Lagen (2022:964) om företagsrekonstruktion",
  /** Duty to draw up a control balance sheet, and the liability for not doing so. */
  controlBalanceSheet: "Aktiebolagslagen (2005:551) 25 kap. 13 och 18 §§",
  /** Personal liability of a representative for the company's unpaid tax. */
  representativeLiability: "Skatteförfarandelagen (2011:1244) 59 kap. 12–13 §§",
  /** The state wage guarantee. */
  wageGuarantee: "Lönegarantilagen (1992:497)",
} as const;

/* -------------------------------------------------------------------------- */
/* Formatting                                                                 */
/* -------------------------------------------------------------------------- */

/** Formats an amount in kronor the Swedish way, e.g. "236 800 kr". */
export const formatSek = (amount: number): string =>
  `${Math.round(amount).toLocaleString("sv-SE")} kr`;

/* ==========================================================================
   src/lib/crisisAnalysis.ts
   ========================================================================== */

/**
 * Crisis triage logic for the CLEARANCE wizard.
 *
 * Kept as a pure module so the reasoning can be reviewed and tested on its
 * own - this drives what a company in distress is told to do, so it should
 * not be tangled up in rendering code.
 *
 * IMPORTANT: the legal references below point to the rules a Swedish company
 * is actually judged by, so the output can be checked against them. They are
 * signposts for the user to verify with a professional, not legal advice, and
 * the UI must keep saying so.
 */

export type RecommendationType__crisisAnalysis = "bankruptcy" | "reconstruction" | "stabilize";
export type Urgency = "immediate" | "weeks" | "months";
export type Severity = "critical" | "warning" | "info";

export interface AnalysisInput {
  canPaySalary: boolean | null;
  canPayTax: boolean | null;
  canPayRent: boolean | null;
  canPaySuppliers: boolean | null;
  salaryAmount: number;
  salaryDay: number;
  taxAmount: number;
  taxDay: number;
  rentAmount: number;
  rentDay: number;
  totalDebt: number;
  quickLiquidationValue: number;
  employees: string;
}

export interface RiskFlag {
  id: string;
  severity: Severity;
  title: string;
  body: string;
  legalRef?: string;
}

export interface TimelineEvent {
  iso: string;
  daysAway: number;
  label: string;
  amount: number | null;
  severity: Severity;
  note?: string;
}

export interface NextStep {
  text: string;
  /** Free-text deadline, e.g. "Före 12 aug". */
  deadline?: string;
  urgent?: boolean;
}

export interface CrisisAnalysis {
  /**
   * Hur mycket underlag bedömningen vilar på.
   *
   * "none" betyder att INGEN av betalningsfrågorna är besvarad. Då finns
   * ingen bedömning att göra, och produkten säger det i stället för att
   * gissa. Tidigare svarade den "din situation är pressad men inte akut,
   * med rätt åtgärder finns goda chanser" på noll svar - ett påstående
   * utan grund, motiverat med orden "utifrån dina svar".
   */
  basis: "complete" | "partial" | "none";
  type: RecommendationType__crisisAnalysis;
  title: string;
  description: string;
  urgency: Urgency;
  solvency: {
    indication: "likely_insolvent" | "at_risk" | "no_indication";
    explanation: string;
  };
  coverage: {
    ratio: number | null;
    explanation: string;
  };
  reasons: string[];
  riskFlags: RiskFlag[];
  timeline: TimelineEvent[];
  nextSteps: NextStep[];
}

const MONTHS = [
  "januari", "februari", "mars", "april", "maj", "juni",
  "juli", "augusti", "september", "oktober", "november", "december",
];

const startOfToday = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Nivån då kapitalbristflaggan tänds - täckningsgrad under 50 %.
 *
 * Detta är ett PRODUKTBESLUT, inte en rättsregel. Lagen frågar efter eget
 * kapital mot registrerat aktiekapital; det vi har att gå på i det här
 * skedet är snabbavyttringsvärde mot total skuld. Talen mäter olika
 * saker, och gränsen är därför en avvägning: sätts den högre tänds
 * flaggan för bolag som är helt friska, sätts den lägre missas fall där
 * styrelsens ansvar redan löper.
 *
 * Konstanten står ensam och namngiven för att den ska gå att ändra på ett
 * ställe efter en verklig bedömning - inte hittas som en 0.5 mitt i en
 * villkorssats. Flaggans text skriver ut både den uppmätta procenten och
 * den här gränsen, så att den som läser den ser vad den vilar på.
 */
export const KBR_COVERAGE_THRESHOLD = 0.5;

/** Next time this day-of-month falls, clamped into short months. */
export const nextOccurrence = (dayOfMonth: number, from: Date = startOfToday()): Date => {
  const clampInto = (year: number, month: number) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(dayOfMonth, daysInMonth));
  };
  let candidate = clampInto(from.getFullYear(), from.getMonth());
  if (candidate < from) {
    candidate = clampInto(from.getFullYear(), from.getMonth() + 1);
  }
  return candidate;
};

const daysBetween__crisisAnalysis = (a: Date, b: Date): number =>
  Math.round((b.getTime() - a.getTime()) / 86_400_000);

const toIso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const formatSwedishDate = (iso: string): string => {
  const parts = iso.split("-").map(Number);
  return `${parts[2]} ${MONTHS[parts[1] - 1]}`;
};

export const analyseCrisis = (input: AnalysisInput): CrisisAnalysis => {
  const today = startOfToday();
  const {
    canPaySalary, canPayTax, canPayRent, canPaySuppliers,
    totalDebt, quickLiquidationValue, employees,
  } = input;

  const answers = [canPaySalary, canPayTax, canPayRent, canPaySuppliers];
  const cannotPayCount = answers.filter((v) => v === false).length;
  const answeredCount = answers.filter((v) => v !== null).length;
  const basis: CrisisAnalysis["basis"] =
    answeredCount === 0 ? "none" : answeredCount === answers.length ? "complete" : "partial";

  const ratio = totalDebt > 0 ? quickLiquidationValue / totalDebt : null;
  const hasEmployees = employees !== "" && employees !== "0";

  // ---- Timeline -----------------------------------------------------------
  const timeline: TimelineEvent[] = [];
  const pushEvent = (
    day: number,
    amount: number,
    label: string,
    canPay: boolean | null,
    note?: string,
  ) => {
    if (!day) return;
    const date = nextOccurrence(day, today);
    timeline.push({
      iso: toIso(date),
      daysAway: daysBetween__crisisAnalysis(today, date),
      label,
      amount: amount || null,
      severity: canPay === false ? "critical" : canPay === true ? "info" : "warning",
      note,
    });
  };

  pushEvent(
    input.taxDay, input.taxAmount, "Skatt/moms förfaller", canPayTax,
    canPayTax === false
      ? "Sista dagen att ha vidtagit åtgärd för att undvika personligt betalningsansvar."
      : undefined,
  );
  pushEvent(
    input.salaryDay, input.salaryAmount, "Löneutbetalning", canPaySalary,
    canPaySalary === false && hasEmployees
      ? "Anställda berörs. Lönegarantin gäller först vid konkurs eller rekonstruktion."
      : undefined,
  );
  pushEvent(input.rentDay, input.rentAmount, "Hyra förfaller", canPayRent);
  timeline.sort((a, b) => a.daysAway - b.daysAway);

  // ---- Solvency indication ------------------------------------------------
  // Obestånd per KonkL 1:2 = oförmåga att betala skulder i takt med att de
  // förfaller, och att oförmågan inte är endast tillfällig.
  let solvency: CrisisAnalysis["solvency"];
  if (canPaySalary === false && canPayTax === false) {
    // Obestånd has two limbs, and the second one is the one that gets
    // forgotten: the inability must not be merely temporary. Assets that can
    // be realised quickly and cover the debts are direct evidence that it may
    // be. Calling that obestånd would push a company with a solvable squeeze
    // towards bankruptcy, which is the most costly direction to be wrong in.
    if (ratio !== null && ratio >= 1) {
      solvency = {
        indication: "at_risk",
        explanation:
          `Varken löner eller skatt kan betalas på förfallodagen, vilket är allvarligt. Samtidigt uppger du att tillgångar som snabbt kan avyttras täcker skulderna i sin helhet. Obestånd förutsätter att betalningsoförmågan inte bara är tillfällig, och den uppgiften talar emot att så är fallet – det ser mer ut som ett likviditetsproblem än som obestånd. Avgörande blir om tillgångarna faktiskt går att omsätta i tid (${LEGAL_REFS.bankruptcy}).`,
      };
    } else if (ratio !== null && ratio >= 0.5) {
      solvency = {
        indication: "at_risk",
        explanation:
          `Varken löner eller skatt kan betalas på förfallodagen. Tillgångarna täcker en betydande del av skulderna, så det är inte givet att betalningsoförmågan är varaktig – och obestånd förutsätter att den inte bara är tillfällig. Läget behöver bedömas av någon som kan värdera hur snabbt tillgångarna går att omsätta (${LEGAL_REFS.bankruptcy}).`,
      };
    } else {
      solvency = {
        indication: "likely_insolvent",
        explanation:
          `När varken löner eller skatt kan betalas på förfallodagen, och tillgångarna inte täcker skulderna, talar mycket för obestånd – alltså att bolaget inte kan betala sina skulder i takt med att de förfaller och att det inte bara är tillfälligt (${LEGAL_REFS.bankruptcy}).`,
      };
    }
  } else if (cannotPayCount >= 2) {
    solvency = {
      indication: "at_risk",
      explanation:
        "Flera betalningar kan inte hållas. Det kan vara en tillfällig likviditetsbrist, men bedöms situationen som varaktig kan det räknas som obestånd.",
    };
  } else {
    solvency = {
      indication: "no_indication",
      explanation:
        "Utifrån dina svar finns inget tydligt tecken på obestånd, men läget är ansträngt och bör följas noga.",
    };
  }

  // ---- Coverage -----------------------------------------------------------
  let coverage: CrisisAnalysis["coverage"];
  if (ratio === null) {
    coverage = { ratio: null, explanation: "Ingen skuld angiven, så täckningsgrad kan inte beräknas." };
  } else {
    const pct = Math.round(ratio * 100);
    // Bands are set so the wording stays consistent with the verdict: a
    // company being told bankruptcy should not simultaneously read that its
    // assets give it "room to manoeuvre".
    if (ratio < 0.2) {
      coverage = {
        ratio,
        explanation: `Det du snabbt kan sälja täcker bara omkring ${pct} % av skulderna. Även om allt avyttras återstår merparten av skulden.`,
      };
    } else if (ratio < 0.5) {
      coverage = {
        ratio,
        explanation: `Det du snabbt kan sälja täcker omkring ${pct} % av skulderna. Det ger visst manöverutrymme men löser inte hela situationen.`,
      };
    } else {
      coverage = {
        ratio,
        explanation: `Det du snabbt kan sälja täcker omkring ${pct} % av skulderna, vilket är en förhållandevis stark position i det här läget.`,
      };
    }
  }

  // ---- Recommendation -----------------------------------------------------
  // Unlike the earlier version, the balance-sheet figures now actually move
  // the outcome: strong asset coverage points toward reconstruction rather
  // than bankruptcy even when payments are being missed.
  let type: RecommendationType__crisisAnalysis;
  let title: string;
  let description: string;
  let urgency: Urgency;

  const decentCoverage = ratio !== null && ratio >= 0.5;

  if (canPaySalary === false && canPayTax === false) {
    if (decentCoverage || canPaySuppliers === true) {
      type = "reconstruction";
      urgency = "immediate";
      title = "Rekonstruktion bör utredas omgående";
      description =
        "Du kan inte betala varken löner eller skatt, vilket är allvarligt. Samtidigt finns tillgångar eller leverantörsrelationer kvar som talar för att verksamheten kan vara värd att rädda. En rekonstruktör bör bedöma det här inom dagar, inte veckor.";
    } else {
      type = "bankruptcy";
      urgency = "immediate";
      title = "Konkurs bör övervägas";
      description =
        "Varken löner eller skatt kan betalas, och tillgångarna täcker bara en mindre del av skulderna. Det talar för obestånd. Sök juridisk hjälp omgående – att fortsätta driva verksamheten vidare kan öka ditt personliga ansvar.";
    }
  } else if (cannotPayCount >= 2) {
    type = "reconstruction";
    urgency = "weeks";
    title = "Företagsrekonstruktion kan vara möjlig";
    description =
      "Du har betalningssvårigheter men verksamheten kan ha förutsättningar att överleva. Rekonstruktion ger skydd mot utmätning och möjlighet att förhandla ned skulder, men kräver att verksamheten bedöms livskraftig.";
  } else if (cannotPayCount === 1) {
    type = "stabilize";
    urgency = "weeks";
    title = "Åtgärda innan det växer";
    description =
      "En betalning kan inte hållas. Det är hanterbart nu, men den här typen av problem sprider sig snabbt om likviditeten inte stärks. Agera medan du fortfarande har handlingsutrymme.";
  } else {
    type = "stabilize";
    urgency = "months";
    title = "Stabilisering och likviditetsåtgärder";
    description =
      "Din situation är pressad men inte akut. Med rätt åtgärder finns goda chanser att stabilisera verksamheten. Fokusera på kassaflödet och håll dialogen igång med borgenärer.";
  }

  // ---- Reasons ------------------------------------------------------------
  const reasons: string[] = [];
  if (canPaySalary === false) reasons.push("Löner kan inte betalas i tid – anställdas trygghet påverkas direkt.");
  if (canPayTax === false) reasons.push("Skatt/moms kan inte betalas i tid – detta utlöser en frist för personligt ansvar.");
  if (canPayRent === false) reasons.push("Hyra kan inte betalas – risk för uppsägning av lokalen.");
  if (canPaySuppliers === false) reasons.push("Leverantörer kan inte betalas – risk för stoppade leveranser.");
  if (canPaySalary === true && canPayTax === true) reasons.push("Både löner och skatt kan betalas – en viktig grund att bygga vidare på.");
  if (coverage.ratio !== null) reasons.push(coverage.explanation);

  // ---- Risk flags ---------------------------------------------------------
  const riskFlags: RiskFlag[] = [];
  const taxEvent = timeline.find((e) => e.label.startsWith("Skatt"));

  if (canPayTax === false) {
    riskFlags.push({
      id: "foretradaransvar",
      severity: "critical",
      title: taxEvent
        ? `Personligt betalningsansvar för skatten – frist ${formatSwedishDate(taxEvent.iso)}`
        : "Personligt betalningsansvar för skatten",
      body:
        "Om bolaget inte betalar skatt eller moms på förfallodagen kan du som företrädare bli personligen betalningsskyldig för beloppet. Ansvaret kan undvikas om du senast på förfallodagen har vidtagit en verksam åtgärd – i praktiken ansökt om konkurs eller företagsrekonstruktion, eller träffat en uppgörelse med Skatteverket. Att vänta och hoppas är den kostsamma vägen här.",
      legalRef: LEGAL_REFS.representativeLiability,
    });
  }

  if (canPaySalary === false && hasEmployees) {
    riskFlags.push({
      id: "lonegaranti",
      severity: "warning",
      title: "Anställdas löner och lönegarantin",
      body:
        `Den statliga lönegarantin täcker anställdas löner upp till ${formatSek(WAGE_GUARANTEE_CEILING)} per anställd (fyra prisbasbelopp, ${FIGURES_YEAR}) och i högst ${WAGE_GUARANTEE_MAX_MONTHS} månader. Den träder in först vid konkurs eller företagsrekonstruktion – inte bara för att bolaget saknar pengar. Dröjer du med beslutet kan personalen bli stående utan både lön och garanti. Det belopp som gäller är det som är fastställt när beslutet fattas.`,
      legalRef: LEGAL_REFS.wageGuarantee,
    });
  }

  /**
   * KAPITALBRIST UTAN BETALNINGSPROBLEM.
   *
   * Skyldigheten att upprätta kontrollbalansräkning hänger på det egna
   * kapitalet, inte på likviditeten. Ett bolag som betalar allt i tid men
   * vars tillgångar täcker en bråkdel av skulderna är precis det fall där
   * styrelsens personliga ansvar löper tyst - och tidigare sa systemet
   * ingenting alls om det, eftersom flaggan nedan krävde att någon
   * betalning FALLERAT.
   *
   * Täckningsgraden är en INDIKATION, inte en beräkning av eget kapital:
   * den jämför snabbavyttringsvärde med total skuld. Flaggan säger därför
   * "kan behöva prövas" och pekar på modulen som gör den riktiga
   * bedömningen - den påstår inte att kapitalbrist föreligger.
   *
   * Tröskeln står i KBR_COVERAGE_THRESHOLD, på ett ställe och namngiven,
   * eftersom nivån är ett produktbeslut och inte en rättsregel. Texten
   * nedan skriver ut både den uppmätta procenten och gränsen, så att den
   * som läser flaggan ser vad den faktiskt bygger på och kan bedöma om
   * nivån är rimlig för sitt bolag.
   */
  const thinCoverage = ratio !== null && ratio < KBR_COVERAGE_THRESHOLD;
  if (thinCoverage && type !== "bankruptcy" && solvency.indication !== "likely_insolvent") {
    riskFlags.push({
      id: "kbr-tackning",
      severity: "warning",
      title: "Kontrollbalansräkningen kan behöva prövas",
      body:
        `Det du snabbt kan sälja täcker omkring ${Math.round((ratio ?? 0) * 100)} % av skulderna. Flaggan tänds under ${Math.round(KBR_COVERAGE_THRESHOLD * 100)} %, och den jämförelsen mäter tillgångar mot skulder - inte eget kapital mot aktiekapital, som är det lagen faktiskt frågar efter. Den säger alltså inget säkert om ditt egna kapital. Men skyldigheten att upprätta kontrollbalansräkning inträder redan vid skäl att ANTA att kapitalet understiger halva aktiekapitalet - alltså innan det syns i betalningarna. Gör bedömningen och datera den; ett daterat beslut är det som skyddar styrelsen.`,
      legalRef: LEGAL_REFS.controlBalanceSheet,
    });
  }

  if (type === "bankruptcy" || solvency.indication === "likely_insolvent") {
    riskFlags.push({
      id: "atervinning",
      severity: "warning",
      title: "Var försiktig med vem du betalar nu",
      body:
        "Betalningar som gynnar en enskild borgenär framför andra kan återvinnas till konkursboet i efterhand, och att prioritera fel kan öka ditt eget ansvar. Gör inga större eller ovanliga betalningar utan att först stämma av med en förvaltare eller jurist.",
      legalRef: LEGAL_REFS.clawback,
    });
    riskFlags.push({
      id: "kbr",
      severity: "warning",
      title: "Kontrollbalansräkning kan redan krävas",
      body:
        "Finns skäl att anta att det egna kapitalet understiger halva det registrerade aktiekapitalet ska styrelsen genast upprätta en kontrollbalansräkning. Görs inte det kan styrelseledamöterna bli personligt ansvariga för skulder som uppkommer därefter.",
      legalRef: LEGAL_REFS.controlBalanceSheet,
    });
  }

  // ---- Next steps ---------------------------------------------------------
  const nextSteps: NextStep[] = [];
  const taxDeadline = taxEvent ? `Före ${formatSwedishDate(taxEvent.iso)}` : undefined;

  if (type === "bankruptcy") {
    nextSteps.push({
      text: "Kontakta en insolvensjurist eller advokat med konkursvana för en inledande genomgång. Konkursförvaltaren utses av tingsrätten först när konkursen är beslutad – den du talar med nu är alltså ett ombud, inte den som kommer att förvalta boet.",
      deadline: taxDeadline,
      urgent: true,
    });
    if (canPayTax === false) {
      nextSteps.push({
        text: "Vidta en verksam åtgärd före skattens förfallodag för att begränsa ditt personliga ansvar.",
        deadline: taxDeadline,
        urgent: true,
      });
    }
    nextSteps.push({ text: "Sammanställ underlag: skuldlista, tillgångsförteckning, senaste bokslut och aktuella kontoutdrag." });
    if (hasEmployees) nextSteps.push({ text: "Informera personalen. De omfattas av lönegarantin när konkursen är beslutad." });
    nextSteps.push({ text: "Gör inga selektiva betalningar till enskilda borgenärer innan du stämt av med en jurist." });
  } else if (type === "reconstruction") {
    nextSteps.push({
      text: `Kontakta en rekonstruktör för att bedöma om verksamheten anses livskraftig – det är kravet för att en ansökan ska gå igenom (${LEGAL_REFS.reconstruction}).`,
      deadline: taxDeadline,
      urgent: urgency === "immediate",
    });
    if (canPayTax === false) {
      nextSteps.push({
        text: "En rekonstruktionsansökan före skattens förfallodag räknas som verksam åtgärd och begränsar ditt personliga ansvar.",
        deadline: taxDeadline,
        urgent: true,
      });
    }
    nextSteps.push({ text: "Ta fram en likviditetsbudget för minst 90 dagar – den behövs både för din egen bedömning och för ansökan." });
    nextSteps.push({ text: "Kontakta nyckelleverantörer innan de hör det från någon annan. Öppenhet ger oftast bättre villkor." });
  } else {
    nextSteps.push({ text: "Gör en likviditetsprognos för de kommande 90 dagarna så du ser exakt när det blir tight." });
    nextSteps.push({ text: "Förhandla betalningsplaner med leverantörer medan du fortfarande betalar i tid – förhandlingsläget är bäst nu." });
    if (canPayTax === false) {
      nextSteps.push({
        text: "Ansök om anstånd hos Skatteverket innan förfallodagen om skatten inte kan betalas.",
        deadline: taxDeadline,
        urgent: true,
      });
    }
    nextSteps.push({ text: "Se över fakturabelåning eller checkkredit för att jämna ut kassaflödet." });
    if (thinCoverage) {
      nextSteps.push({
        text: "Gör kontrollbalansbedömningen - skyldigheten hänger på kapitalet, inte på likviditeten.",
        urgent: true,
      });
    }
    nextSteps.push({ text: "Överväg att avyttra tillgångar som inte är kritiska för driften." });
  }

  /**
   * UTAN SVAR FINNS INGEN BEDÖMNING.
   *
   * Allt ovanför räknar på null som om det vore "ja" - och landar därför
   * i "stabilisering" med orden "din situation är pressad men inte akut".
   * Det är produktens grundregel bruten: ett beslutsunderlag som hittar
   * på är sämre än inget. Här skrivs den slutsatsen över med sanningen.
   *
   * Fristerna och datumen behålls: de kommer ur betalningsdagarna och är
   * sanna oavsett om frågorna besvarats. Det är BEDÖMNINGEN som saknar
   * grund, inte kalendern.
   */
  if (basis === "none") {
    return {
      basis,
      type,
      title: "Underlaget räcker inte för en bedömning",
      description:
        "Ingen av frågorna om betalningsförmågan är besvarad, och utan dem går det inte att säga något om läget. Fyll i utvärderingen så räknas bedömningen fram ur dina svar - och går att följa steg för steg.",
      urgency: "months",
      solvency: {
        indication: "no_indication",
        explanation:
          "Ingen bedömning av betalningsförmågan är gjord. Det betyder inte att läget är gott - det betyder att systemet inte vet.",
      },
      coverage,
      reasons: [
        "Frågorna om löner, skatt, hyra och leverantörer är obesvarade.",
        "Utan dem saknas grunden både för obeståndsindikationen och för valet av väg.",
      ],
      riskFlags,
      timeline,
      nextSteps: [
        { text: "Gör utvärderingen så att bedömningen vilar på dina siffror.", urgent: true },
      ],
    };
  }

  return {
    basis,
    type, title, description, urgency,
    solvency, coverage, reasons, riskFlags, timeline, nextSteps,
  };
};

/* ==========================================================================
   src/lib/caseAnalysis.ts
   ========================================================================== */

/**
 * Bron mellan ett sparat ärende och krisanalysen.
 *
 * Fanns tidigare som lokala hjälpare i Dashboard - men praktikervyn räknar
 * på många ärenden samtidigt, och två ställen som tolkar samma ärende var
 * för sig är två ställen som kan säga olika saker om samma bolag. En
 * tolkning, delad.
 */

/** "1 200 000", "1,2 mkr"-fritt: siffrorna ur ett beloppsfält, annars 0. */
export const parseAmount = (value: string | null): number => {
  if (!value) return 0;
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
};

export const analysisInputFromCase = (record: CaseRecord): AnalysisInput => ({
  canPaySalary: record.canPaySalary,
  canPayTax: record.canPayTax,
  canPayRent: record.canPayRent,
  canPaySuppliers: record.canPaySuppliers,
  salaryAmount: parseAmount(record.salaryAmount),
  salaryDay: record.salaryDay ?? 25,
  taxAmount: parseAmount(record.taxAmount),
  taxDay: record.taxDay ?? 12,
  rentAmount: parseAmount(record.rentAmount),
  rentDay: record.rentDay ?? 1,
  totalDebt: parseAmount(record.totalDebt),
  quickLiquidationValue: parseAmount(record.quickLiquidationValue),
  employees: record.employees ?? "",
});

export const timelineForCase = (record: CaseRecord): TimelineEvent[] =>
  analyseCrisis(analysisInputFromCase(record)).timeline;

export const slugName = (record: CaseRecord): string =>
  (record.companyName ?? record.orgNumber).toLowerCase().replace(/[^a-z0-9åäö]+/gi, "-");

/* ==========================================================================
   src/lib/advisor/dialog.ts
   ========================================================================== */

/**
 * Krisrådgivarens dialogmotor.
 *
 * Samtalet är gränssnittet - men sanningen är deterministisk. Varje
 * krissituation är ett definierat flöde: rådgivaren ställer sina frågor,
 * svaren bedöms med samma regelverk som resten av produkten, och svaret
 * blir en bedömning med konkreta handlingar. Ingen språkmodell är
 * inblandad: samma svar på samma frågor ger alltid samma bedömning, och
 * analysövervakningen kan bevisa det.
 *
 * Rådgivningsgränsen gäller i varje mening: motorn säger "talar för",
 * "kan" och "ofta avgörande" - aldrig "du ska". Bedömningen är underlag
 * för beslut som stäms av med revisor eller juridisk rådgivare.
 *
 * Flödena täcker de vanligaste akuta situationerna. Fritext som inte
 * matchar något flöde får ett ärligt svar med vägen till den breda
 * nulägesanalysen - hellre "det där behöver utredas ordentligt" än en
 * gissning.
 */

export type DialogStepKind = "amount" | "yesno" | "text" | "choice";

export interface DialogStep {
  id: string;
  /** Frågan som rådgivaren ställer, i du-form. */
  prompt: string;
  kind: DialogStepKind;
  /** Placeholder/exempel i inmatningsfältet. */
  hint?: string;
  /** Svarskortets alternativ - kind "choice" väljer, skriver inte. */
  options?: string[];
}

export interface DialogAction {
  label: string;
  href: string;
  why: string;
}

/** En rad i lägesbilden: område, allvarston och en kort not. */
export interface SnapshotRow {
  tone: "critical" | "warning" | "success";
  label: string;
  note: string;
}

/** Mätaren: ett tal som blir begripligare som stapel än som mening. */
export interface DialogMeter {
  label: string;
  /** 0-100, redan avrundad. */
  percent: number;
  note: string;
}

/** Processtidslinjen: i vilken ordning det händer. */
export interface PlanRow {
  when: string;
  label: string;
}

export interface DialogAssessment {
  severity: "critical" | "serious" | "elevated";
  severityLabel: string;
  paragraphs: string[];
  actions: DialogAction[];
  /**
   * Conversation UI, inte chat UI: rådgivaren väljer det medium som bär
   * budskapet bäst. Text när något förklaras, lägesbild när områden
   * prioriteras, mätare när något mäts, tidslinje när det är en process.
   * Blocken är deterministiska delar av bedömningen - inga påhittade
   * siffror, bara användarens egna i annan form.
   */
  snapshot?: SnapshotRow[];
  meter?: DialogMeter;
  plan?: PlanRow[];
  /**
   * Källmärkningen: varje bedömning bär sin källa, synligt. Dialogens
   * svar är användarens egna uppgifter - alltså en tolkning (medel),
   * tills de stäms mot verifierade data (hög). Saknas underlag säger
   * fallbacken det i stället för att gissa (låg).
   */
  confidence: { level: "high" | "medium" | "low"; note: string };
  /**
   * Förslag till protokollförbart beslut, med premissen utskriven.
   * Premissen är omprövningsvillkoret: när verkligheten motsäger den
   * ska beslutet upp igen - det är beslutsminnets hela poäng.
   */
  decisionSuggestion: { title: string; premise: string } | null;
}

export interface DialogFlow {
  id: string;
  title: string;
  /** Kort etikett för snabbvalsknappen. */
  chip: string;
  /**
   * Bekräftelsen (konstitutionens steg 1-2): först förståelse, sedan
   * riktning. ALDRIG juridik, aldrig "fel". 1-3 meningar - sedan kommer
   * första frågan, en i taget.
   */
  ack: string;
  /** Fritextmönster som väljer flödet. */
  triggers: RegExp[];
  steps: DialogStep[];
  assess(answers: Record<string, string>): DialogAssessment;
}

const SEVERITY_LABELS: Record<DialogAssessment["severity"], string> = {
  critical: "Kritiskt läge",
  serious: "Allvarligt läge",
  elevated: "Förhöjd risk",
};

/** Samma sifferformat som rapportmotorn: vanligt mellanslag, inte NBSP. */
const kr = (n: number): string =>
  `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`;

const yes = (answer: string | undefined): boolean =>
  (answer ?? "").trim().toLowerCase().startsWith("ja");

const amountOf = (answer: string | undefined): number => parseAmount(answer ?? "");

/**
 * Konstitutionens tak: aldrig fler än tre rekommenderade nästa steg.
 * Flödena listar sina handlingar i prioritetsordning - de tre första är
 * de tre viktigaste, resten stryks här och ingen annanstans.
 */
const withLabel = (
  a: Omit<DialogAssessment, "severityLabel" | "confidence"> & Partial<Pick<DialogAssessment, "confidence">>,
): DialogAssessment => ({
  ...a,
  actions: a.actions.slice(0, 3),
  severityLabel: SEVERITY_LABELS[a.severity],
  confidence:
    a.confidence ?? {
      level: "medium",
      note: "Tolkning utifrån uppgifterna du lämnat i samtalet – kompletteras de ändras bilden.",
    },
});

/* --- flödena --------------------------------------------------------------- */

const taxFlow: DialogFlow = {
  id: "skatt",
  title: "Skatten kan inte betalas",
  chip: "Kan inte betala skatten",
  ack: "Jag förstår – skatten kan inte betalas. Det är en pressande situation, och den går att hantera. Vi tar det steg för steg, så att rätt saker blir gjorda i rätt ordning.",
  triggers: [/moms/i, /skatt/i, /arbetsgivaravgift/i, /skattekonto/i],
  steps: [
    { id: "saknas", prompt: "Hur mycket saknas för att kunna betala hela skatten på förfallodagen?", kind: "amount", hint: "t.ex. 150 000 kr" },
    { id: "loner", prompt: "Har ni löner som ska betalas ut inom 30 dagar?", kind: "yesno" },
    { id: "fordringar", prompt: "Hur mycket väntas komma in från kundfakturor före skattens förfallodag? Skriv 0 om inget.", kind: "amount", hint: "t.ex. 80 000 kr" },
    { id: "kbr", prompt: "Är en kontrollbalansräkning upprättad eller påbörjad?", kind: "yesno" },
  ],
  assess(answers) {
    const gap = amountOf(answers.saknas);
    const incoming = amountOf(answers.fordringar);
    const covered = gap > 0 && incoming >= gap;

    const paragraphs: string[] = [];
    paragraphs.push(
      gap > 0
        ? `Det saknas ${kr(gap)} till skatten. En skatteskuld som förfaller obetald är den allvarligaste fristen i svensk kris­juridik: från förfallodagen kan styrelse och företrädare bli personligt betalningsansvariga för skatteskulden (59 kap. skatteförfarandelagen), om inte aktiva åtgärder – anstånd, ansökan om rekonstruktion eller konkurs – vidtagits senast den dagen.`
        : `Du har inte angett något belopp, men redan risken att inte kunna betala skatten i tid är skäl att agera: företrädaransvaret (59 kap. skatteförfarandelagen) prövas mot vad som gjorts senast på förfallodagen.`,
    );
    if (covered) {
      paragraphs.push(
        `De väntade kundinbetalningarna (${kr(incoming)}) kan täcka bristen – men en väntad betalning är inte en gjord betalning. Räkna bara med det som hinner landa före förfallodagen, och sök anstånd för resten.`,
      );
    } else if (incoming > 0) {
      paragraphs.push(
        `Väntade kundinbetalningar på ${kr(incoming)} täcker inte hela bristen. Skillnaden behöver hanteras med anstånd eller finansiering – inte med hopp.`,
      );
    }
    if (yes(answers.loner)) {
      paragraphs.push(
        `Att löner förfaller samtidigt skärper läget: att betala vissa skulder men inte andra i ett obeståndsläge kan angripas i efterhand. Om pengarna inte räcker till både skatt och löner talar det för att rekonstruktion eller konkurs behöver prövas nu – vid en sådan kan den statliga lönegarantin träda in för de anställda.`,
      );
    }
    if (!yes(answers.kbr)) {
      paragraphs.push(
        `Ingen kontrollbalansräkning är påbörjad. Vid skäl att anta att halva aktiekapitalet är förbrukat är styrelsen skyldig att genast upprätta en (25 kap. 13 § aktiebolagslagen) – en obetalbar skatteskuld är ofta ett sådant skäl.`,
      );
    }
    paragraphs.push(
      `Det här är underlag för beslut – stäm av med revisor eller juridisk rådgivare innan ni väljer väg.`,
    );

    const actions: DialogAction[] = [
      {
        label: "Ansök om anstånd hos Skatteverket",
        href: "/kunskap",
        why: "Ett beviljat anstånd flyttar förfallodagen – och därmed företrädaransvarets prövningspunkt.",
      },
      { label: "Se hur länge pengarna räcker", href: "/dashboard/liquidity", why: "Likviditetsplanen visar om bristen är tillfällig eller strukturell." },
    ];
    if (!yes(answers.kbr)) {
      actions.push({ label: "Gör kontrollbalansbedömningen", href: "/kbr", why: "Skyldigheten inträder vid skäl att anta kapitalbrist – dokumentera att ni prövat frågan." });
    }
    if (yes(answers.loner)) {
      actions.push({ label: "Hitta rekonstruktör eller jurist", href: "/marketplace", why: "Räcker pengarna inte till både skatt och löner behöver insolvensalternativen prövas med rätt kompetens." });
    }

    return withLabel({
      severity: "critical",
      paragraphs,
      actions,
      snapshot: [
        { tone: "critical", label: "Skattefristen", note: "Företrädaransvaret prövas mot förfallodagen" },
        {
          tone: gap > 0 && covered ? "success" : "warning",
          label: "Likviditet",
          note:
            gap > 0
              ? covered
                ? "Väntade inbetalningar kan täcka bristen - om de hinner fram"
                : `${kr(Math.max(gap - incoming, 0))} saknas även efter väntade inbetalningar`
              : "Beloppet är inte fastställt",
        },
        yes(answers.loner)
          ? { tone: "warning", label: "Löner", note: "Förfaller inom 30 dagar - prioriteringen är juridiskt känslig" }
          : { tone: "success", label: "Löner", note: "Inga löner under press den närmaste månaden" },
      ],
      meter:
        gap > 0
          ? {
              label: "Väntade kundinbetalningar mot bristen",
              percent: Math.min(100, Math.round((incoming / gap) * 100)),
              note: `${kr(incoming)} väntas av ${kr(gap)} som saknas`,
            }
          : undefined,
      plan: [
        { when: "Idag", label: "Förbered anståndsansökan till Skatteverket" },
        { when: "Före förfallodagen", label: "Beslut om väg - anstånd, uppgörelse eller insolvensprövning" },
        { when: "Om 7 dagar", label: "Uppföljning mot likviditetsplanen" },
      ],
      decisionSuggestion: {
        title: "Hantera skattebristen före förfallodagen",
        premise: `Beslutet vilar på uppgifterna i samtalet: ${gap > 0 ? `${kr(gap)} saknas` : "beloppet är inte fastställt"}, ${incoming > 0 ? `${kr(incoming)} väntas från kunder` : "inga kundinbetalningar väntas"}${yes(answers.loner) ? ", löner förfaller inom 30 dagar" : ""}. Ändras någon av uppgifterna bör beslutet omprövas.`,
      },
    });
  },
};

const wagesFlow: DialogFlow = {
  id: "loner",
  title: "Lönerna kan inte betalas",
  chip: "Kan inte betala lönerna",
  ack: "Jag förstår – lönerna kan inte betalas. Det är en av de situationer företagare upplever som mest stressande, och det finns ordnade vägar igenom den. Mitt mål är att du får kontroll över läget och rätt beslut dokumenterade.",
  // \b framför ordet räcker: "lön" i "affärsplan" finns inte, och svenska
  // böjningar (lönerna, lönen) fångas utan slut-gräns. Observera att \b
  // inte fungerar EFTER å/ä/ö i JavaScript - därför bara ledande gräns.
  triggers: [/\bl[öo]n/i, /anställd/i, /personal/i],
  steps: [
    { id: "saknas", prompt: "Hur mycket saknas för nästa löneutbetalning?", kind: "amount", hint: "t.ex. 200 000 kr" },
    { id: "antal", prompt: "Hur många anställda berörs?", kind: "choice", options: ["1–5", "6–20", "21–50", "Fler än 50"] },
    { id: "skatt", prompt: "Finns det samtidigt skatter eller avgifter som förfaller den närmaste månaden?", kind: "yesno" },
  ],
  assess(answers) {
    const gap = amountOf(answers.saknas);
    const staff = (answers.antal ?? "").trim();
    const paragraphs: string[] = [
      `${gap > 0 ? `Det saknas ${kr(gap)} till nästa löneutbetalning${staff ? ` för ${staff} anställda` : ""}.` : "Lönerna riskerar att inte kunna betalas."} Uteblivna löner är i praktiken en obeståndssignal: de anställda kan begära bolaget i konkurs, och förtroendet är svårt att reparera.`,
      `Vid företagsrekonstruktion eller konkurs träder den statliga lönegarantin in och betalar de anställdas löner upp till taket – de anställda är alltså mindre utsatta i ett ordnat förfarande än i ett utdraget informellt betalningsdröjsmål.`,
    ];
    if (yes(answers.skatt)) {
      paragraphs.push(
        `Att skatter förfaller samtidigt gör prioriteringen juridiskt känslig: betalningar som gynnar vissa borgenärer i ett obeståndsläge kan återvinnas, och obetald skatt aktiverar företrädaransvaret. Det talar för att pröva rekonstruktionsfrågan nu i stället för att välja vilka räkningar som betalas.`,
      );
    }
    paragraphs.push(`Det här är underlag för beslut – stäm av med revisor eller juridisk rådgivare innan ni väljer väg.`);
    return withLabel({
      severity: "critical",
      paragraphs,
      snapshot: [
        { tone: "critical", label: "Löner", note: staff ? `${staff} anställda berörs av nästa utbetalning` : "Nästa utbetalning är under press" },
        yes(answers.skatt)
          ? { tone: "warning", label: "Skatter", note: "Förfaller samtidigt - prioriteringen kan angripas i efterhand" }
          : { tone: "success", label: "Skatter", note: "Ingen samtidig skattepress registrerad" },
        { tone: "success", label: "Lönegarantin", note: "Skyddar de anställda vid rekonstruktion eller konkurs" },
      ],
      plan: [
        { when: "Idag", label: "Likviditetsbilden: exakt vad som finns och vad som förfaller" },
        { when: "Före lönekörningen", label: "Beslut om väg - egen finansiering eller rekonstruktionsprövning" },
        { when: "Om 7 dagar", label: "Uppföljning mot planen" },
      ],
      actions: [
        { label: "Se hur länge pengarna räcker", href: "/dashboard/liquidity", why: "Likviditetsplanen visar om lönebristen är en engångshändelse eller ett mönster." },
        { label: "Hitta rekonstruktör", href: "/marketplace", why: "Rekonstruktion med lönegaranti kan vara de anställdas bästa skydd." },
        { label: "Läs om lönegarantin", href: "/kunskap", why: "Vad garantin täcker, och vad som krävs för att den ska gälla." },
      ],
      decisionSuggestion: {
        title: "Pröva rekonstruktionsfrågan före nästa löneutbetalning",
        premise: `Beslutet vilar på att ${gap > 0 ? kr(gap) : "ett belopp"} saknas till lönerna${yes(answers.skatt) ? " och att skatter förfaller samtidigt" : ""}. Kommer pengar in som täcker lönerna bör beslutet omprövas.`,
      },
    });
  },
};

const receivableFlow: DialogFlow = {
  id: "kundforlust",
  title: "En stor kundfordran betalas inte",
  chip: "Kund betalar inte",
  ack: "Jag förstår – en kund betalar inte. Det är ett vanligt och hanterbart problem, men det ska tas på allvar innan det blir ett större. Vi går igenom det steg för steg.",
  triggers: [/\bkund/i, /fordran/i, /faktur/i, /betalar inte/i],
  steps: [
    { id: "belopp", prompt: "Hur stor är den obetalda fordran?", kind: "amount", hint: "t.ex. 100 000 kr" },
    { id: "forsenad", prompt: "Hur många dagar försenad är betalningen?", kind: "amount", hint: "t.ex. 45" },
    { id: "paminnelse", prompt: "Har ni skickat skriftlig påminnelse eller inkassokrav?", kind: "yesno" },
  ],
  assess(answers) {
    const amount = amountOf(answers.belopp);
    const days = amountOf(answers.forsenad);
    const paragraphs: string[] = [
      `${amount > 0 ? `En fordran på ${kr(amount)}` : "En större fordran"}${days > 0 ? ` som är ${days} dagar försenad` : ""} är inte bara ett kassaflödesproblem – den kan också vara en kundförlust under uppsegling. Ju äldre fordran, desto lägre är sannolikheten att den betalas fullt ut.`,
      yes(answers.paminnelse)
        ? `Påminnelse är skickad. Nästa steg i trappan är ansökan om betalningsföreläggande hos Kronofogden – en billig och snabb väg till en exekutionstitel om kunden inte bestrider.`
        : `Ingen skriftlig påminnelse är skickad än. Börja där: dokumenterade krav är förutsättningen för både inkasso och betalningsföreläggande, och de avbryter preskription.`,
      `Räkna samtidigt inte med pengarna i likviditetsplanen förrän de är på kontot – en plan som vilar på en osäker fordran är ingen plan.`,
    ];
    return withLabel({
      severity: days > 60 || amount > 100000 ? "serious" : "elevated",
      paragraphs,
      actions: [
        { label: "Uppdatera likviditetsplanen", href: "/dashboard/liquidity", why: "Flytta eller osäkra fordran så planen visar verkligheten." },
        { label: "Läs om betalningsföreläggande", href: "/kunskap", why: "Vägen från obetald faktura till exekutionstitel, steg för steg." },
        { label: "Se vad siffrorna säger", href: "/dashboard", why: "Insikterna visar om fler fordringar är på väg åt samma håll." },
      ],
      decisionSuggestion: null,
    });
  },
};

const enforcementFlow: DialogFlow = {
  id: "kronofogden",
  title: "Brev från Kronofogden",
  chip: "Brev från Kronofogden",
  ack: "Jag förstår – ett brev från Kronofogden. Det känns allvarligt, och det finns en tydlig ordning för hur det hanteras. Vi tar det lugnt och metodiskt, en fråga i taget.",
  triggers: [/kronofogd/i, /betalningsföreläggande/i, /utmätning/i, /delgiv/i],
  steps: [
    { id: "belopp", prompt: "Vilket belopp kräver motparten?", kind: "amount", hint: "t.ex. 75 000 kr" },
    { id: "bestrider", prompt: "Anser ni att kravet är felaktigt, helt eller delvis?", kind: "yesno" },
    { id: "fler", prompt: "Har fler krav eller förelägganden kommit de senaste tre månaderna?", kind: "yesno" },
  ],
  assess(answers) {
    const amount = amountOf(answers.belopp);
    const paragraphs: string[] = [
      `Ett betalningsföreläggande${amount > 0 ? ` på ${kr(amount)}` : ""} har en förklaringsfrist – svara inom den tid som står i brevet. Ett föreläggande som inte bestrids i tid blir ett utslag: en exekutionstitel som kan gå direkt till utmätning, och en betalningsanmärkning som skadar bolagets kreditvärdighet i åratal.`,
      yes(answers.bestrider)
        ? `Anser ni att kravet är felaktigt ska det bestridas skriftligen inom fristen – då kan målet i stället prövas av domstol, och inget utslag meddelas. Bestrid bara det som faktiskt är fel; ett ogrundat bestridande skjuter bara upp kostnaden.`
        : `Är kravet riktigt men pengarna saknas: kontakta sökanden om en avbetalningsplan före utslaget, och räkna in kravet i likviditetsplanen. Ett utslag är en offentlig obeståndssignal som banker och leverantörer ser.`,
    ];
    if (yes(answers.fler)) {
      paragraphs.push(
        `Att flera krav kommer samtidigt är ett mönster, inte en otur. Då är frågan inte längre "hur hanterar vi det här brevet" utan "är bolaget på obestånd" – och den frågan ska prövas ordentligt, med kontrollbalansbedömningen som start.`,
      );
    }
    paragraphs.push(`Det här är underlag för beslut – stäm av med juridisk rådgivare, särskilt före ett bestridande.`);
    return withLabel({
      severity: yes(answers.fler) ? "critical" : "serious",
      paragraphs,
      plan: [
        { when: "Idag", label: "Läs förklaringsfristen i brevet - den styr allt" },
        {
          when: "Inom fristen",
          label: yes(answers.bestrider)
            ? "Bestrid skriftligen - då prövas målet i domstol i stället"
            : "Kontakta sökanden om avbetalningsplan före utslaget",
        },
        { when: "Om 7 dagar", label: "Uppföljning - och kontroll att inget nytt föreläggande kommit" },
      ],
      actions: [
        { label: "Läs om betalningsföreläggande", href: "/kunskap", why: "Fristerna, bestridandet och vad ett utslag innebär." },
        ...(yes(answers.fler)
          ? [{ label: "Gör kontrollbalansbedömningen", href: "/kbr", why: "Flera samtidiga krav är ofta skäl att anta kapitalbrist." }]
          : []),
        { label: "Hitta jurist", href: "/marketplace", why: "Ett bestridande och dess följder bör utformas med juridiskt stöd." },
      ],
      decisionSuggestion: yes(answers.bestrider)
        ? {
            title: "Bestrid kravet inom förklaringsfristen",
            premise: `Beslutet vilar på bedömningen att kravet${amount > 0 ? ` på ${kr(amount)}` : ""} är felaktigt helt eller delvis. Visar underlaget senare att kravet är riktigt bör beslutet omprövas och en betalningslösning sökas.`,
          }
        : null,
    });
  },
};

const bankFlow: DialogFlow = {
  id: "banken",
  title: "Banken säger nej",
  chip: "Banken säger nej",
  ack: "Jag förstår – banken säger nej. Det är ett bakslag, men sällan slutet: det finns fler vägar till finansiering än bankens. Vi börjar med att förstå läget.",
  // Ledande ordgräns så "affärsplan" inte läses som "lån".
  triggers: [/\bbank/i, /kredit/i, /\bl[åa]n/i, /finansier/i],
  steps: [
    { id: "vad", prompt: "Vad har hänt – har banken sagt nej till ny finansiering, eller sagt upp en befintlig kredit?", kind: "text", hint: "Beskriv kort" },
    { id: "belopp", prompt: "Hur mycket finansiering behöver bolaget den närmaste tiden?", kind: "amount", hint: "t.ex. 500 000 kr" },
    { id: "sakerheter", prompt: "Finns det säkerheter som inte redan är pantsatta – fastighet, fordringar, varulager?", kind: "yesno" },
  ],
  assess(answers) {
    const amount = amountOf(answers.belopp);
    const paragraphs: string[] = [
      `Ett nej från banken är sällan slutet – men det är ett skäl att byta metod. Bankens beslut bygger på det underlag den ser: ett strukturerat kreditunderlag med siffror, säkerheter och en trovärdig plan prövas på andra villkor än en muntlig förfrågan.`,
      yes(answers.sakerheter)
        ? `Att det finns opantsatta säkerheter är ett verkligt förhandlingskort – mot banken, men också mot andra finansiärer: factoring på kundfordringar och lager- eller fastighetsbelåning prissätts på säkerheten, inte bara på bolagets historik.`
        : `Utan fria säkerheter smalnar vägarna: då väger kassaflödesprognosen och ägarnas eget åtagande tyngre, och alternativ som förskott från kunder eller ägartillskott bör upp på bordet.`,
      `${amount > 0 ? `Behovet på ${kr(amount)} ska` : "Behovet ska"} också prövas mot likviditetsplanen: finansiering som täpper ett strukturellt underskott köper tid men löser inget – då är rekonstruktion med skulduppgörelse ibland det ärligare alternativet.`,
      `Det här är underlag för beslut – stäm av med revisor eller rådgivare innan nya åtaganden görs.`,
    ];
    return withLabel({
      severity: "serious",
      paragraphs,
      actions: [
        { label: "Sammanställ kreditunderlaget", href: "/dashboard/kreditunderlag", why: "Siffror, säkerheter och plan i ett dokument – underlaget banken eller finansiären faktiskt prövar." },
        { label: "Se hur länge pengarna räcker", href: "/dashboard/liquidity", why: "Skiljer tillfälligt glapp från strukturellt underskott – de kräver olika lösningar." },
        { label: "Hitta finansiär eller rådgivare", href: "/marketplace", why: "Fler vägar än banken: factoring, säkerhetsbelåning, rekonstruktionsfinansiering." },
      ],
      decisionSuggestion: null,
    });
  },
};

const liquidityFlow: DialogFlow = {
  id: "likviditet",
  title: "Pengarna räcker inte",
  chip: "Pengarna räcker inte",
  ack: "Jag förstår – pengarna räcker inte. Det är ett läge som går att strukturera, och det är precis det vi gör nu. Jag ställer frågorna, en i taget.",
  triggers: [
    /slut på peng/i,
    /pengarna räcker inte/i,
    /räcker inte pengarna/i,
    /inga pengar/i,
    /tomt på kontot/i,
    /likviditet/i,
    /kassan/i,
  ],
  steps: [
    { id: "konto", prompt: "Hur mycket finns tillgängligt på kontot idag?", kind: "amount", hint: "t.ex. 100 000 kr" },
    { id: "behov", prompt: "Ungefär hur mycket förfaller till betalning de närmaste 30 dagarna – löner, skatt, hyra och leverantörer tillsammans?", kind: "amount", hint: "t.ex. 300 000 kr" },
    { id: "storst", prompt: "Vilken post är störst?", kind: "choice", options: ["Skatt", "Löner", "Leverantörer", "Hyra/övrigt"] },
    { id: "inbet", prompt: "Hur mycket väntas komma in från kunder under samma period? Skriv 0 om inget.", kind: "amount", hint: "t.ex. 50 000 kr" },
  ],
  assess(answers) {
    const cash = amountOf(answers.konto);
    const need = amountOf(answers.behov);
    const incoming = amountOf(answers.inbet);
    const available = cash + incoming;
    const percent = need > 0 ? Math.min(100, Math.round((available / need) * 100)) : 100;
    const biggest = (answers.storst ?? "").trim();

    const paragraphs: string[] = [
      need > 0
        ? `Med ${kr(cash)} på kontot och ${kr(incoming)} i väntade inbetalningar täcks ${percent} % av de ${kr(need)} som förfaller den närmaste månaden. ${percent >= 100 ? "Det håller på pappret - men bara om inbetalningarna hinner fram före förfallodagarna." : `Det saknas ${kr(Math.max(need - available, 0))} - och det är en bristsiffra som går att arbeta med, inte en dom.`}`
        : "Utan ett 30-dagarsbehov att räkna mot blir bilden ofullständig - likviditetsplanen ger den.",
    ];
    if (biggest === "Skatt") {
      paragraphs.push(
        "Att skatten är största posten styr prioriteringen: en obetald skatt aktiverar företrädaransvaret vid förfallodagen (59 kap. skatteförfarandelagen), så anståndsfrågan ska upp först.",
      );
    } else if (biggest === "Löner") {
      paragraphs.push(
        "Att lönerna är största posten skärper läget: uteblivna löner är en obeståndssignal, och vid rekonstruktion eller konkurs kan den statliga lönegarantin skydda de anställda - det talar för att pröva vägvalet tidigt.",
      );
    } else if (biggest === "Leverantörer") {
      paragraphs.push(
        "Att leverantörsskulderna är störst är ofta det mest förhandlingsbara läget: betalningsplaner och omförhandlade villkor kräver bara att du agerar innan förtroendet tar slut - och att alla borgenärer behandlas lika.",
      );
    } else if (biggest) {
      paragraphs.push(
        "Hyra och övriga fasta kostnader är ofta omförhandlingsbara - särskilt när alternativet för motparten är en tom lokal eller en förlorad kund.",
      );
    }
    paragraphs.push("Det här är underlag för beslut – stäm av med revisor eller rådgivare innan ni väljer väg.");

    return withLabel({
      severity: percent < 50 ? "critical" : percent < 100 ? "serious" : "elevated",
      paragraphs,
      snapshot: [
        {
          tone: percent < 50 ? "critical" : percent < 100 ? "warning" : "success",
          label: "Kassan mot 30-dagarsbehovet",
          note: need > 0 ? `${kr(available)} tillgängligt mot ${kr(need)} som förfaller` : "Behovet är inte fastställt",
        },
        { tone: "warning", label: "Största posten", note: biggest ? `${biggest} - den styr vilken åtgärd som går först` : "Inte angiven" },
        {
          tone: incoming > 0 ? "warning" : "critical",
          label: "Inbetalningar",
          note: incoming > 0 ? `${kr(incoming)} väntas - räkna bara med det som hinner fram` : "Inga väntade inbetalningar under perioden",
        },
      ],
      meter:
        need > 0
          ? { label: "Täckning av 30-dagarsbehovet", percent, note: `${kr(available)} tillgängligt av ${kr(need)} som förfaller` }
          : undefined,
      plan: [
        { when: "Idag", label: "Lägg likviditetsplanen - dag för dag, post för post" },
        { when: "Denna vecka", label: biggest === "Skatt" ? "Förbered anståndsansökan hos Skatteverket" : biggest === "Löner" ? "Pröva vägvalet före lönekörningen" : "Kontakta de största motparterna om betalningsplan" },
        { when: "Om 7 dagar", label: "Uppföljning mot planen - avvikelser hanteras direkt" },
      ],
      actions: [
        { label: "Lägg likviditetsplanen", href: "/dashboard/liquidity", why: "Dag-för-dag-bilden som visar exakt när det brister och hur mycket." },
        { label: "Se handlingsalternativen", href: "/dashboard/alternativ", why: "Vilka vägar som står öppna i det här läget, och vad de kräver." },
        ...(biggest === "Skatt"
          ? [{ label: "Läs om anstånd hos Skatteverket", href: "/kunskap", why: "Ansökan före förfallodagen flyttar företrädaransvarets prövningspunkt." }]
          : [{ label: "Hitta rådgivare", href: "/marketplace", why: "Rätt kompetens tidigt minskar risken för dyra felsteg." }]),
      ],
      decisionSuggestion:
        percent < 100 && need > 0
          ? {
              title: "Säkra likviditeten för de närmaste 30 dagarna",
              premise: `Beslutet vilar på uppgifterna i samtalet: ${kr(cash)} i kassa, ${kr(need)} förfaller, ${kr(incoming)} väntas in${biggest ? `, största posten är ${biggest.toLowerCase()}` : ""}. Ändras någon av uppgifterna bör beslutet omprövas.`,
            }
          : null,
    });
  },
};

/* Specifika flöden före det breda: "kan inte betala momsen för att kassan
   är tom" ska börja i skatteflödet, som bär den vassaste fristen. */
export const DIALOG_FLOWS: DialogFlow[] = [taxFlow, wagesFlow, receivableFlow, enforcementFlow, bankFlow, liquidityFlow];

/* --- motorn ---------------------------------------------------------------- */

/**
 * Fritext → flöde. Första matchande flödet i definitionsordning vinner;
 * ordningen är medveten (skatt före kund: "kan inte betala moms för att
 * kunden inte betalat" ska börja i skatteflödet, som är den vassare
 * fristen). Ingen träff ger null - och då säger rådgivaren ärligt att
 * situationen behöver den breda utvärderingen i stället för en gissning.
 */
export const matchFlow = (text: string): DialogFlow | null =>
  DIALOG_FLOWS.find((flow) => flow.triggers.some((t) => t.test(text))) ?? null;

/** Svar på fritext som inte matchar något flöde. */
/**
 * Ingen återvändsgränd: när fritexten inte matchar ett flöde GUIDAR
 * rådgivaren genom nulägesanalysen - den säger det, och öppnar den
 * själv. Användaren skickas aldrig iväg med en uppmaning.
 */
export const FALLBACK_REPLY = [
  "Då tar vi det från början, tillsammans. Jag guidar dig genom nulägesanalysen – jag ställer frågorna, en i taget, och det tar 5–10 minuter.",
  "Jag öppnar nulägesanalysen nu. När den är klar fortsätter vi här, med hela bilden på plats.",
] as const;

/* --- CLEARANCE ----------------------------------------------------------------- */

/**
 * CLEARANCE:s röst regleras av Conversation Constitution
 * (docs/conversation-constitution.md): bekräfta, skapa trygghet, EN
 * fråga i taget, max tre rekommendationer, namnet sparsamt. Texterna
 * här är de enda ställen där CLEARANCE presenterar sig - en röst, en källa.
 */
export const CLARA = {
  name: "CLEARANCE",
  /** Hälsning i ett ärende som redan finns. Namnet används sparsamt. */
  greeting: (displayName: string | null): string =>
    displayName
      ? `Hej ${displayName.split(" ")[0]}. Beskriv vad som har hänt, så tar vi det därifrån – eller välj en situation nedan.`
      : "Hej. Beskriv vad som har hänt, så tar vi det därifrån – eller välj en situation nedan.",
} as const;

/**
 * Onboardingen: den första upplevelsen är ett samtal - men ett samtal
 * som BÖRJAR ARBETA, inte ett som pratar färdigt först.
 *
 * Tidigare frågade CLEARANCE en sak i taget redan här: namn, sedan
 * företag, sedan situation. Det lät omtänksamt och kändes långsamt.
 * Grunduppgifterna är tre saker en företagare kan svara på i ett svep,
 * och att stycka dem i tre turer är att lägga till friktion utan att
 * lägga till förståelse. Därför visas de SAMTIDIGT.
 *
 * En fråga i taget gäller fortfarande - från det ögonblick frågorna
 * kräver eftertanke. Skillnaden är var gränsen går: identitet är
 * ifyllning, situationen är samtal.
 */
export const ONBOARDING = {
  /**
   * VÄLKOMSTEN, före allt annat.
   *
   * Två meningar och en tidsangivelse. Den som landar här vet inte om
   * det här kostar en kvart eller en eftermiddag, och den osäkerheten är
   * i sig ett skäl att stänga fliken. "Cirka 3-5 minuter" är ett löfte -
   * och därför är introduktionen byggd så att det håller.
   */
  welcome: {
    title: "Välkommen",
    body: [
      "Välkommen! Jag hjälper dig att analysera företagets situation och identifiera åtgärder som kan förbättra resultatet.",
      "Det tar cirka 3–5 minuter att komma igång.",
    ],
    cta: "Kom igång",
  },
  intro: [
    "Hej! Jag heter CLEARANCE och guidar dig genom processen. För att komma igång behöver jag bara några grunduppgifter.",
    "Många företag hamnar någon gång i en situation där ekonomin behöver analyseras och struktureras. Min uppgift är att hjälpa dig samla rätt information, skapa en tydlig överblick och dokumentera processen på ett sätt som sparar tid och minskar risken för misstag.",
  ],
  /**
   * Fälten, som data: gränssnittet renderar dem, testet räknar dem, och
   * ingen kan lägga till ett femte utan att någon märker det.
   *
   * E-posten kom till när kontot flyttade in i samtalet. Lösenordet står
   * INTE här: det har ett eget fält med maskerade tecken och ska aldrig
   * kunna hamna i en chattbubbla som alla i rummet kan läsa.
   */
  fields: [
    { id: "name", label: "Ditt namn", placeholder: "Förnamn Efternamn", autoComplete: "name" },
    { id: "company", label: "Företagsnamn", placeholder: "Bolagets namn", autoComplete: "organization" },
    { id: "orgNumber", label: "Organisationsnummer", placeholder: "XXXXXX-XXXX", autoComplete: "off" },
    { id: "email", label: "E-postadress", placeholder: "namn@bolaget.se", autoComplete: "email" },
  ],
  /**
   * Lösenordssteget, separat från de fyra.
   *
   * Skilt av två skäl: uppgifterna ovan går att fylla i från minnet,
   * lösenordet kräver ett beslut - och det ska visas maskerat, inte
   * ekas tillbaka som ett chattmeddelande.
   */
  password: {
    lead: "Välj ett lösenord.",
    label: "Lösenord",
    placeholder: "Minst 8 tecken",
    hint: "Minst 8 tecken. Du använder det för att logga in igen.",
    submitLabel: "Skapa konto",
    created: "Konto skapat.",
  },
  /**
   * Direkt efter kontot: arbetet börjar innan användaren hunnit undra om
   * något händer. Det är skillnaden mellan att vänta och att vara igång.
   */
  afterAccount: [
    // Specifikationen inledde med ett berömmande ord. Det ströks av en
    // regel som redan fanns i produkten: tomt beröm är förbjudet i hela
    // src-trädet, och tests/tone.ts vaktar det. Ordet berömde ingenting -
    // användaren hade valt ett lösenord - och en produkt som hyllar en
    // trivialitet blir mindre trovärdig när den senare säger något som
    // faktiskt betyder något. Meningens funktion, att arbetet börjar nu,
    // är oförändrad.
    "Tack. Jag börjar nu skapa en bild av företaget.",
    "Under tiden vill jag lära känna verksamheten lite bättre.",
  ],
  submitLabel: "Fortsätt",
  /**
   * Efter Fortsätt blir samtalet personligt - och konkret. Namnet
   * används sparsamt, vid övergångar; det här är en av dem.
   */
  confirm: (name: string, company: string, orgNumber: string): string => {
    const firstName = name.trim().split(/\s+/)[0];
    const bolag = orgNumber.trim() ? `${company} (${orgNumber.trim()})` : company;
    return [
      `Tack ${firstName}. Jag ser att vi nu arbetar med ${bolag}.`,
      "Min uppgift är att hjälpa dig skapa struktur, dokumentera situationen och ta fram det underlag som behövs.",
      "Vi tar en fråga i taget och du kan när som helst pausa eller gå tillbaka.",
    ].join(" ");
  },
  /**
   * Processen i fast ordning. Att visa den är inte dekor: den som ser
   * hela vägen vet att det tar slut, och vet var hen är just nu.
   */
  steps: [
    { n: 1, label: "Konto och företagsuppgifter", purpose: "Vem du är, vilket bolag det gäller och var du loggar in" },
    { n: 2, label: "Nuläget i korthet", purpose: "Vad som gör att du är här" },
    { n: 3, label: "Om verksamheten", purpose: "Frågorna som gör analysen till din och inte en generisk" },
    { n: 4, label: "Första analysen", purpose: "Lägesbilden, byggd på det du berättat och det som gick att hämta" },
    { n: 5, label: "Tidskritiska händelser", purpose: "Frister och datum som styr handlingsutrymmet" },
    { n: 6, label: "Dokumentinsamling", purpose: "Underlaget som bedömningarna ska vila på" },
  ],
  /** Uppslaget mot registret. Sagt först när det faktiskt har hänt. */
  lookupDone:
    "Tack. Jag har identifierat företaget och fyllt i grunduppgifterna. Vi kan nu fokusera på själva situationen.",
  lookupMiss:
    "Jag hittar inte bolaget i registret just nu. Det stoppar ingenting – vi använder namnet du angav och kompletterar uppgifterna senare.",
  askSituation: "Steg 2 av 6: nuläget i korthet. Vilket beskriver läget bäst just nu?",
  situations: [
    { id: "oro", label: "Jag är orolig för ekonomin" },
    { id: "fakturor", label: "Jag kan inte betala vissa fakturor" },
    { id: "loner", label: "Jag kan inte betala löner" },
    { id: "ansvar", label: "Jag riskerar personligt betalningsansvar" },
    { id: "vet-inte", label: "Jag vet inte riktigt vad problemet är" },
  ],
  /**
   * Avslutet: en bekräftelse som är förankrad i vad användaren faktiskt
   * lämnade - inte tom beröm - och sedan vad som händer härnäst.
   * CLEARANCE öppnar nulägesanalysen, användaren letar inte.
   */
  closing: [
    "Tack. Med kontaktperson, bolag och en första lägesbeskrivning har vi ett underlag att arbeta vidare från.",
    "Jag öppnar nu nulägesanalysen, som täcker steg 5–6. Den tar 5–10 minuter och ger oss en gemensam bild av läget – siffrorna, fristerna och alternativen. Du kan när som helst pausa eller gå tillbaka.",
  ],
  /**
   * Övergången in i intervjun. Övergångsprincipen, tillämpad: vad som är
   * klart, vad som händer nu, varför vi frågar, hur lång tid det tar.
   */
  interviewLead: {
    heading: "Om verksamheten",
    body: "Nu ställer jag några frågor om vad ni gör. De tar ungefär två minuter och gör att analysen handlar om ert bolag i stället för om bolag i allmänhet. Du kan hoppa över en fråga du inte vill svara på.",
    skipLabel: "Hoppa över frågan",
  },
  /**
   * När intervjun är klar. Ingen tom beröm - en kvittering på vad som
   * faktiskt finns, och vad det räcker till.
   */
  interviewDone: (answered: number, fields: number): string =>
    `Tack. ${answered} svar om verksamheten, och ${fields} av 9 fält i företagsprofilen vilar nu på något du sagt i stället för på ett antagande.`,
  /**
   * PREMIUM SIST, inte först.
   *
   * Telefonnumret frågas medvetet inte i introduktionen. Ett nummer som
   * begärs innan tjänsten gjort något läses som insamling; samma fråga
   * efter den första analysen läses som en uppgradering. Skillnaden är
   * inte formuleringen utan ordningen - och därför vaktar testet att
   * ordet "telefon" inte förekommer före det här steget.
   */
  premium: {
    heading: "SMS-aviseringar",
    lead: "Många företag uppskattar att få viktiga händelser direkt via SMS.",
    examples: [
      "Nya risker",
      "Viktiga påminnelser",
      "Daglig VD-sammanfattning",
      "Kritiska avvikelser",
    ],
    tiers: "Det ingår i Clearance Business och Enterprise.",
    question: "Vill du aktivera SMS-aviseringar?",
    yes: "Ja, visa hur",
    no: "Inte nu",
    declined: "Ingen fara. Du hittar det under Inställningar när du vill.",
  },
} as const;

/**
 * Lägesbilden i CLEARANCE:s hälsning: tre områden med ton och not, byggda ur
 * ärendets registrerade uppgifter. "Jag har en ganska bra bild av
 * situationen" - visad, inte påstådd.
 */
export const buildCaseSnapshot = (input: {
  coverageRatio: number | null;
  passedDeadlines: number;
  daysToNextDeadline: number | null;
  kbrDone: boolean;
}): SnapshotRow[] => [
  {
    tone: input.coverageRatio !== null && input.coverageRatio < 50 ? "critical" : input.coverageRatio !== null && input.coverageRatio < 100 ? "warning" : "success",
    label: "Likviditet",
    note:
      input.coverageRatio === null
        ? "Skuldtäckningen är inte fastställd än"
        : `Snabba avyttringsvärdet täcker ${input.coverageRatio} % av skulderna`,
  },
  {
    tone: input.passedDeadlines > 0 ? "critical" : (input.daysToNextDeadline ?? 99) <= 7 ? "warning" : "success",
    label: "Frister",
    note:
      input.passedDeadlines > 0
        ? `${input.passedDeadlines} ${input.passedDeadlines === 1 ? "datum har" : "datum har"} passerat - hanteras i handlingsplanen`
        : input.daysToNextDeadline !== null
          ? `Närmaste bevakade datum om ${input.daysToNextDeadline} dagar`
          : "Inga kommande frister i underlaget",
  },
  {
    tone: input.kbrDone ? "success" : "warning",
    label: "Dokumentation",
    note: input.kbrDone
      ? "Kontrollbalansbedömningen är gjord och journalförd"
      : "Kontrollbalansbedömningen är inte gjord än",
  },
];

/**
 * "Det viktigaste nu": högst tre numrerade steg, ur ärendets läge.
 * Ordningen är allvarsordningen - passerade frister före kommande,
 * skyldigheter före analyser. Varje rad är en väg, inte ett påstående.
 */
export const buildPriorities = (input: {
  coverageRatio: number | null;
  passedDeadlines: number;
  daysToNextDeadline: number | null;
  nextDeadlineLabel: string | null;
  kbrDone: boolean;
}): { label: string; href: string }[] => {
  const items: { label: string; href: string }[] = [];
  if (input.passedDeadlines > 0) {
    items.push({
      label: `Hantera ${input.passedDeadlines === 1 ? "den passerade fristen" : "de passerade fristerna"} i handlingsplanen`,
      href: "/dashboard",
    });
  }
  if (input.nextDeadlineLabel && (input.daysToNextDeadline ?? 99) <= 14) {
    items.push({
      label: `Bestäm åtgärd före ${input.nextDeadlineLabel.toLowerCase()} (om ${input.daysToNextDeadline} dagar)`,
      href: "/dashboard",
    });
  }
  if (!input.kbrDone) {
    items.push({ label: "Gör kontrollbalansbedömningen", href: "/kbr" });
  }
  if (input.coverageRatio !== null && input.coverageRatio < 50) {
    items.push({ label: "Se hur länge pengarna räcker", href: "/dashboard/liquidity" });
  }
  if (items.length === 0) {
    items.push({ label: "Håll lägesbilden uppdaterad - gå igenom handlingsplanen", href: "/dashboard" });
  }
  return items.slice(0, 3);
};

/**
 * Beslutsuppföljningen - minnet som gör CLEARANCE till en rådgivare och
 * inte en chatbot. Frågan byggs ur beslutets premiss: det som gällde
 * när beslutet togs är det som ska prövas mot verkligheten.
 */
export const decisionCheckIn = (decision: {
  title: string;
  premise: string | null;
  decidedAt: string;
}): string => {
  const d = new Date(decision.decidedAt);
  const months = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];
  const when = `${d.getDate()} ${months[d.getMonth()]}`;
  return decision.premise
    ? `Den ${when} beslutade ni: ”${decision.title}”. ${decision.premise} Är det fortfarande planen?`
    : `Den ${when} beslutade ni: ”${decision.title}”. Är det fortfarande planen?`;
};

/* --- Action Contract: inbjudan av extern expert ---------------------------- */

/**
 * "Jag behöver min revisor" är ingen frågeserie och ingen vy - det är en
 * ÅTGÄRD, och åtgärder går genom Action Contract (docs/agent-architecture.md):
 * förstå, kontrollera, bekräfta, utför, verifiera, logga. CLEARANCE visar
 * hela mejlet och exakt vad rollen ger åtkomst till INNAN något skickas.
 * Användaren ska aldrig bli överraskad.
 */
export type InviteRole = "auditor" | "legal_advisor";

/** Fritext → inbjudningsintention. Jurist före revisor: "min jurist" vinner. */
export const inviteIntent = (text: string): InviteRole | null => {
  if (!/\b(bjud|bjuda|prata med|behöver|koppla in|kontakta)\b/i.test(text)) return null;
  if (/jurist|advokat/i.test(text)) return "legal_advisor";
  if (/revisor/i.test(text)) return "auditor";
  return null;
};

export const INVITE_CONTRACT = {
  askEmail: (roleLabel: string): string =>
    `Självklart. Vilken e-postadress har din ${roleLabel.toLowerCase()}? Inbjudan blir medlemskap först när personen loggar in med exakt den adressen – en vidarebefordrad länk ger ingen åtkomst.`,
  invalidEmail: "Det där ser inte ut som en e-postadress. Försök igen – till exempel namn@byran.se.",
  understand: (email: string, roleLabel: string): string =>
    `Jag uppfattar att du vill bjuda in ${email} till ärendet som ${roleLabel.toLowerCase()}.`,
  /** Kontrollera-steget: vad åtgärden ger, och vad den inte ger. */
  control: (roleDescription: string): string[] => [
    `Rollen innebär: ${roleDescription}`,
    "Jag ändrar ingenting i ärendet - inbjudan ger läsning och deltagande enligt rollen, och den kan återkallas under Deltagare.",
    "Mejlet nedan skickas exakt som det står. Den personliga länken skapas vid utskicket.",
  ],
  confirmLabel: "Skicka inbjudan",
  cancelReply: "Okej – jag skickar ingenting. Säg till när du vill ta det.",
  verifySuccess: (email: string): string =>
    `Inbjudan är skickad till ${email} och journalförd. Den blir medlemskap först när personen loggar in med samma adress – status syns under Deltagare.`,
  verifyFailure: (reason: string): string =>
    `Inbjudan skickades inte: ${reason} Ingenting har journalförts som skickat.`,
} as const;

export const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Fakturaintentionen: "visa min faktura" gäller ABONNEMANGET - inte en
 * kundfordran. Prövas före krisflödena, annars äter kundflödet ordet
 * faktura. Resultatet blir ett fakturakort i samtalet, och allt finns
 * alltid också under Inställningar - rådgivaren lägger saker på rätt
 * plats, användaren behöver inte leta.
 */
export const invoiceIntent = (text: string): boolean =>
  /\b(min|mina|vår|våra|senaste|månads)[a-zåäö]*\s*faktur/i.test(text) ||
  /faktur[a-zåäö]*\s*(från|för|hos)\s*clearance/i.test(text) ||
  /\bkvitto\b/i.test(text);

/** Formaterar ett svar för journalen/samtalsloggen. */
export const answerLabel = (step: DialogStep, raw: string): string => {
  if (step.kind === "yesno") return yes(raw) ? "Ja" : "Nej";
  if (step.kind === "amount") {
    const n = amountOf(raw);
    return n > 0 ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") : raw.trim() || "0";
  }
  return raw.trim();
};

/* ==========================================================================
   src/lib/advisor/interview.ts
   ========================================================================== */

/**
 * INTERVJUN: ett samtal i stället för ett formulär.
 *
 * Frågorna ställs en i taget och nästa fråga beror på svaren innan.
 * Adaptiviteten är inte pynt - den är det som gör att antalet frågor kan
 * hållas nere. Ett bolag utan anställda ska inte få en fråga om hur
 * organisationen ser ut, och ett bolag som säljer till privatpersoner
 * ska inte få en fråga om sin största kunds andel av intäkterna.
 *
 * DEN VIKTIGASTE ANPASSNINGEN gäller den som har bråttom. CLEARANCE är
 * byggt för bolag i kris. Den som just svarat att lönerna inte kan
 * betalas på fredag ska inte behöva svara på hur ni hittar nya kunder
 * innan hen får hjälp. Frågor märkta `skipWhenAcute` faller därför bort
 * när läget är akut, och intervjun landar på tio frågor i stället för
 * femton. Det är samma princip som resten av produkten: ordningen ska
 * följa vad som brådskar, inte vad som är bekvämt att samla in.
 *
 * Motorn är deterministisk. Samma svar ger samma nästa fråga, varje
 * gång, och det går att testa.
 */

export interface InterviewOption {
  /** Det användaren klickar på. */
  label: string;
  /** Vad svaret säger om profilen. */
  fills: Partial<CompanyProfile>;
  /**
   * Signaler som inte är profilfält men som styr senare frågor och
   * risknivån - koncentration och riktning.
   */
  signal?: { concentration?: "låg" | "medel" | "hög"; trend?: "upp" | "stabil" | "ner" | "kraftigt ner" };
}

export interface InterviewQuestion {
  id: string;
  /** Frågan, ställd som en människa skulle ställa den. */
  text: string;
  /**
   * Varför den ställs. Övergångsprincipen gäller även här: ingen ny fråga
   * utan en kort introduktion om ämnet.
   */
  why: string;
  options: InterviewOption[];
  /**
   * Flera svar får väljas.
   *
   * Sätts BARA där verkligheten är blandad. En bilverkstad säljer halva
   * omsättningen i arbete och halva i reservdelar; att tvinga fram ett av
   * dem gör profilen fel, och att lägga till ett "Blandat"-alternativ
   * döljer VAD blandningen består av. Frågor där ett svar utesluter ett
   * annat ("Kan ni betala lönerna på fredag?") ska aldrig vara flerval.
   */
  multi?: boolean;
  /** Faller bort när läget är akut - se filhuvudet. */
  skipWhenAcute?: boolean;
  /** Villkor mot profilen så här långt. Utelämnat = ställs alltid. */
  askWhen?: (profile: CompanyProfile) => boolean;
}

/*
 * Villkoren är OPTIMISTISKA så länge fältet är okänt.
 *
 * Skälet är räknaren. Hade en fråga vars villkor ännu inte gick att
 * pröva räknats bort hade totalen VUXIT när svaret kom in - "fråga 3 av
 * 13" följt av "fråga 4 av 15" läses som att mållinjen flyttar sig, och
 * det är det säkraste sättet att få någon att sluta svara. Med den här
 * riktningen kan totalen bara krympa, och en intervju som blir kortare
 * är alltid välkomna nyheter.
 */
const hasEmployees = (p: CompanyProfile): boolean => p.employees !== "1 person";

const sellsToBusinesses = (p: CompanyProfile): boolean => p.customers !== "B2C";

/**
 * Frågebanken i den ordning frågorna ställs.
 *
 * Ordningen är inte godtycklig: den går från lätt att svara på till
 * eftertänksamt. Den som just skapat ett konto orkar svara "hur många
 * jobbar här"; frågan om vad man helst vill förbättra på sex månader
 * kräver att man hunnit landa.
 */
export const INTERVIEW: InterviewQuestion[] = [
  {
    id: "anstallda",
    text: "Hur många personer arbetar i företaget?",
    why: "Antalet styr vad som händer vid en betalningsstörning – löner har egna frister och eget skydd.",
    options: [
      { label: "Bara jag", fills: { employees: "1 person", growthPhase: "Enmansbolag" } },
      { label: "2–5 personer", fills: { employees: "2–5" } },
      { label: "6–20 personer", fills: { employees: "6–20" } },
      { label: "21–50 personer", fills: { employees: "21–50" } },
      { label: "Fler än 50", fills: { employees: "Fler än 50" } },
    ],
  },
  {
    id: "bransch",
    text: "Vilken bransch ligger närmast?",
    why: "Branschen avgör vad som är normalt: byggbolag och konsultbolag har helt olika betalningsmönster.",
    /*
     * Listan var för grov. En bilverkstad, en frisör, en elektriker och en
     * lantbrukare hade inget eget val och tvingades till "Något annat" -
     * och en bransch-fråga där var fjärde bolag svarar "annat" ger ingen
     * branschbild att luta sig mot. Alternativen nedan täcker de vanligaste
     * småföretagen i Sverige, grovt i linje med SNI:s huvudgrupper så att
     * de kan bytas mot företagsregistrets SNI-kod den dag den kopplas in.
     * "Något annat" finns kvar som sista utväg, inte som förstahandssvar.
     */
    options: [
      { label: "Bygg och anläggning", fills: { industry: "Bygg" } },
      { label: "Hantverk och installation", fills: { industry: "Hantverk och installation" } },
      { label: "Bil och verkstad", fills: { industry: "Bil och verkstad" } },
      { label: "Handel", fills: { industry: "Handel" } },
      { label: "Restaurang och hotell", fills: { industry: "Restaurang och hotell" } },
      { label: "Transport och åkeri", fills: { industry: "Transport" } },
      { label: "Tillverkning och industri", fills: { industry: "Tillverkning" } },
      { label: "IT och teknik", fills: { industry: "IT och teknik" } },
      { label: "Konsult och tjänster", fills: { industry: "Konsult och tjänster" } },
      { label: "Vård och omsorg", fills: { industry: "Vård och omsorg" } },
      { label: "Skönhet och hälsa", fills: { industry: "Skönhet och hälsa" } },
      { label: "Fastighet och förvaltning", fills: { industry: "Fastighet" } },
      { label: "Jordbruk och skog", fills: { industry: "Jordbruk och skog" } },
      { label: "Något annat", fills: { industry: "Övrigt" } },
    ],
  },
  {
    id: "erbjudande",
    text: "Vad säljer ni?",
    why: "Varor binder kapital i lager, tjänster binder det i tid. Det syns direkt i likviditeten.",
    /*
     * FLERVAL, och alternativet "Blandat" är borta. En bilverkstad säljer
     * arbete OCH reservdelar; "Blandat" sa att det var blandat men inte av
     * vad, och just den blandningen är hela skillnaden mellan lagerbindning
     * och tidsbindning.
     */
    multi: true,
    options: [
      { label: "Varor", fills: { businessModel: "Varuförsäljning" } },
      { label: "Tjänster", fills: { businessModel: "Tjänster" } },
      { label: "Projekt och uppdrag", fills: { businessModel: "Projekt" } },
      { label: "Abonnemang", fills: { businessModel: "Abonnemang" } },
    ],
  },
  {
    id: "kunder",
    text: "Vem köper av er?",
    why: "Vem som är kund styr betalningstiderna och vilka verktyg som finns om de inte betalar.",
    /*
     * FLERVAL. Det hopslagna alternativet "Både företag och privatpersoner"
     * är borta: det var en lapp över att flerval saknades, och det gick
     * inte att uttrycka "företag och offentlig sektor" med det.
     */
    multi: true,
    options: [
      { label: "Andra företag", fills: { customers: "B2B" } },
      { label: "Privatpersoner", fills: { customers: "B2C" } },
      { label: "Offentlig sektor", fills: { customers: "Offentlig sektor" } },
    ],
  },
  {
    id: "geografi",
    text: "Var finns kunderna?",
    why: "Geografin avgör vilka regler som gäller om det blir en process, och hur bred marknaden är.",
    options: [
      { label: "På orten", fills: { geography: "Lokalt" } },
      { label: "I regionen", fills: { geography: "Regionalt" } },
      { label: "I hela Sverige", fills: { geography: "Sverige" } },
      { label: "I Norden", fills: { geography: "Norden" } },
      { label: "Utanför Norden också", fills: { geography: "Internationellt" } },
    ],
  },
  {
    id: "omsattning",
    text: "Ungefär hur stor är omsättningen på ett år?",
    why: "Storleken avgör vilka verktyg som är rimliga. En rekonstruktion kostar detsamma oavsett bolagets storlek.",
    options: [
      { label: "Under 2 miljoner", fills: { revenue: "Under 2 Mkr" } },
      { label: "2–10 miljoner", fills: { revenue: "2–10 Mkr" } },
      { label: "10–50 miljoner", fills: { revenue: "10–50 Mkr" } },
      { label: "Över 50 miljoner", fills: { revenue: "Över 50 Mkr" } },
      { label: "Jag vet inte säkert", fills: {} },
    ],
  },
  {
    id: "utveckling",
    text: "Hur har omsättningen utvecklats det senaste året?",
    why: "Riktningen säger mer än nivån. Ett bolag på väg upp med tillfällig kassabrist är en annan sak än ett på väg ner.",
    options: [
      { label: "Ökat", fills: { growthPhase: "Tillväxt" }, signal: { trend: "upp" } },
      { label: "Ungefär oförändrad", fills: { growthPhase: "Stabil" }, signal: { trend: "stabil" } },
      { label: "Minskat", fills: { growthPhase: "Vikande" }, signal: { trend: "ner" } },
      { label: "Minskat kraftigt", fills: { growthPhase: "Kraftigt vikande" }, signal: { trend: "kraftigt ner" } },
    ],
  },
  {
    id: "aterkommande",
    text: "Har ni återkommande kunder eller mest engångsaffärer?",
    why: "Återkommande intäkter är det som gör en prognos möjlig. Utan dem blir varje månad en ny fråga.",
    options: [
      { label: "Mest återkommande", fills: { businessModel: "Återkommande intäkter" } },
      { label: "Ungefär hälften av varje", fills: {} },
      { label: "Mest engångsaffärer", fills: { businessModel: "Engångsaffärer" } },
    ],
  },
  {
    id: "beroende",
    text: "Hur stor del av intäkterna kommer från er största kund?",
    why: "En kund som står för halva omsättningen är den enskilt största risken i många småbolag.",
    askWhen: sellsToBusinesses,
    options: [
      { label: "Under en tiondel", fills: {}, signal: { concentration: "låg" } },
      { label: "Ungefär en fjärdedel", fills: {}, signal: { concentration: "medel" } },
      { label: "Ungefär hälften", fills: {}, signal: { concentration: "hög" } },
      { label: "Mer än hälften", fills: {}, signal: { concentration: "hög" } },
      { label: "Jag vet inte", fills: {} },
    ],
  },
  {
    id: "system",
    text: "Har ni ekonomisystem eller affärssystem idag?",
    why: "Det avgör hur snabbt vi kan få fram siffrorna – och om underlaget kan hämtas eller måste skrivas in.",
    // Flerval: bokföringsprogram OCH redovisningsbyrå är det vanligaste av allt.
    multi: true,
    options: [
      { label: "Ja, ett affärssystem", fills: { digitalMaturity: "Hög" } },
      { label: "Ja, ett bokföringsprogram", fills: { digitalMaturity: "Medel" } },
      { label: "Redovisningsbyrån sköter det", fills: { digitalMaturity: "Medel" } },
      { label: "Nej, vi gör det för hand", fills: { digitalMaturity: "Låg" } },
    ],
  },
  {
    id: "organisation",
    text: "Hur ser organisationen ut?",
    why: "Vem som får besluta styr vad som kan göras den här veckan – ett styrelsebeslut tar längre tid än ett eget.",
    askWhen: hasEmployees,
    options: [
      { label: "Jag driver och beslutar själv", fills: { growthPhase: "Ägarledd" } },
      { label: "Jag och några nyckelpersoner", fills: {} },
      { label: "Vi har en ledningsgrupp", fills: {} },
      { label: "Vi har en aktiv styrelse", fills: {} },
    ],
  },
  {
    id: "utmaning",
    text: "Vad är den största utmaningen just nu?",
    why: "Det här styr vad analysen ska börja med. Allt annat kan vänta tills det är sagt.",
    options: [
      { label: "Likviditeten", fills: {} },
      { label: "För få kunder", fills: {} },
      { label: "Lönsamheten", fills: {} },
      { label: "Kostnaderna", fills: {} },
      { label: "Personalen", fills: {} },
      { label: "Ägar- eller styrelsefrågor", fills: {} },
    ],
  },
  {
    id: "nya-kunder",
    text: "Hur hittar ni nya kunder idag?",
    why: "Om intäkterna behöver upp är det här den enda knappen som finns att vrida på kort sikt.",
    // Flerval: nästan alla bolag har mer än en väg in.
    multi: true,
    skipWhenAcute: true,
    options: [
      { label: "På rekommendation", fills: {} },
      { label: "Egen säljare eller eget säljarbete", fills: {} },
      { label: "Annonsering och digitala kanaler", fills: { digitalMaturity: "Medel" } },
      { label: "Upphandlingar", fills: {} },
      { label: "Vi söker inte aktivt", fills: {} },
    ],
  },
  {
    id: "sasong",
    text: "Är intäkterna jämna över året eller säsongsbetonade?",
    why: "En säsongssvacka som är väntad hanteras annorlunda än ett tapp ingen räknat med.",
    skipWhenAcute: true,
    options: [
      { label: "Ganska jämna", fills: {} },
      { label: "Tydliga säsonger", fills: {} },
      { label: "Helt ojämna", fills: {} },
    ],
  },
  {
    id: "sex-manader",
    text: "Vad skulle du helst vilja ha löst om ett halvår?",
    why: "Det är det svaret hela handlingsplanen ska mätas mot. Utan det blir planen vår, inte din.",
    skipWhenAcute: true,
    options: [
      { label: "Att kassan räcker utan att jag tänker på den", fills: {} },
      { label: "Att skulderna är under kontroll", fills: {} },
      { label: "Att bolaget är lönsamt igen", fills: {} },
      { label: "Att jag har lämnat över eller sålt", fills: {} },
      { label: "Att det är ordnat avvecklat", fills: {} },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Flera svar på samma fråga                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Skiljetecknet mellan valda svar.
 *
 * Ett svar är fortfarande EN STRÄNG. Det är inte lathet: hela
 * återupptagningen (onboardingResume) och dess prov vilar på att svaren är
 * text, och att byta till en lista hade gjort varje sparad post från i går
 * oläsbar mitt i ett pågående samtal.
 *
 * Tecknet är valt för att det inte förekommer i något alternativ - och
 * tests/onboarding.ts kräver att det förblir så.
 */
export const SVARSSKILJARE = " | ";

/** De valda alternativen. Tom lista för överhoppad eller obesvarad fråga. */
export const valdaSvar = (answer: string | undefined | null): string[] =>
  !answer ? [] : answer.split(SVARSSKILJARE).map((s) => s.trim()).filter(Boolean);

/** Flera val till ett lagrat svar. */
export const skrivSvar = (labels: string[]): string => labels.join(SVARSSKILJARE);

/**
 * Svaret som en människa läser det: "Varor, Tjänster och Abonnemang".
 *
 * Behövs för att analysen citerar svaren i löpande text. `Du svarade
 * "Varor | Tjänster"` hade avslöjat lagringsformatet i en mening som ska
 * låta som ett samtal.
 */
export const svarSomText = (answer: string | undefined | null): string => {
  const valda = valdaSvar(answer);
  if (valda.length === 0) return "";
  if (valda.length === 1) return valda[0];
  return `${valda.slice(0, -1).join(", ")} och ${valda[valda.length - 1]}`;
};

/** Frågan med ett visst id, oavsett var i katalogen den står. */
export const questionById = (id: string): InterviewQuestion | undefined =>
  INTERVIEW.find((q) => q.id === id);

/**
 * PROFILEN RÄKNAS FRAM UR SVAREN. Den ackumuleras inte.
 *
 * Det här är skillnaden mellan att kunna ändra ett svar och att bara se ut
 * att kunna det. Förut lades varje svars fält på profilen när det gavs, och
 * ett ändrat svar hade lämnat kvar det gamla fältet - profilen hade sagt
 * "Varuförsäljning" om ett bolag som just ändrat till "Tjänster", utan att
 * någon kunde se varför.
 *
 * Med en ren omräkning är ett ändrat svar korrekt av konstruktion: det
 * finns inget minne att glömma att rensa.
 *
 * TVÅ REGLER FÖR FLERVAL:
 *
 *  1. FÄLT SLÅS IHOP. Varor + Tjänster ger "Varuförsäljning och Tjänster",
 *     inte det ena eller det andra. Blandningen ÄR uppgiften.
 *  2. SIGNALER SÄTTS BARA NÄR DE VALDA ÄR ENIGA. En signal styr risknivån,
 *     och två valda alternativ som pekar åt olika håll är inte ett svar på
 *     vilken risknivå som gäller. Då förblir den okänd, vilket är sant.
 */
export interface Signals {
  concentration: "låg" | "medel" | "hög" | null;
  trend: "upp" | "stabil" | "ner" | "kraftigt ner" | null;
}

export const foldAnswers = (
  situationId: string | null,
  answers: Record<string, string>,
): { profile: CompanyProfile; signals: Signals } => {
  let profile = emptyProfile();
  const signals: Signals = { concentration: null, trend: null };

  for (const q of INTERVIEW) {
    if (!isAnswered(answers, q.id)) continue;
    const valda = valdaSvar(answers[q.id]);
    const options = valda
      .map((label) => q.options.find((o) => o.label === label))
      .filter((o): o is InterviewOption => o !== undefined);
    if (options.length === 0) continue;

    const fills: Record<string, string> = {};
    for (const option of options) {
      for (const [key, value] of Object.entries(option.fills)) {
        if (typeof value !== "string" || value === "") continue;
        const redan = fills[key];
        fills[key] = redan && redan !== value ? `${redan} och ${value}` : value;
      }
    }
    profile = applyAnswer(profile, fills as Partial<CompanyProfile>);

    for (const nyckel of ["concentration", "trend"] as const) {
      const varden = options
        .map((o) => o.signal?.[nyckel])
        .filter((v): v is NonNullable<typeof v> => v !== undefined);
      // Eniga eller inget alls. Se regel 2 ovan.
      if (varden.length > 0 && varden.every((v) => v === varden[0])) {
        (signals[nyckel] as unknown) = varden[0];
      }
    }
  }

  profile = applyAnswer(profile, {
    riskLevel: deriveRiskLevel({
      situationId,
      concentration: signals.concentration,
      trend: signals.trend,
    }),
  });
  return { profile, signals };
};

/**
 * SVARAD är inte samma sak som SVARAD MED NÅGOT.
 *
 * Att hoppa över en fråga ÄR ett svar - svaret "det vill jag inte säga".
 * Överhoppade frågor lagras som tom sträng, och en tom sträng är falsk.
 * Motorn läste därför `!answers[id]` som "obesvarad" och ställde samma
 * fråga igen, i evighet: knappen "Hoppa över frågan" gjorde ingenting
 * alls och användaren satt fast.
 *
 * Frågan om något är besvarat ska därför ALLTID gå genom den här
 * funktionen, aldrig genom sanningsvärdet hos svaret. Nyckeln finns =
 * användaren har tagit ställning.
 */
export const isAnswered = (answers: Record<string, string>, id: string): boolean =>
  Object.prototype.hasOwnProperty.call(answers, id);

/**
 * Läget är akut när introduktionen sa det, eller när användaren själv
 * pekat ut likviditeten som den största utmaningen.
 */
export const isAcute = (situationId: string | null, answers: Record<string, string>): boolean =>
  situationId === "loner" ||
  situationId === "ansvar" ||
  answers.utmaning === "Likviditeten";

/** Frågorna som gäller för det här bolaget, i ordning. */
export const applicableQuestions = (
  profile: CompanyProfile,
  situationId: string | null,
  answers: Record<string, string>,
): InterviewQuestion[] => {
  const acute = isAcute(situationId, answers);
  return INTERVIEW.filter((q) => {
    // En fråga som redan är besvarad står kvar i listan - annars skulle
    // "fråga 4 av 12" räkna ner medan man svarar, vilket är obegripligt.
    if (acute && q.skipWhenAcute && !isAnswered(answers, q.id)) return false;
    if (q.askWhen && !q.askWhen(profile) && !isAnswered(answers, q.id)) return false;
    return true;
  });
};

/** Nästa obesvarade fråga, eller null när intervjun är klar. */
export const nextQuestion = (
  profile: CompanyProfile,
  situationId: string | null,
  answers: Record<string, string>,
): InterviewQuestion | null =>
  applicableQuestions(profile, situationId, answers).find((q) => !isAnswered(answers, q.id)) ?? null;

/** Var i intervjun användaren är: "Fråga 4 av 12". */
export const interviewProgress = (
  profile: CompanyProfile,
  situationId: string | null,
  answers: Record<string, string>,
): { current: number; total: number } => {
  const applicable = applicableQuestions(profile, situationId, answers);
  const answeredCount = applicable.filter((q) => isAnswered(answers, q.id)).length;
  return { current: Math.min(answeredCount + 1, applicable.length), total: applicable.length };
};

/* ==========================================================================
   src/lib/advisor/firstAnalysis.ts
   ========================================================================== */

/**
 * DEN FÖRSTA ANALYSEN, direkt efter intervjun.
 *
 * Det här är första gången användaren får något TILLBAKA. Fram till nu
 * har hen bara lämnat uppgifter. Vad som står här avgör om resten av
 * produkten får en chans.
 *
 * Två krav styr innehållet. Det ska vara SPECIFIKT - varje observation
 * ska gå att spåra till ett svar användaren själv lämnade, och den
 * kopplingen skrivs ut. Och det ska vara ÄRLIGT om vad det inte är: det
 * här är en bild av verksamheten, inte en bedömning av betalningsförmågan.
 * Den bedömningen kräver siffror som ingen ännu lämnat, och att antyda
 * något annat vore att sälja en trygghet som inte finns täckning för.
 *
 * Motorn är deterministisk, som resten av analyskedjan.
 */

export interface Observation {
  /** Vad vi ser. */
  text: string;
  /** Vilket svar det vilar på - alltid utskrivet, aldrig underförstått. */
  basis: string;
}

export interface FirstAnalysis {
  headline: string;
  /** Det systemet har förstått, i löptext. */
  understanding: string;
  risks: Observation[];
  opportunities: Observation[];
  /** Vad analysen INTE säger. Obligatorisk, aldrig tom. */
  limits: string[];
  /** Nästa steg, med sin dörr. */
  nextStep: { label: string; href: string; why: string };
}

export interface FirstAnalysisInput {
  companyName: string;
  profile: CompanyProfile;
  answers: Record<string, string>;
  situationId: string | null;
  /** Sant när företagsregistret svarade. */
  registryHit: boolean;
}

const joinSwedish = (parts: string[]): string =>
  parts.join(", ").replace(/, ([^,]*)$/, " och $1");

export const buildFirstAnalysis = (input: FirstAnalysisInput): FirstAnalysis => {
  const { profile, answers, companyName } = input;
  const filled = profileFilled(profile);

  /* --- vad vi förstått ---------------------------------------------------- */
  const traits: string[] = [];
  if (profile.industry) traits.push(`verkar inom ${profile.industry.toLowerCase()}`);
  if (profile.employees) {
    traits.push(profile.employees === "1 person" ? "drivs av dig ensam" : `har ${profile.employees} anställda`);
  }
  if (profile.customers) {
    const who = { B2B: "andra företag", B2C: "privatpersoner", "Offentlig sektor": "offentlig sektor" }[
      profile.customers
    ] ?? "både företag och privatpersoner";
    traits.push(`säljer till ${who}`);
  }
  if (profile.geography) traits.push(`med kunder ${profile.geography.toLowerCase()}`);

  const understanding =
    traits.length > 0
      ? `${companyName} ${joinSwedish(traits)}.`
      : `Jag har ännu ingen bild av vad ${companyName} gör – inga av frågorna om verksamheten är besvarade.`;

  /* --- risker: var och en förankrad i ett svar ---------------------------- */
  const risks: Observation[] = [];
  if (answers.beroende === "Mer än hälften" || answers.beroende === "Ungefär hälften") {
    risks.push({
      text: "En enda kund står för en stor del av intäkterna. Om den kunden försvinner eller dröjer med betalningen slår det igenom direkt i kassan.",
      basis: `Du svarade "${svarSomText(answers.beroende)}" på frågan om största kundens andel.`,
    });
  }
  if (profile.growthPhase === "Kraftigt vikande" || profile.growthPhase === "Vikande") {
    risks.push({
      text: "Omsättningen går åt fel håll. Det gör att varje månad som passerar utan åtgärd minskar handlingsutrymmet, även om kassan räcker just nu.",
      basis: `Du svarade "${svarSomText(answers.utveckling)}" om det senaste året.`,
    });
  }
  if (profilInnehaller(profile.digitalMaturity, "Låg")) {
    risks.push({
      text: "Utan ekonomisystem tar det längre tid att få fram siffrorna – och i ett läge där datum styr är fördröjningen i sig en risk.",
      basis: `Du svarade "${svarSomText(answers.system)}" om ekonomisystem.`,
    });
  }
  if (profilInnehaller(profile.businessModel, "Engångsaffärer")) {
    risks.push({
      text: "Utan återkommande intäkter måste varje månads omsättning byggas på nytt. Det gör prognoser svårare och svackor brantare.",
      basis: `Du svarade "${svarSomText(answers.aterkommande)}" om återkommande kunder.`,
    });
  }
  if (profilInnehaller(profile.businessModel, "Projekt")) {
    risks.push({
      text: "Projektaffärer binder pengar innan de betalar tillbaka. Kassan är därför känsligast mitt i ett projekt, inte i slutet.",
      basis: `Du svarade "${svarSomText(answers.erbjudande)}" om vad ni säljer.`,
    });
  }
  if (answers.utmaning) {
    risks.push({
      text: `Du pekar själv ut ${svarSomText(answers.utmaning).toLowerCase()} som den största utmaningen. Den styr vad analysen börjar med.`,
      basis: `Du svarade "${svarSomText(answers.utmaning)}" på frågan om största utmaningen.`,
    });
  }

  /* --- möjligheter: obligatoriskt avsnitt, aldrig uppgivet ---------------- */
  const opportunities: Observation[] = [];
  if (
    profilInnehaller(profile.businessModel, "Återkommande intäkter") ||
    profilInnehaller(profile.businessModel, "Abonnemang")
  ) {
    opportunities.push({
      text: "Återkommande intäkter är den starkaste tillgången i ett ansträngt läge: de gör en likviditetsprognos meningsfull och ger en förhandling med borgenärer något att luta sig mot.",
      basis: `Du svarade "${answers.aterkommande ?? answers.erbjudande}" om intäkterna.`,
    });
  }
  if (profilInnehaller(profile.customers, "Offentlig sektor")) {
    opportunities.push({
      text: "Offentliga kunder betalar sent men de betalar. Fordringar på offentlig sektor är därför lättare att belåna än andra kundfordringar.",
      basis: `Du svarade "${svarSomText(answers.kunder)}" om vem som köper.`,
    });
  }
  if (profile.growthPhase === "Tillväxt") {
    opportunities.push({
      text: "Ett bolag med växande omsättning och ansträngd kassa har oftast ett finansieringsproblem, inte ett lönsamhetsproblem. Det är den lättare av de två att lösa.",
      basis: `Du svarade "${svarSomText(answers.utveckling)}" om det senaste året.`,
    });
  }
  if (
    profilInnehaller(profile.digitalMaturity, "Hög") ||
    profilInnehaller(profile.digitalMaturity, "Medel")
  ) {
    opportunities.push({
      text: "Siffrorna finns redan i ett system. Det gör att underlaget till en prognos eller en kontrollbalansräkning kan tas fram på timmar i stället för veckor.",
      basis: `Du svarade "${svarSomText(answers.system)}" om ekonomisystem.`,
    });
  }
  opportunities.push({
    text: "Att du gör det här nu, innan något förfallit, är i sig det som ger flest alternativ. Nästan alla verktyg i en företagskris kräver framförhållning för att fungera.",
    basis: "Gäller alla som kommer hit i tid.",
  });

  /* --- gränserna: vad detta INTE är --------------------------------------- */
  const limits: string[] = [
    "Det här är en bild av verksamheten, inte en bedömning av betalningsförmågan. Den bedömningen kräver siffror – löner, skatt, hyra, skulder – som ännu inte är lämnade.",
  ];
  if (filled < 9) {
    limits.push(
      `${9 - filled} av 9 fält i profilen står fortfarande som okända, och observationerna nedan säger ingenting om dem.`,
    );
  }
  if (!input.registryHit) {
    limits.push(
      "Företagsregistret gav inget svar på organisationsnumret, så inget här är kontrollerat mot en offentlig källa.",
    );
  }

  const headline =
    filled === 0
      ? `Jag har ingen bild av ${companyName} än`
      : `Så här ser jag ${companyName} efter ${Object.keys(answers).length} svar`;

  return {
    headline,
    understanding,
    risks,
    opportunities,
    limits,
    nextStep: {
      label: "Gör nulägesanalysen",
      href: "/wizard",
      why: "Där lämnar du siffrorna – löner, skatt, hyra, skulder – och då kan bilden ovan bli en bedömning av vad som faktiskt går att göra.",
    },
  };
};

/* ==========================================================================
   src/lib/advisor/memory.ts
   ========================================================================== */

/**
 * Ärendeminnet: den aktuella och verifierade arbetsmodellen av företaget.
 *
 * Två löften bor här. Det första: CLEARANCE frågar aldrig om sådant den
 * redan vet - kunskapen i modellen används tills användaren ändrar den.
 * Det andra: modellen är ÖPPEN. "Vad jag vet om ditt företag" visar
 * exakt vad systemet arbetar utifrån, med källa per uppgift - en
 * arbetsmodell, aldrig en övervakningsakt.
 *
 * Allt härleds ur journalen och ärendets registrerade uppgifter.
 * Ingenting i modellen är gissat, och därför kan varje rad förklaras.
 */

export interface WorkingModelRow {
  label: string;
  value: string;
  /** Var uppgiften kommer ifrån - transparensens kärna. */
  source: string;
}

export interface WorkingModelSection {
  id: string;
  title: string;
  rows: WorkingModelRow[];
}

const GOAL_BY_RECOMMENDATION: Record<string, string> = {
  stabilize: "Stabilisera ekonomin och undvika insolvens",
  reconstruction: "Pröva rekonstruktion och säkra fortsatt drift",
  bankruptcy: "Skydda värden och hantera avvecklingsfrågan ordnat",
};

export const buildWorkingModel = (input: {
  caseRecord: CaseRecord;
  decisions: CaseDecisionRecord[];
  members: CaseMemberRecord[];
  nextDeadline: { label: string; daysLeft: number } | null;
  kbrDone: boolean;
}): WorkingModelSection[] => {
  const { caseRecord, decisions, members, nextDeadline, kbrDone } = input;
  const activeDecisions = decisions.filter((d) => d.status === "active");
  const totalDebt = parseAmount(caseRecord.totalDebt);
  const liquidation = parseAmount(caseRecord.quickLiquidationValue);
  const coverage = totalDebt > 0 ? Math.round((liquidation / totalDebt) * 100) : null;

  const sections: WorkingModelSection[] = [
    {
      id: "foretag",
      title: "Företaget",
      rows: [
        {
          label: "Bolag",
          value: caseRecord.companyName
            ? `${caseRecord.companyName} (${caseRecord.orgNumber})`
            : caseRecord.orgNumber,
          source: "ur nulägesanalysen",
        },
        ...(caseRecord.employees
          ? [{ label: "Anställda", value: String(caseRecord.employees), source: "ur nulägesanalysen" }]
          : []),
        ...(coverage !== null
          ? [{ label: "Skuldtäckning", value: `${coverage} % vid snabb avyttring`, source: "ur registrerade skulder och tillgångar" }]
          : []),
      ],
    },
    {
      id: "arbete",
      title: "Arbetet just nu",
      rows: [
        {
          label: "Mål",
          value:
            (caseRecord.recommendationType && GOAL_BY_RECOMMENDATION[caseRecord.recommendationType]) ??
            "Skapa struktur och full bild av läget",
          source: "ur systemets rekommendation",
        },
        {
          label: "Närmast i tiden",
          value: nextDeadline
            ? `${nextDeadline.label} (om ${nextDeadline.daysLeft} dagar)`
            : "Inga bevakade datum framför oss",
          source: "ur fristbevakningen",
        },
        {
          label: "Kontrollbalansbedömningen",
          value: kbrDone ? "Gjord och journalförd" : "Inte gjord än",
          source: "ur ärendets journal",
        },
      ],
    },
    {
      id: "beslut",
      title: "Fattade beslut",
      rows: activeDecisions.length
        ? activeDecisions.slice(0, 3).map((d) => ({
            label: new Date(d.decidedAt).toLocaleDateString("sv-SE", { day: "numeric", month: "short" }),
            value: d.title,
            source: "ur beslutsminnet, med premiss",
          }))
        : [{ label: "–", value: "Inga aktiva beslut protokollförda än", source: "ur beslutsminnet" }],
    },
    {
      id: "personer",
      title: "Personerna kring bolaget",
      rows: members
        .filter((m) => !m.revokedAt)
        .slice(0, 6)
        .map((m) => ({
          label: m.displayName || m.email || "Utan namn",
          value: CASE_ROLE_LABELS[m.role],
          source: "ur deltagarlistan",
        })),
    },
  ];

  return sections.filter((s) => s.rows.length > 0);
};

/* --- sedan sist ------------------------------------------------------------ */

/**
 * "Sedan vi pratades vid har följande hänt" - byggd ur journalen,
 * aldrig påhittad. Händelser efter senaste samtalet översätts till
 * läsbara rader; det egna samtalet räknas inte som nyhet.
 */
const EVENT_LABEL: Record<string, (e: AuditEventRecord) => string | null> = {
  case_documents: (e) => {
    if (e.action === "insert") return `Nytt dokument: ${e.detail ?? "utan namn"}`;
    // Granskningsflödet: godkännandet är nyheten användaren väntar på.
    if (e.detail?.includes("godkändes")) return `Dokument godkänt: ${e.detail.replace(" godkändes", "")}`;
    if (e.detail?.includes("för granskning")) return e.detail;
    return null;
  },
  case_decisions: (e) =>
    e.action === "insert" ? `Beslut protokollfört: ${e.detail?.replace(/^beslut: /, "") ?? ""}` : `Ett beslut omprövades`,
  case_tasks: (e) =>
    e.action === "update" && e.detail?.includes("bockades av") ? `Uppgift klar: ${e.detail.replace(" bockades av", "")}` : null,
  case_invitations: (e) =>
    e.action === "update" && e.detail?.includes("tackade ja") ? `${e.detail}` : null,
  conversations: (e) => (e.action === "insert" ? `Ny meddelandetråd startad` : null),
  kbr_assessments: (e) => (e.action === "insert" ? `Kontrollbalansbedömning registrerad` : null),
};

export const sinceLastVisit = (events: AuditEventRecord[], lastVisit: string | null): string[] => {
  if (!lastVisit) return [];
  const lines: string[] = [];
  for (const event of events) {
    if (event.occurredAt <= lastVisit) continue;
    if (event.objectType === "advisor_sessions") continue;
    const translate = EVENT_LABEL[event.objectType];
    const line = translate?.(event);
    if (line && !lines.includes(line)) lines.push(line);
  }
  return lines.slice(0, 4);
};

/* ==========================================================================
   src/lib/advisor/onboardingHandoff.ts
   ========================================================================== */

/**
 * Överlämningen från onboardingen till nulägesanalysen.
 *
 * Löftet i introduktionen är att grunduppgifterna sparar tid. Ett löfte
 * som bryts i nästa vy - genom att guiden frågar om organisationsnumret
 * en gång till - är värre än inget löfte alls: det lär användaren att
 * ingenting som sägs i samtalet får konsekvenser.
 *
 * Bara localStorage, av samma skäl som autosparet: onboardingen körs
 * utan konto, och ofärdiga uppgifter ska inte lämna datorn förrän
 * användaren själv väljer att spara.
 */

const KEY = "clearance-onboarding";

export interface OnboardingHandoff {
  name: string;
  company: string;
  orgNumber: string;
  situation: string;
  savedAt: string;
  /**
   * Intervjusvaren och företagsprofilen, så att nulägesanalysen kan
   * bygga vidare i stället för att fråga om samma sak igen. Frivilliga:
   * en överlämning som sparats före intervjun saknar dem, och den ska
   * fortfarande gå att läsa.
   *
   * Lösenordet finns INTE här och ska aldrig hamna här. Det går till
   * inloggningen och ingen annanstans - localStorage är läsbart för allt
   * som kör i fliken.
   */
  answers?: Record<string, string>;
  profile?: Record<string, string | null>;
}

export const saveOnboarding = (
  input: Omit<OnboardingHandoff, "savedAt">,
): void => {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...input, savedAt: new Date().toISOString() }),
    );
  } catch {
    // Fullt eller privat läge. Överlämningen är en förbättring, inte ett
    // krav - guiden fungerar precis som förut när lagringen inte gör det.
  }
};

export const readOnboarding = (): OnboardingHandoff | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OnboardingHandoff>;
    if (!parsed || typeof parsed.name !== "string") return null;
    return {
      name: parsed.name,
      company: typeof parsed.company === "string" ? parsed.company : "",
      orgNumber: typeof parsed.orgNumber === "string" ? parsed.orgNumber : "",
      situation: typeof parsed.situation === "string" ? parsed.situation : "",
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : "",
      answers: parsed.answers && typeof parsed.answers === "object" ? parsed.answers : undefined,
      profile: parsed.profile && typeof parsed.profile === "object" ? parsed.profile : undefined,
    };
  } catch {
    return null;
  }
};

export const clearOnboarding = (): void => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Se ovan: det värsta som händer är en förifyllning för mycket.
  }
};

/**
 * Onboardingens storleksintervall → nulägesanalysens.
 *
 * De två frågorna använde olika trappor: onboardingen frågar
 * "1 / 2–5 / 6–20 / 21–50 / fler än 50", nulägesanalysen
 * "0 / 1-5 / 6-10 / 11-25 / 26-50 / 50+". Just den skillnaden gjorde att
 * antalet anställda frågades EN GÅNG TILL fast det redan var lämnat - och
 * ett löfte om att grunduppgifterna sparar tid, som bryts i nästa vy, är
 * värre än inget löfte alls.
 *
 * Bryggan mappar på intervallets mittpunkt. Den är inte exakt (6–20 kan
 * vara 6 eller 20), men ett förifyllt och ändringsbart svar slår att fråga
 * om samma sak igen med tom ruta. Okänt eller tomt ger null - då står
 * analysens egen fråga kvar, som förut.
 */
export const wizardEmployees = (fromOnboarding: string | null | undefined): string | null => {
  switch ((fromOnboarding ?? "").trim()) {
    case "1 person":
      return "1-5";
    case "2–5":
      return "1-5";
    case "6–20":
      return "11-25";
    case "21–50":
      return "26-50";
    case "Fler än 50":
      return "50+";
    default:
      return null;
  }
};

/* ==========================================================================
   src/lib/advisor/onboardingResume.ts
   ========================================================================== */

/**
 * DET AVBRUTNA SAMTALET.
 *
 * Guiderna fick autospar av ett skäl som står i useAutosavedState: en
 * företagare som fyllt i tre steg och råkade uppdatera sidan förlorade
 * allt, mitt i sitt livs mest stressade vecka. De flesta stänger fliken
 * där och kommer inte tillbaka.
 *
 * Introduktionssamtalet - produktens ytterdörr, femton frågor, tre till
 * fem minuter, oftast i en telefon - var det enda flödet som aldrig fick
 * det. Ett fliksbyte, en skärmlåsning eller en webbläsare som återvinner
 * fliken räckte för att kasta bort varje svar. Sidan mötte sedan
 * användaren med "fortsätt samtalet där ni slutade", ett löfte om något
 * som inte fanns kvar. Ett brutet löfte är värre än inget löfte: det
 * lär användaren att ingenting som sägs i samtalet får konsekvenser.
 *
 * Två saker ligger medvetet UTANFÖR posten:
 *
 *  - Lösenordet. Det går till inloggningen och ingen annanstans.
 *    localStorage är läsbart för allt som kör i fliken.
 *  - E-postadressen. Den behövs bara i kontosteget, och posten skrivs
 *    först när kontot finns. Ett fält som inte behövs ska inte lagras.
 *
 * Posten skrivs alltså tidigast när kontot är skapat - efter den punkt
 * där användaren själv valt att bli sparad. Den raderas när samtalet
 * lämnas över till nulägesanalysen, så att nästa besök börjar rent i
 * stället för i ett gammalt halvfärdigt läge.
 */

const KEY__advisor_onboardingResume = "clearance-onboarding-pagaende";

/** Bumpas när postens form ändras, så gammal data inte tolkas fel. */
const VERSION = 1;

/** De stadier som går att återuppta. Före kontot finns inget att spara. */
export type ResumableStage = "situation" | "intervju" | "analys";

export interface ResumeEntry {
  who: "user" | "radgivare";
  text: string;
  kind?: "text" | "steps" | "confirm";
}

export interface OnboardingResume {
  stage: ResumableStage;
  entries: ResumeEntry[];
  name: string;
  company: string;
  orgNumber: string;
  situationId: string | null;
  answers: Record<string, string>;
  profile: CompanyProfile;
  signals: {
    concentration: "låg" | "medel" | "hög" | null;
    trend: "upp" | "stabil" | "ner" | "kraftigt ner" | null;
  };
  savedAt: string;
}

interface Envelope {
  version: number;
  value: OnboardingResume;
}

const STAGES: ResumableStage[] = ["situation", "intervju", "analys"];

const isRecordOfStrings = (v: unknown): v is Record<string, string> =>
  !!v && typeof v === "object" && !Array.isArray(v)
    && Object.values(v as Record<string, unknown>).every((x) => typeof x === "string");

/**
 * Hur många frågor som faktiskt är besvarade i posten.
 *
 * Överhoppade frågor lagras som tom sträng och räknas inte - samma regel
 * som i analysen. "Sex svar" när tre av dem var överhoppningar är en
 * överdrift om hur mycket vi vet, och siffran visas för användaren.
 */
export const resumeAnswerCount = (resume: OnboardingResume): number =>
  Object.values(resume.answers).filter((v) => v !== "").length;

export const saveResume = (value: OnboardingResume): void => {
  try {
    const envelope: Envelope = { version: VERSION, value };
    localStorage.setItem(KEY__advisor_onboardingResume, JSON.stringify(envelope));
  } catch {
    // Fullt eller privat läge. Att kunna återuppta är en förbättring,
    // inte ett krav: samtalet fungerar precis som förut utan lagringen.
  }
};

/**
 * Posten, eller null.
 *
 * Vid trasig, föråldrad eller ofullständig data returneras null tyst.
 * Ett felmeddelande om en lagring användaren inte vet finns hjälper
 * ingen - och en halvläst post som resulterar i ett samtal utan frågor
 * hade varit en ny återvändsgränd.
 */
export const readResume = (): OnboardingResume | null => {
  try {
    const raw = localStorage.getItem(KEY__advisor_onboardingResume);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Envelope>;
    if (!parsed || parsed.version !== VERSION) return null;
    const v = parsed.value;
    if (!v || typeof v !== "object") return null;
    if (!STAGES.includes(v.stage)) return null;
    if (!Array.isArray(v.entries)) return null;
    if (!isRecordOfStrings(v.answers)) return null;
    if (!v.profile || typeof v.profile !== "object") return null;
    if (typeof v.name !== "string" || typeof v.company !== "string") return null;
    const entries = v.entries.filter(
      (e): e is ResumeEntry =>
        !!e && typeof e === "object"
        && (e.who === "user" || e.who === "radgivare")
        && typeof e.text === "string",
    );
    // Ett samtal utan repliker är inget samtal att återuppta.
    if (entries.length === 0) return null;
    return {
      stage: v.stage,
      entries,
      name: v.name,
      company: v.company,
      orgNumber: typeof v.orgNumber === "string" ? v.orgNumber : "",
      situationId: typeof v.situationId === "string" ? v.situationId : null,
      answers: v.answers,
      profile: v.profile as CompanyProfile,
      signals: {
        concentration: v.signals?.concentration ?? null,
        trend: v.signals?.trend ?? null,
      },
      savedAt: typeof v.savedAt === "string" ? v.savedAt : "",
    };
  } catch {
    return null;
  }
};

export const clearResume = (): void => {
  try {
    localStorage.removeItem(KEY__advisor_onboardingResume);
  } catch {
    // Se ovan: det värsta som händer är en återupptagning för mycket,
    // och den går alltid att tacka nej till.
  }
};

/**
 * Finns det ett avbrutet samtal att återuppta?
 *
 * Startsidan frågar innan den erbjuder en återvändande användare att
 * "fortsätta samtalet". Finns posten ska samtalet återupptas på riktigt,
 * inte ersättas av en knapp som leder någon annanstans.
 */
export const hasResume = (): boolean => readResume() !== null;

/* ==========================================================================
   src/lib/advisor/options.ts
   ========================================================================== */

/**
 * Handlingsalternativen: vilka vägar som finns kvar, och vad de kräver.
 *
 * Det finns ingen modul som heter "Konkurs" i den här produkten. Det
 * finns vägar framåt, och var och en har en status som uppdateras när
 * ärendet ändras: öppen, smalnar, brådskande eller stängd. Fokus ligger
 * på beslut och möjligheter - inte på en förutbestämd utgång.
 *
 * Konstitutionen gäller: vägarna presenteras som möjligheter att pröva
 * mot just det här bolagets läge, aldrig som universella sanningar.
 * Statusarna härleds deterministiskt ur ärendets registrerade uppgifter
 * - samma läge ger samma bild, och bilden kan alltid förklaras.
 */

export type PathStatus = "open" | "narrowing" | "urgent" | "closed";

export interface OptionsInput {
  /** Snabbt avyttringsvärde delat med totala skulder, i procent. Null när skulder saknas. */
  coverageRatio: number | null;
  /** Antal frister som redan passerat obehandlade. */
  passedDeadlines: number;
  /** Dagar till närmaste kommande frist. Null när ingen finns. */
  daysToNextDeadline: number | null;
  canPayTax: boolean;
  canPaySalary: boolean;
  /** Systemets rekommendation ur nulägesanalysen, om någon. */
  recommendationType: "bankruptcy" | "reconstruction" | "stabilize" | null;
  /** Är kontrollbalansbedömningen gjord? */
  kbrDone: boolean;
}

export interface ActionPath {
  id: string;
  title: string;
  status: PathStatus;
  /** En mening: vad vägen är. */
  summary: string;
  /** Vad vägen kräver - kraven är vägens pris, utskrivet. */
  requires: string[];
  /** Varför statusen är den den är, ur ärendets data. */
  statusReason: string;
}

export const PATH_STATUS_LABELS: Record<PathStatus, string> = {
  open: "Öppen",
  narrowing: "Smalnar",
  urgent: "Brådskande",
  closed: "Kräver mer än läget medger",
};

const STATUS_ORDER: Record<PathStatus, number> = { urgent: 0, open: 1, narrowing: 2, closed: 3 };

export const buildActionPaths = (input: OptionsInput): ActionPath[] => {
  const paths: ActionPath[] = [];
  const coverage = input.coverageRatio;

  /* Stabilisering i egen drift - den operativa återhämtningen. */
  {
    const pressured = !input.canPayTax || !input.canPaySalary || input.passedDeadlines > 0;
    paths.push({
      id: "stabilisering",
      title: "Stabilisering i egen drift",
      status: pressured ? "narrowing" : "open",
      summary:
        "Vänd kassaflödet med det bolaget redan har: snabbare fakturering, indrivna fordringar, omförhandlade villkor och en plan som följs upp varje vecka.",
      requires: [
        "En realistisk likviditetsplan som visar att pengarna räcker under vändningen",
        "Veckovis uppföljning mot planen - avvikelser hanteras direkt",
        "Att inga skyddade frister hinner passera under tiden",
      ],
      statusReason: pressured
        ? "Skatter, löner eller frister är redan under press - varje vecka utan plan smalnar den här vägen."
        : "Inga frister har passerat och de löpande betalningarna klaras ännu.",
    });
  }

  /* Skatteanstånd. */
  {
    const urgent = !input.canPayTax && (input.daysToNextDeadline ?? 99) <= 14;
    paths.push({
      id: "anstand",
      title: "Anstånd hos Skatteverket",
      status: !input.canPayTax ? (urgent ? "urgent" : "open") : "open",
      summary:
        "Flyttar skattens förfallodag och köper tid - och flyttar samtidigt den dag företrädaransvaret prövas mot.",
      requires: [
        "Ansökan FÖRE förfallodagen - efteråt är verkan en annan",
        "En förklaring till betalningssvårigheterna och en plan för betalning",
      ],
      statusReason: !input.canPayTax
        ? urgent
          ? "Skatten kan inte betalas och förfallodagen är nära - ansökan brådskar."
          : "Skatten är under press - ansökan bör förberedas nu."
        : "Ingen akut skattebrist är registrerad, men vägen finns om läget ändras.",
    });
  }

  /* Frivillig uppgörelse med borgenärerna. */
  {
    const trustEroding = input.passedDeadlines > 0;
    paths.push({
      id: "uppgorelse",
      title: "Frivillig uppgörelse med borgenärerna",
      status: trustEroding ? "narrowing" : "open",
      summary:
        "Förhandlade betalningsplaner eller nedskrivningar utan domstol - snabbast och billigast när förtroendet finns kvar.",
      requires: [
        "Borgenärernas förtroende - ett genomarbetat underlag är halva förhandlingen",
        "Likabehandling av borgenärerna i praktiken, annars faller uppgörelsen",
        "Att bolaget klarar den plan som erbjuds",
      ],
      statusReason: trustEroding
        ? "Passerade frister tär på förtroendet - ju längre väntan, desto svagare förhandlingsläge."
        : "Inga frister har passerat - förhandlingsläget är fortfarande gott.",
    });
  }

  /* Företagsrekonstruktion. */
  {
    const viable = input.recommendationType !== "bankruptcy";
    const wagesPressed = !input.canPaySalary;
    paths.push({
      id: "rekonstruktion",
      title: "Företagsrekonstruktion",
      status: !viable ? "narrowing" : wagesPressed ? "urgent" : "open",
      summary:
        "Ett domstolsförfarande som ger andrum: betalningsstopp mot borgenärerna, statlig lönegaranti för de anställda och en plan som kan skriva ned skulder.",
      requires: [
        "Livskraft i kärnverksamheten - rekonstruktion räddar bärkraftiga bolag, inte affärsmodeller som inte bär",
        "Ansökan till tingsrätten och pengar att driva förfarandet",
        "En rekonstruktör - och ett underlag som håller för prövningen",
      ],
      statusReason: !viable
        ? "Nulägesanalysen pekar mot att kärnan kan sakna bärkraft - då är rekonstruktionens krav svåra att möta."
        : wagesPressed
          ? "Lönerna är under press - vid rekonstruktion kan lönegarantin träda in, men ansökan måste hinna före konkursansökningar."
          : "Verksamheten bedöms ha en kärna att rekonstruera kring.",
    });
  }

  /* Ordnad avveckling - likvidation. */
  {
    const solvent = coverage !== null && coverage >= 100;
    paths.push({
      id: "avveckling",
      title: "Ordnad avveckling (likvidation)",
      status: solvent ? "open" : "closed",
      summary:
        "Bolaget avvecklas under kontroll: tillgångarna säljs, skulderna betalas och det som blir över skiftas ut. Ett slut man väljer, inte ett som väljer en.",
      requires: [
        "Att skulderna kan betalas fullt ut - annars är vägen konkurs eller uppgörelse",
        "Bolagsstämmans beslut och en likvidator",
      ],
      statusReason: solvent
        ? "Det snabba avyttringsvärdet täcker skulderna - frivillig likvidation är möjlig."
        : `Skuldtäckningen är ${coverage === null ? "okänd" : `${coverage} %`} - frivillig likvidation kräver full täckning, så vägen kräver mer än läget medger just nu.`,
    });
  }

  /* Konkurs - en väg bland de andra, sakligt beskriven. */
  {
    paths.push({
      id: "konkurs",
      title: "Konkurs",
      status: "open",
      summary:
        "Det ordnade avslutet när skulderna inte kan bäras: en förvaltare tar över, lönegarantin skyddar de anställda och rätt hanterad begränsar den styrelsens risker i stället för att öka dem.",
      requires: [
        "Beslut och egen ansökan - den som väntar tills en borgenär ansöker förlorar kontrollen över tidpunkten",
        "Dokumenterat agerande fram till beslutet - det är underlaget som skyddar styrelsen",
      ],
      statusReason:
        "Vägen är alltid öppen. Poängen är att den ska vara ett aktivt val i rätt tid - inte något som hinner ikapp.",
    });
  }

  return paths.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
};

/* --- åtgärdskatalogen ------------------------------------------------------ */

export interface ActionCategory {
  id: string;
  title: string;
  /** Vad kategorin angriper. */
  intro: string;
  items: string[];
}

/**
 * Katalogen är en verktygslåda, inte en föreskrift. CLEARANCE resonerar:
 * "Det finns flera vägar framåt. Vi ska först förstå varför kassaflödet
 * är negativt, och därefter bedöma vilka åtgärder som är mest
 * realistiska för just ditt företag."
 */
export const ACTION_CATALOG: ActionCategory[] = [
  {
    id: "kassaflode",
    title: "Kassaflöde",
    intro: "Få in pengarna snabbare och ut dem långsammare - utan nya åtaganden.",
    items: [
      "Förhandla betalningsvillkor med leverantörer",
      "Påskynda kundinbetalningar - påminn, ring, erbjud delbetalning",
      "Fakturera snabbare: samma dag som arbetet är klart",
      "Minska kapitalbindningen i lager och pågående arbeten",
    ],
  },
  {
    id: "intakter",
    title: "Intäkter",
    intro: "Sälj mer av det som redan bär sig - kris är inte skäl att sluta sälja.",
    items: [
      "Kampanjer mot befintliga kunder",
      "Återaktivera gamla kunder",
      "Sälj serviceavtal - återkommande intäkter lugnar också banken",
      "Prisjusteringar där marknaden medger det",
    ],
  },
  {
    id: "finansiering",
    title: "Finansiering",
    intro: "Köp tid till rätt pris - och pröva behovet mot likviditetsplanen först.",
    items: [
      "Anstånd hos Skatteverket",
      "Bryggfinansiering mot säkerheter eller fordringar",
      "Ägartillskott eller aktieägarlån",
      "Rekonstruktion med skulduppgörelse, när det är lämpligt",
    ],
  },
  {
    id: "kostnader",
    title: "Kostnader",
    intro: "Skär där det inte blöder - kostnader som bär intäkter är inte besparingar.",
    items: [
      "Omförhandla hyror, leasing och abonnemang",
      "Effektivisera flöden innan tjänster sägs upp",
      "Tillfälliga besparingar med tydligt slutdatum",
    ],
  },
];

/** CLEARANCE:s hållning när alternativen efterfrågas - konstitutionens formulering. */
export const OPTIONS_STANCE =
  "Det finns flera vägar framåt. Vi ska först förstå varför kassaflödet är negativt, och därefter bedöma vilka åtgärder som är mest realistiska för just ditt företag.";

/* ==========================================================================
   src/lib/advisor/premiseWatch.ts
   ========================================================================== */

/**
 * Omprövningsbevakningen: premissen som något som faktiskt bevakas.
 *
 * Beslutsminnet har haft premissen sedan v1, och gränssnittet har lovat
 * att beslut "omprövas när läget ändras". Ingenting bevakade. Ett löfte
 * som produkten inte håller är värre än inget löfte - särskilt det här,
 * eftersom hela poängen med att protokollföra premissen är att veta NÄR
 * beslutet ska upp igen.
 *
 * Varför villkor och inte tolkning av fritexten: premissen är skriven på
 * svenska av en människa. Att gissa vad "prognosen visade positivt
 * kassaflöde inom sex veckor" betyder i siffror vore att hitta på - och
 * ett beslutsunderlag som hittar på är sämre än inget. I stället får
 * premissen ett MÄTBART villkor, valt ur de storheter ärendet faktiskt
 * mäter, och det villkoret räknas om deterministiskt.
 *
 * Tre tillstånd, aldrig fyra: villkoret HÅLLER, det är MOTSAGT, eller så
 * går det inte att avgöra för att uppgiften saknas. "Vet inte" sägs rakt
 * ut i stället för att tolkas som "allt är bra".
 *
 * Och: CLEARANCE omprövar aldrig ett beslut självt. Den flaggar, citerar
 * premissen och visar vad som ändrats. Beslutet är användarens.
 */

/* --- Storheterna som går att bevaka --------------------------------------- */

/**
 * Underlaget bevakningen läser. Samma siffror som lägesbilden och
 * handlingsplanen visar - bevakningen får aldrig ha en egen sanning om
 * ärendet.
 */
export interface PremiseFacts {
  /** Snabba avyttringsvärdet i procent av skulderna. */
  coverageRatio: number | null;
  totalDebt: number | null;
  canPaySalary: boolean | null;
  canPayTax: boolean | null;
  canPayRent: boolean | null;
  canPaySuppliers: boolean | null;
  passedDeadlines: number;
}

type SignalKind = "number" | "boolean";

interface SignalSpec {
  id: PremiseSignal;
  /** Hur storheten benämns mitt i en mening. */
  label: string;
  kind: SignalKind;
  /** Enhet efter talet, inklusive mellanrum om det behövs. */
  unit?: string;
  read: (facts: PremiseFacts) => number | boolean | null;
  /** Sant när ett HÖGRE tal är sämre (skuld, passerade frister). */
  higherIsWorse?: boolean;
  /**
   * Ordningen CLEARANCE föreslår i. Löner före skatt före likviditet:
   * det är allvarsordningen, samma som i handlingsplanen.
   */
  rank: number;
}

export const PREMISE_SIGNALS: readonly SignalSpec[] = [
  {
    id: "loner",
    label: "att lönerna går att betala",
    kind: "boolean",
    read: (f) => f.canPaySalary,
    rank: 1,
  },
  {
    id: "skatt",
    label: "att skatten går att betala",
    kind: "boolean",
    read: (f) => f.canPayTax,
    rank: 2,
  },
  {
    id: "skuldtackning",
    label: "skuldtäckningen",
    kind: "number",
    unit: " %",
    read: (f) => f.coverageRatio,
    rank: 3,
  },
  {
    id: "passerade_frister",
    label: "antalet passerade frister",
    kind: "number",
    unit: "",
    read: (f) => f.passedDeadlines,
    higherIsWorse: true,
    rank: 4,
  },
  {
    id: "hyra",
    label: "att hyran går att betala",
    kind: "boolean",
    read: (f) => f.canPayRent,
    rank: 5,
  },
  {
    id: "leverantorer",
    label: "att leverantörerna går att betala",
    kind: "boolean",
    read: (f) => f.canPaySuppliers,
    rank: 6,
  },
  {
    id: "skuld",
    label: "den totala skulden",
    kind: "number",
    unit: " kr",
    read: (f) => f.totalDebt,
    higherIsWorse: true,
    rank: 7,
  },
] as const;

export const signalSpec = (id: PremiseSignal): SignalSpec | null =>
  PREMISE_SIGNALS.find((s) => s.id === id) ?? null;

/* --- Formatering ---------------------------------------------------------- */

/**
 * Tal i svensk form, med hårt mellanrum så beloppet aldrig bryts över en
 * radbrytning.
 *
 * Både mönstret och ersättningen skrivs som \u00A0, aldrig som det
 * literala tecknet: en osynlig NBSP i källkoden ser ut som ett vanligt
 * mellanslag och har redan lurat den här kodbasen mer än en gång.
 * toLocaleString("sv-SE") kan dessutom ge antingen NBSP eller smalt NBSP
 * beroende på ICU-version, så båda normaliseras till samma tecken.
 */
export const formatSignalValue = (spec: SignalSpec, value: number | boolean): string => {
  if (typeof value === "boolean") return value ? "ja" : "nej";
  const grouped = Math.round(value)
    .toLocaleString("sv-SE")
    .replace(/[\u00A0\u202F\u2009]/g, "\u00A0");
  return `${grouped}${spec.unit ?? ""}`;
};

/**
 * Villkoret som mening. Skrivs så att den går att läsa högt i ett
 * styrelserum: "skuldtäckningen är minst 55 %".
 */
export const describeWatch = (watch: PremiseWatch): string => {
  const spec = signalSpec(watch.signal);
  if (!spec) return "Okänt villkor";
  if (watch.comparator === "sant") return `${capitalise(spec.label)}`;
  if (watch.comparator === "falskt") return `INTE ${spec.label}`;
  const word = watch.comparator === "minst" ? "minst" : "högst";
  return `${capitalise(spec.label)} är ${word} ${formatSignalValue(spec, watch.threshold ?? 0)}`;
};

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/* --- Utvärderingen -------------------------------------------------------- */

export type PremiseState = "holds" | "contradicted" | "unknown";

export interface PremiseEvaluation {
  state: PremiseState;
  /**
   * Vad som gäller NU, som mening. Används både i texten till användaren
   * och som kvitteringens fingeravtryck: ändras observationen kommer
   * frågan tillbaka, annars inte.
   */
  observation: string;
}

export const evaluatePremise = (
  watch: PremiseWatch | null,
  facts: PremiseFacts,
): PremiseEvaluation => {
  if (!watch) return { state: "unknown", observation: "Inget villkor är kopplat till premissen" };
  const spec = signalSpec(watch.signal);
  if (!spec) return { state: "unknown", observation: "Villkoret går inte att tolka" };

  const value = spec.read(facts);
  if (value === null || value === undefined) {
    return { state: "unknown", observation: `${capitalise(spec.label)} saknas i underlaget` };
  }

  const observation =
    spec.kind === "boolean"
      ? `${capitalise(spec.label)}: ${formatSignalValue(spec, value)}`
      : `${capitalise(spec.label)} är ${formatSignalValue(spec, value)}`;

  let holds: boolean;
  switch (watch.comparator) {
    case "sant":
      holds = value === true;
      break;
    case "falskt":
      holds = value === false;
      break;
    case "minst":
      holds = typeof value === "number" && value >= (watch.threshold ?? 0);
      break;
    case "hogst":
      holds = typeof value === "number" && value <= (watch.threshold ?? 0);
      break;
    default:
      return { state: "unknown", observation };
  }
  return { state: holds ? "holds" : "contradicted", observation };
};

/* --- Förslaget vid beslutstillfället -------------------------------------- */

/**
 * Villkor CLEARANCE kan föreslå, byggda ur det som gäller NU.
 *
 * Det är den avgörande finessen: vid beslutstillfället VET vi ärendets
 * värden, så användaren behöver inte hitta på ett tröskelvärde - hen
 * bekräftar det som redan är sant. Ett villkor som är motsagt redan när
 * det sätts vore meningslöst och föreslås aldrig.
 */
export const proposeWatches = (facts: PremiseFacts): PremiseWatch[] => {
  const out: PremiseWatch[] = [];
  for (const spec of [...PREMISE_SIGNALS].sort((a, b) => a.rank - b.rank)) {
    const value = spec.read(facts);
    if (value === null || value === undefined) continue;
    if (typeof value === "boolean") {
      out.push({ signal: spec.id, comparator: value ? "sant" : "falskt", threshold: null });
    } else if (spec.higherIsWorse) {
      out.push({ signal: spec.id, comparator: "hogst", threshold: value });
    } else {
      out.push({ signal: spec.id, comparator: "minst", threshold: value });
    }
  }
  return out;
};

/* --- Vad CLEARANCE säger när premissen inte längre håller ------------------ */

const MONTHS__advisor_premiseWatch = [
  "januari", "februari", "mars", "april", "maj", "juni",
  "juli", "augusti", "september", "oktober", "november", "december",
];

export const swedishDay = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS__advisor_premiseWatch[d.getMonth()]}`;
};

/**
 * Larmet: citerar beslutet, citerar premissen, säger vad som ändrats -
 * och lämnar båda dörrarna öppna. Aldrig "du bör ompröva": CLEARANCE
 * fattar inte bolagets beslut.
 */
export const premiseAlert = (input: {
  title: string;
  decidedAt: string;
  watch: PremiseWatch;
  evaluation: PremiseEvaluation;
}): string =>
  [
    `Den ${swedishDay(input.decidedAt)} beslutade ni: ”${input.title}”.`,
    `Villkoret ni satte var: ${describeWatch(input.watch).toLowerCase()}.`,
    `${input.evaluation.observation}.`,
    "Vill du ompröva beslutet, eller står det fast?",
  ].join(" ");

/* --- Sammanställningen ---------------------------------------------------- */

export interface WatchedDecision {
  id: string;
  title: string;
  premise: string | null;
  decidedAt: string;
  status: "active" | "reconsidered";
  watch: PremiseWatch | null;
  watchAckObservation: string | null;
}

export interface PremiseFlag {
  decisionId: string;
  title: string;
  decidedAt: string;
  watch: PremiseWatch;
  evaluation: PremiseEvaluation;
  message: string;
}

/**
 * De beslut vars villkor är motsagt och som inte redan kvitterats för
 * exakt den observationen.
 *
 * Kvitteringen är avsiktligt kopplad till OBSERVATIONEN, inte till
 * beslutet: den som svarat "det står fast" vid 42 % ska inte tjatas på
 * igen vid 42 %, men ska höra av oss igen vid 18 %. Ett "behåll" som
 * tystar för alltid vore ett sätt att tappa bort sitt eget beslut.
 */
export const premiseFlags = (
  decisions: readonly WatchedDecision[],
  facts: PremiseFacts,
): PremiseFlag[] => {
  const flags: PremiseFlag[] = [];
  for (const decision of decisions) {
    if (decision.status !== "active" || !decision.watch) continue;
    const evaluation = evaluatePremise(decision.watch, facts);
    if (evaluation.state !== "contradicted") continue;
    if (decision.watchAckObservation === evaluation.observation) continue;
    flags.push({
      decisionId: decision.id,
      title: decision.title,
      decidedAt: decision.decidedAt,
      watch: decision.watch,
      evaluation,
      message: premiseAlert({
        title: decision.title,
        decidedAt: decision.decidedAt,
        watch: decision.watch,
        evaluation,
      }),
    });
  }
  return flags;
};

/** Etiketten i listan över fattade beslut. Tre lägen, ingen fjärde. */
export const WATCH_STATE_LABEL: Record<PremiseState, string> = {
  holds: "Villkoret håller",
  contradicted: "Villkoret är motsagt",
  unknown: "Går inte att avgöra",
};

/** Villkoret som inte går att sätta: sägs rakt ut, döljs inte. */
export const NO_WATCH_LABEL = "Premissen bevakas inte";

export const isValidWatch = (watch: PremiseWatch): boolean => {
  const spec = signalSpec(watch.signal);
  if (!spec) return false;
  const numeric: PremiseComparator[] = ["minst", "hogst"];
  if (spec.kind === "number") {
    return numeric.includes(watch.comparator) && typeof watch.threshold === "number" && Number.isFinite(watch.threshold);
  }
  return (watch.comparator === "sant" || watch.comparator === "falskt") && watch.threshold === null;
};

/* ==========================================================================
   src/lib/advisor/prepare.ts
   ========================================================================== */

/**
 * FÖRBERED ANVÄNDAREN.
 *
 * Produktens övergångsprincip, och en bindande designregel: ingen ny vy
 * ska någonsin kännas oväntad.
 *
 * Skälet är målgruppen. För någon mitt i en ekonomisk kris är
 * FÖRUTSÄGBARHET viktigare än hastighet. Fyra frågor får aldrig lämnas
 * obesvarade när något ändras på skärmen:
 *
 *   Varför händer det här? · Vem ska se informationen? ·
 *   Vad kommer att hända nu? · Hur lång tid tar nästa steg?
 *
 * En övergång har därför fyra delar, alltid i den här ordningen:
 *
 *   1. DET HÄR ÄR KLART   - bekräfta vad som just slutfördes
 *   2. NU HÄNDER DETTA    - nästa steg i EN mening
 *   3. VARFÖR VI FRÅGAR   - syftet, så uppgiften inte känns godtycklig
 *   4. HUR LÅNG TID       - "cirka två minuter", "fyra steg kvar"
 *
 * Delarna 1 och 3 är de som skiljer principen från en vanlig
 * förloppsindikator: den som vet VAD som blev klart och VARFÖR nästa
 * fråga ställs upplever att systemet leder - inte att processen händer
 * med hen.
 *
 * Bekräftelsen i del 1 lyder under tonalitetsreglerna (tone.ts): den
 * säger vad som blev gjort, aldrig att någon var duktig.
 */

export interface Transition {
  /** 1. Vad som just slutfördes. Konkret, aldrig beröm. */
  done: string;
  /** 2. Nästa steg, i en mening. */
  next: string;
  /** 3. Varför uppgiften behövs - syftet, inte processen. */
  why: string;
  /** 4. Vad det kostar användaren: tid eller antal steg. */
  effort: string;
  /**
   * 5. Vem som får se det, när svaret delas med någon annan än
   * användaren själv. Utelämnas när ingen annan ser något - att skriva
   * "ingen annan ser detta" på varje steg blir brus som ingen läser.
   */
  audience?: string;
}

export const PREPARE_HEADINGS = {
  done: "Det här är klart",
  next: "Nu händer detta",
  why: "Därför frågar vi",
  effort: "Så lång tid tar det",
  audience: "Vem ser uppgifterna",
} as const;

/**
 * Övergången som text, i ordning. Används av gränssnittet och av
 * testerna - samma källa, så en regel inte kan hållas på ett ställe och
 * brytas på ett annat.
 */
export const prepareLines = (t: Transition): string[] =>
  [t.done, t.next, t.why, t.effort, t.audience].filter((line): line is string => !!line);

/* --- Övergångarna i produkten ---------------------------------------------- */

export type TransitionId =
  | "onboarding-till-nulage"
  | "nulage-foretag-till-betalningar"
  | "nulage-betalningar-till-skulder"
  | "nulage-skulder-till-bedomning"
  | "bedomning-till-arende";

export const TRANSITIONS: Record<TransitionId, Transition> = {
  "onboarding-till-nulage": {
    done: "Grunduppgifterna är på plats: kontaktperson, bolag och organisationsnummer.",
    next: "Nu går vi igenom ekonomin - betalningar, skulder och tillgångar.",
    why: "Utan siffrorna går det inte att säga vilka alternativ som faktiskt är öppna för just det här bolaget.",
    effort: "Det tar ungefär fem minuter, och du kan pausa när som helst.",
    audience: "Uppgifterna stannar hos dig tills du själv väljer att dela dem.",
  },
  "nulage-foretag-till-betalningar": {
    done: "Företagsuppgifterna är registrerade.",
    next: "Härnäst frågar vi vad som ska betalas den närmaste tiden: löner, skatt och hyra.",
    why: "Ordningen mellan betalningarna avgör både handlingsutrymmet och när ett personligt ansvar kan börja löpa.",
    effort: "Fyra frågor, ungefär två minuter.",
  },
  "nulage-betalningar-till-skulder": {
    done: "Betalningsbilden är klar.",
    next: "Nu handlar det om skulderna och vad tillgångarna är värda vid en snabb avyttring.",
    why: "Förhållandet mellan de två avgör om kontrollbalansräkning aktualiseras - och vilka vägar som står öppna.",
    effort: "Två frågor, under en minut.",
  },
  "nulage-skulder-till-bedomning": {
    done: "Alla uppgifter är inne.",
    next: "Systemet räknar nu igenom läget och visar en bedömning med de frister som gäller.",
    why: "Bedömningen är underlag för beslut - den räknas fram ur dina svar och går att följa steg för steg.",
    effort: "Det tar några sekunder.",
  },
  "bedomning-till-arende": {
    done: "Bedömningen är klar.",
    next: "Nästa steg är att spara den som ett ärende, så att frister bevakas och allt journalförs.",
    why: "Ett sparat ärende är det som gör att vi kan följa bolaget över tid i stället för att börja om vid varje besök.",
    effort: "Det tar ett klick.",
    audience: "Ärendet är ditt. Rådgivare ser det först när du bjuder in dem.",
  },
};

/* --- De fyra reglerna, som text och som kontrollerbara påståenden ---------- */

export const PREPARE_RULES = [
  "Ingen ny fråga utan en kort introduktion om ämnet.",
  "Ingen ny sektion utan ett övergångsmeddelande.",
  "Ingen extern kontroll eller datainsamling utan att användaren får veta vad som sker.",
  "Ingen väntetid utan att användaren får veta vad systemet arbetar med.",
] as const;

/**
 * Väntebesked enligt regel 3 och 4.
 *
 * Ett besked som bara säger "Hämtar…" svarar inte på någon av de fyra
 * frågorna. Det ska stå VAD som hämtas, VARIFRÅN och ungefär hur länge -
 * särskilt när uppgiften lämnar produkten, för då är det inte längre
 * bara väntan utan en extern kontroll användaren har rätt att känna till.
 */
export interface WaitNotice {
  /** Vad systemet gör just nu. */
  doing: string;
  /** Var uppgiften hämtas ifrån. Null när ingenting lämnar produkten. */
  source: string | null;
  /** Ungefärlig väntetid, i ord. */
  duration: string;
}

export const waitText = (w: WaitNotice): string =>
  [w.doing, w.source ? `Uppgifterna hämtas från ${w.source}.` : null, w.duration]
    .filter(Boolean)
    .join(" ");

export const WAITS = {
  companyLookup: {
    doing: "Hämtar företagets grunduppgifter.",
    source: "företagsregistret",
    duration: "Det tar några sekunder.",
  },
  documents: {
    doing: "Hämtar ärendets handlingar.",
    source: null,
    duration: "Det tar ett ögonblick.",
  },
  advisors: {
    doing: "Hämtar rådgivare som matchar ärendet.",
    source: "CLEARANCE katalog",
    duration: "Det tar ett ögonblick.",
  },
  documentHash: {
    doing: "Läser handlingen och räknar fram dess kontrollsumma.",
    source: null,
    duration: "Det tar några sekunder för en större fil.",
  },
  /**
   * Bakgrundsanalysen under introduktionssamtalet. Väntetiden är den
   * längsta i produkten, och den enda där användaren har något annat
   * att göra under tiden - desto viktigare att det står vad som pågår.
   */
  backgroundAnalysis: {
    doing: "Sätter ihop en första bild av företaget.",
    source: "företagsregistret och dina svar",
    duration: "Det tar några sekunder, och du kan svara på frågorna under tiden.",
  },
} as const satisfies Record<string, WaitNotice>;

/* --- Kontroller som testerna använder -------------------------------------- */

/** En övergång är komplett när alla fyra obligatoriska delar finns. */
export const isComplete = (t: Transition): boolean =>
  [t.done, t.next, t.why, t.effort].every((part) => typeof part === "string" && part.trim().length > 0);

/**
 * Del 4 ska vara KONKRET. "Det går snabbt" är inte ett svar på hur lång
 * tid det tar - ett tal, ett räkneord eller ett antal steg är det.
 *
 * Räkneorden står utskrivna eftersom texterna är det: "fem minuter"
 * läses bättre än "5 minuter" i löpande text, och vakten ska mäta det
 * som faktiskt står i produkten.
 *
 * Gränsen före räkneordet skrivs som "inte en bokstav" med u-flaggan i
 * stället för \b. Ett ASCII-ordgränsankare ser inte å, ä och ö som
 * bokstäver, och skulle därför missa just de ord som är svenska.
 */
export const hasConcreteEffort = (t: Transition): boolean =>
  /(?:^|[^\p{L}])(?:\d+|en|ett|två|tre|fyra|fem|sex|sju|åtta|nio|tio|några)\s+(?:sekund|minut|steg|fråg|klick|ögonblick)/iu.test(
    t.effort,
  );

/**
 * Del 3 ska förklara SYFTET, inte upprepa vad som händer. Den enklaste
 * kontrollen som fångar upprepningen: motiveringen får inte vara samma
 * mening som nästa steg, och den ska säga något om vad svaret används
 * till.
 */
export const explainsPurpose = (t: Transition): boolean =>
  t.why.trim() !== t.next.trim() &&
  /avgör|används|behövs|går det inte att|går inte att|underlag|bedöm|följa|kan börja|styr/i.test(
    t.why,
  );

/* ==========================================================================
   src/lib/advisor/tone.ts
   ========================================================================== */

/**
 * Tonaliteten: hur CLEARANCE låter, som kod i stället för som ambition.
 *
 * Två regler bor här, och båda är testade (tests/tone.ts):
 *
 *  1. **Bekräftelser ska vara förankrade i vad användaren faktiskt har
 *     gjort eller bidragit med.** "Bra jobbat!" säger ingenting om
 *     arbetet - det säger bara att någon vill vara trevlig. En
 *     företagare mitt i en kris hör skillnaden direkt, och tom beröm
 *     kostar förtroende i exakt det ögonblick förtroendet behövs.
 *  2. **Empati utan sentimentalitet.** Många företagsledare vill inte
 *     bli omhändertagna. De vill bli förstådda och sedan hjälpta.
 *
 * Skillnaden i praktiken: en förankrad bekräftelse berättar vad
 * bidraget gjorde för ARBETET ("det här minskar osäkerheten i den
 * fortsatta analysen"), inte vad det säger om PERSONEN ("du verkar
 * väldigt kunnig"). Den första går att kontrollera. Den andra är en
 * åsikt om någon vi aldrig har träffat.
 */

/** CLEARANCE:s personlighet, som lista - för att den ska gå att bryta mot. */
export const PERSONALITY = [
  "Professionell och lugn",
  "Empatisk utan att bli känslosam",
  "Tydlig och effektiv",
  "Driver processen framåt med korta, konkreta steg",
  "Ställer bara frågor som har ett tydligt syfte",
  "Bekräftar framsteg löpande",
] as const;

/**
 * Vad användaren just bidrog med. Bekräftelsen väljs efter BIDRAGET,
 * aldrig efter behovet av att säga något trevligt.
 */
export type Contribution =
  | "uppgift"
  | "siffror"
  | "beslut"
  | "beskrivning"
  | "dokument";

/**
 * De förankrade bekräftelserna. Var och en säger vad bidraget gjorde
 * för underlaget - det är det som gör den kontrollerbar.
 */
export const GROUNDED_CONFIRMATION: Record<Contribution, string> = {
  uppgift: "Det här är värdefull information.",
  siffror: "Nu har vi ett betydligt bättre beslutsunderlag.",
  beslut: "Det här minskar osäkerheten i den fortsatta analysen.",
  beskrivning:
    "Du beskriver verksamheten med en detaljnivå som ger en tydligare bild av situationen.",
  dokument: "Med handlingen på plats vilar bedömningen på underlag i stället för minne.",
};

export const confirmContribution = (kind: Contribution): string =>
  GROUNDED_CONFIRMATION[kind];

/**
 * Orden som gör en bekräftelse förankrad: den pekar på arbetet, inte på
 * personen. Testet kräver att varje bekräftelse innehåller minst ett.
 */
export const GROUNDING_ANCHORS = [
  "information",
  "beslutsunderlag",
  "underlag",
  "analys",
  "bild av situationen",
  "bedömning",
] as const;

export const isGrounded = (text: string): boolean =>
  GROUNDING_ANCHORS.some((anchor) => text.toLowerCase().includes(anchor));

/**
 * Tom beröm: fraser som berömmer utan att säga vad som var bra. Varje
 * post har en ersättare, för att en regel utan alternativ bara blir en
 * tom lucka i texten.
 *
 * Den här filen är med flit undantagen från filsökningen i tests/tone.ts -
 * det är här fraserna får stå, just för att de ska gå att förbjuda.
 */
export const EMPTY_PRAISE: readonly { pattern: RegExp; instead: string }[] = [
  { pattern: /\bbra jobbat\b/i, instead: GROUNDED_CONFIRMATION.uppgift },
  // "Bra arbetat" satt kvar i samtalsavslutet efter första ronden, för
  // att mönstret bara sökte efter "jobbat". En regel är exakt så bra som
  // dess formuleringar - därför står varianterna här, inte i huvudet.
  { pattern: /\bbra arbetat\b/i, instead: GROUNDED_CONFIRMATION.uppgift },
  { pattern: /\bvad bra\b/i, instead: GROUNDED_CONFIRMATION.uppgift },
  { pattern: /\bperfekt\b/i, instead: GROUNDED_CONFIRMATION.siffror },
  { pattern: /\bdu gör rätt\b/i, instead: GROUNDED_CONFIRMATION.beslut },
  { pattern: /\bdu verkar (väldigt |mycket )?kunnig\b/i, instead: GROUNDED_CONFIRMATION.beskrivning },
  { pattern: /\bvad duktig\b/i, instead: GROUNDED_CONFIRMATION.uppgift },
  { pattern: /\bsnyggt jobbat\b/i, instead: GROUNDED_CONFIRMATION.uppgift },
  { pattern: /\bkanon\b/i, instead: GROUNDED_CONFIRMATION.siffror },
  { pattern: /\bgrymt\b/i, instead: GROUNDED_CONFIRMATION.siffror },
];

/** Den första tomma berömmen i texten, eller null. Används av testet. */
export const emptyPraiseIn = (text: string): string | null => {
  for (const { pattern } of EMPTY_PRAISE) {
    const hit = text.match(pattern);
    if (hit) return hit[0];
  }
  return null;
};

/** Vad man ska säga i stället. Null när frasen inte är förbjuden. */
export const insteadOf = (phrase: string): string | null =>
  EMPTY_PRAISE.find(({ pattern }) => pattern.test(phrase))?.instead ?? null;

/**
 * Sentimentaliteten som togs bort ur onboardingen. Kvar som regel, inte
 * som minne: "du är inte ensam" och "det kan kännas överväldigande" är
 * omtanke som talar om känslan i stället för om arbetet.
 */
/*
 * Obs: \b räknar bara ASCII som ordtecken. Ett mönster som börjar på å,
 * ä eller ö får därför ALDRIG en inledande \b - gränsen finns inte, och
 * mönstret matchar tyst ingenting. Därför står "överväldigande" utan.
 */
export const SENTIMENTAL = [
  /\bdu är inte ensam\b/i,
  /överväldigande/i,
  /\bjag är så ledsen\b/i,
  /\bstackars\b/i,
] as const;

export const sentimentalIn = (text: string): string | null => {
  for (const pattern of SENTIMENTAL) {
    const hit = text.match(pattern);
    if (hit) return hit[0];
  }
  return null;
};

/* ==========================================================================
   src/lib/auditDetail.ts
   ========================================================================== */

/**
 * Händelseloggens läsbarhet: detaljraden och systemsammanfattningen.
 *
 * "Uppgift i handlingsplanen skapades" utan att säga VILKEN uppgift är en
 * logg som ser ut som underlag men inte duger som det. Detaljraden härleds
 * ur radens before/after-innehåll - uppgiftens text, dokumentets filnamn,
 * deltagarens roll - så att loggen går att läsa som ett förlopp, inte bara
 * som en räkning.
 *
 * Systemsammanfattningen överst är samma mönster som övriga analyser:
 * deterministisk, testbar mening för mening. Den svarar på frågorna en
 * läsare (styrelsen, revisorn, en förvaltare) ställer först: vilken period
 * täcker loggen, hur mycket har hänt, vilka juridiska milstolpar är
 * dokumenterade, och när hände något senast.
 */

type Payload = Record<string, unknown> | null;

const str = (payload: Payload, key: string): string | null => {
  const value = payload?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};

/**
 * Detaljraden: vad exakt händelsen gällde. null när innehållet inte bär
 * något läsbart - hellre ingen rad än en rad som gissar.
 */
export const deriveAuditDetail = (
  objectType: string,
  action: string,
  before: Payload,
  after: Payload,
): string | null => {
  const row = after ?? before;
  if (!row) return null;

  switch (objectType) {
    case "case_tasks": {
      const label = str(row, "label");
      if (!label) return null;
      if (action === "update") {
        const doneNow = (after?.done_at ?? null) !== null;
        const doneBefore = (before?.done_at ?? null) !== null;
        if (doneNow && !doneBefore) return `"${label}" bockades av`;
        if (!doneNow && doneBefore) return `"${label}" återöppnades`;
      }
      return `"${label}"`;
    }
    case "case_documents": {
      const name = str(row, "file_name");
      const note = str(row, "note");
      return name ? (note ? `${name} (${note.toLowerCase()})` : name) : null;
    }
    case "case_invitations": {
      const email = str(row, "email");
      const role = str(row, "role") as CaseRole | null;
      const roleLabel = role ? CASE_ROLE_LABELS[role]?.toLowerCase() : null;
      if (!email) return null;
      if (action === "update") {
        if ((after?.accepted_at ?? null) !== null && (before?.accepted_at ?? null) === null)
          return `${email} tackade ja`;
        if ((after?.revoked_at ?? null) !== null && (before?.revoked_at ?? null) === null)
          return `inbjudan till ${email} återkallades`;
        if ((after?.email_enqueued_at ?? null) !== null && (before?.email_enqueued_at ?? null) === null)
          return `inbjudningsmejlet till ${email} skickades`;
      }
      return roleLabel ? `${email} som ${roleLabel}` : email;
    }
    case "case_members": {
      const role = str(row, "role") as CaseRole | null;
      const roleLabel = role ? CASE_ROLE_LABELS[role] : null;
      if (action === "update" && (after?.revoked_at ?? null) !== null)
        return roleLabel ? `${roleLabel.toLowerCase()}ens åtkomst återkallades` : "åtkomst återkallades";
      return roleLabel ? `roll: ${roleLabel.toLowerCase()}` : null;
    }
    case "conversations": {
      const title = str(row, "title");
      const kind = str(row, "kind");
      if ((after?.merged_into ?? null) !== null && (before?.merged_into ?? null) === null)
        return title ? `"${title}" slogs ihop med en annan tråd` : "tråden slogs ihop";
      if (title) return `gruppen "${title}"`;
      return kind === "direct" ? "direkt tråd" : null;
    }
    case "kbr_assessments": {
      const status = str(row, "status");
      const statusLabel: Record<string, string> = {
        not_required: "ej påkallad",
        warning: "varningszon",
        required: "krävs",
        critical: "kritisk",
      };
      return status ? `bedömning: ${statusLabel[status] ?? status}` : null;
    }
    case "payments": {
      const label = str(row, "label");
      const amount = row?.["amount"];
      const kr =
        typeof amount === "number"
          ? `${String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`
          : null;
      if (label && kr) return `${label}, ${kr}`;
      return label ?? kr;
    }
    case "invoices": {
      const label = str(row, "description") ?? str(row, "label");
      return label;
    }
    case "cases": {
      const company = str(row, "company_name");
      const org = str(row, "org_number");
      return company ? `${company}${org ? ` (${org})` : ""}` : org;
    }
    default:
      return null;
  }
};

/** Systemsammanfattningens rader, i läsordning. */
export const summarizeAuditTrail = (events: AuditEventRecord[], now: Date): string[] => {
  if (events.length === 0) return ["Inga händelser är loggade ännu."];

  const lines: string[] = [];
  const byTime = [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const first = byTime[0];
  const last = byTime[byTime.length - 1];

  const day = (iso: string) =>
    new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });

  lines.push(
    first.occurredAt.slice(0, 10) === last.occurredAt.slice(0, 10)
      ? `Loggen omfattar ${events.length} händelser, samtliga den ${day(first.occurredAt)}.`
      : `Loggen omfattar ${events.length} händelser mellan ${day(first.occurredAt)} och ${day(last.occurredAt)}.`,
  );

  // Volym per område, i fallande ordning.
  const CATEGORY: Record<string, string> = {
    case_tasks: "uppgifter",
    case_documents: "dokument",
    case_members: "deltagare",
    case_invitations: "inbjudningar",
    case_messages: "meddelanden",
    conversations: "trådar",
    kbr_assessments: "kontrollbalans",
    payments: "betalningar",
    invoices: "fakturor",
    cases: "ärendet",
  };
  const counts = new Map<string, number>();
  for (const e of events) {
    const label = CATEGORY[e.objectType] ?? e.objectType;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const breakdown = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, n]) => `${n} ${label}`)
    .join(", ");
  lines.push(`Fördelning: ${breakdown}.`);

  // Juridiska milstolpar - det en granskare letar efter först.
  const milestones: string[] = [];
  if (events.some((e) => e.objectType === "kbr_assessments"))
    milestones.push("kontrollbalansbedömning är registrerad");
  if (events.some((e) => e.objectType === "case_documents" && e.detail?.includes("genererad mall")))
    milestones.push("styrelsebeslut är protokollfört och sparat i akten");
  if (events.some((e) => e.objectType === "case_invitations"))
    milestones.push("deltagare har bjudits in till ärendet");
  if (milestones.length > 0) {
    lines.push(
      `Dokumenterade milstolpar: ${milestones.join("; ")}.`,
    );
  } else {
    lines.push(
      "Inga juridiska milstolpar är dokumenterade ännu – kontrollbalansbedömningen och protokollförda beslut syns här när de görs.",
    );
  }

  // Vem har agerat.
  const roles = new Map<string, number>();
  for (const e of events) {
    if (!e.actorRole) continue;
    const label = CASE_ROLE_LABELS[e.actorRole] ?? e.actorRole;
    roles.set(label, (roles.get(label) ?? 0) + 1);
  }
  if (roles.size > 0) {
    lines.push(
      `Aktivitet per roll: ${[...roles.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([label, n]) => `${label.toLowerCase()} ${n}`)
        .join(", ")}.`,
    );
  }

  // Senaste aktivitet, relativt.
  const daysSince = Math.floor(
    (now.getTime() - new Date(last.occurredAt).getTime()) / (24 * 60 * 60 * 1000),
  );
  lines.push(
    daysSince <= 0
      ? "Senaste händelsen loggades idag."
      : daysSince === 1
        ? "Senaste händelsen loggades igår."
        : `Senaste händelsen loggades för ${daysSince} dagar sedan.`,
  );

  return lines;
};

/* ==========================================================================
   src/lib/authErrors.ts
   ========================================================================== */

/**
 * Turns an auth error into something a user can act on.
 *
 * The fallback used to return the raw message, which meant a network failure
 * put the browser's own "Failed to fetch" in front of someone trying to sign
 * in - English, technical, and no hint that the problem is connectivity
 * rather than their password.
 */
export const translateAuthError = (message: string): string => {
  const lower = message.toLowerCase();

  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("load failed") ||
    lower.includes("err_") ||
    lower.includes("timeout")
  ) {
    return "Vi kunde inte nå servern. Kontrollera din internetanslutning och försök igen.";
  }

  if (message.includes("Invalid login credentials")) {
    return "Fel e-postadress eller lösenord.";
  }
  if (message.includes("User already registered")) {
    return "Det finns redan ett konto med den e-postadressen. Logga in istället.";
  }
  if (message.includes("Password should be at least")) {
    return "Lösenordet måste vara minst 6 tecken.";
  }
  if (message.includes("Unable to validate email address")) {
    return "Ogiltig e-postadress.";
  }
  if (lower.includes("email not confirmed")) {
    return "E-postadressen är inte bekräftad än. Leta efter bekräftelsemejlet i din inkorg.";
  }
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "För många försök. Vänta en stund innan du försöker igen.";
  }

  // Anything unrecognised: say what we know rather than nothing, but do not
  // pretend the raw text is a Swedish explanation.
  return `Något gick fel vid inloggningen. Försök igen. (${message})`;
};

/* ==========================================================================
   src/lib/bankStatement.ts
   ========================================================================== */

/**
 * Parsing of bank statement exports (kontoutdrag).
 *
 * Swedish banks all export CSV, but none of them agree on the columns, the
 * delimiter, the number format or the text encoding. Rather than hard-code one
 * layout per bank - which breaks the moment a bank renames a column - this
 * resolves the columns by matching the header against ranked keyword lists.
 * That covers the common exports from Swedbank, SEB, Nordea, Handelsbanken and
 * Länsförsäkringar without knowing which one it is looking at.
 *
 * Everything here is pure and runs in the browser: an uploaded statement is
 * read and interpreted locally, and nothing is sent anywhere unless the user
 * separately chooses to save the file.
 */

export type StatementDirection = "in" | "out";

export interface BankTransaction {
  /** ISO date, yyyy-MM-dd */
  date: string;
  description: string;
  /** Negative for money leaving the account. */
  amount: number;
  /** Account balance after the transaction, when the export includes it. */
  balance: number | null;
}

export interface SkippedRow {
  /** 1-based line number in the uploaded file. */
  line: number;
  reason: string;
}

export interface ColumnMapping {
  date: string;
  description: string;
  amount: string;
  balance: string | null;
}

export interface ParsedStatement {
  transactions: BankTransaction[];
  /** Which header each field was read from, so the user can check the mapping. */
  columns: ColumnMapping;
  delimiter: string;
  skipped: SkippedRow[];
}

export type ParseOutcome =
  | { ok: true; statement: ParsedStatement }
  | { ok: false; error: string };

/* -------------------------------------------------------------------------- */
/* Text decoding                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Bank exports are about as likely to be Windows-1252 as UTF-8, and decoding
 * the wrong one turns every "å ä ö" into replacement characters. Try UTF-8
 * strictly first; fall back to Windows-1252 when it is not valid UTF-8.
 */
export const decodeStatementBytes = (bytes: ArrayBuffer): string => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
};

/* -------------------------------------------------------------------------- */
/* CSV tokenising                                                             */
/* -------------------------------------------------------------------------- */

const DELIMITERS = [";", ",", "\t", "|"] as const;

/** Splits one CSV line, honouring double-quoted fields and "" escapes. */
export const splitCsvLine = (line: string, delimiter: string): string[] => {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
};

/** Picks the delimiter that yields the most columns on the candidate header. */
const detectDelimiter = (line: string): string => {
  let best = ";";
  let bestCount = 0;

  for (const delimiter of DELIMITERS) {
    const count = splitCsvLine(line, delimiter).length;
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }

  return best;
};

/* -------------------------------------------------------------------------- */
/* Value parsing                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Parses the amount formats that turn up in Swedish exports: "1 234,56",
 * "1.234,56", "1234.56", "-1 234,56", "1 234,56-" (trailing sign) and
 * "(1 234,56)". Non-breaking spaces are common and are treated as separators.
 * Returns null when the cell is not a number at all.
 */
export const parseAmount__bankStatement = (raw: string): number | null => {
  let value = raw.trim();
  if (!value) return null;

  let negative = false;

  // Accounting-style parentheses.
  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1);
  }

  // Trailing sign, as used by some ledger exports.
  if (value.endsWith("-")) {
    negative = true;
    value = value.slice(0, -1);
  }

  // Strip currency codes, symbols, and all flavours of space.
  value = value
    .replace(/\u2212/g, "-") // unicode minus
    .replace(/[\s\u00a0\u202f]/g, "")
    .replace(/(?:kr|sek|:-)/gi, "");

  if (value.startsWith("-")) {
    negative = true;
    value = value.slice(1);
  } else if (value.startsWith("+")) {
    value = value.slice(1);
  }

  if (!value) return null;

  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    // Whichever comes last is the decimal separator; the other groups digits.
    if (lastComma > lastDot) {
      value = value.replace(/\./g, "").replace(",", ".");
    } else {
      value = value.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    // A single comma is a decimal separator unless it groups exactly three
    // trailing digits with more than one group ("1,234,567").
    const decimals = value.length - lastComma - 1;
    value = decimals === 3 && value.split(",").length > 2
      ? value.replace(/,/g, "")
      : value.replace(",", ".");
  } else if (lastDot >= 0) {
    const decimals = value.length - lastDot - 1;
    if (decimals === 3 && value.split(".").length > 2) {
      value = value.replace(/\./g, "");
    }
  }

  if (!/^\d*\.?\d+$/.test(value)) return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;

  return negative ? -parsed : parsed;
};

const isValidYmd = (year: number, month: number, day: number): boolean => {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
};

const toIso__bankStatement = (year: number, month: number, day: number): string =>
  `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/**
 * Parses the date formats banks export: 2024-01-15, 2024/01/15, 15.01.2024,
 * 240115, optionally followed by a time. Ambiguous day/month order is only
 * resolved when one of the two values is above 12; otherwise the leading
 * value is taken as the day, which is the Swedish convention.
 */
export const parseStatementDate = (raw: string): string | null => {
  const value = raw.trim().split(/[T ]/)[0];
  if (!value) return null;

  const iso = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    return isValidYmd(year, month, day) ? toIso__bankStatement(year, month, day) : null;
  }

  const dmy = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    const [, a, b, y] = dmy;
    const year = Number(y);
    let day = Number(a);
    let month = Number(b);
    if (day <= 12 && month > 12) {
      [day, month] = [month, day];
    }
    return isValidYmd(year, month, day) ? toIso__bankStatement(year, month, day) : null;
  }

  const compact = value.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (compact) {
    const [, y, m, d] = compact;
    // Statements are historical documents; a two-digit year is this century.
    const year = 2000 + Number(y);
    const month = Number(m);
    const day = Number(d);
    return isValidYmd(year, month, day) ? toIso__bankStatement(year, month, day) : null;
  }

  return null;
};

/* -------------------------------------------------------------------------- */
/* Column resolution                                                          */
/* -------------------------------------------------------------------------- */

const normaliseHeader = (header: string): string =>
  header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

/**
 * Ranked candidates, most specific first. "bokforingsdag" beats a bare
 * "datum", and "valutadag" is last because it is the settlement date rather
 * than the date the money moved.
 */
const HEADER_CANDIDATES = {
  date: [
    "bokforingsdag",
    "bokforingsdatum",
    "transaktionsdag",
    "transaktionsdatum",
    "reskontradatum",
    "bookingdate",
    "datum",
    "date",
    "valutadag",
    "valutadatum",
  ],
  description: [
    "beskrivning",
    "rubrik",
    "text",
    "meddelande",
    "narrative",
    "description",
    "referens",
    "reference",
    "mottagare",
    "avsandare",
    "namn",
    "motpart",
    "payee",
  ],
  amount: ["belopp", "amount", "summa", "transaktionsbelopp", "value"],
  balance: ["bokfortsaldo", "saldo", "balance", "bokfortsaldoefter"],
} as const;

const resolveColumn = (
  headers: string[],
  candidates: readonly string[],
): number => {
  const normalised = headers.map(normaliseHeader);

  // Exact match on the highest-ranked candidate wins.
  for (const candidate of candidates) {
    const index = normalised.indexOf(candidate);
    if (index >= 0) return index;
  }

  // Then a containment match, still in candidate rank order.
  for (const candidate of candidates) {
    const index = normalised.findIndex((header) => header.includes(candidate));
    if (index >= 0) return index;
  }

  return -1;
};

/* -------------------------------------------------------------------------- */
/* Parsing                                                                    */
/* -------------------------------------------------------------------------- */

const MAX_ROWS = 20000;

/**
 * Reads a bank statement CSV. Returns a message rather than throwing when the
 * file cannot be interpreted - the caller shows it to the user, who then has
 * the option of entering the figures by hand.
 */
export const parseBankStatement = (text: string): ParseOutcome => {
  const lines = text
    .split(/\r\n|\n|\r/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return {
      ok: false,
      error: "Filen innehåller inga rader att läsa. Kontrollera att du laddat upp ett CSV-utdrag.",
    };
  }

  // Banks put account details above the table, so look for the header row
  // rather than assuming it is first.
  let headerIndex = -1;
  let delimiter = ";";
  let headers: string[] = [];

  for (let i = 0; i < Math.min(lines.length, 25); i += 1) {
    const candidateDelimiter = detectDelimiter(lines[i]);
    const cells = splitCsvLine(lines[i], candidateDelimiter);
    if (cells.length < 2) continue;

    const dateIndex = resolveColumn(cells, HEADER_CANDIDATES.date);
    const amountIndex = resolveColumn(cells, HEADER_CANDIDATES.amount);
    if (dateIndex >= 0 && amountIndex >= 0) {
      headerIndex = i;
      delimiter = candidateDelimiter;
      headers = cells;
      break;
    }
  }

  if (headerIndex < 0) {
    return {
      ok: false,
      error:
        "Kunde inte hitta en rubrikrad med datum och belopp. Exportera kontoutdraget som CSV från din bank och försök igen.",
    };
  }

  const dateIndex = resolveColumn(headers, HEADER_CANDIDATES.date);
  const amountIndex = resolveColumn(headers, HEADER_CANDIDATES.amount);
  const balanceIndex = resolveColumn(headers, HEADER_CANDIDATES.balance);
  let descriptionIndex = resolveColumn(headers, HEADER_CANDIDATES.description);

  // Never read the description out of a column already used for something
  // else - "Referens" and "Belopp" can both match loosely.
  if (
    descriptionIndex === dateIndex ||
    descriptionIndex === amountIndex ||
    descriptionIndex === balanceIndex
  ) {
    descriptionIndex = -1;
  }

  const transactions: BankTransaction[] = [];
  const skipped: SkippedRow[] = [];

  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    if (transactions.length >= MAX_ROWS) {
      skipped.push({
        line: i + 1,
        reason: `Filen är längre än ${MAX_ROWS} rader – resten lästes inte in.`,
      });
      break;
    }

    const cells = splitCsvLine(lines[i], delimiter);
    const date = parseStatementDate(cells[dateIndex] ?? "");
    if (!date) {
      skipped.push({ line: i + 1, reason: "Ogiltigt datum" });
      continue;
    }

    const amount = parseAmount__bankStatement(cells[amountIndex] ?? "");
    if (amount === null) {
      skipped.push({ line: i + 1, reason: "Ogiltigt belopp" });
      continue;
    }

    const balance = balanceIndex >= 0 ? parseAmount__bankStatement(cells[balanceIndex] ?? "") : null;
    const description =
      descriptionIndex >= 0 ? (cells[descriptionIndex] ?? "").trim() : "";

    transactions.push({
      date,
      description: description || "Ingen beskrivning",
      amount,
      balance,
    });
  }

  if (transactions.length === 0) {
    return {
      ok: false,
      error:
        "Rubrikraden hittades men ingen rad kunde läsas som en transaktion. Kontrollera att filen inte är tom eller filtrerad.",
    };
  }

  return {
    ok: true,
    statement: {
      transactions,
      columns: {
        date: headers[dateIndex],
        description: descriptionIndex >= 0 ? headers[descriptionIndex] : "(ingen)",
        amount: headers[amountIndex],
        balance: balanceIndex >= 0 ? headers[balanceIndex] : null,
      },
      delimiter,
      skipped,
    },
  };
};

/* -------------------------------------------------------------------------- */
/* Summary and recurring-payment detection                                    */
/* -------------------------------------------------------------------------- */

export type SuggestedCategory =
  | "salary"
  | "tax"
  | "rent"
  | "loan"
  | "supplier"
  | "income"
  | "other";

export interface RecurringSuggestion {
  label: string;
  /** Positive magnitude; use `direction` for the sign. */
  amount: number;
  direction: StatementDirection;
  /** Typical day of the month the transaction lands on. */
  dayOfMonth: number;
  /** How many distinct months it appeared in. */
  months: number;
  category: SuggestedCategory;
}

export interface StatementSummary {
  /** ISO date of the earliest transaction. */
  from: string;
  /** ISO date of the latest transaction. */
  to: string;
  transactionCount: number;
  /** Balance before the first transaction, when the export includes balances. */
  openingBalance: number | null;
  /** Balance after the last transaction, when the export includes balances. */
  closingBalance: number | null;
  totalIn: number;
  totalOut: number;
  /** Distinct calendar months covered by the statement. */
  monthsCovered: number;
  recurring: RecurringSuggestion[];
}

const CATEGORY_KEYWORDS: { category: SuggestedCategory; patterns: RegExp }[] = [
  { category: "salary", patterns: /\b(lon|loner|lonekorning|salary|payroll)\b/ },
  {
    category: "tax",
    patterns: /(skatteverket|skattekonto|moms|arbetsgivaravgift|preliminarskatt|f-skatt|fskatt|arbetsgivardeklaration)/,
  },
  { category: "rent", patterns: /(hyra|lokalhyra|hyresavi|fastighet)/ },
  {
    category: "loan",
    patterns: /(amortering|ranta|lan\b|leasing|kredit|avbetalning)/,
  },
];

/**
 * Month names and periods, stripped before grouping. Without this, "L\u00f6ner
 * januari" and "L\u00f6ner februari" are two different payments and the salary
 * run - usually the largest recurring cost in the statement - is never
 * detected. Short forms are included because banks truncate descriptions.
 */
const PERIOD_WORDS =
  /\b(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|okt|nov|dec|kvartal|kv|vecka|manad|halvar|ar)\b/g;

/** Strips the parts of a bank description that change every month. */
const normaliseDescription = (description: string): string =>
  description
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\d/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(PERIOD_WORDS, " ")
    .replace(/\s+/g, " ")
    .trim();

const guessCategory = (
  description: string,
  direction: StatementDirection,
): SuggestedCategory => {
  if (direction === "in") return "income";

  const normalised = normaliseDescription(description);
  for (const { category, patterns } of CATEGORY_KEYWORDS) {
    if (patterns.test(normalised)) return category;
  }

  return "supplier";
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

/** How far an individual amount may deviate from the group median. */
const AMOUNT_TOLERANCE = 0.25;

/**
 * Summarises a statement and proposes which payments look recurring, so the
 * liquidity plan can be pre-filled instead of typed from scratch.
 *
 * A payment counts as recurring when the same normalised description appears
 * in at least two different calendar months with amounts within 25% of the
 * median. That is deliberately conservative: a wrong suggestion the user has
 * to notice and delete is worse than a missing one they add themselves.
 */
export const summariseStatement = (
  transactions: BankTransaction[],
): StatementSummary | null => {
  if (transactions.length === 0) return null;

  const sorted = [...transactions].sort((a, b) =>
    a.date === b.date ? 0 : a.date < b.date ? -1 : 1,
  );

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const totalIn = sorted
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  const totalOut = sorted
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum - t.amount, 0);

  const months = new Set(sorted.map((t) => t.date.slice(0, 7)));

  // The opening balance is the balance after the first transaction, less that
  // transaction - the export only records balances after each movement.
  const openingBalance =
    first.balance === null ? null : first.balance - first.amount;

  // Group by normalised description and direction.
  const groups = new Map<string, BankTransaction[]>();
  for (const transaction of sorted) {
    const key = `${transaction.amount < 0 ? "out" : "in"}|${normaliseDescription(
      transaction.description,
    )}`;
    if (!key.endsWith("|")) {
      const existing = groups.get(key);
      if (existing) existing.push(transaction);
      else groups.set(key, [transaction]);
    }
  }

  const recurring: RecurringSuggestion[] = [];

  for (const group of groups.values()) {
    const groupMonths = new Set(group.map((t) => t.date.slice(0, 7)));
    if (groupMonths.size < 2) continue;

    const magnitudes = group.map((t) => Math.abs(t.amount));
    const typical = median(magnitudes);
    if (typical <= 0) continue;

    const consistent = magnitudes.every(
      (value) => Math.abs(value - typical) <= typical * AMOUNT_TOLERANCE,
    );
    if (!consistent) continue;

    const direction: StatementDirection = group[0].amount < 0 ? "out" : "in";
    const dayOfMonth = Math.round(
      median(group.map((t) => Number(t.date.slice(8, 10)))),
    );

    recurring.push({
      // Show the description as the bank wrote it, not the normalised key.
      label: group[group.length - 1].description,
      amount: Math.round(typical),
      direction,
      dayOfMonth: Math.min(Math.max(dayOfMonth, 1), 31),
      months: groupMonths.size,
      category: guessCategory(group[0].description, direction),
    });
  }

  recurring.sort((a, b) => b.amount - a.amount);

  return {
    from: first.date,
    to: last.date,
    transactionCount: sorted.length,
    openingBalance,
    closingBalance: last.balance,
    totalIn: Math.round(totalIn),
    totalOut: Math.round(totalOut),
    monthsCovered: months.size,
    recurring,
  };
};

/* ==========================================================================
   src/lib/billing.ts
   ========================================================================== */

/**
 * Kontots livscykel.
 *
 * Beslutad modell: det är gratis att komma igång. Betalar kunden inte inom en
 * vecka stängs kontot.
 *
 * Jag invände mot den en gång, den bekräftades, och då är den bestämd. Det
 * som återstår är att bygga den så att den gör vad den ska och inte något
 * värre. Två saker följer av det, och båda sitter i koden här:
 *
 *  1. **Stängt betyder utestängd, inte raderad.** Att stänga av åtkomsten
 *     driver in betalningen lika bra som att förstöra materialet, och det
 *     senare går inte att ångra. Ett bolag mitt i en rekonstruktion har sin
 *     likviditetsplan och sina kontoutdrag här; blir de borta finns de ofta
 *     inte någon annanstans heller. Gallring är en separat, medveten åtgärd.
 *
 *  2. **Ingen blir stängd utan att ha sett det komma.** Varningen börjar tre
 *     dagar före och räknar ned varje dag. En avstängning som kommer som en
 *     överraskning läser användaren som ett fel i tjänsten, inte som en
 *     obetald faktura, och då ringer de supporten i stället för att betala.
 *
 * Alla beräkningar är rena funktioner på datum. Ingen `Date.now()` inuti -
 * anropspunkten skickar in "nu", så att testerna kan resa vilken dag som
 * helst.
 */

export type AccountStatus =
  /** Gratisperioden löper. */
  | "trial"
  /** Fakturan är skickad och förfallodagen har inte passerat. */
  | "invoiced"
  /**
   * Förfallodagen har passerat men ingen har stängt kontot ännu.
   * Innehållet är låst; stängningen är fortfarande en åtgärd som återstår.
   */
  | "overdue"
  /** Stängt av jobbet eller för hand - `closedAt` är satt. */
  | "closed"
  /** Betalt och i drift. */
  | "active";

/** Gratisperioden, i dagar. */
export const TRIAL_DAYS = 7;

/** Så många dagar före stängning varningen börjar. */
export const WARNING_DAYS = 3;

export interface AccountBilling {
  /** När kontot skapades. ISO. */
  startedAt: string;
  /**
   * Sista dag att betala. ISO. Sätts när första fakturan skapas; är den null
   * löper gratisperioden fortfarande.
   */
  dueAt: string | null;
  /** När betalningen registrerades. ISO, eller null. */
  paidAt: string | null;
  /** Satt när kontot faktiskt stängdes, av jobbet eller för hand. ISO. */
  closedAt: string | null;
}

const DAY_MS__billing = 24 * 60 * 60 * 1000;

/**
 * Hela dagar från `from` till `to`. Negativt när `to` redan passerat.
 *
 * Muterar inte argumenten. Slutet av måldagen används som referens, så att
 * "förfaller idag" ger 0 och inte -1 - en avstängning klockan 09:00 på
 * förfallodagen vore att ta en hel dag från någon som betalar på kvällen.
 */
export const daysBetween__billing = (from: Date, to: Date): number => {
  const endOfTarget = new Date(to);
  endOfTarget.setHours(23, 59, 59, 999);
  return Math.ceil((endOfTarget.getTime() - from.getTime()) / DAY_MS__billing) - 1;
};

/** Sista dagen på gratisperioden. */
export const trialEndsAt = (startedAt: string): Date =>
  new Date(new Date(startedAt).getTime() + TRIAL_DAYS * DAY_MS__billing);

export interface BillingState {
  status: AccountStatus;
  /** Dagar kvar till stängning. Negativt när fristen gått ut. Null när inget hotar. */
  daysLeft: number | null;
  /** Datumet som räknas ned mot, ISO. Null när inget hotar. */
  deadline: string | null;
  /** Sant när gränssnittet ska varna. */
  shouldWarn: boolean;
  /** Sant när innehållet ska vara låst. */
  isLocked: boolean;
}

/**
 * Var kontot står en given dag.
 *
 * Ordningen på kontrollerna är inte godtycklig: betalt slår allt, och ett
 * uttryckligen stängt konto slår datumen. Ett konto som betalats efter
 * stängning ska öppnas igen, inte fortsätta vara stängt för att ett fält
 * ligger kvar.
 */
export const billingState = (billing: AccountBilling, now: Date): BillingState => {
  if (billing.paidAt) {
    return { status: "active", daysLeft: null, deadline: null, shouldWarn: false, isLocked: false };
  }

  if (billing.closedAt && new Date(billing.closedAt) <= now) {
    return {
      status: "closed",
      daysLeft: null,
      deadline: billing.closedAt,
      shouldWarn: true,
      isLocked: true,
    };
  }

  // Ingen förfallodag satt: gratisperioden löper, och den är i sig
  // nedräkningen.
  const deadline = billing.dueAt ? new Date(billing.dueAt) : trialEndsAt(billing.startedAt);
  const daysLeft = daysBetween__billing(new Date(now), new Date(deadline));

  if (daysLeft < 0) {
    /*
     * Förfallen, men INTE stängd.
     *
     * Stängningen är en åtgärd någon vidtar - stängningsjobbet, eller drift
     * för hand - och den syns som `closedAt`. Fram till dess är kontot
     * förfallet, inte stängt.
     *
     * Skillnaden är inte akademisk. Vyn skrev tidigare "Kontot är stängt"
     * i samma sekund som förfallodagen passerade, innan något faktiskt
     * hänt: ett påstående om en åtgärd som ingen hade vidtagit. Den som
     * betalade samma kväll fick veta att kontot var stängt när det inte
     * var det.
     *
     * Låsningen ligger kvar oförändrad - det är beslutat att åtkomsten
     * upphör vid förfallodagen. Det som ändras är vad användaren får läsa.
     */
    return {
      status: "overdue",
      daysLeft,
      deadline: deadline.toISOString(),
      shouldWarn: true,
      isLocked: true,
    };
  }

  return {
    status: billing.dueAt ? "invoiced" : "trial",
    daysLeft,
    deadline: deadline.toISOString(),
    shouldWarn: daysLeft <= WARNING_DAYS,
    isLocked: false,
  };
};

/**
 * Vad användaren ska läsa. Formuleringarna hör ihop med tillståndet och ska
 * inte skrivas om lokalt i varje vy - då säger två sidor olika saker om samma
 * konto, vilket är exakt vad som får någon att ringa i stället för att betala.
 */
export const billingMessage = (
  state: BillingState,
): { title: string; body: string; tone: "info" | "warning" | "critical" } | null => {
  switch (state.status) {
    case "active":
      return null;

    case "trial":
      if (!state.shouldWarn) return null;
      return {
        title:
          state.daysLeft === 0
            ? "Sista dagen på din gratisperiod"
            : `${state.daysLeft} dagar kvar av gratisperioden`,
        body: "När den tar slut skickar vi en faktura. Betalar du den behåller du åtkomsten utan avbrott.",
        tone: "warning",
      };

    case "invoiced":
      if (!state.shouldWarn) return null;
      return {
        title:
          state.daysLeft === 0
            ? "Fakturan förfaller idag"
            : `Fakturan förfaller om ${state.daysLeft} dagar`,
        body: "Kommer ingen betalning in stängs kontot. Ditt material ligger kvar och blir tillgängligt igen när betalningen registreras.",
        tone: "warning",
      };

    case "overdue":
      return {
        title: "Fakturan är förfallen",
        body: "Åtkomsten är pausad tills betalningen registreras. Ditt material finns kvar – vi raderar ingenting.",
        tone: "critical",
      };

    case "closed":
      return {
        title: "Kontot är stängt",
        body: "Vi har inte fått in betalningen. Ditt material finns kvar och blir tillgängligt igen så snart betalningen registreras – vi raderar ingenting.",
        tone: "critical",
      };
  }
};

/* ==========================================================================
   src/lib/company.ts
   ========================================================================== */

/**
 * Landvex AB:s uppgifter — en enda källa.
 *
 * Clearance är en produkt från Landvex AB. Uppgifterna nedan hamnar i sidfoten,
 * i rapporternas dokumenthuvud, i villkoren och på fakturor.
 *
 * Uppgifterna delas i tre nivåer, för de har olika krav på sig:
 *
 *  1. `legalIdentityIsComplete()` — firma, organisationsnummer och säte. Det
 *     är vad ABL 28 kap. kräver att ett aktiebolag anger på sin webbplats och
 *     i sin korrespondens. Den nivån är uppfylld och visas.
 *  2. `companyInfoIsComplete()` — ovanstående plus en publik kontaktväg.
 *  3. `missingInvoiceFields()` — allt som måste stämma innan en faktura går
 *     ut: plusgiro, momsregistrering och F-skatt.
 *
 * Tomma fält är tomma med flit. En påhittad siffra i en sidfot blir en
 * påhittad siffra på en faktura, och en påhittad e-postadress i sidfoten är
 * en kontaktväg som tyst inte fungerar.
 */

export interface CompanyIdentity {
  /** Registrerad firma. */
  legalName: string;
  /** Produktens namn. */
  productName: string;
  /** MÅSTE FYLLAS I. Format XXXXXX-XXXX. */
  orgNumber: string;
  /** MÅSTE FYLLAS I. Styrelsens säte, t.ex. "Stockholm". */
  registeredOffice: string;
  /** MÅSTE FYLLAS I. Format SE + 12 siffror. */
  vatNumber: string;
  /**
   * Plusgiro, format XX XX XX-X. Bekräftat från Nordea-kontot.
   *
   * Bolaget har både plusgiro och bankgiro. Att jag först skrev om "bankgiro"
   * till "plusgiro" var fel: jag hade bara sett plusgirokontot och behandlade
   * det som en rättelse i stället för som ett val. Båda finns här nu, och
   * `invoiceGiro` avgör vilket som trycks på fakturan - inte den som råkar
   * skriva texten.
   */
  plusgiro: string;
  /** Bankgiro, format XXX-XXXX. */
  bankgiro: string;
  /**
   * Vilket konto som står FÖRST på fakturan. Båda skrivs ut - det är
   * beslutat - men ordningen säger vilket vi helst vill ha betalt till.
   */
  invoiceGiro: "plusgiro" | "bankgiro";
  /** För utländska betalningar. */
  iban: string;
  bic: string;
  /**
   * Publiceras inte. Sajten har ingen e-postadress utskriven - meddelanden
   * lämnas i formuläret på /kontakt och landar i driftinkorgen. Adressen här
   * används bara som avsändare på utgående fakturor och svar.
   */
  email: string;
  /** Frivilligt. */
  phone: string | null;
  /** MÅSTE FYLLAS I. */
  address: {
    street: string;
    postalCode: string;
    city: string;
    country: string;
  };
  /**
   * Sant när bolaget är godkänt för F-skatt. Ska anges på faktura.
   * MÅSTE BEKRÄFTAS mot Skatteverket innan första fakturan.
   */
  hasFSkatt: boolean;
  /**
   * Sant när bolaget är momsregistrerat. MÅSTE BEKRÄFTAS: ett bolag som inte
   * är momsregistrerat får inte ange moms på en faktura, och numret nedan är
   * härlett ur organisationsnumret enligt standardformeln - inte hämtat ur
   * ett register.
   */
  vatRegistered: boolean;
}

export const COMPANY: CompanyIdentity = {
  legalName: "Landvex AB",
  productName: "Clearance",
  orgNumber: "559141-7042",
  // Adressorten enligt Bolagsverket. Säte ska stämmas av mot
  // registreringsbeviset - adress och säte är formellt olika uppgifter.
  registeredOffice: "Tyresö",
  // SE + organisationsnumret utan bindestreck + 01, enligt standardformeln.
  // Se vatRegistered ovan.
  vatNumber: "SE559141704201",
  plusgiro: "87 53 07-1",
  // TOM I VÄNTAN PÅ NUMRET. Bankgirot ska skrivas ut bredvid plusgirot, men
  // jag har inte sett numret. paymentAccounts() utelämnar det tills det
  // fylls i - ett gissat bankgironummer är ett konto pengarna inte kommer
  // fram till, och felet syns först när betalningen uteblir.
  bankgiro: "",
  invoiceGiro: "plusgiro",
  iban: "SE30 9500 0099 6026 0875 3071",
  bic: "NDEASESS",
  email: "",
  phone: null,
  address: {
    street: "Antennvägen 2",
    postalCode: "135 48",
    city: "Tyresö",
    country: "Sverige",
  },
  hasFSkatt: false,
  vatRegistered: false,
};

/**
 * Vad ABL 28 kap. kräver: firma, organisationsnummer och säte. Adressen tas
 * med här därför att den visas i samma stycke — utan ort blir raden
 * missvisande, inte bara ofullständig.
 */
export const missingLegalIdentityFields = (c: CompanyIdentity = COMPANY): string[] => {
  const missing: string[] = [];
  if (!c.legalName.trim()) missing.push("firma");
  if (!c.orgNumber.trim()) missing.push("organisationsnummer");
  if (!c.registeredOffice.trim()) missing.push("säte");
  if (!c.address.street.trim() || !c.address.city.trim()) missing.push("adress");
  return missing;
};

export const legalIdentityIsComplete = (c: CompanyIdentity = COMPANY): boolean =>
  missingLegalIdentityFields(c).length === 0;

/**
 * Den legala identiteten plus en avsändaradress för utgående post. Adressen
 * publiceras inte på sajten - den behövs för att kunna skicka svar och
 * fakturor.
 */
export const missingCompanyFields = (c: CompanyIdentity = COMPANY): string[] => {
  const missing = missingLegalIdentityFields(c);
  if (!c.email.trim()) missing.push("avsändaradress för e-post");
  return missing;
};

export const companyInfoIsComplete = (c: CompanyIdentity = COMPANY): boolean =>
  missingCompanyFields(c).length === 0;

/** Extra fält som krävs innan en faktura får skickas. */
export const missingInvoiceFields = (c: CompanyIdentity = COMPANY): string[] => {
  const missing = missingCompanyFields(c);
  if (!c.vatNumber.trim()) missing.push("momsregistreringsnummer");
  // Båda ska stå på fakturan, så båda måste finnas.
  if (!c.plusgiro.trim()) missing.push("plusgiro");
  if (!c.bankgiro.trim()) missing.push("bankgiro");
  if (!c.hasFSkatt) missing.push("bekräftat godkännande för F-skatt");
  if (!c.vatRegistered) missing.push("bekräftad momsregistrering");
  return missing;
};

export const formatAddress = (c: CompanyIdentity = COMPANY): string =>
  [c.address.street, `${c.address.postalCode} ${c.address.city}`.trim(), c.address.country]
    .filter((line) => line.trim().length > 0)
    .join(", ");

/**
 * Betalkontona som ska skrivas ut, i den ordning de ska stå.
 *
 * Båda anges - det är beslutat. Betalaren väljer det konto den egna banken
 * hanterar enklast, och ett bolag som bara har bankgiro upplagt i sin
 * leverantörsregister slipper lägga upp ett nytt.
 *
 * Ett konto vars nummer saknas tas bort ur listan i stället för att skrivas
 * ut tomt. `invoiceGiro` styr vilket som står först, alltså vilket vi helst
 * vill ha betalt till.
 */
export const paymentAccounts = (
  c: CompanyIdentity = COMPANY,
): { label: string; number: string }[] => {
  const accounts = [
    { key: "plusgiro" as const, label: "Plusgiro", number: c.plusgiro },
    { key: "bankgiro" as const, label: "Bankgiro", number: c.bankgiro },
  ].filter((a) => a.number.trim().length > 0);

  return accounts
    .sort((a, b) => (a.key === c.invoiceGiro ? -1 : b.key === c.invoiceGiro ? 1 : 0))
    .map(({ label, number }) => ({ label, number }));
};

/** Kortform för löptext: "plusgiro 87 53 07-1 eller bankgiro 123-4567". */
export const paymentAccountsSentence = (c: CompanyIdentity = COMPANY): string => {
  const parts = paymentAccounts(c).map((a) => `${a.label.toLowerCase()} ${a.number}`);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} eller ${parts[parts.length - 1]}`;
};

/* ==========================================================================
   src/lib/dataExport.ts
   ========================================================================== */

/**
 * REGISTERUTDRAG OCH DATAPORTABILITET (GDPR art. 15 och 20).
 *
 * Den registrerade har rätt att få veta vilka uppgifter vi har om hen, och
 * att få med sig dem i ett maskinläsbart format. Det här bygger just det:
 * en enda JSON med det kontot faktiskt äger, hämtat ur samma läsvägar som
 * appen själv använder - ingen skuggkopia, inget påhittat.
 *
 * Ren funktion, medvetet: den tar färdiga uppgifter och formar dem, så att
 * den går att pröva utan konto och utan nät. Sidan (DashboardSettings)
 * hämtar delarna och lämnar dem hit.
 */

export interface MyDataParts {
  /** Inloggningsadressen. */
  epost: string | null;
  /** Profilen: namn och telefon som användaren själv fyllt i. */
  profil: unknown;
  /** Kontots ekonomiska läge (start, status) - inte fakturorna, de är egna. */
  ekonomi: unknown;
  /** Aviseringsvalen. */
  aviseringar: unknown;
  /** Ärendena användaren är med i, i sammandrag. */
  arenden: unknown[];
}

export interface MyDataExport {
  /** Stabil formatstämpel, så en mottagare vet vad filen är. */
  format: "clearance-personuppgifter-v1";
  /** När utdraget togs (ISO). Sätts av anroparen, inte av en klocka här. */
  uttaget: string;
  /** Klartext om vad filen är och vilken rätt den svarar mot. */
  om: string;
  konto: { epost: string | null };
  profil: unknown;
  ekonomi: unknown;
  aviseringar: unknown;
  arenden: unknown[];
}

const OM =
  "Det här är ett registerutdrag enligt dataskyddsförordningen (GDPR art. 15) " +
  "i ett maskinläsbart format för dataportabilitet (art. 20). Det innehåller " +
  "de personuppgifter kontot äger. Fakturor och bokföringsunderlag har egna " +
  "lagringskrav och laddas ned separat under Fakturor och kvitton.";

/** Formar utdraget och ett filnamn. `uttagetIso` sätts av anroparen. */
export const buildMyDataExport = (
  parts: MyDataParts,
  uttagetIso: string,
): { data: MyDataExport; fileName: string } => {
  const data: MyDataExport = {
    format: "clearance-personuppgifter-v1",
    uttaget: uttagetIso,
    om: OM,
    konto: { epost: parts.epost },
    profil: parts.profil ?? null,
    ekonomi: parts.ekonomi ?? null,
    aviseringar: parts.aviseringar ?? null,
    arenden: parts.arenden ?? [],
  };
  // Datumdel ur ISO utan att tolka tidszon: filnamnet ska bara vara läsbart.
  const dag = uttagetIso.slice(0, 10);
  return { data, fileName: `clearance-mina-uppgifter-${dag}.json` };
};

/* ==========================================================================
   src/lib/dataMinimering.ts
   ========================================================================== */

/**
 * DATAMINIMERING VID FRITEXT.
 *
 * Ett krissamtal drar åt sig känsliga uppgifter: personnummer, hälsa,
 * privata förhållanden, namngivna tredje personer. Sådant är särskilda
 * kategorier (GDPR art. 9) som produkten INTE samlar in avsiktligt - men
 * ett fritextfält kan råka bära det ändå. Motmedlet är enkelt och står
 * där texten skrivs: en kort påminnelse om att bara dela det läget kräver.
 *
 * Samma hållning som röret mot modellen (api/server/anthropic.ts:
 * DATAMINIMERING) och det docs/dataskydd.md §5/§8 efterlyser: en kort
 * användarinstruktion vid fritext. Texten bor här, som en enda sanning,
 * så att den ser likadan ut i samtalet, onboardingen och guiderna.
 */
export const DATA_MINIMERING_HINT =
  "Dela bara det som läget kräver. Undvik personnummer och uppgifter om " +
  "namngivna privatpersoner – CLEARANCE behöver dem inte.";

/* ==========================================================================
   src/lib/pdf.ts
   ========================================================================== */

/**
 * En egen, minimal PDF-skrivare.
 *
 * Beslutet att inte dra in ett PDF-bibliotek står kvar - men av nya skäl:
 * rapporterna här är strukturerad text, och en handskriven generator på
 * några hundra rader ger deterministiska byten (samma rapport ger samma
 * fil, testbar utan webbläsare), noll beroenden och noll kilobyte extern
 * kod. Base-14-typsnitten (Helvetica) kräver ingen inbäddning, och
 * WinAnsi-kodningen täcker svenskan: åäö, paragraftecken, tankstreck.
 *
 * Begränsningar, med avsikt: ingen grafik utöver linjer, inga bilder,
 * ingen typografisk perfektion. Radbrytningen mäter med en approximativ
 * breddtabell och bryter hellre någon punkt för tidigt än svämmar över -
 * ett dokument som lämnar huset får aldrig klippa text.
 */

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = { top: 64, right: 56, bottom: 64, left: 56 };
const CONTENT_WIDTH = A4.width - MARGIN.left - MARGIN.right;

export type PdfFont = "regular" | "bold" | "italic";

/**
 * Approximativa teckenbredder för Helvetica, i tusendelar av teckenstorleken.
 * Klasserna räcker för radbrytning med säkerhetsmarginal - exakta AFM-mått
 * hade gett tätare rader, inte säkrare.
 */
const charWidth = (ch: string, bold: boolean): number => {
  if (/[iíìîjl.,:;'’!|()[\]{}/\\ ]/.test(ch)) return bold ? 300 : 278;
  if (/[ftr-]/.test(ch)) return bold ? 360 : 333;
  if (/[mwMW@ÅÄÖÆØ]/.test(ch)) return bold ? 900 : 850;
  if (/[A-ZÉÜ0-9åäöéü]/.test(ch)) return bold ? 700 : 640;
  return bold ? 610 : 556;
};

export const measure = (text: string, size: number, font: PdfFont): number => {
  const bold = font === "bold";
  let units = 0;
  for (const ch of text) units += charWidth(ch, bold);
  // 4 % marginal: bryt hellre tidigt än klipp.
  return (units / 1000) * size * 1.04;
};

/** Bryter text till rader som ryms inom maxWidth punkter. */
export const wrapText = (
  text: string,
  size: number,
  font: PdfFont,
  maxWidth: number,
): string[] => {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current === "" ? word : `${current} ${word}`;
    if (measure(candidate, size, font) <= maxWidth || current === "") {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current !== "") lines.push(current);
  return lines.length > 0 ? lines : [""];
};

/**
 * WinAnsi (CP1252). Tecken utanför ersätts med '?' hellre än att tyst
 * försvinna - ett frågetecken syns i korrektur, ett borttappat tecken
 * ändrar betydelsen.
 */
const CP1252_EXTRAS: Record<string, number> = {
  "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94,
  "•": 0x95, "–": 0x96, "—": 0x97, "…": 0x85,
  "€": 0x80, "™": 0x99,
};

const encodeWinAnsi = (text: string): number[] => {
  const bytes: number[] = [];
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 63;
    if (code === 0x28 || code === 0x29 || code === 0x5c) {
      bytes.push(0x5c, code); // escapa ( ) \
    } else if (code >= 0x20 && code <= 0x7e) {
      bytes.push(code);
    } else if (code >= 0xa0 && code <= 0xff) {
      bytes.push(code);
    } else if (CP1252_EXTRAS[ch] !== undefined) {
      bytes.push(CP1252_EXTRAS[ch]);
    } else {
      bytes.push(0x3f);
    }
  }
  return bytes;
};

interface Op {
  kind: "text" | "rule";
  x: number;
  y: number;
  text?: string;
  size?: number;
  font?: PdfFont;
  gray?: number;
  toX?: number;
}

export interface PdfLineOptions {
  size?: number;
  font?: PdfFont;
  gray?: number;
  indent?: number;
  spaceAfter?: number;
  /** Ritas högerställd vid högermarginalen på SAMMA rad som nästa text-anrop redan skrivit. */
}

export class PdfWriter {
  private pages: Op[][] = [[]];
  private y = A4.height - MARGIN.top;
  private readonly footerText: string;

  constructor(footerText: string) {
    this.footerText = footerText;
  }

  private get page(): Op[] {
    return this.pages[this.pages.length - 1];
  }

  private ensureRoom(height: number): void {
    if (this.y - height < MARGIN.bottom) {
      this.pages.push([]);
      this.y = A4.height - MARGIN.top;
    }
  }

  /** Skriver ett stycke med radbrytning. */
  text(content: string, options: PdfLineOptions = {}): void {
    const size = options.size ?? 10.5;
    const font = options.font ?? "regular";
    const gray = options.gray ?? 0;
    const indent = options.indent ?? 0;
    const lineHeight = size * 1.45;
    const width = CONTENT_WIDTH - indent;
    for (const line of wrapText(content, size, font, width)) {
      this.ensureRoom(lineHeight);
      this.page.push({ kind: "text", x: MARGIN.left + indent, y: this.y - size, text: line, size, font, gray });
      this.y -= lineHeight;
    }
    this.y -= options.spaceAfter ?? size * 0.35;
  }

  /** En rad med vänsterdel och högerställd del - tabellrad för belopp. */
  row(left: string, right: string, options: PdfLineOptions = {}): void {
    const size = options.size ?? 10.5;
    const font = options.font ?? "regular";
    const gray = options.gray ?? 0;
    const lineHeight = size * 1.45;
    const rightWidth = measure(right, size, font);
    const leftMax = CONTENT_WIDTH - rightWidth - 12;
    const leftLines = wrapText(left, size, font, leftMax);
    for (let i = 0; i < leftLines.length; i += 1) {
      this.ensureRoom(lineHeight);
      this.page.push({ kind: "text", x: MARGIN.left, y: this.y - size, text: leftLines[i], size, font, gray });
      if (i === 0) {
        this.page.push({
          kind: "text",
          x: A4.width - MARGIN.right - rightWidth,
          y: this.y - size,
          text: right,
          size,
          font,
          gray,
        });
      }
      this.y -= lineHeight;
    }
    this.y -= options.spaceAfter ?? size * 0.25;
  }

  rule(gray = 0.75): void {
    this.ensureRoom(10);
    this.page.push({ kind: "rule", x: MARGIN.left, y: this.y - 4, toX: A4.width - MARGIN.right, gray });
    this.y -= 12;
  }

  space(points: number): void {
    this.ensureRoom(points);
    this.y -= points;
  }

  /** Serialiserar dokumentet till PDF-byte. */
  toBytes(): Uint8Array {
    const chunks: number[] = [];
    const push = (s: string) => {
      for (let i = 0; i < s.length; i += 1) chunks.push(s.charCodeAt(i) & 0xff);
    };

    const offsets: number[] = [];
    const startObj = (n: number) => {
      offsets[n] = chunks.length;
      push(`${n} 0 obj\n`);
    };

    push("%PDF-1.4\n%åäö\n");

    const pageCount = this.pages.length;
    const fontRegular = 3 + pageCount * 2;
    const fontBold = fontRegular + 1;
    const fontItalic = fontRegular + 2;
    const totalObjects = fontItalic;

    startObj(1);
    push("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
    startObj(2);
    const kids = this.pages.map((_, i) => `${3 + i * 2} 0 R`).join(" ");
    push(`<< /Type /Pages /Count ${pageCount} /Kids [${kids}] >>\nendobj\n`);

    this.pages.forEach((ops, index) => {
      const pageObj = 3 + index * 2;
      const contentObj = pageObj + 1;

      startObj(pageObj);
      push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.width} ${A4.height}] ` +
          `/Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R /F3 ${fontItalic} 0 R >> >> ` +
          `/Contents ${contentObj} 0 R >>\nendobj\n`,
      );

      const stream: number[] = [];
      const pushStream = (s: string) => {
        for (let i = 0; i < s.length; i += 1) stream.push(s.charCodeAt(i) & 0xff);
      };
      const fontRef = (f: PdfFont) => (f === "bold" ? "F2" : f === "italic" ? "F3" : "F1");

      const footer: Op[] = [
        {
          kind: "text",
          x: MARGIN.left,
          y: 36,
          text: `${this.footerText} · sida ${index + 1} (${pageCount})`,
          size: 8,
          font: "regular",
          gray: 0.45,
        },
      ];

      for (const op of [...ops, ...footer]) {
        if (op.kind === "rule") {
          pushStream(`${op.gray ?? 0.75} G 0.7 w ${op.x} ${op.y} m ${op.toX} ${op.y} l S\n`);
        } else {
          pushStream(`BT /${fontRef(op.font ?? "regular")} ${op.size} Tf ${op.gray ?? 0} g ${op.x.toFixed(2)} ${op.y.toFixed(2)} Td (`);
          for (const byte of encodeWinAnsi(op.text ?? "")) stream.push(byte);
          pushStream(") Tj ET\n");
        }
      }

      startObj(contentObj);
      push(`<< /Length ${stream.length} >>\nstream\n`);
      chunks.push(...stream);
      push("\nendstream\nendobj\n");
    });

    const fontDef = (n: number, base: string) => {
      startObj(n);
      push(`<< /Type /Font /Subtype /Type1 /BaseFont /${base} /Encoding /WinAnsiEncoding >>\nendobj\n`);
    };
    fontDef(fontRegular, "Helvetica");
    fontDef(fontBold, "Helvetica-Bold");
    fontDef(fontItalic, "Helvetica-Oblique");

    const xrefStart = chunks.length;
    push(`xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`);
    for (let n = 1; n <= totalObjects; n += 1) {
      push(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
    }
    push(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);

    return new Uint8Array(chunks);
  }
}

/* ==========================================================================
   src/lib/documentTemplates.ts
   ========================================================================== */

/**
 * Dokumentmallarna: styrelseprotokoll och kallelser, byggda ur ärendets
 * data.
 *
 * Rena funktioner - samma indata ger samma dokument, tecken för tecken.
 * Det är vad som gör dem testbara: ett styrelseprotokoll med fel
 * laghänvisning är ett fel med rättslig innebörd, och det ska fångas i ett
 * test, inte hos tingsrätten.
 *
 * Tre regler:
 *
 *  1. MALLEN SÄGER VAD DEN ÄR. Varje dokument inleds med en markering om
 *     att det är ett utkast som ska granskas innan det används. Produkten
 *     ger struktur, inte juridisk rådgivning - den gränsen står i
 *     dokumentet självt, inte bara i gränssnittet.
 *
 *  2. INGET HITTAS PÅ. Fält som saknas skrivs som tydliga luckor
 *     ("[ORT]"), aldrig som gissningar. Ett protokoll med påhittad ort är
 *     värre än ett med en synlig lucka.
 *
 *  3. LAGHÄNVISNINGARNA ÄR DEL AV TEXTEN och därmed av testerna:
 *     ABL 25 kap. 13-16 §§ för kontrollbalansprocessen, lagen (2022:964)
 *     om företagsrekonstruktion för rekonstruktionsansökan.
 */

export interface TemplatePerson {
  name: string;
  role: string;
}

export interface TemplateInput {
  companyName: string;
  orgNumber: string;
  /** Ort för sammanträdet/stämman. Tom sträng ger en synlig lucka. */
  place: string;
  /** ISO-datum (YYYY-MM-DD). */
  date: string;
  attendees: TemplatePerson[];
}

export interface GeneratedDocument {
  id: string;
  title: string;
  fileName: string;
  body: string;
}

const DRAFT_NOTICE =
  "UTKAST FRÅN CLEARANCE – GRANSKA INNAN ANVÄNDNING\n" +
  "Mallen är ett strukturerat underlag, inte juridisk rådgivning. Stäm av\n" +
  "innehållet med bolagets revisor eller juridiska rådgivare innan det\n" +
  "undertecknas.";

const gap = (value: string, label: string): string => (value.trim() ? value.trim() : `[${label}]`);

const swedishDate = (iso: string): string => {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "[DATUM]";
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });
};

const attendeeLines = (attendees: TemplatePerson[]): string[] =>
  attendees.length > 0
    ? attendees.map((a) => `  ${a.name}${a.role ? `, ${a.role.toLowerCase()}` : ""}`)
    : ["  [NÄRVARANDE]"];

const signatureLines = (attendees: TemplatePerson[]): string[] => {
  const names = attendees.length > 0 ? attendees.map((a) => a.name) : ["[NAMN]"];
  return names.flatMap((name) => ["", "", "________________________________", name]);
};

const header = (input: TemplateInput, title: string): string[] => [
  DRAFT_NOTICE,
  "",
  "================================================================",
  title.toUpperCase(),
  "================================================================",
  "",
  `Bolag:   ${gap(input.companyName, "BOLAGSNAMN")}`,
  `Org.nr:  ${gap(input.orgNumber, "ORGANISATIONSNUMMER")}`,
  `Ort:     ${gap(input.place, "ORT")}`,
  `Datum:   ${swedishDate(input.date)}`,
  "",
];

/**
 * Styrelseprotokoll: beslut att upprätta kontrollbalansräkning.
 * ABL 25 kap. 13 § - skyldigheten inträder redan vid SKÄL ATT ANTA.
 */
export const boardMinutesKbr = (input: TemplateInput): GeneratedDocument => {
  const lines = [
    ...header(input, "Protokoll fört vid styrelsesammanträde"),
    "Närvarande:",
    ...attendeeLines(input.attendees),
    "",
    "§ 1  Sammanträdets öppnande och protokollförare",
    "Sammanträdet öppnades. Till protokollförare utsågs [NAMN].",
    "",
    "§ 2  Bolagets ekonomiska ställning",
    "Styrelsen konstaterade att det finns skäl att anta att bolagets eget",
    "kapital understiger hälften av det registrerade aktiekapitalet.",
    "",
    "§ 3  Beslut om kontrollbalansräkning",
    "Styrelsen beslutade att genast upprätta en kontrollbalansräkning i",
    "enlighet med 25 kap. 13 § aktiebolagslagen (2005:551) och att låta",
    "bolagets revisor granska den, i förekommande fall enligt 25 kap. 14 §.",
    "",
    "§ 4  Fortsatt hantering",
    "Styrelsen beslutade att följa likviditeten löpande och att kalla till",
    "kontrollstämma enligt 25 kap. 15 § aktiebolagslagen om",
    "kontrollbalansräkningen visar att kapitalet understiger den kritiska",
    "gränsen.",
    "",
    "§ 5  Sammanträdets avslutande",
    "Sammanträdet förklarades avslutat.",
    "",
    "Underskrifter:",
    ...signatureLines(input.attendees),
  ];
  return {
    id: "protokoll-kbr",
    title: "Styrelseprotokoll – beslut om kontrollbalansräkning",
    fileName: `styrelseprotokoll-kbr-${input.date}.txt`,
    body: lines.join("\n"),
  };
};

/**
 * Kallelse till extra bolagsstämma - första kontrollstämman,
 * ABL 25 kap. 15 §.
 */
export const noticeControlMeeting = (input: TemplateInput): GeneratedDocument => {
  const lines = [
    ...header(input, "Kallelse till extra bolagsstämma (första kontrollstämma)"),
    `Aktieägarna i ${gap(input.companyName, "BOLAGSNAMN")} kallas härmed till`,
    "extra bolagsstämma.",
    "",
    "Stämman hålls med anledning av att styrelsen har upprättat en",
    "kontrollbalansräkning enligt 25 kap. 13 § aktiebolagslagen (2005:551)",
    "som utvisar att bolagets eget kapital understiger hälften av det",
    "registrerade aktiekapitalet.",
    "",
    "Förslag till dagordning:",
    "  1. Stämmans öppnande och val av ordförande",
    "  2. Upprättande och godkännande av röstlängd",
    "  3. Godkännande av dagordning",
    "  4. Val av justerare",
    "  5. Prövning av om stämman blivit behörigen sammankallad",
    "  6. Framläggande av kontrollbalansräkningen och, i förekommande",
    "     fall, revisorns yttrande över den (25 kap. 15 § aktiebolagslagen)",
    "  7. Beslut om bolaget ska gå i likvidation eller driva verksamheten",
    "     vidare",
    "  8. Stämmans avslutande",
    "",
    "Kontrollbalansräkningen och revisorns yttrande hålls tillgängliga hos",
    "bolaget och sänds till de aktieägare som begär det.",
    "",
    "OBS: Kontrollera kallelsetid och kallelsesätt mot bolagsordningen och",
    "7 kap. aktiebolagslagen innan kallelsen skickas.",
    "",
    "Styrelsen",
    `${gap(input.companyName, "BOLAGSNAMN")}`,
  ];
  return {
    id: "kallelse-kontrollstamma",
    title: "Kallelse till första kontrollstämman",
    fileName: `kallelse-kontrollstamma-${input.date}.txt`,
    body: lines.join("\n"),
  };
};

/**
 * Styrelseprotokoll: beslut att ansöka om företagsrekonstruktion enligt
 * lagen (2022:964) om företagsrekonstruktion.
 */
export const boardMinutesReconstruction = (input: TemplateInput): GeneratedDocument => {
  const lines = [
    ...header(input, "Protokoll fört vid styrelsesammanträde"),
    "Närvarande:",
    ...attendeeLines(input.attendees),
    "",
    "§ 1  Sammanträdets öppnande och protokollförare",
    "Sammanträdet öppnades. Till protokollförare utsågs [NAMN].",
    "",
    "§ 2  Bolagets ekonomiska ställning",
    "Styrelsen konstaterade att bolaget har ekonomiska svårigheter men att",
    "det finns grundad anledning att anta att verksamhetens livskraft kan",
    "säkras genom en rekonstruktion.",
    "",
    "§ 3  Beslut om ansökan om företagsrekonstruktion",
    "Styrelsen beslutade att ansöka hos tingsrätten om",
    "företagsrekonstruktion enligt lagen (2022:964) om",
    "företagsrekonstruktion, och att i ansökan föreslå rekonstruktör.",
    "",
    "§ 4  Bemyndigande",
    "Styrelsen bemyndigade [NAMN] att underteckna och ge in ansökan samt",
    "att vidta de åtgärder som krävs för dess handläggning.",
    "",
    "§ 5  Sammanträdets avslutande",
    "Sammanträdet förklarades avslutat.",
    "",
    "Underskrifter:",
    ...signatureLines(input.attendees),
  ];
  return {
    id: "protokoll-rekonstruktion",
    title: "Styrelseprotokoll – ansökan om företagsrekonstruktion",
    fileName: `styrelseprotokoll-rekonstruktion-${input.date}.txt`,
    body: lines.join("\n"),
  };
};

/**
 * Mallen som PDF: den förformaterade texten sätts rad för rad - radbrytningar
 * och understreckslinjer i mallen är del av dokumentet och bevaras.
 */
export const templateToPdf = (doc: GeneratedDocument): Uint8Array => {
  const pdf = new PdfWriter(`Clearance · ${doc.title}`);
  pdf.text(doc.title, { font: "bold", size: 15, spaceAfter: 4 });
  pdf.rule();
  pdf.space(4);
  for (const line of doc.body.split("\n")) {
    if (line.trim() === "") {
      pdf.space(6);
    } else if (/^=+$/.test(line.trim())) {
      pdf.rule(0.7);
    } else if (/^§ \d/.test(line) ) {
      pdf.text(line, { font: "bold", size: 10.5, spaceAfter: 1 });
    } else if (line.startsWith("UTKAST")) {
      pdf.text(line, { font: "bold", size: 9, gray: 0.35, spaceAfter: 1 });
    } else {
      pdf.text(line, { size: 10, spaceAfter: 1 });
    }
  }
  return pdf.toBytes();
};

export const TEMPLATES = [
  {
    id: "protokoll-kbr",
    name: "Styrelseprotokoll – beslut om kontrollbalansräkning",
    description:
      "Beslutet som startar kontrollbalansprocessen (ABL 25 kap. 13 §). Upprättas när det finns skäl att anta att halva aktiekapitalet är förbrukat.",
    build: boardMinutesKbr,
  },
  {
    id: "kallelse-kontrollstamma",
    name: "Kallelse till första kontrollstämman",
    description:
      "Kallelse till extra bolagsstämma där kontrollbalansräkningen läggs fram (ABL 25 kap. 15 §). Stäm av kallelsetid mot bolagsordningen.",
    build: noticeControlMeeting,
  },
  {
    id: "protokoll-rekonstruktion",
    name: "Styrelseprotokoll – ansökan om företagsrekonstruktion",
    description:
      "Beslutet att ansöka hos tingsrätten enligt lagen (2022:964) om företagsrekonstruktion, med bemyndigande att ge in ansökan.",
    build: boardMinutesReconstruction,
  },
] as const;

/* ==========================================================================
   src/lib/invoice.ts
   ========================================================================== */

/**
 * Fakturor och kvitton.
 *
 * Beräkningen är ren och sitter här, inte i en vy. En faktura är ett
 * bokföringsunderlag: samma indata måste ge samma belopp varje gång, och
 * beloppen måste gå att räkna efter för hand.
 *
 * Två regler som koden vägrar att bryta:
 *
 *  1. **Moms läggs bara på om bolaget är momsregistrerat.** Att ta ut moms
 *     utan registrering är inte ett formfel, det är att kräva in en skatt man
 *     inte får kräva in. `buildInvoice` returnerar ett fel i stället för ett
 *     belopp när registreringen inte är bekräftad.
 *
 *  2. **Ören avrundas en gång, på momsen, och summan härleds.** Räknar man
 *     netto och brutto var för sig och drar ifrån hamnar man en öre fel i
 *     ungefär vart tionde fall, och då stämmer inte fakturan mot
 *     inbetalningen.
 *
 * Belopp hålls i ören (heltal) hela vägen. Flyttal och pengar hör inte ihop:
 * 0.1 + 0.2 är inte 0.3, och en faktura som är ett öre fel är en faktura som
 * någon måste reda ut för hand.
 */

/** Svensk normalskattesats. */
export const VAT_RATE = 0.25;

/** Betalningsvillkor i dagar från fakturadatum. */
export const PAYMENT_TERMS_DAYS = 10;

export interface InvoiceLine {
  description: string;
  /** Antal. Heltal eller decimal, t.ex. 1 eller 2,5 timmar. */
  quantity: number;
  /** À-pris i ören, exklusive moms. */
  unitPriceOre: number;
}

export interface InvoiceInput {
  /** Löpnummer. Ska vara obrutet och stigande - se nextInvoiceNumber(). */
  invoiceNumber: string;
  /** ISO. Fakturadatum. */
  issuedAt: string;
  /**
   * Kunden.
   *
   * Namn OCH adress är formkrav, inte trevligheter: 17 kap. 24 § 5
   * mervärdesskattelagen (2023:200) kräver båda parternas namn och adress
   * på en faktura. Fältet var frivilligt förut och fylldes aldrig i - en
   * faktura som saknar köparens adress uppfyller inte formkraven, och
   * mottagaren har rätt att skicka tillbaka den.
   *
   * Organisationsnumret är inte ett formkrav vid inhemsk försäljning, men
   * mottagarens ekonomifunktion behöver det för att bokföra rätt, och det
   * är alltid känt: bolaget uppgav det när ärendet skapades.
   */
  customer: {
    name: string;
    orgNumber: string | null;
    email: string;
    address: string | null;
  };
  lines: InvoiceLine[];
  /**
   * Perioden tjänsten avser, ISO-datum.
   *
   * 17 kap. 24 § 7 kräver datum då tillhandahållandet utförts eller
   * slutförts när det skiljer sig från fakturadatumet. En månadsavgift
   * gör alltid det. Är start och slut samma dag är det en
   * engångsleverans och skrivs ut som leveransdatum.
   *
   * Null bara när tillhandahållandet sker samma dag som fakturan ställs
   * ut - då är fakturadatumet självt uppgiften.
   */
  period?: { start: string; end: string } | null;
  /** Fritext under raderna. */
  note?: string | null;
}

export interface InvoiceTotals {
  /** Summa exklusive moms, i ören. */
  netOre: number;
  /** Momsbelopp, i ören. */
  vatOre: number;
  /** Att betala, i ören. */
  grossOre: number;
  vatRate: number;
}

export interface Invoice extends InvoiceInput {
  totals: InvoiceTotals;
  /** ISO. Förfallodag. */
  dueAt: string;
  seller: CompanyIdentity;
}

const DAY_MS__invoice = 24 * 60 * 60 * 1000;

/** Ören till "1 234,50 kr". */
export const formatOre = (ore: number): string => {
  const sign = ore < 0 ? "-" : "";
  const abs = Math.abs(ore);
  const kr = Math.floor(abs / 100);
  const rest = abs % 100;
  // Egen tusentalsavgränsare: toLocaleString ger U+00A0, som ser ut som ett
  // mellanslag men inte är det, och som därför bryter jämförelser i tester
  // och sökningar i färdiga dokument.
  const grouped = String(kr).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${grouped},${String(rest).padStart(2, "0")} kr`;
};

/** Radens belopp exklusive moms, i ören. Avrundas till hel öre. */
export const lineTotalOre = (line: InvoiceLine): number =>
  Math.round(line.quantity * line.unitPriceOre);

/**
 * Summorna.
 *
 * Momsen avrundas till hel öre och bruttot är summan av netto och moms.
 * Ordningen är avsiktlig: härleds nettot ur bruttot i stället uppstår en
 * öresdifferens som inte går att förklara för en revisor.
 */
export const invoiceTotals = (lines: InvoiceLine[], vatRate: number): InvoiceTotals => {
  const netOre = lines.reduce((sum, line) => sum + lineTotalOre(line), 0);
  const vatOre = Math.round(netOre * vatRate);
  return { netOre, vatOre, grossOre: netOre + vatOre, vatRate };
};

export type InvoiceResult =
  | { ok: true; invoice: Invoice }
  | { ok: false; blockedBy: string[] };

/**
 * Vad som saknas på KÖPARSIDAN innan fakturan får ställas ut.
 *
 * Blockeringen var ensidig förut: säljarens brister stoppade fakturan,
 * köparens gjorde det inte. Men en faktura utan mottagarens adress är
 * lika ogiltig som en utan säljarens momsnummer - formkravet i 17 kap.
 * 24 § 5 gäller båda parterna.
 */
export const missingBuyerFields = (customer: InvoiceInput["customer"]): string[] => {
  const missing: string[] = [];
  if (!customer.name.trim()) missing.push("köparens namn");
  if (!customer.address?.trim()) missing.push("köparens adress");
  return missing;
};

/**
 * Bygger en faktura, eller vägrar.
 *
 * Vägran är inte en artighet. En faktura som går ut utan
 * momsregistreringsnummer, utan bekräftad F-skatt, med ett tomt bankgiro
 * eller utan köparens adress är ett dokument mottagaren inte kan bokföra
 * och inte kan betala. Bättre att den aldrig skapas än att den skickas.
 */
export const buildInvoice = (
  input: InvoiceInput,
  seller: CompanyIdentity = COMPANY,
): InvoiceResult => {
  const blockedBy = [...missingInvoiceFields(seller), ...missingBuyerFields(input.customer)];
  if (input.lines.length === 0) blockedBy.push("minst en fakturarad");
  if (blockedBy.length > 0) return { ok: false, blockedBy };

  const issued = new Date(input.issuedAt);
  return {
    ok: true,
    invoice: {
      ...input,
      seller,
      totals: invoiceTotals(input.lines, VAT_RATE),
      dueAt: new Date(issued.getTime() + PAYMENT_TERMS_DAYS * DAY_MS__invoice).toISOString(),
    },
  };
};

/**
 * Nästa fakturanummer.
 *
 * Serien måste vara obruten och stigande - Skatteverket kräver det, och ett
 * hopp i serien är det första en granskare frågar om. Formatet är ÅR-NNNN och
 * serien börjar om vid årsskiftet, vilket är vanligast och gör en lucka lätt
 * att se.
 *
 * `existing` är alla tidigare nummer. Beräkningen utgår från det högsta för
 * innevarande år, inte från antalet: en makulerad faktura får inte leda till
 * att ett nummer återanvänds.
 */
export const nextInvoiceNumber = (existing: string[], now: Date): string => {
  const year = now.getFullYear();
  const prefix = `${year}-`;
  const highest = existing
    .filter((n) => n.startsWith(prefix))
    .map((n) => Number.parseInt(n.slice(prefix.length), 10))
    .filter((n) => Number.isFinite(n))
    .reduce((max, n) => Math.max(max, n), 0);
  return `${prefix}${String(highest + 1).padStart(4, "0")}`;
};

/* ==========================================================================
   src/lib/email/messages.ts
   ========================================================================== */

/**
 * Vad som faktiskt står i mejlen.
 *
 * Rena funktioner: ett mejl är något som lämnar huset och inte går att ta
 * tillbaka, så innehållet ska gå att läsa i ett test i stället för att
 * kontrolleras genom att skicka ett.
 *
 * Tre regler som styr utformningen:
 *
 *  1. **Allt väsentligt står i ren text.** HTML-varianten är en bonus. En
 *     ekonomifunktion som blockerar HTML ska ändå se belopp, förfallodag och
 *     kontonummer.
 *  2. **Inga bilder, inga externa anrop, ingen spårpixel.** Samma gräns som
 *     resten av produkten. Ett spårat mejl till ett bolag i kris är precis
 *     den sortens uppgift som inte ska lämna vår server.
 *  3. **Ingen länk är nödvändig för att betala.** Kontonummer och belopp står
 *     i texten. Ett mejl om pengar som kräver att man klickar sig vidare ser
 *     ut som bedrägeri, och en ekonomiassistent som blivit lärd att inte
 *     klicka gör helt rätt i att inte göra det.
 */

export interface EmailMessage {
  recipient: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  /** Vad mejlet gäller. Lagras med raden så en rad går att spåra. */
  kind: "invoice" | "receipt" | "payment_reminder" | "account_closed" | "case_invitation";
}

const swedishDate__email_messages = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });
};

/**
 * Escapar text som ska in i HTML-varianten.
 *
 * Fälten kommer från kunden - ett bolagsnamn med ett &-tecken eller en
 * beskrivning någon klistrat in. Utan det här blir mejlet trasigt i bästa
 * fall och en injektionsyta i värsta.
 */
const esc = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Avsändaren, som den ska stå i varje mejl. */
const signature = (): string =>
  [
    COMPANY.legalName,
    `Org.nr ${COMPANY.orgNumber}`,
    COMPANY.vatNumber ? `Momsreg.nr ${COMPANY.vatNumber}` : null,
    formatAddress(),
  ]
    .filter(Boolean)
    .join("\n");

const accountLines = (): string[] =>
  paymentAccounts().map((a) => `${a.label}: ${a.number}`);

/** Enkel inramning. Inga typsnitt, ingen CSS som hämtas någon annanstans. */
const wrapHtml = (title: string, blocks: string[]): string =>
  [
    `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;`,
    `line-height:1.6;color:#15191e;max-width:600px">`,
    `<h1 style="font-size:20px;margin:0 0 16px">${esc(title)}</h1>`,
    ...blocks,
    `<hr style="border:none;border-top:1px solid #e4e2dd;margin:24px 0">`,
    `<p style="font-size:12px;color:#5b6470;white-space:pre-line">${esc(signature())}</p>`,
    `</div>`,
  ].join("");

const p = (text: string): string =>
  `<p style="margin:0 0 12px">${esc(text)}</p>`;

/* -------------------------------------------------------------------------- */
/* Fakturan                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Momsfakturan till kundens e-post.
 *
 * Beloppen är specificerade netto, moms och att betala. En faktura som bara
 * anger totalen går inte att bokföra hos mottagaren.
 */
export const invoiceEmail = (invoice: Invoice): EmailMessage => {
  const vatPercent = `${Math.round(invoice.totals.vatRate * 100)} %`;
  const accounts = accountLines();

  const lines = [
    `Hej ${invoice.customer.name},`,
    ``,
    `Här kommer faktura ${invoice.invoiceNumber} från ${COMPANY.legalName}.`,
    ``,
    `Avser:        ${invoice.lines.map((l) => l.description).join(", ")}`,
    `Fakturadatum: ${swedishDate__email_messages(invoice.issuedAt)}`,
    `Förfallodag:  ${swedishDate__email_messages(invoice.dueAt)}`,
    ``,
    `Belopp exkl. moms: ${formatOre(invoice.totals.netOre)}`,
    `Moms ${vatPercent}:${" ".repeat(Math.max(1, 13 - vatPercent.length))}${formatOre(invoice.totals.vatOre)}`,
    `Att betala:        ${formatOre(invoice.totals.grossOre)}`,
    ``,
    ...(accounts.length > 0
      ? [`Betala till:`, ...accounts.map((a) => `  ${a}`), ``]
      : []),
    `Ange ${invoice.invoiceNumber} som referens.`,
    ``,
    `Fakturan finns också under Inställningar när du är inloggad, tillsammans`,
    `med kvittot när betalningen är registrerad.`,
    ``,
    signature(),
  ];

  return {
    recipient: invoice.customer.email,
    subject: `Faktura ${invoice.invoiceNumber} från ${COMPANY.legalName}`,
    kind: "invoice",
    bodyText: lines.join("\n"),
    bodyHtml: wrapHtml(`Faktura ${invoice.invoiceNumber}`, [
      p(`Hej ${invoice.customer.name},`),
      p(`Här kommer faktura ${invoice.invoiceNumber} från ${COMPANY.legalName}.`),
      `<table style="border-collapse:collapse;margin:0 0 16px;font-size:14px">`,
      `<tr><td style="padding:4px 16px 4px 0;color:#5b6470">Avser</td>`,
      `<td style="padding:4px 0">${esc(invoice.lines.map((l) => l.description).join(", "))}</td></tr>`,
      `<tr><td style="padding:4px 16px 4px 0;color:#5b6470">Förfallodag</td>`,
      `<td style="padding:4px 0"><strong>${esc(swedishDate__email_messages(invoice.dueAt))}</strong></td></tr>`,
      `<tr><td style="padding:4px 16px 4px 0;color:#5b6470">Exkl. moms</td>`,
      `<td style="padding:4px 0">${esc(formatOre(invoice.totals.netOre))}</td></tr>`,
      `<tr><td style="padding:4px 16px 4px 0;color:#5b6470">Moms ${esc(vatPercent)}</td>`,
      `<td style="padding:4px 0">${esc(formatOre(invoice.totals.vatOre))}</td></tr>`,
      `<tr><td style="padding:4px 16px 4px 0;color:#5b6470">Att betala</td>`,
      `<td style="padding:4px 0"><strong>${esc(formatOre(invoice.totals.grossOre))}</strong></td></tr>`,
      `</table>`,
      ...(accounts.length > 0
        ? [p(`Betala till ${accounts.join(" eller ")}. Ange ${invoice.invoiceNumber} som referens.`)]
        : [p(`Ange ${invoice.invoiceNumber} som referens.`)]),
      p("Fakturan finns också under Inställningar när du är inloggad."),
    ]),
  };
};

/* -------------------------------------------------------------------------- */
/* Kvittot                                                                    */
/* -------------------------------------------------------------------------- */

export const receiptEmail = (
  invoice: Invoice,
  payment: { paidAt: string; receiptNumber: string },
): EmailMessage => {
  const lines = [
    `Hej ${invoice.customer.name},`,
    ``,
    `Vi har tagit emot din betalning. Tack.`,
    ``,
    `Kvitto:       ${payment.receiptNumber}`,
    `Avser faktura ${invoice.invoiceNumber}`,
    `Betalt:       ${swedishDate__email_messages(payment.paidAt)}`,
    `Belopp:       ${formatOre(invoice.totals.grossOre)} varav moms ${formatOre(invoice.totals.vatOre)}`,
    ``,
    `Kvittot ligger kvar under Inställningar i din inloggning.`,
    ``,
    signature(),
  ];

  return {
    recipient: invoice.customer.email,
    subject: `Kvitto ${payment.receiptNumber} – betalning mottagen`,
    kind: "receipt",
    bodyText: lines.join("\n"),
    bodyHtml: wrapHtml(`Kvitto ${payment.receiptNumber}`, [
      p(`Hej ${invoice.customer.name},`),
      p("Vi har tagit emot din betalning. Tack."),
      p(
        `${formatOre(invoice.totals.grossOre)} mottaget ${swedishDate__email_messages(payment.paidAt)} ` +
          `avseende faktura ${invoice.invoiceNumber}, varav moms ${formatOre(invoice.totals.vatOre)}.`,
      ),
      p("Kvittot ligger kvar under Inställningar i din inloggning."),
    ]),
  };
};

/* -------------------------------------------------------------------------- */
/* Påminnelsen                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Skickas innan kontot stängs.
 *
 * Tonen är avsiktligt saklig. Mottagaren är ofta ett bolag som redan har det
 * svårt, och ett hotfullt kravbrev från oss är varken hjälpsamt eller
 * effektivt. Det som får någon att betala är att veta exakt vad, vart och
 * när - och att veta att inget försvinner om de är sena.
 */
export const paymentReminderEmail = (input: {
  recipient: string;
  customerName: string;
  invoiceNumber: string;
  dueAt: string;
  grossOre: number;
  daysLeft: number;
}): EmailMessage => {
  const accounts = accountLines();
  const when =
    input.daysLeft === 0
      ? "idag"
      : input.daysLeft === 1
        ? "imorgon"
        : `om ${input.daysLeft} dagar`;

  const lines = [
    `Hej ${input.customerName},`,
    ``,
    `Faktura ${input.invoiceNumber} på ${formatOre(input.grossOre)} förfaller ${when},`,
    `den ${swedishDate__email_messages(input.dueAt)}.`,
    ``,
    ...(accounts.length > 0 ? [`Betala till:`, ...accounts.map((a) => `  ${a}`), ``] : []),
    `Ange ${input.invoiceNumber} som referens.`,
    ``,
    `Kommer ingen betalning in stängs kontot. Det betyder att du inte kommer åt`,
    `tjänsten – inte att något raderas. Allt du lagt in ligger kvar och blir`,
    `tillgängligt igen så snart betalningen är registrerad.`,
    ``,
    `Har du frågor om fakturan, svara på det här mejlet.`,
    ``,
    signature(),
  ];

  return {
    recipient: input.recipient,
    subject: `Påminnelse: faktura ${input.invoiceNumber} förfaller ${when}`,
    kind: "payment_reminder",
    bodyText: lines.join("\n"),
    bodyHtml: wrapHtml(`Faktura ${input.invoiceNumber} förfaller ${when}`, [
      p(`Hej ${input.customerName},`),
      p(
        `Faktura ${input.invoiceNumber} på ${formatOre(input.grossOre)} förfaller ` +
          `${swedishDate__email_messages(input.dueAt)}.`,
      ),
      ...(accounts.length > 0
        ? [p(`Betala till ${accounts.join(" eller ")}. Ange ${input.invoiceNumber} som referens.`)]
        : []),
      p(
        "Kommer ingen betalning in stängs kontot. Det betyder att du inte kommer åt " +
          "tjänsten – inte att något raderas. Allt ligger kvar och blir tillgängligt " +
          "igen så snart betalningen är registrerad.",
      ),
    ]),
  };
};

/* -------------------------------------------------------------------------- */
/* Stängningen                                                                */
/* -------------------------------------------------------------------------- */

export const accountClosedEmail = (input: {
  recipient: string;
  customerName: string;
  invoiceNumber: string | null;
}): EmailMessage => {
  const accounts = accountLines();
  const lines = [
    `Hej ${input.customerName},`,
    ``,
    `Vi har inte fått in betalningen, så kontot är nu stängt.`,
    ``,
    `Ingenting är raderat. Din utvärdering, din likviditetsplan och dina`,
    `handlingar ligger kvar och blir tillgängliga igen så snart betalningen är`,
    `registrerad.`,
    ``,
    ...(input.invoiceNumber ? [`Det gäller faktura ${input.invoiceNumber}.`, ``] : []),
    ...(accounts.length > 0 ? [`Betala till:`, ...accounts.map((a) => `  ${a}`), ``] : []),
    `Stämmer inte det här, svara på det här mejlet så reder vi ut det.`,
    ``,
    signature(),
  ];

  return {
    recipient: input.recipient,
    subject: "Ditt konto är stängt – inget är raderat",
    kind: "account_closed",
    bodyText: lines.join("\n"),
    bodyHtml: wrapHtml("Ditt konto är stängt", [
      p(`Hej ${input.customerName},`),
      p("Vi har inte fått in betalningen, så kontot är nu stängt."),
      p(
        "Ingenting är raderat. Din utvärdering, din likviditetsplan och dina handlingar " +
          "ligger kvar och blir tillgängliga igen så snart betalningen är registrerad.",
      ),
      ...(accounts.length > 0 ? [p(`Betala till ${accounts.join(" eller ")}.`)] : []),
    ]),
  };
};

/* -------------------------------------------------------------------------- */
/* Inbjudan till ärendet                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Inbjudningsmejlet.
 *
 * Det viktigaste i texten är säkerhetsmodellen, uttryckt så att en icke-
 * tekniker förstår den: länken fungerar bara tillsammans med ett konto på
 * EXAKT den här adressen. Utan den meningen vidarebefordras länken "till
 * rätt person" och slutar i ett obegripligt fel.
 *
 * Bolagsnamn och inbjudarens namn kommer från användare - de escapas i
 * HTML-varianten som allt annat.
 */
export const caseInvitationEmail = (input: {
  recipient: string;
  inviterName: string;
  companyName: string;
  roleLabel: string;
  roleDescription: string;
  acceptUrl: string;
  expiresAt: string;
}): EmailMessage => {
  const lines = [
    `Hej,`,
    ``,
    `${input.inviterName} har bjudit in dig till ärendet för ${input.companyName}`,
    `på Clearance, som ${input.roleLabel.toLowerCase()}.`,
    ``,
    `Rollen innebär: ${input.roleDescription}`,
    ``,
    `Så här tackar du ja:`,
    ``,
    `  ${input.acceptUrl}`,
    ``,
    `Länken fungerar bara tillsammans med ett konto på just den här`,
    `e-postadressen (${input.recipient}). Har du inget konto skapar du ett`,
    `med samma adress först - att skicka länken vidare till någon annan ger`,
    `alltså ingen åtkomst.`,
    ``,
    `Inbjudan gäller till ${swedishDate__email_messages(input.expiresAt)}. Känner du inte igen`,
    `avsändaren kan du bortse från det här mejlet - ingenting händer om du`,
    `inte klickar.`,
    ``,
    signature(),
  ];

  return {
    recipient: input.recipient,
    subject: `Inbjudan till ärendet för ${input.companyName}`,
    kind: "case_invitation",
    bodyText: lines.join("\n"),
    bodyHtml: wrapHtml(`Inbjudan till ärendet för ${input.companyName}`, [
      p(
        `${input.inviterName} har bjudit in dig till ärendet för ` +
          `${input.companyName} på Clearance, som ${input.roleLabel.toLowerCase()}.`,
      ),
      p(`Rollen innebär: ${input.roleDescription}`),
      `<p style="margin:0 0 12px"><a href="${esc(input.acceptUrl)}">Tacka ja till inbjudan</a></p>`,
      p(
        `Länken fungerar bara tillsammans med ett konto på just den här ` +
          `e-postadressen (${input.recipient}). Har du inget konto skapar du ett ` +
          `med samma adress först.`,
      ),
      p(
        `Inbjudan gäller till ${swedishDate__email_messages(input.expiresAt)}. Känner du inte igen ` +
          `avsändaren kan du bortse från det här mejlet.`,
      ),
    ]),
  };
};

/* ==========================================================================
   src/lib/erasure.ts
   ========================================================================== */

/**
 * RADERING OCH RÄTTELSE (GDPR art. 16 och 17).
 *
 * Utdraget (art. 15 och 20) fanns redan i dataExport.ts. Radering fanns
 * som en LÄNK TILL ETT KONTAKTFORMULÄR, och rättelse som en mening om att
 * namn och telefon ändras under Dina uppgifter. Det första är inte en
 * rättighet, det är en förhoppning om att någon läser mejlen. Det andra
 * var sant men outtalat: ingenstans stod vilka uppgifter som finns, var
 * var och en ändras, och vad som INTE går att ändra själv.
 *
 * Den här filen är löftet, i kod:
 *
 *  - ERASURE_MANIFEST säger post för post vad som raderas, vad som
 *    anonymiseras och vad som BEHÅLLS - med den rättsliga grunden utsatt
 *    för varje sak vi behåller. Ett raderingslöfte utan undantagen
 *    utskrivna är ett löfte som bryts vid första bokföringsrevisionen.
 *  - RECTIFICATION_MAP säger var varje uppgift rättas, och vilka som
 *    kräver att någon annan gör det.
 *
 * VARFÖR MANIFESTET ÄR EN DATASTRUKTUR OCH INTE EN TEXT PÅ EN SIDA.
 * Databasfunktionen app.erase_user() gör det som står här. tests/dataskydd.ts
 * läser BÅDA och kräver att varje post i manifestet nämner sin tabell i
 * SQL:en - annars kan sidan lova en sak och databasen göra en annan, och
 * den skillnaden hade ingen upptäckt förrän någon begärde radering och
 * fick behålla sina uppgifter.
 */

export type ErasureAction = "raderas" | "anonymiseras" | "behalls";

export interface ErasurePost {
  /** Stabil nyckel. */
  id: string;
  /** Vad den registrerade känner igen: "Ditt mobilnummer", inte "verified_phones". */
  label: string;
  /**
   * Tabellerna posten rör. Finns här för att SQL:en ska gå att jämföra med
   * löftet - inte för att visas för användaren.
   */
  tabeller: string[];
  action: ErasureAction;
  /** Vad som faktiskt händer, i klartext. */
  vad: string;
  /**
   * Den rättsliga grunden för att BEHÅLLA. Obligatorisk för `behalls` -
   * det är hela poängen: undantag utan grund är godtycke.
   */
  grund?: string;
  /**
   * Bara för `behalls`: raderna står kvar, men en AVGRÄNSAD ändring görs
   * ändå. Fältet är inte kosmetiskt - det avgör vad tests/dataskydd.ts
   * tillåter SQL:en att göra med tabellen. Utan det får en behålld tabell
   * inte ändras över huvud taget; med det får den uppdateras på just det
   * sätt värdet namnger, men aldrig raderas.
   *
   *   atkomst-aterkallas    behörighetsraden markeras som återkallad
   */
  andring?: "atkomst-aterkallas";
}

/**
 * KARENSTIDEN.
 *
 * Begäran verkställs inte på sekunden. Sju dagar, av ett enda skäl: den
 * som sitter mitt i en kris och trycker fel ska hinna ångra sig innan
 * ärendet är borta. Tiden är ett TAK för ångerrätten, inte en fördröjning
 * vi tar oss - GDPR art. 12.3 ger en månad att svara, och sju dagar ligger
 * med god marginal inom den. Begäran kan återkallas fram till att den
 * verkställs, aldrig efteråt.
 */
export const KARENSDAGAR = 7;

/**
 * Vad radering av kontot betyder, post för post.
 *
 * Ordningen är avsiktlig: det som försvinner först, det som blir kvar
 * sist. Den som läser ska mötas av rättigheten, inte av undantagen - men
 * ska inte kunna sluta läsa innan undantagen kommit.
 */
export const ERASURE_MANIFEST: ErasurePost[] = [
  {
    id: "inloggning",
    label: "Inloggningen",
    tabeller: ["auth.users", "auth.sessions"],
    action: "anonymiseras",
    vad:
      "E-postadressen och lösenordet ersätts med en död platshållare och kontot " +
      "stängs. Alla inloggade sessioner - med IP-adress och webbläsare - raderas. " +
      "Kontoraden i sig finns kvar utan namn eller adress, så att spårbarheten i " +
      "delade ärenden inte spricker.",
  },
  {
    id: "profil",
    label: "Namn och telefon",
    tabeller: ["public.user_profiles", "public.verified_phones"],
    action: "raderas",
    vad: "Namn, telefonnummer och det verifierade mobilnumret tas bort helt.",
  },
  {
    id: "aviseringar",
    label: "Aviseringar",
    tabeller: [
      "public.notification_prefs",
      "public.notification_events",
      "public.outbound_sms",
    ],
    action: "raderas",
    vad:
      "Aviseringsvalen, notiserna och de SMS som skickats till numret raderas. " +
      "Notistexterna bär ärendets innehåll och hör därför till dig, inte till loggen.",
  },
  {
    id: "korrespondens",
    label: "Kontaktformulär och inbjudningar",
    tabeller: ["public.contact_messages", "public.case_invitations", "public.outbound_emails"],
    action: "anonymiseras",
    vad:
      "Meddelanden du skickat till oss töms på namn, adress, telefon och text. " +
      "Obesvarade inbjudningar till din adress raderas. Mejl som hör till en " +
      "faktura är undantagna - de följer fakturan.",
  },
  {
    id: "nycklar",
    label: "API-nycklar",
    tabeller: ["public.api_keys"],
    action: "raderas",
    vad: "Nycklar du skapat raderas och slutar fungera omedelbart.",
  },
  {
    id: "radgivarroll",
    label: "Rådgivarroll och byråkoppling",
    tabeller: [
      "public.professional_members",
      "public.professional_invitations",
      "public.profile_claims",
    ],
    action: "raderas",
    vad:
      "Din koppling till en rådgivarbyrå tas bort, liksom obesvarade inbjudningar " +
      "till din adress och anspråk du gjort på en profil i katalogen. Byråns egen " +
      "katalogpost berörs inte - den är bolagets uppgift, inte din.",
  },
  {
    id: "ensamma-arenden",
    label: "Ärenden ingen annan har tillgång till",
    tabeller: ["public.cases"],
    action: "raderas",
    vad:
      "Ett ärende där du var ensam kvar raderas i sin helhet - med analys, " +
      "likviditetsplan, dokument, samtal och beslut. Ingen kan nå det efter dig, " +
      "och då ska det inte finnas.",
  },
  {
    id: "delade-arenden",
    label: "Ärenden du delar med någon annan",
    tabeller: ["public.case_members", "public.case_notes", "public.case_messages"],
    action: "behalls",
    andring: "atkomst-aterkallas",
    vad:
      "Din behörighet återkallas och du kommer inte in längre. Ärendets innehåll " +
      "står kvar för dem som är kvar - din koppling till det du skrivit finns bara " +
      "som ett konto-id utan namn.",
    grund:
      "Uppgifterna avser bolaget, en juridisk person, och skyddas inte av " +
      "dataskyddsförordningen. Att radera dem hade tagit rekonstruktörens " +
      "underlag mitt i ett pågående ärende.",
  },
  {
    id: "handelselogg",
    label: "Händelseloggen",
    tabeller: ["public.audit_events"],
    action: "behalls",
    vad:
      "Vem som gjorde vad och när står kvar, med ditt konto-id men utan namn " +
      "eller adress. Loggen sparar en före- och efterbild av varje ändrad rad, " +
      "och där maskeras namn, e-postadress och telefonnummer redan när de " +
      "skrivs - loggen går inte att ändra i efterhand, och ska inte göra det.",
    grund:
      "Art. 17.3 e: nödvändig för att kunna fastställa, göra gällande eller " +
      "försvara rättsliga anspråk. Ärendets svarta låda är det enda som kan visa " +
      "vad som faktiskt beslutades, och när.",
  },
  {
    id: "signaturer",
    label: "Underskrifter",
    tabeller: ["public.document_signatures"],
    action: "behalls",
    vad: "Namn och adress i en underskrift står kvar på det dokument du signerat.",
    grund:
      "Art. 17.3 e. En underskrift utan namn bevisar ingenting - den hade " +
      "förvandlat ett undertecknat styrelsebeslut till ett papper.",
  },
  {
    id: "bokforing",
    label: "Fakturor och bokföringsunderlag",
    tabeller: ["public.customer_invoices", "public.usage_charges", "public.time_entries"],
    action: "behalls",
    vad:
      "Fakturor, kvitton, debiteringsunderlag och de tidsposter en faktura vilar " +
      "på står kvar oförändrade.",
    grund:
      "Art. 17.3 b: rättslig förpliktelse. Bokföringslagen (1999:1078) 7 kap. 2 § " +
      "kräver att räkenskapsinformation bevaras i sju år efter räkenskapsåret.",
  },
];

/** Sant om manifestet lovar något om tabellen. Används av SQL-granskningen. */
export const manifestTables = (): string[] =>
  [...new Set(ERASURE_MANIFEST.flatMap((p) => p.tabeller))].sort();

export const ERASURE_ACTION_LABEL: Record<ErasureAction, string> = {
  raderas: "Raderas",
  anonymiseras: "Anonymiseras",
  behalls: "Behålls",
};

/**
 * En rak sammanfattning: hur många poster som försvinner och hur många som
 * står kvar. Den som inte orkar läsa manifestet ska ändå få veta att det
 * FINNS undantag - att bara säga "vi raderar dina uppgifter" är osant.
 */
export const erasureSummary = (): string => {
  const bort = ERASURE_MANIFEST.filter((p) => p.action !== "behalls").length;
  const kvar = ERASURE_MANIFEST.filter((p) => p.action === "behalls").length;
  return (
    `${bort} av ${ERASURE_MANIFEST.length} kategorier raderas eller anonymiseras. ` +
    `${kvar} behålls, var och en med rättslig grund utskriven nedan.`
  );
};

/* --- Rättelse (art. 16) ---------------------------------------------------- */

export interface RectificationEntry {
  /** Uppgiften, som den heter för den registrerade. */
  uppgift: string;
  /**
   * Var den ändras. `null` betyder att den inte går att ändra själv - och
   * då MÅSTE `varfor` säga varför, och `vag` hur man får den ändrad.
   */
  plats: string | null;
  /** Länk till platsen, när den finns i produkten. */
  href?: string;
  varfor?: string;
  vag?: string;
}

/**
 * Var varje personuppgift rättas.
 *
 * Listan speglar registerutdraget: allt som kommer ut i art. 15-filen ska
 * finnas här med en väg till rättelse. tests/dataskydd.ts prövar det -
 * annars hade en ny uppgift kunnat läggas till i utdraget utan att någon
 * sa hur den rättas.
 */
export const RECTIFICATION_MAP: RectificationEntry[] = [
  {
    uppgift: "Namn",
    plats: "Dina uppgifter",
    href: "/dashboard/installningar",
  },
  {
    uppgift: "Telefonnummer",
    plats: "Dina uppgifter",
    href: "/dashboard/installningar",
  },
  {
    uppgift: "Aviseringsval",
    plats: "Aviseringar",
    href: "/dashboard/installningar",
  },
  {
    uppgift: "Uppgifterna om bolaget i ett ärende",
    plats: "Ärendet",
    href: "/dashboard",
  },
  {
    uppgift: "E-postadressen",
    plats: null,
    varfor:
      "Adressen är inloggningen. Att byta den är att byta konto, och det ska " +
      "inte gå att göra av misstag eller av någon annan än du.",
    vag: "Begär bytet via kontaktformuläret. Vi bekräftar från den gamla adressen först.",
  },
  {
    uppgift: "Uppgifter i händelseloggen",
    plats: null,
    varfor:
      "Loggen är ärendets svarta låda. En logg som går att skriva om i " +
      "efterhand är ingen logg.",
    vag:
      "Är en uppgift i loggen felaktig rättas den inte - den kompletteras med " +
      "en ny händelse som säger vad som var fel. Begär det via kontaktformuläret.",
  },
  {
    uppgift: "Namn och belopp på en faktura",
    plats: null,
    varfor: "En bokförd faktura får inte ändras i efterhand.",
    vag: "En felaktig faktura rättas med en kreditfaktura. Hör av dig så gör vi det.",
  },
];

/* ==========================================================================
   src/lib/executiveSummary.ts
   ========================================================================== */

/**
 * Systemanalysen: ledningssammanfattningen som möter användaren vid
 * inloggning.
 *
 * Rapporten ska kännas som om en erfaren rekonstruktör just satt sig in i
 * bolaget och ger VD en lägesbild: hur allvarligt är det, vad betyder det,
 * vad måste göras nu, vilka risker finns, vilka möjligheter finns kvar,
 * och vilken väg rekommenderas - alltid motiverad.
 *
 * Motorn är deterministisk: samma ärendedata ger samma rapport, tecken
 * för tecken. Det är ett medvetet val, inte en begränsning - i den här
 * produkten får ingen analys bero på en extern tjänsts dagsform, inget
 * bolags siffror lämnar servern, och varje formulering går att testa.
 * Rapporten ANALYSERAR (prioriterar, förklarar samband, lyfter det som
 * riskerar att missas) i stället för att återge listor.
 *
 * Ton: professionell, lugn, saklig, handlingsorienterad. Aldrig panik,
 * aldrig bagatellisering, aldrig uppgiven - möjlighetsavsnittet är
 * obligatoriskt. Skriven för en företagare: facktermer förklaras i
 * löptext första gången de används.
 */

export type Severity__executiveSummary = "stable" | "elevated" | "serious" | "critical";

export type ActionHorizon = "omedelbart" | "idag" | "denna vecka" | "kan vänta";

export interface SummaryAction {
  horizon: ActionHorizon;
  label: string;
  why: string;
  href: string | null;
}

export interface SummarySection {
  id: string;
  title: string;
  paragraphs: string[];
}

export interface ExecutiveSummary {
  severity: Severity__executiveSummary;
  severityLabel: string;
  headline: string;
  sections: SummarySection[];
  actions: SummaryAction[];
  strategy: string;
  generatedAt: string;
}

export interface SummaryInput {
  caseRecord: CaseRecord;
  timeline: TimelineEvent[];
  tasks: CaseTask[];
  members: CaseMemberRecord[];
  kbr: { status: KbrStatus; createdAt: string } | null;
  documentCount: number;
  payments: PaymentRecord[];
  now: Date;
  /**
   * Samma ärende, olika vyer: bolagsledningen får en affärs- och
   * handlingsorienterad rapport; praktikern (jurist, rekonstruktör,
   * förvaltare) får dessutom juridisk analys och processläge, med lagrum
   * utan förenklingar. En datamodell, rollanpassad presentation.
   */
  audience?: "company" | "practitioner";
}

const sek = (value: number): string =>
  `${String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`;

const HORIZON_ORDER: ActionHorizon[] = ["omedelbart", "idag", "denna vecka", "kan vänta"];

export const buildExecutiveSummary = (input: SummaryInput): ExecutiveSummary => {
  /**
   * Utan svar finns ingen bedömning att sammanfatta.
   *
   * Rapporten räknade tidigare på obesvarade frågor som om de vore ja,
   * och skrev "läget är hanterbart" om ett ärende där ingenting var
   * ifyllt. Samma fel som i analysen, ett lager upp - och det syntes
   * först när båda kördes i samma genomgång.
   */
  const answered = [
    input.caseRecord.canPaySalary,
    input.caseRecord.canPayTax,
    input.caseRecord.canPayRent,
    input.caseRecord.canPaySuppliers,
  ].filter((v) => v !== null).length;
  const { caseRecord: c, timeline, tasks, members, kbr, documentCount, now } = input;

  const name = c.companyName ?? c.orgNumber;
  const cannotPay = [c.canPaySalary, c.canPayTax, c.canPayRent, c.canPaySuppliers].filter(
    (v) => v === false,
  ).length;
  const totalDebt = parseAmount(c.totalDebt);
  const liquidation = parseAmount(c.quickLiquidationValue);
  const coverage = totalDebt > 0 ? liquidation / totalDebt : null;

  const sorted = [...timeline].sort((a, b) => a.iso.localeCompare(b.iso));
  const withCountdown = sorted.map((e) => ({ event: e, countdown: countdownTo(e.iso, now) }));
  const passed = withCountdown.filter((x) => x.countdown.tone === "passed");
  const today = withCountdown.filter((x) => x.countdown.tone === "today");
  const soon = withCountdown.filter((x) => x.countdown.tone === "soon");

  /* --- allvarsgrad ---------------------------------------------------------- */
  let severity: Severity__executiveSummary = "stable";
  if (cannotPay >= 1 || soon.length > 0) severity = "elevated";
  if (cannotPay >= 2 || c.recommendationType === "reconstruction" || today.length > 0)
    severity = "serious";
  if (
    passed.length > 0 ||
    c.canPayTax === false ||
    c.recommendationType === "bankruptcy" ||
    cannotPay >= 3
  )
    severity = "critical";

  const severityLabel = {
    stable: "Under kontroll",
    elevated: "Förhöjd uppmärksamhet",
    serious: "Allvarligt läge",
    critical: "Kritiskt läge",
  }[severity];

  const headline = answered === 0
    ? `Det finns ingen bedömning av ${name} än - frågorna om betalningarna är obesvarade.`
    : {
    stable: `Läget för ${name} är hanterbart, och de närmaste stegen handlar om att behålla kontrollen.`,
    elevated: `${name} har ansträngd likviditet. Läget är hanterbart, men några beslut bör inte skjutas upp.`,
    serious: `Situationen för ${name} är allvarlig. Med rätt ordning på besluten finns handlingsutrymme kvar.`,
    critical: `Läget för ${name} kräver omedelbara beslut. Prioriteringen nedan är gjord för att skydda både bolaget och dess företrädare.`,
  }[severity];

  /* --- 1. lägesbild ---------------------------------------------------------- */
  const situation: string[] = [];
  {
    const parts: string[] = [];
    if (answered === 0) {
      // Noll svar är inte samma sak som noll problem. Att skriva det förra
      // som om det vore det senare är att uppfinna ett lugn.
      parts.push(
        "Ingen av frågorna om betalningsförmågan är besvarad. Det som står nedan bygger därför bara på datumen, inte på någon bedömning av läget.",
      );
    } else if (cannotPay === 0) {
      parts.push(
        `Enligt de uppgifter som är registrerade kan bolaget i nuläget hantera sina löpande betalningar.`,
      );
    } else {
      const what = [
        c.canPaySalary === false ? "lönerna" : null,
        c.canPayTax === false ? "skatten" : null,
        c.canPayRent === false ? "hyran" : null,
        c.canPaySuppliers === false ? "leverantörerna" : null,
      ].filter(Boolean);
      parts.push(
        `Bolaget bedömer själv att ${what.join(", ").replace(/, ([^,]*)$/, " och $1")} inte kan betalas fullt ut i närtid. Det är den uppgiften som driver allvaret i lägesbilden.`,
      );
    }
    if (totalDebt > 0) {
      parts.push(
        coverage !== null && coverage < 1
          ? `Skulderna uppgår till omkring ${sek(totalDebt)}, medan tillgångarna vid en snabb försäljning bedöms täcka ungefär ${Math.round((coverage ?? 0) * 100)} procent av dem.`
          : `Skulderna uppgår till omkring ${sek(totalDebt)}.`,
      );
    }
    situation.push(parts.join(" "));
    if (c.recommendationTitle) {
      situation.push(
        `Utvärderingens samlade bedömning: ${c.recommendationTitle.toLowerCase().replace(/\.$/, "")}. ${c.recommendationReasons?.[0] ?? ""}`.trim(),
      );
    }
  }

  /* --- 2. vad betyder detta -------------------------------------------------- */
  const meaning: string[] = [];
  if (c.canPayTax === false) {
    meaning.push(
      "Juridiskt: att skatten inte kan betalas är den enskilt viktigaste signalen. Bolagets företrädare kan i vissa situationer bli personligt betalningsansvariga för obetald skatt, och skyddet ligger i att vidta en verksam åtgärd senast på skattens förfallodag – till exempel att ansöka om företagsrekonstruktion eller konkurs. Datumet styr, inte avsikten.",
    );
  }
  if (severity === "serious" || severity === "critical") {
    meaning.push(
      "Styrelseansvar: finns det skäl att anta att mer än halva aktiekapitalet är förbrukat ska styrelsen genast upprätta en kontrollbalansräkning – en särskild balansräkning som visar om den gränsen passerats. Att dokumentera när frågan prövades är i sig ett skydd för ledamöterna.",
    );
  }
  if (c.canPaySalary === false) {
    meaning.push(
      "Operativt: att lönerna är i fara påverkar personalen före allt annat. Vid en rekonstruktion eller konkurs kan den statliga lönegarantin ta över lönebetalningarna under en period – de anställda är mer skyddade än många tror, och det är ett skäl att välja en ordnad process i tid.",
    );
  }
  meaning.push(
    withCountdown.length > 0
      ? `Likviditetsmässigt: ${withCountdown.length} datum bevakas i ärendet. Närmast ligger ${withCountdown[0].event.label.toLowerCase()} (${withCountdown[0].countdown.label}). Varje passerat datum utan beslut minskar handlingsutrymmet.`
      : "Likviditetsmässigt: inga förfallodagar är registrerade ännu – lägg in de närmaste betalningarna så att rapporten kan bevaka dem.",
  );

  /* --- 3. prioriterad handlingsplan ------------------------------------------ */

  /**
   * Brådskan i LÄGET, inte bara i kalendern.
   *
   * "Omedelbart" sattes tidigare uteslutande av ett passerat datum. Ett
   * bolag som varken kunde betala löner eller skatt fick därför noll
   * punkter överst - samtidigt som analysen på samma sida sa att saken
   * bör bedömas inom dagar, inte veckor. Rapporten och analysen får inte
   * säga olika saker om samma dygn.
   *
   * Villkoret nedan är analysens egen definition av "immediate", ordagrant
   * återgiven från crisisAnalysis.ts: löner OCH skatt stoppar (båda
   * grenarna där sätter immediate), eller bedömningen är konkurs. Ändras
   * den ena måste den andra följa med - därför står källan utskriven här,
   * och därför larmar genomgången om de börjar glida isär.
   */
  const immediateByAnalysis =
    c.recommendationType === "bankruptcy" ||
    (c.canPaySalary === false && c.canPayTax === false);
  const immediate = immediateByAnalysis || passed.length > 0;

  const actions: SummaryAction[] = [];
  if (immediateByAnalysis) {
    // Det som faktiskt är omedelbart i ett sådant läge är inte en blankett
    // utan ett samtal: den som ska bedöma om verksamheten kan räddas eller
    // avvecklas ordnat behöver se ärendet nu. Att lägga en formalia överst
    // vore att prioritera fel dygn.
    actions.push({
      horizon: "omedelbart",
      label:
        c.recommendationType === "bankruptcy"
          ? "Tala med en konkursförvaltare eller affärsjurist idag"
          : "Låt en rekonstruktör se ärendet inom dagar",
      why:
        c.recommendationType === "bankruptcy"
          ? "Varken löner eller skatt kan hållas och tillgångarna täcker en mindre del av skulderna. Att fortsätta driva verksamheten vidare i det läget kan öka företrädarnas personliga ansvar."
          : "Löner och skatt stoppar samtidigt. Det är den kombination som gör frågan om rekonstruktion till en dagsfråga, inte en veckofråga.",
      href: "/marketplace",
    });
  }
  for (const x of passed) {
    actions.push({
      horizon: "omedelbart",
      label: `Hantera passerat datum: ${x.event.label}`,
      why: "Datumet har passerat utan registrerad åtgärd. Det behöver hanteras eller dokumenteras nu.",
      href: "/dashboard",
    });
  }
  if (c.canPayTax === false) {
    actions.push({
      horizon: immediate ? "omedelbart" : "idag",
      label: "Bestäm åtgärd före skattens förfallodag",
      why: "Skyddet mot personligt betalningsansvar ligger i en verksam åtgärd senast på förfallodagen.",
      href: "/kunskap/foretradaransvar",
    });
  }
  const seriousRec = c.recommendationType === "reconstruction" || c.recommendationType === "bankruptcy";
  if (!kbr && (seriousRec || severity === "critical")) {
    actions.push({
      horizon: "idag",
      label: "Gör kontrollbalansbedömningen",
      why: "Skyldigheten inträder redan vid skäl att anta kapitalbrist, och ett daterat beslut skyddar styrelsen.",
      href: "/kbr",
    });
  }
  for (const x of today) {
    actions.push({
      horizon: "idag",
      label: x.event.label,
      why: "Förfaller idag.",
      href: "/dashboard",
    });
  }
  for (const x of soon) {
    actions.push({
      horizon: "denna vecka",
      label: x.event.label,
      why: `Förfaller ${countdownTo(x.event.iso, now).label}.`,
      href: "/dashboard",
    });
  }
  const activeMembers = members.filter((m) => !m.revokedAt);
  if (activeMembers.length <= 1) {
    actions.push({
      horizon: severity === "critical" ? "denna vecka" : "kan vänta",
      label: "Bjud in revisor eller rådgivare till ärendet",
      why: "Rätt kompetens tidigt minskar risken för kostsamma felbeslut, och alla ser samma underlag.",
      href: "/dashboard/deltagare",
    });
  }
  const openTasks = tasks.filter((t) => !t.doneAt);
  for (const t of openTasks.slice(0, 3)) {
    actions.push({
      horizon: "denna vecka",
      label: t.label,
      why: "Öppen punkt i handlingsplanen.",
      href: "/dashboard",
    });
  }
  if (documentCount === 0) {
    actions.push({
      horizon: "kan vänta",
      label: "Samla underlagen i ärendet",
      why: "Kontoutdrag och rapporter på ett ställe gör varje rådgivarmöte kortare.",
      href: "/dashboard/dokument",
    });
  }
  actions.sort((a, b) => HORIZON_ORDER.indexOf(a.horizon) - HORIZON_ORDER.indexOf(b.horizon));

  /* --- 4. riskanalys ---------------------------------------------------------- */
  const risks: string[] = [];
  if (c.canPayTax === false) {
    risks.push(
      "Det finns situationer där företrädare kan bli personligt ansvariga för bolagets obetalda skatter. Här behöver styrelsen vara särskilt uppmärksam på sina skyldigheter – beslutet om åtgärd bör inte skjutas upp.",
    );
  }
  if (severity !== "stable") {
    risks.push(
      "Om inget görs krymper alternativen i takt med kassan: en rekonstruktion kräver likviditet för driften under processen, och ett underhandsackord kräver förhandlingsutrymme. Att vänta är också ett beslut – men ett odokumenterat sådant.",
    );
  }
  if (passed.length > 0) {
    risks.push(
      `${passed.length} bevakade datum har redan passerat. Passerade frister är olösta problem, inte historia – de ligger kvar överst i handlingsplanen tills de hanterats.`,
    );
  }
  if (risks.length === 0) {
    risks.push(
      "Inga akuta risker syns i det registrerade underlaget. Risken i ett stabilt läge är i stället invaggning – fortsätt bevaka fristerna och håll dokumentationen levande.",
    );
  }

  /* --- 5. möjligheter (aldrig tomt, aldrig uppgivet) -------------------------- */
  const opportunities: string[] = [];
  {
    const works = [
      c.canPaySalary !== false ? "lönerna" : null,
      c.canPayTax !== false ? "skatten" : null,
      c.canPayRent !== false ? "hyran" : null,
      c.canPaySuppliers !== false ? "leverantörsbetalningarna" : null,
    ].filter(Boolean);
    if (works.length > 0) {
      opportunities.push(
        `Det som fortfarande bär: ${works.join(", ").replace(/, ([^,]*)$/, " och $1")} kan enligt uppgifterna hanteras. Det är kärnan att bygga vidare på.`,
      );
    }
    if (coverage !== null && coverage >= 0.5) {
      opportunities.push(
        `Tillgångssidan täcker en betydande del av skulderna (${Math.round(coverage * 100)} procent vid snabb försäljning) – det ger förhandlingsutrymme gentemot borgenärerna.`,
      );
    }
    if (activeMembers.length > 1) {
      opportunities.push(
        "Ärendet delas redan med fler ögon – styrelse, revisor eller rådgivare ser samma underlag, vilket höjer kvaliteten på besluten.",
      );
    }
    opportunities.push(
      "Att situationen hanteras strukturerat är i sig en styrka: frister bevakas, beslut dokumenteras i händelseloggen och underlaget är samlat. Det är precis det en rekonstruktör, bank eller domstol vill se.",
    );
  }

  /* --- 6. rekommenderad strategi (alltid motiverad) --------------------------- */
  let strategy: string;
  switch (c.recommendationType) {
    case "stabilize":
      strategy =
        "Utifrån den information som finns idag bedöms den mest ändamålsenliga vägen vara att stabilisera i egen regi: säkra de kritiska betalningarna i tidsordning, förhandla med de största borgenärerna och följa likviditeten vecka för vecka. Motivet är att betalningsförmågan i huvudsak håller – då är en formell process ett dyrare verktyg än vad situationen kräver.";
      break;
    case "reconstruction":
      strategy =
        "Utifrån den information som finns idag bedöms den mest ändamålsenliga vägen vara att fokusera på likviditeten, säkra de kritiska betalningarna och utreda förutsättningarna för en företagsrekonstruktion innan andra alternativ övervägs. Motivet är att verksamheten bedöms ha livskraft medan balansräkningen inte bär – exakt den situation rekonstruktionsverktyget är byggt för, med betalningspaus och lönegaranti som andrum.";
      break;
    case "bankruptcy":
      strategy =
        "Utifrån den information som finns idag bedöms den mest ändamålsenliga vägen vara en ordnad avveckling: att själv ta initiativet till processen i stället för att inväntas av borgenärerna. Motivet är att en egen ansökan i rätt tid skyddar företrädarna, ger personalen lönegarantin snabbare och ger verksamhetens bärkraftiga delar störst chans att leva vidare i annan form.";
      break;
    default:
      strategy =
        "Ingen samlad rekommendation kan lämnas ännu – gör utvärderingen så att bedömningen vilar på bolagets faktiska uppgifter i stället för antaganden. Det tar några minuter och är grunden för allt annat i rapporten.";
  }

  const sections: SummarySection[] = [
    { id: "lage", title: "Övergripande lägesbild", paragraphs: situation },
    { id: "innebord", title: "Vad betyder detta?", paragraphs: meaning },
    { id: "risker", title: "Riskanalys", paragraphs: risks },
    { id: "mojligheter", title: "Möjligheter", paragraphs: opportunities },
  ];

  if (input.audience === "practitioner") {
    // Praktikervyn: lagrummen rakt, ingen pedagogisk omskrivning.
    const legal: string[] = [];
    if (!kbr && (seriousRec || severity === "critical")) {
      legal.push(
        "Kontrollbalanspunkten är öppen: ingen KBR-bedömning är registrerad trots att ABL 25 kap. 13 § sannolikt aktualiseras. Medansvarsperioden enligt 18 § löper från försummelsen – ett daterat styrelsebeslut bör säkras omgående.",
      );
    } else if (kbr) {
      legal.push(
        `KBR-bedömning finns registrerad (status: ${kbr.status}). Kontrollera att stämmospåret enligt 25 kap. 15–16 §§ följs om gränsen passerats.`,
      );
    }
    if (c.canPayTax === false) {
      legal.push(
        "Företrädaransvaret enligt 59 kap. 12–13 §§ SFL är aktuellt: verksam åtgärd krävs senast på skattens förfallodag. Rekvisiten prövas mot passivitet – dokumentera bedömningen även om beslutet blir att avvakta.",
      );
    }
    legal.push(
      "Händelseloggen i ärendet är append-only och tidsstämplad av databasen – användbar som bevisning för när styrelsen insåg respektive agerade.",
    );

    const process: string[] = [];
    process.push(
      activeMembers.length > 1
        ? `Ärendet delas av ${activeMembers.length} deltagare. ${activeMembers.some((m) => m.role === "auditor") ? "Revisor finns i ärendet." : "Revisor saknas i ärendet – granskningen av en KBR kräver det om bolaget har revisor."}`
        : "Endast företrädaren är inne i ärendet – överväg att få in styrelse och revisor via inbjudningsflödet innan beslut ska protokollföras.",
    );
    process.push(
      documentCount > 0
        ? `${documentCount} handlingar finns i akten. Aktexport (JSON) och fristkalender (ICS) kan tas ut för byråsystemet.`
        : "Akten är tom – begär in kontoutdrag, balans- och resultatrapport samt skattekontoutdrag som första komplettering.",
    );
    if (openTasks.length > 0) {
      process.push(`${openTasks.length} öppna punkter i handlingsplanen; de tre närmaste ingår i prioriteringen ovan.`);
    }

    sections.push(
      { id: "juridik", title: "Juridisk analys", paragraphs: legal },
      { id: "process", title: "Processläge", paragraphs: process },
    );
  }

  return {
    severity,
    severityLabel,
    headline,
    sections,
    actions,
    strategy,
    generatedAt: now.toISOString(),
  };
};

/* ==========================================================================
   src/lib/financial/sie.ts
   ========================================================================== */

/**
 * SIE-import: standardformatet varje svenskt bokföringsprogram exporterar.
 *
 * SIE typ 4 är filvägen till bokföringen som inte kräver något API-avtal:
 * Fortnox, Visma, Bokio, BL - alla har "exportera SIE" i menyn. Det här är
 * därför den första bokföringskopplingen som fungerar för alla kunder på
 * dag ett, och API-adaptrarna byggs sedan ovanpå samma resultat.
 *
 * Formatet (SIE-gruppens specifikation, rev. 4B):
 *   #FNAMN "Bolaget AB"          företagsnamn
 *   #ORGNR 556012-3456           organisationsnummer
 *   #RAR 0 20260101 20261231     räkenskapsår (0 = innevarande, -1 = förra)
 *   #KONTO 1930 "Företagskonto"  kontoplan
 *   #IB 0 1930 250000            ingående balans
 *   #UB 0 1930 -47000            utgående balans
 *   #RES 0 3010 -1200000         resultatkontots saldo
 *   #VER A 12 20260415 "Text"    verifikat, följt av { #TRANS ... }-block
 *
 * TECKENKODNINGEN är formatets försåtligaste egenskap: specifikationen
 * föreskriver IBM PC 8-bitars (CP437) - ett DOS-arv - medan vissa moderna
 * program exporterar UTF-8. Läses CP437 som UTF-8 blir "Företagskonto"
 * "F�retagskonto", och kontonamn är det användaren verifierar mappningen
 * mot. Därför avkodas bytes: giltig UTF-8 används som den är, annars
 * tillämpas CP437-tabellen.
 *
 * Beloppen i SIE är i kronor med punkt som decimaltecken (spec), inte
 * svensk formatering - en egen parser, inte parseSwedishAmount.
 *
 * Härledda nyckeltal (eget kapital, kassa) bygger på BAS-kontoplanens
 * intervall och är märkta ANTAGANDE i koden: BAS är konvention, inte lag,
 * och ett bolag med egen kontoplan kan avvika. Därför returneras alltid
 * kontona själva - siffran ska gå att kontrollera mot sin källa.
 */

export interface SieAccount {
  number: number;
  name: string;
  /** Utgående balans för valt räkenskapsår, i kronor. Null = ej angiven. */
  closingBalance: number | null;
  openingBalance: number | null;
  /** Saldo från #RES (resultatkonton), i kronor. */
  result: number | null;
}

export interface SieVerification {
  series: string;
  number: string;
  date: string; // ISO
  text: string;
  transactions: { account: number; amount: number }[];
}

export interface ParsedSie {
  companyName: string | null;
  orgNumber: string | null;
  /** Räkenskapsårets gränser för år 0, ISO. */
  fiscalYear: { start: string; end: string } | null;
  accounts: SieAccount[];
  verifications: SieVerification[];
  /** Rader som inte gick att tolka, med skäl. Rapporterade, aldrig gissade. */
  skipped: { line: number; reason: string }[];
  encoding: "utf-8" | "cp437";
}

export type SieOutcome = { ok: true; sie: ParsedSie } | { ok: false; error: string };

/* -------------------------------------------------------------------------- */
/* Teckenkodning                                                              */
/* -------------------------------------------------------------------------- */

/**
 * CP437:s övre halva (0x80-0xFF). Tabellen är hela poängen: webbläsarens
 * TextDecoder stödjer inte cp437, så mappningen måste ligga här.
 */
const CP437_HIGH =
  "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";

const decodeCp437 = (bytes: Uint8Array): string => {
  let out = "";
  for (const b of bytes) {
    out += b < 0x80 ? String.fromCharCode(b) : CP437_HIGH[b - 0x80];
  }
  return out;
};

export const decodeSieBytes = (bytes: Uint8Array): { text: string; encoding: "utf-8" | "cp437" } => {
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "utf-8" };
  } catch {
    return { text: decodeCp437(bytes), encoding: "cp437" };
  }
};

/* -------------------------------------------------------------------------- */
/* Radtolkning                                                                */
/* -------------------------------------------------------------------------- */

/**
 * SIE-rader är mellanslagsseparerade fält där citerade strängar kan
 * innehålla mellanslag: `#KONTO 1930 "Företagskonto SEB"`. En naiv split
 * klipper kontonamnet - därför en riktig tokeniserare.
 */
export const tokenizeSieLine = (line: string): string[] => {
  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') inQuotes = false;
      else current += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === " " || ch === "\t") {
      if (current !== "") {
        tokens.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current !== "") tokens.push(current);
  return tokens;
};

const sieDate = (raw: string): string | null => {
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

/** SIE-belopp: kronor med punktdecimal enligt spec. */
const sieAmount = (raw: string): number | null => {
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};

/* -------------------------------------------------------------------------- */
/* Parsern                                                                    */
/* -------------------------------------------------------------------------- */

export const parseSie = (bytes: Uint8Array): SieOutcome => {
  const { text, encoding } = decodeSieBytes(bytes);
  const lines = text.split(/\r?\n/);

  if (!lines.some((l) => l.trimStart().startsWith("#"))) {
    return {
      ok: false,
      error:
        "Filen ser inte ut som en SIE-fil (inga #-poster). Exportera med " +
        "'SIE 4' från bokföringsprogrammet och ladda upp filen oförändrad.",
    };
  }

  let companyName: string | null = null;
  let orgNumber: string | null = null;
  let fiscalYear: { start: string; end: string } | null = null;
  const accounts = new Map<number, SieAccount>();
  const verifications: SieVerification[] = [];
  const skipped: { line: number; reason: string }[] = [];

  const account = (num: number): SieAccount => {
    let a = accounts.get(num);
    if (!a) {
      a = { number: num, name: "", closingBalance: null, openingBalance: null, result: null };
      accounts.set(num, a);
    }
    return a;
  };

  let currentVer: SieVerification | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "" || line === "{") continue;
    if (line === "}") {
      if (currentVer) {
        verifications.push(currentVer);
        currentVer = null;
      }
      continue;
    }
    if (!line.startsWith("#")) continue;

    const tokens = tokenizeSieLine(line);
    const tag = tokens[0].toUpperCase();

    switch (tag) {
      case "#FNAMN":
        companyName = tokens[1] ?? null;
        break;
      case "#ORGNR":
        orgNumber = tokens[1] ?? null;
        break;
      case "#RAR": {
        // År 0 är det innevarande - tidigare år (-1, -2) läses inte in som
        // årets gränser.
        if (tokens[1] === "0") {
          const start = sieDate(tokens[2] ?? "");
          const end = sieDate(tokens[3] ?? "");
          if (start && end) fiscalYear = { start, end };
          else skipped.push({ line: i + 1, reason: "#RAR med ogiltiga datum" });
        }
        break;
      }
      case "#KONTO": {
        const num = Number(tokens[1]);
        if (!Number.isInteger(num)) {
          skipped.push({ line: i + 1, reason: "#KONTO utan kontonummer" });
          break;
        }
        account(num).name = tokens[2] ?? "";
        break;
      }
      case "#IB":
      case "#UB":
      case "#RES": {
        // Endast år 0. Fält: årsindex, konto, belopp.
        if (tokens[1] !== "0") break;
        const num = Number(tokens[2]);
        const amount = sieAmount(tokens[3] ?? "");
        if (!Number.isInteger(num) || amount === null) {
          skipped.push({ line: i + 1, reason: `${tag} med ogiltigt konto eller belopp` });
          break;
        }
        const a = account(num);
        if (tag === "#IB") a.openingBalance = amount;
        else if (tag === "#UB") a.closingBalance = amount;
        else a.result = amount;
        break;
      }
      case "#VER": {
        const date = sieDate(tokens[3] ?? "");
        if (!date) {
          skipped.push({ line: i + 1, reason: "#VER med ogiltigt datum" });
          break;
        }
        currentVer = {
          series: tokens[1] ?? "",
          number: tokens[2] ?? "",
          date,
          text: tokens[4] ?? "",
          transactions: [],
        };
        break;
      }
      case "#TRANS": {
        if (!currentVer) {
          skipped.push({ line: i + 1, reason: "#TRANS utanför verifikat" });
          break;
        }
        // Fält: konto, {objektlista}, belopp. Objektlistan är redan
        // borttokeniserad som "{...}" eller "{}" - beloppet är nästa
        // numeriska fält efter kontot.
        const num = Number(tokens[1]);
        const amountToken = tokens.find((t, idx) => idx >= 2 && !t.startsWith("{") && sieAmount(t) !== null);
        const amount = amountToken !== undefined ? sieAmount(amountToken) : null;
        if (!Number.isInteger(num) || amount === null) {
          skipped.push({ line: i + 1, reason: "#TRANS med ogiltigt konto eller belopp" });
          break;
        }
        currentVer.transactions.push({ account: num, amount });
        break;
      }
      default:
        // Okända poster (#GEN, #SIETYP, #DIM ...) är ofarliga och hoppas
        // över tyst - de är metadata, inte siffror.
        break;
    }
  }

  if (accounts.size === 0 && verifications.length === 0) {
    return { ok: false, error: "Filen innehöll varken kontosaldon eller verifikat." };
  }

  return {
    ok: true,
    sie: {
      companyName,
      orgNumber,
      fiscalYear,
      accounts: [...accounts.values()].sort((a, b) => a.number - b.number),
      verifications,
      skipped,
      encoding,
    },
  };
};

/* -------------------------------------------------------------------------- */
/* Härledda nyckeltal                                                         */
/* -------------------------------------------------------------------------- */

export interface SieSummary {
  /** Likvida medel: UB på 19xx. Positivt = pengar finns. */
  cash: number;
  /**
   * Eget kapital: UB på 2010-2099 plus årets resultat, tecknvänt (skulder
   * och eget kapital står i kredit i bokföringen).
   */
  equity: number;
  /** Aktiekapital: UB på konto 2081, tecknvänt. */
  shareCapital: number;
  /** Årets resultat enligt resultatkontona (3000-8999), tecknvänt: positivt = vinst. */
  result: number;
  /** Totala tillgångar: UB på 1000-1999. Det KBR-beräkningen frågar efter. */
  totalAssets: number;
  /** Totala skulder: UB på 2100-2999 plus obeskattade reserver/avsättningar, tecknvänt. */
  totalLiabilities: number;
  /** Vilka konton som ingick, för kontroll mot källan. */
  accountsUsed: {
    cash: number[];
    equity: number[];
    shareCapital: number[];
    assets: number[];
    liabilities: number[];
  };
}

/**
 * ANTAGANDE: intervallen följer BAS-kontoplanen (19xx likvida medel,
 * 2010-2099 eget kapital, 2081 aktiekapital, 3000-8999 resultat). BAS är
 * konvention, inte lag - därför returneras kontonumren som användes, så att
 * siffran kan kontrolleras mot bokföringen i stället för att litas på blint.
 * Nyckeltalen är UNDERLAG till KBR-bedömningen, inte bedömningen själv.
 */
export const summariseSie = (sie: ParsedSie): SieSummary => {
  const used = {
    cash: [] as number[],
    equity: [] as number[],
    shareCapital: [] as number[],
    assets: [] as number[],
    liabilities: [] as number[],
  };
  let cash = 0;
  let equityCredit = 0;
  let shareCapitalCredit = 0;
  let resultCredit = 0;
  let assets = 0;
  let liabilitiesCredit = 0;

  for (const a of sie.accounts) {
    if (a.number >= 1000 && a.number <= 1999 && a.closingBalance !== null) {
      assets += a.closingBalance;
      used.assets.push(a.number);
    }
    // 2100-2999: obeskattade reserver, avsättningar och skulder enligt BAS.
    // ANTAGANDE som allt annat här - kontona redovisas.
    if (a.number >= 2100 && a.number <= 2999 && a.closingBalance !== null) {
      liabilitiesCredit += a.closingBalance;
      used.liabilities.push(a.number);
    }
    if (a.number >= 1900 && a.number <= 1999 && a.closingBalance !== null) {
      cash += a.closingBalance;
      used.cash.push(a.number);
    }
    if (a.number >= 2010 && a.number <= 2099 && a.closingBalance !== null) {
      equityCredit += a.closingBalance;
      used.equity.push(a.number);
      if (a.number === 2081) {
        shareCapitalCredit += a.closingBalance;
        used.shareCapital.push(a.number);
      }
    }
    if (a.number >= 3000 && a.number <= 8999 && a.result !== null) {
      resultCredit += a.result;
    }
  }

  return {
    cash,
    // Kredit är negativt i SIE; tecknvänt så att "eget kapital 50 000" är
    // positivt när det finns.
    equity: -(equityCredit + resultCredit),
    shareCapital: -shareCapitalCredit,
    result: -resultCredit,
    totalAssets: assets,
    totalLiabilities: -liabilitiesCredit,
    accountsUsed: used,
  };
};

/* ==========================================================================
   src/lib/financial/fromSie.ts
   ========================================================================== */

/**
 * BOKFÖRINGSFILEN BLIR EN LÄGESBILD.
 *
 * `FinancialSnapshot` (model.ts) och analysmotorn (insights.ts) har funnits
 * hela tiden. Det som saknades var något som FYLLDE dem: `getLatestSnapshot`
 * returnerade `null` rakt av, med kommentaren att ingen bokföringsadapter var
 * driftsatt. Följden var att översiktens insiktslista var permanent tom i
 * skarp drift - motorn fanns, men fick aldrig något att räkna på.
 *
 * SIE-filen är den bokföringsadaptern. Varje svenskt bokföringsprogram
 * exporterar SIE, den ligger redan i produkten (`sie.ts`, med egen svit), och
 * den kräver ingen leverantörsintegration, ingen API-nyckel och inget avtal.
 *
 * Den här modulen är översättningen, och bara den: in kommer `ParsedSie`, ut
 * kommer en `FinancialSnapshot`. Ingen I/O, inga beroenden - därför går den
 * att köra i webbläsaren, i API:t och i ett test.
 *
 * TVÅ REGLER STYR ÖVERSÄTTNINGEN.
 *
 * 1. INGET GISSAS. Det SIE-filen inte säger blir en rad i `gaps` med ett
 *    läsbart skäl, inte en nolla. En nolla ser ut som ett svar; en lucka ser
 *    ut som en lucka. I ett insolvensunderlag är skillnaden avgörande - "du
 *    har inga skulder" och "vi vet inte vad du har för skulder" leder till
 *    olika beslut.
 *
 * 2. VARJE SIFFRA BÄR SITT URSPRUNG. `Provenance` sätts vid översättningen,
 *    inte i efterhand: filnamn, tidpunkt och vilket verifikat siffran kom
 *    ifrån. Det som visas för en bank eller en rekonstruktör ska gå att spåra
 *    tillbaka till en rad i bokföringen.
 *
 * TECKENKONVENTIONEN är bokföringens: tillgångar och kostnader i debet
 * (positiva), skulder, eget kapital och intäkter i kredit (negativa). Det som
 * VISAS vänds till det en människa förväntar sig - "skulder: 1 200 000", inte
 * "-1 200 000" - och det är därför vändningen görs här, en gång, i stället
 * för i varje vy.
 */

/**
 * BAS-kontoplanens intervall.
 *
 * BAS är konvention, inte lag. Ett bolag kan ha en egen kontoplan, och då
 * blir klassningen fel. Därför följer kontonumret med varje rad hela vägen
 * ut i vyn: siffran går att kontrollera mot bokföringen i stället för att
 * litas på blint. Samma antagande, och samma reservation, som summariseSie().
 */
const kontotyp = (nummer: number): AccountType => {
  if (nummer >= 1000 && nummer <= 1999) return "asset";
  if (nummer >= 2000 && nummer <= 2099) return "equity";
  if (nummer >= 2100 && nummer <= 2999) return "liability";
  if (nummer >= 3000 && nummer <= 3999) return "income";
  // 4000-8999 är kostnader och finansiella poster. 8xxx bär även skatt och
  // årets resultat, men de är kostnadssidan i den här grovindelningen.
  return "expense";
};

/** Likvida medel: 19xx enligt BAS. Kassa och bank. */
const arLikvidkonto = (nummer: number): boolean => nummer >= 1900 && nummer <= 1999;

/**
 * Utgående balans, eller null.
 *
 * `closingBalance` är balansräkningens post; `result` är resultatkontots.
 * Ett konto som saknar båda har inte förekommit i filens #UB/#RES - det är
 * en lucka, inte en nolla, och returneras som null.
 */
const utgaende = (konto: SieAccount): number | null => {
  if (konto.closingBalance !== null) return konto.closingBalance;
  if (konto.result !== null) return konto.result;
  return null;
};

const proveniens = (filnamn: string, tidpunkt: string, sourceRef: string | null): Provenance => ({
  origin: { kind: "accounting", provider: "generic", endpoint: `sie:${filnamn}` },
  fetchedAt: tidpunkt,
  sourceRef,
});

export interface SieSnapshotInput {
  /** Filnamnet som laddades upp. Följer med i varje siffras proveniens. */
  fileName: string;
  /** ISO-tidpunkt för när filen lästes. Skickas in, aldrig hämtad ur klockan. */
  capturedAt: string;
}

/**
 * Översätter en tolkad SIE-fil till en lägesbild.
 *
 * `capturedAt` skickas in i stället för att läsas ur `Date.now()`: en ren
 * funktion går att pröva, en som frågar klockan gör det inte.
 */
export const snapshotFromSie = (
  sie: ParsedSie,
  input: SieSnapshotInput,
): FinancialSnapshot => {
  const { fileName, capturedAt } = input;
  const gaps: { dataset: FinancialDataset; reason: string }[] = [];

  /* --- Kontoplanen ------------------------------------------------------- */

  const chartOfAccounts: Account[] = sie.accounts.map((k) => ({
    number: String(k.number),
    name: k.name,
    type: kontotyp(k.number),
    isCashAccount: arLikvidkonto(k.number),
    vatCode: null,
  }));

  if (chartOfAccounts.length === 0) {
    gaps.push({
      dataset: "chartOfAccounts",
      reason: "Filen innehöll inga #KONTO-rader.",
    });
  }

  /* --- Balansräkningen --------------------------------------------------- */

  const balansPoster: AccountBalance[] = [];
  let totalAssets = 0;
  let totalLiabilitiesCredit = 0;
  let equityCredit = 0;

  for (const konto of sie.accounts) {
    const typ = kontotyp(konto.number);
    if (typ !== "asset" && typ !== "liability" && typ !== "equity") continue;
    const ub = konto.closingBalance;
    if (ub === null) continue;

    balansPoster.push({
      accountNumber: String(konto.number),
      accountName: konto.name,
      type: typ,
      balance: ub,
      previousBalance: konto.openingBalance,
    });

    if (typ === "asset") totalAssets += ub;
    // Skulder och eget kapital står i kredit, alltså negativt i filen. De
    // vänds här - en gång - så att vyerna slipper göra det var för sig.
    else if (typ === "liability") totalLiabilitiesCredit += ub;
    else equityCredit += ub;
  }

  const balansProveniens = proveniens(fileName, capturedAt, "#UB");
  const balanceSheet: BalanceSheet | undefined =
    balansPoster.length === 0
      ? undefined
      : {
          asOf: sie.fiscalYear?.end ?? capturedAt.slice(0, 10),
          accounts: balansPoster,
          totalAssets,
          totalLiabilities: -totalLiabilitiesCredit,
          equity: -equityCredit,
          provenance: balansProveniens,
        };

  if (!balanceSheet) {
    gaps.push({
      dataset: "balanceSheet",
      reason: "Filen saknade utgående balanser (#UB) för balanskontona.",
    });
  }
  if (!sie.fiscalYear) {
    gaps.push({
      dataset: "balanceSheet",
      reason:
        "Filen angav inget räkenskapsår (#RAR). Balansdagen är satt till importdagen och bör kontrolleras.",
    });
  }

  /* --- Resultaträkningen -------------------------------------------------- */

  const resultatPoster: AccountBalance[] = [];
  let intaktKredit = 0;
  let kostnadDebet = 0;

  for (const konto of sie.accounts) {
    const typ = kontotyp(konto.number);
    if (typ !== "income" && typ !== "expense") continue;
    const saldo = utgaende(konto);
    if (saldo === null) continue;

    resultatPoster.push({
      accountNumber: String(konto.number),
      accountName: konto.name,
      type: typ,
      balance: saldo,
      previousBalance: null,
    });

    if (typ === "income") intaktKredit += saldo;
    else kostnadDebet += saldo;
  }

  const incomeStatement: IncomeStatement | undefined =
    resultatPoster.length === 0
      ? undefined
      : {
          from: sie.fiscalYear?.start ?? capturedAt.slice(0, 10),
          to: sie.fiscalYear?.end ?? capturedAt.slice(0, 10),
          accounts: resultatPoster,
          // Intäkter står i kredit; vänds till det en människa läser som omsättning.
          revenue: -intaktKredit,
          operatingExpenses: kostnadDebet,
          // Positivt = vinst.
          result: -intaktKredit - kostnadDebet,
          provenance: proveniens(fileName, capturedAt, "#RES"),
        };

  if (!incomeStatement) {
    gaps.push({
      dataset: "incomeStatement",
      reason: "Filen saknade resultatposter (#RES) för resultatkontona.",
    });
  }

  /* --- Verifikaten -------------------------------------------------------- */

  const vouchers: Voucher[] = sie.verifications.map((v) => ({
    id: `${v.series}${v.number}`,
    series: v.series || null,
    number: v.number || null,
    date: v.date,
    description: v.text || null,
    rows: v.transactions.map((t) => ({
      accountNumber: String(t.account),
      amount: t.amount,
      description: null,
    })),
    provenance: proveniens(fileName, capturedAt, `#VER ${v.series} ${v.number}`),
  }));

  if (vouchers.length === 0) {
    gaps.push({
      dataset: "vouchers",
      reason:
        "Filen innehöll inga verifikat (#VER). En balansfil (SIE typ 1-3) bär bara saldon; verifikat kräver typ 4.",
    });
  }

  /*
   * DET SIE INTE BÄR, sagt rakt ut.
   *
   * En SIE-fil är bokföringen, inte hela bilden. Motparter med kontaktuppgifter,
   * obetalda poster med förfallodag, banksaldon i realtid, skattekontots
   * ställning och lönekörningen finns inte i den - och den som ser en tom
   * lista ska veta om det är för att posten saknas eller för att vi aldrig
   * hade källan.
   */
  const UTANFOR_SIE: { dataset: FinancialDataset; reason: string }[] = [
    { dataset: "counterparties", reason: "SIE bär inte kund- och leverantörsregister med kontaktuppgifter." },
    { dataset: "openItems", reason: "SIE bär inte obetalda poster med förfallodag. Ladda upp kontoutdrag eller anslut bokföringssystemet." },
    { dataset: "bankAccounts", reason: "SIE bär bokförda saldon, inte bankens aktuella ställning." },
    { dataset: "taxAccount", reason: "Skattekontots ställning hämtas från Skatteverket, inte ur bokföringen." },
    { dataset: "payroll", reason: "SIE bär lönekostnaden som konto, inte lönekörningen per anställd." },
  ];
  gaps.push(...UTANFOR_SIE);

  /* --- Rader filen själv inte kunde tolka --------------------------------- */

  // parseSie rapporterar överhoppade rader i stället för att tiga om dem.
  // De följer med hit, så att den som läser lägesbilden ser att källan var
  // ofullständig - inte bara att en siffra ser låg ut.
  for (const rad of sie.skipped.slice(0, 20)) {
    gaps.push({
      dataset: "chartOfAccounts",
      reason: `Rad ${rad.line} kunde inte tolkas: ${rad.reason}`,
    });
  }
  if (sie.skipped.length > 20) {
    gaps.push({
      dataset: "chartOfAccounts",
      reason: `Ytterligare ${sie.skipped.length - 20} rader kunde inte tolkas.`,
    });
  }

  return {
    id: `sie:${capturedAt}`,
    provider: "generic",
    capturedAt,
    orgNumber: sie.orgNumber,
    companyName: sie.companyName,
    chartOfAccounts: chartOfAccounts.length > 0 ? chartOfAccounts : undefined,
    balanceSheet,
    incomeStatement,
    vouchers: vouchers.length > 0 ? vouchers : undefined,
    gaps,
  };
};

/* ==========================================================================
   src/lib/financial/insights.ts
   ========================================================================== */

/**
 * The insight engine behind the reconstruction assistant.
 *
 * WHY THIS IS NOT A LANGUAGE MODEL.
 *
 * Almost every insight the assistant is meant to produce is arithmetic:
 *
 *   "Likviditeten tar slut om 47 dagar."          -> a projection
 *   "13 leverantörer står för 82 % av skulderna." -> a sorted cumulative sum
 *   "Tre kundfordringar över 500 000 kr är försenade." -> a filter
 *   "Nästa lagstadgade deadline är om fem dagar." -> a date comparison
 *   "Följande rapport saknas inför nästa steg."   -> a set difference
 *
 * Running those through a language model would make them slower, unrepeatable,
 * impossible to unit test, and capable of stating a number that is not in the
 * data. In a product that tells someone whether their company is insolvent,
 * a hallucinated figure is the worst defect available. So these are pure
 * functions, every one of them carries the numbers it was derived from, and
 * every one is covered by a test.
 *
 * What a language model is genuinely good for here is the residue: phrasing a
 * covering letter, summarising a month of variances in prose, drafting a reply
 * to a creditor. Those go elsewhere, are always marked as drafts, and never
 * set a status or a figure.
 */

export type InsightSeverity = "critical" | "warning" | "info";

export interface Insight {
  id: string;
  severity: InsightSeverity;
  /** One line, written for someone under stress. No hedging, no jargon. */
  title: string;
  /** Two or three sentences of context and what to do about it. */
  detail: string;
  /**
   * The figures behind the claim, so it can be checked rather than believed.
   * Rendered next to the insight, not hidden behind a disclosure.
   */
  evidence: { label: string; value: string }[];
  /** Where the user should go to act on it. */
  action?: { label: string; href: string };
  /** Always "deterministic" for everything in this file. */
  basis: "deterministic";
}

const sek__financial_insights = (value: number): string =>
  `${Math.round(value).toLocaleString("sv-SE")} kr`;

const pct = (ratio: number): string => `${Math.round(ratio * 100)} %`;

const today = (now: Date): string => now.toISOString().slice(0, 10);

/* -------------------------------------------------------------------------- */
/* Concentration                                                              */
/* -------------------------------------------------------------------------- */

export interface Concentration {
  /** Counterparties needed to reach the threshold share. */
  count: number;
  /** Share of the total those counterparties represent. */
  share: number;
  total: number;
  top: { name: string; amount: number; share: number }[];
}

/**
 * How few counterparties make up most of the exposure.
 *
 * This is the number that changes behaviour: negotiating with 13 suppliers is
 * a week's work, negotiating with 400 is not a plan. Returns the smallest set
 * reaching `threshold` of the total.
 */
export const concentration = (
  items: OpenItem[],
  threshold = 0.8,
): Concentration | null => {
  if (items.length === 0) return null;

  const byCounterparty = new Map<string, { name: string; amount: number }>();
  for (const item of items) {
    const existing = byCounterparty.get(item.counterpartyId);
    if (existing) existing.amount += item.outstandingAmount;
    else
      byCounterparty.set(item.counterpartyId, {
        name: item.counterpartyName,
        amount: item.outstandingAmount,
      });
  }

  const sorted = [...byCounterparty.values()].sort((a, b) => b.amount - a.amount);
  const total = sorted.reduce((sum, c) => sum + c.amount, 0);
  if (total <= 0) return null;

  let running = 0;
  let count = 0;
  for (const entry of sorted) {
    running += entry.amount;
    count += 1;
    if (running / total >= threshold) break;
  }

  return {
    count,
    share: running / total,
    total,
    top: sorted.slice(0, 10).map((c) => ({
      name: c.name,
      amount: c.amount,
      share: c.amount / total,
    })),
  };
};

/* -------------------------------------------------------------------------- */
/* Ageing                                                                     */
/* -------------------------------------------------------------------------- */

export interface AgeingBucket {
  label: string;
  /** Inclusive lower bound in days overdue. */
  fromDays: number;
  /** Exclusive upper bound, or null for open-ended. */
  toDays: number | null;
  count: number;
  amount: number;
}

export const ageing = (
  items: OpenItem[],
  asOf: string,
): AgeingBucket[] => {
  const buckets: AgeingBucket[] = [
    { label: "Ej förfallet", fromDays: -Infinity, toDays: 1, count: 0, amount: 0 },
    { label: "1–30 dagar", fromDays: 1, toDays: 31, count: 0, amount: 0 },
    { label: "31–60 dagar", fromDays: 31, toDays: 61, count: 0, amount: 0 },
    { label: "61–90 dagar", fromDays: 61, toDays: 91, count: 0, amount: 0 },
    { label: "Över 90 dagar", fromDays: 91, toDays: null, count: 0, amount: 0 },
  ];

  for (const item of items) {
    const overdueDays = daysBetween(item.dueDate, asOf);
    const bucket = buckets.find(
      (b) => overdueDays >= b.fromDays && (b.toDays === null || overdueDays < b.toDays),
    );
    if (bucket) {
      bucket.count += 1;
      bucket.amount += item.outstandingAmount;
    }
  }

  return buckets;
};

/* -------------------------------------------------------------------------- */
/* Cost outliers                                                              */
/* -------------------------------------------------------------------------- */

export interface CostOutlier {
  accountNumber: string;
  accountName: string;
  period: string;
  amount: number;
  /** Typical amount for this account, as a median. */
  typical: number;
  /** How many robust deviations above typical. */
  deviations: number;
}

const median__financial_insights = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

/**
 * Finds unusually large costs by comparing each month against the same
 * account's own history.
 *
 * Uses median and median absolute deviation rather than mean and standard
 * deviation: a single enormous month would drag a mean upwards and hide
 * itself, which is precisely the month worth finding.
 *
 * Requires at least `minPeriods` of history; with less, there is no such
 * thing as unusual and the function says nothing rather than guessing.
 */
export const costOutliers = (
  snapshot: FinancialSnapshot,
  { minPeriods = 4, threshold = 3 }: { minPeriods?: number; threshold?: number } = {},
): CostOutlier[] => {
  if (!snapshot.vouchers || snapshot.vouchers.length === 0) return [];

  const accountNames = new Map(
    (snapshot.chartOfAccounts ?? []).map((a) => [a.number, a.name]),
  );
  // Distinguish "no chart of accounts supplied" from "chart supplied, and it
  // says these are not costs". Falling back to "count everything" in the
  // second case treats revenue accounts as expenses.
  const hasChart = (snapshot.chartOfAccounts ?? []).length > 0;
  const expenseAccounts = new Set(
    (snapshot.chartOfAccounts ?? [])
      .filter((a) => a.type === "expense")
      .map((a) => a.number),
  );

  // account -> period (yyyy-MM) -> summed amount
  const byAccountPeriod = new Map<string, Map<string, number>>();
  for (const voucher of snapshot.vouchers) {
    const period = voucher.date.slice(0, 7);
    for (const row of voucher.rows) {
      if (hasChart && !expenseAccounts.has(row.accountNumber)) continue;
      // Expenses are debits, i.e. positive in this model.
      if (row.amount <= 0) continue;
      let periods = byAccountPeriod.get(row.accountNumber);
      if (!periods) {
        periods = new Map();
        byAccountPeriod.set(row.accountNumber, periods);
      }
      periods.set(period, (periods.get(period) ?? 0) + row.amount);
    }
  }

  const outliers: CostOutlier[] = [];

  for (const [accountNumber, periods] of byAccountPeriod) {
    if (periods.size < minPeriods) continue;
    const amounts = [...periods.values()];
    const typical = median__financial_insights(amounts);
    if (typical <= 0) continue;

    const mad = median__financial_insights(amounts.map((a) => Math.abs(a - typical)));
    // A perfectly regular account has zero spread; fall back to a share of
    // the typical amount so a genuine jump is still detectable.
    const spread = mad > 0 ? mad : typical * 0.1;

    for (const [period, amount] of periods) {
      const deviations = (amount - typical) / spread;
      if (deviations >= threshold) {
        outliers.push({
          accountNumber,
          accountName: accountNames.get(accountNumber) ?? accountNumber,
          period,
          amount,
          typical,
          deviations: Math.round(deviations * 10) / 10,
        });
      }
    }
  }

  return outliers.sort((a, b) => b.amount - a.amount);
};

/* -------------------------------------------------------------------------- */
/* Payment priority                                                           */
/* -------------------------------------------------------------------------- */

export type PriorityReason =
  | "personal_liability"
  | "wage_guarantee"
  | "critical_supplier"
  | "overdue"
  | "ordinary";

export interface PrioritisedPayment {
  label: string;
  amount: number;
  dueDate: string;
  reason: PriorityReason;
  /** Lower sorts first. */
  rank: number;
  note: string;
}

/**
 * Orders upcoming payments by consequence rather than by size.
 *
 * The ordering is legally informed, which is the whole point: unpaid tax on
 * its due date can make a company representative personally liable
 * (Skatteförfarandelagen 59 kap. 12–13 §§), and that consequence does not
 * scale with the amount. A 40 000 kr tax payment outranks a 400 000 kr
 * supplier invoice.
 *
 * IMPORTANT: this is a suggestion for planning, not advice on whom to pay.
 * Selective payments to individual creditors before an insolvency can be
 * recovered by the estate (Konkurslagen 4 kap.) and can increase personal
 * exposure. The interface must carry that warning wherever this is shown -
 * see `PRIORITY_WARNING`.
 */
export const PRIORITY_WARNING =
  "Det här är en planeringsordning, inte ett råd om vem du ska betala. Att betala enskilda borgenärer före andra när bolaget är på obestånd kan återvinnas i efterhand och kan öka ditt personliga ansvar. Stäm av med en jurist innan du prioriterar bort någon.";

const RANK: Record<PriorityReason, number> = {
  personal_liability: 1,
  wage_guarantee: 2,
  critical_supplier: 3,
  overdue: 4,
  ordinary: 5,
};

const TAX_PATTERN = /(skatteverket|skattekonto|moms|arbetsgivaravgift|preliminärskatt|f-skatt)/i;
const SALARY_PATTERN = /(lön|löner|lönekörning|salary|payroll)/i;

export const prioritisePayments = (
  payments: { label: string; amount: number; dueDate: string }[],
  options: { criticalSupplierIds?: string[]; asOf: string } = { asOf: "" },
): PrioritisedPayment[] =>
  payments
    .map((payment) => {
      let reason: PriorityReason = "ordinary";
      let note = "Vanlig betalning.";

      if (TAX_PATTERN.test(payment.label)) {
        reason = "personal_liability";
        note =
          "Skatt och moms. Uteblir betalningen på förfallodagen kan du bli personligen betalningsskyldig om ingen verksam åtgärd vidtagits.";
      } else if (SALARY_PATTERN.test(payment.label)) {
        reason = "wage_guarantee";
        note =
          "Löner. Lönegarantin träder in först vid konkurs eller rekonstruktion, inte för att pengarna saknas.";
      } else if (options.asOf && daysBetween(payment.dueDate, options.asOf) > 0) {
        reason = "overdue";
        note = "Redan förfallen.";
      }

      return { ...payment, reason, rank: RANK[reason], note };
    })
    .sort((a, b) => a.rank - b.rank || a.dueDate.localeCompare(b.dueDate));

/* -------------------------------------------------------------------------- */
/* The assistant                                                              */
/* -------------------------------------------------------------------------- */

export interface AssistantOptions {
  /** Injected so the output is deterministic and testable. */
  now: Date;
  /** Receivables above this are called out individually. */
  largeReceivableThreshold?: number;
  /** Days ahead to look for upcoming payments. */
  horizonDays?: number;
}

/**
 * Turns a snapshot into the list the dashboard shows.
 *
 * Ordered by severity, then by size of consequence. Says nothing when it
 * knows nothing - a missing dataset produces an explicit "we cannot see this"
 * insight rather than a reassuring silence.
 */
export const analyseSnapshot = (
  snapshot: FinancialSnapshot,
  options: AssistantOptions,
): Insight[] => {
  const { now, largeReceivableThreshold = 100_000, horizonDays = 30 } = options;
  const asOf = today(now);
  const insights: Insight[] = [];

  const openItems = snapshot.openItems ?? [];
  const payables = openItems.filter((i) => i.kind === "payable");
  const receivables = openItems.filter((i) => i.kind === "receivable");

  /* --- cash and runway ------------------------------------------------- */

  if (snapshot.bankAccounts && snapshot.bankAccounts.length > 0) {
    const cash = totalCash(snapshot.bankAccounts);
    const dueSoon = payables.filter(
      (i) => daysBetween(asOf, i.dueDate) <= horizonDays,
    );
    const dueSoonTotal = dueSoon.reduce((s, i) => s + i.outstandingAmount, 0);

    if (dueSoonTotal > cash) {
      insights.push({
        id: "cash-shortfall",
        severity: "critical",
        title: `Pengarna räcker inte till det som ska betalas den närmaste månaden`,
        detail: `Kassan är ${sek__financial_insights(cash)}. ${sek__financial_insights(dueSoonTotal)} är redan förfallet eller förfaller inom ${horizonDays} dagar. Underskottet är ${sek__financial_insights(dueSoonTotal - cash)}. Bygg en likviditetsplan och avgör vilka betalningar som måste omförhandlas.`,
        evidence: [
          { label: "Kassa", value: sek__financial_insights(cash) },
          { label: `Förfallet eller förfaller inom ${horizonDays} d`, value: sek__financial_insights(dueSoonTotal) },
          { label: "Antal fakturor", value: String(dueSoon.length) },
        ],
        action: { label: "Öppna likviditetsplanen", href: "/likviditetsplan" },
        basis: "deterministic",
      });
    }
  }

  /* --- supplier concentration ------------------------------------------ */

  const payableConcentration = concentration(payables, 0.8);
  if (payableConcentration && payableConcentration.count > 0) {
    insights.push({
      id: "creditor-concentration",
      severity: "info",
      title: `${payableConcentration.count} leverantörer står för ${pct(payableConcentration.share)} av skulderna`,
      detail:
        payableConcentration.count <= 20
          ? "Det är få nog att gå igenom en och en. Börja där - en uppgörelse med dem täcker merparten av skulden."
          : "Skulden är utspridd, vilket gör individuella uppgörelser tunga. Ett samlat upplägg via rekonstruktion kan vara mer realistiskt.",
      evidence: [
        { label: "Total leverantörsskuld", value: sek__financial_insights(payableConcentration.total) },
        { label: "Antal leverantörer", value: String(payableConcentration.count) },
        {
          label: "Största",
          value: `${payableConcentration.top[0]?.name ?? "–"} · ${sek__financial_insights(payableConcentration.top[0]?.amount ?? 0)}`,
        },
      ],
      basis: "deterministic",
    });
  }

  /* --- large overdue receivables --------------------------------------- */

  const largeOverdue = receivables
    .filter((i) => isOverdue(i, asOf) && i.outstandingAmount >= largeReceivableThreshold)
    .sort((a, b) => b.outstandingAmount - a.outstandingAmount);

  if (largeOverdue.length > 0) {
    const sum = largeOverdue.reduce((s, i) => s + i.outstandingAmount, 0);
    insights.push({
      id: "large-overdue-receivables",
      severity: "warning",
      title:
        largeOverdue.length === 1
          ? `En kundfordran över ${sek__financial_insights(largeReceivableThreshold)} är försenad`
          : `${largeOverdue.length} kundfordringar över ${sek__financial_insights(largeReceivableThreshold)} är försenade`,
      detail: `Sammanlagt ${sek__financial_insights(sum)} som redan skulle ha betalats. Det är oftast den snabbaste vägen till likviditet - snabbare än att förhandla om utgifter.`,
      evidence: largeOverdue.slice(0, 5).map((i) => ({
        label: `${i.counterpartyName} (${daysBetween(i.dueDate, asOf)} d sen)`,
        value: sek__financial_insights(i.outstandingAmount),
      })),
      basis: "deterministic",
    });
  }

  /* --- ageing ---------------------------------------------------------- */

  const payableAgeing = ageing(payables, asOf);
  const deeplyOverdue = payableAgeing[payableAgeing.length - 1];
  if (deeplyOverdue && deeplyOverdue.amount > 0) {
    insights.push({
      id: "payables-over-90",
      severity: "warning",
      title: `${sek__financial_insights(deeplyOverdue.amount)} i leverantörsskulder är över 90 dagar försenade`,
      detail:
        "Skulder som legat så länge leder ofta till inkasso eller betalningsföreläggande. Kontakta dem innan de gör det - förhandlingsläget är bättre före än efter.",
      evidence: payableAgeing
        .filter((b) => b.amount > 0)
        .map((b) => ({ label: b.label, value: `${sek__financial_insights(b.amount)} (${b.count} st)` })),
      basis: "deterministic",
    });
  }

  /* --- cost outliers --------------------------------------------------- */

  const outliers = costOutliers(snapshot);
  if (outliers.length > 0) {
    const worst = outliers[0];
    insights.push({
      id: "cost-outlier",
      severity: "info",
      title: `Ovanligt stor kostnad på konto ${worst.accountNumber} i ${worst.period}`,
      detail: `${sek__financial_insights(worst.amount)} mot normalt ${sek__financial_insights(worst.typical)} för samma konto. Kan vara en engångspost, en felkontering eller något som går att omförhandla - värt att titta på.`,
      evidence: outliers.slice(0, 5).map((o) => ({
        label: `${o.accountNumber} ${o.accountName} · ${o.period}`,
        value: `${sek__financial_insights(o.amount)} (normalt ${sek__financial_insights(o.typical)})`,
      })),
      basis: "deterministic",
    });
  }

  /* --- what we cannot see ---------------------------------------------- */

  if (snapshot.gaps.length > 0) {
    insights.push({
      id: "missing-datasets",
      severity: "warning",
      title: "Delar av ekonomin kunde inte hämtas",
      detail:
        "Bedömningen bygger bara på det som gick att läsa. Fyll i det som saknas för hand, annars ser läget bättre ut än det är.",
      evidence: snapshot.gaps.map((g) => ({ label: g.dataset, value: g.reason })),
      basis: "deterministic",
    });
  }

  const order: Record<InsightSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return insights.sort((a, b) => order[a.severity] - order[b.severity]);
};

/* ==========================================================================
   src/lib/financial/ports.ts
   ========================================================================== */

/**
 * The Accounting Integration Hub's contract.
 *
 * One adapter per accounting system, all satisfying this interface. Nothing
 * above this layer knows that Fortnox exists. Adding Bokio is a new file and
 * a registry entry, not a change to any screen.
 *
 * WHERE THE ADAPTERS RUN: not here. Every provider on the list uses OAuth2
 * with a confidential client, and this application is a public SPA - the
 * client secret and the refresh tokens cannot live in this bundle. Adapters
 * execute server-side; the browser talks to our own backend, which holds the
 * tokens and returns a FinancialSnapshot. This file is the shape of that
 * contract on both sides of the wire.
 *
 * ASSUMPTIONS to verify against live vendor documentation before writing each
 * adapter - none of them affect this interface, which is the point:
 *  - exact scope names and endpoint paths
 *  - whether the vendor requires partner registration or app review
 *  - rate limits, and whether a full ledger fetch needs pagination or a
 *    nightly job rather than a request/response cycle
 *  - refresh token rotation and lifetime
 */

export interface ProviderDescriptor {
  id: ProviderId;
  /** Name as the user knows it. */
  label: string;
  capabilities: FinancialCapabilities;
  /**
   * Shown when a dataset is missing, so the user is told what to enter by
   * hand rather than being left with an empty screen.
   */
  notes?: Partial<Record<FinancialDataset, string>>;
}

export interface ConnectionStatus {
  provider: ProviderId;
  connected: boolean;
  /** ISO timestamp of the last successful fetch. */
  lastSyncAt: string | null;
  /**
   * Set when the connection exists but has stopped working - an expired or
   * revoked token, a withdrawn consent, a changed subscription.
   *
   * This must never be reported as "no data". A company that sees 0 kr in
   * supplier debt because a token expired will draw exactly the wrong
   * conclusion, and it is the sort of wrong conclusion this product exists
   * to prevent.
   */
  error: string | null;
}

export interface FetchOptions {
  /** ISO date. Ledger and open items are fetched from here. */
  from?: string;
  /** ISO date. Defaults to today. */
  to?: string;
  /** Skip datasets the caller does not need, to stay inside rate limits. */
  datasets?: FinancialDataset[];
}

export type FetchResult =
  | { ok: true; snapshot: FinancialSnapshot }
  | { ok: false; error: string; reauthorisationRequired: boolean };

export interface AccountingPort {
  /** Providers this deployment has credentials configured for. */
  listProviders(): Promise<ProviderDescriptor[]>;

  /** URL to send the user to in order to grant access. */
  startAuthorisation(provider: ProviderId, returnTo: string): Promise<string>;

  status(provider: ProviderId): Promise<ConnectionStatus>;

  /**
   * Reads a snapshot. Must fail loudly rather than return an empty snapshot:
   * see the note on ConnectionStatus.error.
   */
  fetchSnapshot(provider: ProviderId, options?: FetchOptions): Promise<FetchResult>;

  /** Previously captured snapshots, newest first. Snapshots are immutable. */
  listSnapshots(caseId: string): Promise<FinancialSnapshot[]>;

  disconnect(provider: ProviderId): Promise<void>;
}

/* -------------------------------------------------------------------------- */
/* Provider registry                                                          */
/* -------------------------------------------------------------------------- */

const caps = (
  on: FinancialDataset[],
): FinancialCapabilities => ({
  chartOfAccounts: on.includes("chartOfAccounts"),
  balanceSheet: on.includes("balanceSheet"),
  incomeStatement: on.includes("incomeStatement"),
  vouchers: on.includes("vouchers"),
  counterparties: on.includes("counterparties"),
  openItems: on.includes("openItems"),
  bankAccounts: on.includes("bankAccounts"),
  taxAccount: on.includes("taxAccount"),
  payroll: on.includes("payroll"),
  costCenters: on.includes("costCenters"),
  projects: on.includes("projects"),
  budget: on.includes("budget"),
});

const NO_TAX_ACCOUNT_NOTE =
  "Skattekontots saldo hos Skatteverket går inte att hämta här. Siffran visar vad bolaget själv har bokfört, vilket ofta skiljer sig från myndighetens. Stäm av mot ditt skattekonto.";

/**
 * What each provider is expected to supply.
 *
 * MARKED AS ASSUMPTION IN FULL. These entries are a planning baseline, not
 * verified capability matrices - vendor APIs change and several of these
 * require a partner agreement before the real surface is even visible. Each
 * row must be confirmed against live documentation when its adapter is
 * written, and the descriptor updated. The interface does not depend on
 * getting them right today; the onboarding copy does.
 */
export const PROVIDER_REGISTRY: ProviderDescriptor[] = [
  {
    id: "fortnox",
    label: "Fortnox",
    capabilities: caps([
      "chartOfAccounts",
      "balanceSheet",
      "incomeStatement",
      "vouchers",
      "counterparties",
      "openItems",
      "costCenters",
      "projects",
    ]),
    notes: { taxAccount: NO_TAX_ACCOUNT_NOTE },
  },
  {
    id: "visma",
    label: "Visma eEkonomi",
    capabilities: caps([
      "chartOfAccounts",
      "balanceSheet",
      "incomeStatement",
      "vouchers",
      "counterparties",
      "openItems",
      "costCenters",
      "projects",
    ]),
    notes: { taxAccount: NO_TAX_ACCOUNT_NOTE },
  },
  {
    id: "bjornlunden",
    label: "Björn Lundén",
    capabilities: caps([
      "chartOfAccounts",
      "balanceSheet",
      "incomeStatement",
      "vouchers",
      "counterparties",
      "openItems",
    ]),
    notes: { taxAccount: NO_TAX_ACCOUNT_NOTE },
  },
  {
    id: "bokio",
    label: "Bokio",
    capabilities: caps([
      "chartOfAccounts",
      "balanceSheet",
      "incomeStatement",
      "vouchers",
      "openItems",
    ]),
    notes: {
      taxAccount: NO_TAX_ACCOUNT_NOTE,
      counterparties: "Motpartsregister kan behöva kompletteras för hand.",
    },
  },
  {
    id: "peaccounting",
    label: "PE Accounting",
    capabilities: caps([
      "chartOfAccounts",
      "balanceSheet",
      "incomeStatement",
      "vouchers",
      "counterparties",
      "openItems",
      "payroll",
      "costCenters",
      "projects",
    ]),
    notes: { taxAccount: NO_TAX_ACCOUNT_NOTE },
  },
  {
    id: "businesscentral",
    label: "Microsoft Dynamics 365 Business Central",
    capabilities: caps([
      "chartOfAccounts",
      "balanceSheet",
      "incomeStatement",
      "vouchers",
      "counterparties",
      "openItems",
      "bankAccounts",
      "costCenters",
      "projects",
      "budget",
    ]),
    notes: { taxAccount: NO_TAX_ACCOUNT_NOTE },
  },
];

/**
 * Leverantörens namn som det VISAS, aldrig som det lagras.
 *
 * Översikten skrev "Från fortnox" - det råa id:t, med gemener, rakt in i
 * en mening som pekar ut varifrån bolagets siffror kommer. Ett varumärke
 * med fel skiftläge är en liten sak som gör en stor: raden finns för att
 * skapa förtroende för källan, och ett systemnamn i loggformat gör
 * motsatsen.
 *
 * "generic" står inte i registret med flit - det är SIE-filens och
 * handinmatningens ursprung, inte en leverantör - och får därför en egen
 * läsbar text i stället för att falla tillbaka till id:t.
 */
export const providerLabel = (id: string): string => {
  if (id === "generic") return "importerat underlag";
  return PROVIDER_REGISTRY.find((p) => p.id === id)?.label ?? id;
};

/** Datasets the user must supply by hand for a given provider. */
export const manualDatasets = (
  descriptor: ProviderDescriptor,
  required: FinancialDataset[],
): FinancialDataset[] =>
  required.filter((dataset) => !descriptor.capabilities[dataset]);

/* ==========================================================================
   src/lib/guide/catalogue.ts
   ========================================================================== */

/**
 * FUNKTIONSKATALOGEN - kontraktet bakom "visa, berätta inte".
 *
 * Designprincipen för hela plattformen:
 *
 *   Användaren ska aldrig behöva leta efter en funktion som CLEARANCE
 *   känner till. Nämner CLEARANCE en funktion ska den samtidigt kunna
 *   VISA exakt var den finns, förklara VARFÖR den används, visa VAD som
 *   sparats där, och hur användaren SJÄLV administrerar den sedan.
 *
 * En princip som bara står i en designguide är en åsikt. Den här filen
 * gör den till ett kontrakt: varje funktion CLEARANCE får nämna står
 * här, med alla fyra svaren och med en adress som går att navigera till.
 * tests/guide.ts vaktar att adressen finns i App.tsx, att ankaret finns
 * som ett `data-guide`-attribut någonstans i källträdet, och att inget
 * av de fyra svaren saknas.
 *
 * Konsekvensen är avsiktlig och obekväm: den som lägger till en ny vy
 * och vill att CLEARANCE ska kunna prata om den måste också kunna svara
 * på varför den finns och hur användaren sköter den. Kan man inte det
 * är funktionen inte färdig.
 *
 * ANKARE, INTE SELEKTORER. Målen pekas ut med `data-guide="namn"` och
 * aldrig med en CSS-klass eller en position. En klass byter namn vid
 * nästa designrond utan att någon märker att guiden slutat peka; ett
 * ankare som försvinner fäller testet.
 */

/**
 * Vem en funktion finns för.
 *
 * "ops" är INTE en användarroll i datamodellen - behörigheten kommer ur
 * `app.is_admin()`, inte ur profilen, och en driftanvändare är dessutom
 * alltid också företagare eller rådgivare. Katalogen behöver ändå kunna
 * skilja driftvyerna från produkten, och därför är publiken ett eget
 * begrepp här i stället för en påhittad tredje UserRole. Att låtsas att
 * det finns en admin-roll i datamodellen hade varit en lögn som förr
 * eller senare hamnat i en behörighetskontroll.
 */
export type GuideAudience = UserRole | "ops";

export interface GuideEntry {
  id: string;
  /** Vad funktionen heter i gränssnittet. Exakt samma ord som på skärmen. */
  label: string;
  /** Adressen. Måste finnas som route i App.tsx. */
  route: string;
  /**
   * Elementet som ska ringas in när användaren kommit fram. Måste finnas
   * som data-guide i källträdet.
   */
  anchor: string;
  /**
   * Menyvalet som leder dit, PER ROLL. Ringas in på vägen, så att
   * användaren ser vilken väg som togs och kan gå den själv nästa gång.
   *
   * Per roll, för att menyerna skiljer sig åt: en jurist når
   * likviditeten och handlingarna genom det aktiva ärendet, men har
   * inga egna menyval för dem. Ett menyval som ringas in för någon som
   * inte har det pekar på ingenting - och det är precis den sortens
   * tomma anvisning principen finns för att förhindra. Saknas rollen i
   * posten hoppar guiden över menysteget och går rakt till vyn.
   */
  navAnchor: Partial<Record<GuideAudience, string>>;
  /** Varför funktionen används. Ett skäl, inte en beskrivning. */
  why: string;
  /** Vad som sparas där. Det här är svaret på "vart tog mina uppgifter vägen?". */
  saves: string;
  /** Hur användaren själv ändrar eller sköter det sedan. */
  manage: string;
  /**
   * Ord som ska leda hit när användaren skriver "visa mig ...".
   * Skrivna som en människa säger dem, inte som de heter i menyn.
   */
  synonyms: string[];
  /**
   * Rollerna funktionen finns för.
   *
   * Utan det här fältet hade katalogen blivit sämre av att växa: en
   * företagare som skriver "visa mig mina klienter" hade letts till
   * juristens ärendelista och landat på en tom sida. Att peka någon mot
   * en yta hen inte kan använda är precis det principen finns för att
   * förhindra - guiden ska ta bort letandet, inte flytta det.
   */
  roles: GuideAudience[];
}

const BOTH: GuideAudience[] = ["company", "advisor"];

export const GUIDE_CATALOGUE: GuideEntry[] = [
  {
    id: "kontrollomrade",
    label: "Kontrolläget",
    route: "/dashboard",
    anchor: "kontrollomrade",
    navAnchor: { company: "nav-oversikt", advisor: "nav-oversikt" },
    why: "Det största hotet i en företagskris är sällan siffrorna i sig – det är att missa ett datum eller att inte kunna visa att man agerat. Panelen svarar på om systemet håller uppsikt åt dig.",
    saves: "Vad som bevakas, vad som saknas, och spåret som visar att du agerat.",
    manage: "Raderna under Detta saknas länkar dit saken åtgärdas. Bevakningen sköter sig själv.",
    synonyms: ["kontrollområde", "kontrolläge", "bevakning", "vad bevakas", "håller ni koll"],
    roles: BOTH,
  },
  {
    id: "handlingsplan",
    label: "Handlingsplanen",
    route: "/dashboard",
    anchor: "handlingsplan",
    navAnchor: { company: "nav-oversikt", advisor: "nav-oversikt" },
    why: "Den samlar det som ska göras i den ordning fristerna kräver, så att du slipper hålla ordningen i huvudet.",
    saves: "Uppgifterna, vem de är delegerade till, och när de bockades av.",
    manage: "Varje rad leder in i verktyget som löser den. Du kan lägga till egna punkter och delegera dem.",
    synonyms: ["handlingsplan", "att göra", "uppgifter", "vad ska jag göra", "nästa steg"],
    roles: BOTH,
  },
  {
    id: "likviditet",
    label: "Likviditet",
    route: "/dashboard/liquidity",
    anchor: "likviditetsvyn",
    navAnchor: { company: "nav-likviditet" },
    why: "Kassan avgör vilka alternativ som finns kvar. En rekonstruktion kräver likviditet för driften under processen – därför är dagen kassan tar slut den viktigaste siffran i hela ärendet.",
    saves: "Prognosen, de bevakade betalningarna och nyckeltalen med sina förbehåll.",
    manage: "Lägg till eller ändra betalningar i planeraren; kurvan och nyckeltalen räknas om direkt.",
    synonyms: ["likviditet", "kassa", "prognos", "runway", "pengar", "kassaflöde"],
    roles: BOTH,
  },
  {
    id: "dokument",
    label: "Dokument",
    route: "/dashboard/dokument",
    anchor: "dokumentvyn",
    navAnchor: { company: "nav-dokument" },
    why: "Allt som produceras i ärendet hamnar här automatiskt. Att kunna visa handlingarna är halva tryggheten i en process.",
    saves: "Rapporter, protokoll, fakturor och underlag du laddat upp – med källa och datum.",
    manage: "Du kan ladda upp fler, byta status på ett dokument och ladda ner allt som PDF.",
    synonyms: ["dokument", "rapporter", "handlingar", "filer", "underlag", "akten", "var sparas rapporterna"],
    roles: BOTH,
  },
  {
    id: "handelselogg",
    label: "Händelseloggen",
    route: "/dashboard/handelser",
    anchor: "handelseloggen",
    navAnchor: { company: "nav-handelselogg" },
    why: "Loggen är tidsstämplad av databasen och går inte att ändra i efterhand. Den visar när styrelsen insåg något och när den agerade – användbart som bevisning.",
    saves: "Varje beslut, varje utskick och varje ändring i ärendet, i tidsordning.",
    manage: "Loggen kan inte redigeras – det är själva poängen. Den kan exporteras.",
    synonyms: ["händelselogg", "logg", "historik", "vad har hänt", "spår", "bevisning"],
    roles: BOTH,
  },
  {
    id: "deltagare",
    label: "Deltagare",
    route: "/dashboard/deltagare",
    anchor: "deltagarvyn",
    navAnchor: { company: "nav-deltagare" },
    why: "Rätt kompetens tidigt minskar risken för kostsamma felbeslut, och alla i ärendet ser samma underlag i stället för varsin version.",
    saves: "Vilka som är inbjudna, i vilken roll, och vad varje roll får se.",
    manage: "Bjud in fler, ändra roll eller återkalla en behörighet – allt härifrån.",
    synonyms: ["deltagare", "bjuda in", "revisor", "styrelse", "vem ser", "dela ärendet"],
    roles: BOTH,
  },
  {
    id: "meddelanden",
    label: "Meddelanden",
    route: "/dashboard/meddelanden",
    anchor: "meddelandevyn",
    navAnchor: { company: "nav-meddelanden", advisor: "nav-meddelanden" },
    why: "Samtalen om ärendet hålls i ärendet. Ett beslut som fattats i en mejltråd går inte att hitta när det behövs.",
    saves: "Alla meddelanden, bilagor och vem som uppfattat vad.",
    manage: "Skriv till en enskild deltagare eller hela gruppen; du kan tagga någon för att kalla in dem.",
    synonyms: ["meddelanden", "chatt", "skriva till", "kontakta deltagare"],
    roles: BOTH,
  },
  {
    id: "installningar",
    label: "Inställningar",
    route: "/dashboard/installningar",
    anchor: "installningsvyn",
    navAnchor: { company: "nav-installningar", advisor: "nav-installningar" },
    why: "Här styr du vad systemet gör åt dig utan att fråga – aviseringar, kanaler och abonnemang.",
    saves: "Dina val av aviseringsnivå och kanal, din profil och dina fakturor.",
    manage: "Allt på sidan går att ändra när som helst. Ett avstängt SMS slår igenom direkt.",
    // Aviseringsorden hör till posten nedan, inte hit. Två poster som
    // gör anspråk på samma ord kan inte skilja sig åt vid en sökning -
    // då blir träffen tvetydig och guiden tvingas fråga i stället för
    // att visa. Sidan är densamma; den specifika posten leder rätt.
    synonyms: ["inställningar", "abonnemang", "faktura", "mitt konto", "prenumeration"],
    roles: BOTH,
  },
  {
    id: "aviseringar",
    label: "Aviseringar",
    route: "/dashboard/installningar",
    anchor: "aviseringskanaler",
    navAnchor: { company: "nav-installningar", advisor: "nav-installningar" },
    why: "Ett datum som passerar medan du inte är inloggad är den vanligaste orsaken till att handlingsutrymme går förlorat. Aviseringarna finns för att det inte ska hända.",
    saves: "Vilken nivå du valt och vilka kanaler som är på – e-post, in-app och SMS.",
    manage: "Byt nivå eller stäng av en kanal här. SMS kräver Professional eller Enterprise.",
    synonyms: ["avisering", "sms", "notiser", "påminnelser", "larm", "sms-aviseringar"],
    roles: BOTH,
  },
  {
    id: "kontrollbalans",
    label: "Kontrollbalansräkning",
    route: "/kbr",
    anchor: "kbr-modulen",
    navAnchor: {},
    why: "Skyldigheten inträder redan vid skäl att anta att mer än halva aktiekapitalet är förbrukat – alltså innan det syns i betalningarna. Ett daterat beslut är i sig ett skydd för styrelsen.",
    saves: "Bedömningen, siffrorna den vilar på och datumet den gjordes.",
    manage: "Du kan göra om bedömningen när siffrorna ändrats; den gamla ligger kvar i loggen.",
    synonyms: ["kontrollbalansräkning", "kbr", "aktiekapital", "kapitalbrist", "styrelseansvar"],
    roles: BOTH,
  },
  {
    id: "radgivare",
    label: "Rådgivare",
    route: "/marketplace",
    anchor: "radgivarkatalogen",
    navAnchor: {},
    why: "Vissa beslut kräver någon som får rådge – CLEARANCE strukturerar och dokumenterar, men lämnar inte juridiska råd.",
    saves: "Dina förfrågningar och vilka rådgivare som svarat.",
    manage: "Du väljer själv vem du kontaktar; en förfrågan kan dras tillbaka.",
    synonyms: ["rådgivare", "jurist", "advokat", "rekonstruktör", "hjälp", "hitta hjälp"],
    roles: BOTH,
  },
  {
    id: "alternativ",
    label: "Handlingsalternativ",
    route: "/dashboard/alternativ",
    anchor: "alternativvyn",
    navAnchor: {},
    why: "Alternativen krymper i takt med kassan. Att se dem bredvid varandra, med vad var och en kräver, gör valet till ett beslut i stället för en följd av att tiden gick ut.",
    saves: "Vilka vägar som är öppna, vad de kräver och vad de kostar i tid.",
    manage: "Listan räknas om när siffrorna ändras – den speglar alltid dagens läge.",
    synonyms: ["alternativ", "vägar", "vad kan jag göra", "rekonstruktion eller konkurs", "möjligheter"],
    roles: BOTH,
  },
  {
    id: "samtalet",
    label: "Samtalet med CLEARANCE",
    route: "/dashboard/samtal",
    anchor: "samtalet",
    navAnchor: {},
    why: "Det är här du beskriver vad som hänt och får en bedömning tillbaka. Samtalet journalförs i ärendet, så en fråga du ställde i mars går att hitta i september.",
    saves: "Hela samtalet som journal, och de bedömningar du valt att protokollföra som beslut.",
    manage: "Du kan avsluta en session när som helst; journalen ligger kvar och nästa samtal börjar med en sammanfattning av vad som hänt sedan sist.",
    synonyms: ["samtal", "prata", "fråga clearance", "rådgivaren", "krisrådgivare"],
    roles: BOTH,
  },
  {
    id: "nulagesanalys",
    label: "Nulägesanalysen",
    route: "/wizard",
    anchor: "wizard-start",
    navAnchor: {},
    why: "Fyra frågor om löner, skatt, hyra och leverantörer avgör vilka verktyg som finns kvar. Utan dem vilar allt annat i produkten på antaganden i stället för på ditt bolag.",
    saves: "Svaren, beloppen, förfallodagarna och den bedömning de leder till.",
    manage: "Gör om analysen när siffrorna ändrats – den gamla ligger kvar i händelseloggen så att förändringen syns.",
    synonyms: ["nulägesanalys", "utvärdering", "guiden", "analysen", "börja om"],
    roles: BOTH,
  },
  {
    id: "systemanalysen",
    label: "Systemanalysen",
    route: "/dashboard",
    anchor: "systemanalysen",
    navAnchor: { company: "nav-oversikt", advisor: "nav-oversikt" },
    why: "Rapporten som en erfaren rekonstruktör hade skrivit efter att ha satt sig in i bolaget: hur allvarligt det är, vad det betyder, vad som måste göras nu och vilken väg som rekommenderas – alltid motiverad.",
    saves: "Lägesbilden, riskerna, möjligheterna och den rekommenderade strategin, byggda ur ärendets egna uppgifter.",
    manage: "Rapporten räknas om varje gång underlaget ändras. Den kan tas ut som PDF och delas.",
    synonyms: ["systemanalys", "lägesrapport", "rapporten", "sammanfattning", "hur ser det ut"],
    roles: BOTH,
  },
  {
    id: "likviditetsplan",
    label: "Likviditetsplaneraren",
    route: "/likviditetsplan",
    anchor: "likviditetsplaneraren",
    navAnchor: {},
    why: "Det är här kurvan får sina siffror. En prognos som ingen matat är bara en rak linje, och en rak linje ger inga beslut.",
    saves: "Startsaldo, väntade in- och utbetalningar och de scenarier du lagt in.",
    manage: "Planen sparas medan du fyller i och går att ändra när som helst – kurvan och nyckeltalen räknas om direkt.",
    synonyms: ["likviditetsplanering", "lägga in betalningar", "budget", "planera kassan"],
    roles: ["company"],
  },
  {
    id: "kreditunderlag",
    label: "Kreditunderlag",
    route: "/dashboard/kreditunderlag",
    anchor: "kreditunderlagsvyn",
    navAnchor: { company: "nav-dokument" },
    why: "En bank eller finansiär vill se siffror, säkerheter och plan i ett dokument, inte i sex bilagor. Att kunna lämna det samma dag är ofta skillnaden mellan ett besked och en väntan.",
    saves: "Sammanställningen och när den togs fram.",
    manage: "Ta fram ett nytt underlag när siffrorna ändrats; varje version hamnar bland handlingarna.",
    synonyms: ["kreditunderlag", "underlag till banken", "finansiär", "låna", "kreditansökan"],
    roles: ["company"],
  },
  {
    id: "dokumentmallar",
    label: "Dokumentmallar",
    route: "/dashboard/dokument",
    anchor: "dokumentmallar",
    navAnchor: { company: "nav-dokument" },
    why: "Styrelseprotokoll och kallelser måste se ut på ett visst sätt för att hålla. Mallarna är ifyllda med ärendets uppgifter, så att formen inte blir det som fördröjer beslutet.",
    saves: "De handlingar du skapar, med status och datum.",
    manage: "En handling kan gå från utkast till granskning till godkänd, och en rådgivare i ärendet kan stämpla den.",
    synonyms: ["mallar", "protokoll", "kallelse", "styrelseprotokoll", "upprätta handling"],
    roles: ["company"],
  },
  {
    id: "skattekonto",
    label: "Skattekontoutdrag",
    route: "/dashboard/dokument",
    anchor: "skattekontoutdrag",
    navAnchor: { company: "nav-dokument" },
    why: "Skatten har egna förfallodagar och det är dem företrädaransvaret hänger på. Läser du in utdraget hamnar de i bevakningen i stället för i minnet.",
    saves: "De kommande debiteringarna som betalningar i likviditetsplanen.",
    manage: "Filen tolkas i din webbläsare och skickas ingenstans. Läs in ett nytt utdrag när det kommit fler poster.",
    synonyms: ["skattekonto", "skatteverket", "kontoutdrag", "importera skatt"],
    roles: ["company"],
  },
  {
    id: "arendelank",
    label: "Live ärendelänk",
    route: "/dashboard/deltagare",
    anchor: "arendelank",
    navAnchor: { company: "nav-deltagare" },
    why: "En rådgivare som ska titta snabbt ska inte behöva ett konto. Länken visar en levande vy av ärendet på den nivå du bestämmer, och varje öppning loggas.",
    saves: "Vilka länkar som finns, vad de visar och vem som öppnat dem när.",
    manage: "En länk kan när som helst stängas av. Nivån bestämmer du när du skapar den.",
    synonyms: ["ärendelänk", "dela länk", "visa för någon utan konto", "extern granskare"],
    roles: ["company"],
  },
  {
    id: "avsluta-arendet",
    label: "Avsluta ärendet",
    route: "/dashboard",
    anchor: "avsluta-arendet",
    navAnchor: { company: "nav-oversikt" },
    why: "Ett ärende som aldrig avslutas fortsätter bevaka datum som inte längre gäller. Att stänga det med en angiven orsak gör dessutom att bevakningen kan fortsätta i ett lugnare läge om bolaget klarade sig.",
    saves: "Avslutsdatumet, orsaken och om ärendet går över i hälsobevakning.",
    manage: "Ett avslutat ärende kan öppnas igen. Handlingarna och loggen ligger kvar oavsett.",
    synonyms: ["avsluta", "stänga ärendet", "klar", "avslut"],
    roles: ["company"],
  },
  {
    id: "fakturor",
    label: "Fakturor och kvitton",
    route: "/dashboard/installningar",
    anchor: "fakturor",
    navAnchor: { company: "nav-installningar", advisor: "nav-installningar" },
    why: "Fakturorna ligger kvar i tjänsten så att du aldrig behöver leta i mejlen efter ett kvitto till bokföringen.",
    saves: "Varje faktura med specifikation, moms och betalningsreferens.",
    manage: "Öppna som PDF, lägg i ärendets handlingar eller skicka vidare till den som bokför.",
    synonyms: ["kvitton", "mina fakturor", "vad har jag betalat", "bokföringsunderlag"],
    roles: BOTH,
  },
  {
    id: "api-nycklar",
    label: "API-nycklar",
    route: "/dashboard/installningar",
    anchor: "api-nycklar",
    navAnchor: { company: "nav-installningar", advisor: "nav-installningar" },
    why: "För den som vill läsa ärendet från ett eget system i stället för att logga in. Nyckeln visas en enda gång när den skapas.",
    saves: "Nyckelns namn och när den skapades – aldrig nyckeln själv.",
    manage: "En nyckel kan bytas ut eller återkallas när som helst; den gamla slutar gälla direkt.",
    synonyms: ["api", "nyckel", "integration", "koppla eget system"],
    roles: BOTH,
  },
  {
    id: "kunskap",
    label: "Kunskap",
    route: "/kunskap",
    anchor: "kunskapsbanken",
    navAnchor: {},
    why: "Reglerna förklarade med källhänvisningar: vad lagen säger, vilka datum som styr och vad vägarna innebär. Att förstå en frist är att kunna prioritera den.",
    saves: "Ingenting – det är läsning. Det du gör med den hamnar i ärendet.",
    manage: "Artiklarna uppdateras med lagändringar; varje påstående bär sitt lagrum så att du kan kontrollera det.",
    synonyms: ["kunskap", "läsa om", "vad säger lagen", "regler", "artiklar"],
    roles: BOTH,
  },
  {
    id: "klienter",
    label: "Klienter",
    route: "/arenden",
    anchor: "klientlistan",
    navAnchor: { advisor: "nav-klienter" },
    why: "Uppdragen sorterade efter vad som brådskar, inte efter när de kom in. Den klient vars frist går ut först ligger överst.",
    saves: "Vilka ärenden du har tillgång till, deras läge och när något ändrades.",
    manage: "Välj ett ärende för att göra det aktivt – hela inloggade läget följer då med dit.",
    synonyms: ["klienter", "uppdrag", "mina ärenden", "klientlista"],
    roles: ["advisor"],
  },
  {
    id: "forfragningar",
    label: "Mina förfrågningar",
    route: "/mina-forfragningar",
    anchor: "forfragningarna",
    navAnchor: { advisor: "nav-forfragningar" },
    why: "Bolag som söker hjälp landar här. En förfrågan du inte svarat på syns tydligt, eftersom den som frågar oftast har bråttom.",
    saves: "Förfrågningarna, vilka du låst upp och månadens förmedlingsfaktura.",
    manage: "Lås upp ett ärende för att se det i sin helhet; fakturan specificeras per förmedling.",
    synonyms: ["förfrågningar", "leads", "nya uppdrag", "förmedlingar"],
    roles: ["advisor"],
  },
  {
    id: "byraprofil",
    label: "Byråprofil och team",
    route: "/byraprofil",
    anchor: "byraprofilen",
    navAnchor: { advisor: "nav-byraprofil" },
    why: "Profilen är det bolagen ser när de väljer rådgivare. Den som beskriver sin inriktning konkret får färre men mer relevanta förfrågningar.",
    saves: "Byråns beskrivning, inriktning, kontaktuppgifter och vilka i teamet som har tillgång.",
    manage: "Redigera profilen och bjud in kollegor härifrån; varje inbjudan kan återkallas.",
    synonyms: ["byråprofil", "min profil", "teamet", "kollegor", "vår presentation"],
    roles: ["advisor"],
  },
  {
    id: "driftpanel",
    label: "Driftpanel",
    route: "/admin",
    anchor: "driftpanelen",
    navAnchor: { ops: "nav-drift" },
    why: "Tjänstens eget nuläge på en yta: vad som körts, vad som fastnat och vad som väntar. Ett fel i en bakgrundskörning märks annars först när en kund hör av sig.",
    saves: "Körningarnas status och de nycklar som integrationerna använder.",
    manage: "Kör om en misslyckad körning eller byt ut en nyckel härifrån.",
    synonyms: ["driftpanel", "drift", "systemstatus", "körningar"],
    roles: ["ops"],
  },
  {
    id: "inkorg",
    label: "Inkorg",
    route: "/admin/inkorg",
    anchor: "inkorgen",
    navAnchor: { ops: "nav-inkorg" },
    why: "Kontaktförfrågningar som kommit in utan att gå via ett ärende. En obesvarad rad här är oftast någon som just nu letar efter hjälp någon annanstans.",
    saves: "Meddelandet, avsändaren och när det togs om hand.",
    manage: "Markera som hanterad eller svara direkt; åtgärden hamnar i loggen.",
    synonyms: ["inkorg", "kontaktförfrågningar", "obesvarade meddelanden"],
    roles: ["ops"],
  },
  {
    id: "ansokningar",
    label: "Ansökningar",
    route: "/admin/ansokningar",
    anchor: "ansokningarna",
    navAnchor: { ops: "nav-ansokningar" },
    why: "Rådgivare som vill in i katalogen granskas innan de syns för bolag. Det är den kontrollen som gör katalogen värd något.",
    saves: "Ansökan, underlaget och beslutet med datum.",
    manage: "Godkänn eller avslå; ett avslag kan motiveras och skickas till den sökande.",
    synonyms: ["ansökningar", "granska rådgivare", "verifiering", "nya byråer"],
    roles: ["ops"],
  },
  {
    id: "driftkunder",
    label: "Kunder",
    route: "/admin/kunder",
    anchor: "kundvyn",
    navAnchor: { ops: "nav-kunder" },
    why: "Abonnemangen och deras läge. En kund vars konto håller på att låsas ska upptäckas här, inte av kunden själv.",
    saves: "Abonnemang, fakturor och betalningsstatus per kund.",
    manage: "Justera abonnemang och registrera betalningar – ett låst konto låses upp härifrån.",
    // "abonnemang" ägs av användarens EGNA inställningar. Driftvyn
    // handlar om alla kunders abonnemang, och två poster som gör
    // anspråk på samma ord kan inte skiljas åt vid en sökning.
    synonyms: ["kundregister", "betalande kunder", "kundlista", "vem betalar"],
    roles: ["ops"],
  },
  {
    id: "driftforetag",
    label: "Företag",
    route: "/admin/foretag",
    anchor: "foretagsvyn",
    navAnchor: { ops: "nav-foretag" },
    why: "Alla bolag i tjänsten med sitt läge. Ger svaret på hur många som faktiskt är i kris just nu, och hur det förändras.",
    saves: "Bolagen, deras ärendestatus och när de senast var aktiva.",
    manage: "Vyn är läsande. Ändringar görs i ärendet, inte här.",
    synonyms: ["företag", "alla bolag", "bolagslista"],
    roles: ["ops"],
  },
  {
    id: "driftradgivare",
    label: "Rådgivare",
    route: "/admin/radgivare",
    anchor: "radgivarvyn",
    navAnchor: { ops: "nav-driftradgivare" },
    why: "Katalogens innehåll och hur den används: vilka som är verifierade, vilka som får förfrågningar och vilka som inte svarar.",
    saves: "Profilerna, verifieringsstatus och förmedlingshistoriken.",
    manage: "Verifiera, pausa eller ta bort en profil ur katalogen.",
    synonyms: ["rådgivarregister", "katalogen", "verifierade byråer"],
    roles: ["ops"],
  },
  {
    id: "statistik",
    label: "Statistik",
    route: "/admin/statistik",
    anchor: "statistikvyn",
    navAnchor: { ops: "nav-statistik" },
    why: "Hur tjänsten faktiskt används, inte hur den var tänkt att användas. Skillnaden mellan de två är det mesta av produktarbetet.",
    saves: "Ingenting nytt – vyn räknar på det som redan finns.",
    manage: "Perioden går att ändra; siffrorna räknas om direkt.",
    synonyms: ["statistik", "användning", "siffror om tjänsten", "nyckeltal drift"],
    roles: ["ops"],
  },
  {
    id: "analysovervakning",
    label: "Analysövervakning",
    route: "/admin/analys",
    anchor: "analysovervakningen",
    navAnchor: { ops: "nav-analys" },
    why: "Analysmotorn är deterministisk, men underlaget är det inte. Här syns ärenden där bedömningen vilar på tunt eller motstridigt underlag – innan någon fattar beslut på den.",
    saves: "Vilka ärenden som flaggats och varför.",
    manage: "Vyn är läsande. Åtgärden är att komplettera underlaget i ärendet.",
    synonyms: ["analysövervakning", "bevaka analyser", "tunt underlag"],
    roles: ["ops"],
  },
  {
    id: "loggar",
    label: "Loggar",
    route: "/admin/loggar",
    anchor: "loggvyn",
    navAnchor: { ops: "nav-loggar" },
    why: "Systemets egna spår: utskick, integrationsanrop och fel. Skiljt från ärendets händelselogg, som är bolagets och inte vår.",
    saves: "Tekniska händelser med tidsstämpel och resultat.",
    manage: "Loggen är läsande och kan filtreras på typ och period.",
    synonyms: ["systemloggar", "tekniska fel", "utskickslogg", "felsökning"],
    roles: ["ops"],
  },
];

export const guideEntry = (id: string): GuideEntry | null =>
  GUIDE_CATALOGUE.find((e) => e.id === id) ?? null;

/**
 * De fyra svaren, som text.
 *
 * Ordningen är principens: vad som hände, varför, var det finns, hur du
 * ändrar det. Att bryta ordningen är att svara på en fråga användaren
 * inte hunnit ställa.
 */
export const entryBriefing = (entry: GuideEntry): { label: string; text: string }[] => [
  { label: "Vad det är", text: entry.label },
  { label: "Varför det finns", text: entry.why },
  { label: "Vad som sparas här", text: entry.saves },
  { label: "Hur du ändrar det", text: entry.manage },
];

/* ==========================================================================
   src/lib/guide/actions.ts
   ========================================================================== */

/**
 * ÅTGÄRDSSPRÅKET: det CLEARANCE kan göra med gränssnittet.
 *
 * En vanlig chattbot svarar med text. Den här guiden STYR ytan medan den
 * pratar: öppnar menyn, ringar in valet, byter vy, rullar fram, pekar på
 * elementet och förklarar - samtidigt. Skälet är att man lär sig av att
 * se något hända, inte av att läsa var det ligger.
 *
 * Åtgärderna är DATA, inte funktionsanrop. Det gör tre saker: sekvensen
 * går att testa utan webbläsare, den går att spela upp igen, och den går
 * att avbryta mitt i utan att halva gränssnittet står kvar i ett
 * konstigt läge.
 *
 * Varje sekvens SLUTAR med att användaren står kvar på målet med
 * förklaringen framme. Guiden lämnar aldrig någon mitt i en flytt.
 */

export type GuideAction =
  /** Öppna sidomenyn (bara på små skärmar - på stora står den redan öppen). */
  | { kind: "oppna-meny" }
  | { kind: "stang-meny" }
  /** Ringa in ett element med den pulserande ringen. */
  | { kind: "markera"; anchor: string }
  /** Rulla fram till ett element. Alltid före markeringen. */
  | { kind: "rulla-till"; anchor: string }
  /** Förklaringsrutan intill elementet. */
  | { kind: "forklara"; anchor: string; text: string; heading?: string }
  /** Byt vy. */
  | { kind: "oppna-vy"; route: string }
  /** Växla till en flik eller undervy. */
  | { kind: "vaxla-flik"; anchor: string }
  /** Sätt markören i ett fält, så att användaren kan börja skriva direkt. */
  | { kind: "fokusera-falt"; anchor: string }
  /** Visa var något sparades. Ringen plus en kvittering. */
  | { kind: "visa-sparat"; anchor: string; what: string }
  /**
   * Guidat arbetsläge: guiden stannar och väntar på att användaren
   * klickar själv. Det är skillnaden mellan en demonstration och en
   * instruktör - handen är användarens.
   *
   * `label` är vad saken HETER på skärmen. Utan det stod det bara
   * "klicka på det markerade", och den som inte hittade markeringen fick
   * ingen andra ledtråd. Nu står namnet i klartext.
   *
   * `step` och `of` räknar de klick användaren faktiskt ska göra - inte
   * guidens interna moment. "Steg 3 av 12" i en rundtur med fyra stopp
   * är en felaktig uppgift om hur lång tid det tar, och den som tror sig
   * ha nio steg kvar hoppar av.
   */
  | { kind: "vanta-pa-klick"; anchor: string; text: string; label: string; step: number; of: number }
  /**
   * Ett steg i en RUNDTUR. Skillnaden mot vanta-pa-klick är hela poängen
   * med den här ändringen: en rundtur VISAR var saker ligger, den ber inte
   * användaren utföra något. Därför väntar guiden här på en Nästa-knapp i
   * panelen, inte på ett klick ute i vyn. Att tvinga ett klick på själva
   * ytan för att bara komma vidare i en presentation är att förväxla en
   * demonstration med ett prov - och det var precis det som kändes bakvänt.
   */
  | { kind: "tur-steg"; anchor: string; text: string; label: string; step: number; of: number }
  /** En kort paus, så att ögat hinner följa med. */
  | { kind: "andas"; ms: number };

/** Hur länge ett steg står kvar innan nästa tar vid, när inget annat sägs. */
export const STEP_MS = 1400;

/**
 * Vägen till en funktion: "visa mig var rapporterna finns".
 *
 * Sekvensen är den användaren beskrev: öppna menyn, markera valet, gå
 * dit, rulla fram, markera målet, förklara. Menysteget hoppas över för
 * funktioner utan eget menyval - att ringa in ett menyval som inte leder
 * dit vore att lära ut fel väg.
 */
export const showMeSteps = (
  entry: GuideEntry,
  opts?: { alreadyThere?: boolean; role?: GuideAudience },
): GuideAction[] => {
  const steps: GuideAction[] = [];
  // Menyvalet gäller den här publiken eller ingen. Saknas det går guiden
  // rakt till vyn i stället för att ringa in något som inte finns.
  //
  // Driftvyerna når bara den som ser driftmenyn, och den menyn hänger på
  // att posten är märkt "ops" - därför läses menyvalet ur postens EGNA
  // nycklar när den efterfrågade rollen saknas i den. En admin som
  // frågar med sin företagsroll ska ändå få driftmenyn visad.
  const navAnchor =
    entry.navAnchor[opts?.role ?? "company"] ??
    (entry.roles.length === 1 ? entry.navAnchor[entry.roles[0]] ?? null : null);
  if (!opts?.alreadyThere && navAnchor) {
    steps.push({ kind: "oppna-meny" });
    steps.push({ kind: "markera", anchor: navAnchor });
    steps.push({
      kind: "forklara",
      anchor: navAnchor,
      heading: "Här ligger det",
      text: `${entry.label} nås härifrån. Nästa gång hittar du hit själv.`,
    });
    steps.push({ kind: "andas", ms: 600 });
  }
  if (!opts?.alreadyThere) {
    steps.push({ kind: "oppna-vy", route: entry.route });
    steps.push({ kind: "stang-meny" });
  }
  steps.push({ kind: "rulla-till", anchor: entry.anchor });
  steps.push({ kind: "markera", anchor: entry.anchor });
  steps.push({
    kind: "forklara",
    anchor: entry.anchor,
    heading: entry.label,
    // De fyra svaren, i principens ordning, i en förklaringsruta.
    text: entryBriefing(entry)
      .slice(1)
      .map((row) => `${row.label}: ${row.text}`)
      .join("\n\n"),
  });
  return steps;
};

/**
 * Kvitteringen: "jag sparade precis det där under X".
 *
 * Kortare än en rundtur med flit. Den som mitt i ett samtal får veta att
 * något sparats ska se VAR, inte få en genomgång av hela vyn.
 */
export const savedSteps = (entry: GuideEntry, what: string): GuideAction[] => [
  { kind: "oppna-vy", route: entry.route },
  { kind: "rulla-till", anchor: entry.anchor },
  { kind: "visa-sparat", anchor: entry.anchor, what },
  {
    kind: "forklara",
    anchor: entry.anchor,
    heading: "Sparat",
    text: `${what}\n\nDet ligger under ${entry.label}. ${entry.manage}`,
  },
];

export interface FlowStep {
  /** Elementet användaren ska klicka på. */
  anchor: string;
  /** Vad saken HETER på skärmen, ord för ord. */
  label: string;
  /** Vad hen ska göra, och varför just nu. */
  text: string;
  /** Vyn steget utförs i, om det skiljer sig från föregående. */
  route?: string;
}

export interface GuidedFlow {
  id: string;
  label: string;
  /** Vad flödet leder till. Sägs innan det börjar - ingen ska gissa. */
  outcome: string;
  steps: FlowStep[];
  /** Rollerna flödet gäller för. Samma skäl som i katalogen. */
  roles: GuideAudience[];
}

/**
 * Guidat arbetsläge, som data.
 *
 * Guiden öppnar rätt sida, markerar nästa knapp och VÄNTAR. Den klickar
 * inte åt användaren: den som får se sin egen hand utföra momentet minns
 * det, den som får se en animation gör det inte.
 */
export const GUIDED_FLOWS: GuidedFlow[] = [
  {
    id: "forsta-analysen",
    label: "Gör din första analys",
    outcome: "En bedömning av läget som vilar på dina siffror, och en handlingsplan som följer av den.",
    roles: ["company"],
    steps: [
      {
        route: "/wizard",
        anchor: "wizard-start",
        label: "Nulägesanalysen",
        text: "Här lämnar du siffrorna – löner, skatt, hyra och skulder. Det är de fyra som avgör vilka alternativ som finns kvar.",
      },
      {
        route: "/dashboard",
        anchor: "kontrollomrade",
        label: "Kontrolläge",
        text: "När analysen är klar hamnar bevakningen här. Datumen räknas ner även när du inte är inloggad.",
      },
      {
        route: "/dashboard",
        anchor: "handlingsplan",
        label: "Nästa steg",
        text: "Och det som ska göras hamnar här, i den ordning fristerna kräver. Varje rad leder in i verktyget som löser den.",
      },
    ],
  },
  {
    id: "sa-arbetar-du-i-ett-klientarende",
    label: "Så arbetar du i ett klientärende",
    outcome: "Vägen från uppdragslistan till det aktiva ärendet, och var du ser vad klienten själv har gjort.",
    roles: ["advisor"],
    steps: [
      {
        route: "/arenden",
        anchor: "klientlistan",
        label: "Klienter",
        text: "Uppdragen sorteras efter vad som brådskar, inte efter när de kom in. Välj ett ärende – hela inloggade läget följer med dit.",
      },
      {
        route: "/dashboard",
        anchor: "systemanalysen",
        label: "Systemanalysen",
        text: "Systemanalysen är din genväg in i ärendet: läget, riskerna och den rekommenderade vägen, med motivering.",
      },
      {
        route: "/dashboard/handelser",
        anchor: "handelseloggen",
        label: "Händelselogg",
        text: "Och här ser du vad klienten faktiskt gjort och när. Loggen skrivs av databasen och går inte att ändra i efterhand.",
      },
    ],
  },
];

export const guidedFlow = (id: string): GuidedFlow | null =>
  GUIDED_FLOWS.find((f) => f.id === id) ?? null;

/** Ett guidat flöde som en åtgärdssekvens. */
export const flowSteps = (flow: GuidedFlow): GuideAction[] => {
  const steps: GuideAction[] = [];
  let route: string | null = null;
  flow.steps.forEach((step, i) => {
    if (step.route && step.route !== route) {
      steps.push({ kind: "oppna-vy", route: step.route });
      route = step.route;
    }
    steps.push({ kind: "rulla-till", anchor: step.anchor });
    steps.push({
      kind: "vanta-pa-klick",
      anchor: step.anchor,
      text: step.text,
      label: step.label,
      // Räknat i KLICK, inte i guidens moment. Se kommentaren vid
      // åtgärdstypen ovan.
      step: i + 1,
      of: flow.steps.length,
    });
  });
  return steps;
};

/**
 * RUNDTURERNA: presentationer, inte prov.
 *
 * En rundtur svarar på "var ligger allt?", och skiljer sig från ett guidat
 * arbetsläge på en enda men avgörande punkt: den ber dig inte GÖRA något.
 * Den pekar, förklarar, och går vidare när DU säger till - med en
 * Nästa-knapp, som en installationsguide. Att i stället kräva ett klick på
 * själva ytan bara för att bläddra framåt kändes bakvänt, och det var det:
 * en presentation ska inte hålla dig gisslan tills du prickat rätt ruta.
 *
 * Rundturerna bor i en egen lista, skild från GUIDED_FLOWS, just för att
 * de två inte får blandas ihop igen: det guidade arbetsläget SKA vänta på
 * användarens hand (man minns det man gjort själv), rundturen ska inte.
 */
export const TOURS: GuidedFlow[] = [
  {
    id: "sa-hittar-du-tillbaka",
    label: "Så hittar du tillbaka till allt",
    outcome: "En rundtur på under en minut genom de fyra ytor du kommer att använda mest. Bläddra med Nästa.",
    roles: ["company", "advisor"],
    steps: [
      { route: "/dashboard", anchor: "kontrollomrade", label: "Kontrolläge", text: "Kontrolläget: svaret på om systemet håller uppsikt åt dig. Här ligger bevakningen av frister och nyckeltal." },
      { route: "/dashboard/liquidity", anchor: "likviditetsvyn", label: "Likviditet", text: "Likviditeten: dagen kassan tar slut, och vad som ligger bakom siffran. Det är den viktigaste siffran i hela läget." },
      { route: "/dashboard/dokument", anchor: "dokumentvyn", label: "Dokument", text: "Dokumenten: allt som produceras i ärendet hamnar här av sig självt – rapporter, underlag och mallar." },
      { route: "/dashboard/handelser", anchor: "handelseloggen", label: "Händelselogg", text: "Händelseloggen: spåret som visar när ni insåg och när ni agerade. Den skrivs av systemet och går inte att ändra i efterhand." },
    ],
  },
];

export const tour = (id: string): GuidedFlow | null =>
  TOURS.find((t) => t.id === id) ?? null;

/**
 * En rundtur som grupper av åtgärder, en grupp per stopp.
 *
 * Grupperna, och inte en enda platt kö, är det som gör TILLBAKA möjligt:
 * motorn kan spela om vilken grupp som helst, i vilken ordning som helst.
 * Varje grupp navigerar (även till samma vy - react-router struntar i det)
 * så att ett hopp bakåt landar rätt oavsett var man kom ifrån, rullar fram
 * och stannar på ett tur-steg som väntar på Nästa.
 */
export const tourGroups = (t: GuidedFlow): GuideAction[][] =>
  t.steps.map((step, i) => {
    const grupp: GuideAction[] = [];
    if (step.route) grupp.push({ kind: "oppna-vy", route: step.route });
    grupp.push({ kind: "rulla-till", anchor: step.anchor });
    grupp.push({
      kind: "tur-steg",
      anchor: step.anchor,
      text: step.text,
      label: step.label,
      step: i + 1,
      of: t.steps.length,
    });
    return grupp;
  });

/* ==========================================================================
   src/lib/guide/microLessons.ts
   ========================================================================== */

/**
 * MIKROUTBILDNING: små återkommande förklaringar i stället för en manual.
 *
 * "Det här kallas ett kontrollområde." Två sekunder senare: "Här ser du
 * de viktigaste nyckeltalen." Tre minuter senare: "Kommer du ihåg
 * kontrollområdet? Där kommer även framtida varningar att visas."
 *
 * Uppdelningen är hela poängen. En genomgång vid första inloggningen
 * hamnar i det ögonblick användaren har minst nytta av den - hen vet
 * ännu inte vad frågan är. Samma innehåll utspritt över de första
 * dagarna, med en påminnelse när ytan blir relevant, fastnar.
 *
 * TVÅ REGLER SOM INTE FÅR BÖJAS:
 *
 *  1. En lektion visas EN gång. Minnet ligger i localStorage och
 *     konsulteras innan något visas. En produkt som upprepar sig blir
 *     något man klickar bort utan att läsa, och då är även det viktiga
 *     bortklickat.
 *  2. En lektion visas ALDRIG när läget är akut. Den som inte kan betala
 *     lönerna på fredag ska inte få veta vad ett kontrollområde heter.
 *     Undervisning i fel ögonblick är inte omtanke, den är i vägen.
 */

export interface MicroLesson {
  id: string;
  /** Ytan lektionen hör till. Samma ankarnamn som guiden använder. */
  anchor: string;
  /** Den korta förklaringen. En mening, inte ett stycke. */
  text: string;
  /**
   * Påminnelsen, som kommer långt senare och knyter an till något nytt.
   * Null när lektionen inte har någon uppföljning.
   */
  followUp: string | null;
  /**
   * Hur länge efter första visningen påminnelsen får komma, i minuter.
   * Tre minuter i exemplet - men den bör landa i ett senare BESÖK, inte
   * i samma andetag.
   */
  followUpAfterMinutes: number;
  /**
   * Ordningen lektionerna kommer i. Låg först. Två lektioner med samma
   * ordning är ett fel som testet fäller.
   */
  order: number;
}

export const MICRO_LESSONS: MicroLesson[] = [
  {
    id: "kontrollomrade",
    anchor: "kontrollomrade",
    text: "Det här kallas kontrolläget. Här ser du vad systemet bevakar åt dig.",
    followUp:
      "Kommer du ihåg kontrolläget? Det är också där framtida varningar dyker upp – du behöver inte leta efter dem.",
    followUpAfterMinutes: 3,
    order: 1,
  },
  {
    id: "handlingsplan",
    anchor: "handlingsplan",
    text: "Handlingsplanen står i fristernas ordning, inte i den ordning punkterna skapades.",
    followUp:
      "Handlingsplanen sorterar om sig själv när ett datum närmar sig. Den översta raden är alltid den som brådskar mest.",
    followUpAfterMinutes: 5,
    order: 2,
  },
  {
    id: "dokument",
    anchor: "dokumentvyn",
    text: "Allt som produceras i ärendet sparas här automatiskt. Du behöver aldrig leta efter en rapport.",
    followUp:
      "Dokumenten ligger kvar även efter att ärendet avslutats – det är ofta då någon frågar efter dem.",
    followUpAfterMinutes: 8,
    order: 3,
  },
  {
    id: "handelselogg",
    anchor: "handelseloggen",
    text: "Händelseloggen skrivs av databasen och går inte att ändra i efterhand.",
    followUp:
      "Loggen är det som visar NÄR ni insåg något och när ni agerade. Det är ofta den frågan som ställs efteråt.",
    followUpAfterMinutes: 12,
    order: 4,
  },
  {
    id: "likviditet",
    anchor: "likviditetsvyn",
    text: "Kurvan visar bara utbetalningar. Den är ett golv, inte en prognos.",
    followUp:
      "Nyckeltalen i likviditetsvyn går att klicka på – då ser du vad talet räknats fram ur och vad det inte säger.",
    followUpAfterMinutes: 6,
    order: 5,
  },
  {
    id: "systemanalysen",
    anchor: "systemanalysen",
    text: "Rapporten räknas om varje gång underlaget ändras – den är aldrig äldre än ärendet.",
    followUp:
      "Systemanalysen motiverar alltid sin rekommendation. Håller du inte med om motiveringen är det den du ska ifrågasätta, inte slutsatsen.",
    followUpAfterMinutes: 10,
    order: 6,
  },
  {
    id: "samtalet",
    anchor: "samtalet",
    text: "Samtalet journalförs i ärendet. En fråga du ställer idag går att hitta om ett halvår.",
    followUp:
      "En bedömning i samtalet kan protokollföras som beslut med en premiss – då säger CLEARANCE till om premissen ändras.",
    followUpAfterMinutes: 15,
    order: 7,
  },
];

const KEY__guide_microLessons = "clearance-mikrolektioner";

interface LessonMemory {
  /** id → tidpunkten lektionen visades, som ISO. */
  shown: Record<string, string>;
  /** id:n vars påminnelse också är avklarad. */
  reminded: string[];
}

const emptyMemory = (): LessonMemory => ({ shown: {}, reminded: [] });

export const readMemory = (): LessonMemory => {
  try {
    const raw = localStorage.getItem(KEY__guide_microLessons);
    if (!raw) return emptyMemory();
    const parsed = JSON.parse(raw) as Partial<LessonMemory>;
    return {
      shown: parsed.shown && typeof parsed.shown === "object" ? parsed.shown : {},
      reminded: Array.isArray(parsed.reminded) ? parsed.reminded : [],
    };
  } catch {
    return emptyMemory();
  }
};

const writeMemory = (memory: LessonMemory): void => {
  try {
    localStorage.setItem(KEY__guide_microLessons, JSON.stringify(memory));
  } catch {
    // Privat läge eller fullt. Det värsta som händer är en förklaring
    // för mycket - aldrig en utebliven varning, eftersom lektionerna
    // aldrig bär något tidskritiskt.
  }
};

export const rememberShown = (id: string, now: Date): void => {
  const memory = readMemory();
  memory.shown[id] = now.toISOString();
  writeMemory(memory);
};

export const rememberReminded = (id: string): void => {
  const memory = readMemory();
  if (!memory.reminded.includes(id)) memory.reminded.push(id);
  writeMemory(memory);
};

export interface LessonDue {
  lesson: MicroLesson;
  /** "forsta" = den korta förklaringen, "paminnelse" = uppföljningen. */
  phase: "forsta" | "paminnelse";
  text: string;
}

/**
 * Nästa lektion som ska visas, om någon.
 *
 * `visibleAnchors` är de ytor som faktiskt syns just nu - en lektion om
 * händelseloggen får inte visas på likviditetssidan. `acute` stänger av
 * undervisningen helt.
 */
export const dueLesson = (input: {
  visibleAnchors: string[];
  acute: boolean;
  now: Date;
  memory?: LessonMemory;
}): LessonDue | null => {
  if (input.acute) return null;
  const memory = input.memory ?? readMemory();
  const visible = new Set(input.visibleAnchors);
  const candidates = [...MICRO_LESSONS].sort((a, b) => a.order - b.order);

  // Påminnelserna först: en uppföljning som förfallit är mer värd än en
  // ny lektion, eftersom den knyter ihop något användaren redan sett.
  for (const lesson of candidates) {
    if (!lesson.followUp || memory.reminded.includes(lesson.id)) continue;
    const shownAt = memory.shown[lesson.id];
    if (!shownAt || !visible.has(lesson.anchor)) continue;
    const elapsed = input.now.getTime() - new Date(shownAt).getTime();
    if (Number.isNaN(elapsed)) continue;
    if (elapsed >= lesson.followUpAfterMinutes * 60_000) {
      return { lesson, phase: "paminnelse", text: lesson.followUp };
    }
  }

  for (const lesson of candidates) {
    if (memory.shown[lesson.id] || !visible.has(lesson.anchor)) continue;
    return { lesson, phase: "forsta", text: lesson.text };
  }
  return null;
};

/** Nollställer minnet. Finns för att kunna se introduktionen igen. */
export const forgetLessons = (): void => {
  try {
    localStorage.removeItem(KEY__guide_microLessons);
  } catch {
    // Se ovan.
  }
};

/* ==========================================================================
   src/lib/guide/showMe.ts
   ========================================================================== */

/**
 * "VISA MIG" - fritext in, en plats i gränssnittet ut.
 *
 * Användaren ska kunna skriva "visa mig var rapporterna finns" och bli
 * ledd dit. Matchningen är deterministisk och sker mot katalogens
 * synonymer, inte mot en språkmodell: en guide som ibland pekar fel är
 * värre än ingen guide, eftersom den lär ut fel väg med auktoritet.
 *
 * Träffar den inget säger den det rakt ut och räknar upp vad den KAN
 * visa. Att gissa på den närmaste posten vore att svara på en annan
 * fråga än den som ställdes.
 */

/**
 * Orden som bara inleder en fråga och inte pekar ut något.
 *
 * De rensas bort före matchningen så att "var finns rapporterna" och
 * "rapporter" hamnar på samma ställe.
 */
const FILLER = [
  "visa", "mig", "var", "finns", "hittar", "jag", "du", "kan", "man",
  "vad", "är", "det", "den", "de", "som", "en", "ett", "och", "på",
  "i", "in", "till", "för", "om", "hur", "vill", "se", "gå", "min",
  "mitt", "mina", "vi", "oss", "vår", "vårt",
];

/**
 * Normalisering före jämförelse.
 *
 * Skiftläge och skiljetecken bort. Å, ä och ö lämnas ORÖRDA - att
 * translitterera dem hade gjort "för" till "for" och därmed till ett
 * annat ord. Samma fälla som i tonvakterna: svenska bokstäver är
 * bokstäver.
 */
const normalise = (text: string): string =>
  text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();

const meaningfulWords = (text: string): string[] =>
  normalise(text)
    .split(" ")
    .filter((w) => w.length > 1 && !FILLER.includes(w));

export interface ShowMeResult {
  entry: GuideEntry | null;
  /** Vad guiden förstod. Visas när den inte hittade något. */
  understood: string[];
  /** Alternativen att erbjuda när träffen uteblev. */
  alternatives: GuideEntry[];
}

/**
 * Poängen för en post mot de sökta orden.
 *
 * En hel synonymfras som förekommer i frågan väger tyngst - "var sparas
 * rapporterna" ska slå igenom även om orden var för sig är vaga. Sedan
 * räknas enskilda ord.
 */
const scoreFor = (entry: GuideEntry, query: string, words: string[]): number => {
  const haystack = normalise(query);
  let score = 0;
  for (const synonym of entry.synonyms) {
    const s = normalise(synonym);
    if (s.includes(" ") && haystack.includes(s)) score += 10;
  }
  // Dubbletter bort. Etiketten är ofta också en synonym, och utan den
  // här raden räknades samma träff två gånger - vilket räckte för att
  // "in" i "bjuder in" skulle väga tyngre än ordet "revisor".
  const terms = [...new Set([...entry.synonyms, entry.label].map(normalise))];
  for (const word of words) {
    for (const term of terms) {
      if (term === word) score += 4;
      // Böjningar: "rapporter" mot "rapport", "dokumenten" mot "dokument".
      // Minst fyra tecken krävs för en prefixträff: kortare ord är
      // stavelser, inte begrepp, och "in" ska inte leda till
      // Inställningar.
      else if (word.length >= 4 && term.length > 3 && (term.startsWith(word) || word.startsWith(term))) {
        score += 2;
      }
    }
  }
  return score;
};

/**
 * Sökningen sker bara bland det den här användaren kan använda.
 *
 * En företagare som frågar efter "mina klienter" ska inte ledas till
 * juristens ärendelista och landa på en tom sida. Att peka någon mot en
 * yta hen inte har är precis det principen finns för att förhindra:
 * guiden ska ta bort letandet, inte flytta det.
 *
 * Publiken är en MÄNGD och inte ett värde, för att drift inte är en
 * roll som utesluter de andra: den som administrerar tjänsten är också
 * företagare eller rådgivare i sitt eget konto och ska hitta båda
 * sorternas ytor. En admin får alltså sin roll PLUS "ops".
 */
export const resolveShowMe = (
  query: string,
  audience: GuideAudience | GuideAudience[] = "company",
): ShowMeResult => {
  const audiences = Array.isArray(audience) ? audience : [audience];
  const available = GUIDE_CATALOGUE.filter((e) => e.roles.some((r) => audiences.includes(r)));
  const words = meaningfulWords(query);
  if (words.length === 0) {
    return { entry: null, understood: [], alternatives: available.slice(0, 4) };
  }
  const ranked = available.map((entry) => ({ entry, score: scoreFor(entry, query, words) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    return { entry: null, understood: words, alternatives: available.slice(0, 4) };
  }
  // En tvetydig träff är ingen träff. Står två poster lika har frågan
  // inte pekat ut någon av dem, och då ska guiden fråga i stället för
  // att singla slant åt användaren.
  if (ranked.length > 1 && ranked[0].score === ranked[1].score) {
    return {
      entry: null,
      understood: words,
      alternatives: ranked.slice(0, 4).map((r) => r.entry),
    };
  }
  return { entry: ranked[0].entry, understood: words, alternatives: [] };
};

/** Svaret när guiden inte hittade något. Aldrig en tyst återvändsgränd. */
export const noMatchMessage = (result: ShowMeResult): string =>
  result.understood.length === 0
    ? "Skriv vad du letar efter, så visar jag var det finns."
    : `Jag hittar ingen entydig funktion för ${result.understood.map((w) => `"${w}"`).join(", ")}. Menar du någon av de här?`;

/* ==========================================================================
   src/lib/taskIntelligence.ts
   ========================================================================== */

/**
 * Intelligenta uppgifter: spelböckerna bakom handlingsplanen.
 *
 * En uppgift i Clearance ska aldrig bara vara en punkt i en checklista.
 * Systemet ska veta VARFÖR uppgiften finns, VAD som ligger bakom
 * bedömningen, VAD som händer om den inte utförs, och - viktigast -
 * hjälpa användaren att GENOMFÖRA den, steg för steg. När stegen är
 * gjorda ser systemet det och slutför uppgiften automatiskt.
 *
 * Spelboken matchas på uppgiftens text (utvärderingens sådda uppgifter
 * har kända formuleringar); okända uppgifter får en ärlig grundvy utan
 * påhittade steg. Allt är deterministiskt och testbart - konsekvenser
 * formuleras enligt kommunikationsprincipen: "kan", aldrig "kommer att".
 *
 * Rådgivarmatchningen väger ärendetyp, specialisering, verifiering och
 * pristransparens - och säger VARFÖR en rådgivare föreslås. Källorna för
 * rådgivarregistret är medvetet pluggbara: idag vårt eget granskade
 * partnerregister; officiella register kompletterar när/om sådana blir
 * åtkomliga (ANTAGANDE: inget färdigt myndighets-API över rekonstruktörer
 * eller förvaltare är bekräftat - arkitekturen får inte vila på det).
 */

export interface TaskContext {
  caseRecord: CaseRecord;
  members: CaseMemberRecord[];
  documents: DocumentRecord[];
  payments: PaymentRecord[];
  kbr: { status: KbrStatus; createdAt: string } | null;
}

export interface ProcessStep {
  label: string;
  href: string;
  /** true när systemet kan se att steget är gjort. */
  done: boolean;
}

export interface TaskPlaybook {
  id: string;
  why: string;
  /** Underlagen bakom bedömningen - vad systemet faktiskt vet. */
  basis: string[];
  consequence: string;
  steps: ProcessStep[];
  /** true = processen är genomförd; uppgiften kan slutföras automatiskt. */
  complete: boolean;
  /** Spelboken erbjuder rådgivarmatchning. */
  offersMatching: boolean;
}

const advisorInCase = (ctx: TaskContext): boolean =>
  ctx.members.some(
    (m) => !m.revokedAt && ["reconstructor", "trustee", "legal_advisor"].includes(m.role),
  );

const minutesSaved = (ctx: TaskContext): boolean =>
  ctx.documents.some((d) => d.note?.startsWith("Genererad mall"));

const basisFor = (ctx: TaskContext): string[] => {
  const c = ctx.caseRecord;
  const basis: string[] = [];
  const cannot = [
    c.canPaySalary === false ? "lönerna" : null,
    c.canPayTax === false ? "skatten" : null,
    c.canPayRent === false ? "hyran" : null,
    c.canPaySuppliers === false ? "leverantörerna" : null,
  ].filter(Boolean);
  if (cannot.length > 0) basis.push(`Registrerat i utvärderingen: ${cannot.join(", ")} kan inte betalas fullt ut.`);
  if (c.recommendationTitle) basis.push(`Utvärderingens bedömning: ${c.recommendationTitle.toLowerCase().replace(/\.$/, "")}.`);
  if (ctx.kbr) basis.push(`Kontrollbalansbedömning finns (${ctx.kbr.status}).`);
  if (basis.length === 0) basis.push("Uppgiften kommer från ärendets handlingsplan.");
  return basis;
};

export const playbookForTask = (label: string, ctx: TaskContext): TaskPlaybook => {
  const c = ctx.caseRecord;

  if (/kontakta en (rekonstruktör|insolvensjurist)/i.test(label)) {
    const invited = advisorInCase(ctx);
    const hasDocs = ctx.documents.length > 0;
    return {
      id: "kontakta-radgivare",
      why:
        c.recommendationType === "bankruptcy"
          ? "Bedömningen pekar mot en ordnad avveckling, och ordningen avgörs av vem som leder den. Ett ombud med konkursvana skyddar både bolaget och företrädarna genom processen."
          : "Bedömningen pekar mot rekonstruktion, och en ansökan kräver att en rekonstruktör bedömer verksamheten som livskraftig. Rätt person tidigt höjer chansen att ansökan går igenom.",
      basis: basisFor(ctx),
      consequence:
        "Utan rådgivare fattas de tidskritiska besluten utan vana ögon - vissa misstag i det här skedet kan få långtgående juridiska konsekvenser.",
      steps: [
        { label: "Se matchade rådgivare och skicka förfrågan", href: "/marketplace", done: invited },
        { label: "Samla underlaget rådgivaren behöver (akten)", href: "/dashboard/dokument", done: hasDocs },
        { label: "Bjud in rådgivaren till ärendet", href: "/dashboard/deltagare", done: invited },
      ],
      complete: invited,
      offersMatching: true,
    };
  }

  if (/likviditetsbudget|likviditetsprognos/i.test(label)) {
    const hasPlan = ctx.payments.length > 0;
    return {
      id: "likviditet",
      why: "Både din egen bedömning och en eventuell ansökan vilar på att veta exakt när kassan tar slut - dag för dag, inte på känsla.",
      basis: basisFor(ctx),
      consequence: "Utan prognos upptäcks bristen när den redan inträffat, och handlingsutrymmet är då mindre.",
      steps: [{ label: "Bygg likviditetsplanen post för post", href: "/likviditetsplan", done: hasPlan }],
      complete: hasPlan,
      offersMatching: false,
    };
  }

  if (/sammanställ underlag/i.test(label)) {
    const enough = ctx.documents.length >= 2;
    return {
      id: "underlag",
      why: "Skuldlista, bokslut och kontoutdrag är det första varje rådgivare, bank och domstol frågar efter. Samlat underlag gör varje möte kortare.",
      basis: basisFor(ctx),
      consequence: "Saknat underlag försenar varje nästa steg - och förseningar i det här läget kostar handlingsutrymme.",
      steps: [
        { label: "Ladda upp kontoutdrag och rapporter", href: "/dashboard/dokument", done: ctx.documents.length > 0 },
        { label: "Komplettera tills akten håller (minst bokslut + kontoutdrag)", href: "/dashboard/dokument", done: enough },
      ],
      complete: enough,
      offersMatching: false,
    };
  }

  if (/verksam åtgärd|rekonstruktionsansökan före skattens/i.test(label)) {
    const kbrDone = ctx.kbr !== null;
    const protocol = minutesSaved(ctx);
    return {
      id: "verksam-atgard",
      why: "Skyddet mot personligt betalningsansvar för bolagets skatter ligger i en verksam åtgärd senast på skattens förfallodag. Datumet styr, inte avsikten.",
      basis: basisFor(ctx),
      consequence: "Det finns situationer där företrädare kan bli personligt ansvariga för obetald skatt - beslutet bör inte skjutas upp.",
      steps: [
        { label: "Läs vad som räknas som verksam åtgärd", href: "/kunskap/foretradaransvar", done: false },
        { label: "Gör kontrollbalansbedömningen", href: "/kbr", done: kbrDone },
        { label: "Protokollför styrelsens beslut (mall finns)", href: "/dashboard/dokument", done: protocol },
      ],
      complete: kbrDone && protocol,
      offersMatching: false,
    };
  }

  if (/anstånd hos skatteverket/i.test(label)) {
    return {
      id: "anstand",
      why: "Ett beviljat anstånd flyttar förfallodagen - och därmed även fristen för företrädaransvaret.",
      basis: basisFor(ctx),
      consequence: "Utan anstånd eller annan åtgärd före förfallodagen är ansvarsfrågan öppen.",
      steps: [
        { label: "Läs om företrädaransvaret och fristen", href: "/kunskap/foretradaransvar", done: false },
        { label: "Hämta skattekontoutdraget och läs in det", href: "/dashboard/dokument", done: ctx.documents.length > 0 },
      ],
      complete: false,
      offersMatching: false,
    };
  }

  if (/gör utvärderingen|fyll i utvärderingen/i.test(label)) {
    return {
      id: "utvardering",
      why: "Bedömningen räknas fram ur svaren om löner, skatt, hyra och leverantörer. Utan dem finns ingen bedömning - bara en tom mall.",
      basis: basisFor(ctx),
      consequence:
        "Ett ärende utan underlag ser ut som ett lugnt ärende. Det är den farligaste sortens tystnad i den här produkten.",
      steps: [{ label: "Svara på frågorna om betalningarna", href: "/wizard", done: false }],
      complete: false,
      offersMatching: false,
    };
  }

  if (/kontrollbalansbedömning|kontrollbalansräkning/i.test(label)) {
    const done = ctx.kbr !== null;
    return {
      id: "kontrollbalans",
      why: "Skyldigheten att upprätta kontrollbalansräkning hänger på det egna kapitalet, inte på likviditeten - den kan alltså ha inträtt medan bolaget fortfarande betalar allt i tid.",
      basis: basisFor(ctx),
      consequence:
        "Görs ingen bedömning kan styrelseledamöterna bli personligt ansvariga för skulder som uppkommer därefter. Ett daterat beslut är det som bryter den kedjan.",
      steps: [{ label: "Gör kontrollbalansbedömningen", href: "/kbr", done }],
      complete: done,
      offersMatching: false,
    };
  }

  if (/förhandla betalningsplaner|kontakta nyckelleverantör/i.test(label)) {
    // "Klart" är inte att ha ringt - det är att den nya överenskommelsen
    // står i ärendet. En uppskjuten betalning är den enda spår systemet
    // kan se, och därför det enda som får räknas.
    const postponed = ctx.payments.some((p) => p.status === "postponed");
    return {
      id: "betalningsplan",
      why: "Förhandlingsläget är bäst medan betalningarna fortfarande sköts. Den som hör av sig först får villkor; den som hör av sig efter en utebliven betalning får krav.",
      basis: basisFor(ctx),
      consequence:
        "Uteblivna betalningar utan förvarning gör motparten till borgenär i stället för till samarbetspartner - och en borgenär som känner sig förbigången driver in hårdare.",
      steps: [
        { label: "Läs vad som gäller de första veckorna", href: "/kunskap/likviditetskris-forsta-steg", done: false },
        { label: "Se vilka betalningar som ligger närmast", href: "/dashboard#frister", done: false },
        { label: "Registrera den nya planen: markera betalningen som uppskjuten", href: "/dashboard#frister", done: postponed },
      ],
      complete: postponed,
      offersMatching: false,
    };
  }

  if (/fakturabelåning|checkkredit/i.test(label)) {
    return {
      id: "finansiering",
      why: "Fakturabelåning och checkkredit ändrar inte hur mycket bolaget tjänar - de flyttar pengarna dit där de behövs i tiden. Det är rätt verktyg mot en tillfällig svacka och fel verktyg mot en varaktig förlust.",
      basis: basisFor(ctx),
      consequence:
        "Extern finansiering som tas UTAN en prognos löser en månad och fördjupar nästa. Ordningen spelar roll: prognosen först, samtalet med banken sedan.",
      steps: [
        { label: "Gör prognosen först - den visar hur stort behovet är", href: "/likviditetsplan", done: ctx.payments.length > 0 },
        { label: "Ta upp finansieringen med någon som kan siffrorna", href: "/marketplace", done: false },
      ],
      complete: false,
      offersMatching: true,
    };
  }

  if (/informera personalen/i.test(label)) {
    return {
      id: "personalen",
      why: "De anställda omfattas av den statliga lönegarantin, men skyddet gäller först när konkursen är beslutad. Det är den skillnaden som avgör vad man ärligt kan lova på ett möte.",
      basis: basisFor(ctx),
      consequence:
        "Personal som får veta av någon annan slutar lyssna på ledningen - och i en avveckling är det ledningens ord som håller ihop de sista veckorna.",
      steps: [
        { label: "Läs vad lönegarantin täcker, och när", href: "/kunskap/lonegaranti", done: false },
      ],
      complete: false,
      offersMatching: false,
    };
  }

  if (/selektiva betalningar/i.test(label)) {
    return {
      id: "selektiva-betalningar",
      why: "Betalningar till enskilda borgenärer nära en konkurs kan komma att gås igenom i efterhand. Det gäller även betalningar som kändes självklara när de gjordes.",
      basis: basisFor(ctx),
      consequence:
        "En betalning som görs nu kan behöva förklaras senare - av dig, i efterhand, utan möjlighet att göra om den.",
      steps: [
        { label: "Läs vad som gäller kring betalningar före en konkurs", href: "/kunskap/konkurs", done: false },
        { label: "Stäm av med en jurist innan nästa betalning", href: "/marketplace", done: advisorInCase(ctx) },
      ],
      complete: false,
      offersMatching: true,
    };
  }

  if (/avyttra tillgångar/i.test(label)) {
    return {
      id: "avyttring",
      why: "Tillgångar som inte behövs för driften binder pengar som behövs för den. Vad som är kritiskt avgörs av verksamheten, inte av bokfört värde.",
      basis: basisFor(ctx),
      consequence:
        "En försäljning nära en konkurs kan komma att prövas i efterhand, särskilt till närstående eller till underpris. Dokumentera hur priset sattes.",
      steps: [
        { label: "Läs om ordningen de första veckorna", href: "/kunskap/likviditetskris-forsta-steg", done: false },
        { label: "Lägg in effekten i likviditetsplanen", href: "/likviditetsplan", done: ctx.payments.length > 0 },
      ],
      complete: false,
      offersMatching: false,
    };
  }

  // Okänd uppgift: ärlig grundvy, inga påhittade steg.
  return {
    id: "generisk",
    why: c.recommendationTitle
      ? `Uppgiften ingår i handlingsplanen för bedömningen: ${c.recommendationTitle.toLowerCase().replace(/\.$/, "")}.`
      : "Uppgiften ingår i ärendets handlingsplan.",
    basis: basisFor(ctx),
    consequence: "Öppna punkter i handlingsplanen är dokumenterade åtaganden - det som inte görs syns.",
    steps: [],
    complete: false,
    offersMatching: false,
  };
};

/* -------------------------------------------------------------------------- */
/* Rådgivarmatchningen                                                        */
/* -------------------------------------------------------------------------- */

export interface ProfessionalMatch {
  professional: ProfessionalRecord;
  score: number;
  reasons: string[];
}

export const matchProfessionals = (
  caseRecord: CaseRecord,
  professionals: ProfessionalRecord[],
): ProfessionalMatch[] => {
  const wantedCategory =
    caseRecord.recommendationType === "reconstruction"
      ? "rekonstruktor"
      : caseRecord.recommendationType === "bankruptcy"
        ? "affarsjurist"
        : null;

  return professionals
    .map((professional) => {
      let score = 0;
      const reasons: string[] = [];
      if (wantedCategory && professional.category === wantedCategory) {
        score += 50;
        reasons.push(
          wantedCategory === "rekonstruktor"
            ? "arbetar med företagsrekonstruktion, vilket utvärderingen pekar mot"
            : "har konkurs- och obeståndsvana, vilket situationen kräver",
        );
      }
      const spec = (professional.specializations ?? []).join(" ").toLowerCase();
      if (caseRecord.canPayTax === false && /styrelseansvar|obestånd/.test(spec)) {
        score += 20;
        reasons.push("specialiserad på företrädaransvar och obeståndsfrågor");
      }
      if (/kontrollbalans/.test(spec)) {
        score += 10;
        reasons.push("erfarenhet av kontrollbalansräkningar");
      }
      if (professional.verified) {
        score += 15;
        reasons.push("granskad och godkänd i partnerregistret");
      }
      if ((professional.fixedPrices ?? []).length > 0) {
        score += 5;
        reasons.push("öppna fasta priser");
      }
      return { professional, score, reasons };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
};

/* ==========================================================================
   src/lib/guidedArrival.ts
   ========================================================================== */

/**
 * REKOMMENDATIONEN ÄR EN DÖRR.
 *
 * "Gör en likviditetsprognos för de kommande 90 dagarna" stod som död
 * text i systemanalysen. Användaren läste vad hen borde göra, och fick
 * sedan själv leta rätt på verktyget som gör det. Det är den vanligaste
 * sortens övergivande i en produkt som ska leda någon genom en kris: rådet
 * gavs, men vägen fanns inte.
 *
 * Tre regler:
 *
 * 1. DESTINATIONEN KOMMER UR SPELBOKEN. `playbookForTask` vet redan vad en
 *    uppgift kräver och var det görs. Att skriva en andra tabell över
 *    "var hamnar man" hade gett två sanningar som glider isär - och då
 *    kan handlingsplanen och systemanalysen peka åt olika håll för samma
 *    mening.
 * 2. INGEN DÖRR SOM INTE LEDER NÅGONSTANS. Saknar spelboken steg finns
 *    ingen dörr, och raden förblir text. Ett klick som landar på en sida
 *    utan koppling till det man läste är värre än ingen länk alls.
 * 3. DEN SOM KOM SKA VETA VARFÖR. Ankomsten bär med sig VAD man kom för,
 *    VARFÖR det behövs och vad SLUTFÖRT betyder - och en väg tillbaka som
 *    bockar av uppgiften. Se docs/design-system.md, "Förbered användaren".
 */

/** Frågeparametern som bär med sig var man kom ifrån. */
export const ORIGIN_PARAM = "fran";

export interface Destination {
  /** Vart klicket leder, inklusive ursprunget. */
  href: string;
  /** Spelboken bakom, så att ankomsten kan säga varför. */
  playbook: TaskPlaybook;
}

/**
 * Ursprunget som en sträng i adressen.
 *
 * Uppgiftens id när den kommer ur handlingsplanen; annars spelbokens id.
 * Det senare räcker för att kunna säga "du kom hit för att göra
 * likviditetsprognosen" även när raden inte är en sparad uppgift - och
 * bara det förra kan bockas av.
 */
export const withOrigin = (href: string, origin: string): string => {
  const [path, hash] = href.split("#");
  const joined = `${path}${path.includes("?") ? "&" : "?"}${ORIGIN_PARAM}=${encodeURIComponent(origin)}`;
  return hash ? `${joined}#${hash}` : joined;
};

export const readOrigin = (search: string): string | null => {
  try {
    const value = new URLSearchParams(search).get(ORIGIN_PARAM);
    return value && value.trim() ? value : null;
  } catch {
    return null;
  }
};

/**
 * Dörren bakom en rekommendation, eller null.
 *
 * Det FÖRSTA steget i spelboken är destinationen: spelböckerna är skrivna
 * i ordning, och det första steget är det som faktiskt går att börja med.
 * Ett steg som redan är gjort hoppas över - att skicka någon till en sida
 * där arbetet är klart är att slösa deras enda uppmärksamhet.
 */
export const destinationFor = (
  label: string,
  ctx: TaskContext,
  origin?: string,
): Destination | null => {
  const playbook = playbookForTask(label, ctx);
  if (playbook.steps.length === 0) return null;
  const next = playbook.steps.find((step) => !step.done) ?? playbook.steps[0];
  return {
    href: origin ? withOrigin(next.href, origin) : next.href,
    playbook,
  };
};

/* --- Ankomsten ------------------------------------------------------------ */

export interface Arrival {
  /** Uppgiften man kom för att göra. */
  task: string;
  /** Varför den behövs - spelbokens motivering, oförändrad. */
  why: string;
  /** Vad som räknas som klart här. */
  doneMeans: string;
  /** Vad som händer när man är klar. */
  afterwards: string;
}

/**
 * Vad "klart" betyder på den sida man landat på.
 *
 * Skrivet per destination och inte per uppgift: det är SIDAN som avgör
 * vad man kan bli färdig med där. En text som lovar mer än sidan kan
 * leverera skickar tillbaka användaren utan att något blivit gjort.
 */
const DONE_MEANS: { pattern: RegExp; text: string }[] = [
  { pattern: /^\/likviditetsplan/, text: "Planen är klar när posterna för de kommande 90 dagarna är inlagda och kurvan visar när det blir tight." },
  { pattern: /^\/kbr/, text: "Bedömningen är klar när balansposterna är ifyllda och du fått ett daterat besked." },
  { pattern: /^\/dashboard\/dokument/, text: "Underlaget räcker när kontoutdrag och senaste bokslut ligger i akten." },
  { pattern: /^\/dashboard\/deltagare/, text: "Klart när inbjudan är skickad - deltagaren ser ärendet så snart den accepteras." },
  { pattern: /^\/marketplace/, text: "Klart när förfrågan är skickad till minst en rådgivare." },
  { pattern: /^\/kunskap/, text: "Klart när du läst igenom och vet vad som gäller i ditt fall." },
  { pattern: /^\/dashboard/, text: "Klart när ändringen är registrerad i ärendet." },
];

export const doneMeansFor = (href: string): string =>
  DONE_MEANS.find((d) => d.pattern.test(href))?.text ??
  "Klart när du gjort det uppgiften beskriver.";

export const buildArrival = (task: string, playbook: TaskPlaybook, href: string): Arrival => ({
  task,
  why: playbook.why,
  doneMeans: doneMeansFor(href),
  afterwards:
    "När du är klar bockar du av uppgiften här nedanför och kommer tillbaka till handlingsplanen.",
});

/* ==========================================================================
   src/lib/integrations/caseBundle.ts
   ========================================================================== */

/**
 * Aktexport: hela ärendet som ett strukturerat paket, och fristerna som
 * kalenderfil.
 *
 * Det här är kopplingen mot advokatbyråsystem - byggd som export i stället
 * för som API-integration, av ett skäl som är värt att stå för: en byrå ska
 * kunna ta emot akten OAVSETT vilket system den kör, och företaget ska
 * kunna lämna plattformen med allt sitt material. Ett format alla kan läsa
 * slår tio partneravtal, och samma paket är dessutom dataexporten som gör
 * "svarta lådan" i visionen verklig.
 *
 * Två delar:
 *
 *  - `buildCaseBundle`: JSON-manifest med ärendet, ekonomin, fristerna,
 *    dokumentlistan och korrespondensen. Själva filerna följer inte med i
 *    manifestet (de hämtas via sina signerade URL:er); manifestet är
 *    innehållsförteckningen med filnamn och storlek, så att en mottagare
 *    kan kontrollera att akten är komplett.
 *
 *  - `timelineToIcs`: fristerna som iCalendar. Outlook, Google Calendar och
 *    varje advokatsystem med kalender kan importera .ics - en missad frist
 *    är den dyraste händelsen i hela processen, och det här flyttar
 *    bevakningen till system byrån redan tittar i varje dag.
 */

/** Versionsmärkt: en mottagare ska kunna avvisa ett format den inte kan läsa. */
export const BUNDLE_FORMAT_VERSION = 1;

export interface CaseBundle {
  format: "clearance-akt";
  formatVersion: number;
  exportedAt: string;
  case: {
    id: string;
    orgNumber: string;
    companyName: string | null;
    employees: string | null;
    totalDebt: string | null;
    recommendation: {
      type: CaseRecord["recommendationType"];
      title: string | null;
      reasons: string[];
      nextSteps: string[];
    };
    createdAt: string;
  };
  deadlines: {
    date: string;
    label: string;
    amount: number | null;
    severity: string;
    note: string | null;
  }[];
  payments: {
    label: string;
    amount: number;
    category: string;
    status: string;
    dueDate: string;
  }[];
  documents: {
    fileName: string;
    kind: string;
    fileSize: number;
    uploadedAt: string;
    note: string | null;
  }[];
  correspondence: {
    at: string;
    /** "company" eller "counterpart" - aldrig namn eller id. Manifest kan
     *  vidarebefordras, och vem som skrev vad i klartext hör till ärendet,
     *  inte till innehållsförteckningen. */
    author: "company" | "counterpart";
    body: string;
  }[];
}

export const buildCaseBundle = (input: {
  caseRecord: CaseRecord;
  timeline: TimelineEvent[];
  payments: PaymentRecord[];
  documents: DocumentRecord[];
  messages: CaseMessage[];
  /** Ärendets ägare, för author-klassningen i korrespondensen. */
  ownerUserId: string | null;
  exportedAt: string;
}): CaseBundle => ({
  format: "clearance-akt",
  formatVersion: BUNDLE_FORMAT_VERSION,
  exportedAt: input.exportedAt,
  case: {
    id: input.caseRecord.id,
    orgNumber: input.caseRecord.orgNumber,
    companyName: input.caseRecord.companyName,
    employees: input.caseRecord.employees,
    totalDebt: input.caseRecord.totalDebt,
    recommendation: {
      type: input.caseRecord.recommendationType,
      title: input.caseRecord.recommendationTitle,
      reasons: input.caseRecord.recommendationReasons,
      nextSteps: input.caseRecord.recommendationNextSteps,
    },
    createdAt: input.caseRecord.createdAt,
  },
  deadlines: input.timeline.map((event) => ({
    date: event.iso,
    label: event.label,
    amount: event.amount,
    severity: event.severity,
    note: event.note ?? null,
  })),
  payments: input.payments.map((p) => ({
    label: p.label,
    amount: p.amount,
    category: p.category,
    status: p.status,
    dueDate: p.dueDate,
  })),
  documents: input.documents.map((d) => ({
    fileName: d.fileName,
    kind: d.kind,
    fileSize: d.fileSize,
    uploadedAt: d.createdAt,
    note: d.note,
  })),
  correspondence: input.messages.map((m) => ({
    at: m.createdAt,
    author: m.authorUserId === input.ownerUserId ? "company" : "counterpart",
    body: m.body,
  })),
});

/* -------------------------------------------------------------------------- */
/* iCalendar                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * RFC 5545 kräver escapning av semikolon, komma och radbrytning i textfält.
 * Utan den blir "Skatt; personligt ansvar" två halva fält hos mottagaren.
 */
const escapeIcsText = (value: string): string =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

/**
 * Radvikning enligt RFC 5545: rader över 75 oktetter viks med CRLF + space.
 * Vissa kalenderklienter kastar annars hela komponenten.
 */
const foldIcsLine = (line: string): string => {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const char of line) {
    const charBytes = new TextEncoder().encode(char).length;
    const limit = parts.length === 0 ? 75 : 74; // fortsättningsrader börjar med space
    if (currentBytes + charBytes > limit) {
      parts.push(current);
      current = char;
      currentBytes = charBytes;
    } else {
      current += char;
      currentBytes += charBytes;
    }
  }
  if (current) parts.push(current);
  return parts.join("\r\n ");
};

/**
 * Fristerna som heldagshändelser.
 *
 * Heldag med flit: en lagstadgad frist gäller dagen, inte ett klockslag,
 * och en händelse 00:00 ser ut som midnatt i mottagarens kalender. VALARM
 * tre dagar före ger samma varsel som produktens egen varning - de två ska
 * inte säga olika saker.
 */
export const timelineToIcs = (
  events: TimelineEvent[],
  meta: { companyName: string | null; orgNumber: string; generatedAt: string },
): string => {
  const stamp = meta.generatedAt.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Landvex AB//Clearance//SV",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const event of events) {
    const date = event.iso.replace(/-/g, "");
    const who = meta.companyName ?? meta.orgNumber;
    const summary = `${event.label} – ${who}`;
    const description =
      (event.note ? `${event.note}. ` : "") +
      (event.amount !== null ? `Belopp: ${String(Math.round(event.amount)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr. ` : "") +
      "Exporterad från Clearance.";
    lines.push(
      "BEGIN:VEVENT",
      // Deterministiskt UID: samma frist ger samma UID, så en omimport
      // uppdaterar händelsen i stället för att dubblera den.
      `UID:${meta.orgNumber.replace(/\D/g, "")}-${date}-${event.label.replace(/\W/g, "").slice(0, 24)}@clearance`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${date}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      ...(event.severity === "critical" ? ["PRIORITY:1"] : []),
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcsText(`Om tre dagar: ${event.label}`)}`,
      "TRIGGER:-P3D",
      "END:VALARM",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
};

/* ==========================================================================
   src/lib/reports/types.ts
   ========================================================================== */

/**
 * The shape of a CLEARANCE report.
 *
 * Reports are described as data, not assembled as HTML at each call site.
 * That keeps every report in the product looking like the same document,
 * makes the rendering testable without a browser, and means a change to the
 * document design happens in one file rather than four.
 */

export type Tone = "neutral" | "good" | "warning" | "critical";

export interface ReportMeta {
  /** What this document is, e.g. "Krisanalys". */
  documentTitle: string;
  companyName: string | null;
  orgNumber: string | null;
  /** Case or plan reference, printed so a reader can cite the document. */
  reference: string | null;
  /** ISO timestamp. */
  generatedAt: string;
}

export interface KeyValue {
  label: string;
  value: string;
  tone?: Tone;
  /** Smaller line under the value. */
  note?: string;
}

export interface TableColumn {
  label: string;
  align?: "left" | "right";
  /** Renders with tabular figures so columns of money line up. */
  numeric?: boolean;
}

export interface TableRow {
  cells: string[];
  tone?: Tone;
}

export interface ListItem {
  text: string;
  /** Deadline, legal reference or similar. */
  note?: string;
  emphasis?: boolean;
}

export type ReportBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "keyValues"; items: KeyValue[] }
  | {
      kind: "table";
      columns: TableColumn[];
      rows: TableRow[];
      /** Rendered as a bold summary row under the rule. */
      totals?: string[];
      /** Shown instead of the table when there are no rows. */
      emptyText?: string;
    }
  | { kind: "list"; ordered?: boolean; items: ListItem[] }
  | { kind: "callout"; tone: Tone; title: string; body: string; legalRef?: string }
  | { kind: "figures"; items: { value: string; label: string; note?: string; tone?: Tone }[] };

export interface ReportSection {
  title: string;
  intro?: string;
  blocks: ReportBlock[];
}

export interface ReportModel {
  meta: ReportMeta;
  /** Blocks above the first section heading - the reader's summary. */
  lead: ReportBlock[];
  sections: ReportSection[];
  /**
   * Printed in full at the end of every report. Required, not optional: a
   * document that leaves the building has to carry it.
   */
  disclaimer: string;
}

/* ==========================================================================
   src/lib/integrations/creditDossier.ts
   ========================================================================== */

/**
 * Kreditunderlaget: det dokument ett företag skickar när det söker
 * finansiering - factoring, rörelsekredit, brygglån eller
 * rekonstruktionsfinansiering.
 *
 * GRÄNSEN, beslutad i docs/VISION.md och värd att upprepa där koden bor:
 * plattformen PRODUCERAR underlag, den REKOMMENDERAR inte kredit och den
 * FÖRMEDLAR ingenting. Ny skuld till ett bolag nära obestånd kan skada
 * borgenärerna, och förmedling är blockerad tills tillståndsfrågor (FI) och
 * medverkansansvar är juridiskt bedömda. Det här dokumentet är företagets
 * eget, att skicka till vem det vill.
 *
 * Underlagets värdegrund är densamma som resten av produkten: ärlighet som
 * konkurrensfördel. Ett kreditunderlag från Clearance redovisar ÄVEN det
 * som talar emot - skattesituationen, dag då kassan tar slut, KBR-läget.
 * En finansiär som upptäcker att underlaget döljer saker slutar läsa
 * underlag härifrån, och då är hela kanalen död. Därför vägrar byggaren
 * producera ett dokument när väsentliga fält saknas, i stället för att
 * skriva ett tunnare dokument som ser komplett ut.
 */

export interface CreditDossierInput {
  caseRecord: CaseRecord;
  /** Ur likviditetsplanen. Null = planen är inte gjord. */
  liquidity: {
    openingBalance: number;
    daysUntilNegative: number | null;
    horizonDays: number;
    monthlyIn: number;
    monthlyOut: number;
  } | null;
  /** Ur KBR-beräkningen. Null = inte gjord. */
  kbr: {
    shareCapital: number;
    equity: number;
    required: boolean;
  } | null;
  /** Vad pengarna ska användas till och hur mycket. Företagets egna ord. */
  request: {
    amount: number;
    purpose: string;
    /** T.ex. "factoring", "rörelsekredit", "brygglån". */
    kind: string;
  };
  generatedAt: string;
}

export type CreditDossierResult =
  | { ok: true; report: ReportModel; package: CreditPackage }
  | { ok: false; missing: string[] };

/**
 * Det maskinläsbara paketet - samma innehåll som dokumentet, för den dag en
 * mottagare hellre tar JSON. Versionsmärkt som aktexporten.
 */
export interface CreditPackage {
  format: "clearance-kreditunderlag";
  formatVersion: 1;
  generatedAt: string;
  company: { orgNumber: string; name: string | null; employees: string | null };
  request: { amount: number; purpose: string; kind: string };
  position: {
    totalDebt: number | null;
    liquidity: CreditDossierInput["liquidity"];
    kbr: CreditDossierInput["kbr"];
    assessment: CaseRecord["recommendationType"];
  };
  /** Alltid med: vad underlaget INTE är. */
  disclaimer: string;
}

// Egen tusentalsgruppering, inte toLocaleString: den ger U+00A0, som ser ut
// som mellanslag men inte är det, och bryter sökningar i färdiga dokument.
// Samma beslut som formatOre i src/lib/invoice.ts.
const sek__integrations_creditDossier = (value: number): string =>
  `${String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`;

const DISCLAIMER =
  "Underlaget är sammanställt av företaget självt i Clearance ur de uppgifter " +
  "företaget lämnat och läst in. Clearance och Landvex AB rekommenderar inte " +
  "kreditgivning, förmedlar inte krediter och ansvarar inte för beslut som " +
  "fattas på underlaget. Uppgifterna har inte reviderats.";

/**
 * Bygger underlaget, eller vägrar med en lista på vad som saknas.
 *
 * Kravet på likviditetsplan är absolut: ett kreditunderlag utan
 * likviditetsprognos för ett bolag i kris är inte ofullständigt, det är
 * missvisande - frågan varje finansiär ställer är "när tar pengarna slut".
 */
export const buildCreditDossier = (input: CreditDossierInput): CreditDossierResult => {
  const missing: string[] = [];
  if (!input.caseRecord.companyName) missing.push("företagsnamn");
  if (!input.liquidity) missing.push("likviditetsplan (gör den i Likviditetsplanering)");
  if (input.request.amount <= 0) missing.push("sökt belopp");
  if (input.request.purpose.trim().length < 10)
    missing.push("ändamål (beskriv vad finansieringen ska användas till)");
  if (missing.length > 0) return { ok: false, missing };

  const liquidity = input.liquidity!;
  const runwayTone: Tone =
    liquidity.daysUntilNegative === null
      ? "good"
      : liquidity.daysUntilNegative < 30
        ? "critical"
        : "warning";

  const report: ReportModel = {
    meta: {
      documentTitle: "Kreditunderlag",
      companyName: input.caseRecord.companyName,
      orgNumber: input.caseRecord.orgNumber,
      reference: input.caseRecord.id.slice(0, 8),
      generatedAt: input.generatedAt,
    },
    lead: [
      {
        kind: "keyValues",
        items: [
          { label: "Sökt finansiering", value: sek__integrations_creditDossier(input.request.amount) },
          { label: "Typ", value: input.request.kind },
          {
            label: "Kassan räcker",
            value:
              liquidity.daysUntilNegative === null
                ? `mer än ${liquidity.horizonDays} dagar`
                : `${liquidity.daysUntilNegative} dagar`,
            tone: runwayTone,
          },
        ],
      },
      { kind: "paragraph", text: input.request.purpose },
    ],
    sections: [
      {
        title: "Likviditet",
        intro:
          "Ur företagets likviditetsplan i Clearance. Prognosen bygger på de " +
          "betalningar och fordringar företaget själv registrerat.",
        blocks: [
          {
            kind: "keyValues",
            items: [
              { label: "Kassa vid underlagets datum", value: sek__integrations_creditDossier(liquidity.openingBalance) },
              { label: "Inbetalningar per månad", value: sek__integrations_creditDossier(liquidity.monthlyIn) },
              { label: "Utbetalningar per månad", value: sek__integrations_creditDossier(liquidity.monthlyOut) },
              {
                label: "Dag då kassan är förbrukad",
                value:
                  liquidity.daysUntilNegative === null
                    ? `Inte inom prognosens ${liquidity.horizonDays} dagar`
                    : `Om ${liquidity.daysUntilNegative} dagar`,
                tone: runwayTone,
              },
            ],
          },
        ],
      },
      {
        title: "Ställning och skulder",
        intro:
          "Det som talar emot redovisas här, av samma skäl som resten: ett " +
          "underlag som döljer något är värdelöst för båda parter.",
        blocks: [
          {
            kind: "keyValues",
            items: [
              {
                label: "Total skuld enligt företaget",
                value:
                  input.caseRecord.totalDebt !== null
                    ? sek__integrations_creditDossier(Number(input.caseRecord.totalDebt))
                    : "Ej angiven",
              },
              ...(input.kbr
                ? [
                    {
                      label: "Eget kapital mot aktiekapital",
                      value: `${sek__integrations_creditDossier(input.kbr.equity)} av ${sek__integrations_creditDossier(input.kbr.shareCapital)}`,
                      tone: (input.kbr.required ? "critical" : "neutral") as Tone,
                      note: input.kbr.required
                        ? "Kontrollbalansräkning krävs (ABL 25 kap. 13 §)."
                        : undefined,
                    },
                  ]
                : []),
              {
                label: "Clearances lägesbedömning",
                value:
                  input.caseRecord.recommendationTitle ??
                  input.caseRecord.recommendationType ??
                  "Ej gjord",
              },
            ],
          },
        ],
      },
    ],
    disclaimer: DISCLAIMER,
  };

  return {
    ok: true,
    report,
    package: {
      format: "clearance-kreditunderlag",
      formatVersion: 1,
      generatedAt: input.generatedAt,
      company: {
        orgNumber: input.caseRecord.orgNumber,
        name: input.caseRecord.companyName,
        employees: input.caseRecord.employees,
      },
      request: input.request,
      position: {
        totalDebt: input.caseRecord.totalDebt !== null ? Number(input.caseRecord.totalDebt) : null,
        liquidity: input.liquidity,
        kbr: input.kbr,
        assessment: input.caseRecord.recommendationType,
      },
      disclaimer: DISCLAIMER,
    },
  };
};

/* -------------------------------------------------------------------------- */
/* Likviditet ur ärendets betalningar                                         */
/* -------------------------------------------------------------------------- */

/**
 * Härleder underlagets likviditetssiffror ur ärendets registrerade
 * betalningar och fakturor, plus den kassa användaren anger.
 *
 * Ren funktion med "idag" som argument, som allt annat datumberoende.
 * Enkel modell med flit: väntande utflöden och inflöden inom horisonten,
 * dag för dag, tills saldot går under noll. Underlaget redovisar siffrorna
 * som prognos ur registrerad data - inte som sanning.
 */
export const dossierLiquidityFromPayments = (input: {
  openingBalance: number;
  /** Väntande utbetalningar: belopp och förfallodatum (ISO). */
  outflows: { amount: number; dueDate: string }[];
  /** Väntande inbetalningar (kundfakturor): belopp och förfallodatum. */
  inflows: { amount: number; dueDate: string }[];
  today: Date;
  horizonDays?: number;
}): NonNullable<CreditDossierInput["liquidity"]> => {
  const horizonDays = input.horizonDays ?? 90;
  const todayIso = input.today.toISOString().slice(0, 10);
  const horizonEnd = new Date(input.today.getTime() + horizonDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const within = <T extends { dueDate: string }>(rows: T[]) =>
    rows.filter((r) => r.dueDate >= todayIso && r.dueDate <= horizonEnd);

  const outflows = within(input.outflows);
  const inflows = within(input.inflows);

  // Dag-för-dag-saldo. Första dagen saldot är negativt är svaret på
  // finansiärens enda fråga.
  const byDate = new Map<string, number>();
  for (const o of outflows) byDate.set(o.dueDate, (byDate.get(o.dueDate) ?? 0) - o.amount);
  for (const i of inflows) byDate.set(i.dueDate, (byDate.get(i.dueDate) ?? 0) + i.amount);

  let balance = input.openingBalance;
  let daysUntilNegative: number | null = null;
  const dates = [...byDate.keys()].sort();
  for (const date of dates) {
    balance += byDate.get(date)!;
    if (balance < 0 && daysUntilNegative === null) {
      daysUntilNegative = Math.max(
        0,
        Math.round((new Date(date).getTime() - input.today.getTime()) / (24 * 60 * 60 * 1000)),
      );
    }
  }

  const monthsInHorizon = horizonDays / 30;
  return {
    openingBalance: input.openingBalance,
    daysUntilNegative,
    horizonDays,
    monthlyIn: Math.round(inflows.reduce((s, r) => s + r.amount, 0) / monthsInHorizon),
    monthlyOut: Math.round(outflows.reduce((s, r) => s + r.amount, 0) / monthsInHorizon),
  };
};

/* ==========================================================================
   src/lib/integrations/download.ts
   ========================================================================== */

/**
 * Nedladdning av genererade filer.
 *
 * En plats, inte tre kopior: aktexporten, fristkalendern och
 * kreditunderlagspaketet laddar alla ned text. Revoke sker efter ett kort
 * uppskov - återkallas URL:en synkront hinner vissa webbläsare inte starta
 * nedladdningen, och då händer ingenting alls, tyst.
 */
export const downloadTextFile = (
  content: string,
  fileName: string,
  mimeType: string,
): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

/**
 * Öppnar en (signerad) fil-URL i ny flik via ett ankarklick i stället för
 * window.open: popupanrop blockeras tyst i inbäddade och mobila vyer -
 * "Sånt här måste fungera"-klassen av fel - medan ett ankare med target
 * beter sig som en vanlig länk och följer med användargesten.
 */
export const openFileUrl = (url: string): void => {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};

/* ==========================================================================
   src/lib/integrations/registry.ts
   ========================================================================== */

/**
 * Registret över externa kopplingar.
 *
 * Samma princip som PROVIDER_REGISTRY i src/lib/financial/ports.ts: varje
 * mål är beskrivet med ärlig status INNAN någon integration byggs, så att
 * ordningen väljs på fakta och inte på vilken logotyp som ser bäst ut på en
 * bild. Tre statusnivåer, och skillnaden mellan dem är hela poängen:
 *
 *  - "fil": fungerar idag, utan avtal. Användaren exporterar en fil ur
 *    motpartens system och läser in den här (eller tvärtom). Ingen part
 *    behöver ge oss någonting.
 *  - "avtal": tekniken finns (API, OAuth) men kräver partneravtal,
 *    API-nycklar eller registrering hos motparten innan en rad kod är
 *    meningsfull att skriva.
 *  - "blockerad": får inte byggas förrän ett namngivet beslut är fattat -
 *    tillstånd, juridisk bedömning eller ett uttryckligt undantag från
 *    principen om inga yttre beroenden. Se docs/VISION.md.
 *
 * Fält märkta ANTAGANDE är inte verifierade mot motparten och ska stämmas
 * av innan de används i avtal eller marknadsföring.
 */

export type IntegrationStatus = "fil" | "avtal" | "blockerad";

export type IntegrationCategory =
  | "bokforing"
  | "kreditgivare"
  | "advokatsystem"
  | "myndighet"
  | "bank"
  | "identitet";

export interface IntegrationTarget {
  id: string;
  name: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  /** Vad kopplingen konkret gör för användaren. */
  value: string;
  /** Vad som är byggt idag. Tom sträng = ingenting. */
  builtToday: string;
  /** Vad som krävs för nästa steg, med den som äger beslutet. */
  nextStep: string;
  assumptions?: string[];
}

export const INTEGRATION_REGISTRY: IntegrationTarget[] = [
  /* ------------------------------ Myndigheter ---------------------------- */
  {
    id: "skatteverket-skattekonto",
    name: "Skatteverket – skattekontot",
    category: "myndighet",
    status: "fil",
    value:
      "Skattekontots transaktioner in i ärendet. Skatteskulden är nästan alltid " +
      "den frist som avgör företrädaransvaret, och idag skrivs den av manuellt.",
    builtToday:
      "Filimport: parsern i src/lib/integrations/skattekonto.ts läser " +
      "skattekontoutdraget som e-tjänsten exporterar, lokalt i webbläsaren.",
    nextStep:
      "Inget API finns för ombud utan Skatteverkets ombudsbehörighet " +
      "(deklarationsombud). Filvägen är den realistiska nivån tills vidare.",
    assumptions: [
      "ANTAGANDE: exportformatet (semikolonseparerad text med datum, " +
        "specifikation och belopp) är avläst ur e-tjänstens utdrag och kan " +
        "ändras av Skatteverket utan förvarning - parsern matchar därför " +
        "rubriker, inte kolumnpositioner.",
    ],
  },
  {
    id: "bolagsverket",
    name: "Bolagsverket – företagsinformation",
    category: "myndighet",
    status: "avtal",
    value:
      "Företagsuppgifter, firmateckning och registreringsstatus hämtas i " +
      "stället för att skrivas in. CompanyLookupPort i src/data/ports.ts är " +
      "redan kontraktet.",
    builtToday: "Porten finns; ingen adapter mot Bolagsverkets API.",
    nextStep:
      "Registrering för Bolagsverkets API-tjänster (vissa är avgiftsbelagda). " +
      "Ägare: Landvex.",
  },
  {
    id: "kronofogden",
    name: "Kronofogden",
    category: "myndighet",
    status: "fil",
    value:
      "Betalningsförelägganden och utmätningsuppgifter hör hemma i ärendets " +
      "tidslinje - de är ofta den verkliga klockan.",
    builtToday: "",
    nextStep:
      "Inget öppet ärende-API finns. Realistisk nivå idag: beslut och " +
      "förelägganden laddas upp som handlingar och fristerna registreras " +
      "för hand - det fungerar, men är manuellt och ska inte kallas en " +
      "koppling.",
  },

  /* ------------------------------ Advokatbyråer -------------------------- */
  {
    id: "advokatsystem-akt",
    name: "Advokatbyråsystem – aktexport",
    category: "advokatsystem",
    status: "fil",
    value:
      "Byrån får hela ärendet som en strukturerad akt i stället för en pärm: " +
      "ärendedata, frister, handlingar och korrespondens i ett paket som " +
      "deras system kan arkivera.",
    builtToday:
      "buildCaseBundle() i src/lib/integrations/caseBundle.ts: JSON-manifest " +
      "med ärende, betalningar, frister, dokumentlista och meddelanden.",
    nextStep:
      "Direktkopplingar per system kräver partneravtal med respektive " +
      "leverantör. Aktexporten är formatet de kopplingarna ska återanvända.",
    assumptions: [
      "ANTAGANDE: vilka system som dominerar bland svenska obeståndsbyråer " +
        "(t.ex. Maat, Saturnus, Kleos) är inte kartlagt mot riktiga byråer. " +
        "Fråga de första anslutna rådgivarna vad de faktiskt använder innan " +
        "något partneravtal söks.",
    ],
  },
  {
    id: "arendesystem-api",
    name: "Ärendesystem – direktsynk (API)",
    category: "advokatsystem",
    status: "avtal",
    value:
      "Akten och fristerna synkas automatiskt in i byråns befintliga " +
      "ärendesystem, i stället för att exporteras som fil.",
    builtToday:
      "Filvägen är byggd och är formatet synken ska återanvända: akten som " +
      "JSON (src/lib/integrations/caseBundle.ts) och fristkalendern som ICS, " +
      "samlad över alla ärenden i praktikervyn.",
    nextStep:
      "Partneravtal med leverantörerna av byråsystem. ANTAGANDE: vilka API:er " +
      "systemen exponerar varierar per leverantör och är inte verifierat.",
  },
  {
    id: "advokatsystem-frister",
    name: "Fristkalender (iCalendar)",
    category: "advokatsystem",
    status: "fil",
    value:
      "Ärendets lagstadgade frister som .ics-fil - importeras av Outlook, " +
      "Google Calendar och varje advokatsystem med kalender. En missad frist " +
      "är den dyraste händelsen i hela processen.",
    builtToday: "timelineToIcs() i src/lib/integrations/caseBundle.ts.",
    nextStep: "Klart att använda. Prenumerationsflöde (löpande synk) kräver API:et i AWS.",
  },

  /* ------------------------------ Kreditgivare --------------------------- */
  {
    id: "kreditunderlag",
    name: "Kreditunderlag till finansiärer",
    category: "kreditgivare",
    status: "fil",
    value:
      "Ett komplett, källmärkt kreditunderlag ur data som redan finns i " +
      "ärendet: läge, likviditetsprognos, skuldbild, säkerheter. Företaget " +
      "fyller i uppgifterna en gång.",
    builtToday:
      "buildCreditDossier() i src/lib/integrations/creditDossier.ts: " +
      "strukturerat paket plus utskrivbart dokument på rapportmotorn.",
    nextStep:
      "Underlaget är ett dokument företaget själv skickar. Se blockeringen " +
      "nedan innan någon förmedling byggs.",
  },
  {
    id: "kreditformedling",
    name: "Kreditförmedling (utskick till flera finansiärer)",
    category: "kreditgivare",
    status: "blockerad",
    value: "Ett underlag, flera mottagare, svar på ett ställe.",
    builtToday: "",
    nextStep:
      "BLOCKERAD tills juridisk bedömning av tillståndsfrågor (FI) och " +
      "medverkansansvar är gjord - ny skuld till ett bolag nära obestånd kan " +
      "skada borgenärerna, och plattformen får producera underlag men aldrig " +
      "rekommendera kredit. Beslut och dokumentation: se docs/VISION.md.",
  },

  {
    id: "creditsafe",
    name: "Creditsafe – kreditbevakning",
    category: "kreditgivare",
    status: "avtal",
    value:
      "Daglig kreditstatus på det egna bolaget, in i ärendet. Ett sänkt " +
      "kreditbetyg är ofta den första yttre signalen på att läget uppfattas " +
      "utifrån - den ska synas här före den syns hos leverantörerna.",
    builtToday:
      "Tabellen (credit_monitoring), dygnskandidaterna " +
      "(credit_check_candidates, högst en slagning per bolag och dygn - " +
      "varje slagning kostar) och arbetarens --credit-läge finns. " +
      "API-anropet aktiveras när nyckeln lagts in i driftpanelen.",
    nextStep:
      "Kundavtal med Creditsafe och API-uppgifter, som läggs in under " +
      "Drift > Driftpanel. Ägare: Landvex.",
    assumptions: [
      "ANTAGANDE: anropsformatet i arbetaren är skrivet mot Creditsafe " +
        "Connect enligt publik dokumentation och MÅSTE verifieras mot " +
        "riktiga uppgifter innan skarp körning.",
    ],
  },

  /* ------------------------------ Bokföring ------------------------------ */
  {
    id: "fortnox",
    name: "Fortnox",
    category: "bokforing",
    status: "avtal",
    value: "Huvudbok, reskontra och verifikat direkt in i FinancialPort.",
    builtToday:
      "Hela domänmodellen (src/lib/financial/model.ts) och portkontraktet " +
      "finns; kontoutdrags-CSV fungerar som filväg. SIE-import finns INTE - " +
      "den vore den naturliga filvägen för bokföringsdata och är obyggd.",
    nextStep: "Fortnox developer-avtal och OAuth-registrering. Ägare: Landvex.",
  },
  {
    id: "visma",
    name: "Visma eEkonomi",
    category: "bokforing",
    status: "avtal",
    value: "Samma som Fortnox, via Visma:s API.",
    builtToday: "Samma kontrakt; ingen adapter.",
    nextStep: "Visma developer-avtal. Ägare: Landvex.",
  },

  /* ------------------------------ Bank och identitet --------------------- */
  {
    id: "psd2",
    name: "Bankdata (PSD2/open banking)",
    category: "bank",
    status: "blockerad",
    value: "Kontosaldon och transaktioner utan manuell export.",
    builtToday: "Kontoutdrags-CSV-importen täcker behovet manuellt.",
    nextStep:
      "BLOCKERAD: kräver AISP-tillstånd hos FI eller en licensierad " +
      "aggregator - båda är yttre beroenden som bryter mot produktens " +
      "grundprincip och måste beslutas som uttryckligt undantag.",
  },
  // BankID är BORTVALT. Signering byggs i egen regi som en enkel
  // elektronisk signatur (src/lib/signing.ts, docs/signering.md): den
  // kopplar en namngiven person till ett exakt innehåll vid en exakt
  // tidpunkt, kontrollerbart i efterhand, utan avtal och utan avgift per
  // signering. Behöver en kund senare en avancerad signatur är det ett
  // eget beslut med egen kostnad - inte något vi väntar på för att kunna
  // leverera signering alls.
];

/** Det som går att använda idag, utan att vänta på någon annan. */
export const availableNow = (): IntegrationTarget[] =>
  INTEGRATION_REGISTRY.filter((t) => t.status === "fil" && t.builtToday !== "");

/** Det som väntar på ett namngivet beslut. */
export const blocked = (): IntegrationTarget[] =>
  INTEGRATION_REGISTRY.filter((t) => t.status === "blockerad");

/* ==========================================================================
   src/lib/integrations/skattekonto.ts
   ========================================================================== */

/**
 * Import av skattekontoutdrag från Skatteverkets e-tjänst.
 *
 * Skattekontot är i praktiken krisens viktigaste enskilda datakälla: en
 * obetald skatteskuld på förfallodagen är det som utlöser företrädaransvaret
 * (SFL 59 kap.), och saldot avgör hur nära den klockan står. Idag skrivs
 * uppgifterna av för hand.
 *
 * Ingen API-koppling finns för den här nivån av åtkomst, och det är inte
 * flaskhalsen: e-tjänsten låter användaren exportera kontohändelserna som
 * fil. Den filen läses här - lokalt i webbläsaren, precis som kontoutdragen
 * i src/lib/bankStatement.ts, och ingenting skickas någonstans.
 *
 * ANTAGANDE, markerat även i integrationsregistret: formatet är avläst ur
 * e-tjänstens utdrag (semikolonseparerad text med rubrikrad, svensk
 * talformatering, datum som ÅÅÅÅ-MM-DD alternativt ÅÅMMDD). Skatteverket kan
 * ändra det utan förvarning, så parsern matchar RUBRIKER, inte
 * kolumnpositioner, och rapporterar varje rad den inte förstår i stället för
 * att gissa. En gissad skatterad är farligare än en saknad: beloppen här
 * styr bedömningen av personligt ansvar.
 */

export interface TaxAccountEntry {
  /** ISO-datum, yyyy-MM-dd. */
  date: string;
  /** Skatteverkets specifikationstext, t.ex. "Debiterad preliminärskatt". */
  specification: string;
  /** Positivt = kreditering (inbetalning/beslut till godo), negativt = debitering. */
  amount: number;
  /** Saldo efter händelsen, när utdraget innehåller det. */
  balance: number | null;
}

export interface ParsedTaxAccount {
  entries: TaxAccountEntry[];
  /** Sista kända saldot, den siffra likviditetsplanen behöver. */
  closingBalance: number | null;
  /** Summan av debiteringar med framtida datum = kommande förfall. */
  upcomingCharges: TaxAccountEntry[];
  skipped: { line: number; reason: string }[];
  /** Vilka rubriker fälten lästes ur, så användaren kan kontrollera. */
  columns: { date: string; specification: string; amount: string; balance: string | null };
}

export type TaxAccountOutcome =
  | { ok: true; account: ParsedTaxAccount }
  | { ok: false; error: string };

/* -------------------------------------------------------------------------- */

/** Rangordnade rubriknycklar, samma teknik som bankparsern. */
const DATE_KEYS = ["bokföringsdag", "bokforingsdag", "datum", "dag"];
const SPEC_KEYS = ["specifikation", "text", "händelse", "handelse", "beskrivning"];
const AMOUNT_KEYS = ["belopp", "summa"];
const BALANCE_KEYS = ["saldo", "ställning", "stallning"];

const normalise__integrations_skattekonto = (value: string): string =>
  value.toLowerCase().replace(/^\ufeff/, "").replace(/"/g, "").trim();

const findColumn = (headers: string[], keys: string[]): number => {
  for (const key of keys) {
    const exact = headers.findIndex((h) => h === key);
    if (exact !== -1) return exact;
  }
  for (const key of keys) {
    const partial = headers.findIndex((h) => h.includes(key));
    if (partial !== -1) return partial;
  }
  return -1;
};

/**
 * Svenska belopp: "1 234,56", "−1 234", "1.234,56 kr". Minustecknet kommer
 * i tre varianter (bindestreck, typografiskt minus, efterställt), och
 * tusentalsavgränsaren kan vara mellanslag, hårt mellanslag eller punkt.
 */
export const parseSwedishAmount = (raw: string): number | null => {
  let s = raw.replace(/["\s\u00a0\u202f]/g, "").replace(/kr$/i, "");
  if (s === "") return null;
  let negative = false;
  if (/^[-−–]/.test(s)) {
    negative = true;
    s = s.slice(1);
  }
  if (/[-−–]$/.test(s)) {
    negative = true;
    s = s.slice(0, -1);
  }
  // Punkt som tusentalsavgränsare bara när ett decimalkomma också finns -
  // annars är "1.5" en decimal.
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const value = Number(s);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
};

/** ÅÅÅÅ-MM-DD, ÅÅÅÅMMDD eller ÅÅMMDD till ISO. */
export const parseSwedishDate = (raw: string): string | null => {
  const s = raw.replace(/"/g, "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})(\d{2})(\d{2})$/);
  // ANTAGANDE: tvåsiffriga år är 20xx. Skattekontot fanns inte före 2000.
  if (m) return `20${m[1]}-${m[2]}-${m[3]}`;
  return null;
};

const pickDelimiter = (headerLine: string): string => {
  const semis = (headerLine.match(/;/g) ?? []).length;
  const tabs = (headerLine.match(/\t/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  if (semis >= tabs && semis >= commas) return ";";
  if (tabs >= commas) return "\t";
  return ",";
};

/**
 * @param text filens innehåll
 * @param today "idag" för klassning av kommande förfall - skickas in så att
 *              tester kan resa i tiden, samma princip som billing.ts
 */
export const parseTaxAccount = (text: string, today: Date): TaxAccountOutcome => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { ok: false, error: "Filen är tom." };

  // Rubrikraden är inte alltid rad ett: utdraget inleds ofta med
  // organisationsnummer och period. Leta efter första raden som innehåller
  // både en datumrubrik och en belopprubrik.
  let headerIndex = -1;
  let delimiter = ";";
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const d = pickDelimiter(lines[i]);
    const cells = lines[i].split(d).map(normalise__integrations_skattekonto);
    if (findColumn(cells, DATE_KEYS) !== -1 && findColumn(cells, AMOUNT_KEYS) !== -1) {
      headerIndex = i;
      delimiter = d;
      break;
    }
  }
  if (headerIndex === -1) {
    return {
      ok: false,
      error:
        "Hittade ingen rubrikrad med datum och belopp. Exportera skattekontots " +
        "kontohändelser från e-tjänsten och ladda upp filen oförändrad.",
    };
  }

  const headers = lines[headerIndex].split(delimiter).map(normalise__integrations_skattekonto);
  const dateCol = findColumn(headers, DATE_KEYS);
  const specCol = findColumn(headers, SPEC_KEYS);
  const amountCol = findColumn(headers, AMOUNT_KEYS);
  const balanceCol = findColumn(headers, BALANCE_KEYS);

  const entries: TaxAccountEntry[] = [];
  const skipped: { line: number; reason: string }[] = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const cells = lines[i].split(delimiter);
    const date = parseSwedishDate(cells[dateCol] ?? "");
    if (!date) {
      skipped.push({ line: i + 1, reason: "Ogiltigt eller saknat datum" });
      continue;
    }
    const amount = parseSwedishAmount(cells[amountCol] ?? "");
    if (amount === null) {
      skipped.push({ line: i + 1, reason: "Ogiltigt eller saknat belopp" });
      continue;
    }
    entries.push({
      date,
      specification: (cells[specCol] ?? "").replace(/"/g, "").trim() || "Okänd händelse",
      amount,
      balance: balanceCol === -1 ? null : parseSwedishAmount(cells[balanceCol] ?? ""),
    });
  }

  if (entries.length === 0) {
    return { ok: false, error: "Ingen rad i filen gick att tolka som en kontohändelse." };
  }

  entries.sort((a, b) => a.date.localeCompare(b.date));

  const todayIso = today.toISOString().slice(0, 10);
  const withBalance = [...entries].reverse().find((e) => e.balance !== null);

  return {
    ok: true,
    account: {
      entries,
      closingBalance: withBalance?.balance ?? null,
      // Debiteringar med framtida datum är kommande förfall - det är de
      // raderna som hör hemma i likviditetsplanen och fristbevakningen.
      upcomingCharges: entries.filter((e) => e.amount < 0 && e.date > todayIso),
      skipped,
      columns: {
        date: headers[dateCol],
        specification: specCol === -1 ? "" : headers[specCol],
        amount: headers[amountCol],
        balance: balanceCol === -1 ? null : headers[balanceCol],
      },
    },
  };
};

/* ==========================================================================
   src/lib/invoiceSpecification.ts
   ========================================================================== */

/**
 * FAKTURAN, SPECIFICERAD PÅ SKÄRMEN.
 *
 * Fakturaraden gick att fälla ut, men det som kom fram var en lista över
 * användningsavgifter - och för en faktura som inte hade några stod det
 * bara att specifikationen låg "utanför". Det är att svara på en fråga
 * med att säga att frågan inte hör hit.
 *
 * En faktura ska gå att läsa i sin helhet: vem som fakturerar, vem som
 * faktureras, vad som ingår, moms per sats, och hur den betalas. Det är
 * inte pynt - det är de uppgifter en faktura måste innehålla för att
 * kunna bokföras, och den som ska betala har rätt att se dem utan att
 * först ladda ner en fil.
 *
 * Underlaget byggs ur SAMMA modell som PDF:en (invoiceFromCustomerRecord
 * i src/lib/reports/invoiceDocuments.ts). Skärmen och filen kan därmed
 * inte säga olika saker - och en faktura som säger två saker om samma
 * belopp är oanvändbar för båda parter.
 */

export interface SpecLine {
  description: string;
  quantity: number;
  /** À-pris exklusive moms. */
  unitPrice: string;
  /** Radsumma exklusive moms. */
  net: string;
}

export interface VatBand {
  /** Satsen i procent, t.ex. "25 %". */
  rate: string;
  /** Underlaget som momsen räknas på. */
  base: string;
  /** Momsbeloppet. */
  amount: string;
}

export interface InvoiceSpecification {
  invoiceNumber: string;
  issued: string;
  due: string;
  /** Betalningsvillkor i dagar, räknat ur datumen. */
  terms: string;
  seller: { name: string; orgNumber: string; vatNumber: string; office: string };
  customer: { name: string; orgNumber: string | null; email: string };
  lines: SpecLine[];
  net: string;
  vatBands: VatBand[];
  vat: string;
  gross: string;
  /** Kontona att betala till. Tomma poster utelämnas av paymentAccounts. */
  paymentAccounts: { label: string; number: string }[];
  /** Referensen som ska anges vid betalning. */
  reference: string;
  /** Skattskyldighetsraden - en faktura utan den är inte fullständig. */
  vatNote: string;
}

const kr__invoiceSpecification = (ore: number): string =>
  `${(ore / 100).toLocaleString("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`;

const swedishDate__invoiceSpecification = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });
};

const daysBetween__invoiceSpecification = (from: string, to: string): number | null => {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
};

/**
 * Specifikationen ur fakturamodellen.
 *
 * Momsen redovisas PER SATS och inte som en klumpsumma. I dag har
 * produkten en sats, men en faktura som blandar 25 och 6 procent måste
 * kunna visa båda - och en struktur som antar en sats behöver skrivas om
 * just den dagen någon ska bokföra den.
 */
export const buildInvoiceSpecification = (
  invoice: Invoice,
  reference: string | null,
): InvoiceSpecification => {
  const lines: SpecLine[] = invoice.lines.map((line) => ({
    description: line.description,
    quantity: line.quantity,
    unitPrice: kr__invoiceSpecification(line.unitPriceOre),
    net: kr__invoiceSpecification(Math.round(line.unitPriceOre * line.quantity)),
  }));

  const days = daysBetween__invoiceSpecification(invoice.issuedAt, invoice.dueAt);

  return {
    invoiceNumber: invoice.invoiceNumber,
    issued: swedishDate__invoiceSpecification(invoice.issuedAt),
    due: swedishDate__invoiceSpecification(invoice.dueAt),
    terms: days === null ? "Enligt avtal" : `${days} dagar netto`,
    seller: {
      name: COMPANY.legalName,
      orgNumber: COMPANY.orgNumber,
      vatNumber: COMPANY.vatNumber,
      office: COMPANY.registeredOffice,
    },
    customer: {
      name: invoice.customer.name,
      orgNumber: invoice.customer.orgNumber,
      email: invoice.customer.email,
    },
    lines,
    net: kr__invoiceSpecification(invoice.totals.netOre),
    vatBands: [
      {
        rate: `${Math.round(invoice.totals.vatRate * 100)} %`,
        base: kr__invoiceSpecification(invoice.totals.netOre),
        amount: kr__invoiceSpecification(invoice.totals.vatOre),
      },
    ],
    vat: kr__invoiceSpecification(invoice.totals.vatOre),
    gross: kr__invoiceSpecification(invoice.totals.grossOre),
    paymentAccounts: paymentAccounts(COMPANY),
    // Fakturanumret är referensen när ingen annan angetts. Att lämna
    // fältet tomt gör betalningen omöjlig att stämma av.
    reference: reference ?? invoice.invoiceNumber,
    vatNote: `Moms redovisas enligt svensk mervärdesskattelag. Momsregistreringsnummer ${COMPANY.vatNumber}.`,
  };
};

/**
 * Filnamnet när fakturan bifogas eller skickas vidare.
 *
 * Fakturanumret först: den som får tio filer i en mapp ska kunna sortera
 * dem utan att öppna någon.
 */
export const invoiceFileName = (invoiceNumber: string): string =>
  `Faktura-${invoiceNumber.replace(/[^\w-]+/g, "-")}.pdf`;

/**
 * Meddelandet som följer med när fakturan skickas vidare.
 *
 * Skrivet för mottagaren - oftast en bokförare som får den vidarebefordrad
 * och inte vet vad CLEARANCE är. Den behöver veta vad det gäller, vad som
 * ska betalas, när, och till vilket konto.
 */
export const forwardMessage = (spec: InvoiceSpecification): { subject: string; body: string } => ({
  subject: `Faktura ${spec.invoiceNumber} från ${spec.seller.name} - ${spec.gross}`,
  body: [
    `Faktura ${spec.invoiceNumber} från ${spec.seller.name} (org.nr ${spec.seller.orgNumber}).`,
    "",
    `Belopp att betala: ${spec.gross} (varav moms ${spec.vat}).`,
    `Förfallodag: ${spec.due}. Villkor: ${spec.terms}.`,
    `Betalningsreferens: ${spec.reference}.`,
    ...spec.paymentAccounts.map((a) => `${a.label}: ${a.number}`),
    "",
    "Fakturan i sin helhet är bifogad som PDF.",
  ].join("\n"),
});

/* ==========================================================================
   src/lib/knowledge.ts
   ========================================================================== */

/**
 * Kunskapsmotorn: strukturerad kunskap om företagskrisens juridik.
 *
 * INFORMATION, INTE RÅDGIVNING. Gränsen är produktens viktigaste
 * kunskapsregel och den bor i datan: varje artikel bär samma
 * gränsmarkering, och sidorna renderar den - de bestämmer inte den.
 * Artiklarna beskriver vad reglerna SÄGER och hänvisar till lagrummen;
 * vad ett enskilt bolag BÖR göra är rådgivarens fråga, och dit pekar
 * varje artikel.
 *
 * Innehållet är en ren datamodul av samma skäl som dokumentmallarna:
 * en felaktig paragraf i en kunskapsartikel är ett fel med rättslig
 * innebörd, och lagrummen testas ordagrant i tests/knowledge.ts.
 */

export interface KnowledgeSection {
  heading: string;
  paragraphs: string[];
}

export interface KnowledgeArticle {
  slug: string;
  title: string;
  /** En mening som säger vad läsaren får veta. */
  summary: string;
  sections: KnowledgeSection[];
  /** Lagrummen artikeln vilar på. Aldrig tom - kunskap utan källa är åsikt. */
  sources: string[];
  related: string[];
}

/** Gränsmarkeringen, ordagrant densamma överallt. */
export const KNOWLEDGE_DISCLAIMER =
  "Det här är allmän information om vad reglerna säger, inte rådgivning om " +
  "ditt bolag. Vad som är rätt i ett enskilt fall beror på omständigheterna - " +
  "stäm av med revisor eller juridisk rådgivare innan beslut fattas.";

export const KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  {
    slug: "kontrollbalansrakning",
    title: "Kontrollbalansräkning - när, hur och varför",
    summary:
      "Styrelsens skyldigheter när halva aktiekapitalet kan vara förbrukat, och vad som händer om de inte fullgörs.",
    sections: [
      {
        heading: "När skyldigheten inträder",
        paragraphs: [
          "Styrelsen ska genast upprätta en kontrollbalansräkning när det finns skäl att ANTA att bolagets eget kapital understiger hälften av det registrerade aktiekapitalet (25 kap. 13 § aktiebolagslagen). Tröskeln är alltså misstanken, inte visshet - att vänta på ett bokslut som bekräftar saken är i sig ett sätt att missa fristen.",
          "Samma skyldighet inträder om bolaget vid utmätning visat sig sakna utmätningsbara tillgångar.",
        ],
      },
      {
        heading: "Vad kontrollbalansräkningen är",
        paragraphs: [
          "En balansräkning upprättad enligt särskilda värderingsregler (25 kap. 14 §): tillgångar får bland annat tas upp till försäljningsvärde i stället för bokfört värde. Den ska granskas av bolagets revisor, om bolaget har en.",
          "Visar den att kapitalet understiger den kritiska gränsen ska styrelsen snarast kalla till bolagsstämma - den första kontrollstämman (25 kap. 15 §) - som prövar om bolaget ska gå i likvidation eller driva verksamheten vidare.",
        ],
      },
      {
        heading: "Åtta månader och den andra kontrollstämman",
        paragraphs: [
          "Beslutar stämman att driva vidare har bolaget åtta månader på sig att läka kapitalbristen. Inom den tiden ska en andra kontrollstämma hållas och en ny, revisorsgranskad kontrollbalansräkning läggas fram (25 kap. 16 §). Visar den inte att kapitalet är återställt ska styrelsen ansöka om likvidation hos tingsrätten (25 kap. 17 §).",
        ],
      },
      {
        heading: "Det personliga ansvaret",
        paragraphs: [
          "Underlåter styrelsen något av stegen svarar ledamöterna solidariskt för de förpliktelser som uppkommer under underlåtenhetsperioden (25 kap. 18 §). Ansvaret gäller framåt från försummelsen - det är därför tidpunkterna dokumenteras: ett styrelseprotokoll som visar när beslutet fattades är ledamotens skydd.",
        ],
      },
    ],
    sources: [
      "25 kap. 13 § aktiebolagslagen (2005:551)",
      "25 kap. 14 § aktiebolagslagen (2005:551)",
      "25 kap. 15-17 §§ aktiebolagslagen (2005:551)",
      "25 kap. 18 § aktiebolagslagen (2005:551)",
    ],
    related: ["foretradaransvar", "foretagsrekonstruktion", "likviditetskris-forsta-steg"],
  },
  {
    slug: "foretagsrekonstruktion",
    title: "Företagsrekonstruktion - andrum för livskraftiga bolag",
    summary:
      "Vad 2022 års rekonstruktionslag kräver, vad förfarandet ger och vad det kostar i tid och pengar.",
    sections: [
      {
        heading: "Vem kan få rekonstruktion",
        paragraphs: [
          "Ett bolag som har ekonomiska svårigheter kan beviljas företagsrekonstruktion om det finns grundad anledning att anta att verksamhetens livskraft kan säkras genom rekonstruktionen (lagen (2022:964) om företagsrekonstruktion). Livskraftstestet är 2022 års stora skärpning: rekonstruktion är till för bolag med en affär som bär, men en balansräkning som inte gör det.",
        ],
      },
      {
        heading: "Vad förfarandet ger",
        paragraphs: [
          "Under rekonstruktionen gäller ett verkställighetsförbud - utmätning och konkursansökningar från borgenärer stoppas som huvudregel. Bolaget driver verksamheten vidare under ledning av en rekonstruktör som tingsrätten utser.",
          "Målet är en rekonstruktionsplan som kan innefatta skuldnedskrivning. Planen antas genom omröstning i borgenärsklasser och kan under vissa förutsättningar fastställas även mot en klass som röstat emot.",
        ],
      },
      {
        heading: "Vad det kräver av bolaget",
        paragraphs: [
          "Rekonstruktörens arvode och ansökningskostnaderna bärs av bolaget - likviditet för driften under förfarandet måste finnas. Lönegarantin kan täcka löner under rekonstruktionen, vilket i praktiken är en väsentlig del av finansieringen.",
          "Ansökan ges in till tingsrätten av bolaget självt (styrelsebeslut) eller av en borgenär med bolagets samtycke.",
        ],
      },
    ],
    sources: [
      "Lagen (2022:964) om företagsrekonstruktion",
      "Lönegarantilagen (1992:497)",
    ],
    related: ["konkurs", "lonegaranti", "kontrollbalansrakning"],
  },
  {
    slug: "konkurs",
    title: "Konkurs - vad som händer, steg för steg",
    summary:
      "Förfarandet när fortsatt drift inte är möjlig: förvaltarens roll, ordningen mellan borgenärer och vad som händer med de anställda.",
    sections: [
      {
        heading: "Obestånd är grunden",
        paragraphs: [
          "Konkurs beslutas av tingsrätten när bolaget är på obestånd: det kan inte betala sina skulder i rätt tid och oförmågan är inte endast tillfällig (1 kap. 2 § konkurslagen). Ansökan kan göras av bolaget självt eller av en borgenär.",
        ],
      },
      {
        heading: "Förvaltaren tar över",
        paragraphs: [
          "I och med konkursbeslutet förlorar styrelsen rådigheten över bolagets egendom. En konkursförvaltare utses av tingsrätten och tar hand om boet: säljer tillgångarna, granskar transaktioner bakåt i tiden (återvinning) och utreder om styrelsen fullgjort sina skyldigheter.",
          "Styrelsens skyldighet att medverka består - bland annat att beediga bouppteckningen.",
        ],
      },
      {
        heading: "De anställda och lönegarantin",
        paragraphs: [
          "Anställdas lönefordringar skyddas av den statliga lönegarantin upp till ett tak. Förvaltaren beslutar om garantibelopp; utbetalningen sköts av länsstyrelsen. Anställningarna upphör inte automatiskt - förvaltaren tar ställning till driften och uppsägningar.",
        ],
      },
      {
        heading: "Konkurs är inte alltid slutet",
        paragraphs: [
          "En verksamhet kan leva vidare genom att förvaltaren säljer den - inkråmet, varumärket, personalen - till en ny ägare. Det bolaget som juridisk person upplöses, men affären kan fortsätta i annan form.",
        ],
      },
    ],
    sources: [
      "1 kap. 2 § konkurslagen (1987:672)",
      "Konkurslagen (1987:672)",
      "Lönegarantilagen (1992:497)",
    ],
    related: ["lonegaranti", "foretagsrekonstruktion", "foretradaransvar"],
  },
  {
    slug: "foretradaransvar",
    title: "Företrädaransvar för skatter - fristen få känner till",
    summary:
      "Styrelsens personliga ansvar för bolagets obetalda skatter, och varför förfallodagen är den dag som räknas.",
    sections: [
      {
        heading: "Huvudregeln",
        paragraphs: [
          "En företrädare som uppsåtligen eller av grov oaktsamhet låter bli att betala bolagets skatt kan bli personligt betalningsansvarig för den (59 kap. 12-13 §§ skatteförfarandelagen). I praxis bedöms passivitet strängt: att fortsätta driften efter förfallodagen utan åtgärd räknas i regel som grov oaktsamhet.",
        ],
      },
      {
        heading: "Verksam åtgärd senast på förfallodagen",
        paragraphs: [
          "Ansvar undviks om företrädaren SENAST på skattens förfallodag vidtar verksamma åtgärder för att avveckla bolagets skulder med hänsyn till samtliga borgenärers intressen - i praktiken konkursansökan, ansökan om företagsrekonstruktion eller betalningsinställelse. Det är den frist som gör skattekontots datum till styrelsens viktigaste kalender.",
        ],
      },
      {
        heading: "Befrielse och nyansering",
        paragraphs: [
          "Det finns utrymme för hel eller delvis befrielse när särskilda skäl talar för det (59 kap. 15 §). Skatteverket ansöker om ansvar hos förvaltningsrätten; det prövas alltså i domstol, inte av verket ensamt.",
        ],
      },
    ],
    sources: [
      "59 kap. 12-13 §§ skatteförfarandelagen (2011:1244)",
      "59 kap. 15 § skatteförfarandelagen (2011:1244)",
    ],
    related: ["kontrollbalansrakning", "likviditetskris-forsta-steg", "konkurs"],
  },
  {
    slug: "lonegaranti",
    title: "Lönegarantin - de anställdas skyddsnät",
    summary:
      "Vem som betalar lönerna vid konkurs och rekonstruktion, hur mycket som täcks och hur det går till.",
    sections: [
      {
        heading: "Vad som täcks",
        paragraphs: [
          "Vid konkurs och företagsrekonstruktion träder den statliga lönegarantin in för anställdas lönefordringar (lönegarantilagen (1992:497)). Garantin täcker lön för viss tid före och under förfarandet samt uppsägningslön, upp till ett tak om fyra prisbasbelopp per anställd.",
        ],
      },
      {
        heading: "Hur det går till",
        paragraphs: [
          "Konkursförvaltaren respektive rekonstruktören beslutar om garantibelopp för varje anställd; länsstyrelsen betalar ut. Den anställde behöver i normalfallet inte själv ansöka - men ska anmäla sina fordringar till förvaltaren.",
          "För bolaget i rekonstruktion är garantin i praktiken en del av finansieringen: den lyfter lönekostnaden under förfarandets inledning. Utbetald garanti blir en statlig regressfordran mot bolaget.",
        ],
      },
    ],
    sources: ["Lönegarantilagen (1992:497)"],
    related: ["konkurs", "foretagsrekonstruktion"],
  },
  {
    slug: "likviditetskris-forsta-steg",
    title: "Likviditetskris - de första stegen i rätt ordning",
    summary:
      "Vad reglerna kräver av styrelsen de första veckorna, och vilka datum som styr.",
    sections: [
      {
        heading: "Skaffa en sann bild, daterad",
        paragraphs: [
          "Allt ansvar i krisjuridiken hänger på tidpunkter: när styrelsen insåg eller borde ha insett läget. Första steget är därför en daterad sammanställning - likviditet vecka för vecka, förfallna skulder, skattekontots saldo och kommande förfallodagar. Det är den bilden övriga beslut ska kunna härledas ur.",
        ],
      },
      {
        heading: "Datumen som styr",
        paragraphs: [
          "Skattens förfallodag styr företrädaransvaret: verksam åtgärd senast den dagen. Misstanke om att halva aktiekapitalet är förbrukat utlöser kontrollbalansplikten: genast. Lönedagen styr personalens förtroende och lönegarantifrågan. De tre klockorna går oberoende av varandra - en handlingsplan som inte visar alla tre är inte en handlingsplan.",
        ],
      },
      {
        heading: "Dokumentera besluten",
        paragraphs: [
          "Styrelsebeslut i kris ska gå att belägga i efterhand: protokollför bedömningarna, även beslutet att INTE agera och skälen för det. I en senare prövning är ett daterat protokoll skillnaden mellan en dokumenterad bedömning och en efterhandskonstruktion.",
        ],
      },
      {
        heading: "Ta in rätt kompetens tidigt",
        paragraphs: [
          "Revisorn, en rekonstruktör eller en obeståndsjurist ser mönster styrelsen möter för första gången. Alternativen - rekonstruktion, underhandsackord, kontrollerad avveckling, konkurs - har olika fönster som stängs i olika takt, och valet mellan dem är rådgivning, inte information.",
        ],
      },
    ],
    sources: [
      "25 kap. 13 § aktiebolagslagen (2005:551)",
      "59 kap. 12-13 §§ skatteförfarandelagen (2011:1244)",
    ],
    related: ["kontrollbalansrakning", "foretradaransvar", "foretagsrekonstruktion"],
  },
];

export const findArticle = (slug: string): KnowledgeArticle | null =>
  KNOWLEDGE_ARTICLES.find((a) => a.slug === slug) ?? null;

/* ==========================================================================
   src/lib/language.ts
   ========================================================================== */

/**
 * Adaptivt språk: samma innebörd, olika förutsättningar hos läsaren.
 *
 * Grundregeln, ordagrant ur produktkravet: systemet får ALDRIG förenkla
 * innehållet så att innebörden ändras - bara göra det lättare att förstå.
 * Om en text är svår är det systemet som ska anpassa sig, inte användaren.
 *
 * Fyra nivåer:
 *
 *  legal        Juridiskt språk. Originaltexten, för professionella läsare.
 *  standard     Klarspråk. Facktermer används men kan klickas och förklaras.
 *               Detta är standardläget - och samma text som legal, eftersom
 *               produktens originaltexter redan är skrivna i klarspråk.
 *  simple       Förenklad svenska: facktermer förklaras direkt i texten,
 *               långa meningar delas.
 *  very_simple  Mycket enkel svenska: korta meningar, ett budskap per
 *               mening, svåra ord utbytta mot vanliga.
 *
 * Motorn är deterministisk: en ordlista med förklaringar (samma ordlista
 * som de klickbara begreppen), en ordbok med enklare synonymer och
 * regelstyrd meningsdelning. Ingen extern tjänst, ingen omskrivning som
 * kan glida i betydelse - och siffror, belopp och datum lämnas alltid
 * orörda, vilket testerna kontrollerar tecken för tecken.
 */

export type LanguageLevel = "legal" | "standard" | "simple" | "very_simple";

export const LANGUAGE_LEVELS: { id: LanguageLevel; label: string; description: string }[] = [
  {
    id: "legal",
    label: "Juridiskt språk",
    description: "Originaltexterna, för jurister, rekonstruktörer och andra professionella läsare.",
  },
  {
    id: "standard",
    label: "Standardsvenska",
    description: "Klarspråk. Facktermer används när de behövs och kan alltid klickas för en förklaring.",
  },
  {
    id: "simple",
    label: "Förenklad svenska",
    description: "Enklare ord och kortare meningar. Juridiska begrepp förklaras direkt i texten.",
  },
  {
    id: "very_simple",
    label: "Mycket enkel svenska",
    description: "Mycket korta meningar. Ett budskap i taget. Inga onödiga fackuttryck.",
  },
];

const STORAGE_KEY = "clearance-language-level";
const CLICK_KEY = "clearance-glossary-clicks";
const DISMISS_KEY = "clearance-language-suggestion-dismissed";
export const LANGUAGE_EVENT = "clearance-language-change";

export const getLanguageLevel = (): LanguageLevel => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "legal" || raw === "standard" || raw === "simple" || raw === "very_simple") return raw;
  } catch {
    /* utan lagring: standard */
  }
  return "standard";
};

export const setLanguageLevel = (level: LanguageLevel): void => {
  try {
    localStorage.setItem(STORAGE_KEY, level);
    window.dispatchEvent(new CustomEvent(LANGUAGE_EVENT));
  } catch {
    /* utan lagring går valet inte att spara - inget att göra */
  }
};

/* --- ordlistan: klickbara juridiska begrepp -------------------------------- */

export interface GlossaryEntry {
  /** Grundformen som visas i förklaringsrutan. */
  term: string;
  /** Böjningar och varianter som ska kännas igen i löptext. */
  variants: string[];
  /** Förklaringen i klarspråk. Ändrar aldrig innebörden - förklarar den. */
  explanation: string;
}

/**
 * Ordlistan är kurerad för hand, inte genererad: varje förklaring ska tåla
 * att läsas av en jurist utan invändning OCH av en läsare utan förkunskaper
 * utan ordbok. Sakligt, aldrig skrämmande - vi säljer kontroll.
 */
export const GLOSSARY: GlossaryEntry[] = [
  {
    term: "kontrollbalansräkning",
    variants: ["kontrollbalansräkningen", "kontrollbalansräkning", "kontrollbalans"],
    explanation:
      "En särskild balansräkning som styrelsen ska upprätta när det finns skäl att anta att bolagets egna kapital är mindre än hälften av det registrerade aktiekapitalet. Den visar om bolaget får fortsätta som vanligt eller om styrelsen måste följa särskilda steg.",
  },
  {
    term: "kontrollstämma",
    variants: ["kontrollstämman", "kontrollstämma"],
    explanation:
      "En bolagsstämma som hålls när kontrollbalansräkningen visar kapitalbrist. Ägarna beslutar där om bolaget ska försöka läka bristen eller avvecklas under ordnade former.",
  },
  {
    term: "företagsrekonstruktion",
    variants: ["företagsrekonstruktionen", "företagsrekonstruktion", "rekonstruktionen", "rekonstruktion"],
    explanation:
      "Det betyder att företaget försöker lösa sina ekonomiska problem och fortsätta verksamheten i stället för att gå i konkurs. Processen sker under domstolens skydd med hjälp av en rekonstruktör.",
  },
  {
    term: "konkurs",
    variants: ["konkursen", "konkurs"],
    explanation:
      "En domstolsprocess där ett företag som inte kan betala sina skulder avvecklas. En konkursförvaltare tar över och fördelar det som finns till dem som ska ha betalt.",
  },
  {
    term: "obestånd",
    variants: ["obeståndet", "obestånd", "insolvens"],
    explanation:
      "Att inte kunna betala sina skulder i tid, och att problemet inte är tillfälligt. Obestånd är den juridiska gränsen för när konkurs kan bli aktuell.",
  },
  {
    term: "personligt betalningsansvar",
    variants: ["personligt betalningsansvar", "personligt ansvar", "företrädaransvar", "medansvar"],
    explanation:
      "Om vissa regler inte följs kan personer i företagets ledning i vissa situationer bli personligt ansvariga för vissa av bolagets skulder. Därför är det viktigt att agera i tid - den som följer stegen skyddar sig.",
  },
  {
    term: "borgenär",
    variants: ["borgenärerna", "borgenärer", "borgenären", "borgenär"],
    explanation: "Någon som företaget är skyldigt pengar - till exempel en leverantör, banken eller Skatteverket.",
  },
  {
    term: "ackord",
    variants: ["ackordet", "ackord", "skulduppgörelse"],
    explanation:
      "En uppgörelse där de som företaget är skyldigt pengar går med på att få en del av sin fordran betald, så att företaget kan leva vidare.",
  },
  {
    term: "likviditet",
    variants: ["likviditeten", "likviditet"],
    explanation: "Pengarna som finns tillgängliga att betala med just nu - inte samma sak som om bolaget går med vinst.",
  },
  {
    term: "kapitalbrist",
    variants: ["kapitalbristen", "kapitalbrist", "förbrukat eget kapital"],
    explanation:
      "När bolagets egna kapital är mindre än hälften av aktiekapitalet. Då kräver aktiebolagslagen att styrelsen följer bestämda steg, med bestämda tidsfrister.",
  },
  {
    term: "frist",
    variants: ["fristerna", "frister", "fristen", "frist", "tidsfrist", "tidsfrister"],
    explanation: "Ett sista datum som lagen eller en myndighet satt. Efter det datumet kan möjligheter stängas eller ansvar skärpas.",
  },
  {
    term: "likvidation",
    variants: ["likvidationen", "likvidation", "tvångslikvidation"],
    explanation:
      "En ordnad avveckling av bolaget: tillgångarna säljs, skulderna betalas så långt det går och bolaget upphör. Tvångslikvidation är när domstol beslutar det för att reglerna inte följts.",
  },
];

/** Längsta varianten först, så "kontrollbalansräkning" vinner över "kontroll". */
const ALL_VARIANTS: { variant: string; entry: GlossaryEntry }[] = GLOSSARY.flatMap((entry) =>
  entry.variants.map((variant) => ({ variant, entry })),
).sort((a, b) => b.variant.length - a.variant.length);

export const findGlossaryEntry = (word: string): GlossaryEntry | null =>
  ALL_VARIANTS.find(({ variant }) => variant.toLowerCase() === word.toLowerCase())?.entry ?? null;

/**
 * Delar en text i vanliga segment och klickbara begrepp, för rendering.
 * Varje förekomst markeras - läsaren ska inte behöva minnas var ordet
 * förklarades första gången.
 */
export const segmentText = (text: string): { text: string; entry: GlossaryEntry | null }[] => {
  const pattern = new RegExp(`(${ALL_VARIANTS.map(({ variant }) => variant).join("|")})`, "gi");
  return text
    .split(pattern)
    .filter((part) => part.length > 0)
    .map((part) => ({ text: part, entry: findGlossaryEntry(part) }));
};

/* --- förenklingsmotorn ----------------------------------------------------- */

/**
 * Enklare synonymer för mycket enkel svenska. Ordboken byter bara ord vars
 * betydelse är densamma i våra texter - aldrig juridiska termer (de
 * förklaras i stället) och aldrig något som ändrar sak eller siffra.
 */
const SIMPLER_WORDS: [RegExp, string][] = [
  [/\bupprätta\b/gi, "ta fram"],
  [/\bupprättas\b/gi, "tas fram"],
  [/\berfordras\b/gi, "behövs"],
  [/\bavseende\b/gi, "om"],
  [/\bsamtliga\b/gi, "alla"],
  [/\bytterligare\b/gi, "fler"],
  [/\bhandlingsutrymme\b/gi, "möjligheter att agera"],
  [/\bdokumentera\b/gi, "skriva ner"],
  [/\bdokumenteras\b/gi, "skrivas ner"],
  [/\bprioritera\b/gi, "ta först"],
  [/\bindikerar\b/gi, "tyder på"],
  [/\bbedömningen\b/gi, "vår genomgång"],
];

/** Ord med versal i behåll när meningen börjar med det utbytta ordet. */
const capitalise__language = (s: string): string => (s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * Första förekomsten av varje juridiskt begrepp får sin förklaring direkt i
 * texten: "kontrollbalansräkning (det betyder: ...)". Övriga förekomster
 * lämnas - förklaringen ska hjälpa, inte dränka.
 */
const explainTermsInline = (text: string): string => {
  const explained = new Set<string>();
  return segmentText(text)
    .map(({ text: part, entry }) => {
      if (!entry || explained.has(entry.term)) return part;
      explained.add(entry.term);
      // Förklaringens första mening räcker i löptext.
      const firstSentence = entry.explanation.split(/(?<=\.)\s/)[0];
      return `${part} (det betyder: ${firstSentence.replace(/\.$/, "").toLowerCase()})`;
    })
    .join("");
};

/** Meningsdelning: ett budskap per mening. Delar vid semikolon, tankstreck
 *  och " och " i långa meningar - aldrig inne i tal eller belopp. */
const splitLongSentences = (text: string, maxWords: number): string => {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const out: string[] = [];
  for (const sentence of sentences) {
    if (sentence.split(/\s+/).length <= maxWords) {
      out.push(sentence);
      continue;
    }
    let parts = sentence.split(/\s*[;–]\s+/);
    if (parts.length === 1) {
      // Sista utvägen: dela vid ", och " / ", men " - tydliga satsgränser.
      parts = sentence.split(/,\s+(?=(?:och|men|vilket|så)\s)/);
    }
    out.push(
      ...parts.map((part, i) => {
        let cleaned = part.trim().replace(/^(och|men|vilket|så)\s+/i, "");
        cleaned = capitalise__language(cleaned);
        if (!/[.!?]$/.test(cleaned)) cleaned += i < parts.length - 1 ? "." : ".";
        return cleaned;
      }),
    );
  }
  return out.join(" ").replace(/\.\.+/g, ".");
};

/**
 * Anpassar en text till vald nivå. Innebörden är densamma - testerna
 * kontrollerar att siffror, belopp och datum är orörda tecken för tecken.
 */
export const adaptText = (text: string, level: LanguageLevel): string => {
  if (level === "legal" || level === "standard") return text;
  let adapted = explainTermsInline(text);
  if (level === "very_simple") {
    for (const [pattern, replacement] of SIMPLER_WORDS) {
      adapted = adapted.replace(pattern, (match) =>
        match[0] === match[0].toUpperCase() ? capitalise__language(replacement) : replacement,
      );
    }
    adapted = splitLongSentences(adapted, 14);
  } else {
    adapted = splitLongSentences(adapted, 26);
  }
  return adapted;
};

/* --- förslaget om enklare språk -------------------------------------------- */

/**
 * Upprepade klick på begreppsförklaringar är en signal, inte ett betyg:
 * systemet föreslår enklare språk EN gång, och ett nej respekteras.
 * Designprincipen står i produktkravet: CLEARANCE ska aldrig få användaren
 * att känna sig dum - det är texten som ska anpassa sig.
 */
export const recordGlossaryClick = (): void => {
  try {
    const count = Number(localStorage.getItem(CLICK_KEY) ?? "0") + 1;
    localStorage.setItem(CLICK_KEY, String(count));
    window.dispatchEvent(new CustomEvent(LANGUAGE_EVENT));
  } catch {
    /* utan lagring: ingen räkning */
  }
};

export const shouldSuggestSimpler = (): boolean => {
  try {
    const level = getLanguageLevel();
    if (level === "simple" || level === "very_simple") return false;
    if (localStorage.getItem(DISMISS_KEY) === "1") return false;
    return Number(localStorage.getItem(CLICK_KEY) ?? "0") >= 3;
  } catch {
    return false;
  }
};

export const dismissSimplerSuggestion = (): void => {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
    window.dispatchEvent(new CustomEvent(LANGUAGE_EVENT));
  } catch {
    /* inget att göra */
  }
};

export const acceptSimplerSuggestion = (): void => {
  setLanguageLevel("simple");
  dismissSimplerSuggestion();
};

/* ==========================================================================
   src/lib/leadSummary.ts
   ========================================================================== */

/**
 * Ärendesammanfattningen och förhandsvisningen för kontaktförfrågningar.
 *
 * Två dokument med olika publik och OLIKA INNEHÅLLSREGLER:
 *
 *  - FÖRHANDSVISNINGEN ser rådgivaren FÖRE upplåsning. Den är avidentifierad:
 *    storleksband, problemtyp, komplexitet, brådska och dokumentlista -
 *    ALDRIG namn, organisationsnummer eller kontaktvägar. Regeln testas
 *    mekaniskt i tests/leadSummary.ts: förhandsvisningen serialiserad får
 *    inte innehålla identiteten.
 *
 *  - SAMMANFATTNINGEN låses upp mot villkor. Den innehåller identiteten,
 *    situationen, nyckeltalen, systemanalysens slutsats, dokumentlistan och
 *    skälet till kontakten - det rådgivaren behöver för att börja arbeta,
 *    utan ett enda extra formulär för företaget.
 *
 * Byggarna är rena funktioner ur samma data som resten av produkten:
 * ärendet och systemanalysen. Ingenting skrivs in en gång till.
 */

export interface LeadPreview {
  sizeBand: string | null;
  problemType: string;
  complexity: "låg" | "medel" | "hög";
  urgency: string;
  documentCount: number;
  documentKinds: string[];
}

export interface LeadKeyFigure {
  label: string;
  value: string;
}

export interface LeadSummary {
  companyName: string;
  orgNumber: string;
  contactEmail: string | null;
  situation: string;
  keyFigures: LeadKeyFigure[];
  analysisTitle: string;
  documents: string[];
  reason: string;
}

const PROBLEM_TYPE: Record<string, string> = {
  reconstruction: "Rekonstruktionsläge",
  bankruptcy: "Konkursnära läge",
  stabilize: "Stabilisering",
};

const URGENCY: Record<string, string> = {
  immediate: "Omedelbar",
  weeks: "Inom veckor",
  months: "Inom månader",
};

/** "3 200 000 kr" - manuell gruppering, inte sv-SE:s hårda mellanslag. */
const kr__leadSummary = (raw: string | null): string | null => {
  const n = Number(raw ?? "");
  if (!raw || !Number.isFinite(n) || n <= 0) return null;
  return `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`;
};

/**
 * Komplexiteten är en grov sortering för rådgivarens relevansbeslut, inte
 * en utfästelse: total skuld och antalet betalningsproblem räcker för att
 * skilja ett enmansbolag med en obetald faktura från en koncern i fritt
 * fall. Bedömningen förklaras alltid i den upplåsta sammanfattningen.
 */
const complexityOf = (caseRecord: CaseRecord): LeadPreview["complexity"] => {
  const debt = Number(caseRecord.totalDebt ?? "0") || 0;
  const problems = [
    caseRecord.canPaySalary === false,
    caseRecord.canPayTax === false,
    caseRecord.canPayRent === false,
    caseRecord.canPaySuppliers === false,
  ].filter(Boolean).length;
  if (debt >= 5_000_000 || problems >= 3) return "hög";
  if (debt >= 1_000_000 || problems >= 2) return "medel";
  return "låg";
};

export const buildLeadPreview = (
  caseRecord: CaseRecord,
  analysis: CrisisAnalysis,
  documentNames: string[],
): LeadPreview => ({
  sizeBand: caseRecord.employees ? `${caseRecord.employees} anställda` : null,
  problemType: PROBLEM_TYPE[analysis.type] ?? analysis.type,
  complexity: complexityOf(caseRecord),
  urgency: URGENCY[analysis.urgency] ?? analysis.urgency,
  documentCount: documentNames.length,
  // Filnamn kan innehålla bolagsnamnet; förhandsvisningen får bara typerna.
  documentKinds: [...new Set(documentNames.map(kindOfDocument))].sort(),
});

/** Grov dokumenttyp ur filnamnet - aldrig själva namnet. */
export const kindOfDocument = (fileName: string): string => {
  const lower = fileName.toLowerCase();
  if (lower.includes("kontrollbalans") || lower.includes("kbr")) return "Kontrollbalansräkning";
  if (lower.includes("protokoll")) return "Styrelseprotokoll";
  if (lower.includes("kallelse")) return "Kallelse";
  if (lower.endsWith(".se") || lower.endsWith(".si") || lower.includes("sie")) return "Bokföringsexport (SIE)";
  if (lower.includes("balans") || lower.includes("resultat")) return "Ekonomisk rapport";
  if (lower.includes("skatt")) return "Skatteunderlag";
  return "Övrigt underlag";
};

export const buildLeadSummary = (
  caseRecord: CaseRecord,
  analysis: CrisisAnalysis,
  documentNames: string[],
  contactEmail: string | null,
  reason: string,
): LeadSummary => {
  const figures: LeadKeyFigure[] = [];
  const debt = kr__leadSummary(caseRecord.totalDebt);
  if (debt) figures.push({ label: "Total skuld", value: debt });
  const liquidation = kr__leadSummary(caseRecord.quickLiquidationValue);
  if (liquidation) figures.push({ label: "Snabbt realiserbart värde", value: liquidation });
  const salary = kr__leadSummary(caseRecord.salaryAmount);
  if (salary) figures.push({ label: "Månadslöner", value: salary });
  const tax = kr__leadSummary(caseRecord.taxAmount);
  if (tax) figures.push({ label: "Skatt denna månad", value: tax });
  const rent = kr__leadSummary(caseRecord.rentAmount);
  if (rent) figures.push({ label: "Månadshyra", value: rent });

  return {
    companyName: caseRecord.companyName ?? "Ej angivet",
    orgNumber: caseRecord.orgNumber,
    contactEmail,
    situation: analysis.description,
    keyFigures: figures,
    analysisTitle: analysis.title,
    documents: documentNames,
    reason,
  };
};

/* ==========================================================================
   src/lib/legalPages.ts
   ========================================================================== */

/**
 * INTEGRITETSPOLICYN OCH VILLKOREN, SOM DATA.
 *
 * Texterna ligger här och inte i JSX av samma skäl som all annan
 * användartext i produkten: en mening som ska granskas av en jurist ska
 * gå att läsa utan att läsa runt taggar, och testerna ska kunna pröva vad
 * som faktiskt står.
 *
 * TVÅ SAKER SOM MÅSTE SÄGAS RAKT UT:
 *
 * 1. Det här är ett UTKAST skrivet av den som byggt systemet, inte av en
 *    jurist. Det beskriver sanningsenligt vad koden faktiskt gör - vilka
 *    uppgifter som samlas in, var de hamnar och hur länge de ligger kvar -
 *    men formuleringarna är inte granskade mot dataskyddsförordningen av
 *    någon med den kompetensen. Sidan säger det själv, överst, och det
 *    ska stå kvar tills granskningen är gjord.
 *
 * 2. Flera uppgifter är ännu inte bestämda: personuppgiftsbiträdesavtalet
 *    med driftleverantören, gallringsfristerna och kontaktvägen för
 *    registerutdrag. De står som ÖPPNA, inte som påhittade svar. En
 *    policy som anger "vi sparar uppgifterna i 24 månader" när ingen
 *    bestämt något är värre än en som säger att frågan är öppen: den
 *    första är ett löfte till användaren som ingen kan hålla.
 */

export interface LegalSection {
  title: string;
  /** Brödtext. Varje stycke en sträng. */
  body: string[];
  /** Punktlista under brödtexten. */
  points?: string[];
  /** Sant när avsnittet beskriver ett beslut som inte är fattat. */
  open?: boolean;
}

export const DRAFT_NOTICE__legalPages =
  "Det här är ett utkast, skrivet av oss som byggt tjänsten och ännu inte granskat av jurist. " +
  "Det beskriver vad systemet faktiskt gör. Punkter som ännu inte är beslutade är markerade som öppna " +
  "i stället för att fyllas med ett svar vi inte har.";

/* -------------------------------------------------------------------------- */
/* Integritetspolicy                                                          */
/* -------------------------------------------------------------------------- */

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: "Vem som ansvarar för uppgifterna",
    body: [
      "Landvex AB är personuppgiftsansvarig för de uppgifter du lämnar i Clearance. " +
        "Organisationsnummer och adress står i sidfoten på varje sida.",
      "Frågor om dina uppgifter lämnas via kontaktformuläret. Vi svarar till den adress du anger.",
    ],
  },
  {
    title: "Vad vi samlar in, och varför",
    body: [
      "Tjänsten är byggd för att strukturera ett bolags ekonomiska läge. Det innebär att " +
        "uppgifterna är känsliga i praktisk mening även när de inte är det i lagens mening: " +
        "att ett bolag utreder rekonstruktion är information som kan skada bolaget om den sprids.",
    ],
    points: [
      "Kontouppgifter: namn, e-postadress och lösenord. Lösenordet lagras aldrig i klartext.",
      "Bolagsuppgifter: företagsnamn och organisationsnummer, samt det som hämtas ur offentliga register på det numret.",
      "Det du berättar: svaren i introduktionssamtalet, nulägesanalysen, kontrollbalansräkningen och likviditetsplanen.",
      "Dokument du laddar upp, till exempel kontoutdrag och bokföringsfiler.",
      "Telefonnummer – endast om du själv väljer att aktivera SMS-aviseringar.",
      "Händelselogg: vem som gjorde vad i ärendet och när. Den är en del av produkten, inte spårning – ett krisärende ska gå att rekonstruera i efterhand.",
    ],
  },
  {
    title: "Rättslig grund",
    body: [
      "Behandlingen av kontot och ärendet vilar på avtalet med dig (art. 6.1 b). " +
        "Händelseloggen och säkerhetsloggarna vilar på vårt berättigade intresse av att kunna " +
        "visa vad som skett i ett ärende och att skydda tjänsten mot missbruk (art. 6.1 f).",
      "SMS-aviseringar bygger på ditt samtycke (art. 6.1 a) och går att återkalla när som helst " +
        "under Inställningar. Numret raderas då.",
    ],
  },
  {
    title: "Vad vi INTE gör",
    body: [
      "Analyserna räknas fram i vår egen miljö. Ingen ärendedata skickas till någon extern " +
        "modelltjänst för analys, och det är en teknisk egenskap hos systemet, inte en policy " +
        "vi kan ändra i tysthet – motorerna är deterministiska och prövas i din egen webbläsare " +
        "under Analysövervakning.",
      "Vi säljer inga uppgifter. Vi använder inga annonsnätverk och lägger inga spårningsskript " +
        "på sidorna; att inga anrop går till tredje part kontrolleras av en testsvit vid varje ändring.",
    ],
  },
  {
    title: "Vem mer som ser uppgifterna",
    body: [
      "Du bestämmer vilka som får åtkomst till ditt ärende. Bjuder du in en revisor, jurist, " +
        "rekonstruktör eller kollega ser de det du delar med dem, och varje åtkomst loggas.",
      "Vår drift kan se administrativa uppgifter – konto, fakturor och utskick – för att kunna " +
        "sköta tjänsten. Databasens åtkomstregler prövas vid varje ändring av en egen testsvit.",
    ],
  },
  {
    title: "Var uppgifterna finns",
    body: [
      "Driftmiljön är konfigurerad för en region inom EU (Stockholm). Ingen del av tjänsten är " +
        "avsedd att flytta uppgifter ut ur EU/EES.",
    ],
  },
  {
    title: "Personuppgiftsbiträden",
    body: [
      "Tjänsten drivs hos en molnleverantör och skickar e-post och SMS via leverantörer. " +
        "Vilka de är, och de biträdesavtal som krävs enligt art. 28, är inte klara ännu.",
      "Den fullständiga förteckningen publiceras här innan tjänsten öppnas för betalande kunder.",
    ],
    open: true,
  },
  {
    title: "Hur länge uppgifterna sparas",
    body: [
      "Vi raderar aldrig ditt material för att en faktura är obetald – ett stängt konto är " +
        "utestängt, inte tömt. Det är ett medvetet beslut: ett bolag mitt i en rekonstruktion " +
        "har ofta sin enda samlade dokumentation här.",
      "Fakturaunderlag måste sparas i sju år enligt bokföringslagen. Gallringsfristerna för " +
        "ärendematerial och konton är däremot inte fastställda ännu.",
    ],
    open: true,
  },
  {
    title: "Dina rättigheter",
    body: [
      "Du har rätt att få veta vilka uppgifter vi har om dig, att få dem rättade, att få dem " +
        "raderade när vi inte längre har grund att spara dem, att invända mot behandling som " +
        "vilar på berättigat intresse, och att få ut dina uppgifter i ett maskinläsbart format.",
      "Ärendets händelselogg går redan att exportera från Händelser i din inloggning.",
      "Är du inte nöjd med hur vi hanterar dina uppgifter kan du klaga hos Integritetsskyddsmyndigheten (IMY).",
    ],
  },
  {
    title: "Kakor och lokal lagring",
    body: [
      "Vi använder inga kakor för analys eller annonsering. Det som lagras i din webbläsare är " +
        "din inloggningssession och ditt påbörjade arbete: halvfärdiga guider och ett avbrutet " +
        "introduktionssamtal sparas lokalt så att en omladdning inte kastar bort det.",
      "Det lokala arbetsmaterialet raderas när du loggar ut. Dina läsinställningar, som språknivå, " +
        "ligger kvar – de säger något om hur du vill läsa, inte något om ditt bolag.",
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Användarvillkor                                                            */
/* -------------------------------------------------------------------------- */

export const TERMS_SECTIONS: LegalSection[] = [
  {
    title: "Vad Clearance är – och inte är",
    body: [
      "Clearance är ett administrativt hjälpmedel. Tjänsten hjälper dig att strukturera " +
        "bolagets läge, räkna på det, bevaka frister och samla dokumentationen.",
      "Tjänsten lämnar INTE juridisk, ekonomisk eller skatterättslig rådgivning. Bedömningarna " +
        "bygger på de uppgifter du själv anger och är ett underlag för beslut, inte ett beslut. " +
        "Du ansvarar för de beslut du fattar, och för att stämma av din situation med behörig " +
        "rådgivare innan du fattar dem.",
      "Att en beräkning i tjänsten pekar åt ett håll ersätter inte styrelsens eget ansvar enligt " +
        "aktiebolagslagen.",
    ],
  },
  {
    title: "Ditt konto",
    body: [
      "Kontot är personligt. Du ansvarar för ditt lösenord och för vilka du bjuder in till ditt ärende.",
      "Du ansvarar för att de uppgifter du lämnar är riktiga. En analys som vilar på fel siffror " +
        "blir fel, och det är inte något tjänsten kan upptäcka åt dig.",
    ],
  },
  {
    title: "Priser och betalning",
    body: [
      "Aktuella priser visas i tjänsten. Alla belopp anges exklusive moms om inget annat framgår.",
      "Fakturan har tio dagars betalningsvillkor. Dröjsmålsränta enligt räntelagen (1975:635) 6 § " +
        "utgår efter förfallodagen.",
      "Betalas fakturan inte pausas åtkomsten till innehållet. Vi raderar ingenting – materialet " +
        "blir tillgängligt igen så snart betalningen registrerats.",
    ],
  },
  {
    title: "Uppsägning",
    body: [
      "Det finns ingen bindningstid. Du kan säga upp abonnemanget när som helst och behåller " +
        "åtkomsten under den period du betalat för.",
      "Innan du avslutar bör du exportera det du vill behålla. Rapporterna går att spara som PDF " +
        "och händelseloggen går att exportera.",
    ],
  },
  {
    title: "Tillgänglighet",
    body: [
      "Vi strävar efter att tjänsten ska vara tillgänglig, men lämnar ingen garanti om drifttid. " +
        "Planerade avbrott aviseras i förväg när det är möjligt.",
      "Tjänsten befinner sig i en tidig fas. Funktioner kan ändras, och sådant som ännu inte är " +
        "kopplat till en riktig källa är märkt som det i gränssnittet i stället för att visas som klart.",
    ],
  },
  {
    title: "Ansvarsbegränsning",
    body: [
      "Vårt ansvar är begränsat till vad som följer av tvingande lag. Vi ansvarar inte för " +
        "indirekt skada, utebliven vinst eller följder av beslut du fattat med tjänsten som underlag.",
      "Den här punkten är särskilt beroende av juridisk granskning innan tjänsten öppnas för " +
        "betalande kunder.",
    ],
    open: true,
  },
  {
    title: "Tillämplig lag",
    body: [
      "Svensk lag tillämpas. Tvist prövas av svensk allmän domstol.",
    ],
  },
];

/* ==========================================================================
   src/lib/liquidityKeyFigures.ts
   ========================================================================== */

/**
 * NYCKELTALEN, MED SITT UNDERLAG.
 *
 * "Runway: 8 dagar" är ett av de mest ingripande påståenden produkten gör.
 * Någon kan fatta beslut om personal, om att ansöka om rekonstruktion,
 * eller om att lägga ner - på den siffran. Då räcker det inte att visa
 * den. Den ska gå att öppna, och den som öppnar ska se posterna, formeln,
 * och framför allt VAD SIFFRAN INTE SÄGER.
 *
 * Den sista delen är den viktigaste här, och skälet är konkret: kurvan
 * räknar bara pengar UT. Obetalda kundfakturor beräknas på sidan men når
 * aldrig grafen. "Runway 8 dagar" förutsätter alltså noll intäkter under
 * hela horisonten - ett medvetet försiktigt antagande, men ett antagande.
 * Den som inte får veta det läser siffran som en prognos i stället för
 * som ett golv.
 *
 * Regeln, som gäller varje nyckeltal produkten visar: ett tal utan
 * underlag är ett påstående, och ett påstående som inte går att granska
 * är sämre än inget tal alls.
 */

export type FigureId = "kassa" | "vantande" | "prognos" | "runway";

export interface FigureRow {
  label: string;
  value: string;
  /** Kort förtydligande när raden behöver ett. */
  note?: string;
}

export interface KeyFigure {
  id: FigureId;
  label: string;
  /** Talet som står på rutan, formaterat. */
  value: string;
  /** Hur talet räknas fram, i en mening. */
  formula: string;
  /** Posterna som ingår. Tom lista när talet är inmatat och inte räknat. */
  rows: FigureRow[];
  /** Vad talet betyder för ett beslut. */
  meaning: string;
  /** Vad talet INTE säger. Aldrig tom - varje siffra har en gräns. */
  limits: string[];
}

export const kr__liquidityKeyFigures = (value: number): string => `${Math.round(value).toLocaleString("sv-SE")} kr`;

const CATEGORY_LABEL: Record<string, string> = {
  salary: "Löner",
  tax: "Skatt och avgifter",
  rent: "Hyra",
  supplier: "Leverantörer",
  loan: "Lån och räntor",
  other: "Övrigt",
};

export interface KeyFigureInput {
  startingBalance: number;
  /** Alla registrerade betalningar i planen. */
  payments: PaymentRecord[];
  horizonDays: number;
  /** Saldot vid horisontens slut i det valda scenariot. */
  finalBalance: number;
  /** Dag då saldot först går under noll, eller null. */
  daysToNegative: number | null;
  /** Scenariots namn, så att detaljen inte förklarar fel kurva. */
  scenarioLabel: string;
  /** Obetalda kundfakturor. Räknas INTE in - och det ska stå. */
  incomingUnpaidTotal: number;
  incomingUnpaidCount: number;
}

/** Betalningarna som faktiskt drar ner kurvan. */
const draining = (payments: PaymentRecord[]): PaymentRecord[] =>
  payments.filter((p) => p.status === "pending" || p.status === "critical");

/** Summa per kategori, störst först. En lista på trettio rader läses inte. */
const byCategory = (payments: PaymentRecord[]): FigureRow[] => {
  const sums = new Map<string, { total: number; count: number }>();
  for (const p of payments) {
    const key = p.category ?? "other";
    const current = sums.get(key) ?? { total: 0, count: 0 };
    sums.set(key, { total: current.total + p.amount, count: current.count + 1 });
  }
  return [...sums.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([key, { total, count }]) => ({
      label: CATEGORY_LABEL[key] ?? key,
      value: kr__liquidityKeyFigures(total),
      note: count === 1 ? "1 post" : `${count} poster`,
    }));
};

export const buildKeyFigures = (input: KeyFigureInput): KeyFigure[] => {
  const pending = draining(input.payments);
  const postponed = input.payments.filter((p) => p.status === "postponed");
  const paid = input.payments.filter((p) => p.status === "paid");
  const total = pending.reduce((sum, p) => sum + p.amount, 0);

  /**
   * Gäller alla fyra: kurvan har inga inbetalningar. Formuleringen är
   * densamma överallt med flit - ett förbehåll som skrivs om för varje
   * ruta läses som fyra olika förbehåll.
   */
  const noIncome =
    input.incomingUnpaidCount > 0
      ? `Inga inbetalningar räknas med. Du har ${input.incomingUnpaidCount} obetalda kundfakturor på ${kr__liquidityKeyFigures(input.incomingUnpaidTotal)} som inte ingår i kurvan.`
      : "Inga inbetalningar räknas med. Kurvan visar bara vad som går ut.";

  return [
    {
      id: "kassa",
      label: "Aktuell kassa",
      value: kr__liquidityKeyFigures(input.startingBalance),
      formula: "Det belopp du själv har skrivit in. Systemet hämtar det inte från banken.",
      rows: [{ label: "Ingående saldo", value: kr__liquidityKeyFigures(input.startingBalance), note: "inmatat" }],
      meaning: "Startpunkten för hela kurvan. Är den fel är allt nedanför fel.",
      limits: [
        "Uppgiften är inte avstämd mot något konto - den är lika aktuell som senast du ändrade den.",
        "Beviljad men outnyttjad checkkredit ingår inte om du inte räknat in den själv.",
      ],
    },
    {
      id: "vantande",
      label: "Väntande betalningar",
      value: kr__liquidityKeyFigures(total),
      formula:
        "Summan av alla registrerade betalningar med status Väntande eller Kritisk. Betalda och uppskjutna räknas inte.",
      rows: [
        ...byCategory(pending),
        ...(postponed.length > 0
          ? [{
              label: "Uppskjutna",
              value: kr__liquidityKeyFigures(postponed.reduce((s, p) => s + p.amount, 0)),
              note: `${postponed.length} poster, ingår INTE i summan`,
            }]
          : []),
        ...(paid.length > 0
          ? [{
              label: "Redan betalda",
              value: kr__liquidityKeyFigures(paid.reduce((s, p) => s + p.amount, 0)),
              note: `${paid.length} poster, ingår INTE i summan`,
            }]
          : []),
      ],
      meaning:
        "Det som ska ut ur kassan om ingenting förhandlas om. En uppskjuten betalning flyttar beloppet, den tar inte bort det.",
      limits: [
        "Bara det som är registrerat här. Det som inte lagts in syns inte i någon siffra på sidan.",
        "Dröjsmålsräntor och påminnelseavgifter ingår inte.",
      ],
    },
    {
      id: "prognos",
      label: `Prognos ${input.horizonDays} dagar`,
      value: kr__liquidityKeyFigures(input.finalBalance),
      formula: `Aktuell kassa minus de betalningar som förfaller inom ${input.horizonDays} dagar, dag för dag, i scenariot "${input.scenarioLabel}".`,
      rows: [
        { label: "Aktuell kassa", value: kr__liquidityKeyFigures(input.startingBalance) },
        { label: "Betalningar inom horisonten", value: `−${kr__liquidityKeyFigures(total)}` },
        { label: `Saldo dag ${input.horizonDays}`, value: kr__liquidityKeyFigures(input.finalBalance) },
      ],
      meaning:
        input.finalBalance < 0
          ? "Ett negativt tal betyder att pengarna tar slut före horisonten - inte att bolaget är insolvent. Skillnaden avgörs av vad som går att förhandla om."
          : "Kassan räcker horisonten ut om ingenting oväntat inträffar och inget nytt tillkommer.",
      limits: [
        noIncome,
        `Horisonten är ${input.horizonDays} dagar. Vad som händer dag ${input.horizonDays + 1} syns inte här.`,
        "Scenariot styr vilka poster som räknas. Byter du scenario ändras talet.",
      ],
    },
    {
      id: "runway",
      label: "Runway",
      value:
        input.daysToNegative === null
          ? `${input.horizonDays}+ dagar`
          : `${input.daysToNegative} dagar`,
      formula:
        "Antal dagar tills saldot första gången går under noll, räknat från i dag med de registrerade betalningarna.",
      rows: [
        { label: "Startsaldo", value: kr__liquidityKeyFigures(input.startingBalance) },
        { label: "Ska betalas inom horisonten", value: kr__liquidityKeyFigures(total) },
        {
          label: "Går under noll",
          value:
            input.daysToNegative === null
              ? `Inte inom ${input.horizonDays} dagar`
              : `Dag ${input.daysToNegative}`,
        },
      ],
      meaning:
        input.daysToNegative === null
          ? "Kassan håller horisonten ut med det som är inlagt. Det är ett golv, inte ett löfte."
          : "Dagen då kassan tar slut med nuvarande plan. Det är den dagen besluten ska vara fattade före, inte den dag de ska fattas.",
      limits: [
        noIncome,
        "Talet är ett GOLV, inte en prognos: med inbetalningar räcker kassan längre, med oväntade utgifter kortare.",
        "En uppskjuten betalning flyttar dagen framåt utan att skulden minskar.",
      ],
    },
  ];
};

export const figureById = (figures: KeyFigure[], id: FigureId): KeyFigure | null =>
  figures.find((f) => f.id === id) ?? null;

/* ==========================================================================
   src/lib/liquidityPlan.ts
   ========================================================================== */

/**
 * Re-exported so existing callers keep working; the value and the reasoning
 * behind it live in officialFigures.ts with everything else that changes
 * with the calendar.
 */

export interface PlanOutflow {
  id: string;
  label: string;
  amount: number;
  category: PaymentCategory;
  /** Day of month (1-31) when recurring, otherwise ignored. */
  dayOfMonth: number;
  /** ISO date (yyyy-MM-dd) when non-recurring. */
  date: string;
  recurring: boolean;
}

export interface PlanInflow {
  id: string;
  label: string;
  amount: number;
  counterpart: string;
  dayOfMonth: number;
  date: string;
  recurring: boolean;
}

export interface LiquidityPlan {
  openingBalance: number;
  inflows: PlanInflow[];
  outflows: PlanOutflow[];
}

export interface ProjectionDay {
  /** ISO date, yyyy-MM-dd */
  iso: string;
  /** Short human label, e.g. "3 mar" */
  label: string;
  balance: number;
  inflow: number;
  outflow: number;
  events: { label: string; amount: number; direction: "in" | "out" }[];
}

export interface ProjectionResult {
  days: ProjectionDay[];
  /** Days from today until the balance first goes negative, or null. */
  daysUntilNegative: number | null;
  /** ISO date the balance first goes negative, or null. */
  dateOfShortfall: string | null;
  lowestBalance: number;
  closingBalance: number;
  totalInflow: number;
  totalOutflow: number;
}

/**
 * Expands a monthly-recurring item into every date it falls on inside the
 * horizon. A day-of-month past the end of a short month clamps to that
 * month's last day, so "the 31st" still lands once in February.
 */
const recurringDatesInHorizon = (dayOfMonth: number, start: Date, horizonDays: number): string[] => {
  const dates: string[] = [];
  const end = addDays(start, horizonDays);
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);

  while (cursor <= end) {
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const day = Math.min(dayOfMonth, daysInMonth);
    const occurrence = new Date(cursor.getFullYear(), cursor.getMonth(), day);
    if (occurrence >= start && occurrence <= end) {
      dates.push(format(occurrence, "yyyy-MM-dd"));
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return dates;
};

export const projectLiquidity = (plan: LiquidityPlan, horizonDays = 90): ProjectionResult => {
  const today = startOfDay(new Date());

  // Bucket every inflow/outflow occurrence onto its date first, so the
  // day-by-day walk below is a simple accumulation.
  const byDate = new Map<string, ProjectionDay["events"]>();
  const push = (iso: string, event: ProjectionDay["events"][number]) => {
    const existing = byDate.get(iso);
    if (existing) existing.push(event);
    else byDate.set(iso, [event]);
  };

  for (const item of plan.outflows) {
    if (item.amount <= 0) continue;
    const dates = item.recurring
      ? recurringDatesInHorizon(item.dayOfMonth, today, horizonDays)
      : [item.date];
    for (const iso of dates) {
      if (!iso) continue;
      push(iso, { label: item.label, amount: item.amount, direction: "out" });
    }
  }

  for (const item of plan.inflows) {
    if (item.amount <= 0) continue;
    const dates = item.recurring
      ? recurringDatesInHorizon(item.dayOfMonth, today, horizonDays)
      : [item.date];
    for (const iso of dates) {
      if (!iso) continue;
      push(iso, { label: item.label, amount: item.amount, direction: "in" });
    }
  }

  const days: ProjectionDay[] = [];
  let balance = plan.openingBalance;
  let lowestBalance = plan.openingBalance;
  let totalInflow = 0;
  let totalOutflow = 0;
  let daysUntilNegative: number | null = null;
  let dateOfShortfall: string | null = null;

  for (let i = 0; i <= horizonDays; i++) {
    const date = addDays(today, i);
    const iso = format(date, "yyyy-MM-dd");
    const events = byDate.get(iso) ?? [];

    let inflow = 0;
    let outflow = 0;
    for (const event of events) {
      if (event.direction === "in") inflow += event.amount;
      else outflow += event.amount;
    }

    balance += inflow - outflow;
    totalInflow += inflow;
    totalOutflow += outflow;
    if (balance < lowestBalance) lowestBalance = balance;
    if (balance < 0 && daysUntilNegative === null) {
      daysUntilNegative = i;
      dateOfShortfall = iso;
    }

    days.push({
      iso,
      label: format(date, "d MMM"),
      balance: Math.round(balance),
      inflow,
      outflow,
      events,
    });
  }

  return {
    days,
    daysUntilNegative,
    dateOfShortfall,
    lowestBalance: Math.round(lowestBalance),
    closingBalance: Math.round(balance),
    totalInflow,
    totalOutflow,
  };
};

export const employerContribution = (grossSalary: number): number =>
  Math.round(grossSalary * EMPLOYER_CONTRIBUTION_RATE);

export const emptyPlan = (): LiquidityPlan => ({
  openingBalance: 0,
  inflows: [],
  outflows: [],
});

/* ==========================================================================
   src/lib/localTraces.ts
   ========================================================================== */

/**
 * SPÅREN I WEBBLÄSAREN, OCH NÄR DE STÄDAS.
 *
 * Flera flöden sparar arbete lokalt: guidernas autospar, det avbrutna
 * introduktionssamtalet, valet av aktivt ärende, byråns timpris. Det är
 * medvetet - guiderna ska fungera utan konto, och ofärdiga uppgifter ska
 * inte lämna datorn förrän användaren själv väljer att spara.
 *
 * Men det som ligger kvar efter en utloggning är inte längre ett stöd,
 * det är ett läckage. Ett halvfärdigt introduktionssamtal innehåller ett
 * personnamn, ett organisationsnummer och femton svar om ett bolags
 * ekonomiska problem. Nästa person som loggar in på samma dator - en
 * kollega, en familjemedlem, nästa användare av en delad enhet - ska
 * inte kunna läsa det.
 *
 * Därför två listor, och skillnaden mellan dem är hela poängen:
 *
 *  - ARBETE OCH ÄRENDE städas vid utloggning. Uppgifter om ett bolag
 *    eller en person hör till den som loggade in.
 *  - LÄSINSTÄLLNINGAR står kvar. Språknivå, presentationsläge och
 *    avbockade mikrolektioner säger något om hur en människa vill läsa,
 *    inte något om ett bolag - och att nollställa dem vid varje
 *    utloggning hade varit att straffa den som delar dator.
 *
 * Listan är avsiktligt uttömmande och avsiktligt handskriven. Att städa
 * allt som börjar med "clearance-" hade tagit demoläget med sig, och att
 * städa efter gissning hade lämnat kvar det som glömdes bort. En ny
 * nyckel som bär uppgifter om ett bolag ska läggas till HÄR, och testet
 * i tests/avbrott.ts vaktar att listan inte krymper.
 */

/** Nycklar som bär arbete eller uppgifter om ett bolag. Städas vid utloggning. */
export const WORK_KEYS = [
  // Introduktionssamtalet: namn, organisationsnummer, intervjusvar.
  "clearance-onboarding-pagaende",
  "clearance-onboarding",
  // Guidernas autospar: ekonomi, skulder, förfallodagar.
  "clearance-wizard-draft",
  "clearance-kbr-draft",
  "clearance-liquidity-draft",
  // Vilket ärende som var öppet, och vad som lästs i det.
  "clearance-active-case",
  "clearance-notifications-read",
  // Akter, samlingsexporter och kreditunderlag.
  "clearance-akt",
  "clearance-akt-samling",
  "clearance-kreditunderlag",
  // Byråns eget timpris och momssats.
  "clearance-time-rate",
  "clearance-time-vat",
] as const;

/**
 * Nycklar som ÖVERLEVER en utloggning, med skälet utskrivet.
 *
 * Finns här för att vara läsbar bredvid listan ovan: den som lägger till
 * en nyckel ska behöva placera den i en av dem, inte i tystnad.
 */
export const PREFERENCE_KEYS = [
  "clearance-language-level",
  "clearance-language-change",
  "clearance-language-suggestion-dismissed",
  "clearance-glossary-clicks",
  "clearance-presentation-mode",
  "clearance-presentation-scope",
  "clearance-mikrolektioner",
  "clearance-notification-prefs",
  // Att engångserbjudandet redan visats. BEVARAS med flit över utloggning:
  // en "sista chans" som återkommer varje gång vore just den falska
  // brådska erbjudandet är byggt för att undvika.
  "clearance-pro-offer-seen",
] as const;

/**
 * Städa arbetsspåren.
 *
 * Anropas EFTER att utloggningen gått igenom, aldrig före: sessionstoken
 * behövs för att logga ut, och en halvt städad webbläsare med en levande
 * session vore sämre än ingen städning alls.
 */
export const clearWorkTraces = (): void => {
  for (const key of WORK_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Privat läge eller blockerad lagring. Fanns inget att städa
      // fanns heller inget att läcka.
    }
  }
};

/* ==========================================================================
   src/lib/montecarlo/slump.ts
   ========================================================================== */

/**
 * SLUMPEN, OCH VARFÖR DEN INTE ÄR Math.random().
 *
 * En simulering som inte går att köra om är inte ett underlag. Den som
 * visar en fördelning för en bank, en rekonstruktör eller en styrelse
 * måste kunna svara på frågan "hur fick du fram den?" - och svaret ska
 * vara ett frö, inte "det gick inte att återskapa".
 *
 * `Math.random()` har inget frö. Den går inte att styra, inte att spara
 * och inte att köra om. Därför en egen generator.
 *
 * VALET: PCG32 (O'Neill 2014). Skälen, i tur och ordning:
 *
 *  - Den har ett FRÖ som helt bestämmer sekvensen.
 *  - Den klarar statistiska testsviter som en linjär kongruens faller på.
 *    En dålig generator ger korrelationer mellan på varandra följande tal,
 *    och i en Monte Carlo-simulering blir de korrelationerna till ett
 *    utfall som ser säkrare ut än det är. Det är det farligaste felet den
 *    här filen kan göra: en för smal fördelning läses som låg risk.
 *  - Perioden är 2^64. Vid en miljon iterationer och tio variabler är det
 *    tio miljoner dragningar - perioden ska vara ofattbart mycket större,
 *    annars börjar simuleringen upprepa sig själv.
 *  - Tillståndet är 64 bitar och går att spara som två 32-bitarsord, vilket
 *    är precis vad JavaScript kan räkna på exakt.
 *
 * IMPLEMENTATIONEN räknar 64-bitars aritmetik i 32-bitarshalvor, för
 * JavaScripts `number` är en double: heltal över 2^53 är inte längre
 * exakta, och en generator som tappar bitar tappar sin period. `BigInt`
 * hade varit enklare att läsa men är storleksordningar långsammare, och
 * den här koden körs tio miljoner gånger.
 */

/** 64-bitarsmultiplikatorn ur PCG-referensen, som två 32-bitarshalvor. */
const MULT_HI = 0x5851f42d;
const MULT_LO = 0x4c957f2d;
/** Ökningen (måste vara udda). Referensvärdet. */
const INC_HI = 0x14057b7e;
const INC_LO = 0xf767814f;

/**
 * En slumpström med sparbart tillstånd.
 *
 * Två strömmar med samma frö ger IDENTISKA sekvenser. Det är hela poängen
 * och prövas i tests/montecarlo.ts.
 */
export class Slumpstrom {
  /** Tillståndets höga 32 bitar. */
  private hi: number;
  /** Tillståndets låga 32 bitar. */
  private lo: number;
  /** Sparad andra normalvariabel ur Box-Muller. Se normal(). */
  private sparadNormal: number | null = null;

  constructor(readonly fro: number) {
    // Fröet blandas innan det används. Ett frö på 1 och ett på 2 ska ge
    // sekvenser som inte liknar varandra; utan blandningen börjar de nära.
    let h = Math.imul(fro ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
    let l = Math.imul(fro + 0x165667b1, 0xc2b2ae35) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    l = (l ^ (l >>> 16)) >>> 0;
    this.hi = h;
    this.lo = l;
    // Två varv för att komma bort från startvärdet.
    this.nastaUint32();
    this.nastaUint32();
  }

  /**
   * Nästa 32-bitars heltal, 0 .. 2^32-1.
   *
   * LCG-steget i 64 bitar, följt av PCG:s utgångsfunktion (XSH RR). Det är
   * utgångsfunktionen som gör skillnaden mot en vanlig LCG: den kastar bort
   * de svagaste bitarna och roterar resten med ett varv som självt beror på
   * tillståndet.
   */
  nastaUint32(): number {
    const hi = this.hi;
    const lo = this.lo;

    // 64-bitars multiplikation i 16-bitarsbitar, så att inget mellanled
    // överskrider 2^53 och tappar precision.
    const lo0 = lo & 0xffff;
    const lo1 = lo >>> 16;
    const m0 = MULT_LO & 0xffff;
    const m1 = MULT_LO >>> 16;

    const p00 = lo0 * m0;
    const p01 = lo0 * m1;
    const p10 = lo1 * m0;
    const p11 = lo1 * m1;

    const mellan = (p00 >>> 16) + (p01 & 0xffff) + (p10 & 0xffff);
    const nyLoUtanInc = (((mellan & 0xffff) << 16) | (p00 & 0xffff)) >>> 0;
    const bar = (mellan >>> 16) + (p01 >>> 16) + (p10 >>> 16) + p11;
    // De höga 32 bitarna: bäringen plus korstermerna.
    const nyHiUtanInc =
      (bar + Math.imul(lo, MULT_HI) + Math.imul(hi, MULT_LO)) >>> 0;

    // Addera ökningen, med bäring från låg till hög.
    const summaLo = (nyLoUtanInc + INC_LO) >>> 0;
    const bering = summaLo < nyLoUtanInc >>> 0 ? 1 : 0;
    this.lo = summaLo;
    this.hi = (nyHiUtanInc + INC_HI + bering) >>> 0;

    // XSH RR: xorshift ned, sedan rotation styrd av de fem översta bitarna.
    const xorshifted = (((hi >>> 13) ^ ((lo >>> 27) | (hi << 5))) >>> 0) >>> 0;
    const rot = hi >>> 27;
    return rot === 0
      ? xorshifted
      : (((xorshifted >>> rot) | (xorshifted << (32 - rot))) >>> 0);
  }

  /**
   * Likformig i [0, 1).
   *
   * 53 bitar ur två dragningar, alltså hela mantissan i en double. Att
   * bara dela ett 32-bitarstal med 2^32 hade gett drygt fyra miljarder
   * möjliga värden - vid en miljon iterationer syns det som synliga steg i
   * en tät fördelningskurva.
   */
  nasta(): number {
    const hog = this.nastaUint32() >>> 5; // 27 bitar
    const lag = this.nastaUint32() >>> 6; // 26 bitar
    return (hog * 67108864 + lag) / 9007199254740992;
  }

  /**
   * Likformig i (0, 1).
   *
   * Flera fördelningar (lognormal, exponential) tar logaritmen av talet,
   * och log(0) är -oändligt. Noll skulle alltså tyst förvandla ett utfall
   * till -Infinity, som sedan förorenar varje summa det ingår i. Därför
   * dras om i stället för att klippas: en klippning hade snedvridit
   * fördelningens svans, en omdragning gör det inte.
   */
  nastaOppen(): number {
    for (let i = 0; i < 10; i++) {
      const u = this.nasta();
      if (u > 0 && u < 1) return u;
    }
    // Praktiskt taget oåtkomligt (sannolikheten är ~2^-530), men en
    // returnerad nolla här hade blivit en tyst -Infinity längre ned.
    return 0.5;
  }

  /**
   * Standardnormalfördelad, N(0,1). Box-Muller i polär form (Marsaglia).
   *
   * Polärformen slipper sin och cos, som är dyra och dessutom en av de
   * platser där olika JavaScript-motorer ger olika sista bit - och då är
   * simuleringen inte längre reproducerbar mellan webbläsare och server.
   *
   * Metoden ger TVÅ oberoende värden per varv. Det andra sparas; att kasta
   * det hade fördubblat arbetet för varje normalfördelad variabel.
   */
  normal(): number {
    if (this.sparadNormal !== null) {
      const v = this.sparadNormal;
      this.sparadNormal = null;
      return v;
    }
    let u: number;
    let v: number;
    let s: number;
    do {
      u = this.nasta() * 2 - 1;
      v = this.nasta() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const faktor = Math.sqrt((-2 * Math.log(s)) / s);
    this.sparadNormal = v * faktor;
    return u * faktor;
  }

  /**
   * Gammafördelad med formparameter k >= 0, skala 1.
   *
   * Marsaglia-Tsang. Behövs av beta (som är en kvot av två gamma) och
   * ligger här för att den kräver både normal- och likformiga dragningar
   * ur SAMMA ström - annars bryts reproducerbarheten.
   */
  gamma(k: number): number {
    if (k < 1) {
      // Boost-tricket: gamma(k) = gamma(k+1) * U^(1/k).
      const u = this.nastaOppen();
      return this.gamma(k + 1) * Math.pow(u, 1 / k);
    }
    const d = k - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x: number;
      let v: number;
      do {
        x = this.normal();
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const u = this.nastaOppen();
      if (u < 1 - 0.0331 * x * x * x * x) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }
}

/**
 * Fröet som en användare kan ange, eller ett som väljs åt hen.
 *
 * Ett frö MÅSTE alltid finnas och alltid sparas - annars går körningen
 * inte att upprepa, och då är den inte ett underlag. Väljs det åt
 * användaren väljs det EN gång och skrivs ned; det får aldrig läsas ur
 * klockan vid själva körningen.
 */
export const nyttFro = (slump: () => number = Math.random): number =>
  Math.floor(slump() * 0x7fffffff) >>> 0;

/* ==========================================================================
   src/lib/montecarlo/fordelningar.ts
   ========================================================================== */

/**
 * FÖRDELNINGARNA: osäkerheten uttryckt som något man kan räkna på.
 *
 * En Monte Carlo-simulering är inte bättre än sina antaganden. Den här
 * filen är där antagandena bor, och därför gäller tre regler i den:
 *
 *  1. EN OGILTIG FÖRDELNING SKA ALDRIG GÅ ATT SAMPLA. `validera()` körs
 *     innan en enda dragning sker, och den beskriver felet på svenska för
 *     den som ska rätta det. En triangulär fördelning med topp utanför
 *     [min, max] är inte "nästan rätt" - den saknar mening, och en motor
 *     som ändå ger tal producerar ett underlag som ser giltigt ut.
 *
 *  2. VARJE FÖRDELNING BÄR SINA TEORETISKA MOMENT. `moment()` säger vad
 *     väntevärdet och variansen SKA bli. Det är inte dekoration: sviten
 *     drar hundratusen sampel och jämför mot dem, och det är enda sättet
 *     att veta att en samplare faktiskt implementerar den fördelning den
 *     påstår sig vara. En felvänd parameter ger annars en helt rimlig
 *     kurva av fel sort.
 *
 *  3. SAMPLINGEN TAR EN STRÖM, ALDRIG Math.random(). Reproducerbarheten
 *     är hela produktens löfte om att ett resultat går att granska.
 *
 * PARAMETRARNAS NAMN är de gängse i statistiken (mu, sigma, lambda) och
 * inte översatta: den som läser en lärobok eller kontrollerar mot en
 * annan implementation ska känna igen sig.
 */

/* -------------------------------------------------------------------------- */
/* Formen                                                                     */
/* -------------------------------------------------------------------------- */

export type FordelningsTyp =
  | "normal"
  | "lognormal"
  | "uniform"
  | "triangular"
  | "beta"
  | "exponential"
  | "poisson"
  | "bernoulli"
  | "binomial"
  | "discrete"
  | "custom";

/**
 * En fördelning som den lagras och skickas över nätet.
 *
 * Parametrarna ligger i en namngiven karta i stället för som positionella
 * fält: det gör en sparad simulering läsbar utan att man känner ordningen,
 * och en ny fördelning kräver ingen schemaändring.
 */
export interface Fordelning {
  typ: FordelningsTyp;
  parametrar: Record<string, number>;
  /**
   * För `discrete`: värdena och deras vikter. För `custom`: stödpunkter i
   * en empirisk fördelning, som samplas med linjär interpolation.
   */
  punkter?: { varde: number; vikt: number }[];
}

export interface Moment {
  /** Väntevärdet. null när fördelningen saknar ett ändligt sådant. */
  vantevarde: number | null;
  /** Variansen. null när den inte är ändlig. */
  varians: number | null;
}

export interface FordelningsFel {
  parameter: string;
  meddelande: string;
}

/* -------------------------------------------------------------------------- */
/* Registret                                                                  */
/* -------------------------------------------------------------------------- */

interface Definition {
  typ: FordelningsTyp;
  /** Namnet som visas i gränssnittet. */
  namn: string;
  /** En rad som förklarar NÄR fördelningen är rätt val. */
  narAnvands: string;
  /** Parametrarna i den ordning de ska visas. */
  parametrar: { nyckel: string; etikett: string; beskrivning: string }[];
  /** Sant för fördelningar som bara ger heltal. */
  diskret: boolean;
  validera: (f: Fordelning) => FordelningsFel[];
  sampla: (f: Fordelning, s: Slumpstrom) => number;
  moment: (f: Fordelning) => Moment;
}

const tal = (f: Fordelning, nyckel: string): number => f.parametrar[nyckel];

/** Ett ändligt tal, inte NaN och inte oändligt. */
const arTal = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const kravTal = (f: Fordelning, nyckel: string, etikett: string): FordelningsFel[] =>
  arTal(f.parametrar[nyckel])
    ? []
    : [{ parameter: nyckel, meddelande: `${etikett} saknas eller är inte ett ändligt tal.` }];

const REGISTER: Definition[] = [
  {
    typ: "normal",
    namn: "Normal",
    narAnvands:
      "Symmetrisk osäkerhet kring ett väntevärde. Passar när avvikelser åt båda håll är lika troliga.",
    parametrar: [
      { nyckel: "mu", etikett: "Väntevärde (μ)", beskrivning: "Fördelningens mitt." },
      { nyckel: "sigma", etikett: "Standardavvikelse (σ)", beskrivning: "Spridningen. Måste vara > 0." },
    ],
    diskret: false,
    validera: (f) => {
      const fel = [...kravTal(f, "mu", "Väntevärdet"), ...kravTal(f, "sigma", "Standardavvikelsen")];
      if (fel.length === 0 && tal(f, "sigma") <= 0) {
        fel.push({
          parameter: "sigma",
          meddelande:
            "Standardavvikelsen måste vara större än noll. Ett värde utan spridning är en konstant, inte en fördelning.",
        });
      }
      return fel;
    },
    sampla: (f, s) => tal(f, "mu") + tal(f, "sigma") * s.normal(),
    moment: (f) => ({ vantevarde: tal(f, "mu"), varians: tal(f, "sigma") ** 2 }),
  },

  {
    typ: "lognormal",
    namn: "Lognormal",
    narAnvands:
      "Storheter som inte kan bli negativa och har en lång svans uppåt - intäkter, priser, tider.",
    parametrar: [
      { nyckel: "mu", etikett: "μ (av logaritmen)", beskrivning: "Väntevärdet för ln(X)." },
      { nyckel: "sigma", etikett: "σ (av logaritmen)", beskrivning: "Standardavvikelsen för ln(X). > 0." },
    ],
    diskret: false,
    validera: (f) => {
      const fel = [...kravTal(f, "mu", "μ"), ...kravTal(f, "sigma", "σ")];
      if (fel.length === 0 && tal(f, "sigma") <= 0) {
        fel.push({ parameter: "sigma", meddelande: "σ måste vara större än noll." });
      }
      return fel;
    },
    sampla: (f, s) => Math.exp(tal(f, "mu") + tal(f, "sigma") * s.normal()),
    moment: (f) => {
      const mu = tal(f, "mu");
      const s2 = tal(f, "sigma") ** 2;
      const m = Math.exp(mu + s2 / 2);
      return { vantevarde: m, varians: (Math.exp(s2) - 1) * Math.exp(2 * mu + s2) };
    },
  },

  {
    typ: "uniform",
    namn: "Likformig",
    narAnvands:
      "Allt inom ett intervall är lika troligt. Ärligast när man bara känner ytterligheterna.",
    parametrar: [
      { nyckel: "min", etikett: "Minimum", beskrivning: "Nedre gräns." },
      { nyckel: "max", etikett: "Maximum", beskrivning: "Övre gräns. Måste vara > minimum." },
    ],
    diskret: false,
    validera: (f) => {
      const fel = [...kravTal(f, "min", "Minimum"), ...kravTal(f, "max", "Maximum")];
      if (fel.length === 0 && tal(f, "max") <= tal(f, "min")) {
        fel.push({ parameter: "max", meddelande: "Maximum måste vara större än minimum." });
      }
      return fel;
    },
    sampla: (f, s) => {
      const a = tal(f, "min");
      return a + (tal(f, "max") - a) * s.nasta();
    },
    moment: (f) => {
      const a = tal(f, "min");
      const b = tal(f, "max");
      return { vantevarde: (a + b) / 2, varians: (b - a) ** 2 / 12 };
    },
  },

  {
    typ: "triangular",
    namn: "Triangulär",
    narAnvands:
      "Lägsta, troligaste och högsta värde. Den fördelning en människa faktiskt kan uppskatta.",
    parametrar: [
      { nyckel: "min", etikett: "Lägsta", beskrivning: "Absolut nedre gräns." },
      { nyckel: "mode", etikett: "Troligaste", beskrivning: "Toppen. Måste ligga i [lägsta, högsta]." },
      { nyckel: "max", etikett: "Högsta", beskrivning: "Absolut övre gräns." },
    ],
    diskret: false,
    validera: (f) => {
      const fel = [
        ...kravTal(f, "min", "Lägsta"),
        ...kravTal(f, "mode", "Troligaste"),
        ...kravTal(f, "max", "Högsta"),
      ];
      if (fel.length > 0) return fel;
      const a = tal(f, "min");
      const c = tal(f, "mode");
      const b = tal(f, "max");
      if (b <= a) fel.push({ parameter: "max", meddelande: "Högsta måste vara större än lägsta." });
      if (c < a || c > b) {
        fel.push({
          parameter: "mode",
          meddelande:
            "Det troligaste värdet måste ligga mellan lägsta och högsta. En topp utanför intervallet beskriver ingen fördelning.",
        });
      }
      return fel;
    },
    sampla: (f, s) => {
      const a = tal(f, "min");
      const c = tal(f, "mode");
      const b = tal(f, "max");
      const u = s.nasta();
      const brytpunkt = (c - a) / (b - a);
      return u < brytpunkt
        ? a + Math.sqrt(u * (b - a) * (c - a))
        : b - Math.sqrt((1 - u) * (b - a) * (b - c));
    },
    moment: (f) => {
      const a = tal(f, "min");
      const c = tal(f, "mode");
      const b = tal(f, "max");
      return {
        vantevarde: (a + b + c) / 3,
        varians: (a * a + b * b + c * c - a * b - a * c - b * c) / 18,
      };
    },
  },

  {
    typ: "beta",
    namn: "Beta",
    narAnvands:
      "Andelar och sannolikheter mellan 0 och 1 - konverteringsgrad, andel som betalar i tid.",
    parametrar: [
      { nyckel: "alpha", etikett: "α", beskrivning: "Formparameter. > 0." },
      { nyckel: "beta", etikett: "β", beskrivning: "Formparameter. > 0." },
    ],
    diskret: false,
    validera: (f) => {
      const fel = [...kravTal(f, "alpha", "α"), ...kravTal(f, "beta", "β")];
      if (fel.length === 0) {
        if (tal(f, "alpha") <= 0) fel.push({ parameter: "alpha", meddelande: "α måste vara större än noll." });
        if (tal(f, "beta") <= 0) fel.push({ parameter: "beta", meddelande: "β måste vara större än noll." });
      }
      return fel;
    },
    sampla: (f, s) => {
      // Beta(a,b) = X/(X+Y) med X~Gamma(a), Y~Gamma(b). Båda ur samma ström.
      const x = s.gamma(tal(f, "alpha"));
      const y = s.gamma(tal(f, "beta"));
      const summa = x + y;
      // Två underflödade gamma ger 0/0. Mitten är den enda meningsfulla
      // utvägen, och den inträffar bara vid extrema parametrar.
      return summa === 0 ? 0.5 : x / summa;
    },
    moment: (f) => {
      const a = tal(f, "alpha");
      const b = tal(f, "beta");
      return {
        vantevarde: a / (a + b),
        varians: (a * b) / ((a + b) ** 2 * (a + b + 1)),
      };
    },
  },

  {
    typ: "exponential",
    namn: "Exponential",
    narAnvands: "Väntetider mellan händelser. Minneslös: det som gått spelar ingen roll.",
    parametrar: [
      { nyckel: "lambda", etikett: "Intensitet (λ)", beskrivning: "Händelser per tidsenhet. > 0." },
    ],
    diskret: false,
    validera: (f) => {
      const fel = kravTal(f, "lambda", "Intensiteten");
      if (fel.length === 0 && tal(f, "lambda") <= 0) {
        fel.push({ parameter: "lambda", meddelande: "Intensiteten måste vara större än noll." });
      }
      return fel;
    },
    // Inversmetoden. nastaOppen() och inte nasta(): log(0) är -oändligt.
    sampla: (f, s) => -Math.log(s.nastaOppen()) / tal(f, "lambda"),
    moment: (f) => {
      const l = tal(f, "lambda");
      return { vantevarde: 1 / l, varians: 1 / (l * l) };
    },
  },

  {
    typ: "poisson",
    namn: "Poisson",
    narAnvands: "Antal händelser under en period - inkommande ärenden, avhopp, reklamationer.",
    parametrar: [{ nyckel: "lambda", etikett: "Väntat antal (λ)", beskrivning: "Genomsnittligt antal. > 0." }],
    diskret: true,
    validera: (f) => {
      const fel = kravTal(f, "lambda", "Väntat antal");
      if (fel.length === 0 && tal(f, "lambda") <= 0) {
        fel.push({ parameter: "lambda", meddelande: "Väntat antal måste vara större än noll." });
      }
      return fel;
    },
    sampla: (f, s) => {
      const lambda = tal(f, "lambda");
      if (lambda < 30) {
        // Knuths metod. Exakt, och snabb för små λ.
        const grans = Math.exp(-lambda);
        let k = 0;
        let p = 1;
        do {
          k++;
          p *= s.nasta();
        } while (p > grans);
        return k - 1;
      }
      /*
       * För stora λ blir Knuth långsam (den drar i snitt λ tal per sampel)
       * OCH numeriskt osäker: exp(-λ) underflödar till noll runt λ≈745, och
       * då blir slingan oändlig. Normalapproximationen med kontinuitets-
       * korrigering är noggrann långt under λ=30 och kostar en dragning.
       */
      const v = Math.round(lambda + Math.sqrt(lambda) * s.normal());
      return v < 0 ? 0 : v;
    },
    moment: (f) => ({ vantevarde: tal(f, "lambda"), varians: tal(f, "lambda") }),
  },

  {
    typ: "bernoulli",
    namn: "Bernoulli",
    narAnvands: "Inträffar eller inte. En kund som betalar, en ansökan som beviljas.",
    parametrar: [{ nyckel: "p", etikett: "Sannolikhet (p)", beskrivning: "Mellan 0 och 1." }],
    diskret: true,
    validera: (f) => {
      const fel = kravTal(f, "p", "Sannolikheten");
      if (fel.length === 0 && (tal(f, "p") < 0 || tal(f, "p") > 1)) {
        fel.push({ parameter: "p", meddelande: "Sannolikheten måste ligga mellan 0 och 1." });
      }
      return fel;
    },
    sampla: (f, s) => (s.nasta() < tal(f, "p") ? 1 : 0),
    moment: (f) => {
      const p = tal(f, "p");
      return { vantevarde: p, varians: p * (1 - p) };
    },
  },

  {
    typ: "binomial",
    namn: "Binomial",
    narAnvands: "Antal lyckade av n oberoende försök - hur många av 200 fakturor som betalas i tid.",
    parametrar: [
      { nyckel: "n", etikett: "Antal försök (n)", beskrivning: "Heltal ≥ 0." },
      { nyckel: "p", etikett: "Sannolikhet (p)", beskrivning: "Mellan 0 och 1." },
    ],
    diskret: true,
    validera: (f) => {
      const fel = [...kravTal(f, "n", "Antal försök"), ...kravTal(f, "p", "Sannolikheten")];
      if (fel.length > 0) return fel;
      if (!Number.isInteger(tal(f, "n")) || tal(f, "n") < 0) {
        fel.push({ parameter: "n", meddelande: "Antal försök måste vara ett heltal som inte är negativt." });
      }
      if (tal(f, "p") < 0 || tal(f, "p") > 1) {
        fel.push({ parameter: "p", meddelande: "Sannolikheten måste ligga mellan 0 och 1." });
      }
      // Ett tak: n dragningar per sampel gånger en miljon iterationer blir
      // ogenomförbart långt innan det blir fel. Bättre ett tydligt nej.
      if (tal(f, "n") > 100000) {
        fel.push({
          parameter: "n",
          meddelande: "Antal försök över 100 000 är för dyrt att simulera exakt. Använd en normalapproximation i stället.",
        });
      }
      return fel;
    },
    sampla: (f, s) => {
      const n = tal(f, "n");
      const p = tal(f, "p");
      let k = 0;
      for (let i = 0; i < n; i++) if (s.nasta() < p) k++;
      return k;
    },
    moment: (f) => {
      const n = tal(f, "n");
      const p = tal(f, "p");
      return { vantevarde: n * p, varians: n * p * (1 - p) };
    },
  },

  {
    typ: "discrete",
    namn: "Diskret",
    narAnvands: "Ett fåtal namngivna utfall med var sin vikt - tre scenarier, fyra utfall i en tvist.",
    parametrar: [],
    diskret: true,
    validera: (f) => {
      const p = f.punkter ?? [];
      if (p.length === 0) {
        return [{ parameter: "punkter", meddelande: "En diskret fördelning behöver minst ett utfall." }];
      }
      const fel: FordelningsFel[] = [];
      for (const [i, punkt] of p.entries()) {
        if (!arTal(punkt.varde)) {
          fel.push({ parameter: `punkter[${i}].varde`, meddelande: "Utfallet är inte ett ändligt tal." });
        }
        if (!arTal(punkt.vikt) || punkt.vikt < 0) {
          fel.push({ parameter: `punkter[${i}].vikt`, meddelande: "Vikten måste vara ett tal som inte är negativt." });
        }
      }
      if (fel.length === 0 && p.reduce((a, x) => a + x.vikt, 0) <= 0) {
        fel.push({
          parameter: "punkter",
          meddelande: "Vikterna summerar till noll - då finns inget utfall som kan inträffa.",
        });
      }
      return fel;
    },
    sampla: (f, s) => {
      const p = f.punkter ?? [];
      const summa = p.reduce((a, x) => a + x.vikt, 0);
      let u = s.nasta() * summa;
      for (const punkt of p) {
        u -= punkt.vikt;
        if (u <= 0) return punkt.varde;
      }
      // Avrundningsfel i summan kan lämna ett hårstrå över.
      return p[p.length - 1].varde;
    },
    moment: (f) => {
      const p = f.punkter ?? [];
      const summa = p.reduce((a, x) => a + x.vikt, 0);
      if (summa <= 0) return { vantevarde: null, varians: null };
      const m = p.reduce((a, x) => a + (x.vikt / summa) * x.varde, 0);
      const v = p.reduce((a, x) => a + (x.vikt / summa) * (x.varde - m) ** 2, 0);
      return { vantevarde: m, varians: v };
    },
  },

  {
    typ: "custom",
    namn: "Egen (empirisk)",
    narAnvands:
      "Historiska utfall som fördelning. Stödpunkterna tolkas som en kurva och samplas med interpolation.",
    parametrar: [],
    diskret: false,
    validera: (f) => {
      const p = f.punkter ?? [];
      if (p.length < 2) {
        return [
          {
            parameter: "punkter",
            meddelande: "En egen fördelning behöver minst två stödpunkter för att kunna interpoleras.",
          },
        ];
      }
      const fel: FordelningsFel[] = [];
      for (const [i, punkt] of p.entries()) {
        if (!arTal(punkt.varde)) {
          fel.push({ parameter: `punkter[${i}].varde`, meddelande: "Stödpunkten är inte ett ändligt tal." });
        }
        if (!arTal(punkt.vikt) || punkt.vikt < 0) {
          fel.push({ parameter: `punkter[${i}].vikt`, meddelande: "Vikten måste vara ett tal som inte är negativt." });
        }
      }
      if (fel.length === 0 && p.reduce((a, x) => a + x.vikt, 0) <= 0) {
        fel.push({ parameter: "punkter", meddelande: "Vikterna summerar till noll." });
      }
      return fel;
    },
    sampla: (f, s) => {
      // Stödpunkterna sorteras och tolkas som en styckvis linjär täthet.
      const p = [...(f.punkter ?? [])].sort((a, b) => a.varde - b.varde);
      const summa = p.reduce((a, x) => a + x.vikt, 0);
      let u = s.nasta() * summa;
      for (let i = 0; i < p.length; i++) {
        u -= p[i].vikt;
        if (u <= 0) {
          // Interpolera mot grannen, annars blir "egen fördelning" bara en
          // diskret fördelning med finare steg.
          const granne = i + 1 < p.length ? p[i + 1] : p[i === 0 ? 0 : i - 1];
          const andel = s.nasta();
          return p[i].varde + (granne.varde - p[i].varde) * andel;
        }
      }
      return p[p.length - 1].varde;
    },
    moment: (f) => {
      const p = f.punkter ?? [];
      const summa = p.reduce((a, x) => a + x.vikt, 0);
      if (summa <= 0) return { vantevarde: null, varians: null };
      const m = p.reduce((a, x) => a + (x.vikt / summa) * x.varde, 0);
      // Interpolationen breddar fördelningen jämfört med de rena punkterna,
      // så variansen nedan är en UNDRE gräns. Sviten prövar därför bara
      // väntevärdet mot den här funktionen.
      const v = p.reduce((a, x) => a + (x.vikt / summa) * (x.varde - m) ** 2, 0);
      return { vantevarde: m, varians: v };
    },
  },
];

const KARTA = new Map<FordelningsTyp, Definition>(REGISTER.map((d) => [d.typ, d]));

/* -------------------------------------------------------------------------- */
/* Den publika ytan                                                           */
/* -------------------------------------------------------------------------- */

/** Alla fördelningar, i visningsordning. Gränssnittet läser den här listan. */
export const FORDELNINGAR: readonly Omit<Definition, "validera" | "sampla" | "moment">[] =
  REGISTER.map(({ typ, namn, narAnvands, parametrar, diskret }) => ({
    typ,
    namn,
    narAnvands,
    parametrar,
    diskret,
  }));

export const fordelningsDefinition = (typ: FordelningsTyp) => KARTA.get(typ);

/**
 * Prövar en fördelning. Tom lista = giltig.
 *
 * ANROPAS FÖRE VARJE KÖRNING. En ogiltig fördelning får aldrig samplas:
 * resultatet hade sett ut som ett svar.
 */
export const validera = (f: Fordelning): FordelningsFel[] => {
  const def = KARTA.get(f.typ);
  if (!def) {
    return [{ parameter: "typ", meddelande: `Okänd fördelning: ${String(f.typ)}.` }];
  }
  if (f.parametrar === null || typeof f.parametrar !== "object") {
    return [{ parameter: "parametrar", meddelande: "Parametrarna saknas." }];
  }
  return def.validera(f);
};

/**
 * Drar ett värde. FÖRUTSÄTTER att fördelningen redan validerats.
 *
 * Att validera per dragning hade kostat en miljon valideringar per
 * variabel och körning; kontrollen hör hemma före slingan, inte i den.
 */
export const sampla = (f: Fordelning, s: Slumpstrom): number => {
  const def = KARTA.get(f.typ);
  if (!def) throw new Error(`Okänd fördelning: ${String(f.typ)}`);
  return def.sampla(f, s);
};

/** Teoretiskt väntevärde och varians. Sviten mäter samplingen mot den här. */
export const moment = (f: Fordelning): Moment => {
  const def = KARTA.get(f.typ);
  if (!def) return { vantevarde: null, varians: null };
  return def.moment(f);
};

/* ==========================================================================
   src/lib/montecarlo/format.ts
   ========================================================================== */

/**
 * BELOPP OCH ANDELAR I SIMULERINGENS SPRÅK.
 *
 * Låg i SimulationPanel som en lokal hjälpare, och hade två fel som bara
 * syns när man faktiskt läser skärmen:
 *
 *  1. "−500 tkr kr". Formateraren satte redan ut ett skalord (tkr, mn) och
 *     panelen la på enheten en gång till. Tusen kronor är redan kronor.
 *  2. "2.29 mn". Decimalpunkt i en svensk siffra. Resten av produkten
 *     skriver 2,29.
 *
 * Enheten hör därför ihop med talet och formateras med det - inte bredvid.
 * Funktionen är ren och prövas i tests/montecarlo.ts.
 */

/** Svenskt tal: mellanslag som tusentalsavskiljare, komma som decimaltecken. */
const tal__montecarlo_format = (v: number, decimaler = 0): string =>
  v.toLocaleString("sv-SE", { minimumFractionDigits: decimaler, maximumFractionDigits: decimaler });

/**
 * Ett belopp med sin enhet, i ett stycke.
 *
 * Kronor skalas, eftersom en likviditetssiffra annars blir en rad siffror
 * ingen läser: 1 234 kr, 500 tkr, 2,29 mkr. Andra enheter skalas INTE -
 * "40 st" ska stå som 40 st, och "0,08" som andel ska inte bli "0 st".
 */
export const beloppMedEnhet = (v: number, enhet: string | null): string => {
  if (enhet === "kr") {
    const abs = Math.abs(v);
    if (abs >= 1e6) return `${tal__montecarlo_format(v / 1e6, 2)} mkr`;
    if (abs >= 1e4) return `${tal__montecarlo_format(Math.round(v / 1000))} tkr`;
    return `${tal__montecarlo_format(Math.round(v))} kr`;
  }
  // Små tal (andelar) tappar allt om de rundas till heltal.
  const avrundat = Math.abs(v) < 10 && !Number.isInteger(v) ? tal__montecarlo_format(v, 2) : tal__montecarlo_format(Math.round(v));
  return enhet ? `${avrundat} ${enhet}` : avrundat;
};

/**
 * En andel som procent: "12,3 %".
 *
 * En decimal, för att en sannolikhet med två decimaler låtsas om en
 * precision Monte Carlo inte har vid tiotusen iterationer. Null blir ett
 * tankstreck och inte "0 %" - "vet inte" och "aldrig" är olika svar.
 */
export const procentAv = (v: number | null | undefined): string =>
  v === null || v === undefined ? "\u2013" : `${tal__montecarlo_format(v * 100, 1)} %`;

/**
 * Kompakt belopp för axlar och nyckeltalskort, där enheten står i
 * rubriken och inte får upprepas per etikett.
 */
export const beloppKort = (v: number): string => {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${tal__montecarlo_format(v / 1e9, 1)} mdr`;
  if (abs >= 1e6) return `${tal__montecarlo_format(v / 1e6, 2)} mn`;
  if (abs >= 1e4) return `${tal__montecarlo_format(Math.round(v / 1000))} tkr`;
  return tal__montecarlo_format(Math.round(v));
};

/* ==========================================================================
   src/lib/montecarlo/statistik.ts
   ========================================================================== */

/**
 * STATISTIKEN: från en miljon tal till något en människa kan besluta på.
 *
 * Filen är ren aritmetik utan I/O, och den bär tre ställningstaganden som
 * är värda att skriva ut, för de påverkar vad användaren får se.
 *
 * 1. PERCENTILER RÄKNAS PÅ SORTERADE SAMPEL, inte på en antagen
 *    normalfördelning. Hela poängen med Monte Carlo är att utfallet INTE
 *    behöver vara normalfördelat - att sedan räkna P90 som "medel + 1,28σ"
 *    hade kastat bort just det. Interpolationen är den vanliga (typ 7,
 *    samma som R och numpy använder som standard), så en siffra går att
 *    kontrollera mot ett annat verktyg.
 *
 * 2. VARIANSEN RÄKNAS MED WELFORDS METOD. Den naiva formeln
 *    E[X²] - E[X]² subtraherar två stora och nästan lika tal, och tappar
 *    då nästan all precision när spridningen är liten i förhållande till
 *    nivån. Ett bolag med 50 miljoner i omsättning och 200 000 i
 *    osäkerhet är precis det fallet, och den naiva formeln kan där ge en
 *    NEGATIV varians. Welford gör en genomgång och är numeriskt stabil.
 *
 * 3. KONFIDENSINTERVALLET GÄLLER MEDELVÄRDET, inte utfallet. Det är
 *    simuleringsosäkerhet - "hur säkra är vi på var mitten ligger, givet
 *    att vi bara körde N gånger" - och inte "här hamnar resultatet med
 *    95 % sannolikhet". Att blanda ihop de två är det vanligaste sättet
 *    att läsa en Monte Carlo-analys fel, och därför heter fältet
 *    `medelvardetsKonfidensintervall` och inget kortare.
 */

/* -------------------------------------------------------------------------- */
/* Formen                                                                     */
/* -------------------------------------------------------------------------- */

export interface Percentiler {
  p5: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface Statistik {
  antal: number;
  medel: number;
  median: number;
  min: number;
  max: number;
  standardavvikelse: number;
  varians: number;
  percentiler: Percentiler;
  /**
   * 95 % konfidensintervall FÖR MEDELVÄRDET (simuleringsosäkerheten).
   * Inte ett intervall för utfallet - det är P5..P95.
   */
  medelvardetsKonfidensintervall: { nedre: number; ovre: number };
  /** Standardfelet för medelvärdet: σ/√n. Krymper som roten ur N. */
  standardfel: number;
}

export interface Histogram {
  /** Nedre kant för varje stapel. */
  kanter: number[];
  /** Antal sampel i varje stapel. kanter.length === antal.length + 1. */
  antal: number[];
  /** Stapelbredden. Konstant. */
  bredd: number;
}

/* -------------------------------------------------------------------------- */
/* Percentiler                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Percentil ur en SORTERAD stigande array.
 *
 * Linjär interpolation mellan grannar (typ 7). Kravet att indata redan är
 * sorterad är avsiktligt: funktionen anropas åtta gånger per output, och
 * att sortera om varje gång hade gjort en miljon sampel till åtta
 * sorteringar i stället för en.
 */
export const percentil = (sorterad: ArrayLike<number>, p: number): number => {
  const n = sorterad.length;
  if (n === 0) return Number.NaN;
  if (n === 1) return sorterad[0];
  const pos = (n - 1) * Math.min(1, Math.max(0, p));
  const lag = Math.floor(pos);
  const hog = Math.ceil(pos);
  if (lag === hog) return sorterad[lag];
  const andel = pos - lag;
  return sorterad[lag] * (1 - andel) + sorterad[hog] * andel;
};

/* -------------------------------------------------------------------------- */
/* Sammanfattningen                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Hela statistiken för en outputserie.
 *
 * `sorterad` MÅSTE vara stigande sorterad - anroparen sorterar en gång och
 * återanvänder resultatet för både percentiler och sannolikheter.
 */
export const sammanfatta = (sorterad: Float64Array): Statistik => {
  const n = sorterad.length;
  if (n === 0) {
    throw new Error("Statistik kan inte räknas på noll sampel.");
  }

  // Welford i en genomgång. Se filens inledning för varför inte E[X²]-E[X]².
  let medel = 0;
  let m2 = 0;
  for (let i = 0; i < n; i++) {
    const x = sorterad[i];
    const delta = x - medel;
    medel += delta / (i + 1);
    m2 += delta * (x - medel);
  }
  // Stickprovsvarians (n-1). Vid n=1 finns ingen spridning att skatta.
  const varians = n > 1 ? m2 / (n - 1) : 0;
  const std = Math.sqrt(Math.max(0, varians));
  const standardfel = n > 0 ? std / Math.sqrt(n) : 0;

  return {
    antal: n,
    medel,
    median: percentil(sorterad, 0.5),
    min: sorterad[0],
    max: sorterad[n - 1],
    standardavvikelse: std,
    varians,
    percentiler: {
      p5: percentil(sorterad, 0.05),
      p10: percentil(sorterad, 0.1),
      p25: percentil(sorterad, 0.25),
      p50: percentil(sorterad, 0.5),
      p75: percentil(sorterad, 0.75),
      p90: percentil(sorterad, 0.9),
      p95: percentil(sorterad, 0.95),
      p99: percentil(sorterad, 0.99),
    },
    // 1,959964 = normalfördelningens 97,5-percentil. Centrala gränsvärdes-
    // satsen gäller för MEDELVÄRDET även när utfallet är skevt, vilket är
    // varför normalapproximationen är rimlig just här och inte för P90.
    medelvardetsKonfidensintervall: {
      nedre: medel - 1.959964 * standardfel,
      ovre: medel + 1.959964 * standardfel,
    },
    standardfel,
  };
};

/* -------------------------------------------------------------------------- */
/* Sannolikheter                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Andelen sampel som är >= troskeln. Binärsökning i den sorterade serien.
 *
 * Linjär genomsökning hade kostat en miljon jämförelser per fråga, och
 * gränssnittet frågar om flera trösklar samtidigt medan användaren drar i
 * ett reglage.
 */
export const sannolikhetMinst = (sorterad: ArrayLike<number>, troskel: number): number => {
  const n = sorterad.length;
  if (n === 0) return Number.NaN;
  // Första index med värde >= troskel.
  let lag = 0;
  let hog = n;
  while (lag < hog) {
    const mid = (lag + hog) >>> 1;
    if (sorterad[mid] < troskel) lag = mid + 1;
    else hog = mid;
  }
  return (n - lag) / n;
};

/** Andelen sampel som är < troskeln. Komplementet till sannolikhetMinst. */
export const sannolikhetUnder = (sorterad: ArrayLike<number>, troskel: number): number =>
  1 - sannolikhetMinst(sorterad, troskel);

/* -------------------------------------------------------------------------- */
/* Histogram                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Binnar serien för visualisering.
 *
 * ANTALET STAPLAR ÄR EN VISNINGSPARAMETER, inte en statistisk. För få
 * staplar gömmer en tvåpucklig fördelning - och en tvåpucklig fördelning
 * betyder att två olika utfall är troliga, vilket är precis det en
 * beslutsfattare måste se. Standarden är därför 50, inte 10.
 *
 * En serie utan spridning (alla värden lika) får EN stapel med hela
 * massan. Att dela med noll hade gett NaN-kanter och en tom graf.
 */
export const histogram = (sorterad: Float64Array, staplar = 50): Histogram => {
  const n = sorterad.length;
  if (n === 0) return { kanter: [], antal: [], bredd: 0 };
  const min = sorterad[0];
  const max = sorterad[n - 1];

  if (max === min) {
    return { kanter: [min, min], antal: [n], bredd: 0 };
  }

  const antalStaplar = Math.max(1, Math.min(500, Math.floor(staplar)));
  const bredd = (max - min) / antalStaplar;
  const kanter = new Array<number>(antalStaplar + 1);
  for (let i = 0; i <= antalStaplar; i++) kanter[i] = min + i * bredd;
  // Sista kanten sätts exakt, så att maxvärdet garanterat ryms.
  kanter[antalStaplar] = max;

  const antal = new Array<number>(antalStaplar).fill(0);
  for (let i = 0; i < n; i++) {
    let idx = Math.floor((sorterad[i] - min) / bredd);
    // Maxvärdet hamnar annars i en stapel som inte finns.
    if (idx >= antalStaplar) idx = antalStaplar - 1;
    if (idx < 0) idx = 0;
    antal[idx]++;
  }
  return { kanter, antal, bredd };
};

/* -------------------------------------------------------------------------- */
/* Rangkorrelation - grunden för känslighetsanalysen                          */
/* -------------------------------------------------------------------------- */

/**
 * Spearmans rangkorrelation mellan två serier.
 *
 * RANG och inte Pearson, av ett skäl som betyder mycket i praktiken:
 * Pearson mäter LINJÄRT samband. En input som påverkar resultatet kraftigt
 * men inte rätlinjigt - en kostnad som slår till först över en tröskel,
 * en ränta som slår igenom multiplikativt - får då ett lågt värde och
 * hamnar sist i känslighetslistan trots att den styr utfallet. Spearman
 * mäter MONOTONT samband och fångar båda.
 *
 * Lika värden (vanligt vid diskreta fördelningar som bernoulli) får
 * medelrang. Utan det blir korrelationen systematiskt fel för just de
 * variabler som bara har två utfall.
 */
export const rangkorrelation = (a: Float64Array, b: Float64Array): number => {
  const n = a.length;
  if (n !== b.length) throw new Error("Serierna måste vara lika långa.");
  if (n < 3) return 0;

  const rangA = rangera(a);
  const rangB = rangera(b);

  let medelA = 0;
  let medelB = 0;
  for (let i = 0; i < n; i++) {
    medelA += rangA[i];
    medelB += rangB[i];
  }
  medelA /= n;
  medelB /= n;

  let tal = 0;
  let kvadA = 0;
  let kvadB = 0;
  for (let i = 0; i < n; i++) {
    const da = rangA[i] - medelA;
    const db = rangB[i] - medelB;
    tal += da * db;
    kvadA += da * da;
    kvadB += db * db;
  }
  // Noll varians i någon serie = ingen rang att korrelera. Det inträffar
  // när en input satts till en konstant, och svaret är då 0, inte NaN.
  if (kvadA === 0 || kvadB === 0) return 0;
  return tal / Math.sqrt(kvadA * kvadB);
};

/** Rangerar en serie, med medelrang vid lika värden. */
const rangera = (v: Float64Array): Float64Array => {
  const n = v.length;
  const idx = new Int32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  // Sortera index efter värde.
  const arr = Array.from(idx);
  arr.sort((x, y) => v[x] - v[y]);

  const rang = new Float64Array(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && v[arr[j + 1]] === v[arr[i]]) j++;
    // Medelrangen för hela gruppen av lika värden (1-indexerat).
    const medel = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) rang[arr[k]] = medel;
    i = j + 1;
  }
  return rang;
};

/* ==========================================================================
   src/lib/montecarlo/uttryck.ts
   ========================================================================== */

/**
 * BERÄKNINGSMODELLEN SOM TEXT - OCH VARFÖR INTE SOM KOD.
 *
 * En simulering är inte klar för att den räknat. Den ska gå att SPARA,
 * SKICKA, KÖRA OM och GRANSKA: "vilken modell gav det här resultatet?"
 * ska ha ett svar som går att läsa i efterhand.
 *
 * Det utesluter en JavaScript-funktion. En funktion går inte att lagra i
 * en databas på ett meningsfullt sätt, går inte över ett API, och kan inte
 * köras på servern utan att servern kör kod som en klient skickat. Att
 * göra det med `eval` eller `new Function` vore att ge varje inloggad
 * användare exekvering i API-processen - alltså den värsta sårbarhet ett
 * system av det här slaget kan ha.
 *
 * Därför ett eget, litet uttrycksspråk:
 *
 *     Resultat = Kunder * Snittintakt - Kostnader
 *     Marginal = if(Resultat > 0, Resultat / Intakter, 0)
 *
 * SÄKERHETEN ÄR STRUKTURELL, inte en filtrering. Parsern bygger ett träd
 * av ett fåtal nodtyper och evaluatorn kan bara räkna på dem. Det finns
 * ingen väg från en sträng till en funktionsanrop, ingen punktnotation,
 * ingen åtkomst till globala objekt - inte för att de spärras, utan för
 * att grammatiken inte kan uttrycka dem. En svartlista går att gå runt;
 * en grammatik som saknar konstruktionen gör det inte.
 *
 * ORDNINGEN följer den matematiska: jämförelser lägst, sedan + -, sedan
 * * / %, sedan potens (högerassociativ), högst unärt minus och anrop.
 */

/* -------------------------------------------------------------------------- */
/* Trädet                                                                     */
/* -------------------------------------------------------------------------- */

export type Nod =
  | { sort: "tal"; varde: number }
  | { sort: "variabel"; namn: string }
  | { sort: "unar"; operator: "-" | "!"; av: Nod }
  | { sort: "binar"; operator: BinarOperator; vanster: Nod; hoger: Nod }
  | { sort: "anrop"; funktion: string; argument: Nod[] };

type BinarOperator =
  | "+" | "-" | "*" | "/" | "%" | "^"
  | "<" | "<=" | ">" | ">=" | "==" | "!="
  | "&&" | "||";

export class UttrycksFel extends Error {
  constructor(
    message: string,
    /** Teckenposition i uttrycket, så att gränssnittet kan peka. */
    readonly position: number,
  ) {
    super(message);
    this.name = "UttrycksFel";
  }
}

/* -------------------------------------------------------------------------- */
/* Funktionsbiblioteket                                                       */
/* -------------------------------------------------------------------------- */

/**
 * De enda funktioner som finns.
 *
 * Listan är medvetet kort. Varje tillägg är en ny yta att pröva, och en
 * modell som behöver mer än det här är förmodligen två modeller.
 *
 * `if` är villkorlig och utvärderar BÅDA grenarna innan den väljer - det
 * går bra eftersom inget uttryck kan ha sidoeffekter. Det gör evaluatorn
 * enklare och ger samma svar.
 */
const FUNKTIONER: Record<string, { arg: number | "minst1"; f: (a: number[]) => number }> = {
  min: { arg: "minst1", f: (a) => Math.min(...a) },
  max: { arg: "minst1", f: (a) => Math.max(...a) },
  abs: { arg: 1, f: (a) => Math.abs(a[0]) },
  sqrt: { arg: 1, f: (a) => Math.sqrt(a[0]) },
  ln: { arg: 1, f: (a) => Math.log(a[0]) },
  log10: { arg: 1, f: (a) => Math.log10(a[0]) },
  exp: { arg: 1, f: (a) => Math.exp(a[0]) },
  round: { arg: 1, f: (a) => Math.round(a[0]) },
  floor: { arg: 1, f: (a) => Math.floor(a[0]) },
  ceil: { arg: 1, f: (a) => Math.ceil(a[0]) },
  // Tredje argumentet är villkorets falska gren.
  if: { arg: 3, f: (a) => (a[0] !== 0 ? a[1] : a[2]) },
  /**
   * Klamrar värdet till [min, max]. Finns för att en modell ofta behöver
   * uttrycka "kan inte bli negativ" utan att skriva en if kring varje led.
   */
  clamp: { arg: 3, f: (a) => Math.min(Math.max(a[0], a[1]), a[2]) },
};

export const FUNKTIONSNAMN = Object.keys(FUNKTIONER).sort();

/* -------------------------------------------------------------------------- */
/* Tokenisering                                                               */
/* -------------------------------------------------------------------------- */

interface Token {
  typ: "tal" | "namn" | "operator" | "(" | ")" | ",";
  text: string;
  position: number;
}

const OPERATORTECKEN = new Set(["+", "-", "*", "/", "%", "^", "<", ">", "=", "!", "&", "|"]);

const tokenisera = (kalla: string): Token[] => {
  const tokens: Token[] = [];
  let i = 0;
  while (i < kalla.length) {
    const c = kalla[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }
    if (c === "(" || c === ")" || c === ",") {
      tokens.push({ typ: c === "," ? "," : c, text: c, position: i });
      i++;
      continue;
    }
    if (c >= "0" && c <= "9") {
      const start = i;
      while (i < kalla.length && kalla[i] >= "0" && kalla[i] <= "9") i++;
      if (kalla[i] === ".") {
        i++;
        while (i < kalla.length && kalla[i] >= "0" && kalla[i] <= "9") i++;
      }
      // Exponentform (1e6) är vanlig i ekonomiska modeller.
      if (kalla[i] === "e" || kalla[i] === "E") {
        const spar = i;
        i++;
        if (kalla[i] === "+" || kalla[i] === "-") i++;
        if (kalla[i] >= "0" && kalla[i] <= "9") {
          while (i < kalla.length && kalla[i] >= "0" && kalla[i] <= "9") i++;
        } else {
          i = spar; // "1e" utan siffror är inte en exponent.
        }
      }
      tokens.push({ typ: "tal", text: kalla.slice(start, i), position: start });
      continue;
    }
    // Ett namn: bokstav eller understreck först, sedan även siffror.
    // Svenska tecken tillåts - variabeln får heta "Intäkter".
    if (/[A-Za-zÅÄÖåäö_]/.test(c)) {
      const start = i;
      while (i < kalla.length && /[A-Za-zÅÄÖåäö0-9_]/.test(kalla[i])) i++;
      tokens.push({ typ: "namn", text: kalla.slice(start, i), position: start });
      continue;
    }
    if (OPERATORTECKEN.has(c)) {
      const start = i;
      const tva = kalla.slice(i, i + 2);
      if (["<=", ">=", "==", "!=", "&&", "||"].includes(tva)) {
        i += 2;
      } else {
        // Ett ensamt = är nästan alltid ett menat ==. Säg det.
        if (c === "=") throw new UttrycksFel('Använd "==" för jämförelse, inte "=".', i);
        if (c === "&" || c === "|") {
          throw new UttrycksFel(`Använd "${c}${c}" för logiskt ${c === "&" ? "och" : "eller"}.`, i);
        }
        i += 1;
      }
      tokens.push({ typ: "operator", text: kalla.slice(start, i), position: start });
      continue;
    }
    throw new UttrycksFel(`Tecknet "${c}" hör inte hemma i ett uttryck.`, i);
  }
  return tokens;
};

/* -------------------------------------------------------------------------- */
/* Parsern                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Tolkar ett uttryck till ett träd. Kastar UttrycksFel med position.
 *
 * Rekursiv nedstigning, en nivå per prioritet. Ingen `eval`, ingen
 * `new Function`, ingen konstruktion som kan nå omvärlden.
 */
export const tolka = (kalla: string): Nod => {
  const tokens = tokenisera(kalla);
  if (tokens.length === 0) throw new UttrycksFel("Uttrycket är tomt.", 0);

  let pos = 0;
  const kika = (): Token | undefined => tokens[pos];
  const ta = (): Token => tokens[pos++];
  const slutet = () => (tokens.length > 0 ? tokens[tokens.length - 1].position + 1 : 0);

  const forvantaOperator = (...texter: string[]): boolean => {
    const t = kika();
    return t !== undefined && t.typ === "operator" && texter.includes(t.text);
  };

  // Lägst prioritet: ||
  const eller = (): Nod => {
    let v = och();
    while (forvantaOperator("||")) {
      ta();
      v = { sort: "binar", operator: "||", vanster: v, hoger: och() };
    }
    return v;
  };
  const och = (): Nod => {
    let v = jamforelse();
    while (forvantaOperator("&&")) {
      ta();
      v = { sort: "binar", operator: "&&", vanster: v, hoger: jamforelse() };
    }
    return v;
  };
  const jamforelse = (): Nod => {
    let v = summa();
    while (forvantaOperator("<", "<=", ">", ">=", "==", "!=")) {
      const op = ta().text as BinarOperator;
      v = { sort: "binar", operator: op, vanster: v, hoger: summa() };
    }
    return v;
  };
  const summa = (): Nod => {
    let v = produkt();
    while (forvantaOperator("+", "-")) {
      const op = ta().text as BinarOperator;
      v = { sort: "binar", operator: op, vanster: v, hoger: produkt() };
    }
    return v;
  };
  const produkt = (): Nod => {
    let v = unar();
    while (forvantaOperator("*", "/", "%")) {
      const op = ta().text as BinarOperator;
      v = { sort: "binar", operator: op, vanster: v, hoger: unar() };
    }
    return v;
  };
  const unar = (): Nod => {
    if (forvantaOperator("-")) {
      ta();
      return { sort: "unar", operator: "-", av: unar() };
    }
    if (forvantaOperator("+")) {
      ta();
      return unar();
    }
    if (forvantaOperator("!")) {
      ta();
      return { sort: "unar", operator: "!", av: unar() };
    }
    return potens();
  };
  // Potens binder hårdast och är HÖGERassociativ: 2^3^2 är 2^9, inte 8^2.
  const potens = (): Nod => {
    const bas = atom();
    if (forvantaOperator("^")) {
      ta();
      return { sort: "binar", operator: "^", vanster: bas, hoger: unar() };
    }
    return bas;
  };
  const atom = (): Nod => {
    const t = kika();
    if (t === undefined) throw new UttrycksFel("Uttrycket slutar mitt i.", slutet());

    if (t.typ === "tal") {
      ta();
      const v = Number(t.text);
      if (!Number.isFinite(v)) throw new UttrycksFel(`"${t.text}" är inte ett giltigt tal.`, t.position);
      return { sort: "tal", varde: v };
    }
    if (t.typ === "(") {
      ta();
      const inre = eller();
      const stang = kika();
      if (stang === undefined || stang.typ !== ")") {
        throw new UttrycksFel("En parentes öppnades men stängdes aldrig.", t.position);
      }
      ta();
      return inre;
    }
    if (t.typ === "namn") {
      ta();
      // Ett namn följt av "(" är ett funktionsanrop, annars en variabel.
      if (kika()?.typ === "(") {
        ta();
        const argument: Nod[] = [];
        if (kika()?.typ !== ")") {
          for (;;) {
            argument.push(eller());
            if (kika()?.typ === ",") {
              ta();
              continue;
            }
            break;
          }
        }
        const stang = kika();
        if (stang === undefined || stang.typ !== ")") {
          throw new UttrycksFel(`Anropet till ${t.text}() stängdes aldrig.`, t.position);
        }
        ta();
        const def = FUNKTIONER[t.text];
        if (!def) {
          throw new UttrycksFel(
            `Funktionen ${t.text}() finns inte. Tillgängliga: ${FUNKTIONSNAMN.join(", ")}.`,
            t.position,
          );
        }
        if (def.arg === "minst1" ? argument.length < 1 : argument.length !== def.arg) {
          throw new UttrycksFel(
            `${t.text}() tar ${def.arg === "minst1" ? "minst ett" : String(def.arg)} argument, fick ${argument.length}.`,
            t.position,
          );
        }
        return { sort: "anrop", funktion: t.text, argument };
      }
      return { sort: "variabel", namn: t.text };
    }
    throw new UttrycksFel(`"${t.text}" kan inte stå här.`, t.position);
  };

  const trad = eller();
  if (pos < tokens.length) {
    throw new UttrycksFel(`"${tokens[pos].text}" står löst efter uttryckets slut.`, tokens[pos].position);
  }
  return trad;
};

/* -------------------------------------------------------------------------- */
/* Evaluering                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Räknar ut trädet mot en namnkarta.
 *
 * `varden` är en vanlig array plus ett index, inte ett objekt: funktionen
 * anropas en gång per iteration och output, alltså miljontals gånger, och
 * en objektuppslagning per variabel är mätbart dyrare.
 *
 * OKÄNT NAMN KASTAR. Att tyst räkna med noll för en variabel som stavats
 * fel är precis den sortens fel som ger ett rimligt utseende resultat.
 */
export const berakna = (nod: Nod, varden: ReadonlyMap<string, number>): number => {
  switch (nod.sort) {
    case "tal":
      return nod.varde;
    case "variabel": {
      const v = varden.get(nod.namn);
      if (v === undefined) throw new Error(`Variabeln "${nod.namn}" finns inte i modellen.`);
      return v;
    }
    case "unar": {
      const v = berakna(nod.av, varden);
      return nod.operator === "-" ? -v : v === 0 ? 1 : 0;
    }
    case "anrop": {
      const def = FUNKTIONER[nod.funktion];
      return def.f(nod.argument.map((a) => berakna(a, varden)));
    }
    case "binar": {
      const a = berakna(nod.vanster, varden);
      const b = berakna(nod.hoger, varden);
      switch (nod.operator) {
        case "+": return a + b;
        case "-": return a - b;
        case "*": return a * b;
        // Division med noll ger Infinity i JavaScript, som sedan förorenar
        // varje summa. Motorn fångar det per iteration (se motor.ts) - här
        // returneras det oförändrat, för att felet ska gå att se.
        case "/": return a / b;
        case "%": return a % b;
        case "^": return Math.pow(a, b);
        case "<": return a < b ? 1 : 0;
        case "<=": return a <= b ? 1 : 0;
        case ">": return a > b ? 1 : 0;
        case ">=": return a >= b ? 1 : 0;
        case "==": return a === b ? 1 : 0;
        case "!=": return a !== b ? 1 : 0;
        case "&&": return a !== 0 && b !== 0 ? 1 : 0;
        case "||": return a !== 0 || b !== 0 ? 1 : 0;
      }
    }
  }
};

/**
 * Namnen ett uttryck läser.
 *
 * Används för att pröva en modell INNAN den körs: refererar den en
 * variabel som inte finns ska det sägas vid sparandet, inte upptäckas på
 * iteration 1 av en miljon.
 */
export const variablerI = (nod: Nod, ut = new Set<string>()): Set<string> => {
  switch (nod.sort) {
    case "variabel":
      ut.add(nod.namn);
      break;
    case "unar":
      variablerI(nod.av, ut);
      break;
    case "binar":
      variablerI(nod.vanster, ut);
      variablerI(nod.hoger, ut);
      break;
    case "anrop":
      for (const a of nod.argument) variablerI(a, ut);
      break;
    case "tal":
      break;
  }
  return ut;
};

/* ==========================================================================
   src/lib/montecarlo/motor.ts
   ========================================================================== */

/**
 * SIMULERINGSMOTORN.
 *
 * Kedjan, i den ordning den körs:
 *
 *   spec -> validering -> sampling -> beräkning -> statistik
 *        -> känslighet -> konvergens -> kvalitetskontroll
 *
 * Fyra beslut i den här filen är värda att kunna försvara, för de styr
 * vad som är sant om resultatet:
 *
 * 1. MINNET VÄXER INTE MED ANTALET INPUTS. Outputserierna sparas i sin
 *    helhet (percentiler kräver sorterade sampel), men INPUTSAMPLEN sparas
 *    bara som ett begränsat urval - se URVAL_FOR_KANSLIGHET. Vid en miljon
 *    iterationer och tio inputs hade fullständiga inputserier kostat 80 MB
 *    utan att göra känslighetsanalysen mätbart bättre: en rangkorrelation
 *    på 20 000 par har ett standardfel kring 0,007, vilket är långt under
 *    den upplösning en rangordning behöver.
 *
 * 2. AVBROTT OCH FRAMSTEG KRÄVER BATCHAR. Slingan lämnar ifrån sig
 *    kontrollen mellan batchar. Utan det kan en körning varken avbrytas
 *    eller rapportera framsteg, och i en webbläsare fryser fliken.
 *
 * 3. OGILTIGA TAL FÅR ALDRIG BLI ETT RESULTAT. En division med noll ger
 *    Infinity, som sedan förorenar medelvärdet. Varje beräknat värde prövas,
 *    och en körning med ogiltiga tal RAPPORTERAR dem i stället för att
 *    tyst leverera en fördelning som ser rimlig ut.
 *
 * 4. KONVERGENS MÄTS UNDER KÖRNINGEN, inte efteråt. Delsummor tas vid
 *    bestämda avstämningspunkter, så att frågan "räckte antalet
 *    iterationer?" kan besvaras utan att köra om.
 */

/**
 * MOTORNS VERSION.
 *
 * Sparas med varje körning. Ändras samplingen, ordningen dragningar sker i,
 * eller någon fördelnings implementation, så ändras den här - och då är ett
 * gammalt resultat inte längre reproducerbart med den nya koden. Att låtsas
 * annat vore att lova något som inte håller.
 */
export const MOTORVERSION = "1.0.0";

/** Så många inputsampel behålls för känslighetsanalysen. Se filens punkt 1. */
export const URVAL_FOR_KANSLIGHET = 20000;

/** Iterationer mellan varje avbrotts- och framstegskontroll. */
const BATCH = 25000;

/* -------------------------------------------------------------------------- */
/* Specifikationen                                                            */
/* -------------------------------------------------------------------------- */

export interface Inputvariabel {
  /** Namnet som används i uttrycken. Måste vara ett giltigt variabelnamn. */
  namn: string;
  /** Läsbar etikett för gränssnittet. */
  etikett?: string;
  fordelning: Fordelning;
  /** Enhet, t.ex. "kr" eller "st". Visas, räknas aldrig med. */
  enhet?: string;
  /** Var siffran kommer ifrån. Ett antagande utan källa är en gissning. */
  kalla?: string;
  /** Hur säker uppgiften är. Påverkar inget i räkningen - den ska synas. */
  tilltro?: "hog" | "medel" | "lag";
  beskrivning?: string;
}

export interface Outputdefinition {
  namn: string;
  etikett?: string;
  /** Uttrycket, som text. Se uttryck.ts. */
  uttryck: string;
  enhet?: string;
  /** Målvärdet, om ett finns. Sannolikheten att nå det räknas ut. */
  mal?: number | null;
  /** Kritisk gräns. Sannolikheten att hamna UNDER den räknas ut. */
  kritiskGrans?: number | null;
}

export interface Simuleringsspec {
  namn: string;
  inputs: Inputvariabel[];
  outputs: Outputdefinition[];
  iterationer: number;
  /** Fröet. Utan det går körningen inte att upprepa. */
  fro: number;
  /** Konstanter som uttrycken får läsa, utöver inputvariablerna. */
  konstanter?: Record<string, number>;
}

/* -------------------------------------------------------------------------- */
/* Resultatet                                                                 */
/* -------------------------------------------------------------------------- */

export interface Sannolikheter {
  /** Sannolikheten att nå eller överträffa målet. null när mål saknas. */
  narMal: number | null;
  /** Sannolikheten att hamna under den kritiska gränsen. */
  underKritisk: number | null;
  /** Sannolikheten för ett negativt utfall. Alltid meningsfull. */
  negativt: number;
}

export interface Kanslighet {
  input: string;
  /** Spearmans rangkorrelation mot outputen. -1..1. */
  rangkorrelation: number;
  /**
   * Andel av den förklarade variationen, 0..1. Kvadrerad korrelation
   * normaliserad över alla inputs - det som visas som procent i listan.
   */
  andelAvVariation: number;
}

export interface Konvergenspunkt {
  iterationer: number;
  medel: number;
  p10: number;
  median: number;
  p90: number;
}

export interface Outputresultat {
  namn: string;
  etikett: string;
  enhet: string | null;
  statistik: Statistik;
  sannolikheter: Sannolikheter;
  histogram: Histogram;
  kanslighet: Kanslighet[];
  konvergens: Konvergenspunkt[];
  /**
   * Sant när de sista avstämningarna ligger stilla. Falskt = kör fler
   * iterationer innan resultatet används som underlag.
   */
  stabil: boolean;
  mal: number | null;
  kritiskGrans: number | null;
}

export interface Kvalitetsanmarkning {
  allvar: "fel" | "varning";
  kod: string;
  meddelande: string;
}

export interface Simuleringsresultat {
  motorversion: string;
  fro: number;
  iterationer: number;
  /** Millisekunder. Mäts av anroparen och skickas in - ren funktion här. */
  varaktighetMs: number;
  outputs: Outputresultat[];
  anmarkningar: Kvalitetsanmarkning[];
  /** Antal iterationer som gav ogiltiga tal och uteslöts. */
  forkastadeIterationer: number;
}

export interface Korningsval {
  /** Anropas mellan batchar. Returnerar false för att avbryta. */
  framsteg?: (klart: number, av: number) => boolean | void;
  /** Avbryter körningen. Prövas mellan batchar. */
  avbrutet?: () => boolean;
}

export class Avbruten extends Error {
  constructor() {
    super("Simuleringen avbröts.");
    this.name = "Avbruten";
  }
}

/* -------------------------------------------------------------------------- */
/* Validering                                                                 */
/* -------------------------------------------------------------------------- */

export interface Specfel {
  var: string;
  meddelande: string;
}

/** Ett giltigt variabelnamn: bokstav eller _, sedan bokstäver/siffror/_. */
const NAMNFORM = /^[A-Za-zÅÄÖåäö_][A-Za-zÅÄÖåäö0-9_]*$/;

/**
 * Prövar hela specifikationen INNAN en enda dragning sker.
 *
 * Tom lista = kör. Allt annat ska visas för användaren, för det finns
 * ingen körning som kan rädda en modell som refererar en variabel som
 * inte finns.
 */
export const valideraSpec = (spec: Simuleringsspec): Specfel[] => {
  const fel: Specfel[] = [];

  if (!spec.namn || spec.namn.trim().length === 0) {
    fel.push({ var: "namn", meddelande: "Simuleringen behöver ett namn." });
  }
  if (!Number.isInteger(spec.iterationer) || spec.iterationer < 100) {
    fel.push({
      var: "iterationer",
      meddelande:
        "Antalet iterationer måste vara ett heltal på minst 100. Under det är percentilerna för skakiga för att visa.",
    });
  }
  if (!Number.isInteger(spec.fro)) {
    fel.push({ var: "fro", meddelande: "Fröet måste vara ett heltal - annars går körningen inte att upprepa." });
  }
  if (spec.inputs.length === 0) {
    fel.push({ var: "inputs", meddelande: "Simuleringen behöver minst en inputvariabel." });
  }
  if (spec.outputs.length === 0) {
    fel.push({ var: "outputs", meddelande: "Simuleringen behöver minst ett resultat att räkna fram." });
  }

  const namn = new Set<string>();
  for (const [i, inp] of spec.inputs.entries()) {
    if (!NAMNFORM.test(inp.namn ?? "")) {
      fel.push({
        var: `inputs[${i}].namn`,
        meddelande: `"${inp.namn}" är inte ett giltigt variabelnamn. Använd bokstäver, siffror och understreck, och börja inte med en siffra.`,
      });
      continue;
    }
    if (namn.has(inp.namn)) {
      fel.push({ var: `inputs[${i}].namn`, meddelande: `Variabelnamnet "${inp.namn}" används mer än en gång.` });
    }
    namn.add(inp.namn);
    for (const f of validera(inp.fordelning)) {
      fel.push({ var: `inputs[${i}].fordelning.${f.parameter}`, meddelande: `${inp.namn}: ${f.meddelande}` });
    }
  }
  for (const konstant of Object.keys(spec.konstanter ?? {})) {
    if (!NAMNFORM.test(konstant)) {
      fel.push({ var: `konstanter.${konstant}`, meddelande: `"${konstant}" är inte ett giltigt namn.` });
    }
    if (namn.has(konstant)) {
      fel.push({ var: `konstanter.${konstant}`, meddelande: `"${konstant}" är både input och konstant.` });
    }
    const v = (spec.konstanter ?? {})[konstant];
    if (!Number.isFinite(v)) {
      fel.push({ var: `konstanter.${konstant}`, meddelande: `Konstanten "${konstant}" är inte ett ändligt tal.` });
    }
    namn.add(konstant);
  }

  const outputnamn = new Set<string>();
  for (const [i, ut] of spec.outputs.entries()) {
    if (!NAMNFORM.test(ut.namn ?? "")) {
      fel.push({ var: `outputs[${i}].namn`, meddelande: `"${ut.namn}" är inte ett giltigt namn.` });
    }
    if (outputnamn.has(ut.namn)) {
      fel.push({ var: `outputs[${i}].namn`, meddelande: `Resultatnamnet "${ut.namn}" används mer än en gång.` });
    }
    outputnamn.add(ut.namn);

    let trad: Nod;
    try {
      trad = tolka(ut.uttryck ?? "");
    } catch (e) {
      fel.push({
        var: `outputs[${i}].uttryck`,
        meddelande:
          e instanceof UttrycksFel
            ? `${ut.namn}: ${e.message} (tecken ${e.position + 1})`
            : `${ut.namn}: uttrycket kunde inte tolkas.`,
      });
      continue;
    }
    // Ett tidigare resultat får användas som led i ett senare - men bara
    // ett som redan räknats, annars vore modellen cirkulär.
    for (const anvand of variablerI(trad)) {
      if (!namn.has(anvand) && !outputnamn.has(anvand)) {
        fel.push({
          var: `outputs[${i}].uttryck`,
          meddelande: `${ut.namn}: variabeln "${anvand}" finns varken som input, konstant eller tidigare resultat.`,
        });
      }
      if (anvand === ut.namn) {
        fel.push({ var: `outputs[${i}].uttryck`, meddelande: `${ut.namn} refererar till sig själv.` });
      }
    }
  }
  return fel;
};

/* -------------------------------------------------------------------------- */
/* Körningen                                                                  */
/* -------------------------------------------------------------------------- */

/** Avstämningspunkter för konvergens, som andelar av hela körningen. */
const KONVERGENSSTEG = [0.05, 0.1, 0.25, 0.5, 0.75, 1];

/**
 * Kör simuleringen.
 *
 * SYNKRON MED FRIVILLIGA ANDNINGSPAUSER: anroparen får kontrollen mellan
 * batchar genom `framsteg`/`avbrutet` och kan där välja att lämna över till
 * eventloopen. Att göra funktionen själv asynkron hade tvingat på varje
 * anropare ett await per batch utan att ge något - och gjort den svårare
 * att pröva.
 */
export const kor = (
  spec: Simuleringsspec,
  val: Korningsval = {},
): Simuleringsresultat => {
  const fel = valideraSpec(spec);
  if (fel.length > 0) {
    throw new Error(
      `Simuleringen kan inte köras: ${fel.map((f) => f.meddelande).join(" ")}`,
    );
  }

  const start = Date.now();
  const N = spec.iterationer;
  const strom = new Slumpstrom(spec.fro);
  const trad = spec.outputs.map((o) => tolka(o.uttryck));

  // Outputserierna i sin helhet - percentiler kräver sorterade sampel.
  const utserier = spec.outputs.map(() => new Float64Array(N));
  // Inputurvalet för känslighet. Se filens punkt 1.
  const urvalStorlek = Math.min(N, URVAL_FOR_KANSLIGHET);
  const insamplade = spec.inputs.map(() => new Float64Array(urvalStorlek));
  const urvalUt = spec.outputs.map(() => new Float64Array(urvalStorlek));
  // Var n:te iteration sparas, jämnt fördelat över hela körningen - inte de
  // första 20 000, som hade missat allt en senare del av strömmen gör.
  const urvalSteg = Math.max(1, Math.floor(N / urvalStorlek));

  const konvergenspunkter: number[] = KONVERGENSSTEG.map((andel) =>
    Math.max(100, Math.min(N, Math.floor(N * andel))),
  ).filter((v, i, a) => a.indexOf(v) === i);
  const konvergens: Konvergenspunkt[][] = spec.outputs.map(() => []);

  const varden = new Map<string, number>();
  for (const [k, v] of Object.entries(spec.konstanter ?? {})) varden.set(k, v);

  let forkastade = 0;
  let skrivna = 0;
  let urvalSkrivna = 0;
  let naJamforKonvergens = 0;

  for (let block = 0; block < N; block += BATCH) {
    const slut = Math.min(N, block + BATCH);
    for (let i = block; i < slut; i++) {
      // 1. Dra alla inputs. ALLTID i samma ordning - ordningen är en del av
      //    reproducerbarheten, för strömmen är sekventiell.
      let giltig = true;
      for (let k = 0; k < spec.inputs.length; k++) {
        const v = sampla(spec.inputs[k].fordelning, strom);
        if (!Number.isFinite(v)) giltig = false;
        varden.set(spec.inputs[k].namn, v);
      }

      // 2. Räkna resultaten i ordning. Ett senare får läsa ett tidigare.
      if (giltig) {
        for (let k = 0; k < trad.length; k++) {
          let v: number;
          try {
            v = berakna(trad[k], varden);
          } catch {
            v = Number.NaN;
          }
          if (!Number.isFinite(v)) {
            giltig = false;
            break;
          }
          varden.set(spec.outputs[k].namn, v);
        }
      }

      if (!giltig) {
        // Iterationen kastas, men RÄKNAS. En körning där hälften föll bort
        // är inte samma sak som en där allt gick igenom, och skillnaden
        // ska synas i anmärkningarna.
        forkastade++;
        continue;
      }

      for (let k = 0; k < trad.length; k++) {
        utserier[k][skrivna] = varden.get(spec.outputs[k].namn) as number;
      }
      if (urvalSkrivna < urvalStorlek && i % urvalSteg === 0) {
        for (let k = 0; k < spec.inputs.length; k++) {
          insamplade[k][urvalSkrivna] = varden.get(spec.inputs[k].namn) as number;
        }
        for (let k = 0; k < trad.length; k++) {
          urvalUt[k][urvalSkrivna] = varden.get(spec.outputs[k].namn) as number;
        }
        urvalSkrivna++;
      }
      skrivna++;

      // Konvergensavstämning: en sortering av det som skrivits hittills.
      if (
        naJamforKonvergens < konvergenspunkter.length &&
        skrivna >= konvergenspunkter[naJamforKonvergens]
      ) {
        for (let k = 0; k < trad.length; k++) {
          const hittills = utserier[k].slice(0, skrivna);
          hittills.sort();
          let summa = 0;
          for (let j = 0; j < hittills.length; j++) summa += hittills[j];
          konvergens[k].push({
            iterationer: skrivna,
            medel: summa / hittills.length,
            p10: percentil(hittills, 0.1),
            median: percentil(hittills, 0.5),
            p90: percentil(hittills, 0.9),
          });
        }
        naJamforKonvergens++;
      }
    }

    if (val.avbrutet?.()) throw new Avbruten();
    if (val.framsteg?.(slut, N) === false) throw new Avbruten();
  }

  if (skrivna === 0) {
    throw new Error(
      "Alla iterationer gav ogiltiga tal. Kontrollera modellen - en division med noll eller en logaritm av ett negativt tal är de vanligaste orsakerna.",
    );
  }

  /* --- Statistik, sannolikheter, känslighet ------------------------------ */

  const outputs: Outputresultat[] = spec.outputs.map((def, k) => {
    const serie = utserier[k].slice(0, skrivna);
    serie.sort();

    const statistik = sammanfatta(serie);
    const mal = def.mal ?? null;
    const kritisk = def.kritiskGrans ?? null;

    const urvalUtK = urvalUt[k].slice(0, urvalSkrivna);
    const rakor = spec.inputs.map((inp, j) => ({
      input: inp.namn,
      rangkorrelation:
        urvalSkrivna >= 3 ? rangkorrelation(insamplade[j].slice(0, urvalSkrivna), urvalUtK) : 0,
      andelAvVariation: 0,
    }));
    // Andelen räknas på kvadrerad korrelation: det är den storhet som är
    // additiv i "förklarad variation". Summan normaliseras till 1 så att
    // listan går att läsa som procent - och den summan gäller BARA de
    // inputs som finns med, inte all variation i världen.
    const summaKvad = rakor.reduce((a, r) => a + r.rangkorrelation ** 2, 0);
    for (const r of rakor) {
      r.andelAvVariation = summaKvad > 0 ? r.rangkorrelation ** 2 / summaKvad : 0;
    }
    rakor.sort((a, b) => b.andelAvVariation - a.andelAvVariation);

    return {
      namn: def.namn,
      etikett: def.etikett ?? def.namn,
      enhet: def.enhet ?? null,
      statistik,
      sannolikheter: {
        narMal: mal === null ? null : sannolikhetMinst(serie, mal),
        underKritisk: kritisk === null ? null : sannolikhetUnder(serie, kritisk),
        negativt: sannolikhetUnder(serie, 0),
      },
      histogram: histogram(serie),
      kanslighet: rakor,
      konvergens: konvergens[k],
      stabil: arStabil(konvergens[k]),
      mal,
      kritiskGrans: kritisk,
    };
  });

  return {
    motorversion: MOTORVERSION,
    fro: spec.fro,
    iterationer: skrivna,
    varaktighetMs: Date.now() - start,
    outputs,
    anmarkningar: granska(spec, outputs, skrivna, forkastade),
    forkastadeIterationer: forkastade,
  };
};

/* -------------------------------------------------------------------------- */
/* Konvergens och kvalitet                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Har medianen och svansarna lagt sig?
 *
 * Jämför de två sista avstämningarna. Rör sig medianen eller P90 mer än en
 * procent av spannet mellan dem, räknas körningen som ostabil - då är
 * antalet iterationer för lågt för att percentilerna ska betyda något.
 *
 * En PROCENT AV SPANNET och inte av värdet: ett resultat som pendlar kring
 * noll hade annars alltid sett ostabilt ut, eftersom en relativ ändring mot
 * ett värde nära noll är godtyckligt stor.
 */
const arStabil = (punkter: Konvergenspunkt[]): boolean => {
  if (punkter.length < 2) return false;
  const sista = punkter[punkter.length - 1];
  const nastSista = punkter[punkter.length - 2];
  const spann = Math.abs(sista.p90 - sista.p10);
  if (spann === 0) return true; // Ingen spridning alls: inget att stabilisera.
  const rorMedian = Math.abs(sista.median - nastSista.median) / spann;
  const rorP90 = Math.abs(sista.p90 - nastSista.p90) / spann;
  const rorP10 = Math.abs(sista.p10 - nastSista.p10) / spann;
  return rorMedian < 0.01 && rorP90 < 0.02 && rorP10 < 0.02;
};

/**
 * Kvalitetskontrollen.
 *
 * Motorn ska ALDRIG tyst leverera ett resultat som är statistiskt eller
 * numeriskt tvivelaktigt. Anmärkningarna följer med resultatet hela vägen
 * ut i gränssnittet.
 */
const granska = (
  spec: Simuleringsspec,
  outputs: Outputresultat[],
  skrivna: number,
  forkastade: number,
): Kvalitetsanmarkning[] => {
  const anm: Kvalitetsanmarkning[] = [];

  if (forkastade > 0) {
    const andel = forkastade / (skrivna + forkastade);
    anm.push({
      allvar: andel > 0.01 ? "fel" : "varning",
      kod: "ogiltiga_iterationer",
      meddelande:
        `${forkastade.toLocaleString("sv-SE")} av ${(skrivna + forkastade).toLocaleString("sv-SE")} iterationer ` +
        `(${(andel * 100).toFixed(1)} %) gav ogiltiga tal och uteslöts. ` +
        "Vanligast är division med noll eller logaritm av ett icke-positivt tal.",
    });
  }

  if (skrivna < 1000) {
    anm.push({
      allvar: "varning",
      kod: "fa_iterationer",
      meddelande:
        `Endast ${skrivna.toLocaleString("sv-SE")} giltiga iterationer. Svanspercentilerna (P5, P95, P99) ` +
        "vilar då på mycket få observationer och bör inte användas som beslutsunderlag.",
    });
  }

  for (const ut of outputs) {
    if (!ut.stabil) {
      anm.push({
        allvar: "varning",
        kod: "ostabil_konvergens",
        meddelande:
          `${ut.etikett}: fördelningen rörde sig fortfarande mellan de två sista avstämningarna. ` +
          "Kör fler iterationer innan resultatet används.",
      });
    }
    if (ut.statistik.standardavvikelse === 0) {
      anm.push({
        allvar: "varning",
        kod: "ingen_spridning",
        meddelande:
          `${ut.etikett} fick samma värde i varje iteration. Modellen använder ingen av de osäkra ` +
          "variablerna, eller så saknar de spridning - då tillför simuleringen ingenting.",
      });
    }
    // En input som inte påverkar något är inte fel, men det är värt att veta.
    const utanPaverkan = ut.kanslighet.filter((k) => Math.abs(k.rangkorrelation) < 0.01);
    if (utanPaverkan.length === spec.inputs.length && spec.inputs.length > 0) {
      anm.push({
        allvar: "varning",
        kod: "ingen_koppling",
        meddelande: `${ut.etikett} påverkas inte mätbart av någon av inputvariablerna.`,
      });
    }
  }

  return anm;
};

/* -------------------------------------------------------------------------- */
/* Var körningen hör hemma                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Ska körningen ske direkt eller köas?
 *
 * En körning på 25 000 iterationer tar tiotals millisekunder och kan göras
 * i förfrågans egen tur. En på en miljon tar sekunder - och API:t är EN
 * process: sekunder i en handler betyder sekunder av kö för alla andras
 * anrop. Sådana körningar hör hemma i den betrodda arbetaren, samma
 * mönster som utkorgen och aviseringarna.
 *
 * Tröskeln är en driftparameter i tanken men en konstant i koden: den
 * hänger ihop med hur motorn presterar, inte med hur produkten prissätts.
 */
export const TROSKEL_FOR_KO = 50000;

export const korDirekt = (iterationer: number): boolean => iterationer <= TROSKEL_FOR_KO;

/**
 * Ett frö att spara med körningen, när användaren inte angett ett eget.
 * Väljs EN gång, skrivs ned, och används sedan varje gång körningen
 * upprepas.
 */

/* ==========================================================================
   src/lib/notifications.ts
   ========================================================================== */

/**
 * Notiscentret: allt som väntar på användaren, från alla källor.
 *
 * Klockan visade tidigare bara taggade meddelanden - och kunde därmed säga
 * "inget väntar på dig" bredvid en systemanalys som visade kritiskt läge.
 * En notisklocka som inte känner till fristerna är värre än ingen klocka:
 * den lär användaren att tystnad betyder lugn.
 *
 * Aggregatorn är deterministisk och rangordnar efter allvar: passerade
 * frister först, sedan dagens, sedan taggar, sedan händelser och
 * driftlarm. Varje notis pekar dit saken hanteras.
 */

export interface NotificationItem {
  id: string;
  tone: "critical" | "warning" | "info";
  title: string;
  body: string;
  href: string;
  /**
   * Räknas raden i klockans siffra?
   *
   * Bara det som faktiskt KRÄVER något av användaren. Klockan sa tidigare
   * "3 meddelanden väntar på ditt svar" om en lista där en av raderna
   * själv skrev "inget kräver åtgärd i dag" - och en siffra som räknar
   * sådant lär användaren att siffran inte betyder något. Då är den
   * värdelös just den dag den betyder allt.
   *
   * Raderna som inte räknas visas fortfarande. Att veta att nästa frist
   * ligger om åtta dagar är värdefullt; det är bara inte ett krav.
   */
  demandsAction: boolean;
}

/**
 * Radens fingeravtryck: identitet PLUS det som gör den angelägen.
 *
 * Läst-status hänger på den här, inte bara på id:t. En frist som går
 * från "om tre dagar" till "förfaller idag" har samma id men är ny
 * information - och ska därför bli oläst igen. Att kvittera en notis
 * en gång ska inte tysta hela dess upptrappning.
 */
export const signatureOf = (item: NotificationItem): string =>
  `${item.id}|${item.tone}|${item.title}`;

export interface NotificationInput {
  caseRecord: CaseRecord | null;
  /**
   * Systemanalysens bedömning av ärendet. Utan den kan klockan stå tom
   * bredvid ett kritiskt läge - fristerna kan ligga veckor bort samtidigt
   * som läget i sig kräver beslut i dag.
   */
  crisis: { urgency: Urgency; title: string } | null;
  timeline: TimelineEvent[];
  mentions: OpenMention[];
  invitations: CaseInvitationRecord[];
  /** Öppna uppgifter i ärendet som är delegerade till den inloggade. */
  assignedOpenTasks?: number;
  kbr: { status: KbrStatus; createdAt: string } | null;
  /** Endast för driftadministratörer; annars tomma. */
  failedEmails: OutboundEmailRecord[];
  pendingApplications: number;
  newContactMessages: number;
  pendingProfileClaims: number;
  now: Date;
}

const TONE_ORDER = { critical: 0, warning: 1, info: 2 } as const;

export const buildNotifications = (input: NotificationInput): NotificationItem[] => {
  const items: NotificationItem[] = [];
  const { now } = input;

  // Ärendets läge enligt systemanalysen. "Månader" är planeringshorisont
  // och larmar inte - klockan ska peka på det som kräver något nu.
  if (input.crisis?.urgency === "immediate") {
    items.push({
      id: "laget-akut",
      tone: "critical",
      demandsAction: true,
      title: "Läget kräver omedelbara åtgärder",
      body: `Systemanalysen bedömer: ${input.crisis.title}.`,
      href: "/dashboard#systemanalys",
    });
  } else if (input.crisis?.urgency === "weeks") {
    items.push({
      id: "laget-veckor",
      demandsAction: true,
      tone: "warning",
      title: "Läget kräver åtgärder inom veckor",
      body: `Systemanalysen bedömer: ${input.crisis.title}.`,
      href: "/dashboard#systemanalys",
    });
  }

  // Fristerna: passerade och nära.
  let nearFrist = false;
  for (const event of input.timeline) {
    const countdown = countdownTo(event.iso, now);
    if (countdown.tone === "passed") {
      nearFrist = true;
      items.push({
        id: `frist-passerad-${event.iso}-${event.label}`,
        demandsAction: true,
        tone: "critical",
        title: `Passerad frist: ${event.label.toLowerCase()}`,
        body: `Datumet passerade ${countdown.label} utan registrerad åtgärd.`,
        href: "/dashboard#frister",
      });
    } else if (countdown.tone === "today") {
      nearFrist = true;
      items.push({
        id: `frist-idag-${event.iso}-${event.label}`,
        demandsAction: true,
        tone: "critical",
        title: `Förfaller idag: ${event.label.toLowerCase()}`,
        body: "Sista dagen att agera eller dokumentera beslutet.",
        href: "/dashboard#frister",
      });
    } else if (countdown.daysLeft <= 3) {
      nearFrist = true;
      items.push({
        id: `frist-snart-${event.iso}-${event.label}`,
        demandsAction: true,
        tone: "warning",
        title: `${event.label} ${countdown.label}`,
        body: "Planera åtgärden nu - handlingsutrymmet krymper med datumet.",
        href: "/dashboard#frister",
      });
    }
  }

  // Inget nära? Då pekar klockan ändå ut nästa bevakade frist, så att
  // "inga notiser" aldrig kan misstas för "inga frister".
  if (!nearFrist) {
    const upcoming = input.timeline
      .map((event) => ({ event, countdown: countdownTo(event.iso, now) }))
      .filter(({ countdown }) => countdown.tone !== "passed" && countdown.daysLeft > 3)
      .sort((a, b) => a.countdown.daysLeft - b.countdown.daysLeft)[0];
    if (upcoming) {
      items.push({
        id: `frist-nasta-${upcoming.event.iso}-${upcoming.event.label}`,
        // Raden säger själv "inget kräver åtgärd i dag". Då får den
        // inte räknas som ett krav.
        demandsAction: false,
        tone: "info",
        title: `Nästa frist: ${upcoming.event.label.toLowerCase()} ${upcoming.countdown.label}`,
        body: "Bevakas i tidslinjen - inget kräver åtgärd i dag.",
        href: "/dashboard#frister",
      });
    }
  }

  // KBR-läget.
  if (input.kbr && (input.kbr.status === "required" || input.kbr.status === "critical")) {
    items.push({
      id: "kbr-laget",
      demandsAction: true,
      tone: "critical",
      title: input.kbr.status === "critical" ? "Kontrollbalans: kritisk" : "Kontrollbalansräkning krävs",
      body: "Bedömningen visar kapitalbrist. Protokollför styrelsens beslut och följ stämmospåret.",
      href: "/kbr",
    });
  }

  // Uppgifter delegerade till den inloggade. Samma kategori som taggarna:
  // det är samarbetets "du är efterfrågad", inte ärendets läge.
  if ((input.assignedOpenTasks ?? 0) > 0) {
    const n = input.assignedOpenTasks!;
    items.push({
      id: "mention-uppgifter-tilldelade",
      demandsAction: true,
      tone: "warning",
      title: n === 1 ? "En uppgift är tilldelad dig" : `${n} uppgifter är tilldelade dig`,
      body: "Öppna handlingsplanen och bocka av när de är gjorda.",
      href: "/dashboard#frister",
    });
  }

  // Taggade meddelanden.
  for (const mention of input.mentions) {
    items.push({
      id: `mention-${mention.messageId}`,
      demandsAction: true,
      tone: "warning",
      title: `${mention.authorName ?? "Någon"} väntar på ditt svar`,
      body: mention.conversationTitle ? `I ${mention.conversationTitle}: ${mention.body}` : mention.body,
      href: "/dashboard/meddelanden",
    });
  }

  // Inbjudningar som fått svar senaste veckan.
  for (const invitation of input.invitations) {
    if (!invitation.acceptedAt) continue;
    const days = (now.getTime() - new Date(invitation.acceptedAt).getTime()) / 86_400_000;
    if (days <= 7) {
      items.push({
        id: `invit-accept-${invitation.id}`,
        // Ett svar som redan kommit kräver ingenting av mottagaren.
        demandsAction: false,
        tone: "info",
        title: `${invitation.email} tackade ja`,
        body: "Deltagaren är nu inne i ärendet och ser samma underlag som du.",
        href: "/dashboard/deltagare",
      });
    }
  }

  // Driftlarm - bara för administratörer, listorna är annars tomma.
  if (input.failedEmails.length > 0) {
    items.push({
      id: "drift-utskick",
      demandsAction: true,
      tone: "critical",
      title: `${input.failedEmails.length} utskick har misslyckats`,
      body: "Mejl som inte gått fram väntar på omskick i driftvyn.",
      href: "/admin/kunder",
    });
  }
  if (input.newContactMessages > 0) {
    items.push({
      id: "drift-inkorg",
      demandsAction: true,
      tone: "warning",
      title: `${input.newContactMessages} nya meddelanden i inkorgen`,
      body: "Någon har hört av sig via kontaktformuläret.",
      href: "/admin/inkorg",
    });
  }
  if (input.pendingApplications > 0) {
    items.push({
      id: "drift-ansokningar",
      demandsAction: true,
      tone: "info",
      title: `${input.pendingApplications} rådgivare väntar på besked`,
      body: "Ansökningar att granska i driftvyn.",
      href: "/admin/ansokningar",
    });
  }
  if (input.pendingProfileClaims > 0) {
    items.push({
      id: "drift-anspråk",
      demandsAction: true,
      tone: "info",
      title: `${input.pendingProfileClaims} profilanspråk att granska`,
      body: "Någon säger sig företräda en förifylld katalogprofil.",
      href: "/admin",
    });
  }

  return items.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
};

/* --- notisinställningar ---------------------------------------------------- */

/**
 * Vilka källor klockan visar - ett val per enhet, sparat lokalt. Frister
 * och ärendets läge går INTE att stänga av: en notisklocka som kan tystas
 * om det juridiskt kritiska vore ett sämre löfte än ingen klocka alls.
 * Det som går att välja bort är det sociala och driften.
 */
export type NotificationCategory = "läge" | "samarbete" | "drift";

export const OPTIONAL_CATEGORIES: { id: Exclude<NotificationCategory, "läge">; label: string; description: string }[] = [
  {
    id: "samarbete",
    label: "Meddelanden och deltagare",
    description: "Taggade meddelanden som väntar på ditt svar och deltagare som tackat ja.",
  },
  {
    id: "drift",
    label: "Driftlarm",
    description: "Misslyckade utskick, ny inkorg, ansökningar och profilanspråk. Gäller bara administratörer.",
  },
];

export const categoryOf = (id: string): NotificationCategory => {
  if (id.startsWith("mention-") || id.startsWith("invit-")) return "samarbete";
  if (id.startsWith("drift-")) return "drift";
  return "läge";
};

const PREFS_KEY = "clearance-notification-prefs";

export const getNotificationPrefs = (): Record<NotificationCategory, boolean> => {
  const all: Record<NotificationCategory, boolean> = { läge: true, samarbete: true, drift: true };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Record<NotificationCategory, boolean>>;
      for (const category of ["samarbete", "drift"] as const) {
        if (parsed[category] === false) all[category] = false;
      }
    }
  } catch {
    /* utan lagring: allt på */
  }
  return all;
};

export const setNotificationPref = (category: Exclude<NotificationCategory, "läge">, enabled: boolean): void => {
  try {
    const prefs = getNotificationPrefs();
    prefs[category] = enabled;
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent("clearance-notification-prefs"));
  } catch {
    /* utan lagring går valet inte att spara */
  }
};

export const filterNotifications = (
  items: NotificationItem[],
  prefs: Record<NotificationCategory, boolean> = getNotificationPrefs(),
): NotificationItem[] => items.filter((item) => prefs[categoryOf(item.id)]);

/* ==========================================================================
   src/lib/notifications/events.ts
   ========================================================================== */

/**
 * AVISERINGSTJÄNSTEN: händelser, kanaler och regler.
 *
 * Den befintliga notiscentret (src/lib/notifications.ts) HÄRLEDER sitt
 * innehåll ur nuläget vid varje rendering. Det är rätt för en klocka i
 * appen - klockan ska visa det som gäller nu, och nuläget är sanningen.
 *
 * Men det går inte att skicka på. Ett SMS är oåterkalleligt: skickas det
 * två gånger har mottagaren fått två, och en produkt som tjatar mitt i en
 * kris blir avstängd. Därför är en AVISERING något annat än en notis: den
 * har en identitet, och identiteten är det som gör att den skickas exakt
 * en gång.
 *
 * Identiteten är `dedupeKey` nedan. Den byggs av vad händelsen gäller -
 * inte av när den upptäcktes - så att samma upptäckt gjord tio gånger
 * ger en avisering.
 *
 * Kanalerna är utbytbara med flit. SMS är den första betalda kanalen,
 * men reglerna i den här filen känner inte till någon leverantör: de
 * säger VAD som ska skickas och TILL VEM, och lämnar HUR till
 * arbetaren. Push kan läggas till utan att en enda regel skrivs om.
 */

/**
 * Raden i integration_secrets som bär SMS-nyckeln.
 *
 * Den står HÄR och ingen annanstans. Driftpanelen behöver den för att
 * kunna spara nyckeln, arbetaren för att kunna läsa den - och en sträng
 * som skrivs av på två ställen glider isär den dag leverantören byts.
 * tests/notificationService.ts faller om namnet dyker upp någon
 * annanstans i källkoden.
 */
export const SMS_SECRET_PROVIDER = "46elks";

/* --- Kanalerna ------------------------------------------------------------ */

export type Channel = "inapp" | "email" | "sms" | "push";

export interface ChannelSpec {
  id: Channel;
  label: string;
  /** Kort beskrivning för inställningssidan. */
  description: string;
  /**
   * Kanaler som ännu inte är i drift står som `false` och går inte att
   * välja. Att visa ett val som inte gör något är att ljuga tyst.
   */
  live: boolean;
}

export const CHANNELS: readonly ChannelSpec[] = [
  {
    id: "inapp",
    label: "I appen",
    description: "Klockan i menyn. Alltid på, för alla nivåer.",
    live: true,
  },
  {
    id: "email",
    label: "E-post",
    description: "Ett mejl till adressen du loggar in med.",
    live: true,
  },
  {
    id: "sms",
    label: "SMS",
    description: "Ett kort meddelande till din mobil, så du slipper logga in för att veta läget.",
    live: true,
  },
  {
    id: "push",
    label: "Push",
    description: "Notis i mobilappen. Finns inte än - appen är inte släppt.",
    live: false,
  },
];

export const channelSpec = (id: Channel): ChannelSpec =>
  CHANNELS.find((c) => c.id === id) ?? CHANNELS[0];

/* --- Händelserna ---------------------------------------------------------- */

/**
 * Hur brådskande händelsen är. Ordningen är inte kosmetisk - den styr
 * både vilka nivåer som får den och om den bryter tyst tid.
 */
export type Severity__notifications_events = "tidskritisk" | "atgard" | "information";

export type EventKind =
  /** En frist närmar sig. Tiden går oavsett vad användaren gör. */
  | "frist-narmar-sig"
  /** Ärendet kräver något av användaren för att komma vidare. */
  | "atgard-kravs"
  /** Systemanalysen har räknat om läget. */
  | "analys-klar"
  /** En handling har fått ett granskningsbeslut. */
  | "dokument-granskat"
  /** En rådgivare har skrivit i ärendet. */
  | "radgivare-kommenterat"
  /** Ärendet har bytt status. */
  | "arende-status"
  /** Processen har gått vidare till nästa steg. */
  | "steg-framat";

export interface EventSpec {
  kind: EventKind;
  severity: Severity__notifications_events;
  /** Vad raden heter i inställningarna och i journalen. */
  label: string;
}

export const EVENTS: readonly EventSpec[] = [
  { kind: "frist-narmar-sig", severity: "tidskritisk", label: "En tidsfrist närmar sig" },
  { kind: "atgard-kravs", severity: "atgard", label: "Något kräver din åtgärd" },
  { kind: "dokument-granskat", severity: "atgard", label: "En handling har granskats" },
  { kind: "radgivare-kommenterat", severity: "atgard", label: "En rådgivare har kommenterat" },
  { kind: "analys-klar", severity: "information", label: "En ny analys är klar" },
  { kind: "arende-status", severity: "information", label: "Ärendet har bytt status" },
  { kind: "steg-framat", severity: "information", label: "Processen har gått vidare" },
];

export const eventSpec = (kind: EventKind): EventSpec | null =>
  EVENTS.find((e) => e.kind === kind) ?? null;

export const severityOf = (kind: EventKind): Severity__notifications_events | null => eventSpec(kind)?.severity ?? null;

/* --- Användarens val ------------------------------------------------------ */

/**
 * De tre nivåerna. Fler val hade gett användaren mer kontroll på pappret
 * och mindre i praktiken: den som är mitt i en kris orkar inte kryssa i
 * sju rutor, och en inställningssida ingen orkar fylla i blir kvar på
 * förvalet.
 */
export type Level = "alla" | "atgard" | "tidskritiska";

export const LEVELS: readonly { id: Level; label: string; description: string }[] = [
  {
    id: "alla",
    label: "Alla viktiga händelser",
    description: "Även när något gått framåt av sig självt och inget krävs av dig.",
  },
  {
    id: "atgard",
    label: "Bara när något krävs av dig",
    description: "Frister, åtgärder, granskningsbeslut och kommentarer från rådgivare.",
  },
  {
    id: "tidskritiska",
    label: "Bara det tidskritiska",
    description: "Endast frister som närmar sig. Det minsta som går att välja.",
  },
];

/** Vilka allvarlighetsgrader varje nivå släpper igenom. */
const LEVEL_LETS_THROUGH: Record<Level, readonly Severity__notifications_events[]> = {
  alla: ["tidskritisk", "atgard", "information"],
  atgard: ["tidskritisk", "atgard"],
  tidskritiska: ["tidskritisk"],
};

export const levelAllows = (level: Level, kind: EventKind): boolean => {
  const severity = severityOf(kind);
  if (!severity) return false;
  return LEVEL_LETS_THROUGH[level].includes(severity);
};

/* --- Plangränsen ---------------------------------------------------------- */

/**
 * SMS är en betald kanal. Klockan i appen är det aldrig - att ta betalt
 * för att få veta att ens eget ärende ändrats vore att ta betalt för
 * produkten två gånger.
 *
 * Nivåerna heter Start, Standard, Business och Enterprise
 * (src/lib/pricing.ts). SMS bor i Business och uppåt, samma plats som
 * ekonomisystemskopplingen.
 */
export type PlanId = "start" | "standard" | "business" | "enterprise";

const PAID_SMS_PLANS: readonly PlanId[] = ["business", "enterprise"];

export const channelInPlan = (channel: Channel, plan: PlanId): boolean => {
  if (channel === "inapp") return true;
  if (channel === "email") return plan !== "start";
  if (channel === "sms") return PAID_SMS_PLANS.includes(plan);
  return false; // push: inte i drift
};

/** Texten som förklarar varför kanalen är låst, och vad som öppnar den. */
export const planGateReason = (channel: Channel, plan: PlanId): string | null => {
  if (channelInPlan(channel, plan)) return null;
  if (channel === "push") return "Push finns inte än. Mobilappen är inte släppt.";
  if (channel === "sms") {
    return "SMS ingår i Clearance Business och Enterprise. På din nivå finns klockan i appen och e-post.";
  }
  if (channel === "email") return "E-postaviseringar ingår från Clearance Standard.";
  return null;
};

/* --- Tyst tid ------------------------------------------------------------- */

/**
 * Ingen ska väckas 03:00 av att en handling blivit granskad.
 *
 * Men en frist som löper ut är inte samma sak som en granskning: den
 * tidskritiska händelsen BRYTER tyst tid, för alternativet är att
 * användaren sover genom det enda vi finns till för att förhindra. Det
 * är ett medvetet undantag och det står i inställningarna, så att ingen
 * blir överrumplad av det.
 *
 * Timmarna är halvöppna: start 21, slut 7 betyder 21:00-06:59.
 */
export interface QuietHours {
  /** Timme 0-23 när tystnaden börjar. */
  startHour: number;
  /** Timme 0-23 när den slutar. */
  endHour: number;
}

export const DEFAULT_QUIET_HOURS: QuietHours = { startHour: 21, endHour: 7 };

export const inQuietHours = (hour: number, quiet: QuietHours): boolean => {
  const { startHour: start, endHour: end } = quiet;
  if (start === end) return false; // ingen tyst tid alls
  // Passerar midnatt: 21 -> 7 är kvällen ELLER morgonen.
  if (start > end) return hour >= start || hour < end;
  return hour >= start && hour < end;
};

/**
 * Timmen hos mottagaren.
 *
 * Ingen tidszon lagras per användare, och produkten säljs i Sverige, så
 * Europe/Stockholm är antagandet. Det är ett ANTAGANDE och inte en
 * sanning: den som driver ett svenskt bolag från Spanien får sin tysta
 * tid enligt svensk klocka. Dagen vi säljer utanför Sverige behöver
 * notification_prefs en tidszonskolumn - och då byts den här funktionen,
 * inte reglerna omkring den.
 */
export const localHour = (at: Date, timeZone = "Europe/Stockholm"): number =>
  Number(
    new Intl.DateTimeFormat("sv-SE", { hour: "2-digit", hour12: false, timeZone }).format(at),
  ) % 24;

/**
 * När tystnaden tar slut. Används för att SKJUTA UPP i stället för att
 * slänga: ett besked som kommer 07:00 är fortfarande användbart.
 */
export const nextQuietEnd = (at: Date, quiet: QuietHours, timeZone = "Europe/Stockholm"): Date => {
  const hour = localHour(at, timeZone);
  if (!inQuietHours(hour, quiet)) return at;
  // Hur många timmar kvar till slutet, moduloräknat över midnatt.
  const hoursLeft = (quiet.endHour - hour + 24) % 24 || 24;
  const out = new Date(at.getTime() + hoursLeft * 3_600_000);
  // Ned till hel timme: ett besked 07:00 är begripligare än 07:43, och
  // exakthet på minuten betyder ingenting för den som sovit.
  out.setUTCMinutes(0, 0, 0);
  return out;
};

/* --- Beslutet ------------------------------------------------------------- */

export interface DeliveryDecision {
  /** Skickas den? */
  send: boolean;
  /**
   * Varför inte, när den inte skickas. Sparas på leveransraden så att
   * frågan "varför fick jag inget SMS" går att besvara utan gissningar.
   */
  reason:
    | null
    | "kanal-avstangd"
    | "utanfor-niva"
    | "ingar-inte-i-planen"
    | "tyst-tid"
    | "saknar-verifierat-nummer"
    | "kanalen-ar-inte-i-drift";
}

export interface DeliveryContext {
  kind: EventKind;
  channel: Channel;
  level: Level;
  plan: PlanId;
  /** Kanaler användaren stängt av helt. */
  enabledChannels: readonly Channel[];
  quiet: QuietHours;
  /** Lokal timme hos mottagaren, 0-23. */
  hour: number;
  /** Bara meningsfullt för SMS. */
  hasVerifiedPhone: boolean;
}

/**
 * En (1) funktion avgör om en avisering går ut. Att sprida ut villkoren
 * över arbetare, databas och gränssnitt hade gett tre halvregler som
 * hinner glida isär - och den som frågar "varför fick jag inget" hade
 * fått tre olika svar.
 */
export const decideDelivery = (ctx: DeliveryContext): DeliveryDecision => {
  const no = (reason: NonNullable<DeliveryDecision["reason"]>): DeliveryDecision => ({
    send: false,
    reason,
  });

  if (!channelSpec(ctx.channel).live) return no("kanalen-ar-inte-i-drift");
  if (!channelInPlan(ctx.channel, ctx.plan)) return no("ingar-inte-i-planen");

  // Klockan i appen är inte ett utskick: den kan inte väcka någon, och
  // den kan inte tjata. Den lyder därför varken under nivåvalet eller
  // tyst tid - allt hamnar där, och användaren läser när hen vill.
  if (ctx.channel === "inapp") return { send: true, reason: null };

  if (!ctx.enabledChannels.includes(ctx.channel)) return no("kanal-avstangd");
  if (!levelAllows(ctx.level, ctx.kind)) return no("utanfor-niva");
  if (ctx.channel === "sms" && !ctx.hasVerifiedPhone) return no("saknar-verifierat-nummer");

  // Tidskritiskt bryter tystnaden. Allt annat väntar.
  if (inQuietHours(ctx.hour, ctx.quiet) && severityOf(ctx.kind) !== "tidskritisk") {
    return no("tyst-tid");
  }

  return { send: true, reason: null };
};

/** Läsbar förklaring till ett uteblivet utskick. Visas i driftpanelen. */
export const REASON_TEXT: Record<NonNullable<DeliveryDecision["reason"]>, string> = {
  "kanal-avstangd": "Mottagaren har stängt av kanalen.",
  "utanfor-niva": "Händelsen ligger utanför mottagarens valda nivå.",
  "ingar-inte-i-planen": "Kanalen ingår inte i mottagarens abonnemang.",
  "tyst-tid": "Tyst tid. Händelsen var inte tidskritisk.",
  "saknar-verifierat-nummer": "Inget verifierat mobilnummer.",
  "kanalen-ar-inte-i-drift": "Kanalen är inte i drift.",
};

/* ==========================================================================
   src/lib/notifications/mailHtml.ts
   ========================================================================== */

/**
 * HTML:EN I AVISERINGSMEJLET.
 *
 * Aviseringsmejlet är den enda vägen ut ur systemet som bygger sin egen
 * HTML; allt annat går via src/lib/email/messages.ts, där varje värde
 * flyktas. Titel, brödtext och länk kommer ur notification_events, och den
 * tabellen ska fyllas av produktionskod med ärendenamn, dokumenttitlar och
 * avsändarnamn - text en användare har skrivit.
 *
 * VARFÖR DE HÄR TVÅ RADERNA BOR I EN EGEN MODUL i stället för i arbetaren:
 * en regel som bara finns inne i en arbetare går inte att pröva utan att
 * starta arbetaren, och ett prov som skriver av regeln prövar sin egen
 * avskrift. Det upptäcktes på det hårda sättet - en mutation som tog bort
 * länkkontrollen i arbetaren lämnade provet grönt.
 */

/** Flykt för text som ska stå i HTML. Samma uppsättning som mejlbyggarna. */
export const escHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Länken i mejlet får bara peka IN i produkten: en enkel snedstreckssökväg.
 *
 * Allt annat byts mot startsidan - javascript: och data: är angrepp, och
 * "//någon.annan" och "https://..." är utgångar ur produkten. Att säga "det
 * kan inte hända, vi skriver href själva" håller precis tills någon fyller
 * href ur ett användarfält.
 */
export const SAKER_LANK = /^\/[^/\\]/;

export const trygLank = (href: string): string => (SAKER_LANK.test(href) ? href : "/dashboard");

/* ==========================================================================
   src/lib/notifications/messages.ts
   ========================================================================== */

/**
 * Aviseringarnas text - och identitet.
 *
 * Två regler styr hur ett SMS från CLEARANCE är skrivet, och båda
 * kommer ur vad produkten handlar om.
 *
 * 1. DET STÅR ALDRIG VAD SOM ÄR FEL.
 *    Ett SMS landar på en låst skärm. "Ditt bolag riskerar konkurs" kan
 *    läsas av vem som helst som råkar titta ner på bordet under ett möte
 *    - en kund, en anställd, en långivare. Aviseringen säger därför ATT
 *    något behöver uppmärksamhet och VAR det finns, aldrig VAD det är.
 *    Detaljerna kräver inloggning. Det är inte försiktighet för dess
 *    egen skull: en produkt som läcker sitt eget ämne i förbifarten är
 *    inte användbar för den som har mest att förlora.
 *
 * 2. INGA SIFFROR OM PENGAR, INGA BOLAGSNAMN, INGA PERSONNAMN.
 *    Samma skäl. Ärendets referens räcker för att veta vilket ärende det
 *    gäller, för den som har flera.
 *
 * Till det kommer det praktiska: ett SMS är 160 tecken. Längre än så
 * delas det i flera, och flera kostar mer utan att säga mer.
 */

/** Taket för ett SMS-segment i GSM-7. Över det delas meddelandet. */
export const SMS_SEGMENT_LIMIT = 160;

export interface NotificationMessage {
  /** Klockan i appen och e-postens ärenderad. */
  title: string;
  /** Klockan i appen och e-postens brödtext. Får vara utförlig. */
  body: string;
  /** SMS:et. Kort, utan detaljer om vad saken gäller. */
  sms: string;
  /** Var i produkten svaret finns. */
  href: string;
}

export interface MessageInput {
  kind: EventKind;
  /**
   * Ärendets korta referens, t.ex. "A-241". Utelämnas när mottagaren
   * bara har ett ärende - då säger den ingenting.
   */
  caseReference?: string | null;
  /** Antal dagar kvar, för fristhändelsen. */
  daysLeft?: number | null;
}

const suffix = (ref: string | null | undefined): string => (ref ? ` (${ref})` : "");

/**
 * Nedräkningen i klartext. "0 dagar" är fel ord för i dag, och "1 dagar"
 * är fel ord för i morgon - och en avisering som skriver fel om tiden är
 * svår att lita på om resten.
 */
export const daysLeftPhrase = (days: number): string => {
  if (days <= 0) return "i dag";
  if (days === 1) return "i morgon";
  return `om ${days} dagar`;
};

export const buildMessage = (input: MessageInput): NotificationMessage => {
  const ref = suffix(input.caseReference);
  const when = typeof input.daysLeft === "number" ? daysLeftPhrase(input.daysLeft) : null;

  switch (input.kind) {
    case "frist-narmar-sig":
      return {
        title: "En tidsfrist närmar sig",
        body: when
          ? `En frist i ärendet löper ut ${when}. Öppna handlingsplanen för att se vilken och vad som återstår.`
          : "En frist i ärendet närmar sig. Öppna handlingsplanen för att se vilken.",
        sms: `CLEARANCE: en tidsfrist i ditt ärende${ref} löper ut ${when ?? "snart"}. Logga in för detaljer.`,
        href: "/dashboard#frister",
      };

    case "atgard-kravs":
      return {
        title: "Något kräver din åtgärd",
        body: "Ärendet står stilla tills du gjort något. Öppna handlingsplanen för att se vad.",
        sms: `CLEARANCE: ditt ärende${ref} väntar på en åtgärd från dig. Logga in för detaljer.`,
        href: "/dashboard",
      };

    case "dokument-granskat":
      return {
        title: "En handling har granskats",
        body: "En handling i ärendet har fått ett granskningsbeslut. Öppna handlingarna för att se vilket.",
        sms: `CLEARANCE: en handling i ditt ärende${ref} har granskats. Logga in för detaljer.`,
        href: "/dashboard/handlingar",
      };

    case "radgivare-kommenterat":
      return {
        title: "En rådgivare har kommenterat",
        body: "Det finns ett nytt meddelande i ärendet som väntar på dig.",
        sms: `CLEARANCE: nytt meddelande i ditt ärende${ref}. Logga in för att läsa.`,
        href: "/dashboard/meddelanden",
      };

    case "analys-klar":
      return {
        title: "En ny analys är klar",
        body: "Systemanalysen har räknat om läget utifrån de senaste uppgifterna.",
        sms: `CLEARANCE: en ny analys av ditt ärende${ref} är klar. Logga in för att läsa.`,
        href: "/dashboard",
      };

    case "arende-status":
      return {
        title: "Ärendet har bytt status",
        body: "Ärendets status har ändrats. Öppna översikten för att se den nya.",
        sms: `CLEARANCE: statusen på ditt ärende${ref} har ändrats. Logga in för detaljer.`,
        href: "/dashboard",
      };

    case "steg-framat":
      return {
        title: "Processen har gått vidare",
        body: "Ärendet har gått vidare till nästa steg. Öppna översikten för att se var ni står.",
        sms: `CLEARANCE: ditt ärende${ref} har gått vidare till nästa steg. Logga in för detaljer.`,
        href: "/dashboard",
      };
  }
};

/* --- Identiteten ---------------------------------------------------------- */

export interface DedupeInput {
  kind: EventKind;
  userId: string;
  caseId: string;
  /**
   * Vad händelsen gäller: fristens id, dokumentets id, meddelandets id.
   * Det är DEN som gör att samma upptäckt gjord tio gånger blir en
   * avisering - inte tidpunkten, för tidpunkten är olika varje gång.
   */
  subjectId: string;
  /**
   * Fristhändelsen ska få komma igen när det blivit mer bråttom: sju
   * dagar kvar är ett annat besked än en dag kvar. Tröskeln - inte
   * antalet dagar - är därför en del av identiteten.
   */
  threshold?: number | null;
}

/**
 * Nyckeln som gör utskicket engångs. Databasen har ett unikt index på
 * den; en andra insättning med samma nyckel gör ingenting.
 *
 * Ordningen är avsiktlig och får inte ändras utan migrering: nycklarna
 * som redan ligger i tabellen skulle sluta matcha, och då skickas allt
 * en gång till.
 */
export const dedupeKey = (input: DedupeInput): string =>
  [
    input.kind,
    input.userId,
    input.caseId,
    input.subjectId,
    input.threshold === null || input.threshold === undefined ? "-" : String(input.threshold),
  ].join(":");

/**
 * Trösklarna för fristpåminnelsen. Tre besked, inte ett per dag: den
 * som får SMS varje dag i fjorton dagar slutar läsa dem, och då är
 * kanalen förbrukad när det verkligen gäller.
 */
export const DEADLINE_THRESHOLDS = [14, 7, 1] as const;

/**
 * Vilken tröskel ett antal dagar hör till - den snävaste som passerats.
 * Åtta dagar kvar hör till fjortondagarsbeskedet, sju till sjudagars.
 */
export const thresholdFor = (daysLeft: number): number | null => {
  for (const t of [...DEADLINE_THRESHOLDS].sort((a, b) => a - b)) {
    if (daysLeft <= t) return t;
  }
  return null;
};

/* ==========================================================================
   src/lib/notifications/phone.ts
   ========================================================================== */

/**
 * Mobilnumret.
 *
 * Ett nummer som skrivits fel skickar SMS till en främling. I den här
 * produkten är det inte en skönhetsfläck: aviseringen säger att någon
 * har ett ärende hos CLEARANCE, och CLEARANCE finns bara för bolag i
 * kris. Numret måste därför både SE RÄTT UT och VERIFIERAS innan det
 * används - att lita på inmatningen är att lita på att ingen har
 * fingrar.
 *
 * Numret lagras normaliserat (E.164) så att samma nummer inskrivet på
 * fyra sätt blir en rad, inte fyra.
 */

/** Landsnumret. Egen konstant för den dag fler länder blir aktuella. */
const SE = "+46";

/**
 * Normaliserar ett svenskt mobilnummer till E.164, eller null.
 *
 * Godtar 070-123 45 67, 0701234567, +46701234567, 0046701234567 och
 * 46701234567. Fasta nummer godtas inte: ett SMS till en fast telefon
 * kommer aldrig fram, och ett tyst misslyckande är värre än ett nej.
 */
export const normalisePhone = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Bara siffror, plus och de vanliga avskiljarna får förekomma. En
  // bokstav betyder att någon skrivit något annat än ett nummer.
  if (!/^[+\d\s()-]+$/.test(trimmed)) return null;

  let digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("+46")) digits = digits.slice(3);
  else if (digits.startsWith("0046")) digits = digits.slice(4);
  else if (digits.startsWith("46") && !digits.startsWith("460")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  else return null;

  if (digits.includes("+")) return null;
  // Svenska mobilnummer: 7 följt av 8 siffror.
  if (!/^7\d{8}$/.test(digits)) return null;
  return `${SE}${digits}`;
};

export const isMobileNumber = (raw: string): boolean => normalisePhone(raw) !== null;

/**
 * Numret som det visas tillbaka för användaren: +46 70 123 45 67.
 * Grupperingen är den svenska, för det är så någon läser sitt eget
 * nummer och kontrollerar att det stämmer.
 */
export const formatPhone = (e164: string): string => {
  const m = /^\+46(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(e164);
  if (!m) return e164;
  return `+46 ${m[1]}${m[2]} ${m[3]} ${m[4]} ${m[5]}`;
};

/**
 * Numret maskerat. Används överallt utom i fältet där användaren just
 * skrivit in det: en skärmdump av inställningarna ska inte lämna ut
 * hela numret.
 */
export const maskPhone = (e164: string): string => {
  const m = /^\+46(\d{3})\d{4}(\d{2})$/.exec(e164);
  if (!m) return "•••";
  return `+46 ${m[1]} •• •• ${m[2]}`;
};

/* --- Verifieringen -------------------------------------------------------- */

/** Koden är sex siffror. Kortare gissas, längre skrivs fel. */
export const VERIFICATION_CODE_LENGTH = 6;

/** Koden lever i tio minuter. */
export const VERIFICATION_TTL_MINUTES = 10;

/** Antal försök innan koden bränns. Skyddar mot att gissa sig igenom. */
export const VERIFICATION_MAX_ATTEMPTS = 5;

export const isVerificationCode = (code: string): boolean =>
  new RegExp(`^\\d{${VERIFICATION_CODE_LENGTH}}$`).test(code.trim());

/**
 * SMS:et som bär koden.
 *
 * Texten formuleras HÄR bara för att den ska gå att läsa, prova och
 * granska som språk. Den skickas inte härifrån: strängen sätts ihop av
 * start_phone_verification i databasen, i samma transaktion som koden
 * föds. tests/notificationService.ts läser båda källorna och kräver att
 * de säger exakt samma sak - annars hade den lästa texten och den
 * skickade kunnat glida isär utan att någon märkte det.
 *
 * Det enda utskick som får gå till ett OVERIFIERAT nummer, och därför
 * det enda som inte får avslöja någonting alls om vem som begärt det
 * eller varför.
 */
export const verificationSms = (code: string): string =>
  `${code} är din kod för att slå på SMS-aviseringar. Koden gäller i ${VERIFICATION_TTL_MINUTES} minuter.`;

/*
 * HÄR LÅG generateCode() OCH hashCode(), OCH DE VAR HELA BRISTEN.
 *
 * Koden slumpades i webbläsaren, hashades i webbläsaren, och både hashen
 * och SMS-texten skickades in till databasen som argument. Den som kunde
 * anropa API:t kunde alltså välja koden själv, aldrig läsa något SMS och
 * ändå bekräfta. Verifieringen bevisade inte att någon hade telefonen -
 * den bevisade att någon kan räkna till sex.
 *
 * Frontend-säkerhet är inte en säkerhetsmekanism. Koden föds numera i
 * start_phone_verification (migration 20260822100000), lämnar databasen
 * bara som SMS, och klienten får `void` tillbaka. Lägg inte tillbaka
 * funktionerna: tests/sakerhet.ts läser den här filen och blir röd om
 * någon gör det.
 */

/* ==========================================================================
   src/lib/notifications/status.ts
   ========================================================================== */

/**
 * ÄR AVISERINGARNA PÅSLAGNA?
 *
 * Tjänsten är byggd hel: tabeller, kö, beslutsregler, arbetare, kvitton och
 * en betald SMS-kanal. Ett enda led saknas - INGEN SKAPAR HÄNDELSER.
 * `enqueue_notification()` är den enda vägen in i kön, och den är oanropad
 * från produktionskod. Utan producent är klockan tom, inget mejl går ut och
 * inget SMS skickas, hur rätt allt annat än beter sig.
 *
 * Varje lager är grönt var för sig, och det är därför det här inte syntes:
 * SQL-provet anropar enqueue_notification själv, beslutsreglerna prövas som
 * ren funktion, och webbläsarproven kör demoläget, som hittar på händelser.
 * Ingen av dem ställer frågan om kedjan hänger ihop.
 *
 * DEN HÄR FLAGGAN FÅR INTE VARA EN ÅSIKT. tests/aviseringar.ts läser
 * produktionskoden (utan kommentarer - texten ovan nämner funktionen, och
 * det är inte ett anrop) och kräver att flaggan säger samma sak som koden.
 * Kopplas en producent in blir provet rött tills flaggan och texterna i
 * gränssnittet ändras. Det är avsikten: löftet och verkligheten ska inte
 * kunna glida isär i tysthet.
 */
export const AVISERINGAR_HAR_PRODUCENT = false;

/**
 * Vad användaren får läsa så länge. Formulerad för den som står i valet
 * eller framför prislappen: valen sparas, men ingenting skickas än.
 */
export const AVISERINGAR_INTE_LIVE =
  "Aviseringar utanför appen är inte påslagna än: ingen händelse skapas, så varken " +
  "klockan, mejlen eller SMS:en går i gång ännu. Dina val sparas och gäller den dag " +
  "de slås på.";

/* ==========================================================================
   src/lib/notificationsRead.ts
   ========================================================================== */

/**
 * Klockans minne.
 *
 * Notiscentret hade tidigare inget. Siffran visade samma tal i evighet -
 * man klickade på en notis, gick dit, gjorde saken, kom tillbaka, och
 * siffran stod kvar. En räknare som inte går att beta av är inte en
 * räknare utan en dekoration, och den lär användaren att inte titta på
 * den. Det är dyrt i en produkt vars hela poäng är att peka på det som
 * brinner.
 *
 * TVÅ SAKER SKILJER DET HÄR FRÅN EN VANLIG "LÄST"-FLAGGA:
 *
 * 1. Kvitteringen hänger på radens FINGERAVTRYCK, inte på dess id. En
 *    frist som går från "om tre dagar" till "förfaller idag" har samma
 *    id men är ny information, och blir därför oläst igen. Att kvittera
 *    en notis en gång ska inte tysta hela dess upptrappning.
 *
 * 2. Ingenting döljs. En läst rad ligger kvar i listan, den slutar bara
 *    räknas. Klockan får aldrig bli en plats där man kan gömma en frist
 *    genom att klicka bort den.
 *
 * Minnet är per ENHET, som resten av notisvalen (se
 * NotificationCategory i notifications.ts). Det är rätt nivå: kvitterat
 * på jobbdatorn betyder inte kvitterat i mobilen, och den som byter
 * enhet mitt i en kris ska se allt igen snarare än att missa något.
 */

const KEY__notificationsRead = "clearance-notifications-read";

/** Taket för hur många kvitteringar som sparas. */
const MAX_REMEMBERED = 200;

/**
 * Kvitteringarna, nyast sist. Fingeravtryck, inte id: se filhuvudet.
 *
 * En array och inte ett set, för att ordningen är det som gör att
 * gallringen nedan tar bort det äldsta.
 */
const load = (): string[] => {
  try {
    const raw = localStorage.getItem(KEY__notificationsRead);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
};

const save = (signatures: string[]): void => {
  try {
    // Gallras uppifrån: en lista som växer utan gräns fyller lagringen
    // och gör att INGENTING går att spara, inte ens det senaste.
    localStorage.setItem(KEY__notificationsRead, JSON.stringify(signatures.slice(-MAX_REMEMBERED)));
    window.dispatchEvent(new CustomEvent(READ_EVENT));
  } catch {
    /* utan lagring finns inget minne - klockan visar allt som oläst */
  }
};

/** Namnet på händelsen som säger att minnet ändrats. */
export const READ_EVENT = "clearance-notifications-read";

export const readSignatures = (): Set<string> => new Set(load());

export const markRead = (item: NotificationItem): void => {
  const signature = signatureOf(item);
  const current = load();
  if (current.includes(signature)) return;
  save([...current, signature]);
};

export const markAllRead = (items: readonly NotificationItem[]): void => {
  const current = load();
  const additions = items.map(signatureOf).filter((s) => !current.includes(s));
  if (additions.length === 0) return;
  save([...current, ...additions]);
};

/** Bara för inställningarna: släpp minnet och visa allt igen. */
export const forgetRead = (): void => save([]);

export const isRead = (item: NotificationItem, read: Set<string> = readSignatures()): boolean =>
  read.has(signatureOf(item));

/**
 * Siffran på klockan.
 *
 * OLÄST **och** KRÄVER något. De två villkoren tillsammans är hela
 * poängen: utan det första går siffran aldrig ner, utan det andra räknar
 * den rader som själva säger att inget behöver göras.
 */
export const badgeCount = (
  items: readonly NotificationItem[],
  read: Set<string> = readSignatures(),
): number => items.filter((item) => item.demandsAction && !isRead(item, read)).length;

/**
 * Etiketten på knappen. Skriven så att den stämmer med siffran - en
 * skärmläsare ska inte få höra "väntar på ditt svar" om något som inte
 * gör det.
 */
export const bellLabel = (count: number): string => {
  if (count === 0) return "Notiser: inget kräver dig just nu";
  if (count === 1) return "Notiser: en sak kräver dig";
  return `Notiser: ${count} saker kräver dig`;
};

/* ==========================================================================
   src/lib/orgNumber.ts
   ========================================================================== */

// Swedish organization number validation and formatting

export const formatOrgNumber = (input: string): string => {
  // Remove all non-digits
  const digits = input.replace(/\D/g, '');
  
  // Format as XXXXXX-XXXX
  if (digits.length > 6) {
    return `${digits.slice(0, 6)}-${digits.slice(6, 10)}`;
  }
  return digits;
};

export const validateOrgNumber = (orgNumber: string): boolean => {
  // Remove formatting
  const digits = orgNumber.replace(/\D/g, '');
  
  // Must be exactly 10 digits
  if (digits.length !== 10) {
    return false;
  }
  
  // Luhn algorithm checksum validation
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let digit = parseInt(digits[i]);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  
  return sum % 10 === 0;
};

/**
 * Slår upp bolaget - men tar emot porten i stället för att hämta den.
 *
 * Förut importerades den konkreta adaptern (`data`) rakt in hit. Det gjorde
 * en annars ren domänmodul beroende av vilken backend som råkade vara
 * inkopplad, och det är precis den kopplingen ports-and-adapters finns för
 * att slippa: modulen ska gå att använda i ett annat verktyg, mot en annan
 * adapter, utan att någonting följer med på köpet.
 */
export const lookupCompany = async (
  orgNumber: string,
  port: CompanyLookupPort,
): Promise<CompanyInfo | null> => {
  if (!validateOrgNumber(orgNumber)) return null;
  return port.lookup(orgNumber);
};

/* ==========================================================================
   src/lib/portfolioSummary.ts
   ========================================================================== */

/**
 * Portföljanalysen: praktikerns personliga arbetsledare.
 *
 * Juristen, rekonstruktören eller förvaltaren ska aldrig behöva fundera på
 * "vad ska jag göra nu?". Rapporten svarar på arbetsledarens frågor: hur
 * många ärenden, vilka kräver åtgärd idag, vad väntar på mig, vad riskerar
 * att bli försenat, och vilket ärende kräver min uppmärksamhet FÖRST.
 *
 * Samma regler som lägesrapporten: deterministisk (samma portfölj ger
 * samma rapport, testbar mening för mening), saklig ton, och
 * arbetsbelastningen är en UPPSKATTNING och sägs vara det - en gissning
 * som låtsas vara mätning är värre än ingen siffra alls.
 */

export interface PortfolioCase {
  caseRecord: CaseRecord;
  severity: Severity__executiveSummary;
  timeline: TimelineEvent[];
  openTasks: number;
  openMentions: number;
}

export interface PortfolioSummary {
  /** Arbetsledarens rader, i den ordning de ska läsas. */
  lines: string[];
  /** Ärendena sorterade efter vad som kräver uppmärksamhet först. */
  ranked: { caseId: string; score: number; reason: string }[];
  /** Uppskattad arbetsinsats idag, i timmar med en decimal. */
  estimatedHours: number;
}

const SEVERITY_WEIGHT: Record<Severity__executiveSummary, number> = {
  critical: 400,
  serious: 200,
  elevated: 80,
  stable: 0,
};

export const buildPortfolioSummary = (
  cases: PortfolioCase[],
  now: Date,
): PortfolioSummary => {
  const lines: string[] = [];

  const total = cases.length;
  lines.push(
    total === 1
      ? "Du ansvarar för 1 aktivt ärende."
      : `Du ansvarar för ${total} aktiva ärenden.`,
  );

  // Per ärende: närmaste frist och dess läge.
  const analysed = cases.map((c) => {
    const sorted = [...c.timeline].sort((a, b) => a.iso.localeCompare(b.iso));
    const countdowns = sorted.map((e) => ({ event: e, countdown: countdownTo(e.iso, now) }));
    const passed = countdowns.filter((x) => x.countdown.tone === "passed").length;
    const dueToday = countdowns.filter((x) => x.countdown.tone === "today").length;
    const within24h = countdowns.filter((x) => x.countdown.daysLeft >= 0 && x.countdown.daysLeft <= 1).length;
    const thisWeek = countdowns.filter((x) => x.countdown.daysLeft > 1 && x.countdown.daysLeft <= 7).length;
    return { ...c, passed, dueToday, within24h, thisWeek, next: countdowns[0] ?? null };
  });

  const needsActionToday = analysed.filter((c) => c.passed > 0 || c.dueToday > 0).length;
  if (needsActionToday > 0) {
    lines.push(
      needsActionToday === 1
        ? "Ett ärende kräver åtgärd idag."
        : `${needsActionToday} ärenden kräver åtgärd idag.`,
    );
  }

  const critical24 = analysed.filter((c) => c.within24h > 0).length;
  if (critical24 > 0) {
    lines.push(
      critical24 === 1
        ? "Ett ärende har en kritisk tidsfrist inom 24 timmar."
        : `${critical24} ärenden har kritiska tidsfrister inom 24 timmar.`,
    );
  }

  const waitingOnYou = analysed.filter((c) => c.openMentions > 0);
  if (waitingOnYou.length > 0) {
    const msgs = waitingOnYou.reduce((sum, c) => sum + c.openMentions, 0);
    lines.push(
      msgs === 1
        ? "Ett meddelande väntar på ditt svar."
        : `${msgs} meddelanden väntar på ditt svar, i ${waitingOnYou.length} ${waitingOnYou.length === 1 ? "ärende" : "ärenden"}.`,
    );
  }

  const worsening = analysed.filter((c) => c.severity === "critical").length;
  if (worsening > 0) {
    lines.push(
      worsening === 1
        ? "Ett bolag befinner sig i kritiskt läge – dess frister ligger överst nedan."
        : `${worsening} bolag befinner sig i kritiskt läge – deras frister ligger överst nedan.`,
    );
  }

  const calm = analysed.filter(
    (c) => c.severity === "stable" && c.passed === 0 && c.openTasks === 0 && c.openMentions === 0,
  ).length;
  if (calm > 0 && total > 1) {
    lines.push(
      calm === 1
        ? "Ett ärende är i stabilt läge utan öppna punkter."
        : `${calm} ärenden är i stabilt läge utan öppna punkter.`,
    );
  }

  // Uppskattad arbetsbelastning: 45 min per punkt som kräver åtgärd idag,
  // 20 min per öppen uppgift, 10 min per obesvarat meddelande. En grov
  // schablon, och den presenteras som en uppskattning.
  const minutes = analysed.reduce(
    (sum, c) => sum + (c.passed + c.dueToday) * 45 + c.openTasks * 20 + c.openMentions * 10,
    0,
  );
  const estimatedHours = Math.round((minutes / 60) * 10) / 10;
  if (minutes > 0) {
    lines.push(`Den uppskattade arbetsinsatsen för de öppna punkterna är cirka ${String(estimatedHours).replace(".", ",")} timmar.`);
  } else if (total > 0) {
    lines.push("Inga öppna punkter kräver dig just nu – portföljen är under kontroll.");
  }

  // Rangordningen: vilket ärende kräver uppmärksamhet FÖRST.
  const ranked = analysed
    .map((c) => {
      let score = SEVERITY_WEIGHT[c.severity];
      score += c.passed * 300 + c.dueToday * 250 + c.within24h * 150 + c.thisWeek * 40;
      score += c.openMentions * 60 + c.openTasks * 10;
      const reason =
        c.passed > 0
          ? "passerad frist"
          : c.dueToday > 0
            ? "frist idag"
            : c.openMentions > 0
              ? "väntar på ditt svar"
              : c.next
                ? `nästa frist ${c.next.countdown.label}`
                : "inga öppna frister";
      return { caseId: c.caseRecord.id, score, reason };
    })
    .sort((a, b) => b.score - a.score);

  return { lines, ranked, estimatedHours };
};

/* ==========================================================================
   src/lib/presentation.ts
   ========================================================================== */

/**
 * Adaptiv presentation: samma lägesrapport i flera former.
 *
 * Fortsättningen på det adaptiva språket. Språknivån ändrar HUR meningarna
 * låter; presentationsformen ändrar HUR informationen står uppställd:
 *
 *  text        Löpande text - dagens rapport, oförändrad.
 *  bullets     Punktlista: varje mening blir en punkt under sin rubrik.
 *              Ingen mening försvinner och ingen skrivs om - testerna
 *              räknar meningarna före och efter.
 *  timeline    Tidslinje: fristerna med datum och åtgärderna i
 *              horisontordning, som en enda kronologisk lista. Svarar på
 *              "i vilken ordning händer det här?".
 *
 * Utöver formen finns omfånget: kort (rubrik, de tre viktigaste
 * åtgärderna, strategin) eller utförlig (allt). Kort är en delmängd,
 * aldrig en omskrivning - informationen är densamma, bara urvalet skiljer.
 *
 * Allt är rena transformer av den redan byggda rapporten. Ingen ny
 * sanning skapas här - då hade formerna kunnat säga emot varandra.
 */

export type PresentationMode = "text" | "bullets" | "timeline";

export const PRESENTATION_MODES: { id: PresentationMode; label: string }[] = [
  { id: "text", label: "Text" },
  { id: "bullets", label: "Punktlista" },
  { id: "timeline", label: "Tidslinje" },
];

const MODE_KEY = "clearance-presentation-mode";
const SCOPE_KEY = "clearance-presentation-scope";

export const getPresentationMode = (): PresentationMode => {
  try {
    const raw = localStorage.getItem(MODE_KEY);
    if (raw === "text" || raw === "bullets" || raw === "timeline") return raw;
  } catch {
    /* utan lagring: text */
  }
  return "text";
};

export const setPresentationMode = (mode: PresentationMode): void => {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* går inte att spara - valet gäller ändå för vyn */
  }
};

export const getCompactScope = (): boolean => {
  try {
    // Kort version är DEFAULT (Product Excellence rond 2): analysen ska
    // svara först och fördjupa på begäran. Den som valt full behåller full.
    return localStorage.getItem(SCOPE_KEY) !== "full";
  } catch {
    return true;
  }
};

export const setCompactScope = (compact: boolean): void => {
  try {
    localStorage.setItem(SCOPE_KEY, compact ? "compact" : "full");
  } catch {
    /* som ovan */
  }
};

/* --- punktlistan ----------------------------------------------------------- */

export interface BulletSection {
  id: string;
  title: string;
  items: string[];
}

/**
 * Meningsdelningen bevarar förkortningar med punkt inte alls - våra
 * rapporttexter använder inga - och delar aldrig inne i tal: "165 000 kr."
 * avslutar en mening, "25 kap." förekommer inte i rapporterna.
 */
const sentencesOf = (paragraph: string): string[] =>
  paragraph
    .split(/(?<=[.!?])\s+(?=[A-ZÅÄÖ0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

export const toBullets = (summary: ExecutiveSummary): BulletSection[] =>
  summary.sections.map((section) => ({
    id: section.id,
    title: section.title,
    items: section.paragraphs.flatMap(sentencesOf),
  }));

/* --- tidslinjen ------------------------------------------------------------ */

export interface TimelineRow {
  /** "12 aug", "passerad", "omedelbart", "denna vecka" ... */
  when: string;
  label: string;
  detail: string | null;
  tone: "critical" | "warning" | "info";
  /** Sorteringsnyckel; lägre = tidigare/mer akut. */
  order: number;
}

const HORIZON_ORDER__presentation: Record<ActionHorizon, number> = {
  omedelbart: 0,
  idag: 1,
  "denna vecka": 2,
  "kan vänta": 3,
};

const shortDate = (iso: string): string => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const months = ["jan", "feb", "mars", "april", "maj", "juni", "juli", "aug", "sep", "okt", "nov", "dec"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
};

/**
 * En enda kronologi: passerade frister först (de är redan fakta), sedan
 * åtgärderna i horisontordning invävda med kommande frister efter dagar
 * kvar. Åtgärder utan datum sorteras på sin horisont: "omedelbart" före
 * en frist om tre dagar, "kan vänta" efter allt datumsatt.
 */
export const toTimelineRows = (
  summary: ExecutiveSummary,
  timeline: TimelineEvent[],
  now: Date,
): TimelineRow[] => {
  const rows: TimelineRow[] = [];

  for (const event of timeline) {
    const countdown = countdownTo(event.iso, now);
    if (countdown.tone === "passed") {
      rows.push({
        when: "passerad",
        label: event.label,
        detail: `Datumet var ${shortDate(event.iso)} (${countdown.label}).`,
        tone: "critical",
        order: -1,
      });
    } else {
      rows.push({
        when: countdown.tone === "today" ? "idag" : shortDate(event.iso),
        label: event.label,
        detail: countdown.tone === "today" ? "Sista dagen." : `Om ${countdown.daysLeft} dagar.`,
        tone: countdown.tone === "today" ? "critical" : countdown.daysLeft <= 3 ? "warning" : "info",
        // Datumsatta rader sorteras på dagar kvar, förskjutna så att
        // "omedelbart"-åtgärder (0.0) hamnar före dagens frister (0.5).
        order: 0.5 + countdown.daysLeft,
      });
    }
  }

  for (const action of summary.actions) {
    rows.push({
      when: action.horizon,
      label: action.label,
      detail: action.why,
      tone: action.horizon === "omedelbart" || action.horizon === "idag" ? "critical" : action.horizon === "denna vecka" ? "warning" : "info",
      order: HORIZON_ORDER__presentation[action.horizon] === 0 ? 0 : HORIZON_ORDER__presentation[action.horizon] * 3.6,
    });
  }

  return rows.sort((a, b) => a.order - b.order);
};

/* --- omfånget -------------------------------------------------------------- */

export interface CompactSummary {
  headline: string;
  topActions: SummaryAction[];
  strategy: string;
}

/** Kort version: en delmängd av rapporten, aldrig en omskrivning. */
export const toCompact = (summary: ExecutiveSummary): CompactSummary => {
  const byUrgency = [...summary.actions].sort(
    (a, b) => HORIZON_ORDER__presentation[a.horizon] - HORIZON_ORDER__presentation[b.horizon],
  );
  return {
    headline: summary.headline,
    topActions: byUrgency.slice(0, 3),
    strategy: summary.strategy,
  };
};

/* ==========================================================================
   src/lib/pricing.ts
   ========================================================================== */

/**
 * Företagsabonnemanget och betalväggen.
 *
 * Prismodellen är beslutad för betan: EN plan, månadsfaktura, ingen
 * bindningstid, uppsägning när som helst, tillgång under den betalda
 * perioden - och alla data sparas även om abonnemanget pausas.
 *
 * Beloppet är en DRIFTPARAMETER, aldrig en kodrad: gränssnittet läser
 * alltid planen via dataporten, och drift kan ändra den utan release.
 * Konstanten här är bara reservvärdet när ingen parameter är satt.
 *
 * Betalväggens princip: användaren blir aldrig inlåst och förlorar
 * aldrig sitt arbete. Allt skapande är öppet från början - analysen,
 * samtalet, dokumenten, handlingsplanen. Det som väntar på första
 * betalningen är vägarna UT och RUNT: export och delning. En naturlig
 * uppgradering, inte en gisslansituation.
 */

export interface CompanyPlan {
  /** Standard-nivåns månadsavgift i SEK, exklusive moms. Sätts av drift. */
  monthlyExVatSek: number;
  /** Business-nivån. Null = visas som "kontakta oss". */
  businessExVatSek?: number | null;
  /** Enterprise-nivån. Offert är alltid ett alternativ. */
  enterpriseExVatSek?: number | null;
}

/** Reservvärdena tills drift satt parametrarna. Beslutade betapriser. */
export const DEFAULT_COMPANY_PLAN: CompanyPlan = {
  monthlyExVatSek: 985,
  businessExVatSek: 2780,
  enterpriseExVatSek: 4500,
};

/**
 * Nivåerna. "Start" heter aldrig provversion - en provversion förväntas
 * vara gratis eller hårt begränsad, och det ska sägas rakt: Start ÄR
 * gratis, för att uppleva produkten. Nivåerna knyts till funktioner och
 * användare - aldrig till omsättning, för två bolag med samma omsättning
 * kan ha helt olika behov.
 */
export const PLAN_TIERS = [
  {
    id: "start",
    name: "Clearance Start",
    audience: "För att uppleva produkten",
    includes: [
      "Samtalet med rådgivaren",
      "Grundläggande analys och lägesbild",
      "Skapa dokument och handlingsplan",
    ],
    excludes: [
      "Ingen export",
      "Ingen delning",
      "Ingen ekonomisystemskoppling",
      "Inga aviseringar utanför appen",
    ],
  },
  {
    id: "standard",
    name: "Clearance Standard",
    audience: "Små och medelstora företag",
    includes: [
      "Obegränsad dialog och full handlingsplan",
      "Dokumentgenerering, arkiv och ärendehistorik",
      "Export, delning och e-post till rådgivare",
    ],
    // Ekonomisystemskopplingen bor i Business och Enterprise - ENDAST
    // där, på uttrycklig begäran. Flytta inte ner den igen.
    excludes: ["Ingen ekonomisystemskoppling", "Inga SMS-aviseringar"],
  },
  {
    id: "business",
    name: "Clearance Business",
    audience: "Företag med större komplexitet",
    includes: [
      "Flera användare och flera bolag",
      "Ekonomisystemskoppling (Fortnox/Visma när avtalen är på plats)",
      "Behörighetsstyrning och styrelseportal",
      "SMS-aviseringar vid frister och åtgärder",
      "Avancerade arbetsflöden och utökade integrationer",
      "Prioriterad support",
    ],
    excludes: [],
  },
  {
    id: "enterprise",
    name: "Clearance Enterprise",
    audience: "Större bolag med särskilda krav",
    includes: [
      "Ekonomisystemskoppling, anpassade integrationer och API",
      "Fler användare och roller",
      "Avancerad loggning",
      "SMS-aviseringar vid frister och åtgärder",
      "Dedikerad onboarding och anpassad support",
    ],
    excludes: [],
  },
] as const;

/** Nivån med ett visst id. */
export const tierById = (id: string) => PLAN_TIERS.find((t) => t.id === id);

/**
 * SKILLNADEN MELLAN TVÅ NIVÅER - det som faktiskt köps.
 *
 * Ett erbjudande som räknar upp allt i den högre nivån läses som att man
 * betalar för alltihop, inklusive det man redan har. Den som står på
 * Standard och ser "Obegränsad dialog" i listan för 2 780 kr tänker inte
 * "det ingår också" utan "det där betalar jag ju redan för".
 *
 * Det som ska stå i ett erbjudande är alltså vad som TILLKOMMER. Resten
 * sägs i en rad: du behåller det du har.
 */
export const nyttIniva = (franId: string, tillId: string): string[] => {
  const fran = tierById(franId);
  const till = tierById(tillId);
  if (!till) return [];
  const har = new Set<string>(fran?.includes ?? []);
  return till.includes.filter((rad) => !har.has(rad));
};

/** "985 kr/mån + moms" - alltid exklusive moms mot aktiebolag. */
export const formatMonthly = (sek: number): string =>
  `${String(Math.round(sek)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr/mån + moms`;

export const formatPlanPrice = (plan: CompanyPlan): string => formatMonthly(plan.monthlyExVatSek);

/** Villkoren i klartext - samma ord överallt där planen visas. */
export const PLAN_TERMS = [
  "Månadsvis faktura",
  "Ingen bindningstid – uppsägning när som helst",
  "Tillgång till tjänsten under den betalda perioden",
  "Alla data sparas även om abonnemanget pausas",
] as const;

/* --- betalväggen ----------------------------------------------------------- */

/**
 * Nyckelfrågan är EN: har första fakturan betalats? Före den är allt
 * skapande öppet men export och delning väntar. Efter den är de öppna.
 * Ett pausat abonnemang raderar aldrig data - frysningen är läsbar.
 */
export const firstPaymentDone = (billing: AccountBillingRecord | null | undefined): boolean =>
  !!billing?.paidAt;

/** Vad som väntar på första betalningen - listan är kommunikationen. */
export const LOCKED_UNTIL_FIRST_PAYMENT = [
  "Export av dokument och ärendehistorik",
  "Delning med externa rådgivare",
  "Fristkalender till eget kalenderprogram",
] as const;

/**
 * Låstexten som visas vid varje stängd funktion. Priset kommer ur
 * planen (driftparametern), aldrig ur en strängkonstant i en vy.
 */
export const lockMessage = (plan: CompanyPlan): string =>
  `Aktiveras när första fakturan är betald. ${formatPlanPrice(plan)} – ingen bindningstid, avsluta när som helst. Allt du skapat finns kvar.`;

/* ==========================================================================
   src/lib/proOffer.ts
   ========================================================================== */

/**
 * ENGÅNGSERBJUDANDET: uppgradera till nivån som låser upp SMS, med första
 * veckan gratis - visat EN gång, med en nedräkning som FAKTISKT tar slut.
 *
 * Det här är medvetet byggt för att vara äkta, inte ett mörkt mönster.
 * Skillnaden är hela poängen:
 *
 *  - Det visas EN gång (en sparad flagga), inte varje gång sidan laddas.
 *    En "sista chans" som dyker upp om och om igen är en lögn, och en lögn
 *    i en produkt som säljer krishantering till pressade företag är precis
 *    det som förstör förtroendet i det ögonblick kunden behöver det mest.
 *  - Nedräkningen tar slut på riktigt: när den når noll dras
 *    gratisveckan tillbaka i vyn. Eftersom erbjudandet ändå bara visas en
 *    gång ÄR fönstret verkligt - brådskan är sann, inte påhittad.
 *  - Priset är ingen hårdkodad siffra. Det kommer ur prisparametrarna
 *    (pricing.ts), som drift sätter.
 *
 * Falsk brådska (en timer som nollställs, ett "endast idag" som gäller
 * varje dag) är dessutom otillbörlig marknadsföring. Den här varianten är
 * det inte.
 */

const SEEN_KEY = "clearance-pro-offer-seen";

/** Sant när erbjudandet redan visats en gång - då ska det aldrig visas igen. */
export const proOfferSeen = (): boolean => {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    // Privat läge: hellre visa en gång för mycket än att anta att vi visat.
    return false;
  }
};

/** Märk erbjudandet som visat. Kallas i samma stund det öppnas. */
export const markProOfferSeen = (): void => {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Se ovan: det värsta som händer är att det inte visas alls.
  }
};

/**
 * Nivån erbjudandet gäller: den som FAKTISKT låser upp SMS, läst ur
 * prislistan i stället för hårdkodad. SMS-kortet råkade kalla den
 * "Professional"; den heter Clearance Business, och det är den som ger SMS.
 */
export const smsTier = PLAN_TIERS.find((tier) =>
  tier.includes.some((rad) => /SMS/i.test(rad)),
)!;

/** Nedräkningens längd i sekunder. En minut - tydligt, inte utdraget. */
export const OFFER_SECONDS = 60;

/* ==========================================================================
   src/lib/reports/builders.ts
   ========================================================================== */

/**
 * Turns each of the product's analyses into a ReportModel.
 *
 * Pure functions, so what a report says can be tested without rendering it.
 * They deliberately restate the caveats that are visible on screen: a report
 * gets emailed on and read by someone who never saw the interface, so it has
 * to carry its own context.
 */

const sek__reports_builders = (value: number): string => `${Math.round(value).toLocaleString("sv-SE")} kr`;

const swedishDate__reports_builders = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });
};

const SHARED_DISCLAIMER =
  "CLEARANCE tillhandahåller administrativt stöd och allmän information, inte juridisk rådgivning. " +
  "Innehållet bygger helt på de uppgifter användaren själv har lämnat och har inte stämts av mot " +
  "bokföring, register eller någon annan källa. Rapporten ersätter inte juridisk, ekonomisk eller " +
  "skatterättslig rådgivning och bör stämmas av med en behörig rådgivare innan beslut fattas.";

const severityTone = (severity: string): Tone =>
  severity === "critical" ? "critical" : severity === "warning" ? "warning" : "neutral";

/* -------------------------------------------------------------------------- */
/* Crisis analysis                                                            */
/* -------------------------------------------------------------------------- */

export interface CrisisReportInput {
  analysis: CrisisAnalysis;
  companyName: string | null;
  orgNumber: string | null;
  reference: string | null;
  employees: string | null;
  totalDebt: number;
  quickLiquidationValue: number;
  generatedAt: string;
}

const verdictTone = (type: CrisisAnalysis["type"]): Tone =>
  type === "bankruptcy" ? "critical" : type === "reconstruction" ? "warning" : "good";

export const buildCrisisReport = (input: CrisisReportInput): ReportModel => {
  const { analysis } = input;

  const lead: ReportBlock[] = [
    {
      kind: "callout",
      tone: verdictTone(analysis.type),
      title: analysis.title,
      body: analysis.description,
    },
  ];

  const sections: ReportModel["sections"] = [];

  if (analysis.reasons.length > 0) {
    sections.push({
      title: "Vad bedömningen bygger på",
      blocks: [{ kind: "list", items: analysis.reasons.map((text) => ({ text })) }],
    });
  }

  sections.push({
    title: "Ekonomisk ställning",
    blocks: [
      {
        kind: "figures",
        items: [
          { value: sek__reports_builders(input.totalDebt), label: "Totala skulder" },
          { value: sek__reports_builders(input.quickLiquidationValue), label: "Snabbt avyttringsvärde" },
          {
            value:
              analysis.coverage.ratio === null
                ? "–"
                : `${Math.round(analysis.coverage.ratio * 100)} %`,
            label: "Täckningsgrad",
            note: "Avyttringsvärde delat med skulder",
            tone:
              analysis.coverage.ratio === null
                ? "neutral"
                : analysis.coverage.ratio < 0.5
                  ? "critical"
                  : "warning",
          },
        ],
      },
      { kind: "paragraph", text: analysis.coverage.explanation },
      { kind: "paragraph", text: analysis.solvency.explanation },
    ],
  });

  if (analysis.timeline.length > 0) {
    sections.push({
      title: "Tidslinje",
      intro: "Datumen kommer från de förfallodagar som angetts.",
      blocks: [
        {
          kind: "table",
          columns: [
            { label: "Datum" },
            { label: "Händelse" },
            { label: "Belopp", align: "right", numeric: true },
          ],
          rows: analysis.timeline.map((event) => ({
            tone: severityTone(event.severity),
            cells: [
              `${swedishDate__reports_builders(event.iso)} (om ${event.daysAway} d)`,
              event.note ? `${event.label} – ${event.note}` : event.label,
              event.amount === null ? "–" : sek__reports_builders(event.amount),
            ],
          })),
        },
      ],
    });
  }

  if (analysis.riskFlags.length > 0) {
    sections.push({
      title: "Risker att känna till",
      blocks: analysis.riskFlags.map((flag) => ({
        kind: "callout" as const,
        tone: severityTone(flag.severity),
        title: flag.title,
        body: flag.body,
        legalRef: flag.legalRef,
      })),
    });
  }

  if (analysis.nextSteps.length > 0) {
    sections.push({
      title: "Nästa steg",
      blocks: [
        {
          kind: "list",
          ordered: true,
          items: analysis.nextSteps.map((step) => ({
            text: step.text,
            note: step.deadline,
            emphasis: step.urgent,
          })),
        },
      ],
    });
  }

  return {
    meta: {
      documentTitle: "Krisanalys",
      companyName: input.companyName,
      orgNumber: input.orgNumber,
      reference: input.reference,
      generatedAt: input.generatedAt,
    },
    lead,
    sections,
    disclaimer: SHARED_DISCLAIMER,
  };
};

/* -------------------------------------------------------------------------- */
/* Control balance sheet assessment                                           */
/* -------------------------------------------------------------------------- */

export interface KbrReportInput {
  status: "not_required" | "warning" | "required" | "critical";
  message: string;
  shareCapital: number;
  totalAssets: number;
  totalLiabilities: number;
  equity: number;
  /** Half the registered share capital - the threshold in ABL 25:13. */
  threshold: number;
  companyName: string | null;
  orgNumber: string | null;
  reference: string | null;
  actions: string[];
  generatedAt: string;
}

const kbrTone = (status: KbrReportInput["status"]): Tone =>
  status === "not_required" ? "good" : status === "warning" ? "warning" : "critical";

export const buildKbrReport = (input: KbrReportInput): ReportModel => ({
  meta: {
    documentTitle: "Bedömning av kontrollbalansräkning",
    companyName: input.companyName,
    orgNumber: input.orgNumber,
    reference: input.reference,
    generatedAt: input.generatedAt,
  },
  lead: [
    {
      kind: "callout",
      tone: kbrTone(input.status),
      title:
        input.status === "not_required"
          ? "Kontrollbalansräkning krävs inte utifrån dessa siffror"
          : input.status === "warning"
            ? "Eget kapital närmar sig gränsen"
            : "Kontrollbalansräkning krävs",
      body: input.message,
      legalRef: "Aktiebolagslagen (2005:551) 25 kap. 13 §",
    },
    {
      kind: "paragraph",
      text:
        "Detta är en beräkning, inte en kontrollbalansräkning. Själva handlingen ska upprättas " +
        "enligt särskilda värderingsregler, skrivas under av hela styrelsen och granskas av " +
        "revisorn om bolaget har en.",
    },
  ],
  sections: [
    {
      title: "Underlag",
      blocks: [
        {
          kind: "keyValues",
          items: [
            { label: "Registrerat aktiekapital", value: sek__reports_builders(input.shareCapital) },
            { label: "Totala tillgångar", value: sek__reports_builders(input.totalAssets) },
            { label: "Totala skulder", value: sek__reports_builders(input.totalLiabilities) },
            {
              label: "Eget kapital",
              value: sek__reports_builders(input.equity),
              tone: input.equity < 0 ? "critical" : input.equity < input.threshold ? "warning" : "good",
              note: "Tillgångar minus skulder",
            },
            {
              label: "Halva aktiekapitalet",
              value: sek__reports_builders(input.threshold),
              note: "Gränsen i ABL 25 kap. 13 §",
            },
          ],
        },
      ],
    },
    {
      title: "Åtgärder",
      blocks: [
        input.actions.length > 0
          ? { kind: "list", ordered: true, items: input.actions.map((text) => ({ text })) }
          : { kind: "paragraph", text: "Inga särskilda åtgärder föreslås utifrån dessa siffror." },
      ],
    },
  ],
  disclaimer: SHARED_DISCLAIMER,
});

/* -------------------------------------------------------------------------- */
/* Liquidity plan                                                             */
/* -------------------------------------------------------------------------- */

export interface LiquidityReportInput {
  plan: LiquidityPlan;
  projection: ProjectionResult;
  horizonDays: number;
  companyName: string | null;
  orgNumber: string | null;
  reference: string | null;
  employerFeeApplied: boolean;
  generatedAt: string;
}

export const buildLiquidityReport = (input: LiquidityReportInput): ReportModel => {
  const { plan, projection } = input;

  const runsOut = projection.daysUntilNegative !== null;

  const lead: ReportBlock[] = [
    {
      kind: "figures",
      items: [
        { value: sek__reports_builders(plan.openingBalance), label: "Kassa vid start" },
        {
          value: runsOut ? `${projection.daysUntilNegative} dagar` : `${input.horizonDays}+ dagar`,
          label: "Pengarna räcker",
          note: projection.dateOfShortfall
            ? `Slut ${swedishDate__reports_builders(projection.dateOfShortfall)}`
            : `Inom prognosens ${input.horizonDays} dagar`,
          tone: runsOut ? "critical" : "good",
        },
        {
          value: sek__reports_builders(projection.lowestBalance),
          label: "Lägsta saldo",
          tone: projection.lowestBalance < 0 ? "critical" : "neutral",
        },
        {
          value: sek__reports_builders(projection.closingBalance),
          label: `Saldo efter ${input.horizonDays} dagar`,
          tone: projection.closingBalance < 0 ? "critical" : "neutral",
        },
      ],
    },
  ];

  const inflowRows = plan.inflows.map((item) => ({
    cells: [
      item.label,
      item.recurring ? `Varje månad, den ${item.dayOfMonth}:e` : swedishDate__reports_builders(item.date),
      sek__reports_builders(item.amount),
    ],
  }));

  const outflowRows = plan.outflows.map((item) => ({
    cells: [
      item.label,
      item.recurring ? `Varje månad, den ${item.dayOfMonth}:e` : swedishDate__reports_builders(item.date),
      sek__reports_builders(item.amount),
    ],
  }));

  const sections: ReportModel["sections"] = [
    {
      title: "Pengar in",
      blocks: [
        {
          kind: "table",
          columns: [
            { label: "Post" },
            { label: "När" },
            { label: "Belopp", align: "right", numeric: true },
          ],
          rows: inflowRows,
          totals: ["Summa in under perioden", "", sek__reports_builders(projection.totalInflow)],
          emptyText: "Inga inbetalningar angivna.",
        },
      ],
    },
    {
      title: "Pengar ut",
      intro: input.employerFeeApplied
        ? `Arbetsgivaravgift på ${(EMPLOYER_CONTRIBUTION_RATE * 100)
            .toFixed(2)
            .replace(".", ",")} % är inräknad i de löner som angetts som bruttolön.`
        : undefined,
      blocks: [
        {
          kind: "table",
          columns: [
            { label: "Post" },
            { label: "När" },
            { label: "Belopp", align: "right", numeric: true },
          ],
          rows: outflowRows,
          totals: ["Summa ut under perioden", "", sek__reports_builders(projection.totalOutflow)],
          emptyText: "Inga utbetalningar angivna.",
        },
      ],
    },
  ];

  // Only the days where something actually happens; a 90-row table of
  // unchanged balances is not a report anyone reads.
  const eventDays = projection.days.filter((day) => day.events.length > 0);
  if (eventDays.length > 0) {
    sections.push({
      title: "Dag för dag",
      intro: "Endast dagar med en händelse visas.",
      blocks: [
        {
          kind: "table",
          columns: [
            { label: "Datum" },
            { label: "Händelse" },
            { label: "Belopp", align: "right", numeric: true },
            { label: "Saldo efter", align: "right", numeric: true },
          ],
          rows: eventDays.flatMap((day) =>
            day.events.map((event, index) => ({
              tone: (day.balance < 0 ? "critical" : "neutral") as Tone,
              cells: [
                index === 0 ? swedishDate__reports_builders(day.iso) : "",
                event.label,
                `${event.direction === "in" ? "+" : "−"}${sek__reports_builders(event.amount)}`,
                index === day.events.length - 1 ? sek__reports_builders(day.balance) : "",
              ],
            })),
          ),
        },
      ],
    });
  }

  return {
    meta: {
      documentTitle: "Likviditetsplan",
      companyName: input.companyName,
      orgNumber: input.orgNumber,
      reference: input.reference,
      generatedAt: input.generatedAt,
    },
    lead,
    sections,
    disclaimer:
      SHARED_DISCLAIMER +
      " Prognosen antar att angivna belopp betalas på angivna datum och tar inte hänsyn till " +
      "outnyttjade krediter, säsongsvariation eller händelser som inte matats in.",
  };
};

/* ==========================================================================
   src/lib/reports/pdf.ts
   ========================================================================== */

/**
 * ReportModel → PDF.
 *
 * Samma datamodell som HTML-renderingen, samma innehåll i samma ordning -
 * PDF:en är inte en skärmdump av sidan utan en egen, ren sättning av
 * rapporten. Tabeller sätts som vänster/höger-rader (beskrivning till
 * vänster, belopp högerställt), precis vad fakturor och frister behöver.
 */

const swedishDate__reports_pdf = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });
};

const renderBlock = (pdf: PdfWriter, block: ReportBlock): void => {
  switch (block.kind) {
    case "paragraph":
      pdf.text(block.text);
      break;
    case "keyValues":
      for (const item of block.items) {
        pdf.row(item.label, item.value, { font: "bold", size: 10.5 });
        if (item.note) pdf.text(item.note, { size: 9, gray: 0.4, indent: 12 });
      }
      pdf.space(4);
      break;
    case "figures":
      for (const item of block.items) {
        pdf.row(item.label, item.value, { font: "bold" });
        if (item.note) pdf.text(item.note, { size: 9, gray: 0.4, indent: 12 });
      }
      pdf.space(4);
      break;
    case "table": {
      if (block.rows.length === 0) {
        if (block.emptyText) pdf.text(block.emptyText, { gray: 0.4, size: 9.5 });
        break;
      }
      const lastCol = block.columns.length - 1;
      pdf.row(
        block.columns.slice(0, lastCol).map((c) => c.label).join("  ·  "),
        block.columns[lastCol]?.label ?? "",
        { size: 9, gray: 0.4 },
      );
      pdf.rule(0.85);
      for (const row of block.rows) {
        pdf.row(row.cells.slice(0, lastCol).join("  ·  "), row.cells[lastCol] ?? "");
      }
      if (block.totals) {
        pdf.rule(0.85);
        pdf.row(
          block.totals.slice(0, lastCol).join("  ·  "),
          block.totals[lastCol] ?? "",
          { font: "bold" },
        );
      }
      pdf.space(4);
      break;
    }
    case "list": {
      block.items.forEach((item, index) => {
        const marker = block.ordered ? `${index + 1}.` : "•";
        pdf.text(`${marker}  ${item.text}`, {
          font: item.emphasis ? "bold" : "regular",
          indent: 4,
        });
        if (item.note) pdf.text(item.note, { size: 9, gray: 0.4, indent: 18 });
      });
      pdf.space(4);
      break;
    }
    case "callout":
      pdf.rule(0.6);
      pdf.text(block.title, { font: "bold", size: 10.5 });
      pdf.text(block.body);
      if (block.legalRef) pdf.text(block.legalRef, { size: 9, gray: 0.4 });
      pdf.rule(0.6);
      break;
  }
};

export const renderReportPdf = (model: ReportModel): Uint8Array => {
  const who = model.meta.companyName ?? model.meta.orgNumber ?? "";
  const pdf = new PdfWriter(`Clearance · ${model.meta.documentTitle}${who ? ` · ${who}` : ""}`);

  pdf.text(model.meta.documentTitle, { font: "bold", size: 17, spaceAfter: 2 });
  const metaLine = [
    model.meta.companyName,
    model.meta.orgNumber ? `Org.nr ${model.meta.orgNumber}` : null,
    model.meta.reference ? `Ref ${model.meta.reference}` : null,
    swedishDate__reports_pdf(model.meta.generatedAt),
  ]
    .filter(Boolean)
    .join("  ·  ");
  pdf.text(metaLine, { size: 9, gray: 0.4, spaceAfter: 6 });
  pdf.rule();
  pdf.space(6);

  for (const block of model.lead) renderBlock(pdf, block);

  for (const section of model.sections) {
    pdf.space(8);
    pdf.text(section.title, { font: "bold", size: 12.5, spaceAfter: 2 });
    if (section.intro) pdf.text(section.intro, { size: 9.5, gray: 0.35 });
    for (const block of section.blocks) renderBlock(pdf, block);
  }

  pdf.space(10);
  pdf.rule();
  pdf.text(model.disclaimer, { size: 8.5, gray: 0.4 });

  return pdf.toBytes();
};

/* ==========================================================================
   src/lib/reports/render.ts
   ========================================================================== */

/**
 * Renders a ReportModel to a standalone, printable HTML document.
 *
 * Pure and dependency-free, so it can be tested in node and so the produced
 * file works with no network - it has to survive being emailed to an advisor
 * and opened somewhere we know nothing about.
 *
 * The design follows the application: A4, flat, hairline rules, no colour
 * used for decoration. Tone colours survive printing because they carry
 * meaning (a critical deadline must not turn grey), which is what
 * print-color-adjust is for.
 */

/**
 * Values reach this from user input and, for company names, from a public
 * register. Everything is escaped before it goes into the document.
 */
export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const TONE_COLOUR: Record<Tone, string> = {
  neutral: "#1f2937",
  good: "#0f6b46",
  warning: "#8a5a00",
  critical: "#a3161b",
};

const TONE_SURFACE: Record<Tone, string> = {
  neutral: "#f6f6f4",
  good: "#eef7f2",
  warning: "#fdf6e7",
  critical: "#fcf0f0",
};

const TONE_BORDER: Record<Tone, string> = {
  neutral: "#d9d9d4",
  good: "#a8cfbc",
  warning: "#e6c98a",
  critical: "#e2a9ab",
};

const formatGeneratedAt = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
};

const renderBlock__reports_render = (block: ReportBlock): string => {
  switch (block.kind) {
    case "paragraph":
      return `<p class="para">${escapeHtml(block.text)}</p>`;

    case "keyValues":
      return `<dl class="kv">${block.items
        .map(
          (item) => `<div class="kv-row">
  <dt>${escapeHtml(item.label)}</dt>
  <dd class="tone-${item.tone ?? "neutral"}">${escapeHtml(item.value)}${
    item.note ? `<span class="kv-note">${escapeHtml(item.note)}</span>` : ""
  }</dd>
</div>`,
        )
        .join("")}</dl>`;

    case "figures":
      return `<div class="figures">${block.items
        .map(
          (item) => `<div class="figure">
  <p class="figure-value tone-${item.tone ?? "neutral"}">${escapeHtml(item.value)}</p>
  <p class="figure-label">${escapeHtml(item.label)}</p>
  ${item.note ? `<p class="figure-note">${escapeHtml(item.note)}</p>` : ""}
</div>`,
        )
        .join("")}</div>`;

    case "table": {
      if (block.rows.length === 0) {
        return `<p class="empty">${escapeHtml(
          block.emptyText ?? "Inga poster angivna.",
        )}</p>`;
      }
      const head = block.columns
        .map(
          (c) =>
            `<th class="${c.align === "right" ? "right" : "left"}${
              c.numeric ? " num" : ""
            }">${escapeHtml(c.label)}</th>`,
        )
        .join("");
      const body = block.rows
        .map(
          (row) =>
            `<tr>${row.cells
              .map((cell, i) => {
                const col = block.columns[i];
                return `<td class="${col?.align === "right" ? "right" : "left"}${
                  col?.numeric ? " num" : ""
                } tone-${row.tone ?? "neutral"}">${escapeHtml(cell)}</td>`;
              })
              .join("")}</tr>`,
        )
        .join("");
      const totals = block.totals
        ? `<tfoot><tr>${block.totals
            .map((cell, i) => {
              const col = block.columns[i];
              return `<td class="${col?.align === "right" ? "right" : "left"}${
                col?.numeric ? " num" : ""
              }">${escapeHtml(cell)}</td>`;
            })
            .join("")}</tr></tfoot>`
        : "";
      return `<table class="table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${totals}</table>`;
    }

    case "list": {
      const tag = block.ordered ? "ol" : "ul";
      return `<${tag} class="list">${block.items
        .map(
          (item) =>
            `<li class="${item.emphasis ? "emphasis" : ""}">${escapeHtml(item.text)}${
              item.note ? `<span class="list-note">${escapeHtml(item.note)}</span>` : ""
            }</li>`,
        )
        .join("")}</${tag}>`;
    }

    case "callout":
      return `<div class="callout tone-surface-${block.tone}">
  <p class="callout-title">${escapeHtml(block.title)}</p>
  <p class="callout-body">${escapeHtml(block.body)}</p>
  ${block.legalRef ? `<p class="callout-ref">${escapeHtml(block.legalRef)}</p>` : ""}
</div>`;
  }
};

const renderSection = (section: ReportSection): string => `
<section class="section">
  <h2>${escapeHtml(section.title)}</h2>
  ${section.intro ? `<p class="section-intro">${escapeHtml(section.intro)}</p>` : ""}
  ${section.blocks.map(renderBlock__reports_render).join("\n")}
</section>`;

export const renderReport = (model: ReportModel): string => {
  const { meta } = model;
  const identity = [meta.companyName, meta.orgNumber].filter(Boolean).join(" · ");

  return `<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CLEARANCE – ${escapeHtml(meta.documentTitle)}${
    meta.companyName ? ` – ${escapeHtml(meta.companyName)}` : ""
  }</title>
<style>
  @page { size: A4; margin: 18mm 16mm 20mm; }

  *, *::before, *::after { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0 auto;
    max-width: 190mm;
    padding: 24px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.55;
    color: #1f2937;
    background: #ffffff;
  }

  /* Tone colours carry meaning - a critical deadline must not print grey. */
  .tone-neutral { color: ${TONE_COLOUR.neutral}; }
  .tone-good { color: ${TONE_COLOUR.good}; }
  .tone-warning { color: ${TONE_COLOUR.warning}; }
  .tone-critical { color: ${TONE_COLOUR.critical}; }

  .tone-surface-neutral { background: ${TONE_SURFACE.neutral}; border-color: ${TONE_BORDER.neutral}; }
  .tone-surface-good { background: ${TONE_SURFACE.good}; border-color: ${TONE_BORDER.good}; }
  .tone-surface-warning { background: ${TONE_SURFACE.warning}; border-color: ${TONE_BORDER.warning}; }
  .tone-surface-critical { background: ${TONE_SURFACE.critical}; border-color: ${TONE_BORDER.critical}; }

  header.doc {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
    padding-bottom: 12px;
    border-bottom: 2px solid #1f3a5f;
    margin-bottom: 22px;
  }
  .brand { font-size: 15pt; font-weight: 700; letter-spacing: 0.06em; color: #1f3a5f; }
  .brand-sub { font-size: 8pt; color: #6b7280; letter-spacing: 0.02em; margin-top: 2px; }
  .doc-meta { text-align: right; font-size: 8.5pt; color: #6b7280; }
  .doc-meta strong { display: block; color: #1f2937; font-size: 10pt; }

  h1 { font-size: 17pt; margin: 0 0 4px; letter-spacing: -0.01em; }
  .identity { font-size: 10pt; color: #4b5563; margin: 0 0 20px; }

  h2 {
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: #6b7280;
    margin: 0 0 10px;
    padding-bottom: 5px;
    border-bottom: 1px solid #e5e7eb;
  }
  .section { margin-top: 22px; break-inside: avoid; }
  .section-intro { margin: 0 0 10px; color: #4b5563; }
  .para { margin: 0 0 10px; }

  .kv { margin: 0; }
  .kv-row {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 5px 0;
    border-bottom: 1px solid #f0f0ee;
  }
  .kv-row:last-child { border-bottom: 0; }
  .kv dt { color: #6b7280; }
  .kv dd { margin: 0; font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }
  .kv-note { display: block; font-weight: 400; font-size: 8.5pt; color: #6b7280; }

  .figures { display: flex; gap: 10px; flex-wrap: wrap; }
  .figure {
    flex: 1 1 150px;
    border: 1px solid #e5e7eb;
    padding: 10px 12px;
  }
  .figure-value { margin: 0; font-size: 16pt; font-weight: 700; font-variant-numeric: tabular-nums; }
  .figure-label { margin: 2px 0 0; font-size: 9pt; color: #4b5563; }
  .figure-note { margin: 1px 0 0; font-size: 8pt; color: #6b7280; }

  .table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  .table th {
    text-align: left;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #6b7280;
    font-weight: 600;
    padding: 0 8px 5px 0;
    border-bottom: 1px solid #d1d5db;
  }
  .table td { padding: 5px 8px 5px 0; border-bottom: 1px solid #f0f0ee; vertical-align: top; }
  .table tfoot td {
    font-weight: 700;
    border-top: 1px solid #d1d5db;
    border-bottom: 0;
    padding-top: 7px;
  }
  .table .right { text-align: right; padding-right: 0; }
  .table .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .empty { color: #6b7280; font-style: italic; margin: 0; }

  .list { margin: 0; padding-left: 18px; }
  .list li { margin-bottom: 6px; }
  .list li.emphasis { font-weight: 600; }
  .list-note { display: block; font-weight: 400; font-size: 8.5pt; color: #6b7280; }

  .callout {
    border: 1px solid;
    border-left-width: 3px;
    padding: 10px 12px;
    margin: 0 0 10px;
    break-inside: avoid;
  }
  .callout-title { margin: 0; font-weight: 700; font-size: 10pt; }
  .callout-body { margin: 3px 0 0; font-size: 9.5pt; }
  .callout-ref { margin: 5px 0 0; font-size: 8.5pt; color: #4b5563; font-style: italic; }

  .disclaimer {
    margin-top: 26px;
    padding-top: 10px;
    border-top: 1px solid #d1d5db;
    font-size: 8.5pt;
    color: #4b5563;
    line-height: 1.5;
    break-inside: avoid;
  }
  .disclaimer strong { color: #1f2937; }

  footer.doc {
    margin-top: 14px;
    font-size: 7.5pt;
    color: #9ca3af;
    display: flex;
    justify-content: space-between;
    gap: 16px;
  }

  .print-bar {
    position: sticky;
    top: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    background: #1f3a5f;
    color: #ffffff;
    padding: 10px 14px;
    margin: -24px -24px 22px;
    font-size: 9.5pt;
  }
  .print-bar button {
    font: inherit;
    font-weight: 600;
    background: #ffffff;
    color: #1f3a5f;
    border: 0;
    padding: 7px 14px;
    cursor: pointer;
  }
  .print-bar button:hover { background: #e8eef5; }

  @media print {
    body { padding: 0; max-width: none; }
    .print-bar { display: none; }
    /* Tones are information here, not decoration. */
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="print-bar">
  <span>Välj <strong>Spara som PDF</strong> som destination i utskriftsdialogen.</span>
  <button type="button" onclick="window.print()">Skriv ut / spara som PDF</button>
</div>

<header class="doc">
  <div>
    <div class="brand">CLEARANCE</div>
    <div class="brand-sub">Vägledning vid företagskris</div>
  </div>
  <div class="doc-meta">
    <strong>${escapeHtml(meta.documentTitle)}</strong>
    ${meta.reference ? `Referens: ${escapeHtml(meta.reference)}<br>` : ""}
    Upprättad ${escapeHtml(formatGeneratedAt(meta.generatedAt))}
  </div>
</header>

<h1>${escapeHtml(meta.documentTitle)}</h1>
${identity ? `<p class="identity">${escapeHtml(identity)}</p>` : ""}

${model.lead.map(renderBlock__reports_render).join("\n")}

${model.sections.map(renderSection).join("\n")}

<div class="disclaimer">
  <strong>Ansvarsfriskrivning.</strong> ${escapeHtml(model.disclaimer)}
</div>

<footer class="doc">
  <span>CLEARANCE – ${escapeHtml(meta.documentTitle)}</span>
  <span>Upprättad ${escapeHtml(formatGeneratedAt(meta.generatedAt))}</span>
</footer>
</body>
</html>`;
};

/* ==========================================================================
   src/lib/reports/deliver.ts
   ========================================================================== */

/**
 * Getting a rendered report in front of the user.
 *
 * Real PDF output happens through the browser's own print dialog ("Spara som
 * PDF"), not a bundled PDF library. That keeps roughly a megabyte out of the
 * bundle, gets correct Swedish text shaping and hyphenation for free, and
 * produces a selectable, searchable document rather than an image.
 *
 * The old export claimed to produce a PDF and actually downloaded an .html
 * file, which is why this is split out and named for what it does.
 */

export type DeliveryResult =
  | { ok: true; via: "print-window" | "download" }
  | { ok: false; reason: string };

const slug = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "rapport";

export const reportFileName = (model: ReportModel): string => {
  const date = new Date(model.meta.generatedAt);
  const iso = Number.isNaN(date.getTime())
    ? "odaterad"
    : date.toISOString().slice(0, 10);
  const who = model.meta.companyName ?? model.meta.orgNumber ?? "clearance";
  return `${slug(model.meta.documentTitle)}-${slug(who)}-${iso}.html`;
};

const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

/**
 * Laddar ner rapporten som riktig PDF - byggd av vår egen sättning
 * (src/lib/reports/pdf.ts), inte via utskriftsdialogen. Fungerar därmed
 * även i inbäddade vyer där både popupfönster och utskrift kan blockeras.
 */
export const downloadReportPdf = (model: ReportModel): DeliveryResult => {
  try {
    const bytes = renderReportPdf(model);
    const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
    downloadBlob(blob, reportFileName(model).replace(/\.html$/, ".pdf"));
    return { ok: true, via: "download" };
  } catch {
    return { ok: false, reason: "PDF-filen kunde inte skapas." };
  }
};

/** Saves the report as a self-contained file the user can keep or email. */
export const downloadReport = (model: ReportModel): DeliveryResult => {
  try {
    const blob = new Blob([renderReport(model)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = reportFileName(model);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Revoking immediately can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return { ok: true, via: "download" };
  } catch {
    return { ok: false, reason: "Rapporten kunde inte laddas ner." };
  }
};

// Den gamla popupvägen (window.open + document.write) är borttagen med
// avsikt: i inbäddade och mobila vyer blockerades den tyst, vilket är
// varför alla rapporter numera går genom visaren i appen
// (useInlineReport) eller riktiga PDF-nedladdningar. Återinför den inte.

/* ==========================================================================
   src/lib/reports/invoiceDocuments.ts
   ========================================================================== */

/**
 * Fakturan och kvittot som dokument.
 *
 * Bygger på samma ReportModel som övriga rapporter, så att de skrivs ut genom
 * samma väg och ser ut som resten av det bolaget skickar ifrån sig.
 *
 * Den generella ansvarsfriskrivningen hör inte hemma här. Den handlar om att
 * analyserna bygger på användarens egna uppgifter; en faktura är ett krav på
 * betalning och ska bära sina egna villkor, inte en text om att beloppen kan
 * vara osäkra.
 */

/**
 * Bygger fakturamodellen ur den lagrade kundfakturan - delad av
 * Inställningar och samtalets fakturakort, så att samma faktura aldrig
 * kan se olika ut på två ställen. Beloppen läses från raden och räknas
 * inte om: en faktura som skrivs ut om ett år måste visa vad som
 * fakturerades då, inte vad samma tjänst hade kostat idag.
 */
export const invoiceFromCustomerRecord = (
  record: CustomerInvoiceRecord,
  customer: { name: string; email: string },
): Invoice => ({
  invoiceNumber: record.invoiceNumber,
  issuedAt: record.issuedAt,
  dueAt: record.dueAt,
  seller: COMPANY,
  // Namnet på fakturan är det som stod där när den ställdes ut. Den
  // inloggades nuvarande namn används bara på rader som skapades innan
  // avbildningen fanns - då är det den enda uppgift vi har.
  customer: {
    name: record.customerName ?? customer.name,
    orgNumber: record.customerOrgNumber,
    email: customer.email,
    address: record.customerAddress,
  },
  period:
    record.periodStart && record.periodEnd
      ? { start: record.periodStart, end: record.periodEnd }
      : null,
  lines: [
    {
      description: record.description,
      quantity: 1,
      unitPriceOre: record.netOre,
    },
  ],
  note: null,
  totals: {
    netOre: record.netOre,
    vatOre: record.vatOre,
    grossOre: record.grossOre,
    vatRate: record.vatRate || VAT_RATE,
  },
});

const swedishDate__reports_invoiceDocuments = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });
};

const sellerBlock = (invoice: Invoice) => {
  const { seller } = invoice;
  const accounts = paymentAccounts(seller);
  return [
    { label: "Säljare", value: seller.legalName, note: formatAddress(seller) },
    { label: "Organisationsnummer", value: seller.orgNumber },
    { label: "Momsreg.nr", value: seller.vatNumber },
    ...accounts.map((a) => ({ label: a.label, value: a.number })),
  ];
};

const lineRows = (invoice: Invoice): TableRow[] =>
  invoice.lines.map((line) => ({
    cells: [
      line.description,
      String(line.quantity).replace(".", ","),
      formatOre(line.unitPriceOre),
      formatOre(lineTotalOre(line)),
    ],
  }));

/**
 * Fakturan.
 *
 * Ordningen är den som en mottagares ekonomifunktion läser i: vad det gäller,
 * vad det kostar, när det ska betalas, vart. Betalningsuppgifterna står både
 * i huvudet och sist, eftersom den som betalar ofta bara tittar på slutet.
 */
/**
 * Raden som uppfyller 17 kap. 24 § 7: när tillhandahållandet skedde.
 *
 * Är start och slut samma dag är det en engångsleverans och rubriken ska
 * säga leveransdatum. Skiljer de sig är det en period, och då är det
 * perioden mottagaren behöver för att periodisera kostnaden rätt.
 */
const deliveryRow = (invoice: Invoice): { label: string; value: string } | null => {
  if (!invoice.period) return null;
  const { start, end } = invoice.period;
  if (start === end) return { label: "Leveransdatum", value: swedishDate__reports_invoiceDocuments(start) };
  return { label: "Avser perioden", value: `${swedishDate__reports_invoiceDocuments(start)} – ${swedishDate__reports_invoiceDocuments(end)}` };
};

export const buildInvoiceDocument = (invoice: Invoice): ReportModel => {
  const accounts = paymentAccounts(invoice.seller);
  const vatPercent = `${Math.round(invoice.totals.vatRate * 100)} %`;
  const delivery = deliveryRow(invoice);

  return {
    meta: {
      documentTitle: `Faktura ${invoice.invoiceNumber}`,
      companyName: invoice.customer.name,
      orgNumber: invoice.customer.orgNumber,
      reference: invoice.invoiceNumber,
      generatedAt: invoice.issuedAt,
    },
    lead: [
      {
        kind: "keyValues",
        items: [
          { label: "Fakturanummer", value: invoice.invoiceNumber },
          { label: "Fakturadatum", value: swedishDate__reports_invoiceDocuments(invoice.issuedAt) },
          ...(delivery ? [delivery] : []),
          {
            label: "Förfallodag",
            value: swedishDate__reports_invoiceDocuments(invoice.dueAt),
            tone: "warning",
          },
          {
            label: "Att betala",
            value: formatOre(invoice.totals.grossOre),
          },
        ],
      },
    ],
    sections: [
      {
        title: "Parter",
        blocks: [
          { kind: "keyValues", items: sellerBlock(invoice) },
          {
            kind: "keyValues",
            items: [
              {
                label: "Köpare",
                value: invoice.customer.name,
                note: invoice.customer.address ?? undefined,
              },
              ...(invoice.customer.orgNumber
                ? [{ label: "Organisationsnummer", value: invoice.customer.orgNumber }]
                : []),
              { label: "E-post", value: invoice.customer.email },
            ],
          },
        ],
      },
      {
        title: "Specifikation",
        blocks: [
          {
            kind: "table",
            columns: [
              { label: "Beskrivning" },
              { label: "Antal", align: "right", numeric: true },
              { label: "À-pris", align: "right", numeric: true },
              { label: "Belopp", align: "right", numeric: true },
            ],
            rows: lineRows(invoice),
            totals: ["Summa exkl. moms", "", "", formatOre(invoice.totals.netOre)],
          },
          {
            kind: "keyValues",
            items: [
              { label: "Summa exkl. moms", value: formatOre(invoice.totals.netOre) },
              { label: `Moms ${vatPercent}`, value: formatOre(invoice.totals.vatOre) },
              { label: "Att betala", value: formatOre(invoice.totals.grossOre) },
            ],
          },
          ...(invoice.note ? [{ kind: "paragraph" as const, text: invoice.note }] : []),
        ],
      },
      {
        title: "Betalning",
        blocks: [
          {
            kind: "callout",
            tone: "warning",
            title: `Betala senast ${swedishDate__reports_invoiceDocuments(invoice.dueAt)}`,
            body:
              accounts.length > 0
                ? `Betala till ${accounts
                    .map((a) => `${a.label.toLowerCase()} ${a.number}`)
                    .join(" eller ")}. Ange fakturanummer ${invoice.invoiceNumber} som referens.`
                : `Ange fakturanummer ${invoice.invoiceNumber} som referens.`,
          },
          {
            kind: "list",
            items: [
              {
                text: `Dröjsmålsränta enligt räntelagen (1975:635) 6 § utgår efter förfallodagen.`,
              },
              {
                text: invoice.seller.hasFSkatt
                  ? "Godkänd för F-skatt."
                  : "Uppgift om F-skatt saknas.",
              },
            ],
          },
        ],
      },
    ],
    disclaimer:
      `Faktura utställd av ${invoice.seller.legalName}, org.nr ${invoice.seller.orgNumber}, ` +
      `med säte i ${invoice.seller.registeredOffice}. Frågor om fakturan lämnas via ` +
      `kontaktformuläret på webbplatsen.`,
  };
};

/**
 * Kvittot.
 *
 * Skapas när betalningen har registrerats och lagras i kundens inloggning.
 * Det är medvetet ett eget dokument och inte en stämpel på fakturan: kunden
 * behöver kunna visa vad som betalades, när, och mot vilken faktura - utan
 * att fakturans egna villkorstexter följer med in i bokföringen.
 */
export const buildReceiptDocument = (
  invoice: Invoice,
  payment: { paidAt: string; reference: string | null; receiptNumber: string },
): ReportModel => ({
  meta: {
    documentTitle: `Kvitto ${payment.receiptNumber}`,
    companyName: invoice.customer.name,
    orgNumber: invoice.customer.orgNumber,
    reference: payment.receiptNumber,
    generatedAt: payment.paidAt,
  },
  lead: [
    {
      kind: "callout",
      tone: "good",
      title: "Betalningen är registrerad",
      body:
        `${formatOre(invoice.totals.grossOre)} mottaget ${swedishDate__reports_invoiceDocuments(payment.paidAt)} ` +
        `avseende faktura ${invoice.invoiceNumber}.`,
    },
  ],
  sections: [
    {
      title: "Uppgifter",
      blocks: [
        {
          kind: "keyValues",
          items: [
            { label: "Kvittonummer", value: payment.receiptNumber },
            { label: "Avser faktura", value: invoice.invoiceNumber },
            { label: "Betalningsdatum", value: swedishDate__reports_invoiceDocuments(payment.paidAt) },
            ...(payment.reference
              ? [{ label: "Betalningsreferens", value: payment.reference }]
              : []),
          ],
        },
        {
          kind: "keyValues",
          items: [
            { label: "Belopp exkl. moms", value: formatOre(invoice.totals.netOre) },
            {
              label: `Varav moms ${Math.round(invoice.totals.vatRate * 100)} %`,
              value: formatOre(invoice.totals.vatOre),
            },
            { label: "Totalt betalt", value: formatOre(invoice.totals.grossOre) },
          ],
        },
      ],
    },
    {
      title: "Parter",
      blocks: [
        { kind: "keyValues", items: sellerBlock(invoice) },
        {
          kind: "keyValues",
          items: [
            { label: "Betalare", value: invoice.customer.name },
            ...(invoice.customer.orgNumber
              ? [{ label: "Organisationsnummer", value: invoice.customer.orgNumber }]
              : []),
          ],
        },
      ],
    },
  ],
  disclaimer:
    `Kvitto utställt av ${invoice.seller.legalName}, org.nr ${invoice.seller.orgNumber}. ` +
    `Handlingen visar mottagen betalning och ersätter inte fakturan som bokföringsunderlag.`,
});

/* ==========================================================================
   src/lib/signing.ts
   ========================================================================== */

/**
 * Signeringen: ett godkännande som lämnar bevis efter sig.
 *
 * BankID byggs INTE. Det kräver avtal, kostar per signering och skulle
 * hålla funktionen låst på obestämd tid. I stället gör vi det enda
 * BankID egentligen köper oss - kopplar en namngiven person till ett
 * EXAKT innehåll vid en EXAKT tidpunkt, kontrollerbart i efterhand -
 * med en enkel elektronisk signatur.
 *
 * ÄRLIGHETEN ÄR FUNKTIONEN. Produkten används av människor med
 * juridiskt ansvar. Att låta dem tro att det här är BankID vore värre
 * än att inte ha signering alls, så begränsningen står i klartext både
 * i gränssnittet och på intyget.
 */

/** Det som faktiskt intygas. Versionerad: texten kopieras in i raden. */
export const SIGNATURE_STATEMENT = {
  version: "1.0",
  text:
    "Jag intygar att jag har läst handlingen i sin helhet, att uppgifterna " +
    "i den är riktiga såvitt jag känner till, och att jag godkänner den i " +
    "min roll i ärendet. Jag är införstådd med att tidpunkten och " +
    "handlingens innehåll förseglas och kan visas upp i efterhand.",
} as const;

/**
 * Vad signaturen ÄR och inte är. Visas vid signeringen och på intyget.
 *
 * eIDAS art. 3.10: en enkel elektronisk signatur. Den får inte förvägras
 * rättslig verkan enbart för att den är elektronisk (art. 25.1), och i
 * svensk rätt gäller fri bevisprövning. Men bevisvärdet är lägre än en
 * avancerad eller kvalificerad signatur, och det ska sägas rakt ut.
 */
export const SIGNATURE_LIMITS = [
  "Din identitet bygger på inloggningen till kontot, inte på legitimation.",
  "Detta är en enkel elektronisk signatur – inte BankID, och inte en avancerad eller kvalificerad signatur.",
  "Där lag kräver en viss form, som vid bevittnad namnteckning, räcker den inte.",
] as const;

/** Vad signaturen faktiskt bevisar. Lika viktigt som begränsningarna. */
export const SIGNATURE_STRENGTHS = [
  "Vem: kontot och namnet du skriver in.",
  "Vad: handlingens innehåll förseglas med en kontrollsumma.",
  "När: tidpunkten sätts av servern, inte av din enhet.",
  "Att det syns om innehållet ändras efteråt.",
  "Signaturerna länkas i en kedja – ändras en tidigare post syns det på alla följande.",
] as const;

/** SHA-256 som gemener hex. Samma funktion vid signering och kontroll. */
export const sha256Hex = async (bytes: ArrayBuffer): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

/** Kontrollsumman i läsbara block. En hex-remsa på 64 tecken läses inte. */
export const formatFingerprint = (hash: string): string =>
  (hash.match(/.{1,8}/g) ?? []).slice(0, 4).join(" ").toUpperCase();

export type SignatureIntegrity = "unchanged" | "changed" | "unverifiable";

/**
 * Efterhandskontrollen - hela poängen med hashen.
 *
 * En ändrad fil gör INTE signaturen ogiltig. Den betyder att någon
 * signerade ett annat innehåll än det som ligger där nu, och det är en
 * helt annan sak att berätta för användaren.
 */
export const checkIntegrity = (
  signedHash: string,
  currentHash: string | null,
): SignatureIntegrity => {
  if (!currentHash) return "unverifiable";
  return signedHash.toLowerCase() === currentHash.toLowerCase() ? "unchanged" : "changed";
};

export const INTEGRITY_LABEL: Record<SignatureIntegrity, string> = {
  unchanged: "Innehållet är oförändrat sedan signeringen",
  changed: "Innehållet har ändrats efter signeringen",
  unverifiable: "Innehållet kan inte kontrolleras i den här sessionen",
};

/** Namnet måste vara skrivet, inte klickat. Två tecken är inte ett namn. */
export const isValidSignerName = (name: string): boolean => {
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 120 && /\p{L}/u.test(trimmed);
};

/**
 * BEVISKEDJAN: en oföränderlig länkad rad av signaturhändelser.
 *
 * En kontrollsumma på dokumentet visar att just DEN handlingen inte ändrats.
 * Men en angripare som kommer åt lagret kan ta bort en signatur, ändra ett
 * namn eller backa en tidsstämpel. Kedjan täpper till det: varje post bär
 * kontrollsumman av den FÖREGÅENDE posten, och postens egen kontrollsumma
 * räknas över allt i posten plus den länken. Ändras något i en tidigare post
 * går den inte längre ihop - och alla följande länkar brister med den. Man
 * kan alltså inte tyst skriva om historien; man måste räkna om HELA kedjan,
 * och att den räknats om syns.
 *
 * Det här är inte en kvalificerad signatur och ersätter inte BankID (se
 * SIGNATURE_LIMITS). Det är en ärlig, kontrollerbar beviskedja - vem, vad,
 * när, i vilken ordning - och det är det bevisvärde en enkel elektronisk
 * signatur kan bära under fri bevisprövning.
 */
export interface SignatureEvidence {
  /** Kontrollsumman av det EXAKTA innehåll som signerades. */
  documentHash: string;
  /** Vilken intygstext som gällde (SIGNATURE_STATEMENT.version). */
  statementVersion: string;
  /** Namnet undertecknaren skrev. */
  signerName: string;
  /**
   * Identiteten: det inloggade kontots id. Signaturen binds till kontot,
   * inte till legitimation - och det är det SIGNATURE_LIMITS säger rakt ut.
   */
  signerAccountId: string;
  /** Serverns tidpunkt (ISO), inte enhetens. */
  signedAt: string;
  /** Föregående posts kontrollsumma. null = första länken i kedjan. */
  prevRecordHash: string | null;
}

/** Ett kanoniskt, entydigt textavtryck av posten - underlaget för hashen. */
const canonicalEvidence = (e: SignatureEvidence): string =>
  [
    e.documentHash.toLowerCase(),
    e.statementVersion,
    e.signerName.trim(),
    e.signerAccountId,
    e.signedAt,
    e.prevRecordHash?.toLowerCase() ?? "",
  ].join("\n");

/**
 * Postens egen kontrollsumma. Binder ihop ALLT i posten med föregående länk,
 * så att varken innehåll, namn, tid, ordning eller identitet går att ändra
 * i efterhand utan att det syns.
 */
export const signatureRecordHash = async (e: SignatureEvidence): Promise<string> =>
  sha256Hex(new TextEncoder().encode(canonicalEvidence(e)).buffer);

export type ChainStatus = "intact" | "broken";

/**
 * Kontrollerar hela kedjan: att varje post pekar på rätt föregående länk och
 * att varje kontrollsumma faktiskt räknas fram ur postens innehåll. Ett enda
 * ändrat tecken någonstans ger "broken".
 */
export const verifyChain = async (
  records: { evidence: SignatureEvidence; recordHash: string }[],
): Promise<ChainStatus> => {
  let prev: string | null = null;
  for (const r of records) {
    if ((r.evidence.prevRecordHash ?? null) !== prev) return "broken";
    const beraknad = await signatureRecordHash(r.evidence);
    if (beraknad.toLowerCase() !== r.recordHash.toLowerCase()) return "broken";
    prev = r.recordHash;
  }
  return "intact";
};

export const CHAIN_LABEL: Record<ChainStatus, string> = {
  intact: "Signaturkedjan är obruten – ingen post har ändrats i efterhand",
  broken: "Signaturkedjan går inte ihop – en post har ändrats eller tagits bort",
};

/** "3 mars 2026 kl. 14:07" - tidpunkten ska gå att läsa högt. */
export const formatSignedAt = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })} kl. ${d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}`;
};

/* ==========================================================================
   src/lib/reports/signatureDocument.ts
   ========================================================================== */

/**
 * Signeringsintyget.
 *
 * Beviset man kan ta med sig: vem som signerade, vilket innehåll,
 * när, och exakt vad som intygades - plus om innehållet är oförändrat
 * sedan dess.
 *
 * Intyget är MEDVETET rakt om vad signaturen inte är. Ett intyg som
 * antyder BankID-nivå är sämre än inget intyg alls: det som ska göra
 * någon trygg får inte vara det som vilseleder dem.
 */

export const buildSignatureCertificate = (input: {
  documentName: string;
  documentKind: string;
  signatures: DocumentSignature[];
  currentHash: string | null;
  companyName: string | null;
  orgNumber: string | null;
  generatedAt: string;
}): ReportModel => {
  const rows: TableRow[] = input.signatures.map((s) => {
    const integrity = checkIntegrity(s.contentSha256, input.currentHash);
    return {
      cells: [
        s.signerName,
        s.signerEmail,
        formatSignedAt(s.signedAt),
        INTEGRITY_LABEL[integrity],
      ],
      tone: integrity === "changed" ? "critical" : integrity === "unchanged" ? "good" : "warning",
    };
  });

  const statement = input.signatures[0]?.statementText ?? "";
  const version = input.signatures[0]?.statementVersion ?? "";
  const sealed = input.signatures[0]?.contentSha256 ?? "";

  return {
    meta: {
      documentTitle: "Signeringsintyg",
      companyName: input.companyName,
      orgNumber: input.orgNumber,
      reference: input.documentName,
      generatedAt: input.generatedAt,
    },
    lead: [
      {
        kind: "callout",
        tone: rows.some((r) => r.tone === "critical") ? "critical" : "good",
        title: `${input.signatures.length} signatur${input.signatures.length === 1 ? "" : "er"} på ${input.documentName}`,
        body:
          "Intyget visar vem som signerade handlingen, vid vilken tidpunkt och " +
          "vilket innehåll som förseglades. Kontrollsumman gör att en ändring " +
          "efter signeringen går att upptäcka.",
      },
      {
        kind: "keyValues",
        items: [
          { label: "Handling", value: input.documentName, note: input.documentKind },
          {
            label: "Förseglat innehåll",
            value: formatFingerprint(sealed),
            note: `SHA-256: ${sealed}`,
          },
          {
            label: "Intygets lydelse",
            value: `Version ${version}`,
          },
        ],
      },
    ],
    sections: [
      {
        title: "Signaturer",
        blocks: [
          {
            kind: "table",
            columns: [
              { label: "Namn" },
              { label: "Konto" },
              { label: "Tidpunkt" },
              { label: "Innehållskontroll" },
            ],
            rows,
            emptyText: "Handlingen är inte signerad.",
          },
        ],
      },
      {
        title: "Detta intygades",
        blocks: [{ kind: "paragraph", text: statement }],
      },
      {
        title: "Signaturens räckvidd",
        intro:
          "Enkel elektronisk signatur enligt eIDAS-förordningen artikel 3.10. " +
          "En sådan signatur får inte förvägras rättslig verkan enbart för att " +
          "den är elektronisk (artikel 25.1), och svensk rätt tillämpar fri " +
          "bevisprövning. Bevisvärdet är samtidigt lägre än vid en avancerad " +
          "eller kvalificerad signatur.",
        blocks: [
          {
            kind: "list",
            items: SIGNATURE_LIMITS.map((text) => ({ text })),
          },
        ],
      },
    ],
    disclaimer:
      "Intyget är framställt av CLEARANCE ur ärendets egen journal. Det styrker " +
      "att en inloggad användare har utfört signeringen vid angiven tidpunkt och " +
      "att innehållet då motsvarade den angivna kontrollsumman. Det styrker inte " +
      "undertecknarens identitet på det sätt som en legitimationskontroll gör.",
  };
};

/* ==========================================================================
   src/lib/reports/timeBasis.ts
   ========================================================================== */

/**
 * Fakturaunderlaget ur tidsposterna: byråns loggade tid i ett ärende som
 * ett strukturerat underlag för byråns EGEN fakturering.
 *
 * Viktig gräns: detta är ett underlag, inte en faktura. CLEARANCE ställer
 * inte ut byråns kundfakturor och sätter inte byråns priser - timpriset
 * och momssatsen är byråns egna inmatningar, aldrig plattformens
 * parametrar. Därför skrivs de ut i dokumentet: en granskare ska kunna se
 * exakt vilka antaganden beloppen bygger på.
 */

export interface TimeBasisInput {
  companyName: string | null;
  orgNumber: string | null;
  caseId: string;
  /** Byråns namn, som avsändare på underlaget. */
  firmName: string | null;
  entries: TimeEntryRecord[];
  /** Byråns eget timpris i kronor. */
  hourlyRateSek: number;
  /** Momssats i procent, t.ex. 25. Byråns egen uppgift. */
  vatRatePercent: number;
  generatedAt: string;
}

const kr__reports_timeBasis = (value: number): string =>
  `${Math.round(value).toLocaleString("sv-SE")} kr`;

const hours = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
};

const svDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });

export const buildTimeBasisReport = (input: TimeBasisInput): ReportModel => {
  const entries = [...input.entries].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));
  const totalMinutes = entries.reduce((sum, e) => sum + e.minutes, 0);
  const net = (totalMinutes / 60) * input.hourlyRateSek;
  const vat = net * (input.vatRatePercent / 100);

  const rows: TableRow[] = entries.map((e) => ({
    cells: [
      svDate(e.occurredOn),
      e.note ?? "Arbete i ärendet",
      hours(e.minutes),
      kr__reports_timeBasis((e.minutes / 60) * input.hourlyRateSek),
    ],
  }));

  return {
    meta: {
      documentTitle: "Fakturaunderlag – nedlagd tid",
      companyName: input.companyName,
      orgNumber: input.orgNumber,
      reference: input.caseId,
      generatedAt: input.generatedAt,
    },
    lead: [
      {
        kind: "paragraph",
        text: `Nedlagd tid i ärendet${input.firmName ? `, registrerad av ${input.firmName}` : ""}. Underlaget är byråns eget faktureringsunderlag – fakturan ställs ut av byrån, i byråns eget system.`,
      },
      {
        kind: "figures",
        items: [
          { value: hours(totalMinutes), label: "Total tid" },
          { value: kr__reports_timeBasis(net), label: "Belopp exkl. moms" },
          { value: kr__reports_timeBasis(net + vat), label: `Inkl. moms ${input.vatRatePercent} %` },
        ],
      },
    ],
    sections: [
      {
        title: "Specifikation",
        blocks: [
          {
            kind: "table",
            columns: [
              { label: "Datum" },
              { label: "Arbete" },
              { label: "Tid", align: "right", numeric: true },
              { label: "Belopp", align: "right", numeric: true },
            ],
            rows,
            totals: ["", "Summa", hours(totalMinutes), kr__reports_timeBasis(net)],
            emptyText: "Inga tidsposter i ärendet.",
          },
          {
            kind: "keyValues",
            items: [
              { label: "Timpris (byråns egen uppgift)", value: `${input.hourlyRateSek.toLocaleString("sv-SE")} kr/h` },
              { label: "Belopp exkl. moms", value: kr__reports_timeBasis(net) },
              { label: `Moms ${input.vatRatePercent} %`, value: kr__reports_timeBasis(vat) },
              { label: "Att fakturera inkl. moms", value: kr__reports_timeBasis(net + vat) },
            ],
          },
        ],
      },
    ],
    disclaimer:
      "Detta är ett underlag för byråns egen fakturering, inte en faktura. Timpris och momssats är byråns egna uppgifter och har inte kontrollerats av CLEARANCE. Beloppen är beräknade ur registrerade tidsposter vid genereringstillfället.",
  };
};

/* ==========================================================================
   src/lib/sources/google.ts
   ========================================================================== */

/**
 * GOOGLE SOM KÄLLA: vad vi faktiskt kan hämta, och vad vi inte kan.
 *
 * Frågan var "det här ska vi kunna hämta från Google". Svaret är delvis
 * ja, och den här filen är där gränsen dras - för gränsen är inte
 * uppenbar, och att ta fel på den är dyrare än att inte hämta något alls.
 *
 * VAD GOOGLE GER (Places API, Place Details):
 *
 *  - Bolagets webbadress. Det är den uppgift som saknades för att
 *    webbplatsläsaren skulle kunna köra. Vi behövde be användaren om
 *    den; nu behöver vi inte.
 *  - Telefon, besöksadress, öppettider.
 *  - Betyg, antal omdömen och de senaste recensionerna.
 *  - VERKSAMHETSSTATUS. Google vet om ett ställe är permanent eller
 *    tillfälligt stängt. För den här produkten är det inte en detalj -
 *    det är en av de starkaste yttre signalerna som finns om ett bolag i
 *    kris, och den kommer från en källa som inte är användarens egen bild.
 *
 * VAD GOOGLE INTE GER, och det är den viktigaste raden i filen:
 *
 *  - ORGANISATIONSNUMMER, STYRELSE, F-SKATT OCH MOMSREGISTRERING finns
 *    inte hos Google. Det är Bolagsverket och Skatteverket. Google Places
 *    känner till PLATSER och verksamheter, inte juridiska personer. Raden
 *    "Offentlig företagsinformation" i bakgrundspanelen går alltså INTE
 *    att lösa den här vägen, hur gärna man än vill.
 *  - Sociala medier. Att skrapa Googles sökresultat för att komma åt
 *    LinkedIn-sidor bryter mot Googles egna villkor, och löser dessutom
 *    inte plattformarnas.
 *  - SCB:s branschtal.
 *
 * MATCHNINGEN ÄR DEN FARLIGA DELEN.
 *
 * Google har inget organisationsnummer att matcha på. En sökning på
 * "Nordbygg AB" kan lika gärna träffa ett annat bolag med nästan samma
 * namn i en annan stad. Att då visa NÅGON ANNANS två stjärnor i en analys
 * av det här bolagets läge vore ett fel som ser ut som en uppgift.
 *
 * Därför matchar den här koden inte ungefär. Den normaliserar namnet,
 * kräver en exakt träff efter normalisering, och vägrar när det finns
 * fler än en sådan. Ett uteblivet svar är ett hederligt utfall; ett
 * gissat svar är det inte.
 */

/** Vad ett fält vilar på. Följer med varje uppgift ut i analysen. */
export interface GoogleBasis {
  field: string;
  source: string;
}

export interface GoogleReviewSummary {
  /** Snittbetyg 1-5, eller null när inga omdömen finns. */
  rating: number | null;
  /** Antal omdömen betyget vilar på. */
  count: number;
  /**
   * De senaste omdömenas text, förkortade.
   *
   * UTAN FÖRFATTARE. Google returnerar namn, profilbild och länk för
   * varje recensent. Det är personuppgifter om tredje man som analysen
   * inte behöver för någonting - vi läser omdömet om bolaget, inte om
   * människan som skrev det.
   */
  excerpts: string[];
}

export type GoogleStatus = "oppet" | "tillfalligt-stangt" | "permanent-stangt" | "okant";

export interface GoogleFacts {
  /** Googles eget id för platsen. Får sparas utan tidsgräns; se CACHE_MAX_DAYS. */
  placeId: string | null;
  name: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  status: GoogleStatus;
  reviews: GoogleReviewSummary;
  basis: GoogleBasis[];
}

/**
 * Hur länge Googles innehåll får ligga kvar.
 *
 * Places-villkoren tillåter cachning i högst 30 dagar för innehållet;
 * platsens id får däremot sparas utan tidsgräns, just för att kunna slå
 * upp på nytt. Den skillnaden är inte en petitess: den är skillnaden
 * mellan att förnya en uppgift och att bygga ett eget register av
 * någon annans data, vilket villkoren förbjuder.
 */
export const CACHE_MAX_DAYS = 30;

/**
 * Texten som måste visas där Googles uppgifter visas.
 *
 * Villkoren kräver attribution. Den står här och inte i en komponent, så
 * att den följer med uppgiften och inte glöms av nästa vy som visar den.
 */
export const ATTRIBUTION = "Uppgifter från Google";

/**
 * Namnet, avskalat till det som går att jämföra.
 *
 * Bolagsformen åker bort: Google skriver "Nordbygg", Bolagsverket
 * "Nordbygg Aktiebolag", och användaren skriver "Nordbygg AB". Alla tre
 * är samma bolag, och en jämförelse som inte klarar det matchar aldrig.
 */
export const normalizeName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[.,()]/g, " ")
    .replace(/\b(aktiebolag|ab|publ|handelsbolag|hb|kommanditbolag|kb)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Sökfrågan.
 *
 * Organisationsnumret tas INTE med. Google indexerar det inte, och ett
 * nummer i frågan gör bara att textsökningen tappar den träff den hade
 * hittat på namnet. Orten tas med när vi har den - den är det enda vi kan
 * ge för att skilja två likadana namn åt.
 */
export const placeQuery = (companyName: string, ort?: string): string =>
  [companyName.trim(), ort?.trim()].filter((d) => d && d.length > 0).join(" ");

export interface PlaceCandidate {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  businessStatus?: string;
  rating?: number;
  userRatingCount?: number;
  reviews?: { text?: { text?: string }; originalText?: { text?: string } }[];
}

export type MatchResult =
  | { ok: true; place: PlaceCandidate }
  | { ok: false; reason: string };

/**
 * Väljer träffen - eller vägrar.
 *
 * Tre utfall, och de två sista är lika viktiga som det första:
 *
 *  1. Exakt en kandidat vars normaliserade namn är bolagets → träff.
 *  2. Flera sådana → VÄGRAN. Två bolag med samma namn på olika orter är
 *     vanligt i Sverige, och att välja den med flest recensioner vore att
 *     välja den som syns mest, inte den som är rätt.
 *  3. Ingen → VÄGRAN. Ingen liknande-nog-logik. Ett bolag som inte finns
 *     på Google är ett vanligt, odramatiskt utfall - särskilt för bolag
 *     utan besöksadress, vilket är precis den sortens bolag som ofta
 *     hamnar här.
 */
export const matchPlace = (
  candidates: PlaceCandidate[],
  companyName: string,
): MatchResult => {
  const want = normalizeName(companyName);
  if (want.length === 0) return { ok: false, reason: "Inget bolagsnamn att söka på." };

  const exakta = candidates.filter(
    (c) => normalizeName(c.displayName?.text ?? "") === want,
  );
  if (exakta.length === 1) return { ok: true, place: exakta[0] };
  if (exakta.length > 1) {
    return {
      ok: false,
      reason:
        `Flera verksamheter heter ${companyName}. Jag väljer ingen av dem – ` +
        "fel bolags omdömen i din analys vore värre än inga omdömen alls.",
    };
  }
  return {
    ok: false,
    reason: `Hittade ingen verksamhet som heter exakt ${companyName} hos Google.`,
  };
};

const STATUS: Record<string, GoogleStatus> = {
  OPERATIONAL: "oppet",
  CLOSED_TEMPORARILY: "tillfalligt-stangt",
  CLOSED_PERMANENTLY: "permanent-stangt",
};

/** Recensionstext, förkortad och utan författare. */
const excerpt = (r: { text?: { text?: string }; originalText?: { text?: string } }): string => {
  const raw = (r.text?.text ?? r.originalText?.text ?? "").replace(/\s+/g, " ").trim();
  return raw.length > 180 ? `${raw.slice(0, 177)}…` : raw;
};

/**
 * Uppgifterna ur en träff.
 *
 * Bara fält som stod i svaret. Ett fält som saknas blir null och inte en
 * tom sträng - skillnaden mellan "Google hade ingen webbadress" och
 * "webbadressen är tom" avgör om vi ska fråga användaren.
 */
export const extractGoogleFacts = (place: PlaceCandidate): GoogleFacts => {
  const basis: GoogleBasis[] = [];
  const note = (field: string) => basis.push({ field, source: "Google Places" });

  const name = place.displayName?.text?.trim() || null;
  if (name) note("namn");

  const website = place.websiteUri?.trim() || null;
  if (website) note("webbadress");

  const phone = (place.nationalPhoneNumber ?? place.internationalPhoneNumber)?.trim() || null;
  if (phone) note("telefon");

  const address = place.formattedAddress?.trim() || null;
  if (address) note("besöksadress");

  const status = STATUS[place.businessStatus ?? ""] ?? "okant";
  if (status !== "okant") note("verksamhetsstatus");

  const count = typeof place.userRatingCount === "number" ? place.userRatingCount : 0;
  const rating = typeof place.rating === "number" && count > 0 ? place.rating : null;
  if (rating !== null) note("betyg");

  const excerpts = (place.reviews ?? []).map(excerpt).filter((t) => t.length > 0);

  return {
    placeId: place.id?.trim() || null,
    name,
    website,
    phone,
    address,
    status,
    reviews: { rating, count, excerpts },
    basis,
  };
};

/**
 * Vad betyget får sägas betyda.
 *
 * Ett snittbetyg på fyra omdömen är inte ett omdöme om bolaget, det är
 * fyra personers dag. Den här funktionen finns för att analysen inte ska
 * behandla de två fallen lika - och för att en tunn siffra ska säga att
 * den är tunn i stället för att bara vara liten.
 */
export const reviewSignal = (r: GoogleReviewSummary): string => {
  if (r.count === 0) return "Inga omdömen hos Google.";
  if (r.count < 5) {
    return `${r.rating?.toFixed(1)} i betyg på bara ${r.count} omdömen – för få för att säga något om kundrelationerna.`;
  }
  return `${r.rating?.toFixed(1)} i betyg på ${r.count} omdömen.`;
};

/**
 * Verksamhetsstatusen i klartext.
 *
 * "Permanent stängt" hos Google medan bolaget lever är inte ett fel i
 * datan - det är ofta en uppgift NÅGON ANNAN lagt in, och det syns utåt
 * för alla kunder och leverantörer som söker på bolaget. Därför
 * formuleras det som något att åtgärda, inte som ett konstaterande om
 * bolaget.
 */
export const statusNote = (status: GoogleStatus): string => {
  switch (status) {
    case "permanent-stangt":
      return (
        "Google visar bolaget som PERMANENT STÄNGT. Stämmer det inte behöver det " +
        "rättas – alla som söker på er ser det, inklusive kunder och leverantörer."
      );
    case "tillfalligt-stangt":
      return "Google visar bolaget som tillfälligt stängt.";
    case "oppet":
      return "Google visar verksamheten som öppen.";
    default:
      return "Google säger inget om verksamhetsstatus.";
  }
};

/** Raden i bakgrundspanelen. Räknar bara det som faktiskt kom med. */
export const googleNote = (f: GoogleFacts): string => {
  const delar: string[] = [];
  if (f.website) delar.push("webbadress");
  if (f.phone) delar.push("telefon");
  if (f.address) delar.push("besöksadress");
  if (f.reviews.count > 0) delar.push(`${f.reviews.count} omdömen`);
  if (delar.length === 0) return "Google hade ingen användbar uppgift om bolaget.";
  return `${ATTRIBUTION}: ${delar.join(", ")}.`;
};

/* ==========================================================================
   src/lib/sources/news.ts
   ========================================================================== */

/**
 * NYHETER OM BOLAGET: den fjärde källan som faktiskt går att koppla på.
 *
 * Stod som "ingen källa ansluten" med noten "en namngiven nyhetskälla".
 * Den noten var korrekt men gjorde ingenting, och det här är den byggd.
 *
 * VARFÖR RSS OCH INGENTING ANNAT. Ett RSS-flöde publiceras för att
 * prenumereras på - att hämta det är dess syfte, och det kräver inget
 * avtal. Djup svensk mediebevakning (Retriever, Meltwater) kräver
 * abonnemang och är fortfarande inte kopplad; det står kvar i registret.
 * Att i stället skrapa söksidor hade varit avtalsbrott och hade slutat
 * fungera vid nästa layoutändring - se resonemanget i registry.ts.
 *
 * TRE REGLER SOM STYR FILEN.
 *
 *  1. RUBRIK, DATUM, LÄNK OCH KÄLLA - INGET MER. Artikeltexten är
 *     upphovsrättsskyddad. Vi lagrar den inte, sammanfattar den inte och
 *     visar den inte. Den som vill läsa artikeln följer länken till den
 *     som skrev den.
 *  2. EN TRÄFF SKA GÅ ATT FÖRSVARA. Matchningen kräver bolagsnamnet som
 *     en sammanhängande fras eller organisationsnumret - aldrig lösa ord.
 *     "Bygg" i en rubrik är inte en nyhet om Bygg AB.
 *  3. ETT FÖR ALLMÄNT NAMN MATCHAS INTE ALLS. Ett bolag som heter
 *     "Bygg AB" eller "Service AB" går inte att skilja från branschen i en
 *     rubrik. Då säger produkten det, i stället för att leverera brus som
 *     ser ut som bevakning. Det är hela skillnaden mellan en källa och en
 *     sökmotor.
 *
 * Filen är ren: inga nätanrop. Hämtningen bor i api/server/news.ts, dels
 * för att webbläsaren inte får ringa tredje part (vaktat av
 * tests/browser/no-external-requests.mjs), dels för att tolkningen ska gå
 * att pröva mot verkliga flöden utan att hämta något.
 */

export interface NewsItem {
  title: string;
  /** Absolut länk till artikeln hos den som publicerade den. */
  link: string;
  /** ISO-datum, eller null när flödet inte angav något. */
  publishedAt: string | null;
  /** Flödets namn, så att varje rad kan svara på "var kommer det ifrån?". */
  source: string;
}

export interface NewsHit extends NewsItem {
  /** Varför raden räknas som en träff. Visas för läsaren. */
  matchedOn: "namn" | "orgnr";
}

/* -------------------------------------------------------------------------- */
/* Tolkningen av flödet                                                       */
/* -------------------------------------------------------------------------- */

/** Vanliga XML-entiteter plus numeriska. Flöden är fulla av dem. */
const avkoda = (s: string): string =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number.parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    // Ampersanden sist: annars avkodas &amp;lt; till < i två steg.
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

/** Innehållet i första <tagg> ... </tagg>, oavsett namnrymdsprefix. */
const taggInnehall = (xml: string, tagg: string): string | null => {
  const m = new RegExp(`<(?:\\w+:)?${tagg}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tagg}>`, "i").exec(xml);
  return m ? avkoda(m[1]) : null;
};

/**
 * Länken.
 *
 * RSS lägger den i elementets text, Atom i ett href-attribut - och Atom
 * kan ha flera <link> där bara `rel="alternate"` (eller inget rel) pekar
 * på artikeln. Att ta den första bästa ger ibland en länk till flödet
 * självt.
 */
const lasLank = (xml: string): string | null => {
  /*
   * Atom först: href i ett attribut. Ett <link rel="self"> pekar på flödet
   * och inte på artikeln, så bara `alternate` - eller inget rel alls -
   * räknas.
   *
   * Att försöka läsa båda formerna i ETT uttryck var den första versionen,
   * och den var trasig: en lat grupp följd av en valfri sluttagg matchar
   * tomma strängen, så RSS-länken hittades aldrig och bevakningen blev
   * tom utan att något gick sönder. Formerna läses därför var för sig.
   */
  for (const m of xml.matchAll(/<(?:\w+:)?link\b([^>]*?)\/?>/gi)) {
    const attrDel = m[1] ?? "";
    const href = /href\s*=\s*["']([^"']*)["']/i.exec(attrDel)?.[1];
    if (!href) continue;
    const rel = /rel\s*=\s*["']([^"']*)["']/i.exec(attrDel)?.[1]?.toLowerCase();
    if (rel && rel !== "alternate") continue;
    return avkoda(href);
  }
  // RSS: adressen står som elementets text.
  const text = taggInnehall(xml, "link");
  return text && /^https?:\/\//i.test(text) ? text : null;
};

/**
 * Datumet som ISO, eller null.
 *
 * Ett flöde utan datum är inte ogiltigt - men en nyhet utan datum går
 * inte att sortera eller bedöma färskhet på, och då säger vi null i
 * stället för att sätta dagens datum och låtsas.
 */
const lasDatum = (xml: string): string | null => {
  for (const tagg of ["pubDate", "published", "updated", "date"]) {
    const rått = taggInnehall(xml, tagg);
    if (!rått) continue;
    const t = Date.parse(rått);
    if (Number.isFinite(t)) return new Date(t).toISOString();
  }
  return null;
};

/**
 * Läser ut posterna ur ett RSS 2.0- eller Atom-flöde.
 *
 * Poster utan rubrik eller utan länk hoppas över: en rad som inte går att
 * öppna är inte en nyhet, den är en påstådd nyhet.
 */
export const parseFeed = (xml: string, source: string): NewsItem[] => {
  const poster: NewsItem[] = [];
  const block = /<(?:\w+:)?(item|entry)\b[^>]*>([\s\S]*?)<\/(?:\w+:)?\1>/gi;
  for (const m of xml.matchAll(block)) {
    const kropp = m[2];
    const title = taggInnehall(kropp, "title");
    const link = lasLank(kropp);
    if (!title || !link || !/^https?:\/\//i.test(link)) continue;
    poster.push({ title, link, publishedAt: lasDatum(kropp), source });
  }
  return poster;
};

/* -------------------------------------------------------------------------- */
/* Matchningen                                                                */
/* -------------------------------------------------------------------------- */

/** Bolagsformer som inte hjälper någon att känna igen bolaget i en rubrik. */
const BOLAGSFORMER =
  /\b(aktiebolag|ab|hb|kb|ekonomisk förening|ek\.? för\.?|publ|holding|group|sverige)\b/gi;

/**
 * Namnet som det går att leta efter: utan bolagsform, utan skiljetecken,
 * gemener, ett mellanslag mellan orden.
 */
export const normaliseraNamn = (namn: string): string =>
  namn
    .toLowerCase()
    .replace(/[.,()]/g, " ")
    .replace(BOLAGSFORMER, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Namn som inte går att matcha på utan att dra in halva branschen.
 *
 * Listan är avsiktligt kort och konkret. Regeln som gör mest jobb är den
 * som INTE står i listan: ett namn under fyra tecken, eller ett enda
 * vanligt ord, matchas inte heller.
 */
const FOR_ALLMANNA = new Set([
  "bygg", "service", "handel", "konsult", "transport", "el", "vvs", "data",
  "media", "fastighet", "fastigheter", "invest", "trading", "produktion",
]);

/**
 * Går bolagsnamnet att söka på utan att träffa fel bolag?
 *
 * Svaret används för att SÄGA något, inte bara för att tiga: panelen
 * skriver ut att namnet är för allmänt, och att bevakningen därför vilar
 * på organisationsnumret. Ett tyst nollresultat hade lästs som "inget har
 * hänt", vilket är ett helt annat påstående.
 */
export const namnGarAttMatcha = (companyName: string): boolean => {
  const n = normaliseraNamn(companyName);
  if (n.length < 4) return false;
  const ord = n.split(" ").filter(Boolean);
  if (ord.length === 0) return false;
  if (ord.length === 1 && FOR_ALLMANNA.has(ord[0])) return false;
  return true;
};

/** Organisationsnumret i alla former det brukar skrivas. */
const orgnrVarianter = (orgNumber: string): string[] => {
  const siffror = orgNumber.replace(/\D/g, "");
  if (siffror.length !== 10) return [];
  return [siffror, `${siffror.slice(0, 6)}-${siffror.slice(6)}`];
};

/**
 * Matchar en post mot bolaget, eller null.
 *
 * Namnet måste förekomma som en SAMMANHÄNGANDE FRAS med ordgränser i
 * början och slutet. "Nordisk Bygg" matchar inte "Nordiska Byggvaror",
 * och det är avsikten - en felaktig träff i ett krisärende är värre än
 * ingen träff alls.
 */
export const matchaPost = (
  post: NewsItem,
  bolag: { companyName: string; orgNumber: string },
): NewsHit | null => {
  const rubrik = post.title.toLowerCase();

  for (const variant of orgnrVarianter(bolag.orgNumber)) {
    if (rubrik.includes(variant)) return { ...post, matchedOn: "orgnr" };
  }

  if (!namnGarAttMatcha(bolag.companyName)) return null;
  const namn = normaliseraNamn(bolag.companyName);
  const rubrikNorm = normaliseraNamn(post.title);
  // Ordgräns i båda ändar, på den normaliserade texten.
  const monster = new RegExp(
    `(^|\\s)${namn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|\\s)`,
  );
  if (monster.test(rubrikNorm)) return { ...post, matchedOn: "namn" };
  return null;
};

/* -------------------------------------------------------------------------- */
/* Sammanställningen                                                          */
/* -------------------------------------------------------------------------- */

/** Samma artikel syndikeras. Två rader om en händelse är inte två händelser. */
const nyckel = (h: NewsHit): string => {
  try {
    const u = new URL(h.link);
    // Spårningsparametrar gör två identiska länkar olika.
    return `${u.host}${u.pathname}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return h.link.toLowerCase();
  }
};

/**
 * Träffarna, avdubblerade och nyast först.
 *
 * Poster utan datum hamnar sist: de går inte att tidsätta, och en odaterad
 * rad högst upp hade sett ut som den färskaste.
 */
export const sammanstall = (traffar: NewsHit[], max = 10): NewsHit[] => {
  const sedda = new Set<string>();
  const rubriker = new Set<string>();
  const ut: NewsHit[] = [];

  const sorterade = [...traffar].sort((a, b) => {
    if (a.publishedAt && b.publishedAt) return b.publishedAt.localeCompare(a.publishedAt);
    if (a.publishedAt) return -1;
    if (b.publishedAt) return 1;
    return 0;
  });

  for (const h of sorterade) {
    const k = nyckel(h);
    const r = normaliseraNamn(h.title);
    if (sedda.has(k) || rubriker.has(r)) continue;
    sedda.add(k);
    rubriker.add(r);
    ut.push(h);
    if (ut.length >= max) break;
  }
  return ut;
};

/* -------------------------------------------------------------------------- */
/* Vad panelen säger                                                          */
/* -------------------------------------------------------------------------- */

export interface FeedOutcome {
  name: string;
  /** "svarade" | "svarade-inte" - per flöde, så att en död länk syns. */
  status: "svarade" | "svarade-inte";
  /** Antal poster i flödet, inte antal träffar. */
  items: number;
}

/**
 * Noten som visas för användaren.
 *
 * Den ska kunna svara på tre frågor utan att någon behöver fråga: hur
 * många flöden som lästes, hur många som svarade, och varför resultatet
 * blev som det blev. Ett flöde som inte svarade döljs aldrig - en
 * bevakning som tyst blivit tunnare är den farligaste sortens tomrum.
 */
export const newsNote = (
  hits: NewsHit[],
  utfall: FeedOutcome[],
  bolag: { companyName: string },
): string => {
  const svarade = utfall.filter((u) => u.status === "svarade");
  const tysta = utfall.filter((u) => u.status !== "svarade");

  if (utfall.length === 0) {
    return "Ingen nyhetskälla är angiven i driften ännu.";
  }

  const kallor = `${svarade.length} av ${utfall.length} ${
    utfall.length === 1 ? "flöde" : "flöden"
  } svarade`;
  const tystnad = tysta.length > 0 ? ` (${tysta.map((t) => t.name).join(", ")} svarade inte)` : "";

  if (!namnGarAttMatcha(bolag.companyName)) {
    return (
      `${kallor}${tystnad}. Bolagsnamnet är för allmänt för att sökas på utan att ` +
      "träffa andra bolag, så bevakningen vilar på organisationsnumret."
    );
  }

  if (hits.length === 0) {
    return `${kallor}${tystnad}. Ingen artikel nämnde bolaget vid namn eller organisationsnummer.`;
  }

  return (
    `${kallor}${tystnad}. ${hits.length} ${hits.length === 1 ? "artikel" : "artiklar"} ` +
    "nämner bolaget. Bara rubrik, datum och länk sparas - artikeltexten är upphovsrättsskyddad."
  );
};

/* ==========================================================================
   src/lib/sources/website.ts
   ========================================================================== */

/**
 * BOLAGETS EGEN WEBBPLATS: hämtningen som faktiskt är tillåten.
 *
 * Av de sex källor som stod som "ingen källa ansluten" är det här den enda
 * som går att använda idag utan avtal - se registry.ts för varför de andra
 * inte gör det.
 *
 * Filen innehåller BARA REN UTVINNING. Inga nätanrop: de hör hemma i
 * API:et, dels för att webbläsaren ändå inte får ringa tredje part (det
 * vaktas av tests/browser/no-external-requests.mjs), dels för att en ren
 * funktion går att pröva mot verkliga sidor utan att hämta något.
 *
 * TRE REGLER SOM UTVINNINGEN FÖLJER:
 *
 *  1. INGET GISSAS. Saknas en uppgift saknas den. En beskrivning som
 *     "troligen ett byggföretag" härledd ur ett ord i en rubrik är precis
 *     den sortens uppgift som ser användbar ut och inte går att stå för.
 *  2. INGA PERSONUPPGIFTER PLOCKAS UT. Namn och personliga adresser på
 *     en kontaktsida är personuppgifter, och analysen behöver dem inte.
 *     Bolagets växel och info-adress räcker.
 *  3. STRUKTURERAD DATA FÖRE TEXT. JSON-LD och OpenGraph är publicerade
 *     för att läsas maskinellt. Att i stället tolka brödtext är att gissa
 *     med extra steg.
 */

/* -------------------------------------------------------------------------- */
/* robots.txt                                                                 */
/* -------------------------------------------------------------------------- */

export interface RobotsRules {
  /** Sökvägsprefix som är förbjudna för oss. */
  disallow: string[];
  /** Sekunder mellan hämtningar, om sajten ber om det. */
  crawlDelay: number | null;
}

/**
 * Tolkar robots.txt för VÅR user-agent.
 *
 * En grupp som pekar ut oss vid namn vinner över `*`. Saknas filen helt
 * gäller inga regler - det är vad frånvaron betyder, inte "förbjudet".
 *
 * `Disallow:` utan värde betyder uttryckligen "allt tillåtet" och ska inte
 * bli ett tomt prefix som matchar varje sökväg. Den detaljen är skillnaden
 * mellan att hämta en sida och att aldrig hämta någonting.
 */
export const parseRobots = (text: string, agent: string): RobotsRules => {
  const rader = text.split(/\r?\n/).map((r) => r.replace(/#.*$/, "").trim());
  const grupper: { agents: string[]; disallow: string[]; delay: number | null }[] = [];
  let aktuell: (typeof grupper)[number] | null = null;
  let forraVarAgent = false;

  for (const rad of rader) {
    const [nyckelDel, ...restDel] = rad.split(":");
    if (restDel.length === 0) continue;
    const nyckel = nyckelDel.trim().toLowerCase();
    const varde = restDel.join(":").trim();

    if (nyckel === "user-agent") {
      if (!aktuell || !forraVarAgent) {
        aktuell = { agents: [], disallow: [], delay: null };
        grupper.push(aktuell);
      }
      aktuell.agents.push(varde.toLowerCase());
      forraVarAgent = true;
      continue;
    }
    forraVarAgent = false;
    if (!aktuell) continue;
    if (nyckel === "disallow" && varde !== "") aktuell.disallow.push(varde);
    if (nyckel === "crawl-delay") {
      const n = Number.parseFloat(varde);
      if (Number.isFinite(n)) aktuell.delay = n;
    }
  }

  const namn = agent.toLowerCase();
  const egen = grupper.find((g) => g.agents.some((a) => namn.includes(a) && a !== "*"));
  const alla = grupper.find((g) => g.agents.includes("*"));
  const vald = egen ?? alla;
  return { disallow: vald?.disallow ?? [], crawlDelay: vald?.delay ?? null };
};

/** Sant när sökvägen får hämtas enligt reglerna. */
export const mayFetch = (path: string, rules: RobotsRules): boolean =>
  !rules.disallow.some((d) => path.startsWith(d));

/* -------------------------------------------------------------------------- */
/* Utvinningen                                                                */
/* -------------------------------------------------------------------------- */

export interface WebsiteFacts {
  /** Bolagets egen beskrivning av sig självt. */
  description: string | null;
  /** Namnet som sajten själv anger. */
  name: string | null;
  /** Konton bolaget SJÄLVT länkar till. Plattformarna rörs aldrig. */
  socials: { platform: string; url: string }[];
  /** Företagets egna kontaktvägar - aldrig namngivna personers. */
  contact: { email: string | null; phone: string | null };
  /** Var varje uppgift kom ifrån, för att kunna svara på "hur vet ni det?". */
  basis: string[];
}

const attr = (tag: string, name: string): string | null => {
  const m = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag);
  return m ? m[1] : null;
};

const metaContent = (html: string, matcher: RegExp): string | null => {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const nyckel = attr(tag, "property") ?? attr(tag, "name");
    if (nyckel && matcher.test(nyckel)) {
      const v = attr(tag, "content");
      if (v && v.trim()) return v.trim();
    }
  }
  return null;
};

const PLATTFORMAR: { platform: string; test: RegExp }[] = [
  { platform: "LinkedIn", test: /linkedin\.com\/(company|in)\//i },
  { platform: "Facebook", test: /facebook\.com\//i },
  { platform: "Instagram", test: /instagram\.com\//i },
  { platform: "X", test: /(twitter|x)\.com\//i },
  { platform: "YouTube", test: /youtube\.com\//i },
];

/**
 * Läser ut det som går att stå för ur en sida.
 *
 * JSON-LD först: `Organization` är en struktur publicerad för att läsas
 * maskinellt, och det som står där är bolagets eget påstående om sig
 * självt. Sedan OpenGraph, sedan vanliga metataggar. Brödtext tolkas
 * aldrig.
 */
export const extractWebsiteFacts = (html: string): WebsiteFacts => {
  const basis: string[] = [];
  let name: string | null = null;
  let description: string | null = null;
  const contact: WebsiteFacts["contact"] = { email: null, phone: null };

  for (const m of html.matchAll(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const data = JSON.parse(m[1].trim()) as unknown;
      const noder = Array.isArray(data) ? data : [data];
      for (const nod of noder) {
        if (!nod || typeof nod !== "object") continue;
        const o = nod as Record<string, unknown>;
        const typ = String(o["@type"] ?? "");
        if (!/Organization|LocalBusiness|Corporation/i.test(typ)) continue;
        if (!name && typeof o.name === "string" && o.name.trim()) {
          name = o.name.trim();
          basis.push("Namnet står i sidans strukturerade data (JSON-LD).");
        }
        if (!description && typeof o.description === "string" && o.description.trim()) {
          description = o.description.trim();
          basis.push("Beskrivningen står i sidans strukturerade data (JSON-LD).");
        }
        if (!contact.email && typeof o.email === "string" && o.email.includes("@")) {
          contact.email = o.email.trim();
        }
        if (!contact.phone && typeof o.telephone === "string" && o.telephone.trim()) {
          contact.phone = o.telephone.trim();
        }
      }
    } catch {
      // Trasig JSON-LD är vanligt. Den ignoreras; sidan har fler källor.
    }
  }

  if (!description) {
    const og = metaContent(html, /^og:description$/i);
    const meta = metaContent(html, /^description$/i);
    if (og) {
      description = og;
      basis.push("Beskrivningen är sidans egen OpenGraph-text.");
    } else if (meta) {
      description = meta;
      basis.push("Beskrivningen är sidans egen metabeskrivning.");
    }
  }
  if (!name) {
    const og = metaContent(html, /^og:site_name$/i);
    if (og) {
      name = og;
      basis.push("Namnet är sidans eget og:site_name.");
    }
  }

  /*
   * Sociala konton: bara det bolaget SJÄLVT länkar till. Vi rör aldrig
   * plattformarna - se registry.ts. Att veta VILKA kanaler som finns är
   * ändå det mesta av värdet, och det står på deras egen sida.
   */
  const socials: WebsiteFacts["socials"] = [];
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    const url = m[1];
    const traff = PLATTFORMAR.find((p) => p.test.test(url));
    if (traff && !socials.some((s) => s.platform === traff.platform)) {
      socials.push({ platform: traff.platform, url });
    }
  }
  if (socials.length > 0) {
    basis.push("De sociala kontona är länkade från bolagets egen sida.");
  }

  /*
   * Kontaktvägar: bara bolagets egna. En adress som ser ut att tillhöra en
   * namngiven person plockas inte upp - det är en personuppgift analysen
   * inte behöver, och integritetspolicyn lovar att vi inte samlar mer än
   * vi behöver.
   */
  if (!contact.email) {
    for (const m of html.matchAll(/mailto:([^"'?\s>]+)/gi)) {
      const adress = m[1].toLowerCase();
      const lokal = adress.split("@")[0];
      if (/^(info|kontakt|hej|order|ekonomi|faktura|support|kundtjanst|kundtjänst)$/.test(lokal)) {
        contact.email = adress;
        basis.push("E-postadressen är bolagets egen, länkad från sidan.");
        break;
      }
    }
  }

  return { description, name, socials, contact, basis };
};

/**
 * Vad panelen ska skriva när webbplatsen lästs.
 *
 * Meningen ska tåla att kontrolleras: den räknar bara det som faktiskt
 * hittades, och säger ingenting när ingenting hittades.
 */
export const websiteNote = (facts: WebsiteFacts): string => {
  const delar: string[] = [];
  if (facts.description) delar.push("bolagets egen beskrivning");
  if (facts.socials.length === 1) delar.push("ett socialt konto");
  if (facts.socials.length > 1) delar.push(`${facts.socials.length} sociala konton`);
  if (facts.contact.email || facts.contact.phone) delar.push("kontaktväg");
  if (delar.length === 0) return "Sidan gick att läsa, men innehöll inget vi kunde använda.";
  const sista = delar.pop();
  const lista = delar.length > 0 ? `${delar.join(", ")} och ${sista}` : sista;
  return `Läst från bolagets webbplats: ${lista}.`;
};

