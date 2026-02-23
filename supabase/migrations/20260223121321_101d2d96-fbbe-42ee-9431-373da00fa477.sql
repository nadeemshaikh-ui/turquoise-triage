
-- Table for historical revenue imports (from TurnsApp/external systems)
CREATE TABLE public.revenue_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  order_ref TEXT,
  customer_name TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  source TEXT DEFAULT 'CSV Import',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.revenue_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage revenue imports"
ON public.revenue_imports FOR ALL
USING (true)
WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.revenue_imports;
