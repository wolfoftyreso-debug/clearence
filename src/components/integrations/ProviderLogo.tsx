/**
 * Leverantörsmärken för integrationslistorna.
 *
 * ÄRLIGHETSREGEL, samma som i registret: vi ritar inte av andras
 * varumärken. De officiella logotyperna är skyddade och levereras av
 * respektive partner när avtalet är på plats - fram till dess visas ett
 * eget märke i leverantörens kännetecknande färg med dess initial.
 * Märkena är självhostade SVG:er i komponenten: inga externa anrop, i
 * linje med regeln att inget hämtas från tredje part.
 *
 * När ett partneravtal ger oss de riktiga filerna läggs de i
 * src/assets/logos/ och pekas ut i LOGO_FILES nedan - komponenten byter
 * då själv, per leverantör, utan att någon anropsplats ändras.
 */

const BRAND: Record<string, { bg: string; fg: string; initials: string; name: string }> = {
  creditsafe: { bg: "#003d6e", fg: "#ffffff", initials: "Cs", name: "Creditsafe" },
  bolagsverket: { bg: "#1d5c33", fg: "#ffffff", initials: "Bv", name: "Bolagsverket" },
  skatteverket: { bg: "#14387f", fg: "#ffffff", initials: "Sk", name: "Skatteverket" },
  kronofogden: { bg: "#005596", fg: "#ffffff", initials: "Kf", name: "Kronofogden" },
  fortnox: { bg: "#00623a", fg: "#ffffff", initials: "F", name: "Fortnox" },
  visma: { bg: "#c8102e", fg: "#ffffff", initials: "V", name: "Visma" },
  ses: { bg: "#232f3e", fg: "#ff9900", initials: "@", name: "E-postutskick" },
};

/**
 * Licensierade originalfiler, per leverantör. Fylls i när partneravtalet
 * ger oss rätten och filerna - aldrig innan.
 */
const LOGO_FILES: Record<string, string> = {};

interface ProviderLogoProps {
  provider: string;
  className?: string;
}

export const ProviderLogo = ({ provider, className = "h-9 w-9" }: ProviderLogoProps) => {
  const licensed = LOGO_FILES[provider];
  if (licensed) {
    return (
      <img src={licensed} alt="" aria-hidden="true" className={`${className} rounded-md object-contain`} />
    );
  }

  const brand = BRAND[provider];
  if (!brand) {
    return (
      <span
        aria-hidden="true"
        className={`${className} flex-shrink-0 rounded-md border border-border bg-secondary`}
      />
    );
  }

  return (
    <svg
      viewBox="0 0 40 40"
      role="img"
      aria-label={brand.name}
      className={`${className} flex-shrink-0 rounded-md`}
    >
      <rect width="40" height="40" rx="8" fill={brand.bg} />
      <text
        x="20"
        y="26"
        textAnchor="middle"
        fontFamily="Archivo, 'Segoe UI', sans-serif"
        fontSize="16"
        fontWeight="700"
        fill={brand.fg}
      >
        {brand.initials}
      </text>
    </svg>
  );
};

/** Registrets id:n → märken, för integrationsöversikten. */
export const REGISTRY_LOGO_MAP: Record<string, string> = {
  "skatteverket-skattekonto": "skatteverket",
  bolagsverket: "bolagsverket",
  kronofogden: "kronofogden",
  creditsafe: "creditsafe",
  fortnox: "fortnox",
  visma: "visma",
  bankid: "bankid",
};
