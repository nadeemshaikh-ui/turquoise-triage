

# Super-Admin Security and Role Management

## Overview
Expand the existing role system to support three tiers: `super_admin`, `admin`, and `staff`. Implement granular navigation visibility, route protection, and a Team management tab for super admins.

## Current State
- `user_roles` table exists with `app_role` enum (`admin`, `moderator`, `user`)
- `has_role()` security definer function exists
- `useUserRole` hook returns `roles` and `isAdmin`
- `AdminRoute` component guards admin-only routes
- `profiles` table already exists with `user_id`, `display_name`, `avatar_url`

---

## Phase 1: Database Migration

Add `super_admin` to the existing `app_role` enum and assign it to `nadeemshaikh@gmail.com`.

```text
Migration SQL:
1. ALTER TYPE app_role ADD VALUE 'super_admin'
2. Insert super_admin role for the user matching nadeemshaikh@gmail.com
   (lookup user_id from auth.users by email, insert into user_roles)
```

No new tables needed -- the existing `user_roles` + `profiles` tables are sufficient.

---

## Phase 2: Update `useUserRole` Hook

Extend the hook to expose granular role checks:

- `roles` -- array of role strings
- `isStaff` -- true if user has only staff role
- `isAdmin` -- true if user has admin or super_admin
- `isSuperAdmin` -- true if user has super_admin
- `isLoading`

File: `src/hooks/useUserRole.ts`

---

## Phase 3: Navigation Lockdown

Update `src/components/AppLayout.tsx` sidebar logic:

| Link | staff | admin | super_admin |
|------|-------|-------|-------------|
| Triage, Workshop, Customers | Yes | Yes | Yes |
| Recovery | Yes | Yes | Yes |
| Services | No | Yes | Yes |
| Admin Hub | No | Yes | Yes |
| Automations | No | Yes | Yes |
| Finance | No | No | Yes |

The `moreNav` array will conditionally include items based on `isAdmin` and `isSuperAdmin` from the updated hook.

---

## Phase 4: Route Protection (RoleGuard)

Replace the existing `AdminRoute` component with a more flexible `RoleGuard` that accepts a `requiredRole` prop (`admin` or `super_admin`).

- If the user lacks the required role, redirect to `/` and show an "Access Denied" toast notification.

Update `src/App.tsx` routes:
- `/admin-hub`, `/automations`, `/services` -- require `admin` (which includes super_admin)
- `/finance` -- require `super_admin` only

File changes:
- `src/components/AdminRoute.tsx` -- refactor to accept `requiredRole` prop
- `src/App.tsx` -- update route wrapping

---

## Phase 5: Team Management Tab

Add a "Team" tab inside Admin Hub (visible only to super_admin).

Features:
- List all users from `profiles` joined with `user_roles`
- Show each user's display name, email (from profile/auth), and current role
- Super admin can change any user's role via a dropdown (staff / admin)
- Super admin's own role is not editable (safety lock)

New file: `src/components/admin/TeamTab.tsx`
Modified file: `src/pages/AdminHub.tsx` -- add the Team tab, conditionally shown for super_admin

---

## Files Changed Summary

| File | Action |
|------|--------|
| Database migration | Add `super_admin` to `app_role` enum, assign role |
| `src/hooks/useUserRole.ts` | Add `isSuperAdmin` check |
| `src/components/AppLayout.tsx` | Granular nav visibility by role |
| `src/components/AdminRoute.tsx` | Accept `requiredRole` prop, add toast on deny |
| `src/App.tsx` | Finance wrapped with `super_admin` guard |
| `src/components/admin/TeamTab.tsx` | New -- user list with role dropdown |
| `src/pages/AdminHub.tsx` | Add Team tab for super_admin |

---

## Technical Notes

- The `app_role` enum is extended (not replaced) so existing `admin` and `staff` entries remain valid.
- `isSuperAdmin` checks for the `super_admin` role in the `user_roles` table via the existing `has_role()` security definer function -- no RLS recursion risk.
- The Team tab queries `profiles` (public schema) and `user_roles` to build the user list. Role updates go through `user_roles` which already has an admin-only RLS policy (`has_role(auth.uid(), 'admin')`). We will add a policy allowing `super_admin` to manage roles as well.
- Email lookup for the super_admin seed uses `auth.users` only inside the migration (server-side), never from the client.

