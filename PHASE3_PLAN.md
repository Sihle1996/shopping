# Phase 3 — Competitive Parity Plan

## Context

Comparing against Mr D Food and Uber Eats, these are the gaps that matter to real users.
Ordered by impact. Start with quick wins, then tackle the big structural ones.

---

## The Upgrade Flow (current vs correct)

**What "Request Upgrade" does right now:**
1. Store admin clicks the button
2. Angular POSTs to `/api/admin/subscription/upgrade-request`
3. Spring Boot sends an email to `support@fastfood.co.za` (if RESEND_API_KEY is set)
4. Returns 200 — Angular shows "Upgrade request sent!"
5. A **human** must manually open SuperAdmin and change the plan

**Why nothing feels like it happened:**
- If `RESEND_API_KEY` is not set (local dev), the email is silently skipped — still returns 200
- Even when email goes, plan change is manual — no payment, no automation
- User expects self-serve Stripe checkout like every SaaS product

**The fix (P8 below):** Stripe Checkout → webhook → automatic plan change in DB

---

## Priority 1 — Quick Wins (do these first)

### P1 — Special Instructions per order ✅ Quick
**Why:** "No onions", "ring the bell", "leave at the gate" — Mr D has this on every order.
Every restaurant needs it. Currently zero support.

**Backend:**
- `OrderItem.java` — add `String specialInstructions` column
- `Order.java` — add `String orderNotes` (delivery instructions like "gate code 1234")
- `OrderController.java` — include `orderNotes` in order creation payload
- `OrderItemDTO.java` — expose `specialInstructions`

**Frontend:**
- `checkout.component.html` — add "Order notes" text area (gate code, access instructions)
- `checkout.component.ts` — include `orderNotes` in order payload
- Cart item row — add small optional "Note for this item" input
- `admin-orders.component.html` — display notes on the order card

**Files:** 5 backend + 4 frontend

---

### P2 — Delivery ETA on store card ✅ Quick
**Why:** Mr D shows "25–35 min" before you even tap a restaurant. It's the first thing
customers look at. Currently we show nothing.

**Backend:**
- `Tenant.java` — add `Integer estimatedDeliveryMinutes` (default 30)
- `AdminSettingsController.java` — expose in GET/PUT settings
- `TenantController.java` — include in store listing response

**Frontend:**
- `admin-settings.component.html` — "Estimated delivery time (minutes)" number input
- `home.component.html` — show "~30 min" badge on each store card
- `store.component.html` (store header) — show ETA prominently

**Files:** 3 backend + 3 frontend

---

### P3 — Opening Hours Schedule ✅ Quick
**Why:** `isOpen` is a manual toggle. A store can't set "Mon–Fri 09:00–22:00, closed Sunday".
Customers don't know if a store is open. Currently there's no schedule at all.

**Backend:**
- `Tenant.java` — add `String openingHours` (JSON string, e.g. `{"mon":"09:00-22:00","sun":"closed"}`)
- `AdminSettingsController.java` — expose `openingHours` in GET/PUT
- Auto-compute `isOpen` based on schedule on order receipt

**Frontend:**
- `admin-settings.component.html` — 7-row schedule grid (day, open time, close time, closed toggle)
- `home.component.html` — show "Open until 22:00" or "Closed" on store card
- `store.component.html` — show full hours in store header

**Files:** 3 backend + 3 frontend

---

## Priority 2 — Major Structural Gaps

### P4 — Item Modifiers / Extras 🔴 Critical
**Why:** The single biggest gap vs Mr D/Uber Eats. No "extra patty +R15", no "spicy level",
no "no cheese". Pizza places can't offer crust type. Coffee shops can't offer sizes.
Without this, the platform doesn't work for most food businesses.

**New DB tables:**
- `menu_item_option_groups` — (id, menuItemId, name, type: RADIO/CHECKBOX, required, sortOrder)
- `menu_item_option_choices` — (id, groupId, label, priceModifier)
- `order_item_choices` — (id, orderItemId, groupName, choiceLabel, priceModifier) — snapshot at order time

