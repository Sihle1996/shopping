# Domain Ownership — who writes what

CraveIt runs **two backends on one Postgres database**:

```
  Spring Boot (Backend/backend, :8080)   ← store-admin + customer apps
            ↓        ↑
            Postgres (shared)
            ↑        ↓
  .NET SuperAdmin (SuperAdmin/backend/SuperAdmin.API, :5000)  ← platform admin
```

Because both read/write the **same tables** (`tenants`, `subscription_plans`, `_user`, `orders`, …),
a value one side writes that the other doesn't expect silently breaks the store/customer side. This
doc is the contract. **Read it before adding a write to the SuperAdmin .NET service.**

## Ownership

| Domain | Owner | SuperAdmin (.NET) may… |
|---|---|---|
| **Orders** (status, lifecycle) | **Spring** | READ ONLY. Never write `orders.status`. |
| **Drivers** (lifecycle, assignment) | **Spring** | read; toggle `driver_status` only |
| **Payments / PayFast** | **Spring** | — |
| **Subscription plans** (rows, limits, AI gates) | **Spring** (Flyway-seeded) | read + **assign** a plan to a store; NOT create/edit/delete |
| **Plan economics** (commission, price) | **`subscription_plans` table** | read; on assign, copy the row's `commission_percent` to the tenant |
| **Users / roles** | **shared contract** (Spring `Role` enum) | set role to one of the 4 valid values only |
| **Reporting / dashboards** | either | .NET read-only preferred |
| **Tenant subscription status / trial / enrollment** | shared | write only the valid enum values below |

## Shared value contracts (write EXACTLY these)

- **`orders.status`** — Spring Title Case: `Pending`, `Scheduled`, `Confirmed`, `Preparing`,
  `Out for Delivery`, `Delivered`, `Cancelled`, `Rejected`. SuperAdmin is **read-only** on orders.
- **`_user.role`** — Spring `Role` enum: `USER`, `ADMIN`, `DRIVER`, `SUPERADMIN`. **Never `MANAGER`**
  (or anything else) — `role` is `@Enumerated(STRING)`, so an unknown value makes every Spring read
  of that user throw.
- **`subscription_status`** — `TRIAL` | `ACTIVE` | `SUSPENDED`. Only `SUSPENDED` hides a store from
  discovery; an unknown string is silently treated as active. Cancellation is the
  `subscription_cancelled_at` timestamp, not a status.
- **`subscription_plan`** — must equal an existing `subscription_plans.name` (`BASIC`/`PRO`/
  `ENTERPRISE` today; **no `STARTER` row yet**). Spring `getPlan()` throws if there's no matching row.
  Case-sensitive.
- **`approval_status`** — Spring enum: `DRAFT` | `PENDING_REVIEW` | `APPROVED` | `REJECTED`.

## Plan economics = single source of truth
The order fee reads `tenant.platform_commission_percent`. That value, and plan **price**, come from
the `subscription_plans` row — **do not hardcode them**. Spring reads them via
`Backend/.../service/PlanCommissionService.java` (`applyPlan` + `commissionForPlan`, which only falls
back to the agreed tiering for a plan with no row). When SuperAdmin assigns a plan, it copies the
row's `commission_percent` onto the tenant. Changing a rate = change the row; both backends follow.

## Removed on purpose — do NOT reintroduce
- **`PATCH /api/orders/{id}/status` (SuperAdmin)** — a direct status write bypasses Spring's order
  pipeline (stock reconciliation, delivery timestamps, customer/driver notifications, driver OTP) and
  writes a value Spring's state machine doesn't recognise. Order status changes belong to the
  store/driver flow in Spring. If platform-admin order actions are ever needed, route them THROUGH a
  Spring endpoint, never a raw DB write.
- **Plan create/update/delete (SuperAdmin)** — those wrote partial rows missing the AI-gate columns
  (`has_promo_ai`, `has_driver_intel`, `has_review_ai`, `has_api_access`, `copilot_monthly_quota`),
  so Spring would read an AI-less plan. Plans are Flyway-owned until a shared plan-definition contract
  exists.
