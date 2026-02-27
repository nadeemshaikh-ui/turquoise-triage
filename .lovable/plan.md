

# Phase 1: Asset Passport, Expert Huddle, SLA Engine & Audit Logs

## Overview

Replace the leads-based lifecycle with an orders-centric system featuring Asset Passports, Expert Task assignments, SLA enforcement with 4 patched logic rules, pricing engine with exact aggregation, and admin override governance. Includes simple before/after photo view.

---

## Logic Patches (Integrated)

### Patch 1: Asset Passport Matching = `customer_id + item_category + brand`
Never match by brand+category alone. Always scope to the specific customer. If no match for that customer, create a new passport.

### Patch 2: Pricing Aggregation Formula
```text
total_price = SUM(expert_tasks.estimated_price) + shipping_fee + cleaning_fee
```
- Standard: shipping_fee = manual input. If bundle checked, cleaning_fee = 299. Cleaning expert's price excluded from SUM when bundle is active.
- Elite: shipping_fee = 0, cleaning_fee = 0. total_price = SUM(expert_tasks.estimated_price).
- Frontend recalculates on every change and saves to DB.

### Patch 3: SLA Timer Stop
SLA pulse only renders when `order.status == 'consult'`. Once status moves to `quoted` or beyond, show "Completed" badge instead of timer.

### Patch 4: SLA Trigger Event
When status transitions from `triage` to `consult`, set `consultation_start_time = now()` in the same DB update.

---

## Step 1: Database Migration

Single migration creating all tables with RLS.

### 1a. `profiles` extension
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS expert_type text;
```

### 1b. `asset_passport` table
- Columns: `id`, `customer_id` (uuid NOT NULL), `item_category`, `brand`, `model`, `serial_number`, `created_at`
- RLS: Authenticated users can manage

### 1c. `orders` table (replaces leads lifecycle for workshop)
- Columns: `id`, `lead_id` (FK leads), `asset_id` (FK asset_passport), `customer_id`, `customer_name`, `customer_phone`, `status` (default 'triage'), `package_tier` (default 'standard'), `total_price`, `shipping_fee`, `cleaning_fee`, `warranty_months` (default 3), `sla_start`, `consultation_start_time`, `health_score`, `maintenance_due`, `is_bundle_applied` (default false), `notes`, `created_by`, `created_at`, `updated_at`
- Statuses: triage, consult, quoted, workshop, qc, delivered
- RLS: Authenticated users can manage

### 1d. `expert_tasks` table
- Columns: `id`, `order_id` (FK orders CASCADE), `assigned_to` (FK profiles.user_id), `expert_type`, `scope_tags` (jsonb), `scope_description`, `estimated_price`, `expert_note`, `is_completed`, `assigned_at`, `completed_at`, `created_at`
- RLS: Authenticated users can manage

### 1e. `audit_logs` table
- Columns: `id`, `order_id` (FK orders), `admin_id`, `action`, `field_name`, `old_value`, `new_value`, `reason` (NOT NULL), `created_at`
- RLS: Authenticated can SELECT, INSERT

### 1f. `scope_tag_definitions` table
- Columns: `id`, `tag_name` (UNIQUE), `service_description`, `expert_type`, `is_active`, `sort_order`
- RLS: Authenticated can SELECT; Admins can ALL

### 1g. `order_photos` table
- Columns: `id`, `order_id` (FK orders CASCADE), `storage_path`, `file_name`, `photo_type` (default 'before'), `uploaded_by`, `uploaded_at`
- RLS: Authenticated users can manage

### 1h. Seed scope tags (12 entries for repair/cleaning/colour)

### 1i. Create `order-photos` storage bucket

### 1j. Enable realtime on `orders` and `expert_tasks`

---

## Step 2: New Files

### 2a. `src/hooks/useOrderDetail.ts`
Data hook following same pattern as `useLeadDetail.ts`:
- Fetches order with customer join, asset_passport join
- Fetches expert_tasks for the order
- Fetches order_photos with signed URLs
- Fetches audit_logs for timeline
- Realtime subscriptions on orders, expert_tasks, order_photos
- Mutations: `updateStatus` (with Patch 4: sets `consultation_start_time = now()` when transitioning to consult), `updateOrder`, `addExpertTask`, `updateExpertTask`, `uploadPhotos`, `deletePhoto`
- `recalcTotalPrice()` helper implementing Patch 2's exact formula

### 2b. `src/pages/Orders.tsx`
Orders list page with status filter tabs (All, Triage, Consult, Quoted, Workshop, QC, Delivered). Each row: Customer, Asset brand/category, Status badge, Total Price, SLA indicator (Patch 3: only for consult status), Created date. Click navigates to `/orders/:id`.

### 2c. `src/pages/OrderDetail.tsx`
Full order detail page with sections:

**Header**: Customer name, asset info, status badge, SLA indicator (Patch 3: only shows timer during consult, "Completed" after)

**Asset Passport Card** (`src/components/orders/AssetPassportCard.tsx`):
- Shows brand, model, serial, category
- "Restoration History" count of previous orders for this asset

**Expert Huddle Panel** (`src/components/orders/ExpertHuddle.tsx`):
- Three collapsible sections: Cleaning, Repair, Colour
- Each: expert assignment dropdown (profiles with matching expert_type), scope tag multi-select chips (from scope_tag_definitions), estimated_price input, notes textarea
- Scope tags auto-populate scope_description from definitions
- SLA display with Patch 3 logic

**Pricing Engine** (`src/components/orders/PricingEngine.tsx`):
- Tier toggle: Standard / Elite
- Elite auto-sets: shipping=0, cleaning=0, warranty=6mo
- Standard: manual shipping input, 3mo warranty
- 50% Bundle checkbox: visible only when tier=standard AND at least one expert_task has type=repair. When checked: cleaning_fee=299, cleaning expert's estimated_price excluded from SUM
- Live total using Patch 2 formula
- Save button updates orders table

**Admin Override** (`src/components/orders/AdminOverride.tsx`):
- Only visible to admin/super_admin (via `useUserRole`)
- "Override" button per editable field (price, shipping, status)
- Opens Dialog with new value input + mandatory reason (min 10 chars)
- On submit: updates value, inserts audit_log with old_value, new_value, reason, admin_id

**Before/After Photos** (`src/components/orders/BeforeAfterPhotos.tsx`):
- Side-by-side grid: "Before" column and "After" column
- Upload button with type selector (before/after)
- Uses `order-photos` storage bucket

**Order Stepper** (`src/components/orders/OrderStepper.tsx`):
- Visual progress: triage -> consult -> quoted -> workshop -> qc -> delivered
- "Advance" button with Patch 4: clicking from triage to consult sets `consultation_start_time`

**Activity Timeline**: Combined audit logs + status changes

### 2d. Modifications to existing files

**`src/App.tsx`**: Add routes `/orders` and `/orders/:id` inside ProtectedRoute+AppLayout

**`src/components/AppLayout.tsx`**: Add "Orders" to `coreNav` array with a `ClipboardList` icon, between Workshop and Customers

**`src/pages/LeadDetail.tsx`**: Add "Convert to Order" button. On click:
1. Query asset_passport for `customer_id + item_category + brand` (Patch 1)
2. If found, use existing asset_id. If not, create new passport entry
3. Insert into orders table with lead_id reference
4. Navigate to `/orders/{new_order_id}`

---

## Step 3: Component Details

### ExpertHuddle.tsx
```text
Props: orderId, orderStatus, consultationStartTime
- Fetches scope_tag_definitions grouped by expert_type
- Fetches expert_tasks for this order
- For each expert type (cleaning, repair, colour):
  - Collapsible section
  - Assigned expert dropdown (profiles WHERE expert_type matches)
  - Multi-select scope tags as chips
  - Auto-generated scope_description from selected tags
  - Estimated price input
  - Notes textarea
  - Save button per section
