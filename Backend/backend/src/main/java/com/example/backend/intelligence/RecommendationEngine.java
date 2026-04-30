package com.example.backend.intelligence;

import com.example.backend.entity.MenuItem;

import java.util.List;
import java.util.Map;
import java.util.Set;

public interface RecommendationEngine {
    /**
     * Ranks candidate menu items given the provided context.
     * Phase 1: rules-based. Phase 3: swap for ML implementation.
     */
    List<ScoredItem> rank(RecommendationContext ctx, List<MenuItem> candidates, Map<String, List<String>> tagsByItemId);
}
