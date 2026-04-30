# SuperAdmin AI Experience — Design Plan

## Context

The customer side has mood-based intelligence and "Order for Me." The admin side will have menu writing, promotion optimisation, and review digests. The SuperAdmin layer sits above all of that — it sees every store, every order, every customer, every trend across the entire platform. That scope is where AI becomes most powerful: patterns invisible at the store level become obvious at the platform level.

This plan defines **6 AI features** for the SuperAdmin. They share the same `AdminAiService` infrastructure from the admin AI plan but receive cross-tenant data.

**Model:** `claude-haiku-4-5-20251001` for all real-time features. `claude-sonnet-4-6` for the weekly automated report (richer reasoning, runs in background).

---

## Architecture

```
[SuperAdmin Frontend]
   ├── Platform Intelligence panel     ← AI health overview
   ├── Store Risk Board                ← churn + at-risk stores
   ├── Enrollment AI Screener          ← pre-scores applications
   ├── Trend Radar                     ← cross-tenant category + food trends
   ├── Anomaly Feed                    ← unusual order/payment patterns
   ├── Ask the Platform (chat)         ← natural language analytics
   └── Weekly Report (email + in-app) ← AI-generated digest

[Spring Boot]
   ├── SuperAdminAiController          POST /api/superadmin/ai/{action}
   ├── SuperAdminAiService             orchestrates data + calls AdminAiService
   └── AdminAiService (existing)       Anthropic HTTP wrapper

[Anthropic API]
   ├── claude-haiku  → real-time features (< 2s response target)
   └── claude-sonnet → weekly report (background job, ~15s)
```

---

## Feature 1 — Platform Intelligence Panel

### What it does
The top section of the SuperAdmin dashboard. Instead of raw numbers, Claude interprets the platform's current state and surfaces what actually matters — the signal, not the noise.

**Output: one paragraph + 3 prioritised action items**

Example:
> "Your platform is healthy but showing early stress signals. GMV is up 18% month-on-month driven by 4 stores. However, 6 BASIC-tier stores have had fewer than 10 orders each in the last 14 days — historically that pattern precedes cancellation within 30 days. Trial conversions dropped from 72% to 58% this month; the stores that didn't convert cited 'too complex to set up' in their exit surveys.
>
> **Actions:**
> 1. Reach out to the 6 low-activity stores — a single check-in call has 40% retention rate in similar platforms
> 2. Simplify onboarding for trial stores — the menu setup step has a 35% drop-off
> 3. Consider a 7-day extension offer for trials ending this week (3 stores)"

### API

**`POST /api/superadmin/ai/platform-intelligence`** — no request body needed

**Response:**
```json
{
  "summary": "...",
  "actions": [
    { "priority": 1, "label": "Reach out to 6 low-activity stores", "type": "RETENTION" },
    { "priority": 2, "label": "Simplify trial onboarding", "type": "PRODUCT" },
    { "priority": 3, "label": "Extend 3 expiring trials", "type": "SALES" }
  ],
  "generatedAt": "2035-04-30T08:00:00"
}
```

### Backend — `SuperAdminAiService.platformIntelligence()`

1. Pull from existing `/api/superadmin/stats`: tenant counts, plan breakdown, GMV, trial expiry forecast
2. Pull low-activity stores (orders < 10 in 14 days)
3. Pull trial conversion rate (approved this month / submitted this month)
4. Compress to ~800 tokens and send to Claude with prompt:
   ```
   You are an analyst for a multi-tenant food delivery platform in South Africa.
   Given this platform snapshot: {data}
   Write a 3-sentence executive summary and 3 specific actionable priorities in JSON.
   Be specific about numbers. Do not invent data not in the snapshot.
   ```
5. Cache for 2 hours — this runs on dashboard load

### Frontend

Full-width card at the top of `/superadmin` dashboard, above the stats cards.
- Loading state: pulsing skeleton
- Rendered: summary paragraph + 3 action chips (colour-coded by type: red=retention, amber=product, green=sales)
- "Refresh" button (respects 2-hour cache, shows "last updated X min ago")

