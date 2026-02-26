

# V27: Exports, WhatsApp CRM, DateRangePicker & Dual-Axis Drilldown

## Overview
Four changes to `src/pages/Finance.tsx` only. No database migrations, no edge function changes needed.

---

## 1. Add `downloadCSV` Helper + 3 Export Buttons

Add a reusable helper near the top of the component (after state declarations):

```typescript
const downloadCSV = (data: Record<string, any>[], filename: string) => {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(","),
    ...data.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(","))
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};
```

**Export buttons added to:**
- **P&L tab** (Monthly Breakdown card header): Exports `momChartData` as `Month, Revenue, Spend, ROAS, Profit`
- **Creative tab** (above AdsIntelligence): Exports `adStatsForAi` as `Ad Name, Spend, Clicks, CTR, CPC`
- **Churn list** (card header): Exports `churnData` as `Name, Phone, Last Order, LTV`

---

## 2. WhatsApp "Message Now" Button in Churn Table

Add a 5th column to the churn table. Each row gets a "Message Now" button that opens WhatsApp:

```typescript
const getWhatsAppUrl = (name: string, phone: string) => {
  const tenDigits = phone.replace(/\D/g, "").slice(-10);
  const message = `Hi ${name}, we missed you at Restoree! Here is a special 15% discount for your next sneaker or bag restoration.`;
  return `https://wa.me/91${tenDigits}?text=${encodeURIComponent(message)}`;
};
```

The churn table gets a 5th `<th>` ("Action") and each row gets:
```html
<a href={getWhatsAppUrl(c.name, c.phone)} target="_blank" rel="noopener noreferrer">
  <Button variant="ghost" size="sm">Message Now</Button>
</a>
```

Update the empty-state `colSpan` from 4 to 5.

---

## 3. Replace Date Presets with DateRangePicker

**New imports**: `Calendar` from `@/components/ui/calendar`, `Popover/PopoverTrigger/PopoverContent` from `@/components/ui/popover`, `format` from `date-fns`, `DateRange` from `react-day-picker`, `CalendarIcon` from `lucide-react`.

**State change**: Replace `datePreset` state with:
```typescript
const [calendarRange, setCalendarRange] = useState<DateRange | undefined>({
  from: new Date("2025-09-01"),
  to: new Date(),
});
```

**Crash-safe `dateRange` memo**:
```typescript
const dateRange = useMemo(() => {
  const from = calendarRange?.from;
  const to = calendarRange?.to;
  return {
    start: from ? fnsFormat(from, "yyyy-MM-dd") : "2025-09-01",
    end: to ? fnsFormat(to, "yyyy-MM-dd") : fnsFormat(new Date(), "yyyy-MM-dd"),
  };
}, [calendarRange]);
```

If `from` or `to` is undefined, defaults to "All Time" range. The `isInRange` function continues to work unchanged since it only reads `dateRange.start` and `dateRange.end` which are always valid strings.

**UI replacement**: The preset button bar (lines 691-708) is replaced with:
- A `Popover` containing a `Calendar mode="range"` with `pointer-events-auto` class
- The trigger button shows the formatted date range
- Quick preset buttons (7d, 30d, All) kept alongside for convenience, each setting `calendarRange` directly

Remove the `DatePreset` type and `datePreset` state.

---

## 4. Dual-Axis ComposedChart for P&L Drilldown

Replace the `LineChart` drilldown (lines 900-909) with a `ComposedChart` using dual Y-axes:

```tsx
<ComposedChart data={drilldownDailyData}>
  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 88%)" />
  <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="hsl(215, 15%, 55%)" interval="preserveStartEnd" />
  <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 10 }} stroke="hsl(215, 15%, 55%)" />
  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="hsl(215, 15%, 55%)" />
  <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [`₹${value.toLocaleString("en-IN")}`, name === "revenue" ? "Revenue" : "Ad Spend"]} />
  <Bar yAxisId="left" dataKey="revenue" fill="hsl(170, 50%, 55%)" radius={[8, 8, 0, 0]} name="revenue" />
  <Line yAxisId="right" type="monotone" dataKey="spend" stroke="hsl(0, 70%, 60%)" strokeWidth={2} dot={false} name="spend" />
</ComposedChart>
```

Revenue renders as bars on the left axis, Ad Spend as a line on the right axis -- independent scales prevent flatline rendering.

All required Recharts imports (`ComposedChart`, `Bar`, `Line`, `CartesianGrid`, `XAxis`, `YAxis`, `Tooltip`) are already present at line 23-24.

---

## Files Modified

1. **`src/pages/Finance.tsx`** -- All 4 changes: `downloadCSV` helper + 3 export buttons, WhatsApp "Message Now" button, DateRangePicker replacing presets, dual-axis drilldown chart

No other files need changes. No database migrations. No edge function updates.

## Crash Prevention Summary

- `calendarRange?.from` and `?.to` are always guarded with fallbacks in the `dateRange` memo
- `isInRange()` always receives valid `start`/`end` strings
- No `undefined.toISOString()` or similar crashes possible
- Calendar uses `pointer-events-auto` for popover interactivity

