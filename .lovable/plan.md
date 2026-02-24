

# Master Update: Optimize Restoree 360 as the Primary Lab OS

## Overview

This update restores the Workshop Kanban as the operational backbone, brings back the hidden COGS engine, flattens the intake flow to a single screen, and adds a "Turns Bridge" popup. The Finance dashboard's Real Profit formula becomes: **(Turns Revenue) - (Meta Ad Spend) - (Material COGS)**.

---

## 1. Restore the Workshop Kanban (4 Lanes)

**File: `src/pages/Workshop.tsx`**

- Simplify `KANBAN_COLUMNS` to exactly 4 lanes:

```text
Triage  |  In-Work  |  QC  |  Ready
```

  - `Triage` = status "New"
  - `In-Work` = status "In Progress"
  - `QC` = status "QC"
  - `Ready` = status "Ready for Pickup"

- Remove "Assigned" and "Completed" columns entirely.

**File: `src/App.tsx`**

- Re-add the `/workshop` route inside the protected layout:
  ```
  <Route path="/workshop" element={<Workshop />} />
  ```
- Import `Workshop` from `./pages/Workshop`

**File: `src/components/AppLayout.tsx`**

- Add Workshop to the `coreNav` array (visible in bottom nav + sidebar):
  ```
  { path: "/workshop", label: "Workshop", icon: Hammer }
  ```

---

## 2. Elite Priority: Gold Glow + Pinned to Top

**File: `src/pages/Workshop.tsx`**

Already partially implemented -- Elite leads are rendered first in each column. Enhancements:

- Add a gold/amber glow border for Elite cards using a dedicated CSS class:
  ```
  border-amber-400 shadow-[0_0_20px_-2px_rgba(251,191,36,0.5)] ring-1 ring-amber-400/40
  ```
- Add a prominent "ELITE" badge with a crown/zap icon
- Ensure Elite leads are always sorted to the top within each lane (already done via `.filter()` split)

---

## 3. Hidden COGS Logic (Inventory stays, tab hidden)

**No changes needed to `src/pages/Inventory.tsx`** -- the page stays in the codebase and remains routed.

**File: `src/App.tsx`**
- Keep `/inventory` route (it's already removed from nav but we'll ensure the route exists for direct access if needed)

**File: `src/components/AppLayout.tsx`**
- Do NOT add Inventory to any nav array (sidebar or mobile). It stays hidden.
- The existing `service_recipes` table already links services to inventory items with quantities + cost_per_unit.

**File: `src/pages/Finance.tsx`**
- The P&L calculation already uses `service_recipes` to compute material COGS per lead. This logic stays intact.
- Update the "Real Profit" formula display to explicitly show: **Turns Revenue - Meta Ad Spend - Material COGS**
- Remove the Labor Cost section (or keep it as a collapsible "advanced" option) to simplify the formula as requested.

---

## 4. Single-Screen Intake

**File: `src/components/intake/NewLeadDialog.tsx`**

Replace the 3-step wizard with a single scrollable screen containing all fields:

- **Row 1**: Customer Name (text) + Phone (10-digit input)
- **Row 2**: Marketing Campaign dropdown (mandatory) -- uses existing `CAMPAIGNS` list
- **Row 3**: Service Selection (category tiles + service chips) -- existing `ServiceSelection` component
- **Row 4**: Price slider + tier selection (existing `DualPriceSlider`)
- **Bottom**: "Create" and "Generate Quote" buttons

Remove the step state, progress bar, and Back/Next navigation. All fields visible at once. Validation runs on submit.

Issue tags and photo upload move to an expandable "Advanced" section (collapsed by default) to keep the default screen clean.

---

## 5. The Turns Bridge Popup

**File: `src/pages/Workshop.tsx`**

When a card is moved to the "Ready" lane (status = "Ready for Pickup"):

- Show a dialog/alert:
  ```
  "Great! Now create the final invoice in Turns for [Price]."
  ```
  - Display the lead's `quotedPrice` prominently
  - Include a "Got it" dismiss button
  - Optionally include a "Copy Price" button that copies the price to clipboard

Implementation: Add a state `turnsBridgeLead` that triggers when `updateStatus` succeeds with status "Ready for Pickup". Render an `AlertDialog` with the message.

---

## 6. Finance Dashboard: Real Profit = Turns Revenue - Ad Spend - Material COGS

**File: `src/pages/Finance.tsx`**

The existing P&L logic in the `pnl` useMemo already calculates:
- `totalRevenue` (from leads + imports)
- `totalMaterialCost` (from service_recipes x inventory cost_per_unit)
- `totalAdSpend` (from meta_ad_spend)

Changes:
- Primary revenue source should be Turns Sales (`turns_sales` table) rather than lead `quoted_price`
- Update the formula label to: **Real Profit = Turns Revenue - Meta Ad Spend - Material COGS**
- Simplify the P&L cards to 4: Turns Revenue, Ad Spend, Material COGS, Real Profit
- Remove or collapse the Labor Cost card (simplification)
- Keep the two CSV upload buttons: "Upload Meta Spend" and "Upload Turns Sales"
- Remove the generic "Upload Revenue CSV" button (redundant with Turns)

---

## Files to Modify

| File | Key Changes |
|------|-------------|
| `src/App.tsx` | Add `/workshop` route back |
| `src/components/AppLayout.tsx` | Add Workshop to coreNav, keep Inventory hidden |
| `src/pages/Workshop.tsx` | 4 lanes, Elite gold glow, Turns Bridge popup |
| `src/components/intake/NewLeadDialog.tsx` | Single-screen intake (no steps) |
| `src/pages/Finance.tsx` | Real Profit = Turns Revenue - Ad Spend - Material COGS |

## No Database Changes Required

All tables (`leads`, `services`, `service_recipes`, `inventory_items`, `turns_sales`, `meta_ad_spend`) already exist with the needed columns.

---

## Technical Notes

- The Workshop Kanban uses `@hello-pangea/dnd` for drag-and-drop (already installed)
- Elite gold glow uses Tailwind amber utilities -- no custom CSS needed
- The Turns Bridge popup uses the existing `AlertDialog` component from shadcn
- Single-screen intake keeps all existing validation logic but runs it on submit instead of per-step
- The `deduct_inventory_on_ready` database trigger already handles stock deduction when status changes to "Ready for Pickup"
- COGS calculation via `service_recipes` joins is already wired in Finance -- just needs the display labels updated

