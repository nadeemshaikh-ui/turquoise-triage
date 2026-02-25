
-- Add legacy fields to customers table
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS legacy_ltv numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS legacy_source text,
  ADD COLUMN IF NOT EXISTS service_affinity text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS historical_context text;
