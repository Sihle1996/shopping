# Admin Intelligence Layer — AI Across All Admin Pages + Driver Map

## Context

The admin panel has isolated AI features (dashboard chat, menu description, promotions, reviews). This plan expands AI across every meaningful admin page and adds AI-powered intelligence to the live driver map. All features reuse the existing `AnthropicClient` + `AdminAiService` pattern. Rule-based fallbacks apply when Claude is unavailable.

---

## Feature Map

### 1. Inventory / Menu — Slow-Item Flagging + Restock Prediction

**Backend — new methods in `AdminAiService`:**

`flagSlowMovingItems(UUID tenantId)`:
- Query orders from last 30 days, find items with 0 or very low order count
- Items not sold in 14+ days flagged as slow-moving
- Claude prompt: given item name + days since last order + current stock, suggest action (discount / remove / bundle)
- Returns: `[{ itemId, name, daysSinceLastOrder, suggestion }]`

`predictRestock(UUID tenantId)`:
- Calculate daily order velocity per item from last 14 days
- Project days until stock hits `lowStockThreshold` at current rate
- Returns: `[{ itemId, name, currentStock, daysUntilLow, suggestedRestockQty }]`
- No Claude needed — pure maths, but Claude formats the alert message

**New endpoints in `AdminAiController`:**
- `GET /api/admin/ai/slow-items` → slow-moving items with suggestions
- `GET /api/admin/ai/restock-predictions` → items approaching low stock

**Frontend — `admin-menu.component`:**
- Add an "AI Insights" banner at top of menu page
- Shows: *"Veggie Wrap hasn't sold in 14 days — consider a discount"* and *"Smash Burger will hit low stock in ~3 days"*
- Clicking a slow-item suggestion opens the edit form pre-focused on price

---

### 2. Settings — Store Bio Writer + Delivery Optimiser

**Backend — new methods in `AdminAiService`:**

`writeStoreBio(String storeName, String cuisineType, String existingBio)`:
- Claude prompt: given store name + cuisine, write a compelling 2-sentence bio for a food delivery app
- Returns: `{ bio: "..." }`

`suggestDeliverySettings(UUID tenantId)`:
- Pull order history: delivery addresses (lat/lng), peak hours from analytics
- Calculate: median delivery distance, most common order times
- Claude formats the recommendation: *"Most orders come from within 5km — consider tightening radius to 5km for faster delivery"*
- Returns: `{ suggestedRadiusKm, suggestedHours: [{day, open, close}], reasoning }`

**New endpoints:**
- `POST /api/admin/ai/store-bio` → generate bio
- `GET /api/admin/ai/delivery-suggestions` → delivery settings advice

**Frontend — `admin-settings.component`:**
- "✨ Write with AI" button next to the bio/description textarea
- "AI Suggest" button next to delivery radius and hours fields, shows suggestion with accept/dismiss

---

### 3. Orders — Anomaly Flagging + Smart Assignment + Daily Summary

**Backend — new methods in `AdminAiService`:**

`flagAnomalousOrders(UUID tenantId)`:
- Rules-based detection (no Claude needed):
  - High value: order total > 3× average order value
  - Duplicate: same user, same items, within 10 minutes
  - Suspicious address: delivery distance > 2× delivery radius
- Returns flagged orders with reason

`suggestDriverForOrder(UUID orderId, UUID tenantId)`:
- Get all AVAILABLE drivers with their current lat/lng
- Calculate haversine distance from each driver to order delivery address
- Score = `(1/distance) * (1 / activeOrderCount + 1)`
- Returns: top 3 drivers ranked by score with distance + estimated minutes

`getDailySummary(UUID tenantId)`:
- Pull today's orders: count, total revenue, avg value, delayed count, peak hour
- Claude formats into one natural sentence
- Returns: `{ summary: "Today: 12 orders, avg R145, 2 delayed, busiest at 7pm" }`

**New endpoints:**
- `GET /api/admin/ai/anomalous-orders` → flagged orders
- `GET /api/admin/orders/{id}/suggest-driver` → ranked driver suggestions
- `GET /api/admin/ai/daily-summary` → one-line day summary

**Frontend — `admin-orders.component`:**
- Orange flag icon on anomalous orders in the list with tooltip showing reason
- "Suggest Driver" button on each unassigned order → shows ranked driver list with distance
- Daily summary pill at top of orders page (loads on init)

---

### 4. Drivers — Demand Forecast + Performance Digest

**Backend — new methods in `AdminAiService`:**

`forecastDemand(UUID tenantId)`:
- Analyse order history by day-of-week + hour (last 4 weeks)
- Find top 3 upcoming high-demand windows in next 7 days
- Compare against current driver count
- Claude formats warning: *"Expect high demand Friday 6–9pm — you currently have 2 drivers"*
- Returns: `[{ dayOfWeek, hourRange, expectedOrders, currentDrivers, warning }]`

`getDriverPerformanceDigest(UUID tenantId)`:
- Per driver: avg delivery time, on-time %, order count (last 30 days)
- Flag drivers > 20% slower than average
- Claude writes 1-line summary per driver
- Returns: `[{ driverId, name, avgMinutes, onTimePct, orders, flag, summary }]`

**New endpoints:**
- `GET /api/admin/ai/demand-forecast` → upcoming demand warnings
- `GET /api/admin/ai/driver-performance` → per-driver digest

**Frontend — `admin-drivers.component`:**
- Demand forecast banner above driver list: *"⚠️ High demand expected Friday 6–9pm"*
- Performance table below map: each driver row shows avg time + on-time % + AI flag

---

### 5. Driver Map — AI Intelligence Overlay

**Backend — reuses `suggestDriverForOrder()` from Orders above**

`getZoneCoverage(UUID tenantId)`:
- Group pending/active orders by geohash cluster
- Find clusters with no AVAILABLE driver within 3km
- Returns: `[{ lat, lng, pendingOrders, nearestDriverDistanceKm }]` — uncovered zones

`getDriverETA(UUID driverId, UUID orderId)`:
- Current driver speed (from last WebSocket ping) + haversine distance remaining
- ETA = distance / avg speed, clamped to reasonable range
- Returns: `{ etaMinutes, distanceKm }`

**Frontend — `admin-driver-map.component`:**

- **Auto-assign button**: unassigned orders shown as blue pins on map; clicking a pin shows top 3 AI-suggested drivers highlighted in green with distance + ETA
- **Zone coverage overlay**: red circle overlay on map areas with pending orders but no nearby driver
- **ETA labels**: each active delivery pin shows *"~12 min"* based on driver speed + distance
- **Demand heatmap toggle**: button to show/hide a colour gradient overlay of order density by area (built from order lat/lng history, rendered as GeoJSON fill layer on Mapbox)
- **Route suggestion**: when a driver has 2+ orders, map draws the optimal delivery sequence as a polyline

---

### 6. Support — Auto-Draft + Urgency Classification + Pattern Detection

**Backend — new methods in `AdminAiService`:**

`classifyTicket(UUID ticketId)`:
- Claude reads subject + message → classifies as: REFUND | COMPLAINT | GENERAL | LATE_DELIVERY | WRONG_ORDER
- Also scores urgency 1–5
- Returns: `{ category, urgency, suggestedAction }`

`draftTicketReply(UUID ticketId)`:
- Fetch ticket + linked order details (items, status, delivery time)
- Claude writes a warm, professional reply addressing the specific complaint
- Returns: `{ draft: "Dear [name], ..." }`

`detectSupportPatterns(UUID tenantId)`:
- Aggregate last 30 days of tickets by category
- Flag if any category > 3 tickets in 7 days
- Claude writes the insight: *"3 complaints about cold food this week — possible packaging issue"*
- Returns: `[{ pattern, count, period, insight }]`

