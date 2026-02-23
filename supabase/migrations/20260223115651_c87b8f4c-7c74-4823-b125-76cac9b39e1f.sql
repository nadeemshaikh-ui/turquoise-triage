
-- Add cost_per_unit to inventory_items for P&L calculation
ALTER TABLE public.inventory_items ADD COLUMN cost_per_unit NUMERIC NOT NULL DEFAULT 0;

-- Table for Meta Ad Spend CSV data
CREATE TABLE public.meta_ad_spend (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  campaign_name TEXT,
  amount_spent NUMERIC NOT NULL DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_ad_spend ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage ad spend"
ON public.meta_ad_spend FOR ALL
USING (true)
WITH CHECK (true);

-- Table to store configurable settings like labor cost
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read settings"
ON public.app_settings FOR SELECT USING (true);

CREATE POLICY "Admins can manage settings"
ON public.app_settings FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Seed default labor cost
INSERT INTO public.app_settings (key, value) VALUES ('artisan_labor_per_order', '150');

-- Enable realtime for ad spend
ALTER PUBLICATION supabase_realtime ADD TABLE public.meta_ad_spend;
