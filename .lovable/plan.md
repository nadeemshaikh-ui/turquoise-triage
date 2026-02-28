

# Fix LeadDetail Broken UI Components

## Root Causes Found

### 1. Category Dropdown - Duplicate Values
The `service_categories` table has `Luxury Handbags`, `Leather Jackets`, `Sneakers`, `Accessories`. After mapping through `CATEGORY_NAME_MAP`, both "Luxury Handbags" AND "Leather Jackets" resolve to "Bag". This produces TWO SelectItems with displayName "Bag" in the dropdown. Radix Select can behave unpredictably with duplicate display labels pointing to different values. Fix: deduplicate `mappedCategories` so only one entry per display name survives.

### 2. Add Button Silent Failure
The `handleAddItem` function (line 311) looks correct but has no logging. The toast call uses the shadcn `toast()` function which returns an object -- if the toast system isn't rendering properly (e.g., `Toaster` component missing or shadcn toast conflicting with `sonner`), the user sees nothing. Fix: add `console.log` at the top of `handleAddItem` and inside the Category `onValueChange` for debugging, and also use `sonner` toast as a fallback.

### 3. Photo Broken Image
The `onError` fallback sets `src` to `/placeholder.svg` (line 704). If that file doesn't render correctly or the initial URL has encoding issues (file paths contain spaces like "Napa dori after.jpg"), the image shows broken. Fix: replace the `img` tag with a conditional render -- if `onError` fires, swap to a grey div placeholder instead of trying another image src.

### 4. Form Reset After Add
The `onSuccess` callback (lines 158-164) resets 4 fields but does NOT reset `manualPrice` if that state exists elsewhere or the `isAddingBrand` state. The reset logic itself looks correct, so the real issue is likely that the mutation never fires (related to issue #2). Once the add button works, reset should follow. Add `console.log` in `onSuccess` to confirm.

## Changes

### File: `src/pages/LeadDetail.tsx`

**A. Deduplicate mapped categories (lines 128-132)**
After mapping, filter to keep only one entry per display name (first match wins):

```text
const seen = new Set<string>();
const mappedCategories = (categoriesOptions || [])
  .map(c => ({ ...c, displayName: mapCategoryName(c.name) }))
  .filter(c => ["Bag","Shoe","Belt","Wallet"].includes(c.displayName))
  .filter(c => { if (seen.has(c.displayName)) return false; seen.add(c.displayName); return true; });
```

**B. Add console.log to Category Select onValueChange (line 557)**
Add `console.log("Category selected:", val)` inside the handler.

**C. Add console.log to handleAddItem (line 311)**
Add `console.log("handleAddItem called", { newBrandId, newCategoryId, newServiceType })` at the first line.

**D. Add console.log to addItemMutation onSuccess (line 158)**
Add `console.log("Item added successfully, resetting form")`.

**E. Fix photo rendering (lines 698-706)**
Replace the `img` with `onError` fallback approach. Use a local state pattern or a simpler inline approach: wrap each photo in a component that tracks error state and renders a grey box with a camera icon when the image fails to load.

Since we can't use per-item state easily in a `.map()`, use a small inline component:

```text
const PhotoThumb = ({ url, fileName }: { url: string; fileName: string }) => {
  const [failed, setFailed] = useState(false);
  if (failed || !url) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-muted">
        <Camera className="h-6 w-6 text-muted-foreground/50" />
      </div>
    );
  }
  return (
    <img src={url} alt={fileName} className="h-full w-full object-cover" loading="lazy"
      onError={() => setFailed(true)} />
  );
};
```

Replace the `<img>` tag in the photo grid with `<PhotoThumb url={p.url} fileName={p.fileName} />`.

**F. Ensure toast works by importing from sonner**
Currently uses `import { toast } from "@/hooks/use-toast"`. The project also has `sonner` installed. If the shadcn Toaster isn't mounted, toasts silently disappear. Add a `console.log` alongside every toast call in `handleAddItem` to guarantee visibility even if toasts fail.

## Database Migration
Add the 4 correct category rows and deactivate the old ones so the dropdown shows `Bag`, `Shoe`, `Belt`, `Wallet` directly without relying on the fragile name map:

```text
INSERT INTO service_categories (name, sort_order, is_active) VALUES
  ('Bag', 1, true), ('Shoe', 2, true), ('Belt', 3, true), ('Wallet', 4, true)
ON CONFLICT DO NOTHING;

UPDATE service_categories SET is_active = false
WHERE name IN ('Luxury Handbags','Sneakers','Leather Jackets','Accessories');
```

## Files Changed

| File | Change |
|------|--------|
| DB Migration | Insert Bag/Shoe/Belt/Wallet, deactivate legacy categories |
| `src/pages/LeadDetail.tsx` | Deduplicate categories, add console.logs, fix photo fallback with PhotoThumb component |

## Files NOT Changed
- `useLeadDetail.ts` -- no changes needed
- `OrderDetail.tsx`, `Portal.tsx` -- not touched
- No RPCs or edge functions modified

