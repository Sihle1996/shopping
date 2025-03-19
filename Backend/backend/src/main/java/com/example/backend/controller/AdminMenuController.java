package com.example.backend.controller;


import com.example.backend.entity.MenuItem;
import com.example.backend.service.MenuService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/menu") // Removed /v1/auth
@RequiredArgsConstructor
public class AdminMenuController {

    private final MenuService menuService;

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public MenuItem createMenuItem(@RequestBody MenuItem menuItem) {
        return menuService.saveMenuItem(menuItem);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public MenuItem updateMenuItem(@PathVariable Long id, @RequestBody MenuItem menuItem) {
        return menuService.updateMenuItem(id, menuItem);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public void deleteMenuItem(@PathVariable Long id) {
        menuService.deleteMenuItem(id);
    }

    @GetMapping
    public List<MenuItem> getAllMenuItems() {
        return menuService.getAllMenuItems();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/bulk")
    public List<MenuItem> createBulkMenuItems(@RequestBody List<MenuItem> menuItems) {
        return menuService.saveAllMenuItems(menuItems);
    }
}