**Backend new files:**
- `entity/MenuItemOptionGroup.java`
- `entity/MenuItemOptionChoice.java`
- `entity/OrderItemChoice.java`
- `repository/MenuItemOptionGroupRepository.java`
- `repository/MenuItemOptionChoiceRepository.java`
- `repository/OrderItemChoiceRepository.java`
- `controller/MenuItemOptionController.java` — CRUD for admin (under `/api/admin/menu-items/{id}/options`)

**Backend modified files:**
- `entity/OrderItem.java` — add `@OneToMany List<OrderItemChoice> choices`
- `entity/CartItem.java` — add `String selectedChoicesJson` (serialized snapshot)
- `service/CartService.java` — parse + store selected choices
- `service/OrderService.java` — copy choices from cart to order_item_choices on checkout
- `dto/CartItemDTO.java` — include selected choices
- `dto/OrderItemDTO.java` — include choices in response

**Frontend admin:**
- `menu-management.component.html` — "Add Options" expand panel per item:
  - Add option group (name, type RADIO/CHECKBOX, required toggle)
  - Add choices to group (label + price modifier)
  - Delete groups/choices
- `menu-management.component.ts` — API calls to option controller

**Frontend customer:**
- `store.component.html` — when adding item to cart, if item has options, open a bottom sheet/modal:
  - Show each option group with radio/checkbox inputs
  - Running total updates as choices are selected
  - "Add to cart" only active when required groups are satisfied
- `store.component.ts` — validate + attach selected choices to cart add call
- Cart display — show chosen options under each cart item ("+ Extra patty, No onions")

**Files:** 7 new backend + 6 modified backend + 3 frontend admin + 3 frontend customer

---

### P5 — Cuisine Types + Store Filters ✅ Medium
**Why:** Customers can't browse by "Pizza" or "Burgers". No search filter on the store list.

**Backend:**
- `Tenant.java` — add `String cuisineType` (e.g. "Burgers", "Pizza", "Sushi", "Chicken")
- `TenantController.java` — add `?cuisine=Burgers` filter to nearby/search endpoint
- `AdminSettingsController.java` — expose cuisineType in settings

**Frontend:**
- `admin-settings.component.html` — "Cuisine Type" dropdown (Burgers, Pizza, Sushi, Chicken, Wraps, Other)
- `home.component.html` — horizontal filter chips at top (All, Burgers, Pizza, Sushi...)
- `home.component.ts` — filter store list by selected cuisine client-side (or re-fetch)
- Store card — show small cuisine badge

**Files:** 3 backend + 4 frontend

---

### P6 — Guest Checkout ✅ Medium
**Why:** Requiring account creation kills conversions. Mr D and Uber Eats let you order
as a guest with just email + phone. Major drop-off reduction.

**Backend:**
- `OrderController.java` — allow POST `/api/orders` without JWT (add guestEmail, guestPhone fields to request)
- `Order.java` — add `String guestEmail`, `String guestPhone` (nullable; set when user is null)
- `OrderService.java` — handle nullable user on order creation

**Frontend:**
- `checkout.component.ts` — detect if user is logged in; if not, show guest fields (email, phone)
- `checkout.component.html` — guest info section
- `app-routing.module.ts` — remove auth guard from checkout route

**Files:** 3 backend + 2 frontend

---

### P7 — Distance-Based Delivery Fee ✅ Medium
**Why:** Flat fee is unfair. Nearby customers shouldn't pay the same as customers 8 km away.
The `deliveryFeeBase` column exists but is never used in calculations.

**Backend:**
- `Tenant.java` — add `Double deliveryFeePerKm` (default 2.00), rename `deliveryFeeBase` intent to base
- `OrderService.java` — calculate fee: `base + (distanceKm * perKm)` using Haversine on lat/lon already in Order
- `OrderController.java` — return calculated fee in pre-checkout estimate endpoint
- New endpoint: `GET /api/stores/{slug}/delivery-fee?lat=&lon=` — returns estimated fee + distance

