import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WizardCard, WizardCardHeader } from "@/components/wizard/WizardCard";
import { useAuth } from "@/hooks/useAuth";
import { data } from "@/data";
import { billingMessage, billingState, TRIAL_DAYS } from "@/lib/billing";
import { COMPANY, paymentAccounts } from "@/lib/company";
import { formatOre, VAT_RATE } from "@/lib/invoice";
import { buildInvoiceDocument, buildReceiptDocument } from "@/lib/reports/invoiceDocuments";
import { useInlineReport } from "@/components/reports/useInlineReport";
import type { CustomerInvoiceRecord } from "@/data/types";
import { CheckCircle2, Download, Loader2, Receipt } from "lucide-react";

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
 * Bygger dokumentet ur den lagrade fakturan.
 *
 * Beloppen läses från raden och räknas inte om. En faktura som skrivs ut om
 * ett år måste visa vad som fakturerades då, inte vad samma tjänst hade
 * kostat idag.
 */
const invoiceFromRecord = (
  record: CustomerInvoiceRecord,
  customer: { name: string; email: string },
) => ({
  invoiceNumber: record.invoiceNumber,
  issuedAt: record.issuedAt,
  dueAt: record.dueAt,
  seller: COMPANY,
  customer: { name: customer.name, orgNumber: null, email: customer.email, address: null },
  lines: [
    {
      description: record.description,
      quantity: 1,
      unitPriceOre: record.netOre,
    },
  ],
  note: null,
  totals: {
    netOre: record.netOre,
    vatOre: record.vatOre,
    grossOre: record.grossOre,
    vatRate: record.vatRate || VAT_RATE,
  },
});

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
    const invoice = invoiceFromRecord(record, { name: customerName, email: user?.email ?? "" });
    openInline(buildInvoiceDocument(invoice));
  };

  const printReceipt = (record: CustomerInvoiceRecord) => {
    if (!record.paidAt || !record.receiptNumber) return;
    const invoice = invoiceFromRecord(record, { name: customerName, email: user?.email ?? "" });
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
      <div className="max-w-3xl space-y-6">
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

        <WizardCard>
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
      </div>
      {reportViewer}
    </DashboardShell>
  );
};

export default DashboardSettings;
