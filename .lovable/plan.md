

# Phase 2: Living Customer Portal & Operational Lockdown

## Overview

This plan delivers: (1) database schema additions, (2) the public Customer Portal at `/portal/:customerId` with dark neumorphic luxury UI and all 6 state-driven views, (3) admin overrides (markUnfixable, markRefundIssued, rejectPaymentDeclaration) with Co-Owner refund dashboard, (4) operational scope lockdown rules, and (5) the `serve-portal` edge function for zero-friction public access.

---

## 1. Database Migration

Add columns that do NOT yet exist:

```sql
-- orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_declared boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS packing_photo_url text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_loyalty_vip boolean DEFAULT false;

-- order_discoveries table
ALTER TABLE order_discoveries ADD COLUMN IF NOT EXISTS discovery_photo_url text;

-- system_settings table
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS company_upi_id text;
```

No new RLS needed -- existing policies cover these columns.

---

## 2. Hook Updates (`src/hooks/useOrderDetail.ts`)

### New fields in `OrderDetail` interface
- `paymentDeclared: boolean`
- `packingPhotoUrl: string | null`
- `isLoyaltyVip: boolean`

### New mutations

**`markUnfixable`**: Sets `balance_remaining = 0`, `status = 'declined'`. Builds audit reason: base text + conditional refund append if `advancePaid > 0`:
```
"Item marked unfixable. Balance cleared. - CO-OWNER ACTION REQUIRED: REFUND OF Rs.X DUE."
```
Inserts `audit_logs` entry with `action = 'system_note'`.

**`markRefundIssued`**: Only when status is `declined`/`cancelled` AND `advancePaid > 0`. Sets `advance_paid = 0`, inserts audit log: `"REFUND ISSUED: Rs.X returned to customer."`.

**`rejectPaymentDeclaration`**: Sets `payment_declared = false`. Inserts audit log: `"Payment declaration rejected. Portal button re-enabled."`.

### Update `logAdvancePaid`
Also sets `payment_declared = false` to re-enable portal for future transactions.

### Add `declined` and `cancelled` as terminal statuses
Keep `ORDER_STATUS_FLOW` unchanged (they are not in the linear flow).

---

## 3. Admin OrderDetail Enhancements (`src/pages/OrderDetail.tsx`)

### New Admin Actions Section (below existing Admin Overrides)

- **"Mark Unfixable (DOA)"** -- destructive button with `Ban` icon, wrapped in `AlertDialog` confirmation. Calls `markUnfixable`.
- **"Mark Refund Issued"** -- visible when `status === 'declined' || status === 'cancelled'` AND `advancePaid > 0`. Green button. Calls `markRefundIssued`.
- **"Reject Payment Declaration"** -- visible when `paymentDeclared === true`. Orange button. Calls `rejectPaymentDeclaration`.
- **"Force Cancel"** -- destructive button. Sets `status = 'cancelled'`, `sla_start = null`, inserts audit log with refund note if applicable.

### Payment Declared Banner
When `paymentDeclared === true` and status is `pending_advance`, show info banner: "Customer has declared payment. Awaiting admin verification."

### Audit Trail Refund Highlighting
Audit entries where `reason` contains `"REFUND OF"` render with `border-red-500 bg-red-50` and a red "Refund Required" badge. Entries containing `"REFUND ISSUED"` render with `border-green-500 bg-green-50`.

### Scope Lockdown
When status is `workshop` or `qc`, the ExpertHuddle `canEdit` is replaced with a `canRemoveTask` = `false` + `canAddTask` = `true` pattern. Existing tasks cannot be deleted or have their tier downgraded. New tasks can be added (upselling).

### Packing Photo Gate
When transitioning from `qc` to `delivered`, require `packingPhotoUrl` to exist. Block the "Move to Delivered" button until set.

### Loyalty VIP Badge
Query total order count for the customer. If > 1, show gold "VIP" badge next to customer name in header.

---

## 4. Orders List Enhancements (`src/pages/Orders.tsx`)

