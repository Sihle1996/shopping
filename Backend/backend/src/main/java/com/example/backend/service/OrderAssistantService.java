package com.example.backend.service;

import com.example.backend.entity.MenuItem;
import com.example.backend.intelligence.RecommendationContext;
import com.example.backend.intelligence.RecommendationEngine;
import com.example.backend.intelligence.ScoredItem;
import com.example.backend.repository.MenuItemRepository;
import com.example.backend.repository.PromotionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrderAssistantService {

    private static final ZoneId SAST = ZoneId.of("Africa/Johannesburg");
    // In-memory token store with TTL — no DB needed for transient suggestions
    private final Map<String, SuggestedOrder> pendingSuggestions = new ConcurrentHashMap<>();

    private final IntentParser intentParser;
    private final RecommendationEngine recommendationEngine;
    private final IntentProfileService intentProfileService;
    private final MenuItemRepository menuItemRepository;
    private final PromotionRepository promotionRepository;
    private final CartService cartService;

    public Map<String, Object> interpret(String prompt, UUID tenantId, UUID userId, Double lat, Double lon) {
        IntentParser.ParsedIntent parsed = intentParser.parse(prompt);

        List<MenuItem> candidates = menuItemRepository.findByTenant_Id(tenantId)
                .stream().filter(MenuItem::isAvailable).collect(Collectors.toList());

        if (parsed.budgetPerPerson() != null) {
            candidates = candidates.stream()
                    .filter(i -> i.getPrice() <= parsed.budgetPerPerson())
                    .collect(Collectors.toList());
        }

        Map<String, List<String>> tagMap = intentProfileService.buildTagMap(tenantId);

        Set<UUID> promotedIds = collectPromotedItemIds(tenantId);

        RecommendationContext ctx = new RecommendationContext(
                userId, tenantId, null, null,
                parsed.budgetPerPerson(),
                ZonedDateTime.now(SAST).getHour(),
                null, promotedIds, Collections.emptySet()
        );

        List<ScoredItem> ranked = recommendationEngine.rank(ctx, candidates, tagMap);

        // Boost items whose tags match parsed preferences
        if (!parsed.preferredTags().isEmpty()) {
            ranked = ranked.stream()
                    .sorted(Comparator.comparingInt((ScoredItem si) -> {
                        List<String> itemTags = tagMap.getOrDefault(si.id().toString(), Collections.emptyList());
                        long matches = parsed.preferredTags().stream().filter(t ->
                                itemTags.stream().anyMatch(it -> it.equalsIgnoreCase(t))).count();
                        return -(int) matches; // negative for descending
                    }).thenComparingInt(si -> -si.score()))
                    .collect(Collectors.toList());
        }

        if (ranked.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "No items matched your request. Try broadening your criteria.");
        }

        ScoredItem top = ranked.get(0);
        List<ScoredItem> alternatives = ranked.stream().skip(1).limit(2).collect(Collectors.toList());

        double total = top.price() * parsed.servings();
        String message = buildMessage(top, parsed);

        String token = UUID.randomUUID().toString();
        pendingSuggestions.put(token, new SuggestedOrder(token, top.id(), parsed.servings(), tenantId, userId,
                System.currentTimeMillis() + 10 * 60 * 1000L));

        Map<String, Object> interpretation = new LinkedHashMap<>();
        interpretation.put("servings",       parsed.servings());
        interpretation.put("budgetPerPerson", parsed.budgetPerPerson());
        interpretation.put("totalBudget",    parsed.budgetPerPerson() != null ? parsed.budgetPerPerson() * parsed.servings() : null);
        interpretation.put("tags",           parsed.preferredTags());
        interpretation.put("confidence",     parsed.confidence());

        Map<String, Object> suggestion = new LinkedHashMap<>();
        suggestion.put("suggestionToken", token);
        suggestion.put("mode",  "SINGLE_ITEM");
        suggestion.put("items", List.of(Map.of(
                "menuItemId",  top.id(),
                "name",        top.name(),
                "quantity",    parsed.servings(),
                "unitPrice",   top.price(),
                "totalPrice",  total
        )));
        suggestion.put("totalEstimate", total);
        suggestion.put("message", message);

        return Map.of(
                "interpretation", interpretation,
                "suggestion",     suggestion,
                "alternatives",   alternatives.stream().map(a -> Map.of(
                        "menuItemId", a.id(),
                        "name",       a.name(),
                        "price",      a.price()
                )).collect(Collectors.toList())
        );
    }

    public List<Map<String, Object>> confirm(String token, UUID userId) {
        SuggestedOrder suggestion = pendingSuggestions.remove(token);
        if (suggestion == null || suggestion.expiresAt() < System.currentTimeMillis()) {
            throw new ResponseStatusException(HttpStatus.GONE, "Suggestion expired — please try again");
        }
        if (!suggestion.userId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your suggestion");
        }
        for (int i = 0; i < suggestion.quantity(); i++) {
            cartService.addItemToCart(userId, suggestion.menuItemId(), 1);
        }
        return cartService.getUserCartItems(userId);
    }

    private String buildMessage(ScoredItem item, IntentParser.ParsedIntent parsed) {
        StringBuilder sb = new StringBuilder();
        if (parsed.servings() > 1) {
            sb.append(parsed.servings()).append("× ").append(item.name());
        } else {
            sb.append(item.name());
        }
        sb.append(" — R").append(String.format("%.0f", item.price() * parsed.servings()));
        if (!parsed.preferredTags().isEmpty()) {
            sb.append(", ").append(String.join(", ", parsed.preferredTags()));
        }
        return sb.toString();
    }

    private Set<UUID> collectPromotedItemIds(UUID tenantId) {
        try {
            var promos = promotionRepository.findActiveByTenantId(OffsetDateTime.now(), tenantId);
            Set<UUID> ids = new HashSet<>();
            for (var p : promos) {
                if (p.getTargetProductId() != null) ids.add(p.getTargetProductId());
                if (p.getTargetProducts() != null) p.getTargetProducts().forEach(tp -> ids.add(tp.getId()));
            }
            return ids;
        } catch (Exception e) {
            return Collections.emptySet();
        }
    }

    record SuggestedOrder(String token, UUID menuItemId, int quantity, UUID tenantId, UUID userId, long expiresAt) {}
}
