
-- ============================================
-- Sub-Phase 2A: Database Architecture
-- ============================================

-- 1. New table: photo_markers
CREATE TABLE public.photo_markers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid NOT NULL REFERENCES public.order_photos(id) ON DELETE CASCADE,
  x_coordinate decimal NOT NULL,
  y_coordinate decimal NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.photo_markers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage photo markers"
  ON public.photo_markers FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 2. New table: order_discoveries
CREATE TABLE public.order_discoveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  description text NOT NULL,
  extra_price numeric NOT NULL DEFAULT 0,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_discoveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage order discoveries"
  ON public.order_discoveries FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 3. New table: system_settings
CREATE TABLE public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_capacity integer NOT NULL DEFAULT 20,
  initial_reminder_days integer NOT NULL DEFAULT 3,
  followup_days integer NOT NULL DEFAULT 7,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read system settings"
  ON public.system_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can update system settings"
  ON public.system_settings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Seed default row
INSERT INTO public.system_settings (workshop_capacity, initial_reminder_days, followup_days)
VALUES (20, 3, 7);

-- Trigger for updated_at
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Extend orders table with new columns
-- Financial
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total_amount_due numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS advance_paid numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS balance_remaining numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS advance_required numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_reason text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tax_amount numeric DEFAULT 0;

-- Automation
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS auto_sweetener_type text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS auto_sweetener_value text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS quote_sent_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS quote_valid_until timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS reminder_count integer DEFAULT 0;

-- Metadata
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS unique_asset_signature text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_approved_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_declined_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS decline_reason text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_address_confirmed_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS slider_before_photo_id uuid;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS slider_after_photo_id uuid;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS final_qc_video_url text;

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.photo_markers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_discoveries;
