package com.example.backend.service;

import com.example.backend.entity.InventoryAdjustmentDTO;
import com.example.backend.entity.InventoryLog;
import com.example.backend.entity.InventoryLogDTO;
import com.example.backend.entity.MenuItem;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.InventoryLogRepository;
import com.example.backend.repository.MenuItemRepository;
import com.example.backend.repository.TenantRepository;
import com.example.backend.tenant.TenantContext;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RequiredArgsConstructor
@Service
public class InventoryService {
    private final MenuItemRepository menuItemRepository;
    private final InventoryLogRepository inventoryLogRepository;
    private final TenantRepository tenantRepository;

    @Transactional
    public List<MenuItem> adjustInventory(List<InventoryAdjustmentDTO> adjustments) {
        List<MenuItem> updated = new ArrayList<>();
        for (InventoryAdjustmentDTO adj : adjustments) {
            MenuItem item = menuItemRepository.findById(adj.getMenuItemId())
                    .orElseThrow(() -> new RuntimeException("Menu item not found: " + adj.getMenuItemId()));
            item.setStock(item.getStock() + adj.getStockChange());
            item.setReservedStock(item.getReservedStock() + adj.getReservedChange());
            if (adj.getLowStockThreshold() != null) {
                item.setLowStockThreshold(adj.getLowStockThreshold());
            }
            // Auto-mark unavailable when stock hits zero and was being tracked
            if (item.getStock() == 0 && adj.getStockChange() < 0) {
                item.setIsAvailable(false);
            } else if (item.getStock() > 0) {
                item.setIsAvailable(true);
            }
            updated.add(menuItemRepository.save(item));

            InventoryLog log = new InventoryLog();
            log.setMenuItem(item);
            log.setStockChange(adj.getStockChange());
            log.setReservedChange(adj.getReservedChange());
            log.setType("ADJUSTMENT");

            UUID tenantId = TenantContext.getCurrentTenantId();
            if (tenantId != null) {
                tenantRepository.findById(tenantId).ifPresent(log::setTenant);
            }

            inventoryLogRepository.save(log);
        }
        return updated;
    }

    public ResponseEntity<ByteArrayResource> exportInventoryCsv() {
        List<MenuItem> items = getTenantMenuItems();
        StringBuilder sb = new StringBuilder("id,name,stock,reservedStock,lowStockThreshold\n");
        for (MenuItem item : items) {
            sb.append(item.getId()).append(',')
                    .append(item.getName()).append(',')
                    .append(item.getStock()).append(',')
                    .append(item.getReservedStock()).append(',')
                    .append(item.getLowStockThreshold()).append('\n');
        }
        ByteArrayResource resource = new ByteArrayResource(sb.toString().getBytes(StandardCharsets.UTF_8));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=inventory.csv")
                .contentType(MediaType.TEXT_PLAIN)
                .body(resource);
    }

    public List<InventoryLogDTO> getAuditLogs() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        List<InventoryLog> logs;
        if (tenantId != null) {
            logs = inventoryLogRepository.findByTenant_Id(tenantId);
        } else {
            logs = inventoryLogRepository.findAll();
        }
        return logs.stream().map(log ->
                new InventoryLogDTO(
                        log.getId(),
                        log.getMenuItem().getId(),
                        log.getMenuItem().getName(),
                        log.getStockChange(),
                        log.getReservedChange(),
                        log.getType(),
                        log.getTimestamp()
                )
        ).collect(Collectors.toList());
    }

    private List<MenuItem> getTenantMenuItems() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId != null) {
            return menuItemRepository.findByTenant_Id(tenantId);
        }
        return menuItemRepository.findAll();
    }
}
