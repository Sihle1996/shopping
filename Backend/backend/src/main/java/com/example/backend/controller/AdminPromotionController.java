package com.example.backend.controller;

import com.example.backend.dto.PromotionDTO;
import com.example.backend.dto.PromotionRequest;
import com.example.backend.entity.MenuItem;
import com.example.backend.model.Promotion;
import com.example.backend.repository.MenuItemRepository;
import com.example.backend.repository.PromotionRepository;
import com.example.backend.repository.TenantRepository;
import com.example.backend.repository.UserRepository;
import com.example.backend.service.EmailService;
import com.example.backend.service.SubscriptionEnforcementService;
import com.example.backend.tenant.TenantContext;
import com.example.backend.user.User;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/promotions")
@PreAuthorize("hasAnyRole('ADMIN','SUPERADMIN')")
@RequiredArgsConstructor
public class AdminPromotionController {

    private final PromotionRepository promotionRepository;
    private final TenantRepository tenantRepository;
    private final MenuItemRepository menuItemRepository;
    private final SubscriptionEnforcementService subscriptionEnforcementService;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final com.example.backend.service.AuditService auditService;

    @GetMapping
    @Transactional
    public List<PromotionDTO> list() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) throw new SecurityException("Tenant context required");
        return promotionRepository.findByTenant_Id(tenantId).stream()
                .map(PromotionDTO::from).toList();
    }

    @PostMapping
    @Transactional
    public ResponseEntity<PromotionDTO> create(@Valid @RequestBody PromotionRequest req) {
        validate(req);
        Promotion p = toEntity(new Promotion(), req);
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId != null) {
            if (p.isActive()) {
                subscriptionEnforcementService.assertPromotionLimit(tenantId);
            }
            tenantRepository.findById(tenantId).ifPresent(p::setTenant);
        }
        Promotion saved = promotionRepository.save(p);
        auditService.log(com.example.backend.service.AuditService.ADMIN, "PROMO_CREATED", "PROMOTION",
                saved.getId(), saved.getDiscountPercent() + "% off — " + saved.getTitle());
        return ResponseEntity.created(URI.create("/api/admin/promotions/" + saved.getId()))
                .body(PromotionDTO.from(saved));
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<PromotionDTO> update(@PathVariable UUID id, @Valid @RequestBody PromotionRequest req) {
        validate(req);
        UUID tenantId = TenantContext.getCurrentTenantId();
        return (tenantId != null ? promotionRepository.findByIdAndTenant_Id(id, tenantId) : promotionRepository.findById(id))
                .map(existing -> ResponseEntity.ok(PromotionDTO.from(promotionRepository.save(toEntity(existing, req)))))
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/activate")
    @Transactional
    public ResponseEntity<PromotionDTO> activate(@PathVariable UUID id, @RequestParam boolean value) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        return (tenantId != null ? promotionRepository.findByIdAndTenant_Id(id, tenantId) : promotionRepository.findById(id))
                .map(p -> {
                    p.setActive(value);
                    Promotion s = promotionRepository.save(p);
                    auditService.log(com.example.backend.service.AuditService.ADMIN, "PROMO_TOGGLED", "PROMOTION",
                            s.getId(), (value ? "Activated" : "Paused") + " — " + s.getTitle());
                    return ResponseEntity.ok(PromotionDTO.from(s));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/featured")
    @Transactional
    public ResponseEntity<PromotionDTO> featured(@PathVariable UUID id, @RequestParam boolean value) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        return (tenantId != null ? promotionRepository.findByIdAndTenant_Id(id, tenantId) : promotionRepository.findById(id))
                .map(p -> { p.setFeatured(value); return ResponseEntity.ok(PromotionDTO.from(promotionRepository.save(p))); })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/notify")
    @Transactional
    public ResponseEntity<Map<String, Integer>> notifySubscribers(@PathVariable UUID id) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        Promotion promo = (tenantId != null
                ? promotionRepository.findByIdAndTenant_Id(id, tenantId)
                : promotionRepository.findById(id))
                .orElse(null);
        if (promo == null) return ResponseEntity.notFound().build();
        List<User> subscribers = tenantId != null
                ? userRepository.findByTenant_IdAndMarketingEmailOptInTrue(tenantId)
                : List.of();
        String storeName = promo.getTenant() != null ? promo.getTenant().getName() : "Our Store";
        String logoUrl = promo.getTenant() != null ? promo.getTenant().getLogoUrl() : null;
        String primaryColor = promo.getTenant() != null ? promo.getTenant().getPrimaryColor() : null;
        subscribers.forEach(u -> emailService.sendPromotionalEmail(
                u.getEmail(), storeName, logoUrl, primaryColor,
                promo.getTitle(), promo.getDescription(), promo.getBadgeText(), promo.getCode(), null));
        return ResponseEntity.ok(Map.of("sent", subscribers.size()));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        Promotion promo = (tenantId != null
                ? promotionRepository.findByIdAndTenant_Id(id, tenantId)
                : promotionRepository.findById(id))
                .orElse(null);
        if (promo == null) return ResponseEntity.notFound().build();
        promotionRepository.delete(promo);
        auditService.log(com.example.backend.service.AuditService.ADMIN, "PROMO_DELETED", "PROMOTION",
                id, "Deleted — " + promo.getTitle());
        return ResponseEntity.noContent().build();
    }

    /** Server-side cross-field validation. The form enforces these client-side, but a direct API
     *  client would otherwise create broken promos: no reward value, no target, or end before start. */
    private void validate(PromotionRequest req) {
        Promotion.PromoType type = req.getType() != null ? req.getType() : Promotion.PromoType.PERCENT_OFF;
        if (req.getStartAt() != null && req.getEndAt() != null && !req.getEndAt().isAfter(req.getStartAt()))
            bad("End date must be after the start date.");
        if (type == Promotion.PromoType.PERCENT_OFF && (req.getDiscountPercent() == null || req.getDiscountPercent().signum() <= 0))
            bad("A % off promotion needs a discount percent greater than 0.");
        if (type == Promotion.PromoType.AMOUNT_OFF && (req.getDiscountAmount() == null || req.getDiscountAmount().signum() <= 0))
            bad("A R-off promotion needs an amount greater than 0.");
        if (req.getAppliesTo() == Promotion.AppliesTo.PRODUCT && req.getTargetProductId() == null)
            bad("A single-product promotion needs a target product.");
        if (req.getAppliesTo() == Promotion.AppliesTo.CATEGORY && req.getTargetCategoryId() == null)
            bad("A category promotion needs a target category.");
        if (req.getAppliesTo() == Promotion.AppliesTo.MULTI_PRODUCT && (req.getTargetProductIds() == null || req.getTargetProductIds().isEmpty()))
            bad("A multi-product promotion needs at least one product.");
    }
    private void bad(String msg) {
        // GlobalExceptionHandler maps IllegalArgumentException -> 400 with the message.
        throw new IllegalArgumentException(msg);
    }

    private Promotion toEntity(Promotion target, PromotionRequest req) {
        target.setTitle(req.getTitle());
        target.setDescription(req.getDescription());
        target.setImageUrl(req.getImageUrl());
        target.setBadgeText(req.getBadgeText());
        target.setDiscountPercent(req.getDiscountPercent());
        target.setType(req.getType() != null ? req.getType() : Promotion.PromoType.PERCENT_OFF);
        target.setMinSpend(req.getMinSpend());
        target.setDiscountAmount(req.getDiscountAmount());
        target.setStartAt(req.getStartAt());
        target.setEndAt(req.getEndAt());
        target.setAppliesTo(req.getAppliesTo());
        target.setTargetCategoryId(req.getTargetCategoryId());
        target.setTargetProductId(req.getTargetProductId());
        target.setCode(req.getCode() != null ? req.getCode().trim().toUpperCase() : null);
        target.setActive(req.isActive());
        target.setFeatured(req.isFeatured());
        // Multi-product list
        if (req.getTargetProductIds() != null && !req.getTargetProductIds().isEmpty()) {
            UUID tid = TenantContext.getCurrentTenantId();
            List<MenuItem> products = menuItemRepository.findAllById(req.getTargetProductIds()).stream()
                    .filter(m -> tid == null || (m.getTenant() != null && tid.equals(m.getTenant().getId())))
                    .toList();
            target.setTargetProducts(products);
        } else {
            target.setTargetProducts(new ArrayList<>());
        }
        return target;
    }
}
