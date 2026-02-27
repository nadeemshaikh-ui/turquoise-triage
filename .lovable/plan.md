
# Restoree 360: Phase 1 + Sales Engine + 4 Logic Refinements

## Overview

This plan implements the approved Phase 1 (UI/stability/branding), Interactive Sales Engine (tiers, optional tasks, UPI), advance removal, and integrates the 4 new logic refinements: Physical Manifest Check-In, Slot Booking, Luxury Bubble Status Flow, and God-Mode Editor.

---

## Database Migrations

### Migration 1: New columns and slot settings

```text
-- 1. Expected item count on leads
ALTER TABLE leads ADD COLUMN expected_item_count integer NOT NULL DEFAULT 1;

-- 2. Physical manifest check-in on orders
ALTER TABLE orders ADD COLUMN expected_item_count integer NOT NULL DEFAULT 1;
ALTER TABLE orders ADD COLUMN checked_in_items jsonb NOT NULL DEFAULT '[]';
ALTER TABLE orders ADD COLUMN checkin_confirmed boolean NOT NULL DEFAULT false;

-- 3. Slot booking on orders
ALTER TABLE orders ADD COLUMN pickup_slot text;
ALTER TABLE orders ADD COLUMN dropoff_slot text;

-- 4. Logistics slots in system_settings
ALTER TABLE system_settings ADD COLUMN pickup_slots jsonb NOT NULL DEFAULT '["Morning (10 AM - 12 PM)", "Evening (4 PM - 6 PM)"]';
ALTER TABLE system_settings ADD COLUMN dropoff_slots jsonb NOT NULL DEFAULT '["Morning (10 AM - 12 PM)", "Evening (4 PM - 6 PM)"]';
```

No RLS changes needed -- all tables already have authenticated-user policies.

---

## Workstream 1: Luxury Bubble Status Flow

The new linear status path replaces the old one everywhere:

**Old:** `triage -> consult -> quoted -> pending_advance -> workshop -> qc -> delivered`

**New:** `pickup_scheduled -> received -> inspection -> in_progress -> qc -> ready -> delivered`

Note: "Lead" is the pre-order phase (the `leads` table). The order status flow starts at `pickup_scheduled` after conversion from lead.

### Files changed:

**`src/hooks/useOrderDetail.ts`** (line 100)
- Update `ORDER_STATUS_FLOW` to: `["pickup_scheduled", "received", "inspection", "in_progress", "qc", "ready", "delivered"]`
- Remove `logAdvancePaid` mutation (lines 422-444) -- advances are eliminated
- Update `updateStatus` to set `sla_start` when moving to `in_progress` (not `workshop`)
- Add new fields to `OrderDetail` interface: `expectedItemCount`, `checkedInItems`, `checkinConfirmed`, `pickupSlot`, `dropoffSlot`
- Map them in the query function

**`src/components/orders/OrderStepper.tsx`**
- Update `STEPS` array to match new flow
- Update `LABELS` map: `pickup_scheduled: "Pickup", received: "Received", inspection: "Inspection", in_progress: "In Progress", qc: "QC", ready: "Ready", delivered: "Delivered"`

**`src/pages/Orders.tsx`** (line 12)
- Update `STATUS_TABS` to: `["all", "pickup_scheduled", "received", "inspection", "in_progress", "qc", "ready", "delivered", "declined", "refunds"]`
- Update `TAB_LABELS` and `statusColor` maps accordingly
- Add quote expiry highlighting for orders that were recently quoted (yellow >24h, red >48h borders)

**`src/pages/OrderDetail.tsx`**
- Remove `pending_advance` payment section (lines 244-272)
- Remove `logAdvancePaid` usage
- Update status references throughout
- Add UPI section for `ready` status (see Workstream 5)

**`src/components/portal/PortalOrderCard.tsx`**
- Update all status checks: `isTriage` -> check for `pickup_scheduled`, `isWorkshop` -> check for `in_progress` and `qc`, etc.
- Replace the workshop shimmer text with a horizontal neumorphic progress bar showing: Pickup Scheduled -> Received -> Inspection -> In Progress -> QC -> Ready -> Delivered
- Active step gets a pulsing gold dot, completed steps are filled gold

**`supabase/functions/serve-portal/index.ts`**
- Update `approve` action: change target status from `pending_advance` to `pickup_scheduled`
- Include `system_settings` (company_upi_id, pickup_slots, dropoff_slots) in the `load` response
- Include `audit_logs` for each order in the `load` response (for History Vault)

