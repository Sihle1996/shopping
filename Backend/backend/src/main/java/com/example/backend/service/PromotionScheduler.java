package com.example.backend.service;

import com.example.backend.model.Promotion;
import com.example.backend.repository.PromotionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Auto-activates and deactivates promotions based on their startAt/endAt window.
 * Runs every minute so promotions go live and expire without manual intervention.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class PromotionScheduler {

    private final PromotionRepository promotionRepository;

    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void syncPromotionStatus() {
        OffsetDateTime now = OffsetDateTime.now();

        // Activate promotions whose window has opened
        List<Promotion> toActivate = promotionRepository
                .findByActiveFalseAndStartAtLessThanEqualAndEndAtGreaterThanEqual(now, now);
        if (!toActivate.isEmpty()) {
            toActivate.forEach(p -> p.setActive(true));
            promotionRepository.saveAll(toActivate);
            log.info("PromotionScheduler: activated {} promotion(s)", toActivate.size());
        }

        // Deactivate promotions whose window has closed
        List<Promotion> toDeactivate = promotionRepository.findByActiveTrueAndEndAtLessThan(now);
        if (!toDeactivate.isEmpty()) {
            toDeactivate.forEach(p -> p.setActive(false));
            promotionRepository.saveAll(toDeactivate);
            log.info("PromotionScheduler: deactivated {} promotion(s)", toDeactivate.size());
        }
    }
}
