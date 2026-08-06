import { useNavigate } from "react-router";
import type { MouseEvent, ReactNode } from "react";

/**
 * Länken till "Så fungerar tjänsten".
 *
 * Ett vanligt href="/#how-it-works" gick sönder i demon: där kör appen
 * HashRouter, och webbläsaren tolkade ankaret som RUTTEN "/how-it-works"
 * - länken ledde till 404 i stället för att rulla. Rullningen görs därför
 * i kod: finns sektionen på sidan rullar vi dit; annars navigeras det
 * till startsidan först och rullas när sektionen hunnit rendera. Fungerar
 * i båda routrarna.
 */
export const SectionLink = ({
  target,
  className,
  children,
  onNavigate,
}: {
  target: string;
  className?: string;
  children: ReactNode;
  onNavigate?: () => void;
}) => {
  const navigate = useNavigate();

  const handle = (e: MouseEvent) => {
    e.preventDefault();
    onNavigate?.();
    const el = document.getElementById(target);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    navigate("/");
    window.setTimeout(() => {
      document.getElementById(target)?.scrollIntoView({ block: "start" });
    }, 350);
  };

  return (
    <a href={`#${target}`} onClick={handle} className={className}>
      {children}
    </a>
  );
};

export const HowItWorksLink = (props: { className?: string; children: ReactNode; onNavigate?: () => void }) => (
  <SectionLink target="how-it-works" {...props} />
);
