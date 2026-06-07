package com.example.backend.service;

import com.example.backend.entity.AiActionLog;
import com.example.backend.entity.InventoryAdjustmentDTO;
import com.example.backend.entity.MenuItem;
import com.example.backend.entity.Order;
import com.example.backend.entity.Review;
import com.example.backend.entity.SalesTrendDTO;
import com.example.backend.entity.TopProductDTO;
import com.example.backend.entity.Tenant;
import com.example.backend.model.Promotion;
import com.example.backend.repository.MenuItemRepository;
import com.example.backend.repository.OrderRepository;
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
    private final ReviewRepository reviewRepository;
    private final PromotionRepository promotionRepository;
    private final StoreHoursRepository storeHoursRepository;
    private final UserRepository userRepository;
    private final InventoryService inventoryService;
    private final PayoutLedgerService payoutLedgerService;
    private final AdminDriverService adminDriverService;
    private final SubscriptionEnforcementService subscriptionEnforcementService;
    private final AiActionLogRepository aiActionLogRepository;
    private final ObjectMapper objectMapper;

    /** Copilot reply plus any actions it proposed (the UI shows confirm cards). */
    public record AgentResult(String answer, List<Map<String, Object>> proposedActions) {}

    private static final ZoneId SAST = ZoneId.of("Africa/Johannesburg");

    /** Returns the copilot's answer + proposed actions, or null if AI is unavailable. */
    @Transactional(readOnly = true)
    public AgentResult chat(String question) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null || !anthropicClient.isConfigured()) return null;
        Tenant tenant = tenantRepository.findById(tenantId).orElse(null);
        String system = buildSystemPrompt(tenant);
        List<Map<String, Object>> proposals = new ArrayList<>();
        String answer = anthropicClient.runAgent(
                system, question, buildTools(),
                (name, input) -> executeTool(tenantId, name, input, proposals),
                8, 1500);
        if (answer == null) return null;
        return new AgentResult(answer, proposals);
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
        double revToday = today.stream().filter(o -> !isVoided(o.getStatus()))
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
        var peak = analyticsService.getPeakHours(mAgo, now).stream()
                .max(Comparator.comparingLong(p -> ((Number) p.getOrDefault("orderCount", 0)).longValue()))
                .orElse(null);
        String busiestHour = peak != null ? peak.get("hour") + ":00" : null;

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
        snap.put("avgOrderValue30d", aov);
        snap.put("cancellationRatePercent30d", cancelRate);
        snap.put("topProducts30d", topProducts);
        snap.put("busiestHour", busiestHour);
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
                + "- Use specific Rand (R) figures.\n"
                + "- Do NOT mention operational to-dos (sold-out items, pending/unprepared orders, a closed store) — "
                + "those are separate alerts.\n"
                + "- No preamble, no sign-off, no emoji. Plain markdown bullets, each starting with '- '.";

        String out = anthropicClient.isConfigured() ? anthropicClient.call(prompt, 500) : null;
        String briefing = (out != null && !out.isBlank()) ? out.trim() : ruleBasedBriefing(snap);

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

            You can also PROPOSE changes using the propose_* tools: open/close the store, set an item's
            availability, adjust stock, change a price, create a promotion (a %% off everything for N days),
            or change a store setting (delivery fee, minimum order, driver earning %%, loyalty on/off,
            estimated delivery minutes, delivery radius). These are NOT applied automatically — they
            become confirmation cards the owner taps "Apply" on. So: propose clearly, state the expected
            impact, and NEVER say a change is done — say you've proposed it for their approval. Only
            propose when the owner is clearly asking to change something. If a tool returns no data, say
            so. Keep answers tight — a few sentences or a short list, not an essay.

            Formatting: reply in clean markdown. Use a markdown table (with a |---| header row) whenever
            you list several items with attributes (e.g. menu items with prices, orders with status).
            Use short **bold** labels and '- ' bullet points. Do NOT use any emojis.
            """.formatted(name, cuisine, today);
    }

    // ── Tool catalogue ────────────────────────────────────────────────────────

    private List<Map<String, Object>> buildTools() {
        List<Map<String, Object>> tools = new ArrayList<>();

        tools.add(tool("get_store_overview",
                "Snapshot of the store: name, cuisine, open/closed, delivery fee, minimum order, "
                        + "today's order count and revenue, menu size, and active promotion count.",
                Map.of(), List.of()));

        tools.add(tool("get_analytics",
                "Key performance metrics over a period: revenue, average order value, on-time delivery %, "
                        + "cancellation rate, average delivery minutes, busiest hour, and top-selling products.",
                Map.of("range", enumProp("Time window", List.of("today", "7d", "30d", "month"))),
                List.of()));

        tools.add(tool("list_orders",
                "Recent orders (most recent first). Optionally filter by status "
                        + "(Pending, Scheduled, Preparing, Out for Delivery, Delivered, Cancelled, Rejected).",
                Map.of(
                        "status", strProp("Optional status filter"),
                        "limit", intProp("Max orders to return (default 20)")),
                List.of()));

        tools.add(tool("get_menu",
                "Full menu: each item's name, category, price, availability, and stock/reserved counts.",
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
                "Propose a store-wide promotion (a % off everything) running for a number of days. "
                        + "Use when the owner wants to run a deal or discount.",
                Map.of("title", strProp("Short promo title, e.g. 'Weekend Special'"),
                       "discountPercent", numProp("Discount percent, 1-100"),
                       "days", intProp("How many days it runs (default 3)")),
                List.of("title", "discountPercent")));

        tools.add(tool("propose_update_setting",
                "Propose changing one store setting.",
                Map.of("setting", enumProp("Which setting to change",
                            List.of("delivery_fee", "minimum_order", "driver_earning_percent",
                                    "loyalty_enabled", "estimated_delivery_minutes", "delivery_radius_km")),
                       "value", numProp("New value (for loyalty_enabled use 1 = on, 0 = off)")),
                List.of("setting", "value")));

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
            case "propose_update_setting":       return proposeUpdateSetting(input, proposals);
            case "get_store_overview": return toolStoreOverview(tenantId);
            case "get_analytics":      return toolAnalytics(input.path("range").asText("30d"));
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
        double todayRevenue = today.stream()
                .filter(o -> !isVoided(o.getStatus()))
                .mapToDouble(o -> o.getTotalAmount() != null ? o.getTotalAmount() : 0).sum();
        long activePromos = promotionRepository.findActiveByTenantId(OffsetDateTime.now(), tenantId).size();

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", t != null ? t.getName() : null);
        m.put("cuisine", t != null ? t.getCuisineType() : null);
        m.put("address", t != null ? t.getAddress() : null);
        m.put("isOpen", t != null ? t.getIsOpen() : null);
        m.put("deliveryFeeBase", t != null ? t.getDeliveryFeeBase() : null);
        m.put("minimumOrderAmount", t != null ? t.getMinimumOrderAmount() : null);
        m.put("ordersToday", today.size());
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
            r.put("available", !Boolean.FALSE.equals(mi.getIsAvailable()));
            r.put("stock", mi.getStock());
            r.put("reserved", mi.getReservedStock());
            r.put("freeStock", Math.max(0, mi.getStock() - mi.getReservedStock()));
            items.add(r);
        });
        return json(Map.of("itemCount", items.size(), "items", items));
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
        addProposal(proposals, "create_promotion",
                "Run '" + title + "' — " + (int) pct + "% off everything for " + days + " day" + (days > 1 ? "s" : ""),
                Map.of("title", title, "discountPercent", pct, "days", days));
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
                subscriptionEnforcementService.assertPromotionLimit(tenantId); // respect plan limits
                Tenant t = tenantRepository.findById(tenantId).orElseThrow();
                Promotion promo = new Promotion();
                promo.setTenant(t);
                promo.setTitle(title);
                promo.setDiscountPercent(java.math.BigDecimal.valueOf(pct));
                promo.setAppliesTo(Promotion.AppliesTo.ALL);
                promo.setStartAt(OffsetDateTime.now());
                promo.setEndAt(OffsetDateTime.now().plusDays(days));
                promo.setActive(true);
                promo.setFeatured(false);
                promotionRepository.save(promo);
                return "Created '" + title + "' — " + (int) pct + "% off everything for " + days + " day(s).";
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
        return "Cancelled".equalsIgnoreCase(status) || "Rejected".equalsIgnoreCase(status);
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
