import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { data } from "@/data";
import { billingState, TRIAL_DAYS } from "@/lib/billing";
import { missingInvoiceFields } from "@/lib/company";
import {
  formatOre,
  invoiceTotals,
  missingBuyerFields,
  PAYMENT_TERMS_DAYS,
  VAT_RATE,
} from "@/lib/invoice";
import type { CustomerOverview, OutboundEmailRecord } from "@/data/types";
import { AlertTriangle, Loader2, Lock, Mail, ShieldOff } from "lucide-react";

/**
 * Drift: kunder, deras läge och deras fakturor.
 *
 * Två saker som sidan gör och som är lätta att missa varför:
 *
 *  1. Den vägrar ställa ut fakturor så länge bolagsuppgifterna inte är
 *     kompletta. En faktura utan momsregistreringsnummer eller med tomt
 *     betalkonto är ett dokument mottagaren varken kan bokföra eller betala,
 *     och den skickas hellre aldrig än i efterhand krediteras.
 *
 *  2. Den visar summan innan man trycker. En avgift skriven i kronor och
 *     lagrad i ören är precis den sortens omvandling som blir hundra gånger
 *     fel utan att någon märker det förrän fakturan är hos kunden.
 */

const swedishDate = (iso: string) =>
  new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });

const DAY_MS = 24 * 60 * 60 * 1000;

const statusLabel = (customer: CustomerOverview): { text: string; tone: string } => {
  if (!customer.billing) return { text: "Ingen kontorad", tone: "text-muted-foreground" };
  const state = billingState(customer.billing, new Date());
  switch (state.status) {
    case "active":
      return { text: "Betalt", tone: "text-success" };
    case "closed":
      return { text: "Stängt", tone: "text-destructive" };
    case "invoiced":
      return { text: `Fakturerad, ${state.daysLeft} dagar kvar`, tone: "text-warning" };
    default:
      return { text: `Gratisperiod, ${state.daysLeft} dagar kvar`, tone: "text-muted-foreground" };
  }
};

