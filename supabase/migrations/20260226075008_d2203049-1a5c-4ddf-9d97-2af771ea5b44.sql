-- Normalize nullable conflict-key fields
UPDATE public.turns_sales SET order_ref = '' WHERE order_ref IS NULL;
UPDATE public.meta_ad_spend SET ad_name = '' WHERE ad_name IS NULL;

-- Deduplicate existing rows for new conflict keys
DELETE FROM public.turns_sales a
USING public.turns_sales b
WHERE a.ctid < b.ctid
  AND a.order_ref = b.order_ref;

DELETE FROM public.meta_ad_spend a
USING public.meta_ad_spend b
WHERE a.ctid < b.ctid
  AND a.date = b.date
  AND a.ad_name = b.ad_name;

-- Add unique indexes required by exact upsert conflict keys
CREATE UNIQUE INDEX IF NOT EXISTS uq_turns_sales_order_ref
ON public.turns_sales (order_ref);

CREATE UNIQUE INDEX IF NOT EXISTS uq_meta_ad_spend_date_ad_name
ON public.meta_ad_spend (date, ad_name);