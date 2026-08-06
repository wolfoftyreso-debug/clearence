import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { KNOWLEDGE_ARTICLES } from "@/lib/knowledge";
import { Search } from "lucide-react";

/**
 * Sökrutan på startsidan: ett fält som svarar på "Vad vill du göra?".
 *
 * Den söker i det plattformen faktiskt kan - tjänsterna och
 * kunskapsartiklarna - och navigerar direkt. Ingen sökmotorteater: finns
 * det inget svar visas det ärligt, med vägen till kunskapsbanken.
 */

export const FOCUS_SEARCH_EVENT = "clearance-focus-search";

const SERVICES: { label: string; href: string; hint: string }[] = [
  { label: "Gratis nulägesanalys", href: "/wizard", hint: "5–10 minuter, ingen inloggning" },
  { label: "Kontrollbalansräkning (KBR)", href: "/kbr", hint: "Bedöm kapitalläget steg för steg" },
  { label: "Likviditetsplan", href: "/likviditetsplan", hint: "Vad ska betalas, när och i vilken ordning" },
  { label: "Hitta rådgivare", href: "/marketplace", hint: "Rekonstruktörer, förvaltare, revisorer, jurister" },
  { label: "Kunskapsbank", href: "/kunskap", hint: "Källhänvisade artiklar i klarspråk" },
  { label: "Logga in", href: "/login", hint: "Till ditt ärende" },
];

export const SiteSearch = () => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const focus = () => {
      inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      inputRef.current?.focus();
    };
    window.addEventListener(FOCUS_SEARCH_EVENT, focus);
    return () => window.removeEventListener(FOCUS_SEARCH_EVENT, focus);
  }, []);

  const trimmed = query.trim().toLowerCase();
  const services = trimmed
    ? SERVICES.filter((s) => `${s.label} ${s.hint}`.toLowerCase().includes(trimmed))
    : [];
  const articles = trimmed
    ? KNOWLEDGE_ARTICLES.filter((a) => `${a.title} ${a.summary}`.toLowerCase().includes(trimmed)).slice(0, 4)
    : [];
  const hasResults = services.length > 0 || articles.length > 0;

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <label className="sr-only" htmlFor="site-search">Sök på clearance.se</label>
      <div className="flex items-center gap-3 rounded-full border border-border bg-card px-5 py-4 shadow-soft">
        <Search className="h-5 w-5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          id="site-search"
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Sök på clearance.se"
          autoComplete="off"
          className="w-full bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      {open && trimmed && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 rounded-md border border-border bg-card p-2 text-left shadow-medium">
          {!hasResults ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              Inga träffar på &quot;{query.trim()}&quot;. Prova{" "}
              <button type="button" className="underline" onClick={() => navigate("/kunskap")}>
                kunskapsbanken
              </button>{" "}
              eller{" "}
              <button type="button" className="underline" onClick={() => navigate("/kontakt")}>
                kontakta oss
              </button>
              .
            </p>
          ) : (
            <>
              {services.length > 0 && (
                <ul aria-label="Tjänster">
                  {services.map((service) => (
                    <li key={service.href}>
                      <button
                        type="button"
                        onClick={() => navigate(service.href)}
                        className="w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-secondary"
                      >
                        <span className="block text-sm font-medium text-foreground">{service.label}</span>
                        <span className="block text-xs text-muted-foreground">{service.hint}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {articles.length > 0 && (
                <>
                  <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Ur kunskapsbanken
                  </p>
                  <ul aria-label="Artiklar">
                    {articles.map((article) => (
                      <li key={article.slug}>
                        <button
                          type="button"
                          onClick={() => navigate(`/kunskap/${article.slug}`)}
                          className="w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-secondary"
                        >
                          <span className="block text-sm font-medium text-foreground">{article.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">{article.summary}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
