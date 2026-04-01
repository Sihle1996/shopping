# Subscription System — Implementation Plan

## What We're Building

Making subscriptions real. Right now every store admin has access to every feature
regardless of plan. Nothing is enforced. Trials never expire. Store admins have no
visibility into their subscription. This plan fixes all of that.

---

## The Plan Tiers (what each plan unlocks)

| Feature                        | BASIC (R299) | PRO (R699) | ENTERPRISE (R1499) |
|--------------------------------|:------------:|:----------:|:------------------:|
| Menu items                     | 30           | 100        | Unlimited          |
| Drivers                        | 3            | 10         | Unlimited          |
| Active promotions              | 3            | 20         | Unlimited          |
| Analytics (charts, trends)     | ❌ stats only | ✅         | ✅                 |
| Custom branding (logo + color) | ❌            | ✅         | ✅                 |
| Inventory CSV export + audit   | ❌            | ✅         | ✅                 |
| Max delivery radius            | 10 km        | 25 km      | 50 km              |
| Platform commission            | 4%           | 3%         | 2%                 |

---

## Implementation Steps (in order)

### STEP 1 — Expand the database (C# Program.cs)
**File:** `SuperAdmin/backend/SuperAdmin.API/Program.cs`

Add 6 new columns to `subscription_plans` table (idempotent SQL):
- `max_promotions` (int, default 3)
- `max_delivery_radius_km` (int, default 10)
- `has_analytics` (boolean, default false)
- `has_custom_branding` (boolean, default false)
- `has_inventory_export` (boolean, default false)
- `commission_percent` (decimal, default 4.00)

Add `trial_started_at` column to `tenants` table.

Backfill existing TRIAL tenants: `trial_started_at = created_at`.

Seed the new columns into BASIC, PRO, ENTERPRISE plans.

---

### STEP 2 — Update C# models and DTOs
**Files:**
- `SuperAdmin/backend/SuperAdmin.API/Models/SubscriptionPlan.cs` — add 6 new properties
- `SuperAdmin/backend/SuperAdmin.API/Models/Tenant.cs` — add `TrialStartedAt`
- `SuperAdmin/backend/SuperAdmin.API/DTOs/SubscriptionDtos.cs` — add new fields to `SubscriptionPlanDto` and `CreateUpdatePlanRequest`
- `SuperAdmin/backend/SuperAdmin.API/DTOs/TenantDtos.cs` — add `TrialStartedAt` and `TrialDaysRemaining` to `TenantDto`
- `SuperAdmin/backend/SuperAdmin.API/Controllers/SubscriptionsController.cs` — update plan create/update to handle new fields + validation
- `SuperAdmin/backend/SuperAdmin.API/Controllers/StoresController.cs` — compute `trialDaysRemaining` in store listing projection

---

### STEP 3 — Update React SuperAdmin frontend (types + plan form)
**Files:**
- `SuperAdmin/frontend/src/types/index.ts` — add new fields to `SubscriptionPlanDto` and `TenantDto`
- `SuperAdmin/frontend/src/pages/Subscriptions/Subscriptions.tsx` — add new fields to plan create/edit form:
  - Checkboxes: hasAnalytics, hasCustomBranding, hasInventoryExport
  - Number inputs: maxPromotions, maxDeliveryRadiusKm, commissionPercent

---

### STEP 4 — Spring Boot: SubscriptionPlan entity + enforcement infrastructure
**New files:**
- `Backend/.../entity/SubscriptionPlan.java` — maps existing `subscription_plans` table with all columns
- `Backend/.../repository/SubscriptionPlanRepository.java` — `findByName(String name)`
- `Backend/.../exception/PlanLimitExceededException.java` — HTTP 402
- `Backend/.../exception/PlanFeatureNotAvailableException.java` — HTTP 403
- `Backend/.../service/SubscriptionEnforcementService.java` — all checks in one place

**SubscriptionEnforcementService methods:**
```
assertMenuItemLimit(tenantId)       → 402 if count >= maxMenuItems
assertDriverLimit(tenantId)         → 402 if count >= maxDrivers
assertPromotionLimit(tenantId)      → 402 if active promos >= maxPromotions
assertAnalyticsAccess(tenantId)     → 403 if !hasAnalytics
assertCustomBrandingAccess(tenantId)→ 403 if !hasCustomBranding
assertInventoryExportAccess(tenantId)→ 403 if !hasInventoryExport
```

