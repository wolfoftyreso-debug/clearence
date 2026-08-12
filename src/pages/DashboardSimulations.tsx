import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Dices, Loader2, Plus } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { SimulationPanel } from "@/components/simulation/SimulationPanel";
import { data } from "@/data";
import { useAuth } from "@/hooks/useAuth";

/**
 * SIMULERINGARNA.
 *
 * VARFÖR SIDAN INTE LIGGER I HUVUDMENYN. Menyn har sju val, och det taket
 * är satt med avsikt (Excellence rond 2, se DashboardShell). En simulering
 * är inte en egen arbetsyta - den svarar på en fråga likviditetsvyn redan
 * ställer: "räcker pengarna?" Sidan nås därför därifrån, och hör ihop med
 * den.
 *
 * VARFÖR DEN INTE ÄR TOM VID FÖRSTA BESÖKET. Ett Monte Carlo-verktyg som
 * öppnar med ett tomt formulär och elva fördelningar att välja mellan
 * används inte av någon som har en kris att hantera. Förslaget nedan är
 * därför en KOMPLETT och körbar modell av den vanligaste frågan, med
 * fördelningar som går att ändra efteråt. Antagandena är märkta som
 * antaganden - de är utgångspunkter, inte påståenden om just det här
 * bolaget.
 */

/**
 * Utgångsmodellen: klarar bolaget nästa kvartal?
 *
 * Fördelningarna är valda efter vad en människa faktiskt kan uppskatta:
 * triangulär där man kan säga lägst/troligast/högst, poisson för antal,
 * lognormal för belopp som inte kan bli negativa och har en svans uppåt.
 */
const UTGANGSMODELL = {
  inputs: [
    {
      namn: "Kunder",
      etikett: "Betalande kunder per månad",
      fordelning: { typ: "poisson", parametrar: { lambda: 40 } },
      enhet: "st",
      kalla: "Antagande – ändra till ert eget utfall",
      tilltro: "lag",
    },
    {
      namn: "Snittintakt",
      etikett: "Snittintäkt per kund",
      fordelning: { typ: "lognormal", parametrar: { mu: 9.5, sigma: 0.4 } },
      enhet: "kr",
      kalla: "Antagande – ändra till ert eget utfall",
      tilltro: "lag",
    },
    {
      namn: "Rorligakostnader",
      etikett: "Rörliga kostnader per månad",
      fordelning: { typ: "triangular", parametrar: { min: 200000, mode: 350000, max: 700000 } },
      enhet: "kr",
      kalla: "Antagande – ändra till ert eget utfall",
      tilltro: "lag",
    },
    {
      namn: "Kundforluster",
      etikett: "Andel som inte betalar",
      fordelning: { typ: "beta", parametrar: { alpha: 2, beta: 20 } },
      kalla: "Antagande – ändra till ert eget utfall",
      tilltro: "lag",
    },
  ],
  outputs: [
    {
      namn: "Intakter",
      etikett: "Intäkter per månad",
      uttryck: "Kunder * Snittintakt * (1 - Kundforluster)",
      enhet: "kr",
    },
    {
      namn: "Resultat",
      etikett: "Resultat per månad",
      // Ett senare resultat får läsa ett tidigare - Intakter räknas först.
      uttryck: "Intakter - Rorligakostnader - Fastakostnader",
      enhet: "kr",
      // Målet är att gå plus. Den kritiska gränsen är den förlust där
      // kassan tar slut inom kvartalet - den siffran ska varje bolag sätta
      // själv, men noll hade varit ett sämre förval än en påtaglig nivå.
      mal: 0,
      kritiskGrans: -500000,
    },
  ],
  konstanter: { Fastakostnader: 400000 },
};

const DashboardSimulations = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [fel, setFel] = useState<string | null>(null);

  const { data: latestCase } = useQuery({
    queryKey: ["latest-case", user?.id],
    queryFn: () => data.cases.getLatest(),
    enabled: !!user,
  });

  const { data: simuleringar, isLoading } = useQuery({
    queryKey: ["simulations", latestCase?.id],
    queryFn: () => data.simulations.listByCase(latestCase!.id),
    enabled: !!latestCase,
  });

  const skapa = useMutation({
    mutationFn: () =>
      data.simulations.create({
        caseId: latestCase!.id,
        name: "Klarar vi nästa kvartal?",
        description:
          "Utgångsmodell med antagna fördelningar. Ändra siffrorna till era egna innan resultatet används.",
        spec: UTGANGSMODELL,
      }),
    onSuccess: () => {
      setFel(null);
      void queryClient.invalidateQueries({ queryKey: ["simulations", latestCase?.id] });
    },
    onError: (e) => setFel(e instanceof Error ? e.message : "Simuleringen kunde inte skapas."),
  });

  return (
    <DashboardShell title="Simuleringar">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
        <Link
          to="/dashboard/liquidity"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Tillbaka till likviditeten
        </Link>

        <header className="mt-4">
          <h2 className="text-2xl font-semibold text-foreground">Simuleringar</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            En likviditetsplan ger ett svar. En simulering ger fördelningen av alla svar som
            antagandena tillåter – och därmed hur troligt varje utfall är. Resultatet är en
            beräkning på era antaganden, inte en prognos om framtiden.
          </p>
        </header>

        {!latestCase && !isLoading && (
          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
            Det finns inget ärende att simulera i ännu. Börja med{" "}
            <Link to="/dashboard/liquidity" className="underline underline-offset-4">
              likviditetsplanen
            </Link>
            .
          </p>
        )}

        {isLoading && <p className="mt-6 text-sm text-muted-foreground">Hämtar simuleringar…</p>}

        {fel && (
          <p role="alert" className="mt-4 text-sm leading-relaxed text-destructive">
            {fel}
          </p>
        )}

        {latestCase && simuleringar?.length === 0 && (
          <div className="mt-6 rounded-md border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <Dices className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Börja med en färdig modell</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Fyra osäkra variabler – kunder, snittintäkt, rörliga kostnader och kundförluster –
                  och två resultat: intäkter och resultat per månad. Alla siffror är{" "}
                  <span className="font-medium text-foreground">antaganden</span> som du ändrar till
                  era egna. Modellen går att köra direkt så att du ser vad den svarar.
                </p>
              </div>
            </div>
            <Button
              type="button"
              className="mt-4"
              onClick={() => skapa.mutate()}
              disabled={skapa.isPending}
            >
              {skapa.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="h-4 w-4" aria-hidden="true" />
              )}
              Skapa utgångsmodell
            </Button>
          </div>
        )}

        <div className="mt-6 space-y-6">
          {(simuleringar ?? []).map((s) => (
            <SimulationPanel key={s.id} simulation={s} />
          ))}
        </div>
      </div>
    </DashboardShell>
  );
};

export default DashboardSimulations;
