# Admin AI Experience — Design Plan

## Context

The platform already has a rules-based intelligence layer for customers (mood chips, recommendations, combos, "Order for Me"). This plan extends AI to the **admin side** — giving restaurant owners tools to write better menus, optimise promotions, understand customers, and query their own data in plain English.

All four features share one backend service (`AdminAiService`) that wraps the Anthropic API. The interface is designed so the AI is a drop-in implementation detail — not baked into every feature — consistent with the `RecommendationEngine` / `IntentParser` pattern already in the codebase.

**Anthropic model to use:** `claude-haiku-4-5-20251001` for all four features (fast, cheap, sufficient). Cost estimate: < $0.005 per admin action at current pricing.

---

## Architecture Overview

```
[Admin Frontend]
   ├── MenuItem editor         — "✨ Generate" button (description + tags)
   ├── Promotions page         — AI suggestion card ("Consider this promo")
   ├── Reviews page            — Weekly digest card (sentiment summary)
   └── Dashboard               — Chat widget ("Ask your data")

[Spring Boot — new]
   ├── AdminAiController       POST /api/admin/ai/{action}
   └── AdminAiService          wraps Anthropic HTTP API, one method per feature

[Anthropic API]
   └── claude-haiku-4-5-20251001
```

---

## Feature 1 — Menu Writing Assistant

### What it does
Admin types a dish name (e.g. "Smash Burger") and clicks ✨. Claude returns:
- A 1–2 sentence appetising description
- 3–5 suggested tags drawn from the platform's tag vocabulary
- A suggested category (if not already set)

### API

**`POST /api/admin/ai/describe-item`**
```json
// Request
{ "name": "Smash Burger", "price": 95.00, "category": "Burgers" }

// Response
{
  "description": "Two smashed beef patties with melted cheddar, pickles and our house sauce on a toasted brioche bun.",
  "tags": ["filling", "comfort", "premium"],
  "suggestedCategory": "Burgers"
}
```

### Backend — `AdminAiService.describeItem()`

Prompt pattern:
```
You are a menu copywriter for a South African food delivery app.
Given: name="${name}", price=R${price}, category="${category}"
Return JSON only:
{
  "description": "<1–2 sentence description, appetising, under 100 chars>",
  "tags": ["<tag1>", "<tag2>"],   // choose from: filling, comfort, healthy, light, premium,
                                   // indulgent, quick, grilled, fried, spicy, sweet, vegan
  "suggestedCategory": "<category>"
}
```

Claude structured output → parse JSON → return to frontend.

### Frontend

In `AdminMenuItemFormComponent` (existing item editor):
- Add ✨ button next to Description field
- On click: POST to `/api/admin/ai/describe-item`
- Populate description textarea + pre-check tag chips + set category if blank
- User can edit before saving — AI output is a suggestion, not auto-saved

---

## Feature 2 — Promotion Optimizer

### What it does
Claude analyses the tenant's order history (last 30 days) and identifies:
- Slow-moving items (ordered < 5 times)
- Peak hours / days
- Items with high view-to-order drop-off (once event tracking is live)

Returns 1–3 actionable promotion suggestions, each pre-filled with a discount %, target, and suggested active window. Admin clicks "Apply" to create the promotion directly.

### API

**`POST /api/admin/ai/suggest-promotions`**
```json
// Request — backend assembles this from DB, no body needed
{}

// Response
{
  "suggestions": [
    {
      "reason": "Veggie Wrap has sold only 2 times this week vs 18 for similar items",
      "proposedPromo": {
        "name": "Veggie Wrap Flash Deal",
        "discountPercent": 20,
        "appliesTo": "PRODUCT",
        "targetProductId": "uuid-...",
        "validFrom": "2035-05-02T17:00:00",
        "validTo":   "2035-05-02T20:00:00"
      }
    }
  ]
}
```

### Backend — `AdminAiService.suggestPromotions()`

1. Query `orders` last 30 days → item frequency map
2. Query current `menu_items` for tenant
3. Build a compact summary (item name, order count, price, category) — max 2 000 tokens
4. Send to Claude with prompt asking for 1–3 JSON promotion objects
5. Return parsed suggestions

Each suggestion maps directly to the existing `Promotion` entity — admin clicks "Apply" and it calls the existing `POST /api/admin/promotions`.

### Frontend

On the admin Promotions page:
- "✨ AI Suggestions" button at the top
- Loads suggestion cards: reason text + proposed discount badge + date/time range
- "Apply" button per card → calls existing promo create API
- "Dismiss" to hide that suggestion

---

## Feature 3 — Review Intelligence

### What it does
Weekly digest surfaced on the admin dashboard:
- Top 3 positive themes from recent reviews ("Smash Burger praised 8×")
- Top 3 negative themes ("Cold fries mentioned 3×")
- One actionable recommendation ("Consider checking fries hold time or packaging")
- Overall sentiment score for the week (0–10)

### API

**`POST /api/admin/ai/review-digest`**
```json
// Request
{ "since": "2035-04-23" }   // optional — defaults to last 7 days

// Response
{
  "period": "Apr 23 – Apr 30",
  "sentimentScore": 7.4,
  "positives": [
    "Smash Burger quality praised in 8 reviews",
    "Fast delivery mentioned 5 times"
  ],
  "negatives": [
    "Cold fries mentioned 3 times",
    "Long wait on Saturday evenings (2 reviews)"
  ],
  "recommendation": "Check fries packaging — insulated bags or serving separately may help."
}
```

