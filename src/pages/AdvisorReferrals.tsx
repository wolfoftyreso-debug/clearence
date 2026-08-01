import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WizardCard, WizardCardHeader } from "@/components/wizard/WizardCard";
import { useAuth } from "@/hooks/useAuth";
import { data } from "@/data";
import type { ReferralChannel, ReferralStatus } from "@/data/types";
import { Loader2, Mail, Phone, Globe, Check, X } from "lucide-react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

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
            din faktura.
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
