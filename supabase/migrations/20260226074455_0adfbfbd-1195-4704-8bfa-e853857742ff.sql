
-- Unique index for turns_sales: date + order_ref + amount (COALESCE for nullable order_ref)
CREATE UNIQUE INDEX IF NOT EXISTS uq_turns_sales_date_ref_amount
ON public.turns_sales (date, COALESCE(order_ref, ''), amount);

-- Unique index for meta_ad_spend: date + campaign_name + ad_name + amount_spent (COALESCE for nullables)
CREATE UNIQUE INDEX IF NOT EXISTS uq_meta_ad_spend_date_campaign_ad_amount
ON public.meta_ad_spend (date, COALESCE(campaign_name, ''), COALESCE(ad_name, ''), amount_spent);
