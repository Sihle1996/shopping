package com.example.backend.service;

import com.example.backend.entity.Tenant;
import com.example.backend.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Intraday inventory maintenance — runs in the background the work the admin used to trigger by hand
 * ("Sync availability" + "Fix reservations"). Every 15 minutes, for each store it reconciles reserved stock
 * (clearing orphaned reservations from abandoned orders, which otherwise make sellable items look sold-out)
 * and hides items that have genuinely run out. The nightly {@link ReservationReconcileScheduler} remains as
 * the deep safety net at 03:30; the manual buttons remain for an on-demand "do it now".
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class InventoryMaintenanceScheduler {

    private final TenantRepository tenantRepository;
    private final InventoryService inventoryService;

    @Scheduled(fixedDelay = 900_000) // every 15 minutes
    public void maintain() {
        int reserved = 0, hidden = 0;
        for (Tenant t : tenantRepository.findAll()) {
            try {
                reserved += inventoryService.reconcileForTenant(t.getId());
                hidden += inventoryService.autoHideSoldOut(t.getId());
            } catch (Exception e) {
                log.warn("Inventory maintenance failed for tenant {}: {}", t.getId(), e.getMessage());
            }
        }
        if (reserved > 0 || hidden > 0) {
            log.info("Inventory maintenance: reconciled {} reservation(s), hid {} sold-out item(s)", reserved, hidden);
        }
    }
}
