

# 97% Sales Recovery Enhancement, System Toggles, and Workshop Upgrades

## Overview
Enhance the existing Recovery page with AI-drafted messages, add master system toggles for Workshop and Inventory modes, and improve the Workshop with item-level photo views and single-tap status progression.

---

## Pillar 1: AI-Powered Recovery Messages

### Current State
The Recovery page (`src/pages/Recovery.tsx`) already identifies stale leads and sends discount-based offers. It needs an AI "Draft Recovery Message" button.

### Changes

**New Edge Function: `supabase/functions/draft-recovery/index.ts`**
- Accepts lead details (customer name, brand, service, quoted price, hours stale)
- Calls Lovable AI Gateway (`google/gemini-3-flash-preview`) with a luxury follow-up prompt
- Returns a personalized WhatsApp-style recovery message
- Non-streaming (simple invoke pattern)

**Update `src/pages/Recovery.tsx`**
- Add a "Draft Message" button on each pending/expired RecoveryCard
- On click, call the edge function via `supabase.functions.invoke("draft-recovery")`
- Display the AI-generated message in a dialog with "Copy to Clipboard" and "Send via WhatsApp" actions
- Also fetch brand info from `lead_items` joined with `brands` to enrich the AI prompt

**Update `supabase/config.toml`**
- Add `[functions.draft-recovery]` with `verify_jwt = false`

---

## Pillar 2: Shadow Inventory (Already Exists -- Refinements Only)

### Current State
- `inventory_items` table exists with full CRUD
- `service_recipes` table exists linking services to inventory items
- `deduct_inventory_on_ready()` trigger already auto-deducts stock when a lead moves to "Ready for Pickup"
- The Workshop already displays "Materials Needed" per card

### Changes
- No database changes needed -- the infrastructure is complete
- The system toggle (Pillar 3) will control whether inventory deduction is active

---

## Pillar 3: Master System Toggles

### Database
Use the existing `app_settings` table to store two toggle keys:
- `workshop_tracking_enabled` (default: `"true"`)
- `inventory_automation_enabled` (default: `"true"`)

No migration needed -- just insert rows via the app.

### New Hook: `src/hooks/useSystemToggles.ts`
- Fetches `workshop_tracking_enabled` and `inventory_automation_enabled` from `app_settings`
- Returns `{ workshopEnabled, inventoryEnabled, isLoading }`
- Cached via React Query

### Update `src/components/AppLayout.tsx`
- Import `useSystemToggles`
- If `workshopEnabled` is OFF, hide "Workshop" from sidebar nav
- If `workshopEnabled` is OFF, hide "Inventory" from sidebar (inventory depends on workshop)

### Update `src/App.tsx`
- Workshop and Inventory routes remain accessible (no redirect) but hidden from nav when toggled off

### New: Admin Hub > System Controls Tab
- Add a "System" tab in `src/pages/AdminHub.tsx` (visible to admins and super admins)
- Two Switch toggles:
  - **Workshop Tracking Mode** -- toggles `workshop_tracking_enabled`
  - **Inventory Automation** -- toggles `inventory_automation_enabled`
- Each toggle updates `app_settings` via upsert

### Update Inventory Deduction Logic
- Modify the `deduct_inventory_on_ready` trigger to check the `inventory_automation_enabled` setting before deducting
- Alternative (simpler): Check the toggle client-side in Workshop before calling the status update -- if inventory automation is OFF, skip the deduction toast but the DB trigger still runs. For true control, update the DB trigger via migration to check `app_settings`.

**Decision**: Update the DB trigger to check the setting, ensuring deductions are truly skipped when toggled off.

**Migration**: Modify `deduct_inventory_on_ready()` to query `app_settings` for `inventory_automation_enabled` and skip deduction if `'false'`.

---

## Pillar 4: Multi-Item Workshop Status Station

### Changes to `src/pages/Workshop.tsx`

**Fetch lead_items with photos**: Update the Workshop query to also fetch `lead_items` and their `lead_photos` for each lead, displaying item-level photos on each Kanban card.

**Single-tap stage progression**: Add a prominent "Next Stage" button on each card that advances the lead through: New -> In Progress -> QC -> Ready for Pickup (already partially exists via drag-and-drop, this adds a tap target).

**Item photo thumbnails**: For each lead card, show small thumbnail previews of uploaded photos from `lead_photos` (via signed URLs from the `lead-photos` storage bucket).

---

## Files Changed Summary

| File | Action |
|------|--------|
| `supabase/functions/draft-recovery/index.ts` | New -- AI recovery message generator |
| `supabase/config.toml` | Auto-updated for new function |
| `src/pages/Recovery.tsx` | Add "Draft Message" button + AI dialog |
| `src/hooks/useSystemToggles.ts` | New -- reads workshop/inventory toggles |
| `src/pages/AdminHub.tsx` | Add "System" tab with master toggles |
| `src/components/AppLayout.tsx` | Conditionally hide Workshop/Inventory nav |
| `src/pages/Workshop.tsx` | Add item photos, single-tap stage button |
| Migration SQL | Update `deduct_inventory_on_ready` to respect toggle |

---

## Technical Notes

- AI messages use Lovable AI (`google/gemini-3-flash-preview`) via the pre-configured `LOVABLE_API_KEY` -- no additional secrets needed.
- The `app_settings` table already has RLS policies allowing authenticated reads and admin writes, so no new policies are required.
- Photo thumbnails use `supabase.storage.from("lead-photos").createSignedUrl()` for secure, time-limited access.
- The inventory deduction trigger update uses `current_setting` or a direct query to `app_settings` to check the toggle value within the SECURITY DEFINER function.

