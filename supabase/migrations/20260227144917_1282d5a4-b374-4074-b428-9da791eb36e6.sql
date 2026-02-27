
-- 1. Expected item count on leads
ALTER TABLE public.leads ADD COLUMN expected_item_count integer NOT NULL DEFAULT 1;

-- 2. Physical manifest check-in on orders
ALTER TABLE public.orders ADD COLUMN expected_item_count integer NOT NULL DEFAULT 1;
ALTER TABLE public.orders ADD COLUMN checked_in_items jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.orders ADD COLUMN checkin_confirmed boolean NOT NULL DEFAULT false;

-- 3. Slot booking on orders
ALTER TABLE public.orders ADD COLUMN pickup_slot text;
ALTER TABLE public.orders ADD COLUMN dropoff_slot text;

-- 4. Logistics slots in system_settings
ALTER TABLE public.system_settings ADD COLUMN pickup_slots jsonb NOT NULL DEFAULT '["Morning (10 AM - 12 PM)", "Evening (4 PM - 6 PM)"]';
ALTER TABLE public.system_settings ADD COLUMN dropoff_slots jsonb NOT NULL DEFAULT '["Morning (10 AM - 12 PM)", "Evening (4 PM - 6 PM)"]';
