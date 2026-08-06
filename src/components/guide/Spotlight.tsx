import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, CornerDownLeft, MousePointerClick, X } from "lucide-react";

/**
 * RINGEN OCH SYSTEMPANELEN.
 *
 * Guiden består av två delar med skilda uppgifter: en ring ute i vyn som
 * pekar, och en panel i kanten som förklarar. De byttes hit från en
 * flytande ruta, och skälet är strukturellt snarare än estetiskt.
 *
 * VARFÖR EN DOCKAD PANEL OCH INTE EN RUTA SOM FÖLJER MED
 *
 *  1. RUTAN KUNDE TÄCKA DET DEN PEKADE PÅ. Det löstes en gång med
 *     räkning - under, över, bredvid, och en ring som kapades för att ge
 *     plats. Det fungerade, men det var en beräkning som måste stämma
 *     varje gång. En panel som ligger i kanten kan inte hamna ovanpå
 *     målet, och behöver därför ingen beräkning som kan gå fel.
 *  2. RUTAN VISADE ETT STEG I TAGET. "3 av 4" tvingar användaren att
 *     hålla resten i huvudet, och den som inte vet vad som återstår vet
 *     inte om det är värt att stanna kvar. Panelen visar HELA
 *     genomgången: avklarat, pågående och kvarvarande på en gång.
 *  3. RUTAN HOPPADE. Varje nytt steg flyttade den, och blicken fick leta
 *     upp den igen. Panelen står stilla; det enda som rör sig är
 *     markeringen i listan och ringen ute i vyn.
 *
 * PANELEN ÄGER EN FIL. Den reserverar en remsa i kanten, och RINGEN kapas
 * mot filens gräns i stället för tvärtom. Två tidigare försök letade i
 * stället efter en ledig kant, och båda föll på samma sak: ett mål som
 * spänner över halva vyn lämnar ingen kant ledig. En gräns kan inte
 * misslyckas på det sättet - det finns ingen sökning som kan gå fel.
 *
 * INGEN MODAL. Overlayen har `pointer-events: none`; bara panelens egna
 * knappar tar emot klick. Användaren kan klicka på det ringen pekar på -
 * i guidat arbetsläge är det hela poängen - och kan lika gärna göra något
 * helt annat.
 *
 * DIMNINGEN gäller bara när guiden väntar på ett klick. Ska användaren
 * hitta EN sak är kontrast det tydligaste som finns. Visar guiden bara
 * var något ligger dimmas ingenting - då är sammanhanget svaret.
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

/** Panelens bredd på skärmar där den står vid sidan. */
const PANEL_W = 320;
/** Under den här bredden dockas panelen längst ned i stället. */
const SMAL_SKARM = 720;

/*
 * Marginalen upp från skärmens underkant för den nedåtdockade panelen.
 *
 * Längst ned bor annat som ligger fast: demobannern, och i en telefon
 * webbläsarens eget fält. En panel som lägger sig i botten hamnade under
 * dem - knappen "Hoppa över steget" syntes men gick inte att trycka på,
 * vilket är en återvändsgränd av det värsta slaget: den ser ut att
 * fungera.
 */
const NEDRE_SAKER = 76;

