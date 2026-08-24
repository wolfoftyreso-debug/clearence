import type { CaseRole } from "@/lib/caseRoles";
import type { RetentionCategory, RetentionOverride } from "@/lib/retention";
import type {
  AccountBillingRecord,
  ApplicationForReview,
  AdvisorSessionRecord,
  ApplicationRecord,
  AuditEventRecord,
  AuthUser,
  CaseDecisionRecord,
  ErasureRequestRecord,
  PremiseWatch,
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
  ApiKeyRecord,
  DocumentSignature,
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
  NotificationPrefsRecord,
  NotificationPrefsInput,
  VerifiedPhoneRecord,
  NotificationDeliveryRecord,
  SimulationRecord,
  SimulationRun,
  GoogleFetchResult,
  WebsiteFetchResult,
  NewsFetchResult,
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
 * Hämtningarna bor på servern (server/{google,website,news}.ts) - dels
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
