

# Lead Triage and Quote Generation Engine - "Choice Architecture" UI

## Overview

A complete overhaul of the lead intake flow, replacing form-heavy steps with a tap-first "Choice Architecture" UX. The new flow features large icon-based category selection, tap-only issue tagging, a dual-input pricing slider, automatic Elite/Premium math, and a shareable Digital Quote page. The UI will be hybrid-optimized for both desktop executives and iPad touch review.

---

## Architecture

```text
+---------------------------+     +----------------------------+
|   NewLeadDialog (revised) |     |   /quote/:id (public page) |
|   3-Step Tap-to-Triage    |---->|   Luxury Quote Design      |
|                           |     |   Elite vs Premium compare |
+---------------------------+     +----------------------------+
         |                                     |
         v                                     v
  [leads table]                     [lead_quotes table]
  + issue_tags (jsonb)              + quote_token (unique)
  + condition_note (text)           + viewed_at, accepted_tier
```

---

## Step-by-Step Plan

### 1. Database Migration

Add new columns and a new table:

**`leads` table additions:**
- `issue_tags` (jsonb, default `'[]'`) -- stores selected issue tag IDs
- `condition_note` (text, nullable) -- auto-generated professional condition description

**New `lead_quotes` table:**
- `id` (uuid, PK)
- `lead_id` (uuid, FK to leads)
- `quote_token` (text, unique, not null) -- short random token for URL
- `premium_price` (numeric)
- `elite_price` (numeric)
- `premium_tat_min` / `premium_tat_max` (integer)
- `elite_tat_min` / `elite_tat_max` (integer)
- `viewed_at` (timestamptz, nullable)
- `accepted_tier` (text, nullable) -- "Premium" or "Elite" when customer accepts
- `accepted_at` (timestamptz, nullable)
- `created_at` (timestamptz, default now())
- RLS: authenticated users can manage; public SELECT by quote_token for the public quote page

### 2. Rewrite NewLeadDialog -- 3-Step Tap-to-Triage

Replace the current 4-step flow (Service -> Customer -> Photos -> Confirm) with a streamlined 3-step flow plus a sticky customer bar:

**Step 1: Category + Service Selection**
- Large tap-friendly icon tiles (64x64) for 4 categories: Bag (handbag icon), Shoe (footprints icon), Jacket (shirt icon), Other (sparkles icon)
- Tapping a category filters services below as compact selectable cards
- Responsive: 2x2 grid on mobile/iPad, horizontal row on desktop

**Step 2: Issue Tagging + Photos**
- Pre-defined clickable tag chips: "Color Fading", "Deep Scuffs", "Ink Stains", "Sole Separation", "Water Damage", "Peeling", "Hardware Damage", "Structural Deform"
- Multi-select; each tag has a mapped professional condition note snippet
- Auto-generates a combined "Condition Report" text from selected tags (no typing)
- Below tags: standardized Before photo upload grid (labeled "Before" slots)
- Merge photo upload into this step to reduce total steps

**Step 3: Pricing + Confirm**
- **Dual-Input Slider**: A range slider (1,000 - 50,000) synced with a manual input field; moving one updates the other
- **Elite Math Engine**: Auto-calculates both tiers side-by-side:
  - Premium: Base price + shipping estimate
  - Elite: Base + 40%, free shipping, 8-12 day express
- **Default to Elite**: The tier selector defaults to "Elite" instead of "Premium"
- Customer details (name, phone, email) collected inline at the bottom of this step
- Sticky "Generate WhatsApp Quote" button always visible at bottom

### 3. New Component: `IssueTagger.tsx`

A dedicated component for Step 2:
- Renders tag chips in a flex-wrap grid
- Each tag has an icon and label; selected state uses primary color fill
- Condition note mapping:

```text
"Color Fading"       -> "Visible color degradation across surface areas"
"Deep Scuffs"        -> "Deep surface scratches requiring restoration treatment"
"Ink Stains"         -> "Ink contamination requiring specialized solvent treatment"
"Sole Separation"    -> "Sole detachment requiring structural re-bonding"
"Water Damage"       -> "Water exposure damage with potential material warping"
"Peeling"            -> "Surface material peeling requiring re-lamination"
"Hardware Damage"    -> "Metal hardware showing corrosion or mechanical failure"
"Structural Deform"  -> "Structural deformation requiring reshaping treatment"
```

