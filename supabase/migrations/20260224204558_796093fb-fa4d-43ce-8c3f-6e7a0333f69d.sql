
-- Add tier column to leads (Premium or Elite)
ALTER TABLE public.leads ADD COLUMN tier text NOT NULL DEFAULT 'Premium';

-- Add phone column to revenue_imports for phone-number matching
ALTER TABLE public.revenue_imports ADD COLUMN phone text;
ALTER TABLE public.revenue_imports ADD COLUMN matched_lead_id uuid REFERENCES public.leads(id);

-- Create turns_sales table for raw Turns CSV data
CREATE TABLE public.turns_sales (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  order_ref text,
  customer_name text,
  phone text,
  sanitized_phone text,
  amount numeric NOT NULL DEFAULT 0,
  matched_lead_id uuid REFERENCES public.leads(id),
  matched_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.turns_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage turns sales"
ON public.turns_sales FOR ALL
USING (true)
WITH CHECK (true);

-- Index for phone matching
CREATE INDEX idx_turns_sales_sanitized_phone ON public.turns_sales(sanitized_phone);
CREATE INDEX idx_customers_phone ON public.customers(phone);
