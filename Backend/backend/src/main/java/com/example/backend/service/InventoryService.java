package com.example.backend.service;

import com.example.backend.entity.InventoryAdjustmentDTO;
import com.example.backend.entity.InventoryLog;
import com.example.backend.entity.InventoryLogDTO;
import com.example.backend.entity.MenuItem;
import com.example.backend.entity.Order;
import com.example.backend.entity.OrderItem;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.InventoryLogRepository;
import com.example.backend.repository.MenuItemRepository;
import com.example.backend.repository.OrderRepository;
import com.example.backend.repository.TenantRepository;
import com.example.backend.tenant.TenantContext;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

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
    private final OrderRepository orderRepository;
    private final EmailService emailService;

    @Transactional
    public List<MenuItem> adjustInventory(List<InventoryAdjustmentDTO> adjustments) {
        // Tenant-scope every lookup so one store's admin can never adjust another
        // store's stock by passing a foreign menu-item id (IDOR guard).
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tenant context for inventory adjustment");
        }
        List<MenuItem> updated = new ArrayList<>();
        for (InventoryAdjustmentDTO adj : adjustments) {
            MenuItem item = menuItemRepository.findByIdAndTenant_Id(adj.getMenuItemId(), tenantId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                            "Menu item not found: " + adj.getMenuItemId()));
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
            MenuItem saved = menuItemRepository.save(item);
            updated.add(saved);

            // Low stock alert: notify admin by email when stock drops to/below threshold
            if (adj.getStockChange() < 0 && saved.getStock() >= 0
                    && saved.getStock() <= saved.getLowStockThreshold()) {
                tenantRepository.findById(tenantId).ifPresent(tenant -> {
                    if (tenant.getEmail() != null && !tenant.getEmail().isBlank()) {
                        emailService.sendRaw(tenant.getEmail(),
                            "Low Stock Alert — " + saved.getName(),
                            "<p>Stock for <strong>" + saved.getName() + "</strong> has dropped to <strong>"
                            + saved.getStock() + "</strong> units (threshold: " + saved.getLowStockThreshold() + ").</p>"
                            + "<p>Please restock soon to avoid running out.</p>");
                    }
                });
            }

            InventoryLog log = new InventoryLog();
            log.setMenuItem(item);
            log.setMenuItemNameSnapshot(item.getName());
            log.setStockChange(adj.getStockChange());
            log.setReservedChange(adj.getReservedChange());
            log.setType("ADJUSTMENT");
            tenantRepository.findById(tenantId).ifPresent(log::setTenant);

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
        return logs.stream().map(log -> {
            UUID itemId = log.getMenuItem() != null ? log.getMenuItem().getId() : null;
            String itemName = log.getMenuItem() != null
                    ? log.getMenuItem().getName()
                    : (log.getMenuItemNameSnapshot() != null ? log.getMenuItemNameSnapshot() : "(deleted)");
            return new InventoryLogDTO(
                    log.getId(),
                    itemId,
                    itemName,
                    log.getStockChange(),
                    log.getReservedChange(),
                    log.getType(),
                    log.getTimestamp()
            );
        }).collect(Collectors.toList());
    }

    @Transactional
    public int syncAvailability() {
        List<MenuItem> items = getTenantMenuItems();
        int count = 0;
        for (MenuItem item : items) {
            boolean shouldBeAvailable = item.getStock() > 0;
            if (item.getIsAvailable() != shouldBeAvailable) {
                item.setIsAvailable(shouldBeAvailable);
                menuItemRepository.save(item);
                count++;
            }
        }
        return count;
    }

    /** SAFE background availability sync: only HIDE items that have genuinely run out (stock == 0). Never
     *  auto-enables — that would override an admin who manually marked an in-stock item unavailable. Used by
     *  the intraday maintenance scheduler so sold-out items disappear without the admin clicking anything. */
    @Transactional
    public int autoHideSoldOut(UUID tenantId) {
        int count = 0;
        for (MenuItem item : menuItemRepository.findByTenant_Id(tenantId)) {
            if (item.getStock() == 0 && Boolean.TRUE.equals(item.getIsAvailable())) {
                item.setIsAvailable(false);
                menuItemRepository.save(item);
                count++;
            }
        }
        return count;
    }

    /**
     * Recompute each item's reservedStock from the orders genuinely held right now
     * (Pending + Scheduled). Clears orphaned reservations left by orders that were
     * abandoned without being confirmed, cancelled, or auto-rejected — which would
     * otherwise make sellable items look sold out forever.
     */
    @Transactional
    public int reconcileReservations() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        return tenantId == null ? 0 : reconcileForTenant(tenantId);
    }

    /** Reconcile a single tenant's reservedStock — used by the admin action and the nightly job. */
    @Transactional
    public int reconcileForTenant(UUID tenantId) {
        List<MenuItem> items = menuItemRepository.findByTenant_Id(tenantId);
        java.util.Map<UUID, Integer> correct = new java.util.HashMap<>();
        for (MenuItem mi : items) correct.put(mi.getId(), 0);

        List<Order> held = new ArrayList<>();
        held.addAll(orderRepository.findByStatusAndTenant_IdOrderByOrderDateDesc("Pending", tenantId));
        held.addAll(orderRepository.findByStatusAndTenant_IdOrderByOrderDateDesc("Scheduled", tenantId));
        for (Order o : held) {
            for (OrderItem oi : o.getOrderItems()) {
                MenuItem mi = oi.getMenuItem();
                if (mi != null && correct.containsKey(mi.getId())) {
                    correct.merge(mi.getId(), oi.getQuantity(), Integer::sum);
                }
            }
        }

        int changed = 0;
        for (MenuItem mi : items) {
            int want = correct.getOrDefault(mi.getId(), 0);
            if (mi.getReservedStock() != want) {
                mi.setReservedStock(want);
                menuItemRepository.save(mi);
                changed++;
            }
        }
        return changed;
    }

    @Transactional
    public MenuItem setAvailability(UUID id, Boolean available) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        MenuItem item = (tenantId != null
                ? menuItemRepository.findByIdAndTenant_Id(id, tenantId)
                : menuItemRepository.findById(id))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found"));
        item.setIsAvailable(available != null ? available : item.getIsAvailable());
        return menuItemRepository.save(item);
    }

    private List<MenuItem> getTenantMenuItems() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId != null) {
            return menuItemRepository.findByTenant_Id(tenantId);
        }
        return menuItemRepository.findAll();
    }
}