**Modify existing files:**
- `GlobalExceptionHandler.java` — add 402 handler for PlanLimitExceededException
                                 — add 403 handler for PlanFeatureNotAvailableException
- `MenuItemRepository.java` — add `long countByTenant_Id(UUID tenantId)`
- `UserRepository.java` — add `long countByRoleAndTenant_Id(Role role, UUID tenantId)` (already exists, verify)
- Find and update `PromotionRepository.java` — add `long countByTenant_IdAndActiveTrue(UUID tenantId)`

---

### STEP 5 — Wire enforcement into existing Spring Boot services/controllers
**Files to modify:**
- `MenuService.java` — call `assertMenuItemLimit(tenantId)` inside `saveMenuItem()` before save
- `AdminDriverService.java` — call `assertDriverLimit(tenantId)` inside `createDriver()` before save
- `AdminPromotionController.java` (or service) — call `assertPromotionLimit(tenantId)` before creating a promotion
- `AnalyticsController.java` — call `assertAnalyticsAccess(tenantId)` at start of each analytics endpoint
- `AdminSettingsController.java` — call `assertCustomBrandingAccess(tenantId)` when logoUrl or primaryColor is being updated
- Inventory controller/service — call `assertInventoryExportAccess(tenantId)` on export + audit log endpoints

---

### STEP 6 — Trial expiry: Spring Boot scheduled job
**Files to modify/create:**
- `Tenant.java` — add `LocalDateTime trialStartedAt`
- `TenantController.java` — set `trialStartedAt = now()` in `registerTenant()`
- `ApplicationConfig.java` — add `@EnableScheduling`
- `TenantRepository.java` — add two queries:
  - `findTrialTenantsStartedBefore(LocalDateTime cutoff)` — JPQL
  - `findBySubscriptionStatusAndTrialStartedAtBetween(String status, LocalDateTime from, LocalDateTime to)` — derived
- **New: `TrialExpiryService.java`** — runs daily at 08:00 UTC:
  - Day 14+: set status = SUSPENDED, send expiry email via EmailService
  - Day 10: send warning email "4 days left on your trial"

---

### STEP 7 — Suspended store handling + AdminSubscriptionController
**Files to modify/create:**
- `TenantController.java` — exclude SUSPENDED stores from `/api/tenants/nearby` results
- **New: `AdminSubscriptionController.java`** — two endpoints:
  - `GET /api/admin/subscription` — returns plan, status, trial countdown, usage, features
  - `POST /api/admin/subscription/upgrade-request` — sends email to support

---

### STEP 8 — Angular: Subscription panel component
**New files:**
- `Frontend/.../admin/admin-subscription/admin-subscription.component.ts`
- `Frontend/.../admin/admin-subscription/admin-subscription.component.html`
- `Frontend/.../services/subscription.service.ts` — fetches subscription status, exposes `canAccess(feature)`

**UI layout for admin-subscription page:**
1. Plan name badge + status badge (TRIAL/ACTIVE/SUSPENDED)
2. Amber alert if TRIAL: "X days remaining on your trial"
3. Red alert if SUSPENDED: "Your trial has ended — contact us to reactivate"
4. Usage progress bars (turns red at ≥90%):
   - Menu Items: 12 / 30
   - Drivers: 1 / 3
   - Active Promotions: 2 / 3
5. Feature access table:
   - Analytics ✓/✗
   - Custom Branding ✓/✗
   - Inventory Export ✓/✗
   - Max Delivery Radius: 10 km
   - Commission Rate: 4%
6. "Request Upgrade" button → POST upgrade-request → shows "We'll be in touch!"

**Wire into module/routing:**
- `admin-dashboard.module.ts` — declare AdminSubscriptionComponent
- `admin-routing.module.ts` — add `{ path: 'subscription', component: AdminSubscriptionComponent }`
- `admin-footer.component.ts` — add nav item "Plan" with `bi-credit-card-2-front` icon

---

### STEP 9 — Angular: Guards + 403 handling
**Files to modify:**
- `admin.guard.ts` — after role check, if subscription status = SUSPENDED, redirect to `/admin/subscription`
- `admin-dashboard.component.ts` — if analytics API returns 403, show "This feature requires PRO or higher" card with link to /admin/subscription
- `admin-promotions.component.ts` — same 403 handling on create
- `inventory-management.component.ts` — same 403 handling on export/audit

