/**
 * Adaptern mot CLEARANCE eget API.
 *
 * **Det här är en halvfärdig migrering, och den säger det själv.**
 *
 * `DataPort` är hela kontraktet; eget API täcker i dag ärenden,
 * journalen, beslutsminnet, uppgifterna, betalningarna,
 * dokumentmetadatan, meddelandena och kontrollbalansbedömningen. Resten
 * - dokumentuppladdning, fakturering, deltagare, katalog, drift - ligger
 * kvar hos den befintliga adaptern.
 *
 * Att låta de portarna KASTA hade gjort adaptern obrukbar och därmed
 * omöjlig att pröva i praktiken; att låta dem *tyst* göra ingenting hade
 * varit värre. De delegeras därför, öppet: `MIGRATED_PORTS` nedan säger
 * exakt vad som är flyttat, och `tests/awsAdapter.ts` läser listan. Den
 * som flyttar en port till men glömmer listan får ett rött test.
 *
 * Mönstret är avsiktligt (strangler): flytta en port i taget, låt listan
 * växa, och radera den här filens delegering när den är tom.
 */

import type { DataPort } from "../ports";
import type { CaseRole } from "@/lib/caseRoles";
import type {
  AccountBillingRecord,
  AdvisorSessionRecord,
  ApiKeyRecord,
  CaseDecisionRecord,
  CaseInvitationRecord,
  CaseMemberRecord,
  CaseMessage,
  CaseNoteRecord,
  CaseRecord,
  CaseShareLinkRecord,
  CaseTask,
  ContactMessageRecord,
  ContactStatus,
  ConversationRecord,
  CustomerInvoiceRecord,
  CustomerOverview,
  ErasureRequestRecord,
  DocumentRecord,
  InvitationPeek,
  InvoiceRecord,
  InvoiceStatus,
  KbrAssessmentInput,
  NewContactMessage,
  NewInvoice,
  NewPayment,
  NotificationDeliveryRecord,
  OpenMention,
  NotificationPrefsInput,
  NotificationPrefsRecord,
  OutboundEmailRecord,
  PaymentRecord,
  PaymentStatus,
  ProfessionalTerms,
  SecretInfo,
  SharedCaseView,
  SimulationRecord,
  SimulationRun,
  TimeEntryRecord,
  UserProfile,
  UserRole,
  VerifiedPhoneRecord,
} from "../types";
import type { FinancialSnapshot } from "@/lib/financial/model";
import { supabaseAdapter } from "../supabase/adapter";
import { ApiRequestError, apiFetch, clearToken, setToken } from "./client";

/**
 * Portarna som verkligen går mot eget API. Listan är produktens
 * migreringsmätare - den ska växa tills delegeringen kan tas bort.
 */
export const MIGRATED_PORTS = [
  "contact.submit",
  "contact.amIAdmin",
  "contact.listAll",
  "contact.updateStatus",
  "members.listMembers",
  "members.listInvitations",
  "members.invite",
  "members.revokeInvitation",
  "members.peekInvitation",
  "members.acceptInvitation",
  "advisorTools.listNotes",
  "advisorTools.addNote",
  "advisorTools.removeNote",
  "advisorTools.listTime",
  "advisorTools.logTime",
  "advisorTools.removeTime",
  "apiKeys.listMine",
  "apiKeys.create",
  "apiKeys.revoke",
  "notificationSettings.getPrefs",
  "notificationSettings.savePrefs",
  "notificationSettings.getPhone",
  "notificationSettings.startPhoneVerification",
  "notificationSettings.confirmPhoneVerification",
  "notificationSettings.removePhone",
  "notificationSettings.listRecentDeliveries",
  "dialogue.listSessions",
  "dialogue.saveSession",
  "ops.listSecrets",
  "ops.setSecret",
  "ops.deleteSecret",
  "ops.listProfessionalTerms",
  "ops.setReferralFee",
  "ops.listBillingPlans",
  "ops.setBillingPlan",
  "ops.setBillingHold",
  "ops.setBillingShadow",
  "ops.setCompanyPlan",
  "ops.getRetentionPolicy",
  "ops.setRetentionPolicy",
  "ops.northStarCounts",
  "billing.getMine",
  "billing.listMyInvoices",
  "billing.getCompanyPlan",
  "billing.listCustomers",
  "billing.closeAccount",
  "billing.listOutbox",
  "billing.retryEmail",
  "cases.getLatest",
  "cases.close",
  "cases.reopen",
  "cases.setPlanApproval",
  "profile.getMine",
  "profile.create",
  "profile.update",
  "shares.list",
  "shares.create",
  "shares.revoke",
  "shares.fetch",
  "dialogue.listDecisions",
  "dialogue.recordDecision",
  "dialogue.reconsiderDecision",
  "dialogue.acknowledgePremise",
  "tasks.listByCase",
  "tasks.add",
  "tasks.setDone",
  "tasks.assign",
  "tasks.seed",
  "payments.listByCase",
  "payments.createMany",
  "payments.updateStatus",
  "invoices.listByCase",
  "invoices.createMany",
  "invoices.updateStatus",
  "kbr.create",
  "documents.listByCase",
  "documents.setReview",
  "documents.getDownloadUrl",
  "messages.listByCase",
  "messages.listByConversation",
  "messages.send",
  "messages.markRead",
  "messages.listConversations",
  "messages.createDirect",
  "messages.createGroup",
  "messages.merge",
  "messages.ack",
  "messages.myOpenMentions",
  "kbr.getLatestByCase",
  "financial.getLatestSnapshot",
  "financial.importSie",
  "privacy.getErasureRequest",
  "privacy.requestErasure",
  "privacy.cancelErasure",
  "simulations.listByCase",
  "simulations.get",
  "simulations.create",
  "simulations.update",
  "simulations.remove",
  "simulations.run",
  "simulations.cancel",
  "simulations.latestRun",
  "simulations.getRun",
  "audit.listByCase",
] as const;

