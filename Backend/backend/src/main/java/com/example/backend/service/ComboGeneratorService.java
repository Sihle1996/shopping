package com.example.backend.service;

import com.example.backend.entity.Combo;
import com.example.backend.entity.ComboItem;
import com.example.backend.entity.MenuItem;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.ComboRepository;
import com.example.backend.repository.MenuItemRepository;
import com.example.backend.repository.TenantRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ComboGeneratorService {

    private static final double COMBO_DISCOUNT = 0.90;
    private static final int MAX_SYSTEM_COMBOS_PER_TENANT = 5;

    private static final Set<String> MAIN_CATEGORIES  = Set.of("Burgers", "Pizza", "Meals", "Pasta", "Wraps", "Pitas", "Steaks");
    private static final Set<String> DRINK_CATEGORIES = Set.of("Drinks", "Cold Drinks", "Juices", "Smoothies", "Milkshakes");
    private static final Set<String> SIDE_CATEGORIES  = Set.of("Sides", "Fries", "Salads", "Soups", "Extras");

    private final MenuItemRepository menuItemRepository;
    private final ComboRepository comboRepository;
    private final TenantRepository tenantRepository;

    /** On startup: generate system combos for any tenant that has none yet. */
    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void generateOnStartupIfEmpty() {
        tenantRepository.findByActiveTrue().forEach(t -> {
            if (!comboRepository.existsByTenant_IdAndSource(t.getId(), "SYSTEM")) {
                int n = generateForTenant(t.getId());
                if (n > 0) log.info("ComboGeneratorService: generated {} system combos for tenant {}", n, t.getId());
            }
        });
    }

    @Scheduled(cron = "0 0 3 * * *") // 3 AM daily
    @Transactional
    public void regenerateAllTenants() {
        tenantRepository.findByActiveTrue().forEach(t -> generateForTenant(t.getId()));
    }

    @Transactional
    public int generateForTenant(UUID tenantId) {
        comboRepository.deleteSystemCombosByTenant(tenantId);

        Tenant tenant = tenantRepository.findById(tenantId).orElse(null);
        if (tenant == null) return 0;

        List<MenuItem> items = menuItemRepository.findByTenant_Id(tenantId)
                .stream().filter(MenuItem::isAvailable).collect(Collectors.toList());

        List<MenuItem> mains  = filter(items, MAIN_CATEGORIES);
        List<MenuItem> drinks = filter(items, DRINK_CATEGORIES);
        List<MenuItem> sides  = filter(items, SIDE_CATEGORIES);

        if (mains.isEmpty() || (drinks.isEmpty() && sides.isEmpty())) return 0;

        List<Combo> generated = new ArrayList<>();
        for (MenuItem main : mains) {
            if (generated.size() >= MAX_SYSTEM_COMBOS_PER_TENANT) break;

            MenuItem bestDrink = drinks.isEmpty() ? null : drinks.get(0);
            MenuItem bestSide  = sides.isEmpty()  ? null : sides.get(0);

            if (bestDrink == null && bestSide == null) continue;

            double original = main.getPrice()
                    + (bestDrink != null ? bestDrink.getPrice() : 0)
                    + (bestSide  != null ? bestSide.getPrice()  : 0);

            double comboRaw = original * COMBO_DISCOUNT;
            double comboPrice = Math.round(comboRaw / 5.0) * 5.0; // round to nearest R5

            List<ComboItem> comboItems = new ArrayList<>();
            comboItems.add(buildComboItem(main, "MAIN"));
            if (bestDrink != null) comboItems.add(buildComboItem(bestDrink, "DRINK"));
            if (bestSide  != null) comboItems.add(buildComboItem(bestSide,  "SIDE"));

            String name = main.getName() + " Meal Deal";

            Combo combo = Combo.builder()
                    .tenant(tenant)
                    .name(name)
                    .comboPrice(BigDecimal.valueOf(comboPrice).setScale(2, RoundingMode.HALF_UP))
                    .originalPrice(BigDecimal.valueOf(original).setScale(2, RoundingMode.HALF_UP))
                    .source("SYSTEM")
                    .active(true)
                    .build();

            combo = comboRepository.save(combo);

            for (ComboItem ci : comboItems) {
                ci.setCombo(combo);
            }
            combo.getItems().addAll(comboItems);
            comboRepository.save(combo);
            generated.add(combo);
        }

        return generated.size();
    }

    private List<MenuItem> filter(List<MenuItem> items, Set<String> categories) {
        return items.stream()
                .filter(i -> categories.stream().anyMatch(c -> c.equalsIgnoreCase(i.getCategory())))
                .sorted(Comparator.comparingDouble(MenuItem::getPrice))
                .collect(Collectors.toList());
    }

    private ComboItem buildComboItem(MenuItem item, String role) {
        return ComboItem.builder()
                .menuItem(item)
                .role(role)
                .quantity(1)
                .build();
    }
}
