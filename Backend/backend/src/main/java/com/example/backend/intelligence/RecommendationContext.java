package com.example.backend.intelligence;

import java.util.Set;
import java.util.UUID;

public record RecommendationContext(
        UUID userId,
        UUID tenantId,
        Double tenantLat,
        Double tenantLon,
        Double budgetRand,
        Integer hourOfDay,
        String weather,
        Set<UUID> promotedItemIds,
        Set<UUID> favouriteItemIds
) {}
