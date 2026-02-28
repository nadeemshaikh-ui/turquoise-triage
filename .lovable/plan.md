

# Restoree 360: Enterprise Hardening V2 -- Final Corrected Plan

## Overview

Apply the certified SQL migration (with corrections for schema accuracy), then update 6 frontend files to use the 3 new RPCs. This addresses all 12 loopholes: transactional lead conversion, status gating, multi-item support, rework constraints, Google review dedup, and portal caching.

---

## Current State (verified from database)

- `orders.status` default is `'triage'` -- must change to `'created'`
- 2 orders with `pending_advance`, 2 with `delivered` -- must migrate before CHECK
- No new columns on `leads` yet
- No `order_items`, `order_actions` tables
- No CHECK constraints, RPCs, or helper functions exist yet
- `has_role()` function exists and works

---

## Phase A: Database Migration (single migration)

### Step 1: Migrate legacy statuses

```text
UPDATE orders SET status = 'in_progress' WHERE status = 'pending_advance';
UPDATE orders SET status = 'pickup_scheduled' WHERE status = 'triage';
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'created';
```

### Step 2: Add columns

**leads:** `converted_order_id uuid`, `source text DEFAULT 'new'`, `original_order_id uuid`, `photos_pending boolean DEFAULT false`, `lifecycle_status text DEFAULT 'open'`

**orders:** `pickup_date date`, `delivery_address_mode text DEFAULT 'same_as_pickup'`, `delivery_address jsonb`, `certificate_status text DEFAULT 'pending'`, `certificate_url text`, `certificate_error text`, `google_review_prompted_at timestamptz`

### Step 3: CHECK constraints

- `orders_status_check`: whitelist of valid statuses (created, pickup_scheduled, received, inspection, in_progress, qc, ready, delivered, declined, cancelled)
- `orders_delivery_mode_check`: (same_as_pickup, new)
- `orders_certificate_status_check`: (pending, generated, failed)
- `leads_source_check`: (new, rework)
- `leads_lifecycle_status_check`: (open, converted, closed)
- `order_items_category_check`: (Bag, Shoe, Belt, Wallet)
- `order_items_brand_check`: length(trim(brand)) >= 2
- `order_items_service_type_check`: (restoration, repair, cleaning, dye, hardware, spa)

**Not adding:** `orders_pickup_slot_check` (slots stored as full text like "Morning (10 AM - 12 PM)"), `orders_delivery_address_consistency_check` (too rigid for current workflow where delivery_address may not be set immediately)

### Step 4: New tables

**order_items** (id uuid PK, order_id FK, category text NOT NULL, brand text NOT NULL, service_type text NOT NULL, sort_order int DEFAULT 0, created_at timestamptz)

**order_actions** (id uuid PK, order_id FK, action text NOT NULL, payload_hash text NOT NULL, created_at timestamptz, UNIQUE(order_id, action, payload_hash))

### Step 5: Indexes

- `idx_order_items_order_sort` on order_items(order_id, sort_order)
- `idx_one_open_rework` unique partial on leads(original_order_id) WHERE source='rework' AND lifecycle_status='open'

### Step 6: Helper functions

- `can_staff()`: returns true if user has staff, admin, or super_admin role via `has_role()`
- `is_admin()`: returns true if user has admin or super_admin role via `has_role()`

### Step 7: RLS for new tables

- `order_items`: staff+ can manage (using `can_staff()`)
- `order_actions`: staff+ can manage (using `can_staff()`)
- Existing RLS on orders/leads/etc remain unchanged

### Step 8: RPC -- convert_lead_to_order(p_lead_id uuid) RETURNS uuid

SECURITY DEFINER. Key logic:
- Lock lead with FOR UPDATE; idempotent if `converted_order_id` is set
- Validate: customer_id required, lead_items must exist, photos must exist (or photos_pending=true)
- Insert order with status='created'
- Map lead_items to order_items: JOIN service_categories for category name, JOIN brands for brand name, default service_type='restoration' (lead_items has no service_type column)
- If any brand resolves to NULL/Unknown, RAISE EXCEPTION
- Clone lead_photos to order_photos (only rows with valid storage_path)
- Set leads.converted_order_id and lifecycle_status='converted'

### Step 9: RPC -- transition_order_status(p_order_id uuid, p_to_status text, p_payload jsonb) RETURNS void

