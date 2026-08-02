import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { data } from "@/data";
import { billingState } from "@/lib/billing";
import { ProviderLogo } from "@/components/integrations/ProviderLogo";
import type { ProfessionalTerms, ProfileClaimForReview, SecretInfo } from "@/data/types";
import {
  AlertTriangle,
  Banknote,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  KeyRound,
  Loader2,
  Trash2,
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
  { id: "bankid", name: "BankID", note: "Underskrift av styrelsedokument." },
  { id: "ses", name: "E-postutskick (SES)", note: "Arbetarens avsändarkonto för fakturor och påminnelser." },
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
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <h1 className="text-2xl font-semibold text-foreground">Driftpanel</h1>
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

        <ClaimsSection />

        <FeeSection />

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