---

## Feature 2 — Store Risk Board (Churn Prediction)

### What it does
A live ranked list of stores at risk of churning — cancelling their subscription, not renewing, or going silent. Each at-risk store gets a risk score (0–100), a reason, and a suggested intervention.

**Risk signals fed to Claude:**
- Orders in last 7 / 14 / 30 days vs previous period
- Admin login frequency (last seen)
- Support ticket count and sentiment
- Days since menu was last updated
- Subscription plan + billing period end
- Trial stores: days remaining

Example output:
| Store | Risk Score | Reason | Suggested Action |
|---|---|---|---|
| Kauai Rosebank | 87 | 0 orders in 14 days, admin last logged in 18 days ago | Send a personal check-in from superadmin |
| The Grillhouse | 71 | Orders down 60% vs last month, trial expires in 3 days | Offer 14-day trial extension |
| Noodle Bar CT | 55 | Menu not updated in 45 days, 3 negative reviews unanswered | Suggest enabling auto-reply or review digest |

### API

**`POST /api/superadmin/ai/store-risk`**
```json
// Response
{
  "atRiskStores": [
    {
      "tenantId": "uuid",
      "name": "Kauai Rosebank",
      "riskScore": 87,
      "riskLevel": "HIGH",
      "reasons": ["0 orders in 14 days", "Admin inactive 18 days"],
      "suggestedAction": "Send personal check-in from superadmin",
      "actionType": "OUTREACH"
    }
  ],
  "totalAtRisk": 3,
  "generatedAt": "..."
}
```

### Backend — `SuperAdminAiService.storeRisk()`

1. For each active tenant: query order counts (7d, 14d, 30d), last admin login, review response rate, menu updated_at, trial end
2. Claude scores each store and returns the ranked list with reasons
3. Cache for 4 hours — background refresh via `@Scheduled(cron = "0 0 */4 * * *")`

### Frontend

Dedicated section on the SuperAdmin dashboard — "⚠️ Store Risk Board" — collapsible.
- High risk stores: red badge
- Medium risk: amber badge
- Each row: store name, risk score pill, reasons as tags, suggested action button
- Action buttons: "Send message" | "Extend trial" | "Schedule call" (links open the tenant detail page pre-scrolled to the message panel)

---

## Feature 3 — Enrollment AI Screener

### What it does
When a store submits for review (`PENDING_REVIEW`), Claude pre-screens the application before the SuperAdmin sees it. It checks completeness, flags anomalies, and gives an initial recommendation (LIKELY_APPROVE / NEEDS_REVIEW / FLAG).

This doesn't replace human review — it surfaces the most important questions and saves time.

**What Claude checks:**
- Business name vs CIPC number plausibility (does it look like a real SA company?)
- Bank account details completeness and consistency
- Menu quality: item count, price range, description quality, presence of categories
- Store location: is it within a plausible delivery radius?
- Duplicate detection: is there already a store with the same slug/CIPC/bank account?

**Example output:**
```
Recommendation: NEEDS_REVIEW

Findings:
✅ CIPC number format valid (14 digits)
✅ Bank details complete (FNB, valid branch code 250655)
✅ Menu has 12 items across 3 categories — adequate
⚠️  Business name "Fresh Bites" is very generic — CIPC match unverifiable
⚠️  Storefront photo appears to be a stock image (low resolution, no branding visible)
❌ Delivery radius set to 80km — unusually large for a single store

Questions to ask the applicant:
1. Can you provide a photo of the physical store exterior with signage?
2. Why is the delivery radius set to 80km — do you have multiple branches?
```

### API

**`POST /api/superadmin/ai/screen-enrollment`**
```json
// Request
{ "tenantId": "uuid" }

// Response
{
  "recommendation": "NEEDS_REVIEW",
  "findings": [
    { "type": "PASS", "text": "CIPC number format valid" },
    { "type": "WARNING", "text": "Business name is very generic" },
    { "type": "FAIL", "text": "Delivery radius 80km — unusually large" }
  ],
  "questionsForApplicant": [
    "Can you provide a photo of the physical store exterior?",
    "Why is the delivery radius set to 80km?"
  ]
}
```

