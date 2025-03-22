package com.example.backend.controller;

import com.example.backend.entity.MenuItem;
import com.example.backend.service.MenuService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/menu")
@RequiredArgsConstructor
public class AdminMenuController {

    private final MenuService menuService;

    @PreAuthorize("hasAuthority('ROLE_ADMIN')") // ✅ Fix here
    @PostMapping
    public MenuItem createMenuItem(@RequestBody MenuItem menuItem) {
        return menuService.saveMenuItem(menuItem);
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN')") // ✅ Fix here
    @PutMapping("/{id}")
    public MenuItem updateMenuItem(@PathVariable Long id, @RequestBody MenuItem menuItem) {
        return menuService.updateMenuItem(id, menuItem);
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN')") // ✅ Fix here
    @DeleteMapping("/{id}")
    public void deleteMenuItem(@PathVariable Long id) {
        menuService.deleteMenuItem(id);
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN')") // ✅ Protect GET as well
    @GetMapping
    public List<MenuItem> getAllMenuItems() {
        return menuService.getAllMenuItems();
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN')") // ✅ Fix here
    @PostMapping("/bulk")
    public List<MenuItem> createBulkMenuItems(@RequestBody List<MenuItem> menuItems) {
        return menuService.saveAllMenuItems(menuItems);
    }
}
