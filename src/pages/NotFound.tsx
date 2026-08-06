import { Link, useLocation } from "react-router";

/**
 * Sidan som inte finns.
 *
 * Den här låg kvar på engelska från mallen produkten en gång startade
 * från: "Oops! Page not found" och "Return to Home", i en tjänst vars
 * användare är svenska företagare mitt i en kris. Tonen hörde inte heller
 * hemma - "Oops!" är ett skämt om att något gått fel, och den som klickat
 * på en trasig länk mitt i en rekonstruktion tycker inte att det är ett.
 *
 * Den loggade dessutom console.error vid varje besök. En driftlogg där
 * "fel" betyder "någon skrev fel i adressfältet" är en logg ingen orkar
 * läsa när det verkligen brinner.
 *
 * Regeln om återvändsgränder gäller även här, och särskilt här: den som
 * hamnar fel ska mötas av vägar vidare, inte av en punkt.
 */

const vagarVidare = [
  { to: "/", label: "Till samtalet", why: "Beskriv läget så tar vi det därifrån." },
  { to: "/wizard", label: "Nulägesanalysen", why: "En bedömning av läget ur bolagets siffror." },
  { to: "/kunskap", label: "Kunskapsbanken", why: "Artiklar med källa för varje påstående." },
];

const NotFound = () => {
  const location = useLocation();

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary/30 px-4 py-12">
      <div className="w-full max-w-md">
        <h1 className="text-xl font-semibold text-foreground">Sidan finns inte</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Adressen <span className="font-medium text-foreground">{location.pathname}</span> leder
          ingenstans. Den kan ha ändrats, eller så blev det fel i länken.
        </p>

        <ul className="mt-5 space-y-2">
          {vagarVidare.map((v) => (
            <li key={v.to}>
              <Link
                to={v.to}
                className="block rounded-md border border-border bg-card p-3.5 transition-colors hover:border-accent"
              >
                <span className="text-sm font-medium text-foreground">{v.label}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{v.why}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
};

export default NotFound;
