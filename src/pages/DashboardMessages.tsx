import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { data } from "@/data";
import { Loader2, MessageSquare, Send } from "lucide-react";

/**
 * Korrespondensen i ärendet.
 *
 * Poängen är att den ligger kvar. Under en rekonstruktion går frågor och svar
 * idag via mejl mellan bolaget, rekonstruktören och revisorn - och när någon
 * slutar eller en brevlåda stängs är historiken borta, i just det ärende där
 * man senare behöver kunna visa vad som sagts och när.
 *
 * Ett skickat meddelande går inte att ändra. Det är en databasregel, inte en
 * artighet i gränssnittet: en korrespondens som kan skrivas om i efterhand
 * duger inte som underlag.
 */

const MAX_LENGTH = 10000;

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString("sv-SE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const DashboardMessages = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const { data: latestCase, isLoading: loadingCase } = useQuery({
    queryKey: ["latest-case", user?.id],
    queryFn: () => data.cases.getLatest(),
    enabled: !!user,
  });

  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ["case-messages", latestCase?.id],
    queryFn: () => data.messages.listByCase(latestCase!.id),
    enabled: !!latestCase,
  });

  const send = useMutation({
    mutationFn: (text: string) => data.messages.send(latestCase!.id, text),
    onSuccess: () => {
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["case-messages", latestCase?.id] });
    },
  });

  // Nyast underst, som i en tråd. Rullar till slutet när något kommer in.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages?.length]);

  const trimmed = body.trim();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed || !latestCase) return;
    send.mutate(trimmed);
  };

  return (
    <DashboardShell title="Meddelanden">
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
        <div className="max-w-3xl">
          <p className="text-muted-foreground">
            Frågor och svar i ärendet {latestCase.companyName || latestCase.orgNumber}.
            Syns för dig och för dem du har gett åtkomst till ärendet – aldrig för
            borgenärer.
          </p>

          <div className="mt-6 space-y-3">
            {loadingMessages ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-accent" aria-hidden="true" />
              </div>
            ) : (messages ?? []).length === 0 ? (
              <p className="rounded-md border border-border bg-secondary/40 p-6 text-center text-muted-foreground">
                Inga meddelanden än. Skriv det första nedan.
              </p>
            ) : (
              (messages ?? []).map((message) => {
                const mine = message.authorUserId === user?.id;
                return (
                  <article
                    key={message.id}
                    className={`rounded-md border p-4 ${
                      mine ? "border-accent/30 bg-accent/5" : "border-border bg-card"
                    }`}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {mine ? "Du" : "Motpart i ärendet"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatWhen(message.createdAt)}
                      </p>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed text-foreground">
                      {message.body}
                    </p>
                  </article>
                );
              })
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <label htmlFor="message-body" className="block text-sm font-medium text-foreground">
              Nytt meddelande
            </label>
            <Textarea
              id="message-body"
              rows={4}
              maxLength={MAX_LENGTH}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Skriv här. Meddelandet går inte att ändra när det är skickat."
            />
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
    </DashboardShell>
  );
};

export default DashboardMessages;