---

## Workstream 2: Physical Manifest Check-In

### Intake: Expected Item Count
**`src/components/intake/NewLeadDialog.tsx`**
- Add an "Expected Item Count" number input in the CustomerDetails section (after address, before campaign)
- Store in `customer.expectedItemCount`, default 1
- Pass to lead insert: `expected_item_count: customer.expectedItemCount`
- When converting lead to order (in LeadDetail), copy `expected_item_count` to the order

### Admin: Check-In Checklist
**`src/pages/OrderDetail.tsx`**
- When order status is `received` or `inspection`, show a "Physical Check-In" card
- Display N checklist items (Item A, Item B, Item C...) based on `order.expectedItemCount`
- Each item has a "Received" checkbox that updates `checked_in_items` jsonb array
- If checked count !== expected count, highlight the order card in orange and show a warning
- Block the "Move to Inspection" button until admin clicks "Confirm Discrepancy" or all items are checked

### Orders List Highlighting
**`src/pages/Orders.tsx`**
- Orders in `received` status where `checkin_confirmed === false` and checked items don't match expected count get an orange left border

---

## Workstream 3: Interactive Slot Booking (Portal)

**`src/components/portal/PortalOrderCard.tsx`**
- New state: when `status === "pickup_scheduled"` and `!order.pickup_slot`:
  - Show two selectable neumorphic slot cards (Morning / Evening)
  - Slots are fetched from `data.systemSettings.pickup_slots` (passed via serve-portal load)
  - When customer selects, call `callAction("select_slot", { orderId, slotType: "pickup", slot: "Morning..." })`
  - After selection, show the confirmed slot with a checkmark
- Same logic for `status === "ready"` and `!order.dropoff_slot` (delivery slot selection)

**`src/pages/Portal.tsx`**
- Pass `systemSettings` from the loaded data down to PortalOrderCard

**`supabase/functions/serve-portal/index.ts`**
- Add `select_slot` action handler: updates `pickup_slot` or `dropoff_slot` on the order
- Add system_settings to the `load` response

---

## Workstream 4: God-Mode Editor

The admin already has full override capabilities via:
- `AdminOverride` component (OrderDetail lines 293-297) for total_price, shipping_fee, status
- `ExpertHuddle` with `canEdit={canEdit}` allows adding/editing tasks at any stage
- `PricingEngine` allows editing all pricing fields

**Refinements needed:**

**`src/pages/OrderDetail.tsx`**
- Remove the `isLocked` guard that blocks editing when customer has approved (line 87-88)
- Change to: `const canEdit = isAdmin ? true : !isLocked;` -- Admin always has edit access
- When admin edits during `in_progress`/`qc`, auto-generate a "Mini-Quote" audit log entry and set `discovery_pending = true` to force portal into "Action Required"

**`src/components/orders/ExpertHuddle.tsx`**
- When `canRemoveTask` is false (workshop mode), keep the upsell-only restriction for staff
- But if user `isAdmin`, allow full editing regardless of status -- pass an `isGodMode` prop

**`src/components/orders/PricingEngine.tsx`**
- Same approach: if admin, always allow editing even when contract is locked
- Add a visible "God Mode" indicator when admin is overriding a locked order

---

## Workstream 5: Advance Removal and UPI Deep Link

### Remove Advance System
**`src/hooks/useOrderDetail.ts`**
- Remove `logAdvancePaid` mutation entirely
- Keep `advancePaid` field in interface but default to 0 (for backward compat with existing data)

**`src/components/orders/PricingEngine.tsx`**
- Remove "Advance Required" input (lines 228-239)
- Remove "Advance Paid" display (lines 241-245)
- Remove "Balance Remaining" display (lines 247-253)
- Show only: Total Due as the final number

**`src/pages/OrderDetail.tsx`**
- Remove the entire "Log Advance Payment" section (lines 244-272)
- Remove Payment Declared banner reference to `pending_advance`

### UPI Deep Link at Ready Status
**`src/components/portal/PortalOrderCard.tsx`**
- New state when `status === "ready"`:
  - Show total due prominently
  - Display a UPI deep link button: `upi://pay?pa={upiId}&pn=Restoree360&am={total}&cu=INR`
  - UPI ID comes from `systemSettings.company_upi_id`
  - "I Have Paid" button sets `payment_declared = true` via `callAction("declare_payment")`
  - If `payment_declared` is true, show "Verifying..." disabled state

