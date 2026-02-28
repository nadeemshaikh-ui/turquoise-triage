

# Fix LeadDetail Interactivity and Logic Errors

## Issues Identified

1. **Service Type dropdown empty**: The `.ilike()` query is correct, but the `CATEGORY_DB_MAP` mapping works fine for exact DB values. The real issue is the query uses `ilike` which should match -- need to verify the query fires and add a manual text input fallback when 0 results return.

2. **Photo uploads**: The bucket name `lead-photos` is correct (confirmed in storage config). The `useLeadItemPhotos` hook correctly receives `leadId` and `item.id`. The `PhotoThumb` component already handles broken images with a placeholder. The issue may be that upload errors are silently swallowed -- need to add toast feedback on upload success/error in ItemCard.

3. **Send to Portal button unresponsive**: The `updateStatus` mutation in `useLeadDetail.ts` fires correctly but has no `onError` handler in the `handleSendToPortal` call. If the mutation fails silently, the user sees nothing. Need to add `onError` with a toast.

4. **Fixed TAT display**: The InfoCard hardcodes `lead.tatDaysMin` and `lead.tatDaysMax` from the DB (default 4-5). Need to compute dynamic TAT from items' service types and allow manual override.

5. **Bonus fix**: The console error "Function components cannot be given refs" indicates LeadDetail needs `React.forwardRef` or the route ref needs handling -- this is a React Router warning that doesn't break functionality but should be noted.

---

## Changes

### File 1: `src/pages/LeadDetail.tsx`

**Fix 1 -- Service Type fallback to text input**
- After the `serviceTypes` query, check if `serviceTypes.length === 0 && selectedPill` is true
- When true: replace the Select dropdown with a plain text Input for manually typing a service type
- When false: show the Select dropdown as now
- This ensures staff can always enter a custom service even if the pricing master has no entries for that category

**Fix 2 -- Photo upload feedback in ItemCard**
- In `handlePhotoUpload`, add `.mutate(files, { onSuccess, onError })` callbacks
- `onSuccess`: toast.success("Photos uploaded")
- `onError`: toast.error("Photo upload failed")
- The `PhotoThumb` component already shows a Camera placeholder icon on error -- no changes needed there

**Fix 3 -- Send to Portal error handling**
- In `handleSendToPortal`, add `onError` callback: `toast.error(err.message || "Failed to send to portal")`
- In `handleRecallFromPortal`, add `onError` callback: `toast.error(err.message || "Failed to recall")`
- This ensures any DB/RLS error is surfaced to the user

**Fix 4 -- Dynamic TAT computation**
- Add new state: `tatMin` and `tatMax` (initialized from `lead.tatDaysMin` / `lead.tatDaysMax`)
- Add a `useEffect` that recomputes TAT whenever `leadItems` changes:
  - If any item has service_type containing "restoration" (case-insensitive): set 10-15 days
  - Else if all items are "cleaning" (case-insensitive): set 3-5 days
  - Else: keep default 4-5 days
  - Only auto-set if user hasn't manually overridden (track with a `tatOverridden` boolean)
- Replace the static InfoCard TAT display with an editable inline section:
  - Show computed TAT as two small number inputs (min-max) that staff can override
  - Once manually changed, set `tatOverridden = true` so auto-compute stops

### Summary of UI changes in the TAT area:
- Replace the static "TAT" InfoCard with two small editable number inputs showing "X - Y days"
- When items change and user hasn't overridden, auto-update based on service types

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/LeadDetail.tsx` | Service type text fallback, photo upload toasts, portal error toasts, dynamic editable TAT |

## Files NOT Changed
- `src/hooks/useLeadDetail.ts` -- no changes needed, the mutation already works
- `src/hooks/useLeadItemPhotos.ts` -- no changes needed, upload/remove work correctly
- No database changes needed