- SLA indicator (Patch 3):
  - Only compute if orderStatus == 'consult'
  - hours = (now - consultationStartTime) / 3600000
  - > 6h: red "OVERDUE" pulse
  - > 4h: amber "WARNING" pulse
  - < 4h: green "OK"
  - If status != 'consult': show "Completed" or hide
```

### PricingEngine.tsx
```text
Props: order, expertTasks, onSave
- Tier toggle (Standard/Elite)
- When Elite selected: shipping=0, cleaning=0, warranty=6
- When Standard:
  - Shipping fee input (manual)
  - Bundle checkbox (only if any task has expert_type='repair')
  - When bundle checked: cleaning_fee=299
- Total calculation (Patch 2):
  let taskSum = expertTasks
    .filter(t => !(order.is_bundle_applied && t.expert_type === 'cleaning'))
    .reduce((sum, t) => sum + t.estimated_price, 0);
  total = taskSum + shipping_fee + cleaning_fee;
- Display as itemized breakdown
- Save button calls onSave with computed values
```

### AdminOverride.tsx
```text
Props: orderId, fieldName, currentValue, onOverride
- Only renders if useUserRole().isAdmin
- "Override" ghost button
- Dialog: new value input, reason textarea (min 10 chars), confirm button
- On confirm:
  - Update orders table
  - Insert audit_logs row
  - Call onOverride to refresh parent
```

---

## Files Summary

### New files (10):
1. `src/pages/Orders.tsx` -- Orders list with status tabs
2. `src/pages/OrderDetail.tsx` -- Full order detail page
3. `src/hooks/useOrderDetail.ts` -- Data hook
4. `src/components/orders/ExpertHuddle.tsx` -- Expert task panel
5. `src/components/orders/PricingEngine.tsx` -- Tier/bundle/pricing
6. `src/components/orders/AdminOverride.tsx` -- Override dialog + audit
7. `src/components/orders/AssetPassportCard.tsx` -- Asset info card
8. `src/components/orders/BeforeAfterPhotos.tsx` -- Photo grid
9. `src/components/orders/OrderStepper.tsx` -- Status stepper

### Modified files (3):
1. `src/App.tsx` -- Add /orders routes
2. `src/components/AppLayout.tsx` -- Add Orders nav item
3. `src/pages/LeadDetail.tsx` -- Add "Convert to Order" button

### Database:
- 1 migration file (7 tables, RLS, seed data, realtime, storage bucket)

### No edge function changes needed for Phase 1.

---

## What's Excluded (Future Phases)
- Customer Portal, Marker Pins, Micro-Insurance Gate
- Sentiment Funnel, Longevity Score, Maintenance Reminders
- Interakt automation, FOMO pricing

