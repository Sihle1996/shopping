package com.example.backend.controller;

import com.example.backend.entity.SubscriptionPlan;
import com.example.backend.repository.MenuItemRepository;
import com.example.backend.repository.PromotionRepository;
import com.example.backend.repository.TenantRepository;
import com.example.backend.repository.UserRepository;
import com.example.backend.service.EmailService;
import com.example.backend.service.SubscriptionEnforcementService;
import com.example.backend.tenant.TenantContext;
import com.example.backend.user.Role;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/subscription")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminSubscriptionController {

    private final TenantRepository tenantRepository;
    private final SubscriptionEnforcementService subscriptionEnforcementService;
    private final MenuItemRepository menuItemRepository;
    private final UserRepository userRepository;
    private final PromotionRepository promotionRepository;
    private final EmailService emailService;

    @GetMapping
    public ResponseEntity<?> getSubscriptionInfo() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.badRequest().build();

        var tenant = tenantRepository.findById(tenantId)
                .orElse(null);
        if (tenant == null) return ResponseEntity.notFound().build();

        SubscriptionPlan plan = subscriptionEnforcementService.getPlan(tenantId);

        Integer trialDaysRemaining = null;
        if ("TRIAL".equals(tenant.getSubscriptionStatus()) && tenant.getTrialStartedAt() != null) {
            long daysUsed = ChronoUnit.DAYS.between(tenant.getTrialStartedAt(), LocalDateTime.now());
            trialDaysRemaining = (int) Math.max(0, 14 - daysUsed);
        }

        long menuItems = menuItemRepository.countByTenant_Id(tenantId);
        long drivers = userRepository.countByRoleAndTenant_Id(Role.DRIVER, tenantId);
        long activePromotions = promotionRepository.countByTenant_IdAndActiveTrue(tenantId);

        Map<String, Object> response = new HashMap<>();
        response.put("plan", tenant.getSubscriptionPlan());
        response.put("status", tenant.getSubscriptionStatus());
        response.put("trialDaysRemaining", trialDaysRemaining); // null-safe with HashMap
        response.put("usage", Map.of(
            "menuItems", menuItems,
            "maxMenuItems", plan.getMaxMenuItems(),
            "drivers", drivers,
            "maxDrivers", plan.getMaxDrivers(),
            "activePromotions", activePromotions,
            "maxPromotions", plan.getMaxPromotions()
        ));
        response.put("features", Map.of(
            "hasAnalytics", plan.isHasAnalytics(),
            "hasCustomBranding", plan.isHasCustomBranding(),
            "hasInventoryExport", plan.isHasInventoryExport(),
            "maxDeliveryRadiusKm", plan.getMaxDeliveryRadiusKm(),
            "commissionPercent", plan.getCommissionPercent()
        ));
        return ResponseEntity.ok(response);
    }

    @PostMapping("/upgrade-request")
    public ResponseEntity<?> requestUpgrade() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.badRequest().build();

        var tenant = tenantRepository.findById(tenantId).orElse(null);
        if (tenant == null) return ResponseEntity.notFound().build();

        emailService.sendRaw(
            "support@fastfood.co.za",
            "Upgrade request from " + tenant.getName(),
            "<p><strong>" + tenant.getName() + "</strong> (slug: " + tenant.getSlug() + ")" +
            " has requested a plan upgrade from <strong>" + tenant.getSubscriptionPlan() + "</strong>.</p>" +
            "<p>Current status: " + tenant.getSubscriptionStatus() + "</p>"
        );

        return ResponseEntity.ok(Map.of("message", "Upgrade request sent. Our team will contact you within 24 hours."));
    }
}
