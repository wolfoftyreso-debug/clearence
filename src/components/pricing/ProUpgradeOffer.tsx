import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Clock, X, Zap } from "lucide-react";
import { DEFAULT_COMPANY_PLAN, formatMonthly } from "@/lib/pricing";
import { OFFER_SECONDS, smsTier } from "@/lib/proOffer";

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
  onAccept,
  onDismiss,
}: {
  open: boolean;
  /** Månadspris efter provveckan, ur prisparametrarna. null = "kontakta oss". */
  monthlyExVatSek?: number | null;
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

  // SMS överst - det var det klicket handlade om - sedan resten. Förut
  // visades bara tre rader, och SMS låg fjärde och föll bort helt.
  const smsRad = smsTier.includes.find((rad) => /SMS/i.test(rad));
  const punkter = smsRad
    ? [smsRad, ...smsTier.includes.filter((rad) => rad !== smsRad)]
    : smsTier.includes;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Erbjudande"
    >
      <div className="w-full max-w-md overflow-hidden rounded-md bg-card shadow-2xl">
        {/* BANDET: det som gör ögat stanna. Stark färg, stora versaler. */}
        <div className="relative bg-accent px-5 py-3 text-center">
          <p className="text-[11px] font-bold uppercase tracking-wide text-accent-foreground">
            Endast nu · en enda gång
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
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Du var på väg att slå på SMS-aviseringar. Det ingår i {smsTier.name} – och just nu
            provar du hela nivån utan att betala första veckan.
          </p>

          {/* Allt som ingår, med SMS överst - det var det klicket handlade
              om, och förut kapades just den raden bort. Varje rad sin bock. */}
          <p className="mt-4 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Allt i {smsTier.name} ingår:
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

          <p className="mt-4 text-xs text-muted-foreground">
            {monthlyExVatSek !== null
              ? `Efter provveckan ${formatMonthly(monthlyExVatSek)} exkl. moms. Ingen bindningstid – säg upp när du vill.`
              : "Efter provveckan enligt offert. Ingen bindningstid – säg upp när du vill."}
          </p>

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
                Nej tack, fortsätt utan
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
