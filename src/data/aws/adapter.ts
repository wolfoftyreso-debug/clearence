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
  DocumentRecord,
  InvitationPeek,
  NewContactMessage,
  PaymentRecord,
  SharedCaseView,
  TimeEntryRecord,
  UserProfile,
  UserRole,
} from "../types";
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
  "payments.listByCase",
  "documents.listByCase",
  "documents.setReview",
  "documents.getDownloadUrl",
  "messages.listByCase",
  "messages.send",
  "kbr.getLatestByCase",
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
};

const payments = {
  ...supabaseAdapter.payments,
  async listByCase(caseId: string): Promise<PaymentRecord[]> {
    const res = await apiFetch<{ payments: PaymentRecord[] }>(`/v1/cases/${caseId}/payments`);
    return res.payments;
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

const messages = {
  ...supabaseAdapter.messages,
  async listByCase(caseId: string): Promise<CaseMessage[]> {
    const res = await apiFetch<{ messages: CaseMessage[] }>(`/v1/cases/${caseId}/messages`);
    return res.messages;
  },
  async send(caseId: string, body: string): Promise<void> {
    await apiFetch(`/v1/cases/${caseId}/messages`, { method: "POST", body: { body } });
  },
};

const kbr = {
  ...supabaseAdapter.kbr,
  async getLatestByCase(caseId: string) {
    return apiFetch<{ status: string; createdAt: string } | null>(`/v1/cases/${caseId}/kbr`);
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
  advisorTools: advisorTools as DataPort["advisorTools"],
  members: members as DataPort["members"],
  cases: cases as DataPort["cases"],
  dialogue: dialogue as DataPort["dialogue"],
  tasks: tasks as DataPort["tasks"],
  payments: payments as DataPort["payments"],
  documents: documents as DataPort["documents"],
  messages: messages as DataPort["messages"],
  kbr: kbr as DataPort["kbr"],
  audit: audit as DataPort["audit"],
  profile: profile as DataPort["profile"],
  shares: shares as DataPort["shares"],
};