### New tabs
- Add `"declined"` tab with label "Declined"
- Add `"refunds"` pseudo-tab: filters `status = 'declined'` AND `advance_paid > 0`

### Refund Badge
For any order with `status === 'declined'` and `advance_paid > 0`, show a pulsing red badge: `"Refund Rs.X"` with `animate-pulse`.

### Status color additions
- `declined: "bg-red-100 text-red-800 border-red-300"`
- `cancelled: "bg-gray-100 text-gray-800 border-gray-300"`

---

## 5. ExpertHuddle Scope Lockdown (`src/components/orders/ExpertHuddle.tsx`)

Accept new prop `canRemoveTask: boolean` (default `true`). When `false`:
- Hide the ability to clear/remove an existing task section
- Existing scope tags cannot be deselected (only new ones added)
- Price cannot be lowered below current value
- New expert sections can still be added

---

## 6. Discovery Photo Requirement (`src/components/orders/DiscoveryDialog.tsx`)

- Add a mandatory photo upload field using a file input
- Upload to `order-photos` bucket at path `discoveries/{orderId}/{filename}`
- Store the public URL in `discovery_photo_url` on the `order_discoveries` row
- Block "Add Discovery" button until a photo is attached
- Update `onSubmit` signature to include `discoveryPhotoUrl: string`

---

## 7. Edge Function: `serve-portal` (New)

**File**: `supabase/functions/serve-portal/index.ts`

Public edge function (`verify_jwt = false`) with CORS headers. Uses service role key internally.

### Actions (via `action` query param or POST body):

**`load` (GET)**: Returns all orders + tasks + photos + markers + discoveries for a `customerId`. Groups into active vs historical (delivered = historical).

**`approve` (POST)**: Customer approves order(s). Sets `customer_approved_at`, transitions based on `advance_required`.

**`decline` (POST)**: Stamps `customer_declined_at`, sets `decline_reason`.

**`approve_discovery` (POST)**: Approves discovery, unpauses SLA (`discovery_pending = false`).

**`decline_discovery` (POST)**: Declines extra work on discovery.

**`declare_payment` (POST)**: Accepts `{ customerId, orderIds[] }`. Batch sets `payment_declared = true` for all specified orders where `customer_id` matches.

**`confirm_address` (POST)**: Stamps `delivery_address_confirmed_at` and stores address.

**`submit_rating` (POST)**: Stores rating (placeholder for future ratings table, uses audit_logs for now).

All mutations validate `customerId` ownership before executing.

---

## 8. Customer Portal (`src/pages/Portal.tsx`)

### Entry & Session
- Route: `/portal/:customerId` (public, no auth required)
- Validate UUID format on load. Invalid = error screen.
- 30-minute inactivity timeout (ref-based timer, resets on click/scroll/keypress). On expiry, show "Session expired" overlay.

### Layout & Theme
- Wrapped in `.portal-theme` class
- Dark luxury: `#0A0A0A` bg, `#C9A96E` gold accents, Inter font, massive whitespace
- Neumorphic dark shadows using `#000` and `#1E1E1E`

### Wardrobe View
- Fetches data via `serve-portal?action=load&customerId=...`
- Splits into "Active Restorations" and "Historical Archives" tabs
- Each order is a card showing: primary photo thumbnail + asset signature
- Gold glow-pulse animation on cards for `quoted` or `discovery_pending` orders

### Global Approval Flow
- Floating "Review & Approve Wardrobe" bar when any orders are in `quoted` state
- 3 micro-insurance checkboxes (all required before Approve):
  1. "I acknowledge the documented damage and restoration scope"
  2. "I approve the proposed work and pricing"
  3. "I accept the estimated timeline"

### UPI Gate
- For advance: sum `advance_required` for approved items. Show UPI deep link QR.
- "I Have Paid" button driven by `payment_declared` DB flag. If `true`, renders as "Verifying..." (disabled, persists across reloads).
- Batch payment: single click sets `payment_declared = true` for ALL approved orders.

