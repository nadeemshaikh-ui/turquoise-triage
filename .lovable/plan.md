

# Re-Engineer Triage: Hybrid Multi-Item Quote Builder

## Overview

This is a fundamental restructuring of the data model. Leads shift from "one service per lead" to "one lead = one customer order with multiple items." Each item has a category, and within that category the executive chooses either Alacarte issues (multi-select with per-issue pricing) or a Professional Package (pre-set bundle). A new Service Master admin page lets you define all categories, issues, and packages with suggestive prices.

---

## Database Changes

### 1. Add `city` and `address` to `customers`

```sql
ALTER TABLE customers ADD COLUMN city text;
ALTER TABLE customers ADD COLUMN address text;
```

### 2. New table: `service_categories`

Master list of item categories (Sneakers, Bags, Jackets, etc.). Replaces the freeform `category` column on `services`.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | e.g. "Sneakers", "Luxury Bags" |
| icon_name | text | e.g. "Footprints", "ShoppingBag" (for dynamic icon mapping) |
| sort_order | integer | Display ordering |
| is_active | boolean | default true |
| created_at | timestamptz | |

### 3. New table: `category_issues`

Alacarte issues per category, each with a suggestive price.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| category_id | uuid | FK to service_categories |
| name | text | e.g. "Deep Clean", "Color Restore", "Stitching" |
| suggestive_price | numeric | e.g. 500, 800 |
| description | text | Optional -- appears on quote |
| sort_order | integer | |
| is_active | boolean | default true |
| created_at | timestamptz | |

### 4. New table: `category_packages`

Professional packages per category (bundles).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| category_id | uuid | FK to service_categories |
| name | text | e.g. "The Full Revival", "Quick Refresh" |
| suggestive_price | numeric | e.g. 3500 |
| includes | text[] | List of what's included (display only) |
| description | text | Optional |
| sort_order | integer | |
| is_active | boolean | default true |
| created_at | timestamptz | |

### 5. New table: `lead_items`

Each item within a lead/order.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| lead_id | uuid | FK to leads |
| category_id | uuid | FK to service_categories |
| mode | text | "alacarte" or "package" |
| selected_issues | jsonb | Array of {issue_id, name, suggestive_price} |
| selected_package_id | uuid | Nullable FK to category_packages |
| selected_package_name | text | Snapshot of package name |
| suggestive_price | numeric | Auto-calculated from issues/package |
| manual_price | numeric | Executive's final price for this item |
| description | text | Editable item description |
| sort_order | integer | |
| created_at | timestamptz | |

### 6. Update `leads` table

- Keep existing columns for backward compatibility
- `quoted_price` becomes the sum of all `lead_items.manual_price`
- `service_id` becomes nullable (legacy, no longer required for new leads)

```sql
ALTER TABLE leads ALTER COLUMN service_id DROP NOT NULL;
```

### RLS

All new tables: Authenticated users can manage (ALL). Same pattern as existing tables.

Enable Realtime on `lead_items` for potential future use.

---

## New Page: Service Master (`/service-master`)

**File: `src/pages/ServiceMaster.tsx`**

Admin-only page with three sections:

### Section A: Categories
- List of categories with Add/Edit/Delete
- Each category has: Name, Icon (dropdown of Lucide icon names), Sort Order, Active toggle

### Section B: Alacarte Issues (per category)
- Select a category, then manage its issues
- Each issue: Name, Suggestive Price (INR), Description, Active toggle
- Example: Sneakers category -> Deep Clean (₹500), Color Restore (₹800), Sole Repair (₹1200)

### Section C: Professional Packages (per category)
- Select a category, then manage its packages
- Each package: Name, Suggestive Price, Includes list (comma-separated tags), Description, Active toggle
- Example: Sneakers -> "The Full Revival" (₹3500, includes: Deep Clean, Color Restore, Sole Repair, Polish)

**Navigation**: Add to `moreNav` in `AppLayout.tsx`, visible to admins only, with a `Settings` icon labeled "Service Master".

**Route**: Add `/service-master` to `App.tsx`.

---

## Rewrite: NewLeadDialog (Multi-Item Quote Builder)

**File: `src/components/intake/NewLeadDialog.tsx`**

### Screen 1: Customer + Items (single scrollable screen)

**Customer Section** (top):
- Name, Phone (10-digit), City, Address (optional), Marketing Campaign dropdown
- All on one visible section

**Items Section** (below customer):
- Starts with one empty item slot
- Each item card contains:
  1. **Category selector**: Horizontal chips from `service_categories`
  2. **Mode toggle**: Switch between "Alacarte" and "Package"
  3. **If Alacarte**: Multi-select chips of `category_issues` for the chosen category. Each chip shows name + price. Running subtotal updates as issues are toggled.
  4. **If Package**: Radio-select from `category_packages`. Shows package name, price, and "includes" list.
  5. **Suggestive Price**: Auto-calculated (sum of selected issues OR package price). Shown as a read-only badge.
  6. **Manual Price**: Editable input field. Defaults to the suggestive price but the executive can override.
  7. **Item Description**: Auto-generated from selected issues/package, editable by executive.

