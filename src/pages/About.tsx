import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "react-router";
import {
  COMPANY,
  formatAddress,
  legalIdentityIsComplete,
  paymentAccountsSentence,
} from "@/lib/company";
import { ArrowRight } from "lucide-react";

/**
 * Varför Clearance finns.
 *
 * Texten bygger på det grundaren har berättat: att ha gått igenom en
 * rekonstruktion i eget företag, och att processen blev resurskrävande, dyr
 * och administrativt uppblåst. Inget mer än så påstås här.
 *
 * Bolagsuppgifterna kommer från `@/lib/company` och renderas bara i den
 * utsträckning de faktiskt är ifyllda. En påhittad grundarberättelse hade
 * varit lätt att skriva och omöjlig att stå för i ett möte.
 */

const FREE = [
  "Utvärdering av läget med tidslinje och lagrum",
  "Kontrollbalansräkning – beräkningen",
  "Likviditetsplanering och uppföljning",
  "Import av kontoutdrag",
  "Rapporter att skriva ut eller spara som PDF",
  "Dokumentarkiv för ärendet",
];

const PAID = [
  "Koppling mot bokföringssystem som Fortnox och Visma",
  "Förmedling till rådgivare, som faktureras rådgivaren – inte dig",
];

const About = () => {
  const accounts = paymentAccountsSentence();

  return (
  <div className="min-h-screen bg-background">
    <Header />
    <main className="pt-24 pb-16">
      <section className="container px-4">
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl text-foreground sm:text-4xl">
            Varför Clearance finns
          </h1>

          <div className="mt-6 space-y-4 text-lg leading-relaxed text-muted-foreground">
            <p>
              Clearance byggdes av någon som själv har tagit ett företag genom en
              rekonstruktion.
            </p>
            <p>
              Erfarenheten därifrån är enkel att sammanfatta: det svåraste var inte
              besluten. Det var administrationen runt dem. Telefonmöten som kunde
              varit ett mejl. Likviditetsplaner som byggdes om från grunden varje
              månad. Skuldlistor som aldrig stämde mellan bolagets system och
              rekonstruktörens. Samma fråga från hundra borgenärer, besvarad hundra
              gånger för hand.
            </p>
            <p>
              Den administrationen kostar pengar man inte har, i ett läge där varje
              dag räknas. Och den tar uppmärksamhet från det enda som faktiskt
              avgör utgången: om verksamheten går att rädda och hur snabbt någon
              agerar.
            </p>
            <p className="text-foreground">
              Clearance finns för att ta bort den delen. Inte för att ersätta
              rekonstruktören, juristen eller revisorn – utan för att se till att de
              får ett färdigt underlag i stället för en pärm att sortera.
            </p>
          </div>
        </div>
      </section>

      <section className="container px-4 mt-16">
        <div className="max-w-2xl">
          <h2 className="font-display text-2xl text-foreground">Vad det kostar</h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Att använda plattformen är gratis. Ett företag i kris ska inte behöva
            köpa mjukvara för att förstå sitt eget läge.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-2">
          <div className="bg-card p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-success">
              Kostar ingenting
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {FREE.map((item) => (
                <li key={item} className="flex gap-2.5 text-foreground">
                  <span
                    className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-success"
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-card p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Det vi tar betalt för
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {PAID.map((item) => (
                <li key={item} className="flex gap-2.5 text-foreground">
                  <span
                    className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-accent"
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            {/* Kontotypen kommer från invoiceAccount(), inte från den här
                texten. Bolaget har både plusgiro och bankgiro, och vilket som
                gäller ska stå på ett ställe. */}
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Betalning sker mot faktura{accounts ? ` till vårt ${accounts}` : ""}. Vi
              tar inte kortuppgifter och använder ingen betaltjänst – det finns inget
              konto att bli av med och inget abonnemang som förnyas av sig självt.
            </p>
          </div>
        </div>
      </section>

      <section className="container px-4 mt-16">
        <div className="max-w-2xl">
          <h2 className="font-display text-2xl text-foreground">Vem som står bakom</h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            {COMPANY.productName} är en produkt från {COMPANY.legalName}
            {legalIdentityIsComplete()
              ? `, org.nr ${COMPANY.orgNumber}, med säte i ${COMPANY.registeredOffice}.`
              : "."}
          </p>
          {legalIdentityIsComplete() && (
            <address className="mt-2 text-sm not-italic text-muted-foreground">
              {formatAddress()}
            </address>
          )}

          <div className="mt-8">
            <Button variant="accent" size="lg" asChild>
              <Link to="/wizard">
                Starta din utvärdering
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
    <Footer />
  </div>
  );
};

export default About;
