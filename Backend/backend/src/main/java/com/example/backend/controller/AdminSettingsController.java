package com.example.backend.controller;

import com.example.backend.entity.Tenant;
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

    @GetMapping
    public ResponseEntity<Tenant> getSettings() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) {
            return ResponseEntity.badRequest().build();
        }
        return tenantService.getTenantById(tenantId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping
    public ResponseEntity<Tenant> updateSettings(@RequestBody Tenant updates) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) {
            return ResponseEntity.badRequest().build();
        }
        Tenant updated = tenantService.updateTenant(tenantId, updates);
        return ResponseEntity.ok(updated);
    }
}
