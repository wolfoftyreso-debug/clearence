import { Button } from "@/components/ui/button";
import { HowItWorksLink } from "./HowItWorksLink";
import { ArrowRight, Clock, FileText, UserCheck } from "lucide-react";
import { Link } from "react-router-dom";

const facts = [
  {
    icon: Clock,
    title: "5–10 minuter",
    description: "Så lång tid tar utvärderingen",
  },
  {
    icon: UserCheck,
    title: "Ingen inloggning",
    description: "Konto behövs först när du vill spara",
  },
  {
    icon: FileText,
    title: "Rapport att ta med",
    description: "Skriv ut eller spara som PDF",
  },
];

const Hero = () => {
  return (
    <section className="border-b border-border bg-secondary/30">
      <div className="container px-4 py-16 md:py-24">
        <div className="max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-wider text-accent">
            Gratis att använda
          </p>

          <h1 className="mt-4 text-4xl font-display leading-tight sm:text-5xl md:text-6xl">
            Ta kontroll över <span className="text-accent">företagskrisen</span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            När ett bolag hamnar i ekonomiska problem löper juridik, skatt,
            bank, personal och myndighetskontakter parallellt – och problemet är
            sällan att information saknas, utan att ingen längre har full
            kontroll. CLEARANCE är sambandscentralen: vad som ska göras, när och
            varför, med fristerna bevakade och besluten dokumenterade.
            Ekonomiska problem är också ett juridiskt ansvar, och att agera i
            tid är ofta avgörande.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button variant="hero" size="xl" asChild>
              <Link to="/wizard">
                Starta din utvärdering
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
            </Button>
            <Button variant="outline" size="xl" asChild>
              <HowItWorksLink>Se hur det fungerar</HowItWorksLink>
            </Button>
          </div>
        </div>

        <dl className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3">
          {facts.map((fact) => (
            <div key={fact.title} className="flex items-start gap-3 bg-card p-5">
              <fact.icon
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent"
                aria-hidden="true"
              />
              <div>
                <dt className="font-semibold text-foreground">{fact.title}</dt>
                <dd className="text-sm text-muted-foreground">{fact.description}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
};

export default Hero;
