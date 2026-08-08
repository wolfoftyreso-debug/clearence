import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WizardCard, WizardCardHeader } from "@/components/wizard/WizardCard";
import { useAuth } from "@/hooks/useAuth";
import { data } from "@/data";
import { billingMessage, billingState, TRIAL_DAYS } from "@/lib/billing";
import { paymentAccounts } from "@/lib/company";
import { formatOre } from "@/lib/invoice";
import { buildInvoiceDocument, buildReceiptDocument, invoiceFromCustomerRecord } from "@/lib/reports/invoiceDocuments";
import { useInlineReport } from "@/components/reports/useInlineReport";
import { LanguageLevelPicker } from "@/components/language/GlossaryText";
import {
  AccountSecuritySection,
  ActiveCaseSection,
  NotificationSection,
  PresentationSection,
} from "@/components/settings/PreferenceSections";
import { AlertChannelSection, AlertHistorySection } from "@/components/settings/AlertChannels";
import type { CustomerInvoiceRecord } from "@/data/types";
import { LockedFeature, useEntitlements } from "@/components/billing/LockedFeature";
import { Link } from "react-router";
import { buildMyDataExport } from "@/lib/dataExport";
import { downloadTextFile } from "@/lib/integrations/download";
import { CheckCircle2, Copy, Download, KeyRound, Loader2, Receipt, ShieldCheck } from "lucide-react";

/**
 * Kontot: uppgifter, läge och alla fakturor och kvitton.
 *
 * Kvittot ska finnas i inloggningen och inte bara i ett mejl. Det var
 * uttryckligen bestämt, och det är också det som gör att en kund som byter
 * e-postadress eller tappar ett mejl fortfarande kan visa vad som betalats.
 */

const swedishDate = (iso: string) =>
  new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });

const STATUS_LABEL: Record<CustomerInvoiceRecord["status"], string> = {
  issued: "Obetald",
  paid: "Betald",
  cancelled: "Makulerad",
};

/**
 * API-nycklarna för det öppna API:t. Valvets regler i gränssnittet:
 * hemligheten visas EN gång vid skapandet och kan därefter aldrig
 * läsas igen - bara återkallas. Bakom betalväggen: API-åtkomst är
 * delning av ärendedata till externa system.
 */
