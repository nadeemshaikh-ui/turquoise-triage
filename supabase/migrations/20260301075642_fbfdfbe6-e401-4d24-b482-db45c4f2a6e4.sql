
-- Add unique constraint on phone (duplicates already cleaned)
ALTER TABLE public.customers
  ADD CONSTRAINT customers_phone_unique UNIQUE (phone);
