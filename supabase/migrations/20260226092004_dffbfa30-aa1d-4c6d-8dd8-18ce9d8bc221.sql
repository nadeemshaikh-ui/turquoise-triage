-- Add ad_id column for precise Meta ad tracking
ALTER TABLE public.meta_ad_spend ADD COLUMN IF NOT EXISTS ad_id text;

-- Create index for faster lookups by ad_id
CREATE INDEX IF NOT EXISTS idx_meta_ad_spend_ad_id ON public.meta_ad_spend(ad_id);

-- Drop the old unique constraint if it exists and recreate with ad_id
-- This allows deduplication by date + ad_id instead of date + ad_name
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_meta_ad_spend_date_ad_name') THEN
    ALTER TABLE public.meta_ad_spend DROP CONSTRAINT uq_meta_ad_spend_date_ad_name;
  END IF;
END $$;