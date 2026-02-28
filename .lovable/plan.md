

# Strict Architectural Rebuild v2.0 -- Ship-Ready Plan

## Root Causes Confirmed

- `leads_status_check` constraint only allows `'New','In Progress','Ready for Pickup','Completed'` -- any update to `'Quoted'` silently fails at DB level. This is why "Send to Portal" appears unresponsive.
- `lead_photos.lead_item_id` FK exists but lacks `ON DELETE CASCADE` -- orphaned photo rows when items are deleted.
- `leads.tat_is_manual` column does not exist -- TAT manual lock cannot be persisted.

---

## Step 1: Database Migration (single migration, 4 changes)

**A) Add `tat_is_manual` column**
```sql
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS tat_is_manual boolean NOT NULL DEFAULT false;
```

**B) Fix status CHECK to include 'Quoted'**
```sql
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_status_check
  CHECK (status = ANY (ARRAY['New','Quoted','In Progress','Ready for Pickup','Completed']));
```

**C) Replace lead_photos FK with CASCADE + add index**
```sql
ALTER TABLE public.lead_photos DROP CONSTRAINT IF EXISTS lead_photos_lead_item_id_fkey;
ALTER TABLE public.lead_photos
  ADD CONSTRAINT lead_photos_lead_item_id_fkey
  FOREIGN KEY (lead_item_id) REFERENCES public.lead_items(id)
  ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_lead_photos_lead_item_id
  ON public.lead_photos(lead_item_id);
```

**D) Data normalization (via insert tool, not migration)**
```sql
UPDATE public.leads SET status = 'Quoted' WHERE status = 'quoted';
```

---

## Step 2: `src/hooks/useLeadDetail.ts`

- Add `tatIsManual: boolean` to `LeadDetail` interface
- Add `tat_is_manual` to the lead query select clause
- Map: `tatIsManual: row.tat_is_manual ?? false`
- Add `updateTat` mutation: updates `tat_days_min`, `tat_days_max`, `tat_is_manual` on leads table, with activity log entry
- Modify `updateStatus` mutation to use `.update().select('status, customer_id').single()` and return the updated row for caller verification
- Return `updateTat` from the hook

---

## Step 3: `src/pages/LeadDetail.tsx`

### 3a. Status casing
- Change `statusColor` map: replace key `quoted` with `Quoted`
- Change `isQuoted` check: `lead.status === "Quoted"`

### 3b. Portal gating (no optimistic UI)
- `handleSendToPortal`: run pre-quote validation first; if fails, toast error and return. Then call `updateStatus.mutate("Quoted")`. In `onSuccess`, verify returned row confirms `status === 'Quoted'` before showing success toast. In `onError`, show specific error.
- Portal controls (Copy Link / Preview / Recall) only render when `lead.status === "Quoted"` -- already gated by `isQuoted`, just fix the value.

### 3c. Canonical service_type
- Replace the service type dropdown/text-input with two pill buttons: **Cleaning** | **Restoration**
- Clicking sets `newServiceType` to lowercase `'cleaning'` or `'restoration'`
- Display as Title Case in UI
- Remove `manualServiceText` state entirely
- Add optional "Custom Label" text input (saves to `lead_items.description`) -- shown for all categories, not just Belt/Wallet

### 3d. Pricing with effective price display
- After category + service type selection: lookup `service_pricing_master` for `base_price`
- Show "Suggested: Rs. X" label when found
- `manualPrice` defaults to `base_price` if found, editable
- Effective price = `manualPrice > 0 ? manualPrice : basePriceFound ? basePrice : null`

### 3e. Pre-quote validation gate
Before firing `updateStatus("Quoted")`, check:
1. `leadItems.length >= 1` -- "Add at least one item"
2. Every item has `service_type` set -- "Item X missing service type"
3. Every item has `manual_price > 0` -- "Item X missing price"
4. For Bag/Shoe items: `brand_id` is set -- "Item X missing brand"
If any fail: show specific toast and do not call mutation.

### 3f. TAT with DB-persisted manual lock
- Initialize `tatOverridden` from `lead.tatIsManual` (not local-only)
- Auto-logic unchanged (restoration=10-15, all cleaning=3-5, else 4-5) but only runs when `!tatOverridden`
- On TAT input change: call `updateTat({ tat_days_min, tat_days_max, tat_is_manual: true })`
- Add "Reset to Auto" button below TAT inputs: calls `updateTat({ tat_is_manual: false, ...recomputed })` and sets `tatOverridden = false`

---

## Step 4: `src/components/dashboard/LeadsPipeline.tsx`

Add `Quoted` to `statusStyles` map:
```
Quoted: { dot: "bg-blue-500", badge: "bg-blue-100 text-blue-800 border-blue-300" }
```

---

## Files Changed

| File | Change |
|------|--------|
| DB Migration | Add `tat_is_manual`, fix status CHECK, cascade FK, index |
| Data Update | Normalize `quoted` to `Quoted` |
| `src/hooks/useLeadDetail.ts` | Add `tatIsManual` field, `updateTat` mutation, return row from `updateStatus` |
| `src/pages/LeadDetail.tsx` | Status 'Quoted', canonical service pills, effective price, pre-quote validation, TAT persistence + Reset to Auto |
| `src/components/dashboard/LeadsPipeline.tsx` | Add 'Quoted' to statusStyles |

## Files NOT Changed
- Order-related files (order status stays lowercase)
- `useLeadItemPhotos.ts` -- already correct
- `PricingMaster.tsx` -- no changes needed
- Edge functions -- not affected

