-- Referral tracking, which is what the revenue model rests on.
--
-- The model is: advisors are invoiced an agreed fixed fee per referral we
-- mediate. That means no card payments are needed - but it does mean every
-- billable event has to be recorded at the moment it happens, with the fee
-- that was agreed at that time. Until now contact happened through plain
-- mailto:/tel: links that left no trace, so there was nothing to invoice
-- against.

CREATE TYPE public.referral_channel AS ENUM ('email', 'phone', 'website');

CREATE TYPE public.referral_status AS ENUM (
  'initiated',   -- company made contact through the platform
  'accepted',    -- advisor confirmed they took the enquiry on
  'declined',    -- advisor did not take it
  'completed'    -- engagement concluded
);

-- Link a published listing to the account that manages it, so an advisor can
-- see their own referrals and what they are being invoiced for.
ALTER TABLE public.professionals
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN referral_fee NUMERIC,
  ADD COLUMN billing_email TEXT;

COMMENT ON COLUMN public.professionals.referral_fee IS
  'Agreed fixed fee invoiced per billable referral, in SEK. Set on approval.';

-- Capture that the advisor accepted the commercial terms. Invoicing someone
-- who never agreed to be invoiced is not a position worth being in.
ALTER TABLE public.professional_applications
  ADD COLUMN terms_accepted_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE RESTRICT,
  referrer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,

  channel public.referral_channel NOT NULL,
  status public.referral_status NOT NULL DEFAULT 'initiated',

  -- Snapshot of the fee at the time of referral. Stored per row so that
  -- later renegotiation of an advisor's rate cannot retroactively change
  -- what an already-issued invoice was based on.
  fee_amount NUMERIC,

  -- Set when the row becomes chargeable, so the billing basis is a plain
  -- query rather than a re-derivation of business rules after the fact.
  billable_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- The company that made contact can create and read its own referrals.
CREATE POLICY "Referrers can create their own referrals"
ON public.referrals FOR INSERT
WITH CHECK (auth.uid() = referrer_user_id);

CREATE POLICY "Referrers can view their own referrals"
ON public.referrals FOR SELECT
USING (auth.uid() = referrer_user_id);

-- The advisor can see referrals sent to their own listing. Being able to see
-- the basis before the invoice arrives is what keeps this from turning into
-- a dispute.
CREATE POLICY "Advisors can view referrals to their listing"
ON public.referrals FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.professionals p
    WHERE p.id = referrals.professional_id
      AND p.user_id = auth.uid()
  )
);

-- The advisor may move a referral through its lifecycle, but must not be
-- able to alter the fee it will be billed at.
CREATE POLICY "Advisors can update status on their referrals"
ON public.referrals FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.professionals p
    WHERE p.id = referrals.professional_id
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.professionals p
    WHERE p.id = referrals.professional_id
      AND p.user_id = auth.uid()
  )
);

CREATE INDEX idx_referrals_professional ON public.referrals(professional_id);
CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_user_id);
CREATE INDEX idx_referrals_billable ON public.referrals(billable_at) WHERE billable_at IS NOT NULL;

CREATE TRIGGER set_referrals_updated_at
BEFORE UPDATE ON public.referrals
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Stamp the fee and the billable moment server-side. Doing this in a trigger
-- rather than from the client means the amount cannot be set or suppressed by
-- whoever happens to be calling the API.
CREATE OR REPLACE FUNCTION public.stamp_referral_billing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT p.referral_fee INTO NEW.fee_amount
    FROM public.professionals p WHERE p.id = NEW.professional_id;
  ELSE
    -- Never let an update rewrite the agreed amount.
    NEW.fee_amount := OLD.fee_amount;
    NEW.billable_at := OLD.billable_at;
  END IF;

  -- Chargeable once the advisor has accepted the enquiry, rather than on a
  -- bare click - a mere page interaction is a weak basis for an invoice.
  IF NEW.status IN ('accepted', 'completed') AND NEW.billable_at IS NULL THEN
    NEW.billable_at := now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER stamp_referral_billing_trigger
BEFORE INSERT OR UPDATE ON public.referrals
FOR EACH ROW
EXECUTE FUNCTION public.stamp_referral_billing();

-- Monthly billing basis. Kept as a view so producing an invoice run is a
-- read, not a script that has to re-implement the rules.
--
-- security_invoker is essential here: a normal Postgres view evaluates the
-- underlying tables' RLS as the view owner, which would let any signed-in
-- user read every advisor's billing figures. With it set, each caller sees
-- only the rows their own policies allow - an advisor their own basis, and
-- the service role everything for the actual invoice run.
CREATE VIEW public.referral_billing_basis
WITH (security_invoker = true) AS
SELECT
  p.id AS professional_id,
  p.name AS professional_name,
  p.company,
  p.billing_email,
  date_trunc('month', r.billable_at) AS billing_month,
  count(*) AS referral_count,
  sum(r.fee_amount) AS total_amount
FROM public.referrals r
JOIN public.professionals p ON p.id = r.professional_id
WHERE r.billable_at IS NOT NULL
GROUP BY p.id, p.name, p.company, p.billing_email, date_trunc('month', r.billable_at);
