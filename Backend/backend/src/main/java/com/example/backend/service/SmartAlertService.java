package com.example.backend.service;

import com.example.backend.entity.AiAlert;
import com.example.backend.entity.MenuItem;
import com.example.backend.entity.Order;
import com.example.backend.entity.OrderStatus;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.AiAlertRepository;
import com.example.backend.repository.MenuItemRepository;
import com.example.backend.repository.OrderRepository;
import com.example.backend.repository.PromotionRepository;
import com.example.backend.repository.TenantRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.util.*;

/**
 * Generates proactive "Smart Alerts" for a store from its OWN data — no fixed
 * "magic" thresholds. Volume signals come from the store's week-over-week trend;
 * margin signals come from the store's own cost data and its median margin.
 * De-duplicates by a stable key so it never spams.
 */
@Service
@RequiredArgsConstructor
public class SmartAlertService {

    private final MenuItemRepository menuItemRepository;
    private final OrderRepository orderRepository;
    private final PromotionRepository promotionRepository;
    private final TenantRepository tenantRepository;
    private final AiAlertRepository aiAlertRepository;
    private final ObjectMapper objectMapper;
    private final SubscriptionEnforcementService subscriptionEnforcementService;

    private static final ZoneId SAST = ZoneId.of("Africa/Johannesburg");
    /** Ignore week-to-week sales noise below this drop before suggesting a deal. */
    private static final double MIN_SALES_DIP_PCT = 20.0;
    /** An order is "stuck in prep" once it's older than this and not started. */
    private static final int PREP_SLA_MINUTES = 15;

    @Transactional
    public int scan(UUID tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId).orElse(null);
        if (tenant == null) return 0;

        List<MenuItem> items = menuItemRepository.findByTenant_Id(tenantId);
        Instant now = Instant.now();
        List<Order> last30 = orderRepository.findByOrderDateBetweenAndTenant_Id(now.minus(Duration.ofDays(30)), now, tenantId);

        // units sold per item (genuine orders), and the store's own median margin
        Map<UUID, Integer> sold = new HashMap<>();
        for (Order o : last30) {
            if (isVoided(o.getStatus())) continue;
            for (var oi : o.getOrderItems()) {
                var mi = oi.getMenuItem();
                if (mi != null && mi.getId() != null) {
                    sold.merge(mi.getId(), oi.getQuantity() != null ? oi.getQuantity() : 0, Integer::sum);
                }
            }
        }
        Double medianMargin = medianMargin(items);

        int created = 0;

        // 0) Store closed — you're not taking orders. One tap to open.
        if (Boolean.FALSE.equals(tenant.getIsOpen())) {
            created += raise(tenant, "store-closed", "high",
                    "Your store is closed",
                    "You're not accepting orders right now. Open the store to start receiving them.",
                    action("set_store_open", "Open the store", Map.of("open", true)));
        }

        // 1) Sold-out sellers — an item that normally sells is sold out / hidden.
        for (MenuItem mi : items) {
            int units = sold.getOrDefault(mi.getId(), 0);
            if (units <= 0 || mi.getPrice() == null || mi.getPrice() <= 0) continue;
            int free = mi.getStock() - mi.getReservedStock();
            boolean available = !Boolean.FALSE.equals(mi.getIsAvailable());
            if (free <= 0 || !available) {
                double avgDaily = units / 30.0;
                int restock = Math.max(5, (int) Math.ceil(avgDaily * 7));
                created += raise(tenant, "soldout:" + mi.getId(), "high",
                        mi.getName() + " is sold out",
                        String.format(Locale.UK, "It sells about %.1f/day — restock to stop losing orders.", avgDaily),
                        action("adjust_stock", "Restock " + mi.getName() + " +" + restock,
                                Map.of("itemId", mi.getId().toString(), "itemName", mi.getName(),
                                        "change", restock, "reason", "AI alert: stockout")));
            }
        }

