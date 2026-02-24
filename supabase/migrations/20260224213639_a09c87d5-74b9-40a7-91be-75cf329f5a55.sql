
-- Add issue_tags and condition_note to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS issue_tags jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS condition_note text;

-- Create lead_quotes table
CREATE TABLE public.lead_quotes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  quote_token text NOT NULL UNIQUE,
  premium_price numeric NOT NULL DEFAULT 0,
  elite_price numeric NOT NULL DEFAULT 0,
  premium_tat_min integer NOT NULL DEFAULT 15,
  premium_tat_max integer NOT NULL DEFAULT 20,
  elite_tat_min integer NOT NULL DEFAULT 8,
  elite_tat_max integer NOT NULL DEFAULT 12,
  viewed_at timestamptz,
  accepted_tier text,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_quotes ENABLE ROW LEVEL SECURITY;

-- Authenticated users can manage quotes
CREATE POLICY "Authenticated users can manage lead quotes"
  ON public.lead_quotes FOR ALL
  USING (true)
  WITH CHECK (true);

-- Public SELECT by quote_token (for unauthenticated quote page)
CREATE POLICY "Public can view quotes by token"
  ON public.lead_quotes FOR SELECT
  USING (true);