- **"+ Add Another Item"** button below the last item card
- **Remove Item** (X) button on each item card (except if only 1 item)

**Running Total** (sticky at bottom):
- "Premium Total: ₹X" (sum of all manual prices + ₹200 shipping)
- "Elite Total: ₹Y" (sum of all manual prices * 1.4, free shipping)

**Action Buttons**:
- "Create Lead" (saves without quote)
- "Generate Quote" (goes to preview)

### Screen 2: Quote Preview (Review & Edit)

Shows all items in an editable list:
- Each item: Category name, description (editable textarea), manual price (editable input)
- Order totals: Premium vs Elite comparison
- Customer summary
- Action buttons: Back to Edit, Create Lead, Generate Quote Link, Copy for Interakt

---

## Modified: QuotePreview Component

**File: `src/components/intake/QuotePreview.tsx`**

Rewrite to accept an array of items instead of a single service:

```typescript
type QuoteItem = {
  categoryName: string;
  description: string;
  manualPrice: number;
  suggestivePrice: number;
};

type Props = {
  items: QuoteItem[];
  // ... customer props, callbacks
};
```

- Display each item as an editable row
- Show subtotals per item
- Show order total with Elite (x1.4) vs Premium (+₹200) comparison
- Keep the Interakt copy button

---

## Modified: Lead Submission Logic

**In `NewLeadDialog.tsx` submit handler**:

1. Upsert customer (with new city/address fields)
2. Insert lead with `quoted_price` = sum of all item manual prices (for the selected tier)
3. Insert all `lead_items` linked to the lead
4. Generate `lead_quotes` record with elite/premium totals
5. Handle quote link generation and Interakt copy

---

## Modified: Quote Page (`/quote/:token`)

**File: `src/pages/Quote.tsx`**

Update to display multiple items:
- Fetch `lead_items` via the `serve-quote` edge function
- Show a list of items with descriptions and prices
- Show order total with Elite vs Premium comparison
- Elite remains the recommended/default option

---

## Modified: serve-quote Edge Function

**File: `supabase/functions/serve-quote/index.ts`**

- When fetching quote data, also query `lead_items` for the lead
- Return items array in the response
- Accept logic remains the same (accept Elite or Premium at the order level)

---

## Modified: LeadDetail Page

**File: `src/pages/LeadDetail.tsx`**

- Show a "Items" section listing all `lead_items` for the lead
- Each item shows: category, description, price

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/pages/ServiceMaster.tsx` | Admin page: manage categories, issues, packages |
| `supabase/migrations/xxx_multi_item_schema.sql` | All new tables + alterations |

## Files to Modify

| File | Key Changes |
|------|-------------|
| `src/App.tsx` | Add `/service-master` route |
| `src/components/AppLayout.tsx` | Add Service Master to admin nav, remove old Services link |
| `src/components/intake/NewLeadDialog.tsx` | Full rewrite: multi-item builder with hybrid menu |
| `src/components/intake/QuotePreview.tsx` | Rewrite for multi-item display with editable fields |
| `src/components/intake/CustomerDetails.tsx` | Add City and Address fields |
| `src/pages/Quote.tsx` | Display multiple items |
| `src/pages/LeadDetail.tsx` | Show items list |
| `supabase/functions/serve-quote/index.ts` | Return lead_items in response |

## Files to Remove/Deprecate

| File | Reason |
|------|--------|
| `src/components/intake/ServiceSelection.tsx` | Replaced by inline category/issue/package selection in the new item cards |
| `src/components/intake/IssueTagger.tsx` | Replaced by dynamic `category_issues` from the database |
| `src/components/intake/DualPriceSlider.tsx` | Replaced by per-item manual price + order-level Elite/Premium toggle |

---

## Technical Notes

- The old `services` table is NOT deleted -- existing leads reference it. New leads will use `lead_items` + `service_categories` instead. The old Services page (`/services`) can be kept for legacy or removed from nav.
- `lead_items.selected_issues` stores a snapshot (name + price at time of creation) so historical quotes remain accurate even if master prices change.
- Elite/Premium calculation moves to the order level: Elite = sum(manual_prices) * 1.4 with free shipping; Premium = sum(manual_prices) + ₹200 shipping.
- The Service Master page uses standard CRUD against the three new tables. No edge functions needed.
- Category icons use the same Lucide icon mapping pattern already established in `ServiceSelection.tsx`, but now driven by the `icon_name` column in `service_categories`.

