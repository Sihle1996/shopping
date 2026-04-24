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
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/promotions")
@RequiredArgsConstructor
public class AdminPromotionController {

    private final PromotionRepository promotionRepository;
    private final TenantRepository tenantRepository;
    private final MenuItemRepository menuItemRepository;
    private final SubscriptionEnforcementService subscriptionEnforcementService;
    private final UserRepository userRepository;
    private final EmailService emailService;

    @GetMapping
    @Transactional
    public List<PromotionDTO> list() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        List<Promotion> promotions = (tenantId != null)
                ? promotionRepository.findByTenant_Id(tenantId)
                : promotionRepository.findAll();
        return promotions.stream().map(PromotionDTO::from).toList();
    }

    @PostMapping
    @Transactional
    public ResponseEntity<PromotionDTO> create(@Valid @RequestBody PromotionRequest req) {
        Promotion p = toEntity(new Promotion(), req);
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId != null) {
            if (p.isActive()) {
                subscriptionEnforcementService.assertPromotionLimit(tenantId);
            }
            tenantRepository.findById(tenantId).ifPresent(p::setTenant);
        }
        Promotion saved = promotionRepository.save(p);
        return ResponseEntity.created(URI.create("/api/admin/promotions/" + saved.getId()))
                .body(PromotionDTO.from(saved));
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<PromotionDTO> update(@PathVariable UUID id, @Valid @RequestBody PromotionRequest req) {
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
                .map(p -> { p.setActive(value); return ResponseEntity.ok(PromotionDTO.from(promotionRepository.save(p))); })
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
        if (!promotionRepository.existsById(id)) return ResponseEntity.notFound().build();
        promotionRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private Promotion toEntity(Promotion target, PromotionRequest req) {
        target.setTitle(req.getTitle());
        target.setDescription(req.getDescription());
        target.setImageUrl(req.getImageUrl());
        target.setBadgeText(req.getBadgeText());
        target.setDiscountPercent(req.getDiscountPercent());
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
            List<MenuItem> products = menuItemRepository.findAllById(req.getTargetProductIds());
            target.setTargetProducts(products);
        } else {
            target.setTargetProducts(new ArrayList<>());
        }
        return target;
    }
}