**New endpoints:**
- `POST /api/admin/ai/tickets/{id}/classify` → urgency + category
- `POST /api/admin/ai/tickets/{id}/draft-reply` → AI-written reply
- `GET /api/admin/ai/support-patterns` → weekly pattern digest

**Frontend — `admin-support.component`:**
- Each ticket shows urgency badge (colour-coded) + category tag auto-applied on load
- "✨ Draft Reply" button in ticket detail → inserts AI draft into the notes field for admin to edit before sending
- Pattern alert banner at top: *"⚠️ 3 cold food complaints this week"*

---

## Shared Infrastructure

All new backend methods go in `AdminAiService.java` — no new service files needed.
All new endpoints go in `AdminAiController.java` — no new controller files needed.
Driver scoring reuses `OrderService.haversineKm()`.
All features degrade gracefully to rule-based logic when Claude unavailable.

---

## Build Order (suggested)

1. Orders — daily summary + anomaly flags (highest visibility, pure data)
2. Driver map — auto-assign + ETA (reuses driver location data already in WebSocket)
3. Inventory — slow items + restock (reuses order + menu data already queried)
4. Support — classify + draft reply (highest admin time saving)
5. Settings — bio writer + delivery suggestions (nice to have)
6. Drivers — demand forecast + performance digest (depends on order history depth)

---

# Fix: Admin Dashboard Charts Not Displaying

## Context

ApexCharts renders blank because `apexcharts.css` is missing from the Angular build. The `NgApexchartsModule` is correctly imported and all three charts (sales trend, top products, peak hours) are wired to real data — they just have no CSS so the canvas elements have zero dimensions and are invisible.

## Fix

**File:** `c:\shopping\Frontend\angular.json`

Add one line to the `styles` array (before the existing leaflet entries):

```json
"styles": [
  "node_modules/apexcharts/dist/apexcharts.css",
  "node_modules/leaflet/dist/leaflet.css",
  ...
]
```

This must be added in **both** the `build` and `test` targets in angular.json.

## Verification

Run `ng serve`, open admin dashboard → all three charts should render: revenue area chart, top products bar chart, peak hours bar chart.

---

# Customer AI — Conversation Memory + Intelligent Ordering

## Context

The customer-facing AI (Order for me / Ask the menu) feels disconnected and robotic because:
1. Every chat message is sent to Claude in isolation — no history, so Claude can't build on the conversation
2. "Order for me" is one-shot — picks one item and stops, no meal building or follow-up
3. No user personalization — past orders are never passed to Claude

The fix is conversation memory: pass the full message history on every call so Claude can have a real back-and-forth. This single change makes the biggest difference.

---

## Files to Change

| File | Change |
|------|--------|
| `Backend/.../service/OrderAssistantService.java` | `chatAboutMenu()` accepts conversation history, passes it to Claude as multi-turn messages |
| `Backend/.../controller/IntelligenceController.java` | `POST /api/intelligence/chat` accepts `history` array in request body |
| `Frontend/.../services/order-assistant.service.ts` | `menuChat()` sends full `chatMessages` history |
| `Frontend/.../order-assistant/order-assistant.component.ts` | Pass `chatMessages` to `menuChat()` on every send |

---

## Step 1 — Backend: `chatAboutMenu()` with history

Change signature:
```java
public Map<String, Object> chatAboutMenu(String question, List<Map<String,String>> history, UUID tenantId)
```

Build Anthropic `messages` array from history + new question:
```java
List<Map<String,Object>> messages = new ArrayList<>();
// Add prior turns
for (Map<String,String> turn : history) {
    messages.add(Map.of("role", turn.get("role").equals("user") ? "user" : "assistant",
                        "content", turn.get("text")));
}
// Add current question
messages.add(Map.of("role", "user", "content", question));
```

Pass `messages` array to Anthropic API instead of a single user message. Add a `system` field to the API call with the menu context and personality prompt — this moves the menu data out of the user message and into the system role where it belongs.

Update `AnthropicClient` to accept an optional `systemPrompt` + `messages` list:
```java
public String callWithHistory(String systemPrompt, List<Map<String,Object>> messages, int tokens)
```

---

## Step 2 — Controller: accept history

```java
@PostMapping("/chat")
public ResponseEntity<Map<String, Object>> menuChat(@RequestBody Map<String, Object> body) {
    String question = (String) body.getOrDefault("question", "");
    List<Map<String,String>> history = (List<Map<String,String>>) body.getOrDefault("history", List.of());
    UUID tenantId = TenantContext.getCurrentTenantId();
    return ResponseEntity.ok(orderAssistantService.chatAboutMenu(question, history, tenantId));
}
```

---

## Step 3 — Frontend service: send history

```typescript
menuChat(question: string, history: ChatMessage[]): Observable<{ answer: string }> {
  const historyPayload = history.slice(0, -1).map(m => ({ role: m.role, text: m.text }));
  return this.http.post<{ answer: string }>(`${this.base}/chat`, { question, history: historyPayload });
}
```

Send all prior messages except the last one (which is the current question being sent).

---

## Step 4 — Component: pass history

```typescript
sendChat(): void {
  const q = this.chatInput.trim();
  if (!q || this.chatLoading) return;
  this.chatMessages.push({ role: 'user', text: q });
  this.chatInput = '';
  this.chatLoading = true;
  this.assistantService.menuChat(q, this.chatMessages).subscribe({ ... });
}
```

---

## Step 5 — AnthropicClient: add `callWithHistory()`

New method alongside existing `call()`:
```java
public String callWithHistory(String systemPrompt, List<Map<String,Object>> messages, int tokens) {
    if (!isConfigured()) return null;
    // Build request body with "system" field + "messages" array
    // Same HTTP call, same error handling, same 30s timeout
}
```

The existing `call()` stays unchanged — used by all other features.

---

## Verification

1. Open Ask the menu, ask "do you have burgers?"
2. Follow up with "are any of them spicy?" — Claude should reference the burger it mentioned, not start fresh
3. Ask "what's the cheapest one?" — Claude should know "one" refers to burgers from earlier context
4. Start a new session (close + reopen sheet) — history is cleared, Claude starts fresh

---

# AI-Assisted Menu Item Form

## Context

Adding a menu item requires filling 7 fields manually. AI currently only fills `description` and optionally `category`. The goal is to expand the single "Generate with AI" button so it fills **all** possible fields after the user types just the item name: description, category, price, stock, and lowStockThreshold. Fields the user has already filled are left untouched.

---

## Files to Change

| File | Change |
|------|--------|
| `Backend/.../dto/AiDescribeItemRequest.java` | Add `Integer stock`, `Integer lowStockThreshold` fields |
| `Backend/.../service/AdminAiService.java` | Expand `describeItem()` prompt + fallback to return price/stock/threshold |
| `Frontend/.../services/admin-ai.service.ts` | Add optional fields to both interfaces |
| `Frontend/.../admin-menu/admin-menu.component.ts` | Expand `generateWithAi()` + add `aiFilledFields` Set |
| `Frontend/.../admin-menu/admin-menu.component.html` | Add violet AI badge + ring on each auto-filled field |

---

## Step 1 — `AiDescribeItemRequest.java`

Add two optional fields (Java records allow null for reference types):

```java
public record AiDescribeItemRequest(
    String name,
    BigDecimal price,
    String category,
    Integer stock,                // new — null means not set
    Integer lowStockThreshold     // new — null means not set
) {}
```

Update controller call in `AdminAiController.java`:
```java
adminAiService.describeItem(req.name(), req.price(), req.category(),
                             req.stock(), req.lowStockThreshold())
```

---

## Step 2 — `AdminAiService.java` — `describeItem()`

**Method signature change:**
```java
public Map<String, Object> describeItem(String name, BigDecimal price, String category,
                                         Integer stock, Integer lowStockThreshold)
```

