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
import java.util.UUID;

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
            // Isolate each store: one tenant's bad data (e.g. a malformed "8:00" open time that
            // fails LocalTime.parse) must NEVER abort the loop and leave every other store frozen
            // at its last isOpen value. Skip the offender, keep the rest of the fleet in sync.
            try {
                StoreHours todaySchedule = storeHoursRepository
                        .findByTenant_IdAndDayOfWeek(tenant.getId(), today).orElse(null);
                StoreHours yesterdaySchedule = storeHoursRepository
                        .findByTenant_IdAndDayOfWeek(tenant.getId(), yesterday).orElse(null);
                if (todaySchedule == null && yesterdaySchedule == null) continue;
                applySchedule(tenant, todaySchedule, yesterdaySchedule, currentTime);
            } catch (Exception e) {
                log.warn("StoreHoursScheduler: skipped tenant {} due to bad schedule data ({})",
                        tenant.getSlug(), e.toString());
            }
        }
    }

    private void applySchedule(Tenant tenant, StoreHours today, StoreHours yesterday, LocalTime now) {
        boolean shouldBeOpen = computeShouldBeOpen(today, yesterday, now);

        // No schedule row for TODAY: the only reason to be open is yesterday's overnight spillover.
        // Outside that we genuinely don't know today's intended hours, so we must NOT force the store
        // closed — leave isOpen as the admin/go-live set it. Fail open, never silently close a store
        // because a day's hours happen to be missing. (Force-closing here is what made a store with an
        // incomplete weekly schedule go dark mid-trading despite the owner never closing it.)
        if (today == null && !shouldBeOpen) return;

        if (Boolean.TRUE.equals(tenant.getManualOpenOverride())) {
            // A manual/AI override is active: leave isOpen exactly as the admin set it. Hand control
            // back to the schedule only once the schedule AGREES with the override (the next open or
            // close that matches it), then clear the flag. No in-memory state, so it survives restarts
            // — the admin's "open now" / "closed early" sticks instead of being reverted within 60s.
            if (Boolean.valueOf(shouldBeOpen).equals(tenant.getIsOpen())) {
                tenant.setManualOpenOverride(false);
                tenantRepository.save(tenant);
                log.info("StoreHoursScheduler: tenant {} manual override released (schedule now {})",
                        tenant.getSlug(), shouldBeOpen ? "OPEN" : "CLOSED");
            }
            return;
        }

        // No override: enforce the weekly schedule continuously — auto open/close, restart-safe.
        if (!Boolean.valueOf(shouldBeOpen).equals(tenant.getIsOpen())) {
            tenant.setIsOpen(shouldBeOpen);
            tenantRepository.save(tenant);
            log.info("StoreHoursScheduler: tenant {} auto-{}", tenant.getSlug(), shouldBeOpen ? "OPENED" : "CLOSED");
        }
    }

    /** Pure schedule math — whether the store should be open at {@code now} given today/yesterday. */
    private static boolean computeShouldBeOpen(StoreHours today, StoreHours yesterday, LocalTime now) {
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
        return shouldBeOpen;
    }

    /**
     * Is this store within its scheduled trading hours right now? Used by alerts to avoid
     * nagging "you're closed" off-hours. Returns true when no schedule is configured (can't
     * tell) or on any parsing error, so it never suppresses a genuine alert by mistake.
     */
    @Transactional(readOnly = true)
    public boolean shouldBeOpenNow(UUID tenantId) {
        try {
            ZonedDateTime now = ZonedDateTime.now(ZONE);
            int today = now.getDayOfWeek().getValue();
            int yesterday = today == 1 ? 7 : today - 1;
            StoreHours t = storeHoursRepository.findByTenant_IdAndDayOfWeek(tenantId, today).orElse(null);
            StoreHours y = storeHoursRepository.findByTenant_IdAndDayOfWeek(tenantId, yesterday).orElse(null);
            if (t == null && y == null) return true; // no schedule -> can't tell, don't suppress
            return computeShouldBeOpen(t, y, now.toLocalTime());
        } catch (Exception e) {
            return true; // never let an hours-parse error swallow the alert
        }
    }
}