---

### STEP 10 — SuperAdmin: Subscription health dashboard
**C# new endpoint:**
`GET /api/dashboard/subscription-health` in `DashboardController.cs`:
```json
{
  "expiringTrials": [{ "name", "slug", "email", "daysRemaining" }],
  "monthlyRevenueForecast": 14970.00,
  "planDistribution": [{ "plan": "BASIC", "count": 8 }]
}
```

**React files:**
- `SuperAdmin/frontend/src/services/dashboard.service.ts` — add `getSubscriptionHealth()`
- `SuperAdmin/frontend/src/types/index.ts` — add `SubscriptionHealthDto`
- `SuperAdmin/frontend/src/pages/Subscriptions/Subscriptions.tsx` — add health section below plan grid:
  - Panel A: Expiring trials list (name + amber "Xd left" badge)
  - Panel B: Monthly revenue forecast stat card ("R14,970 / mo")
  - Panel C: Plan distribution bar chart (Recharts BarChart, already installed)

---

## Files Changed Summary

### C# Backend (10 files)
| File | Change |
|------|--------|
| `Program.cs` | Add DDL SQL for new columns + backfill |
| `Models/SubscriptionPlan.cs` | Add 6 new properties |
| `Models/Tenant.cs` | Add TrialStartedAt |
| `DTOs/SubscriptionDtos.cs` | Add new fields to SubscriptionPlanDto + CreateUpdatePlanRequest |
| `DTOs/TenantDtos.cs` | Add TrialStartedAt + TrialDaysRemaining to TenantDto |
| `Controllers/SubscriptionsController.cs` | Handle new fields in create/update |
| `Controllers/StoresController.cs` | Compute trialDaysRemaining in projection |
| `Controllers/DashboardController.cs` | Add subscription-health endpoint |

### Spring Boot (14 files)
| File | Change |
|------|--------|
| `entity/SubscriptionPlan.java` | NEW — maps subscription_plans table |
| `repository/SubscriptionPlanRepository.java` | NEW |
| `exception/PlanLimitExceededException.java` | NEW |
| `exception/PlanFeatureNotAvailableException.java` | NEW |
| `service/SubscriptionEnforcementService.java` | NEW |
| `service/TrialExpiryService.java` | NEW — scheduled job |
| `controller/AdminSubscriptionController.java` | NEW |
| `entity/Tenant.java` | Add trialStartedAt |
| `controller/TenantController.java` | Set trialStartedAt on register; exclude SUSPENDED from nearby |
| `config/ApplicationConfig.java` | Add @EnableScheduling |
| `config/GlobalExceptionHandler.java` | Add 402 + 403 handlers |
| `repository/TenantRepository.java` | Add 2 trial queries |
| `service/MenuService.java` | Call assertMenuItemLimit |
| `service/AdminDriverService.java` | Call assertDriverLimit |

### Angular (9 files)
| File | Change |
|------|--------|
| `admin-subscription/admin-subscription.component.ts` | NEW |
| `admin-subscription/admin-subscription.component.html` | NEW |
| `services/subscription.service.ts` | NEW |
| `admin-dashboard.module.ts` | Declare new component |
| `admin-routing.module.ts` | Add /subscription route |
| `admin-footer.component.ts` | Add Plan nav item |
| `guards/admin.guard.ts` | Add suspended redirect |
| `admin-dashboard.component.ts` | 403 handling |
| `admin-promotions.component.ts` | 403 handling + limit enforcement call |

### React SuperAdmin (3 files)
| File | Change |
|------|--------|
| `types/index.ts` | Add new fields to SubscriptionPlanDto + TenantDto |
| `services/dashboard.service.ts` | Add getSubscriptionHealth() |
| `pages/Subscriptions/Subscriptions.tsx` | New plan fields in form + health section |

---

## Verification Checklist

