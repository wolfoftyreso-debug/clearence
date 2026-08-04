import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WizardCard, WizardCardHeader } from "@/components/wizard/WizardCard";
import { useAuth } from "@/hooks/useAuth";
import { data } from "@/data";
import type { LeadPreview, LeadSummary } from "@/lib/leadSummary";
import type {
  CustomerInvoiceRecord,
  LeadPreviewRecord,
  ReferralChannel,
  ReferralStatus,
  UsageChargeRecord,
} from "@/data/types";
import { Loader2, LockOpen, Mail, Phone, Globe, Check, X } from "lucide-react";
import { format } from "date-fns";
import { InvoiceSpecification } from "@/components/billing/InvoiceSpecification";
import { sv } from "date-fns/locale";

/**
 * Versionen på villkoren som accepteras vid upplåsning. Stämplas i
 * databasen på förfrågan - vilken text som gällde vid vilket klick ska gå
 * att svara på i efterhand.
 */
const TERMS_VERSION = "2026-08";

/** Öre → "995 kr". Manuell gruppering - sv-SE:s hårda mellanslag ställer till det. */
const kr = (ore: number): string =>
  `${String(Math.round(ore / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`;

const CASE_TYPE_LABEL: Record<string, string> = {
  reconstruction: "Rekonstruktion",
  bankruptcy: "Konkurs",
  stabilize: "Rådgivning",
};

/**
 * Vad kostar upplåsningen? Svaret beror på byråns plan och är alltid
 * synligt INNAN beslutet - transparensprincipen: vad som beställs, vad det
 * kostar, att en faktura skapas och vilka villkor som gäller.
 */
const feeLine = (lead: LeadPreviewRecord): string => {
  if (lead.planKind === "subscription") return "Ingår i ert abonnemang.";
  if (lead.planKind === "enterprise") return "Enligt ert licensavtal.";
  if (lead.unlockFeeSek === null || lead.unlockFeeSek === 0) {
    return "Ingen avgift avtalad ännu - upplåsningen är kostnadsfri tills avtal finns.";
  }
  return `${String(Math.round(lead.unlockFeeSek)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr på nästa samlingsfaktura (10 dagars betalvillkor).`;
};

