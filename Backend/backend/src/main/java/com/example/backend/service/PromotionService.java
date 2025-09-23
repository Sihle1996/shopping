package com.example.backend.service;

import com.example.backend.model.Promotion;
import com.example.backend.repository.PromotionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class PromotionService {
    private final PromotionRepository promotionRepository;

    public List<Promotion> getActivePromotions() {
        return promotionRepository.findActive(OffsetDateTime.now());
    }

    public Optional<Promotion> getFeaturedPromotion() {
        OffsetDateTime now = OffsetDateTime.now();
        return promotionRepository.findFirstByFeaturedTrueAndActiveTrueAndStartAtBeforeAndEndAtAfter(now, now);
    }

    public Optional<Promotion> validateCode(String code) {
        if (code == null || code.isBlank()) return Optional.empty();
        return promotionRepository.findByCodeAndActiveTrue(code.trim());
    }
}
