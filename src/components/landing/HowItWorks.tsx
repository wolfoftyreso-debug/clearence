const steps = [
  {
    number: "01",
    title: "Beskriv situationen",
    description:
      "Du svarar på frågor om bolaget, likviditeten och vilka betalningar som ligger närmast i tiden.",
    points: [
      "Företagsuppgifter och bransch",
      "Kassa, fordringar och skulder",
      "Förfallodagar för löner, skatt och leverantörer",
    ],
  },
  {
    number: "02",
    title: "Få en bedömning",
    description:
      "Utifrån dina svar får du en sammanfattning av läget, en tidslinje och de risker som är värda att känna till.",
    points: [
      "Bedömning: stabilisering, rekonstruktion eller konkurs",
      "Tidslinje utifrån dina egna förfallodagar",
      "Riskflaggor med hänvisning till lagrum",
    ],
  },
  {
    number: "03",
    title: "Räkna på likviditeten",
    description:
      "Likviditetsplaneringen går igenom en post i taget och visar hur länge pengarna räcker.",
    points: [
      "Steg för steg, utan förkunskaper",
      "Löner med arbetsgivaravgift beräknad",
      "Datum då kassan tar slut",
    ],
  },
  {
    number: "04",
    title: "Ta kontakt med rådgivare",
    description:
      "När du vet vad situationen kräver kan du söka upp rekonstruktörer, jurister och ekonomiska rådgivare.",
    points: [
      "Sök på område och region",
      "Skicka förfrågan med ditt underlag",
      "Kostnadsfritt för dig som företagare",
    ],
  },
];

const HowItWorks = () => {
  return (
    <section className="border-b border-border py-16 md:py-24">
      <div className="container px-4">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-display sm:text-4xl">Så fungerar tjänsten</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Fyra steg för att få en tydligare bild av läget och av vilket nästa steg
            som är rimligt.
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
