import { Link } from "react-router-dom";
import { ExternalLink, MapPin, MessageSquare } from "lucide-react";
import { COMPANY, formatAddress, legalIdentityIsComplete } from "@/lib/company";

// Sidfoten är sajtens karta. Toppmenyn hålls medvetet kort - orientering,
// inte sitemap - så varje väg som togs bort därifrån ska finnas här.
const toolLinks = [
  { to: "/wizard", label: "Utvärdera situationen" },
  { to: "/kbr", label: "Kontrollbalansräkning" },
  { to: "/likviditetsplan", label: "Likviditetsplanering" },
];

const serviceLinks = [
  { to: "/om", label: "Om Clearance" },
  { to: "/kunskap", label: "Kunskap" },
  { to: "/marketplace", label: "Hitta rådgivare" },
  { to: "/kontakt", label: "Kontakta oss" },
  { to: "/login", label: "Logga in" },
];

const providerLinks = [
  { to: "/for-radgivare", label: "Anslut dig som rådgivare" },
  { to: "/mina-forfragningar", label: "Mina förfrågningar" },
  { to: "/api", label: "Öppet API för utvecklare" },
];

const authorities = [
  {
    href: "https://www.verksamt.se",
    label: "verksamt.se",
    description: "Myndigheternas samlade företagarinformation",
  },
  {
    href: "https://bolagsverket.se",
    label: "Bolagsverket",
    description: "Registrering, årsredovisning, likvidation",
  },
  {
    href: "https://www.domstol.se",
    label: "Sveriges Domstolar",
    description: "Konkurs och företagsrekonstruktion",
  },
  {
    href: "https://www.skatteverket.se",
    label: "Skatteverket",
    description: "Skatter, avgifter och anstånd",
  },
  {
    href: "https://www.kronofogden.se",
    label: "Kronofogden",
    description: "Betalningsförelägganden och utmätning",
  },
];

const Footer = () => {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container px-4 py-12 md:py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-12 md:gap-8">
          {/* Identity */}
          <div className="col-span-2 md:col-span-3">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-accent">
                <span className="text-sm font-bold text-accent-foreground">C</span>
              </div>
              <span className="font-display text-xl tracking-tight">CLEARANCE</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-primary-foreground/70">
              Sambandscentralen för svenska aktiebolag i ekonomisk kris: ett operativt ledningssystem där ägare, VD, styrelse, revisor och jurist – och vid behov rekonstruktör, konkursförvaltare eller finansiär – arbetar i samma ärende. Juridik, frister, dokumentation och samverkan på ett ställe. Tjänsten
              hjälper dig strukturera underlaget och förstå vilka alternativ som finns
              – den ersätter inte juridisk eller ekonomisk rådgivning.
            </p>

            {/* Firma, organisationsnummer och säte ska anges enligt ABL 28 kap.
                Visas när de uppgifterna finns — kontaktuppgifter är en annan
                nivå och får inte hålla tillbaka den legala identiteten. */}
            <p className="mt-4 text-sm text-primary-foreground/70">
              {COMPANY.productName} är en produkt från{" "}
              <span className="font-medium text-primary-foreground">{COMPANY.legalName}</span>
              {legalIdentityIsComplete() ? (
                <>
                  , org.nr {COMPANY.orgNumber}, med säte i {COMPANY.registeredOffice}.
                  <span className="mt-1 block text-primary-foreground/60">
                    {formatAddress()}
                  </span>
                </>
              ) : (
                "."
              )}
            </p>
          </div>

          {/* Tools */}
          <div className="md:col-span-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/50">
              Verktyg
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {toolLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-primary-foreground/80 underline-offset-4 transition-colors hover:text-primary-foreground hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div className="md:col-span-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/50">
              Tjänsten
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {serviceLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-primary-foreground/80 underline-offset-4 transition-colors hover:text-primary-foreground hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Providers */}
          <div className="md:col-span-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/50">
              För leverantörer
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {providerLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-primary-foreground/80 underline-offset-4 transition-colors hover:text-primary-foreground hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-primary-foreground/50">
              Kontakt
            </h2>
            {/* Ingen e-postadress publiceras. Meddelanden lämnas i formuläret
                och landar i driftinkorgen, där det går att se vem som tagit
                hand om vad - en publik brevlåda ger ingen sådan uppföljning.
                Postadressen står kvar; den är verklig och behövs. */}
            <Link
              to="/kontakt"
              className="mt-4 inline-flex items-center gap-2 text-sm text-primary-foreground/80 underline-offset-4 transition-colors hover:text-primary-foreground hover:underline"
            >
              <MessageSquare className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              Skicka ett meddelande
            </Link>
            <address className="mt-3 flex gap-2 text-sm not-italic text-primary-foreground/60">
              <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                {COMPANY.address.street}
                <br />
                {COMPANY.address.postalCode} {COMPANY.address.city}
              </span>
            </address>
          </div>

          {/* Official sources */}
          <div className="col-span-2 md:col-span-3" id="contact">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/50">
              Officiella källor
            </h2>
            <p className="mt-4 text-sm text-primary-foreground/70">
              CLEARANCE är en privat tjänst utan koppling till svenska myndigheter.
              Officiell information finns hos:
            </p>
            <ul className="mt-4 space-y-3 text-sm">
              {authorities.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-primary-foreground/90 underline-offset-4 transition-colors hover:text-primary-foreground hover:underline"
                  >
                    {item.label}
                    <ExternalLink className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                    <span className="sr-only">(öppnas i nytt fönster)</span>
                  </a>
                  <span className="block text-xs text-primary-foreground/50">
                    {item.description}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Legal band */}
      <div className="border-t border-primary-foreground/15">
        <div className="container px-4 py-6">
          <p className="text-xs leading-relaxed text-primary-foreground/60">
            <span className="font-semibold text-primary-foreground/80">Ansvarsfriskrivning.</span>{" "}
            Innehållet i CLEARANCE är allmän information och ett administrativt
            hjälpmedel. Det utgör inte juridisk, ekonomisk eller skatterättslig
            rådgivning och kan inte läggas till grund för beslut utan att du stämmer av
            din situation med behörig rådgivare. Bedömningar i tjänsten bygger på de
            uppgifter du själv lämnar. Du ansvarar för de beslut du fattar.
          </p>
          <p className="mt-4 text-xs text-primary-foreground/50">
            © {new Date().getFullYear()} {COMPANY.legalName}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