/** Sessionshanteringen, som appen behöver vid inloggning och utloggning. */
export const awsAuth = {
  async login(email: string, password: string): Promise<{ userId: string }> {
    const res = await apiFetch<{ token: string; userId: string }>("/v1/auth/login", {
      method: "POST",
      body: { email, password },
      anonymous: true,
    });
    setToken(res.token);
    return { userId: res.userId };
  },
  async logout(): Promise<void> {
    // Återkalla FÖRST, glöm sedan: tappar vi token innan servern vet om
    // det lever sessionen vidare tills den går ut av sig själv.
    try {
      await apiFetch("/v1/auth/logout", { method: "POST" });
    } finally {
      clearToken();
    }
  },
};

/**
 * Bytes till base64.
 *
 * `btoa` tar en sträng där varje tecken ska vara en byte, så bytesen
 * måste först bli latin1-tecken. Att gå via `String.fromCharCode(...bytes)`
 * i ett enda anrop spräcker anropsstacken på stora filer - därför i bitar.
 */
const tillBase64 = (bytes: Uint8Array): string => {
  const BIT = 0x8000;
  let s = "";
  for (let i = 0; i < bytes.length; i += BIT) {
    s += String.fromCharCode(...bytes.subarray(i, i + BIT));
  }
  return btoa(s);
};

/* --- Portarna som är flyttade ---------------------------------------------- */

const cases = {
  ...supabaseAdapter.cases,
  async getLatest(): Promise<CaseRecord | null> {
    const res = await apiFetch<{ cases: CaseRecord[] }>("/v1/cases");
    return res.cases[0] ?? null;
  },
  async close(input: Parameters<DataPort["cases"]["close"]>[0]): Promise<void> {
    await apiFetch(`/v1/cases/${input.caseId}/close`, {
      method: "POST",
      body: {
        reason: input.reason,
        note: input.note ?? null,
        enterHealth: input.enterHealth ?? false,
      },
    });
  },
  async reopen(caseId: string): Promise<void> {
    await apiFetch(`/v1/cases/${caseId}/reopen`, { method: "POST" });
  },
  async setPlanApproval(caseId: string, approved: boolean): Promise<void> {
    await apiFetch(`/v1/cases/${caseId}/plan-approval`, { method: "POST", body: { approved } });
  },
};

/**
 * Profilen.
 *
 * `getMine` svarar med null när profilen inte finns ännu, och det är ett
 * giltigt läge - den skapas vid första inloggningen. API:t svarar därför
 * 200 med profile: null i stället för 404; ett 404 hade fått klienten att
 * tro att något gått sönder när ingenting gjort det.
 */
const profile = {
  ...supabaseAdapter.profile,
  async getMine(): Promise<UserProfile | null> {
    const res = await apiFetch<{ profile: UserProfile | null }>("/v1/profile");
    return res.profile;
  },
  async create(input: { role: UserRole; displayName: string | null }): Promise<UserProfile> {
    return apiFetch<UserProfile>("/v1/profile", {
      method: "POST",
      body: { role: input.role, displayName: input.displayName },
    });
  },
  async update(input: { displayName: string | null; phone: string | null }): Promise<void> {
    await apiFetch("/v1/profile", {
      method: "PATCH",
      body: { displayName: input.displayName, phone: input.phone },
    });
  },
};

/**
 * Live ärendelänkarna.
 *
 * `fetch` går ANONYMT: det är hela poängen med en delningslänk, och
 * mottagaren har inget konto. Prövningen av token, giltighetstid och
 * återkallelse ligger i databasfunktionen där den inte går att kringgå.
 *
 * Den svarar null i stället för att kasta när länken inte gäller, för att
 * vyn ska kunna visa "länken gäller inte längre" i stället för ett fel -
 * och för att ogiltig, utgången och återkallad ska se likadana ut för
 * den som gissar.
 */
