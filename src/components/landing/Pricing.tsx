import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { data } from "@/data";
import {
  DEFAULT_COMPANY_PLAN,
  LOCKED_UNTIL_FIRST_PAYMENT,
  PLAN_TERMS,
  formatPlanPrice,
} from "@/lib/pricing";
import { Check } from "lucide-react";

/**
 * Priset, öppet på startsidan: EN plan, inga nivåtabeller, inga
 * asterisker. Målgruppen är pressad - modellen ska kännas rättvis och
 * aldrig som en inlåsning, och det sägs rakt ut: allt skapande är
 * gratis att börja med, arbetet finns alltid kvar, och det som väntar
 * på första betalningen är export och delning.
 *
 * Beloppet hämtas ur driftparametern - det står ingenstans i koden.
 */
const Pricing = () => {
  const { data: plan } = useQuery({
    queryKey: ["company-plan"],
    queryFn: () => data.billing.getCompanyPlan(),
    retry: false,
  });

  return (
    <section id="pris" className="scroll-mt-20 border-b border-border py-16 md:py-24">
      <div className="container px-4">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-display sm:text-4xl">Ett pris. Inga överraskningar.</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Kom igång gratis: samtalet, analysen, dokumenten och
            handlingsplanen är öppna från början, och allt du skapar finns
            kvar. När du vill exportera och dela med externa rådgivare
            aktiveras abonnemanget.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-md border border-accent/40 bg-card p-6 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">
              Clearance Beta
            </p>
            <p className="mt-3 font-display text-4xl text-foreground">
              {formatPlanPrice(plan ?? DEFAULT_COMPANY_PLAN)}
            </p>
            <ul className="mt-5 space-y-2.5 border-t border-border pt-5 text-sm">
              {PLAN_TERMS.map((term) => (
                <li key={term} className="flex items-start gap-2.5 text-foreground">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" aria-hidden="true" />
                  <span>{term}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-md border border-border bg-card p-6">
            <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Gratis tills du behöver mer
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Nulägesanalysen, samtalet med rådgivaren, dokumenten,
              handlingsplanen och lägesbilden kostar ingenting. Det här
              aktiveras när första fakturan är betald:
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {LOCKED_UNTIL_FIRST_PAYMENT.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-foreground">
                  <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-accent" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Du blir aldrig inlåst: ingenting raderas, och pausar du
              abonnemanget står allt kvar när du kommer tillbaka.{" "}
              <Link to="/kontakt" className="font-medium text-accent underline underline-offset-4">
                Frågor om priset?
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
