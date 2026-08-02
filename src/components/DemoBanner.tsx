import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { IS_DEMO } from "@/data";
import { useAuth } from "@/hooks/useAuth";
import { AlertTriangle } from "lucide-react";

/**
 * Says, on every screen, that nothing here is real.
 *
 * This product tells people whether their company is insolvent. Seeded
 * figures that could be read as an assessment are the one thing that must
 * never happen quietly, so the notice is fixed, always visible, and not
 * dismissible.
 */
export const DemoBanner = () => {
  const { user } = useAuth();
  const bannerRef = useRef<HTMLDivElement>(null);

  // The banner is fixed, so it sits on top of whatever is at the bottom of
  // the page - including the wizards' fixed action bars and the landing
  // page's bottom navigation, whose buttons it made unclickable. Padding
  // the body is not enough: a fixed element does not move for it. So
  // publish the banner's MEASURED height as a variable that fixed bars
  // offset themselves by, and pad the document for ordinary content. A
  // hardcoded height broke on narrow phones where the text wraps taller -
  // hence the ResizeObserver.
  useEffect(() => {
    if (!IS_DEMO || !bannerRef.current) return;
    const root = document.documentElement;
    const previousPadding = document.body.style.paddingBottom;
    const apply = () => {
      const height = bannerRef.current?.offsetHeight ?? 0;
      root.style.setProperty("--app-bottom-inset", `${height}px`);
      document.body.style.paddingBottom = `${height}px`;
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(bannerRef.current);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--app-bottom-inset");
      document.body.style.paddingBottom = previousPadding;
    };
  }, []);

  if (!IS_DEMO) return null;

  return (
    <div
      ref={bannerRef}
      role="status"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-warning/40 bg-warning/95 px-4 py-2.5 text-warning-foreground"
    >
      <div className="container flex items-start gap-2.5 px-0">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <p className="text-xs leading-relaxed">
          <span className="font-semibold">Demoläge.</span> Allt du ser är påhittat –
          bolaget, siffrorna och rådgivarna finns inte. Inloggningen godtar vilket
          lösenord som helst och data sparas bara i din webbläsare. Använd inte det
          här för att bedöma ett verkligt bolag.
        </p>
        {!user && (
          <Link
            to="/login"
            className="ml-auto flex-shrink-0 whitespace-nowrap rounded-md bg-warning-foreground px-3 py-1.5 text-xs font-semibold text-warning underline-offset-4 hover:underline"
          >
            Logga in i demon
          </Link>
        )}
      </div>
    </div>
  );
};
