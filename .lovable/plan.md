

# Restoree 360 Total Architecture v3.4 -- Implementation Plan

## Pre-Flight Assessment

**Already implemented (v2.0):**
- `leads.tat_is_manual` column exists
- `leads_status_check` includes 'Quoted'
- `lead_photos.lead_item_id` FK with ON DELETE CASCADE
- Pre-quote validation gate, canonical service pills, TAT manual lock in LeadDetail.tsx
- `convert_lead_to_order`, `transition_order_status`, `request_rework` RPCs exist
- `orders.lead_id` column exists (nullable uuid)

**Critical compatibility notes:**
- `orders.created_by_user_id` CANNOT be NOT NULL -- existing orders have no value. Will be nullable with a backfill strategy.
- `lead_items` uses `category_id` (uuid FK to service_categories), not a text `category` column. The "Others" category must be added as a row in `service_categories`, and `custom_category_label` CHECK must reference `category_id` matching the Others row (or be enforced in application code).
- `lead_photos.lead_item_id` is nullable (orphaned photos exist). Cannot change to NOT NULL without data migration. Will keep nullable.
- `invoice_line_items.amount` will use a BEFORE INSERT/UPDATE trigger (GENERATED ALWAYS AS STORED has limitations with some Supabase operations).

---

## Phase 1: Database Migration A -- Tables, Columns, Constraints

### A1: package_settings
```sql
CREATE TABLE public.package_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  warranty_days int NOT NULL CHECK (warranty_days >= 0),
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (lower(trim(name)))
);
ALTER TABLE public.package_settings ENABLE ROW LEVEL SECURITY;
```
Seed: ('Normal', 90, true), ('Elite', 180, true)

### A2: leads -- portal stage columns
Add columns:
- `portal_stage` text NOT NULL DEFAULT 'AwaitingSelection'
- `selected_package_id` uuid NULL REFERENCES package_settings(id)
- `package_selected_at` timestamptz NULL
- `pickup_slot_start_at` timestamptz NULL
- `pickup_slot_end_at` timestamptz NULL
- `approved_at` timestamptz NULL

Add CHECK: `portal_stage IN ('AwaitingSelection','Scheduling','Approved')`
Add CHECK: pickup_slot_end_at > pickup_slot_start_at (when both non-null)

### A3: orders -- delivery, creator, package, warranty snapshot
Add columns:
- `delivered_at` timestamptz NULL
- `created_by_user_id` uuid NULL REFERENCES auth.users(id) -- nullable for backward compat
- `package_id` uuid NULL REFERENCES package_settings(id)
- `warranty_days_snapshot` int NOT NULL DEFAULT 0 CHECK (warranty_days_snapshot >= 0)

Add partial unique index: `UNIQUE (lead_id) WHERE lead_id IS NOT NULL` -- prevent duplicate conversions

### A4: order_items -- immutable snapshots + warranty
Add columns:
- `remarks_snapshot` text NULL
- `primary_image_url_snapshot` text NULL
- `warranty_start_at` timestamptz NULL
- `warranty_end_at` timestamptz NULL

### A5: lead_items -- Others support
Add columns:
- `custom_category_label` text NULL

Insert 'Others' row into `service_categories` if not exists.
Application-level enforcement: if category is 'Others', require custom_category_label.

### A6: Restoration add-ons
```text
addons_master (id, name, is_active) UNIQUE(lower(trim(name)))
pricing_addons_master (id, category, addon_id FK, price, is_active)
lead_item_addons (id, lead_item_id FK CASCADE, addon_id FK, price_at_time) UNIQUE(lead_item_id, addon_id)
```

### A7: Invoices
```text
invoices (id, order_id FK UNIQUE, public_url, issued_at)
invoice_line_items (id, invoice_id FK CASCADE, order_item_id FK nullable, label, qty, unit_price, amount)
```
Trigger: BEFORE INSERT/UPDATE on invoice_line_items SET amount = qty * unit_price.

### A8: Ratings + Disputes
```text
ratings (id, order_id FK CASCADE, stars CHECK 1-5, created_at) UNIQUE(order_id)
disputes (id, order_id FK CASCADE, reason, created_at) UNIQUE(order_id)
```

### A9: order_item_photos (snapshot storage)
```text
order_item_photos (id, order_item_id FK CASCADE, url, kind DEFAULT 'before', created_at)
```

### RLS Policies (all new tables)
- `package_settings`: SELECT for authenticated, ALL for can_staff()
- `addons_master`, `pricing_addons_master`: SELECT for authenticated, ALL for can_staff()
- `lead_item_addons`: ALL for can_staff()
- `invoices`, `invoice_line_items`: ALL for can_staff()
- `ratings`, `disputes`: ALL for can_staff()
- `order_item_photos`: ALL for can_staff()

---

## Phase 2: Database Migration B -- Functions

### C1: advance_portal_stage(p_lead_id uuid, p_action text, p_payload jsonb, p_actor_user_id uuid)
SECURITY DEFINER, SET search_path = public, pg_temp

- Validates p_actor_user_id IS NOT NULL
- Locks lead row FOR UPDATE
- Actions:
  - `select_package`: AwaitingSelection -> Scheduling (sets selected_package_id, package_selected_at)
  - `select_pickup`: sets pickup_slot_start_at/end_at (validates end > start)
  - `approve`: Scheduling -> Approved (requires package + pickup), calls convert_lead_to_order, returns order_id
- Returns JSON: {lead_id, portal_stage, order_id}

### C2: Updated convert_lead_to_order(p_lead_id uuid, p_actor_user_id uuid)
SECURITY DEFINER