### Backend — `SuperAdminAiService.screenEnrollment(tenantId)`

1. Load tenant: name, CIPC, bank details, delivery radius, location
2. Load menu: item count, categories, price range, description quality (avg length)
3. Check for duplicates: same CIPC or bank account in existing tenants
4. Send compact JSON to Claude with screening instructions
5. Store screening result in `enrollment_ai_screens` table (Flyway V29) — don't re-screen unless resubmitted

### Frontend

On the Enrollment Queue page, each pending card shows:
- AI screening badge: 🟢 LIKELY APPROVE / 🟡 NEEDS REVIEW / 🔴 FLAG
- "View AI Screen" button → expands findings list + questions
- SuperAdmin still makes the final call — AI is advisory

Also: auto-runs on submission, so by the time SuperAdmin opens the queue, every application is already screened.

---

## Feature 4 — Cross-Tenant Trend Radar

### What it does
Platform-wide food and business trend detection. Claude aggregates order data across all stores and surfaces trends the SuperAdmin can act on — recruiting new merchants, advising existing ones, or launching platform-wide promotions.

**Three trend views:**

**A — Food Trends**
What categories and items are growing fastest across the platform.
> "Vegan wraps are up 67% platform-wide this month. Only 2 of your 24 stores carry them. Consider actively recruiting vegan-friendly restaurants."

**B — Merchant Gaps**
Categories with high consumer demand but low supply.
> "Sushi appears in customer search queries 340 times this month but only 1 store on the platform serves it. High-intent gap."

**C — Seasonal Signals**
Patterns tied to time of year, events, weather.
> "Based on last year's data, Soup orders spike 3× in the next 6 weeks (winter). 8 stores have Soup on their menu — consider a 'Warm Up' platform promotion."

### API

**`POST /api/superadmin/ai/trend-radar`**
```json
// Response
{
  "foodTrends": [
    { "trend": "Vegan wraps up 67% platform-wide", "opportunity": "Recruit vegan restaurants", "urgency": "MEDIUM" }
  ],
  "merchantGaps": [
    { "category": "Sushi", "searchDemand": 340, "storesServing": 1, "opportunity": "High-intent gap — recruit sushi restaurants" }
  ],
  "seasonalSignals": [
    { "signal": "Winter soup spike expected in 6 weeks", "affectedStores": 8, "suggestion": "Launch platform-wide Warm Up promotion" }
  ]
}
```

### Backend — `SuperAdminAiService.trendRadar()`

1. Query top 20 items by order count this month vs last month — across all tenants
2. Query categories by order velocity
3. Run once per day via `@Scheduled(cron = "0 0 6 * * *")` — cache result until next run
4. Monthly comparison + YoY if data exists

### Frontend

"📡 Trend Radar" page in the SuperAdmin nav.
- Three collapsible sections: Food Trends / Merchant Gaps / Seasonal Signals
- Each finding has an urgency badge (HIGH / MEDIUM / LOW)
- "Take Action" button per finding → pre-fills a global announcement or opens the tenant recruitment flow

---

## Feature 5 — Anomaly Detection Feed

### What it does
Continuous monitoring for unusual patterns that warrant investigation. Runs every 15 minutes, flags anything statistically abnormal.

**Patterns Claude watches for:**

| Anomaly | Signal |
|---|---|
| Order volume spike | Store X had 80 orders in 1 hour — 8× their average |
| Suspicious refund rate | Store Y: 40% of today's orders requested refunds |
| Impossible geolocation | Orders placed from 200km outside delivery radius |
| Failed payment surge | 15 failed payments in 30 min from same store |
| Account takeover signal | Admin logged in from new country/device, then changed bank details |
| Menu price manipulation | 5 items had price changed > 200% within 1 hour |

### API