const shares = {
  ...supabaseAdapter.shares,
  async list(caseId: string): Promise<CaseShareLinkRecord[]> {
    const res = await apiFetch<{ shareLinks: CaseShareLinkRecord[] }>(
      `/v1/cases/${caseId}/share-links`,
    );
    return res.shareLinks;
  },
  async create(
    input: Parameters<DataPort["shares"]["create"]>[0],
  ): Promise<CaseShareLinkRecord> {
    return apiFetch<CaseShareLinkRecord>(`/v1/cases/${input.caseId}/share-links`, {
      method: "POST",
      body: {
        scope: input.scope,
        label: input.label ?? null,
        validDays: input.validDays,
      },
    });
  },
  async revoke(id: string): Promise<void> {
    await apiFetch(`/v1/share-links/${id}`, { method: "DELETE" });
  },
  async fetch(token: string): Promise<SharedCaseView | null> {
    try {
      return await apiFetch<SharedCaseView>(`/v1/shared/${token}`, { anonymous: true });
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 404) return null;
      throw error;
    }
  },
};

const dialogue = {
  ...supabaseAdapter.dialogue,
  async listSessions(caseId: string): Promise<AdvisorSessionRecord[]> {
    const res = await apiFetch<{ sessions: AdvisorSessionRecord[] }>(`/v1/cases/${caseId}/sessions`);
    return res.sessions;
  },
  async saveSession(session: AdvisorSessionRecord): Promise<void> {
    // Upsert på samtalets id - samma samtal skrivs flera gånger medan det
    // pågår. Servern kräver skrivrätt i ärendet (can_write_case).
    await apiFetch(`/v1/cases/${session.caseId}/sessions`, {
      method: "POST",
      body: {
        id: session.id,
        flowId: session.flowId,
        flowTitle: session.flowTitle,
        startedAt: session.startedAt,
        closedAt: session.closedAt,
        entries: session.entries,
      },
    });
  },
  async listDecisions(caseId: string): Promise<CaseDecisionRecord[]> {
    const res = await apiFetch<{ decisions: CaseDecisionRecord[] }>(
      `/v1/cases/${caseId}/decisions`,
    );
    return res.decisions;
  },
  async recordDecision(input: Parameters<DataPort["dialogue"]["recordDecision"]>[0]): Promise<void> {
    await apiFetch(`/v1/cases/${input.caseId}/decisions`, {
      method: "POST",
      body: {
        title: input.title,
        rationale: input.rationale,
        premise: input.premise ?? null,
        watch: input.watch ?? null,
      },
    });
  },
  async reconsiderDecision(id: string, note: string): Promise<void> {
    await apiFetch(`/v1/decisions/${id}/reconsider`, { method: "POST", body: { note } });
  },
  async acknowledgePremise(id: string, observation: string): Promise<void> {
    await apiFetch(`/v1/decisions/${id}/acknowledge-premise`, {
      method: "POST",
      body: { observation },
    });
  },
};

const tasks = {
  ...supabaseAdapter.tasks,
  async listByCase(caseId: string): Promise<CaseTask[]> {
    const res = await apiFetch<{ tasks: CaseTask[] }>(`/v1/cases/${caseId}/tasks`);
    return res.tasks;
  },
  async add(caseId: string, label: string, dueDate: string | null): Promise<void> {
    await apiFetch(`/v1/cases/${caseId}/tasks`, { method: "POST", body: { label, dueDate } });
  },
  async setDone(id: string, done: boolean): Promise<void> {
    await apiFetch(`/v1/tasks/${id}/done`, { method: "POST", body: { done } });
  },
  async assign(id: string, userId: string | null): Promise<void> {
    await apiFetch(`/v1/tasks/${id}/assign`, { method: "POST", body: { userId } });
  },
  async seed(caseId: string, labels: string[]): Promise<void> {
    if (labels.length === 0) return;
    await apiFetch(`/v1/cases/${caseId}/tasks/seed`, { method: "POST", body: { labels } });
  },
};

const documents = {
  ...supabaseAdapter.documents,
  async listByCase(caseId: string): Promise<DocumentRecord[]> {
    const res = await apiFetch<{ documents: DocumentRecord[] }>(`/v1/cases/${caseId}/documents`);
    return res.documents;
  },
  async setReview(id: string, action: "request" | "approve" | "reset"): Promise<void> {
    await apiFetch(`/v1/documents/${id}/review`, { method: "POST", body: { action } });
  },
  async getDownloadUrl(id: string, _expiresInSeconds: number): Promise<string | null> {
    // Livslängden bestäms av SERVERN (60 s), inte av klienten - en klient
    // kan inte förlänga en signerad URL:s liv. Argumentet behålls för
    // portens signatur men skickas inte med.
    try {
      const res = await apiFetch<{ url: string }>(`/v1/documents/${id}/url`);
      return res.url;
    } catch (err) {
      // 404 = dokumentet finns inte eller är inte ditt. Kontraktet vill ha
      // null, inte ett kastat fel - samma tystnad som resten av porten.
      if (err instanceof ApiRequestError && err.status === 404) return null;
      throw err;
    }
  },
  // upload ligger kvar: den kräver en PUT-signering mot S3, som byggs när
  // uppladdningsvägen migreras (samma hink, andra riktningen).
};

