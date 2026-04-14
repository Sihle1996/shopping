package com.example.backend.service;

import com.example.backend.entity.StoreHours;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.StoreHoursRepository;
import com.example.backend.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

/**
 * Every minute: opens or closes each store automatically based on its weekly schedule.
 * Uses Africa/Johannesburg timezone. Manual isOpen overrides are respected until the
 * next scheduled tick.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class StoreHoursScheduler {

    private static final ZoneId ZONE = ZoneId.of("Africa/Johannesburg");

    private final StoreHoursRepository storeHoursRepository;
    private final TenantRepository tenantRepository;

    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void syncStoreOpenStatus() {
        ZonedDateTime now = ZonedDateTime.now(ZONE);
        int today = now.getDayOfWeek().getValue(); // 1=Mon … 7=Sun
        LocalTime currentTime = now.toLocalTime();

        List<Tenant> tenants = tenantRepository.findAll();
        for (Tenant tenant : tenants) {
            storeHoursRepository
                    .findByTenant_IdAndDayOfWeek(tenant.getId(), today)
                    .ifPresent(schedule -> applySchedule(tenant, schedule, currentTime));
        }
    }

    private void applySchedule(Tenant tenant, StoreHours schedule, LocalTime now) {
        boolean shouldBeOpen;
        if (schedule.isClosed()) {
            shouldBeOpen = false;
        } else {
            LocalTime open  = LocalTime.parse(schedule.getOpenTime());
            LocalTime close = LocalTime.parse(schedule.getCloseTime());
            shouldBeOpen = !now.isBefore(open) && now.isBefore(close);
        }

        if (!Boolean.valueOf(shouldBeOpen).equals(tenant.getIsOpen())) {
            tenant.setIsOpen(shouldBeOpen);
            tenantRepository.save(tenant);
            log.info("StoreHoursScheduler: tenant {} is now {}", tenant.getSlug(), shouldBeOpen ? "OPEN" : "CLOSED");
        }
    }
}
