import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { COMPANY, formatAddress } from "@/lib/company";
import {
  DRAFT_NOTICE,
  PRIVACY_SECTIONS,
  TERMS_SECTIONS,
  type LegalSection,
} from "@/lib/legalPages";
import { AlertTriangle } from "lucide-react";

/**
 * Integritetspolicyn och villkoren.
 *
 * En sida, två innehåll: de har identisk form och skulle bara glida isär
 * om de byggdes var för sig.
 *
 * Utkastnotisen står ÖVERST och går inte att stänga. Att lägga den sist
 * eller bakom en länk hade varit att gömma den enda uppgift som avgör hur
 * texten ska läsas. Avsnitt där beslutet inte är fattat märks ut var för
 * sig - en läsare ska se exakt vilka punkter som är öppna, inte behöva
 * misstro hela dokumentet.
 */

const Section = ({ section }: { section: LegalSection }) => (
  <section className="border-t border-border pt-6">
    <h2 className="text-base font-semibold text-foreground">
      {section.title}
      {section.open && (
        <span className="ml-2 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-warning-foreground">
          Öppen punkt
        </span>
      )}
    </h2>
    {section.body.map((p) => (
      <p key={p} className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {p}
      </p>
    ))}
    {section.points && (
      <ul className="mt-3 space-y-1.5">
        {section.points.map((point) => (
          <li key={point} className="text-sm leading-relaxed text-foreground">
            • {point}
          </li>
        ))}
      </ul>
    )}
  </section>
);

const LegalPage = ({ kind }: { kind: "integritet" | "villkor" }) => {
  const isPrivacy = kind === "integritet";
  const sections = isPrivacy ? PRIVACY_SECTIONS : TERMS_SECTIONS;
  const open = sections.filter((s) => s.open).length;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container px-4 pb-16 pt-28 md:pt-36">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-semibold text-foreground">
            {isPrivacy ? "Integritetspolicy" : "Användarvillkor"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {isPrivacy
              ? "Vilka uppgifter Clearance samlar in, varför, vem som ser dem och vad du kan göra åt det."
              : "Vad tjänsten är, vad den inte är, och vad som gäller mellan dig och Landvex AB."}
          </p>

          {/* Utkastnotisen, överst och utan avstängningsknapp. */}
          <div className="mt-5 flex items-start gap-2.5 rounded-md border border-warning/40 bg-warning/10 p-4">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium text-foreground">Utkast – inte juridiskt granskat</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{DRAFT_NOTICE}</p>
              {open > 0 && (
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {open === 1 ? "En punkt är öppen" : `${open} punkter är öppna`} och märkt som
                  sådan nedan.
                </p>
              )}
            </div>
          </div>

          <div className="mt-8 space-y-6">
            {sections.map((section) => (
              <Section key={section.title} section={section} />
            ))}

            <section className="border-t border-border pt-6">
              <h2 className="text-base font-semibold text-foreground">Kontakt</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {COMPANY.legalName}, org.nr {COMPANY.orgNumber}, {formatAddress()}.
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Frågor om den här texten lämnas via kontaktformuläret.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default LegalPage;
