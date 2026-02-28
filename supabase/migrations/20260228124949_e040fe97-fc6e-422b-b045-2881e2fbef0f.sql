
-- =============================================
-- MIGRATION A (retry): Tables, Columns, Constraints, RLS
-- =============================================

-- A1: package_settings
CREATE TABLE public.package_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  warranty_days int NOT NULL CHECK (warranty_days >= 0),
  is_active boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX package_settings_name_unique ON public.package_settings (lower(trim(name)));
ALTER TABLE public.package_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read package_settings" ON public.package_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage package_settings" ON public.package_settings FOR ALL TO authenticated USING (can_staff()) WITH CHECK (can_staff());

-- A2: leads -- portal stage columns
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS portal_stage text NOT NULL DEFAULT 'AwaitingSelection',
  ADD COLUMN IF NOT EXISTS selected_package_id uuid NULL REFERENCES public.package_settings(id),
  ADD COLUMN IF NOT EXISTS package_selected_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS pickup_slot_start_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS pickup_slot_end_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz NULL;
ALTER TABLE public.leads ADD CONSTRAINT leads_portal_stage_check CHECK (portal_stage IN ('AwaitingSelection','Scheduling','Approved'));
ALTER TABLE public.leads ADD CONSTRAINT leads_pickup_slot_order_check CHECK (pickup_slot_end_at IS NULL OR pickup_slot_start_at IS NULL OR pickup_slot_end_at > pickup_slot_start_at);

-- A3: orders -- delivery, creator, package, warranty snapshot (index already exists from prior migration)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid NULL REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS package_id uuid NULL REFERENCES public.package_settings(id),
  ADD COLUMN IF NOT EXISTS warranty_days_snapshot int NOT NULL DEFAULT 0 CHECK (warranty_days_snapshot >= 0);

-- A4: order_items -- immutable snapshots + warranty
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS remarks_snapshot text NULL,
  ADD COLUMN IF NOT EXISTS primary_image_url_snapshot text NULL,
  ADD COLUMN IF NOT EXISTS warranty_start_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS warranty_end_at timestamptz NULL;

-- A5: lead_items -- Others support
ALTER TABLE public.lead_items ADD COLUMN IF NOT EXISTS custom_category_label text NULL;

-- A6: Restoration add-ons
CREATE TABLE public.addons_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX addons_master_name_unique ON public.addons_master (lower(trim(name)));
ALTER TABLE public.addons_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read addons_master" ON public.addons_master FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage addons_master" ON public.addons_master FOR ALL TO authenticated USING (can_staff()) WITH CHECK (can_staff());

CREATE TABLE public.pricing_addons_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  addon_id uuid NOT NULL REFERENCES public.addons_master(id),
  price numeric NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true
);
ALTER TABLE public.pricing_addons_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read pricing_addons_master" ON public.pricing_addons_master FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage pricing_addons_master" ON public.pricing_addons_master FOR ALL TO authenticated USING (can_staff()) WITH CHECK (can_staff());

CREATE TABLE public.lead_item_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_item_id uuid NOT NULL REFERENCES public.lead_items(id) ON DELETE CASCADE,
  addon_id uuid NOT NULL REFERENCES public.addons_master(id),
  price_at_time numeric NOT NULL CHECK (price_at_time >= 0),
  UNIQUE (lead_item_id, addon_id)
);
ALTER TABLE public.lead_item_addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage lead_item_addons" ON public.lead_item_addons FOR ALL TO authenticated USING (can_staff()) WITH CHECK (can_staff());

-- A7: Invoices
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) UNIQUE,
  public_url text NULL,
  issued_at timestamptz NULL
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage invoices" ON public.invoices FOR ALL TO authenticated USING (can_staff()) WITH CHECK (can_staff());

CREATE TABLE public.invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  order_item_id uuid NULL REFERENCES public.order_items(id),
  label text NOT NULL,
  qty int NOT NULL DEFAULT 1 CHECK (qty > 0),
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  amount numeric NOT NULL CHECK (amount >= 0)
);
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage invoice_line_items" ON public.invoice_line_items FOR ALL TO authenticated USING (can_staff()) WITH CHECK (can_staff());

CREATE OR REPLACE FUNCTION public.set_invoice_line_item_amount()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.amount := NEW.qty * NEW.unit_price;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_set_invoice_line_item_amount BEFORE INSERT OR UPDATE ON public.invoice_line_items FOR EACH ROW EXECUTE FUNCTION public.set_invoice_line_item_amount();

-- A8: Ratings + Disputes
CREATE TABLE public.ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  stars int NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id)
);
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage ratings" ON public.ratings FOR ALL TO authenticated USING (can_staff()) WITH CHECK (can_staff());

CREATE TABLE public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id)
);
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage disputes" ON public.disputes FOR ALL TO authenticated USING (can_staff()) WITH CHECK (can_staff());

-- A9: order_item_photos
CREATE TABLE public.order_item_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  url text NOT NULL,
  kind text NOT NULL DEFAULT 'before',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.order_item_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage order_item_photos" ON public.order_item_photos FOR ALL TO authenticated USING (can_staff()) WITH CHECK (can_staff());
