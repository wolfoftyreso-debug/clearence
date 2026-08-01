import { useCallback } from "react";
import { data } from "@/data";
import { useAuth } from "@/hooks/useAuth";
import type { ReferralChannel } from "@/data/types";

/**
 * Records that a company made contact with an advisor through the platform.
 * This is the billable event the referral revenue model rests on.
 *
 * Two deliberate properties:
 *
 * - Fire-and-forget. The caller is usually an anchor about to open a mail or
 *   phone client, so this must not block it. Failures are logged and
 *   swallowed: someone in a crisis reaching an advisor matters more than a
 *   billing row.
 * - Anonymous contacts are not recorded. Without a signed-in referrer there
 *   is no attributable party, and an unattributable row is a weak basis for
 *   an invoice - better to bill less than to bill something unprovable.
 */
export const useRecordReferral = () => {
  const { user } = useAuth();

  return useCallback(
    (professionalId: string, channel: ReferralChannel) => {
      if (!user) return;

      void (async () => {
        try {
          // Tie the referral back to the situation it came out of, if any.
          const latestCase = await data.cases.getLatest();
          await data.referrals.create({
            professionalId,
            caseId: latestCase?.id ?? null,
            channel,
            userId: user.id,
          });
        } catch (err) {
          console.error("Could not record referral:", err);
        }
      })();
    },
    [user],
  );
};
