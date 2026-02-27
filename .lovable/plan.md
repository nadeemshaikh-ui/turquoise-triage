

# Sub-Phase 2A: Database Architecture + Math Engine + Admin Cockpit

## Overview

This sub-phase establishes the database foundation, updates the pricing math engine with the strict 5-step formula, and adds 6 admin cockpit enhancements to the Order Detail and Orders pages. Sub-Phases 2B (Portal) and 2C (Cron/Drip) will follow separately.

---

## 1. Database Migration

### New Tables

**photo_markers** -- damage pin annotations on order photos
```text
id uuid PK
photo_id uuid FK -> order_photos(id) ON DELETE CASCADE
x_coordinate decimal NOT NULL
y_coordinate decimal NOT NULL
label text
created_at timestamptz default now()
```

**order_discoveries** -- extra damage found during workshop
```text
id uuid PK
order_id uuid FK -> orders(id) ON DELETE CASCADE
description text NOT NULL
extra_price numeric default 0
approved_at timestamptz (nullable)
created_at timestamptz default now()
```

**system_settings** -- operational configuration (single row)
```text
id uuid PK
workshop_capacity int default 20
initial_reminder_days int default 3
followup_days int default 7
created_at timestamptz default now()
updated_at timestamptz default now()
```
Seed one default row. RLS: authenticated SELECT, admin-only UPDATE.

### New columns on `orders` table

Financial:
- `total_amount_due` numeric default 0
- `advance_paid` numeric default 0
- `balance_remaining` numeric default 0
- `advance_required` numeric default 0
- `discount_reason` text
- `tax_amount` numeric default 0

Automation:
- `auto_sweetener_type` text (nullable)
- `auto_sweetener_value` text (nullable)
- `quote_sent_at` timestamptz
- `quote_valid_until` timestamptz
- `reminder_count` int default 0

Metadata:
- `unique_asset_signature` text
- `customer_approved_at` timestamptz
- `customer_declined_at` timestamptz
- `decline_reason` text
- `delivery_address_confirmed_at` timestamptz
- `slider_before_photo_id` uuid
- `slider_after_photo_id` uuid
- `final_qc_video_url` text

Also add `pending_advance` to the OrderStepper status flow.

RLS: `photo_markers` and `order_discoveries` get authenticated ALL. `system_settings` gets authenticated SELECT + admin UPDATE.

---

## 2. Math Engine Update (Strict 5-Step Formula)

Update `recalcTotalPrice` in `useOrderDetail.ts` and the `PricingEngine.tsx` display:

```text
1. Subtotal = SUM(tasks [exclude cleaning if bundle]) + shipping_fee + cleaning_fee
2. Discounted = MAX(0, Subtotal - discount_amount)
3. Tax = is_gst_applicable ? ROUND(Discounted * 0.18, 2) : 0
4. Total (total_amount_due) = Discounted + Tax
5. Balance = Total - advance_paid
```

Changes from current logic:
- Add `MAX(0, ...)` floor on discount to prevent negative totals
- Compute and store `tax_amount` as a separate field
- Store `total_amount_due` and `balance_remaining` as separate persisted columns
- `PricingEngine.tsx` save also writes `tax_amount`, `total_amount_due`, `balance_remaining`, `discount_reason`

Update `nightly-data-healer` edge function to use the same MAX(0) + separate tax formula.

### PricingEngine UI Enhancement

Show full breakdown rows: Subtotal, Discount (with green label + reason field), Tax (18% GST), Total Due, Advance Paid, Balance Remaining. Add `discount_reason` text input.

---

## 3. Admin Cockpit Enhancements (OrderDetail + Orders)

### 3a. Batch Publishing (Orders.tsx)
- Add a checkbox to each order row
- When 2+ orders for the same customer are selected, show a "Publish Batch" button
- On click: sets each selected order's `status = 'quoted'`, `quote_sent_at = now()`, and `quote_valid_until = now() + 7 days`
- Displays the portal link `/portal/:phone_last4` (prep for Sub-Phase 2B)

