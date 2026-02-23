
-- Services catalog
CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Cleaning', 'Repair & Structural', 'Restoration & Color', 'Luxury Bags', 'Custom')),
  default_price NUMERIC(10,2),
  price_range_min NUMERIC(10,2),
  price_range_max NUMERIC(10,2),
  default_tat_min INT NOT NULL DEFAULT 4,
  default_tat_max INT NOT NULL DEFAULT 5,
  requires_photos BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read services"
  ON public.services FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage services"
  ON public.services FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Customers
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage customers"
  ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Leads
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id),
  custom_service_name TEXT,
  custom_service_price NUMERIC(10,2),
  quoted_price NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'In Progress', 'Ready for Pickup', 'Completed')),
  tat_days_min INT NOT NULL DEFAULT 4,
  tat_days_max INT NOT NULL DEFAULT 5,
  is_gold_tier BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage leads"
  ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Lead photos metadata
CREATE TABLE public.lead_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage lead photos"
  ON public.lead_photos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for customer photos
INSERT INTO storage.buckets (id, name, public) VALUES ('lead-photos', 'lead-photos', false);

CREATE POLICY "Authenticated users can upload lead photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lead-photos');

CREATE POLICY "Authenticated users can view lead photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lead-photos');

CREATE POLICY "Authenticated users can delete lead photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lead-photos');

-- Seed default services
INSERT INTO public.services (name, category, default_price, default_tat_min, default_tat_max, requires_photos) VALUES
  ('Sneaker Deep Clean', 'Cleaning', 800, 4, 5, false),
  ('Signature Clean', 'Cleaning', 1200, 4, 5, false),
  ('Boots/Heeled Shoes', 'Cleaning', 900, 4, 5, false),
  ('Suede/Nubuck Special', 'Cleaning', 1100, 4, 5, false),
  ('Sole Pasting (Full)', 'Repair & Structural', 1500, 10, 15, false),
  ('Sole Pasting (Minor)', 'Repair & Structural', 800, 10, 15, false),
  ('Heel Tip Replacement', 'Repair & Structural', 600, 10, 15, false),
  ('Stitching/Patching', 'Repair & Structural', 1000, 10, 15, false),
  ('Zip/Hardware Repair', 'Repair & Structural', 1200, 10, 15, false),
  ('Leather Peeling Repair', 'Restoration & Color', NULL, 10, 15, true),
  ('Full Color Restoration', 'Restoration & Color', 3500, 10, 15, true),
  ('Suede Dyeing', 'Restoration & Color', 2500, 10, 15, true),
  ('Mid-sole Unyellowing', 'Restoration & Color', 2000, 10, 15, true),
  ('Deep Cleaning (Bags)', 'Luxury Bags', 3000, 10, 15, true),
  ('Structural Realignment', 'Luxury Bags', 5000, 10, 15, true),
  ('Edge Painting', 'Luxury Bags', 4000, 10, 15, true),
  ('Color Change (Bags)', 'Luxury Bags', 7000, 10, 15, true);

-- Set price ranges for consultative pricing
UPDATE public.services SET price_range_min = 2500, price_range_max = 5000 WHERE name = 'Leather Peeling Repair';
UPDATE public.services SET price_range_min = 5000, price_range_max = 9500 WHERE category = 'Luxury Bags' AND name IN ('Structural Realignment', 'Color Change (Bags)');
