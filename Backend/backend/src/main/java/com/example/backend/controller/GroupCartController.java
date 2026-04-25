package com.example.backend.controller;

import com.example.backend.entity.GroupCart;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.TenantRepository;
import com.example.backend.service.GroupCartService;
import com.example.backend.tenant.TenantContext;
import com.example.backend.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/group-cart")
@RequiredArgsConstructor
public class GroupCartController {

    private final GroupCartService groupCartService;
    private final TenantRepository tenantRepository;

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> create(@AuthenticationPrincipal User user) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.badRequest().body("Tenant context required");
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Tenant not found"));
        GroupCart gc = groupCartService.create(user, tenant);
        return ResponseEntity.ok(Map.of("token", gc.getToken(), "id", gc.getId().toString()));
    }

    @GetMapping("/{token}")
    public ResponseEntity<?> get(@PathVariable String token) {
        return ResponseEntity.ok(groupCartService.summarize(token));
    }

    @PostMapping("/{token}/items")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> addItem(
            @PathVariable String token,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User user) {
        UUID menuItemId = UUID.fromString((String) body.get("menuItemId"));
        int quantity = body.containsKey("quantity") ? ((Number) body.get("quantity")).intValue() : 1;
        String choices = (String) body.getOrDefault("selectedChoicesJson", null);
        String notes = (String) body.getOrDefault("itemNotes", null);
        return ResponseEntity.ok(groupCartService.addItem(token, user, menuItemId, quantity, choices, notes));
    }

    @DeleteMapping("/{token}/items/{itemId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> removeItem(
            @PathVariable String token,
            @PathVariable UUID itemId,
            @AuthenticationPrincipal User user) {
        groupCartService.removeItem(token, itemId, user);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{token}/close")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> close(
            @PathVariable String token,
            @AuthenticationPrincipal User user) {
        groupCartService.close(token, user);
        return ResponseEntity.ok(Map.of("status", "CHECKED_OUT"));
    }
}