const ApiKeysSection = () => {
  const queryClient = useQueryClient();
  const { ready, exportAndSharing } = useEntitlements();
  const [label, setLabel] = useState("");
  const [freshSecret, setFreshSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: keys } = useQuery({
    queryKey: ["my-api-keys"],
    queryFn: () => data.apiKeys.listMine(),
    enabled: ready && exportAndSharing,
  });

  const create = useMutation({
    mutationFn: (l: string) => data.apiKeys.create(l),
    onSuccess: (result) => {
      setLabel("");
      setFreshSecret(result.secret);
      setCopied(false);
      queryClient.invalidateQueries({ queryKey: ["my-api-keys"] });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => data.apiKeys.revoke(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-api-keys"] }),
  });

  if (ready && !exportAndSharing) {
    return <LockedFeature title="API-nycklar för det öppna API:t" />;
  }

  return (
    <WizardCard data-guide="api-nycklar">
      <WizardCardHeader
        title="API-nycklar"
        description="För att koppla egna system till det öppna API:t. Nyckeln visas en enda gång när den skapas – därefter kan den aldrig läsas igen, bara bytas ut."
      />
      <p className="text-sm text-muted-foreground">
        Vad API:t kan göra står på{" "}
        <Link to="/api" className="font-medium text-accent underline-offset-4 hover:underline">
          utvecklarsidan
        </Link>
        . Nyckeln ser exakt det ditt konto ser – varken mer eller mindre.
      </p>

      {freshSecret && (
        <div className="mt-4 rounded-md border border-warning/50 bg-warning/10 p-4">
          <p className="text-sm font-semibold text-foreground">
            Här är din nya nyckel – spara den nu.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Av säkerhetsskäl visas den aldrig igen. Tappas den bort återkallar du
            den och skapar en ny.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code data-fresh-secret className="min-w-0 break-all rounded-sm bg-card px-2 py-1 text-sm text-foreground">
              {freshSecret}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard?.writeText(freshSecret).then(() => setCopied(true));
              }}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              {copied ? "Kopierad" : "Kopiera"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setFreshSecret(null)}>
              Jag har sparat den
            </Button>
          </div>
        </div>
      )}

      <form
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const l = label.trim();
          if (l.length >= 3) create.mutate(l);
        }}
      >
        <label htmlFor="api-key-label" className="sr-only">
          Vad nyckeln ska användas till
        </label>
        <Input
          id="api-key-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="T.ex. Byråsystemet eller Ekonomisystemet"
          className="min-w-0 flex-1"
        />
        <Button type="submit" variant="accent" disabled={label.trim().length < 3 || create.isPending}>
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          Skapa nyckel
        </Button>
      </form>

      {(keys ?? []).length > 0 && (
        <ul className="mt-4 divide-y divide-border/60">
          {(keys ?? []).map((k) => (
            <li key={k.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <code className="text-sm text-foreground">{k.keyPrefix}…</code>
              <span className="min-w-0 flex-1 text-sm text-muted-foreground">{k.label}</span>
              {k.revokedAt ? (
                <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Återkallad
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => revoke.mutate(k.id)}
                  disabled={revoke.isPending}
                  className="text-xs font-medium text-destructive underline-offset-4 hover:underline"
                >
                  Återkalla
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </WizardCard>
  );
};

/**
 * DATASKYDD OCH RÄTTIGHETER (GDPR art. 15–20).
 *
 * Tre rättigheter, tre vägar, alla ärliga:
 *  - REGISTERUTDRAG / DATAPORTABILITET: laddas ned direkt som JSON, byggt
 *    lokalt ur samma läsvägar som appen använder (buildMyDataExport).
 *  - RÄTTELSE: namn och telefon ändras i "Dina uppgifter" ovan.
 *  - RADERING: en formell begäran via kontaktkanalen (ämne Personuppgifter),
 *    med rakt besked om vad som MÅSTE sparas (fakturor/bokföring, händelse-
 *    loggens spårbarhet) och vad som gallras enligt policyn.
 */
const DataskyddSection = () => {
  const { user } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const [done, setDone] = useState(false);

  const exportMyData = async () => {
    setDownloading(true);
    setDone(false);
    try {
      const [profil, ekonomi, aviseringar, arenden] = await Promise.all([
        data.profile.getMine(),
        data.billing.getMine().catch(() => null),
        data.notificationSettings.getPrefs().catch(() => null),
        data.cases.listMine().catch(() => []),
      ]);
      const { data: payload, fileName } = buildMyDataExport(
        { epost: user?.email ?? null, profil, ekonomi, aviseringar, arenden },
        new Date().toISOString(),
      );
      downloadTextFile(JSON.stringify(payload, null, 2), fileName, "application/json");
      setDone(true);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <WizardCard data-guide="dataskydd">
      <WizardCardHeader
        title="Dataskydd och dina rättigheter"
        description="Du bestämmer över dina uppgifter. Här ser du vad vi har, kan ta med dig det, och kan begära rättelse eller radering."
      />
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <div>
          <p className="font-medium text-foreground">Registerutdrag och dataportabilitet</p>
          <p className="mt-1">
            Ladda ner de personuppgifter kontot äger, i ett maskinläsbart format
            (JSON) du kan ta med dig. Filen byggs lokalt i din webbläsare.
          </p>
          <div className="mt-2 flex items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => void exportMyData()} disabled={downloading}>
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )}
              Ladda ner mina uppgifter
            </Button>
            {done && (
              <span className="flex items-center gap-1.5 text-success">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Nedladdad
              </span>
            )}
          </div>
        </div>

        <div>
          <p className="font-medium text-foreground">Rättelse</p>
          <p className="mt-1">
            Namn och telefon ändrar du under <span className="font-medium text-foreground">Dina uppgifter</span> ovan.
            Uppgifter i ett ärende rättas i ärendet.
          </p>
        </div>

        <div>
          <p className="font-medium text-foreground">Radering</p>
          <p className="mt-1">
            Du kan begära att dina uppgifter raderas. Vi är raka med vad som ändå
            måste sparas: fakturor och bokföringsunderlag har egna lagringskrav,
            och händelseloggen behålls för spårbarhet. Resten raderas eller
            anonymiseras enligt gallringspolicyn.
          </p>
          <Link
            to="/kontakt?amne=dataskydd"
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-accent underline-offset-4 hover:underline"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Begär radering eller registerutdrag
          </Link>
        </div>
      </div>
    </WizardCard>
  );
};

const DashboardSettings = () => {
  const { open: openInline, viewer: reportViewer } = useInlineReport();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => data.profile.getMine(),
  });

  const { data: billing } = useQuery({
    queryKey: ["my-billing"],
    queryFn: () => data.billing.getMine(),
    retry: false,
  });

  const { data: invoices, isLoading: loadingInvoices } = useQuery({
    queryKey: ["my-invoices"],
    queryFn: () => data.billing.listMyInvoices(),
  });

  // "Se fakturor" i bannern länkar hit med #fakturor. Rulla fram avsnittet
  // när det finns - annars pekar knappen på sidan man redan står på och
  // ingenting händer, vilket är precis det som fick fakturan att kännas
  // oklickbar. Kör om när fakturorna laddats så elementet har sin höjd.
  const { hash } = useLocation();
  useEffect(() => {
    if (hash !== "#fakturor") return;
    const el = document.getElementById("fakturor");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash, invoices, loadingInvoices]);

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");

  // Fälten fylls när profilen kommit in, men skriver inte över något
  // användaren redan hunnit ändra.
  useEffect(() => {
    if (!profile) return;
    setDisplayName((current) => current || profile.displayName || "");
    setPhone((current) => current || profile.phone || "");
  }, [profile]);

  const saveProfile = useMutation({
    mutationFn: () =>
      data.profile.update({
        displayName: displayName.trim() || null,
        phone: phone.trim() || null,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-profile"] }),
  });

  const state = billing ? billingState(billing, new Date()) : null;
  const message = state ? billingMessage(state) : null;
  const accounts = paymentAccounts();
  const customerName = profile?.displayName || user?.email || "Kund";

  const printInvoice = (record: CustomerInvoiceRecord) => {
    const invoice = invoiceFromCustomerRecord(record, { name: customerName, email: user?.email ?? "" });
    openInline(buildInvoiceDocument(invoice));
  };

  const printReceipt = (record: CustomerInvoiceRecord) => {
    if (!record.paidAt || !record.receiptNumber) return;
    const invoice = invoiceFromCustomerRecord(record, { name: customerName, email: user?.email ?? "" });
    openInline(
      buildReceiptDocument(invoice, {
        paidAt: record.paidAt,
        reference: record.paymentReference,
        receiptNumber: record.receiptNumber,
      }),
    );
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    saveProfile.mutate();
  };

  return (
    <DashboardShell title="Inställningar">
      <div data-guide="installningsvyn" className="max-w-3xl space-y-6">
        <WizardCard>
          <WizardCardHeader
            title="Språkprofil"
            description="Hur CLEARANCE skriver till dig – i rapporter, analyser och kunskapsbanken. Om en text är svår att förstå är det systemet som ska anpassa sig, inte du."
          />
          <LanguageLevelPicker />
        </WizardCard>

        <PresentationSection />
        <ActiveCaseSection />
        <NotificationSection />

        <AlertChannelSection />

        <AlertHistorySection />
        <ApiKeysSection />

        <WizardCard>
          <WizardCardHeader
            title="Dina uppgifter"
            description="Namnet visas för dem du delar ärendet med och står på fakturan."
          />
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="set-name" className="block text-sm font-medium text-foreground">
                  Namn eller bolag
                </label>
                <Input
                  id="set-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="set-phone" className="block text-sm font-medium text-foreground">
                  Telefon
                </label>
                <Input id="set-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">E-post</label>
              {/* Adressen är inloggningen. Att byta den är en
                  säkerhetsåtgärd med egen verifiering, inte ett fält bland
                  andra - därför låst här. */}
              <Input value={user?.email ?? ""} disabled readOnly />
              <p className="text-xs text-muted-foreground">
                E-postadressen är din inloggning. Vill du byta den, skriv till oss via
                kontaktformuläret så gör vi det med kontroll av att det är du.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" variant="accent" disabled={saveProfile.isPending}>
                {saveProfile.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                Spara
              </Button>
              {saveProfile.isSuccess && (
                <span className="flex items-center gap-1.5 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Sparat
                </span>
              )}
            </div>
          </form>
        </WizardCard>

        <WizardCard>
          <WizardCardHeader
            title="Ditt konto"
            description={`Det är gratis att komma igång i ${TRIAL_DAYS} dagar.`}
          />
          {!billing ? (
            <Loader2 className="h-5 w-5 animate-spin text-accent" aria-hidden="true" />
          ) : (
            <div className="space-y-4">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-4 border-b border-border pb-2">
                  <dt className="text-muted-foreground">Kontot startades</dt>
                  <dd className="font-medium text-foreground">
                    {swedishDate(billing.startedAt)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-border pb-2">
                  <dt className="text-muted-foreground">Läge</dt>
                  <dd className="font-medium text-foreground">
                    {state?.status === "active"
                      ? "Betalt"
                      : state?.status === "closed"
                        ? "Stängt"
                        : state?.status === "invoiced"
                          ? "Faktura skickad"
                          : "Gratisperiod"}
                  </dd>
                </div>
                {state?.deadline && state.status !== "active" && (
                  <div className="flex justify-between gap-4 border-b border-border pb-2">
                    <dt className="text-muted-foreground">
                      {state.status === "closed" ? "Stängdes" : "Sista betalningsdag"}
                    </dt>
                    {/* Fristfärgen. Enda stället i den här vyn den får
                        användas: det är ett datum som räknas ned. */}
                    <dd className="font-medium tabular-nums text-frist">
                      {swedishDate(state.deadline)}
                    </dd>
                  </div>
                )}
              </dl>

              {message && (
                <div
                  className={`rounded-md border p-4 ${
                    message.tone === "critical"
                      ? "border-destructive/40 bg-destructive/10"
                      : "border-warning/40 bg-warning/10"
                  }`}
                >
                  <p className="font-semibold text-foreground">{message.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {message.body}
                  </p>
                </div>
              )}

              {accounts.length > 0 && (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Betalning sker till{" "}
                  {accounts.map((a) => `${a.label.toLowerCase()} ${a.number}`).join(" eller ")}.
                  Ange fakturanumret som referens.
                </p>
              )}
            </div>
          )}
        </WizardCard>

        {/* id="fakturor": "Se fakturor" i bannern rullar hit. Utan ankaret
            pekade knappen på sidan man redan stod på, och ingenting hände -
            fakturan gick inte att klicka upp. */}
        <WizardCard id="fakturor" data-guide="fakturor">
          <WizardCardHeader
            title="Fakturor och kvitton"
            description="Ligger kvar här. Du behöver aldrig leta i mejlen."
          />
          {loadingInvoices ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-accent" aria-hidden="true" />
            </div>
          ) : (invoices ?? []).length === 0 ? (
            <p className="rounded-md border border-border bg-secondary/40 p-6 text-center text-muted-foreground">
              Ingen faktura än.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {(invoices ?? []).map((invoice) => (
                <li key={invoice.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">
                      {invoice.invoiceNumber} · {invoice.description}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {formatOre(invoice.grossOre)} · {STATUS_LABEL[invoice.status]} ·{" "}
                      {invoice.status === "paid" && invoice.paidAt
                        ? `betald ${swedishDate(invoice.paidAt)}`
                        : `förfaller ${swedishDate(invoice.dueAt)}`}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 gap-2">
                    <Button variant="outline" size="sm" onClick={() => printInvoice(invoice)}>
                      <Download className="h-4 w-4" aria-hidden="true" />
                      Faktura
                    </Button>
                    {invoice.status === "paid" && (
                      <Button variant="outline" size="sm" onClick={() => printReceipt(invoice)}>
                        <Receipt className="h-4 w-4" aria-hidden="true" />
                        Kvitto
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </WizardCard>

        <DataskyddSection />

        <AccountSecuritySection />
      </div>
      {reportViewer}
    </DashboardShell>
  );
};

export default DashboardSettings;
