package com.example.backend.service;

import com.example.backend.entity.MenuItem;
import com.example.backend.entity.Order;
import com.example.backend.repository.MenuItemRepository;
import com.example.backend.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * "Profit Finder" — surfaces quantified, actionable money opportunities computed
 * from the store's OWN data (no guessing). Each opportunity carries a rand impact
 * and, where possible, a one-tap action that reuses the copilot's act pipeline.
 */
@Service
@RequiredArgsConstructor
public class ProfitFinderService {

    private final MenuItemRepository menuItemRepository;
    private final OrderRepository orderRepository;

    private static final int WINDOW_DAYS = 30;

    @Transactional(readOnly = true)
    public Map<String, Object> findOpportunities(UUID tenantId) {
        List<MenuItem> items = menuItemRepository.findByTenant_Id(tenantId);

        // Tally units sold per item over the window (genuine orders only).
        Instant since = Instant.now().minus(Duration.ofDays(WINDOW_DAYS));
        Map<UUID, Integer> sold = new HashMap<>();
        for (Order o : orderRepository.findByOrderDateBetweenAndTenant_Id(since, Instant.now(), tenantId)) {
            if (isVoided(o.getStatus())) continue;
            for (var oi : o.getOrderItems()) {
                var mi = oi.getMenuItem();
                if (mi != null && mi.getId() != null) {
                    sold.merge(mi.getId(), oi.getQuantity() != null ? oi.getQuantity() : 0, Integer::sum);
                }
            }
        }

        List<Map<String, Object>> opps = new ArrayList<>();
        for (MenuItem mi : items) {
            double price = mi.getPrice() != null ? mi.getPrice() : 0;
            if (price <= 0) continue;
            int units = sold.getOrDefault(mi.getId(), 0);
            double avgDaily = units / (double) WINDOW_DAYS;
            int free = mi.getStock() - mi.getReservedStock();
            boolean available = !Boolean.FALSE.equals(mi.getIsAvailable());

            // 1) STOCKOUT — a normally-selling item is sold out / hidden = missed orders.
            if ((free <= 0 || !available) && avgDaily > 0) {
                double dailyMissed = round(avgDaily * price);
                int restock = Math.max(5, (int) Math.ceil(avgDaily * 7)); // ~a week's worth
                opps.add(opp("STOCKOUT", "high",
                        mi.getName() + (available ? " is sold out" : " is hidden but still sells"),
                        String.format(Locale.UK,
                                "Sells about %.1f/day — you're missing roughly R%.0f a day in orders while it's unavailable.",
                                avgDaily, dailyMissed),
                        dailyMissed,
                        action("adjust_stock", "Restock " + mi.getName() + " +" + restock,
                                params("itemId", mi.getId().toString(), "itemName", mi.getName(),
                                        "change", restock, "reason", "AI Profit Finder: stockout"))));
            }
            // 2) DEAD STOCK — holding stock that simply isn't moving = idle cash + waste risk.
            else if (units == 0 && mi.getStock() > 0 && available) {
                double idle = round(mi.getStock() * price);
                opps.add(opp("DEAD_STOCK", "medium",
                        mi.getName() + " hasn't sold in " + WINDOW_DAYS + " days",
                        String.format(Locale.UK,
                                "About R%.0f tied up in %d unsold units. A small markdown or promo could move it.",
                                idle, mi.getStock()),
                        idle,
                        action("set_item_price", "Mark " + mi.getName() + " down 15% (to R" + String.format(Locale.UK, "%.2f", round(price * 0.85)) + ")",
                                params("itemId", mi.getId().toString(), "itemName", mi.getName(),
                                        "price", round(price * 0.85)))));
            }
        }

        // Urgency first (stockouts > dead stock), then rand impact within each.
        opps.sort(Comparator
                .comparingInt((Map<String, Object> o) -> severityRank((String) o.get("severity")))
                .thenComparing(o -> -(double) o.get("randImpact")));
        List<Map<String, Object>> top = opps.stream().limit(6).toList();
        double total = top.stream().mapToDouble(o -> (double) o.get("randImpact")).sum();

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("opportunities", top);
        res.put("totalImpact", round(total));
        res.put("currency", "ZAR");
        return res;
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private boolean isVoided(String status) {
        return "Cancelled".equalsIgnoreCase(status) || "Rejected".equalsIgnoreCase(status);
    }

    private int severityRank(String severity) {
        return "high".equals(severity) ? 0 : "medium".equals(severity) ? 1 : 2;
    }

    private Map<String, Object> opp(String type, String severity, String title, String detail,
                                    double randImpact, Map<String, Object> action) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", type);
        m.put("severity", severity);
        m.put("title", title);
        m.put("detail", detail);
        m.put("randImpact", randImpact);
        if (action != null) m.put("action", action);
        return m;
    }

    private Map<String, Object> action(String action, String label, Map<String, Object> params) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("action", action);
        m.put("label", label);
        m.put("params", params);
        return m;
    }

    private Map<String, Object> params(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return m;
    }

    private double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
