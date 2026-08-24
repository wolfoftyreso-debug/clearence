-- Adds real, per-user data persistence for the crisis wizard, KBR module,
-- and liquidity timeline. Everything is scoped to auth.uid() via RLS so a
-- user can only ever see or modify their own data.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TYPE public.recommendation_type AS ENUM (
  'bankruptcy',
  'reconstruction',
  'stabilize'
);

CREATE TYPE public.kbr_status AS ENUM (
  'not_required',
  'warning',
  'required',
  'critical'
);

CREATE TYPE public.payment_status AS ENUM (
  'pending',
  'paid',
  'postponed',
  'critical'
);

CREATE TYPE public.payment_category AS ENUM (
  'salary',
  'tax',
  'rent',
  'supplier',
  'loan',
  'other'
);

CREATE TYPE public.invoice_direction AS ENUM (
  'in',
  'out'
);

CREATE TYPE public.invoice_status AS ENUM (
  'unpaid',
  'paid',
  'overdue'
);

-- Crisis wizard cases -------------------------------------------------------

CREATE TABLE public.cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_number TEXT NOT NULL,
  company_name TEXT,
  employees TEXT,
  can_pay_salary BOOLEAN,
  salary_amount TEXT,
  salary_day INTEGER,
  can_pay_tax BOOLEAN,
  tax_amount TEXT,
  tax_day INTEGER,
  can_pay_rent BOOLEAN,
  rent_amount TEXT,
  rent_day INTEGER,
  can_pay_suppliers BOOLEAN,
  total_debt TEXT,
  quick_liquidation_value TEXT,
  recommendation_type public.recommendation_type,
  recommendation_title TEXT,
  recommendation_description TEXT,
  recommendation_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendation_next_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cases"
ON public.cases FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own cases"
ON public.cases FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cases"
ON public.cases FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cases"
ON public.cases FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_cases_user ON public.cases(user_id);

CREATE TRIGGER set_cases_updated_at
BEFORE UPDATE ON public.cases
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- KBR (kontrollbalansräkning) assessments ------------------------------------

CREATE TABLE public.kbr_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  org_number TEXT,
  company_name TEXT,
  ambition_level TEXT,
  has_related_companies BOOLEAN,
  is_part_of_larger_structure BOOLEAN,
  share_capital NUMERIC NOT NULL,
  total_assets NUMERIC NOT NULL,
  total_liabilities NUMERIC NOT NULL,
  status public.kbr_status NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.kbr_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own KBR assessments"
ON public.kbr_assessments FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own KBR assessments"
ON public.kbr_assessments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own KBR assessments"
ON public.kbr_assessments FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own KBR assessments"
ON public.kbr_assessments FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_kbr_assessments_user ON public.kbr_assessments(user_id);
CREATE INDEX idx_kbr_assessments_case ON public.kbr_assessments(case_id);

-- Liquidity timeline: payments ------------------------------------------------

CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  category public.payment_category NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'pending',
  due_date DATE NOT NULL,
  recurring BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payments"
ON public.payments FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own payments"
ON public.payments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payments"
ON public.payments FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own payments"
ON public.payments FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_payments_case ON public.payments(case_id);
CREATE INDEX idx_payments_user ON public.payments(user_id);

CREATE TRIGGER set_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Liquidity timeline: invoices ------------------------------------------------

CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  direction public.invoice_direction NOT NULL,
  status public.invoice_status NOT NULL DEFAULT 'unpaid',
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  counterpart TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own invoices"
ON public.invoices FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own invoices"
ON public.invoices FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own invoices"
ON public.invoices FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own invoices"
ON public.invoices FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_invoices_case ON public.invoices(case_id);
CREATE INDEX idx_invoices_user ON public.invoices(user_id);

CREATE TRIGGER set_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
