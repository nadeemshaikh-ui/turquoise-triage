
-- orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_declared boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS packing_photo_url text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_loyalty_vip boolean DEFAULT false;

-- order_discoveries table
ALTER TABLE order_discoveries ADD COLUMN IF NOT EXISTS discovery_photo_url text;

-- system_settings table
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS company_upi_id text;
