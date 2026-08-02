const steps = [
  {
    number: "01",
    title: "Gratis nulägesanalys",
    description:
      "Beskriv situationen, svara på frågor och ladda upp underlag. Du får en första riskbild och ser vilka alternativ som finns – helt utan kostnad. Tröskeln att söka hjälp tidigt ska vara noll.",
    points: [
      "Bedömning: stabilisering, rekonstruktion eller konkurs",
      "Tidslinje utifrån dina egna förfallodagar",
      "Riskflaggor med hänvisning till lagrum",
    ],
  },
  {
    number: "02",
    title: "Starta ärendet",
    description:
      "När bolaget väljer Clearance som sitt operativa system startas ett ärende, och sambandscentralen aktiveras: handlingsplan, frister, dokument, deltagare och uppföljning på ett ställe.",
    points: [
      "Handlingsplan med bevakade frister",
      "Dokumentmallar och samlad akt",
      "Styrelse, revisor och rådgivare i samma ärende",
    ],
  },
  {
    number: "03",
    title: "Led processen med full kontroll",
    description:
      "Juridik, ekonomi, bank, personal och myndigheter löper parallellt. Problemet är sällan att information saknas – det är att ingen har full kontroll. Här hålls allt ihop.",
    points: [
      "Kontrolläget visar vad som saknas och vad som är nästa steg",
      "Likviditetsplanen visar hur länge pengarna räcker",
      "Händelseloggen dokumenterar varje beslut",
    ],
  },
  {
    number: "04",
    title: "Rätt kompetens vid din sida",
    description:
      "Bjud in revisorn och styrelsen till ärendet, och hitta rekonstruktörer och jurister när situationen kräver det – med underlaget redan samlat.",
    points: [
      "Sök rådgivare på område och region",
      "Skicka förfrågan med ditt underlag",
      "Kostnadsfritt för dig som företagare",
    ],
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-b border-border py-16 md:py-24">
      <div className="container px-4">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-display sm:text-4xl">Så fungerar tjänsten</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Gratis första analys. Sedan ett operativt ledningssystem som håller
            ihop processen – en sambandscentral för hela kretsen kring bolaget:
            styrelse, VD och ägare tillsammans med revisor och jurist, och vid
            behov rekonstruktör, konkursförvaltare eller finansiär. Alla i
            samma ärende.
          </p>
        </div>

        <ol className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-2">
          {steps.map((step) => (
            <li key={step.number} className="bg-card p-6 md:p-8">
              <div className="flex items-baseline gap-3">
                <span className="font-display text-sm font-semibold text-accent">
                  {step.number}
                </span>
                <h3 className="text-xl font-semibold text-foreground">{step.title}</h3>
              </div>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                {step.description}
              </p>
              <ul className="mt-5 space-y-2 border-t border-border pt-5 text-sm">
                {step.points.map((point) => (
                  <li key={point} className="flex gap-2.5 text-foreground">
                    <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-accent" aria-hidden="true" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};

export default HowItWorks;