### 3b. Marker Editor (BeforeAfterPhotos.tsx)
- When an admin clicks a "Before" photo, enter "marker mode" overlay
- Click on the photo to drop a pin (saves `x_coordinate`, `y_coordinate`, `label` to `photo_markers`)
- Existing pins render as numbered gold circles; click a pin to delete it
- Fetch markers for each photo via a query on `photo_markers` filtered by `photo_id`

### 3c. Discovery Trigger (OrderDetail.tsx)
- New "Add Discovery" button visible when `status === 'workshop'`
- Opens a dialog with `description` (text) and `extra_price` (number) inputs
- On submit: inserts into `order_discoveries`, sets `discovery_pending = true` on the order
- SLA timer pauses (existing logic already handles `discovery_pending`)

### 3d. Payment Actions (OrderDetail.tsx)
- "Log Advance Paid" button visible when `status === 'pending_advance'`
- Input for amount paid
- On submit: updates `advance_paid += amount`, recalculates `balance_remaining`, sets `status = 'workshop'`, stamps `sla_start = now()`

### 3e. Contract Lock (OrderDetail.tsx)
- If `customer_approved_at` or `customer_declined_at` is set, disable pricing/task editing for non-admin users
- Pass `canEdit` boolean as prop to `PricingEngine`, `ExpertHuddle`, and `OrderStepper`

### 3f. Capacity Planning (OrderDetail.tsx)
- Fetch `system_settings.workshop_capacity` and count of orders with `status = 'workshop'`
- If active count > capacity, show an info banner: "High demand -- estimated +4 days delivery buffer"
- Displayed above the OrderStepper

---

## 4. OrderStepper Status Flow Update

Add `pending_advance` between `quoted` and `workshop`:
```text
triage -> consult -> quoted -> pending_advance -> workshop -> qc -> delivered
```

Update the `STEPS` array and `LABELS` map in `OrderStepper.tsx`. Add color entry in `OrderDetail.tsx` statusColor map.

---

## 5. useOrderDetail Hook Updates

- Add new fields to `OrderDetail` interface: `totalAmountDue`, `advancePaid`, `balanceRemaining`, `advanceRequired`, `discountReason`, `taxAmount`, `autoSweetenerType`, `autoSweetenerValue`, `quoteSentAt`, `quoteValidUntil`, `reminderCount`, `uniqueAssetSignature`, `customerApprovedAt`, `customerDeclinedAt`, `declineReason`, `deliveryAddressConfirmedAt`, `sliderBeforePhotoId`, `sliderAfterPhotoId`, `finalQcVideoUrl`
- Map all new DB columns in the query mapper
- Update `recalcTotalPrice` to the strict 5-step formula
- Add new mutations: `addDiscovery`, `logAdvancePaid`
- Update `ORDER_STATUS_FLOW` to include `pending_advance`

---

## Files Summary

### New files (1):
1. `src/components/orders/DiscoveryDialog.tsx` -- Dialog for adding workshop discoveries

### Modified files (6):
1. `src/hooks/useOrderDetail.ts` -- New interface fields, 5-step math, new mutations, updated status flow
2. `src/components/orders/PricingEngine.tsx` -- Full breakdown UI, discount_reason, tax_amount display, canEdit prop
3. `src/components/orders/BeforeAfterPhotos.tsx` -- Marker overlay on before photos (click-to-pin, click-to-delete)
4. `src/components/orders/OrderStepper.tsx` -- Add `pending_advance` step, accept `canEdit` prop
5. `src/pages/OrderDetail.tsx` -- Discovery trigger, payment actions, contract lock, capacity planning banner
6. `src/pages/Orders.tsx` -- Batch selection checkboxes + Publish Batch button
7. `src/components/orders/ExpertHuddle.tsx` -- Accept `canEdit` prop to disable editing when contract locked
8. `supabase/functions/nightly-data-healer/index.ts` -- Updated math formula with MAX(0) + separate tax

### Database:
1. Migration: 3 new tables (`photo_markers`, `order_discoveries`, `system_settings`) + ~18 new columns on `orders` + RLS policies + seed `system_settings` default row

