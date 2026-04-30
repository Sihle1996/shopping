package com.example.backend.service;

import com.example.backend.entity.MenuItem;
import com.example.backend.entity.Order;
import com.example.backend.entity.Review;
import com.example.backend.repository.MenuItemRepository;
import com.example.backend.repository.OrderRepository;
import com.example.backend.repository.ReviewRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminAiService {

    @Value("${anthropic.api-key:}")
    private String apiKey;

    @Value("${anthropic.model:claude-haiku-4-5-20251001}")
    private String model;

    @Value("${anthropic.max-tokens:1024}")
    private int maxTokens;

    private final ReviewRepository reviewRepository;
    private final OrderRepository orderRepository;
    private final MenuItemRepository menuItemRepository;
    private final AnalyticsService analyticsService;
    private final ObjectMapper objectMapper;

    private HttpClient httpClient;

    private final ConcurrentHashMap<UUID, CachedDigest> digestCache = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("ANTHROPIC_API_KEY is not set — admin AI endpoints will return 503");
        }
        httpClient = HttpClient.newHttpClient();
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
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

        return parseJsonOrFallback(callClaude(prompt), Map.of(
                "description", "",
                "tags", List.of(),
                "suggestedCategory", category != null ? category : ""
        ));
    }

    // ── Feature 2: Promotion Optimizer ─────────────────────────────────────

    public Map<String, Object> suggestPromotions(UUID tenantId) {
        Instant thirtyDaysAgo = Instant.now().minus(Duration.ofDays(30));
        List<Order> recentOrders = orderRepository
                .findByOrderDateBetweenAndTenant_Id(thirtyDaysAgo, Instant.now(), tenantId)
                .stream()
                .filter(o -> "Delivered".equalsIgnoreCase(o.getStatus()))
                .collect(Collectors.toList());

        // Item order-count map: menuItemId → count
        Map<UUID, Long> itemCounts = new HashMap<>();
        for (Order o : recentOrders) {
            if (o.getOrderItems() == null) continue;
            o.getOrderItems().forEach(oi -> {
                if (oi.getMenuItem() != null) {
                    itemCounts.merge(oi.getMenuItem().getId(), (long) oi.getQuantity(), Long::sum);
                }
            });
        }

        List<MenuItem> menuItems = menuItemRepository.findByTenant_Id(tenantId)
                .stream().filter(i -> Boolean.TRUE.equals(i.getIsAvailable())).collect(Collectors.toList());

        if (menuItems.isEmpty()) {
            return Map.of("suggestions", List.of());
        }

        // Build compact summary (max 2000 chars)
        StringBuilder sb = new StringBuilder();
        for (MenuItem item : menuItems) {
            long count = itemCounts.getOrDefault(item.getId(), 0L);
            String line = String.format("- %s | R%.2f | %s | %d orders\n",
                    item.getName(), item.getPrice(), item.getCategory(), count);
            if (sb.length() + line.length() > 2000) break;
            sb.append(line);
        }

        String today = LocalDate.now().toString();
        String prompt =
                "You are a promotions advisor for a South African food delivery restaurant.\n" +
                "Based on 30-day order data below, suggest 1–3 time-limited promotions to boost sales.\n" +
                "Today is " + today + ".\n" +
                "Return JSON only, no markdown:\n" +
                "{\n" +
                "  \"suggestions\": [\n" +
                "    {\n" +
                "      \"reason\": \"<why this promo makes sense>\",\n" +
                "      \"proposedPromo\": {\n" +
                "        \"title\": \"<promo name>\",\n" +
                "        \"discountPercent\": <10-30>,\n" +
                "        \"appliesTo\": \"PRODUCT\",\n" +
                "        \"targetProductName\": \"<exact item name from data>\",\n" +
                "        \"startAt\": \"<today's date>\",\n" +
                "        \"endAt\": \"<date 3-7 days from today>\"\n" +
                "      }\n" +
                "    }\n" +
                "  ]\n" +
                "}\n" +
                "Menu items (name | price | category | orders in last 30 days):\n" + sb;

        Map<String, Object> result = parseJsonOrFallback(callClaude(prompt), Map.of("suggestions", List.of()));

        // Resolve targetProductName → targetProductId
        Map<String, UUID> nameToId = menuItems.stream()
                .collect(Collectors.toMap(
                        i -> i.getName().toLowerCase(),
                        MenuItem::getId,
                        (a, b) -> a
                ));

        List<Map<String, Object>> rawSuggestions = getSuggestions(result);
        List<Map<String, Object>> enriched = new ArrayList<>();
        for (Map<String, Object> s : rawSuggestions) {
            Map<String, Object> copy = new HashMap<>(s);
            Object pp = s.get("proposedPromo");
            if (pp instanceof Map<?, ?> promo) {
                Map<String, Object> promoCopy = new HashMap<>();
                promo.forEach((k, v) -> promoCopy.put(k.toString(), v));
                String targetName = (String) promoCopy.get("targetProductName");
                if (targetName != null) {
                    UUID id = nameToId.get(targetName.toLowerCase());
                    if (id != null) promoCopy.put("targetProductId", id.toString());
                }
                copy.put("proposedPromo", promoCopy);
            }
            enriched.add(copy);
        }

        return Map.of("suggestions", enriched);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> getSuggestions(Map<String, Object> result) {
        Object raw = result.get("suggestions");
        if (raw instanceof List<?> list) {
            return list.stream()
                    .filter(i -> i instanceof Map)
                    .map(i -> (Map<String, Object>) i)
                    .collect(Collectors.toList());
        }
        return List.of();
    }

    // ── Feature 3: Review Digest ────────────────────────────────────────────

    public Map<String, Object> reviewDigest(UUID tenantId, LocalDate since) {
        CachedDigest cached = digestCache.get(tenantId);
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

        Map<String, Object> result = parseJsonOrFallback(callClaude(prompt), Map.of(
                "period", formatPeriod(sinceDateTime),
                "sentimentScore", 0,
                "positives", List.of(),
                "negatives", List.of(),
                "recommendation", "Unable to process reviews at this time."
        ));

        result = new HashMap<>(result);
        result.putIfAbsent("period", formatPeriod(sinceDateTime));

        digestCache.put(tenantId, new CachedDigest(result));
        return result;
    }

    // ── Feature 4: Conversational Analytics ────────────────────────────────

    public Map<String, Object> queryAnalytics(String question, UUID tenantId) {
        // Step 1 — classify intent
        String classifyPrompt =
                "Classify this analytics question into one of these intents:\n" +
                "TOP_ITEM_ORDERS, TOP_ITEM_REVENUE, REVENUE_COMPARISON, PEAK_HOUR, ORDER_COUNT, NEW_CUSTOMERS\n" +
                "Also extract the time period: THIS_WEEK, THIS_MONTH, LAST_WEEK, LAST_MONTH, TODAY\n" +
                "Return JSON only:\n" +
                "{ \"intent\": \"<INTENT>\", \"period\": \"<PERIOD>\" }\n" +
                "Question: \"" + question.replace("\"", "'") + "\"";

        Map<String, Object> classification = parseJsonOrFallback(callClaude(classifyPrompt),
                Map.of("intent", "ORDER_COUNT", "period", "THIS_MONTH"));

        String intent = String.valueOf(classification.getOrDefault("intent", "ORDER_COUNT"));
        String period = String.valueOf(classification.getOrDefault("period", "THIS_MONTH"));

        // Step 2 — resolve date range
        Instant[] range = resolveDateRange(period);
        Instant start = range[0], end = range[1];

        // Step 3 — run the matched query
        Map<String, Object> data = runQuery(intent, start, end, tenantId);

        // Step 4 — format answer
        String formatPrompt =
                "Given this data: " + toJson(data) + "\n" +
                "Answer this question in one natural, friendly sentence (include the numbers): \"" +
                question.replace("\"", "'") + "\"\n" +
                "Use South African Rand (R) for currency. Return only the sentence.";

        String raw = callClaude(formatPrompt);
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
                        .stream().filter(o -> "Delivered".equalsIgnoreCase(o.getStatus())).collect(Collectors.toList());
                Map<String, Double> revByItem = new HashMap<>();
                for (Order o : orders) {
                    if (o.getOrderItems() == null) continue;
                    o.getOrderItems().forEach(oi -> {
                        if (oi.getMenuItem() != null) {
                            double lineTotal = oi.getMenuItem().getPrice().doubleValue() * oi.getQuantity();
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
                        .stream().filter(o -> "Delivered".equalsIgnoreCase(o.getStatus()))
                        .mapToDouble(Order::getTotalAmount).sum();
                Duration span = Duration.between(start, end);
                double previous = orderRepository.findByOrderDateBetweenAndTenant_Id(
                        start.minus(span), start, tenantId)
                        .stream().filter(o -> "Delivered".equalsIgnoreCase(o.getStatus()))
                        .mapToDouble(Order::getTotalAmount).sum();
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
                long count = orders.stream().filter(o -> "Delivered".equalsIgnoreCase(o.getStatus())).count();
                double revenue = orders.stream().filter(o -> "Delivered".equalsIgnoreCase(o.getStatus()))
                        .mapToDouble(Order::getTotalAmount).sum();
                yield Map.of("orderCount", count, "revenue", Math.round(revenue));
            }
        };
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

    // ── Anthropic HTTP call ─────────────────────────────────────────────────

    private String callClaude(String userMessage) {
        try {
            String requestBody = objectMapper.writeValueAsString(Map.of(
                    "model", model,
                    "max_tokens", maxTokens,
                    "messages", List.of(Map.of("role", "user", "content", userMessage))
            ));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.anthropic.com/v1/messages"))
                    .header("x-api-key", apiKey)
                    .header("anthropic-version", "2023-06-01")
                    .header("content-type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.error("Anthropic API returned {}: {}", response.statusCode(), response.body());
                return null;
            }

            JsonNode root = objectMapper.readTree(response.body());
            return root.path("content").get(0).path("text").asText();
        } catch (Exception e) {
            log.error("Anthropic API call failed: {}", e.getMessage());
            return null;
        }
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
