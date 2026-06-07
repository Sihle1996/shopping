package com.example.backend.service;

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
import com.example.backend.repository.ReviewRepository;
import com.example.backend.repository.TenantRepository;
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
    private final ObjectMapper objectMapper;

    private static final ZoneId SAST = ZoneId.of("Africa/Johannesburg");

    /** Returns the copilot's answer, or null if AI is unavailable (caller falls back). */
    @Transactional(readOnly = true)
    public String chat(String question) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null || !anthropicClient.isConfigured()) return null;
        Tenant tenant = tenantRepository.findById(tenantId).orElse(null);
        String system = buildSystemPrompt(tenant);
        return anthropicClient.runAgent(
                system, question, buildTools(),
                (name, input) -> executeTool(tenantId, name, input),
                8, 1500);
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

            You are currently READ-ONLY: if the owner asks you to change something (price, stock,
            promo, hours), explain exactly what you would do and the expected impact, but make clear
            you can't apply it yet. If a tool returns no data, say so plainly. Keep answers tight —
            a few sentences or a short list, not an essay.
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

        return tools;
    }

    // ── Tool execution (tenant-scoped, read-only) ─────────────────────────────

    private String executeTool(UUID tenantId, String name, JsonNode input) {
        switch (name) {
            case "get_store_overview": return toolStoreOverview(tenantId);
            case "get_analytics":      return toolAnalytics(input.path("range").asText("30d"));
            case "list_orders":        return toolListOrders(tenantId,
                    input.hasNonNull("status") ? input.get("status").asText() : null,
                    input.path("limit").asInt(20));
            case "get_menu":           return toolMenu(tenantId);
            case "inventory_alerts":   return toolInventoryAlerts(tenantId);
            case "list_reviews":       return toolReviews(tenantId, input.path("limit").asInt(12));
            case "list_promotions":    return toolPromotions(tenantId);
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

    private Map<String, Object> enumProp(String desc, List<String> values) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("type", "string");
        p.put("description", desc);
        p.put("enum", values);
        return p;
    }
}
