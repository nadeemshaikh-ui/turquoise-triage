
-- =========================================================
-- Step 1: Change default (data already migrated via INSERT tool)
-- =========================================================
ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'created';

-- =========================================================
-- Step 2: Add columns to leads
-- =========================================================
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS converted_order_id uuid,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS original_order_id uuid,
  ADD COLUMN IF NOT EXISTS photos_pending boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'open';

-- =========================================================
-- Step 3: Add columns to orders
-- =========================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_date date,
  ADD COLUMN IF NOT EXISTS delivery_address_mode text NOT NULL DEFAULT 'same_as_pickup',
  ADD COLUMN IF NOT EXISTS delivery_address jsonb,
  ADD COLUMN IF NOT EXISTS certificate_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS certificate_url text,
  ADD COLUMN IF NOT EXISTS certificate_error text,
  ADD COLUMN IF NOT EXISTS google_review_prompted_at timestamptz;

-- =========================================================
-- Step 4: CHECK constraints
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_status_check') THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_status_check
      CHECK (status IN (
        'created','pickup_scheduled','received','inspection','in_progress','qc',
        'ready','delivered','declined','cancelled','quoted','consult','triage'
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_delivery_mode_check') THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_delivery_mode_check
      CHECK (delivery_address_mode IN ('same_as_pickup','new'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_certificate_status_check') THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_certificate_status_check
      CHECK (certificate_status IN ('pending','generated','failed'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_source_check') THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_source_check
      CHECK (source IN ('new','rework'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_lifecycle_status_check') THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_lifecycle_status_check
      CHECK (lifecycle_status IN ('open','converted','closed'));
  END IF;
END $$;

-- =========================================================
-- Step 5: New tables
-- =========================================================
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  category text NOT NULL,
  brand text NOT NULL,
  service_type text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_category_check') THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_category_check
      CHECK (category IN ('Bag','Shoe','Belt','Wallet'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_brand_check') THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_brand_check
      CHECK (length(trim(brand)) >= 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_service_type_check') THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_service_type_check
      CHECK (service_type IN ('restoration','repair','cleaning','dye','hardware','spa'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_order_items_order_sort
  ON public.order_items(order_id, sort_order);

CREATE TABLE IF NOT EXISTS public.order_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  action text NOT NULL,
  payload_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, action, payload_hash)
);

-- =========================================================
-- Step 6: Unique partial index for one open rework per order
-- =========================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_rework
  ON public.leads(original_order_id)
  WHERE source = 'rework' AND lifecycle_status = 'open';

-- =========================================================
-- Step 7: Helper functions
-- =========================================================
CREATE OR REPLACE FUNCTION public.can_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    public.has_role(auth.uid(), 'staff')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin');
$$;

-- =========================================================
-- Step 8: RLS for new tables
-- =========================================================
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_items_staff_all ON public.order_items;
CREATE POLICY order_items_staff_all
ON public.order_items FOR ALL
USING (public.can_staff())
WITH CHECK (public.can_staff());

DROP POLICY IF EXISTS order_actions_staff_all ON public.order_actions;
CREATE POLICY order_actions_staff_all
ON public.order_actions FOR ALL
USING (public.can_staff())
WITH CHECK (public.can_staff());

-- =========================================================
-- Step 9: RPC - convert_lead_to_order
-- =========================================================
CREATE OR REPLACE FUNCTION public.convert_lead_to_order(p_lead_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_order_id uuid;
  v_items_count int;
  v_photo_ok_count int;
BEGIN
  IF NOT public.can_staff() THEN
    RAISE EXCEPTION 'staff_only';
  END IF;

  SELECT * INTO v_lead
  FROM public.leads
  WHERE id = p_lead_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;

  IF v_lead.converted_order_id IS NOT NULL THEN
    RETURN v_lead.converted_order_id;
  END IF;

  IF v_lead.customer_id IS NULL THEN
    RAISE EXCEPTION 'customer_id is required';
  END IF;

  SELECT count(*) INTO v_items_count
  FROM public.lead_items
  WHERE lead_id = p_lead_id;

  IF v_items_count = 0 THEN
    RAISE EXCEPTION 'lead_items required';
  END IF;

  SELECT count(*) INTO v_photo_ok_count
  FROM public.lead_photos
  WHERE lead_id = p_lead_id
    AND storage_path IS NOT NULL
    AND length(trim(storage_path)) > 0;

  IF v_photo_ok_count = 0 AND COALESCE(v_lead.photos_pending, false) = false THEN
    RAISE EXCEPTION 'photos required (or set photos_pending=true)';
  END IF;

  INSERT INTO public.orders (lead_id, customer_id, status, created_at, updated_at)
  VALUES (v_lead.id, v_lead.customer_id, 'created', now(), now())
  RETURNING id INTO v_order_id;

  -- Map lead_items IDs -> text names via JOINs
  INSERT INTO public.order_items (order_id, category, brand, service_type, sort_order)
  SELECT
    v_order_id,
    sc.name AS category,
    COALESCE(b.name, 'Unknown') AS brand,
    'restoration'::text AS service_type,
    COALESCE(li.sort_order, 0)
  FROM public.lead_items li
  JOIN public.service_categories sc ON sc.id = li.category_id
  LEFT JOIN public.brands b ON b.id = li.brand_id
  WHERE li.lead_id = p_lead_id
  ORDER BY COALESCE(li.sort_order, 0);

  -- Hard stop if brand resolved to Unknown
  IF EXISTS (
    SELECT 1 FROM public.order_items
    WHERE order_id = v_order_id AND brand = 'Unknown'
  ) THEN
    RAISE EXCEPTION 'brand_id missing/invalid on lead_items; cannot convert';
  END IF;

  -- Clone photos
  INSERT INTO public.order_photos (order_id, storage_path, file_name, uploaded_at)
  SELECT
    v_order_id,
    lp.storage_path,
    lp.file_name,
    now()
  FROM public.lead_photos lp
  WHERE lp.lead_id = p_lead_id
    AND lp.storage_path IS NOT NULL
    AND length(trim(lp.storage_path)) > 0;

  UPDATE public.leads
  SET converted_order_id = v_order_id,
      lifecycle_status = 'converted'
  WHERE id = p_lead_id;

  RETURN v_order_id;
END;
$$;

-- =========================================================
-- Step 10: RPC - transition_order_status
-- =========================================================
CREATE OR REPLACE FUNCTION public.transition_order_status(
  p_order_id uuid,
  p_to_status text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_order_photo_count int;
BEGIN
  IF NOT public.can_staff() THEN
    RAISE EXCEPTION 'staff_only';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF p_to_status NOT IN (
    'created','pickup_scheduled','received','inspection','in_progress','qc',
    'ready','delivered','declined','cancelled','quoted','consult','triage'
  ) THEN
    RAISE EXCEPTION 'Invalid status: %', p_to_status;
  END IF;

  -- Gate: pickup_scheduled requires pickup_date
  IF p_to_status = 'pickup_scheduled' THEN
    IF v_order.pickup_date IS NULL THEN
      RAISE EXCEPTION 'pickup_date required';
    END IF;
    IF v_order.pickup_date < CURRENT_DATE THEN
      RAISE EXCEPTION 'pickup_date cannot be in the past';
    END IF;
  END IF;

  -- Gate: inspection requires photos
  IF p_to_status = 'inspection' THEN
    SELECT count(*) INTO v_order_photo_count
    FROM public.order_photos
    WHERE order_id = p_order_id;

    IF v_order_photo_count = 0 THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = v_order.lead_id
          AND COALESCE(l.photos_pending, false) = true
      ) THEN
        RAISE EXCEPTION 'At least one photo required (or photos_pending=true)';
      END IF;
    END IF;
  END IF;

  -- Gate: ready requires delivery address if mode=new
  IF p_to_status = 'ready' THEN
    IF v_order.delivery_address_mode = 'new' AND v_order.delivery_address IS NULL THEN
      RAISE EXCEPTION 'delivery_address required when delivery_address_mode=new';
    END IF;
    UPDATE public.orders
    SET certificate_status = 'pending', certificate_error = NULL
    WHERE id = p_order_id;
  END IF;

  -- Gate: delivered requires payment_declared
  IF p_to_status = 'delivered' THEN
    IF COALESCE(v_order.payment_declared, false) = false THEN
      RAISE EXCEPTION 'Payment must be declared before delivery';
    END IF;
  END IF;

  UPDATE public.orders
  SET status = p_to_status,
      sla_start = CASE
        WHEN p_to_status = 'in_progress' AND v_order.sla_start IS NULL THEN now()
        ELSE v_order.sla_start
      END,
      updated_at = now()
  WHERE id = p_order_id;
END;
$$;

-- =========================================================
-- Step 11: RPC - request_rework
-- =========================================================
CREATE OR REPLACE FUNCTION public.request_rework(
  p_order_id uuid,
  p_reason text,
  p_photos_pending boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing uuid;
  v_order public.orders%ROWTYPE;
  v_photo_count int;
BEGIN
  -- Service-role calls from edge functions bypass RLS and this check
  -- For direct client calls, require staff
  IF NOT public.can_staff() THEN
    RAISE EXCEPTION 'staff_only';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Rework reason is required';
  END IF;

  -- Idempotent: return existing open rework
  SELECT id INTO v_existing
  FROM public.leads
  WHERE original_order_id = p_order_id
    AND source = 'rework'
    AND lifecycle_status = 'open'
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  SELECT count(*) INTO v_photo_count
  FROM public.order_photos
  WHERE order_id = p_order_id;

  IF v_photo_count = 0 AND COALESCE(p_photos_pending, false) = false THEN
    RAISE EXCEPTION 'Rework requires at least one photo or photos_pending=true';
  END IF;

  INSERT INTO public.leads (
    customer_id, status, lifecycle_status, notes,
    source, original_order_id, photos_pending, quoted_price
  ) VALUES (
    v_order.customer_id,
    'New',
    'open',
    'Rework: ' || trim(p_reason) || ' (Order ' || p_order_id || ')',
    'rework',
    p_order_id,
    COALESCE(p_photos_pending, false),
    0
  )
  RETURNING id INTO v_existing;

  RETURN v_existing;
END;
$$;
