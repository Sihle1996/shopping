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
    private final Map<String, SuggestedOrder> pendingSuggestions = new ConcurrentHashMap<>();

    private final IntentParser intentParser;
    private final AnthropicClient anthropicClient;
    private final RecommendationEngine recommendationEngine;
    private final IntentProfileService intentProfileService;
    private final MenuItemRepository menuItemRepository;
    private final PromotionRepository promotionRepository;
    private final CartService cartService;

    public Map<String, Object> interpret(String prompt, UUID tenantId, UUID userId, Double lat, Double lon) {
        if (!isFoodOrderRequest(prompt)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "I can only help with food orders! Try something like \"something filling under R80\" or \"healthy food for 2 people\".");
        }

        List<MenuItem> available = menuItemRepository.findByTenant_Id(tenantId)
                .stream().filter(i -> Boolean.TRUE.equals(i.getIsAvailable())).collect(Collectors.toList());

        if (available.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No items are available right now.");
        }

        // Try Claude first — it reads the real menu and picks intelligently
        if (anthropicClient.isConfigured()) {
            Map<String, Object> result = interpretWithClaude(prompt, available, tenantId, userId);
            if (result != null) return result;
        }

        // Fallback: rules-based engine
        return interpretWithRules(prompt, available, tenantId, userId);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> interpretWithClaude(String prompt, List<MenuItem> items, UUID tenantId, UUID userId) {
        String menuText = items.stream()
                .map(i -> String.format("- %s | R%.0f | %s", i.getName(), i.getPrice(),
                        i.getDescription() != null && !i.getDescription().isBlank() ? i.getDescription() : i.getCategory()))
                .collect(Collectors.joining("\n"));

        String aiPrompt =
            "You are a food ordering assistant for a South African restaurant.\n" +
            "Pick the single best menu item for the customer's request.\n\n" +
            "Menu (name | price | description):\n" + menuText + "\n\n" +
            "Customer request: \"" + prompt.replace("\"", "'") + "\"\n\n" +
            "Return JSON only, no markdown:\n" +
            "{\n" +
            "  \"pickedItem\": \"<exact item name from the menu above>\",\n" +
            "  \"servings\": <how many people, default 1>,\n" +
            "  \"reason\": \"<one warm, personal sentence explaining your choice>\",\n" +
            "  \"alternatives\": [\"<item name>\", \"<item name>\"]\n" +
            "}\n\n" +
            "Rules:\n" +
            "- pickedItem MUST be copied exactly as it appears in the menu\n" +
            "- Be thoughtful: 'something my gran would like' means comfort food, 'watching the game' means snacks, etc.\n" +
            "- alternatives must also be exact names from the menu";

        String raw = anthropicClient.call(aiPrompt, 400);
        if (raw == null) return null;

        try {
            String cleaned = raw.trim()
                    .replaceAll("(?s)^```json\\s*", "").replaceAll("(?s)^```\\s*", "").replaceAll("(?s)\\s*```$", "");
            Map<String, Object> parsed = new com.fasterxml.jackson.databind.ObjectMapper().readValue(cleaned, Map.class);

            String pickedName = (String) parsed.get("pickedItem");
            int servings = parsed.get("servings") instanceof Number n ? n.intValue() : 1;
            String reason = (String) parsed.getOrDefault("reason", "");
            List<String> altNames = parsed.get("alternatives") instanceof List<?> l
                    ? l.stream().map(Object::toString).collect(Collectors.toList()) : List.of();

            // Resolve picked item by name (case-insensitive)
            MenuItem picked = items.stream()
                    .filter(i -> i.getName().equalsIgnoreCase(pickedName))
                    .findFirst().orElse(null);
            if (picked == null) return null; // Claude hallucinated a name — fall back to rules

            List<Map<String, Object>> altList = altNames.stream()
                    .map(name -> items.stream().filter(i -> i.getName().equalsIgnoreCase(name)).findFirst().orElse(null))
                    .filter(Objects::nonNull)
                    .map(i -> (Map<String, Object>) Map.of("menuItemId", i.getId(), "name", i.getName(), "price", i.getPrice()))
                    .collect(Collectors.toList());

            double total = picked.getPrice() * servings;
            String token = UUID.randomUUID().toString();
            pendingSuggestions.put(token, new SuggestedOrder(token, picked.getId(), servings, tenantId, userId,
                    System.currentTimeMillis() + 10 * 60 * 1000L));

            Map<String, Object> suggestion = new LinkedHashMap<>();
            suggestion.put("suggestionToken", token);
            suggestion.put("mode", "SINGLE_ITEM");
            suggestion.put("items", List.of(Map.of(
                    "menuItemId", picked.getId(), "name", picked.getName(),
                    "quantity", servings, "unitPrice", picked.getPrice(), "totalPrice", total)));
            suggestion.put("totalEstimate", total);
            suggestion.put("message", reason.isBlank() ? picked.getName() + " — R" + String.format("%.0f", total) : reason);

            Map<String, Object> interp = new LinkedHashMap<>();
            interp.put("servings", servings);
            interp.put("budgetPerPerson", null);
            interp.put("totalBudget", null);
            interp.put("tags", List.of());
            interp.put("confidence", 0.95);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("interpretation", interp);
            result.put("suggestion", suggestion);
            result.put("alternatives", altList);
            return result;
        } catch (Exception e) {
            return null; // parse failure — fall through to rules
        }
    }

    private Map<String, Object> interpretWithRules(String prompt, List<MenuItem> available, UUID tenantId, UUID userId) {
        IntentParser.ParsedIntent parsed = parseIntent(prompt);

        List<MenuItem> candidates = available;
        if (parsed.budgetPerPerson() != null) {
            candidates = candidates.stream()
                    .filter(i -> i.getPrice() <= parsed.budgetPerPerson()).collect(Collectors.toList());
        }

        Map<String, List<String>> tagMap = intentProfileService.buildTagMap(tenantId);
        Set<UUID> promotedIds = collectPromotedItemIds(tenantId);
        RecommendationContext ctx = new RecommendationContext(
                userId, tenantId, null, null, parsed.budgetPerPerson(),
                ZonedDateTime.now(SAST).getHour(), null, promotedIds, Collections.emptySet());

        List<ScoredItem> ranked = recommendationEngine.rank(ctx, candidates, tagMap);
        if (!parsed.preferredTags().isEmpty()) {
            ranked = ranked.stream().sorted(Comparator.comparingInt((ScoredItem si) -> {
                List<String> itemTags = tagMap.getOrDefault(si.id().toString(), Collections.emptyList());
                long matches = parsed.preferredTags().stream()
                        .filter(t -> itemTags.stream().anyMatch(it -> it.equalsIgnoreCase(t))).count();
                return -(int) matches;
            }).thenComparingInt(si -> -si.score())).collect(Collectors.toList());
        }

        if (ranked.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                "No items matched your request. Try broadening your criteria.");

        ScoredItem top = ranked.get(0);
        double total = top.price() * parsed.servings();
        String token = UUID.randomUUID().toString();
        pendingSuggestions.put(token, new SuggestedOrder(token, top.id(), parsed.servings(), tenantId, userId,
                System.currentTimeMillis() + 10 * 60 * 1000L));

        Map<String, Object> suggestion = new LinkedHashMap<>();
        suggestion.put("suggestionToken", token);
        suggestion.put("mode", "SINGLE_ITEM");
        suggestion.put("items", List.of(Map.of("menuItemId", top.id(), "name", top.name(),
                "quantity", parsed.servings(), "unitPrice", top.price(), "totalPrice", total)));
        suggestion.put("totalEstimate", total);
        suggestion.put("message", buildMessage(top, parsed));

        Map<String, Object> interp = new LinkedHashMap<>();
        interp.put("servings", parsed.servings());
        interp.put("budgetPerPerson", parsed.budgetPerPerson());
        interp.put("totalBudget", parsed.budgetPerPerson() != null ? parsed.budgetPerPerson() * parsed.servings() : null);
        interp.put("tags", parsed.preferredTags());
        interp.put("confidence", parsed.confidence());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("interpretation", interp);
        result.put("suggestion", suggestion);
        result.put("alternatives", ranked.stream().skip(1).limit(2)
                .map(a -> {
                    Map<String, Object> alt = new LinkedHashMap<>();
                    alt.put("menuItemId", a.id());
                    alt.put("name", a.name());
                    alt.put("price", a.price());
                    return alt;
                })
                .collect(Collectors.toList()));
        return result;
    }

    public List<com.example.backend.entity.CartItemDTO> confirm(String token, UUID userId) {
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

    private boolean isFoodOrderRequest(String prompt) {
        if (anthropicClient.isConfigured()) {
            String raw = anthropicClient.call(
                "Is this a food or drink order request, or a question about what to eat/drink? Reply only YES or NO.\n" +
                "Message: \"" + prompt.replace("\"", "'") + "\"", 5);
            if (raw != null) return raw.trim().toUpperCase().startsWith("Y");
        }
        // Keyword fallback: reject obviously non-food input
        String lower = prompt.toLowerCase();
        boolean hasFood = containsAny(lower, "food", "eat", "drink", "hungry", "meal", "burger", "pizza",
                "chicken", "something", "cheap", "filling", "healthy", "spicy", "vegan", "order",
                "lunch", "dinner", "breakfast", "snack", "treat", "budget", "people", "person");
        boolean hasNonFood = !hasFood && containsAny(lower, "weather", "sport", "soccer", "football",
                "world cup", "news", "politics", "movie", "music", "game", "who", "when is", "what is the");
        return hasFood || !hasNonFood;
    }

    private boolean containsAny(String text, String... keywords) {
        for (String kw : keywords) if (text.contains(kw)) return true;
        return false;
    }

    /** Tries Claude first for richer understanding, falls back to keyword parser. */
    private IntentParser.ParsedIntent parseIntent(String prompt) {
        if (anthropicClient.isConfigured()) {
            String aiPrompt =
                "Extract order intent from this food order request. Return JSON only, no markdown:\n" +
                "{\n" +
                "  \"servings\": <number of people, default 1>,\n" +
                "  \"budgetPerPerson\": <max price per person in ZAR or null>,\n" +
                "  \"preferredTags\": [<tags from: filling,comfort,healthy,light,premium,indulgent,quick,grilled,fried,spicy,sweet,vegan,value>],\n" +
                "  \"boostPremium\": <true if splurging/treating>,\n" +
                "  \"confidence\": <0.0-1.0>\n" +
                "}\n" +
                "Request: \"" + prompt.replace("\"", "'") + "\"";

            String raw = anthropicClient.call(aiPrompt, 256);
            if (raw != null) {
                try {
                    String cleaned = raw.trim()
                            .replaceAll("(?s)^```json\\s*", "").replaceAll("(?s)^```\\s*", "").replaceAll("(?s)\\s*```$", "");
                    var node = new com.fasterxml.jackson.databind.ObjectMapper().readTree(cleaned);
                    int servings = node.path("servings").asInt(1);
                    Double budget = node.path("budgetPerPerson").isNull() ? null : node.path("budgetPerPerson").asDouble();
                    List<String> tags = new ArrayList<>();
                    node.path("preferredTags").forEach(t -> tags.add(t.asText()));
                    boolean premium = node.path("boostPremium").asBoolean(false);
                    double confidence = node.path("confidence").asDouble(0.8);
                    return new IntentParser.ParsedIntent(servings, budget, tags, premium, confidence);
                } catch (Exception ignored) {}
            }
        }
        return intentParser.parse(prompt);
    }

    /** Customer-facing menu Q&A powered by Claude. */
    public Map<String, Object> chatAboutMenu(String question, UUID tenantId) {
        List<MenuItem> items = menuItemRepository.findByTenant_Id(tenantId)
                .stream().filter(i -> Boolean.TRUE.equals(i.getIsAvailable()))
                .limit(40).collect(Collectors.toList());

        if (items.isEmpty()) {
            return Map.of("answer", "Our menu is being updated right now — please check back shortly!");
        }

        String menuText = items.stream()
                .map(i -> String.format("- %s | R%.0f | %s%s", i.getName(), i.getPrice(), i.getCategory(),
                        i.getDescription() != null && !i.getDescription().isBlank() ? " | " + i.getDescription() : ""))
                .collect(Collectors.joining("\n"));

        if (anthropicClient.isConfigured()) {
            String aiPrompt =
                "You are a friendly, conversational AI assistant for a South African food delivery restaurant.\n" +
                "Your job is to help customers with anything they ask — menu questions, recommendations, dietary needs, prices, or general chat.\n\n" +
                "Rules:\n" +
                "- If the question is about food, our menu, or ordering: answer using the menu data below.\n" +
                "- If the question is off-topic (weather, sports, news, etc.): politely say you're here to help with food and gently redirect.\n" +
                "- If the question is ambiguous: make a reasonable food-related assumption and answer helpfully.\n" +
                "- If what they want doesn't exist on our menu: say so honestly and suggest the closest option.\n" +
                "- Be warm, natural, and conversational — not robotic. Use South African context where appropriate.\n" +
                "- Keep answers concise (1-3 sentences max) unless listing multiple items.\n\n" +
                "Our menu:\n" + menuText + "\n\n" +
                "Customer says: " + question;

            String answer = anthropicClient.call(aiPrompt, 400);
            if (answer != null && !answer.isBlank()) {
                return Map.of("answer", answer.trim());
            }
        }

        return Map.of("answer", buildMenuChatFallback(question, items));
    }

    private String buildMenuChatFallback(String question, List<MenuItem> items) {
        String q = question.toLowerCase();
        if (q.contains("vegan") || q.contains("vegetarian") || q.contains("plant")) {
            return items.stream().filter(i -> i.getCategory() != null &&
                    (i.getCategory().toLowerCase().contains("salad") || i.getCategory().toLowerCase().contains("healthy")))
                    .findFirst()
                    .map(i -> "We have " + i.getName() + " (R" + String.format("%.0f", i.getPrice()) + ") which could work for you!")
                    .orElse("Please ask our staff about vegetarian/vegan options — they'll be happy to help.");
        }
        if (q.contains("cheap") || q.contains("budget") || q.contains("affordable")) {
            return items.stream().min(Comparator.comparingDouble(MenuItem::getPrice))
                    .map(i -> "Our most affordable option is " + i.getName() + " at R" + String.format("%.0f", i.getPrice()) + ".")
                    .orElse("We have options for every budget!");
        }
        if (q.contains("popular") || q.contains("best") || q.contains("recommend")) {
            return items.stream().findFirst()
                    .map(i -> "A popular choice is " + i.getName() + " — try it out!")
                    .orElse("Everything on our menu is delicious — browse above to find something you like!");
        }
        // Generic fallback — list a few items so the user has something useful
        String sample = items.stream().limit(3)
                .map(i -> i.getName() + " (R" + String.format("%.0f", i.getPrice()) + ")")
                .collect(Collectors.joining(", "));
        return "I'm not sure about that one, but here are a few things on our menu: " + sample + ". Scroll up to see everything!";
    }

    record SuggestedOrder(String token, UUID menuItemId, int quantity, UUID tenantId, UUID userId, long expiresAt) {}
}