        // 2) Losing money — a selling item priced at or below what it costs to make.
        //    Pure data: margin <= 0. One tap sets a price that hits the store's median margin.
        for (MenuItem mi : items) {
            int units = sold.getOrDefault(mi.getId(), 0);
            Double margin = mi.getMarginPercent();
            if (units <= 0 || margin == null || margin > 0) continue; // only at/below cost
            Map<String, Object> fix = null;
            if (medianMargin != null && medianMargin > 0 && medianMargin < 95) {
                double target = round2(mi.getCost() / (1 - medianMargin / 100.0));
                fix = action("set_item_price", "Set " + mi.getName() + " to R" + String.format(Locale.UK, "%.2f", target),
                        Map.of("itemId", mi.getId().toString(), "price", target));
            }
            created += raise(tenant, "below-cost:" + mi.getId(), "high",
                    mi.getName() + " is selling at a loss",
                    String.format(Locale.UK, "Sold %d in 30 days at R%.2f but it costs R%.2f to make — you lose money on every order.",
                            units, mi.getPrice(), mi.getCost()),
                    fix);
        }

        // 3) Thin-margin bestseller — your busiest item earns BELOW your own median margin.
        if (medianMargin != null) {
            MenuItem worst = null; int worstUnits = 0; double worstMargin = 0;
            for (MenuItem mi : items) {
                int units = sold.getOrDefault(mi.getId(), 0);
                Double margin = mi.getMarginPercent();
                if (units <= 0 || margin == null || margin <= 0) continue;
                if (margin < medianMargin && units > worstUnits) { worst = mi; worstUnits = units; worstMargin = margin; }
            }
            if (worst != null) {
                created += raise(tenant, "thin-margin:" + worst.getId(), "medium",
                        worst.getName() + " earns below-average margin",
                        String.format(Locale.UK, "It's a top seller (%d sold) at %.0f%% margin vs your typical %.0f%%. A small price rise lifts profit the most here.",
                                worstUnits, worstMargin, medianMargin),
                        null);
            }
        }

        // 4) Missing costs — selling items with no cost, so Books has to estimate them.
        long missingCost = items.stream()
                .filter(mi -> sold.getOrDefault(mi.getId(), 0) > 0 && mi.getCost() == null)
                .count();
        if (missingCost > 0) {
            created += raise(tenant, "missing-cost:" + missingCost, "info",
                    "Add cost to " + missingCost + " selling item" + (missingCost > 1 ? "s" : ""),
                    "Books is estimating their cost (~30% of price). Add real costs so your profit is exact.",
                    null);
        }

        // 5) Sales dipping — the store's OWN week-over-week trend is down, with no live
        //    deal. Replaces any fixed order-count rule: the signal is this store's trend.
        long activePromos = promotionRepository.findActiveByTenantId(OffsetDateTime.now(), tenantId).size();
        double rev7 = 0, revPrior7 = 0;
        for (Order o : last30) {
            if (!OrderStatus.DELIVERED.matches(o.getStatus()) || o.getOrderDate() == null) continue;
            long daysAgo = Duration.between(o.getOrderDate(), now).toDays();
            double amt = o.getTotalAmount() != null ? o.getTotalAmount() : 0;
            if (daysAgo < 7) rev7 += amt;
            else if (daysAgo < 14) revPrior7 += amt;
        }
        if (activePromos == 0 && revPrior7 > 0 && rev7 < revPrior7 && canAddPromotion(tenantId, activePromos)) {
            double dropPct = (revPrior7 - rev7) / revPrior7 * 100.0;
            if (dropPct >= MIN_SALES_DIP_PCT) {
                created += raise(tenant, "sales-dip", "medium",
                        String.format(Locale.UK, "Sales are down %.0f%% vs last week", dropPct),
                        String.format(Locale.UK, "You took R%.0f this week vs R%.0f last week, with no deal live. A short discount can win customers back.", rev7, revPrior7),
                        action("create_promotion", "Launch 15% off for 3 days",
                                Map.of("title", "Win-back Deal", "discountPercent", 15, "days", 3)));
            }
        }

