
-- 1. brands table
CREATE TABLE public.brands (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  tier text NOT NULL DEFAULT 'standard' CHECK (tier IN ('standard', 'luxury', 'ultra_luxury')),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage brands"
  ON public.brands FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 2. brand_category_tags junction table
CREATE TABLE public.brand_category_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.service_categories(id) ON DELETE CASCADE,
  UNIQUE (brand_id, category_id)
);

ALTER TABLE public.brand_category_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage brand_category_tags"
  ON public.brand_category_tags FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 3. marketing_campaigns table
CREATE TABLE public.marketing_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage marketing_campaigns"
  ON public.marketing_campaigns FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 4. Add brand_id to lead_items
ALTER TABLE public.lead_items ADD COLUMN brand_id uuid REFERENCES public.brands(id);

-- 5. Add lead_item_id to lead_photos
ALTER TABLE public.lead_photos ADD COLUMN lead_item_id uuid REFERENCES public.lead_items(id);
