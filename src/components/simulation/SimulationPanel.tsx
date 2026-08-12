import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Dices, Info, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { data } from "@/data";
import type { SimulationRecord, SimulationRun } from "@/data/types";
import { CumulativeChart, DistributionChart } from "./DistributionChart";

/**
 * SIMULERINGSPANELEN.
 *
 * Panelen bär hela kedjan för EN simulering: kör, läs av, granska. Tre
 * saker är medvetet gjorda tvärtemot hur ett diagram brukar presenteras:
 *
 * 1. SANNOLIKHET SÄGS SOM SANNOLIKHET. Rutan säger "78 % av utfallen når
 *    målet", aldrig "målet nås". Ett Monte Carlo-resultat är en beräkning
 *    på antaganden, och den som läser det ska aldrig kunna missa det.
 *
 * 2. FRÖET OCH MOTORVERSIONEN VISAS, inte göms i en detaljvy. De är det
 *    som gör siffran granskningsbar - utan dem är fördelningen en bild
 *    någon påstår något om.
 *
 * 3. ANMÄRKNINGARNA STÅR ÖVERST, inte längst ned. En körning som inte
 *    konvergerat eller som kastat en femtedel av sina iterationer får
 *    aldrig se lika färdig ut som en som gick rent.
 */

interface SimulationPanelProps {
  simulation: SimulationRecord;
}

/** De val som styr körningen. Antalet är en avvägning, inte en detalj. */
const ITERATIONSVAL = [1000, 10000, 100000, 1000000] as const;

const procent = (v: number | null | undefined): string =>
  v === null || v === undefined ? "–" : `${(v * 100).toFixed(1)} %`;

