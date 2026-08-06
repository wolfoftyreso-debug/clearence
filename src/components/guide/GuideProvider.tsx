import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  flowSteps,
  guidedFlow,
  savedSteps,
  showMeSteps,
  STEP_MS,
  type GuideAction,
} from "@/lib/guide/actions";
import { guideEntry, type GuideAudience } from "@/lib/guide/catalogue";
import { Spotlight } from "@/components/guide/Spotlight";

/**
 * GUIDENS MOTOR.
 *
 * Kör en sekvens av åtgärder mot det verkliga gränssnittet: rullar,
 * ringar in, byter vy, väntar på ett klick. Sekvensen kommer från
 * lib/guide/actions.ts och är ren data - motorn vet ingenting om vad den
 * visar, bara hur den visar något.
 *
 * TRE SAKER SOM MÅSTE HÅLLA:
 *
 *  1. Guiden får ALDRIG låsa gränssnittet. Overlayen släpper igenom
 *     klick överallt utom där den själv ritar, och Esc avbryter. Den som
 *     har bråttom ska kunna gå ifrån en rundtur mitt i.
 *  2. Ett ankare som inte finns stoppar inte sekvensen. Vyer skiljer sig
 *     åt mellan roller och lägen; guiden hoppar över det den inte hittar
 *     i stället för att stå och vänta på ett element som aldrig kommer.
 *  3. Byter användaren vy själv mitt i en sekvens avbryts den. Att
 *     fortsätta peka på en sida hen lämnat är att peka på ingenting.
 */

interface GuideState {
  /** Elementet som ringas in just nu. */
  anchor: string | null;
  heading: string | null;
  text: string | null;
  /** Sant när guiden väntar på att användaren själv klickar. */
  awaitingClick: boolean;
  /** Vad saken HETER på skärmen, när guiden väntar på ett klick. */
  targetLabel: string | null;
  /** Vilken genomgång som pågår, så att användaren vet vad hen är mitt i. */
  flowLabel: string | null;
  /**
   * Var i sekvensen vi är.
   *
   * I ett guidat flöde räknas KLICKEN, inte guidens interna moment: den
   * som ser "steg 3 av 12" i en rundtur med fyra stopp har fått en
   * felaktig uppgift om hur lång tid det tar.
   */
  progress: { current: number; total: number } | null;
  /** Sant för kvitteringar - de ritas som ett kvitto, inte som en lektion. */
  receipt: boolean;
}

interface GuideApi {
  /**
   * Led användaren till en funktion i katalogen.
   *
   * Rollen behövs för menysteget: menyerna skiljer sig åt, och ett
   * menyval som ringas in för någon som inte har det pekar på ingenting.
   */
  showMe: (entryId: string, role?: GuideAudience) => void;
  /** Kvittera var något sparades. */
  savedTo: (entryId: string, what: string) => void;
  /** Kör ett guidat arbetsflöde. */
  runFlow: (flowId: string) => void;
  /** Visa en enstaka förklaring vid en yta - mikrolektionerna. */
  teach: (anchor: string, text: string, heading?: string) => void;
  /** Avbryt allt. */
  stop: () => void;
  /**
   * Skalet registrerar sin menyöppnare här, så att guiden kan öppna
   * sidomenyn på små skärmar. Utan den hoppas menysteget bara över -
   * på stora skärmar står menyn ändå redan framme.
   */
  registerMenu: (open: (open: boolean) => void) => void;
  /** Sant när något pågår, så att andra ytor kan hålla tyst. */
  active: boolean;
  state: GuideState;
}

const idle: GuideState = {
  anchor: null,
  heading: null,
  text: null,
  awaitingClick: false,
  targetLabel: null,
  flowLabel: null,
  progress: null,
  receipt: false,
};

const GuideContext = createContext<GuideApi | null>(null);

