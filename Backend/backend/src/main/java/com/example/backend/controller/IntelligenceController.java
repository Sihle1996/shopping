package com.example.backend.controller;

import com.example.backend.entity.Combo;
import com.example.backend.entity.ComboItem;
import com.example.backend.repository.ComboRepository;
import com.example.backend.service.IntentProfileService;
import com.example.backend.service.OrderAssistantService;
import com.example.backend.tenant.TenantContext;
import com.example.backend.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/intelligence")
@RequiredArgsConstructor
public class IntelligenceController {

    private final IntentProfileService intentProfileService;
    private final OrderAssistantService orderAssistantService;
    private final ComboRepository comboRepository;

    /** GET /api/intelligence/intents — list available mood chips */
    @GetMapping("/intents")
    public ResponseEntity<List<Map<String, String>>> getIntents() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        return ResponseEntity.ok(intentProfileService.listIntents(tenantId));
    }

    /** GET /api/intelligence/by-intent?intent=BROKE&limit=20 */
    @GetMapping("/by-intent")
    public ResponseEntity<Map<String, Object>> getByIntent(
            @RequestParam String intent,
            @RequestParam(defaultValue = "20") int limit) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        return ResponseEntity.ok(intentProfileService.getByIntent(intent, limit, tenantId));
    }

    /** GET /api/intelligence/recommendations?limit=8 — passive top-N without intent filter */
    @GetMapping("/recommendations")
    public ResponseEntity<Map<String, Object>> getRecommendations(
            @RequestParam(defaultValue = "8") int limit) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        return ResponseEntity.ok(intentProfileService.getRecommendations(limit, tenantId));
    }

    /** GET /api/intelligence/combos?itemId=... */
    @GetMapping("/combos")
    public ResponseEntity<List<Map<String, Object>>> getCombos(
            @RequestParam(required = false) UUID itemId) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.ok(Collections.emptyList());

        List<Combo> combos = itemId != null
                ? comboRepository.findActiveByMenuItemAndTenant(itemId, tenantId)
                : comboRepository.findByTenant_IdAndActiveTrue(tenantId);

        return ResponseEntity.ok(combos.stream().map(this::toComboDto).collect(Collectors.toList()));
    }

    /** POST /api/intelligence/order-for-me */
    @PostMapping("/order-for-me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> orderForMe(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User principal) {
        String prompt = (String) body.getOrDefault("prompt", "");
        Double lat = body.get("lat") != null ? Double.parseDouble(body.get("lat").toString()) : null;
        Double lon = body.get("lon") != null ? Double.parseDouble(body.get("lon").toString()) : null;
        UUID tenantId = TenantContext.getCurrentTenantId();
        return ResponseEntity.ok(orderAssistantService.interpret(prompt, tenantId, principal.getId(), lat, lon));
    }

    /** POST /api/intelligence/order-for-me/confirm */
    @PostMapping("/order-for-me/confirm")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<com.example.backend.entity.CartItemDTO>> confirmOrderForMe(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User principal) {
        String token = (String) body.get("suggestionToken");
        return ResponseEntity.ok(orderAssistantService.confirm(token, principal.getId()));
    }

    private Map<String, Object> toComboDto(Combo combo) {
        BigDecimal savings = combo.getOriginalPrice().subtract(combo.getComboPrice());
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id",            combo.getId());
        dto.put("name",          combo.getName());
        dto.put("description",   combo.getDescription());
        dto.put("source",        combo.getSource());
        dto.put("comboPrice",    combo.getComboPrice());
        dto.put("originalPrice", combo.getOriginalPrice());
        dto.put("savings",       savings);
        dto.put("imageUrl",      combo.getImageUrl());
        dto.put("items", combo.getItems().stream().map(ci -> Map.of(
                "menuItemId", ci.getMenuItem().getId(),
                "role",       ci.getRole(),
                "name",       ci.getMenuItem().getName(),
                "price",      ci.getMenuItem().getPrice(),
                "image",      ci.getMenuItem().getImage() != null ? ci.getMenuItem().getImage() : "",
                "quantity",   ci.getQuantity()
        )).collect(Collectors.toList()));
        return dto;
    }
}
