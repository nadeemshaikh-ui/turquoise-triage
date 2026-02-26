
-- Add ad-level columns to meta_ad_spend
ALTER TABLE public.meta_ad_spend
  ADD COLUMN IF NOT EXISTS ad_name text,
  ADD COLUMN IF NOT EXISTS reach integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement integer DEFAULT 0;
