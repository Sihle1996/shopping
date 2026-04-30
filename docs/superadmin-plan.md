# SuperAdmin Dashboard — Design Plan

## Context

The backend is **fully implemented**: all superadmin endpoints exist under `/api/superadmin/*`, the `ROLE_SUPERADMIN` user role exists, approval workflow is wired, subscription tiers are structured, and commission rates are per-tenant. The entire gap is a **frontend**.

A regular admin sees their own store. The SuperAdmin sees **every store on the platform** — the full operator view for the platform owner.

---

## What SuperAdmin Needs

| Area | Status |
|---|---|
| Platform-wide analytics (GMV, orders, active stores) | Backend ✅ — no UI |
| Enrollment review queue (approve / reject stores) | Backend ✅ — no UI |
| Tenant list + management (suspend, extend trial, change plan) | Backend ✅ — no UI |
| Subscription plan overview (who's on what, who's expiring) | Backend ✅ — no UI |
| Commission management (per-tenant override) | Backend ✅ — no UI |
| Payout audit (approve / reject driver payouts) | Backend ✅ — no UI |
| AI cross-tenant insights | Not built — new |
| Global announcements / notices | Not built — new |

---

## Architecture

SuperAdmin gets its own Angular module (`SuperAdminModule`) with its own routing, guard, and layout. It lives at `/superadmin/*` — completely separate from the regular `/admin/*` pages.

```
Frontend
└── src/app/superadmin/
    ├── superadmin.module.ts
    ├── superadmin-routing.module.ts
    ├── layout/superadmin-layout.component.*       ← sidebar + header
    ├── dashboard/dashboard.component.*            ← platform stats overview
    ├── tenants/
    │   ├── tenant-list.component.*               ← all stores, filters, actions
    │   └── tenant-detail.component.*             ← single store deep-dive
    ├── enrollment/
    │   ├── enrollment-queue.component.*           ← pending review list
    │   └── enrollment-review.component.*          ← approve / reject with docs
    ├── subscriptions/subscription-overview.component.*  ← plan health, expiries
    ├── payouts/payout-audit.component.*           ← approve / reject payouts
    ├── ai-insights/ai-insights.component.*        ← cross-tenant AI panel
    └── guards/superadmin.guard.ts                 ← blocks non-SUPERADMIN users
```

---

## Page-by-Page Spec

---

### 1. Dashboard — Platform Overview

**Route:** `/superadmin`

**Stats cards (top row):**
- Total active stores
- Total orders today / this week / this month
- Platform GMV this month (sum of all tenant revenue)
- Pending enrollment reviews (badge — urgent if > 0)
- Stores in trial expiring within 7 days (warning badge)

**Charts (middle):**
- Orders per day (last 30 days, all tenants combined) — line chart
- Revenue by subscription plan — donut chart (BASIC / STANDARD / PREMIUM)
- Top 5 stores by GMV this month — horizontal bar chart

**Activity feed (right rail):**
- Recent events: "Nando's Sandton submitted for review", "Burger King suspended", "5 new stores registered this week"

**Data source:** `GET /api/superadmin/stats` (already returns tenantCount, orderCount, totalRevenue, planBreakdown, trialExpiryForecast)

---

### 2. Tenant List

**Route:** `/superadmin/tenants`

**Table columns:** Store name | Plan | Status | Commission % | Orders (30d) | GMV (30d) | Registered | Actions

**Filters:** Search by name/slug | Filter by plan | Filter by status (TRIAL / ACTIVE / SUSPENDED) | Filter by approval status

**Row actions (dropdown):**
- View detail
- Suspend / Reactivate (`PATCH /toggle-active`)
- Change subscription plan (`PATCH /subscription`)
- Extend trial by 30 days (`PATCH /extend-trial`)
- Override commission rate (inline edit)
- Archive

**Bulk actions:** Suspend selected | Export CSV

---

### 3. Tenant Detail

**Route:** `/superadmin/tenants/:id`

**Sections:**
- Store info (name, slug, address, cuisine, contact)
- Subscription card (plan, status, billing period end, commission %)
- Enrollment documents (CIPC, COA, bank details, photos — read-only)
- Order stats (total orders, GMV, avg order value, return customer rate)
- Menu health (item count, items with no tags, items out of stock)
- Active promotions list
- Recent orders table
- Users / team members

**Actions panel (right rail):**
- Change plan (dropdown + save)
- Adjust commission % (number input + save)
- Suspend / reactivate
- Extend trial
- Send message to admin (→ Feature 4: Global Announcements)

---

### 4. Enrollment Queue

**Route:** `/superadmin/enrollment`

**Two tabs:** Pending Review | Rejected

**Pending card layout:**
- Store name + submission date
- Documents: CIPC certificate, COA, bank letter, storefront photo (inline preview)
- Business details: CIPC number, bank name, account number, branch code
- Menu preview: categories + item count
- Location + delivery radius on a small map

**Actions:**
- ✅ Approve — sets `approvalStatus = APPROVED`, activates tenant, sends welcome email
- ❌ Reject — modal asking for reason → sets `approvalStatus = REJECTED`, sends rejection email with reason
- 📋 Archive — removes from queue

**Data source:** `GET /api/superadmin/enrollment/pending` and `/rejected`

---

### 5. Subscription Overview

**Route:** `/superadmin/subscriptions`

**Three sections:**