**`src/pages/Portal.tsx`**
- Remove the old `pendingAdvanceOrders` section (lines 240-270)

---

## Workstream 6: Stability and Anti-Flicker

**`src/hooks/useOrderDetail.ts`** (line 572)
- `recalcTotalPrice` is already wrapped in `useCallback([])` -- verified, no change needed

**`src/components/portal/PortalPhotoViewer.tsx`** (lines 22-33)
- Fix the broken `useState` being used as side effect -- replace with `useEffect`:
```text
useEffect(() => {
  if (!emblaApi) return;
  const onSelect = () => setActiveIndex(emblaApi.selectedScrollSnap());
  emblaApi.on("select", onSelect);
  onSelect();
  return () => { emblaApi.off("select", onSelect); };
}, [emblaApi]);
```
- Remove the redundant listener attachment on lines 30-33

**`src/components/orders/PricingEngine.tsx`**
- Already wrapped in `React.memo` (line 272) -- verified

**`src/components/portal/PortalOrderCard.tsx`**
- Already wrapped in `React.memo` -- verified
- Ensure all sub-components maintain stable keys

---

## Workstream 7: Branding and Theme Polish

**Branding** -- already "Restoree 360" in most places. Verify:
- `src/pages/Portal.tsx` line 148: "Restoree 360" (done)
- `src/components/portal/PortalOrderCard.tsx` line 105: "Restoree 360 artisans" (done)
- `src/components/AppLayout.tsx` lines 53-54: "Restoree 360" (done)

**Theme** -- Light Neumorphic is already applied in `src/index.css` (lines 174-222). No changes needed.

**Mobile sizing** -- 48px buttons and base text already applied in Portal and PortalOrderCard. Verify during implementation.

---

## Workstream 8: Portal VIP Enhancements

### History Vault
**`src/components/portal/PortalOrderCard.tsx`**
- Add a collapsible "Activity Timeline" section at the bottom of each order card
- Data source: `audit_logs` filtered by `order_id` (included in serve-portal load response)
- Show timestamped entries: "Status changed to inspection", "Quote approved", etc.
- Default collapsed, expand on tap

### Rework Request (7-day window)
**`src/components/portal/PortalOrderCard.tsx`** (Delivered state)
- Calculate days since delivery
- If less than 7 days: show "Request Rework" button
- Calls `callAction("request_rework", { orderId })` which creates a new lead in the system

**`supabase/functions/serve-portal/index.ts`**
- Add `request_rework` action: creates a new lead with notes referencing the original order

### PWA Manifest
- Create `public/manifest.json` with app name "Restoree 360"
- Update `index.html` with manifest link and iOS meta tags

---

## Files Summary

| # | File | Key Changes |
|---|------|-------------|
| 0 | DB Migration | Add expected_item_count, checked_in_items, checkin_confirmed, pickup_slot, dropoff_slot to orders; expected_item_count to leads; slots to system_settings |
| 1 | `src/hooks/useOrderDetail.ts` | New status flow, remove logAdvancePaid, add new fields, update status transitions |
| 2 | `src/components/orders/OrderStepper.tsx` | New 7-step Luxury Bubble flow |
| 3 | `src/components/orders/PricingEngine.tsx` | Remove advance fields, God-Mode for admin |
| 4 | `src/components/orders/ExpertHuddle.tsx` | God-Mode prop for admin override |
| 5 | `src/pages/Orders.tsx` | New status tabs, quote expiry highlighting, manifest mismatch orange border |
| 6 | `src/pages/OrderDetail.tsx` | Remove advance UI, add check-in checklist, God-Mode editing, UPI at ready |
| 7 | `src/pages/Portal.tsx` | Remove advance section, pass systemSettings, slot booking flow |
| 8 | `src/components/portal/PortalOrderCard.tsx` | Progress bar, slot booking cards, UPI deep link, history vault, rework button |
| 9 | `src/components/portal/PortalPhotoViewer.tsx` | Fix useEffect bug for Embla listener |
| 10 | `src/components/intake/NewLeadDialog.tsx` | Add Expected Item Count field |
| 11 | `supabase/functions/serve-portal/index.ts` | New status on approve, select_slot action, request_rework action, include system_settings and audit_logs in load |
| 12 | `public/manifest.json` | New PWA manifest |
| 13 | `index.html` | PWA meta tags |