### Backend — `AdminAiService.reviewDigest()`

1. Query `reviews` WHERE `tenant_id = ?` AND `created_at >= since`
2. Concatenate review comments (max 4 000 tokens, truncate oldest first)
3. Send to Claude: "Summarise these reviews. Return JSON with positives[], negatives[], recommendation, sentimentScore 0–10."
4. Cache result for 6 hours (simple `ConcurrentHashMap<tenantId, CachedDigest>` with timestamp)

### Frontend

Admin dashboard home card:
- "📊 This week's customer voice" card
- Sentiment score pill (green/amber/red)
- Two columns: positives (green dots) + negatives (red dots)
- Recommendation text in a callout box
- "Refresh" button (respects 6-hour cache)

---

## Feature 4 — Conversational Analytics ("Ask your data")

### What it does
A chat widget on the admin dashboard. Admin types a question in plain English, Claude interprets it, backend runs the appropriate aggregate query, Claude formats the result as a human-readable answer.

Examples:
- "How did last Friday compare to the week before?"
- "Which item made the most money this month?"
- "What's my busiest hour on weekends?"
- "How many new customers did I get this week?"

### API

**`POST /api/admin/ai/query`**
```json
// Request
{ "question": "Which item made the most money this month?" }

// Response
{
  "answer": "Your top earner this month is the Smash Burger at R4,750 revenue (50 orders × R95).",
  "data": { "item": "Smash Burger", "revenue": 4750, "orders": 50 },
  "question": "Which item made the most money this month?"
}
```

### Backend — `AdminAiService.queryAnalytics()`

Two-step approach:

**Step 1 — Intent classification (Claude)**
Send the user's question to Claude with a prompt:
```
Classify this analytics question into one of: TOP_ITEM_REVENUE, TOP_ITEM_ORDERS,
REVENUE_COMPARISON, PEAK_HOUR, NEW_CUSTOMERS, ORDER_COUNT, CATEGORY_BREAKDOWN.
Return JSON: { "intent": "...", "params": { "period": "THIS_MONTH", ... } }
```

**Step 2 — Run the matched query**
Each intent maps to a pre-written JPQL/SQL query in `OrderRepository` / `AnalyticsService` (most already exist). Result is a small data object.

**Step 3 — Format answer (Claude)**
Send the raw data back to Claude: "Given this data: {...}, answer this question in one natural sentence: '{question}'"

This is safer than letting Claude write SQL (no injection risk, predictable queries).

### Frontend

Dashboard chat widget (bottom-right corner, collapsible):
- Input field: "Ask anything about your store..."
- Message history (current session only, no persistence)
- Each answer shows the plain-English response
- Optional: show raw data in a small expandable table beneath the answer

---

## New Files

### Backend
| File | Purpose |
|---|---|
| `service/AdminAiService.java` | Anthropic HTTP client, one method per feature |
| `controller/AdminAiController.java` | `POST /api/admin/ai/{action}` |
| `dto/AiDescribeItemRequest.java` | Request DTO for describe-item |
| `dto/AiQueryRequest.java` | Request DTO for analytics query |

### Frontend
| File | Purpose |
|---|---|
| `services/admin-ai.service.ts` | HTTP calls to `/api/admin/ai/*` |
| `admin/components/ai-chat/ai-chat.component.*` | Conversational analytics widget |
| `admin/components/review-digest/review-digest.component.*` | Review intelligence card |

### Modified Files
| File | Change |
|---|---|
| `admin/menu-item-form` (existing) | Add ✨ generate button |
| `admin/promotions` (existing) | Add AI suggestions card |
| `admin/dashboard` (existing) | Add review digest card + chat widget |
| `application.properties` | Add `anthropic.api-key` property |
| `application-prod.properties` | Read key from Railway env var |

---

## Configuration

```properties
# application.properties
anthropic.api-key=${ANTHROPIC_API_KEY:}
anthropic.model=claude-haiku-4-5-20251001
anthropic.max-tokens=1024
```

Railway env var: `ANTHROPIC_API_KEY` — set once, all four features use it.

---

## Phased Delivery

### Sprint 1 (2 days) — Highest value, lowest risk
1. `AdminAiService` skeleton + Anthropic HTTP client
2. Feature 1: Menu writing assistant (describe-item endpoint + ✨ button in editor)
3. Feature 3: Review digest (read-only, no side effects, fast to build)

### Sprint 2 (2 days)
4. Feature 2: Promotion optimizer (suggestions only — admin still clicks Apply)
5. Feature 4: Conversational analytics (start with 5 hardcoded intents)

### Sprint 3 (ongoing)
- Add more analytics intents based on what admins actually ask
- Cache layer for review digest
- Rate limiting on AI endpoints (max 20 calls/hour per tenant)

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Claude returns malformed JSON | Wrap all calls in try/catch, return graceful error; add `response_format: json` to API call |
| Prompt injection via review content | Sanitise review text before embedding in prompt; use system/user role separation |
| API key not set | `AdminAiService` checks for blank key on startup and logs a warning; endpoints return 503 with clear message |
| Cost creep | All endpoints are admin-only (`hasRole('ADMIN')`); rate-limit per tenant; use Haiku not Sonnet |
| Slow response (analytics) | Stream the response using SSE for the chat widget; show typing indicator |
