package com.example.backend.service;

import com.example.backend.entity.Category;
import com.example.backend.entity.MenuItem;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.CartItemRepository;
import com.example.backend.repository.CategoryRepository;
import com.example.backend.repository.InventoryLogRepository;
import com.example.backend.repository.MenuItemRepository;
import com.example.backend.repository.TenantRepository;
import com.example.backend.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RequiredArgsConstructor
@Service
public class MenuService {

    private final MenuItemRepository menuItemRepository;
    private final TenantRepository tenantRepository;
    private final CartItemRepository cartItemRepository;
    private final InventoryLogRepository inventoryLogRepository;
    private final CategoryRepository categoryRepository;
    private final SubscriptionEnforcementService subscriptionEnforcementService;
    private final AuditService auditService;

    public MenuItem saveMenuItem(MenuItem menuItem) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId != null) {
            subscriptionEnforcementService.assertMenuItemLimit(tenantId);
        }
        setTenantOnEntity(menuItem);
        ensureCategory(menuItem.getCategory());
        MenuItem saved = menuItemRepository.save(menuItem);
        auditService.log(AuditService.ADMIN, "MENU_ITEM_CREATED", "MENU_ITEM", saved.getId(),
                saved.getName() + " — R" + saved.getPrice());
        return saved;
    }

    public MenuItem updateMenuItem(UUID id, MenuItem updatedMenuItem) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        MenuItem menuItem = (tenantId != null)
                ? menuItemRepository.findByIdAndTenant_Id(id, tenantId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Menu item not found"))
                : menuItemRepository.findById(id)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Menu item not found"));

        Double oldPrice = menuItem.getPrice();
        Boolean oldAvail = menuItem.getIsAvailable();

        if (updatedMenuItem.getName() != null) menuItem.setName(updatedMenuItem.getName());
        if (updatedMenuItem.getCategory() != null) menuItem.setCategory(updatedMenuItem.getCategory());
        menuItem.setDescription(updatedMenuItem.getDescription());
        menuItem.setPrice(updatedMenuItem.getPrice());
        menuItem.setCost(updatedMenuItem.getCost());
        if (updatedMenuItem.getIsAvailable() != null) menuItem.setIsAvailable(updatedMenuItem.getIsAvailable());
        menuItem.setImage(updatedMenuItem.getImage());
        menuItem.setStock(updatedMenuItem.getStock());
        menuItem.setReservedStock(updatedMenuItem.getReservedStock());
        menuItem.setLowStockThreshold(updatedMenuItem.getLowStockThreshold());

        MenuItem saved = menuItemRepository.save(menuItem);
        StringBuilder change = new StringBuilder(saved.getName());
        if (oldPrice != null && !oldPrice.equals(saved.getPrice())) change.append(" · price R").append(oldPrice).append(" → R").append(saved.getPrice());
        if (oldAvail != null && saved.getIsAvailable() != null && !oldAvail.equals(saved.getIsAvailable()))
            change.append(saved.getIsAvailable() ? " · shown" : " · hidden");
        auditService.log(AuditService.ADMIN, "MENU_ITEM_UPDATED", "MENU_ITEM", saved.getId(), change.toString());
        return saved;
    }

    /**
     * CSV import upsert: match an item by name within the current tenant. If it
     * exists, update ONLY the fields the CSV supplied (price/category/description/
     * stock/cost) and leave image, reserved stock, threshold and availability
     * untouched — so re-importing to add costs never wipes existing data. If it
     * doesn't exist, create it (subject to the plan's item limit).
     * Returns true when a new item was created, false when an existing one was updated.
     */
    @Transactional
    public boolean importMenuItem(String name, Double price, String category,
                                  String description, Integer stock, Double cost) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        ensureCategory(category);
        MenuItem existing = (tenantId != null && name != null)
                ? menuItemRepository.findByTenant_Id(tenantId).stream()
                        .filter(m -> name.equalsIgnoreCase(m.getName()))
                        .findFirst().orElse(null)
                : null;

        if (existing != null) {
            if (price != null) existing.setPrice(price);
            if (category != null && !category.isBlank()) existing.setCategory(category);
            if (description != null && !description.isBlank()) existing.setDescription(description);
            if (stock != null) existing.setStock(stock);
            if (cost != null) existing.setCost(cost);
            menuItemRepository.save(existing);
            return false;
        }

        if (tenantId != null) {
            subscriptionEnforcementService.assertMenuItemLimit(tenantId);
        }
        MenuItem item = new MenuItem();
        item.setName(name);
        item.setPrice(price);
        item.setCategory(category);
        if (description != null && !description.isBlank()) item.setDescription(description);
        if (stock != null) item.setStock(stock);
        if (cost != null) item.setCost(cost);
        item.setIsAvailable(true);
        setTenantOnEntity(item);
        menuItemRepository.save(item);
        return true;
    }

    @Transactional
    public void deleteMenuItem(UUID id) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        MenuItem menuItem = (tenantId != null)
                ? menuItemRepository.findByIdAndTenant_Id(id, tenantId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Menu item not found"))
                : menuItemRepository.findById(id)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Menu item not found"));
        String name = menuItem.getName();
        cartItemRepository.deleteByMenuItem(menuItem);
        inventoryLogRepository.nullifyMenuItemReference(menuItem);
        menuItemRepository.delete(menuItem);
        auditService.log(AuditService.ADMIN, "MENU_ITEM_DELETED", "MENU_ITEM", id, "Deleted — " + name);
    }

    public MenuItem getMenuItemById(UUID id) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId != null) {
            // Scope to the store in context so a menu item can't be read across tenants by raw UUID.
            return menuItemRepository.findByIdAndTenant_Id(id, tenantId)
                    .orElseThrow(() -> new RuntimeException("Menu item not found"));
        }
        return menuItemRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Menu item not found"));
    }

    public List<MenuItem> getAllMenuItems() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return java.util.List.of(); // no store context → don't leak every store's menu
        return menuItemRepository.findByTenant_Id(tenantId);
    }

    public List<MenuItem> saveAllMenuItems(List<MenuItem> menuItems) {
        menuItems.forEach(this::setTenantOnEntity);
        return menuItemRepository.saveAll(menuItems);
    }

    @Transactional
    public int bulkAdjustPrices(List<UUID> ids, String type, double value) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tenant context");
        List<MenuItem> items = menuItemRepository.findByIdInAndTenant_Id(ids, tenantId);
        for (MenuItem item : items) {
            double newPrice;
            if ("PERCENT".equalsIgnoreCase(type)) {
                newPrice = item.getPrice() * (1 + value / 100.0);
            } else {
                newPrice = item.getPrice() + value;
            }
            item.setPrice(Math.max(0, newPrice));
        }
        menuItemRepository.saveAll(items);
        return items.size();
    }

    /** Make sure a category record exists for this tenant+name so the categories
     *  table stays in sync with item.category strings — esp. via the CSV import
     *  path, which otherwise left categoryCount=0 and blocked go-live (B2). */
    private void ensureCategory(String name) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null || name == null || name.isBlank()) return;
        if (categoryRepository.existsByNameAndTenant_Id(name, tenantId)) return;
        tenantRepository.findById(tenantId).ifPresent(tenant -> {
            Category cat = new Category();
            cat.setName(name);
            cat.setTenant(tenant);
            categoryRepository.save(cat);
        });
    }

    private void setTenantOnEntity(MenuItem item) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId != null) {
            // ALWAYS pin to the caller's tenant — never trust a client-supplied tenant on the bound
            // entity. The old `item.getTenant() == null` guard let an admin set tenant.id in the body
            // and create a menu item in another store (cross-tenant mass-assignment).
            Tenant tenant = tenantRepository.findById(tenantId)
                    .orElseThrow(() -> new RuntimeException("Tenant not found"));
            item.setTenant(tenant);
        } else {
            // No tenant context — refuse any client-supplied tenant rather than persist it.
            item.setTenant(null);
        }
    }
}