const CustomerRow = ({ customer }: { customer: CustomerOverview }) => {
  const queryClient = useQueryClient();
  const [amountKr, setAmountKr] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  /*
   * Köparens adress.
   *
   * Plattformen frågar aldrig efter kundens faktureringsadress - varken
   * onboardingen eller inställningarna samlar in den. Ändå är den ett
   * formkrav: 17 kap. 24 § 5 mervärdesskattelagen kräver båda parternas
   * namn OCH adress. Fram till att fältet finns i kundens egen profil
   * skrivs den in här, av den som ställer ut fakturan.
   */
  const [buyerAddress, setBuyerAddress] = useState("");
  const [buyerOrgNumber, setBuyerOrgNumber] = useState("");

  const buyerName = customer.displayName?.trim() ?? "";
  const sellerBlockers = missingInvoiceFields();
  const buyerBlockers = missingBuyerFields({
    name: buyerName,
    orgNumber: buyerOrgNumber.trim() || null,
    email: customer.email ?? "",
    address: buyerAddress.trim() || null,
  });
  const blockers = [...sellerBlockers, ...buyerBlockers];
  const canInvoice = blockers.length === 0;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    queryClient.invalidateQueries({ queryKey: ["my-invoices"] });
    queryClient.invalidateQueries({ queryKey: ["my-billing"] });
    // Fakturering och stängning köar mejl - utan den här raden ser panelen
    // tom ut tills man laddar om sidan, och drift tror att inget gick ut.
    queryClient.invalidateQueries({ queryKey: ["outbox"] });
  };

  const issue = useMutation({
    mutationFn: () => {
      // Kronor in, ören lagrat. Omvandlingen sker här, en gång, och summorna
      // kommer från samma funktion som fakturadokumentet använder.
      const netOre = Math.round(Number(amountKr.replace(/\s/g, "").replace(",", ".")) * 100);
      const totals = invoiceTotals([{ description, quantity: 1, unitPriceOre: netOre }], VAT_RATE);
      return data.billing.issueInvoice({
        userId: customer.userId,
        description: description.trim(),
        netOre: totals.netOre,
        vatOre: totals.vatOre,
        vatRate: VAT_RATE,
        dueAt: new Date(Date.now() + PAYMENT_TERMS_DAYS * DAY_MS).toISOString(),
        customerName: buyerName,
        customerOrgNumber: buyerOrgNumber.trim() || null,
        customerAddress: buyerAddress.trim(),
        // Perioden lämnas öppen tills abonnemangsperioden finns i modellen.
        // Hellre ingen uppgift än en påhittad: se InvoiceInput.period.
        periodStart: null,
        periodEnd: null,
        recipientEmail: customer.email,
      });
    },
    onSuccess: () => {
      setAmountKr("");
      setDescription("");
      setBuyerAddress("");
      setBuyerOrgNumber("");
      refresh();
    },
  });

  const pay = useMutation({
    mutationFn: (invoiceId: string) =>
      data.billing.registerPayment({
        invoiceId,
        paidAt: new Date().toISOString(),
        reference: reference.trim() || null,
        recipientEmail: customer.email,
      }),
    onSuccess: () => {
      setReference("");
      refresh();
    },
  });

  const close = useMutation({
    mutationFn: () => data.billing.closeAccount(customer.userId),
    onSuccess: refresh,
  });

  const status = statusLabel(customer);
  const netOre = Math.round(Number(amountKr.replace(/\s/g, "").replace(",", ".")) * 100);
  const preview =
    Number.isFinite(netOre) && netOre > 0
      ? invoiceTotals([{ description, quantity: 1, unitPriceOre: netOre }], VAT_RATE)
      : null;

  return (
    <li className="rounded-md border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground">
            {customer.displayName || customer.email || customer.userId.slice(0, 8)}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {customer.role === "advisor" ? "Rådgivare" : "Företagare"}
            {customer.billing && <> · startade {swedishDate(customer.billing.startedAt)}</>}
          </p>
        </div>
        <span className={`flex-shrink-0 text-sm font-medium ${status.tone}`}>{status.text}</span>
      </div>

      {customer.invoices.length > 0 && (
        <ul className="mt-4 divide-y divide-border rounded-md border border-border text-sm">
          {customer.invoices.map((invoice) => (
            <li key={invoice.id} className="flex flex-wrap items-center gap-3 p-3">
              <span className="min-w-0 flex-1">
                <span className="font-medium text-foreground">{invoice.invoiceNumber}</span>{" "}
                <span className="text-muted-foreground">
                  {invoice.description} · {formatOre(invoice.grossOre)}
                </span>
              </span>
              {invoice.status === "paid" ? (
                <span className="flex-shrink-0 text-success">
                  Betald {invoice.paidAt ? swedishDate(invoice.paidAt) : ""}
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pay.isPending}
                  onClick={() => pay.mutate(invoice.id)}
                >
                  Registrera betalning
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 space-y-3 rounded-md bg-secondary/40 p-4">
        {!canInvoice && (
          <p className="flex gap-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span>
              Kan inte fakturera än. Saknas: {blockers.join(", ")}.{" "}
              {sellerBlockers.length > 0 && (
                <>
                  Säljarens uppgifter fylls i{" "}
                  <code className="text-xs">src/lib/company.ts</code>.{" "}
                </>
              )}
              {buyerBlockers.length > 0 && <>Köparens uppgifter fylls i fälten nedan.{" "}</>}
              En faktura utan dem går varken att bokföra eller betala.
            </span>
          </p>
        )}
        {/* Köparens uppgifter FÖRST, och aldrig låsta av sin egen brist:
            ett adressfält som är utgråat för att adressen saknas är en
            återvändsgränd, inte en spärr. */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={buyerAddress}
            onChange={(e) => setBuyerAddress(e.target.value)}
            placeholder="Köparens adress (krav på fakturan)"
            aria-label="Köparens adress"
          />
          <Input
            value={buyerOrgNumber}
            onChange={(e) => setBuyerOrgNumber(e.target.value)}
            placeholder="Köparens org.nr (frivilligt)"
            aria-label="Köparens organisationsnummer"
            className="sm:w-60"
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Vad avser fakturan?"
            aria-label="Beskrivning"
            disabled={!canInvoice}
          />
          <Input
            value={amountKr}
            onChange={(e) => setAmountKr(e.target.value)}
            placeholder="Belopp exkl. moms"
            inputMode="decimal"
            aria-label="Belopp i kronor exklusive moms"
            className="sm:w-52"
            disabled={!canInvoice}
          />
          <Button
            variant="accent"
            disabled={!canInvoice || !description.trim() || !preview || issue.isPending}
            onClick={() => issue.mutate()}
          >
            {issue.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Ställ ut faktura
          </Button>
        </div>
        {preview && (
          <p className="text-sm text-muted-foreground">
            {formatOre(preview.netOre)} + moms {formatOre(preview.vatOre)} ={" "}
            <span className="font-medium text-foreground">{formatOre(preview.grossOre)}</span>.
            Förfaller om {PAYMENT_TERMS_DAYS} dagar.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Betalningsreferens (frivillig)"
            aria-label="Betalningsreferens"
            className="sm:w-72"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={close.isPending}
            onClick={() => close.mutate()}
          >
            <Lock className="h-4 w-4" aria-hidden="true" />
            Stäng kontot
          </Button>
          <span className="text-xs text-muted-foreground">
            Stängning låser åtkomsten. Inget material raderas.
          </span>
        </div>
        {(issue.isError || pay.isError || close.isError) && (
          <p className="text-sm text-destructive" role="alert">
            Åtgärden gick inte igenom. Kontrollera att du har driftbehörighet.
          </p>
        )}
      </div>
    </li>
  );
};

const OUTBOX_STATUS: Record<OutboundEmailRecord["status"], { label: string; tone: string }> = {
  pending: { label: "Väntar", tone: "text-warning" },
  sent: { label: "Skickat", tone: "text-success" },
  failed: { label: "Misslyckat", tone: "text-destructive" },
};

/**
 * Utkorgen, som drift ser den.
 *
 * Finns för att skillnaden mellan "skickat" och "misslyckat fem gånger"
 * annars är osynlig tills kunden hör av sig - eller inte hör av sig, vilket
 * för en faktura är värre.
 */
const OutboxPanel = () => {
  const queryClient = useQueryClient();
  const { data: outbox, isLoading } = useQuery({
    queryKey: ["outbox"],
    queryFn: () => data.billing.listOutbox(),
  });

  // Omskicket nollställer räknaren men behåller felet i historiken tills
  // nästa försök - beslutet "en människa tittar först" ligger i databasen.
  const retry = useMutation({
    mutationFn: (id: string) => data.billing.retryEmail(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["outbox"] }),
  });

  const failedCount = (outbox ?? []).filter((m) => m.status === "failed").length;

  return (
    <section className="mt-12">
      <h2 className="flex items-center gap-2 font-display text-xl text-foreground">
        <Mail className="h-5 w-5 text-accent" aria-hidden="true" />
        Utgående e-post
        {failedCount > 0 && (
          <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
            {failedCount} kräver åtgärd
          </span>
        )}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Fakturor och kvitton köas här och skickas av e-postarbetaren. En rad som
        misslyckats fem gånger stannar som misslyckad tills en människa tittar.
      </p>
      {isLoading ? (
        <Loader2 className="mt-4 h-5 w-5 animate-spin text-accent" aria-hidden="true" />
      ) : (outbox ?? []).length === 0 ? (
        <p className="mt-4 rounded-md border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
          Inget i utkorgen.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-md border border-border text-sm">
          {(outbox ?? []).slice(0, 20).map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 p-3">
              <span className="min-w-0 flex-1">
                <span className="font-medium text-foreground">{m.recipient}</span>{" "}
                <span className="text-muted-foreground">· {m.subject}</span>
                {m.lastError && (
                  <span className="mt-0.5 block break-words text-xs text-destructive">
                    {m.lastError}
                  </span>
                )}
              </span>
              <span className={`flex-shrink-0 text-xs font-medium ${OUTBOX_STATUS[m.status].tone}`}>
                {OUTBOX_STATUS[m.status].label}
                {m.attempts > 1 && ` (försök ${m.attempts})`}
              </span>
              {m.status === "failed" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={retry.isPending}
                  onClick={() => retry.mutate(m.id)}
                >
                  Skicka igen
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const AdminCustomers = () => {
  const { data: isAdmin, isLoading: checking } = useQuery({
    queryKey: ["am-i-admin"],
    queryFn: () => data.contact.amIAdmin(),
  });

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: () => data.billing.listCustomers(),
    enabled: isAdmin === true,
  });

  return (
    <DashboardShell title="Kunder">
      <div data-guide="kundvyn">
      {checking ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden="true" />
        </div>
      ) : !isAdmin ? (
        <div className="max-w-xl rounded-md border border-border bg-card p-6">
          <ShieldOff className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-4 font-display text-xl text-foreground">Kräver driftbehörighet</h2>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            Behörighet tilldelas direkt i databasen. Det finns med flit ingen väg att
            begära den härifrån.
          </p>
          <Button variant="outline" className="mt-6" asChild>
            <Link to="/dashboard">Till översikten</Link>
          </Button>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden="true" />
        </div>
      ) : (
        <div className="max-w-4xl">
          <p className="text-muted-foreground">
            Gratisperioden är {TRIAL_DAYS} dagar. Betalningsvillkor {PAYMENT_TERMS_DAYS} dagar.
            Betalningar registreras här när de syns på kontot.
          </p>
          {(customers ?? []).length === 0 ? (
            <p className="mt-8 rounded-md border border-border bg-secondary/40 p-8 text-center text-muted-foreground">
              Inga kunder än.
            </p>
          ) : (
            <ul className="mt-6 space-y-4">
              {(customers ?? []).map((customer) => (
                <CustomerRow key={customer.userId} customer={customer} />
              ))}
            </ul>
          )}
          <OutboxPanel />
        </div>
      )}
      </div>
    </DashboardShell>
  );
};

export default AdminCustomers;
