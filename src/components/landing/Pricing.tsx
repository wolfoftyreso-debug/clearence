import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { data } from "@/data";
import {
  DEFAULT_COMPANY_PLAN,
  PLAN_TERMS,
  PLAN_TIERS,
  formatMonthly,
} from "@/lib/pricing";
import { Check } from "lucide-react";

/**
 * Prisnivåerna. Start heter aldrig "provversion" - den ÄR gratis, för
 * att uppleva produkten. Nivåerna knyts till funktioner och användare,
 * aldrig till omsättning. Beloppen kommer ur driftparametern - de står
 * ingenstans i koden. Business och Enterprise lanseras stegvis; tills
 * dess är vägen dit ett samtal, inte en kassa.
 */
const Pricing = () => {
  const { data: plan } = useQuery({
    queryKey: ["company-plan"],
    queryFn: () => data.billing.getCompanyPlan(),
    retry: false,
  });
  const p = plan ?? DEFAULT_COMPANY_PLAN;

  const priceFor = (tierId: string): string => {
    if (tierId === "start") return "Gratis";
    if (tierId === "standard") return formatMonthly(p.monthlyExVatSek);
    if (tierId === "business")
      return p.businessExVatSek ? formatMonthly(p.businessExVatSek) : "Kontakta oss";
    return p.enterpriseExVatSek
      ? `${formatMonthly(p.enterpriseExVatSek)} eller offert`
      : "Offert";
  };

  return (
    <section id="pris" className="scroll-mt-20 border-b border-border py-16 md:py-24">
      <div className="container px-4">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-display sm:text-4xl">Priser utan överraskningar</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Börja gratis och uppgradera när du behöver mer. Nivåerna följer
            funktioner och antal användare – aldrig er omsättning. Allt du
            skapar finns alltid kvar, oavsett nivå.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`flex flex-col rounded-md border bg-card p-5 ${
                tier.id === "standard" ? "border-accent/50 shadow-soft" : "border-border"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                {tier.name}
              </p>
              <p className="mt-2 font-display text-2xl text-foreground">{priceFor(tier.id)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{tier.audience}</p>
              <ul className="mt-4 flex-1 space-y-2 border-t border-border pt-4 text-sm">
                {tier.includes.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-foreground">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
                {tier.excludes.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-muted-foreground">
                    <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-border" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              {(tier.id === "business" || tier.id === "enterprise") && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Lanseras stegvis –{" "}
                  <Link to="/kontakt" className="font-medium text-accent underline underline-offset-4">
                    kontakta oss
                  </Link>
                </p>
              )}
            </div>
          ))}
        </div>

        <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {PLAN_TERMS.map((term) => (
            <li key={term} className="flex items-center gap-2">
              <Check className="h-4 w-4 flex-shrink-0 text-success" aria-hidden="true" />
              {term}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default Pricing;
