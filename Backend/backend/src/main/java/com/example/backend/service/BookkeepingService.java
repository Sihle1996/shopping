package com.example.backend.service;

import com.example.backend.entity.Expense;
import com.example.backend.entity.MenuItem;
import com.example.backend.entity.Order;
import com.example.backend.entity.OrderItem;
import com.example.backend.entity.OrderStatus;
import com.example.backend.repository.ExpenseRepository;
import com.example.backend.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.util.*;

/**
 * CraveIt Books — the honest profit loop for a store.
 *
 * For realised (Delivered) orders over a period it builds a real income
 * statement from actual data:
 *   Revenue (food sales)
 *   − COGS (item {@link MenuItem#getCost()}, broken out by category)
 *   = Gross profit
 *   − Platform commission (the real {@code order.platformFee} CraveIt takes)
 *   = Net profit
 * When an item has no cost captured yet, COGS is ESTIMATED at a restaurant
 * benchmark (~30% of price, the midpoint of the industry 28–35% food-cost
 * range) and we flag how much of the picture is estimated so the owner knows
 * to add real costs for accuracy. Plus a per-day series for the trend chart.
 *
 * No recipes, no OCR, no VAT — that's the premium roadmap, not this.
 */
@Service
@RequiredArgsConstructor
public class BookkeepingService {

    private final OrderRepository orderRepository;
    private final ExpenseRepository expenseRepository;

    /** Days in a month used to prorate recurring (monthly) expenses to the window. */
    private static final double DAYS_PER_MONTH = 30.0;
    /** Industry food-cost benchmark used only when an item's real cost is unknown. */
    private static final double BENCHMARK_COST_RATIO = 0.30;
    /** Fallback look-back window when the caller doesn't specify one. */
    static final int DEFAULT_WINDOW_DAYS = 30;
    private static final ZoneId SAST = ZoneId.of("Africa/Johannesburg");

    @Transactional(readOnly = true)
    public MoneyIn moneyIn(UUID tenantId, int days) {
        int window = days <= 0 ? DEFAULT_WINDOW_DAYS : days;
        Instant now = Instant.now();
        Instant from = now.minus(Duration.ofDays(window));
        List<Order> orders = orderRepository.findByOrderDateBetweenAndTenant_Id(from, now, tenantId);

        double revenue = 0, cogs = 0, estimatedRevenue = 0, platformCommission = 0;
        int realisedOrders = 0;
        Map<UUID, ItemLine> byItem = new LinkedHashMap<>();
        Map<String, CategoryLine> byCategory = new LinkedHashMap<>();
        Map<LocalDate, double[]> byDay = new TreeMap<>(); // value = [revenue, cogs]

        for (Order o : orders) {
            if (!OrderStatus.DELIVERED.matches(o.getStatus())) continue;
            realisedOrders++;
            platformCommission += o.getPlatformFee() != null ? o.getPlatformFee() : 0.0;
            LocalDate day = o.getOrderDate() != null ? o.getOrderDate().atZone(SAST).toLocalDate() : null;

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

                String category = mi != null && mi.getCategory() != null && !mi.getCategory().isBlank()
                        ? mi.getCategory() : "Other";
                CategoryLine cl = byCategory.computeIfAbsent(category, CategoryLine::new);
                cl.revenue += lineRevenue;
                cl.cogs += lineCogs;

                if (day != null) {
                    double[] d = byDay.computeIfAbsent(day, k -> new double[2]);
                    d[0] += lineRevenue;
                    d[1] += lineCogs;
                }
            }
        }

        double grossProfit = revenue - cogs;
        Double margin = revenue > 0 ? grossProfit / revenue * 100.0 : null;
        double estimatedShare = revenue > 0 ? estimatedRevenue / revenue * 100.0 : 0.0;
        double netProfit = grossProfit - platformCommission;
        Double netMargin = revenue > 0 ? netProfit / revenue * 100.0 : null;

