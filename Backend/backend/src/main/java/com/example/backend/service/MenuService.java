package com.example.backend.service;



import com.example.backend.entity.MenuItem;
import com.example.backend.repository.MenuItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@RequiredArgsConstructor
@Service
public class MenuService {

    private final MenuItemRepository menuItemRepository;

    public MenuItem saveMenuItem(MenuItem menuItem) {
        return menuItemRepository.save(menuItem);
    }

    public MenuItem updateMenuItem(UUID id, MenuItem updatedMenuItem) {
        MenuItem menuItem = menuItemRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Menu item not found"));

        menuItem.setName(updatedMenuItem.getName());
        menuItem.setDescription(updatedMenuItem.getDescription());
        menuItem.setPrice(updatedMenuItem.getPrice());
        menuItem.setIsAvailable(updatedMenuItem.getIsAvailable());

        // ✅ Update image and category
        menuItem.setImage(updatedMenuItem.getImage());
        menuItem.setCategory(updatedMenuItem.getCategory());
        menuItem.setStock(updatedMenuItem.getStock());
        menuItem.setReservedStock(updatedMenuItem.getReservedStock());
        menuItem.setLowStockThreshold(updatedMenuItem.getLowStockThreshold());

        return menuItemRepository.save(menuItem);
    }


    public void deleteMenuItem(UUID id) {
        if (!menuItemRepository.existsById(id)) {
            throw new RuntimeException("Menu item not found");
        }
        menuItemRepository.deleteById(id);
    }


    public MenuItem getMenuItemById(UUID id) {
        return menuItemRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Menu item not found"));
    }



    public List<MenuItem> getAllMenuItems() {
        return menuItemRepository.findAll();
    }

    public List<MenuItem> saveAllMenuItems(List<MenuItem> menuItems) {
        return menuItemRepository.saveAll(menuItems);
    }
}
