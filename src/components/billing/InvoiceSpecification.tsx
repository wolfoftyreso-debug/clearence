import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { data } from "@/data";
import { buildInvoiceDocument, invoiceFromCustomerRecord } from "@/lib/reports/invoiceDocuments";
import {
  buildInvoiceSpecification,
  forwardMessage,
  invoiceFileName,
} from "@/lib/invoiceSpecification";
import { renderReportPdf } from "@/lib/reports/pdf";
import { useInlineReport } from "@/components/reports/useInlineReport";
import type { CustomerInvoiceRecord } from "@/data/types";
import { Check, FileText, Paperclip, Send } from "lucide-react";

/**
 * Fakturan, hel.
 *
 * Tre saker ska gå att göra med en faktura, och alla tre går via samma
 * underlag: LÄSA den (moms, villkor, konto), LÄGGA den i akten, och
 * SKICKA den vidare till den som ska bokföra den.
 *
 * Specifikationen byggs ur samma modell som PDF:en. En skärm som räknar
 * själv kan visa ett annat belopp än filen kunden får - och två olika
 * belopp på samma faktura gör den obetalbar för båda parter.
 */
export const InvoiceSpecification = ({ invoice }: { invoice: CustomerInvoiceRecord }) => {
  const { open: openInline, viewer } = useInlineReport();
  const [recipient, setRecipient] = useState("");
  const [sent, setSent] = useState(false);
  const [attached, setAttached] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => data.profile.getMine(),
    retry: false,
  });
  // Adressen kommer ur inloggningen, inte ur profilen: profilen bär namn
  // och roll, aldrig e-posten.
  const { data: authUser } = useQuery({
    queryKey: ["auth-user"],
    queryFn: () => data.auth.getCurrentUser(),
    retry: false,
  });
  const { data: caseRecord } = useQuery({
    queryKey: ["latest-case"],
    queryFn: () => data.cases.getLatest(),
    retry: false,
  });

  const model = invoiceFromCustomerRecord(invoice, {
    name: profile?.displayName ?? "Kund",
    email: authUser?.email ?? "",
  });
  const spec = buildInvoiceSpecification(model, invoice.paymentReference);
  const document_ = buildInvoiceDocument(model);

  /** PDF:ens bytes. Samma fil oavsett om den visas, bifogas eller skickas. */
  const pdfFile = (): File =>
    new File([renderReportPdf(document_) as BlobPart], invoiceFileName(spec.invoiceNumber), {
      type: "application/pdf",
    });

  const attach = useMutation({
    mutationFn: async () => {
      if (!caseRecord) throw new Error("Inget ärende att lägga fakturan i.");
      await data.documents.upload({
        caseId: caseRecord.id,
        kind: "other",
        file: pdfFile(),
        // Filen är skapad av produkten, men källan i datamodellen beskriver
        // hur den kom IN i akten - och den lades in för hand, av en
        // användare som klickade.
        source: "manual",
        note: `Faktura ${spec.invoiceNumber}`,
        userId: authUser?.id ?? "",
      });
    },
    onSuccess: () => { setAttached(true); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const forward = useMutation({
    mutationFn: async () => {
      const message = forwardMessage(spec);
      // Mejlklienten öppnas med allt ifyllt. Bilagan kan inte följa med
      // via mailto - därför laddas PDF:en ner samtidigt, och texten säger
      // att den ska bifogas. Att tyst skicka utan bilaga vore att lova
      // något som inte händer.
      const url = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(message.subject)}&body=${encodeURIComponent(message.body)}`;
      const file = pdfFile();
      const href = URL.createObjectURL(file);
      const link = window.document.createElement("a");
      link.href = href;
      link.download = file.name;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(href), 10_000);
      window.location.href = url;
    },
    onSuccess: () => { setSent(true); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right text-xs font-medium text-foreground">{value}</dd>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Parterna */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border border-border p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Säljare</p>
          <p className="mt-1 text-sm font-medium text-foreground">{spec.seller.name}</p>
          <p className="text-xs text-muted-foreground">Org.nr {spec.seller.orgNumber}</p>
          <p className="text-xs text-muted-foreground">Momsreg.nr {spec.seller.vatNumber}</p>
          <p className="text-xs text-muted-foreground">Säte: {spec.seller.office}</p>
        </div>
        <div className="rounded-md border border-border p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Köpare</p>
          <p className="mt-1 text-sm font-medium text-foreground">{spec.customer.name}</p>
          {spec.customer.orgNumber && (
            <p className="text-xs text-muted-foreground">Org.nr {spec.customer.orgNumber}</p>
          )}
          {spec.customer.email && <p className="text-xs text-muted-foreground">{spec.customer.email}</p>}
        </div>
      </div>

      {/* Fakturauppgifterna */}
      <dl className="rounded-md border border-border p-3">
        <Row label="Fakturanummer" value={spec.invoiceNumber} />
        <Row label="Fakturadatum" value={spec.issued} />
        <Row label="Förfallodag" value={spec.due} />
        <Row label="Betalningsvillkor" value={spec.terms} />
        <Row label="Betalningsreferens" value={spec.reference} />
      </dl>

      {/* Raderna, och momsen per sats */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-xs">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-1.5 font-medium">Beskrivning</th>
              <th className="py-1.5 text-right font-medium">Antal</th>
              <th className="py-1.5 text-right font-medium">À-pris</th>
              <th className="py-1.5 text-right font-medium">Belopp</th>
            </tr>
          </thead>
          <tbody>
            {spec.lines.map((line) => (
              <tr key={line.description} className="border-b border-border/60">
                <td className="py-1.5 text-foreground">{line.description}</td>
                <td className="py-1.5 text-right tabular-nums text-foreground">{line.quantity}</td>
                <td className="py-1.5 text-right tabular-nums text-foreground">{line.unitPrice}</td>
                <td className="py-1.5 text-right tabular-nums text-foreground">{line.net}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="py-1.5 text-right text-muted-foreground">
                Summa exklusive moms
              </td>
              <td className="py-1.5 text-right tabular-nums text-foreground">{spec.net}</td>
            </tr>
            {spec.vatBands.map((band) => (
              <tr key={band.rate}>
                <td colSpan={3} className="py-1.5 text-right text-muted-foreground">
                  Moms {band.rate} på {band.base}
                </td>
                <td className="py-1.5 text-right tabular-nums text-foreground">{band.amount}</td>
              </tr>
            ))}
            <tr className="border-t border-border">
              <td colSpan={3} className="py-2 text-right text-sm font-semibold text-foreground">
                Att betala
              </td>
              <td className="py-2 text-right text-sm font-semibold tabular-nums text-foreground">
                {spec.gross}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Betalningen */}
      <div className="rounded-md bg-secondary/50 p-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Betalas till</p>
        <dl className="mt-1">
          {spec.paymentAccounts.map((account) => (
            <Row key={account.label} label={account.label} value={account.number} />
          ))}
          <Row label="Ange referens" value={spec.reference} />
        </dl>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{spec.vatNote}</p>
      </div>

      {/* De tre sakerna man vill göra med en faktura */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => openInline(document_)}>
          <FileText className="h-4 w-4" aria-hidden="true" />
          Öppna som PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={attach.isPending || attached || !caseRecord}
          onClick={() => attach.mutate()}
        >
          {attached ? <Check className="h-4 w-4" aria-hidden="true" /> : <Paperclip className="h-4 w-4" aria-hidden="true" />}
          {attached ? "Ligger i akten" : "Bifoga i ärendet"}
        </Button>
      </div>

      {/* Vidarebefordran: oftast till bokföraren. */}
      <div className="rounded-md border border-border p-3">
        <p className="text-sm font-medium text-foreground">Skicka vidare</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          Till den som bokför eller betalar. Mejlet öppnas med belopp, förfallodag och konto
          ifyllt, och fakturan laddas ner så att du kan bifoga den.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input
            type="email"
            value={recipient}
            onChange={(e) => { setRecipient(e.target.value); setSent(false); }}
            placeholder="bokforing@byra.se"
            aria-label="Mottagarens e-postadress"
            className="w-56"
          />
          <Button
            variant="accent"
            size="sm"
            disabled={!recipient.includes("@") || forward.isPending}
            onClick={() => forward.mutate()}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            Skicka vidare
          </Button>
          {sent && <span className="text-xs text-muted-foreground">Mejlet är öppnat och filen nedladdad.</span>}
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {viewer}
    </div>
  );
};
