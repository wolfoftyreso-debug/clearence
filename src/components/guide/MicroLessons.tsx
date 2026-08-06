import { useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { useGuide } from "@/components/guide/GuideProvider";
import { dueLesson, rememberReminded, rememberShown } from "@/lib/guide/microLessons";

/**
 * MIKROUTBILDNINGENS DRIVRUTIN.
 *
 * Sitter i skalet, tittar efter vilka ytor som faktiskt finns på skärmen
 * och visar nästa lektion som är i tur. Ingenting mer.
 *
 * TRE SPÄRRAR, alla lika viktiga:
 *
 *  1. INTE NÄR NÅGOT ANNAT PÅGÅR. Kör guiden redan en rundtur eller
 *     väntar den på ett klick får ingen lektion tränga sig före.
 *  2. INTE I AKUT LÄGE. Den som inte kan betala lönerna på fredag ska
 *     inte få veta vad ett kontrollområde heter. Undervisning i fel
 *     ögonblick är i vägen, inte omtanke.
 *  3. INTE DIREKT. Lektionen kommer några sekunder efter att sidan
 *     landat, så att användaren hinner se på det hen kom för först.
 */
export const MicroLessons = ({ acute }: { acute: boolean }) => {
  const guide = useGuide();
  const { pathname } = useLocation();
  const timer = useRef<number | null>(null);
  /** Guiden i en ref: lektionen ska inte startas om för att state ändrats. */
  const guideRef = useRef(guide);
  guideRef.current = guide;

  useEffect(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    if (acute) return;

    timer.current = window.setTimeout(() => {
      if (guideRef.current.active) return;
      const visibleAnchors = [...document.querySelectorAll<HTMLElement>("[data-guide]")]
        .map((el) => el.dataset.guide)
        .filter((a): a is string => !!a);
      const due = dueLesson({ visibleAnchors, acute, now: new Date() });
      if (!due) return;
      guideRef.current.teach(
        due.lesson.anchor,
        due.text,
        due.phase === "paminnelse" ? "Kommer du ihåg?" : "Kort förklaring",
      );
      if (due.phase === "paminnelse") rememberReminded(due.lesson.id);
      else rememberShown(due.lesson.id, new Date());
    }, 4000);

    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [pathname, acute]);

  return null;
};
