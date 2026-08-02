import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { data } from "@/data";
import { useAuth } from "@/hooks/useAuth";
import {
  DEFAULT_COMPANY_PLAN,
  firstPaymentDone,
  lockMessage,
  type CompanyPlan,
} from "@/lib/pricing";
import { Lock } from "lucide-react";

/**
 * Betalväggen, på exakt ett ställe.
 *
 * Principen den vaktar: användaren blir aldrig inlåst och förlorar
 * aldrig sitt arbete. Skapandet är öppet från början - det som väntar
 * på första betalningen är export och delning. Texten säger det, priset
 * kommer ur driftparametern, och tonen är en inbjudan - inte ett hot.
 */

export const useEntitlements = (): {
  ready: boolean;
  exportAndSharing: boolean;
  plan: CompanyPlan;
} => {
  const { user } = useAuth();
  const { data: billing } = useQuery({
    queryKey: ["my-billing"],
    queryFn: () => data.billing.getMine(),
    retry: false,
    enabled: !!user,
  });
  const { data: plan } = useQuery({
    queryKey: ["company-plan"],
    queryFn: () => data.billing.getCompanyPlan(),
    retry: false,
  });
  return {
    ready: billing !== undefined,
    exportAndSharing: firstPaymentDone(billing ?? null),
    plan: plan ?? DEFAULT_COMPANY_PLAN,
  };
};

export const LockedFeature = ({ title }: { title: string }) => {
  const { plan } = useEntitlements();
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-secondary/40 p-4" role="status">
      <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{lockMessage(plan)}</p>
        <Link
          to="/dashboard/installningar"
          className="mt-1.5 inline-block text-xs font-medium text-accent underline-offset-4 hover:underline"
        >
          Se din faktura under Inställningar
        </Link>
      </div>
    </div>
  );
};
