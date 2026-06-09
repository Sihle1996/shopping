package com.example.backend.service;

import com.example.backend.entity.DriverScoreSnapshot;
import com.example.backend.repository.DriverScoreSnapshotRepository;
import com.example.backend.repository.UserRepository;
import com.example.backend.user.Role;
import com.example.backend.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

/** Daily: records each driver's current on-time score so trends become real history, not guesses. */
@Component
@RequiredArgsConstructor
@Slf4j
public class DriverScoreSnapshotScheduler {

    private static final ZoneId ZONE = ZoneId.of("Africa/Johannesburg");

    private final UserRepository userRepository;
    private final DriverScoreSnapshotRepository snapshotRepository;

    @Scheduled(cron = "0 30 2 * * *", zone = "Africa/Johannesburg") // 02:30 SAST daily
    @Transactional
    public void snapshotDaily() {
        LocalDate today = LocalDate.now(ZONE);
        int n = 0;
        for (User d : userRepository.findByRole(Role.DRIVER)) {
            if (d.getDeliveryScoreEwma() == null) continue;                       // nothing to record yet
            if (snapshotRepository.existsByDriverIdAndSnapshotDate(d.getId(), today)) continue; // idempotent
            snapshotRepository.save(DriverScoreSnapshot.builder()
                    .tenantId(d.getTenant() != null ? d.getTenant().getId() : null)
                    .driverId(d.getId())
                    .onTimeRate((int) Math.round(d.getDeliveryScoreEwma() * 100))
                    .samples(d.getDeliveryScoreSamples())
                    .snapshotDate(today)
                    .createdAt(Instant.now())
                    .build());
            n++;
        }
        if (n > 0) log.info("Driver score snapshot: captured {} drivers for {}", n, today);
    }
}
