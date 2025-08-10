package com.example.backend.service;

import com.example.backend.entity.InventoryAdjustmentDTO;
import com.example.backend.entity.InventoryLog;
import com.example.backend.entity.InventoryLogDTO;
import com.example.backend.entity.MenuItem;
import com.example.backend.repository.InventoryLogRepository;
import com.example.backend.repository.MenuItemRepository;
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
import java.util.stream.Collectors;

@RequiredArgsConstructor
@Service
public class InventoryService {
    private final MenuItemRepository menuItemRepository;
    private final InventoryLogRepository inventoryLogRepository;

    @Transactional
    public List<MenuItem> adjustInventory(List<InventoryAdjustmentDTO> adjustments) {
        List<MenuItem> updated = new ArrayList<>();
        for (InventoryAdjustmentDTO adj : adjustments) {
            MenuItem item = menuItemRepository.findById(adj.getMenuItemId())
                    .orElseThrow(() -> new RuntimeException("Menu item not found: " + adj.getMenuItemId()));
            item.setStock(item.getStock() + adj.getStockChange());
            item.setReservedStock(item.getReservedStock() + adj.getReservedChange());
            updated.add(menuItemRepository.save(item));

            InventoryLog log = new InventoryLog();
            log.setMenuItem(item);
            log.setStockChange(adj.getStockChange());
            log.setReservedChange(adj.getReservedChange());
            log.setType("ADJUSTMENT");
            inventoryLogRepository.save(log);
        }
        return updated;
    }

    public ResponseEntity<ByteArrayResource> exportInventoryCsv() {
        List<MenuItem> items = menuItemRepository.findAll();
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
        return inventoryLogRepository.findAll().stream().map(log ->
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
}
