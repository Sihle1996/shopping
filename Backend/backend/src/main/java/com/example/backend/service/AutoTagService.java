package com.example.backend.service;

import com.example.backend.entity.ItemTag;
import com.example.backend.entity.MenuItem;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.ItemTagRepository;
import com.example.backend.repository.MenuItemRepository;
import com.example.backend.repository.TenantRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Tags untagged menu items on startup based on their category name.
 * Runs only once per item — skips any item that already has tags.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AutoTagService {

    private final MenuItemRepository menuItemRepository;
    private final ItemTagRepository itemTagRepository;
    private final TenantRepository tenantRepository;

    private static final Map<String, List<String>> CATEGORY_TAG_MAP;

    static {
        Map<String, List<String>> m = new LinkedHashMap<>();
        m.put("burgers",    List.of("filling", "comfort"));
        m.put("pizza",      List.of("filling", "comfort"));
        m.put("meals",      List.of("filling", "comfort"));
        m.put("pasta",      List.of("filling", "comfort"));
        m.put("noodles",    List.of("filling", "comfort"));
        m.put("wraps",      List.of("filling", "healthy"));
        m.put("pitas",      List.of("filling"));
        m.put("steaks",     List.of("premium", "filling", "grilled"));
        m.put("grills",     List.of("premium", "filling", "grilled"));
        m.put("chicken",    List.of("filling", "comfort"));
        m.put("wings",      List.of("filling", "comfort", "spicy"));
        m.put("ribs",       List.of("premium", "filling"));
        m.put("seafood",    List.of("healthy", "premium"));
        m.put("sushi",      List.of("healthy", "premium", "light"));
        m.put("salads",     List.of("healthy", "light"));
        m.put("healthy",    List.of("healthy", "light", "grilled"));
        m.put("vegan",      List.of("healthy", "vegan", "light"));
        m.put("vegetarian", List.of("healthy", "vegetarian", "light"));
        m.put("soups",      List.of("comfort", "warm"));
        m.put("breakfast",  List.of("quick", "light"));
        m.put("snacks",     List.of("quick", "light"));
        m.put("sides",      List.of("quick", "light"));
        m.put("fries",      List.of("quick", "fried"));
        m.put("extras",     List.of("quick"));
        m.put("drinks",     List.of("refreshing"));
        m.put("cold drinks",List.of("refreshing", "cold"));
        m.put("juices",     List.of("healthy", "refreshing"));
        m.put("smoothies",  List.of("healthy", "refreshing"));
        m.put("milkshakes", List.of("indulgent", "sweet"));
        m.put("desserts",   List.of("indulgent", "sweet"));
        m.put("cakes",      List.of("indulgent", "sweet"));
        CATEGORY_TAG_MAP = Collections.unmodifiableMap(m);
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void tagUntaggedItems() {
        List<Tenant> tenants = tenantRepository.findByActiveTrue();
        int total = 0;
        for (Tenant tenant : tenants) {
            total += tagItemsForTenant(tenant);
        }
        if (total > 0) {
            log.info("AutoTagService: applied category-derived tags to {} menu items", total);
        }
    }

    private int tagItemsForTenant(Tenant tenant) {
        List<MenuItem> items = menuItemRepository.findByTenant_Id(tenant.getId());
        int count = 0;
        for (MenuItem item : items) {
            if (item.getCategory() == null) continue;
            boolean alreadyTagged = itemTagRepository.existsByMenuItem_Id(item.getId());
            if (alreadyTagged) continue;

            List<String> tags = resolveTags(item.getCategory());
            if (tags.isEmpty()) continue;

            for (String tag : tags) {
                ItemTag itemTag = ItemTag.builder()
                        .menuItem(item)
                        .tenant(tenant)
                        .tag(tag)
                        .build();
                itemTagRepository.save(itemTag);
            }
            count++;
        }
        return count;
    }

    private List<String> resolveTags(String category) {
        String key = category.trim().toLowerCase();
        // Exact match first, then prefix match
        if (CATEGORY_TAG_MAP.containsKey(key)) return CATEGORY_TAG_MAP.get(key);
        for (Map.Entry<String, List<String>> entry : CATEGORY_TAG_MAP.entrySet()) {
            if (key.contains(entry.getKey()) || entry.getKey().contains(key)) {
                return entry.getValue();
            }
        }
        return Collections.emptyList();
    }
}
