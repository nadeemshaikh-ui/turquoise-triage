
-- 1. Add city and address to customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS address text;

-- 2. service_categories
CREATE TABLE public.service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon_name text NOT NULL DEFAULT 'Sparkles',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage service_categories" ON public.service_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. category_issues
CREATE TABLE public.category_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.service_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  suggestive_price numeric NOT NULL DEFAULT 0,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.category_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage category_issues" ON public.category_issues FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. category_packages
CREATE TABLE public.category_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.service_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  suggestive_price numeric NOT NULL DEFAULT 0,
  includes text[] NOT NULL DEFAULT '{}',
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.category_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage category_packages" ON public.category_packages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. lead_items
CREATE TABLE public.lead_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.service_categories(id),
  mode text NOT NULL DEFAULT 'alacarte',
  selected_issues jsonb NOT NULL DEFAULT '[]',
  selected_package_id uuid REFERENCES public.category_packages(id),
  selected_package_name text,
  suggestive_price numeric NOT NULL DEFAULT 0,
  manual_price numeric NOT NULL DEFAULT 0,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage lead_items" ON public.lead_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Make service_id nullable on leads for new multi-item leads
ALTER TABLE public.leads ALTER COLUMN service_id DROP NOT NULL;

-- Enable realtime on lead_items
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_items;