/** Elementet bakom ett ankarnamn, eller null. */
export const findAnchor = (anchor: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-guide="${CSS.escape(anchor)}"]`);

export const GuideProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [state, setState] = useState<GuideState>(idle);

  const queue = useRef<GuideAction[]>([]);
  const timer = useRef<number | null>(null);
  const running = useRef(false);
  /** Vyn sekvensen startade i. Byter användaren själv avbryts den. */
  const ownRoute = useRef<string | null>(null);
  /** Städfunktionen för klicklyssnaren i guidat läge. */
  const clickCleanup = useRef<(() => void) | null>(null);
  /** Sidomenyns öppnare, registrerad av skalet. */
  const menu = useRef<((open: boolean) => void) | null>(null);

  const clearTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  const stop = useCallback(() => {
    clearTimer();
    clickCleanup.current?.();
    clickCleanup.current = null;
    queue.current = [];
    running.current = false;
    ownRoute.current = null;
    flowRef.current = null;
    setState(idle);
  }, []);

  /** Kör nästa åtgärd. Deklareras som ref för att kunna anropa sig själv. */
  const advance = useRef<() => void>(() => {});

  advance.current = () => {
    const total = totalRef.current;
    const action = queue.current.shift();
    if (!action) {
      running.current = false;
      // Sista förklaringen står kvar. Att sudda den i samma ögonblick
      // sekvensen tar slut vore att avsluta med att dölja poängen.
      setState((s) => ({ ...s, awaitingClick: false, progress: null }));
      return;
    }
    const done = total - queue.current.length;
    const step = (next: () => void, ms = STEP_MS) => {
      // I ett guidat flöde ägs räknaren av vanta-pa-klick, som räknar
      // klick. Att skriva över den här med "moment 5 av 12" mellan två
      // stopp hade gjort siffran obegriplig.
      setState((s) => ({ ...s, progress: flowRef.current ? s.progress : { current: done, total } }));
      next();
      clearTimer();
      timer.current = window.setTimeout(() => advance.current(), ms);
    };

    switch (action.kind) {
      case "oppna-meny":
        step(() => menu.current?.(true), 600);
        break;
      case "stang-meny":
        step(() => menu.current?.(false), 300);
        break;
      case "oppna-vy":
        step(() => {
          ownRoute.current = action.route;
          navigate(action.route);
        }, 800);
        break;
      case "rulla-till":
        step(() => {
          findAnchor(action.anchor)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 600);
        break;
      case "markera":
        // Texten NOLLSTÄLLS när ringen flyttar sig. Utan det följde
        // föregående förklaring med till nästa element och satte fel
        // etikett på det - "Här ligger det: Dokument nås härifrån"
        // ritades ovanpå själva dokumentvyn, alltså en anvisning till en
        // plats användaren redan stod på. Ringen först, orden sedan.
        step(
          () => setState((s) => ({ ...s, anchor: action.anchor, heading: null, text: null, receipt: false })),
          700,
        );
        break;
      case "vaxla-flik":
        step(() => findAnchor(action.anchor)?.click(), 700);
        break;
      case "fokusera-falt":
        step(() => {
          const el = findAnchor(action.anchor);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
          (el as HTMLInputElement | null)?.focus?.();
          setState((s) => ({ ...s, anchor: action.anchor }));
        }, 700);
        break;
      case "visa-sparat":
        step(
          () =>
            setState((s) => ({ ...s, anchor: action.anchor, receipt: true, heading: "Sparat", text: action.what })),
          1100,
        );
        break;
      case "forklara":
        step(
          () =>
            setState((s) => ({
              ...s,
              anchor: action.anchor,
              heading: action.heading ?? null,
              text: action.text,
              receipt: false,
            })),
          // Förklaringen ska hinna läsas. Tiden följer textens längd i
          // stället för att vara en konstant som passar den kortaste.
          // Taket finns för att hela rundturen ska kunna gås igenom av
          // någon som har bråttom - och den som vill läsa längre kan
          // stå kvar, rutan försvinner inte förrän nästa steg tar vid.
          Math.min(7000, 1500 + action.text.length * 22),
        );
        break;
      case "andas":
        step(() => {}, action.ms);
        break;
      case "vanta-pa-klick": {
        // Guidat arbetsläge: här slutar guiden att göra och börjar vänta.
        clearTimer();
        setState((s) => ({
          ...s,
          anchor: action.anchor,
          heading: null,
          text: action.text,
          awaitingClick: true,
          targetLabel: action.label,
          receipt: false,
          progress: { current: action.step, total: action.of },
        }));
        const el = findAnchor(action.anchor);
        if (!el) {
          // Ankaret finns inte i den här vyn. Hoppa vidare hellre än att
          // vänta på ett klick som aldrig kan komma.
          timer.current = window.setTimeout(() => advance.current(), 400);
          break;
        }
        const onClick = () => {
          clickCleanup.current?.();
          clickCleanup.current = null;
          setState((s) => ({ ...s, awaitingClick: false }));
          timer.current = window.setTimeout(() => advance.current(), 700);
        };
        el.addEventListener("click", onClick, { once: true });
        clickCleanup.current = () => el.removeEventListener("click", onClick);
        break;
      }
    }
  };

  const totalRef = useRef(0);
  /** Namnet på det guidade flöde som körs, om något. */
  const flowRef = useRef<string | null>(null);
  /**
   * Stegen som panelen visar, härledda ur åtgärderna vid start.
   *
   * KLICKEN är stegen - inte guidens interna moment. Användaren räknar i
   * "saker jag ska göra", och en räknare som säger "steg 3 av 12" för en
   * rundtur med fyra stopp är en räknare som ljuger.
   */
  const [steps, setSteps] = useState<{ label: string }[]>([]);

  const run = useCallback(
    (actions: GuideAction[], flowLabel: string | null = null) => {
      clearTimer();
      clickCleanup.current?.();
      clickCleanup.current = null;
      queue.current = [...actions];
      totalRef.current = actions.length;
      running.current = true;
      ownRoute.current = pathname;
      flowRef.current = flowLabel;
      setSteps(
        actions
          .filter((a): a is Extract<GuideAction, { kind: "vanta-pa-klick" }> =>
            a.kind === "vanta-pa-klick")
          .map((a) => ({ label: a.label })),
      );
      setState({ ...idle, flowLabel });
      advance.current();
    },
    [pathname],
  );

  // Byter användaren vy själv avbryts sekvensen. `ownRoute` sätts av
  // guidens egna vybyten, så bara främmande navigering fångas här.
  useEffect(() => {
    if (!running.current) return;
    if (ownRoute.current === null || ownRoute.current === pathname) return;
    stop();
  }, [pathname, stop]);

  useEffect(() => {
    if (running.current) ownRoute.current = pathname;
  }, [pathname]);

  // Esc avbryter. En rundtur man inte kan gå ifrån är en fälla.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stop]);

  useEffect(() => () => clearTimer(), []);

  const api = useMemo<GuideApi>(
    () => ({
      showMe: (entryId, role) => {
        const entry = guideEntry(entryId);
        if (!entry) return;
        run(showMeSteps(entry, { alreadyThere: entry.route === pathname, role }));
      },
      savedTo: (entryId, what) => {
        const entry = guideEntry(entryId);
        if (!entry) return;
        run(savedSteps(entry, what));
      },
      runFlow: (flowId) => {
        const flow = guidedFlow(flowId);
        if (!flow) return;
        run(flowSteps(flow), flow.label);
      },
      teach: (anchor, text, heading) => {
        run([
          { kind: "rulla-till", anchor },
          { kind: "markera", anchor },
          { kind: "forklara", anchor, text, heading },
        ]);
      },
      stop,
      registerMenu: (fn) => {
        menu.current = fn;
      },
      active: state.anchor !== null,
      state,
    }),
    [run, stop, state, pathname],
  );

  return (
    <GuideContext.Provider value={api}>
      {children}
      <Spotlight
        anchor={state.anchor}
        heading={state.heading}
        text={state.text}
        awaitingClick={state.awaitingClick}
        targetLabel={state.targetLabel}
        flowLabel={state.flowLabel}
        receipt={state.receipt}
        progress={state.progress}
        steps={steps}
        onClose={stop}
        onSkip={() => {
          // Fastnar användaren på ett steg ska hen kunna gå vidare i
          // stället för att avbryta hela genomgången. En guide utan väg
          // förbi ett steg är en återvändsgränd med extra artighet.
          clickCleanup.current?.();
          clickCleanup.current = null;
          clearTimer();
          advance.current();
        }}
      />
    </GuideContext.Provider>
  );
};

/**
 * Guiden, för den som vill använda den.
 *
 * Returnerar en tyst attrapp utanför provideren i stället för att kasta.
 * Komponenter renderas i tester och i delade vyer utan skalet omkring,
 * och en guide som kraschar sidan när den inte kan visa något har
 * missförstått sin egen roll.
 */
export const useGuide = (): GuideApi =>
  useContext(GuideContext) ?? {
    showMe: () => {},
    savedTo: () => {},
    runFlow: () => {},
    teach: () => {},
    stop: () => {},
    registerMenu: () => {},
    active: false,
    state: idle,
  };