**New Claude prompt** — conditionally includes fields Claude should suggest:
```java
boolean needsPrice = (price == null || price.compareTo(BigDecimal.ZERO) == 0);
boolean needsStock = (stock == null || stock == 0);
boolean needsThreshold = (lowStockThreshold == null || lowStockThreshold == 5);

String prompt =
    "You are a menu setup assistant for a South African food delivery app (CraveIt).\n" +
    "Help a restaurant admin fill in missing fields for a new menu item.\n" +
    "Use realistic South African rand pricing and typical restaurant inventory levels.\n\n" +
    "Item name: \"" + name + "\"\n" +
    "Category: " + (category != null && !category.isBlank() ? "\"" + category + "\" (already set)" : "not set — suggest one") + "\n\n" +
    "Return JSON only, no markdown:\n{\n" +
    "  \"description\": \"<1-2 sentence appetising description, under 120 chars>\",\n" +
    "  \"tags\": [\"<tag>\"],\n" +
    "  \"suggestedCategory\": \"<category>\",\n" +
    (needsPrice     ? "  \"suggestedPrice\": <realistic ZAR number e.g. 89.00>,\n" : "") +
    (needsStock     ? "  \"suggestedStock\": <integer, typical opening stock e.g. 50>,\n" : "") +
    (needsThreshold ? "  \"suggestedLowStockThreshold\": <integer e.g. 10>\n" : "") +
    "}\nTags from: filling,comfort,healthy,light,premium,indulgent,quick,grilled,fried,spicy,sweet,vegan,value";
```

**Update `buildDescribeFallback()`** to accept + return price/stock/threshold when needed:
```java
private Map<String, Object> buildDescribeFallback(String name, BigDecimal price,
        String category, Integer stock, Integer lowStockThreshold) {
    // ... existing description/tags/category logic unchanged ...

    // New: rule-based price by category
    if (price == null || price.compareTo(BigDecimal.ZERO) == 0) {
        String cat = category != null ? category.toLowerCase() : "";
        double p = cat.contains("burger")||cat.contains("meal") ? 89 :
                   cat.contains("pizza") ? 119 :
                   cat.contains("drink")||cat.contains("juice") ? 29 :
                   cat.contains("side")||cat.contains("fries") ? 35 :
                   cat.contains("salad")||cat.contains("wrap") ? 79 : 69;
        result.put("suggestedPrice", p);
    }
    if (stock == null || stock == 0)           result.put("suggestedStock", 50);
    if (lowStockThreshold == null || lowStockThreshold == 5) result.put("suggestedLowStockThreshold", 10);
}
```

Update both call sites of `buildDescribeFallback()` to pass the new parameters.

---

## Step 3 — `admin-ai.service.ts`

```typescript
export interface AiDescribeItemRequest {
  name: string;
  price: number;
  category: string;
  stock?: number;
  lowStockThreshold?: number;
}

export interface AiDescribeItemResponse {
  description: string;
  tags: string[];
  suggestedCategory: string;
  suggestedPrice?: number;
  suggestedStock?: number;
  suggestedLowStockThreshold?: number;
}
```

---

## Step 4 — `admin-menu.component.ts`

Add property alongside `aiGenerating`:
```typescript
aiFilledFields: Set<string> = new Set();
```

Replace `generateWithAi()` body (lines 230–256):
```typescript
generateWithAi(): void {
  if (!this.formData.name?.trim()) {
    this.toastr.warning('Enter an item name first', 'AI Generate');
    return;
  }
  this.aiGenerating = true;
  this.aiFilledFields.clear();
  this.adminAiService.describeItem({
    name: this.formData.name,
    price: this.formData.price,
    category: this.formData.category,
    stock: this.formData.stock,
    lowStockThreshold: this.formData.lowStockThreshold
  }).subscribe({
    next: (res) => {
      this.aiGenerating = false;
      const filled: string[] = [];
      if (res.description) { this.formData.description = res.description; filled.push('description'); }
      if (res.suggestedCategory) {
        const match = this.categories.find(c => c.name.toLowerCase() === res.suggestedCategory.toLowerCase());
        if (match) { this.formData.category = match.name; filled.push('category'); }
      }
      if (res.suggestedPrice && this.formData.price === 0) { this.formData.price = res.suggestedPrice; filled.push('price'); }
      if (res.suggestedStock && this.formData.stock === 0) { this.formData.stock = res.suggestedStock; filled.push('stock'); }
      if (res.suggestedLowStockThreshold && this.formData.lowStockThreshold === 5) {
        this.formData.lowStockThreshold = res.suggestedLowStockThreshold; filled.push('lowStockThreshold');
      }
      this.aiFilledFields = new Set(filled);
      const labels: Record<string,string> = { description:'description', category:'category', price:'price', stock:'stock', lowStockThreshold:'low-stock alert' };
      this.toastr.success(`AI filled: ${filled.map(f => labels[f]).join(', ')}`, '✨ AI');
    },
    error: () => { this.aiGenerating = false; this.toastr.error('AI generation failed', 'AI Generate'); }
  });
}
```

Also add `this.aiFilledFields.clear()` inside `resetForm()`.

---

## Step 5 — `admin-menu.component.html`

On each AI-suggestible field, add:
1. A violet `AI` badge next to the label: `<span *ngIf="aiFilledFields.has('fieldName')" class="ml-1 text-[10px] font-bold text-violet-500 uppercase">AI</span>`
2. Conditional ring on the input: `[class.ring-2]="aiFilledFields.has('fieldName')" [class.ring-violet-400]="aiFilledFields.has('fieldName')"`

Apply to: `category` select, `price` input, `stock` input, `lowStockThreshold` input, `description` textarea.

Use violet to distinguish AI hints from the app's existing `ring-primary-400` focus style.

---

## Verification

1. Add a new menu item — type only the name, click "Generate with AI"
2. Expect: description filled, category selected, price set (non-zero), stock set to ~50, low-stock set to ~10
3. Violet "AI" labels appear on each auto-filled field
4. Set price manually to 50 before clicking Generate → price should NOT be overwritten
5. Category dropdown should show the AI-suggested value (case-insensitive match)
6. Click "Try Again" / reset form → all violet highlights disappear

---

# Intelligence Layer — Mood Engine, Smart Recommendations, Combos, "Order for Me"

## Context

The existing system is a solid multi-tenant food delivery platform (Spring Boot 3.4.3 + Angular 14+ + PostgreSQL). It currently supports browsing by category, price sorting, promotions, loyalty points, group carts, and favourites. The goal is to add an "intent-based intelligence layer" on top — starting rules-based (shippable in days), designed so each feature can be upgraded to ML/AI without rearchitecting. Year is 2035; AI-enhanced UX is table stakes, but the foundation must be rock-solid.

**Key architectural facts from codebase exploration:**
- `MenuItem`: id, name, description, price, category (plain string), isAvailable, stock — **no tags, no prep time per item, no nutritional data**
- `Tenant`: cuisineType, latitude/longitude, estimatedDeliveryMinutes (tenant-level only), deliveryRadiusKm
- `Order`: full history exists, haversine distance already in `OrderService.haversineKm()`
- `Promotion`: sophisticated scoring already in `PromotionService.findBestAutoAppliedPromo()`
- `Favourite`: exists (V22), `FavouriteRepository` already has `findByUser_IdAndTenant_Id()`
- `LoyaltyAccount`: per-user/per-tenant, balance + totalEarned
- **No user behavior tracking table** — must add
- **No item-level tags** — must add
- **No combo/bundle table** — must add

---

## Architecture Overview

