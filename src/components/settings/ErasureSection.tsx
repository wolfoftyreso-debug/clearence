import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, ChevronDown, Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { data } from "@/data";
import {
  ERASURE_ACTION_LABEL,
  ERASURE_MANIFEST,
  KARENSDAGAR,
  RECTIFICATION_MAP,
  erasureSummary,
} from "@/lib/erasure";

/**
 * RÄTTELSE OCH RADERING (GDPR art. 16 och 17).
 *
 * Det som stod här förut var två meningar och en länk till ett
 * kontaktformulär. Rättigheten fanns i texten men inte i produkten.
 *
 * TVÅ SAKER STYR UTFORMNINGEN.
 *
 *  1. UNDANTAGEN VISAS FÖRST, INTE I EN FOTNOT. Ett raderingslöfte utan
 *     fakturor och händelselogg utskrivna är ett löfte som bryts vid
 *     första bokföringsrevisionen. Manifestet står öppet, med den
 *     rättsliga grunden för varje sak vi behåller.
 *  2. TVÅ STEG, INTE ETT. Efter karenstiden går raderingen inte att ta
 *     tillbaka. En bekräftelseruta är inte byråkrati här - den är det enda
 *     som skiljer ett medvetet beslut från ett felklick hos någon som är
 *     mitt i en kris.
 */

const dagarKvar = (isoDatum: string): number => {
  const kvar = new Date(isoDatum).getTime() - Date.now();
  return Math.max(0, Math.ceil(kvar / (24 * 60 * 60 * 1000)));
};

const svensktDatum = (iso: string) =>
  new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });

/** Manifestet, hopfällt tills någon vill läsa det. */
const Manifest = () => {
  const [oppet, setOppet] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOppet((v) => !v)}
        aria-expanded={oppet}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
      >
        <ChevronDown
          className={`h-4 w-4 transition-transform ${oppet ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
        {oppet ? "Dölj vad som händer" : "Läs exakt vad som händer med varje uppgift"}
      </button>

      {oppet && (
        <ul className="mt-3 space-y-3 border-l border-border pl-4">
          {ERASURE_MANIFEST.map((post) => (
            <li key={post.id}>
              <p className="text-sm font-medium text-foreground">
                {post.label}
                <span
                  className={`ml-2 text-xs font-bold uppercase tracking-wide ${
                    post.action === "behalls" ? "text-muted-foreground" : "text-accent"
                  }`}
                >
                  {ERASURE_ACTION_LABEL[post.action]}
                </span>
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{post.vad}</p>
              {post.grund && (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">Grund:</span> {post.grund}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** Var varje uppgift rättas - och vad som inte går att ändra själv. */
const Rattelse = () => (
  <div>
    <p className="font-medium text-foreground">Rättelse</p>
    <p className="mt-1">
      Du har rätt att få felaktiga uppgifter rättade. Här står var varje uppgift ändras – och
      vilka som kräver att vi gör det, med skälet utsatt.
    </p>
    <ul className="mt-3 space-y-2">
      {RECTIFICATION_MAP.map((rad) => (
        <li key={rad.uppgift} className="text-sm leading-relaxed">
          <span className="font-medium text-foreground">{rad.uppgift}:</span>{" "}
          {rad.plats ? (
            rad.href ? (
              <Link to={rad.href} className="underline underline-offset-4">
                {rad.plats}
              </Link>
            ) : (
              rad.plats
            )
          ) : (
            <span className="text-muted-foreground">
              går inte att ändra själv. {rad.varfor} {rad.vag}
            </span>
          )}
        </li>
      ))}
    </ul>
  </div>
);

export const ErasureSection = () => {
  const queryClient = useQueryClient();
  const [bekraftar, setBekraftar] = useState(false);
  const [fel, setFel] = useState<string | null>(null);

  const { data: begaran, isLoading } = useQuery({
    queryKey: ["erasure-request"],
    queryFn: () => data.privacy.getErasureRequest(),
  });

  const uppdatera = () => {
    setFel(null);
    setBekraftar(false);
    void queryClient.invalidateQueries({ queryKey: ["erasure-request"] });
  };
  const misslyckades = (e: unknown) =>
    setFel(e instanceof Error ? e.message : "Något gick fel. Försök igen.");

  const begar = useMutation({
    mutationFn: () => data.privacy.requestErasure(),
    onSuccess: uppdatera,
    onError: misslyckades,
  });
  const angrar = useMutation({
    mutationFn: () => data.privacy.cancelErasure(),
    onSuccess: uppdatera,
    onError: misslyckades,
  });

  const oppen = begaran?.status === "begard" ? begaran : null;

  return (
    <div>
      <p className="font-medium text-foreground">Radering</p>

      {isLoading && <p className="mt-1 text-sm text-muted-foreground">Hämtar…</p>}

      {!isLoading && !oppen && (
        <>
          <p className="mt-1">
            Du kan begära att kontot och dina personuppgifter raderas. Vi är raka med undantagen:{" "}
            {erasureSummary()}
          </p>
          <p className="mt-2">
            Begäran verkställs efter{" "}
            <span className="font-medium text-foreground">{KARENSDAGAR} dagar</span> och kan
            återkallas fram till dess. Därefter går den inte att ta tillbaka.
          </p>

          <Manifest />

          {!bekraftar ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setBekraftar(true)}
            >
              Begär radering av kontot
            </Button>
          ) : (
            <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-4">
              <div className="flex items-start gap-2.5">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive"
                  aria-hidden="true"
                />
                <p className="text-sm leading-relaxed text-foreground">
                  Efter {KARENSDAGAR} dagar raderas kontot. Ärenden där ingen annan har
                  behörighet raderas i sin helhet – analys, likviditetsplan, dokument och samtal.
                  Ladda ner dina uppgifter först om du vill ha kvar dem.
                </p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => begar.mutate()}
                  disabled={begar.isPending}
                >
                  {begar.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  )}
                  Ja, begär radering
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setBekraftar(false)}>
                  Avbryt
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {oppen && (
        <div className="mt-2 rounded-md border border-border bg-muted/40 p-4">
          <p className="text-sm font-semibold text-foreground">
            Radering begärd {svensktDatum(oppen.requestedAt)}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Kontot raderas {svensktDatum(oppen.effectiveAt)} –{" "}
            {dagarKvar(oppen.effectiveAt) === 0
              ? "inom det närmaste dygnet"
              : `om ${dagarKvar(oppen.effectiveAt)} ${
                  dagarKvar(oppen.effectiveAt) === 1 ? "dag" : "dagar"
                }`}
            . Fram till dess kan du ta tillbaka begäran, och ingenting har hänt med dina
            uppgifter.
          </p>

          <Manifest />

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => angrar.mutate()}
            disabled={angrar.isPending}
          >
            {angrar.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Undo2 className="h-4 w-4" aria-hidden="true" />
            )}
            Ta tillbaka begäran
          </Button>
        </div>
      )}

      {begaran?.status === "aterkallad" && !oppen && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-success">
          <Check className="h-4 w-4" aria-hidden="true" />
          Din tidigare begäran är återkallad. Ingenting raderades.
        </p>
      )}

      {fel && (
        <p role="alert" className="mt-3 text-sm leading-relaxed text-destructive">
          {fel}
        </p>
      )}

      <div className="mt-6">
        <Rattelse />
      </div>
    </div>
  );
};
