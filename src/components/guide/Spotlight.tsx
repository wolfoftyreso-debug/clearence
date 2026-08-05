import { useEffect, useLayoutEffect, useState } from "react";
import { Check, MousePointerClick, X } from "lucide-react";

/**
 * RINGEN OCH FÖRKLARINGSRUTAN.
 *
 * Det synliga av guiden: en pulserande ring kring elementet och en ruta
 * intill som säger vad det är.
 *
 * TVÅ REGLER SOM ALLT ANNAT HÄR FÖLJER AV:
 *
 *  1. RUTAN FÅR ALDRIG TÄCKA DET DEN PEKAR PÅ. Det gjorde den, och det
 *     var förvirrande på det värsta sättet: rutan sa "klicka på det
 *     markerade" samtidigt som den låg ovanpå markeringen. Positionen
 *     räknas nu så att rutan hamnar utanför ringen - under, över eller
 *     bredvid, i den ordningen - och ringen kapas så att det finns plats.
 *  2. INGEN MODAL. Overlayen har `pointer-events: none`; bara rutans
 *     egna knappar tar emot klick. Användaren kan klicka på det ringen
 *     pekar på - i guidat arbetsläge är det ju hela poängen - och kan
 *     lika gärna göra något helt annat.
 *
 * När guiden VÄNTAR PÅ ETT KLICK dimmas resten av skärmen. Det är ett
 * avsteg från principen att sammanhanget ska synas, och det är avsiktligt:
 * ska användaren hitta EN sak att klicka på är kontrast det tydligaste
 * som finns. När guiden bara visar var något ligger dimmas ingenting -
 * då är det just sammanhanget som är svaret.
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

const BOX_W = 360;
const BOX_H = 210;
const GAP = 14;

export const Spotlight = ({
  anchor,
  heading,
  text,
  awaitingClick,
  targetLabel,
  flowLabel,
  receipt,
  progress,
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
  onClose: () => void;
  onSkip: () => void;
}) => {
  const [rect, setRect] = useState<Rect | null>(null);

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
      frame = window.requestAnimationFrame(() => setRect(rectOf(anchor)));
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

  if (!anchor || !rect) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = 8;

  /**
   * Ringen kapas så att RUTAN GARANTERAT FÅR PLATS UTANFÖR den.
   *
   * Det räckte inte att bara kapa ringen till skärmen. En stor panel som
   * börjar en bit ner lämnade varken plats under, över eller bredvid -
   * och rutan hamnade ovanpå ringens kant ändå, alltså exakt det fel
   * regeln finns för att förhindra. Ringen är en markering och får
   * krympa; rutan är instruktionen och får inte skymma.
   *
   * Bottenmarginalen tar höjd för det som ligger fast längst ned
   * (demobannern, mobilens webbläsarfält).
   */
  const BOTTOM_SAFE = 76;
  const visibleTop = Math.max(12, rect.top);
  const visibleBottom = Math.min(vh - 12, rect.top + rect.height);
  const roomForRing = vh - visibleTop - (BOX_H + GAP + BOTTOM_SAFE) - pad * 2;
  const ringHeight = Math.min(
    Math.max(90, roomForRing),
    Math.max(32, visibleBottom - visibleTop),
  );
  const ringTop = visibleTop - pad;
  const ringLeft = Math.max(4, rect.left - pad);
  const ringWidth = Math.min(vw - ringLeft - 4, rect.width + pad * 2);
  const ringBottom = ringTop + ringHeight + pad * 2;

  /**
   * Rutans plats: under ringen om det får plats, annars över, annars
   * bredvid. Aldrig ovanpå.
   */
  const roomBelow = vh - ringBottom;
  const roomAbove = ringTop;
  const roomRight = vw - (ringLeft + ringWidth);
  let boxTop: number;
  let boxLeft: number;
  if (roomBelow >= BOX_H + GAP) {
    boxTop = ringBottom + GAP;
    boxLeft = Math.min(Math.max(12, ringLeft), Math.max(12, vw - BOX_W - 12));
  } else if (roomAbove >= BOX_H + GAP) {
    boxTop = ringTop - BOX_H - GAP;
    boxLeft = Math.min(Math.max(12, ringLeft), Math.max(12, vw - BOX_W - 12));
  } else if (roomRight >= BOX_W + GAP) {
    boxTop = Math.min(Math.max(12, ringTop), Math.max(12, vh - BOX_H - 12));
    boxLeft = ringLeft + ringWidth + GAP;
  } else {
    // Sista utvägen: till vänster om ringen. Skulle inte heller det få
    // plats står rutan nere i hörnet - fortfarande utanför ringen.
    boxTop = Math.min(Math.max(12, ringTop), Math.max(12, vh - BOX_H - 12));
    boxLeft = Math.max(12, ringLeft - BOX_W - GAP);
  }

  const ring: React.CSSProperties = {
    top: ringTop,
    left: ringLeft,
    width: ringWidth,
    height: ringHeight + pad * 2,
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[90]" aria-live="polite">
      {/* Dimningen: bara när användaren ska hitta EN sak att klicka på.
          Fyra rutor runt hålet i stället för en mask - enklare, och
          hålet blir exakt. */}
      {awaitingClick && (
        <div aria-hidden="true">
          <div className="absolute bg-foreground/45 transition-all duration-300" style={{ top: 0, left: 0, right: 0, height: Math.max(0, ringTop) }} />
          <div className="absolute bg-foreground/45 transition-all duration-300" style={{ top: ringBottom, left: 0, right: 0, bottom: 0 }} />
          <div className="absolute bg-foreground/45 transition-all duration-300" style={{ top: ringTop, left: 0, width: Math.max(0, ringLeft), height: ringHeight + pad * 2 }} />
          <div className="absolute bg-foreground/45 transition-all duration-300" style={{ top: ringTop, left: ringLeft + ringWidth, right: 0, height: ringHeight + pad * 2 }} />
        </div>
      )}

      {/* Ringen. Tjockare när ett klick väntas: då är den en instruktion,
          inte en markering. */}
      <div
        data-guide-ring={anchor}
        className={`absolute rounded-md transition-all duration-500 ${
          receipt
            ? "border-2 border-success"
            : awaitingClick
              ? "border-[3px] border-accent shadow-[0_0_0_4px_hsl(var(--accent)/0.25)]"
              : "border-2 border-accent"
        }`}
        style={ring}
      >
        <span
          className={`absolute -inset-1 animate-ping rounded-md border-2 ${
            receipt ? "border-success/60" : "border-accent/60"
          }`}
          aria-hidden="true"
        />
      </div>

      {text && (
        <div
          data-guide-callout={anchor}
          role="status"
          className="pointer-events-auto absolute w-[360px] max-w-[calc(100vw-24px)] rounded-md border border-border bg-card p-4 shadow-lg"
          style={{ top: boxTop, left: boxLeft }}
        >
          {/* Vad som pågår, överst. Den som inte vet varför skärmen
              plötsligt uppför sig annorlunda hinner bli irriterad innan
              hen hunnit läsa resten. */}
          {flowLabel && (
            <p className="mb-2 flex items-center justify-between gap-2 border-b border-border pb-2 text-[11px] font-bold uppercase tracking-wide text-accent">
              <span className="truncate">Genomgång: {flowLabel}</span>
              {progress && (
                <span className="flex-shrink-0 tabular-nums text-muted-foreground">
                  {progress.current}/{progress.total}
                </span>
              )}
            </p>
          )}

          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {receipt ? (
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-success">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Sparat
                </p>
              ) : (
                heading && (
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    {heading}
                  </p>
                )
              )}
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{text}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Stäng guiden"
              className="-mr-1 -mt-1 flex-shrink-0 rounded-sm p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {awaitingClick && (
            /* Guidat arbetsläge: handen är användarens. Saken NAMNGES -
               "klicka på det markerade" hjälper inte den som inte hittar
               markeringen, och då finns ingen andra ledtråd. */
            <p className="mt-2.5 flex items-start gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground">
              <MousePointerClick className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>
                Klicka på {targetLabel ? `”${targetLabel}”` : "det inringade"} – det inringade på
                skärmen. Jag väntar.
              </span>
            </p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            {progress && !flowLabel ? (
              <span className="text-[11px] tabular-nums text-muted-foreground">
                Steg {progress.current} av {progress.total}
              </span>
            ) : (
              <span />
            )}
            <span className="flex items-center gap-3">
              {awaitingClick && (
                /* Fastnar man ska man kunna gå vidare utan att avbryta
                   hela genomgången. */
                <button
                  type="button"
                  onClick={onSkip}
                  className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Hoppa över steget
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                {flowLabel ? "Avsluta genomgången" : "Jag hittar själv"}
              </button>
            </span>
          </div>
        </div>
      )}

    </div>
  );
};