const belopp = (v: number): string => {
  const abs = Math.abs(v);
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)} mn`;
  if (abs >= 1e4) return `${Math.round(v / 1000)} tkr`;
  return Math.round(v).toLocaleString("sv-SE");
};

interface Utfall {
  namn: string;
  etikett: string;
  enhet: string | null;
  statistik: {
    medel: number;
    median: number;
    min: number;
    max: number;
    standardavvikelse: number;
    antal: number;
    percentiler: Record<string, number>;
    medelvardetsKonfidensintervall: { nedre: number; ovre: number };
  };
  sannolikheter: { narMal: number | null; underKritisk: number | null; negativt: number };
  histogram: { kanter: number[]; antal: number[] };
  kanslighet: { input: string; rangkorrelation: number; andelAvVariation: number }[];
  konvergens: { iterationer: number; medel: number; p10: number; median: number; p90: number }[];
  stabil: boolean;
  mal: number | null;
  kritiskGrans: number | null;
}

export const SimulationPanel = ({ simulation }: SimulationPanelProps) => {
  const queryClient = useQueryClient();
  const [iterationer, setIterationer] = useState<number>(10000);
  // Tomt = servern väljer och skriver ned. Ifyllt = användaren upprepar en
  // tidigare körning exakt.
  const [fro, setFro] = useState<string>("");
  const [fel, setFel] = useState<string | null>(null);

  const nyckel = ["simulation-run", simulation.id];
  const { data: korning, isLoading } = useQuery({
    queryKey: nyckel,
    queryFn: () => data.simulations.latestRun(simulation.id),
    // En köad körning blir klar i arbetaren; panelen frågar om igen tills
    // den är det. Ingen polling när det inte finns något att vänta på.
    refetchInterval: (q) => {
      const r = q.state.data as SimulationRun | null | undefined;
      return r && (r.status === "queued" || r.status === "running") ? 2000 : false;
    },
  });

  const kor = useMutation({
    mutationFn: () =>
      data.simulations.run({
        simulationId: simulation.id,
        iterations: iterationer,
        seed: fro.trim() === "" ? null : Number(fro.trim()),
      }),
    onSuccess: (r) => {
      setFel(null);
      queryClient.setQueryData(nyckel, r);
    },
    onError: (e) => setFel(e instanceof Error ? e.message : "Körningen misslyckades."),
  });

  const avbryt = useMutation({
    mutationFn: () => data.simulations.cancel(simulation.id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: nyckel }),
  });

  const utfall = ((korning?.results?.outputs ?? []) as Utfall[]) ?? [];
  const anmarkningar = korning?.notes ?? [];
  const vantar = korning?.status === "queued" || korning?.status === "running";

  return (
    <section className="rounded-md border border-border bg-card p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-foreground">{simulation.name}</h2>
          {simulation.description && (
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{simulation.description}</p>
          )}
        </div>
        <span className="text-xs text-muted-foreground">Antagande v{simulation.specVersion}</span>
      </header>

      {/* --- Körningens inställningar ------------------------------------ */}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Iterationer
          </span>
          <select
            value={iterationer}
            onChange={(e) => setIterationer(Number(e.target.value))}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
          >
            {ITERATIONSVAL.map((n) => (
              <option key={n} value={n}>
                {n.toLocaleString("sv-SE")}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Frö</span>
          <input
            value={fro}
            onChange={(e) => setFro(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="väljs automatiskt"
            inputMode="numeric"
            className="h-9 w-40 rounded-md border border-border bg-background px-2 text-sm text-foreground"
          />
        </label>

        <Button type="button" onClick={() => kor.mutate()} disabled={kor.isPending || vantar}>
          {kor.isPending || vantar ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {vantar ? "Körs…" : "Startar…"}
            </>
          ) : (
            <>
              <Dices className="h-4 w-4" aria-hidden="true" />
              Kör simulering
            </>
          )}
        </Button>
        {vantar && (
          <Button type="button" variant="outline" onClick={() => avbryt.mutate()} disabled={avbryt.isPending}>
            Avbryt
          </Button>
        )}
        {korning?.status === "done" && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              // Upprepa EXAKT: samma frö, samma antal. Det är den knapp som
              // gör ett resultat granskningsbart i stället för bara sparat.
              setFro(String(korning.seed));
              setIterationer(korning.iterations);
            }}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Återanvänd frö
          </Button>
        )}
      </div>

      {fel && (
        <p role="alert" className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {fel}
        </p>
      )}

      {isLoading && <p className="mt-4 text-sm text-muted-foreground">Hämtar senaste körningen…</p>}

      {korning?.status === "failed" && (
        <p role="alert" className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          Körningen misslyckades: {korning.error}
        </p>
      )}

      {vantar && (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Körningen är köad och räknas i bakgrunden – tunga simuleringar körs av arbetaren så att
          gränssnittet inte låser sig. Resultatet dyker upp här när den är klar.
        </p>
      )}

      {/* --- Anmärkningar FÖRST ------------------------------------------ */}

      {anmarkningar.length > 0 && (
        <ul className="mt-4 space-y-2">
          {anmarkningar.map((a, i) => (
            <li
              key={i}
              className={`flex items-start gap-2 rounded-md border p-3 text-sm leading-relaxed ${
                a.allvar === "fel"
                  ? "border-destructive/40 bg-destructive/5 text-foreground"
                  : "border-border bg-secondary/30 text-muted-foreground"
              }`}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              {a.meddelande}
            </li>
          ))}
        </ul>
      )}

      {/* --- Resultaten --------------------------------------------------- */}

      {korning?.status === "done" &&
        utfall.map((o) => (
          <article key={o.namn} className="mt-6 border-t border-border pt-5 first:border-t-0">
            <h3 className="font-semibold text-foreground">{o.etikett}</h3>

            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              {[
                { e: "Median (P50)", v: belopp(o.statistik.median) },
                { e: "Medel", v: belopp(o.statistik.medel) },
                { e: "P10", v: belopp(o.statistik.percentiler.p10) },
                { e: "P90", v: belopp(o.statistik.percentiler.p90) },
              ].map((r) => (
                <div key={r.e}>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{r.e}</dt>
                  <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{r.v}</dd>
                </div>
              ))}
            </dl>

            {/* SANNOLIKHET, SAGD SOM SANNOLIKHET. */}
            {o.mal !== null && (
              <p className="mt-3 text-sm leading-relaxed text-foreground">
                <span className="font-semibold">{procent(o.sannolikheter.narMal)}</span> av utfallen når
                målet {belopp(o.mal)}
                {o.enhet ? ` ${o.enhet}` : ""}. Det är en beräkning på angivna antaganden, inte en
                prognos.
              </p>
            )}
            {o.kritiskGrans !== null && (
              <p className="mt-1 text-sm leading-relaxed text-foreground">
                <span className="font-semibold">{procent(o.sannolikheter.underKritisk)}</span> hamnar under
                den kritiska gränsen {belopp(o.kritiskGrans)}
                {o.enhet ? ` ${o.enhet}` : ""}.
              </p>
            )}

            <div className="mt-4">
              <DistributionChart
                histogram={o.histogram}
                percentiler={{
                  p10: o.statistik.percentiler.p10,
                  p50: o.statistik.percentiler.p50,
                  p90: o.statistik.percentiler.p90,
                }}
                medel={o.statistik.medel}
                mal={o.mal}
                kritiskGrans={o.kritiskGrans}
                enhet={o.enhet}
                format={belopp}
              />
            </div>

            <div className="mt-5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Sannolikhet att nå minst
              </h4>
              <div className="mt-2">
                <CumulativeChart histogram={o.histogram} mal={o.mal} enhet={o.enhet} format={belopp} />
              </div>
            </div>

            {/* --- Känsligheten: var osäkerheten sitter -------------------- */}

            <div className="mt-5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Vad som driver osäkerheten
              </h4>
              <ol className="mt-2 space-y-1.5">
                {o.kanslighet.map((k) => (
                  <li key={k.input} className="flex items-center gap-3 text-sm">
                    <span className="w-40 flex-shrink-0 truncate text-foreground">{k.input}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-md bg-muted">
                      <span
                        className="block h-full bg-foreground/70"
                        style={{ width: `${Math.round(k.andelAvVariation * 100)}%` }}
                      />
                    </span>
                    <span className="w-12 flex-shrink-0 text-right tabular-nums text-muted-foreground">
                      {Math.round(k.andelAvVariation * 100)} %
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Andel av den variation modellens variabler förklarar, mätt som rangkorrelation. Säger var
                osäkerheten sitter – inte vad som orsakar vad.
              </p>
            </div>

            {/* --- Konvergensen: räckte iterationerna? --------------------- */}

            <div className="mt-5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Stabilitet
              </h4>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {o.stabil
                  ? "Medianen och svansarna låg stilla mellan de två sista avstämningarna. Antalet iterationer räcker."
                  : "Fördelningen rörde sig fortfarande mellan de sista avstämningarna. Kör fler iterationer innan resultatet används som underlag."}
              </p>
              <table className="mt-2 w-full text-xs tabular-nums">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="pb-1 font-medium">Iterationer</th>
                    <th className="pb-1 font-medium">P10</th>
                    <th className="pb-1 font-medium">Median</th>
                    <th className="pb-1 font-medium">P90</th>
                  </tr>
                </thead>
                <tbody>
                  {o.konvergens.map((k) => (
                    <tr key={k.iterationer} className="border-t border-border">
                      <td className="py-1 text-muted-foreground">{k.iterationer.toLocaleString("sv-SE")}</td>
                      <td className="py-1 text-foreground">{belopp(k.p10)}</td>
                      <td className="py-1 text-foreground">{belopp(k.median)}</td>
                      <td className="py-1 text-foreground">{belopp(k.p90)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        ))}

      {/* --- Spårbarheten: det som gör siffran granskningsbar ------------- */}

      {korning && korning.status !== "queued" && (
        <footer className="mt-6 flex items-start gap-2 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <span>
            Frö <span className="font-mono text-foreground">{korning.seed}</span> · motor{" "}
            {korning.engineVersion} · antagande v{korning.specVersion} ·{" "}
            {korning.iterations.toLocaleString("sv-SE")} iterationer
            {korning.discardedIterations > 0 &&
              ` (${korning.discardedIterations.toLocaleString("sv-SE")} förkastade)`}
            {korning.durationMs !== null && ` · ${korning.durationMs} ms`}. Samma frö och samma
            motorversion ger exakt samma resultat.
          </span>
        </footer>
      )}
    </section>
  );
};
