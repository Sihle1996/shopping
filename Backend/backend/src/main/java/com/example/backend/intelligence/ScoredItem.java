package com.example.backend.intelligence;

import com.example.backend.entity.MenuItem;

import java.util.List;
import java.util.UUID;

public record ScoredItem(
        UUID id,
        String name,
        String description,
        double price,
        String category,
        String image,
        boolean isAvailable,
        int score,
        ScoreBreakdown breakdown,
        List<String> tags
) {
    public record ScoreBreakdown(
            int distance,
            int priceFit,
            int timeOfDay,
            int promotion,
            int weather,
            int favourite
    ) {}

    public static ScoredItem from(MenuItem item, int score, ScoreBreakdown breakdown, List<String> tags) {
        return new ScoredItem(
                item.getId(),
                item.getName(),
                item.getDescription(),
                item.getPrice(),
                item.getCategory(),
                item.getImage(),
                Boolean.TRUE.equals(item.getIsAvailable()),
                score,
                breakdown,
                tags
        );
    }
}
