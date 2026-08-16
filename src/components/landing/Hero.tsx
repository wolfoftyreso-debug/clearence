import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { ClaraIntro } from "@/components/advisor/ClaraIntro";
import { hasResume } from "@/lib/advisor/onboardingResume";
import { ChevronDown, Clock, FileText, UserCheck } from "lucide-react";

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
  /**
   * Ett konto skapas numera MITT I samtalet. I samma ögonblick blir
   * `user` sann - och utan den här spärren hade vyn bytts ut under
   * fötterna på användaren, med allt hen just berättat borta.
   *
   * Spärren sätts när samtalet startar och släpps aldrig under
   * besöket. Den som kommer tillbaka senare får återvändarrutan som
   * förut, eftersom sidan då laddats om.
   */
  const [conversationStarted, setConversationStarted] = useState(false);

  /**
   * Ett avbrutet introduktionssamtal ska ÅTERUPPTAS, inte ersättas.
   *
   * Rutan nedanför lovar att fortsätta "där ni slutade". Innan det här
   * var det ett löfte sidan inte kunde hålla: den som laddade om mitt i
   * intervjun fick rutan, klickade, och landade i samtalsvyn utan ett
   * spår av frågorna hen just svarat på. Ett brutet löfte lär användaren
   * att ingenting som sägs i samtalet får konsekvenser.
   *
   * Läses en gång, vid mount: posten raderas när samtalet lämnas över,
   * och vyn ska inte byta skepnad mitt under användarens fingrar.
   */
  const [resumable] = useState(() => hasResume());

  /**
   * SAMTALET TAR ÖVER SKÄRMEN när det väl börjat.
   *
   * Det låg tidigare inbäddat i marknadssidan. Konsekvensen syntes först
   * i en telefon: man kunde rulla bort från samtalet mitt i en
   * ifyllning, "Fortsätt" hamnade bakom demobannern, och under
   * formuläret fortsatte sidan att sälja in en tjänst användaren redan
   * hade börjat använda.
   *
   * Produkten säger att samtalet ÄR gränssnittet. Då kan det inte
   * samtidigt vara ett inslag på en sida som handlar om något annat.
   *
   * `laast` är skilt från `conversationStarted` med flit. Den senare
   * släpps aldrig under besöket - den finns för att inloggningen inte
   * ska byta ut vyn under fötterna på användaren. Den förra styr bara
   * hur samtalet visas, och den som fällt ihop det ska kunna fälla ut
   * det igen utan att förlora något.
   */
  const [laast, setLaast] = useState(false);

  /*
   * Bakgrunden får inte rulla bakom ett samtal som tagit över skärmen.
   * Utan det här rullar sidan under fingret när man drar i samtalet och
   * hamnar på ett helt annat ställe när man fäller ihop det igen.
   */
  useEffect(() => {
    if (!laast) return;
    const kropp = document.body.style.overflow;
    const rot = document.documentElement.style.overflow;
    // BÅDA behövs. Med bara body rullade sidan ändå: på flera webbläsare
    // är det documentElement som är rullbehållaren, och ett lås på body
    // gick rakt igenom.
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = kropp;
      document.documentElement.style.overflow = rot;
    };
  }, [laast]);

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
          {user && !conversationStarted && !resumable ? (
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
            /*
             * SAMMA KOMPONENT, TVÅ INRAMNINGAR.
             *
             * ClaraIntro monteras ALDRIG om när låset slås av och på -
             * bara omslaget byts. Att rendera den på två ställen hade
             * nollställt allt användaren skrivit i samma sekund som hen
             * fällde ihop samtalet, vilket är precis det fel resten av
             * produkten är byggd för att undvika.
             */
            <div
              className={
                laast
                  ? /* OGENOMSKINLIG bakgrund. Den var bg-secondary/40, alltså nästan
                     genomskinlig, och på en bred skärm lyste hela marknadssidan
                     igenom bakom samtalet - rubriker, faktakort och tagline om
                     vartannat. Det såg ut som en halvfärdig dialogruta i stället
                     för ett övertagande. På telefon dolde innehållet det, vilket
                     är varför det slank igenom första provet. */
                    "fixed inset-0 z-[60] flex flex-col bg-secondary"
                  : "contents"
              }
              /* Samtalet tar hela skärmen. Utan plats för den fasta
                 demobannern hamnar svarsknapparna under den. Insetet är
                 noll när ingen banner finns. */
              style={laast ? { paddingBottom: "var(--app-bottom-inset, 0px)" } : undefined}
            >
              {laast && (
                /* Avsändaren, och vägen ut. Ett samtal som tagit över
                   skärmen utan att gå att lämna är en fälla - samma regel
                   som gäller guidens genomgångar. */
                <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4 py-3">
                  <span className="flex items-center gap-2">
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-sm bg-accent text-sm font-bold text-accent-foreground"
                      aria-hidden="true"
                    >
                      C
                    </span>
                    <span className="font-display text-base text-foreground">CLEARANCE</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setLaast(false)}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    Fäll ihop
                  </button>
                </div>
              )}

              <div
                className={
                  laast
                    ? /* Egen rullning, och botten fri från demobannern och
                         telefonens eget fält. Utan utrymmet hamnar
                         "Fortsätt" bakom bannern - vilket var precis vad
                         som hände. */
                      "flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-40"
                    : "contents"
                }
              >
                <div className={laast ? "mx-auto max-w-2xl" : "contents"}>
                  <ClaraIntro
                    hasAccount={!!user}
                    onStart={() => {
                      setConversationStarted(true);
                      setLaast(true);
                    }}
                    onDone={() => navigate("/wizard")}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {conversationStarted && !laast && (
          /* Ihopfällt: samtalet finns kvar där det stod, och vägen
             tillbaka till helskärm står bredvid det. Att bara fälla ihop
             utan att erbjuda vägen tillbaka vore att göra en åtgärd
             oåterkallelig i onödan. */
          <div className="mx-auto mt-3 max-w-2xl text-center">
            <button
              type="button"
              onClick={() => setLaast(true)}
              className="text-sm font-medium text-accent underline underline-offset-2"
            >
              Öppna samtalet i helskärm
            </button>
          </div>
        )}

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
