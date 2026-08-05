import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { data } from "@/data";
import type { ContactMessageRecord, ContactStatus, ContactTopic } from "@/data/types";
import { Inbox, Loader2, ShieldOff } from "lucide-react";

/**
 * Driftinkorgen.
 *
 * Här landar det som skickas i kontaktformuläret. Sidan visar ingenting utan
 * administratörsbehörighet, men det är inte det som skyddar innehållet: den
 * riktiga gränsen är RLS på public.contact_messages. Att dölja sidan är
 * bekvämlighet, och behörighetskontrollen nedan skulle kunna svara fel utan
 * att en enda rad läckte.
 */

const TOPIC_LABEL: Record<ContactTopic, string> = {
  question: "Fråga om tjänsten",
  company: "Företag som behöver hjälp",
  advisor: "Rådgivare",
  invoice: "Faktura",
  privacy: "Personuppgifter",
  bug: "Felanmälan",
  other: "Annat",
};

const STATUS_LABEL: Record<ContactStatus, string> = {
  new: "Ny",
  in_progress: "Pågår",
  answered: "Besvarad",
  closed: "Avslutad",
};

const STATUS_TONE: Record<ContactStatus, string> = {
  new: "bg-warning/15 text-foreground border-warning/40",
  in_progress: "bg-accent/10 text-foreground border-accent/40",
  answered: "bg-success/10 text-foreground border-success/40",
  closed: "bg-secondary text-muted-foreground border-border",
};

const STATUS_ORDER: ContactStatus[] = ["new", "in_progress", "answered", "closed"];

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const MessageCard = ({
  message,
  onStatus,
  isSaving,
}: {
  message: ContactMessageRecord;
  onStatus: (status: ContactStatus, note?: string | null) => void;
  isSaving: boolean;
}) => {
  const [note, setNote] = useState(message.internalNote ?? "");
  const noteChanged = note.trim() !== (message.internalNote ?? "").trim();

  return (
    <li className="rounded-md border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground">{message.name}</h3>
          <p className="mt-0.5 break-words text-sm text-muted-foreground">
            {/* Avsändarens adress, inte vår. Den finns här för att kunna
                svara, och står bara i den inloggade vyn. */}
            <a
              href={`mailto:${message.email}`}
              className="underline-offset-4 hover:underline"
            >
              {message.email}
            </a>
            {message.phone && <> · {message.phone}</>}
            {message.company && <> · {message.company}</>}
          </p>
        </div>
        <span
          className={`flex-shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[message.status]}`}
        >
          {STATUS_LABEL[message.status]}
        </span>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {TOPIC_LABEL[message.topic]} · {formatWhen(message.createdAt)}
        {message.userId ? " · inloggad avsändare" : " · ej inloggad"}
      </p>

      <p className="mt-4 whitespace-pre-wrap break-words border-l-2 border-border pl-4 text-sm leading-relaxed text-foreground">
        {message.message}
      </p>

      <div className="mt-4 space-y-2">
        <label
          htmlFor={`note-${message.id}`}
          className="block text-xs font-medium text-muted-foreground"
        >
          Intern anteckning – syns inte för avsändaren
        </label>
        <Textarea
          id={`note-${message.id}`}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Vad som gjorts, vad som väntar."
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {STATUS_ORDER.filter((s) => s !== message.status).map((s) => (
          <Button
            key={s}
            size="sm"
            variant="outline"
            disabled={isSaving}
            onClick={() => onStatus(s, noteChanged ? note.trim() || null : undefined)}
          >
            Markera som {STATUS_LABEL[s].toLowerCase()}
          </Button>
        ))}
        {noteChanged && (
          <Button
            size="sm"
            variant="accent"
            disabled={isSaving}
            onClick={() => onStatus(message.status, note.trim() || null)}
          >
            Spara anteckning
          </Button>
        )}
      </div>
    </li>
  );
};

const AdminInbox = () => {
  const queryClient = useQueryClient();
  const [showClosed, setShowClosed] = useState(false);

  const { data: isAdmin, isLoading: checkingAdmin } = useQuery({
    queryKey: ["am-i-admin"],
    queryFn: () => data.contact.amIAdmin(),
  });

  const { data: messages, isLoading } = useQuery({
    queryKey: ["contact-messages"],
    queryFn: () => data.contact.listAll(),
    enabled: isAdmin === true,
  });

  const setStatus = useMutation({
    mutationFn: ({
      id,
      status,
      note,
    }: {
      id: string;
      status: ContactStatus;
      note?: string | null;
    }) => data.contact.updateStatus(id, status, note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contact-messages"] }),
  });

  const visible = (messages ?? []).filter((m) => showClosed || m.status !== "closed");
  const openCount = (messages ?? []).filter((m) => m.status === "new").length;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-24 pb-16">
        <section data-guide="inkorgen" className="container px-4">
          {checkingAdmin ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden="true" />
            </div>
          ) : !isAdmin ? (
            <div className="max-w-xl rounded-md border border-border bg-card p-6">
              <ShieldOff className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              <h1 className="mt-4 font-display text-2xl text-foreground">
                Sidan är för driftbehörighet
              </h1>
              <p className="mt-2 leading-relaxed text-muted-foreground">
                Ditt konto har inte behörighet till inkorgen. Behörighet tilldelas
                direkt i databasen – det finns med flit ingen väg att begära den
                härifrån.
              </p>
              <Button variant="outline" className="mt-6" asChild>
                <Link to="/">Till startsidan</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="font-display text-3xl text-foreground">Inkorg</h1>
                  <p className="mt-2 text-muted-foreground">
                    Meddelanden från kontaktformuläret.
                    {openCount > 0 && (
                      <>
                        {" "}
                        <span className="font-medium text-foreground">
                          {openCount} {openCount === 1 ? "nytt" : "nya"}
                        </span>{" "}
                        att ta hand om.
                      </>
                    )}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowClosed((v) => !v)}>
                  {showClosed ? "Dölj avslutade" : "Visa avslutade"}
                </Button>
              </div>

              {setStatus.isError && (
                <p className="mt-4 text-sm text-destructive" role="alert">
                  Kunde inte spara ändringen. Försök igen.
                </p>
              )}

              {isLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden="true" />
                </div>
              ) : visible.length === 0 ? (
                <div className="mt-8 rounded-md border border-border bg-secondary/40 p-8 text-center">
                  <Inbox className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
                  <p className="mt-3 text-muted-foreground">
                    {messages && messages.length > 0
                      ? "Inget öppet just nu - de avslutade ärendena finns kvar."
                      : "Kontaktförfrågningar och partnersvar dyker upp här när de kommer in."}
                  </p>
                  {messages && messages.length > 0 && (
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowClosed(true)}>
                      Visa avslutade
                    </Button>
                  )}
                </div>
              ) : (
                <ul className="mt-8 space-y-4">
                  {visible.map((m) => (
                    <MessageCard
                      key={m.id}
                      message={m}
                      isSaving={setStatus.isPending}
                      onStatus={(status, note) =>
                        setStatus.mutate({ id: m.id, status, note })
                      }
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default AdminInbox;
