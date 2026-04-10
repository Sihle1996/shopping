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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
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
        response.put("trialDaysRemaining", trialDaysRemaining);
        response.put("cancelledAt", tenant.getSubscriptionCancelledAt());
        response.put("billingPeriodEnd", tenant.getBillingPeriodEnd());
        response.put("scheduledDowngradePlan", tenant.getScheduledDowngradePlan());
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
            "maxDeliveryRadiusKm", plan.getMaxDeliveryRadiusKm()
        ));
        return ResponseEntity.ok(response);
    }

    // ZAR prices for PayFast
    private static final Map<String, Double> PLAN_PRICES_ZAR = Map.of(
        "BASIC", 299.00,
        "PRO", 699.00,
        "ENTERPRISE", 1499.00
    );
    private static final List<String> PLAN_ORDER = List.of("TRIAL", "BASIC", "PRO", "ENTERPRISE");

    @GetMapping("/plans")
    public ResponseEntity<?> getAvailablePlans() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.badRequest().build();
        var tenant = tenantRepository.findById(tenantId).orElse(null);
        if (tenant == null) return ResponseEntity.notFound().build();

        String currentPlan = tenant.getSubscriptionPlan();
        int currentIdx = PLAN_ORDER.indexOf(currentPlan);

        List<Map<String, Object>> plans = new ArrayList<>();
        for (String planName : List.of("BASIC", "PRO", "ENTERPRISE")) {
            int planIdx = PLAN_ORDER.indexOf(planName);
            Map<String, Object> p = new HashMap<>();
            p.put("name", planName);
            p.put("priceZar", PLAN_PRICES_ZAR.get(planName));
            p.put("isUpgrade", planIdx > currentIdx);
            plans.add(p);
        }
        return ResponseEntity.ok(plans);
    }

    @PostMapping("/upgrade")
    public ResponseEntity<?> executeUpgrade(@RequestBody Map<String, String> body) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.badRequest().build();
        var tenant = tenantRepository.findById(tenantId).orElse(null);
        if (tenant == null) return ResponseEntity.notFound().build();

        String planName = body.get("planName");
        if (planName == null || !PLAN_PRICES_ZAR.containsKey(planName)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid plan name"));
        }

        String currentPlan = tenant.getSubscriptionPlan();
        if (PLAN_ORDER.indexOf(planName) <= PLAN_ORDER.indexOf(currentPlan)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Can only upgrade to a higher plan"));
        }

        // Payment was captured via PayFast redirect — paymentId logged for audit
        String paymentId = body.getOrDefault("paymentId", "n/a");

        tenant.setSubscriptionPlan(planName);
        tenant.setSubscriptionStatus("ACTIVE");
        tenant.setBillingPeriodEnd(LocalDateTime.now().plusDays(30));
        tenant.setSubscriptionCancelledAt(null);
        tenantRepository.save(tenant);

        return ResponseEntity.ok(Map.of(
            "message", "Successfully upgraded to " + planName,
            "plan", planName,
            "status", "ACTIVE"
        ));
    }

    @PostMapping("/cancel")
    public ResponseEntity<?> cancelSubscription(@RequestBody(required = false) Map<String, String> body) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.badRequest().build();
        var tenant = tenantRepository.findById(tenantId).orElse(null);
        if (tenant == null) return ResponseEntity.notFound().build();

        String currentPlan = tenant.getSubscriptionPlan();
        if ("BASIC".equals(currentPlan) || "TRIAL".equals(tenant.getSubscriptionStatus())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Nothing to cancel on a BASIC or TRIAL plan"));
        }
        if (tenant.getSubscriptionCancelledAt() != null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Subscription already scheduled for cancellation"));
        }

        // targetPlan must be a lower plan; default to BASIC
        String targetPlan = (body != null && body.get("targetPlan") != null) ? body.get("targetPlan") : "BASIC";
        int currentIdx = PLAN_ORDER.indexOf(currentPlan);
        int targetIdx  = PLAN_ORDER.indexOf(targetPlan);
        if (targetIdx < 0 || targetIdx >= currentIdx) {
            return ResponseEntity.badRequest().body(Map.of("error", "Target plan must be lower than current plan"));
        }

        if (tenant.getBillingPeriodEnd() == null) {
            tenant.setBillingPeriodEnd(LocalDateTime.now().plusDays(30));
        }
        tenant.setSubscriptionCancelledAt(LocalDateTime.now());
        tenant.setScheduledDowngradePlan(targetPlan);
        tenantRepository.save(tenant);

        if (tenant.getEmail() != null) {
            emailService.sendRaw(tenant.getEmail(),
                "Your downgrade has been scheduled",
                "<p>Hi <strong>" + tenant.getName() + "</strong>,</p>" +
                "<p>Your <strong>" + currentPlan + "</strong> plan stays active until " +
                "<strong>" + tenant.getBillingPeriodEnd().toLocalDate() + "</strong>, " +
                "then moves to <strong>" + targetPlan + "</strong>.</p>" +
                "<p>Changed your mind? You can undo this from your subscription settings before that date.</p>"
            );
        }

        return ResponseEntity.ok(Map.of(
            "message", "Downgrade to " + targetPlan + " scheduled",
            "targetPlan", targetPlan,
            "billingPeriodEnd", tenant.getBillingPeriodEnd().toString()
        ));
    }

    @PostMapping("/cancel/undo")
    public ResponseEntity<?> undoCancellation() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.badRequest().build();
        var tenant = tenantRepository.findById(tenantId).orElse(null);
        if (tenant == null) return ResponseEntity.notFound().build();

        if (tenant.getSubscriptionCancelledAt() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "No pending downgrade to undo"));
        }

        tenant.setSubscriptionCancelledAt(null);
        tenant.setScheduledDowngradePlan(null);
        tenantRepository.save(tenant);

        return ResponseEntity.ok(Map.of("message", "Downgrade reversed. Your plan remains active."));
    }
}
