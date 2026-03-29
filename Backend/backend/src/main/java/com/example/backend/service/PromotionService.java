package com.example.backend.service;

import com.example.backend.entity.Category;
import com.example.backend.entity.MenuItem;
import com.example.backend.model.Promotion;
import com.example.backend.repository.CategoryRepository;
import com.example.backend.repository.MenuItemRepository;
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
    private final CategoryRepository categoryRepository;
    private final MenuItemRepository menuItemRepository;

    private void enrichPromotions(List<Promotion> promotions) {
        for (Promotion p : promotions) {
            if (p.getAppliesTo() == Promotion.AppliesTo.CATEGORY && p.getTargetCategoryId() != null) {
                categoryRepository.findById(p.getTargetCategoryId())
                        .ifPresent(c -> p.setTargetCategoryName(c.getName()));
            }
            if (p.getAppliesTo() == Promotion.AppliesTo.PRODUCT && p.getTargetProductId() != null) {
                menuItemRepository.findById(p.getTargetProductId())
                        .ifPresent(m -> p.setTargetProductName(m.getName()));
            }
        }
    }

    public List<Promotion> getActivePromotions() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        List<Promotion> list;
        if (tenantId != null) {
            list = promotionRepository.findActiveByTenantId(OffsetDateTime.now(), tenantId);
        } else {
            list = promotionRepository.findActive(OffsetDateTime.now());
        }
        enrichPromotions(list);
        return list;
    }

    public Optional<Promotion> getFeaturedPromotion() {
        OffsetDateTime now = OffsetDateTime.now();
        UUID tenantId = TenantContext.getCurrentTenantId();
        Optional<Promotion> opt = (tenantId != null)
                ? promotionRepository.findFeaturedByTenantId(now, tenantId)
                : promotionRepository.findFirstByFeaturedTrueAndActiveTrueAndStartAtBeforeAndEndAtAfter(now, now);
        opt.ifPresent(p -> enrichPromotions(List.of(p)));
        return opt;
    }

    public Optional<Promotion> validateCode(String code) {
        if (code == null || code.isBlank()) return Optional.empty();
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId != null) {
            return promotionRepository.findByCodeAndActiveTrueAndTenant_Id(code.trim(), tenantId);
        }
        return promotionRepository.findByCodeAndActiveTrue(code.trim());
    }

    public Optional<Promotion> findAutoAppliedAllPromo() {
        return getActivePromotions().stream()
                .filter(p -> p.getCode() == null || p.getCode().isBlank())
                .filter(p -> p.getAppliesTo() == Promotion.AppliesTo.ALL)
                .filter(p -> p.getDiscountPercent() != null)
                .findFirst();
    }
}
