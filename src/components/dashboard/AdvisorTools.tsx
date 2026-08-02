import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { Clock, FileQuestion, Loader2, StickyNote, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { data } from "@/data";

/**
 * Klientverktygen: rådgivarens arbetsyta inne i klientens ärende.
 *
 * Visas bara för rådgivarrollen - bolaget ser sin vanliga vy. Tre verktyg:
 *
 *  ANTECKNINGAR är byråns eget arbetsmaterial. Synliga endast för sin
 *  författare - inte för bolaget, inte för andra deltagare - och det
 *  upprätthålls av radskyddet i databasen, inte av den här komponenten.
 *  Ska något delas finns meddelandena.
 *
 *  TIDEN är byråns faktureringsunderlag. Egna poster, egen summering.
 *
 *  KOMPLETTERINGEN är däremot ärendekommunikation: den blir en uppgift i
 *  bolagets handlingsplan OCH ett meddelande i ärendet, så att begäran
 *  syns där bolaget faktiskt arbetar - inte i en egen inkorg som ingen
 *  öppnar.
 */

const swedishDate = (iso: string) => format(new Date(iso), "d MMM", { locale: sv });

const formatHours = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
};

const NotesTool = ({ caseId }: { caseId: string }) => {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const { data: notes, isLoading } = useQuery({
    queryKey: ["case-notes", caseId],
    queryFn: () => data.advisorTools.listNotes(caseId),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["case-notes", caseId] });
  const add = useMutation({
    mutationFn: () => data.advisorTools.addNote(caseId, body),
    onSuccess: () => {
      setBody("");
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => data.advisorTools.removeNote(id),
    onSuccess: refresh,
  });

  return (
    <section
      aria-labelledby="notes-heading"
      className="rounded-md border border-border bg-card p-5 shadow-soft"
    >
      <h3 id="notes-heading" className="flex items-center gap-2 font-semibold text-foreground">
        <StickyNote className="h-5 w-5 text-accent" aria-hidden="true" />
        Interna anteckningar
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Ditt eget arbetsmaterial – syns bara för dig, aldrig för bolaget eller
        andra deltagare. Ska något delas: använd meddelandena.
      </p>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="T.ex. vad som sades i senaste samtalet, vad som ska följas upp …"
        aria-label="Ny intern anteckning"
        rows={2}
        className="mt-3"
      />
      <Button
        variant="outline"
        size="sm"
        className="mt-2"
        disabled={!body.trim() || add.isPending}
        onClick={() => add.mutate()}
      >
        Spara anteckning
      </Button>
      {isLoading ? (
        <Loader2 className="mt-3 h-4 w-4 animate-spin text-accent" aria-hidden="true" />
      ) : (
        (notes ?? []).length > 0 && (
          <ul className="mt-3 space-y-2">
            {(notes ?? []).map((note) => (
              <li
                key={note.id}
                className="flex items-start justify-between gap-3 rounded-md bg-secondary/40 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm leading-relaxed text-foreground">{note.body}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {swedishDate(note.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove.mutate(note.id)}
                  aria-label="Ta bort anteckningen"
                  className="text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  );
};

const TimeTool = ({ caseId }: { caseId: string }) => {
  const queryClient = useQueryClient();
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");
  const { data: entries } = useQuery({
    queryKey: ["time-entries", caseId],
    queryFn: () => data.advisorTools.listTime(caseId),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["time-entries", caseId] });
  const log = useMutation({
    mutationFn: () =>
      data.advisorTools.logTime({ caseId, minutes: Number(minutes), note: note || null }),
    onSuccess: () => {
      setMinutes("");
      setNote("");
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => data.advisorTools.removeTime(id),
    onSuccess: refresh,
  });

  const total = (entries ?? []).reduce((sum, e) => sum + e.minutes, 0);
  const parsed = Number(minutes);
  const valid = Number.isFinite(parsed) && parsed > 0 && parsed <= 1440;

  return (
    <section
      aria-labelledby="time-heading"
      className="rounded-md border border-border bg-card p-5 shadow-soft"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="time-heading" className="flex items-center gap-2 font-semibold text-foreground">
          <Clock className="h-5 w-5 text-accent" aria-hidden="true" />
          Tidsrapportering
        </h3>
        {total > 0 && (
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {formatHours(total)}
          </p>
        )}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Din nedlagda tid i ärendet – underlag för byråns fakturering. Du ser
        bara dina egna poster.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Input
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          inputMode="numeric"
          placeholder="Minuter"
          aria-label="Minuter"
          className="w-24 text-right tabular-nums"
        />
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Vad gjordes? (valfritt)"
          aria-label="Beskrivning av arbetet"
          className="min-w-0 flex-1"
        />
        <Button
          variant="outline"
          size="sm"
          disabled={!valid || log.isPending}
          onClick={() => log.mutate()}
        >
          Logga tid
        </Button>
      </div>
      {(entries ?? []).length > 0 && (
        <ul className="mt-3 divide-y divide-border">
          {(entries ?? []).map((entry) => (
            <li key={entry.id} className="flex items-baseline justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-sm text-foreground">
                  {entry.note ?? "Arbete i ärendet"}
                </p>
                <p className="text-xs text-muted-foreground">{swedishDate(entry.occurredOn)}</p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <span className="text-sm font-medium tabular-nums text-foreground">
                  {formatHours(entry.minutes)}
                </span>
                <button
                  type="button"
                  onClick={() => remove.mutate(entry.id)}
                  aria-label="Ta bort tidposten"
                  className="text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const CompletionTool = ({ caseId }: { caseId: string }) => {
  const queryClient = useQueryClient();
  const [request, setRequest] = useState("");
  const send = useMutation({
    mutationFn: async () => {
      const text = request.trim();
      // Två spår med samma innehåll: uppgiften hamnar i handlingsplanen där
      // bolaget arbetar, meddelandet ger sammanhanget och svarsvägen.
      await data.tasks.add(caseId, `Komplettering: ${text}`, null);
      await data.messages.send(caseId, `Komplettering begärd: ${text}`);
    },
    onSuccess: () => {
      setRequest("");
      queryClient.invalidateQueries({ queryKey: ["case-tasks", caseId] });
      queryClient.invalidateQueries({ queryKey: ["case-messages", caseId] });
    },
  });

  return (
    <section
      aria-labelledby="completion-heading"
      className="rounded-md border border-border bg-card p-5 shadow-soft"
    >
      <h3 id="completion-heading" className="flex items-center gap-2 font-semibold text-foreground">
        <FileQuestion className="h-5 w-5 text-accent" aria-hidden="true" />
        Begär komplettering
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Begäran läggs som uppgift i bolagets handlingsplan och skickas som
        meddelande i ärendet – den syns där bolaget arbetar.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Input
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          placeholder="T.ex. senaste balansrapporten, kundreskontra …"
          aria-label="Vad behöver kompletteras?"
          className="min-w-0 flex-1"
        />
        <Button
          variant="outline"
          size="sm"
          disabled={!request.trim() || send.isPending}
          onClick={() => send.mutate()}
        >
          Skicka begäran
        </Button>
      </div>
      {send.isSuccess && (
        <p className="mt-2 text-sm text-success" role="status">
          Begäran skickad – den ligger nu i bolagets handlingsplan och i
          meddelandena.
        </p>
      )}
      {send.isError && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          Begäran kunde inte skickas. Försök igen.
        </p>
      )}
    </section>
  );
};

/** Hela panelen. Gatear sig själv: utan rådgivarroll renderas ingenting. */
export const AdvisorTools = ({ caseId }: { caseId: string }) => {
  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => data.profile.getMine(),
  });
  if (profile?.role !== "advisor") return null;

  return (
    <div className="mt-6">
      <h2 className="font-semibold text-foreground">Klientverktyg</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Din arbetsyta i klientens ärende. Anteckningarna och tiden är dina
        egna; kompletteringar går till bolaget.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <NotesTool caseId={caseId} />
        <TimeTool caseId={caseId} />
        <div className="lg:col-span-2">
          <CompletionTool caseId={caseId} />
        </div>
      </div>
    </div>
  );
};
