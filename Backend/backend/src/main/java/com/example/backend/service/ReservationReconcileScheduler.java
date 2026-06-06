package com.example.backend.service;

import com.example.backend.entity.Tenant;
import com.example.backend.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Nightly safety net: recompute every store's reservedStock from its genuinely
 * held orders, clearing any orphaned reservations that the 5-minute auto-reject
 * couldn't release (e.g. orders abandoned before that timer existed). Runs at
 * 03:30 SAST when traffic is lowest.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ReservationReconcileScheduler {

    private final TenantRepository tenantRepository;
    private final InventoryService inventoryService;

    @Scheduled(cron = "0 30 3 * * *", zone = "Africa/Johannesburg")
    public void nightlyReconcile() {
        int totalChanged = 0;
        for (Tenant t : tenantRepository.findAll()) {
            try {
                totalChanged += inventoryService.reconcileForTenant(t.getId());
            } catch (Exception e) {
                log.warn("Reservation reconcile failed for tenant {}: {}", t.getId(), e.getMessage());
            }
        }
        if (totalChanged > 0) {
            log.info("Nightly reservation reconcile corrected {} item(s) across all stores", totalChanged);
        }
    }
}
