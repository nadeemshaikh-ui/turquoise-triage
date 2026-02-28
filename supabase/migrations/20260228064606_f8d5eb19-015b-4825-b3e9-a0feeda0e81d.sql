
ALTER TABLE public.lead_items 
  ADD COLUMN IF NOT EXISTS service_type text NOT NULL DEFAULT 'restoration';

ALTER TABLE public.lead_items 
  ADD CONSTRAINT lead_items_service_type_check 
  CHECK (service_type IN ('restoration','repair','cleaning','dye','hardware','spa'));