---

## 9. Portal Order Card (`src/components/portal/PortalOrderCard.tsx`)

### State A (triage/consult)
- "Being evaluated by our Elite Artisans" text with subtle shimmer animation.

### State B (quoted)
- Read-only damage pins (gold circles from `photo_markers`)
- Pricing breakdown: Subtotal, Discount (green strikethrough), GST, Total, Advance Required
- Perk sweetener badge from `auto_sweetener_value` (e.g., "Bonus: Free Handle Polishing")
- Actions: Approve, Question (textarea), Decline (reason dropdown)

### State C (discovery_pending)
- Amber/gold pulse border
- Discovery proof photo + description + extra cost
- "Approve Finding" / "Decline Extra Work" buttons

### State D (workshop/qc)
- Gold shimmer artisan animation + progress bar showing stage position

### State E (qc_passed -- mapped from `qc` with conditions)
- Final QC video player (if URL exists)
- Balance payment section with UPI QR if `balance_remaining > 0`
- Mandatory "Confirm Delivery Address" textarea

### State F (delivered)
- Before/After image comparison slider (pure CSS/JS drag)
- "Download Tax Invoice" placeholder button
- Delight Loop: 5-star rating. 4-5 stars = Google Review link. 1-3 stars = private feedback textarea.

---

## 10. Portal Photo Viewer (`src/components/portal/PortalPhotoViewer.tsx`)

- Read-only damage pin viewer (gold numbered circles)
- Before/After slider component for State F (CSS drag-based, no external deps)

---

## 11. Portal Dark Theme (`src/index.css`)

Add `.portal-theme` scoped CSS variables:
```css
.portal-theme {
  --portal-bg: 0 0% 4%;           /* #0A0A0A */
  --portal-surface: 0 0% 8%;      /* #141414 */
  --portal-gold: 37 40% 60%;      /* #C9A96E */
  --portal-gold-dim: 37 30% 40%;
  --portal-text: 30 15% 90%;      /* warm white */
  --portal-muted: 30 10% 38%;
  --portal-border: 30 10% 15%;
}
```

Neumorphic dark utility classes: `.portal-raised`, `.portal-pressed` with dark inset/outset shadows. Gold accent for CTAs and active states. 300ms transitions.

---

## 12. App Router Update (`src/App.tsx`)

Add public route:
```tsx
<Route path="/portal/:customerId" element={<Portal />} />
```
Place BEFORE the `ProtectedRoute` wrapper (public access).

---

## Files Summary

### New files (4):
1. `src/pages/Portal.tsx` -- Full customer portal with wardrobe, 6 states, UPI gate, delight loop
2. `src/components/portal/PortalOrderCard.tsx` -- State-driven order card renderer (A-F)
3. `src/components/portal/PortalPhotoViewer.tsx` -- Read-only pins + before/after slider
4. `supabase/functions/serve-portal/index.ts` -- Public edge function for portal data and mutations

### Modified files (7):
1. `src/hooks/useOrderDetail.ts` -- New fields, 3 new mutations, logAdvancePaid reset
2. `src/pages/OrderDetail.tsx` -- Admin overrides (Unfixable, Refund, Reject Payment, Force Cancel), payment banner, audit highlighting, scope lockdown, packing photo gate, VIP badge
3. `src/pages/Orders.tsx` -- Declined/Refunds tabs, refund pulse badge, new status colors
4. `src/components/orders/ExpertHuddle.tsx` -- `canRemoveTask` prop for scope lockdown
5. `src/components/orders/DiscoveryDialog.tsx` -- Mandatory discovery photo upload
6. `src/index.css` -- Portal dark theme variables and utility classes
7. `src/App.tsx` -- Add `/portal/:customerId` public route

### Database:
- Migration: 3 new columns on `orders`, 1 on `order_discoveries`, 1 on `system_settings`

### Edge Functions:
- New: `serve-portal` (public, `verify_jwt = false`)