```
[Angular Frontend]
   ├── IntentChips component           ← new
   ├── RecommendationService           ← new
   ├── ComboService                    ← new
   ├── OrderAssistantService           ← new
   └── existing: HomeComponent, CartService, MenuService

[Spring Boot Backend]
   ├── IntelligenceController          ← new (single controller, /api/intelligence/*)
   ├── RecommendationEngine            ← new (rules scorer, interface for future ML)
   ├── IntentProfileService            ← new (intent → filter criteria)
   ├── ComboService                    ← new
   ├── OrderAssistantService           ← new
   └── existing: MenuService, OrderService, PromotionService, LoyaltyService

[Database — new tables]
   ├── V24__item_tags.sql              ← tag system on menu_items
   ├── V25__intent_profiles.sql        ← intent config
   ├── V26__user_events.sql            ← behavior tracking (Phase 2)
   └── V27__combos.sql                 ← combo/bundle tables
```

The `RecommendationEngine` is defined as a Java interface so Phase 3 can swap the rules implementation for an ML model without touching controllers or services.

---

---

## Feature 1 — Mood / Intent Engine

### What it does
User taps an intent chip ("Broke", "Hungry", "Healthy"…) → backend translates it to a filter/score configuration → `GET /api/menu` returns items ranked for that intent.

### Schema — V24 & V25

**V24__item_tags.sql** — adds searchable tags to menu items:
```sql
CREATE TABLE IF NOT EXISTS item_tags (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tag          VARCHAR(64) NOT NULL,  -- e.g. 'comfort', 'healthy', 'premium', 'quick'
  UNIQUE(menu_item_id, tag)
);
CREATE INDEX idx_item_tags_tenant ON item_tags(tenant_id);
CREATE INDEX idx_item_tags_tag    ON item_tags(tag);
```

**V25__intent_profiles.sql** — seed intent configs (overridable per tenant later):
```sql
CREATE TABLE IF NOT EXISTS intent_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = global default
  intent_key      VARCHAR(32) NOT NULL,    -- 'HUNGRY', 'TIRED', 'BROKE', 'CELEBRATING', 'HEALTHY'
  label           VARCHAR(64) NOT NULL,    -- display: "I'm hungry"
  emoji           VARCHAR(8),             -- "🍔"
  max_price_rand  NUMERIC(10,2),          -- NULL = no cap
  preferred_tags  TEXT[],                 -- e.g. ARRAY['filling','comfort']
  excluded_tags   TEXT[],                 -- e.g. ARRAY['premium']
  preferred_categories TEXT[],            -- e.g. ARRAY['Burgers','Pizza']
  sort_by         VARCHAR(32) DEFAULT 'SCORE', -- SCORE | PRICE_ASC | PRICE_DESC
  boost_promotions BOOLEAN DEFAULT TRUE,
  UNIQUE(COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), intent_key)
);

-- Global seed data
INSERT INTO intent_profiles (intent_key, label, emoji, max_price_rand, preferred_tags, excluded_tags, preferred_categories, sort_by, boost_promotions) VALUES
('HUNGRY',      'I''m hungry',        '🍔', NULL,   ARRAY['filling','comfort'],        ARRAY[]::text[], ARRAY['Burgers','Pizza','Meals'],   'SCORE',     true),
('TIRED',       'Long day',           '😴', NULL,   ARRAY['comfort','quick'],           ARRAY[]::text[], ARRAY['Burgers','Pasta','Noodles'],  'SCORE',     true),
('BROKE',       'On a budget',        '💸', 80.00,  ARRAY['value'],                     ARRAY['premium'], ARRAY[]::text[],                   'PRICE_ASC', true),
('CELEBRATING', 'Celebrating!',       '🥳', NULL,   ARRAY['premium','indulgent'],       ARRAY['plain'],  ARRAY[]::text[],                   'SCORE',     false),
('HEALTHY',     'Eating clean',       '🥗', NULL,   ARRAY['healthy','vegan','grilled'], ARRAY['fried'],  ARRAY['Salads','Healthy','Wraps'],  'SCORE',     false);
```

### Java Entities

**`Backend/.../entity/IntentProfile.java`** (new):
```java
@Entity @Table(name = "intent_profiles")
public class IntentProfile {
    @Id UUID id;
    @ManyToOne(fetch = LAZY) Tenant tenant; // nullable = global
    String intentKey;
    String label;
    String emoji;
    BigDecimal maxPriceRand;
    @Type(StringArrayType.class) String[] preferredTags;
    @Type(StringArrayType.class) String[] excludedTags;
    @Type(StringArrayType.class) String[] preferredCategories;
    String sortBy;
    boolean boostPromotions;
}
```

**`Backend/.../entity/ItemTag.java`** (new):
```java
@Entity @Table(name = "item_tags")
public class ItemTag {
    @Id UUID id;
    @ManyToOne(fetch = LAZY) MenuItem menuItem;
    @ManyToOne(fetch = LAZY) Tenant tenant;
    String tag;
}
```

### API

**`GET /api/intelligence/intents`** — returns available intents for current tenant:
```json
[
  { "key": "HUNGRY", "label": "I'm hungry", "emoji": "🍔" },
  { "key": "BROKE",  "label": "On a budget", "emoji": "💸" }
]
```

**`GET /api/intelligence/by-intent?intent=BROKE&limit=20`** — returns ranked menu items:
```json
{
  "intent": "BROKE",
  "label": "On a budget",
  "items": [
    { "id": "...", "name": "Cheese Burger", "price": 65.00, "score": 0.91, "tags": ["value","filling"] }
  ]
}
```

**`POST /api/admin/menu/{id}/tags`** — admin adds tags to a menu item:
```json
{ "tags": ["filling", "comfort", "value"] }
```

### Backend Service — `IntentProfileService`
**`Backend/.../service/IntentProfileService.java`** (new):
```java
// Load intent config for tenant (falls back to global default if no tenant-override)
IntentProfile loadProfile(String intentKey, UUID tenantId)

// Filter + pre-score menu items for intent
List<ScoredItem> applyIntent(IntentProfile profile, List<MenuItem> items, Set<UUID> promotedItemIds)
// → filters by maxPrice, preferred/excluded tags, preferred categories
// → scores each item 0.0-1.0
// → sorts per profile.sortBy
```

**Scoring for intent (rules-based, Phase 1):**
```
score = 0.0
if item.category in profile.preferredCategories  → +0.30
if item has any preferredTag                     → +0.25 per matching tag (max 0.40)
if profile.boostPromotions and item has promo    → +0.20
if item.price < (maxPriceRand * 0.6)            → +0.10 (well under budget)
```

### Frontend

**New: `Frontend/.../services/intelligence.service.ts`**:
- `getIntents()` → `GET /api/intelligence/intents`
- `getByIntent(key, limit)` → `GET /api/intelligence/by-intent`

**Modified: `Frontend/.../pages/home/home.component.ts`**:
- Add `selectedIntent: string | null = null`
- When intent is selected: call `intelligenceService.getByIntent()`, replace `filteredMenuItems`
- When intent cleared: return to normal `applyFilters()`

**New: `Frontend/.../shared/components/intent-chips/intent-chips.component.ts/html`**:
- Horizontal scroll row of pill buttons above category chips
- Active pill highlighted with tenant's `primaryColor`
- Emits `intentSelected(key)` and `intentCleared()` events

---

---

## Feature 2 — Smart Recommendation Engine

### Design Principle
A Java `RecommendationEngine` interface is the critical architectural decision. Phase 1 implements it as a rules scorer. Phase 3 replaces it with an ML model. No controller or service changes needed when upgrading.

```java
// Backend/.../intelligence/RecommendationEngine.java
public interface RecommendationEngine {
    List<ScoredItem> rank(RecommendationContext ctx, List<MenuItem> candidates);
}

// Phase 1 implementation:
@Service @Primary
public class RulesRecommendationEngine implements RecommendationEngine { ... }

// Phase 3 replacement:
@Service @Primary  // override Phase 1
public class MLRecommendationEngine implements RecommendationEngine { ... }
```

