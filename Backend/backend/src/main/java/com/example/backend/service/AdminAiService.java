package com.example.backend.service;

import com.example.backend.entity.MenuItem;
import com.example.backend.entity.Order;
import com.example.backend.entity.OrderStatus;
import com.example.backend.entity.Review;
import com.example.backend.entity.AlertOutcome;
import com.example.backend.entity.PromoOutcomeRecord;
import com.example.backend.entity.SubscriptionPlan;
import com.example.backend.model.Promotion;
import com.example.backend.repository.AlertOutcomeRepository;
import com.example.backend.repository.PromoOutcomeRecordRepository;
import com.example.backend.repository.PromotionRepository;
import com.example.backend.repository.UserRepository;
import com.example.backend.user.Role;
import com.example.backend.user.User;
import com.example.backend.repository.MenuItemRepository;
import com.example.backend.repository.OrderRepository;
import com.example.backend.repository.ReviewRepository;
import com.example.backend.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminAiService {

    private final ReviewRepository reviewRepository;
    private final OrderRepository orderRepository;
    private final MenuItemRepository menuItemRepository;
    private final PromotionRepository promotionRepository;
    private final PromoOutcomeRecordRepository promoOutcomeRecordRepository;
    private final AlertOutcomeRepository alertOutcomeRepository;
    private final BookkeepingService bookkeepingService;
    private final UserRepository userRepository;
    private final SubscriptionEnforcementService subscriptionEnforcementService;
    private final AnalyticsService analyticsService;
    private final ObjectMapper objectMapper;
    private final AnthropicClient anthropicClient;

    // Keyed by tenant + since-window so different periods don't share a cache entry.
    private final ConcurrentHashMap<String, CachedDigest> digestCache = new ConcurrentHashMap<>();

    public boolean isConfigured() {
        return anthropicClient.isConfigured();
    }

    // ── Feature 1: Menu Writing Assistant ──────────────────────────────────

    public Map<String, Object> describeItem(String name, BigDecimal price, String category) {
        String prompt =
                "You are a menu copywriter for a South African food delivery app called CraveIt.\n" +
                String.format("Given: name=\"%s\", price=R%.2f, category=\"%s\"\n",
                        name, price != null ? price : BigDecimal.ZERO, category != null ? category : "") +
                "Return JSON only, no markdown, no explanation:\n" +
                "{\n" +
                "  \"description\": \"<1–2 sentence appetising description, under 120 characters>\",\n" +
                "  \"tags\": [\"<tag1>\", \"<tag2>\"],\n" +
                "  \"suggestedCategory\": \"<category>\"\n" +
                "}\n" +
                "Tags must be chosen only from: filling, comfort, healthy, light, premium, indulgent, quick, grilled, fried, spicy, sweet, vegan, value";

        String raw = anthropicClient.call(prompt);
        Map<String, Object> base = (raw != null && !raw.isBlank())
                ? parseJsonOrFallback(raw, buildDescribeFallback(name, price, category))
                : buildDescribeFallback(name, price, category);

        // Price is NOT guessed by the AI — anchor it to the store's own existing
        // items in the same category (median). No comparable items => no suggestion.
        Map<String, Object> out = new LinkedHashMap<>(base);
        out.remove("suggestedPrice");
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId != null) {
            Object catObj = out.getOrDefault("suggestedCategory", category);
            String cat = (catObj instanceof String s) ? s : category;
            Double median = medianCategoryPrice(tenantId, cat != null ? cat : category);
            if (median != null) out.put("suggestedPrice", median);
        }
        return out;
    }

    /**
     * Light name COMPLETION for Smart Fill: append 0-3 words to the typed seed to form a
     * natural item name (e.g. "mushroom" -> "Mushroom Burger"). It must KEEP the typed text
     * as the start — it completes, never reorders or invents from nothing. Returns "" if it
     * can't safely extend the seed.
     */
    public Map<String, Object> completeName(String partial, String category) {
        String seed = partial != null ? partial.trim() : "";
        if (seed.length() < 2 || !anthropicClient.isConfigured()) return Map.of("name", "");
        String cat = category != null && !category.isBlank() ? "Category: " + category + ". " : "";
        String prompt =
                "Complete this partial menu-item name for a South African food store into a natural, common name.\n" +
                "Rules: the result MUST start with the user's exact typed text (do not reorder or remove their words); " +
                "only APPEND 0-3 words; keep it short and realistic; no punctuation. " + cat +
                "Return JSON only: { \"name\": \"<completed name>\" }\n" +
                "Partial: \"" + seed.replace("\"", "'") + "\"";
        String raw = anthropicClient.call(prompt, 60);
        Map<String, Object> parsed = parseJsonOrFallback(raw, Map.of("name", ""));
        Object n = parsed.get("name");
        String name = n != null ? n.toString().trim() : "";
        // Safety: only return a genuine extension of the seed (so it can render as ghost text).
        if (name.isBlank() || !name.toLowerCase().startsWith(seed.toLowerCase()) || name.length() <= seed.length()) {
            return Map.of("name", "");
        }
        return Map.of("name", name);
    }

    /** Median price of the store's existing priced items in a category (or overall). */
    private Double medianCategoryPrice(UUID tenantId, String category) {
        List<MenuItem> priced = menuItemRepository.findByTenant_Id(tenantId).stream()
                .filter(i -> i.getPrice() != null && i.getPrice() > 0)
                .collect(Collectors.toList());
        List<Double> prices = (category != null && !category.isBlank())
                ? priced.stream().filter(i -> category.equalsIgnoreCase(i.getCategory()))
                        .map(MenuItem::getPrice).sorted().collect(Collectors.toList())
                : new ArrayList<>();
        if (prices.isEmpty()) {
            prices = priced.stream().map(MenuItem::getPrice).sorted().collect(Collectors.toList());
        }
        if (prices.isEmpty()) return null; // no basis — don't suggest
        int n = prices.size();
        double med = (n % 2 == 1) ? prices.get(n / 2) : (prices.get(n / 2 - 1) + prices.get(n / 2)) / 2.0;
        return Math.round(med * 100.0) / 100.0;
    }

    // ── Feature 2: Promotion Optimizer ─────────────────────────────────────

    @org.springframework.transaction.annotation.Transactional
    public Map<String, Object> suggestPromotions(UUID tenantId) {
        // LEARN: snapshot any newly-ended promos, then rank this run with their history.
        recordEndedPromoOutcomes(tenantId);
        Map<UUID, double[]> history = promoHistory(tenantId);

        Instant thirtyDaysAgo = Instant.now().minus(Duration.ofDays(30));
        List<Order> recentOrders = orderRepository
                .findByOrderDateBetweenAndTenant_Id(thirtyDaysAgo, Instant.now(), tenantId)
                .stream()
                .filter(o -> OrderStatus.DELIVERED.matches(o.getStatus()))
                .collect(Collectors.toList());

        // Item order-count map: menuItemId → count
        Map<UUID, Long> itemCounts = new HashMap<>();
        for (Order o : recentOrders) {
            if (o.getOrderItems() == null) continue;
            o.getOrderItems().forEach(oi -> {
                if (oi.getMenuItem() != null) {
                    long qty = oi.getQuantity() != null ? oi.getQuantity() : 0L;
                    itemCounts.merge(oi.getMenuItem().getId(), qty, Long::sum);
                }
            });
        }

        List<MenuItem> menuItems = menuItemRepository.findByTenant_Id(tenantId)
                .stream().filter(i -> Boolean.TRUE.equals(i.getIsAvailable())).collect(Collectors.toList());

        if (menuItems.isEmpty()) {
            return Map.of("suggestions", List.of());
        }

        // Exclude items that ALREADY have an IN-FLIGHT promo (active OR scheduled = not yet
        // expired). Suggestions should find the NEXT experiment, not stack a duplicate promo on
        // an item that's already running one (which would corrupt pricing, measurement & learning).
        OffsetDateTime nowOdt = OffsetDateTime.now();
        Set<UUID> promotedItems = new HashSet<>();
        Set<String> promotedCategories = new HashSet<>(); // lowercase names
        boolean storeWidePromo = false;
        for (Promotion p : promotionRepository.findByTenant_Id(tenantId)) {
            if (p.getEndAt() != null && p.getEndAt().isBefore(nowOdt)) continue; // expired -> item eligible again
            switch (p.getAppliesTo() == null ? Promotion.AppliesTo.ALL : p.getAppliesTo()) {
                case PRODUCT -> { if (p.getTargetProductId() != null) promotedItems.add(p.getTargetProductId()); }
                case MULTI_PRODUCT -> {
                    if (p.getTargetProducts() != null)
                        p.getTargetProducts().forEach(mi -> { if (mi != null && mi.getId() != null) promotedItems.add(mi.getId()); });
                }
                case CATEGORY -> { if (p.getTargetCategoryName() != null) promotedCategories.add(p.getTargetCategoryName().toLowerCase()); }
                case ALL -> storeWidePromo = true;
            }
        }
        if (storeWidePromo) return Map.of("suggestions", List.of()); // a store-wide deal already covers everything

        // LEVEL-3: the BACKEND decides deterministically (no LLM) — there is no
        // elasticity/promo-history data to "reason" over. Pick the store's most-ordered
        // items that it can afford to discount (margin at/above its OWN median, in stock),
        // and emit STRUCTURED facts + an explicit confidence contract. The UI narrates.
        List<Double> margins = menuItems.stream().map(MenuItem::getMarginPercent)
                .filter(Objects::nonNull).sorted().collect(Collectors.toList());
        Double medianMargin = margins.isEmpty() ? null : margins.get(margins.size() / 2);

        List<MenuItem> candidates = menuItems.stream()
                .filter(i -> itemCounts.getOrDefault(i.getId(), 0L) > 0)
                .filter(i -> !promotedItems.contains(i.getId()))  // not already promoted (PRODUCT/MULTI)
                .filter(i -> i.getCategory() == null || !promotedCategories.contains(i.getCategory().toLowerCase())) // nor via a category promo
                .filter(i -> i.getMarginPercent() != null && (medianMargin == null || i.getMarginPercent() >= medianMargin))
                .filter(i -> (i.getStock() - i.getReservedStock()) > 0 && i.getPrice() != null && i.getPrice() > 0)
                .sorted((a, b) -> Long.compare(itemCounts.getOrDefault(b.getId(), 0L), itemCounts.getOrDefault(a.getId(), 0L)))
                .limit(3)
                .collect(Collectors.toList());

        // Decision gradient — score each candidate by demand (vs the strongest) + margin
        // headroom (over the store median) + historical response, then ORDER the cards by that
        // score so the strongest test candidate is first (not merely the highest volume — a
        // top-volume item at the median margin has no room to discount, so it scores lower).
        long maxUnits = candidates.stream().mapToLong(i -> itemCounts.getOrDefault(i.getId(), 0L)).max().orElse(1);
        double medM = medianMargin != null ? medianMargin : 0;
        double maxMargin = candidates.stream().mapToDouble(MenuItem::getMarginPercent).max().orElse(medM);
        final long mu = maxUnits; final double mm = maxMargin, md = medM;
        java.util.function.ToDoubleFunction<MenuItem> scoreOf = it -> {
            double dS = mu > 0 ? (double) itemCounts.getOrDefault(it.getId(), 0L) / mu : 0;     // demand 0..1
            double mS = mm > md ? (it.getMarginPercent() - md) / (mm - md) : 0.5;               // margin headroom 0..1
            double c = dS * 0.6 + mS * 0.4;
            double[] hh = history.get(it.getId());
            if (hh != null && hh[1] > 0) c += Math.max(-0.25, Math.min(0.25, (hh[0] / hh[1]) / 200.0)); // history nudge
            return c;
        };
        candidates.sort((a, b) -> Double.compare(scoreOf.applyAsDouble(b), scoreOf.applyAsDouble(a)));

        String today = LocalDate.now().toString();
        String endAt = LocalDate.now().plusDays(5).toString();
        List<Map<String, Object>> suggestions = new ArrayList<>();
        for (MenuItem item : candidates) {
            long units = itemCounts.getOrDefault(item.getId(), 0L);
            double margin = item.getMarginPercent();
            double composite = scoreOf.applyAsDouble(item);
            double[] h = history.get(item.getId());
            Double avgNet = (h != null && h[1] > 0) ? h[0] / h[1] : null;
            long samples = h != null ? (long) h[1] : 0;
            String strength = composite >= 0.66 ? "STRONG" : composite >= 0.33 ? "MODERATE" : "WEAK";
            int discount = (int) Math.min(18, Math.max(5, Math.round(margin * 0.20)));          // varies, below margin

            Map<String, Object> promo = new LinkedHashMap<>();
            promo.put("title", item.getName() + " — featured");
            promo.put("discountPercent", discount);
            promo.put("appliesTo", "PRODUCT");
            promo.put("targetProductName", item.getName());
            promo.put("targetProductId", item.getId().toString());
            promo.put("startAt", today);
            promo.put("endAt", endAt);

            String hypothesis;
            if (avgNet != null && avgNet > 0) {
                hypothesis = "Repeat candidate — prior promos on this item showed a positive net change (observed, not controlled).";
            } else if (avgNet != null) {
                hypothesis = "Prior promos on this item showed no positive net change — test cautiously.";
            } else {
                hypothesis = switch (strength) {
                    case "STRONG"   -> "Strongest test candidate — high demand with a clear margin buffer.";
                    case "MODERATE" -> "Solid secondary test — good demand with an adequate margin buffer.";
                    default          -> "Optional test — a moderate signal worth a small experiment.";
                };
            }

            Map<String, Object> s = new LinkedHashMap<>();
            // FACTS — observed, immutable (the data layer)
            s.put("facts", List.of(
                    units + " orders in the last 30 days",
                    String.format(Locale.UK, "%.0f%% margin (store median %.0f%%)", margin, medM),
                    String.format(Locale.UK, "R%.2f current price", item.getPrice())));
            // ANALYSIS — structured tokens (epistemic layer). insightStrength + recommendationType
            // are the SEMANTIC signals; the global uncertainty note lives once in the UI banner.
            Map<String, Object> analysis = new LinkedHashMap<>();
            analysis.put("hypothesis", hypothesis);
            // EVIDENCE is selection criteria only (why this item was picked). Historical
            // response is kept OUT of here so a learning number can never sit among the
            // facts as if it were one.
            analysis.put("evidence", List.of(
                    units + " orders in the last 30 days",
                    String.format(Locale.UK, "%.0f%% margin — %s the store median",
                            margin, margin >= medM ? "at or above" : "below"),
                    "In stock now"));
            analysis.put("insightStrength", strength);
            analysis.put("recommendationType", "EXPERIMENT");
            // Learning data lives in its OWN typed block, permanently stamped OBSERVATIONAL,
            // so it can't leak into the UI (or any narration) as causal truth.
            if (samples > 0) {
                Map<String, Object> prior = new LinkedHashMap<>();
                prior.put("avgNetPercent", Math.round(avgNet));
                prior.put("samples", samples);
                prior.put("basis", "OBSERVATIONAL");
                prior.put("note", "Past association vs the store baseline — not a controlled or causal result.");
                analysis.put("priorObserved", prior);
            }
            s.put("analysis", analysis);
            s.put("proposedPromo", promo);
            suggestions.add(s);
        }
        return Map.of("suggestions", suggestions);
    }

    // ── Feature: Promotion outcomes (the feedback loop) ─────────────────────

    // Guards against meaningless percentages: a % needs a real measurement window AND a
    // non-trivial baseline. A "0 -> 56 over 1 day" is not "+99400%" — it's too early / no baseline.
    private static final double MIN_PROMO_DAYS = 2.0;     // < 2 days of data = EARLY (no %)
    private static final double FULL_CONF_DAYS = 7.0;     // >= 7 days = full confidence (HIGH) possible
    private static final int    MIN_BASELINE_UNITS = 5;  // need >= 5 prior units for a stable item %
    private static final int    MIN_STORE_BASELINE = 10; // need >= 10 store orders in the 14-day baseline

    /** Clamp a quality tier so it never exceeds {@code max} (LOW < MEDIUM < HIGH). */
    private static String capQuality(String raw, String max) {
        List<String> order = List.of("LOW", "MEDIUM", "HIGH");
        return order.indexOf(raw) <= order.indexOf(max) ? raw : max;
    }

    /**
     * Closes the experiment loop: for each PRODUCT promotion that has started,
     * measures the target item's sales DURING the promo vs an equal-length window
     * immediately BEFORE it. Purely observed facts (units & revenue) — the change
     * is ASSOCIATED with the promo, not proven caused by it (other factors vary).
     * This is the data that lets future suggestions learn instead of guessing.
     */
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public Map<String, Object> promoOutcomes(UUID tenantId) {
        List<Map<String, Object>> out = new ArrayList<>();
        Instant now = Instant.now();
        for (Promotion p : promotionRepository.findByTenant_Id(tenantId)) {
            if (p.getStartAt() == null) continue;
            Instant start = p.getStartAt().toInstant();
            if (start.isAfter(now)) continue; // not started yet
            // ALL-scoped (free delivery / amount off / ALL %) -> order-level Net Revenue Lift (Layer C).
            if (p.getAppliesTo() == Promotion.AppliesTo.ALL) {
                out.add(orderScopeOutcome(tenantId, p, start, now));
                continue;
            }
            // PRODUCT keeps the per-product lift path; CATEGORY/MULTI_PRODUCT are out of scope for now.
            if (p.getAppliesTo() != Promotion.AppliesTo.PRODUCT || p.getTargetProductId() == null) continue;
            boolean ended = p.getEndAt() != null && p.getEndAt().toInstant().isBefore(now);
            Instant duringEnd = ended ? p.getEndAt().toInstant() : now;
            Duration len = Duration.between(start, duringEnd);
            if (len.isZero() || len.isNegative()) continue;
            Instant beforeStart = start.minus(len);

            // [orderedUnits, orderedRevenue, deliveredUnits, deliveredRevenue]
            double[] before = productSales(tenantId, p.getTargetProductId(), beforeStart, start);
            double[] during = productSales(tenantId, p.getTargetProductId(), start, duringEnd);

            boolean hasSignal = (before[0] + during[0]) > 0;
            double durDays = len.toHours() / 24.0;
            boolean baselineOk = before[0] >= MIN_BASELINE_UNITS;

            // STATE separates eligibility-to-show-a-% from confidence-in-it:
            //   PENDING   — no orders at all
            //   EARLY     — < 2 days OR no real baseline → counts only, no percentages
            //   MEASURING — 2-6 days with a baseline → directional %, confidence capped (never HIGH)
            //   MEASURED  — >= 7 days → full confidence allowed
            String signal;
            if (!hasSignal) signal = "PENDING";
            else if (durDays < MIN_PROMO_DAYS || !baselineOk) signal = "EARLY";
            else if (durDays < FULL_CONF_DAYS) signal = "MEASURING";
            else signal = "MEASURED";
            boolean allowPct = signal.equals("MEASURING") || signal.equals("MEASURED");

            LiftCalc lift = allowPct ? computeLift(tenantId, p.getTargetProductId(), start, duringEnd) : null;
            Long storePercent = lift != null ? lift.storePercent() : null;
            Long netLift = lift != null ? lift.netLift() : null;

            // CONFIDENCE = strength of the WEAKER side of the comparison (a strong promo volume
            // on a thin baseline is still a thin comparison), CAPPED by duration: never HIGH
            // before ~7 days, never above LOW when too early.
            double minVol = Math.min(before[0], during[0]);
            String rawQuality = minVol >= 15 ? "HIGH" : minVol >= 6 ? "MEDIUM" : "LOW";
            String dataQuality = switch (signal) {
                case "MEASURED"  -> rawQuality;                      // day 7+: HIGH possible
                case "MEASURING" -> capQuality(rawQuality, "MEDIUM"); // day 2-6: capped at MEDIUM
                default           -> "LOW";                           // EARLY / PENDING
            };

            String targetName = p.getTargetProductName();
            if (targetName == null || targetName.isBlank()) {
                targetName = menuItemRepository.findByIdAndTenant_Id(p.getTargetProductId(), tenantId)
                        .map(MenuItem::getName).orElse("Item");
            }
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("title", p.getTitle());
            r.put("target", targetName);
            r.put("discountPercent", p.getDiscountPercent());
            r.put("status", ended ? "ended" : "running");
            r.put("windowDays", Math.max(1, len.toDays()));
            r.put("signal", signal); // PENDING | EARLY | MEASURING | MEASURED
            if (signal.equals("EARLY")) {
                r.put("note", "Too early to measure — needs at least " + (int) MIN_PROMO_DAYS
                        + " days of data against a real baseline before a change is meaningful.");
            } else if (signal.equals("MEASURING")) {
                r.put("note", "Directional only — still measuring; treat as early evidence until ~"
                        + (int) FULL_CONF_DAYS + " days of data.");
            }
            r.put("ordered", signalBlock(before[0], before[1], during[0], during[1], allowPct));   // early
            r.put("delivered", signalBlock(before[2], before[3], during[2], during[3], allowPct)); // final
            r.put("storeChangePercent", storePercent); // background trend (store-wide orders)
            r.put("netLiftPercent", netLift);          // item lift minus store-wide trend
            r.put("dataQuality", dataQuality);         // baseline + promo volume + duration
            r.put("comparisonGroup", "PRODUCT_SCOPE"); // NOT magnitude-comparable to ORDER_SCOPE rows
            out.add(r);
        }
        return Map.of("outcomes", out);
    }

    /**
     * Sales of one product in a window, split into two signals:
     *  - ORDERED (placed, not cancelled/rejected) — the dense EARLY signal
     *  - DELIVERED — the sparse FINAL signal
     * Returns [orderedUnits, orderedRevenue, deliveredUnits, deliveredRevenue].
     */
    private double[] productSales(UUID tenantId, UUID productId, Instant from, Instant to) {
        long oUnits = 0, dUnits = 0;
        double oRev = 0, dRev = 0;
        for (Order o : orderRepository.findByOrderDateBetweenAndTenant_Id(from, to, tenantId)) {
            OrderStatus st = OrderStatus.fromLabel(o.getStatus());
            if (st != null && st.isVoided()) continue; // exclude cancelled/rejected
            if (o.getOrderItems() == null) continue;
            boolean delivered = OrderStatus.DELIVERED.matches(o.getStatus());
            for (var oi : o.getOrderItems()) {
                if (oi.getMenuItem() != null && productId.equals(oi.getMenuItem().getId())) {
                    long q = oi.getQuantity() != null ? oi.getQuantity() : 0;
                    double rev = oi.getTotalPrice() != null ? oi.getTotalPrice() : 0;
                    oUnits += q; oRev += rev;
                    if (delivered) { dUnits += q; dRev += rev; }
                }
            }
        }
        return new double[]{oUnits, oRev, dUnits, dRev};
    }

    /** Store-wide placed (non-voided) order count in a window — the background baseline. */
    private long storeOrders(UUID tenantId, Instant from, Instant to) {
        return orderRepository.findByOrderDateBetweenAndTenant_Id(from, to, tenantId).stream()
                .filter(o -> { OrderStatus s = OrderStatus.fromLabel(o.getStatus()); return s == null || !s.isVoided(); })
                .count();
    }

    private record LiftCalc(Long storePercent, Long itemPercent, Long netLift, double duringUnits) {}

    /**
     * Rate-normalised lift for one product over [start, duringEnd], measured against a
     * STABLE 14-day pre-promo baseline (orders/day). Shared by the outcomes view and the
     * learning recorder so both compute net lift identically.
     */
    private LiftCalc computeLift(UUID tenantId, UUID productId, Instant start, Instant duringEnd) {
        Duration len = Duration.between(start, duringEnd);
        double durDays = Math.max(0.25, len.toHours() / 24.0);
        Instant baseStart = start.minus(Duration.ofDays(14));
        double baseDays = Math.max(1.0, Duration.between(baseStart, start).toHours() / 24.0);

        long storeBaseCount = storeOrders(tenantId, baseStart, start);
        double storeBasePerDay = storeBaseCount / baseDays;
        double storeDurPerDay = storeOrders(tenantId, start, duringEnd) / durDays;
        // Suppress the store % when the baseline is too thin to normalise against — else a
        // near-zero baseline produces absurd figures (e.g. +5000%).
        Long storePercent = (storeBaseCount >= MIN_STORE_BASELINE && storeBasePerDay > 0)
                ? Math.round((storeDurPerDay - storeBasePerDay) / storeBasePerDay * 100.0) : null;

        double itemBaseUnits = productSales(tenantId, productId, baseStart, start)[0];
        double duringUnits = productSales(tenantId, productId, start, duringEnd)[0];
        double itemBasePerDay = itemBaseUnits / baseDays;
        double itemDurPerDay = duringUnits / durDays;
        Long itemPercent = (itemBaseUnits >= MIN_BASELINE_UNITS && itemBasePerDay > 0)
                ? Math.round((itemDurPerDay - itemBasePerDay) / itemBasePerDay * 100.0) : null;

        Long netLift = (itemPercent != null && storePercent != null) ? itemPercent - storePercent : null;
        return new LiftCalc(storePercent, itemPercent, netLift, duringUnits);
    }

    // ── Layer C (V53): order-level Net Revenue Lift for ALL-scoped promos ──────────────────────

    /** Store-wide non-voided [orderCount, revenue] in a window — the order-level baseline. */
    private double[] orderRevenue(UUID tenantId, Instant from, Instant to) {
        long count = 0; double revenue = 0;
        for (Order o : orderRepository.findByOrderDateBetweenAndTenant_Id(from, to, tenantId)) {
            OrderStatus s = OrderStatus.fromLabel(o.getStatus());
            if (s != null && s.isVoided()) continue;
            count++;
            revenue += o.getTotalAmount() != null ? o.getTotalAmount() : 0;
        }
        return new double[]{count, revenue};
    }

    /** EXACT promo cost (V52) over a window for ONE promo — anchored on the stable promo_id (V53),
     *  immune to code/title edits. Returns [redeemedOrders, cost = Σ(discountAmount + waivedDeliveryFee)]. */
    private double[] promoCost(UUID tenantId, UUID promoId, Instant from, Instant to) {
        long redeemed = 0; double cost = 0;
        for (Order o : orderRepository.findByOrderDateBetweenAndTenant_Id(from, to, tenantId)) {
            if (!promoId.equals(o.getPromoId())) continue;
            redeemed++;
            cost += (o.getDiscountAmount() != null ? o.getDiscountAmount() : 0)
                  + (o.getWaivedDeliveryFee() != null ? o.getWaivedDeliveryFee() : 0);
        }
        return new double[]{redeemed, cost};
    }

    private record OrderLiftCalc(Long expectedRevenue, double duringRevenue, Long incrementalRevenue,
                                 long exposedOrders, long baselineOrders) {}

    /** Order-level revenue lift over [start, duringEnd] vs a 14-day temporal baseline. There is NO
     *  store-trend control (an ALL promo IS the store), so this is correlational, not causal. When
     *  the baseline is too thin the whole estimated set is meaningless -> all null (cost stays exact). */
    private OrderLiftCalc computeOrderLift(UUID tenantId, Instant start, Instant duringEnd) {
        Duration len = Duration.between(start, duringEnd);
        double durDays = Math.max(0.25, len.toHours() / 24.0);
        Instant baseStart = start.minus(Duration.ofDays(14));
        double baseDays = Math.max(1.0, Duration.between(baseStart, start).toHours() / 24.0);

        double[] base = orderRevenue(tenantId, baseStart, start);
        double[] during = orderRevenue(tenantId, start, duringEnd);
        long baselineOrders = (long) base[0];
        long exposedOrders = (long) during[0];

        if (baselineOrders < MIN_STORE_BASELINE) {
            return new OrderLiftCalc(null, during[1], null, exposedOrders, baselineOrders);
        }
        long expected = Math.round(base[1] / baseDays * durDays);
        long incremental = Math.round(during[1] - expected);
        return new OrderLiftCalc(expected, during[1], incremental, exposedOrders, baselineOrders);
    }

    /** Net-Revenue-Lift outcome row for an ALL-scoped promo. Cost is EXACT (V52); revenue is an
     *  explicitly correlational temporal estimate. Not magnitude-comparable to PRODUCT-scope rows. */
    private Map<String, Object> orderScopeOutcome(UUID tenantId, Promotion p, Instant start, Instant now) {
        boolean ended = p.getEndAt() != null && p.getEndAt().toInstant().isBefore(now);
        Instant duringEnd = ended ? p.getEndAt().toInstant() : now;
        Duration len = Duration.between(start, duringEnd);
        double durDays = len.toHours() / 24.0;

        OrderLiftCalc lift = computeOrderLift(tenantId, start, duringEnd);
        double[] cost = promoCost(tenantId, p.getId(), start, duringEnd);
        long redeemed = (long) cost[0];

        // Tier driven by BOTH duration AND baseline volume — a long promo on a thin baseline is
        // never MEASURED.
        boolean baselineOk = lift.baselineOrders() >= MIN_STORE_BASELINE;
        String signal;
        if (lift.exposedOrders() == 0 && redeemed == 0) signal = "PENDING";
        else if (durDays < MIN_PROMO_DAYS || !baselineOk) signal = "EARLY";
        else if (durDays < FULL_CONF_DAYS) signal = "MEASURING";
        else signal = "MEASURED";
        boolean allow = signal.equals("MEASURING") || signal.equals("MEASURED");

        Long expected = allow ? lift.expectedRevenue() : null;
        Long incremental = allow ? lift.incrementalRevenue() : null;
        Long netLift = (incremental != null) ? incremental - Math.round(cost[1]) : null;

        Map<String, Object> r = new LinkedHashMap<>();
        r.put("title", p.getTitle());
        r.put("scope", "ALL");
        r.put("promoType", p.getType() != null ? p.getType().name() : "PERCENT_OFF");
        r.put("fundedBy", p.getType() == Promotion.PromoType.FREE_DELIVERY ? "PLATFORM" : "STORE");
        r.put("status", ended ? "ended" : "running");
        r.put("windowDays", Math.max(1, len.toDays()));
        r.put("signal", signal);                                  // PENDING | EARLY | MEASURING | MEASURED
        r.put("exposedOrders", lift.exposedOrders());             // TIME-exposed, not behaviorally-exposed
        r.put("redeemedOrders", redeemed);
        r.put("promoCost", Math.round(cost[1] * 100.0) / 100.0);  // EXACT (V52) — always shown
        r.put("duringRevenue", Math.round(lift.duringRevenue() * 100.0) / 100.0);
        r.put("expectedRevenue", expected);                       // estimated — null below the floor
        r.put("incrementalRevenue", incremental);                 // estimated
        r.put("netRevenueLift", netLift);                         // estimated
        r.put("basis", "correlational/time-exposed");
        r.put("comparisonGroup", "ORDER_SCOPE");                  // NOT comparable to PRODUCT_SCOPE
        return r;
    }

    /**
     * The LEARNING step: when a PRODUCT promo has ended, persist its measured net lift once
     * (deduped by promo id) so future suggestions can rank by historical response. Best-effort.
     */
    @org.springframework.transaction.annotation.Transactional
    public void recordEndedPromoOutcomes(UUID tenantId) {
        Instant now = Instant.now();
        for (Promotion p : promotionRepository.findByTenant_Id(tenantId)) {
            if (p.getAppliesTo() != Promotion.AppliesTo.PRODUCT || p.getTargetProductId() == null
                    || p.getStartAt() == null || p.getEndAt() == null) continue;
            if (p.getEndAt().toInstant().isAfter(now)) continue;          // not ended yet
            if (promoOutcomeRecordRepository.existsByPromoId(p.getId())) continue; // already recorded
            LiftCalc lift = computeLift(tenantId, p.getTargetProductId(), p.getStartAt().toInstant(), p.getEndAt().toInstant());
            if (lift.netLift() == null) continue; // not measurable
            PromoOutcomeRecord rec = new PromoOutcomeRecord();
            rec.setTenantId(tenantId);
            rec.setProductId(p.getTargetProductId());
            rec.setPromoId(p.getId());
            rec.setNetLiftPercent((int) (long) lift.netLift());
            rec.setSampleUnits((int) lift.duringUnits());
            promoOutcomeRecordRepository.save(rec);
        }
    }

    /** Per-product history: productId → [avgNetLift, sampleCount]. Empty if nothing recorded. */
    private Map<UUID, double[]> promoHistory(UUID tenantId) {
        Map<UUID, double[]> hist = new HashMap<>();
        for (PromoOutcomeRecord r : promoOutcomeRecordRepository.findByTenantId(tenantId)) {
            if (r.getProductId() == null || r.getNetLiftPercent() == null) continue;
            double[] cur = hist.computeIfAbsent(r.getProductId(), k -> new double[2]);
            cur[0] += r.getNetLiftPercent();
            cur[1] += 1;
        }
        return hist;
    }

    // ── Feature: Alert calibration (predict → act → measure) ────────────────

    /** On apply: snapshot what the alert PREDICTED + the subject item's baseline rate. */
    @org.springframework.transaction.annotation.Transactional
    public void recordAlertApplied(UUID tenantId, String alertKey, String impactJson, String actionJson) {
        if (tenantId == null || alertKey == null) return;
        AlertOutcome o = new AlertOutcome();
        o.setTenantId(tenantId);
        o.setAlertKey(alertKey);
        o.setAlertType(alertKey.contains(":") ? alertKey.substring(0, alertKey.indexOf(':')) : alertKey);
        try {
            if (impactJson != null && !impactJson.isBlank()) {
                @SuppressWarnings("unchecked")
                Map<String, Object> m = objectMapper.readValue(impactJson, Map.class);
                o.setPredictedRevenueAtRisk(asDouble(m.get("revenueAtRisk")));
                o.setPredictedNetAtRisk(asDouble(m.get("netProfitAtRisk")));
            }
        } catch (Exception ignored) { /* impact optional */ }
        try {
            if (actionJson != null && !actionJson.isBlank()) {
                @SuppressWarnings("unchecked")
                Map<String, Object> act = objectMapper.readValue(actionJson, Map.class);
                if (act.get("params") instanceof Map<?, ?> params && params.get("itemId") != null) {
                    UUID itemId = UUID.fromString(params.get("itemId").toString());
                    o.setItemId(itemId);
                    Instant now = Instant.now();
                    o.setBaselineUnits30d((int) productSales(tenantId, itemId, now.minus(Duration.ofDays(30)), now)[0]);
                }
            }
        } catch (Exception ignored) { /* no item subject */ }
        alertOutcomeRepository.save(o);
    }

    /**
     * Calibration readout: each applied alert fix, with the PREDICTED impact next to the
     * OBSERVED change in the subject item's sales rate since the fix (vs its prior rate).
     * Observational — shows how well predictions track reality, never claims causation.
     */
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public Map<String, Object> alertOutcomes(UUID tenantId) {
        Instant now = Instant.now();
        List<Map<String, Object>> out = new ArrayList<>();
        for (AlertOutcome o : alertOutcomeRepository.findByTenantId(tenantId)) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("alertType", o.getAlertType());
            r.put("appliedAt", o.getAppliedAt() != null ? o.getAppliedAt().toString() : null);
            r.put("predictedRevenueAtRisk", o.getPredictedRevenueAtRisk());
            r.put("predictedNetAtRisk", o.getPredictedNetAtRisk());
            r.put("basis", "OBSERVATIONAL");

            if (o.getItemId() != null && o.getAppliedAt() != null) {
                r.put("item", menuItemRepository.findByIdAndTenant_Id(o.getItemId(), tenantId)
                        .map(MenuItem::getName).orElse("item"));
                Instant applied = o.getAppliedAt().atZone(ZoneId.systemDefault()).toInstant();
                double hours = Duration.between(applied, now).toHours();
                if (hours >= 24) {
                    double windowDays = Math.max(0.5, hours / 24.0);
                    double observedRate = productSales(tenantId, o.getItemId(), applied, now)[0] / windowDays;
                    double baselineRate = o.getBaselineUnits30d() != null ? o.getBaselineUnits30d() / 30.0 : 0;
                    r.put("status", "MEASURED");
                    r.put("windowDays", Math.round(windowDays));
                    r.put("baselineRatePerDay", Math.round(baselineRate * 100.0) / 100.0);
                    r.put("observedRatePerDay", Math.round(observedRate * 100.0) / 100.0);
                    r.put("rateChangePercent", baselineRate > 0
                            ? Math.round((observedRate - baselineRate) / baselineRate * 100.0) : null);
                } else {
                    r.put("status", "PENDING"); // too soon to measure
                }
            } else {
                r.put("status", "NO_SUBJECT"); // store-level fix, no per-item rate to track
            }
            out.add(r);
        }
        Map<String, Object> calib = new LinkedHashMap<>();
        alertCalibration(tenantId).forEach((t, c) ->
                calib.put(t, Map.of("factor", Math.round(c.factor() * 100.0) / 100.0, "samples", c.samples())));
        return Map.of("outcomes", out, "calibration", calib);
    }

    private Double asDouble(Object o) {
        return o instanceof Number n ? n.doubleValue() : null;
    }

    /** A learned correction for one alert family: how to scale its predictions, and on how much evidence. */
    public record Calibration(double factor, int samples) {}

    /**
     * Closes the loop: per alert type, the mean ratio of OBSERVED post-fix sales rate to the
     * PREDICTED baseline rate across measured outcomes — SHRUNK toward 1.0 until there's enough
     * evidence (so one noisy point barely moves it) and BOUNDED to [0.5, 2.0]. A type whose
     * forecasts ran low gets scaled up next time, and vice-versa. Observational, never causal.
     */
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public Map<String, Calibration> alertCalibration(UUID tenantId) {
        Map<String, double[]> agg = new HashMap<>(); // type -> [sumRatio, count]
        Instant now = Instant.now();
        for (AlertOutcome o : alertOutcomeRepository.findByTenantId(tenantId)) {
            if (o.getItemId() == null || o.getAppliedAt() == null
                    || o.getBaselineUnits30d() == null || o.getBaselineUnits30d() <= 0) continue;
            Instant applied = o.getAppliedAt().atZone(ZoneId.systemDefault()).toInstant();
            double hours = Duration.between(applied, now).toHours();
            if (hours < 24) continue; // not measurable yet
            double windowDays = Math.max(0.5, hours / 24.0);
            double observedRate = productSales(tenantId, o.getItemId(), applied, now)[0] / windowDays;
            double baselineRate = o.getBaselineUnits30d() / 30.0;
            double[] cur = agg.computeIfAbsent(o.getAlertType(), k -> new double[2]);
            cur[0] += observedRate / baselineRate;
            cur[1] += 1;
        }
        final double K = 3.0; // shrinkage strength toward 1.0 (= no adjustment)
        Map<String, Calibration> out = new HashMap<>();
        agg.forEach((type, v) -> {
            double n = v[1], rawMean = v[0] / n;
            double shrunk = (n * rawMean + K) / (n + K);              // Bayesian-style pull to 1.0
            out.put(type, new Calibration(Math.max(0.5, Math.min(2.0, shrunk)), (int) n));
        });
        return out;
    }

    /**
     * before/during units+revenue for one signal. The % unit change is only included when
     * {@code allowPct} (the window is long enough) AND the baseline is non-trivial — otherwise
     * the percentage would be noise (e.g. 3 -> 33 = "+1000%" on a 1-day window).
     */
    private Map<String, Object> signalBlock(double beforeUnits, double beforeRev, double duringUnits, double duringRev, boolean allowPct) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("before", Map.of("units", (long) beforeUnits, "revenue", Math.round(beforeRev * 100.0) / 100.0));
        m.put("during", Map.of("units", (long) duringUnits, "revenue", Math.round(duringRev * 100.0) / 100.0));
        m.put("unitsPercent", (allowPct && beforeUnits >= MIN_BASELINE_UNITS)
                ? Math.round((duringUnits - beforeUnits) / beforeUnits * 100.0) : null);
        return m;
    }

    // ── Feature 3: Review Digest ────────────────────────────────────────────

    public Map<String, Object> reviewDigest(UUID tenantId, LocalDate since) {
        String cacheKey = tenantId + "|" + (since != null ? since.toString() : "last7");
        CachedDigest cached = digestCache.get(cacheKey);
        if (cached != null && cached.isValid()) {
            return cached.result;
        }

        LocalDateTime sinceDateTime = since != null
                ? since.atStartOfDay()
                : LocalDateTime.now().minusDays(7);

        List<Review> reviews = reviewRepository.findByTenant_IdOrderByCreatedAtDesc(tenantId)
                .stream()
                .filter(r -> r.getCreatedAt() != null && r.getCreatedAt().isAfter(sinceDateTime))
                .collect(Collectors.toList());

        if (reviews.isEmpty()) {
            return Map.of(
                    "period", formatPeriod(sinceDateTime),
                    "sentimentScore", 0,
                    "positives", List.of(),
                    "negatives", List.of(),
                    "recommendation", "No reviews in this period yet."
            );
        }

        StringBuilder sb = new StringBuilder();
        for (Review r : reviews) {
            if (r.getComment() != null && !r.getComment().isBlank()) {
                String line = String.format("[%d stars] %s\n", r.getRating(), r.getComment().trim());
                if (sb.length() + line.length() > 4000) break;
                sb.append(line);
            }
        }

        String prompt =
                "You are an analytics assistant for a restaurant on a South African food delivery app.\n" +
                "Summarise the following customer reviews from the past week.\n" +
                "Return JSON only, no markdown:\n" +
                "{\n" +
                "  \"sentimentScore\": <0.0–10.0>,\n" +
                "  \"positives\": [\"<theme 1>\", \"<theme 2>\", \"<theme 3>\"],\n" +
                "  \"negatives\": [\"<theme 1>\", \"<theme 2>\"],\n" +
                "  \"recommendation\": \"<one actionable sentence>\"\n" +
                "}\n" +
                "Reviews:\n" + sb;

        Map<String, Object> fallback = Map.of(
                "period", formatPeriod(sinceDateTime),
                "sentimentScore", 0,
                "positives", List.of(),
                "negatives", List.of(),
                "recommendation", "Unable to process reviews at this time.");

        // Give the model enough room for the JSON, and NEVER cache a failure (so a retry
        // can succeed instead of serving the cached fallback for 6 hours).
        String raw = anthropicClient.call(prompt, 700);
        if (raw == null || raw.isBlank()) return fallback;

        Map<String, Object> result = new HashMap<>(parseJsonOrFallback(raw, fallback));
        result.putIfAbsent("period", formatPeriod(sinceDateTime));
        if (!"Unable to process reviews at this time.".equals(result.get("recommendation"))) {
            digestCache.put(cacheKey, new CachedDigest(result)); // cache only a genuine digest
        }
        return result;
    }

    // ── Feature: AI Support Desk ───────────────────────────────────────────

    /**
     * Drafts a reply to a customer support ticket, plus triage metadata
     * (category, urgency) and an internal suggested resolution (e.g. a credit).
     * One-shot, read-only — the owner reviews/edits before anything is sent.
     */
    public Map<String, Object> draftSupportReply(String subject, String message, UUID orderId) {
        Map<String, Object> fallback = Map.of(
                "category", "Other",
                "urgency", "medium",
                "draftReply", "Thanks for reaching out — we're looking into this and will come back to you shortly.",
                "suggestedResolution", "Review the ticket and respond",
                "suggestedStatus", "IN_PROGRESS");
        if (!anthropicClient.isConfigured()) return fallback;

        // Pull the linked order's real details so the reply references THEM instead of asking the
        // customer for an order number they already gave.
        String orderContext = "";
        if (orderId != null) {
            Order o = orderRepository.findById(orderId).orElse(null);
            if (o != null) {
                StringBuilder sb = new StringBuilder("\nThis ticket is about order #")
                        .append(o.getId().toString().substring(0, 8))
                        .append(" — current status: ").append(o.getStatus());
                if (o.getDriver() != null) {
                    sb.append("; driver: ").append(o.getDriver().getFullName() != null
                            ? o.getDriver().getFullName() : o.getDriver().getEmail());
                }
                if (o.getOrderItems() != null && !o.getOrderItems().isEmpty()) {
                    sb.append("; items: ").append(o.getOrderItems().stream()
                            .map(oi -> oi.getQuantity() + "x " + oi.getName())
                            .reduce((a, b) -> a + ", " + b).orElse(""));
                }
                if (o.getOrderDate() != null) {
                    sb.append("; placed ").append(java.time.Duration.between(o.getOrderDate(), java.time.Instant.now()).toMinutes()).append(" min ago");
                }
                orderContext = sb.append(".\nYou already have the order details above — DO NOT ask the customer "
                        + "for their order number. Reference the actual status and give a specific next step.\n").toString();
            }
        }

        String prompt =
                "You are a warm, professional customer-support agent for a South African food-delivery store on CraveIt.\n" +
                "A customer raised this support ticket:\n" +
                "Subject: " + (subject != null ? subject : "") + "\n" +
                "Message: " + (message != null ? message : "") + "\n" +
                orderContext + "\n" +
                "Return JSON only, no markdown:\n" +
                "{\n" +
                "  \"category\": \"<one of: Delivery, Food quality, Payment/Refund, Order issue, Account, Other>\",\n" +
                "  \"urgency\": \"<low | medium | high>\",\n" +
                "  \"draftReply\": \"<a warm, concise reply TO THE CUSTOMER, 2-4 sentences, South African English; own the issue, apologise if warranted, and give a clear next step or resolution. No placeholders or brackets.>\",\n" +
                "  \"suggestedResolution\": \"<short internal note for the owner, e.g. 'Refund the delivery fee', 'Offer R20 loyalty credit', 'Explain — no refund due'>\",\n" +
                "  \"suggestedStatus\": \"<OPEN | IN_PROGRESS | RESOLVED>\"\n" +
                "}";
        String raw = anthropicClient.call(prompt);
        return (raw != null && !raw.isBlank()) ? parseJsonOrFallback(raw, fallback) : fallback;
    }

    /**
     * Drafts a short, sincere PUBLIC reply to a single customer review.
     * One-shot, read-only — the owner copies/edits before posting.
     */
    public Map<String, Object> draftReviewReply(int rating, String comment) {
        String fb = rating >= 4
                ? "Thank you so much for the kind words — we're thrilled you enjoyed it and can't wait to serve you again!"
                : "We're really sorry your experience fell short. Thank you for the honest feedback — we're on it and would love the chance to make it right.";
        if (!anthropicClient.isConfigured()) return Map.of("reply", fb);
        String prompt =
                "You are the owner of a South African food-delivery store on CraveIt, replying PUBLICLY to a customer review.\n" +
                "Rating: " + rating + "/5\nComment: " + (comment != null && !comment.isBlank() ? comment : "(no comment left)") + "\n\n" +
                "Write a warm, sincere, SHORT public reply (1-3 sentences, South African English). For a positive review, thank them specifically; for a negative one, own it, apologise briefly, and invite them back. Do NOT promise refunds or use placeholders/brackets.\n" +
                "Return JSON only: { \"reply\": \"<text>\" }";
        String raw = anthropicClient.call(prompt);
        return (raw != null && !raw.isBlank()) ? parseJsonOrFallback(raw, Map.of("reply", fb)) : Map.of("reply", fb);
    }

    /**
     * Bulk-write appetising descriptions for every menu item that's missing one,
     * in a single AI call. Only fills blanks (never overwrites). Returns the count.
     */
    @org.springframework.transaction.annotation.Transactional
    public Map<String, Object> bulkGenerateDescriptions(UUID tenantId) {
        if (tenantId == null || !anthropicClient.isConfigured()) return Map.of("updated", 0);
        List<MenuItem> missing = menuItemRepository.findByTenant_Id(tenantId).stream()
                .filter(i -> i.getName() != null && (i.getDescription() == null || i.getDescription().isBlank()))
                .limit(40)
                .collect(Collectors.toList());
        if (missing.isEmpty()) return Map.of("updated", 0);

        StringBuilder sb = new StringBuilder();
        for (MenuItem mi : missing) {
            sb.append("- ").append(mi.getName())
              .append(" | ").append(mi.getCategory() != null ? mi.getCategory() : "").append('\n');
        }
        String prompt =
                "You are a menu copywriter for a South African food-delivery app called CraveIt.\n" +
                "Write a short (UNDER 120 characters), appetising description for EACH item below.\n" +
                "Return JSON only, no markdown:\n" +
                "{ \"items\": [ { \"name\": \"<exact item name>\", \"description\": \"<text>\" } ] }\n" +
                "Items (name | category):\n" + sb;
        String raw = anthropicClient.call(prompt, 1500);
        Map<String, Object> parsed = parseJsonOrFallback(raw, Map.of("items", List.of()));

        int updated = 0;
        if (parsed.get("items") instanceof List<?> list) {
            Map<String, MenuItem> byName = missing.stream()
                    .collect(Collectors.toMap(m -> m.getName().toLowerCase(), m -> m, (a, b) -> a));
            for (Object o : list) {
                if (!(o instanceof Map<?, ?> m)) continue;
                Object n = m.get("name");
                Object d = m.get("description");
                if (n == null || d == null) continue;
                MenuItem item = byName.get(n.toString().toLowerCase());
                if (item != null && !d.toString().isBlank()) {
                    item.setDescription(d.toString().trim());
                    menuItemRepository.save(item);
                    updated++;
                }
            }
        }
        return Map.of("updated", updated);
    }

    // ── Feature: Plan-fit advisor ──────────────────────────────────────────

    /**
     * Advises whether the store's subscription fits its real usage & growth:
     * UPGRADE (near limits / growing), GOOD_FIT, or CONSIDER_DOWNGRADE (very low use).
     */
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public Map<String, Object> planAdvice(UUID tenantId) {
        Map<String, Object> fallback = Map.of("verdict", "GOOD_FIT",
                "recommendation", "Your plan looks like a reasonable fit for your current usage.");
        if (tenantId == null) return fallback;
        SubscriptionPlan plan;
        try { plan = subscriptionEnforcementService.getPlan(tenantId); } catch (Exception e) { return fallback; }

        long items = menuItemRepository.countByTenant_Id(tenantId);
        long activePromos = promotionRepository.countByTenant_IdAndActiveTrue(tenantId);
        Instant now = Instant.now();
        long orders30 = orderRepository.findByOrderDateBetweenAndTenant_Id(now.minus(Duration.ofDays(30)), now, tenantId)
                .stream().filter(o -> OrderStatus.DELIVERED.matches(o.getStatus())).count();
        long ordersPrev30 = orderRepository.findByOrderDateBetweenAndTenant_Id(
                now.minus(Duration.ofDays(60)), now.minus(Duration.ofDays(30)), tenantId)
                .stream().filter(o -> OrderStatus.DELIVERED.matches(o.getStatus())).count();

        // Structured usage so the UI shows the numbers as stats, not buried in prose.
        Map<String, Object> usage = new LinkedHashMap<>();
        usage.put("plan", plan.getName());
        usage.put("menuItems", items);
        usage.put("maxMenuItems", plan.getMaxMenuItems());
        usage.put("activePromos", activePromos);
        usage.put("maxPromotions", plan.getMaxPromotions());
        usage.put("orders30d", orders30);
        usage.put("ordersPrev30d", ordersPrev30);
        usage.put("ordersTrendPercent", ordersPrev30 > 0
                ? Math.round((orders30 - ordersPrev30) / (double) ordersPrev30 * 100.0) : null);

        boolean nearLimit = (plan.getMaxMenuItems() > 0 && items >= plan.getMaxMenuItems() * 0.8)
                || (plan.getMaxPromotions() > 0 && activePromos >= plan.getMaxPromotions());
        String ruleVerdict = nearLimit ? "UPGRADE" : "GOOD_FIT";

        Map<String, Object> result;
        if (!anthropicClient.isConfigured()) {
            result = new LinkedHashMap<>();
            result.put("verdict", ruleVerdict);
            result.put("recommendation", nearLimit
                    ? "You're close to your " + plan.getName() + " plan limits — upgrading unlocks more headroom."
                    : "Your " + plan.getName() + " plan comfortably covers your current usage.");
        } else {
            String prompt =
                    "You advise a restaurant owner on whether their CraveIt subscription fits, in South African English.\n" +
                    "Plan: " + plan.getName() + " (max menu items " + plan.getMaxMenuItems() +
                    ", max active promos " + plan.getMaxPromotions() +
                    ", analytics " + (plan.isHasAnalytics() ? "included" : "NOT included") + ").\n" +
                    "Usage: " + items + " menu items, " + activePromos + " active promos.\n" +
                    "Delivered orders: " + orders30 + " last 30 days (" + ordersPrev30 + " the 30 days before).\n" +
                    "The UI ALREADY shows these numbers as stats, so do NOT repeat the figures — give ONE short, " +
                    "specific recommendation (max 1 sentence, ~20 words) and a verdict. UPGRADE if near/at limits or " +
                    "growing fast and they'd benefit from headroom or analytics; GOOD_FIT if it suits them; " +
                    "CONSIDER_DOWNGRADE only if usage is very low and flat. Be honest, not pushy.\n" +
                    "Return JSON only: { \"verdict\": \"UPGRADE|GOOD_FIT|CONSIDER_DOWNGRADE\", \"recommendation\": \"<text>\" }";
            String raw = anthropicClient.call(prompt);
            result = (raw != null && !raw.isBlank())
                    ? new LinkedHashMap<>(parseJsonOrFallback(raw, Map.of("verdict", ruleVerdict, "recommendation", "")))
                    : new LinkedHashMap<>(fallback);
        }
        result.put("usage", usage);
        return result;
    }

    // ── Feature: Reviews x Books (profit meets sentiment) ───────────────────

    /**
     * Cross-references per-item PROFIT (Books) with review SENTIMENT to surface a few
     * opportunities (high-profit AND well-reviewed) and risks (high-profit but flagged in
     * reviews). Deterministic + templated — no LLM. Sentiment is attributed at the ORDER
     * level (a review covers everything in its order), so it's directional, not causal.
     */
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public Map<String, Object> reviewBookInsights(UUID tenantId) {
        BookkeepingService.MoneyIn pl;
        try { pl = bookkeepingService.moneyIn(tenantId, 30); } catch (Exception e) { return Map.of("insights", List.of()); }
        if (pl.items() == null || pl.items().isEmpty()) return Map.of("insights", List.of());

        // Per-item sentiment from reviews of orders that contained the item.
        java.time.LocalDateTime since = java.time.LocalDateTime.now().minusDays(30);
        String[] complaintWords = {"cold", "late", "slow", "dry", "wrong", "missing", "lukewarm", "long", "raw", "burnt", "soggy"};
        Map<String, double[]> sentiment = new HashMap<>(); // nameLC -> [ratingSum, count, complaintCount]
        for (Review rv : reviewRepository.findByTenant_IdOrderByCreatedAtDesc(tenantId)) {
            if (rv.getCreatedAt() == null || rv.getCreatedAt().isBefore(since) || rv.getOrder() == null
                    || rv.getOrder().getOrderItems() == null) continue;
            String comment = rv.getComment() != null ? rv.getComment().toLowerCase() : "";
            boolean complaint = rv.getRating() <= 2;
            for (String w : complaintWords) if (comment.contains(w)) { complaint = true; break; }
            Set<String> namesInOrder = new HashSet<>();
            for (var oi : rv.getOrder().getOrderItems()) {
                if (oi.getMenuItem() != null && oi.getMenuItem().getName() != null)
                    namesInOrder.add(oi.getMenuItem().getName().toLowerCase());
            }
            for (String nm : namesInOrder) {
                double[] s = sentiment.computeIfAbsent(nm, k -> new double[3]);
                s[0] += rv.getRating(); s[1] += 1; if (complaint) s[2] += 1;
            }
        }

        double topProfit = pl.items().get(0).getProfit(); // items are profit-sorted desc
        List<Map<String, Object>> opportunities = new ArrayList<>();
        List<Map<String, Object>> risks = new ArrayList<>();
        for (BookkeepingService.ItemLine il : pl.items()) {
            if (il.name == null || il.getProfit() <= 0 || il.getProfit() < topProfit * 0.4) continue; // real contributor
            double[] s = sentiment.get(il.name.toLowerCase());
            if (s == null || s[1] < 2) continue; // need enough review signal
            double avg = s[0] / s[1];
            int reviews = (int) s[1], complaints = (int) s[2];

            String type, message;
            if (avg >= 4.0 && complaints == 0) {
                type = "OPPORTUNITY";
                message = il.name + " is one of your most profitable items and well-reviewed ("
                        + String.format(Locale.UK, "%.1f", avg) + "/5 across " + reviews
                        + " orders). Featuring it in a promotion or as a homepage pick leans into a proven strength.";
            } else if (avg <= 3.2 || complaints >= 2) { // a pattern, not one noisy review
                type = "RISK";
                message = il.name + " is a high-profit item (R" + String.format(Locale.UK, "%.0f", il.getProfit())
                        + ") but recent reviews flag concerns (" + String.format(Locale.UK, "%.1f", avg) + "/5"
                        + (complaints > 0 ? ", " + complaints + " mentioning quality or delivery" : "")
                        + "). Protecting its quality preserves real profit.";
            } else {
                continue;
            }
            Map<String, Object> ins = new LinkedHashMap<>();
            ins.put("type", type);
            ins.put("item", il.name);
            ins.put("profit", il.getProfit());
            ins.put("marginPercent", il.getMarginPercent());
            ins.put("avgRating", Math.round(avg * 10.0) / 10.0);
            ins.put("reviewCount", reviews);
            ins.put("complaintCount", complaints);
            ins.put("message", message);
            (type.equals("RISK") ? risks : opportunities).add(ins);
        }

        // Interleave (risks first each round) so the card shows BOTH kinds, not just the
        // top-4 most-profitable items — which would otherwise be all opportunities. Cap 4.
        List<Map<String, Object>> insights = new ArrayList<>();
        int ri = 0, oi = 0;
        while (insights.size() < 4 && (ri < risks.size() || oi < opportunities.size())) {
            if (ri < risks.size()) insights.add(risks.get(ri++));
            if (insights.size() < 4 && oi < opportunities.size()) insights.add(opportunities.get(oi++));
        }
        return Map.of("insights", insights);
    }

    // ── Feature: Driver Operations Insights (admin) ─────────────────────────

    /**
     * Deterministic driver analytics for the admin: a scorecard (deliveries, avg delivery
     * time, customer rating per driver), templated top-performer / opportunity insights, and
     * a coverage note for the peak delivery window. Pure data — no LLM, observational only.
     */
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public Map<String, Object> driverInsights(UUID tenantId) {
        List<User> drivers = userRepository.findByRoleAndTenant_Id(Role.DRIVER, tenantId);
        Instant now = Instant.now();
        List<Order> delivered = orderRepository
                .findByOrderDateBetweenAndTenant_Id(now.minus(Duration.ofDays(30)), now, tenantId).stream()
                .filter(o -> OrderStatus.DELIVERED.matches(o.getStatus()) && o.getDriver() != null)
                .collect(Collectors.toList());

        ZoneId sast = ZoneId.of("Africa/Johannesburg");
        Map<UUID, long[]> stats = new HashMap<>();  // driverId -> [deliveries, sumMinutes, timedCount]
        Map<Integer, Integer> hourHist = new HashMap<>();
        for (Order o : delivered) {
            long[] s = stats.computeIfAbsent(o.getDriver().getId(), k -> new long[3]);
            s[0]++;
            if (o.getOrderDate() != null && o.getDeliveredAt() != null) {
                long mins = Duration.between(o.getOrderDate(), o.getDeliveredAt()).toMinutes();
                if (mins >= 0 && mins < 600) { s[1] += mins; s[2]++; }
                hourHist.merge(o.getDeliveredAt().atZone(sast).getHour(), 1, Integer::sum);
            }
        }
        // This week's load distribution (grounded — real deliveries, last 7 days).
        Instant weekAgo = now.minus(Duration.ofDays(7));
        Map<UUID, Long> weekCount = new HashMap<>();
        long weekTotal = 0;
        for (Order o : delivered) {
            if (o.getDeliveredAt() != null && o.getDeliveredAt().isAfter(weekAgo)) {
                weekCount.merge(o.getDriver().getId(), 1L, Long::sum);
                weekTotal++;
            }
        }

        // No driver rating: CraveIt reviews score the ORDER (food + experience), not the
        // driver, so attributing them to a driver would conflate kitchen issues with driving.
        // Deliveries and average time ARE genuinely driver-attributable; those are what we show.
        List<Map<String, Object>> scorecard = new ArrayList<>();
        for (User d : drivers) {
            long[] s = stats.get(d.getId());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name", d.getFullName() != null && !d.getFullName().isBlank() ? d.getFullName() : d.getEmail());
            row.put("deliveries", s != null ? s[0] : 0L);
            long wk = weekCount.getOrDefault(d.getId(), 0L);
            row.put("weekShare", weekTotal > 0 ? (int) Math.round(100.0 * wk / weekTotal) : null);
            row.put("avgDeliveryMinutes", (s != null && s[2] > 0) ? (int) (s[1] / s[2]) : null);
            // Recency-weighted on-time rate — the same signal the recommendation engine uses.
            row.put("onTimeRate", d.getDeliveryScoreEwma() != null ? (int) Math.round(d.getDeliveryScoreEwma() * 100) : null);
            row.put("ratedDeliveries", d.getDeliveryScoreSamples() != null ? d.getDeliveryScoreSamples() : 0);
            row.put("status", d.getDriverStatus() != null ? d.getDriverStatus().name() : null);
            scorecard.add(row);
        }
        scorecard.sort((a, b) -> Long.compare((Long) b.get("deliveries"), (Long) a.get("deliveries")));

        long sumMin = stats.values().stream().mapToLong(x -> x[1]).sum();
        long timed = stats.values().stream().mapToLong(x -> x[2]).sum();
        Integer fleetAvg = timed > 0 ? (int) (sumMin / timed) : null;

        // Templated, observational insights (top performer + an opportunity if one stands out).
        List<Map<String, Object>> insights = new ArrayList<>();
        List<Map<String, Object>> rated = scorecard.stream()
                .filter(d -> d.get("avgDeliveryMinutes") != null && (Long) d.get("deliveries") >= 5)
                .collect(Collectors.toList());
        if (!rated.isEmpty() && fleetAvg != null) {
            Map<String, Object> top = rated.stream()
                    .min(Comparator.comparingInt(d -> (Integer) d.get("avgDeliveryMinutes"))).orElse(null);
            if (top != null) {
                insights.add(insightRow("TOP", top.get("name") + " has the fastest average delivery time ("
                        + top.get("avgDeliveryMinutes") + " min over " + top.get("deliveries") + " deliveries)."));
            }
            Map<String, Object> slow = rated.stream()
                    .max(Comparator.comparingInt(d -> (Integer) d.get("avgDeliveryMinutes"))).orElse(null);
            if (slow != null && (Integer) slow.get("avgDeliveryMinutes") > fleetAvg * 1.2) {
                int pct = (int) Math.round(((Integer) slow.get("avgDeliveryMinutes") - fleetAvg) / (double) fleetAvg * 100);
                insights.add(insightRow("OPPORTUNITY", slow.get("name") + "'s average delivery time ("
                        + slow.get("avgDeliveryMinutes") + " min) is " + pct + "% above the fleet average of " + fleetAvg + " min."));
            }
        }

        // Load distribution — flag when one driver is carrying a large share this week.
        if (weekTotal >= 10) {
            scorecard.stream()
                    .filter(d -> d.get("weekShare") != null && (Integer) d.get("weekShare") >= 40)
                    .max(Comparator.comparingInt(d -> (Integer) d.get("weekShare")))
                    .ifPresent(d -> insights.add(insightRow("OPPORTUNITY",
                            d.get("name") + " handled " + d.get("weekShare") + "% of deliveries this week — consider spreading the load.")));
        }

        // Stale-location risk — a driver mid-delivery whose location hasn't updated recently.
        for (Order o : orderRepository.findByStatusAndTenant_IdOrderByOrderDateDesc("Out for Delivery", tenantId)) {
            User drv = o.getDriver();
            if (drv == null) continue;
            long ageMin = drv.getLastPing() != null ? Duration.between(drv.getLastPing(), now).toMinutes() : Long.MAX_VALUE;
            if (ageMin >= 30) {
                String who = drv.getFullName() != null && !drv.getFullName().isBlank() ? drv.getFullName() : drv.getEmail();
                insights.add(insightRow("RISK", who + " has an active delivery but " + (drv.getLastPing() == null
                        ? "has never shared a location." : "hasn't updated location in " + ageMin + " min.")));
                break; // one stale-location flag is enough; don't flood the card
            }
        }

        Map<String, Object> coverage = null;
        if (!hourHist.isEmpty()) {
            int peakHour = hourHist.entrySet().stream().max(Map.Entry.comparingByValue()).get().getKey();
            int peakCount = hourHist.get(peakHour);
            int total = hourHist.values().stream().mapToInt(Integer::intValue).sum();
            if (peakCount >= 8 && peakCount >= total * 0.2) { // a real concentration, not noise
                coverage = new LinkedHashMap<>();
                coverage.put("window", String.format("%02d:00-%02d:00", peakHour, (peakHour + 2) % 24));
                coverage.put("deliveries", peakCount);
                coverage.put("message", "Most deliveries cluster around " + String.format("%02d:00", peakHour)
                        + " (" + peakCount + " of " + total + "). Extra cover in this window could ease delays.");
            }
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("scorecard", scorecard);
        out.put("insights", insights);
        out.put("coverage", coverage);
        out.put("fleetAvgMinutes", fleetAvg);
        return out;
    }

    private Map<String, Object> insightRow(String type, String message) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", type);
        m.put("message", message);
        return m;
    }

    // ── Feature 4: Conversational Analytics ────────────────────────────────

    public Map<String, Object> queryAnalytics(String question, UUID tenantId) {
        // Step 1 — classify intent (includes CONVERSATIONAL for chitchat)
        String classifyPrompt =
                "Classify this message from a restaurant owner into one of these intents:\n" +
                "TOP_ITEM_ORDERS, TOP_ITEM_REVENUE, REVENUE_COMPARISON, PEAK_HOUR, ORDER_COUNT, NEW_CUSTOMERS, CONVERSATIONAL\n" +
                "Use CONVERSATIONAL for greetings, follow-up reactions, thank-yous, general questions about capabilities, or anything that is not a specific data query.\n" +
                "Also extract the time period if relevant: THIS_WEEK, THIS_MONTH, LAST_WEEK, LAST_MONTH, TODAY (use THIS_MONTH as default for data queries).\n" +
                "Return JSON only:\n" +
                "{ \"intent\": \"<INTENT>\", \"period\": \"<PERIOD>\" }\n" +
                "Message: \"" + question.replace("\"", "'") + "\"";

        String classifyRaw = anthropicClient.call(classifyPrompt);
        Map<String, Object> classification = (classifyRaw != null && !classifyRaw.isBlank())
                ? parseJsonOrFallback(classifyRaw, classifyWithKeywords(question))
                : classifyWithKeywords(question);

        String intent = String.valueOf(classification.getOrDefault("intent", "ORDER_COUNT"));
        String period = String.valueOf(classification.getOrDefault("period", "THIS_MONTH"));

        // Step 2 — for conversational messages, skip data lookup and reply naturally
        if ("CONVERSATIONAL".equals(intent)) {
            String chatPrompt =
                "You are an analytics assistant for a South African restaurant owner.\n" +
                "Reply naturally and helpfully in 1-2 sentences.\n" +
                "If they ask what you can do, mention: top-selling items, revenue totals, order counts, " +
                "revenue comparisons, peak hours, and customer counts — across any time period.\n" +
                "Do NOT mention zeros, data, or revenue figures unless they asked for them.\n" +
                "Message: \"" + question.replace("\"", "'") + "\"";
            String raw = anthropicClient.call(chatPrompt);
            String answer = (raw != null && !raw.isBlank())
                    ? raw.trim() : "I'm here to help! Ask me about your top items, revenue, peak hours, or order trends.";
            return Map.of("answer", answer, "data", Map.of(), "question", question);
        }

        // Step 3 — resolve date range and run the matched query
        Instant[] range = resolveDateRange(period);
        Map<String, Object> data = runQuery(intent, range[0], range[1], tenantId);

        // Step 4 — format answer, let Claude decide when to include numbers
        String formatPrompt =
                "You are an analytics assistant for a South African restaurant owner.\n" +
                "Answer the following question using this data: " + toJson(data) + "\n" +
                "Question: \"" + question.replace("\"", "'") + "\"\n" +
                "Rules:\n" +
                "- Reply in one natural, friendly sentence\n" +
                "- Include the relevant numbers from the data\n" +
                "- Use South African Rand (R) for currency\n" +
                "- Do NOT say 'I've been away' or adopt the user's words as your own\n" +
                "- If the data shows zero, say so factually without being presumptuous about why\n" +
                "Return only the sentence.";

        String raw = anthropicClient.call(formatPrompt);
        String answer;
        if (raw != null && !raw.isBlank() && !raw.equals("{}")) {
            answer = raw.trim()
                    .replaceAll("(?s)^```[a-z]*\\s*", "")
                    .replaceAll("(?s)\\s*```$", "");
        } else {
            answer = buildFallbackAnswer(intent, period, data);
        }

        return Map.of("answer", answer, "data", data, "question", question);
    }

    private Instant[] resolveDateRange(String period) {
        ZoneId sast = ZoneId.of("Africa/Johannesburg");
        LocalDate today = LocalDate.now(sast);
        return switch (period) {
            case "TODAY"      -> new Instant[]{today.atStartOfDay(sast).toInstant(),
                                               today.plusDays(1).atStartOfDay(sast).toInstant()};
            case "THIS_WEEK"  -> new Instant[]{today.with(java.time.DayOfWeek.MONDAY).atStartOfDay(sast).toInstant(),
                                               Instant.now()};
            case "LAST_WEEK"  -> {
                LocalDate mon = today.with(java.time.DayOfWeek.MONDAY).minusWeeks(1);
                yield new Instant[]{mon.atStartOfDay(sast).toInstant(),
                                    mon.plusDays(7).atStartOfDay(sast).toInstant()};
            }
            case "LAST_MONTH" -> {
                LocalDate first = today.withDayOfMonth(1).minusMonths(1);
                yield new Instant[]{first.atStartOfDay(sast).toInstant(),
                                    first.plusMonths(1).atStartOfDay(sast).toInstant()};
            }
            default           -> new Instant[]{today.withDayOfMonth(1).atStartOfDay(sast).toInstant(),
                                               Instant.now()};
        };
    }

    private Map<String, Object> runQuery(String intent, Instant start, Instant end, UUID tenantId) {
        return switch (intent) {
            case "TOP_ITEM_ORDERS" -> {
                var top = orderRepository.findTopProducts(start, end, tenantId, PageRequest.of(0, 1));
                yield top.isEmpty()
                        ? Map.of("item", "none", "orders", 0)
                        : Map.of("item", top.get(0).getName(), "orders", top.get(0).getQuantity());
            }
            case "TOP_ITEM_REVENUE" -> {
                List<Order> orders = orderRepository.findByOrderDateBetweenAndTenant_Id(start, end, tenantId)
                        .stream().filter(o -> OrderStatus.DELIVERED.matches(o.getStatus())).collect(Collectors.toList());
                Map<String, Double> revByItem = new HashMap<>();
                for (Order o : orders) {
                    if (o.getOrderItems() == null) continue;
                    o.getOrderItems().forEach(oi -> {
                        if (oi.getMenuItem() != null && oi.getMenuItem().getPrice() != null) {
                            int qty = oi.getQuantity() != null ? oi.getQuantity() : 0;
                            double lineTotal = oi.getMenuItem().getPrice() * qty;
                            revByItem.merge(oi.getMenuItem().getName(), lineTotal, Double::sum);
                        }
                    });
                }
                String topItem = revByItem.entrySet().stream()
                        .max(Map.Entry.comparingByValue())
                        .map(Map.Entry::getKey).orElse("none");
                yield Map.of("item", topItem, "revenue", Math.round(revByItem.getOrDefault(topItem, 0.0)));
            }
            case "REVENUE_COMPARISON" -> {
                double current = orderRepository.findByOrderDateBetweenAndTenant_Id(start, end, tenantId)
                        .stream().filter(o -> OrderStatus.DELIVERED.matches(o.getStatus()))
                        .mapToDouble(o -> o.getTotalAmount() != null ? o.getTotalAmount() : 0.0).sum();
                Duration span = Duration.between(start, end);
                double previous = orderRepository.findByOrderDateBetweenAndTenant_Id(
                        start.minus(span), start, tenantId)
                        .stream().filter(o -> OrderStatus.DELIVERED.matches(o.getStatus()))
                        .mapToDouble(o -> o.getTotalAmount() != null ? o.getTotalAmount() : 0.0).sum();
                yield Map.of("currentRevenue", Math.round(current), "previousRevenue", Math.round(previous));
            }
            case "PEAK_HOUR" -> {
                List<Map<String, Object>> hours = analyticsService.getPeakHours(start, end);
                Map<String, Object> peak = hours.stream()
                        .max(Comparator.comparingLong(h -> (Long) h.get("orderCount")))
                        .orElse(Map.of("hour", 12, "orderCount", 0));
                yield Map.of("peakHour", peak.get("hour"), "orderCount", peak.get("orderCount"));
            }
            case "NEW_CUSTOMERS" -> {
                List<Order> orders = orderRepository.findByOrderDateBetweenAndTenant_Id(start, end, tenantId);
                long distinct = orders.stream()
                        .filter(o -> o.getUser() != null)
                        .map(o -> o.getUser().getId())
                        .distinct().count();
                yield Map.of("newCustomers", distinct);
            }
            default -> {
                List<Order> orders = orderRepository.findByOrderDateBetweenAndTenant_Id(start, end, tenantId);
                long count = orders.stream().filter(o -> OrderStatus.DELIVERED.matches(o.getStatus())).count();
                double revenue = orders.stream().filter(o -> OrderStatus.DELIVERED.matches(o.getStatus()))
                        .mapToDouble(o -> o.getTotalAmount() != null ? o.getTotalAmount() : 0.0).sum();
                yield Map.of("orderCount", count, "revenue", Math.round(revenue));
            }
        };
    }

    private Map<String, Object> classifyWithKeywords(String question) {
        String q = question.toLowerCase();

        String intent;
        if (q.contains("top") && (q.contains("revenue") || q.contains("earning") || q.contains("money"))) {
            intent = "TOP_ITEM_REVENUE";
        } else if (q.contains("top") || q.contains("best") || q.contains("most ordered") || q.contains("most popular") || q.contains("popular")) {
            intent = "TOP_ITEM_ORDERS";
        } else if (q.contains("peak") || q.contains("busiest") || q.contains("rush hour") || q.contains("busy hour")) {
            intent = "PEAK_HOUR";
        } else if (q.contains("new customer") || q.contains("unique customer") || q.contains("how many customer") || q.contains("customers did")) {
            intent = "NEW_CUSTOMERS";
        } else if (q.contains("compar") || q.contains(" vs ") || q.contains("versus") || q.contains("better than") || q.contains("more than last")) {
            intent = "REVENUE_COMPARISON";
        } else {
            intent = "ORDER_COUNT";
        }

        String period;
        if (q.contains("today") || q.contains("so far today")) {
            period = "TODAY";
        } else if (q.contains("last week") || q.contains("previous week")) {
            period = "LAST_WEEK";
        } else if (q.contains("last month") || q.contains("previous month")) {
            period = "LAST_MONTH";
        } else if (q.contains("this week") || q.contains("this week") || q.contains("week")) {
            period = "THIS_WEEK";
        } else {
            period = "THIS_MONTH";
        }

        return Map.of("intent", intent, "period", period);
    }

    private Map<String, Object> buildDescribeFallback(String name, BigDecimal price, String category) {
        String cat = category != null ? category.toLowerCase() : "";
        List<String> tags = new ArrayList<>();
        if (cat.contains("burger") || cat.contains("meal") || cat.contains("pizza")) tags.addAll(List.of("filling", "comfort"));
        else if (cat.contains("salad") || cat.contains("healthy") || cat.contains("wrap")) tags.addAll(List.of("healthy", "light"));
        else if (cat.contains("drink") || cat.contains("juice") || cat.contains("smoothie")) tags.addAll(List.of("quick"));
        else if (cat.contains("side") || cat.contains("fries")) tags.addAll(List.of("comfort", "quick"));
        else tags.add("value");
        String desc = String.format("A tasty %s for just R%.0f — a great choice any time.",
                category != null ? category.toLowerCase() : "item",
                price != null ? price : BigDecimal.ZERO);
        double suggestedPrice = (price != null && price.doubleValue() > 0) ? price.doubleValue()
                : cat.contains("drink") || cat.contains("juice") ? 20
                : cat.contains("side") || cat.contains("fries") ? 35
                : cat.contains("dessert") ? 40
                : cat.contains("burger") || cat.contains("wrap") ? 85
                : cat.contains("main") || cat.contains("platter") || cat.contains("ribs") ? 130
                : 60;
        return Map.of("description", desc, "tags", tags,
                "suggestedCategory", category != null ? category : "",
                "suggestedPrice", suggestedPrice);
    }

    private String buildFallbackAnswer(String intent, String period, Map<String, Object> data) {
        String when = switch (period) {
            case "TODAY"      -> "today";
            case "THIS_WEEK"  -> "this week";
            case "LAST_WEEK"  -> "last week";
            case "LAST_MONTH" -> "last month";
            default           -> "this month";
        };
        return switch (intent) {
            case "TOP_ITEM_ORDERS"   -> "Your top item by orders " + when + " was " + data.getOrDefault("item", "unknown") + " with " + data.getOrDefault("orders", 0) + " orders.";
            case "TOP_ITEM_REVENUE"  -> "Your top item by revenue " + when + " was " + data.getOrDefault("item", "unknown") + " earning R" + data.getOrDefault("revenue", 0) + ".";
            case "REVENUE_COMPARISON"-> "Revenue " + when + ": R" + data.getOrDefault("currentRevenue", 0) + " vs R" + data.getOrDefault("previousRevenue", 0) + " the prior period.";
            case "PEAK_HOUR"         -> "Your peak hour " + when + " was " + data.getOrDefault("peakHour", "N/A") + ":00 with " + data.getOrDefault("orderCount", 0) + " orders.";
            case "NEW_CUSTOMERS"     -> "You had " + data.getOrDefault("newCustomers", 0) + " unique customers " + when + ".";
            default                  -> "You received " + data.getOrDefault("orderCount", 0) + " orders " + when + " with R" + data.getOrDefault("revenue", 0) + " in revenue.";
        };
    }

    private String toJson(Object obj) {
        try { return objectMapper.writeValueAsString(obj); } catch (Exception e) { return obj.toString(); }
    }

    private String formatPeriod(LocalDateTime since) {
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("MMM d");
        return since.format(fmt) + " – " + LocalDateTime.now().format(fmt);
    }

@SuppressWarnings("unchecked")
    private Map<String, Object> parseJsonOrFallback(String raw, Map<String, Object> fallback) {
        if (raw == null || raw.isBlank()) return new HashMap<>(fallback);
        String cleaned = raw.trim()
                .replaceAll("(?s)^```json\\s*", "")
                .replaceAll("(?s)^```\\s*", "")
                .replaceAll("(?s)\\s*```$", "");
        try {
            return objectMapper.readValue(cleaned, Map.class);
        } catch (Exception ignored) { /* fall through: try to extract a JSON object from prose */ }
        int s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
        if (s >= 0 && e > s) {
            try { return objectMapper.readValue(cleaned.substring(s, e + 1), Map.class); }
            catch (Exception ignored) { /* give up below */ }
        }
        log.warn("Failed to parse Claude response as JSON: {}", raw);
        return new HashMap<>(fallback);
    }

    // ── Cache ───────────────────────────────────────────────────────────────

    private record CachedDigest(Map<String, Object> result, long timestamp) {
        CachedDigest(Map<String, Object> result) {
            this(result, System.currentTimeMillis());
        }
        boolean isValid() {
            return System.currentTimeMillis() - timestamp < 6 * 60 * 60 * 1000L;
        }
    }
}
