package com.example.backend.controller;

import com.example.backend.entity.MenuItem;
import com.example.backend.entity.MenuItemOptionGroup;
import com.example.backend.repository.MenuItemOptionGroupRepository;
import com.example.backend.service.MenuService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;


@RequiredArgsConstructor
@RestController
@RequestMapping("/api/menu")
public class MenuItemController {

    private final MenuService menuService;
    private final MenuItemOptionGroupRepository optionGroupRepository;

    @GetMapping
    public ResponseEntity<List<MenuItem>> getMenuItems() {
        List<MenuItem> menuItems = menuService.getAllMenuItems();
        return ResponseEntity.ok(menuItems);
    }

    @GetMapping("/{id}")
    public ResponseEntity<MenuItem> getMenuItemById(@PathVariable UUID id) {
        MenuItem menuItem = menuService.getMenuItemById(id);
        return ResponseEntity.ok(menuItem);
    }

    @GetMapping("/{id}/option-groups")
    public ResponseEntity<List<MenuItemOptionGroup>> getOptionGroups(@PathVariable UUID id) {
        return ResponseEntity.ok(optionGroupRepository.findByMenuItem_IdOrderBySortOrderAsc(id));
    }

}
