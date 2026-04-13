package com.example.backend.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import com.example.backend.entity.MenuItem;
import com.example.backend.service.CloudinaryService;
import com.example.backend.service.MenuService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/menu")
@RequiredArgsConstructor
@Slf4j
public class AdminMenuController {

    private final MenuService menuService;
    private final CloudinaryService cloudinaryService;

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public MenuItem createMenuItem(@RequestBody MenuItem menuItem) {
        return menuService.saveMenuItem(menuItem);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public MenuItem updateMenuItem(@PathVariable UUID id, @RequestBody MenuItem menuItem) {
        return menuService.updateMenuItem(id, menuItem);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public void deleteMenuItem(@PathVariable UUID id) {
        menuService.deleteMenuItem(id);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping
    public ResponseEntity<?> getAllMenuItems() {
        try {
            List<MenuItem> items = menuService.getAllMenuItems();
            return ResponseEntity.ok(items);
        } catch (Exception e) {
            log.error("Error fetching menu items", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error fetching menu items: " + e.getMessage());
        }
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/bulk")
    public List<MenuItem> createBulkMenuItems(@RequestBody List<MenuItem> menuItems) {
        return menuService.saveAllMenuItems(menuItems);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/bulk-price")
    public ResponseEntity<?> bulkUpdatePrices(@RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        List<String> rawIds = (List<String>) body.get("ids");
        String type = (String) body.getOrDefault("type", "PERCENT");
        double value = ((Number) body.get("value")).doubleValue();
        List<UUID> ids = rawIds.stream().map(UUID::fromString).collect(Collectors.toList());
        int updated = menuService.bulkAdjustPrices(ids, type, value);
        return ResponseEntity.ok(Map.of("updated", updated));
    }

    /**
     * CSV import — expected header row: name,price,category,description,stock
     * Returns { created, skipped, errors }
     */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/import-csv")
    public ResponseEntity<?> importCsv(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) return ResponseEntity.badRequest().body("CSV file is empty.");
        int created = 0, skipped = 0;
        List<String> errors = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            int row = 0;
            while ((line = reader.readLine()) != null) {
                row++;
                if (row == 1) continue; // skip header
                if (line.isBlank()) continue;
                String[] cols = line.split(",", -1);
                if (cols.length < 3) { errors.add("Row " + row + ": need at least name,price,category"); skipped++; continue; }
                try {
                    MenuItem item = new MenuItem();
                    item.setName(cols[0].trim());
                    item.setPrice(Double.parseDouble(cols[1].trim()));
                    item.setCategory(cols[2].trim());
                    if (cols.length > 3) item.setDescription(cols[3].trim());
                    if (cols.length > 4 && !cols[4].isBlank()) item.setStock(Integer.parseInt(cols[4].trim()));
                    item.setIsAvailable(true);
                    menuService.saveMenuItem(item);
                    created++;
                } catch (Exception e) {
                    errors.add("Row " + row + ": " + e.getMessage());
                    skipped++;
                }
            }
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Failed to read file: " + e.getMessage());
        }
        Map<String, Object> result = new HashMap<>();
        result.put("created", created);
        result.put("skipped", skipped);
        result.put("errors", errors);
        return ResponseEntity.ok(result);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/upload-image")
    public ResponseEntity<?> uploadImage(@RequestParam("file") MultipartFile file) {
        try {
            String imageUrl = cloudinaryService.upload(file);
            return ResponseEntity.ok().body(java.util.Collections.singletonMap("imageUrl", imageUrl));
        } catch (IOException e) {
            log.error("Image upload failed for file {}", file.getOriginalFilename(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Image upload failed: " + e.getMessage());
        }
    }
}
