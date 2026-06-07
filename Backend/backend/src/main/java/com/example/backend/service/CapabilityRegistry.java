package com.example.backend.service;

import com.example.backend.repository.CategoryRepository;
import com.example.backend.repository.MenuItemRepository;
import com.example.backend.repository.PromotionRepository;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * The single source of truth for what the AI (and, in time, the UI) can DO in
 * each module — folded into one tenant-aware manifest:
 *   capability (actions) · constraints (headroom) · workflow · UI metadata (fields).
 *
 * Options are resolved LIVE per tenant (real categories, plan headroom) so the
 * Copilot reasons over the store's actual choices instead of hardcoded guesses.
 * Add a module by writing one private builder; the AI sees it automatically.
 */
@Service
@RequiredArgsConstructor
public class CapabilityRegistry {

    private final MenuItemRepository menuItemRepository;
    private final CategoryRepository categoryRepository;
    private final PromotionRepository promotionRepository;
    private final SubscriptionEnforcementService subscriptionEnforcementService;

    /** Target gross margin the AI aims for when suggesting a price from cost. */
    private static final int TARGET_MARGIN_PCT = 65;

    /** Describe one module, or all when {@code module} is null/blank. */
    @Transactional(readOnly = true)
    public List<CapabilityModule> describe(UUID tenantId, String module) {
        List<CapabilityModule> out = new ArrayList<>();
        if (wants(module, "menu")) out.add(menu(tenantId));
        if (wants(module, "promotions")) out.add(promotions(tenantId));
        return out;
    }

    private boolean wants(String filter, String module) {
        return filter == null || filter.isBlank() || filter.equalsIgnoreCase(module);
    }

    /**
     * Valid categories = the union of the category list AND the categories actually
     * used on items (they can drift, e.g. after a CSV import) — reflect reality.
     */
    private List<String> categoriesFor(UUID tenantId) {
        Set<String> catSet = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
        categoryRepository.findByTenant_Id(tenantId).forEach(c -> {
            if (c.getName() != null && !c.getName().isBlank()) catSet.add(c.getName().trim());
        });
        menuItemRepository.findByTenant_Id(tenantId).forEach(mi -> {
            if (mi.getCategory() != null && !mi.getCategory().isBlank()) catSet.add(mi.getCategory().trim());
        });
        return new ArrayList<>(catSet);
    }

    // ── Menu ──────────────────────────────────────────────────────────────────

    private CapabilityModule menu(UUID tenantId) {
        List<String> categories = categoriesFor(tenantId);

        long used = menuItemRepository.countByTenant_Id(tenantId);
        int max = 0;
        try { max = subscriptionEnforcementService.getPlan(tenantId).getMaxMenuItems(); } catch (Exception ignored) {}
        Map<String, Object> headroom = new LinkedHashMap<>();
        headroom.put("max", max);
        headroom.put("used", used);
        headroom.put("remaining", Math.max(0, max - used));
        boolean canAddItems = max <= 0 || used < max;

        String marginRule = "price = cost / (1 - " + TARGET_MARGIN_PCT + "/100); aim for ~"
                + TARGET_MARGIN_PCT + "% gross margin and never below cost";

        CapabilityAction create = new CapabilityAction(
                "create_menu_item", "Add menu item", "Add a new dish or drink to the menu.",
                canAddItems ? Map.of("planItems", headroom)
                            : Map.of("planItems", headroom, "blocked", "At menu-item limit — upgrade to add more"),
                List.of(
                        field("name", "string", true, null, null, null, null),
                        enumField("category", true, categories, "Must be one of the store's existing categories"),
                        field("cost", "money", false, false, null, null,
                                "The owner's REAL cost to make it — never guess; it drives margin"),
                        suggestField("price", "money", true, List.of("cost"), marginRule,
                                "Suggest once cost is known, or from similar items' median price; keep above cost"),
                        suggestField("description", "string", false, null, null, null),
                        field("stock", "integer", false, null, null, null,
                                "Set before the item can be sold (defaults to 0 = sold out)")),
                null);

        CapabilityAction setPrice = new CapabilityAction(
                "set_item_price", "Change item price", "Set the selling price of an existing item.",
                null,
                List.of(
                        field("item", "string", true, null, null, null, "An existing item name (see get_menu)"),
                        suggestField("price", "money", true, List.of("cost"), marginRule,
                                "Use the item's cost & margin from get_menu; never set below cost")),
                null);

        return new CapabilityModule("menu", "Menu", List.of(create, setPrice));
    }

    // ── Promotions ────────────────────────────────────────────────────────────

    private CapabilityModule promotions(UUID tenantId) {
        List<String> categories = categoriesFor(tenantId);

        int max = 0;
        try { max = subscriptionEnforcementService.getPlan(tenantId).getMaxPromotions(); } catch (Exception ignored) {}
        long used = promotionRepository.countByTenant_IdAndActiveTrue(tenantId);
        Map<String, Object> headroom = new LinkedHashMap<>();
        headroom.put("max", max);
        headroom.put("used", used);
        headroom.put("remaining", Math.max(0, max - used));
        boolean canAdd = max <= 0 || used < max;

        CapabilityAction create = new CapabilityAction(
                "create_promotion", "Create a promotion",
                "Run a time-limited discount. Choose the scope deliberately from the data.",
                canAdd ? Map.of("activePromotions", headroom)
                       : Map.of("activePromotions", headroom, "blocked", "At active-promotion limit — deactivate one or upgrade"),
                List.of(
                        field("title", "string", true, null, null, null, null),
                        field("discountPercent", "number", true, null, null, null,
                                "1-100; keep it BELOW the targeted item's gross margin so it never sells below cost"),
                        field("days", "integer", false, null, null, null, "Duration in days (default 3)"),
                        enumField("appliesTo", true, List.of("ALL", "CATEGORY", "PRODUCT"),
                                "Scope. Prefer PRODUCT (a healthy-margin favourite) or CATEGORY over blunt store-wide ALL"),
                        field("target", "string", false, null, categories, List.of("appliesTo"),
                                "Required unless ALL. For CATEGORY use one of the listed categories; for PRODUCT use an exact item name from get_menu")),
                null);

        return new CapabilityModule("promotions", "Promotions", List.of(create));
    }

    // ── Field helpers ───────────────────────────────────────────────────────

    private static CapabilityField field(String name, String type, boolean required, Boolean aiCanSuggest,
                                         List<String> options, List<String> dependsOn, String reason) {
        return new CapabilityField(name, type, required, aiCanSuggest, options, dependsOn, null, reason);
    }

    private static CapabilityField enumField(String name, boolean required, List<String> options, String reason) {
        return new CapabilityField(name, "enum", required, false, options, null, null, reason);
    }

    private static CapabilityField suggestField(String name, String type, boolean required,
                                                List<String> dependsOn, String suggestRule, String reason) {
        return new CapabilityField(name, type, required, true, null, dependsOn, suggestRule, reason);
    }

    // ── Manifest model (single source of truth; serialised to the AI) ─────────

    public record CapabilityModule(String module, String label, List<CapabilityAction> actions) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record CapabilityAction(String id, String label, String description,
                                   Map<String, Object> constraints, List<CapabilityField> fields, Object workflow) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record CapabilityField(String name, String type, boolean required, Boolean aiCanSuggest,
                                  List<String> options, List<String> dependsOn, String suggestRule, String reason) {}
}
