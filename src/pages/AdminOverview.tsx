import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { data } from "@/data";
import { billingState } from "@/lib/billing";
import { ProviderLogo } from "@/components/integrations/ProviderLogo";
import type { ProfessionalTerms, ProfileClaimForReview, SecretInfo } from "@/data/types";
import { SMS_SECRET_PROVIDER } from "@/lib/notifications/events";
import { ACTION_LABEL, retentionSummary, SKUGGLAGE_NOTE } from "@/lib/retention";
import {
  AlertTriangle,
  Banknote,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  KeyRound,
  Loader2,
  TrendingUp,
  Trash2,
  Users,
} from "lucide-react";

/**
 * Driftpanelen: systemets läge på en skärm, och nycklarna som driver det.
 *
 * Två halvor med olika tempo:
 *
 *  - LÄGET överst svarar på "behöver någon göra något just nu?" - nya
 *    meddelanden, väntande ansökningar, mejl som inte gått fram och stängda
 *    konton. Varje kort länkar till vyn där saken åtgärdas; panelen är en
 *    avfart, inte en återvändsgränd.
 *
 *  - NYCKLARNA nederst byts sällan men måste kunna bytas snabbt. Regeln
 *    ärvs från databasen: en sparad nyckel kan ALDRIG läsas tillbaka hit -
 *    listan visar fyra sista tecken och bytesdatum, aldrig mer. Kapas en
 *    driftsession är byte av nycklar det värsta som kan hända, inte
 *    utläsning.
 */

/**
 * Leverantörerna som databasen accepterar (samma CHECK-lista som i
 * integration_secrets). Läggs en leverantör till görs det i migrationen
 * först - panelen ska inte kunna erbjuda ett fält databasen avvisar.
 */
const PROVIDERS: { id: string; name: string; note: string }[] = [
  { id: "creditsafe", name: "Creditsafe", note: "Daglig kreditbevakning av ärendenas bolag." },
  { id: "bolagsverket", name: "Bolagsverket", note: "Företagsuppgifter vid utvärderingen." },
  { id: "fortnox", name: "Fortnox", note: "Bokföringsdata direkt, i stället för SIE-fil." },
  { id: "visma", name: "Visma eEkonomi", note: "Bokföringsdata direkt, i stället för SIE-fil." },
  { id: "ses", name: "E-postutskick (SES)", note: "Arbetarens avsändarkonto för fakturor och påminnelser." },
  {
    id: SMS_SECRET_PROVIDER,
    name: "SMS-utskick",
    // Formatet står här för att det inte går att gissa: nyckeln är två
    // uppgifter i ett fält, och fel format ger ett tyst nej i kön.
    note: 'SMS-aviseringar för Business och Enterprise. Skrivs som "användarnamn:lösenord".',
  },
];

const swedishDate = (iso: string) =>
  new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });

interface StatusCardProps {
  label: string;
  value: number;
  /** Formuleringen när värdet är noll respektive inte. */
  calm: string;
  action: string;
  href: string;
  urgent: boolean;
}

const StatusCard = ({ label, value, calm, action, href, urgent }: StatusCardProps) => (
  <Link
    to={href}
    className={`group flex flex-col rounded-md border p-4 transition-colors hover:border-accent ${
      urgent && value > 0 ? "border-warning/50 bg-warning/5" : "border-border bg-card"
    }`}
  >
    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
    </span>
    <span className="mt-1 text-3xl font-semibold tabular-nums text-foreground">{value}</span>
    <span className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
      {value === 0 ? calm : action}
      <ArrowRight
        className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden="true"
      />
    </span>
  </Link>
);

