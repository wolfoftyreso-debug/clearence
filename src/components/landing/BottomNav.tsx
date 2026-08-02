import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LanguageLevelPicker } from "@/components/language/GlossaryText";
import { SectionLink } from "@/components/landing/HowItWorksLink";
import { FOCUS_SEARCH_EVENT } from "@/components/landing/SiteSearch";
import { Grid3x3, LogIn, Menu, Search, Settings, X } from "lucide-react";

/**
 * Mobilnavigeringen nertill: Sök, Meny, Tjänster, Logga in, Inställningar.
 *
 * Samma uppställning som myndighetstjänsterna företagare redan kan - fem
 * fasta val i tumhöjd. Inställningar är inte kosmetik: där bor
 * språkprofilen, valet mellan juridiskt språk, klarspråk, förenklad och
 * mycket enkel svenska. Att den ligger ett tryck bort på startsidan är
 * poängen - den som behöver enklare språk ska inte behöva leta i inloggade
 * vyer för att få det.
 */

const MENU_LINKS: { label: string; href: string }[] = [
  { label: "Start", href: "/" },
  { label: "Gratis nulägesanalys", href: "/wizard" },
  { label: "Kunskapsbank", href: "/kunskap" },
  { label: "Hitta rådgivare", href: "/marketplace" },
  { label: "För rådgivare", href: "/for-radgivare" },
  { label: "Om CLEARANCE", href: "/om" },
  { label: "Kontakt", href: "/kontakt" },
];

type Panel = "menu" | "settings" | null;

export const BottomNav = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [panel, setPanel] = useState<Panel>(null);

  const item =
    "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground";

  return (
    <>
      {panel && (
        <div className="fixed inset-0 z-40 bg-foreground/30 md:hidden" onClick={() => setPanel(null)} aria-hidden="true" />
      )}

      {panel && (
        <div
          className="fixed inset-x-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-md border-t border-border bg-card p-4 shadow-medium md:hidden"
          style={{ bottom: "calc(3.5rem + var(--app-bottom-inset, 0px))" }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {panel === "menu" ? "Meny" : "Inställningar · Språk"}
            </h2>
            <button type="button" onClick={() => setPanel(null)} aria-label="Stäng" className="p-1 text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          {panel === "menu" ? (
            <ul className="mt-2">
              {MENU_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    onClick={() => setPanel(null)}
                    className="block rounded-md px-2 py-2.5 text-base text-foreground transition-colors hover:bg-secondary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3">
              <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
                Välj hur CLEARANCE ska skriva till dig. Om en text är svår att
                förstå är det systemet som ska anpassa sig – inte du.
              </p>
              <LanguageLevelPicker />
            </div>
          )}
        </div>
      )}

      {/* I demon ligger demobannern fast nederst (z-100) och publicerar sin
          höjd som --app-bottom-inset; navigeringen ställer sig ovanpå den i
          stället för under. Utan banner är insetten 0 och raden ligger i
          botten som vanligt. */}
      <nav
        aria-label="Snabbnavigering"
        className="fixed inset-x-0 z-50 flex border-t border-border bg-card/95 backdrop-blur md:hidden"
        style={{ bottom: "var(--app-bottom-inset, 0px)" }}
      >
        <button
          type="button"
          className={item}
          onClick={() => {
            setPanel(null);
            window.dispatchEvent(new CustomEvent(FOCUS_SEARCH_EVENT));
          }}
        >
          <Search className="h-5 w-5" aria-hidden="true" />
          Sök
        </button>
        <button type="button" className={item} aria-expanded={panel === "menu"} onClick={() => setPanel(panel === "menu" ? null : "menu")}>
          <Menu className="h-5 w-5" aria-hidden="true" />
          Meny
        </button>
        <SectionLink target="features" className={item} onNavigate={() => setPanel(null)}>
          <Grid3x3 className="h-5 w-5" aria-hidden="true" />
          Tjänster
        </SectionLink>
        <button type="button" className={item} onClick={() => navigate(user ? "/dashboard" : "/login")}>
          <LogIn className="h-5 w-5" aria-hidden="true" />
          {user ? "Mina sidor" : "Logga in"}
        </button>
        {/* Inloggade har sina riktiga inställningar under Mina sidor -
            dit leder knappen. Utan konto finns bara språkprofilen, och den
            visas då direkt här i stället för en inloggningsvägg. */}
        <button
          type="button"
          className={item}
          aria-expanded={user ? undefined : panel === "settings"}
          onClick={() => {
            if (user) {
              setPanel(null);
              navigate("/dashboard/installningar");
            } else {
              setPanel(panel === "settings" ? null : "settings");
            }
          }}
        >
          <Settings className="h-5 w-5" aria-hidden="true" />
          Inställningar
        </button>
      </nav>
    </>
  );
};
