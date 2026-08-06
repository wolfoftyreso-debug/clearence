import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { data } from "@/data";
import { openFileUrl } from "@/lib/integrations/download";
import type { CaseMemberRecord, ConversationRecord } from "@/data/types";
import {
  AtSign,
  Check,
  Loader2,
  Merge,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  Users,
} from "lucide-react";

/**
 * Korrespondensen i ärendet - nu i trådar.
 *
 * Tre trådtyper med olika synlighet, upprätthållen i databasen:
 *
 *  - HELA ÄRENDET: grundtråden. Alla medlemmar ser den, borgenärer aldrig.
 *  - DIREKT: två personer. Övriga medlemmar ser inte ens att tråden finns -
 *    styrelseledamoten ska kunna fråga rekonstruktören något utan publik.
 *  - GRUPP: namngiven ("Bankfrågor"), valda deltagare. Öppnas samma grupp
 *    av misstag två gånger erbjuder sidan sammanslagning - meddelanden och
 *    deltagare flyttas, inget försvinner.
 *
 * Kvittensen "Uppfattat" är per meddelande och slutgiltig: den är svaret på
 * "har alla sett det här?", och den släcker taggnotisen för den som
 * förväntades svara. Bilagor är ärendedokument - de laddas upp till samma
 * dokumentlager som allt annat och lyder samma åtkomstregler.
 *
 * Ett skickat meddelande går inte att ändra. Databasregel, inte artighet.
 */

