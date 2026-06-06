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
        int yesterday = today == 1 ? 7 : today - 1;
        LocalTime currentTime = now.toLocalTime();

        List<Tenant> tenants = tenantRepository.findAll();
        for (Tenant tenant : tenants) {
            StoreHours todaySchedule = storeHoursRepository
                    .findByTenant_IdAndDayOfWeek(tenant.getId(), today).orElse(null);
            StoreHours yesterdaySchedule = storeHoursRepository
                    .findByTenant_IdAndDayOfWeek(tenant.getId(), yesterday).orElse(null);
            if (todaySchedule == null && yesterdaySchedule == null) continue;
            applySchedule(tenant, todaySchedule, yesterdaySchedule, currentTime);
        }
    }

    private void applySchedule(Tenant tenant, StoreHours today, StoreHours yesterday, LocalTime now) {
        boolean shouldBeOpen = false;

        // Today's window — handles overnight ranges (close earlier than open = spills past midnight).
        if (today != null && !today.isClosed()) {
            LocalTime open  = LocalTime.parse(today.getOpenTime());
            LocalTime close = LocalTime.parse(today.getCloseTime());
            if (close.isAfter(open)) {
                shouldBeOpen = !now.isBefore(open) && now.isBefore(close);   // same day
            } else {
                shouldBeOpen = !now.isBefore(open);                          // overnight: open → midnight
            }
        }

        // Yesterday's overnight window spilling into the early hours of today.
        if (!shouldBeOpen && yesterday != null && !yesterday.isClosed()) {
            LocalTime open  = LocalTime.parse(yesterday.getOpenTime());
            LocalTime close = LocalTime.parse(yesterday.getCloseTime());
            if (!close.isAfter(open) && now.isBefore(close)) {
                shouldBeOpen = true;                                         // midnight → close
            }
        }

        if (!Boolean.valueOf(shouldBeOpen).equals(tenant.getIsOpen())) {
            tenant.setIsOpen(shouldBeOpen);
            tenantRepository.save(tenant);
            log.info("StoreHoursScheduler: tenant {} is now {}", tenant.getSlug(), shouldBeOpen ? "OPEN" : "CLOSED");
        }
    }
}
