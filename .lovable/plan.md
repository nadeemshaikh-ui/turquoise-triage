

# Admin Settings: Team Expert Management + System Health Diagnostics

## Overview

Add two new admin components to the existing Admin Hub, accessible only to `super_admin` users:

1. **Expert Type Management** -- extend the existing TeamTab with an `expert_type` dropdown
2. **System Health Check** -- a new "Diagnostics" tab with 4 automated checks and surgical auto-resolve

No database migrations needed -- `profiles.expert_type` column already exists.

---

## 1. Extend TeamTab with Expert Type Column

**File: `src/components/admin/TeamTab.tsx`**

Add a 5th column "Expert Type" between "Current Role" and "Change Role":

- Dropdown with options: `executive`, `cleaning`, `repair`, `colour`, `none` (maps to null in DB)
- On change, immediately update `profiles.expert_type` for that user
- Show current value as a colored badge
- Uses the existing `supabase.from("profiles").update({ expert_type }).eq("user_id", userId)` pattern
- The profiles table RLS allows users to update their own profile, but since super_admin is doing this for others, we need to also fetch and update via the admin pattern (existing policy allows SELECT for all authenticated users; UPDATE is restricted to own profile)

**RLS consideration**: The current `profiles` UPDATE policy only allows `auth.uid() = user_id`. We need a migration to add an admin override policy so super_admins can update other users' expert_type.

**Database Migration** (small):
```sql
CREATE POLICY "Admins can update any profile"
ON public.profiles FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
```

---

## 2. New Diagnostics Tab Component

**New File: `src/components/admin/DiagnosticsTab.tsx`**

A professional diagnostic panel with a "Run Diagnostics" button that executes 4 checks sequentially with a progress bar.

### Check A: Math Integrity
- Fetch all orders where `status` is NOT `delivered` (active orders)
- For each order, fetch its `expert_tasks`
- Recalculate `total_price` using the exact Phase 1 formula:
  ```
  if (tier === 'elite'): total = SUM(all task prices)
  if (tier === 'standard'): total = SUM(task prices, excluding cleaning if bundle active) + shipping_fee + cleaning_fee
  ```
- Flag any order where DB `total_price` differs from calculated value
- Store: `orderId`, `customerName`, `dbPrice`, `calculatedPrice`, `diff`

### Check B: Orphan Check
- Query orders where `asset_id IS NULL`
- Query expert_tasks using a left join pattern: fetch all tasks, then check which have no matching order (or simply query `expert_tasks` and cross-reference with orders)
- Flag orphaned orders and orphaned tasks separately

### Check C: SLA Integrity
- Query orders where `status = 'consult'` AND `consultation_start_time IS NULL`
- Flag with order ID and customer name

### Check D: Storage Check
- Attempt to list files in the `order-photos` bucket (limit 1) to verify read access
- Attempt to upload and immediately delete a tiny test file to verify write access
- Report success/failure

### UI Layout
- "Run Diagnostics" button at top with animated progress bar (0% -> 25% -> 50% -> 75% -> 100% as each check completes)
- Results displayed in 4 cards, each with a status icon:
  - Green checkmark if no issues found
  - Red alert icon with count of issues if problems detected
- Each card expandable to show the flagged items in a table
- If ANY errors found, show a prominent "Resolve All" button at the bottom

### Auto-Resolve Logic (on "Resolve All" click)

**Math Errors**: For each flagged order, update `orders.total_price` to the calculated value using the exact formula.

**SLA Errors**: For each flagged order, set `consultation_start_time = updated_at` from the order record (NOT `now()`).

**Orphaned Orders (missing asset_id)**: For each, insert a new `asset_passport` record with `customer_id` from the order, `item_category = 'Unknown'`, `brand = null`. Then update `orders.asset_id` to the new passport ID.

**Orphaned Expert Tasks (no matching order)**: Delete them directly.

Show a confirmation dialog before resolving, then execute all fixes with a loading spinner. Display toast with summary of fixes applied.

---

## 3. Wire Into Admin Hub

**File: `src/pages/AdminHub.tsx`**

- Import `DiagnosticsTab`
- Add a new tab trigger "Diagnostics" visible only to `isSuperAdmin` (same pattern as Team tab)
- Add corresponding `TabsContent`

---

## Files Summary

### New files (1):
1. `src/components/admin/DiagnosticsTab.tsx` -- System health checks + auto-resolve

### Modified files (2):
1. `src/components/admin/TeamTab.tsx` -- Add expert_type dropdown column
2. `src/pages/AdminHub.tsx` -- Add Diagnostics tab (super_admin only)

### Database (1 migration):
- Add RLS policy for admins/super_admins to update any profile's expert_type