### Phase 1 — Rules-Based Scoring

**`RecommendationContext`** (what the engine receives):
```java
public record RecommendationContext(
    UUID userId,            // null for guests
    UUID tenantId,
    Double userLat,         // user's current location
    Double userLon,
    Double budgetRand,      // optional price cap
    Integer hourOfDay,      // 0-23, derived from server time (SAST)
    String weather,         // "RAINING" | "HOT" | "COLD" | null — from frontend
    Set<UUID> promotedItemIds,
    Set<UUID> favouriteItemIds,
    Set<String> recentCategories  // from order history, Phase 2
) {}
```

**Scoring Formula (0–100 points per item):**

| Signal | Max pts | Logic |
|--------|---------|-------|
| **Distance** | 30 | `30 × (1 - vendorDistKm / deliveryRadiusKm)` — closer = higher |
| **Price fit** | 25 | If budget set: `25 × (1 - price/budget)`, clamped 0-25. If no budget: 15 flat. |
| **Time of day** | 20 | Breakfast (6-10): boosts Breakfast category +20. Lunch (11-14): Meals +20. Dinner (18-22): Comfort +20. Late night (22-2): Quick/Snacks +20. |
| **Promotion** | 15 | Item has active promotion: +15. |
| **Weather** | 10 | RAINING: boost Soups, Comfort +10. HOT: boost Cold Drinks, Ice Cream +10. |
| **Favourite** | Bonus | User has favourited this item: +8 (not in max, additive). |

**Total = sum of applicable signals. Sort descending. Tie-break: alphabetical name.**

**`GET /api/intelligence/recommendations?lat=X&lon=Y&budget=150&weather=RAINING&limit=10`**

Response:
```json
{
  "context": { "budget": 150, "weather": "RAINING", "hourOfDay": 19 },
  "items": [
    {
      "id": "...", "name": "Tomato Soup", "price": 65.00,
      "score": 87, "scoreBreakdown": { "distance": 28, "price": 22, "timeOfDay": 20, "weather": 10, "promotion": 7 },
      "vendor": { "name": "Spicy Kitchen", "distanceKm": 1.2, "estimatedMinutes": 25 }
    }
  ]
}
```

**Reuses existing:**
- `OrderService.haversineKm()` — distance calculation
- `PromotionService.getActivePromotions()` — promoted item IDs
- `FavouriteRepository.findByUser_IdAndTenant_Id()` — favourite item IDs
- `AnalyticsService` structure for top products

### Phase 2 — Behavior Tracking (design now, implement later)

**V26__user_events.sql** (create now, populate in Phase 2):
```sql
CREATE TABLE IF NOT EXISTS user_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES _user(id) ON DELETE SET NULL,
  session_id  VARCHAR(64) NOT NULL,    -- for guest tracking
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type  VARCHAR(32) NOT NULL,    -- VIEW | CLICK | ADD_TO_CART | ORDER | SKIP
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  context_json JSONB,                  -- intent used, filters active, position in list
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_user_events_user    ON user_events(user_id);
CREATE INDEX idx_user_events_tenant  ON user_events(tenant_id, created_at DESC);
CREATE INDEX idx_user_events_item    ON user_events(menu_item_id);
```

Phase 2 upgrade: `RulesRecommendationEngine` gains `recentCategories` from querying `user_events WHERE event_type='ORDER' AND user_id=? ORDER BY created_at DESC LIMIT 20`. Adds recency boost signal.

Phase 3 upgrade: Replace with `MLRecommendationEngine` that calls an external model API (Claude, Vertex AI, or local TensorFlow Serving). Same interface, no controller changes.

### Frontend

**`Frontend/.../services/recommendation.service.ts`** (new):
- `getRecommendations(context: RecommendationContext)` → `GET /api/intelligence/recommendations`
- `trackEvent(type, menuItemId, contextJson)` → `POST /api/intelligence/events` (Phase 2)

**Modified: `Frontend/.../pages/home/home.component.ts`**:
- Load recommendations on init alongside promotions
- Show "Recommended for you" horizontal scroll section above category grid
- Pass `weather` from browser's Geolocation + Open-Meteo free API (Phase 2)

---

---

## Feature 3 — Smart Combos

### Schema — V27

```sql
-- V27__combos.sql
CREATE TABLE IF NOT EXISTS combos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(128) NOT NULL,
  description   TEXT,
  combo_price   NUMERIC(10,2) NOT NULL,   -- discounted bundle price
  original_price NUMERIC(10,2) NOT NULL,  -- sum of individual prices
  source        VARCHAR(16) NOT NULL DEFAULT 'VENDOR',  -- VENDOR | SYSTEM
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  image_url     VARCHAR(1024),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS combo_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id   UUID NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  role       VARCHAR(16) NOT NULL DEFAULT 'MAIN',  -- MAIN | DRINK | SIDE | DESSERT
  quantity   INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_combos_tenant ON combos(tenant_id, active);
```

### Java Entities

**`Backend/.../entity/Combo.java`** (new):
```java
@Entity @Table(name = "combos")
public class Combo {
    @Id UUID id;
    @ManyToOne(fetch = LAZY) Tenant tenant;
    String name;
    String description;
    BigDecimal comboPrice;
    BigDecimal originalPrice;
    String source; // "VENDOR" | "SYSTEM"
    boolean active;
    String imageUrl;
    @OneToMany(cascade = ALL, orphanRemoval = true, fetch = EAGER)
    List<ComboItem> items;
    Instant createdAt;
}
```

**`Backend/.../entity/ComboItem.java`** (new):
```java
@Entity @Table(name = "combo_items")
public class ComboItem {
    @Id UUID id;
    @ManyToOne(fetch = LAZY) Combo combo;
    @ManyToOne(fetch = LAZY) MenuItem menuItem;
    String role; // MAIN | DRINK | SIDE | DESSERT
    int quantity;
}
```

### Dynamic Combo Generation Logic

**`Backend/.../service/ComboGeneratorService.java`** (new):

System-generated combos are computed on demand (not stored permanently — stored with `source='SYSTEM'`, refreshed nightly):

```java
// Algorithm:
// 1. Group all available menu items by role-category mapping:
//    MAIN:  category in ['Burgers','Pizza','Meals','Pasta','Wraps']
//    DRINK: category in ['Drinks','Cold Drinks','Juices']
//    SIDE:  category in ['Sides','Fries','Salads']
//
// 2. For each MAIN item, find matching DRINK + SIDE candidates
//
// 3. Combo price = sum(item prices) * COMBO_DISCOUNT_FACTOR (default 0.90 = 10% off)
//    → round to nearest R5 for clean pricing
//
// 4. Rank by: vendor margin (combo_price / cost approximation),
//    then by: item popularity (order count in last 30 days via OrderRepository.findTopProducts())
//
// 5. Persist top N (default 5) system combos per tenant with source='SYSTEM'
```

**Role-category mapping** is tenant-configurable via `intent_profiles` (re-use same table with a new `COMBO_ROLES` intent_key, or store inline).

### APIs

**`GET /api/intelligence/combos?itemId={menuItemId}`** — "goes well with" combos for a specific item:
```json
[
  {
    "id": "...", "name": "Burger Meal Deal", "source": "SYSTEM",
    "comboPrice": 135.00, "originalPrice": 152.00, "savings": 17.00,
    "items": [
      { "role": "MAIN",  "name": "Smash Burger", "price": 110.00 },
      { "role": "SIDE",  "name": "Fries",         "price": 30.00 },
      { "role": "DRINK", "name": "Coke",           "price": 22.00 }
    ]
  }
]
```

**`GET /api/intelligence/combos`** — all active combos for tenant (browse combos page).