const billing = {
  ...supabaseAdapter.billing,
  async getMine(): Promise<AccountBillingRecord> {
    const res = await apiFetch<{ billing: AccountBillingRecord }>("/v1/billing/mine");
    return res.billing;
  },
  async listMyInvoices(): Promise<CustomerInvoiceRecord[]> {
    const res = await apiFetch<{ invoices: CustomerInvoiceRecord[] }>("/v1/billing/invoices");
    return res.invoices;
  },
  async getCompanyPlan(): Promise<Awaited<ReturnType<DataPort["billing"]["getCompanyPlan"]>>> {
    return apiFetch<Awaited<ReturnType<DataPort["billing"]["getCompanyPlan"]>>>("/v1/billing/company-plan");
  },
  async listCustomers(): Promise<CustomerOverview[]> {
    const res = await apiFetch<{ customers: CustomerOverview[] }>("/v1/billing/customers");
    return res.customers;
  },
  async closeAccount(userId: string): Promise<void> {
    await apiFetch(`/v1/billing/accounts/${userId}/close`, { method: "POST" });
  },
  async listOutbox(): Promise<OutboundEmailRecord[]> {
    const res = await apiFetch<{ emails: OutboundEmailRecord[] }>("/v1/billing/outbox");
    return res.emails;
  },
  async retryEmail(id: string): Promise<void> {
    await apiFetch(`/v1/billing/outbox/${id}/retry`, { method: "POST" });
  },
  // issueInvoice och registerPayment ligger kvar hos supabase-adaptern: de
  // köar en momsfaktura/kvitto i utkorgen, vilket kräver att e-postmallarna
  // flyttas till serversidan. Nästa steg för porten.
};

const ops = {
  ...supabaseAdapter.ops,
  async listSecrets(): Promise<SecretInfo[]> {
    const res = await apiFetch<{ secrets: SecretInfo[] }>("/v1/ops/secrets");
    return res.secrets;
  },
  async setSecret(provider: string, secret: string): Promise<void> {
    await apiFetch("/v1/ops/secrets", { method: "POST", body: { provider, secret } });
  },
  async deleteSecret(provider: string): Promise<void> {
    await apiFetch(`/v1/ops/secrets/${encodeURIComponent(provider)}`, { method: "DELETE" });
  },
  async listProfessionalTerms(): Promise<ProfessionalTerms[]> {
    const res = await apiFetch<{ terms: ProfessionalTerms[] }>("/v1/ops/professional-terms");
    return res.terms;
  },
  async setReferralFee(professionalId: string, feeSek: number | null): Promise<void> {
    await apiFetch(`/v1/ops/professionals/${professionalId}/referral-fee`, {
      method: "POST",
      body: { feeSek },
    });
  },
  async listBillingPlans(): Promise<Awaited<ReturnType<DataPort["ops"]["listBillingPlans"]>>> {
    const res = await apiFetch<{ plans: Awaited<ReturnType<DataPort["ops"]["listBillingPlans"]>> }>(
      "/v1/ops/billing-plans",
    );
    return res.plans;
  },
  async setBillingPlan(input: Parameters<DataPort["ops"]["setBillingPlan"]>[0]): Promise<void> {
    await apiFetch("/v1/ops/billing-plans", {
      method: "POST",
      body: {
        professionalId: input.professionalId,
        planKind: input.planKind,
        unlockFeeSek: input.unlockFeeSek,
        monthlyFeeSek: input.monthlyFeeSek,
      },
    });
  },
  async setBillingHold(professionalId: string, hold: boolean, reason?: string): Promise<void> {
    await apiFetch(`/v1/ops/professionals/${professionalId}/billing-hold`, {
      method: "POST",
      body: { hold, reason: reason ?? null },
    });
  },
  async setBillingShadow(professionalId: string, shadow: boolean): Promise<void> {
    await apiFetch(`/v1/ops/professionals/${professionalId}/billing-shadow`, {
      method: "POST",
      body: { shadow },
    });
  },
  async setCompanyPlan(input: Parameters<DataPort["ops"]["setCompanyPlan"]>[0]): Promise<void> {
    await apiFetch("/v1/ops/company-plan", { method: "POST", body: input });
  },
  async getRetentionPolicy(): Promise<Awaited<ReturnType<DataPort["ops"]["getRetentionPolicy"]>>> {
    const res = await apiFetch<{
      policy: Awaited<ReturnType<DataPort["ops"]["getRetentionPolicy"]>>;
    }>("/v1/ops/retention-policy");
    return res.policy;
  },
  async setRetentionPolicy(overrides: Parameters<DataPort["ops"]["setRetentionPolicy"]>[0]): Promise<void> {
    await apiFetch("/v1/ops/retention-policy", { method: "POST", body: { overrides } });
  },
  async northStarCounts(): Promise<Awaited<ReturnType<DataPort["ops"]["northStarCounts"]>>> {
    return apiFetch<Awaited<ReturnType<DataPort["ops"]["northStarCounts"]>>>("/v1/ops/north-star");
  },
};

const apiKeys = {
  ...supabaseAdapter.apiKeys,
  async listMine(): Promise<ApiKeyRecord[]> {
    const res = await apiFetch<{ keys: ApiKeyRecord[] }>("/v1/api-keys");
    return res.keys;
  },
  async create(label: string): Promise<{ record: ApiKeyRecord; secret: string }> {
    // Hemligheten kommer tillbaka EN gång. Den lagras aldrig - visas för
    // användaren i skapandeögonblicket och kan sedan bara bytas ut.
    return apiFetch<{ record: ApiKeyRecord; secret: string }>("/v1/api-keys", {
      method: "POST",
      body: { label },
    });
  },
  async revoke(id: string): Promise<void> {
    await apiFetch(`/v1/api-keys/${id}/revoke`, { method: "POST" });
  },
};

