

# Add Phone Normalization to Turns CSV Parser

## Problem
The `sanitizePhone` function in Finance.tsx only strips specific characters (`\s\-().+`) but not ALL non-numeric characters. The Turns CSV "Mobile" column may contain formats like `+91 98765 43210` or `91-9876543210` that need full normalization to match the Identity Guard database trigger (which strips to last 10 digits).

## Change

**File: `src/pages/Finance.tsx`** (line 30-33)

Update `sanitizePhone` to strip ALL non-numeric characters first, then extract last 10 digits — matching the exact logic used by the database trigger and `usePhoneLookup` hook:

```ts
const sanitizePhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
};
```

This is a single-line logic change. The function is already called at line 602 during CSV parsing, so no other wiring is needed.

## Files Changed

| File | Action |
|------|--------|
| `src/pages/Finance.tsx` | Update `sanitizePhone` to strip all non-digits and extract last 10 |

