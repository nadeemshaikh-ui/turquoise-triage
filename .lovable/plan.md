

## Duplicate Protection for All Uploads

### Problem
Repeated CSV uploads create duplicate rows in `turns_sales` and `meta_ad_spend` tables because there are no unique constraints, and the insert/upsert calls don't specify conflict resolution keys.

### Upload Points Analyzed

| Upload | Table | Current Dedup | Status |
|--------|-------|--------------|--------|
| Turns CSV | `turns_sales` | `.upsert()` without `onConflict` — no effect | Broken |
| Meta Ad CSV | `meta_ad_spend` | `.insert()` — no dedup at all | Broken |
| Meta Live Sync | `meta_ad_spend` | Deletes date range first, then inserts | Already works |
| Data Migration | `customers` | Manual phone lookup before insert/update | Already works |

### Plan

**1. Database Migration — Add Unique Constraints**

Add two unique indexes:

```text
turns_sales:     UNIQUE(date, order_ref, amount)
meta_ad_spend:   UNIQUE(date, campaign_name, ad_name, amount_spent)
```

These use `COALESCE` to handle nullable `order_ref`/`ad_name`/`campaign_name` columns so NULLs don't bypass the constraint.

**2. Turns CSV Upload (`Finance.tsx` — `handleTurnsCsvUpload`)**

Change the existing `.upsert(upsertRows)` call to:

```text
.upsert(upsertRows, { onConflict: "date,order_ref,amount" })
```

This ensures re-uploading the same CSV updates existing rows instead of creating duplicates. Rows with the same date + order ref + amount are treated as the same transaction.

**3. Meta Ad CSV Upload (`Finance.tsx` — `handleAdCsvUpload`)**

Change `.insert(insertRows)` to:

```text
.upsert(insertRows, { onConflict: "date,campaign_name,ad_name,amount_spent" })
```

Same logic — re-uploading the same Meta CSV will overwrite instead of duplicate.

**4. Set default values for nullable columns used in constraints**

Update `order_ref` default to empty string in the upsert row construction so the unique index works consistently (NULLs are never equal in SQL unique constraints, so the index uses `COALESCE`).

### Files Changed

- `supabase/migrations/` — new migration with two unique indexes
- `src/pages/Finance.tsx` — two lines changed (upsert with onConflict in both handlers)

