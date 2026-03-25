ALTER TABLE public.meta_ad_spend
ADD COLUMN IF NOT EXISTS ad_account_id text;

UPDATE public.meta_ad_spend
SET ad_account_id = '717289587216194'
WHERE ad_account_id IS NULL;

ALTER TABLE public.meta_ad_spend
ALTER COLUMN ad_account_id SET DEFAULT '717289587216194';

ALTER TABLE public.meta_ad_spend
ALTER COLUMN ad_account_id SET NOT NULL;