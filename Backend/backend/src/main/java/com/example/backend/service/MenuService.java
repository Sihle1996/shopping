package com.example.backend.service;

import com.example.backend.entity.MenuItem;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.CartItemRepository;
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
    private final SubscriptionEnforcementService subscriptionEnforcementService;

    public MenuItem saveMenuItem(MenuItem menuItem) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId != null) {
            subscriptionEnforcementService.assertMenuItemLimit(tenantId);
        }
        setTenantOnEntity(menuItem);
        return menuItemRepository.save(menuItem);
    }

    public MenuItem updateMenuItem(UUID id, MenuItem updatedMenuItem) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        MenuItem menuItem = (tenantId != null)
                ? menuItemRepository.findByIdAndTenant_Id(id, tenantId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Menu item not found"))
                : menuItemRepository.findById(id)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Menu item not found"));

        if (updatedMenuItem.getName() != null) menuItem.setName(updatedMenuItem.getName());
        if (updatedMenuItem.getCategory() != null) menuItem.setCategory(updatedMenuItem.getCategory());
        menuItem.setDescription(updatedMenuItem.getDescription());
        menuItem.setPrice(updatedMenuItem.getPrice());
        if (updatedMenuItem.getIsAvailable() != null) menuItem.setIsAvailable(updatedMenuItem.getIsAvailable());
        menuItem.setImage(updatedMenuItem.getImage());
        menuItem.setStock(updatedMenuItem.getStock());
        menuItem.setReservedStock(updatedMenuItem.getReservedStock());
        menuItem.setLowStockThreshold(updatedMenuItem.getLowStockThreshold());

        return menuItemRepository.save(menuItem);
    }

    @Transactional
    public void deleteMenuItem(UUID id) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        MenuItem menuItem = (tenantId != null)
                ? menuItemRepository.findByIdAndTenant_Id(id, tenantId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Menu item not found"))
                : menuItemRepository.findById(id)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Menu item not found"));
        cartItemRepository.deleteByMenuItem(menuItem);
        menuItemRepository.delete(menuItem);
    }

    public MenuItem getMenuItemById(UUID id) {
        return menuItemRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Menu item not found"));
    }

    public List<MenuItem> getAllMenuItems() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId != null) {
            return menuItemRepository.findByTenant_Id(tenantId);
        }
        return menuItemRepository.findAll();
    }

    public List<MenuItem> saveAllMenuItems(List<MenuItem> menuItems) {
        menuItems.forEach(this::setTenantOnEntity);
        return menuItemRepository.saveAll(menuItems);
    }

    private void setTenantOnEntity(MenuItem item) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId != null && item.getTenant() == null) {
            Tenant tenant = tenantRepository.findById(tenantId)
                    .orElseThrow(() -> new RuntimeException("Tenant not found"));
            item.setTenant(tenant);
        }
    }
}
