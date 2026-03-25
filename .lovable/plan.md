

# Fix Turns CSV Parser for Correct Column Mapping

## Problem
The Turns CSV has specific column names (`Amount` with `₹` symbol, `Order Creation Date` in DD-MMM-YYYY format, `Order` as unique key, `Order Status` for filtering) that don't match the current parser's expectations, causing "No valid rows" errors.

## Changes

**File: `src/pages/Finance.tsx`** (lines ~533-596, the `handleTurnsCsvUpload` function)

### 1. Fix Column Mapping
Update `colIdx` detection to explicitly match Turns CSV headers:
- `date`: match `"order creation date"` (already partially there, but also needs to handle exact match)
- `amount`: match `"amount"` — strip `₹`, commas before parsing
- `order_ref`: match `"order"` exactly as unique key
- Add `status`: find column matching `"order status"` or `"status"`

### 2. Fix Amount Parsing (line ~586)
Current: `rawAmount.replace(/[^0-9.]/g, "")` — this already strips `₹` and commas. No change needed here, but add explicit `₹` stripping before the regex for safety.

### 3. Fix Date Parsing for DD-MMM-YYYY
Current parser already handles `DD-Mon-YY` via `monthMap`. For DD-MMM-YYYY (4-digit year like `01-Jan-2026`):
- The existing code at line 577 already handles this: `parts[2].length === 2 ? "20"+parts[2] : parts[2]`
- Ensure `monthMap` lookup works with 3-letter month abbreviations (it does: Jan, Feb, etc.)

### 4. Add Status Filter
After extracting cells, check `Order Status` column. Only process rows where status (case-insensitive) is `"delivered"` or `"new order"`. Skip all other rows.

### 5. Add Error Logging
When a row fails (bad date, zero amount, wrong status), log the specific reason to console and collect error details. After processing, if there were skipped rows, show a detailed toast with the count and first few error reasons.

### Implementation Detail

```
// New colIdx entry:
status: headers.findIndex((h) => h.includes("order status") || h === "status"),

// In the row loop, after extracting cells:
const rawStatus = colIdx.status >= 0 ? (cells[colIdx.status] || "").trim().toLowerCase() : "";
if (colIdx.status >= 0 && rawStatus !== "delivered" && rawStatus !== "new order") {
  errors.push(`Row ${i}: Skipped status "${rawStatus}"`);
  continue;
}

// After the loop, log errors:
if (errors.length > 0) {
  console.warn(`Turns CSV errors for ${file.name}:`, errors);
  toast({ title: `⚠️ ${errors.length} rows skipped`, description: errors.slice(0, 3).join("; ") });
}
```

## Files Changed

| File | Action |
|------|--------|
| `src/pages/Finance.tsx` | Update `handleTurnsCsvUpload` — add status column detection, status filter, error logging with reasons |