export const Spotlight = ({
  anchor,
  heading,
  text,
  awaitingClick,
  targetLabel,
  flowLabel,
  stops,
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
  stops: { step: number; label: string }[];
  receipt: boolean;
  progress: { current: number; total: number } | null;
  onClose: () => void;
  onSkip: () => void;
}) => {
  const [rect, setRect] = useState<Rect | null>(null);
  const [vw, setVw] = useState(() => (typeof window === "undefined" ? 1280 : window.innerWidth));
  /*
   * Panelens verkliga höjd, mätt efter rendering.
   *
   * Den gissades först till 340 px. Den är 430 med en stopplista, och
   * skillnaden var precis vad som lät ringen krocka med panelen på en
   * skärm där det såg ut att finnas plats. En layout som bygger på ett
   * antagande om sin egen storlek har fel så fort innehållet växer.
   */
  const [panelHojd, setPanelHojd] = useState(360);
  const panelRef = useRef<HTMLElement | null>(null);

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
   * Tangentbordet. Esc avbryter redan i GuideProvider; S hoppar över ett
   * steg man fastnat på.
   *
   * Genvägen gäller bara när guiden faktiskt väntar, och aldrig när
   * användaren skriver: ett S som hoppar över ett steg mitt i ett
   * fritextfält vore en fälla, inte en genväg.
   */
  useEffect(() => {
    if (!awaitingClick) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "s" && e.key !== "S") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
      onSkip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [awaitingClick, onSkip]);

  useLayoutEffect(() => {
    const h = panelRef.current?.getBoundingClientRect().height;
    if (h && Math.abs(h - panelHojd) > 4) setPanelHojd(h);
  });

  if (!anchor || !rect) return null;

  const vh = window.innerHeight;
  const pad = 8;
  const smal = vw < SMAL_SKARM;

  /*
   * PANELEN ÄGER EN FIL, OCH RINGEN HÅLLER SIG UR DEN.
   *
   * Två försök före det här letade efter en ledig kant. Båda föll på
   * samma sak: ett mål som spänner över halva vyn lämnar ingen kant
   * ledig, och då hamnar panelen ovanpå det den pekar på ändå.
   *
   * Modellen är därför den omvända, och den är ett operativsystems: en
   * dockad panel reserverar sin remsa, och innehållet flödar bredvid.
   * Ringen kapas mot filens kant. Det kan inte bli fel, för det finns
   * ingen sökning som kan misslyckas - bara en gräns.
   *
   * FILEN LIGGER TILL HÖGER. Vänsterkanten är appens egen navigering, och
   * en panel som lägger sig över menyn gör rundturen till en fälla:
   * användaren ser vart hen ska men kommer inte åt att klicka dit.
   * Tyngdpunktsregeln som stod här förut gjorde precis det.
   *
   * Undantaget är ett mål som SJÄLVT bor i högerfilen och inte i den
   * vänstra. Då byter panelen sida - då är det målet som skulle skymmas,
   * och menyn är åtminstone inte det som pekas ut.
   */
  const panelH = Math.min(panelHojd, vh - 32);
  const iHogerfil = rect.left + rect.width > vw - PANEL_W - 32;
  const iVansterfil = rect.left < PANEL_W + 32;
  const fil: "hoger" | "vanster" | "nere" = smal
    ? "nere"
    : iHogerfil && !iVansterfil
      ? "vanster"
      : "hoger";

  // Innehållsytan: allt utom panelens fil.
  const ytaVanster = fil === "vanster" ? PANEL_W + 32 : 4;
  const ytaHoger = fil === "hoger" ? vw - PANEL_W - 32 : vw - 4;
  const ytaNere = fil === "nere" ? vh - panelH - NEDRE_SAKER - 16 : vh - 12;

  const ringLeft = Math.max(ytaVanster, rect.left - pad);
  const ringWidth = Math.max(24, Math.min(ytaHoger - ringLeft, rect.width + pad * 2));
  const ringTop = Math.max(12, rect.top) - pad;
  const ringHeight = Math.max(
    24,
    Math.min(
      Math.min(ytaNere, rect.top + rect.height) - Math.max(12, rect.top),
      ytaNere - ringTop - pad * 2,
    ),
  );
  const ringBottom = ringTop + ringHeight + pad * 2;

  const panelPos: React.CSSProperties =
    fil === "nere"
      ? { left: 12, right: 12, bottom: NEDRE_SAKER }
      : fil === "hoger"
        ? { right: 16, top: 88, width: PANEL_W }
        : { left: 16, top: 88, width: PANEL_W };

  const nuvarande = progress?.current ?? null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[90]" aria-live="polite">
      {/* Dimningen: fyra rutor runt hålet i stället för en mask - enklare,
          och hålet blir exakt. */}
      {awaitingClick && (
        <div aria-hidden="true">
          <div className="absolute bg-foreground/50 transition-all duration-300" style={{ top: 0, left: 0, right: 0, height: Math.max(0, ringTop) }} />
          <div className="absolute bg-foreground/50 transition-all duration-300" style={{ top: ringBottom, left: 0, right: 0, bottom: 0 }} />
          <div className="absolute bg-foreground/50 transition-all duration-300" style={{ top: ringTop, left: 0, width: Math.max(0, ringLeft), height: ringHeight + pad * 2 }} />
          <div className="absolute bg-foreground/50 transition-all duration-300" style={{ top: ringTop, left: ringLeft + ringWidth, right: 0, height: ringHeight + pad * 2 }} />
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
              ? "border-[3px] border-accent shadow-[0_0_0_4px_hsl(var(--accent)/0.3)]"
              : "border-2 border-accent"
        }`}
        style={{ top: ringTop, left: ringLeft, width: ringWidth, height: ringHeight + pad * 2 }}
      >
        <span
          className={`absolute -inset-1 animate-ping rounded-md border-2 ${
            receipt ? "border-success/60" : "border-accent/60"
          }`}
          aria-hidden="true"
        />
      </div>

      {text && (
        <aside
          ref={panelRef}
          data-guide-callout={anchor}
          aria-label="Guiden"
          role="status"
          className="pointer-events-auto fixed overflow-hidden rounded-md border border-border bg-card shadow-lg"
          style={panelPos}
        >
          {/* HUVUDET: vad som pågår och hur långt det gått. Mätaren är
              inte dekoration - den är skillnaden mellan "det här tar
              visst aldrig slut" och "två kvar". */}
          <header className="border-b border-border bg-secondary/50 px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 text-[11px] font-bold uppercase leading-snug tracking-wide text-accent">
                {flowLabel ? `Genomgång: ${flowLabel}` : "Guiden"}
              </p>
              <button
                type="button"
                onClick={onClose}
                aria-label="Avsluta guiden"
                className="-mr-1 -mt-0.5 flex-shrink-0 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {progress && (
              <>
                <p className="mt-1 text-[11px] font-medium tabular-nums text-muted-foreground">
                  {/* Läsbart, inte nollutfyllt. "Steg 03 av 04" ser
                      systematiskt ut men är svårare att ta in för den
                      som läser stressat, och den här panelen finns för
                      att vara tydlig. */}
                  Steg {progress.current} av {progress.total}
                </p>
                <div
                  className="mt-1.5 h-1 overflow-hidden rounded-full bg-border"
                  role="progressbar"
                  aria-valuenow={progress.current}
                  aria-valuemin={0}
                  aria-valuemax={progress.total}
                >
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-500"
                    style={{ width: `${(progress.current / Math.max(1, progress.total)) * 100}%` }}
                  />
                </div>
              </>
            )}
          </header>

          {/* HÅLLPLATSERNA. Hela genomgången, alltid synlig. Avklarade får
              en bock, den pågående en fylld punkt, kvarvarande sitt
              nummer. Man ska kunna se på en halv sekund var man är. */}
          {stops.length > 1 && (
            <ol className="max-h-40 overflow-y-auto border-b border-border px-2 py-2">
              {stops.map((stop) => {
                const klar = nuvarande !== null && stop.step < nuvarande;
                const aktiv = stop.step === nuvarande;
                return (
                  <li
                    key={`${stop.step}-${stop.label}`}
                    aria-current={aktiv ? "step" : undefined}
                    className={`flex items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm ${
                      aktiv ? "bg-accent/10 font-semibold text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums ${
                        klar
                          ? "bg-success/15 text-success"
                          : aktiv
                            ? "bg-accent text-accent-foreground"
                            : "border border-border text-muted-foreground"
                      }`}
                    >
                      {klar ? <Check className="h-2.5 w-2.5" aria-hidden="true" /> : stop.step}
                    </span>
                    <span className="truncate">{stop.label}</span>
                  </li>
                );
              })}
            </ol>
          )}

          {/* FÖRKLARINGEN för det som pågår just nu. */}
          <div className="px-4 py-3">
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

            {awaitingClick && (
              /* Guidat arbetsläge: handen är användarens. Saken NAMNGES -
                 "klicka på det markerade" hjälper inte den som inte hittar
                 markeringen, och då finns ingen andra ledtråd. */
              <p className="mt-3 flex items-start gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground">
                <MousePointerClick className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span>
                  Klicka på {targetLabel ? `”${targetLabel}”` : "det inringade"} ute i vyn. Jag
                  väntar.
                </span>
              </p>
            )}
          </div>

          {/* FOTEN: vägarna ut, och tangenterna som gör samma sak. Att
              visa genvägarna är halva OS-känslan - och den som en gång
              sett dem slutar leta efter knappen. */}
          <footer className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t border-border bg-secondary/30 px-4 py-2.5">
            <span className="flex items-center gap-3 whitespace-nowrap">
              {awaitingClick && (
                <button
                  type="button"
                  onClick={onSkip}
                  className="text-xs font-medium text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
                >
                  Hoppa över steget
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-medium text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
              >
                {flowLabel ? "Avsluta genomgången" : "Jag hittar själv"}
              </button>
            </span>
            <span className="hidden flex-shrink-0 items-center gap-1.5 whitespace-nowrap text-[10px] text-muted-foreground sm:flex">
              {awaitingClick && (
                <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-sans font-semibold">
                  S
                </kbd>
              )}
              <kbd className="flex items-center gap-1 rounded border border-border bg-card px-1.5 py-0.5 font-sans font-semibold">
                <CornerDownLeft className="h-2.5 w-2.5" aria-hidden="true" />
                Esc
              </kbd>
            </span>
          </footer>
        </aside>
      )}
    </div>
  );
};
