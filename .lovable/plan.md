

# Fix Broken Components + Workflow Realignment for LeadDetail

## Summary

Fix 7 issues in one pass: broken category dropdown, silent add button, broken photo display, form reset, incorrect workflow stages, misplaced status stepper, and missing service type filtering by category.

---

## Changes

### File 1: `src/pages/LeadDetail.tsx`

**1. Photo display fix (broken images)**
The `lead-photos` storage bucket is private. The current code uses `getPublicUrl()` which only works for public buckets. Fix by making the bucket public via a migration (preferred -- photos are not sensitive, and the order-photos bucket is already public). Alternatively, switch to signed URLs in the hook.

**2. Category-based service type filtering**
Add a constant map:

```text
CATEGORY_SERVICE_TYPES = {
  Bag: ["restoration", "cleaning", "hardware", "dye", "spa"],
  Shoe: ["restoration", "cleaning", "repair", "spa"],
  Belt: ["restoration", "cleaning", "repair", "dye"],
  Wallet: ["restoration", "cleaning", "repair"],
}
```

When `newCategoryId` changes, reset `newServiceType` to `""`. Filter the Service Type dropdown options based on the selected category name. If no category is selected, show all options.

**3. Add button feedback**
The Add button is currently disabled when any field is empty (correct behavior). Add a visible toast/feedback when the user clicks while fields are missing, instead of silently disabling. Change the disabled button to show which field is missing via a tooltip or small helper text below.

**4. Form reset after adding item**
Already implemented in the `onSuccess` callback (lines 130-134). Verify this works by ensuring mutation completes without error. The issue may have been the mutation itself failing silently -- the `onError` handler already shows a toast, so this should work once the category/service type fixes are in.

**5. Remove STATUS_FLOW stepper and "Move to" button entirely (lines 561-585)**
Delete the entire "Order Progress" section with the stepper bar and the advance button. This belongs on `OrderDetail.tsx`, not the lead page.

**6. Implement the 4-stage linear workflow**
Replace the removed stepper and the current convert button block (lines 561-604) with the correct flow:

- **Stage: DRAFT** (status = "New" AND no items): Show Save Lead button (already in address section), Add Item form (already present). Hide "Send to Portal" and "Convert to Order".

- **Stage: READY TO QUOTE** (status = "New" AND items exist): Show a "Send to Portal" button. On click: update lead status to "quoted". Show toast "Lead sent to customer portal". Hide Convert button.

- **Stage: QUOTED** (status = "quoted"): Show Convert to Order button (gated by items + pincode). Show read-only message "Awaiting customer approval via portal". Hide Send to Portal.

- **Stage: CONVERTED** (lead has `converted_order_id`): Show a read-only banner "This lead has been converted to an Order" with a link to the order. Hide all action buttons.

**7. Remove "Assign to Workshop" logic entirely**
Delete `advanceLabel`, `handleAdvance`, `STATUS_FLOW` usage, and the `nextStatus` variable. Remove the import of `STATUS_FLOW` from `useLeadDetail`.

### File 2: `src/hooks/useLeadDetail.ts`

**1. Add `converted_order_id` and `lifecycle_status` to the lead query**
Extend the select clause and the `LeadDetail` interface to include `convertedOrderId` and `lifecycleStatus`.

**2. Accept "quoted" as a valid status in `updateStatus`**
No code change needed -- the mutation already does a generic `update({ status: newStatus })` which accepts any string. The `leads` table has no CHECK constraint on status, so "quoted" will work.

### File 3: Database Migration

Make the `lead-photos` storage bucket public so `getPublicUrl()` returns working URLs:

```text
UPDATE storage.buckets SET public = true WHERE id = 'lead-photos';
```

---

## Files NOT Changed

- `OrderDetail.tsx` -- not touched
- `Portal.tsx` -- not touched
- Any RPC or edge function -- not touched
- `useLeadDetail.ts` -- only the query select and interface are extended

## What Gets Removed

- The entire STATUS_FLOW stepper progress bar (lines 561-585)
- The "Move to Assigned" / "Assign to Workshop" button
- The `advanceLabel` and `handleAdvance` logic
- Direct `STATUS_FLOW` usage in LeadDetail

## What Gets Added

- `CATEGORY_SERVICE_TYPES` constant map for filtered service type dropdown
- "Send to Portal" button (visible when status=New and items exist)
- "Converted" banner with order link (visible when convertedOrderId is set)
- "Awaiting customer approval" message (visible when status=quoted)
- `convertedOrderId` and `lifecycleStatus` fields on `LeadDetail` interface

