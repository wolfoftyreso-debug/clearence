import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";

const CTA = () => {
  return (
    <section className="py-16 md:py-24">
      <div className="container px-4">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-display sm:text-4xl">
            Vill du få en tydligare bild av läget?
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Utvärderingen tar fem till tio minuter och kostar ingenting. Du behöver
            inget konto för att börja – det skapar du först om du vill spara det du
            fyllt i.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button variant="accent" size="xl" asChild>
              <Link to="/wizard">
                Starta utvärderingen
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
            </Button>
            <Button variant="outline" size="xl" asChild>
              <Link to="/kontakt">Ställ en fråga först</Link>
            </Button>
          </div>

          <p className="mt-8 border-l-2 border-border pl-4 text-sm leading-relaxed text-muted-foreground">
            CLEARANCE tillhandahåller administrativt stöd och allmän information, inte
            juridisk rådgivning. Bedömningarna bygger på de uppgifter du själv lämnar
            och bör stämmas av med en behörig rådgivare innan du fattar beslut.
          </p>
        </div>
      </div>
    </section>
  );
};

export default CTA;