**Frontend:**
- `checkout.component.ts` — call delivery fee estimate before showing total
- `checkout.component.html` — show "Delivery: R18 (3.2 km)" in order summary
- `admin-settings.component.html` — base fee + per km rate inputs

**Files:** 3 backend + 3 frontend

---

### P8 — Stripe Self-Serve Upgrade 🔴 Critical for business
**Why:** The current "Request Upgrade" is a manual email flow. No one will upgrade if
they have to wait for a human to call them. Stripe Checkout is the standard for SaaS.

**Backend:**
- `pom.xml` — add `stripe-java` dependency
- `service/StripeService.java` — create Checkout session, handle webhook
- `controller/StripeController.java` — `POST /api/billing/checkout` (creates session, returns URL)
                                     — `POST /api/billing/webhook` (handles payment success)
- `application.properties` — add `stripe.secret-key`, `stripe.webhook-secret`, `stripe.price-ids.*`
- On webhook `checkout.session.completed`: update `subscriptionPlan` + `subscriptionStatus = ACTIVE`

**Frontend:**
- `admin-subscription.component.html` — replace "Request Upgrade" button with plan cards:
  - BASIC R299/mo, PRO R699/mo, ENTERPRISE R1499/mo
  - Current plan highlighted, upgrade buttons on others
- `admin-subscription.component.ts` — `upgrade(plan)` → POST to `/api/billing/checkout` → `window.location = session.url`
- Add `/admin/billing/success` route — "Payment successful! Your plan has been upgraded."
- Add `/admin/billing/cancel` route — "Payment cancelled."

**Files:** 4 backend + 3 frontend

---

## Priority 3 — Nice to Have

### P9 — Menu Item Search within Store
**Frontend only:** Add search input above menu items on store page. Filter items by name.
No backend needed — items are already loaded.

### P10 — Saved Delivery Addresses
**Backend:** New `UserAddress` entity (id, userId, label, address, lat, lon, isDefault)
**Frontend:** Address book in profile, address picker in checkout

### P11 — Driver Live Location on Map
**Backend:** Driver POSTs GPS coordinates every 10s via `PUT /api/driver/location`
**Frontend:** Order tracking page subscribes to WebSocket topic `/topic/driver/{orderId}`, renders Leaflet map

---

## Implementation Order

| # | Feature | Effort | Status |
|---|---------|--------|--------|
| P1 | Special instructions | Small | ✅ Done |
| P2 | Delivery ETA | Small | ✅ Done |
| P3 | Opening hours schedule | Small | ✅ Done |
| P4 | Item modifiers / extras | Large | ✅ Done |
| P5 | Cuisine types + filters | Medium | ✅ Done (backend + store card badges; filter chips next) |
| P6 | Guest checkout | Medium | ✅ Done |
| P7 | Distance-based delivery fee | Medium | ⬜ |
| P8 | Stripe self-serve upgrade | Large | ⬜ |
| P9 | Menu item search | Small | ⬜ |
| P10 | Saved addresses | Medium | ⬜ |
| P11 | Driver live location | Large | ⬜ |

---

## Verification Checklist (to fill in as built)

- [ ] Customer can type "no onions" on a cart item and it appears on the admin order card
- [ ] Customer types gate code at checkout and driver sees it on the order
- [ ] Store card shows "~30 min" delivery time
- [ ] Admin can set Mon–Fri 09:00–22:00 and store auto-shows as Closed on Sunday
- [ ] Admin can add "Size" option group with Small/Medium/Large + price modifiers to a menu item
- [ ] Customer sees Size options when adding item to cart, total updates live
- [ ] Required options block "Add to cart" until selected
- [ ] Order admin view shows chosen options under each item
- [ ] Customer can filter store list by "Pizza" or "Burgers"
- [ ] Customer can checkout without registering (guest email + phone)
- [ ] Delivery fee shows "R18 (3.2 km)" in checkout
- [ ] Admin can click "Upgrade to PRO" → redirected to Stripe → plan updates after payment