const advisorTools = {
  ...supabaseAdapter.advisorTools,
  async listNotes(caseId: string): Promise<CaseNoteRecord[]> {
    const res = await apiFetch<{ notes: CaseNoteRecord[] }>(`/v1/cases/${caseId}/notes`);
    return res.notes;
  },
  async addNote(caseId: string, body: string): Promise<void> {
    await apiFetch(`/v1/cases/${caseId}/notes`, { method: "POST", body: { body } });
  },
  async removeNote(id: string): Promise<void> {
    await apiFetch(`/v1/notes/${id}`, { method: "DELETE" });
  },
  async listTime(caseId: string): Promise<TimeEntryRecord[]> {
    const res = await apiFetch<{ entries: TimeEntryRecord[] }>(`/v1/cases/${caseId}/time-entries`);
    return res.entries;
  },
  async logTime(input: {
    caseId: string;
    minutes: number;
    note?: string | null;
    occurredOn?: string;
  }): Promise<void> {
    const body: { minutes: number; note?: string | null; occurredOn?: string } = { minutes: input.minutes };
    if (input.note !== undefined) body.note = input.note;
    if (input.occurredOn !== undefined) body.occurredOn = input.occurredOn;
    await apiFetch(`/v1/cases/${input.caseId}/time-entries`, { method: "POST", body });
  },
  async removeTime(id: string): Promise<void> {
    await apiFetch(`/v1/time-entries/${id}`, { method: "DELETE" });
  },
};

const members = {
  ...supabaseAdapter.members,
  async listMembers(caseId: string): Promise<CaseMemberRecord[]> {
    const res = await apiFetch<{ members: CaseMemberRecord[] }>(`/v1/cases/${caseId}/members`);
    return res.members;
  },
  async listInvitations(caseId: string): Promise<CaseInvitationRecord[]> {
    const res = await apiFetch<{ invitations: CaseInvitationRecord[] }>(`/v1/cases/${caseId}/invitations`);
    return res.invitations;
  },
  async invite(caseId: string, email: string, role: CaseRole): Promise<void> {
    await apiFetch(`/v1/cases/${caseId}/invitations`, { method: "POST", body: { email, role } });
  },
  async revokeInvitation(invitationId: string): Promise<void> {
    await apiFetch(`/v1/invitations/${invitationId}/revoke`, { method: "POST" });
  },
  async peekInvitation(invitationId: string): Promise<InvitationPeek | null> {
    // Adressen är nyckeln: servern svarar med null (samma neutrala tystnad)
    // när inbjudan inte finns, är utgången eller ställd till en annan adress.
    const res = await apiFetch<{ invitation: InvitationPeek | null }>(`/v1/invitations/${invitationId}`);
    return res.invitation;
  },
  async acceptInvitation(invitationId: string): Promise<string> {
    const res = await apiFetch<{ caseId: string }>(`/v1/invitations/${invitationId}/accept`, {
      method: "POST",
    });
    return res.caseId;
  },
};

const contact = {
  ...supabaseAdapter.contact,
  async submit(input: NewContactMessage): Promise<void> {
    // INTE anonymous: är avsändaren inloggad följer token med och servern
    // fäster meddelandet vid kontot. Är den inte det skickas ingen token,
    // och rutten tar emot ändå. Bara avsändarens egna fält skickas.
    await apiFetch("/v1/contact", {
      method: "POST",
      body: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        company: input.company,
        topic: input.topic,
        message: input.message,
      },
    });
  },
  async amIAdmin(): Promise<boolean> {
    // Fel (t.ex. 401 för en oinloggad) läses som "inte administratör". Den
    // riktiga gränsen är radskyddet - vore det här svaret fel vore inkorgen
    // ändå tom.
    try {
      const res = await apiFetch<{ isAdmin: boolean }>("/v1/contact/admin-status");
      return res.isAdmin === true;
    } catch (err) {
      if (err instanceof ApiRequestError) return false;
      throw err;
    }
  },
  async listAll(): Promise<ContactMessageRecord[]> {
    const res = await apiFetch<{ messages: ContactMessageRecord[] }>("/v1/contact");
    return res.messages;
  },
  async updateStatus(
    id: string,
    status: ContactStatus,
    internalNote?: string | null,
  ): Promise<void> {
    // internalNote utelämnas ur kroppen när anroparen inte skickade det, så
    // servern lämnar anteckningen orörd (skickas den, även som null, skrivs
    // den). Handläggaren sätter servern, aldrig klienten.
    const body: { status: ContactStatus; internalNote?: string | null } = { status };
    if (internalNote !== undefined) body.internalNote = internalNote;
    await apiFetch(`/v1/contact/${id}/status`, { method: "POST", body });
  },
};