- Requires portal_stage = 'Approved' (for portal path) OR can_staff() (for admin manual conversion)
- Idempotent: if order exists for lead_id, return it
- Sets created_by_user_id = p_actor_user_id (NOT auth.uid())
- Snapshots warranty_days from package_settings
- Creates order_items with remarks_snapshot (from lead_items.description) and primary_image_url_snapshot (earliest lead_photo URL for that item)
- Copies photos into order_item_photos table
- The existing function signature changes from (p_lead_id uuid) to (p_lead_id uuid, p_actor_user_id uuid) -- need to handle the old call site in LeadDetail.tsx

### C3: set_delivered_at(p_order_id uuid, p_delivered_at timestamptz)
SECURITY DEFINER, requires can_staff()

- Sets orders.delivered_at
- Updates each order_item: warranty_start_at = delivered_at, warranty_end_at = delivered_at + warranty_days_snapshot days

---

## Phase 3: Frontend Changes

### D1: LeadDetail.tsx -- Digital Wardrobe
When lead.customerId exists, query completed orders:
- `orders.status = 'Completed' AND delivered_at IS NOT NULL AND customer_id = lead.customerId` (note: current order status uses lowercase -- query both 'Completed' and 'delivered' for safety)
- Join order_items for snapshot data
- Display cards: primary_image_url_snapshot, delivered_at as service date, warranty countdown, invoice link
- 7-day dispute gate: "Raise Dispute" button only if now() < delivered_at + 7 days
- Rating widget: 1-5 stars, if 5 -> Google Review CTA

### D2: LeadDetail.tsx -- "Others" category pill
- Add "Others" to CATEGORY_PILLS
- When selected, show required "Custom Category Label" text input
- Store in lead_items.custom_category_label
- Validation: block if Others selected but label empty

### D3: LeadDetail.tsx -- Restoration Add-ons
When service_type is 'restoration':
- Query pricing_addons_master for active add-ons matching the category
- Show multi-select checkboxes
- On toggle: insert/delete lead_item_addons with price_at_time
- Display: Base Price + Sum(Add-ons) = Total

### D4: useLeadDetail.ts
- Add portal_stage to LeadDetail interface and query

### D5: useOrderDetail.ts
- Add deliveredAt, createdByUserId, packageId, warrantyDaysSnapshot to OrderDetail interface
- Map new columns in query

### D6: OrderDetail.tsx -- Mark Delivered + Warranty
- Add "Mark Delivered" button (calls set_delivered_at RPC)
- Display warranty status on order items (countdown from warranty_end_at)
- Show delivered_at date

### D7: OrderDetail.tsx -- Invoice Section
- After order reaches ready/delivered: show invoice view
- Display itemized: base + add-on lines + totals
- Invoice public_url for future PDF

### D8: serve-portal edge function
- Add `advance_stage` action that calls advance_portal_stage RPC
- Extract actor user ID from JWT or pass explicitly
- Remove direct order status updates for approval flow (keep existing actions for backward compat)

### D9: Portal.tsx -- Stage-based flow
- Query portal_stage from leads (via serve-portal load)
- Step 1: Package Selection (Normal/Elite)
- Step 2: Pickup Scheduling
- Step 3: Approve (triggers conversion)

### D10: LeadDetail.tsx -- Convert to Order
- Update handleConvertToOrder to pass user.id as p_actor_user_id

---

## Execution Order

| Step | What | Dependencies |
|------|------|-------------|
| 1 | Migration A: all tables + columns + RLS | None |
| 2 | Seed data: package_settings, Others category | Migration A |
| 3 | Migration B: all 3 functions | Migration A |
| 4 | Update useLeadDetail.ts + useOrderDetail.ts | Migration A |
| 5 | Update LeadDetail.tsx (wardrobe, Others, add-ons, convert) | Steps 3-4 |
| 6 | Update OrderDetail.tsx (delivered, warranty, invoice) | Steps 3-4 |
| 7 | Update serve-portal edge function | Step 3 |
| 8 | Update Portal.tsx | Step 7 |

---

## Files Changed

| File | Summary |
|------|---------|
| Migration A | 9 new tables, alter leads/orders/order_items/lead_items, RLS, seed |
| Migration B | advance_portal_stage, convert_lead_to_order v2, set_delivered_at |
| `src/hooks/useLeadDetail.ts` | Add portal_stage field |
| `src/hooks/useOrderDetail.ts` | Add deliveredAt, warranty, package fields |
| `src/pages/LeadDetail.tsx` | Digital Wardrobe, Others pill, add-ons multi-select, updated convert call |
| `src/pages/OrderDetail.tsx` | Mark Delivered, warranty display, invoice section |
| `supabase/functions/serve-portal/index.ts` | advance_stage action via RPC |
| `src/pages/Portal.tsx` | Stage-based flow (package select, pickup, approve) |

## Files NOT Changed
- `useLeadItemPhotos.ts` -- already correct
- `src/integrations/supabase/client.ts` -- auto-generated
- `src/integrations/supabase/types.ts` -- auto-generated
- `supabase/config.toml` -- no new edge functions

## Risk Mitigations
- `created_by_user_id` is nullable to avoid breaking existing orders
- Existing `convert_lead_to_order(uuid)` call in LeadDetail must be updated to pass user ID
- Portal stage defaults to 'AwaitingSelection' so existing leads are unaffected
- `warranty_days_snapshot` defaults to 0 so existing orders keep current behavior
- The partial unique index on orders(lead_id) prevents duplicate conversions