**`GET /api/superadmin/ai/anomalies?since=1h`**
```json
{
  "anomalies": [
    {
      "severity": "HIGH",
      "type": "ORDER_SPIKE",
      "tenantId": "uuid",
      "tenantName": "Burger Spot JHB",
      "description": "82 orders in the last 60 minutes — 9× the store's hourly average",
      "detectedAt": "2035-04-30T14:23:00",
      "suggestedAction": "Verify this is a legitimate event (e.g. corporate lunch) before assuming fraud"
    }
  ]
}
```

### Backend — `SuperAdminAiService.detectAnomalies()`

**Hybrid approach:** rules engine catches the obvious cases, Claude interprets ambiguous ones.

1. Rules engine (Java, fast) checks hard thresholds: order spike > 5× hourly avg, refund rate > 30%, price change > 150%
2. Any trigger → Claude classifies severity (HIGH / MEDIUM / INFO) and writes a human-readable description + suggested action
3. Store results in `anomaly_events` table (Flyway V29) — deduplicate, don't fire same anomaly twice within 2 hours
4. `@Scheduled(fixedDelay = 900_000)` — runs every 15 minutes

### Frontend

Live feed in the SuperAdmin sidebar — bell icon with badge count for unread HIGH anomalies.
Full feed at `/superadmin/anomalies`:
- Severity pills (HIGH = red, MEDIUM = amber, INFO = blue)
- Dismiss / Investigate buttons
- "Investigate" → opens the relevant tenant detail page with the anomaly context pinned

---

## Feature 6 — Ask the Platform (Conversational Analytics)

### What it does
Identical UX to the admin-side chat widget, but with **cross-tenant scope**. SuperAdmin types a question, Claude returns a plain-English answer backed by real data.

**Example questions:**
- "Which store made the most money last month?"
- "What's the average order value across the platform?"
- "How many stores upgraded their plan in the last 90 days?"
- "Which cuisine type has the highest customer rating?"
- "What percentage of orders are placed on mobile vs desktop?"
- "How many stores are in Johannesburg vs Cape Town?"

### API

**`POST /api/superadmin/ai/query`**
```json
// Request
{ "question": "Which store made the most money last month?" }

// Response
{
  "answer": "Nando's Sandton led the platform last month with R142,800 in GMV across 1,520 orders — 23% of total platform revenue.",
  "data": { "tenantName": "Nando's Sandton", "gmv": 142800, "orders": 1520, "platformShare": 23 },
  "question": "Which store made the most money last month?"
}
```

### Backend — same two-step pattern as admin analytics query

1. Claude classifies question intent from a taxonomy of ~15 pre-built cross-tenant queries
2. Backend runs the matched aggregate query
3. Claude formats the result as a natural sentence
4. Unknown intents → Claude returns "I can answer questions about revenue, orders, stores, plans, and ratings."

### Frontend

Persistent chat widget on the SuperAdmin dashboard (bottom-right corner, collapsible panel).
- Message history in session (not persisted to DB)
- Typing indicator while waiting
- Each answer optionally shows "View chart" → renders an ApexCharts bar/line for the returned data

---

## Feature 7 — Weekly Platform Report (Email + In-App)

### What it does
Every Monday morning at 7am, Claude generates a 1-page summary of the past week and emails it to the SuperAdmin. Also accessible in-app at `/superadmin/reports`.

**Report sections:**
1. **Headline numbers** — GMV, orders, active stores, new registrations, churn
2. **Week narrative** — 2 paragraphs: what happened and why (Claude interprets the data)
3. **Store winners** — top 3 stores by GMV growth % vs previous week
4. **Stores that need attention** — bottom 3 by order decline or churn risk
5. **Platform health score** — 0–100 composite (orders growth, retention, approval rate, avg rating)
6. **Next week outlook** — 2 sentences on what to watch (events, expiring trials, seasonal signals)

### API

**`GET /api/superadmin/reports/latest`** — returns latest report
**`POST /api/superadmin/reports/generate`** — manual trigger

### Backend

