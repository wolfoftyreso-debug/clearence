import { useEffect, useLayoutEffect, useState } from "react";
import { Check, MousePointerClick, X } from "lucide-react";

/**
 * GUIDEPANELEN OCH RINGEN.
 *
 * Guiden var en ruta som svävade intill det den pekade på. Den flyttade
 * sig vid varje steg, den räknade ut sin plats ur fyra fall, och den
 * hamnade ändå ibland ovanpå markeringen. Två gånger blev beskedet att
 * den förvirrade mer än den hjälpte.
 *
 * Nu är den en DOCKAD PANEL. Skillnaden är inte kosmetisk:
 *
 *  1. DEN STÅR STILLA. Panelen bor i skärmens kant hela genomgången.
 *     Ögat lär sig var instruktionen finns en gång, i stället för att
 *     leta om den vid varje steg.
 *  2. DEN KAN INTE SKYMMA RINGEN. Innehållet får en marginal lika bred
 *     som panelen, så målet aldrig hamnar under den. Regeln behöver
 *     inte längre räknas fram - den följer av geometrin.
 *  3. HELA GENOMGÅNGEN SYNS. Alla steg står i listan, avklarade
 *     avbockade, det pågående markerat. Man ser var man är och hur
 *     mycket som är kvar utan att gissa.
 *
 * Tangentbordet styr panelen, som i vilket systemverktyg som helst:
 * `S` hoppar över steget, `Esc` avslutar. Det står i panelens fot, för
 * en genväg ingen känner till är ingen genväg.
 *
 * INGEN MODAL, fortfarande. Overlayen har `pointer-events: none`; bara
 * panelens egna kontroller tar emot klick. Användaren kan klicka på det
 * ringen pekar på - i guidat arbetsläge är det hela poängen - och kan
 * lika gärna göra något helt annat.
 *
 * Skärmen dimmas bara när guiden VÄNTAR PÅ ETT KLICK. Ska användaren
 * hitta EN sak är kontrast det tydligaste som finns; visar guiden bara
 * var något ligger är det just sammanhanget som är svaret.
 */

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const rectOf = (anchor: string): Rect | null => {
  const el = document.querySelector<HTMLElement>(`[data-guide="${CSS.escape(anchor)}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
};

/** Panelens bredd på skärmar som har plats för en sidokolumn. */
const PANEL_W = 340;
/** Under den här bredden dockar panelen längst ned i stället för till höger. */
const SIDE_MIN_W = 900;
/**
 * Fritt utrymme under den nedåtdockade panelen.
 *
 * Längst ned ligger saker som är fästa vid skärmen - demobannern, och i
 * en telefon webbläsarens eget fält. Utan marginalen hamnade panelens
 * knappar UNDER bannern: de syntes, men gick inte att trycka på. En
 * kontroll man ser men inte når är sämre än ingen kontroll, för
 * användaren tror att hen gör fel.
 */
const BOTTOM_SAFE = 76;

export const Spotlight = ({
  anchor,
  heading,
  text,
  awaitingClick,
  targetLabel,
  flowLabel,
  receipt,
  progress,
  steps,
  onClose,
  onSkip,
}: {
  anchor: string | null;
  heading: string | null;
  text: string | null;
  awaitingClick: boolean;
  targetLabel: string | null;
  flowLabel: string | null;
  receipt: boolean;
  progress: { current: number; total: number } | null;
  /** Hela genomgången. Tom lista för en enstaka visning. */
  steps: { label: string }[];
  onClose: () => void;
  onSkip: () => void;
}) => {
  const [rect, setRect] = useState<Rect | null>(null);
  const [vw, setVw] = useState(() => (typeof window === "undefined" ? 1280 : window.innerWidth));

  useLayoutEffect(() => {
    if (!anchor) {
      setRect(null);
      return;
    }
    setRect(rectOf(anchor));
  }, [anchor]);

  useEffect(() => {
    if (!anchor) return;
    let frame = 0;
    const update = () => {
      frame = window.requestAnimationFrame(() => {
        setRect(rectOf(anchor));
        setVw(window.innerWidth);
      });
    };
    // Under rullningen mot målet flyttar sig elementet hela tiden. Ringen
    // följer med i stället för att hoppa på plats när allt stannat.
    const interval = window.setInterval(update, 120);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.clearInterval(interval);
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [anchor]);

  /*
   * Tangentbordet. Esc hanteras redan av guiden centralt; här ligger S,
   * som hör till steget och inte till hela genomgången.
   *
   * Skriver användaren i ett fält ska ett S bli ett S. Att en genväg
   * kapar en bokstav mitt i en ifyllning är hur genvägar blir farliga.
   */
  useEffect(() => {
    if (!anchor) return;
    const onKey = (e: KeyboardEvent) => {
      const mål = e.target as HTMLElement | null;
      if (mål && /^(INPUT|TEXTAREA|SELECT)$/.test(mål.tagName)) return;
      if (mål?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        onSkip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anchor, onSkip]);

  if (!anchor || !rect) return null;

  const vh = window.innerHeight;
  const pad = 8;
  const sida = vw >= SIDE_MIN_W;

  /*
   * Ringen kapas till skärmen - inget mer. Att den skulle behöva krympa
   * för att lämna plats åt rutan var en följd av att rutan svävade;
   * panelen har sin egen kolumn och konkurrerar inte längre om ytan.
   */
  const ringTop = Math.max(12, rect.top) - pad;
  const ringLeft = Math.max(4, rect.left - pad);
  const gräns = sida ? vw - PANEL_W - 16 : vw - 4;
  const ringWidth = Math.max(24, Math.min(gräns - ringLeft, rect.width + pad * 2));
  const ringHeight =
    Math.min(vh - 12, rect.top + rect.height) - Math.max(12, rect.top) + pad * 2;
  const ringBottom = ringTop + ringHeight;

  const ring: React.CSSProperties = {
    top: ringTop,
    left: ringLeft,
    width: ringWidth,
    height: ringHeight,
  };

  const panel: React.CSSProperties = sida
    ? { top: 16, right: 16, width: PANEL_W, maxHeight: vh - 32 }
    : { left: 12, right: 12, bottom: BOTTOM_SAFE, maxHeight: Math.min(340, vh * 0.5) };

  const klara = progress ? progress.current - 1 : 0;

  return (
    <div className="pointer-events-none fixed inset-0 z-[90]" aria-live="polite">
      {/* Dimningen: bara när användaren ska hitta EN sak att klicka på.
          Fyra rutor runt hålet i stället för en mask - enklare, och
          hålet blir exakt.

          Rutorna och ringen har SAMMA övergångstid. Med olika tider
          släpade hålet efter ringen i varje rullning, och det syntes som
          en andra kantlinje bredvid den riktiga - en markering som pekar
          på två ställen samtidigt är sämre än ingen markering alls.

          Höjden är ringHeight rakt av. Den innehåller redan sin
          marginal; att lägga på pad*2 en gång till gjorde sidorutorna
          sexton pixlar för höga, vilket syntes som en skarv under
          ringen - en kant som såg ut att markera något den inte
          markerade. */}
      {awaitingClick && (
        <div aria-hidden="true">
          <div className="absolute bg-foreground/45 transition-all duration-200" style={{ top: 0, left: 0, right: 0, height: Math.max(0, ringTop) }} />
          <div className="absolute bg-foreground/45 transition-all duration-200" style={{ top: ringBottom, left: 0, right: 0, bottom: 0 }} />
          <div className="absolute bg-foreground/45 transition-all duration-200" style={{ top: ringTop, left: 0, width: Math.max(0, ringLeft), height: ringHeight }} />
          <div className="absolute bg-foreground/45 transition-all duration-200" style={{ top: ringTop, left: ringLeft + ringWidth, right: 0, height: ringHeight }} />
        </div>
      )}

      {/* RINGEN. Den markerar, panelen förklarar - och de två delar
          aldrig yta längre. */}
      <div
        aria-hidden="true"
        /* Samma kontrakt som panelens: ringen går att hitta på ankaret
           den markerar. Testerna mäter överlappet mellan de två. */
        data-guide-ring={anchor}
        style={ring}
        className={`absolute rounded-md transition-all duration-200 ${
          awaitingClick
            ? "ring-4 ring-accent shadow-[0_0_0_9999px_rgba(0,0,0,0)]"
            : "ring-2 ring-accent/70"
        }`}
      >
        {awaitingClick && (
          <span
            className="absolute -inset-1 animate-ping rounded-md border-2 border-accent"
            aria-hidden="true"
          />
        )}
      </div>

      {/* PANELEN. Dockad, står stilla, och har egen kolumn. */}
      <aside
        style={panel}
        aria-label="Guiden"
        /* Kontraktet mot testerna och mot resten av produkten: panelen
           går att hitta på vilket ankare den för tillfället förklarar.
           Attributet följde med den gamla rutan och ska inte försvinna
           bara för att rutan blev en panel. */
        data-guide-callout={anchor}
        className={`pointer-events-auto absolute flex flex-col overflow-hidden rounded-md border border-border bg-card shadow-lg ${
          sida ? "" : "w-auto"
        }`}
      >
        {/* HUVUDET: vad det här är, och hur långt det har gått. Mätaren
            är stapeln - en siffra ensam säger inte hur mycket som är
            kvar förrän man räknat efter. */}
        <div className="border-b border-border px-4 pb-3 pt-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-[11px] font-bold uppercase tracking-wider text-accent">
              {flowLabel ? `Genomgång · ${flowLabel}` : "Guiden visar"}
            </p>
            {progress && (
              <span className="flex-shrink-0 text-[11px] font-bold tabular-nums text-muted-foreground">
                {String(progress.current).padStart(2, "0")} / {String(progress.total).padStart(2, "0")}
              </span>
            )}
          </div>
          {progress && (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${Math.round((klara / Math.max(1, progress.total)) * 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* STEGLISTAN. Hela genomgången, inte bara var man står. Det är
            skillnaden mellan att veta och att gissa. */}
        {steps.length > 0 && (
          <ol className="max-h-40 overflow-y-auto border-b border-border px-2 py-2">
            {steps.map((s, i) => {
              const nu = progress ? i === progress.current - 1 : false;
              const klar = i < klara;
              return (
                <li
                  key={`${s.label}-${i}`}
                  aria-current={nu ? "step" : undefined}
                  className={`flex items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm ${
                    nu ? "bg-accent/10 font-semibold text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums ${
                      klar
                        ? "bg-success text-success-foreground"
                        : nu
                          ? "bg-accent text-accent-foreground"
                          : "border border-border text-muted-foreground"
                    }`}
                  >
                    {klar ? <Check className="h-2.5 w-2.5" aria-hidden="true" /> : i + 1}
                  </span>
                  <span className="min-w-0 truncate">{s.label}</span>
                </li>
              );
            })}
          </ol>
        )}

        {/* INSTRUKTIONEN för det pågående steget.
            Eget attribut: det här är den enda delen av panelen som
            ändras mellan stegen. Huvudet och steglistan står still med
            flit, och ett test som jämför hela panelen kan därför inte
            se att guiden gått vidare. */}
        <div data-guide-instruktion className="flex-1 overflow-y-auto px-4 py-3">
          {receipt ? (
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-success">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              {heading}
            </p>
          ) : (
            heading && (
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {heading}
              </p>
            )
          )}
          {text && (
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {text}
            </p>
          )}

          {/* Väntar guiden på ett klick ska det stå som en uppmaning, med
              målets namn utskrivet. "Klicka på det markerade" hjälper inte
              den som inte hittar markeringen. */}
          {awaitingClick && (
            <p className="mt-3 flex items-start gap-2 rounded-md bg-accent px-3 py-2.5 text-sm font-semibold text-accent-foreground">
              <MousePointerClick className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>
                Klicka på <span className="underline underline-offset-2">{targetLabel ?? "det markerade"}</span> för att gå vidare.
              </span>
            </p>
          )}
        </div>

        {/* FOTEN: kontrollerna och deras tangenter. En genväg ingen känner
            till är ingen genväg. */}
        {/* En rad per kontroll. Sida vid sida trängdes etiketterna och
            radbröts mitt i - "Hoppa över / steget" läser man två gånger
            innan man förstår att det är en sak. */}
        <div className="flex flex-col border-t border-border bg-secondary/40 px-4 py-1.5">
          <button
            type="button"
            onClick={onSkip}
            className="flex w-full items-center justify-between gap-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <span className="whitespace-nowrap">Hoppa över steget</span>
            <kbd className="flex-shrink-0 rounded-sm border border-border bg-card px-1.5 text-[10px] font-bold">S</kbd>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex w-full items-center justify-between gap-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <X className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            {/* "Avsluta" ensamt är tvetydigt - avsluta vad? Under en
                genomgång sägs det rakt ut. */}
              {flowLabel ? "Avsluta genomgången" : "Avsluta"}
            </span>
            <kbd className="flex-shrink-0 rounded-sm border border-border bg-card px-1.5 text-[10px] font-bold">Esc</kbd>
          </button>
        </div>
      </aside>
    </div>
  );
};