        // 6) Pending orders aging — something's sitting unprepared past your prep window.
        long oldestPending = 0; int awaiting = 0;
        for (Order o : last30) {
            String s = o.getStatus();
            if (s == null || o.getOrderDate() == null) continue;
            OrderStatus os = OrderStatus.fromLabel(s);
            if (os == OrderStatus.PENDING || os == OrderStatus.CONFIRMED || os == OrderStatus.SCHEDULED) {
                long mins = Duration.between(o.getOrderDate(), now).toMinutes();
                if (mins >= 0 && mins < 1440) { awaiting++; oldestPending = Math.max(oldestPending, mins); }
            }
        }
        if (awaiting > 0 && oldestPending >= PREP_SLA_MINUTES) {
            created += raise(tenant, "pending-aging", "high",
                    awaiting + " order" + (awaiting > 1 ? "s" : "") + " awaiting prep",
                    "Oldest is " + oldestPending + " min old and not started. Check the kitchen.",
                    null);
        }

        // 7) Milestone — today is beating the last fortnight (a little delight).
        Map<LocalDate, Double> daily = new HashMap<>();
        for (Order o : last30) {
            if (isVoided(o.getStatus()) || o.getOrderDate() == null) continue;
            LocalDate d = o.getOrderDate().atZone(SAST).toLocalDate();
            daily.merge(d, o.getTotalAmount() != null ? o.getTotalAmount() : 0, Double::sum);
        }
        LocalDate today = LocalDate.now(SAST);
        double todayRev = daily.getOrDefault(today, 0.0);
        double maxPrior = daily.entrySet().stream().filter(e -> !e.getKey().equals(today))
                .mapToDouble(Map.Entry::getValue).max().orElse(0);
        if (todayRev > 0 && maxPrior > 0 && todayRev > maxPrior) {
            created += raise(tenant, "milestone:" + today, "info",
                    "Best sales day in two weeks",
                    String.format(Locale.UK, "R%.0f today beats your recent best of R%.0f. Keep it going.", todayRev, maxPrior),
                    null);
        }

        return created;
    }

    /** The store's own median gross margin %, from items that have a cost set. */
    private Double medianMargin(List<MenuItem> items) {
        List<Double> margins = new ArrayList<>();
        for (MenuItem mi : items) {
            Double m = mi.getMarginPercent();
            if (m != null) margins.add(m);
        }
        if (margins.isEmpty()) return null;
        Collections.sort(margins);
        return margins.get(margins.size() / 2);
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private int raise(Tenant tenant, String key, String severity, String title, String body, Map<String, Object> action) {
        if (aiAlertRepository.existsByTenant_IdAndAlertKeyAndStatus(tenant.getId(), key, "NEW")) return 0;
        AiAlert a = new AiAlert();
        a.setTenant(tenant);
        a.setAlertKey(key);
        a.setSeverity(severity);
        a.setTitle(title);
        a.setBody(body);
        a.setStatus("NEW");
        if (action != null) {
            try { a.setAction(objectMapper.writeValueAsString(action)); } catch (Exception ignored) {}
        }
        aiAlertRepository.save(a);
        return 1;
    }

    private Map<String, Object> action(String action, String label, Map<String, Object> params) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("action", action);
        m.put("label", label);
        m.put("params", params);
        return m;
    }

    private boolean isVoided(String status) {
        OrderStatus s = OrderStatus.fromLabel(status);
        return s != null && s.isVoided();
    }

    /** True only if the store's plan still has room for another active promotion. */
    private boolean canAddPromotion(UUID tenantId, long activePromos) {
        try {
            return activePromos < subscriptionEnforcementService.getPlan(tenantId).getMaxPromotions();
        } catch (Exception e) {
            return false; // unknown plan — don't suggest an action that may fail
        }
    }
}