*Plan health cards:*
- BASIC: N stores, Rx/month platform revenue
- STANDARD: N stores, Rx/month
- PREMIUM: N stores, Rx/month

*Expiry watchlist (table):*
- Stores whose trial or billing period ends within 14 days
- Columns: Store | Plan | Expiry date | Days left | Action (extend / contact)

*Recent changes (feed):*
- "The Grillhouse upgraded BASIC → STANDARD"
- "Kauai's trial expired — now SUSPENDED"

---

### 6. Payout Audit

**Route:** `/superadmin/payouts`

**Existing payout flow:** Drivers request payouts → SuperAdmin reviews → approve/reject

**Table columns:** Driver name | Store | Amount | Requested | Status | Action

**Row actions:** Approve | Reject (with reason) | View order breakdown

**Data source:** existing `PayoutController` superadmin endpoints

---

### 7. AI Insights (New)

**Route:** `/superadmin/ai-insights`

Uses the same `AdminAiService` from the admin AI plan, but with **cross-tenant data**.

**Three panels:**

*Trending across the platform:*
"Smash Burgers are up 34% platform-wide this week. 8 stores carry them."
Powered by: aggregate order item counts → Claude summarises trends in 2 sentences.

*Underperforming stores alert:*
"3 stores have had zero orders in the last 7 days — they may need menu or pricing help."
Powered by: query stores WHERE order_count_7d = 0 → Claude formats the recommendation.

*Platform health summary (weekly):*
- Total new stores registered
- Approval rate (approved / submitted)
- Churn signal (stores that suspended this week)
- Platform GMV trend vs last week

**Data source:** `POST /api/superadmin/ai/platform-insights` (new endpoint wrapping `AdminAiService`)

---

### 8. Global Announcements (New)

**Route:** `/superadmin/announcements`

SuperAdmin broadcasts a message to all admins or a specific subset (e.g., "TRIAL stores only"). Shown as a banner in the admin dashboard on next login.

**Create form:** Title | Message | Target (ALL / PLAN:BASIC / STATUS:TRIAL) | Active from / to

**Data source:**
- New table: `platform_announcements` (Flyway V28)
- New endpoint: `POST /api/superadmin/announcements`
- Admin dashboard polls `GET /api/admin/announcements/active` on load

---

## New Backend Needed

| Item | Detail |
|---|---|
| `V28__platform_announcements.sql` | `id, title, body, target_filter, active_from, active_to, created_at` |
| `PlatformAnnouncement.java` | Entity + repository |
| `SuperAdminAnnouncementController.java` | CRUD for announcements |
| `AdminAnnouncementController.java` | `GET /api/admin/announcements/active` for tenant admins |
| `POST /api/superadmin/ai/platform-insights` | Cross-tenant AI summary (reuse `AdminAiService`) |

Everything else (`/superadmin/tenants/*`, `/superadmin/enrollment/*`, `/superadmin/stats`, `/superadmin/payouts/*`) already exists.

---

## New Frontend Needed

| File | Notes |
|---|---|
| `superadmin.module.ts` | Lazy-loaded at `/superadmin` |
| `superadmin-routing.module.ts` | Route definitions |
| `superadmin-layout.component.*` | Sidebar: Dashboard, Tenants, Enrollment, Subscriptions, Payouts, AI Insights, Announcements |
| `dashboard.component.*` | Stats cards + charts (reuse `ng-apexcharts` already in project) |
| `tenant-list.component.*` | Table with filters + bulk actions |
| `tenant-detail.component.*` | Deep-dive single store |
| `enrollment-queue.component.*` | Approve/reject workflow |
| `enrollment-review.component.*` | Document viewer + decision form |
| `subscription-overview.component.*` | Plan health + expiry watchlist |
| `payout-audit.component.*` | Driver payout approval |
| `ai-insights.component.*` | Cross-tenant AI summaries |
| `announcements.component.*` | Broadcast message editor |
| `superadmin.guard.ts` | Blocks anyone without `ROLE_SUPERADMIN` |
| `superadmin-api.service.ts` | HTTP service wrapping all `/api/superadmin/*` calls |

---

## Routing

```typescript
// In app-routing.module.ts
{
  path: 'superadmin',
  loadChildren: () => import('./superadmin/superadmin.module').then(m => m.SuperAdminModule),
  canActivate: [SuperAdminGuard]
}
```

SuperAdminGuard checks `authService.getUserRole() === 'ROLE_SUPERADMIN'`, redirects to `/login` otherwise.

---

## Phased Delivery

### Sprint 1 (3 days) — Core management
1. `SuperAdminModule` scaffold + layout + routing + guard
2. Dashboard page (platform stats from existing `/api/superadmin/stats`)
3. Tenant list page (list + suspend/reactivate + plan change)
4. Enrollment queue (approve/reject workflow — highest business value)

### Sprint 2 (2 days) — Financial oversight
5. Subscription overview page (expiry watchlist)
6. Payout audit page
7. Tenant detail page

### Sprint 3 (2 days) — Intelligence + comms
8. AI Insights page
9. Global announcements (V28 migration + new endpoints + UI)

---

## Design Notes

- Use the same Tailwind tokens as the existing admin (primary, textDark, surface, borderColor, shadow-card) — no new design system
- `ng-apexcharts` is already installed — use it for Dashboard charts
- Tables: follow the pattern used in `admin-orders` page (same pagination + filter components)
- Sidebar: similar structure to existing `admin-dashboard` module sidebar
