import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WizardCard } from "@/components/wizard/WizardCard";
import { data } from "@/data";
import { CheckCircle2, Loader2 } from "lucide-react";

/**
 * SIDAN SOM ÅTERSTÄLLNINGSLÄNKEN LANDAR PÅ.
 *
 * Poletten står i adressfältet (`?polett=...`) och är hela beviset -
 * ingen session krävs, och sidan frågar därför aldrig efter det gamla
 * lösenordet. Det är hela poängen med en återställning: den som står här
 * kan just inte sitt lösenord.
 *
 * Poletten lever en timme och brinner vid användning. En utgången, en
 * förbrukad och en påhittad polett ger EXAKT samma besked - det finns
 * inget att lära sig av skillnaden, och den som fick länken vidarebefordrad
 * av misstag ska inte kunna läsa av om den var äkta.
 *
 * MINSTA MÖJLIGA YTA: sidan visar inte vems konto poletten hör till. En
 * länk som ligger kvar i en vidarebefordrad mejlkedja ska inte tala om
 * vilken adress som har konto hos en insolvenstjänst.
 */
const MINSTA_TECKEN = 8;

const PasswordReset = () => {
  const navigate = useNavigate();
  const [sokparametrar] = useSearchParams();
  const polett = sokparametrar.get("polett") ?? "";

  const [losenord, setLosenord] = useState("");
  const [upprepa, setUpprepa] = useState("");
  const [arbetar, setArbetar] = useState(false);
  const [fel, setFel] = useState<string | null>(null);
  const [klart, setKlart] = useState(false);

  const skicka = async (e: FormEvent) => {
    e.preventDefault();
    setFel(null);
    if (losenord.length < MINSTA_TECKEN) {
      setFel(`Lösenordet måste vara minst ${MINSTA_TECKEN} tecken.`);
      return;
    }
    if (losenord !== upprepa) {
      setFel("Lösenorden stämmer inte överens.");
      return;
    }
    setArbetar(true);
    const { error } = await data.auth.redeemPasswordReset(polett, losenord);
    setArbetar(false);
    if (error) {
      setFel(error);
      return;
    }
    setKlart(true);
  };

  if (!polett) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16">
        <WizardCard>
          <h1 className="text-xl font-semibold text-foreground">Länken saknar sin nyckel</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Adressen ser ut att ha kapats på vägen — en del mejlprogram klipper långa
            länkar. Begär en ny återställning, så skickar vi en färsk.
          </p>
          <Button className="mt-4" asChild>
            <Link to="/login">Till inloggningen</Link>
          </Button>
        </WizardCard>
      </main>
    );
  }

  if (klart) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16">
        <WizardCard>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
            Lösenordet är bytt
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Alla tidigare inloggningar är avslutade — även på andra enheter. Det är
            avsiktligt: byter du lösenord är det ofta för att någon annan kan det gamla.
          </p>
          <Button className="mt-4" onClick={() => navigate("/login")} data-prov="till-inloggning">
            Logga in
          </Button>
        </WizardCard>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-16">
      <WizardCard>
        <h1 className="text-xl font-semibold text-foreground">Välj ett nytt lösenord</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Länken gäller i en timme och kan användas en gång.
        </p>
        <form onSubmit={skicka} className="mt-5 space-y-3">
          <label className="block text-sm">
            <span className="font-medium text-foreground">Nytt lösenord</span>
            <Input
              type="password"
              autoComplete="new-password"
              value={losenord}
              onChange={(e) => setLosenord(e.target.value)}
              className="mt-1"
              data-prov="nytt-losenord"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-foreground">Upprepa lösenordet</span>
            <Input
              type="password"
              autoComplete="new-password"
              value={upprepa}
              onChange={(e) => setUpprepa(e.target.value)}
              className="mt-1"
              data-prov="upprepa-losenord"
            />
          </label>
          {fel && (
            <p className="text-sm text-destructive" role="alert">
              {fel}
            </p>
          )}
          <Button type="submit" disabled={arbetar} data-prov="satt-losenord">
            {arbetar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Spara lösenordet
          </Button>
        </form>
        <p className="mt-4 text-sm text-muted-foreground">
          <Link to="/login" className="underline underline-offset-4">
            Tillbaka till inloggningen
          </Link>
        </p>
      </WizardCard>
    </main>
  );
};

export default PasswordReset;
