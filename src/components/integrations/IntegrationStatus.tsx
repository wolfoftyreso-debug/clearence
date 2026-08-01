import { INTEGRATION_REGISTRY } from "@/lib/integrations/registry";
import { CheckCircle2, Clock } from "lucide-react";

/**
 * Vad som fungerar idag och vad som kommer inom kort.
 *
 * Läser registret, som i sin tur testas mot koden - panelen kan alltså inte
 * lova något som inte finns. Skillnaden mot de gamla "Snart"-knapparna är
 * hela poängen: det här är INFORMATION om vad som är på väg, inte döda
 * knappar som ser trasiga ut. Inget här går att klicka på, och därför kan
 * inget här kännas sönder.
 *
 * Blockerade mål (kreditförmedling, PSD2) visas inte alls: de väntar på
 * beslut, inte på utveckling, och "inom kort" vore en gissning.
 */
export const IntegrationStatus = () => {
  const ready = INTEGRATION_REGISTRY.filter((t) => t.status === "fil" && t.builtToday !== "");
  const upcoming = INTEGRATION_REGISTRY.filter((t) => t.status === "avtal");

  return (
    <section className="rounded-md border border-border bg-secondary/40 p-5">
      <h3 className="font-semibold text-foreground">Kopplingar</h3>

      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-success">
            Fungerar idag
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {ready.map((t) => (
              <li key={t.id} className="flex gap-2 text-foreground">
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 flex-shrink-0 text-success"
                  aria-hidden="true"
                />
                <span>{t.name}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Inom kort
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {upcoming.map((t) => (
              <li key={t.id} className="flex gap-2 text-muted-foreground">
                <Clock className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span>
                  {t.name}
                  <span className="ml-1.5 rounded-full border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                    Inom kort
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Direktkopplingarna väntar på partneravtal med respektive leverantör.
        Tills dess fungerar filvägarna ovan – samma data, ett exportsteg till.
      </p>
    </section>
  );
};