- `@Scheduled(cron = "0 0 7 * * MON")` — auto-generates every Monday
- Uses `claude-sonnet-4-6` (richer reasoning, runs in background)
- Stores report in `platform_reports` table (Flyway V29): `id, week_start, content_json, generated_at`
- Sends email via existing email service (JavaMailSender already in codebase)

### Frontend

`/superadmin/reports` page:
- Latest report rendered as a styled document
- Report history list (previous weeks) with download as PDF option (browser print)
- "Generate now" button for manual trigger

---

## New Files

### Backend
| File | Purpose |
|---|---|
| `service/SuperAdminAiService.java` | Orchestrates cross-tenant data + calls AdminAiService |
| `controller/SuperAdminAiController.java` | `POST /api/superadmin/ai/{action}` |
| `db/migration/V29__ai_support_tables.sql` | enrollment_ai_screens, anomaly_events, platform_reports |

### Frontend
| File | Purpose |
|---|---|
| `services/superadmin-ai.service.ts` | HTTP wrapper for all AI endpoints |
| `superadmin/platform-intelligence/` | Feature 1 component |
| `superadmin/store-risk/` | Feature 2 component |
| `superadmin/enrollment/enrollment-screener/` | Feature 3 component (embedded in enrollment queue) |
| `superadmin/trend-radar/` | Feature 4 page |
| `superadmin/anomalies/` | Feature 5 live feed |
| `superadmin/ai-chat/` | Feature 6 chat widget |
| `superadmin/reports/` | Feature 7 report viewer |

---

## V29 Migration

```sql
-- enrollment_ai_screens: cache AI screening results per application
CREATE TABLE IF NOT EXISTS enrollment_ai_screens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  recommendation  VARCHAR(20) NOT NULL,   -- LIKELY_APPROVE | NEEDS_REVIEW | FLAG
  findings_json   TEXT NOT NULL,
  questions_json  TEXT,
  screened_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- anomaly_events: deduplication + audit trail
CREATE TABLE IF NOT EXISTS anomaly_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE SET NULL,
  severity        VARCHAR(10) NOT NULL,   -- HIGH | MEDIUM | INFO
  type            VARCHAR(40) NOT NULL,
  description     TEXT NOT NULL,
  suggested_action TEXT,
  dismissed       BOOLEAN DEFAULT FALSE,
  detected_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_anomaly_events_detected ON anomaly_events(detected_at DESC);

-- platform_reports: weekly AI-generated summaries
CREATE TABLE IF NOT EXISTS platform_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start      DATE NOT NULL UNIQUE,
  content_json    TEXT NOT NULL,
  generated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Phased Delivery

### Sprint 1 (2 days) — Highest signal, lowest risk
1. Feature 1: Platform Intelligence Panel (dashboard summary)
2. Feature 3: Enrollment AI Screener (saves time on every application)

### Sprint 2 (2 days)
3. Feature 2: Store Risk Board (churn prevention)
4. Feature 6: Ask the Platform chat

### Sprint 3 (2 days)
5. Feature 4: Trend Radar
6. Feature 5: Anomaly Detection feed + notifications

### Sprint 4 (1 day)
7. Feature 7: Weekly report (email + in-app viewer)

---

## Cost Estimate

| Feature | Frequency | Tokens/call | Cost/call | Monthly est. |
|---|---|---|---|---|
| Platform Intelligence | 10×/day | ~2 000 | $0.0003 | ~$0.09 |
| Store Risk Board | 6×/day | ~3 000 | $0.0004 | ~$0.07 |
| Enrollment Screener | Per application | ~1 500 | $0.0002 | ~$0.02 (10 apps) |
| Trend Radar | 1×/day | ~2 000 | $0.0003 | ~$0.009 |
| Anomaly Detection | 96×/day | ~500 | $0.00007 | ~$0.20 |
| Ask the Platform | On demand | ~1 000 | $0.00015 | ~$0.05 (est.) |
| Weekly Report (Sonnet) | 4×/month | ~4 000 | $0.012 | ~$0.05 |
| **Total** | | | | **~$0.50/month** |

Haiku pricing at current rates. Negligible at any scale this platform is likely to reach.
