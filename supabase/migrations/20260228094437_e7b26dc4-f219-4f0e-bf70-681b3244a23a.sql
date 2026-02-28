
CREATE TABLE public.service_pricing_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  service_type text NOT NULL,
  base_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(category, service_type)
);

ALTER TABLE public.service_pricing_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage pricing"
  ON public.service_pricing_master
  FOR ALL
  USING (true)
  WITH CHECK (true);