- Auto-generates a combined professional condition note from selected tags

### 4. New Component: `DualPriceSlider.tsx`

- Radix Slider (range 1000-50000, step 500) bound to an Input field
- Changing the slider updates the input; typing in the input moves the slider
- Below the slider: two side-by-side cards showing:
  - **Premium**: base price + estimated shipping (flat 200)
  - **Elite**: base * 1.4 + free shipping, with "RECOMMENDED" badge

### 5. Digital Quote Page: `/quote/:token` (Public)

A new public route (no auth required) that renders a luxury comparison card:

**Layout:**
- Header: Restoree 360 branding
- Before photo (prominent, from lead_photos)
- Condition Report (from issue tags)
- Side-by-side tier comparison table:

```text
| Feature              | Elite Artisan        | Premium              |
|----------------------|----------------------|----------------------|
| Delivery             | 8-12 Day Express     | 15-20 Day Standard   |
| Quality Check        | Master Artisan       | Professional Grade   |
|                      | Dual-Stage Check     |                      |
| Materials            | Imported Italian     | Professional Grade   |
|                      | Pigments             | Materials            |
| Protection           | Nano-Ceramic Shield  | Standard Finish      |
| Shipping             | FREE Pan-India       | +200 Shipping        |
| Price                | Elite price          | Premium price        |
```

- Two CTA buttons: "Choose Elite" / "Choose Premium"
- Clicking updates `lead_quotes.accepted_tier` and `accepted_at`
- Mobile-responsive with large touch targets

**Edge function: `serve-quote`** to handle the public page data fetch (reads lead + photos + quote by token without auth).

### 6. WhatsApp Quote Generation

When "Generate WhatsApp Quote" is clicked in Step 3:
- Creates the lead, generates a `lead_quotes` record with a random token
- Constructs the quote URL: `{SITE_URL}/quote/{token}`
- Invokes `send-whatsapp` with a new `template_type: "digital_quote"` containing the quote URL
- Falls back to copying the URL to clipboard if WhatsApp is disabled

### 7. Recent Activity Bar

At the bottom of the NewLeadDialog (or as a collapsible section on the Index page):
- Shows the last 5 created leads with: customer name, service, price, time ago
- Each item is clickable to navigate to the lead detail
- Compact horizontal scroll on mobile, row on desktop

### 8. Device Optimization (Hybrid UI)

- All category icons and issue tags use `min-h-[48px]` touch targets (iPad-friendly)
- High-contrast selected states with primary color fills (not just outlines)
- Desktop: wider grid layouts (4-col categories, 4-col tags)
- iPad/mobile: 2-col grids, larger text, more padding
- Use `useIsMobile()` hook already in codebase for conditional layouts
- Sticky bottom bar for the WhatsApp quote button uses `position: sticky; bottom: 0`

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/intake/IssueTagger.tsx` | Tag-based issue selection component |
| `src/components/intake/DualPriceSlider.tsx` | Synced slider + input pricing component |
| `src/components/intake/RecentTriages.tsx` | Last 5 triages bar |
| `src/pages/Quote.tsx` | Public digital quote page |
| `supabase/functions/serve-quote/index.ts` | Edge function to serve quote data publicly |
| Migration SQL | Add issue_tags, condition_note to leads; create lead_quotes table |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/intake/NewLeadDialog.tsx` | Complete rewrite to 3-step Tap-to-Triage with Elite default |
| `src/components/intake/ServiceSelection.tsx` | Replace with large icon category tiles |
| `src/components/intake/PhotoUpload.tsx` | Add "Before" label slots |
| `supabase/functions/send-whatsapp/index.ts` | Add `digital_quote` template type |
| `src/App.tsx` | Add public `/quote/:token` route |
| `src/integrations/supabase/types.ts` | Auto-updated after migration |

---

## Technical Considerations

- The `/quote/:token` page must be outside the `ProtectedRoute` wrapper so customers can view it without login
- The `lead_quotes` table needs a public SELECT policy filtered by `quote_token` for unauthenticated access
- The `serve-quote` edge function uses service role key to bypass RLS for fetching lead data
- Elite default: `useState<"Premium" | "Elite">("Elite")` in the dialog
- Slider uses `@radix-ui/react-slider` already installed in the project

