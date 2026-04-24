package com.example.backend.service;

import com.example.backend.config.PlanFeatureNotAvailableException;
import com.example.backend.config.PlanLimitExceededException;
import com.example.backend.entity.SubscriptionPlan;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.MenuItemRepository;
import com.example.backend.repository.PromotionRepository;
import com.example.backend.repository.SubscriptionPlanRepository;
import com.example.backend.repository.TenantRepository;
import com.example.backend.repository.UserRepository;
import com.example.backend.user.Role;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SubscriptionEnforcementService {

    private final TenantRepository tenantRepository;
    private final SubscriptionPlanRepository planRepository;
    private final MenuItemRepository menuItemRepository;
    private final UserRepository userRepository;
    private final PromotionRepository promotionRepository;

    public SubscriptionPlan getPlan(UUID tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new RuntimeException("Tenant not found"));
        return planRepository.findByName(tenant.getSubscriptionPlan())
                .orElseThrow(() -> new RuntimeException("Subscription plan not found: " + tenant.getSubscriptionPlan()));
    }

    public void assertMenuItemLimit(UUID tenantId) {
        SubscriptionPlan plan = getPlan(tenantId);
        long current = menuItemRepository.countByTenant_Id(tenantId);
        if (current >= plan.getMaxMenuItems()) {
            throw new PlanLimitExceededException(
                "Menu item limit reached (" + current + "/" + plan.getMaxMenuItems() +
                " on " + plan.getName() + " plan). Upgrade to add more items.");
        }
    }

    public void assertDriverLimit(UUID tenantId) {
        SubscriptionPlan plan = getPlan(tenantId);
        long current = userRepository.countByRoleAndTenant_Id(Role.DRIVER, tenantId);
        if (current >= plan.getMaxDrivers()) {
            throw new PlanLimitExceededException(
                "Driver limit reached (" + current + "/" + plan.getMaxDrivers() +
                " on " + plan.getName() + " plan). Upgrade to add more drivers.");
        }
    }

    public void assertPromotionLimit(UUID tenantId) {
        SubscriptionPlan plan = getPlan(tenantId);
        long current = promotionRepository.countByTenant_IdAndActiveTrue(tenantId);
        if (current >= plan.getMaxPromotions()) {
            throw new PlanLimitExceededException(
                "Active promotion limit reached (" + current + "/" + plan.getMaxPromotions() +
                " on " + plan.getName() + " plan). Upgrade or deactivate a promotion first.");
        }
    }

    public void assertAnalyticsAccess(UUID tenantId) {
        SubscriptionPlan plan = getPlan(tenantId);
        if (!plan.isHasAnalytics()) {
            throw new PlanFeatureNotAvailableException(
                "Analytics requires PRO or higher. Upgrade your plan to access this feature.");
        }
    }

    public void assertCustomBrandingAccess(UUID tenantId) {
        SubscriptionPlan plan = getPlan(tenantId);
        if (!plan.isHasCustomBranding()) {
            throw new PlanFeatureNotAvailableException(
                "Custom branding (logo & color) requires PRO or higher. Upgrade your plan.");
        }
    }

    public void assertInventoryExportAccess(UUID tenantId) {
        SubscriptionPlan plan = getPlan(tenantId);
        if (!plan.isHasInventoryExport()) {
            throw new PlanFeatureNotAvailableException(
                "Inventory export requires PRO or higher. Upgrade your plan.");
        }
    }

    public void assertDeliveryRadius(UUID tenantId, double distanceKm) {
        SubscriptionPlan plan = getPlan(tenantId);
        int maxRadius = plan.getMaxDeliveryRadiusKm();
        if (maxRadius > 0 && distanceKm > maxRadius) {
            throw new PlanLimitExceededException(
                "Delivery address is outside your plan's allowed radius (" + maxRadius + " km). Upgrade to extend your delivery range.");
        }
    }
}
