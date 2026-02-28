

# Lead Items Manager + Convert Gating

## Pre-requisite: Add `service_type` column to `lead_items`

The `lead_items` table currently lacks a `service_type` column. A single `ALTER TABLE` is needed to add it. This does NOT modify any existing RPC or function -- the `convert_lead_to_order` RPC already defaults to `'restoration'` when `service_type` is missing, so this is purely additive.

```text
ALTER TABLE public.lead_items 
  ADD COLUMN IF NOT EXISTS service_type text NOT NULL DEFAULT 'restoration';

-- Add CHECK constraint matching order_items
ALTER TABLE public.lead_items 
  ADD CONSTRAINT lead_items_service_type_check 
  CHECK (service_type IN ('restoration','repair','cleaning','dye','hardware','spa'));
```

## UI Changes: `src/pages/LeadDetail.tsx`

### 1. New imports
- Add `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` from shadcn select
- Add `Label` from shadcn label
- Add `useMutation, useQueryClient` from tanstack/react-query
- Add `Plus` icon from lucide-react

### 2. New queries (alongside existing `leadItems` query)

**Brands query:**
```text
supabase.from('brands').select('id, name').eq('is_active', true).order('name')
```

**Categories query:**
```text
supabase.from('service_categories').select('id, name').eq('is_active', true).order('name')
```

### 3. New state for inline "Add Item" form
- `newBrandId`, `newCategoryId`, `newServiceType` -- all string state for the 3 dropdowns

### 4. New mutations

**Add item mutation:**
```text
supabase.from('lead_items').insert({
  lead_id: id,
  brand_id: newBrandId,
  category_id: newCategoryId,
  service_type: newServiceType,
  sort_order: leadItems?.length || 0
})
```
On success: invalidate `["lead-items", id]`, reset form state.

**Delete item mutation:**
```text
supabase.from('lead_items').delete().eq('id', itemId)
```
On success: invalidate `["lead-items", id]`.

### 5. Replace the Lead Items section (lines 186-222)

Replace the current read-only items section with a full "Items" manager:

- **Header**: "Items" with item count badge
- **Existing items list**: Each item shows:
  - Category name (from `service_categories.name`)
  - Brand name (from `brands.name`) with tier badge (existing logic kept)
  - Service type badge
  - Price
  - Delete button (Trash2 icon) that calls the delete mutation
- **Add Item row** (inline form below the list):
  - 3 Select dropdowns in a row: Brand, Category, Service Type
  - Service Type has static options: restoration, repair, cleaning, dye, hardware, spa
  - "Add" button (disabled unless all 3 fields are selected)
- **Empty state**: When no items exist, show the add form with a prompt message

### 6. Gate the Convert button (lines 250-259)

The button is already gated with `disabled={converting || !leadItems?.length}`. Add helper text below it:

```text
{(!leadItems || leadItems.length === 0) && (
  <p className="text-center text-xs text-amber-600">
    Warning: Add at least 1 item to convert
  </p>
)}
```

## Files Summary

| File | Change |
|------|--------|
| DB Migration | Add `service_type` column + CHECK to `lead_items` |
| `src/pages/LeadDetail.tsx` | Add item manager UI with add/delete, brand/category/service_type dropdowns, convert gating helper text |

## What is NOT changed
- No RPCs modified
- No order-related files touched
- No address fields added or modified
- All existing lead fields (customer, notes, status, photos, activity) remain untouched

