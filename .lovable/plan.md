

# Ultimate Overhaul: Dynamic Restoration OS

## Overview
This overhaul introduces two new master tables (`brands` and `marketing_campaigns`), adds a "brand tagging" system linking brands to categories, expands the intake triage UI with brand selection and per-item photo uploads, and consolidates all master data management into a single Admin Hub page. The existing `service_categories` and `category_issues` tables remain as-is. Seed data is inserted via migrations.

---

## Phase 1: Database Changes (4 migrations)

### Migration 1 -- `brands` table
- Columns: `id`, `name`, `tier` (enum: `standard`, `luxury`, `ultra_luxury`), `is_active`, `sort_order`, `created_at`
- RLS: authenticated can manage (ALL)

### Migration 2 -- `brand_category_tags` junction table
- Columns: `id`, `brand_id` (FK brands), `category_id` (FK service_categories)
- Unique constraint on (brand_id, category_id)
- RLS: authenticated can manage

### Migration 3 -- `marketing_campaigns` table
- Columns: `id`, `name`, `is_active`, `sort_order`, `created_at`
- RLS: authenticated can manage

### Migration 4 -- Add `brand_id` column to `lead_items`
- `brand_id uuid references brands(id)` (nullable for backward compat)

### Migration 5 -- Seed data
Insert the following via the data insert tool (not migration):
- **Categories**: Add "Accessories" to existing Sneakers, Luxury Bags (rename to "Luxury Handbags"), Jackets (rename to "Leather Jackets")
- **Brands**: 13 brands across 3 tiers with category tags
- **Campaigns**: Meta_Ads_Feb, Instagram_Direct, Organic_WhatsApp

---

## Phase 2: Admin Hub Page (`/admin-hub`)

Replace the current `/service-master` route with a unified `/admin-hub` page containing 5 tabs:

1. **Categories** -- existing CRUD (carried over from ServiceMaster)
2. **Issues** -- existing CRUD (carried over)
3. **Packages** -- existing CRUD (carried over)
4. **Brands** -- new CRUD panel
   - Add/Edit dialog: Name, Tier (Standard/Luxury/Ultra-Luxury), Active toggle, Sort Order
   - Category tags: multi-select checkboxes to tag which categories this brand applies to
   - List view with tier badge, tag pills, edit/delete
5. **Campaigns** -- new CRUD panel
   - Add/Edit dialog: Name, Active toggle, Sort Order
   - List view with edit/delete

Update the sidebar nav to show "Admin Hub" instead of "Service Master".

---

## Phase 3: Intake Triage UI Enhancements

### 3a. Dynamic Campaigns in CustomerDetails
- Replace the hardcoded `CAMPAIGNS` array with a live query to `marketing_campaigns` table
- Accept campaigns as a prop from `NewLeadDialog`

### 3b. Brand Selection per Item (ItemCard)
- After category selection, show a searchable brand dropdown
- Filter brands by the selected category using `brand_category_tags`
- Display the brand tier as a colored badge (Standard=gray, Luxury=amber, Ultra-Luxury=purple)
- Store `brand_id` on the item

### 3c. Per-Item Photo Upload
- Each `ItemCard` gets its own compact photo upload area (inline, max 3 thumbnails + add button)
- Photos are stored per-item index and mapped to the correct `lead_item` after submission
- Update `lead_photos` table to add optional `lead_item_id` column (nullable FK to lead_items)

### 3d. QuoteItem type update
- Add `brandId`, `brandName`, `brandTier` fields to the `QuoteItem` type
- Add `photos: File[]` field per item

### 3e. Submission logic update
- Save `brand_id` on each `lead_items` insert
- Upload photos per-item, linking them to the specific `lead_item_id`

---

## Phase 4: Quote Preview Enhancement

- Show brand name + tier badge next to each item in the preview
- Show per-item photo thumbnails in the preview card

---

## Phase 5: LeadDetail Page Update

- Display brand name and tier on each lead item card
- Show item-level photos grouped under each item

---

## Files Changed

| File | Action |
|------|--------|
| `src/pages/ServiceMaster.tsx` | Rename to AdminHub, add Brands + Campaigns tabs |
| `src/components/intake/NewLeadDialog.tsx` | Add brand queries, per-item photos, dynamic campaigns |
| `src/components/intake/CustomerDetails.tsx` | Accept campaigns as prop instead of hardcoded |
| `src/components/intake/QuotePreview.tsx` | Add brand + photo display |
| `src/pages/LeadDetail.tsx` | Add brand display to items |
| `src/App.tsx` | Update route from `/service-master` to `/admin-hub` |
| `src/components/AppLayout.tsx` | Update nav label |
| Database | 4 schema migrations + seed data inserts |

---

## Technical Notes

- Brand tier is stored as a text column with a check constraint (`standard`, `luxury`, `ultra_luxury`) -- no Postgres enum to keep flexibility
- The brand search in the triage uses a client-side filter on the pre-fetched brands list (small dataset, no need for server-side search)
- Per-item photos use the existing `lead-photos` storage bucket with an added `lead_item_id` reference
- All new tables have RLS policies for authenticated users (consistent with existing pattern)
- Seed data is inserted via the data tool, not hardcoded in the app