        // Operating expenses (money out): one-off costs dated inside the window, plus
        // recurring monthly costs prorated to the window length. Net profit minus these
        // is the true operating profit (after rent, staff, packaging, etc.).
        LocalDate today = LocalDate.now(SAST);
        LocalDate windowStart = from.atZone(SAST).toLocalDate();
        double operatingExpenses = 0;
        Map<String, Double> expenseByCat = new LinkedHashMap<>();
        for (Expense e : expenseRepository.findByTenant_IdOrderByIncurredOnDesc(tenantId)) {
            if (e.getAmount() == null || e.getIncurredOn() == null) continue;
            double contribution = 0;
            if (e.isRecurring()) {
                if (!e.getIncurredOn().isAfter(today)) {
                    contribution = e.getAmount() * (window / DAYS_PER_MONTH);
                }
            } else if (!e.getIncurredOn().isBefore(windowStart) && !e.getIncurredOn().isAfter(today)) {
                contribution = e.getAmount();
            }
            if (contribution > 0) {
                operatingExpenses += contribution;
                String cat = e.getCategory() != null && !e.getCategory().isBlank() ? e.getCategory() : "Other";
                expenseByCat.merge(cat, contribution, Double::sum);
            }
        }
        double operatingProfit = netProfit - operatingExpenses;
        List<ExpenseCategoryLine> expenseCategories = new ArrayList<>();
        expenseByCat.forEach((k, v) -> expenseCategories.add(new ExpenseCategoryLine(k, round(v))));
        expenseCategories.sort((a, b) -> Double.compare(b.amount(), a.amount()));
        Double operatingMargin = revenue > 0 ? operatingProfit / revenue * 100.0 : null;

        List<ItemLine> items = new ArrayList<>(byItem.values());
        items.sort(Comparator.comparingDouble((ItemLine l) -> l.revenue - l.cogs).reversed());

        List<CategoryLine> categories = new ArrayList<>(byCategory.values());
        categories.sort(Comparator.comparingDouble((CategoryLine c) -> c.cogs).reversed());

        List<DayPoint> dailyProfit = new ArrayList<>();
        for (Map.Entry<LocalDate, double[]> e : byDay.entrySet()) {
            double dRev = e.getValue()[0], dCogs = e.getValue()[1];
            dailyProfit.add(new DayPoint(e.getKey().toString(), round(dRev), round(dCogs), round(dRev - dCogs)));
        }

        return new MoneyIn(window, round(revenue), round(cogs), round(grossProfit),
                margin, round(estimatedShare), realisedOrders, items,
                categories, round(platformCommission), round(netProfit), netMargin, dailyProfit,
                round(operatingExpenses), round(operatingProfit), operatingMargin, expenseCategories);
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

    /** COGS + revenue rolled up by menu category (research: never show a single COGS line). */
    public static class CategoryLine {
        public final String category;
        public double revenue;
        public double cogs;
        CategoryLine(String category) { this.category = category; }
        public double getRevenue() { return round(revenue); }
        public double getCogs() { return round(cogs); }
        public double getProfit() { return round(revenue - cogs); }
        public Double getMarginPercent() { return revenue > 0 ? round((revenue - cogs) / revenue * 100.0) : null; }
    }

    /** One day's totals for the trend chart. */
    public record DayPoint(String date, double revenue, double cogs, double profit) {}

    /** Operating expense total rolled up by category, for the reporting window. */
    public record ExpenseCategoryLine(String category, double amount) {}

    /** Period income statement. */
    public record MoneyIn(
            int days,
            double revenue,
            double cogs,
            double grossProfit,
            Double marginPercent,
            double estimatedSharePercent,
            int orders,
            List<ItemLine> items,
            List<CategoryLine> cogsByCategory,
            double platformCommission,
            double netProfit,
            Double netMarginPercent,
            List<DayPoint> dailyProfit,
            double operatingExpenses,
            double operatingProfit,
            Double operatingMarginPercent,
            List<ExpenseCategoryLine> expensesByCategory
    ) {}
}
