package com.example.backend.service;

import com.example.backend.entity.Tenant;
import com.example.backend.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Proactively computes Smart Alerts in the BACKGROUND, so time-critical ones (a scheduled
 * order due soon, an order awaiting acceptance) reach the admin even when nobody has the bell
 * open. Until now alerts were only computed on bell-load (pull); this turns it into push: on
 * any newly-raised alert it nudges the tenant's admin WebSocket channel to refresh.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AlertScanScheduler {

    private final TenantRepository tenantRepository;
    private final SmartAlertService smartAlertService;
    private final SimpMessagingTemplate messagingTemplate;

    @Scheduled(fixedDelay = 120_000) // every 2 minutes
    public void scanAllTenants() {
        for (Tenant tenant : tenantRepository.findAll()) {
            try {
                int created = smartAlertService.scan(tenant.getId());
                if (created > 0) {
                    messagingTemplate.convertAndSend(
                            "/topic/admin/" + tenant.getId() + "/alerts",
                            Map.of("type", "ALERTS_UPDATED", "newCount", created));
                }
            } catch (Exception e) {
                log.warn("Background alert scan failed for tenant {}: {}", tenant.getId(), e.getMessage());
            }
        }
    }
}