/**
 * Meddelandena och trådarna.
 *
 * `listByCase` bar tidigare bara halva CaseMessage - servern skickade sex
 * fält av tio, och `acks` (som gränssnittet räknar på) kom aldrig med.
 * Serialiseraren är rättad; det här är resten av porten.
 */
const messages = {
  ...supabaseAdapter.messages,
  async listByCase(caseId: string): Promise<CaseMessage[]> {
    const res = await apiFetch<{ messages: CaseMessage[] }>(`/v1/cases/${caseId}/messages`);
    return res.messages;
  },
  async listByConversation(conversationId: string): Promise<CaseMessage[]> {
    const res = await apiFetch<{ messages: CaseMessage[] }>(
      `/v1/conversations/${conversationId}/messages`,
    );
    return res.messages;
  },
  async send(
    caseId: string,
    body: string,
    opts?: {
      conversationId?: string | null;
      attachmentDocumentId?: string | null;
      expectsReplyFrom?: string | null;
    },
  ): Promise<void> {
    await apiFetch(`/v1/cases/${caseId}/messages`, {
      method: "POST",
      body: {
        body,
        conversationId: opts?.conversationId ?? null,
        attachmentDocumentId: opts?.attachmentDocumentId ?? null,
        expectsReplyFrom: opts?.expectsReplyFrom ?? null,
      },
    });
  },
  async markRead(id: string): Promise<void> {
    await apiFetch(`/v1/messages/${id}/read`, { method: "POST" });
  },
  async listConversations(caseId: string): Promise<ConversationRecord[]> {
    const res = await apiFetch<{ conversations: ConversationRecord[] }>(
      `/v1/cases/${caseId}/conversations`,
    );
    return res.conversations;
  },
  async createDirect(caseId: string, otherUserId: string): Promise<string> {
    const res = await apiFetch<{ id: string }>(`/v1/cases/${caseId}/conversations`, {
      method: "POST",
      body: { kind: "direct", otherUserId },
    });
    return res.id;
  },
  async createGroup(
    caseId: string,
    title: string,
    participantUserIds: string[],
  ): Promise<string> {
    const res = await apiFetch<{ id: string }>(`/v1/cases/${caseId}/conversations`, {
      method: "POST",
      body: { kind: "group", title, participantUserIds },
    });
    return res.id;
  },
  async merge(fromConversationId: string, toConversationId: string): Promise<void> {
    await apiFetch(`/v1/conversations/${fromConversationId}/merge`, {
      method: "POST",
      body: { into: toConversationId },
    });
  },
  async ack(messageId: string): Promise<void> {
    // Kvittensen kan aldrig tas tillbaka; det finns med flit ingen
    // motsvarande borttagning här.
    await apiFetch(`/v1/messages/${messageId}/ack`, { method: "POST" });
  },
  async myOpenMentions(): Promise<OpenMention[]> {
    const res = await apiFetch<{ mentions: OpenMention[] }>("/v1/mentions");
    return res.mentions;
  },
};

/*
 * AVISERINGSINSTÄLLNINGARNA.
 *
 * Två saker som INTE finns i den här filen, och det är hela poängen:
 * verifieringskoden och hela mobilnumret. Koden föds i databasen och går
 * ut som SMS; servern svarar `{ sent: true }`. Numret kommer tillbaka
 * maskerat, maskat av servern. Den gamla vägen - där klienten slumpade
 * koden, hashade den och skickade in båda - gjorde verifieringen till ett
 * bevis den som skrev klienten kunde skriva själv.
 */
const notificationSettings = {
  ...supabaseAdapter.notificationSettings,
  async getPrefs(): Promise<NotificationPrefsRecord | null> {
    return apiFetch<NotificationPrefsRecord | null>("/v1/notifications/prefs");
  },
  async savePrefs(input: NotificationPrefsInput): Promise<void> {
    await apiFetch("/v1/notifications/prefs", { method: "PUT", body: input });
  },
  async getPhone(): Promise<VerifiedPhoneRecord | null> {
    return apiFetch<VerifiedPhoneRecord | null>("/v1/notifications/phone");
  },
  async startPhoneVerification(rawPhone: string): Promise<void> {
    // Numret skickas som användaren skrev det. Servern normaliserar och
    // avgör; klientens egen kontroll finns för fältet, inte för beslutet.
    await apiFetch("/v1/notifications/phone", { method: "POST", body: { phone: rawPhone } });
  },
  async confirmPhoneVerification(code: string): Promise<boolean> {
    const res = await apiFetch<{ verified: boolean }>("/v1/notifications/phone/confirm", {
      method: "POST",
      body: { code },
    });
    return res.verified === true;
  },
  async removePhone(): Promise<void> {
    await apiFetch("/v1/notifications/phone", { method: "DELETE" });
  },
  async listRecentDeliveries(limit = 20): Promise<NotificationDeliveryRecord[]> {
    const res = await apiFetch<{ deliveries: NotificationDeliveryRecord[] }>(
      `/v1/notifications/deliveries?limit=${encodeURIComponent(String(limit))}`,
    );
    return res.deliveries;
  },
};