const MAX_LENGTH = 10000;

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString("sv-SE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Trådens visningsnamn: gruppens titel, eller motpartens namn i en direkt. */
const threadName = (conversation: ConversationRecord, myUserId: string | undefined) => {
  if (conversation.kind === "group") return conversation.title ?? "Grupp";
  const other = conversation.participants.find((p) => p.userId !== myUserId);
  return other?.displayName ?? "Direktmeddelande";
};

const normalizeTitle = (title: string) => title.trim().toLowerCase().replace(/\s+/g, " ");

interface NewThreadFormProps {
  members: CaseMemberRecord[];
  myUserId: string | undefined;
  onCreateDirect: (userId: string) => void;
  onCreateGroup: (title: string, userIds: string[]) => void;
  busy: boolean;
}

const NewThreadForm = ({ members, myUserId, onCreateDirect, onCreateGroup, busy }: NewThreadFormProps) => {
  const [kind, setKind] = useState<"direct" | "group">("direct");
  const [directTo, setDirectTo] = useState("");
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const others = members.filter((m) => m.userId !== myUserId && !m.revokedAt);

  if (others.length === 0) {
    return (
      <p className="rounded-md bg-secondary/40 p-3 text-xs leading-relaxed text-muted-foreground">
        Det finns inga andra deltagare i ärendet än.{" "}
        <Link to="/dashboard/deltagare" className="underline">
          Bjud in styrelse, revisor eller rådgivare
        </Link>{" "}
        så går det att starta direkta trådar och grupper.
      </p>
    );
  }

  const toggle = (userId: string) =>
    setSelected((prev) =>
      prev.includes(userId) ? prev.filter((x) => x !== userId) : [...prev, userId],
    );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (kind === "direct" && directTo) onCreateDirect(directTo);
    if (kind === "group" && title.trim().length >= 2 && selected.length > 0) {
      onCreateGroup(title.trim(), selected);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-md border border-border bg-card p-4">
      <div className="flex gap-2" role="radiogroup" aria-label="Trådtyp">
        {(
          [
            ["direct", "Direkt till en person"],
            ["group", "Grupp"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={kind === value}
            onClick={() => setKind(value)}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              kind === value
                ? "border-accent bg-accent/10 font-medium text-foreground"
                : "border-border text-muted-foreground hover:border-accent/50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {kind === "direct" ? (
        <div>
          <label htmlFor="direct-to" className="text-sm font-medium text-foreground">
            Till
          </label>
          <select
            id="direct-to"
            value={directTo}
            onChange={(e) => setDirectTo(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="">Välj person …</option>
            {others.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.displayName ?? m.email ?? "Deltagare"}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-muted-foreground">
            En direkt tråd ser bara ni två – inte övriga i ärendet.
          </p>
        </div>
      ) : (
        <>
          <div>
            <label htmlFor="group-title" className="text-sm font-medium text-foreground">
              Namn på gruppen
            </label>
            <Input
              id="group-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="t.ex. Bankfrågor"
              className="mt-1"
              maxLength={120}
            />
          </div>
          <fieldset>
            <legend className="text-sm font-medium text-foreground">Deltagare</legend>
            <div className="mt-1.5 space-y-1">
              {others.map((m) => (
                <label key={m.userId} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(m.userId)}
                    onChange={() => toggle(m.userId)}
                    className="h-4 w-4 rounded accent-accent"
                  />
                  <span className="text-foreground">
                    {m.displayName ?? m.email ?? "Deltagare"}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}

      <Button
        type="submit"
        size="sm"
        disabled={
          busy ||
          (kind === "direct" ? !directTo : title.trim().length < 2 || selected.length === 0)
        }
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Starta tråden"}
      </Button>
    </form>
  );
};

const DashboardMessages = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedThread, setSelectedThread] = useState<string>("general");
  const [showNewThread, setShowNewThread] = useState(false);
  const [body, setBody] = useState("");
  const [expectsReplyFrom, setExpectsReplyFrom] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const { data: latestCase, isLoading: loadingCase } = useQuery({
    queryKey: ["latest-case", user?.id],
    queryFn: () => data.cases.getLatest(),
    enabled: !!user,
  });
  const caseId = latestCase?.id;

  const { data: conversations } = useQuery({
    queryKey: ["conversations", caseId],
    queryFn: () => data.messages.listConversations(caseId as string),
    enabled: !!caseId,
  });
  const { data: members } = useQuery({
    queryKey: ["case-members", caseId],
    queryFn: () => data.members.listMembers(caseId as string),
    enabled: !!caseId,
  });
  const { data: documents } = useQuery({
    queryKey: ["case-documents", caseId],
    queryFn: () => data.documents.listByCase(caseId as string),
    enabled: !!caseId,
  });

  const activeConversation =
    selectedThread === "general"
      ? null
      : (conversations ?? []).find((c) => c.id === selectedThread) ?? null;

  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ["case-messages", caseId, selectedThread],
    queryFn: () =>
      selectedThread === "general"
        ? data.messages.listByCase(caseId as string)
        : data.messages.listByConversation(selectedThread),
    enabled: !!caseId,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["case-messages", caseId, selectedThread] });
    queryClient.invalidateQueries({ queryKey: ["conversations", caseId] });
    queryClient.invalidateQueries({ queryKey: ["open-mentions"] });
  };

  const visibleThreads = (conversations ?? []).filter((c) => !c.mergedInto);

  // Dubblettvarningen: två öppna grupper med samma normaliserade namn.
  const duplicatePair = useMemo(() => {
    const groups = visibleThreads.filter((c) => c.kind === "group" && c.title);
    for (const g of groups) {
      const twin = groups.find(
        (x) => x.id !== g.id && normalizeTitle(x.title!) === normalizeTitle(g.title!),
      );
      if (twin) {
        // Nyare slås in i äldre: den äldre tråden bär historiken.
        const [older, newer] = [g, twin].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        return { older, newer };
      }
    }
    return null;
  }, [visibleThreads]);

  const createDirect = useMutation({
    mutationFn: (otherUserId: string) => data.messages.createDirect(caseId as string, otherUserId),
    onSuccess: (id) => {
      setShowNewThread(false);
      setSelectedThread(id);
      refresh();
    },
  });
  const createGroup = useMutation({
    mutationFn: ({ title, userIds }: { title: string; userIds: string[] }) =>
      data.messages.createGroup(caseId as string, title, userIds),
    onSuccess: (id) => {
      setShowNewThread(false);
      setSelectedThread(id);
      refresh();
    },
  });
  const merge = useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) => data.messages.merge(from, to),
    onSuccess: (_r, { to }) => {
      setSelectedThread(to);
      refresh();
    },
  });
  const ack = useMutation({
    mutationFn: (messageId: string) => data.messages.ack(messageId),
    onSuccess: refresh,
  });

  const send = useMutation({
    mutationFn: async () => {
      let attachmentDocumentId: string | null = null;
      if (attachment && user) {
        const uploaded = await data.documents.upload({
          caseId: caseId as string,
          kind: "correspondence",
          file: attachment,
          source: "manual",
          note: "Bilaga i meddelandetråd",
          userId: user.id,
        });
        attachmentDocumentId = uploaded.id;
      }
      await data.messages.send(caseId as string, body.trim(), {
        conversationId: selectedThread === "general" ? null : selectedThread,
        attachmentDocumentId,
        expectsReplyFrom: expectsReplyFrom || null,
      });
    },
    onSuccess: () => {
      setBody("");
      setAttachment(null);
      setExpectsReplyFrom("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["case-documents", caseId] });
      refresh();
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages?.length]);

  const trimmed = body.trim();
  const nameOf = (userId: string | null) => {
    if (!userId) return "Okänd";
    if (userId === user?.id) return "Du";
    const member = (members ?? []).find((m) => m.userId === userId);
    return member?.displayName ?? member?.email ?? "Deltagare";
  };

  // Vem kan taggas: trådens deltagare, eller alla medlemmar i grundtråden.
  const taggable =
    selectedThread === "general"
      ? (members ?? []).filter((m) => !m.revokedAt && m.userId !== user?.id)
      : (activeConversation?.participants ?? [])
          .filter((p) => p.userId !== user?.id)
          .map((p) => ({ userId: p.userId, displayName: p.displayName, email: null }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed || !caseId || send.isPending) return;
    send.mutate();
  };

  return (
    <DashboardShell title="Meddelanden">
      <div data-guide="meddelandevyn">
      {loadingCase ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden="true" />
        </div>
      ) : !latestCase ? (
        <div className="max-w-xl rounded-md border border-border bg-card p-6">
          <MessageSquare className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-4 font-display text-xl text-foreground">Inget ärende än</h2>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            Meddelanden hör till ett ärende, så att korrespondensen ligger
            tillsammans med underlaget den handlar om.
          </p>
          <Button variant="accent" className="mt-6" asChild>
            <Link to="/wizard">Starta utvärderingen</Link>
          </Button>
        </div>
      ) : (
        <div className="max-w-4xl">
          <p className="text-muted-foreground">
            Frågor och svar i ärendet {latestCase.companyName || latestCase.orgNumber}. Direkta
            trådar och grupper ser bara sina deltagare – borgenärer ser aldrig något.
          </p>

          {/* Trådväljaren */}
          <div className="mt-5 flex flex-wrap items-center gap-2" role="tablist" aria-label="Trådar">
            <button
              type="button"
              role="tab"
              aria-selected={selectedThread === "general"}
              onClick={() => setSelectedThread("general")}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                selectedThread === "general"
                  ? "border-accent bg-accent/10 font-medium text-foreground"
                  : "border-border text-muted-foreground hover:border-accent/50"
              }`}
            >
              Hela ärendet
            </button>
            {visibleThreads.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                role="tab"
                aria-selected={selectedThread === conversation.id}
                onClick={() => setSelectedThread(conversation.id)}
                className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  selectedThread === conversation.id
                    ? "border-accent bg-accent/10 font-medium text-foreground"
                    : "border-border text-muted-foreground hover:border-accent/50"
                }`}
              >
                {conversation.kind === "group" && (
                  <Users className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {threadName(conversation, user?.id)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowNewThread((v) => !v)}
              className="flex items-center gap-1 rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-accent hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Ny tråd
            </button>
          </div>

          {showNewThread && (
            <div className="mt-3">
              <NewThreadForm
                members={members ?? []}
                myUserId={user?.id}
                onCreateDirect={(userId) => createDirect.mutate(userId)}
                onCreateGroup={(title, userIds) => createGroup.mutate({ title, userIds })}
                busy={createDirect.isPending || createGroup.isPending}
              />
            </div>
          )}

          {/* Dubblettvarningen */}
          {duplicatePair && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-warning/40 bg-warning/10 p-3">
              <p className="min-w-0 flex-1 text-sm leading-relaxed text-foreground">
                Gruppen <strong>{duplicatePair.older.title}</strong> finns två gånger. Slå ihop dem
                så hamnar alla meddelanden och deltagare i samma tråd – inget försvinner.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={merge.isPending}
                onClick={() =>
                  merge.mutate({ from: duplicatePair.newer.id, to: duplicatePair.older.id })
                }
              >
                <Merge className="h-4 w-4" aria-hidden="true" />
                Slå ihop
              </Button>
            </div>
          )}

          {/* Deltagare i vald tråd */}
          {activeConversation && (
            <p className="mt-3 text-xs text-muted-foreground">
              Deltagare:{" "}
              {activeConversation.participants
                .map((p) => (p.userId === user?.id ? "du" : (p.displayName ?? "deltagare")))
                .join(", ")}
            </p>
          )}

          {/* Meddelandena */}
          <div className="mt-4 space-y-3">
            {loadingMessages ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-accent" aria-hidden="true" />
              </div>
            ) : (messages ?? []).length === 0 ? (
              <p className="rounded-md border border-border bg-secondary/40 p-6 text-center text-muted-foreground">
                Inga meddelanden än. Skriv det första nedan.
              </p>
            ) : (
              (messages ?? []).map((message) => {
                const mine = message.authorUserId === user?.id;
                const ackedByMe = message.acks.some((a) => a.userId === user?.id);
                const attachmentDoc = message.attachmentDocumentId
                  ? (documents ?? []).find((d) => d.id === message.attachmentDocumentId)
                  : null;
                return (
                  <article
                    key={message.id}
                    className={`rounded-md border p-4 ${
                      mine ? "border-accent/30 bg-accent/5" : "border-border bg-card"
                    }`}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {nameOf(message.authorUserId)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatWhen(message.createdAt)}
                      </p>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed text-foreground">
                      {message.body}
                    </p>

                    {attachmentDoc && (
                      <button
                        type="button"
                        onClick={async () => {
                          const url = await data.documents.getDownloadUrl(attachmentDoc.id, 300);
                          if (url) openFileUrl(url);
                        }}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-foreground transition-colors hover:border-accent"
                      >
                        <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                        {attachmentDoc.fileName}
                      </button>
                    )}

                    {message.expectsReplyFrom && (
                      <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-warning/10 px-2 py-0.5 text-xs text-foreground">
                        <AtSign className="h-3 w-3" aria-hidden="true" />
                        Svar väntas av {nameOf(message.expectsReplyFrom)}
                        {message.acks.some((a) => a.userId === message.expectsReplyFrom) &&
                          " – uppfattat"}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border/60 pt-2">
                      {message.acks.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Uppfattat av{" "}
                          {message.acks.map((a) => nameOf(a.userId).toLowerCase()).join(", ")}
                        </p>
                      )}
                      {!mine && !ackedByMe && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={ack.isPending}
                          onClick={() => ack.mutate(message.id)}
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          Uppfattat
                        </Button>
                      )}
                      {!mine && ackedByMe && (
                        <p className="flex items-center gap-1 text-xs text-success">
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          Du har kvitterat
                        </p>
                      )}
                    </div>
                  </article>
                );
              })
            )}
            <div ref={endRef} />
          </div>

          {/* Skriv nytt */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <label htmlFor="message-body" className="block text-sm font-medium text-foreground">
              Nytt meddelande{" "}
              {selectedThread !== "general" && activeConversation && (
                <span className="font-normal text-muted-foreground">
                  i {threadName(activeConversation, user?.id)}
                </span>
              )}
            </label>
            <Textarea
              id="message-body"
              rows={4}
              maxLength={MAX_LENGTH}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Skriv här. Meddelandet går inte att ändra när det är skickat."
            />

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-accent hover:text-foreground">
                <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                {attachment ? attachment.name : "Bifoga fil"}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="sr-only"
                  onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
                />
              </label>

              {taggable.length > 0 && (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <AtSign className="h-3.5 w-3.5" aria-hidden="true" />
                  Förväntar svar av
                  <select
                    value={expectsReplyFrom}
                    onChange={(e) => setExpectsReplyFrom(e.target.value)}
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                    aria-label="Förväntar svar av"
                  >
                    <option value="">Ingen särskild</option>
                    {taggable.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.displayName ?? m.email ?? "Deltagare"}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {expectsReplyFrom && (
              <p className="text-xs text-muted-foreground">
                Den taggade får en notis som släcks först när hen kvitterar meddelandet.
              </p>
            )}

            {send.isError && (
              <p className="text-sm text-destructive" role="alert">
                Meddelandet gick inte att skicka. Försök igen.
              </p>
            )}
            <div className="flex justify-end">
              <Button type="submit" variant="accent" disabled={!trimmed || send.isPending}>
                {send.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-4 w-4" aria-hidden="true" />
                )}
                Skicka
              </Button>
            </div>
          </form>
        </div>
      )}
      </div>
    </DashboardShell>
  );
};

export default DashboardMessages;
