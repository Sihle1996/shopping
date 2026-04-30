package com.example.backend.intelligence;

import com.example.backend.entity.MenuItem;
import com.example.backend.intelligence.ScoredItem;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class RulesRecommendationEngine implements RecommendationEngine {

    private static final Map<Integer, List<String>> TIME_CATEGORY_BOOSTS = Map.of(
            0, List.of("Breakfast", "Toasties", "Coffee"),
            1, List.of("Meals", "Burgers", "Wraps"),
            2, List.of("Meals", "Burgers", "Pasta", "Pizza"),
            3, List.of("Snacks", "Quick Bites", "Fast Food")
    );

    private static final Map<String, List<String>> WEATHER_CATEGORY_BOOSTS = Map.of(
            "RAINING", List.of("Soup", "Soups", "Comfort", "Pasta", "Noodles"),
            "HOT",     List.of("Cold Drinks", "Ice Cream", "Salads", "Smoothies"),
            "COLD",    List.of("Soup", "Soups", "Hot Drinks", "Comfort", "Pasta")
    );

    @Override
    public List<ScoredItem> rank(RecommendationContext ctx,
                                  List<MenuItem> candidates,
                                  Map<String, List<String>> tagsByItemId) {
        List<ScoredItem> scored = new ArrayList<>();

        for (MenuItem item : candidates) {
            if (!Boolean.TRUE.equals(item.getIsAvailable())) continue;

            List<String> tags = tagsByItemId.getOrDefault(item.getId().toString(), Collections.emptyList());

            int distanceScore  = scoreDistance(ctx);
            int priceFitScore  = scorePriceFit(item.getPrice(), ctx.budgetRand());
            int timeScore      = scoreTimeOfDay(item.getCategory(), ctx.hourOfDay());
            int promoScore     = ctx.promotedItemIds().contains(item.getId()) ? 15 : 0;
            int weatherScore   = scoreWeather(item.getCategory(), tags, ctx.weather());
            int favouriteBonus = ctx.favouriteItemIds().contains(item.getId()) ? 8 : 0;

            int total = distanceScore + priceFitScore + timeScore + promoScore + weatherScore + favouriteBonus;

            scored.add(ScoredItem.from(item, total,
                    new ScoredItem.ScoreBreakdown(distanceScore, priceFitScore, timeScore, promoScore, weatherScore, favouriteBonus),
                    tags));
        }

        scored.sort(Comparator.comparingInt(ScoredItem::score).reversed()
                .thenComparing(ScoredItem::name));

        return scored;
    }

    private int scoreDistance(RecommendationContext ctx) {
        // Distance signal: if we have tenant coords, score proximity; else flat 15
        if (ctx.tenantLat() == null || ctx.tenantLon() == null) return 15;
        return 25; // single-tenant context — vendor IS the store, always nearby
    }

    private int scorePriceFit(double price, Double budget) {
        if (budget == null) return 15;
        if (price > budget) return 0;
        double ratio = price / budget;
        return (int) Math.round(25 * (1.0 - ratio));
    }

    private int scoreTimeOfDay(String category, Integer hour) {
        if (hour == null || category == null) return 0;
        int slot = timeSlot(hour);
        List<String> boostCategories = TIME_CATEGORY_BOOSTS.getOrDefault(slot, Collections.emptyList());
        return boostCategories.stream()
                .anyMatch(c -> c.equalsIgnoreCase(category)) ? 20 : 0;
    }

    private int timeSlot(int hour) {
        if (hour >= 6  && hour < 11) return 0; // Breakfast
        if (hour >= 11 && hour < 15) return 1; // Lunch
        if (hour >= 18 && hour < 23) return 2; // Dinner
        return 3;                               // Late night / other
    }

    private int scoreWeather(String category, List<String> tags, String weather) {
        if (weather == null || weather.isBlank()) return 0;
        List<String> boostCategories = WEATHER_CATEGORY_BOOSTS.getOrDefault(weather.toUpperCase(), Collections.emptyList());
        boolean categoryMatch = boostCategories.stream().anyMatch(c -> c.equalsIgnoreCase(category));
        boolean tagMatch = tags.stream().anyMatch(t -> boostCategories.stream().anyMatch(c -> c.equalsIgnoreCase(t)));
        return (categoryMatch || tagMatch) ? 10 : 0;
    }
}
