package com.example.backend.service;

import com.example.backend.entity.AiActionLog;
import com.example.backend.entity.InventoryAdjustmentDTO;
import com.example.backend.entity.MenuItem;
import com.example.backend.entity.Order;
import com.example.backend.entity.OrderStatus;
import com.example.backend.entity.Review;
import com.example.backend.entity.SalesTrendDTO;
import com.example.backend.entity.TopProductDTO;
import com.example.backend.entity.Tenant;
import com.example.backend.model.Promotion;
import com.example.backend.repository.CategoryRepository;
import com.example.backend.repository.MenuItemRepository;
import com.example.backend.repository.OrderRepository;
import com.example.backend.repository.SupportTicketRepository;
import com.example.backend.repository.PromotionRepository;
import com.example.backend.repository.AiActionLogRepository;
import com.example.backend.repository.ReviewRepository;
import com.example.backend.repository.StoreHoursRepository;
import com.example.backend.repository.TenantRepository;
import com.example.backend.repository.UserRepository;
import com.example.backend.tenant.TenantContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.util.*;

/**
 * The agentic "Store Copilot". Instead of one fixed prompt, this gives Claude a
 * toolbox of read-only, tenant-scoped data tools and lets it decide what to look
 * up before answering the admin. Phase 1 = read-only (knows everything, changes
 * nothing).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AdminAgentService {

    private final AnthropicClient anthropicClient;
    private final AnalyticsService analyticsService;
    private final TenantRepository tenantRepository;
    private final OrderRepository orderRepository;
    private final MenuItemRepository menuItemRepository;
    private final CategoryRepository categoryRepository;
    private final ReviewRepository reviewRepository;
    private final PromotionRepository promotionRepository;
    private final StoreHoursRepository storeHoursRepository;
    private final UserRepository userRepository;
    private final InventoryService inventoryService;
    private final PayoutLedgerService payoutLedgerService;
    private final AdminDriverService adminDriverService;
    private final SubscriptionEnforcementService subscriptionEnforcementService;
    private final AiActionLogRepository aiActionLogRepository;
    private final BookkeepingService bookkeepingService;
    private final CapabilityRegistry capabilityRegistry;
    private final OrderService orderService;
    private final SupportTicketRepository supportTicketRepository;
    private final ObjectMapper objectMapper;

    /** Copilot reply plus any actions it proposed (the UI shows confirm cards). */
    public record AgentResult(String answer, List<Map<String, Object>> proposedActions) {}

    private static final ZoneId SAST = ZoneId.of("Africa/Johannesburg");

    public AgentResult chat(String question) {
        return chat(question, null);
    }

    /**
     * Returns the copilot's answer + proposed actions, or null if AI is unavailable.
     * {@code history} are the prior chat turns (each a map with role user/ai and
     * text) so the copilot has short-term memory and can handle follow-ups.
     */
    @Transactional(readOnly = true)
    public AgentResult chat(String question, List<?> history) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null || !anthropicClient.isConfigured()) return null;
        Tenant tenant = tenantRepository.findById(tenantId).orElse(null);
        String system = buildSystemPrompt(tenant);
        List<Map<String, Object>> proposals = new ArrayList<>();
        String answer = anthropicClient.runAgent(
                system, question, buildHistory(history), buildTools(),
                (name, input) -> executeTool(tenantId, name, input, proposals),
                8, 1500);
        if (answer == null) return null;
        return new AgentResult(sanitiseNarration(answer), proposals);
    }

    /**
     * No-causality contract (system-level, not just a prompt): neutralise the
     * specific predictive/marketing phrases that imply a guaranteed outcome the
     * system cannot actually predict. A blunt safety net so narration can't
     * regress into "this will boost sales" even if a prompt slips.
     */
    static String sanitiseNarration(String text) {
        if (text == null || text.isBlank()) return text;
        return text
                .replaceAll("(?i)\\bwill\\s+drive\\b", "may be associated with")
                .replaceAll("(?i)\\bwill\\s+boost\\b", "may be associated with higher")
                .replaceAll("(?i)\\bwill\\s+increase\\b", "may be associated with higher")
                .replaceAll("(?i)\\bdrives\\s+sales\\b", "is associated with sales")
                .replaceAll("(?i)\\bboosts\\s+revenue\\b", "is associated with revenue")
                .replaceAll("(?i)\\bcaptures\\s+demand\\b", "is associated with demand");
    }

    /**
     * Normalise prior chat turns into a valid Anthropic message list: strictly
     * alternating, starting with a user turn and ending with an assistant turn
     * (so the current user message appended after it keeps the alternation).
     * Caps to the last 10 turns to bound the prompt size.
     */
    private List<Map<String, Object>> buildHistory(List<?> history) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (history == null || history.isEmpty()) return out;
        int start = Math.max(0, history.size() - 10);
        String lastRole = null;
        for (int i = start; i < history.size(); i++) {
            if (!(history.get(i) instanceof Map<?, ?> m)) continue;
            Object textO = m.get("text") != null ? m.get("text") : m.get("content");
            if (textO == null || textO.toString().isBlank()) continue;
            Object roleO = m.get("role");
            String role = roleO != null && ("assistant".equals(roleO) || "ai".equals(roleO)) ? "assistant" : "user";
            if (out.isEmpty() && "assistant".equals(role)) continue; // must start with user
            if (role.equals(lastRole)) {
                out.set(out.size() - 1, Map.of("role", role, "content", textO.toString()));
            } else {
                out.add(Map.of("role", role, "content", textO.toString()));
                lastRole = role;
            }
        }
        if (!out.isEmpty() && "user".equals(lastRole)) out.remove(out.size() - 1); // end on assistant
        return out;
    }

    /**
     * A short, proactive daily briefing — gathered server-side from real data and
     * written up by Claude in a single call (fast, no multi-tool loop). Read-only.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> dailyBriefing(UUID tenantId) {
        Tenant t = tenantRepository.findById(tenantId).orElse(null);
        String storeName = t != null && t.getName() != null ? t.getName() : "your store";

        // today's takings
        Instant startToday = LocalDate.now(SAST).atStartOfDay(SAST).toInstant();
        List<Order> today = orderRepository.findByOrderDateBetweenAndTenant_Id(startToday, Instant.now(), tenantId);
        long ordersToday = today.stream().filter(o -> !isVoided(o.getStatus())).count();
        // Revenue = realised (Delivered) money, consistent with analytics/get_analytics,
        // sumRevenue() below and CraveIt Books — NOT in-progress orders that may still cancel.
        double revToday = today.stream().filter(o -> OrderStatus.DELIVERED.matches(o.getStatus()))
                .mapToDouble(o -> o.getTotalAmount() != null ? o.getTotalAmount() : 0).sum();

        // revenue trend: last 7 days vs the 7 before that
        Instant now = Instant.now();
        double rev7 = sumRevenue(now.minus(Duration.ofDays(7)), now);
        double revPrior7 = sumRevenue(now.minus(Duration.ofDays(14)), now.minus(Duration.ofDays(7)));
        Double trendPct = revPrior7 > 0 ? round2((rev7 - revPrior7) / revPrior7 * 100.0) : null;

        // 30-day performance signals for smarter advice
        Instant mAgo = now.minus(Duration.ofDays(30));
        double aov = round2(analyticsService.getAverageOrderValue(mAgo, now));
        double cancelRate = round2(analyticsService.getCancellationRate(mAgo, now));
        List<String> topProducts = analyticsService.getTopProducts(mAgo, now).stream()
                .limit(3).map(p -> p.getName() + " (" + p.getQuantity() + ")").toList();
        // Peak hour is only a real signal if it's a genuine CONCENTRATION backed by volume.
        // With sparse data the "busiest hour" is just noise — never surface it as a directive.
        List<Map<String, Object>> peakHours = analyticsService.getPeakHours(mAgo, now);
        long orders30 = peakHours.stream().mapToLong(p -> ((Number) p.getOrDefault("orderCount", 0)).longValue()).sum();
        int activeHours = (int) peakHours.stream().filter(p -> ((Number) p.getOrDefault("orderCount", 0)).longValue() > 0).count();
        var peak = peakHours.stream()
                .max(Comparator.comparingLong(p -> ((Number) p.getOrDefault("orderCount", 0)).longValue()))
                .orElse(null);
        long peakCount = peak != null ? ((Number) peak.getOrDefault("orderCount", 0)).longValue() : 0;
        double avgActiveHour = activeHours > 0 ? (double) orders30 / activeHours : 0;
        boolean peakSignificant = peakCount >= 8 && peakCount >= 1.5 * avgActiveHour; // a real concentration
        String busiestHour = null;
        if (peak != null && peakSignificant) {
            // Stamp the absolute confidence: a relative peak on thin volume (< ~1 order/day)
            // is NOT actionable for staffing — embed that so it can't be read as a directive.
            String conf = peakCount >= 30 ? "" : " — TENTATIVE, low volume (~" + String.format(Locale.UK, "%.1f", peakCount / 30.0) + " orders/day), not yet actionable";
            busiestHour = peak.get("hour") + ":00 (" + peakCount + " orders in 30 days" + conf + ")";
        }

        // inventory health
        List<String> soldOut = new ArrayList<>();
        int low = 0;
        for (MenuItem mi : menuItemRepository.findByTenant_Id(tenantId)) {
            int free = mi.getStock() - mi.getReservedStock();
            if (free <= 0) soldOut.add(mi.getName());
            else if (free <= mi.getLowStockThreshold()) low++;
        }

        // reviews in last 7 days
        java.time.LocalDateTime weekAgo = java.time.LocalDateTime.now().minusDays(7);
        List<Review> recentReviews = reviewRepository.findByTenant_IdOrderByCreatedAtDesc(tenantId).stream()
                .filter(r -> r.getCreatedAt() != null && r.getCreatedAt().isAfter(weekAgo))
                .toList();
        double avgRating = recentReviews.isEmpty() ? 0
                : recentReviews.stream().mapToInt(Review::getRating).average().orElse(0);

        long activePromos = promotionRepository.findActiveByTenantId(OffsetDateTime.now(), tenantId).size();

        Map<String, Object> snap = new LinkedHashMap<>();
        snap.put("storeOpen", t != null ? t.getIsOpen() : null);
        snap.put("ordersToday", ordersToday);
        snap.put("revenueToday", round2(revToday));
        snap.put("revenueLast7Days", round2(rev7));
        snap.put("revenuePrior7Days", round2(revPrior7));
        snap.put("revenueTrendPercent", trendPct);
        // Profitability (30d) from CraveIt Books — so the briefing can talk profit, not just sales.
        try {
            BookkeepingService.MoneyIn pl = bookkeepingService.moneyIn(tenantId, 30);
            snap.put("grossProfit30d", pl.grossProfit());
            snap.put("grossMarginPercent", pl.marginPercent());
            snap.put("operatingProfit30d", pl.operatingProfit());
            snap.put("operatingExpenses30d", pl.operatingExpenses());
        } catch (Exception ignored) { /* books optional */ }
        snap.put("avgOrderValue30d", aov);
        snap.put("cancellationRatePercent30d", cancelRate);
        snap.put("topProducts30d", topProducts);
        snap.put("ordersLast30Days", orders30); // sample size — so weak signals can be judged
        snap.put("busiestHour", busiestHour);    // null unless it's a real, well-supported peak
        snap.put("soldOutItems", soldOut);
        snap.put("lowStockCount", low);
        snap.put("activePromotions", activePromos);
        snap.put("reviewsLast7Days", recentReviews.size());
        snap.put("avgRatingLast7Days", round2(avgRating));

        String prompt = "You are a sharp, experienced operations advisor for \"" + storeName + "\", a store on the "
                + "CraveIt food-delivery app. Today is " + LocalDate.now(SAST) + ". Here is the live state as JSON "
                + "(money in South African Rand, R):\n" + json(snap) + "\n\n"
                + "Write a punchy, SCANNABLE daily briefing the owner can read in 10 seconds. Strict rules:\n"
                + "- AT MOST 3 bullets, the single most important first.\n"
                + "- Each bullet is ONE short sentence (max ~18 words), opening with a 2-3 word **bold** label.\n"
                + "- INTERPRET the data (a trend, a piece of advice, or a strategic risk) — never just restate numbers.\n"
                + "- Ground every point in a WELL-SUPPORTED signal. Check ordersLast30Days: if a metric rests on "
                + "few orders (small sample) it is WEAK — say it's early/limited, never turn a thin number into a "
                + "confident directive. busiestHour is null when there's no real peak — if so, do NOT mention peak "
                + "hours or staffing. A single noisy week-on-week swing on low volume is not proof of a pricing problem.\n"
                + "- Use specific Rand (R) figures.\n"
                + "- Do NOT mention operational to-dos (sold-out items, pending/unprepared orders, a closed store) — "
                + "those are separate alerts.\n"
                + "- No preamble, no sign-off, no emoji. Plain markdown bullets, each starting with '- '.";

        String out = anthropicClient.isConfigured() ? anthropicClient.call(prompt, 500, "BRIEFING") : null;
        String briefing = (out != null && !out.isBlank()) ? sanitiseNarration(out.trim()) : ruleBasedBriefing(snap);

        return Map.of("briefing", briefing);
    }

    private double sumRevenue(Instant start, Instant end) {
        return analyticsService.getSalesTrends(start, end).stream()
                .mapToDouble(d -> d.getTotal() != null ? d.getTotal() : 0).sum();
    }

    private String ruleBasedBriefing(Map<String, Object> snap) {
        StringBuilder sb = new StringBuilder();
        sb.append(String.format(Locale.UK, "- Today: %s orders, R%.2f in revenue.\n",
                snap.get("ordersToday"), (double) snap.get("revenueToday")));
        sb.append(String.format(Locale.UK, "- Last 7 days: R%.2f in revenue.\n",
                (double) snap.get("revenueLast7Days")));
        if (((Number) snap.get("reviewsLast7Days")).intValue() > 0)
            sb.append(String.format(Locale.UK, "- %s new review(s) this week (avg %.1f/5).\n",
                    snap.get("reviewsLast7Days"), (double) snap.get("avgRatingLast7Days")));
        return sb.toString().trim();
    }

    // ── System prompt (store-aware) ───────────────────────────────────────────

    private String buildSystemPrompt(Tenant t) {
        String name = t != null && t.getName() != null ? t.getName() : "this store";
        String cuisine = t != null && t.getCuisineType() != null ? t.getCuisineType() : "food";
        String today = LocalDate.now(SAST).toString();
        return """
            You are the Store Copilot for "%s", a %s store on the CraveIt food-delivery platform.
            Today is %s (Africa/Johannesburg). All money is South African Rand (R).

            You can call tools to read this store's live data. ALWAYS use the tools for any factual
            claim — never invent numbers. Think like a sharp operations manager: be concise and
            practical, cite real figures, and proactively call out what matters (low stock, sold-out
            items, sales dips, standout or slow products, bad reviews).

            PROFIT AWARENESS (CraveIt Books): get_menu gives each item's cost and marginPercent.
            When advising on prices or promotions, reason from MARGIN, not just price. Never recommend
            a discount that pushes an item below its cost (negative margin); for a %% off, check the
            worst-margin affected item still clears cost. If costKnown is false the margin is unknown —
            say so and suggest the owner add the item's cost in Books for exact advice; do NOT guess a
            cost. Prefer protecting margin over chasing volume unless the owner says otherwise.
            For overall profitability, the bottom line, costs or expenses ("are we making money?",
            "what's my profit?", "where's my money going?"), call get_books_summary — it returns the
            full P&L (gross/net/operating profit and margins, sales by category, operating expenses).
            When proposing a promotion, TARGET it from the data (a popular, healthy-margin PRODUCT, or a
            CATEGORY; ALL only if asked) and keep the discount below the item's margin so it never sells below
            cost. But you only have frequency + margin + stock — NOT elasticity, past-promo response or basket
            data — so a promo's effect on volume is UNKNOWN: frame it as an experiment, never claim it 'will
            drive'/'boost'/'encourage' sales, and name the risk (margin / cannibalising full-price sales).

            You can also PROPOSE changes using the propose_* tools: open/close the store, set an item's
            availability, adjust stock, change a price, add a new menu item, move an order along its lifecycle
            (only valid workflow transitions), create a promotion (choose its scope — one PRODUCT, a CATEGORY,
            or ALL — deliberately from the data; don't default to store-wide),
            or change a store setting (delivery fee, minimum order, driver earning %%, loyalty on/off,
            estimated delivery minutes, delivery radius). These are NOT applied automatically — they
            become confirmation cards the owner taps "Apply" on. So: propose clearly, state the expected
            impact, and NEVER say a change is done — say you've proposed it for their approval. Only
            propose when the owner is clearly asking to change something. If a tool returns no data, say
            so. Keep answers tight — a few sentences or a short list, not an essay.

            BE APPLICATION-AWARE: before proposing a change, call get_capabilities for that module to learn the
            available actions, the VALID option values (e.g. the store's real categories), plan headroom (slots
            left) and each field's rules. Only fill an option from its listed values; if a required field is
            missing, ASK for it; if a field has aiCanSuggest=false (e.g. an item's cost) NEVER guess it; honour
            dependsOn (suggest a price only once cost is known, using its suggestRule). When several options
            exist, weigh them from the data and either recommend the best with a one-line reason or lay out the choices.
            For a complaint or support ticket, FIRST call get_customer_context (lifetime value + this order's delivery
            vs expected) and get_capabilities('support'), then recommend the resolution that fits the customer's value
            and the issue, with a one-line reason — don't treat every complaint the same.

            EVIDENCE DISCIPLINE (critical): separate what you KNOW from what you're guessing. State a cause or
            conclusion ONLY when a tool actually shows it. When required data is missing (e.g. an order has no line
            items, or no cancellation reason is recorded), say plainly it is "not recorded / unknown" — do NOT fill
            the gap with a plausible-sounding cause. Never present a guess as analysis or a "conclusion". If
            hypotheses genuinely help, give at most a short list EXPLICITLY labelled as speculation, and name the
            data that would actually settle it. "I don't have evidence either way" is a valid and preferred answer
            over a confident story. Do not pad answers with speculative next-steps.

            Formatting: reply in clean markdown. Use a markdown table (with a |---| header row) whenever
            you list several items with attributes (e.g. menu items with prices, orders with status).
            Use short **bold** labels and '- ' bullet points. Do NOT use any emojis.
            """.formatted(name, cuisine, today);
    }

    // ── Tool catalogue ────────────────────────────────────────────────────────

    private List<Map<String, Object>> buildTools() {
        List<Map<String, Object>> tools = new ArrayList<>();

        tools.add(tool("get_capabilities",
                "What you can DO in a module right now — the available actions with their fields "
                        + "(required, which you may suggest, dependencies like price needing cost), the VALID "
                        + "option values (e.g. the store's real categories), plan headroom (slots left), and any "
                        + "workflow. ALWAYS consult this before proposing an action so your options and field "
                        + "values are real, not guessed. Pass a module (e.g. 'menu') or omit for all.",
                Map.of("module", strProp("Module name, e.g. 'menu' (optional)")),
                List.of()));

        tools.add(tool("get_store_overview",
                "Snapshot of the store: name, cuisine, open/closed, delivery fee, minimum order, "
                        + "today's order count and revenue, menu size, and active promotion count.",
                Map.of(), List.of()));

        tools.add(tool("get_analytics",
                "Key performance metrics over a period: revenue, average order value, on-time delivery %, "
                        + "cancellation rate, average delivery minutes, busiest hour, and top-selling products.",
                Map.of("range", enumProp("Time window", List.of("today", "7d", "30d", "month"))),
                List.of()));

        tools.add(tool("get_books_summary",
                "CraveIt Books income statement for the last N days (default 30): revenue, food cost (COGS) "
                        + "with a by-category breakdown, gross profit & margin, platform commission, net profit, "
                        + "operating expenses with a by-category breakdown, and operating profit (the true bottom "
                        + "line). Use this for any profitability, 'are we making money', cost or expense question.",
                Map.of("days", numProp("Look-back window in days (default 30)")),
                List.of()));

        tools.add(tool("get_customer_context",
                "Rich context for a support or service decision about an order: the customer's lifetime value "
                        + "(total orders, lifetime spend, customer since), THIS order's value/status and its delivery "
                        + "time vs the store's expected (slaBreached), and the store's average delivery today. "
                        + "Pull this BEFORE recommending how to handle a complaint or support ticket.",
                Map.of("order_id", strProp("The order id the issue relates to")),
                List.of("order_id")));

        tools.add(tool("list_support_tickets",
                "Customer support tickets (most recent first): id, subject, message, status, the customer, "
                        + "and the related order id (if any). Use to triage and advise on support.",
                Map.of("limit", intProp("Max tickets (default 15)")),
                List.of()));

        tools.add(tool("list_orders",
                "Recent orders (most recent first). Optionally filter by status "
                        + "(Pending, Scheduled, Preparing, Out for Delivery, Delivered, Cancelled, Rejected).",
                Map.of(
                        "status", strProp("Optional status filter"),
                        "limit", intProp("Max orders to return (default 20)")),
                List.of()));

        tools.add(tool("get_menu",
                "Full menu: each item's name, category, price, cost, marginPercent (gross), costKnown flag, "
                + "availability, and stock/reserved counts. Use cost/marginPercent for profit-aware pricing & promo advice.",
                Map.of(), List.of()));

        tools.add(tool("inventory_alerts",
                "Items that are sold out (no free stock) or low on stock (free stock at or below the alert "
                        + "threshold). Use this for anything about stock health.",
                Map.of(), List.of()));

        tools.add(tool("list_reviews",
                "Recent customer reviews with star rating and comment.",
                Map.of("limit", intProp("Max reviews to return (default 12)")),
                List.of()));

        tools.add(tool("list_promotions",
                "All promotions for the store: title, discount %, what it applies to, active flag, and dates.",
                Map.of(), List.of()));

        tools.add(tool("get_order_detail",
                "Full detail of one order by its id or short reference (e.g. 3D5FE52E): status, total, "
                        + "delivery address, and every line item with quantity.",
                Map.of("order_id", strProp("Order id or short reference")),
                List.of("order_id")));

        tools.add(tool("inventory_history",
                "Recent stock-movement log: each change with item, stock/reserved delta, type "
                        + "(ADJUSTMENT, ORDER_RESERVED, ORDER_CONFIRMED, ORDER_CANCELLED, ORDER_AUTO_REJECTED) and time. "
                        + "Use this to explain WHY stock changed.",
                Map.of("limit", intProp("Max entries (default 30)")),
                List.of()));

        tools.add(tool("payouts_summary",
                "How much the store is currently owed (settlement balance) in Rand.",
                Map.of(), List.of()));

        tools.add(tool("get_store_hours",
                "The weekly opening-hours schedule (per day: open/close times or closed).",
                Map.of(), List.of()));

        tools.add(tool("customers",
                "Counts of the store's registered users broken down by role (customers, drivers, admins).",
                Map.of(), List.of()));

        tools.add(tool("get_settings",
                "The store's configuration: contact phone/email, delivery fee, minimum order, delivery "
                        + "radius, estimated delivery minutes, driver earning %, loyalty on/off, and platform commission %.",
                Map.of(), List.of()));

        tools.add(tool("subscription",
                "The store's current subscription plan and status (e.g. BASIC, PRO; TRIAL, ACTIVE).",
                Map.of(), List.of()));

        tools.add(tool("drivers",
                "The store's delivery drivers with their email and current status (e.g. AVAILABLE, BUSY, OFFLINE).",
                Map.of(), List.of()));

        // ── Action proposals (require the owner to confirm in the UI) ──────────
        tools.add(tool("propose_set_store_open",
                "Propose opening or closing the store for orders. Use when the owner asks to open/close.",
                Map.of("open", boolProp("true to open, false to close")),
                List.of("open")));

        tools.add(tool("propose_set_item_availability",
                "Propose marking a menu item available or unavailable to customers.",
                Map.of("item", strProp("Item name"),
                       "available", boolProp("true = available, false = hidden")),
                List.of("item", "available")));

        tools.add(tool("propose_adjust_stock",
                "Propose changing an item's stock by a relative amount (e.g. +10 to restock, -3 to remove).",
                Map.of("item", strProp("Item name"),
                       "change", intProp("Positive to add, negative to remove"),
                       "reason", strProp("Short reason (e.g. restock, waste)")),
                List.of("item", "change")));

        tools.add(tool("propose_set_item_price",
                "Propose setting a menu item's price (in Rand).",
                Map.of("item", strProp("Item name"),
                       "price", numProp("New price in Rand")),
                List.of("item", "price")));

        tools.add(tool("propose_create_promotion",
                "Propose a promotion. CHOOSE THE SCOPE deliberately from the data — don't default to "
                        + "store-wide. appliesTo=PRODUCT discounts one item (best for promoting a popular, "
                        + "healthy-margin favourite, or clearing an overstocked item), CATEGORY discounts a "
                        + "whole category, ALL is everything (use only when the owner asks for store-wide). "
                        + "For PRODUCT or CATEGORY set 'target' to the exact item/category name. Never pick a "
                        + "discount that takes the target item below its cost — check its margin first via get_menu.",
                Map.of("title", strProp("Short promo title, e.g. 'Weekend Special'"),
                       "discountPercent", numProp("Discount percent, 1-100"),
                       "days", intProp("How many days it runs (default 3)"),
                       "appliesTo", enumProp("Scope of the discount", List.of("ALL", "CATEGORY", "PRODUCT")),
                       "target", strProp("Exact product or category name — required unless appliesTo=ALL")),
                List.of("title", "discountPercent")));

        tools.add(tool("propose_update_setting",
                "Propose changing one store setting.",
                Map.of("setting", enumProp("Which setting to change",
                            List.of("delivery_fee", "minimum_order", "driver_earning_percent",
                                    "loyalty_enabled", "estimated_delivery_minutes", "delivery_radius_km")),
                       "value", numProp("New value (for loyalty_enabled use 1 = on, 0 = off)")),
                List.of("setting", "value")));

        tools.add(tool("propose_set_order_status",
                "Propose moving an order to a new status. Call get_capabilities('orders') first — only "
                        + "transitions allowed by the workflow for the order's current status are valid.",
                Map.of("orderId", strProp("The order id"),
                       "status", enumProp("New status",
                               List.of("Confirmed", "Preparing", "Out for Delivery", "Delivered", "Cancelled", "Rejected"))),
                List.of("orderId", "status")));

        tools.add(tool("propose_create_menu_item",
                "Propose ADDING a new menu item. Use when the owner wants to add a dish/drink. "
                        + "Set a sensible category and (optionally) a short description and the item's cost.",
                Map.of("name", strProp("Item name"),
                       "price", numProp("Selling price in Rand"),
                       "category", strProp("Category (e.g. Burgers, Drinks)"),
                       "description", strProp("Optional short appetising description"),
                       "cost", numProp("Optional cost to make in Rand (leave out if unknown — never guess)")),
                List.of("name", "price", "category")));

        return tools;
    }

    // ── Tool execution (tenant-scoped, read-only) ─────────────────────────────

    private String executeTool(UUID tenantId, String name, JsonNode input, List<Map<String, Object>> proposals) {
        switch (name) {
            case "propose_set_store_open":       return proposeStoreOpen(input, proposals);
            case "propose_set_item_availability": return proposeAvailability(tenantId, input, proposals);
            case "propose_adjust_stock":         return proposeAdjustStock(tenantId, input, proposals);
            case "propose_set_item_price":       return proposeSetPrice(tenantId, input, proposals);
            case "propose_create_promotion":     return proposeCreatePromotion(input, proposals);
            case "propose_create_menu_item":     return proposeCreateMenuItem(input, proposals);
            case "propose_set_order_status":     return proposeSetOrderStatus(tenantId, input, proposals);
            case "propose_update_setting":       return proposeUpdateSetting(input, proposals);
            case "get_capabilities":   return json(capabilityRegistry.describe(tenantId, input.path("module").asText(null)));
            case "get_store_overview": return toolStoreOverview(tenantId);
            case "get_analytics":      return toolAnalytics(input.path("range").asText("30d"));
            case "get_books_summary":  return toolBooksSummary(tenantId, input.path("days").asInt(30));
            case "get_customer_context": return toolCustomerContext(tenantId, input.path("order_id").asText(null));
            case "list_support_tickets": return toolSupportTickets(tenantId, input.path("limit").asInt(15));
            case "list_orders":        return toolListOrders(tenantId,
                    input.hasNonNull("status") ? input.get("status").asText() : null,
                    input.path("limit").asInt(20));
            case "get_menu":           return toolMenu(tenantId);
            case "inventory_alerts":   return toolInventoryAlerts(tenantId);
            case "list_reviews":       return toolReviews(tenantId, input.path("limit").asInt(12));
            case "list_promotions":    return toolPromotions(tenantId);
            case "get_order_detail":   return toolOrderDetail(tenantId, input.path("order_id").asText(null));
            case "inventory_history":  return toolInventoryHistory(input.path("limit").asInt(30));
            case "payouts_summary":    return toolPayouts(tenantId);
            case "get_store_hours":    return toolStoreHours(tenantId);
            case "customers":          return toolCustomers(tenantId);
            case "get_settings":       return toolSettings(tenantId);
            case "subscription":       return toolSubscription(tenantId);
            case "drivers":            return toolDrivers();
            default:                   return "Unknown tool: " + name;
        }
    }

    private String toolStoreOverview(UUID tenantId) {
        Tenant t = tenantRepository.findById(tenantId).orElse(null);
        Instant startToday = LocalDate.now(SAST).atStartOfDay(SAST).toInstant();
        List<Order> today = orderRepository.findByOrderDateBetweenAndTenant_Id(startToday, Instant.now(), tenantId);
        // Realised (Delivered) revenue, consistent with the briefing, analytics and Books.
        double todayRevenue = today.stream()
                .filter(o -> OrderStatus.DELIVERED.matches(o.getStatus()))
                .mapToDouble(o -> o.getTotalAmount() != null ? o.getTotalAmount() : 0).sum();
        long activePromos = promotionRepository.findActiveByTenantId(OffsetDateTime.now(), tenantId).size();

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", t != null ? t.getName() : null);
        m.put("cuisine", t != null ? t.getCuisineType() : null);
        m.put("address", t != null ? t.getAddress() : null);
        m.put("isOpen", t != null ? t.getIsOpen() : null);
        m.put("deliveryFeeBase", t != null ? t.getDeliveryFeeBase() : null);
        m.put("minimumOrderAmount", t != null ? t.getMinimumOrderAmount() : null);
        m.put("ordersToday", today.stream().filter(o -> !isVoided(o.getStatus())).count());
        m.put("revenueToday", round2(todayRevenue));
        m.put("menuItemCount", menuItemRepository.findByTenant_Id(tenantId).size());
        m.put("activePromotions", activePromos);
        return json(m);
    }

    private String toolAnalytics(String range) {
        Instant start = rangeStart(range);
        Instant end = Instant.now();
        double revenue = analyticsService.getSalesTrends(start, end).stream()
                .mapToDouble(d -> d.getTotal() != null ? d.getTotal() : 0).sum();

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("range", range);
        m.put("revenue", round2(revenue));
        m.put("averageOrderValue", round2(analyticsService.getAverageOrderValue(start, end)));
        m.put("onTimeDeliveryPercent", round2(analyticsService.getOnTimePercentage(start, end)));
        m.put("cancellationRatePercent", round2(analyticsService.getCancellationRate(start, end)));
        m.put("avgDeliveryMinutes", round2(analyticsService.getAverageDeliveryMinutes(start, end)));

        // busiest hour
        List<Map<String, Object>> peak = analyticsService.getPeakHours(start, end);
        Map<String, Object> busiest = peak.stream()
                .max(Comparator.comparingLong(p -> ((Number) p.getOrDefault("orderCount", 0)).longValue()))
                .orElse(null);
        if (busiest != null) m.put("busiestHour", busiest.get("hour") + ":00 (" + busiest.get("orderCount") + " orders)");

        // top products
        List<Map<String, Object>> top = new ArrayList<>();
        for (TopProductDTO tp : analyticsService.getTopProducts(start, end).stream().limit(5).toList()) {
            Map<String, Object> p = new LinkedHashMap<>();
            p.put("name", tp.getName());
            p.put("ordered", tp.getQuantity());
            top.add(p);
        }
        m.put("topProducts", top);
        return json(m);
    }

    private String toolListOrders(UUID tenantId, String status, int limit) {
        int cap = Math.min(Math.max(limit, 1), 40);
        List<Order> orders = (status != null && !status.isBlank())
                ? orderRepository.findByStatusAndTenant_IdOrderByOrderDateDesc(status.trim(), tenantId)
                : orderRepository.findByTenant_IdOrderByOrderDateDesc(tenantId);
        List<Map<String, Object>> out = new ArrayList<>();
        orders.stream().limit(cap).forEach(o -> {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("id", shortId(o.getId()));
            r.put("status", o.getStatus());
            r.put("total", o.getTotalAmount());
            r.put("placedAt", o.getOrderDate() != null ? o.getOrderDate().toString() : null);
            out.add(r);
        });
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("count", out.size());
        m.put("orders", out);
        return json(m);
    }

    private String toolMenu(UUID tenantId) {
        List<Map<String, Object>> items = new ArrayList<>();
        menuItemRepository.findByTenant_Id(tenantId).stream().limit(80).forEach(mi -> {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("name", mi.getName());
            r.put("category", mi.getCategory());
            r.put("price", mi.getPrice());
            // Economics from CraveIt Books: real cost & margin when captured, else null.
            r.put("cost", mi.getCost());
            Double margin = mi.getMarginPercent();
            r.put("marginPercent", margin != null ? Math.round(margin * 10.0) / 10.0 : null);
            r.put("costKnown", mi.getCost() != null);
            r.put("available", !Boolean.FALSE.equals(mi.getIsAvailable()));
            r.put("stock", mi.getStock());
            r.put("reserved", mi.getReservedStock());
            r.put("freeStock", Math.max(0, mi.getStock() - mi.getReservedStock()));
            items.add(r);
        });
        return json(Map.of("itemCount", items.size(), "items", items));
    }

    private String toolBooksSummary(UUID tenantId, int days) {
        BookkeepingService.MoneyIn pl = bookkeepingService.moneyIn(tenantId, days);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("periodDays", pl.days());
        m.put("realisedOrders", pl.orders());
        m.put("revenue", pl.revenue());
        m.put("foodCost", pl.cogs());
        m.put("grossProfit", pl.grossProfit());
        m.put("grossMarginPercent", pl.marginPercent());
        m.put("platformCommission", pl.platformCommission());
        m.put("netProfit", pl.netProfit());
        m.put("operatingExpenses", pl.operatingExpenses());
        m.put("operatingProfit", pl.operatingProfit());
        m.put("operatingMarginPercent", pl.operatingMarginPercent());
        m.put("estimatedCostSharePercent", pl.estimatedSharePercent());

        List<Map<String, Object>> cats = new ArrayList<>();
        for (BookkeepingService.CategoryLine c : pl.cogsByCategory()) {
            Map<String, Object> cm = new LinkedHashMap<>();
            cm.put("category", c.category);
            cm.put("revenue", c.getRevenue());
            cm.put("cost", c.getCogs());
            cm.put("marginPercent", c.getMarginPercent());
            cats.add(cm);
        }
        m.put("salesByCategory", cats);
        // (expensesByCategory appended below)
        List<Map<String, Object>> exp = new ArrayList<>();
        for (BookkeepingService.ExpenseCategoryLine ec : pl.expensesByCategory()) {
            Map<String, Object> em = new LinkedHashMap<>();
            em.put("category", ec.category());
            em.put("amount", ec.amount());
            exp.add(em);
        }
        m.put("expensesByCategory", exp);
        return json(m);
    }

    /** Rich context bundle for a support/service decision about one order. */
    private String toolCustomerContext(UUID tenantId, String orderIdStr) {
        if (orderIdStr == null || orderIdStr.isBlank()) {
            return "Give me the order id the issue relates to.";
        }
        Order order;
        try {
            order = orderRepository.findByIdAndTenant_Id(UUID.fromString(orderIdStr.trim()), tenantId).orElse(null);
        } catch (IllegalArgumentException e) {
            return "That isn't a valid order id.";
        }
        if (order == null) return "No order matched that id.";

        Tenant t = tenantRepository.findById(tenantId).orElse(null);
        int expectedMins = (t != null && t.getEstimatedDeliveryMinutes() != null) ? t.getEstimatedDeliveryMinutes() : 30;

        Map<String, Object> m = new LinkedHashMap<>();

        Map<String, Object> oc = new LinkedHashMap<>();
        oc.put("id", order.getId().toString());
        oc.put("total", order.getTotalAmount());
        oc.put("status", order.getStatus());
        Long deliveryMins = (order.getOrderDate() != null && order.getDeliveredAt() != null)
                ? Duration.between(order.getOrderDate(), order.getDeliveredAt()).toMinutes() : null;
        oc.put("deliveryMinutes", deliveryMins);
        oc.put("expectedMinutes", expectedMins);
        oc.put("slaBreached", deliveryMins != null && deliveryMins > expectedMins);
        m.put("order", oc);

        if (order.getUser() != null) {
            List<Order> theirs = orderRepository.findByUserIdAndTenant_IdOrderByOrderDateDesc(order.getUser().getId(), tenantId);
            long delivered = theirs.stream().filter(o -> OrderStatus.DELIVERED.matches(o.getStatus())).count();
            double lifetime = theirs.stream().filter(o -> OrderStatus.DELIVERED.matches(o.getStatus()))
                    .mapToDouble(o -> o.getTotalAmount() != null ? o.getTotalAmount() : 0).sum();
            Instant since = theirs.stream().map(Order::getOrderDate).filter(Objects::nonNull).min(Instant::compareTo).orElse(null);
            Map<String, Object> cc = new LinkedHashMap<>();
            cc.put("name", order.getUser().getFullName() != null ? order.getUser().getFullName() : order.getUser().getEmail());
            cc.put("totalOrders", theirs.size());
            cc.put("deliveredOrders", delivered);
            cc.put("lifetimeSpend", round2(lifetime));
            cc.put("customerSince", since != null ? since.atZone(SAST).toLocalDate().toString() : null);
            m.put("customer", cc);
        }

        Instant startToday = LocalDate.now(SAST).atStartOfDay(SAST).toInstant();
        long[] todayMins = orderRepository.findByOrderDateBetweenAndTenant_Id(startToday, Instant.now(), tenantId).stream()
                .filter(o -> OrderStatus.DELIVERED.matches(o.getStatus()) && o.getOrderDate() != null && o.getDeliveredAt() != null)
                .mapToLong(o -> Duration.between(o.getOrderDate(), o.getDeliveredAt()).toMinutes()).toArray();
        Map<String, Object> sc = new LinkedHashMap<>();
        sc.put("avgDeliveryMinutesToday", todayMins.length > 0 ? Math.round(Arrays.stream(todayMins).average().orElse(0)) : null);
        sc.put("expectedDeliveryMinutes", expectedMins);
        m.put("storeToday", sc);

        return json(m);
    }

    private String toolSupportTickets(UUID tenantId, int limit) {
        List<Map<String, Object>> out = new ArrayList<>();
        supportTicketRepository.findByTenant_IdOrderByCreatedAtDesc(tenantId).stream()
                .limit(Math.max(1, limit))
                .forEach(tk -> {
                    Map<String, Object> r = new LinkedHashMap<>();
                    r.put("id", tk.getId().toString());
                    r.put("subject", tk.getSubject());
                    r.put("message", tk.getMessage());
                    r.put("status", tk.getStatus() != null ? tk.getStatus().name() : null);
                    r.put("orderId", tk.getOrderId() != null ? tk.getOrderId().toString() : null);
                    try { r.put("customer", tk.getUser() != null ? tk.getUser().getEmail() : null); }
                    catch (Exception ignored) { r.put("customer", null); }
                    out.add(r);
                });
        return json(Map.of("ticketCount", out.size(), "tickets", out));
    }

    private String toolInventoryAlerts(UUID tenantId) {
        List<Map<String, Object>> soldOut = new ArrayList<>();
        List<Map<String, Object>> low = new ArrayList<>();
        for (MenuItem mi : menuItemRepository.findByTenant_Id(tenantId)) {
            int free = mi.getStock() - mi.getReservedStock();
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("name", mi.getName());
            r.put("freeStock", Math.max(0, free));
            r.put("totalStock", mi.getStock());
            r.put("reserved", mi.getReservedStock());
            if (free <= 0) soldOut.add(r);
            else if (free <= mi.getLowStockThreshold()) low.add(r);
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("soldOut", soldOut);
        m.put("lowStock", low);
        return json(m);
    }

    private String toolReviews(UUID tenantId, int limit) {
        int cap = Math.min(Math.max(limit, 1), 25);
        List<Map<String, Object>> out = new ArrayList<>();
        reviewRepository.findByTenant_IdOrderByCreatedAtDesc(tenantId).stream().limit(cap).forEach(rv -> {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("rating", rv.getRating());
            r.put("comment", rv.getComment());
            r.put("at", rv.getCreatedAt() != null ? rv.getCreatedAt().toString() : null);
            out.add(r);
        });
        double avg = out.isEmpty() ? 0 : out.stream().mapToInt(r -> (int) r.get("rating")).average().orElse(0);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("count", out.size());
        m.put("averageRating", round2(avg));
        m.put("reviews", out);
        return json(m);
    }

    private String toolPromotions(UUID tenantId) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Promotion p : promotionRepository.findByTenant_Id(tenantId)) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("title", p.getTitle());
            r.put("discountPercent", p.getDiscountPercent());
            r.put("appliesTo", p.getAppliesTo() != null ? p.getAppliesTo().toString() : null);
            r.put("active", p.isActive());
            r.put("code", p.getCode());
            r.put("startAt", p.getStartAt() != null ? p.getStartAt().toString() : null);
            r.put("endAt", p.getEndAt() != null ? p.getEndAt().toString() : null);
            out.add(r);
        }
        return json(Map.of("count", out.size(), "promotions", out));
    }

    private String toolOrderDetail(UUID tenantId, String orderId) {
        if (orderId == null || orderId.isBlank()) return "Provide an order id.";
        String q = orderId.trim().toLowerCase();
        Order order = orderRepository.findByTenant_Id(tenantId).stream()
                .filter(o -> o.getId() != null && o.getId().toString().toLowerCase().startsWith(q))
                .findFirst().orElse(null);
        if (order == null) return json(Map.of("found", false));
        List<Map<String, Object>> items = new ArrayList<>();
        for (var oi : order.getOrderItems()) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("name", oi.getName());
            r.put("size", oi.getSize());
            r.put("qty", oi.getQuantity());
            r.put("lineTotal", oi.getTotalPrice());
            if (oi.getSpecialInstructions() != null) r.put("notes", oi.getSpecialInstructions());
            items.add(r);
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("ref", shortId(order.getId()));
        m.put("status", order.getStatus());
        m.put("total", order.getTotalAmount());
        m.put("placedAt", order.getOrderDate() != null ? order.getOrderDate().toString() : null);
        m.put("deliveryAddress", order.getDeliveryAddress());
        m.put("items", items);
        return json(m);
    }

    private String toolInventoryHistory(int limit) {
        int cap = Math.min(Math.max(limit, 1), 50);
        List<Map<String, Object>> out = new ArrayList<>();
        inventoryService.getAuditLogs().stream()
                .sorted((a, b) -> {
                    var ta = a.getTimestamp(); var tb = b.getTimestamp();
                    if (ta == null && tb == null) return 0;
                    if (ta == null) return 1;
                    if (tb == null) return -1;
                    return tb.compareTo(ta);
                })
                .limit(cap)
                .forEach(l -> {
                    Map<String, Object> r = new LinkedHashMap<>();
                    r.put("item", l.getMenuItemName());
                    r.put("stockChange", l.getStockChange());
                    r.put("reservedChange", l.getReservedChange());
                    r.put("type", l.getType());
                    r.put("at", l.getTimestamp() != null ? l.getTimestamp().toString() : null);
                    out.add(r);
                });
        return json(Map.of("count", out.size(), "entries", out));
    }

    private String toolPayouts(UUID tenantId) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("balanceOwed", payoutLedgerService.getBalance(tenantId));
        m.put("currency", "ZAR");
        return json(m);
    }

    private String toolStoreHours(UUID tenantId) {
        String[] dayNames = {"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"};
        List<Map<String, Object>> out = new ArrayList<>();
        for (var sh : storeHoursRepository.findByTenant_IdOrderByDayOfWeek(tenantId)) {
            Map<String, Object> r = new LinkedHashMap<>();
            int d = sh.getDayOfWeek();
            r.put("day", (d >= 0 && d < 7) ? dayNames[d] : String.valueOf(d));
            r.put("closed", sh.isClosed());
            if (!sh.isClosed()) {
                r.put("open", sh.getOpenTime());
                r.put("close", sh.getCloseTime());
            }
            out.add(r);
        }
        return json(Map.of("schedule", out));
    }

    private String toolCustomers(UUID tenantId) {
        Map<String, Long> byRole = new LinkedHashMap<>();
        var users = userRepository.findByTenant_Id(tenantId);
        for (var u : users) {
            String role = u.getRole() != null ? u.getRole().toString() : "UNKNOWN";
            byRole.merge(role, 1L, Long::sum);
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("totalUsers", users.size());
        m.put("byRole", byRole);
        return json(m);
    }

    private String toolSettings(UUID tenantId) {
        Tenant t = tenantRepository.findById(tenantId).orElse(null);
        if (t == null) return "{}";
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", t.getName());
        m.put("phone", t.getPhone());
        m.put("email", t.getEmail());
        m.put("cuisine", t.getCuisineType());
        m.put("isOpen", t.getIsOpen());
        m.put("deliveryFeeBase", t.getDeliveryFeeBase());
        m.put("minimumOrderAmount", t.getMinimumOrderAmount());
        m.put("deliveryRadiusKm", t.getDeliveryRadiusKm());
        m.put("estimatedDeliveryMinutes", t.getEstimatedDeliveryMinutes());
        m.put("driverEarningPercent", t.getDriverEarningPercent());
        m.put("loyaltyEnabled", t.getLoyaltyEnabled());
        m.put("platformCommissionPercent", t.getPlatformCommissionPercent());
        return json(m);
    }

    private String toolSubscription(UUID tenantId) {
        Tenant t = tenantRepository.findById(tenantId).orElse(null);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("plan", t != null ? t.getSubscriptionPlan() : null);
        m.put("status", t != null ? t.getSubscriptionStatus() : null);
        return json(m);
    }

    private String toolDrivers() {
        var drivers = adminDriverService.getAllDrivers();
        return json(Map.of("count", drivers.size(), "drivers", drivers));
    }

    // ── Action proposals ──────────────────────────────────────────────────────

    private String proposeStoreOpen(JsonNode input, List<Map<String, Object>> proposals) {
        boolean open = input.path("open").asBoolean(true);
        addProposal(proposals, "set_store_open",
                open ? "Open the store for orders" : "Close the store",
                Map.of("open", open));
        return "Proposed for the owner to confirm — not applied yet.";
    }

    private String proposeAvailability(UUID tenantId, JsonNode input, List<Map<String, Object>> proposals) {
        MenuItem item = resolveItem(tenantId, input.path("item").asText(null));
        if (item == null) return "No menu item matched that name.";
        boolean available = input.path("available").asBoolean(true);
        addProposal(proposals, "set_item_availability",
                (available ? "Make '" : "Hide '") + item.getName() + (available ? "' available" : "' from customers"),
                Map.of("itemId", item.getId().toString(), "itemName", item.getName(), "available", available));
        return "Proposed for the owner to confirm — not applied yet.";
    }

    private String proposeAdjustStock(UUID tenantId, JsonNode input, List<Map<String, Object>> proposals) {
        MenuItem item = resolveItem(tenantId, input.path("item").asText(null));
        if (item == null) return "No menu item matched that name.";
        int change = input.path("change").asInt(0);
        if (change == 0) return "Stock change must be non-zero.";
        String reason = input.path("reason").asText("manual adjustment");
        addProposal(proposals, "adjust_stock",
                (change > 0 ? "Add " + change + " to '" : "Remove " + (-change) + " from '") + item.getName() + "' stock",
                Map.of("itemId", item.getId().toString(), "itemName", item.getName(),
                       "change", change, "reason", reason));
        return "Proposed for the owner to confirm — not applied yet.";
    }

    private String proposeSetPrice(UUID tenantId, JsonNode input, List<Map<String, Object>> proposals) {
        MenuItem item = resolveItem(tenantId, input.path("item").asText(null));
        if (item == null) return "No menu item matched that name.";
        double price = input.path("price").asDouble(-1);
        if (price < 0) return "Provide a valid price.";
        addProposal(proposals, "set_item_price",
                "Set '" + item.getName() + "' price to R" + String.format("%.2f", price),
                Map.of("itemId", item.getId().toString(), "itemName", item.getName(), "price", price));
        return "Proposed for the owner to confirm — not applied yet.";
    }

    private String proposeCreatePromotion(JsonNode input, List<Map<String, Object>> proposals) {
        String title = input.path("title").asText("Special offer");
        double pct = input.path("discountPercent").asDouble(0);
        if (pct < 1 || pct > 100) return "Discount must be between 1 and 100%.";
        int days = input.path("days").asInt(3);
        if (days < 1) days = 3;
        String appliesTo = input.path("appliesTo").asText("ALL").toUpperCase(Locale.ROOT);
        String target = input.hasNonNull("target") ? input.get("target").asText().trim() : null;
        if (!"ALL".equals(appliesTo) && (target == null || target.isBlank())) {
            return "For a " + appliesTo + " promo I need the exact "
                    + ("PRODUCT".equals(appliesTo) ? "item" : "category") + " name to target.";
        }
        String scope = switch (appliesTo) {
            case "PRODUCT" -> "on " + target;
            case "CATEGORY" -> "across " + target;
            default -> "off everything";
        };
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("title", title);
        params.put("discountPercent", pct);
        params.put("days", days);
        params.put("appliesTo", appliesTo);
        if (target != null) params.put("target", target);
        addProposal(proposals, "create_promotion",
                "Run '" + title + "' — " + (int) pct + "% off " + scope + " for " + days + " day" + (days > 1 ? "s" : ""),
                params);
        return "Proposed for the owner to confirm — not applied yet.";
    }

    private String proposeCreateMenuItem(JsonNode input, List<Map<String, Object>> proposals) {
        String name = input.path("name").asText("").trim();
        double price = input.path("price").asDouble(0);
        String category = input.path("category").asText("").trim();
        if (name.isBlank() || price <= 0 || category.isBlank()) {
            return "To add an item I need at least a name, a price (> 0) and a category.";
        }
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("name", name);
        params.put("price", price);
        params.put("category", category);
        if (input.hasNonNull("description")) params.put("description", input.get("description").asText());
        if (input.hasNonNull("cost")) params.put("cost", input.get("cost").asDouble());
        addProposal(proposals, "create_menu_item",
                "Add '" + name + "' to " + category + " at R" + String.format(Locale.UK, "%.2f", price),
                params);
        return "Proposed for the owner to confirm — not applied yet.";
    }

    private String proposeSetOrderStatus(UUID tenantId, JsonNode input, List<Map<String, Object>> proposals) {
        String orderId = input.path("orderId").asText("").trim();
        String target = input.path("status").asText("").trim();
        if (orderId.isBlank() || target.isBlank()) return "I need the order id and the new status.";
        Order o;
        try {
            o = orderRepository.findByIdAndTenant_Id(UUID.fromString(orderId), tenantId).orElse(null);
        } catch (IllegalArgumentException e) {
            return "That doesn't look like a valid order id.";
        }
        if (o == null) return "I couldn't find that order.";
        OrderStatus cur = OrderStatus.fromLabel(o.getStatus());
        OrderStatus tgt = OrderStatus.fromLabel(target);
        if (tgt == null) return "'" + target + "' isn't a valid order status.";
        if (cur != null && !cur.canTransitionTo(tgt)) {
            String valid = cur.nextStatuses().stream().map(OrderStatus::label).reduce((a, b) -> a + ", " + b).orElse("none");
            return "An order that's '" + cur.label() + "' can't move to '" + tgt.label() + "'. Valid next: " + valid + ".";
        }
        addProposal(proposals, "set_order_status",
                "Move order #" + orderId.substring(0, Math.min(8, orderId.length())).toUpperCase() + " to " + tgt.label(),
                Map.of("orderId", orderId, "status", tgt.label()));
        return "Proposed for the owner to confirm — not applied yet.";
    }

    private String proposeUpdateSetting(JsonNode input, List<Map<String, Object>> proposals) {
        String setting = input.path("setting").asText(null);
        double value = input.path("value").asDouble(Double.NaN);
        if (setting == null || Double.isNaN(value)) return "Provide a setting and value.";
        String label = settingLabel(setting, value);
        if (label == null) return "That setting can't be changed here.";
        addProposal(proposals, "update_setting", label, Map.of("setting", setting, "value", value));
        return "Proposed for the owner to confirm — not applied yet.";
    }

    private String settingLabel(String s, double v) {
        switch (s) {
            case "delivery_fee": return "Set delivery fee to R" + String.format(Locale.UK, "%.2f", v);
            case "minimum_order": return "Set minimum order to R" + String.format(Locale.UK, "%.2f", v);
            case "driver_earning_percent": return "Set driver earnings to " + (int) v + "%";
            case "loyalty_enabled": return v != 0 ? "Turn loyalty ON" : "Turn loyalty OFF";
            case "estimated_delivery_minutes": return "Set estimated delivery to " + (int) v + " min";
            case "delivery_radius_km": return "Set delivery radius to " + (int) v + " km";
            default: return null;
        }
    }

    private void addProposal(List<Map<String, Object>> proposals, String action, String label, Map<String, Object> params) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("action", action);
        p.put("label", label);
        p.put("params", params);
        proposals.add(p);
    }

    private MenuItem resolveItem(UUID tenantId, String nameOrId) {
        if (nameOrId == null || nameOrId.isBlank()) return null;
        String q = nameOrId.trim().toLowerCase();
        List<MenuItem> items = menuItemRepository.findByTenant_Id(tenantId);
        // exact match first, then contains
        return items.stream().filter(i -> i.getName() != null && i.getName().equalsIgnoreCase(nameOrId.trim()))
                .findFirst()
                .or(() -> items.stream().filter(i -> i.getName() != null && i.getName().toLowerCase().contains(q)).findFirst())
                .orElse(null);
    }

    // ── Action execution (called from /api/admin/ai/act after the owner confirms) ─

    @Transactional
    public Map<String, Object> executeAction(String action, Map<String, Object> params) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return Map.of("ok", false, "message", "No store context.");
        String message;
        try {
            message = applyAction(tenantId, action, params);
            logAction(tenantId, action, params, "APPLIED", message);
            return Map.of("ok", true, "message", message);
        } catch (Exception e) {
            logAction(tenantId, action, params, "FAILED", e.getMessage());
            return Map.of("ok", false, "message", "Couldn't apply that: " + e.getMessage());
        }
    }

    private String applyAction(UUID tenantId, String action, Map<String, Object> p) {
        switch (action) {
            case "set_store_open": {
                boolean open = Boolean.TRUE.equals(p.get("open"));
                Tenant t = tenantRepository.findById(tenantId).orElseThrow();
                t.setIsOpen(open);
                tenantRepository.save(t);
                return "Store is now " + (open ? "open" : "closed") + ".";
            }
            case "set_item_availability": {
                UUID id = UUID.fromString((String) p.get("itemId"));
                boolean available = Boolean.TRUE.equals(p.get("available"));
                inventoryService.setAvailability(id, available);
                return "'" + p.get("itemName") + "' is now " + (available ? "available" : "hidden") + ".";
            }
            case "adjust_stock": {
                UUID id = UUID.fromString((String) p.get("itemId"));
                int change = ((Number) p.get("change")).intValue();
                InventoryAdjustmentDTO dto = new InventoryAdjustmentDTO();
                dto.setMenuItemId(id);
                dto.setStockChange(change);
                dto.setReservedChange(0);
                inventoryService.adjustInventory(List.of(dto));
                return "Adjusted '" + p.get("itemName") + "' stock by " + (change > 0 ? "+" : "") + change + ".";
            }
            case "set_item_price": {
                UUID id = UUID.fromString((String) p.get("itemId"));
                double price = ((Number) p.get("price")).doubleValue();
                MenuItem mi = menuItemRepository.findByIdAndTenant_Id(id, tenantId).orElseThrow();
                mi.setPrice(price);
                menuItemRepository.save(mi);
                return "'" + mi.getName() + "' price set to R" + String.format(Locale.UK, "%.2f", price) + ".";
            }
            case "create_promotion": {
                String title = (String) p.getOrDefault("title", "Special offer");
                double pct = ((Number) p.get("discountPercent")).doubleValue();
                int days = p.get("days") != null ? ((Number) p.get("days")).intValue() : 3;
                String appliesTo = p.get("appliesTo") != null ? p.get("appliesTo").toString().toUpperCase(Locale.ROOT) : "ALL";
                String target = p.get("target") != null ? p.get("target").toString().trim() : null;
                subscriptionEnforcementService.assertPromotionLimit(tenantId); // respect plan limits
                Tenant t = tenantRepository.findById(tenantId).orElseThrow();
                Promotion promo = new Promotion();
                promo.setTenant(t);
                promo.setTitle(title);
                promo.setDiscountPercent(java.math.BigDecimal.valueOf(pct));
                promo.setStartAt(OffsetDateTime.now());
                promo.setEndAt(OffsetDateTime.now().plusDays(days));
                promo.setActive(true);
                promo.setFeatured(false);

                String scopeDesc;
                if ("PRODUCT".equals(appliesTo) && target != null) {
                    MenuItem item = menuItemRepository.findByTenant_Id(tenantId).stream()
                            .filter(mi -> target.equalsIgnoreCase(mi.getName())).findFirst().orElse(null);
                    if (item == null) return "No item named '" + target + "' — can't target that promo.";
                    promo.setAppliesTo(Promotion.AppliesTo.PRODUCT);
                    promo.setTargetProductId(item.getId());
                    promo.setTargetProductName(item.getName());
                    scopeDesc = "on " + item.getName();
                } else if ("CATEGORY".equals(appliesTo) && target != null) {
                    promo.setAppliesTo(Promotion.AppliesTo.CATEGORY);
                    promo.setTargetCategoryName(target);
                    categoryRepository.findByTenant_Id(tenantId).stream()
                            .filter(c -> target.equalsIgnoreCase(c.getName())).findFirst()
                            .ifPresent(c -> promo.setTargetCategoryId(c.getId()));
                    scopeDesc = "across " + target;
                } else {
                    promo.setAppliesTo(Promotion.AppliesTo.ALL);
                    scopeDesc = "off everything";
                }
                promotionRepository.save(promo);
                return "Created '" + title + "' — " + (int) pct + "% " + scopeDesc + " for " + days + " day(s).";
            }
            case "create_menu_item": {
                String name = p.get("name") != null ? p.get("name").toString().trim() : "";
                if (name.isBlank() || !(p.get("price") instanceof Number)) {
                    return "I need at least a name and price to create the item.";
                }
                double price = ((Number) p.get("price")).doubleValue();
                String category = p.get("category") != null ? p.get("category").toString().trim() : "Other";
                subscriptionEnforcementService.assertMenuItemLimit(tenantId); // respect plan limits
                Tenant t = tenantRepository.findById(tenantId).orElseThrow();
                MenuItem mi = new MenuItem();
                mi.setName(name);
                mi.setPrice(price);
                mi.setCategory(category.isBlank() ? "Other" : category);
                if (p.get("description") != null) mi.setDescription(p.get("description").toString().trim());
                if (p.get("cost") instanceof Number c) mi.setCost(c.doubleValue());
                mi.setIsAvailable(true);
                mi.setTenant(t);
                menuItemRepository.save(mi);
                return "Added '" + name + "' to " + mi.getCategory() + " at R"
                        + String.format(Locale.UK, "%.2f", price) + ". Set its stock when you're ready to sell it.";
            }
            case "set_order_status": {
                UUID orderId = UUID.fromString(p.get("orderId").toString());
                Order o = orderRepository.findByIdAndTenant_Id(orderId, tenantId)
                        .orElseThrow(() -> new IllegalArgumentException("Order not found"));
                OrderStatus cur = OrderStatus.fromLabel(o.getStatus());
                OrderStatus tgt = OrderStatus.fromLabel(p.get("status").toString());
                if (tgt == null) return "That isn't a valid order status.";
                if (cur != null && !cur.canTransitionTo(tgt)) {
                    return "An order that's '" + cur.label() + "' can't move to '" + tgt.label() + "'.";
                }
                orderService.updateOrderStatus(orderId, tgt.label()); // reuses stock/loyalty/payout side-effects
                return "Order moved to " + tgt.label() + ".";
            }
            case "update_setting": {
                String s = (String) p.get("setting");
                double v = ((Number) p.get("value")).doubleValue();
                Tenant t = tenantRepository.findById(tenantId).orElseThrow();
                switch (s) {
                    case "delivery_fee": t.setDeliveryFeeBase(java.math.BigDecimal.valueOf(v)); break;
                    case "minimum_order": t.setMinimumOrderAmount(java.math.BigDecimal.valueOf(v)); break;
                    case "driver_earning_percent": t.setDriverEarningPercent(java.math.BigDecimal.valueOf(v)); break;
                    case "loyalty_enabled": t.setLoyaltyEnabled(v != 0); break;
                    case "estimated_delivery_minutes": t.setEstimatedDeliveryMinutes((int) v); break;
                    case "delivery_radius_km": t.setDeliveryRadiusKm((int) v); break;
                    default: throw new IllegalArgumentException("Unknown setting: " + s);
                }
                tenantRepository.save(t);
                return settingLabel(s, v) + " — done.";
            }
            default:
                throw new IllegalArgumentException("Unknown action: " + action);
        }
    }

    private void logAction(UUID tenantId, String action, Map<String, Object> params, String status, String message) {
        try {
            AiActionLog log = new AiActionLog();
            tenantRepository.findById(tenantId).ifPresent(log::setTenant);
            log.setAction(action);
            log.setParams(json(params));
            log.setStatus(status);
            log.setMessage(message);
            aiActionLogRepository.save(log);
        } catch (Exception ignored) { /* never fail the action on a logging error */ }
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private Instant rangeStart(String range) {
        ZonedDateTime now = ZonedDateTime.now(SAST);
        switch (range == null ? "30d" : range) {
            case "today": return now.toLocalDate().atStartOfDay(SAST).toInstant();
            case "7d":    return now.minusDays(7).toInstant();
            case "month": return now.toLocalDate().withDayOfMonth(1).atStartOfDay(SAST).toInstant();
            case "30d":
            default:      return now.minusDays(30).toInstant();
        }
    }

    private boolean isVoided(String status) {
        OrderStatus s = OrderStatus.fromLabel(status);
        return s != null && s.isVoided();
    }

    private String shortId(UUID id) {
        return id == null ? null : id.toString().substring(0, 8).toUpperCase();
    }

    private double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private String json(Object o) {
        try { return objectMapper.writeValueAsString(o); }
        catch (Exception e) { return "{\"error\":\"could not serialise tool result\"}"; }
    }

    private Map<String, Object> tool(String name, String desc, Map<String, Object> props, List<String> required) {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");
        schema.put("properties", props);
        schema.put("required", required);
        Map<String, Object> t = new LinkedHashMap<>();
        t.put("name", name);
        t.put("description", desc);
        t.put("input_schema", schema);
        return t;
    }

    private Map<String, Object> strProp(String desc) {
        return Map.of("type", "string", "description", desc);
    }

    private Map<String, Object> intProp(String desc) {
        return Map.of("type", "integer", "description", desc);
    }

    private Map<String, Object> numProp(String desc) {
        return Map.of("type", "number", "description", desc);
    }

    private Map<String, Object> boolProp(String desc) {
        return Map.of("type", "boolean", "description", desc);
    }

    private Map<String, Object> enumProp(String desc, List<String> values) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("type", "string");
        p.put("description", desc);
        p.put("enum", values);
        return p;
    }
}
