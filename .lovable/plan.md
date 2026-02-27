

# Restoree 360: Final Architectural Completion

## Overview

This plan covers 6 workstreams across 8 files + 1 database migration. Every change is specified with exact file locations and logic.

---

## Workstream 1: Branding & Unified Light Theme

### Branding
- **`src/pages/Portal.tsx` line 132**: Change "Luxury Restoration Portal" to "Restoree 360"
- **`src/components/portal/PortalOrderCard.tsx` line 72**: Change "Being evaluated by our Elite Artisans" to "Being evaluated by our Restoree 360 artisans"
- No other "Zenith" or "Restoration Portal" strings exist in the codebase

### Light Neumorphic Theme (`src/index.css` lines 174-222)
Replace `.portal-theme` CSS variables with light palette:
```text
--portal-bg:      220 16% 95%     (#F0F2F5)
--portal-surface: 0 0% 100%       (#FFFFFF)
--portal-text:    215 25% 33%     (#2D3748 equivalent)
--portal-muted:   215 15% 55%
--portal-border:  220 14% 88%
--portal-gold:    37 40% 60%      (accent only, stays)
```
Update `.portal-raised` to use white/gray neumorphic shadows instead of black shadows. Update `.portal-pressed` and `.portal-shimmer` similarly.

### Remove Inline Dark Styles
- **`src/pages/Portal.tsx`**: Replace all `style={{ background/color: "hsl(var(--portal-*))" }}` with Tailwind classes using CSS variable syntax like `bg-[hsl(var(--portal-bg))]` or standard classes
- **`src/components/portal/PortalOrderCard.tsx`**: Same treatment for all inline style attributes across the entire component and sub-components

### Mobile-First Sizing
- All Portal buttons: `min-h-[48px]`
- Tab buttons: `min-h-[48px] text-base`
- Header title: `text-2xl` (24px), subtitle: `text-base` (18px)
- Card body text: `text-base`, card headers: `text-lg`
- Star rating buttons: `min-h-[48px] min-w-[48px]`

---

## Workstream 2: Stability & Anti-Flicker

### `src/hooks/useOrderDetail.ts` (lines 570-592)
Wrap `recalcTotalPrice` in `useCallback` with `[]` dependencies. It's a pure math function with no closures, so the reference will be stable across renders. This eliminates the cascade where PricingEngine's `useMemo` (line 42-45) re-fires every render.

### `src/components/orders/PricingEngine.tsx`
Wrap the default export in `React.memo`:
```text
export default React.memo(PricingEngine);
```

### `src/components/portal/PortalOrderCard.tsx`
- Wrap `PortalOrderCard` in `React.memo`
- Wrap `DiscoveryCard`, `QcReadySection`, and `DeliveredSection` in `React.memo`
- Use stable keys (`order.id`, `t.id`, `d.id`) for all list renders (already done, will verify)

---

## Workstream 3: Interactive Sales Engine

### Database Migration
Add `is_optional` boolean column to `expert_tasks`:
```sql
ALTER TABLE expert_tasks ADD COLUMN is_optional boolean NOT NULL DEFAULT false;
```

### Admin: Optional Toggle (`src/components/orders/ExpertHuddle.tsx`)
- Add an "Optional" checkbox in each `ExpertSection` (around line 230, near the price input)
- When toggled, saves `is_optional` to the `expert_tasks` table via `onUpdateTask`
- UI: small checkbox labeled "Mark as Optional (customer can exclude)"

### Portal: Tier Switcher (`src/components/portal/PortalOrderCard.tsx` -- State B)
When status is `quoted`, show two selectable neumorphic tier cards above the pricing breakdown:

- **Standard**: Current task sum + shipping fee, 15-20 day SLA, 3-month warranty
- **Elite**: Task sum * 1.4, free shipping, 8-12 day SLA, 6-month warranty

Local state `selectedTier` defaults to `order.package_tier`. Switching recalculates all displayed values using a local `useMemo`. Does NOT save to DB -- the tier is sent on approval.

### Portal: Optional Task Checkboxes (`src/components/portal/PortalOrderCard.tsx` -- State B)
For each task where `is_optional === true`:
- Render a checkbox next to the task name (default: checked/included)
- When unchecked: strike through the line, subtract its price from the total
- Local state `excludedTaskIds` tracks which optional tasks are unchecked

### Math Fortress (local `useMemo` in PortalOrderCard State B)
```text
selectedTasks = orderTasks.filter(t => !t.is_optional || !excludedTaskIds.has(t.id))
taskSum = tier === 'elite'
  ? selectedTasks.reduce(sum, t.estimated_price) * 1.4
  : selectedTasks.filter(notBundledCleaning).reduce(sum, t.estimated_price)
subtotal = taskSum + (tier === 'elite' ? 0 : shippingFee)
taxable = max(0, subtotal - discount)
gst = order.is_gst_applicable ? taxable * 0.18 : 0
total = taxable + gst
```
GST line shown ONLY if `order.is_gst_applicable` is true.

