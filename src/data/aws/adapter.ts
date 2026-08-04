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
import type {
  CaseDecisionRecord,
  CaseMessage,
  CaseRecord,
  CaseTask,
  DocumentRecord,
  PaymentRecord,
} from "../types";
import { supabaseAdapter } from "../supabase/adapter";
import { apiFetch, clearToken, setToken } from "./client";

/**
 * Portarna som verkligen går mot eget API. Listan är produktens
 * migreringsmätare - den ska växa tills delegeringen kan tas bort.
 */
export const MIGRATED_PORTS = [
  "cases.getLatest",
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
  // upload/download ligger kvar: de kräver signerade URL:er mot S3, och
  // den koden finns inte förrän det finns en hink att signera mot.
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
  cases: cases as DataPort["cases"],
  dialogue: dialogue as DataPort["dialogue"],
  tasks: tasks as DataPort["tasks"],
  payments: payments as DataPort["payments"],
  documents: documents as DataPort["documents"],
  messages: messages as DataPort["messages"],
  kbr: kbr as DataPort["kbr"],
  audit: audit as DataPort["audit"],
};
