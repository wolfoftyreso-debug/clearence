import type { CaseRole } from "@/lib/caseRoles";
import type {
  AccountBillingRecord,
  ApplicationForReview,
  AdvisorSessionRecord,
  ApplicationRecord,
  AuditEventRecord,
  AuthUser,
  CaseDecisionRecord,
  CaseExitReason,
  CaseInvitationRecord,
  CaseMemberRecord,
  CaseNoteRecord,
  CaseShareLinkRecord,
  SharedCaseView,
  FirmInvitationRecord,
  FirmMemberRecord,
  MyFirmInvitation,
  TimeEntryRecord,
  CaseMessage,
  CaseRecord,
  CaseTask,
  ConversationRecord,
  InvitationPeek,
  OpenMention,
  CompanyInfo,
  CustomerInvoiceRecord,
  CustomerOverview,
  OutboundEmailRecord,
  ProfessionalTerms,
  SecretInfo,
  UserProfile,
  UserRole,
  ContactMessageRecord,
  ContactStatus,
  NewContactMessage,
  DocumentRecord,
  InvoiceRecord,
  InvoiceStatus,
  KbrAssessmentInput,
  KbrStatus,
  NewApplication,
  NewCase,
  NewDocument,
  NewInvoice,
  NewPayment,
  NewReferral,
  PaymentRecord,
  PaymentStatus,
  ProfessionalRecord,
  ContactRequestRecord,
  LeadPreviewRecord,
  MyProfessionalProfile,
  ProfessionalProfileUpdate,
  ProfileClaimForReview,
  ProfileClaimRecord,
  UsageChargeRecord,
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
  }): Promise<void>;
  reconsiderDecision(id: string, note: string): Promise<void>;
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
  companyLookup: CompanyLookupPort;
}
