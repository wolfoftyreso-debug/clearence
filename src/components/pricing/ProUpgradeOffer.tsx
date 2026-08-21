import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Clock, X, Zap } from "lucide-react";
import { DEFAULT_COMPANY_PLAN, formatMonthly, nyttIniva, tierById } from "@/lib/pricing";
import { OFFER_SECONDS, smsTier } from "@/lib/proOffer";
import { AVISERINGAR_HAR_PRODUCENT, AVISERINGAR_INTE_LIVE } from "@/lib/notifications/status";

/**
 * ENGÅNGSERBJUDANDET, presenterat: högt, tydligt, Vista Print i tonen -
 * men ärligt i mekaniken (se proOffer.ts). Stor nedräkning, en stor
 * knapp, ett budskap. När klockan slår noll dras gratisveckan tillbaka på
 * riktigt; det är det som skiljer en verklig frist från en falsk.
 *
 * `open` styrs av den som visar erbjudandet, som också ser till att det
 * bara sker en gång. Komponenten äger bara nedräkningen och utseendet.
 */
export const ProUpgradeOffer = ({
  open,
  monthlyExVatSek = DEFAULT_COMPANY_PLAN.businessExVatSek ?? null,
  currentTierId = "standard",
  onAccept,
  onDismiss,
}: {
  open: boolean;
  /** Månadspris efter provveckan, ur prisparametrarna. null = "kontakta oss". */
  monthlyExVatSek?: number | null;
  /** Nivån användaren står på idag. Avgör vad som faktiskt TILLKOMMER. */
  currentTierId?: string;
  onAccept: () => void;
  onDismiss: () => void;
}) => {
  const [left, setLeft] = useState(OFFER_SECONDS);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setLeft(OFFER_SECONDS);
    timer.current = window.setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          if (timer.current) window.clearInterval(timer.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [open]);

  if (!open) return null;

  const expired = left === 0;
  const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  // Andelen kvar, för nedräkningsstapeln.
  const kvar = Math.max(0, Math.min(100, (left / OFFER_SECONDS) * 100));

  /*
   * VAD SOM FAKTISKT TILLKOMMER, inte hela innehållsförteckningen.
   *
   * Rutan listade förut allt i Business med SMS-raden fetstilt överst.
   * Den lästes som "2 780 kr för SMS" - vilket är en orimlig affär, och
   * inte vad som erbjuds. Det som ska stå är skillnaden mot nivån man står
   * på; att man behåller resten sägs i en rad.
   *
   * SMS ligger ändå först bland det nya: det var den knappen som ledde hit,
   * och att inte se den man klickade för är förvirrande.
   */
  const nuvarande = tierById(currentTierId);
  const nytt = nyttIniva(currentTierId, smsTier.id);
  const smsRad = nytt.find((rad) => /SMS/i.test(rad));
  const punkter = smsRad ? [smsRad, ...nytt.filter((rad) => rad !== smsRad)] : nytt;

  return (
    <div
      /*
       * DEMOBANNERN ÄR FAST OCH LIGGER LÄNGST NER. Utan utrymme för den
       * hamnade knappen "Ja, aktivera" UNDER bannern och gick inte att
       * klicka - erbjudandet gick alltså inte att tacka ja till.
       *
       * --app-bottom-inset publiceras av DemoBanner och är noll när ingen
       * banner finns. Centreringen sker därför i den SYNLIGA ytan, och
       * kortet rullar om det är högre än så.
       */
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-foreground/70 p-4"
      style={{ paddingBottom: "calc(1rem + var(--app-bottom-inset, 0px))" }}
      role="dialog"
      aria-modal="true"
      aria-label="Erbjudande"
    >
      <div className="my-auto max-h-full w-full max-w-md overflow-y-auto rounded-md bg-card shadow-2xl">
        {/* BANDET: det som gör ögat stanna. Stark färg, stora versaler. */}
        <div className="relative bg-accent px-5 py-3 text-center">
          <p className="text-[11px] font-bold uppercase tracking-wide text-accent-foreground">
            Provvecka · visas en gång
          </p>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Stäng erbjudandet"
            className="absolute right-2 top-2 rounded-full p-1 text-accent-foreground/80 transition-colors hover:text-accent-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="px-6 py-5 text-center">
          {/* NEDRÄKNINGEN: stor, omöjlig att missa. När den tar slut byts den
              mot ett ärligt "har gått ut" - gratisveckan är då borta. */}
          {!expired ? (
            <>
              <p className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                Erbjudandet gäller i
              </p>
              <p className="mt-1 text-6xl font-black tabular-nums leading-none text-accent">{mmss}</p>
              <div className="mx-auto mt-3 h-1.5 w-40 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear"
                  style={{ width: `${kvar}%` }}
                />
              </div>
              {/* Vad klockan betyder, sagt innan den går ut. En nedräkning
                  vars konsekvens man får veta först efteråt är en gissning. */}
              <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">
                Klockan gäller den gratis provveckan, inget annat. Går den ut kan du välja{" "}
                {smsTier.name} när du vill – då från ordinarie pris första dagen. Rutan visas bara
                den här gången.
              </p>
            </>
          ) : (
            <div className="rounded-md border border-dashed border-border bg-secondary/40 px-4 py-4">
              <p className="text-lg font-bold text-foreground">Erbjudandet har gått ut</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Gratisveckan gällde bara den här gången. Du kan fortfarande uppgradera när du vill –
                till ordinarie villkor.
              </p>
            </div>
          )}

          <h2 className="mt-5 text-2xl font-black leading-tight text-foreground">
            Första veckan gratis
            <br />
            på {smsTier.name}
          </h2>
          {/*
            VARFÖR RUTAN FINNS, sagt först. Ett erbjudande som dyker upp
            utan förklaring läses som ett säljförsök; det här ÄR ett
            säljförsök, men ett med ett rimligt skäl - och skälet tål att
            skrivas ut.
          */}
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Du klickade på SMS-aviseringar, som finns på {smsTier.name}. I stället för att bara
            säga att det kostar extra bjuder vi på en veckas prov av hela nivån – du ska få se vad
            den gör innan du bestämmer dig.
          </p>
          {/*
            DEN VIKTIGASTE MENINGEN I HELA RUTAN. SMS-kanalen är byggd men
            ingen händelse skapas än, och att be om betalt för en kanal som
            ännu inte kan skicka något vore att sälja en tystnad. Raden
            försvinner när flaggan stämmer med koden - se
            src/lib/notifications/status.ts och tests/aviseringar.ts.
          */}
          {!AVISERINGAR_HAR_PRODUCENT ? (
            <p
              data-aviseringar-inte-live
              className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed text-foreground"
            >
              Att vara ärlig om vad du får i dag: {AVISERINGAR_INTE_LIVE.charAt(0).toLowerCase()}
              {AVISERINGAR_INTE_LIVE.slice(1)} Uppgraderar du nu är det för det andra {smsTier.name}
              {" "}ger.
            </p>
          ) : null}
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Det är inte SMS du betalar för. {smsTier.name} är nivån för flera användare, flera
            bolag och kopplingen till ekonomisystemet.{" "}
            <span className="font-medium text-foreground">
              När provveckan är slut tar du ställning själv – ingenting dras och ingenting
              förlängs automatiskt.
            </span>
          </p>

          {/* Allt som ingår, med SMS överst - det var det klicket handlade
              om, och förut kapades just den raden bort. Varje rad sin bock. */}
          <p className="mt-4 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            {nuvarande ? `Det här tillkommer mot ${nuvarande.name}:` : `Det här ingår i ${smsTier.name}:`}
          </p>
          <ul className="mt-1.5 space-y-1.5 text-left">
            {punkter.map((rad) => {
              const arSms = /SMS/i.test(rad);
              return (
                <li
                  key={rad}
                  className={`flex items-start gap-2 text-sm ${arSms ? "font-semibold text-foreground" : "text-foreground"}`}
                >
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" aria-hidden="true" />
                  {rad}
                </li>
              );
            })}
          </ul>

          {nuvarande && (
            <p className="mt-2 text-left text-xs leading-relaxed text-muted-foreground">
              Allt du redan har på {nuvarande.name} följer med – ingenting tas bort.
            </p>
          )}

          {/*
            PRISET SAGT EN GÅNG, RÄTT. formatMonthly skriver redan
            "+ moms"; här stod dessutom "exkl. moms" efter, så rutan sa
            "2 780 kr/mån + moms exkl. moms".
          */}
          <div className="mt-4 rounded-md border border-border bg-secondary/40 px-3 py-2.5 text-left">
            <p className="text-sm font-semibold text-foreground">
              {monthlyExVatSek !== null
                ? `Första veckan 0 kr, därefter ${formatMonthly(monthlyExVatSek)}.`
                : "Första veckan 0 kr, därefter enligt offert."}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Provveckan övergår inte i något automatiskt: när den är slut väljer du själv om du
              vill fortsätta. Ingen bindningstid, och gör du ingenting här händer ingenting alls.
            </p>
          </div>

          <div className="mt-5 space-y-2">
            {!expired ? (
              <Button variant="accent" size="lg" onClick={onAccept} className="w-full text-base font-bold">
                <Zap className="h-5 w-5" aria-hidden="true" />
                Ja, aktivera – första veckan gratis
              </Button>
            ) : (
              <Button variant="accent" size="lg" onClick={onDismiss} className="w-full text-base font-bold">
                Fortsätt
              </Button>
            )}
            {!expired && (
              <button
                type="button"
                onClick={onDismiss}
                className="w-full py-1.5 text-sm font-medium text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
              >
                Nej tack – jag fortsätter som jag är
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