**`POST /api/cart/add-combo`** — adds all combo items to cart in one call:
```json
{ "comboId": "...", "itemNotes": null }
```
Backend iterates `combo.items`, calls `CartService.addItemToCart()` for each. Returns updated cart.

**Admin APIs:**
- `GET /api/admin/combos` — list all combos
- `POST /api/admin/combos` — create vendor-defined combo
- `DELETE /api/admin/combos/{id}` — remove combo
- `POST /api/admin/combos/regenerate` — trigger system combo regeneration

### Frontend

**`Frontend/.../services/combo.service.ts`** (new):
- `getCombosForItem(itemId)` → `GET /api/intelligence/combos?itemId=`
- `getAllCombos()` → `GET /api/intelligence/combos`
- `addComboToCart(comboId)` → `POST /api/cart/add-combo`

**Modified: `Frontend/.../pages/home/home.component.ts`**:
- Show "Meal Deals" section if combos exist — horizontal scroll of combo cards
- Each combo card shows: image, name, item count, crossed-out original price, combo price, savings badge

**Modified: `Frontend/.../shared/product-card/product-card.component.html`**:
- Add "Add as Meal" button beneath the main + button when item has combos
- Triggers `comboService.getCombosForItem()` → show small overlay with combo options

**Modified: `Frontend/.../pages/cart/cart.component.ts`**:
- After cart loads, call `comboService.getAllCombos()` to check for upsell
- Show "Complete your meal?" banner if cart has a MAIN-role item with available combo but no DRINK/SIDE

---

---

## Feature 4 — "Order for Me" Assistant

### Design
Rule-based NLP today (simple keyword extraction), identical API contract that an LLM can fulfil in Phase 3 by replacing the parser only.

**Parsing approach (Phase 1):**
```
Input: "something cheap and filling for 2 people"

Step 1 — quantity extraction:
  "for 2 people" → servings = 2
  "for me" | no mention → servings = 1

Step 2 — budget extraction:
  "cheap" | "budget" | "broke" → maxPricePerPerson = R80
  "under R100" → maxPricePerPerson = R100
  "splurge" | "treat" → maxPricePerPerson = unlimited, boostPremium = true

Step 3 — preference extraction:
  "filling" | "big" | "hungry" → tags += ['filling','comfort'], boostCalorie = true
  "healthy" | "light" → tags += ['healthy','grilled']
  "quick" | "fast" → boostPrepTime = true
  "spicy" → tags += ['spicy']

Step 4 → build RecommendationContext from extracted values → run RecommendationEngine
Step 5 → multiply servings → return suggested order
```

### API

**`POST /api/intelligence/order-for-me`**
```json
// Request:
{
  "prompt": "something cheap and filling for 2 people",
  "lat": -26.2041,
  "lon": 28.0473
}

// Response:
{
  "interpretation": {
    "servings": 2,
    "budgetPerPerson": 80.00,
    "totalBudget": 160.00,
    "tags": ["filling", "comfort"],
    "confidence": 0.82
  },
  "suggestion": {
    "mode": "SINGLE_ITEM",      // SINGLE_ITEM | COMBO | MULTI_ITEM
    "items": [
      {
        "menuItemId": "...",
        "name": "Smash Burger",
        "quantity": 2,
        "unitPrice": 65.00,
        "totalPrice": 130.00
      }
    ],
    "totalEstimate": 130.00,
    "message": "2× Smash Burgers — filling, affordable, ready in ~25 min"
  },
  "alternatives": [...]     // 2 backup suggestions
}
```

**`POST /api/intelligence/order-for-me/confirm`** — user confirms suggestion:
```json
{ "suggestionToken": "...", "confirmed": true }
```
Backend adds all suggested items to the user's cart and returns the updated cart. Uses existing `CartService.addItemToCart()`.

### Backend

**`Backend/.../service/OrderAssistantService.java`** (new):
```java
public AssistantResponse interpret(String prompt, UUID tenantId, UUID userId, Double lat, Double lon) {
    InterpretedIntent intent = intentParser.parse(prompt);  // keyword extraction
    RecommendationContext ctx = buildContext(intent, tenantId, userId, lat, lon);
    List<ScoredItem> ranked = recommendationEngine.rank(ctx, getAllAvailableItems(tenantId));
    return buildSuggestion(intent, ranked);
}
```

**`Backend/.../service/IntentParser.java`** (new, ~80 lines of keyword logic):
- Interface: `InterpretedIntent parse(String prompt)`
- Phase 1: simple keyword maps (HashMap<String, Consumer<InterpretedIntent>>)
- Phase 3: replace with `ClaudeIntentParser` that calls Claude API with structured output

**Suggestion token**: short-lived UUID stored in a `ConcurrentHashMap<String, SuggestedOrder>` (TTL 10 minutes, no DB needed). When confirmed, items added to cart.

### Frontend

**New: `Frontend/.../shared/components/order-assistant/order-assistant.component.ts/html/scss`**:

UX: Floating pill button "✨ Order for me" visible on home page when logged in.

Click → slides up a bottom sheet with:
1. Text input: `"What are you in the mood for?"` with placeholder examples
2. Quick chips: "🍔 Something filling", "💸 Keep it cheap", "🥗 Eating healthy", "🎉 Treat myself"
3. "Find my order →" CTA

After submit:
- Shows interpretation: "I understood: 2 people, budget R160, filling food"
- Shows suggestion card(s): item name, price, quantity
- Two buttons: "✅ Add to cart" / "🔄 Try again"

Chips map to pre-baked prompts so users don't need to type at all — the AI-feeling UX works even with zero actual AI.

**`Frontend/.../services/order-assistant.service.ts`** (new):
- `interpret(prompt, lat, lon)` → `POST /api/intelligence/order-for-me`
- `confirm(token)` → `POST /api/intelligence/order-for-me/confirm`

---

---

## Database Migration Files

| Version | File | Purpose |
|---|---|---|
| V24 | `V24__item_tags.sql` | item_tags table (tags on menu items) |
| V25 | `V25__intent_profiles.sql` | intent_profiles table + seed data |
| V26 | `V26__user_events.sql` | user_events behavior tracking |
| V27 | `V27__combos.sql` | combos + combo_items tables |

---

## Complete File List

### New Backend Files
| File | Purpose |
|---|---|
| `entity/IntentProfile.java` | Intent config entity |
| `entity/ItemTag.java` | Tag-to-menu-item entity |
| `entity/Combo.java` | Combo bundle entity |
| `entity/ComboItem.java` | Combo item line entity |
| `repository/IntentProfileRepository.java` | `findByIntentKeyAndTenant_Id`, `findByIntentKeyAndTenantIsNull` |
| `repository/ItemTagRepository.java` | `findByMenuItem_Id`, `findByTenant_IdAndTag` |
| `repository/ComboRepository.java` | `findByTenant_IdAndActiveTrue`, `findByItemsContaining` |
| `repository/UserEventRepository.java` | `findTopByUserIdOrderByCreatedAtDesc` |
| `intelligence/RecommendationEngine.java` | Interface |
| `intelligence/RulesRecommendationEngine.java` | Phase 1 rules implementation |
| `intelligence/RecommendationContext.java` | Input record |
| `intelligence/ScoredItem.java` | Output record (item + score + breakdown) |
| `service/IntentProfileService.java` | Load + apply intent |
| `service/IntentParser.java` | Keyword parser for "Order for Me" |
| `service/ComboGeneratorService.java` | System combo generation logic |
| `service/OrderAssistantService.java` | "Order for Me" orchestration |
| `controller/IntelligenceController.java` | All `/api/intelligence/*` endpoints |
| `controller/AdminComboController.java` | Admin combo CRUD |
| `db/migration/V24__item_tags.sql` | New |
| `db/migration/V25__intent_profiles.sql` | New |
| `db/migration/V26__user_events.sql` | New |
| `db/migration/V27__combos.sql` | New |

