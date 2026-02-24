

# Automations Framework -- Central Nervous System for Restoree 360

## Overview

Rebuild the Automations page into a clean, iOS-style control center with toggle-based triggers, read-only WhatsApp template previews, and a live automation log. Three core triggers will be wired up: Elite Alert, Milestone Message, and Recovery Nudge.

---

## Database Changes

### New table: `automation_logs`

Stores every automation action for the live status log.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, auto-generated |
| trigger_type | text | `elite_alert`, `milestone_message`, `recovery_nudge` |
| lead_id | uuid | nullable, reference |
| message | text | Human-readable log line |
| created_at | timestamptz | default now() |

RLS: Authenticated users can SELECT. System (service role) can INSERT.

### New `app_settings` keys (seeded via insert)

| Key | Default | Purpose |
|-----|---------|---------|
| `trigger_elite_alert` | `"true"` | Toggle for Elite Alert |
| `trigger_milestone_triage_to_workshop` | `"true"` | Toggle for Triage-to-Workshop WhatsApp |
| `trigger_milestone_workshop_to_ready` | `"true"` | Toggle for Workshop-to-Ready WhatsApp |
| `trigger_recovery_nudge` | `"true"` | Toggle for 48h Recovery Nudge |

---

## Changes

### 1. Rewrite `src/pages/Automations.tsx`

Replace the current page with a clean, sectioned layout:

**Section A: Connection Status** (compact)
- Interakt API key input + Connected badge (keep existing logic, make it collapsible)

**Section B: Trigger Toggles** (main content)
- Three cards, each with an iOS-style Switch toggle:
  1. **The Elite Alert** -- "Notify when a customer accepts an Elite tier quote"
     - Toggle key: `trigger_elite_alert`
  2. **The Milestone Message** -- Two sub-toggles:
     - "WhatsApp on Triage to Workshop" (`trigger_milestone_triage_to_workshop`)
     - "WhatsApp on Workshop to Ready" (`trigger_milestone_workshop_to_ready`)
  3. **The Recovery Nudge** -- "Auto-flag leads for follow-up after 48h without quote acceptance"
     - Toggle key: `trigger_recovery_nudge`

Each toggle saves to `app_settings` using the existing `saveSetting` mutation pattern.

**Section C: Template Previews** (read-only)
- Collapsible accordion showing the 4 WhatsApp template texts:
  - `ready_for_pickup`: "Hi {name}, your {service} is ready for pickup!"
  - `order_confirmation`: "Hi {name}, your {service} has been received and work has begun."
  - `second_chance_offer`: "Hi {name}, we have a special {discount}% offer on your {service}."
  - `digital_quote`: "Hi {name}, your personalized quote for {service} is ready: {link}"
- Displayed in code-style blocks with variable placeholders highlighted

**Section D: Live Automation Log** (bottom)
- Query `automation_logs` ordered by `created_at DESC`, limit 20
- Each row shows: timestamp (relative, e.g. "2m ago"), icon by trigger type, message text
- Phone numbers masked: show last 4 digits only (e.g., "+91XXXX1234")
- Realtime subscription on `automation_logs` table for live updates

Move the Labor Cost setting to the Finance page or keep it as a collapsible "Finance Settings" at the very bottom.

### 2. Wire Elite Alert Trigger

**File: `src/pages/Quote.tsx`** (or the `serve-quote` edge function)

When a customer accepts the Elite tier (the `handleAccept("Elite")` flow already calls `serve-quote` with `action: "accept"`):

**File: `supabase/functions/serve-quote/index.ts`**
- After updating `accepted_tier` to "Elite", check `app_settings` for `trigger_elite_alert === "true"`
- If enabled, insert into `automation_logs`: `"Elite Alert: {customerName} accepted Elite for {serviceName} (₹{price})"`
- Insert into `lead_activity` as well for the lead's activity feed

This creates in-app notification visibility. The AlertBell component already reads `low_stock_alerts`; we can extend it or keep it separate via the automation log on the Automations page.

### 3. Wire Milestone Message Trigger

**File: `src/pages/Workshop.tsx`**

In the `updateStatus` mutation's `onSuccess`:
- When status changes FROM "New" TO "Assigned" or "In Progress" (Triage to Workshop):
  - Check `trigger_milestone_triage_to_workshop` setting
  - If enabled, call `send-whatsapp` with `template_type: "order_confirmation"`
  - Insert into `automation_logs`
- When status changes TO "Ready for Pickup" (Workshop to Ready):
  - Already sends WhatsApp via `showDeductionToast` -- just add the automation log entry
  - Check `trigger_milestone_workshop_to_ready` setting before sending

**File: `supabase/functions/send-whatsapp/index.ts`**
- Add support for `template_type: "order_confirmation"` with template name `order_confirmation` and body values `[customer_name, service_name]`

### 4. Wire Recovery Nudge Trigger

**File: `src/pages/Recovery.tsx`** (or a scheduled edge function)

For the initial implementation (no cron needed yet):
- When the Recovery page loads, check `trigger_recovery_nudge` setting
- If enabled, auto-flag leads that are 48h+ stale and have no existing `recovery_offers` record
- Insert into `automation_logs`: `"Recovery Nudge: Flagged {customerName} for follow-up ({hours}h stale)"`
- The existing Recovery page already shows these leads -- this just adds the logging/flagging

### 5. Update `serve-quote` Edge Function

Add Elite Alert logging after accept:

```typescript
if (tier === "Elite") {
  const { data: triggerSetting } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "trigger_elite_alert")
    .single();

  if (triggerSetting?.value === "true") {
    await supabase.from("automation_logs").insert({
      trigger_type: "elite_alert",
      lead_id: quoteRecord.lead_id,
      message: `Elite Alert: Customer accepted Elite tier for Lead #${quoteRecord.lead_id.slice(0,8)}`,
    });
  }
}
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/xxx_automation_logs.sql` | Create `automation_logs` table with RLS |

## Files to Modify

| File | Key Changes |
|------|-------------|
| `src/pages/Automations.tsx` | Full rewrite: trigger toggles, template previews, live log |
| `src/pages/Workshop.tsx` | Add milestone trigger checks + automation log inserts |
| `supabase/functions/serve-quote/index.ts` | Add Elite Alert logging on accept |
| `supabase/functions/send-whatsapp/index.ts` | Add `order_confirmation` template type |

---

## Technical Notes

- All trigger toggles use the existing `app_settings` table pattern (key-value upserts)
- `automation_logs` table uses Realtime (`ALTER PUBLICATION supabase_realtime ADD TABLE automation_logs`) for live updates on the Automations page
- No external cron jobs needed for V1 -- Recovery Nudge flags on page load; can be upgraded to a scheduled function later
- Template previews are hardcoded strings matching the Interakt template names already configured in `send-whatsapp`
- The Interakt API key and WhatsApp enabled toggle remain as the "Connection" section at the top

