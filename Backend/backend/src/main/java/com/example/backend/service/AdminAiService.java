package com.example.backend.service;

import com.example.backend.entity.MenuItem;
import com.example.backend.entity.Order;
import com.example.backend.entity.OrderStatus;
import com.example.backend.entity.Review;
import com.example.backend.entity.SubscriptionPlan;
import com.example.backend.model.Promotion;
import com.example.backend.repository.PromotionRepository;
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

    public Map<String, Object> suggestPromotions(UUID tenantId) {
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

        // LEVEL-3: the BACKEND decides deterministically (no LLM) — there is no
        // elasticity/promo-history data to "reason" over. Pick the store's most-ordered
        // items that it can afford to discount (margin at/above its OWN median, in stock),
        // and emit STRUCTURED facts + an explicit confidence contract. The UI narrates.
        List<Double> margins = menuItems.stream().map(MenuItem::getMarginPercent)
                .filter(Objects::nonNull).sorted().collect(Collectors.toList());
        Double medianMargin = margins.isEmpty() ? null : margins.get(margins.size() / 2);

        List<MenuItem> candidates = menuItems.stream()
                .filter(i -> itemCounts.getOrDefault(i.getId(), 0L) > 0)
                .filter(i -> i.getMarginPercent() != null && (medianMargin == null || i.getMarginPercent() >= medianMargin))
                .filter(i -> (i.getStock() - i.getReservedStock()) > 0 && i.getPrice() != null && i.getPrice() > 0)
                .sorted((a, b) -> Long.compare(itemCounts.getOrDefault(b.getId(), 0L), itemCounts.getOrDefault(a.getId(), 0L)))
                .limit(3)
                .collect(Collectors.toList());

        // Decision gradient — score each candidate so the cards differ instead of cloning.
        // Both inputs are real signals: demand (units, vs the strongest) and margin headroom
        // (how far above the store median). NO behavioural claims (no "drives baskets").
        long maxUnits = candidates.stream().mapToLong(i -> itemCounts.getOrDefault(i.getId(), 0L)).max().orElse(1);
        double medM = medianMargin != null ? medianMargin : 0;
        double maxMargin = candidates.stream().mapToDouble(MenuItem::getMarginPercent).max().orElse(medM);

        String today = LocalDate.now().toString();
        String endAt = LocalDate.now().plusDays(5).toString();
        List<Map<String, Object>> suggestions = new ArrayList<>();
        int rank = 0;
        for (MenuItem item : candidates) {
            rank++;
            long units = itemCounts.getOrDefault(item.getId(), 0L);
            double margin = item.getMarginPercent();
            double demandScore = maxUnits > 0 ? (double) units / maxUnits : 0;                  // 0..1
            double marginScore = maxMargin > medM ? (margin - medM) / (maxMargin - medM) : 0.5; // 0..1
            double composite = demandScore * 0.6 + marginScore * 0.4;
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

            String hypothesis = switch (strength) {
                case "STRONG"   -> "Strongest test candidate — high demand with a clear margin buffer.";
                case "MODERATE" -> "Solid secondary test — good demand with an adequate margin buffer.";
                default          -> "Optional test — a moderate signal worth a small experiment.";
            };

            Map<String, Object> s = new LinkedHashMap<>();
            // FACTS — observed, immutable (the data layer)
            s.put("facts", List.of(
                    "#" + rank + " by volume — " + units + " orders in 30 days",
                    String.format(Locale.UK, "%.0f%% margin (store median %.0f%%)", margin, medM),
                    String.format(Locale.UK, "R%.2f current price", item.getPrice())));
            // ANALYSIS — structured tokens (epistemic layer). insightStrength + recommendationType
            // are the SEMANTIC signals; the global uncertainty note lives once in the UI banner.
            Map<String, Object> analysis = new LinkedHashMap<>();
            analysis.put("hypothesis", hypothesis);
            analysis.put("evidence", List.of(
                    units + " orders in the last 30 days (rank #" + rank + ")",
                    String.format(Locale.UK, "%.0f%% margin — %s the store median",
                            margin, margin >= medM ? "at or above" : "below"),
                    "In stock now"));
            analysis.put("insightStrength", strength);
            analysis.put("recommendationType", "EXPERIMENT");
            s.put("analysis", analysis);
            s.put("proposedPromo", promo);
            suggestions.add(s);
        }
        return Map.of("suggestions", suggestions);
    }

    // ── Feature: Promotion outcomes (the feedback loop) ─────────────────────

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
            if (p.getAppliesTo() != Promotion.AppliesTo.PRODUCT || p.getTargetProductId() == null || p.getStartAt() == null) continue;
            Instant start = p.getStartAt().toInstant();
            if (start.isAfter(now)) continue; // not started yet
            boolean ended = p.getEndAt() != null && p.getEndAt().toInstant().isBefore(now);
            Instant duringEnd = ended ? p.getEndAt().toInstant() : now;
            Duration len = Duration.between(start, duringEnd);
            if (len.isZero() || len.isNegative()) continue;
            Instant beforeStart = start.minus(len);

            // [orderedUnits, orderedRevenue, deliveredUnits, deliveredRevenue]
            double[] before = productSales(tenantId, p.getTargetProductId(), beforeStart, start);
            double[] during = productSales(tenantId, p.getTargetProductId(), start, duringEnd);

            // ORDERED is the dense EARLY signal; DELIVERED is the sparse FINAL signal.
            boolean hasSignal = (before[0] + during[0]) > 0;

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
            // PENDING = not enough completed events yet to measure (not "no effect").
            r.put("signal", hasSignal ? "MEASURED" : "PENDING");
            r.put("ordered", signalBlock(before[0], before[1], during[0], during[1]));   // early
            r.put("delivered", signalBlock(before[2], before[3], during[2], during[3])); // final
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

    /** before/during units+revenue for one signal, with the % unit change (null if no baseline). */
    private Map<String, Object> signalBlock(double beforeUnits, double beforeRev, double duringUnits, double duringRev) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("before", Map.of("units", (long) beforeUnits, "revenue", Math.round(beforeRev * 100.0) / 100.0));
        m.put("during", Map.of("units", (long) duringUnits, "revenue", Math.round(duringRev * 100.0) / 100.0));
        m.put("unitsPercent", beforeUnits > 0 ? Math.round((duringUnits - beforeUnits) / beforeUnits * 100.0) : null);
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

        Map<String, Object> result = parseJsonOrFallback(anthropicClient.call(prompt), Map.of(
                "period", formatPeriod(sinceDateTime),
                "sentimentScore", 0,
                "positives", List.of(),
                "negatives", List.of(),
                "recommendation", "Unable to process reviews at this time."
        ));

        result = new HashMap<>(result);
        result.putIfAbsent("period", formatPeriod(sinceDateTime));

        digestCache.put(cacheKey, new CachedDigest(result));
        return result;
    }

    // ── Feature: AI Support Desk ───────────────────────────────────────────

    /**
     * Drafts a reply to a customer support ticket, plus triage metadata
     * (category, urgency) and an internal suggested resolution (e.g. a credit).
     * One-shot, read-only — the owner reviews/edits before anything is sent.
     */
    public Map<String, Object> draftSupportReply(String subject, String message) {
        Map<String, Object> fallback = Map.of(
                "category", "Other",
                "urgency", "medium",
                "draftReply", "Thanks for reaching out — we're looking into this and will come back to you shortly.",
                "suggestedResolution", "Review the ticket and respond",
                "suggestedStatus", "IN_PROGRESS");
        if (!anthropicClient.isConfigured()) return fallback;
        String prompt =
                "You are a warm, professional customer-support agent for a South African food-delivery store on CraveIt.\n" +
                "A customer raised this support ticket:\n" +
                "Subject: " + (subject != null ? subject : "") + "\n" +
                "Message: " + (message != null ? message : "") + "\n\n" +
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

        boolean nearLimit = (plan.getMaxMenuItems() > 0 && items >= plan.getMaxMenuItems() * 0.8)
                || (plan.getMaxPromotions() > 0 && activePromos >= plan.getMaxPromotions());
        String ruleVerdict = nearLimit ? "UPGRADE" : "GOOD_FIT";

        if (!anthropicClient.isConfigured()) {
            return Map.of("verdict", ruleVerdict, "recommendation", nearLimit
                    ? "You're close to your " + plan.getName() + " plan limits — upgrading unlocks more headroom."
                    : "Your " + plan.getName() + " plan comfortably covers your current usage.");
        }
        String prompt =
                "You advise a restaurant owner on whether their CraveIt subscription fits, in South African English.\n" +
                "Plan: " + plan.getName() + " (max menu items " + plan.getMaxMenuItems() +
                ", max active promos " + plan.getMaxPromotions() +
                ", analytics " + (plan.isHasAnalytics() ? "included" : "NOT included") + ").\n" +
                "Usage: " + items + " menu items, " + activePromos + " active promos.\n" +
                "Delivered orders: " + orders30 + " last 30 days (" + ordersPrev30 + " the 30 days before).\n" +
                "Give ONE short, specific recommendation (1-2 sentences) and a verdict. UPGRADE if near/at limits or " +
                "growing fast and they'd benefit from headroom or analytics; GOOD_FIT if it suits them; " +
                "CONSIDER_DOWNGRADE only if usage is very low and flat. Be honest, not pushy.\n" +
                "Return JSON only: { \"verdict\": \"UPGRADE|GOOD_FIT|CONSIDER_DOWNGRADE\", \"recommendation\": \"<text>\" }";
        String raw = anthropicClient.call(prompt);
        return (raw != null && !raw.isBlank())
                ? parseJsonOrFallback(raw, Map.of("verdict", ruleVerdict, "recommendation", "")) : fallback;
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
        try {
            String cleaned = raw.trim()
                    .replaceAll("(?s)^```json\\s*", "")
                    .replaceAll("(?s)^```\\s*", "")
                    .replaceAll("(?s)\\s*```$", "");
            return objectMapper.readValue(cleaned, Map.class);
        } catch (Exception e) {
            log.warn("Failed to parse Claude response as JSON: {}", raw);
            return new HashMap<>(fallback);
        }
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