### Modified Backend Files
| File | Change |
|---|---|
| `controller/CartController.java` | Add `POST /api/cart/add-combo` endpoint |
| `service/CartService.java` | Add `addComboToCart(UUID comboId, UUID userId)` |
| `controller/AdminMenuController.java` | Add `POST /api/admin/menu/{id}/tags` endpoint |

### New Frontend Files
| File | Purpose |
|---|---|
| `services/intelligence.service.ts` | Intents + recommendations API |
| `services/combo.service.ts` | Combos API |
| `services/order-assistant.service.ts` | "Order for Me" API |
| `shared/components/intent-chips/intent-chips.component.*` | Intent pill row |
| `shared/components/order-assistant/order-assistant.component.*` | Floating assistant UI |

### Modified Frontend Files
| File | Change |
|---|---|
| `pages/home/home.component.ts/html` | Intent selection, recommendations section, combos section, assistant button |
| `shared/components/product-card/product-card.component.html` | "Add as Meal" button |
| `pages/cart/cart.component.ts/html` | Combo upsell banner |
| `app.module.ts` | Declare new components |

---

## Phased Rollout

### MVP (2–3 days)
1. Migrate V24–V27 (safe `CREATE TABLE IF NOT EXISTS` — no existing table changes)
2. Build `IntelligenceController` with intent + recommendation endpoints (rules scorer only)
3. Seed intent profiles (V25 data)
4. Build `IntentChips` frontend component + wire into `HomeComponent`
5. Add "Recommended for you" row using rules scoring (no ML)
6. Tags admin endpoint (so tenant can start tagging items)

**Shippable value**: Users can tap "I'm broke" and see budget items ranked properly.

### Phase 2 (1 week)
1. Activate `user_events` tracking (frontend fires events on VIEW, CLICK, ADD_TO_CART)
2. Upgrade `RulesRecommendationEngine` to include recency signal from events
3. Build combo generator + persist system combos (nightly `@Scheduled`)
4. Build `ComboService` frontend + combo cards in home + "Add as Meal" in product card
5. Cart upsell banner ("Complete your meal?")
6. "Order for Me" assistant — backend parser + frontend bottom sheet

**Shippable value**: Meal deals, personalized ordering UX, assistant.

### Phase 3 (future)
1. Swap `IntentParser` with `ClaudeIntentParser` (Claude API, structured JSON output)
2. Swap `RulesRecommendationEngine` with `MLRecommendationEngine` (calls trained ranking model or Claude with user history context)
3. Per-tenant intent profile overrides (tenant admin can customize intent chips)
4. Weather signal via browser Geolocation + Open-Meteo API
5. A/B testing framework for recommendation strategies (use `user_events` as ground truth)

---

## Verification

| Feature | Test |
|---|---|
| Intents | `GET /api/intelligence/intents` → 5 defaults returned; tap "Broke" chip → items filtered to ≤R80, sorted price ASC |
| Recommendations | `GET /api/intelligence/recommendations?budget=100&weather=RAINING` → soup/comfort foods score higher |
| Tags | Admin POSTs tags to item → `GET /api/intelligence/by-intent?intent=HEALTHY` includes that item |
| Combos | Admin creates combo → appears on home; system combo generator runs → `source=SYSTEM` combos created |
| Add Combo to Cart | `POST /api/cart/add-combo` → all 3 items appear in cart as separate CartItems |
| Order for Me | POST "cheap filling for 2" → interpretation returns servings=2, budget=80, tag=filling; confirm → 2 items added to cart |
| Phase 2 events | Click item → `user_events` row with `event_type=CLICK` persisted |

---

# Production Readiness — Missing Critical Features

Items not yet built, derived from platform review. Build these before public launch.

---

## 1. Auto-Reject Timer (Order Timeout)

If a restaurant doesn't accept an order within 5 minutes, automatically cancel it, trigger a PayFast refund, and send the customer a Resend notification email.

**Backend:**
- `@Scheduled` job runs every 60 seconds
- Query: `orders WHERE status = 'PENDING' AND created_at < NOW() - INTERVAL '5 minutes'`
- For each: set `status = 'CANCELLED'`, trigger PayFast refund API call, send "Order cancelled — restaurant did not respond" email via Resend
- Log cancellation reason: `AUTO_REJECTED_TIMEOUT`

**Frontend (admin):**
- Countdown timer on pending orders in admin orders list (5:00 → 0:00)
- Order auto-removes from list when timer expires

---

## 2. Pre-Checkout Inventory Sanity Check

Re-verify stock for every cart item immediately after the user clicks "Pay" but before redirecting to PayFast. Catches race conditions where stock depletes between "Add to Cart" and checkout.

**Backend — in `CheckoutService` or `OrderService`, before PayFast redirect:**
```java
// For each cart item:
MenuItem item = menuItemRepository.findById(cartItem.getMenuItemId());
if (!item.isAvailable() || item.getStock() < cartItem.getQuantity()) {
    throw new InsufficientStockException(item.getName());
}
```

Return HTTP 409 Conflict with item name. Frontend shows "Sorry, [item] just sold out — please update your cart."

---

## 3. Payout Reconciliation Ledger

Track all money movements per restaurant so payouts are auditable and disputable.

**Database — new migration:**
```sql
CREATE TABLE payout_ledger (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  order_id      UUID REFERENCES orders(id),
  entry_type    VARCHAR(16) NOT NULL,  -- CREDIT | DEBIT | PAYOUT | FEE | REFUND
  amount_rand   NUMERIC(10,2) NOT NULL,
  balance_after NUMERIC(10,2) NOT NULL,
  description   VARCHAR(256),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ledger_tenant ON payout_ledger(tenant_id, created_at DESC);
```

**Logic:**
- On order DELIVERED: `CREDIT` entry (order total minus platform fee %)
- On refund: `DEBIT` entry
- On weekly payout: `PAYOUT` entry (batch EFT via Stitch or Peach Payments)
- Platform fee: `FEE` entry per order

**Admin endpoint:** `GET /api/admin/payouts/ledger` → paginated ledger with running balance  
**SuperAdmin endpoint:** `GET /api/superadmin/payouts` → all tenants, pending payout totals

---

## 4. Automated Payout Split

Weekly batch EFT to restaurant bank accounts. Use **Stitch** (ZA-native, lower fees) or **Peach Payments Marketplace** as the payout provider.

**Integration points:**
- Each tenant stores `bankAccountNumber`, `bankName`, `accountHolder` (encrypted at rest)
- `@Scheduled` weekly job: sum `CREDIT` entries minus `DEBIT` entries since last `PAYOUT` entry
- Call Stitch Disbursements API (or Peach batch transfer) with amount + account details
- Record `PAYOUT` entry in ledger on success; flag as `PAYOUT_FAILED` on error + alert SuperAdmin

---

## 5. Support Ticket Routing

**Currently built:** basic support ticket submission. **Missing:** routing logic (who handles what), escalation, internal notes, and ticket type classification.

**Database — add columns to `support_tickets` table:**
```sql
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS ticket_type VARCHAR(32) DEFAULT 'GENERAL';
-- REFUND | COMPLAINT | LATE_DELIVERY | WRONG_ORDER | GENERAL | DRIVER_ISSUE
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS current_handler VARCHAR(16) DEFAULT 'STORE_ADMIN';
-- STORE_ADMIN | SUPER_ADMIN
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS creator_role VARCHAR(16) DEFAULT 'CUSTOMER';
-- CUSTOMER | STORE_ADMIN
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;
```

**Routing rules:**
- New ticket from customer → assigned to `STORE_ADMIN` of that tenant
- If StoreAdmin can't resolve in 48h OR ticket_type = `REFUND` → escalate to `SUPER_ADMIN`
- Driver complaints always go to `SUPER_ADMIN`

