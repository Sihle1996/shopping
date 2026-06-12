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
    private final com.example.backend.repository.UserRepository userRepository;
    private final PromotionRepository promotionRepository;
    private final TenantRepository tenantRepository;
    private final AiAlertRepository aiAlertRepository;
    private final ObjectMapper objectMapper;
    private final SubscriptionEnforcementService subscriptionEnforcementService;
    private final AdminAiService adminAiService;
    private final StoreHoursScheduler storeHoursScheduler;

    private static final ZoneId SAST = ZoneId.of("Africa/Johannesburg");
    /** Ignore week-to-week sales noise below this drop before suggesting a deal. */
    private static final double MIN_SALES_DIP_PCT = 20.0;
    /** An accepted order is "overdue in the kitchen" once it's been in prep longer than this. */
    private static final int PREP_SLA_MINUTES = 15;

    @Transactional
    public int scan(UUID tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId).orElse(null);
        if (tenant == null) return 0;
        // Only raise operational alerts for a LIVE store (approved + active). A store still in enrollment
        // (DRAFT/PENDING_REVIEW, active=false) or a suspended one shouldn't be nagged about being "closed
        // during trading hours" before it has even gone live.
        if (tenant.getApprovalStatus() != Tenant.ApprovalStatus.APPROVED || !tenant.isActive()) return 0;

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
        Double medianMargin = marginPercentile(items, 0.50);
        Double q1Margin = marginPercentile(items, 0.25); // "low margin" = bottom quartile of THIS store

        int created = 0;
        Set<String> activeKeys = new HashSet<>(); // keys whose condition holds right now

        // Store-level money factors, all from this store's own 30-day data:
        //  - marginFrac: median gross margin (null if no costs captured yet)
        //  - commissionFrac: the real platform fee the store pays
        //  - revPerActiveHour: avg delivered revenue in an hour the store actually trades
        Double marginFrac = medianMargin != null ? medianMargin / 100.0 : null;
        double commissionFrac = tenant.getPlatformCommissionPercent() != null
                ? tenant.getPlatformCommissionPercent().doubleValue() / 100.0 : 0.0;
        double deliveredRev = 0;
        Set<String> activeHours = new HashSet<>();
        for (Order o : last30) {
            if (!OrderStatus.DELIVERED.matches(o.getStatus()) || o.getOrderDate() == null) continue;
            deliveredRev += o.getTotalAmount() != null ? o.getTotalAmount() : 0;
            ZonedDateTime z = o.getOrderDate().atZone(SAST);
            activeHours.add(z.toLocalDate() + "#" + z.getHour());
        }
        double revPerActiveHour = !activeHours.isEmpty() ? deliveredRev / activeHours.size() : 0;

        // Closed loop: scale forecasts by how this store's PAST fixes actually played out.
        Map<String, AdminAiService.Calibration> calibration = adminAiService.alertCalibration(tenantId);

        // 0) Store closed DURING trading hours — you should be open but aren't. Stays quiet
        //    off-hours (closed at night is correct, not a problem worth nagging about).
        if (Boolean.FALSE.equals(tenant.getIsOpen()) && storeHoursScheduler.shouldBeOpenNow(tenantId)) {
            created += raise(activeKeys, tenant, "store-closed", "high",
                    "Your store is closed during trading hours",
                    "You're inside your opening hours but not accepting orders. Open the store to start receiving them.",
                    action("set_store_open", "Open the store", Map.of("open", true)),
                    revPerActiveHour > 0 ? riskImpact(revPerActiveHour, marginFrac, commissionFrac, "per hour closed") : null);
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
                // Calibrate the at-risk FORECAST by past sold-out fixes (the "sells ~X/day" stays the raw fact).
                AdminAiService.Calibration cal = calibration.get("soldout");
                double dailyRev = avgDaily * mi.getPrice() * (cal != null ? cal.factor() : 1.0);
                Double itemMargin = (mi.getCost() != null && mi.getPrice() > 0)
                        ? (mi.getPrice() - mi.getCost()) / mi.getPrice() : marginFrac;
                created += raise(activeKeys, tenant, "soldout:" + mi.getId(), "high",
                        mi.getName() + " is sold out",
                        String.format(Locale.UK, "It sells about %.1f/day — restock to stop losing orders.", avgDaily),
                        action("adjust_stock", "Restock " + mi.getName() + " +" + restock,
                                Map.of("itemId", mi.getId().toString(), "itemName", mi.getName(),
                                        "change", restock, "reason", "AI alert: stockout")),
                        riskImpact(dailyRev, itemMargin, commissionFrac, "per day out of stock", cal));
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
            double dailyUnits = units / 30.0;
            double dailyLoss = dailyUnits * (mi.getCost() - mi.getPrice()); // positive = bleeding
            created += raise(activeKeys, tenant, "below-cost:" + mi.getId(), "high",
                    mi.getName() + " is selling at a loss",
                    String.format(Locale.UK, "Sold %d in 30 days at R%.2f but it costs R%.2f to make — you lose money on every order.",
                            units, mi.getPrice(), mi.getCost()),
                    fix,
                    lossImpact(dailyUnits * mi.getPrice(), dailyLoss, commissionFrac, "per day at this price"));
        }

        // 3) Thin-margin bestseller — a POPULAR item (above the store's own median sales
        //    volume) whose margin sits in the store's BOTTOM QUARTILE. Both bars are the
        //    store's own distribution, so this only fires on a genuine low-margin seller.
        Double medianUnits = medianSoldUnits(sold);
        if (q1Margin != null && medianMargin != null && medianUnits != null) {
            MenuItem worst = null; int worstUnits = 0; double worstMargin = 0;
            for (MenuItem mi : items) {
                int units = sold.getOrDefault(mi.getId(), 0);
                Double margin = mi.getMarginPercent();
                if (units <= 0 || margin == null || margin <= 0) continue;
                if (margin < q1Margin && units >= medianUnits && units > worstUnits) {
                    worst = mi; worstUnits = units; worstMargin = margin;
                }
            }
            if (worst != null) {
                created += raise(activeKeys, tenant, "thin-margin:" + worst.getId(), "medium",
                        worst.getName() + " is a low-margin bestseller",
                        String.format(Locale.UK, "Popular (%d sold in 30 days) but its %.0f%% margin is in your bottom 25%% (your typical is %.0f%%). A small price rise lifts profit most here.",
                                worstUnits, worstMargin, medianMargin),
                        null);
            }
        }

        // 4) Missing costs — selling items with no cost, so Books has to estimate them.
        long missingCost = items.stream()
                .filter(mi -> sold.getOrDefault(mi.getId(), 0) > 0 && mi.getCost() == null)
                .count();
        if (missingCost > 0) {
            created += raise(activeKeys, tenant, "missing-cost", "info",
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
                // Target the discount intelligently: the most popular item the store can afford
                // to discount (margin at/above its median, in stock) — not a blunt store-wide deal.
                MenuItem promoTarget = null; int promoUnits = 0;
                for (MenuItem mi : items) {
                    int u = sold.getOrDefault(mi.getId(), 0);
                    Double m = mi.getMarginPercent();
                    boolean sellable = !Boolean.FALSE.equals(mi.getIsAvailable())
                            && (mi.getStock() - mi.getReservedStock()) > 0;
                    boolean affordable = m == null || medianMargin == null || m >= medianMargin;
                    if (u > promoUnits && sellable && affordable) { promoTarget = mi; promoUnits = u; }
                }
                Map<String, Object> promoParams = new LinkedHashMap<>();
                promoParams.put("title", "Win-back Deal");
                promoParams.put("discountPercent", 15);
                promoParams.put("days", 3);
                String promoLabel;
                if (promoTarget != null) {
                    promoParams.put("appliesTo", "PRODUCT");
                    promoParams.put("target", promoTarget.getName());
                    promoLabel = "15% off " + promoTarget.getName() + " for 3 days";
                } else {
                    promoParams.put("appliesTo", "ALL");
                    promoLabel = "Launch 15% off for 3 days";
                }
                created += raise(activeKeys, tenant, "sales-dip", "medium",
                        String.format(Locale.UK, "Sales are down %.0f%% vs last week", dropPct),
                        String.format(Locale.UK, "You took R%.0f this week vs R%.0f last week, with no deal live. A short discount can win customers back.", rev7, revPrior7),
                        action("create_promotion", promoLabel, promoParams),
                        riskImpact(revPrior7 - rev7, marginFrac, commissionFrac, "vs last week"));
            }
        }

        // 6a) Unaccepted orders nearing AUTO-CANCEL — warn the owner to ACCEPT before it's killed.
        //     Fires from halfway through the store's auto-cancel window, so there's always a heads-up.
        int autoCancelMin = tenant.getAutoCancelMinutes() != null ? tenant.getAutoCancelMinutes() : 15;
        if (autoCancelMin > 0) {
            long oldestUnaccepted = 0; int unaccepted = 0; double acceptRevAtRisk = 0;
            for (Order o : last30) {
                if (!OrderStatus.PENDING.matches(o.getStatus()) || o.getOrderDate() == null) continue;
                long mins = Duration.between(o.getOrderDate(), now).toMinutes();
                if (mins >= 0 && mins < autoCancelMin) {   // still savable (not yet auto-cancelled)
                    unaccepted++;
                    oldestUnaccepted = Math.max(oldestUnaccepted, mins);
                    acceptRevAtRisk += o.getTotalAmount() != null ? o.getTotalAmount() : 0;
                }
            }
            int warnAt = Math.max(2, autoCancelMin / 2);
            if (unaccepted > 0 && oldestUnaccepted >= warnAt) {
                long remaining = Math.max(1, autoCancelMin - oldestUnaccepted);
                created += raise(activeKeys, tenant, "pending-accept", "high",
                        unaccepted + " order" + (unaccepted > 1 ? "s" : "") + " awaiting your acceptance",
                        "Oldest is " + oldestUnaccepted + " min old and will auto-cancel in ~" + remaining
                                + " min. Accept it to keep the sale.",
                        null,
                        riskImpact(acceptRevAtRisk, marginFrac, commissionFrac, "if it auto-cancels"));
            }
        }

        // 6c) PAID but not yet accepted — the customer has already paid and is waiting. These are NEVER
        //     auto-cancelled (we don't auto-refund), so without this alert they can sit silently forever.
        {
            long oldestPaid = 0; int paidUnaccepted = 0; double paidRev = 0;
            for (Order o : last30) {
                if (!OrderStatus.PENDING.matches(o.getStatus()) || o.getOrderDate() == null || !o.isPaid()) continue;
                long mins = Duration.between(o.getOrderDate(), now).toMinutes();
                if (mins >= 5) {
                    paidUnaccepted++;
                    oldestPaid = Math.max(oldestPaid, mins);
                    paidRev += o.getTotalAmount() != null ? o.getTotalAmount() : 0;
                }
            }
            if (paidUnaccepted > 0) {
                created += raise(activeKeys, tenant, "paid-unaccepted", "high",
                        paidUnaccepted + " paid order" + (paidUnaccepted > 1 ? "s" : "") + " awaiting acceptance",
                        "A customer has paid and is waiting (oldest " + oldestPaid + " min). Accept it to start "
                                + "preparing — paid orders are never auto-cancelled.",
                        null,
                        riskImpact(paidRev, marginFrac, commissionFrac, "paid, awaiting acceptance"));
            }
        }

        // 6b) ACCEPTED orders aging — something the kitchen took on is sitting past your prep window.
        long oldestPending = 0; int awaiting = 0; double agingRevAtRisk = 0;
        for (Order o : last30) {
            String s = o.getStatus();
            if (s == null || o.getOrderDate() == null) continue;
            OrderStatus os = OrderStatus.fromLabel(s);
            if (os == OrderStatus.CONFIRMED || os == OrderStatus.PREPARING) { // accepted, not yet out
                long mins = Duration.between(o.getOrderDate(), now).toMinutes();
                if (mins >= 0 && mins < 1440) {
                    awaiting++;
                    oldestPending = Math.max(oldestPending, mins);
                    agingRevAtRisk += (o.getTotalAmount() != null ? o.getTotalAmount() : 0) * cancelProb(mins);
                }
            }
        }
        if (awaiting > 0 && oldestPending >= PREP_SLA_MINUTES) {
            created += raise(activeKeys, tenant, "pending-aging", "high",
                    awaiting + " order" + (awaiting > 1 ? "s" : "") + " overdue in the kitchen",
                    "Oldest is " + oldestPending + " min old, past your ~" + PREP_SLA_MINUTES
                            + " min prep window. Check the kitchen.",
                    null,
                    riskImpact(agingRevAtRisk, marginFrac, commissionFrac, "if not out soon"));
        }

        // 6c) Scheduled orders due soon — nothing auto-starts them, so remind the kitchen to
        //     begin in time (fires within the next hour, or while overdue and still Scheduled).
        int dueSoon = 0; Instant soonest = null;
        for (Order o : last30) {
            if (!OrderStatus.SCHEDULED.matches(o.getStatus()) || o.getScheduledDeliveryTime() == null) continue;
            long minsUntil = Duration.between(now, o.getScheduledDeliveryTime()).toMinutes();
            if (minsUntil <= 60 && minsUntil >= -120) { // due within an hour, or up to 2h overdue
                dueSoon++;
                if (soonest == null || o.getScheduledDeliveryTime().isBefore(soonest)) soonest = o.getScheduledDeliveryTime();
            }
        }
        if (dueSoon > 0 && soonest != null) {
            long m = Duration.between(now, soonest).toMinutes();
            String body = m >= 0
                    ? "The soonest is due in ~" + m + " min. Start preparing so it's ready on time."
                    : "The soonest was due " + (-m) + " min ago and is still Scheduled — start it now.";
            created += raise(activeKeys, tenant, "scheduled-due", "high",
                    dueSoon + " scheduled order" + (dueSoon > 1 ? "s" : "") + " due soon", body, null);
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
            created += raise(activeKeys, tenant, "milestone:" + today, "info",
                    "Best sales day in two weeks",
                    String.format(Locale.UK, "R%.0f today beats your recent best of R%.0f. Keep it going.", todayRev, maxPrior),
                    null);
        }

        // 8) Auto-cancel pattern — repeated timeouts mean sales are slipping through unaccepted.
        long autoCancels7d = last30.stream()
                .filter(o -> "AUTO_TIMEOUT".equals(o.getCancellationReason()))
                .filter(o -> o.getOrderDate() != null && Duration.between(o.getOrderDate(), now).toDays() < 7)
                .count();
        if (autoCancels7d >= 3) {
            created += raise(activeKeys, tenant, "auto-cancel-pattern", "medium",
                    autoCancels7d + " orders auto-cancelled this week",
                    "These weren't accepted in time and were cancelled automatically. Watching the order bell "
                            + "during peak hours — or lengthening the auto-cancel window in Settings — would save them.",
                    null);
        }

        // 9) Capacity vs peak — your busiest window is starting and barely anyone's on shift.
        Map<Integer, Integer> deliveryHours = new HashMap<>();
        for (Order o : last30) {
            if (o.getDeliveredAt() != null) deliveryHours.merge(o.getDeliveredAt().atZone(SAST).getHour(), 1, Integer::sum);
        }
        if (!deliveryHours.isEmpty()) {
            int peakHour = deliveryHours.entrySet().stream().max(Map.Entry.comparingByValue()).get().getKey();
            int peakCount = deliveryHours.get(peakHour);
            int totalDeliveries = deliveryHours.values().stream().mapToInt(Integer::intValue).sum();
            int nowHour = now.atZone(SAST).getHour();
            boolean realPeak = peakCount >= 8 && peakCount >= totalDeliveries * 0.2;     // a genuine rush, not noise
            boolean approaching = nowHour == ((peakHour + 23) % 24) || nowHour == peakHour; // the hour before, or in it
            if (realPeak && approaching) {
                long availableDrivers = userRepository.findByRoleAndTenant_Id(com.example.backend.user.Role.DRIVER, tenantId)
                        .stream().filter(u -> u.getDriverStatus() == com.example.backend.user.DriverStatus.AVAILABLE).count();
                if (availableDrivers <= 1) {
                    created += raise(activeKeys, tenant, "capacity-peak", "high",
                            "Low driver cover for your busy window",
                            String.format("Your busiest window (~%02d:00) is starting and only %d driver%s available. "
                                    + "Getting more on shift now will keep deliveries on time.",
                                    peakHour, availableDrivers, availableDrivers == 1 ? " is" : "s are"),
                            null);
                }
            }
        }

        // Self-clear: any alert still showing (NEW) or dismissed whose condition no longer
        // holds this scan is resolved — so the bell always reflects current data and never
        // says e.g. "awaiting prep" after the orders moved on. Dated milestones are left as-is.
        for (AiAlert a : aiAlertRepository.findByTenant_IdAndStatusIn(tenantId, List.of("NEW", "DISMISSED"))) {
            String key = a.getAlertKey();
            if (key == null || key.startsWith("milestone:")) continue;
            if (!activeKeys.contains(key)) {
                a.setStatus("RESOLVED");
                aiAlertRepository.save(a);
            }
        }

        return created;
    }

    /** A percentile (0–1) of the store's own gross margins, from items with a cost set. */
    private Double marginPercentile(List<MenuItem> items, double p) {
        List<Double> margins = new ArrayList<>();
        for (MenuItem mi : items) {
            Double m = mi.getMarginPercent();
            if (m != null) margins.add(m);
        }
        if (margins.isEmpty()) return null;
        Collections.sort(margins);
        int idx = (int) Math.floor(p * (margins.size() - 1));
        return margins.get(Math.max(0, Math.min(margins.size() - 1, idx)));
    }

    /** Median units sold across items that sold at least one — this store's own "popular" bar. */
    private Double medianSoldUnits(Map<UUID, Integer> sold) {
        List<Integer> units = new ArrayList<>();
        for (int u : sold.values()) if (u > 0) units.add(u);
        if (units.isEmpty()) return null;
        Collections.sort(units);
        return (double) units.get(units.size() / 2);
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    /**
     * Probability a not-yet-started order is lost, rising with the delay past the
     * prep SLA (15 min ≈ 20%, 30 ≈ 50%, 45 ≈ 80%), capped. Heuristic, not magic
     * per-store config — it scales the order's own value into "revenue at risk".
     */
    private double cancelProb(long delayMinutes) {
        if (delayMinutes < PREP_SLA_MINUTES) return 0;
        return Math.min(0.85, 0.20 + (delayMinutes - PREP_SLA_MINUTES) * 0.02);
    }

    /** Money-at-risk impact: gross = revenue × margin, net = gross − commission. */
    private String riskImpact(double revenueAtRisk, Double marginFrac, double commissionFrac, String timeWindow) {
        return riskImpact(revenueAtRisk, marginFrac, commissionFrac, timeWindow, null);
    }

    /** As above, but records that the figure was calibrated from past outcomes (provenance, not a claim). */
    private String riskImpact(double revenueAtRisk, Double marginFrac, double commissionFrac, String timeWindow,
                              AdminAiService.Calibration cal) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("revenueAtRisk", round2(Math.max(0, revenueAtRisk)));
        if (marginFrac != null) {
            double gross = revenueAtRisk * marginFrac;
            m.put("grossProfitAtRisk", round2(Math.max(0, gross)));
            m.put("netProfitAtRisk", round2(Math.max(0, gross - revenueAtRisk * commissionFrac)));
        }
        m.put("timeWindow", timeWindow);
        if (cal != null) {
            m.put("calibrated", true);
            m.put("calibrationFactor", round2(cal.factor()));
            m.put("calibrationSamples", cal.samples());
        }
        try { return objectMapper.writeValueAsString(m); } catch (Exception e) { return null; }
    }

    /** Realised loss impact (e.g. below-cost selling): the profit actively bleeding. */
    private String lossImpact(double revenueAffected, double grossLoss, double commissionFrac, String timeWindow) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("revenueAtRisk", round2(Math.max(0, revenueAffected)));
        m.put("grossProfitAtRisk", round2(Math.max(0, grossLoss)));
        m.put("netProfitAtRisk", round2(Math.max(0, grossLoss + revenueAffected * commissionFrac)));
        m.put("timeWindow", timeWindow);
        try { return objectMapper.writeValueAsString(m); } catch (Exception e) { return null; }
    }

    /**
     * Upsert an alert so it always reflects the latest data:
     *  - records the key as "active" this scan (so it isn't auto-resolved);
     *  - if a NEW alert with this key exists, REFRESH its title/body/action
     *    (e.g. "3 orders" → "2 orders", "25 min" → "32 min") instead of duplicating;
     *  - if the owner DISMISSED it, stay quiet until the condition clears;
     *  - otherwise create a fresh NEW alert.
     */
    private int raise(Set<String> activeKeys, Tenant tenant, String key, String severity,
                      String title, String body, Map<String, Object> action) {
        return raise(activeKeys, tenant, key, severity, title, body, action, null);
    }

    private int raise(Set<String> activeKeys, Tenant tenant, String key, String severity,
                      String title, String body, Map<String, Object> action, String impactJson) {
        activeKeys.add(key);
        String actionJson = null;
        if (action != null) {
            try { actionJson = objectMapper.writeValueAsString(action); } catch (Exception ignored) {}
        }
        AiAlert existing = aiAlertRepository
                .findFirstByTenant_IdAndAlertKeyOrderByCreatedAtDesc(tenant.getId(), key).orElse(null);
        if (existing != null) {
            if ("NEW".equals(existing.getStatus())) {
                existing.setSeverity(severity);
                existing.setTitle(title);
                existing.setBody(body);
                existing.setAction(actionJson);
                existing.setImpact(impactJson);
                aiAlertRepository.save(existing);
                return 0; // refreshed, not newly created
            }
            if ("DISMISSED".equals(existing.getStatus())) {
                return 0; // respect the dismissal until the condition clears
            }
            // RESOLVED / DONE → condition has recurred; fall through to raise a fresh one
        }
        AiAlert a = new AiAlert();
        a.setTenant(tenant);
        a.setAlertKey(key);
        a.setSeverity(severity);
        a.setTitle(title);
        a.setBody(body);
        a.setStatus("NEW");
        a.setAction(actionJson);
        a.setImpact(impactJson);
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
