
# Restoree 360 Triage Command Center

## Overview
Replace the current Index page with a 3-column Kanban-style Command Center that sorts unconverted leads into INTAKE, NEGOTIATION, and HANDOVER columns with smart validation buttons.

## Data Architecture

**New dedicated hook** `useTriageLeads` that fetches leads with:
- Filter: `lifecycle_status = 'open'` AND `converted_order_id IS NULL` (unconverted only)
- Joined data: `customers(name)`, `lead_items(id, category_id, custom_category_label, service_type, manual_price, suggestive_price, lead_item_addons(price_at_time))`, `service_categories(name)`
- Order: `created_at DESC`
- Realtime subscription on leads table for instant card movement

**Column assignment logic** (case-insensitive):
- INTAKE: status is `New` (items being added, not yet quoted)
- NEGOTIATION: status is `Quoted` (quote sent, awaiting approval)
- HANDOVER: status is `Approved` or portal_stage is `Approved` (ready for conversion)

## Column Details

### Column 1: INTAKE (Orange #FF9F0A border)
- Shows leads with status = 'New'
- Button: "Finalize Quote"
- Validation (disable if ANY):
  - Lead has 0 items
  - Any item with category name matching 'Others' has no `custom_category_label`
- Action: Update lead status to 'Quoted' via supabase update

### Column 2: NEGOTIATION (Blue #0A84FF border)
- Shows leads with status = 'Quoted'
- Button: "Move to Handover"
- Validation: Disable if total price (sum of all item prices + addons) is 0 or less
- Action: Update lead status to 'Approved' (sets portal_stage appropriately)

### Column 3: HANDOVER (Green #30D158 border)
- Shows leads with status matching 'Approved' or portal_stage = 'Approved'
- Button: "Convert to Order"
- Action: Calls `convert_lead_to_order` RPC with user ID
- Safety: Immediate disable + spinner on click, re-enable on error

## UI Design
- Background: `bg-gray-100` (#F3F4F6)
- Cards: White (`bg-white`) with rounded corners, subtle shadow
- Left border: 4px solid colored accent per column
- Card content: Customer name (bold), category icon pills, total price (if > 0)
- Card click (non-button area): Navigate to `/leads/{id}`
- Empty state: "All caught up!" in soft grey centered text
- Responsive: `grid-cols-1 md:grid-cols-3`

## Components

### New: `src/hooks/useTriageLeads.ts`
- Fetches unconverted leads with items and addons joined
- Realtime subscription
- Returns leads grouped by column

### New: `src/components/dashboard/TriageCommandCenter.tsx`
- The 3-column grid component
- Contains `TriageCard` sub-component for each lead card
- Button mutation logic with loading states
- Uses `useAuth` for user.id in convert RPC

### Modified: `src/pages/Index.tsx`
- Replace current content with TriageCommandCenter + NewLeadDialog
- Keep the KPI cards (New Leads count, Pending Quotes count) above the columns
- Keep GoldTierLeads section below for gold-tier visibility

## State Refresh
- After any button action (Finalize Quote, Move to Handover, Convert), invalidate `["triage-leads"]` query
- Realtime subscription auto-refreshes on any leads table change
- On successful conversion, navigate to `/orders/{id}`

## Files Changed

| File | Action |
|------|--------|
| `src/hooks/useTriageLeads.ts` | Create -- fetch + realtime for unconverted leads with items |
| `src/components/dashboard/TriageCommandCenter.tsx` | Create -- 3-column grid with cards and smart buttons |
| `src/pages/Index.tsx` | Modify -- integrate TriageCommandCenter, keep KPI cards and GoldTierLeads |

## Technical Notes
- Status comparisons use `.toLowerCase()` for casing safety
- `convert_lead_to_order` is called with `p_actor_user_id: user.id` (same pattern as LeadDetail.tsx)
- Total price calculation: `sum(manual_price || suggestive_price) + sum(addon price_at_time)` per item
- The existing `useLeads` hook and `LeadsPipeline`/`RecentTriages` components remain but are no longer rendered on Index
