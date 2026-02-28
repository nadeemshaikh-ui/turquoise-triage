
-- A) Add tat_is_manual column to leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS tat_is_manual boolean NOT NULL DEFAULT false;

-- B) Fix status CHECK to include 'Quoted'
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_status_check
  CHECK (status = ANY (ARRAY['New','Quoted','In Progress','Ready for Pickup','Completed']));

-- C) Replace lead_photos FK with CASCADE + add index
ALTER TABLE public.lead_photos DROP CONSTRAINT IF EXISTS lead_photos_lead_item_id_fkey;
ALTER TABLE public.lead_photos
  ADD CONSTRAINT lead_photos_lead_item_id_fkey
  FOREIGN KEY (lead_item_id) REFERENCES public.lead_items(id)
  ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_lead_photos_lead_item_id
  ON public.lead_photos(lead_item_id);
