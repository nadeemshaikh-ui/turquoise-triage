

# LeadDetail v6 — Updated Plan (with Pricing Master Page)

## What Changed From Previous Plan

Added a new **Pricing Master** admin page for full CRUD on `service_pricing_master`. The LeadDetail price field now does a **live lookup** from this table and pre-fills the price as an editable suggestion -- staff can always override it.

---

## 1. Database Migration: Create `service_pricing_master`

Same as before -- create the table with `id`, `category`, `service_type`, `base_price`, RLS for authenticated users, and seed initial data.

```text
CREATE TABLE public.service_pricing_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  service_type text NOT NULL,
  base_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(category, service_type)
);

ALTER TABLE public.service_pricing_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage pricing"
  ON public.service_pricing_master FOR ALL
  USING (true) WITH CHECK (true);
```

Seed data inserted separately (not via migration) with rows for Luxury Handbags, Sneakers, Belt, Wallet categories.

---

## 2. NEW: Pricing Master Page (`src/pages/PricingMaster.tsx`)

A dedicated admin page for managing the `service_pricing_master` table. Follows the same UI patterns as AdminHub (Card list + Dialog for add/edit).

### Layout:
- Page title: "Pricing Master"
- Subtitle: "Manage service types and base prices per category"
- A category filter dropdown at the top (values from `service_pricing_master` distinct categories)
- Below: a list of pricing rows as Cards, each showing category, service type, and base price (Rs.)
- Each card has Edit (pencil) and Delete (trash) buttons
- "Add Pricing Rule" button at the top right

### Add/Edit Dialog:
- **Category** -- text input (free text, since these are DB-level category names like "Luxury Handbags", "Sneakers", etc.)
- **Service Type** -- text input (e.g., "restoration", "cleaning")
- **Base Price (Rs.)** -- number input, min 0, step 0.01
- Save button with loading spinner (Universal Async Rule)

### Delete:
- Inline confirm inside the card ("Remove this pricing rule? [Confirm] [Cancel]")
- Confirm button follows Universal Async Rule

### Access:
- Admin-only (wrapped in `AdminRoute` in App.tsx)
- Uses sonner toast for all feedback

---

## 3. Routing and Navigation Changes

### App.tsx:
- Add route: `<Route path="/pricing" element={<AdminRoute><PricingMaster /></AdminRoute>} />`
- Place inside the `AppLayout` wrapper alongside other admin routes

### AppLayout.tsx (sidebar):
- Add "Pricing" to `moreNav` array (admin-only section), using the `IndianRupee` icon from lucide-react
- Position it after "Services" and before "Automations"

---

## 4. `src/components/intake/NewLeadDialog.tsx` — Simplify to 2 Fields

Unchanged from previous plan:
- Strip to Name + Phone only
- Phone normalization (strip non-digits, handle 91/0 prefix, validate 10 digits)
- Upsert customer by phone, create lead with `customer_id`, navigate to lead detail
- All sonner toasts, Universal Async Rule on Create button

---

## 5. `src/pages/LeadDetail.tsx` — Major Overhaul

### Key difference: Dynamic price lookup

**Category pills:** Bag, Shoe, Belt, Wallet (mapped to service_categories UUIDs)

**Service Type dropdown:** Fetched dynamically from `service_pricing_master` using `CATEGORY_DB_MAP`:
```text
CATEGORY_DB_MAP = { Bag: 'Luxury Handbags', Shoe: 'Sneakers', Belt: 'Belt', Wallet: 'Wallet' }
```
Query: `SELECT DISTINCT service_type FROM service_pricing_master WHERE lower(category) = lower(dbCategory)`

**Price field (editable suggestion):**
- Always visible once category is selected, defaults to 0
- When service type is selected: query `SELECT base_price FROM service_pricing_master WHERE lower(category) = lower(dbCategory) AND lower(service_type) = lower(selectedServiceType)`
- If found: populate the price input with the base_price value
- Staff can freely edit/override this value (it is a suggestion, not locked)
- If no pricing rule exists: price stays at 0, staff types manually
- Input: `type="number"` `min="0"` `step="0.01"`

**All other LeadDetail changes remain the same:**
- Brand dropdown from `brands` table
- Add Item with Universal Async Rule, saves `manual_price` to `lead_items`
- Item Cards with inline delete confirmation
- Per-item photo upload to `lead-photos` bucket
- Orphaned photos section
- 3-state Send to Portal workflow (status `'New'` / `'quoted'`)
- Portal link uses `/portal/${lead.customerId}`

---

## 6. `src/hooks/useLeadDetail.ts` — Add New Functions Only

No existing functions changed. New additions:
- `useLeadItemPhotos(leadId, itemId)` -- photos for a specific item
- `useOrphanedPhotos(leadId)` -- photos with null `lead_item_id`
- `uploadItemPhoto` mutation
- `deleteItemPhoto` mutation

---

## Status Casing Rule
- `'New'` (capital N) for default and recall
- `'quoted'` (lowercase) for portal state

---

## Files Changed

| File | Summary |
|------|---------|
| DB Migration | Create `service_pricing_master` table |
| Data Insert | Seed initial pricing rows |
| `src/pages/PricingMaster.tsx` | **NEW** -- full CRUD admin page for pricing rules |
| `src/App.tsx` | Add `/pricing` route wrapped in AdminRoute |
| `src/components/AppLayout.tsx` | Add "Pricing" link to admin nav section |
| `src/components/intake/NewLeadDialog.tsx` | Simplify to Name + Phone, phone normalization |
| `src/pages/LeadDetail.tsx` | Category pills, dynamic price lookup as editable suggestion, per-item photos, inline delete, portal workflow |
| `src/hooks/useLeadDetail.ts` | Add photo query/mutation hooks (no existing functions modified) |

## Files NOT Changed
- `OrderDetail.tsx`, `Portal.tsx`, any RPC/edge function
- `supabase/client.ts`, `types.ts`, `.env`
- No existing functions in `useLeadDetail.ts` modified

