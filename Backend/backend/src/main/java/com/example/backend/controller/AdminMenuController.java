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

    /** Max data rows accepted per CSV import (guards against memory/DoS on huge uploads). */
    private static final int MAX_IMPORT_ROWS = 1000;

    /**
     * Prefix a single quote to any cell that opens with a formula trigger (= + - @) or a
     * leading control char (tab/CR/LF) so a later CSV export can't be weaponised in Excel/Sheets.
     */
    private static String sanitizeCell(String value) {
        if (value == null || value.isEmpty()) return value;
        char c = value.charAt(0);
        if (c == '=' || c == '+' || c == '-' || c == '@' || c == '\t' || c == '\r' || c == '\n') {
            return "'" + value;
        }
        return value;
    }

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
        Object rawIdsObj = body.get("ids");
        Object valueObj = body.get("value");
        if (!(rawIdsObj instanceof List<?> rawIds) || rawIds.isEmpty())
            return ResponseEntity.badRequest().body(Map.of("error", "ids must be a non-empty list."));
        if (!(valueObj instanceof Number valueNum))
            return ResponseEntity.badRequest().body(Map.of("error", "value is required and must be a number."));
        String type = (String) body.getOrDefault("type", "PERCENT");
        List<UUID> ids;
        try {
            ids = rawIds.stream().map(x -> UUID.fromString(x.toString())).collect(Collectors.toList());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "ids must be valid UUIDs."));
        }
        int updated = menuService.bulkAdjustPrices(ids, type, valueNum.doubleValue());
        return ResponseEntity.ok(Map.of("updated", updated));
    }

    /**
     * CSV import — header row: name,price,category,description,stock,cost
     * (description, stock and cost are optional). Existing items are matched by
     * name and updated in place, so you can re-import to fill in cost without
     * losing images or stock. Returns { created, updated, skipped, errors }.
     */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/import-csv")
    public ResponseEntity<?> importCsv(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) return ResponseEntity.badRequest().body("CSV file is empty.");
        int created = 0, updated = 0, skipped = 0;
        List<String> errors = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            int row = 0;
            int dataRows = 0;
            while ((line = reader.readLine()) != null) {
                row++;
                if (row == 1) continue; // skip header
                if (line.isBlank()) continue;
                if (++dataRows > MAX_IMPORT_ROWS) {
                    return ResponseEntity.badRequest()
                            .body("Too many rows: max " + MAX_IMPORT_ROWS + " data rows allowed per import.");
                }
                String[] cols = line.split(",", -1);
                if (cols.length < 3) { errors.add("Row " + row + ": need at least name,price,category"); skipped++; continue; }
                try {
                    // Neutralise CSV/formula injection on free-text fields that get re-exported:
                    // a leading = + - @ (or tab/CR) is prefixed with a single quote so Excel/Sheets
                    // treats the cell as text, not a formula.
                    String name = sanitizeCell(cols[0].trim());
                    Double price = Double.parseDouble(cols[1].trim());
                    String category = sanitizeCell(cols[2].trim());
                    String description = cols.length > 3 ? sanitizeCell(cols[3].trim()) : null;
                    Integer stock = (cols.length > 4 && !cols[4].isBlank()) ? Integer.parseInt(cols[4].trim()) : null;
                    Double cost = (cols.length > 5 && !cols[5].isBlank()) ? Double.parseDouble(cols[5].trim()) : null;
                    boolean isNew = menuService.importMenuItem(name, price, category, description, stock, cost);
                    if (isNew) created++; else updated++;
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
        result.put("updated", updated);
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