**Frontend:**
- StoreAdmin support page: shows only their tickets, can add `internal_notes`, can escalate
- SuperAdmin support page: shows escalated tickets + all `REFUND` tickets

---

## 6. OTP Security Fix

**Problem:** Driver can see the delivery OTP in the driver interface before the customer shows it, enabling fraudulent "Force Deliver" without customer consent.

**Fix:**
- Remove OTP display from driver view entirely — driver should only see a confirmation field
- Driver types in the OTP the customer reads aloud
- Backend validates: if OTP matches, mark as DELIVERED

**SuperAdmin override "Force Deliver":**
- SuperAdmin endpoint: `POST /api/superadmin/orders/{id}/force-deliver` with reason field
- Records: `deliveredBy = 'ADMIN_OVERRIDE'`, `forceDeliverReason`, `forceDeliveredBy` (admin user ID)
- For cases where customer is unreachable / OTP lost

---

## 7. Store Heartbeat / Auto-Offline

Detect when a store's admin app is closed or offline and automatically flip the store to "Temporarily Offline" so customers don't place orders into a void.

**Backend:**
- New endpoint: `POST /api/admin/heartbeat` — updates `tenant.lastHeartbeatAt = NOW()`
- `@Scheduled` job every 60s: query tenants where `isOpen = true AND lastHeartbeatAt < NOW() - INTERVAL '3 minutes'`
- For each: set `isOpen = false`, `autoOfflineReason = 'HEARTBEAT_TIMEOUT'`
- When admin app reconnects and sends heartbeat: auto-flip back to online + notify admin

**Frontend (admin):**
- `setInterval` every 60s calls `POST /api/admin/heartbeat` silently
- On page visibility change to visible: send immediate heartbeat
- Small status indicator in admin navbar: green dot = online, amber = heartbeat warning

---

## 8. Service Workers (Offline Capability)

Cache the core UI shell and queue driver location pings during connectivity gaps.

**Implementation:**
- Angular Service Worker (`@angular/service-worker`) — add to `app.module.ts` + `ngsw-config.json`
- Cache strategy: `freshness` for API calls, `performance` for static assets
- Background sync: driver location coordinates queued in IndexedDB when offline, flushed when connection restored
- Offline page: show cached menu (read-only) with "You're offline — ordering paused" banner

**`ngsw-config.json` (key entries):**
```json
{
  "dataGroups": [{
    "name": "api-freshness",
    "urls": ["/api/menu", "/api/store"],
    "cacheConfig": { "strategy": "freshness", "maxAge": "1h", "timeout": "10s" }
  }]
}
```

---

## 9. Thermal Receipt Printing

Allow kitchen/restaurant staff to print orders without a POS system using any thermal printer connected via browser print dialog.

**Implementation:**
- Add `print-receipt.css` stylesheet: narrow width (80mm), monospace font, large item names, dashed dividers
- "Print" button on each order detail in admin orders page
- `window.print()` triggered via Angular — browser opens print dialog with thermal-optimized layout
- Receipt layout: store name, order #, timestamp, items + quantities + prices, total, delivery address, customer name

**No backend changes needed** — purely a frontend CSS + print trigger.

---

## 10. SMS / WhatsApp High-Urgency Notifications

For critical time-sensitive alerts that can't rely on email (driver assigned, order ready, OTP).

**Provider:** **BulkSMS SA** (local, cheap, POPIA-compliant) or **Twilio** (global, WhatsApp Business API support).

**Trigger points:**
- Customer: order confirmed (SMS), driver assigned + ETA (SMS), order out for delivery (WhatsApp if available)
- Driver: new order assigned (SMS with address), customer OTP reminder if unresponsive
- Restaurant: new order received (SMS as backup to push notification)

**Backend:**
- `SmsService.java` — wraps BulkSMS REST API
- `send(String to, String message)` — single method, fire-and-forget (async `@Async`)
- Called from `OrderService` at state transitions

---

## 11. Cloudinary Security for Compliance Documents

Restaurant verification documents (ID, business registration) must NOT be publicly accessible via Cloudinary URL.

**Current risk:** documents uploaded with `upload_type = upload` (public) — anyone with the URL can access them.

**Fix:**
- Create a separate Cloudinary folder: `craveit/compliance/` with **authenticated** delivery type
- Upload compliance docs with `type: "authenticated"` in Cloudinary SDK call
- Store only the `public_id` in the DB, not the URL
- SuperAdmin viewing a document: backend generates a **signed URL** (30–60 second expiry) via Cloudinary Java SDK:
  ```java
  cloudinary.url().signed(true).expireAt(Instant.now().plusSeconds(60))
      .generate("craveit/compliance/" + publicId);
  ```
- Return the expiring URL in `GET /api/superadmin/tenants/{id}/documents` response
- Never store or log the signed URL

---

## 12. Partial Order Mutation ("Modify Order")

Restaurant marks a specific item as out-of-stock after the order is placed. Customer gets a live alert and can accept the modification or cancel for a full refund.

**Flow:**
1. Restaurant clicks "Item unavailable" on a specific line item in admin order detail
2. Backend: sets `orderItem.status = 'REMOVED'`, recalculates order total, pushes WebSocket event to customer
3. Customer sees: "Gasa Grills removed [item] — new total: R95. Accept or Cancel?"
4. If customer accepts: order proceeds with reduced total, difference refunded via PayFast partial refund API
5. If customer cancels: full order cancelled, full refund issued

**Backend changes:**
- `OrderItem` entity: add `status` column (`INCLUDED` / `REMOVED`)
- `PATCH /api/admin/orders/{id}/items/{itemId}/remove` → removes item, recalculates, broadcasts WebSocket
- `POST /api/orders/{id}/accept-modification` and `POST /api/orders/{id}/cancel-after-modification`

**Frontend (customer):**
- WebSocket listener on order status page catches `ORDER_MODIFIED` event
- Shows modal with modified item list + new total + accept/cancel buttons

---

## 13. POPIA Compliance + Legal Pages

Required for operating in South Africa under the Protection of Personal Information Act.

**Pages to add:**
- `/privacy` — Privacy Policy (data collected, retention, user rights, contact for deletion requests)
- `/terms` — Customer Terms & Conditions (ordering, refunds, delivery, liability)
- `/restaurant-terms` — Restaurant Partner Agreement (commission, payout terms, prohibited items, suspension policy)

**In-app requirements:**
- Registration checkbox: "I agree to the [Terms & Conditions] and [Privacy Policy]" (required, not pre-ticked)
- Restaurant onboarding: accept Restaurant Partner Agreement before going live
- Data deletion: `DELETE /api/user/account` endpoint — anonymises personal data, retains financial records for 5 years (SARS requirement)
- Cookie consent banner on landing page

---

## Build Priority

| Priority | Feature | Why |
|----------|---------|-----|
| P0 | Pre-checkout inventory check | Prevents overselling — blocks launch without it |
| P0 | OTP security fix | Active security vulnerability |
| P0 | POPIA + legal pages | Legal requirement for SA launch |
| P1 | Auto-reject timer | Bad UX without it — orders hang forever |
| P1 | Store heartbeat | Prevents orders going to closed stores |
| P1 | Support ticket routing | Needed once volume > 10 tickets/day |
| P2 | Payout ledger | Needed before first restaurant payout |
| P2 | Automated payout split | Manual payouts don't scale past 5 restaurants |
| P2 | Cloudinary compliance security | Before onboarding real restaurants with real IDs |
| P3 | Thermal printing | Nice-to-have for kitchen workflow |
| P3 | Service workers | Nice-to-have for driver reliability |
| P3 | SMS/WhatsApp notifications | Enhances reliability but email covers the basics |
| P3 | Partial order mutation | Complex — defer until order volume proves the need |