SECURITY DEFINER. Key gating:
- To pickup_scheduled: pickup_date must be set and not in the past
- To inspection: at least 1 order_photo OR lead.photos_pending=true
- To ready: if delivery_address_mode='new', delivery_address must be set; set certificate_status='pending'
- To delivered: payment_declared must be true
- Sets sla_start when moving to in_progress

### Step 10: RPC -- request_rework(p_order_id uuid, p_reason text, p_photos_pending boolean) RETURNS uuid

SECURITY DEFINER. Key logic:
- Validate reason non-empty
- Return existing open rework lead if one exists (idempotent, backed by unique partial index)
- Require at least 1 order_photo or photos_pending=true
- Insert new lead with source='rework', lifecycle_status='open'

---

## Phase B: Frontend Changes (6 files)

### File 1: src/pages/LeadDetail.tsx (lines 106-160)

Replace `handleConvertToOrder` (55 lines of inline asset matching, order insert) with a single RPC call:

```text
const { data, error } = await supabase.rpc('convert_lead_to_order', {
  p_lead_id: lead.id
});
```

This eliminates client-side race conditions, asset matching, and ensures photo cloning happens atomically.

### File 2: src/hooks/useOrderDetail.ts (lines 312-328)

Replace `updateStatus` mutation with RPC call:

```text
const { error } = await supabase.rpc('transition_order_status', {
  p_order_id: orderId,
  p_to_status: newStatus,
});
```

This enforces all gating rules server-side (pickup date, photos, payment).

### File 3: supabase/functions/serve-portal/index.ts

- Update `request_rework` action to use `supabase.rpc('request_rework', { p_order_id, p_reason, p_photos_pending: true })`
- Update `submit_rating` action to add atomic Google review dedup:

```text
if (rating >= 4) {
  await supabase.from("orders")
    .update({ google_review_prompted_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("google_review_prompted_at", null);
}
```

Deploy edge function after changes.

### File 4: src/components/portal/PortalOrderCard.tsx

Add a reason textarea in the DeliveredSection before the rework button. Require at least 10 characters. Pass reason to the `request_rework` action call.

### File 5: src/pages/Orders.tsx

Add unknown status fallback: if `statusColor[order.status]` is undefined, render a yellow "Unknown Status" badge instead of blank. This handles any legacy or unexpected statuses gracefully.

### File 6: src/pages/Portal.tsx

Add localStorage caching:
- On successful fetch, save data + timestamp to `localStorage` keyed by `portal-cache-{customerId}`
- On mount, render cached data immediately with "Refreshing..." banner
- On fetch failure, keep cached data with "Offline -- showing last known state" banner
- Show stale data warning if cache is older than 24 hours

---

## What Is NOT Included (and why)

- **Postgres ENUM types**: Using text + CHECK constraints instead. ENUMs require migration complexity (cannot add values inside a transaction, cannot easily rename). CHECK constraints provide equivalent safety with simpler migration.
- **Time-windowed dedup index on expert_tasks**: Postgres partial indexes cannot reference `NOW()` (must be immutable). The existing approach of (order_id, expert_type, scope_description) WHERE is_completed=false provides equivalent protection.
- **Storage path validation in RPC**: Postgres cannot query Supabase Storage from within a PL/pgSQL function. The RPC validates that `lead_photos.storage_path` is non-null and non-empty, which is the maximum validation possible at the DB level.
- **Certificate generation**: Schema prepared (certificate_status/url/error columns), but actual PDF generation requires a separate design sprint.
- **CI/automated tests**: Requires build tooling beyond current scope.

---

## Files Summary

| # | File | Changes |
|---|------|---------|
| 0 | DB Migration | Legacy status migration, new columns, tables, constraints, indexes, helpers, RLS, 3 RPCs |
| 1 | `src/pages/LeadDetail.tsx` | Replace 55-line conversion with 1 RPC call |
| 2 | `src/hooks/useOrderDetail.ts` | Replace updateStatus with RPC call |
| 3 | `supabase/functions/serve-portal/index.ts` | Use request_rework RPC, atomic Google review dedup |
| 4 | `src/components/portal/PortalOrderCard.tsx` | Rework reason textarea with validation |
| 5 | `src/pages/Orders.tsx` | Unknown status fallback badge |
| 6 | `src/pages/Portal.tsx` | localStorage caching with stale-data warnings |

