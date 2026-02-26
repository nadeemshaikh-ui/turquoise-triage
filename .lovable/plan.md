

# Zenith D2C Command Center (V26) - Execution Plan

## Execution Order

### Step 1: Database Migration (FIRST)
Add `service_details` column to `turns_sales`:
```sql
ALTER TABLE turns_sales ADD COLUMN IF NOT EXISTS service_details text;
```

### Step 2: Finance.tsx - Major Rewrite

**CSV Parser Update (lines ~396-453)**
- Add `service_details` to header detection: `headers.findIndex(h => h.includes("order details") || h.includes("price list") || h.includes("item"))`
- Include `service_details` in parsed row type and insert payload

**5-Tab Layout (lines ~640-861)**
Expand from 4 tabs to 5: P&L | Creative | Operations | Cohorts | AI CFO

**Tab 1: P&L Enhancements**
- Add MER card (Marketing Efficiency Ratio = Revenue / Ad Spend) alongside existing ROAS card
- Add Contribution Margin card (Revenue - Ad Spend - COGS, already calculated as `realProfit`)
- Add "Deep Dive" button on each monthly breakdown row. Uses local `drilldownMonth` state to swap table for a daily Recharts LineChart (Revenue vs Spend line). "Back" button returns to table. No router changes.

**Tab 2: Creative Intel (rename from "Ad Intel")**
- Pass through to enhanced AdsIntelligence component (frequency alerts + horizontal funnel)

**Tab 3: Operations (Enhanced with Keyword Mining)**
- Keep existing AOV, Units, Repeat Rate, Top Customers cards
- Add keyword mining on `service_details` column:
  ```typescript
  const text = (row.service_details || '').toLowerCase();
  ```
  Categories: Sneaker (sneaker/shoe/trainer/nike/jordan/yeezy), Bag (bag/handbag/purse/clutch/tote), Leather (leather/hide/suede), Laundry (laundry/wash/dry clean)
- Add Pareto Chart: Recharts ComposedChart with Bar for order volume and Line for revenue per category
- Add Cannibalization Alert: If sneaker volume grows MoM while bag revenue drops, render warning Alert component

**Tab 4: Cohorts (NEW)**
- Churn list: Group `turns_sales` by phone, filter where last order > 45 days ago, show name/phone/last order/LTV
- Cohort Heatmap: Pure HTML/CSS grid. Y-axis = acquisition month (first order month per phone). X-axis = M0, M1, M2... Cell = revenue in that period. Color intensity via inline styles.
- Repeat Rate stat card (duplicated from Operations for context)

**Tab 5: AI CFO (Enhanced)**
- Pass new props: `mer`, `categoryData` (per-category volume/revenue), `churnCount`

**New state variables needed:**
- `drilldownMonth: string | null` for P&L deep dive

### Step 3: AdsIntelligence.tsx Enhancements

**Frequency Alert Icons (table rows, line ~349)**
- In the Freq column cell: show red circle emoji if `frequency > 2.0`, yellow circle if `frequency > 1.5`

**Horizontal Funnel (lines ~269-298)**
- Convert existing vertical card-based funnel to a horizontal Recharts BarChart with bars for Impressions, Clicks, Leads, Orders

### Step 4: AiAuditor.tsx Updates

**New Props:**
- Add `mer`, `categoryData`, `churnCount` to Props type
- Pass these in the request body to `ai-auditor` edge function

### Step 5: ai-auditor Edge Function

**System Prompt Update:**
- Change identity to "Elite Growth CFO for Restoree (Indian Luxury Restoration)"
- Add benchmarks: Sneakkinns, The Leather Laundry
- Add MER trend analysis and category cannibalization analysis
- Keep existing output format (3 markdown headers)

**New input handling:**
- Accept `mer`, `categoryData`, `churnCount` from request body
- Include in user prompt for AI analysis

### Step 6: fetch-meta-data Edge Function

**Restore Full Sync Logic:**
- Read token from `app_settings` where `key = 'meta_config'`, parse JSON value
- Fall back to `META_ACCESS_TOKEN` env var
- Fetch Meta Graph API `/insights` in 30-day date batches from 2025-09-01 to today
- Delete existing records per batch date range, then insert new data
- Return count of synced rows

---

## Files Modified

1. **Migration SQL** -- `ALTER TABLE turns_sales ADD COLUMN IF NOT EXISTS service_details text`
2. **`src/pages/Finance.tsx`** -- 5 tabs, service_details CSV extraction, keyword mining, P&L drilldown, Cohorts tab (churn + heatmap), pass new AI props
3. **`src/components/finance/AdsIntelligence.tsx`** -- Frequency alert icons, horizontal funnel BarChart
4. **`src/components/finance/AiAuditor.tsx`** -- Accept mer/categoryData/churnCount props
5. **`supabase/functions/ai-auditor/index.ts`** -- Updated system prompt with Restoree benchmarks, new input fields
6. **`supabase/functions/fetch-meta-data/index.ts`** -- Full Meta API 30-day batch sync logic

## Safeguards
- All batch operations: 50-record chunks
- Sequential file processing (for...of with await)
- Strict monthMap date parsing (no Date.parse)
- Delete-then-insert for idempotency
- Keyword mining on `service_details` only
- P&L drilldown via local state (no router changes)
- Cohort heatmap: pure HTML grid (no external deps)