---

## Workstream 4: Multi-Photo Swipe Gallery

### `src/components/portal/PortalPhotoViewer.tsx`
Replace the single-image viewer with a horizontal swipe carousel:

- Use `embla-carousel-react` (already installed as `embla-carousel-react ^8.6.0`)
- Implement `scroll-snap-type: x mandatory` via CSS for native mobile feel
- Add dot indicators below the carousel showing the active slide
- **Marker Sync**: Track `activeIndex` state. When the user swipes to a new photo, look up markers for that photo's `photo_id` and render only those pins
- Props change: accept `photos: { id, url }[]` and `markers: DamagePin[]` (with `photo_id` added to the interface) instead of a single `photoUrl`
- Keep the `BeforeAfterSlider` export unchanged

### `src/components/portal/PortalOrderCard.tsx`
Update the `PortalPhotoViewer` usage in State B to pass the full `orderPhotos` array and all markers (the viewer will handle filtering by active photo).

---

## Workstream 5: Admin & Oversight (Verification)

These are already implemented and functional -- no code changes needed, but will be verified during implementation:

- **Header Buttons** (`src/pages/OrderDetail.tsx` lines 130-146): Gold "Open Portal" and "Copy Link" buttons are present in the last diff
- **Refund Pulse** (`src/pages/Orders.tsx` lines 12, 45-46, 176-179): "Refunds" tab filters declined/cancelled with `advance_paid > 0`, red pulsing badge shows refund amount
- **Scope Lock** (`src/components/orders/ExpertHuddle.tsx` lines 58-62, 116-121, 124-131): `canRemoveTask` prop prevents tag removal and price lowering in workshop/qc status
- **Eye Icon** (`src/pages/Orders.tsx` lines 194-206): Gold Eye icon opens portal in new tab

---

## Workstream 6: Approval Flow & Lockdown

### Portal Approval (`src/pages/Portal.tsx` lines 92-99)
Update `handleApproveAll` to include interactive sales state in the API call:
```text
await callAction("approve", {
  orderIds: ids,
  tiers: { [orderId]: selectedTier },
  excludedTaskIds: { [orderId]: [...excludedIds] }
});
```
This requires lifting `selectedTier` and `excludedTaskIds` state from PortalOrderCard up to Portal via callback props.

### Edge Function (`supabase/functions/serve-portal/index.ts` -- approve action, ~line 104)
Update the `approve` handler to:
1. Accept `tiers` object (map of orderId to selected tier)
2. Accept `excludedTaskIds` object (map of orderId to array of task IDs to exclude)
3. For each order: update `package_tier` to selected tier, recalculate pricing using the same formula
4. For excluded tasks: mark them as declined (set `is_completed = true` with a note, or delete them)

### Payment Lock (already working)
- Portal "I Have Paid" button reads `payment_declared` and shows "Verifying..." when true (Portal.tsx lines 237-240)
- Admin "Payment Not Found" button resets via `rejectPaymentDeclaration` mutation
- No changes needed

### Post-Approval Lock
After `customer_approved_at` is set, the tier cards and optional checkboxes should be disabled. Check `order.customer_approved_at` -- if set, render the pricing as read-only (no tier switcher, no checkboxes).

---

## Files Summary

| # | File | Changes |
|---|------|---------|
| 0 | **DB Migration** | Add `is_optional boolean` to `expert_tasks` |
| 1 | `src/hooks/useOrderDetail.ts` | Wrap `recalcTotalPrice` in `useCallback` |
| 2 | `src/components/orders/PricingEngine.tsx` | `React.memo` wrapper |
| 3 | `src/index.css` | Light neumorphic portal theme variables and shadow utilities |
| 4 | `src/pages/Portal.tsx` | Branding, light theme classes, mobile sizing, lift tier/exclusion state, send on approve |
| 5 | `src/components/portal/PortalOrderCard.tsx` | `React.memo`, light theme, mobile sizing, tier switcher, optional task checkboxes, post-approval lock |
| 6 | `src/components/portal/PortalPhotoViewer.tsx` | Multi-photo swipe gallery with embla-carousel, dot indicators, marker sync per active photo |
| 7 | `src/components/orders/ExpertHuddle.tsx` | "Optional" checkbox toggle per task |
| 8 | `supabase/functions/serve-portal/index.ts` | Accept tier + excluded tasks on approve, recalculate and persist |

