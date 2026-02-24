

# Minimalist Command Center -- Restoree 360 UI Finalization

## Overview

Strip the UI down to an executive-focused "Command Center" with two primary views (Triage Inbox + Active Workshop), a single-screen triage dialog, Elite-first pricing, iPad-optimized touch targets, and an inline quote preview before sending.

---

## Changes

### 1. Simplify Navigation -- Hide Advanced Settings

**File: `src/components/AppLayout.tsx`**

Reduce the bottom nav to only 2 core items for all users, plus a conditional admin toggle:

- **Visible to all**: Dashboard (renamed "Triage Inbox") and Workshop (renamed "Active Workshop")
- **Hidden by default**: Inventory, Customers, Finance, Recovery, Services, Automations
- Add a small "More" overflow button (three dots icon) that reveals the hidden nav items in a popover/sheet -- only when needed
- Keep the header clean: just the logo, "New Lead" button, alert bell, and sign out

### 2. Single-Screen Triage -- All 3 Steps on One View

**File: `src/components/intake/NewLeadDialog.tsx`**

Replace the multi-step wizard with a single scrollable (but compact) screen inside the dialog:

- Remove the `step` state, `STEPS` array, progress bar, and Next/Back buttons entirely
- Render all three sections vertically in one view:
  1. **Category + Service** -- compact 2x2 category icons (smaller, 48px) with inline filtered service chips below
  2. **Issue Tags** -- compact 4-col tag grid (smaller chips, `min-h-[44px]`)
  3. **Price Slider** -- dual-input slider with Elite/Premium cards side by side
- **Customer details** collapse into a minimal inline row: just Name and Phone fields side by side (email and notes hidden behind an "Add details" toggle)
- Dialog uses `sm:max-w-2xl` for desktop width and `max-h-[85vh] overflow-y-auto` to fit on iPad without external scrolling
- Remove `RecentTriages` from inside the dialog (move to dashboard)

**File: `src/components/intake/ServiceSelection.tsx`**
- Reduce icon size from `h-10 w-10` to `h-8 w-8`, tile `min-h` from 96px to 64px
- Make service cards single-line compact chips instead of multi-line cards

**File: `src/components/intake/IssueTagger.tsx`**
- Remove the section header (save vertical space)
- Compact the tag grid to always show 4 columns with smaller padding

**File: `src/components/intake/DualPriceSlider.tsx`**
- Remove the "Base Price" label section header
- Make the slider thumb larger (`h-6 w-6`) for thumb-friendly sliding
- Compact the Elite/Premium comparison cards (reduce padding)

**File: `src/components/intake/CustomerDetails.tsx`**
- Restructure to a 2-column inline layout: Name and Phone side by side
- Email and Notes hidden behind an expandable "More details" link

### 3. Default to Profit -- Elite Pre-Selected

**File: `src/components/intake/NewLeadDialog.tsx`**
- Already defaults to Elite (`useState<"Premium" | "Elite">("Elite")`)
- Add visible "Downgrade to Premium" text button below the price cards
- When tapped, switches tier and shows the Premium price as the selected quote
- Visual emphasis: Elite card gets a glowing border; Premium card is muted/dimmed until actively selected

### 4. iPad Touch Optimization

**File: `src/components/ui/slider.tsx`** (or via className overrides)
- Increase slider thumb to `h-7 w-7` with a visible ring for easier thumb control
- Increase slider track height to `h-2`

**Across all intake components:**
- All interactive buttons use `min-h-[48px]` (already mostly done)
- Category tiles: `min-h-[64px]` with clear active state
- Issue tags: `min-h-[44px]` with bold selected fill
- CTA buttons: `min-h-[52px]` with larger text (`text-base`)

### 5. Instant Quote Preview Window

**File: `src/components/intake/NewLeadDialog.tsx`**

Add a new state `showPreview` and a `QuotePreview` inline component:

- When "Generate Quote" is clicked, instead of immediately submitting, set `showPreview = true`
- Display a preview panel that slides in (or replaces the form content) showing exactly what the customer will see:
  - Service name and condition report
  - Elite vs Premium side-by-side cards (reuse the same layout from `Quote.tsx`)
  - Customer name and phone
  - "Confirm & Send via WhatsApp" and "Confirm & Create Lead" buttons
  - "Edit" button to go back to the form
- Only after confirming in the preview does the actual submission happen

**New file: `src/components/intake/QuotePreview.tsx`**
- Receives: service name, condition note, elite price, premium price, customer name, selected tier, photos (preview URLs)
- Renders a compact version of the public quote page layout
- Two action buttons: "Send WhatsApp" and "Create Lead"
- "Back to Edit" link

### 6. Move Recent Triages to Dashboard

**File: `src/pages/Index.tsx`**
- Add `RecentTriages` component below the stats bar on the main dashboard instead of inside the dialog

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/intake/QuotePreview.tsx` | Inline preview of customer-facing quote before sending |

## Files to Modify

| File | Key Changes |
|------|-------------|
| `src/components/AppLayout.tsx` | Simplify nav to 2 core items + "More" overflow |
| `src/components/intake/NewLeadDialog.tsx` | Single-screen layout, remove steps, add preview state |
| `src/components/intake/ServiceSelection.tsx` | Compact category tiles and service chips |
| `src/components/intake/IssueTagger.tsx` | Remove header, compact grid |
| `src/components/intake/DualPriceSlider.tsx` | Larger slider thumb, compact cards |
| `src/components/intake/CustomerDetails.tsx` | 2-column inline layout with collapsible extras |
| `src/pages/Index.tsx` | Add RecentTriages to dashboard |

---

## Technical Notes

- No database changes required -- this is purely a UI/UX restructuring
- The `QuotePreview` component reuses the same price calculation logic already in `NewLeadDialog`
- The "More" nav overflow uses the existing `Sheet` or `Popover` component from the UI library
- The slider thumb size is controlled via Tailwind classes on the Radix slider component
- All changes maintain the existing submission logic -- only the presentation layer changes

