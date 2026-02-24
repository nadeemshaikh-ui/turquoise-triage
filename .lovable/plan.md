

# Add Tier Selector to New Lead Intake Dialog

## What Changes

Add a Premium/Elite tier toggle to the confirmation step (Step 4) of the New Lead dialog. When "Elite" is selected, the system automatically applies a 40% price markup, sets express delivery TAT (8-12 days), and saves the tier to the database.

## User Experience

On the final "Confirm" step, a two-option toggle appears above the price field:
- **Premium** (default) -- Standard pricing, standard TAT from the service defaults
- **Elite** -- Price auto-increases by 40%, TAT overrides to 8-12 days, badges show "Elite" with free shipping and artisan certification perks

Switching between tiers instantly recalculates the price and TAT fields. The user can still manually override after the auto-calculation.

## Technical Details

### 1. NewLeadDialog.tsx
- Add `tier` state: `useState<"Premium" | "Elite">("Premium")`
- Reset tier to "Premium" on dialog close
- When tier changes to "Elite": set `quotedPrice` to base price x 1.4, set TAT to 8-12
- When tier changes back to "Premium": restore service default price and TAT
- Pass `tier` and `onTierChange` to `TatConfirmation`
- Include `tier` in the lead insert payload (the `tier` column already exists on the `leads` table)

### 2. TatConfirmation.tsx
- Accept new props: `tier` and `onTierChange`
- Render a two-button toggle group (Premium / Elite) at the top of the confirmation step, using the existing `ToggleGroup` component
- When Elite is selected, show a small info box listing the perks: "40% premium pricing, 8-12 day express delivery, free Pan-India shipping, artisan certification"
- Display an "ELITE" badge with a Zap icon (matching the Workshop Kanban styling) when Elite is active

### No Database Changes Required
The `leads` table already has a `tier` column defaulting to `'Premium'`.

