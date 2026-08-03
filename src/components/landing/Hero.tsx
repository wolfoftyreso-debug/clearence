import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ClaraIntro } from "@/components/advisor/ClaraIntro";
import { Clock, FileText, UserCheck } from "lucide-react";

/**
 * Startsidan: avsändare och tagline överst - och sedan SAMTALET, som
 * startskärmens enda handling. Sökrutan, pillerknapparna,
 * "Se alla tjänster"-länken och bildblocket med kompassrosen är
 * borttagna på uttrycklig begäran, i tur och ordning: allt de gjorde
 * nås genom samtalet eller navigeringen, och dekoren stod i vägen.
 *
 * Varför: målgruppen är företagare i kris. En startsida med EN väg
 * kräver inget val alls - CLEARANCE tar emot direkt.
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

const Hero = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <section className="border-b border-border bg-secondary/30">
      <div className="container px-4 pb-12 pt-8 md:pb-20 md:pt-12">
        {/* Avsändaren och taglinen, som referensen: vem talar, till vem. */}
        <p className="max-w-2xl text-lg leading-relaxed text-accent">
          Sambandscentralen vid företagskris – ägare, VD, styrelse, revisor
          och jurist i samma ärende, vid behov även rekonstruktör,
          konkursförvaltare eller finansiär
        </p>

        {/* Bildblocket (kompassrosen med organiska former) är borttaget på
            uttrycklig begäran: samtalet ska mötas direkt, utan dekor före.
            Återinför det inte. */}

        {/* Det första mötet ÄR samtalet. CLEARANCE tar emot direkt - utan
            konto, utan meny. Inloggade med pågående ärende fortsätter
            där de slutade i stället för att presenteras igen. */}
        <h1 className="sr-only">CLEARANCE – vägledning vid företagskris</h1>
        <div className="mx-auto mt-12 max-w-2xl">
          {user ? (
            <div className="rounded-md border border-border bg-card p-5 text-center shadow-soft">
              <p className="text-base leading-relaxed text-foreground">
                Välkommen tillbaka. CLEARANCE har läget klart – fortsätt samtalet
                där ni slutade.
              </p>
              <Link
                to="/dashboard/samtal"
                className="mt-4 inline-block rounded-full bg-accent px-8 py-3 text-base font-semibold text-accent-foreground shadow-soft transition-opacity hover:opacity-90"
              >
                Fortsätt samtalet
              </Link>
            </div>
          ) : (
            <ClaraIntro onDone={() => navigate("/wizard")} />
          )}
        </div>

        {/* Pillerknapparna ("Gratis nulägesanalys", "Mina sidor") och
            "Se alla tjänster"-länken är borttagna på uttrycklig begäran,
            precis som sökrutan före dem: samtalet är startskärmens ENDA
            handling. Analysen nås genom samtalet, inloggningen via
            headerns meny, tjänsterna genom att scrolla. Återinför inget. */}

        {/* Varför tjänsten finns - flyttad under blicken men inte borttagen:
            positioneringen är en del av produkten. */}
        <p className="mx-auto mt-12 max-w-2xl text-center text-base leading-relaxed text-muted-foreground">
          När ett bolag hamnar i ekonomiska problem löper juridik, skatt, bank,
          personal och myndighetskontakter parallellt. CLEARANCE är den
          digitala krisrådgivaren och kretsens sambandscentral: den hjälper dig
          fatta rätt beslut, skapar och ordnar dokumentationen automatiskt och
          följer bolaget från första varningssignalen till återhämtning,
          rekonstruktion eller avveckling – med fristerna bevakade och besluten
          dokumenterade. Ekonomiska problem är också ett juridiskt ansvar, och
          att agera i tid är ofta avgörande.
        </p>

        <dl className="mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3">
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