- [ ] BASIC store adds 31st menu item → 402 "Menu item limit reached (30/30 on BASIC plan)"
- [ ] BASIC store adds 4th driver → 402 "Driver limit reached (3/3 on BASIC plan)"
- [ ] BASIC store creates 4th active promo → 402 "Promotion limit reached (3/3 on BASIC plan)"
- [ ] BASIC store hits analytics endpoint → 403 "Upgrade your plan to access analytics"
- [ ] BASIC store uploads logo → 403 "Custom branding requires PRO or higher"
- [ ] BASIC store exports inventory CSV → 403 "Inventory export requires PRO or higher"
- [ ] SuperAdmin upgrades to PRO → all PRO features immediately accessible
- [ ] New store registers → trial_started_at saved
- [ ] Day 10 → warning email fires
- [ ] Day 14 → status = SUSPENDED + suspension email fires
- [ ] Suspended store absent from customer nearby search
- [ ] Suspended store admin → redirected to /admin/subscription on login
- [ ] /admin/subscription shows plan, status, countdown, 3 usage bars, feature table, upgrade CTA
- [ ] "Request Upgrade" button → support email received
- [ ] SuperAdmin Subscriptions page → expiring trials, R forecast, plan distribution chart

---

---

# Phase 2 — Core Product Gaps

These are features discovered during audit that are missing from the platform entirely.
To be implemented after the subscription system is complete.

---

## Priority 1 — High Impact

### F1 — Commission Deduction (Small effort, critical for business model)
**Problem:** `platformCommissionPercent` is stored on every tenant but never used.
**Fix:** In `OrderService.java`, when calculating `totalAmount`, compute and store `platformFee = totalAmount * (tenant.platformCommissionPercent / 100)`. The `platformFee` column already exists on the `Order` entity — it just never gets set.
**Files:**
- `Backend/.../service/OrderService.java` — set `order.setPlatformFee(...)` before save

---

### F2 — Real-Time Order Tracking for Customers (Medium effort)
**Problem:** WebSocket infrastructure exists for admins but customers have no live status feed on their active order.
**What exists:** `NotificationWebSocketController.java`, `NotificationService.ts`, order WebSocket on `/topic/orders`
**Fix:**
- `OrderService.java` — when status changes, broadcast to `/topic/order/{orderId}` (not just admin topic)
- `Frontend/.../pages/orders/orders.component.ts` (currently empty stub) — subscribe to the order topic, show live status timeline: Pending → Preparing → Out for Delivery → Delivered
- `Frontend/.../app-routing.module.ts` — wire the orders route under `/store/:slug/orders`
**Files:**
- `Backend/.../service/OrderService.java` — add targeted broadcast on status update
- `Frontend/.../pages/orders/orders.component.ts` — build live tracking UI
- `Frontend/.../services/notification.service.ts` — add customer order subscription method

---

### F3 — Opening Hours / Close Store Temporarily (Small effort)
**Problem:** No "I'm closed right now" feature. Store owners have to fully deactivate their account to stop orders.
**Fix:**
- Add `isOpen` boolean field to Tenant entity (default true)
- Add toggle button to `AdminSettingsComponent` — "Open for Orders" / "Closed"
- `OrderService.java` — check `tenant.isOpen` before accepting order, return 400 "This store is currently closed"
- Customer store page — show "Currently Closed" banner if `!tenant.isOpen`, disable Add to Cart
**Files:**
- `Backend/.../entity/Tenant.java` — add `isOpen` field
- `Backend/.../service/OrderService.java` — check isOpen before accepting order
- `Backend/.../controller/AdminSettingsController.java` — add PATCH `/api/admin/settings/toggle-open`
- `Frontend/.../admin/admin-settings/admin-settings.component.html` — add toggle switch
- `Frontend/.../pages/home/home.component.html` — show closed banner when !isOpen

---

### F4 — Minimum Order Amount (Small effort)
**Problem:** No minimum order validation. Customers can checkout with R1 orders.
**Fix:**
- Add `minimumOrderAmount` field to Tenant entity (BigDecimal, default 0)
- `OrderService.java` — validate `order.totalAmount >= tenant.minimumOrderAmount` before accepting
- Admin settings — add "Minimum Order (R)" input field
- Checkout page — show warning if cart total is below minimum
**Files:**
- `Backend/.../entity/Tenant.java` — add `minimumOrderAmount`
- `Backend/.../service/OrderService.java` — validate before save
- `Backend/.../controller/AdminSettingsController.java` — expose field in GET/PUT settings
- `Frontend/.../pages/checkout/checkout.component.ts` — show minimum order warning
- `Frontend/.../admin/admin-settings/admin-settings.component.html` — add input

---

## Priority 2 — Medium Impact

