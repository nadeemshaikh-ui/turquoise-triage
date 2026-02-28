

# Wave 1+2: Data Integrity + Core UI Fixes for LeadDetail

## Pre-requisite: Database Migration

The `customers` table has `address` (text) and `city` (text) but **no `state` or `pincode` columns**. A migration is needed:

```text
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS pincode text;
```

No other schema changes needed -- `lead_items.description` already exists for the Belt/Wallet item description field.

---

## FIX 1 -- Structured Address Block

**Current state:** The LeadDetail page shows no address fields. Address lives on the `customers` table (`address`, `city`), not on `leads`.

**Changes to `src/pages/LeadDetail.tsx`:**

- Add 5 state variables: `addressLine1`, `addressLine2`, `city`, `state`, `pincode`
- Fetch customer data including `address`, `city`, `state`, `pincode` (extend the existing `customerLegacy` query or add a new one)
- On load, populate fields from customer data. For legacy data where only `address` exists, put it all in `addressLine1`
- Render 5 Input fields in an "Address" section after the info cards
- Pincode: `type="text"`, `inputMode="numeric"`, `maxLength={6}`, inline error if non-empty and not matching `/^\d{6}$/`
- On save (see FIX 5), update `customers` table:
  - `address`: concatenated string `${line1}${line2 ? ', ' + line2 : ''}, ${city}, ${state} - ${pincode}`
  - `city`: from city field
  - `state`: from state field  
  - `pincode`: from pincode field

---

## FIX 2 -- Category Enum Correction + Sneaker/Heels Mapping

**Current state:** Category dropdown fetches all active `service_categories` dynamically. The `order_items` CHECK constraint only allows `Bag`, `Shoe`, `Belt`, `Wallet`.

**Changes:**

- Replace the dynamic categories query with a query that filters to only the 4 valid names, OR hard-code 4 options but still look up their UUIDs from the `service_categories` table
- Approach: Keep the `categoriesOptions` query but filter results client-side to only show entries whose `name` is in `['Bag', 'Shoe', 'Belt', 'Wallet']`
- In the existing items list display, map `Sneaker` and `Heels` category names to `Shoe` for display
- The insert mutation already writes `category_id` (UUID), so no write-side mapping is needed as long as we only show the 4 valid categories in the dropdown

---

## FIX 3 -- Belt/Wallet: Item Description Field

**Current state:** The Add Item form has 3 dropdowns (Brand, Category, Service Type). No description field.

**Changes:**

- Add `itemDescription` state variable
- After the Category dropdown, conditionally render an Input field when selected category resolves to `Belt` or `Wallet`
- Label: "Specific Item Description", placeholder varies by category
- On insert, include `description: itemDescription` in the `lead_items.insert()` call
- Reset `itemDescription` on successful add
- Hide field entirely for Bag/Shoe

---

## FIX 4 -- Brand Dropdown: "+ Add New Brand"

**Current state:** Brand dropdown shows all active brands from DB.

**Changes:**

- Add a `"+ Add New Brand"` option at the end of the Select
- Add state: `isAddingBrand` (boolean), `newBrandName` (string)
- When `__add_new__` selected: hide Select, show Input + "Save Brand" button + "Cancel" link
- Save Brand: insert into `brands` table, invalidate `brands-options` query, auto-select new brand ID, restore Select
- Cancel: restore Select, clear input
- Inline error on failure

---

## FIX 5 -- "Save Lead" Button

**Current state:** There is no "Create" or "Generate Quote" button on this page. This is a detail/edit page, not a creation form. The page currently auto-saves nothing -- status changes and notes are saved individually.

**Adaptation:** Add a "Save Lead" button in the address section that:

1. Validates address fields (Line 1, City, State, Pincode required; Pincode must match `/^\d{6}$/`)
2. Updates the `customers` table with the structured address
3. Shows loading spinner (`isSaving` state)
4. Toast on success/error

This button saves the address data only (items and notes already have their own save mechanisms).

---

## FIX 6 -- Assign vs Convert Flow

**Current state:** The status stepper has a generic "Move to {nextStatus}" button. When status is `New`, it shows "Move to Assigned".

**Changes:**

- When `nextStatus === 'Assigned'`, label the button "Assign to Workshop" instead of "Move to Assigned"
- The onClick remains the same (calls `updateStatus.mutate('Assigned')`)
- Keep the "Convert to Order" button separate and unchanged
- Update convert gating to also check pincode validity:

```text
const pincodeValid = /^\d{6}$/.test(pincode);
const hasItems = leadItems && leadItems.length > 0;
const canConvert = hasItems && pincodeValid;
```

- Show stacked helper messages when blocked:
  - If `!hasItems`: "Add at least 1 item to convert"
  - If `!pincodeValid`: "A valid 6-digit Pincode is required to convert"

---

## Files Summary

| # | File | Change |
|---|------|--------|
| 0 | DB Migration | Add `state` and `pincode` columns to `customers` |
| 1 | `src/pages/LeadDetail.tsx` | All 6 fixes: structured address, category filtering, Belt/Wallet description, add-new-brand flow, save-lead button, assign label + convert gating |
| 2 | `src/hooks/useLeadDetail.ts` | Extend lead query to include customer address/city/state/pincode |

## What is NOT changed
- No RPCs or edge functions modified
- No changes to Orders.tsx, Portal.tsx, or order-related files
- All existing lead fields preserved (customer name, phone, notes, status, photos, activity)
- No item-level photo segregation
- No service_tasks fetching

