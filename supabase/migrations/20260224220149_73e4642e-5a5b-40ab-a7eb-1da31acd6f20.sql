-- Add campaign attribution column to leads
ALTER TABLE public.leads ADD COLUMN meta_campaign_name text;
