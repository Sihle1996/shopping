package com.example.backend.controller;

import com.example.backend.entity.Tenant;
import com.example.backend.service.SubscriptionEnforcementService;
import com.example.backend.service.TenantService;
import com.example.backend.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/admin/settings")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminSettingsController {

    private final TenantService tenantService;
    private final SubscriptionEnforcementService subscriptionEnforcementService;

    @GetMapping
    public ResponseEntity<Tenant> getSettings() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.badRequest().build();
        return tenantService.getTenantById(tenantId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping
    public ResponseEntity<Tenant> updateSettings(@RequestBody Tenant updates) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.badRequest().build();

        // Gate custom branding fields
        boolean updatingBranding = updates.getLogoUrl() != null || updates.getPrimaryColor() != null;
        if (updatingBranding) {
            subscriptionEnforcementService.assertCustomBrandingAccess(tenantId);
        }

        Tenant updated = tenantService.updateTenant(tenantId, updates);
        return ResponseEntity.ok(updated);
    }
}
