package com.example.backend.controller;

import com.example.backend.entity.InventoryAdjustmentDTO;
import com.example.backend.entity.InventoryLogDTO;
import com.example.backend.entity.MenuItem;
import com.example.backend.service.InventoryService;
import com.example.backend.service.SubscriptionEnforcementService;
import com.example.backend.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;
    private final SubscriptionEnforcementService subscriptionEnforcementService;

    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    @PostMapping("/adjust")
    public List<MenuItem> adjustInventory(@RequestBody List<InventoryAdjustmentDTO> adjustments) {
        return inventoryService.adjustInventory(adjustments);
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    @GetMapping("/export")
    public ResponseEntity<ByteArrayResource> exportInventory() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId != null) {
            subscriptionEnforcementService.assertInventoryExportAccess(tenantId);
        }
        return inventoryService.exportInventoryCsv();
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    @GetMapping("/audit")
    public List<InventoryLogDTO> getAuditLogs() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId != null) {
            subscriptionEnforcementService.assertInventoryExportAccess(tenantId);
        }
        return inventoryService.getAuditLogs();
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    @PostMapping("/sync-availability")
    public int syncAvailability() {
        return inventoryService.syncAvailability();
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    @PatchMapping("/{id}/availability")
    public ResponseEntity<MenuItem> setAvailability(@PathVariable UUID id,
                                                     @RequestBody java.util.Map<String, Boolean> body) {
        return ResponseEntity.ok(inventoryService.setAvailability(id, body.get("isAvailable")));
    }
}
