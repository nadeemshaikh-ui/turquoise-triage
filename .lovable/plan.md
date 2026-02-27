

# Self-Healing QA Engine with 3 Zenith OS Upgrades

## Overview

Upgrade the existing Diagnostics tab into a fully autonomous Self-Healing QA Engine with Ghost Order E2E simulation, RLS security verification, a nightly healing edge function on a cron schedule, and a healing logs dashboard. Includes the 3 critical Zenith OS upgrades: GST-aware Ghost Test, SLA Discovery Pause, and Batch Phone Integrity Check.

---

## Pre-requisite: Database Migration

### New columns on `orders` table
```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_gst_applicable boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discovery_pending boolean DEFAULT false;
```

### New table: `system_health_logs`
```sql
CREATE TABLE public.system_health_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT now(),
  run_type text NOT NULL DEFAULT 'nightly',
  errors_found integer NOT NULL DEFAULT 0,
  fixes_applied integer NOT NULL DEFAULT 0,
  ghost_test_passed boolean DEFAULT null,
  rls_test_passed boolean DEFAULT null,
  notes text,
  details jsonb DEFAULT '{}'
);
-- RLS: authenticated can SELECT and INSERT
-- Enable realtime
```

---

## Step 1: Ghost Order E2E Simulation (Zenith Upgrade 1)

Added to `DiagnosticsTab.tsx` as Check E.

### Simulation Steps:
1. Create dummy `asset_passport` (customer_id = current user, item_category = '_ghost_test', brand = '_diag')
2. Create dummy `orders` (linked to ghost asset, package_tier = 'standard', shipping_fee = 100, cleaning_fee = 299, discount_amount = 50, is_gst_applicable = true)
3. Create dummy `expert_tasks` (order_id = ghost order, expert_type = 'repair', estimated_price = 500)
4. **Pricing Verification with GST**:
   - Subtotal = SUM(tasks) + shipping + cleaning = 500 + 100 + 299 = 899
   - After discount = 899 - 50 = 849
   - With GST (18%) = 849 * 1.18 = 1001.82
   - Verify this exact value matches the expected calculation
5. Upload a tiny text file to `order-photos` bucket
6. **Cleanup**: Delete storage file, then delete order (cascades tasks/photos), then delete asset passport
7. If ANY step fails or the math doesn't match exactly, flag as **CRITICAL CODE ERROR** with the failed step

### Result type:
```typescript
type GhostResult = {
  passed: boolean;
  failedStep?: string;
  error?: string;
  expectedTotal?: number;
  calculatedTotal?: number;
}
```

---

## Step 2: RLS Security Integrity Check

Added to `DiagnosticsTab.tsx` as Check F.

1. Create a separate Supabase client using the anon key with NO auth session
2. Attempt to query `audit_logs` using this unauthenticated client
3. If rows are returned, flag as **CRITICAL: RLS BYPASS DETECTED**
4. If properly blocked (error or empty), mark as **PASS**

```typescript
import { createClient } from '@supabase/supabase-js';
const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const { data, error } = await anonClient.from('audit_logs').select('id').limit(1);
// data with rows = FAIL, error or empty = PASS
```

---

## Step 3: Batch Phone Integrity Check (Zenith Upgrade 3)

Added to the existing Orphan Check diagnostic (Check B) as a sub-section.

### Logic:
- Query all orders, grouped by `customer_id`
- For each customer with multiple orders, check if `customer_phone` values are inconsistent
- Flag any customer where orders have differing phone numbers, as this breaks the Multi-Item Wardrobe portal view

### Result type:
```typescript
type PhoneMismatch = {
  customerId: string;
  customerName: string;
  phones: string[];  // distinct phone values
  orderCount: number;
}
```

Displayed as a third sub-section inside the Orphan Check DiagCard: "Phone Mismatches (same customer, different phones)"

### Auto-Resolve for Phone Mismatches:
Not auto-resolved (requires human decision on which phone is correct). Displayed as a warning-only item that does not count toward the "fixable" total.

---

## Step 4: Nightly Data Healer Edge Function (Zenith Upgrade 2)

### File: `supabase/functions/nightly-data-healer/index.ts`

Uses the service role key to perform healing operations.

### Healing Logic (4 checks):

**A. Math Integrity**: Recalculates total_price for all non-delivered orders using:
```
subtotal = SUM(tasks, excluding cleaning if bundle) + shipping + cleaning
discounted = subtotal - discount_amount
final = is_gst_applicable ? discounted * 1.18 : discounted
```
Overwrites mismatched `total_price`.

