
-- =============================================
-- MIGRATION B: DB Functions
-- =============================================

-- C1: advance_portal_stage
CREATE OR REPLACE FUNCTION public.advance_portal_stage(
  p_lead_id uuid,
  p_action text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_package_id uuid;
  v_pkg_exists boolean;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_order_id uuid;
BEGIN
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'p_actor_user_id is required';
  END IF;

  SELECT * INTO v_lead
  FROM public.leads
  WHERE id = p_lead_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;

  IF p_action = 'select_package' THEN
    IF v_lead.portal_stage <> 'AwaitingSelection' THEN
      RAISE EXCEPTION 'Invalid stage for select_package: %', v_lead.portal_stage;
    END IF;

    v_package_id := (p_payload->>'package_id')::uuid;
    IF v_package_id IS NULL THEN
      RAISE EXCEPTION 'package_id is required';
    END IF;

    SELECT EXISTS(SELECT 1 FROM public.package_settings WHERE id = v_package_id AND is_active = true)
    INTO v_pkg_exists;
    IF NOT v_pkg_exists THEN
      RAISE EXCEPTION 'Invalid or inactive package';
    END IF;

    UPDATE public.leads
    SET selected_package_id = v_package_id,
        package_selected_at = now(),
        portal_stage = 'Scheduling'
    WHERE id = p_lead_id;

    RETURN jsonb_build_object('lead_id', p_lead_id, 'portal_stage', 'Scheduling', 'order_id', null);

  ELSIF p_action = 'select_pickup' THEN
    IF v_lead.portal_stage <> 'Scheduling' THEN
      RAISE EXCEPTION 'Invalid stage for select_pickup: %', v_lead.portal_stage;
    END IF;

    v_start_at := (p_payload->>'start_at')::timestamptz;
    v_end_at := (p_payload->>'end_at')::timestamptz;

    IF v_start_at IS NULL OR v_end_at IS NULL THEN
      RAISE EXCEPTION 'start_at and end_at are required';
    END IF;
    IF v_end_at <= v_start_at THEN
      RAISE EXCEPTION 'end_at must be after start_at';
    END IF;

    UPDATE public.leads
    SET pickup_slot_start_at = v_start_at,
        pickup_slot_end_at = v_end_at
    WHERE id = p_lead_id;

    RETURN jsonb_build_object('lead_id', p_lead_id, 'portal_stage', 'Scheduling', 'order_id', null);

  ELSIF p_action = 'approve' THEN
    IF v_lead.portal_stage <> 'Scheduling' THEN
      RAISE EXCEPTION 'Invalid stage for approve: %', v_lead.portal_stage;
    END IF;
    IF v_lead.selected_package_id IS NULL THEN
      RAISE EXCEPTION 'Package must be selected before approval';
    END IF;
    IF v_lead.pickup_slot_start_at IS NULL THEN
      RAISE EXCEPTION 'Pickup slot must be set before approval';
    END IF;

    UPDATE public.leads
    SET approved_at = now(),
        portal_stage = 'Approved'
    WHERE id = p_lead_id;

    -- Call conversion
    SELECT public.convert_lead_to_order(p_lead_id, p_actor_user_id) INTO v_order_id;

    RETURN jsonb_build_object('lead_id', p_lead_id, 'portal_stage', 'Approved', 'order_id', v_order_id);
  ELSE
    RAISE EXCEPTION 'Unknown action: %', p_action;
  END IF;
END;
$$;

-- C2: Updated convert_lead_to_order (new signature with p_actor_user_id)
DROP FUNCTION IF EXISTS public.convert_lead_to_order(uuid);

CREATE OR REPLACE FUNCTION public.convert_lead_to_order(p_lead_id uuid, p_actor_user_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_order_id uuid;
  v_items_count int;
  v_photo_ok_count int;
  v_warranty_days int;
  v_actor uuid;
  v_item record;
  v_order_item_id uuid;
  v_snapshot_url text;
BEGIN
  -- Determine actor: explicit param > auth.uid()
  v_actor := COALESCE(p_actor_user_id, auth.uid());

  -- Staff can convert directly; portal path requires Approved stage
  IF NOT public.can_staff() AND v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_lead
  FROM public.leads
  WHERE id = p_lead_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;

  -- Idempotent: if already converted, return existing order
  IF v_lead.converted_order_id IS NOT NULL THEN
    RETURN v_lead.converted_order_id;
  END IF;

  -- Check for existing order by lead_id (belt-and-suspenders)
  SELECT id INTO v_order_id FROM public.orders WHERE lead_id = p_lead_id LIMIT 1;
  IF v_order_id IS NOT NULL THEN
    UPDATE public.leads SET converted_order_id = v_order_id WHERE id = p_lead_id;
    RETURN v_order_id;
  END IF;

  -- Portal path requires Approved; staff can bypass
  IF NOT public.can_staff() AND v_lead.portal_stage <> 'Approved' THEN
    RAISE EXCEPTION 'Lead must be Approved for portal conversion';
  END IF;

  IF v_lead.customer_id IS NULL THEN
    RAISE EXCEPTION 'customer_id is required';
  END IF;

  SELECT count(*) INTO v_items_count FROM public.lead_items WHERE lead_id = p_lead_id;
  IF v_items_count = 0 THEN
    RAISE EXCEPTION 'lead_items required';
  END IF;

  SELECT count(*) INTO v_photo_ok_count
  FROM public.lead_photos
  WHERE lead_id = p_lead_id AND storage_path IS NOT NULL AND length(trim(storage_path)) > 0;

  IF v_photo_ok_count = 0 AND COALESCE(v_lead.photos_pending, false) = false THEN
    RAISE EXCEPTION 'photos required (or set photos_pending=true)';
  END IF;

  -- Snapshot warranty days from package
  v_warranty_days := 0;
  IF v_lead.selected_package_id IS NOT NULL THEN
    SELECT warranty_days INTO v_warranty_days
    FROM public.package_settings
    WHERE id = v_lead.selected_package_id;
  END IF;

  -- Create order
  INSERT INTO public.orders (
    lead_id, customer_id, status, created_by_user_id,
    package_id, warranty_days_snapshot,
    created_at, updated_at
  ) VALUES (
    p_lead_id, v_lead.customer_id, 'created', v_actor,
    v_lead.selected_package_id, COALESCE(v_warranty_days, 0),
    now(), now()
  ) RETURNING id INTO v_order_id;

  -- Create order_items with snapshots
  FOR v_item IN
    SELECT li.id as li_id, sc.name as category_name, COALESCE(b.name, 'Unknown') as brand_name,
           li.service_type, li.sort_order, li.description
    FROM public.lead_items li
    JOIN public.service_categories sc ON sc.id = li.category_id
    LEFT JOIN public.brands b ON b.id = li.brand_id
    WHERE li.lead_id = p_lead_id
    ORDER BY COALESCE(li.sort_order, 0)
  LOOP
    IF v_item.brand_name = 'Unknown' THEN
      RAISE EXCEPTION 'brand_id missing/invalid on lead_items; cannot convert';
    END IF;

    -- Get earliest photo URL for this item
    SELECT lp.storage_path INTO v_snapshot_url
    FROM public.lead_photos lp
    WHERE lp.lead_item_id = v_item.li_id
      AND lp.storage_path IS NOT NULL AND length(trim(lp.storage_path)) > 0
    ORDER BY lp.uploaded_at ASC
    LIMIT 1;

    INSERT INTO public.order_items (
      order_id, category, brand, service_type, sort_order,
      remarks_snapshot, primary_image_url_snapshot
    ) VALUES (
      v_order_id, v_item.category_name, v_item.brand_name,
      COALESCE(v_item.service_type, 'restoration'),
      COALESCE(v_item.sort_order, 0),
      v_item.description,
      v_snapshot_url
    ) RETURNING id INTO v_order_item_id;

    -- Copy photos into order_item_photos (bulletproof snapshot)
    INSERT INTO public.order_item_photos (order_item_id, url, kind, created_at)
    SELECT v_order_item_id, lp.storage_path, 'before', now()
    FROM public.lead_photos lp
    WHERE lp.lead_item_id = v_item.li_id
      AND lp.storage_path IS NOT NULL AND length(trim(lp.storage_path)) > 0;
  END LOOP;

  -- Clone order-level photos
  INSERT INTO public.order_photos (order_id, storage_path, file_name, uploaded_at)
  SELECT v_order_id, lp.storage_path, lp.file_name, now()
  FROM public.lead_photos lp
  WHERE lp.lead_id = p_lead_id
    AND lp.storage_path IS NOT NULL AND length(trim(lp.storage_path)) > 0;

  -- Mark lead as converted
  UPDATE public.leads
  SET converted_order_id = v_order_id,
      lifecycle_status = 'converted'
  WHERE id = p_lead_id;

  RETURN v_order_id;
END;
$$;

-- C3: set_delivered_at
CREATE OR REPLACE FUNCTION public.set_delivered_at(p_order_id uuid, p_delivered_at timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_warranty_days int;
BEGIN
  IF NOT public.can_staff() THEN
    RAISE EXCEPTION 'staff_only';
  END IF;

  SELECT warranty_days_snapshot INTO v_warranty_days
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  UPDATE public.orders
  SET delivered_at = p_delivered_at, updated_at = now()
  WHERE id = p_order_id;

  UPDATE public.order_items
  SET warranty_start_at = p_delivered_at,
      warranty_end_at = p_delivered_at + (v_warranty_days * interval '1 day')
  WHERE order_id = p_order_id;
END;
$$;
