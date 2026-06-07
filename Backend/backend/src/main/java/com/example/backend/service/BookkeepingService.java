package com.example.backend.service;

import com.example.backend.entity.MenuItem;
import com.example.backend.entity.Order;
import com.example.backend.entity.OrderItem;
import com.example.backend.entity.OrderStatus;
import com.example.backend.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * CraveIt Books — Phase 1 "Money In".
 *
 * The simplest honest profit loop: for realised (Delivered) orders over a
 * period, take food revenue from the order lines, subtract what each item
 * costs the store to make ({@link MenuItem#getCost()}), and report gross
 * profit + margin. When an item has no cost captured yet, COGS is ESTIMATED
 * at a restaurant benchmark (~30% of price, the midpoint of the industry
 * 28–35% food-cost range) and we flag how much of the picture is estimated
 * so the owner knows to add real costs for accuracy.
 *
 * No ledger, no recipes, no OCR — that's the premium roadmap, not the MVP.
 */
@Service
@RequiredArgsConstructor
public class BookkeepingService {

    private final OrderRepository orderRepository;

    /** Industry food-cost benchmark used only when an item's real cost is unknown. */
    private static final double BENCHMARK_COST_RATIO = 0.30;
    /** Fallback look-back window when the caller doesn't specify one. */
    static final int DEFAULT_WINDOW_DAYS = 30;

    @Transactional(readOnly = true)
    public MoneyIn moneyIn(UUID tenantId, int days) {
        int window = days <= 0 ? DEFAULT_WINDOW_DAYS : days;
        Instant now = Instant.now();
        Instant from = now.minus(Duration.ofDays(window));
        List<Order> orders = orderRepository.findByOrderDateBetweenAndTenant_Id(from, now, tenantId);

        double revenue = 0, cogs = 0, estimatedRevenue = 0;
        int realisedOrders = 0;
        Map<UUID, ItemLine> byItem = new LinkedHashMap<>();

        for (Order o : orders) {
            if (!OrderStatus.DELIVERED.matches(o.getStatus())) continue;
            realisedOrders++;
            for (OrderItem oi : o.getOrderItems()) {
                double lineRevenue = oi.getTotalPrice() != null ? oi.getTotalPrice() : 0.0;
                int qty = oi.getQuantity() != null ? oi.getQuantity() : 0;
                MenuItem mi = oi.getMenuItem();
                boolean costKnown = mi != null && mi.getCost() != null;
                double lineCogs = costKnown
                        ? mi.getCost() * qty
                        : lineRevenue * BENCHMARK_COST_RATIO;

                revenue += lineRevenue;
                cogs += lineCogs;
                if (!costKnown) estimatedRevenue += lineRevenue;

                UUID key = mi != null && mi.getId() != null ? mi.getId() : null;
                String name = mi != null && mi.getName() != null ? mi.getName()
                        : (oi.getName() != null ? oi.getName() : "Item");
                ItemLine line = byItem.computeIfAbsent(
                        key != null ? key : UUID.nameUUIDFromBytes(name.getBytes()),
                        k -> new ItemLine(name));
                line.units += qty;
                line.revenue += lineRevenue;
                line.cogs += lineCogs;
                line.costKnown = line.costKnown && costKnown; // est if any line was estimated
            }
        }

        double grossProfit = revenue - cogs;
        Double margin = revenue > 0 ? grossProfit / revenue * 100.0 : null;
        double estimatedShare = revenue > 0 ? estimatedRevenue / revenue * 100.0 : 0.0;

        List<ItemLine> items = new ArrayList<>(byItem.values());
        items.sort(Comparator.comparingDouble((ItemLine l) -> l.revenue - l.cogs).reversed());

        return new MoneyIn(window, round(revenue), round(cogs), round(grossProfit),
                margin, round(estimatedShare), realisedOrders, items);
    }

    private static double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    /** Per-item profitability row. */
    public static class ItemLine {
        public final String name;
        public int units;
        public double revenue;
        public double cogs;
        public boolean costKnown = true;
        ItemLine(String name) { this.name = name; }
        public double getProfit() { return round(revenue - cogs); }
        public double getRevenue() { return round(revenue); }
        public double getCogs() { return round(cogs); }
        public Double getMarginPercent() { return revenue > 0 ? round((revenue - cogs) / revenue * 100.0) : null; }
        public boolean isEstimated() { return !costKnown; }
    }

    /** Period money-in summary. */
    public record MoneyIn(
            int days,
            double revenue,
            double cogs,
            double grossProfit,
            Double marginPercent,
            double estimatedSharePercent,
            int orders,
            List<ItemLine> items
    ) {}
}
