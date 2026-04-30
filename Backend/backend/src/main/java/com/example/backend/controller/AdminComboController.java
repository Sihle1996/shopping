package com.example.backend.controller;

import com.example.backend.entity.Combo;
import com.example.backend.entity.ComboItem;
import com.example.backend.entity.MenuItem;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.ComboRepository;
import com.example.backend.repository.MenuItemRepository;
import com.example.backend.repository.TenantRepository;
import com.example.backend.service.ComboGeneratorService;
import com.example.backend.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/combos")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminComboController {

    private final ComboRepository comboRepository;
    private final MenuItemRepository menuItemRepository;
    private final TenantRepository tenantRepository;
    private final ComboGeneratorService comboGeneratorService;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> listCombos() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tenant context");
        List<Combo> combos = comboRepository.findByTenant_Id(tenantId);
        return ResponseEntity.ok(combos.stream().map(this::toDto).collect(Collectors.toList()));
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createCombo(@RequestBody Map<String, Object> body) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tenant context");

        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant not found"));

        String name = (String) body.get("name");
        if (name == null || name.isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "name is required");

        BigDecimal comboPrice    = new BigDecimal(body.get("comboPrice").toString());
        BigDecimal originalPrice = new BigDecimal(body.get("originalPrice").toString());

        Combo combo = Combo.builder()
                .tenant(tenant)
                .name(name)
                .description((String) body.get("description"))
                .comboPrice(comboPrice)
                .originalPrice(originalPrice)
                .source("VENDOR")
                .active(true)
                .imageUrl((String) body.get("imageUrl"))
                .build();

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> itemPayloads = (List<Map<String, Object>>) body.getOrDefault("items", Collections.emptyList());
        for (Map<String, Object> ip : itemPayloads) {
            UUID menuItemId = UUID.fromString(ip.get("menuItemId").toString());
            MenuItem menuItem = menuItemRepository.findByIdAndTenant_Id(menuItemId, tenantId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Menu item not found: " + menuItemId));
            ComboItem ci = ComboItem.builder()
                    .combo(combo)
                    .menuItem(menuItem)
                    .role((String) ip.getOrDefault("role", "MAIN"))
                    .quantity(Integer.parseInt(ip.getOrDefault("quantity", 1).toString()))
                    .build();
            combo.getItems().add(ci);
        }

        comboRepository.save(combo);
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(combo));
    }

    @PatchMapping("/{id}/toggle")
    public ResponseEntity<Map<String, Object>> toggleActive(@PathVariable UUID id) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        Combo combo = comboRepository.findByIdAndTenant_Id(id, tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Combo not found"));
        combo.setActive(!combo.isActive());
        comboRepository.save(combo);
        return ResponseEntity.ok(toDto(combo));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCombo(@PathVariable UUID id) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        Combo combo = comboRepository.findByIdAndTenant_Id(id, tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Combo not found"));
        comboRepository.delete(combo);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/regenerate")
    public ResponseEntity<Map<String, Object>> regenerate() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tenant context");
        int count = comboGeneratorService.generateForTenant(tenantId);
        return ResponseEntity.ok(Map.of("generated", count));
    }

    private Map<String, Object> toDto(Combo combo) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id",            combo.getId());
        dto.put("name",          combo.getName());
        dto.put("description",   combo.getDescription());
        dto.put("source",        combo.getSource());
        dto.put("active",        combo.isActive());
        dto.put("comboPrice",    combo.getComboPrice());
        dto.put("originalPrice", combo.getOriginalPrice());
        dto.put("imageUrl",      combo.getImageUrl());
        dto.put("items", combo.getItems().stream().map(ci -> Map.of(
                "menuItemId", ci.getMenuItem().getId(),
                "name",       ci.getMenuItem().getName(),
                "role",       ci.getRole(),
                "quantity",   ci.getQuantity()
        )).collect(Collectors.toList()));
        return dto;
    }
}
