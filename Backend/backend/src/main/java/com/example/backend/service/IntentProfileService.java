package com.example.backend.service;

import com.example.backend.entity.IntentProfile;
import com.example.backend.entity.ItemTag;
import com.example.backend.entity.MenuItem;
import com.example.backend.intelligence.RecommendationContext;
import com.example.backend.intelligence.RecommendationEngine;
import com.example.backend.intelligence.ScoredItem;
import com.example.backend.repository.IntentProfileRepository;
import com.example.backend.repository.ItemTagRepository;
import com.example.backend.repository.MenuItemRepository;
import com.example.backend.repository.PromotionRepository;
import com.example.backend.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class IntentProfileService {

    private final IntentProfileRepository intentProfileRepository;
    private final ItemTagRepository itemTagRepository;
    private final MenuItemRepository menuItemRepository;
    private final PromotionRepository promotionRepository;
    private final RecommendationEngine recommendationEngine;

    private static final ZoneId SAST = ZoneId.of("Africa/Johannesburg");

    /** Returns all available intent chips for the current tenant. */
    public List<Map<String, String>> listIntents(UUID tenantId) {
        List<IntentProfile> globals = intentProfileRepository.findByTenantIsNull();
        List<IntentProfile> overrides = tenantId != null
                ? intentProfileRepository.findByTenant_Id(tenantId) : Collections.emptyList();

        Set<String> overrideKeys = overrides.stream()
                .map(IntentProfile::getIntentKey).collect(Collectors.toSet());

        List<IntentProfile> effective = new ArrayList<>(overrides);
        globals.stream().filter(g -> !overrideKeys.contains(g.getIntentKey())).forEach(effective::add);

        return effective.stream()
                .sorted(Comparator.comparing(IntentProfile::getIntentKey))
                .map(p -> Map.of(
                        "key",   p.getIntentKey(),
                        "label", p.getLabel(),
                        "emoji", p.getEmoji() != null ? p.getEmoji() : ""
                ))
                .collect(Collectors.toList());
    }

    /** Returns scored + filtered items for a given intent key. */
    public Map<String, Object> getByIntent(String intentKey, int limit, UUID tenantId) {
        IntentProfile profile = resolveProfile(intentKey, tenantId);

        List<MenuItem> allItems = tenantId != null
                ? menuItemRepository.findByTenant_Id(tenantId)
                : menuItemRepository.findAll();

        // Build tag map for all items
        Map<String, List<String>> tagsByItemId = buildTagMap(tenantId);

        // Pre-filter by intent constraints
        List<MenuItem> filtered = allItems.stream()
                .filter(i -> i.isAvailable())
                .filter(i -> profile.getMaxPriceRand() == null
                        || i.getPrice() <= profile.getMaxPriceRand().doubleValue())
                .filter(i -> {
                    List<String> itemTags = tagsByItemId.getOrDefault(i.getId().toString(), Collections.emptyList());
                    return profile.excludedTagList().stream()
                            .noneMatch(excluded -> itemTags.stream().anyMatch(t -> t.equalsIgnoreCase(excluded)));
                })
                .collect(Collectors.toList());

        // Collect promoted item IDs
        Set<UUID> promotedIds = collectPromotedItemIds(tenantId);

        // Build context
        int hour = ZonedDateTime.now(SAST).getHour();
        RecommendationContext ctx = new RecommendationContext(
                null, tenantId, null, null,
                profile.getMaxPriceRand() != null ? profile.getMaxPriceRand().doubleValue() : null,
                hour, null, promotedIds, Collections.emptySet()
        );

        List<ScoredItem> ranked = recommendationEngine.rank(ctx, filtered, tagsByItemId);

        // Apply category boost: if item matches preferredCategories, bonus already in scorer;
        // additionally sort by PRICE_ASC if profile requires it
        if ("PRICE_ASC".equalsIgnoreCase(profile.getSortBy())) {
            ranked.sort(Comparator.comparingDouble(ScoredItem::price));
        } else if ("PRICE_DESC".equalsIgnoreCase(profile.getSortBy())) {
            ranked.sort(Comparator.comparingDouble(ScoredItem::price).reversed());
        }

        List<ScoredItem> page = ranked.stream().limit(limit).collect(Collectors.toList());

        return Map.of(
                "intent", profile.getIntentKey(),
                "label",  profile.getLabel(),
                "emoji",  profile.getEmoji() != null ? profile.getEmoji() : "",
                "items",  page
        );
    }

    public IntentProfile resolveProfile(String intentKey, UUID tenantId) {
        if (tenantId != null) {
            Optional<IntentProfile> override = intentProfileRepository
                    .findByIntentKeyAndTenant_Id(intentKey, tenantId);
            if (override.isPresent()) return override.get();
        }
        return intentProfileRepository.findByIntentKeyAndTenantIsNull(intentKey)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Unknown intent: " + intentKey));
    }

    public Map<String, List<String>> buildTagMap(UUID tenantId) {
        List<ItemTag> tags = tenantId != null
                ? itemTagRepository.findByTenant_Id(tenantId)
                : itemTagRepository.findAll();
        Map<String, List<String>> map = new HashMap<>();
        for (ItemTag tag : tags) {
            map.computeIfAbsent(tag.getMenuItem().getId().toString(), k -> new ArrayList<>())
               .add(tag.getTag());
        }
        return map;
    }

    @SuppressWarnings("unchecked")
    private Set<UUID> collectPromotedItemIds(UUID tenantId) {
        try {
            var promos = tenantId != null
                    ? promotionRepository.findActiveByTenantId(java.time.OffsetDateTime.now(), tenantId)
                    : promotionRepository.findActive(java.time.OffsetDateTime.now());
            Set<UUID> ids = new HashSet<>();
            for (var p : promos) {
                if (p.getTargetProductId() != null) ids.add(p.getTargetProductId());
                if (p.getTargetProducts() != null) {
                    p.getTargetProducts().forEach(tp -> ids.add(tp.getId()));
                }
            }
            return ids;
        } catch (Exception e) {
            return Collections.emptySet();
        }
    }
}
