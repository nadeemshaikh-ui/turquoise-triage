

# System Overhaul: Fix UI Flaws in Triage and Service Logic

## Overview

Four changes: (1) Issue tags already support multi-select -- just move them out of the hidden "Advanced" section onto the main screen. (2) Replace hard-coded category tiles with dynamic categories derived from the services data. (3) Make the price slider snap to the selected service's default price and enforce its minimum. (4) Add auto-justification text to the Elite Quote Preview based on selected issue tags.

---

## 1. Multi-Select Issues on Main Screen

**Current state**: `IssueTagger` already supports multi-select (toggle on/off). However, it is buried inside a collapsed "Advanced" section in `NewLeadDialog.tsx`.

**Change in `NewLeadDialog.tsx`**:
- Move the `IssueTagger` component and the "Condition Report" display OUT of the Collapsible and onto the main form, between the Service Selection card and the Pricing card.
- The "Advanced" collapsible will only contain PhotoUpload going forward.
- The condition note already concatenates all selected issues -- no logic change needed in `IssueTagger`.

---

## 2. Dynamic Categories from Services Data

**Current state**: `ServiceSelection.tsx` has a hard-coded `CATEGORIES` array mapping category names to icons.

**Change in `ServiceSelection.tsx`**:
- Remove the hard-coded `CATEGORIES` constant.
- Derive categories dynamically from the `services` prop: extract unique category names from the services array.
- Use a simple icon mapping function that assigns a sensible default icon per known category name (ShoppingBag for "Luxury Bags", Footprints for "Cleaning", Wrench for "Repair & Structural", Palette for "Restoration & Color") and a generic Sparkles icon for any new/unknown category.
- The category label will be the actual category name from the database (not a short alias like "Bag").
- This means if a new category is added to the services table, it automatically appears in the Triage screen.

---

## 3. Unified Pricing Logic -- Slider Snaps + Enforced Minimum

**Current state**: The slider in `DualPriceSlider` has a fixed min of 1000 and max of 50000. When a service is selected, `NewLeadDialog` sets `basePrice` to the service's `default_price`, but the slider still allows going below the service minimum.

**Changes**:

**`DualPriceSlider.tsx`** -- Add new props:
- `minPrice: number` (the floor the slider cannot go below)
- `defaultPrice: number | null` (for display reference)

Update the `Slider` component:
- Set `min={minPrice}` instead of hard-coded 1000
- Keep `max={50000}`, `step={500}`
- Clamp the `onValueChange` callback so the value never goes below `minPrice`

**`NewLeadDialog.tsx`**:
- Compute `sliderMin` from the selected service: use `price_range_min` if set, otherwise `default_price`, otherwise 1000.
- When `selectedService` changes, snap `basePrice` to the service's `default_price` (already done) AND clamp it to be >= `sliderMin`.
- Pass `minPrice={sliderMin}` to `DualPriceSlider`.
- Update the validation to use the dynamic min instead of hard-coded 1000.
- Remove any "Fixed Price" labels from DualPriceSlider -- the slider is the final authority.

---

## 4. Auto-Justification on Elite Quote Preview

**Current state**: `QuotePreview.tsx` shows a static comparison table with generic justifications (Italian Pigments, Nano-Ceramic Shield, Master Artisan).

**Changes in `QuotePreview.tsx`**:
- Accept a new prop: `issueTags: string[]`
- Define a justification map linking issue tag IDs to specific Elite justifications:

```text
color_fading    -> "Premium Italian Pigments for lasting color restoration"
deep_scuffs     -> "Micro-abrasion leveling with ceramic finish"
ink_stains      -> "Specialized solvent treatment with color-safe neutralizer"
sole_separation -> "Industrial-grade re-bonding with heat-press seal"
water_damage    -> "Deep moisture extraction + anti-fungal treatment"
peeling         -> "Full re-lamination with imported adhesive compound"
hardware_damage -> "Precision hardware restoration with anti-tarnish coating"
structural_deform -> "Structural reshaping with memory-form insert"
```

- Replace the static "Materials" row in the comparison table with dynamically generated rows based on selected issues.
- If no issues are selected, fall back to the existing generic justifications (Italian Pigments, Nano-Ceramic Shield).
- Each justification row shows the Elite treatment vs. a generic "Standard" label for Premium.

**Changes in `NewLeadDialog.tsx`**:
- Pass `issueTags={issueTags}` to the `QuotePreview` component.

---

## Files to Modify

| File | Key Changes |
|------|-------------|
| `src/components/intake/NewLeadDialog.tsx` | Move IssueTagger to main screen; compute dynamic slider min; pass issueTags to QuotePreview |
| `src/components/intake/ServiceSelection.tsx` | Derive categories dynamically from services prop instead of hard-coded array |
| `src/components/intake/DualPriceSlider.tsx` | Accept `minPrice` prop; enforce slider floor; remove fixed-price labels |
| `src/components/intake/QuotePreview.tsx` | Accept `issueTags` prop; render dynamic justification rows based on selected issues |

## No Database Changes Required

All data (categories, prices, price ranges) already exists in the `services` table.

## Technical Notes

- The icon mapping for dynamic categories is a simple switch/map in code -- not stored in the database. This avoids a migration while still being dynamic: new categories get a default icon, and known ones get their specific icon.
- The `price_range_min` field on services is already nullable. For services without it, we fall back to `default_price` as the floor, then to 1000 as the absolute minimum.
- Issue multi-select already works in `IssueTagger` -- the only change is its placement on the form.