/**
 * Kontrollbalansbedömningen.
 *
 * `create` gick INTE att spara mot den riktiga backenden: radskyddet på
 * kbr_assessments är can_write_case(case_id), och anroparen skickade
 * case_id som null. Varje sparning avvisades, vyn skrev "Kunde inte spara
 * analysen just nu" - varje gång. Ärendet ligger nu i sökvägen, så
 * misstaget inte går att göra om.
 */
/**
 * Bokföringen som lägesbild.
 *
 * `getLatestSnapshot` returnerade förut `null` rakt av - och eftersom
 * översiktens hela analysmotor hänger på den var insiktslistan permanent
 * tom i skarp drift. Motorn fanns; den fick aldrig något att räkna på.
 *
 * `importSie` skickar RÅA BYTES. Tolkningen sker på servern, för
 * lägesbilden är underlag för beslut om rekonstruktion och konkurs - och
 * ett underlag klienten själv sätter ihop är ett underlag klienten kan
 * skriva vad som helst i. Klienten tolkar fortfarande SIE lokalt när den
 * bara ska förifylla ett formulär; det är en annan sak.
 */
const financial = {
  ...supabaseAdapter.financial,
  async getLatestSnapshot(caseId: string): Promise<FinancialSnapshot | null> {
    return apiFetch<FinancialSnapshot | null>(`/v1/cases/${caseId}/financial/snapshot`);
  },
  async importSie(input: {
    caseId: string;
    fileName: string;
    bytes: Uint8Array;
  }): Promise<FinancialSnapshot> {
    const res = await apiFetch<{ snapshot: FinancialSnapshot }>(
      `/v1/cases/${input.caseId}/financial/sie`,
      {
        method: "POST",
        body: { fileName: input.fileName, content: tillBase64(input.bytes) },
      },
    );
    return res.snapshot;
  },
};

/**
 * Simuleringarna.
 *
 * Den enda porten där en metod kan svara "inte klar än": tunga körningar
 * köas till arbetaren, och `run` returnerar då status "queued". Att i
 * stället vänta in svaret hade bundit en HTTP-förbindelse i minuter.
 */
/**
 * Den registrerades rättigheter mot det egna API:et.
 *
 * Tre anrop, ingen logik. Att radera från klienten hade betytt ett halvt
 * raderat konto så fort nätet tappar - hela arbetet sker i en transaktion
 * i databasen, och API:et är bara vägen dit.
 */
const privacy = {
  async getErasureRequest(): Promise<ErasureRequestRecord | null> {
    return apiFetch<ErasureRequestRecord | null>("/v1/me/erasure");
  },
  async requestErasure(): Promise<ErasureRequestRecord> {
    return apiFetch<ErasureRequestRecord>("/v1/me/erasure", { method: "POST" });
  },
  async cancelErasure(): Promise<ErasureRequestRecord> {
    return apiFetch<ErasureRequestRecord>("/v1/me/erasure", { method: "DELETE" });
  },
};

const simulations = {
  async listByCase(caseId: string): Promise<SimulationRecord[]> {
    const res = await apiFetch<{ simulations: SimulationRecord[] }>(`/v1/cases/${caseId}/simulations`);
    return res.simulations;
  },
  async get(simulationId: string): Promise<SimulationRecord | null> {
    try {
      return await apiFetch<SimulationRecord>(`/v1/simulations/${simulationId}`);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 404) return null;
      throw error;
    }
  },
  async create(input: { caseId: string; name: string; description?: string | null; spec: unknown }) {
    return apiFetch<SimulationRecord>(`/v1/cases/${input.caseId}/simulations`, {
      method: "POST",
      body: { name: input.name, description: input.description ?? null, spec: input.spec },
    });
  },
  async update(input: { simulationId: string; name: string; description?: string | null; spec: unknown }) {
    return apiFetch<SimulationRecord>(`/v1/simulations/${input.simulationId}`, {
      method: "PATCH",
      body: { name: input.name, description: input.description ?? null, spec: input.spec },
    });
  },
  async remove(simulationId: string): Promise<void> {
    await apiFetch(`/v1/simulations/${simulationId}`, { method: "DELETE" });
  },
  async run(input: { simulationId: string; iterations: number; seed?: number | null }) {
    return apiFetch<SimulationRun>(`/v1/simulations/${input.simulationId}/run`, {
      method: "POST",
      body: { iterations: input.iterations, seed: input.seed ?? null },
    });
  },
  async cancel(simulationId: string): Promise<number> {
    const res = await apiFetch<{ cancelled: number }>(`/v1/simulations/${simulationId}/cancel`, {
      method: "POST",
    });
    return res.cancelled;
  },
  async latestRun(simulationId: string): Promise<SimulationRun | null> {
    return apiFetch<SimulationRun | null>(`/v1/simulations/${simulationId}/results`);
  },
  async getRun(runId: string): Promise<SimulationRun | null> {
    try {
      return await apiFetch<SimulationRun>(`/v1/simulation-runs/${runId}`);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 404) return null;
      throw error;
    }
  },
};

