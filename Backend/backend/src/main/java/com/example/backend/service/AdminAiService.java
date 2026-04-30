package com.example.backend.service;

import com.example.backend.entity.Review;
import com.example.backend.repository.ReviewRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.LocalDate;
import java.time.LocalDateTime;
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
    private final ObjectMapper objectMapper;

    private HttpClient httpClient;

    // 6-hour digest cache per tenant
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
        String prompt = buildDescribeItemPrompt(name, price, category);
        String raw = callClaude(prompt);
        return parseJsonOrFallback(raw, Map.of(
                "description", "",
                "tags", List.of(),
                "suggestedCategory", category != null ? category : ""
        ));
    }

    private String buildDescribeItemPrompt(String name, BigDecimal price, String category) {
        return String.format(
                "You are a menu copywriter for a South African food delivery app called CraveIt.\n" +
                "Given: name=\"%s\", price=R%.2f, category=\"%s\"\n" +
                "Return JSON only, no markdown, no explanation:\n" +
                "{\n" +
                "  \"description\": \"<1–2 sentence appetising description, under 120 characters>\",\n" +
                "  \"tags\": [\"<tag1>\", \"<tag2>\"],\n" +
                "  \"suggestedCategory\": \"<category>\"\n" +
                "}\n" +
                "Tags must be chosen only from: filling, comfort, healthy, light, premium, indulgent, quick, grilled, fried, spicy, sweet, vegan, value",
                name,
                price != null ? price : BigDecimal.ZERO,
                category != null ? category : "");
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

        String prompt = buildReviewDigestPrompt(reviews);
        String raw = callClaude(prompt);
        Map<String, Object> result = parseJsonOrFallback(raw, Map.of(
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

    private String buildReviewDigestPrompt(List<Review> reviews) {
        StringBuilder sb = new StringBuilder();
        for (Review r : reviews) {
            if (r.getComment() != null && !r.getComment().isBlank()) {
                String line = String.format("[%d stars] %s\n", r.getRating(), r.getComment().trim());
                if (sb.length() + line.length() > 4000) break;
                sb.append(line);
            }
        }

        return "You are an analytics assistant for a restaurant on a South African food delivery app.\n" +
               "Summarise the following customer reviews from the past week.\n" +
               "Return JSON only, no markdown:\n" +
               "{\n" +
               "  \"sentimentScore\": <0.0–10.0>,\n" +
               "  \"positives\": [\"<theme 1>\", \"<theme 2>\", \"<theme 3>\"],\n" +
               "  \"negatives\": [\"<theme 1>\", \"<theme 2>\"],\n" +
               "  \"recommendation\": \"<one actionable sentence>\"\n" +
               "}\n" +
               "Reviews:\n" + sb;
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
                return "{}";
            }

            JsonNode root = objectMapper.readTree(response.body());
            return root.path("content").get(0).path("text").asText();
        } catch (Exception e) {
            log.error("Anthropic API call failed: {}", e.getMessage());
            return "{}";
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseJsonOrFallback(String raw, Map<String, Object> fallback) {
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
