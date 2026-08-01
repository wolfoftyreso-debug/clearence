-- Create enum for professional categories
CREATE TYPE public.professional_category AS ENUM (
  'konkursforvaltare',
  'rekonstruktor',
  'revisor',
  'affarsjurist',
  'kreditbolag'
);

-- Create professionals table
CREATE TABLE public.professionals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,
  category professional_category NOT NULL,
  description TEXT,
  location TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  fixed_prices JSONB DEFAULT '[]'::jsonb,
  specializations TEXT[] DEFAULT '{}',
  verified BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create professional ratings table (anonymous, GDPR-safe)
CREATE TABLE public.professional_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  -- Fixed rating questions (1-5 scale)
  communication_score INTEGER CHECK (communication_score >= 1 AND communication_score <= 5),
  expertise_score INTEGER CHECK (expertise_score >= 1 AND expertise_score <= 5),
  price_transparency_score INTEGER CHECK (price_transparency_score >= 1 AND price_transparency_score <= 5),
  response_time_score INTEGER CHECK (response_time_score >= 1 AND response_time_score <= 5),
  overall_score INTEGER CHECK (overall_score >= 1 AND overall_score <= 5),
  -- No free text to ensure GDPR compliance
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_ratings ENABLE ROW LEVEL SECURITY;

-- Public read access for professionals (marketplace is open)
CREATE POLICY "Anyone can view active professionals"
ON public.professionals
FOR SELECT
USING (active = true);

-- Public read access for ratings
CREATE POLICY "Anyone can view ratings"
ON public.professional_ratings
FOR SELECT
USING (true);

-- Create indexes for search performance
CREATE INDEX idx_professionals_category ON public.professionals(category);
CREATE INDEX idx_professionals_location ON public.professionals(location);
CREATE INDEX idx_professionals_active ON public.professionals(active);
CREATE INDEX idx_ratings_professional ON public.professional_ratings(professional_id);

-- Insert demo professionals
INSERT INTO public.professionals (name, company, category, description, location, email, phone, website, fixed_prices, specializations, verified) VALUES
('Anna Lindberg', 'Lindberg Advokatbyrå', 'konkursforvaltare', 'Specialiserad på företagskonkurser med 15 års erfarenhet. Hanterar allt från små enskilda firmor till medelstora aktiebolag.', 'Stockholm', 'anna@lindberg-advokat.se', '08-123 45 67', 'https://lindberg-advokat.se', '[{"service": "Inledande rådgivning", "price": 3500}, {"service": "Konkursansökan", "price": 15000}, {"service": "Fullständig konkurshantering", "price": 45000}]', ARRAY['Aktiebolag', 'Handelsbolag', 'Enskild firma'], true),
('Erik Bergström', 'Bergström & Partners', 'rekonstruktor', 'Expert på företagsrekonstruktion med fokus på att rädda livskraftiga företag. Arbetar nära Kronofogden och domstolar.', 'Göteborg', 'erik@bergstrom-partners.se', '031-987 65 43', 'https://bergstrom-partners.se', '[{"service": "Rekonstruktionsbedömning", "price": 5000}, {"service": "Ansökan om rekonstruktion", "price": 20000}, {"service": "Full rekonstruktionsprocess", "price": 75000}]', ARRAY['SME', 'Tjänsteföretag', 'Tillverkningsindustri'], true),
('Maria Svensson', 'Svensson Revision', 'revisor', 'Auktoriserad revisor med specialisering på företag i ekonomisk kris. Erbjuder snabb och grundlig ekonomisk analys.', 'Malmö', 'maria@svensson-revision.se', '040-111 22 33', 'https://svensson-revision.se', '[{"service": "Snabbanalys ekonomi", "price": 4500}, {"service": "Fullständig revision", "price": 25000}, {"service": "Obeståndsutredning", "price": 12000}]', ARRAY['Bokslut', 'Skatteplanering', 'Obeståndsfrågor'], true),
('Johan Andersson', 'Andersson Juridik', 'affarsjurist', 'Affärsjurist med bred erfarenhet av företag i svåra situationer. Hjälper med allt från avtalsfrågor till tvistlösning.', 'Uppsala', 'johan@andersson-juridik.se', '018-555 66 77', 'https://andersson-juridik.se', '[{"service": "Juridisk konsultation", "price": 2500}, {"service": "Avtalsgenomgång", "price": 8000}, {"service": "Tvistlösning", "price": 35000}]', ARRAY['Avtal', 'Tvister', 'Arbetsrätt'], true),
('Kredit Partner AB', 'Kredit Partner AB', 'kreditbolag', 'Specialiserad kreditgivare för företag som behöver snabb finansiering. Flexibla lösningar för företag i tillväxt eller omställning.', 'Stockholm', 'info@kreditpartner.se', '08-999 88 77', 'https://kreditpartner.se', '[{"service": "Kreditbedömning", "price": 0}, {"service": "Företagslån 100-500k", "price": 5000}, {"service": "Brofinansiering", "price": 10000}]', ARRAY['Rörelsekredit', 'Factoring', 'Tillväxtlån'], true);

-- Insert demo ratings
INSERT INTO public.professional_ratings (professional_id, communication_score, expertise_score, price_transparency_score, response_time_score, overall_score)
SELECT id, 5, 5, 4, 5, 5 FROM public.professionals WHERE name = 'Anna Lindberg';
INSERT INTO public.professional_ratings (professional_id, communication_score, expertise_score, price_transparency_score, response_time_score, overall_score)
SELECT id, 4, 5, 5, 4, 4 FROM public.professionals WHERE name = 'Anna Lindberg';
INSERT INTO public.professional_ratings (professional_id, communication_score, expertise_score, price_transparency_score, response_time_score, overall_score)
SELECT id, 5, 4, 4, 5, 5 FROM public.professionals WHERE name = 'Erik Bergström';
INSERT INTO public.professional_ratings (professional_id, communication_score, expertise_score, price_transparency_score, response_time_score, overall_score)
SELECT id, 4, 5, 5, 4, 4 FROM public.professionals WHERE name = 'Maria Svensson';
INSERT INTO public.professional_ratings (professional_id, communication_score, expertise_score, price_transparency_score, response_time_score, overall_score)
SELECT id, 5, 4, 4, 5, 5 FROM public.professionals WHERE name = 'Johan Andersson';
INSERT INTO public.professional_ratings (professional_id, communication_score, expertise_score, price_transparency_score, response_time_score, overall_score)
SELECT id, 4, 4, 5, 5, 4 FROM public.professionals WHERE name = 'Kredit Partner AB';