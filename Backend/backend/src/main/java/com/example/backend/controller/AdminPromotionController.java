package com.example.backend.controller;

import com.example.backend.dto.PromotionDTO;
import com.example.backend.dto.PromotionRequest;
import com.example.backend.model.Promotion;
import com.example.backend.repository.PromotionRepository;
import com.example.backend.repository.TenantRepository;
import com.example.backend.service.SubscriptionEnforcementService;
import com.example.backend.tenant.TenantContext;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/promotions")
@RequiredArgsConstructor
public class AdminPromotionController {

    private final PromotionRepository promotionRepository;
    private final TenantRepository tenantRepository;
    private final SubscriptionEnforcementService subscriptionEnforcementService;

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
        return target;
    }
}
