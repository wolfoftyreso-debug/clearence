import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import {
  Compass,
  TrendingDown,
  Scale,
  ShieldAlert,
  Users,
  FileText,
} from "lucide-react";

const features = [
  {
    icon: Compass,
    to: "/wizard",
    linkLabel: "Starta utvärderingen",
    title: "Guidad krisanalys",
    description:
      "Svara på frågor om ekonomin och få en samlad bedömning av läget: stabilisering, rekonstruktion eller konkurs.",
  },
  {
    icon: TrendingDown,
    to: "/likviditetsplan",
    linkLabel: "Öppna likviditetsplaneringen",
    title: "Likviditetsplanering",
    description:
      "Bygg upp en plan post för post och se ungefär när kassan tar slut. Ett underlag för att planera löner, skatt och betalningar.",
  },
  {
    icon: Scale,
    to: "/kbr",
    linkLabel: "Räkna på kontrollbalansräkning",
    title: "Kontrollbalansräkning – behövs den?",
    description:
      "Räkna ut om eget kapital understiger halva aktiekapitalet, alltså om styrelsen är skyldig att upprätta en kontrollbalansräkning. Själva dokumentet upprättas av dig eller din revisor.",
  },
  {
    icon: ShieldAlert,
    to: "/wizard",
    linkLabel: "Se vad som gäller dig",
    title: "Risker som rör dig personligen",
    description:
      "Vi flaggar det som kan göra dig personligen betalningsskyldig, till exempel förfallodagen för skatter och avgifter. Varje flagga har en hänvisning till lagrummet, så att du kan kontrollera den.",
  },
  {
    icon: Users,
    to: "/marketplace",
    linkLabel: "Sök i katalogen",
    title: "Hitta rådgivare",
    description:
      "Sök bland rekonstruktörer, konkursförvaltare, jurister och ekonomiska rådgivare utifrån område och region.",
  },
  {
    icon: FileText,
    to: "/om",
    linkLabel: "Läs mer om vad som ingår",
    title: "Rapport att ta med",
    description:
      "Varje del av tjänsten kan sammanställas till ett dokument – bedömningen, kontrollbalansräkningen eller likviditetsplanen. Skriv ut, spara som PDF eller bifoga i ett mejl.",
  },
];

const Features = () => {
  return (
    <section id="features" className="scroll-mt-20 border-b border-border py-16 md:py-24">
      <div className="container px-4">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-display sm:text-4xl">
            Vad CLEARANCE hjälper dig med
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Ett samlat stöd för att få överblick över företagets ekonomiska läge.
            Varje del går att använda för sig – börja där det är mest akut.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <Link
                key={feature.title}
                to={feature.to}
                className="group flex flex-col bg-card p-6 transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:p-7"
              >
                <Icon className="h-6 w-6 text-accent" aria-hidden="true" />
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-2 flex-1 leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                  {feature.linkLabel}
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;
