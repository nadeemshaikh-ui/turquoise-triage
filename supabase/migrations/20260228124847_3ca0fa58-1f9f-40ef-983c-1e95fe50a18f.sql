-- Fix: Create partial unique index after duplicate cleanup
CREATE UNIQUE INDEX IF NOT EXISTS orders_lead_id_unique ON public.orders (lead_id) WHERE lead_id IS NOT NULL;