const kbr = {
  ...supabaseAdapter.kbr,
  async create(input: KbrAssessmentInput & { userId: string }): Promise<void> {
    if (!input.caseId) {
      // Ett tydligt fel slår ett tyst. Utan ärende finns ingen rad som
      // radskyddet kan släppa igenom, och det ska sägas rakt ut.
      throw new Error("Bedömningen måste höra till ett ärende.");
    }
    // userId skickas inte: servern tar den ur den prövade sessionen.
    await apiFetch(`/v1/cases/${input.caseId}/kbr`, {
      method: "POST",
      body: {
        orgNumber: input.orgNumber,
        companyName: input.companyName,
        ambitionLevel: input.ambitionLevel,
        hasRelatedCompanies: input.hasRelatedCompanies,
        isPartOfLargerStructure: input.isPartOfLargerStructure,
        shareCapital: input.shareCapital,
        totalAssets: input.totalAssets,
        totalLiabilities: input.totalLiabilities,
        status: input.status,
      },
    });
  },
  async getLatestByCase(caseId: string) {
    return apiFetch<{ status: string; createdAt: string } | null>(`/v1/cases/${caseId}/kbr`);
  },
};

/**
 * Likviditeten: betalningar och fakturor.
 *
 * `userId` i raderna skickas inte vidare. Servern tar den ur sessionen -
 * ett fält klienten fyller i är ett fält klienten kan ljuga i, och
 * user_id är den kolumn som säger vem som förde in raden.
 */
const payments = {
  ...supabaseAdapter.payments,
  async listByCase(caseId: string): Promise<PaymentRecord[]> {
    const res = await apiFetch<{ payments: PaymentRecord[] }>(`/v1/cases/${caseId}/payments`);
    return res.payments;
  },
  async createMany(rows: (NewPayment & { userId: string })[]): Promise<PaymentRecord[]> {
    if (rows.length === 0) return [];
    const caseId = rows[0].caseId;
    const res = await apiFetch<{ payments: PaymentRecord[] }>(`/v1/cases/${caseId}/payments`, {
      method: "POST",
      body: {
        rows: rows.map((r) => ({
          label: r.label,
          amount: r.amount,
          category: r.category,
          status: r.status,
          dueDate: r.dueDate,
          recurring: r.recurring,
        })),
      },
    });
    return res.payments;
  },
  async updateStatus(id: string, status: PaymentStatus): Promise<void> {
    await apiFetch(`/v1/payments/${id}`, { method: "PATCH", body: { status } });
  },
};

const invoices = {
  ...supabaseAdapter.invoices,
  async listByCase(caseId: string): Promise<InvoiceRecord[]> {
    const res = await apiFetch<{ invoices: InvoiceRecord[] }>(`/v1/cases/${caseId}/invoices`);
    return res.invoices;
  },
  async createMany(rows: (NewInvoice & { userId: string })[]): Promise<InvoiceRecord[]> {
    if (rows.length === 0) return [];
    const caseId = rows[0].caseId;
    const res = await apiFetch<{ invoices: InvoiceRecord[] }>(`/v1/cases/${caseId}/invoices`, {
      method: "POST",
      body: {
        rows: rows.map((r) => ({
          label: r.label,
          amount: r.amount,
          direction: r.direction,
          status: r.status,
          issueDate: r.issueDate,
          dueDate: r.dueDate,
          counterpart: r.counterpart,
        })),
      },
    });
    return res.invoices;
  },
  async updateStatus(id: string, status: InvoiceStatus): Promise<void> {
    await apiFetch(`/v1/invoices/${id}`, { method: "PATCH", body: { status } });
  },
};

const audit = {
  ...supabaseAdapter.audit,
  async listByCase(caseId: string) {
    const res = await apiFetch<{ events: unknown[] }>(`/v1/cases/${caseId}/journal`);
    return res.events as Awaited<ReturnType<DataPort["audit"]["listByCase"]>>;
  },
};

/**
 * Adaptern: de flyttade portarna ovanpå den befintliga.
 *
 * Spridningen av `supabaseAdapter` först är det som gör migreringen
 * möjlig att göra stegvis - och samtidigt det som ska försvinna. När
 * MIGRATED_PORTS täcker hela DataPort tas den raden bort, och då är
 * "inte Supabase" sant hela vägen.
 */
export const awsAdapter: DataPort = {
  ...supabaseAdapter,
  contact: contact as DataPort["contact"],
  billing: billing as DataPort["billing"],
  ops: ops as DataPort["ops"],
  apiKeys: apiKeys as DataPort["apiKeys"],
  advisorTools: advisorTools as DataPort["advisorTools"],
  members: members as DataPort["members"],
  cases: cases as DataPort["cases"],
  dialogue: dialogue as DataPort["dialogue"],
  tasks: tasks as DataPort["tasks"],
  payments: payments as DataPort["payments"],
  invoices: invoices as DataPort["invoices"],
  financial: financial as DataPort["financial"],
  simulations: simulations as DataPort["simulations"],
  privacy: privacy as DataPort["privacy"],
  documents: documents as DataPort["documents"],
  messages: messages as DataPort["messages"],
  notificationSettings: notificationSettings as DataPort["notificationSettings"],
  kbr: kbr as DataPort["kbr"],
  audit: audit as DataPort["audit"],
  profile: profile as DataPort["profile"],
  shares: shares as DataPort["shares"],
};
