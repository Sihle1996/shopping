package com.example.backend.controller;

import com.example.backend.entity.MenuItem;
import com.example.backend.service.MenuService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;


@RequiredArgsConstructor
@RestController
@RequestMapping("/api/menu")
public class MenuItemController {

    private final MenuService menuService;

    @GetMapping
    public ResponseEntity<List<MenuItem>> getMenuItems() {
        List<MenuItem> menuItems = menuService.getAllMenuItems();
        return ResponseEntity.ok(menuItems);
    }

    @GetMapping("/{id}")
    public ResponseEntity<MenuItem> getMenuItemById(@PathVariable Long id) {
        MenuItem menuItem = menuService.getMenuItemById(id);
        return ResponseEntity.ok(menuItem);
    }

}
