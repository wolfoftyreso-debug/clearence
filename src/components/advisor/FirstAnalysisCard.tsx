import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { useGuide } from "@/components/guide/GuideProvider";
import type { FirstAnalysis } from "@/lib/advisor/firstAnalysis";
import { AlertTriangle, ArrowRight, Lightbulb, MapPin } from "lucide-react";

/**
 * Den första analysen, presenterad.
 *
 * Ordningen är medveten: förståelsen först (visa att du lyssnat),
 * sedan riskerna, sedan möjligheterna, och SIST vad analysen inte
 * säger. Gränserna ligger sist för att de ska läsas som en precisering
 * och inte som en brasklapp man hoppar över - men de ligger med, alltid.
 *
 * Varje observation bär sitt underlag. "Du svarade X" under varje punkt
 * är det som skiljer en analys från en spådom.
 */
/**
 * `showNextStep` styr om kortet bär sin egen "gå vidare"-knapp.
 *
 * I onboardingen äger STEGET nästa steg - där finns redan en enda tydlig
 * knapp längst ned, och en andra knapp inuti kortet som pekar åt samma
 * håll blev dubbla budskap (och tog dessutom en genväg förbi
 * överlämningen). Kortet visar då bara analysen; knappen bor på ett ställe.
 * Står kortet ensamt någon annanstans behåller det sin knapp.
 */
export const FirstAnalysisCard = ({
  analysis,
  showNextStep = true,
}: {
  analysis: FirstAnalysis;
  showNextStep?: boolean;
}) => {
  const guide = useGuide();
  return (
  <section aria-label="Första analysen" className="rounded-md border border-border bg-card p-4">
    <h3 className="text-base font-semibold text-foreground">{analysis.headline}</h3>
    <p className="mt-1.5 text-sm leading-relaxed text-foreground">{analysis.understanding}</p>

    {analysis.risks.length > 0 && (
      <div className="mt-4">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          Det jag skulle hålla ögonen på
        </p>
        <ul className="mt-2 space-y-2.5">
          {analysis.risks.map((r) => (
            <li key={r.text} className="text-sm leading-relaxed text-foreground">
              {r.text}
              <span className="mt-0.5 block text-xs text-muted-foreground">{r.basis}</span>
            </li>
          ))}
        </ul>
      </div>
    )}

    <div className="mt-4">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
        Det som talar för er
      </p>
      <ul className="mt-2 space-y-2.5">
        {analysis.opportunities.map((o) => (
          <li key={o.text} className="text-sm leading-relaxed text-foreground">
            {o.text}
            <span className="mt-0.5 block text-xs text-muted-foreground">{o.basis}</span>
          </li>
        ))}
      </ul>
    </div>

    <div className="mt-4 rounded-md bg-secondary/50 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        Det här säger analysen inte
      </p>
      <ul className="mt-1.5 space-y-1.5">
        {analysis.limits.map((l) => (
          <li key={l} className="text-xs leading-relaxed text-muted-foreground">
            {l}
          </li>
        ))}
      </ul>
    </div>

    {/* "Jag sparade precis det där under X" - och så VISAR den var.
        Att bara säga det lämnar användaren med en plats hen ska minnas;
        att visa det gör att hen hittar dit själv nästa gång. */}
    <div className="mt-4 rounded-md bg-secondary/50 p-3">
      <p className="text-xs leading-relaxed text-foreground">
        Analysen och allt du berättat sparas i ärendet. Du behöver aldrig leta efter den.
      </p>
      <button
        type="button"
        onClick={() =>
          guide.savedTo(
            "dokument",
            "Analysen och underlaget från introduktionen ligger i ärendets handlingar.",
          )
        }
        className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-accent underline underline-offset-2"
      >
        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
        Visa var det sparades
      </button>
    </div>

    {showNextStep && (
      <div className="mt-4">
        <p className="text-sm leading-relaxed text-muted-foreground">{analysis.nextStep.why}</p>
        <Button asChild variant="accent" className="mt-2.5">
          <Link to={analysis.nextStep.href}>
            {analysis.nextStep.label}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    )}
  </section>
  );
};
