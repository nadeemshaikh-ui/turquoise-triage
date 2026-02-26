

# Elite BI Command Center (V23) - Implementation Plan

## Overview
Complete overhaul of the Finance dashboard with token management via `app_settings`, multi-file uploads, strict CSV parsing, new Operations tab with D2C metrics, ad comparison checkboxes for AI, and upgraded AI CFO brain.

---

## 1. Database Migration

The `app_settings` table already exists but needs two new columns for Meta token management:

```sql
ALTER TABLE app_settings 
  ADD COLUMN IF NOT EXISTS meta_access_token text,
  ADD COLUMN IF NOT EXISTS meta_ad_account_id text;
```

No new table needed -- reuse the existing `app_settings` with an upsert pattern (`key = 'meta_config'`).

---

## 2. Edge Function: `fetch-meta-data`

**Changes:**
- Read `meta_access_token` and `meta_ad_account_id` from `app_settings` (key = `meta_config`) via Supabase service role client. Fall back to `META_ACCESS_TOKEN` env var and hardcoded account ID if not set in DB.
- Fetch Meta data in 30-day batches from `2025-09-01` to today to avoid timeout on large date ranges.
- Keep existing dedup + delete-then-insert logic.

---

## 3. Finance.tsx - Complete Rewrite

### Header Bar
- Settings gear icon opens a dialog to save Meta Access Token and Ad Account ID (upsert to `app_settings`).
- Multi-file upload inputs (`multiple` attribute) on both CSV buttons. Process files sequentially with `for...of` + `await`.
- Global Date Range Picker with presets: 7d, 14d, 30d, Sep 25-Now, Custom (using Calendar popover for custom range).

### Turns CSV Parser (Strict)
- Map exact headers: `Order Creation Date` -> date, `Order` -> order_ref, `Mobile` -> phone, `Amount` -> amount, `Qty` -> qty (new field stored for AOV calc).
- Strict date parser using monthMap (`Jan:01`, etc.) for `DD-Mon-YY` format -> `20YY-MM-DD`.
- Amount parser: `parseFloat(val.replace(/[^0-9.]/g, ''))`.
- Chunked deletions (50) by order_ref, chunked lead matching (50), chunked inserts (50).

### Meta CSV Parser (Strict)
- Force ID: `CSV-{formattedDate}-{amount}`.
- Defaults: `ad_name = 'Manual Meta CSV'`, reach/clicks/impressions/engagement = 0.
- Chunked idempotency: extract unique dates, delete in batches of 50 (`.in('date', chunk).eq('ad_name', 'Manual Meta CSV')`), insert in batches of 50.

### 4-Tab Layout

**Tab 1: Financial P&L** (existing, refined)
- P&L cards, Gross ROAS, MoM chart, Monthly Breakdown table (Month, Revenue, Ad Spend, ROAS, Net Profit).

**Tab 2: Ad Intel** (enhanced)
- Creative Rollup table with new columns: CPM (`(spend/impressions)*1000`), CAC (`spend/leads_count`), Frequency (`impressions/reach`).
- Checkbox column on each ad row for selecting ads to send to AI comparison.
- Pass selected ad rows to AI CFO tab.

**Tab 3: Operations** (NEW)
- AOV: Average Order Value (`total revenue / total orders`).
- Total Units Served: Sum of `qty` from turns_sales (requires adding `qty` column or parsing from CSV).
- Repeat Customer Rate: Count phones appearing more than once / total unique phones.
- Top Customers list: Group turns_sales by customer_name, sum amount, sort desc.

**Tab 4: AI CFO** (enhanced)
- Accept `selectedAds` prop from Tab 2 for head-to-head creative comparison.
- Pass selected ads data in the request body to `ai-auditor`.

---

## 4. Database: Add `qty` Column to `turns_sales`

```sql
ALTER TABLE turns_sales ADD COLUMN IF NOT EXISTS qty integer DEFAULT 1;
```

This enables AOV and Total Units Served calculations.

---

## 5. AI Auditor Edge Function

**Changes to system prompt:**
- Rewrite to focus on Unit Economics (AOV vs CAC).
- Accept optional `selectedAds` array for head-to-head comparison.
- New output format with 3 sections:
  - `### Unit Economics & Variance` (MoM drops/gains)
  - `### Creative & Market Insights` (why ads fail/win)
  - `### Capital Allocation` (specific budget shifts)
- Update model to `google/gemini-2.5-flash` (already set).

**Changes to AiAuditor.tsx:**
- Accept `selectedAds` prop.
- Show selected ads summary before generating.
- Parse new `###` headers (in addition to emoji headers).
- Pass selectedAds in request body.

---

## 6. AdsIntelligence.tsx Enhancements

- Add checkbox column with `selectedAdIds` state.
- Add CPM, CAC, Frequency columns to table.
- Expose `onSelectionChange` callback to parent (Finance.tsx).
- Lift selected state up to Finance.tsx via callback.

---

## Technical Details

### Files to Create/Modify:
1. **Migration SQL** - Add `qty` to `turns_sales`, add `meta_access_token`/`meta_ad_account_id` to `app_settings`
2. **`src/pages/Finance.tsx`** - Full rewrite with settings dialog, multi-file upload, strict parsers, 4 tabs, Operations tab, ad selection state
3. **`src/components/finance/AdsIntelligence.tsx`** - Add checkboxes, CPM/CAC/Frequency columns, selection callback
4. **`src/components/finance/AiAuditor.tsx`** - Accept selectedAds, updated UI, new section parsing
5. **`supabase/functions/fetch-meta-data/index.ts`** - Read token from DB, 30-day batch fetching
6. **`supabase/functions/ai-auditor/index.ts`** - New system prompt with Unit Economics focus, handle selectedAds

### Key Safeguards:
- All batch operations capped at 50 records to prevent 400 errors
- Sequential file processing (no Promise.all) to prevent race conditions
- Strict date parsing with monthMap (no Date.parse)
- Delete-then-insert pattern for idempotency
- Fallback to env vars if DB settings not configured