const ProviderRow = ({ provider, stored }: { provider: (typeof PROVIDERS)[number]; stored: SecretInfo | undefined }) => {
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["integration-secrets"] });

  const set = useMutation({
    mutationFn: (secret: string) => data.ops.setSecret(provider.id, secret),
    onSuccess: () => {
      setValue("");
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: () => data.ops.deleteSecret(provider.id),
    onSuccess: refresh,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const secret = value.trim();
    if (secret.length < 8) return;
    set.mutate(secret);
  };

  return (
    <li className="rounded-md border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 items-center gap-3">
          <ProviderLogo provider={provider.id} />
          <div className="min-w-0">
            <h3 className="font-medium text-foreground">{provider.name}</h3>
            <p className="text-xs text-muted-foreground">{provider.note}</p>
          </div>
        </div>
        {stored ? (
          <span className="flex items-center gap-1.5 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            <span className="font-mono">••••{stored.last4}</span>
            <span className="text-muted-foreground">bytt {swedishDate(stored.updatedAt)}</span>
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Ingen nyckel sparad</span>
        )}
      </div>

      <form onSubmit={submit} className="mt-3 flex flex-wrap gap-2">
        <Input
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={stored ? "Klistra in ny nyckel för att byta" : "Klistra in nyckeln"}
          aria-label={`API-nyckel för ${provider.name}`}
          className="min-w-0 flex-1 basis-64 font-mono"
        />
        <Button type="submit" variant="outline" disabled={value.trim().length < 8 || set.isPending}>
          {set.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : stored ? (
            "Byt nyckel"
          ) : (
            "Spara"
          )}
        </Button>
        {stored && (
          <Button
            type="button"
            variant="ghost"
            disabled={remove.isPending}
            onClick={() => {
              if (window.confirm(`Ta bort nyckeln för ${provider.name}? Kopplingen slutar fungera tills en ny sparas.`)) {
                remove.mutate();
              }
            }}
            aria-label={`Ta bort nyckeln för ${provider.name}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </form>
      {(set.isError || remove.isError) && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          Kunde inte spara. Försök igen.
        </p>
      )}
    </li>
  );
};

/**
 * Rådgivarnas avgifter: kronor per förmedling, satt av drift.
 *
 * Avgiften är en avtalsuppgift - rådgivaren kan aldrig ställa in den själv,
 * och en ändring gäller framåt: redan skapade förmedlingar behåller sin
 * stämplade avgift, så en omförhandling inte skriver om ett fakturaunderlag
 * i efterhand. Utan avgift faktureras rådgivaren inte alls - körningen
 * rapporterar det som överhoppat i stället för att gissa ett belopp.
 */
const FeeRow = ({ terms }: { terms: ProfessionalTerms }) => {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(
    terms.referralFeeSek === null ? "" : String(terms.referralFeeSek),
  );
  const set = useMutation({
    mutationFn: () => {
      const parsed = value.trim() === "" ? null : Number(value.replace(",", "."));
      if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
        throw new Error("Ogiltigt belopp");
      }
      return data.ops.setReferralFee(terms.professionalId, parsed);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["professional-terms"] }),
  });

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{terms.company ?? terms.name}</p>
        <p className="text-xs text-muted-foreground">
          {terms.uninvoicedBillable === 0
            ? "Inget ofakturerat underlag"
            : `${terms.uninvoicedBillable} ofakturerade förmedlingar`}
          {terms.referralFeeSek === null && " · faktureras inte förrän avgift satts"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="numeric"
          placeholder="kr/förmedling"
          aria-label={`Avgift per förmedling för ${terms.company ?? terms.name}`}
          className="w-32 text-right tabular-nums"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={set.isPending}
          onClick={() => set.mutate()}
        >
          Spara
        </Button>
      </div>
      {set.isError && (
        <p className="w-full text-xs text-destructive" role="alert">
          Kunde inte spara avgiften.
        </p>
      )}
    </li>
  );
};

const FeeSection = () => {
  const { data: terms } = useQuery({
    queryKey: ["professional-terms"],
    queryFn: () => data.ops.listProfessionalTerms(),
  });

  if (!terms || terms.length === 0) return null;
  return (
    <section aria-labelledby="fees-heading">
      <h2 id="fees-heading" className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <Banknote className="h-5 w-5 text-accent" aria-hidden="true" />
        Rådgivarnas avgifter
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Kronor per förmedlad förfrågan. Faktureras den 1:a varje månad för
        föregående månads accepterade förfrågningar. En ändring gäller framåt –
        redan skapade förmedlingar behåller sin stämplade avgift.
      </p>
      <ul className="mt-3 space-y-2">
        {terms.map((t) => (
          <FeeRow key={t.professionalId} terms={t} />
        ))}
      </ul>
    </section>
  );
};

/**
 * Profilanspråken: "Är detta din profil?" landar här.
 *
 * Granskningen är plattformens KYC i dag: en människa kontrollerar
 * företrädarrätten via den angivna kontaktvägen innan profilen kopplas
 * till kontot och märks Verifierad. Ett godkännande avvisar automatiskt
 * konkurrerande anspråk på samma profil - regeln bor i databasen, knappen
 * här utlöser den bara.
 */
const ClaimRow = ({ claim }: { claim: ProfileClaimForReview }) => {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["profile-claims"] });
    queryClient.invalidateQueries({ queryKey: ["professionals"] });
  };
  const review = useMutation({
    mutationFn: (approve: boolean) =>
      data.professionals.reviewClaim(claim.id, approve, note.trim() || undefined),
    onSuccess: refresh,
  });

  if (claim.status !== "pending") {
    return (
      <li className="rounded-md border border-border p-3 opacity-70">
        <p className="text-sm text-foreground">
          <span className="font-medium">{claim.professionalName}</span>
          {" – "}
          {claim.claimantEmail}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {claim.status === "approved" ? "Godkänt" : "Avslaget"}
          {claim.reviewNote ? ` · ${claim.reviewNote}` : ""}
        </p>
      </li>
    );
  }

  return (
    <li className="rounded-md border border-border p-4">
      <p className="text-sm font-medium text-foreground">{claim.professionalName}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Anspråk från {claim.claimantEmail} · kontrollväg: {claim.contact}
      </p>
      <p className="mt-2 rounded-md bg-secondary/40 p-2 text-sm leading-relaxed text-foreground">
        {claim.motivation}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anteckning (krävs vid avslag)"
          aria-label={`Anteckning för anspråket på ${claim.professionalName}`}
          className="min-w-0 flex-1 basis-52"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={review.isPending}
          onClick={() => review.mutate(true)}
        >
          Godkänn och verifiera
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={review.isPending || note.trim() === ""}
          onClick={() => review.mutate(false)}
        >
          Avslå
        </Button>
      </div>
      {review.isError && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {review.error instanceof Error ? review.error.message : "Kunde inte spara beslutet."}
        </p>
      )}
    </li>
  );
};

const ClaimsSection = () => {
  const { data: claims } = useQuery({
    queryKey: ["profile-claims"],
    queryFn: () => data.professionals.listClaims(),
  });

  if (!claims || claims.length === 0) return null;
  return (
    <section aria-labelledby="claims-heading">
      <h2 id="claims-heading" className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <BadgeCheck className="h-5 w-5 text-accent" aria-hidden="true" />
        Profilanspråk
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Någon säger sig företräda en förifylld katalogprofil. Kontrollera
        företrädarrätten via kontaktvägen innan du godkänner – godkännandet
        kopplar profilen till kontot och märker den Verifierad.
      </p>
      <ul className="mt-3 space-y-2">
        {claims.map((claim) => (
          <ClaimRow key={claim.id} claim={claim} />
        ))}
      </ul>
    </section>
  );
};

const PLAN_LABELS: Record<string, string> = {
  per_case: "Per upplåst ärende",
  subscription: "Abonnemang",
  usage: "Användningsbaserad",
  enterprise: "Företagslicens",
};

/**
 * Prisplanen per byrå: affärsmodellen är parametrar som driften sätter,
 * aldrig belopp i koden. Utan avtalad avgift är upplåsningen kostnadsfri
 * och syns som det - systemet gissar aldrig ett pris.
 */
const PlanRow = ({
  terms,
  plan,
}: {
  terms: ProfessionalTerms;
  plan: { planKind: string; unlockFeeSek: number | null; monthlyFeeSek: number | null; shadow: boolean } | undefined;
}) => {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState(plan?.planKind ?? "per_case");
  const [unlockFee, setUnlockFee] = useState(plan?.unlockFeeSek === null || plan?.unlockFeeSek === undefined ? "" : String(plan.unlockFeeSek));
  const [monthlyFee, setMonthlyFee] = useState(plan?.monthlyFeeSek === null || plan?.monthlyFeeSek === undefined ? "" : String(plan.monthlyFeeSek));

  const parse = (value: string): number | null => {
    if (value.trim() === "") return null;
    const parsed = Number(value.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) throw new Error("Ogiltigt belopp");
    return parsed;
  };
  const save = useMutation({
    mutationFn: () =>
      data.ops.setBillingPlan({
        professionalId: terms.professionalId,
        planKind: kind as "per_case" | "subscription" | "usage" | "enterprise",
        unlockFeeSek: parse(unlockFee),
        monthlyFeeSek: parse(monthlyFee),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["billing-plans"] }),
  });
  // Skuggväxeln (pilotens spår A): registrera och visa, fakturera aldrig.
  // Egen växel skild från planbytet - den stämplas på framtida rader.
  const setShadow = useMutation({
    mutationFn: (shadow: boolean) =>
      data.ops.setBillingShadow(terms.professionalId, shadow),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["billing-plans"] }),
  });

  return (
    <li className="rounded-md border border-border p-3">
      <p className="text-sm font-medium text-foreground">{terms.company ?? terms.name}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          aria-label={`Prismodell för ${terms.company ?? terms.name}`}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {Object.entries(PLAN_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <Input
          value={unlockFee}
          onChange={(e) => setUnlockFee(e.target.value)}
          inputMode="numeric"
          placeholder="kr/ärende"
          aria-label={`Avgift per upplåst ärende för ${terms.company ?? terms.name}`}
          className="w-28 text-right tabular-nums"
        />
        <Input
          value={monthlyFee}
          onChange={(e) => setMonthlyFee(e.target.value)}
          inputMode="numeric"
          placeholder="kr/månad"
          aria-label={`Månadsavgift för ${terms.company ?? terms.name}`}
          className="w-28 text-right tabular-nums"
        />
        <Button type="button" variant="outline" size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
          Spara
        </Button>
        {save.isSuccess && <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />}
      </div>
      {save.isError && (
        <p className="mt-1 text-xs text-destructive" role="alert">Kunde inte spara planen.</p>
      )}
      <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={plan?.shadow ?? false}
          disabled={setShadow.isPending}
          onChange={(e) => setShadow.mutate(e.target.checked)}
          className="h-3.5 w-3.5 accent-[hsl(var(--accent))]"
        />
        Skuggdebitering (pilotens spår A): avgifter registreras och visas men faktureras aldrig
      </label>
    </li>
  );
};

/**
 * Företagsabonnemanget: EN plan, ett belopp, satt här och ingen
 * annanstans. Ändringen slår igenom omedelbart i alla pris- och
 * låstexter - beloppet är en parameter, aldrig en kodrad.
 */
const CompanyPlanSection = () => {
  const queryClient = useQueryClient();
  const { data: plan } = useQuery({
    queryKey: ["company-plan"],
    queryFn: () => data.billing.getCompanyPlan(),
  });
  const [standard, setStandard] = useState("");
  const [business, setBusiness] = useState("");
  const [enterprise, setEnterprise] = useState("");
  const saveMutation = useMutation({
    mutationFn: (input: {
      monthlyExVatSek: number;
      businessExVatSek?: number | null;
      enterpriseExVatSek?: number | null;
    }) => data.ops.setCompanyPlan(input),
    onSuccess: () => {
      setStandard("");
      setBusiness("");
      setEnterprise("");
      queryClient.invalidateQueries({ queryKey: ["company-plan"] });
    },
  });
  const parse = (raw: string): number | undefined => {
    const n = Number(raw.replace(/[^\d]/g, ""));
    return n > 0 ? n : undefined;
  };

  return (
    <section aria-labelledby="company-plan-heading">
      <h2
        id="company-plan-heading"
        className="flex items-center gap-2 text-lg font-semibold text-foreground"
      >
        <Banknote className="h-5 w-5 text-accent" aria-hidden="true" />
        Företagsabonnemanget
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Månadsavgiften för företagskunder, exklusive moms. Månadsfaktura, ingen
        bindningstid, uppsägning när som helst – och alla data sparas även om
        abonnemanget pausas. Beloppet visas i pris- och låstexterna direkt.
      </p>
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const monthly = parse(standard) ?? plan?.monthlyExVatSek;
          if (!monthly) return;
          saveMutation.mutate({
            monthlyExVatSek: monthly,
            businessExVatSek: parse(business) ?? plan?.businessExVatSek ?? null,
            enterpriseExVatSek: parse(enterprise) ?? plan?.enterpriseExVatSek ?? null,
          });
        }}
      >
        <p className="w-full text-sm text-foreground">
          Nuvarande:{" "}
          <span className="font-semibold tabular-nums">
            {plan
              ? `Standard ${plan.monthlyExVatSek} · Business ${plan.businessExVatSek ?? "–"} · Enterprise ${plan.enterpriseExVatSek ?? "–"} kr/mån + moms`
              : "laddar …"}
          </span>
        </p>
        <Input
          value={standard}
          onChange={(e) => setStandard(e.target.value)}
          placeholder="Standard"
          inputMode="numeric"
          className="w-32"
          aria-label="Ny månadsavgift exklusive moms"
        />
        <Input
          value={business}
          onChange={(e) => setBusiness(e.target.value)}
          placeholder="Business"
          inputMode="numeric"
          className="w-32"
          aria-label="Business-nivåns månadsavgift exklusive moms"
        />
        <Input
          value={enterprise}
          onChange={(e) => setEnterprise(e.target.value)}
          placeholder="Enterprise"
          inputMode="numeric"
          className="w-32"
          aria-label="Enterprise-nivåns månadsavgift exklusive moms"
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={(!standard.trim() && !business.trim() && !enterprise.trim()) || saveMutation.isPending}
        >
          Spara
        </Button>
        {saveMutation.isError && (
          <p className="text-sm text-destructive" role="alert">
            Kunde inte spara beloppet.
          </p>
        )}
      </form>
    </section>
  );
};

const PlanSection = () => {
  const { data: terms } = useQuery({
    queryKey: ["professional-terms"],
    queryFn: () => data.ops.listProfessionalTerms(),
  });
  const { data: plans } = useQuery({
    queryKey: ["billing-plans"],
    queryFn: () => data.ops.listBillingPlans(),
  });

  if (!terms || terms.length === 0) return null;
  return (
    <section aria-labelledby="plans-heading" data-section="byraplaner">
      <h2 id="plans-heading" className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <Banknote className="h-5 w-5 text-accent" aria-hidden="true" />
        Prisplaner för upplåsta ärenden
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Per byrå: prismodell, avgift per upplåst ärende och eventuell
        månadsavgift. Utan avtalad avgift är upplåsningen kostnadsfri – byrån
        ser det, och ingen debitering gissas. Alla avgifter samlas på en
        månadsfaktura med full specifikation.
      </p>
      <ul className="mt-3 space-y-2">
        {terms.map((t) => (
          // Nyckeln byts när planerna laddats, så raden monteras om med de
          // sparade värdena i stället för att visa tomma fält.
          <PlanRow
            key={`${t.professionalId}-${plans ? "laddad" : "laddar"}`}
            terms={t}
            plan={(plans ?? []).find((p) => p.professionalId === t.professionalId)}
          />
        ))}
      </ul>
    </section>
  );
};

/**
 * North Star-raden: antal företag som återgått till ekonomisk stabilitet
 * med hjälp av plattformen. Det är det här driften styr mot - inte antal
 * konton, inte antal upplåsningar. Bredvid: hälsoläget (bolag som stannat
 * kvar efter lyckad kris), dålig churn (konkurs/likvidation) och öppna
 * ärenden. Siffrorna kommer ur exitorsakerna, aldrig ur gissningar.
 */
const NorthStarSection = () => {
  const { data: counts } = useQuery({
    queryKey: ["north-star"],
    queryFn: () => data.ops.northStarCounts(),
  });

  const tiles: { label: string; value: number | undefined; note: string; highlight?: boolean }[] = [
    {
      label: "Återhämtade bolag",
      value: counts?.recovered,
      note: "Stabiliserade eller genomförd rekonstruktion.",
      highlight: true,
    },
    { label: "I hälsoläget", value: counts?.inHealth, note: "Stannade kvar efter lyckad krisfas." },
    { label: "Dålig churn", value: counts?.badChurn, note: "Konkurs eller likvidation." },
    { label: "Öppna ärenden", value: counts?.openCases, note: "Pågående krisfaser just nu." },
  ];

  return (
    <section aria-labelledby="north-star-heading">
      <h2
        id="north-star-heading"
        className="flex items-center gap-2 text-lg font-semibold text-foreground"
      >
        <TrendingUp className="h-5 w-5 text-accent" aria-hidden="true" />
        North Star: återhämtning
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Antal företag som återgått till ekonomisk stabilitet med hjälp av
        plattformen. Mäts ur registrerade exitorsaker vid avslut.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className={`flex flex-col rounded-md border p-4 ${
              tile.highlight ? "border-success/40 bg-success/5" : "border-border bg-card"
            }`}
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {tile.label}
            </span>
            <span className="mt-1 text-3xl font-semibold tabular-nums text-foreground">
              {tile.value ?? "–"}
            </span>
            <span className="mt-1 text-sm text-muted-foreground">{tile.note}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

/**
 * Gallringen: hur länge uppgifter sparas och vad som händer sen (GDPR
 * art. 5.1 e). Läser policyn ur driftparametern och visar den ärligt -
 * inklusive vilka kategorier som ännu bara räknar i skuggläge. Att slå på
 * skarp gallring är ett beslut som tas medvetet, inte en default, så den
 * här vyn visar men styr inte: värdena sätts i app_settings.
 */
const RetentionSection = () => {
  const { data: policy } = useQuery({
    queryKey: ["retention-policy"],
    queryFn: () => data.ops.getRetentionPolicy(),
  });

  return (
    <section aria-labelledby="retention-heading">
      <h2
        id="retention-heading"
        className="flex items-center gap-2 text-lg font-semibold text-foreground"
      >
        <Trash2 className="h-5 w-5 text-accent" aria-hidden="true" />
        Gallring av uppgifter
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Hur länge varje kategori sparas och vad som händer sen. Tiderna är
        driftparametrar (app_settings, nyckeln retention_policy); åtgärden är
        medveten per kategori. {policy ? retentionSummary(policy) : ""}
      </p>
      <ul className="mt-3 space-y-2">
        {(policy ?? []).map((cat) => (
          <li
            key={cat.id}
            className="rounded-md border border-border bg-card p-3 text-sm"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="font-medium text-foreground">{cat.label}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {cat.months === null ? "sparas (ingen tidsgräns)" : `efter ${cat.months} mån`} · {ACTION_LABEL[cat.action]}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{cat.description}</p>
            {cat.action !== "behall" && (
              <span
                className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  cat.aktiv
                    ? "bg-success/10 text-success"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {cat.aktiv ? "Gallrar skarpt" : "Skuggläge – räknas, gallras inte"}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 flex items-start gap-2 rounded-md bg-secondary/40 p-3 text-xs leading-relaxed text-muted-foreground">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
        {SKUGGLAGE_NOTE} Själva gallringen körs av arbetaren (worker --gallra).
      </p>
    </section>
  );
};

/**
 * Plattformen i siffror: konton och katalog. Räknat ur samma frågor som
 * kund- och katalogvyerna - inga egna, avvikande summeringar.
 */
const PlatformSection = () => {
  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: () => data.billing.listCustomers(),
  });
  const { data: professionals } = useQuery({
    queryKey: ["professionals"],
    queryFn: () => data.professionals.listActive(),
  });

  const count = (fn: (c: NonNullable<typeof customers>[number]) => boolean) =>
    customers ? customers.filter(fn).length : undefined;
  const inCatalog = (categories: string[]) =>
    professionals
      ? professionals.filter((p) => categories.includes(p.category)).length
      : undefined;

  const tiles: { label: string; value: number | undefined; note: string }[] = [
    { label: "Företagskonton", value: count((c) => c.role === "company"), note: "Bolag med konto på plattformen." },
    { label: "Rådgivarkonton", value: count((c) => c.role === "advisor"), note: "Verifierade rådgivare med inloggning." },
    { label: "Jurister i katalogen", value: inCatalog(["affarsjurist", "rekonstruktor"]), note: "Jurister och rekonstruktörer." },
    { label: "Revisorer i katalogen", value: inCatalog(["revisor"]), note: "Granskning och kontrollbalansräkning." },
  ];

  return (
    <section aria-labelledby="platform-heading">
      <h2
        id="platform-heading"
        className="flex items-center gap-2 text-lg font-semibold text-foreground"
      >
        <Users className="h-5 w-5 text-accent" aria-hidden="true" />
        Plattformen just nu
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col rounded-md border border-border bg-card p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {tile.label}
            </span>
            <span className="mt-1 text-3xl font-semibold tabular-nums text-foreground">
              {tile.value ?? "–"}
            </span>
            <span className="mt-1 text-sm text-muted-foreground">{tile.note}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

const AdminOverview = () => {
  const now = new Date();

  const { data: messages } = useQuery({
    queryKey: ["admin-contact"],
    queryFn: () => data.contact.listAll(),
  });
  const { data: applications } = useQuery({
    queryKey: ["admin-applications"],
    queryFn: () => data.applications.listAll(),
  });
  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: () => data.billing.listCustomers(),
  });
  const { data: outbox } = useQuery({
    queryKey: ["outbox"],
    queryFn: () => data.billing.listOutbox(),
  });
  const { data: secrets, isLoading: secretsLoading } = useQuery({
    queryKey: ["integration-secrets"],
    queryFn: () => data.ops.listSecrets(),
  });

  const newMessages = (messages ?? []).filter((m) => m.status === "new").length;
  const pendingApplications = (applications ?? []).filter((a) => a.status === "pending").length;
  const failedEmails = (outbox ?? []).filter((e) => e.status === "failed").length;
  const closedAccounts = (customers ?? []).filter(
    (c) => c.billing && billingState(c.billing, now).status === "closed",
  ).length;

  return (
    <DashboardShell title="Driftpanel">
      <div data-guide="driftpanelen" className="mx-auto max-w-3xl space-y-8">
        <header>
          <h2 className="text-2xl font-semibold text-foreground">Driftpanel</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Systemets läge just nu, och nycklarna till kopplingarna.
          </p>
        </header>

        <section aria-label="Läget just nu" className="grid gap-3 sm:grid-cols-2">
          <StatusCard
            label="Nya meddelanden"
            value={newMessages}
            calm="Inkorgen är tom."
            action="Väntar på svar i inkorgen."
            href="/admin/inkorg"
            urgent
          />
          <StatusCard
            label="Väntande ansökningar"
            value={pendingApplications}
            calm="Inga rådgivare väntar på besked."
            action="Rådgivare väntar på besked."
            href="/admin/ansokningar"
            urgent
          />
          <StatusCard
            label="Misslyckade utskick"
            value={failedEmails}
            calm="Alla mejl har gått fram."
            action="Mejl som inte gått fram - se kunder."
            href="/admin/kunder"
            urgent
          />
          <StatusCard
            label="Stängda konton"
            value={closedAccounts}
            calm="Inga konton är stängda."
            action="Stängda för obetald faktura. Inget raderat."
            href="/admin/kunder"
            urgent={false}
          />
        </section>

        <PlatformSection />

        <NorthStarSection />

        <ClaimsSection />

        <CompanyPlanSection />

        <PlanSection />

        <FeeSection />

        <RetentionSection />

        <section aria-labelledby="api-keys-heading">
          <h2
            id="api-keys-heading"
            className="flex items-center gap-2 text-lg font-semibold text-foreground"
          >
            <KeyRound className="h-5 w-5 text-accent" aria-hidden="true" />
            API-nycklar
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            En sparad nyckel kan aldrig läsas tillbaka här – bara bytas eller tas
            bort. Panelen visar de fyra sista tecknen så att du kan känna igen
            vilken nyckel som sitter i, inget mer.
          </p>
          {secretsLoading ? (
            <Loader2 className="mt-4 h-5 w-5 animate-spin text-accent" aria-hidden="true" />
          ) : (
            <ul className="mt-4 space-y-3">
              {PROVIDERS.map((provider) => (
                <ProviderRow
                  key={provider.id}
                  provider={provider}
                  stored={(secrets ?? []).find((s) => s.provider === provider.id)}
                />
              ))}
            </ul>
          )}
          <p className="mt-4 flex items-start gap-2 rounded-md bg-secondary/40 p-3 text-xs leading-relaxed text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            <span>
              Nyckeln börjar användas av den dagliga körningen direkt efter bytet.
              Kopplingar utan avtal listas under{" "}
              <Link to="/dashboard/dokument" className="underline">
                integrationsöversikten
              </Link>{" "}
              som &quot;Inom kort&quot; tills avtal och nyckel finns.
            </span>
          </p>
        </section>
      </div>
    </DashboardShell>
  );
};

export default AdminOverview;
