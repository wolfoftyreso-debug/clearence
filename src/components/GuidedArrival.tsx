import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { data } from "@/data";
import { ORIGIN_PARAM, buildArrival, readOrigin } from "@/lib/guidedArrival";
import { playbookForTask } from "@/lib/taskIntelligence";
import { ArrowLeft, Target } from "lucide-react";

/**
 * "Du kom hit för att göra det här."
 *
 * Visas överst på den sida en rekommendation leder till, och bara då -
 * ingen som navigerat själv ska mötas av en förklaring till varför de är
 * någonstans de valde att gå.
 *
 * Rutan följer förberedelseregeln (docs/design-system.md): vad du kom
 * för, varför det behövs, vad KLART betyder här, och vad som händer
 * sedan. Den sista delen är den som gör skillnad - utan en väg tillbaka
 * blir verktyget en återvändsgränd, och användaren får själv komma ihåg
 * att uppgiften finns.
 *
 * Rutan är läsning med EN handling: knappen som bockar av och tar en
 * tillbaka. Den ligger sist, efter det som förklarar vad man bockar av.
 */
export const GuidedArrival = () => {
  const { search } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(false);

  const origin = readOrigin(search);

  const { data: caseRecord } = useQuery({
    queryKey: ["latest-case"],
    queryFn: () => data.cases.getLatest(),
    enabled: !!origin,
  });
  const { data: tasks } = useQuery({
    queryKey: ["case-tasks", caseRecord?.id],
    queryFn: () => data.tasks.listByCase(caseRecord!.id),
    enabled: !!origin && !!caseRecord,
  });
  const { data: members } = useQuery({
    queryKey: ["case-members", caseRecord?.id],
    queryFn: () => data.members.listMembers(caseRecord!.id),
    enabled: !!origin && !!caseRecord,
  });
  const { data: documents } = useQuery({
    queryKey: ["case-documents", caseRecord?.id],
    queryFn: () => data.documents.listByCase(caseRecord!.id),
    enabled: !!origin && !!caseRecord,
  });
  const { data: payments } = useQuery({
    queryKey: ["case-payments", caseRecord?.id],
    queryFn: () => data.payments.listByCase(caseRecord!.id),
    enabled: !!origin && !!caseRecord,
  });

  const task = useMemo(
    () => (tasks ?? []).find((t) => t.id === origin) ?? null,
    [tasks, origin],
  );

  // Adressen städas när rutan stängs eller uppgiften bockas av, så att en
  // omladdning inte återuppväcker ett besked användaren redan hanterat.
  const clearOrigin = () => {
    const params = new URLSearchParams(search);
    params.delete(ORIGIN_PARAM);
    const rest = params.toString();
    navigate({ search: rest ? `?${rest}` : "" }, { replace: true });
  };

  const complete = useMutation({
    mutationFn: () => data.tasks.setDone(task!.id, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case-tasks"] });
      navigate("/dashboard#frister");
    },
  });

  useEffect(() => {
    setDismissed(false);
  }, [origin]);

  if (!origin || dismissed || !caseRecord) return null;

  // Utan sparad uppgift går det ändå att säga varför man är här; det som
  // inte går är att bocka av något som inte finns.
  const label = task?.label ?? null;
  if (!label) return null;

  const playbook = playbookForTask(label, {
    caseRecord,
    members: members ?? [],
    documents: documents ?? [],
    payments: payments ?? [],
    kbr: null,
  });
  const arrival = buildArrival(label, playbook, window.location.pathname);

  return (
    <section
      aria-label="Därför är du här"
      className="mb-5 rounded-md bg-secondary/60 p-4"
    >
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        <Target className="h-3.5 w-3.5" aria-hidden="true" />
        Därför är du här
      </p>

      <dl className="mt-2.5 space-y-2 text-sm leading-relaxed">
        <div>
          <dt className="inline font-semibold text-foreground">Du kom för att: </dt>
          <dd className="inline text-foreground/80">{arrival.task}</dd>
        </div>
        <div>
          <dt className="inline font-semibold text-foreground">Därför behövs det: </dt>
          <dd className="inline text-foreground/75">{arrival.why}</dd>
        </div>
        <div>
          <dt className="inline font-semibold text-foreground">Klart betyder: </dt>
          <dd className="inline text-foreground/75">{arrival.doneMeans}</dd>
        </div>
        <div>
          <dt className="inline font-semibold text-foreground">Sedan: </dt>
          <dd className="inline text-foreground/75">{arrival.afterwards}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="accent"
          size="sm"
          disabled={complete.isPending}
          onClick={() => complete.mutate()}
        >
          Klar - bocka av och gå tillbaka
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setDismissed(true);
            clearOrigin();
          }}
        >
          Jag jobbar vidare här
        </Button>
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard#frister")}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Tillbaka utan att bocka av
        </Button>
      </div>
    </section>
  );
};