### F5 — Customer Profile Page (Small effort)
**Problem:** Customers can log in but there is no profile page — they can't update their name, email, or password.
**Fix:**
- New Angular page at `/store/:slug/profile`
- Form: name, email, current password, new password fields
- `Backend/.../controller/UserController.java` — add `PUT /api/user/profile` endpoint
**Files:**
- `Backend/.../controller/UserController.java` — add profile update endpoint (NEW or extend existing)
- `Frontend/.../pages/profile/` — new profile component (NEW)
- `Frontend/.../app-routing.module.ts` — add profile route under store children
- Navbar — add Profile link when user is logged in

---

### F6 — Order Status Emails (Small effort)
**Problem:** Customers only get emails when order is placed and when delivered. No "Preparing" or "Out for Delivery" notifications.
**Fix:** In `OrderService.java`, inside the `updateOrderStatus()` method, add email triggers for each status transition using the existing `EmailService`.
**Files:**
- `Backend/.../service/OrderService.java` — add `emailService.sendStatusUpdate(...)` calls for each status change
- `Backend/.../service/EmailService.java` — add `sendStatusUpdate(email, orderRef, status)` method with HTML template

---

### F7 — Reorder Button (Small effort)
**Problem:** History orders page shows past orders but there's no way to quickly reorder.
**Fix:** Add "Reorder" button on each past order card that loads the same items back into the cart.
**Files:**
- `Frontend/.../pages/historyorders/historyorders.component.ts` — add `reorder(order)` method that calls `CartService.addItem()` for each item
- `Frontend/.../pages/historyorders/historyorders.component.html` — add Reorder button per order card

---

### F8 — Driver Earnings Tracking (Medium effort)
**Problem:** Drivers have no visibility of how much they've earned.
**Fix:**
- Add `driverEarningPercent` field to Tenant (e.g. 70% of delivery fee goes to driver)
- On order delivery, compute and save a `DriverEarning` record: `deliveryFee * driverEarningPercent`
- New entity: `DriverEarning` (id, driverId, orderId, amount, date)
- Driver dashboard — add Earnings tab showing total earned today/week/month
**Files:**
- `Backend/.../entity/DriverEarning.java` — NEW entity
- `Backend/.../repository/DriverEarningRepository.java` — NEW
- `Backend/.../service/OrderService.java` — create DriverEarning record on delivery
- `Backend/.../controller/DriverController.java` — add `GET /api/driver/earnings` endpoint
- `Frontend/.../driver/driver-dashboard/driver-dashboard.component.ts` — add earnings section

---

### F9 — SEO Meta Tags for Store Pages (Small effort)
**Problem:** Stores have public URLs (`/store/joes-burgers`) but no dynamic `<title>` or OpenGraph meta tags — they won't be indexed by Google.
**Fix:** Use Angular's `Title` and `Meta` services (both built into `@angular/platform-browser` — no new dependency needed) to set dynamic tags when a store loads.
**Files:**
- `Frontend/.../pages/store/store.component.ts` — inject `Title` + `Meta`, set tags from tenant resolver data
- `Frontend/.../index.html` — add base OpenGraph fallback tags

---

## Priority 3 — Lower Impact (Do Later)

| # | Feature | Notes |
|---|---------|-------|
| F10 | Driver accept/reject orders | Requires order assignment workflow overhaul |
| F11 | Distance-based delivery fee | Calculate fee based on km between store and customer |
| F12 | Payout tracking for store owners | Track what platform owes each store after commission |
| F13 | Refund handling | Call PayPal refund API on order cancellation |
| F14 | Ratings & reviews | New Review entity, star rating UI on store page |
| F15 | Store onboarding flow | Guided setup after registration: upload logo, add first menu items |

---

## Phase 2 Verification Checklist

- [ ] Order placed with 4% commission → `platformFee` stored on order record
- [ ] Order status changes to "Preparing" → customer gets email notification
- [ ] Order status changes to "Out for Delivery" → customer gets email notification
- [ ] Customer visits active order → sees live status timeline updating in real time
- [ ] Store admin toggles "Closed" → customer sees "Currently Closed" banner, can't add to cart
- [ ] Customer tries to checkout below minimum order amount → warning shown
- [ ] Customer visits /store/slug/profile → can update name + password
- [ ] History orders page shows "Reorder" button → clicking it repopulates cart
- [ ] Driver visits earnings tab → sees total earned today, this week, this month
- [ ] `/store/joes-burgers` page has correct `<title>` and OpenGraph tags in browser dev tools
