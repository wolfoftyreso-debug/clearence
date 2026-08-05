import { useEffect, useLayoutEffect, useState } from "react";
import { Check, Hand, X } from "lucide-react";

/**
 * RINGEN OCH FÖRKLARINGSRUTAN.
 *
 * Det synliga av guiden: en pulserande ring kring elementet och en ruta
 * intill som säger vad det är. Inget mer - guiden ska peka på
 * gränssnittet, inte ersätta det.
 *
 * TVÅ SAKER SOM STYR ALLT ANNAT HÄR:
 *
 *  1. INGEN MODAL. Overlayen har `pointer-events: none`; bara rutans
 *     egna knappar tar emot klick. Användaren kan klicka på det ringen
 *     pekar på - i guidat arbetsläge är det ju hela poängen - och kan
 *     lika gärna göra något helt annat. En guide som låser skärmen är en
 *     dialogruta med extra steg.
 *  2. INGEN MÖRKLÄGGNING. Vanliga rundturer dimmar allt utom målet. Här
 *     är sammanhanget poängen: användaren ska se VAR i gränssnittet
 *     saken ligger, och det går inte om resten är svart.
 *
 * Positionen räknas om vid rullning och storleksändring. Ett element
 * flyttar sig när sidan laddar färdigt, och en ring som pekar bredvid
 * lär ut fel plats.
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

export const Spotlight = ({
  anchor,
  heading,
  text,
  awaitingClick,
  receipt,
  progress,
  onClose,
}: {
  anchor: string | null;
  heading: string | null;
  text: string | null;
  awaitingClick: boolean;
  receipt: boolean;
  progress: { current: number; total: number } | null;
  onClose: () => void;
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

  const pad = 8;

  /**
   * Ringen kapas till det som får plats på skärmen.
   *
   * En del ankare är hela vyer, och en ring kring en sju skärmar hög vy
   * är ingen utpekning alls - bara två streck vid horisonten som
   * användaren aldrig ser mötas. Ringen ritas därför runt den DEL av
   * elementet som syns, uppifrån och ned: det är den delen ögat landar
   * på när guiden rullat fram, och den läses som "det här området".
   */
  const visibleTop = Math.max(12, rect.top);
  const visibleBottom = Math.min(window.innerHeight - 12, rect.top + rect.height);
  const ringHeight = Math.max(32, visibleBottom - visibleTop);
  const ring: React.CSSProperties = {
    top: visibleTop - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: ringHeight + pad * 2,
  };

  // Rutan under elementet när det får plats, annars ovanför. Den ska
  // aldrig hamna utanför fönstret - en förklaring man måste rulla för
  // att läsa är ingen förklaring.
  const below = visibleTop + ringHeight + 16;
  const roomBelow = window.innerHeight - below > 200;
  const boxTop = roomBelow ? below : Math.max(12, Math.min(visibleTop + 24, window.innerHeight - 260));
  const boxLeft = Math.min(Math.max(12, rect.left - pad), Math.max(12, window.innerWidth - 372));

  return (
    <div className="pointer-events-none fixed inset-0 z-[90]" aria-live="polite">
      {/* Ringen. Två lager: en fast kant och en som pulserar utåt, så att
          den syns även mot en lugn bakgrund. */}
      <div
        data-guide-ring={anchor}
        className={`absolute rounded-md border-2 ${
          receipt ? "border-success" : "border-accent"
        } transition-all duration-500`}
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
            /* Guidat arbetsläge: handen är användarens. Guiden klickar
               inte åt någon - den som utför momentet själv minns det. */
            <p className="mt-2.5 flex items-center gap-1.5 rounded-md bg-accent/10 px-2.5 py-1.5 text-xs font-medium text-foreground">
              <Hand className="h-3.5 w-3.5 flex-shrink-0 text-accent" aria-hidden="true" />
              Klicka på det markerade när du är redo – jag väntar.
            </p>
          )}

          <div className="mt-2.5 flex items-center justify-between gap-3">
            {progress ? (
              <span className="text-[11px] tabular-nums text-muted-foreground">
                Steg {progress.current} av {progress.total}
              </span>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Jag hittar själv
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
