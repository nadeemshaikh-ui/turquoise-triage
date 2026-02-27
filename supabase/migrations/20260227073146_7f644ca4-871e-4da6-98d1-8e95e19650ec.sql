
-- 1a. Add expert_type to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS expert_type text;

-- 1b. asset_passport table
CREATE TABLE public.asset_passport (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  item_category text NOT NULL,
  brand text,
  model text,
  serial_number text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.asset_passport ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage assets" ON public.asset_passport
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 1c. orders table
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id),
  asset_id uuid REFERENCES public.asset_passport(id),
  customer_id uuid NOT NULL,
  customer_name text,
  customer_phone text,
  status text NOT NULL DEFAULT 'triage',
  package_tier text DEFAULT 'standard',
  total_price decimal DEFAULT 0,
  shipping_fee decimal DEFAULT 0,
  cleaning_fee decimal DEFAULT 0,
  warranty_months int DEFAULT 3,
  sla_start timestamptz,
  consultation_start_time timestamptz,
  health_score int,
  maintenance_due date,
  is_bundle_applied boolean DEFAULT false,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage orders" ON public.orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 1d. expert_tasks table
CREATE TABLE public.expert_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  assigned_to uuid,
  expert_type text NOT NULL,
  scope_tags jsonb DEFAULT '[]',
  scope_description text,
  estimated_price decimal DEFAULT 0,
  expert_note text,
  is_completed boolean DEFAULT false,
  assigned_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.expert_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage expert tasks" ON public.expert_tasks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 1e. audit_logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  field_name text,
  old_value text,
  new_value text,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- 1f. scope_tag_definitions table
CREATE TABLE public.scope_tag_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_name text NOT NULL UNIQUE,
  service_description text NOT NULL,
  expert_type text NOT NULL,
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0
);
ALTER TABLE public.scope_tag_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read scope tags" ON public.scope_tag_definitions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage scope tags" ON public.scope_tag_definitions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 1g. order_photos table
CREATE TABLE public.order_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  photo_type text NOT NULL DEFAULT 'before',
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.order_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage order photos" ON public.order_photos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 1h. Seed scope tags
INSERT INTO public.scope_tag_definitions (tag_name, service_description, expert_type, sort_order) VALUES
  ('Sole Separation', 'Advanced adhesive bonding for structural integrity', 'repair', 1),
  ('Heel Damage', 'Heel reconstruction and reinforcement', 'repair', 2),
  ('Toe Box Crease', 'Steam reshaping and crease guard installation', 'repair', 3),
  ('Stitching Repair', 'Hand re-stitching using original thread pattern', 'repair', 4),
  ('Deep Cleaning', 'Multi-stage deep clean with premium solvents', 'cleaning', 1),
  ('Stain Removal', 'Targeted stain extraction and treatment', 'cleaning', 2),
  ('Odor Treatment', 'Anti-bacterial deodorization', 'cleaning', 3),
  ('Midsole Whitening', 'Oxidation reversal and whitening', 'cleaning', 4),
  ('Full Repaint', 'Complete colour restoration with custom matching', 'colour', 1),
  ('Touch Up', 'Spot colour correction and blending', 'colour', 2),
  ('Custom Art', 'Custom artistic design and hand-painting', 'colour', 3),
  ('Colour Change', 'Full colour transformation with protective seal', 'colour', 4);

-- 1i. Create order-photos storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('order-photos', 'order-photos', true);

-- Storage policies for order-photos
CREATE POLICY "Authenticated users can upload order photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'order-photos');
CREATE POLICY "Authenticated users can view order photos" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'order-photos');
CREATE POLICY "Authenticated users can delete order photos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'order-photos');
CREATE POLICY "Public can view order photos" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'order-photos');

-- 1j. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expert_tasks;

-- Trigger for updated_at on orders
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
