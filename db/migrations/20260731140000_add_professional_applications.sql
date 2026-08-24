-- Lets advisors apply to be listed in the marketplace.
--
-- Deliberately a separate table from public.professionals rather than an
-- insert policy on it: the marketplace is where a company in acute distress
-- picks who handles its bankruptcy, and several categories here are
-- regulated (konkursförvaltare are appointed from the court's list,
-- advokater are members of Advokatsamfundet, revisorer are authorised by
-- Revisorsinspektionen). Anyone being able to publish themselves - and land
-- next to a "verified" badge - would make the listing actively unsafe.
-- Applications land here as `pending` and only reach public.professionals
-- after a human has checked the credential reference.

CREATE TYPE public.application_status AS ENUM (
  'pending',
  'needs_info',
  'approved',
  'rejected'
);

CREATE TABLE public.professional_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Who is applying
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  org_number TEXT,

  -- What they offer
  category public.professional_category NOT NULL,
  location TEXT,
  description TEXT,
  website TEXT,
  specializations TEXT[] DEFAULT '{}',
  fixed_prices JSONB DEFAULT '[]'::jsonb,

  -- How the claim can be checked. Which authority is relevant depends on
  -- the category, so this is kept as free text plus a reference number
  -- rather than a rigid schema.
  credential_authority TEXT,
  credential_reference TEXT,
  credential_note TEXT,

  -- Review
  status public.application_status NOT NULL DEFAULT 'pending',
  review_note TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.professional_applications ENABLE ROW LEVEL SECURITY;

-- Applicants see and manage only their own application. There is no public
-- SELECT policy: a pending application must not be readable by companies
-- browsing the marketplace, or it would look like a listing.
CREATE POLICY "Applicants can view their own application"
ON public.professional_applications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Applicants can create their own application"
ON public.professional_applications FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Editable only while still under review, so an approved listing cannot be
-- quietly changed after it has been checked.
CREATE POLICY "Applicants can update an application still under review"
ON public.professional_applications FOR UPDATE
USING (auth.uid() = user_id AND status IN ('pending', 'needs_info'))
WITH CHECK (auth.uid() = user_id AND status IN ('pending', 'needs_info'));

-- Note: no UPDATE path here can set status to 'approved' for the applicant,
-- because approving means writing into public.professionals, which has no
-- INSERT policy at all and therefore requires the service role.

CREATE INDEX idx_professional_applications_user ON public.professional_applications(user_id);
CREATE INDEX idx_professional_applications_status ON public.professional_applications(status);

CREATE TRIGGER set_professional_applications_updated_at
BEFORE UPDATE ON public.professional_applications
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Link a published listing back to the application it came from, so it is
-- traceable who was checked and when.
ALTER TABLE public.professionals
  ADD COLUMN application_id UUID REFERENCES public.professional_applications(id) ON DELETE SET NULL;
