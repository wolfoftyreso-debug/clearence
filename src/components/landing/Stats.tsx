import { BANKRUPTCY_STATS } from "@/lib/officialFigures";

const Stats = () => {
  const { year, companies, employeesAffected, previousYear, previousYearCompanies } =
    BANKRUPTCY_STATS;

  return (
    <section className="surface-brand py-16 md:py-20">
      <div className="container px-4">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:items-center md:gap-12">
          <div className="md:col-span-5">
            <p className="font-display text-5xl text-accent md:text-6xl">
              {companies.toLocaleString("sv-SE")}
            </p>
            <p className="mt-2 text-base font-medium text-primary-foreground">
              företag försattes i konkurs i Sverige under {year}
            </p>
            <p className="mt-1 text-sm text-primary-foreground/60">
              {employeesAffected.toLocaleString("sv-SE")} anställda berördes.
              Källa: {BANKRUPTCY_STATS.source}, officiell konkursstatistik.
            </p>
          </div>

          <div className="md:col-span-7 md:border-l md:border-primary-foreground/15 md:pl-12">
            <h2 className="font-display text-2xl text-primary-foreground sm:text-3xl">
              Nivån ligger kvar där den var
            </h2>
            <p className="mt-4 leading-relaxed text-primary-foreground/80">
              Efter flera år av ökande konkurser planade utvecklingen ut {year}, på
              ungefär samma nivå som {previousYear} ({previousYearCompanies.toLocaleString("sv-SE")}{" "}
              företag). Det är fortsatt höga tal, och de flesta som drabbas är små och
              medelstora bolag.
            </p>
            <p className="mt-4 leading-relaxed text-primary-foreground/80">
              Många hinner aldrig gå igenom sina alternativ innan besluten fattas åt
              dem. Företagsrekonstruktion, ackord och egen konkursansökan har olika
              förutsättningar – och framför allt olika tidsfönster. CLEARANCE finns för
              att du ska hinna se dem medan de fortfarande är öppna.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Stats;