**B. Orphan Healing**: Creates "Unknown" asset passports for orders missing `asset_id`. Deletes orphaned `expert_tasks` with no matching order.

**C. SLA Healing (Zenith Upgrade 2 - Discovery Pause)**:
- Only patches orders where `status = 'consult'` AND `consultation_start_time IS NULL` AND `discovery_pending = false`
- Orders with `discovery_pending = true` are SKIPPED (they are waiting for approval)
- Patches using the order's `updated_at` timestamp

**D. Phone Mismatch Detection**: Logs inconsistencies but does NOT auto-fix (human decision required).

### Logging:
Inserts results into `system_health_logs` with `run_type = 'nightly'`, `errors_found`, `fixes_applied`, and a `details` JSONB breakdown.

### Config:
```toml
[functions.nightly-data-healer]
verify_jwt = false
```

### Cron Schedule (2:00 AM daily):
Uses `pg_cron` + `pg_net` to call the edge function. Configured via the insert tool (not migration) since it contains project-specific URLs/keys.

```sql
SELECT cron.schedule(
  'nightly-data-healer',
  '0 2 * * *',
  $$ SELECT net.http_post(...) $$
);
```

---

## Step 5: DiagnosticsTab UI Overhaul

### Updated Progress: 8 steps (each ~12.5%)
1. Math Integrity (existing)
2. Orphan Check + Phone Batch Integrity (existing + new sub-check)
3. SLA Integrity (existing, updated to skip discovery_pending)
4. Storage Check (existing)
5. Ghost Order E2E (new)
6. RLS Security (new)

Progress bar now goes through 6 major checks at ~16.6% each.

### New DiagCards:
- **Ghost Order E2E** (icon: `TestTube2`): Shows PASS/FAIL. If failed, shows the step that broke and expected vs calculated total.
- **RLS Security** (icon: `ShieldCheck`): Shows PASS/FAIL for RLS verification.

### Updated Orphan DiagCard:
Third sub-section: "Phone Mismatches" table showing customer name, distinct phone numbers, and order count. Displayed as amber warning (not auto-fixable).

### Updated SLA Check:
Frontend SLA diagnostic also skips orders where `discovery_pending = true`, matching the edge function behavior.

### New Section: Autonomous Healing Logs
Below the manual diagnostics, separated by a divider:
- Title: "Autonomous Healing Logs"
- Fetches latest 20 rows from `system_health_logs` ordered by `run_at DESC`
- Table columns: Date/Time, Type (nightly/manual), Errors Found, Fixes Applied, Ghost Test, RLS Test, Notes
- Color-coded rows: green (0 errors), amber (errors found + fixed), red (ghost/rls test failed)
- "Run Manual Heal" button that invokes the `nightly-data-healer` edge function on-demand with `run_type = 'manual'`, then refreshes the logs table

---

## Files Summary

### New files (1):
1. `supabase/functions/nightly-data-healer/index.ts` -- Autonomous healing edge function with discovery_pending awareness

### Modified files (2):
1. `src/components/admin/DiagnosticsTab.tsx` -- Ghost Order E2E, RLS check, phone batch integrity, healing logs section, discovery_pending-aware SLA check
2. `src/components/orders/PricingEngine.tsx` -- Updated formula to include discount_amount and GST calculation

### Database:
1. Migration: Add `discount_amount`, `is_gst_applicable`, `discovery_pending` columns to `orders`. Create `system_health_logs` table with RLS.
2. Insert (non-migration): Enable `pg_cron` + `pg_net`, schedule nightly cron job.

### Config:
1. `supabase/config.toml` -- Add `nightly-data-healer` function entry (auto-managed)

---

## Technical Notes

### Updated Pricing Formula (everywhere):
```
subtotal = SUM(expert_tasks.estimated_price [exclude cleaning if bundle]) + shipping_fee + cleaning_fee
discounted = subtotal - discount_amount
total_price = is_gst_applicable ? round(discounted * 1.18, 2) : discounted
```

This formula must be consistent across:
- `useOrderDetail.ts` `recalcTotalPrice()` function
- `PricingEngine.tsx` display and save
- `DiagnosticsTab.tsx` Math Integrity check
- `nightly-data-healer` edge function
- Ghost Order E2E verification

### Discovery Pending Guard:
The `discovery_pending` boolean on orders acts as a pause flag. When true:
- SLA timer should not be auto-patched by the healer
- The SLA diagnostic should not flag it as an error
- This prevents the system from overwriting timestamps on orders awaiting expert discovery approval

