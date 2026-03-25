

# Fix Meta Ad Spend Upsert

## Problem
The `fetch-meta-data` edge function crashes with `duplicate key value violates unique constraint "uq_meta_ad_spend_date_ad_name"` because the delete-then-insert strategy has a race condition or partial failure, leaving existing rows that conflict on insert.

## Solution
Replace `.insert(chunk)` with `.upsert(chunk, { onConflict: 'date,ad_name' })` in the edge function. This uses Supabase JS SDK's built-in upsert which maps to `ON CONFLICT DO UPDATE`. The existing delete step can be kept as a best-effort cleanup but is no longer critical.

## Changes

**File: `supabase/functions/fetch-meta-data/index.ts`** (line 119)
- Change: `.insert(chunk)` → `.upsert(chunk, { onConflict: 'date,ad_name' })`
- This single change ensures that if a row with the same `(date, ad_name)` already exists, it gets overwritten with fresh data instead of throwing an error.

No database migration needed -- the unique constraint `uq_meta_ad_spend_date_ad_name` already exists and serves as the conflict target.

