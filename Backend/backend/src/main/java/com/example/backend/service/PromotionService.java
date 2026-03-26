package com.example.backend.service;

import com.example.backend.model.Promotion;
import com.example.backend.repository.PromotionRepository;
import com.example.backend.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PromotionService {
    private final PromotionRepository promotionRepository;

    public List<Promotion> getActivePromotions() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId != null) {
            return promotionRepository.findActiveByTenantId(OffsetDateTime.now(), tenantId);
        }
        return promotionRepository.findActive(OffsetDateTime.now());
    }

    public Optional<Promotion> getFeaturedPromotion() {
        OffsetDateTime now = OffsetDateTime.now();
        return promotionRepository.findFirstByFeaturedTrueAndActiveTrueAndStartAtBeforeAndEndAtAfter(now, now);
    }

    public Optional<Promotion> validateCode(String code) {
        if (code == null || code.isBlank()) return Optional.empty();
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId != null) {
            return promotionRepository.findByCodeAndActiveTrueAndTenant_Id(code.trim(), tenantId);
        }
        return promotionRepository.findByCodeAndActiveTrue(code.trim());
    }
}
