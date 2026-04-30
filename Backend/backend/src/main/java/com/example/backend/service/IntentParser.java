package com.example.backend.service;

import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class IntentParser {

    private static final Pattern FOR_N_PEOPLE = Pattern.compile("\\bfor\\s+(\\d+)\\s+(?:people|person|persons|ppl)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern UNDER_AMOUNT  = Pattern.compile("\\bunder\\s+r?(\\d+)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern MAX_AMOUNT    = Pattern.compile("\\bmax(?:imum)?\\s+r?(\\d+)\\b", Pattern.CASE_INSENSITIVE);

    public ParsedIntent parse(String prompt) {
        if (prompt == null || prompt.isBlank()) return defaultIntent();
        String lower = prompt.toLowerCase(Locale.ROOT);

        int servings   = extractServings(lower);
        Double budget  = extractBudget(lower);
        List<String> tags = extractTags(lower);
        boolean boostPremium = isPremium(lower);
        double confidence = computeConfidence(servings, budget, tags);

        return new ParsedIntent(servings, budget, tags, boostPremium, confidence);
    }

    private int extractServings(String text) {
        Matcher m = FOR_N_PEOPLE.matcher(text);
        if (m.find()) return Integer.parseInt(m.group(1));
        if (text.contains("just me") || text.contains("for me") || text.contains("myself")) return 1;
        return 1;
    }

    private Double extractBudget(String text) {
        Matcher under = UNDER_AMOUNT.matcher(text);
        if (under.find()) return Double.parseDouble(under.group(1));
        Matcher max = MAX_AMOUNT.matcher(text);
        if (max.find()) return Double.parseDouble(max.group(1));
        if (containsAny(text, "cheap", "broke", "budget", "affordable", "inexpensive")) return 80.0;
        if (containsAny(text, "very cheap", "super cheap", "as cheap")) return 60.0;
        if (containsAny(text, "splurge", "treat", "spoil", "celebrate")) return null; // no cap
        return null;
    }

    private List<String> extractTags(String text) {
        List<String> tags = new ArrayList<>();
        if (containsAny(text, "filling", "big", "huge", "full", "stuffed")) tags.add("filling");
        if (containsAny(text, "comfort", "cosy", "warm", "hearty"))         tags.add("comfort");
        if (containsAny(text, "healthy", "clean", "light", "diet", "fit"))  tags.add("healthy");
        if (containsAny(text, "vegan", "plant based", "plant-based"))       tags.add("vegan");
        if (containsAny(text, "grilled", "grill"))                          tags.add("grilled");
        if (containsAny(text, "quick", "fast", "speedy", "asap"))           tags.add("quick");
        if (containsAny(text, "spicy", "hot", "peri peri", "peri-peri"))    tags.add("spicy");
        if (containsAny(text, "sweet", "dessert", "cake"))                  tags.add("sweet");
        if (containsAny(text, "premium", "fancy", "luxury", "gourmet"))     tags.add("premium");
        if (containsAny(text, "value", "cheap", "budget"))                  tags.add("value");
        return tags;
    }

    private boolean isPremium(String text) {
        return containsAny(text, "splurge", "treat", "spoil", "celebrate", "fancy", "premium", "gourmet");
    }

    private double computeConfidence(int servings, Double budget, List<String> tags) {
        double score = 0.5;
        if (servings > 1) score += 0.15;
        if (budget != null) score += 0.20;
        if (!tags.isEmpty()) score += 0.10 * Math.min(tags.size(), 2);
        return Math.min(score, 0.98);
    }

    private boolean containsAny(String text, String... keywords) {
        for (String kw : keywords) {
            if (text.contains(kw)) return true;
        }
        return false;
    }

    private ParsedIntent defaultIntent() {
        return new ParsedIntent(1, null, Collections.emptyList(), false, 0.3);
    }

    public record ParsedIntent(
            int servings,
            Double budgetPerPerson,
            List<String> preferredTags,
            boolean boostPremium,
            double confidence
    ) {}
}