/** En förfrågan i rådgivarens inkorg: förhandsvisning → upplåsning. */
const LeadCard = ({ lead }: { lead: LeadPreviewRecord }) => {
  const queryClient = useQueryClient();
  const [terms, setTerms] = useState(false);
  const [summary, setSummary] = useState<LeadSummary | null>(null);
  const preview = lead.preview as LeadPreview;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["my-leads"] });
    queryClient.invalidateQueries({ queryKey: ["my-charges"] });
  };
  const unlock = useMutation({
    mutationFn: async () => (await data.leads.unlock(lead.id, TERMS_VERSION)) as LeadSummary,
    onSuccess: (result) => {
      setSummary(result);
      refresh();
    },
  });
  const decline = useMutation({
    mutationFn: () => data.leads.decline(lead.id),
    onSuccess: refresh,
  });
  const revisit = useMutation({
    mutationFn: async () => (await data.leads.getUnlocked(lead.id)) as LeadSummary,
    onSuccess: setSummary,
  });

  const unlocked = lead.status === "unlocked" || summary !== null;

  return (
    <li className="rounded-md border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-foreground">{preview.problemType}</span>
        <Badge variant={lead.status === "sent" ? "secondary" : "outline"}>
          {lead.status === "sent" ? "Ny förfrågan" : lead.status === "unlocked" ? "Upplåst" : "Avböjd"}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {preview.sizeBand ?? "Storlek ej angiven"} · komplexitet {preview.complexity} ·
        brådska: {preview.urgency.toLowerCase()} · {preview.documentCount} dokument
        {preview.documentKinds.length > 0 && ` (${preview.documentKinds.join(", ")})`}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {format(new Date(lead.createdAt), "d MMMM yyyy, HH:mm", { locale: sv })}
      </p>

      {lead.status === "sent" && (
        <div className="mt-3 rounded-md bg-secondary/40 p-3">
          <p className="text-sm text-foreground">{feeLine(lead)}</p>
          <label className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-foreground">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5" />
            <span>
              Jag accepterar CLEARANCE:s villkor för ärendeåtkomst
              (version {TERMS_VERSION}): uppgifterna används endast för att
              bedöma och hantera uppdraget.
            </span>
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={!terms || unlock.isPending} onClick={() => unlock.mutate()}>
              {unlock.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <LockOpen className="h-4 w-4" aria-hidden="true" />
              )}
              Lås upp ärendet
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={decline.isPending} onClick={() => decline.mutate()}>
              Avböj - kostar inget
            </Button>
          </div>
          {(unlock.isError || decline.isError) && (
            <p className="mt-2 text-xs text-destructive" role="alert">
              {unlock.error instanceof Error ? unlock.error.message : "Kunde inte utföra åtgärden."}
            </p>
          )}
        </div>
      )}

      {unlocked && !summary && (
        <Button type="button" variant="outline" size="sm" className="mt-3" disabled={revisit.isPending} onClick={() => revisit.mutate()}>
          Visa den upplåsta sammanfattningen
        </Button>
      )}

      {summary && (
        <div className="mt-3 rounded-md border border-accent/40 bg-accent/5 p-3">
          <p className="font-medium text-foreground">
            {summary.companyName} · {summary.orgNumber}
          </p>
          {summary.contactEmail && (
            <p className="text-sm text-muted-foreground">Kontakt: {summary.contactEmail}</p>
          )}
          <p className="mt-2 text-sm leading-relaxed text-foreground">{summary.situation}</p>
          {summary.reason && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Skäl till kontakten:</span> {summary.reason}
            </p>
          )}
          {summary.keyFigures.length > 0 && (
            <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {summary.keyFigures.map((figure) => (
                <li key={figure.label} className="flex justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">{figure.label}</span>
                  <span className="tabular-nums text-foreground">{figure.value}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Systemanalys: {summary.analysisTitle}.
            {summary.documents.length > 0 && ` Dokument: ${summary.documents.join(", ")}.`}
          </p>
        </div>
      )}
    </li>
  );
};

/**
 * Fakturacentralen: samlingsfakturorna med klickbar specifikation.
 * Varje rad på fakturan är en post i usage_charges - klicket visar
 * datum, tjänst, bolag och koppling, så ingen avgift är otydlig.
 */
const InvoiceRow = ({ invoice, charges }: { invoice: CustomerInvoiceRecord; charges: UsageChargeRecord[] }) => {
  const [open, setOpen] = useState(false);
  const spec = charges.filter((c) => c.invoiceId === invoice.id);
  return (
    <li className="rounded-md border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center justify-between gap-2 p-3 text-left transition-colors hover:bg-secondary/40"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">
            {invoice.invoiceNumber} · {invoice.description}
          </span>
          <span className="block text-xs text-muted-foreground">
            Förfaller {format(new Date(invoice.dueAt), "d MMMM yyyy", { locale: sv })}
            {invoice.status === "paid" && " · betald"}
          </span>
        </span>
        <span className="tabular-nums text-sm font-medium text-foreground">{kr(invoice.grossOre)}</span>
      </button>
      {open && (
        <div className="border-t border-border p-3">
          {/* Fakturan i sin helhet: parter, moms, villkor och konto - och
              de tre saker man faktiskt vill göra med den. Tidigare stod
              här bara att specifikationen "låg utanför" när fakturan
              saknade användningsavgifter, vilket är att svara på en fråga
              med att säga att frågan inte hör hit. */}
          <InvoiceSpecification invoice={invoice} />

          {spec.length > 0 && (
            <>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Underlaget rad för rad
            </p>
            <ul className="mt-1 space-y-1">
              {spec.map((charge) => (
                <li key={charge.id} className="flex flex-wrap justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {format(new Date(charge.createdAt), "yyyy-MM-dd", { locale: sv })} ·{" "}
                    {charge.caseType ? `${CASE_TYPE_LABEL[charge.caseType] ?? charge.caseType} · ` : ""}
                    {charge.companyName ?? "—"}
                    {charge.orgNumber ? ` (${charge.orgNumber})` : ""} · {charge.serviceLabel}
                  </span>
                  <span className="tabular-nums text-foreground">{kr(charge.amountOre)}</span>
                </li>
              ))}
            </ul>
            </>
          )}
        </div>
      )}
    </li>
  );
};

type Channel = ReferralChannel;

const channelIcon: Record<Channel, typeof Mail> = {
  email: Mail,
  phone: Phone,
  website: Globe,
};

const channelLabel: Record<Channel, string> = {
  email: "E-post",
  phone: "Telefon",
  website: "Webbplats",
};

const statusLabel: Record<ReferralStatus, { text: string; variant: "secondary" | "default" | "outline" | "destructive" }> = {
  initiated: { text: "Ny förfrågan", variant: "secondary" },
  accepted: { text: "Mottagen – debiteras", variant: "default" },
  declined: { text: "Avböjd", variant: "outline" },
  completed: { text: "Avslutad", variant: "default" },
};

const AdvisorReferrals = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ["my-referrals", user?.id],
    queryFn: () => data.referrals.listMine(),
    enabled: !!user,
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["my-leads", user?.id],
    queryFn: () => data.leads.listMyLeads(),
    enabled: !!user,
    retry: false,
  });
  const { data: charges = [] } = useQuery({
    queryKey: ["my-charges", user?.id],
    queryFn: () => data.leads.listMyCharges(),
    enabled: !!user,
    retry: false,
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ["my-invoices", user?.id],
    queryFn: () => data.billing.listMyInvoices(),
    enabled: !!user,
    retry: false,
  });

  // Skuggrader (pilotens spår A) visas med belopp men faktureras aldrig -
  // de redovisas separat så att "att fakturera" aldrig ljuger.
  const upcoming = charges.filter((c) => c.invoiceId === null && !c.shadow);
  const upcomingTotal = upcoming.reduce((sum, c) => sum + c.amountOre, 0);
  const shadowCharges = charges.filter((c) => c.shadow);
  const shadowTotal = shadowCharges.reduce((sum, c) => sum + c.amountOre, 0);

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReferralStatus }) =>
      data.referrals.updateStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-referrals", user?.id] }),
  });

  const thisMonth = useMemo(() => {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const billable = referrals.filter(
      (r) => r.billableAt && new Date(r.billableAt) >= start,
    );
    return {
      count: billable.length,
      total: billable.reduce((sum, r) => sum + (Number(r.feeAmount) || 0), 0),
    };
  }, [referrals]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16 container px-4 max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="font-display text-3xl text-foreground mb-1">Dina förfrågningar</h1>
          <p className="text-muted-foreground">
            Företag som kontaktat dig via CLEARANCE, och vad som ligger till grund för
            din faktura. Uppgifterna företagen ser om er redigerar du under{" "}
            <Link to="/byraprofil" className="font-medium text-accent underline underline-offset-4">
              Byråprofil
            </Link>
            .
          </p>
        </div>

        {!user ? (
          <WizardCard>
            <p className="text-muted-foreground mb-4">Logga in för att se dina förfrågningar.</p>
            <Button variant="accent" onClick={() => navigate("/login")}>
              Logga in
            </Button>
          </WizardCard>
        ) : isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        ) : (
          <>
            {leads.length > 0 && (
              <WizardCard>
                <WizardCardHeader
                  title="Ärendeförfrågningar"
                  description="Företag som valt dig. Förhandsvisningen är avidentifierad – identiteten och underlaget låses upp mot villkoren, och avgiften syns innan du bestämmer dig. Att avböja kostar ingenting."
                />
                <ul className="space-y-3">
                  {leads.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} />
                  ))}
                </ul>
              </WizardCard>
            )}

            {upcoming.length > 0 && (
              <WizardCard>
                <WizardCardHeader
                  title="Kommande samlingsfaktura"
                  description="Löpande debiteringsöversikt: posterna nedan samlas på nästa månadsfaktura. Inga överraskningar – det du ser här är det som faktureras."
                />
                <ul className="space-y-1">
                  {upcoming.map((charge) => (
                    <li key={charge.id} className="flex flex-wrap justify-between gap-2 text-sm">
                      <span className="min-w-0 text-muted-foreground">
                        {format(new Date(charge.createdAt), "yyyy-MM-dd", { locale: sv })} ·{" "}
                        {charge.caseType ? `${CASE_TYPE_LABEL[charge.caseType] ?? charge.caseType} · ` : ""}
                        {charge.companyName ?? charge.serviceLabel}
                        {charge.orgNumber ? ` (${charge.orgNumber})` : ""} · {charge.serviceLabel}
                      </span>
                      <span className="tabular-nums text-foreground">{kr(charge.amountOre)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 flex justify-between border-t border-border pt-2 text-sm font-medium text-foreground">
                  <span>Att fakturera (exkl. moms)</span>
                  <span className="tabular-nums">{kr(upcomingTotal)}</span>
                </p>
              </WizardCard>
            )}

            {shadowCharges.length > 0 && (
              <WizardCard>
                <WizardCardHeader
                  title="Skuggdebitering – faktureras inte"
                  description="Ni deltar i pilotens mätspår: varje händelse prissätts och visas här, men ingenting faktureras och ingenting efterfaktureras. Det ni ser är vad det hade kostat."
                />
                <ul className="space-y-1">
                  {shadowCharges.map((charge) => (
                    <li key={charge.id} className="flex flex-wrap justify-between gap-2 text-sm">
                      <span className="min-w-0 text-muted-foreground">
                        {format(new Date(charge.createdAt), "yyyy-MM-dd", { locale: sv })} ·{" "}
                        {charge.companyName ?? charge.serviceLabel}
                        {charge.orgNumber ? ` (${charge.orgNumber})` : ""} · {charge.serviceLabel}
                      </span>
                      <span className="tabular-nums text-muted-foreground">{kr(charge.amountOre)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 flex justify-between border-t border-border pt-2 text-sm font-medium text-foreground">
                  <span>Hade kostat (exkl. moms)</span>
                  <span className="tabular-nums">{kr(shadowTotal)}</span>
                </p>
              </WizardCard>
            )}

            {invoices.length > 0 && (
              <WizardCard>
                <WizardCardHeader
                  title="Fakturor"
                  description="Samlingsfakturorna med digital specifikation – klicka på en faktura för att se varje debitering och vad den kommer av."
                />
                <ul className="space-y-2">
                  {invoices.map((invoice) => (
                    <InvoiceRow key={invoice.id} invoice={invoice} charges={charges} />
                  ))}
                </ul>
              </WizardCard>
            )}

            <WizardCard>
              <WizardCardHeader
                title="Denna månad"
                description="Underlaget uppdateras löpande. Faktura skickas månadsvis i efterskott."
              />
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-md bg-secondary/50">
                  <p className="text-sm text-muted-foreground mb-1">Debiterbara förmedlingar</p>
                  <p className="text-2xl font-display font-semibold text-foreground">
                    {thisMonth.count}
                  </p>
                </div>
                <div className="p-4 rounded-md bg-secondary/50">
                  <p className="text-sm text-muted-foreground mb-1">Att fakturera</p>
                  <p className="text-2xl font-display font-semibold text-foreground tabular-nums">
                    {thisMonth.total.toLocaleString("sv-SE")} kr
                  </p>
                </div>
              </div>
            </WizardCard>

            {referrals.length === 0 ? (
              <WizardCard>
                <p className="text-muted-foreground">
                  Inga förfrågningar än. De dyker upp här så snart ett företag kontaktar
                  dig genom katalogen.
                </p>
              </WizardCard>
            ) : (
              <WizardCard>
                <WizardCardHeader title="Alla förfrågningar" />
                <ul className="divide-y divide-border">
                  {referrals.map((r) => {
                    const Icon = channelIcon[r.channel];
                    const s = statusLabel[r.status];
                    return (
                      <li key={r.id} className="py-4 flex items-start gap-4">
                        <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center flex-shrink-0">
                          <Icon className="w-5 h-5 text-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-medium text-foreground">
                              {channelLabel[r.channel]}
                            </span>
                            <Badge variant={s.variant}>{s.text}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(r.createdAt), "d MMMM yyyy, HH:mm", { locale: sv })}
                          </p>
                          {r.billableAt && (
                            <p className="text-sm text-foreground mt-1 tabular-nums">
                              Avgift: {Number(r.feeAmount ?? 0).toLocaleString("sv-SE")} kr
                            </p>
                          )}
                        </div>
                        {r.status === "initiated" && (
                          <div className="flex gap-1 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setStatus.mutate({ id: r.id, status: "accepted" })}
                              aria-label="Bekräfta att du tagit emot ärendet"
                              title="Jag tar ärendet"
                            >
                              <Check className="w-4 h-4 text-emerald-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setStatus.mutate({ id: r.id, status: "declined" })}
                              aria-label="Avböj ärendet"
                              title="Avböj"
                            >
                              <X className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
                  En förmedling blir debiterbar först när du bekräftat att du tagit emot
                  ärendet. Avböjda förfrågningar kostar ingenting.
                </p>
              </WizardCard>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default AdvisorReferrals;
