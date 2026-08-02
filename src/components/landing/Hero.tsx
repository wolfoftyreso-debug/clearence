import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { SectionLink } from "./HowItWorksLink";
import { SiteSearch } from "./SiteSearch";
import { Clock, FileText, UserCheck } from "lucide-react";

/**
 * Startsidan, uppställd som myndighetstjänsterna företagare redan kan:
 * avsändare och tagline överst, ett vänligt bildblock med organiska
 * former, frågan "Vad vill du göra?", en stor sökruta, två pillerknappar
 * och länken till alla tjänster. Samma struktur - våra färger, vårt
 * innehåll och inte en lånad pixel: formerna är CSS, illustrationen är en
 * egen kompassros.
 *
 * Varför den uppställningen: målgruppen är företagare i kris som redan
 * navigerar verksamt.se och myndigheternas tjänster. En startsida som
 * beter sig som de sidorna kräver ingen inlärning - frågan, sökrutan och
 * knapparna gör jobbet.
 */

const facts = [
  {
    icon: Clock,
    title: "5–10 minuter",
    description: "Så lång tid tar nulägesanalysen",
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

/** Egen kompassros i linjemanér - sambandscentralens symbol, ingen annans. */
const CompassIllustration = () => (
  <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden="true">
    <circle cx="60" cy="60" r="44" fill="none" stroke="currentColor" strokeWidth="2.5" />
    <circle cx="60" cy="60" r="4" fill="currentColor" />
    <path d="M60 22 L67 53 L60 60 L53 53 Z" fill="currentColor" />
    <path d="M60 98 L53 67 L60 60 L67 67 Z" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M22 60 L53 53 M98 60 L67 67" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M33 33 L46 46 M87 87 L74 74 M87 33 L74 46 M33 87 L46 74" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
  </svg>
);

const Hero = () => {
  const { user } = useAuth();

  return (
    <section className="border-b border-border bg-secondary/30">
      <div className="container px-4 pb-14 pt-8 md:pb-20 md:pt-12">
        {/* Avsändaren och taglinen, som referensen: vem talar, till vem. */}
        <p className="max-w-2xl text-lg leading-relaxed text-accent">
          Sambandscentralen vid företagskris – ägare, VD, styrelse, revisor
          och jurist i samma ärende, vid behov även rekonstruktör,
          konkursförvaltare eller finansiär
        </p>

        {/* Bildblocket: organiska former i våra färger kring kompassrosen. */}
        <div className="relative mx-auto mt-8 h-56 w-72 sm:h-64 sm:w-80" aria-hidden="true">
          <div
            className="absolute -left-4 top-0 h-28 w-32 bg-warning/60"
            style={{ borderRadius: "58% 42% 55% 45% / 55% 48% 52% 45%" }}
          />
          <div
            className="absolute -right-2 bottom-0 h-32 w-36 bg-accent/25"
            style={{ borderRadius: "45% 55% 48% 52% / 52% 45% 55% 48%" }}
          />
          <div className="absolute left-1/2 top-1/2 flex h-44 w-44 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-card p-8 text-accent shadow-soft sm:h-52 sm:w-52">
            <CompassIllustration />
          </div>
        </div>

        {/* Frågan, sökrutan, pillerknapparna och tjänstelänken. */}
        <h1 className="mt-10 text-center font-display text-4xl text-accent sm:text-5xl">
          Vad vill du göra?
        </h1>

        <div className="mt-8">
          <SiteSearch />
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/wizard"
            className="rounded-full bg-accent px-7 py-3.5 text-base font-semibold text-accent-foreground shadow-soft transition-opacity hover:opacity-90"
          >
            Gratis nulägesanalys
          </Link>
          <Link
            to={user ? "/dashboard" : "/login"}
            className="rounded-full border border-border bg-card px-7 py-3.5 text-base font-semibold text-accent shadow-soft transition-colors hover:border-accent/50"
          >
            Mina sidor
          </Link>
        </div>

        <p className="mt-6 text-center">
          <SectionLink
            target="features"
            className="text-lg font-semibold text-accent underline underline-offset-4"
          >
            Se alla tjänster
          </SectionLink>
        </p>

        {/* Varför tjänsten finns - flyttad under blicken men inte borttagen:
            positioneringen är en del av produkten. */}
        <p className="mx-auto mt-12 max-w-2xl text-center text-base leading-relaxed text-muted-foreground">
          När ett bolag hamnar i ekonomiska problem löper juridik, skatt, bank,
          personal och myndighetskontakter parallellt. CLEARANCE är
          sambandscentralen: vad som ska göras, när och varför – med fristerna
          bevakade och besluten dokumenterade. Ekonomiska problem är också ett
          juridiskt ansvar, och att agera i tid är ofta avgörande.
        </p>

        <dl className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3">
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
